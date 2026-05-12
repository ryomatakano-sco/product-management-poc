// Entry point. Hash-based router picks one of three pages.

function App() {
  const route = useHashRoute();
  let page;
  if (route.name === "dashboard") page = <Dashboard />;
  else if (route.name === "detail") page = <ProductDetail productId={Number(route.id)} />;
  else if (route.name === "create") page = <ProductCreate />;
  // list (default) — pass query so dashboard deep-links (stock=low, expiry=soon) preselect chips
  else page = <ProductList initialQuery={route.query} />;
  return (
    <>
      {page}
      <DevPanel />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
