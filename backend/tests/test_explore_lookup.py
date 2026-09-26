"""Any-product lookup (lab session C). Every network call is mocked: the suite runs offline."""

import threading
import time
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.explore.lookup import classify as classifier
from app.explore.lookup import compliance, hs, section338, service, sources, tariffs
from app.explore.lookup.routes import router
from app.explore.lookup.schemas import LookupRankRequest
from app.models import Requirement

ATTRS = ["NOMENCODE", "EXCLUDEDFROM", "TARIFFTYPE", "SUM_OF_RATES", "MIN_RATE", "MAX_RATE", "TOTALNOOFLINES",
         "NBR_PREF_LINES", "NBR_MFN_LINES", "NBR_NA_LINES", "OBS_VALUE_MEASURE"]


def wits_doc(rows: dict[int, float], na_years: tuple = (), kind: str = "MFN") -> dict:
    """SDMX-JSON shaped like WITS: {year: percent}. Years in na_years have every line non-ad-valorem."""
    years = sorted(rows)
    values = {a: [{"id": "x"}] for a in ATTRS}
    values["TARIFFTYPE"] = [{"id": kind}]
    values["TOTALNOOFLINES"] = [{"id": "1"}]
    values["NBR_NA_LINES"] = [{"id": "0"}, {"id": "1"}]
    obs = {str(i): [rows[y], 0, None, 0, 0, 0, 0, 0, 0, 0, 1 if y in na_years else 0, 0] for i, y in enumerate(years)}
    return {"dataSets": [{"series": {"0:0:0:0:0": {"observations": obs}}}],
            "structure": {"dimensions": {"observation": [{"values": [{"id": str(y)} for y in years]}]},
                          "attributes": {"observation": [{"id": a, "values": values[a]} for a in ATTRS]}}}


def comtrade_doc(rows: dict[int, tuple[float, float]]) -> dict:
    return {"data": [{"partnerCode": p, "primaryValue": v, "netWgt": kg} for p, (v, kg) in rows.items()], "error": ""}


class FakeNet:
    """Answers WITS and Comtrade URLs; counts calls; can fail or stall chosen markets."""

    def __init__(self):
        self.calls = 0
        self.fail_wits: set[str] = set()      # WITS reporter codes that raise
        self.no_records: set[str] = set()     # WITS reporter codes with no data (404)
        self.gate: threading.Event | None = None
        self.lock = threading.Lock()

    def __call__(self, url, timeout=None):
        with self.lock:
            self.calls += 1
        if self.gate is not None:
            self.gate.wait(5)
        u = urlparse(url)
        if "wits.worldbank.org" in u.netloc:
            parts = u.path.split("/")
            reporter, partner = parts[parts.index("reporter") + 1], parts[parts.index("partner") + 1]
            if reporter in self.fail_wits:
                raise ConnectionError("WITS down")
            if reporter in self.no_records:
                raise sources.NoRecords("NoRecordsFound")
            if partner == "000":
                return wits_doc({2021: 20.0, 2022: 18.0})
            return wits_doc({2021: 0.0}, kind="PREF") if reporter in ("826", "392", "918") else None
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if q["flowCode"] == "X":
            return comtrade_doc({0: (50_000_000, 10_000_000)})
        if q["period"] == "2019":
            return comtrade_doc({0: (80_000_000, 20_000_000)})
        return comtrade_doc({0: (100_000_000, 20_000_000), 124: (5_000_000, 1_000_000)})


@pytest.fixture
def net(tmp_path, monkeypatch):
    monkeypatch.setattr(sources, "CACHE_DIR", tmp_path)
    fake = FakeNet()
    monkeypatch.setattr(sources, "http_get_json", fake)
    monkeypatch.setattr(compliance, "auto_requirements", lambda hs6, cc: [])  # no auto-sourced data unless a test says so
    hs.reset()
    yield fake
    if fake.gate is not None:
        fake.gate.set()
    hs.reset()


def req(hs6: str, **kw) -> LookupRankRequest:
    return LookupRankRequest(hs6=hs6, **kw)


def status(resp, cc):
    return next(s for s in resp.data_status if s.country_code == cc)


