// AdminShell: Sidebar + TopBar + content slot.

function AdminShell({ children, title, breadcrumbs, headerRight, currentNav = "products" }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "240px 1fr",
      background: PLX_SURFACE, height: "100%", color: PLX_TEXT,
    }}>
      <Sidebar current={currentNav} />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar title={title} breadcrumbs={breadcrumbs} headerRight={headerRight} />
        <main style={{ padding: "24px 32px", flex: 1, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ current }) {
  const items = [
    { id: "dashboard",  label: "ダッシュボード", icon: "dashboard" },
    { id: "products",   label: "商品",           icon: "box", to: "/products" },
    { id: "categories", label: "カテゴリ",       icon: "folder" },
    { id: "inventory",  label: "在庫",           icon: "layers" },
    { id: "po",         label: "発注書",         icon: "truck", badge: 4 },
    { id: "sales",      label: "販売記録",       icon: "card" },
    { id: "vendors",    label: "仕入先",         icon: "building" },
    { id: "branches",   label: "院・店舗",       icon: "branch" },
  ];
  const bottom = [
    { id: "settings", label: "設定",     icon: "cog" },
    { id: "help",     label: "サポート", icon: "help" },
  ];

  return (
    <aside style={{
      background: "#fff", borderRight: `1px solid ${PLX_BORDER}`,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "20px 22px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <img src="./assets/logo-paylight-x.svg" alt="paylight X" style={{ height: 30 }} />
        <span style={{
          fontSize: 10, fontWeight: 700, color: PLX_GREEN, background: PLX_GREEN_LIGHT,
          padding: "2px 8px", borderRadius: 9999, letterSpacing: ".05em",
        }}>ADMIN</span>
      </div>
      <div style={{ padding: "0 12px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <SidebarLabel>MENU</SidebarLabel>
        {items.map((i) => <NavItem key={i.id} spec={i} active={current === i.id} />)}
        <div style={{ flex: 1 }} />
        <SidebarLabel>OTHER</SidebarLabel>
        {bottom.map((i) => <NavItem key={i.id} spec={i} active={current === i.id} />)}
      </div>
      <ClinicCard />
    </aside>
  );
}

function SidebarLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, color: PLX_SUBTLE,
      padding: "14px 10px 6px", letterSpacing: ".08em",
    }}>{children}</div>
  );
}

function NavItem({ spec, active }) {
  const style = {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 12px", borderRadius: 10, fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? PLX_GREEN : PLX_TEXT,
    background: active ? PLX_GREEN_LIGHT : "transparent",
    textDecoration: "none", cursor: spec.to ? "pointer" : "default",
  };
  const content = (
    <>
      <NavIcon name={spec.icon} color={active ? PLX_GREEN : PLX_MUTED} />
      <span style={{ flex: 1 }}>{spec.label}</span>
      {spec.badge != null && (
        <span style={{
          background: PLX_GREEN, color: "#fff", fontSize: 10, fontWeight: 700,
          padding: "2px 7px", borderRadius: 9999,
        }}>{spec.badge}</span>
      )}
    </>
  );
  if (spec.to) {
    return <a href={"#" + spec.to} style={style}>{content}</a>;
  }
  return <a href="#" onClick={(e) => e.preventDefault()} style={style}>{content}</a>;
}

function NavIcon({ name, color }) {
  const props = {
    width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: color,
    strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (name) {
    case "dashboard": return (<svg {...props}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>);
    case "box": return (<svg {...props}><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>);
    case "folder": return (<svg {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>);
    case "layers": return (<svg {...props}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>);
    case "truck": return (<svg {...props}><rect x="1" y="6" width="14" height="11" rx="1.5"/><path d="M15 9h4l3 3v5h-7"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>);
    case "building": return (<svg {...props}><rect x="4" y="3" width="16" height="18" rx="1"/></svg>);
    case "branch": return (<svg {...props}><path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 14 15 14 15 22"/></svg>);
    case "card": return (<svg {...props}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>);
    case "cog": return (<svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>);
    case "help": return (<svg {...props}><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/></svg>);
    default: return (<svg {...props}><circle cx="12" cy="12" r="10"/></svg>);
  }
}

function ClinicCard() {
  return (
    <div style={{
      margin: 16, background: PLX_GREEN_50, borderRadius: 12,
      padding: "14px 16px", display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", background: PLX_GREEN,
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900,
      }}>西</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>にしかわデンタル</div>
        <div style={{ fontSize: 10, color: PLX_MUTED }}>X-Core+ プラン</div>
      </div>
    </div>
  );
}

function TopBar({ title, breadcrumbs, headerRight }) {
  return (
    <div style={{
      height: 64, background: "#fff", borderBottom: `1px solid ${PLX_BORDER}`,
      padding: "0 32px", display: "flex", alignItems: "center", gap: 20, flexShrink: 0,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {breadcrumbs && (
          <div style={{
            fontSize: 11, color: PLX_MUTED, fontWeight: 500, marginBottom: 2,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {breadcrumbs.map((b, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {i > 0 && <span style={{ color: PLX_SUBTLE }}>/</span>}
                <span style={{
                  color: i === breadcrumbs.length - 1 ? PLX_TEXT : PLX_MUTED,
                  fontWeight: i === breadcrumbs.length - 1 ? 700 : 500,
                }}>{b}</span>
              </span>
            ))}
          </div>
        )}
        <h1 style={{
          fontSize: breadcrumbs ? 16 : 20, fontWeight: 700, margin: 0,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{title}</h1>
      </div>
      {headerRight}
      <div style={{ position: "relative", flex: "0 0 240px" }}>
        <input placeholder="商品名・SKUで検索…" style={{
          width: "100%", height: 38, border: `1px solid ${PLX_BORDER}`, borderRadius: 9999,
          padding: "0 16px 0 38px", fontSize: 13, outline: "none", background: PLX_SURFACE,
          boxSizing: "border-box",
        }} />
        <svg style={{ position: "absolute", left: 13, top: 10 }}
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PLX_MUTED}
          strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      </div>
      <button style={{
        width: 38, height: 38, borderRadius: "50%",
        border: `1px solid ${PLX_BORDER}`, background: "#fff", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PLX_TEXT}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        <span style={{
          position: "absolute", top: 7, right: 8, width: 7, height: 7,
          borderRadius: "50%", background: PLX_GREEN, border: "2px solid #fff",
        }} />
      </button>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        paddingLeft: 14, borderLeft: `1px solid ${PLX_BORDER}`,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", background: "#F4D4B8",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 13, color: "#1F2937",
        }}>田</div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>田中 美咲</div>
          <div style={{ fontSize: 10, color: PLX_MUTED }}>受付 / 管理者</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminShell });
