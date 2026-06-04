// Product Create — form + AI Assist modal. Real backend call to /ai-suggestions
// (returns mock data when OPENAI_API_KEY isn't set; real OpenAI when it is).

// Strip everything except digits + an optional single decimal point. Lets
// the user type fast (no awkward IME interactions like type="number") while
// still ensuring no Japanese commas, ¥ marks, or kanji sneak through.
function _keepDecimal(s) {
  if (typeof s !== "string") return s;
  // Allow only [0-9.]; collapse multiple dots to a single one (keep first).
  const cleaned = s.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}
function _keepInteger(s) {
  if (typeof s !== "string") return s;
  return s.replace(/[^0-9]/g, "");
}

// --- Master-list matching ---------------------------------------------------
// AI free-generates brand/category strings off web pages ("サンスター株式会社",
// "歯磨き粉"); the store's master list stores a canonical spelling ("サンスター",
// "歯磨剤"). A raw === silently fails on every variant, leaving the dropdown
// empty. `_normMaster` canonicalises both sides so a normalised compare matches
// the common variants without introducing fuzzy false-positives.
//
// Steps: NFKC (full-width → ASCII, combine) → lower-case → strip ALL whitespace
// (incl. full-width 　) → strip common company suffixes/affixes → trim leftover
// punctuation. Kept deliberately conservative: it only removes legal-entity
// noise and spacing, never partial-matches distinct names.
const _COMPANY_AFFIXES = [
  // Japanese legal-entity forms, parenthesised or bare.
  "株式会社", "(株)", "（株）", "㈱",
  "有限会社", "(有)", "（有）", "㈲",
  "合同会社", "合資会社", "合名会社",
  "医療法人", "一般社団法人",
  // Latin forms (after lower-casing + space-strip, so match lowercased/spaceless).
  "co.,ltd.", "co.,ltd", "co.ltd.", "co.ltd", "co.,ltd.,",
  "ltd.", "ltd", "inc.", "inc", "corp.", "corp", "k.k.", "kk",
];
function _normMaster(s) {
  if (typeof s !== "string") return "";
  let t = s.normalize("NFKC").toLowerCase();
  // Strip every kind of whitespace, including the full-width space NFKC leaves.
  t = t.replace(/[\s　]+/g, "");
  // Remove company affixes wherever they appear (prefix or suffix).
  for (const aff of _COMPANY_AFFIXES) {
    t = t.split(aff).join("");
  }
  // Drop leftover wrapping punctuation/brackets that affixes were inside of.
  t = t.replace(/[()（）「」【】・,，.。]/g, "");
  return t.trim();
}

// Find the master-list row whose `field` matches `aiValue` after normalisation.
// Tries exact === first (fast path, preserves prior behaviour), then the
// normalised compare. Returns the row or undefined — never a partial guess.
function _matchMaster(items, field, aiValue) {
  if (!Array.isArray(items) || !aiValue) return undefined;
  const exact = items.find((x) => x[field] === aiValue);
  if (exact) return exact;
  const target = _normMaster(aiValue);
  if (!target) return undefined;
  return items.find((x) => _normMaster(x[field]) === target);
}

