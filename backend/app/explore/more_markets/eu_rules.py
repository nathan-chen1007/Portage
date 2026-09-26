"""France, Netherlands and Italy: the EU-level requirements we verified for Germany, plus national-language labelling.

EU import rules for food and wine are harmonised (the same certificates, listings, VI-1, composition and labelling
rules, and CETA origin proof apply in every member state), so the curated Germany row for honey or icewine applies
as-is. What differs is the label language: Reg. (EU) 1169/2011 Art. 15 lets each member state require its own
official language, and all three do. Only curated products (a category whose HS code matches) get this; every
other product, and every non-EU extra market, stays "Not verified".
"""

from app.explore.lookup import hs
from app.models import Requirement

EU_NOTE = "EU rules, same as Germany"
EU_MARKETS = ("FR", "NL", "IT")

NATIONAL_LABEL = {
    "FR": Requirement(
        name="French-language labelling", tier=1,
        detail=("Mandatory label information must be at least in French (Loi n° 94-665 'Toubon', Art. 2; DGCCRF "
                "food-labelling rules). EU law lets member states require their language (Reg. 1169/2011, Art. 15)."),
        source="https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/etiquetage-des-denrees-alimentaires-les-regles-connaitre",
        lead_time_weeks=2, lead_time_basis="estimate", confidence="verified"),
    "NL": Requirement(
        name="Dutch-language labelling", tier=1,
        detail=("Mandatory food information must be given in Dutch (Dutch government business portal; Warenwetbesluit "
                "informatie levensmiddelen). EU law lets member states require their language (Reg. 1169/2011, Art. 15)."),
        source="https://ondernemersplein.overheid.nl/wetten-en-regels/regels-voor-etiketten-van-levensmiddelen/",
        lead_time_weeks=2, lead_time_basis="estimate", confidence="verified"),
    "IT": Requirement(
        name="Italian-language labelling", tier=1,
        detail=("Mandatory food information must be in Italian; food sold without it is a sanctioned offence (D.Lgs. "
                "231/2017). EU law lets member states require their language (Reg. 1169/2011, Art. 15)."),
        source="https://www.gazzettaufficiale.it/eli/id/2018/02/08/18G00023/sg",
        lead_time_weeks=2, lead_time_basis="estimate", confidence="verified"),
}
LANGUAGE = {"FR": "French", "NL": "Dutch", "IT": "Italian"}


def curated_germany(hs6: str):
    """(category id, Germany MarketEntry) for a curated goods product with this HS code, else (None, None)."""
    from app.explore.lookup.service import base_catalog  # the curated catalog, loaded once

    cat = base_catalog()
    for c in cat.categories.values():
        if c.kind == "goods" and c.hs_code and hs.normalize(c.hs_code) == hs6:
            de = cat.market(c.id, "DE")
            if de is not None and de.status == "open" and de.compliance_confidence == "verified":
                return c.id, de
    return None, None


def requirements_for(hs6: str, cc: str) -> list[Requirement]:
    """Verified requirements for FR/NL/IT when the product is curated; [] otherwise (stays 'Not verified')."""
    if cc not in EU_MARKETS:
        return []
    _, de = curated_germany(hs6)
    if de is None:
        return []
    out = []
    for r in de.compliance_requirements:
        r = r.model_copy(update={"confidence": "verified"})
        r.detail = r.detail.replace("German-language labelling", f"{LANGUAGE[cc]}-language labelling")
        out.append(r)
    return out + [NATIONAL_LABEL[cc].model_copy()]
