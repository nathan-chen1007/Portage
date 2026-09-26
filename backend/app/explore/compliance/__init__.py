"""Session B: auto-sourced compliance. See project doc claude/afhacks-lab-B.md.

Stable entry points for other code (session C's any-product lookup calls these):
    auto_requirements(hs6, country_code) -> list[Requirement]    [] when we have no data
    has_auto_data(hs6, country_code) -> bool                     tells "no data" (unknown) from "nothing applies"
    auto_market(hs6, country_code) -> MarketEntry | None
Data: backend/data/auto/index.json + <product>.json, built by app/explore/compliance/build.py from data/auto/raw/.
"""

from app.explore.compliance.service import auto_market, auto_markets, auto_requirements, has_auto_data

__all__ = ["auto_market", "auto_markets", "auto_requirements", "has_auto_data"]
