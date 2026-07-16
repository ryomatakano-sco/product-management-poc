# Implementation Prompt — Accessibility + Design-System Remediation (frontend)

> Paste this to a coding agent working inside `product-management-poc`. It fixes every
> issue from the design audit (WCAG 2.1 AA, design-system consistency) and defines the
> one research task that isn't code. Do the work in the phase order given — Phase 0 is the
> leverage point that makes most later fixes one-line changes.

---

## Role & context

You are working on the **paylight X 商品管理 PoC** frontend: a **no-build React 18** app
(CDN + Babel-in-browser, `.jsx` hot-reload, hash routing). There is **no bundler, no npm
install, no TypeScript**. Components export via `window.X = X`. Theming is a **live-mutable
token object** `T` (see `frontend/lib/theme.js`) that `theme_runtime.js` rewrites in place
when the user toggles light/dark; every component reads `T.PLX_*` at render, so the UI
recolors on the next render. The target user is **Japanese clinic counter-staff** doing
high-volume product registration — keyboard speed and clear feedback matter.

The app is bilingual: UI copy is Japanese, code comments English. Keep that. Match the
existing code style (inline style objects, functional components, `React.useState`).

### Hard constraints (do not violate)
- **No build step.** Do not add Vite/webpack/TS/JSX-precompile. Keep Babel-in-browser.
- **No new runtime dependencies.** Everything must work from the existing CDN setup.
- **Dark-mode parity is mandatory.** Every color you touch must come from `T.PLX_*` (or a
  token you add to *both* `_LIGHT` and `_DARK` in `theme.js`). Never hardcode a hex in a
  component — that's one of the bugs you're fixing.
- **Do not push commits.** Work on a branch; stop at a clean, reviewable diff. (Standing
  repo rule: nothing gets pushed without the PM's explicit OK.)
- **Behavior-preserving.** These are a11y/consistency fixes, not a redesign. Same layout,
  same flows, same visuals in light mode — just accessible and token-clean underneath.
- Keep changes reviewable: small, well-commented, one concern per commit.

---

## Phase 0 — Foundation (do this first; it unlocks everything else)

Almost every accessibility failure traces back to two shared layers. Fix them once.

### 0.1 Reconcile the token system (single source of truth)
`frontend/lib/theme.js` defines the **current navy brand** (`PLX_GREEN_600 = #003A77`), but
`frontend/index.html`'s `:root` still defines the **old teal brand**
(`--color-primary: #1AA68A`). Two palettes, one product.

- Delete the stale brand CSS custom properties from `index.html`'s `:root`, **or** rewrite
  them to read the current palette. The boot-splash (pre-React) is the only legitimate user;
  give it the correct navy values so there's no teal flash.
- Grep the codebase for `var(--color-` and `#1AA68A` / `#0E8A72` / `2EA7E0` and eliminate
  any remaining uses of the old teal tokens.

### 0.2 Rename the misleading color ladder
`PLX_GREEN_*` tokens hold **navy** hex values — "green" means navy, which is a latent bug.
- Introduce brand-neutral names: `PLX_BRAND_900…050` (same hex as today's `PLX_GREEN_*`).
- Keep `PLX_GREEN_*` as **aliases** to the new names for one transition period (don't break
  every page at once), but update `_LEGACY_TO_TOKEN` and add a comment marking them deprecated.
- Add both `_LIGHT` and `_DARK` entries for every new key (theme.js already warns that the
  palettes must stay key-synced — respect that).

### 0.3 Add a focus token + a11y primitives to the token layer
Add to **both** palettes in `theme.js`:
- `PLX_FOCUS_RING` — a high-contrast focus color (e.g. light: `#0D99FF`, dark: `#3FB1FF`).
- A reusable focus style string/object, e.g. `FOCUS_OUTLINE = "2px solid " + T.PLX_FOCUS_RING`
  with `outlineOffset: 2`, exposed for components to spread.

### 0.4 Turn `Atoms.jsx` style-objects into real, accessible components
`frontend/components/Atoms.jsx` currently exports **style objects** (`btnPrimary`,
`btnSecondary`, `btnGhost`, `formInput`) with `outline:"none"` and no shared states. This is
the root cause of the keyboard/focus failures. Convert them into components that own their
interaction states:

- **`<Button variant="primary|secondary|ghost" disabled loading onClick>`** — renders a real
  `<button type="button">`, applies `:focus-visible` ring (use `onFocus`/`onBlur` + a
  `focusVisible` state, or inject a small global stylesheet once — see 0.5), has visible
  `disabled` and `loading` states, and never removes the outline without replacing it.
- **`<TextInput id label hint error required ...>`** and update **`FormRow`** so the label is
  **programmatically associated** with the control: `<label htmlFor={id}>` + `id` on the input,
  `aria-invalid` when `error`, and `aria-describedby` pointing at the hint/error node ids.
  Generate a stable id if one isn't passed (`React.useId` isn't available pre-18.3 in this
  setup — use a module counter or `useMemo(() => "fld-" + (++n))`).
- Keep the existing `btn*`/`formInput` exports as thin wrappers/aliases so unconverted pages
  still render, but migrate pages in Phase 2.

### 0.5 One global focus stylesheet (allowed exception to "no hardcoded color")
Because inline styles can't express `:focus-visible`, inject a single `<style>` (in
`index.html` or a tiny runtime helper) with:
```css
:focus-visible { outline: 2px solid var(--plx-focus); outline-offset: 2px; }
```
and set `--plx-focus` from the token in `theme_runtime.js` so it flips with dark mode. This is
the sanctioned place for the focus ring; everything else stays token-driven in JS.

