// Shared visual atoms: SectionLabel, Pill, Select, SegmentedControl, FormRow, buttons.

// ProductThumb — renders the product image with a graceful SVG fallback.
//
// The seed data uses placeholder image URLs that often 404; rendering them
// as `<div style={backgroundImage: url(…)}>` made the broken-image
// invisible (the green tile showed instead). Using a real <img> + onError
// gives us a real "did it load?" signal and lets us swap to the icon
// fallback on failure without a layout shift.
function ProductThumb({ url, size = 36, iconSize, alt }) {
  const [failed, setFailed] = React.useState(false);
  const showImg = !!url && !failed;
  const _iconSize = iconSize || Math.round(size * 0.45);
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.max(6, Math.round(size / 5)),
      background: PLX_GREEN_LIGHT, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: `1px solid ${PLX_BORDER}`, overflow: "hidden",
      position: "relative",
    }}>
      {showImg ? (
        <img
          src={url}
          alt={alt || ""}
          onError={() => setFailed(true)}
          loading="lazy"
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <svg width={_iconSize} height={_iconSize} viewBox="0 0 24 24"
          fill="none" stroke={PLX_GREEN}
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.3 7 12 12 20.7 7"/>
        </svg>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      fontSize: 12, fontWeight: 700, color: PLX_GREEN, letterSpacing: ".05em",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: PLX_GREEN }} />
      {children}
    </div>
  );
}

function Pill({ children, color, bg }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color, background: bg,
      padding: "3px 10px", borderRadius: T.RADIUS_PILL, whiteSpace: "nowrap", display: "inline-block",
    }}>{children}</span>
  );
}

function StatusPill({ status }) {
  if (status === "active") return <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>公開中</Pill>;
  if (status === "draft")  return <Pill color={PLX_MUTED} bg={T.PLX_PILL_BG}>下書き</Pill>;
  return <Pill color={PLX_SUBTLE} bg={T.PLX_PILL_BG}>アーカイブ</Pill>;
}

function Select({ value, onChange, options, minWidth = 160 }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        height: 38, padding: "0 32px 0 14px", borderRadius: T.RADIUS_MD,
        border: `1px solid ${PLX_BORDER}`, fontSize: 13, background: T.PLX_CARD_BG,
        cursor: "pointer", appearance: "none", WebkitAppearance: "none",
        color: PLX_TEXT, minWidth,
      }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg style={{ position: "absolute", right: 12, top: 14, pointerEvents: "none" }}
        width="10" height="10" viewBox="0 0 12 12" fill="none" stroke={PLX_MUTED}
        strokeWidth="1.8" strokeLinecap="round"><path d="M2 4l4 4 4-4" /></svg>
    </div>
  );
}

