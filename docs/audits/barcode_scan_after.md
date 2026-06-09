# Barcode Scan — AFTER

**Branch:** `feature/barcode-scan` (off `fix/category-vendor-mapping` @ `ca323e8`)
**Date:** 2026-06-08

## Decision note (important)

Nafis explicitly chose to build **Option 2** (desktop⟷phone relay), overriding the standing rule that a meaningful architecture change needs Fukunaga alignment *before* implementation. Per his instruction it was built. Everything is **local and unpushed**; this needs **Fukunaga's sign-off before integration/push**. The Option-1 client-side JAN gate was folded in too (it improves the pre-existing local scanner as well).

## What was built

A camera barcode scan path where the phone scans and the JAN flows to the desktop's existing JAN auto-fill, via an in-memory relay. The pre-existing local-camera scanner (`BarcodeScanner`, already on `main`) was reused and hardened (JAN-only latching).

### Files added
- `backend/app/services/scan_relay.py` — pure in-memory pairing store + TTL; JAN validated via existing `jan.py`. Key bits: `create_session` (`:62`), `submit_scan` (`:113`), `get_session` (`:99`), `SESSION_TTL_SECONDS=300` (`:38`).
- `backend/app/schemas/scan_session.py` — relay request/response models.
- `backend/app/routers/scan_sessions.py` — `POST /scan-sessions` (`:34`), `GET /scan-sessions/{token}` (`:48`), `POST /scan-sessions/{token}/scan` (`:62`). Deliberately **no `X-Store-Id`** (store-agnostic relay).
- `frontend/lib/jan.js` — client mirror of `jan.py`: `plxNormalizeJan`/`plxValidateCheckDigit`/`plxCleanJan`/`plxIsValidJan`.
- `frontend/pages/ScanReceiver.jsx` — standalone phone scan view (`#/scan?token=…`); reuses `window.BarcodeScanner`, validates JAN client-side, POSTs to relay; manual-entry fallback.

### Files changed
- `backend/app/main.py:30,68` — import + `include_router(scan_sessions.router)`.
- `frontend/index.html:100-105` — load `qrcodejs@1.0.0` (QR generator); `:118` load `lib/jan.js`; `:133-135` load `pages/ScanReceiver.jsx` after `ProductCreate.jsx`.
- `frontend/lib/api.js:86-94` — `createScanSession` / `getScanSession` / `submitScanSession`.
- `frontend/lib/hooks.js:53-56` — parse `/scan` route.
- `frontend/app.jsx:13-19` — render `ScanReceiver` bare (no admin shell) for the `scan` route.
- `frontend/pages/ProductCreate.jsx`:
  - `BarcodeScanner` now takes `validate`/`onReject` and only latches a code that passes `validate` (JAN-only), with a "point at the JAN" hint (`~:1300-1360`, `~:1455`). Exported as `window.BarcodeScanner` (`~:1612`).
  - Local scan `onScanDetected` normalizes via `plxCleanJan` and passes `validate=plxIsValidJan` to the scanner (`~:957`, `~:1024`).
  - New `PhonePairModal` (QR + relay polling) (`~:1300` block) wired via `pairOpen` state + `onPhoneJan` (`~:935`, `~:972`) and a **📱 スマホでスキャン** button (`~:1146`). On JAN arrival it calls the existing `lookup()` → `api.createAiSuggestion({ jan })`.

(Line numbers are approximate after edits; symbols are exact.)

## Library choice + why
- **Reading barcodes:** `html5-qrcode@2.3.8` (already loaded in the app) — getUserMedia + WASM decoder, supports EAN-13 (=JAN-13) / EAN-8 / Code-128 / QR, works on PC webcam **and** phone browser with one code path. Reused rather than swapped to avoid regressing the existing, shipped scanner.
- **Generating the pairing QR:** `qrcodejs@1.0.0` (cdnjs) — tiny, offline, client-side canvas/img render. A *generator* (distinct from html5-qrcode, which only reads). Fallback: if the lib fails to load, the modal shows the raw URL to type into the phone.
- **Native `BarcodeDetector`:** NOT adopted in this pass. html5-qrcode already covers all target browsers including iOS Safari (where `BarcodeDetector` is absent). Documented as an optional future fast-path (Android/desktop Chrome) — see TODO.
- **Relay transport:** short-poll (1.5s) over plain JSON endpoints — simplest, no WebSocket/SSE infra, fine for a seconds-long handshake. **In-memory** store (no DB) to avoid a manual schema change (PoC has no migrations).

## Browser-support notes
- **getUserMedia requires a secure context.** Works on `http://localhost` (desktop). A **phone** opening `http://<LAN-IP>:8000` over plain http will be **blocked from the camera** by iOS/Android — the phone path needs **HTTPS** (tunnel or TLS). The manual-entry fallback on the phone page works regardless.
- **iOS Safari:** no `BarcodeDetector` → relies on the html5-qrcode decoder (works). getUserMedia needs a user gesture + HTTPS.
- **Desktop Chrome/Edge/Firefox, Android Chrome:** html5-qrcode works on localhost/HTTPS.
- The relay is process-local (single uvicorn worker assumption) and tokenized/unguessable with a 5-min TTL; no auth (PoC). Multi-worker deploy or stronger auth = revisit.

