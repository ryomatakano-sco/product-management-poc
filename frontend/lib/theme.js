// Color constants used by inline styles. Plain JS — runs through Babel-in-browser.
// All names attach to `window` so other files can read them without imports.

const PLX_GREEN = "#1AA68A";
const PLX_GREEN_DARK = "#0E8A72";
const PLX_GREEN_LIGHT = "#E6F7F2";
const PLX_GREEN_50 = "#F4FBF8";
const PLX_BLUE = "#2EA7E0";
const PLX_TEXT = "#1F2937";
const PLX_MUTED = "#6B7280";
const PLX_SUBTLE = "#9CA3AF";
const PLX_BORDER = "#E5E7EB";
const PLX_SURFACE = "#F8FAF9";
const PLX_WARN = "#D97706";
const PLX_WARN_BG = "#FEF3C7";

function available(v) {
  return (v.on_hand || 0) - (v.committed || 0) - (v.unavailable || 0);
}

function formatYen(v) {
  if (v == null || v === "") return "0";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("ja-JP");
}

Object.assign(window, {
  PLX_GREEN, PLX_GREEN_DARK, PLX_GREEN_LIGHT, PLX_GREEN_50,
  PLX_BLUE, PLX_TEXT, PLX_MUTED, PLX_SUBTLE, PLX_BORDER, PLX_SURFACE,
  PLX_WARN, PLX_WARN_BG,
  available, formatYen,
});
