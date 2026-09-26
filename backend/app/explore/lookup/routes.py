"""/api/explore/lookup/* — any-product mode (lab only, mounted when EXPERIMENTAL=1)."""

import logging

from fastapi import APIRouter, HTTPException, Query

from app.explore.lookup import classify as classifier
from app.explore.lookup import hs, service
from app.explore.lookup.schemas import ClassifyRequest, ClassifyResponse, HSCandidate, LookupRankRequest, LookupRankResponse

log = logging.getLogger("portage.explore.lookup")

router = APIRouter()


@router.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest) -> ClassifyResponse:
    """Founder's description -> up to 5 HS6 candidates, each validated against the HS6 list."""
    candidates, mode = classifier.classify(req.description)
    return ClassifyResponse(candidates=[HSCandidate(**c) for c in candidates], mode=mode, catalog=hs.catalog_source())


@router.get("/search", response_model=list[HSCandidate])
def search(q: str = Query(min_length=2, max_length=200)) -> list[HSCandidate]:
    """Keyword or code-prefix search over the HS6 list, for 'not quite: switch code'."""
    return [HSCandidate(hs6=c, description=d, source="user") for c, d in hs.search(q, limit=12)]


@router.post("/rank", response_model=LookupRankResponse)
def rank(req: LookupRankRequest, refresh: bool = False) -> LookupRankResponse:
    """Every market for one HS6 code, scored by the curated engine. Sources that fail or are slow degrade that
    market ('tariff unavailable', 'still loading'); the request itself doesn't fail."""
    if not hs.is_valid(req.hs6):
        raise HTTPException(422, f"HS {req.hs6} isn't in the HS6 list: pick a code from /classify or /search")
    try:
        return service.rank(req, refresh=refresh)
    except ValueError as e:  # e.g. all-zero weights
        raise HTTPException(422, str(e))
    except Exception as e:  # never a bare 500 from the lab
        log.exception("lookup rank failed for %s", req.hs6)
        raise HTTPException(502, f"Lookup failed: {e}")


@router.get("/cached")
def cached() -> list[dict]:
    """Products whose data is fully cached (safe for the stage demo: no live call can stall)."""
    return service.cached_products()
