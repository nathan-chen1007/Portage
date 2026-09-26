"""The 8 extra markets shown as ranking-only ("More markets"), and the codes each source uses for them.

Codes checked Sat Sept 26 2026 against the sources' own reference lists:
  UN Comtrade reporters  https://comtradeapi.un.org/files/v1/app/reference/Reporters.json
                         (France 251, Italy 380, India 699: Comtrade's codes differ from ISO numeric here)
  WITS/TRAINS reporters  https://wits.worldbank.org/API/V1/wits/datasource/trn/country/356;704;702;554;784;918
                         (the EU reports its common external tariff as one customs union, 918)
The agreement is the one a preferential rate for Canada would come from (per the lab E brief); whether a rate
is actually preferential comes from TRAINS, never from this table.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ExtraMarket:
    code: str              # ISO alpha-2
    country: str
    language: str          # ISO 639-1, main business language
    wits: str              # WITS/TRAINS reporter
    comtrade: str          # UN Comtrade reporter
    agreement: str | None  # agreement a preference for Canada would come from; None = no FTA with Canada
    tariff_label: str = ""


EU = "EU common external tariff"

EXTRA_MARKETS: dict[str, ExtraMarket] = {m.code: m for m in [
    ExtraMarket("FR", "France", "fr", "918", "251", "CETA", EU),
    ExtraMarket("NL", "Netherlands", "nl", "918", "528", "CETA", EU),
    ExtraMarket("IT", "Italy", "it", "918", "380", "CETA", EU),
    ExtraMarket("VN", "Vietnam", "vi", "704", "704", "CPTPP"),
    ExtraMarket("SG", "Singapore", "en", "702", "702", "CPTPP"),
    ExtraMarket("NZ", "New Zealand", "en", "554", "554", "CPTPP"),
    ExtraMarket("IN", "India", "en", "356", "699", None),
    ExtraMarket("AE", "United Arab Emirates", "ar", "784", "784", None),
]}

# Products the demo pre-warms. Icewine: HS 2204.21 (still wine, containers of 2 L or less), the code the
# lookup's own classifier maps "ice wine" to (app/explore/lookup/classify.py).
CATEGORY_HS6 = {"honey": "040900", "icewine": "220421"}

# Everything committed to the cache: the two categories plus the any-product demo products (hockey sticks, maple
# syrup), so no demo path makes a live call.
PREWARM_HS6 = [*CATEGORY_HS6.values(), "950699", "170220"]
