"""Opportunity score: how much a market is worth entering, from UN Comtrade import data.

opportunity = 100 * (0.35 demand + 0.25 price + 0.15 growth + 0.25 foothold)

  demand    how much the market imports a year, on a log scale ($1M -> 0, $1B -> 1)
  price     what it pays per kg AFTER the tariff a Canadian exporter faces, relative to Canada's own
            export price (1.5x Canada's price or more -> 1). This is where a prohibitive tariff bites:
            Korea pays $8/kg, but after 243% duty that's $2.34, below what Canadian honey sells for.
  growth    compound annual growth of imports (-10%/yr -> 0, +10%/yr -> 1)
  foothold  Canada's current share of the market's imports (10% or more -> 1): buyers and shipping
            routes already exist, so a newcomer's risk is lower.

Combined with friction into one recommendation:

  overall = opportunity^a * ease^(1-a),   ease = 100 - friction,   a = prize_weight (default 0.5)

A geometric mean, not an average, so a near-zero on either side drags the result down: a big market
behind a prohibitive barrier is not a good bet, and neither is an easy market nobody buys in.
"""

import math

from app.models import CategoryTrade, MarketEntry, MarketTrade, OpportunityFacts

OPPORTUNITY_MIX = {"demand": 0.35, "price": 0.25, "growth": 0.15, "foothold": 0.25}

DEMAND_FLOOR_USD, DEMAND_CEIL_USD = 1e6, 1e9
PRICE_RATIO_FULL = 1.5
GROWTH_MIN, GROWTH_MAX = -0.10, 0.10
FOOTHOLD_FULL = 0.10
DEFAULT_PRIZE_WEIGHT = 0.5


def demand_score(import_value_usd: float) -> float:
    """log10 scale between $1M (0) and $1B (1), clamped."""
    if import_value_usd <= DEMAND_FLOOR_USD:
        return 0.0
    x = math.log10(import_value_usd / DEMAND_FLOOR_USD) / math.log10(DEMAND_CEIL_USD / DEMAND_FLOOR_USD)
    return min(x, 1.0)


def price_score(net_unit_value: float, canada_unit_value: float) -> float:
    """Post-tariff import price over Canada's export price, divided by 1.5, clamped to 0..1."""
    return max(0.0, min(net_unit_value / canada_unit_value / PRICE_RATIO_FULL, 1.0))


def growth_rate(value: float, base: float, years: int) -> float:
    if base <= 0 or value <= 0 or years <= 0:
        return 0.0
    return (value / base) ** (1 / years) - 1


def growth_score(rate: float) -> float:
    return max(0.0, min((rate - GROWTH_MIN) / (GROWTH_MAX - GROWTH_MIN), 1.0))


def foothold_score(share: float) -> float:
    return max(0.0, min(share / FOOTHOLD_FULL, 1.0))


def score_opportunity(trade: CategoryTrade, market: MarketTrade, entry: MarketEntry) -> tuple[float, dict, OpportunityFacts]:
    """Opportunity 0-100, its four components, and the display facts."""
    unit = market.import_value_usd / market.import_volume_kg if market.import_volume_kg else 0.0
    net = unit / (1 + entry.tariff_rate)
    ca_unit = trade.canada_unit_value
    years = trade.year - trade.base_year
    rate = growth_rate(market.import_value_usd, market.import_value_base_usd, years)
    share = market.canada_value_usd / market.import_value_usd if market.import_value_usd else 0.0
    parts = {
        "demand": demand_score(market.import_value_usd),
        "price": price_score(net, ca_unit),
        "growth": growth_score(rate),
        "foothold": foothold_score(share),
    }
    score = round(100 * sum(OPPORTUNITY_MIX[k] * v for k, v in parts.items()), 2)
    facts = OpportunityFacts(
        year=trade.year,
        import_value_usd=market.import_value_usd,
        import_volume_kg=market.import_volume_kg,
        unit_value_usd_kg=round(unit, 2),
        net_unit_value_usd_kg=round(net, 2),
        canada_unit_value_usd_kg=round(ca_unit, 2),
        growth_rate=round(rate, 4),
        growth_years=f"{trade.base_year}–{trade.year}",
        canada_share=round(share, 4),
        note=market.note,
        sources=market.sources + [trade.canada_export_source],
    )
    return score, {k: round(v, 3) for k, v in parts.items()}, facts


def overall_score(opportunity: float | None, friction: float, prize_weight: float = DEFAULT_PRIZE_WEIGHT) -> float:
    """Geometric blend of opportunity and ease (100 - friction). Without opportunity data, overall = ease."""
    ease = max(0.0, 100.0 - friction)
    if opportunity is None:
        return round(ease, 2)
    a = max(0.0, min(prize_weight, 1.0))
    return round((max(opportunity, 0.0) ** a) * (ease ** (1 - a)), 2)
