"""Compliance for an arbitrary product: session B's auto_requirements when available, else 'unknown'.

An unknown market must never look artificially easy: with no requirements it would score 0 compliance
friction, the best possible. So we stand in two clearly labelled placeholder requirements totalling tier 5
(an approval + a registration) and 8 weeks' lead time: roughly the median burden of our verified
honey markets (UK 3, US 5, China 5, Korea 6, EU 7 tier points). They carry confidence 'unknown', and the
UI badges the market "Compliance not verified — confirm with the Trade Commissioner Service".
"""

import logging

from app.explore.compliance import auto_requirements
from app.models import Confidence, MarketEntry, Requirement

log = logging.getLogger("portage.explore.lookup")

TCS_URL = "https://www.tradecommissioner.gc.ca/"
UNKNOWN_MESSAGE = "Compliance not verified — confirm with the Trade Commissioner Service"

PLACEHOLDERS = [
    Requirement(name="Import requirements not verified (assumed: a government approval or certificate)", tier=3,
                detail=("We have no verified or auto-sourced compliance data for this product here, so we assume a typical "
                        "burden rather than none. " + UNKNOWN_MESSAGE + "."),
                source=TCS_URL, lead_time_weeks=8, lead_time_basis="estimate", confidence="unknown"),
    Requirement(name="Registration not verified (assumed: registering with a foreign regulator)", tier=2,
                detail="Placeholder so an unverified market doesn't look easier than a verified one. " + UNKNOWN_MESSAGE + ".",
                source=TCS_URL, lead_time_weeks=4, lead_time_basis="estimate", confidence="unknown"),
]

_RANK = {"verified": 0, "auto_sourced": 1, "unknown": 2}


def requirements_for(hs6: str, country_code: str, verified: MarketEntry | None = None
                     ) -> tuple[list[Requirement], Confidence, str]:
    """(requirements, lowest confidence, source label: 'curated' | 'auto_requirements' | 'none').

    Precedence: verified (curated data for this product and market) > auto_sourced (auto_requirements: live UK
    or saved files) > unknown (labelled placeholders). Curated data is never overridden or mixed.
    """
    if verified is not None:
        return [r.model_copy() for r in verified.compliance_requirements], "verified", "curated"
    reqs: list[Requirement] = []
    try:
        reqs = [r if isinstance(r, Requirement) else Requirement.model_validate(r) for r in (auto_requirements(hs6, country_code) or [])]
    except Exception as e:  # a failing lookup degrades this market to "unknown", never a 500
        log.warning("auto_requirements(%s, %s) failed: %s", hs6, country_code, e)
        reqs = []
    if not reqs:
        return [r.model_copy() for r in PLACEHOLDERS], "unknown", "none"
    worst = max((r.confidence for r in reqs), key=lambda c: _RANK.get(c, 2))
    return reqs, worst, "auto_requirements"
