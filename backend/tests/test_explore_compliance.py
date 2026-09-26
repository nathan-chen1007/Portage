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
    ("A13", 2), ("A19", 2), ("A851", 1), ("A64", 1), ("B49", 1),
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


def test_feed_organic_and_gmo_measures_become_notes():
    rows = [dict(_row("A14", "approval to import any living modified organism", reg="LMO Act"), hsChapters=24),
            dict(_row("A15", "Compulsory registration of all feed business operators"), hsChapters=9),
            dict(_row("A83", "must be certified by an organic certification body"), hsChapters=19),
            dict(_row("A21", "contaminant limits incl. inorganic arsenic"), hsChapters=21)]
    reqs, _ = build.trains_requirements(rows, "https://x")
    assert [r["step"] for r in reqs] == ["residues"]
    notes = " ".join(build.conditional_notes(rows))
    assert "animal feed" in notes and "organic" in notes and "GMO" in notes


def test_no_scope_and_overridden_measures_become_notes():
    rows = [dict(_row("B14", "customs permission", "World", "Customs Act"), hsChapters=0),
            dict(_row("A13", "biosecurity", "Canada, United States", "Biosecurity Determination"), hsChapters=0),
            dict(_row("A14", "import certificate may be required"), hsChapters=33),
            dict(_row("A31", "labels"), hsChapters=21)]
    override = {"A14": {"ntmCode": "A14", "reason": "TARIC lists no licence", "source": "https://taric"}}
    reqs, blocked = build.trains_requirements(rows, "https://x", override)
    assert [r["step"] for r in reqs] == ["labelling"] and blocked is None
    notes = " ".join(build.trains_notes(rows, override))
    assert "no product scope" in notes and "names Canada" in notes and "TARIC lists no licence" in notes


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


# ---------- LIVE: UK Trade Tariff API (any HS6) ----------
# The network is never used in tests: _get_json is replaced by a fake that serves JSON:API documents shaped like the
# real API's (types, relationships and attribute names as returned by /api/v2/headings, /commodities and
# /rules_of_origin_schemes).

from app.explore.compliance import live_uk  # noqa: E402

API = live_uk.API


@pytest.fixture(autouse=True)
def offline_uk(tmp_path, monkeypatch):
    """Every test starts offline with an empty cache; tests that need responses install their own fake."""
    monkeypatch.setattr(live_uk, "CACHE_DIR", tmp_path / "live")

    def no_network(url, timeout):
        raise OSError("network disabled in tests")

    monkeypatch.setattr(live_uk, "_get_json", no_network)


def _heading(hs4, leaves):
    return {"data": {"attributes": {"goods_nomenclature_item_id": hs4 + "000000", "declarable": False}},
            "included": [{"type": "commodity", "id": str(i),
                          "attributes": {"goods_nomenclature_item_id": code, "leaf": leaf}}
                         for i, (code, leaf) in enumerate(leaves)]}


def _commodity(measures, groups=None):
    """measures: dicts with id, type_id, series, desc, geo, conds=[(class, code, text)], excluded=[], duty."""
    inc, ids = [], []
    for m in measures:
        ids.append({"id": m["id"], "type": "measure"})
        cond_ids = []
        for n, (cls, code, text) in enumerate(m.get("conds", [])):
            cid = f"{m['id']}-{n}"
            cond_ids.append({"id": cid, "type": "measure_condition"})
            inc.append({"type": "measure_condition", "id": cid,
                        "attributes": {"measure_condition_class": cls, "document_code": code, "requirement": text}})
        inc.append({"type": "measure_type", "id": m["type_id"],
                    "attributes": {"description": m["desc"], "measure_type_series_id": m["series"]}})
        rel = {"measure_type": {"data": {"id": m["type_id"], "type": "measure_type"}},
               "geographical_area": {"data": {"id": m["geo"], "type": "geographical_area"}},
               "excluded_countries": {"data": [{"id": c, "type": "geographical_area"} for c in m.get("excluded", [])]},
               "measure_conditions": {"data": cond_ids}}
        if "duty" in m:
            inc.append({"type": "duty_expression", "id": f"{m['id']}-d", "attributes": {"base": m["duty"]}})
            rel["duty_expression"] = {"data": {"id": f"{m['id']}-d", "type": "duty_expression"}}
        inc.append({"type": "measure", "id": m["id"], "relationships": rel})
    for gid, kids in (groups or {}).items():
        inc.append({"type": "geographical_area", "id": gid, "relationships": {
            "children_geographical_areas": {"data": [{"id": k, "type": "geographical_area"} for k in kids]}}})
    return {"data": {"relationships": {"import_measures": {"data": ids}}}, "included": inc}


