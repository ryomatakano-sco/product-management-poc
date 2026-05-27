// DevPanel: a hidden-by-default dev menu pinned to the bottom-left.
//
// Click the small "</>" button to open. Shows live DB connectivity (with
// round-trip latency), AI mode (real / mock / forced_mock), current store id
// (with an inline switcher), and runtime info. Auto-refreshes every 5 s while
// the panel is open. Polls `GET /dev/status` on the same FastAPI server.
//
// Keyboard shortcut: Ctrl+` toggles the panel.

function DevPanel() {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [storeId, setStoreIdState] = React.useState(() => {
    try { return getStoreId(); } catch (_) { return 1; }
  });

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      // /dev/status doesn't need a store header but our fetcher injects it
      // anyway, which is fine — the endpoint just ignores it.
      const res = await fetch("/dev/status", {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open + poll every 5s while open. Stops when closed.
  React.useEffect(() => {
    if (!open) return;
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [open, refresh]);

  // Ctrl+` toggles the panel — handy when iterating.
  React.useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <DevToggleButton open={open} onClick={() => setOpen((v) => !v)} />
      {open && (
        <DevPanelBody
          status={status}
          error={error}
          loading={loading}
          storeId={storeId}
          onStoreIdChange={(id) => {
            setStoreId(id);
            setStoreIdState(id);
          }}
          onRefresh={refresh}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DevToggleButton({ open, onClick }) {
  return (
    <button
      onClick={onClick}
      title="Dev menu (Ctrl+`)"
      aria-label="Toggle dev menu"
      style={{
        position: "fixed", left: 16, bottom: 16, zIndex: 9999,
        width: 40, height: 40, borderRadius: "50%",
        border: `1px solid ${PLX_BORDER}`,
        background: open ? PLX_TEXT : T.PLX_CARD_BG,
        color: open ? "#fff" : PLX_TEXT,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
        boxShadow: "0 2px 8px rgba(0,0,0,.08)",
      }}
    >
      {"</>"}
    </button>
  );
}

function DevPanelBody({ status, error, loading, storeId, onStoreIdChange, onRefresh, onClose }) {
  return (
    <div
      role="dialog"
      aria-label="Developer panel"
      style={{
        position: "fixed", left: 16, bottom: 68, zIndex: 9999,
        width: 340, maxHeight: "calc(100vh - 100px)", overflow: "auto",
        background: T.PLX_CARD_BG, border: `1px solid ${PLX_BORDER}`,
        borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,.14)",
        fontSize: 12, color: PLX_TEXT,
      }}
    >
      <DevPanelHeader loading={loading} onRefresh={onRefresh} onClose={onClose} />
      <div style={{ padding: "10px 14px 14px" }}>
        {error && (
          <DevRow tone="bad" label="status endpoint">
            <span style={{ fontFamily: "var(--font-mono)" }}>{error}</span>
          </DevRow>
        )}
        {!error && !status && (
          <div style={{ color: PLX_MUTED, padding: "12px 0" }}>読み込み中…</div>
        )}
        {status && <DevSections status={status} />}
        <DevStoreSwitcher storeId={storeId} onChange={onStoreIdChange} />
        <DevLinks />
      </div>
    </div>
  );
}

function DevPanelHeader({ loading, onRefresh, onClose }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 14px", borderBottom: `1px solid ${PLX_BORDER}`,
      background: PLX_SURFACE, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    }}>
      <span style={{ fontWeight: 700, fontSize: 13 }}>Dev menu</span>
      <span style={{
        fontSize: 10, color: PLX_MUTED, fontFamily: "var(--font-mono)",
      }}>{loading ? "refreshing…" : "Ctrl+`"}</span>
      <div style={{ flex: 1 }} />
      <DevIconBtn onClick={onRefresh} title="Refresh now">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </DevIconBtn>
      <DevIconBtn onClick={onClose} title="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </DevIconBtn>
    </div>
  );
}

function DevIconBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 26, height: 26, borderRadius: 6, border: `1px solid ${PLX_BORDER}`,
      background: T.PLX_CARD_BG, color: PLX_TEXT, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{children}</button>
  );
}

