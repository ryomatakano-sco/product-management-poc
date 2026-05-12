// Purchase Orders — list + detail (§4.7)

function PurchaseOrders() {
  const rows = [
    ["PO-2026-0048","サンスター株式会社","2026/05/10","2026/05/17",6,"¥84,560",{tone:"amber",text:"一部入荷"},"山田 花子"],
    ["PO-2026-0047","GC株式会社","2026/05/09","2026/05/14",4,"¥142,800",{tone:"green",text:"入荷済み"},"佐藤 健"],
    ["PO-2026-0046","ライオン歯科材株式会社","2026/05/08","2026/05/16",8,"¥68,400",{tone:"blue",text:"送信済み"},"山田 花子"],
    ["PO-2026-0045","ヘンリーシャイン・ジャパン","2026/05/07","2026/05/20",12,"¥248,000",{tone:"blue",text:"送信済み"},"鈴木 由香"],
    ["PO-2026-0044","モリタ製作所","2026/05/05","2026/05/15",2,"¥184,200",{tone:"green",text:"入荷済み"},"佐藤 健"],
    ["PO-2026-0043","サンスター株式会社","2026/05/04","—",5,"¥42,000",{tone:"neutral",text:"下書き"},"山田 花子"],
    ["PO-2026-0042","クラレノリタケデンタル","2026/05/02","2026/05/10",3,"¥38,400",{tone:"red",text:"キャンセル"},"鈴木 由香"],
    ["PO-2026-0041","GC株式会社","2026/05/01","2026/05/12",7,"¥98,600",{tone:"amber",text:"一部入荷"},"佐藤 健"],
  ];
  return (
    <AppShell current="po" breadcrumbs={["ホーム","発注書"]}>
      <PageHead title="発注書" subtitle="全 47 件の発注書"
        right={<><Btn icon="download">CSVエクスポート</Btn><Btn kind="primary" icon="plus">発注書を作成</Btn></>}/>
      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:24, marginBottom:20}}>
        <KPITile label="今月の発注件数" v="12" sub="件" chip={{tone:"green", text:"+3 先月比"}}/>
        <KPITile label="今月の発注金額" v="¥847,200" chip={{tone:"green", text:"+8.4%"}}/>
        <KPITile label="入荷待ち" v="5件" chip={{tone:"blue", text:"送信済み"}}/>
        <KPITile label="一部入荷" v="2件" chip={{tone:"amber", text:"確認推奨"}}/>
      </div>
      <Card pad={20} style={{marginBottom:12}}>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          <SearchInput w={300} placeholder="発注番号・仕入先で検索"/>
          <PlxSelect label="状態" v="すべて"/>
          <PlxSelect label="仕入先" v="すべて"/>
          <PlxSelect label="期間" v="今月"/>
          <PlxSelect label="拠点" v="すべて"/>
        </div>
      </Card>
      <div style={{display:"flex", gap:8, marginBottom:16}}>
        <QChip active>すべて<C>47</C></QChip>
        <QChip>下書き<C>3</C></QChip>
        <QChip>送信済み<C>5</C></QChip>
        <QChip>一部入荷<C>2</C></QChip>
        <QChip>入荷済み<C>35</C></QChip>
        <QChip>キャンセル<C>2</C></QChip>
      </div>
      <Card pad={0}>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead><tr style={{background: T.PLX_SURFACE_50}}>
            <Th>発注番号</Th><Th>仕入先</Th><Th>発注日</Th><Th>納品予定日</Th>
            <Th align="right">品目数</Th><Th align="right">合計 (税込)</Th><Th>状態</Th><Th>担当者</Th><Th style={{width:48}}></Th>
          </tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={i} style={{borderTop:`1px solid ${T.PLX_LINE_100}`, height:56,
              background: i%2 ? "transparent" : T.PLX_SURFACE_50}}>
              <Td mono style={{fontWeight:600, color: T.PLX_GREEN_700}}>{r[0]}</Td>
              <Td>{r[1]}</Td><Td>{r[2]}</Td><Td>{r[3]}</Td>
              <Td align="right" mono>{r[4]}</Td>
              <Td align="right" mono style={{fontWeight:600}}>{r[5]}</Td>
              <Td><Chip tone={r[6].tone}>{r[6].text}</Chip></Td>
              <Td>{r[7]}</Td>
              <Td><Ico size={16} color={T.PLX_INK_400}>{ICONS.more}</Ico></Td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </AppShell>
  );
}

