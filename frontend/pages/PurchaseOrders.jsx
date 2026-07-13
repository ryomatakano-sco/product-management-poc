// 期間 presets — JST calendar boundaries converted to UTC ISO strings for the
// backend's created_at comparison (same convention as the sales page).
function poPeriodRange(period) {
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  const nowJst = new Date(Date.now() + JST_OFFSET);
  const jstMidnightUtc = (y, m, d) => new Date(Date.UTC(y, m, d) - JST_OFFSET);
  const y = nowJst.getUTCFullYear(), m = nowJst.getUTCMonth(), d = nowJst.getUTCDate();
  switch (period) {
    case "last7":      return { from: jstMidnightUtc(y, m, d - 6), to: null };
    case "this_month": return { from: jstMidnightUtc(y, m, 1), to: null };
    case "last_month": return { from: jstMidnightUtc(y, m - 1, 1), to: jstMidnightUtc(y, m, 1) };
    default:           return { from: null, to: null };
  }
}

function PurchaseOrders() {
  const [statusFilter, setStatusFilter] = React.useState("");
  const [vendorFilter, setVendorFilter] = React.useState("");
  const [branchFilter, setBranchFilter] = React.useState("");
  const [period, setPeriod] = React.useState(""); // "" | last7 | this_month | last_month
  const [search, setSearch] = React.useState("");
  const [searchInput, setSearchInput] = React.useState("");
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  // Client-side pagination — PoC scale fits in one 100-row fetch, so the
  // pager just slices the loaded rows (same pattern for Inventory/Products).
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  React.useEffect(() => { setPage(1); }, [statusFilter, vendorFilter, branchFilter, period, search, pageSize]);

  const posQ = useFetch(
    () => {
      const range = poPeriodRange(period);
      return api.listPurchaseOrders({
        status: statusFilter || undefined,
        supplier_vendor_id: vendorFilter || undefined,
        destination_branch_id: branchFilter || undefined,
        date_from: range.from ? range.from.toISOString() : undefined,
        date_to: range.to ? range.to.toISOString() : undefined,
        q: search || undefined,
        limit: 100,
      });
    },
    [statusFilter, vendorFilter, branchFilter, period, search],
  );
  const vendorsQ = useFetch(() => api.listVendors(), []);
  const branchesQ = useFetch(() => api.listBranches(), []);
  // Whole-store KPI summary — independent of the list filters so the tiles
  // stay stable while the user narrows the table.
  const summaryQ = useFetch(() => api.getPurchaseOrdersSummary().catch(() => null), []);
  const poSummary = summaryQ.data;

  const allRows = posQ.data?.items ?? [];
  const rows = allRows.slice((page - 1) * pageSize, page * pageSize);
  const vendors = vendorsQ.data?.items ?? [];
  const branches = branchesQ.data?.items ?? [];

  const kpis = React.useMemo(() => {
    const c = (s) => allRows.filter((r) => r.status === s).length;
    const sumTotal = allRows.reduce((s, r) => s + Number(r.total || 0), 0);
    return {
      total: allRows.length,
      draft: c("draft"),
      sent: c("ordered"),
      partial: c("partially_received"),
      received: c("received"),
      cancelled: c("cancelled"),
      sumTotal,
    };
  }, [allRows]);

  function handleSearchKey(e) {
    if (e.key === "Enter") setSearch(searchInput);
  }

  const selectStyle = {
    height: 34, padding: "0 10px", borderRadius: T.RADIUS_MD,
    border: `1px solid ${T.PLX_LINE_200}`, background: T.PLX_CARD_BG,
    fontSize: 12, color: T.PLX_INK_900, cursor: "pointer", outline: "none",
  };

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const range = poPeriodRange(period);
      await api.downloadPurchaseOrdersCsv({
        status: statusFilter || undefined,
        supplier_vendor_id: vendorFilter || undefined,
        destination_branch_id: branchFilter || undefined,
        date_from: range.from ? range.from.toISOString() : undefined,
        date_to: range.to ? range.to.toISOString() : undefined,
      });
    } catch (e) {
      window.PLX_TOAST.error("CSVエクスポートに失敗しました");
    } finally { setExporting(false); }
  }

  const headerRight = (
    <div style={{ display: "inline-flex", gap: 8 }}>
      <button onClick={handleExport} disabled={exporting} style={{
        ...btnSecondary, display: "inline-flex", alignItems: "center", gap: 6,
        opacity: exporting ? 0.6 : 1,
      }}>⬇ CSVエクスポート</button>
      <button onClick={() => setShowCreateModal(true)} style={{
        ...btnPrimary, display: "inline-flex", alignItems: "center", gap: 6,
      }}>＋ 発注書を作成</button>
    </div>
  );

  return (
    <AdminShell currentNav="po" breadcrumbs={["ホーム", "発注書"]}>
      <PlxPageHead title="発注書" subtitle={`全 ${posQ.data?.total ?? rows.length} 件の発注書`} right={headerRight} />

      {/* KPI strip — real month figures + 先月比 deltas from /purchase-orders/summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        <POKpiCard label="今月の発注件数"
          value={`${poSummary ? poSummary.month_count : kpis.total}件`}
          badge="今月" badgeTone="green"
          delta={poSummary ? poSummary.month_count - poSummary.last_month_count : null}
          deltaUnit="件" />
        <POKpiCard label="今月の発注金額"
          value={`¥${formatYen(poSummary ? poSummary.month_total : kpis.sumTotal)}`}
          badge="今月" badgeTone="green"
          delta={poSummary ? Number(poSummary.month_total) - Number(poSummary.last_month_total) : null}
          deltaUnit="¥" />
        <POKpiCard label="入荷待ち"
          value={`${poSummary ? poSummary.ordered_count : kpis.sent}件`}
          badge="送信済み" badgeTone="blue"
          tone={(poSummary ? poSummary.ordered_count : kpis.sent) > 0 ? "amber" : "muted"} />
        <POKpiCard label="一部入荷"
          value={`${poSummary ? poSummary.partially_received_count : kpis.partial}件`}
          badge="確認推奨" badgeTone="amber"
          tone={(poSummary ? poSummary.partially_received_count : kpis.partial) > 0 ? "amber" : "muted"} />
      </div>

      {/* Search + filters */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
      }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.PLX_INK_400, fontSize: 14 }}>🔍</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKey}
            onBlur={() => setSearch(searchInput)}
            placeholder="発注番号・仕入先で検索"
            style={{
              width: "100%", height: 34, paddingLeft: 32, paddingRight: 10,
              borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
              fontSize: 12, color: T.PLX_INK_900, background: T.PLX_SURFACE_50, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={selectStyle}>
          <option value="">期間: 全期間</option>
          <option value="last7">過去7日</option>
          <option value="this_month">今月</option>
          <option value="last_month">先月</option>
        </select>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} style={selectStyle}>
          <option value="">仕入先: すべて</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={selectStyle}>
          <option value="">拠点: すべて</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Status chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <PlxChip on={!statusFilter} onClick={() => setStatusFilter("")} label={`すべて (${kpis.total})`} />
        <PlxChip on={statusFilter==="draft"} onClick={() => setStatusFilter("draft")} label={`下書き (${kpis.draft})`} />
        <PlxChip on={statusFilter==="ordered"} onClick={() => setStatusFilter("ordered")} label={`送信済み (${kpis.sent})`} />
        <PlxChip on={statusFilter==="partially_received"} onClick={() => setStatusFilter("partially_received")} label={`一部入荷 (${kpis.partial})`} tone="amber" />
        <PlxChip on={statusFilter==="received"} onClick={() => setStatusFilter("received")} label={`入荷済み (${kpis.received})`} />
        <PlxChip on={statusFilter==="cancelled"} onClick={() => setStatusFilter("cancelled")} label={`キャンセル (${kpis.cancelled})`} tone="red" />
      </div>

      {posQ.error && <PlxErrorBanner error={posQ.error} onRetry={posQ.refetch} />}

      {/* Table */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        boxShadow: T.SHADOW_SM, overflow: "hidden",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.2fr 1.4fr 0.9fr 1fr 0.6fr 0.9fr 0.9fr 40px",
          padding: "10px 18px", fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
          background: T.PLX_SURFACE_50, borderBottom: `1px solid ${T.PLX_LINE_200}`,
          userSelect: "none",
        }}>
          <span>発注番号</span><span>仕入先</span><span>発注日</span>
          <span>納品予定日</span><span style={{ textAlign: "right" }}>品目数</span>
          <span style={{ textAlign: "right" }}>合計（税込）</span>
          <span style={{ textAlign: "center" }}>状態</span>
          <span />
        </div>

        {posQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
        {!posQ.loading && allRows.length === 0 && (
          <PlxEmptyState title="該当する発注書がありません" message="新しい発注書を作成するか、フィルタを変更してください。" />
        )}
        {rows.map((po, i) => (
          <div key={po.id} style={{
            display: "grid", gridTemplateColumns: "1.2fr 1.4fr 0.9fr 1fr 0.6fr 0.9fr 0.9fr 40px",
            padding: "13px 18px", alignItems: "center", fontSize: 12,
            borderBottom: i < rows.length - 1 ? `1px solid ${T.PLX_LINE_100}` : "none",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = T.PLX_SURFACE_50}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <span
              onClick={() => navigate(`/purchase-orders/${po.id}`)}
              style={{ fontFamily: T.FONT_MONO, fontWeight: 700, color: T.PLX_BLUE_600, cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
              onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}>
              PO-{String(po.id).padStart(6, "0")}
            </span>
            <span>{po.supplier_name || "—"}</span>
            <span style={{ fontSize: 11, color: T.PLX_INK_600 }}>{po.ordered_at ? formatJpDate(po.ordered_at) : formatJpDate(po.created_at)}</span>
            <span style={{ fontSize: 11 }}>{po.estimated_arrival ? formatJpDate(po.estimated_arrival) : "—"}</span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{po.items?.length ?? 0}</span>
            <span style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>¥{formatYen(po.total)}</span>
            <span style={{ textAlign: "center" }}><POStatusPill status={po.status} /></span>
            <span style={{ textAlign: "center" }}>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/purchase-orders/${po.id}`); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: T.PLX_INK_400, fontSize: 16, padding: "2px 6px", borderRadius: T.RADIUS_SM }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.PLX_LINE_200; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
                ···
              </button>
            </span>
          </div>
        ))}

        {/* Pagination footer */}
        {!posQ.loading && allRows.length > 0 && (
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
                {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span>{(page - 1) * pageSize + 1} - {Math.min(page * pageSize, allRows.length)} 件 / 全 {allRows.length} 件</span>
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
                disabled={page * pageSize >= allRows.length}
                style={{ ...btnSecondary, height: 30, padding: "0 12px",
                  opacity: page * pageSize >= allRows.length ? 0.5 : 1 }}
              >次へ →</button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <POCreateModal
          vendors={vendors}
          branches={branches}
          onClose={() => setShowCreateModal(false)}
          onCreated={(po) => {
            setShowCreateModal(false);
            window.PLX_TOAST.success(`発注書 PO-${String(po.id).padStart(6, "0")} を作成しました`);
            navigate(`/purchase-orders/${po.id}`);
          }}
        />
      )}
    </AdminShell>
  );
}

function POKpiCard({ label, value, badge, badgeTone, tone, delta, deltaUnit }) {
  const badgeColors = {
    green: { bg: T.PLX_GREEN_100, color: T.PLX_GREEN_700 },
    blue:  { bg: T.PLX_BLUE_100,  color: T.PLX_BLUE_600  },
    amber: { bg: T.PLX_AMBER_100, color: T.PLX_AMBER_600 },
  };
  const bc = badgeColors[badgeTone] || badgeColors.green;
  const valueColor = tone === "amber" ? T.PLX_AMBER_600 : tone === "muted" ? T.PLX_INK_500 : T.PLX_INK_900;
  const deltaText = delta == null ? null
    : deltaUnit === "¥"
      ? `${delta >= 0 ? "+" : "−"}¥${formatYen(Math.abs(delta))}`
      : `${delta >= 0 ? "+" : "−"}${Math.abs(delta)}${deltaUnit || ""}`;
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      boxShadow: T.SHADOW_SM, padding: "18px 20px",
    }}>
      <div style={{ fontSize: 12, color: T.PLX_INK_500, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: valueColor, marginBottom: 8 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {badge && (
          <span style={{
            display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px",
            borderRadius: 99, background: bc.bg, color: bc.color,
          }}>{badge}</span>
        )}
        {deltaText != null && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
            background: delta >= 0 ? T.PLX_GREEN_100 : T.PLX_RED_100,
            color: delta >= 0 ? T.PLX_GREEN_700 : T.PLX_RED_600,
          }}>{delta >= 0 ? "↑" : "↓"} {deltaText} 先月比</span>
        )}
      </div>
    </div>
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

// Detail page — hero + status stepper + line items + action buttons + tracking.
function PurchaseOrderDetail({ id }) {
  const poQ = useFetch(() => api.getPurchaseOrder(Number(id)), [id]);
  const po = poQ.data;
  const [busy, setBusy] = React.useState(false);
  const [showReceiveModal, setShowReceiveModal] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [form, setForm] = React.useState(null);
  // Issuer block on the printable 発注書 — company info from Settings › 一般.
  const companyQ = useFetch(() => api.getSettings("general").catch(() => null), []);
  const company = companyQ.data?.data || {};

  // Same clone-to-body pattern as ReceiptIssue: clone the off-screen sheet
  // into <body>, hide everything else via .plx-printing, print, clean up.
  const printPO = () => {
    const src = document.querySelector(".plx-po-print-src");
    if (!src) { window.print(); return; }
    const clone = src.cloneNode(true);
    clone.classList.add("plx-print-clone");
    document.body.appendChild(clone);
    document.body.classList.add("plx-printing");
    const cleanup = () => {
      document.body.classList.remove("plx-printing");
      if (clone.parentNode) clone.parentNode.removeChild(clone);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 5000);
  };
  const vendorsQ  = useFetch(() => editMode ? api.listVendors()  : Promise.resolve(null), [editMode]);
  const branchesQ = useFetch(() => editMode ? api.listBranches() : Promise.resolve(null), [editMode]);
  const productsQ = useFetch(() => editMode ? api.listProducts({ status: "active", limit: 100 }) : Promise.resolve(null), [editMode]);

  function enterEdit() {
    setForm({
      supplier_vendor_id:    po.supplier_vendor_id,
      destination_branch_id: po.destination_branch_id,
      estimated_arrival:     po.estimated_arrival || "",
      note:                  po.note || "",
      items: (po.items || []).map((it) => ({
        id: it.id,
        variant_id: it.variant_id,
        product_name: it.product_name,
        sku: it.sku,
        quantity_ordered: it.quantity_ordered,
        quantity_received: it.quantity_received,
        unit_cost: String(it.unit_cost),
        _deleted: false,
      })),
    });
    setEditMode(true);
  }

  function cancelEdit() { setEditMode(false); setForm(null); }

  function updateField(key, value) { setForm((p) => ({ ...p, [key]: value })); }
  function updateItem(idx, key, value) {
    setForm((p) => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [key]: value } : it) }));
  }
  function deleteItem(idx) {
    setForm((p) => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, _deleted: true } : it) }));
  }
  function addBlankItem() {
    setForm((p) => ({
      ...p,
      items: [...p.items, {
        id: null,
        variant_id: null,
        product_name: "",
        sku: "",
        quantity_ordered: 1,
        quantity_received: 0,
        unit_cost: "0",
        _deleted: false,
        _isNew: true,
      }],
    }));
  }

  function itemsChanged(originalItems, currentItems) {
    const visible = currentItems.filter((it) => !it._deleted);
    if (visible.length !== originalItems.length) return true;
    return visible.some((it, i) => {
      const orig = originalItems[i];
      return Number(it.quantity_ordered) !== orig.quantity_ordered
          || String(it.unit_cost) !== String(orig.unit_cost)
          || it.variant_id !== orig.variant_id;
    });
  }

  async function saveEdit() {
    if (busy) return;
    setBusy(true);
    try {
      const payload = {
        supplier_vendor_id:    form.supplier_vendor_id,
        destination_branch_id: form.destination_branch_id,
        estimated_arrival:     form.estimated_arrival || null,
        note:                  form.note || null,
      };
      if (itemsChanged(po.items || [], form.items)) {
        const visible = form.items.filter((it) => !it._deleted);
        const blank = visible.find((it) => !it.variant_id);
        if (blank) {
          window.PLX_TOAST.warn("商品が選択されていない明細があります");
          setBusy(false); return;
        }
        payload.items = visible.map((it) => ({
          variant_id: it.variant_id,
          quantity_ordered: Number(it.quantity_ordered),
          unit_cost: String(it.unit_cost),
        }));
      }
      await api.updatePurchaseOrder(po.id, payload);
      window.PLX_TOAST.success("発注書を更新しました");
      cancelEdit();
      poQ.refetch();
    } catch (e) {
      window.PLX_TOAST.error(e?.detail ?? "更新に失敗しました");
    } finally { setBusy(false); }
  }

  async function handleSubmit() {
    if (busy) return;
    setBusy(true);
    try {
      await api.submitPurchaseOrder(Number(id));
      window.PLX_TOAST.success("発注書を送信しました");
      poQ.refetch();
    } catch (e) {
      window.PLX_TOAST.error(e?.detail ?? "送信に失敗しました");
    } finally { setBusy(false); }
  }

  async function handleCancel() {
    if (busy) return;
    if (!window.confirm("この発注書をキャンセルしますか？この操作は元に戻せません。")) return;
    setBusy(true);
    try {
      await api.cancelPurchaseOrder(Number(id));
      window.PLX_TOAST.success("発注書をキャンセルしました");
      poQ.refetch();
    } catch (e) {
      window.PLX_TOAST.error(e?.detail ?? "キャンセルに失敗しました");
    } finally { setBusy(false); }
  }

  const canSubmit  = po?.status === "draft";
  const canReceive = po?.status === "ordered" || po?.status === "partially_received";
  const canCancel  = po?.status === "draft" || po?.status === "ordered" || po?.status === "partially_received";
  const canEdit    = po?.status !== "received" && po?.status !== "cancelled";

  return (
    <AdminShell currentNav="po"
      breadcrumbs={["ホーム", "発注書", po ? `PO-${String(po.id).padStart(6, "0")}` : "..."]}>
      {poQ.error && <PlxErrorBanner error={poQ.error} onRetry={poQ.refetch} />}
      {poQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
      {po && editMode && form && (
        <POEditView
          po={po}
          form={form}
          updateField={updateField}
          updateItem={updateItem}
          deleteItem={deleteItem}
          addBlankItem={addBlankItem}
          vendors={vendorsQ.data?.items || []}
          branches={branchesQ.data?.items || []}
          products={productsQ.data?.items || []}
          busy={busy}
          onSave={saveEdit}
          onCancel={cancelEdit}
        />
      )}
      {po && !editMode && (
        <>
          <button onClick={() => navigate("/purchase-orders")} style={{
            background: "none", border: "none", color: T.PLX_INK_500,
            fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 8,
          }}>← 発注書一覧へ戻る</button>

          {/* Hero card */}
          <div style={{
            background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
            boxShadow: T.SHADOW_SM, padding: "16px 20px", marginBottom: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
              {/* Left: meta */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: T.PLX_INK_500, fontWeight: 600, marginBottom: 2 }}>発注番号</div>
                <h2 style={{ margin: "0 0 10px", fontSize: 20, fontFamily: T.FONT_MONO, fontWeight: 700 }}>
                  PO-{String(po.id).padStart(6, "0")}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "8px 28px", marginBottom: 10 }}>
                  <DetailKV k="仕入先" v={<span style={{ color: T.PLX_BLUE_600, fontWeight: 600 }}>{po.supplier_name || "—"}</span>} />
                  <DetailKV k="発注日" v={po.ordered_at ? formatJpDate(po.ordered_at) : formatJpDate(po.created_at)} />
                  <DetailKV k="納品予定日" v={po.estimated_arrival ? formatJpDate(po.estimated_arrival) : "—"} />
                  <DetailKV k="拠点" v={po.branch_name || "—"} />
                </div>
                <DetailKV k="合計金額（税込）" v={
                  <span style={{ fontSize: 22, fontWeight: 700, color: T.PLX_INK_900 }}>¥{formatYen(po.total)}</span>
                } />
                {po.note && (
                  <div style={{ marginTop: 8, padding: 8, background: T.PLX_SURFACE_50, borderRadius: T.RADIUS_MD, fontSize: 12, color: T.PLX_INK_600 }}>
                    {po.note}
                  </div>
                )}
              </div>
              {/* Right: status stepper */}
              <div style={{
                minWidth: 260, background: T.PLX_SURFACE_50, borderRadius: T.RADIUS_MD,
                border: `1px solid ${T.PLX_LINE_200}`, padding: "10px 14px",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.PLX_INK_500, marginBottom: 10 }}>発注ステータス</div>
                <POStatusStepper status={po.status} />
              </div>
            </div>
          </div>

          {/* Action buttons bar */}
          <div style={{
            background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
            boxShadow: T.SHADOW_SM, padding: "8px 14px", marginBottom: 10,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ flex: 1, display: "flex", gap: 8 }}>
              {canSubmit && (
                <button onClick={handleSubmit} disabled={busy} style={{
                  padding: "5px 12px", borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
                  background: T.PLX_CARD_BG, fontSize: 12, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
                  color: T.PLX_INK_700, opacity: busy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 5,
                }}>📤 送信</button>
              )}
              {canEdit && (
                <button onClick={enterEdit} disabled={busy} style={{
                  padding: "5px 12px", borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
                  background: T.PLX_CARD_BG, fontSize: 12, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
                  color: T.PLX_INK_700, opacity: busy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 5,
                }}>✎ 編集</button>
              )}
              <button onClick={printPO} disabled={busy} style={{
                padding: "5px 12px", borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
                background: T.PLX_CARD_BG, fontSize: 12, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
                color: T.PLX_INK_700, opacity: busy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 5,
              }}>🖨 印刷 / PDF</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {canReceive && (
                <button onClick={() => setShowReceiveModal(true)} disabled={busy} style={{
                  ...btnPrimary, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px",
                  opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer", fontSize: 12,
                }}>✓ 入荷を記録</button>
              )}
              {canCancel && (
                <button onClick={handleCancel} disabled={busy} style={{
                  padding: "5px 12px", borderRadius: T.RADIUS_MD,
                  border: `1px solid ${T.PLX_RED_300 || "#fca5a5"}`,
                  background: T.PLX_CARD_BG, fontSize: 12, fontWeight: 600,
                  color: T.PLX_RED_600, cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 5,
                }}>✕ キャンセル</button>
              )}
            </div>
          </div>

          {/* Line items */}
          <div style={{
            background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
            boxShadow: T.SHADOW_SM, overflow: "hidden", marginBottom: 10,
          }}>
            <div style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, borderBottom: `1px solid ${T.PLX_LINE_200}` }}>
              明細
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "40px minmax(240px, 380px) 140px 90px 70px 110px 120px",
              padding: "7px 16px", fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
              background: T.PLX_SURFACE_50, borderBottom: `1px solid ${T.PLX_LINE_200}`,
            }}>
              <span>#</span><span>商品名</span><span>SKU</span>
              <span style={{ textAlign: "right" }}>単価</span>
              <span style={{ textAlign: "right" }}>数量</span>
              <span style={{ textAlign: "right" }}>入荷済み</span>
              <span style={{ textAlign: "right" }}>合計</span>
            </div>
            {(po.items || []).length === 0 && (
              <div style={{ padding: "16px", color: T.PLX_INK_400, fontSize: 12, textAlign: "center" }}>商品明細なし</div>
            )}
            {(po.items || []).map((it, i) => (
              <div key={it.id} style={{
                display: "grid", gridTemplateColumns: "40px minmax(240px, 380px) 140px 90px 70px 110px 120px",
                padding: "8px 16px", fontSize: 12, alignItems: "center",
                borderBottom: i < po.items.length - 1 ? `1px solid ${T.PLX_LINE_100}` : "none",
              }}>
                <span style={{ color: T.PLX_INK_400, fontWeight: 600 }}>{i + 1}</span>
                <span style={{ color: T.PLX_INK_700 }}>{it.product_name || `商品 ID: ${it.variant_id}`}</span>
                <span style={{ color: T.PLX_INK_400, fontFamily: T.FONT_MONO, fontSize: 11 }}>{it.sku || "—"}</span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{formatYen(it.unit_cost)}</span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.quantity_ordered}</span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700,
                  color: it.quantity_received >= it.quantity_ordered ? T.PLX_GREEN_700 : it.quantity_received > 0 ? T.PLX_AMBER_600 : T.PLX_INK_500 }}>
                  {it.quantity_received}
                </span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>¥{formatYen(it.line_total)}</span>
              </div>
            ))}
            {/* Totals */}
            <div style={{ borderTop: `1px solid ${T.PLX_LINE_200}`, padding: "8px 16px" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 32, fontSize: 12 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: T.PLX_INK_500, marginBottom: 4 }}>小計</div>
                  {Number(po.shipping_cost) > 0 && <div style={{ color: T.PLX_INK_500, marginBottom: 4 }}>送料</div>}
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.PLX_INK_900, marginTop: 4 }}>合計</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 90 }}>
                  <div style={{ marginBottom: 4 }}>¥{formatYen(po.subtotal)}</div>
                  {Number(po.shipping_cost) > 0 && <div style={{ marginBottom: 4 }}>¥{formatYen(po.shipping_cost)}</div>}
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.PLX_INK_900, marginTop: 4 }}>¥{formatYen(po.total)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping tracking */}
          {(po.shipping_carrier || po.tracking_number) && (
            <div style={{
              background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
              boxShadow: T.SHADOW_SM, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>配送追跡</div>
                <div style={{ fontSize: 11, color: T.PLX_INK_500 }}>
                  {po.shipping_carrier && <span>{po.shipping_carrier}　／　</span>}
                  {po.tracking_number && <span>追跡番号 {po.tracking_number}</span>}
                  {po.estimated_arrival && <span>　／　予定: {formatJpDate(po.estimated_arrival)}</span>}
                </div>
              </div>
              {po.tracking_number && (
                <button style={{
                  padding: "5px 12px", borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
                  background: T.PLX_CARD_BG, fontSize: 11, fontWeight: 600, cursor: "pointer", color: T.PLX_BLUE_600,
                }}>↗ 追跡を確認</button>
              )}
            </div>
          )}

          {/* Receive modal */}
          {showReceiveModal && (
            <POReceiveModal po={po} onClose={() => setShowReceiveModal(false)} onDone={() => { setShowReceiveModal(false); poQ.refetch(); }} />
          )}

          {/* Off-screen printable 発注書 + print stylesheet (clone-to-body pattern) */}
          <div style={{ position: "fixed", left: -10000, top: 0, width: 720 }} aria-hidden="true">
            <POPrintSheet po={po} company={company} />
          </div>
          <style>{`
            @media print {
              @page { margin: 14mm; }
              html, body { background: #fff !important; }
              body.plx-printing > *:not(.plx-print-clone) { display: none !important; }
              .plx-print-clone {
                display: block !important;
                width: 100% !important; max-width: 100% !important;
                margin: 0 !important; padding: 0 !important;
                border: none !important; box-shadow: none !important;
                background: #fff !important;
                page-break-inside: avoid;
              }
            }
            body.plx-printing .plx-print-clone { position: static; }
            .plx-print-clone { display: none; }
            @media print { .plx-print-clone { display: block !important; } }
          `}</style>
        </>
      )}
    </AdminShell>
  );
}

// Print-friendly 発注書 sheet. Fixed monochrome styling (independent of the
// app theme — dark mode must not produce a dark PDF).
function POPrintSheet({ po, company }) {
  const ink = "#111827", muted = "#6b7280", line = "#d1d5db";
  const yen = (v) => `¥${formatYen(v)}`;
  return (
    <div className="plx-po-print-src" style={{
      background: "#fff", color: ink, width: 720, padding: "28px 32px",
      fontFamily: "'Inter','Noto Sans JP',sans-serif", fontSize: 12, lineHeight: 1.6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.2em" }}>発 注 書</div>
          <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
            発注番号: <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, color: ink }}>PO-{String(po.id).padStart(6, "0")}</span>
          </div>
          <div style={{ fontSize: 11, color: muted }}>
            発注日: {po.ordered_at ? formatJpDate(po.ordered_at) : formatJpDate(po.created_at)}
            {po.estimated_arrival && <>　／　納品希望日: {formatJpDate(po.estimated_arrival)}</>}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{company.company_name || "ペイライト歯科クリニック"}</div>
          {company.address && <div style={{ color: muted }}>{company.address}</div>}
          {company.phone && <div style={{ color: muted }}>TEL: {company.phone}</div>}
          {company.email && <div style={{ color: muted }}>{company.email}</div>}
        </div>
      </div>

      <div style={{ borderBottom: `2px solid ${ink}`, marginBottom: 14 }} />

      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 700, borderBottom: `1px solid ${ink}`, paddingBottom: 2 }}>
          {po.supplier_name || "—"} 御中
        </span>
        <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
          下記の通り発注いたします。　納品先: {po.branch_name || "—"}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <thead>
          <tr>
            {["#", "商品名", "SKU", "単価", "数量", "金額"].map((h, i) => (
              <th key={h} style={{
                border: `1px solid ${line}`, background: "#f3f4f6", padding: "6px 8px",
                fontSize: 11, fontWeight: 700, textAlign: i >= 3 ? "right" : "left",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(po.items || []).map((it, i) => (
            <tr key={it.id}>
              <td style={{ border: `1px solid ${line}`, padding: "6px 8px", color: muted }}>{i + 1}</td>
              <td style={{ border: `1px solid ${line}`, padding: "6px 8px", fontWeight: 600 }}>{it.product_name || `商品 ID: ${it.variant_id}`}</td>
              <td style={{ border: `1px solid ${line}`, padding: "6px 8px", fontFamily: "ui-monospace,monospace", fontSize: 10 }}>{it.sku || "—"}</td>
              <td style={{ border: `1px solid ${line}`, padding: "6px 8px", textAlign: "right" }}>{yen(it.unit_cost)}</td>
              <td style={{ border: `1px solid ${line}`, padding: "6px 8px", textAlign: "right" }}>{it.quantity_ordered}</td>
              <td style={{ border: `1px solid ${line}`, padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{yen(it.line_total)}</td>
            </tr>
          ))}
          {(po.items || []).length === 0 && (
            <tr><td colSpan={6} style={{ border: `1px solid ${line}`, padding: 12, textAlign: "center", color: muted }}>明細なし</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <table style={{ borderCollapse: "collapse", minWidth: 220 }}>
          <tbody>
            <tr>
              <td style={{ padding: "3px 12px", color: muted }}>小計</td>
              <td style={{ padding: "3px 0", textAlign: "right" }}>{yen(po.subtotal)}</td>
            </tr>
            {Number(po.shipping_cost) > 0 && (
              <tr>
                <td style={{ padding: "3px 12px", color: muted }}>送料</td>
                <td style={{ padding: "3px 0", textAlign: "right" }}>{yen(po.shipping_cost)}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: "6px 12px", fontWeight: 800, fontSize: 14, borderTop: `2px solid ${ink}` }}>合計 (税込)</td>
              <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 800, fontSize: 14, borderTop: `2px solid ${ink}` }}>{yen(po.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {po.note && (
        <div style={{ border: `1px solid ${line}`, borderRadius: 4, padding: "8px 10px", fontSize: 11 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>備考</div>
          {po.note}
        </div>
      )}
    </div>
  );
}

const STEPPER_NAVY = "#1e3a5f";
const STEPPER_NAVY_LIGHT = "#e8f0f8";

function POStatusStepper({ status }) {
  const steps = [
    { key: "draft",              label: "下書き" },
    { key: "ordered",            label: "送信済み" },
    { key: "partially_received", label: "一部入荷" },
    { key: "received",           label: "入荷済み" },
  ];
  const cancelled = status === "cancelled";
  const order = steps.map((s) => s.key);
  const currentIdx = cancelled ? -1 : order.indexOf(status);

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {steps.map((step, i) => {
        const done   = !cancelled && i <= currentIdx;
        const active = !cancelled && i === currentIdx;
        const dotBg     = cancelled ? "#f1f5f9" : done ? STEPPER_NAVY : "#fff";
        const dotBorder = cancelled ? "#cbd5e1" : done ? STEPPER_NAVY : "#cbd5e1";
        const lineColor = cancelled ? "#e2e8f0" : i < currentIdx ? STEPPER_NAVY : "#e2e8f0";
        return (
          <React.Fragment key={step.key}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 54 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: dotBg, border: `2px solid ${dotBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 6,
                boxShadow: done && !cancelled ? `0 0 0 3px ${STEPPER_NAVY_LIGHT}` : "none",
              }}>
                {done && !cancelled ? "✓" : ""}
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? STEPPER_NAVY : cancelled ? "#94a3b8" : done ? "#475569" : "#94a3b8",
                whiteSpace: "nowrap",
              }}>{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: lineColor, marginBottom: 18, minWidth: 16 }} />
            )}
          </React.Fragment>
        );
      })}
      {cancelled && (
        <div style={{ marginLeft: 10, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%", background: T.PLX_RED_100,
            border: `2px solid ${T.PLX_RED_600}`, display: "flex", alignItems: "center",
            justifyContent: "center", color: T.PLX_RED_600, fontSize: 12, fontWeight: 700, marginBottom: 6,
          }}>✕</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.PLX_RED_600, whiteSpace: "nowrap" }}>キャンセル</span>
        </div>
      )}
    </div>
  );
}

