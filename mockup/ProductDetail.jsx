// Product Detail screen — header, images, variants table, sales, history
function ProductDetail({ productId, onBack, onEdit }) {
  const p = MOCK_PRODUCTS.find(x => x.id===productId) || MOCK_PRODUCTS[0];
  const variants = (productId === "p1") ? MOCK_VARIANTS_P1 : [{
    id:"v_only", sku:p.sku, barcode:p.jan,
    option1:"標準", option1_value:"—", price:p.price, cost:p.cost,
    on_hand:p.on_hand, committed:p.committed, unavailable:p.unavailable, is_default:true,
  }];
  const [tab, setTab] = React.useState("variants");
  const [adjustOpen, setAdjustOpen] = React.useState(null);

  const totalAvail = variants.reduce((s,v)=>s+(v.on_hand-v.committed-v.unavailable),0);
  const totalRevenue = (parseInt(p.price.replace(/,/g,""))*p.sold_90d).toLocaleString();

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
          <div style={{display:"flex",gap:5,marginTop:8}}>
            {[1,2,3].map(i=>(
              <div key={i} style={{
                width:46,height:46,borderRadius:8,background:i===1?p.image:"#F3F4F6",
                border:`1px solid ${i===1?PLX_GREEN:PLX_BORDER}`,cursor:"pointer",
              }}/>
            ))}
            <div style={{
              width:46,height:46,borderRadius:8,border:`1px dashed ${PLX_BORDER}`,
              display:"flex",alignItems:"center",justifyContent:"center",color:PLX_MUTED,fontSize:18,cursor:"pointer",
            }}>＋</div>
          </div>
        </div>

        <div style={{minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <SectionLabel>{p.category}</SectionLabel>
            {p.status==="active" && <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>● 公開中</Pill>}
            {p.status==="draft"  && <Pill color={PLX_MUTED} bg="#F3F4F6">下書き</Pill>}
          </div>
          <h2 style={{fontSize:28,fontWeight:700,margin:0,letterSpacing:"-.01em",lineHeight:1.25}}>{p.name}</h2>
          <div style={{fontSize:13,color:PLX_MUTED,marginTop:4}}>{p.name_kana}</div>
          <div style={{fontSize:13,color:PLX_TEXT,marginTop:14,lineHeight:1.7}}>{p.description}</div>
          <div style={{display:"flex",gap:6,marginTop:14,flexWrap:"wrap"}}>
            {p.tags.map(t => (
              <span key={t} style={{fontSize:11,fontWeight:600,color:PLX_GREEN,background:PLX_GREEN_LIGHT,padding:"4px 10px",borderRadius:9999}}>{t}</span>
            ))}
            <button style={{fontSize:11,fontWeight:600,color:PLX_MUTED,background:"#fff",padding:"4px 10px",borderRadius:9999,border:`1px dashed ${PLX_BORDER}`,cursor:"pointer",fontFamily:"inherit"}}>＋ タグ追加</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,auto)",gap:"6px 28px",marginTop:18,fontSize:12}}>
            <KV k="仕入先" v={p.vendor}/>
            <KV k="主要 SKU" v={p.sku} mono/>
            <KV k="JAN" v={p.jan} mono/>
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
            <span style={{color:PLX_MUTED}}>在庫数 (on_hand)</span>
            <span style={{fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{p.on_hand}</span>
            <span style={{color:PLX_MUTED}}>引当中 (committed)</span>
            <span style={{fontWeight:700,fontVariantNumeric:"tabular-nums"}}>−{p.committed}</span>
            <span style={{color:PLX_MUTED}}>使用不可</span>
            <span style={{fontWeight:700,fontVariantNumeric:"tabular-nums"}}>−{p.unavailable}</span>
          </div>
        </div>
      </div>

      {/* 90-day Sales */}
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
          {[
            {id:"variants",label:"バリアント"},
            {id:"history",label:"在庫履歴"},
            {id:"sales",label:"売上推移"},
          ].map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"14px 16px",border:"none",background:"none",cursor:"pointer",fontFamily:"inherit",
              fontSize:13,fontWeight:700,
              color: tab===t.id ? PLX_GREEN : PLX_MUTED,
              borderBottom: tab===t.id ? `2px solid ${PLX_GREEN}` : "2px solid transparent",
            }}>{t.label}</button>
          ))}
          <div style={{flex:1}}/>
          {tab==="variants" && (
            <button style={{
              padding:"0 14px",margin:"10px 0",borderRadius:9999,
              background:PLX_GREEN_LIGHT,color:PLX_GREEN,border:"none",fontWeight:700,fontSize:12,
              fontFamily:"inherit",cursor:"pointer",
            }}>＋ バリアントを追加</button>
          )}
        </div>

        {tab==="variants" && (
          <div>
            <div style={{
              display:"grid",gridTemplateColumns:"1.6fr 1fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 1.4fr",
              padding:"12px 22px",fontSize:11,fontWeight:700,color:PLX_MUTED,
              background:PLX_GREEN_50,letterSpacing:".03em",borderBottom:`1px solid ${PLX_BORDER}`,
              gap:8,
            }}>
              <span>SKU / オプション</span>
              <span>バーコード</span>
              <span style={{textAlign:"right"}}>価格</span>
              <span style={{textAlign:"right"}}>原価</span>
              <span style={{textAlign:"right"}}>在庫</span>
              <span style={{textAlign:"right"}}>引当</span>
              <span style={{textAlign:"right"}}>利用可能</span>
              <span style={{textAlign:"right"}}>操作</span>
            </div>
            {variants.map((v,i) => {
              const av = v.on_hand - v.committed - v.unavailable;
              return (
                <div key={v.id} style={{
                  display:"grid",gridTemplateColumns:"1.6fr 1fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 1.4fr",
                  padding:"14px 22px",alignItems:"center",fontSize:12,gap:8,
                  borderBottom: i<variants.length-1 ? `1px solid ${PLX_BORDER}` : "none",
                }}>
                  <div>
                    <div style={{fontFamily:"ui-monospace,SFMono-Regular,monospace",fontSize:11,color:PLX_MUTED}}>{v.sku}</div>
                    <div style={{fontSize:13,fontWeight:700,marginTop:2,display:"flex",alignItems:"center",gap:6}}>
                      {v.option1_value}
                      {v.is_default && <span style={{fontSize:9,fontWeight:700,color:PLX_GREEN,background:PLX_GREEN_LIGHT,padding:"2px 7px",borderRadius:9999}}>デフォルト</span>}
                    </div>
                  </div>
                  <span style={{fontFamily:"ui-monospace,SFMono-Regular,monospace",fontSize:11,color:PLX_MUTED}}>{v.barcode}</span>
                  <span style={{textAlign:"right",fontWeight:700,fontVariantNumeric:"tabular-nums"}}>¥{v.price}</span>
                  <span style={{textAlign:"right",color:PLX_MUTED,fontVariantNumeric:"tabular-nums"}}>¥{v.cost}</span>
                  <span style={{textAlign:"right",fontVariantNumeric:"tabular-nums",fontWeight:600}}>{v.on_hand}</span>
                  <span style={{textAlign:"right",fontVariantNumeric:"tabular-nums",color:PLX_MUTED}}>{v.committed}</span>
                  <span style={{textAlign:"right",fontWeight:700,color:av<=10?"#D97706":PLX_TEXT,fontVariantNumeric:"tabular-nums"}}>{av}</span>
                  <span style={{textAlign:"right",display:"flex",gap:6,justifyContent:"flex-end"}}>
                    <button onClick={()=>setAdjustOpen(v.id)} style={{
                      fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:9999,
                      border:`1px solid ${PLX_GREEN}`,background:"#fff",color:PLX_GREEN,
                      cursor:"pointer",fontFamily:"inherit",
                    }}>在庫を調整</button>
                    <button style={{
                      fontSize:11,fontWeight:600,padding:"5px 11px",borderRadius:9999,
                      border:`1px solid ${PLX_BORDER}`,background:"#fff",color:PLX_TEXT,
                      cursor:"pointer",fontFamily:"inherit",
                    }}>編集</button>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {tab==="history" && <InventoryHistory/>}

        {tab==="sales" && <SalesChart sold={p.sold_90d} revenue={totalRevenue}/>}
      </div>

      {adjustOpen && <InventoryAdjustModal variant={variants.find(v=>v.id===adjustOpen)} onClose={()=>setAdjustOpen(null)}/>}
    </AdminShell>
  );
}

function KV({k,v,mono}) {
  return (
    <>
      <span style={{color:PLX_MUTED}}>{k}</span>
      <span style={{
        fontWeight:700,fontFamily: mono ? "ui-monospace,SFMono-Regular,monospace" : "inherit",
      }}>{v}</span>
    </>
  );
}

function StatCard({label,value,unit,delta,up,sub,hint}) {
  return (
    <div style={{
      background:"#fff",borderRadius:14,padding:"16px 20px",border:`1px solid ${PLX_BORDER}`,
    }}>
      <div style={{fontSize:11,color:PLX_MUTED,fontWeight:600}}>{label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:5,marginTop:6}}>
        <div style={{fontSize:26,fontWeight:900,letterSpacing:"-.02em",color:hint?PLX_TEXT:PLX_GREEN,lineHeight:1}}>{value}</div>
        {unit && <div style={{fontSize:13,color:PLX_TEXT,fontWeight:600}}>{unit}</div>}
      </div>
      {delta && (
        <div style={{marginTop:8,fontSize:10,fontWeight:700,color:up?PLX_GREEN:"#D97706",
          background:up?PLX_GREEN_LIGHT:"#FEF3C7",display:"inline-block",padding:"2px 8px",borderRadius:9999}}>
          {up ? "↗" : "↘"} {delta} 前期比
        </div>
      )}
      {sub && <div style={{marginTop:8,fontSize:11,color:PLX_MUTED}}>{sub}</div>}
    </div>
  );
}

function InventoryHistory() {
  return (
    <div>
      <div style={{
        display:"grid",gridTemplateColumns:"160px 110px 80px 110px 1fr 110px",
        padding:"12px 22px",fontSize:11,fontWeight:700,color:PLX_MUTED,
        background:PLX_GREEN_50,letterSpacing:".03em",borderBottom:`1px solid ${PLX_BORDER}`,gap:10,
      }}>
        <span>日時</span>
        <span>項目</span>
        <span style={{textAlign:"right"}}>増減</span>
        <span>理由</span>
        <span>備考</span>
        <span>担当</span>
      </div>
      {MOCK_INV_HISTORY.map((h,i) => (
        <div key={i} style={{
          display:"grid",gridTemplateColumns:"160px 110px 80px 110px 1fr 110px",
          padding:"12px 22px",alignItems:"center",fontSize:12,gap:10,
          borderBottom: i<MOCK_INV_HISTORY.length-1 ? `1px solid ${PLX_BORDER}` : "none",
        }}>
          <span style={{fontFamily:"ui-monospace,SFMono-Regular,monospace",fontSize:11,color:PLX_MUTED}}>{h.date}</span>
          <span style={{fontWeight:600}}>{h.field==="on_hand"?"在庫":h.field==="committed"?"引当":"使用不可"}</span>
          <span style={{textAlign:"right",fontWeight:700,fontVariantNumeric:"tabular-nums",color:h.delta>0?PLX_GREEN:"#D97706"}}>{h.delta>0?"+":""}{h.delta}</span>
          <span>{({sale:"販売",purchase:"仕入",correction:"修正",damage:"破損",return:"返品",initial:"初期"})[h.reason]}</span>
          <span style={{color:PLX_MUTED}}>{h.note}</span>
          <span style={{fontSize:11,color:PLX_MUTED}}>{h.user}</span>
        </div>
      ))}
    </div>
  );
}

function SalesChart({sold,revenue}) {
  const max = Math.max(...MOCK_SALES_90D);
  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:18,marginBottom:18}}>
        <div>
          <div style={{fontSize:11,color:PLX_MUTED,fontWeight:600}}>販売数</div>
          <div style={{fontSize:26,fontWeight:900,color:PLX_GREEN,letterSpacing:"-.02em"}}>{sold}<span style={{fontSize:14,color:PLX_TEXT,marginLeft:3}}>個</span></div>
        </div>
        <div>
          <div style={{fontSize:11,color:PLX_MUTED,fontWeight:600}}>売上</div>
          <div style={{fontSize:26,fontWeight:900,letterSpacing:"-.02em"}}>¥{revenue}</div>
        </div>
        <div style={{flex:1}}/>
        <div style={{fontSize:11,color:PLX_MUTED}}>過去 12 週間 (週次)</div>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:8,height:140,padding:"0 4px",borderBottom:`1px solid ${PLX_BORDER}`}}>
        {MOCK_SALES_90D.map((v,i) => (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <div style={{
              width:"100%",height:`${(v/max)*120}px`,background:i===MOCK_SALES_90D.length-1?PLX_GREEN:PLX_GREEN_LIGHT,
              borderRadius:"6px 6px 0 0",position:"relative",
            }}>
              <span style={{position:"absolute",top:-18,left:"50%",transform:"translateX(-50%)",fontSize:10,fontWeight:700,color:i===MOCK_SALES_90D.length-1?PLX_GREEN:PLX_MUTED}}>{v}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:PLX_MUTED,marginTop:6,padding:"0 4px"}}>
        <span>2/12週</span><span>5週前</span><span>今週</span>
      </div>
    </div>
  );
}

