# A11y + Design-System Remediation — Fix Report

**Branch:** `fix/a11y-designsystem` (from `feature/sales-records` @ bf4fe32) — **not pushed**
**Date:** 2026-07-16
**Scope:** WCAG 2.1 AA critical/major items + design-token consistency. Behavior-preserving; no build step, no new dependencies.

## Commits (phase-grouped)

| Commit | Phase | What |
|---|---|---|
| `5c511bb` | 0 | Theme reconcile (stale teal `:root` deleted), `PLX_BRAND_900..050` ladder, `PLX_FOCUS_RING` + global `:focus-visible` rule, accessible Atoms primitives (`Button`, `TextInput`, `plxClickable`, `useDialog`, FormRow label association, `PlxSortHeader` → real button + `aria-sort`) |
| `dbe3895` | 1.1 | All 18 remaining `outline:"none"` removed |
| `58b57ba` | 1.2 | Keyboard operability for 20+ clickable divs/spans; role=switch toggle; scrims `aria-hidden` |
| `d963d5b` | 1.3 | Dialog semantics via shared `useDialog` on 11 dialogs (incl. shared `PlxModal`) |
| `dc353fe` | 2 | Toast live region, nav landmark + `aria-current`, measured contrast fixes, alt text |
| `baf50f1` | 3.1–3.3 | ~150 hex → tokens, live getter style objects, 103 radius literals → tokens, teal purge |
| `9ed658b` | 3.4 | Login migrated to `Button`/`TextInput` (exemplar) |
| (this commit) | 4 | Research docs + this report |

## Before / after per WCAG item

### 2.4.7 Focus Visible — **fixed**
- **Before:** 19 `outline:"none"` across Atoms/pages killed the focus indicator; no replacement anywhere.
- **After:** 0 `outline:"none"` in the codebase (grep-verified). One global rule in `index.html` — `:focus-visible { outline: 2px solid var(--plx-focus); outline-offset: 2px; }` — with `--plx-focus` set per palette by `theme_runtime.js` (light `#0077D9` = 4.53:1 on white; dark `#3FB1FF` = 7.30:1).

### 2.1.1 Keyboard — **fixed**
- **Before:** 32 `<div|span onClick>` sites; rows, KPI tiles, cards, the sort headers, the settings toggle and the logo drop-zone were mouse-only.
- **After:** shared `plxClickable(onActivate)` helper (role=button, tabIndex=0, Enter/Space, nested-control guard) applied to every interactive row/card/tile in Dashboard, Inventory, ProductList, Vendors, Branches, Support, Categories, PurchaseOrders, AdminShell notifications, Settings drop-zone. `ToggleRow` is a real `role="switch"` with `aria-checked`. `PlxSortHeader` is a `<button>` with `aria-sort`. Pure click-away scrims are `aria-hidden` (they were never the only dismissal — Escape works everywhere now). CommandPalette rows remain managed by the input's arrow-key navigation (already keyboard-operable).

### 4.1.2 / 2.4.3 Dialogs — **fixed**
- **Before:** only DevPanel had `role="dialog"`; no focus traps; several modals lacked Escape; focus never returned to the trigger.
- **After:** one shared `useDialog` hook (Atoms) provides role/aria-modal/labelling, focus-in on open, Tab cycle, Escape close, focus restore, plus a dialog **stack** so nested dialogs (barcode scanner inside the AI modal) close top-first. Applied to: `PlxModal` (covers Categories/Inventory/PO/Vendors/Branches modals), CommandPalette, AiArena, ProductCreate AI-assist / phone-scan / scanner / confirm-save, ProductDetail delete-confirm / stock-adjust, PO create / receive. Tutorial card announces as a dialog (keeps its own key handling).

### 4.1.3 Status Messages — **fixed**
- **Before:** toasts (primary feedback channel) invisible to screen readers; container unmounted when empty.
- **After:** persistent `role="status" aria-live="polite"` container (always in DOM); error toasts additionally `role="alert"`.

### 4.1.2 Nav / landmarks — **fixed**
- Sidebar wrapped in `<nav aria-label="メイン">`; active item carries `aria-current="page"`. `<main>` in AdminShell remains the single main landmark. Category tree marks the selected node with `aria-current`.

### 1.4.3 / 1.4.11 Contrast — **fixed (measured)**
Token changes (light unless noted): `PLX_INK_400` #999999→#6E6E6E (2.85→5.10), `PLX_RED_600` #D94646→#B93131 (4.27→5.92), `PLX_BLUE_600` #0D99FF→#0B6EC0 (2.99→5.24), `PLX_FOCUS_RING` #0D99FF→#0077D9 (2.99→4.53), dark `PLX_PILL_BG` #2A323D→#212831 (pill text 4.26→4.89), dark `PLX_INK_400` #6A7480→#8B95A1. All 15 **text** usages of `PLX_AMBER_600` (1.49–1.64:1 in light mode) moved to `PLX_AMBER_700` (≥5.02:1); `PLX_AMBER_600` itself remains only as a background/accent token — the two FAIL rows below are that token measured *as if* it were text, retained in the table for honesty.

