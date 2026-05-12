// Under Construction placeholder — §5

function UnderConstruction({ crumbs = ["ホーム","発注書","PDFプレビュー"], current = "po" }) {
  return (
    <AppShell current={current} breadcrumbs={crumbs}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"center", minHeight:"min(720px, 80%)"}}>
        <Card style={{maxWidth:520, padding:48, textAlign:"center"}}>
          <div style={{width:96, height:96, margin:"0 auto 20px", borderRadius:"50%",
            background: T.PLX_GREEN_100, display:"flex", alignItems:"center", justifyContent:"center"}}>
            <Ico size={48} color={T.PLX_GREEN_600}>{ICONS.hard}</Ico>
          </div>
          <h2 style={{margin:0, fontSize:22, fontWeight:700, color: T.PLX_INK_900, letterSpacing:"-0.005em"}}>
            現在開発中
          </h2>
          <div style={{margin:"10px auto 0", fontSize:14, color: T.PLX_INK_500, lineHeight:1.7, maxWidth:380}}>
            この機能は現在開発中です。5月13日以降のデモにてご紹介いたします。
          </div>
          <div style={{marginTop:24, display:"flex", justifyContent:"center", gap:12}}>
            <Btn icon="arrowL">ダッシュボードに戻る</Btn>
            <Btn kind="primary" icon="bell">通知を受け取る</Btn>
          </div>
          <div style={{marginTop:24, fontSize:12, color: T.PLX_INK_400}}>
            PoC v1.4.0 ・ 商品管理モジュール
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

Object.assign(window, { UnderConstruction });
