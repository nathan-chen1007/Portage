"""LLM calls through any OpenAI-compatible API (DeepSeek by default; swap with LLM_BASE_URL/LLM_MODEL).

Three small jobs rather than one giant prompt:
  1. extract_profile   founder's free-text description -> structured BusinessProfile (tool calling)
  2. draft_outreach    profile + market facts + chosen partner -> English email draft (JSON mode)
  3. voice_script      approved English email -> short spoken script in the partner's language

The LLM never supplies facts about markets or companies: those come from the curated data files and
are passed in, and the prompts tell the model to use only what it's given. Only the founder's own
product description is sent; no personal data is required.

With no API key set, each job falls back to a deterministic offline version so the demo still runs.
"""

import json
import os
import re

from app.models import BusinessProfile, Category, MarketEntry, Middleman, OutreachDraft

LANGUAGE_NAMES = {
    "en": "English", "de": "German", "ja": "Japanese", "ko": "Korean",
    "es": "Spanish", "zh": "Simplified Chinese", "fr": "French",
}

# Offline fallback: how to name the product when the founder didn't.
PRODUCT_NOUNS = {"honey": "Canadian honey", "b2b_saas": "B2B software"}


def _pct(x: float) -> str:
    """25.5% stays 25.5%, 16.0% becomes 16%."""
    s = f"{x * 100:.1f}".rstrip("0").rstrip(".")
    return f"{s}%"


# Offline fallback: category keywords (lowercase substrings).
CATEGORY_KEYWORDS = {
    "honey": ["honey", "beekeep", "apiar", "apicult", "hive", " bees", "miel"],
    "b2b_saas": ["saas", "software", "platform", "cloud", "b2b", "subscription", "dashboard", " app "],
}

_client = None


class LLMUnavailable(RuntimeError):
    pass


def _api_key() -> str | None:
    return os.getenv("LLM_API_KEY") or os.getenv("DEEPSEEK_API_KEY")


def is_configured() -> bool:
    return bool(_api_key())


def _get_client():
    global _client
    if _client is None:
        key = _api_key()
        if not key:
            raise LLMUnavailable("LLM_API_KEY is not set in backend/.env")
        from openai import OpenAI  # imported lazily so tests run without the package

        _client = OpenAI(api_key=key, base_url=os.getenv("LLM_BASE_URL", "https://api.deepseek.com"), timeout=45)
    return _client


def _model() -> str:
    return os.getenv("LLM_MODEL", "deepseek-chat")


# ---------- 1. profile extraction ----------

def _profile_tool(categories: list[Category]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": "submit_business_profile",
            "description": "Record the structured profile of the Canadian business described by the founder.",
            "parameters": {
                "type": "object",
                "properties": {
                    "company_name": {"type": "string", "description": "Company name, or empty if not given"},
                    "product_name": {"type": "string"},
                    "product_summary": {"type": "string", "description": "One neutral sentence describing what they sell"},
                    "category": {
                        "type": "string",
                        "enum": [c.id for c in categories] + ["unsupported"],
                        "description": "Best matching category id; 'unsupported' if none fits",
                    },
                    "category_reason": {"type": "string", "description": "Short reason for the category choice"},
                    "city": {"type": "string"},
                    "province": {"type": "string", "description": "Full province name, e.g. Alberta"},
                    "selling_points": {"type": "array", "items": {"type": "string"}, "description": "Up to 4, only ones the founder stated"},
                    "contact_name": {"type": "string"},
                    "contact_email": {"type": "string"},
                    "website": {"type": "string"},
                    "business_number": {"type": "string", "description": "CRA business number if given"},
                },
                "required": ["product_summary", "category", "category_reason"],
            },
        },
    }


def extract_profile(description: str, categories: list[Category]) -> BusinessProfile:
    """Ask the model to call submit_business_profile. Raises LLMUnavailable if no key is set."""
    client = _get_client()
    cat_lines = "\n".join(f"- {c.id}: {c.label}. {c.description}" for c in categories)
    messages = [
        {"role": "system", "content": (
            "You extract a structured profile of a Canadian business from the founder's description. "
            "Only record facts the founder actually stated; leave fields empty rather than guessing. "
            "Pick the category from this list:\n" + cat_lines)},
        {"role": "user", "content": description},
    ]
    kwargs = dict(model=_model(), messages=messages, tools=[_profile_tool(categories)], temperature=0)
    try:
        resp = client.chat.completions.create(
            **kwargs, tool_choice={"type": "function", "function": {"name": "submit_business_profile"}})
    except Exception:
        # Some models reject a named tool_choice; "auto" plus the system prompt still works.
        resp = client.chat.completions.create(**kwargs, tool_choice="auto")

    msg = resp.choices[0].message
    args = json.loads(msg.tool_calls[0].function.arguments) if msg.tool_calls else _json_from_text(msg.content or "")
    profile = BusinessProfile.model_validate({k: v for k, v in args.items() if v is not None})
    if profile.category not in {c.id for c in categories}:
        profile.category = "unsupported"
    return profile


