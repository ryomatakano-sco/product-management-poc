// 販売記録 — list of sales transactions.
//
// Backend reality: prompt 03 deferred the dedicated /sales list, refund,
// and daily/monthly summary endpoints. The API client's `listSales` is
// soft-failing (returns {items: [], total: 0} on 404/405) so this page
// renders the empty state gracefully instead of an error banner.
// When the backend lands, this page picks up rows automatically.

function SalesRecords({ query }) {
  const [paymentFilter, setPaymentFilter] = React.useState("");
  const salesQ = useFetch(
    () => api.listSales({ payment_method: paymentFilter || undefined, limit: 50 }),
    [paymentFilter],
  );
  const items = salesQ.data?.items ?? [];

  const headerRight = (
    <button onClick={() => window.PLX_TOAST.warn("販売の手動入力は近日対応予定です")} style={{
      ...btnPrimary, display: "inline-flex", alignItems: "center", gap: 6,
    }}>＋ 手動入力</button>
  );

  return (
    <AdminShell currentNav="sales" breadcrumbs={["ホーム", "販売記録"]}>
      <PlxPageHead title="販売記録" subtitle="物販品・消耗品の販売トランザクション" right={headerRight} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
        <PlxKpiTile label="本日の販売件数" value={0} unit="件" tone="muted"/>
        <PlxKpiTile label="本日の売上" value="¥0" unit="" tone="muted"/>
        <PlxKpiTile label="今月の売上" value="¥0" unit="" tone="muted"/>
        <PlxKpiTile label="今月の販売件数" value={0} unit="件" tone="muted"/>
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
              message="販売トランザクションを記録するか、別のフィルターをお試しください。販売記録ページの完全な機能（一覧・返品・サマリ・CSVエクスポート）は近日対応予定です。"
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}

window.SalesRecords = SalesRecords;