function ProductCreate({ editId }) {
  // When editId is set, we PATCH an existing product instead of POSTing a new
  // one. The form prefills from a GET of the existing product. Variants/tags
  // editing on this screen is limited to top-level fields; deep variant
  // edits stay in ProductDetail's inline 在庫調整 modal.
  const isEdit = !!editId;
  const categoriesQ = useFetch(() => api.listCategories(), []);
  const vendorsQ    = useFetch(() => api.listVendors(),    []);
  const tagsQ       = useFetch(() => api.listTags(),       []);
  const editingQ    = useFetch(
    () => isEdit ? api.getProduct(editId) : Promise.resolve(null),
    [editId]
  );

  const [name, setName]         = React.useState("");
  const [nameKana, setNameKana] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [vendorId, setVendorId]     = React.useState("");
  const [status, setStatus]     = React.useState("draft");
  const [tags, setTags]         = React.useState([]);
  const [tagInput, setTagInput] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [aiOpen, setAiOpen]     = React.useState(false);
  const [aiSessionId, setAiSessionId] = React.useState(null);
  // When the user clicked "不足項目をAIで補完", apply only to empty fields.
  const [aiGapFill, setAiGapFill] = React.useState(false);
  // Seed for the AI Assist modal. Populated when this page was reached via
  // the "AI で『…』を検索" CTA on ProductList or the command palette —
  // we stash a {mode, value} on window so the modal can open pre-filled.
  const [aiSeed, setAiSeed] = React.useState(null);
  React.useEffect(() => {
    // Run once on mount. Pull and clear so a subsequent direct visit
    // doesn't re-open the modal.
    const seed = window.PLX_AI_PREFILL;
    if (seed && (seed.value || "").trim()) {
      window.PLX_AI_PREFILL = null;
      setAiSeed(seed);
      setAiOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Yoshioka 2026-05-11 additions
  const [itemType, setItemType] = React.useState("product"); // product | consumable
  const [reorderUrl, setReorderUrl] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");    // YYYY-MM-DD
  const [lotNumber, setLotNumber] = React.useState("");
  const [unit, setUnit] = React.useState("個");
  const [variant, setVariant]   = React.useState({
    sku: "", barcode: "", price: "", cost: "", stock: "",
    opt1k: "", opt1v: "", isDefault: true,
    lowStockThreshold: "10",
    // Set in edit mode after the product loads. Used by save() to PATCH
    // the existing variant and compute the stock delta for an inventory
    // adjustment instead of creating a new variant.
    id: null,
    originalStock: 0,
  });

  // When loading an existing product for edit, prefill the form once the
  // data lands. Only runs in edit mode.
  const [prefilled, setPrefilled] = React.useState(false);
  React.useEffect(() => {
    if (!isEdit || !editingQ.data || prefilled) return;
    const p = editingQ.data;
    setName(p.name || "");
    setNameKana(p.name_kana || "");
    setCategoryId(p.category_id != null ? String(p.category_id) : "");
    setVendorId(p.vendor_id != null ? String(p.vendor_id) : "");
    setStatus(p.status || "draft");
    setTags(p.tags || []);
    setDescription(p.description || "");
    setItemType(p.item_type || "product");
    setReorderUrl(p.reorder_url || "");
    setExpiryDate(p.expiry_date || "");
    setLotNumber(p.lot_number || "");
    setUnit(p.unit || "個");
    const hv = (p.variants || []).find((v) => v.is_default) || (p.variants || [])[0] || {};
    setVariant({
      sku: hv.sku || "",
      barcode: hv.barcode || "",
      price: hv.price != null ? String(hv.price) : "",
      cost:  hv.cost  != null ? String(hv.cost)  : "",
      stock: hv.on_hand != null ? String(hv.on_hand) : "",
      opt1k: hv.option1_name  || "",
      opt1v: hv.option1_value || "",
      isDefault: hv.is_default != null ? hv.is_default : true,
      lowStockThreshold: hv.low_stock_threshold != null ? String(hv.low_stock_threshold) : "10",
      id: hv.id || null,
      originalStock: hv.on_hand != null ? hv.on_hand : 0,
    });
    setPrefilled(true);
  }, [isEdit, editingQ.data, prefilled]);
  const [saving, setSaving]     = React.useState(false);
  const [error, setError]       = React.useState(null);
  const [fieldErrors, setFieldErrors] = React.useState({});
  // When non-null, the ConfirmSaveModal is showing. Holds the status the
  // user picked so the modal can offer a final "保存する" button that
  // resumes the real save() with the same status.
  const [pendingSave, setPendingSave] = React.useState(null);

  // Required fields. Drafts only need a name (so the user can save partial work).
  // Publishing requires the full set so the product is actually usable.
  // Keep this function pure so the disabled state can call it on every render.
  const validate = (newStatus) => {
    const errs = {};
    if (!name.trim()) errs.name = "商品名は必須です";
    if (newStatus === "active") {
      if (!categoryId) errs.categoryId = "カテゴリは必須です（公開時）";
      if (!itemType) errs.itemType = "種別は必須です（公開時）";
      if (!variant.barcode || !variant.barcode.trim()) {
        errs.barcode = "JAN/バーコードは必須です（公開時）";
      }
      if (!variant.price || isNaN(Number(variant.price))) {
        errs.price = "販売価格は必須です（公開時）";
      }
    }
    return errs;
  };

  // True when publish-as-active is currently allowed.
  const canPublish = Object.keys(validate("active")).length === 0;
  const canDraft   = Object.keys(validate("draft")).length === 0;

  // save() is the user-facing entry point. It validates, then opens the
  // ConfirmSaveModal. The modal calls _doSave(status) to actually persist.
  const save = (newStatus) => {
    const errs = validate(newStatus);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError(Object.values(errs)[0]);
      return;
    }
    setError(null);
    setPendingSave(newStatus);
  };

  const _doSave = async (newStatus) => {
    setPendingSave(null);
    setSaving(true); setError(null);
    try {
      let resultId;
      if (isEdit) {
        // 1) Top-level product fields → PATCH /products/:id.
        await api.updateProduct(editId, {
          name,
          name_kana: nameKana || null,
          category_id: categoryId ? Number(categoryId) : null,
          vendor_id:   vendorId   ? Number(vendorId)   : null,
          description: description || null,
          status: newStatus,
          item_type: itemType,
          reorder_url: reorderUrl || null,
          expiry_date: itemType === "consumable" && expiryDate ? expiryDate : null,
          lot_number:  itemType === "consumable" ? (lotNumber || null) : null,
          unit:        itemType === "consumable" ? (unit || null) : null,
        });

        // 2) Variant fields → PATCH /variants/:id. ProductUpdate doesn't
        //    accept nested variants, so we hit the variant endpoint
        //    directly. Only sends fields whose value isn't blank to avoid
        //    accidentally clearing data when the form is partially filled.
        if (variant.id) {
          const variantBody = {};
          if (variant.sku !== "")     variantBody.sku = variant.sku || null;
          if (variant.barcode !== "") variantBody.barcode = variant.barcode || null;
          if (variant.price !== "")   variantBody.price = variant.price;
          if (variant.cost  !== "")   variantBody.cost  = variant.cost;
          if (variant.opt1k !== "")   variantBody.option1_name  = variant.opt1k || null;
          if (variant.opt1v !== "")   variantBody.option1_value = variant.opt1v || null;
          if (variant.lowStockThreshold !== "") {
            const lst = parseInt(variant.lowStockThreshold, 10);
            if (Number.isFinite(lst) && lst >= 0) variantBody.low_stock_threshold = lst;
          }
          if (Object.keys(variantBody).length > 0) {
            await api.updateVariant(variant.id, variantBody);
          }

          // 3) Stock change → inventory adjustment with the delta. Stock
          //    isn't on VariantUpdate by design (it must go through the
          //    audit-logged adjustment endpoint), so we compute the delta
          //    from the prefilled originalStock and post one adjustment.
          const newStock = variant.stock === "" ? null : parseInt(variant.stock, 10);
          if (newStock != null && !Number.isNaN(newStock) && newStock !== variant.originalStock) {
            const delta = newStock - variant.originalStock;
            await api.adjustInventory(variant.id, {
              field: "on_hand",
              delta,
              reason: "correction",
              note: "編集画面からの在庫修正",
            });
          }
        }
        resultId = editId;
      } else {
        const created = await api.createProduct({
          name,
          name_kana: nameKana || null,
          category_id: categoryId ? Number(categoryId) : null,
          vendor_id:   vendorId   ? Number(vendorId)   : null,
          description: description || null,
          status: newStatus,
          ai_session_id: aiSessionId,
          // Yoshioka 2026-05-11 additions
          item_type: itemType,
          reorder_url: reorderUrl || null,
          expiry_date: itemType === "consumable" && expiryDate ? expiryDate : null,
          lot_number:  itemType === "consumable" ? (lotNumber || null) : null,
          unit:        itemType === "consumable" ? (unit || null) : null,
          variants: [{
            sku: variant.sku || null,
            barcode: variant.barcode || null,
            option1_name:  variant.opt1k || null,
            option1_value: variant.opt1v || null,
            price: variant.price || null,
            cost:  variant.cost  || null,
            on_hand: variant.stock ? (parseInt(variant.stock, 10) || 0) : 0,
            low_stock_threshold: variant.lowStockThreshold
              ? Math.max(0, parseInt(variant.lowStockThreshold, 10) || 10)
              : 10,
            is_default: variant.isDefault,
          }],
          tags,
        });
        resultId = created.id;
      }
      // After saving, take the user somewhere they can see the result.
      // Edit → back to the product detail page. Create-draft → drafts list.
      // Create-active → detail page.
      if (isEdit) {
        const msg = newStatus === "active" ? "商品を更新・公開しました" : "下書きを更新しました";
        if (window.PLX_TOAST?.success) window.PLX_TOAST.success(msg);
        navigate(`/products/${resultId}`);
      } else if (newStatus === "draft") {
        if (window.PLX_TOAST?.success) window.PLX_TOAST.success("下書きとして保存しました");
        navigate(`/products?status=draft`);
      } else {
        if (window.PLX_TOAST?.success) window.PLX_TOAST.success("商品を公開しました");
        navigate(`/products/${resultId}`);
      }
    } catch (e) {
      setError(e.body?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  // When `onlyFillEmpty` is set, the gap-fill flow only applies AI picks
  // to fields that are currently empty. Used by the 不足項目をAIで補完
  // button on edit forms so the user's manual edits are never overwritten.
  const applyAi = (picks, sessionId, opts) => {
    const onlyFillEmpty = opts && opts.onlyFillEmpty;
    setAiSessionId(sessionId);
    if (picks.title       && (!onlyFillEmpty || !name))         setName(picks.title.value);
    if (picks.name_kana   && (!onlyFillEmpty || !nameKana))     setNameKana(picks.name_kana.value);
    if (picks.brand && vendorsQ.data?.items && (!onlyFillEmpty || !vendorId)) {
      // Normalised compare: tolerates 「サンスター株式会社」vs「サンスター」,
      // full-width spaces, Co.,Ltd suffixes, etc. (see _matchMaster).
      const v = _matchMaster(vendorsQ.data.items, "company_name", picks.brand.value);
      if (v) setVendorId(String(v.id));
    }
    if (picks.category && categoriesQ.data?.items && (!onlyFillEmpty || !categoryId)) {
      const c = _matchMaster(categoriesQ.data.items, "name", picks.category.value);
      if (c) setCategoryId(String(c.id));
    }
    if (picks.price && (!onlyFillEmpty || !variant.price)) {
      setVariant((v) => ({ ...v, price: picks.price.value.replace(/[¥,\s]/g, "") }));
    }
    if (picks.barcode && (!onlyFillEmpty || !variant.barcode)) {
      setVariant((v) => ({ ...v, barcode: picks.barcode.value }));
    }
    if (picks.description && (!onlyFillEmpty || !description)) {
      setDescription(picks.description.value);
    }
    setAiOpen(false);
  };

  // Tooltip lists what's still missing to publish — guides the user without
  // breaking the button.
  const publishMissing = Object.values(validate("active"));
  const publishTooltip = publishMissing.length
    ? "公開に必要: " + publishMissing.join(" / ")
    : "公開可能です";

  // Save flow:
  //   - In CREATE mode: two explicit buttons map to two distinct statuses
  //     ("下書きとして保存" → draft, "商品を公開" → active). The sidebar
  //     radio is hidden because the buttons already disambiguate.
  //   - In EDIT mode: the sidebar radio is the canonical status picker.
  //     One save button "更新" persists everything including whatever
  //     status the radio currently has — so toggling between active and
  //     draft works in both directions.
  const cancelTarget = isEdit ? `/products/${editId}` : "/products";

  const headerRight = isEdit ? (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={() => navigate(cancelTarget)} style={btnGhost}>キャンセル</button>
      <button
        onClick={() => save(status)}
        style={btnPrimary}
        // In edit mode the save button enforces whatever the radio shows.
        // If the user has set status=active, full validation applies; if
        // status=draft, only the name is required.
        disabled={(status === "active" ? !canPublish : !canDraft) || saving}
        title={status === "active" ? publishTooltip : "下書きとして更新します"}
      >
        {saving ? "保存中…" : (status === "active" ? "更新して公開" : "下書きとして更新")}
      </button>
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={() => navigate(cancelTarget)} style={btnGhost}>キャンセル</button>
      <button
        onClick={() => save("draft")}
        style={btnSecondary}
        disabled={!canDraft || saving}
        title={canDraft ? "下書きを保存します" : "商品名を入力してください"}
      >
        下書きとして保存
      </button>
      <button
        onClick={() => save("active")}
        style={btnPrimary}
        disabled={!canPublish || saving}
        title={publishTooltip}
      >
        商品を公開
      </button>
    </div>
  );

  // While the edit-mode fetch is still in flight, show a spinner. Avoids
  // flashing an empty "create new" form before the prefill lands.
  if (isEdit && editingQ.loading && !prefilled) {
    return (
      <AdminShell currentNav="products"
        breadcrumbs={["ホーム", "商品一覧", "編集中…"]}>
        <div style={{ padding: 60, textAlign: "center", color: PLX_MUTED }}>
          読み込み中…
        </div>
      </AdminShell>
    );
  }
  if (isEdit && editingQ.error) {
    return (
      <AdminShell currentNav="products"
        breadcrumbs={["ホーム", "商品一覧", "編集中…"]}>
        <div style={{ padding: 60, textAlign: "center", color: PLX_WARN }}>
          商品の取得に失敗しました。
        </div>
      </AdminShell>
    );
  }

  const lastCrumb = isEdit
    ? `${editingQ.data?.name?.slice(0, 24) || "商品"} を編集`
    : "新規登録";
  return (
    // Brief §4.3: breadcrumb 「ホーム / 商品一覧 / 新規登録」 (or "X を編集" in edit mode).
    <AdminShell currentNav="products" headerRight={headerRight}
      breadcrumbs={["ホーム", "商品一覧", lastCrumb]}>
      <button onClick={() => navigate(cancelTarget)} style={{
        background: "none", border: "none", color: PLX_MUTED,
        fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14,
      }}>{isEdit ? "← 商品詳細へ戻る" : "← 商品一覧へ戻る"}</button>

      {error && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10,
          padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#991B1B",
          fontWeight: 600, display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* AI banner */}
          <div style={{
            background: "linear-gradient(100deg, #E6F7F2 0%, #F4FBF8 80%)",
            border: `1px solid ${PLX_GREEN_LIGHT}`, borderRadius: 14,
            padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: T.PLX_CARD_BG,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              boxShadow: "0 4px 12px rgba(26,166,138,.15)",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>AI でサクッと商品情報を入力</div>
              <div style={{ fontSize: 12, color: PLX_MUTED, marginTop: 2, lineHeight: 1.6 }}>
                JAN コードまたは商品名を入力すると、AI が公開情報から候補を取得します。
                手入力の手間を約 <span style={{ color: PLX_GREEN, fontWeight: 700 }}>80%</span> 削減できます。
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button onClick={() => setAiOpen(true)} style={{
                height: 38, padding: "0 18px", borderRadius: 9999,
                background: PLX_GREEN, color: "#fff", border: "none",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                boxShadow: "0 6px 16px rgba(26,166,138,.25)", whiteSpace: "nowrap",
              }}>✨ AI で入力する</button>
              {isEdit && (
                // Gap-fill: pre-seed with the product's current JAN (or name
                // if no JAN), and tell AiAssistModal we want onlyFillEmpty
                // semantics so manual edits aren't overwritten.
                <button
                  onClick={() => {
                    setAiGapFill(true);
                    const seedJan  = variant.barcode || "";
                    const seedName = name || "";
                    setAiSeed(seedJan
                      ? { mode: "jan",  value: seedJan }
                      : seedName ? { mode: "name", value: seedName } : null);
                    setAiOpen(true);
                  }}
                  title="現在空欄の項目だけ AI で埋めます。入力済みの値はそのまま残ります。"
                  style={{
                    height: 32, padding: "0 14px", borderRadius: 9999,
                    background: T.PLX_CARD_BG, color: PLX_GREEN,
                    border: `1px solid ${PLX_GREEN}`,
                    fontWeight: 700, fontSize: 11, cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}>🔍 不足項目をAIで補完</button>
              )}
            </div>
          </div>

          {/* Basic info */}
          <FormSection title="基本情報" subtitle="商品の基本となる情報を入力します">
            {/* Yoshioka 2026-05-11: 品目種別 toggle at the very top */}
            <FormRow label="品目種別" required error={fieldErrors.itemType}>
              <ItemKindToggle value={itemType} onChange={setItemType} />
              <div style={{ fontSize: 11, color: PLX_MUTED, marginTop: 6 }}>
                消耗品は使用期限管理の対象になります
              </div>
            </FormRow>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormRow label="商品名（漢字）" required error={fieldErrors.name}>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="例：エグザフレックス インプレッション" style={formInput} />
              </FormRow>
              <FormRow label="商品名（かな）">
                <input value={nameKana} onChange={(e) => setNameKana(e.target.value)}
                  placeholder="エグザフレックス インプレッション" style={formInput} />
              </FormRow>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormRow label="カテゴリ" requiredFor="公開" error={fieldErrors.categoryId}>
                <Select value={categoryId} onChange={setCategoryId} options={[
                  { value: "", label: "選択してください" },
                  ...(categoriesQ.data?.items ?? []).map((c) => ({ value: String(c.id), label: c.name })),
                ]} />
              </FormRow>
              <FormRow label="仕入先 / ブランド">
                <Select value={vendorId} onChange={setVendorId} options={[
                  { value: "", label: "選択してください" },
                  ...(vendorsQ.data?.items ?? []).map((v) => ({ value: String(v.id), label: v.company_name })),
                ]} />
              </FormRow>
            </div>

            {/* Reorder URL — always visible (Yoshioka 2026-05-11) */}
            <FormRow label="発注先 URL">
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{ position: "absolute", left: 14, top: 11, color: PLX_MUTED }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.8" strokeLinecap="round">
                      <path d="M10 13a5 5 0 0 0 7.5.7l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/>
                      <path d="M14 11a5 5 0 0 0-7.5-.7l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>
                    </svg>
                  </span>
                  <input value={reorderUrl} onChange={(e) => setReorderUrl(e.target.value)}
                    placeholder="https://example.com/product/..." style={{
                      ...formInput, paddingLeft: 38,
                      fontFamily: "ui-monospace,SFMono-Regular,monospace", fontSize: 12,
                    }} />
                </div>
                <a href={reorderUrl || "#"} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => { if (!reorderUrl) e.preventDefault(); }} style={{
                    height: 38, padding: "0 14px", borderRadius: 9,
                    border: `1px solid ${reorderUrl ? PLX_GREEN : PLX_BORDER}`,
                    background: reorderUrl ? T.PLX_CARD_BG : T.PLX_SURFACE_50,
                    color: reorderUrl ? PLX_GREEN : PLX_SUBTLE,
                    fontWeight: 700, fontSize: 12,
                    cursor: reorderUrl ? "pointer" : "not-allowed",
                    display: "inline-flex", alignItems: "center", gap: 6,
                    textDecoration: "none", whiteSpace: "nowrap",
                  }}>🔗 開く</a>
              </div>
              <div style={{ fontSize: 11, color: PLX_MUTED, marginTop: 5 }}>
                クリックでこの URL を開いて再発注できます
              </div>
            </FormRow>

            <FormRow label="商品説明">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="商品の特長・用途・サイズなどを記入します。" style={{
                  ...formInput, height: 90, resize: "vertical", padding: "10px 14px",
                }} />
            </FormRow>
            <FormRow label="タグ（複数選択可・新規入力で自動作成）">
              <div style={{
                minHeight: 38, border: `1px solid ${PLX_BORDER}`, borderRadius: 9,
                padding: "6px 10px", display: "flex", flexWrap: "wrap", gap: 6,
                alignItems: "center", background: T.PLX_CARD_BG,
              }}>
                {tags.map((t) => (
                  <span key={t} style={{
                    fontSize: 12, fontWeight: 600, color: PLX_GREEN,
                    background: PLX_GREEN_LIGHT, padding: "4px 10px", borderRadius: 9999,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} style={{
                      background: "none", border: "none", color: PLX_GREEN,
                      cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1,
                    }}>×</button>
                  </span>
                ))}
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      setTags([...tags, tagInput.trim()]);
                      setTagInput("");
                      e.preventDefault();
                    }
                  }}
                  placeholder={tags.length ? "" : "タグを入力して Enter で追加"} style={{
                    border: "none", outline: "none", fontSize: 12,
                    flex: 1, minWidth: 120, padding: "4px 0",
                  }} />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: PLX_MUTED, fontWeight: 600, marginRight: 4 }}>
                  よく使うタグ:
                </span>
                {(tagsQ.data?.items ?? []).slice(0, 5).map((t) => (
                  <button key={t.id}
                    onClick={() => !tags.includes(t.name) && setTags([...tags, t.name])} style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 9999,
                      border: `1px dashed ${PLX_BORDER}`, background: T.PLX_CARD_BG,
                      color: PLX_MUTED, cursor: "pointer",
                    }}>＋ {t.name}</button>
                ))}
              </div>
            </FormRow>
          </FormSection>

          {/* Consumable-only section (Yoshioka 2026-05-11) */}
          {itemType === "consumable" && (
            <FormSection title="消耗品の追加情報" subtitle="使用期限・ロット・単位を管理します">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <FormRow label="使用期限">
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                    style={{ ...formInput, fontFamily: "ui-monospace,SFMono-Regular,monospace" }} />
                  <div style={{ fontSize: 11, color: PLX_MUTED, marginTop: 5 }}>
                    空欄の場合は期限管理されません
                  </div>
                </FormRow>
                <FormRow label="ロット番号（任意）">
                  <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="LOT-2026A-001" style={{
                      ...formInput, fontFamily: "ui-monospace,SFMono-Regular,monospace",
                    }} />
                </FormRow>
                <FormRow label="単位">
                  <Select value={unit} onChange={setUnit} options={[
                    { value: "個",  label: "個" },
                    { value: "箱",  label: "箱" },
                    { value: "mL", label: "mL" },
                    { value: "g",  label: "g" },
                    { value: "本",  label: "本" },
                  ]} />
                </FormRow>
              </div>
            </FormSection>
          )}

          {/* Variant */}
          <FormSection title="バリアント" subtitle="SKU・価格・初期在庫">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormRow label="SKU">
                <input value={variant.sku}
                  onChange={(e) => setVariant({ ...variant, sku: e.target.value })}
                  placeholder="GC-EX-001" style={formInput} />
              </FormRow>
              <FormRow label="JAN / バーコード" requiredFor="公開" error={fieldErrors.barcode}>
                <input value={variant.barcode}
                  onChange={(e) => setVariant({ ...variant, barcode: e.target.value })}
                  placeholder="4987246012001" style={formInput} />
              </FormRow>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <FormRow label="販売価格 (¥)" requiredFor="公開" error={fieldErrors.price}>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute", left: 14, top: 10,
                    fontSize: 13, color: PLX_MUTED, fontWeight: 700,
                  }}>¥</span>
                  <input value={variant.price}
                    inputMode="decimal"
                    onChange={(e) => setVariant({ ...variant, price: _keepDecimal(e.target.value) })}
                    placeholder="4800" style={{
                      ...formInput, paddingLeft: 28, fontVariantNumeric: "tabular-nums",
                    }} />
                </div>
              </FormRow>
              <FormRow label="原価 (¥)">
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute", left: 14, top: 10,
                    fontSize: 13, color: PLX_MUTED, fontWeight: 700,
                  }}>¥</span>
                  <input value={variant.cost}
                    inputMode="decimal"
                    onChange={(e) => setVariant({ ...variant, cost: _keepDecimal(e.target.value) })}
                    placeholder="3100" style={{
                      ...formInput, paddingLeft: 28, fontVariantNumeric: "tabular-nums",
                    }} />
                </div>
              </FormRow>
              <FormRow label={isEdit ? "在庫数" : "初期在庫数"}>
                <input value={variant.stock}
                  inputMode="numeric"
                  onChange={(e) => setVariant({ ...variant, stock: _keepInteger(e.target.value) })}
                  placeholder="0" style={{ ...formInput, fontVariantNumeric: "tabular-nums" }} />
              </FormRow>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
              <FormRow label="在庫低下しきい値"
                hint="この数を下回ると一覧で「低在庫」と表示されます（既定: 10）">
                <input value={variant.lowStockThreshold}
                  inputMode="numeric"
                  onChange={(e) => setVariant({ ...variant, lowStockThreshold: _keepInteger(e.target.value) })}
                  placeholder="10" style={{ ...formInput, fontVariantNumeric: "tabular-nums" }} />
              </FormRow>
            </div>
            <FormRow label="オプション 1（任意）">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                <input placeholder="ラベル（例: サイズ）" value={variant.opt1k}
                  onChange={(e) => setVariant({ ...variant, opt1k: e.target.value })} style={formInput} />
                <input placeholder="値（例: 75ml）" value={variant.opt1v}
                  onChange={(e) => setVariant({ ...variant, opt1v: e.target.value })} style={formInput} />
              </div>
            </FormRow>
            <label style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 12, cursor: "pointer", marginTop: 4,
            }}>
              <input type="checkbox" checked={variant.isDefault}
                onChange={(e) => setVariant({ ...variant, isDefault: e.target.checked })}
                style={{ accentColor: PLX_GREEN }} />
              このバリアントをデフォルトに設定
            </label>
          </FormSection>

          {error && (
            <div style={{
              fontSize: 12, color: PLX_WARN,
              background: PLX_WARN_BG, border: `1px solid ${PLX_WARN}`,
              borderRadius: 10, padding: "10px 14px",
            }}>{error}</div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <FormSection title="ステータス">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <RadioRow checked={status === "active"} onClick={() => setStatus("active")}
                label="公開中" sub="商品一覧に表示し、販売記録から選択できるようにします。" />
              <RadioRow checked={status === "draft"} onClick={() => setStatus("draft")}
                label="下書き" sub="保存のみ。一覧には表示されません。" />
            </div>
          </FormSection>

          <FormSection title="プレビュー">
            <div style={{
              background: PLX_GREEN_50, borderRadius: 10, padding: 14,
              display: "flex", gap: 12, alignItems: "flex-start",
              border: `1px solid ${PLX_GREEN_LIGHT}`,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 8, background: T.PLX_CARD_BG,
                border: `1px solid ${PLX_BORDER}`, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN}
                  strokeWidth="1.6" strokeLinecap="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{name || "商品名（未入力）"}</div>
                <div style={{
                  fontSize: 10, color: PLX_SUBTLE, marginTop: 2,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{nameKana || "—"}</div>
                <div style={{
                  fontSize: 13, fontWeight: 700, marginTop: 8,
                  color: PLX_GREEN, fontVariantNumeric: "tabular-nums",
                }}>¥{variant.price || "0"}</div>
              </div>
            </div>
          </FormSection>
        </div>
      </div>

      {pendingSave && (
        <ConfirmSaveModal
          isEdit={isEdit}
          status={pendingSave}
          before={isEdit ? editingQ.data : null}
          after={{
            name, name_kana: nameKana,
            category_id: categoryId, vendor_id: vendorId,
            description, item_type: itemType, reorder_url: reorderUrl,
            expiry_date: expiryDate, lot_number: lotNumber, unit,
            tags,
            variant: {
              sku: variant.sku, barcode: variant.barcode,
              price: variant.price, cost: variant.cost,
              on_hand: variant.stock, low_stock_threshold: variant.lowStockThreshold,
            },
          }}
          refData={{
            categories: categoriesQ.data?.items || [],
            vendors:    vendorsQ.data?.items    || [],
          }}
          onCancel={() => setPendingSave(null)}
          onConfirm={() => _doSave(pendingSave)}
          saving={saving}
        />
      )}

      {aiOpen && (
        <AiAssistModal
          onClose={() => { setAiOpen(false); setAiSeed(null); setAiGapFill(false); }}
          onApply={(picks, sessionId) => {
            applyAi(picks, sessionId, { onlyFillEmpty: aiGapFill });
            setAiGapFill(false);
          }}
          seed={aiSeed}
        />
      )}
    </AdminShell>
  );
}

function FormSection({ title, subtitle, children }) {
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: 14,
      border: `1px solid ${PLX_BORDER}`, padding: "20px 22px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{title}</h3>
          {subtitle && <div style={{ fontSize: 11, color: PLX_MUTED, marginTop: 3 }}>{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function RadioRow({ checked, onClick, label, sub }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", padding: "12px 14px", borderRadius: 10,
      border: `1px solid ${checked ? PLX_GREEN : PLX_BORDER}`,
      background: checked ? PLX_GREEN_50 : T.PLX_CARD_BG,
      cursor: "pointer", display: "flex", gap: 11, alignItems: "flex-start",
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: "50%",
        border: `2px solid ${checked ? PLX_GREEN : PLX_BORDER}`,
        background: T.PLX_CARD_BG, display: "flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
      }}>
        {checked && <span style={{ width: 8, height: 8, borderRadius: "50%", background: PLX_GREEN }} />}
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: checked ? PLX_GREEN : PLX_TEXT }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: PLX_MUTED, marginTop: 2, lineHeight: 1.5 }}>{sub}</div>
      </div>
    </button>
  );
}