function InventoryAdjustModal({variant,onClose}) {
  const [field, setField] = React.useState("on_hand");
  const [delta, setDelta] = React.useState(1);
  const [reason, setReason] = React.useState("purchase");
  const [note, setNote] = React.useState("");
  return (
    <div onClick={onClose} style={{
      position:"absolute",inset:0,background:"rgba(17,24,39,.4)",backdropFilter:"blur(4px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#fff",borderRadius:16,padding:"24px 28px",width:480,
        boxShadow:"0 24px 60px rgba(17,24,39,.18)",
      }}>
        <SectionLabel>在庫調整</SectionLabel>
        <h3 style={{fontSize:18,fontWeight:700,margin:"6px 0 4px"}}>在庫を調整します</h3>
        <div style={{fontSize:12,color:PLX_MUTED,marginBottom:18}}>{variant.sku} · {variant.option1_value}</div>

        <FormRow label="項目">
          <SegmentedControl value={field} onChange={setField} options={[
            {value:"on_hand",label:"在庫数"},
            {value:"committed",label:"引当"},
            {value:"unavailable",label:"使用不可"},
          ]}/>
        </FormRow>

        <FormRow label="増減（プラスで追加・マイナスで減少）">
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>setDelta(d=>d-1)} style={pmBtn}>−</button>
            <input type="number" value={delta} onChange={e=>setDelta(parseInt(e.target.value)||0)} style={{
              ...formInput,textAlign:"center",fontWeight:700,fontSize:16,width:90,
            }}/>
            <button onClick={()=>setDelta(d=>d+1)} style={pmBtn}>＋</button>
            <span style={{fontSize:12,color:PLX_MUTED,marginLeft:8}}>個 (現在: <b>{variant.on_hand}</b>)</span>
          </div>
        </FormRow>

        <FormRow label="理由">
          <select value={reason} onChange={e=>setReason(e.target.value)} style={formInput}>
            <option value="purchase">仕入 (purchase)</option>
            <option value="sale">販売 (sale)</option>
            <option value="correction">修正 (correction)</option>
            <option value="damage">破損 (damage)</option>
            <option value="return">返品 (return)</option>
            <option value="initial">初期登録 (initial)</option>
          </select>
        </FormRow>

        <FormRow label="メモ（任意）">
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="例: PO-2026-0421 入荷分" style={{...formInput,height:64,resize:"none",padding:"10px 14px"}}/>
        </FormRow>

        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
          <button onClick={onClose} style={btnGhost}>キャンセル</button>
          <button onClick={onClose} style={{...btnPrimary,minWidth:120}}>調整を確定</button>
        </div>
      </div>
    </div>
  );
}

