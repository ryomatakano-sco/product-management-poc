// Inventory page — aggregate view of every product's stock + status.
// Brief §4.6 calls for KPI strip + filter card + quick-filter chips + table
// + history sub-section. The PoC backend has no per-branch stock yet, so
// branch filtering is accepted but doesn't change results (gracefully).

function Inventory({ query }) {
  const [statusFilter, setStatusFilter] = React.useState(query?.status || "");
  const [itemTypeFilter, setItemTypeFilter] = React.useState("");
  const [branchFilter, setBranchFilter] = React.useState(""); // per-branch (migration 012)
  const [q, setQ] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  // Client-side pagination — the fetch grabs up to 200 rows (PoC scale) and
  // the pager slices locally so the KPI strip stays whole-dataset accurate.
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  React.useEffect(() => { setPage(1); }, [statusFilter, itemTypeFilter, branchFilter, q, pageSize]);

  const branchesQ = useFetch(() => api.listBranches(), []);
  const branches = branchesQ.data?.items ?? [];

  const inventoryQ = useFetch(
    () => api.listInventory({
      status: statusFilter || undefined,
      item_type: itemTypeFilter || undefined,
      branch_id: branchFilter || undefined,
      q: q || undefined,
      limit: 200,
    }),
    [statusFilter, itemTypeFilter, branchFilter, q],
  );

  const allItems = inventoryQ.data?.items ?? [];
  // Column sorting over the full set, before the page slice.
  const sorter = usePlxSort(null);
  const sortedAll = React.useMemo(() => sorter.apply(allItems, {
    product:   (r) => r.product?.name,
    item_type: (r) => r.product?.item_type,
    on_hand:   (r) => r.on_hand ?? 0,
    committed: (r) => r.committed ?? 0,
    available: (r) => r.available ?? 0,
    expiry:    (r) => r.earliest_expiry_date,
    adjusted:  (r) => r.last_adjusted_at,
    status:    (r) => r.status,
  }), [allItems, sorter.sort]);
  const items = sortedAll.slice((page - 1) * pageSize, page * pageSize);

  // KPI strip — compute from the loaded rows (acceptable for PoC scale).
  const kpis = React.useMemo(() => {
    const total = allItems.length;
    const lowStock = allItems.filter((r) => r.status === "low_stock").length;
    const expiring = allItems.filter((r) => r.status === "expiring_soon").length;
    const outOfStock = allItems.filter((r) => r.status === "out_of_stock").length;
    return { total, lowStock, expiring, outOfStock };
  }, [allItems]);

  async function handleStocktakeCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      await api.downloadInventoryCsv({
        status: statusFilter || undefined,
        item_type: itemTypeFilter || undefined,
        branch_id: branchFilter || undefined,
        q: q || undefined,
      });
    } catch (e) {
      window.PLX_TOAST.error("棚卸しCSVのダウンロードに失敗しました");
    } finally { setExporting(false); }
  }

  // 在庫調整 flow: pick product/variant → reuse ProductDetail's adjust modal.
  // (The old button linked to /products/new — a product-create page, not an
  // adjustment — so this also fixes a broken affordance.)
  const [adjustFlow, setAdjustFlow] = React.useState(null); // null | {stage:"pick"} | {stage:"adjust", variant}
  const [histKey, setHistKey] = React.useState(0);

  // 棚卸しCSV re-import (reconciliation) — file input is hidden; result toast.
  const stocktakeInputRef = React.useRef(null);
  const [importing, setImporting] = React.useState(false);
  const handleStocktakeImport = async (file) => {
    if (!file || importing) return;
    setImporting(true);
    try {
      const r = await api.importStocktakeCsv(file, branchFilter || undefined);
      const errN = (r.errors || []).length;
      window.PLX_TOAST[errN ? "warn" : "success"](
        `棚卸し取込: ${r.adjusted} 件修正 / ${r.unchanged} 件変更なし${errN ? ` / ${errN} 行エラー` : ""}`);
      if (errN) console.warn("stocktake errors:", r.errors);
      inventoryQ.refetch();
      setHistKey((k) => k + 1);
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail || "棚卸しCSVの取込に失敗しました");
    } finally { setImporting(false); }
  };
  const [showTransfer, setShowTransfer] = React.useState(false);

  const headerRight = (
    <div style={{ display: "inline-flex", gap: 8 }}>
      <input ref={stocktakeInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
        onChange={(e) => { handleStocktakeImport(e.target.files?.[0]); e.target.value = ""; }} />
      <button onClick={() => stocktakeInputRef.current?.click()} disabled={importing} style={{
        ...btnSecondary, display: "inline-flex", alignItems: "center", gap: 6,
        opacity: importing ? 0.6 : 1,
      }}>{importing ? "取込中…" : "⬆ 棚卸しCSV取込"}</button>
      <button onClick={handleStocktakeCsv} disabled={exporting} style={{
        ...btnSecondary, display: "inline-flex", alignItems: "center", gap: 6,
        opacity: exporting ? 0.6 : 1,
      }}>⬇ 棚卸しCSVダウンロード</button>
      <button onClick={() => setShowTransfer(true)} style={{
        ...btnSecondary, display: "inline-flex", alignItems: "center", gap: 6,
      }}>⇄ 拠点間移動</button>
      <button data-tour="inv-adjust" onClick={() => setAdjustFlow({ stage: "pick" })} style={{
        ...btnPrimary, display: "inline-flex", alignItems: "center", gap: 6,
      }}>＋ 在庫調整</button>
    </div>
  );

  return (
    <AdminShell currentNav="inventory" breadcrumbs={["ホーム", "在庫"]}>
      <PlxPageHead title="在庫" subtitle={`全 ${kpis.total} 件の在庫状況`} right={headerRight} />

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 16 }}>
        <KpiTile label="総在庫点数" value={allItems.reduce((s, r) => s + (r.on_hand || 0), 0)} unit="点" tone="green"/>
        <KpiTile label="在庫金額 (税抜)" value={`¥${formatYen(allItems.reduce((s, r) => s + (r.value_jpy || 0), 0))}`} unit="" tone="green"/>
        <KpiTile label="在庫低下" value={kpis.lowStock} unit="件"
          tone={kpis.lowStock > 0 ? "amber" : "muted"}
          onClick={() => setStatusFilter("low_stock")} clickable/>
        <KpiTile label="期限間近" value={kpis.expiring} unit="件"
          tone={kpis.expiring > 0 ? "red" : "muted"}
          onClick={() => setStatusFilter("expiring_soon")} clickable/>
        <KpiTile label="在庫切れ" value={kpis.outOfStock} unit="件"
          tone={kpis.outOfStock > 0 ? "red" : "muted"}
          onClick={() => setStatusFilter("out_of_stock")} clickable/>
      </div>

      {/* Filter card */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", marginBottom: 14,
      }}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="商品名・SKUで検索…" style={{ ...formInput, maxWidth: 280, flex: 1 }} />
        <Select value={branchFilter} onChange={setBranchFilter} options={[
          { value: "", label: "拠点: 全拠点" },
          ...branches.map((b) => ({ value: String(b.id), label: b.name })),
        ]} />
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
        {(statusFilter || itemTypeFilter || q || branchFilter) && (
          <button onClick={() => { setStatusFilter(""); setItemTypeFilter(""); setQ(""); setBranchFilter(""); }}
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
          gridTemplateColumns: "2.2fr 0.7fr 0.7fr 0.7fr 0.9fr 1fr 0.8fr",
          columnGap: 16,
          padding: "12px 18px", fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
          background: T.PLX_SURFACE_50, borderBottom: `1px solid ${T.PLX_LINE_200}`,
          letterSpacing: ".03em",
        }}>
          <PlxSortHeader label="商品 / SKU" k="product" sort={sorter.sort} onToggle={sorter.toggle} />
          <PlxSortHeader label="種別" k="item_type" sort={sorter.sort} onToggle={sorter.toggle} />
          <PlxSortHeader label="在庫" k="on_hand" sort={sorter.sort} onToggle={sorter.toggle} style={{ textAlign: "right" }} />
          <PlxSortHeader label="利用可能" k="available" sort={sorter.sort} onToggle={sorter.toggle} style={{ textAlign: "right" }} />
          <PlxSortHeader label="使用期限" k="expiry" sort={sorter.sort} onToggle={sorter.toggle} />
          <PlxSortHeader label="最終調整" k="adjusted" sort={sorter.sort} onToggle={sorter.toggle} />
          <PlxSortHeader label="状態" k="status" sort={sorter.sort} onToggle={sorter.toggle} style={{ textAlign: "center" }} />
        </div>

        {inventoryQ.loading && (
          <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>
        )}
        {!inventoryQ.loading && allItems.length === 0 && (
          <PlxEmptyState
            title="該当する在庫がありません"
            message="フィルタ条件を変更してお試しください。"
          />
        )}
        {items.map((r, i) => (
          <div key={`${r.product.id}-${i}`} onClick={() => navigate(`/products/${r.product.id}`)}
            {...plxClickable(() => navigate(`/products/${r.product.id}`))} style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 0.7fr 0.7fr 0.7fr 0.9fr 1fr 0.8fr",
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
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700,
              color: r.available <= 10 ? T.PLX_AMBER_700 : T.PLX_INK_900 }}>{r.available}</span>
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

        {/* Pagination footer */}
        {!inventoryQ.loading && allItems.length > 0 && (
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
              <span>{`${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, allItems.length)} 件 / 全 ${allItems.length} 件`}</span>
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
                disabled={page * pageSize >= allItems.length}
                style={{ ...btnSecondary, height: 30, padding: "0 12px",
                  opacity: page * pageSize >= allItems.length ? 0.5 : 1 }}
              >次へ →</button>
            </div>
          </div>
        )}
      </div>

      {/* 最近の調整履歴 — cross-variant audit trail (mockup bottom section) */}
      <ApprovalQueue refreshKey={histKey} onDecided={() => { inventoryQ.refetch(); setHistKey((k) => k + 1); }} />
      <RecentAdjustments refreshKey={histKey} />

      {adjustFlow?.stage === "pick" && (
        <AdjustProductPicker
          onClose={() => setAdjustFlow(null)}
          onPicked={(variant) => setAdjustFlow({ stage: "adjust", variant })}
        />
      )}
      {showTransfer && (
        <BranchTransferModal
          branches={branches}
          onClose={() => setShowTransfer(false)}
          onDone={() => {
            setShowTransfer(false);
            inventoryQ.refetch();
            setHistKey((k) => k + 1);
          }}
        />
      )}

      {adjustFlow?.stage === "adjust" && (
        <PlxInventoryAdjustModal
          variant={adjustFlow.variant}
          onClose={() => setAdjustFlow(null)}
          onApplied={(res) => {
            setAdjustFlow(null);
            if (res?.pending_approval) {
              window.PLX_TOAST.warn("管理者の承認待ちになりました（在庫はまだ変更されていません）");
            } else {
              window.PLX_TOAST.success("在庫を調整しました");
            }
            inventoryQ.refetch();
            setHistKey((k) => k + 1);
          }}
        />
      )}
    </AdminShell>
  );
}

