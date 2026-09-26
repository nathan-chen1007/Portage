"""Build data/auto/<product>.json from the saved raw snapshots in data/auto/raw/. Offline and deterministic.

    cd backend && python -m app.explore.compliance.build maple_syrup

Inputs (all fetched from official structured sources, URL recorded on every value):
  raw/<product>_inputs.json   tariffs per market (national tariff schedules, WITS/TRAINS), requirements read from
                              national official sources (UK Trade Tariff API, FDA, CFIA), notes
  raw/trains_<hs6>.json       UNCTAD TRAINS NTM rows per importing market, as returned by TRAINS Online
  ../markets.json             shipping lane, sea distance, sailings and LPI per country, copied from the honey rows
                              (they describe the country, not the product)

Rules:
  - Every requirement gets confidence "auto_sourced" and lead_time_basis "estimate" (no source states a lead time).
  - NTM codes map to tiers via ntm.py; codes for the same practical step are merged into one requirement.
  - A national-source requirement tagged with a `step` merges into the TRAINS requirement for that step (its name
    and URL are more specific, so they win); otherwise it's added as its own requirement.
  - A prohibition that names Canada makes the market "blocked".
  - Horizontal measures (covering HORIZONTAL_CHAPTERS or more HS chapters) are dropped: they aren't about this product.
  - Measures limited to feed, organic, GMO or novel-food products (CONDITIONAL_TERMS), measures with no HS scope
    recorded, and measures a more specific official source contradicts (`trains_overrides` in the inputs, with its
    URL) are listed in the market's notes, not as requirements.
  - No requirement is ever written from memory: if a market has no TRAINS rows and no national-source rows, it
    gets no requirements and compliance_confidence "unknown".

This module deliberately uses only the standard library (no pydantic), so it runs anywhere; the service validates
the output against MarketEntry when it loads it, and the tests do too.
"""

import json
import re
import sys
from pathlib import Path

try:
    from app.explore.compliance.ntm import is_prohibition, step_for, targets_canada
except ImportError:  # run as a plain script where fastapi isn't installed: python build.py
    from ntm import is_prohibition, step_for, targets_canada  # type: ignore[no-redef]

AUTO_DIR = Path(__file__).resolve().parents[3] / "data" / "auto"
RAW_DIR = AUTO_DIR / "raw"
MARKETS_FILE = AUTO_DIR.parent / "markets.json"

COPIED_FROM_HONEY = ("lpi_customs_score", "sea_distance_nm", "weekly_sailings", "shipping_route", "shipping_source",
                     "language", "country")
MAX_DETAIL = 600
LPI_SOURCE = "https://data.worldbank.org/indicator/LP.LPI.CUST.XQ"  # the LPI customs score copied from markets.json
# A measure covering this many HS chapters or more is horizontal (it applies to nearly all goods, e.g. Japan's
# Consumer Product Safety Act): it says nothing about this product, so it's dropped, like TRAINS's own
# "exclude measures affecting ALL products" filter.
HORIZONTAL_CHAPTERS = 60
# Measures that only bite when the product is of a special kind (sold as animal feed or pet food, organic, or a
# genetically modified / living modified organism). A conventional food product doesn't trigger them, so they're
# kept out of the requirements and listed in the market's notes instead. Matched on the regulation title and the
# measure description.
CONDITIONAL_TERMS = {
    "animal feed": ("feedingstuff", "feed business", "pet food", "animal feed", "feed materials"),
    "organic": ("organic",),
    "GMO / living modified organism": ("living modified organism", "genetically modified", "gmo", "gmos"),
    "novel food": ("novel food", "novel foods"),
}