---

## Phase 1 — Critical accessibility fixes (blocks real users)

### 1.1 Visible focus (WCAG 2.4.7)
- Remove reliance on `outline:"none"` everywhere (Atoms `formInput`, `Login.jsx:28`,
  `CommandPalette.jsx:167`, `ProductCreate.jsx` ~716/1295/1317, `PurchaseOrders.jsx` ×5,
  `ScanReceiver.jsx`, `SalesRecords.jsx:973`, `AiArena.jsx`). Where `outline:none` must stay
  for aesthetics, the global `:focus-visible` rule from 0.5 must still produce a visible ring.
- **Acceptance:** tabbing through every page shows a clearly visible focus indicator on every
  interactive element, in both light and dark mode.

### 1.2 Keyboard-operable controls (WCAG 2.1.1)
There are 32 interactive `<div>/<span onClick>` with **no `tabIndex`** and mostly no key
handler. Fix each so it's reachable and operable:
- **Clickable rows / cards → real semantics.** Product rows (`Dashboard.jsx:419/761`,
  `Inventory.jsx:213/554`), KPI cards (`Dashboard.jsx:335`, `Inventory.jsx:595`): make the
  primary target a `<button>`/`<a href="#/products/:id">`, or add `role="button"`,
  `tabIndex={0}`, and an `onKeyDown` that fires on `Enter`/`Space`.
- **`PlxSortHeader` (Atoms):** it's a `<span onClick>` — convert to a `<button>` inside the
  `<th>`, add `aria-sort` (`"ascending"|"descending"|"none"`) reflecting current sort.
- **Modal backdrops** (the `<div onClick={onClose}>` overlays in CommandPalette, AiArena,
  Tutorial, ProductCreate, Categories): backdrop click-to-close is fine to keep, but it must
  **not** be the only way to dismiss — Escape must also close (see 1.3), and the backdrop
  itself should be `aria-hidden` so it isn't a tab stop.
- **Acceptance:** every action reachable by mouse is reachable and triggerable by keyboard
  alone; no `onClick` on a non-focusable element without a keyboard equivalent.

