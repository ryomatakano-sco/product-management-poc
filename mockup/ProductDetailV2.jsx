// Product Detail v2 — adds 種別 badge, 使用期限 row, 発注先 URL row, optional ロット履歴 tab

function ProductDetailV2({ productId, onBack, onEdit }) {
  const base = MOCK_PRODUCTS.find(x => x.id===productId) || MOCK_PRODUCTS[5];
  const extras = V2_KIND_MAP[base.id] || {};
  const p = { ...base, ...extras };
  // Force into consumable for demo if no extras
  if (!p.kind) p.kind = "shomo";
  if (p.kind==="shomo" && !p.expiryDate) { p.expiryDate = "2026/06/13"; p.expiryDays = 45; }
  const reorderUrl = "https://dental-supply.example.jp/product/MOR-NTR-100-pf";

  const variants = (productId === "p1") ? MOCK_VARIANTS_P1 : [{
    id:"v_only", sku:p.sku, barcode:p.jan,
    option1:"標準", option1_value:"—", price:p.price, cost:p.cost,
    on_hand:p.on_hand, committed:p.committed, unavailable:p.unavailable, is_default:true,
  }];
  const isShomo = p.kind === "shomo";
  const tabs = isShomo
    ? [{id:"variants",label:"バリアント"},{id:"history",label:"在庫履歴"},{id:"lots",label:"ロット履歴"},{id:"sales",label:"売上推移"}]
    : [{id:"variants",label:"バリアント"},{id:"history",label:"在庫履歴"},{id:"sales",label:"売上推移"}];
  const [tab, setTab] = React.useState("variants");
  const [adjustOpen, setAdjustOpen] = React.useState(null);

  const totalAvail = variants.reduce((s,v)=>s+(v.on_hand-v.committed-v.unavailable),0);
  const totalRevenue = (parseInt(p.price.replace(/,/g,""))*p.sold_90d).toLocaleString();

  const expiryTone = p.expiryDays==null ? null : p.expiryDays<=30 ? "red" : p.expiryDays<=60 ? "amber" : "neutral";

  const headerRight = (
    <div style={{display:"flex",gap:8}}>
      <button style={btnGhost}>… その他</button>
      <button onClick={onEdit} style={btnSecondary}>編集</button>
    </div>
  );

  return (
    <AdminShell title={p.name} currentNav="products" headerRight={headerRight}
      breadcrumbs={["商品", p.category, p.name]}>
      <button onClick={onBack} style={{
        background:"none",border:"none",color:PLX_MUTED,fontSize:12,fontWeight:600,
        cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:14,
        display:"inline-flex",alignItems:"center",gap:4,
      }}>← 商品一覧へ戻る</button>

      {/* Hero */}
      <div style={{
        background:"#fff",borderRadius:16,border:`1px solid ${PLX_BORDER}`,
        padding:"22px 26px",display:"grid",gridTemplateColumns:"160px 1fr auto",gap:24,alignItems:"flex-start",
      }}>
        <div>
          <div style={{
            width:160,height:160,borderRadius:14,background:p.image,
            display:"flex",alignItems:"center",justifyContent:"center",
            border:`1px solid ${PLX_BORDER}`,
          }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
          </div>
        </div>

        <div style={{minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
            <SectionLabel>{p.category}</SectionLabel>
            {/* 種別 badge — next to product name */}
            {isShomo
              ? <Pill color="#2563EB" bg="#DBEAFE">消耗品</Pill>
              : <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>物販</Pill>}
            {p.status==="active" && <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>● 公開中</Pill>}
          </div>
          <h2 style={{fontSize:26,fontWeight:700,margin:0,letterSpacing:"-.01em",lineHeight:1.25}}>{p.name}</h2>
          <div style={{fontSize:13,color:PLX_MUTED,marginTop:4}}>{p.name_kana}</div>
          <div style={{fontSize:13,color:PLX_TEXT,marginTop:12,lineHeight:1.7}}>{p.description}</div>

          {/* Basic info card */}
          <div style={{
            marginTop:16,padding:"12px 16px",borderRadius:10,background:PLX_SURFACE,border:`1px solid ${PLX_BORDER}`,
            display:"flex",flexDirection:"column",gap:9,
          }}>
            <BasicRow k="仕入先" v={p.vendor}/>
            <BasicRow k="主要 SKU" v={p.sku} mono/>
            <BasicRow k="JAN" v={p.jan} mono/>
            {isShomo && (
              <BasicRow k="使用期限" v={formatJpDate(p.expiryDate)} mono right={
                <Pill color={expiryTone==="red"?"#DC2626":expiryTone==="amber"?"#D97706":PLX_MUTED}
                      bg={expiryTone==="red"?"#FEE2E2":expiryTone==="amber"?"#FEF3C7":"#F3F4F6"}>
                  期限まで {p.expiryDays} 日
                </Pill>
              }/>
            )}
            <BasicRow k="発注先 URL" v={<UrlLink url={reorderUrl}/>} right={
              <button style={{
                height:30,padding:"0 12px",borderRadius:9999,
                background:PLX_GREEN,color:"#fff",border:"none",fontWeight:700,fontSize:11,
                fontFamily:"inherit",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,
                boxShadow:"0 4px 10px rgba(26,166,138,.22)",
              }}>🔗 再発注する</button>
            }/>
          </div>

          <div style={{display:"flex",gap:6,marginTop:14,flexWrap:"wrap"}}>
            {p.tags.map(t => (
              <span key={t} style={{fontSize:11,fontWeight:600,color:PLX_GREEN,background:PLX_GREEN_LIGHT,padding:"4px 10px",borderRadius:9999}}>{t}</span>
            ))}
          </div>
        </div>

        {/* Stat sidebar */}
        <div style={{
          background:PLX_GREEN_50,borderRadius:12,padding:"16px 20px",minWidth:200,
        }}>
          <div style={{fontSize:11,color:PLX_MUTED,fontWeight:600}}>利用可能在庫</div>
          <div style={{display:"flex",alignItems:"baseline",gap:4,marginTop:2}}>
            <span style={{fontSize:36,fontWeight:900,color:PLX_GREEN,letterSpacing:"-.02em",lineHeight:1}}>{totalAvail}</span>
            <span style={{fontSize:13,color:PLX_TEXT,fontWeight:600}}>個</span>
          </div>
          <div style={{height:1,background:PLX_BORDER,margin:"14px 0"}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"5px 8px",fontSize:11}}>
            <span style={{color:PLX_MUTED}}>在庫数</span>
            <span style={{fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{p.on_hand}</span>
            <span style={{color:PLX_MUTED}}>引当中</span>
            <span style={{fontWeight:700,fontVariantNumeric:"tabular-nums"}}>−{p.committed}</span>
            <span style={{color:PLX_MUTED}}>使用不可</span>
            <span style={{fontWeight:700,fontVariantNumeric:"tabular-nums"}}>−{p.unavailable}</span>
          </div>
        </div>
      </div>

      {/* 90-day stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginTop:18}}>
        <StatCard label="販売数（直近90日）" value={p.sold_90d.toString()} unit="個" delta="+12%" up/>
        <StatCard label="売上（直近90日）" value={`¥${totalRevenue}`} unit="" delta="+8%" up/>
        <StatCard label="次回入荷予定" value="3日後" unit="" sub="PO-2026-0421 で 30個発注済" hint/>
      </div>

      {/* Tabs */}
      <div style={{
        background:"#fff",borderRadius:16,border:`1px solid ${PLX_BORDER}`,marginTop:18,overflow:"hidden",
      }}>
        <div style={{display:"flex",borderBottom:`1px solid ${PLX_BORDER}`,padding:"0 22px"}}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"14px 16px",border:"none",background:"none",cursor:"pointer",fontFamily:"inherit",
              fontSize:13,fontWeight:700,
              color: tab===t.id ? PLX_GREEN : PLX_MUTED,
              borderBottom: tab===t.id ? `2px solid ${PLX_GREEN}` : "2px solid transparent",
            }}>{t.label}</button>
          ))}
        </div>

        {tab==="variants" && (
          <div style={{padding:"14px 22px"}}>
            <div style={{fontSize:12,color:PLX_MUTED}}>このバリアントの SKU: <b style={{color:PLX_TEXT,fontFamily:"ui-monospace,SFMono-Regular,monospace"}}>{p.sku}</b> · 在庫 <b style={{color:PLX_TEXT}}>{p.on_hand}</b>（引当 {p.committed}）</div>
            <div style={{marginTop:10}}>
              <button onClick={()=>setAdjustOpen("v_only")} style={{
                fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:9999,
                border:`1px solid ${PLX_GREEN}`,background:"#fff",color:PLX_GREEN,
                cursor:"pointer",fontFamily:"inherit",
              }}>在庫を調整</button>
            </div>
          </div>
        )}

        {tab==="history" && <InventoryHistory/>}

        {tab==="lots" && isShomo && <LotHistory/>}

        {tab==="sales" && <SalesChart sold={p.sold_90d} revenue={totalRevenue}/>}
      </div>

      {adjustOpen && <InventoryAdjustModal variant={variants.find(v=>v.id===adjustOpen)||variants[0]} onClose={()=>setAdjustOpen(null)}/>}
    </AdminShell>
  );
}

