# Barcode Scan — Test Report

**Branch:** `feature/barcode-scan`
**Date:** 2026-06-08
**Built:** Option 2 (desktop⟷phone relay) per Nafis's explicit instruction, **plus** the client-side JAN validation gate from Option 1. See `barcode_scan_after.md` for the file list.
**Live camera cannot run headless**, so camera capture/decode and on-device behavior are labeled NOT-CAMERA-TESTED with manual steps below.

---

## MEASURED (ran, automated)

### 1. Frontend syntax / JSX transforms cleanly
All changed/added frontend files transform under Babel (`presets: env, react`) — the same transform the browser does at load. No syntax errors.

```
OK   app.jsx
OK   lib/jan.js
OK   lib/api.js
OK   lib/hooks.js
OK   pages/ScanReceiver.jsx
OK   pages/ProductCreate.jsx
```

### 2. Client-side JAN validator (`lib/jan.js`) matches the backend
Unit-tested against the same rules as `backend/app/services/jan.py`:

| Case | Input | Result |
|---|---|---|
| valid JAN-13 | `4901616009677` | ✅ valid |
| valid JAN-13 | `4548161168857` | ✅ valid |
| valid EAN-8 | `96385074` | ✅ valid |
| bad check digit | `4901616009678` | ✅ rejected |
| wrong length (12) | `490161600967` | ✅ rejected |
| non-digit / QR text | `HELLOQR` | ✅ rejected |
| full-width digits | `４９０１６１６００９６７７` | ✅ normalized → `4901616009677` |
| null / empty | `null`, `""` | ✅ rejected |

→ The scanner's `validate` gate (only a valid JAN latches) is correct, and the client mirror won't diverge from the server gate.

### 3. Backend relay logic (`services/scan_relay.py`) — unit
`create_session` → token (12 chars, unguessable), TTL 300s. `submit_scan`: valid JAN stored + status `done`; bad check digit and non-JAN raise `invalid_jan`; unknown token raises `not_found`; full-width JAN normalized. (All passed.)

### 4. Relay HTTP wiring (`routers/scan_sessions.py`) — end-to-end via FastAPI TestClient
No live DB and **no `X-Store-Id` header** sent (the relay is intentionally store-agnostic):

```
POST /scan-sessions                       → 201 {token, expires_in_seconds:300}
GET  /scan-sessions/{token}               → 200 {status:"pending", jan:null}
POST /scan-sessions/{token}/scan {valid}  → 200 {status:"done", jan:"4901616009677"}
GET  /scan-sessions/{token}               → 200 {status:"done", jan:"4901616009677"}
POST /scan-sessions/{t}/scan {bad check}  → 422 (有効なJANバーコードではありません)
POST /scan-sessions/{t}/scan {non-JAN}    → 422
POST /scan-sessions/zzzz/scan {valid}     → 410 (ペアリングが見つかりません)
GET  /scan-sessions/zzzz                  → 200 {status:"expired"}
```

→ The full pairing handshake works: desktop creates → phone submits a validated JAN → desktop poll sees it. Bad/non-JAN never reach the desktop. Unknown/expired tokens are handled cleanly.

### 5. detect → lookup wiring (mocked detected JAN)
The desktop path is wired so a JAN arriving from the phone (`onPhoneJan`, `ProductCreate.jsx`) or from the local camera (`onScanDetected`) calls `lookup({janOverride})` → `api.createAiSuggestion({ jan })` — the **existing** guarded JAN pipeline (Item-1 `jan_verified` guard), the *same* call the manual JAN textbox makes. **No parallel search path was added.** (The createAiSuggestion pipeline itself is unchanged and was already verified in Part A / item1 reports; this work only feeds it.)

---

## NOT CAMERA-TESTED (requires a physical camera + HTTPS/localhost)

- Actual `getUserMedia` camera capture and html5-qrcode decode of a real EAN-13/EAN-8 barcode (desktop webcam and phone).
- QR **generation** render (`qrcodejs`) and a phone opening the encoded `/app/#/scan?token=…` URL.
- iOS Safari behavior (no `BarcodeDetector`; getUserMedia needs HTTPS + user gesture).
- The CDN scripts actually loading in a browser (`html5-qrcode@2.3.8`, `qrcodejs@1.0.0`). They are pinned, same versions already used in the app; load success is browser-verified only.

---

## Manual test steps for Nafis

### Prep
1. Start the stack: `scripts\dev.bat` (needs MySQL up; OPENAI_API_KEY in root `.env` for a real lookup, else mock).
2. For **phone** testing you need the phone to reach your PC. Options: same Wi-Fi + open `http://<PC-LAN-IP>:8000/app/` on the phone. NOTE: a phone browser will **block camera over plain http on a non-localhost origin** — iOS/Android require HTTPS. For a quick test use a tunnel (e.g. run an HTTPS tunnel to :8000) or test the phone camera path via `https://`. The desktop webcam path works on `http://localhost:8000`.

### A. Desktop webcam (local scan, Option 1 path + new JAN gate)
1. Open `http://localhost:8000/app/#/products/new` → click "AI で入力する".
2. In JAN mode, click **📷 カメラで読み取る** → allow camera.
3. Point at a product's barcode. Confirm: a non-JAN (QR) is *ignored* (hint shows "JAN（商品バーコード）を枠内に合わせてください"); a valid JAN latches, the modal shows it, and the AI lookup fires.
4. Deny camera → confirm a clear permission message appears and you can cancel back to manual entry.

### B. Phone companion (Option 2 relay) — the new path
1. On the desktop modal (JAN mode) click **📱 スマホでスキャン**. A QR appears (plus the URL as text).
2. Scan the QR with the phone camera → the phone opens the scan page (over HTTPS — see prep).
3. On the phone, allow camera and scan the product barcode. Confirm: phone shows "✅ 送信しました"; **desktop** auto-fills (lookup starts) within ~1.5s.
4. Edge cases to try: scan a QR/non-barcode on the phone (should be ignored, keep scanning); wait >5 min then scan (desktop shows "有効期限が切れました"); use the phone's "手入力" box with a valid and an invalid JAN.

### C. Quick API smoke (no camera, optional)
```
curl -X POST http://localhost:8000/scan-sessions
curl -X POST http://localhost:8000/scan-sessions/<token>/scan -H "Content-Type: application/json" -d "{\"code\":\"4901616009677\"}"
curl http://localhost:8000/scan-sessions/<token>
```
Expect: create→token, scan→{done, jan}, get→{done, jan}.
