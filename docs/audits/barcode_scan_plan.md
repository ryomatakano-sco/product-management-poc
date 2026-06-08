# Barcode Scan (camera → JAN → existing auto-fill) — PLAN

**Branch:** `feature/barcode-scan` (off `fix/category-vendor-mapping` @ `ca323e8`)
**Date:** 2026-06-08
**Goal:** Let a user scan a product barcode with a camera (PC webcam OR phone browser) so the detected JAN flows into the **existing** product-registration search/auto-fill (the JAN pipeline with the Item-1 accuracy guard).

> **PAUSE point:** This is the plan. No build code is committed beyond this doc until acknowledged. Option 2 is explicitly **not** to be built without Fukunaga alignment.

---

## Key finding: Option 1 already largely exists

While tracing the registration screen I found a working camera scanner is **already implemented and on `main`** (added ~`a4bad2b`, "Yoshioka 2026-05-11: barcode-first UX"):

- `frontend/pages/ProductCreate.jsx:1292-1449` — `BarcodeScanner` component.
- `frontend/pages/ProductCreate.jsx:932,954-960,1010-1015,1085-1097` — wired into the AI Assist modal (📷 カメラで読み取る button → scanner overlay → `onScanDetected` → lookup).
- `frontend/index.html:93-98` — `html5-qrcode@2.3.8` loaded from CDN (lazy; only this component uses it).

What it already does (matches Option 1):
- `getUserMedia` via html5-qrcode with `facingMode: "environment"` — the **same code path works on a PC webcam and a phone browser**, so one implementation covers both the earlier "PC camera" ask and "scan with phone." (`:1354`)
- Formats: EAN-13 (= JAN-13), EAN-8, CODE-128, QR (`:1326-1333`).
- Camera-permission failure → on-screen message "カメラ権限を許可してください" (`:1359-1364`); library-load failure handled (`:1305-1308`).
- Stops the camera stream + clears on unmount, guarded (`:1367-1389`).
- On detect → sets the JAN field and fires `api.createAiSuggestion({ jan })` (`:954-960`, `:973-976`) → the **existing guarded pipeline** (`POST /ai-suggestions`, Item-1 `jan_verified` guard). **No parallel search path.**
- Privacy: frames decoded client-side, **no image stored or uploaded**, only the JAN string leaves the browser. **No new secrets.**

So the architecture decision is effectively already made and shipped: **Option 1 (in-app responsive scanner, no backend relay).** The remaining work is **completion/hardening**, not a new build (scoped in §B2 below).

---

## Option 1 — In-app responsive scanner (RECOMMENDED for PoC)

**What:** The registration screen's AI Assist modal opens a camera view (getUserMedia) that reads the JAN on whatever device the browser runs on (PC webcam or phone browser). On a valid JAN, it feeds the existing JAN lookup/auto-fill. No backend relay, no device pairing.

**Effort:** Low — the scanner exists. Remaining hardening (see §B2): client-side JAN validation gate, native `BarcodeDetector` preference with html5-qrcode fallback, and phone responsiveness of the modal.

**Tradeoffs:**
- ✅ One code path covers PC webcam + phone browser.
- ✅ Lowest risk; no new backend, no new infra, no new secrets.
- ✅ Reuses the existing guarded JAN pipeline verbatim.
- ⚠️ The phone user must open the app *on the phone* (the desktop screen can't borrow the phone's camera). For a clinic PoC where staff can open the URL on a phone, this is fine.
- ⚠️ iOS Safari has no `BarcodeDetector`, so it relies on the html5-qrcode WASM decoder; and getUserMedia on iOS requires HTTPS (or localhost) + a user gesture (see browser-support notes in §B2/after doc).

**Recommendation: ship Option 1.** It already exists, satisfies both the "PC camera" and "scan with phone" requirements with one responsive view, and carries the least risk for a PoC.

---

## Option 2 — Cross-device companion (desktop ⟷ phone relay) — FLAG, do NOT build

**What:** User works on a desktop, scans with their phone, and the result is relayed desktop ← phone. The desktop shows a QR/short code; the phone opens a scan page bound to the **same session**; the detected JAN is pushed back to the desktop registration form.

**Needs:**
- Session pairing (desktop generates a token → renders a QR → phone opens `/scan?token=…`).
- A backend **relay channel**: SSE, WebSocket, or short-polling, plus a short-lived server-side session store mapping token → latest scanned JAN.
- New endpoints + state in the FastAPI `service/` layer; CORS/headers for the phone origin; token expiry/security.

**Effort:** Meaningfully higher — new backend surface, new transport, pairing UX, security review.

**Tradeoffs:**
- ✅ Desktop user keeps working on the big screen and uses the phone purely as a scanner gun.
- ❌ It is a **meaningful architecture change** (new relay + session pairing). Per the standing rule (RAG/architecture changes need explicit Fukunaga alignment before implementation), this must be **aligned with Fukunaga before any build**.
- ❌ More moving parts = more PoC risk for a benefit (desktop+phone split) that Option 1's "just open it on the phone" mostly already delivers.

**Decision: FLAG only. Do not build Option 2 unilaterally.** Raise it with Fukunaga if the desktop⟷phone split is actually wanted; otherwise Option 1 covers the requirement.

---

## Proposed scope for B2 (Option 1 completion — pending acknowledgment)

All in the no-build React + per-screen convention; reuse the existing JAN logic; no new secrets; no backend changes.

1. **Client-side JAN validation gate (highest value).** Add a tiny frontend mirror of `backend/app/services/jan.py` (NFKC normalize → digits → length 8/13 → GS1 mod-10 check) as `frontend/lib/jan.js` (window-exported, loaded in `index.html`). In `onScanDetected`, **only fire the lookup when the scanned code is a valid JAN**; non-JAN codes (QR/Code-128/bad check digit) are ignored and the scanner keeps running with a gentle "JANバーコードを読み取ってください" hint. This realizes the spec's "only a valid JAN feeds the product lookup" and avoids firing a doomed 422 lookup on a random QR. (The backend `_normalised_jan_or_422` remains the server-side gate — defense in depth.)
2. **Prefer native `BarcodeDetector`, fall back to html5-qrcode.** Use `window.BarcodeDetector` (with `['ean_13','ean_8']`) where supported (Android Chrome, desktop Chrome/Edge) for speed/accuracy; fall back to the existing html5-qrcode path otherwise (notably iOS Safari, Firefox). Keep EAN-13/EAN-8 support in both.
3. **Phone responsiveness.** The AI Assist modal is a fixed `width: 680` (`ProductCreate.jsx:1017`) which overflows a ~380px phone. Make it responsive (`maxWidth`/`width:"92%"`). The scanner overlay is already responsive.
4. **Graceful manual fallback.** On permission-denied/unsupported, keep the existing error message and ensure the user can cancel back to the manual JAN input (already present in the modal); add an explicit hint.

Out of scope (and why): no backend relay (that's Option 2); no image capture/storage; no new search path; no new dependency beyond the already-loaded html5-qrcode (BarcodeDetector is a built-in browser API).

---

## Recommendation (one line)

**Proceed with Option 1** — complete/harden the already-shipped in-app scanner (items 1–4 above). **Do not build Option 2** (relay) without Fukunaga alignment.
