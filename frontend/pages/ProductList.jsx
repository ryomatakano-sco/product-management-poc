// Product List screen — V2 (Yoshioka 2026-05-11):
// - 種別 filter (segmented: すべて / 物販品 / 消耗品)
// - 種別 column with kind pill
// - Quick filter chips (在庫低下 / 期限間近 / 再発注済) — visual only for now
// - Inline expiry indicator for consumable rows (red <30d / amber <60d)
//
// Click-through from the dashboard sets ?stock=low or ?expiry=soon on mount —
// see route.query in useHashRoute.

function ProductList({ initialQuery }) {
  const initial = initialQuery || {};
  const [searchQ, setSearchQ] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState(initial.kind || "all"); // all | product | consumable
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [vendorFilter, setVendorFilter] = React.useState("");
  // ProductCreate.save("draft") navigates to /products?status=draft so the
  // user lands on the drafts list and can see what they just saved.
  const [statusFilter, setStatusFilter] = React.useState(
    initial.status === "draft" || initial.status === "all" ? initial.status : "active"
  );
  const [activeTags, setActiveTags] = React.useState([]);
  const [quickFilters, setQuickFilters] = React.useState(() => {
    // Dashboard tiles deep-link here with ?stock=low or ?expiry=soon.
    const f = [];
    if (initial.stock === "low") f.push("low");
    if (initial.expiry === "soon") f.push("expire");
    return f;
  });

  const categoriesQ = useFetch(() => api.listCategories(), []);
  const vendorsQ    = useFetch(() => api.listVendors(),    []);
  const tagsQ       = useFetch(() => api.listTags(),       []);

  const productsQ = useFetch(
    () => api.listProducts({
      q: searchQ || undefined,
      category_id: categoryFilter || undefined,
      vendor_id: vendorFilter || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      item_type: kindFilter === "all" ? undefined : kindFilter,
      tag: activeTags.length ? activeTags : undefined,
      // "期限間近" chip = backend filter by expiry within 30 days.
      expiring_within_days: quickFilters.includes("expire") ? 30 : undefined,
      limit: 50,
    }),
    [searchQ, categoryFilter, vendorFilter, statusFilter, kindFilter, activeTags.join(","), quickFilters.join(",")],
  );

  // Client-side filter for "在庫低下" (we already have total_available per row).
  // Doing this client-side keeps the API simple — the backend would need a
  // having-clause on the variant aggregate, which Alembic doesn't make easy.
  const items = React.useMemo(() => {
    const list = productsQ.data?.items ?? [];
    if (!quickFilters.includes("low")) return list;
    return list.filter((p) => (p.total_available ?? 0) <= 10);
  }, [productsQ.data, quickFilters]);

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

  const toggleQuick = (k) => setQuickFilters((s) => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);

  // Inline publish (Yoshioka feedback 2026-05-18): on draft rows, if the
  // minimum fields needed for publish are present, show a 登録 button so the
  // user doesn't have to open the detail page just to flip status.
  // List rows don't carry barcode, so the rule here matches what the list
  // can see: name + category + price + item_type. The backend will reject
  // the PATCH if it disagrees, in which case we surface the error.
  const canPublishFromList = (p) =>
    !!p.name && !!p.category_name && !!p.item_type
    && p.default_price != null && Number(p.default_price) > 0;

  const [publishing, setPublishing] = React.useState(null); // product id mid-flight
  const publishDraft = async (e, p) => {
    e.stopPropagation();
    if (publishing) return;
    setPublishing(p.id);
    try {
      await api.updateProduct(p.id, { status: "active" });
      if (window.PLX_TOAST?.success) window.PLX_TOAST.success(`「${p.name}」を公開しました`);
      productsQ.refetch();
    } catch (err) {
      const msg = err?.body?.detail || err?.message || "公開に失敗しました";
      if (window.PLX_TOAST?.error) window.PLX_TOAST.error(msg);
    } finally {
      setPublishing(null);
    }
  };

  return (
    <AdminShell currentNav="products" breadcrumbs={["ホーム", "商品一覧"]}>
      {/* Brief §4.1: page header — H1 + subtitle, primary CTA right-aligned */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        gap: 16, marginBottom: 16,
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 700,
            color: T.PLX_INK_900, letterSpacing: "-0.01em",
          }}>商品一覧</h1>
          <div style={{ marginTop: 6, fontSize: 14, color: T.PLX_INK_500 }}>
            全 {total} 件の商品が登録されています
            {items.length !== total && (
              <span style={{ marginLeft: 8, color: T.PLX_GREEN_700, fontWeight: 600 }}>
                · 現在 {items.length} 件を表示中
              </span>
            )}
          </div>
        </div>
        <div>{headerRight}</div>
      </div>

      {/* Filter bar */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: 14, padding: "16px 20px",
        border: `1px solid ${PLX_BORDER}`, display: "flex", flexDirection: "column", gap: 14,
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 320, minWidth: 200 }}>
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

          {/* 品目種別 — Yoshioka 2026-05-11 */}
          <SegmentedControl value={kindFilter} onChange={setKindFilter} options={[
            { value: "all",         label: "すべて" },
            { value: "product",     label: "物販品" },
            { value: "consumable",  label: "消耗品" },
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

        {/* Quick filter chip row (Yoshioka 2026-05-11) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: PLX_MUTED, fontWeight: 600 }}>クイックフィルタ</span>
          <QuickChip on={quickFilters.includes("low")}    onClick={() => toggleQuick("low")}    dot={PLX_RED}  label="在庫低下"   color={PLX_RED}   bg={PLX_RED_LIGHT}/>
          <QuickChip on={quickFilters.includes("expire")} onClick={() => toggleQuick("expire")} dot={PLX_WARN} label="期限間近"   color={PLX_WARN}  bg={PLX_WARN_BG}/>
          <QuickChip on={quickFilters.includes("reorder")} onClick={() => {
            // TODO: wire up after demo — needs `reorder_requested_at` column.
            // eslint-disable-next-line no-console
            console.log("[TODO] '再発注済' filter not yet wired to backend.");
            toggleQuick("reorder");
          }} check label="再発注済" color={PLX_MUTED} bg="#F3F4F6"/>
          <div style={{ width: 1, height: 20, background: PLX_BORDER, margin: "0 4px" }} />
          <span style={{ fontSize: 11, color: PLX_MUTED, fontWeight: 600 }}>タグ</span>
          {(tagsQ.data?.items ?? []).slice(0, 6).map((t) => {
            const on = activeTags.includes(t.name);
            return (
              <button key={t.id} onClick={() => setActiveTags((s) =>
                s.includes(t.name) ? s.filter((x) => x !== t.name) : [...s, t.name],
              )} style={{
                fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 9999,
                border: `1px solid ${on ? PLX_GREEN : PLX_BORDER}`,
                background: on ? PLX_GREEN_LIGHT : T.PLX_CARD_BG,
                color: on ? PLX_GREEN : PLX_TEXT, cursor: "pointer",
              }}>{on && "✓ "}{t.name}</button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: 14, border: `1px solid ${PLX_BORDER}`,
        marginTop: 16, overflow: "hidden",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "40px 1.7fr 0.65fr 0.85fr 0.95fr 0.7fr 0.65fr 0.95fr 0.75fr 22px",
          padding: "12px 18px", fontSize: 11, fontWeight: 700, color: PLX_MUTED,
          background: PLX_GREEN_50, letterSpacing: ".03em",
          borderBottom: `1px solid ${PLX_BORDER}`, alignItems: "center", gap: 6,
        }}>
          <span><input type="checkbox" style={{ accentColor: PLX_GREEN }} /></span>
          <span>商品名</span>
          <span>種別</span>
          <span>カテゴリ</span>
          <span>仕入先</span>
          <span>SKU</span>
          <span style={{ textAlign: "right" }}>価格</span>
          <span style={{ textAlign: "right" }}>在庫</span>
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
          // Per-variant low-stock threshold (default 10 when missing).
          // See migration 005_low_stock_threshold.
          const threshold = p.default_low_stock_threshold != null ? p.default_low_stock_threshold : 10;
          const low = av <= threshold;
          const days = daysUntil(p.expiry_date);
          return (
            <div key={p.id} onClick={() => navigate(`/products/${p.id}`)} style={{
              display: "grid", gridTemplateColumns: "40px 1.7fr 0.65fr 0.85fr 0.95fr 0.7fr 0.65fr 0.95fr 0.75fr 22px",
              padding: "14px 18px", alignItems: "center", cursor: "pointer", gap: 6,
              borderBottom: i < items.length - 1 ? `1px solid ${PLX_BORDER}` : "none",
              transition: "background .12s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = PLX_GREEN_50)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <span onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" style={{ accentColor: PLX_GREEN }} />
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                <ProductThumb url={p.thumbnail_url} size={36} iconSize={16} />

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{p.name}</div>
                  {p.name_kana && (
                    <div style={{ fontSize: 10, color: PLX_SUBTLE, marginTop: 2,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{p.name_kana}</div>
                  )}
                  {p.tags?.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                      {p.tags.slice(0, 2).map((t) => (
                        <span key={t} style={{ fontSize: 9, fontWeight: 700,
                          color: PLX_GREEN, background: PLX_GREEN_LIGHT,
                          padding: "2px 6px", borderRadius: 9999,
                        }}>{t}</span>
                      ))}
                    </div>
                  )}
                  {p.match_reasons?.length > 0 && <MatchReasonPills reasons={p.match_reasons} />}
                </div>
              </div>
              <span>
                <KindPill itemType={p.item_type} />
              </span>
              <span style={{
                fontSize: 12, color: PLX_TEXT,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{p.category_name ?? "—"}</span>
              <span style={{
                fontSize: 12, color: PLX_TEXT,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{p.vendor_name ?? "—"}</span>
              <span style={{ fontSize: 11, color: PLX_MUTED,
                fontVariantNumeric: "tabular-nums",
                fontFamily: "ui-monospace,SFMono-Regular,monospace",
              }}>{p.default_sku ?? "—"}</span>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}>¥{formatYen(p.default_price)}</span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: low ? PLX_WARN : PLX_TEXT }}>{av}</span>
                  <span style={{ fontSize: 10, color: PLX_MUTED }}>個</span>
                </div>
                {p.item_type === "consumable" && days != null && <ExpiryIndicator days={days} />}
                {low && av > 0 && !(p.item_type === "consumable" && days != null && days <= 60) && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: PLX_WARN, marginTop: 2 }}>● 低在庫</div>
                )}
              </span>
              <span style={{ textAlign: "center", display: "flex",
                flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <StatusPill status={p.status} />
                {p.status === "draft" && (
                  canPublishFromList(p) ? (
                    <button
                      onClick={(e) => publishDraft(e, p)}
                      disabled={publishing === p.id}
                      title="この下書きをそのまま公開します"
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 9px",
                        borderRadius: 9999, border: "none",
                        background: PLX_GREEN, color: "#fff",
                        cursor: publishing === p.id ? "wait" : "pointer",
                        opacity: publishing === p.id ? 0.6 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {publishing === p.id ? "登録中…" : "✓ 登録"}
                    </button>
                  ) : (
                    <span title="商品名・カテゴリ・価格・種別が揃うと「登録」できます"
                      style={{
                        fontSize: 9, color: PLX_SUBTLE, whiteSpace: "nowrap",
                      }}>項目不足</span>
                  )
                )}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PLX_SUBTLE}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          );
        })}
        {!productsQ.loading && items.length === 0 && (
          <NoResultsState query={searchQ} />
        )}
      </div>
    </AdminShell>
  );
}

// 種別 pill: 物販 (green) / 消耗品 (blue). Yoshioka 2026-05-11.
function KindPill({ itemType }) {
  if (itemType === "consumable") {
    return <Pill color="#2563EB" bg={PLX_BLUE_LIGHT}>消耗品</Pill>;
  }
  return <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>物販</Pill>;
}

// Inline expiry indicator under the stock number on the list table.
function ExpiryIndicator({ days }) {
  if (days < 0) {
    return (
      <div style={{ marginTop: 3, display: "flex", justifyContent: "flex-end" }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: PLX_RED, background: PLX_RED_LIGHT,
          padding: "2px 7px", borderRadius: 9999,
        }}>期限切れ</span>
      </div>
    );
  }
  const color = days <= 30 ? PLX_RED : days <= 60 ? PLX_WARN : null;
  if (!color) return null;
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, color, marginTop: 2,
      display: "inline-flex", alignItems: "center", gap: 3,
      justifyContent: "flex-end", width: "100%",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      あと {days} 日
    </div>
  );
}

// Quick filter chip: dot + label, with a count badge on the right.
function QuickChip({ on, onClick, dot, check, label, color, bg }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 9999,
      border: `1px solid ${on ? color : PLX_BORDER}`,
      background: on ? bg : T.PLX_CARD_BG, color: on ? color : PLX_TEXT,
      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />}
      {check && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke={on ? color : PLX_MUTED} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}

// ─── search UX helpers (Tier-A search rollout 2026-05-18) ───────────────────

// Map a backend match_reasons[] string into a small pill. Names come from
// _build_product_search() in backend/app/routers/products.py.
const _MATCH_REASON_LABELS = {
  name:        { emoji: "📝", label: "商品名一致" },
  kana:        { emoji: "🔤", label: "ふりがな一致" },
  description: { emoji: "📄", label: "説明文一致" },
  sku:         { emoji: "🏷", label: "SKU 一致" },
  barcode:     { emoji: "📦", label: "JAN 一致" },
};

function MatchReasonPills({ reasons }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
      {reasons.map((r) => {
        const meta = _MATCH_REASON_LABELS[r];
        if (!meta) return null;
        return (
          <span key={r} title={`検索が ${meta.label} で一致しました`} style={{
            fontSize: 9, fontWeight: 700, color: "#0F766E",
            background: "#CCFBF1", padding: "2px 7px", borderRadius: 9999,
            border: "1px solid #5EEAD4",
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            <span style={{ fontSize: 10 }}>{meta.emoji}</span>
            <span>{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}

// Empty state for the product list. If the user has a search query active,
// offer to hand the query off to the AI Assist modal — the LLM can find
// products that aren't in the DB yet. Falls back to a plain message when
// the empty list is just "no filter matches".
function NoResultsState({ query }) {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: PLX_MUTED }}>
        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>—</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: PLX_TEXT, marginBottom: 4 }}>
          該当する商品がありません
        </div>
        <div style={{ fontSize: 12 }}>検索条件を変更するか、新しい商品を追加してください。</div>
      </div>
    );
  }
  return (
    <div style={{ padding: "44px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 6, opacity: 0.5 }}>🔍</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: PLX_TEXT, marginBottom: 4 }}>
        「{trimmed}」に一致する商品はありません
      </div>
      <div style={{ fontSize: 12, color: PLX_MUTED, marginBottom: 18 }}>
        商品名・SKU・JAN コードを再確認するか、AI に検索を依頼できます。
      </div>
      <button
        onClick={() => {
          // Stash the query and navigate to the new-product page. ProductCreate
          // checks this flag on mount and auto-opens the AI Assist modal.
          window.PLX_AI_PREFILL = { mode: "name", value: trimmed };
          navigate("/products/new");
        }}
        style={{
          height: 40, padding: "0 22px", borderRadius: 9999,
          background: PLX_GREEN, color: "#fff", border: "none",
          fontWeight: 700, fontSize: 13, cursor: "pointer",
          boxShadow: "0 6px 16px rgba(26,166,138,.25)",
          display: "inline-flex", alignItems: "center", gap: 8,
        }}
      >
        ✨ AI で「{trimmed}」を検索する
      </button>
    </div>
  );
}

window.ProductList = ProductList;
