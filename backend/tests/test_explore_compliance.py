"""Lab B: auto-sourced compliance (maple syrup, HS 170220). See claude/afhacks-lab-B.md.

Runs without EXPERIMENTAL=1: it mounts the compliance router on its own app.
"""

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.explore.compliance import build, service
from app.explore.compliance.ntm import is_prohibition, step_for, targets_canada, tier_for
from app.models import MarketEntry, Requirement

MARKETS = {"GB", "JP", "AU", "DE", "CN", "KR", "US", "MX"}


@pytest.fixture(scope="module")
def client():
    from app.explore.compliance.routes import router

    app = FastAPI()
    app.include_router(router, prefix="/api/explore/compliance")
    return TestClient(app)


# ---------- NTM code -> tier mapping ----------

@pytest.mark.parametrize("code,tier", [
    ("A21", 1), ("A31", 1), ("B31", 1), ("A41", 1), ("A85", 1), ("B85", 1), ("C3", 1),
    ("A15", 2), ("A81", 2), ("A82", 2), ("A83", 2), ("B83", 2), ("A84", 2), ("C1", 2), ("A89", 2),
    ("A14", 3), ("E11", 3), ("E21", 3), ("A11", 3),
])
def test_tier_mapping(code, tier):
    assert tier_for(code) == tier


@pytest.mark.parametrize("code", ["F71", "P33", "P7", "D1", "H1", ""])
def test_non_compliance_chapters_are_skipped(code):
    assert step_for(code) is None


def test_unknown_code_in_compliance_chapter_is_conservative_tier_2():
    assert tier_for("A99") == 2 and tier_for("B999") == 2


def test_sps_and_tbt_labelling_are_one_step():
    assert step_for("A31").key == step_for("B31").key == step_for("B33").key == "labelling"
    assert step_for("A85").key == "traceability" and step_for("A83").key == "certification"


def test_prohibition_helpers():
    assert is_prohibition("A11") and is_prohibition("E31") and not is_prohibition("A14")
    assert targets_canada("Canada") and targets_canada("China, Canada") and not targets_canada("World")


# ---------- building from raw TRAINS rows ----------

def _row(code, desc="x", affected="World", reg=""):
    return {"ntmCode": code, "measureDescription": desc, "affectedCountriesNames": affected, "regulationTitle": reg}


def test_trains_rows_merge_by_step_and_keep_every_code():
    reqs, blocked = build.trains_requirements(
        [_row("A31", "SPS label"), _row("B31", "TBT label"), _row("B31", "TBT label"), _row("A83", "certificate"),
         _row("P33", "export thing"), _row("F71", "fee")], "https://trainsonline.unctad.org/x")
    by = {r["step"]: r for r in reqs}
    assert blocked is None and set(by) == {"labelling", "certification"}
    assert "A31" in by["labelling"]["name"] and "B31" in by["labelling"]["name"]
    assert by["labelling"]["detail"].count("TBT label") == 1
    assert by["certification"]["tier"] == 2


def test_horizontal_measures_are_dropped():
    rows = [dict(_row("B83", "consumer product safety certificate"), hsChapters=84), dict(_row("A31"), hsChapters=20)]
    reqs, _ = build.trains_requirements(rows, "https://x")
    assert [r["step"] for r in reqs] == ["labelling"]


def test_prohibition_blocks_only_when_it_names_canada():
    assert build.trains_requirements([_row("A11", "ban", "World")], "https://x")[1] is None
    assert build.trains_requirements([_row("A11", "ban on Canadian syrup", "Canada")], "https://x")[1]


def test_national_source_merges_into_matching_step():
    reqs = [{"step": "product_registration", "name": "Product registration (A81)", "tier": 2, "detail": "TRAINS",
             "source": "https://trains", "lead_time_weeks": 8}]
    out = build.merge_national(reqs, [
        {"step": "product_registration", "name": "FDA food facility registration", "tier": 2, "detail": "FDA says",
         "source": "https://fda", "lead_time_weeks": 1},
        {"step": "fsvp", "name": "FSVP", "tier": 1, "detail": "d", "source": "https://fda"},
    ])
    assert len(out) == 2
    assert out[0]["name"] == "FDA food facility registration" and out[0]["source"] == "https://fda"
    assert out[0]["lead_time_weeks"] == 8 and "TRAINS" in out[0]["detail"]


# ---------- the saved data file ----------

