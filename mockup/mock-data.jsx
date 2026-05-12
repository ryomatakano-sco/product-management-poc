// Mock data for SCO product management POC
// Dental clinic supplies — kanji + kana names, JAN codes, vendor info, variants

const MOCK_VENDORS = [
  { id:"v1", company_name:"GC（ジーシー）", country:"日本", contact_name:"山本 健", email:"sales@gc.example.jp", phone:"03-1234-0001" },
  { id:"v2", company_name:"モリタ（MORITA）", country:"日本", contact_name:"佐藤 由美", email:"info@morita.example.jp", phone:"06-2345-0002" },
  { id:"v3", company_name:"3M ジャパン", country:"日本", contact_name:"Tanaka Riku", email:"dental@3m.example.com", phone:"03-3456-0003" },
  { id:"v4", company_name:"ライオン歯科材", country:"日本", contact_name:"鈴木 香", email:"order@lion-dental.example.jp", phone:"03-4567-0004" },
  { id:"v5", company_name:"クラレノリタケデンタル", country:"日本", contact_name:"中村 拓", email:"info@kuraray-noritake.example.jp", phone:"052-5678-0005" },
];

const MOCK_CATEGORIES = [
  { id:"c1", name:"印象材",     name_kana:"いんしょうざい" },
  { id:"c2", name:"修復材",     name_kana:"しゅうふくざい" },
  { id:"c3", name:"予防・歯磨剤", name_kana:"よぼう・はみがきざい" },
  { id:"c4", name:"麻酔",        name_kana:"ますい" },
  { id:"c5", name:"消耗品",      name_kana:"しょうもうひん" },
  { id:"c6", name:"器具",        name_kana:"きぐ" },
];

const MOCK_TAGS = ["新商品","おすすめ","保険適用","自費","セール","低在庫注意","新患様用","小児用"];

const MOCK_PRODUCTS = [
  { id:"p1",
    name:"エグザフレックス インプレッション", name_kana:"エグザフレックス インプレッション",
    category_id:"c1", category:"印象材",
    vendor_id:"v1", vendor:"GC（ジーシー）",
    status:"active",
    tags:["おすすめ","保険適用"],
    description:"高精度シリコン印象材。練和時間短縮で術者の負担を軽減します。",
    image:"#E6F7F2",
    sku:"GC-EX-001", jan:"4987246012001",
    price:"4,800", cost:"3,100",
    on_hand:42, committed:6, unavailable:0,
    sold_90d:128 },
  { id:"p2",
    name:"フィルテック スプリーム ウルトラ", name_kana:"フィルテック スプリーム ウルトラ",
    category_id:"c2", category:"修復材",
    vendor_id:"v3", vendor:"3M ジャパン",
    status:"active",
    tags:["自費","おすすめ"],
    description:"ナノフィラー充填材。前歯部・臼歯部両用。",
    image:"#FEF3C7",
    sku:"3M-FSU-A2", jan:"4549395003442",
    price:"7,200", cost:"4,500",
    on_hand:8, committed:2, unavailable:0,
    sold_90d:64 },
  { id:"p3",
    name:"システマ ハグキプラス 歯ブラシ", name_kana:"システマ ハグキプラス はぶらし",
    category_id:"c3", category:"予防・歯磨剤",
    vendor_id:"v4", vendor:"ライオン歯科材",
    status:"active",
    tags:["新患様用","セール"],
    description:"超極細毛で歯周ポケットへ届く患者配布用ブラシ。",
    image:"#E6F4FB",
    sku:"LION-SHP-M", jan:"4903301226178",
    price:"380", cost:"180",
    on_hand:312, committed:24, unavailable:0,
    sold_90d:540 },
  { id:"p4",
    name:"オーラルB プロフェッショナル ペースト", name_kana:"オーラルビー プロフェッショナル ペースト",
    category_id:"c3", category:"予防・歯磨剤",
    vendor_id:"v4", vendor:"ライオン歯科材",
    status:"active",
    tags:["保険適用","新患様用"],
    description:"フッ素 1450ppm 含有。知覚過敏予防にも対応。",
    image:"#FBE6F1",
    sku:"OB-PRO-100", jan:"4902430878920",
    price:"680", cost:"320",
    on_hand:6, committed:4, unavailable:0,
    sold_90d:198 },
  { id:"p5",
    name:"オーラ注 歯科用キシロカイン", name_kana:"オーラちゅう しかよう キシロカイン",
    category_id:"c4", category:"麻酔",
    vendor_id:"v2", vendor:"モリタ（MORITA）",
    status:"active",
    tags:["保険適用"],
    description:"カートリッジ式局所麻酔薬。1.8ml × 50本入。",
    image:"#F4FBF8",
    sku:"MOR-XYL-50", jan:"4987111032214",
    price:"3,200", cost:"2,100",
    on_hand:24, committed:6, unavailable:0,
    sold_90d:88 },
  { id:"p6",
    name:"ニトリル グローブ パウダーフリー", name_kana:"ニトリル グローブ パウダーフリー",
    category_id:"c5", category:"消耗品",
    vendor_id:"v2", vendor:"モリタ（MORITA）",
    status:"active",
    tags:["セール"],
    description:"100枚入。アレルギー対応。M/L サイズ展開。",
    image:"#EEF2F7",
    sku:"MOR-NTR-100", jan:"4987111090032",
    price:"1,280", cost:"640",
    on_hand:78, committed:12, unavailable:2,
    sold_90d:312 },
  { id:"p7",
    name:"パナビア V5 接着システム", name_kana:"パナビア ブイファイブ せっちゃくシステム",
    category_id:"c2", category:"修復材",
    vendor_id:"v5", vendor:"クラレノリタケデンタル",
    status:"active",
    tags:["自費","新商品"],
    description:"デュアルキュア型レジンセメント。クラウン・ブリッジ用。",
    image:"#F0F9FF",
    sku:"KN-PV5-A2", jan:"4548611112233",
    price:"12,800", cost:"8,200",
    on_hand:4, committed:1, unavailable:0,
    sold_90d:18 },
  { id:"p8",
    name:"こども用フッ素ジェル いちご味", name_kana:"こどもよう フッソジェル いちごあじ",
    category_id:"c3", category:"予防・歯磨剤",
    vendor_id:"v1", vendor:"GC（ジーシー）",
    status:"draft",
    tags:["小児用","新商品"],
    description:"低濃度フッ素 (500ppm) お子様向け。",
    image:"#FEE7E7",
    sku:"GC-KFG-ICH", jan:"4987246055551",
    price:"520", cost:"240",
    on_hand:0, committed:0, unavailable:0,
    sold_90d:0 },
];

