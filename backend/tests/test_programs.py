"""'Help you may qualify for': programs panel data. No network, no LLM."""

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.programs import router, service
from tests.curated_snapshot import build as curated_build

MARKETS = ["GB", "JP", "AU", "DE", "FR", "NL", "IT", "CN", "KR", "US", "MX"]


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def by_id(resp):
    return {p.id: p for p in resp.programs}


def test_every_program_is_sourced_and_dated():
    d = json.loads(service.DATA.read_text(encoding="utf-8"))
    assert d["as_of"] == "2026-09-26" and set(d["tcs"]["countries"]) == set(MARKETS)
    for cc in MARKETS:
        r = service.programs_for(cc, "honey")
        for p in r.programs:
            assert p.url.startswith("https://") and p.sources and all(s.startswith("https://") for s in p.sources)
            assert p.as_of == "2026-09-26" and p.status_label in ("May qualify", "Likely not eligible", "Check eligibility")
        assert "canada-" in by_id(r)["tcs"].url and r.label == "May qualify: confirm with the program"


def test_agri_food_products_go_to_agrimarketing_not_canexport():
    for cat in ("honey", "icewine"):
        p = by_id(service.programs_for("JP", cat, "300k_plus", "3_plus"))
        assert p["canexport"].status == "likely_not" and "AgriMarketing" in p["canexport"].reason
        assert p["agrimarketing"].status == "may_qualify" and "500" in p["agrimarketing"].reason
        assert p["tcs"].status == "may_qualify" and p["edc"].status == "may_qualify"
    assert service.agri_food("honey") and service.agri_food("icewine") and service.agri_food("b2b_saas") is False


def test_saas_canexport_verdict_follows_the_size_rule_and_skips_agrimarketing():
    unsure = by_id(service.programs_for("DE", "b2b_saas"))
    assert "agrimarketing" not in unsure
    assert unsure["canexport"].status == "check" and "$300,000" in unsure["canexport"].reason
    assert by_id(service.programs_for("DE", "b2b_saas", "300k_plus", "3_plus"))["canexport"].status == "may_qualify"
    small = by_id(service.programs_for("DE", "b2b_saas", "under_300k", "3_plus"))["canexport"]
    assert small.status == "likely_not" and "under $300,000" in small.reason
    few = by_id(service.programs_for("DE", "b2b_saas", "300k_plus", "1_2"))["canexport"]
    assert few.status == "likely_not" and "fewer than 3" in few.reason
    assert "closed on August 31, 2026" in few.note  # honest: this year's intake is over


def test_any_product_uses_the_hs_chapter():
    assert service.agri_food("hs170220") is True    # maple syrup, chapter 17
    assert service.agri_food("hs950699") is False   # hockey sticks, chapter 95
    assert service.agri_food("nonsense") is None
    unknown = by_id(service.programs_for("GB", None))
    assert unknown["agrimarketing"].status == "check" and unknown["canexport"].status == "check"


def test_route(client):
    r = client.get("/api/programs", params={"country_code": "jp", "category": "honey"})
    assert r.status_code == 200
    body = r.json()
    assert body["country"] == "Japan" and [p["id"] for p in body["programs"]] == ["tcs", "canexport", "agrimarketing", "edc"]
    assert body["programs"][0]["url"].endswith("canada-japan-export.html")
    assert client.get("/api/programs", params={"country_code": "JP", "revenue": "lots"}).status_code == 422
    assert client.get("/api/programs").status_code == 422


def test_no_effect_on_curated_outputs(client):
    before = curated_build()
    client.get("/api/programs", params={"country_code": "JP", "category": "honey"})
    assert curated_build() == before