# ---------- parsing ----------

def test_parse_wits_takes_latest_usable_year_and_skips_non_ad_valorem():
    # Korea honey: 2023 reported as 0 because the only line is a specific duty. That must not read as duty-free.
    doc = wits_doc({2021: 243.0, 2022: 243.0, 2023: 0.0}, na_years=(2023,))
    assert tariffs.parse_wits(doc) == {"rate": 2.43, "year": 2022, "type": "MFN"}
    assert tariffs.parse_wits(None) is None
    assert tariffs.parse_wits({"dataSets": [{"series": {}}]}) is None


# ---------- ranking ----------

def test_rank_scores_every_market_with_the_existing_engine(net):
    r = service.rank(req("170220", description="maple syrup"), timeout=5)
    assert len(r.markets) == 8 and all(m.score is not None for m in r.markets)
    assert [m.rank for m in r.markets] == list(range(1, 9))
    assert r.opportunity_available and all(m.opportunity is not None for m in r.markets)
    gb = next(m for m in r.markets if m.country_code == "GB")
    assert gb.entry.tariff_rate == 0.0 and gb.entry.mfn_rate == 0.18 and "CUKTCA" in gb.entry.trade_agreement
    cn = next(m for m in r.markets if m.country_code == "CN")
    assert cn.entry.tariff_rate == 0.18 and status(r, "CN").tariff == "mfn_only"
    assert r.product.hs6 == "170220" and r.product.classified_by == "user" and r.product.catalog == "seed"
    assert not r.product.pending and r.product.fetched.get("live") == 33


def test_us_section_338_adds_50_percent_only_when_listed(net):
    (net_dir := sources.CACHE_DIR).mkdir(exist_ok=True)
    (net_dir / section338.FILE).write_text('{"hts": ["0409.00.00"]}', encoding="utf-8")
    honey = service.rank(req("040900"), timeout=5)
    us = next(m for m in honey.markets if m.country_code == "US")
    assert us.entry.tariff_rate == pytest.approx(0.68) and status(honey, "US").section338 == "listed"
    maple = service.rank(req("170220"), timeout=5)
    assert status(maple, "US").section338 == "not_listed"
    assert next(m for m in maple.markets if m.country_code == "US").entry.tariff_rate == pytest.approx(0.18)


def test_section_338_unknown_is_said_not_guessed(net):
    r = service.rank(req("170220"), timeout=5)
    assert status(r, "US").section338 == "unknown"
    assert "not checked" in next(m for m in r.markets if m.country_code == "US").entry.tariff_note


# ---------- cache ----------

def test_preferential_rate_falls_back_between_datatypes(net):
    seen = []
    real = net.__call__

    def spy(url, timeout=None):
        seen.append(url)
        return real(url, timeout)

    sources.http_get_json = spy  # restored by the fixture's monkeypatch teardown
    fetched = sources.fetch_many({"k": tariffs._job("410", "124", "040900")}, timeout=5)
    assert fetched["k"] == (None, "live")  # no preference on record, both datatypes tried
    assert [u.split("/datatype/")[1].split("?")[0] for u in seen] == ["reported", "aveestimated"]


def test_old_cache_versions_are_refetched(net):
    sources.write_cache("x", {"a": 1})
    assert sources.read_cache("x")["payload"] == {"a": 1}
    sources.cache_path("x").write_text('{"key": "x", "payload": {"a": 0}}', encoding="utf-8")  # v1 record
    assert sources.read_cache("x") is None

def test_cache_miss_then_hit(net):
    first = service.rank(req("151411"), timeout=5)
    calls = net.calls
    assert calls >= 33 and first.product.fetched == {"live": 33}
    assert (sources.CACHE_DIR / "tariff-151411-JP-mfn.json").exists()
    second = service.rank(req("151411"), timeout=5)
    assert net.calls == calls and second.product.fetched == {"cache": 33}
    assert [m.country_code for m in second.markets] == [m.country_code for m in first.markets]
    assert any(p["hs6"] == "151411" and p["complete"] for p in service.cached_products())


