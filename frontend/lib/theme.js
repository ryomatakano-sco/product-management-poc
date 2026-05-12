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

// Yoshioka 2026-05-11 — consumable expiry helpers
const PLX_RED = "#DC2626";
const PLX_RED_LIGHT = "#FEE2E2";
const PLX_BLUE_LIGHT = "#DBEAFE";

// Days from today until `expiryDateStr` (YYYY-MM-DD). Returns null if no date.
function daysUntil(expiryDateStr) {
  if (!expiryDateStr) return null;
  // Compare midnight-to-midnight so timezone wobble doesn't shift a day.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expiryDateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// Returns one of "red" | "amber" | "ok" | null based on days-to-expiry.
function expiryTone(days) {
  if (days == null) return null;
  if (days <= 30) return "red";
  if (days <= 60) return "amber";
  return "ok";
}

// YYYY-MM-DD -> YYYY年MM月DD日
function formatJpDate(dateStr) {
  if (!dateStr) return "—";
  // Accept either "YYYY-MM-DD" (ISO) or "YYYY/MM/DD"
  const parts = dateStr.split(/[-\/]/);
  if (parts.length !== 3) return dateStr;
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
}

Object.assign(window, {
  PLX_GREEN, PLX_GREEN_DARK, PLX_GREEN_LIGHT, PLX_GREEN_50,
  PLX_BLUE, PLX_BLUE_LIGHT, PLX_TEXT, PLX_MUTED, PLX_SUBTLE, PLX_BORDER, PLX_SURFACE,
  PLX_WARN, PLX_WARN_BG, PLX_RED, PLX_RED_LIGHT,
  available, formatYen, daysUntil, expiryTone, formatJpDate,
});
