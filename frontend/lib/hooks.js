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

// useHashRoute() — parses window.location.hash into { name, params, query } and re-renders on change.
// Routes:
//   ""               → { name: "dashboard" }  (default landing per Yoshioka 2026-05-11)
//   "#/dashboard"    → { name: "dashboard" }
//   "#/products"     → { name: "list" }
//   "#/products?stock=low"  → { name: "list", query: { stock: "low" } }
//   "#/products/new" → { name: "create" }
//   "#/products/123" → { name: "detail", id: "123" }
function parseHash() {
  let h = window.location.hash.replace(/^#/, "");
  // Split off query string (after ?).
  const qIdx = h.indexOf("?");
  const query = {};
  if (qIdx >= 0) {
    const qs = h.slice(qIdx + 1);
    h = h.slice(0, qIdx);
    for (const pair of qs.split("&")) {
      if (!pair) continue;
      const [k, v = ""] = pair.split("=");
      query[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  if (!h || h === "/" || h === "/dashboard") return { name: "dashboard", query };
  // Standalone phone scan view (Option 2 companion scanner). Rendered without
  // the admin shell — `#/scan?token=...` is opened on a phone via the desktop's
  // pairing QR.
  if (h === "/scan") return { name: "scan", query };
  if (h === "/products") return { name: "list", query };
  if (h === "/products/new") return { name: "create", query };
  const edit = h.match(/^\/products\/(\d+)\/edit$/);
  if (edit) return { name: "edit", id: edit[1], query };
  const m = h.match(/^\/products\/(\d+)$/);
  if (m) return { name: "detail", id: m[1], query };
  // 2026-05-12: routes that used to be UnderConstruction stubs now have
  // real page components. Map each path to a route name; app.jsx renders.
  const realPages = {
    "/categories":      "categories",
    "/inventory":       "inventory",
    "/purchase-orders": "purchase_orders",
    "/sales":           "sales",
    "/vendors":         "vendors",
    "/branches":        "branches",
    "/settings":        "settings",
    "/support":         "support",
  };
  if (realPages[h]) return { name: realPages[h], query };

  // Receipt page — `#/sales/12/receipt`.
  const receipt = h.match(/^\/sales\/(\d+)\/receipt$/);
  if (receipt) return { name: "sale_receipt", id: receipt[1], query };

  // Detail pages — `#/vendors/3`, `#/branches/2`, `#/purchase-orders/8`.
  const detail = h.match(/^\/(vendors|branches|purchase-orders|sales)\/(\d+)$/);
  if (detail) {
    const map = {
      "vendors":         "vendor_detail",
      "branches":        "branch_detail",
      "purchase-orders": "po_detail",
      "sales":           "sale_detail",
    };
    return { name: map[detail[1]], id: detail[2], query };
  }

  return { name: "dashboard", query };
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
