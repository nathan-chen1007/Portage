"""Icewine: the second curated goods product (verified JP, GB, DE, KR; US banned; CN, AU, MX badged)."""

from pathlib import Path

import pytest

from app.engine.scoring import load_catalog, middlemen_for, rank_markets
from app.models import BusinessProfile, GroupQuoteRequest
from app.services import documents, group_quote, llm

DATA = Path(__file__).resolve().parent.parent / "data"
CAVEAT = "HS 2204.21 covers all bottled wine; market size is the wine market, not icewine specifically."


@pytest.fixture(scope="module")
def catalog():
    return load_catalog(DATA)


def test_icewine_rows_are_sourced_and_badged(catalog):
    cat = catalog.categories["icewine"]
    assert cat.kind == "goods" and cat.hs_code == "2204.21"
    rows = {m.country_code: m for m in catalog.markets if m.category == "icewine"}
    assert set(rows) == {"GB", "JP", "AU", "DE", "CN", "KR", "US", "MX"}
    for cc in ("JP", "GB", "DE", "KR"):
        assert rows[cc].compliance_confidence == "verified" and rows[cc].compliance_requirements
        assert all(r.source.startswith("https://") for r in rows[cc].compliance_requirements)
        assert rows[cc].tariff_rate == 0.0 and rows[cc].trade_agreement
    for cc in ("CN", "AU", "MX"):
        assert rows[cc].compliance_confidence == "unknown"
        assert all(r.confidence == "unknown" for r in rows[cc].compliance_requirements)
        assert sum(r.tier for r in rows[cc].compliance_requirements) >= 5  # never artificially easy
    assert rows["CN"].tariff_rate == pytest.approx(0.14)
    for m in rows.values():
        assert m.sources and CAVEAT in m.notes


def test_us_is_blocked_by_the_import_ban(catalog):
    us = next(m for m in rank_markets("icewine", catalog) if m.country_code == "US")
    assert us.status == "blocked" and us.score is None and us.rank == 8
    assert "September 29, 2026" in us.status_note and "Proclamation 11061" in us.status_note
    assert "federalregister.gov" in us.entry.sources[0]


def test_icewine_ranking_uses_every_open_market(catalog):
    ranked = rank_markets("icewine", catalog)
    open_ = [m for m in ranked if m.status == "open"]
    assert len(open_) == 7 and all(m.opportunity is not None and m.overall is not None for m in open_)
    by = {m.country_code: m for m in ranked}
    # GB and JP report no import weights: price is unavailable (None), not zero.
    assert by["GB"].opportunity_components["price"] is None and by["JP"].opportunity_components["price"] is None
    assert by["KR"].opportunity_components["price"] is not None
    assert CAVEAT in by["GB"].opportunity_facts.note
    # Unverified markets (placeholder compliance) never rank on easier compliance than a verified one.
    verified_worst = max(by[c].components["compliance"] for c in ("JP", "GB", "DE", "KR"))
    assert all(by[c].components["compliance"] >= verified_worst for c in ("CN", "AU", "MX"))


def test_icewine_partners_are_real_and_sourced(catalog):
    for cc, n in (("JP", 2), ("GB", 3), ("DE", 1)):
        specific = [m for m in middlemen_for(catalog, "icewine", cc) if m.country_code == cc]
        assert len(specific) == n and all(m.source.startswith("https://") for m in specific)
    kr = middlemen_for(catalog, "icewine", "KR")
    assert [m.id for m in kr] == ["winegrowers-canada", "tcs"]  # no invented Korean importer


def test_icewine_paperwork(catalog):
    cat = catalog.categories["icewine"]
    p = BusinessProfile(category="icewine", company_name="Niagara Frost Estate", city="Niagara-on-the-Lake", province="ON",
                        contact_name="Sam Lee", contact_email="sam@example.ca", product_name="Vidal icewine")
    for cc, title in (("JP", "CPTPP certification of origin"), ("GB", "CUKTCA origin declaration"),
                      ("DE", "CETA origin declaration"), ("KR", "CKFTA certificate of origin (BSF760 fields)")):
        docs = documents.drafts_for(p, cat, catalog.market("icewine", cc))
        assert [d.id for d in docs] == ["origin", "checklist"] and docs[0].title == title
        assert "HS 2204.21" in docs[0].body
    jp = documents.drafts_for(p, cat, catalog.market("icewine", "JP"))[0]
    assert "wholly obtained in Canada (icewine made only from grapes grown in Canada)" in jp.body
    kr = documents.drafts_for(p, cat, catalog.market("icewine", "KR"))[0]
    assert "Preference criterion: A" in kr.body


def test_icewine_outreach_and_group_quote(catalog):
    entry = catalog.market("icewine", "JP")
    mm = middlemen_for(catalog, "icewine", "JP")[0]
    p = BusinessProfile(category="icewine")
    draft = llm.fallback_outreach(p, entry, mm)
    assert "icewine" in draft.body.lower() and "honey" not in draft.body.lower()
    q = group_quote.draft(GroupQuoteRequest(country_code="JP", producers=5, combined_kg=3000, provinces=["ON", "BC"],
                                            category="icewine"), entry)
    assert "icewine (HS 2204.21)" in q.subject and "honey" not in (q.subject + q.body).lower()


def test_offline_profile_finds_icewine(catalog):
    prof = llm.fallback_profile("We make Vidal icewine in Niagara-on-the-Lake", list(catalog.categories.values()))
    assert prof.category == "icewine"
