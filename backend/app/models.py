"""Shared data shapes: the contract between the data files, the scoring engine, the API and the frontend.

Mirrored in TypeScript by docs/contract/api.ts (copy to frontend/lib/api.ts). Change both together.
"""

from typing import Literal

from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator

Component = Literal["tariff", "compliance", "logistics", "risk", "tax"]
Basis = Literal["official", "estimate"]
MarketStatus = Literal["open", "blocked"]


# ---------- curated data (data/*.json) ----------

class Category(BaseModel):
    id: str
    label: str
    kind: Literal["goods", "services"]
    hs_code: str | None = None
    description: str
    examples: list[str] = Field(default_factory=list)


class Requirement(BaseModel):
    """One compliance/regulatory step a market imposes.

    tier: 1 = paperwork or self-declaration (a label, an origin statement)
          2 = registering with a foreign regulator, a government certificate, or appointing a local representative
          3 = government approval, licence or third-party audit with a long lead time
    """

    name: str
    tier: int = Field(ge=1, le=3)
    detail: str
    source: str
    lead_time_weeks: float = Field(0, ge=0, le=104, description="Weeks this step adds before the FIRST shipment can leave (0 = done per shipment, no wait)")
    lead_time_basis: Basis = Field("estimate", description="'official' = a stated deadline or service standard in the source; 'estimate' = our judgment, flagged in the UI")


class MarketEntry(BaseModel):
    """One (category, target country) row in data/markets.json. Fields that don't apply are zero or empty."""

    category: str
    country: str
    country_code: str = Field(min_length=2, max_length=2)
    language: str = Field(description="ISO 639-1 code of the main business language, used for the voice note")
    status: MarketStatus = Field("open", description="'blocked' = no legal way to export this product there right now")
    status_note: str = Field("", description="Why the market is blocked (shown instead of a score)")
    tariff_rate: float = Field(ge=0, le=5, description="Applied tariff for a Canadian exporter, as a fraction (0.5 = 50%)")
    mfn_rate: float = Field(0.0, ge=0, le=5, description="Rate without any trade agreement, for the 'what the FTA saves you' line")
    tariff_note: str = ""
    trade_agreement: str | None = None
    compliance_requirements: list[Requirement] = Field(default_factory=list)
    lpi_customs_score: float | None = Field(None, ge=1, le=5, description="World Bank LPI customs efficiency, 1 (worst) to 5 (best); null for services")
    tax_burden: float = Field(0.0, ge=0, le=1, description="0 = no tax registration for the Canadian seller, 0.5 = above thresholds, 1 = from the first sale")
    tax_note: str = ""
    sea_distance_nm: float | None = Field(None, ge=0, description="Sea distance from the best Canadian gateway port, nautical miles (0 = land border); null for services")
    weekly_sailings: float | None = Field(None, ge=0, description="Container departures per week on that lane (land border ~ daily trucking = 7); null for services")
    shipping_route: str = Field("", description="Human-readable lane, e.g. 'Vancouver → Yokohama, ~11 days, direct'")
    shipping_source: str | None = None
    notes: list[str] = Field(default_factory=list)
    sources: list[str] = Field(min_length=1)
    as_of: str

    @field_validator("sources")
    @classmethod
    def _urls(cls, v: list[str]) -> list[str]:
        for s in v:
            if not s.startswith("https://"):
                raise ValueError(f"source must be an https URL: {s}")
        return v

    @model_validator(mode="after")
    def _blocked_needs_reason(self):
        if self.status == "blocked" and not self.status_note:
            raise ValueError(f"{self.country}: a blocked market needs a status_note")
        return self


class CountryFacts(BaseModel):
    """Country-level risk facts (data/countries.json), shared by every category."""

    country_code: str = Field(min_length=2, max_length=2)
    currency: str
    fx_volatility: float = Field(ge=0, le=1, description="Annualized volatility of the currency against CAD (fraction, 0.06 = 6%)")
    fx_note: str = ""
    fx_source: str
    country_risk: int = Field(ge=0, le=7, description="OECD country risk category, 0 (lowest: high-income OECD / euro area) to 7")
    country_risk_source: str
    as_of: str


