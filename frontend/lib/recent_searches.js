// Recent searches — tiny localStorage helper used by the Ctrl+K command
// palette and the ProductList search input. Stores up to 8 entries per
// "scope" so a user can quickly re-run something they searched yesterday
// without retyping a JAN or product name.
//
// Scopes used today:
//   "global"   — Ctrl+K command palette
//   "products" — ProductList page search
//
// Anything new can use any string scope — no schema, just a key prefix.

const _PLX_RECENT_KEY = "sco.recentSearches.v1";
const _PLX_RECENT_MAX = 8;

function _readAll() {
  try {
    const raw = localStorage.getItem(_PLX_RECENT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // Storage disabled (private browsing) or value corrupted — pretend empty.
    return {};
  }
}

function _writeAll(state) {
  try {
    localStorage.setItem(_PLX_RECENT_KEY, JSON.stringify(state));
  } catch {
    // Out of quota, or storage disabled. Silently skip — recent searches
    // are an enhancement, not critical state.
  }
}

// listRecentSearches(scope) → string[] (most recent first, up to _PLX_RECENT_MAX)
function listRecentSearches(scope) {
  if (!scope) return [];
  const all = _readAll();
  const list = all[scope];
  return Array.isArray(list) ? list.slice(0, _PLX_RECENT_MAX) : [];
}

// rememberSearch(scope, q) — dedupes (moves to top if already present),
// trims to _PLX_RECENT_MAX, ignores blank/very-short queries.
function rememberSearch(scope, q) {
  if (!scope) return;
  const trimmed = typeof q === "string" ? q.trim() : "";
  if (trimmed.length < 2) return;  // skip 1-character noise
  const all = _readAll();
  const list = Array.isArray(all[scope]) ? all[scope] : [];
  const filtered = list.filter((x) => x !== trimmed);
  filtered.unshift(trimmed);
  all[scope] = filtered.slice(0, _PLX_RECENT_MAX);
  _writeAll(all);
}

// clearRecentSearches(scope) — drop the scope (used by "履歴を消去" link).
function clearRecentSearches(scope) {
  if (!scope) return;
  const all = _readAll();
  delete all[scope];
  _writeAll(all);
}

Object.assign(window, {
  listRecentSearches,
  rememberSearch,
  clearRecentSearches,
});
