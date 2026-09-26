"""Tariffs a Canadian exporter faces, from WITS / UNCTAD TRAINS, per HS6 and market.

Two queries per market ('aveestimated' converts specific duties to an ad-valorem equivalent, so Korea's
honey duty shows as 243% rather than a meaningless 0; preferential rates are mostly stored as 'reported'):
  partner 000 (World)   -> the MFN rate, what you pay with no trade agreement
  partner 124 (Canada)  -> the preferential rate under an FTA, when TRAINS has one on record
The latest year with a usable value wins. TRAINS lags (often 2021-2023), so FTA phase-downs since then
are not reflected: every figure carries its year, and the UI shows it.

US: CBP's Section 338 list (Aug 21 2026) adds 50% on listed Canadian goods with no CUSMA exemption; see
section338.py. Unsure -> we say so rather than guess.
"""

from dataclasses import dataclass, field

from app.explore.lookup import section338, sources
from app.explore.lookup.markets import CANADA_WITS, MARKETS

WITS_URL = ("https://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN/reporter/{reporter}/partner/{partner}"
            "/product/{hs6}/year/ALL/datatype/{datatype}?format=JSON")
WITS_PAGE = "https://wits.worldbank.org/tariff/trains/en/country/{reporter}/partner/{partner}/product/{hs6}"
MAX_RATE = 5.0  # MarketEntry caps tariff_rate at 500%


def wits_url(reporter: str, partner: str, hs6: str, datatype: str = "aveestimated") -> str:
    return WITS_URL.format(reporter=reporter, partner=partner, hs6=hs6, datatype=datatype)


def parse_wits(doc: dict | None) -> dict | None:
    """Latest usable rate in a WITS SDMX-JSON answer: {rate (fraction), year, type}. None if nothing usable.

    Each observation is [value, attr0_index, attr1_index, ...] indexing into structure.attributes.observation.
    A year where every tariff line is non-ad-valorem with no estimate (NBR_NA_LINES == TOTALNOOFLINES)
    reports 0, which would read as duty-free: skip it.
    """
    if not doc:
        return None
    try:
        series = doc["dataSets"][0]["series"]
        if not series:
            return None
        obs = next(iter(series.values()))["observations"]
        years = [v["id"] for v in doc["structure"]["dimensions"]["observation"][0]["values"]]
        attrs = doc["structure"]["attributes"]["observation"]
    except (KeyError, IndexError, TypeError, StopIteration):
        return None
    names = [a.get("id") for a in attrs]

    def attr(row: list, name: str):
        if name not in names:
            return None
        i = names.index(name)
        idx = row[i + 1] if i + 1 < len(row) else None
        vals = attrs[i].get("values", [])
        return vals[idx]["id"] if isinstance(idx, int) and 0 <= idx < len(vals) else None

    best = None
    for k, row in obs.items():
        if not row or row[0] is None:
            continue
        try:
            year = int(years[int(k)])
            total = float(attr(row, "TOTALNOOFLINES") or 0)
            na = float(attr(row, "NBR_NA_LINES") or 0)
        except (ValueError, IndexError):
            continue
        if total and na >= total:
            continue
        if best is None or year > best["year"]:
            best = {"rate": round(float(row[0]) / 100, 4), "year": year, "type": attr(row, "TARIFFTYPE") or ""}
    return best


# TRAINS keeps preferential rates mostly as 'reported'; MFN specific duties only make sense as 'aveestimated'
# (Korea's honey duty is 0 as reported, 243% as estimated). Try the better one first, then the other.
DATATYPES = {"000": ("aveestimated", "reported"), CANADA_WITS: ("reported", "aveestimated")}


def _job(reporter: str, partner: str, hs6: str):
    def run():
        url = ""
        for datatype in DATATYPES[partner]:
            url = wits_url(reporter, partner, hs6, datatype)
            try:
                parsed = parse_wits(sources.http_get_json(url))
            except sources.NoRecords:
                parsed = None
            if parsed:
                return parsed, url
        return None, url
    return run


def jobs_for(hs6: str) -> dict:
    """Cache key -> fetch job, two per market."""
    jobs = {}
    for cc, m in MARKETS.items():
        jobs[f"tariff-{hs6}-{cc}-mfn"] = _job(m.wits, "000", hs6)
        jobs[f"tariff-{hs6}-{cc}-pref"] = _job(m.wits, CANADA_WITS, hs6)
    return jobs


