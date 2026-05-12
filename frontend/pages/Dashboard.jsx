// Dashboard — landing page (Yoshioka 2026-05-11).
// AI summary (server returns canned text + real KPI counts) + KPI tiles +
// "要対応の商品" list (top 5 lowest-stock products) + 最近の活動 (mock) +
// category breakdown (mock).

const DASH_AMBER = "#D97706";
const DASH_AMBER_LIGHT = "#FEF3C7";
const DASH_RED = "#DC2626";
const DASH_RED_LIGHT = "#FEE2E2";

function Dashboard() {
  const summaryQ = useFetch(() => api.getDashboardSummary(), []);
  // Pull the 5 lowest-available active products for the attention table.
  const productsQ = useFetch(() => api.listProducts({ limit: 50, status: "active" }), []);

  const loading = summaryQ.loading || productsQ.loading;
  const summary = summaryQ.data;
  const kpis = summary?.kpis ?? { total_products: 0, low_stock: 0, expiring_soon: 0, monthly_sales_jpy: 0 };

  // Top-5 attention rows: lowest available, ties broken by id.
  const attention = React.useMemo(() => {
    const list = productsQ.data?.items ?? [];
    return [...list]
      .sort((a, b) => (a.total_available ?? 0) - (b.total_available ?? 0))
      .slice(0, 5);
  }, [productsQ.data]);

  const headerRight = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{
        fontSize: 11, fontWeight: 600, color: PLX_MUTED,
        background: PLX_GREEN_50, border: `1px solid ${PLX_GREEN_LIGHT}`,
        padding: "6px 12px", borderRadius: 9999,
        display: "inline-flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: PLX_GREEN }} />
        {summary ? `更新: ${new Date(summary.generated_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : "読み込み中…"}
      </span>
    </div>
  );

  const alertCount = kpis.low_stock + kpis.expiring_soon;

  return (
    <AdminShell title="ダッシュボード" currentNav="dashboard" headerRight={headerRight}
      breadcrumbs={["ホーム", "ダッシュボード"]}>
      <SectionLabel>本日の概況</SectionLabel>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 18, marginTop: 6 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-.01em" }}>
          こんにちは、田中さん
        </h2>
        <span style={{ fontSize: 13, color: PLX_MUTED }}>
          にしかわデンタル · {loading ? "読み込み中…" : alertCount > 0 ? `本日のアラート ${alertCount} 件` : "すべて良好です"}
        </span>
      </div>

      {/* AI Summary card */}
      {loading ? <AiSummarySkeleton /> : <AiSummaryCard summary={summary} />}

      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 16 }}>
        {loading ? (
          [0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiTile icon="box" label="登録商品数" value={String(kpis.total_products)} unit="" tone="green"
              onClick={() => navigate("/products")} clickable />
            <KpiTile icon="alert" label="在庫低下アラート" value={String(kpis.low_stock)} unit="件"
              tone={kpis.low_stock > 0 ? "red" : "muted"}
              onClick={() => navigate("/products?stock=low")} clickable />
            <KpiTile icon="calendar" label="期限切れ間近" value={String(kpis.expiring_soon)} unit="件"
              tone={kpis.expiring_soon > 0 ? "amber" : "muted"} delta="30日以内"
              onClick={() => navigate("/products?expiry=soon")} clickable />
            <KpiTile icon="card" label="今月の販売" value={`¥${formatYen(kpis.monthly_sales_jpy)}`} unit="" tone="green" />
          </>
        )}
      </div>

      {/* Two-column row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14, marginTop: 14 }}>
        <div style={dashCard}>
          <DashCardHeader title="要対応の商品" right={loading ? null : "すべて表示 →"} onRight={() => navigate("/products?stock=low")} />
          {loading ? <AttentionSkeleton /> : attention.length === 0 ? <AttentionEmpty /> : <AttentionTable rows={attention} />}
        </div>
        <div style={dashCard}>
          <DashCardHeader title="最近の活動" />
          {loading ? <ActivitySkeleton /> : <ActivityList />}
        </div>
      </div>

      {/* Category breakdown — mock for PoC. TODO: wire to /categories + aggregate variants. */}
      <div style={{ ...dashCard, marginTop: 14 }}>
        <DashCardHeader title="カテゴリ別在庫状況" />
        {loading ? <CategorySkeleton /> : <CategoryBars />}
      </div>

      <style>{`@keyframes plxshimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
    </AdminShell>
  );
}

const dashCard = {
  background: "#fff", borderRadius: 14, border: `1px solid ${PLX_BORDER}`,
  padding: "18px 20px",
};

function DashCardHeader({ title, right, onRight }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", marginBottom: 14 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{title}</h3>
      <div style={{ flex: 1 }} />
      {right && (
        <a href="#" onClick={(e) => { e.preventDefault(); onRight && onRight(); }}
          style={{ fontSize: 12, fontWeight: 700, color: PLX_GREEN, textDecoration: "none" }}>
          {right}
        </a>
      )}
    </div>
  );
}

