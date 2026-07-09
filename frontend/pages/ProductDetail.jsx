// Product Detail — hero, variants table, history, sales chart, inventory adjust modal.

function ProductDetail({ productId }) {
  const productQ = useFetch(() => api.getProduct(productId), [productId]);
  const [tab, setTab] = React.useState("variants");
  const [adjustVariant, setAdjustVariant] = React.useState(null);
  const [publishing, setPublishing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Same publish-from-list rule as ProductList: keep these consistent so the
  // user doesn't see "登録" available in one place but disabled in another.
  const canPublishProduct = (p) => {
    if (!p) return false;
    const hv = (p.variants || []).find((v) => v.is_default) || (p.variants || [])[0];
    return !!p.name && !!p.category_name && !!p.item_type
      && hv && hv.price != null && Number(hv.price) > 0;
  };

  const publishDraft = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      await api.updateProduct(productId, { status: "active" });
      if (window.PLX_TOAST?.success) window.PLX_TOAST.success("商品を公開しました");
      productQ.refetch();
    } catch (e) {
      const msg = e?.body?.detail || e?.message || "公開に失敗しました";
      if (window.PLX_TOAST?.error) window.PLX_TOAST.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  const doDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.archiveProduct(productId);
      if (window.PLX_TOAST?.success) window.PLX_TOAST.success("商品を削除しました");
      navigate("/products");
    } catch (e) {
      const msg = e?.body?.detail || e?.message || "削除に失敗しました";
      if (window.PLX_TOAST?.error) window.PLX_TOAST.error(msg);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (productQ.loading) {
    return <AdminShell title="読み込み中..." currentNav="products">
      <div style={{ padding: 60, textAlign: "center", color: PLX_MUTED }}>読み込み中...</div>
    </AdminShell>;
  }
  if (productQ.error || !productQ.data) {
    return <AdminShell title="商品が見つかりません" currentNav="products">
      <div style={{ padding: 60, textAlign: "center", color: PLX_WARN }}>
        商品の取得に失敗しました。
      </div>
    </AdminShell>;
  }

  const p = productQ.data;
  const variants = p.variants ?? [];
  const totalAvail = variants.reduce((s, v) => s + available(v), 0);
  const heroVariant = variants.find((v) => v.is_default) ?? variants[0];

  const isDraft = p.status === "draft";
  const canPublish = canPublishProduct(p);
  const headerRight = (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={() => setConfirmDelete(true)}
        style={{ ...btnGhost, color: "#B91C1C" }}
        title="この商品をアーカイブ（削除）します"
      >
        🗑 削除
      </button>
      <button
        onClick={() => navigate(`/products/${p.id}/edit`)}
        style={btnSecondary}
      >
        編集
      </button>
      {isDraft && (
        <button
          onClick={publishDraft}
          disabled={publishing || !canPublish}
          title={canPublish
            ? "この下書きを公開します"
            : "商品名・カテゴリ・種別・価格が揃うと公開できます"}
          style={{ ...btnPrimary, opacity: (publishing || !canPublish) ? 0.7 : 1 }}
        >
          {publishing ? "登録中…" : "✓ この商品を登録"}
        </button>
      )}
    </div>
  );

  const sales = p.sales_summary;

  // Brief §4.2: breadcrumb 「ホーム / 商品一覧 / <product>」, truncate after 32 chars.
  const truncatedName = p.name.length > 32 ? p.name.slice(0, 31) + "…" : p.name;
  return (
    <AdminShell currentNav="products" headerRight={headerRight}
      breadcrumbs={["ホーム", "商品一覧", truncatedName]}>
      <button onClick={() => navigate("/products")} style={{
        background: "none", border: "none", color: PLX_MUTED,
        fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14,
        display: "inline-flex", alignItems: "center", gap: 4,
      }}>← 商品一覧へ戻る</button>

      {/* Hero */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: 16, border: `1px solid ${PLX_BORDER}`,
        padding: "22px 26px", display: "grid",
        gridTemplateColumns: "160px 1fr auto", gap: 24, alignItems: "flex-start",
      }}>
        <div>
          <ProductThumb url={p.images?.[0]?.url} size={160} iconSize={56} alt={p.name} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <SectionLabel>{p.category_name ?? "未分類"}</SectionLabel>
            {/* Yoshioka 2026-05-11: 種別 badge next to category */}
            {p.item_type === "consumable"
              ? <Pill color="#2563EB" bg={PLX_BLUE_LIGHT}>消耗品</Pill>
              : <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>物販</Pill>}
            <StatusPill status={p.status} />
          </div>
          <h2 style={{
            fontSize: 26, fontWeight: 700, margin: 0,
            letterSpacing: "-.01em", lineHeight: 1.25,
          }}>{p.name}</h2>
          {p.name_kana && <div style={{ fontSize: 13, color: PLX_MUTED, marginTop: 4 }}>{p.name_kana}</div>}
          {p.description && (
            <div style={{ fontSize: 13, color: PLX_TEXT, marginTop: 12, lineHeight: 1.7 }}>
              {p.description}
            </div>
          )}

          {/* Basic info card (Yoshioka 2026-05-11): vendor / SKU / JAN + conditional rows */}
          <div style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 10,
            background: PLX_SURFACE, border: `1px solid ${PLX_BORDER}`,
            display: "flex", flexDirection: "column", gap: 9,
          }}>
            <BasicRow k="仕入先" v={p.vendor_name ?? "—"} />
            <BasicRow k="主要 SKU" v={heroVariant?.sku ?? "—"} mono />
            <BasicRow k="JAN" v={heroVariant?.barcode ?? "—"} mono />
            <BasicRow
              k="最終入荷日"
              v={p.last_received_at ? formatJpDateTime(p.last_received_at) : "入荷履歴なし"}
              mono={!!p.last_received_at}
            />
            {p.item_type === "consumable" && p.expiry_date && (
              <BasicRow
                k="使用期限"
                v={formatJpDate(p.expiry_date)}
                mono
                right={(() => {
                  const days = daysUntil(p.expiry_date);
                  const tone = expiryTone(days);
                  const color = tone === "red" ? PLX_RED : tone === "amber" ? PLX_WARN : PLX_MUTED;
                  const bg    = tone === "red" ? PLX_RED_LIGHT : tone === "amber" ? PLX_WARN_BG : "#F3F4F6";
                  return <Pill color={color} bg={bg}>{days < 0 ? "期限切れ" : `期限まで ${days} 日`}</Pill>;
                })()}
              />
            )}
            {p.item_type === "consumable" && p.lot_number && (
              <BasicRow k="ロット番号" v={p.lot_number} mono />
            )}
            {p.unit && (
              <BasicRow k="単位" v={p.unit} />
            )}
            {p.reorder_url && (
              <BasicRow
                k="発注先 URL"
                v={<UrlLink url={p.reorder_url} />}
                right={
                  <a href={p.reorder_url} target="_blank" rel="noopener noreferrer" style={{
                    height: 30, padding: "0 12px", borderRadius: 9999,
                    background: PLX_GREEN, color: "#fff", border: "none",
                    fontWeight: 700, fontSize: 11, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none",
                    boxShadow: "0 4px 10px rgba(26,166,138,.22)",
                  }}>🔗 再発注する</a>
                }
              />
            )}
          </div>

          {(p.tags ?? []).length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
              {(p.tags ?? []).map((t) => (
                <span key={t} style={{
                  fontSize: 11, fontWeight: 600, color: PLX_GREEN,
                  background: PLX_GREEN_LIGHT, padding: "4px 10px", borderRadius: 9999,
                }}>{t}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{
          background: PLX_GREEN_50, borderRadius: 12,
          padding: "16px 20px", minWidth: 200,
        }}>
          <div style={{ fontSize: 11, color: PLX_MUTED, fontWeight: 600 }}>利用可能在庫</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
            <span style={{
              fontSize: 36, fontWeight: 900, color: PLX_GREEN,
              letterSpacing: "-.02em", lineHeight: 1,
            }}>{totalAvail}</span>
            <span style={{ fontSize: 13, color: PLX_TEXT, fontWeight: 600 }}>個</span>
          </div>
          <div style={{ height: 1, background: PLX_BORDER, margin: "14px 0" }} />
          <div style={{
            display: "grid", gridTemplateColumns: "1fr auto",
            gap: "5px 8px", fontSize: 11,
          }}>
            <span style={{ color: PLX_MUTED }}>在庫数 (on_hand)</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {variants.reduce((s, v) => s + v.on_hand, 0)}
            </span>
            <span style={{ color: PLX_MUTED }}>引当中 (committed)</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              −{variants.reduce((s, v) => s + v.committed, 0)}
            </span>
            <span style={{ color: PLX_MUTED }}>使用不可</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              −{variants.reduce((s, v) => s + v.unavailable, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* 90-day stats */}
      {sales && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 18 }}>
          <StatCard label="販売数（直近90日）" value={String(sales.last_90_days_quantity)} unit="個" />
          <StatCard label="売上（直近90日）" value={`¥${formatYen(sales.last_90_days_revenue)}`} unit="" />
          <StatCard label="次回入荷予定" value="—" unit="" sub="発注書から自動計算予定" hint />
        </div>
      )}

      {/* Tabs */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: 16, border: `1px solid ${PLX_BORDER}`,
        marginTop: 18, overflow: "hidden",
      }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${PLX_BORDER}`, padding: "0 22px" }}>
          {[
            { id: "variants", label: "バリアント" },
            { id: "history",  label: "在庫履歴" },
            // ロット履歴 tab only for consumables (Yoshioka 2026-05-11)
            ...(p.item_type === "consumable" ? [{ id: "lots", label: "ロット履歴" }] : []),
            { id: "sales",    label: "売上推移" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "14px 16px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700,
              color: tab === t.id ? PLX_GREEN : PLX_MUTED,
              borderBottom: tab === t.id ? `2px solid ${PLX_GREEN}` : "2px solid transparent",
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "variants" && (
          <VariantsTable variants={variants} onAdjust={setAdjustVariant}
            onEdit={() => navigate(`/products/${p.id}/edit`)} />
        )}
        {tab === "history" && variants[0] && <InventoryHistory variantId={variants[0].id} />}
        {tab === "lots" && p.item_type === "consumable" && <LotHistory product={p} />}
        {tab === "sales" && sales && (
          <SalesChart productId={p.id} quantity={sales.last_90_days_quantity} revenue={sales.last_90_days_revenue} />
        )}
      </div>

      {adjustVariant && (
        <InventoryAdjustModal
          variant={adjustVariant}
          onClose={() => setAdjustVariant(null)}
          onApplied={() => { setAdjustVariant(null); productQ.refetch(); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          title="商品を削除しますか？"
          message={`「${p.name}」をアーカイブします。この操作は商品を一覧から非表示にしますが、関連する発注書・販売記録は保持されます。`}
          confirmLabel={deleting ? "削除中…" : "削除する"}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
          disabled={deleting}
        />
      )}
    </AdminShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmDeleteModal — generic two-step delete confirmation.
// Kept inside ProductDetail because it's the only page using it for now.
// If another page needs it, move to components/Atoms.jsx and expose on window.
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDeleteModal({ title, message, confirmLabel, onConfirm, onCancel, disabled }) {
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)",
      backdropFilter: "blur(4px)", zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.PLX_CARD_BG, borderRadius: 16, width: 420, maxWidth: "90%",
        boxShadow: "0 24px 60px rgba(17,24,39,.22)", padding: 24,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", background: "#FEE2E2",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 20,
          }}>⚠</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: PLX_TEXT, marginBottom: 6 }}>
              {title}
            </div>
            <div style={{ fontSize: 13, color: PLX_MUTED, lineHeight: 1.6 }}>
              {message}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} disabled={disabled} style={btnGhost}>
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            style={{
              height: 38, padding: "0 20px", borderRadius: 9999,
              background: "#DC2626", color: "#fff", border: "none",
              fontWeight: 700, fontSize: 13,
              cursor: disabled ? "wait" : "pointer",
              opacity: disabled ? 0.7 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// BasicRow: 90px label + flex value + optional right-aligned button/pill.
// Used in the basic info card on the hero (vendor / SKU / JAN / expiry / lot / reorder URL).
function BasicRow({ k, v, mono, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
      <span style={{ color: PLX_MUTED, minWidth: 90 }}>{k}</span>
      <span style={{
        fontWeight: 700, flex: 1, minWidth: 0,
        fontFamily: mono ? "ui-monospace,SFMono-Regular,monospace" : "inherit",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{v}</span>
      {right}
    </div>
  );
}

function UrlLink({ url }) {
  const truncated = url.length > 42 ? url.slice(0, 40) + "…" : url;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url} style={{
      color: PLX_GREEN, textDecoration: "none",
      fontFamily: "ui-monospace,SFMono-Regular,monospace",
      fontSize: 11, fontWeight: 600,
    }}>{truncated}</a>
  );
}

function StatCard({ label, value, unit, sub, hint }) {
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: 14,
      padding: "16px 20px", border: `1px solid ${PLX_BORDER}`,
    }}>
      <div style={{ fontSize: 11, color: PLX_MUTED, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 6 }}>
        <div style={{
          fontSize: 26, fontWeight: 900, letterSpacing: "-.02em",
          color: hint ? PLX_TEXT : PLX_GREEN, lineHeight: 1,
        }}>{value}</div>
        {unit && <div style={{ fontSize: 13, color: PLX_TEXT, fontWeight: 600 }}>{unit}</div>}
      </div>
      {sub && <div style={{ marginTop: 8, fontSize: 11, color: PLX_MUTED }}>{sub}</div>}
    </div>
  );
}

function VariantsTable({ variants, onAdjust, onEdit }) {
  return (
    <div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 1fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 1.4fr",
        padding: "12px 22px", fontSize: 11, fontWeight: 700, color: PLX_MUTED,
        background: PLX_GREEN_50, letterSpacing: ".03em",
        borderBottom: `1px solid ${PLX_BORDER}`, gap: 8,
      }}>
        <span>SKU / オプション</span>
        <span>バーコード</span>
        <span style={{ textAlign: "right" }}>価格</span>
        <span style={{ textAlign: "right" }}>原価</span>
        <span style={{ textAlign: "right" }}>在庫</span>
        <span style={{ textAlign: "right" }}>引当</span>
        <span style={{ textAlign: "right" }}>利用可能</span>
        <span style={{ textAlign: "right" }}>操作</span>
      </div>
      {variants.map((v, i) => {
        const av = available(v);
        return (
          <div key={v.id} style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 1.4fr",
            padding: "14px 22px", alignItems: "center", fontSize: 12, gap: 8,
            borderBottom: i < variants.length - 1 ? `1px solid ${PLX_BORDER}` : "none",
          }}>
            <div>
              <div style={{
                fontFamily: "ui-monospace,SFMono-Regular,monospace",
                fontSize: 11, color: PLX_MUTED,
              }}>{v.sku ?? "—"}</div>
              <div style={{
                fontSize: 13, fontWeight: 700, marginTop: 2,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {v.option1_value ?? "標準"}
                {v.is_default && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: PLX_GREEN,
                    background: PLX_GREEN_LIGHT, padding: "2px 7px", borderRadius: 9999,
                  }}>デフォルト</span>
                )}
              </div>
            </div>
            <span style={{
              fontFamily: "ui-monospace,SFMono-Regular,monospace",
              fontSize: 11, color: PLX_MUTED,
            }}>{v.barcode ?? "—"}</span>
            <span style={{
              textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums",
            }}>¥{formatYen(v.price)}</span>
            <span style={{
              textAlign: "right", color: PLX_MUTED, fontVariantNumeric: "tabular-nums",
            }}>¥{formatYen(v.cost)}</span>
            <span style={{
              textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600,
            }}>{v.on_hand}</span>
            <span style={{
              textAlign: "right", fontVariantNumeric: "tabular-nums", color: PLX_MUTED,
            }}>{v.committed}</span>
            <span style={{
              textAlign: "right", fontWeight: 700,
              color: av <= 10 ? PLX_WARN : PLX_TEXT,
              fontVariantNumeric: "tabular-nums",
            }}>{av}</span>
            <span style={{ textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button onClick={() => onAdjust(v)} style={{
                fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 9999,
                border: `1px solid ${PLX_GREEN}`, background: T.PLX_CARD_BG, color: PLX_GREEN,
                cursor: "pointer",
              }}>在庫を調整</button>
              <button
                onClick={() => onEdit && onEdit(v)}
                title="商品の編集ページを開きます"
                style={{
                  fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 9999,
                  border: `1px solid ${PLX_BORDER}`, background: T.PLX_CARD_BG, color: PLX_TEXT,
                  cursor: "pointer",
                }}
              >編集</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function InventoryHistory({ variantId }) {
  const q = useFetch(() => api.inventoryHistory(variantId, 50, 0), [variantId]);
  const reasonLabels = {
    manual: "手動", sale: "販売", purchase_order_received: "仕入",
    correction: "修正", damage: "破損", other: "その他",
  };
  const fieldLabels = { on_hand: "在庫", committed: "引当", unavailable: "使用不可" };

  if (q.loading) return <div style={{ padding: 30, textAlign: "center", color: PLX_MUTED }}>読み込み中...</div>;
  const items = q.data?.items ?? [];
  if (!items.length) return <div style={{ padding: 30, textAlign: "center", color: PLX_MUTED }}>履歴なし</div>;

  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "180px 110px 80px 130px 1fr",
        padding: "12px 22px", fontSize: 11, fontWeight: 700, color: PLX_MUTED,
        background: PLX_GREEN_50, letterSpacing: ".03em",
        borderBottom: `1px solid ${PLX_BORDER}`, gap: 10,
      }}>
        <span>日時</span><span>項目</span>
        <span style={{ textAlign: "right" }}>増減</span>
        <span>理由</span><span>備考</span>
      </div>
      {items.map((h, i) => (
        <div key={h.id} style={{
          display: "grid", gridTemplateColumns: "180px 110px 80px 130px 1fr",
          padding: "12px 22px", alignItems: "center", fontSize: 12, gap: 10,
          borderBottom: i < items.length - 1 ? `1px solid ${PLX_BORDER}` : "none",
        }}>
          <span style={{
            fontFamily: "ui-monospace,SFMono-Regular,monospace",
            fontSize: 11, color: PLX_MUTED,
          }}>{new Date(h.created_at).toLocaleString("ja-JP")}</span>
          <span style={{ fontWeight: 600 }}>{fieldLabels[h.field]}</span>
          <span style={{
            textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums",
            color: h.delta > 0 ? PLX_GREEN : PLX_WARN,
          }}>{h.delta > 0 ? "+" : ""}{h.delta}</span>
          <span>{reasonLabels[h.reason]}</span>
          <span style={{ color: PLX_MUTED }}>{h.note ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

function SalesChart({ productId, quantity, revenue }) {
  // Real weekly buckets from GET /products/:id/sales-weekly (JST weeks,
  // Monday start, refunds count negative). Replaced the fabricated shape
  // once sales history landed on this branch.
  const weeklyQ = useFetch(() => api.getProductSalesWeekly(productId), [productId]);
  const weeks = weeklyQ.data?.weeks ?? [];
  const values = weeks.map((w) => w.units);
  const max = Math.max(1, ...values);
  const fmtWeek = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  return (
    <div style={{ padding: "22px 26px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: PLX_MUTED, fontWeight: 600 }}>販売数</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: PLX_GREEN, letterSpacing: "-.02em" }}>
            {quantity}<span style={{ fontSize: 14, color: PLX_TEXT, marginLeft: 3 }}>個</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: PLX_MUTED, fontWeight: 600 }}>売上</div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-.02em" }}>
            ¥{formatYen(revenue)}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: PLX_MUTED }}>過去 12 週間 (週次・実売データ)</div>
      </div>
      {weeklyQ.loading && (
        <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: PLX_MUTED, fontSize: 12 }}>
          読み込み中…
        </div>
      )}
      {!weeklyQ.loading && (
        <>
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 8, height: 150,
            padding: "0 4px", borderBottom: `1px solid ${PLX_BORDER}`,
          }}>
            {weeks.map((w, i) => {
              const v = w.units;
              const isCurrent = i === weeks.length - 1;
              return (
                <div key={w.week_start} title={`${fmtWeek(w.week_start)} 週: ${v} 個 / ¥${formatYen(w.revenue)}`}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                  <div style={{
                    width: "100%", height: `${(Math.max(0, v) / max) * 110}px`, minHeight: 2,
                    background: v <= 0 ? PLX_BORDER : isCurrent ? PLX_GREEN : PLX_GREEN_LIGHT,
                    borderRadius: "6px 6px 0 0", position: "relative",
                  }}>
                    <span style={{
                      position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
                      fontSize: 10, fontWeight: 700,
                      color: isCurrent ? PLX_GREEN : PLX_MUTED,
                    }}>{v}</span>
                  </div>
                  <span style={{ fontSize: 9, color: PLX_SUBTLE, whiteSpace: "nowrap" }}>{fmtWeek(w.week_start)}</span>
                </div>
              );
            })}
          </div>
          {values.every((v) => v === 0) && (
            <div style={{ marginTop: 10, fontSize: 11, color: PLX_MUTED, textAlign: "center" }}>
              この12週間の販売実績はまだありません。
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InventoryAdjustModal({ variant, onClose, onApplied }) {
  const [field, setField]   = React.useState("on_hand");
  const [delta, setDelta]   = React.useState(1);
  const [reason, setReason] = React.useState("purchase_order_received");
  const [note, setNote]     = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError]   = React.useState(null);

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      await api.adjustInventory(variant.id, { field, delta, reason, note: note || null });
      onApplied();
    } catch (e) {
      setError(e.body?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pmBtn = {
    width: 34, height: 34, borderRadius: 9,
    border: `1px solid ${PLX_BORDER}`, background: T.PLX_CARD_BG,
    cursor: "pointer", fontWeight: 700, fontSize: 16, color: PLX_TEXT,
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,.4)",
      backdropFilter: "blur(4px)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.PLX_CARD_BG, borderRadius: 16, padding: "24px 28px", width: 480,
        boxShadow: "0 24px 60px rgba(17,24,39,.18)",
      }}>
        <SectionLabel>在庫調整</SectionLabel>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "6px 0 4px" }}>在庫を調整します</h3>
        <div style={{ fontSize: 12, color: PLX_MUTED, marginBottom: 18 }}>
          {variant.sku ?? "—"} · {variant.option1_value ?? "標準"}
        </div>

        <FormRow label="項目">
          <SegmentedControl value={field} onChange={setField} options={[
            { value: "on_hand",     label: "在庫数" },
            { value: "committed",   label: "引当" },
            { value: "unavailable", label: "使用不可" },
          ]} />
        </FormRow>

        <FormRow label="増減（プラスで追加・マイナスで減少）">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setDelta((d) => d - 1)} style={pmBtn}>−</button>
            <input type="number" value={delta}
              onChange={(e) => setDelta(parseInt(e.target.value) || 0)} style={{
                ...formInput, textAlign: "center", fontWeight: 700, fontSize: 16, width: 90,
              }} />
            <button onClick={() => setDelta((d) => d + 1)} style={pmBtn}>＋</button>
            <span style={{ fontSize: 12, color: PLX_MUTED, marginLeft: 8 }}>
              個 (現在: <b>{variant[field]}</b>)
            </span>
          </div>
        </FormRow>

        <FormRow label="理由">
          <select value={reason} onChange={(e) => setReason(e.target.value)} style={formInput}>
            <option value="purchase_order_received">仕入入荷</option>
            <option value="sale">販売</option>
            <option value="correction">修正</option>
            <option value="damage">破損</option>
            <option value="manual">手動</option>
            <option value="other">その他</option>
          </select>
        </FormRow>

        <FormRow label="メモ（任意）">
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="例: PO-2026-0421 入荷分" style={{
              ...formInput, height: 64, resize: "none", padding: "10px 14px",
            }} />
        </FormRow>

        {error && <div style={{ fontSize: 11, color: PLX_WARN, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={btnGhost}>キャンセル</button>
          <button onClick={submit} disabled={submitting} style={{
            ...btnPrimary, minWidth: 120, opacity: submitting ? 0.5 : 1,
          }}>{submitting ? "送信中..." : "調整を確定"}</button>
        </div>
      </div>
    </div>
  );
}

// Lot history tab (Yoshioka 2026-05-11). The PoC tracks one expiry per product;
// real per-lot tracking is future scope. We synthesize a current/depleted/expired
// row set from the product's current expiry + lot number so the tab isn't empty.
function LotHistory({ product }) {
  const rows = [
    {
      lot: product.lot_number || "—",
      date: product.expiry_date,
      qty: product.variants.reduce((s, v) => s + v.on_hand, 0),
      status: "current",
      arrived: null,
    },
    { lot: "LOT-2026A-012", date: "2026-04-02", qty: 0, status: "depleted", arrived: "2025-12-08" },
    { lot: "LOT-2025D-091", date: "2025-12-20", qty: 0, status: "expired",  arrived: "2025-08-15" },
  ];
  return (
    <div>
      <div style={{
        display: "grid", gridTemplateColumns: "160px 140px 100px 1fr 140px",
        padding: "12px 22px", fontSize: 11, fontWeight: 700, color: PLX_MUTED,
        background: PLX_GREEN_50, letterSpacing: ".03em",
        borderBottom: `1px solid ${PLX_BORDER}`, gap: 10,
      }}>
        <span>ロット番号</span>
        <span>使用期限</span>
        <span style={{ textAlign: "right" }}>残数</span>
        <span>ステータス</span>
        <span>入荷日</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "160px 140px 100px 1fr 140px",
          padding: "12px 22px", alignItems: "center", fontSize: 12, gap: 10,
          borderBottom: i < rows.length - 1 ? `1px solid ${PLX_BORDER}` : "none",
        }}>
          <span style={{ fontFamily: "ui-monospace,SFMono-Regular,monospace", fontSize: 11, fontWeight: 700 }}>{r.lot}</span>
          <span style={{ fontFamily: "ui-monospace,SFMono-Regular,monospace" }}>{formatJpDate(r.date)}</span>
          <span style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: r.qty === 0 ? PLX_MUTED : PLX_TEXT }}>{r.qty}</span>
          <span>
            {r.status === "current"  && <Pill color={PLX_GREEN} bg={PLX_GREEN_LIGHT}>● 使用中</Pill>}
            {r.status === "depleted" && <Pill color={PLX_MUTED} bg="#F3F4F6">使い切り</Pill>}
            {r.status === "expired"  && <Pill color={PLX_RED} bg={PLX_RED_LIGHT}>期限切れ</Pill>}
          </span>
          <span style={{ fontSize: 11, color: PLX_MUTED, fontFamily: "ui-monospace,SFMono-Regular,monospace" }}>
            {r.arrived ? formatJpDate(r.arrived) : "—"}
          </span>
        </div>
      ))}
      <div style={{ padding: "14px 22px", fontSize: 11, color: PLX_MUTED, lineHeight: 1.6 }}>
        ※ ロット単位の在庫追跡は今後対応予定です（FUTURE SCOPE — see CHANGES.md）。現状は商品単位の使用期限のみ管理しています。
      </div>
    </div>
  );
}

window.ProductDetail = ProductDetail;
window.PlxInventoryAdjustModal = InventoryAdjustModal;  // reused by the 在庫 page's adjust flow
