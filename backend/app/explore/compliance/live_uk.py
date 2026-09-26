"""LIVE: import requirements for ANY HS6 into the UK, from the UK Trade Tariff API (keyless JSON, gov.uk).

    uk_requirements(hs6) -> LiveResult | None     None = couldn't source it (network error, timeout, unknown code)

How it works (every row cites the API URL it came from; nothing is written from memory):
  1. GET /api/v2/headings/{hs4}: the declarable 10-digit commodity codes under the HS6 (capped at MAX_LEAVES).
  2. GET /api/v2/commodities/{code} for each: the import measures. We keep the non-duty controls (measure type
     series A = prohibition, B = entry subject to conditions) that apply to goods from Canada: geographical area
     CA, erga omnes (1011), or a group listing CA, and Canada not excluded. Duties, VAT and quotas are skipped
     (tariffs are scored separately).
  3. If a tariff preference applies to Canada, GET /api/v2/rules_of_origin_schemes/{hs6}/CA for the proof of
     origin the exporter must provide to claim it.

Tiers, from the measure's conditions (measure_condition_class in the API):
  only exemption codes (e.g. Y922 "other than cat and dog fur")   tier 1: declare the exemption on the entry
  a certificate AND an exemption code                             tier 1: a certificate only if the goods are covered
  certificates/documents only                                      tier 2, or tier 3 if a document is a licence
  series A, or no way to satisfy the conditions                   tier 3 and `blocked`
  proof of origin for a preference                                 tier 1

Results are cached as JSON in data/auto/live/uk_<hs6>.json (CACHE_TTL); a failed call falls back to a stale cache,
and otherwise returns None so callers show "unknown" (never an exception, never a 500).
Overall time budget: TIMEOUT_S seconds across all calls.
"""

import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel

from app.models import Requirement

log = logging.getLogger("portage.explore.compliance.live_uk")

API = "https://www.trade-tariff.service.gov.uk/api/v2"
TIMEOUT_S = 8.0
MAX_LEAVES = 6
CACHE_TTL_S = 7 * 24 * 3600
CACHE_DIR = Path(__file__).resolve().parents[3] / "data" / "auto" / "live"
CANADA = "CA"
ERGA_OMNES = "1011"
CONTROL_SERIES = {"A", "B"}  # A = import prohibition, B = entry subject to conditions (certificates, licences)
TARIFF_PREFERENCE = "142"


class LiveResult(BaseModel):
    hs6: str
    country_code: str = "GB"
    fetched_at: str
    commodities: list[str]
    requirements: list[Requirement]
    blocked: bool = False
    blocked_note: str = ""
    duties: dict[str, dict[str, str | None]] = {}   # commodity code -> {"mfn": ..., "canada": ...} as the API shows them
    sources: list[str]
    from_cache: bool = False


# ---------- HTTP (one function, so tests can replace it) ----------

def _get_json(url: str, timeout: float) -> dict:
    import httpx  # lazy: importing this module stays cheap

    r = httpx.get(url, timeout=timeout, headers={"Accept": "application/json"}, follow_redirects=True)
    r.raise_for_status()
    return r.json()


# ---------- parsing ----------

def _index(doc: dict) -> dict[tuple[str, str], dict]:
    return {(x["type"], str(x["id"])): x for x in doc.get("included", [])}


def leaves_for(hs6: str, heading_doc: dict) -> list[str]:
    """Declarable 10-digit codes under the HS6, from a /headings/{hs4} response."""
    out = []
    for x in heading_doc.get("included", []):
        a = x.get("attributes", {})
        code = a.get("goods_nomenclature_item_id", "")
        if x.get("type") == "commodity" and code.startswith(hs6) and a.get("leaf") and code not in out:
            out.append(code)
    if not out:  # the heading itself may be declarable at HS6 level
        a = heading_doc.get("data", {}).get("attributes", {})
        if a.get("declarable") and a.get("goods_nomenclature_item_id", "").startswith(hs6):
            out.append(a["goods_nomenclature_item_id"])
    return out[:MAX_LEAVES]


def _applies_to_canada(measure: dict, idx: dict) -> bool:
    rel = measure.get("relationships", {})
    geo = ((rel.get("geographical_area") or {}).get("data") or {}).get("id")
    excluded = {e["id"] for e in (rel.get("excluded_countries") or {}).get("data") or []}
    if CANADA in excluded or geo is None:
        return False
    if geo in (CANADA, ERGA_OMNES):
        return True
    area = idx.get(("geographical_area", str(geo)), {})
    kids = ((area.get("relationships") or {}).get("children_geographical_areas") or {}).get("data") or []
    return any(k.get("id") == CANADA for k in kids)


