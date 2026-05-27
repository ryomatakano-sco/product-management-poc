// Runtime theme switcher — owns the active palette and notifies subscribers.
//
// Usage:
//   PLX_THEME.get()                  → "light" | "dark"
//   PLX_THEME.set("dark")            → mutates T to the dark palette,
//                                      writes localStorage, notifies subs
//   PLX_THEME.toggle()               → flips light↔dark
//   PLX_THEME.subscribe(fn)          → fn() called whenever theme changes;
//                                      returns an unsubscribe function
//   usePlxTheme()                    → React hook; returns [theme, setTheme]
//                                      and triggers re-render on change

(function () {
  const STORAGE_KEY = "sco.theme.v1";
  const VALID = new Set(["light", "dark"]);

  function _load() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (VALID.has(v)) return v;
    } catch { /* private mode etc. */ }
    return "light";  // explicit default — no auto OS-follow, per user pick
  }
  function _save(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); }
    catch { /* swallow */ }
  }

  const subscribers = new Set();
  let current = _load();

  // Apply current palette on script load so components rendering on the
  // very first frame already see the right colours (no "flash of light"
  // when user has dark mode persisted).
  function _apply(theme) {
    const palettes = window._PLX_PALETTES;
    if (!palettes || !palettes[theme]) return;
    const palette = palettes[theme];
    // Mutate T in place — keep the same object identity so any component
    // holding a reference to T sees the new values immediately on next read.
    for (const key of Object.keys(palette)) {
      window.T[key] = palette[key];
    }
    // Set body background directly so the area outside React-rendered
    // content (gutters, scrollbar track) follows the theme too.
    if (document.body) {
      document.body.style.background = palette.PLX_SURFACE_0;
      document.body.style.color      = palette.PLX_INK_900;
    }
    document.documentElement.setAttribute("data-theme", theme);
  }
  _apply(current);

  function set(theme) {
    if (!VALID.has(theme)) return;
    if (theme === current) return;
    current = theme;
    _save(theme);
    _apply(theme);
    for (const fn of subscribers) {
      try { fn(theme); } catch (e) { console.error("theme subscriber error:", e); }
    }
  }
  function get() { return current; }
  function toggle() { set(current === "light" ? "dark" : "light"); }
  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  window.PLX_THEME = { get, set, toggle, subscribe };

  // React hook — components call this to participate in re-renders when
  // the theme changes. Returns [theme, setTheme] for ergonomic destructuring.
  window.usePlxTheme = function usePlxTheme() {
    const [, setTick] = React.useState(0);
    React.useEffect(() => subscribe(() => setTick((n) => n + 1)), []);
    return [get(), set];
  };
})();
