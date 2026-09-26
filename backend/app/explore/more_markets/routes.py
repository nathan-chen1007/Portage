"""GET /api/more-markets: 8 extra markets as ranking-only (tariffs + trade data, compliance not verified)."""

import logging

from fastapi import APIRouter, HTTPException, Query

from app.explore.lookup import hs
from app.explore.more_markets import service
from app.explore.more_markets.markets import CATEGORY_HS6
from app.explore.more_markets.schemas import MoreMarketsResponse

log = logging.getLogger("portage.explore.more_markets")

router = APIRouter()


@router.get("/api/more-markets", response_model=MoreMarketsResponse)
def more_markets(hs6: str | None = Query(None, max_length=12), category: str | None = Query(None, max_length=40),
                 refresh: bool = False) -> MoreMarketsResponse:
    """?category=honey|icewine or ?hs6=<code>. Failed lookups degrade per market; bad input is a 422, never a 500."""
    if category is not None:
        code = CATEGORY_HS6.get(category.strip().lower())
        if code is None:
            raise HTTPException(422, f"Unknown category '{category}': use one of {', '.join(CATEGORY_HS6)}, or ?hs6=")
    elif hs6 is not None:
        code = hs.normalize(hs6)
        if not hs.is_valid(code):
            raise HTTPException(422, f"HS {hs6} isn't in the HS6 list")
    else:
        raise HTTPException(422, "Pass ?category=honey|icewine or ?hs6=<6-digit HS code>")
    try:
        return service.more_markets(code, category=category, refresh=refresh)
    except Exception as e:  # never a bare 500
        log.exception("more-markets failed for %s", code)
        raise HTTPException(502, f"More markets unavailable: {e}")
