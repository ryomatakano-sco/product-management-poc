// First-time user tutorial — spotlight/coachmark tour.
//
// One guided cross-page tour (~12 steps): starts on the dashboard after the
// first login, explains the shell (sidebar / search / bell / toggles), then
// walks Products → Inventory → PO → Sales → Settings highlighting each page's
// main action button.
//
// How targeting works: elements opt in with a `data-tour="<key>"` attribute
// (AdminShell + 6 page headers). The engine querySelector's the key, scrolls
// it into view, and draws a spotlight "hole" over its rect using the classic
// box-shadow trick (one div with a 100vmax shadow — no SVG mask needed).
//
// State:
//   localStorage plx.tutorial.done.<userId>  — per-user "seen it" flag
//   localStorage plx.tutorial.autostart      — "0" disables auto-start (dev toggle)
// Imperative API (used by DevPanel): window.PLX_TUTORIAL
//   { start, stop, reset, isDone, autoStartEnabled, setAutoStart }
//
// The tour must NEVER wedge: if a step's target doesn't appear within ~4s
// (slow fetch, role-hidden button), the step is skipped automatically.

(function () {
  const DONE_PREFIX = "plx.tutorial.done.";
  const AUTOSTART_KEY = "plx.tutorial.autostart";

  const listeners = new Set();
  const state = { running: false };

  function emit() { listeners.forEach((l) => l(state.running)); }

  function doneKey() {
    const uid = window.PLX_ME?.id;
    return uid ? DONE_PREFIX + uid : DONE_PREFIX + "anon";
  }

  window.PLX_TUTORIAL = {
    start() { state.running = true; emit(); },
    stop() { state.running = false; emit(); },
    reset() { try { localStorage.removeItem(doneKey()); } catch (_) {} },
    markDone() { try { localStorage.setItem(doneKey(), "1"); } catch (_) {} },
    isDone() { try { return localStorage.getItem(doneKey()) === "1"; } catch (_) { return true; } },
    autoStartEnabled() { try { return localStorage.getItem(AUTOSTART_KEY) !== "0"; } catch (_) { return true; } },
    setAutoStart(on) { try { localStorage.setItem(AUTOSTART_KEY, on ? "1" : "0"); } catch (_) {} },
    isRunning() { return state.running; },
  };
  window.__plxTutorialSubscribe = function (cb) {
    listeners.add(cb);
    cb(state.running);
    return () => listeners.delete(cb);
  };
})();

// ── Step definitions ────────────────────────────────────────────────
// route = hash the step lives on (engine navigates + waits for the target).
// target = data-tour key; null → centered card. adminOnly steps are filtered
// for staff. Text: JA source + EN dictionary entries (single-child rule — each
// title/body renders as ONE string child).

const PLX_TOUR_STEPS = [
  {
    key: "welcome", route: "/dashboard", target: null,
    title: "SCO 商品管理へようこそ 👋",
    body: "歯科クリニックの商品・在庫・発注・販売をひとつで管理できます。主要な機能を約1分でご案内します（いつでもスキップできます）。",
  },
  {
    key: "nav", route: "/dashboard", target: "nav",
    title: "サイドバー",
    body: "MAIN（ダッシュボード・商品）、OPERATIONS（在庫・発注書・販売記録）、MASTER（カテゴリ・仕入先・院/店舗）の3グループで移動します。",
  },
  {
    key: "search", route: "/dashboard", target: "global-search",
    title: "横断検索",
    body: "商品名・SKU・JAN・仕入先をまとめて検索できます。キーボードの Ctrl+K でも開けます。",
  },
  {
    key: "bell", route: "/dashboard", target: "notif-bell",
    title: "通知",
    body: "在庫低下・使用期限・発注書の状態変化・承認リクエストがここに届きます。",
  },
  {
    key: "langtheme", route: "/dashboard", target: "lang-theme",
    title: "表示の切り替え",
    body: "テーマ（ライト/ダーク）と言語（日本語/English）をワンクリックで切り替えられます。",
  },
  {
    key: "aisummary", route: "/dashboard", target: "ai-summary",
    title: "AI サマリー",
    body: "在庫・期限・売上の要点を AI が毎日まとめます。「再生成」で最新データから作り直せます。",
  },
  {
    key: "products", route: "/products", target: "product-add",
    title: "商品を追加",
    body: "このボタンから商品を登録します。JAN コードを入れると AI が商品情報を自動入力。CSV 一括登録は隣の「⬆ インポート」から。",
  },
  {
    key: "inventory", route: "/inventory", target: "inv-adjust",
    title: "在庫を調整",
    body: "入出庫の手動調整はここから。「⇄ 拠点間移動」で店舗間の在庫移動、「⬆ 棚卸しCSV取込」で実地棚卸の反映もできます。",
  },
  {
    key: "po", route: "/purchase-orders", target: "po-create",
    title: "発注書を作成",
    body: "発注書は 下書き → 送信 → 入荷 の流れで管理します（部分入荷にも対応）。「⚡ 低在庫から自動作成」で発注ドラフトを一括生成できます。",
  },
  {
    key: "sales", route: "/sales", target: "sale-manual",
    title: "販売を記録",
    body: "店頭販売はここから手動入力します。記録した販売は返品・レシート/領収書の発行にも対応しています。",
  },
  {
    key: "settings", route: "/settings", target: "settings-nav", adminOnly: true,
    title: "設定",
    body: "ユーザーと権限、税率、通知、API 情報、監査ログはここで管理します（管理者のみ）。",
  },
  {
    key: "finish", route: "/dashboard", target: null,
    title: "準備完了です 🎉",
    body: "以上で基本操作のご案内は終わりです。もう一度見たいときは、画面左下の Dev メニュー（Ctrl+`）の Tutorial から再生できます。",
  },
];

