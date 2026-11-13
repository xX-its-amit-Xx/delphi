import json
R = "2026-11-12"
NSF_EMB = "https://www.nsf.gov/funding/opportunities/emb-emerging-mathematics-biology/nsf25-509/solicitation"
NSF_CORE = "https://www.nsf.gov/funding/opportunities/bio-core-core-research-biological-sciences/nsf26-517/solicitation"
NSF_MCB = "https://www.nsf.gov/funding/opportunities/mcb-division-molecular-cellular-biosciences-core-programs/nsf24-539/solicitation"
MIRA = "https://www.nigms.nih.gov/Research/mechanisms/MIRA/Pages/default"
R01 = "https://grants.nih.gov/grants-process/submit/submission-policies/standard-due-dates"
HFSP = "https://www.hfsp.org/funding/hfsp-funding/research-grants"
WELL = "https://wellcome.org/research-funding/schemes/wellcome-discovery-awards"
TLS = "https://www.templeton.org/funding-areas/life-sciences"
TCAL = "https://www.templeton.org/grants/grant-calendar"
ARPAH = "https://arpa-h.gov/explore-funding/open-funding-opportunities"
AST = "https://astera.org/residency/"
CONV = "https://www.convergentresearch.org/get-involved"
ANT1 = "https://www.anthropic.com/news/ai-for-science-program"
ANT2 = "https://www.anthropic.com/news/ai-for-science-expands-foundations-research-institutions"
COEF = "https://coefficientgiving.org/funds/science-and-global-health-rd/"
SCH = "https://www.schmidtsciences.org/ai-in-science/"


def row(n, f, s):
    return {"name": n, "fields": f + "; read=" + R, "source": s}


