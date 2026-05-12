// Categories — tree on left, detail on right (§4.5)

function Categories() {
  const tree = [
    { id:"r1", name:"物販品", count:147, open:true, root:true, icon:"package", color: T.PLX_GREEN_600, children:[
      { id:"c1", name:"歯ブラシ",     count:47, color:"#16A36C", iconName:"Brush",   selected:true },
      { id:"c2", name:"歯磨剤",       count:24, color:"#2E7BD6", iconName:"Sparkle" },
      { id:"c3", name:"フロス",       count:18, color:"#22B07A", iconName:"Wind" },
      { id:"c4", name:"洗口液",       count:12, color:"#7AD3B0", iconName:"Droplet" },
      { id:"c5", name:"ホワイトニング", count:21, color:"#E89B17", iconName:"Star" },
      { id:"c6", name:"矯正用品",     count:25, color:"#9C56C0", iconName:"Smile" },
    ]},
    { id:"r2", name:"消耗品", count:165, open:true, root:true, icon:"boxes", color: T.PLX_BLUE_600, children:[
      { id:"c7",  name:"衛生材料",     count:54, color:"#5B6776", iconName:"ShieldCheck" },
      { id:"c8",  name:"印象材",       count:28, color:"#2E7BD6", iconName:"Layers" },
      { id:"c9",  name:"麻酔・薬剤",   count:33, color:"#D6433A", iconName:"Pill" },
      { id:"c10", name:"グローブ",     count:18, color:"#0F8A5F", iconName:"Hand" },
      { id:"c11", name:"滅菌・消毒",   count:32, color:"#16A36C", iconName:"Sparkles" },
    ]},
  ];
  return (
    <AppShell current="categories" breadcrumbs={["ホーム","カテゴリ"]}>
      <PageHead title="カテゴリ" subtitle="商品を分類するカテゴリを管理します（全 18 件）"
        right={<><Btn icon="download">エクスポート</Btn><Btn kind="primary" icon="plus">カテゴリを追加</Btn></>}/>
      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:24}}>
        <Card pad={0}>
          <div style={{padding:"14px 20px", borderBottom:`1px solid ${T.PLX_LINE_100}`, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div style={{fontSize:14, fontWeight:600}}>カテゴリツリー</div>
            <div style={{position:"relative", width:240}}>
              <input placeholder="カテゴリを検索…" style={{width:"100%", height:32, padding:"0 12px 0 32px",
                fontSize:12, fontFamily:"inherit", border:`1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_SM,
                background: T.PLX_SURFACE_50, outline:"none"}}/>
              <div style={{position:"absolute", left:10, top:8}}><Ico size={14} color={T.PLX_INK_400}>{ICONS.search}</Ico></div>
            </div>
          </div>
          <div style={{padding:"8px 0"}}>
            {tree.map(r => (
              <React.Fragment key={r.id}>
                <TreeRow {...r} depth={0}/>
                {r.open && r.children.map(c => <TreeRow key={c.id} {...c} depth={1}/>)}
              </React.Fragment>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:14}}>
            <div style={{width:32, height:32, borderRadius:"50%", background:"#16A36C"}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:22, fontWeight:700, color: T.PLX_INK_900}}>歯ブラシ</div>
            </div>
            <Chip tone="neutral">47 件</Chip>
            <Btn kind="ghost" icon="edit"/>
          </div>
          <DLRow label="親カテゴリ" value="物販品"/>
          <DLRow label="種別" value={<Chip tone="green">物販品</Chip>}/>
          <DLRow label="デフォルト税率" value="10%"/>
          <DLRow label="カラー" value={<><span style={{display:"inline-block", width:14, height:14, borderRadius:4, background:"#16A36C", verticalAlign:"middle", marginRight:8}}/><span style={{fontFamily:T.FONT_MONO, fontSize:13}}>#16A36C</span></>}/>
          <DLRow label="アイコン" value="Brush"/>
          <DLRow label="説明" value="手用歯ブラシ全般。電動歯ブラシは別カテゴリ「電動デンタル機器」を使用してください。"/>
          <div style={{marginTop:18, paddingTop:18, borderTop:`1px solid ${T.PLX_LINE_100}`}}>
            <div style={{fontSize:12, color: T.PLX_INK_500, fontWeight:600, marginBottom:10}}>関連商品（6）</div>
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              {[1,2,3,4,5,6].map(i=>(
                <div key={i} style={{width:56, height:56, borderRadius:8, background:T.PLX_SURFACE_100,
                  border:`1px solid ${T.PLX_LINE_200}`, display:"flex", alignItems:"center", justifyContent:"center"}}>
                  <Ico size={20} color={T.PLX_INK_400}>{ICONS.imgOff}</Ico>
                </div>
              ))}
            </div>
            <a href="#" style={{display:"inline-block", marginTop:12, fontSize:12, color:T.PLX_GREEN_700, fontWeight:600, textDecoration:"none"}}>すべて見る →</a>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function TreeRow({ name, count, color, depth, root, selected }) {
  const bg = selected ? T.PLX_GREEN_100 : "transparent";
  return (
    <div style={{display:"flex", alignItems:"center", gap:10, height:48,
      padding:`0 20px 0 ${20 + depth*24}px`, background: bg, cursor:"pointer",
      borderLeft: selected ? `3px solid ${T.PLX_GREEN_600}` : "3px solid transparent"}}>
      <Ico size={14} color={T.PLX_INK_500}>{ICONS.chevD}</Ico>
      <div style={{width:24, height:24, borderRadius:"50%", background: color,
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
        <Ico size={12} color="#fff">{ICONS.package}</Ico>
      </div>
      <div style={{flex:1, fontSize:13, fontWeight: root?700:500, color: T.PLX_INK_900}}>{name}</div>
      <Chip tone="neutral">{count} 件</Chip>
      <Ico size={16} color={T.PLX_INK_400}>{ICONS.more}</Ico>
    </div>
  );
}

function DLRow({ label, value }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"120px 1fr", padding:"12px 0",
      borderBottom:`1px solid ${T.PLX_LINE_100}`}}>
      <div style={{fontSize:12, color: T.PLX_INK_500, fontWeight:500}}>{label}</div>
      <div style={{fontSize:13, color: T.PLX_INK_900}}>{value}</div>
    </div>
  );
}

Object.assign(window, { Categories });
