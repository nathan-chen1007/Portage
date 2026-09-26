"""More markets (lab session E): 8 extra markets as ranking-only. Every network call is mocked."""

from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.explore.lookup import markets as lookup_markets
from app.explore.lookup import sources
from app.explore.more_markets import fetch, router, service
from app.explore.more_markets.markets import CATEGORY_HS6, EXTRA_MARKETS, PREWARM_HS6
from app.explore.more_markets.schemas import NOT_VERIFIED
from tests.curated_snapshot import build as curated_build

ATTRS = ["TARIFFTYPE", "TOTALNOOFLINES", "NBR_NA_LINES"]


def wits_doc(year: int, percent: float, kind: str = "MFN") -> dict:
    """Minimal SDMX-JSON in WITS's shape: one observation [value, TARIFFTYPE idx, TOTALNOOFLINES idx, NA idx]."""
    values = {"TARIFFTYPE": [{"id": kind}], "TOTALNOOFLINES": [{"id": "1"}], "NBR_NA_LINES": [{"id": "0"}]}
    return {"dataSets": [{"series": {"0:0:0:0:0": {"observations": {"0": [percent, 0, 0, 0]}}}}],
            "structure": {"dimensions": {"observation": [{"values": [{"id": str(year)}]}]},
                          "attributes": {"observation": [{"id": a, "values": values[a]} for a in ATTRS]}}}


def wits_doc_specific(old_year: int, old_percent: float, na_year: int) -> dict:
    """An old percentage, then a year where every line is a specific duty with no estimate (NA lines == total)."""
    values = {"TARIFFTYPE": [{"id": "MFN"}], "TOTALNOOFLINES": [{"id": "1"}], "NBR_NA_LINES": [{"id": "0"}, {"id": "1"}]}
    return {"dataSets": [{"series": {"0:0:0:0:0": {"observations": {"0": [old_percent, 0, 0, 0], "1": [0, 0, 0, 1]}}}}],
            "structure": {"dimensions": {"observation": [{"values": [{"id": str(old_year)}, {"id": str(na_year)}]}]},
                          "attributes": {"observation": [{"id": a, "values": values[a]} for a in ATTRS]}}}


def comtrade_doc(rows: dict[int, tuple[float, float]]) -> dict:
    return {"data": [{"partnerCode": p, "primaryValue": v, "netWgt": kg} for p, (v, kg) in rows.items()], "error": ""}


class FakeNet:
    """WITS: EU MFN 17.3% with a 0% CETA preference; others MFN 5%, no preference. Comtrade: every market imports."""

    def __init__(self):
        self.calls = 0
        self.fail_wits: set[str] = set()
        self.down = False
        self.no_2024: set[str] = set()
        self.specific: set[str] = set()  # WITS reporters whose latest years are specific duties only   # Comtrade reporters that haven't reported 2024 yet

    def __call__(self, url, timeout=None):
        self.calls += 1
        if self.down:
            raise ConnectionError("network down")
        u = urlparse(url)
        if "wits.worldbank.org" in u.netloc:
            parts = u.path.split("/")
            reporter, partner = parts[parts.index("reporter") + 1], parts[parts.index("partner") + 1]
            if reporter in self.fail_wits:
                raise ConnectionError("WITS down")
            if reporter in self.specific:
                return wits_doc_specific(2014, 0.0, 2021) if partner == "000" else (_ for _ in ()).throw(sources.NoRecords("x"))
            if reporter == "918":
                return wits_doc(2023, 17.3) if partner == "000" else wits_doc(2021, 0.0, "PREF")
            if partner == "000":
                return wits_doc(2022, 5.0)
            raise sources.NoRecords("NoRecordsFound")
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if q["flowCode"] == "X":  # Canada's exports: $10/kg
            return comtrade_doc({0: (50e6, 5e6)})
        big = 1.0 if q["reporterCode"] in ("251", "528") else 0.1
        if q["period"] == "2024" and q["reporterCode"] in self.no_2024:
            return {"data": [], "error": ""}
        if q["period"] in ("2024", "2023"):
            return comtrade_doc({0: (200e6 * big, 20e6 * big), 124: (5e6 * big, 0.4e6 * big)})
        return comtrade_doc({0: (150e6 * big, 16e6 * big)})


