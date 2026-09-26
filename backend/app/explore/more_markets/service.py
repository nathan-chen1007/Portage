"""Tariffs + trade data for the 8 extra markets, scored for opportunity with the unchanged engine.

Reuses the any-product lookup's source functions read-only (WITS URL + parser, Comtrade URL + parser, HTTP
helper). Nothing here is added to the main ranking: these markets have no verified compliance, shipping or
country-risk data, so they get NO ease or overall score (an ease built on missing data would look easier than a
verified market). What they get: the applied tariff for Canada with its source and year, and the opportunity
score (market size, price after tariff, growth, Canada's foothold), which says nothing about how hard entry is.
"""

import logging
from datetime import date

from app.engine.opportunity import score_opportunity
from app.engine.scoring import normalize_tariff
from app.explore.lookup import hs, sources, tariffs, trade
from app.explore.lookup.markets import CANADA_COMTRADE, CANADA_WITS
from app.explore.more_markets import eu_rules, fetch
from app.explore.more_markets.markets import EXTRA_MARKETS, ExtraMarket
from app.explore.more_markets.schemas import VERIFIED, MoreMarket, MoreMarketsResponse, MoreTariff
from app.models import CategoryTrade, MarketEntry, MarketTrade

log = logging.getLogger("portage.explore.more_markets")

TCS_URL = "https://www.tradecommissioner.gc.ca/"
EASE_NOTE = ("No ease score: compliance, shipping and country risk aren't verified for this market, and a score "
             "built on missing data would look easier than it is. Confirm with the Trade Commissioner Service.")
EASE_NOTE_EU = ("No ease score: the requirements are verified (EU rules, same as Germany), but shipping and country "
                "risk aren't, and this section is not part of the Recommended ranking.")
FALLBACK_YEAR = trade.YEAR - 1  # some markets (e.g. Vietnam, UAE) haven't reported the latest year to UN Comtrade yet
SCALE_NOTE = ("Tariffs and trade data only. The opportunity score (0-100) measures market size, price after tariff, "
              "growth and Canada's current share (UN Comtrade). It is not a recommendation and can't be compared "
              "with the Recommended ranking above: these markets have no ease or overall score.")


# ---------- jobs (cache key -> fetch function returning (payload, url)) ----------

def specific_duty_since(doc: dict | None, year: int) -> int | None:
    """The latest year AFTER `year` in which every tariff line is non-ad-valorem with no estimate (parse_wits skips
    those years), or None. When set, the older percentage is out of date: the market has moved to a specific duty."""
    try:
        obs = next(iter(doc["dataSets"][0]["series"].values()))["observations"]
        years = [v["id"] for v in doc["structure"]["dimensions"]["observation"][0]["values"]]
        attrs = doc["structure"]["attributes"]["observation"]
    except (KeyError, IndexError, TypeError, StopIteration):
        return None
    names = [a.get("id") for a in attrs]

    def attr(row, name):
        if name not in names:
            return None
        i = names.index(name)
        idx = row[i + 1] if i + 1 < len(row) else None
        vals = attrs[i].get("values", [])
        return vals[idx]["id"] if isinstance(idx, int) and 0 <= idx < len(vals) else None

    latest = None
    for k, row in obs.items():
        try:
            y = int(years[int(k)])
            total, na = float(attr(row, "TOTALNOOFLINES") or 0), float(attr(row, "NBR_NA_LINES") or 0)
        except (ValueError, IndexError, TypeError):
            continue
        if y > year and total and na >= total and (latest is None or y > latest):
            latest = y
    return latest


def _tariff_job(reporter: str, partner: str, hs6: str):
    def run():
        url = ""
        for datatype in tariffs.DATATYPES[partner]:
            url = tariffs.wits_url(reporter, partner, hs6, datatype)
            try:
                doc = sources.http_get_json(url)
            except sources.NoRecords:
                doc = None
            parsed = tariffs.parse_wits(doc)
            if parsed:
                since = specific_duty_since(doc, parsed["year"])
                if since:
                    parsed["specific_since"] = since
                return parsed, url
        return None, url
    return run


def _trade_job(u: str):
    return lambda: (trade.parse(sources.http_get_json(u)), u)


