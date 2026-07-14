// Under-Construction placeholder (brief §5).
// Used for every sidebar entry whose real page isn't built yet
// (categories / inventory / purchase orders / sales / vendors / branches /
// settings / support). The shell + breadcrumb still resolve correctly so
// the demo reviewer can see where they landed.

function UnderConstruction({ navId, title, breadcrumbs }) {
  return (
    <AdminShell title={title} currentNav={navId} breadcrumbs={breadcrumbs}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 480, padding: 24,
      }}>
        <div style={{
          background: T.PLX_CARD_BG, border: `1px solid ${T.PLX_LINE_200}`,
          borderRadius: T.RADIUS_LG, boxShadow: T.SHADOW_SM,
          maxWidth: 520, padding: 48, textAlign: "center",
        }}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%", background: T.PLX_GREEN_100,
            margin: "0 auto 20px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {/* HardHat-ish icon */}
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.PLX_GREEN_600}
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-1H2z" />
              <path d="M10 4h4v4h-4z" />
              <path d="M5 17V12a7 7 0 0 1 14 0v5" />
            </svg>
          </div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700,
            color: T.PLX_INK_900, letterSpacing: "-0.005em",
          }}>現在開発中</h2>
          <p style={{
            margin: "10px 0 24px", fontSize: 14, lineHeight: 1.7,
            color: T.PLX_INK_500,
          }}>
            この機能は現在開発中です。<br />
            5月13日以降のデモにてご紹介いたします。
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
            <button onClick={() => navigate("/dashboard")} style={{
              height: 38, padding: "0 16px", borderRadius: T.RADIUS_MD,
              background: T.PLX_CARD_BG, color: T.PLX_INK_700,
              border: `1px solid ${T.PLX_LINE_200}`,
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>← ダッシュボードに戻る</button>
            <button
              onClick={() => window.PLX_TOAST?.success("公開時にお知らせします")}
              style={{
              height: 38, padding: "0 16px", borderRadius: T.RADIUS_MD,
              background: T.PLX_GREEN_600, color: "#fff", border: "none",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>🔔 通知を受け取る</button>
          </div>
          <div style={{
            fontSize: 12, color: T.PLX_INK_400,
            paddingTop: 12, borderTop: `1px solid ${T.PLX_LINE_100}`,
          }}>
            PoC v1.4.0 ・ 商品管理モジュール
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

window.UnderConstruction = UnderConstruction;
