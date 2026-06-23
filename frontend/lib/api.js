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

  // --- global search (powers the Ctrl+K command palette) ---
  globalSearch: (q) => request(`/search/global${qs({ q })}`),

  // --- dev-only model arena (POST /ai-suggestions/compare) ---
  compareAiSuggestion: (body) =>
    request(`/ai-suggestions/compare`, { method: "POST", body: JSON.stringify(body) }),

  // --- ref data ---
  listCategories: () => request(`/categories?limit=100`),
  listVendors:    () => request(`/vendors?limit=100`),
  listTags:       () => request(`/tags?limit=100`),
  listStores:     () => request(`/stores?limit=100`),

  // --- variants & inventory ---
  createVariant: (productId, body) =>
    request(`/products/${productId}/variants`, { method: "POST", body: JSON.stringify(body) }),
  updateVariant: (variantId, body) =>
    request(`/variants/${variantId}`, { method: "PATCH", body: JSON.stringify(body) }),
  adjustInventory: (variantId, body) =>
    request(`/variants/${variantId}/inventory-adjust`, { method: "POST", body: JSON.stringify(body) }),
  inventoryHistory: (variantId, limit = 50, offset = 0) =>
    request(`/variants/${variantId}/inventory-history?limit=${limit}&offset=${offset}`),

  // --- AI suggestions ---
  createAiSuggestion: (body) =>
    request(`/ai-suggestions`, { method: "POST", body: JSON.stringify(body) }),
  getAiSuggestion: (id) => request(`/ai-suggestions/${id}`),

  // --- scan relay (desktop⟷phone companion scanner, Option 2) ---
  // Desktop opens a pairing session; phone POSTs the scanned code; desktop polls.
  createScanSession: () => request(`/scan-sessions`, { method: "POST" }),
  getScanSession:    (token, since = 0) =>
    request(`/scan-sessions/${encodeURIComponent(token)}?since=${encodeURIComponent(since)}`),
  submitScanSession: (token, code) =>
    request(`/scan-sessions/${encodeURIComponent(token)}/scan`, {
      method: "POST", body: JSON.stringify({ code }),
    }),

  // --- dashboard (Yoshioka 2026-05-11) ---
  getDashboardSummary:        () => request(`/dashboard/summary`),
  regenerateDashboardSummary: () => request(`/dashboard/summary/regenerate`, { method: "POST" }),

  // ──────────────────────────────────────────────────────────────────
  // 2026-05-12 additions for the 12-page paylight X frontend.
  // Names match prompt 04's contract so pages can be ported later if we
  // ever do introduce the /api/v1 prefix; for now they stay at root.
  // ──────────────────────────────────────────────────────────────────

  // Categories (extended)
  getCategoryTree: () => request(`/categories/tree`),
  getCategory:     (id) => request(`/categories/${id}`),
  createCategory:  (body) => request(`/categories`, { method: "POST", body: JSON.stringify(body) }),
  updateCategory:  (id, body) => request(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCategory:  (id) => request(`/categories/${id}`, { method: "DELETE" }),

  // Inventory (aggregate view + adjustments)
  listInventory:   (params) => request(`/inventory${qs(params)}`),

  // Purchase orders (existing backend at /purchase-orders)
  listPurchaseOrders: (params) => request(`/purchase-orders${qs(params)}`),
  getPurchaseOrder:   (id) => request(`/purchase-orders/${id}`),

  // Sales
  listSales: (params) => request(`/sales${qs(params)}`).catch((e) => {
    if (e.status === 405 || e.status === 404) return { items: [], total: 0 };
    throw e;
  }),
  createSale: (body) => request(`/sales`, { method: "POST", body: JSON.stringify(body) }),
  getSalesSummary: () => request(`/sales/summary`).catch((e) => {
    if (e.status === 405 || e.status === 404)
      return { today_count: 0, today_revenue: "0", month_count: 0, month_revenue: "0" };
    throw e;
  }),

  // Vendors detail (already there) + sub-resources (graceful fallback)
  getVendor: (id) => request(`/vendors/${id}`),
  deleteVendor: (id) => request(`/vendors/${id}`, { method: "DELETE" }),
  createVendor: (body) => request(`/vendors`, { method: "POST", body: JSON.stringify(body) }),
  updateVendor: (id, body) => request(`/vendors/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Branches (full CRUD added in prompt-03)
  listBranches: () => request(`/branches?limit=100`),
  getBranch:    (id) => request(`/branches/${id}`),
  createBranch: (body) => request(`/branches`, { method: "POST", body: JSON.stringify(body) }),
  updateBranch: (id, body) => request(`/branches/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteBranch: (id) => request(`/branches/${id}`, { method: "DELETE" }),
  getBranchInventorySnapshot: (id) => request(`/branches/${id}/inventory-snapshot`),

  // Settings (5 namespaces: general/notifications/tax_rates/ai/integrations)
  getSettings:    (ns) => request(`/settings/${ns}`),
  updateSettings: (ns, body) => request(`/settings/${ns}`, { method: "PUT", body: JSON.stringify(body) }),

  // Support
  getFaq:              () => request(`/support/faq`),
  createSupportTicket: (body) => request(`/support/tickets`, { method: "POST", body: JSON.stringify(body) }),
  getSystemStatus:     () => request(`/support/system-status`),
  getVersion:          () => request(`/support/version`),
};

// Prompt 04 expects `window.PLX_API.*` — alias it to our existing `api`.
// Same object reference so calls go through the same fetch wrapper.
window.PLX_API = api;

Object.assign(window, { api, getStoreId, setStoreId });