def tariff_key(hs6: str, m: ExtraMarket, kind: str) -> str:
    return f"tariff-{hs6}-{m.wits}-{kind}"  # FR/NL/IT share the EU's one tariff (reporter 918): one call


def trade_key(hs6: str, cc: str, year: int) -> str:
    return f"trade-{hs6}-{cc}-M-{year}"


def canada_key(hs6: str) -> str:
    return f"trade-{hs6}-CA-X-{trade.YEAR}"


def jobs_for(hs6: str) -> dict:
    jobs = {canada_key(hs6): _trade_job(trade.url(CANADA_COMTRADE, trade.YEAR, hs6, flow="X"))}
    for cc, m in EXTRA_MARKETS.items():
        jobs[trade_key(hs6, cc, trade.YEAR)] = _trade_job(trade.url(m.comtrade, trade.YEAR, hs6, partners=f"0,{CANADA_COMTRADE}"))
        jobs[trade_key(hs6, cc, FALLBACK_YEAR)] = _trade_job(trade.url(m.comtrade, FALLBACK_YEAR, hs6, partners=f"0,{CANADA_COMTRADE}"))
        jobs[trade_key(hs6, cc, trade.BASE_YEAR)] = _trade_job(trade.url(m.comtrade, trade.BASE_YEAR, hs6))
    for m in EXTRA_MARKETS.values():
        jobs[tariff_key(hs6, m, "mfn")] = _tariff_job(m.wits, "000", hs6)
        jobs[tariff_key(hs6, m, "pref")] = _tariff_job(m.wits, CANADA_WITS, hs6)
    return jobs


# ---------- tariffs ----------

def _pct(x: float) -> str:
    s = f"{x * 100:.1f}".rstrip("0").rstrip(".")
    return f"{s}%"


def combine_tariff(m: ExtraMarket, hs6: str, mfn: dict | None, pref: dict | None, origins: tuple[str, str],
                   fetched: str = "") -> MoreTariff:
    """The rate a Canadian exporter pays, from the two TRAINS answers (MFN and preferential for Canada)."""
    origin = origins[0] if origins[0] == origins[1] else "mixed"
    srcs = [tariffs.wits_url(m.wits, "000", hs6), tariffs.wits_url(m.wits, CANADA_WITS, hs6, "reported")]
    label = f" ({m.tariff_label})" if m.tariff_label else ""
    stale = [r for r in (mfn, pref) if r and r.get("specific_since")]
    mfn = None if mfn and mfn.get("specific_since") else mfn  # a percentage from before a switch to a specific
    pref = None if pref and pref.get("specific_since") else pref  # duty would read as "cheap": don't use it
    if stale and not mfn and not pref:
        since = max(r["specific_since"] for r in stale)
        return MoreTariff(status="unavailable", origin=origin, fetched=fetched, sources=srcs,
                          note=(f"Tariff unavailable as a percentage: since {since} WITS/TRAINS records only a specific "
                                f"(per-unit) duty for this product{label}, with no ad-valorem equivalent. The last "
                                f"percentage on record ({_pct(stale[0]['rate'])}, {stale[0]['year']}) is out of date."))
    fta = m.agreement
    if pref:
        applied, year, agreement = pref["rate"], pref["year"], None
        note = f"Rate for Canada {_pct(applied)} (WITS/TRAINS {year}){label}"
        if mfn and pref["rate"] < mfn["rate"]:
            agreement = fta or "preference on record"
            note += f", under {agreement}; {_pct(mfn['rate'])} without it"
        if mfn and mfn["year"] > pref["year"] and mfn["rate"] <= applied:  # newer MFN at or below the old preference
            below = mfn["rate"] < applied
            applied, year, agreement = mfn["rate"], mfn["year"], None
            note = (f"MFN rate {_pct(applied)} (WITS/TRAINS {year})"
                    + (" is now below the last recorded preference" if below else ", same as the last recorded preference")
                    + label)
        return MoreTariff(status="ok", applied=applied, mfn=mfn["rate"] if mfn else applied, year=year, agreement=agreement,
                          note=note + ". TRAINS lags: cuts since then are not reflected.", origin=origin, fetched=fetched,
                          sources=srcs)
    if mfn:
        extra = (f" If {fta} covers this product the real rate may be lower." if fta and mfn["rate"] > 0 else "")
        return MoreTariff(status="mfn_only", applied=mfn["rate"], mfn=mfn["rate"], year=mfn["year"],
                          note=f"MFN rate {_pct(mfn['rate'])} (WITS/TRAINS {mfn['year']}){label}. No preferential rate "
                               f"for Canada on record.{extra}", origin=origin, fetched=fetched, sources=srcs)
    pending = "pending" in origins
    return MoreTariff(status="pending" if pending else "unavailable", origin=origin, sources=srcs,
                      note="Tariff still loading from WITS: refresh in a minute." if pending else
                      "Tariff unavailable: WITS/TRAINS has no rate on record for this product and market.")