table = [
    row("NSF Emerging Mathematics in Biology (eMB) NSF 25-509",
        "award=$2M-$6M total per FY25-26, 10-15 awards/yr, 3 yr; eligibility=US institutions of higher education; deadline=March 1 annually (page lists March 02 2026; next about March 1 2027, inferred); fit_formal_verification=low-medium; fit_prereg_prediction=medium; fit_organism_circuit_design=medium", NSF_EMB),
    row("NSF Core Research in Biological Sciences (BIO Core) NSF 26-517",
        "award=$280M program budget, 250-300 awards (per-award size not read); eligibility=IHEs confirmed, other categories not read; deadline=any time; Systems and Synthetic Biology listed; fit_formal_verification=low; fit_prereg_prediction=medium; fit_organism_circuit_design=medium-high", NSF_CORE),
    row("NSF Mathematical Biology (DMS) program page",
        "award=not stated; deadline=NOT READ (secondary search snippets conflict); fit_formal_verification=low-medium; fit_prereg_prediction=medium; fit_organism_circuit_design=low",
        "https://www.nsf.gov/funding/opportunities/mathematical-biology"),
    row("NSF MCB core NSF 24-539", "status=ARCHIVED, replaced by NSF 26-517; do not target", NSF_MCB),
    row("NIGMS MIRA R35 (PAR-26-121 established/new; PAR-27-032 early-stage)",
        "award=amount NOT READ; term=5 years; applications accepted 2026-2028 for PAR-26-121; fit_formal_verification=low-medium; fit_prereg_prediction=medium; fit_organism_circuit_design=medium", MIRA),
    row("NIH R01 standard due dates (route for NIGMS, NHGRI, NICHD)",
        "new R01 due dates=February 5, June 5, October 5; award size not on page; institute-level fit not verified", R01),
    row("NHGRI funding opportunities", "page fetched, no specific programme or deadline extracted; deadline=NOT READ",
        "https://www.genome.gov/research-funding/Funding-Opportunities"),
    row("NICHD grants and contracts", "page fetched, no specific programme or deadline extracted; deadline=NOT READ",
        "https://www.nichd.nih.gov/grants-contracts"),
    row("HFSP Research Grants (Early Career and Program)",
        "award=three-year team grants, amount NOT READ (award page 404); eligibility=international teams; LOI deadline 26 March 2026 (award year 2027), full proposals mid-Sept 2026 by invitation; next cycle dates not published on page; fit_formal_verification=low; fit_prereg_prediction=low-medium; fit_organism_circuit_design=medium", HFSP),
    row("Wellcome Discovery Awards",
        "award=no min/max, average GBP 3.5M, above GBP 5M extra scrutiny; duration up to 8 yr; deadline=none, apply any time; fit_formal_verification=low-medium; fit_prereg_prediction=medium; fit_organism_circuit_design=medium", WELL),
    row("Templeton Foundation Life Sciences (OFI 2026 cycle)",
        "award=budget not stated, duration up to 3 yr; priorities=emergent properties incl. agency and intelligence in living or synthetic systems; OFI deadline July 15 2026 PASSED, full proposal Dec 4 2026 (invited), 2027 dates announced in new year; fit_formal_verification=low; fit_prereg_prediction=medium; fit_organism_circuit_design=medium", TLS + " ; " + TCAL),
    row("ARPA-H open funding opportunities",
        "programmes listed=EHI, UNIQUE, SURPASS, SPECTRA; Mission Office ISOs rolling; award size not on page; fit_formal_verification=low; fit_prereg_prediction=low-medium; fit_organism_circuit_design=low", ARPAH),
    row("DARPA Biological Technologies Office opportunities", "listing filtered results not in static page; deadlines NOT READ",
        "https://www.darpa.mil/work-with-us/opportunities"),
    row("Schmidt Sciences",
        "no open biosciences call found; AI in Science postdoc fellowships via nine partner universities (about 160 postdocs/yr); closed 2026 calls (Apr 30, May 17) only from search snippets, unverified; deadlines NOT READ", SCH),
    row("Astera Institute Residency",
        "award=salary USD 125,000-250,000/yr plus project budget USD 0-1.5M, 12-18 months, Emeryville CA; cohort deadline NOT READ; fit_formal_verification=medium (open tools); fit_prereg_prediction=medium; fit_organism_circuit_design=medium", AST),
    row("Convergent Research (FRO incubator)",
        "ideas accepted any time; award size not stated; Lean FRO is a listed FRO (proof infrastructure precedent); fit_formal_verification=medium-high as a tool-building route; fit_organism_circuit_design=medium", CONV),
    row("Anthropic AI for Science",
        "award=free API credits, amount not stated; apply by form, no deadline stated; fit_formal_verification=medium; fit_prereg_prediction=medium; fit_organism_circuit_design=medium", ANT1 + " ; " + ANT2),
    row("Coefficient Giving (formerly Open Philanthropy) Science and Global Health R&D",
        "only open call seen=RFP on Vaccine Impact Optimization up to $30M; not a fit for morphogenesis", COEF),
    row("Simons Foundation funding opportunities",
        "life-science items seen=Ecology and Evolution fellowships/collaborations, Plant Biology postdocs, Synthetic Plant Biology; deadlines and awards NOT READ",
        "https://www.simonsfoundation.org/funding-opportunities/"),
]

F = []


def f(c, s, conf, q=""):
    F.append({"claim": c, "source": s, "confidence": conf, "evidence_quote": q})


f("NSF eMB 25-509 deadline March 1 annually", NSF_EMB, "high",
  "Full Proposal Deadline(s) (due by 5 p.m. submitting organization's local time): March 02, 2026 March 1, Annually Thereafter")
f("eMB expects about 10-15 awards per year", NSF_EMB, "high",
  "The eMB program expects to fund approximately 10-15 awards per year, depending on the quality of submissions and the availability of funds.")
f("eMB total funding $2M to $6M, 3 years", NSF_EMB, "high",
  "Anticipated Funding Amount: $2,000,000 to $6,000,000 Up to $6,000,000 total for FY25-26")
f("NSF BIO Core 26-517 anticipates 250-300 awards and $280M", NSF_CORE, "high",
  "Estimated Number of Awards: 250 to 300 Anticipated Funding Amount: $280,000,000")
f("NSF BIO Core accepts proposals any time (page text shows deadline 'any time')", NSF_CORE, "medium",
  "Full Proposal Deadline(s) any time")
