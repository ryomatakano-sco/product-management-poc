// 設定 — 5 namespaces from prompt 03 (general/notifications/tax_rates/ai/integrations).
// Left nav switches namespace; right pane is a namespace-specific form.
// The AI namespace masks the API key — even when typed, it's only sent on save
// and the GET response only carries `openai_api_key_set: bool`.

const SETTINGS_SECTIONS = [
  { id: "general",       label: "一般",          icon: "settings" },
  { id: "appearance",    label: "外観・言語",    icon: "palette" },
  { id: "notifications", label: "通知",          icon: "bell" },
  { id: "tax_rates",     label: "税率",          icon: "calc" },
  { id: "ai",            label: "AI設定",        icon: "sparkles" },
  { id: "integrations",  label: "統合",          icon: "link" },
  { id: "users",         label: "ユーザー管理",  icon: "users" },
  { id: "api",           label: "API・Webhooks", icon: "key" },
];

function Settings({ query }) {
  const [ns, setNs] = React.useState(query?.ns || "general");

  const switchNs = (n) => {
    setNs(n);
    navigate(`/settings?ns=${n}`);
  };

  return (
    <AdminShell currentNav="settings" breadcrumbs={["ホーム", "設定"]}>
      <PlxPageHead title="設定" subtitle="ワークスペース全体の設定を管理します" />

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18, alignItems: "flex-start" }}>
        {/* Left nav */}
        <div style={{
          background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
          boxShadow: T.SHADOW_SM, padding: 6, position: "sticky", top: 24,
        }}>
          {SETTINGS_SECTIONS.map((s) => (
            <button key={s.id} onClick={() => switchNs(s.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 14px", border: "none", cursor: "pointer",
              borderRadius: T.RADIUS_MD, fontSize: 13, fontWeight: 600,
              borderLeft: ns === s.id ? `3px solid ${T.PLX_GREEN_600}` : "3px solid transparent",
              background: ns === s.id ? T.PLX_GREEN_100 : "transparent",
              color: ns === s.id ? T.PLX_GREEN_700 : T.PLX_INK_700,
              marginBottom: 2,
            }}>
              {s.label}
              {s.placeholder && <span style={{ marginLeft: 8, fontSize: 9, color: T.PLX_INK_400 }}>準備中</span>}
            </button>
          ))}
        </div>

        {/* Right pane */}
        <div>
          {ns === "general" && <GeneralSettings />}
          {ns === "appearance" && <AppearanceSettings />}
          {ns === "notifications" && <NotificationsSettings />}
          {ns === "tax_rates" && <TaxRatesSettings />}
          {ns === "ai" && <AiSettings />}
          {ns === "integrations" && <IntegrationsSettings />}
          {ns === "users" && <><UsersSettings /><AuditLogSection /></>}
          {ns === "api" && <ApiSettings />}
        </div>
      </div>
    </AdminShell>
  );
}

// ── Per-namespace forms ────────────────────────────────────────────

