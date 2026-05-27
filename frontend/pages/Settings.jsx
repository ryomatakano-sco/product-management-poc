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
  { id: "users",         label: "ユーザー管理",  icon: "users", placeholder: true },
  { id: "api",           label: "API・Webhooks", icon: "key",   placeholder: true },
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
          background: "#fff", borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
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
          {(ns === "users" || ns === "api") && (
            <div style={{
              background: "#fff", borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
              padding: 48, textAlign: "center", color: T.PLX_INK_500,
            }}>この項目は近日対応予定です。</div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

// ── Per-namespace forms ────────────────────────────────────────────

function SettingsCard({ title, children, onSave, saving }) {
  return (
    <div style={{
      background: "#fff", borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
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
      window.PLX_TOAST.error("設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };
  return { form, update, save, saving, loading: q.loading, error: q.error };
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
    </SettingsCard>
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
          width: 18, height: 18, background: "#fff", borderRadius: "50%",
          transition: "left .12s", boxShadow: "0 1px 2px rgba(0,0,0,.2)",
        }} />
      </span>
    </div>
  );
}

function TaxRatesSettings() {
  const f = useSettingsForm("tax_rates");
  if (f.loading) return <SettingsCard title="税率"><div style={{ color: T.PLX_INK_500 }}>読み込み中…</div></SettingsCard>;
  const rates = f.form.rates || [];
  return (
    <SettingsCard title="税率">
      {rates.length === 0 && <div style={{ color: T.PLX_INK_500 }}>税率が設定されていません。</div>}
      {rates.map((r, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 80px",
          gap: 12, padding: "10px 0", alignItems: "center",
          borderBottom: i < rates.length - 1 ? `1px solid ${T.PLX_LINE_100}` : "none",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
          <span style={{ fontSize: 13, fontFamily: T.FONT_MONO }}>{r.rate}%</span>
          <span>{r.is_default && <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>標準</Pill>}</span>
          <span style={{ fontSize: 12, color: T.PLX_INK_500 }}>ID: {r.id}</span>
        </div>
      ))}
      <div style={{ marginTop: 14, padding: 12, background: T.PLX_BLUE_100, borderRadius: T.RADIUS_MD, fontSize: 12, color: T.PLX_BLUE_600 }}>
        税率の追加・編集機能は近日対応予定です。
      </div>
    </SettingsCard>
  );
}

function AiSettings() {
  const f = useSettingsForm("ai");
  const [keyInput, setKeyInput] = React.useState("");

  if (f.loading) return <SettingsCard title="AI設定"><div style={{ color: T.PLX_INK_500 }}>読み込み中…</div></SettingsCard>;

  const saveWithKey = () => {
    const body = { ...f.form };
    if (keyInput.trim()) body.openai_api_key = keyInput.trim();
    f.save(body);
    setKeyInput("");
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
        <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
          placeholder={f.form.openai_api_key_set ? "••••••••（設定済み）" : "sk-..."} style={formInput} />
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
