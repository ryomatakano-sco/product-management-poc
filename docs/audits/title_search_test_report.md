# Title Search (商品名検索) — Live Verification Report

**Branch:** `feature/title-search`
**Date:** 2026-06-08
**Method:** **MEASURED** — real title-only lookups against the live OpenAI pipeline (`run_product_lookup`, search model `gpt-4.1`, extraction `gpt-4.1-nano`), key from repo-root `.env`. Harness mirrors the router's persist-time filters for a title search (strict-citation drop applies; JAN wrong-product guard does **not** fire because `jan=None`). `allow_fallback=False` (matches the interactive default path).
**Not exercised:** store master lists (no DB in the harness) → Item-3 Layer-2 category/vendor canonicalization was **not** active for this run; category/brand below are the model's raw forms. `MOCK_AI` was unset (confirmed real calls — distinct latencies, live retailer URLs).

---

## Results table

| # | Query (title) | Right product? | Brand | Category | Description generated? | Latency (s) | Wrong-product / sibling-SKU substitution? |
|---|---|---|---|---|---|---|---|
| 1 | ルシェロ B-20M | ✅ ルシェロ B-20M ピセラ（GC） | ジーシー（GC） ✅ | 歯ブラシ ✅ | ✅ synthesized (no source_url, conf 0.8) | 17.9 | None. Correct product. |
| 2 | CSスマート | ✅ クラプロックス CSスマート | クラプロックス / CURAPROX ✅ | 歯ブラシ ✅ | ✅ synthesized (no source_url, conf 0.8) | 17.2 | None. (2 JAN variants returned — single vs set, same product) |
| 3 | システマ 44M | ✅ DENT.EX システマ 44M | LION / ライオン歯科材 / DENT. ✅ | 歯ブラシ ✅ | ✅ synthesized (no source_url, conf 0.8) | 20.7 | None. (2 JANs — 3-pack vs single, same product) |
| 4 | GUM デンタルペースト | ✅ ガム デンタルペースト 35g | G・U・M（ガム） ⚠️ | 歯磨剤 ✅ | ✅ synthesized (no source_url, conf 0.8) | 17.6 | None. Correct product. |
| 5 | バトラー CHX洗口液 | ✅ BUTLER バトラー CHX洗口液 250mL | サンスター（SUNSTAR） ✅ | 洗口液 ✅ | ✅ synthesized (no source_url, conf 0.8) | 15.5 | None. Correct product. |

**Headline: 5/5 returned the correct product. 0/5 wrong-product or sibling-SKU substitutions. All categories correct. All descriptions synthesized (not copied verbatim per the candidate shape). Latency 15.5–20.7s.**

---

## Per-product detail

### 1. ルシェロ B-20M — ✅ correct
- title: `ルシェロ B‑20M ピセラ（ふつう）` (GC product). brand `ジーシー（GC）`. category `歯ブラシ`. barcode `4548161168857`. country `日本`.
- Source narrative cites GC official (`gc.dental/.../ruscello-toothbrush-b-20-picella`) + ECs (Askul/Yodobashi). Right product line.
- Note: all field `source_url` came back null here (extraction attached URLs only in raw notes), but `found=true` and the product identity is unambiguous and correct.

### 2. CSスマート — ✅ correct
- title: `クラプロックス 歯ブラシ CSスマート`. brand `クラプロックス / CURAPROX`. category `歯ブラシ`. Swiss-made, Rakuten/Yahoo sources.
- Two barcodes returned (`7612412423013`, `4580585921458`) = legitimate single/variant SKUs of the **same** product, not a different product.

### 3. システマ 44M — ✅ correct
- title: `DENT.EX システマ 44M` (Lion dental-professional toothbrush). brand `LION / ライオン歯科材 / DENT.`. category `歯ブラシ`. weight `19g`.
- Two JANs (`4903301266631` 3-pack / `4903301298779` single) — same product, different pack size. Sources: Biccamera, Askul, Yahoo.

### 4. GUM デンタルペースト — ✅ correct product, ⚠️ brand-vs-vendor nuance
- title: `ガム デンタルペースト 35g`. category `歯磨剤` (conf 1.0). barcode `4901616009677`. fluoride 1450ppm. price ¥187.
- `brand` returned as `G・U・M（ガム）` — this is the **product brand**, while the **manufacturer/supplier (仕入先)** is サンスター (the raw notes cite サンスター official). This is exactly the gap Item-3's master-list injection (Layer-2) closes — it was **not active** in this harness (no DB). Not a title-search defect.

### 5. バトラー CHX洗口液 — ✅ correct
- title: `BUTLER バトラー CHX洗口液 250mL`. brand `サンスター（SUNSTAR）`. category `洗口液`. barcode `4901616501324`. price ¥1,100.
- Sources: Biccamera, Yodobashi, Dental-Fit. Right product.

---

## Observations

1. **No accuracy problem surfaced.** Every queried name returned the correct product. The hypothesized risk (wrong-product / sibling-SKU substitution on ambiguous names) **did not occur** in this 5-product sample. The returned `title` always contains the queried name (often with a brand/line prefix added, e.g. `CSスマート` → `クラプロックス 歯ブラシ CSスマート`).

2. **Multi-SKU enumeration ≠ wrong product.** Three products returned >1 barcode. These are pack-size/variant SKUs of the *same* product (the human picks per the candidate UI). This is expected multi-candidate behavior, not substitution.

3. **Description (Item-2) looks healthy on title results.** All 5 descriptions came back with empty/null `source_url` and confidence ~0.8 — the synthesized-text shape Item-2 produces. NOTE: a verbatim-overlap check against live source pages was **not** re-run here (that was MEASURED for JAN search in `item2_test_report.md`); the prose reads as reconstructed, but "not copied" for title is **inferred from candidate shape**, not freshly substring-checked.

4. **Category (Item-3 Layer-1/UI) effective:** all five categories landed on the master vocabulary (歯ブラシ / 歯磨剤 / 洗口液). The synonym/vendor canonicalization (Layer-2) was not exercised here — see GUM brand note.

5. **A naive query-token guard would be low-value and risky.** Because correct results legitimately *expand* the query (add brand/line/size), any guard must check "query tokens ⊆ result", not "result ⊆ query". Even then, on this evidence it would change nothing (all 5 pass) while adding a failure surface. See `title_search_after.md`.

## Conclusion

Title search is **working well on this sample** — measured, not predicted. No wrong-product substitutions, correct categories, synthesized descriptions, sub-21s latency. Recommendation flows into A3/A4: **no guard added** (document no-change-needed). Residual items: (a) re-run an Item-2 verbatim-overlap check on a couple of title descriptions if a hard copyright guarantee is wanted; (b) confirm vendor/仕入先 canonicalization (GUM→サンスター) end-to-end *with the DB master list loaded* — that's Item-3 territory, already largely covered, and orthogonal to title vs JAN.
