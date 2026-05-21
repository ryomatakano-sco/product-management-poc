// AI Model Arena — dev-only.
//
// Click "🧪 AI モデル比較" in the DevPanel to open. Lets you A/B several
// OpenAI models against the same JAN/title in one go, then renders the
// results as side-by-side columns so you can scan which model produced
// which candidates.
//
// Backend: POST /ai-suggestions/compare (see backend/app/routers/ai_suggestions.py).
// Persistence: model selection is saved to localStorage so reload doesn't
// reset your picks.
//
// Not loaded on any user-facing page — DevPanel is gated behind an
// opt-in dev affordance.

(function () {
  const _STORAGE_KEY = "sco.modelArena.models.v1";
  // Defaults are the same family currently in production. Edit by typing in
  // the "+ Add custom..." box; selections persist via localStorage.
  const _DEFAULT_OPTIONS = ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"];

  function _loadModels() {
    try {
      const raw = localStorage.getItem(_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
          return parsed;
        }
      }
    } catch { /* storage disabled / corrupt — ignore */ }
    return ["gpt-4.1-mini", "gpt-4.1-nano"];  // sensible default pair
  }
  function _saveModels(list) {
    try { localStorage.setItem(_STORAGE_KEY, JSON.stringify(list)); }
    catch { /* swallow */ }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Root component. Renders nothing when closed; mounted by window.PLX_AI_ARENA.
  // ──────────────────────────────────────────────────────────────────────
  function AiArena({ open, onClose }) {
    const [jan, setJan]     = React.useState("");
    const [title, setTitle] = React.useState("");
    const [mode, setMode]   = React.useState("jan"); // jan | name
    const [selected, setSelected] = React.useState(_loadModels);
    const [customInput, setCustomInput] = React.useState("");
    const [running, setRunning] = React.useState(false);
    const [result, setResult]   = React.useState(null);
    const [error, setError]     = React.useState(null);
    // Persist selection on every change so we don't lose it on reload.
    React.useEffect(() => { _saveModels(selected); }, [selected]);

    if (!open) return null;

    const knownOptions = Array.from(new Set([..._DEFAULT_OPTIONS, ...selected]));

    const toggleModel = (m) => {
      setSelected((s) => s.includes(m) ? s.filter((x) => x !== m) : [...s, m]);
    };
    const addCustom = () => {
      const v = customInput.trim();
      if (!v) return;
      if (!selected.includes(v)) setSelected((s) => [...s, v]);
      setCustomInput("");
    };

    const run = async () => {
      if (running) return;
      const body = { models: selected };
      if (mode === "jan" && jan.trim())   body.jan = jan.trim();
      if (mode === "name" && title.trim()) body.title = title.trim();
      if (!body.jan && !body.title) {
        setError("JAN または商品名を入力してください");
        return;
      }
      if (selected.length === 0) {
        setError("少なくとも 1 つのモデルを選んでください");
        return;
      }
      setRunning(true); setError(null); setResult(null);
      try {
        const res = await api.compareAiSuggestion(body);
        setResult(res);
      } catch (e) {
        setError(e.body?.detail || e.message || "比較リクエストに失敗しました");
      } finally {
        setRunning(false);
      }
    };

    return (
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)",
        backdropFilter: "blur(4px)", zIndex: 250,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 40, overflow: "auto",
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: "#fff", borderRadius: 14, width: "min(1280px, 96%)",
          maxHeight: "92vh", boxShadow: "0 24px 60px rgba(17,24,39,.35)",
          overflow: "hidden", display: "flex", flexDirection: "column",
          border: `1px solid ${PLX_BORDER}`,
        }}>
          <ArenaHeader onClose={onClose} />

          <div style={{ padding: "14px 22px", borderBottom: `1px solid ${PLX_BORDER}` }}>
            <ArenaInputs
              mode={mode} setMode={setMode}
              jan={jan} setJan={setJan}
              title={title} setTitle={setTitle}
            />
            <ArenaModelPicker
              options={knownOptions}
              selected={selected}
              onToggle={toggleModel}
              customInput={customInput}
              setCustomInput={setCustomInput}
              onAddCustom={addCustom}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <button
                onClick={run}
                disabled={running}
                style={{
                  height: 38, padding: "0 22px", borderRadius: 9999,
                  background: PLX_GREEN, color: "#fff", border: "none",
                  fontWeight: 700, fontSize: 13,
                  cursor: running ? "wait" : "pointer",
                  opacity: running ? 0.6 : 1,
                }}
              >
                {running ? "実行中…" : `▶ ${selected.length} モデルで実行`}
              </button>
              {error && (
                <span style={{ color: PLX_RED, fontSize: 12, fontWeight: 600 }}>⚠ {error}</span>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", background: "#FAFBFC" }}>
            {!result && !running && (
              <div style={{ padding: 40, textAlign: "center", color: PLX_MUTED, fontSize: 13 }}>
                JAN または商品名を入力し、比較したいモデルを選んで「実行」を押してください。
              </div>
            )}
            {running && (
              <div style={{ padding: 40, textAlign: "center", color: PLX_MUTED, fontSize: 13 }}>
                各モデルで AI 検索を実行中…（通常 15〜30 秒）
              </div>
            )}
            {result && <ArenaResults result={result} />}
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Sub-components
  // ──────────────────────────────────────────────────────────────────────

  function ArenaHeader({ onClose }) {
    return (
      <div style={{
        padding: "16px 22px", borderBottom: `1px solid ${PLX_BORDER}`,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ fontSize: 20 }}>🧪</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: PLX_TEXT }}>
            AI モデル比較 — 開発者向け
          </div>
          <div style={{ fontSize: 11, color: PLX_MUTED, marginTop: 2 }}>
            同じ JAN を複数モデルに投げて、どの結果が最良かを並べて確認します。
            UI には影響しません。
          </div>
        </div>
        <button onClick={onClose} title="閉じる" style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 22, color: PLX_MUTED, lineHeight: 1, padding: 4,
        }}>×</button>
      </div>
    );
  }

  function ArenaInputs({ mode, setMode, jan, setJan, title, setTitle }) {
    return (
      <div>
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {[{v:"jan", l:"JAN"}, {v:"name", l:"商品名"}].map((o) => {
            const on = mode === o.v;
            return (
              <button key={o.v} onClick={() => setMode(o.v)} style={{
                fontSize: 11, fontWeight: 700, padding: "4px 12px",
                borderRadius: 9999, border: `1px solid ${on ? PLX_GREEN : PLX_BORDER}`,
                background: on ? PLX_GREEN_50 : "#fff",
                color: on ? PLX_GREEN : PLX_MUTED, cursor: "pointer",
              }}>{o.l}</button>
            );
          })}
        </div>
        {mode === "jan" ? (
          <input value={jan} onChange={(e) => setJan(e.target.value)}
            placeholder="例: 4901616007468" inputMode="numeric"
            style={{
              width: "100%", height: 38, padding: "0 14px", fontSize: 14,
              border: `1px solid ${PLX_BORDER}`, borderRadius: 8,
              outline: "none", fontFamily: "ui-monospace, monospace",
              boxSizing: "border-box",
            }} />
        ) : (
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="例: GUM デンタルブラシ #211"
            style={{
              width: "100%", height: 38, padding: "0 14px", fontSize: 14,
              border: `1px solid ${PLX_BORDER}`, borderRadius: 8,
              outline: "none", boxSizing: "border-box",
            }} />
        )}
      </div>
    );
  }

  function ArenaModelPicker({ options, selected, onToggle, customInput, setCustomInput, onAddCustom }) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: PLX_MUTED, marginBottom: 6 }}>
          比較するモデル ({selected.length})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {options.map((m) => {
            const on = selected.includes(m);
            return (
              <button key={m} onClick={() => onToggle(m)} style={{
                fontSize: 11, fontWeight: 700, padding: "4px 11px",
                borderRadius: 9999, border: `1px solid ${on ? PLX_GREEN : PLX_BORDER}`,
                background: on ? PLX_GREEN_50 : "#fff",
                color: on ? PLX_GREEN : PLX_TEXT,
                cursor: "pointer", fontFamily: "ui-monospace, monospace",
              }}>
                {on ? "✓ " : ""}{m}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onAddCustom(); }}
            placeholder="+ 任意のモデル ID を追加 (例: gpt-5-mini, o4-mini)"
            style={{
              flex: 1, height: 28, padding: "0 10px", fontSize: 11,
              border: `1px solid ${PLX_BORDER}`, borderRadius: 6,
              outline: "none", fontFamily: "ui-monospace, monospace",
            }}
          />
          <button onClick={onAddCustom} disabled={!customInput.trim()} style={{
            height: 28, padding: "0 12px", borderRadius: 6,
            border: `1px solid ${PLX_BORDER}`, background: "#fff",
            color: PLX_TEXT, fontSize: 11, fontWeight: 700,
            cursor: customInput.trim() ? "pointer" : "not-allowed",
            opacity: customInput.trim() ? 1 : 0.5,
          }}>追加</button>
        </div>
      </div>
    );
  }

  function ArenaResults({ result }) {
    // Side-by-side columns, one per model. Min-width per column so very
    // narrow viewports get horizontal scroll instead of squishing.
    const n = result.results.length;
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${n}, minmax(320px, 1fr))`,
        gap: 12, padding: 14,
      }}>
        {result.results.map((r) => (
          <ArenaResultColumn key={r.model} r={r} />
        ))}
      </div>
    );
  }

  function ArenaResultColumn({ r }) {
    const [showNotes, setShowNotes] = React.useState(false);
    const fieldGroups = React.useMemo(() => {
      // Group candidates by field_name for readability.
      const m = {};
      (r.candidates || []).forEach((c) => {
        (m[c.field_name] = m[c.field_name] || []).push(c);
      });
      return m;
    }, [r.candidates]);
    const fieldNames = Object.keys(fieldGroups).sort();
    const candidateCount = (r.candidates || []).length;
    const verifiedCount = (r.candidates || []).filter((c) => c.jan_verified).length;
    return (
      <div style={{
        background: "#fff", border: `1px solid ${PLX_BORDER}`, borderRadius: 10,
        padding: 12, display: "flex", flexDirection: "column", gap: 8,
        maxHeight: "65vh", overflow: "auto",
      }}>
        <div style={{ borderBottom: `1px solid ${PLX_BORDER}`, paddingBottom: 8 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: PLX_TEXT,
            fontFamily: "ui-monospace, monospace",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>{r.model}</span>
            {r.found
              ? <span style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: 9999,
                  background: PLX_GREEN_LIGHT, color: PLX_GREEN, fontWeight: 700,
                }}>FOUND</span>
              : <span style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: 9999,
                  background: "#FEE2E2", color: PLX_RED, fontWeight: 700,
                }}>NOT FOUND</span>}
          </div>
          <div style={{ fontSize: 10, color: PLX_MUTED, marginTop: 4 }}>
            {r.wall_time_ms} ms · {candidateCount} 候補 ·
            {" "}{verifiedCount}/{candidateCount} JAN URL 一致
          </div>
        </div>

        {r.error_message && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 6,
            padding: "8px 10px", fontSize: 11, color: "#991B1B",
          }}>
            <b>エラー:</b> {r.error_message}
          </div>
        )}

        {!r.error_message && fieldNames.length === 0 && (
          <div style={{ fontSize: 11, color: PLX_MUTED, padding: "12px 4px", textAlign: "center" }}>
            候補なし
          </div>
        )}

        {fieldNames.map((name) => (
          <div key={name}>
            <div style={{ fontSize: 10, fontWeight: 700, color: PLX_MUTED, marginBottom: 3, letterSpacing: ".03em" }}>
              {name}
            </div>
            {fieldGroups[name].map((c, i) => (
              <ArenaCandidate key={i} c={c} />
            ))}
          </div>
        ))}

        {(r.dropped_candidates || []).length > 0 && (
          <div style={{
            marginTop: 6, padding: 8, background: "#FEF9E7", borderRadius: 6,
            border: "1px solid #FCD34D",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>
              ドロップされた候補 ({r.dropped_candidates.length})
            </div>
            {r.dropped_candidates.map((d, i) => (
              <div key={i} style={{ fontSize: 10, color: "#92400E", marginTop: 2 }}>
                <code>{d.field_name}</code> = {d.value || "—"}
                <div style={{ fontSize: 9, opacity: 0.8 }}>{d.reason}</div>
              </div>
            ))}
          </div>
        )}

        {r.raw_search_notes && (
          <div style={{ marginTop: 6 }}>
            <button onClick={() => setShowNotes((s) => !s)} style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: PLX_GREEN, fontSize: 10, fontWeight: 700, padding: 0,
            }}>
              {showNotes ? "▼" : "▶"} raw_search_notes
            </button>
            {showNotes && (
              <pre style={{
                marginTop: 4, padding: 8, background: "#F3F4F6", borderRadius: 6,
                fontSize: 10, lineHeight: 1.55, color: PLX_TEXT,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                maxHeight: 200, overflow: "auto",
              }}>{r.raw_search_notes}</pre>
            )}
          </div>
        )}
      </div>
    );
  }

  function ArenaCandidate({ c }) {
    const url = c.source_url;
    const verified = !!c.jan_verified;
    return (
      <div style={{
        background: "#FAFBFC", border: `1px solid ${PLX_BORDER}`, borderRadius: 6,
        padding: "6px 8px", marginBottom: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: PLX_TEXT, flex: 1, wordBreak: "break-word" }}>
            {c.value}
          </div>
          {verified && (
            <span title="ソース URL に JAN が含まれています" style={{
              fontSize: 9, fontWeight: 700, color: "#0F766E",
              background: "#CCFBF1", border: "1px solid #5EEAD4",
              padding: "1px 6px", borderRadius: 9999, flexShrink: 0,
            }}>✓ JAN</span>
          )}
        </div>
        <div style={{ fontSize: 9, color: PLX_MUTED, marginTop: 3,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: PLX_GREEN }}>
              {url}
            </a>
          ) : "(no source url)"}
          {c.confidence != null && <> · conf {c.confidence.toFixed(2)}</>}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Host: provides window.PLX_AI_ARENA and renders the modal.
  // Mounted globally by app.jsx the same way CommandPaletteHost is.
  // ──────────────────────────────────────────────────────────────────────
  function AiArenaHost() {
    const [open, setOpen] = React.useState(false);
    React.useEffect(() => {
      window.PLX_AI_ARENA = {
        open:   () => setOpen(true),
        close:  () => setOpen(false),
        toggle: () => setOpen((o) => !o),
      };
    }, []);
    return <AiArena open={open} onClose={() => setOpen(false)} />;
  }

  window.AiArena = AiArena;
  window.AiArenaHost = AiArenaHost;
})();