f("NSF MCB 24-539 archived, replaced by 26-517", NSF_MCB, "high",
  "Posted: February 13, 2024 Replaces: NSF 23-548 Replaced by: NSF 26-517")
f("NIGMS MIRA grants are generally 5 years", MIRA, "high",
  "MIRA grants will generally be for 5 years, for both established investigators/ new investigators and early stage investigators .")
f("NIH new R01 standard dates Feb 5, Jun 5, Oct 5", R01, "medium",
  "R01 new Research Grants February 5 June 5 October 5")
f("HFSP research grants are three-year team grants", HFSP, "high",
  "HFSP Research Grants are team grants providing financial support to the team for three years")
f("HFSP full proposals are by invitation about mid-September", HFSP, "high",
  "Full proposals are then due around the middle of September, on invitation only.")
f("Wellcome Discovery Awards have no deadline", WELL, "high",
  "There are no deadlines for applications to this scheme. Applications can be submitted at any time.")
f("Wellcome Discovery average GBP 3.5M, above GBP 5M scrutinised", WELL, "high",
  "The average size of a Discovery Award is £3.5 million. Applications above £5 million will be subject to additional scrutiny.")
f("Templeton 2026 OFI window closed", TCAL, "high",
  "The 2026 OFI Deadline has now passed. The Foundation is not accepting new requests at this time.")
f("Templeton Life Sciences projects up to 3 years", TLS, "high",
  "The proposed project duration should be no more than three years and requested budgets should be well-justified and appropriate for the needs of the project.")
f("ARPA-H Mission Office ISOs are rolling", ARPAH, "high",
  "Mission Office ISOs are accepted on a rolling basis.")
f("Astera residency salary USD 125k-250k", AST, "high",
  "Salary of between $125,000-250,000 annually (commensurate with experience) and benefits for the duration of your residency")
f("Convergent accepts FRO ideas any time", CONV, "high",
  "We gladly accept FRO idea submissions at any time.")
f("Anthropic AI for Science: apply by form", ANT1, "high",
  "Researchers attached to a research institution interested in the AI for Science program can apply through our application form .")
f("Anthropic expanded program Oct 28 2026 with 20 partners", ANT2, "high",
  "We’re highlighting 20 scientific foundations, institutions, and research groups from around the world that we’ve partnered with in an expansion of our AI for Science program")
f("Schmidt AI in Science fellowship numbers", SCH, "medium (from WebFetch summary, not raw-checked)",
  "We annually support approximately 160 Postdoctoral Fellows and 20 Faculty Fellows across nine partner universities.")
f("Coefficient RFP vaccine up to $30M", COEF, "high",
  "An open call for expressions of interest for up to $30 million of work that increases the health impact of existing and late-stage vaccines")
f("No funder page read has a programme naming formal verification of biology (my synthesis of absence; nearest routes are Convergent FROs and open-tools residencies)",
  "own synthesis", "low")

