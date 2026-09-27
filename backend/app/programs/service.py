"""Which Canadian export-support programs a founder may qualify for, from data/programs.json.

Never a guarantee: every status is "May qualify", "Likely not eligible" or "Check eligibility", with the reason and
the program's official page. When the founder hasn't said their revenue or head count ("Not sure"), we show the rule
instead of a verdict. No LLM.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

DATA = Path(__file__).resolve().parents[2] / "data" / "programs.json"

Status = Literal["may_qualify", "likely_not", "check"]
STATUS_LABEL = {"may_qualify": "May qualify", "likely_not": "Likely not eligible", "check": "Check eligibility"}
Revenue = Literal["unknown", "under_300k", "300k_plus"]
Employees = Literal["unknown", "1_2", "3_plus"]


class Program(BaseModel):
    id: str
    name: str
    what: str
    status: Status
    status_label: str
    reason: str
    note: str = ""
    url: str
    sources: list[str]
    as_of: str


class ProgramsResponse(BaseModel):
    country_code: str
    country: str
    category: str | None
    agri_food: bool | None
    label: str
    note: str
    as_of: str
    programs: list[Program]


@lru_cache(maxsize=1)
def data() -> dict:
    return json.loads(DATA.read_text(encoding="utf-8"))


def _chapter(hs_code: str | None) -> int | None:
    digits = "".join(ch for ch in (hs_code or "") if ch.isdigit())
    return int(digits[:2]) if len(digits) >= 2 else None


def agri_food(category: str | None) -> bool | None:
    """True for HS chapters 01-24 (agri-food, incl. wine, fish and seafood); False for services; None if unknown."""
    if not category:
        return None
    from app.explore.lookup.service import base_catalog

    cat = base_catalog().categories.get(category)
    if cat is not None:
        if cat.kind == "services":
            return False
        ch = _chapter(cat.hs_code)
    elif category.startswith("hs"):  # any-product mode: hs950699
        ch = _chapter(category[2:])
    else:
        return None
    return None if ch is None else ch <= 24


def country_name(cc: str) -> str:
    from app.explore.lookup.service import base_catalog

    row = next((m for m in base_catalog().markets if m.country_code == cc), None)
    return row.country.replace(" (EU)", "") if row else cc


def _p(pid: str, spec: dict, status: Status, reason: str, as_of: str, note: str = "", what: str | None = None,
       url: str | None = None) -> Program:
    return Program(id=pid, name=spec.get("name", pid), what=what or spec["what"], status=status,
                   status_label=STATUS_LABEL[status], reason=reason, note=note, url=url or spec["url"],
                   sources=spec["sources"], as_of=as_of)


def programs_for(country_code: str, category: str | None = None, revenue: Revenue = "unknown",
                 employees: Employees = "unknown") -> ProgramsResponse:
    d = data()
    cc = country_code.upper()
    country = country_name(cc)
    agri = agri_food(category)
    as_of = d["as_of"]
    out: list[Program] = []

    tcs = d["tcs"]
    out.append(_p("tcs", {**tcs, "name": f"Trade Commissioner Service in {country}"}, "may_qualify", tcs["who"], as_of,
                  what=tcs["what"].format(country=country),
                  url=tcs["countries"].get(cc, tcs["generic"])))

    ce = d["canexport"]
    if agri:
        out.append(_p("canexport", ce, "likely_not", ce["agri_rule"], as_of, note=ce["intake"]))
    elif revenue == "unknown" or employees == "unknown":
        why = ce["rule"] + (" Agri-food projects go to AgriMarketing instead." if agri is None else "")
        out.append(_p("canexport", ce, "check", why, as_of, note=ce["intake"]))
    elif revenue == "under_300k" or employees == "1_2":
        short = []
        if revenue == "under_300k":
            short.append("annual revenue under $300,000")
        if employees == "1_2":
            short.append("fewer than 3 full-time employees")
        out.append(_p("canexport", ce, "likely_not", f"You told us: {' and '.join(short)}. {ce['rule']}", as_of,
                      note=ce["intake"]))
    else:
        out.append(_p("canexport", ce, "may_qualify", f"You meet the size rule you told us about. {ce['rule']}", as_of,
                      note=ce["intake"]))

    am = d["agrimarketing"]
    if agri:
        out.append(_p("agrimarketing", am, "may_qualify", am["rule"], as_of, note=am["intake"]))
    elif agri is None:
        out.append(_p("agrimarketing", am, "check", "Only for agri-food, fish and seafood products. " + am["rule"], as_of,
                      note=am["intake"]))
    # services (B2B SaaS): AgriMarketing doesn't apply, so it isn't listed

    edc = d["edc"]
    out.append(_p("edc", edc, "may_qualify", edc["rule"], as_of))

    return ProgramsResponse(country_code=cc, country=country, category=category, agri_food=agri, label=d["label"],
                            note=d["note"], as_of=as_of, programs=out)
