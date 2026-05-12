# Product Management Backend

FastAPI + MySQL backend for Japanese dental clinic product management.

## Setup

```bash
cp .env.example .env
# Edit .env: add your OPENAI_API_KEY for the AI suggestion feature
```

## Run

```bash
docker compose up -d        # Start MySQL + API
docker compose exec api alembic upgrade head    # Run migrations
docker compose exec api python -m app.seed      # Seed sample data
```

API docs: http://localhost:8000/docs
OpenAPI spec: http://localhost:8000/openapi.json

## Multi-tenancy

Every request must include `X-Store-Id` header. The seed creates store id=1.

```bash
curl -H "X-Store-Id: 1" http://localhost:8000/products
```

## Search (kanji + kana)

Product search matches both `name` (kanji) and `name_kana` (reading) using `LIKE %q%`. This is the simple approach — adequate for PoC. A fulltext ngram index would be better for production.

## Key curl examples

### List products (with filters)

```bash
# All active products
curl -H "X-Store-Id: 1" "http://localhost:8000/products"

# Search by name or kana
curl -H "X-Store-Id: 1" "http://localhost:8000/products?q=GUM"

# Filter by category
curl -H "X-Store-Id: 1" "http://localhost:8000/products?category_id=1"

# AJAX search (for PO page)
curl -H "X-Store-Id: 1" "http://localhost:8000/products/search?q=GUM"
```

### Create a product manually

```bash
curl -X POST -H "X-Store-Id: 1" -H "Content-Type: application/json" \
  http://localhost:8000/products -d '{
    "name": "テスト歯ブラシ",
    "name_kana": "テストハブラシ",
    "category_id": 1,
    "vendor_id": 1,
    "default_amount_at_payment": "500.00",
    "variants": [{
      "sku": "TEST-001",
      "barcode": "4900000000001",
      "price": "500.00",
      "cost": "300.00",
      "is_default": true,
      "on_hand": 10
    }],
    "tags": ["おすすめ"]
  }'
```

### AI suggestion flow

```bash
# 1. Create AI suggestion session
curl -X POST -H "X-Store-Id: 1" -H "Content-Type: application/json" \
  http://localhost:8000/ai-suggestions -d '{"jan": "4901616213241"}'

# 2. Get suggestion results
curl -H "X-Store-Id: 1" http://localhost:8000/ai-suggestions/1

# 3. Mark an option as applied
curl -X PATCH -H "X-Store-Id: 1" -H "Content-Type: application/json" \
  http://localhost:8000/ai-suggestions/1/options/1 -d '{"was_applied": true}'

# 4. Create product with AI session link
curl -X POST -H "X-Store-Id: 1" -H "Content-Type: application/json" \
  http://localhost:8000/products -d '{
    "name": "GUM デンタルブラシ #211",
    "name_kana": "ガム デンタルブラシ",
    "ai_session_id": 1,
    "variants": [{"is_default": true, "price": "330.00"}]
  }'
```

### Purchase order lifecycle

```bash
# 1. Create PO (draft)
curl -X POST -H "X-Store-Id: 1" -H "Content-Type: application/json" \
  http://localhost:8000/purchase-orders -d '{
    "supplier_vendor_id": 1,
    "destination_branch_id": 1,
    "items": [{"variant_id": 1, "quantity_ordered": 20, "unit_cost": "200.00"}]
  }'

# 2. Submit (draft → ordered)
curl -X POST -H "X-Store-Id: 1" http://localhost:8000/purchase-orders/1/submit

# 3. Receive (bumps on_hand)
curl -X POST -H "X-Store-Id: 1" -H "Content-Type: application/json" \
  http://localhost:8000/purchase-orders/1/receive -d '{
    "items": [{"item_id": 1, "quantity_received": 20}]
  }'
```

### Record a sale (decrements on_hand)

```bash
curl -X POST -H "X-Store-Id: 1" -H "Content-Type: application/json" \
  http://localhost:8000/sales -d '{
    "branch_id": 1,
    "variant_id": 1,
    "quantity": 5,
    "unit_price": "330.00"
  }'

# Verify inventory history
curl -H "X-Store-Id: 1" http://localhost:8000/variants/1/inventory-history
```

## Vendors note

The `vendors` table serves double duty as both product brands and PO suppliers. In dental practice these often overlap (e.g., Sunstar is both brand and distributor). A product's `vendor_id` and a PO's `supplier_vendor_id` reference the same table.

## Data model decisions

- **Products are a superset of the legacy `goods` table.** Legacy columns (`default_amount_at_payment`, `is_insurable`, `is_pinned`, `default_insurance_point_at_payment`) are preserved with their exact names for client compatibility.
- **Every product has at least one variant** (the "default variant"). All inventory and SKU data lives on variants, not products. This matches Shopify's pattern and avoids future migration pain.
- **SKU and barcode uniqueness is per-store**, not global: `UNIQUE(store_id, sku)` and `UNIQUE(store_id, barcode)`.
- **Inventory adjustments** are logged for audit. Every change to on_hand/committed/unavailable creates an `inventory_adjustments` row.
- **`available`** is computed (`on_hand - committed - unavailable`), not stored.
- **Money fields** use `DECIMAL` and serialize as strings in JSON to avoid JS precision issues.
- **Datetimes** are stored in UTC and serialized as ISO8601.

## Feasibility rubric (for AI suggestions)

The AI suggestion endpoint reuses the pattern from `jan-lookup-poc`:

- **Green light**: AI returns suggestions for >=70% of queries AND >=80% of those have title + brand + category grounded with source URLs.
- **Yellow**: 40-70% success rate or key fields often missing.
- **Red light**: <40% success rate.

The `ai_suggestion_field_options` table records what the AI suggested vs. what staff actually applied (`was_applied` flag), enabling post-hoc analysis of AI usefulness.
