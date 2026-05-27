// Minimal i18n — JA (default) ↔ EN, with the JA string as the lookup key.
//
// Design choice: components don't get refactored. They keep their inline
// Japanese strings, just wrapped in `t("商品一覧")`. When locale=ja the
// helper returns the input unchanged; when locale=en it looks up the
// English translation. Missing translations fall back to the JA input so
// nothing crashes if a string is added but not translated yet.
//
// Usage:
//   t("商品一覧")                  → "商品一覧" (ja) | "Products" (en)
//   t("商品を ${count} 件削除", {count: 3})
//                                  → "商品を 3 件削除" / "Delete 3 products"
//   PLX_I18N.get()                  → "ja" | "en"
//   PLX_I18N.set("en")              → switch + persist + re-render
//   PLX_I18N.toggle()               → flip
//   PLX_I18N.subscribe(fn)
//   usePlxLocale()                  → React hook; returns [locale, set]
//
// The translation table lives in lib/i18n_strings.js — separated so we
// can grow the dictionary without bloating this file.

(function () {
  const STORAGE_KEY = "sco.locale.v1";
  const VALID = new Set(["ja", "en"]);

  function _load() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (VALID.has(v)) return v;
    } catch { /* private mode etc. */ }
    return "ja";
  }
  function _save(loc) {
    try { localStorage.setItem(STORAGE_KEY, loc); }
    catch { /* swallow */ }
  }

  const subscribers = new Set();
  let current = _load();

  function get() { return current; }
  function set(loc) {
    if (!VALID.has(loc) || loc === current) return;
    current = loc;
    _save(loc);
    document.documentElement.setAttribute("lang", loc);
    for (const fn of subscribers) {
      try { fn(loc); } catch (e) { console.error("i18n subscriber error:", e); }
    }
  }
  function toggle() { set(current === "ja" ? "en" : "ja"); }
  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function _applyDocumentTitle(loc) {
    document.title = loc === "en"
      ? "SCO Product Management — paylight X"
      : "SCO 商品管理 — paylight X";
  }
  _applyDocumentTitle(current);
  subscribers.add(_applyDocumentTitle);

  // The translation table — Japanese key → English value. See
  // lib/i18n_strings.js; that file populates window._PLX_DICT_EN.
  // Looked up at every t() call so adding entries doesn't require a
  // reload of this module.
  function t(jaKey, vars) {
    if (jaKey == null) return "";
    let s;
    if (current === "en") {
      const dict = window._PLX_DICT_EN || {};
      s = dict[jaKey];
      if (s == null) s = jaKey;  // fallback: show the JA key so missing
                                 // translations are visible during dev
    } else {
      s = jaKey;
    }
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp("\\$\\{" + k + "\\}", "g"), String(v));
      }
    }
    return s;
  }

  // Initialize the <html lang="…"> attribute on first paint.
  if (document.documentElement) {
    document.documentElement.setAttribute("lang", current);
  }

  window.PLX_I18N = { get, set, toggle, subscribe };
  window.t = t;

  window.usePlxLocale = function usePlxLocale() {
    const [, setTick] = React.useState(0);
    React.useEffect(() => subscribe(() => setTick((n) => n + 1)), []);
    return [get(), set];
  };
})();
