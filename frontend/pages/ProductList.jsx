// Product List screen — search, filters, tag chips, table.
// Reads expanded ProductListItem (default_sku, default_price, total_available).

function ProductList() {
  const [searchQ, setSearchQ] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [vendorFilter, setVendorFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("active");
  const [activeTags, setActiveTags] = React.useState([]);

  const categoriesQ = useFetch(() => api.listCategories(), []);
  const vendorsQ    = useFetch(() => api.listVendors(),    []);
  const tagsQ       = useFetch(() => api.listTags(),       []);

  const productsQ = useFetch(
    () => api.listProducts({
      q: searchQ || undefined,
      category_id: categoryFilter || undefined,
      vendor_id: vendorFilter || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      tag: activeTags.length ? activeTags : undefined,
      limit: 50,
    }),
    [searchQ, categoryFilter, vendorFilter, statusFilter, activeTags.join(",")],
  );

  const items = productsQ.data?.items ?? [];
  const total = productsQ.data?.total ?? 0;

  const headerRight = (
    <button onClick={() => navigate("/products/new")} style={{
      height: 38, padding: "0 18px", borderRadius: 9999,
      background: PLX_GREEN, color: "#fff", border: "none",
      fontWeight: 700, fontSize: 13, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      boxShadow: "0 6px 16px rgba(26,166,138,.25)",
    }}>＋ 新しい商品を追加</button>
  );

  return (
    <AdminShell title="商品一覧" currentNav="products" headerRight={headerRight}>
      <SectionLabel>商品マスタ</SectionLabel>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 18, marginTop: 6 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-.01em" }}>
          すべての商品
        </h2>
        <span style={{ fontSize: 13, color: PLX_MUTED }}>
          {items.length} 件 / 全 {total} 件
        </span>
      </div>

      {/* Filter bar */}
      <div style={{
        background: "#fff", borderRadius: 14, padding: "16px 20px",
        border: `1px solid ${PLX_BORDER}`, display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              placeholder="商品名・かな・SKUで検索…" style={{ ...formInput, paddingLeft: 36 }} />
            <svg style={{ position: "absolute", left: 13, top: 11 }}
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PLX_MUTED}
              strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          </div>
          <Select value={categoryFilter} onChange={setCategoryFilter} options={[
            { value: "", label: "すべてのカテゴリ" },
            ...(categoriesQ.data?.items ?? []).map((c) => ({ value: String(c.id), label: c.name })),
          ]} />
          <Select value={vendorFilter} onChange={setVendorFilter} options={[
            { value: "", label: "すべての仕入先" },
            ...(vendorsQ.data?.items ?? []).map((v) => ({ value: String(v.id), label: v.company_name })),
          ]} />
          <div style={{ flex: 1 }} />
          <SegmentedControl value={statusFilter} onChange={setStatusFilter} options={[
            { value: "active", label: "公開中" },
            { value: "draft",  label: "下書き" },
            { value: "all",    label: "すべて" },
          ]} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: PLX_MUTED, fontWeight: 600 }}>タグで絞り込み</span>
          {(tagsQ.data?.items ?? []).map((t) => {
            const on = activeTags.includes(t.name);
            return (
              <button key={t.id} onClick={() => setActiveTags((s) =>
                s.includes(t.name) ? s.filter((x) => x !== t.name) : [...s, t.name],
              )} style={{
                fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 9999,
                border: `1px solid ${on ? PLX_GREEN : PLX_BORDER}`,
                background: on ? PLX_GREEN_LIGHT : "#fff",
                color: on ? PLX_GREEN : PLX_TEXT, cursor: "pointer",
              }}>{on && "✓ "}{t.name}</button>
            );
          })}
          {activeTags.length > 0 && (
            <button onClick={() => setActiveTags([])} style={{
              fontSize: 11, color: PLX_MUTED, background: "none",
              border: "none", cursor: "pointer", textDecoration: "underline",
            }}>クリア</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: "#fff", borderRadius: 14, border: `1px solid ${PLX_BORDER}`,
        marginTop: 16, overflow: "hidden",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "40px 1.7fr 0.9fr 1fr 0.8fr 0.7fr 0.8fr 0.8fr 28px",
          padding: "12px 18px", fontSize: 11, fontWeight: 700, color: PLX_MUTED,
          background: PLX_GREEN_50, letterSpacing: ".03em",
          borderBottom: `1px solid ${PLX_BORDER}`, alignItems: "center",
        }}>
          <span><input type="checkbox" style={{ accentColor: PLX_GREEN }} /></span>
          <span>商品名</span><span>カテゴリ</span><span>仕入先</span><span>SKU</span>
          <span style={{ textAlign: "right" }}>価格</span>
          <span style={{ textAlign: "right" }}>在庫（利用可能）</span>
          <span style={{ textAlign: "center" }}>ステータス</span>
          <span />
        </div>

        {productsQ.loading && (
          <div style={{ padding: 60, textAlign: "center", color: PLX_MUTED, fontSize: 13 }}>
            読み込み中...
          </div>
        )}
        {productsQ.error && (
          <div style={{ padding: 60, textAlign: "center", color: PLX_WARN, fontSize: 13 }}>
            読み込みに失敗しました。バックエンドが起動しているか確認してください。
          </div>
        )}

        {items.map((p, i) => {
          const av = p.total_available ?? 0;
          const low = av <= 10;
          return (
            <div key={p.id} onClick={() => navigate(`/products/${p.id}`)} style={{
              display: "grid", gridTemplateColumns: "40px 1.7fr 0.9fr 1fr 0.8fr 0.7fr 0.8fr 0.8fr 28px",
              padding: "14px 18px", alignItems: "center", cursor: "pointer",
              borderBottom: i < items.length - 1 ? `1px solid ${PLX_BORDER}` : "none",
              transition: "background .12s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = PLX_GREEN_50)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <span onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" style={{ accentColor: PLX_GREEN }} />
              </span>
              <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8, background: PLX_GREEN_LIGHT,
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${PLX_BORDER}`,
                  backgroundImage: p.thumbnail_url ? `url(${p.thumbnail_url})` : undefined,
                  backgroundSize: "cover",
                }}>
                  {!p.thumbnail_url && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN}
                      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.3 7 12 12 20.7 7"/>
                    </svg>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{p.name}</div>
                  {p.name_kana && (
                    <div style={{
                      fontSize: 10, color: PLX_SUBTLE, marginTop: 2,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{p.name_kana}</div>
                  )}
                  {p.tags?.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                      {p.tags.slice(0, 2).map((t) => (
                        <span key={t} style={{
                          fontSize: 9, fontWeight: 700, color: PLX_GREEN,
                          background: PLX_GREEN_LIGHT, padding: "2px 6px", borderRadius: 9999,
                        }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 12, color: PLX_TEXT }}>{p.category_name ?? "—"}</span>
              <span style={{
                fontSize: 12, color: PLX_TEXT,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{p.vendor_name ?? "—"}</span>
              <span style={{
                fontSize: 11, color: PLX_MUTED, fontVariantNumeric: "tabular-nums",
                fontFamily: "ui-monospace,SFMono-Regular,monospace",
              }}>{p.default_sku ?? "—"}</span>
              <span style={{
                fontSize: 13, fontWeight: 700, textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}>¥{formatYen(p.default_price)}</span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: low ? PLX_WARN : PLX_TEXT,
                }}>{av}</span>
                <span style={{ fontSize: 10, color: PLX_MUTED, marginLeft: 3 }}>個</span>
                {low && av > 0 && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: PLX_WARN, marginTop: 2 }}>
                    ● 低在庫
                  </div>
                )}
              </span>
              <span style={{ textAlign: "center" }}><StatusPill status={p.status} /></span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PLX_SUBTLE}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          );
        })}
        {!productsQ.loading && items.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center", color: PLX_MUTED }}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>—</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: PLX_TEXT, marginBottom: 4 }}>
              該当する商品がありません
            </div>
            <div style={{ fontSize: 12 }}>検索条件を変更するか、新しい商品を追加してください。</div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

window.ProductList = ProductList;