def test_no_records_is_cached_but_errors_are_retried(net):
    net.no_records.add("156")  # China: no data
    net.fail_wits.add("410")   # Korea: network error
    service.rank(req("030632"), timeout=5)
    assert sources.read_cache("tariff-030632-CN-mfn")["payload"] is None
    assert sources.read_cache("tariff-030632-KR-mfn") is None
    before = net.calls
    service.rank(req("030632"), timeout=5)
    assert net.calls - before == 2  # only Korea's two tariff calls are retried


# ---------- degraded markets ----------

def test_failed_tariff_degrades_that_market_only(net):
    net.fail_wits.add("826")
    r = service.rank(req("071340"), timeout=5)
    gb = next(m for m in r.markets if m.country_code == "GB")
    assert gb.score is None and gb.overall is None and gb.rank == 8  # listed last, unscored
    assert "Tariff unavailable" in gb.status_note
    s = status(r, "GB")
    assert not s.scored and s.tariff == "unavailable" and s.tariff_origin == "error"
    assert sum(m.score is not None for m in r.markets) == 7


def test_slow_source_is_pending_now_and_cached_later(net):
    net.gate = threading.Event()
    r = service.rank(req("100199"), timeout=0.2)
    assert r.product.pending and all(m.score is None for m in r.markets)
    assert all(s.tariff == "pending" for s in r.data_status)
    net.gate.set()
    for _ in range(50):
        if sources.pending_count() == 0:
            break
        time.sleep(0.1)
    again = service.rank(req("100199"), timeout=0.2)
    assert not again.product.pending and all(m.score is not None for m in again.markets)


def test_missing_canada_exports_means_no_opportunity_not_a_crash(net, monkeypatch):
    real = net.__call__

    def no_exports(url, timeout=None):
        return {"data": []} if "flowCode=X" in url else real(url, timeout)

    monkeypatch.setattr(sources, "http_get_json", no_exports)
    r = service.rank(req("071310"), timeout=5)
    assert not r.opportunity_available and all(m.opportunity is None for m in r.markets)
    assert all(m.overall == pytest.approx(100 - m.score, abs=0.01) for m in r.markets)
    assert any("Opportunity unavailable" in n for n in r.notes)


# ---------- compliance confidence ----------

def test_unknown_compliance_is_badged_and_never_free(net):
    r = service.rank(req("170220"), timeout=5)
    for m in r.markets:
        assert m.entry.compliance_confidence == "unknown"
        assert all(q.confidence == "unknown" for q in m.entry.compliance_requirements)
        assert m.components["compliance"] > 0.3  # an assumed typical burden, not zero
        assert status(r, m.country_code).message == compliance.UNKNOWN_MESSAGE
    assert any("Trade Commissioner Service" in n for n in r.notes)


def test_auto_sourced_requirements_are_used_when_session_b_provides_them(net, monkeypatch):
    def auto(hs6, cc):
        if cc != "GB":
            return []
        return [Requirement(name="UK labelling", tier=1, detail="d", source="https://www.gov.uk/x", confidence="auto_sourced")]

    monkeypatch.setattr(compliance, "auto_requirements", auto)
    r = service.rank(req("170220"), timeout=5)
    gb = next(m for m in r.markets if m.country_code == "GB")
    assert gb.entry.compliance_confidence == "auto_sourced" and [q.name for q in gb.entry.compliance_requirements] == ["UK labelling"]
    assert status(r, "JP").compliance_confidence == "unknown"


def test_broken_session_b_falls_back_to_unknown(net, monkeypatch):
    def boom(hs6, cc):
        raise RuntimeError("bad data")

    monkeypatch.setattr(compliance, "auto_requirements", boom)
    r = service.rank(req("170220"), timeout=5)
    assert all(s.compliance_confidence == "unknown" for s in r.data_status)


# ---------- classification ----------

def test_classifier_drops_invented_codes(net, monkeypatch):
    monkeypatch.setattr(classifier, "_llm_candidates",
                        lambda d, s: [{"hs6": "1702.20", "reason": "maple syrup"}, {"hs6": "999999", "reason": "made up"}])
    cands, mode = classifier.classify("We make pure maple syrup in Quebec")
    assert mode == "llm" and cands[0]["hs6"] == "170220" and cands[0]["source"] == "llm"
    assert "999999" not in [c["hs6"] for c in cands]
    assert all(hs.is_valid(c["hs6"]) for c in cands)