### 1.3 Dialog semantics + focus management (WCAG 4.1.2, 2.4.3)
Only `DevPanel` has `role="dialog"`. Apply the same pattern to **CommandPalette, Tutorial,
AiArena, the ProductCreate AI-assist modal, and the Categories modal**:
- Container: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the modal
  title (add an id to the heading).
- **Focus trap:** on open, move focus into the dialog (CommandPalette already autofocuses its
  input — good); keep Tab/Shift-Tab cycling **within** the dialog; on close, **restore focus**
  to the element that opened it.
- **Escape closes** every dialog (CommandPalette + Tutorial already do — extend to AiArena,
  ProductCreate modal, Categories modal).
- Consider a tiny shared `useDialog(ref, { onClose })` hook so all five share one correct
  implementation instead of five copies.
- **Acceptance:** opening any modal traps focus, Escape closes it, focus returns to the
  trigger, and a screen reader announces it as a dialog with its title.

---

## Phase 2 — Major accessibility fixes

### 2.1 Announce status messages (WCAG 4.1.3)
`components/Toast.jsx` is the app's primary feedback channel (register success, delete
failure) but has **no live region**. Give `ToastContainer` a persistent
`role="status" aria-live="polite"` region (use `aria-live="assertive"` / `role="alert"` for
the `error` variant). The region must exist in the DOM **before** messages arrive so SRs pick
up insertions.

### 2.2 Active nav state (WCAG 4.1.2)
`AdminShell.jsx` marks the active sidebar item by background color only. Add
`aria-current="page"` to the active nav link. Wrap the sidebar in a `<nav aria-label="メイン">`
if it isn't already a landmark, and confirm `<main>` (present at `AdminShell.jsx:19`) is the
only main landmark.

### 2.3 Contrast fixes (WCAG 1.4.3, 1.4.11) — token-level, fixes everywhere at once
Computed failures:
- `PLX_INK_400 #999999` on white = **2.85:1** (used for hints, placeholders, archive) → darken
  to ≥ `#767676` (≈4.5:1). Update in `_LIGHT`; verify the dark-mode counterpart also passes.