function DevSections({ status }) {
  const db = status.db || {};
  const ai = status.ai || {};
  const rt = status.runtime || {};
  const dbTone = db.connected ? "ok" : "bad";
  const aiTone = ai.mode === "real" ? "ok" : ai.mode === "forced_mock" ? "warn" : "info";

  return (
    <>
      <DevSection title="Database">
        <DevRow tone={dbTone} label="connection">
          {db.connected
            ? <>connected · <span style={{ color: PLX_MUTED }}>{db.latency_ms} ms</span></>
            : <span style={{ fontFamily: "var(--font-mono)", color: PLX_RED }}>{db.error || "down"}</span>}
        </DevRow>
        <DevKv k="dialect" v={db.dialect} />
        <DevKv k="host" v={`${db.host}:${db.port}`} />
        <DevKv k="name" v={db.name} />
        <DevKv k="user" v={db.user} />
        {db.using_database_url_override && (
          <DevKv k="override" v="DATABASE_URL set — DB_* ignored" />
        )}
      </DevSection>

      <DevSection title="AI Assist">
        <DevRow tone={aiTone} label="mode">
          {aiModeLabel(ai.mode)}
        </DevRow>
        <DevKv k="OPENAI_API_KEY" v={ai.openai_api_key_set ? `set ${ai.openai_api_key_tail}` : "unset"} />
        <DevKv k="MOCK_AI" v={ai.mock_ai_env || "unset"} />
        <DevKv k="search model" v={ai.search_model} />
        {ai.fallback_search_model && (
          <DevKv k="fallback model" v={ai.fallback_search_model} />
        )}
        <DevKv k="extraction model" v={ai.extraction_model} />
        <DevEnvEditor ai={ai} writeTarget={rt.env_write_target} />
        {/* Model arena — side-by-side comparison of N models on the same
            JAN. Lives in the dev panel because it's a dev tool, not a
            user-facing feature. Hooks up to POST /ai-suggestions/compare. */}
        <DevAiArenaActions />
      </DevSection>

      <DevSection title="Runtime">
        <DevKv k="now" v={status.now} />
        <DevKv k="python" v={rt.python} />
        <DevKv k="platform" v={rt.platform} />
        {rt.frontend_dir && <DevKv k="FRONTEND_DIR" v={rt.frontend_dir} />}
        {Array.isArray(rt.env_files_loaded) && rt.env_files_loaded.map((p) => (
          <DevKv key={p} k=".env loaded" v={p} />
        ))}
      </DevSection>

      <DevSection title="Appearance & Language">
        <DevThemeLocaleControls />
      </DevSection>
    </>
  );
}

// Mirror of the topbar toggles — same singletons, just rendered as
// labelled rows here so it's clear which preset you're on.
function DevThemeLocaleControls() {
  const [theme] = usePlxTheme();
  const [locale] = usePlxLocale();
  const rowStyle = {
    display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
  };
  const pillBase = {
    padding: "4px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700,
    cursor: "pointer", border: `1px solid ${PLX_BORDER}`,
    background: "transparent", color: PLX_TEXT,
  };
  const pillActive = {
    ...pillBase,
    background: PLX_GREEN,
    color: "#fff",
    border: `1px solid ${PLX_GREEN}`,
  };
  return (
    <>
      <div style={rowStyle}>
        <span style={{ width: 60, color: PLX_MUTED }}>Theme</span>
        <button style={theme === "light" ? pillActive : pillBase}
          onClick={() => window.PLX_THEME.set("light")}>☀ Light</button>
        <button style={theme === "dark" ? pillActive : pillBase}
          onClick={() => window.PLX_THEME.set("dark")}>☾ Dark</button>
      </div>
      <div style={rowStyle}>
        <span style={{ width: 60, color: PLX_MUTED }}>Language</span>
        <button style={locale === "ja" ? pillActive : pillBase}
          onClick={() => window.PLX_I18N.set("ja")}>日本語</button>
        <button style={locale === "en" ? pillActive : pillBase}
          onClick={() => window.PLX_I18N.set("en")}>English</button>
      </div>
    </>
  );
}