function PurchaseOrderDetail() {
  return (
    <AppShell current="po" breadcrumbs={["ホーム","発注書","PO-2026-0048"]}>
      <Card style={{marginBottom:20}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:32}}>
          <div>
            <div style={{fontSize:11, color: T.PLX_INK_500, fontWeight:600, letterSpacing:"0.05em", marginBottom:6}}>発注番号</div>
            <div style={{fontSize:22, fontWeight:700, color: T.PLX_INK_900, fontFamily: T.FONT_MONO, letterSpacing:"-0.01em"}}>PO-2026-0048</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:18, marginTop:20}}>
              <Stat label="仕入先" v="サンスター株式会社"/>
              <Stat label="発注日" v="2026/05/10"/>
              <Stat label="納品予定日" v="2026/05/17"/>
              <Stat label="担当者" v="山田 花子"/>
            </div>
            <div style={{marginTop:20}}>
              <div style={{fontSize:11, color: T.PLX_INK_500, fontWeight:600, marginBottom:6}}>合計金額 (税込)</div>
              <div style={{fontSize:32, fontWeight:700, color: T.PLX_INK_900, letterSpacing:"-0.02em"}}>¥84,880</div>
            </div>
          </div>
          <div>
            <div style={{display:"flex", justifyContent:"flex-end", marginBottom:18}}>
              <Chip tone="amber" style={{height:28, padding:"0 14px", fontSize:13}}>一部入荷</Chip>
            </div>
            <div style={{background: T.PLX_SURFACE_50, borderRadius: T.RADIUS_MD, padding:20}}>
              <div style={{fontSize:12, color: T.PLX_INK_500, fontWeight:600, marginBottom:14}}>発注ステータス</div>
              <Timeline steps={["下書き","送信済み","一部入荷","入荷済み"]} active={2}/>
            </div>
          </div>
        </div>
      </Card>
      <div style={{display:"flex", gap:8, marginBottom:20}}>
        <Btn>📧 メール送信</Btn>
        <Btn icon="download">PDFダウンロード</Btn>
        <Btn icon="edit">編集</Btn>
        <div style={{flex:1}}/>
        <Btn kind="primary" icon="check">入荷を記録</Btn>
        <Btn kind="dangerGhost" icon="x">キャンセル</Btn>
      </div>
      <Card pad={0} style={{marginBottom:20}}>
        <div style={{padding:"18px 20px", borderBottom:`1px solid ${T.PLX_LINE_100}`, fontSize:16, fontWeight:600}}>明細</div>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead><tr style={{background: T.PLX_SURFACE_50}}>
            <Th style={{width:40}}>#</Th><Th>商品名</Th><Th>SKU</Th>
            <Th align="right">単価</Th><Th align="right">数量</Th><Th align="right">入荷済み</Th><Th align="right">合計</Th>
          </tr></thead>
          <tbody>{[
            ["1","サンスター GUM プロケア デンタルブラシ #211","PLX-T-00148","¥220","100","100","¥22,000"],
            ["2","クリニカアドバンテージ ハミガキ クールミント 130g","PLX-T-00203","¥340","50","50","¥17,000"],
            ["3","リステリン トータルケアプラス 1000mL","PLX-T-00306","¥1,140","24","12","¥27,360"],
            ["4","デンタルフロス ワックス 50m × 3個セット","PLX-T-00422","¥440","30","0","¥13,200"],
            ["5","子供用歯ブラシ クマさんカラー 3本セット","PLX-T-00099","¥380","20","0","¥7,600"],
          ].map((r,i)=>(
            <tr key={i} style={{borderTop:`1px solid ${T.PLX_LINE_100}`}}>
              <Td style={{color:T.PLX_INK_500}}>{r[0]}</Td>
              <Td>{r[1]}</Td>
              <Td mono style={{color:T.PLX_INK_500, fontSize:12}}>{r[2]}</Td>
              <Td align="right" mono>{r[3]}</Td>
              <Td align="right" mono>{r[4]}</Td>
              <Td align="right" mono style={{color: r[5]==="0"?T.PLX_INK_400:T.PLX_GREEN_700, fontWeight:600}}>{r[5]}</Td>
              <Td align="right" mono style={{fontWeight:600}}>{r[6]}</Td>
            </tr>
          ))}</tbody>
          <tfoot>
            <SumRow label="小計" v="¥87,160"/>
            <SumRow label="値引き" v="-¥10,000" red/>
            <SumRow label="消費税 (10%)" v="¥7,720"/>
            <SumRow label="合計" v="¥84,880" big/>
          </tfoot>
        </table>
      </Card>
      <Card>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:16, fontWeight:600}}>配送追跡</div>
            <div style={{marginTop:6, fontSize:13, color: T.PLX_INK_500}}>
              ヤマト運輸 ／ 追跡番号 <span style={{fontFamily: T.FONT_MONO}}>1234-5678-9012</span> ／ 予定: 2026/05/17 午前中
            </div>
          </div>
          <Btn icon="ext">追跡を確認</Btn>
        </div>
      </Card>
    </AppShell>
  );
}

