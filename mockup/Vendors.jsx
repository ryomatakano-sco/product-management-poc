// Vendors — §4.9

function Vendors() {
  const rows = [
    ["サンスター株式会社","佐藤 健一","03-1234-5678","k.sato@sunstar.co.jp",47,"¥1,840,200","月末締/翌月末払"],
    ["ライオン歯科材株式会社","鈴木 美咲","03-2345-6789","suzuki@lion-dent.co.jp",32,"¥980,400","月末締/翌々月10日払"],
    ["GC株式会社","田中 浩二","03-3456-7890","tanaka@gc.dental.jp",24,"¥1,420,800","月末締/翌月末払"],
    ["モリタ製作所","山本 由紀","06-1234-5678","yamamoto@morita.com",18,"¥3,280,000","月末締/翌月末払"],
    ["ヘンリーシャイン・ジャパン","David Tanaka","03-4567-8901","dtanaka@henryschein.jp",41,"¥2,140,000","月末締/翌月20日払"],
    ["クラレノリタケデンタル","中村 翔","052-1234-5678","nakamura@kuraray-d.com",12,"¥640,200","月末締/翌月末払"],
    ["ヨシダ","松本 太一","03-5678-9012","matsumoto@yoshida-dental.jp",15,"¥420,000","月末締/翌月末払"],
    ["白水貿易","中山 翔太","06-9012-3456","nakayama@hakusui-trading.jp",8,"¥280,400","月末締/翌月20日払"],
  ];
  return (
    <AppShell current="vendors" breadcrumbs={["ホーム","仕入先"]}>
      <PageHead title="仕入先" subtitle="全 18 社"
        right={<><Btn icon="download">エクスポート</Btn><Btn kind="primary" icon="plus">仕入先を追加</Btn></>}/>
      <Card pad={20} style={{marginBottom:16}}>
        <div style={{display:"flex", gap:8}}>
          <SearchInput w={320} placeholder="会社名・担当者で検索"/>
          <PlxSelect label="並び順" v="YTD仕入額(降順)"/>
          <div style={{flex:1}}/>
          <Btn icon="filter">フィルタ</Btn>
        </div>
      </Card>
      <Card pad={0}>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead><tr style={{background: T.PLX_SURFACE_50}}>
            <Th>会社名</Th><Th>担当者</Th><Th>電話</Th><Th>メール</Th>
            <Th align="right">取扱商品数</Th><Th align="right">YTD仕入額</Th><Th>支払条件</Th><Th style={{width:48}}></Th>
          </tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={i} style={{borderTop:`1px solid ${T.PLX_LINE_100}`, height:60,
              background: i%2 ? "transparent" : T.PLX_SURFACE_50}}>
              <Td>
                <div style={{display:"flex", alignItems:"center", gap:10}}>
                  <div style={{width:32, height:32, borderRadius:8, background: T.PLX_GREEN_100,
                    color: T.PLX_GREEN_700, fontSize:12, fontWeight:700,
                    display:"flex", alignItems:"center", justifyContent:"center"}}>{r[0][0]}</div>
                  <div style={{fontWeight:600, color: T.PLX_INK_900}}>{r[0]}</div>
                </div>
              </Td>
              <Td>{r[1]}</Td>
              <Td mono style={{fontSize:12}}>{r[2]}</Td>
              <Td><a href="#" style={{color: T.PLX_GREEN_700, textDecoration:"none", fontSize:12}}>{r[3]}</a></Td>
              <Td align="right" mono>{r[4]}</Td>
              <Td align="right" mono style={{fontWeight:600}}>{r[5]}</Td>
              <Td style={{fontSize:12, color: T.PLX_INK_500}}>{r[6]}</Td>
              <Td><Ico size={16} color={T.PLX_INK_400}>{ICONS.more}</Ico></Td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </AppShell>
  );
}

Object.assign(window, { Vendors });
