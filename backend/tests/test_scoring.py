"""Run from backend/:  python -m pytest -q"""

from pathlib import Path

import pytest

from app.engine.scoring import (
    compliance_burden,
    country_risk,
    customs_complexity,
    distance_burden,
    fx_risk,
    lead_time_burden,
    lead_time_weeks,
    load_catalog,
    normalize_tariff,
    rank_markets,
    sailing_gap,
    score_market,
)
from app.models import MarketEntry, Requirement, Weights

DATA = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(scope="module")
def catalog():
    return load_catalog(DATA)


def req(tier, weeks=0, basis="estimate"):
    return Requirement(name="x", tier=tier, detail="x", source="https://example.com",
                       lead_time_weeks=weeks, lead_time_basis=basis)


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
    assert lead_time_burden(13) == 0.5 and lead_time_burden(52) == 1
    assert distance_burden(None) == 0 and distance_burden(5000) == 0.5 and distance_burden(20000) == 1
    assert sailing_gap(None) == 0 and sailing_gap(7) == 0 and sailing_gap(1) == 0.75
    assert fx_risk(0.05) == 0.5 and fx_risk(0.2) == 1
    assert country_risk(0) == 0 and country_risk(7) == 1


def test_lead_time_is_the_longest_step_not_the_sum():
    assert lead_time_weeks([]) == (0.0, False)
    assert lead_time_weeks([req(1, 2), req(2, 12), req(1, 3)]) == (12, True)
    assert lead_time_weeks([req(2, 1, "official"), req(1, 0)]) == (1, False)


def test_catalog_loads_and_every_row_is_sourced(catalog):
    assert set(catalog.categories) == {"honey", "b2b_saas"}
    assert len(catalog.markets) == 16
    assert set(catalog.countries) == {"GB", "JP", "AU", "DE", "CN", "KR", "US", "MX"}
    for c in catalog.countries.values():
        assert c.fx_source.startswith("https://") and c.country_risk_source.startswith("https://")
    for m in catalog.markets:
        assert m.sources
        if m.category == "honey" and m.status == "open" and m.sea_distance_nm:
            assert m.shipping_source.startswith("https://")
        for r in m.compliance_requirements:
            assert r.source.startswith("https://")


def test_breakdown_sums_to_score(catalog):
    for m in catalog.markets:
        s = score_market(m, None, catalog.countries[m.country_code])
        if s.status == "blocked":
            continue
        assert abs(sum(s.breakdown.values()) - s.score) < 0.05
        assert 0 <= s.score <= 100


def test_honey_ranking_story(catalog):
    ranked = rank_markets("honey", catalog)
    order = [r.country_code for r in ranked]
    # UK (paperwork only, short Atlantic lane) and Japan (already our #2 market, 0% under CPTPP) lead.
    assert set(order[:2]) == {"GB", "JP"}
    assert order.index("GB") < order.index("DE")
    # Australia: easy paperwork, but a month at sea makes logistics its biggest blocker.
    assert ranked[order.index("AU")].top_blocker == "logistics"
    # Germany's EU establishment listing means ~12 weeks before the first shipment.
    assert ranked[order.index("DE")].lead_time_weeks == 12
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
    assert all(r.components["tariff"] == 0 and r.components["logistics"] == 0 for r in ranked)
    assert ranked[-1].lead_time_weeks >= 17  # ICP licence


def test_blocked_stays_last_under_any_weights(catalog):
    for w in [Weights(tariff=1, compliance=0, customs=0, tax=0), Weights(tariff=0, compliance=1, customs=0, tax=0)]:
        assert rank_markets("honey", catalog, w)[-1].country_code == "MX"


def test_us_honey_last_open_market_whenever_tariffs_count(catalog):
    # Robustness claim in docs/SCORING.md: with any meaningful tariff weight, US stays behind the FTA markets.
    for t in [0.2, 0.35, 0.6]:
        order = [r.country_code for r in rank_markets("honey", catalog, Weights(tariff=t, compliance=0.3, logistics=0.15, risk=0.1, tax=0.1))]
        assert order.index("US") > order.index("DE")


def test_weights_are_normalized(catalog):
    m = catalog.markets[0]
    f = catalog.countries[m.country_code]
    assert score_market(m, Weights(tariff=3.5, compliance=3, logistics=1.5, risk=1, tax=1), f).score == score_market(m, None, f).score


def test_legacy_customs_weight_is_read_as_logistics():
    assert Weights.model_validate({"customs": 0.5}).logistics == 0.5


def test_blocked_entry_needs_a_reason():
    with pytest.raises(ValueError):
        MarketEntry(category="honey", country="X", country_code="XX", language="en", status="blocked",
                    tariff_rate=0, sources=["https://example.com"], as_of="2026-09-26")


def test_unknown_category_is_empty(catalog):
    assert rank_markets("nope", catalog) == []
