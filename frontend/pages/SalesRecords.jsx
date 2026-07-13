// 販売記録 — list of sales transactions.
//
// Backed by GET /sales (paginated list with payment_method filter) and
// GET /sales/summary (today / month count + revenue KPIs).
// Manual-entry modal, refund, and CSV export are still pending.

// JST day boundaries for the 期間 filter — return {date_from, date_to} in ISO.
function periodRange(preset) {
  const JST_OFFSET = 9 * 60; // minutes
  const now = new Date();
  const nowJst = new Date(now.getTime() + (JST_OFFSET - now.getTimezoneOffset()) * 60000);
  const jstMidnight = new Date(nowJst.getFullYear(), nowJst.getMonth(), nowJst.getDate());
  const asJstIso = (d) => {
    const tzShift = new Date(d.getTime() - (JST_OFFSET - now.getTimezoneOffset()) * 60000);
    return tzShift.toISOString();
  };
  const day = (offset) => new Date(jstMidnight.getTime() + offset * 86400000);
  switch (preset) {
    case "today":       return { date_from: asJstIso(jstMidnight), date_to: asJstIso(day(1)) };
    case "yesterday":   return { date_from: asJstIso(day(-1)),      date_to: asJstIso(jstMidnight) };
    case "last7":       return { date_from: asJstIso(day(-7)),      date_to: asJstIso(day(1)) };
    case "this_month":  return { date_from: asJstIso(new Date(nowJst.getFullYear(), nowJst.getMonth(), 1)), date_to: asJstIso(day(1)) };
    case "last_month":  return {
      date_from: asJstIso(new Date(nowJst.getFullYear(), nowJst.getMonth() - 1, 1)),
      date_to:   asJstIso(new Date(nowJst.getFullYear(), nowJst.getMonth(), 1)),
    };
    default:            return {};
  }
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function SalesRecords({ query, initialSaleId }) {
  const [showManualEntry, setShowManualEntry] = React.useState(false);
  // Deep link `#/sales/12` lands here with initialSaleId — open its detail modal.
  const [detailId, setDetailId]     = React.useState(initialSaleId || null);
  const [period, setPeriod]         = React.useState("today");
  const [branchFilter, setBranchFilter] = React.useState("");
  const [paymentFilter, setPaymentFilter] = React.useState("");
  const [staffFilter, setStaffFilter] = React.useState("");
  const [patientFilter, setPatientFilter] = React.useState(""); // "" | "yes" | "no"
  const [searchQ, setSearchQ]       = React.useState("");
  const [page, setPage]             = React.useState(1);
  const [pageSize, setPageSize]     = React.useState(25);
  const [exporting, setExporting]   = React.useState(false);

  // Debounce search input so re-fetch doesn't fire on every keystroke.
  const [searchQDeb, setSearchQDeb] = React.useState("");
  React.useEffect(() => {
    const h = setTimeout(() => setSearchQDeb(searchQ.trim()), 300);
    return () => clearTimeout(h);
  }, [searchQ]);

  // Reset to page 1 when filters change.
  React.useEffect(() => { setPage(1); }, [period, branchFilter, paymentFilter, staffFilter, patientFilter, searchQDeb, pageSize]);

  const branchesQ = useFetch(() => api.listBranches(), []);
  const branches = branchesQ.data?.items ?? [];
  const staffQ = useFetch(() => api.listSalesStaff(), []);
  const staffList = staffQ.data ?? [];

  const listParams = () => {
    const { date_from, date_to } = periodRange(period);
    return {
      date_from, date_to,
      branch_id: branchFilter || undefined,
      payment_method: paymentFilter || undefined,
      sold_by: staffFilter || undefined,
      has_patient: patientFilter === "yes" ? true : patientFilter === "no" ? false : undefined,
      q: searchQDeb || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
  };

  const salesQ = useFetch(
    () => api.listSales(listParams()),
    [period, branchFilter, paymentFilter, staffFilter, patientFilter, searchQDeb, page, pageSize],
  );
  const summaryQ = useFetch(() => api.getSalesSummary(), []);
  const items = salesQ.data?.items ?? [];
  const totalRows = salesQ.data?.total ?? 0;
  const sum = summaryQ.data ?? {
    today_count: 0, today_revenue: "0", yesterday_count: 0, yesterday_revenue: "0",
    month_count: 0, month_revenue: "0", last_month_count: 0, last_month_revenue: "0",
  };
  const yen = (v) => "¥" + Number(v || 0).toLocaleString("ja-JP");

  // Delta chip renderer: absolute delta for counts, % for revenue.
  const deltaChip = (curr, prev, opts = {}) => {
    const c = Number(curr || 0), p = Number(prev || 0);
    let text, tone;
    if (opts.pct) {
      if (p === 0) return null;
      const d = Math.round(((c - p) / p) * 100);
      text = `${d >= 0 ? "+" : ""}${d}% ${opts.label}`;
      tone = d >= 0;
    } else {
      const d = c - p;
      text = `${d >= 0 ? "+" : ""}${d} ${opts.label}`;
      tone = d >= 0;
    }
    return (
      <span style={{
        display: "inline-block", padding: "2px 8px", borderRadius: 9999,
        fontSize: 10, fontWeight: 700,
        background: tone ? T.PLX_GREEN_050 : T.PLX_RED_100,
        color:      tone ? T.PLX_GREEN_700 : T.PLX_RED_600,
      }}>{text}</span>
    );
  };
  const PM_LABEL = { cash: "現金", card: "カード", paypay: "PayPay", bank_transfer: "銀行振込" };
  const PM_TONE = {
    cash:          { bg: T.PLX_SURFACE_50,   fg: T.PLX_INK_700, bd: T.PLX_LINE_200 },
    card:          { bg: T.PLX_BLUE_100,     fg: T.PLX_BLUE_600, bd: T.PLX_BLUE_600 },
    paypay:        { bg: T.PLX_RED_100,      fg: T.PLX_RED_600,  bd: T.PLX_RED_600 },
    bank_transfer: { bg: T.PLX_PURPLE_100,   fg: T.PLX_PURPLE_600, bd: T.PLX_PURPLE_600 },
  };
  const PmChip = ({ method }) => {
    const t = PM_TONE[method] ?? PM_TONE.cash;
    return (
      <span style={{
        display: "inline-block", padding: "3px 10px", borderRadius: 9999,
        fontSize: 11, fontWeight: 700, background: t.bg, color: t.fg,
        border: `1px solid ${t.bd}20`, whiteSpace: "nowrap",
      }}>{PM_LABEL[method] ?? method ?? "—"}</span>
    );
  };
  const fmtDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const [refundTarget, setRefundTarget] = React.useState(null);
  const onRefund = (sale) => setRefundTarget(sale);
  const onRefunded = () => {
    setRefundTarget(null);
    salesQ.refetch();
    summaryQ.refetch();
  };

  const onExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const p = listParams();
      delete p.limit; delete p.offset;
      await api.downloadSalesCsv(p);
    } catch (e) {
      window.PLX_TOAST?.error("CSVエクスポートに失敗しました");
    } finally {
      setExporting(false);
    }
  };

  const headerRight = (
    <div style={{ display: "inline-flex", gap: 8 }}>
      <button onClick={onExport} disabled={exporting} style={{
        ...btnSecondary, display: "inline-flex", alignItems: "center", gap: 6,
        opacity: exporting ? 0.6 : 1,
      }}>
        {exporting ? "書き出し中…" : "⬇ CSVエクスポート"}
      </button>
      <button onClick={() => setShowManualEntry(true)} style={{
        ...btnPrimary, display: "inline-flex", alignItems: "center", gap: 6,
      }}>＋ 手動入力</button>
    </div>
  );

  return (
    <AdminShell currentNav="sales" breadcrumbs={["ホーム", "販売記録"]}>
      <PlxPageHead title="販売記録" subtitle="物販・消耗品の販売トランザクション" right={headerRight} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        <SalesKpi label="本日の販売件数"    value={sum.today_count} unit="件"
          delta={deltaChip(sum.today_count, sum.yesterday_count, { label: "昨日比" })} />
        <SalesKpi label="本日の売上 (税込)" value={yen(sum.today_revenue)}
          delta={deltaChip(sum.today_revenue, sum.yesterday_revenue, { pct: true, label: "昨日比" })} />
        <SalesKpi label="今月の売上 (税込)" value={yen(sum.month_revenue)}
          delta={deltaChip(sum.month_revenue, sum.last_month_revenue, { pct: true, label: "先月比" })} />
        <SalesKpi label="今月の販売件数"    value={sum.month_count} unit="件"
          delta={deltaChip(sum.month_count, sum.last_month_count, { pct: true, label: "先月比" })} />
      </div>

      {/* Filter bar — 5 dropdowns + search */}
      <div style={{
        background: T.PLX_CARD_BG, border: `1px solid ${T.PLX_LINE_200}`,
        borderRadius: T.RADIUS_LG, padding: "12px 16px", marginBottom: 12,
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
      }}>
        <SalesFilterSelect label="期間" value={period} onChange={setPeriod} options={[
          { value: "today",      label: "本日" },
          { value: "yesterday",  label: "昨日" },
          { value: "last7",      label: "過去7日" },
          { value: "this_month", label: "今月" },
          { value: "last_month", label: "先月" },
          { value: "",           label: "全期間" },
        ]} />
        <SalesFilterSelect label="拠点" value={branchFilter} onChange={setBranchFilter} options={[
          { value: "", label: "すべて" },
          ...branches.map(b => ({ value: String(b.id), label: b.name })),
        ]} />
        <SalesFilterSelect label="支払方法" value={paymentFilter} onChange={setPaymentFilter} options={[
          { value: "",              label: "すべて" },
          { value: "cash",          label: "現金" },
          { value: "card",          label: "カード" },
          { value: "paypay",        label: "PayPay" },
          { value: "bank_transfer", label: "銀行振込" },
        ]} />
        <SalesFilterSelect label="担当者" value={staffFilter} onChange={setStaffFilter} options={[
          { value: "", label: "すべて" },
          ...staffList.map(s => ({ value: s, label: s })),
        ]} />
        <SalesFilterSelect label="患者紐付け" value={patientFilter} onChange={setPatientFilter} options={[
          { value: "",    label: "すべて" },
          { value: "yes", label: "紐付けあり" },
          { value: "no",  label: "紐付けなし" },
        ]} />
        <input
          type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
          placeholder="商品名・SKUで検索"
          style={{ ...formInput, width: 240, height: 34, fontSize: 12, marginLeft: "auto" }}
        />
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.PLX_SURFACE_50, color: T.PLX_INK_500,
                fontSize: 10, fontWeight: 700, textAlign: "left",
                textTransform: "uppercase", letterSpacing: "0.02em" }}>
                <th style={{ padding: "10px 14px" }}>日時</th>
                <th style={{ padding: "10px 14px" }}>取引ID</th>
                <th style={{ padding: "10px 14px" }}>商品</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>数量</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>合計 (税込)</th>
                <th style={{ padding: "10px 14px" }}>支払方法</th>
                <th style={{ padding: "10px 14px" }}>担当者</th>
                <th style={{ padding: "10px 14px" }}>患者</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => {
                const total = Number(s.unit_price) * Number(s.quantity);
                const isRefund = s.refund_of_sale_id != null || s.quantity < 0;
                const isRefunded = s.refunded_at != null;
                const negativeStyle = total < 0
                  ? { color: T.PLX_RED_600 }
                  : {};
                return (
                  <tr key={s.id} style={{
                    borderTop: `1px solid ${T.PLX_LINE_100}`,
                    background: i % 2 === 0 ? T.PLX_SURFACE_50 : "transparent",
                  }}>
                    <td style={{ padding: "11px 14px", color: T.PLX_INK_700, whiteSpace: "nowrap" }}>{fmtDateTime(s.sold_at)}</td>
                    <td style={{ padding: "11px 14px", fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                      color: T.PLX_GREEN_700, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {s.transaction_id ?? "—"}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {isRefund && (
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 9999,
                          fontSize: 10, fontWeight: 700, marginRight: 8,
                          background: T.PLX_RED_100, color: T.PLX_RED_600,
                        }}>返品</span>
                      )}
                      <span>{s.product_name ?? `#${s.variant_id}`}</span>
                      {s.sku && (
                        <div style={{ fontSize: 10, color: T.PLX_INK_500, marginTop: 2 }}>{s.sku}</div>
                      )}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", ...negativeStyle }}>{s.quantity}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", ...negativeStyle }}>{yen(total)}</td>
                    <td style={{ padding: "11px 14px" }}><PmChip method={s.payment_method} /></td>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                      {s.sold_by ? s.sold_by : <span style={{ color: T.PLX_INK_400 }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                      {s.patient_ref
                        ? <span style={{ color: T.PLX_GREEN_700, fontWeight: 500 }}>{s.patient_ref} さま</span>
                        : <span style={{ color: T.PLX_INK_400 }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button" onClick={() => setDetailId(s.id)}
                        style={{
                          background: "transparent", border: "none", cursor: "pointer",
                          color: T.PLX_INK_700, fontSize: 12, fontWeight: 500, padding: 0,
                          marginRight: 10,
                        }}
                      >詳細</button>
                      {!isRefund && !isRefunded && (
                        <button
                          type="button" onClick={() => onRefund(s)}
                          style={{
                            background: "transparent", border: "none", cursor: "pointer",
                            color: T.PLX_RED_600, fontSize: 12, fontWeight: 500, padding: 0,
                          }}
                        >返品</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination footer — only render when we actually have rows or the total says there are more pages */}
        {!salesQ.loading && totalRows > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 14px", borderTop: `1px solid ${T.PLX_LINE_100}`,
            fontSize: 11, color: T.PLX_INK_700,
          }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.PLX_INK_500 }}>
              <span>表示件数</span>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{
                height: 30, padding: "0 8px", fontSize: 12,
                border: `1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_MD, background: T.PLX_CARD_BG,
              }}>
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span>{`${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, totalRows)} 件 / 全 ${totalRows} 件`}</span>
              <button
                type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ ...btnSecondary, height: 30, padding: "0 12px", opacity: page <= 1 ? 0.5 : 1 }}
              >← 前へ</button>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 30, height: 30, padding: "0 10px", borderRadius: T.RADIUS_MD,
                background: T.PLX_GREEN_100, color: T.PLX_GREEN_700, fontWeight: 700,
              }}>{page}</span>
              <button
                type="button" onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= totalRows}
                style={{ ...btnSecondary, height: 30, padding: "0 12px",
                  opacity: page * pageSize >= totalRows ? 0.5 : 1 }}
              >次へ →</button>
            </div>
          </div>
        )}
      </div>

      {showManualEntry && (
        <ManualSaleModal
          onClose={() => setShowManualEntry(false)}
          onSaved={() => {
            setShowManualEntry(false);
            window.PLX_TOAST?.success("販売を記録しました");
            salesQ.refetch();
            summaryQ.refetch();
            staffQ.refetch();
          }}
        />
      )}
      {refundTarget && (
        <RefundReasonModal
          sale={refundTarget}
          onClose={() => setRefundTarget(null)}
          onDone={onRefunded}
        />
      )}
      {detailId != null && (
        <SaleDetailModal
          saleId={detailId}
          onClose={() => setDetailId(null)}
          onRefunded={() => { salesQ.refetch(); summaryQ.refetch(); }}
        />
      )}
    </AdminShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 販売の手動入力 modal — POST /sales form with variant typeahead, payment
// method chips, optional sold_at + note. Matches the design tab mockup.
// ───────────────────────────────────────────────────────────────────────────

function ManualSaleModal({ onClose, onSaved, initialProduct }) {
  // initialProduct (optional): { variant_id, name, sku, on_hand, price } —
  // passed by the product-detail quick-sale button to skip the typeahead.
  const branchesQ = useFetch(() => api.listBranches(), []);
  const branches = branchesQ.data?.items ?? [];

  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);

  const [selected, setSelected] = React.useState(initialProduct || null); // { variant_id, name, sku, on_hand, price }
  const [branchId, setBranchId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [unitPrice, setUnitPrice] = React.useState(initialProduct?.price != null ? Number(initialProduct.price) : 0);
  const [paymentMethod, setPaymentMethod] = React.useState("cash");
  // 担当者 prefilled from the logged-in user (auth heavy-tier item 1).
  const [soldBy, setSoldBy]   = React.useState(window.PLX_ME?.display_name || "");
  const [patientRef, setPatientRef] = React.useState("");
  const [soldAt, setSoldAt]   = React.useState("");
  const [note, setNote]       = React.useState("");

  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  // Default branch = first branch once loaded.
  React.useEffect(() => {
    if (!branchId && branches.length > 0) setBranchId(String(branches[0].id));
  }, [branches, branchId]);

  // Debounced search. `cancelled` guards against an out-of-order response
  // from an in-flight request when the query changes mid-flight.
  React.useEffect(() => {
    if (!q.trim()) {
      setResults([]); setShowResults(false); setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const handle = setTimeout(() => {
      api.searchProducts(q.trim(), { status: "active" })
        .then((rs) => { if (!cancelled) { setResults(rs || []); setShowResults(true); } })
        .catch(() => { if (!cancelled) { setResults([]); setShowResults(true); } })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [q]);

  const PM_OPTIONS = [
    { value: "cash",          label: "現金" },
    { value: "card",          label: "カード" },
    { value: "paypay",        label: "PayPay" },
    { value: "bank_transfer", label: "銀行振込" },
  ];

  const subtotal = Number(unitPrice || 0) * Number(quantity || 0);
  const yen = (v) => "¥" + Number(v || 0).toLocaleString("ja-JP");

  const insufficientStock = selected && Number(quantity) > Number(selected.on_hand);
  const outOfStock = selected && Number(selected.on_hand) <= 0;

  const pickResult = (r) => {
    const v = r.default_variant;
    if (!v) return;
    setSelected({
      variant_id: v.id,
      name: r.name,
      sku: v.sku,
      on_hand: v.on_hand,
      price: Number(v.price),
    });
    setUnitPrice(Number(v.price));
    setQ("");
    setShowResults(false);
    setErrors((e) => ({ ...e, variant_id: undefined }));
  };

  const clearSelected = () => {
    setSelected(null);
    setUnitPrice(0);
  };

  const validate = () => {
    const e = {};
    if (!selected) e.variant_id = "商品を選択してください";
    if (!branchId) e.branch_id = "店舗を選択してください";
    if (!quantity || Number(quantity) < 1) e.quantity = "1以上を入力してください";
    if (unitPrice === "" || Number(unitPrice) < 0) e.unit_price = "0以上を入力してください";
    if (selected && Number(quantity) > Number(selected.on_hand)) {
      e.quantity = selected.on_hand > 0
        ? `在庫が不足しています（残り ${selected.on_hand}個）`
        : "在庫切れのため販売できません";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    const body = {
      branch_id: Number(branchId),
      variant_id: selected.variant_id,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
      payment_method: paymentMethod,
    };
    if (soldAt) body.sold_at = new Date(soldAt).toISOString();
    if (soldBy.trim()) body.sold_by = soldBy.trim();
    if (patientRef.trim()) body.patient_ref = patientRef.trim();
    if (note.trim()) body.note = note.trim();
    try {
      await api.createSale(body);
      onSaved();
    } catch (err) {
      const msg = err?.body?.detail || err?.message || "保存に失敗しました";
      window.PLX_TOAST?.error(typeof msg === "string" ? msg : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // ── small reusable bits ─────────────────────────────────────────────────
  const labelStyle = { fontSize: 12, fontWeight: 700, color: T.PLX_INK_700, display: "block", marginBottom: 6 };
  const reqStar = <span style={{ color: "#DC2626", marginLeft: 4 }}>*</span>;
  const errText = (msg) => msg ? (
    <div style={{ fontSize: 11, color: "#DC2626", marginTop: 5, fontWeight: 600 }}>① {msg}</div>
  ) : null;
  const stockBadge = (n) => {
    const isLow = Number(n) <= 10;
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 9999,
        background: isLow ? "#FEF3C7" : T.PLX_SURFACE_50,
        color: isLow ? "#B45309" : T.PLX_INK_700,
        whiteSpace: "nowrap",
      }}>在庫 {n}</span>
    );
  };

  return (
    <PlxModal title="販売の手動入力" onClose={onClose}>
      <div style={{ fontSize: 11, color: T.PLX_GREEN_700, fontWeight: 700, letterSpacing: "0.04em", marginTop: -10, marginBottom: 14 }}>
        販売記録
      </div>

      {/* 商品 */}
      <div style={{ marginBottom: 16, position: "relative" }}>
        <label style={labelStyle}>商品{reqStar}</label>
        {!selected && (
          <>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                color: T.PLX_INK_500, fontSize: 14,
              }}>🔍</span>
              <input
                type="text" value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => results.length > 0 && setShowResults(true)}
                placeholder="商品名 または SKU で検索"
                style={{
                  ...formInput, paddingLeft: 36,
                  borderColor: errors.variant_id ? "#DC2626" : undefined,
                }}
              />
            </div>
            {showResults && (
              <div style={{
                position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4,
                background: T.PLX_CARD_BG, border: `1px solid ${T.PLX_LINE_200}`,
                borderRadius: T.RADIUS_MD, boxShadow: T.SHADOW_LG, zIndex: 10,
                maxHeight: 280, overflowY: "auto",
              }}>
                {searching && (
                  <div style={{ padding: 14, color: T.PLX_INK_500, fontSize: 12, textAlign: "center" }}>検索中…</div>
                )}
                {!searching && results.length === 0 && (
                  <div style={{ padding: 14, color: T.PLX_INK_500, fontSize: 12, textAlign: "center" }}>
                    該当する商品がありません
                  </div>
                )}
                {!searching && results.map((r) => (
                  <button key={r.id} type="button" onClick={() => pickResult(r)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", background: "transparent", border: "none",
                    borderBottom: `1px solid ${T.PLX_LINE_200}`, cursor: "pointer", textAlign: "left",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.PLX_INK_900 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: T.PLX_INK_500, marginTop: 2 }}>
                        {r.default_variant?.sku ?? "—"} ・ {yen(r.default_variant?.price)}
                      </div>
                    </div>
                    {r.default_variant && stockBadge(r.default_variant.on_hand)}
                  </button>
                ))}
              </div>
            )}
            {errText(errors.variant_id)}
          </>
        )}
        {selected && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", border: `1px solid ${T.PLX_GREEN_300}`,
            borderRadius: T.RADIUS_MD, background: T.PLX_GREEN_050,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.PLX_INK_900 }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: T.PLX_INK_500, marginTop: 2 }}>{selected.sku ?? "—"}</div>
            </div>
            {stockBadge(selected.on_hand)}
            <button type="button" onClick={clearSelected} aria-label="商品を解除" style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 18, color: T.PLX_INK_500, padding: "0 4px",
            }}>×</button>
          </div>
        )}
      </div>

      {/* 店舗 — hidden when there's only one branch */}
      {branches.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>店舗{reqStar}</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={formInput}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {errText(errors.branch_id)}
        </div>
      )}

      {/* 数量 + 単価 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>数量{reqStar}</label>
          <div style={{ position: "relative" }}>
            <input
              type="number" min={1} value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{ ...formInput, textAlign: "right", paddingRight: 36 }}
            />
            <span style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              color: T.PLX_INK_500, fontSize: 12,
            }}>個</span>
          </div>
          {errText(errors.quantity)}
        </div>
        <div>
          <label style={labelStyle}>単価{reqStar}</label>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: T.PLX_INK_500, fontSize: 12,
            }}>¥</span>
            <input
              type="number" min={0} value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              style={{ ...formInput, textAlign: "right", paddingLeft: 26 }}
            />
          </div>
          {errText(errors.unit_price)}
        </div>
      </div>

      {/* 在庫不足警告 — hard block: Save button is disabled below */}
      {insufficientStock && (
        <div style={{
          fontSize: 11, color: "#DC2626", fontWeight: 600, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          ⚠ {selected.on_hand > 0
            ? `在庫が不足しています（残り ${selected.on_hand}個）`
            : "在庫切れのため販売できません"}
        </div>
      )}

      {/* 小計 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 18px", background: T.PLX_SURFACE_50,
        borderRadius: T.RADIUS_MD, marginBottom: 18,
      }}>
        <span style={{ fontSize: 13, color: T.PLX_INK_700, fontWeight: 600 }}>小計</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: T.PLX_INK_900 }}>{yen(subtotal)}</span>
      </div>

      {/* 支払方法 — green-tinted pill when active */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>支払方法{reqStar}</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PM_OPTIONS.map((opt) => {
            const on = paymentMethod === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentMethod(opt.value)}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 9999, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                  background: on ? T.PLX_GREEN_100 : T.PLX_SURFACE_100,
                  color: on ? T.PLX_GREEN_700 : T.PLX_INK_700,
                  border: on ? `1px solid ${T.PLX_GREEN_300}` : "1px solid transparent",
                }}
              >{opt.label}</button>
            );
          })}
        </div>
      </div>

      {/* 担当者 + 患者 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>担当者</label>
          <input
            type="text" value={soldBy} onChange={(e) => setSoldBy(e.target.value)}
            placeholder="例: 山田 花子"
            style={formInput}
          />
        </div>
        <div>
          <label style={labelStyle}>患者</label>
          <input
            type="text" value={patientRef} onChange={(e) => setPatientRef(e.target.value)}
            placeholder="例: 田中 太郎"
            style={formInput}
          />
        </div>
      </div>

      {/* 日時 */}
      <div style={{ marginBottom: 4 }}>
        <label style={labelStyle}>日時</label>
        <input
          type="datetime-local" value={soldAt}
          onChange={(e) => setSoldAt(e.target.value)}
          placeholder="今すぐ"
          style={formInput}
        />
        <div style={{ fontSize: 11, color: T.PLX_INK_500, marginTop: 5 }}>
          未入力の場合は登録時刻を使用します
        </div>
      </div>

      {/* メモ */}
      <div style={{ marginTop: 14, marginBottom: 4 }}>
        <label style={labelStyle}>メモ</label>
        <input
          type="text" value={note} maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="備考があれば入力（任意）"
          style={formInput}
        />
        <div style={{ fontSize: 11, color: T.PLX_INK_500, marginTop: 5 }}>
          {note.length} / 200
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22,
        paddingTop: 16, borderTop: `1px solid ${T.PLX_LINE_200}`,
      }}>
        <button type="button" onClick={onClose} disabled={saving} style={btnSecondary}>
          キャンセル
        </button>
        <button
          type="button" onClick={onSubmit}
          disabled={saving || insufficientStock || outOfStock}
          style={{
            ...btnPrimary,
            minWidth: 104,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: (saving || insufficientStock || outOfStock) ? 0.6 : 1,
            cursor: (saving || insufficientStock || outOfStock) ? "not-allowed" : "pointer",
          }}
        >
          {saving && (
            <span style={{
              width: 14, height: 14, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,.45)", borderTopColor: "#fff",
              display: "inline-block", animation: "plxspin .7s linear infinite",
            }} />
          )}
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </PlxModal>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 販売詳細 modal — GET /sales/:id + minimal read-only detail card.
// Reached from the 詳細 link in the table. Refunds and edit will land here
// later (P4).
// ───────────────────────────────────────────────────────────────────────────
function SaleDetailModal({ saleId, onClose, onRefunded }) {
  const q = useFetch(() => api.getSale(saleId), [saleId]);
  const [refunding, setRefunding] = React.useState(false);
  const s = q.data;
  const yen = (v) => "¥" + Number(v || 0).toLocaleString("ja-JP");
  const fmt = (iso) => iso
    ? new Date(iso).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  const PM_LABEL = { cash: "現金", card: "カード", paypay: "PayPay", bank_transfer: "銀行振込" };
  const isRefund   = s && (s.refund_of_sale_id != null || s.quantity < 0);
  const isRefunded = s && s.refunded_at != null;
  const canRefund  = s && !isRefund && !isRefunded && s.quantity > 0;

  const [showRefundModal, setShowRefundModal] = React.useState(false);
  const doRefund = () => { if (s && !refunding) setShowRefundModal(true); };

  const Row = ({ label, value, mono }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "10px 0", borderBottom: `1px solid ${T.PLX_LINE_100}`,
      fontSize: 13,
    }}>
      <span style={{ color: T.PLX_INK_500, fontWeight: 600 }}>{label}</span>
      <span style={{
        color: T.PLX_INK_900, fontWeight: 500, textAlign: "right",
        fontFamily: mono ? "ui-monospace, Menlo, Consolas, monospace" : "inherit",
      }}>{value}</span>
    </div>
  );

  return (
    <PlxModal title="販売詳細" onClose={onClose}>
      <div style={{ fontSize: 11, color: T.PLX_GREEN_700, fontWeight: 700, letterSpacing: "0.04em", marginTop: -10, marginBottom: 14 }}>
        販売記録
      </div>
      {q.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
      {q.error && <PlxErrorBanner error={q.error} onRetry={q.refetch} />}
      {s && (
        <>
          {isRefund && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              background: T.PLX_RED_100, color: T.PLX_RED_600, borderRadius: T.RADIUS_MD,
              fontSize: 12, fontWeight: 600, marginBottom: 14,
            }}>
              <span style={{
                display: "inline-block", padding: "2px 8px", borderRadius: 9999,
                fontSize: 10, fontWeight: 700, background: T.PLX_RED_600, color: "#fff",
              }}>返品</span>
              返品行 — 元の販売 ID: {s.refund_of_sale_id ?? "—"}
            </div>
          )}
          {isRefunded && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              background: T.PLX_AMBER_100, color: T.PLX_AMBER_600, borderRadius: T.RADIUS_MD,
              fontSize: 12, fontWeight: 600, marginBottom: 14,
            }}>
              ⚠ この販売は {fmt(s.refunded_at)} に返品されました
            </div>
          )}
          <div style={{ marginBottom: 6 }}>
            <Row label="取引ID" value={s.transaction_id} mono />
            <Row label="日時"   value={fmt(s.sold_at)} />
            <Row label="商品"   value={s.product_name ?? `#${s.variant_id}`} />
            <Row label="SKU"    value={s.sku ?? "—"} mono />
            <Row label="数量"   value={`${s.quantity} 個`} />
            <Row label="単価"   value={yen(s.unit_price)} />
            <Row label="合計 (税込)" value={yen(Number(s.unit_price) * Number(s.quantity))} />
            <Row label="支払方法" value={PM_LABEL[s.payment_method] ?? s.payment_method} />
            <Row label="担当者" value={s.sold_by || "—"} />
          <Row label="記録者" value={s.created_by || "—"} />
            <Row label="患者"   value={s.patient_ref ? `${s.patient_ref} さま` : "—"} />
            {s.note && <Row label="メモ" value={s.note} />}
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 10, marginTop: 16, paddingTop: 14,
            borderTop: `1px solid ${T.PLX_LINE_200}`,
          }}>
            <div style={{ display: "inline-flex", gap: 8 }}>
              {canRefund && (
                <button
                  type="button" onClick={doRefund} disabled={refunding}
                  style={{
                    ...btnSecondary,
                    color: T.PLX_RED_600, borderColor: T.PLX_RED_600,
                    opacity: refunding ? 0.6 : 1,
                    cursor: refunding ? "not-allowed" : "pointer",
                  }}
                >{refunding ? "処理中…" : "この販売を返品"}</button>
              )}
              {!isRefund && (
                <a
                  href={`#/sales/${s.id}/receipt`} onClick={onClose}
                  style={{ ...btnSecondary, textDecoration: "none",
                    display: "inline-flex", alignItems: "center", gap: 6 }}
                >🧾 レシート発行</a>
              )}
            </div>
            <button type="button" onClick={onClose} style={btnSecondary}>閉じる</button>
          </div>
        </>
      )}
      {showRefundModal && (
        <RefundReasonModal
          sale={s}
          onClose={() => setShowRefundModal(false)}
          onDone={() => { setShowRefundModal(false); onRefunded?.(); onClose?.(); }}
        />
      )}
    </PlxModal>
  );
}

