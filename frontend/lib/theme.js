// paylight X 商品管理 PoC — design tokens
// Refreshed 2026-05-12 from the compass design brief (§2 + §7).
// All names attach to `window` so other files can read them without imports.

// ─────────────────────────────────────────────────────────────────────
// paylight X token block (T.*) — canonical names per design brief §7.
// Prefer these in new code. The legacy PLX_* aliases below are kept so
// older components keep working during the refresh.
// ─────────────────────────────────────────────────────────────────────
const T = {
  // Brand navy (paylight X live tokens). Drawn from the 2026-05-18 design
  // handoff at /v1/design/h/b3H9DW31uvRwnd-2QmdYZw — see project/tokens.jsx.
  // Naming preserved so legacy components ("PLX_GREEN_*") keep working;
  // the values are pure paylight-X navy now.
  PLX_NAVY_900: "#002041",
  PLX_NAVY_800: "#002E5C",
  PLX_NAVY_700: "#003A77",  // primary brand
  PLX_NAVY_600: "#0E509A",
  PLX_NAVY_500: "#3A77BF",
  PLX_NAVY_300: "#94B3D3",
  PLX_NAVY_100: "#DCE6F1",
  PLX_NAVY_050: "#EEF3F9",
  // Aliased so existing components recolor without per-file edits.
  PLX_GREEN_700: "#002E5C",
  PLX_GREEN_600: "#003A77",
  PLX_GREEN_500: "#0E509A",
  PLX_GREEN_300: "#94B3D3",
  PLX_GREEN_100: "#DCE6F1",
  PLX_GREEN_050: "#EEF3F9",

  // Olive — per-user avatar accent (paylight X). Not a primary brand
  // color; reserved for the user avatar dot in the sidebar footer.
  PLX_OLIVE_700: "#8E9636",
  PLX_OLIVE_600: "#B9C25B",
  PLX_OLIVE_500: "#C9D275",
  PLX_OLIVE_100: "#F2F5DA",

  // Semantic — paylight X live tokens (links / alerts / warnings).
  PLX_BLUE_600:   "#0D99FF",
  PLX_BLUE_100:   "#E0F1FF",
  PLX_AMBER_600:  "#F9C22C",
  PLX_AMBER_100:  "#FEF4D4",
  PLX_RED_600:    "#D94646",
  PLX_RED_100:    "#FBE3E3",
  PLX_PURPLE_600: "#9C56C0",
  PLX_PURPLE_100: "#F1E6F8",

  // Neutrals — ink #002041, mid #495B6E, body #575757, muted #999999.
  PLX_INK_900: "#002041",
  PLX_INK_700: "#495B6E",
  PLX_INK_500: "#575757",
  PLX_INK_400: "#999999",
  PLX_INK_300: "#C0C4CC",

  // Lines / surfaces — slightly warmer greys to match paylight X chrome.
  PLX_LINE_200:    "#DDDDDD",
  PLX_LINE_100:    "#E8EAEC",
  PLX_SURFACE_0:   "#FFFFFF",
  PLX_SURFACE_50:  "#F2F3F5",
  PLX_SURFACE_100: "#EEF3F9",

  // Sidebar (deepest navy — matches the paylight X chrome).
  PLX_SIDEBAR_BG:        "#002041",
  PLX_SIDEBAR_INK:       "#D6DEEC",
  PLX_SIDEBAR_INK_DIM:   "#7C8BA6",
  PLX_SIDEBAR_ACTIVE_BG: "#003A77",

  // Radii / shadows
  RADIUS_SM:   "6px",
  RADIUS_MD:   "8px",
  RADIUS_LG:   "12px",
  RADIUS_PILL: "999px",
  SHADOW_SM: "0 1px 2px rgba(15,27,45,0.04), 0 1px 1px rgba(15,27,45,0.03)",
  SHADOW_MD: "0 4px 12px rgba(15,27,45,0.06), 0 2px 4px rgba(15,27,45,0.04)",
  SHADOW_LG: "0 16px 32px rgba(15,27,45,0.10), 0 8px 16px rgba(15,27,45,0.06)",

  // Type
  FONT:      '"Inter","Noto Sans JP",-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif',
  FONT_MONO: '"JetBrains Mono","SF Mono",ui-monospace,monospace',

  // Brand assets
  LOGO_HEADER: "https://x.pay-light.com/images/logo-header.png",
};

// ─────────────────────────────────────────────────────────────────────
// Legacy aliases — what the original ProductList/Detail/Create/Dashboard
// pages still reference. Mapping these to the new token values means
// existing components automatically pick up the paylight X palette
// (calm green primary, ink-scale neutrals, dark-green sidebar) without
// touching every file. New pages should reference `T.*` directly.
// ─────────────────────────────────────────────────────────────────────
const PLX_GREEN       = T.PLX_GREEN_600;
const PLX_GREEN_DARK  = T.PLX_GREEN_700;
const PLX_GREEN_LIGHT = T.PLX_GREEN_100;
const PLX_GREEN_50    = T.PLX_GREEN_050;
const PLX_BLUE        = T.PLX_BLUE_600;
const PLX_BLUE_LIGHT  = T.PLX_BLUE_100;
const PLX_TEXT        = T.PLX_INK_900;
const PLX_MUTED       = T.PLX_INK_500;
const PLX_SUBTLE      = T.PLX_INK_400;
const PLX_BORDER      = T.PLX_LINE_200;
const PLX_SURFACE     = T.PLX_SURFACE_50;
const PLX_WARN        = T.PLX_AMBER_600;
const PLX_WARN_BG     = T.PLX_AMBER_100;
const PLX_RED         = T.PLX_RED_600;
const PLX_RED_LIGHT   = T.PLX_RED_100;

// ─────────────────────────────────────────────────────────────────────
// Helpers (unchanged from the prior revision)
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

// Days from today until `expiryDateStr` (YYYY-MM-DD). Returns null if no date.
function daysUntil(expiryDateStr) {
  if (!expiryDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expiryDateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// "red" | "amber" | "ok" | null
function expiryTone(days) {
  if (days == null) return null;
  if (days <= 30) return "red";
  if (days <= 60) return "amber";
  return "ok";
}

// YYYY-MM-DD -> YYYY年MM月DD日
function formatJpDate(dateStr) {
  if (!dateStr) return "—";
  const parts = String(dateStr).split(/[-\/]/);
  if (parts.length !== 3) return dateStr;
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
}

// Single source of truth for the version badge shown in the sidebar footer.
// Bump the number on every meaningful change; keep the channel ("Alpha") until
// we cut a beta — the demo is pre-release.
const PLX_VERSION = { channel: "Alpha", number: "0.6.0" };

Object.assign(window, {
  T,
  PLX_VERSION,
  // Legacy aliases
  PLX_GREEN, PLX_GREEN_DARK, PLX_GREEN_LIGHT, PLX_GREEN_50,
  PLX_BLUE, PLX_BLUE_LIGHT, PLX_TEXT, PLX_MUTED, PLX_SUBTLE, PLX_BORDER, PLX_SURFACE,
  PLX_WARN, PLX_WARN_BG, PLX_RED, PLX_RED_LIGHT,
  // Helpers
  available, formatYen, daysUntil, expiryTone, formatJpDate,
});
