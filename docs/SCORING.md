# How Portage scores markets

What you need to defend the numbers when a judge pushes on them.

Every market gets three scores:

- **Friction** (0–100, lower is easier): how hard it is to get in. Sections below.
- **Opportunity** (0–100, higher is better): how much the market is worth entering. [Jump](#opportunity).
- **Overall** (0–100, higher is better): the recommendation that blends the two. [Jump](#overall-recommendation).

The UI can rank by any of the three; the default is overall.

# Friction

## The formula

```
friction = 100 × (0.35·tariff + 0.30·compliance + 0.15·logistics + 0.10·risk + 0.10·tax)

  compliance = 0.6·paperwork tiers + 0.4·lead time to first shipment
  logistics  = 0.5·sea distance + 0.25·sailing frequency + 0.25·customs efficiency   (goods only)
  risk       = 0.6·currency volatility vs CAD + 0.4·OECD country risk
```

Every component and every factor inside it is scaled to 0–1 first, so the score runs from 0 (no barriers) to 100 (every barrier at its cap). Lower is easier. The breakdown on screen is each term of the sum, so the parts always add up to the total, and `factors` in the API exposes the sub-scores behind each part.

**Why a weighted sum and not ML?** The score has to be explainable. Every number traces back to a sourced value in `backend/data/`, and a founder can see exactly why a market ranked where it did. There's no labelled "market-entry success" data to train a model on anyway. The LLM never produces a number: it only reads the founder's description and drafts emails.

## The five components

| Component | Factor | How it's computed | Source |
|---|---|---|---|
| **Tariff** | — | applied rate ÷ 50%, capped at 1 | WITS/UNCTAD TRAINS; Japan Customs schedule (Aug 8, 2026); CBP Section 338 list |
| **Compliance** | tiers | sum of requirement tiers ÷ 8, capped at 1 | CFIA export requirements library, each foreign regulator |
| | lead time | weeks before the first legal shipment ÷ 26, capped at 1. The longest single step, because steps run in parallel | Official deadlines where they exist (e.g. Korea: MFDS registration ≥7 days before import); otherwise a labelled estimate |
| **Logistics** | distance | sea distance from the best Canadian gateway port ÷ 10,000 nm (land border = 0) | Fluent Cargo lane data |
| | sailings | 1 − (container departures per week ÷ 4), floored at 0 | Fluent Cargo lane data |
| | customs | (5 − World Bank LPI customs score) ÷ 4 | World Bank LPI |
| **Risk** | fx | annualized volatility of the currency vs CAD ÷ 10%, capped at 1 | Bank of Canada monthly rates, Sep 2023–Aug 2026 |
| | country risk | OECD country risk category ÷ 7 | OECD Arrangement classification (list effective Jul 3, 2026) |
| **Tax** | — | 0 = none, 0.5 = register above thresholds, 1 = from first sale | National tax authorities / case law (*Wayfair* for US SaaS) |

**Why these factors (the gates small exporters actually report):** CFIB's 2024 survey of exporting SMEs put shipping costs first (66%), currency second (56%), duties and taxes third (50%). Tariff and tax cover duties; logistics covers shipping; risk covers currency and getting paid. Compliance and lead time cover the paperwork and the wait that trip up first-time exporters.

**Caps.** 50% tariff: the US Section 338 rate on Canadian honey; above that trade mostly stops (Korea's 243% also scores 1). 8 tier points: a licence, an approval and a registration (3 + 3 + 2), the SaaS-into-China case. 26 weeks: half a year of waiting before a first sale. 10,000 nm: Vancouver–Sydney, about a month at sea. 4 sailings a week: you're never waiting long for a ship. 10% currency volatility: enough to erase a typical export margin in a bad year.

**Lead-time estimates are labelled.** Where a regulator publishes a deadline we use it (`lead_time_basis: "official"`); where none exists (e.g. China's GACC review for honey, the EU's establishment listing) we use a stated estimate and the API returns `lead_time_estimated: true` so the UI can say so.

**Blocked markets aren't scored.** If there's no legal route today (CFIA: "Canada does not meet Mexico's requirements for exporting honey… No certificate is currently available"), a number would wrongly suggest "hard but possible". Those markets are listed last with the reason.

## Why these weights

- **Tariff 0.35.** A direct, unrecoverable cost on every unit sold, for as long as you sell.
- **Compliance 0.30.** Up-front cost plus months of waiting before the first sale; paid mostly once.
- **Logistics 0.15.** Freight cost and transit time on every shipment, but rarely a deal-breaker for shelf-stable goods like honey.
- **Risk 0.10.** Currency and payment risk can be hedged or insured (EDC), so it matters less than a tariff.
- **Tax 0.10.** Mostly an administrative burden; for goods the importer handles VAT, so it's usually 0.

The weights are adjustable (`POST /api/rank` with `weights`) and normalized, so they needn't sum to 1. **If a judge says "those weights are arbitrary":** yes, they're a judgment call, and they're exposed on purpose so a founder can set their own. The honey story is robust to them: the US stays behind the UK, Japan, Australia, Germany and China for any tariff weight from 0.2 to 0.6 (there's a test for this).

## The demo story in numbers (default weights)

**Honey.**

| Rank | Market | Score | Biggest blocker | Why |
|---|---|---|---|---|
| 1 | United Kingdom | 15.7 | compliance | 0% under CUKTCA, no CFIA certificate needed, ~13 days by sea |
| 2 | Japan | 18.1 | compliance | 0% under CPTPP, paperwork only, direct weekly sailings. Already Canada's #2 honey market |
| 3 | Australia | 21.8 | logistics | 0% and easy paperwork, but a month at sea and thin sailings |
| 4 | Germany (EU) | 30.2 | compliance | 0% under CETA, but ~12 weeks for EU establishment listing + a TRACES certificate per shipment |
| 5 | China | 38.9 | compliance | 15% tariff, ~4 months of CIFER/GACC registration, OECD risk 2 |
| 6 | United States | 50.7 | tariff | 50% Section 338 tariff, no CUSMA exemption. 68% of our honey exports went here |
| 7 | South Korea | 57.4 | tariff | 243%: honey was carved out of the Canada-Korea FTA |
| — | Mexico | blocked | — | No CFIA export certificate available for honey |

Story: open the UK, grow Japan. Australia shows why logistics matters: easy on paper, hard to serve.

**B2B SaaS.** No tariffs or shipping, so the ranking is compliance plus risk: Australia leads; Korea and Japan are close; Mexico's peso volatility (8% a year vs CAD) and OECD risk 3 now count against it; Germany and the UK carry GDPR representative duties; China is last (ICP licence ~4 months, data-export approval, withholding tax).

## Opportunity

```
opportunity = 100 × (0.35·demand + 0.25·price + 0.15·growth + 0.25·foothold)
```

All four come from one dataset: UN Comtrade annual imports of natural honey (HS 0409) reported by each market, 2024 vs 2019, in US dollars.

| Factor | How it's computed | Why |
|---|---|---|
| **Demand** | annual imports on a log scale: $1M → 0, $1B → 1 | A bigger import market has more buyers. Log scale so the US doesn't swamp everything |
| **Price** | the market's average import price per kg **after the tariff a Canadian exporter pays**, ÷ Canada's own average export price, ÷ 1.5 (capped at 1) | Premium markets pay more per kg, but a tariff eats that premium. Korea pays $8.04/kg; after 243% duty that's $2.34, below Canada's $4.04 |
| **Growth** | compound annual growth of imports 2019–2024: −10%/yr → 0, +10%/yr → 1 | Growing markets have room for new suppliers |
| **Foothold** | Canada's share of the market's imports: 10% or more → 1 | Buyers, routes and reputation already exist, so it's less risky for a newcomer |

**Honey numbers (2024):**

| Market | Imports | Price paid / after tariff | Growth 2019–24 | Canada's share | Opportunity |
|---|---|---|---|---|---|
| Japan | $137M | $3.01 / $3.01 | −1.1%/yr | 12.0% | **69.0** |
| United States | $650M | $2.55 / $1.70 | +8.6%/yr | 4.2% | 64.4 |
| South Korea | $17M | $8.04 / $2.34 | +11.1%/yr | 5.8% | 53.7 |
| Germany | $234M | $2.97 / $2.97 | +0.3%/yr | ~0% | 47.6 |
| China | $48M | $15.23 / $13.24 | −10.7%/yr | 0.3% | 45.5 |
| United Kingdom | $123M | $2.04 / $2.04 | +2.1%/yr | ~0% | 41.9 |
| Australia | $34M | $3.78 / $3.78 | −1.5%/yr | 0% | 39.9 |

Canada's own export price: $4.04/kg (11,206 t, $45.3M, 2024).

**Caveats to say out loud.** China's average price is inflated by premium New Zealand manuka honey, so its price factor overstates what Canadian clover honey would fetch. The US figures are from 2024, before the 50% tariff. Import averages mix bulk and retail honey, so price is a relative signal, not a quote. Services don't cross customs, so there's no equivalent trade data for SaaS: its opportunity is shown as unavailable rather than guessed.

## Overall recommendation

```
overall = opportunity^a × ease^(1−a),   ease = 100 − friction,   a = 0.5 by default
```

A geometric mean, not an average: a near-zero on either side drags the result down. A big market behind a prohibitive barrier isn't a good bet, and neither is an easy market nobody buys in. An average would let Korea's growth and foothold hide its 243% tariff.

`a` is the one slider a founder needs: 0 = **quick wins** (ease only), 1 = **biggest prize** (opportunity only). A cash-tight beekeeper slides left; a well-funded packer slides right. It also answers "your weights are arbitrary": the founder chooses.

**Honey, default a = 0.5:**

| Rank | Market | Overall | Friction | Opportunity | The one-line story |
|---|---|---|---|---|---|
| 1 | Japan | **75.2** | 18.1 | 69.0 | Already a Canadian honey market, 0% under CPTPP, paperwork only. Go here first |
| 2 | United Kingdom | 59.4 | 15.7 | 41.9 | Easiest market to enter, but Canada has no foothold yet |
| 3 | Germany | 57.7 | 30.2 | 47.6 | Europe's biggest importer, behind 12 weeks of EU listing |
| 4 | United States | 56.3 | 50.7 | 64.4 | Still the biggest market, but the 50% tariff costs a third of the price |
| 5 | Australia | 55.8 | 21.8 | 39.9 | Easy paperwork, a month at sea, and it produces its own honey |
| 6 | China | 52.7 | 38.9 | 45.5 | Shrinking imports, 15% tariff, months of registration |
| 7 | South Korea | 47.8 | 57.4 | 53.7 | Growing and premium, but the tariff wipes out the premium |
| — | Mexico | — | blocked | — | No CFIA export certificate for honey |

Slider at quick wins (a = 0): UK first. Slider at biggest prize (a = 1): Japan first, US second.

## Known limits (say these before a judge does)

- The data is a curated snapshot (as of Sept 26, 2026), not live. Each row carries `as_of` and its sources.
- Distances are port to port from the best Canadian gateway; the inland leg (e.g. Alberta to Vancouver by rail) isn't counted yet, so the score is the same wherever in Canada you are.
- Some lead times are estimates (flagged); LPI customs scores are country-wide, not product-specific.
- Opportunity uses 2024 trade data (latest complete year) and exists for goods only.
- Documents are drafts for the founder to review. Portage never files anything itself.
