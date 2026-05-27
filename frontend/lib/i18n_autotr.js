// Auto-translate JSX text children at render time.
//
// Why: the app has ~400 inline Japanese string literals across 20+ files.
// Wrapping each with t() by hand is days of work and high risk. Instead we
// hook React.createElement so that every render-time text child (string)
// that's recognised in the dictionary gets swapped for its English value
// when locale === "en". Locale === "ja" is a no-op — same strings render
// as before.
//
// Caveats:
//   1. Only translates whole-string text children. A child like
//      `${count} 件` becomes "${count} 件" after template-literal
//      substitution → still gets looked up if the literal made it into
//      the dictionary with the same `${count}` placeholder; otherwise
//      stays JA. To translate dynamic strings, components should call
//      `t()` explicitly with `{vars}`.
//   2. Strings inside `title={…}`, `placeholder={…}`, `aria-label={…}`
//      and `alt={…}` props are also translated (see _PROP_KEYS).
//   3. Strings inside `style`, `href`, `src`, etc. are NOT translated.
//   4. Translation is locale-pinned — every render re-evaluates t() so
//      a locale flip re-renders the whole tree (via the i18n subscribe
//      hook in the root component).

(function () {
  if (!window.React || window.React.__plxI18nPatched) return;

  const _origCreateElement = React.createElement;
  const t = window.t;
  if (typeof t !== "function") return;

  // Props whose string value should be translated through t().
  const _PROP_KEYS = new Set(["title", "placeholder", "aria-label", "alt"]);

  function _trChild(node) {
    if (typeof node === "string") {
      // Only translate when the string actually exists in the dictionary
      // OR when locale=ja (in which case t() is a no-op anyway). This
      // avoids the cost of t() on every short ASCII/symbol string.
      const dict = window._PLX_DICT_EN || {};
      const locale = window.PLX_I18N?.get?.() || "ja";
      if (locale === "en" && (node in dict)) {
        return dict[node];
      }
      // Also translate when JA chars are present even if not in dict,
      // because t() falls back to the JA key — so this is a no-op.
      return node;
    }
    return node;
  }

  function _trProps(props) {
    if (!props) return props;
    let out = null;
    for (const k of _PROP_KEYS) {
      const v = props[k];
      if (typeof v === "string") {
        const dict = window._PLX_DICT_EN || {};
        const locale = window.PLX_I18N?.get?.() || "ja";
        if (locale === "en" && (v in dict)) {
          if (!out) out = { ...props };
          out[k] = dict[v];
        }
      }
    }
    return out || props;
  }

  React.createElement = function patchedCreateElement(type, props, ...children) {
    const newProps = _trProps(props);
    if (children.length === 0) {
      return _origCreateElement(type, newProps);
    }
    const newChildren = children.map(_trChild);
    return _origCreateElement(type, newProps, ...newChildren);
  };
  React.__plxI18nPatched = true;
})();