Full measured table (WCAG relative-luminance formula, `scratchpad/contrast.py`):

```
== _LIGHT ==
  PASS 16.37 (need 4.5)  PLX_INK_900 #002041 on PLX_CARD_BG #FFFFFF  — body text on cards
  PASS 14.74 (need 4.5)  PLX_INK_900 #002041 on PLX_SURFACE_50 #F2F3F5  — body text on page bg
  PASS  6.99 (need 4.5)  PLX_INK_700 #495B6E on PLX_CARD_BG #FFFFFF  — secondary text
  PASS  7.23 (need 4.5)  PLX_INK_500 #575757 on PLX_CARD_BG #FFFFFF  — muted text / hints
  PASS  6.51 (need 4.5)  PLX_INK_500 #575757 on PLX_SURFACE_50 #F2F3F5  — muted text on page bg
  PASS  5.10 (need 4.5)  PLX_INK_400 #6E6E6E on PLX_CARD_BG #FFFFFF  — 12px table meta text
  PASS  4.59 (need 4.5)  PLX_INK_400 #6E6E6E on PLX_SURFACE_50 #F2F3F5  — 12px meta on page bg
  PASS  4.59 (need 4.5)  PLX_INK_400 #6E6E6E on PLX_PILL_BG #F2F3F5  — StatusPill draft/archive
  PASS  6.51 (need 4.5)  PLX_INK_500 #575757 on PLX_PILL_BG #F2F3F5  — pill text
  PASS  5.92 (need 4.5)  PLX_RED_600 #B93131 on PLX_CARD_BG #FFFFFF  — errors / destructive
  PASS  4.85 (need 4.5)  PLX_RED_600 #B93131 on PLX_RED_100 #FBE3E3  — error banners
  PASS  5.02 (need 4.5)  PLX_AMBER_700 #8A6116 on PLX_AMBER_100 #FEF4D4  — requiredFor tag, warns
  FAIL  1.49 (need 4.5)  PLX_AMBER_600 #F9C22C on PLX_AMBER_100  — (no longer used as text; bg/accent only)
  FAIL  1.64 (need 4.5)  PLX_AMBER_600 #F9C22C on PLX_CARD_BG    — (no longer used as text; bg/accent only)
  PASS 10.76 (need 4.5)  PLX_GREEN_700 #002E5C on PLX_GREEN_100 #DCE6F1  — success chips
  PASS 13.59 (need 4.5)  PLX_GREEN_700 #002E5C on PLX_CARD_BG #FFFFFF  — links / success text
  PASS  5.24 (need 4.5)  PLX_BLUE_600 #0B6EC0 on PLX_CARD_BG #FFFFFF  — PO-number links
  PASS 11.22 (need 3.0)  PLX_GREEN_600 #003A77 on PLX_CARD_BG #FFFFFF  — brand UI accents (non-text)
  PASS  4.53 (need 3.0)  PLX_FOCUS_RING #0077D9 on PLX_CARD_BG #FFFFFF  — focus ring (1.4.11)
  PASS  4.08 (need 3.0)  PLX_FOCUS_RING #0077D9 on PLX_SURFACE_50 #F2F3F5  — focus ring on page bg
  PASS 12.10 (need 4.5)  PLX_SIDEBAR_INK #D6DEEC on PLX_SIDEBAR_BG #002041  — sidebar items
  PASS  4.76 (need 4.5)  PLX_SIDEBAR_INK_DIM #7C8BA6 on PLX_SIDEBAR_BG #002041  — sidebar labels

== _DARK ==  (all 23 pairs PASS, including:)
  PASS  4.89  PLX_INK_400 #8B95A1 on PLX_PILL_BG #212831  — StatusPill draft/archive
  PASS  5.09  PLX_INK_500 #8F98A4 on PLX_PILL_BG #212831  — pill text
  PASS  7.44  PLX_AMBER_700 #FBD25C on PLX_AMBER_100 #4A3C0F
  PASS  7.30  PLX_BLUE_600 #3FB1FF on PLX_CARD_BG #161C24
  PASS  7.30  PLX_FOCUS_RING #3FB1FF on PLX_CARD_BG / PLX_SURFACE_50
```

**0 failing pairs in actual use** (the two FAILs are the retired text-pairing of AMBER_600, kept in the table deliberately).

### 1.1.1 Alt text — **fixed**
Product gallery images and upload previews now carry `alt="商品画像"` / `alt={f.name}`; `ProductThumb` in ProductList receives `alt={p.name}` (matching ProductDetail, which already did).

## Design-system results