// 拠点間移動 — POST /inventory/transfer: −qty at 移動元, +qty at 移動先,
// atomic with a paired reason='transfer' audit trail (migration 015).
function BranchTransferModal({ branches, onClose, onDone }) {
  const [search, setSearch] = React.useState("");
  const productsQ = useFetch(
    () => api.listProducts({ status: "active", limit: 100, q: search.trim() || undefined }),
    [search],
  );
  const products = (productsQ.data?.items || []).filter((p) => p.default_variant_id);
  const [productId, setProductId] = React.useState("");
  const detailQ = useFetch(
    () => productId ? api.getProduct(Number(productId)) : Promise.resolve(null),
    [productId],
  );
  const variants = detailQ.data?.variants || [];
  const [variantId, setVariantId] = React.useState("");
  React.useEffect(() => {
    if (variants.length > 0) {
      const def = variants.find((v) => v.is_default) || variants[0];
      setVariantId(String(def.id));
    } else setVariantId("");
  }, [detailQ.data]);
  const [fromBranch, setFromBranch] = React.useState("");
  const [toBranch, setToBranch] = React.useState("");
  const [qty, setQty] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (branches.length > 0 && !fromBranch) {
      const main = branches.find((b) => b.branch_type === "main") || branches[0];
      setFromBranch(String(main.id));
      const other = branches.find((b) => String(b.id) !== String(main.id));
      if (other) setToBranch(String(other.id));
    }
  }, [branches]);

  const submit = async () => {
    if (busy) return;
    if (!variantId) { window.PLX_TOAST.warn("商品を選択してください"); return; }
    if (!fromBranch || !toBranch || fromBranch === toBranch) {
      window.PLX_TOAST.warn("異なる移動元・移動先を選択してください"); return;
    }
    if (Number(qty) < 1) { window.PLX_TOAST.warn("数量は1以上を入力してください"); return; }
    setBusy(true);
    try {
      await api.transferStock({
        variant_id: Number(variantId),
        from_branch_id: Number(fromBranch),
        to_branch_id: Number(toBranch),
        quantity: Number(qty),
        note: note || null,
      });
      window.PLX_TOAST.success("拠点間の在庫移動を記録しました");
      onDone();
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail || "移動に失敗しました");
      setBusy(false);
    }
  };

  const branchOpts = branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>);
  return (
    <PlxModal title="拠点間で在庫を移動" onClose={onClose}>
      <FormRow label="商品">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="商品名・SKUで絞り込み…"
          style={{ ...formInput, marginBottom: 6 }}
        />
        <select value={productId} onChange={(e) => setProductId(e.target.value)} style={formInput}>
          <option value="" disabled>選択してください…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} {p.default_sku ? `（${p.default_sku}）` : ""}</option>
          ))}
        </select>
      </FormRow>
      {variants.length > 1 && (
        <FormRow label="バリアント">
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)} style={formInput}>
            {variants.map((v) => <option key={v.id} value={v.id}>{v.sku || `#${v.id}`}</option>)}
          </select>
        </FormRow>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormRow label="移動元">
          <select value={fromBranch} onChange={(e) => setFromBranch(e.target.value)} style={formInput}>{branchOpts}</select>
        </FormRow>
        <FormRow label="移動先">
          <select value={toBranch} onChange={(e) => setToBranch(e.target.value)} style={formInput}>{branchOpts}</select>
        </FormRow>
      </div>
      <FormRow label="数量">
        <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)}
          style={{ ...formInput, maxWidth: 140 }} />
      </FormRow>
      <FormRow label="メモ（任意）">
        <input value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="例: 梅田分院の欠品補充" style={formInput} />
      </FormRow>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
        <button onClick={onClose} style={btnSecondary}>キャンセル</button>
        <button onClick={submit} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>
          {busy ? "移動中…" : "移動を実行"}
        </button>
      </div>
    </PlxModal>
  );
}