// ── Engine ──────────────────────────────────────────────────────────

function TutorialHost() {
  const [running, setRunning] = React.useState(false);
  React.useEffect(() => window.__plxTutorialSubscribe(setRunning), []);

  // Auto-start: first visit per user, dashboard only, unless disabled.
  // Also re-checks on hashchange so a user who logged in via a deep link
  // still gets the tour the first time they reach the dashboard.
  React.useEffect(() => {
    if (running) return;
    let timer = null;
    const maybeStart = () => {
      const T9N = window.PLX_TUTORIAL;
      if (!window.PLX_ME) return;
      if (T9N.isDone() || !T9N.autoStartEnabled() || T9N.isRunning()) return;
      const onDash = location.hash === "" || location.hash.replace(/^#/, "").startsWith("/dashboard");
      if (!onDash) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Re-check right before firing — the user may have skipped meanwhile.
        if (!T9N.isDone() && T9N.autoStartEnabled() && !T9N.isRunning()) T9N.start();
      }, 900);
    };
    maybeStart();
    window.addEventListener("hashchange", maybeStart);
    return () => {
      window.removeEventListener("hashchange", maybeStart);
      clearTimeout(timer);
    };
  }, [running]);

  if (!running) return null;
  return <TutorialTour onExit={() => window.PLX_TUTORIAL.stop()} />;
}

