"""PoC session-cookie auth + user management (Settings › ユーザー管理).

Login sets an HttpOnly HMAC-signed cookie (services/auth.py). `GET /auth/me`
is the frontend's gate: 401 → show the Login page. User management endpoints
require the caller to be an admin of the same store.

The `X-Store-Id` header keeps working as a dev fallback everywhere (deps.py),
so curl testing and the DevPanel store switcher are unaffected. A production
build would remove that fallback and derive the store purely from the session.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select

from app.deps import DB, StoreId
from app.services.audit import log_event
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import LoginRequest, UserCreate, UserRead, UserUpdate
from app.services.auth import (
    COOKIE_NAME,
    SESSION_TTL_SECONDS,
    hash_password,
    make_session_token,
    parse_session_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def _session_user(request: Request, db) -> User | None:
    tok = parse_session_token(request.cookies.get(COOKIE_NAME))
    if not tok:
        return None
    user = (await db.execute(
        select(User).where(User.id == tok["user_id"])
    )).scalar_one_or_none()
    if user is None or user.status != UserStatus.active:
        return None
    return user


async def _require_admin(request: Request, db, store_id: int) -> User:
    user = await _session_user(request, db)
    if user is None:
        raise HTTPException(401, detail="ログインが必要です")
    if user.store_id != store_id:
        raise HTTPException(403, detail="この店舗の操作権限がありません")
    if user.role != UserRole.admin:
        raise HTTPException(403, detail="管理者権限が必要です")
    return user


@router.post("/login", response_model=UserRead, summary="ログイン")
async def login(body: LoginRequest, response: Response, db: DB):
    user = (await db.execute(
        select(User).where(User.email == body.email.strip().lower())
    )).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, detail="メールアドレスまたはパスワードが正しくありません")
    if user.status != UserStatus.active:
        raise HTTPException(403, detail="このアカウントは無効化されています")

    response.set_cookie(
        COOKIE_NAME,
        make_session_token(user.id, user.store_id),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
    )
    return user


@router.post("/logout", status_code=204, summary="ログアウト")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)


@router.get("/me", response_model=UserRead, summary="ログイン中のユーザー")
async def me(request: Request, db: DB):
    user = await _session_user(request, db)
    if user is None:
        raise HTTPException(401, detail="未ログインです")
    return user


# ── User management (admin only) ────────────────────────────────────

@router.get("/users", response_model=list[UserRead], summary="ユーザー一覧（管理者）")
async def list_users(request: Request, db: DB, store_id: StoreId):
    await _require_admin(request, db, store_id)
    rows = (await db.execute(
        select(User).where(User.store_id == store_id).order_by(User.id)
    )).scalars().all()
    return rows


@router.post("/users", response_model=UserRead, status_code=201, summary="ユーザーを追加（管理者）")
async def create_user(body: UserCreate, request: Request, db: DB, store_id: StoreId):
    admin_user = await _require_admin(request, db, store_id)
    email = body.email.strip().lower()
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise HTTPException(409, detail="このメールアドレスは既に登録されています")
    user = User(
        store_id=store_id,
        email=email,
        password_hash=hash_password(body.password),
        display_name=body.display_name.strip(),
        role=body.role,
    )
    db.add(user)
    await db.flush()
    log_event(db, store_id=store_id, user_name=admin_user.display_name,
              action="user_created", entity_type="user", entity_id=user.id,
              detail=f"{user.display_name} <{email}> role={user.role.value}")
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserRead, summary="ユーザーを更新（管理者）")
async def update_user(user_id: int, body: UserUpdate, request: Request, db: DB, store_id: StoreId):
    admin = await _require_admin(request, db, store_id)
    user = (await db.execute(
        select(User).where(User.id == user_id, User.store_id == store_id)
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(404, detail="ユーザーが見つかりません")
    # Don't let an admin lock themselves out by deactivating/demoting themselves.
    if user.id == admin.id and (body.status == UserStatus.inactive or body.role == UserRole.staff):
        raise HTTPException(400, detail="自分自身の権限・状態は変更できません")
    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        pw = data.pop("password")
        if pw:
            user.password_hash = hash_password(pw)
            log_event(db, store_id=store_id, user_name=admin.display_name,
                      action="user_password_reset", entity_type="user",
                      entity_id=user.id, detail=user.display_name)
    if "status" in data and data["status"] != user.status:
        log_event(db, store_id=store_id, user_name=admin.display_name,
                  action=("user_disabled" if data["status"] == UserStatus.inactive else "user_enabled"),
                  entity_type="user", entity_id=user.id, detail=user.display_name)
    if "role" in data and data["role"] != user.role:
        log_event(db, store_id=store_id, user_name=admin.display_name,
                  action="user_role_changed", entity_type="user", entity_id=user.id,
                  detail=f"{user.display_name} → {data['role'].value}")
    for k, v in data.items():
        setattr(user, k, v)
    await db.commit()
    await db.refresh(user)
    return user


# ── Audit log (admin only, mig 016) ─────────────────────────────────

@router.get("/audit-events", summary="監査ログ（管理者）")
async def list_audit_events(
    request: Request, db: DB, store_id: StoreId,
    limit: int = 30, offset: int = 0,
):
    from sqlalchemy import func as _func

    from app.models.audit import AuditEvent

    await _require_admin(request, db, store_id)
    limit = max(1, min(limit, 100))
    total = (await db.execute(
        select(_func.count()).select_from(AuditEvent).where(AuditEvent.store_id == store_id)
    )).scalar_one()
    rows = (await db.execute(
        select(AuditEvent).where(AuditEvent.store_id == store_id)
        .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
        .limit(limit).offset(offset)
    )).scalars().all()
    return {
        "total": total,
        "items": [{
            "id": e.id,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "user_name": e.user_name,
            "action": e.action,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "detail": e.detail,
        } for e in rows],
    }
