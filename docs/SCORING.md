# How the friction score works

What you need to defend the numbers when a judge pushes on them.

## The formula

```
friction = 100 × (0.40·tariff + 0.35·compliance + 0.15·customs + 0.10·tax)
```

Each component is scaled to 0–1 first, so the score runs from 0 (no barriers) to 100 (every barrier at its cap). Lower is easier. The breakdown on screen is each term of that sum, so the parts always add up to the total.

**Why a weighted sum and not ML?** The score has to be explainable. Every number traces back to a sourced value in `backend/data/markets.json`, and a founder can see exactly why a market ranked where it did. There's also no labelled "market-entry success" data to train a model on. The LLM never produces a number: it only reads the founder's description and drafts emails.

## The four components

| Component | How it's computed | Where the input comes from |
|---|---|---|
| **Tariff** | applied rate ÷ 50%, capped at 1 | UNCTAD TRAINS via World Bank WITS; Japan Customs schedule (Aug 8, 2026); CBP's Section 338 HTS list |
| **Compliance** | sum of requirement tiers ÷ 8, capped at 1 | CFIA's export requirements library and each foreign regulator's own page |
| **Customs** | (5 − LPI customs score) ÷ 4 | World Bank Logistics Performance Index, customs efficiency (1–5) |
| **Tax** | 0 = none, 0.5 = register above thresholds, 1 = from first sale | National tax authorities / case law (e.g. *Wayfair* for US SaaS) |

**Tariff cap = 50%.** The US Section 338 rate on Canadian honey (in force Aug 22, 2026). At that level most trade stops, so it counts as maximum friction. Korea's 243% honey tariff also scores 1.0.

**Compliance tiers:**

- Tier 1: paperwork or self-declaration (a label, an origin statement, a supplier's commercial document).
- Tier 2: registering with a foreign regulator, a government-issued certificate per shipment, or appointing a local representative.
- Tier 3: a licence, government approval or audit with months of lead time.

Weighting by tier stops five labelling rules from outweighing one government licence. The cap of 8 is roughly a licence, an approval and a registration (3 + 3 + 2), the heaviest case in our data (SaaS into China).

**Tax is about obligations, not rates.** For goods, the importer pays and recovers import VAT, so the Canadian exporter's tax friction is 0. What counts is whether *you* have to register and collect.

**Blocked markets aren't scored.** If there's no legal route today (CFIA: "Canada does not meet Mexico's requirements for exporting honey… No certificate is currently available"), a number would wrongly suggest "hard but possible". Those markets are listed last with the reason.

## Why these weights

- **Tariff 0.40.** A direct, unrecoverable cost on every unit sold, for as long as you sell.
- **Compliance 0.35.** An up-front cost plus months of lead time before the first sale. Paid mostly once, so it sits just under tariffs.
- **Customs 0.15.** Delay and uncertainty per shipment, not a hard blocker.
- **Tax 0.10.** Mostly an administrative burden.

The weights are adjustable (`POST /api/rank` with `weights`) and normalized, so they needn't sum to 1. **If a judge says "those weights are arbitrary":** yes, they're a judgment call, and they're exposed on purpose. The honey story is robust to them: the US stays behind Japan, the UK, Australia, Germany and China for any tariff weight from 0.2 to 0.6 (there's a test for this), because nothing else comes close to a 50% tariff.

## The demo story in numbers (default weights)

**Honey.**

| Rank | Market | Score | Why |
|---|---|---|---|
| 1 | Japan | 17.2 | 0% under CPTPP, paperwork only. Already Canada's #2 honey market |
| 2 | Australia | 18.0 | 0% tariff, paperwork, but a big domestic producer |
| 3 | United Kingdom | 18.7 | 0% under CUKTCA; no CFIA certificate needed since Apr 2024 |
| 4 | Germany (EU) | 34.7 | 0% under CETA, but EU establishment listing + a TRACES certificate per shipment |
| 5 | China | 40.3 | 15% tariff plus CIFER registration and per-lot certificates |
| 6 | United States | 66.8 | 50% Section 338 tariff, no CUSMA exemption. 68% of our honey exports went here |
| 7 | South Korea | 70.4 | 243%: honey was carved out of the Canada-Korea FTA |
| — | Mexico | blocked | No CFIA export certificate available for honey |

Story: grow Japan, open the UK.

**B2B SaaS.** Tariffs don't touch software, so the ranking is all compliance: Australia and Mexico lead, Germany and the UK carry GDPR representative duties, and China is last (ICP licence, data-export approval, withholding tax). Same engine, different blockers.

## Known limits (say these before a judge does)

- The data is a curated snapshot (as of Sept 26, 2026), not live. Tariffs are moving fast; each row carries its `as_of` date and sources.
- Two fully loaded categories. Adding one means adding sourced rows; no code changes.
- LPI customs scores are country-wide, not product-specific.
- Documents are drafts for the founder to review. Portage never files anything itself.
