"""Deterministic document drafts: official template text, filled from the business profile.

No LLM here on purpose. Origin declarations and processor terms have fixed legal wording, so we fill
blanks in the official text instead of letting a model paraphrase it. Anything we don't know is left
as [___] and listed in missing_fields for the founder to complete.
"""

from datetime import date
from io import BytesIO

from app.models import BusinessProfile, Category, DocumentDraft, MarketEntry

D11 = "https://www.cbsa-asfc.gc.ca/publications/dm-md/d11/d11-4-14-eng.html"
GDPR = "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng"
BLANK = "[___]"

# Certification statement shared by CPTPP and CUSMA (CBSA Memorandum D11-4-14).
CERT_STATEMENT = (
    "I certify that the goods described in this document qualify as originating and the information "
    "contained in this document is true and accurate. I assume responsibility for proving such "
    "representations and agree to maintain and present upon request or to make available during a "
    "verification visit, documentation necessary to support this certification."
)

# Honey from Canadian hives is "wholly obtained" (an animal product obtained in the territory).
ORIGIN_CRITERION = {"honey": "A — wholly obtained in Canada (honey from Canadian hives)"}


def _v(value: str, label: str, missing: list[str]) -> str:
    if value and value.strip():
        return value.strip()
    missing.append(label)
    return BLANK


def _address(p: BusinessProfile, missing: list[str]) -> str:
    where = ", ".join(x for x in [p.city, p.province] if x) or _v("", "Company address", missing)
    email = _v(p.contact_email, "Contact email", missing)
    return f"{where}, Canada — {email}"


def _company_block(p: BusinessProfile, missing: list[str]) -> str:
    return f"{_v(p.company_name, 'Company legal name', missing)}, {_address(p, missing)}"


def origin_document(p: BusinessProfile, cat: Category, entry: MarketEntry) -> DocumentDraft | None:
    """The proof-of-origin text that makes the trade-agreement rate actually apply at the border.
    Only produced when the agreement saves duty (Australia's honey tariff is 0% anyway; Korea
    excluded honey from CKFTA; CUSMA doesn't exempt the US Section 338 tariff)."""
    if cat.kind != "goods" or not entry.trade_agreement or entry.mfn_rate <= entry.tariff_rate:
        return None
    agreement = entry.trade_agreement
    missing: list[str] = []
    today = date.today().isoformat()
    exporter = _v(p.company_name, "Company legal name", missing)
    goods = f"{p.product_name or cat.label} (HS {cat.hs_code})"
    saves = f"Claims the 0% rate instead of {entry.mfn_rate:.1%} at the {entry.country} border."

    if agreement.startswith("CETA") or "CUKTCA" in agreement:
        short = "CETA" if agreement.startswith("CETA") else "CUKTCA"
        bn = _v(p.business_number, "CRA Business Number (the 'customs authorisation No' for Canadian exporters)", missing)
        body = (
            f"ORIGIN DECLARATION ({short}) — write on the commercial invoice\n\n"
            f"(Period: from {today} to {BLANK})\n\n"
            f"The exporter of the products covered by this document (customs authorisation No {bn}) declares "
            f"that, except where otherwise clearly indicated, these products are of Canadian preferential origin.\n\n"
            f"Goods: {goods}\n\n"
            f"{_v(p.city, 'City', missing)}, {today}\n"
            f"{_v(p.contact_name, 'Name of the person signing', missing)}, for {exporter}\n"
            f"Signature: {BLANK}\n\n"
            "Note: the period line is only needed for a blanket declaration covering multiple shipments (max 12 months)."
        )
        return DocumentDraft(id="origin", title=f"{short} origin declaration", purpose=saves,
                             body=body, missing_fields=missing, source=D11)

    if agreement.startswith("CPTPP") or agreement.startswith("CUSMA"):
        short = "CPTPP" if agreement.startswith("CPTPP") else "CUSMA"
        criterion = ORIGIN_CRITERION.get(cat.id)
        body = (
            f"CERTIFICATION OF ORIGIN ({short}) — minimum data elements\n\n"
            f"1. Certifier: Exporter\n"
            f"2. Certifier name, address, email: {_company_block(p, missing)}\n"
            f"3. Exporter: {exporter} (same as certifier)\n"
            f"4. Producer: {exporter} (or: {BLANK} if different)\n"
            f"5. Importer: {_v('', f'Importer name and address in {entry.country}', missing)}\n"
            f"6. Description and HS classification: {goods}\n"
            f"7. Origin criterion: {criterion or _v('', 'Origin criterion', missing)}\n"
            f"8. Blanket period: from {today} to {BLANK} (optional, max 12 months)\n"
            f"9. Authorized signature and date: {_v(p.contact_name, 'Name of the person signing', missing)}, {today}\n\n"
            f"{CERT_STATEMENT}"
        )
        return DocumentDraft(id="origin", title=f"{short} certification of origin", purpose=saves,
                             body=body, missing_fields=missing, source=D11)

    if "CKFTA" in agreement:
        body = (
            "CKFTA CERTIFICATE OF ORIGIN — use CBSA form BSF760\n\n"
            f"Exporter: {_company_block(p, missing)}\n"
            f"Producer: {exporter}\n"
            f"Importer: {_v('', 'Importer name and address in South Korea', missing)}\n"
            f"Goods and HS code: {goods}\n"
            f"Preference criterion: {BLANK}\n"
            f"Signed: {_v(p.contact_name, 'Name of the person signing', missing)}, {today}\n\n"
            "Transfer these fields onto form BSF760 and send it to the Korean importer before the goods arrive."
        )
        return DocumentDraft(id="origin", title="CKFTA certificate of origin (BSF760 fields)", purpose=saves,
                             body=body, missing_fields=missing, source=D11)
    return None