// ItemKindToggle: large pill-style radio for 物販品 / 消耗品.
// Yoshioka 2026-05-11 — top of the create form.
function ItemKindToggle({ value, onChange }) {
  const opts = [
    { value: "product",    label: "物販品", sub: "販売する商品（歯ブラシ等）",     color: PLX_GREEN, bg: PLX_GREEN_LIGHT },
    { value: "consumable", label: "消耗品", sub: "治療で使う材料（紙コップ等）", color: "#2563EB", bg: PLX_BLUE_LIGHT },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 560 }}>
      {opts.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            textAlign: "left", padding: "12px 16px", borderRadius: 10,
            border: `1.5px solid ${on ? o.color : PLX_BORDER}`,
            background: on ? o.bg : T.PLX_CARD_BG,
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 11,
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%",
              border: `2px solid ${on ? o.color : PLX_BORDER}`,
              background: T.PLX_CARD_BG, display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {on && <span style={{ width: 9, height: 9, borderRadius: "50%", background: o.color }} />}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: on ? o.color : PLX_TEXT }}>{o.label}</div>
              <div style={{ fontSize: 11, color: PLX_MUTED, marginTop: 2 }}>{o.sub}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const FIELD_DEFS = [
  { key: "title",       label: "商品名 (title)" },
  { key: "name_kana",   label: "商品名（かな）" },
  { key: "brand",       label: "ブランド / 仕入先" },
  { key: "category",    label: "カテゴリ" },
  { key: "barcode",     label: "JAN / バーコード" },
  { key: "price",       label: "参考価格" },
  { key: "description", label: "説明文" },
];

