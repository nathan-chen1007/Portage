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
