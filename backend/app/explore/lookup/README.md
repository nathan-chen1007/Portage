# Any-product lookup (lab session C, EXPERIMENTAL)

Mounted at `/api/explore/lookup` only when `EXPERIMENTAL=1`. UI: `localhost:3000/?lab=1` (`frontend/src/lab/`).

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/classify` | `{description}` | `{candidates: [{hs6, description, reason, source: llm\|keyword}], mode, catalog}` — every code validated against the HS6 list |
| GET | `/search?q=` | words or a code prefix | `HSCandidate[]` for "switch code" |
| POST | `/rank` | `{hs6, description?, classified_by?, sort_by?, prize_weight?, weights?}` (`?refresh=true` ignores the cache) | `{product, markets: ScoredMarket[], data_status[], opportunity_available, notes}` |
| GET | `/cached` | | products with their data cached (`complete: true` = safe on stage) |

## Where each number comes from
- **HS6 list:** UN Comtrade HS reference, reduced to `data/auto/cache/hs6.json` (6,897 codes). The LLM (DeepSeek via `app.services.llm`) proposes codes; unknown codes are dropped.
- **Tariffs:** WITS / UNCTAD TRAINS per market. MFN = partner 000 (`aveestimated` first so specific duties aren't read as 0), preference for Canada = partner 124 (`reported` first). Latest usable year wins; the year is shown. TRAINS lags, so recent FTA phase-downs may be missing.
- **US Section 338:** `data/auto/cache/section338_hts.json`, 1,080 HTS lines extracted from CBP's Aug 21 2026 list. Listed → +50%. File missing → "not checked", never a guess.
- **Opportunity:** UN Comtrade preview API, 2024 and 2019 imports (world, Canada) + Canada's 2024 exports → `CategoryTrade` → the unchanged `score_opportunity` / `overall_score`.
- **Shipping, LPI, language:** the honey rows in `data/markets.json` (per country). **FX / country risk:** `countries.json`.
- **Compliance:** `app.explore.compliance.auto_requirements(hs6, cc)` (session B) when it returns rows; otherwise two labelled placeholder requirements (tier 3 + 2, 8 weeks, confidence `unknown`) so an unverified market is never scored as paperwork-free. UI: "Compliance not verified — confirm with the Trade Commissioner Service".

## Speed and failure
All source calls run in parallel daemon threads; a request waits `LOOKUP_TIMEOUT` (8 s). Slower calls (WITS often takes 25–40 s) keep running and fill `data/auto/cache/`, so the page shows "still loading" and re-asks automatically. Comtrade is throttled to ~1 call/s with 429 retries. A market whose tariff is unavailable is listed last, unscored. Errors are not cached; "no records" answers are.

Stage: use only products where `/cached` says `complete: true`.