function SettingsCard({ title, children, onSave, saving }) {
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      boxShadow: T.SHADOW_SM, padding: 24, marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
        {onSave && (
          <button onClick={onSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? "保存中..." : "保存"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function useSettingsForm(namespace) {
  const q = useFetch(() => api.getSettings(namespace), [namespace]);
  const [form, setForm] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { if (q.data?.data) setForm(q.data.data); }, [q.data]);
  const update = (k, v) => setForm({ ...form, [k]: v });
  const save = async (override) => {
    setSaving(true);
    try {
      await api.updateSettings(namespace, override || form);
      window.PLX_TOAST.success("設定を保存しました");
      q.refetch();
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail?.detail || e?.body?.detail || "設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };
  return { form, update, save, saving, loading: q.loading, error: q.error, reload: q.refetch };
}

function GeneralSettings() {
  const f = useSettingsForm("general");
  if (f.loading) return <SettingsCard title="一般"><div style={{ color: T.PLX_INK_500 }}>読み込み中…</div></SettingsCard>;
  return (
    <SettingsCard title="一般" onSave={() => f.save()} saving={f.saving}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FormRow label="会社名"><input value={f.form.company_name || ""} onChange={(e) => f.update("company_name", e.target.value)} style={formInput} /></FormRow>
        <FormRow label="法人番号"><input value={f.form.company_registration_no || ""} onChange={(e) => f.update("company_registration_no", e.target.value)} style={formInput} /></FormRow>
        <FormRow label="代表者"><input value={f.form.representative || ""} onChange={(e) => f.update("representative", e.target.value)} style={formInput} /></FormRow>
        <FormRow label="電話"><input value={f.form.phone || ""} onChange={(e) => f.update("phone", e.target.value)} style={formInput} /></FormRow>
        <FormRow label="メール"><input value={f.form.email || ""} onChange={(e) => f.update("email", e.target.value)} style={formInput} /></FormRow>
        <FormRow label="タイムゾーン"><input value={f.form.timezone || ""} onChange={(e) => f.update("timezone", e.target.value)} style={formInput} /></FormRow>
      </div>
      <FormRow label="住所">
        <textarea value={f.form.address || ""} onChange={(e) => f.update("address", e.target.value)}
          style={{ ...formInput, height: 60, padding: "10px 14px" }} />
      </FormRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <FormRow label="言語"><input value={f.form.language || "ja"} onChange={(e) => f.update("language", e.target.value)} style={formInput} /></FormRow>
        <FormRow label="通貨"><input value={f.form.currency || "JPY"} onChange={(e) => f.update("currency", e.target.value)} style={formInput} /></FormRow>
        <FormRow label="ブランドカラー">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={f.form.brand_color_hex || "#16A36C"}
              onChange={(e) => f.update("brand_color_hex", e.target.value)}
              style={{ ...formInput, fontFamily: T.FONT_MONO }} />
            <span style={{
              width: 38, height: 38, borderRadius: T.RADIUS_MD,
              background: f.form.brand_color_hex || "#16A36C",
              flexShrink: 0, border: `1px solid ${T.PLX_LINE_200}`,
            }} />
          </div>
        </FormRow>
      </div>

      {/* 表示ロゴ — mockup's dashed drop zone (ブランディング section) */}
      <LogoUploader logoUrl={f.form.logo_url} onChanged={f.reload} />
    </SettingsCard>
  );
}

// Dashed drop-zone for the company logo. Click or drag & drop a PNG/JPEG/WebP
// (≤2MB) → POST /settings/logo stores the file and writes `logo_url` into the
// general settings blob; 削除 clears both.
function LogoUploader({ logoUrl, onChanged }) {
  const inputRef = React.useRef(null);
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  const doUpload = async (file) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      await api.uploadLogo(file);
      window.PLX_TOAST.success("ロゴをアップロードしました");
      onChanged();
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail?.detail || "アップロードに失敗しました");
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (busy) return;
    if (!window.confirm((window.PLX_TR || String)("ロゴを削除しますか？"))) return;
    setBusy(true);
    try {
      await api.deleteLogo();
      window.PLX_TOAST.success("ロゴを削除しました");
      onChanged();
    } catch (e) {
      window.PLX_TOAST.error("削除に失敗しました");
    } finally { setBusy(false); }
  };

  return (
    <FormRow label="表示ロゴ" hint="PNG / JPEG / WebP、2MB まで。レシートや帳票のヘッダーに使用予定です。">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(e) => { doUpload(e.target.files?.[0]); e.target.value = ""; }} />
      {logoUrl ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={logoUrl} alt="ロゴ" style={{
            height: 64, maxWidth: 220, objectFit: "contain",
            border: `1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_MD,
            background: "#fff", padding: 6,
          }} />
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            style={{ ...btnSecondary, opacity: busy ? 0.6 : 1 }}>変更</button>
          <button onClick={doDelete} disabled={busy} style={{
            ...btnSecondary, color: T.PLX_RED_600, opacity: busy ? 0.6 : 1,
          }}>削除</button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); doUpload(e.dataTransfer.files?.[0]); }}
          style={{
            border: `2px dashed ${dragOver ? T.PLX_GREEN_600 : T.PLX_LINE_200}`,
            borderRadius: T.RADIUS_MD, padding: "26px 20px", textAlign: "center",
            cursor: "pointer", background: dragOver ? T.PLX_GREEN_100 : T.PLX_SURFACE_50,
            color: T.PLX_INK_500, fontSize: 12, transition: "all .12s",
          }}>
          {busy ? "アップロード中…" : <>🖼 クリックして画像を選択、またはここにドラッグ&ドロップ</>}
        </div>
      )}
    </FormRow>
  );
}

function NotificationsSettings() {
  const f = useSettingsForm("notifications");
  if (f.loading) return <SettingsCard title="通知"><div style={{ color: T.PLX_INK_500 }}>読み込み中…</div></SettingsCard>;
  const toggle = (k) => f.update(k, !f.form[k]);
  return (
    <SettingsCard title="通知" onSave={() => f.save()} saving={f.saving}>
      <ToggleRow label="メール通知を有効化" on={!!f.form.email_enabled} onChange={() => toggle("email_enabled")} />
      <ToggleRow label="在庫低下" on={!!f.form.low_stock} onChange={() => toggle("low_stock")} />
      <ToggleRow label="期限間近（60日前）" on={!!f.form.expiring_soon} onChange={() => toggle("expiring_soon")} />
      <ToggleRow label="発注書ステータス変更" on={!!f.form.po_status_change} onChange={() => toggle("po_status_change")} />
      <FormRow label="日次サマリー時刻">
        <input value={f.form.daily_summary_time || "08:00"} onChange={(e) => f.update("daily_summary_time", e.target.value)}
          placeholder="HH:MM" style={{ ...formInput, maxWidth: 120, fontFamily: T.FONT_MONO }} />
      </FormRow>

      {/* Email delivery (heavy-tier item 3). In-app notifications always work;
          email additionally fires when SMTP + 宛先 are configured. */}
      <div style={{
        marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.PLX_LINE_200}`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>メール配信 (SMTP)</div>
        <div style={{ fontSize: 11, color: T.PLX_INK_500, marginBottom: 12 }}>
          未設定の場合はアプリ内通知（ベル）のみ動作します。設定するとベルと同じ内容がメールでも届きます。
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <FormRow label="通知の宛先メール">
            <input value={f.form.notify_email || ""} onChange={(e) => f.update("notify_email", e.target.value)}
              placeholder="alerts@example.co.jp" style={formInput} />
          </FormRow>
          <FormRow label="SMTPホスト">
            <input value={f.form.smtp_host || ""} onChange={(e) => f.update("smtp_host", e.target.value)}
              placeholder="smtp.example.com" style={formInput} />
          </FormRow>
          <FormRow label="SMTPポート">
            <input type="number" value={f.form.smtp_port ?? 587} onChange={(e) => f.update("smtp_port", Number(e.target.value) || 587)}
              style={{ ...formInput, maxWidth: 120 }} />
          </FormRow>
          <FormRow label="送信元 (From)">
            <input value={f.form.smtp_from || ""} onChange={(e) => f.update("smtp_from", e.target.value)}
              placeholder="noreply@example.co.jp" style={formInput} />
          </FormRow>
          <FormRow label="SMTPユーザー">
            <input value={f.form.smtp_user || ""} onChange={(e) => f.update("smtp_user", e.target.value)} style={formInput} />
          </FormRow>
          <FormRow label="SMTPパスワード">
            <input type="password" value={f.form.smtp_password || ""} onChange={(e) => f.update("smtp_password", e.target.value)}
              placeholder="••••••" style={formInput} />
          </FormRow>
        </div>
      </div>
    </SettingsCard>
  );
}

function ToggleRow({ label, on, onChange }) {
  return (
    <div onClick={onChange} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", borderBottom: `1px solid ${T.PLX_LINE_100}`, cursor: "pointer",
    }}>
      <span style={{ fontSize: 13, color: T.PLX_INK_900 }}>{label}</span>
      <span style={{
        width: 38, height: 22, borderRadius: 9999,
        background: on ? T.PLX_GREEN_600 : T.PLX_LINE_200,
        position: "relative", transition: "background .12s",
      }}>
        <span style={{
          position: "absolute", top: 2, left: on ? 18 : 2,
          width: 18, height: 18, background: T.PLX_CARD_BG, borderRadius: "50%",
          transition: "left .12s", boxShadow: "0 1px 2px rgba(0,0,0,.2)",
        }} />
      </span>
    </div>
  );
}

function TaxRatesSettings() {
  const f = useSettingsForm("tax_rates");
  const [rows, setRows] = React.useState(null);
  // Re-sync local editing state whenever the server payload changes (initial
  // load AND after a save's refetch) — a `rows === null` one-shot guard left
  // the UI showing stale rows after saving (review 2026-07-14).
  const serverSig = JSON.stringify(f.form.rates ?? null);
  React.useEffect(() => {
    if (f.form.rates) setRows(f.form.rates);
  }, [serverSig]);
  if (f.loading || rows === null) return <SettingsCard title="税率"><div style={{ color: T.PLX_INK_500 }}>読み込み中…</div></SettingsCard>;

  const upd = (i, k, v) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const setDefault = (i) => setRows(rows.map((r, j) => ({ ...r, is_default: j === i })));
  const addRow = () => setRows([...rows, { id: Math.max(0, ...rows.map(r => r.id || 0)) + 1, name: "", rate: "10", is_default: rows.length === 0 }]);
  const removeRow = (i) => {
    const next = rows.filter((_, j) => j !== i);
    if (next.length > 0 && !next.some(r => r.is_default)) next[0] = { ...next[0], is_default: true };
    setRows(next);
  };
  const saveRates = () => {
    for (const r of rows) {
      if (!String(r.name || "").trim()) { window.PLX_TOAST.warn("税率名を入力してください"); return; }
      if (isNaN(Number(r.rate)) || Number(r.rate) < 0 || Number(r.rate) > 100) { window.PLX_TOAST.warn("税率は 0〜100 の数値で入力してください"); return; }
    }
    f.save({ rates: rows.map(r => ({ ...r, rate: String(r.rate) })) });
  };

  return (
    <SettingsCard title="税率">
      {rows.length === 0 && <div style={{ color: T.PLX_INK_500, marginBottom: 8 }}>税率が設定されていません。</div>}
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "1.5fr 120px 90px 60px",
          gap: 12, padding: "8px 0", alignItems: "center",
          borderBottom: `1px solid ${T.PLX_LINE_100}`,
        }}>
          <input value={r.name} onChange={(e) => upd(i, "name", e.target.value)}
            placeholder="例: 標準税率" style={formInput} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="number" min={0} max={100} step="0.1" value={r.rate}
              onChange={(e) => upd(i, "rate", e.target.value)}
              style={{ ...formInput, width: 80, textAlign: "right", fontFamily: T.FONT_MONO }} />
            <span style={{ fontSize: 13, color: T.PLX_INK_500 }}>%</span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.PLX_INK_700, cursor: "pointer" }}>
            <input type="radio" name="tax-default" checked={!!r.is_default} onChange={() => setDefault(i)} />
            標準
          </label>
          <button onClick={() => removeRow(i)} title="この税率を削除" style={{
            background: "none", border: "none", cursor: "pointer", color: T.PLX_RED_600, fontSize: 15,
          }}>🗑</button>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
        <button onClick={addRow} style={{
          padding: "7px 14px", borderRadius: T.RADIUS_MD, border: `1px dashed ${T.PLX_LINE_200}`,
          background: "transparent", fontSize: 12, fontWeight: 700, color: T.PLX_INK_700, cursor: "pointer",
        }}>＋ 税率を追加</button>
        <button onClick={saveRates} disabled={f.saving} style={{
          padding: "8px 18px", borderRadius: T.RADIUS_MD, border: "none",
          background: T.PLX_GREEN_600, color: "#fff", fontSize: 13, fontWeight: 700,
          cursor: f.saving ? "not-allowed" : "pointer", opacity: f.saving ? 0.6 : 1,
        }}>{f.saving ? "保存中…" : "変更を保存"}</button>
      </div>
    </SettingsCard>
  );
}

