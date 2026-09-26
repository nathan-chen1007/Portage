"""Auto-sourced compliance: LIVE for the UK (any HS6, UK Trade Tariff API, see live_uk.py), saved files for the rest.

Sources, in order:
  GB      live UK Trade Tariff lookup (cached in data/auto/live/, ~8 s budget); if that fails, the saved row if any
  others  the saved files (data/auto/index.json + <product>.json, built offline by build.py); no network calls
Anything else is "no data" (callers show "unknown" and route the founder to the Trade Commissioner Service).

Public API (session C calls these; keep the signatures stable):

    auto_requirements(hs6, country_code) -> list[Requirement]
        Every requirement we auto-sourced for that product and market, each with confidence "auto_sourced".
        For GB this may make live HTTP calls (up to ~8 s the first time, then cached).
        [] when we have no data: use has_auto_data() to tell "no data" (-> show "unknown", route to the
        Trade Commissioner Service) from "sourced, and nothing applies".
    has_auto_data(hs6, country_code) -> bool
    auto_market(hs6, country_code) -> MarketEntry | None     the full row (tariff, shipping, sources, ...)
    auto_markets(hs6) -> list[MarketEntry]                   every market we have for the product
    products() -> list[AutoProduct]                          what's available

hs6 may be given with or without dots ("1702.20", "170220", "1702.20.40" all mean 170220).
"""

import json
import logging
import re
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

from app.models import CountryFacts, MarketEntry, Requirement

log = logging.getLogger("portage.explore.compliance")

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
AUTO_DIR = DATA_DIR / "auto"
INDEX_FILE = AUTO_DIR / "index.json"


class AutoProduct(BaseModel):
    hs6: str
    label: str
    category: str
    file: str
    as_of: str
    method: str = ""
    markets: list[str] = []


def normalize_hs6(hs: str) -> str:
    digits = re.sub(r"\D", "", hs or "")
    if len(digits) < 6:
        raise ValueError(f"not a 6-digit HS code: {hs!r}")
    return digits[:6]


@lru_cache(maxsize=1)
def _load() -> tuple[dict[str, AutoProduct], dict[str, dict[str, MarketEntry]]]:
    """index.json lists the product files; each file is a JSON list of MarketEntry rows. Validated once."""
    if not INDEX_FILE.exists():
        return {}, {}
    with INDEX_FILE.open(encoding="utf-8") as f:
        raw_index = json.load(f)
    products: dict[str, AutoProduct] = {}
    markets: dict[str, dict[str, MarketEntry]] = {}
    for hs6, meta in raw_index.items():
        rows_path = AUTO_DIR / meta["file"]
        with rows_path.open(encoding="utf-8") as f:
            rows = [MarketEntry.model_validate(r) for r in json.load(f)]
        by_cc = {m.country_code: m for m in rows}
        if len(by_cc) != len(rows):
            raise ValueError(f"{meta['file']}: duplicate country rows")
        products[hs6] = AutoProduct(hs6=hs6, markets=sorted(by_cc), **meta)
        markets[hs6] = by_cc
    return products, markets


@lru_cache(maxsize=1)
def country_facts() -> dict[str, CountryFacts]:
    with (DATA_DIR / "countries.json").open(encoding="utf-8") as f:
        return {c.country_code: c for c in (CountryFacts.model_validate(r) for r in json.load(f))}


def reload() -> None:
    """Drop the caches (tests, or after regenerating a data file)."""
    _load.cache_clear()
    country_facts.cache_clear()


def products() -> list[AutoProduct]:
    return list(_load()[0].values())


def product(hs6: str) -> AutoProduct | None:
    try:
        return _load()[0].get(normalize_hs6(hs6))
    except ValueError:
        return None


def auto_markets(hs6: str) -> list[MarketEntry]:
    try:
        return list(_load()[1].get(normalize_hs6(hs6), {}).values())
    except ValueError:
        return []


def auto_market(hs6: str, country_code: str) -> MarketEntry | None:
    try:
        return _load()[1].get(normalize_hs6(hs6), {}).get((country_code or "").upper())
    except ValueError:
        return None


LIVE_MARKETS = ("GB",)


def live_result(hs6: str, country_code: str):
    """The live lookup result (live_uk.LiveResult) for markets with a live official API, else None. Never raises."""
    if (country_code or "").upper() not in LIVE_MARKETS:
        return None
    try:
        hs = normalize_hs6(hs6)
        from app.explore.compliance import live_uk

        return live_uk.uk_requirements(hs)
    except Exception:
        log.warning("live lookup failed for %s/%s", hs6, country_code, exc_info=True)
        return None


def has_auto_data(hs6: str, country_code: str) -> bool:
    return live_result(hs6, country_code) is not None or auto_market(hs6, country_code) is not None


def auto_requirements(hs6: str, country_code: str) -> list[Requirement]:
    """Auto-sourced requirements for one product (HS6) and market (ISO alpha-2). [] when we have no data."""
    live = live_result(hs6, country_code)
    if live is not None:
        return [r.model_copy() for r in live.requirements]
    entry = auto_market(hs6, country_code)
    if entry is None:
        return []
    return [r.model_copy() for r in entry.compliance_requirements]
