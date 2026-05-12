// Entry point. Hash-based router picks one of three pages.

function App() {
  const route = useHashRoute();
  if (route.name === "dashboard") return <Dashboard />;
  if (route.name === "detail") return <ProductDetail productId={Number(route.id)} />;
  if (route.name === "create") return <ProductCreate />;
  // list (default) — pass query so dashboard deep-links (stock=low, expiry=soon) preselect chips
  return <ProductList initialQuery={route.query} />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
