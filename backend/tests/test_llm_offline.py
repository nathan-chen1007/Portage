"""The offline fallbacks keep the demo alive without an LLM key."""

from pathlib import Path

from app.engine.scoring import load_catalog, middlemen_for
from app.models import BusinessProfile
from app.services import llm

CAT = load_catalog(Path(__file__).resolve().parent.parent / "data")


def test_fallback_profile_categories():
    cats = list(CAT.categories.values())
    p = llm.fallback_profile("Family beekeepers near Leduc, Alberta selling raw clover honey. jen@prairiegold.ca", cats)
    assert p.category == "honey" and p.contact_email == "jen@prairiegold.ca"
    assert llm.fallback_profile("B2B scheduling software for dental clinics", cats).category == "b2b_saas"
    assert llm.fallback_profile("We make hand-poured candles", cats).category == "unsupported"


def test_fallback_outreach_uses_only_sourced_facts():
    p = BusinessProfile(company_name="Prairie Gold Apiaries", product_name="raw clover honey", category="honey",
                        city="Leduc", province="Alberta")
    entry = CAT.market("honey", "GB")
    mm = middlemen_for(CAT, "honey", "GB")[0]
    d = llm.fallback_outreach(p, entry, mm)
    assert "duty-free" in d.body and "16%" in d.body and mm.name in d.body
    assert "[your annual volume]" in d.body and d.language == "en"


def test_offline_voice_script_drops_placeholders(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    assert llm.voice_script("We can ship [your annual volume] a year.", "ja") == "We can ship  a year."
