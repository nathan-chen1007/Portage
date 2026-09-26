"""Founder's description -> HS6 candidates the founder confirms or switches.

The LLM proposes codes (given a keyword shortlist from the official list as hints); every code is checked
against the HS6 catalog and dropped if it isn't there. Keyword matches fill the rest of the list, and are
the whole list when no LLM is configured.
"""

import logging

from app.explore.lookup import hs
from app.services import llm

log = logging.getLogger("portage.explore.lookup")

MAX_CANDIDATES = 5

SYSTEM = (
    "You classify a Canadian exporter's product into Harmonized System (HS) 6-digit subheadings. "
    "Reply with JSON only: {\"candidates\": [{\"hs6\": \"170220\", \"reason\": \"one short sentence\"}]} with up to "
    f"{MAX_CANDIDATES} candidates, most likely first. Use only real HS6 codes; prefer codes from the shortlist "
    "when one fits. If the product is a service or not a physical good, return an empty list."
)


def _llm_candidates(description: str, shortlist: list[tuple[str, str]]) -> list[dict]:
    client = llm._get_client()  # raises LLMUnavailable without a key
    hints = "\n".join(f"{c}: {d}" for c, d in shortlist) or "(none)"
    resp = client.chat.completions.create(
        model=llm._model(),
        messages=[{"role": "system", "content": SYSTEM},
                  {"role": "user", "content": f"Product: {description}\n\nShortlist from the official HS list:\n{hints}"}],
        response_format={"type": "json_object"},
        temperature=0,
    )
    data = llm._json_from_text(resp.choices[0].message.content or "")
    return data.get("candidates", []) if isinstance(data, dict) else []


def classify(description: str) -> tuple[list[dict], str]:
    """([{hs6, description, reason, source}], mode) with mode 'llm' or 'offline'."""
    shortlist = hs.search(description, limit=25)
    out: list[dict] = []
    seen: set[str] = set()
    mode = "llm"
    try:
        for c in _llm_candidates(description, shortlist):
            code = hs.normalize(str(c.get("hs6", "")))
            if code in seen or not hs.is_valid(code):
                if code and code not in seen:
                    log.info("classifier proposed %s, not in the HS6 list: dropped", code)
                continue
            seen.add(code)
            out.append({"hs6": code, "description": hs.describe(code), "reason": str(c.get("reason", ""))[:300], "source": "llm"})
    except Exception as e:  # no key, network, bad JSON: keyword matches only
        log.warning("HS classification fell back to keyword search: %s", e)
        mode = "offline"
    # Keyword matches are a fallback, not noise: with AI answers in hand, pad only to three.
    pad_to = 3 if out else MAX_CANDIDATES
    for code, desc in shortlist:
        if len(out) >= pad_to:
            break
        if code not in seen:
            seen.add(code)
            out.append({"hs6": code, "description": desc, "reason": "Keyword match in the HS nomenclature", "source": "keyword"})
    return out[:MAX_CANDIDATES], mode


