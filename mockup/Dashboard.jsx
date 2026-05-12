// Dashboard — paylight X 商品管理 PoC
// Variants: default ("ready"), "loading", "empty"

function Dashboard({ variant = "ready" }) {
  return (
    <AppShell current="dashboard" breadcrumbs={["ホーム"]}>
      <DashPageHead variant={variant}/>
      <AISummary variant={variant}/>
      <KPIStrip variant={variant}/>
      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:24, marginBottom:24}}>
        <ActionNeededCard variant={variant}/>
        <ActivityCard variant={variant}/>
      </div>
      <CategoryStockCard variant={variant}/>
    </AppShell>
  );
}

function DashPageHead({ variant }) {
  return (
    <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:20}}>
      <div>
        <h1 style={{margin:0, fontSize:28, fontWeight:700, color:T.PLX_INK_900, letterSpacing:"-0.01em"}}>
          おはようございます、山田さん <span style={{filter:"saturate(0.85)"}}>👋</span>
        </h1>
        <div style={{marginTop:6, fontSize:14, color: T.PLX_INK_500}}>
          本日は 2026年5月12日（火）。本院の商品管理サマリーをお届けします。
        </div>
      </div>
      <div style={{display:"inline-flex", alignItems:"center", gap:8, height:36, padding:"0 14px",
        background:"#fff", border:`1px solid ${T.PLX_LINE_200}`, borderRadius:999,
        fontSize:13, fontWeight:600, color: T.PLX_INK_700}}>
        <Ico size={14} color={T.PLX_INK_500}>{ICONS.clock}</Ico> 本日
        <Ico size={14} color={T.PLX_INK_500}>{ICONS.chevD}</Ico>
      </div>
    </div>
  );
}

