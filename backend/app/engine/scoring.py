"""Scoring engine: ranks target markets by the friction a Canadian business faces entering them.

friction = 100 * (0.35 tariff + 0.30 compliance + 0.15 logistics + 0.10 risk + 0.10 tax)

  compliance = 0.6 * paperwork tiers + 0.4 * lead time to first shipment
  logistics  = 0.5 * sea distance + 0.25 * sailing frequency + 0.25 * customs efficiency   (goods only)
  risk       = 0.6 * currency volatility vs CAD + 0.4 * OECD country risk

Each component (and each factor inside it) is normalized to 0..1 first, so the score runs from 0 (no barriers) to 100 (every
barrier at its cap). A transparent weighted sum rather than a model: every number on screen traces
back to a sourced value in data/markets.json. See docs/SCORING.md for the rationale.

Blocked markets (no legal route for the product today, e.g. Mexico for Canadian honey) are not
scored at all: a number would suggest "hard but possible". They're listed after every open market.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from app.models import Category, CountryFacts, MarketEntry, Middleman, Requirement, ScoredMarket, Weights

# 50% is the highest tariff a trading partner currently applies to a Canadian product that it
# still lets in (US Section 338, Aug 2026). At that level most trade stops, so it counts as maximum
# friction; anything higher (Korea's 243% on honey) is also 1.0.
TARIFF_CAP = 0.50

# Sum of requirement tiers at which compliance counts as maximal. 8 is roughly "a licence, a
# government approval and a registration" (3 + 3 + 2): the SaaS-into-China case in our data.
COMPLIANCE_CAP = 8

# World Bank LPI customs scores run from 1 (worst) to 5 (best).
LPI_MIN, LPI_MAX = 1.0, 5.0

# Half a year before you can ship at all counts as maximal delay.
LEAD_TIME_CAP_WEEKS = 26

# ~10,000 nautical miles is Vancouver to Sydney, the longest lane in our data (about a month at sea).
DISTANCE_CAP_NM = 10_000

# Four or more container departures a week means you're never waiting long for a ship.
SAILINGS_FULL = 4

# 10% annual volatility against CAD would wipe out a typical export margin in a bad year.
FX_VOL_CAP = 0.10

# OECD country risk categories run 0 (high-income OECD / euro area) to 7.
COUNTRY_RISK_MAX = 7

# How factors combine inside each component.
COMPLIANCE_MIX = {"tiers": 0.6, "lead_time": 0.4}
LOGISTICS_MIX = {"distance": 0.5, "sailings": 0.25, "customs": 0.25}
RISK_MIX = {"fx": 0.6, "country_risk": 0.4}

# Below this many points, the "top blocker" label would be noise.
TOP_BLOCKER_MIN_POINTS = 0.5


@dataclass
class Catalog:
    categories: dict[str, Category] = field(default_factory=dict)
    markets: list[MarketEntry] = field(default_factory=list)
    middlemen: list[Middleman] = field(default_factory=list)
    countries: dict[str, CountryFacts] = field(default_factory=dict)

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
    countries = {c.country_code: c for c in _load_list(data_dir / "countries.json", CountryFacts)}

    seen: set[tuple[str, str]] = set()
    for m in markets:
        if m.category not in categories:
            raise ValueError(f"markets.json: unknown category '{m.category}' ({m.country})")
        key = (m.category, m.country_code)
        if key in seen:
            raise ValueError(f"markets.json: duplicate row for {key}")
        seen.add(key)
        if categories[m.category].kind == "goods" and m.status == "open":
            if m.lpi_customs_score is None or m.sea_distance_nm is None or m.weekly_sailings is None:
                raise ValueError(f"markets.json: goods row {key} needs lpi_customs_score, sea_distance_nm and weekly_sailings")
        if m.country_code not in countries:
            raise ValueError(f"countries.json: no row for {m.country_code} ({m.country})")

    ids: set[str] = set()
    for mm in middlemen:
        if mm.id in ids:
            raise ValueError(f"middlemen.json: duplicate id '{mm.id}'")
        ids.add(mm.id)
        if mm.category != "*" and mm.category not in categories:
            raise ValueError(f"middlemen.json: unknown category '{mm.category}' ({mm.id})")

    return Catalog(categories=categories, markets=markets, middlemen=middlemen, countries=countries)


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


def lead_time_weeks(requirements: list[Requirement]) -> tuple[float, bool]:
    """Weeks before the first shipment can leave, and whether that figure is an estimate.
    Steps run in parallel, so it's the longest single step, not the sum."""
    if not requirements:
        return 0.0, False
    longest = max(requirements, key=lambda r: r.lead_time_weeks)
    return longest.lead_time_weeks, longest.lead_time_basis == "estimate" and longest.lead_time_weeks > 0