def processor_terms(p: BusinessProfile, cat: Category, entry: MarketEntry) -> DocumentDraft | None:
    """GDPR / UK GDPR Art. 28(3) processor terms for SaaS selling into the EU or UK."""
    if cat.kind != "services" or entry.country_code not in {"DE", "GB"}:
        return None
    law = "UK GDPR" if entry.country_code == "GB" else "GDPR (Regulation (EU) 2016/679)"
    missing: list[str] = []
    processor = _v(p.company_name, "Company legal name", missing)
    product = p.product_name or "the Service"
    clauses = [
        ("Instructions", "The Processor processes Customer Personal Data only on the Customer's documented instructions, including for international transfers, unless required by law (Art. 28(3)(a))."),
        ("Confidentiality", "Everyone authorised to process the data is bound by confidentiality (Art. 28(3)(b))."),
        ("Security", "The Processor implements the technical and organisational measures in Annex 2, as required by Art. 32 (Art. 28(3)(c))."),
        ("Sub-processors", "The Processor engages sub-processors only with the Customer's prior written authorisation and on equivalent terms (Art. 28(2), (3)(d), (4)). Current list: Annex 3."),
        ("Data subject rights", "The Processor assists the Customer in responding to data subject requests (Art. 28(3)(e))."),
        ("Assistance", "The Processor assists with security, breach notification, DPIAs and prior consultation, Arts. 32–36 (Art. 28(3)(f))."),
        ("Deletion or return", "At the end of the service the Processor deletes or returns all Customer Personal Data, at the Customer's choice (Art. 28(3)(g))."),
        ("Audits", "The Processor makes available all information necessary to demonstrate compliance and allows audits (Art. 28(3)(h))."),
    ]
    transfer = ("International transfers: Customer Personal Data is processed in Canada. Canada is covered by an "
                + ("adequacy regulation recognised by the UK" if entry.country_code == "GB" else "EU Commission adequacy decision")
                + " for commercial organisations subject to PIPEDA, so no additional transfer mechanism is required.")
    body = (
        f"DATA PROCESSING AGREEMENT — DRAFT ({law}, Art. 28)\n\n"
        f"Between: {BLANK} (the 'Customer', controller) and {processor}, {_address(p, missing)} (the 'Processor').\n"
        f"Service: {product}\n\n"
        "Annex 1 — Processing details: subject matter, duration, nature and purpose, types of personal data, "
        f"categories of data subjects: {_v('', 'Processing details (Annex 1)', missing)}\n\n"
        + "\n".join(f"{i}. {t}. {c}" for i, (t, c) in enumerate(clauses, start=1))
        + f"\n\n{transfer}\n\n"
        f"Signed for the Processor: {_v(p.contact_name, 'Name of the person signing', missing)}, {date.today().isoformat()}\n\n"
        "Draft for review by counsel. This is not legal advice."
    )
    missing.extend(["Security measures (Annex 2)", "Sub-processor list (Annex 3)"])
    return DocumentDraft(id="dpa", title=f"{law.split(' (')[0]} data processing agreement",
                         purpose="Every EU/UK business customer will ask for this before signing.",
                         body=body, missing_fields=missing, source=GDPR)


