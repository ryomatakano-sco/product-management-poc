// Product Create/Edit screen — form with AI Assist button & modal
function ProductCreate({ onCancel }) {
  const [name, setName] = React.useState("");
  const [nameKana, setNameKana] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [vendorId, setVendorId] = React.useState("");
  const [status, setStatus] = React.useState("draft");
  const [tags, setTags] = React.useState([]);
  const [tagInput, setTagInput] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [advanced, setAdvanced] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);

  const [variant, setVariant] = React.useState({
    sku:"", barcode:"", price:"", cost:"", stock:"",
    opt1k:"", opt1v:"", opt2k:"", opt2v:"", isDefault:true,
  });

  const [images, setImages] = React.useState([{ url:"", position:1 }]);

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
        {/* Main column */}
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
              <div style={{fontSize:12,color:PLX_MUTED,marginTop:2,lineHeight:1.6}}>JAN コードまたは商品名を入力すると、AI が公開情報から候補を取得します。手入力の手間を約 <span style={{color:PLX_GREEN,fontWeight:700}}>80%</span> 削減できます。</div>
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
          <FormSection title="基本情報" subtitle="商品の基本となる情報を入力します">
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
                  onKeyDown={e=>{
                    if (e.key==="Enter" && tagInput.trim()) {
                      setTags([...tags,tagInput.trim()]);
                      setTagInput("");
                      e.preventDefault();
                    }
                  }}
                  placeholder={tags.length?"":"タグを入力して Enter で追加"}
                  style={{border:"none",outline:"none",fontSize:12,fontFamily:"inherit",flex:1,minWidth:120,padding:"4px 0"}}/>
              </div>
              <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:PLX_MUTED,fontWeight:600,marginRight:4}}>よく使うタグ:</span>
                {MOCK_TAGS.slice(0,5).map(t => (
                  <button key={t} onClick={()=>!tags.includes(t)&&setTags([...tags,t])} style={{
                    fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:9999,
                    border:`1px dashed ${PLX_BORDER}`,background:"#fff",color:PLX_MUTED,cursor:"pointer",fontFamily:"inherit",
                  }}>＋ {t}</button>
                ))}
              </div>
            </FormRow>
          </FormSection>

          {/* Variant */}
          <FormSection title="バリアント" subtitle="SKU・価格・初期在庫" rightAction="＋ もう一つのバリアントを追加">
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
            <div style={{
              background:PLX_GREEN_50,borderRadius:10,padding:"12px 14px",marginTop:6,
              fontSize:11,color:PLX_MUTED,lineHeight:1.6,
            }}>
              ヒント: バリアントを使うとサイズ・色・容量などのオプションを 1 商品で管理できます。例：「サイズ：50ml / 75ml / 130ml」
            </div>
            <FormRow label="オプション 1（任意）">
              <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10}}>
                <input placeholder="ラベル（例: サイズ）" value={variant.opt1k} onChange={e=>setVariant({...variant,opt1k:e.target.value})} style={formInput}/>
                <input placeholder="値（例: 75ml）" value={variant.opt1v} onChange={e=>setVariant({...variant,opt1v:e.target.value})} style={formInput}/>
              </div>
            </FormRow>
            <label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,cursor:"pointer",marginTop:4}}>
              <input type="checkbox" checked={variant.isDefault} onChange={e=>setVariant({...variant,isDefault:e.target.checked})} style={{accentColor:PLX_GREEN}}/>
              このバリアントをデフォルトに設定
            </label>
          </FormSection>

          {/* Images */}
          <FormSection title="商品画像" subtitle="複数枚アップロード可（先頭が代表画像）">
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {images.map((img,i)=>(
                <div key={i} style={{
                  width:120,height:120,border:`1px solid ${PLX_BORDER}`,borderRadius:10,
                  background:PLX_GREEN_50,display:"flex",alignItems:"center",justifyContent:"center",
                  position:"relative",
                }}>
                  <span style={{position:"absolute",top:6,left:6,fontSize:9,fontWeight:700,color:PLX_GREEN,background:"#fff",padding:"2px 7px",borderRadius:9999,border:`1px solid ${PLX_GREEN_LIGHT}`}}>#{img.position}</span>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              ))}
              <button onClick={()=>setImages([...images,{url:"",position:images.length+1}])} style={{
                width:120,height:120,border:`1.5px dashed ${PLX_BORDER}`,borderRadius:10,
                background:"#fff",cursor:"pointer",fontFamily:"inherit",color:PLX_MUTED,fontSize:11,
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,
              }}>
                <span style={{fontSize:24,color:PLX_GREEN,fontWeight:300}}>＋</span>
                画像を追加
              </button>
            </div>
          </FormSection>

          {/* Advanced */}
          <div style={{background:"#fff",borderRadius:14,border:`1px solid ${PLX_BORDER}`}}>
            <button onClick={()=>setAdvanced(!advanced)} style={{
              width:"100%",padding:"16px 22px",background:"none",border:"none",cursor:"pointer",
              fontFamily:"inherit",fontSize:13,fontWeight:700,textAlign:"left",
              display:"flex",alignItems:"center",gap:10,color:PLX_TEXT,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PLX_MUTED} strokeWidth="2" strokeLinecap="round" style={{transform:advanced?"rotate(90deg)":"none",transition:"transform .15s"}}><polyline points="9 18 15 12 9 6"/></svg>
              詳細設定（保険適用・既定額など）
              <span style={{fontSize:11,color:PLX_MUTED,fontWeight:500,marginLeft:6}}>レガシー項目</span>
            </button>
            {advanced && (
              <div style={{padding:"4px 22px 18px",borderTop:`1px solid ${PLX_BORDER}`}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
                  <FormRow label="default_amount_at_payment">
                    <input placeholder="0" style={formInput}/>
                  </FormRow>
                  <FormRow label="default_insurance_point_at_payment">
                    <input placeholder="0" style={formInput}/>
                  </FormRow>
                </div>
                <div style={{display:"flex",gap:24}}>
                  <label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,cursor:"pointer"}}>
                    <input type="checkbox" style={{accentColor:PLX_GREEN}}/>is_insurable（保険適用）
                  </label>
                  <label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,cursor:"pointer"}}>
                    <input type="checkbox" style={{accentColor:PLX_GREEN}}/>is_pinned（ピン留め）
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          <FormSection title="ステータス">
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <RadioRow checked={status==="active"} onClick={()=>setStatus("active")} label="公開中" sub="商品一覧に表示し、販売記録から選択できるようにします。"/>
              <RadioRow checked={status==="draft"} onClick={()=>setStatus("draft")} label="下書き" sub="保存のみ。一覧には表示されません。"/>
            </div>
          </FormSection>

          <FormSection title="プレビュー">
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
                <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name || "商品名（未入力）"}</div>
                <div style={{fontSize:10,color:PLX_SUBTLE,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{nameKana || "—"}</div>
                <div style={{fontSize:13,fontWeight:700,marginTop:8,color:PLX_GREEN,fontVariantNumeric:"tabular-nums"}}>¥{variant.price || "0"}</div>
              </div>
            </div>
            <div style={{fontSize:11,color:PLX_MUTED,marginTop:10,lineHeight:1.6}}>
              一覧画面に表示される簡易プレビューです。入力に応じてリアルタイムに更新されます。
            </div>
          </FormSection>

          <div style={{
            background:PLX_GREEN_50,borderRadius:14,padding:"16px 18px",border:`1px solid ${PLX_GREEN_LIGHT}`,
          }}>
            <SectionLabel>ヘルプ</SectionLabel>
            <div style={{fontSize:12,color:PLX_TEXT,marginTop:6,lineHeight:1.7}}>
              商品登録で迷ったら、まず <b>AI で入力</b> をお試しください。JAN コードがあれば 9 割の項目が自動入力されます。
            </div>
          </div>
        </div>
      </div>

      {aiOpen && <AiAssistModal onClose={()=>setAiOpen(false)} onApply={applyAi}/>}
    </AdminShell>
  );
}

function FormSection({title,subtitle,rightAction,children}) {
  return (
    <div style={{background:"#fff",borderRadius:14,border:`1px solid ${PLX_BORDER}`,padding:"20px 22px"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:14,marginBottom:14}}>
        <div>
          <h3 style={{fontSize:14,fontWeight:700,margin:0}}>{title}</h3>
          {subtitle && <div style={{fontSize:11,color:PLX_MUTED,marginTop:3}}>{subtitle}</div>}
        </div>
        <div style={{flex:1}}/>
        {rightAction && <button style={{background:"none",border:"none",color:PLX_GREEN,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{rightAction}</button>}
      </div>
      {children}
    </div>
  );
}

function RadioRow({checked,onClick,label,sub}) {
  return (
    <button onClick={onClick} style={{
      textAlign:"left",padding:"12px 14px",borderRadius:10,
      border:`1px solid ${checked?PLX_GREEN:PLX_BORDER}`,
      background:checked?PLX_GREEN_50:"#fff",
      cursor:"pointer",fontFamily:"inherit",
      display:"flex",gap:11,alignItems:"flex-start",
    }}>
      <span style={{
        width:16,height:16,borderRadius:"50%",border:`2px solid ${checked?PLX_GREEN:PLX_BORDER}`,
        background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2,
      }}>{checked && <span style={{width:8,height:8,borderRadius:"50%",background:PLX_GREEN}}/>}</span>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:checked?PLX_GREEN:PLX_TEXT}}>{label}</div>
        <div style={{fontSize:11,color:PLX_MUTED,marginTop:2,lineHeight:1.5}}>{sub}</div>
      </div>
    </button>
  );
}

// AI Assist modal
function AiAssistModal({ onClose, onApply }) {
  const [phase, setPhase] = React.useState("input"); // input | loading | results | error
  const [jan, setJan] = React.useState("4548611112233");
  const [name, setName] = React.useState("");
  const [picks, setPicks] = React.useState({});

  React.useEffect(()=>{
    if (phase==="loading") {
      const t = setTimeout(()=>setPhase("results"), 2200);
      return ()=>clearTimeout(t);
    }
  }, [phase]);

  const lookup = () => { setPhase("loading"); };
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
              <div style={{fontSize:13,color:PLX_TEXT,marginBottom:18,lineHeight:1.7}}>
                JAN コード（バーコード）または商品名を入力してください。AI が公開情報から候補を取得し、候補の中から選んで商品フォームに反映できます。
              </div>
              <FormRow label="JAN コード（バーコード）">
                <input value={jan} onChange={e=>setJan(e.target.value)} placeholder="4987246012001" style={{...formInput,fontFamily:"ui-monospace,SFMono-Regular,monospace",letterSpacing:".05em"}}/>
              </FormRow>
              <FormRow label="商品名（任意 · JAN がない場合に利用）">
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="例：パナビア V5 ペースト" style={formInput}/>
              </FormRow>
              <div style={{
                background:PLX_GREEN_50,borderRadius:10,padding:"10px 14px",
                fontSize:11,color:PLX_MUTED,lineHeight:1.6,marginTop:6,
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
              <div style={{fontSize:12,color:PLX_MUTED}}>公開情報・JANデータベース・メーカーサイトを照合しています</div>
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
          {phase==="input" && <button onClick={lookup} style={btnPrimary}>🔍 候補を検索</button>}
          {phase==="results" && <button onClick={()=>onApply(picks)} disabled={!Object.keys(picks).filter(k=>picks[k]).length}
            style={{...btnPrimary,opacity:Object.keys(picks).filter(k=>picks[k]).length?1:.5}}>選択した項目を適用 →</button>}
        </div>
      </div>
    </div>
  );
}

function ConfBar({val}) {
  const pct = Math.round(val*100);
  return (
    <div style={{minWidth:78,textAlign:"right"}}>
      <div style={{fontSize:11,fontWeight:700,color:val>0.85?PLX_GREEN:val>0.7?"#D97706":PLX_MUTED}}>{pct}%</div>
      <div style={{height:3,background:"#F3F4F6",borderRadius:2,marginTop:3,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:val>0.85?PLX_GREEN:val>0.7?"#D97706":PLX_MUTED,borderRadius:2}}/>
      </div>
    </div>
  );
}

Object.assign(window, { ProductCreate });