function AiAssistModal({ onClose, onApply, seed }) {
  const [phase, setPhase] = React.useState("input"); // input | loading | results | error
  // Yoshioka 2026-05-11: barcode-first UX. `mode` toggles between JAN and name.
  // Seed (from the "No results? Try AI" CTA or the command palette) can flip
  // the default mode and pre-fill the input.
  const [mode, setMode]   = React.useState(seed?.mode || "jan");
  const [jan, setJan]     = React.useState(seed?.mode === "jan"  ? (seed.value || "") : "");
  const [name, setName]   = React.useState(seed?.mode === "name" ? (seed.value || "") : "");
  const [picks, setPicks] = React.useState({});
  const [session, setSession] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [scanOpen, setScanOpen] = React.useState(false);

  // Seed-driven auto-lookup. Fires once on first mount if the modal was
  // opened with a seed value (from the "No results? Try AI" CTA or the
  // Ctrl+K palette). Skips if seed is empty or already used.
  const seedFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (seedFiredRef.current) return;
    if (!seed || !(seed.value || "").trim()) return;
    seedFiredRef.current = true;
    Promise.resolve().then(() => {
      if (seed.mode === "jan") lookup({ janOverride: seed.value.trim() });
      else                     lookup({ nameOverride: seed.value.trim() });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // Called when the BarcodeScanner finds a code. We:
  //   1. close the scanner overlay
  //   2. set the JAN value so the user can see what was scanned
  //   3. immediately fire the lookup with an explicit override so we don't
  //      have to wait for the setJan setState to flush before reading it.
  const onScanDetected = (code) => {
    setScanOpen(false);
    setMode("jan");
    setJan(code);
    // Fire lookup on next microtask so the input visibly updates first.
    Promise.resolve().then(() => lookup({ janOverride: code }));
  };

  const lookup = async (opts) => {
    const janOverride = opts && opts.janOverride;
    const nameOverride = opts && opts.nameOverride;
    const useJan = janOverride !== undefined ? janOverride : jan;
    const useName = nameOverride !== undefined ? nameOverride : name;
    const effectiveMode = janOverride !== undefined ? "jan"
                        : nameOverride !== undefined ? "name"
                        : mode;
    setPhase("loading"); setError(null);
    try {
      // Mode toggle: route the user's input to the correct backend field.
      let s = await api.createAiSuggestion({
        jan:   effectiveMode === "jan"  ? (useJan  || undefined) : undefined,
        title: effectiveMode === "name" ? (useName || undefined) : undefined,
      });
      let attempts = 0;
      while (s.status === "pending" && attempts < 20) {
        await new Promise((r) => setTimeout(r, 800));
        s = await api.getAiSuggestion(s.id);
        attempts += 1;
      }
      if (s.status === "failed") {
        setError(s.error_message || "AI 検索に失敗しました");
        setPhase("error");
        return;
      }
      setSession(s);
      setPhase("results");
    } catch (e) {
      setError(e.body?.detail || e.message);
      setPhase("error");
    }
  };

  const togglePick = (field, opt) =>
    setPicks((p) => ({ ...p, [field]: p[field]?.id === opt.id ? null : opt }));

  const visibleFields = session
    ? FIELD_DEFS.filter((f) => (session.options[f.key]?.length ?? 0) > 0)
    : FIELD_DEFS;
  const selectedCount = Object.values(picks).filter(Boolean).length;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,.45)",
      backdropFilter: "blur(4px)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50,
    }}>
      {scanOpen && (
        <BarcodeScanner
          onDetected={onScanDetected}
          onClose={() => setScanOpen(false)}
        />
      )}
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.PLX_CARD_BG, borderRadius: 18, width: 680, maxHeight: "86%",
        boxShadow: "0 24px 60px rgba(17,24,39,.22)", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "20px 26px 14px", borderBottom: `1px solid ${PLX_BORDER}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: PLX_GREEN_LIGHT,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN}
              strokeWidth="2" strokeLinecap="round">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <SectionLabel>AI 商品アシスト</SectionLabel>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "3px 0 0" }}>
              AI で商品情報を自動入力
            </h3>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 18, color: PLX_MUTED, padding: 6,
          }}>×</button>
        </div>

        <div style={{ padding: "20px 26px", overflow: "auto", flex: 1 }}>
          {phase === "input" && (
            <>
              {/* Mode toggle — Yoshioka 2026-05-11 ("そっちの方が良さそう"): default to JAN. */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <div style={{
                  display: "inline-flex", background: PLX_SURFACE, borderRadius: 9999,
                  padding: 3, border: `1px solid ${PLX_BORDER}`,
                }}>
                  {[{ v: "jan", l: "ジャンルコード" }, { v: "name", l: "商品名" }].map((o) => {
                    const on = mode === o.v;
                    return (
                      <button key={o.v} onClick={() => setMode(o.v)} style={{
                        fontSize: 12, fontWeight: 700, padding: "7px 18px",
                        borderRadius: 9999, border: "none",
                        background: on ? T.PLX_CARD_BG : "transparent",
                        color: on ? PLX_GREEN : PLX_MUTED,
                        boxShadow: on ? "0 1px 3px rgba(0,0,0,.06)" : "none",
                        cursor: "pointer",
                      }}>{o.l}</button>
                    );
                  })}
                </div>
              </div>

              {/* Large single input — barcode-first */}
              <div style={{ position: "relative", marginBottom: 8 }}>
                {mode === "jan" ? (
                  <>
                    <input value={jan} onChange={(e) => setJan(e.target.value)}
                      inputMode="numeric" pattern="[0-9]*"
                      placeholder="例: 4901301234567" style={{
                        width: "100%", height: 54, border: `1.5px solid ${PLX_GREEN_LIGHT}`,
                        borderRadius: 12, padding: "0 150px 0 18px", fontSize: 18,
                        fontFamily: "ui-monospace,SFMono-Regular,monospace",
                        letterSpacing: ".05em", outline: "none", background: T.PLX_CARD_BG,
                        boxSizing: "border-box", color: PLX_TEXT, fontWeight: 600,
                      }} />
                    <button
                      onClick={() => setScanOpen(true)}
                      title="カメラでバーコードをスキャン"
                      style={{
                        position: "absolute", right: 6, top: 6, height: 42, padding: "0 14px",
                        borderRadius: 9, background: PLX_GREEN, color: "#fff",
                        border: "none", cursor: "pointer",
                        fontWeight: 700, fontSize: 12,
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                    >
                      📷 カメラで読み取る
                    </button>
                  </>
                ) : (
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="例: GUM デンタルブラシ" style={{
                      width: "100%", height: 54, border: `1.5px solid ${PLX_GREEN_LIGHT}`,
                      borderRadius: 12, padding: "0 18px", fontSize: 16,
                      outline: "none", background: T.PLX_CARD_BG, boxSizing: "border-box",
                      color: PLX_TEXT, fontWeight: 600,
                    }} />
                )}
              </div>
              <div style={{
                fontSize: 11, color: PLX_MUTED, marginBottom: 18, paddingLeft: 4,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke={PLX_GREEN} strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12" y2="16"/>
                </svg>
                ジャンルコードでの検索の方が精度が高いです
              </div>

              <button onClick={lookup} disabled={mode === "jan" ? !jan : !name} style={{
                width: "100%", height: 46, borderRadius: 12,
                background: PLX_GREEN, color: "#fff", border: "none",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                boxShadow: "0 6px 16px rgba(26,166,138,.25)",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: (mode === "jan" ? jan : name) ? 1 : 0.5,
              }}>🔍 AI で検索</button>

              <div style={{
                background: PLX_GREEN_50, borderRadius: 10,
                padding: "12px 14px", fontSize: 11, color: PLX_MUTED,
                lineHeight: 1.6, marginTop: 14,
              }}>
                ※ AI による候補は参考情報です。価格・在庫など最終確定値は必ず担当者がご確認ください。
              </div>
            </>
          )}

          {phase === "loading" && (
            <div style={{ padding: "50px 0", textAlign: "center" }}>
              <div style={{
                width: 50, height: 50, borderRadius: "50%",
                border: `4px solid ${PLX_GREEN_LIGHT}`,
                borderTop: `4px solid ${PLX_GREEN}`,
                margin: "0 auto 18px",
                animation: "plxspin 0.9s linear infinite",
              }} />
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                AIが商品情報を検索中...
              </div>
              <div style={{ fontSize: 12, color: PLX_MUTED }}>
                公開情報・JANデータベース・メーカーサイトを照合しています
              </div>
            </div>
          )}

          {phase === "error" && (
            <div style={{ padding: "30px 0", textAlign: "center" }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: PLX_WARN, marginBottom: 6,
              }}>AI 検索に失敗しました</div>
              <div style={{ fontSize: 12, color: PLX_MUTED }}>
                {error || "もう一度お試しください"}
              </div>
            </div>
          )}

          {phase === "results" && session && (
            <>
              <div style={{
                background: PLX_GREEN_50, border: `1px solid ${PLX_GREEN_LIGHT}`,
                borderRadius: 10, padding: "10px 14px", fontSize: 12, color: PLX_TEXT,
                marginBottom: 16, display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: PLX_GREEN }} />
                <b>{visibleFields.length} 項目で候補が見つかりました。</b>
                <span style={{ color: PLX_MUTED }}>
                  各項目で 1 つ選んで「適用」を押してください。
                </span>
              </div>
              {visibleFields.map((f) => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, marginBottom: 6,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    {f.label}
                    {picks[f.key] && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: PLX_GREEN,
                        background: PLX_GREEN_LIGHT,
                        padding: "2px 7px", borderRadius: 9999,
                      }}>選択済</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(session.options[f.key] ?? []).map((opt) => {
                      const on = picks[f.key]?.id === opt.id;
                      return (
                        <button key={opt.id} onClick={() => togglePick(f.key, opt)} style={{
                          textAlign: "left", padding: "10px 14px", borderRadius: 10,
                          border: `1px solid ${on ? PLX_GREEN : PLX_BORDER}`,
                          background: on ? PLX_GREEN_50 : T.PLX_CARD_BG,
                          cursor: "pointer", display: "flex",
                          alignItems: "center", gap: 12,
                        }}>
                          <span style={{
                            width: 14, height: 14, borderRadius: 4,
                            border: `2px solid ${on ? PLX_GREEN : PLX_BORDER}`,
                            background: on ? PLX_GREEN : T.PLX_CARD_BG,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}>
                            {on && (
                              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
                                stroke="#fff" strokeWidth="2" strokeLinecap="round">
                                <path d="M1.5 4.5L3.5 6.5L7.5 2" />
                              </svg>
                            )}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: PLX_TEXT }}>
                              {opt.value}
                            </div>
                            <div style={{ fontSize: 10, color: PLX_MUTED, marginTop: 3 }}>
                              出典: {opt.source_title || opt.source_url || "—"}
                            </div>
                          </div>
                          {opt.confidence != null && <ConfBar val={opt.confidence} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {visibleFields.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: PLX_MUTED, fontSize: 13 }}>
                  候補が見つかりませんでした。
                </div>
              )}
            </>
          )}
        </div>

        <div style={{
          padding: "14px 26px", borderTop: `1px solid ${PLX_BORDER}`,
          display: "flex", alignItems: "center", gap: 10, background: PLX_SURFACE,
        }}>
          <span style={{ fontSize: 11, color: PLX_MUTED, flex: 1 }}>
            {phase === "results" && `${selectedCount} / ${visibleFields.length} 項目を選択中`}
          </span>
          <button onClick={onClose} style={btnGhost}>キャンセル</button>
          {/* Search button is inside the body for "input" phase (large CTA per Yoshioka). */}
          {phase === "error" && (
            <button onClick={() => setPhase("input")} style={btnPrimary}>再試行</button>
          )}
          {phase === "results" && session && (
            <button onClick={() => onApply(picks, session.id)} disabled={!selectedCount}
              style={{ ...btnPrimary, opacity: selectedCount ? 1 : 0.5 }}>
              選択した項目を適用 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfBar({ val }) {
  const pct = Math.round(val * 100);
  const color = val > 0.85 ? PLX_GREEN : val > 0.7 ? PLX_WARN : PLX_MUTED;
  return (
    <div style={{ minWidth: 78, textAlign: "right" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</div>
      <div style={{
        height: 3, background: "#F3F4F6", borderRadius: 2,
        marginTop: 3, overflow: "hidden",
      }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Barcode scanner — camera-based JAN reader for the AI Assist modal.
// Uses html5-qrcode from CDN (see index.html). Lazy: only this component
// touches `Html5Qrcode`, so other pages never load the camera stack.
// ─────────────────────────────────────────────────────────────────────────────
function BarcodeScanner({ onDetected, onClose }) {
  const containerId = "plx-barcode-reader";
  const [error, setError] = React.useState(null);
  const [starting, setStarting] = React.useState(true);
  // running flag lives in a ref so both onSuccess and the cleanup return
  // see a single shared "has the camera actually started?" state without
  // re-triggering the effect.
  const stateRef = React.useRef({ scanner: null, running: false, detected: false });
  // Keep onDetected fresh without re-running the effect.
  const onDetectedRef = React.useRef(onDetected);
  onDetectedRef.current = onDetected;

  React.useEffect(() => {
    if (typeof window.Html5Qrcode === "undefined") {
      setError("バーコードリーダーの読み込みに失敗しました。ページを再読み込みしてください。");
      setStarting(false);
      return;
    }
    let scanner;
    try {
      scanner = new window.Html5Qrcode(containerId, /* verbose */ false);
    } catch (e) {
      setError("カメラの初期化に失敗しました: " + (e && e.message ? e.message : String(e)));
      setStarting(false);
      return;
    }
    stateRef.current.scanner = scanner;

    const config = {
      fps: 10,
      qrbox: { width: 260, height: 140 },   // wide rectangle suits 1D barcodes
      aspectRatio: 1.7,
      // EAN-13 covers JAN-13 (Japan); keep QR enabled too in case a vendor
      // ships their products with a QR-coded SKU.
      formatsToSupport: window.Html5QrcodeSupportedFormats
        ? [
          window.Html5QrcodeSupportedFormats.EAN_13,
          window.Html5QrcodeSupportedFormats.EAN_8,
          window.Html5QrcodeSupportedFormats.CODE_128,
          window.Html5QrcodeSupportedFormats.QR_CODE,
        ]
        : undefined,
    };

    const onSuccess = (decoded) => {
      // Library keeps firing onSuccess until we stop. Bail on every call
      // after the first — but DO NOT await stop() before calling onDetected.
      // The parent's onScanDetected setState may unmount us, which then runs
      // cleanup() below; the cleanup is what actually stops the scanner.
      if (stateRef.current.detected) return;
      stateRef.current.detected = true;
      // Hand the code to the parent in a microtask so React's batched
      // setState in the parent doesn't race with whatever Html5Qrcode is
      // doing internally on the current frame.
      const code = String(decoded);
      Promise.resolve().then(() => {
        try { onDetectedRef.current(code); }
        catch (e) { console.error("onDetected threw:", e); }
      });
    };
    const onErr = () => {/* per-frame decode misses are normal; ignore */};

    scanner.start({ facingMode: "environment" }, config, onSuccess, onErr)
      .then(() => {
        stateRef.current.running = true;
        setStarting(false);
      })
      .catch((e) => {
        setError(
          (e && e.message ? e.message : String(e))
          + " — カメラ権限を許可してください。"
        );
        setStarting(false);
      });

    return () => {
      // Cleanup runs when the parent unmounts us (after onDetected fires,
      // or when the user clicks ×/cancel). Guard every step so a partially-
      // started scanner can't crash React on unmount.
      const s = stateRef.current.scanner;
      stateRef.current.scanner = null;
      if (!s) return;
      // Only call stop() if start() actually resolved. Calling stop on a
      // scanner that hasn't reached "running" state throws synchronously in
      // some html5-qrcode versions.
      const stopPromise = stateRef.current.running
        ? s.stop().catch(() => {})
        : Promise.resolve();
      stopPromise.then(() => {
        try {
          if (typeof s.clear === "function") s.clear();
        } catch (e) {
          // Clear() can throw when the container DOM is already gone.
          // That's expected on fast unmount — swallow it.
        }
      });
      stateRef.current.running = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,0.85)",
      zIndex: 100, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: 16, padding: 16, maxWidth: 460, width: "100%",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: PLX_TEXT }}>
            📷 バーコードをスキャン
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 20, color: PLX_MUTED, padding: 4, lineHeight: 1,
          }}>×</button>
        </div>

        {error ? (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10,
            padding: "12px 14px", fontSize: 12, color: "#991B1B", lineHeight: 1.6,
          }}>
            {error}
          </div>
        ) : (
          <>
            <div id={containerId} style={{
              width: "100%", minHeight: 240, borderRadius: 10,
              overflow: "hidden", background: "#000",
            }} />
            <div style={{
              marginTop: 10, fontSize: 11, color: PLX_MUTED, textAlign: "center",
            }}>
              {starting
                ? "カメラを起動しています…"
                : "バーコードを枠内に合わせると自動で読み取ります"}
            </div>
          </>
        )}

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            height: 36, padding: "0 16px", borderRadius: 9999,
            background: "#F3F4F6", color: PLX_TEXT, border: "none",
            fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmSaveModal — pre-save review screen.
//
// Edit mode: shows every field whose value is changing, side-by-side with
//   the original. Unchanged fields are hidden so the user only sees the
//   diff that matters.
// Create mode: shows every populated field as a flat summary list (no
//   "before" column).
//
// The user can either go back to keep editing or confirm to persist.
// Designed to be cheap to read at a glance — clinic staff will be using it
// dozens of times per day, so it has to disappear when the data is fine
// and only call attention when something looks off.
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmSaveModal({ isEdit, status, before, after, refData, onCancel, onConfirm, saving }) {
  // Resolve foreign-key IDs to human names so the user sees "印象材"
  // instead of "3" in the modal.
  const catName = (id) => {
    if (id == null || id === "") return "—";
    const c = (refData.categories || []).find((x) => String(x.id) === String(id));
    return c ? c.name : `カテゴリ#${id}`;
  };
  const venName = (id) => {
    if (id == null || id === "") return "—";
    const v = (refData.vendors || []).find((x) => String(x.id) === String(id));
    return v ? v.company_name : `仕入先#${id}`;
  };

  // Build a list of {label, before, after, changed}. before==null when in
  // create mode. We compare against the original product detail for
  // edits; the heroVariant on `before` carries the variant baseline.
  const heroVariant = before
    ? ((before.variants || []).find((v) => v.is_default) || (before.variants || [])[0] || {})
    : {};
  const rows = [
    { label: "商品名",       b: before?.name ?? "",        a: after.name },
    { label: "ふりがな",     b: before?.name_kana ?? "",   a: after.name_kana },
    { label: "カテゴリ",     b: catName(before?.category_id), a: catName(after.category_id) },
    { label: "仕入先",       b: venName(before?.vendor_id),   a: venName(after.vendor_id) },
    { label: "種別",         b: before?.item_type ?? "",   a: after.item_type },
    { label: "ステータス",   b: before?.status ?? "",      a: status },
    { label: "発注先 URL",   b: before?.reorder_url ?? "", a: after.reorder_url },
    { label: "商品説明",     b: before?.description ?? "", a: after.description },
    { label: "SKU",          b: heroVariant?.sku ?? "",    a: after.variant.sku },
    { label: "JAN",          b: heroVariant?.barcode ?? "", a: after.variant.barcode },
    { label: "販売価格",     b: heroVariant?.price != null ? String(heroVariant.price) : "", a: after.variant.price },
    { label: "原価",         b: heroVariant?.cost != null ? String(heroVariant.cost) : "",   a: after.variant.cost },
    { label: "在庫数",       b: heroVariant?.on_hand != null ? String(heroVariant.on_hand) : "", a: after.variant.on_hand },
    { label: "在庫低下しきい値", b: heroVariant?.low_stock_threshold != null ? String(heroVariant.low_stock_threshold) : "10", a: after.variant.low_stock_threshold || "10" },
  ];
  if (after.item_type === "consumable") {
    rows.push(
      { label: "使用期限",     b: before?.expiry_date ?? "", a: after.expiry_date },
      { label: "ロット番号",   b: before?.lot_number ?? "",  a: after.lot_number },
      { label: "単位",         b: before?.unit ?? "",        a: after.unit },
    );
  }
  // Mark changed rows so the diff stands out visually.
  rows.forEach((r) => { r.changed = String(r.b ?? "") !== String(r.a ?? ""); });
  const displayRows = isEdit ? rows.filter((r) => r.changed) : rows.filter((r) => r.a !== "" && r.a != null);
  const hasChanges = displayRows.length > 0;

  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)",
      backdropFilter: "blur(4px)", zIndex: 80,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.PLX_CARD_BG, borderRadius: 16, width: 600, maxWidth: "92%",
        maxHeight: "82vh", boxShadow: "0 24px 60px rgba(17,24,39,.22)",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "20px 24px 14px", borderBottom: `1px solid ${PLX_BORDER}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: PLX_GREEN_LIGHT, color: PLX_GREEN,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 20,
          }}>✓</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: PLX_TEXT }}>
              {isEdit ? "保存内容を確認" : "登録内容を確認"}
            </div>
            <div style={{ fontSize: 12, color: PLX_MUTED, marginTop: 2 }}>
              {isEdit
                ? (hasChanges ? `${displayRows.length} 項目の変更を保存します。` : "変更はありません。")
                : `ステータス: ${status === "active" ? "公開中" : "下書き"}`}
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 24px", overflow: "auto", flex: 1 }}>
          {!hasChanges && isEdit ? (
            <div style={{ padding: "24px 4px", textAlign: "center", color: PLX_MUTED, fontSize: 13 }}>
              変更された項目はありません。「キャンセル」で戻って編集を続けられます。
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {displayRows.map((r) => (
                <ConfirmRow key={r.label} {...r} showBefore={isEdit} />
              ))}
            </div>
          )}
        </div>

        <div style={{
          padding: "14px 24px", borderTop: `1px solid ${PLX_BORDER}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onCancel} disabled={saving} style={btnGhost}>戻る</button>
          <button
            onClick={onConfirm}
            disabled={saving || (isEdit && !hasChanges)}
            style={{ ...btnPrimary, opacity: (saving || (isEdit && !hasChanges)) ? 0.6 : 1 }}
          >
            {saving ? "保存中…" : (isEdit ? "保存する" : "登録する")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmRow({ label, b, a, changed, showBefore }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: showBefore ? "120px 1fr 1fr" : "120px 1fr",
      gap: 10, alignItems: "start",
      padding: "8px 10px", borderRadius: 8,
      background: changed ? "#FEF9E7" : "transparent",
      border: changed ? "1px solid #FCD34D" : "1px solid transparent",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: PLX_MUTED }}>{label}</div>
      {showBefore && (
        <div style={{
          fontSize: 12, color: PLX_MUTED,
          textDecoration: changed ? "line-through" : "none",
          wordBreak: "break-word",
        }}>{b || <em style={{ color: PLX_SUBTLE, fontStyle: "normal" }}>—</em>}</div>
      )}
      <div style={{
        fontSize: 12, color: PLX_TEXT, fontWeight: changed ? 700 : 500,
        wordBreak: "break-word",
      }}>{a || <em style={{ color: PLX_SUBTLE, fontStyle: "normal" }}>—</em>}</div>
    </div>
  );
}

window.ProductCreate = ProductCreate;