function SegmentedControl({ value, onChange, options }) {
  return (
    <div style={{
      display: "inline-flex", background: PLX_SURFACE, borderRadius: T.RADIUS_PILL,
      padding: 3, border: `1px solid ${PLX_BORDER}`,
    }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: T.RADIUS_PILL,
            border: "none",
            background: on ? T.PLX_CARD_BG : "transparent",
            color: on ? PLX_GREEN : PLX_MUTED,
            boxShadow: on ? "0 1px 3px rgba(0,0,0,.06)" : "none",
            cursor: "pointer",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

let _plxFieldSeq = 0;

function FormRow({ label, children, hint, required, requiredFor, error }) {
  // required:    show a red * — field is required to save (any status).
  // requiredFor: e.g. "公開" — show a softer "公開時必須" tag without the red *.
  //
  // Label association (WCAG 1.3.1): when `children` is a single element we
  // clone it with a generated id (unless it already has one) and point the
  // label's htmlFor at it, plus aria-invalid/aria-describedby for the error
  // and hint rows. Multi-element children keep the old unassociated markup.
  const autoId = React.useMemo(() => `fld-${++_plxFieldSeq}`, []);
  const only = React.Children.count(children) === 1 ? React.Children.only(children) : null;
  const canWire = React.isValidElement(only) && typeof only.type === "string";
  const ctlId = canWire ? (only.props.id || autoId) : null;
  const errId = `${autoId}-err`;
  const hintId = `${autoId}-hint`;
  const describedBy = error ? errId : hint ? hintId : undefined;
  const control = canWire
    ? React.cloneElement(only, {
        id: ctlId,
        "aria-invalid": error ? true : only.props["aria-invalid"],
        "aria-describedby": describedBy || only.props["aria-describedby"],
        "aria-required": required || only.props["aria-required"],
      })
    : children;
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={ctlId || undefined} style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 700, color: PLX_TEXT, marginBottom: 6,
      }}>
        <span>{label}</span>
        {required && (
          <span style={{ color: T.PLX_RED_600, fontSize: 12, fontWeight: 700 }}
            title="必須" aria-label="必須">*</span>
        )}
        {requiredFor && !required && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: T.PLX_AMBER_700, background: T.PLX_AMBER_100,
            padding: "2px 6px", borderRadius: T.RADIUS_PILL, border: `1px solid ${T.PLX_AMBER_100}`,
          }}>{requiredFor}時必須</span>
        )}
      </label>
      {control}
      {error && (
        <div id={errId} style={{ fontSize: 11, color: T.PLX_RED_600, marginTop: 5, fontWeight: 600 }}>
          {error}
        </div>
      )}
      {hint && !error && <div id={hintId} style={{ fontSize: 11, color: PLX_MUTED, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

const formInput = {
  // No `outline:"none"` — the global :focus-visible rule (index.html) draws
  // the keyboard focus ring. Removing outlines without a replacement was the
  // root WCAG 2.4.7 failure (a11y remediation 2026-07-15).
  // Getters, not values: these objects are module-scope, so plain values
  // would freeze the light palette at load time. Getters re-read T on every
  // render-time spread, so dark mode gets the right colors.
  width: "100%", height: 38, get border() { return `1px solid ${T.PLX_LINE_200}`; },
  borderRadius: T.RADIUS_MD,
  padding: "0 14px", fontSize: 13, get background() { return T.PLX_INPUT_BG; },
  boxSizing: "border-box", get color() { return T.PLX_INK_900; },
};

const btnPrimary = {
  height: 38, padding: "0 20px", borderRadius: T.RADIUS_PILL,
  get background() { return T.PLX_GREEN_600; }, get color() { return T.PLX_ON_BRAND; },
  border: "none",
  fontWeight: 700, fontSize: 13, cursor: "pointer",
};

const btnSecondary = {
  height: 38, padding: "0 18px", borderRadius: T.RADIUS_PILL,
  get background() { return T.PLX_CARD_BG; }, get color() { return T.PLX_INK_900; },
  get border() { return `1px solid ${T.PLX_LINE_200}`; },
  fontWeight: 700, fontSize: 13, cursor: "pointer",
};

const btnGhost = {
  height: 38, padding: "0 14px", borderRadius: T.RADIUS_PILL,
  background: "transparent", get color() { return T.PLX_INK_500; }, border: "none",
  fontWeight: 700, fontSize: 13, cursor: "pointer",
};

// ── Column sorting (logic-review follow-up 2026-07-15) ─────────────
// Shared by every list page: usePlxSort holds {key, dir}; apply() sorts a
// row array with per-key accessor functions (numbers numeric, strings via
// ja-aware localeCompare, nulls last). PlxSortHeader renders a clickable
// header cell with an ▲/▼ indicator.
function usePlxSort(defaultKey, defaultDir) {
  const [sort, setSort] = React.useState({ key: defaultKey || null, dir: defaultDir || "asc" });
  const toggle = (key) => setSort((s) =>
    s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const apply = (rows, accessors) => {
    if (!sort.key || !accessors[sort.key]) return rows;
    const acc = accessors[sort.key];
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = acc(a), vb = acc(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
      return String(va).localeCompare(String(vb), "ja") * mul;
    });
  };
  return { sort, toggle, apply };
}

function PlxSortHeader({ label, k, sort, onToggle, style }) {
  // A real <button> so it's keyboard-focusable/operable; aria-sort tells
  // screen readers the current order (a11y remediation 2026-07-15).
  const active = sort.key === k;
  return (
    <button
      type="button"
      onClick={() => onToggle(k)}
      title="クリックで並び替え"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      style={{
        cursor: "pointer", userSelect: "none",
        background: "transparent", border: "none", padding: 0,
        font: "inherit", fontWeight: "inherit", letterSpacing: "inherit",
        textAlign: "inherit", textTransform: "inherit",
        color: active ? T.PLX_GREEN_700 : "inherit",
        ...style,
      }}
    >
      {label}{active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </button>
  );
}

// ── Accessible primitives (a11y remediation 2026-07-15) ────────────
// The style objects above (btnPrimary/btnSecondary/btnGhost/formInput) stay
// exported for unconverted call sites, but new/migrated code should use
// these components: they own disabled/loading states, keep the global
// :focus-visible ring, and associate labels with controls.


// <Button variant="primary|secondary|ghost"> — a real <button type="button">.
function Button({ variant = "primary", disabled, loading, onClick, title,
                  style, children, type = "button", ...rest }) {
  const base = variant === "secondary" ? btnSecondary
             : variant === "ghost" ? btnGhost
             : btnPrimary;
  const inert = disabled || loading;
  return (
    <button
      type={type}
      onClick={inert ? undefined : onClick}
      disabled={disabled}
      aria-busy={loading || undefined}
      title={title}
      style={{
        ...base,
        opacity: inert ? 0.55 : 1,
        cursor: inert ? "not-allowed" : "pointer",
        ...style,
      }}
      {...rest}
    >
      {loading ? "処理中…" : children}
    </button>
  );
}

// <TextInput> — label programmatically associated with the control, hint and
// error wired via aria-describedby, aria-invalid on error (WCAG 1.3.1/3.3.1).
function TextInput({ id, label, hint, error, required, requiredFor,
                     style, ...inputProps }) {
  const fieldId = React.useMemo(() => id || `fld-${++_plxFieldSeq}`, [id]);
  const hintId = `${fieldId}-hint`;
  const errId = `${fieldId}-err`;
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label htmlFor={fieldId} style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, fontWeight: 700, color: PLX_TEXT, marginBottom: 6,
        }}>
          <span>{label}</span>
          {required && (
            <span style={{ color: T.PLX_RED_600, fontSize: 12, fontWeight: 700 }}
              title="必須" aria-label="必須">*</span>
          )}
          {requiredFor && !required && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: T.PLX_AMBER_700, background: T.PLX_AMBER_100,
              padding: "2px 6px", borderRadius: T.RADIUS_PILL,
            }}>{requiredFor}時必須</span>
          )}
        </label>
      )}
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : hint ? hintId : undefined}
        aria-required={required || undefined}
        style={{ ...formInput, ...(error ? { border: `1px solid ${T.PLX_RED_600}` } : null), ...style }}
        {...inputProps}
      />
      {error && (
        <div id={errId} style={{ fontSize: 11, color: T.PLX_RED_600, marginTop: 5, fontWeight: 600 }}>
          {error}
        </div>
      )}
      {hint && !error && (
        <div id={hintId} style={{ fontSize: 11, color: PLX_MUTED, marginTop: 5 }}>{hint}</div>
      )}
    </div>
  );
}