# ---------- assembling one market ----------

def _market(hs6: str, cc: str, m: ExtraMarket, got: dict, ca_world: dict | None, ca_origin: str, today: str) -> MoreMarket:
    mfn, o1, f1 = got.get(tariff_key(hs6, m, "mfn"), (None, "error", ""))
    pref, o2, f2 = got.get(tariff_key(hs6, m, "pref"), (None, "error", ""))
    tr = combine_tariff(m, hs6, mfn, pref, (o1, o2), max(f1, f2))
    tr.applied = None if tr.applied is None else min(tr.applied, tariffs.MAX_RATE)
    tr.mfn = None if tr.mfn is None else min(tr.mfn, tariffs.MAX_RATE)
    usable = tr.status in ("ok", "mfn_only")
    out = MoreMarket(country_code=cc, country=m.country, agreement_in_force=m.agreement, tariff=tr,
                     tariff_barrier=round(normalize_tariff(tr.applied), 3) if usable else None,
                     ease_note=EASE_NOTE, sources=[*tr.sources])

    year = trade.YEAR
    now, t1, _ = got.get(trade_key(hs6, cc, year), (None, "error", ""))
    t3 = ""
    if not (now or {}).get("0") and t1 in ("cache", "live"):  # latest year not reported yet: use the one before
        year = FALLBACK_YEAR
        now, t3, _ = got.get(trade_key(hs6, cc, year), (None, "error", ""))
    base, t2, _ = got.get(trade_key(hs6, cc, trade.BASE_YEAR), (None, "error", ""))
    world = (now or {}).get("0")
    trade_srcs = [trade.url(m.comtrade, year, hs6, partners=f"0,{CANADA_COMTRADE}"), trade.url(m.comtrade, trade.BASE_YEAR, hs6)]
    loading = "pending" in (t1, t2, t3, ca_origin)
    if not world or world["value_usd"] <= 0:
        out.opportunity_status = "pending" if loading else "unavailable"
        out.opportunity_note = ("Trade data still loading: refresh in a minute." if loading else
                                f"No {trade.YEAR} or {FALLBACK_YEAR} import figure in UN Comtrade for this market.")
        out.sources += trade_srcs
        return out
    if not ca_world:
        out.opportunity_status = "pending" if ca_origin == "pending" else "unavailable"
        out.opportunity_note = f"No Canadian {trade.YEAR} export price for HS {hs6} in UN Comtrade, so there's nothing to compare."
        out.sources += trade_srcs
        return out
    if not usable:
        out.opportunity_status = "pending" if tr.status == "pending" else "unavailable"
        out.opportunity_note = "Opportunity needs the tariff (price after duty); it isn't available for this market."
        out.sources += trade_srcs
        return out

    base_world = (base or {}).get("0") or {"value_usd": 0.0}
    from_ca = (now or {}).get(CANADA_COMTRADE) or {"value_usd": 0.0}
    caveats = []
    if year != trade.YEAR:
        caveats.append(f"{m.country} hasn't reported {trade.YEAR} imports to UN Comtrade yet: {year} figures are used.")
    if not base_world["value_usd"]:
        caveats.append(f"No {trade.BASE_YEAR} figure reported: growth counts as flat.")
    if world["kg"] <= 0:
        caveats.append(f"{m.country} reported no import weight for {year}, so there's no price per kg: the price "
                       "component is left out of the opportunity score.")
    mt = MarketTrade(country_code=cc, import_value_usd=world["value_usd"], import_volume_kg=max(world["kg"], 0.0),
                     import_value_base_usd=base_world["value_usd"], canada_value_usd=from_ca["value_usd"],
                     note=" ".join(caveats), sources=trade_srcs)
    ct = CategoryTrade(category=f"more-{hs6}", hs_code=hs6, year=year, base_year=trade.BASE_YEAR,
                       canada_export_value_usd=ca_world["value_usd"], canada_export_volume_kg=ca_world["kg"],
                       canada_export_source=trade.url(CANADA_COMTRADE, trade.YEAR, hs6, flow="X"), as_of=today, markets=[mt])
    entry = MarketEntry(category=ct.category, country=m.country, country_code=cc, language=m.language,
                        compliance_confidence="unknown", tariff_rate=tr.applied, mfn_rate=tr.mfn or 0.0,
                        tariff_note=tr.note, trade_agreement=tr.agreement, sources=tr.sources, as_of=today)
    out.opportunity, out.opportunity_components, out.opportunity_facts = score_opportunity(ct, mt, entry)
    out.opportunity_status = "ok"
    out.opportunity_note = mt.note
    out.sources += [s for s in out.opportunity_facts.sources if s not in out.sources]
    return out


