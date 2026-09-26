"""Run from backend/:  python -m pytest -q"""

from pathlib import Path

import pytest

from app.engine.scoring import (
    compliance_burden,
    customs_complexity,
    load_catalog,
    normalize_tariff,
    rank_markets,
    score_market,
)
from app.models import MarketEntry, Requirement, Weights

DATA = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(scope="module")
def catalog():
    return load_catalog(DATA)


def req(tier):
    return Requirement(name="x", tier=tier, detail="x", source="https://example.com")


def test_normalizers():
    assert normalize_tariff(0) == 0
    assert normalize_tariff(0.25) == 0.5
    assert normalize_tariff(2.43) == 1.0  # Korea's 243% honey tariff caps at 1
    assert compliance_burden([]) == 0
    assert compliance_burden([req(1), req(3)]) == 0.5
    assert compliance_burden([req(3)] * 5) == 1.0
    assert customs_complexity(None) == 0
    assert customs_complexity(5) == 0
    assert customs_complexity(1) == 1


def test_catalog_loads_and_every_row_is_sourced(catalog):
    assert set(catalog.categories) == {"honey", "b2b_saas"}
    assert len(catalog.markets) == 16
    for m in catalog.markets:
        assert m.sources
        for r in m.compliance_requirements:
            assert r.source.startswith("https://")


def test_breakdown_sums_to_score(catalog):
    for m in catalog.markets:
        s = score_market(m)
        if s.status == "blocked":
            continue
        assert abs(sum(s.breakdown.values()) - s.score) < 0.05
        assert 0 <= s.score <= 100


def test_honey_ranking_story(catalog):
    ranked = rank_markets("honey", catalog)
    order = [r.country_code for r in ranked]
    # Japan (already #2 market, now 0% under CPTPP) leads; the UK is paperwork-only.
    assert order[0] == "JP"
    assert order.index("GB") < order.index("DE")
    # The US, 68% of honey exports, is now behind every FTA market because of the 50% tariff.
    us = ranked[order.index("US")]
    assert us.top_blocker == "tariff"
    assert all(order.index(c) < order.index("US") for c in ["JP", "GB", "AU", "DE", "CN"])
    # Mexico is closed to Canadian honey: listed last, unscored.
    assert order[-1] == "MX"
    assert ranked[-1].status == "blocked" and ranked[-1].score is None and ranked[-1].breakdown == {}
    assert [r.rank for r in ranked] == list(range(1, len(ranked) + 1))
    assert [m.id for m in ranked[0].middlemen][-1] == "tcs"


def test_saas_ranking_story(catalog):
    ranked = rank_markets("b2b_saas", catalog)
    assert ranked[-1].country_code == "CN"
    assert all(r.components["tariff"] == 0 and r.components["customs"] == 0 for r in ranked)


def test_blocked_stays_last_under_any_weights(catalog):
    for w in [Weights(tariff=1, compliance=0, customs=0, tax=0), Weights(tariff=0, compliance=1, customs=0, tax=0)]:
        assert rank_markets("honey", catalog, w)[-1].country_code == "MX"


def test_us_honey_last_open_market_whenever_tariffs_count(catalog):
    # Robustness claim in docs/SCORING.md: with any meaningful tariff weight, US stays behind the FTA markets.
    for t in [0.2, 0.4, 0.6]:
        order = [r.country_code for r in rank_markets("honey", catalog, Weights(tariff=t, compliance=0.35, customs=0.15, tax=0.1))]
        assert order.index("US") > order.index("DE")


def test_weights_are_normalized(catalog):
    m = catalog.markets[0]
    assert score_market(m, Weights(tariff=4, compliance=3.5, customs=1.5, tax=1)).score == score_market(m).score


def test_blocked_entry_needs_a_reason():
    with pytest.raises(ValueError):
        MarketEntry(category="honey", country="X", country_code="XX", language="en", status="blocked",
                    tariff_rate=0, sources=["https://example.com"], as_of="2026-09-26")


def test_unknown_category_is_empty(catalog):
    assert rank_markets("nope", catalog) == []
