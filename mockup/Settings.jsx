// Settings — wireframe depth (§4.11)

function Settings() {
  const groups = [
    { id:"general", label:"一般", active:true },
    { id:"notif",   label:"通知" },
    { id:"tax",     label:"税率" },
    { id:"ai",      label:"AI設定" },
    { id:"integ",   label:"統合" },
    { id:"users",   label:"ユーザー管理" },
    { id:"api",     label:"API・Webhooks" },
  ];
  return (
    <AppShell current="settings" breadcrumbs={["ホーム","設定"]}>
      <PageHead title="設定" subtitle="ワークスペース全体の設定を管理します"/>
      <div style={{display:"grid", gridTemplateColumns:"240px 1fr", gap:24, alignItems:"flex-start"}}>
        {/* Left nav */}
        <Card pad={0} style={{position:"sticky", top:0}}>
          {groups.map(g=>(
            <a key={g.id} href="#" style={{display:"block", padding:"14px 18px", fontSize:13,
              borderLeft: g.active ? `3px solid ${T.PLX_GREEN_600}` : "3px solid transparent",
              background: g.active ? T.PLX_GREEN_050 : "transparent",
              color: g.active ? T.PLX_GREEN_700 : T.PLX_INK_700,
              fontWeight: g.active ? 600 : 500, textDecoration:"none",
              borderBottom:`1px solid ${T.PLX_LINE_100}`}}>{g.label}</a>
          ))}
        </Card>
        {/* Right content */}
        <div style={{display:"flex", flexDirection:"column", gap:20}}>
          <SettingsSection title="会社情報">
            <FormRow label="会社名">株式会社SCOグループ</FormRow>
            <FormRow label="法人番号"><span style={{fontFamily: T.FONT_MONO}}>1234567890123</span></FormRow>
            <FormRow label="代表者">武居 哲明</FormRow>
            <FormRow label="住所">〒100-7018 東京都千代田区丸の内2-7-2 JPタワー 18階</FormRow>
            <FormRow label="電話"><span style={{fontFamily: T.FONT_MONO}}>03-6810-7077</span></FormRow>
            <FormRow label="メール">contact@scogr.co.jp</FormRow>
          </SettingsSection>

          <SettingsSection title="ロケール">
            <FormRow label="タイムゾーン">Asia/Tokyo</FormRow>
            <FormRow label="言語"><Segmented options={["日本語","English"]} active={0}/></FormRow>
            <FormRow label="通貨">¥ JPY (日本円)</FormRow>
            <FormRow label="日付形式">YYYY/MM/DD</FormRow>
          </SettingsSection>

          <SettingsSection title="ブランディング">
            <FormRow label="表示ロゴ">
              <div style={{width:120, height:60, border:`1.5px dashed ${T.PLX_INK_300}`, borderRadius: T.RADIUS_MD,
                display:"flex", alignItems:"center", justifyContent:"center", color: T.PLX_INK_500, fontSize:12}}>
                <Ico size={20} color={T.PLX_INK_400}>{ICONS.upload}</Ico>
              </div>
            </FormRow>
            <FormRow label="ブランドカラー">
              <span style={{display:"inline-block", width:32, height:32, borderRadius:8,
                background: T.PLX_GREEN_600, verticalAlign:"middle"}}/>
              <span style={{marginLeft:10, fontFamily: T.FONT_MONO, fontSize:13}}>#16A36C</span>
            </FormRow>
          </SettingsSection>

          <SettingsSection title="AI設定">
            <FormRow label="AI自動入力モード"><Segmented options={["自動","確認あり","無効"]} active={1}/></FormRow>
            <FormRow label="OpenAI APIキー">
              <span style={{fontFamily: T.FONT_MONO, fontSize:13, color: T.PLX_INK_500}}>sk-****************************4d2a</span>
              <Btn style={{marginLeft:10, height:28}}>接続テスト</Btn>
              <Chip tone="green" style={{marginLeft:8}} icon="check">接続済み</Chip>
            </FormRow>
            <FormRow label="日次サマリー">毎日 06:00 (月〜日)</FormRow>
            <FormRow label="AIモデル">gpt-4o</FormRow>
            <FormRow label="今月の使用量">
              <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, maxWidth:540}}>
                <UsageTile label="APIコール" v="2,847"/>
                <UsageTile label="トークン" v="1.4M"/>
                <UsageTile label="概算費用" v="¥3,200"/>
              </div>
            </FormRow>
          </SettingsSection>

          <SettingsSection title="統合">
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
              <IntegTile name="paylight X SSO" status="connected" desc="シングルサインオン連携"/>
              <IntegTile name="会計ソフト連携" status="not" desc="freee / マネーフォワード / 弥生"/>
              <IntegTile name="LINE公式アカウント" status="not" desc="患者リマインド送信"/>
              <IntegTile name="Slack 通知" status="not" desc="アラートを Slack へ"/>
            </div>
          </SettingsSection>
        </div>
      </div>
    </AppShell>
  );
}

