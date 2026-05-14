// 院・店舗 — list as card grid + detail page.
// Card grid uses the new branch_type/manager_name/operating_hours_json fields
// that prompt 03 added. Each card fetches its own inventory snapshot.

function Branches() {
  const branchesQ = useFetch(() => api.listBranches(), []);
  const rows = branchesQ.data?.items ?? [];

  return (
    <AdminShell currentNav="branches" breadcrumbs={["ホーム", "院・店舗"]}>
      <PlxPageHead title="院・店舗" subtitle={`全 ${rows.length} 拠点`}
        right={
          <button onClick={() => window.PLX_TOAST.warn("拠点の追加機能は近日対応予定です")} style={btnPrimary}>
            ＋ 店舗を追加
          </button>
        }/>

      {branchesQ.error && <PlxErrorBanner error={branchesQ.error} onRetry={branchesQ.refetch} />}
      {branchesQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
        {rows.map((b) => <BranchCard key={b.id} branch={b} />)}
      </div>
    </AdminShell>
  );
}

function BranchCard({ branch }) {
  const snapQ = useFetch(() => api.getBranchInventorySnapshot(branch.id), [branch.id]);
  const snap = snapQ.data;
  return (
    <div style={{
      background: "#fff", borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      boxShadow: T.SHADOW_SM, padding: 22, cursor: "pointer",
    }}
      onClick={() => navigate(`/branches/${branch.id}`)}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = T.SHADOW_MD}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = T.SHADOW_SM}
    >
      <div style={{
        height: 140, borderRadius: T.RADIUS_MD, background: T.PLX_SURFACE_100,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
      }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={T.PLX_INK_400}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          <path d="M2 22h20"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
        </svg>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {branch.branch_type === "main"
          ? <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>本院</Pill>
          : <Pill color={T.PLX_BLUE_600} bg={T.PLX_BLUE_100}>分院</Pill>}
        {branch.status === "inactive"
          ? <Pill color={T.PLX_INK_500} bg={T.PLX_SURFACE_100}>休業中</Pill>
          : <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>営業中</Pill>}
      </div>

      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>{branch.name}</h3>

      <div style={{ fontSize: 13, color: T.PLX_INK_700, lineHeight: 1.7 }}>
        {branch.postal_code && <div style={{ color: T.PLX_INK_500, fontSize: 12 }}>〒{branch.postal_code}</div>}
        {branch.address && <div>{branch.address}</div>}
        {branch.phone && <div style={{ marginTop: 6 }}>📞 {branch.phone}</div>}
        {branch.manager_name && <div style={{ marginTop: 6 }}>院長/管理者: <b>{branch.manager_name}</b></div>}
      </div>

      <div style={{
        marginTop: 14, padding: 12, background: T.PLX_GREEN_050,
        borderRadius: T.RADIUS_MD, border: `1px solid ${T.PLX_GREEN_100}`,
      }}>
        <div style={{ fontSize: 11, color: T.PLX_INK_500, fontWeight: 600, marginBottom: 4 }}>在庫スナップショット</div>
        {snapQ.loading && <div style={{ fontSize: 12, color: T.PLX_INK_500 }}>読み込み中…</div>}
        {snap && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: T.PLX_GREEN_700 }}>
              {snap.total_items.toLocaleString()} 点
            </span>
            <span style={{ fontSize: 13, color: T.PLX_INK_700 }}>
              ¥{formatYen(snap.total_value_jpy)}
            </span>
            {snap.low_stock_count > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: T.PLX_AMBER_600,
                background: T.PLX_AMBER_100, padding: "2px 8px", borderRadius: 9999 }}>
                低 {snap.low_stock_count}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BranchDetail({ id }) {
  const branchQ = useFetch(() => api.getBranch(Number(id)), [id]);
  const snapQ = useFetch(() => api.getBranchInventorySnapshot(Number(id)), [id]);
  const b = branchQ.data;

  return (
    <AdminShell currentNav="branches"
      breadcrumbs={["ホーム", "院・店舗", b ? b.name : "..."]}>
      {branchQ.error && <PlxErrorBanner error={branchQ.error} onRetry={branchQ.refetch} />}
      {branchQ.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
      {b && (
        <>
          <button onClick={() => navigate("/branches")} style={{
            background: "none", border: "none", color: T.PLX_INK_500,
            fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14,
          }}>← 院・店舗一覧へ戻る</button>

          <div style={{
            background: "#fff", borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
            boxShadow: T.SHADOW_SM, padding: 24, marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, flex: 1 }}>{b.name}</h2>
              {b.branch_type === "main"
                ? <Pill color={T.PLX_GREEN_700} bg={T.PLX_GREEN_100}>本院</Pill>
                : <Pill color={T.PLX_BLUE_600} bg={T.PLX_BLUE_100}>分院</Pill>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              <PlxDetailKV k="郵便番号" v={b.postal_code ? `〒${b.postal_code}` : "—"} />
              <PlxDetailKV k="電話" v={b.phone || "—"} />
              <PlxDetailKV k="院長/管理者" v={b.manager_name || "—"} />
              {b.address && <PlxDetailKV k="住所" v={b.address} />}
              <PlxDetailKV k="デフォルト税率" v={`${parseFloat(b.default_tax_rate || 10)}%`} />
              <PlxDetailKV k="在庫低下しきい値" v={`${b.low_stock_threshold} 件`} />
            </div>

            {b.operating_hours_json && (
              <div style={{ marginTop: 16, padding: 14, background: T.PLX_SURFACE_50, borderRadius: T.RADIUS_MD }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.PLX_INK_500, marginBottom: 8 }}>営業時間</div>
                <table style={{ fontSize: 12, width: "100%" }}>
                  <tbody>
                    {Object.entries(b.operating_hours_json).map(([day, slots]) => (
                      <tr key={day}>
                        <td style={{ padding: "3px 0", color: T.PLX_INK_500, width: 60 }}>{dayJp(day)}</td>
                        <td style={{ padding: "3px 0", color: T.PLX_INK_900 }}>
                          {!slots || slots.length === 0
                            ? <span style={{ color: T.PLX_INK_500 }}>休診</span>
                            : slots.map((s) => `${s.open}–${s.close}`).join(" / ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {snap && (
            <div style={{
              background: "#fff", borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
              boxShadow: T.SHADOW_SM, padding: 24,
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 14 }}>在庫スナップショット</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                <PlxKpiTile label="在庫点数" value={snap.total_items} unit="点" tone="green"/>
                <PlxKpiTile label="在庫金額" value={`¥${formatYen(snap.total_value_jpy)}`} unit="" tone="green"/>
                <PlxKpiTile label="在庫低下" value={snap.low_stock_count} unit="件"
                  tone={snap.low_stock_count > 0 ? "amber" : "muted"}/>
                <PlxKpiTile label="期限間近" value={snap.expiring_soon_count} unit="件"
                  tone={snap.expiring_soon_count > 0 ? "red" : "muted"}/>
              </div>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}

function dayJp(d) {
  return { mon: "月", tue: "火", wed: "水", thu: "木", fri: "金", sat: "土", sun: "日", holiday: "祝" }[d] || d;
}

window.Branches = Branches;
window.BranchDetail = BranchDetail;
