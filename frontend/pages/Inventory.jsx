// Inventory page — aggregate view of every product's stock + status.
// Brief §4.6 calls for KPI strip + filter card + quick-filter chips + table
// + history sub-section. The PoC backend has no per-branch stock yet, so
// branch filtering is accepted but doesn't change results (gracefully).

function Inventory({ query }) {
  const [statusFilter, setStatusFilter] = React.useState(query?.status || "");
  const [itemTypeFilter, setItemTypeFilter] = React.useState("");
  const [q, setQ] = React.useState("");

  const inventoryQ = useFetch(
    () => api.listInventory({
      status: statusFilter || undefined,
      item_type: itemTypeFilter || undefined,
      q: q || undefined,
      limit: 100,
    }),
    [statusFilter, itemTypeFilter, q],
  );

  const items = inventoryQ.data?.items ?? [];

  // KPI strip — compute from the loaded rows (acceptable for PoC scale).
  const kpis = React.useMemo(() => {
    const total = items.length;
    const lowStock = items.filter((r) => r.status === "low_stock").length;
    const expiring = items.filter((r) => r.status === "expiring_soon").length;
    const outOfStock = items.filter((r) => r.status === "out_of_stock").length;
    return { total, lowStock, expiring, outOfStock };
  }, [items]);

  const headerRight = (
    <a href="#/products/new" style={{
      ...btnPrimary, textDecoration: "none",
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>＋ 在庫調整</a>
  );

  return (
    <AdminShell currentNav="inventory" breadcrumbs={["ホーム", "在庫"]}>
      <PlxPageHead title="在庫" subtitle={`全 ${kpis.total} 件の在庫状況`} right={headerRight} />

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
        <KpiTile label="総在庫点数" value={items.reduce((s, r) => s + (r.on_hand || 0), 0)} unit="点" tone="green"/>
        <KpiTile label="在庫低下" value={kpis.lowStock} unit="件"
          tone={kpis.lowStock > 0 ? "amber" : "muted"}
          onClick={() => setStatusFilter("low_stock")} clickable/>
        <KpiTile label="期限間近" value={kpis.expiring} unit="件"
          tone={kpis.expiring > 0 ? "red" : "muted"}
          onClick={() => setStatusFilter("expiring_soon")} clickable/>
        <KpiTile label="在庫切れ" value={kpis.outOfStock} unit="件"
          tone={kpis.outOfStock > 0 ? "red" : "muted"}/>
      </div>

      {/* Filter card */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", marginBottom: 14,
      }}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="商品名・SKUで検索…" style={{ ...formInput, maxWidth: 280, flex: 1 }} />
        <Select value={itemTypeFilter} onChange={setItemTypeFilter} options={[
          { value: "", label: "すべての種別" },
          { value: "product", label: "物販品" },
          { value: "consumable", label: "消耗品" },
        ]} />
        <Select value={statusFilter} onChange={setStatusFilter} options={[
          { value: "", label: "すべての状態" },
          { value: "normal", label: "通常" },
          { value: "low_stock", label: "在庫低下" },
          { value: "expiring_soon", label: "期限間近" },
          { value: "out_of_stock", label: "在庫切れ" },
        ]} />
        <div style={{ flex: 1 }} />
        {(statusFilter || itemTypeFilter || q) && (
          <button onClick={() => { setStatusFilter(""); setItemTypeFilter(""); setQ(""); }}
            style={btnGhost}>フィルタをクリア</button>
        )}
      </div>

      {/* Quick-filter chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: T.PLX_INK_500, fontWeight: 600 }}>クイック</span>
        <Chip on={!statusFilter}                onClick={() => setStatusFilter("")} label={`すべて (${kpis.total})`} />
        <Chip on={statusFilter==="low_stock"}    onClick={() => setStatusFilter("low_stock")}
              label={`在庫低下 (${kpis.lowStock})`} tone="amber"/>
        <Chip on={statusFilter==="expiring_soon"} onClick={() => setStatusFilter("expiring_soon")}
              label={`期限間近 (${kpis.expiring})`} tone="red"/>
        <Chip on={statusFilter==="out_of_stock"} onClick={() => setStatusFilter("out_of_stock")}
              label={`在庫切れ (${kpis.outOfStock})`} tone="red"/>
      </div>

      {inventoryQ.error && <PlxErrorBanner error={inventoryQ.error} onRetry={inventoryQ.refetch} />}

      {/* Table */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        boxShadow: T.SHADOW_SM, overflow: "hidden",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "2.2fr 0.7fr 0.6fr 0.6fr 0.6fr 0.9fr 1fr 0.8fr",
          columnGap: 16,
          padding: "12px 18px", fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
          background: T.PLX_SURFACE_50, borderBottom: `1px solid ${T.PLX_LINE_200}`,
          letterSpacing: ".03em",
        }}>
          <span>商品 / SKU</span>
          <span>種別</span>
          <span style={{ textAlign: "right" }}>在庫</span>
          <span style={{ textAlign: "right" }}>引当</span>
          <span style={{ textAlign: "right" }}>利用可能</span>
          <span>使用期限</span>
          <span>最終調整</span>
          <span style={{ textAlign: "center" }}>状態</span>
        </div>

        {inventoryQ.loading && (
          <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>
        )}
        {!inventoryQ.loading && items.length === 0 && (
          <PlxEmptyState
            title="該当する在庫がありません"
            message="フィルタ条件を変更してお試しください。"
          />
        )}
        {items.map((r, i) => (
          <div key={`${r.product.id}-${i}`} onClick={() => navigate(`/products/${r.product.id}`)} style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 0.7fr 0.6fr 0.6fr 0.6fr 0.9fr 1fr 0.8fr",
            columnGap: 16,
            padding: "14px 18px", alignItems: "center", fontSize: 12,
            borderBottom: i < items.length - 1 ? `1px solid ${T.PLX_LINE_100}` : "none",
            cursor: "pointer",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = T.PLX_SURFACE_50}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <div>
              <div style={{ fontWeight: 600, color: T.PLX_INK_900 }}>{r.product.name}</div>
              <div style={{ fontSize: 10, color: T.PLX_INK_500, fontFamily: T.FONT_MONO, marginTop: 2 }}>
                {r.product.sku || "—"}
              </div>
            </div>
            <span>
              {r.product.item_type === "consumable"
                ? <Pill color="#2563EB" bg={PLX_BLUE_LIGHT}>消耗品</Pill>
                : <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>物販</Pill>}
            </span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600,
              color: r.on_hand === 0 ? T.PLX_RED_600 : T.PLX_INK_900 }}>{r.on_hand}</span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.PLX_INK_500 }}>{r.committed}</span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700,
              color: r.available <= 10 ? T.PLX_AMBER_600 : T.PLX_INK_900 }}>{r.available}</span>
            <span style={{ fontSize: 11, color: T.PLX_INK_500 }}>
              {r.earliest_expiry_date ? formatJpDate(r.earliest_expiry_date) : "—"}
            </span>
            <span style={{ fontSize: 11, color: T.PLX_INK_500 }}>
              {r.last_adjusted_at ? formatJpDateTime(r.last_adjusted_at) : "—"}
            </span>
            <span style={{ textAlign: "center" }}>
              <StatusBadge status={r.status} />
            </span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