def _conditions(measure: dict, idx: dict) -> list[dict]:
    ids = [c["id"] for c in ((measure.get("relationships") or {}).get("measure_conditions") or {}).get("data") or []]
    return [idx[("measure_condition", str(i))]["attributes"] for i in ids if ("measure_condition", str(i)) in idx]


def _plain(text: str) -> str:
    return " ".join(re.sub(r"<[^>]+>", "", text or "").split())


def _doc_label(c: dict) -> str:
    return _plain(f"{c.get('document_code')}: {c.get('requirement') or c.get('certificate_description') or ''}")


def measures_to_requirements(commodity_doc: dict, source_url: str) -> tuple[list[dict], bool, str]:
    """Non-duty import controls that apply to Canadian goods -> requirement dicts. Returns (reqs, blocked, note)."""
    idx = _index(commodity_doc)
    import_ids = [m["id"] for m in ((commodity_doc.get("data") or {}).get("relationships") or {})
                  .get("import_measures", {}).get("data", [])]
    reqs, blocked, note = [], False, ""
    for mid in import_ids:
        m = idx.get(("measure", str(mid)))
        if not m or not _applies_to_canada(m, idx):
            continue
        mt = idx.get(("measure_type", str(m["relationships"]["measure_type"]["data"]["id"])), {}).get("attributes", {})
        if mt.get("measure_type_series_id") not in CONTROL_SERIES:
            continue
        name = mt.get("description") or "Import control"
        conds = _conditions(m, idx)
        docs = [c for c in conds if c.get("measure_condition_class") == "document" and c.get("document_code")]
        exempt = [c for c in conds if c.get("measure_condition_class") == "exemption" and c.get("document_code")]
        doc_text = "; ".join(dict.fromkeys(_doc_label(c) for c in docs))
        ex_text = "; ".join(dict.fromkeys(_doc_label(c) for c in exempt))
        if mt.get("measure_type_series_id") == "A" or (not docs and not exempt):
            tier, detail = 3, f"UK Trade Tariff lists '{name}' for goods from Canada with no document that lifts it."
            blocked, note = True, f"UK Trade Tariff: {name}"
        elif docs and exempt:
            tier = 1
            detail = (f"UK Trade Tariff: '{name}'. Only if your goods are covered, present {doc_text}. "
                      f"Otherwise the importer declares the exemption {ex_text}.")
        elif exempt:
            tier = 1
            detail = f"UK Trade Tariff: '{name}'. The importer declares the exemption {ex_text} on the entry."
        else:
            tier = 3 if any("licen" in _doc_label(c).lower() for c in docs) else 2
            detail = f"UK Trade Tariff: '{name}'. Required at import: {doc_text}."
        reqs.append({"key": name, "name": f"{name} (UK Trade Tariff)", "tier": tier, "detail": detail,
                     "source": source_url})
    return reqs, blocked, note


def duties(commodity_doc: dict) -> tuple[str | None, str | None]:
    """(MFN third-country duty, Canada preference) as the API's display strings. Canada's own agreement (geo CA,
    i.e. CUKTCA) wins over a group preference that also covers Canada (e.g. CPTPP)."""
    idx = _index(commodity_doc)
    mfn = None
    prefs: list[tuple[int, str | None]] = []
    for m in (commodity_doc.get("data") or {}).get("relationships", {}).get("import_measures", {}).get("data", []):
        x = idx.get(("measure", str(m["id"])))
        if not x:
            continue
        rel = x["relationships"]
        geo = ((rel.get("geographical_area") or {}).get("data") or {}).get("id")
        mt_id = str(rel["measure_type"]["data"]["id"])
        de = idx.get(("duty_expression", str(((rel.get("duty_expression") or {}).get("data") or {}).get("id"))), {})
        base = (de.get("attributes") or {}).get("base")
        if mt_id == "103" and geo == ERGA_OMNES:
            mfn = base
        if mt_id == TARIFF_PREFERENCE and _applies_to_canada(x, idx):
            prefs.append((0 if geo == CANADA else 1, base))
    return mfn, (min(prefs, key=lambda p: p[0])[1] if prefs else None)


def origin_requirement(roo_doc: dict, source_url: str) -> dict | None:
    proofs = [x["attributes"] for x in roo_doc.get("included", []) if x.get("type") == "rules_of_origin_proof"]
    if not proofs:
        return None
    names = "; ".join(dict.fromkeys(p.get("summary", "") for p in proofs if p.get("summary")))
    schemes = [d.get("attributes", {}).get("title", "") for d in roo_doc.get("data", []) or []]
    scheme = next((s for s in schemes if s), "the UK-Canada agreement")
    return {"key": "origin", "name": "Proof of origin to claim the preferential tariff (UK Trade Tariff)", "tier": 1,
            "detail": f"UK Trade Tariff rules of origin for {scheme}: accepted proof: {names}.", "source": source_url}


