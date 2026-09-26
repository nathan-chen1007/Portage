from pathlib import Path

from app.engine.scoring import load_catalog
from app.models import BusinessProfile
from app.services import documents

CAT = load_catalog(Path(__file__).resolve().parent.parent / "data")
HONEY = BusinessProfile(company_name="Prairie Gold Apiaries", product_name="Raw clover honey", category="honey",
                        city="Leduc", province="Alberta", contact_name="Jen Kowalski", contact_email="jen@prairiegold.ca")


def ids(code, profile=HONEY, cat="honey"):
    return [d.id for d in documents.drafts_for(profile, CAT.categories[cat], CAT.market(cat, code))]


def test_honey_origin_docs_only_where_the_fta_saves_duty():
    assert ids("GB") == ["origin", "checklist"]
    assert ids("DE") == ["origin", "checklist"]
    assert ids("JP") == ["origin", "checklist"]
    assert ids("AU") == ["checklist"]  # 0% MFN anyway
    assert ids("KR") == ["checklist"]  # honey excluded from CKFTA
    assert ids("US") == ["checklist"]  # CUSMA doesn't exempt Section 338


def test_uk_declaration_lists_the_missing_business_number():
    d = documents.drafts_for(HONEY, CAT.categories["honey"], CAT.market("honey", "GB"))[0]
    assert "CUKTCA" in d.title and "Prairie Gold Apiaries" in d.body
    assert any("Business Number" in f for f in d.missing_fields)
    assert "16.0%" in d.purpose


def test_cptpp_fills_wholly_obtained_for_honey():
    d = documents.drafts_for(HONEY, CAT.categories["honey"], CAT.market("honey", "JP"))[0]
    assert "wholly obtained" in d.body
    assert "Importer name and address in Japan" in d.missing_fields


def test_saas_dpa_for_eu_and_uk_only():
    saas = BusinessProfile(company_name="ShiftCo", category="b2b_saas")
    assert ids("DE", saas, "b2b_saas") == ["dpa", "checklist"]
    assert ids("GB", saas, "b2b_saas") == ["dpa", "checklist"]
    assert ids("JP", saas, "b2b_saas") == ["checklist"]


def test_pdf_renders():
    for code in ["GB", "JP"]:
        for d in documents.drafts_for(HONEY, CAT.categories["honey"], CAT.market("honey", code)):
            assert documents.to_pdf(d)[:4] == b"%PDF"
