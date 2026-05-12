// Product Detail — hero, variants table, history, sales chart, inventory adjust modal.

function ProductDetail({ productId }) {
  const productQ = useFetch(() => api.getProduct(productId), [productId]);
  const [tab, setTab] = React.useState("variants");
  const [adjustVariant, setAdjustVariant] = React.useState(null);

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

  const headerRight = (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={async () => {
        if (confirm("この商品をアーカイブしますか？")) {
          try { await api.archiveProduct(p.id); navigate("/products"); }
          catch (e) { alert("アーカイブに失敗しました: " + e.message); }
        }
      }} style={btnGhost}>… その他</button>
      <button style={btnSecondary}>編集</button>
    </div>
  );

  const sales = p.sales_summary;

  return (
    <AdminShell title={p.name} currentNav="products" headerRight={headerRight}
      breadcrumbs={["商品", p.category_name ?? "未分類", p.name]}>
      <button onClick={() => navigate("/products")} style={{
        background: "none", border: "none", color: PLX_MUTED,
        fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14,
        display: "inline-flex", alignItems: "center", gap: 4,
      }}>← 商品一覧へ戻る</button>

      {/* Hero */}
      <div style={{
        background: "#fff", borderRadius: 16, border: `1px solid ${PLX_BORDER}`,
        padding: "22px 26px", display: "grid",
        gridTemplateColumns: "160px 1fr auto", gap: 24, alignItems: "flex-start",
      }}>
        <div>
          <div style={{
            width: 160, height: 160, borderRadius: 14, background: PLX_GREEN_LIGHT,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${PLX_BORDER}`,
            backgroundImage: p.images?.[0] ? `url(${p.images[0].url})` : undefined,
            backgroundSize: "cover", backgroundPosition: "center",
          }}>
            {!p.images?.[0] && (
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={PLX_GREEN}
                strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.3 7 12 12 20.7 7"/>
                <line x1="12" y1="22" x2="12" y2="12"/>
              </svg>
            )}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <SectionLabel>{p.category_name ?? "未分類"}</SectionLabel>
            <StatusPill status={p.status} />
          </div>
          <h2 style={{
            fontSize: 28, fontWeight: 700, margin: 0,
            letterSpacing: "-.01em", lineHeight: 1.25,
          }}>{p.name}</h2>
          {p.name_kana && <div style={{ fontSize: 13, color: PLX_MUTED, marginTop: 4 }}>{p.name_kana}</div>}
          {p.description && (
            <div style={{ fontSize: 13, color: PLX_TEXT, marginTop: 14, lineHeight: 1.7 }}>
              {p.description}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            {(p.tags ?? []).map((t) => (
              <span key={t} style={{
                fontSize: 11, fontWeight: 600, color: PLX_GREEN,
                background: PLX_GREEN_LIGHT, padding: "4px 10px", borderRadius: 9999,
              }}>{t}</span>
            ))}
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3,auto)",
            gap: "6px 28px", marginTop: 18, fontSize: 12,
          }}>
            <KV k="仕入先" v={p.vendor_name ?? "—"} />
            <KV k="主要 SKU" v={heroVariant?.sku ?? "—"} mono />
            <KV k="JAN" v={heroVariant?.barcode ?? "—"} mono />
          </div>
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
        background: "#fff", borderRadius: 16, border: `1px solid ${PLX_BORDER}`,
        marginTop: 18, overflow: "hidden",
      }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${PLX_BORDER}`, padding: "0 22px" }}>
          {[
            { id: "variants", label: "バリアント" },
            { id: "history",  label: "在庫履歴" },
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
          <VariantsTable variants={variants} onAdjust={setAdjustVariant} />
        )}
        {tab === "history" && variants[0] && <InventoryHistory variantId={variants[0].id} />}
        {tab === "sales" && sales && (
          <SalesChart quantity={sales.last_90_days_quantity} revenue={sales.last_90_days_revenue} />
        )}
      </div>

      {adjustVariant && (
        <InventoryAdjustModal
          variant={adjustVariant}
          onClose={() => setAdjustVariant(null)}
          onApplied={() => { setAdjustVariant(null); productQ.refetch(); }}
        />
      )}
    </AdminShell>
  );
}

function KV({ k, v, mono }) {
  return (
    <>
      <span style={{ color: PLX_MUTED }}>{k}</span>
      <span style={{
        fontWeight: 700,
        fontFamily: mono ? "ui-monospace,SFMono-Regular,monospace" : "inherit",
      }}>{v}</span>
    </>
  );
}

function StatCard({ label, value, unit, sub, hint }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14,
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

function VariantsTable({ variants, onAdjust }) {
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
                border: `1px solid ${PLX_GREEN}`, background: "#fff", color: PLX_GREEN,
                cursor: "pointer",
              }}>在庫を調整</button>
              <button style={{
                fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 9999,
                border: `1px solid ${PLX_BORDER}`, background: "#fff", color: PLX_TEXT,
                cursor: "pointer",
              }}>編集</button>
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

function SalesChart({ quantity, revenue }) {
  // Simple mocked 12-week shape since backend only returns 90-day totals.
  const weeks = [6, 8, 4, 12, 9, 11, 7, 14, 10, 18, 15, Math.max(1, quantity % 20)];
  const max = Math.max(...weeks);
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
        <div style={{ fontSize: 11, color: PLX_MUTED }}>過去 12 週間 (週次)</div>
      </div>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 8, height: 140,
        padding: "0 4px", borderBottom: `1px solid ${PLX_BORDER}`,
      }}>
        {weeks.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: "100%", height: `${(v / max) * 120}px`,
              background: i === weeks.length - 1 ? PLX_GREEN : PLX_GREEN_LIGHT,
              borderRadius: "6px 6px 0 0", position: "relative",
            }}>
              <span style={{
                position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)",
                fontSize: 10, fontWeight: 700,
                color: i === weeks.length - 1 ? PLX_GREEN : PLX_MUTED,
              }}>{v}</span>
            </div>
          </div>
        ))}
      </div>
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
    border: `1px solid ${PLX_BORDER}`, background: "#fff",
    cursor: "pointer", fontWeight: 700, fontSize: 16, color: PLX_TEXT,
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,.4)",
      backdropFilter: "blur(4px)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: "24px 28px", width: 480,
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

window.ProductDetail = ProductDetail;