def test_classifier_falls_back_to_keywords_without_llm(net, monkeypatch):
    def down(d, s):
        raise RuntimeError("no key")

    monkeypatch.setattr(classifier, "_llm_candidates", down)
    cands, mode = classifier.classify("frozen lobster tails")
    assert mode == "offline" and cands and cands[0]["hs6"] in ("030612", "030632")


def test_hs_catalog_builds_from_the_comtrade_reference(net):
    (sources.CACHE_DIR / hs.RAW_FILE).write_text(
        '{"results": [{"id": "04", "text": "04 - Dairy"}, {"id": "040900", "text": "040900 - Natural honey."}]}', encoding="utf-8")
    hs.reset()
    assert hs.catalog() == {"040900": "Natural honey."} and hs.catalog_source() == "comtrade"
    assert (sources.CACHE_DIR / hs.FILE).exists()


# ---------- routes ----------

@pytest.fixture
def client(net, monkeypatch):
    monkeypatch.setattr(classifier, "_llm_candidates", lambda d, s: [])
    app = FastAPI()
    app.include_router(router, prefix="/api/explore/lookup")
    return TestClient(app)


def test_routes_classify_rank_search(client):
    c = client.post("/api/explore/lookup/classify", json={"description": "maple syrup"}).json()
    assert c["candidates"][0]["hs6"] == "170220" and c["catalog"] == "seed"
    r = client.post("/api/explore/lookup/rank", json={"hs6": "170220", "sort_by": "friction", "prize_weight": 0.3})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"product", "markets", "data_status", "opportunity_available", "notes"}
    scores = [m["score"] for m in body["markets"]]
    assert scores == sorted(scores)  # friction: easiest first
    assert client.get("/api/explore/lookup/search", params={"q": "honey"}).json()[0]["hs6"] == "040900"


def test_rank_rejects_codes_outside_the_hs_list(client):
    assert client.post("/api/explore/lookup/rank", json={"hs6": "999999"}).status_code == 422
    assert client.post("/api/explore/lookup/rank", json={"hs6": "maple"}).status_code == 422


def test_wits_malformed_empty_slots_are_read_as_null():
    doc = sources.parse_json('{"a": [,0,null,0], "b": [1,,2], "c": [], "d": [3,]}')
    assert doc == {"a": [None, 0, None, 0], "b": [1, None, 2], "c": [], "d": [3, None]}


def test_curated_closed_market_stays_closed(net):
    # Honey has verified data, and Mexico is closed to Canadian honey: the lab must not rank it first.
    r = service.rank(req("040900"), timeout=5)
    mx = next(m for m in r.markets if m.country_code == "MX")
    assert mx.status == "blocked" and mx.score is None and mx.rank == 8 and mx.status_note
    assert not status(r, "MX").scored
    assert any("verified data for natural honey" in n for n in r.notes)
    assert all(m.status == "open" for m in service.rank(req("170220"), timeout=5).markets)


def test_curated_requirements_outrank_auto_sourced(net, monkeypatch):
    """Precedence: verified (curated honey data) > auto_sourced > unknown. Curated data is never overridden."""
    monkeypatch.setattr(compliance, "auto_requirements",
                        lambda hs6, cc: [Requirement(name="AUTO", tier=1, detail="d", source="https://x.gov/", confidence="auto_sourced")])
    r = service.rank(req("040900"), timeout=5)
    base = service.base_catalog()
    for m in r.markets:
        curated = base.market("honey", m.country_code)
        if curated.status == "blocked":
            assert m.status == "blocked"
            continue
        assert m.entry.compliance_confidence == "verified"
        assert [q.name for q in m.entry.compliance_requirements] == [q.name for q in curated.compliance_requirements]
    reqs, conf, src = compliance.requirements_for("950699", "GB")
    assert (conf, src, reqs[0].name) == ("auto_sourced", "auto_requirements", "AUTO")