def fallback_profile(description: str, categories: list[Category]) -> BusinessProfile:
    """Offline: match the category on keywords and pull out an email and website if present."""
    text = f" {description.lower()} "
    ids = {c.id for c in categories}
    category = next((cid for cid, kws in CATEGORY_KEYWORDS.items() if cid in ids and any(k in text for k in kws)), "unsupported")
    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", description)
    company = re.search(r"\b(?:We're|We are|I'm with|I run)\s+((?:[A-Z][\w&'.-]*\s?){1,5})", description)
    site = re.search(r"\b(?:https?://)?(?:www\.)?[\w-]+\.(?:ca|com|co|io|org)\b(?!@)", description)
    return BusinessProfile(
        company_name=company.group(1).strip() if company else "",
        product_summary=description.strip()[:200],
        category=category,
        category_reason="keyword match (offline mode)",
        contact_email=email.group(0) if email else "",
        website=site.group(0) if site and not (email and site.group(0) in email.group(0)) else "",
    )


# ---------- 2. outreach draft ----------

def draft_outreach(profile: BusinessProfile, entry: MarketEntry, middleman: Middleman) -> OutreachDraft:
    """English cold email to the chosen partner, built only from the facts passed in."""
    if not is_configured():
        return fallback_outreach(profile, entry, middleman)
    facts = {
        "sender": profile.model_dump(),
        "target_market": entry.country,
        "trade_agreement": entry.trade_agreement,
        "tariff_for_canadian_exporter": f"{entry.tariff_rate:.0%}",
        "tariff_without_agreement": f"{entry.mfn_rate:.1%}",
        "key_requirements": [r.name for r in entry.compliance_requirements],
        "recipient": middleman.model_dump(exclude={"source"}),
    }
    system = (
        "You write short, specific cold outreach emails from a small Canadian company to a potential "
        "importer, distributor or partner abroad. Rules: use ONLY the facts in the JSON provided; never "
        "invent numbers, certifications, customers or prices; if something useful is missing, write a "
        "placeholder like [your annual volume]. Under 170 words, warm and concrete, one clear ask (a "
        "20-minute call or a sample shipment). Mention the trade-agreement advantage if the tariff is 0%. "
        "If the recipient is a government service or association, ask for introductions to buyers instead. "
        'Reply as JSON: {"subject": "...", "body": "..."}. Write in English.'
    )
    resp = _get_client().chat.completions.create(
        model=_model(),
        messages=[{"role": "system", "content": system}, {"role": "user", "content": json.dumps(facts, ensure_ascii=False)}],
        response_format={"type": "json_object"},
        temperature=0.6,
    )
    data = _json_from_text(resp.choices[0].message.content or "")
    return OutreachDraft(subject=data.get("subject", "").strip(), body=data.get("body", "").strip(), language="en")


def fallback_outreach(profile: BusinessProfile, entry: MarketEntry, middleman: Middleman) -> OutreachDraft:
    """Offline template with the same facts and placeholders the LLM version would use."""
    company = profile.company_name or "[your company]"
    product = profile.product_name or PRODUCT_NOUNS.get(profile.category, "[your product]")
    where = ", ".join(x for x in [profile.city, profile.province] if x) or "[your city, province]"
    fta = ""
    if entry.tariff_rate == 0 and entry.trade_agreement and entry.mfn_rate > 0:
        fta = (f" Under {entry.trade_agreement.split(' (')[0]}, our product enters {entry.country} duty-free "
               f"(instead of {_pct(entry.mfn_rate)}).")
    ask = ("Could you introduce us to buyers you work with?" if "association" in middleman.type or "government" in middleman.type
           else "Would you be open to a 20-minute call, or should we send a sample?")
    body = (
        f"Dear {middleman.name} team,\n\n"
        f"I'm {profile.contact_name or '[your name]'} from {company} in {where}, Canada. We produce {product}.{fta}\n\n"
        f"We're looking for a partner in {entry.country} and your work as a {middleman.type} stood out. "
        f"We can supply [your annual volume] and share specifications and certificates on request.\n\n"
        f"{ask}\n\nBest regards,\n{profile.contact_name or '[your name]'}\n{company}"
        + (f"\n{profile.contact_email}" if profile.contact_email else "")
    )
    subject = f"{product[0].upper()}{product[1:]} from {company if company != '[your company]' else 'Canada'} for {entry.country}"
    return OutreachDraft(subject=subject, body=body, language="en")


# ---------- 3. spoken script ----------

def voice_script(text: str, language: str) -> str:
    """Turn the approved email into a ~40-second spoken message in the target language.
    Offline: the English text itself, minus placeholders."""
    if not is_configured():
        return re.sub(r"\[[^\]]*\]", "", text).strip()
    lang = LANGUAGE_NAMES.get(language, language)
    system = (
        f"Convert the email below into a short spoken voice message in {lang}, as the sender would say it "
        "when leaving a voice note for a potential business partner. Natural spoken style, about 90 words "
        "(or the equivalent length), polite register appropriate for business in that culture. Keep company "
        "and product names as written. Do not add any facts that are not in the email. Drop placeholders "
        "in square brackets. Output only the script text, no quotes or notes."
    )
    resp = _get_client().chat.completions.create(
        model=_model(),
        messages=[{"role": "system", "content": system}, {"role": "user", "content": text}],
        temperature=0.4,
    )
    return (resp.choices[0].message.content or "").strip()


def _json_from_text(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise ValueError(f"model did not return JSON: {text[:200]}")
        return json.loads(m.group(0))
