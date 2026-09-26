"""Response shapes for GET /api/more-markets (ranking-only markets, never verified)."""

from typing import Literal

from pydantic import BaseModel

from app.models import OpportunityFacts

NOT_VERIFIED = "Not verified: confirm with the Trade Commissioner Service"


class MoreTariff(BaseModel):
    status: Literal["ok", "mfn_only", "unavailable", "pending"]
    applied: float | None = None       # fraction (0.05 = 5%); None when unavailable
    mfn: float | None = None
    year: int | None = None            # TRAINS year the rate comes from
    agreement: str | None = None       # set only when TRAINS records a preference for Canada below MFN
    note: str = ""
    origin: str = ""                   # cache | live | pending | error | mixed
    fetched: str = ""                  # date the figure was fetched from the source (YYYY-MM-DD)
    sources: list[str] = []


class MoreMarket(BaseModel):
    country_code: str
    country: str
    agreement_in_force: str | None     # the agreement a preference for Canada would come from (None: no FTA)
    tariff: MoreTariff
    tariff_barrier: float | None = None  # the engine's normalize_tariff (0 = no tariff, 1 = 50%+), for context only
    opportunity: float | None = None   # engine's score_opportunity, 0-100
    opportunity_components: dict[str, float | None] = {}  # None = input unavailable (engine drops it)
    opportunity_facts: OpportunityFacts | None = None
    opportunity_status: Literal["ok", "pending", "unavailable"] = "unavailable"
    opportunity_note: str = ""
    ease: None = None                  # never scored: see ease_note
    overall: None = None
    ease_note: str = ""
    compliance_confidence: Literal["unknown"] = "unknown"
    verified: Literal[False] = False
    badge: str = NOT_VERIFIED
    sources: list[str] = []


class MoreMarketsResponse(BaseModel):
    hs6: str
    description: str
    category: str | None = None
    as_of: str
    trade_year: int
    base_year: int
    pending: bool = False
    scale_note: str
    notes: list[str] = []
    markets: list[MoreMarket]