MFN = {"id": "m1", "type_id": "103", "series": "C", "desc": "Third country duty", "geo": "1011", "duty": "2.00 %"}
PREF_CA = {"id": "m2", "type_id": "142", "series": "C", "desc": "Tariff preference", "geo": "CA", "duty": "0.00 %"}
FUR = {"id": "m3", "type_id": "745", "series": "B", "desc": "Import control on cat and dog fur", "geo": "1011",
       "conds": [("exemption", "Y922", "Other than cats and dogs fur"), ("negative", "", None)]}
ORGANIC = {"id": "m4", "type_id": "750", "series": "B", "desc": "Import control of organic products", "geo": "1011",
           "conds": [("document", "C644", 'Certificate of inspection, <a href="https://x">Reg 834/2007</a>'),
                     ("exemption", "Y929", "Goods not covered by organic rules"), ("negative", "", None)]}
ROO = {"data": [{"attributes": {"title": "UK-Canada Trade Continuity Agreement"}}],
       "included": [{"type": "rules_of_origin_proof", "attributes": {"summary": "Origin declaration"}}]}


def _serve(responses, calls=None):
    def fake(url, timeout):
        if calls is not None:
            calls.append(url)
        if url not in responses:
            raise OSError(f"404 {url}")
        return responses[url]
    return fake


HOCKEY = {  # 950699: two declarable codes; hockey sticks are 9506999000
    f"{API}/headings/9506": _heading("9506", [("9506990000", False), ("9506991000", True), ("9506999000", True),
                                               ("9506910000", True)]),
    f"{API}/commodities/9506991000": _commodity([MFN, PREF_CA, FUR]),
    f"{API}/commodities/9506999000": _commodity([MFN, PREF_CA, FUR]),
    f"{API}/rules_of_origin_schemes/950699/CA": ROO,
}
MAPLE = {
    f"{API}/headings/1702": _heading("1702", [("1702201090", True), ("1702209090", True), ("1702300000", False)]),
    f"{API}/commodities/1702201090": _commodity([dict(MFN, duty="8.00 %"), PREF_CA, ORGANIC]),
    f"{API}/commodities/1702209090": _commodity([dict(MFN, duty="8.00 %"), PREF_CA, ORGANIC]),
    f"{API}/rules_of_origin_schemes/170220/CA": ROO,
}


def test_live_uk_hockey_sticks(monkeypatch):
    monkeypatch.setattr(live_uk, "_get_json", _serve(HOCKEY))
    res = live_uk.uk_requirements("950699")
    assert res.commodities == ["9506991000", "9506999000"]           # only declarable codes under 950699
    assert res.duties["9506999000"] == {"mfn": "2.00 %", "canada": "0.00 %"} and not res.blocked
    assert "9506999000: 0.00 % with the Canada preference, 2.00 % third-country duty" in live_uk.tariff_note(res)
    by = {r.name: r for r in res.requirements}
    fur = by["Import control on cat and dog fur (UK Trade Tariff)"]
    assert fur.tier == 1 and "Y922" in fur.detail and fur.source == f"{API}/commodities/9506991000"
    origin = by["Proof of origin to claim the preferential tariff (UK Trade Tariff)"]
    assert origin.tier == 1 and "Origin declaration" in origin.detail
    assert all(r.confidence == "auto_sourced" and r.source.startswith("https://") for r in res.requirements)
    assert all(r.source in res.sources for r in res.requirements)


def test_canada_own_preference_beats_a_group_one():
    cptpp = {"id": "g1", "type_id": "142", "series": "C", "desc": "Tariff preference", "geo": "2051", "duty": "4.80 %"}
    doc = _commodity([dict(MFN, duty="8.00 %"), cptpp, PREF_CA], groups={"2051": ["AU", "CA"]})
    assert live_uk.duties(doc) == ("8.00 %", "0.00 %")
    assert live_uk.duties(_commodity([dict(MFN, duty="8.00 %"), cptpp], groups={"2051": ["CA"]})) == ("8.00 %", "4.80 %")


def test_live_uk_maple_syrup_organic_is_conditional(monkeypatch):
    monkeypatch.setattr(live_uk, "_get_json", _serve(MAPLE))
    res = live_uk.uk_requirements("170220")
    org = next(r for r in res.requirements if r.name.startswith("Import control of organic products"))
    assert org.tier == 1 and "C644" in org.detail and "Y929" in org.detail and "Only if" in org.detail
    assert "<a" not in org.detail and "Reg 834/2007" in org.detail
    assert res.duties["1702209090"]["mfn"] == "8.00 %"


def test_live_uk_tiers_and_who_it_applies_to(monkeypatch):
    cert = {"id": "c1", "type_id": "760", "series": "B", "desc": "Health and sanitary control", "geo": "2051",
            "conds": [("document", "N853", "Common Health Entry Document")]}
    licence = {"id": "c2", "type_id": "761", "series": "B", "desc": "Import control", "geo": "1011",
               "conds": [("document", "L100", "Import licence")]}
    other_country = {"id": "c3", "type_id": "465", "series": "B", "desc": "Restriction on entry", "geo": "IQ"}
    ca_excluded = {"id": "c4", "type_id": "762", "series": "B", "desc": "Surveillance", "geo": "1011",
                   "excluded": ["CA"], "conds": [("document", "X1", "x")]}
    doc = _commodity([cert, licence, other_country, ca_excluded], groups={"2051": ["AU", "CA", "JP"]})
    reqs, blocked, _ = live_uk.measures_to_requirements(doc, "https://example")
    tiers = {r["key"]: r["tier"] for r in reqs}
    assert tiers == {"Health and sanitary control": 2, "Import control": 3} and not blocked


