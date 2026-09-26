"""Build in-memory MarketEntry rows for any HS6 code and rank them with the unchanged engine."""

import logging
from datetime import date
from functools import lru_cache
from pathlib import Path

from app.engine.scoring import Catalog, load_catalog, rank_markets
from app.explore.lookup import compliance, hs, sources, tariffs, trade
from app.explore.lookup.markets import MARKETS
from app.explore.lookup.schemas import LookupRankRequest, LookupRankResponse, MarketDataStatus, ProductBlock
from app.models import Category, MarketEntry, ScoredMarket

log = logging.getLogger("portage.explore.lookup")

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
LANE_CATEGORY = "honey"  # shipping lanes, LPI and languages are per country: reuse the curated goods rows
TAX_NOTE = "Assumes you sell through an importer, who handles import VAT/GST; not checked for this product."


@lru_cache(maxsize=1)
def base_catalog() -> Catalog:
    return load_catalog(DATA_DIR)


def category_id(hs6: str) -> str:
    return f"hs{hs6}"


def _entry(hs6: str, cc: str, lane: MarketEntry, tr: tariffs.TariffResult, reqs, conf, today: str,
           curated_block: MarketEntry | None = None) -> MarketEntry:
    notes = [tr.note] if tr.note else []
    if conf == "unknown":
        notes.append(compliance.UNKNOWN_MESSAGE + ".")
    notes.append("Shipping lane, sailings and customs (LPI) are per country, reused from our curated lane data.")
    if curated_block is not None:
        notes.append(f"Verified (curated) data: {curated_block.status_note}")
    srcs = [s for s in tr.sources if s.startswith("https://")] + [r.source for r in reqs if r.source.startswith("https://")]
    if lane.shipping_source:
        srcs.append(lane.shipping_source)
    return MarketEntry(
        category=category_id(hs6), country=lane.country, country_code=cc, language=lane.language,
        status="blocked" if curated_block else "open", status_note=curated_block.status_note if curated_block else "",
        compliance_confidence=conf, tariff_rate=tr.applied if tr.usable else 0.0, mfn_rate=tr.mfn if tr.usable else 0.0,
        tariff_note=tr.note, trade_agreement=tr.agreement, compliance_requirements=reqs,
        lpi_customs_score=lane.lpi_customs_score, tax_burden=0.0, tax_note=TAX_NOTE,
        sea_distance_nm=lane.sea_distance_nm, weekly_sailings=lane.weekly_sailings, shipping_route=lane.shipping_route,
        shipping_source=lane.shipping_source, notes=notes, sources=list(dict.fromkeys(srcs)) or [compliance.TCS_URL],
        as_of=today,
    )


def curated_category(hs6: str, base: Catalog) -> Category | None:
    """A curated demo category with this HS code (honey = 0409.00), whose verified data outranks ours."""
    return next((c for c in base.categories.values() if c.hs_code and hs.normalize(c.hs_code) == hs6), None)


def _unscored(entry: MarketEntry, message: str, base: Catalog) -> ScoredMarket:
    return ScoredMarket(country=entry.country, country_code=entry.country_code, status="open", status_note=message,
                        score=None, opportunity=None, overall=None, rank=0, components={}, factors={}, breakdown={},
                        top_blocker=None, entry=entry, country_facts=base.countries.get(entry.country_code))