def _read(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _clip(text: str, n: int = MAX_DETAIL) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def condition_of(row: dict) -> str | None:
    """The special case a measure is limited to (see CONDITIONAL_TERMS), or None if it applies to plain food."""
    text = f"{row.get('regulationTitle') or ''} {row.get('measureDescription') or ''}".lower()
    return next((label for label, terms in CONDITIONAL_TERMS.items()
                 if any(re.search(rf"\b{re.escape(t)}\b", text) for t in terms)), None)


def skip_reason(row: dict, overridden: dict[str, dict] | None = None) -> str | None:
    """Why a TRAINS row is not counted as a requirement, or None if it is.

    horizontal  covers HORIZONTAL_CHAPTERS+ HS chapters (applies to nearly everything)
    no_scope    TRAINS records no HS scope for it (hsChapters == 0), e.g. general customs rules
    override    a more specific official source for this exact tariff line contradicts it (see *_inputs.json)
    <label>     limited to a special kind of product (CONDITIONAL_TERMS)
    """
    code = (row.get("ntmCode") or "").strip()
    chapters = row.get("hsChapters")
    if chapters is not None and chapters >= HORIZONTAL_CHAPTERS:
        return "horizontal"
    if chapters == 0:
        return "no_scope"
    if overridden and code in overridden:
        return "override"
    return condition_of(row)


def trains_notes(rows: list[dict], overridden: dict[str, dict] | None = None) -> list[str]:
    """Plain-language notes for the rows we left out, so nothing disappears silently."""
    by_reason: dict[str, set[str]] = {}
    canada_no_scope = []
    for row in rows:
        code = row.get("ntmCode") or ""
        if not step_for(code):
            continue
        reason = skip_reason(row, overridden)
        if reason and reason != "horizontal":
            by_reason.setdefault(reason, set()).add(code)
            if reason == "no_scope" and targets_canada(row.get("affectedCountriesNames")):
                canada_no_scope.append(f"{code} ({row.get('regulationTitle') or 'untitled'})")
    notes = []
    for reason, codes in by_reason.items():
        listed = ", ".join(sorted(codes))
        if reason == "no_scope":
            notes.append(f"UNCTAD TRAINS lists measures with no product scope recorded ({listed}), such as general "
                         "customs rules; not counted here.")
        elif reason == "override":
            for code in sorted(codes):
                o = overridden[code]
                notes.append(f"UNCTAD TRAINS lists {code} for this HS code, but {o['reason']} ({o['source']}); "
                             "not counted here.")
        else:
            notes.append(f"UNCTAD TRAINS also lists measures that apply only to {reason} products ({listed}); "
                         "not counted here.")
    if canada_no_scope:
        notes.append("Among the measures with no product scope, this one names Canada specifically: "
                     + "; ".join(canada_no_scope) + ". Check with the Trade Commissioner Service whether it applies.")
    return notes


def conditional_notes(rows: list[dict]) -> list[str]:
    return trains_notes(rows)


def trains_requirements(rows: list[dict], source_url: str,
                        overridden: dict[str, dict] | None = None) -> tuple[list[dict], str | None]:
    """Merge one market's TRAINS rows into requirements. Returns (requirements, blocked_reason_or_None)."""
    by_step: dict[str, dict] = {}
    blocked = None
    for row in rows:
        code = (row.get("ntmCode") or "").strip()
        if skip_reason(row, overridden):
            continue
        step = step_for(code)
        if step is None:
            continue
        desc = row.get("measureDescription") or row.get("ntmDescription") or ""
        reg = row.get("regulationTitle") or ""
        if is_prohibition(code) and targets_canada(row.get("affectedCountriesNames")):
            blocked = _clip(f"{code}: {desc}", 300)
        req = by_step.setdefault(step.key, {"step": step.key, "name": step.name, "tier": step.tier,
                                            "codes": [], "parts": [], "lead_time_weeks": step.lead_time_weeks})
        if code not in req["codes"]:
            req["codes"].append(code)
        part = f"{code}: {desc}" + (f" ({reg})" if reg else "")
        if part not in req["parts"]:
            req["parts"].append(part)
    out = []
    for req in by_step.values():
        out.append({
            "step": req["step"],
            "name": f"{req['name']} ({', '.join(sorted(req['codes']))})",
            "tier": req["tier"],
            "detail": _clip("UNCTAD TRAINS: " + " | ".join(req["parts"])),
            "source": source_url,
            "lead_time_weeks": req["lead_time_weeks"],
        })
    return out, blocked


def merge_national(reqs: list[dict], national: list[dict]) -> list[dict]:
    by_step = {r["step"]: r for r in reqs}
    for n in national:
        step = n.get("step")
        if step and step in by_step:
            r = by_step[step]
            r["name"] = n["name"]
            r["detail"] = _clip(n["detail"] + " " + r["detail"])
            r["source"] = n["source"]
            r["tier"] = max(r["tier"], n["tier"])
            r["lead_time_weeks"] = max(r["lead_time_weeks"], n.get("lead_time_weeks", 0))
        else:
            item = {"step": step or n["name"], "name": n["name"], "tier": n["tier"], "detail": _clip(n["detail"]),
                    "source": n["source"], "lead_time_weeks": n.get("lead_time_weeks", 0)}
            reqs.append(item)
            if step:
                by_step[step] = item
    return reqs


def build(product: str) -> tuple[dict, list[dict]]:
    inputs = _read(RAW_DIR / f"{product}_inputs.json")
    hs6 = inputs["hs6"]
    trains_path = RAW_DIR / f"trains_{hs6}.json"
    trains = _read(trains_path) if trains_path.exists() else {"markets": {}}
    honey = {m["country_code"]: m for m in _read(MARKETS_FILE) if m["category"] == inputs["copy_logistics_from"]}

    rows = []
    for cc, spec in inputs["markets"].items():
        base = honey[cc]
        t = trains["markets"].get(cc)
        trains_url = t["source_url"] if t else None
        overridden = {o["ntmCode"]: o for o in spec.get("trains_overrides", [])}
        reqs, blocked = trains_requirements(t["rows"], trains_url, overridden) if t else ([], None)
        reqs = merge_national(reqs, spec.get("requirements", []))
        reqs.sort(key=lambda r: (-r["tier"], r["name"]))
        requirements = [{
            "name": r["name"], "tier": r["tier"], "detail": r["detail"], "source": r["source"],
            "lead_time_weeks": r["lead_time_weeks"], "lead_time_basis": "estimate", "confidence": "auto_sourced",
        } for r in reqs]

        sources = list(dict.fromkeys(
            ([trains_url] if trains_url else []) + spec["tariff_sources"]
            + [r["source"] for r in requirements] + inputs.get("common_sources", [])
            + [LPI_SOURCE] + ([base["shipping_source"]] if base.get("shipping_source") else [])))
        notes = list(spec.get("notes", []))
        if t:
            notes += ([t["note"]] if t.get("note") else []) + trains_notes(t["rows"], overridden)
        else:
            why = trains.get("not_covered", {}).get(cc) or trains.get("not_fetched", {}).get(cc) \
                or "No UNCTAD TRAINS data saved for this market."
            notes.append(f"UNCTAD TRAINS: {why} Requirements here come only from the national sources cited.")
        notes.append("Auto-sourced: pulled from official structured data, not checked by a person for maple syrup. "
                     "Confirm with the Trade Commissioner Service before the first shipment.")

        row = {
            "category": inputs["category"],
            "country_code": cc,
            **{k: base.get(k) for k in COPIED_FROM_HONEY},
            "status": "blocked" if blocked else "open",
            "status_note": f"UNCTAD TRAINS lists a prohibition naming Canada: {blocked}" if blocked else "",
            "compliance_confidence": "auto_sourced" if requirements else "unknown",
            "tariff_rate": spec["tariff_rate"],
            "mfn_rate": spec["mfn_rate"],
            "tariff_note": spec["tariff_note"],
            "trade_agreement": spec.get("trade_agreement"),
            "compliance_requirements": requirements,
            "tax_burden": spec.get("tax_burden", base["tax_burden"]),
            "tax_note": spec.get("tax_note", ""),
            "notes": notes,
            "sources": sources,
            "as_of": inputs["as_of"],
        }
        rows.append(row)

    index_entry = {"label": inputs["label"], "category": inputs["category"], "file": f"{product}.json",
                   "as_of": inputs["as_of"], "method": inputs["method"]}
    return {hs6: index_entry}, rows


def write(product: str) -> Path:
    index_add, rows = build(product)
    out = AUTO_DIR / f"{product}.json"
    out.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    index_path = AUTO_DIR / "index.json"
    index = _read(index_path) if index_path.exists() else {}
    index.update(index_add)
    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return out


if __name__ == "__main__":
    for name in sys.argv[1:] or ["maple_syrup"]:
        print("wrote", write(name))
