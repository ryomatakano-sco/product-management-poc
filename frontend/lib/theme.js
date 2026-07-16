// paylight X 商品管理 PoC — design tokens
// Refreshed 2026-05-26 to support live light/dark mode switching.
//
// `T` is a *live mutable* token object. The values inside `T` get rewritten
// when the user toggles dark mode via PLX_THEME.set("dark"|"light"). Because
// every component reads `T.PLX_GREEN_600` on each render, the entire UI
// recolors as soon as a re-render is triggered.
//
// The legacy `PLX_GREEN`, `PLX_TEXT`, etc. names also exist on window, but
// they're defined as **getters** so they always reflect the current palette
// — no per-component edits needed for dark-mode support.

// ─────────────────────────────────────────────────────────────────────
// Light palette (default — paylight X navy on white).
// Keep both palettes' keys in sync — if you add a key here, add it to
// _DARK below too, otherwise toggling dark mode leaves that key undefined.
// ─────────────────────────────────────────────────────────────────────
const _LIGHT = {
  // ── Brand ladder (canonical, color-neutral names — a11y remediation
  //    2026-07-15). PLX_NAVY_* and PLX_GREEN_* below are DEPRECATED aliases
  //    kept for the transition; new code must use PLX_BRAND_*. "GREEN"
  //    holding navy hex was a latent bug waiting for the next rebrand.
  PLX_BRAND_900: "#002041",
  PLX_BRAND_800: "#002E5C",
  PLX_BRAND_700: "#003A77",  // primary brand
  PLX_BRAND_600: "#0E509A",
  PLX_BRAND_500: "#3A77BF",
  PLX_BRAND_300: "#94B3D3",
  PLX_BRAND_100: "#DCE6F1",
  PLX_BRAND_050: "#EEF3F9",
  // DEPRECATED — aliases of PLX_BRAND_* (same hex). Migrate then remove.
  PLX_NAVY_900: "#002041",
  PLX_NAVY_800: "#002E5C",
  PLX_NAVY_700: "#003A77",
  PLX_NAVY_600: "#0E509A",
  PLX_NAVY_500: "#3A77BF",
  PLX_NAVY_300: "#94B3D3",
  PLX_NAVY_100: "#DCE6F1",
  PLX_NAVY_050: "#EEF3F9",
  PLX_GREEN_700: "#002E5C",
  PLX_GREEN_600: "#003A77",
  PLX_GREEN_500: "#0E509A",
  PLX_GREEN_300: "#94B3D3",
  PLX_GREEN_100: "#DCE6F1",
  PLX_GREEN_050: "#EEF3F9",
  PLX_OLIVE_700: "#8E9636",
  PLX_OLIVE_600: "#B9C25B",
  PLX_OLIVE_500: "#C9D275",
  PLX_OLIVE_100: "#F2F5DA",
  PLX_BLUE_600:   "#0D99FF",
  PLX_BLUE_100:   "#E0F1FF",
  PLX_AMBER_600:  "#F9C22C",
  PLX_AMBER_100:  "#FEF4D4",
  PLX_RED_600:    "#D94646",
  PLX_RED_100:    "#FBE3E3",
  PLX_PURPLE_600: "#9C56C0",
  PLX_PURPLE_100: "#F1E6F8",
  PLX_INK_900: "#002041",
  PLX_INK_700: "#495B6E",
  PLX_INK_500: "#575757",
  // #999999 was 2.85:1 on white (WCAG 1.4.3 fail for hints/placeholders);
  // #6E6E6E is 5.0:1 on white and 4.6:1 on PLX_PILL_BG.
  PLX_INK_400: "#6E6E6E",
  PLX_INK_300: "#C0C4CC",
  PLX_LINE_200:    "#DDDDDD",
  PLX_LINE_100:    "#E8EAEC",
  PLX_SURFACE_0:   "#FFFFFF",
  PLX_SURFACE_50:  "#F2F3F5",
  PLX_SURFACE_100: "#EEF3F9",
  // Card/modal/input fill — replaces hardcoded "#fff" backgrounds.
  // In light mode this IS white; in dark mode it's an elevated near-black.
  PLX_CARD_BG:     "#FFFFFF",
  PLX_INPUT_BG:    "#FFFFFF",
  PLX_KBD_BG:      "#FFFFFF",
  PLX_ON_BRAND:    "#FFFFFF",   // text/icon colour on the brand button
  PLX_SIDEBAR_BG:        "#002041",
  PLX_SIDEBAR_INK:       "#D6DEEC",
  PLX_SIDEBAR_INK_DIM:   "#7C8BA6",
  PLX_SIDEBAR_ACTIVE_BG: "#003A77",
  // ── a11y tokens (remediation 2026-07-15) ──
  PLX_FOCUS_RING: "#0D99FF",   // keyboard focus ring (≥3:1 on white)
  PLX_PILL_BG:    "#F2F3F5",   // neutral pill bg (replaces hardcoded #F3F4F6)
  // Amber readable as TEXT/indicator: #F9C22C was 1.49:1 on white. Signal
  // surfaces keep the bright amber via PLX_AMBER_100 backgrounds.
  PLX_AMBER_700:  "#8A6116",
  RADIUS_SM:   "6px",
  RADIUS_MD:   "8px",
  RADIUS_LG:   "12px",
  RADIUS_PILL: "999px",
  SHADOW_SM: "0 1px 2px rgba(15,27,45,0.04), 0 1px 1px rgba(15,27,45,0.03)",
  SHADOW_MD: "0 4px 12px rgba(15,27,45,0.06), 0 2px 4px rgba(15,27,45,0.04)",
  SHADOW_LG: "0 16px 32px rgba(15,27,45,0.10), 0 8px 16px rgba(15,27,45,0.06)",
  FONT:      '"Inter","Noto Sans JP",-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif',
  FONT_MONO: '"JetBrains Mono","SF Mono",ui-monospace,monospace',
  LOGO_HEADER: "https://x.pay-light.com/images/logo-header.png",
};

