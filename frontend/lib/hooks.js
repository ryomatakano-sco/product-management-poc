// Two tiny hooks that replace TanStack Query for the PoC.

// useFetch(fn, deps) — re-runs whenever deps change, tracks loading/error/data.
function useFetch(fn, deps) {
  const [state, setState] = React.useState({ data: null, error: null, loading: true });
  const fnRef = React.useRef(fn);
  fnRef.current = fn;

  // refetch() returns a fresh promise so callers can chain.
  const refetch = React.useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    return fnRef.current()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    fnRef.current()
      .then((data) => { if (!cancelled) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (!cancelled) setState({ data: null, error, loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, refetch };
}

// useHashRoute() — parses window.location.hash into { name, params } and re-renders on change.
// Routes:
//   ""              → { name: "list" }
//   "#/products"    → { name: "list" }
//   "#/products/new"→ { name: "create" }
//   "#/products/123"→ { name: "detail", id: "123" }
function parseHash() {
  const h = window.location.hash.replace(/^#/, "");
  if (!h || h === "/" || h === "/products") return { name: "list" };
  if (h === "/products/new") return { name: "create" };
  const m = h.match(/^\/products\/(\d+)$/);
  if (m) return { name: "detail", id: m[1] };
  return { name: "list" };
}

function useHashRoute() {
  const [route, setRoute] = React.useState(parseHash());
  React.useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

function navigate(path) {
  window.location.hash = path;
}

Object.assign(window, { useFetch, useHashRoute, navigate });
