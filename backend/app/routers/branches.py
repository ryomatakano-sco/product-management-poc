from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.deps import DB, StoreId
from app.models.branch import Branch
from app.schemas.base import PaginatedResponse
from app.schemas.branch import BranchCreate, BranchRead, BranchUpdate

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("", response_model=PaginatedResponse[BranchRead])
async def list_branches(
    db: DB,
    store_id: StoreId,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    include_default: bool = Query(True),
):
    q = select(Branch).where(Branch.store_id == store_id)
    if not include_default:
        q = q.where(Branch.is_default == False)  # noqa: E712
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.order_by(Branch.id).offset(offset).limit(limit))).scalars().all()
    return PaginatedResponse(items=rows, total=total)


@router.post("", response_model=BranchRead, status_code=201)
async def create_branch(body: BranchCreate, db: DB, store_id: StoreId):
    branch = Branch(store_id=store_id, **body.model_dump())
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


@router.get("/{branch_id}", response_model=BranchRead)
async def get_branch(branch_id: int, db: DB, store_id: StoreId):
    branch = (
        await db.execute(
            select(Branch).where(Branch.id == branch_id, Branch.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not branch:
        raise HTTPException(404, detail="Branch not found")
    return branch


@router.patch("/{branch_id}", response_model=BranchRead)
async def update_branch(branch_id: int, body: BranchUpdate, db: DB, store_id: StoreId):
    branch = (
        await db.execute(
            select(Branch).where(Branch.id == branch_id, Branch.store_id == store_id)
        )
    ).scalar_one_or_none()
    if not branch:
        raise HTTPException(404, detail="Branch not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(branch, key, val)
    await db.commit()
    await db.refresh(branch)
    return branch