// ── AI Summary card ─────────────────────────────────────────────────────────

// Convert **bold** markdown to <strong>. 5-line helper, no library.
function renderInlineMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

function AiSummaryCard({ summary }) {
  const isOk = summary.ai_status === "ok";
  const paragraphs = summary.ai_summary.split(/\n{2,}/);
  return (
    <div style={{
      background: "linear-gradient(110deg, #E6F7F2 0%, #F4FBF8 60%, #FFFFFF 100%)",
      border: `1px solid ${PLX_GREEN_LIGHT}`,
      borderRadius: 16, padding: "20px 24px", marginTop: 8, position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(26,166,138,.15)",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN}
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z"/>
            <circle cx="19" cy="18" r="1.5"/><circle cx="5" cy="18" r="1"/>
          </svg>
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>今日の在庫サマリー</h3>
        <span style={{
          fontSize: 10, fontWeight: 700, color: PLX_GREEN, background: "#fff",
          padding: "3px 9px", borderRadius: 9999, letterSpacing: ".05em",
          border: `1px solid ${PLX_GREEN_LIGHT}`,
        }}>✨ AI</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: PLX_MUTED }}>1 日 1 回 09:00 に自動更新</span>
      </div>
      <div style={{
        display: "flex", flexDirection: "column", gap: 10,
        fontSize: 13, lineHeight: 1.85, color: PLX_TEXT, maxWidth: 920,
      }}>
        {paragraphs.map((p, i) => (
          <p key={i}>{renderInlineMarkdown(p)}</p>
        ))}
      </div>
      {!isOk && (
        <div style={{ display: "flex", alignItems: "center", marginTop: 14 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("/products?stock=low"); }}
            style={{ fontSize: 13, fontWeight: 700, color: PLX_GREEN, textDecoration: "none" }}>
            詳細を見る →
          </a>
        </div>
      )}
    </div>
  );
}

