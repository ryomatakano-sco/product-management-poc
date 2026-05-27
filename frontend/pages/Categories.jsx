// Categories page — two-pane layout matching brief §4.5.
//
// Left: tree view from GET /categories/tree (single fetch, recursive children
// + product_count baked in by the backend).
// Right: selected node detail card + edit/delete buttons.
// Create + edit use the same modal.
//
// Delete error → reads `code: CONFLICT_HAS_DEPENDENTS` from the error body
// and shows a useful message instead of a generic 409.

function Categories() {
  const treeQ = useFetch(() => api.getCategoryTree(), []);
  const [selectedId, setSelectedId] = React.useState(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null); // null = create

  // Flatten the tree into a {id: node} map so the right-pane card can find
  // the selected node without re-traversing.
  const tree = treeQ.data ?? [];
  const flatMap = React.useMemo(() => {
    const out = {};
    const walk = (nodes) => {
      for (const n of nodes) {
        out[n.id] = n;
        if (n.children?.length) walk(n.children);
      }
    };
    walk(tree);
    return out;
  }, [tree]);
  const selected = selectedId != null ? flatMap[selectedId] : null;

  // Default-pick the first top-level node when the tree first loads.
  React.useEffect(() => {
    if (selectedId == null && tree.length > 0) setSelectedId(tree[0].id);
  }, [tree, selectedId]);

  const refetch = () => treeQ.refetch();

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (node) => { setEditing(node); setModalOpen(true); };

  const onDelete = async (node) => {
    if (!confirm(`「${node.name}」 を削除しますか？`)) return;
    try {
      await api.deleteCategory(node.id);
      window.PLX_TOAST.success(`カテゴリ「${node.name}」 を削除しました`);
      if (selectedId === node.id) setSelectedId(null);
      refetch();
    } catch (e) {
      const detail = e.body?.detail?.detail || e.body?.detail || "削除に失敗しました";
      window.PLX_TOAST.error(detail);
    }
  };

  const headerRight = (
    <button onClick={openCreate} style={{
      height: 38, padding: "0 18px", borderRadius: 9999,
      background: PLX_GREEN, color: "#fff", border: "none",
      fontWeight: 700, fontSize: 13, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      boxShadow: "0 6px 16px rgba(22,163,108,.25)",
    }}>＋ カテゴリを追加</button>
  );

  // Count leaves recursively for the subtitle.
  const totalCount = (() => {
    let n = 0;
    const walk = (nodes) => nodes.forEach((x) => { n++; walk(x.children || []); });
    walk(tree);
    return n;
  })();

  return (
    <AdminShell currentNav="categories" breadcrumbs={["ホーム", "カテゴリ"]}>
      <PageHead title="カテゴリ" subtitle={`商品を分類するカテゴリを管理します（全 ${totalCount} 件）`} right={headerRight} />

      {treeQ.error && <ErrorBanner error={treeQ.error} onRetry={refetch} />}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, alignItems: "flex-start" }}>
        {/* Left pane: tree */}
        <div style={{
          background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
          boxShadow: T.SHADOW_SM, padding: 6, minHeight: 320,
        }}>
          {treeQ.loading && <CategoriesSkeleton />}
          {!treeQ.loading && tree.length === 0 && (
            <EmptyState
              title="まだカテゴリがありません"
              message="最初のカテゴリを追加しましょう。"
              onAction={openCreate}
              actionLabel="＋ カテゴリを追加"
            />
          )}
          {!treeQ.loading && tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onEdit={openEdit}
              onDelete={onDelete}
            />
          ))}
        </div>

        {/* Right pane: detail */}
        <div style={{
          background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
          boxShadow: T.SHADOW_SM, padding: 22, minHeight: 320, position: "sticky", top: 24,
        }}>
          {!selected && !treeQ.loading && (
            <div style={{ color: T.PLX_INK_500, fontSize: 13, padding: "60px 0", textAlign: "center" }}>
              左のリストからカテゴリを選択してください。
            </div>
          )}
          {selected && (
            <CategoryDetail node={selected} onEdit={() => openEdit(selected)} onDelete={() => onDelete(selected)} />
          )}
        </div>
      </div>

      {modalOpen && (
        <CategoryFormModal
          editing={editing}
          allCategories={Object.values(flatMap)}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); refetch(); }}
        />
      )}
    </AdminShell>
  );
}

