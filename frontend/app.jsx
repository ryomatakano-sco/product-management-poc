// Entry point. Hash-based router picks one of 12 pages + Under-Construction
// fallback. The router state comes from useHashRoute() in lib/hooks.js.

function App() {
  // Subscribe at the root so theme/locale toggles re-render the WHOLE tree
  // immediately — not just the toggle buttons. Without these the rest of
  // the UI keeps showing the previous palette/locale until a manual reload.
  // Cost: one extra render per click, which is fine for a click-driven event.
  usePlxTheme();
  usePlxLocale();
  const route = useHashRoute();

  // ── Auth gate (PoC session cookie) ────────────────────────────────
  // GET /auth/me decides: 401 → Login page; success → normal app, with the
  // user exposed on window.PLX_ME for AdminShell / Settings. The phone scan
  // page stays ungated (the phone has no session; the relay API validates
  // its own tokens).
  const meQ = useFetch(() => api.me(), []);
  window.PLX_ME = meQ.data || null;

  // Category EN names (mig 016): merge each category's optional name_en into
  // the live EN dictionary so every render site (chips, selects, tables)
  // translates data-level names automatically. Fallback stays the JA name —
  // categories without name_en simply have no dict entry.
  React.useEffect(() => {
    if (!meQ.data) return;
    api.listCategories().then((res) => {
      const dict = window._PLX_DICT_EN;
      if (!dict) return;
      const walk = (nodes) => (nodes || []).forEach((c) => {
        if (c.name && c.name_en) dict[c.name] = c.name_en;
        walk(c.children);
      });
      walk(res?.items || res || []);
    }).catch(() => {});
  }, [meQ.data]);

  // Standalone phone scan view (Option 2). Render it bare — no sidebar, no
  // command palette / dev panel — so a phone opening the pairing QR sees only
  // the camera. Early-return before the admin chrome is composed (and before
  // the auth gate — the phone is a companion device, not a logged-in user).
  if (route.name === "scan") {
    return <ScanReceiver token={route.query.token} />;
  }

  if (meQ.loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        color: T.PLX_INK_500, fontFamily: "'Inter','Noto Sans JP',sans-serif", fontSize: 13,
      }}>読み込み中…</div>
    );
  }
  if (meQ.error) {
    return <Login onLoggedIn={() => meQ.refetch()} />;
  }

  let page;

  // The three existing product pages keep their `detail` / `create` / `list`
  // route names from prompt 03 — don't break those URLs.
  if (route.name === "dashboard") page = <Dashboard />;
  else if (route.name === "detail") page = <ProductDetail productId={Number(route.id)} />;
  else if (route.name === "create") page = <ProductCreate />;
  else if (route.name === "edit")   page = <ProductCreate editId={Number(route.id)} />;
  else if (route.name === "list") page = <ProductList initialQuery={route.query} />;

  // Pages added 2026-05-12 for the full 12-page sidebar.
  else if (route.name === "categories") page = <Categories />;
  else if (route.name === "inventory") page = <Inventory query={route.query} />;
  else if (route.name === "purchase_orders") page = <PurchaseOrders />;
  else if (route.name === "po_detail") page = <PurchaseOrderDetail id={route.id} />;
  else if (route.name === "sales") page = <SalesRecords query={route.query} />;
  // Deep link `#/sales/12` — the sales list with that sale's detail modal open.
  else if (route.name === "sale_detail") page = <SalesRecords query={route.query} initialSaleId={Number(route.id)} />;
  else if (route.name === "sale_receipt") page = <ReceiptIssue saleId={Number(route.id)} />;
  else if (route.name === "vendors") page = <Vendors />;
  else if (route.name === "vendor_detail") page = <VendorDetail id={route.id} />;
  else if (route.name === "branches") page = <Branches />;
  else if (route.name === "branch_detail") page = <BranchDetail id={route.id} />;
  else if (route.name === "settings") page = <Settings query={route.query} />;
  else if (route.name === "support") page = <Support />;

  // Anything else (legacy "stub" route name, unknown paths) → placeholder.
  else if (route.name === "stub") {
    page = <UnderConstruction navId={route.stub.navId} title={route.stub.title} breadcrumbs={route.stub.breadcrumbs} />;
  } else {
    page = <UnderConstruction />;
  }

  return (
    <>
      {page}
      <CommandPaletteHost />
      <DevPanel />
      <AiArenaHost />
      <ToastContainer />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