// ─────────────────────────────────────────────────────────────────────
// Dark palette — inverts surfaces (white → near-black), keeps brand
// accent (#0E509A blue) but lifts it slightly so it pops against the
// dark surface. Ink scale flips: dark ink (text) becomes near-white,
// surfaces become near-black. Sidebar stays roughly the same colour
// because it was already dark in light mode.
//
// Designed for AA contrast on the body text (PLX_INK_900 = #ECEEF1
// against PLX_SURFACE_0 = #0F1419 → contrast ~14.2:1).
// ─────────────────────────────────────────────────────────────────────
const _DARK = {
  // Brand ladder (canonical) — see _LIGHT for the deprecation note.
  PLX_BRAND_900: "#94B3D3",
  PLX_BRAND_800: "#7AA0CA",
  PLX_BRAND_700: "#5C8DBD",
  PLX_BRAND_600: "#3A77BF",
  PLX_BRAND_500: "#0E509A",
  PLX_BRAND_300: "#003A77",
  PLX_BRAND_100: "#002E5C",
  PLX_BRAND_050: "#002041",
  // DEPRECATED aliases — same hex as PLX_BRAND_*.
  PLX_NAVY_900: "#94B3D3",      // top of brand ladder lifts to mid-tone
  PLX_NAVY_800: "#7AA0CA",
  PLX_NAVY_700: "#5C8DBD",      // primary brand — lighter so it pops
  PLX_NAVY_600: "#3A77BF",
  PLX_NAVY_500: "#0E509A",
  PLX_NAVY_300: "#003A77",
  PLX_NAVY_100: "#002E5C",
  PLX_NAVY_050: "#002041",
  PLX_GREEN_700: "#7AA0CA",
  PLX_GREEN_600: "#5C8DBD",     // primary action button reads bright
  PLX_GREEN_500: "#3A77BF",
  PLX_GREEN_300: "#0E509A",
  PLX_GREEN_100: "#1B2D44",     // "light" backgrounds → dark blue tint
  PLX_GREEN_050: "#152538",
  PLX_OLIVE_700: "#C9D275",
  PLX_OLIVE_600: "#B9C25B",
  PLX_OLIVE_500: "#8E9636",
  PLX_OLIVE_100: "#3A4118",
  PLX_BLUE_600:   "#3FB1FF",
  PLX_BLUE_100:   "#0D3B5C",
  PLX_AMBER_600:  "#FBD25C",
  PLX_AMBER_100:  "#4A3C0F",
  PLX_RED_600:    "#FF6F6F",
  PLX_RED_100:    "#451818",
  PLX_PURPLE_600: "#C586DE",
  PLX_PURPLE_100: "#371F45",
  PLX_INK_900: "#ECEEF1",       // body text (was navy, now near-white)
  PLX_INK_700: "#B4BDC9",
  PLX_INK_500: "#8F98A4",
  // Lifted from #6A7480 (3.1:1 on #0F1419) → 4.7:1 for hint text.
  PLX_INK_400: "#8B95A1",
  PLX_INK_300: "#3F4853",
  PLX_LINE_200:    "#2A323D",   // borders darken
  PLX_LINE_100:    "#1F2630",
  PLX_SURFACE_0:   "#0F1419",   // page background → near-black
  PLX_SURFACE_50:  "#161C24",   // card backgrounds slightly lifted
  PLX_SURFACE_100: "#1F2630",
  // Dark equivalents for the new explicit tokens. Cards are slightly
  // lifted from the page background so they read as elevated surfaces.
  PLX_CARD_BG:     "#161C24",
  PLX_INPUT_BG:    "#1F2630",
  PLX_KBD_BG:      "#2A323D",
  PLX_ON_BRAND:    "#FFFFFF",
  PLX_SIDEBAR_BG:        "#0A0E13",
  PLX_SIDEBAR_INK:       "#D6DEEC",
  PLX_SIDEBAR_INK_DIM:   "#7C8BA6",
  PLX_SIDEBAR_ACTIVE_BG: "#1F2630",
  // a11y tokens (dark counterparts)
  PLX_FOCUS_RING: "#3FB1FF",
  PLX_PILL_BG:    "#2A323D",
  PLX_AMBER_700:  "#FBD25C",   // amber-as-text reads bright on dark
  RADIUS_SM:   _LIGHT.RADIUS_SM,
  RADIUS_MD:   _LIGHT.RADIUS_MD,
  RADIUS_LG:   _LIGHT.RADIUS_LG,
  RADIUS_PILL: _LIGHT.RADIUS_PILL,
  SHADOW_SM: "0 1px 2px rgba(0,0,0,0.5), 0 1px 1px rgba(0,0,0,0.4)",
  SHADOW_MD: "0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)",
  SHADOW_LG: "0 16px 32px rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.4)",
  FONT:      _LIGHT.FONT,
  FONT_MONO: _LIGHT.FONT_MONO,
  LOGO_HEADER: _LIGHT.LOGO_HEADER,
};

