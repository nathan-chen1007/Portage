"""The any-product path in the MAIN app: /api/analyze for a product that isn't honey or B2B SaaS.

Runs with the network blocked: every live source must degrade to the committed cache, then to "unknown",
never to a 500. Hockey sticks (950699) and maple syrup (170220) have committed snapshots for the demo.
"""

import pytest
from fastapi.testclient import TestClient

from app.explore.compliance import live_uk
from app.explore.lookup import sources

CONF = {"verified", "auto_sourced", "unknown"}


def _offline(*a, **k):
    raise ConnectionError("network blocked in tests")


@pytest.fixture
def client(monkeypatch):
    for k in ["LLM_API_KEY", "DEEPSEEK_API_KEY", "ELEVENLABS_API_KEY"]:
        monkeypatch.setenv(k, "")
    monkeypatch.setattr(sources, "http_get_json", _offline)
    monkeypatch.setattr(live_uk, "_get_json", _offline)
    from app import main
    main.llm._client = None
    return TestClient(main.app)


def test_hockey_sticks_get_the_any_product_ranking_offline(client):
    r = client.post("/api/analyze", json={"description": "I make hockey sticks in Quebec"})
    assert r.status_code == 200
    body = r.json()
    lk = body["lookup"]
    assert lk is not None and lk["product"]["hs6"] == "950699" and lk["classify_mode"] == "offline"
    assert lk["candidates"][0]["hs6"] == "950699" and len(lk["candidates"]) >= 2  # the founder can switch
    assert body["category"]["id"] == "hs950699" and body["category"]["kind"] == "goods"
    assert body["profile"]["category"] == "hs950699"
    assert len(body["markets"]) == 8
    for m in body["markets"]:
        assert m["entry"]["compliance_confidence"] in CONF
        for q in m["entry"]["compliance_requirements"]:
            assert q["confidence"] in CONF
    gb = next(m for m in body["markets"] if m["country_code"] == "GB")
    assert gb["entry"]["compliance_confidence"] == "auto_sourced"  # UK live snapshot (committed), not re-fetched
    # An unverified market never looks artificially easy: it carries an assumed burden, not zero.
    for m in body["markets"]:
        if m["entry"]["compliance_confidence"] == "unknown" and m["score"] is not None:
            assert m["components"]["compliance"] > 0.3


def test_switching_the_hs_code_reranks(client):
    r = client.post("/api/explore/lookup/rank", json={"hs6": "170220", "description": "maple syrup", "classified_by": "user"})
    assert r.status_code == 200
    body = r.json()
    assert body["product"]["hs6"] == "170220" and len(body["markets"]) == 8


def test_services_and_nonsense_stay_unsupported(client, monkeypatch):
    from app.explore.lookup import classify

    monkeypatch.setattr(classify, "_llm_candidates", lambda d, s: [])  # the AI says: not a physical good
    body = client.post("/api/analyze", json={"description": "We offer management consulting to banks"}).json()
    assert body["category"] is None and body["markets"] == [] and body["lookup"] is None


def test_curated_hs_code_goes_to_the_verified_path(client, monkeypatch):
    """If the classifier lands on honey's HS code, the verified honey ranking is used, not the lookup."""
    from app.explore.lookup import classify
    from app.services import llm

    monkeypatch.setattr(llm, "fallback_profile", lambda d, c: llm.BusinessProfile(category="unsupported"))
    monkeypatch.setattr(classify, "_llm_candidates", lambda d, s: [{"hs6": "040900", "reason": "honey"}])
    body = client.post("/api/analyze", json={"description": "We sell creamed wildflower products from our hives"}).json()
    assert body["category"]["id"] == "honey" and body["lookup"] is None