function POEditView({ po, form, updateField, updateItem, deleteItem, addBlankItem, vendors, branches, products, busy, onSave, onCancel }) {
  const labelStyle = { fontSize: 11, fontWeight: 600, color: T.PLX_INK_500, marginBottom: 4, display: "block" };
  const inputStyle = {
    width: "100%", height: 36, padding: "0 10px", borderRadius: T.RADIUS_MD,
    border: `1px solid ${T.PLX_LINE_200}`, fontSize: 13, color: T.PLX_INK_900,
    boxSizing: "border-box", outline: "none", background: T.PLX_CARD_BG,
  };
  const visibleItems = form.items.filter((it) => !it._deleted);

  return (
    <>
      <button onClick={onCancel} style={{
        background: "none", border: "none", color: T.PLX_INK_500,
        fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 8,
      }}>← 発注書一覧へ戻る</button>

      {/* Hero / form card */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        boxShadow: T.SHADOW_SM, padding: "16px 20px", marginBottom: 10,
      }}>
        <div style={{ fontSize: 10, color: T.PLX_INK_500, fontWeight: 600, marginBottom: 2 }}>発注番号</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.FONT_MONO, fontWeight: 700 }}>
            PO-{String(po.id).padStart(6, "0")}
          </h2>
          <POStatusPill status={po.status} />
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99,
            background: T.PLX_AMBER_100, color: T.PLX_AMBER_600,
          }}>✎ 編集中</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>仕入先 <span style={{ color: T.PLX_RED_600 }}>*</span></label>
            <select value={form.supplier_vendor_id ?? ""} onChange={(e) => updateField("supplier_vendor_id", Number(e.target.value))} style={inputStyle}>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>拠点 <span style={{ color: T.PLX_RED_600 }}>*</span></label>
            <select value={form.destination_branch_id ?? ""} onChange={(e) => updateField("destination_branch_id", Number(e.target.value))} style={inputStyle}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>納品予定日</label>
            <input type="date" value={form.estimated_arrival} onChange={(e) => updateField("estimated_arrival", e.target.value)} style={inputStyle} />
          </div>
          <div />
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>備考</label>
            <textarea
              value={form.note}
              onChange={(e) => updateField("note", e.target.value.slice(0, 200))}
              rows={2}
              placeholder="社内メモ・特記事項があれば入力（任意）"
              style={{ ...inputStyle, height: "auto", padding: "8px 10px", fontFamily: "inherit", resize: "vertical" }}
            />
            <div style={{ fontSize: 10, color: T.PLX_INK_400, marginTop: 2, textAlign: "right" }}>{(form.note || "").length} / 200</div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        boxShadow: T.SHADOW_SM, padding: "10px 16px", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: T.PLX_AMBER_600,
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>✎ 編集モード</span>
          <span style={{ fontSize: 11, color: T.PLX_INK_500 }}>変更は保存するまで反映されません</span>
        </div>
        <button onClick={onCancel} disabled={busy} style={{
          padding: "6px 14px", borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
          background: T.PLX_CARD_BG, fontSize: 12, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
          color: T.PLX_INK_700, opacity: busy ? 0.6 : 1,
        }}>キャンセル</button>
        <button onClick={onSave} disabled={busy} style={{
          ...btnPrimary, padding: "6px 14px", fontSize: 12,
          opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer",
        }}>{busy ? "保存中…" : "✓ 変更を保存"}</button>
      </div>

      {/* Editable line items */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        boxShadow: T.SHADOW_SM, overflow: "hidden",
      }}>
        <div style={{
          padding: "10px 16px", fontSize: 13, fontWeight: 700,
          borderBottom: `1px solid ${T.PLX_LINE_200}`,
          display: "flex", justifyContent: "space-between",
        }}>
          <span>明細</span>
          <span style={{ fontSize: 11, color: T.PLX_INK_500, fontWeight: 500 }}>{visibleItems.length} 品目</span>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "32px 1fr 110px 90px 110px 36px",
          padding: "7px 16px", fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
          background: T.PLX_SURFACE_50, borderBottom: `1px solid ${T.PLX_LINE_200}`,
        }}>
          <span>#</span><span>商品名 / SKU</span>
          <span style={{ textAlign: "right" }}>単価</span>
          <span style={{ textAlign: "right" }}>数量</span>
          <span style={{ textAlign: "right" }}>行合計</span>
          <span />
        </div>
        {form.items.map((it, i) => {
          if (it._deleted) return null;
          const lineTotal = Number(it.unit_cost || 0) * Number(it.quantity_ordered || 0);
          return (
            <div key={it.id ?? i} style={{
              display: "grid", gridTemplateColumns: "32px 1fr 110px 90px 110px 36px",
              padding: "10px 16px", fontSize: 12, alignItems: "center", gap: 8,
              borderBottom: `1px solid ${T.PLX_LINE_100}`,
            }}>
              <span style={{ color: T.PLX_INK_400, fontWeight: 600 }}>{i + 1}</span>
              <div>
                {!it.variant_id ? (
                  <select
                    value=""
                    onChange={(e) => {
                      const p = products.find((x) => String(x.default_variant_id) === e.target.value);
                      if (!p || !p.default_variant_id) return;
                      updateItem(i, "variant_id",   p.default_variant_id);
                      updateItem(i, "product_name", p.name);
                      updateItem(i, "sku",          p.default_sku || "");
                      if (p.default_cost != null) updateItem(i, "unit_cost", String(p.default_cost));
                    }}
                    style={{
                      width: "100%", height: 36, padding: "0 10px", borderRadius: T.RADIUS_MD,
                      border: `1px solid ${T.PLX_LINE_200}`, background: T.PLX_CARD_BG,
                      fontSize: 12, color: T.PLX_INK_900, boxSizing: "border-box", outline: "none",
                    }}>
                    <option value="" disabled>商品を選択してください…</option>
                    {products
                      .filter((p) => p.default_variant_id)
                      .map((p) => (
                        <option key={p.id} value={p.default_variant_id}>
                          {p.name} {p.default_sku ? `（${p.default_sku}）` : ""}
                        </option>
                      ))}
                  </select>
                ) : (
                  <>
                    <input
                      type="text"
                      value={it.product_name || ""}
                      onChange={(e) => updateItem(i, "product_name", e.target.value)}
                      placeholder="商品名"
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: T.RADIUS_MD,
                        border: `1px solid ${T.PLX_LINE_200}`, background: T.PLX_CARD_BG,
                        fontSize: 12, fontWeight: 600, color: T.PLX_INK_900,
                        boxSizing: "border-box", outline: "none",
                      }}
                      onFocus={(e) => e.target.style.borderColor = T.PLX_BLUE_600}
                      onBlur={(e) => e.target.style.borderColor = T.PLX_LINE_200}
                    />
                    <input
                      type="text"
                      value={it.sku || ""}
                      onChange={(e) => updateItem(i, "sku", e.target.value)}
                      placeholder="SKU"
                      style={{
                        marginTop: 6, padding: "4px 10px", borderRadius: T.RADIUS_MD,
                        border: `1px solid ${T.PLX_LINE_200}`, background: T.PLX_CARD_BG,
                        fontFamily: T.FONT_MONO, fontSize: 10, color: T.PLX_INK_500,
                        outline: "none", width: 160,
                      }}
                      onFocus={(e) => e.target.style.borderColor = T.PLX_BLUE_600}
                      onBlur={(e) => e.target.style.borderColor = T.PLX_LINE_200}
                    />
                    {it.quantity_received > 0 && (
                      <div style={{ fontSize: 10, color: T.PLX_INK_400, marginTop: 4 }}>入荷済み {it.quantity_received}個</div>
                    )}
                  </>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: T.PLX_INK_500 }}>¥</span>
                <input type="number" min={0} value={it.unit_cost}
                  onChange={(e) => updateItem(i, "unit_cost", e.target.value)}
                  style={{ ...inputStyle, height: 30, textAlign: "right", fontSize: 12 }} />
              </div>
              <input type="number" min={1} value={it.quantity_ordered}
                onChange={(e) => updateItem(i, "quantity_ordered", e.target.value)}
                style={{ ...inputStyle, height: 30, textAlign: "right", fontSize: 12 }} />
              <span style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                ¥{formatYen(lineTotal)}
              </span>
              <button onClick={() => deleteItem(i)} title="この明細を削除" style={{
                background: "none", border: "none", cursor: "pointer", color: T.PLX_INK_400,
                fontSize: 14, padding: 4, borderRadius: T.RADIUS_SM,
              }}
                onMouseEnter={(e) => { e.currentTarget.style.color = T.PLX_RED_600; e.currentTarget.style.background = T.PLX_RED_100; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = T.PLX_INK_400; e.currentTarget.style.background = "none"; }}>
                🗑
              </button>
            </div>
          );
        })}
        {visibleItems.length === 0 && (
          <div style={{ padding: "16px", color: T.PLX_INK_400, fontSize: 12, textAlign: "center" }}>明細がありません</div>
        )}
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.PLX_LINE_100}` }}>
          <button onClick={addBlankItem} style={{
            padding: "6px 14px", borderRadius: T.RADIUS_MD, border: `1px dashed ${T.PLX_LINE_200}`,
            background: T.PLX_CARD_BG, fontSize: 12, fontWeight: 600, cursor: "pointer",
            color: T.PLX_INK_700, display: "inline-flex", alignItems: "center", gap: 6,
          }}>＋ 明細を追加</button>
        </div>
      </div>
    </>
  );
}

// Create form — supplier / branch dropdowns, ETA, note, line-item editor.
// Mirrors the mockup's 発注書 create intent; posts to POST /purchase-orders
// (status=draft) and hands the new PO's id to onCreated.
function POCreateModal({ vendors, branches, onClose, onCreated }) {
  const productsQ = useFetch(() => api.listProducts({ status: "active", limit: 100 }), []);
  const products = (productsQ.data?.items || []).filter((p) => p.default_variant_id);

  const [vendorId, setVendorId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [eta, setEta] = React.useState("");
  const [note, setNote] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    // Sensible defaults once ref data arrives: single-branch stores shouldn't
    // have to pick the only branch.
    if (!branchId && branches.length === 1) setBranchId(String(branches[0].id));
  }, [branches]);

  const inputStyle = {
    width: "100%", height: 36, padding: "0 10px", borderRadius: T.RADIUS_MD,
    border: `1px solid ${T.PLX_LINE_200}`, fontSize: 13, color: T.PLX_INK_900,
    boxSizing: "border-box", outline: "none", background: T.PLX_CARD_BG,
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: T.PLX_INK_500, marginBottom: 4, display: "block" };

  const addItem = () => setItems((p) => [...p, { variant_id: null, product_name: "", sku: "", quantity_ordered: 1, unit_cost: "0" }]);
  const updateItem = (idx, key, value) => setItems((p) => p.map((it, i) => i === idx ? { ...it, [key]: value } : it));
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + Number(it.unit_cost || 0) * Number(it.quantity_ordered || 0), 0);

  async function handleCreate() {
    if (busy) return;
    if (!vendorId) { window.PLX_TOAST.warn("仕入先を選択してください"); return; }
    if (!branchId) { window.PLX_TOAST.warn("拠点を選択してください"); return; }
    if (items.some((it) => !it.variant_id)) {
      window.PLX_TOAST.warn("商品が選択されていない明細があります"); return;
    }
    if (items.some((it) => Number(it.quantity_ordered) < 1)) {
      window.PLX_TOAST.warn("数量は1以上を入力してください"); return;
    }
    setBusy(true);
    try {
      const po = await api.createPurchaseOrder({
        supplier_vendor_id: Number(vendorId),
        destination_branch_id: Number(branchId),
        estimated_arrival: eta || null,
        note: note || null,
        items: items.map((it) => ({
          variant_id: it.variant_id,
          quantity_ordered: Number(it.quantity_ordered),
          unit_cost: String(it.unit_cost || "0"),
        })),
      });
      onCreated(po);
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail ?? "発注書の作成に失敗しました");
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, boxShadow: T.SHADOW_LG || "0 8px 32px rgba(0,0,0,0.18)",
        padding: 24, width: 720, maxWidth: "94vw", maxHeight: "86vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>発注書を作成</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.PLX_INK_400 }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>仕入先 <span style={{ color: T.PLX_RED_600 }}>*</span></label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} style={inputStyle}>
              <option value="" disabled>選択してください…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>拠点 <span style={{ color: T.PLX_RED_600 }}>*</span></label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={inputStyle}>
              <option value="" disabled>選択してください…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>納品予定日</label>
            <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} style={inputStyle} />
          </div>
          <div />
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>備考</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} rows={2}
              placeholder="社内メモ・特記事項があれば入力（任意）"
              style={{ ...inputStyle, height: "auto", padding: "8px 10px", fontFamily: "inherit", resize: "vertical" }} />
            <div style={{ fontSize: 10, color: T.PLX_INK_400, marginTop: 2, textAlign: "right" }}>{note.length} / 200</div>
          </div>
        </div>

        {/* Line items */}
        <div style={{ border: `1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_MD, overflow: "hidden", marginBottom: 12 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 110px 80px 110px 36px",
            padding: "7px 12px", fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
            background: T.PLX_SURFACE_50, borderBottom: `1px solid ${T.PLX_LINE_200}`, gap: 8,
          }}>
            <span>商品</span>
            <span style={{ textAlign: "right" }}>単価</span>
            <span style={{ textAlign: "right" }}>数量</span>
            <span style={{ textAlign: "right" }}>行合計</span>
            <span />
          </div>
          {items.length === 0 && (
            <div style={{ padding: 14, fontSize: 12, color: T.PLX_INK_400, textAlign: "center" }}>
              明細はまだありません。下書きのまま保存して後から追加もできます。
            </div>
          )}
          {items.map((it, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr 110px 80px 110px 36px",
              padding: "8px 12px", fontSize: 12, alignItems: "center", gap: 8,
              borderBottom: `1px solid ${T.PLX_LINE_100}`,
            }}>
              <select
                value={it.variant_id ?? ""}
                onChange={(e) => {
                  const p = products.find((x) => String(x.default_variant_id) === e.target.value);
                  if (!p) return;
                  updateItem(i, "variant_id", p.default_variant_id);
                  updateItem(i, "product_name", p.name);
                  updateItem(i, "sku", p.default_sku || "");
                  if (p.default_cost != null) updateItem(i, "unit_cost", String(p.default_cost));
                }}
                style={{ ...inputStyle, height: 32, fontSize: 12 }}>
                <option value="" disabled>商品を選択してください…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.default_variant_id}>
                    {p.name} {p.default_sku ? `（${p.default_sku}）` : ""}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: T.PLX_INK_500 }}>¥</span>
                <input type="number" min={0} value={it.unit_cost}
                  onChange={(e) => updateItem(i, "unit_cost", e.target.value)}
                  style={{ ...inputStyle, height: 30, textAlign: "right", fontSize: 12 }} />
              </div>
              <input type="number" min={1} value={it.quantity_ordered}
                onChange={(e) => updateItem(i, "quantity_ordered", e.target.value)}
                style={{ ...inputStyle, height: 30, textAlign: "right", fontSize: 12 }} />
              <span style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                ¥{formatYen(Number(it.unit_cost || 0) * Number(it.quantity_ordered || 0))}
              </span>
              <button onClick={() => removeItem(i)} title="この明細を削除" style={{
                background: "none", border: "none", cursor: "pointer", color: T.PLX_INK_400,
                fontSize: 14, padding: 4, borderRadius: T.RADIUS_SM,
              }}>🗑</button>
            </div>
          ))}
          <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={addItem} style={{
              padding: "6px 14px", borderRadius: T.RADIUS_MD, border: `1px dashed ${T.PLX_LINE_200}`,
              background: T.PLX_CARD_BG, fontSize: 12, fontWeight: 600, cursor: "pointer",
              color: T.PLX_INK_700,
            }}>＋ 明細を追加</button>
            <span style={{ fontSize: 12 }}>小計 <b style={{ fontSize: 14 }}>¥{formatYen(subtotal)}</b></span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} disabled={busy} style={{
            padding: "8px 18px", borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
            background: T.PLX_CARD_BG, fontSize: 13, cursor: "pointer", color: T.PLX_INK_700,
          }}>キャンセル</button>
          <button onClick={handleCreate} disabled={busy} style={{
            ...btnPrimary, opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer",
          }}>{busy ? "作成中…" : "下書きとして作成"}</button>
        </div>
      </div>
    </div>
  );
}