@pytest.fixture
def net(monkeypatch, tmp_path):
    fake = FakeNet()
    monkeypatch.setattr(sources, "http_get_json", fake)
    monkeypatch.setattr(fetch, "CACHE_DIR", tmp_path / "more_markets")
    return fake


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def by_code(resp) -> dict:
    return {m.country_code: m for m in resp.markets}


def test_cache_miss_then_hit(net):
    first = service.more_markets("040900", timeout=10)
    assert {m.tariff.origin for m in first.markets} == {"live"}
    assert net.calls > 0 and service.cache_complete("040900")
    assert any(fetch.CACHE_DIR.glob("tariff-040900-918-mfn.json"))
    net.down = True  # a second request must not need the network
    calls = net.calls
    second = service.more_markets("040900", timeout=10)
    assert net.calls == calls
    assert {m.tariff.origin for m in second.markets} == {"cache"}
    assert [m.opportunity for m in second.markets] == [m.opportunity for m in first.markets]


def test_eu_preference_and_mfn_only(net):
    r = by_code(service.more_markets("040900", timeout=10))
    for cc in ("FR", "NL", "IT"):  # one EU call serves all three
        assert r[cc].tariff.applied == 0.0 and r[cc].tariff.mfn == pytest.approx(0.173)
        assert r[cc].tariff.agreement == "CETA" and r[cc].tariff.year == 2021
        assert "EU common external tariff" in r[cc].tariff.note
    assert r["VN"].tariff.status == "mfn_only" and r["VN"].tariff.applied == pytest.approx(0.05)
    assert r["VN"].tariff.agreement is None and "CPTPP" in r["VN"].tariff.note
    assert r["IN"].agreement_in_force is None and "may be lower" not in r["IN"].tariff.note
    assert all(s.startswith("https://") for m in r.values() for s in m.sources)


def test_latest_year_missing_falls_back_one_year(net):
    net.no_2024.add("704")  # Vietnam
    r = by_code(service.more_markets("040900", timeout=10))
    assert r["VN"].opportunity is not None and r["VN"].opportunity_facts.year == 2023
    assert "2023 figures are used" in r["VN"].opportunity_note
    assert any("period=2023" in s for s in r["VN"].sources)
    assert r["FR"].opportunity_facts.year == 2024


def test_old_percentage_superseded_by_specific_duty_is_unavailable(net):
    net.specific.add("784")  # UAE: 0% in 2014, specific duty only since 2021
    r = by_code(service.more_markets("040900", timeout=10))
    ae = r["AE"]
    assert ae.tariff.status == "unavailable" and ae.tariff.applied is None
    assert "since 2021" in ae.tariff.note and "0%, 2014" in ae.tariff.note
    assert ae.opportunity is None  # never scored off a stale "0%"
    assert r["FR"].tariff.status == "ok"


def test_never_eased_and_only_eu_markets_of_curated_products_verified(net):
    resp = service.more_markets("040900", timeout=10)
    assert [m.country_code for m in resp.markets] != [] and len(resp.markets) == 8
    for m in resp.markets:
        if m.country_code in ("FR", "NL", "IT"):  # honey is curated: EU rules, same as Germany
            assert m.compliance_confidence == "verified" and m.verified is True and m.badge == "Verified"
            assert m.compliance_note == "EU rules, same as Germany" and m.requirements
        else:
            assert m.compliance_confidence == "unknown" and m.verified is False and m.badge == NOT_VERIFIED
            assert m.requirements == []
        assert m.ease is None and m.overall is None and "No ease score" in m.ease_note
        assert 0 <= m.opportunity <= 100 and set(m.opportunity_components) == {"demand", "price", "growth", "foothold"}
    opps = [m.opportunity for m in resp.markets]
    assert opps == sorted(opps, reverse=True)
    assert "not a recommendation" in resp.scale_note


def test_market_without_import_weight_serializes(net, client, monkeypatch):
    real = net.__call__

    def no_weight(url, timeout=None):  # France reports value but no weight (as UN Comtrade does for 2024)
        doc = real(url, timeout)
        if "reporterCode=251" in url and "period=2024" in url:
            for row in doc["data"]:
                row["netWgt"] = 0
        return doc

    monkeypatch.setattr(sources, "http_get_json", no_weight)
    r = client.get("/api/more-markets", params={"category": "honey"})
    assert r.status_code == 200
    fr = next(m for m in r.json()["markets"] if m["country_code"] == "FR")
    assert fr["opportunity"] is not None and fr["opportunity_components"]["price"] is None
    assert "no price per kg" in fr["opportunity_note"]


