from pathlib import Path

import pytest

from app.engine.opportunity import (
    demand_score,
    foothold_score,
    growth_rate,
    growth_score,
    overall_score,
    price_score,
)
from app.engine.scoring import load_catalog, rank_markets

DATA = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(scope="module")
def catalog():
    return load_catalog(DATA)


def test_normalizers():
    assert demand_score(1e6) == 0 and demand_score(1e9) == 1 and abs(demand_score(3.16e7) - 0.5) < 0.01
    assert price_score(4.0, 4.0) == pytest.approx(1 / 1.5) and price_score(10, 4) == 1
    assert abs(growth_rate(121, 100, 2) - 0.10) < 1e-9
    assert growth_score(-0.2) == 0 and growth_score(0) == 0.5 and growth_score(0.3) == 1
    assert foothold_score(0.05) == 0.5 and foothold_score(0.2) == 1


def test_overall_is_a_geometric_blend():
    assert overall_score(64, 0) == pytest.approx(80)       # sqrt(64 * 100)
    assert overall_score(None, 30) == 70                    # no trade data: ease only
    assert overall_score(80, 20, prize_weight=0) == 80      # quick wins: ease only
    assert overall_score(50, 20, prize_weight=1) == 50      # biggest prize: opportunity only
    assert overall_score(0, 0) == 0                         # nobody buys: not a recommendation


def test_honey_overall_story(catalog):
    ranked = rank_markets("honey", catalog)
    order = [r.country_code for r in ranked]
    # Japan: already a Canadian honey market, 0% under CPTPP, easy paperwork -> go first.
    assert order[0] == "JP"
    assert ranked[0].opportunity_components["foothold"] == 1.0
    # Korea pays a premium, but after the 243% tariff the price is below Canada's own -> last open market.
    kr = ranked[order.index("KR")]
    assert kr.opportunity_facts.net_unit_value_usd_kg < kr.opportunity_facts.canada_unit_value_usd_kg
    assert order[-2] == "KR" and order[-1] == "MX"
    assert ranked[-1].overall is None and ranked[-1].opportunity is None


def test_sort_modes(catalog):
    friction = [r.country_code for r in rank_markets("honey", catalog, sort_by="friction")]
    assert friction[0] == "GB"
    opp = rank_markets("honey", catalog, sort_by="opportunity")
    vals = [r.opportunity for r in opp if r.opportunity is not None]
    assert vals == sorted(vals, reverse=True)
    # The slider: quick wins -> the easiest market leads; biggest prize -> the most valuable leads.
    assert rank_markets("honey", catalog, prize_weight=0)[0].country_code == "GB"
    assert rank_markets("honey", catalog, prize_weight=1)[0].country_code == "JP"


def test_saas_has_no_opportunity_data(catalog):
    ranked = rank_markets("b2b_saas", catalog)
    assert all(r.opportunity is None for r in ranked)
    assert all(r.overall == round(100 - r.score, 2) for r in ranked)
    assert ranked[-1].country_code == "CN"
    assert [r.country_code for r in rank_markets("b2b_saas", catalog, sort_by="opportunity")][-1] == "CN"


def test_trade_rows_are_sourced(catalog):
    t = catalog.trade["honey"]
    assert t.canada_export_source.startswith("https://")
    for m in t.markets:
        assert all(s.startswith("https://") for s in m.sources)


def test_missing_inputs_are_unavailable_not_zero(catalog):
    """A market that reports import values but no weights has no price per kg: the price component is
    dropped (None) and the other three are re-weighted, instead of scoring price as 0."""
    from app.engine.opportunity import OPPORTUNITY_MIX, score_opportunity, weighted_opportunity

    trade = catalog.trade["honey"]
    entry = catalog.market("honey", "GB")
    mt = next(m for m in trade.markets if m.country_code == "GB")
    full, parts, _ = score_opportunity(trade, mt, entry)
    no_kg, parts2, _ = score_opportunity(trade, mt.model_copy(update={"import_volume_kg": 0}), entry)
    assert parts2["price"] is None and parts2["demand"] == parts["demand"]
    rest = {k: v for k, v in parts2.items() if v is not None}
    expected = 100 * sum(OPPORTUNITY_MIX[k] * v for k, v in rest.items()) / sum(OPPORTUNITY_MIX[k] for k in rest)
    assert no_kg == pytest.approx(expected, abs=0.01)
    no_base, parts3, _ = score_opportunity(trade, mt.model_copy(update={"import_value_base_usd": 0}), entry)
    assert parts3["growth"] is None
    assert weighted_opportunity({"demand": 1.0, "price": None, "growth": None, "foothold": 0.0}) == pytest.approx(
        100 * 0.35 / 0.6, abs=0.01)
    # France reports no 2024 import weights for honey (UN Comtrade), so only its price is unavailable.
    for m in rank_markets("honey", catalog):
        missing = [k for k, v in (m.opportunity_components or {}).items() if v is None]
        assert missing == (["price"] if m.country_code == "FR" else [])