def rank(req: LookupRankRequest, timeout: float | None = None, refresh: bool = False) -> LookupRankResponse:
    hs6 = hs.normalize(req.hs6)
    base = base_catalog()
    today = date.today().isoformat()
    description = hs.describe(hs6) or f"HS {hs6}"
    notes: list[str] = []
    if not hs.is_valid(hs6):
        notes.append(f"HS {hs6} is not in our HS6 list ({hs.catalog_source()}); results may be empty.")

    jobs = {**trade.jobs_for(hs6), **tariffs.jobs_for(hs6)}  # Comtrade first: fast, and not stuck behind WITS
    fetched = sources.fetch_many(jobs, timeout=timeout, refresh=refresh)
    counts: dict[str, int] = {}
    for _, origin in fetched.values():
        counts[origin] = counts.get(origin, 0) + 1

    tariff_results = tariffs.tariffs_for(hs6, fetched)
    cat_id = category_id(hs6)
    try:
        ct, trade_status, trade_note = trade.build(hs6, cat_id, description, fetched)
    except Exception as e:  # malformed source data: rank on friction alone
        log.warning("trade data for %s unusable: %s", hs6, e)
        ct, trade_status, trade_note = None, {cc: "unavailable" for cc in MARKETS}, "Opportunity unavailable: trade data unusable."
    if trade_note:
        notes.append(trade_note)

    curated = curated_category(hs6, base)
    if curated:
        notes.append(f"Portage has verified data for {curated.label.lower()}: the main app's ranking is the one to trust. "
                     "Markets it marks closed are shown closed here too.")

    scoreable: list[MarketEntry] = []
    unscored: list[ScoredMarket] = []
    status_rows: list[MarketDataStatus] = []
    for cc in MARKETS:
        lane = base.market(LANE_CATEGORY, cc)
        tr = tariff_results[cc]
        try:
            reqs, conf, _ = compliance.requirements_for(hs6, cc)
            verified = base.market(curated.id, cc) if curated else None
            block = verified if verified is not None and verified.status == "blocked" else None
            entry = _entry(hs6, cc, lane, tr, reqs, conf, today, block)
        except Exception as e:  # one broken market never breaks the ranking
            log.exception("lookup: building %s/%s failed", hs6, cc)
            conf, entry = "unknown", None
            tr = tariffs.TariffResult("unavailable", "error", note=f"Market data could not be assembled: {e}")
        message = compliance.UNKNOWN_MESSAGE if conf == "unknown" else ""
        if entry is not None and (tr.usable or entry.status == "blocked"):
            scoreable.append(entry)
            if entry.status == "blocked":
                message = entry.status_note
        elif entry is not None:
            unscored.append(_unscored(entry, tr.note, base))
            message = tr.note
        status_rows.append(MarketDataStatus(
            country_code=cc, scored=entry is not None and tr.usable and entry.status == "open", tariff=tr.status, tariff_origin=tr.origin,
            tariff_year=tr.year, section338=tr.section338, trade=trade_status.get(cc, "unavailable"),
            compliance_confidence=conf, message=message))

    cat = Category(id=cat_id, label=description[:120], kind="goods", hs_code=f"{hs6[:4]}.{hs6[4:]}", description=description)
    sub = Catalog(categories={cat_id: cat}, markets=scoreable,
                  middlemen=[m for m in base.middlemen if m.category == "*"],
                  countries=base.countries, trade={cat_id: ct} if ct else {})
    ranked = rank_markets(cat_id, sub, req.weights, req.sort_by, req.prize_weight) if scoreable else []
    for m in ranked:  # a market with no trade row gets overall = ease: say so
        if ct and m.opportunity is None:
            m.entry.notes.append("No import data for this market: its overall score is ease only.")
    unscored.sort(key=lambda s: s.country)
    for i, s in enumerate(unscored, start=len(ranked) + 1):
        s.rank = i
    if any(r.compliance_confidence == "unknown" for r in status_rows):
        notes.append("Markets marked 'Compliance not verified' carry an assumed typical compliance burden, not zero. "
                     "Confirm requirements with the Trade Commissioner Service before shipping.")

    pending = counts.get("pending", 0) > 0
    if pending:
        notes.append("Some sources are still loading in the background; ask again in a minute for the full picture.")
    product = ProductBlock(hs6=hs6, description=description, founder_description=req.description,
                           classified_by=req.classified_by, catalog=hs.catalog_source(), trade_year=trade.YEAR,
                           base_year=trade.BASE_YEAR, fetched=counts, pending=pending, as_of=today)
    return LookupRankResponse(product=product, markets=ranked + unscored, data_status=status_rows,
                              opportunity_available=ct is not None, notes=notes)


def cached_products() -> list[dict]:
    """HS6 codes with a complete cache (every tariff and trade call answered): safe to show on stage."""
    keys_by_hs6: dict[str, set[str]] = {}
    if not sources.CACHE_DIR.exists():
        return []
    for p in sources.CACHE_DIR.glob("*.json"):
        parts = p.stem.split("-")
        if len(parts) >= 3 and parts[0] in ("tariff", "trade") and parts[1].isdigit():
            keys_by_hs6.setdefault(parts[1], set()).add(p.stem)
    out = []
    for code, keys in sorted(keys_by_hs6.items()):
        needed = {*tariffs.jobs_for(code), *trade.jobs_for(code)}
        have = {k for k in needed & keys if sources.read_cache(k) is not None}  # current-version records only
        out.append({"hs6": code, "description": hs.describe(code) or f"HS {code}", "complete": needed <= have,
                    "cached": len(have), "needed": len(needed)})
    return out
