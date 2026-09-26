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

# Plain-language names for common Canadian exports whose official HS wording shares no keyword with how a
# founder describes them ("hockey sticks" -> 9506.99 "equipment for outdoor games ... n.e.c."). Used as the
# first offline candidate and as a hint to the LLM. Every code is still validated against the HS6 list.
KNOWN_PRODUCTS: list[tuple[tuple[str, ...], str]] = [
    (("hockey stick", "hockey sticks", "hockey equipment", "lacrosse stick"), "950699"),
    (("maple syrup", "maple sugar"), "170220"),
    (("canola oil",), "151411"),
    (("live lobster", "lobsters", "lobster"), "030632"),
    (("candle", "candles"), "340600"),
    (("ice wine", "icewine"), "220421"),
    (("blueberries", "blueberry", "cranberries"), "081040"),
    (("lentils",), "071340"),
]


def known_matches(description: str) -> list[str]:
    text = f" {description.lower()} "
    out = []
    for names, code in KNOWN_PRODUCTS:
        if any(f" {n} " in text or f" {n}." in text or f" {n}," in text for n in names) and code not in out:
            out.append(code)
    return out

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
    known = [(c, hs.describe(c)) for c in known_matches(description) if hs.is_valid(c)]
    shortlist = known + [x for x in hs.search(description, limit=25) if x[0] not in {c for c, _ in known}]
    out: list[dict] = []
    seen: set[str] = set()
    mode = "llm"
    llm_answered = False
    try:
        llm_list = _llm_candidates(description, shortlist)
        llm_answered = True
        for c in llm_list:
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
    if llm_answered and not out and not known:
        return [], mode  # the AI says it isn't a physical good (e.g. a service): no HS code, no lookup
    for code, desc in known:  # common Canadian exports first when the AI missed them (or is offline)
        if code not in seen:
            seen.add(code)
            out.insert(0 if mode == "offline" else len(out), {"hs6": code, "description": desc,
                       "reason": "Common Canadian export (Portage's plain-language list)", "source": "keyword"})
    # Keyword matches are a fallback, not noise: with AI answers in hand, pad only to three.
    pad_to = 3 if out else MAX_CANDIDATES
    for code, desc in shortlist:
        if len(out) >= pad_to:
            break
        if code not in seen:
            seen.add(code)
            out.append({"hs6": code, "description": desc, "reason": "Keyword match in the HS nomenclature", "source": "keyword"})
    return out[:MAX_CANDIDATES], mode


