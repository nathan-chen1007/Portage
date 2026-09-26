"""Build the reference outputs of the curated demo paths (honey, B2B SaaS).

The snapshot in tests/snapshots/curated.json was generated at git tag `pre-promotion`, before labs B and C
were promoted into the main app. tests/test_curated_unchanged.py recomputes the same outputs and requires
them to be identical: promoting the any-product mode must not change a single honey or SaaS number.

Regenerate ONLY when a curated change is intended:  python -m tests.curated_snapshot
"""

import json
from datetime import date
from pathlib import Path

from app.engine.scoring import load_catalog, rank_markets
from app.models import BusinessProfile, Weights
from app.services import documents, group_quote

DATA = Path(__file__).resolve().parent.parent / "data"
SNAPSHOT = Path(__file__).resolve().parent / "snapshots" / "curated.json"

HONEY = BusinessProfile(company_name="Prairie Gold Apiaries", product_name="Raw clover honey", category="honey",
                        city="Leduc", province="Alberta", contact_name="Jen Kowalski", contact_email="jen@prairiegold.ca")
SAAS = BusinessProfile(company_name="ShiftWise", product_name="Clinic scheduling", category="b2b_saas",
                       city="Waterloo", province="Ontario", contact_name="Sam Lee", contact_email="sam@shiftwise.ca")

RANK_CASES = [
    {"sort_by": "overall", "prize_weight": 0.5},
    {"sort_by": "overall", "prize_weight": 0.0},
    {"sort_by": "overall", "prize_weight": 1.0},
    {"sort_by": "friction", "prize_weight": 0.5},
    {"sort_by": "opportunity", "prize_weight": 0.5},
    {"sort_by": "overall", "prize_weight": 0.5, "weights": {"tariff": 1, "compliance": 0, "logistics": 0, "risk": 0, "tax": 0}},
]
DOC_CASES = [("honey", HONEY, cc) for cc in ["GB", "JP", "DE", "AU", "CN", "KR", "US"]] + \
            [("b2b_saas", SAAS, cc) for cc in ["DE", "GB", "JP", "US", "CN"]]


def normalize(obj):
    """Replace today's date so the snapshot doesn't go stale overnight."""
    return json.loads(json.dumps(obj, ensure_ascii=False).replace(date.today().isoformat(), "<TODAY>"))


def rank_case_key(category: str, case: dict) -> str:
    return f"{category}|{json.dumps(case, sort_keys=True)}"


def build() -> dict:
    cat = load_catalog(DATA)
    out = {"rank": {}, "documents": {}, "group_quote": {}}
    for category in ["honey", "b2b_saas"]:
        for case in RANK_CASES:
            w = Weights(**case["weights"]) if "weights" in case else None
            ranked = rank_markets(category, cat, w, case["sort_by"], case["prize_weight"])
            out["rank"][rank_case_key(category, case)] = [m.model_dump(mode="json") for m in ranked]
    for category, profile, cc in DOC_CASES:
        drafts = documents.drafts_for(profile, cat.categories[category], cat.market(category, cc))
        out["documents"][f"{category}|{cc}"] = [d.model_dump(mode="json") for d in drafts]
    from app.models import GroupQuoteRequest
    req = GroupQuoteRequest(country_code="JP", producers=6, combined_kg=15000, provinces=["AB", "SK", "MB"])
    out["group_quote"]["JP"] = group_quote.draft(req, cat.market("honey", "JP")).model_dump(mode="json")
    return normalize(out)


if __name__ == "__main__":
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(json.dumps(build(), ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    print("wrote", SNAPSHOT)
