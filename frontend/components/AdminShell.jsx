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
      ],
    },
    {
      label: "オペレーション",
      items: [
        { id: "inventory",  label: "在庫",     icon: "boxes",   to: "/inventory" },
        { id: "po",         label: "発注書",   icon: "file",    to: "/purchase-orders" },
        { id: "sales",      label: "販売記録", icon: "receipt", to: "/sales" },
      ],
    },
    {
      label: "マスタ",
      items: [
        // カテゴリ is master data (set up once, rarely touched) — it lives
        // with 仕入先/院・店舗, not in the daily-use メイン group (logic
        // review 2026-07-15).
        { id: "categories", label: "カテゴリ", icon: "tags",  to: "/categories" },
        { id: "vendors",    label: "仕入先",   icon: "truck", to: "/vendors" },
        { id: "branches",   label: "院・店舗", icon: "bldg",  to: "/branches" },
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
          <div style={{ fontSize: 10, color: T.PLX_SIDEBAR_INK_DIM }}>
            {window.PLX_ME?.role === "admin" ? "管理者" : "スタッフ"}
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <nav aria-label="メイン" data-tour="nav" style={{ padding: "12px 8px 8px", flex: 1, overflowY: "auto" }}>
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
      </nav>

      {/* Footer — logged-in user (window.PLX_ME set by the app.jsx auth gate) */}
      <div style={{
        height: 56, padding: "0 16px", display: "flex", alignItems: "center", gap: 10,
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: "#F4D4B8",
          color: "#1F2937", fontWeight: 700, fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{(window.PLX_ME?.display_name || "山田 花子").charAt(0)}</div>
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {window.PLX_ME?.display_name || "山田 花子"}
          </div>
          <div style={{ fontSize: 10, color: T.PLX_SIDEBAR_INK_DIM }}>
            {window.PLX_ME?.role === "admin" ? "管理者" : "スタッフ"}
          </div>
        </div>
        <button
          onClick={async () => {
            try { await api.logout(); } catch (_) {}
            window.location.reload();
          }}
          title="ログアウト"
          style={{
            background: "none", border: "1px solid rgba(255,255,255,0.18)",
            color: T.PLX_SIDEBAR_INK_DIM, borderRadius: 8, width: 28, height: 28,
            cursor: "pointer", fontSize: 13, display: "inline-flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.PLX_SIDEBAR_INK_DIM; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
        >⎋</button>
      </div>

      {/* Version badge — shows "Alpha v0.4.0" so users (and demo viewers)
          always know which build they're looking at. The pill uses warm
          amber to signal pre-release; flip to neutral once we cut a beta. */}
      <div style={{
        padding: "8px 16px 12px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8,
      }}
        title={`SCO 商品管理 PoC ${PLX_VERSION.channel} v${PLX_VERSION.number}`}
      >
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
          color: "#FCD34D", background: "rgba(252,211,77,0.12)",
          padding: "2px 7px", borderRadius: 9999,
          border: "1px solid rgba(252,211,77,0.35)",
          textTransform: "uppercase",
        }}>{PLX_VERSION.channel}</span>
        <span style={{
          fontSize: 10, color: T.PLX_SIDEBAR_INK_DIM,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontVariantNumeric: "tabular-nums",
        }}>v{PLX_VERSION.number}</span>
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
    <a href={spec.to ? "#" + spec.to : "#"} aria-current={active ? "page" : undefined}
      onClick={(e) => { if (!spec.to) e.preventDefault(); }} style={style}>
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
// Label → hash route lookup. Used to auto-link string breadcrumbs without
// touching every page. Last item is never linked (it's the current page).
// If a page wants a custom target, pass {label, to} instead of a string.
const BREADCRUMB_ROUTES = {
  "ホーム":     "/dashboard",
  "商品一覧":   "/products",
  "在庫":       "/inventory",
  "カテゴリ":   "/categories",
  "発注書":     "/purchase-orders",
  "販売記録":   "/sales",
  "仕入先":     "/vendors",
  "院・店舗":   "/branches",
  "設定":       "/settings",
  "サポート":   "/support",
};

function PlxTopBar({ title, breadcrumbs, headerRight }) {
  // Brief §2.7 says the top bar is 56 px and contains breadcrumbs (left),
  // headerRight slot, a global search input, and a bell. `title` is kept
  // optional for screens that want the H1 in the topbar instead of the body.
  //
  // Breadcrumb items may be:
  //   - string             — auto-linked via BREADCRUMB_ROUTES if known;
  //                          last item is always static text (current page).
  //   - {label, to}        — explicit href = `#${to}`. Use when the auto-
  //                          lookup doesn't apply (e.g. detail pages).
  return (
    <div style={{
      height: 56, background: T.PLX_SURFACE_0, borderBottom: `1px solid ${T.PLX_LINE_200}`,
      padding: "0 32px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0,
    }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          breadcrumbs.map((b, i) => {
            const isLast = i === breadcrumbs.length - 1;
            const isObj = b && typeof b === "object";
            const label = isObj ? b.label : b;
            const to = isObj ? b.to : BREADCRUMB_ROUTES[label];
            const textStyle = {
              fontSize: 13,
              fontWeight: isLast ? 600 : 400,
              color: isLast ? T.PLX_INK_900 : T.PLX_INK_500,
              whiteSpace: "nowrap",
              textDecoration: "none",
            };
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {i > 0 && <ChevronRight color={T.PLX_INK_400} />}
                {!isLast && to ? (
                  <a
                    href={"#" + to}
                    style={{ ...textStyle, cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = T.PLX_GREEN_600 || T.PLX_INK_900; e.currentTarget.style.textDecoration = "underline"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.PLX_INK_500; e.currentTarget.style.textDecoration = "none"; }}
                  >
                    {label}
                  </a>
                ) : (
                  <span style={textStyle}>{label}</span>
                )}
              </span>
            );
          })
        ) : title ? (
          <span style={{ fontSize: 14, fontWeight: 600, color: T.PLX_INK_900 }}>{title}</span>
        ) : null}
      </div>
      {headerRight && (
        <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, whiteSpace: "nowrap" }}>
          {headerRight}
        </span>
      )}
      {/* Global search — opens the Ctrl+K command palette. We render this
          as a button shaped like an input so the affordance still reads as
          "search box", but clicking (or Ctrl+K) opens the palette which
          does the real cross-resource lookup. */}
      <button
        onClick={() => window.PLX_CMDK && window.PLX_CMDK.open()}
        title="横断検索 (Ctrl+K)"
        data-tour="global-search"
        style={{
          position: "relative", width: 280, height: 36, flexShrink: 0,
          padding: "0 12px 0 36px", fontSize: 13, fontFamily: "inherit",
          background: T.PLX_SURFACE_50, border: `1px solid ${T.PLX_LINE_200}`,
          borderRadius: T.RADIUS_MD, color: T.PLX_INK_500,
          boxSizing: "border-box", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <span style={{ position: "absolute", left: 12, top: 10, pointerEvents: "none" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.PLX_INK_400}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </span>
        <span>商品 / 仕入先 / 発注書を検索…</span>
        <kbd style={{
          fontSize: 10, color: T.PLX_INK_500, background: T.PLX_CARD_BG,
          padding: "1px 6px", borderRadius: 4,
          border: `1px solid ${T.PLX_LINE_200}`,
          fontFamily: "ui-monospace, monospace",
        }}>Ctrl+K</kbd>
      </button>
      <span data-tour="lang-theme" style={{ display: "inline-flex", gap: 8, flexShrink: 0 }}>
        <PlxLocaleToggle />
        <PlxThemeToggle />
      </span>
      <NotificationBell />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Notification bell (heavy-tier item 3) — real feed from /notifications.
// Polls every 30s; red dot when unread; dropdown lists the latest, click
// marks read + navigates; すべて既読 clears the dot.
// ─────────────────────────────────────────────────────────────────────
const NOTIF_KIND_ICON = {
  low_stock: "📉", expiring_soon: "⏱", po_status: "📦", daily_summary: "🌿",
};

function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const feedQ = useFetch(() => api.listNotifications({ limit: 12 }).catch(() => ({ items: [], unread_count: 0 })), [tick]);
  React.useEffect(() => {
    const h = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(h);
  }, []);
  const items = feedQ.data?.items ?? [];
  const unread = feedQ.data?.unread_count ?? 0;

  const openItem = async (n) => {
    setOpen(false);
    try { if (!n.read_at) await api.markNotificationRead(n.id); } catch (_) {}
    setTick((t) => t + 1);
    if (n.link_path) navigate(n.link_path);
  };

  const readAll = async () => {
    try { await api.markAllNotificationsRead(); } catch (_) {}
    setTick((t) => t + 1);
  };

  const relTime = (iso) => {
    if (!iso) return "";
    // created_at from MySQL NOW() is naive JST with no tz marker; append Z
    // only when the string carries NO offset already (a "+09:00" or "Z"
    // suffix must be left alone or Date() returns NaN → "NaN分前").
    const hasTz = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso);
    const parsed = new Date(hasTz ? iso : iso + "Z");
    const ms = parsed.getTime();
    if (Number.isNaN(ms)) return "";
    const mins = Math.max(0, Math.floor((Date.now() - ms) / 60000));
    if (mins < 1) return "たった今";
    if (mins < 60) return `${mins}分前`;
    if (mins < 1440) return `${Math.floor(mins / 60)}時間前`;
    return `${Math.floor(mins / 1440)}日前`;
  };

  return (
    <div data-tour="notif-bell" style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} title="通知" style={{
        width: 36, height: 36, borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
        background: open ? T.PLX_SURFACE_100 : T.PLX_SURFACE_0, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.PLX_INK_700}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 5, minWidth: 15, height: 15, padding: "0 3px",
            borderRadius: 9999, background: T.PLX_RED_600, color: "#fff",
            fontSize: 9, fontWeight: 800, display: "inline-flex",
            alignItems: "center", justifyContent: "center",
            border: `2px solid ${T.PLX_SURFACE_0}`,
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <>
          {/* click-away scrim */}
          <div onClick={() => setOpen(false)} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          <div style={{
            position: "absolute", top: 42, right: 0, width: 360, zIndex: 61,
            background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG,
            border: `1px solid ${T.PLX_LINE_200}`,
            boxShadow: T.SHADOW_LG || "0 12px 40px rgba(0,0,0,.18)", overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 14px", display: "flex", alignItems: "center",
              justifyContent: "space-between", borderBottom: `1px solid ${T.PLX_LINE_200}`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.PLX_INK_900 }}>通知</span>
              {unread > 0 && (
                <button onClick={readAll} style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, color: T.PLX_GREEN_700,
                }}>すべて既読にする</button>
              )}
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {items.length === 0 && (
                <div style={{ padding: 26, textAlign: "center", color: T.PLX_INK_400, fontSize: 12 }}>
                  通知はまだありません
                </div>
              )}
              {items.map((n) => (
                <div key={n.id} onClick={() => openItem(n)}
                  {...(n.link_path ? plxClickable(() => openItem(n)) : {})} style={{
                  padding: "10px 14px", cursor: n.link_path ? "pointer" : "default",
                  display: "flex", gap: 10, alignItems: "flex-start",
                  background: n.read_at ? "transparent" : T.PLX_GREEN_050 || T.PLX_SURFACE_50,
                  borderBottom: `1px solid ${T.PLX_LINE_100}`,
                }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(0.97)"}
                  onMouseLeave={(e) => e.currentTarget.style.filter = "none"}>
                  <span style={{ fontSize: 16, lineHeight: "20px" }}>{NOTIF_KIND_ICON[n.kind] || "🔔"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: n.read_at ? 500 : 700, color: T.PLX_INK_900 }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: 11, color: T.PLX_INK_500, marginTop: 2 }}>{n.body}</div>
                    )}
                    <div style={{ fontSize: 10, color: T.PLX_INK_400, marginTop: 3 }}>{relTime(n.created_at)}</div>
                  </div>
                  {!n.read_at && (
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.PLX_GREEN_600, marginTop: 5, flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Theme + locale toggles for the topbar. Mirrored in DevPanel +
// Settings page; all three read/write the same window.PLX_THEME /
// window.PLX_I18N singletons so toggling anywhere updates everything.
// ─────────────────────────────────────────────────────────────────────
function PlxThemeToggle() {
  const [theme] = usePlxTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => window.PLX_THEME.toggle()}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
      style={{
        width: 36, height: 36, borderRadius: T.RADIUS_MD,
        border: `1px solid ${T.PLX_LINE_200}`,
        background: T.PLX_SURFACE_0, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {isDark ? (
        // sun
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.PLX_AMBER_700}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
      ) : (
        // moon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.PLX_INK_700}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

function PlxLocaleToggle() {
  const [locale] = usePlxLocale();
  const next = locale === "ja" ? "en" : "ja";
  return (
    <button
      onClick={() => window.PLX_I18N.set(next)}
      title={`Switch to ${next === "en" ? "English" : "日本語"}`}
      aria-label="Toggle language"
      style={{
        height: 36, padding: "0 12px", borderRadius: T.RADIUS_MD,
        border: `1px solid ${T.PLX_LINE_200}`,
        background: T.PLX_SURFACE_0, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, color: T.PLX_INK_700,
        fontFamily: "ui-monospace, monospace", letterSpacing: ".06em",
      }}
    >
      {locale === "en" ? "EN" : "JA"}
    </button>
  );
}

window.AdminShell = AdminShell;
