"""Scoring engine: ranks target markets by the friction a Canadian business faces entering them.

friction = 100 * (w_tariff * tariff + w_compliance * compliance + w_customs * customs + w_tax * tax)

Each component is normalized to 0..1 first, so the score runs from 0 (no barriers) to 100 (every
barrier at its cap). A transparent weighted sum rather than a model: every number on screen traces
back to a sourced value in data/markets.json. See docs/SCORING.md for the rationale.

Blocked markets (no legal route for the product today, e.g. Mexico for Canadian honey) are not
scored at all: a number would suggest "hard but possible". They're listed after every open market.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from app.models import Category, MarketEntry, Middleman, Requirement, ScoredMarket, Weights

# 50% is the highest tariff a trading partner currently applies to a Canadian product that it
# still lets in (US Section 338, Aug 2026). At that level most trade stops, so it counts as maximum
# friction; anything higher (Korea's 243% on honey) is also 1.0.
TARIFF_CAP = 0.50

# Sum of requirement tiers at which compliance counts as maximal. 8 is roughly "a licence, a
# government approval and a registration" (3 + 3 + 2): the SaaS-into-China case in our data.
COMPLIANCE_CAP = 8

# World Bank LPI customs scores run from 1 (worst) to 5 (best).
LPI_MIN, LPI_MAX = 1.0, 5.0

# Below this many points, the "top blocker" label would be noise.
TOP_BLOCKER_MIN_POINTS = 0.5


@dataclass
class Catalog:
    categories: dict[str, Category] = field(default_factory=dict)
    markets: list[MarketEntry] = field(default_factory=list)
    middlemen: list[Middleman] = field(default_factory=list)

    def market(self, category: str, country_code: str) -> MarketEntry | None:
        return next((m for m in self.markets if m.category == category and m.country_code == country_code), None)


def _load_list(path: Path, model):
    with path.open(encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        raise ValueError(f"{path.name}: expected a JSON list")
    # model_validate names the bad field: bad data fails loudly at startup, not quietly in the demo.
    return [model.model_validate(row) for row in raw]


def load_catalog(data_dir: str | Path) -> Catalog:
    """Load and cross-check categories.json, markets.json and middlemen.json."""
    data_dir = Path(data_dir)
    categories = {c.id: c for c in _load_list(data_dir / "categories.json", Category)}
    markets = _load_list(data_dir / "markets.json", MarketEntry)
    middlemen = _load_list(data_dir / "middlemen.json", Middleman)

    seen: set[tuple[str, str]] = set()
    for m in markets:
        if m.category not in categories:
            raise ValueError(f"markets.json: unknown category '{m.category}' ({m.country})")
        key = (m.category, m.country_code)
        if key in seen:
            raise ValueError(f"markets.json: duplicate row for {key}")
        seen.add(key)
        if categories[m.category].kind == "goods" and m.status == "open" and m.lpi_customs_score is None:
            raise ValueError(f"markets.json: goods row {key} needs lpi_customs_score")

    ids: set[str] = set()
    for mm in middlemen:
        if mm.id in ids:
            raise ValueError(f"middlemen.json: duplicate id '{mm.id}'")
        ids.add(mm.id)
        if mm.category != "*" and mm.category not in categories:
            raise ValueError(f"middlemen.json: unknown category '{mm.category}' ({mm.id})")

    return Catalog(categories=categories, markets=markets, middlemen=middlemen)


# ---------- the four normalizers ----------

def normalize_tariff(rate: float, cap: float = TARIFF_CAP) -> float:
    """Tariff as a fraction of the cap, clamped to 0..1 (25% -> 0.5, 50% or more -> 1.0)."""
    return max(0.0, min(rate / cap, 1.0))


def compliance_burden(requirements: list[Requirement], cap: int = COMPLIANCE_CAP) -> float:
    """Sum of requirement tiers over the cap, clamped to 0..1. No requirements -> 0.

    Weighting by tier (1 paperwork, 2 registration/certificate/representative, 3 licence/approval)
    rather than counting items stops five labels from outweighing one government licence.
    """
    return min(sum(r.tier for r in requirements) / cap, 1.0)


def customs_complexity(lpi_customs_score: float | None) -> float:
    """Invert the LPI customs score onto 0..1 (5 -> 0, 1 -> 1). Services don't clear customs -> 0."""
    if lpi_customs_score is None:
        return 0.0
    return (LPI_MAX - lpi_customs_score) / (LPI_MAX - LPI_MIN)


def _normalized_weights(weights: Weights) -> dict[str, float]:
    raw = weights.model_dump()
    total = sum(raw.values())
    if total <= 0:
        raise ValueError("weights must not all be zero")
    return {k: v / total for k, v in raw.items()}


# ---------- scoring and ranking ----------

def score_market(entry: MarketEntry, weights: Weights | None = None) -> ScoredMarket:
    """One market's friction score (0-100) with its per-component breakdown. Rank is filled in later."""
    if entry.status == "blocked":
        return ScoredMarket(country=entry.country, country_code=entry.country_code, status="blocked",
                            status_note=entry.status_note, score=None, rank=0, components={},
                            breakdown={}, top_blocker=None, entry=entry)

    w = _normalized_weights(weights or Weights())
    components = {
        "tariff": normalize_tariff(entry.tariff_rate),
        "compliance": compliance_burden(entry.compliance_requirements),
        "customs": customs_complexity(entry.lpi_customs_score),
        "tax": entry.tax_burden,
    }
    breakdown = {k: round(100 * w[k] * v, 2) for k, v in components.items()}
    score = round(sum(breakdown.values()), 2)
    top = max(breakdown, key=breakdown.get)
    return ScoredMarket(
        country=entry.country,
        country_code=entry.country_code,
        status="open",
        score=score,
        rank=0,
        components={k: round(v, 3) for k, v in components.items()},
        breakdown=breakdown,
        top_blocker=top if breakdown[top] >= TOP_BLOCKER_MIN_POINTS else None,
        entry=entry,
    )


def middlemen_for(catalog: Catalog, category: str, country_code: str) -> list[Middleman]:
    """Curated partners for this market: specific companies first, then category-wide, then government."""
    specific = [m for m in catalog.middlemen if m.category == category and m.country_code == country_code]
    category_wide = [m for m in catalog.middlemen if m.category == category and m.country_code == "*"]
    general = [m for m in catalog.middlemen if m.category == "*" and m.country_code in ("*", country_code)]
    return specific + category_wide + general


def rank_markets(category: str, catalog: Catalog, weights: Weights | None = None) -> list[ScoredMarket]:
    """Every market for the category: open ones easiest (lowest score) first, then blocked ones.
    Ties are broken by country name so the order is stable."""
    scored = [score_market(m, weights) for m in catalog.markets if m.category == category]
    scored.sort(key=lambda s: (s.status == "blocked", s.score if s.score is not None else 0.0, s.country))
    for i, s in enumerate(scored, start=1):
        s.rank = i
        s.middlemen = middlemen_for(catalog, category, s.country_code)
    return scored
