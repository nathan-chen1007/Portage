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
    assert codes[0] == "JP" and codes[-1] == "MX"
    assert body["markets"][-1]["status"] == "blocked" and body["markets"][-1]["score"] is None


def test_analyze_unsupported(client):
    body = client.post("/api/analyze", json={"description": "We make hand-poured soy candles"}).json()
    assert body["category"] is None and body["markets"] == []


def test_rank_with_weights_and_errors(client):
    r = client.post("/api/rank", json={"category": "b2b_saas", "weights": {"tariff": 0, "compliance": 1, "customs": 0, "tax": 0}})
    assert r.status_code == 200 and r.json()[-1]["country_code"] == "CN"
    assert client.post("/api/rank", json={"category": "nope"}).status_code == 422
    zero = {"tariff": 0, "compliance": 0, "customs": 0, "tax": 0}
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
