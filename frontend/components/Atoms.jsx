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
      padding: "3px 10px", borderRadius: 9999, whiteSpace: "nowrap", display: "inline-block",
    }}>{children}</span>
  );
}

function StatusPill({ status }) {
  if (status === "active") return <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>公開中</Pill>;
  if (status === "draft")  return <Pill color={PLX_MUTED} bg="#F3F4F6">下書き</Pill>;
  return <Pill color={PLX_SUBTLE} bg="#F3F4F6">アーカイブ</Pill>;
}

function Select({ value, onChange, options, minWidth = 160 }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        height: 38, padding: "0 32px 0 14px", borderRadius: 9,
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
      display: "inline-flex", background: PLX_SURFACE, borderRadius: 9999,
      padding: 3, border: `1px solid ${PLX_BORDER}`,
    }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 9999,
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

function FormRow({ label, children, hint, required, requiredFor, error }) {
  // required:    show a red * — field is required to save (any status).
  // requiredFor: e.g. "公開" — show a softer "公開時必須" tag without the red *.
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 700, color: PLX_TEXT, marginBottom: 6,
      }}>
        <span>{label}</span>
        {required && (
          <span style={{ color: "#DC2626", fontSize: 12, fontWeight: 700 }} title="必須">*</span>
        )}
        {requiredFor && !required && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: "#B45309", background: "#FEF3C7",
            padding: "2px 6px", borderRadius: 9999, border: "1px solid #FDE68A",
          }}>{requiredFor}時必須</span>
        )}
      </label>
      {children}
      {error && (
        <div style={{ fontSize: 11, color: "#DC2626", marginTop: 5, fontWeight: 600 }}>
          {error}
        </div>
      )}
      {hint && !error && <div style={{ fontSize: 11, color: PLX_MUTED, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

const formInput = {
  width: "100%", height: 38, border: `1px solid ${PLX_BORDER}`, borderRadius: 9,
  padding: "0 14px", fontSize: 13, outline: "none", background: T.PLX_CARD_BG,
  boxSizing: "border-box", color: PLX_TEXT,
};

const btnPrimary = {
  height: 38, padding: "0 20px", borderRadius: 9999,
  background: PLX_GREEN, color: "#fff", border: "none",
  fontWeight: 700, fontSize: 13, cursor: "pointer",
};

const btnSecondary = {
  height: 38, padding: "0 18px", borderRadius: 9999,
  background: T.PLX_CARD_BG, color: PLX_TEXT, border: `1px solid ${PLX_BORDER}`,
  fontWeight: 700, fontSize: 13, cursor: "pointer",
};

const btnGhost = {
  height: 38, padding: "0 14px", borderRadius: 9999,
  background: "transparent", color: PLX_MUTED, border: "none",
  fontWeight: 700, fontSize: 13, cursor: "pointer",
};

Object.assign(window, {
  SectionLabel, Pill, StatusPill, Select, SegmentedControl,
  FormRow, formInput, btnPrimary, btnSecondary, btnGhost,
  ProductThumb,
});