// derived
function available(p) { return p.on_hand - p.committed - p.unavailable; }
function isLowStock(p, threshold=10) { return available(p) <= threshold; }

// Variants for one product (used in detail view)
const MOCK_VARIANTS_P1 = [
  { id:"vr1", sku:"GC-EX-001-S", barcode:"4987246012001", option1:"サイズ", option1_value:"スモール (50ml)", price:"4,200", cost:"2,800", on_hand:18, committed:2, unavailable:0, is_default:false },
  { id:"vr2", sku:"GC-EX-001-M", barcode:"4987246012018", option1:"サイズ", option1_value:"スタンダード (75ml)", price:"4,800", cost:"3,100", on_hand:22, committed:4, unavailable:0, is_default:true },
  { id:"vr3", sku:"GC-EX-001-L", barcode:"4987246012025", option1:"サイズ", option1_value:"ラージ (130ml)", price:"5,800", cost:"3,800", on_hand:2, committed:0, unavailable:0, is_default:false },
];

// 90-day sales (12 weeks)
const MOCK_SALES_90D = [
  6, 8, 4, 12, 9, 11, 7, 14, 10, 18, 15, 14
];

// inventory history for one variant
const MOCK_INV_HISTORY = [
  { date:"2026/04/28 14:32", field:"on_hand", delta:+24, reason:"purchase",   note:"PO-2026-0412 入荷",       user:"田中 美咲" },
  { date:"2026/04/27 11:08", field:"on_hand", delta:-2,  reason:"sale",       note:"診療使用 (Dr.西川)",      user:"システム" },
  { date:"2026/04/24 09:21", field:"unavailable", delta:+1,  reason:"damage", note:"パッケージ破損",          user:"田中 美咲" },
  { date:"2026/04/22 17:45", field:"on_hand", delta:-1,  reason:"sale",       note:"診療使用",                user:"システム" },
  { date:"2026/04/19 10:03", field:"committed", delta:+4, reason:"sale",      note:"次週予約分 引当",          user:"田中 美咲" },
  { date:"2026/04/15 16:52", field:"on_hand", delta:-3,  reason:"sale",       note:"診療使用",                user:"システム" },
  { date:"2026/04/12 13:14", field:"on_hand", delta:+12, reason:"purchase",   note:"PO-2026-0398 入荷",       user:"田中 美咲" },
];

// AI Suggestion candidates (for AI Assist modal)
const MOCK_AI_SUGGESTIONS = {
  title: [
    { id:"t1", value:"パナビア V5 ペースト 2.5g (Aユニバーサル)", confidence:0.94, source:"kuraray-noritake.co.jp" },
    { id:"t2", value:"PANAVIA V5 Paste 2.5g A-Universal", confidence:0.81, source:"jandb.example.jp" },
  ],
  brand: [
    { id:"b1", value:"クラレノリタケデンタル", confidence:0.96, source:"kuraray-noritake.co.jp" },
  ],
  category: [
    { id:"cat1", value:"修復材", confidence:0.92, source:"分類辞書" },
    { id:"cat2", value:"接着材", confidence:0.78, source:"分類辞書" },
  ],
  price: [
    { id:"p1", value:"¥12,800", confidence:0.71, source:"dental-supply.example.jp" },
    { id:"p2", value:"¥13,200", confidence:0.62, source:"jandb.example.jp" },
  ],
  description: [
    { id:"d1", value:"デュアルキュア型レジンセメント。クラウン・ブリッジ・インレー・オンレー・ベニアの接着、ポストコアの装着に。", confidence:0.88, source:"kuraray-noritake.co.jp" },
  ],
};

Object.assign(window, {
  MOCK_VENDORS, MOCK_CATEGORIES, MOCK_TAGS, MOCK_PRODUCTS,
  MOCK_VARIANTS_P1, MOCK_SALES_90D, MOCK_INV_HISTORY, MOCK_AI_SUGGESTIONS,
  available, isLowStock,
});