// KPI tile — mirrors Dashboard's KpiCard (30 value / 13 unit / 11 label /
// 14 radius) so the four sales tiles look identical in size and weight to
// the dashboard tiles. Height is a min instead of a fixed value so the
// delta chip never overflows the bottom border on any tile.
function SalesKpi({ label, value, unit, delta }) {
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: 14, border: `1px solid ${T.PLX_LINE_200}`,
      padding: "16px 18px", minHeight: 104,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ fontSize: 11, color: T.PLX_INK_500, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 8 }}>
        <div style={{
          fontSize: 30, fontWeight: 900, letterSpacing: "-.02em",
          color: T.PLX_INK_900, lineHeight: 1,
        }}>{value}</div>
        {unit && (
          <div style={{ fontSize: 13, color: T.PLX_INK_700, fontWeight: 600 }}>{unit}</div>
        )}
      </div>
      {delta && <div style={{ marginTop: 10 }}>{delta}</div>}
    </div>
  );
}

// Filter-bar select styled as "ラベル: 値 ▾" — matches PurchaseOrders height 34.
function SalesFilterSelect({ label, value, onChange, options, disabled }) {
  return (
    <label style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: 34, padding: "0 10px 0 12px",
      background: T.PLX_CARD_BG, border: `1px solid ${T.PLX_LINE_200}`,
      borderRadius: T.RADIUS_MD, fontSize: 12,
      opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer",
    }}>
      <span style={{ color: T.PLX_INK_500, fontWeight: 600 }}>{label}:</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        style={{
          border: "none", outline: "none", background: "transparent",
          fontSize: 12, fontWeight: 600, color: T.PLX_INK_900, fontFamily: "inherit",
          cursor: disabled ? "not-allowed" : "pointer", padding: "0 4px",
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

window.SalesRecords = SalesRecords;
// 返品理由 — optional reason captured with every refund (recorded on the
// refund row's note and the audit adjustment).
function RefundReasonModal({ sale, onClose, onDone }) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const label = sale.transaction_id ?? `#${sale.id}`;
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.refundSale(sale.id, reason.trim() || null);
      window.PLX_TOAST?.success("返品を記録しました");
      onDone?.();
    } catch (err) {
      const msg = err?.body?.detail || err?.message || "返品に失敗しました";
      window.PLX_TOAST?.error(typeof msg === "string" ? msg : "返品に失敗しました");
      setBusy(false);
    }
  };
  return (
    <PlxModal title="返品を記録" onClose={onClose}>
      <div style={{ fontSize: 13, color: T.PLX_INK_700, marginBottom: 12, lineHeight: 1.7 }}>
        {`${label} を返品します。在庫が元に戻り、返品行として記録されます。`}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.PLX_INK_700, marginBottom: 6 }}>返品理由（任意）</div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="例: 未開封のまま患者様より返品"
        rows={3}
        style={{
          width: "100%", boxSizing: "border-box", padding: "8px 10px",
          borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
          fontSize: 13, resize: "vertical", background: T.PLX_CARD_BG, color: T.PLX_INK_900,
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button onClick={onClose} disabled={busy} style={{
          padding: "8px 18px", borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
          background: T.PLX_CARD_BG, fontSize: 13, cursor: "pointer", color: T.PLX_INK_700,
        }}>キャンセル</button>
        <button onClick={submit} disabled={busy} style={{
          padding: "8px 18px", borderRadius: T.RADIUS_MD, border: "none",
          background: T.PLX_RED_600, color: "#fff", fontSize: 13, fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
        }}>{busy ? "記録中…" : "返品を確定する"}</button>
      </div>
    </PlxModal>
  );
}

window.PlxManualSaleModal = ManualSaleModal;  // reused by ProductDetail's quick-sale button
