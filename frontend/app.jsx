// Entry point. Hash-based router picks one of three pages.

function App() {
  const route = useHashRoute();
  if (route.name === "detail") return <ProductDetail productId={Number(route.id)} />;
  if (route.name === "create") return <ProductCreate />;
  return <ProductList />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