// ── Tree node row (recursive) ──────────────────────────────────────
function TreeNode({ node, depth, selectedId, onSelect, onEdit, onDelete }) {
  const [open, setOpen] = React.useState(true);
  const hasKids = (node.children || []).length > 0;
  const isActive = selectedId === node.id;
  return (
    <>
      <div
        onClick={() => onSelect(node.id)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: `8px 12px 8px ${12 + depth * 20}px`,
          borderRadius: T.RADIUS_MD, cursor: "pointer",
          background: isActive ? T.PLX_GREEN_100 : "transparent",
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = T.PLX_SURFACE_100; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
      >
        {hasKids ? (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            style={{
              width: 18, height: 18, border: "none", background: "transparent",
              cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.PLX_INK_500}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .1s" }}>
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        ) : (
          <span style={{ width: 18 }} />
        )}
        <span style={{
          width: 22, height: 22, borderRadius: "50%",
          background: node.color_hex || T.PLX_GREEN_500,
          flexShrink: 0, display: "inline-block",
        }} />
        <span style={{
          fontSize: 13, fontWeight: isActive ? 700 : 500,
          color: isActive ? T.PLX_GREEN_700 : T.PLX_INK_900, flex: 1,
        }}>{node.name}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, color: T.PLX_INK_500,
          background: T.PLX_SURFACE_100, padding: "2px 8px", borderRadius: 9999,
        }}>{node.product_count} 件</span>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(node); }}
          title="編集"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: T.PLX_INK_500, padding: "2px 6px",
          }}
        >✎</button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(node); }}
          title="削除"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: T.PLX_INK_500, padding: "2px 6px",
          }}
        >×</button>
      </div>
      {open && hasKids && node.children.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1}
          selectedId={selectedId} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  );
}

// ── Selected category detail (right pane) ──────────────────────────
function CategoryDetail({ node, onEdit, onDelete }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{
          width: 24, height: 24, borderRadius: "50%",
          background: node.color_hex || T.PLX_GREEN_500, flexShrink: 0,
        }} />
        <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, flex: 1 }}>{node.name}</h3>
        <Pill color={T.PLX_INK_500} bg={T.PLX_SURFACE_100}>{node.product_count} 件</Pill>
      </div>

      <DetailRow k="種別" v={appliesLabel(node.applies_to)} />
      <DetailRow k="デフォルト税率" v={`${parseFloat(node.default_tax_rate || 10)}%`} />
      <DetailRow k="カラー" v={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: node.color_hex || T.PLX_GREEN_500 }} />
          <code style={{ fontSize: 12, fontFamily: T.FONT_MONO }}>{node.color_hex || "—"}</code>
        </span>
      } />
      <DetailRow k="アイコン" v={node.icon_name || "—"} />
      <DetailRow k="並び順" v={node.sort_order} />
      {node.description && <DetailRow k="説明" v={node.description} />}

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={onEdit} style={btnSecondary}>編集</button>
        <button onClick={onDelete} style={{ ...btnGhost, color: T.PLX_RED_600 }}>削除</button>
      </div>
    </div>
  );
}

function DetailRow({ k, v }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "120px 1fr",
      padding: "8px 0", borderBottom: `1px solid ${T.PLX_LINE_100}`,
      fontSize: 13, alignItems: "center",
    }}>
      <span style={{ color: T.PLX_INK_500 }}>{k}</span>
      <span style={{ color: T.PLX_INK_900, fontWeight: 500 }}>{v}</span>
    </div>
  );
}

function appliesLabel(v) {
  if (v === "retail") return "物販品のみ";
  if (v === "consumable") return "消耗品のみ";
  return "両方";
}