# ---------- cache ----------

def _cache_path(hs6: str) -> Path:
    return CACHE_DIR / f"uk_{hs6}.json"


def _read_cache(hs6: str) -> tuple[LiveResult | None, float]:
    p = _cache_path(hs6)
    try:
        return LiveResult.model_validate_json(p.read_text(encoding="utf-8")), time.time() - p.stat().st_mtime
    except Exception:
        return None, float("inf")


def _write_cache(res: LiveResult) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _cache_path(res.hs6).write_text(json.dumps(res.model_dump(exclude={"from_cache"}), indent=1,
                                                   ensure_ascii=False) + "\n", encoding="utf-8")
    except Exception:
        log.warning("couldn't write UK cache for %s", res.hs6, exc_info=True)


# ---------- the lookup ----------

def fetch(hs6: str) -> LiveResult:
    """Always goes to the network. Raises on any failure (callers use uk_requirements)."""
    deadline = time.monotonic() + TIMEOUT_S

    def left() -> float:
        remaining = deadline - time.monotonic()
        if remaining <= 0.2:
            raise TimeoutError("UK Trade Tariff lookup ran out of time")
        return remaining

    heading_url = f"{API}/headings/{hs6[:4]}"
    codes = leaves_for(hs6, _get_json(heading_url, left()))
    if not codes:
        raise LookupError(f"no declarable UK commodity codes under {hs6}")
    urls = [f"{API}/commodities/{c}" for c in codes]
    with ThreadPoolExecutor(max_workers=len(urls)) as pool:
        docs = list(pool.map(lambda u: _get_json(u, left()), urls))

    merged: dict[str, dict] = {}
    covered: dict[str, list[str]] = {}
    blocked, blocked_note = False, ""
    duty_by_code: dict[str, dict[str, str | None]] = {}
    for code, url, doc in zip(codes, urls, docs):
        reqs, b, note = measures_to_requirements(doc, url)
        blocked, blocked_note = blocked or b, blocked_note or note
        for r in reqs:
            merged.setdefault(r["key"], r)
            covered.setdefault(r["key"], []).append(code)
        m, p = duties(doc)
        duty_by_code[code] = {"mfn": m, "canada": p}

    sources = [heading_url] + urls
    if any(d["canada"] is not None for d in duty_by_code.values()):
        roo_url = f"{API}/rules_of_origin_schemes/{hs6}/{CANADA}"
        try:
            o = origin_requirement(_get_json(roo_url, left()), roo_url)
        except Exception:
            log.info("UK rules of origin lookup failed for %s", hs6, exc_info=True)
            o = None
        if o:
            merged["origin"] = o
            sources.append(roo_url)

    requirements = []
    for key, r in merged.items():
        detail = r["detail"]
        if key in covered and len(covered[key]) < len(codes):
            detail += f" Applies to commodity code(s) {', '.join(covered[key])} of {', '.join(codes)}."
        requirements.append(Requirement(name=r["name"], tier=r["tier"], detail=detail, source=r["source"],
                                        lead_time_weeks={1: 0, 2: 2, 3: 12}[r["tier"]], lead_time_basis="estimate",
                                        confidence="auto_sourced"))
    requirements.sort(key=lambda r: (-r.tier, r.name))
    return LiveResult(hs6=hs6, fetched_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                      commodities=codes, requirements=requirements, blocked=blocked, blocked_note=blocked_note,
                      duties=duty_by_code, sources=sources)


def tariff_note(res: LiveResult) -> str:
    """One line per commodity code: the Canada rate (if a preference applies) and the third-country rate."""
    parts = []
    for code, d in res.duties.items():
        rate = f"{d['canada']} with the Canada preference" if d.get("canada") else "no Canada preference"
        parts.append(f"{code}: {rate}, {d.get('mfn') or 'n/a'} third-country duty")
    return "UK Trade Tariff: " + "; ".join(parts) if parts else ""


def uk_requirements(hs6: str) -> LiveResult | None:
    """Fresh cache, else live, else stale cache, else None ("unknown"). Never raises."""
    cached, age = _read_cache(hs6)
    if cached and age < CACHE_TTL_S:
        return cached.model_copy(update={"from_cache": True})
    try:
        res = fetch(hs6)
    except Exception as e:
        log.warning("UK Trade Tariff lookup failed for %s: %s", hs6, e)
        return cached.model_copy(update={"from_cache": True}) if cached else None
    _write_cache(res)
    return res