// Step 1 of the 在庫調整 flow: choose product (and variant when several),
// then hand the full variant object to the shared adjust modal.
function AdjustProductPicker({ onClose, onPicked }) {
  const [search, setSearch] = React.useState("");
  const productsQ = useFetch(
    () => api.listProducts({ status: "active", limit: 100, q: search.trim() || undefined }),
    [search],
  );
  const products = (productsQ.data?.items || []).filter((p) => p.default_variant_id);
  const [productId, setProductId] = React.useState("");
  const detailQ = useFetch(
    () => productId ? api.getProduct(Number(productId)) : Promise.resolve(null),
    [productId],
  );
  const variants = detailQ.data?.variants || [];
  const [variantId, setVariantId] = React.useState("");
  React.useEffect(() => {
    if (variants.length > 0) {
      const def = variants.find((v) => v.is_default) || variants[0];
      setVariantId(String(def.id));
    } else setVariantId("");
  }, [detailQ.data]);
  const variant = variants.find((v) => String(v.id) === variantId);

  return (
    <PlxModal title="在庫調整 — 商品を選択" onClose={onClose}>
      <FormRow label="商品">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="商品名・SKUで絞り込み…"
          style={{ ...formInput, marginBottom: 6 }}
        />
        <select value={productId} onChange={(e) => setProductId(e.target.value)} style={formInput} size={products.length > 8 ? 6 : undefined}>
          <option value="" disabled>選択してください…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.default_sku ? `（${p.default_sku}）` : ""}
            </option>
          ))}
        </select>
      </FormRow>
      {variants.length > 1 && (
        <FormRow label="バリアント">
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)} style={formInput}>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.sku || `#${v.id}`}{v.option1_value ? ` — ${v.option1_value}` : ""}（在庫 {v.on_hand}）
              </option>
            ))}
          </select>
        </FormRow>
      )}
      {variant && (
        <div style={{
          padding: 10, background: T.PLX_SURFACE_50, borderRadius: T.RADIUS_MD,
          fontSize: 12, color: T.PLX_INK_700, marginBottom: 8,
        }}>
          現在の在庫: <b>{variant.on_hand}</b>　引当: {variant.committed}　使用不可: {variant.unavailable}
        </div>
      )}
      {productId && detailQ.loading && (
        <div style={{ fontSize: 12, color: T.PLX_INK_500, marginBottom: 8 }}>読み込み中…</div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
        <button onClick={onClose} style={btnSecondary}>キャンセル</button>
        <button onClick={() => variant && onPicked(variant)} disabled={!variant}
          style={{ ...btnPrimary, opacity: variant ? 1 : 0.5 }}>次へ →</button>
      </div>
    </PlxModal>
  );
}