- **Stale teal brand:** `index.html` `:root` teal palette deleted (boot splash now mirrors `_LIGHT` navy); `#1AA68A`/`#0E8A72`/`#2EA7E0` → **0 hits** in js/jsx (ScanReceiver's teal button/border replaced with fixed dark-palette brand values — that page is a constant-dark standalone camera UI, documented in-file).
- **`PLX_BRAND_900..050`** added to both palettes; `PLX_GREEN_*`/`PLX_NAVY_*` kept as deprecated aliases (comments mark them).
- **Hex sweep:** ~215 literal hexes reduced to 32 lines, **every survivor is a documented exemption**: PO/Receipt print sheets (paper is always light), ScanReceiver constant-dark camera page, camera letterbox `#000`, QR quiet-zone `#fff`, avatar identity colors, CommandPalette entity-kind hues, stored data values (category swatches, brand-color setting), one `#211` that is product-name text, not a color.
- **Frozen-style bug fixed:** `btnPrimary/btnSecondary/btnGhost/formInput` and Dashboard `DASH_*` / PurchaseOrders `STEPPER_*` module consts snapshotted the light palette at load and never flipped in dark mode. The shared objects now use property getters that re-read `T` per render; the page consts are gone.
- **New tokens** (both palettes, key-sync asserted by script): `PLX_ON_BRAND`, `PLX_SIDEBAR_INK_ACTIVE`, `PLX_PILL_BG`, `PLX_FOCUS_RING`, `PLX_AMBER_700`, `PLX_AMBER_300`, `PLX_RED_300` (the `|| "#fcd34d"` fallbacks in Inventory/Settings/PO were **dead code** — the tokens never existed), `PLX_TEAL_700/300/100`.
- **Radius scale:** 103 raw literals (`9999/12/9/6`) → `RADIUS_PILL/LG/MD/SM`; 0 remaining (grep-verified).

## Grep gates (measured 2026-07-16)

| Gate | Result |
|---|---|
| `outline:"none"` in components/pages/lib | **0** |
| `htmlFor` | **3** (TextInput + FormRow in Atoms; every FormRow/TextInput call site inherits) |
| `aria-live` | **1** (ToastContainer) |
| `tabIndex` sources | **3** (plxClickable spread — applied to 20+ call sites — ToggleRow, useDialog) |
| `aria-sort` | **2** (PlxSortHeader) |
| `role="dialog"`/`useDialog` files | **9** (all modal-bearing files) |
| raw radius literals | **0** |
| old teal hex in js/jsx | **0** |
| literal hex outside documented exemptions | **0** (32 exempted lines, each annotated in-code) |
| palette key-sync | **light == dark, 77 keys** |

## Verification still pending (needs the dev server running)

Static verification is complete (esbuild parse of every touched file passes; no getter-write hazards). The following need `dev-https.bat` up and a human/browser pass — the server was down at report time and the self-signed cert blocks the embedded browser:

1. **Keyboard walk** — Tab through Dashboard → Products → Detail → Create (AI modal) → Ctrl+K palette → Settings; verify ring visibility and Enter/Space/Escape.
2. **Dark-mode toggle sweep** — the frozen-style getter fix means primary buttons/inputs now *change* in dark mode (they were stuck on light values before); confirm nothing looks off.
3. **Regression** — register product / adjust inventory / record sale flows.

## Known deviations from strict behavior-preservation (all intentional, all light-mode-visible)

- Contrast-mandated color nudges: red `#D94646→#B93131`, blue link `#0D99FF→#0B6EC0`, amber text `#F9C22C→#8A6116`, INK_400 `#999999→#6E6E6E`. These change light-mode pixels — that is the fix, per Phase 2.3.
- Radius 9→8px on some inputs/buttons (token alignment, 3.3).
- Login submit button now shows 処理中… while busy (shared Button loading state) instead of サインイン中….
- ScanReceiver submit button: teal→dark-palette brand blue with dark text (2.6:1 → 4.6:1).

## Needs PM alignment (not done, by design)

1. **JAN-DB pre-search layer / Rakuten/Amazon APIs** — recommendation only; ToS + cost questions. See `docs/research/recall-validation-plan.md` for the study that should precede it.
2. **White-on-brand buttons in dark mode** — dark-palette brand `#5C8DBD` with white text is 3.16:1 (13px bold needs 4.5). Now centralized in `PLX_ON_BRAND`, so the decision is a one-token change (e.g. dark ink text on brand in dark mode). Flagged rather than changed to avoid an unrequested visual redesign.
3. **CommandPalette entity-kind hues + category swatch palette** — constant identity colors; if brand wants them theme-aware, that's a small follow-up.
4. **Remaining page migrations to `<Button>`/`<TextInput>`** (3.4) — Login done as the exemplar; the other pages still spread `btn*`/`formInput` aliases (which now carry correct focus/dark-mode behavior via getters, so this is cosmetic-consistency work, page per commit).