function FormRow({label,children,hint}) {
  return (
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:PLX_TEXT,marginBottom:6}}>{label}</label>
      {children}
      {hint && <div style={{fontSize:11,color:PLX_MUTED,marginTop:5}}>{hint}</div>}
    </div>
  );
}

const formInput = {
  width:"100%",height:38,border:`1px solid ${PLX_BORDER}`,borderRadius:9,
  padding:"0 14px",fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff",
  boxSizing:"border-box",color:PLX_TEXT,
};
const pmBtn = {
  width:34,height:34,borderRadius:9,border:`1px solid ${PLX_BORDER}`,background:"#fff",
  cursor:"pointer",fontWeight:700,fontSize:16,color:PLX_TEXT,fontFamily:"inherit",
};
const btnPrimary = {
  height:38,padding:"0 20px",borderRadius:9999,
  background:PLX_GREEN,color:"#fff",border:"none",fontWeight:700,fontSize:13,
  fontFamily:"inherit",cursor:"pointer",
};
const btnSecondary = {
  height:38,padding:"0 18px",borderRadius:9999,
  background:"#fff",color:PLX_TEXT,border:`1px solid ${PLX_BORDER}`,fontWeight:700,fontSize:13,
  fontFamily:"inherit",cursor:"pointer",
};
const btnGhost = {
  height:38,padding:"0 14px",borderRadius:9999,
  background:"transparent",color:PLX_MUTED,border:"none",fontWeight:700,fontSize:13,
  fontFamily:"inherit",cursor:"pointer",
};

Object.assign(window, { ProductDetail, FormRow, formInput, btnPrimary, btnSecondary, btnGhost });