const ADJ_REASON_JA = {
  manual: "手動調整",
  sale: "販売",
  purchase_order_received: "入荷",
  correction: "棚卸修正",
  damage: "破損",
  refund: "返品",
  transfer: "拠点間移動",
  other: "その他",
};

function RecentAdjustments({ refreshKey }) {
  const q = useFetch(() => api.listRecentAdjustments({ limit: 10 }), [refreshKey]);
  const rows = q.data?.items ?? [];
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      boxShadow: T.SHADOW_SM, overflow: "hidden", marginTop: 18,
    }}>
      <div style={{
        padding: "12px 18px", fontSize: 13, fontWeight: 700,
        borderBottom: `1px solid ${T.PLX_LINE_200}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>最近の調整履歴</span>
        <span style={{ fontSize: 11, color: T.PLX_INK_500, fontWeight: 500 }}>
          {`直近 ${rows.length} 件 / 全 ${q.data?.total ?? 0} 件`}
        </span>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1.1fr 2fr 0.9fr 0.6fr 2fr",
        padding: "10px 18px", fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
        background: T.PLX_SURFACE_50, borderBottom: `1px solid ${T.PLX_LINE_200}`, columnGap: 14,
      }}>
        <span>日時</span><span>商品</span><span>タイプ</span>
        <span style={{ textAlign: "right" }}>数量</span><span>メモ</span>
      </div>
      {q.loading && <div style={{ padding: 24, textAlign: "center", color: T.PLX_INK_500, fontSize: 12 }}>読み込み中…</div>}
      {!q.loading && rows.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: T.PLX_INK_400, fontSize: 12 }}>調整履歴はまだありません。</div>
      )}
      {rows.map((a, i) => (
        <div key={a.id} onClick={() => a.product_id && navigate(`/products/${a.product_id}`)}
          {...(a.product_id ? plxClickable(() => navigate(`/products/${a.product_id}`)) : {})} style={{
          display: "grid", gridTemplateColumns: "1.1fr 2fr 0.9fr 0.6fr 2fr",
          padding: "11px 18px", alignItems: "center", fontSize: 12, columnGap: 14,
          borderBottom: i < rows.length - 1 ? `1px solid ${T.PLX_LINE_100}` : "none",
          cursor: a.product_id ? "pointer" : "default",
        }}
          onMouseEnter={(e) => e.currentTarget.style.background = T.PLX_SURFACE_50}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <span style={{ fontSize: 11, color: T.PLX_INK_500 }}>{formatJpDateTime(a.created_at)}</span>
          <div>
            <div style={{ fontWeight: 600, color: T.PLX_INK_900 }}>{a.product_name}</div>
            {a.sku && <div style={{ fontSize: 10, color: T.PLX_INK_500, fontFamily: T.FONT_MONO }}>{a.sku}</div>}
          </div>
          <span style={{ fontSize: 11, color: T.PLX_INK_700 }}>{ADJ_REASON_JA[a.reason] || a.reason}</span>
          <span style={{
            textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700,
            color: a.delta > 0 ? T.PLX_GREEN_700 : a.delta < 0 ? T.PLX_RED_600 : T.PLX_INK_500,
          }}>{a.delta > 0 ? `▲ +${a.delta}` : a.delta < 0 ? `▼ ${Math.abs(a.delta)}` : a.delta}</span>
          <span style={{ fontSize: 11, color: T.PLX_INK_500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.note || "—"}
            {a.created_by && <span style={{ color: T.PLX_INK_400 }}>　by {a.created_by}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "low_stock")     return <Pill color={T.PLX_AMBER_700} bg={T.PLX_AMBER_100}>● 在庫低下</Pill>;
  if (status === "expiring_soon") return <Pill color={T.PLX_RED_600} bg={T.PLX_RED_100}>● 期限間近</Pill>;
  if (status === "out_of_stock")  return <Pill color={T.PLX_RED_600} bg={T.PLX_RED_100}>在庫切れ</Pill>;
  return <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>通常</Pill>;
}

function KpiTile({ label, value, unit, tone, onClick, clickable, extra }) {
  const color = tone === "red" ? T.PLX_RED_600 :
                tone === "amber" ? T.PLX_AMBER_700 :
                tone === "muted" ? T.PLX_INK_500 :
                T.PLX_GREEN_600;
  return (
    <div onClick={clickable ? onClick : undefined}
      {...(clickable ? plxClickable(onClick) : {})} style={{
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
                tone === "amber" ? T.PLX_AMBER_700 :
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

// 承認待ちキュー (mig 018) — スタッフ発の在庫調整。管理者には 承認/却下
// ボタン、スタッフには自分のリクエストの状態が見える。
function ApprovalQueue({ refreshKey, onDecided }) {
  const q = useFetch(() => api.listApprovals({ limit: 10 }), [refreshKey]);
  const isAdmin = window.PLX_ME?.role === "admin";
  const [busyId, setBusyId] = React.useState(null);
  const items = (q.data?.items || []).filter((r) => r.status === "pending");
  if (q.error || items.length === 0) return null;
  const decide = async (r, ok) => {
    if (busyId) return;
    setBusyId(r.id);
    try {
      if (ok) await api.approveRequest(r.id);
      else await api.rejectRequest(r.id);
      window.PLX_TOAST.success(ok ? "承認して適用しました" : "却下しました");
      q.refetch();
      onDecided?.();
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail || "処理に失敗しました");
    } finally { setBusyId(null); }
  };
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG,
      border: `1px solid ${T.PLX_AMBER_300 || "#fcd34d"}`,
      boxShadow: T.SHADOW_SM, overflow: "hidden", marginTop: 18,
    }}>
      <div style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, borderBottom: `1px solid ${T.PLX_LINE_200}`, color: T.PLX_AMBER_700 || "#b45309" }}>
        {`⏳ 承認待ちの在庫調整 (${items.length})`}
      </div>
      {items.map((r) => (
        <div key={r.id} style={{
          display: "grid", gridTemplateColumns: "130px 1fr 140px auto",
          gap: 12, padding: "9px 16px", alignItems: "center",
          borderBottom: `1px solid ${T.PLX_LINE_100}`, fontSize: 12,
        }}>
          <span style={{ color: T.PLX_INK_500, fontFamily: T.FONT_MONO, fontSize: 11 }}>
            {r.created_at ? new Date(r.created_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
          </span>
          <span style={{ color: T.PLX_INK_900, fontWeight: 600 }}>{r.summary || r.kind}</span>
          <span style={{ color: T.PLX_INK_500 }}>{`申請: ${r.requested_by || "—"}`}</span>
          {isAdmin ? (
            <span style={{ display: "flex", gap: 8 }}>
              <button disabled={busyId === r.id} onClick={() => decide(r, true)} style={{
                padding: "5px 12px", borderRadius: T.RADIUS_MD, border: "none",
                background: T.PLX_GREEN_600, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
                opacity: busyId === r.id ? 0.6 : 1,
              }}>✓ 承認</button>
              <button disabled={busyId === r.id} onClick={() => decide(r, false)} style={{
                padding: "5px 12px", borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_RED_300 || "#fca5a5"}`,
                background: "transparent", color: T.PLX_RED_600, fontSize: 11, fontWeight: 700, cursor: "pointer",
                opacity: busyId === r.id ? 0.6 : 1,
              }}>✕ 却下</button>
            </span>
          ) : (
            <span style={{ color: T.PLX_AMBER_700, fontWeight: 700, fontSize: 11 }}>承認待ち</span>
          )}
        </div>
      ))}
    </div>
  );
}

