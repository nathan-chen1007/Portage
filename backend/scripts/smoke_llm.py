"""Check the LLM key and the three LLM jobs.  Run from backend/:  python scripts/smoke_llm.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv

load_dotenv()

from app.engine.scoring import load_catalog, middlemen_for  # noqa: E402
from app.services import llm  # noqa: E402

print("Using model:", llm._model(), "at", llm._get_client().base_url)

cat = load_catalog(Path(__file__).resolve().parent.parent / "data")
desc = ("We're Prairie Gold Apiaries, a family beekeeping operation near Leduc, Alberta. We sell raw "
        "unpasteurized clover honey in 500 g jars and bulk drums. Contact: Jen Kowalski, jen@prairiegold.ca")
profile = llm.extract_profile(desc, list(cat.categories.values()))
print("\nExtracted profile:\n", profile.model_dump_json(indent=2))
assert profile.category == "honey", "expected honey"

entry = cat.market("honey", "JP")
mm = middlemen_for(cat, "honey", "JP")[0]
draft = llm.draft_outreach(profile, entry, mm)
print(f"\nOutreach draft to {mm.name}:\n", draft.subject, "\n", draft.body)

print("\nJapanese voice script:\n", llm.voice_script(draft.body, "ja"))
print("\nOK: LLM works.")
