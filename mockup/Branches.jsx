// Branches (院・店舗) — §4.10

function Branches() {
  const cards = [
    {
      type:"本院", typeTone:"green",
      name:"ペイライト歯科クリニック",
      status:"営業中",
      addr:"〒100-0005 東京都千代田区丸の内3-4-1 新国際ビル9階",
      phone:"03-6281-8883",
      manager:"田島 雄一 先生",
      hours:"平日 9:30–13:00 / 14:30–19:00、土 9:30–17:00、日祝 休診",
      stock:"2,847 点 ／ ¥1,684,200",
    },
    {
      type:"分院", typeTone:"blue",
      name:"ペイライト歯科クリニック 梅田",
      status:"営業中",
      addr:"〒530-0012 大阪府大阪市北区芝田2-6-27 PMO梅田 8階B",
      phone:"06-1234-5678",
      manager:"山口 さくら 先生",
      hours:"平日 10:00–13:30 / 15:00–20:00、土日 10:00–18:00",
      stock:"1,985 点 ／ ¥1,163,400",
    },
  ];
  return (
    <AppShell current="branches" breadcrumbs={["ホーム","院・店舗"]}>
      <PageHead title="院・店舗" subtitle="全 2 拠点"
        right={<Btn kind="primary" icon="plus">店舗を追加</Btn>}/>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24}}>
        {cards.map((c,i)=>(
          <Card key={i} pad={0}>
            <div style={{height:160, background: T.PLX_SURFACE_100, position:"relative",
              borderTopLeftRadius: T.RADIUS_LG, borderTopRightRadius: T.RADIUS_LG,
              backgroundImage:`repeating-linear-gradient(45deg, ${T.PLX_LINE_200} 0 8px, transparent 8px 16px)`,
              display:"flex", alignItems:"center", justifyContent:"center"}}>
              <div style={{fontSize:12, fontFamily: T.FONT_MONO, color: T.PLX_INK_500,
                background:"#fff", padding:"4px 10px", borderRadius:6,
                border:`1px solid ${T.PLX_LINE_200}`}}>clinic photo</div>
            </div>
            <div style={{padding:24}}>
              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
                <Chip tone={c.typeTone}>{c.type}</Chip>
                <Chip tone="green" icon="check">{c.status}</Chip>
              </div>
              <div style={{fontSize:20, fontWeight:700, color: T.PLX_INK_900, marginBottom:14, letterSpacing:"-0.01em"}}>{c.name}</div>
              <DLRow label="住所" value={c.addr}/>
              <DLRow label="電話" value={<span style={{fontFamily: T.FONT_MONO}}>{c.phone}</span>}/>
              <DLRow label="管理者" value={c.manager}/>
              <DLRow label="営業時間" value={c.hours}/>
              <DLRow label="在庫" value={<b style={{color: T.PLX_INK_900}}>{c.stock}</b>}/>
              <div style={{marginTop:18, display:"flex", gap:8, justifyContent:"flex-end"}}>
                <Btn>詳細</Btn>
                <Btn kind="primary" icon="edit">編集</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

Object.assign(window, { Branches });
