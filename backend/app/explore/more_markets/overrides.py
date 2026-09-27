"""Officially sourced corrections for the "More markets" section (lab F research, Sat Sept 26 2026).

TRAINS lags or lacks some rates, and says nothing about sanitary bans. These three values were read from the
official sources below and replace the automatic figures. Everything else in the section stays automatic.
"""

AS_OF = "2026-09-26"

# (hs6, country) -> the tariff for Canada, from the official source.
TARIFFS: dict[tuple[str, str], dict] = {
    ("220421", "VN"): {
        "applied": 0.15, "mfn": 0.50, "year": 2026, "agreement": "CPTPP",
        "note": ("15% for Canada in 2026 under CPTPP (Decree 115/2022, Appendix I, 2204.21 wine, 2026 column; 10% "
                 "from 2027). MFN 50% per WITS/TRAINS."),
        "sources": ["https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-115-2022-nd-cp-38713.htm",
                    "https://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN/reporter/704/partner/000/product/220421/year/ALL/datatype/reported?format=JSON"],
    },
    ("220421", "AE"): {
        "applied": 0.50, "mfn": 0.50, "year": 2026, "agreement": None,
        "note": ("50% customs duty on alcohol (UAE government portal, customs duty page; the general rate is 5%). "
                 "No trade agreement with Canada. Alcohol is a restricted import (Ministry of Interior / Dubai Police approval)."),
        "sources": ["https://u.ae/en/information-and-services/finance-and-investment/taxation/clearing-the-customs-and-paying-customs-duty",
                    "https://u.ae/en/information-and-services/finance-and-investment/clearing-the-customs-and-paying-customs-duty/restricted-items-in-the-uae"],
    },
}

# (hs6, country) -> closed to Canadian exports: shown as "Not accessible" with the official reason, never scored.
CLOSED: dict[tuple[str, str], dict] = {
    ("040900", "NZ"): {
        "note": ("Not accessible: New Zealand only admits honey from Niue, Pitcairn Island, Samoa, Tonga, Tuvalu and the "
                 "Solomon Islands (MPI). CFIA lists honey from any jurisdiction other than New Zealand as ineligible, so "
                 "there is no certificate for Canadian honey."),
        "sources": ["https://www.mpi.govt.nz/import/importing-food-and-beverages/honey-bee-products/steps-to-importing",
                    "https://inspection.canada.ca/en/exporting-food-plants-animals/food-exports/requirements/new-zealand-honey"],
    },
}
