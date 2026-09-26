"""Request/response shapes for /api/explore/lookup (lab only; the shared contract in app/models.py is untouched)."""

from typing import Literal

from pydantic import BaseModel, Field

from app.models import AnalyzeResponse, Confidence, ScoredMarket, SortBy, Weights

ClassifiedBy = Literal["llm", "keyword", "user"]


class ClassifyRequest(BaseModel):
    description: str = Field(min_length=3, max_length=2000)


class HSCandidate(BaseModel):
    hs6: str
    description: str
    reason: str = ""
    source: ClassifiedBy


class ClassifyResponse(BaseModel):
    candidates: list[HSCandidate]
    mode: Literal["llm", "offline"]
    catalog: Literal["comtrade", "seed"] = Field(description="Which HS6 list the codes were validated against")


class LookupRankRequest(BaseModel):
    hs6: str = Field(pattern=r"^\d{4}\.?\d{2}$")
    description: str = Field("", max_length=2000, description="The founder's own words, for display only")
    classified_by: ClassifiedBy = "user"
    sort_by: SortBy = "overall"
    prize_weight: float = Field(0.5, ge=0, le=1)
    weights: Weights | None = None


class MarketDataStatus(BaseModel):
    country_code: str
    scored: bool = Field(description="False when the tariff is unavailable: the market is listed last, unscored")
    tariff: str = Field(description="ok | mfn_only | pending | unavailable")
    tariff_origin: str = Field(description="cache | live | pending | error | mixed")
    tariff_year: int | None = None
    section338: str = Field("", description="US only: listed | not_listed | unknown")
    trade: str = Field(description="ok | pending | unavailable")
    compliance_confidence: Confidence
    message: str = ""


class ProductBlock(BaseModel):
    hs6: str
    description: str
    founder_description: str = ""
    classified_by: ClassifiedBy
    catalog: str
    trade_year: int
    base_year: int
    tariff_source: str = "WITS / UNCTAD TRAINS (aveestimated)"
    trade_source: str = "UN Comtrade public preview API"
    fetched: dict[str, int] = Field(default_factory=dict, description="How many source calls came from cache / live / pending / error")
    pending: bool = Field(False, description="Some data is still loading in the background: ask again shortly")
    as_of: str


class LookupRankResponse(BaseModel):
    product: ProductBlock
    markets: list[ScoredMarket]
    data_status: list[MarketDataStatus]
    opportunity_available: bool
    notes: list[str] = Field(default_factory=list)


class LookupAnalyze(BaseModel):
    """What /api/analyze adds when the product isn't a curated category: the HS code it picked (and the
    alternatives the founder can switch to), per-market data status and notes."""

    product: ProductBlock
    candidates: list[HSCandidate]
    classify_mode: Literal["llm", "offline"]
    data_status: list[MarketDataStatus]
    notes: list[str] = Field(default_factory=list)


class AnalyzeWithLookup(AnalyzeResponse):
    lookup: LookupAnalyze | None = Field(None, description="Set only for the any-product path; null for curated products")