function AISummary({ variant }) {
  const isEmpty = variant === "empty";
  const isLoad  = variant === "loading";
  return (
    <div style={{
      position:"relative", background: T.PLX_GREEN_050, border:`1px solid ${T.PLX_GREEN_100}`,
      borderRadius: T.RADIUS_LG, padding:24, marginBottom:20, overflow:"hidden",
    }}>
      <div style={{position:"absolute", left:0, top:0, bottom:0, width:3, background: T.PLX_GREEN_600}}/>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <Ico size={18} color={T.PLX_GREEN_600}>{ICONS.sparkles}</Ico>
          <span style={{fontSize:12, fontWeight:600, color: T.PLX_INK_500, letterSpacing:"0.02em"}}>
            AIサマリー — 1日1回 朝6:00 更新
          </span>
        </div>
        <button style={{background:"transparent", border:"none", display:"inline-flex", alignItems:"center", gap:6,
          color: T.PLX_GREEN_700, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit"}}>
          <Ico size={14} color={T.PLX_GREEN_700}>{ICONS.refresh}</Ico> 再生成
        </button>
      </div>
      {isLoad ? (
        <div style={{display:"flex", flexDirection:"column", gap:10}}>
          <Skel w="92%" h={14}/><Skel w="86%" h={14}/><Skel w="64%" h={14}/>
          <Chip tone="green" style={{marginTop:4}}>AIサマリーを生成中…</Chip>
        </div>
      ) : isEmpty ? (
        <div style={{fontSize:14, lineHeight:1.8, color: T.PLX_INK_700}}>
          本日、対応が必要な商品はありません。すべて順調です。お疲れさまです 🌿
        </div>
      ) : (
        <div style={{fontSize:14, lineHeight:1.8, color: T.PLX_INK_700, maxWidth:980}}>
          おはようございます。本日時点で <b style={{color:T.PLX_INK_900}}>在庫低下</b> の商品が <b style={{color:T.PLX_AMBER_600}}>8件</b>、
          <b style={{color:T.PLX_INK_900}}>期限間近 (60日以内)</b> が <b style={{color:T.PLX_RED_600}}>5件</b> あります。
          特に「アルジネート印象材」と「表面麻酔ジェル」は今週中の発注をおすすめします。
          今月の販売は前月比 <b style={{color:T.PLX_GREEN_700}}>+18%</b> で順調に推移しています。
        </div>
      )}
      <div style={{marginTop:14, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <span style={{fontSize:12, color: T.PLX_INK_500}}>最終更新: 2026/05/12 06:00</span>
        <a href="#" style={{fontSize:12, color: T.PLX_GREEN_700, fontWeight:600, textDecoration:"none"}}>サマリーの設定 →</a>
      </div>
    </div>
  );
}

function KPIStrip({ variant }) {
  const empty = variant === "empty";
  const load  = variant === "loading";
  const tiles = empty ? [
    { label:"登録商品数",     v:"312",     icon:"package", chip:{tone:"neutral",text:"先月比 +12"} },
    { label:"在庫低下アラート", v:"0件",   icon:"warn",    chip:{tone:"green",text:"正常"} },
    { label:"期限切れ間近",   v:"0件",     icon:"clock",   chip:{tone:"green",text:"正常"} },
    { label:"今月の販売",     v:"¥1,284,300", icon:"receipt", chip:{tone:"green",text:"前月比 +18%", arrow:"up"} },
  ] : [
    { label:"登録商品数",     v:"312",     icon:"package", chip:{tone:"green",text:"先月比 +12", arrow:"up"} },
    { label:"在庫低下アラート", v:"8件",   icon:"warn",    chip:{tone:"amber",text:"要対応"} },
    { label:"期限切れ間近",   v:"5件",     icon:"clock",   chip:{tone:"red",text:"60日以内"} },
    { label:"今月の販売",     v:"¥1,284,300", icon:"receipt", chip:{tone:"green",text:"前月比 +18%", arrow:"up"} },
  ];
  return (
    <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:24, marginBottom:24}}>
      {tiles.map((t,i)=>(
        <Card key={i} pad={20}>
          {load ? (
            <>
              <Skel w="50%" h={11}/>
              <div style={{height:12}}/>
              <Skel w="72%" h={24}/>
              <div style={{height:14}}/>
              <Skel w="48%" h={18}/>
            </>
          ) : (
            <>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
                <div style={{fontSize:12, color: T.PLX_INK_500, fontWeight:500}}>{t.label}</div>
                <Ico size={18} color={T.PLX_INK_400}>{ICONS[t.icon]}</Ico>
              </div>
              <div style={{marginTop:10, fontSize:26, fontWeight:700, color: T.PLX_INK_900, letterSpacing:"-0.01em"}}>
                {t.v}
              </div>
              <div style={{marginTop:10}}>
                <Chip tone={t.chip.tone} icon={t.chip.arrow==="up"?"arrowUp":undefined}>{t.chip.text}</Chip>
              </div>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}

function ActionNeededCard({ variant }) {
  const empty = variant === "empty";
  const load  = variant === "loading";
  const rows = [
    { kind:"消耗品", name:"表面麻酔ジェル 30g バナナフレーバー", state:"在庫低下", stateTone:"amber", stock:"4", action:"再発注" },
    { kind:"消耗品", name:"アルジネート印象材 ファストセット 500g", state:"期限間近 (2026/06/15)", stateTone:"red", stock:"18", action:"使用優先" },
    { kind:"物販品", name:"クリニカアドバンテージ ハミガキ クールミント 130g", state:"在庫低下", stateTone:"amber", stock:"6", action:"再発注" },
    { kind:"消耗品", name:"グローブ ニトリル パウダーフリー Mサイズ", state:"期限間近 (2026/06/28)", stateTone:"red", stock:"32", action:"使用優先" },
    { kind:"物販品", name:"子供用歯ブラシ クマさんカラー 3本セット", state:"再発注済", stateTone:"blue", stock:"11", action:"発注書" },
  ];
  return (
    <Card pad={0}>
      <div style={{padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center",
        borderBottom:`1px solid ${T.PLX_LINE_100}`}}>
        <div style={{fontSize:16, fontWeight:600}}>要対応の商品</div>
        <a href="#" style={{fontSize:12, color: T.PLX_GREEN_700, fontWeight:600, textDecoration:"none"}}>すべて見る →</a>
      </div>
      {empty ? (
        <div style={{padding:"48px 24px", textAlign:"center"}}>
          <div style={{width:64, height:64, margin:"0 auto 14px", borderRadius:"50%",
            background: T.PLX_GREEN_100, display:"flex", alignItems:"center", justifyContent:"center"}}>
            <Ico size={28} color={T.PLX_GREEN_600}>{ICONS.check}</Ico>
          </div>
          <div style={{fontSize:15, fontWeight:600, color: T.PLX_INK_900}}>要対応の商品はありません</div>
          <div style={{marginTop:4, fontSize:13, color: T.PLX_INK_500}}>本日は順調です。お疲れさまです。</div>
        </div>
      ) : load ? (
        <div style={{padding:20}}>
          {[...Array(5)].map((_,i)=>(<div key={i} style={{marginBottom:14}}><Skel w="100%" h={18}/></div>))}
        </div>
      ) : (
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background: T.PLX_SURFACE_50}}>
              <Th>種別</Th><Th>商品名</Th><Th>状態</Th><Th align="right">在庫</Th><Th align="right">アクション</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} style={{borderTop:`1px solid ${T.PLX_LINE_100}`}}>
                <Td><Chip tone={r.kind==="消耗品"?"blue":"green"}>{r.kind}</Chip></Td>
                <Td>{r.name}</Td>
                <Td><Chip tone={r.stateTone}>{r.state}</Chip></Td>
                <Td align="right" mono>{r.stock}</Td>
                <Td align="right"><a href="#" style={{color:T.PLX_GREEN_700, fontWeight:600, fontSize:13, textDecoration:"none"}}>{r.action} →</a></Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ActivityCard({ variant }) {
  const load = variant === "loading";
  const items = [
    { who:"山田 花子", text:"商品「リステリン トータルケアプラス 1000mL」を更新", t:"3分前", color:"#F4D4B8" },
    { who:"佐藤 健", text:"発注書 PO-2026-0048 を送信", t:"1時間前", color:"#C7E3F4" },
    { who:"AI アシスト", text:"日次サマリーを更新", t:"本日 06:00", color: T.PLX_GREEN_100 },
    { who:"鈴木 由香", text:"在庫調整: アルジネート印象材 +24", t:"昨日 17:48", color:"#F1E6F8" },
    { who:"山田 花子", text:"カテゴリ「ホワイトニング」を追加", t:"2日前", color:"#FDF3DC" },
  ];
  return (
    <Card pad={0}>
      <div style={{padding:"18px 20px", borderBottom:`1px solid ${T.PLX_LINE_100}`}}>
        <div style={{fontSize:16, fontWeight:600}}>最近の活動</div>
      </div>
      <div style={{padding:"8px 20px 20px"}}>
        {load ? [...Array(5)].map((_,i)=>(
          <div key={i} style={{padding:"12px 0", borderBottom: i<4?`1px solid ${T.PLX_LINE_100}`:"none"}}>
            <Skel w="80%" h={12}/><div style={{height:6}}/><Skel w="30%" h={10}/>
          </div>
        )) : items.map((it,i)=>(
          <div key={i} style={{display:"flex", gap:12, padding:"12px 0",
            borderBottom: i<items.length-1?`1px solid ${T.PLX_LINE_100}`:"none"}}>
            <div style={{width:28, height:28, borderRadius:"50%", background: it.color,
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
              fontSize:11, fontWeight:700, color: T.PLX_INK_700}}>{it.who[0]}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, color: T.PLX_INK_700, lineHeight:1.5}}>
                <b style={{color: T.PLX_INK_900}}>{it.who}</b> さんが{it.text}しました
              </div>
              <div style={{marginTop:2, fontSize:12, color: T.PLX_INK_500}}>{it.t}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CategoryStockCard({ variant }) {
  const empty = variant === "empty";
  const cats = [
    { name:"歯ブラシ",     v:847, p:0.92 },
    { name:"衛生材料",     v:712, p:0.78 },
    { name:"歯磨剤",       v:524, p:0.58 },
    { name:"フロス",       v:438, p:0.48 },
    { name:"印象材",       v:392, p:0.43 },
    { name:"洗口液",       v:284, p:0.31 },
    { name:"麻酔・薬剤",   v:248, p:0.27 },
    { name:"ホワイトニング", v:184, p:0.20 },
  ];
  return (
    <Card>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:18}}>
        <div>
          <div style={{fontSize:16, fontWeight:600}}>カテゴリ別在庫状況</div>
          <div style={{marginTop:4, fontSize:13, color: T.PLX_INK_500}}>
            合計在庫数: 4,832 点 ／ 在庫金額: ¥2,847,600
          </div>
        </div>
        <a href="#" style={{fontSize:12, color: T.PLX_GREEN_700, fontWeight:600, textDecoration:"none"}}>カテゴリ一覧 →</a>
      </div>
      <div style={{display:"flex", flexDirection:"column", gap:12}}>
        {cats.map((c,i)=>(
          <div key={i} style={{display:"grid", gridTemplateColumns:"160px 1fr 80px", alignItems:"center", gap:16}}>
            <div style={{fontSize:13, color: T.PLX_INK_700, fontWeight:500}}>{c.name}</div>
            <div style={{height:8, background: T.PLX_LINE_100, borderRadius:999, overflow:"hidden"}}>
              <div style={{width:`${(empty?0.05:c.p)*100}%`, height:"100%",
                background: T.PLX_GREEN_500, borderRadius:999}}/>
            </div>
            <div style={{textAlign:"right", fontSize:13, color: T.PLX_INK_700, fontFamily: T.FONT_MONO, fontWeight:500}}>
              {empty? "—" : `${c.v.toLocaleString()} 点`}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Small helpers ─────────────────────────────────────
function Th({ children, align = "left", style }) {
  return <th style={{textAlign:align, padding:"10px 16px", fontSize:11, fontWeight:600,
    color: T.PLX_INK_500, letterSpacing:"0.02em", ...style}}>{children}</th>;
}
function Td({ children, align = "left", mono, style }) {
  return <td style={{textAlign:align, padding:"14px 16px", fontSize:13, color: T.PLX_INK_700,
    fontFamily: mono?T.FONT_MONO:"inherit", ...style}}>{children}</td>;
}
function Skel({ w = "100%", h = 14 }) {
  return <div style={{
    width: w, height: h, borderRadius:6,
    background:`linear-gradient(90deg, ${T.PLX_LINE_100} 0%, ${T.PLX_SURFACE_50} 50%, ${T.PLX_LINE_100} 100%)`,
    backgroundSize:"800px 100%", animation:"plxshimmer 1.6s linear infinite",
  }}/>;
}

Object.assign(window, { Dashboard, Th, Td, Skel });