function BasicRow({k,v,mono,right}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,fontSize:12}}>
      <span style={{color:PLX_MUTED,minWidth:90}}>{k}</span>
      <span style={{
        fontWeight:700,flex:1,minWidth:0,
        fontFamily: mono ? "ui-monospace,SFMono-Regular,monospace" : "inherit",
        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
      }}>{v}</span>
      {right}
    </div>
  );
}

function UrlLink({url}) {
  const truncated = url.length > 42 ? url.slice(0,40) + "…" : url;
  return (
    <a href={url} title={url} style={{
      color:PLX_GREEN,textDecoration:"none",fontFamily:"ui-monospace,SFMono-Regular,monospace",fontSize:11,fontWeight:600,
    }}>{truncated}</a>
  );
}

function formatJpDate(d) {
  if (!d) return "—";
  const [y,m,dd] = d.split("/");
  return `${y}年${m}月${dd}日`;
}

function LotHistory() {
  const rows = [
    { lot:"LOT-2026A-018", date:"2026/06/13", qty:30, status:"current",  arrived:"2026/02/12" },
    { lot:"LOT-2026A-012", date:"2026/04/02", qty:0,  status:"depleted", arrived:"2025/12/08" },
    { lot:"LOT-2025D-091", date:"2025/12/20", qty:0,  status:"expired",  arrived:"2025/08/15" },
  ];
  return (
    <div>
      <div style={{
        display:"grid",gridTemplateColumns:"160px 140px 100px 1fr 140px",
        padding:"12px 22px",fontSize:11,fontWeight:700,color:PLX_MUTED,
        background:PLX_GREEN_50,letterSpacing:".03em",borderBottom:`1px solid ${PLX_BORDER}`,gap:10,
      }}>
        <span>ロット番号</span>
        <span>使用期限</span>
        <span style={{textAlign:"right"}}>残数</span>
        <span>ステータス</span>
        <span>入荷日</span>
      </div>
      {rows.map((r,i) => (
        <div key={r.lot} style={{
          display:"grid",gridTemplateColumns:"160px 140px 100px 1fr 140px",
          padding:"12px 22px",alignItems:"center",fontSize:12,gap:10,
          borderBottom: i<rows.length-1 ? `1px solid ${PLX_BORDER}` : "none",
        }}>
          <span style={{fontFamily:"ui-monospace,SFMono-Regular,monospace",fontSize:11,fontWeight:700}}>{r.lot}</span>
          <span style={{fontFamily:"ui-monospace,SFMono-Regular,monospace"}}>{r.date}</span>
          <span style={{textAlign:"right",fontWeight:700,fontVariantNumeric:"tabular-nums",color:r.qty===0?PLX_MUTED:PLX_TEXT}}>{r.qty}</span>
          <span>
            {r.status==="current"  && <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>● 使用中</Pill>}
            {r.status==="depleted" && <Pill color={PLX_MUTED} bg="#F3F4F6">使い切り</Pill>}
            {r.status==="expired"  && <Pill color="#DC2626" bg="#FEE2E2">期限切れ</Pill>}
          </span>
          <span style={{fontSize:11,color:PLX_MUTED,fontFamily:"ui-monospace,SFMono-Regular,monospace"}}>{r.arrived}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { ProductDetailV2, LotHistory });
