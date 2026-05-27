// Toast — bottom-right stack, dismissed automatically.
// Imperative API exposed on `window.PLX_TOAST` so any code can fire:
//   window.PLX_TOAST.success("商品を登録しました")
//   window.PLX_TOAST.error("削除に失敗しました")
//   window.PLX_TOAST.warn("入力を確認してください")
// Mount the container once at the root via <ToastContainer/>.

(function () {
  let nextId = 1;
  const listeners = new Set();
  const state = { items: [] };

  function emit() {
    listeners.forEach((l) => l(state.items));
  }
  function add(variant, message, ttl) {
    const id = nextId++;
    state.items = [...state.items, { id, variant, message }];
    emit();
    setTimeout(() => {
      state.items = state.items.filter((x) => x.id !== id);
      emit();
    }, ttl);
  }

  window.PLX_TOAST = {
    success: (m) => add("success", m, 4000),
    error:   (m) => add("error",   m, 6000),
    warn:    (m) => add("warn",    m, 5000),
  };
  // Sub function for the container component below.
  window.__plxToastSubscribe = function (cb) {
    listeners.add(cb);
    cb(state.items);
    return () => listeners.delete(cb);
  };
})();

function ToastContainer() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => window.__plxToastSubscribe(setItems), []);
  if (!items.length) return null;
  const palette = {
    success: { bg: PLX_GREEN_LIGHT, fg: T.PLX_GREEN_700, border: T.PLX_GREEN_300 },
    error:   { bg: T.PLX_RED_100, fg: T.PLX_RED_600,   border: T.PLX_RED_600 },
    warn:    { bg: T.PLX_AMBER_100, fg: T.PLX_AMBER_600, border: T.PLX_AMBER_600 },
  };
  return (
    <div style={{
      position: "fixed", right: 24, bottom: 24, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10,
      pointerEvents: "none", // each toast re-enables its own pointer events
    }}>
      {items.map((t) => {
        const p = palette[t.variant] || palette.success;
        return (
          <div key={t.id} style={{
            pointerEvents: "auto",
            minWidth: 280, maxWidth: 380,
            background: T.PLX_CARD_BG, border: `1px solid ${p.border}`,
            borderLeft: `4px solid ${p.border}`,
            borderRadius: T.RADIUS_MD, boxShadow: T.SHADOW_LG,
            padding: "12px 16px",
            fontSize: 13, color: T.PLX_INK_900,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: p.fg, flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>{t.message}</div>
          </div>
        );
      })}
    </div>
  );
}

window.ToastContainer = ToastContainer;
