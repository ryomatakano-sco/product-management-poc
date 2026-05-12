// AdminShell — paylight X dark-green sidebar + topbar.
// Refreshed 2026-05-12 to match the compass design brief §2.8 + §3:
//   - Dark green sidebar (PLX_SIDEBAR_BG = #0F2A23)
//   - Nav groups (メイン / オペレーション / マスタ / その他)
//   - Active row pill in PLX_GREEN_600 + 3 px bright stripe on the left edge
//   - Wordmark logo header (square "pX" mark + "paylight X" text)
//   - Workspace switcher row, 240 px rail width

function AdminShell({ children, title, breadcrumbs, headerRight, currentNav = "products" }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "240px 1fr",
      background: T.PLX_SURFACE_50, height: "100%", minHeight: 0,
      fontFamily: T.FONT, color: T.PLX_INK_900,
    }}>
      <PlxSidebar current={currentNav} />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <PlxTopBar title={title} breadcrumbs={breadcrumbs} headerRight={headerRight} />
        <main style={{ padding: "24px 32px", flex: 1, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────
function PlxSidebar({ current }) {
  // Brief §3: four nav groups with caption labels. Items that don't yet have
  // a real page route to /under-construction (handled in app.jsx).
  const groups = [
    {
      label: "メイン",
      items: [
        { id: "dashboard",  label: "ダッシュボード", icon: "dashboard", to: "/dashboard" },
        { id: "products",   label: "商品",           icon: "package",   to: "/products" },
        { id: "categories", label: "カテゴリ",       icon: "tags",      to: "/categories" },
      ],
    },
    {
      label: "オペレーション",
      items: [
        { id: "inventory",  label: "在庫",     icon: "boxes",   to: "/inventory" },
        { id: "po",         label: "発注書",   icon: "file",    to: "/purchase-orders", badge: 5 },
        { id: "sales",      label: "販売記録", icon: "receipt", to: "/sales" },
      ],
    },
    {
      label: "マスタ",
      items: [
        { id: "vendors",  label: "仕入先",   icon: "truck", to: "/vendors" },
        { id: "branches", label: "院・店舗", icon: "bldg",  to: "/branches" },
      ],
    },
    {
      label: "その他",
      items: [
        { id: "settings", label: "設定",     icon: "cog",  to: "/settings" },
        { id: "support",  label: "サポート", icon: "help", to: "/support" },
      ],
    },
  ];

  return (
    <aside style={{
      background: T.PLX_SIDEBAR_BG, display: "flex", flexDirection: "column",
      color: T.PLX_SIDEBAR_INK,
    }}>
      {/* Header — wordmark logo (square "pX" + green-accented text) */}
      <div style={{
        height: 72, padding: "0 24px", display: "flex", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: T.PLX_GREEN_600,
            color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: "-0.02em",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>pX</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
            paylight <span style={{ color: T.PLX_GREEN_500 }}>X</span>
          </div>
        </div>
      </div>

      {/* Workspace switcher */}
      <div style={{
        height: 56, padding: "0 16px", display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.08)",
          color: "#fff", fontSize: 11, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>本</div>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: "#fff",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>ペイライト歯科クリニック</div>
          <div style={{ fontSize: 10, color: T.PLX_SIDEBAR_INK_DIM }}>本院 / 管理者</div>
        </div>
        <ChevronDown color={T.PLX_SIDEBAR_INK_DIM} size={14} />
      </div>

      {/* Nav groups */}
      <div style={{ padding: "12px 8px 8px", flex: 1, overflowY: "auto" }}>
        {groups.map((g) => (
          <div key={g.label} style={{ marginBottom: 14 }}>
            <div style={{
              padding: "6px 12px 4px", fontSize: 10, fontWeight: 600,
              color: T.PLX_SIDEBAR_INK_DIM, letterSpacing: "0.08em", textTransform: "uppercase",
            }}>{g.label}</div>
            {g.items.map((i) => (
              <SbItem key={i.id} spec={i} active={current === i.id} />
            ))}
          </div>
        ))}
      </div>

      {/* Footer — user */}
      <div style={{
        height: 56, padding: "0 16px", display: "flex", alignItems: "center", gap: 10,
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: "#F4D4B8",
          color: "#1F2937", fontWeight: 700, fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>山</div>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>山田 花子</div>
          <div style={{ fontSize: 10, color: T.PLX_SIDEBAR_INK_DIM }}>本院 / 管理者</div>
        </div>
      </div>
    </aside>
  );
}

function SbItem({ spec, active }) {
  const style = {
    position: "relative", display: "flex", alignItems: "center", gap: 12,
    height: 40, padding: "0 16px", margin: "2px 4px", borderRadius: 8,
    textDecoration: "none", cursor: "pointer",
    background: active ? T.PLX_SIDEBAR_ACTIVE_BG : "transparent",
    color: active ? "#FFFFFF" : T.PLX_SIDEBAR_INK,
    fontSize: 13, fontWeight: active ? 600 : 500,
  };
  return (
    <a href={spec.to ? "#" + spec.to : "#"} onClick={(e) => { if (!spec.to) e.preventDefault(); }} style={style}>
      {active && (
        <span style={{
          position: "absolute", left: -4, top: 6, bottom: 6, width: 3,
          background: T.PLX_GREEN_500, borderRadius: 2,
        }} />
      )}
      <NavIcon name={spec.icon} color={active ? "#fff" : T.PLX_SIDEBAR_INK} />
      <span style={{ flex: 1 }}>{spec.label}</span>
      {spec.badge != null && (
        <span style={{
          background: active ? "rgba(255,255,255,0.22)" : T.PLX_GREEN_600,
          color: "#fff", fontSize: 10, fontWeight: 700,
          padding: "2px 7px", borderRadius: 9999,
        }}>{spec.badge}</span>
      )}
    </a>
  );
}

// Lucide-style stroke icons (kept locally because frontend has no bundler).
function NavIcon({ name, color }) {
  const p = {
    width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: color,
    strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round",
    style: { flexShrink: 0 },
  };
  switch (name) {
    case "dashboard": return (
      <svg {...p}>
        <rect x="3" y="3" width="7" height="9" rx="1"/>
        <rect x="14" y="3" width="7" height="5" rx="1"/>
        <rect x="14" y="12" width="7" height="9" rx="1"/>
        <rect x="3" y="16" width="7" height="5" rx="1"/>
      </svg>
    );
    case "package": return (
      <svg {...p}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <path d="m3.3 7 8.7 5 8.7-5"/>
        <path d="M12 22V12"/>
      </svg>
    );
    case "tags": return (
      <svg {...p}>
        <path d="M3 7v6a2 2 0 0 0 .6 1.4l8 8a2 2 0 0 0 2.8 0l6-6a2 2 0 0 0 0-2.8l-8-8A2 2 0 0 0 11 5H5a2 2 0 0 0-2 2z"/>
        <circle cx="7.5" cy="7.5" r="1"/>
      </svg>
    );
    case "boxes": return (
      <svg {...p}>
        <path d="M12 7v5l4-2.5L20 11V6a2 2 0 0 0-1-1.7l-3-1.7a2 2 0 0 0-2 0l-3 1.7A2 2 0 0 0 12 6z"/>
        <path d="M12 12v5l-4 2.5-4-2.5v-5l4-2.5z"/>
        <path d="M12 12v5l4 2.5 4-2.5v-5l-4-2.5z"/>
      </svg>
    );
    case "file": return (
      <svg {...p}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="14" y2="17"/>
      </svg>
    );
    case "receipt": return (
      <svg {...p}>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
        <path d="M12 17.5v-11"/>
      </svg>
    );
    case "truck": return (
      <svg {...p}>
        <rect x="1" y="6" width="14" height="11" rx="1.5"/>
        <path d="M15 9h4l3 3v5h-7"/>
        <circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>
      </svg>
    );
    case "bldg": return (
      <svg {...p}>
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
        <path d="M2 22h20"/>
        <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
      </svg>
    );
    case "cog": return (
      <svg {...p}>
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>
      </svg>
    );
    case "help": return (
      <svg {...p}>
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12" y2="17"/>
      </svg>
    );
    default: return <svg {...p}><circle cx="12" cy="12" r="10"/></svg>;
  }
}

function ChevronDown({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronRight({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────────────────────────────
function PlxTopBar({ title, breadcrumbs, headerRight }) {
  // Brief §2.7 says the top bar is 56 px and contains breadcrumbs (left),
  // headerRight slot, a global search input, and a bell. `title` is kept
  // optional for screens that want the H1 in the topbar instead of the body.
  return (
    <div style={{
      height: 56, background: T.PLX_SURFACE_0, borderBottom: `1px solid ${T.PLX_LINE_200}`,
      padding: "0 32px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0,
    }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          breadcrumbs.map((b, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <ChevronRight color={T.PLX_INK_400} />}
              <span style={{
                fontSize: 13,
                fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                color: i === breadcrumbs.length - 1 ? T.PLX_INK_900 : T.PLX_INK_500,
                whiteSpace: "nowrap",
              }}>{b}</span>
            </span>
          ))
        ) : title ? (
          <span style={{ fontSize: 14, fontWeight: 600, color: T.PLX_INK_900 }}>{title}</span>
        ) : null}
      </div>
      {headerRight}
      {/* Global search */}
      <div style={{ position: "relative", width: 280 }}>
        <input placeholder="商品名・SKU・JANで検索" style={{
          width: "100%", height: 36,
          padding: "0 12px 0 36px", fontSize: 13, fontFamily: "inherit",
          background: T.PLX_SURFACE_50, border: `1px solid ${T.PLX_LINE_200}`,
          borderRadius: T.RADIUS_MD, outline: "none", color: T.PLX_INK_700,
          boxSizing: "border-box",
        }} />
        <div style={{ position: "absolute", left: 12, top: 10, pointerEvents: "none" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.PLX_INK_400}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </div>
      </div>
      {/* Bell */}
      <button style={{
        width: 36, height: 36, borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
        background: "#fff", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.PLX_INK_700}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
        </svg>
        <span style={{
          position: "absolute", top: 6, right: 8, width: 7, height: 7,
          borderRadius: "50%", background: T.PLX_RED_600, border: "2px solid #fff",
        }} />
      </button>
    </div>
  );
}

window.AdminShell = AdminShell;
