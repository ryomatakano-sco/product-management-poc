// Support — §4.12

function Support() {
  const faq = [
    "商品を一括で登録するには？",
    "期限間近の商品を自動で通知する設定はどこですか？",
    "仕入先のメールアドレスを変更したい",
    "発注書PDFのフォーマットを変えたい",
    "在庫数が実際と合いません。再棚卸しの方法は？",
    "paylight Xの予約データと連携できますか？",
    "APIキーを誤って公開してしまいました",
    "退職スタッフのアカウントを削除する方法",
  ];
  return (
    <AppShell current="support" breadcrumbs={["ホーム","サポート"]}>
      <div style={{background: T.PLX_GREEN_050, border:`1px solid ${T.PLX_GREEN_100}`, borderRadius: T.RADIUS_LG,
        padding:40, marginBottom:24, textAlign:"center"}}>
        <h1 style={{margin:0, fontSize:28, fontWeight:700, color: T.PLX_INK_900, letterSpacing:"-0.01em"}}>
          お困りですか？
        </h1>
        <div style={{marginTop:8, fontSize:14, color: T.PLX_INK_500}}>
          よくある質問やドキュメントから、お探しの情報を見つけてください。
        </div>
        <div style={{margin:"24px auto 0", maxWidth:640, position:"relative"}}>
          <input placeholder="ヘルプを検索" style={{width:"100%", height:48, padding:"0 16px 0 48px",
            fontSize:15, fontFamily:"inherit", border:`1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_MD,
            background:"#fff", outline:"none", boxShadow: T.SHADOW_SM}}/>
          <div style={{position:"absolute", left:16, top:14}}><Ico size={20} color={T.PLX_INK_500}>{ICONS.search}</Ico></div>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24, marginBottom:24}}>
        <QuickLink icon="file"      title="ドキュメント"   sub="paylight X 公式ヘルプ" cta="ヘルプを開く"/>
        <QuickLink icon="help"      title="お問い合わせ"   sub="個別のご質問はこちら"     cta="フォームへ"/>
        <QuickLink icon="bell"      title="最近のお知らせ" sub="リリース・メンテナンス"   cta="お知らせ一覧"/>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:24, marginBottom:24}}>
        <Card pad={0}>
          <div style={{padding:"18px 20px", borderBottom:`1px solid ${T.PLX_LINE_100}`, fontSize:16, fontWeight:600}}>
            よくある質問
          </div>
          {faq.map((q,i)=>(
            <div key={i} style={{padding:"16px 20px", borderBottom: i<faq.length-1?`1px solid ${T.PLX_LINE_100}`:"none",
              display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer"}}>
              <div style={{fontSize:14, color: T.PLX_INK_900}}>{q}</div>
              <Ico size={16} color={T.PLX_INK_400}>{ICONS.chevD}</Ico>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{fontSize:16, fontWeight:600, marginBottom:16}}>お問い合わせ</div>
          <FormField label="種別"><PlxSelect label="" v="操作方法"/></FormField>
          <FormField label="関連画面"><PlxSelect label="" v="商品一覧"/></FormField>
          <FormField label="詳細">
            <textarea style={{width:"100%", minHeight:96, padding:10, fontSize:13, fontFamily:"inherit",
              border:`1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_SM, outline:"none", boxSizing:"border-box",
              resize:"vertical"}} placeholder="具体的にお困りの内容をご記入ください"/>
          </FormField>
          <FormField label="メールアドレス">
            <input style={{width:"100%", height:36, padding:"0 10px", fontSize:13, fontFamily:"inherit",
              border:`1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_SM, outline:"none", boxSizing:"border-box"}}
              defaultValue="hanako.yamada@scogr.co.jp"/>
          </FormField>
          <Btn kind="primary" style={{width:"100%", justifyContent:"center"}}>送信する</Btn>
        </Card>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24}}>
        <Card>
          <div style={{fontSize:12, color: T.PLX_INK_500, fontWeight:600, marginBottom:10}}>システム状況</div>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <span style={{width:10, height:10, borderRadius:"50%", background: T.PLX_GREEN_600, boxShadow:`0 0 0 4px ${T.PLX_GREEN_100}`}}/>
            <div style={{fontSize:14, fontWeight:600, color: T.PLX_INK_900}}>すべてのシステムは正常です</div>
          </div>
          <div style={{marginTop:10, fontSize:12, color: T.PLX_INK_500}}>最終確認 2026/05/12 14:30</div>
          <a href="#" style={{display:"inline-block", marginTop:10, fontSize:12, color: T.PLX_GREEN_700, fontWeight:600, textDecoration:"none"}}>ステータスページ →</a>
        </Card>
        <Card>
          <div style={{fontSize:12, color: T.PLX_INK_500, fontWeight:600, marginBottom:10}}>最近のお知らせ</div>
          {[["2026/05/10","v1.4.0 リリース"],["2026/05/07","メンテナンス予定"],["2026/05/02","新機能: AI入力サポート"]].map((n,i)=>(
            <div key={i} style={{padding:"8px 0", borderBottom: i<2?`1px solid ${T.PLX_LINE_100}`:"none"}}>
              <div style={{fontSize:11, color: T.PLX_INK_500}}>{n[0]}</div>
              <div style={{fontSize:13, color: T.PLX_INK_900, fontWeight:500}}>{n[1]}</div>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{fontSize:12, color: T.PLX_INK_500, fontWeight:600, marginBottom:10}}>バージョン情報</div>
          <DLRow label="商品管理" value={<span style={{fontFamily: T.FONT_MONO}}>v1.4.0 (PoC)</span>}/>
          <DLRow label="paylight X" value={<span style={{fontFamily: T.FONT_MONO}}>v2.8.3</span>}/>
          <DLRow label="最終更新" value="2026/05/10"/>
          <DLRow label="ライセンス" value="SCO Group 内部利用"/>
        </Card>
      </div>
    </AppShell>
  );
}

function QuickLink({ icon, title, sub, cta }) {
  return (
    <Card style={{cursor:"pointer"}}>
      <div style={{width:48, height:48, borderRadius:12, background: T.PLX_GREEN_100,
        display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14}}>
        <Ico size={22} color={T.PLX_GREEN_600}>{ICONS[icon]}</Ico>
      </div>
      <div style={{fontSize:16, fontWeight:600, color: T.PLX_INK_900}}>{title}</div>
      <div style={{marginTop:4, fontSize:13, color: T.PLX_INK_500}}>{sub}</div>
      <div style={{marginTop:14, fontSize:13, color: T.PLX_GREEN_700, fontWeight:600}}>{cta} →</div>
    </Card>
  );
}
function FormField({ label, children }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11, color: T.PLX_INK_500, fontWeight:600, marginBottom:6}}>{label}</div>
      {children}
    </div>
  );
}

Object.assign(window, { Support });
