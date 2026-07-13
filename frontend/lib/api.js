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
  // --- auth (PoC session cookie; see backend routers/auth.py) ---
  login:  (email, password) => request(`/auth/login`, { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request(`/auth/logout`, { method: "POST" }),
  me:     () => request(`/auth/me`),
  listUsers:  () => request(`/auth/users`),
  createUser: (body) => request(`/auth/users`, { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id, body) => request(`/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // --- products ---
  listProducts: (params) => request(`/products${qs(params)}`),
  searchProducts: (q, opts) => request(`/products/search${qs({ q, ...opts })}`),
  getProduct:   (id)     => request(`/products/${id}`),
  getProductSalesWeekly: (id, weeks = 12) => request(`/products/${id}/sales-weekly?weeks=${weeks}`),
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

  // --- notifications (heavy-tier item 3: real bell) ---
  listNotifications: (params) => request(`/notifications${qs(params)}`),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request(`/notifications/read-all`, { method: "POST" }),

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
  listRecentAdjustments: (params) => request(`/inventory/adjustments${qs(params)}`),

  // Purchase orders (existing backend at /purchase-orders)
  listPurchaseOrders: (params) => request(`/purchase-orders${qs(params)}`),
  getPurchaseOrdersSummary: () => request(`/purchase-orders/summary`),
  createPurchaseOrder: (body) => request(`/purchase-orders`, { method: "POST", body: JSON.stringify(body) }),
  getPurchaseOrder:   (id) => request(`/purchase-orders/${id}`),
  submitPurchaseOrder: (id) => request(`/purchase-orders/${id}/submit`, { method: "POST" }),
  receivePurchaseOrder: (id, items) => request(`/purchase-orders/${id}/receive`, { method: "POST", body: JSON.stringify({ items }) }),
  cancelPurchaseOrder: (id) => request(`/purchase-orders/${id}/cancel`, { method: "POST" }),
  updatePurchaseOrder: (id, body) => request(`/purchase-orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Sales
  listSales: (params) => request(`/sales${qs(params)}`).catch((e) => {
    if (e.status === 405 || e.status === 404) return { items: [], total: 0 };
    throw e;
  }),
  getSale: (id) => request(`/sales/${id}`),
  listSalesStaff: () => request(`/sales/staff`).catch(() => []),
  createSale: (body) => request(`/sales`, { method: "POST", body: JSON.stringify(body) }),
  refundSale: (id) => request(`/sales/${id}/refund`, { method: "POST" }),
  getReceiptData: (id) => request(`/sales/${id}/receipt-data`),
  getSalesSummary: () => request(`/sales/summary`).catch((e) => {
    if (e.status === 405 || e.status === 404)
      return {
        today_count: 0, today_revenue: "0", yesterday_count: 0, yesterday_revenue: "0",
        month_count: 0, month_revenue: "0", last_month_count: 0, last_month_revenue: "0",
      };
    throw e;
  }),
  // Generic CSV download. Direct anchor download can't send the X-Store-Id
  // header, so fetch + blob-trigger with the filename from Content-Disposition.
  downloadCsv: async (path, params, fallbackName) => {
    const res = await fetch(`${path}${qs(params)}`, {
      headers: { "X-Store-Id": String(getStoreId()) },
    });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    const cd = res.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename="?([^"]+)"?/);
    const filename = m ? m[1] : (fallbackName || "export.csv");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },
  downloadSalesCsv:          (params) => api.downloadCsv(`/sales/export.csv`, params, "sales.csv"),
  downloadPurchaseOrdersCsv: (params) => api.downloadCsv(`/purchase-orders/export.csv`, params, "purchase_orders.csv"),
  downloadVendorsCsv:        (params) => api.downloadCsv(`/vendors/export.csv`, params, "vendors.csv"),
  downloadCategoriesCsv:     ()       => api.downloadCsv(`/categories/export.csv`, null, "categories.csv"),
  downloadInventoryCsv:      (params) => api.downloadCsv(`/inventory/export.csv`, params, "stocktake.csv"),

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
  testAiConnection: () => request(`/settings/ai/test`, { method: "POST" }),
  // Logo upload — multipart, so bypass the JSON `request` wrapper (the
  // browser must set the multipart boundary Content-Type itself).
  uploadLogo: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/settings/logo`, {
      method: "POST",
      headers: { "X-Store-Id": String(getStoreId()) },
      body: fd,
    });
    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch (_) {}
      throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, body });
    }
    return res.json();
  },
  deleteLogo: () => request(`/settings/logo`, { method: "DELETE" }),

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
