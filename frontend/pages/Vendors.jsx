// 仕入先 list + detail.
//
// List: hits GET /vendors which already returns product_count + ytd_purchase_total
// computed by the backend (prompt 03).
// Detail: read-only view + notes editor. Tabs other than 概要 surface a
// polite "近日対応" message — vendor-scoped product / PO lookups aren't
// in the current backend.

function Vendors() {
  const [q, setQ] = React.useState("");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const vendorsQ = useFetch(() => api.listVendors(), []);
  const allRows = vendorsQ.data?.items ?? [];
  const rows = q
    ? allRows.filter((v) => v.company_name.toLowerCase().includes(q.toLowerCase())
                         || (v.contact_name || "").includes(q))
    : allRows;

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      await api.downloadVendorsCsv();
    } catch (e) {
      window.PLX_TOAST.error("CSVエクスポートに失敗しました");
    } finally { setExporting(false); }
  }

  const headerRight = (
    <div style={{ display: "inline-flex", gap: 8 }}>
      <button onClick={handleExport} disabled={exporting}
        style={{ ...btnSecondary, opacity: exporting ? 0.6 : 1 }}>⬇ エクスポート</button>
      <button onClick={() => setShowAddModal(true)} style={btnPrimary}>
        ＋ 仕入先を追加
      </button>
    </div>
  );

  return (
    <AdminShell currentNav="vendors" breadcrumbs={["ホーム", "仕入先"]}>
      <PlxPageHead title="仕入先" subtitle={`全 ${allRows.length} 社`} right={headerRight} />

      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        padding: "14px 18px", marginBottom: 14,
      }}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="会社名・担当者で検索…" style={{ ...formInput, maxWidth: 360 }} />
      </div>

      {vendorsQ.error && <PlxErrorBanner error={vendorsQ.error} onRetry={vendorsQ.refetch} />}

      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        boxShadow: T.SHADOW_SM, overflow: "hidden",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.6fr 1fr 1.2fr 0.7fr 0.9fr 1.1fr 0.6fr",
          padding: "12px 18px", fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
          background: T.PLX_SURFACE_50, borderBottom: `1px solid ${T.PLX_LINE_200}`,
        }}>
          <span>会社名</span><span>担当者</span><span>メール</span>
          <span style={{ textAlign: "right" }}>取扱商品数</span>
          <span style={{ textAlign: "right" }}>YTD仕入額</span>
          <span>支払条件</span>
          <span style={{ textAlign: "center" }}>状態</span>
        </div>

        {vendorsQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
        {!vendorsQ.loading && rows.length === 0 && (
          <PlxEmptyState title="該当する仕入先がありません" message="検索条件を変更してください。" />
        )}
        {rows.map((v, i) => (
          <div key={v.id} onClick={() => navigate(`/vendors/${v.id}`)} style={{
            display: "grid", gridTemplateColumns: "1.6fr 1fr 1.2fr 0.7fr 0.9fr 1.1fr 0.6fr",
            padding: "14px 18px", alignItems: "center", fontSize: 12, cursor: "pointer",
            borderBottom: i < rows.length - 1 ? `1px solid ${T.PLX_LINE_100}` : "none",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = T.PLX_SURFACE_50}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <span style={{ fontWeight: 600, color: T.PLX_INK_900 }}>{v.company_name}</span>
            <span>{v.contact_name || "—"}</span>
            <span style={{ fontFamily: T.FONT_MONO, fontSize: 11, color: T.PLX_INK_500 }}>{v.email || "—"}</span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{v.product_count}</span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>¥{formatYen(v.ytd_purchase_total)}</span>
            <span style={{ fontSize: 11, color: T.PLX_INK_500 }}>{v.payment_terms || "—"}</span>
            <span style={{ textAlign: "center" }}>
              {v.status === "inactive"
                ? <Pill color={T.PLX_INK_500} bg={T.PLX_SURFACE_100}>停止中</Pill>
                : <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>取引中</Pill>}
            </span>
          </div>
        ))}
      </div>

      {showAddModal && (
        <VendorFormModal
          onClose={() => setShowAddModal(false)}
          onSaved={(v) => {
            setShowAddModal(false);
            window.PLX_TOAST.success(`仕入先「${v.company_name}」を追加しました`);
            vendorsQ.refetch();
          }}
        />
      )}
    </AdminShell>
  );
}