def test_degraded_market(net, client):
    net.fail_wits.add("356")  # India's tariff source fails
    body = client.get("/api/more-markets", params={"category": "honey"}).json()
    rows = {m["country_code"]: m for m in body["markets"]}
    assert len(rows) == 8
    assert rows["IN"]["tariff"]["status"] == "unavailable" and rows["IN"]["tariff"]["note"].startswith("Tariff unavailable")
    assert rows["IN"]["opportunity"] is None and rows["IN"]["opportunity_status"] == "unavailable"
    assert body["markets"][-1]["country_code"] == "IN"  # unscored markets go last
    assert rows["FR"]["tariff"]["status"] == "ok" and rows["FR"]["opportunity"] is not None
    assert not any(fetch.CACHE_DIR.glob("tariff-040900-356-*.json"))  # errors are never cached


def test_everything_down_still_answers(net, client):
    net.down = True
    r = client.get("/api/more-markets", params={"hs6": "0409.00"})
    assert r.status_code == 200
    assert {m["tariff"]["status"] for m in r.json()["markets"]} <= {"unavailable", "pending"}


def test_one_market_crash_degrades_only_that_market(net, monkeypatch):
    real = service._market

    def boom(hs6, cc, *a):
        if cc == "SG":
            raise RuntimeError("bad row")
        return real(hs6, cc, *a)

    monkeypatch.setattr(service, "_market", boom)
    r = by_code(service.more_markets("040900", timeout=10))
    assert r["SG"].tariff.status == "unavailable" and r["FR"].tariff.status == "ok"


def test_bad_input_is_422(client):
    assert client.get("/api/more-markets").status_code == 422
    assert client.get("/api/more-markets", params={"category": "maple"}).status_code == 422
    assert client.get("/api/more-markets", params={"hs6": "999998"}).status_code == 422


def test_no_effect_on_curated_paths_or_main_markets(net, client):
    before = curated_build()
    assert client.get("/api/more-markets", params={"category": "honey"}).status_code == 200
    assert curated_build() == before
    assert set(lookup_markets.MARKETS) == {"GB", "JP", "AU", "DE", "CN", "KR", "US", "MX"}
    assert not set(EXTRA_MARKETS) & set(lookup_markets.MARKETS)


def test_committed_cache_serves_demo_products_offline():
    """The demo never depends on a live call: honey, icewine, hockey sticks and maple syrup are cached and committed."""
    assert set(CATEGORY_HS6.values()) <= set(PREWARM_HS6)
    for code in PREWARM_HS6:
        assert service.cache_complete(code), f"HS {code} cache incomplete: run the prewarm"
        resp = service.more_markets(code, timeout=0.5)
        assert {m.tariff.origin for m in resp.markets} == {"cache"}
        assert len(resp.markets) == 8
        assert sum(m.tariff.status in ("ok", "mfn_only") for m in resp.markets) >= 6


@pytest.mark.parametrize("hs6,category", [("040900", "honey"), ("220421", "icewine")])
def test_eu_markets_reuse_germanys_verified_rules_plus_national_language(net, hs6, category):
    from app.explore.more_markets import eu_rules
    from app.explore.lookup.service import base_catalog

    de = base_catalog().market(category, "DE")
    r = by_code(service.more_markets(hs6, category=category, timeout=10))
    for cc, lang in (("FR", "French"), ("NL", "Dutch"), ("IT", "Italian")):
        reqs = r[cc].requirements
        assert [q.name for q in reqs[:-1]] == [q.name for q in de.compliance_requirements]
        assert reqs[-1].name == f"{lang}-language labelling" and reqs[-1].source.startswith("https://")
        assert all(q.confidence == "verified" for q in reqs)
        assert "German-language" not in " ".join(q.detail for q in reqs)
        assert r[cc].ease is None and r[cc].overall is None
    for cc in ("VN", "SG", "NZ", "IN", "AE"):
        assert r[cc].verified is False and r[cc].requirements == []


def test_non_curated_products_stay_unverified_everywhere(net):
    resp = service.more_markets("950699", timeout=10)  # hockey sticks: no curated Germany row
    assert all(m.verified is False and m.badge == NOT_VERIFIED for m in resp.markets)
