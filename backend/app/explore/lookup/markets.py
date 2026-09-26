"""The eight markets Portage ranks, and the codes each data source uses for them."""

from dataclasses import dataclass


@dataclass(frozen=True)
class MarketCodes:
    code: str             # ISO alpha-2, as in markets.json
    wits: str             # WITS/TRAINS reporter (ISO numeric; the EU reports as one customs union, 918)
    comtrade: str         # UN Comtrade reporter (Germany's own imports for DE; the US is 842 in Comtrade)
    agreement: str | None  # the trade agreement a preferential rate for Canada would come from
    tariff_label: str = ""


MARKETS: dict[str, MarketCodes] = {m.code: m for m in [
    MarketCodes("GB", "826", "826", "Canada-UK Trade Continuity Agreement (CUKTCA)"),
    MarketCodes("JP", "392", "392", "CPTPP"),
    MarketCodes("AU", "036", "36", "CPTPP"),
    MarketCodes("DE", "918", "276", "CETA", tariff_label="EU common external tariff"),
    MarketCodes("CN", "156", "156", None),
    MarketCodes("KR", "410", "410", "Canada-Korea FTA (CKFTA)"),
    MarketCodes("US", "840", "842", "CUSMA"),
    MarketCodes("MX", "484", "484", "CUSMA"),
]}

CANADA_WITS = "124"
CANADA_COMTRADE = "124"
