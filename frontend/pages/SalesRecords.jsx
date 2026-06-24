// 販売記録 — list of sales transactions.
//
// Backed by GET /sales (paginated list with payment_method filter) and
// GET /sales/summary (today / month count + revenue KPIs).
// Manual-entry modal, refund, and CSV export are still pending.

function SalesRecords({ query }) {
  const [paymentFilter, setPaymentFilter] = React.useState("");
  const [showManualEntry, setShowManualEntry] = React.useState(false);
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
    <button onClick={() => setShowManualEntry(true)} style={{
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

      {showManualEntry && (
        <ManualSaleModal
          onClose={() => setShowManualEntry(false)}
          onSaved={() => {
            setShowManualEntry(false);
            window.PLX_TOAST?.success("販売を記録しました");
            salesQ.refetch();
            summaryQ.refetch();
          }}
        />
      )}
    </AdminShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 販売の手動入力 modal — POST /sales form with variant typeahead, payment
// method chips, optional sold_at + note. Matches the design tab mockup.
// ───────────────────────────────────────────────────────────────────────────

function ManualSaleModal({ onClose, onSaved }) {
  const branchesQ = useFetch(() => api.listBranches(), []);
  const branches = branchesQ.data?.items ?? [];

  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);

  const [selected, setSelected] = React.useState(null); // { variant_id, name, sku, on_hand, price }
  const [branchId, setBranchId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [unitPrice, setUnitPrice] = React.useState(0);
  const [paymentMethod, setPaymentMethod] = React.useState("cash");
  const [soldAt, setSoldAt] = React.useState("");
  const [note, setNote] = React.useState("");

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
        background: isLow ? "#FEF3C7" : T.PLX_INK_050,
        color: isLow ? "#B45309" : T.PLX_INK_700,
        whiteSpace: "nowrap",
      }}>在庫 {n}</span>
    );
  };

  return (
    <PlxModal title="販売の手動入力" onClose={onClose}>
      <div style={{ fontSize: 11, color: T.PLX_INK_500, fontWeight: 600, marginTop: -10, marginBottom: 14 }}>
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
            padding: "12px 14px", border: `1px solid ${T.PLX_LINE_200}`,
            borderRadius: T.RADIUS_MD, background: T.PLX_CARD_BG,
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

      {/* 店舗 */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>店舗{reqStar}</label>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={formInput}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        {errText(errors.branch_id)}
      </div>

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
        padding: "14px 18px", background: T.PLX_INK_050,
        borderRadius: T.RADIUS_MD, marginBottom: 18,
      }}>
        <span style={{ fontSize: 13, color: T.PLX_INK_700, fontWeight: 600 }}>小計</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: T.PLX_INK_900 }}>{yen(subtotal)}</span>
      </div>

      {/* 支払方法 */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>支払方法{reqStar}</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PM_OPTIONS.map((opt) => (
            <PlxChip
              key={opt.value}
              on={paymentMethod === opt.value}
              onClick={() => setPaymentMethod(opt.value)}
              label={opt.label}
            />
          ))}
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
            opacity: (saving || insufficientStock || outOfStock) ? 0.5 : 1,
            cursor: (saving || insufficientStock || outOfStock) ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </PlxModal>
  );
}

window.SalesRecords = SalesRecords;
