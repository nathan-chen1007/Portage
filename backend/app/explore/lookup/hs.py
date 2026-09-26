"""The HS6 product list we validate every code against (the LLM may never invent one).

Source: UN Comtrade's HS reference list (https://comtradeapi.un.org/files/v1/app/reference/HS.json), reduced
to its 6-digit leaves and stored as backend/data/auto/cache/hs6.json ({source, codes: {hs6: description}}).
If that file is missing but the raw download (HS_raw.json) is there, it's built on first use. If neither is,
a small seed list keeps the lab usable for the demo products.
"""

import json
import re

from app.explore.lookup import sources

REFERENCE_URL = "https://comtradeapi.un.org/files/v1/app/reference/HS.json"
FILE, RAW_FILE = "hs6.json", "HS_raw.json"

# Fallback only: descriptions follow the HS nomenclature wording.
SEED: dict[str, str] = {
    "040900": "Natural honey",
    "170220": "Sugars; maple sugar and maple syrup",
    "151411": "Oils; low erucic acid rape or colza oil and its fractions, crude",
    "151419": "Oils; low erucic acid rape or colza oil and its fractions, other than crude",
    "030632": "Lobsters (Homarus spp.), live, fresh or chilled",
    "030612": "Lobsters (Homarus spp.), frozen",
    "100199": "Wheat and meslin; other than durum wheat, other than seed",
    "071340": "Vegetables, leguminous; lentils, dried, shelled",
    "071310": "Vegetables, leguminous; peas, dried, shelled",
    "120510": "Oil seeds; low erucic acid rape or colza seeds",
    "220300": "Beer made from malt",
    "220421": "Wine; still, in containers holding 2 litres or less",
    "220830": "Whiskies",
    "081040": "Fruit, edible; cranberries, bilberries and other fruits of the genus Vaccinium, fresh",
    "081140": "Fruit, edible; cranberries, bilberries etc., frozen",
    "090121": "Coffee; roasted, not decaffeinated",
    "180632": "Chocolate and other food preparations containing cocoa, in blocks or bars, not filled",
    "190590": "Bread, pastry, cakes, biscuits and other bakers' wares, n.e.c.",
    "210690": "Food preparations n.e.c.",
    "330499": "Beauty or make-up preparations and preparations for the care of the skin, n.e.c.",
    "340111": "Soap and organic surface-active products in bars, for toilet use",
    "440710": "Wood sawn or chipped lengthwise, coniferous, thickness over 6mm",
    "610910": "T-shirts, singlets and other vests; of cotton, knitted or crocheted",
    "640399": "Footwear; with outer soles of rubber, plastics or leather and uppers of leather, n.e.c.",
    "847130": "Portable automatic data processing machines, weighing not more than 10kg",
    "940360": "Furniture; wooden, n.e.c.",
    "950300": "Toys; tricycles, scooters, dolls, puzzles and other toys",
}

_catalog: dict[str, str] | None = None
_source = "seed"


def build_from_raw(raw: dict) -> dict[str, str]:
    """HS.json -> {hs6: description} for 6-digit codes, description without the 'NNNNNN - ' prefix."""
    out = {}
    for r in raw.get("results", []):
        code = str(r.get("id", ""))
        if len(code) == 6 and code.isdigit():
            text = re.sub(r"^\s*\d{6}\s*-\s*", "", str(r.get("text", ""))).strip()
            out[code] = text or code
    return out


def catalog() -> dict[str, str]:
    global _catalog, _source
    if _catalog is not None:
        return _catalog
    p, raw = sources.CACHE_DIR / FILE, sources.CACHE_DIR / RAW_FILE
    try:
        if p.exists():
            _catalog, _source = json.loads(p.read_text(encoding="utf-8"))["codes"], "comtrade"
        elif raw.exists():
            codes = build_from_raw(json.loads(raw.read_text(encoding="utf-8-sig")))
            if codes:
                p.write_text(json.dumps({"source": REFERENCE_URL, "codes": codes}, ensure_ascii=False, indent=0), encoding="utf-8")
                _catalog, _source = codes, "comtrade"
    except (OSError, ValueError, KeyError):
        _catalog = None
    if not _catalog:
        _catalog, _source = dict(SEED), "seed"
    return _catalog


def catalog_source() -> str:
    catalog()
    return _source


def reset() -> None:
    """Forget the loaded catalog (tests, or after the file is replaced)."""
    global _catalog
    _catalog = None


def normalize(code: str) -> str:
    return re.sub(r"\D", "", code or "")[:6]


def describe(hs6: str) -> str | None:
    return catalog().get(normalize(hs6))


def is_valid(hs6: str) -> bool:
    c = normalize(hs6)
    return len(c) == 6 and c in catalog()


_STOP = {"and", "the", "for", "with", "our", "from", "made", "make", "sell", "other", "not", "etc", "whether", "canadian", "canada", "products", "product"}


def _tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z]+", text.lower())
    return [w[:-1] if len(w) > 4 and w.endswith("s") else w for w in words if len(w) >= 3 and w not in _STOP]


def search(query: str, limit: int = 8) -> list[tuple[str, str]]:
    """Keyword match over descriptions: [(hs6, description)], best first. Also accepts a code or code prefix."""
    code = normalize(query)
    cat = catalog()
    if len(code) >= 4 and not re.search(r"[A-Za-z]", query):
        return [(c, d) for c, d in cat.items() if c.startswith(code)][:limit]
    q = set(_tokens(query))
    if not q:
        return []
    scored = []
    for c, d in cat.items():
        words = set(_tokens(d))
        hits = sum(1 for t in q if t in words or any(w.startswith(t) for w in words))
        if hits:
            scored.append((-hits, len(d), c, d))
    scored.sort()
    return [(c, d) for _, _, c, d in scored[:limit]]