class Middleman(BaseModel):
    """A real company (or government service) that can get the product into the market."""

    id: str
    category: str = Field(description="category id, or '*' for all")
    country_code: str = Field(description="ISO alpha-2, or '*' for all")
    name: str
    type: str
    description: str
    website: str
    contact: str
    source: str


# ---------- scoring ----------

class Weights(BaseModel):
    """How much each blocker counts toward the friction score. Normalized, so they needn't sum to 1.

    Rationale (see docs/SCORING.md):
    tariff 0.35      a direct, unrecoverable cost on every unit sold
    compliance 0.30  paperwork and approvals, plus the weeks you wait before the first sale
    logistics 0.15   distance, how often ships sail, and how smoothly customs clears
    risk 0.10        currency swings against CAD and the risk of not getting paid
    tax 0.10         having to register for and collect tax yourself
    """

    tariff: float = Field(0.35, ge=0)
    compliance: float = Field(0.30, ge=0)
    logistics: float = Field(0.15, ge=0, validation_alias=AliasChoices("logistics", "customs"))
    risk: float = Field(0.10, ge=0)
    tax: float = Field(0.10, ge=0)


class ScoredMarket(BaseModel):
    country: str
    country_code: str
    status: MarketStatus
    status_note: str = ""
    score: float | None = Field(description="Friction 0-100, lower = easier. null when the market is blocked")
    rank: int = Field(description="1 = easiest. Blocked markets come after every open market")
    components: dict[Component, float] = Field(description="Each blocker normalized to 0-1, before weighting. Empty if blocked")
    factors: dict[str, float] = Field(default_factory=dict, description="The sub-scores (0-1) behind each component, for the 'why this score' view. Empty if blocked")
    breakdown: dict[Component, float] = Field(description="Each blocker's weighted points (sums to score). Empty if blocked")
    top_blocker: Component | None = Field(description="The component contributing most, or null if the score is ~0 or blocked")
    lead_time_weeks: float = Field(0, description="Weeks before the first legal shipment (longest single step; steps run in parallel)")
    lead_time_estimated: bool = Field(False, description="True if that longest step is our estimate rather than an official figure")
    entry: MarketEntry
    country_facts: CountryFacts | None = Field(None, description="Currency and payment-risk facts for this country")
    middlemen: list[Middleman] = Field(default_factory=list)


# ---------- API requests / responses ----------

class BusinessProfile(BaseModel):
    """What the agent extracts from the founder's description. Everything optional except the basics."""

    company_name: str = ""
    product_name: str = ""
    product_summary: str = ""
    category: str = Field("", description="a category id, or 'unsupported'")
    category_reason: str = ""
    city: str = ""
    province: str = ""
    selling_points: list[str] = Field(default_factory=list)
    contact_name: str = ""
    contact_email: str = ""
    website: str = ""
    business_number: str = ""


class AnalyzeRequest(BaseModel):
    description: str = Field(min_length=10, max_length=4000)


class AnalyzeResponse(BaseModel):
    profile: BusinessProfile
    category: Category | None
    markets: list[ScoredMarket]
    mode: Literal["llm", "offline"] = Field(description="'offline' = keyword fallback because no LLM key is set")


class RankRequest(BaseModel):
    category: str
    weights: Weights | None = None


class DocumentRequest(BaseModel):
    profile: BusinessProfile
    country_code: str


class DocumentDraft(BaseModel):
    id: str
    title: str
    purpose: str
    body: str = Field(description="The filled draft as plain text; blanks the founder must complete look like [___]")
    missing_fields: list[str] = Field(default_factory=list)
    source: str


class OutreachRequest(BaseModel):
    profile: BusinessProfile
    country_code: str
    middleman_id: str


class OutreachDraft(BaseModel):
    subject: str
    body: str
    language: str


class VoiceRequest(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    language: str = Field(description="ISO 639-1 target language, e.g. 'ja'")


class VoiceResponse(BaseModel):
    script: str = Field(description="The spoken script in the target language")
    language: str
    audio_base64: str = Field(description="MP3 audio, base64-encoded")
