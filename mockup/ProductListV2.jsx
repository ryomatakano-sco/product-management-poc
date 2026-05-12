// Product List v2 — adds 品目種別 filter, 種別 column, expiry indicators, quick-filter chips

// Extend mock products with kind + expiry (won't mutate the original array)
const V2_KIND_MAP = {
  p1:{kind:"buntan"}, p2:{kind:"buntan"}, p3:{kind:"buntan"}, p4:{kind:"buntan"},
  p5:{kind:"shomo", expiryDays: 78, expiryDate:"2026/07/15"},
  p6:{kind:"shomo", expiryDays: 45, expiryDate:"2026/06/13"},
  p7:{kind:"buntan"}, p8:{kind:"buntan"},
};
const V2_EXTRA_PRODUCTS = [
  { id:"p9",
    name:"歯科用紙コップ 100枚入り", name_kana:"しかよう かみコップ ひゃくまいいり",
    category_id:"c5", category:"消耗品",
    vendor_id:"v2", vendor:"モリタ（MORITA）",
    status:"active", tags:["セール"],
    description:"使い捨て紙コップ。", image:"#EEF2F7",
    sku:"MOR-CUP-100", jan:"4987111090049",
    price:"680", cost:"320",
    on_hand:12, committed:0, unavailable:0, sold_90d:140,
    kind:"shomo", expiryDays: 22, expiryDate:"2026/06/03" },
  { id:"p10",
    name:"オートクレーブ用滅菌バッグ 200枚", name_kana:"オートクレーブよう めっきんバッグ にひゃくまい",
    category_id:"c5", category:"消耗品",
    vendor_id:"v2", vendor:"モリタ（MORITA）",
    status:"active", tags:["保険適用"],
    description:"耐熱滅菌バッグ。", image:"#F0F9FF",
    sku:"MOR-STR-200", jan:"4987111090056",
    price:"2,400", cost:"1,200",
    on_hand:42, committed:6, unavailable:0, sold_90d:96,
    kind:"shomo", expiryDays: 12, expiryDate:"2026/05/24" },
];

