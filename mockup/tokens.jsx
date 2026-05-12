// PaylightX 商品管理 PoC — shared design tokens (matches design brief §7)
const T = {
  // Brand greens
  PLX_GREEN_700: "#0F8A5F",
  PLX_GREEN_600: "#16A36C",
  PLX_GREEN_500: "#22B07A",
  PLX_GREEN_300: "#7AD3B0",
  PLX_GREEN_100: "#E6F6EE",
  PLX_GREEN_050: "#F2FBF6",
  // Semantic
  PLX_BLUE_600: "#2E7BD6",
  PLX_BLUE_100: "#E4F0FB",
  PLX_AMBER_600: "#E89B17",
  PLX_AMBER_100: "#FDF3DC",
  PLX_RED_600: "#D6433A",
  PLX_RED_100: "#FCE7E5",
  PLX_PURPLE_600: "#9C56C0",
  PLX_PURPLE_100: "#F1E6F8",
  // Neutrals
  PLX_INK_900: "#0F1B2D",
  PLX_INK_700: "#2F3A4A",
  PLX_INK_500: "#5B6776",
  PLX_INK_400: "#8A95A4",
  PLX_INK_300: "#C2C9D2",
  PLX_LINE_200: "#E5E8ED",
  PLX_LINE_100: "#EEF1F5",
  PLX_SURFACE_0: "#FFFFFF",
  PLX_SURFACE_50: "#F7F9FC",
  PLX_SURFACE_100: "#F1F4F8",
  // Sidebar (dark green)
  PLX_SIDEBAR_BG: "#0F2A23",
  PLX_SIDEBAR_INK: "#D5E5DD",
  PLX_SIDEBAR_INK_DIM: "#7B9A8E",
  PLX_SIDEBAR_ACTIVE_BG: "#16A36C",
  // Radii / shadow
  RADIUS_SM: "6px",
  RADIUS_MD: "8px",
  RADIUS_LG: "12px",
  RADIUS_PILL: "999px",
  SHADOW_SM: "0 1px 2px rgba(15,27,45,0.04), 0 1px 1px rgba(15,27,45,0.03)",
  SHADOW_MD: "0 4px 12px rgba(15,27,45,0.06), 0 2px 4px rgba(15,27,45,0.04)",
  SHADOW_LG: "0 16px 32px rgba(15,27,45,0.10), 0 8px 16px rgba(15,27,45,0.06)",
  // Type stack
  FONT: '"Inter","Noto Sans JP",-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif',
  FONT_MONO: '"JetBrains Mono","SF Mono",ui-monospace,monospace',
};

// Tiny inline icon helper (Lucide-style stroke). 18px default.
function Ico({ d, size = 18, color = "currentColor", sw = 1.75, children, fill = "none" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      {children || (d && <path d={d}/>) }
    </svg>
  );
}

// Named Lucide-ish paths used across screens
const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
  package:   <><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></>,
  tags:      <><path d="m12 2 4 4 4-4"/><path d="M3 7v6a2 2 0 0 0 .6 1.4l8 8a2 2 0 0 0 2.8 0l6-6a2 2 0 0 0 0-2.8l-8-8A2 2 0 0 0 11 5H5a2 2 0 0 0-2 2z"/><circle cx="7.5" cy="7.5" r="1"/></>,
  boxes:     <><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19.07V12l-4.97-2.98a2 2 0 0 0-2.06 0Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 7v5.07L16.97 9.1a2 2 0 0 0 0-3.41L13 2.7a2 2 0 0 0-2 0l-4 2.4a2 2 0 0 0 0 3.41Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M21.03 12.92A2 2 0 0 1 22 14.63v3.24a2 2 0 0 1-.97 1.71l-3 1.8a2 2 0 0 1-2.06 0L12 19.07V12l4.97-2.98a2 2 0 0 1 2.06 0Z"/></>,
  file:      <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></>,
  receipt:   <><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></>,
  truck:     <><rect x="1" y="6" width="14" height="11" rx="1.5"/><path d="M15 9h4l3 3v5h-7"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
  building:  <><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="9" y1="9" x2="9" y2="9"/><line x1="15" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="9" y2="13"/><line x1="15" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="9" y2="17"/><line x1="15" y1="17" x2="15" y2="17"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></>,
  help:      <><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/></>,
  bell:      <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>,
  search:    <><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></>,
  sparkles:  <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></>,
  chevR:     <><polyline points="9 6 15 12 9 18"/></>,
  chevD:     <><polyline points="6 9 12 15 18 9"/></>,
  chevU:     <><polyline points="18 15 12 9 6 15"/></>,
  chevL:     <><polyline points="15 6 9 12 15 18"/></>,
  plus:      <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  x:         <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  check:     <><polyline points="20 6 9 17 4 12"/></>,
  more:      <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  download:  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  upload:    <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  edit:      <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></>,
  trash:     <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
  warn:      <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/></>,
  alert:     <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></>,
  clock:     <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  refresh:   <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
  arrowR:    <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
  arrowL:    <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
  arrowUp:   <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
  arrowDn:   <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>,
  ext:       <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  camera:    <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
  filter:    <><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></>,
  shield:    <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>,
  hard:      <><path d="M10 2h4"/><path d="M5 22V11a7 7 0 0 1 14 0v11"/><path d="M2 22h20"/><path d="M5 15h14"/></>,
  imgOff:    <><line x1="2" y1="2" x2="22" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" y1="13.5" x2="6" y2="21"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/><path d="M3.59 3.59A2 2 0 0 0 3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.41-.59"/></>,
  bldg2:     <><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M2 22h20"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></>,
};

Object.assign(window, { T, Ico, ICONS });