function TutorialTour({ onExit }) {
  const steps = React.useMemo(
    () => PLX_TOUR_STEPS.filter((s) => !s.adminOnly || window.PLX_ME?.role === "admin"),
    [],
  );
  const [idx, setIdx] = React.useState(0);
  const [rect, setRect] = React.useState(null);       // spotlight rect (null → centered)
  const [settling, setSettling] = React.useState(true); // waiting for route/target
  const step = steps[idx];

  const finish = React.useCallback((completed) => {
    window.PLX_TUTORIAL.markDone(); // skip counts as seen — never nag again
    onExit();
    if (completed) window.PLX_TOAST?.success?.("チュートリアルを完了しました");
  }, [onExit]);

  // Resolve the current step: navigate if needed, poll for the target,
  // scroll it into view, then measure. Timeout (~4s) → auto-skip forward.
  React.useEffect(() => {
    let cancelled = false;
    let tries = 0;
    setSettling(true);
    setRect(null);

    const wantHash = "#" + step.route;
    if (location.hash !== wantHash) location.hash = step.route;

    if (!step.target) {
      // Centered card — just give the page a beat to render behind the dim.
      const t = setTimeout(() => { if (!cancelled) setSettling(false); }, 250);
      return () => { cancelled = true; clearTimeout(t); };
    }

    const poll = setInterval(() => {
      if (cancelled) return;
      tries += 1;
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        clearInterval(poll);
        el.scrollIntoView({ block: "center", inline: "nearest" });
        // Let scrollIntoView settle before measuring.
        setTimeout(() => {
          if (cancelled) return;
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          setSettling(false);
        }, 180);
      } else if (tries > 26) { // ~4s at 150ms — target missing → skip, never wedge
        clearInterval(poll);
        if (idx + 1 < steps.length) setIdx(idx + 1);
        else finish(true);
      }
    }, 150);
    return () => { cancelled = true; clearInterval(poll); };
  }, [idx, step, steps.length, finish]);

  // Keep the spotlight glued to the target on resize/scroll (throttled via rAF).
  React.useEffect(() => {
    if (!step.target) return;
    let raf = null;
    const remeasure = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const el = document.querySelector(`[data-tour="${step.target}"]`);
        if (el) {
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      });
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [step]);

  // ESC exits (counts as skip).
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") finish(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  const next = () => (idx + 1 < steps.length ? setIdx(idx + 1) : finish(true));
  const back = () => idx > 0 && setIdx(idx - 1);

  const PAD = 8; // breathing room around the highlighted element
  const hole = rect && {
    top: rect.top - PAD, left: rect.left - PAD,
    width: rect.width + PAD * 2, height: rect.height + PAD * 2,
  };

  // Tooltip placement: below the hole, flipped above when the target sits in
  // the lower half; clamped to the viewport; centered card when no target.
  const CARD_W = 340;
  let cardStyle;
  if (hole) {
    const below = hole.top + hole.height / 2 < window.innerHeight / 2;
    const top = below ? hole.top + hole.height + 14 : undefined;
    const bottom = below ? undefined : window.innerHeight - hole.top + 14;
    let left = hole.left + hole.width / 2 - CARD_W / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - CARD_W - 12));
    cardStyle = { position: "fixed", top, bottom, left, width: CARD_W };
  } else {
    cardStyle = {
      position: "fixed", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)", width: CARD_W,
    };
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10500 }}>
      {/* Click-catcher: swallows stray clicks so the tour stays in control. */}
      <div style={{ position: "fixed", inset: 0 }} aria-hidden="true" onClick={(e) => e.stopPropagation()} />

      {/* Spotlight hole (or full dim while settling / on centered steps). */}
      {hole ? (
        <div style={{
          position: "fixed",
          top: hole.top, left: hole.left, width: hole.width, height: hole.height,
          borderRadius: 10,
          boxShadow: "0 0 0 100vmax rgba(0,0,0,0.55)",
          border: `2px solid ${T.PLX_GREEN_600}`,
          transition: "top .25s ease, left .25s ease, width .25s ease, height .25s ease",
          pointerEvents: "none",
        }} />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)" }} />
      )}

      {/* Tooltip card */}
      {!settling && (
        <div role="dialog" aria-modal="true" aria-labelledby="plx-tour-title" style={{
          ...cardStyle,
          background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG,
          border: `1px solid ${T.PLX_LINE_200}`,
          boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          padding: "18px 20px", zIndex: 10501,
        }}>
          <div id="plx-tour-title" style={{ fontSize: 15, fontWeight: 800, color: T.PLX_INK_900, marginBottom: 6 }}>
            {step.title}
          </div>
          <div style={{ fontSize: 13, color: T.PLX_INK_700, lineHeight: 1.7 }}>
            {step.body}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 14,
          }}>
            <span style={{ fontSize: 11, color: T.PLX_INK_400, fontVariantNumeric: "tabular-nums" }}>
              {`${idx + 1} / ${steps.length}`}
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => finish(false)} style={{
              padding: "7px 12px", borderRadius: T.RADIUS_MD, border: "none",
              background: "transparent", color: T.PLX_INK_500, fontSize: 12, cursor: "pointer",
            }}>スキップ</button>
            {idx > 0 && (
              <button onClick={back} style={{
                padding: "7px 14px", borderRadius: T.RADIUS_MD,
                border: `1px solid ${T.PLX_LINE_200}`, background: T.PLX_CARD_BG,
                color: T.PLX_INK_700, fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>戻る</button>
            )}
            <button onClick={next} style={{
              padding: "7px 18px", borderRadius: T.RADIUS_MD, border: "none",
              background: T.PLX_GREEN_600, color: T.PLX_ON_BRAND,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>{idx + 1 === steps.length ? "完了" : "次へ"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { TutorialHost });
