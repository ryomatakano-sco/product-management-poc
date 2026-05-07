# Frontend Design Brief: SCO Product Management POC

You are designing the frontend for a dental clinic product management web app, built as a proof-of-concept for a Japanese company called **SCO**. The app is used by dental clinic staff to manage product inventory, vendors, purchase orders, and sales. Mirror the visual design language of **Paylight X** (SCO's existing app, shown in the attached screenshots) — match its color palette, typography, component styles, spacing rhythm, and overall aesthetic exactly.

---

## Tech Context

- **Backend:** FastAPI running at `http://localhost:8000`
- **Auth:** No user login. Every API request must include the header `X-Store-Id: <store_id>`. The store ID should be stored in app state (e.g. localStorage or a context/store) and injected into every API call globally via an Axios interceptor or equivalent.
- **Language:** The app handles Japanese product data. Render both kanji (`name`) and kana (`name_kana`) wherever product names appear.
- **Money:** All price/cost fields come from the API as **strings** (not numbers). Display them as-is with ¥ prefix.
- **Pagination:** All list endpoints return `{ items: [], total: int, limit: int, offset: int }`. Use this for paginated tables/lists.

---

## Pages & API Integration

### 1. Dashboard (Home)

A summary overview screen.

**Show:**
- Total product count (from `GET /products` → `total` field)
- Low-stock alerts: variants where `on_hand - committed - unavailable ≤ some threshold`
- Recent sales (from `GET /sales` if paginated, or derive from product detail)
- Draft purchase orders count (from `GET /purchase-orders?status=draft` → `total`)
- Quick-access navigation cards to Products, Purchase Orders, and Vendors

---

### 2. Product List (`/products`)

A browsable, filterable table/grid of all products.

**API:** `GET /products?q=&category_id=&vendor_id=&tag=&status=&limit=&offset=`

**Features:**
- Search bar (queries `q` param) — also wire up `GET /products/search?q=` for live autocomplete (max 20 results)
- Filter dropdowns: Category (from `GET /categories`), Vendor (from `GET /vendors`), Status (active / draft / archived)
- Tag filter (multi-select chips, from `GET /tags`)
- Default view excludes archived products (add `status=active` or `status=draft` by default)
- Table columns: Product name (kanji + kana), Category, Vendor, SKU (default variant), Price, Stock (available = on_hand - committed - unavailable), Status badge
- Row click → Product Detail page
- "New Product" button → Product Create page

---

### 3. Product Detail (`/products/:id`)

Full product view with tabs or sections.

**API:** `GET /products/:id` — response includes variants, images, tags, 90-day sales summary

**Sections:**
- **Header:** Product name (kanji + kana), status badge, vendor, category, tags as chips, edit/archive buttons
- **Images gallery:** Ordered by `position`. Display hero + thumbnails.
- **Variants table:** SKU, barcode, price, cost, on_hand, committed, unavailable, available (computed). Each row has an "Adjust Inventory" action and an Edit action.
- **Inventory Adjustment panel (inline/modal):** Fields: `field` (on_hand / committed / unavailable), `delta` (positive or negative integer), `reason` (dropdown: sale / purchase / correction / damage / return / initial), `note`
  - **API:** `POST /variants/:variant_id/inventory-adjust`
- **Inventory History tab:** Paginated log
  - **API:** `GET /variants/:variant_id/inventory-history`
- **Sales Summary:** 90-day data is already included in the product detail response — display as a simple bar chart or stat cards (total units sold, total revenue)
- **Add Variant button** → inline form or modal
  - **API:** `POST /products/:id/variants`
- **Archive button:** Soft-deletes the product
  - **API:** `DELETE /products/:id`

---

### 4. Product Create / Edit (`/products/new`, `/products/:id/edit`)

A form to create or update a product.

**API (create):** `POST /products`
**API (edit):** `PATCH /products/:id`

**Fields:**
- Name (kanji), Name Kana
- Category (searchable dropdown → `GET /categories`)
- Vendor / Brand (searchable dropdown → `GET /vendors`)
- Status (active / draft)
- Tags (multi-select, auto-create on enter — names sent as strings)
- Description (textarea)
- **AI Assist button** (see AI Suggestion flow below — place prominently on this form)
- At least one Variant section (inline):
  - SKU, Barcode / JAN code, Price (¥), Cost (¥), Initial Stock (on_hand), Option 1/2/3 labels + values, Is Default toggle
- Images (URL input + position, can add multiple)
- Legacy fields (collapsible "Advanced" section): `default_amount_at_payment`, `is_insurable`, `is_pinned`, `default_insurance_point_at_payment`

---

### 5. AI Product Assist (modal or side panel, accessible from Product Create/Edit)

Helps staff auto-fill product data from a JAN code or product name.

**Flow:**
1. User enters a JAN code and/or product name and clicks "Look Up"
2. **API:** `POST /ai-suggestions` → returns `{ id, status: "pending", ... }`
3. **Poll** `GET /ai-suggestions/:session_id` every 2s until `status` is `"completed"` or `"failed"`
4. Show a loading spinner with message "AIが商品情報を検索中..." during polling
5. On completion, display candidate fields grouped by field name (e.g. title, brand, category, price, images). Each field may have multiple candidates with a confidence score and source URL. User picks one candidate per field by clicking it.
6. "Apply Selected" button pre-fills the Product Create/Edit form with chosen values
7. Each applied option should call `PATCH /ai-suggestions/:session_id/options/:option_id` with `{ was_applied: true }`
8. On failure, show an error state with a retry button

---

### 6. Vendors (`/vendors`)

List and detail for vendors/suppliers.

**List API:** `GET /vendors?q=&limit=&offset=`
**Detail API:** `GET /vendors/:id`
**Create API:** `POST /vendors`
**Edit API:** `PATCH /vendors/:id`

**Features:**
- Searchable table: Company name, Country, Contact name, Email, Phone
- Row click → Vendor detail/edit page
- Vendor detail shows: all company fields + list of products associated with this vendor (link to product list filtered by `vendor_id`) + list of purchase orders from this vendor

---

### 7. Categories (`/categories`)

Manage the product category hierarchy.

**API:** `GET /categories`, `POST /categories`, `PATCH /categories/:id`

**Features:**
- Tree view or indented list showing parent → child relationships (`parent_id`)
- Inline add/edit for category name and kana name
- "Add Sub-category" button on each category row

---

### 8. Purchase Orders (`/purchase-orders`)

Full procurement workflow.

**List API:** `GET /purchase-orders?status=&supplier_vendor_id=&destination_branch_id=&limit=&offset=`
**Detail API:** `GET /purchase-orders/:id`
**Create API:** `POST /purchase-orders`
**Edit API:** `PATCH /purchase-orders/:id`

**List features:**
- Filter by status (chips: All / Draft / Ordered / Partially Received / Received / Cancelled)
- Table: PO reference number, Supplier, Destination branch, Status badge, Total (¥), Estimated arrival, Created date
- "New Purchase Order" button

**Status badge colors:**
- Draft → grey
- Ordered → blue
- Partially Received → amber
- Received → green
- Cancelled → red

**Detail page sections:**
- Header: PO number, status badge, supplier, branch, dates, shipping info, totals
- Line items table: Product/variant name, SKU, Qty ordered, Qty received, Unit cost, Line total
- Action buttons based on status:
  - Draft → "Submit Order" button → `POST /purchase-orders/:id/submit`
  - Ordered / Partially Received → "Record Receipt" button → opens a form where user enters qty received per item → `POST /purchase-orders/:id/receive`
  - Any non-terminal state → "Cancel" button → `POST /purchase-orders/:id/cancel`
- Tags display

**Create form fields:** Supplier (dropdown → `GET /vendors`), Destination Branch (dropdown → `GET /branches`), Payment terms, Estimated arrival date, Shipping carrier, Tracking number, Reference number, Note, Shipping cost, Line items (add rows: variant search → `GET /products/search`, qty, unit cost)

---

### 9. Sales Record (`/sales`)

Record a point-of-sale event. Accessible from product detail or the sidebar nav.

**API:** `POST /sales`

**Fields:** Branch (dropdown → `GET /branches`), Product/Variant (searchable → `GET /products/search`), Quantity, Unit Price (¥), Date/time sold, Patient reference (optional), Note (optional)

**Note in UI:** "Recording a sale will automatically deduct from on-hand inventory."

---

### 10. Branches (`/branches`)

Manage clinic branches/locations.

**API:** `GET /branches`, `POST /branches`, `GET /branches/:id`, `PATCH /branches/:id`

**Features:**
- List with: Name, Address, Contact, Is Default badge
- Create/Edit form with all branch fields
- Default branch highlighted

---

### 11. Settings / Store Setup

Minimal settings page for PoC.

- Display current Store ID (from state)
- List of branches (`GET /branches`)
- Ability to switch `X-Store-Id` (for PoC demo purposes — a dropdown or input to change the active store, pulled from `GET /stores`)

---

## Navigation Structure

```
Sidebar (collapsed icon + label on hover, or fixed):
├── Dashboard
├── Products
│   ├── All Products
│   └── Categories
├── Inventory  (links to product detail inventory tabs)
├── Purchase Orders
├── Sales
├── Vendors
├── Branches
└── Settings
```

---

## Global UX Rules

1. **X-Store-Id header** — must be injected on every single API call. If missing from state, show a setup prompt before rendering any page.
2. **Loading states** — every data-fetching operation must show a skeleton loader or spinner.
3. **Error handling** — API errors (4xx/5xx) should surface as toast notifications with the error detail.
4. **Optimistic vs confirmed updates** — for destructive actions (archive product, cancel PO), show a confirmation dialog before calling the API.
5. **Empty states** — every list/table needs a designed empty state (icon + message + CTA).
6. **Responsive** — design primarily for desktop (clinic staff on workstation), but ensure it doesn't break on tablet.
7. **Japanese text** — use a font that renders kanji/kana cleanly (e.g. Noto Sans JP).
8. **Decimal display** — money values come as strings from the API; prepend ¥ and display as-is.
9. **Available stock** is always computed client-side: `available = on_hand - committed - unavailable`. Never request it from the API — it does not exist as a stored field.
10. **Tags** — when sending tags on product create/update, send an array of name strings (not IDs). Unknown names are auto-created by the backend.

---

## Design Reference

**Match Paylight X exactly** (see attached screenshots). Replicate: color palette, typography scale, sidebar/nav style, card and table component styling, button hierarchy (primary/secondary/ghost), badge styles, form field appearance, spacing system, and overall tone. This is a POC for SCO — it should feel like a natural extension of their existing product family.
