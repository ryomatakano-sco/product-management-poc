// AppShell — dark-green sidebar + topbar (matches §2.8 + §3 of brief)

function AppShell({ children, current = "dashboard", breadcrumbs, headerRight, pageBg }) {
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"240px 1fr",
      background: T.PLX_SURFACE_50, height:"100%", minHeight: 0,
      fontFamily: T.FONT, color: T.PLX_INK_900,
    }}>
      <PlxSidebar current={current}/>
      <div style={{display:"flex", flexDirection:"column", minWidth:0}}>
        <PlxTopBar breadcrumbs={breadcrumbs} headerRight={headerRight}/>
        <main style={{padding:"24px 32px", flex:1, overflow:"auto", background: pageBg || T.PLX_SURFACE_50}}>
          {children}
        </main>
      </div>
    </div>
  );
}

function PlxSidebar({ current }) {
  const groups = [
    { label:"メイン", items:[
      { id:"dashboard",  label:"ダッシュボード", icon:"dashboard" },
      { id:"products",   label:"商品",           icon:"package" },
      { id:"categories", label:"カテゴリ",       icon:"tags" },
    ]},
    { label:"オペレーション", items:[
      { id:"inventory",  label:"在庫",           icon:"boxes" },
      { id:"po",         label:"発注書",         icon:"file", badge:5 },
      { id:"sales",      label:"販売記録",       icon:"receipt" },
    ]},
    { label:"マスタ", items:[
      { id:"vendors",    label:"仕入先",         icon:"truck" },
      { id:"branches",   label:"院・店舗",       icon:"bldg2" },
    ]},
    { label:"その他", items:[
      { id:"settings",   label:"設定",           icon:"settings" },
      { id:"support",    label:"サポート",       icon:"help" },
    ]},
  ];
  return (
    <aside style={{
      background: T.PLX_SIDEBAR_BG, display:"flex", flexDirection:"column",
      color: T.PLX_SIDEBAR_INK,
    }}>
      {/* Header */}
      <div style={{height:72, padding:"0 24px", display:"flex", alignItems:"center",
        borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <div style={{width:28, height:28, borderRadius:6, background: T.PLX_GREEN_600,
            color:"#fff", fontWeight:800, fontSize:13, letterSpacing:"-0.02em",
            display:"flex", alignItems:"center", justifyContent:"center"}}>pX</div>
          <div style={{fontSize:16, fontWeight:700, color:"#fff", letterSpacing:"-0.01em"}}>
            paylight <span style={{color: T.PLX_GREEN_500}}>X</span>
          </div>
        </div>
      </div>
      {/* Workspace switcher */}
      <div style={{height:56, padding:"0 16px", display:"flex", alignItems:"center", gap:10,
        borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{width:28, height:28, borderRadius:6, background:"rgba(255,255,255,0.08)",
          color:"#fff", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center"}}>本</div>
        <div style={{flex:1, minWidth:0, lineHeight:1.2}}>
          <div style={{fontSize:12, fontWeight:600, color:"#fff", whiteSpace:"nowrap",
            overflow:"hidden", textOverflow:"ellipsis"}}>ペイライト歯科クリニック</div>
          <div style={{fontSize:10, color: T.PLX_SIDEBAR_INK_DIM}}>本院 / 管理者</div>
        </div>
        <Ico size={14} color={T.PLX_SIDEBAR_INK_DIM}>{ICONS.chevD}</Ico>
      </div>
      {/* Nav groups */}
      <div style={{padding:"12px 8px 8px", flex:1, overflowY:"auto"}}>
        {groups.map((g, gi) => (
          <div key={gi} style={{marginBottom:14}}>
            <div style={{padding:"6px 12px 4px", fontSize:10, fontWeight:600,
              color: T.PLX_SIDEBAR_INK_DIM, letterSpacing:"0.08em", textTransform:"uppercase"}}>{g.label}</div>
            {g.items.map(i => <SbItem key={i.id} {...i} active={current===i.id}/>)}
          </div>
        ))}
      </div>
      {/* Footer */}
      <div style={{height:56, padding:"0 16px", display:"flex", alignItems:"center", gap:10,
        borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{width:32, height:32, borderRadius:"50%", background:"#F4D4B8",
          color:"#1F2937", fontWeight:700, fontSize:13,
          display:"flex", alignItems:"center", justifyContent:"center"}}>山</div>
        <div style={{flex:1, minWidth:0, lineHeight:1.2}}>
          <div style={{fontSize:12, fontWeight:600, color:"#fff"}}>山田 花子</div>
          <div style={{fontSize:10, color: T.PLX_SIDEBAR_INK_DIM}}>本院 / 管理者</div>
        </div>
        <Ico size={16} color={T.PLX_SIDEBAR_INK_DIM}>{ICONS.more}</Ico>
      </div>
    </aside>
  );
}

function SbItem({ id, label, icon, badge, active }) {
  return (
    <a href="#" style={{
      position:"relative", display:"flex", alignItems:"center", gap:12,
      height:40, padding:"0 16px", margin:"2px 4px", borderRadius:8,
      textDecoration:"none", cursor:"pointer",
      background: active ? T.PLX_SIDEBAR_ACTIVE_BG : "transparent",
      color: active ? "#FFFFFF" : T.PLX_SIDEBAR_INK,
      fontSize:13, fontWeight: active ? 600 : 500,
    }}>
      {active && <span style={{position:"absolute", left:-4, top:6, bottom:6, width:3,
        background: T.PLX_GREEN_500, borderRadius:2}}/>}
      <Ico size={18} color={active ? "#fff" : T.PLX_SIDEBAR_INK}>{ICONS[icon]}</Ico>
      <span style={{flex:1}}>{label}</span>
      {badge && <span style={{background: active ? "rgba(255,255,255,0.22)" : T.PLX_GREEN_600,
        color:"#fff", fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:999}}>{badge}</span>}
    </a>
  );
}

function PlxTopBar({ breadcrumbs, headerRight }) {
  return (
    <div style={{
      height:56, background: T.PLX_SURFACE_0, borderBottom:`1px solid ${T.PLX_LINE_200}`,
      padding:"0 32px", display:"flex", alignItems:"center", gap:16, flexShrink:0,
    }}>
      <div style={{flex:1, minWidth:0, display:"flex", alignItems:"center", gap:6}}>
        {(breadcrumbs||[]).map((b,i)=>(
          <React.Fragment key={i}>
            {i>0 && <Ico size={14} color={T.PLX_INK_400}>{ICONS.chevR}</Ico>}
            <span style={{fontSize:13, fontWeight: i===breadcrumbs.length-1?600:400,
              color: i===breadcrumbs.length-1?T.PLX_INK_900:T.PLX_INK_500,
              whiteSpace:"nowrap"}}>{b}</span>
          </React.Fragment>
        ))}
      </div>
      {headerRight}
      <div style={{position:"relative", width:280}}>
        <Ico size={16} color={T.PLX_INK_500}>{ICONS.search}</Ico>
        <input placeholder="商品名・SKU・JANで検索" style={{
          position:"absolute", inset:0, width:"100%", height:36,
          padding:"0 12px 0 36px", fontSize:13, fontFamily:"inherit",
          background: T.PLX_SURFACE_50, border:`1px solid ${T.PLX_LINE_200}`,
          borderRadius: T.RADIUS_MD, outline:"none", color: T.PLX_INK_700,
        }}/>
        <div style={{position:"absolute", left:12, top:10, pointerEvents:"none"}}>
          <Ico size={16} color={T.PLX_INK_400}>{ICONS.search}</Ico>
        </div>
      </div>
      <button style={{width:36,height:36,borderRadius:8,border:`1px solid ${T.PLX_LINE_200}`,
        background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
        position:"relative"}}>
        <Ico size={18} color={T.PLX_INK_700}>{ICONS.bell}</Ico>
        <span style={{position:"absolute",top:6,right:8,width:7,height:7,borderRadius:"50%",
          background: T.PLX_RED_600, border:"2px solid #fff"}}/>
      </button>
    </div>
  );
}

// ── Reusable primitives ──────────────────────────────────────────
function Btn({ kind = "secondary", icon, children, style, ...rest }) {
  const base = {
    display:"inline-flex", alignItems:"center", gap:8,
    height:36, padding:"0 16px", borderRadius: T.RADIUS_MD,
    fontSize:13, fontWeight:600, fontFamily:"inherit", cursor:"pointer",
    border:"1px solid transparent", whiteSpace:"nowrap", ...style,
  };
  const k = {
    primary:    { background: T.PLX_GREEN_600, color:"#fff" },
    secondary:  { background:"#fff", color: T.PLX_INK_700, borderColor: T.PLX_LINE_200 },
    ghost:      { background:"transparent", color: T.PLX_INK_700 },
    danger:     { background: T.PLX_RED_600, color:"#fff" },
    dangerGhost:{ background:"transparent", color: T.PLX_RED_600 },
  }[kind];
  return (
    <button style={{...base, ...k}} {...rest}>
      {icon && <Ico size={16} color={kind==="primary"||kind==="danger" ? "#fff" : (kind==="dangerGhost"?T.PLX_RED_600:T.PLX_INK_700)}>{ICONS[icon]}</Ico>}
      {children}
    </button>
  );
}

function Chip({ tone = "neutral", icon, children, style }) {
  const map = {
    neutral: { bg: T.PLX_SURFACE_100, fg: T.PLX_INK_700 },
    green:   { bg: T.PLX_GREEN_100,   fg: T.PLX_GREEN_700 },
    blue:    { bg: T.PLX_BLUE_100,    fg: T.PLX_BLUE_600 },
    amber:   { bg: T.PLX_AMBER_100,   fg: T.PLX_AMBER_600 },
    red:     { bg: T.PLX_RED_100,     fg: T.PLX_RED_600 },
    purple:  { bg: T.PLX_PURPLE_100,  fg: T.PLX_PURPLE_600 },
    dark:    { bg:"#0F1B2D",          fg:"#fff" },
  }[tone] || { bg: T.PLX_SURFACE_100, fg: T.PLX_INK_700 };
  return (
    <span style={{display:"inline-flex", alignItems:"center", gap:6,
      height:22, padding:"0 10px", borderRadius:999,
      background: map.bg, color: map.fg, fontSize:12, fontWeight:600, whiteSpace:"nowrap", ...style}}>
      {icon && <Ico size={12} color={map.fg}>{ICONS[icon]}</Ico>}
      {children}
    </span>
  );
}

function Card({ children, style, pad = 24 }) {
  return (
    <div style={{
      background:"#fff", border:`1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_LG,
      boxShadow: T.SHADOW_SM, padding: pad, ...style,
    }}>{children}</div>
  );
}

function PageHead({ title, subtitle, right }) {
  return (
    <div style={{display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:16, marginBottom:20}}>
      <div>
        <h1 style={{margin:0, fontSize:28, lineHeight:1.35, fontWeight:700,
          letterSpacing:"-0.01em", color: T.PLX_INK_900}}>{title}</h1>
        {subtitle && <div style={{marginTop:6, fontSize:14, color: T.PLX_INK_500}}>{subtitle}</div>}
      </div>
      {right && <div style={{display:"flex", gap:8}}>{right}</div>}
    </div>
  );
}

Object.assign(window, { AppShell, PlxSidebar, PlxTopBar, Btn, Chip, Card, PageHead });
