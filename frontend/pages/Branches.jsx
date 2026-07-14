// 院・店舗 — list as card grid + detail page.
// Card grid uses the new branch_type/manager_name/operating_hours_json fields
// that prompt 03 added. Each card fetches its own inventory snapshot.

function Branches() {
  const branchesQ = useFetch(() => api.listBranches(), []);
  const rows = branchesQ.data?.items ?? [];
  const [modal, setModal] = React.useState(null); // null | {editing: branch|null}

  return (
    <AdminShell currentNav="branches" breadcrumbs={["ホーム", "院・店舗"]}>
      <PlxPageHead title="院・店舗" subtitle={`全 ${rows.length} 拠点`}
        right={
          <button onClick={() => setModal({ editing: null })} style={btnPrimary}>
            ＋ 店舗を追加
          </button>
        }/>

      {branchesQ.error && <PlxErrorBanner error={branchesQ.error} onRetry={branchesQ.refetch} />}
      {branchesQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
        {rows.map((b) => (
          <BranchCard key={b.id} branch={b} onEdit={() => setModal({ editing: b })} />
        ))}
      </div>

      {modal && (
        <BranchFormModal
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSaved={(b) => {
            setModal(null);
            window.PLX_TOAST.success(
              modal.editing ? `「${b.name}」を更新しました` : `拠点「${b.name}」を追加しました`);
            branchesQ.refetch();
          }}
        />
      )}
    </AdminShell>
  );
}

function BranchCard({ branch, onEdit }) {
  const snapQ = useFetch(() => api.getBranchInventorySnapshot(branch.id), [branch.id]);
  const snap = snapQ.data;
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      boxShadow: T.SHADOW_SM, padding: 22, cursor: "pointer",
    }}
      onClick={() => navigate(`/branches/${branch.id}`)}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = T.SHADOW_MD}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = T.SHADOW_SM}
    >
      <div style={{
        height: 140, borderRadius: T.RADIUS_MD, background: T.PLX_SURFACE_100,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
      }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={T.PLX_INK_400}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          <path d="M2 22h20"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
        </svg>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {branch.branch_type === "main"
          ? <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>本院</Pill>
          : <Pill color={T.PLX_BLUE_600} bg={T.PLX_BLUE_100}>分院</Pill>}
        {branch.status === "inactive"
          ? <Pill color={T.PLX_INK_500} bg={T.PLX_SURFACE_100}>休業中</Pill>
          : <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>営業中</Pill>}
      </div>

      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{branch.name}</h3>

      <div style={{ fontSize: 13, color: T.PLX_INK_700, lineHeight: 1.7 }}>
        {branch.postal_code && <div style={{ color: T.PLX_INK_500, fontSize: 12 }}>〒{branch.postal_code}</div>}
        {branch.address && <div>{branch.address}</div>}
        {branch.phone && <div style={{ marginTop: 6 }}>📞 {branch.phone}</div>}
        {branch.manager_name && <div style={{ marginTop: 6 }}>院長/管理者: <b>{branch.manager_name}</b></div>}
      </div>

      <div style={{
        marginTop: 14, padding: 12, background: T.PLX_GREEN_050,
        borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_GREEN_100}`,
      }}>
        <div style={{ fontSize: 11, color: T.PLX_INK_500, fontWeight: 600, marginBottom: 4 }}>在庫スナップショット</div>
        {snapQ.loading && <div style={{ fontSize: 12, color: T.PLX_INK_500 }}>読み込み中…</div>}
        {snap && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: T.PLX_GREEN_700 }}>
              {snap.total_items.toLocaleString()} 点
            </span>
            <span style={{ fontSize: 13, color: T.PLX_INK_700 }}>
              ¥{formatYen(snap.total_value_jpy)}
            </span>
            {snap.low_stock_count > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: T.PLX_AMBER_600,
                background: T.PLX_AMBER_100, padding: "2px 8px", borderRadius: 9999 }}>
                低 {snap.low_stock_count}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card actions — 詳細 / 編集 (mockup shows both buttons on each card) */}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={(e) => { e.stopPropagation(); navigate(`/branches/${branch.id}`); }}
          style={{ ...btnSecondary, flex: 1, height: 34, fontSize: 12 }}>詳細</button>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
          style={{ ...btnSecondary, flex: 1, height: 34, fontSize: 12 }}>✎ 編集</button>
      </div>
    </div>
  );
}

// Create / edit form. POST /branches on create, PATCH /branches/:id on edit.
function BranchFormModal({ editing, onClose, onSaved }) {
  const [form, setForm] = React.useState({
    name: editing?.name || "",
    branch_type: editing?.branch_type || "sub",
    postal_code: editing?.postal_code || "",
    address: editing?.address || "",
    phone: editing?.phone || "",
    manager_name: editing?.manager_name || "",
    low_stock_threshold: editing?.low_stock_threshold ?? 10,
    default_tax_rate: parseFloat(editing?.default_tax_rate ?? 10),
    status: editing?.status || "active",
  });
  const [saving, setSaving] = React.useState(false);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { window.PLX_TOAST.warn("拠点名を入力してください"); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        branch_type: form.branch_type,
        postal_code: form.postal_code.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        manager_name: form.manager_name.trim() || null,
        // `|| 10` would corrupt a deliberately-entered 0 into 10 — only fall
        // back when the field is blank / non-numeric (review 2026-07-14).
        low_stock_threshold: Number.isFinite(Number(form.low_stock_threshold)) && String(form.low_stock_threshold).trim() !== ""
          ? Number(form.low_stock_threshold) : 10,
        default_tax_rate: Number.isFinite(Number(form.default_tax_rate)) && String(form.default_tax_rate).trim() !== ""
          ? Number(form.default_tax_rate) : 10,
        status: form.status,
      };
      const b = editing
        ? await api.updateBranch(editing.id, body)
        : await api.createBranch(body);
      onSaved(b);
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail ?? "保存に失敗しました");
      setSaving(false);
    }
  };

  return (
    <PlxModal title={editing ? "拠点を編集" : "店舗を追加"} onClose={onClose}>
      <FormRow label="拠点名 *">
        <input value={form.name} onChange={(e) => update("name", e.target.value)}
          style={formInput} placeholder="例：ペイライト歯科 梅田分院" />
      </FormRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormRow label="種別">
          <SegmentedControl value={form.branch_type} onChange={(v) => update("branch_type", v)} options={[
            { value: "main", label: "本院" },
            { value: "sub", label: "分院" },
          ]}/>
        </FormRow>
        <FormRow label="状態">
          <SegmentedControl value={form.status} onChange={(v) => update("status", v)} options={[
            { value: "active", label: "営業中" },
            { value: "inactive", label: "休業中" },
          ]}/>
        </FormRow>
        <FormRow label="郵便番号">
          <input value={form.postal_code} onChange={(e) => update("postal_code", e.target.value)}
            style={formInput} placeholder="530-0001" />
        </FormRow>
        <FormRow label="電話">
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)}
            style={formInput} placeholder="06-1234-5678" />
        </FormRow>
      </div>
      <FormRow label="住所">
        <input value={form.address} onChange={(e) => update("address", e.target.value)} style={formInput} />
      </FormRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <FormRow label="院長/管理者">
          <input value={form.manager_name} onChange={(e) => update("manager_name", e.target.value)} style={formInput} />
        </FormRow>
        <FormRow label="在庫低下しきい値">
          <input type="number" min={0} value={form.low_stock_threshold}
            onChange={(e) => update("low_stock_threshold", e.target.value)} style={formInput} />
        </FormRow>
        <FormRow label="デフォルト税率(%)">
          <input type="number" min={0} step="0.01" value={form.default_tax_rate}
            onChange={(e) => update("default_tax_rate", e.target.value)} style={formInput} />
        </FormRow>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={btnSecondary}>キャンセル</button>
        <button onClick={submit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
          {saving ? "保存中…" : editing ? "変更を保存" : "追加する"}
        </button>
      </div>
    </PlxModal>
  );
}

function BranchDetail({ id }) {
  const branchQ = useFetch(() => api.getBranch(Number(id)), [id]);
  const snapQ = useFetch(() => api.getBranchInventorySnapshot(Number(id)), [id]);
  const b = branchQ.data;
  const snap = snapQ.data;

  return (
    <AdminShell currentNav="branches"
      breadcrumbs={["ホーム", "院・店舗", b ? b.name : "..."]}>
      {branchQ.error && <PlxErrorBanner error={branchQ.error} onRetry={branchQ.refetch} />}
      {branchQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
      {b && (
        <>
          <button onClick={() => navigate("/branches")} style={{
            background: "none", border: "none", color: T.PLX_INK_500,
            fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14,
          }}>← 院・店舗一覧へ戻る</button>

          <div style={{
            background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
            boxShadow: T.SHADOW_SM, padding: 24, marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, flex: 1 }}>{b.name}</h2>
              {b.branch_type === "main"
                ? <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>本院</Pill>
                : <Pill color={T.PLX_BLUE_600} bg={T.PLX_BLUE_100}>分院</Pill>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              <PlxDetailKV k="郵便番号" v={b.postal_code ? `〒${b.postal_code}` : "—"} />
              <PlxDetailKV k="電話" v={b.phone || "—"} />
              <PlxDetailKV k="院長/管理者" v={b.manager_name || "—"} />
              {b.address && <PlxDetailKV k="住所" v={b.address} />}
              <PlxDetailKV k="デフォルト税率" v={`${parseFloat(b.default_tax_rate || 10)}%`} />
              <PlxDetailKV k="在庫低下しきい値" v={`${b.low_stock_threshold} 件`} />
            </div>

            {b.operating_hours_json && (
              <div style={{ marginTop: 16, padding: 14, background: T.PLX_SURFACE_50, borderRadius: T.RADIUS_MD }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.PLX_INK_500, marginBottom: 8 }}>営業時間</div>
                <table style={{ fontSize: 12, width: "100%" }}>
                  <tbody>
                    {Object.entries(b.operating_hours_json).map(([day, slots]) => (
                      <tr key={day}>
                        <td style={{ padding: "3px 0", color: T.PLX_INK_500, width: 60 }}>{dayJp(day)}</td>
                        <td style={{ padding: "3px 0", color: T.PLX_INK_900 }}>
                          {!slots || slots.length === 0
                            ? <span style={{ color: T.PLX_INK_500 }}>休診</span>
                            : slots.map((s) => `${s.open}–${s.close}`).join(" / ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {snap && (
            <div style={{
              background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
              boxShadow: T.SHADOW_SM, padding: 24,
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 14 }}>在庫スナップショット</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                <PlxKpiTile label="在庫点数" value={snap.total_items} unit="点" tone="green"/>
                <PlxKpiTile label="在庫金額" value={`¥${formatYen(snap.total_value_jpy)}`} unit="" tone="green"/>
                <PlxKpiTile label="在庫低下" value={snap.low_stock_count} unit="件"
                  tone={snap.low_stock_count > 0 ? "amber" : "muted"}/>
                <PlxKpiTile label="期限間近" value={snap.expiring_soon_count} unit="件"
                  tone={snap.expiring_soon_count > 0 ? "red" : "muted"}/>
              </div>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}

function dayJp(d) {
  return { mon: "月", tue: "火", wed: "水", thu: "木", fri: "金", sat: "土", sun: "日", holiday: "祝" }[d] || d;
}

window.Branches = Branches;
window.BranchDetail = BranchDetail;