def _degraded(cc: str, m: ExtraMarket, why: str) -> MoreMarket:
    return MoreMarket(country_code=cc, country=m.country, agreement_in_force=m.agreement,
                      tariff=MoreTariff(status="unavailable", note=f"Tariff unavailable: {why}"),
                      opportunity_note="Opportunity unavailable.", ease_note=EASE_NOTE, sources=[TCS_URL])


def more_markets(hs6: str, category: str | None = None, timeout: float | None = None, refresh: bool = False) -> MoreMarketsResponse:
    """Every extra market for one HS6 code. Never raises for a data problem: a market degrades on its own."""
    hs6 = hs.normalize(hs6)
    today = date.today().isoformat()
    notes: list[str] = []
    try:
        got = fetch.fetch_many(jobs_for(hs6), timeout=timeout, refresh=refresh)
    except Exception as e:  # e.g. an unwritable cache folder: everything degrades, the request still answers
        log.exception("more-markets fetch for %s failed", hs6)
        got, notes = {}, [f"Sources unavailable: {e}"]

    ca, ca_origin, _ = got.get(canada_key(hs6), (None, "error", ""))
    ca_world = (ca or {}).get("0")
    if not ca_world or ca_world.get("value_usd", 0) <= 0 or ca_world.get("kg", 0) <= 0:
        ca_world = None

    rows: list[MoreMarket] = []
    for cc, m in EXTRA_MARKETS.items():
        try:
            row = _market(hs6, cc, m, got, ca_world, ca_origin, today)
            reqs = eu_rules.requirements_for(hs6, cc)  # FR/NL/IT on a curated product: EU rules, same as Germany
            if reqs:
                row.requirements, row.compliance_confidence, row.verified = reqs, "verified", True
                row.badge, row.compliance_note = VERIFIED, eu_rules.EU_NOTE
                row.ease_note = EASE_NOTE_EU
                row.sources += [r.source for r in reqs if r.source not in row.sources]
            rows.append(row)
        except Exception as e:  # one broken market never breaks the section
            log.exception("more-markets: %s/%s failed", hs6, cc)
            rows.append(_degraded(cc, m, f"market data could not be assembled ({type(e).__name__})."))
    rows.sort(key=lambda r: (r.opportunity is None, -(r.opportunity or 0.0), r.country))

    pending = any(o == "pending" for _, o, _ in got.values())
    if pending:
        notes.append("Some sources are still loading in the background; refresh in a minute.")
    if any(r.tariff.agreement is None and r.agreement_in_force for r in rows if r.tariff.status == "mfn_only"):
        notes.append("Where TRAINS has no preference for Canada on record, the MFN rate is shown; CETA/CPTPP may lower it.")
    return MoreMarketsResponse(hs6=hs6, description=hs.describe(hs6) or f"HS {hs6}", category=category, as_of=today,
                               trade_year=trade.YEAR, base_year=trade.BASE_YEAR, pending=pending, scale_note=SCALE_NOTE,
                               notes=notes, markets=rows)


def cache_complete(hs6: str) -> bool:
    """Every call for this product answered and cached (safe for the stage demo: no live call)."""
    return all(fetch.read_cache(k) is not None for k in jobs_for(hs.normalize(hs6)))
