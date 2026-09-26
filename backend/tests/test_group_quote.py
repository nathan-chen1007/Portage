from pathlib import Path

from app.engine.scoring import load_catalog
from app.models import ForwarderList, GroupQuoteRequest
from app.services import group_quote

DATA = Path(__file__).resolve().parent.parent / "data"
CAT = load_catalog(DATA)


def test_forwarders_are_real_public_pages():
    f = ForwarderList.model_validate_json((DATA / "forwarders.json").read_text(encoding="utf-8"))
    assert [x.id for x in f.forwarders] == ["yusen-canada", "kuehne-nagel-canada", "dhl-gf-canada"]
    for x in f.forwarders:
        assert x.lcl_url.startswith("https://") and x.contact_url.startswith("https://")
        assert "@" not in x.contact_url  # public pages only, no personal emails
    assert "NOT confirmed" in f.note


def test_japan_group_email_has_every_required_element():
    req = GroupQuoteRequest(country_code="JP", producers=6, combined_kg=15000, provinces=["AB", "SK", "MB", "AB"])
    d = group_quote.draft(req, CAT.market("honey", "JP"))
    for must in ["6 small Canadian honey producers", "HS 0409.00", "15.0 t", "Canadian Prairies (Alberta, Saskatchewan, Manitoba)",
                 "Port of Tokyo/Yokohama, Japan", "LCL consolidation", "own CFIA export certificate",
                 "each producer's share", "Transit time", "Sailing frequency from Vancouver", "Cargo insurance",
                 "Document handling", "food exports", "Growing Canada, together.", "doesn't book or ship"]:
        assert must in d.body, must
    assert "Tokyo/Yokohama" in d.subject and d.sample is True
    assert "Coordinator" in d.body  # from the group coordinator, not from Portage


def test_mixed_provinces_and_us_land_route():
    req = GroupQuoteRequest(country_code="US", producers=3, combined_kg=4000, provinces=["AB", "ON"])
    d = group_quote.draft(req, CAT.market("honey", "US"))
    assert "LTL consolidation" in d.body and "mainly the Canadian Prairies (Alberta), plus Ontario" in d.body
    assert group_quote.route_label(CAT.market("honey", "US")) == "Prairies → United States by truck"
    assert group_quote.route_label(CAT.market("honey", "JP")) == "Vancouver → Japan"
