"""Ship together: one freight quote request for a whole group of producers.

Fixed template, no LLM, so it can't fail live. Written by the group coordinator on behalf of the group;
Portage only makes the match and never books or ships. Nothing is sent: the UI offers a Copy button.
"""

from app.models import GroupQuoteDraft, GroupQuoteRequest, MarketEntry

DEST_PORT = {
    "JP": "Tokyo/Yokohama",
    "GB": "Liverpool or Felixstowe",
    "DE": "Hamburg",
    "AU": "Sydney",
    "KR": "Busan",
    "CN": "Shanghai",
}
PRAIRIES = {"AB": "Alberta", "SK": "Saskatchewan", "MB": "Manitoba"}
PROVINCE_NAMES = {**PRAIRIES, "BC": "British Columbia", "ON": "Ontario", "QC": "Quebec", "NS": "Nova Scotia",
                  "NB": "New Brunswick", "PE": "Prince Edward Island", "NL": "Newfoundland and Labrador"}
CONTAINER_KG = 20_000

# What the group ships, per goods category. Honey keeps its original wording exactly.
PRODUCTS = {
    "honey": {
        "noun": "natural honey (HS 0409.00)", "who": "honey producers", "group": "honey group",
        "line": "- Product: natural honey, HS 0409.00 (food grade, in drums and retail cases)",
        "paperwork": "- Paperwork: each producer holds its own CFIA export certificate for its lot",
        "experience": "6. Your experience shipping food exports (honey or similar)",
    },
    "icewine": {
        "noun": "icewine (HS 2204.21)", "who": "icewine producers", "group": "icewine group",
        "line": "- Product: Canadian icewine, HS 2204.21 (cased 200-375 ml bottles, alcohol, temperature-sensitive)",
        "paperwork": "- Paperwork: each winery issues its own origin declaration and any wine import documents for its lot",
        "experience": "6. Your experience shipping wine (alcohol handling, temperature control, bonded delivery)",
    },
}


def gateway(entry: MarketEntry) -> str:
    """The Canadian port the lane leaves from ('Vancouver → Yokohama, …' -> 'Vancouver'); land border -> ''."""
    if entry.sea_distance_nm == 0:
        return ""
    return (entry.shipping_route.split("→")[0].strip() if "→" in entry.shipping_route else "") or "Vancouver"


def route_label(entry: MarketEntry) -> str:
    country = entry.country.replace(" (EU)", "")
    g = gateway(entry)
    return f"{g} → {country}" if g else f"Prairies → {country} by truck"


def draft(req: GroupQuoteRequest, entry: MarketEntry) -> GroupQuoteDraft:
    prod = PRODUCTS.get(req.category, PRODUCTS["honey"])
    country = entry.country.replace(" (EU)", "")
    land = entry.sea_distance_nm == 0
    g = gateway(entry) or "the Prairies"
    port = DEST_PORT.get(entry.country_code, country)
    provs = [p.upper() for p in req.provinces if p]
    prairie = [PRAIRIES[p] for p in dict.fromkeys(provs) if p in PRAIRIES]
    others = [PROVINCE_NAMES.get(p, p) for p in dict.fromkeys(provs) if p not in PRAIRIES]
    if prairie and not others:
        origin = f"the Canadian Prairies ({', '.join(prairie)})"
    elif prairie:
        origin = f"mainly the Canadian Prairies ({', '.join(prairie)}), plus {', '.join(others)}"
    else:
        origin = ", ".join(others) or "the Canadian Prairies"
    tonnes = req.combined_kg / 1000
    mode = "LTL" if land else "LCL"
    service = ("LTL consolidation: combining the producers' loads on one truck" if land
               else "LCL consolidation: combining the producers' small loads into one container")
    fill = "" if land else f", roughly {round(min(req.combined_kg, CONTAINER_KG) / CONTAINER_KG * 100)}% of a 20 ft container"
    dest = f"{country} (delivery address to be confirmed)" if land else f"Port of {port}, {country}"

    subject = (f"Group quote request: {mode} consolidation of {prod['noun']}, "
               f"{g} → {port if not land else country}, {req.producers} Canadian producers")
    body = "\n".join([
        "Hello,",
        "",
        f"I coordinate a group of {req.producers} small Canadian {prod['who']} who want to ship to {country} together, "
        "and I'm writing on behalf of the whole group. We found each other through Portage, which matches exporters "
        "heading to the same market; Portage doesn't book or ship cargo, so we're looking for a forwarder to handle "
        "the group's shipment.",
        "",
        "Shipment details",
        prod["line"],
        f"- Combined volume: about {tonnes:.1f} t ({round(req.combined_kg):,} kg) from {req.producers} producers{fill}",
        f"- Origin and pickup: {origin}; pickup from each producer or delivery to one consolidation point, whichever you recommend",
        f"- Destination: {dest}",
        f"- Service: {service}",
        prod["paperwork"],
        "",
        "Could you please quote:",
        "1. Price per shipment, and each producer's share (how you'd split it: by weight, by pallet, or otherwise)",
        "2. Transit time, door to port" if not land else "2. Transit time",
        f"3. Sailing frequency from {g}" if not land else "3. Departure frequency",
        "4. Cargo insurance options",
        "5. Document handling: commercial invoices, packing lists, origin declarations, certificates, and customs "
        "clearance at destination",
        prod["experience"],
        "",
        "We're planning a first shipment in [month]. Happy to set up a call.",
        "",
        "Thank you,",
        "[Coordinator name]",
        f"Coordinator, {country} {prod['group']} (organised through Portage)",
        "[contact email]",
        "",
        "Growing Canada, together.",
    ])
    return GroupQuoteDraft(subject=subject, body=body)