## Done vs TODO
**Done:** relay backend (logic + HTTP, unit + end-to-end tested), client JAN validator (tested = backend), JAN-only scanner gate, phone scan page, desktop QR pairing + polling, feed into existing guarded lookup (no parallel path), no new secrets, no image stored/uploaded, no DB migration.

**TODO / not done:** physical camera capture + on-device decode (not headless-testable — manual steps provided); HTTPS for the phone camera path in Nafis's environment; optional native `BarcodeDetector` fast-path; **Fukunaga alignment before push** (Option 2 is an architecture addition).

## Connectivity fixes (2026-06-08, after first phone test failed)

First phone test failed: the phone couldn't use the app at all. Root cause + fixes:
- **Server bound to localhost.** `scripts/dev.bat` ran uvicorn `--host 127.0.0.1`, so the PC was the only client that could connect (confirmed: `netstat` showed `127.0.0.1:8000` LISTENING). **Fix:** bind `--host 0.0.0.0` so a phone on the same Wi-Fi can reach `http://<PC-IP>:8000` (this PC: `192.168.0.164`). If the phone still can't connect, allow Python through Windows Firewall (Private networks).
- **QR pointed at localhost.** The QR was built from `window.location.origin`; if the desktop opened the app via `localhost`, the QR sent the phone to *itself*. **Fix:** the backend now resolves its LAN IP (`scan_relay.lan_ip()`) and returns a `phone_url` (`routers/scan_sessions.py` create), which the desktop QR uses; a localhost fallback shows a visible warning to open the app via the PC's IP.
- **Phone camera blocked over http.** Mobile browsers block `getUserMedia` outside a secure context, so over plain `http://<LAN-IP>` the camera never starts. **Fix:** `ScanReceiver.jsx` detects the insecure context and shows a clear "HTTPS required" note instead of a confusing permission error, and steers the user to **manual JAN entry, which works over http**. For the camera on the phone, serve the app over **HTTPS** (e.g. a tunnel or TLS in front of uvicorn).

Net: the phone can now reach the app and complete the flow via manual entry over http immediately; the phone **camera** still requires HTTPS.

## Multi-scan extension (2026-06-08)

Per Nafis: pair once, scan many products, show history, open a new tab per product. Implemented as:

- **Relay → queue.** `scan_relay.py`: session now holds a list of `_ScanItem{seq,jan,scanned_at}`; `submit_scan` appends (returns `(session,item)`, suppresses an immediate same-JAN duplicate within 3s); `get_session` refreshes a **sliding TTL** (polling/scanning keeps a long session alive); new `items_since(sess, since)` cursor helper. `routers/scan_sessions.py`: `GET /scan-sessions/{token}?since=<seq>` returns only newer items + `latest_seq`; `POST .../scan` returns `{seq,count}`. Schemas updated (`ScanItem`, list-based status).
- **Phone → continuous + history.** `BarcodeScanner` gained a `continuous` prop (no permanent latch; global cooldown + same-code debounce). `ScanReceiver.jsx` rewritten: stays on the scanner after each scan, POSTs each valid JAN, shows a transient confirm + an on-page **history** list; manual entry stays and clears after submit; insecure-context still routes to manual entry.
- **Desktop → session hub + tabs.** `PhonePairModal` replaced by `PhoneScanSession` (`ProductCreate.jsx`): polls with a cursor, dedupes by JAN, and for each new product opens a new browser tab `#/products/new?jan=…&autoscan=1`; pop-up-blocked items fall back to a one-click 「開く」 button; shows a received-products **history** with status. `ProductCreate` mount effect now reads `?jan=` from the URL and auto-opens the AI modal seeded (reuses the existing seed→auto-lookup). `api.getScanSession(token, since)` carries the cursor.

Auto-run lookup per scan = each opened tab runs one OpenAI lookup (as chosen). Tested: relay queue + cursor via TestClient (only-new-items, dup-suppression, 422/expired); all changed JSX transforms clean. Camera capture/tab-open still browser-only (manual steps in the test report).

## CURRENT STATE (one line)
Option 2 desktop⟷phone relay scanner is built and automated-tested (logic + HTTP + JSX + JAN validation); camera capture is browser-only (manual steps given); unpushed and pending Fukunaga sign-off.

## git diff --stat
`git diff --stat fix/category-vendor-mapping..feature/barcode-scan`:
```
 backend/app/main.py                     |   2 +
 backend/app/routers/scan_sessions.py    |  68 ++++++++++
 backend/app/schemas/scan_session.py     |  31 +++++
 backend/app/services/scan_relay.py      | 132 +++++++++++++++++++
 docs/audits/barcode_scan_after.md       |  57 ++++++++
 docs/audits/barcode_scan_plan.md        |  83 ++++++++++++
 docs/audits/barcode_scan_test_report.md |  97 ++++++++++++++
 frontend/app.jsx                        |   8 ++
 frontend/index.html                     |  13 ++
 frontend/lib/api.js                     |   9 ++
 frontend/lib/hooks.js                   |   4 +
 frontend/lib/jan.js                     |  56 ++++++++
 frontend/pages/ProductCreate.jsx        | 222 +++++++++++++++++++++++++++++++-
 frontend/pages/ScanReceiver.jsx         | 172 +++++++++++++++++++++++++
 14 files changed, 948 insertions(+), 6 deletions(-)
```
(includes the earlier plan-doc commit on this branch.) **Not pushed.**