def test_live_uk_prohibition_blocks():
    ban = {"id": "p1", "type_id": "277", "series": "A", "desc": "Import prohibition", "geo": "CA"}
    reqs, blocked, note = live_uk.measures_to_requirements(_commodity([ban]), "https://example")
    assert blocked and reqs[0]["tier"] == 3 and "Import prohibition" in note


def test_live_uk_is_cached(monkeypatch):
    calls = []
    monkeypatch.setattr(live_uk, "_get_json", _serve(HOCKEY, calls))
    live_uk.uk_requirements("950699")
    n = len(calls)
    again = live_uk.uk_requirements("950699")
    assert len(calls) == n and again.from_cache and again.requirements
    assert (live_uk.CACHE_DIR / "uk_950699.json").exists()


def test_live_uk_failure_is_unknown_not_an_error():
    assert live_uk.uk_requirements("950699") is None                    # offline, no cache
    assert service.auto_requirements("950699", "GB") == []
    assert not service.has_auto_data("950699", "GB")


def test_live_uk_stale_cache_beats_nothing(monkeypatch):
    monkeypatch.setattr(live_uk, "_get_json", _serve(HOCKEY))
    live_uk.uk_requirements("950699")
    monkeypatch.setattr(live_uk, "CACHE_TTL_S", -1)                     # everything is stale
    monkeypatch.setattr(live_uk, "_get_json", _serve({}))               # and the API is down
    res = live_uk.uk_requirements("950699")
    assert res is not None and res.from_cache


def test_live_uk_timeout_budget(monkeypatch):
    import time as _t

    def slow(url, timeout):
        _t.sleep(0.05)
        return HOCKEY[url]
    monkeypatch.setattr(live_uk, "TIMEOUT_S", 0.1)
    monkeypatch.setattr(live_uk, "_get_json", slow)
    assert live_uk.uk_requirements("950699") is None


def test_gb_goes_live_for_any_product_and_other_markets_do_not(monkeypatch):
    calls = []
    monkeypatch.setattr(live_uk, "_get_json", _serve(HOCKEY, calls))
    reqs = service.auto_requirements("9506.99", "gb")
    assert reqs and all(r.confidence == "auto_sourced" for r in reqs)
    n = len(calls)
    assert service.auto_requirements("950699", "DE") == [] and len(calls) == n   # no live source for the EU


def test_gb_falls_back_to_the_saved_row_when_live_fails():
    saved = service.auto_market("170220", "GB").compliance_requirements
    assert [r.name for r in service.auto_requirements("170220", "GB")] == [r.name for r in saved]


def test_market_route_live_gb(client, monkeypatch):
    monkeypatch.setattr(live_uk, "_get_json", _serve(HOCKEY))
    body = client.get("/api/explore/compliance/950699/GB").json()
    assert body["method"] == "live" and body["confidence"] == "auto_sourced" and body["status"] == "open"
    assert body["requirements"] and "0.00 %" in body["tariff_note"] and body["fetched_at"]
    body = client.get("/api/explore/compliance/950699/GB").json()
    assert body["method"] == "live_cached"


def test_market_route_live_gb_down_is_unknown_not_500(client):
    r = client.get("/api/explore/compliance/950699/GB")
    assert r.status_code == 200 and r.json()["confidence"] == "unknown"


@pytest.mark.parametrize("hs6,expect", [("950699", "cat and dog fur"), ("170220", "organic products")])
def test_committed_live_snapshots_from_the_real_api(hs6, expect):
    """data/auto/live/uk_<hs6>.json were written by the live lookup against the real UK Trade Tariff API
    (Sep 26, 2026, from the backend on Nathan's laptop). They double as the offline fallback for the demo."""
    path = live_uk.Path(__file__).resolve().parent.parent / "data" / "auto" / "live" / f"uk_{hs6}.json"
    res = live_uk.LiveResult.model_validate_json(path.read_text(encoding="utf-8"))
    assert res.hs6 == hs6 and res.commodities and all(c.startswith(hs6) for c in res.commodities)
    assert any(expect in r.name for r in res.requirements)
    assert all(r.confidence == "auto_sourced" and r.source in res.sources for r in res.requirements)
    assert all(s.startswith("https://www.trade-tariff.service.gov.uk/api/v2/") for s in res.sources)
    assert all(d["canada"] == "0.00 %" for d in res.duties.values())        # CUKTCA: duty-free for both
