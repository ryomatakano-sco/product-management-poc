// Entry point. Hash-based router picks one of 12 pages + Under-Construction
// fallback. The router state comes from useHashRoute() in lib/hooks.js.

function App() {
  const route = useHashRoute();
  let page;

  // The three existing product pages keep their `detail` / `create` / `list`
  // route names from prompt 03 — don't break those URLs.
  if (route.name === "dashboard") page = <Dashboard />;
  else if (route.name === "detail") page = <ProductDetail productId={Number(route.id)} />;
  else if (route.name === "create") page = <ProductCreate />;
  else if (route.name === "list") page = <ProductList initialQuery={route.query} />;

  // Pages added 2026-05-12 for the full 12-page sidebar.
  else if (route.name === "categories") page = <Categories />;
  else if (route.name === "inventory") page = <Inventory query={route.query} />;
  else if (route.name === "purchase_orders") page = <PurchaseOrders />;
  else if (route.name === "po_detail") page = <PurchaseOrderDetail id={route.id} />;
  else if (route.name === "sales") page = <SalesRecords query={route.query} />;
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
      <DevPanel />
      <ToastContainer />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
