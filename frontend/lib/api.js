// Tiny fetch wrapper. Injects X-Store-Id on every request.
// All endpoints are relative — the same FastAPI server serves us at /app/,
// so calls to /products etc. hit the API directly. No CORS, no proxy.

const STORE_KEY = "sco.storeId";

function getStoreId() {
  const v = localStorage.getItem(STORE_KEY);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function setStoreId(id) {
  localStorage.setItem(STORE_KEY, String(id));
}

async function request(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Store-Id": String(getStoreId()),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch (_) { body = await res.text(); }
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// Build a query string from a params object, dropping undefined/null/empty entries.
function qs(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => usp.append(k, x));
    else usp.append(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

const api = {
  // --- products ---
  listProducts: (params) => request(`/products${qs(params)}`),
  getProduct:   (id)     => request(`/products/${id}`),
  createProduct: (body)  => request(`/products`, { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveProduct: (id)   => request(`/products/${id}`, { method: "DELETE" }),

  // --- ref data ---
  listCategories: () => request(`/categories?limit=100`),
  listVendors:    () => request(`/vendors?limit=100`),
  listTags:       () => request(`/tags?limit=100`),
  listStores:     () => request(`/stores?limit=100`),

  // --- variants & inventory ---
  createVariant: (productId, body) =>
    request(`/products/${productId}/variants`, { method: "POST", body: JSON.stringify(body) }),
  adjustInventory: (variantId, body) =>
    request(`/variants/${variantId}/inventory-adjust`, { method: "POST", body: JSON.stringify(body) }),
  inventoryHistory: (variantId, limit = 50, offset = 0) =>
    request(`/variants/${variantId}/inventory-history?limit=${limit}&offset=${offset}`),

  // --- AI suggestions ---
  createAiSuggestion: (body) =>
    request(`/ai-suggestions`, { method: "POST", body: JSON.stringify(body) }),
  getAiSuggestion: (id) => request(`/ai-suggestions/${id}`),

  // --- dashboard (Yoshioka 2026-05-11) ---
  getDashboardSummary: () => request(`/dashboard/summary`),
};

Object.assign(window, { api, getStoreId, setStoreId });
