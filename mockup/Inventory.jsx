// Inventory — KPIs, filters, table, adjustment history (§4.6)

function Inventory() {
  const rows = [
    { name:"サンスター GUM プロケア デンタルブラシ #211", sku:"PLX-T-00148", branch:"本院", kind:"物販品", oh:47, com:3, av:44, by:"2026/05/08 14:22 山田 花子", state:{tone:"green",text:"通常"} },
    { name:"クリニカアドバンテージ ハミガキ クールミント 130g", sku:"PLX-T-00203", branch:"本院", kind:"物販品", oh:6, com:0, av:6, by:"2026/05/10 09:15 鈴木 由香", state:{tone:"amber",text:"在庫低下"} },
    { name:"グローブ ニトリル パウダーフリー Mサイズ 100枚入", sku:"PLX-C-00091", branch:"本院", kind:"消耗品", oh:32, com:0, av:32, expiry:"2026/06/28", by:"2026/05/09 11:40 佐藤 健", state:{tone:"red",text:"期限間近"} },
    { name:"アルジネート印象材 ファストセット 500g", sku:"PLX-C-00012", branch:"分院 梅田", kind:"消耗品", oh:18, com:2, av:16, expiry:"2026/06/15", by:"2026/05/07 16:50 山口 さくら", state:{tone:"red",text:"期限間近"} },
    { name:"表面麻酔ジェル 30g バナナフレーバー", sku:"PLX-C-00177", branch:"本院", kind:"消耗品", oh:4, com:0, av:4, by:"2026/05/06 10:08 佐藤 健", state:{tone:"amber",text:"在庫低下"} },
    { name:"リステリン トータルケアプラス 1000mL", sku:"PLX-T-00306", branch:"分院 梅田", kind:"物販品", oh:22, com:1, av:21, by:"2026/05/05 14:00 山口 さくら", state:{tone:"green",text:"通常"} },
    { name:"デンタルフロス ワックス 50m × 3個セット", sku:"PLX-T-00422", branch:"本院", kind:"物販品", oh:89, com:5, av:84, by:"2026/05/04 09:30 山田 花子", state:{tone:"green",text:"通常"} },
    { name:"子供用歯ブラシ クマさんカラー 3本セット", sku:"PLX-T-00099", branch:"本院", kind:"物販品", oh:0, com:0, av:0, by:"2026/05/03 17:22 鈴木 由香", state:{tone:"red",text:"在庫切れ"} },
    { name:"高圧蒸気滅菌バッグ 90×260mm 200枚入", sku:"PLX-C-00208", branch:"分院 梅田", kind:"消耗品", oh:15, com:0, av:15, by:"2026/05/02 13:10 山口 さくら", state:{tone:"green",text:"通常"} },
    { name:"ホワイトニングジェル 10% 過酸化尿素 1.2mL × 4本", sku:"PLX-T-00510", branch:"本院", kind:"物販品", oh:7, com:1, av:6, by:"2026/05/01 11:00 山田 花子", state:{tone:"amber",text:"在庫低下"} },
  ];
  return (
    <AppShell current="inventory" breadcrumbs={["ホーム","在庫"]}>
      <PageHead title="在庫" subtitle="全 312 商品 ／ 2 拠点の在庫状況"
        right={<><Btn icon="download">棚卸しCSVダウンロード</Btn><Btn kind="primary" icon="plus">在庫調整</Btn></>}/>
      {/* KPI strip */}
      <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:24, marginBottom:20}}>
        <KPITile label="総在庫点数" v="4,832" sub="点" chip={{tone:"neutral", text:"2 拠点合計"}}/>
        <KPITile label="在庫金額 (税抜)" v="¥2,847,600" chip={{tone:"green", text:"+4.2% 先月比"}}/>
        <KPITile label="在庫低下" v="8件" chip={{tone:"amber", text:"要対応"}}/>
        <KPITile label="期限間近" v="5件" chip={{tone:"red", text:"60日以内"}}/>
      </div>
      {/* Filter */}
      <Card pad={20} style={{marginBottom:12}}>
        <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center"}}>
          <SearchInput w={280} placeholder="商品名・SKU・JANで検索"/>
          <PlxSelect label="拠点" v="すべて"/>
          <PlxSelect label="カテゴリ" v="すべて"/>
          <PlxSelect label="状態" v="すべて"/>
          <PlxSelect label="種別" v="すべて"/>
          <PlxSelect label="並び順" v="更新日(新しい順)"/>
          <Btn kind="ghost">フィルタをクリア</Btn>
        </div>
      </Card>
      {/* Quick chips */}
      <div style={{display:"flex", gap:8, marginBottom:16}}>
        <QChip active>すべて<C>312</C></QChip>
        <QChip>在庫低下<C>8</C></QChip>
        <QChip>期限間近<C>5</C></QChip>
        <QChip>通常<C>299</C></QChip>
        <QChip>引当あり<C>47</C></QChip>
      </div>
      {/* Bulk action bar */}
      <div style={{background: T.PLX_GREEN_100, border:`1px solid ${T.PLX_GREEN_300}`, borderRadius: T.RADIUS_MD,
        padding:"10px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:12}}>
        <Chip tone="green">2 件選択中</Chip>
        <Btn>一括調整</Btn><Btn>一括発注</Btn>
        <div style={{flex:1}}/>
        <Btn kind="ghost">選択をクリア</Btn>
      </div>
      {/* Table */}
      <Card pad={0}>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background: T.PLX_SURFACE_50}}>
              <Th style={{width:40}}>□</Th>
              <Th>商品名 / SKU</Th>
              <Th>拠点</Th>
              <Th>種別</Th>
              <Th align="right">在庫数</Th>
              <Th align="right">引当中</Th>
              <Th align="right">利用可能</Th>
              <Th>最終調整</Th>
              <Th>状態</Th>
              <Th style={{width:56}}></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} style={{borderTop:`1px solid ${T.PLX_LINE_100}`, height:56,
                background: i%2 ? "transparent" : T.PLX_SURFACE_50}}>
                <Td><input type="checkbox" checked={i<2} readOnly/></Td>
                <Td>
                  <div style={{fontSize:13, color: T.PLX_INK_900, fontWeight:500}}>{r.name}</div>
                  <div style={{fontSize:11, color: T.PLX_INK_500, fontFamily: T.FONT_MONO, marginTop:2}}>{r.sku}</div>
                </Td>
                <Td>{r.branch}</Td>
                <Td><Chip tone={r.kind==="消耗品"?"blue":"green"}>{r.kind}</Chip></Td>
                <Td align="right" mono>
                  {r.expiry ? <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
                    {r.oh}
                    <Ico size={12} color={T.PLX_AMBER_600}>{ICONS.clock}</Ico>
                  </span> : r.oh}
                  {r.expiry && <div style={{fontSize:11, color: T.PLX_AMBER_600, marginTop:2}}>{r.expiry} まで</div>}
                </Td>
                <Td align="right" mono style={{color: T.PLX_INK_500}}>{r.com}</Td>
                <Td align="right" mono style={{fontWeight:600}}>{r.av}</Td>
                <Td style={{fontSize:12, color: T.PLX_INK_500}}>{r.by}</Td>
                <Td><Chip tone={r.state.tone}>{r.state.text}</Chip></Td>
                <Td><Ico size={16} color={T.PLX_INK_400}>{ICONS.more}</Ico></Td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        <div style={{padding:"14px 20px", borderTop:`1px solid ${T.PLX_LINE_100}`, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div style={{fontSize:12, color: T.PLX_INK_500}}>表示件数 25 ▼</div>
          <div style={{fontSize:13, color: T.PLX_INK_700, display:"flex", alignItems:"center", gap:12}}>
            <span>1 - 10 件 / 全 312 件</span>
            <Btn kind="ghost" icon="arrowL">前へ</Btn>
            <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
              <PageBtn active>1</PageBtn><PageBtn>2</PageBtn><PageBtn>3</PageBtn>
              <span style={{color: T.PLX_INK_400}}>…</span><PageBtn>32</PageBtn>
            </span>
            <Btn>次へ →</Btn>
          </div>
        </div>
      </Card>
      {/* History */}
      <div style={{marginTop:24}}>
        <Card pad={0}>
          <div style={{padding:"18px 20px", borderBottom:`1px solid ${T.PLX_LINE_100}`, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <div style={{fontSize:16, fontWeight:600}}>最近の調整履歴</div>
            <Ico size={16} color={T.PLX_INK_500}>{ICONS.chevD}</Ico>
          </div>
          <table style={{width:"100%", borderCollapse:"collapse"}}>
            <thead><tr style={{background: T.PLX_SURFACE_50}}>
              <Th>日時</Th><Th>拠点</Th><Th>商品名</Th><Th>タイプ</Th><Th align="right">数量</Th><Th>担当者</Th>
            </tr></thead>
            <tbody>
              {[
                ["2026/05/12 14:22","本院","サンスター GUM プロケア デンタルブラシ #211",{tone:"green",text:"入庫"},"+50","山田 花子"],
                ["2026/05/12 11:30","分院 梅田","アルジネート印象材 ファストセット 500g",{tone:"blue",text:"出庫"},"-2","山口 さくら"],
                ["2026/05/11 17:15","本院","クリニカアドバンテージ ハミガキ 130g",{tone:"neutral",text:"棚卸し補正"},"-1","鈴木 由香"],
                ["2026/05/11 09:00","本院","グローブ ニトリル Mサイズ",{tone:"green",text:"入庫"},"+200","佐藤 健"],
                ["2026/05/10 16:42","分院 梅田","リステリン トータルケアプラス 1000mL",{tone:"purple",text:"移動"},"-4","山口 さくら"],
                ["2026/05/10 10:08","本院","表面麻酔ジェル 30g",{tone:"blue",text:"出庫"},"-1","佐藤 健"],
                ["2026/05/09 18:00","本院","デンタルフロス ワックス 50m × 3個セット",{tone:"green",text:"入庫"},"+30","山田 花子"],
                ["2026/05/09 13:30","本院","ホワイトニングジェル 10%",{tone:"blue",text:"出庫"},"-3","山田 花子"],
              ].map((r,i)=>(
                <tr key={i} style={{borderTop:`1px solid ${T.PLX_LINE_100}`}}>
                  <Td>{r[0]}</Td><Td>{r[1]}</Td><Td>{r[2]}</Td>
                  <Td><Chip tone={r[3].tone}>{r[3].text}</Chip></Td>
                  <Td align="right" mono style={{fontWeight:600, color: r[4].startsWith("+") ? T.PLX_GREEN_700 : T.PLX_INK_900}}>{r[4]}</Td>
                  <Td>{r[5]}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}

function KPITile({ label, v, sub, chip }) {
  return (
    <Card pad={20}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
        <div style={{fontSize:12, color: T.PLX_INK_500, fontWeight:500}}>{label}</div>
        <Ico size={16} color={T.PLX_INK_400}>{ICONS.boxes}</Ico>
      </div>
      <div style={{marginTop:8, fontSize:26, fontWeight:700, color: T.PLX_INK_900, letterSpacing:"-0.01em"}}>
        {v}{sub && <span style={{fontSize:14, fontWeight:500, color: T.PLX_INK_500, marginLeft:4}}>{sub}</span>}
      </div>
      <div style={{marginTop:10}}><Chip tone={chip.tone}>{chip.text}</Chip></div>
    </Card>
  );
}
function SearchInput({ w = 240, placeholder }) {
  return (
    <div style={{position:"relative", width:w}}>
      <input placeholder={placeholder} style={{width:"100%", height:36, padding:"0 12px 0 36px",
        fontSize:13, fontFamily:"inherit", border:`1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_MD,
        background:"#fff", outline:"none"}}/>
      <div style={{position:"absolute", left:12, top:10}}><Ico size={16} color={T.PLX_INK_500}>{ICONS.search}</Ico></div>
    </div>
  );
}
function PlxSelect({ label, v }) {
  return (
    <button style={{display:"inline-flex", alignItems:"center", gap:8, height:36, padding:"0 12px",
      background:"#fff", border:`1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_MD,
      fontFamily:"inherit", fontSize:13, color: T.PLX_INK_700, cursor:"pointer"}}>
      <span style={{color: T.PLX_INK_500, fontWeight:500}}>{label}:</span>
      <span style={{fontWeight:600}}>{v}</span>
      <Ico size={14} color={T.PLX_INK_500}>{ICONS.chevD}</Ico>
    </button>
  );
}
function QChip({ active, children }) {
  return (
    <span style={{display:"inline-flex", alignItems:"center", gap:6, height:28, padding:"0 12px",
      borderRadius:999, fontSize:12, fontWeight:600, cursor:"pointer",
      background: active ? T.PLX_GREEN_100 : T.PLX_SURFACE_100,
      color: active ? T.PLX_GREEN_700 : T.PLX_INK_700,
      border: active ? `1px solid ${T.PLX_GREEN_300}` : "1px solid transparent"}}>{children}</span>
  );
}
function C({ children }) {
  return <span style={{color: T.PLX_INK_500, fontWeight:500, marginLeft:4}}>({children})</span>;
}
function PageBtn({ active, children }) {
  return (
    <button style={{width:32, height:32, borderRadius:8, border:"none",
      background: active ? T.PLX_GREEN_100 : "transparent", color: active ? T.PLX_GREEN_700 : T.PLX_INK_700,
      fontWeight: active ? 700 : 500, fontSize:13, cursor:"pointer", fontFamily:"inherit"}}>{children}</button>
  );
}

Object.assign(window, { Inventory, KPITile, SearchInput, PlxSelect, QChip, C, PageBtn });