function AiSettings() {
  const f = useSettingsForm("ai");
  const [keyInput, setKeyInput] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null); // null | {ok, message}

  if (f.loading) return <SettingsCard title="AI設定"><div style={{ color: T.PLX_INK_500 }}>読み込み中…</div></SettingsCard>;

  const saveWithKey = () => {
    const body = { ...f.form };
    if (keyInput.trim()) body.openai_api_key = keyInput.trim();
    f.save(body);
    setKeyInput("");
  };

  const testConnection = async () => {
    if (testing) return;
    if (keyInput.trim()) {
      window.PLX_TOAST.warn("入力中のキーはまだ保存されていません。保存してからテストしてください。");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.testAiConnection();
      setTestResult(r);
      if (r.ok) window.PLX_TOAST.success(r.message);
      else window.PLX_TOAST.warn(r.message);
    } catch (e) {
      setTestResult({ ok: false, message: "接続テストに失敗しました" });
      window.PLX_TOAST.error("接続テストに失敗しました");
    } finally { setTesting(false); }
  };

  return (
    <SettingsCard title="AI設定" onSave={saveWithKey} saving={f.saving}>
      <FormRow label="自動入力モード">
        <Select value={f.form.auto_fill_mode || "auto"} onChange={(v) => f.update("auto_fill_mode", v)} options={[
          { value: "auto", label: "自動" },
          { value: "confirm", label: "確認あり" },
          { value: "disabled", label: "無効" },
        ]}/>
      </FormRow>
      <FormRow label="OpenAI APIキー" hint={f.form.openai_api_key_set
        ? "キーは設定済みです。変更する場合のみ新しい値を入力してください。"
        : "AI機能を有効にするにはキーを設定してください。空欄でも保存できます。"}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
            placeholder={f.form.openai_api_key_set ? "••••••••（設定済み）" : "sk-..."} style={formInput} />
          <button onClick={testConnection} disabled={testing} style={{
            ...btnSecondary, whiteSpace: "nowrap", height: 38, padding: "0 14px",
            opacity: testing ? 0.6 : 1,
          }}>{testing ? "テスト中…" : "接続テスト"}</button>
          {testResult && (
            testResult.ok
              ? <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>接続済み</Pill>
              : <Pill color={T.PLX_RED_600} bg={T.PLX_RED_100}>失敗</Pill>
          )}
        </div>
      </FormRow>
      <FormRow label="モデル">
        <input value={f.form.model || "gpt-4o-mini"} onChange={(e) => f.update("model", e.target.value)} style={formInput} />
      </FormRow>
      <div style={{
        background: T.PLX_SURFACE_50, borderRadius: T.RADIUS_MD,
        padding: 14, fontSize: 12, color: T.PLX_INK_700,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>今月の使用量</div>
        <div style={{ display: "flex", gap: 18 }}>
          <span>APIコール: {(f.form.monthly_usage?.api_calls || 0).toLocaleString()}</span>
          <span>トークン: {((f.form.monthly_usage?.tokens || 0) / 1000).toFixed(1)}k</span>
          <span>概算費用: ¥{formatYen(f.form.monthly_usage?.cost_jpy || 0)}</span>
        </div>
      </div>
    </SettingsCard>
  );
}

function IntegrationsSettings() {
  const f = useSettingsForm("integrations");
  if (f.loading) return <SettingsCard title="統合"><div style={{ color: T.PLX_INK_500 }}>読み込み中…</div></SettingsCard>;
  return (
    <SettingsCard title="統合">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        <IntegrationTile name="paylight X SSO"
          connected={!!f.form.paylight_x_sso?.connected} />
        <IntegrationTile name="会計ソフト連携"
          extra={f.form.accounting?.provider || "未選択"}
          connected={!!f.form.accounting?.connected} />
        <IntegrationTile name="LINE公式アカウント"
          connected={!!f.form.line_official?.connected} />
        <IntegrationTile name="Slack 通知"
          connected={!!f.form.slack?.connected} />
      </div>
    </SettingsCard>
  );
}

function IntegrationTile({ name, extra, connected }) {
  return (
    <div style={{
      padding: 16, border: `1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_MD,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{name}</div>
        {connected
          ? <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>接続済み</Pill>
          : <Pill color={T.PLX_INK_500} bg={T.PLX_SURFACE_100}>未接続</Pill>}
      </div>
      {extra && <div style={{ fontSize: 11, color: T.PLX_INK_500, marginTop: 4 }}>{extra}</div>}
      <button onClick={() => window.PLX_TOAST.warn("デモ用未実装")} style={{
        ...btnSecondary, marginTop: 10, height: 32, padding: "0 14px", fontSize: 12,
      }}>{connected ? "再認証" : "接続する"}</button>
    </div>
  );
}

// ユーザー管理 — backed by /auth/users (admin only; staff see a 403 notice).
// 監査ログ — admin-only activity feed (mig 016): user management events,
// settings changes. Write attribution (created_by) lives on each record.
function AuditLogSection() {
  const q = useFetch(() => api.listAuditEvents({ limit: 15 }), []);
  const items = q.data?.items || [];
  const ACTION_JA = {
    user_created: "ユーザー追加",
    user_disabled: "ユーザー無効化",
    user_enabled: "ユーザー有効化",
    user_role_changed: "権限変更",
    user_password_reset: "パスワード再設定",
    settings_updated: "設定変更",
  };
  if (q.error) return null; // staff (non-admin) — pane is admin-only anyway
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      boxShadow: T.SHADOW_SM, padding: 24, marginTop: 18,
    }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>監査ログ</h3>
      <div style={{ fontSize: 12, color: T.PLX_INK_500, marginBottom: 12 }}>
        ユーザー管理・設定変更の履歴（最新 15 件）
      </div>
      {q.loading && <div style={{ fontSize: 12, color: T.PLX_INK_500 }}>読み込み中…</div>}
      {!q.loading && items.length === 0 && (
        <div style={{ fontSize: 12, color: T.PLX_INK_500 }}>まだ記録がありません</div>
      )}
      {items.map((e) => (
        <div key={e.id} style={{
          display: "grid", gridTemplateColumns: "150px 130px 1fr", gap: 12,
          padding: "8px 0", borderBottom: `1px solid ${T.PLX_LINE_100}`,
          fontSize: 12, alignItems: "baseline",
        }}>
          <span style={{ color: T.PLX_INK_500, fontFamily: T.FONT_MONO, fontSize: 11 }}>
            {e.created_at ? new Date(e.created_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
          </span>
          <span style={{ fontWeight: 700, color: T.PLX_INK_900 }}>{ACTION_JA[e.action] || e.action}</span>
          <span style={{ color: T.PLX_INK_700 }}>
            {e.detail || "—"}
            {e.user_name && <span style={{ color: T.PLX_INK_400 }}>（{e.user_name}）</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function UsersSettings() {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const usersQ = useFetch(() => api.listUsers(), [refreshKey]);
  const [showAdd, setShowAdd] = React.useState(false);
  const me = window.PLX_ME || {};
  const isForbidden = usersQ.error && (usersQ.error.status === 403 || usersQ.error.status === 401);

  const toggleStatus = async (u) => {
    const next = u.status === "active" ? "inactive" : "active";
    if (next === "inactive" && !window.confirm((window.PLX_TR || String)(`「${u.display_name}」を無効化しますか？ログインできなくなります。`))) return;
    try {
      await api.updateUser(u.id, { status: next });
      window.PLX_TOAST.success(next === "active" ? "有効化しました" : "無効化しました");
      setRefreshKey((k) => k + 1);
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail || "更新に失敗しました");
    }
  };

  const toggleRole = async (u) => {
    const next = u.role === "admin" ? "staff" : "admin";
    try {
      await api.updateUser(u.id, { role: next });
      window.PLX_TOAST.success(`権限を${next === "admin" ? "管理者" : "スタッフ"}に変更しました`);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail || "更新に失敗しました");
    }
  };

  if (isForbidden) {
    return (
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        padding: 48, textAlign: "center", color: T.PLX_INK_500,
      }}>ユーザー管理は管理者のみ利用できます。</div>
    );
  }

  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      boxShadow: T.SHADOW_SM, padding: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>ユーザー管理</h3>
        <button onClick={() => setShowAdd(true)} style={btnPrimary}>＋ ユーザーを追加</button>
      </div>

      {usersQ.loading && <div style={{ color: T.PLX_INK_500, fontSize: 13 }}>読み込み中…</div>}
      {(usersQ.data || []).map((u, i, arr) => (
        <div key={u.id} style={{
          display: "grid", gridTemplateColumns: "36px 1.4fr 1.6fr 0.8fr 0.8fr auto",
          gap: 12, alignItems: "center", padding: "12px 0",
          borderBottom: i < arr.length - 1 ? `1px solid ${T.PLX_LINE_100}` : "none",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: T.PLX_GREEN_100,
            color: T.PLX_GREEN_700, fontWeight: 700, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{u.display_name.charAt(0)}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {u.display_name}{u.id === me.id && <span style={{ fontSize: 10, color: T.PLX_INK_400, marginLeft: 6 }}>(自分)</span>}
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.PLX_INK_500, fontFamily: T.FONT_MONO }}>{u.email}</div>
          <div>
            {u.role === "admin"
              ? <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>管理者</Pill>
              : <Pill color={T.PLX_BLUE_600} bg={T.PLX_BLUE_100}>スタッフ</Pill>}
          </div>
          <div>
            {u.status === "active"
              ? <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>有効</Pill>
              : <Pill color={T.PLX_INK_500} bg={T.PLX_SURFACE_100}>無効</Pill>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {u.id !== me.id && (
              <>
                <button onClick={() => toggleRole(u)} style={{ ...btnSecondary, height: 30, padding: "0 10px", fontSize: 11 }}>
                  {u.role === "admin" ? "スタッフにする" : "管理者にする"}
                </button>
                <button onClick={() => toggleStatus(u)} style={{
                  ...btnSecondary, height: 30, padding: "0 10px", fontSize: 11,
                  color: u.status === "active" ? T.PLX_RED_600 : T.PLX_GREEN_700,
                }}>
                  {u.status === "active" ? "無効化" : "有効化"}
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      <div style={{
        marginTop: 16, padding: 12, background: T.PLX_SURFACE_50,
        borderRadius: T.RADIUS_MD, fontSize: 11, color: T.PLX_INK_500,
      }}>
        PoC 認証です。パスワードは scrypt でハッシュ化され、セッションは HttpOnly クッキーで管理されます。
      </div>

      {showAdd && (
        <UserAddModal
          onClose={() => setShowAdd(false)}
          onSaved={(u) => {
            setShowAdd(false);
            window.PLX_TOAST.success(`ユーザー「${u.display_name}」を追加しました`);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function UserAddModal({ onClose, onSaved }) {
  const [form, setForm] = React.useState({ display_name: "", email: "", password: "", role: "staff" });
  const [saving, setSaving] = React.useState(false);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.display_name.trim() || !form.email.trim() || form.password.length < 4) {
      window.PLX_TOAST.warn("氏名・メール・パスワード（4文字以上）を入力してください"); return;
    }
    setSaving(true);
    try {
      const u = await api.createUser({
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      onSaved(u);
    } catch (e) {
      window.PLX_TOAST.error(e?.body?.detail || "追加に失敗しました");
      setSaving(false);
    }
  };

  return (
    <PlxModal title="ユーザーを追加" onClose={onClose}>
      <FormRow label="氏名 *">
        <input value={form.display_name} onChange={(e) => update("display_name", e.target.value)}
          style={formInput} placeholder="例：佐藤 太郎" />
      </FormRow>
      <FormRow label="メールアドレス *">
        <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
          style={formInput} placeholder="taro@example.com" />
      </FormRow>
      <FormRow label="初期パスワード *（4文字以上）">
        <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)}
          style={formInput} placeholder="••••••" />
      </FormRow>
      <FormRow label="権限">
        <SegmentedControl value={form.role} onChange={(v) => update("role", v)} options={[
          { value: "staff", label: "スタッフ" },
          { value: "admin", label: "管理者" },
        ]}/>
      </FormRow>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={btnSecondary}>キャンセル</button>
        <button onClick={submit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
          {saving ? "追加中…" : "追加する"}
        </button>
      </div>
    </PlxModal>
  );
}

// API・Webhooks — honest PoC pane: documents how to call the API today
// (session cookie or the X-Store-Id dev header + interactive Swagger docs).
// Real API-key issuance / webhooks are production scope, stated as such.
function ApiSettings() {
  const base = window.location.origin;
  const storeId = window.PLX_ME?.store_id ?? (window.getStoreId ? window.getStoreId() : 1);
  const row = { fontSize: 12, display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.PLX_LINE_100}`, alignItems: "center" };
  const mono = { fontFamily: T.FONT_MONO, fontSize: 12, color: T.PLX_INK_900 };
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      boxShadow: T.SHADOW_SM, padding: 24,
    }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>API・Webhooks</h3>
      <div style={{ fontSize: 12, color: T.PLX_INK_500, marginBottom: 16 }}>
        {"PoC の REST API はこのアプリと同じサーバーで公開されています。すべてのエンドポイントは Swagger UI から対話的に試せます。"}
      </div>

      <div style={row}><span style={{ color: T.PLX_INK_500, fontWeight: 600 }}>ベースURL</span><span style={mono}>{base}</span></div>
      <div style={row}>
        <span style={{ color: T.PLX_INK_500, fontWeight: 600 }}>APIドキュメント</span>
        <a href={`${base}/docs`} target="_blank" rel="noopener noreferrer" style={{ ...mono, color: T.PLX_GREEN_700 }}>{base}/docs（Swagger UI）</a>
      </div>
      <div style={row}>
        <span style={{ color: T.PLX_INK_500, fontWeight: 600 }}>認証（ブラウザ）</span>
        <span style={{ fontSize: 12, color: T.PLX_INK_700 }}>ログイン時の HttpOnly セッションクッキー（7日間有効）</span>
      </div>
      <div style={row}>
        <span style={{ color: T.PLX_INK_500, fontWeight: 600 }}>認証（開発用）</span>
        <span style={{ fontSize: 12, color: T.PLX_INK_700 }}>
          ヘッダー <code style={mono}>X-Store-Id: {String(storeId)}</code>（PoC 限定 — 本番では廃止予定）
        </span>
      </div>
      <div style={{ ...row, borderBottom: "none" }}>
        <span style={{ color: T.PLX_INK_500, fontWeight: 600 }}>例 (curl)</span>
        <code style={{ ...mono, background: T.PLX_SURFACE_50, padding: "6px 10px", borderRadius: 6, display: "block", overflowX: "auto" }}>
          curl -H "X-Store-Id: {String(storeId)}" {base}/products?limit=5
        </code>
      </div>

      <div style={{
        marginTop: 16, padding: 12, background: T.PLX_SURFACE_50,
        borderRadius: T.RADIUS_MD, fontSize: 11, color: T.PLX_INK_500, lineHeight: 1.7,
      }}>
        {"APIキーの発行・失効、Webhook 配信、レート制限は本番実装のスコープです（認証基盤の置き換えと同時に実装予定）。PoC では上記 2 方式のみをサポートします。"}
      </div>
    </div>
  );
}

// Appearance & language — local-only, no backend roundtrip. Reads from
// window.PLX_THEME and window.PLX_I18N (both persist to localStorage).
function AppearanceSettings() {
  const [theme] = usePlxTheme();
  const [locale] = usePlxLocale();
  const pillBase = {
    padding: "8px 18px", borderRadius: 9999, fontSize: 13, fontWeight: 700,
    cursor: "pointer", border: `1px solid ${T.PLX_LINE_200}`,
    background: T.PLX_SURFACE_0, color: T.PLX_INK_900,
  };
  const pillActive = {
    ...pillBase,
    background: T.PLX_GREEN_600, color: "#fff",
    border: `1px solid ${T.PLX_GREEN_600}`,
  };
  const sectionStyle = { marginBottom: 22 };
  const labelStyle = {
    fontSize: 13, fontWeight: 700, color: T.PLX_INK_900, marginBottom: 4,
  };
  const hintStyle = {
    fontSize: 11, color: T.PLX_INK_500, marginBottom: 10,
  };
  const rowStyle = { display: "flex", gap: 10 };
  return (
    <div style={{
      background: T.PLX_SURFACE_0, borderRadius: T.RADIUS_LG,
      border: `1px solid ${T.PLX_LINE_200}`,
      padding: 24, boxShadow: T.SHADOW_SM,
    }}>
      <div style={sectionStyle}>
        <div style={labelStyle}>テーマ</div>
        <div style={hintStyle}>表示テーマを切り替えます。ブラウザに保存されます。</div>
        <div style={rowStyle}>
          <button style={theme === "light" ? pillActive : pillBase}
            onClick={() => window.PLX_THEME.set("light")}>☀ ライト</button>
          <button style={theme === "dark" ? pillActive : pillBase}
            onClick={() => window.PLX_THEME.set("dark")}>☾ ダーク</button>
        </div>
      </div>
      <div style={sectionStyle}>
        <div style={labelStyle}>言語</div>
        <div style={hintStyle}>UI 表示言語を切り替えます。商品名・仕入先名などのデータはそのままです。</div>
        <div style={rowStyle}>
          <button style={locale === "ja" ? pillActive : pillBase}
            onClick={() => window.PLX_I18N.set("ja")}>日本語</button>
          <button style={locale === "en" ? pillActive : pillBase}
            onClick={() => window.PLX_I18N.set("en")}>English</button>
        </div>
      </div>
    </div>
  );
}

window.Settings = Settings;
