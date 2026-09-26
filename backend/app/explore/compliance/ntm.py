"""UNCTAD non-tariff-measure (NTM) codes -> Portage requirement tiers.

UNCTAD classifies every import regulation with a code from its International Classification of NTMs
(2019 version): https://unctad.org/topic/trade-analysis/non-tariff-measures/NTMs-classification
The letter is the chapter (A = sanitary and phytosanitary, B = technical barriers to trade, C = pre-shipment
inspection and formalities, E = licences, quotas and prohibitions, ...), the digits narrow it down.

Our tiers (see Requirement in app/models.py) measure how much work a step is for the exporter:

  tier 1  paperwork or self-declaration        A2x/B2x residue and contaminant limits, A3x/B3x labelling and
                                               packaging, A4x hygiene, A5x treatment, A6x/B4x production
                                               processes, B6x identity, B7x quality, A85/B85 traceability,
                                               C2-C9 formalities (direct consignment, port of entry, monitoring)
  tier 2  registration / certificate / test    A15/B15 importer registration, A81-A84, A86, A89 and B81-B84,
                                               B89 (product registration, testing, certification, inspection,
                                               quarantine), C1 pre-shipment inspection
                                               A13 systems approach (a combination of SPS conditions), A19/B19
                                               other SPS/TBT import restrictions
  tier 3  licence or government approval       A14/B14 special authorization, E1 non-automatic licences,
                                               E2 quotas, other E
  blocked prohibition aimed at Canada          A11/A12/B11/E3: a prohibition that names Canada as the affected
                                               country. A prohibition that applies to every origin but can be
                                               lifted with an approval is tier 3 instead.

Chapters D (trade remedies), F (price controls, para-tariffs), G-O (finance, competition, investment,
distribution, services, subsidies, procurement, IP, rules of origin) and P (export measures) are not
compliance steps for the exporter, so they are skipped: tariffs and taxes are scored separately.

Several NTM codes describe the same practical step (A31 SPS labelling and B31 TBT labelling are both "put
the right label on it"), so codes are merged into one requirement per step (`STEPS` below). Otherwise a
market that TRAINS catalogues in more detail would look harder than one it catalogues less.

Lead times: TRAINS does not record how long a step takes, so every figure here is an estimate
(`lead_time_basis: "estimate"`), shown as such in the UI.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Step:
    key: str
    name: str
    tier: int
    lead_time_weeks: float
    prefixes: tuple[str, ...]


# Most specific prefix wins (A85 before A8). Order within the list doesn't matter.
STEPS: tuple[Step, ...] = (
    Step("residues", "Residue and contaminant limits", 1, 0, ("A2", "B2")),
    Step("labelling", "Labelling, marking and packaging rules", 1, 2, ("A3", "B3")),
    Step("hygiene", "Hygiene requirements", 1, 0, ("A4",)),
    Step("treatment", "Treatment to eliminate pests or pathogens", 1, 0, ("A5",)),
    Step("production", "Production and processing requirements", 1, 0, ("A6", "B4")),
    Step("identity", "Product identity and composition standards", 1, 0, ("B6", "B7")),
    Step("traceability", "Traceability records", 1, 0, ("A85", "B85")),
    Step("formalities", "Border formalities (consignment route, port of entry, import monitoring)", 1, 0,
         ("C2", "C3", "C4", "C9")),
    Step("importer_registration", "Importer registration", 2, 2, ("A15", "B15")),
    Step("product_registration", "Product or establishment registration", 2, 8, ("A81", "B81")),
    Step("testing", "Testing requirement", 2, 2, ("A82", "B82")),
    Step("certification", "Certificate requirement", 2, 1, ("A83", "B83")),
    Step("inspection", "Inspection at the border", 2, 0, ("A84", "B84")),
    Step("quarantine", "Quarantine requirement", 2, 2, ("A86",)),
    Step("conformity_other", "Other conformity assessment", 2, 2, ("A8", "A89", "B8", "B89", "A9", "B9")),
    Step("preshipment", "Pre-shipment inspection", 2, 1, ("C1",)),
    Step("systems_approach", "Combined SPS import conditions (systems approach)", 2, 4, ("A13",)),
    Step("other_restriction", "Other SPS/TBT import restrictions", 2, 2, ("A19", "B19", "A1", "B1")),
    Step("authorization", "Import authorization (special permit)", 3, 12, ("A14", "B14")),
    Step("licence", "Import licence, quota or other restriction", 3, 12, ("E1", "E2", "E5", "E6", "E9")),
    Step("prohibition", "Import prohibition", 3, 12, ("A11", "A12", "B11", "E3")),
)

# Codes that, when aimed specifically at Canada, mean no legal route exists today.
PROHIBITION_PREFIXES = ("A11", "A12", "B11", "E3")

SKIPPED_CHAPTERS = set("DFGHIJKLMNOP")


def _match(code: str) -> Step | None:
    code = code.strip().upper()
    best: tuple[int, Step] | None = None
    for step in STEPS:
        for p in step.prefixes:
            if code.startswith(p) and (best is None or len(p) > best[0]):
                best = (len(p), step)
    return best[1] if best else None


def step_for(code: str) -> Step | None:
    """The practical step an NTM code stands for, or None when it isn't a compliance step (chapters D, F-P).

    Unknown codes inside the compliance chapters (A, B, C, E) fall back to a conservative tier-2 step, so new
    UNCTAD codes are never silently dropped.
    """
    code = (code or "").strip().upper()
    if not code or code[0] in SKIPPED_CHAPTERS:
        return None
    step = _match(code)
    if step is None and code[0] in "ABCE":
        return next(s for s in STEPS if s.key == "conformity_other")
    return step


def tier_for(code: str) -> int | None:
    step = step_for(code)
    return step.tier if step else None


def is_prohibition(code: str) -> bool:
    return (code or "").strip().upper().startswith(PROHIBITION_PREFIXES)


def targets_canada(affected: str | None) -> bool:
    """True when the measure names Canada among the affected countries (not just 'World' / all origins)."""
    return "canada" in (affected or "").lower()
