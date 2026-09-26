"""UN Comtrade imports for the opportunity score: the same fields as backend/data/opportunity.json.

Per market: YEAR imports from the world and from Canada (one call, partnerCode=0,124) and BASE_YEAR imports
from the world (growth). Plus Canada's YEAR exports to the world (Canada's own unit price). The public
preview API needs no key and takes one period per call.
"""

from datetime import date

from app.explore.lookup import sources
from app.explore.lookup.markets import CANADA_COMTRADE, MARKETS
from app.models import CategoryTrade, MarketTrade

YEAR, BASE_YEAR = 2024, 2019
URL = ("https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode={reporter}&period={period}"
       "&cmdCode={hs6}&flowCode={flow}&partnerCode={partners}")


def url(reporter: str, period: int, hs6: str, flow: str = "M", partners: str = "0") -> str:
    return URL.format(reporter=reporter, period=period, hs6=hs6, flow=flow, partners=partners)


def parse(doc: dict | None) -> dict[str, dict] | None:
    """{partner code: {value_usd, kg}}; the largest row per partner (the aggregate). None if no rows."""
    rows = (doc or {}).get("data") or []
    out: dict[str, dict] = {}
    for d in rows:
        p = str(d.get("partnerCode"))
        value = float(d.get("primaryValue") or 0)
        kg = float(d.get("netWgt") or 0) or (float(d.get("qty") or 0) if d.get("qtyUnitCode") == 8 else 0.0)
        if p not in out or value > out[p]["value_usd"]:
            out[p] = {"value_usd": value, "kg": kg}
    return out or None


def _job(u: str):
    return lambda: (parse(sources.http_get_json(u)), u)


def jobs_for(hs6: str) -> dict:
    jobs = {f"trade-{hs6}-CA-X-{YEAR}": _job(url(CANADA_COMTRADE, YEAR, hs6, flow="X"))}
    for cc, m in MARKETS.items():
        jobs[f"trade-{hs6}-{cc}-M-{YEAR}"] = _job(url(m.comtrade, YEAR, hs6, partners=f"0,{CANADA_COMTRADE}"))
        jobs[f"trade-{hs6}-{cc}-M-{BASE_YEAR}"] = _job(url(m.comtrade, BASE_YEAR, hs6))
    return jobs


def build(hs6: str, category_id: str, description: str, fetched: dict) -> tuple[CategoryTrade | None, dict[str, str], str]:
    """(CategoryTrade or None, per-market status, note). Status: ok | pending | unavailable."""
    status: dict[str, str] = {}
    ca, ca_origin = fetched.get(f"trade-{hs6}-CA-X-{YEAR}", (None, "error"))
    ca_world = (ca or {}).get("0")
    markets: list[MarketTrade] = []
    for cc, m in MARKETS.items():
        now, o1 = fetched.get(f"trade-{hs6}-{cc}-M-{YEAR}", (None, "error"))
        base, o2 = fetched.get(f"trade-{hs6}-{cc}-M-{BASE_YEAR}", (None, "error"))
        world = (now or {}).get("0")
        if not world or world["value_usd"] <= 0:
            status[cc] = "pending" if "pending" in (o1, o2) else "unavailable"
            continue
        base_world = (base or {}).get("0") or {"value_usd": 0.0}
        from_ca = (now or {}).get(CANADA_COMTRADE) or {"value_usd": 0.0}
        markets.append(MarketTrade(
            country_code=cc,
            import_value_usd=world["value_usd"],
            import_volume_kg=world["kg"],
            import_value_base_usd=base_world["value_usd"],
            canada_value_usd=from_ca["value_usd"],
            note="" if base_world["value_usd"] else f"No {BASE_YEAR} figure reported: growth counts as flat.",
            sources=[url(m.comtrade, YEAR, hs6, partners=f"0,{CANADA_COMTRADE}"), url(m.comtrade, BASE_YEAR, hs6)],
        ))
        status[cc] = "ok"

    if not ca_world or ca_world["value_usd"] <= 0 or ca_world["kg"] <= 0:
        why = ("still loading" if ca_origin == "pending" else
               f"Canada reported no {YEAR} exports of HS {hs6} with a weight, so there's no Canadian price to compare")
        for cc in status:
            if status[cc] == "ok":
                status[cc] = "pending" if ca_origin == "pending" else "unavailable"
        return None, status, f"Opportunity unavailable: {why}."

    trade = CategoryTrade(
        category=category_id, hs_code=hs6, year=YEAR, base_year=BASE_YEAR,
        canada_export_value_usd=ca_world["value_usd"], canada_export_volume_kg=ca_world["kg"],
        canada_export_source=url(CANADA_COMTRADE, YEAR, hs6, flow="X"),
        description=f"UN Comtrade annual imports of HS {hs6} ({description}), all partners and from Canada, in US dollars.",
        as_of=date.today().isoformat(), markets=markets,
    )
    return trade, status, ""