- Archive `StatusPill` (#999999 on `#F3F4F6`) = **2.59:1** → use the corrected ink token and a
  tokenized background (see 3.2), re-check ≥ 4.5:1.
- Amber signal `PLX_AMBER_600 #F9C22C` ≈ **1.49:1** as an indicator → darken the *indicator*
  amber (or pair the amber dot/label with an icon + text so color isn't the sole signal).
- Red `#DC2626` passes at 4.83:1 but is thin — leave, or nudge slightly darker.
- **Acceptance:** every text/background pair ≥ 4.5:1 (normal) / 3:1 (large & UI), verified with
  the contrast script in `Verification` below, in **both** modes.

### 2.4 Image alt text (WCAG 1.1.1)
Content images currently pass `alt=""` (`ProductCreate.jsx:773/786`, `ProductDetail.jsx:896`,
and `ProductThumb` default). Pass the product name as `alt` for meaningful product images;
keep `alt=""` only for genuinely decorative ones. `ProductDetail.jsx:132` already does this
(`alt={p.name}`) — match it.

---

## Phase 3 — Design-system consistency

### 3.1 Kill hardcoded hex in components
Grep components for literal hex (`Atoms.jsx` alone has `#DC2626`, `#F3F4F6`, `#FEF3C7`,
`#FDE68A`, `#B45309`, `#fff`). Every one must become a `T.PLX_*` token (adding the token to
both palettes if it doesn't exist). Rationale: hardcoded colors silently **do not flip** in
dark mode — e.g. `StatusPill`'s `#F3F4F6` and the required-`*` red stay light-mode colors on a
dark surface today.
- **Acceptance:** `grep -rInE "#[0-9a-fA-F]{3,6}" frontend/components frontend/pages` returns
  only the boot-splash in `index.html` and the focus stylesheet — no other literal colors.

### 3.2 Tokenize the neutral surface used by pills
Add `PLX_PILL_BG` (light `#F2F3F5`-ish, dark equivalent) and use it for `StatusPill` draft/
archive backgrounds instead of the hardcoded `#F3F4F6`.

### 3.3 Enforce the radius scale
Tokens `RADIUS_SM/MD/LG` (6/8/12) and `RADIUS_PILL` (9999) exist but components use raw `9`
and `9999`. Replace raw radius literals with the tokens (inputs/buttons → a consistent
`RADIUS_MD` or a new `RADIUS_CTRL`; pills → `RADIUS_PILL`).

### 3.4 Consolidate button/input usage
After Phase 0.4, migrate pages that spread `btnPrimary`/`btnSecondary`/`btnGhost`/`formInput`
to the new `<Button>`/`<TextInput>` components so focus, disabled, and loading states are
consistent app-wide. Do this page-by-page (one commit per page) to keep the diff reviewable.

---

## Phase 4 — Research grounding (NOT code — plan + template)

There is no primary user-research artifact in the repo, and the product's core value (JAN
auto-fill) rests on an unmeasured ~50–70% recall assumption. Produce two lightweight
deliverables under `docs/research/`:
1. **`recall-validation-plan.md`** — a protocol to take a real clinic's product master
   (masked), run every JAN/title through the lookup, and report hit-rate + field-accuracy,
   broken out by B2C vs B2B consumables. This is the single study that validates or kills the
   core hypothesis.
2. **`no-result-usability-notes.md`** — a short script for testing the "lookup returned
   nothing" path with 3–4 clinic staff (the most frequent real moment, currently unhandled).

Do **not** start the JAN-DB pre-search layer or any Rakuten/Amazon API work — that needs PM
alignment and has ToS constraints. Flag it as a recommendation only.

---

## Verification (run before declaring done)

1. **Contrast:** run this against your final token values, both palettes:
   ```python
   def lin(c):
       c/=255; return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
   def L(h):
       h=h.lstrip('#'); r,g,b=(int(h[i:i+2],16) for i in (0,2,4))
       return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
   def ratio(a,b):
       la,lb=L(a),L(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
   ```
   Assert every text pair ≥ 4.5, every large/UI pair ≥ 3.0.
2. **Keyboard walk:** with the mouse unplugged (metaphorically), Tab through Dashboard →
   Products list → Product detail → Create (open AI modal) → CommandPalette (Ctrl+K) →
   Settings. Every control reachable, visible focus throughout, Enter/Space/Escape behave.
3. **Grep gates:**
   - `grep -rn "htmlFor" frontend` → > 0 (labels now associated).
   - `grep -rn "aria-live" frontend` → ≥ 1 (toasts).
   - `grep -rn "tabIndex" frontend` → > 0 on former div/span controls.
   - No literal hex outside the boot-splash + focus stylesheet.
4. **Dark mode:** toggle via the dev panel and re-check screens 2 and 1 — no light-mode color
   leaks (this catches any hardcode you missed).
5. **Regression:** confirm light-mode visuals are unchanged (this is a11y/token cleanup, not a
   redesign) and every existing flow (register a product, adjust inventory, record a sale)
   still works.

## Deliverable
- A branch (e.g. `fix/a11y-designsystem`) with commits grouped by phase.
- A short `docs/audits/a11y-fix-report.md`: before/after for each WCAG item, the contrast
  table (both modes), and the grep-gate results — MEASURED, not asserted.
- The two `docs/research/` planning docs from Phase 4.
- Do **not** push. Leave it review-ready and summarize what changed and what still needs PM
  alignment (JAN-DB layer, any scope questions).

## Suggested commit order
`0` foundation (theme reconcile + Atoms components + focus token) → `1.1` focus → `1.2`
keyboard → `1.3` dialogs → `2.1` toasts → `2.2` nav → `2.3` contrast → `2.4` alt → `3.x`
design-system cleanup, one page per commit → `4` research docs.