function AiSummarySkeleton() {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${PLX_BORDER}`, borderRadius: 16,
      padding: "20px 24px", marginTop: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <SkelBlock w={34} h={34} r={10} />
        <SkelBlock w={180} h={16} />
        <SkelBlock w={40} h={16} r={9999} />
        <div style={{ flex: 1 }} />
        <SkelBlock w={140} h={11} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SkelBlock h={13} w="98%" />
        <SkelBlock h={13} w="86%" />
        <SkelBlock h={13} w="92%" />
        <SkelBlock h={13} w="60%" />
      </div>
    </div>
  );
}

// ── KPI tile ────────────────────────────────────────────────────────────────

function KpiTile({ icon, label, value, unit, delta, tone = "green", clickable, onClick }) {
  const color =
    tone === "red"   ? DASH_RED :
    tone === "amber" ? DASH_AMBER :
    tone === "muted" ? PLX_MUTED :
                       PLX_GREEN;
  const bg =
    tone === "red"   ? DASH_RED_LIGHT :
    tone === "amber" ? DASH_AMBER_LIGHT :
    tone === "muted" ? "#F3F4F6" :
                       PLX_GREEN_LIGHT;
  return (
    <div onClick={clickable ? onClick : undefined} style={{
      background: "#fff", borderRadius: 14, border: `1px solid ${PLX_BORDER}`,
      padding: "16px 18px", height: 104,
      cursor: clickable ? "pointer" : "default",
      transition: "box-shadow .15s, transform .15s",
    }}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.boxShadow = "0 8px 20px rgba(17,24,39,.06)"; e.currentTarget.style.transform = "translateY(-1px)"; } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; } : undefined}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: PLX_MUTED, fontWeight: 600 }}>{label}</div>
        <div style={{ flex: 1 }} />
        <div style={{
          width: 32, height: 32, borderRadius: 10, background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <KpiIcon name={icon} color={color} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 8 }}>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-.02em", color, lineHeight: 1 }}>{value}</div>
        {unit && <div style={{ fontSize: 13, color: PLX_TEXT, fontWeight: 600 }}>{unit}</div>}
      </div>
      {delta && (
        <div style={{
          marginTop: 8, fontSize: 10, fontWeight: 700, color,
          background: bg, display: "inline-block", padding: "2px 8px", borderRadius: 9999,
        }}>{delta}</div>
      )}
    </div>
  );
}

function KpiIcon({ name, color }) {
  const props = {
    width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: 1.8,
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (name) {
    case "box":      return <svg {...props}><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>;
    case "alert":    return <svg {...props}><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.7 3h16.96a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/></svg>;
    case "calendar": return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case "card":     return <svg {...props}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
    default:         return <svg {...props}><circle cx="12" cy="12" r="10"/></svg>;
  }
}

function KpiSkeleton() {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: `1px solid ${PLX_BORDER}`,
      padding: "16px 18px", height: 104,
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <SkelBlock w={90} h={11} />
        <div style={{ flex: 1 }} />
        <SkelBlock w={32} h={32} r={10} />
      </div>
      <div style={{ marginTop: 10 }}><SkelBlock w={80} h={26} /></div>
      <div style={{ marginTop: 10 }}><SkelBlock w={70} h={14} r={9999} /></div>
    </div>
  );
}

// ── Attention table ─────────────────────────────────────────────────────────

function AttentionTable({ rows }) {
  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "2.1fr 0.8fr 0.7fr 1fr 18px",
        padding: "10px 14px", fontSize: 10, fontWeight: 700, color: PLX_MUTED,
        background: PLX_GREEN_50, letterSpacing: ".03em",
        borderRadius: 8, marginBottom: 4,
      }}>
        <span>商品名</span><span>種別</span>
        <span style={{ textAlign: "right" }}>在庫</span>
        <span style={{ textAlign: "center" }}>状態</span>
        <span />
      </div>
      {rows.map((p, i) => {
        const days = daysUntil(p.expiry_date);
        const lowAvail = (p.total_available ?? 0) <= 10;
        return (
          <div key={p.id} onClick={() => navigate(`/products/${p.id}`)} style={{
            display: "grid", gridTemplateColumns: "2.1fr 0.8fr 0.7fr 1fr 18px",
            padding: "11px 14px", alignItems: "center", cursor: "pointer", borderRadius: 8,
            borderBottom: i < rows.length - 1 ? `1px solid ${PLX_BORDER}` : "none",
            fontSize: 12,
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = PLX_GREEN_50)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: PLX_GREEN_50,
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${PLX_BORDER}`,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN}
                  strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              </div>
              <div style={{
                minWidth: 0, fontWeight: 700,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{p.name}</div>
            </div>
            <span>
              {p.item_type === "consumable"
                ? <Pill color="#2563EB" bg={PLX_BLUE_LIGHT}>消耗品</Pill>
                : <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>物販</Pill>}
            </span>
            <span style={{
              textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700,
              color: lowAvail ? DASH_RED : PLX_TEXT,
            }}>{p.total_available ?? 0}
              <span style={{ fontSize: 10, color: PLX_MUTED, marginLeft: 2, fontWeight: 500 }}>個</span>
            </span>
            <span style={{ textAlign: "center" }}>
              {lowAvail && <Pill color={DASH_RED} bg={DASH_RED_LIGHT}>● 在庫低下</Pill>}
              {!lowAvail && days != null && days <= 30 && days >= 0 && <Pill color={DASH_AMBER} bg={DASH_AMBER_LIGHT}>あと {days} 日</Pill>}
              {!lowAvail && days != null && days < 0 && <Pill color={DASH_RED} bg={DASH_RED_LIGHT}>期限切れ</Pill>}
              {!lowAvail && (days == null || days > 30) && <Pill color={PLX_MUTED} bg="#F3F4F6">確認</Pill>}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={PLX_SUBTLE}
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function AttentionEmpty() {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%", background: PLX_GREEN_LIGHT,
        margin: "0 auto 12px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN}
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: PLX_TEXT, marginBottom: 4 }}>
        現在、対応が必要な商品はありません
      </div>
      <div style={{ fontSize: 11, color: PLX_MUTED, lineHeight: 1.6 }}>
        在庫水準・使用期限とも健全です 🎉
      </div>
    </div>
  );
}

function AttentionSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px" }}>
          <SkelBlock w={32} h={32} r={8} />
          <SkelBlock h={13} w={i % 2 ? "60%" : "75%"} />
          <div style={{ flex: 1 }} />
          <SkelBlock w={48} h={14} r={9999} />
          <SkelBlock w={70} h={14} r={9999} />
        </div>
      ))}
    </div>
  );
}

// ── Activity list — static mock for PoC ────────────────────────────────────
// TODO: wire to inventory_adjustments + audit log after demo.

function ActivityList() {
  const items = [
    { id: "a1", icon: "in",  text: "在庫調整: GUM デンタルブラシ #211 (+50)",   at: "09:42",      who: "田中 美咲" },
    { id: "a2", icon: "new", text: "新規商品登録: ホワイトニングジェル",          at: "昨日 17:08", who: "田中 美咲" },
    { id: "a3", icon: "ai",  text: "AI 自動入力使用: 3 件",                       at: "昨日 14:21", who: "田中 美咲" },
    { id: "a4", icon: "out", text: "診療使用: フィルテック スプリーム (-2)",      at: "昨日 11:33", who: "システム" },
    { id: "a5", icon: "po",  text: "発注書発行: PO-2026-0421 (3M ジャパン)",      at: "2 日前",     who: "田中 美咲" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((a, i) => (
        <div key={a.id} style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0",
          borderBottom: i < items.length - 1 ? `1px solid ${PLX_BORDER}` : "none",
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: PLX_GREEN_50,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, border: `1px solid ${PLX_GREEN_LIGHT}`,
          }}>
            <ActivityIcon name={a.icon} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: PLX_TEXT, lineHeight: 1.5 }}>{a.text}</div>
            <div style={{ fontSize: 10, color: PLX_MUTED, marginTop: 3 }}>{a.at} · {a.who}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityIcon({ name }) {
  const p = {
    width: 14, height: 14, viewBox: "0 0 24 24", fill: "none",
    stroke: PLX_GREEN, strokeWidth: 1.8,
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (name) {
    case "in":  return <svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/></svg>;
    case "out": return <svg {...p} stroke={DASH_AMBER}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>;
    case "new": return <svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case "ai":  return <svg {...p}><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z"/></svg>;
    case "po":  return <svg {...p}><rect x="1" y="6" width="14" height="11" rx="1.5"/><path d="M15 9h4l3 3v5h-7"/></svg>;
    default:    return <svg {...p}><circle cx="12" cy="12" r="10"/></svg>;
  }
}

function ActivitySkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SkelBlock w={30} h={30} r={9999} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            <SkelBlock h={12} w={i % 2 ? "75%" : "90%"} />
            <SkelBlock h={10} w="40%" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Category bars — static mock for PoC ────────────────────────────────────
// TODO: wire to /categories + variant aggregates after demo.

function CategoryBars() {
  const rows = [
    { name: "歯ブラシ",     total: 124, low: 1 },
    { name: "歯磨剤",       total: 88,  low: 2 },
    { name: "予防・歯磨剤", total: 412, low: 1 },
    { name: "麻酔",         total: 36,  low: 0 },
    { name: "消耗品",       total: 208, low: 1 },
    { name: "器具",         total: 54,  low: 0 },
  ];
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r) => (
        <div key={r.name} style={{
          display: "grid", gridTemplateColumns: "140px 1fr 90px",
          alignItems: "center", gap: 14, fontSize: 12,
        }}>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ height: 10, background: PLX_GREEN_50, borderRadius: 9999, position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${(r.total / max) * 100}%`,
              background: PLX_GREEN, borderRadius: 9999,
            }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{r.total}</span>
            <span style={{ fontSize: 10, color: PLX_MUTED }}>個</span>
            {r.low > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: DASH_RED,
                background: DASH_RED_LIGHT, padding: "2px 7px", borderRadius: 9999, marginLeft: 4,
              }}>低 {r.low}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CategorySkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "140px 1fr 90px",
          gap: 14, alignItems: "center",
        }}>
          <SkelBlock w="80%" h={12} />
          <SkelBlock h={10} r={9999} />
          <SkelBlock w="50%" h={12} />
        </div>
      ))}
    </div>
  );
}

// Shimmer skeleton primitive.
function SkelBlock({ w = "100%", h = 12, r = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)",
      backgroundSize: "400px 100%",
      animation: "plxshimmer 1.4s linear infinite",
    }} />
  );
}

window.Dashboard = Dashboard;
