// Product Create — form + AI Assist modal. Real backend call to /ai-suggestions
// (returns mock data when OPENAI_API_KEY isn't set; real OpenAI when it is).

function ProductCreate() {
  const categoriesQ = useFetch(() => api.listCategories(), []);
  const vendorsQ    = useFetch(() => api.listVendors(),    []);
  const tagsQ       = useFetch(() => api.listTags(),       []);

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
  const [variant, setVariant]   = React.useState({
    sku: "", barcode: "", price: "", cost: "", stock: "",
    opt1k: "", opt1v: "", isDefault: true,
  });
  const [saving, setSaving]     = React.useState(false);
  const [error, setError]       = React.useState(null);

  const save = async (newStatus) => {
    setSaving(true); setError(null);
    try {
      const created = await api.createProduct({
        name,
        name_kana: nameKana || null,
        category_id: categoryId ? Number(categoryId) : null,
        vendor_id:   vendorId   ? Number(vendorId)   : null,
        description: description || null,
        status: newStatus,
        ai_session_id: aiSessionId,
        variants: [{
          sku: variant.sku || null,
          barcode: variant.barcode || null,
          option1_name:  variant.opt1k || null,
          option1_value: variant.opt1v || null,
          price: variant.price || null,
          cost:  variant.cost  || null,
          on_hand: variant.stock ? (parseInt(variant.stock, 10) || 0) : 0,
          is_default: variant.isDefault,
        }],
        tags,
      });
      navigate(`/products/${created.id}`);
    } catch (e) {
      setError(e.body?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const applyAi = (picks, sessionId) => {
    setAiSessionId(sessionId);
    if (picks.title)       setName(picks.title.value);
    if (picks.name_kana)   setNameKana(picks.name_kana.value);
    if (picks.brand && vendorsQ.data?.items) {
      const v = vendorsQ.data.items.find((x) => x.company_name === picks.brand.value);
      if (v) setVendorId(String(v.id));
    }
    if (picks.category && categoriesQ.data?.items) {
      const c = categoriesQ.data.items.find((x) => x.name === picks.category.value);
      if (c) setCategoryId(String(c.id));
    }
    if (picks.price) setVariant((v) => ({ ...v, price: picks.price.value.replace(/[¥,\s]/g, "") }));
    if (picks.barcode)     setVariant((v) => ({ ...v, barcode: picks.barcode.value }));
    if (picks.description) setDescription(picks.description.value);
    setAiOpen(false);
  };

  const headerRight = (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={() => navigate("/products")} style={btnGhost}>キャンセル</button>
      <button onClick={() => save("draft")} style={btnSecondary} disabled={!name || saving}>
        下書きとして保存
      </button>
      <button onClick={() => save("active")} style={btnPrimary} disabled={!name || saving}>
        商品を公開
      </button>
    </div>
  );

  return (
    <AdminShell title="新しい商品を追加" currentNav="products" headerRight={headerRight}
      breadcrumbs={["商品", "新規追加"]}>
      <button onClick={() => navigate("/products")} style={{
        background: "none", border: "none", color: PLX_MUTED,
        fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14,
      }}>← 商品一覧へ戻る</button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* AI banner */}
          <div style={{
            background: "linear-gradient(100deg, #E6F7F2 0%, #F4FBF8 80%)",
            border: `1px solid ${PLX_GREEN_LIGHT}`, borderRadius: 14,
            padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: "#fff",
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
            <button onClick={() => setAiOpen(true)} style={{
              height: 38, padding: "0 18px", borderRadius: 9999,
              background: PLX_GREEN, color: "#fff", border: "none",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              boxShadow: "0 6px 16px rgba(26,166,138,.25)", whiteSpace: "nowrap",
            }}>✨ AI で入力する</button>
          </div>

          {/* Basic info */}
          <FormSection title="基本情報" subtitle="商品の基本となる情報を入力します">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormRow label="商品名（漢字）">
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="例：エグザフレックス インプレッション" style={formInput} />
              </FormRow>
              <FormRow label="商品名（かな）">
                <input value={nameKana} onChange={(e) => setNameKana(e.target.value)}
                  placeholder="エグザフレックス インプレッション" style={formInput} />
              </FormRow>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormRow label="カテゴリ">
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
                alignItems: "center", background: "#fff",
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
                      border: `1px dashed ${PLX_BORDER}`, background: "#fff",
                      color: PLX_MUTED, cursor: "pointer",
                    }}>＋ {t.name}</button>
                ))}
              </div>
            </FormRow>
          </FormSection>

          {/* Variant */}
          <FormSection title="バリアント" subtitle="SKU・価格・初期在庫">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormRow label="SKU">
                <input value={variant.sku}
                  onChange={(e) => setVariant({ ...variant, sku: e.target.value })}
                  placeholder="GC-EX-001" style={formInput} />
              </FormRow>
              <FormRow label="JAN / バーコード">
                <input value={variant.barcode}
                  onChange={(e) => setVariant({ ...variant, barcode: e.target.value })}
                  placeholder="4987246012001" style={formInput} />
              </FormRow>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <FormRow label="販売価格 (¥)">
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute", left: 14, top: 10,
                    fontSize: 13, color: PLX_MUTED, fontWeight: 700,
                  }}>¥</span>
                  <input value={variant.price}
                    onChange={(e) => setVariant({ ...variant, price: e.target.value })}
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
                    onChange={(e) => setVariant({ ...variant, cost: e.target.value })}
                    placeholder="3100" style={{
                      ...formInput, paddingLeft: 28, fontVariantNumeric: "tabular-nums",
                    }} />
                </div>
              </FormRow>
              <FormRow label="初期在庫数">
                <input value={variant.stock}
                  onChange={(e) => setVariant({ ...variant, stock: e.target.value })}
                  placeholder="0" style={{ ...formInput, fontVariantNumeric: "tabular-nums" }} />
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
                width: 44, height: 44, borderRadius: 8, background: "#fff",
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

      {aiOpen && (
        <AiAssistModal onClose={() => setAiOpen(false)} onApply={applyAi} />
      )}
    </AdminShell>
  );
}