function SettingsSection({ title, children }) {
  return (
    <Card pad={0}>
      <div style={{padding:"18px 24px", borderBottom:`1px solid ${T.PLX_LINE_100}`, fontSize:16, fontWeight:600}}>{title}</div>
      <div style={{padding:"8px 24px 20px"}}>{children}</div>
    </Card>
  );
}
function FormRow({ label, children }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"180px 1fr", padding:"14px 0",
      borderBottom:`1px solid ${T.PLX_LINE_100}`, alignItems:"center"}}>
      <div style={{fontSize:12, color: T.PLX_INK_500, fontWeight:600}}>{label}</div>
      <div style={{fontSize:13, color: T.PLX_INK_900}}>{children}</div>
    </div>
  );
}
function Segmented({ options, active }) {
  return (
    <div style={{display:"inline-flex", padding:3, background: T.PLX_SURFACE_100, borderRadius: T.RADIUS_MD}}>
      {options.map((o,i)=>(
        <span key={i} style={{padding:"6px 14px", fontSize:12, fontWeight: i===active?600:500,
          color: i===active?T.PLX_GREEN_700:T.PLX_INK_700,
          background: i===active?"#fff":"transparent",
          boxShadow: i===active?T.SHADOW_SM:"none", borderRadius: T.RADIUS_SM, cursor:"pointer"}}>{o}</span>
      ))}
    </div>
  );
}
function UsageTile({ label, v }) {
  return (
    <div style={{padding:12, background: T.PLX_SURFACE_50, borderRadius: T.RADIUS_MD, border:`1px solid ${T.PLX_LINE_100}`}}>
      <div style={{fontSize:11, color: T.PLX_INK_500, fontWeight:500}}>{label}</div>
      <div style={{marginTop:4, fontSize:18, fontWeight:700, color: T.PLX_INK_900}}>{v}</div>
    </div>
  );
}
function IntegTile({ name, status, desc }) {
  const connected = status === "connected";
  return (
    <div style={{padding:16, background: T.PLX_SURFACE_50, borderRadius: T.RADIUS_MD, border:`1px solid ${T.PLX_LINE_100}`,
      display:"flex", alignItems:"center", gap:14}}>
      <div style={{width:40, height:40, borderRadius:8, background:"#fff", border:`1px solid ${T.PLX_LINE_200}`,
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
        <Ico size={20} color={T.PLX_INK_500}>{ICONS.boxes}</Ico>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, fontWeight:600, color: T.PLX_INK_900}}>{name}</div>
        <div style={{fontSize:11, color: T.PLX_INK_500, marginTop:2}}>{desc}</div>
      </div>
      {connected ? <Chip tone="green" icon="check">接続済み</Chip> : <Btn>接続する</Btn>}
    </div>
  );
}

Object.assign(window, { Settings });