// Create form — mirrors the vendor fields the backend accepts (POST /vendors).
function VendorFormModal({ onClose, onSaved }) {
  const [form, setForm] = React.useState({
    company_name: "", contact_name: "", email: "", phone: "",
    address: "", website: "", payment_terms: "", notes: "",
  });
  const [saving, setSaving] = React.useState(false);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.company_name.trim()) { window.PLX_TOAST.warn("会社名を入力してください"); return; }
    setSaving(true);
    try {
      const body = {};
      for (const [k, v] of Object.entries(form)) body[k] = v.trim() ? v.trim() : null;
      body.company_name = form.company_name.trim();
      const v = await api.createVendor(body);
      onSaved(v);
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail ?? "保存に失敗しました");
      setSaving(false);
    }
  };

  return (
    <PlxModal title="仕入先を追加" onClose={onClose}>
      <FormRow label="会社名 *">
        <input value={form.company_name} onChange={(e) => update("company_name", e.target.value)}
          style={formInput} placeholder="例：サンスター株式会社" />
      </FormRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormRow label="担当者">
          <input value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} style={formInput} />
        </FormRow>
        <FormRow label="電話">
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)} style={formInput} placeholder="03-1234-5678" />
        </FormRow>
        <FormRow label="メール">
          <input value={form.email} onChange={(e) => update("email", e.target.value)} style={formInput} placeholder="contact@example.co.jp" />
        </FormRow>
        <FormRow label="支払条件">
          <input value={form.payment_terms} onChange={(e) => update("payment_terms", e.target.value)} style={formInput} placeholder="例：月末締め翌月末払い" />
        </FormRow>
      </div>
      <FormRow label="住所">
        <input value={form.address} onChange={(e) => update("address", e.target.value)} style={formInput} />
      </FormRow>
      <FormRow label="サイト">
        <input value={form.website} onChange={(e) => update("website", e.target.value)} style={formInput} placeholder="https://…" />
      </FormRow>
      <FormRow label="メモ">
        <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)}
          style={{ ...formInput, height: 60, padding: "10px 14px", resize: "vertical" }} />
      </FormRow>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={btnSecondary}>キャンセル</button>
        <button onClick={submit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
          {saving ? "保存中…" : "追加する"}
        </button>
      </div>
    </PlxModal>
  );
}

function VendorDetail({ id }) {
  const vendorQ = useFetch(() => api.getVendor(Number(id)), [id]);
  const v = vendorQ.data;
  const [notes, setNotes] = React.useState("");
  const [savingNotes, setSavingNotes] = React.useState(false);
  React.useEffect(() => { if (v) setNotes(v.notes || ""); }, [v]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.updateVendor(v.id, { notes });
      window.PLX_TOAST.success("メモを保存しました");
      vendorQ.refetch();
    } catch (e) {
      window.PLX_TOAST.error("メモの保存に失敗しました");
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <AdminShell currentNav="vendors"
      breadcrumbs={["ホーム", "仕入先", v ? v.company_name : "..."]}>
      {vendorQ.error && <PlxErrorBanner error={vendorQ.error} onRetry={vendorQ.refetch} />}
      {vendorQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
      {v && (
        <>
          <button onClick={() => navigate("/vendors")} style={{
            background: "none", border: "none", color: T.PLX_INK_500,
            fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14,
          }}>← 仕入先一覧へ戻る</button>

          <div style={{
            background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
            boxShadow: T.SHADOW_SM, padding: 24, marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, flex: 1 }}>{v.company_name}</h2>
              {v.status === "inactive"
                ? <Pill color={T.PLX_INK_500} bg={T.PLX_SURFACE_100}>停止中</Pill>
                : <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>取引中</Pill>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              <PlxDetailKV k="担当者" v={v.contact_name || "—"} />
              <PlxDetailKV k="電話" v={v.phone || "—"} />
              <PlxDetailKV k="メール" v={v.email || "—"} />
              <PlxDetailKV k="支払条件" v={v.payment_terms || "—"} />
              <PlxDetailKV k="取扱商品数" v={`${v.product_count} 件`} />
              <PlxDetailKV k="YTD仕入額" v={`¥${formatYen(v.ytd_purchase_total)}`} />
              {v.address && <PlxDetailKV k="住所" v={v.address} />}
              {v.website && <PlxDetailKV k="サイト" v={<a href={v.website} target="_blank" rel="noopener noreferrer" style={{ color: T.PLX_GREEN_700, fontFamily: T.FONT_MONO, fontSize: 12 }}>{v.website}</a>} />}
            </div>
          </div>

          <div style={{
            background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
            boxShadow: T.SHADOW_SM, padding: 24,
          }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>メモ</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              style={{ ...formInput, height: 120, padding: "12px 14px", resize: "vertical" }}
              placeholder="この仕入先に関するメモを記入..." />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={saveNotes} disabled={savingNotes}
                style={{ ...btnPrimary, opacity: savingNotes ? 0.5 : 1 }}>
                {savingNotes ? "保存中..." : "メモを保存"}
              </button>
            </div>
            <div style={{ marginTop: 16, padding: 12, background: T.PLX_BLUE_100, borderRadius: T.RADIUS_MD, fontSize: 12, color: T.PLX_BLUE_600 }}>
              取扱商品・発注履歴タブは近日対応予定です。
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}

window.Vendors = Vendors;
window.VendorDetail = VendorDetail;
