# Item 3 — Test report (category + supplier mapping)

Branch: `fix/category-vendor-mapping`. Date: 2026-06-02.

## Part A — Frontend normalised match (`_matchMaster`) — MEASURED

Ran the actual `_normMaster`/`_matchMaster` logic (extracted verbatim from
[ProductCreate.jsx](../../frontend/pages/ProductCreate.jsx)) under Node v22 against
the store master lists `vendors=[サンスター, ライオン, GC]`,
`categories=[歯磨剤, 歯ブラシ, 洗口液]`. `matched_before` = the old raw `===`;
`matched_after` = the new normalised `_matchMaster`.

| # | AI_output | master_value | matched_before | matched_after | note |
|---|-----------|--------------|:--:|:--:|------|
| 1 | `サンスター(株式会社)` | サンスター | **N** | **Y** | parenthesised 株式会社 — the known failing case |
| 2 | `サンスター株式会社` | サンスター | N | **Y** | bare company suffix |
| 3 | `サンスター（株）` | サンスター | N | **Y** | full-width （株） |
| 4 | `ＧＣ` (full-width) | GC | N | **Y** | NFKC width fold |
| 5 | `サンスター ` (trailing space) | サンスター | N | **Y** | whitespace strip |
| 6 | `ライオン` | ライオン | **Y** | **Y** | exact still works (fast path) |
| 7 | `歯磨剤` | 歯磨剤 | Y | Y | exact category |
| 8 | `歯磨き粉` | 歯磨剤 | **N** | **N** | **SYNONYM, not a spelling variant** — different characters; normalisation *cannot* fix this. Fixed by Part B (server-side). |
| 9 | `クラレ` | (absent) | N | **N** | vendor not in master — correctly NO match (no false positive) |
| 10 | `Lion Co., Ltd.` | (ライオン is JP) | N | **N** | Latin name; JP master has カタカナ — correctly NO match |
| 11 | `ハブラシ` (katakana) | 歯ブラシ | N | **N** | katakana vs kanji — different chars, correctly NO match |

**Result: 11/11 as expected (`node` run: "12 passed, 0 failed" incl. an extra exact
case).** The 5 known spelling/width/suffix variants (#1-5) now match; the synonym
(#8) and the 3 genuine non-matches (#9-11) behave correctly.

### No false positives introduced

Cases #9, #10, #11 confirm normalisation does **not** over-match: a vendor absent
from the master, a Latin rendering of a katakana name, and a katakana/kanji synonym
all still return `undefined` (empty dropdown), exactly as a human would want. The
matcher only strips legal-entity noise + spacing/width; it never does substring or
fuzzy partial matching, so two genuinely different names never collide.

## Part B — Server-side master-list injection — MEASURED (live)

> Tests `run_product_lookup(..., categories=[...], vendors=[...])` with a live key,
> comparing the agent's emitted `category`/`brand` spelling with lists OFF vs ON.
> The store lists use canonical spellings that differ from common web spellings
> (`歯磨剤` not `歯磨き粉`; `サンスター` not `サンスター株式会社`).

**MEASURED on 2026-06-02** (live `gpt-4.1` search + `gpt-4.1-nano` extraction).
Master lists injected: `categories=[歯ブラシ, 歯間ブラシ, フロス, 洗口液, 歯磨剤, その他]`,
`vendors=[サンスター, ライオン, GC, クラレノリタケ]`.

| JAN/title | lists | found | category emitted | brand emitted |
|-----------|:----:|:----:|------------------|---------------|
| 4901616005266 | **OFF** | true | `歯磨剤` | `サンスター (Sunstar)` ← annotated |
| 4901616005266 | **ON** | true | `歯磨剤` | **`サンスター`** ← bare canonical |

**Clean flip observed.** With lists OFF the agent emitted `サンスター (Sunstar)` — an
annotated string that does NOT exactly match the master `サンスター` (the old `===`
would fail; the frontend normaliser would have to rescue it). With the master list
injected ON, the agent emitted exactly **`サンスター`**, matching the master verbatim.
Category was already `歯磨剤` (canonical) on both sides — no regression.

Honest caveats from the live runs:
- An earlier run of the **same** JAN returned a clean `サンスター` even with lists
  OFF — i.e. the baseline spelling is product- and run-dependent, so injection's
  benefit shows up *sometimes*, not deterministically. The mechanism is verified;
  its hit-rate is a soft (prompt-based) improvement, not a hard guarantee.
- A title search (`ガム・デンタルペースト`) and JAN `4901616006096` returned
  `found:false` on the ON runs (and OFF for 096) — that is web-search run variance
  for those queries today, **not** the injection breaking search (OFF also failed).
- One OFF run produced brand `サンスター（GUM） [楽天市場ページ]` — a messy string the
  *frontend* normaliser also can't fully clean (the `[楽天市場ページ]` annotation),
  which is exactly why the server-side injection matters: it's better to never emit
  the junk than to clean it after.

**Verdict:** server-side injection is wired correctly and demonstrably steers the
brand toward the canonical master spelling in a live before/after; it is a
probabilistic improvement (prompt-level), with the frontend normaliser as the
deterministic safety net beneath it.

## How A and B combine

- **Part B (server-side)** makes the agent *emit* the master spelling in the first
  place — this is the only thing that can fix the `歯磨剤`/`歯磨き粉` **synonym**
  case (#8), which normalisation provably cannot.
- **Part A (frontend)** stays as the safety net: even if the agent emits a variant
  the prompt didn't catch (older session, list not injected, web-only name), the
  normalised compare still reconciles spelling/width/suffix differences client-side.