def lead_time_burden(weeks: float, cap: float = LEAD_TIME_CAP_WEEKS) -> float:
    """Weeks to first shipment over the cap, clamped to 0..1 (13 weeks -> 0.5)."""
    return min(weeks / cap, 1.0)


def customs_complexity(lpi_customs_score: float | None) -> float:
    """Invert the LPI customs score onto 0..1 (5 -> 0, 1 -> 1). Services don't clear customs -> 0."""
    if lpi_customs_score is None:
        return 0.0
    return (LPI_MAX - lpi_customs_score) / (LPI_MAX - LPI_MIN)


def distance_burden(nm: float | None, cap: float = DISTANCE_CAP_NM) -> float:
    """Sea distance over the cap, clamped to 0..1. Land border -> 0; services (None) -> 0."""
    return 0.0 if nm is None else min(nm / cap, 1.0)


def sailing_gap(weekly_sailings: float | None, full: float = SAILINGS_FULL) -> float:
    """How thin the shipping lane is: 4+ departures a week -> 0, one every other week -> ~0.9."""
    return 0.0 if weekly_sailings is None else 1.0 - min(weekly_sailings, full) / full


def fx_risk(volatility: float | None, cap: float = FX_VOL_CAP) -> float:
    """Currency volatility against CAD over the cap, clamped to 0..1 (5% -> 0.5)."""
    return 0.0 if volatility is None else min(volatility / cap, 1.0)


def country_risk(category: int | None) -> float:
    """OECD country risk category onto 0..1 (0 -> 0, 7 -> 1)."""
    return 0.0 if category is None else category / COUNTRY_RISK_MAX


def _mix(parts: dict[str, float], mix: dict[str, float]) -> float:
    return sum(mix[k] * parts[k] for k in mix)


def _normalized_weights(weights: Weights) -> dict[str, float]:
    raw = weights.model_dump()
    total = sum(raw.values())
    if total <= 0:
        raise ValueError("weights must not all be zero")
    return {k: v / total for k, v in raw.items()}


# ---------- scoring and ranking ----------

def score_market(entry: MarketEntry, weights: Weights | None = None, facts: CountryFacts | None = None) -> ScoredMarket:
    """One market's friction score (0-100) with its per-component breakdown. Rank is filled in later."""
    if entry.status == "blocked":
        return ScoredMarket(country=entry.country, country_code=entry.country_code, status="blocked",
                            status_note=entry.status_note, score=None, rank=0, components={}, factors={},
                            breakdown={}, top_blocker=None, entry=entry, country_facts=facts)

    w = _normalized_weights(weights or Weights())
    weeks, estimated = lead_time_weeks(entry.compliance_requirements)
    factors = {
        "tiers": compliance_burden(entry.compliance_requirements),
        "lead_time": lead_time_burden(weeks),
        "distance": distance_burden(entry.sea_distance_nm),
        "sailings": sailing_gap(entry.weekly_sailings),
        "customs": customs_complexity(entry.lpi_customs_score),
        "fx": fx_risk(facts.fx_volatility if facts else None),
        "country_risk": country_risk(facts.country_risk if facts else None),
    }
    components = {
        "tariff": normalize_tariff(entry.tariff_rate),
        "compliance": _mix(factors, COMPLIANCE_MIX),
        "logistics": _mix(factors, LOGISTICS_MIX),
        "risk": _mix(factors, RISK_MIX),
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
        factors={k: round(v, 3) for k, v in factors.items()},
        breakdown=breakdown,
        top_blocker=top if breakdown[top] >= TOP_BLOCKER_MIN_POINTS else None,
        lead_time_weeks=weeks,
        lead_time_estimated=estimated,
        entry=entry,
        country_facts=facts,
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
    scored = [score_market(m, weights, catalog.countries.get(m.country_code))
              for m in catalog.markets if m.category == category]
    scored.sort(key=lambda s: (s.status == "blocked", s.score if s.score is not None else 0.0, s.country))
    for i, s in enumerate(scored, start=1):
        s.rank = i
        s.middlemen = middlemen_for(catalog, category, s.country_code)
    return scored
