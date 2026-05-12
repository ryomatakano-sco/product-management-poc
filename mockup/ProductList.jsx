// Product List screen — table view with search, filters, tag chips
function ProductList({ onOpenProduct, onCreate }) {
  const [searchQ, setSearchQ] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [vendorFilter, setVendorFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("active");
  const [activeTags, setActiveTags] = React.useState([]);

  const filtered = MOCK_PRODUCTS.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (categoryFilter && p.category_id !== categoryFilter) return false;
    if (vendorFilter && p.vendor_id !== vendorFilter) return false;
    if (activeTags.length && !activeTags.some(t => p.tags.includes(t))) return false;
    if (searchQ && !(p.name + p.name_kana + p.sku).toLowerCase().includes(searchQ.toLowerCase())) return false;
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

  return (
    <AdminShell title="商品一覧" currentNav="products" headerRight={headerRight}>
      <SectionLabel>商品マスタ</SectionLabel>
      <div style={{display:"flex",alignItems:"baseline",gap:14,marginBottom:18,marginTop:6}}>
        <h2 style={{fontSize:24,fontWeight:700,margin:0,letterSpacing:"-.01em"}}>すべての商品</h2>
        <span style={{fontSize:13,color:PLX_MUTED}}>{filtered.length} 件 / 全 {MOCK_PRODUCTS.length} 件</span>
      </div>

      {/* Filter bar */}
      <div style={{
        background:"#fff",borderRadius:14,padding:"16px 20px",border:`1px solid ${PLX_BORDER}`,
        display:"flex",flexDirection:"column",gap:14,
      }}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <div style={{position:"relative",flex:1,maxWidth:360}}>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="商品名・かな・SKUで検索…" style={inputBase}/>
            <svg style={{position:"absolute",left:13,top:11}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PLX_MUTED} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
          </div>
          <Select value={categoryFilter} onChange={setCategoryFilter}
            options={[{value:"",label:"すべてのカテゴリ"},...MOCK_CATEGORIES.map(c=>({value:c.id,label:c.name}))]}/>
          <Select value={vendorFilter} onChange={setVendorFilter}
            options={[{value:"",label:"すべての仕入先"},...MOCK_VENDORS.map(v=>({value:v.id,label:v.company_name}))]}/>
          <div style={{flex:1}}/>
          <SegmentedControl value={statusFilter} onChange={setStatusFilter} options={[
            {value:"active",label:"公開中"},
            {value:"draft",label:"下書き"},
            {value:"all",label:"すべて"},
          ]}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:PLX_MUTED,fontWeight:600}}>タグで絞り込み</span>
          {MOCK_TAGS.map(t => {
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
          {activeTags.length>0 && (
            <button onClick={()=>setActiveTags([])} style={{fontSize:11,color:PLX_MUTED,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>クリア</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background:"#fff",borderRadius:14,border:`1px solid ${PLX_BORDER}`,marginTop:16,overflow:"hidden",
      }}>
        <div style={{
          display:"grid",gridTemplateColumns:"40px 1.7fr 0.9fr 1fr 0.8fr 0.7fr 0.8fr 0.8fr 28px",
          padding:"12px 18px",fontSize:11,fontWeight:700,color:PLX_MUTED,
          background:PLX_GREEN_50,letterSpacing:".03em",borderBottom:`1px solid ${PLX_BORDER}`,
          alignItems:"center",
        }}>
          <span><input type="checkbox" style={{accentColor:PLX_GREEN}}/></span>
          <span>商品名</span>
          <span>カテゴリ</span>
          <span>仕入先</span>
          <span>SKU</span>
          <span style={{textAlign:"right"}}>価格</span>
          <span style={{textAlign:"right"}}>在庫（利用可能）</span>
          <span style={{textAlign:"center"}}>ステータス</span>
          <span/>
        </div>
        {filtered.map((p,i) => {
          const av = available(p);
          const low = isLowStock(p,10);
          return (
            <div key={p.id} onClick={()=>onOpenProduct(p.id)} style={{
              display:"grid",gridTemplateColumns:"40px 1.7fr 0.9fr 1fr 0.8fr 0.7fr 0.8fr 0.8fr 28px",
              padding:"14px 18px",alignItems:"center",cursor:"pointer",
              borderBottom: i<filtered.length-1 ? `1px solid ${PLX_BORDER}` : "none",
              transition:"background .12s",
            }}
              onMouseEnter={e=>e.currentTarget.style.background=PLX_GREEN_50}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span onClick={e=>e.stopPropagation()}><input type="checkbox" style={{accentColor:PLX_GREEN}}/></span>
              <div style={{display:"flex",gap:12,alignItems:"center",minWidth:0}}>
                <div style={{
                  width:40,height:40,borderRadius:8,background:p.image,flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  border:`1px solid ${PLX_BORDER}`,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/></svg>
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
              <span style={{fontSize:12,color:PLX_TEXT}}>{p.category}</span>
              <span style={{fontSize:12,color:PLX_TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.vendor}</span>
              <span style={{fontSize:11,color:PLX_MUTED,fontVariantNumeric:"tabular-nums",fontFamily:"ui-monospace,SFMono-Regular,monospace"}}>{p.sku}</span>
              <span style={{fontSize:13,fontWeight:700,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>¥{p.price}</span>
              <span style={{textAlign:"right",fontVariantNumeric:"tabular-nums"}}>
                <span style={{
                  fontSize:13,fontWeight:700,
                  color: low ? "#D97706" : PLX_TEXT,
                }}>{av}</span>
                <span style={{fontSize:10,color:PLX_MUTED,marginLeft:3}}>個</span>
                {low && <div style={{fontSize:9,fontWeight:700,color:"#D97706",marginTop:2}}>● 低在庫</div>}
              </span>
              <span style={{textAlign:"center"}}>
                {p.status==="active" && <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>公開中</Pill>}
                {p.status==="draft" && <Pill color={PLX_MUTED} bg="#F3F4F6">下書き</Pill>}
                {p.status==="archived" && <Pill color={PLX_SUBTLE} bg="#F3F4F6">アーカイブ</Pill>}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PLX_SUBTLE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          );
        })}
        {filtered.length===0 && (
          <div style={{padding:"60px 20px",textAlign:"center",color:PLX_MUTED}}>
            <div style={{fontSize:32,marginBottom:8,opacity:.4}}>—</div>
            <div style={{fontSize:14,fontWeight:700,color:PLX_TEXT,marginBottom:4}}>該当する商品がありません</div>
            <div style={{fontSize:12}}>検索条件を変更するか、新しい商品を追加してください。</div>
          </div>
        )}
      </div>

      {/* Pagination footer */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:14,fontSize:12,color:PLX_MUTED}}>
        <span>1 〜 {filtered.length} 件を表示</span>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button style={pgBtn}>‹</button>
          <button style={{...pgBtn,background:PLX_GREEN,color:"#fff",border:`1px solid ${PLX_GREEN}`}}>1</button>
          <button style={pgBtn}>2</button>
          <button style={pgBtn}>3</button>
          <button style={pgBtn}>›</button>
        </div>
      </div>
    </AdminShell>
  );
}

// shared atoms
const inputBase = {
  width:"100%",height:38,border:`1px solid ${PLX_BORDER}`,borderRadius:9,
  padding:"0 14px 0 36px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff",
  boxSizing:"border-box",
};

function SectionLabel({children}) {
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:PLX_GREEN,letterSpacing:".05em"}}>
      <span style={{width:7,height:7,borderRadius:"50%",background:PLX_GREEN}}/>
      {children}
    </div>
  );
}

function Select({value,onChange,options}) {
  return (
    <div style={{position:"relative"}}>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{
        height:38,padding:"0 32px 0 14px",borderRadius:9,border:`1px solid ${PLX_BORDER}`,
        fontSize:13,fontFamily:"inherit",background:"#fff",cursor:"pointer",
        appearance:"none",WebkitAppearance:"none",color:PLX_TEXT,minWidth:160,
      }}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg style={{position:"absolute",right:12,top:14,pointerEvents:"none"}} width="10" height="10" viewBox="0 0 12 12" fill="none" stroke={PLX_MUTED} strokeWidth="1.8" strokeLinecap="round"><path d="M2 4l4 4 4-4"/></svg>
    </div>
  );
}

function SegmentedControl({value,onChange,options}) {
  return (
    <div style={{display:"inline-flex",background:PLX_SURFACE,borderRadius:9999,padding:3,border:`1px solid ${PLX_BORDER}`}}>
      {options.map(o => {
        const on = value===o.value;
        return (
          <button key={o.value} onClick={()=>onChange(o.value)} style={{
            fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:9999,border:"none",
            background: on ? "#fff" : "transparent",
            color: on ? PLX_GREEN : PLX_MUTED,
            boxShadow: on ? "0 1px 3px rgba(0,0,0,.06)" : "none",
            cursor:"pointer",fontFamily:"inherit",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

const pgBtn = {
  height:30,minWidth:30,padding:"0 9px",borderRadius:8,border:`1px solid ${PLX_BORDER}`,
  background:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600,color:PLX_TEXT,
};

function Pill({children,color,bg}) {
  return <span style={{fontSize:11,fontWeight:700,color,background:bg,padding:"3px 10px",borderRadius:9999,whiteSpace:"nowrap",display:"inline-block"}}>{children}</span>;
}

Object.assign(window, { ProductList, SectionLabel, Select, SegmentedControl, Pill, inputBase });
