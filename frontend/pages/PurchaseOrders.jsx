// 発注書 list page — read-only table of POs.
// The backend has full PO CRUD + lifecycle (send/receive/cancel) but the
// design's detail page is out of scope this round; we render a compact
// list with status chips and KPI strip. Row click opens the detail page
// at #/purchase-orders/:id (handled by PurchaseOrderDetail.jsx).

function PurchaseOrders() {
  const [statusFilter, setStatusFilter] = React.useState("");
  const posQ = useFetch(
    () => api.listPurchaseOrders({ status: statusFilter || undefined, limit: 100 }),
    [statusFilter],
  );
  const rows = posQ.data?.items ?? [];

  // KPI strip — count by status from the loaded rows.
  const kpis = React.useMemo(() => {
    const c = (s) => rows.filter((r) => r.status === s).length;
    const sumTotal = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    return {
      total: rows.length,
      draft: c("draft"),
      sent: c("ordered"),
      partial: c("partially_received"),
      received: c("received"),
      cancelled: c("cancelled"),
      sumTotal,
    };
  }, [rows]);

  const headerRight = (
    <button onClick={() => window.PLX_TOAST.warn("発注書の新規作成は近日対応予定です")} style={{
      ...btnPrimary, display: "inline-flex", alignItems: "center", gap: 6,
    }}>＋ 発注書を作成</button>
  );

  return (
    <AdminShell currentNav="po" breadcrumbs={["ホーム", "発注書"]}>
      <PlxPageHead title="発注書" subtitle={`全 ${kpis.total} 件の発注書`} right={headerRight} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
        <PlxKpiTile label="今月の発注件数" value={kpis.total} unit="件" tone="green"/>
        <PlxKpiTile label="今月の発注金額" value={`¥${formatYen(kpis.sumTotal)}`} unit="" tone="green"/>
        <PlxKpiTile label="入荷待ち（送信済）" value={kpis.sent} unit="件" tone={kpis.sent > 0 ? "amber" : "muted"}/>
        <PlxKpiTile label="一部入荷" value={kpis.partial} unit="件" tone={kpis.partial > 0 ? "amber" : "muted"}/>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: T.PLX_INK_500, fontWeight: 600 }}>状態</span>
        <PlxChip on={!statusFilter}                       onClick={() => setStatusFilter("")} label={`すべて (${kpis.total})`} />
        <PlxChip on={statusFilter==="draft"}              onClick={() => setStatusFilter("draft")}              label={`下書き (${kpis.draft})`}/>
        <PlxChip on={statusFilter==="ordered"}            onClick={() => setStatusFilter("ordered")}            label={`送信済 (${kpis.sent})`}/>
        <PlxChip on={statusFilter==="partially_received"} onClick={() => setStatusFilter("partially_received")} label={`一部入荷 (${kpis.partial})`} tone="amber"/>
        <PlxChip on={statusFilter==="received"}           onClick={() => setStatusFilter("received")}           label={`入荷済 (${kpis.received})`}/>
        <PlxChip on={statusFilter==="cancelled"}          onClick={() => setStatusFilter("cancelled")}          label={`キャンセル (${kpis.cancelled})`} tone="red"/>
      </div>

      {posQ.error && <PlxErrorBanner error={posQ.error} onRetry={posQ.refetch} />}

      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        boxShadow: T.SHADOW_SM, overflow: "hidden",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr 1fr 0.7fr 1fr 0.9fr",
          padding: "12px 18px", fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
          background: T.PLX_SURFACE_50, borderBottom: `1px solid ${T.PLX_LINE_200}`,
        }}>
          <span>発注番号</span><span>仕入先</span><span>納品予定日</span>
          <span>品目数</span><span style={{ textAlign: "right" }}>合計</span>
          <span>担当</span><span style={{ textAlign: "center" }}>状態</span>
        </div>

        {posQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
        {!posQ.loading && rows.length === 0 && (
          <PlxEmptyState title="該当する発注書がありません" message="新しい発注書を作成するか、フィルタを変更してください。" />
        )}
        {rows.map((po, i) => (
          <div key={po.id} onClick={() => navigate(`/purchase-orders/${po.id}`)} style={{
            display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr 1fr 0.7fr 1fr 0.9fr",
            padding: "14px 18px", alignItems: "center", fontSize: 12,
            borderBottom: i < rows.length - 1 ? `1px solid ${T.PLX_LINE_100}` : "none", cursor: "pointer",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = T.PLX_SURFACE_50}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <span style={{ fontFamily: T.FONT_MONO, fontWeight: 700 }}>PO-{String(po.id).padStart(6, "0")}</span>
            <span>{po.supplier_name || "—"}</span>
            <span style={{ fontSize: 11 }}>{po.estimated_arrival ? formatJpDate(po.estimated_arrival) : "—"}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{po.items?.length ?? 0}</span>
            <span style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>¥{formatYen(po.total)}</span>
            <span style={{ fontSize: 11, color: T.PLX_INK_500 }}>{po.branch_name || "—"}</span>
            <span style={{ textAlign: "center" }}><POStatusPill status={po.status} /></span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

function POStatusPill({ status }) {
  switch (status) {
    case "draft":              return <Pill color={T.PLX_INK_500}  bg={T.PLX_SURFACE_100}>下書き</Pill>;
    case "ordered":            return <Pill color={T.PLX_BLUE_600} bg={T.PLX_BLUE_100}>送信済</Pill>;
    case "partially_received": return <Pill color={T.PLX_AMBER_600} bg={T.PLX_AMBER_100}>一部入荷</Pill>;
    case "received":           return <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>入荷済</Pill>;
    case "cancelled":          return <Pill color={T.PLX_RED_600}   bg={T.PLX_RED_100}>キャンセル</Pill>;
    default:                   return <Pill color={T.PLX_INK_500}   bg={T.PLX_SURFACE_100}>{status}</Pill>;
  }
}

// Detail page — stub for now: load PO, show hero + status timeline + line items.
function PurchaseOrderDetail({ id }) {
  const poQ = useFetch(() => api.getPurchaseOrder(Number(id)), [id]);
  const po = poQ.data;
  return (
    <AdminShell currentNav="po"
      breadcrumbs={["ホーム", "発注書", po ? `PO-${String(po.id).padStart(6, "0")}` : "..."]}>
      {poQ.error && <PlxErrorBanner error={poQ.error} onRetry={poQ.refetch} />}
      {poQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
      {po && (
        <>
          <button onClick={() => navigate("/purchase-orders")} style={{
            background: "none", border: "none", color: T.PLX_INK_500,
            fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14,
          }}>← 発注書一覧へ戻る</button>

          <div style={{
            background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
            boxShadow: T.SHADOW_SM, padding: 24, marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontFamily: T.FONT_MONO, fontWeight: 700 }}>
                PO-{String(po.id).padStart(6, "0")}
              </h2>
              <POStatusPill status={po.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
              <DetailKV k="仕入先" v={po.supplier_name || "—"} />
              <DetailKV k="納品予定日" v={po.estimated_arrival ? formatJpDate(po.estimated_arrival) : "—"} />
              <DetailKV k="拠点" v={po.branch_name || "—"} />
              <DetailKV k="合計" v={`¥${formatYen(po.total)}`} />
            </div>
            {po.note && (
              <div style={{ marginTop: 14, padding: 12, background: T.PLX_SURFACE_50, borderRadius: T.RADIUS_MD, fontSize: 13 }}>
                {po.note}
              </div>
            )}
          </div>

          {/* Line items */}
          <div style={{
            background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
            boxShadow: T.SHADOW_SM, overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 18px", fontSize: 14, fontWeight: 700,
              borderBottom: `1px solid ${T.PLX_LINE_200}`,
            }}>商品一覧 ({(po.items || []).length} 件)</div>
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 0.7fr 0.7fr 0.7fr 0.7fr",
              padding: "10px 18px", fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
              background: T.PLX_SURFACE_50,
            }}>
              <span>商品</span>
              <span style={{ textAlign: "right" }}>発注数</span>
              <span style={{ textAlign: "right" }}>入荷済</span>
              <span style={{ textAlign: "right" }}>単価</span>
              <span style={{ textAlign: "right" }}>合計</span>
            </div>
            {(po.items || []).map((it, i) => (
              <div key={it.id} style={{
                display: "grid", gridTemplateColumns: "2fr 0.7fr 0.7fr 0.7fr 0.7fr",
                padding: "12px 18px", fontSize: 12, alignItems: "center",
                borderBottom: i < po.items.length - 1 ? `1px solid ${T.PLX_LINE_100}` : "none",
              }}>
                <span>{it.variant_id /* PoC: backend returns variant_id not name yet */}</span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.quantity_ordered}</span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums",
                  color: it.quantity_received >= it.quantity_ordered ? T.PLX_GREEN_700 : T.PLX_INK_500 }}>
                  {it.quantity_received}
                </span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{formatYen(it.unit_cost)}</span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>¥{formatYen(it.line_total)}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, padding: 14, background: T.PLX_BLUE_100, borderRadius: T.RADIUS_MD, fontSize: 12, color: T.PLX_BLUE_600 }}>
            送信・入荷記録・キャンセルなどの操作は近日対応予定です。
          </div>
        </>
      )}
    </AdminShell>
  );
}

function DetailKV({ k, v }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: T.PLX_INK_500, fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.PLX_INK_900, marginTop: 4 }}>{v}</div>
    </div>
  );
}

window.PurchaseOrders = PurchaseOrders;
window.PurchaseOrderDetail = PurchaseOrderDetail;
window.PlxDetailKV = DetailKV;
