// Product Create v2 — adds 品目種別 toggle, 使用期限, 発注先URL, barcode-first AI modal
function ProductCreateV2({ onCancel }) {
  const [itemKind, setItemKind] = React.useState("buntan"); // buntan = 物販品, shomo = 消耗品
  const [name, setName] = React.useState("");
  const [nameKana, setNameKana] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [vendorId, setVendorId] = React.useState("");
  const [reorderUrl, setReorderUrl] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [lotNumber, setLotNumber] = React.useState("");
  const [unit, setUnit] = React.useState("個");
  const [status, setStatus] = React.useState("draft");
  const [tags, setTags] = React.useState([]);
  const [tagInput, setTagInput] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [aiOpen, setAiOpen] = React.useState(false);

  const [variant, setVariant] = React.useState({
    sku:"", barcode:"", price:"", cost:"", stock:"",
  });

  const applyAi = (picks) => {
    if (picks.title) setName(picks.title.value);
    if (picks.brand) {
      const v = MOCK_VENDORS.find(x => x.company_name === picks.brand.value);
      if (v) setVendorId(v.id);
    }
    if (picks.category) {
      const c = MOCK_CATEGORIES.find(x => x.name === picks.category.value);
      if (c) setCategoryId(c.id);
    }
    if (picks.price) setVariant(v=>({...v, price: picks.price.value.replace(/[¥,]/g,"")}));
    if (picks.description) setDescription(picks.description.value);
    setAiOpen(false);
  };

  const headerRight = (
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <button onClick={onCancel} style={btnGhost}>キャンセル</button>
      <button style={btnSecondary}>下書きとして保存</button>
      <button style={btnPrimary}>商品を公開</button>
    </div>
  );

  return (
    <AdminShell title="新しい商品を追加" currentNav="products" headerRight={headerRight}
      breadcrumbs={["商品", "新規追加"]}>
      <button onClick={onCancel} style={{
        background:"none",border:"none",color:PLX_MUTED,fontSize:12,fontWeight:600,
        cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:14,
      }}>← 商品一覧へ戻る</button>

      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:18}}>
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          {/* AI Assist banner */}
          <div style={{
            background:"linear-gradient(100deg, #E6F7F2 0%, #F4FBF8 80%)",
            border:`1px solid ${PLX_GREEN_LIGHT}`,
            borderRadius:14,padding:"16px 20px",
            display:"flex",alignItems:"center",gap:16,
          }}>
            <div style={{
              width:44,height:44,borderRadius:12,background:"#fff",
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
              boxShadow:"0 4px 12px rgba(26,166,138,.15)",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700}}>AI でサクッと商品情報を入力</div>
              <div style={{fontSize:12,color:PLX_MUTED,marginTop:2,lineHeight:1.6}}>ジャンルコードまたは商品名を入力すると、AI が公開情報から候補を取得します。手入力の手間を約 <span style={{color:PLX_GREEN,fontWeight:700}}>80%</span> 削減できます。</div>
            </div>
            <button onClick={()=>setAiOpen(true)} style={{
              height:38,padding:"0 18px",borderRadius:9999,
              background:PLX_GREEN,color:"#fff",border:"none",fontWeight:700,fontSize:13,
              fontFamily:"inherit",cursor:"pointer",
              boxShadow:"0 6px 16px rgba(26,166,138,.25)",
              display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",
            }}>✨ AI で入力する</button>
          </div>

          {/* Basic info */}
          <FormSectionV2 title="基本情報" subtitle="商品の基本となる情報を入力します">
            {/* Item kind toggle — placed at the very top */}
            <FormRow label="品目種別">
              <ItemKindToggle value={itemKind} onChange={setItemKind}/>
              <div style={{fontSize:11,color:PLX_MUTED,marginTop:6}}>消耗品は使用期限管理の対象になります</div>
            </FormRow>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <FormRow label="商品名（漢字）">
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="例：エグザフレックス インプレッション" style={formInput}/>
              </FormRow>
              <FormRow label="商品名（かな）">
                <input value={nameKana} onChange={e=>setNameKana(e.target.value)} placeholder="エグザフレックス インプレッション" style={formInput}/>
              </FormRow>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <FormRow label="カテゴリ">
                <Select value={categoryId} onChange={setCategoryId}
                  options={[{value:"",label:"選択してください"},...MOCK_CATEGORIES.map(c=>({value:c.id,label:c.name}))]}/>
              </FormRow>
              <FormRow label="仕入先 / ブランド">
                <Select value={vendorId} onChange={setVendorId}
                  options={[{value:"",label:"選択してください"},...MOCK_VENDORS.map(v=>({value:v.id,label:v.company_name}))]}/>
              </FormRow>
            </div>

            {/* Reorder URL — always visible */}
            <FormRow label="発注先 URL">
              <div style={{display:"flex",gap:8}}>
                <div style={{position:"relative",flex:1}}>
                  <span style={{position:"absolute",left:14,top:11,color:PLX_MUTED}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.5.7l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.7l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/></svg>
                  </span>
                  <input value={reorderUrl} onChange={e=>setReorderUrl(e.target.value)} placeholder="https://example.com/product/..." style={{...formInput,paddingLeft:38,fontFamily:"ui-monospace,SFMono-Regular,monospace",fontSize:12}}/>
                </div>
                <button disabled={!reorderUrl} style={{
                  height:38,padding:"0 14px",borderRadius:9,
                  border:`1px solid ${reorderUrl?PLX_GREEN:PLX_BORDER}`,
                  background:reorderUrl?"#fff":"#F9FAFB",color:reorderUrl?PLX_GREEN:PLX_SUBTLE,
                  fontWeight:700,fontSize:12,cursor:reorderUrl?"pointer":"not-allowed",fontFamily:"inherit",
                  display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",
                }}>🔗 開く</button>
              </div>
              <div style={{fontSize:11,color:PLX_MUTED,marginTop:5}}>クリックでこの URL を開いて再発注できます</div>
            </FormRow>

            <FormRow label="商品説明">
              <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="商品の特長・用途・サイズなどを記入します。" style={{...formInput,height:90,resize:"vertical",padding:"10px 14px"}}/>
            </FormRow>
            <FormRow label="タグ（複数選択可・新規入力で自動作成）">
              <div style={{
                minHeight:38,border:`1px solid ${PLX_BORDER}`,borderRadius:9,padding:"6px 10px",
                display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",background:"#fff",
              }}>
                {tags.map(t => (
                  <span key={t} style={{fontSize:12,fontWeight:600,color:PLX_GREEN,background:PLX_GREEN_LIGHT,padding:"4px 10px",borderRadius:9999,display:"inline-flex",alignItems:"center",gap:4}}>
                    {t}
                    <button onClick={()=>setTags(tags.filter(x=>x!==t))} style={{background:"none",border:"none",color:PLX_GREEN,cursor:"pointer",fontSize:13,padding:0,lineHeight:1}}>×</button>
                  </span>
                ))}
                <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                  onKeyDown={e=>{ if (e.key==="Enter" && tagInput.trim()) { setTags([...tags,tagInput.trim()]); setTagInput(""); e.preventDefault(); } }}
                  placeholder={tags.length?"":"タグを入力して Enter で追加"}
                  style={{border:"none",outline:"none",fontSize:12,fontFamily:"inherit",flex:1,minWidth:120,padding:"4px 0"}}/>
              </div>
            </FormRow>
          </FormSectionV2>

          {/* Consumable details — only when 消耗品 selected */}
          {itemKind==="shomo" && (
            <FormSectionV2
              title="消耗品の追加情報"
              subtitle="使用期限・ロット・単位を管理します"
              titleBadge={<span style={{fontSize:10,fontWeight:700,color:"#2563EB",background:"#DBEAFE",padding:"2px 8px",borderRadius:9999,marginLeft:6}}>消耗品のみ</span>}
            >
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
                <FormRow label="使用期限">
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:14,top:11,color:PLX_MUTED}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </span>
                    <input value={expiryDate} onChange={e=>setExpiryDate(e.target.value)} placeholder="YYYY/MM/DD" style={{...formInput,paddingLeft:38,fontFamily:"ui-monospace,SFMono-Regular,monospace"}}/>
                  </div>
                  <div style={{fontSize:11,color:PLX_MUTED,marginTop:5}}>空欄の場合は期限管理されません</div>
                </FormRow>
                <FormRow label="ロット番号（任意）">
                  <input value={lotNumber} onChange={e=>setLotNumber(e.target.value)} placeholder="LOT-2026A-001" style={{...formInput,fontFamily:"ui-monospace,SFMono-Regular,monospace"}}/>
                </FormRow>
                <FormRow label="単位">
                  <Select value={unit} onChange={setUnit}
                    options={[{value:"個",label:"個"},{value:"箱",label:"箱"},{value:"mL",label:"mL"},{value:"g",label:"g"}]}/>
                </FormRow>
              </div>
            </FormSectionV2>
          )}

          {/* Variant */}
          <FormSectionV2 title="バリアント" subtitle="SKU・価格・初期在庫" rightAction="＋ もう一つのバリアントを追加">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <FormRow label="SKU">
                <input value={variant.sku} onChange={e=>setVariant({...variant,sku:e.target.value})} placeholder="GC-EX-001" style={formInput}/>
              </FormRow>
              <FormRow label="JAN / バーコード">
                <input value={variant.barcode} onChange={e=>setVariant({...variant,barcode:e.target.value})} placeholder="4987246012001" style={formInput}/>
              </FormRow>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
              <FormRow label="販売価格 (¥)">
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:14,top:10,fontSize:13,color:PLX_MUTED,fontWeight:700}}>¥</span>
                  <input value={variant.price} onChange={e=>setVariant({...variant,price:e.target.value})} placeholder="4,800" style={{...formInput,paddingLeft:28,fontVariantNumeric:"tabular-nums"}}/>
                </div>
              </FormRow>
              <FormRow label="原価 (¥)">
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:14,top:10,fontSize:13,color:PLX_MUTED,fontWeight:700}}>¥</span>
                  <input value={variant.cost} onChange={e=>setVariant({...variant,cost:e.target.value})} placeholder="3,100" style={{...formInput,paddingLeft:28,fontVariantNumeric:"tabular-nums"}}/>
                </div>
              </FormRow>
              <FormRow label="初期在庫数">
                <input value={variant.stock} onChange={e=>setVariant({...variant,stock:e.target.value})} placeholder="0" style={{...formInput,fontVariantNumeric:"tabular-nums"}}/>
              </FormRow>
            </div>
          </FormSectionV2>
        </div>

        {/* Sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          <FormSectionV2 title="ステータス">
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <RadioRow checked={status==="active"} onClick={()=>setStatus("active")} label="公開中" sub="商品一覧に表示し、販売記録から選択できるようにします。"/>
              <RadioRow checked={status==="draft"} onClick={()=>setStatus("draft")} label="下書き" sub="保存のみ。一覧には表示されません。"/>
            </div>
          </FormSectionV2>

          <FormSectionV2 title="プレビュー">
            <div style={{
              background:PLX_GREEN_50,borderRadius:10,padding:14,
              display:"flex",gap:12,alignItems:"flex-start",border:`1px solid ${PLX_GREEN_LIGHT}`,
            }}>
              <div style={{
                width:44,height:44,borderRadius:8,background:"#fff",border:`1px solid ${PLX_BORDER}`,
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN} strokeWidth="1.6" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              </div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                  {itemKind==="shomo"
                    ? <span style={{fontSize:9,fontWeight:700,color:"#2563EB",background:"#DBEAFE",padding:"2px 7px",borderRadius:9999}}>消耗品</span>
                    : <span style={{fontSize:9,fontWeight:700,color:PLX_GREEN,background:PLX_GREEN_LIGHT,padding:"2px 7px",borderRadius:9999}}>物販</span>}
                </div>
                <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name || "商品名（未入力）"}</div>
                <div style={{fontSize:10,color:PLX_SUBTLE,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{nameKana || "—"}</div>
                <div style={{fontSize:13,fontWeight:700,marginTop:8,color:PLX_GREEN,fontVariantNumeric:"tabular-nums"}}>¥{variant.price || "0"}</div>
                {itemKind==="shomo" && expiryDate && (
                  <div style={{fontSize:10,color:PLX_MUTED,marginTop:5,fontFamily:"ui-monospace,SFMono-Regular,monospace"}}>使用期限: {expiryDate}</div>
                )}
              </div>
            </div>
          </FormSectionV2>

          <div style={{
            background:PLX_GREEN_50,borderRadius:14,padding:"16px 18px",border:`1px solid ${PLX_GREEN_LIGHT}`,
          }}>
            <SectionLabel>ヘルプ</SectionLabel>
            <div style={{fontSize:12,color:PLX_TEXT,marginTop:6,lineHeight:1.7}}>
              <b>消耗品</b>を選ぶと、使用期限・ロット・単位の項目が表示されます。期限が近づくとダッシュボードでアラートします。
            </div>
          </div>
        </div>
      </div>

      {aiOpen && <AiAssistModalV2 onClose={()=>setAiOpen(false)} onApply={applyAi}/>}
    </AdminShell>
  );
}

function ItemKindToggle({value,onChange}) {
  const opts = [
    { value:"buntan", label:"物販品",   sub:"販売する商品（歯ブラシ等）", color:PLX_GREEN,     bg:PLX_GREEN_LIGHT },
    { value:"shomo",  label:"消耗品",   sub:"治療で使う材料（紙コップ等）", color:"#2563EB",     bg:"#DBEAFE" },
  ];
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,maxWidth:560}}>
      {opts.map(o => {
        const on = value===o.value;
        return (
          <button key={o.value} onClick={()=>onChange(o.value)} style={{
            textAlign:"left",padding:"12px 16px",borderRadius:10,
            border:`1.5px solid ${on?o.color:PLX_BORDER}`,
            background:on?o.bg:"#fff",
            cursor:"pointer",fontFamily:"inherit",
            display:"flex",alignItems:"center",gap:11,
          }}>
            <span style={{
              width:18,height:18,borderRadius:"50%",border:`2px solid ${on?o.color:PLX_BORDER}`,
              background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
            }}>{on && <span style={{width:9,height:9,borderRadius:"50%",background:o.color}}/>}</span>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:on?o.color:PLX_TEXT}}>{o.label}</div>
              <div style={{fontSize:11,color:PLX_MUTED,marginTop:2}}>{o.sub}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* Re-declare FormSection to accept titleBadge */
function FormSectionV2({title,subtitle,rightAction,children,titleBadge}) {
  return (
    <div style={{background:"#fff",borderRadius:14,border:`1px solid ${PLX_BORDER}`,padding:"20px 22px"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:14,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center"}}>
          <h3 style={{fontSize:14,fontWeight:700,margin:0}}>{title}</h3>
          {titleBadge}
        </div>
        {subtitle && <div style={{fontSize:11,color:PLX_MUTED,marginLeft:0}}>{subtitle}</div>}
        <div style={{flex:1}}/>
        {rightAction && <button style={{background:"none",border:"none",color:PLX_GREEN,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{rightAction}</button>}
      </div>
      {children}
    </div>
  );
}

/* AI Assist modal — barcode-first */
function AiAssistModalV2({ onClose, onApply }) {
  const [phase, setPhase] = React.useState("input");
  const [mode, setMode] = React.useState("jan"); // jan | name
  const [jan, setJan] = React.useState("4548611112233");
  const [name, setName] = React.useState("");
  const [picks, setPicks] = React.useState({});

  React.useEffect(()=>{
    if (phase==="loading") {
      const t = setTimeout(()=>setPhase("results"), 1800);
      return ()=>clearTimeout(t);
    }
  }, [phase]);

  const togglePick = (field, opt) => setPicks(p => ({...p, [field]: p[field]?.id===opt.id ? null : opt}));
  const fields = [
    { key:"title",       label:"商品名 (title)" },
    { key:"brand",       label:"ブランド / 仕入先" },
    { key:"category",    label:"カテゴリ" },
    { key:"price",       label:"参考価格" },
    { key:"description", label:"説明文" },
  ];

  return (
    <div onClick={onClose} style={{
      position:"absolute",inset:0,background:"rgba(17,24,39,.45)",backdropFilter:"blur(4px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#fff",borderRadius:18,width:680,maxHeight:"86%",
        boxShadow:"0 24px 60px rgba(17,24,39,.22)",overflow:"hidden",display:"flex",flexDirection:"column",
      }}>
        <div style={{padding:"20px 26px 14px",borderBottom:`1px solid ${PLX_BORDER}`,display:"flex",alignItems:"center",gap:12}}>
          <div style={{
            width:36,height:36,borderRadius:10,background:PLX_GREEN_LIGHT,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN} strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div style={{flex:1}}>
            <SectionLabel>AI 商品アシスト</SectionLabel>
            <h3 style={{fontSize:16,fontWeight:700,margin:"3px 0 0"}}>AI で商品情報を自動入力</h3>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:PLX_MUTED,padding:6}}>×</button>
        </div>

        <div style={{padding:"20px 26px",overflow:"auto",flex:1}}>
          {phase==="input" && (
            <>
              {/* Mode toggle */}
              <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
                <div style={{display:"inline-flex",background:PLX_SURFACE,borderRadius:9999,padding:3,border:`1px solid ${PLX_BORDER}`}}>
                  {[{v:"jan",l:"ジャンルコード"},{v:"name",l:"商品名"}].map(o => {
                    const on = mode===o.v;
                    return (
                      <button key={o.v} onClick={()=>setMode(o.v)} style={{
                        fontSize:12,fontWeight:700,padding:"7px 18px",borderRadius:9999,border:"none",
                        background: on ? "#fff" : "transparent",
                        color: on ? PLX_GREEN : PLX_MUTED,
                        boxShadow: on ? "0 1px 3px rgba(0,0,0,.06)" : "none",
                        cursor:"pointer",fontFamily:"inherit",
                      }}>{o.l}</button>
                    );
                  })}
                </div>
              </div>

              {/* Search input — large */}
              <div style={{position:"relative",marginBottom:8}}>
                {mode==="jan" ? (
                  <>
                    <input value={jan} onChange={e=>setJan(e.target.value)} placeholder="例: 4901301234567" style={{
                      width:"100%",height:54,border:`1.5px solid ${PLX_GREEN_LIGHT}`,borderRadius:12,
                      padding:"0 130px 0 18px",fontSize:18,fontFamily:"ui-monospace,SFMono-Regular,monospace",
                      letterSpacing:".05em",outline:"none",background:"#fff",boxSizing:"border-box",
                      color:PLX_TEXT,fontWeight:600,
                    }}/>
                    <button disabled style={{
                      position:"absolute",right:6,top:6,height:42,padding:"0 14px",borderRadius:9,
                      background:"#F3F4F6",color:PLX_SUBTLE,border:"none",cursor:"not-allowed",
                      fontWeight:700,fontSize:12,fontFamily:"inherit",
                      display:"inline-flex",alignItems:"center",gap:6,
                    }}>
                      <span>📷 カメラで読み取る</span>
                      <span style={{fontSize:9,background:"#fff",color:PLX_MUTED,padding:"2px 6px",borderRadius:9999,border:`1px solid ${PLX_BORDER}`}}>準備中</span>
                    </button>
                  </>
                ) : (
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="例: GUM デンタルブラシ" style={{
                    width:"100%",height:54,border:`1.5px solid ${PLX_GREEN_LIGHT}`,borderRadius:12,
                    padding:"0 18px",fontSize:16,outline:"none",background:"#fff",boxSizing:"border-box",
                    color:PLX_TEXT,fontWeight:600,fontFamily:"inherit",
                  }}/>
                )}
              </div>
              <div style={{fontSize:11,color:PLX_MUTED,marginBottom:18,paddingLeft:4,display:"flex",alignItems:"center",gap:6}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>
                ジャンルコードでの検索の方が精度が高いです
              </div>

              <button onClick={()=>setPhase("loading")} style={{
                width:"100%",height:46,borderRadius:12,
                background:PLX_GREEN,color:"#fff",border:"none",fontWeight:700,fontSize:14,
                fontFamily:"inherit",cursor:"pointer",
                boxShadow:"0 6px 16px rgba(26,166,138,.25)",
                display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,
              }}>🔍 AI で検索</button>

              <div style={{
                background:PLX_GREEN_50,borderRadius:10,padding:"12px 14px",
                fontSize:11,color:PLX_MUTED,lineHeight:1.6,marginTop:14,
              }}>
                ※ AI による候補は参考情報です。価格・在庫など最終確定値は必ず担当者がご確認ください。
              </div>
            </>
          )}

          {phase==="loading" && (
            <div style={{padding:"50px 0",textAlign:"center"}}>
              <div style={{
                width:50,height:50,borderRadius:"50%",
                border:`4px solid ${PLX_GREEN_LIGHT}`,borderTop:`4px solid ${PLX_GREEN}`,
                margin:"0 auto 18px",animation:"plxspin 0.9s linear infinite",
              }}/>
              <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>AIが商品情報を検索中...</div>
              <div style={{fontSize:12,color:PLX_MUTED}}>{mode==="jan"?"ジャンルコードDB":"商品名"}・メーカーサイトを照合しています</div>
              <style>{`@keyframes plxspin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {phase==="results" && (
            <>
              <div style={{
                background:PLX_GREEN_50,border:`1px solid ${PLX_GREEN_LIGHT}`,borderRadius:10,padding:"10px 14px",
                fontSize:12,color:PLX_TEXT,marginBottom:16,display:"flex",alignItems:"center",gap:10,
              }}>
                <span style={{width:8,height:8,borderRadius:"50%",background:PLX_GREEN}}/>
                <b>5 項目で候補が見つかりました。</b>
                <span style={{color:PLX_MUTED}}>各項目で 1 つ選んで「適用」を押してください。</span>
              </div>
              {fields.map(f => (
                <div key={f.key} style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>
                    {f.label}
                    {picks[f.key] && <span style={{fontSize:9,fontWeight:700,color:PLX_GREEN,background:PLX_GREEN_LIGHT,padding:"2px 7px",borderRadius:9999}}>選択済</span>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {(MOCK_AI_SUGGESTIONS[f.key]||[]).map(opt => {
                      const on = picks[f.key]?.id === opt.id;
                      return (
                        <button key={opt.id} onClick={()=>togglePick(f.key,opt)} style={{
                          textAlign:"left",padding:"10px 14px",borderRadius:10,
                          border:`1px solid ${on?PLX_GREEN:PLX_BORDER}`,
                          background:on?PLX_GREEN_50:"#fff",
                          cursor:"pointer",fontFamily:"inherit",
                          display:"flex",alignItems:"center",gap:12,
                        }}>
                          <span style={{
                            width:14,height:14,borderRadius:4,border:`2px solid ${on?PLX_GREEN:PLX_BORDER}`,
                            background:on?PLX_GREEN:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                          }}>{on && <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M1.5 4.5L3.5 6.5L7.5 2"/></svg>}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:PLX_TEXT}}>{opt.value}</div>
                            <div style={{fontSize:10,color:PLX_MUTED,marginTop:3}}>出典: {opt.source}</div>
                          </div>
                          <ConfBar val={opt.confidence}/>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{padding:"14px 26px",borderTop:`1px solid ${PLX_BORDER}`,display:"flex",alignItems:"center",gap:10,background:PLX_SURFACE}}>
          <span style={{fontSize:11,color:PLX_MUTED,flex:1}}>
            {phase==="results" && `${Object.keys(picks).filter(k=>picks[k]).length} / ${fields.length} 項目を選択中`}
          </span>
          <button onClick={onClose} style={btnGhost}>キャンセル</button>
          {phase==="results" && <button onClick={()=>onApply(picks)} disabled={!Object.keys(picks).filter(k=>picks[k]).length}
            style={{...btnPrimary,opacity:Object.keys(picks).filter(k=>picks[k]).length?1:.5}}>選択した項目を適用 →</button>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProductCreateV2, AiAssistModalV2, ItemKindToggle, FormSectionV2 });
