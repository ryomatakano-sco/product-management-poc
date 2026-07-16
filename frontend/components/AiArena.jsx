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
  const _SIDE_BY_SIDE_KEY = "sco.modelArena.sideBySide.v1";
  const _HISTORY_KEY = "sco.modelArena.history.v1";
  const _LAST_RESULT_KEY = "sco.modelArena.lastResult.v1";
  const _MAX_HISTORY = 50;
  const _MAX_SIDE_BY_SIDE = 6;

  // Preset list — toggle any; custom IDs still work via the add box.
  const _DEFAULT_OPTIONS = [
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    "o3-mini",
    "o4-mini",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
  ];

  function _fmtUsd(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return `$${Number(n).toFixed(4)}`;
  }
  function _fmtJpy(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return `¥${Math.round(Number(n)).toLocaleString()}`;
  }
  function _sumCompareCostUsd(results) {
    return (results || []).reduce((s, r) => s + (Number(r.total_cost_usd) || 0), 0);
  }

  async function _copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  function _formatComparePayload(result, meta) {
    return JSON.stringify({ ...meta, result }, null, 2);
  }

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

  function _loadSideBySide() {
    try {
      const n = parseInt(localStorage.getItem(_SIDE_BY_SIDE_KEY), 10);
      if (Number.isFinite(n) && n >= 1 && n <= _MAX_SIDE_BY_SIDE) return n;
    } catch { /* ignore */ }
    return 2;
  }
  function _saveSideBySide(n) {
    try { localStorage.setItem(_SIDE_BY_SIDE_KEY, String(n)); }
    catch { /* swallow */ }
  }

  function _loadHistory() {
    try {
      const raw = localStorage.getItem(_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  }
  function _saveHistory(list) {
    try { localStorage.setItem(_HISTORY_KEY, JSON.stringify(list.slice(0, _MAX_HISTORY))); }
    catch { /* swallow */ }
  }
  function _pushHistory(entry) {
    const next = [entry, ..._loadHistory()].slice(0, _MAX_HISTORY);
    _saveHistory(next);
    return next;
  }
  function _saveLastResult(entry) {
    try { localStorage.setItem(_LAST_RESULT_KEY, JSON.stringify(entry)); }
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
    const [sideBySide, setSideBySide] = React.useState(_loadSideBySide);
    const [customInput, setCustomInput] = React.useState("");
    const [running, setRunning] = React.useState(false);
    const [result, setResult]   = React.useState(null);
    const [error, setError]     = React.useState(null);
    const [history, setHistory] = React.useState(_loadHistory);
    const [showHistory, setShowHistory] = React.useState(false);
    const [copyMsg, setCopyMsg] = React.useState(null);
    // Persist selection on every change so we don't lose it on reload.
    React.useEffect(() => { _saveModels(selected); }, [selected]);
    React.useEffect(() => { _saveSideBySide(sideBySide); }, [sideBySide]);

    const flashCopy = (label) => {
      setCopyMsg(label);
      const t = setTimeout(() => setCopyMsg(null), 2000);
      return () => clearTimeout(t);
    };

    const modelsToRun = React.useMemo(
      () => selected.slice(0, Math.min(sideBySide, selected.length)),
      [selected, sideBySide],
    );

    const dlg = useDialog({ onClose, enabled: open });

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

    const copyCurrent = async () => {
      if (!result) return;
      const meta = {
        copied_at: new Date().toISOString(),
        input_mode: mode,
        jan: jan.trim() || null,
        title: title.trim() || null,
        models_requested: modelsToRun,
        side_by_side: sideBySide,
      };
      try {
        await _copyText(_formatComparePayload(result, meta));
        flashCopy("Copied current result");
      } catch {
        setError("クリップボードへのコピーに失敗しました");
      }
    };

    const copyAllHistory = async () => {
      if (history.length === 0) return;
      try {
        await _copyText(JSON.stringify(history, null, 2));
        flashCopy(`Copied ${history.length} history entries`);
      } catch {
        setError("履歴のコピーに失敗しました");
      }
    };

    const clearHistory = () => {
      if (!history.length) return;
      if (!confirm(`履歴 ${history.length} 件をすべて削除しますか？`)) return;
      _saveHistory([]);
      setHistory([]);
    };

    const run = async () => {
      if (running) return;
      const body = { models: modelsToRun };
      if (mode === "jan" && jan.trim())   body.jan = jan.trim();
      if (mode === "name" && title.trim()) body.title = title.trim();
      if (!body.jan && !body.title) {
        setError("JAN または商品名を入力してください");
        return;
      }
      if (modelsToRun.length === 0) {
        setError("少なくとも 1 つのモデルを選んでください");
        return;
      }
      setRunning(true); setError(null); setResult(null);
      try {
        const res = await api.compareAiSuggestion(body);
        setResult(res);
        const entry = {
          at: new Date().toISOString(),
          input_mode: mode,
          jan: body.jan || null,
          title: body.title || null,
          models: modelsToRun,
          side_by_side: sideBySide,
          result: res,
        };
        _saveLastResult(entry);
        setHistory(_pushHistory(entry));
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
        <div {...dlg} aria-label="AI Arena" onClick={(e) => e.stopPropagation()} style={{
          background: T.PLX_CARD_BG, borderRadius: 14, width: "min(1280px, 96%)",
          maxHeight: "92vh", boxShadow: "0 24px 60px rgba(17,24,39,.35)",
          overflow: "hidden", display: "flex", flexDirection: "column",
          border: `1px solid ${PLX_BORDER}`,
        }}>
          <ArenaHeader
            onClose={onClose}
            hasResult={!!result}
            onCopy={copyCurrent}
            historyCount={history.length}
            showHistory={showHistory}
            onToggleHistory={() => setShowHistory((s) => !s)}
            onCopyHistory={copyAllHistory}
            onClearHistory={clearHistory}
            copyMsg={copyMsg}
          />

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
              sideBySide={sideBySide}
              onSideBySideChange={setSideBySide}
              modelsToRun={modelsToRun}
            />
            {showHistory && (
              <ArenaHistory
                history={history}
                onCopyAll={copyAllHistory}
                onClear={clearHistory}
              />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                onClick={run}
                disabled={running}
                style={{
                  height: 38, padding: "0 22px", borderRadius: T.RADIUS_PILL,
                  background: PLX_GREEN, color: T.PLX_ON_BRAND, border: "none",
                  fontWeight: 700, fontSize: 13,
                  cursor: running ? "wait" : "pointer",
                  opacity: running ? 0.6 : 1,
                }}
              >
                {running
                  ? "実行中…"
                  : `▶ ${modelsToRun.length} モデルを並べて実行`}
              </button>
              {selected.length > modelsToRun.length && (
                <span style={{ fontSize: 11, color: PLX_MUTED }}>
                  （選択 {selected.length} · 実行は先頭 {modelsToRun.length} 件）
                </span>
              )}
              {error && (
                <span style={{ color: PLX_RED, fontSize: 12, fontWeight: 600 }}>⚠ {error}</span>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", background: T.PLX_SURFACE_50 }}>
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

  const _arenaBtn = {
    height: 28, padding: "0 10px", borderRadius: T.RADIUS_SM,
    border: `1px solid ${PLX_BORDER}`, background: T.PLX_CARD_BG,
    color: PLX_TEXT, fontSize: 11, fontWeight: 700, cursor: "pointer",
  };

  function ArenaHeader({
    onClose, hasResult, onCopy, historyCount, showHistory,
    onToggleHistory, onCopyHistory, onClearHistory, copyMsg,
  }) {
    return (
      <div style={{
        padding: "16px 22px", borderBottom: `1px solid ${PLX_BORDER}`,
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <div style={{ fontSize: 20 }}>🧪</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: PLX_TEXT }}>
            AI モデル比較 — 開発者向け
          </div>
          <div style={{ fontSize: 11, color: PLX_MUTED, marginTop: 2 }}>
            同じ JAN を複数モデルに投げて、どの結果が最良かを並べて確認します。
            UI には影響しません。
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <button
              onClick={onCopy}
              disabled={!hasResult}
              title="現在の比較結果を JSON でコピー"
              style={{ ..._arenaBtn, opacity: hasResult ? 1 : 0.45, cursor: hasResult ? "pointer" : "not-allowed" }}
            >
              📋 結果をコピー
            </button>
            <button
              onClick={onToggleHistory}
              style={{
                ..._arenaBtn,
                borderColor: showHistory ? PLX_GREEN : PLX_BORDER,
                color: showHistory ? PLX_GREEN : PLX_TEXT,
              }}
            >
              🕘 履歴 ({historyCount})
            </button>
            <button
              onClick={onCopyHistory}
              disabled={historyCount === 0}
              title="保存済みの全履歴を JSON で一括コピー"
              style={{
                ..._arenaBtn, opacity: historyCount ? 1 : 0.45,
                cursor: historyCount ? "pointer" : "not-allowed",
              }}
            >
              📋 履歴をすべてコピー
            </button>
            {historyCount > 0 && (
              <button onClick={onClearHistory} style={{ ..._arenaBtn, color: PLX_RED }}>
                履歴を消去
              </button>
            )}
            {copyMsg && (
              <span style={{ fontSize: 11, color: PLX_GREEN, fontWeight: 700, alignSelf: "center" }}>
                ✓ {copyMsg}
              </span>
            )}
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
                borderRadius: T.RADIUS_PILL, border: `1px solid ${on ? PLX_GREEN : PLX_BORDER}`,
                background: on ? PLX_GREEN_50 : T.PLX_CARD_BG,
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
              fontFamily: "ui-monospace, monospace",
              boxSizing: "border-box",
            }} />
        ) : (
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="例: GUM デンタルブラシ #211"
            style={{
              width: "100%", height: 38, padding: "0 14px", fontSize: 14,
              border: `1px solid ${PLX_BORDER}`, borderRadius: 8,
              boxSizing: "border-box",
            }} />
        )}
      </div>
    );
  }

  function ArenaModelPicker({
    options, selected, onToggle, customInput, setCustomInput, onAddCustom,
    sideBySide, onSideBySideChange, modelsToRun,
  }) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 8, marginBottom: 6,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: PLX_MUTED }}>
            比較するモデル ({selected.length} 選択 · 実行 {modelsToRun.length})
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: PLX_MUTED, fontWeight: 600 }}>並べる数:</span>
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const on = sideBySide === n;
              return (
                <button
                  key={n}
                  onClick={() => onSideBySideChange(n)}
                  title={`最大 ${n} モデルを横並びで実行`}
                  style={{
                    fontSize: 11, fontWeight: 700, width: 28, height: 26,
                    borderRadius: T.RADIUS_SM,
                    border: `1px solid ${on ? PLX_GREEN : PLX_BORDER}`,
                    background: on ? PLX_GREEN_50 : T.PLX_CARD_BG,
                    color: on ? PLX_GREEN : PLX_TEXT,
                    cursor: "pointer",
                  }}
                >{n}</button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {options.map((m) => {
            const on = selected.includes(m);
            return (
              <button key={m} onClick={() => onToggle(m)} style={{
                fontSize: 11, fontWeight: 700, padding: "4px 11px",
                borderRadius: T.RADIUS_PILL, border: `1px solid ${on ? PLX_GREEN : PLX_BORDER}`,
                background: on ? PLX_GREEN_50 : T.PLX_CARD_BG,
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
              border: `1px solid ${PLX_BORDER}`, borderRadius: T.RADIUS_SM,
              fontFamily: "ui-monospace, monospace",
            }}
          />
          <button onClick={onAddCustom} disabled={!customInput.trim()} style={{
            height: 28, padding: "0 12px", borderRadius: T.RADIUS_SM,
            border: `1px solid ${PLX_BORDER}`, background: T.PLX_CARD_BG,
            color: PLX_TEXT, fontSize: 11, fontWeight: 700,
            cursor: customInput.trim() ? "pointer" : "not-allowed",
            opacity: customInput.trim() ? 1 : 0.5,
          }}>追加</button>
        </div>
      </div>
    );
  }

  function ArenaHistory({ history, onCopyAll, onClear }) {
    return (
      <div style={{
        marginTop: 12, padding: 10, borderRadius: 8,
        border: `1px solid ${PLX_BORDER}`, background: T.PLX_CARD_BG,
        maxHeight: 160, overflow: "auto",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
          position: "sticky", top: 0, background: T.PLX_CARD_BG,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: PLX_MUTED, flex: 1 }}>
            比較履歴 ({history.length})
          </span>
          <button onClick={onCopyAll} style={_arenaBtn}>📋 すべてコピー</button>
          <button onClick={onClear} style={{ ..._arenaBtn, color: PLX_RED }}>消去</button>
        </div>
        {history.map((h, i) => {
          const label = h.jan || h.title || "—";
          const rows = h.result?.results || [];
          const found = rows.filter((r) => r.found).length;
          const total = rows.length;
          const runCost = _sumCompareCostUsd(rows);
          return (
            <div key={`${h.at}-${i}`} style={{
              fontSize: 10, padding: "5px 0",
              borderTop: i ? `1px dashed ${PLX_BORDER}` : "none",
              fontFamily: "ui-monospace, monospace",
              color: PLX_TEXT,
            }}>
              <span style={{ color: PLX_MUTED }}>{h.at?.slice(0, 19).replace("T", " ")}</span>
              {" · "}{label}
              {" · "}{(h.models || []).join(", ")}
              {" · "}{found}/{total} found
              {runCost > 0 && <> · {_fmtUsd(runCost)}</>}
            </div>
          );
        })}
      </div>
    );
  }

  function ArenaResults({ result }) {
    // Side-by-side columns, one per model. Min-width per column so very
    // narrow viewports get horizontal scroll instead of squishing.
    const n = result.results.length;
    const totalUsd = _sumCompareCostUsd(result.results);
    const totalJpy = result.results.reduce(
      (s, r) => s + (Number(r.total_cost_jpy) || 0), 0,
    );
    const anyMock = result.results.some((r) => r.is_mock);
    return (
      <div>
        {totalUsd > 0 || anyMock ? (
          <div style={{
            padding: "10px 14px 0", fontSize: 11, color: PLX_MUTED,
            display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
          }}>
            <span style={{ fontWeight: 700, color: PLX_TEXT }}>Run cost (tokens, estimate)</span>
            <span>{_fmtUsd(totalUsd)} USD</span>
            <span>{_fmtJpy(totalJpy)}</span>
            {anyMock && <span style={{ color: PLX_WARN }}>mock — $0</span>}
            <span style={{ fontSize: 10 }}>Web search surcharges may apply beyond token estimate</span>
          </div>
        ) : null}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${n}, minmax(320px, 1fr))`,
          gap: 12, padding: 14,
        }}>
          {result.results.map((r) => (
            <ArenaResultColumn key={r.model} r={r} />
          ))}
        </div>
      </div>
    );
  }

  function ArenaCostPanel({ r }) {
    const breakdown = r.cost_breakdown || [];
    if (r.is_mock) {
      return (
        <div style={{
          marginTop: 6, padding: 8, background: T.PLX_PILL_BG, borderRadius: T.RADIUS_SM,
          fontSize: 10, color: PLX_MUTED,
        }}>
          Cost: mock mode ($0)
        </div>
      );
    }
    if (breakdown.length === 0 && r.total_cost_usd == null) return null;
    const unknownPricing = breakdown.some((b) => b.pricing_known === false);
    return (
      <div style={{
        marginTop: 6, padding: 8, background: T.PLX_BLUE_100, borderRadius: T.RADIUS_SM,
        border: `1px solid ${T.PLX_BLUE_600}`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.PLX_BLUE_600, marginBottom: 4 }}>
          Cost (estimate)
          {unknownPricing && (
            <span style={{ fontWeight: 600, color: PLX_WARN, marginLeft: 6 }}>
              · unknown model rate
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: PLX_TEXT, marginBottom: 6 }}>
          {_fmtUsd(r.total_cost_usd)} · {_fmtJpy(r.total_cost_jpy)}
        </div>
        {breakdown.map((b) => (
          <div key={`${b.step}-${b.model}`} style={{
            fontSize: 10, color: T.PLX_BLUE_600, marginTop: 3,
            fontFamily: "ui-monospace, monospace",
          }}>
            {b.step}: {b.model} — in {b.input_tokens?.toLocaleString()} / out {b.output_tokens?.toLocaleString()}
            {" · "}{_fmtUsd(b.cost_usd)}
            {b.cached_input_tokens > 0 && ` · cached ${b.cached_input_tokens}`}
          </div>
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
        background: T.PLX_CARD_BG, border: `1px solid ${PLX_BORDER}`, borderRadius: 10,
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
                  fontSize: 9, padding: "2px 7px", borderRadius: T.RADIUS_PILL,
                  background: PLX_GREEN_LIGHT, color: PLX_GREEN, fontWeight: 700,
                }}>FOUND</span>
              : <span style={{
                  fontSize: 9, padding: "2px 7px", borderRadius: T.RADIUS_PILL,
                  background: T.PLX_RED_100, color: PLX_RED, fontWeight: 700,
                }}>NOT FOUND</span>}
          </div>
          <div style={{ fontSize: 10, color: PLX_MUTED, marginTop: 4 }}>
            {r.wall_time_ms} ms · {candidateCount} 候補 ·
            {" "}{verifiedCount}/{candidateCount} JAN URL 一致
            {(r.total_cost_usd > 0 || r.is_mock) && (
              <> · <span style={{ color: PLX_TEXT, fontWeight: 600 }}>
                {_fmtUsd(r.total_cost_usd)}{r.is_mock ? " mock" : ""}
              </span></>
            )}
          </div>
        </div>

        <ArenaCostPanel r={r} />

        {r.error_message && (
          <div style={{
            background: T.PLX_RED_100, border: `1px solid ${T.PLX_RED_300}`, borderRadius: T.RADIUS_SM,
            padding: "8px 10px", fontSize: 11, color: T.PLX_RED_600,
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
            marginTop: 6, padding: 8, background: T.PLX_AMBER_100, borderRadius: T.RADIUS_SM,
            border: `1px solid ${T.PLX_AMBER_300}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.PLX_AMBER_700, marginBottom: 4 }}>
              ドロップされた候補 ({r.dropped_candidates.length})
            </div>
            {r.dropped_candidates.map((d, i) => (
              <div key={i} style={{ fontSize: 10, color: T.PLX_AMBER_700, marginTop: 2 }}>
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
                marginTop: 4, padding: 8, background: T.PLX_PILL_BG, borderRadius: T.RADIUS_SM,
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
        background: T.PLX_SURFACE_50, border: `1px solid ${PLX_BORDER}`, borderRadius: T.RADIUS_SM,
        padding: "6px 8px", marginBottom: 4,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: PLX_TEXT, flex: 1, wordBreak: "break-word" }}>
            {c.value}
          </div>
          {verified && (
            <span title="ソース URL に JAN が含まれています" style={{
              fontSize: 9, fontWeight: 700, color: T.PLX_TEAL_700,
              background: T.PLX_TEAL_100, border: `1px solid ${T.PLX_TEAL_300}`,
              padding: "1px 6px", borderRadius: T.RADIUS_PILL, flexShrink: 0,
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
  async function _copyLastFromStorage() {
    try {
      const raw = localStorage.getItem(_LAST_RESULT_KEY);
      if (!raw) return { ok: false, reason: "no_last" };
      await _copyText(raw);
      return { ok: true };
    } catch {
      return { ok: false, reason: "clipboard" };
    }
  }

  function AiArenaHost() {
    const [open, setOpen] = React.useState(false);
    React.useEffect(() => {
      window.PLX_AI_ARENA = {
        open:   () => setOpen(true),
        close:  () => setOpen(false),
        toggle: () => setOpen((o) => !o),
        copyLast: _copyLastFromStorage,
        hasLast: () => !!localStorage.getItem(_LAST_RESULT_KEY),
      };
    }, []);
    return <AiArena open={open} onClose={() => setOpen(false)} />;
  }

  window.AiArena = AiArena;
  window.AiArenaHost = AiArenaHost;
})();