function StatusBadge({ status }) {
  if (status === "low_stock")     return <Pill color={T.PLX_AMBER_600} bg={T.PLX_AMBER_100}>● 在庫低下</Pill>;
  if (status === "expiring_soon") return <Pill color={T.PLX_RED_600} bg={T.PLX_RED_100}>● 期限間近</Pill>;
  if (status === "out_of_stock")  return <Pill color={T.PLX_RED_600} bg={T.PLX_RED_100}>在庫切れ</Pill>;
  return <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>通常</Pill>;
}

function KpiTile({ label, value, unit, tone, onClick, clickable, extra }) {
  const color = tone === "red" ? T.PLX_RED_600 :
                tone === "amber" ? T.PLX_AMBER_600 :
                tone === "muted" ? T.PLX_INK_500 :
                T.PLX_GREEN_600;
  return (
    <div onClick={clickable ? onClick : undefined} style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG,
      border: `1px solid ${T.PLX_LINE_200}`, boxShadow: T.SHADOW_SM,
      padding: 18, cursor: clickable ? "pointer" : "default",
      transition: "transform .15s, box-shadow .15s",
    }}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = T.SHADOW_MD; } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = T.SHADOW_SM; } : undefined}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.PLX_INK_500 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: "-0.02em" }}>{value}</div>
        {unit && <div style={{ fontSize: 13, color: T.PLX_INK_700, fontWeight: 600 }}>{unit}</div>}
      </div>
      {extra && <div style={{ marginTop: 8 }}>{extra}</div>}
    </div>
  );
}

function Chip({ on, onClick, label, tone }) {
  const color = tone === "red" ? T.PLX_RED_600 :
                tone === "amber" ? T.PLX_AMBER_600 :
                T.PLX_GREEN_700;
  const bg = tone === "red" ? T.PLX_RED_100 :
             tone === "amber" ? T.PLX_AMBER_100 :
             T.PLX_GREEN_100;
  return (
    <button onClick={onClick} style={{
      fontSize: 12, fontWeight: 600, padding: "6px 12px",
      borderRadius: 9999,
      background: on ? bg : T.PLX_CARD_BG,
      color: on ? color : T.PLX_INK_700,
      border: `1px solid ${on ? color : T.PLX_LINE_200}`,
      cursor: "pointer",
    }}>{label}</button>
  );
}

// Tiny date formatter shared by Inventory + future pages.
function formatJpDateTime(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  } catch { return isoStr; }
}

window.Inventory = Inventory;
window.PlxKpiTile = KpiTile;
window.PlxChip = Chip;
window.formatJpDateTime = formatJpDateTime;