function POReceiveModal({ po, onClose, onDone }) {
  const items = po.items || [];
  const [qtys, setQtys] = React.useState(() =>
    Object.fromEntries(items.map((it) => [it.id, it.quantity_ordered - it.quantity_received]))
  );
  // Optional per-line lot capture (migration 014) — creates a real lot row.
  const [lots, setLots] = React.useState({});     // item_id -> lot number string
  const [expiries, setExpiries] = React.useState({}); // item_id -> YYYY-MM-DD
  const [busy, setBusy] = React.useState(false);

  async function handleReceive() {
    setBusy(true);
    try {
      const payload = items
        .map((it) => ({
          item_id: it.id,
          quantity_received: Number(qtys[it.id] ?? 0),
          lot_number: (lots[it.id] || "").trim() || null,
          expiry_date: expiries[it.id] || null,
        }))
        .filter((x) => x.quantity_received > 0);
      if (payload.length === 0) { window.PLX_TOAST.warn("入荷数を1以上入力してください"); setBusy(false); return; }
      await api.receivePurchaseOrder(po.id, payload);
      window.PLX_TOAST.success("入荷を記録しました");
      onDone();
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail ?? "入荷記録に失敗しました");
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, boxShadow: T.SHADOW_LG || "0 8px 32px rgba(0,0,0,0.18)",
        padding: 24, width: 520, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>入荷を記録</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.PLX_INK_400 }}>✕</button>
        </div>
        {items.length === 0 && <div style={{ color: T.PLX_INK_400, fontSize: 13, marginBottom: 16 }}>明細がありません</div>}
        {items.map((it) => {
          const remaining = it.quantity_ordered - it.quantity_received;
          return (
            <div key={it.id} style={{ padding: "10px 0", borderBottom: `1px solid ${T.PLX_LINE_100}` }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 100px 100px", gap: 12, alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{it.product_name || `商品 ID: ${it.variant_id}`}</div>
                  <div style={{ fontSize: 11, color: T.PLX_INK_400 }}>
                    {it.sku && <span style={{ fontFamily: T.FONT_MONO, marginRight: 8 }}>{it.sku}</span>}
                    発注数: {it.quantity_ordered}　入荷済: {it.quantity_received}　残: {remaining}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.PLX_INK_500, textAlign: "center" }}>今回の入荷数</div>
                <input
                  type="number" min={0} max={remaining}
                  value={qtys[it.id] ?? 0}
                  onChange={(e) => setQtys((prev) => ({ ...prev, [it.id]: e.target.value }))}
                  style={{
                    width: "100%", height: 34, padding: "0 10px", borderRadius: T.RADIUS_MD,
                    border: `1px solid ${T.PLX_LINE_200}`, fontSize: 13, textAlign: "right",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {/* Optional lot capture — fills the real ロット履歴 tab (migration 014) */}
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: T.PLX_INK_400, flexShrink: 0 }}>ロット (任意)</span>
                <input
                  type="text" placeholder="LOT-2026-001"
                  value={lots[it.id] || ""}
                  onChange={(e) => setLots((p) => ({ ...p, [it.id]: e.target.value }))}
                  style={{
                    flex: 1, height: 30, padding: "0 10px", borderRadius: T.RADIUS_MD,
                    border: `1px solid ${T.PLX_LINE_200}`, fontSize: 11,
                    fontFamily: T.FONT_MONO, boxSizing: "border-box", background: T.PLX_CARD_BG,
                    color: T.PLX_INK_900,
                  }}
                />
                <input
                  type="date"
                  value={expiries[it.id] || ""}
                  onChange={(e) => setExpiries((p) => ({ ...p, [it.id]: e.target.value }))}
                  title="使用期限 (任意)"
                  style={{
                    height: 30, padding: "0 8px", borderRadius: T.RADIUS_MD,
                    border: `1px solid ${T.PLX_LINE_200}`, fontSize: 11,
                    boxSizing: "border-box", background: T.PLX_CARD_BG, color: T.PLX_INK_900,
                  }}
                />
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{
            padding: "8px 18px", borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_LINE_200}`,
            background: T.PLX_CARD_BG, fontSize: 13, cursor: "pointer", color: T.PLX_INK_700,
          }}>キャンセル</button>
          <button onClick={handleReceive} disabled={busy} style={{
            ...btnPrimary, opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer",
          }}>{busy ? "記録中…" : "入荷を確定する"}</button>
        </div>
      </div>
    </div>
  );
}

function DetailKV({ k, v }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.PLX_INK_500, fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.PLX_INK_900, marginTop: 2 }}>{v}</div>
    </div>
  );
}

window.PurchaseOrders = PurchaseOrders;
window.PurchaseOrderDetail = PurchaseOrderDetail;
window.PlxDetailKV = DetailKV;
window.POStatusPill = POStatusPill;  // reused by the vendor detail 発注履歴 tab