function DevAiArenaActions() {
  const [copyMsg, setCopyMsg] = React.useState(null);
  const hasLast = React.useCallback(
    () => window.PLX_AI_ARENA?.hasLast?.() ?? false,
    [],
  );
  const [canCopy, setCanCopy] = React.useState(hasLast);

  React.useEffect(() => {
    setCanCopy(hasLast());
    const t = setInterval(() => setCanCopy(hasLast()), 2000);
    return () => clearInterval(t);
  }, [hasLast]);

  const rowBtn = {
    padding: "6px 12px", borderRadius: 6,
    border: `1px solid ${PLX_BORDER}`, background: T.PLX_CARD_BG,
    color: PLX_TEXT, fontWeight: 700, fontSize: 11, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 6,
  };

  async function copyLast() {
    if (!window.PLX_AI_ARENA?.copyLast) return;
    const res = await window.PLX_AI_ARENA.copyLast();
    if (res?.ok) {
      setCopyMsg("Copied");
      setTimeout(() => setCopyMsg(null), 2000);
    } else {
      setCopyMsg(res?.reason === "no_last" ? "No run yet" : "Copy failed");
      setTimeout(() => setCopyMsg(null), 2500);
    }
  }

  return (
    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <button
        onClick={() => window.PLX_AI_ARENA && window.PLX_AI_ARENA.open()}
        style={{ ...rowBtn, borderColor: PLX_GREEN, color: PLX_GREEN }}
      >
        🧪 AI モデル比較
      </button>
      <button
        onClick={copyLast}
        disabled={!canCopy}
        title="直近の比較結果 (JSON) をクリップボードにコピー"
        style={{
          ...rowBtn, opacity: canCopy ? 1 : 0.45,
          cursor: canCopy ? "pointer" : "not-allowed",
        }}
      >
        📋 直近をコピー
      </button>
      {copyMsg && (
        <span style={{ fontSize: 10, color: PLX_GREEN, fontWeight: 700 }}>{copyMsg}</span>
      )}
    </div>
  );
}

function aiModeLabel(mode) {
  if (mode === "real") return "real (OpenAI live)";
  if (mode === "forced_mock") return "forced mock (MOCK_AI=1)";
  return "mock (no key)";
}

function DevSection({ title, children }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: PLX_SUBTLE,
        letterSpacing: ".08em", marginBottom: 6, textTransform: "uppercase",
      }}>{title}</div>
      <div style={{
        border: `1px solid ${PLX_BORDER}`, borderRadius: 8,
        background: PLX_SURFACE, padding: "6px 10px",
      }}>{children}</div>
    </div>
  );
}

function DevRow({ tone, label, children }) {
  const dotColor = tone === "ok" ? PLX_GREEN
    : tone === "bad" ? PLX_RED
    : tone === "warn" ? PLX_WARN
    : PLX_BLUE;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "4px 0", borderBottom: `1px dashed ${PLX_BORDER}`,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0,
      }} />
      <span style={{ color: PLX_MUTED, width: 90 }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{children}</span>
    </div>
  );
}

function DevKv({ k, v }) {
  return (
    <div style={{
      display: "flex", gap: 8, padding: "3px 0",
      fontFamily: "var(--font-mono)", fontSize: 11,
    }}>
      <span style={{ color: PLX_MUTED, width: 98, flexShrink: 0 }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}>{v ?? "—"}</span>
    </div>
  );
}