out = {
    "label": "pp-funding-computational-biology",
    "topic": "Funding for computational and formal biology of form, circuits and morphogenesis",
    "summary": "Read " + R + ". Primary-page verified: NSF eMB (March 1 annual, $2-6M total, 10-15 awards), NSF BIO Core 26-517 (any time, $280M), NIH R01 dates, NIGMS MIRA (5 yr), HFSP (annual, LOI end March), Wellcome Discovery Awards (any time, avg GBP 3.5M), Templeton Life Sciences (2026 OFI closed), ARPA-H rolling ISOs, Astera residency, Convergent FRO ideas (always open), Anthropic AI for Science credits. No page read funds formal verification of biology by name. Not read or no extractable terms: Schmidt open calls, DARPA, Sloan, Moore, CZI/Biohub, HHMI, NHGRI/NICHD specifics, OpenAI, Google, NVIDIA, Simons deadlines, and award sizes for MIRA, HFSP, Templeton. Fit ratings are my own judgement.",
    "lay_summary": "We looked up who pays for research that uses maths and computers to understand how living things get their shape. Think of it as a list of doors you could knock on. The surest open doors are two US National Science Foundation programmes, a UK charity called Wellcome that takes applications at any time, and a few groups that fund open tools. Nobody we read has a scheme for proving biology results with software proof checkers, so that idea would need pitching as maths-and-biology or as a shared tool. Several big funders could not be read from their websites, and we say so instead of guessing.",
    "findings": F,
    "key_claims": [
        {"claim": "NSF eMB 25-509 is an annual call due March 1 with $2M-$6M total and 10-15 awards", "source": NSF_EMB, "evidence_quote": "Full Proposal Deadline(s) (due by 5 p.m. submitting organization's local time): March 02, 2026 March 1, Annually Thereafter"},
        {"claim": "NSF BIO Core 26-517 replaced the MCB core solicitation and accepts proposals any time", "source": NSF_MCB, "evidence_quote": "Posted: February 13, 2024 Replaces: NSF 23-548 Replaced by: NSF 26-517"},
        {"claim": "Wellcome Discovery Awards have no deadline and average GBP 3.5M", "source": WELL, "evidence_quote": "There are no deadlines for applications to this scheme. Applications can be submitted at any time."},
        {"claim": "No programme read explicitly funds formal verification of biology", "source": "all pages in table", "evidence_quote": ""},
    ],
    "reproduce": [{"what": "Re-fetch all pages, print byte size and sha256 prefix (needs curl and python3)", "command_or_url": "bash D:/Users/ashenoy00000/delphi-work/agents2/scripts/pp-funding-computational-biology/run_all.sh", "expected": "15 lines of name, bytes, hash prefix; text in D:/Users/ashenoy00000/delphi-work/agents2/scratch/pp-funding-computational-biology/*.txt, grep the quoted strings. Pages change over time so hashes may differ."}],
    "table": table,
    "recommendations": [
        "Target NSF eMB (about March 1 2027) and BIO Core (rolling) first; pitch formal verification as mathematical innovation tied to real systems.",
        "Wellcome Discovery Awards (rolling) if a UK-eligible host exists.",
        "Send Convergent a Lean-for-biology FRO idea (always open).",
        "Apply for Anthropic AI for Science credits (no deadline stated).",
        "Re-read Schmidt, DARPA BTO, Moore, Sloan, Simons, CZI/Biohub in a browser; static fetch failed or gave no terms."],
    "glossary": [
        {"term": "Funding programme", "plain": "A named pot of money with rules for who can ask."},
        {"term": "FRO", "plain": "Focused research organisation: a time-limited non-profit built to make one tool a whole field needs."},
        {"term": "Formal verification", "plain": "Using software to prove a claim is logically correct."},
        {"term": "Pre-registered prediction", "plain": "Writing down a forecast before the data exists so it cannot be changed later."},
        {"term": "Morphogenesis", "plain": "How living things develop their shape."},
        {"term": "API credits", "plain": "Free use of an AI service instead of cash."}],
    "citations": [],
    "could_not_find": [
        "Award size not read: NIGMS MIRA, HFSP (award page 404), Templeton, ARPA-H ISOs, Simons, Convergent, Anthropic credits",
        "Deadlines not read: NSF Mathematical Biology (conflicting search snippets), HFSP award year 2028, DARPA BTO, Schmidt open calls, Astera next cohort, NHGRI, NICHD, Simons",
        "Pages empty or failed: Sloan (empty body), Moore (404), Templeton old URL, NSF IOS/MCB program pages (error page), openai.com/science, CZI/Biohub (no funding info), HHMI, schmidtsciences.org/open-calls (404)",
        "Not fetched or no terms: Google/DeepMind, NVIDIA academic grants, Open Phil beyond one RFP",
        "No citations used; no DOIs",
        "Fit ratings are my judgement, not source content",
        "Search-snippet facts not verified on primary pages: Wellcome location-eligibility change after 28 Oct 2026, Schmidt closed 2026 calls, Astera April 19 deadline, NSF Math Biology submission window"],
}
with open("D:/Users/ashenoy00000/delphi-work/agents2/pp-funding-computational-biology.json", "w", encoding="utf8") as fh:
    json.dump(out, fh, indent=1, ensure_ascii=False)
print("ok")