function ProductListV2({ onOpenProduct, onCreate }) {
  const [searchQ, setSearchQ] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [vendorFilter, setVendorFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("active");
  const [activeTags, setActiveTags] = React.useState([]);
  const [quickFilters, setQuickFilters] = React.useState([]);

  // Combine + decorate
  const allProducts = [...MOCK_PRODUCTS.map(p => ({...p, ...(V2_KIND_MAP[p.id]||{kind:"buntan"})})), ...V2_EXTRA_PRODUCTS];

  const filtered = allProducts.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (kindFilter !== "all" && p.kind !== kindFilter) return false;
    if (categoryFilter && p.category_id !== categoryFilter) return false;
    if (vendorFilter && p.vendor_id !== vendorFilter) return false;
    if (activeTags.length && !activeTags.some(t => p.tags.includes(t))) return false;
    if (searchQ && !(p.name + p.name_kana + p.sku).toLowerCase().includes(searchQ.toLowerCase())) return false;
    if (quickFilters.includes("low") && !isLowStock(p,10)) return false;
    if (quickFilters.includes("expire") && !(p.kind==="shomo" && p.expiryDays && p.expiryDays<=30)) return false;
    return true;
  });

  const headerRight = (
    <button onClick={onCreate} style={{
      height:38, padding:"0 18px", borderRadius:9999,
      background:PLX_GREEN, color:"#fff", border:"none", fontWeight:700, fontSize:13,
      fontFamily:"inherit", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6,
      boxShadow:"0 6px 16px rgba(26,166,138,.25)",
    }}>＋ 新しい商品を追加</button>
  );

  const toggleQuick = (k) => setQuickFilters(s => s.includes(k) ? s.filter(x=>x!==k) : [...s, k]);

  return (
    <AdminShell title="商品一覧" currentNav="products" headerRight={headerRight}>
      <SectionLabel>商品マスタ</SectionLabel>
      <div style={{display:"flex",alignItems:"baseline",gap:14,marginBottom:18,marginTop:6}}>
        <h2 style={{fontSize:24,fontWeight:700,margin:0,letterSpacing:"-.01em"}}>すべての商品</h2>
        <span style={{fontSize:13,color:PLX_MUTED}}>{filtered.length} 件 / 全 {allProducts.length} 件</span>
      </div>

      {/* Filter bar */}
      <div style={{
        background:"#fff",borderRadius:14,padding:"16px 20px",border:`1px solid ${PLX_BORDER}`,
        display:"flex",flexDirection:"column",gap:14,
      }}>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{position:"relative",flex:1,maxWidth:320,minWidth:200}}>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="商品名・かな・SKUで検索…" style={inputBase}/>
            <svg style={{position:"absolute",left:13,top:11}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PLX_MUTED} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
          </div>
          <Select value={categoryFilter} onChange={setCategoryFilter}
            options={[{value:"",label:"すべてのカテゴリ"},...MOCK_CATEGORIES.map(c=>({value:c.id,label:c.name}))]}/>

          {/* 品目種別 filter — between category and vendor */}
          <SegmentedControl value={kindFilter} onChange={setKindFilter} options={[
            {value:"all",label:"すべて"},
            {value:"buntan",label:"物販品"},
            {value:"shomo",label:"消耗品"},
          ]}/>

          <Select value={vendorFilter} onChange={setVendorFilter}
            options={[{value:"",label:"すべての仕入先"},...MOCK_VENDORS.map(v=>({value:v.id,label:v.company_name}))]}/>
          <div style={{flex:1}}/>
          <SegmentedControl value={statusFilter} onChange={setStatusFilter} options={[
            {value:"active",label:"公開中"},
            {value:"draft",label:"下書き"},
            {value:"all",label:"すべて"},
          ]}/>
        </div>

        {/* Quick filter chip row */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:PLX_MUTED,fontWeight:600}}>クイックフィルタ</span>
          <QuickChip on={quickFilters.includes("low")}     onClick={()=>toggleQuick("low")}     dot="#DC2626" label="在庫低下" count={3} color="#DC2626" bg="#FEE2E2"/>
          <QuickChip on={quickFilters.includes("expire")}  onClick={()=>toggleQuick("expire")}  dot="#D97706" label="期限間近" count={2} color="#D97706" bg="#FEF3C7"/>
          <QuickChip on={quickFilters.includes("reorder")} onClick={()=>toggleQuick("reorder")} check label="再発注済" count={0} color={PLX_MUTED} bg="#F3F4F6"/>
          <div style={{width:1,height:20,background:PLX_BORDER,margin:"0 4px"}}/>
          <span style={{fontSize:11,color:PLX_MUTED,fontWeight:600}}>タグ</span>
          {MOCK_TAGS.slice(0,6).map(t => {
            const on = activeTags.includes(t);
            return (
              <button key={t} onClick={()=>setActiveTags(s=>s.includes(t)?s.filter(x=>x!==t):[...s,t])} style={{
                fontSize:11,fontWeight:600,padding:"5px 11px",borderRadius:9999,
                border:`1px solid ${on?PLX_GREEN:PLX_BORDER}`,
                background:on?PLX_GREEN_LIGHT:"#fff",color:on?PLX_GREEN:PLX_TEXT,
                cursor:"pointer",fontFamily:"inherit",
              }}>{on && "✓ "}{t}</button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background:"#fff",borderRadius:14,border:`1px solid ${PLX_BORDER}`,marginTop:16,overflow:"hidden",
      }}>
        <div style={{
          display:"grid",gridTemplateColumns:"40px 1.7fr 0.65fr 0.85fr 0.95fr 0.7fr 0.65fr 0.95fr 0.75fr 22px",
          padding:"12px 18px",fontSize:11,fontWeight:700,color:PLX_MUTED,
          background:PLX_GREEN_50,letterSpacing:".03em",borderBottom:`1px solid ${PLX_BORDER}`,
          alignItems:"center",gap:6,
        }}>
          <span><input type="checkbox" style={{accentColor:PLX_GREEN}}/></span>
          <span>商品名</span>
          <span>種別</span>
          <span>カテゴリ</span>
          <span>仕入先</span>
          <span>SKU</span>
          <span style={{textAlign:"right"}}>価格</span>
          <span style={{textAlign:"right"}}>在庫</span>
          <span style={{textAlign:"center"}}>ステータス</span>
          <span/>
        </div>
        {filtered.map((p,i) => {
          const av = available(p);
          const low = isLowStock(p,10);
          return (
            <div key={p.id} onClick={()=>onOpenProduct(p.id)} style={{
              display:"grid",gridTemplateColumns:"40px 1.7fr 0.65fr 0.85fr 0.95fr 0.7fr 0.65fr 0.95fr 0.75fr 22px",
              padding:"14px 18px",alignItems:"center",cursor:"pointer",gap:6,
              borderBottom: i<filtered.length-1 ? `1px solid ${PLX_BORDER}` : "none",
              transition:"background .12s",
            }}
              onMouseEnter={e=>e.currentTarget.style.background=PLX_GREEN_50}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span onClick={e=>e.stopPropagation()}><input type="checkbox" style={{accentColor:PLX_GREEN}}/></span>
              <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
                <div style={{
                  width:36,height:36,borderRadius:8,background:p.image,flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  border:`1px solid ${PLX_BORDER}`,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/></svg>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                  <div style={{fontSize:10,color:PLX_SUBTLE,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name_kana}</div>
                  {p.tags.length>0 && (
                    <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
                      {p.tags.slice(0,2).map(t=>(
                        <span key={t} style={{fontSize:9,fontWeight:700,color:PLX_GREEN,background:PLX_GREEN_LIGHT,padding:"2px 6px",borderRadius:9999}}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <span>
                {p.kind==="shomo"
                  ? <Pill color="#2563EB" bg="#DBEAFE">消耗品</Pill>
                  : <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>物販</Pill>}
              </span>
              <span style={{fontSize:12,color:PLX_TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.category}</span>
              <span style={{fontSize:12,color:PLX_TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.vendor}</span>
              <span style={{fontSize:11,color:PLX_MUTED,fontVariantNumeric:"tabular-nums",fontFamily:"ui-monospace,SFMono-Regular,monospace"}}>{p.sku}</span>
              <span style={{fontSize:13,fontWeight:700,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>¥{p.price}</span>
              <span style={{textAlign:"right",fontVariantNumeric:"tabular-nums"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4}}>
                  <span style={{fontSize:13,fontWeight:700,color: low ? "#D97706" : PLX_TEXT}}>{av}</span>
                  <span style={{fontSize:10,color:PLX_MUTED}}>個</span>
                </div>
                {p.kind==="shomo" && p.expiryDays != null && <ExpiryIndicator days={p.expiryDays}/>}
                {low && !(p.kind==="shomo" && p.expiryDays<=60) && <div style={{fontSize:9,fontWeight:700,color:"#D97706",marginTop:2}}>● 低在庫</div>}
              </span>
              <span style={{textAlign:"center"}}>
                {p.status==="active" && <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>公開中</Pill>}
                {p.status==="draft" && <Pill color={PLX_MUTED} bg="#F3F4F6">下書き</Pill>}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PLX_SUBTLE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:14,fontSize:12,color:PLX_MUTED}}>
        <span>1 〜 {filtered.length} 件を表示</span>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button style={pgBtn}>‹</button>
          <button style={{...pgBtn,background:PLX_GREEN,color:"#fff",border:`1px solid ${PLX_GREEN}`}}>1</button>
          <button style={pgBtn}>2</button>
          <button style={pgBtn}>›</button>
        </div>
      </div>
    </AdminShell>
  );
}

function QuickChip({on, onClick, dot, check, label, count, color, bg}) {
  return (
    <button onClick={onClick} style={{
      fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:9999,
      border:`1px solid ${on?color:PLX_BORDER}`,
      background:on?bg:"#fff",color:on?color:PLX_TEXT,
      cursor:"pointer",fontFamily:"inherit",
      display:"inline-flex",alignItems:"center",gap:6,
    }}>
      {dot && <span style={{width:7,height:7,borderRadius:"50%",background:dot}}/>}
      {check && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={on?color:PLX_MUTED} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      <span>{label}</span>
      <span style={{
        fontSize:9,fontWeight:700,
        background: on ? "#fff" : "#F3F4F6",
        color: on ? color : PLX_MUTED,
        padding:"1px 6px",borderRadius:9999,
      }}>{count}</span>
    </button>
  );
}

function ExpiryIndicator({days}) {
  if (days <= 0) return <div style={{marginTop:3,display:"flex",justifyContent:"flex-end"}}><span style={{fontSize:9,fontWeight:700,color:"#DC2626",background:"#FEE2E2",padding:"2px 7px",borderRadius:9999}}>期限切れ</span></div>;
  if (days <= 30) return <div style={{fontSize:9,fontWeight:700,color:"#DC2626",marginTop:2,display:"inline-flex",alignItems:"center",gap:3,justifyContent:"flex-end",width:"100%"}}><span style={{width:6,height:6,borderRadius:"50%",background:"#DC2626"}}/>あと {days} 日</div>;
  if (days <= 60) return <div style={{fontSize:9,fontWeight:700,color:"#D97706",marginTop:2,display:"inline-flex",alignItems:"center",gap:3,justifyContent:"flex-end",width:"100%"}}><span style={{width:6,height:6,borderRadius:"50%",background:"#D97706"}}/>あと {days} 日</div>;
  return null;
}

Object.assign(window, { ProductListV2, V2_KIND_MAP, V2_EXTRA_PRODUCTS });