function DevStoreSwitcher({ storeId, onChange }) {
  const [draft, setDraft] = React.useState(String(storeId));
  React.useEffect(() => { setDraft(String(storeId)); }, [storeId]);
  function commit() {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n > 0 && n !== storeId) {
      onChange(n);
      // Most pages cache data via hooks; a reload is the simplest way to
      // re-fetch with the new X-Store-Id header.
      location.reload();
    }
  }
  return (
    <DevSection title="Store ID (X-Store-Id)">
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="number" min="1" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          style={{
            width: 70, padding: "4px 8px", borderRadius: 6,
            border: `1px solid ${PLX_BORDER}`, fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        />
        <button onClick={commit} style={{
          padding: "4px 10px", borderRadius: 6,
          border: `1px solid ${PLX_BORDER}`, background: T.PLX_CARD_BG,
          cursor: "pointer", fontSize: 12,
        }}>Apply &amp; reload</button>
        <span style={{ marginLeft: "auto", color: PLX_MUTED, fontSize: 11 }}>
          current: <b>{storeId}</b>
        </span>
      </div>
    </DevSection>
  );
}

function DevLinks() {
  const link = {
    display: "inline-block", padding: "4px 8px", borderRadius: 6,
    border: `1px solid ${PLX_BORDER}`, background: T.PLX_CARD_BG,
    color: PLX_TEXT, textDecoration: "none", fontSize: 11,
    fontFamily: "var(--font-mono)",
  };
  return (
    <DevSection title="Quick links">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <a href="/docs" target="_blank" rel="noopener" style={link}>/docs</a>
        <a href="/redoc" target="_blank" rel="noopener" style={link}>/redoc</a>
        <a href="/health" target="_blank" rel="noopener" style={link}>/health</a>
        <a href="/dev/status" target="_blank" rel="noopener" style={link}>/dev/status</a>
      </div>
    </DevSection>
  );
}

// Inline editor for AI-related env vars. Sends PATCH /dev/env which both
// updates the running process's os.environ AND persists to the .env file
// shown in `writeTarget`. The page reloads on success to make sure every
// hook + the status fetch re-runs against the fresh state.
function DevEnvEditor({ ai, writeTarget }) {
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState("");
  const [mockAi, setMockAi] = React.useState(ai.mock_ai_env === "1");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  React.useEffect(() => {
    setMockAi(ai.mock_ai_env === "1");
  }, [ai.mock_ai_env]);

  async function save() {
    setBusy(true);
    setMsg(null);
    const body = { MOCK_AI: mockAi ? "1" : "" };
    // Only send the key when the user typed one — empty string would CLEAR it,
    // which is rarely what they want when they leave the field blank.
    if (key.trim()) body.OPENAI_API_KEY = key.trim();
    try {
      const res = await fetch("/dev/env", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
      setMsg({ tone: "ok", text: "Saved. Reloading…" });
      setTimeout(() => location.reload(), 500);
    } catch (e) {
      setMsg({ tone: "bad", text: e.message || String(e) });
      setBusy(false);
    }
  }

  async function clearKey() {
    if (!confirm("Clear OPENAI_API_KEY?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/dev/env", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ OPENAI_API_KEY: "" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg({ tone: "ok", text: "Cleared. Reloading…" });
      setTimeout(() => location.reload(), 500);
    } catch (e) {
      setMsg({ tone: "bad", text: e.message || String(e) });
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
        <button onClick={() => setOpen(true)} style={miniBtnStyle}>Edit…</button>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 8, padding: 8, borderRadius: 6,
      border: `1px solid ${PLX_BORDER}`, background: T.PLX_CARD_BG,
    }}>
      <label style={editorLabel}>OPENAI_API_KEY</label>
      <input
        type="password"
        placeholder={ai.openai_api_key_set ? `currently ${ai.openai_api_key_tail || "set"}` : "sk-…"}
        value={key}
        onChange={(e) => setKey(e.target.value)}
        autoComplete="off" spellCheck={false}
        style={editorInput}
      />
      <label style={{ ...editorLabel, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={mockAi} onChange={(e) => setMockAi(e.target.checked)} />
        <span>MOCK_AI=1 (force mock mode)</span>
      </label>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button onClick={save} disabled={busy} style={primaryBtnStyle}>
          {busy ? "Saving…" : "Save & reload"}
        </button>
        <button onClick={() => { setOpen(false); setKey(""); setMsg(null); }} style={miniBtnStyle}>
          Cancel
        </button>
        {ai.openai_api_key_set && (
          <button onClick={clearKey} disabled={busy}
            style={{ ...miniBtnStyle, color: PLX_RED, borderColor: PLX_RED_LIGHT }}>
            Clear key
          </button>
        )}
      </div>
      {writeTarget && (
        <div style={{
          marginTop: 6, fontSize: 10, color: PLX_MUTED,
          fontFamily: "var(--font-mono)", wordBreak: "break-all",
        }}>
          writes to: {writeTarget}
        </div>
      )}
      {msg && (
        <div style={{
          marginTop: 6, fontSize: 11,
          color: msg.tone === "bad" ? PLX_RED : PLX_GREEN,
        }}>{msg.text}</div>
      )}
    </div>
  );
}

const miniBtnStyle = {
  padding: "3px 8px", borderRadius: 6, fontSize: 11,
  border: `1px solid ${PLX_BORDER}`, background: T.PLX_CARD_BG,
  color: PLX_TEXT, cursor: "pointer",
};

const primaryBtnStyle = {
  ...miniBtnStyle, background: PLX_GREEN, color: "#fff",
  borderColor: PLX_GREEN, fontWeight: 700,
};

const editorLabel = {
  display: "block", fontSize: 11, color: PLX_MUTED, marginBottom: 3,
};

const editorInput = {
  width: "100%", padding: "5px 8px", borderRadius: 6,
  border: `1px solid ${PLX_BORDER}`, fontFamily: "var(--font-mono)",
  fontSize: 11, boxSizing: "border-box",
};

Object.assign(window, { DevPanel });