function Stat({ label, v }) {
  return (
    <div>
      <div style={{fontSize:11, color: T.PLX_INK_500, fontWeight:600, marginBottom:4}}>{label}</div>
      <div style={{fontSize:14, color: T.PLX_INK_900, fontWeight:500}}>{v}</div>
    </div>
  );
}

function Timeline({ steps, active }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:0}}>
      {steps.map((s,i)=>(
        <React.Fragment key={i}>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:6, flexShrink:0}}>
            <div style={{width:24, height:24, borderRadius:"50%",
              background: i<=active ? T.PLX_GREEN_600 : T.PLX_LINE_200,
              color:"#fff", fontSize:11, fontWeight:700,
              display:"flex", alignItems:"center", justifyContent:"center"}}>
              {i<=active ? <Ico size={14} color="#fff">{ICONS.check}</Ico> : i+1}
            </div>
            <div style={{fontSize:11, fontWeight: i===active?700:500,
              color: i===active ? T.PLX_GREEN_700 : T.PLX_INK_500, whiteSpace:"nowrap"}}>{s}</div>
          </div>
          {i<steps.length-1 && <div style={{flex:1, height:2, marginTop:-18,
            background: i<active ? T.PLX_GREEN_500 : T.PLX_LINE_200}}/>}
        </React.Fragment>
      ))}
    </div>
  );
}

function SumRow({ label, v, red, big }) {
  return (
    <tr style={{borderTop:`1px solid ${T.PLX_LINE_100}`, background: big ? T.PLX_SURFACE_50 : "transparent"}}>
      <td colSpan="5"></td>
      <td style={{padding:"10px 16px", textAlign:"right", fontSize: big?14:13,
        fontWeight: big?700:500, color: T.PLX_INK_500}}>{label}</td>
      <td style={{padding:"10px 16px", textAlign:"right", fontSize: big?18:13,
        fontWeight: big?700:600, color: red?T.PLX_RED_600:T.PLX_INK_900,
        fontFamily: T.FONT_MONO}}>{v}</td>
    </tr>
  );
}

Object.assign(window, { PurchaseOrders, PurchaseOrderDetail });