def checklist(p: BusinessProfile, cat: Category, entry: MarketEntry) -> DocumentDraft:
    """Every requirement for the market, in order, with its official source."""
    lines = [f"MARKET ENTRY CHECKLIST — {cat.label} → {entry.country}", ""]
    if cat.kind == "goods":
        lines.append(f"Tariff you'll pay: {entry.tariff_rate:.0%}. {entry.tariff_note}\n")
    for i, r in enumerate(entry.compliance_requirements, start=1):
        effort = {1: "paperwork", 2: "registration / certificate", 3: "licence or approval"}[r.tier]
        wait = ""
        if r.lead_time_weeks:
            wait = f", ~{r.lead_time_weeks:g} week{'s' if r.lead_time_weeks != 1 else ''} before first shipment" + (
                " (estimate)" if r.lead_time_basis == "estimate" else "")
        lines.append(f"[ ] {i}. {r.name} — {effort}{wait}\n      {r.detail}\n      Source: {r.source}")
    if entry.shipping_route:
        lines.append(f"\nShipping: {entry.shipping_route}." + (f" Source: {entry.shipping_source}" if entry.shipping_source else ""))
    if entry.tax_note:
        lines.append(f"\nTax: {entry.tax_note}")
    for n in entry.notes:
        lines.append(f"Note: {n}")
    lines.append(f"\nData as of {entry.as_of}. Verify each item with the linked source before you ship.")
    return DocumentDraft(id="checklist", title=f"{entry.country} entry checklist",
                         purpose="Every requirement for this market, with its official source.",
                         body="\n".join(lines), missing_fields=[], source=entry.sources[0])


def drafts_for(p: BusinessProfile, cat: Category, entry: MarketEntry) -> list[DocumentDraft]:
    docs = [origin_document(p, cat, entry), processor_terms(p, cat, entry), checklist(p, cat, entry)]
    docs = [d for d in docs if d is not None]
    for d in docs:
        d.missing_fields = list(dict.fromkeys(d.missing_fields))  # dedupe, keep order
    return docs


def to_pdf(doc: DocumentDraft) -> bytes:
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    styles = getSampleStyleSheet()
    buf = BytesIO()
    story = [Paragraph(_esc(doc.title), styles["Title"]), Paragraph(_esc(doc.purpose), styles["Italic"]), Spacer(1, 12)]
    for para in doc.body.split("\n\n"):
        story += [Paragraph(_esc(para).replace("\n", "<br/>"), styles["BodyText"]), Spacer(1, 8)]
    story.append(Paragraph(f"Source: {_esc(doc.source)}", styles["Italic"]))
    SimpleDocTemplate(buf, pagesize=LETTER, title=doc.title,
                      leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54).build(story)
    return buf.getvalue()


def _esc(s: str) -> str:
    # Built-in PDF fonts can't draw CJK; our documents are English, but keep the arrow/dash readable.
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("→", "->")