// plxClickable(onActivate) — spread onto a clickable <div>/<span> to make it
// keyboard-operable (WCAG 2.1.1): focusable, role=button, Enter/Space fire.
function plxClickable(onActivate) {
  return {
    role: "button",
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget) return;  // nested controls handle their own keys
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate(e);
      }
    },
  };
}

// useDialog — one correct dialog implementation shared by every modal
// (WCAG 4.1.2 / 2.4.3): Escape closes, focus moves in on open, Tab cycles
// inside, and focus returns to the opener on unmount. Returns props to
// spread on the dialog container.
function useDialog({ onClose, labelledBy, enabled = true }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!enabled) return;
    // Only the top of the dialog stack handles keys — nested dialogs
    // (e.g. barcode scanner inside the AI modal) must not close the parent.
    const stack = (window._PLX_DLG_STACK = window._PLX_DLG_STACK || []);
    const token = {};
    stack.push(token);
    const isTop = () => stack[stack.length - 1] === token;
    const opener = document.activeElement;
    const node = ref.current;
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    // Move focus into the dialog unless something inside already grabbed it
    // (e.g. an autoFocus input).
    if (node && !node.contains(document.activeElement)) {
      const first = node.querySelector(FOCUSABLE);
      (first || node).focus?.();
    }
    const onKey = (e) => {
      if (!isTop()) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      stack.splice(stack.indexOf(token), 1);
      document.removeEventListener("keydown", onKey, true);
      opener?.focus?.();  // restore focus to the trigger
    };
  }, [onClose, enabled]);
  return {
    ref,
    role: "dialog",
    "aria-modal": "true",
    ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
    tabIndex: -1,
  };
}

Object.assign(window, {
  SectionLabel, Pill, StatusPill, Select, SegmentedControl,
  FormRow, formInput, btnPrimary, btnSecondary, btnGhost,
  ProductThumb, usePlxSort, PlxSortHeader,
  Button, TextInput, plxClickable, useDialog,
});