function FormSection({ title, subtitle, children }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14,
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
      background: checked ? PLX_GREEN_50 : "#fff",
      cursor: "pointer", display: "flex", gap: 11, alignItems: "flex-start",
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: "50%",
        border: `2px solid ${checked ? PLX_GREEN : PLX_BORDER}`,
        background: "#fff", display: "flex",
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

const FIELD_DEFS = [
  { key: "title",       label: "商品名 (title)" },
  { key: "name_kana",   label: "商品名（かな）" },
  { key: "brand",       label: "ブランド / 仕入先" },
  { key: "category",    label: "カテゴリ" },
  { key: "barcode",     label: "JAN / バーコード" },
  { key: "price",       label: "参考価格" },
  { key: "description", label: "説明文" },
];

function AiAssistModal({ onClose, onApply }) {
  const [phase, setPhase] = React.useState("input"); // input | loading | results | error
  const [jan, setJan]     = React.useState("");
  const [name, setName]   = React.useState("");
  const [picks, setPicks] = React.useState({});
  const [session, setSession] = React.useState(null);
  const [error, setError] = React.useState(null);

  const lookup = async () => {
    setPhase("loading"); setError(null);
    try {
      let s = await api.createAiSuggestion({
        jan: jan || undefined,
        title: name || undefined,
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
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 18, width: 680, maxHeight: "86%",
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
              <div style={{ fontSize: 13, color: PLX_TEXT, marginBottom: 18, lineHeight: 1.7 }}>
                JAN コード（バーコード）または商品名を入力してください。AI が公開情報から候補を取得し、候補の中から選んで商品フォームに反映できます。
              </div>
              <FormRow label="JAN コード（バーコード）">
                <input value={jan} onChange={(e) => setJan(e.target.value)}
                  placeholder="4987246012001" style={{
                    ...formInput,
                    fontFamily: "ui-monospace,SFMono-Regular,monospace",
                    letterSpacing: ".05em",
                  }} />
              </FormRow>
              <FormRow label="商品名（任意 · JAN がない場合に利用）">
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="例：パナビア V5 ペースト" style={formInput} />
              </FormRow>
              <div style={{
                background: PLX_GREEN_50, borderRadius: 10,
                padding: "10px 14px", fontSize: 11, color: PLX_MUTED,
                lineHeight: 1.6, marginTop: 6,
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
                          background: on ? PLX_GREEN_50 : "#fff",
                          cursor: "pointer", display: "flex",
                          alignItems: "center", gap: 12,
                        }}>
                          <span style={{
                            width: 14, height: 14, borderRadius: 4,
                            border: `2px solid ${on ? PLX_GREEN : PLX_BORDER}`,
                            background: on ? PLX_GREEN : "#fff",
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
          {phase === "input" && (
            <button onClick={lookup} disabled={!jan && !name} style={{
              ...btnPrimary, opacity: !jan && !name ? 0.5 : 1,
            }}>🔍 候補を検索</button>
          )}
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

window.ProductCreate = ProductCreate;
