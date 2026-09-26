"""Honey and B2B SaaS outputs must be byte-for-byte what they were at tag `pre-promotion`.

The any-product mode (labs B and C) now runs in the main app; this test proves it never touches the curated
demo paths. The snapshot was generated at `pre-promotion` by tests/curated_snapshot.py.
"""

import json

import pytest
from fastapi.testclient import TestClient

from tests.curated_snapshot import DOC_CASES, RANK_CASES, SNAPSHOT, build, normalize, rank_case_key

EXPECTED = json.loads(SNAPSHOT.read_text(encoding="utf-8"))


def test_engine_outputs_identical_to_pre_promotion():
    assert build() == EXPECTED


@pytest.fixture(scope="module")
def client():
    mp = pytest.MonkeyPatch()
    for k in ["LLM_API_KEY", "DEEPSEEK_API_KEY", "ELEVENLABS_API_KEY"]:
        mp.setenv(k, "")
    from app import main
    main.llm._client = None
    yield TestClient(main.app)
    mp.undo()


@pytest.mark.parametrize("category", ["honey", "b2b_saas"])
def test_api_rank_identical_to_pre_promotion(client, category):
    for case in RANK_CASES:
        r = client.post("/api/rank", json={"category": category, **case})
        assert r.status_code == 200
        assert normalize(r.json()) == EXPECTED["rank"][rank_case_key(category, case)], case


def test_api_documents_identical_to_pre_promotion(client):
    for category, profile, cc in DOC_CASES:
        r = client.post("/api/documents", json={"profile": profile.model_dump(), "country_code": cc})
        assert r.status_code == 200
        assert normalize(r.json()) == EXPECTED["documents"][f"{category}|{cc}"], (category, cc)


@pytest.mark.parametrize("category,description", [
    ("honey", "We're Prairie Gold Apiaries near Leduc, Alberta. We sell raw clover honey in jars and drums."),
    ("b2b_saas", "We sell B2B scheduling software (SaaS) to dental clinics; it stores patient data."),
])
def test_analyze_curated_paths_unchanged(client, category, description):
    """Offline analyze of a curated product still returns the curated ranking, with no lookup block."""
    body = client.post("/api/analyze", json={"description": description}).json()
    assert body["category"]["id"] == category
    assert normalize(body["markets"]) == EXPECTED["rank"][rank_case_key(category, RANK_CASES[0])]
    assert body.get("lookup") is None
