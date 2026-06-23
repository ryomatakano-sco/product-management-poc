// 販売記録 — list of sales transactions.
//
// Backed by GET /sales (paginated list with payment_method filter) and
// GET /sales/summary (today / month count + revenue KPIs).
// Manual-entry modal, refund, and CSV export are still pending.

function SalesRecords({ query }) {
  const [paymentFilter, setPaymentFilter] = React.useState("");
  const salesQ = useFetch(
    () => api.listSales({ payment_method: paymentFilter || undefined, limit: 50 }),
    [paymentFilter],
  );
  const summaryQ = useFetch(() => api.getSalesSummary(), []);
  const items = salesQ.data?.items ?? [];
  const sum = summaryQ.data ?? { today_count: 0, today_revenue: "0", month_count: 0, month_revenue: "0" };
  const yen = (v) => "¥" + Number(v || 0).toLocaleString("ja-JP");
  const PM_LABEL = { cash: "現金", card: "カード", paypay: "PayPay", bank_transfer: "銀行振込" };
  const fmtDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const headerRight = (
    <button onClick={() => window.PLX_TOAST.warn("販売の手動入力は近日対応予定です")} style={{
      ...btnPrimary, display: "inline-flex", alignItems: "center", gap: 6,
    }}>＋ 手動入力</button>
  );

  return (
    <AdminShell currentNav="sales" breadcrumbs={["ホーム", "販売記録"]}>
      <PlxPageHead title="販売記録" subtitle="物販品・消耗品の販売トランザクション" right={headerRight} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
        <PlxKpiTile label="本日の販売件数" value={sum.today_count} unit="件" />
        <PlxKpiTile label="本日の売上" value={yen(sum.today_revenue)} unit="" />
        <PlxKpiTile label="今月の売上" value={yen(sum.month_revenue)} unit="" />
        <PlxKpiTile label="今月の販売件数" value={sum.month_count} unit="件" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: T.PLX_INK_500, fontWeight: 600 }}>支払方法</span>
        <PlxChip on={!paymentFilter}              onClick={() => setPaymentFilter("")}              label="すべて" />
        <PlxChip on={paymentFilter==="cash"}      onClick={() => setPaymentFilter("cash")}          label="現金" />
        <PlxChip on={paymentFilter==="card"}      onClick={() => setPaymentFilter("card")}          label="カード" />
        <PlxChip on={paymentFilter==="paypay"}    onClick={() => setPaymentFilter("paypay")}        label="PayPay" />
        <PlxChip on={paymentFilter==="bank_transfer"} onClick={() => setPaymentFilter("bank_transfer")} label="銀行振込" />
      </div>

      {salesQ.error && <PlxErrorBanner error={salesQ.error} onRetry={salesQ.refetch} />}

      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        boxShadow: T.SHADOW_SM, overflow: "hidden",
      }}>
        {salesQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
        {!salesQ.loading && items.length === 0 && (
          <div style={{ padding: 60 }}>
            <PlxEmptyState
              title="販売記録がまだありません"
              message="販売トランザクションを記録するか、別のフィルターをお試しください。"
            />
          </div>
        )}
        {!salesQ.loading && items.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.PLX_INK_050, color: T.PLX_INK_700, textAlign: "left" }}>
                <th style={{ padding: "10px 14px" }}>日時</th>
                <th style={{ padding: "10px 14px" }}>商品</th>
                <th style={{ padding: "10px 14px" }}>SKU</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>数量</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>単価</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>小計</th>
                <th style={{ padding: "10px 14px" }}>支払方法</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const subtotal = Number(s.unit_price) * Number(s.quantity);
                return (
                  <tr key={s.id} style={{ borderTop: `1px solid ${T.PLX_LINE_200}` }}>
                    <td style={{ padding: "10px 14px" }}>{fmtDateTime(s.sold_at)}</td>
                    <td style={{ padding: "10px 14px" }}>{s.product_name ?? `#${s.variant_id}`}</td>
                    <td style={{ padding: "10px 14px", color: T.PLX_INK_500 }}>{s.sku ?? "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{s.quantity}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{yen(s.unit_price)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{yen(subtotal)}</td>
                    <td style={{ padding: "10px 14px" }}>{PM_LABEL[s.payment_method] ?? s.payment_method ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

window.SalesRecords = SalesRecords;
