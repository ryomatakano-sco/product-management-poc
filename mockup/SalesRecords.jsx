// Sales Records — §4.8

function SalesRecords() {
  const rows = [
    ["2026/05/12 14:32","SL-20260512-0023","サンスター GUM プロケア デンタルブラシ #211 ほか 2点","4","¥1,408",{tone:"blue",text:"カード"},"山田 花子","田中 太郎"],
    ["2026/05/12 13:18","SL-20260512-0022","クリニカアドバンテージ ハミガキ 130g","2","¥1,056",{tone:"neutral",text:"現金"},"佐藤 健","佐藤 美咲"],
    ["2026/05/12 12:45","SL-20260512-0021","ホワイトニングジェル 10% 過酸化尿素 1.2mL × 4本","1","¥5,280",{tone:"red",text:"PayPay"},"山田 花子","鈴木 一郎"],
    ["2026/05/12 11:30","SL-20260512-0020","返品: デンタルフロス ワックス 50m × 3個セット","-1","-¥704",{tone:"neutral",text:"現金"},"佐藤 健","—",true],
    ["2026/05/12 10:55","SL-20260512-0019","リステリン トータルケアプラス 1000mL ほか 1点","3","¥4,288",{tone:"blue",text:"カード"},"鈴木 由香","小林 花子"],
    ["2026/05/12 10:20","SL-20260512-0018","子供用歯ブラシ クマさんカラー 3本セット","2","¥1,144",{tone:"purple",text:"銀行振込"},"山田 花子","—"],
    ["2026/05/12 09:50","SL-20260512-0017","デンタルフロス ワックス 50m × 3個セット","5","¥3,520",{tone:"neutral",text:"現金"},"佐藤 健","渡辺 美香"],
    ["2026/05/12 09:30","SL-20260512-0016","返品: ホワイトニングジェル 10%","-1","-¥5,280",{tone:"blue",text:"カード"},"山田 花子","加藤 健",true],
    ["2026/05/12 09:15","SL-20260512-0015","クリニカアドバンテージ ハミガキ 130g ほか 1点","3","¥2,640",{tone:"red",text:"PayPay"},"鈴木 由香","松本 美咲"],
    ["2026/05/12 08:50","SL-20260512-0014","サンスター GUM プロケア デンタルブラシ #211","1","¥352",{tone:"neutral",text:"現金"},"佐藤 健","—"],
  ];
  return (
    <AppShell current="sales" breadcrumbs={["ホーム","販売記録"]}>
      <PageHead title="販売記録" subtitle="物販・消耗品の販売トランザクション"
        right={<><Btn icon="download">CSVエクスポート</Btn><Btn kind="primary" icon="plus">手動入力</Btn></>}/>
      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:24, marginBottom:20}}>
        <KPITile label="本日の販売件数" v="23" sub="件" chip={{tone:"green", text:"+5 昨日比"}}/>
        <KPITile label="本日の売上 (税込)" v="¥48,720" chip={{tone:"green", text:"+12% 昨日比"}}/>
        <KPITile label="今月の売上 (税込)" v="¥1,284,300" chip={{tone:"green", text:"+18% 先月比"}}/>
        <KPITile label="今月の販売件数" v="487" sub="件" chip={{tone:"green", text:"+9% 先月比"}}/>
      </div>
      <Card pad={20} style={{marginBottom:16}}>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          <PlxSelect label="期間" v="本日"/>
          <PlxSelect label="拠点" v="本院"/>
          <PlxSelect label="支払方法" v="すべて"/>
          <PlxSelect label="担当者" v="すべて"/>
          <PlxSelect label="患者紐付け" v="すべて"/>
          <SearchInput w={240} placeholder="商品名・取引IDで検索"/>
        </div>
      </Card>
      <Card pad={0}>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead><tr style={{background: T.PLX_SURFACE_50}}>
            <Th>日時</Th><Th>取引ID</Th><Th>商品</Th>
            <Th align="right">数量</Th><Th align="right">合計 (税込)</Th>
            <Th>支払方法</Th><Th>担当者</Th><Th>患者</Th><Th style={{width:96}}>操作</Th>
          </tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={i} style={{borderTop:`1px solid ${T.PLX_LINE_100}`, height:56,
              background: i%2 ? "transparent" : T.PLX_SURFACE_50}}>
              <Td>{r[0]}</Td>
              <Td mono style={{fontWeight:600, color: T.PLX_GREEN_700}}>{r[1]}</Td>
              <Td>{r[8] && <Chip tone="red" style={{marginRight:8}}>返品</Chip>}{r[2]}</Td>
              <Td align="right" mono>{r[3]}</Td>
              <Td align="right" mono style={{fontWeight:600, color: r[4].startsWith("-") ? T.PLX_RED_600 : T.PLX_INK_900}}>{r[4]}</Td>
              <Td><Chip tone={r[5].tone}>{r[5].text}</Chip></Td>
              <Td>{r[6]}</Td>
              <Td>{r[7]==="—" ? <span style={{color: T.PLX_INK_400}}>—</span> : <a href="#" style={{color: T.PLX_GREEN_700, textDecoration:"none", fontWeight:500}}>{r[7]} さま</a>}</Td>
              <Td><a href="#" style={{color: T.PLX_INK_700, fontSize:12, fontWeight:500, textDecoration:"none", marginRight:10}}>詳細</a><a href="#" style={{color: T.PLX_RED_600, fontSize:12, fontWeight:500, textDecoration:"none"}}>返品</a></Td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{padding:"14px 20px", borderTop:`1px solid ${T.PLX_LINE_100}`, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div style={{fontSize:12, color: T.PLX_INK_500}}>表示件数 25 ▼</div>
          <div style={{fontSize:13, color: T.PLX_INK_700, display:"flex", alignItems:"center", gap:12}}>
            <span>1 - 10 件 / 全 23 件</span>
            <Btn>← 前へ</Btn><PageBtn active>1</PageBtn><Btn>次へ →</Btn>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}

Object.assign(window, { SalesRecords });
