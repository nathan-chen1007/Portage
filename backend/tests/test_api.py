"""End-to-end API checks in offline mode (no LLM or ElevenLabs calls).  python -m pytest -q"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    mp = pytest.MonkeyPatch()
    for k in ["LLM_API_KEY", "DEEPSEEK_API_KEY", "ELEVENLABS_API_KEY"]:
        mp.setenv(k, "")  # load_dotenv() won't override an existing variable, so this wins over .env
    from app import main
    main.llm._client = None
    yield TestClient(main.app)
    mp.undo()


HONEY_DESC = ("We're Prairie Gold Apiaries, a family beekeeping operation near Leduc, Alberta. "
              "We sell raw clover honey in 500 g jars. Contact: jen@prairiegold.ca")


def test_health_and_categories(client):
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["markets"] == 16 and h["llm"] is False
    assert {c["id"] for c in client.get("/api/categories").json()} == {"honey", "b2b_saas"}


def test_analyze_honey_offline(client):
    r = client.post("/api/analyze", json={"description": HONEY_DESC})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "offline" and body["category"]["id"] == "honey"
    codes = [m["country_code"] for m in body["markets"]]
    assert codes[0] == "JP" and codes[-1] == "MX" and body["opportunity_available"] is True
    top = body["markets"][0]
    assert set(top["components"]) == {"tariff", "compliance", "logistics", "risk", "tax"}
    assert top["country_facts"]["currency"] and "lead_time" in top["factors"]
    assert top["overall"] > 0 and top["opportunity"] > 0 and top["opportunity_facts"]["canada_share"] > 0.1
    assert body["markets"][-1]["status"] == "blocked" and body["markets"][-1]["score"] is None


def test_analyze_other_goods_go_to_the_any_product_lookup(client):
    """Candles aren't a curated product: since the promotion they get the HS lookup ranking, not 'unsupported'."""
    r = client.post("/api/analyze", json={"description": "We make hand-poured soy candles"})
    assert r.status_code == 200
    body = r.json()
    assert body["lookup"]["product"]["hs6"] == "340600" and body["category"]["id"] == "hs340600"
    assert all(m["entry"]["compliance_confidence"] in {"verified", "auto_sourced", "unknown"} for m in body["markets"])


def test_rank_with_weights_and_errors(client):
    r = client.post("/api/rank", json={"category": "b2b_saas", "weights": {"tariff": 0, "compliance": 1, "logistics": 0, "risk": 0, "tax": 0}})
    assert r.status_code == 200 and r.json()[-1]["country_code"] == "CN"
    assert client.post("/api/rank", json={"category": "nope"}).status_code == 422
    fr = client.post("/api/rank", json={"category": "honey", "sort_by": "friction"}).json()
    assert fr[0]["country_code"] == "GB"
    assert client.post("/api/rank", json={"category": "honey", "prize_weight": 2}).status_code == 422
    zero = {"tariff": 0, "compliance": 0, "logistics": 0, "risk": 0, "tax": 0}
    assert client.post("/api/rank", json={"category": "honey", "weights": zero}).status_code == 422


def _profile(client):
    return client.post("/api/analyze", json={"description": HONEY_DESC}).json()["profile"]


def test_documents_and_pdf(client):
    p = _profile(client)
    docs = client.post("/api/documents", json={"profile": p, "country_code": "GB"}).json()
    assert [d["id"] for d in docs] == ["origin", "checklist"]
    pdf = client.post("/api/documents/origin/pdf", json={"profile": p, "country_code": "GB"})
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    blocked = client.post("/api/documents", json={"profile": p, "country_code": "MX"})
    assert blocked.status_code == 422


def test_outreach_offline(client):
    p = _profile(client)
    r = client.post("/api/outreach", json={"profile": p, "country_code": "JP", "middleman_id": "jp-mizutani"})
    assert r.status_code == 200 and "Mizutani" in r.json()["body"]
    assert client.post("/api/outreach", json={"profile": p, "country_code": "JP", "middleman_id": "nope"}).status_code == 404


def test_voice_without_key_is_a_clear_502(client):
    r = client.post("/api/voice", json={"text": "Hello", "language": "ja"})
    assert r.status_code == 502 and "ELEVENLABS_API_KEY" in r.json()["detail"]


def test_forwarders_and_group_quote(client):
    f = client.get("/api/forwarders", params={"market": "JP"}).json()
    assert len(f["forwarders"]) == 3 and f["route"] == "Vancouver → Japan"
    assert f["confirm_note"] == "Confirm the route (Vancouver → Japan) and food handling when you request a quote."
    q = client.post("/api/group-quote", json={"country_code": "JP", "producers": 6, "combined_kg": 15000, "provinces": ["AB", "SK"]})
    assert q.status_code == 200 and "HS 0409.00" in q.json()["body"]
    assert client.get("/api/forwarders", params={"market": "MX"}).status_code == 422
