// Auto-translate JSX text children at render time.
//
// Why: the app has ~400 inline Japanese string literals across 20+ files.
// Wrapping each with t() by hand is days of work and high risk. Instead we
// hook React.createElement so that every render-time text child (string)
// that's recognised in the dictionary gets swapped for its English value
// when locale === "en". Locale === "ja" is a no-op — same strings render
// as before.
//
// Matching strategy, in order:
//   1. Exact match against dictionary key
//   2. Trimmed match — JSX text children often carry leading/trailing
//      whitespace from source indentation
//   3. Template-pattern match — dictionary keys like
//        "全 ${kpis.total} 件の発注書"
//      can match runtime-produced strings like "全 12 件の発注書" by
//      replacing each ${...} with a capture group. The English template
//      gets the captures substituted back in.
//
// Caveats:
//   - Strings inside title/placeholder/aria-label/alt props are also
//     translated (see _PROP_KEYS).
//   - Strings inside style, href, src, etc. are NOT translated.
//   - Translation is locale-pinned — every render re-evaluates so a locale
//     flip re-renders the whole tree (via the i18n subscribe hook at root).

(function () {
  if (!window.React || window.React.__plxI18nPatched) return;

  const _origCreateElement = React.createElement;
  const t = window.t;
  if (typeof t !== "function") return;

  const _PROP_KEYS = new Set(["title", "placeholder", "aria-label", "alt"]);
  const _WS_WRAP = /^(\s*)([\s\S]*?)(\s*)$/;

  // ── Template-pattern cache ────────────────────────────────────────────
  // Built lazily from the dictionary. Each entry is:
  //   { re: RegExp, en: string, slots: ["${kpis.total}", …] }
  // where `re` is the JA key with each ${...} replaced by ([^]*?) and
  // anchored with ^…$. We try templates only after exact / trimmed match
  // fails, and we try them in deterministic order (longest key first) so
  // the most specific template wins ambiguous matches.
  let _templates = null;
  let _templatesDictRef = null;

  function _escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function _buildTemplates(dict) {
    const out = [];
    for (const ja of Object.keys(dict)) {
      // Only consider keys containing ${...}. Plain keys are handled by
      // the exact-match path.
      if (!ja.includes("${")) continue;
      const parts = ja.split(/\$\{[^}]+\}/);  // text between slots
      if (parts.length < 2) continue;
      const slots = ja.match(/\$\{[^}]+\}/g) || [];
      // Build a single regex: ^esc(part0) (.*?) esc(part1) (.*?) …$
      const re = new RegExp(
        "^" + parts.map(_escapeRe).join("([^]*?)") + "$",
      );
      // Specificity = length of the literal (non-slot) text. Sorting by raw
      // key length lets a generic key with a long slot name (e.g.
      // "${b.low_stock_threshold} 件") outrank a truly specific template.
      out.push({ re, en: dict[ja], slots, litLen: parts.join("").length });
    }
    out.sort((a, b) => b.litLen - a.litLen);
    return out;
  }

  function _getTemplates(dict) {
    // Invalidate cache if the dict object changes (e.g. hot reload).
    if (_templates !== null && _templatesDictRef === dict) return _templates;
    _templates = _buildTemplates(dict);
    _templatesDictRef = dict;
    return _templates;
  }

  function _templateMatch(node, dict) {
    const templates = _getTemplates(dict);
    for (const t of templates) {
      const m = node.match(t.re);
      if (!m) continue;
      // Substitute the captures back into the English template using the
      // same slot names. E.g. en = "${rows.length} branches" and
      // slots = ["${rows.length}"], capture = ["7"] → "7 branches".
      let en = t.en;
      for (let i = 0; i < t.slots.length; i++) {
        const slot = t.slots[i];
        const escSlot = _escapeRe(slot);
        en = en.replace(new RegExp(escSlot, "g"), m[i + 1] ?? "");
      }
      return en;
    }
    return null;
  }

  function _translate(node) {
    if (typeof node !== "string") return node;
    const dict = window._PLX_DICT_EN || {};
    const locale = window.PLX_I18N?.get?.() || "ja";
    if (locale !== "en") return node;
    // 1. Exact match
    if (node in dict) return dict[node];
    // 2. Trimmed match
    const m = _WS_WRAP.exec(node);
    if (m && m[2] && (m[2] in dict)) {
      return m[1] + dict[m[2]] + m[3];
    }
    // 3. Template-pattern match (on both the raw and trimmed forms)
    const tpl = _templateMatch(node, dict);
    if (tpl !== null) return tpl;
    if (m && m[2]) {
      const tpl2 = _templateMatch(m[2], dict);
      if (tpl2 !== null) return m[1] + tpl2 + m[3];
    }
    return node;
  }

  function _trProps(props) {
    if (!props) return props;
    let out = null;
    const locale = window.PLX_I18N?.get?.() || "ja";
    if (locale !== "en") return props;
    for (const k of _PROP_KEYS) {
      const v = props[k];
      if (typeof v === "string") {
        const translated = _translate(v);
        if (translated !== v) {
          if (!out) out = { ...props };
          out[k] = translated;
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
    const newChildren = children.map(_translate);
    return _origCreateElement(type, newProps, ...newChildren);
  };
  React.__plxI18nPatched = true;
})();