def test_saved_file_is_up_to_date_with_the_raw_inputs():
    """Regenerating from data/auto/raw/ must give exactly the committed file (nothing hand-edited)."""
    index_add, rows = build.build("maple_syrup")
    with (build.AUTO_DIR / "maple_syrup.json").open(encoding="utf-8") as f:
        assert json.load(f) == rows
    with (build.AUTO_DIR / "index.json").open(encoding="utf-8") as f:
        assert json.load(f)["170220"] == index_add["170220"]


def test_saved_rows_are_valid_and_fully_sourced():
    entries = service.auto_markets("170220")
    assert {e.country_code for e in entries} == MARKETS
    for e in entries:
        assert isinstance(e, MarketEntry) and e.category == "maple_syrup" and e.sources
        assert e.compliance_confidence in ("auto_sourced", "unknown")
        assert (e.compliance_confidence == "unknown") == (not e.compliance_requirements)
        for r in e.compliance_requirements:
            assert r.confidence == "auto_sourced" and r.lead_time_basis == "estimate"
            assert r.source.startswith("https://") and r.source in e.sources
        if e.status == "open":
            assert e.lpi_customs_score is not None and e.sea_distance_nm is not None


def test_maple_contrasts_with_honey():
    us = service.auto_market("170220", "US")
    assert us.status == "open" and us.tariff_rate == 0.0          # not on the Section 338 list
    assert service.auto_market("170220", "MX").status == "open"   # honey is blocked there, maple isn't
    assert service.auto_market("170220", "CN").tariff_rate == pytest.approx(0.30)


# ---------- the public function session C calls ----------

def test_auto_requirements_signature_and_hs_formats():
    for hs in ("170220", "1702.20", "1702.20.40"):
        reqs = service.auto_requirements(hs, "us")
        assert reqs and all(isinstance(r, Requirement) and r.confidence == "auto_sourced" for r in reqs)
    assert service.has_auto_data("170220", "JP")


def test_auto_requirements_unknown_is_empty():
    assert service.auto_requirements("040900", "JP") == []   # honey is curated, not auto-sourced
    assert service.auto_requirements("170220", "FR") == []
    assert service.auto_requirements("nonsense", "JP") == []
    assert not service.has_auto_data("170220", "FR")


def test_auto_requirements_returns_copies():
    service.auto_requirements("170220", "US")[0].name = "changed"
    assert service.auto_requirements("170220", "US")[0].name != "changed"


# ---------- routes ----------

def test_rank_route(client):
    r = client.get("/api/explore/compliance/170220/rank")
    assert r.status_code == 200
    body = r.json()
    assert [m["rank"] for m in body] == list(range(1, len(body) + 1))
    assert {m["country_code"] for m in body} == MARKETS
    open_ = [m for m in body if m["status"] == "open"]
    assert [m["score"] for m in open_] == sorted(m["score"] for m in open_)
    assert all(m["overall"] == pytest.approx(100 - m["score"]) for m in open_)
    assert all(m["entry"]["compliance_confidence"] in ("auto_sourced", "unknown") for m in body)


def test_rank_unknown_markets_are_not_artificially_easy(client):
    body = client.get("/api/explore/compliance/170220/rank").json()
    for m in body:
        if m["entry"]["compliance_confidence"] == "unknown" and m["status"] == "open":
            reqs = m["entry"]["compliance_requirements"]
            assert reqs and all(r["confidence"] == "unknown" for r in reqs)
            assert m["components"]["compliance"] > 0
    # the saved data itself is untouched
    assert all(r.confidence == "auto_sourced" for e in service.auto_markets("170220") for r in e.compliance_requirements)


def test_rank_route_unknown_product(client):
    assert client.get("/api/explore/compliance/999999/rank").status_code == 404


def test_market_route(client):
    body = client.get("/api/explore/compliance/1702.20/jp").json()
    assert body["hs6"] == "170220" and body["country_code"] == "JP"
    assert body["confidence"] in ("auto_sourced", "unknown") and body["market"]["country_code"] == "JP"


def test_market_route_unknown_routes_to_tcs(client):
    body = client.get("/api/explore/compliance/170220/FR").json()
    assert body["confidence"] == "unknown" and body["status"] == "unknown"
    assert "tradecommissioner" in body["sources"][0] and body["next_step"]


def test_list_products(client):
    body = client.get("/api/explore/compliance/").json()
    assert any(p["hs6"] == "170220" and p["label"] == "Maple syrup" for p in body)
