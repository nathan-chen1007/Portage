"""EXPERIMENTAL routes, mounted under /api/explore/compliance when EXPERIMENTAL=1 (see app/explore/__init__.py).

GET /api/explore/compliance/                         products with auto-sourced data
GET /api/explore/compliance/{hs6}/rank               every market for the product, scored by the curated engine
GET /api/explore/compliance/{hs6}/{country_code}     one market's requirements, each badged with its confidence
"""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.engine.opportunity import overall_score
from app.engine.scoring import score_market
from app.explore.compliance import service
from app.models import Confidence, MarketEntry, Requirement, ScoredMarket

router = APIRouter()

TCS_URL = "https://www.tradecommissioner.gc.ca/"

# A market with no sourced requirements must not look easy (no requirements = zero compliance friction). For
# ranking only, stand in a typical burden (an approval + a registration, 8 weeks), badged "unknown". Same rule as
# lab C's lookup (app/explore/lookup/compliance.py), so the two views agree.
UNKNOWN_PLACEHOLDERS = [
    Requirement(name="Import requirements not verified (assumed: a government approval or certificate)", tier=3,
                detail="No sourced requirements for this product and market, so we assume a typical burden rather "
                       "than none. Confirm with the Trade Commissioner Service.",
                source=TCS_URL, lead_time_weeks=8, lead_time_basis="estimate", confidence="unknown"),
    Requirement(name="Registration not verified (assumed: registering with a foreign regulator)", tier=2,
                detail="Placeholder so an unverified market doesn't look easier than a sourced one.",
                source=TCS_URL, lead_time_weeks=4, lead_time_basis="estimate", confidence="unknown"),
]


class MarketCompliance(BaseModel):
    hs6: str
    country_code: str
    confidence: Confidence = Field(description="auto_sourced when we have data, unknown otherwise")
    status: Literal["open", "blocked", "unknown"]
    status_note: str = ""
    requirements: list[Requirement]
    sources: list[str]
    next_step: str = Field("", description="What the founder should do when we have no data")
    market: MarketEntry | None = None


@router.get("/")
def list_products() -> list[service.AutoProduct]:
    return service.products()


@router.get("/{hs6}/rank")
def rank(hs6: str, sort_by: Literal["overall", "friction"] = Query("overall")) -> list[ScoredMarket]:
    """Score every auto-sourced market for the product with the same engine as honey (no opportunity data yet,
    so overall = ease = 100 - friction and the two sorts agree). Blocked markets come last. Markets without
    sourced requirements are scored with UNKNOWN_PLACEHOLDERS so they don't look artificially easy."""
    entries = service.auto_markets(hs6)
    if not entries:
        raise HTTPException(404, f"No auto-sourced compliance data for HS {hs6}")
    facts = service.country_facts()
    scored = []
    for e in entries:
        if e.status == "open" and not e.compliance_requirements:
            e = e.model_copy(update={"compliance_requirements": [r.model_copy() for r in UNKNOWN_PLACEHOLDERS],
                                     "compliance_confidence": "unknown"})
        s = score_market(e, None, facts.get(e.country_code))
        if s.status == "open":
            s.overall = overall_score(None, s.score)
        scored.append(s)
    scored.sort(key=lambda s: (1, 0.0, s.country) if s.status == "blocked" else (0, s.score, s.country))
    for i, s in enumerate(scored, start=1):
        s.rank = i
    return scored


@router.get("/{hs6}/{country_code}")
def market_compliance(hs6: str, country_code: str) -> MarketCompliance:
    try:
        hs = service.normalize_hs6(hs6)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    cc = country_code.upper()
    entry = service.auto_market(hs, cc)
    if entry is None:
        return MarketCompliance(
            hs6=hs, country_code=cc, confidence="unknown", status="unknown", requirements=[], sources=[TCS_URL],
            next_step="We don't have sourced requirements for this product and market yet. Ask the Trade "
                      "Commissioner Service (free) before you ship.")
    return MarketCompliance(hs6=hs, country_code=cc, confidence=entry.compliance_confidence, status=entry.status,
                            status_note=entry.status_note, requirements=entry.compliance_requirements,
                            sources=entry.sources, market=entry)