// ── Create / Edit modal ────────────────────────────────────────────
function CategoryFormModal({ editing, allCategories, onClose, onSaved }) {
  const [name, setName] = React.useState(editing?.name || "");
  const [appliesTo, setAppliesTo] = React.useState(editing?.applies_to || "both");
  const [colorHex, setColorHex] = React.useState(editing?.color_hex || "#16A36C");
  const [iconName, setIconName] = React.useState(editing?.icon_name || "");
  const [sortOrder, setSortOrder] = React.useState(editing?.sort_order || 0);
  const [description, setDescription] = React.useState(editing?.description || "");
  const [taxRate, setTaxRate] = React.useState(parseFloat(editing?.default_tax_rate ?? 10));
  const [saving, setSaving] = React.useState(false);

  const SWATCHES = ["#16A36C", "#22B07A", "#2E7BD6", "#7AD3B0", "#E89B17", "#D6433A", "#9C56C0", "#5B6776"];

  const submit = async () => {
    if (!name.trim()) { window.PLX_TOAST.warn("カテゴリ名を入力してください"); return; }
    setSaving(true);
    try {
      const body = {
        name, applies_to: appliesTo, color_hex: colorHex, icon_name: iconName || null,
        sort_order: Number(sortOrder) || 0,
        description: description || null,
        default_tax_rate: Number(taxRate),
      };
      if (editing) {
        await api.updateCategory(editing.id, body);
        window.PLX_TOAST.success(`カテゴリ「${name}」 を更新しました`);
      } else {
        await api.createCategory(body);
        window.PLX_TOAST.success(`カテゴリ「${name}」 を作成しました`);
      }
      onSaved();
    } catch (e) {
      window.PLX_TOAST.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? "カテゴリを編集" : "カテゴリを追加"} onClose={onClose}>
      <FormRow label="カテゴリ名">
        <input value={name} onChange={(e) => setName(e.target.value)} style={formInput}
          placeholder="例：歯ブラシ" />
      </FormRow>
      <FormRow label="種別">
        <SegmentedControl value={appliesTo} onChange={setAppliesTo} options={[
          { value: "retail", label: "物販品" },
          { value: "consumable", label: "消耗品" },
          { value: "both", label: "両方" },
        ]}/>
      </FormRow>
      <FormRow label="カラー">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SWATCHES.map((c) => (
            <button key={c} onClick={() => setColorHex(c)} style={{
              width: 32, height: 32, borderRadius: 8,
              background: c, cursor: "pointer",
              border: colorHex === c ? `2px solid ${T.PLX_INK_900}` : `1px solid ${T.PLX_LINE_200}`,
              padding: 0,
            }} aria-label={c} />
          ))}
          <input value={colorHex} onChange={(e) => setColorHex(e.target.value)} style={{
            ...formInput, width: 120, fontFamily: T.FONT_MONO,
          }} />
        </div>
      </FormRow>
      <FormRow label="アイコン名（Lucide）">
        <input value={iconName} onChange={(e) => setIconName(e.target.value)} style={formInput}
          placeholder="例：Brush / Sparkle / ShieldCheck" />
      </FormRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormRow label="デフォルト税率 (%)">
          <input type="number" step="0.01" value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)} style={formInput} />
        </FormRow>
        <FormRow label="並び順">
          <input type="number" value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)} style={formInput} />
        </FormRow>
      </div>
      <FormRow label="説明（任意）">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{
          ...formInput, height: 80, padding: "10px 14px",
        }} />
      </FormRow>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button onClick={onClose} style={btnGhost}>キャンセル</button>
        <button onClick={submit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
          {saving ? "保存中..." : (editing ? "更新する" : "作成する")}
        </button>
      </div>
    </Modal>
  );
}

// ── Tiny reusable primitives used by Categories + other new pages ──
// Defined here on first use; future pages can pull them out into a shared
// module if/when we grow a real component library.

function Modal({ title, onClose, children }) {
  React.useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(15,27,45,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.PLX_CARD_BG, width: 560, maxWidth: "92%", maxHeight: "90%",
        overflowY: "auto", borderRadius: T.RADIUS_LG, boxShadow: T.SHADOW_LG,
        padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} aria-label="閉じる" style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 20, color: T.PLX_INK_500, padding: "4px 8px",
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ title, message, onAction, actionLabel }) {
  return (
    <div style={{
      padding: "48px 24px", textAlign: "center", color: T.PLX_INK_500,
    }}>
      <div style={{
        width: 80, height: 80, margin: "0 auto 16px",
        background: T.PLX_GREEN_100, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={T.PLX_GREEN_500}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.PLX_INK_900, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, marginBottom: 18 }}>{message}</div>
      {onAction && (
        <button onClick={onAction} style={btnPrimary}>{actionLabel}</button>
      )}
    </div>
  );
}

function ErrorBanner({ error, onRetry }) {
  const msg = error?.body?.detail?.detail || error?.body?.detail || error?.message || "エラーが発生しました";
  return (
    <div style={{
      background: T.PLX_RED_100, border: `1px solid ${T.PLX_RED_600}`,
      borderLeft: `4px solid ${T.PLX_RED_600}`,
      borderRadius: T.RADIUS_MD, padding: "12px 16px",
      marginBottom: 16, display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{ color: T.PLX_RED_600, fontSize: 13, flex: 1 }}>{msg}</span>
      {onRetry && (
        <button onClick={onRetry} style={{
          ...btnSecondary, fontSize: 12, height: 32, padding: "0 14px",
        }}>再読み込み</button>
      )}
    </div>
  );
}

function PageHead({ title, subtitle, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      gap: 16, marginBottom: 20,
    }}>
      <div>
        <h1 style={{
          margin: 0, fontSize: 28, fontWeight: 700,
          color: T.PLX_INK_900, letterSpacing: "-0.01em",
        }}>{title}</h1>
        {subtitle && <div style={{ marginTop: 6, fontSize: 14, color: T.PLX_INK_500 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function CategoriesSkeleton() {
  return (
    <div style={{ padding: 12 }}>
      {[0,1,2,3,4,5].map((i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
        }}>
          <div className="plx-skeleton" style={{ width: 22, height: 22, borderRadius: "50%" }} />
          <div className="plx-skeleton" style={{ width: 200, height: 14 }} />
          <div style={{ flex: 1 }} />
          <div className="plx-skeleton" style={{ width: 40, height: 14, borderRadius: 9999 }} />
        </div>
      ))}
    </div>
  );
}

window.Categories = Categories;
// Export the reusable primitives so other new pages can re-use them.
window.PlxModal = Modal;
window.PlxEmptyState = EmptyState;
window.PlxErrorBanner = ErrorBanner;
window.PlxPageHead = PageHead;