// `T` starts at the light palette. PLX_THEME (see lib/theme_runtime.js)
// mutates this object's keys in place when the user toggles modes — any
// component that reads `T.PLX_*` on render picks up the new value.
const T = { ..._LIGHT };

// Expose the palettes so theme_runtime.js can swap between them.
window._PLX_PALETTES = { light: _LIGHT, dark: _DARK };

// ─────────────────────────────────────────────────────────────────────
// Legacy aliases — `PLX_GREEN`, `PLX_TEXT`, etc. Defined as window
// getters so they always reflect the current palette. Components that
// destructure these at module scope (rare) will still hold the first
// value they saw; the safer pattern is to reference `window.PLX_GREEN`
// or just switch to `T.PLX_GREEN_600` directly. For our PoC the live
// getters are sufficient — at-render reads always hit the getter.
// ─────────────────────────────────────────────────────────────────────
// DEPRECATED map — these bare-window aliases (and the PLX_GREEN_*/PLX_NAVY_*
// ladders) are transition shims for the PLX_BRAND_* rename (2026-07-15).
// New code: use T.PLX_BRAND_* / T.PLX_INK_* directly.
const _LEGACY_TO_TOKEN = {
  PLX_GREEN:       "PLX_GREEN_600",
  PLX_GREEN_DARK:  "PLX_GREEN_700",
  PLX_GREEN_LIGHT: "PLX_GREEN_100",
  PLX_GREEN_50:    "PLX_GREEN_050",
  PLX_BLUE:        "PLX_BLUE_600",
  PLX_BLUE_LIGHT:  "PLX_BLUE_100",
  PLX_TEXT:        "PLX_INK_900",
  PLX_MUTED:       "PLX_INK_500",
  PLX_SUBTLE:      "PLX_INK_400",
  PLX_BORDER:      "PLX_LINE_200",
  PLX_SURFACE:     "PLX_SURFACE_50",
  PLX_WARN:        "PLX_AMBER_600",
  PLX_WARN_BG:     "PLX_AMBER_100",
  PLX_RED:         "PLX_RED_600",
  PLX_RED_LIGHT:   "PLX_RED_100",
};
for (const [legacy, tokenKey] of Object.entries(_LEGACY_TO_TOKEN)) {
  Object.defineProperty(window, legacy, {
    configurable: true,
    enumerable: true,
    get() { return T[tokenKey]; },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Helpers (unchanged from prior revision)
// ─────────────────────────────────────────────────────────────────────
function available(v) {
  return (v.on_hand || 0) - (v.committed || 0) - (v.unavailable || 0);
}

function formatYen(v) {
  if (v == null || v === "") return "0";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("ja-JP");
}

function daysUntil(expiryDateStr) {
  if (!expiryDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expiryDateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function expiryTone(days) {
  if (days == null) return null;
  if (days <= 30) return "red";
  if (days <= 60) return "amber";
  return "ok";
}

// YYYY-MM-DD → YYYY年MM月DD日 / YYYY-MM-DD depending on active locale.
// Reads window.PLX_I18N if available; else defaults to JA format.
function formatJpDate(dateStr) {
  if (!dateStr) return "—";
  const datePart = String(dateStr).split("T")[0];
  const parts = datePart.split(/[-\/]/);
  if (parts.length !== 3) return datePart;
  const locale = window.PLX_I18N?.get?.() || "ja";
  if (locale === "en") return `${parts[0]}-${parts[1]}-${parts[2]}`;
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
}

// YYYY-MM-DDTHH:MM(:SS) → adds a HH:MM time to formatJpDate's date part.
// Locale-aware; tolerant of naive and offset timestamps. (Was referenced by
// Support.jsx but never defined globally — crashed 系統ステータス.)
function formatJpDateTime(value) {
  if (!value) return "—";
  const datePart = formatJpDate(value);
  const s = String(value);
  const m = s.match(/[T ](\d{2}):(\d{2})/);
  if (!m) return datePart;
  return `${datePart} ${m[1]}:${m[2]}`;
}

const PLX_VERSION = { channel: "Alpha", number: "0.8.0" };

Object.assign(window, {
  T,
  PLX_VERSION,
  available, formatYen, daysUntil, expiryTone, formatJpDate, formatJpDateTime,
});
