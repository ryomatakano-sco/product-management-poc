// Ctrl+K / Cmd+K / "/" command palette.
//
// Single overlay that searches every resource at once via /search/global,
// shows the results grouped by kind, and lets the user navigate with
// arrow keys + Enter. Recent searches show as chips when the input is
// empty. A permanent "AI で『…』を検索" quick action sits at the bottom
// of the dropdown for anything not in the DB yet.
//
// State machine
//   idle       — input empty, recent-search chips shown
//   loading    — debounced query is in-flight
//   results    — hits returned (possibly empty)
//   error      — fetch failed
//
// The palette is mounted globally by AdminShell so every page gets it.
// Open it from anywhere via:
//   window.PLX_CMDK.open()  — programmatic
//   Ctrl+K / Cmd+K / "/"    — keyboard

(function () {
  const KIND_META = {
    product:  { label: "商品",     emoji: "📦", color: T.PLX_GREEN },
    vendor:   { label: "仕入先",   emoji: "🏢", color: "#2563EB" },
    po:       { label: "発注書",   emoji: "📋", color: "#7C3AED" },
    category: { label: "カテゴリ", emoji: "🏷",  color: "#DB2777" },
    branch:   { label: "院・店舗", emoji: "🏥", color: "#0891B2" },
  };

  // Simple debounce: returns a memoised value `delay` ms after the input
  // stops changing. Used so each keystroke doesn't fire a request.
  function useDebounced(value, delay) {
    const [v, setV] = React.useState(value);
    React.useEffect(() => {
      const h = setTimeout(() => setV(value), delay);
      return () => clearTimeout(h);
    }, [value, delay]);
    return v;
  }

  function CommandPalette({ open, onClose }) {
    const [q, setQ] = React.useState("");
    const debouncedQ = useDebounced(q, 220);
    const [phase, setPhase] = React.useState("idle"); // idle | loading | results | error
    const [hits, setHits] = React.useState([]);
    const [error, setError] = React.useState(null);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [recent, setRecent] = React.useState([]);
    const inputRef = React.useRef(null);

    // Refresh recent-search chips every time the palette opens.
    React.useEffect(() => {
      if (!open) return;
      setRecent(listRecentSearches("global"));
      setQ("");
      setHits([]);
      setError(null);
      setPhase("idle");
      setActiveIndex(0);
      // Auto-focus the input on next paint.
      setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    }, [open]);

    // Run the search when the debounced query changes.
    React.useEffect(() => {
      if (!open) return;
      const term = debouncedQ.trim();
      if (!term) {
        setHits([]);
        setPhase("idle");
        return;
      }
      let cancelled = false;
      setPhase("loading");
      api.globalSearch(term)
        .then((res) => {
          if (cancelled) return;
          setHits(res.hits || []);
          setError(null);
          setActiveIndex(0);
          setPhase("results");
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e.body?.detail || e.message || "検索に失敗しました");
          setPhase("error");
        });
      return () => { cancelled = true; };
    }, [debouncedQ, open]);

    // Always include an "AI で『…』を検索" quick action as the last row
    // when the user has typed something. Searchable products that don't
    // exist yet are the AI Assist modal's whole reason for existing.
    const aiAction = q.trim()
      ? { kind: "ai", title: `AI で「${q.trim()}」を検索`, subtitle: "未登録の商品も推測できます", href: null }
      : null;
    const totalRows = hits.length + (aiAction ? 1 : 0);

    // Keyboard handling on the input: arrow keys move selection, Enter
    // activates, Escape closes. Bound to the input so we don't compete
    // with the global open-shortcut listener in AdminShell.
    const onKeyDown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (totalRows ? (i + 1) % totalRows : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (totalRows ? (i - 1 + totalRows) % totalRows : 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        activate(activeIndex);
      }
    };

    const activate = (idx) => {
      // AI action is always the last row.
      if (aiAction && idx === hits.length) {
        rememberSearch("global", q);
        onClose();
        // The flag is read by ProductCreate on mount to auto-open the modal.
        window.PLX_AI_PREFILL = { mode: "name", value: q.trim() };
        navigate("/products/new");
        return;
      }
      const hit = hits[idx];
      if (!hit) return;
      rememberSearch("global", q);
      onClose();
      navigate(hit.href);
    };

    if (!open) return null;

    return (
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)",
        backdropFilter: "blur(4px)", zIndex: 200,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 100,
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: T.PLX_CARD_BG, borderRadius: 14, width: 640, maxWidth: "92%",
          maxHeight: "70vh", boxShadow: "0 24px 60px rgba(17,24,39,.32)",
          overflow: "hidden", display: "flex", flexDirection: "column",
          border: `1px solid ${T.PLX_LINE_200 || "#E5E7EB"}`,
        }}>
          {/* Input row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "14px 18px", borderBottom: `1px solid ${T.PLX_LINE_200 || "#E5E7EB"}`,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PLX_MUTED}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="商品 / 仕入先 / 発注書 / JAN / SKU を横断検索…"
              style={{
                flex: 1, height: 28, border: "none", 
                fontSize: 16, fontWeight: 500, color: PLX_TEXT,
                background: "transparent",
              }}
            />
            <kbd style={{
              fontSize: 10, color: PLX_MUTED, background: "#F3F4F6",
              padding: "2px 6px", borderRadius: 4, fontFamily: "ui-monospace",
              border: `1px solid ${T.PLX_LINE_200 || "#E5E7EB"}`,
            }}>Esc</kbd>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {phase === "idle" && (
              <RecentSearchesPanel
                recent={recent}
                onPick={(s) => setQ(s)}
                onClear={() => { clearRecentSearches("global"); setRecent([]); }}
              />
            )}

            {phase === "loading" && (
              <div style={{
                padding: "36px 18px", textAlign: "center", color: PLX_MUTED, fontSize: 12,
              }}>検索中…</div>
            )}

            {phase === "error" && (
              <div style={{
                padding: "20px 18px", color: PLX_WARN, fontSize: 12,
              }}>⚠ {error}</div>
            )}

            {phase === "results" && hits.length === 0 && (
              <div style={{
                padding: "30px 18px", textAlign: "center", color: PLX_MUTED, fontSize: 12,
              }}>
                該当する結果はありません。
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  下の「AI で検索」をお試しください。
                </div>
              </div>
            )}

            {(phase === "results" || (phase === "loading" && hits.length > 0)) && (
              <ResultGroups hits={hits} activeIndex={activeIndex} onPick={activate} />
            )}

            {aiAction && (
              <div
                onClick={() => activate(hits.length)}
                onMouseEnter={() => setActiveIndex(hits.length)}
                style={{
                  margin: "8px 8px 4px", padding: "10px 14px",
                  background: activeIndex === hits.length ? PLX_GREEN_50 : "#F9FAFB",
                  border: `1px dashed ${activeIndex === hits.length ? PLX_GREEN : T.PLX_LINE_200 || "#E5E7EB"}`,
                  borderRadius: 10, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <span style={{ fontSize: 20 }}>✨</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PLX_TEXT }}>
                    {aiAction.title}
                  </div>
                  <div style={{ fontSize: 11, color: PLX_MUTED }}>
                    {aiAction.subtitle}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, color: PLX_MUTED, background: T.PLX_CARD_BG,
                  border: `1px solid ${T.PLX_LINE_200 || "#E5E7EB"}`,
                  padding: "2px 6px", borderRadius: 4,
                }}>Enter</span>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div style={{
            padding: "8px 14px", fontSize: 10, color: PLX_MUTED,
            borderTop: `1px solid ${T.PLX_LINE_200 || "#E5E7EB"}`,
            display: "flex", gap: 14, alignItems: "center",
          }}>
            <span>↑↓ で移動</span>
            <span>Enter で選択</span>
            <span>Esc で閉じる</span>
            <span style={{ marginLeft: "auto" }}>横断検索</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── sub-components ────────────────────────────────────────────────────
  function RecentSearchesPanel({ recent, onPick, onClear }) {
    if (recent.length === 0) {
      return (
        <div style={{ padding: "30px 18px", textAlign: "center", color: PLX_MUTED, fontSize: 12 }}>
          何か入力してください。<br/>
          <span style={{ fontSize: 11 }}>商品名・SKU・JAN コード・仕入先名で横断検索できます。</span>
        </div>
      );
    }
    return (
      <div style={{ padding: "12px 14px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: PLX_MUTED, letterSpacing: ".05em" }}>
            最近の検索
          </span>
          <button onClick={onClear} style={{
            fontSize: 10, color: PLX_MUTED, background: "none", border: "none",
            cursor: "pointer", padding: 0,
          }}>履歴を消去</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {recent.map((s, i) => (
            <button key={i} onClick={() => onPick(s)} style={{
              fontSize: 12, padding: "5px 10px", borderRadius: 9999,
              background: "#F3F4F6", border: "none", cursor: "pointer",
              color: PLX_TEXT,
            }}>{s}</button>
          ))}
        </div>
      </div>
    );
  }

  function ResultGroups({ hits, activeIndex, onPick }) {
    // Preserve backend order but visually section by kind so the eye can
    // scan. We walk the array once and emit a header whenever the kind
    // changes — that keeps the index → row mapping linear and stable.
    const rows = [];
    let prevKind = null;
    hits.forEach((h, i) => {
      if (h.kind !== prevKind) {
        rows.push({ type: "header", kind: h.kind, key: `h-${h.kind}` });
        prevKind = h.kind;
      }
      rows.push({ type: "hit", hit: h, index: i, key: `${h.kind}-${h.id}` });
    });

    return (
      <div>
        {rows.map((r) => {
          if (r.type === "header") {
            const meta = KIND_META[r.kind] || { label: r.kind, emoji: "•", color: PLX_MUTED };
            return (
              <div key={r.key} style={{
                padding: "10px 16px 4px", fontSize: 10, fontWeight: 700,
                color: PLX_MUTED, letterSpacing: ".05em",
              }}>
                {meta.emoji} {meta.label}
              </div>
            );
          }
          const h = r.hit;
          const meta = KIND_META[h.kind] || { color: PLX_GREEN };
          const active = r.index === activeIndex;
          return (
            <div
              key={r.key}
              onClick={() => onPick(r.index)}
              onMouseEnter={() => {/* could update activeIndex; skipped to keep keyboard nav primary */}}
              style={{
                margin: "0 8px", padding: "8px 12px", borderRadius: 8,
                background: active ? PLX_GREEN_50 : "transparent",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
                borderLeft: `2px solid ${active ? meta.color : "transparent"}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: PLX_TEXT,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{h.title}</div>
                {h.subtitle && (
                  <div style={{
                    fontSize: 11, color: PLX_MUTED, marginTop: 2,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  }}>{h.subtitle}</div>
                )}
              </div>
              {active && (
                <span style={{
                  fontSize: 10, color: PLX_MUTED, background: T.PLX_CARD_BG,
                  border: `1px solid ${T.PLX_LINE_200 || "#E5E7EB"}`,
                  padding: "2px 6px", borderRadius: 4,
                }}>↵</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── global mount + shortcut binding ───────────────────────────────────
  // The palette state lives in this provider so any component can
  // PLX_CMDK.open() / close() without prop drilling.
  function CommandPaletteHost() {
    const [open, setOpen] = React.useState(false);
    React.useEffect(() => {
      // Expose imperative open/close globally.
      window.PLX_CMDK = {
        open:   () => setOpen(true),
        close:  () => setOpen(false),
        toggle: () => setOpen((o) => !o),
      };
      // Global keyboard shortcut. Ctrl+K / Cmd+K open. "/" opens unless
      // the user is already typing in an input/textarea/contenteditable.
      const onKey = (e) => {
        const tag = (e.target?.tagName || "").toLowerCase();
        const inField = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
        if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
          e.preventDefault();
          setOpen((o) => !o);
          return;
        }
        if (e.key === "/" && !inField) {
          e.preventDefault();
          setOpen(true);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);
    return <CommandPalette open={open} onClose={() => setOpen(false)} />;
  }

  window.CommandPalette = CommandPalette;
  window.CommandPaletteHost = CommandPaletteHost;
})();