@dataclass
class TariffResult:
    status: str                     # ok | mfn_only | unavailable | pending
    origin: str                     # cache | live | pending | error | mixed
    applied: float = 0.0
    mfn: float = 0.0
    year: int | None = None
    agreement: str | None = None
    note: str = ""
    sources: list[str] = field(default_factory=list)
    section338: str = ""            # US only: listed | not_listed | unknown

    @property
    def usable(self) -> bool:
        return self.status in ("ok", "mfn_only")


def _pct(x: float) -> str:
    s = f"{x * 100:.1f}".rstrip("0").rstrip(".")
    return f"{s}%"


def combine(cc: str, hs6: str, mfn: dict | None, pref: dict | None, origins: tuple[str, str]) -> TariffResult:
    """Turn the two WITS answers (+ Section 338 for the US) into the rate a Canadian exporter pays."""
    m = MARKETS[cc]
    origin = origins[0] if origins[0] == origins[1] else "mixed"
    srcs = [wits_url(m.wits, "000", hs6), wits_url(m.wits, CANADA_WITS, hs6, "reported")]
    label = f" ({m.tariff_label})" if m.tariff_label else ""

    if pref:
        applied, year = pref["rate"], pref["year"]
        note = f"Preferential rate for Canada {_pct(applied)} (WITS/TRAINS {year}){label}"
        if mfn and mfn["year"] > pref["year"] and mfn["rate"] < applied:  # MFN cut below the old preference
            applied, year = mfn["rate"], mfn["year"]
            note = f"MFN rate {_pct(applied)} (TRAINS {year}) is now below the last recorded preference{label}"
        res = TariffResult("ok", origin, applied, mfn["rate"] if mfn else applied, year,
                           m.agreement if (not mfn or pref["rate"] < mfn["rate"]) else None, note, srcs)
        if m.agreement and mfn and pref["rate"] < mfn["rate"]:
            res.note += f"; {_pct(mfn['rate'])} without {m.agreement.split(' (')[0]}"
        res.note += ". TRAINS lags: phase-downs since then are not reflected."
    elif mfn:
        res = TariffResult("mfn_only", origin, mfn["rate"], mfn["rate"], mfn["year"], None,
                           f"MFN rate {_pct(mfn['rate'])} (WITS/TRAINS {mfn['year']}){label}. No preferential rate for "
                           "Canada on record" + (f": if {m.agreement.split(' (')[0]} covers this product the real rate may be lower."
                                                 if m.agreement and mfn["rate"] > 0 else "."), srcs)
    else:
        pending = "pending" in origins
        return TariffResult("pending" if pending else "unavailable", origin, note=(
            "Tariff still loading from WITS — refresh in a minute." if pending else
            "Tariff unavailable: WITS/TRAINS has no rate on record for this product and market."), sources=srcs)

    if cc == "US":
        status, cite = section338.status(hs6)
        res.section338 = status
        if status == "listed":
            res.applied = min(res.applied + section338.RATE, MAX_RATE)
            res.agreement = "CUSMA (does not exempt Section 338 tariffs)"
            res.note = (f"+50% US Section 338 tariff on Canadian goods: a tariff line under HS {hs6} is on CBP's list "
                        f"(check your exact 10-digit HTS code). Base: {res.note}")
            res.sources.append(cite)
        elif status == "not_listed":
            res.note += f" Not on CBP's Section 338 list ({section338.AS_OF})."
            res.sources.append(cite)
        else:
            res.note += " Section 338 status not checked: we can't tell whether the extra 50% US tariff applies."
    res.applied = min(res.applied, MAX_RATE)
    res.mfn = min(res.mfn, MAX_RATE)
    return res


def tariffs_for(hs6: str, fetched: dict) -> dict[str, TariffResult]:
    """fetched = sources.fetch_many(jobs_for(hs6)) output."""
    out = {}
    for cc in MARKETS:
        mfn, o1 = fetched.get(f"tariff-{hs6}-{cc}-mfn", (None, "error"))
        pref, o2 = fetched.get(f"tariff-{hs6}-{cc}-pref", (None, "error"))
        out[cc] = combine(cc, hs6, mfn, pref, (o1, o2))
    return out
