"""Assemble D:/Users/ashenoy00000/delphi-work/agents2/bm-funding-materials.json and verify that every evidence_quote
appears verbatim (after whitespace/quote normalisation) in a saved page text under data/bm-funding/.
Run: python -I -X utf8 build_result.py
"""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # -I removes cwd; add script dir explicitly
from build_part1 import TABLE
from build_part2 import TABLE2
from build_part3 import FINDINGS, KEY_CLAIMS

OUT = "D:/Users/ashenoy00000/delphi-work/agents2/bm-funding-materials.json"
DATA = "D:/Users/ashenoy00000/delphi-work/data/bm-funding/"

def norm(s):
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    s = s.replace("\ufffd", "").replace("\u2013", "-").replace("\u2014", "-")
    return re.sub(r"\s+", " ", s).lower()

corpus = {}
for p in glob.glob(DATA + "*.txt"):
    corpus[p] = norm(open(p, encoding="utf-8", errors="replace").read())

def check(q):
    if not q: return "empty"
    nq = norm(q).replace("\u20ac", "").replace("\u00a3", "").replace("\u00d7", "x")
    for p, t in corpus.items():
        tt = t.replace("\u20ac", "").replace("\u00a3", "").replace("\u00d7", "x")
        if nq in tt: return os.path.basename(p)
    return None

bad = []
for sec, items in (("finding", FINDINGS), ("key_claim", KEY_CLAIMS)):
    for it in items:
        r = check(it.get("evidence_quote", ""))
        if r is None:
            bad.append((sec, it["claim"][:70], it["evidence_quote"][:80]))
print("quotes not found verbatim in saved pages:", len(bad))
for b in bad: print("  ", b)

SUMMARY = (
 "Read on 2026-11-12. Most promising funded routes for a Lean-checked, Formlabs-printed responsive biomaterial offered to an architecture practice: "
 "(1) US, rolling: NSF 26-521 (Biomaterials and other MPS materials programmes; 1 proposal per person per fiscal year) and NSF 26-515 (CMMI: AMDO manufacturing, MAMS mechanics of engineered and biological materials), both 'Proposals Accepted Anytime', each about USD 100M for 200-300 awards (own mean 0.33-0.5M and 0.36-0.44M). "
 "(2) US, scheduled but unannounced: DMREF (USD 1.5-2.0M, 4 yr) is biennial in odd years; last window Jan 21-Feb 4 2025, next not published. NSF Future Manufacturing is closed (replacement promised for FY 2026, not found). "
 "(3) UK/EU with dated deadlines: NMIP Digital Materials Sandpit (closes 26 Nov 2026, UK research orgs), ERC Consolidator (12 Jan 2027), Innovate UK Investor Partnerships NMIP-1 (19 Jan 2027, UK SMEs), EIC Pathfinder Open (stage 1: 25 Feb 2027, up to EUR 4M, 3-country consortium), EPSRC responsive mode (no deadline, UK institutions). "
 "Crossref funder metadata for seven precedent hygromorph-architecture papers names SNSF, DFG, Innosuisse, DBU and EPSRC (no US agency). "
 "Private foundations in the brief are mostly closed doors (Autodesk invite-only; Schmidt no unsolicited; Simons LOI missed; Sloan unreadable; Holcim awards ended). "
 "Could not read any open DARPA, ARPA-E or DOE call. Earlier-file check: Flexible 80A V2's datasheet does give +8 percent mass in water at 1 day (confirming spec-formlabs-materials), which contradicts the blanket 'under 1 percent for every SLA resin' in spec-resin-chemistry; the two Formlabs documents disagree, and that disagreement is itself a fundable measurement question."
)

LAY = (
 "Researchers who want money for this kind of work mostly apply to science agencies, and each agency has its own calendar. "
 "In the United States the easiest doors right now are two National Science Foundation programmes that take applications at any time of year, each handing out a few hundred modest grants. "
 "The bigger prize, a multi-million-dollar materials-design grant, only opens every second year and the next date has not been announced. "
 "In the United Kingdom and Europe there are several dated deadlines between late November 2026 and February 2027, but most require a UK or European applicant. "
 "Think of it as a train timetable: some trains run all day, some leave in January, and a few have no published departure. "
 "Private foundations were mostly closed or invitation-only, so they are not a quick route."
)

GLOSSARY = [
 {"term": "NSF", "plain": "National Science Foundation, the main US government funder of basic science."},
 {"term": "DMREF", "plain": "An NSF programme that funds teams who design new materials by looping between theory, computer simulation and experiments."},
 {"term": "Rolling / accepted anytime", "plain": "You can submit on any day; there is no single closing date."},
 {"term": "Solicitation", "plain": "The official document that describes a funding programme, its rules and its dates."},
 {"term": "LOI (letter of intent)", "plain": "A short first application that a funder uses to decide whom to invite to submit a full one."},
 {"term": "SBIR / STTR", "plain": "US small-business research grants; only companies can apply (STTR must partner with a university)."},
 {"term": "EPSRC", "plain": "The UK council that funds engineering and physical sciences research."},
 {"term": "Innovate UK", "plain": "The UK agency that funds business innovation projects."},
 {"term": "SME", "plain": "Small or medium-sized enterprise, a company below a size limit."},
 {"term": "EIC Pathfinder", "plain": "A European Union programme for early, high-risk technology ideas, funded as consortia from several countries."},
 {"term": "ERC", "plain": "European Research Council, which funds single lead researchers for five-year projects."},
 {"term": "FEC (full economic cost)", "plain": "A UK way of costing a project, including overheads; EPSRC pays 80 percent of it."},
 {"term": "Hygromorph", "plain": "A material that bends or curls when it takes up or loses moisture, like a pine cone scale."},
 {"term": "Lean-checked", "plain": "A mathematical statement that a proof-checking program (Lean) has verified step by step."},
 {"term": "Crossref funder metadata", "plain": "The list of funders that a paper's publisher recorded for that paper."},
]

REPRODUCE = [
 {"what": "Fetch every page and record url/date/bytes/sha256 (needs Python 3 stdlib only)",
  "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/fetch.py name=url ...  (URLs are in the table 'source' column; manifest at D:/Users/ashenoy00000/delphi-work/data/bm-funding/manifest.tsv)",
  "expected": "'OK <name> 200 <bytes>' per page; sites that returned 403/404/429 to my client (sloan.org, erc.europa.eu PDF, EU portal) will fail again or may change."},
 {"what": "Search a saved page for the quoted sentence", "command_or_url": "python -I -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/grep.py mps26521.txt 'Proposals Accepted Anytime' 150 2",
  "expected": "Shows 'Full Proposal Deadline(s) (due by 5 p.m. ...): Proposals Accepted Anytime' for NSF 26-521."},
 {"what": "Check DMREF recurrence and last window", "command_or_url": "https://www.nsf.gov/funding/opportunities/dmref-designing-materials-revolutionize-engineer-our-future/nsf25-508/solicitation",
  "expected": "'January 21, 2025 - February 04, 2025' and 'competitions biennially in odd-numbered years'. If NSF posts a newer solicitation, this row will be out of date."},
 {"what": "Own arithmetic (mean awards, days to deadline)", "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/calc.py",
  "expected": "MPS mean 333333-500000; CMMI 363636-444444; sandpit 890000-2373333 GBP; day counts from 2026-11-12."},
 {"what": "Precedent-funder pull from Crossref", "command_or_url": "python -I -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/precedent_funders.py",
  "expected": "DOI | title | year | funders per paper; the Reichert/Menges query may return HTTP 429 (rate limit) and then be skipped; check each printed title matches the intended paper."},
 {"what": "Re-read the Flexible 80A V2 water row (pdftotext, Poppler)", "command_or_url": "pdftotext -raw <saved Flexible-80A-V2-TDS.pdf> out.txt ; grep -A2 'Deionized Water' out.txt",
  "expected": "1 day -26 +8% +3% 94% 89% / 1 week -27 +9% +7% 101% 88%. With -layout the rows are scrambled."},
 {"what": "Rebuild this JSON and check every quote against the saved pages", "command_or_url": "python -I -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/build_result.py",
  "expected": "Prints the count of quotes not found verbatim (Crossref JSON quotes are expected to be listed) and writes bm-funding-materials.json."},
]

CITATIONS = [
 {"authors": "Timoshenko, S.", "year": 1925, "title": "Analysis of Bi-Metal Thermostats", "doi_or_arxiv": "10.1364/josa.11.000233",
  "verified": True, "how_verified": "Crossref API https://api.crossref.org/works/10.1364/josa.11.000233 returned HTTP 200 on 2026-11-12 with title 'Analysis of Bi-Metal Thermostats', Journal of the Optical Society of America, issued 1925-09.",
  "venue": "Journal of the Optical Society of America", "used_for": "The bilayer law whose 3/2 ceiling is the project's anchor result; context only, the funding findings do not depend on it."},
 {"authors": "Wood, D.; Vailati, C.; Menges, A.; Rueggeberg, M.", "year": 2018, "title": "Hygroscopically actuated wood elements for weather responsive and self-forming building parts - Facilitating upscaling and complex shape changes", "doi_or_arxiv": "10.1016/j.conbuildmat.2017.12.134",
  "verified": True, "how_verified": "Crossref API https://api.crossref.org/works/10.1016/j.conbuildmat.2017.12.134 returned HTTP 200 on 2026-11-12; funder field lists Swiss National Foundation award 163191 and GETTYLAB.",
  "venue": "Construction and Building Materials", "used_for": "Precedent funder evidence (SNSF, GETTYLAB) for hygromorphic architecture research."},
 {"authors": "Grönquist, P.; Panchadcharam, P.; Wood, D.; Menges, A.; Rüggeberg, M.", "year": 2020, "title": "Computational analysis of hygromorphic self-shaping wood gridshell structures", "doi_or_arxiv": "10.1098/rsos.192210",
  "verified": True, "how_verified": "Returned by the Crossref bibliographic query in precedent_funders.py on 2026-11-12 (title matched my query); funder field lists DFG EXC 2120/1, Innosuisse 25114.2, DBU 34714/01. Author family names and year read from the same Crossref record (https://api.crossref.org/works/10.1098/rsos.192210).",
  "venue": "Royal Society Open Science", "used_for": "Precedent funder evidence (DFG, Innosuisse, DBU)."},
 {"authors": "Holstov, A.; Bridgens, B.; Farmer, G.", "year": 2015, "title": "Hygromorphic materials for sustainable responsive architecture", "doi_or_arxiv": "10.1016/j.conbuildmat.2015.08.136",
  "verified": True, "how_verified": "Returned by the Crossref bibliographic query in precedent_funders.py on 2026-11-12 (title matched my query); funder field lists EPSRC and Newcastle University School of Architecture, Planning and Landscape. Authors read from https://api.crossref.org/works/10.1016/j.conbuildmat.2015.08.136 (HTTP 200).",
  "venue": "Construction and Building Materials", "used_for": "Precedent funder evidence (EPSRC) for UK hygromorphic architecture work."},
 {"authors": "Vailati, C.; Bachtiar, E.; Hass, P.; Burgert, I.; Rüggeberg, M.", "year": 2018, "title": "An autonomous shading system based on coupled wood bilayer elements", "doi_or_arxiv": "10.1016/j.enbuild.2017.10.042",
  "verified": True, "how_verified": "Crossref API https://api.crossref.org/works/10.1016/j.enbuild.2017.10.042 returned HTTP 200 on 2026-11-12; funder field lists Deutsche Forschungsgemeinschaft and Swiss National Foundation.",
  "venue": "Energy and Buildings", "used_for": "Precedent funder evidence (DFG, SNSF) for building-scale wood bilayers."},
]

COULD_NOT_FIND = [
 "DMREF next deadline: no solicitation after NSF 25-508 exists on the pages I read; a 2027 window is only inferred from the 'odd-numbered years' sentence.",
 "NSF Future Manufacturing replacement solicitation (promised for FY 2026): none found as of 2026-11-12; deadline unreadable.",
 "Any open DARPA, ARPA-E, DOE EERE (AMMTO, BTO) call: DARPA and DOE pages are JavaScript-rendered or returned 404, ARPA-E eXCHANGE is decommissioned; award sizes and deadlines unreadable. Search summaries said ARPA-E HESTIA (building materials) is past its cycle, unverified.",
 "Sloan Foundation: sloan.org returned HTTP 403 to my client, so no programme, award size or deadline was read from the primary site.",
 "MIT-adjacent programmes: not searched beyond context; nothing fetched.",
 "ERC Starting Grant 2027 deadline: the saved ERC page has no date for it; the 14 Oct 2026 date is from a search summary only.",
 "ERC Work Programme 2027 PDF (HTTP 403) and the EU Funding and Tenders portal (JavaScript/500): Horizon Europe topic dates and budgets rely on a consultancy table (accelopment.com), medium confidence.",
 "Graham Foundation production and R&D grant amounts (USD 20k / 10k): from search summaries only; I saved the Carter Manny page, not the grant-type pages.",
 "UK association status for EIC Pathfinder eligibility and whether a London architecture practice qualifies as an eligible Innovate UK SME: not checked.",
 "Schmidt Sciences current open-call list (dynamic page, empty in HTML); April 2026 deadline of the matter-modeling pilot only from search summaries.",
 "NIH institute-level (NIBIB) notices: only the parent R01 was read; fit rating for NIH is a judgement, not a quoted scope statement.",
 "Typical (median) award size for NSF 26-521 and 26-515: only totals and counts are published in the solicitations; my means are arithmetic, not stated figures.",
 "Heavy-command headroom: C: had 404 MB free (under the 1 GB rule), so I ran only light commands (HTTP fetches, small Python and pdftotext); D: had 9.6 GB free; total downloaded here is a few MB.",
 "Reichert/Menges 'Meteorosensitive architecture' paper funder lookup: Crossref returned HTTP 429 and I did not retry.",
]

RECOMMENDATIONS = [
 "Now-ish (US): pick ONE of NSF 26-521 (BMAT/POL) or NSF 26-515 (MAMS/AMDO) for a rolling submission; 26-521 allows one proposal per person per fiscal year so the choice matters; contact the listed programme team (bmat/pol or cmmi-mams/cmmi-amdo mailboxes on the solicitation) with a one-page summary before writing.",
 "Prepare, do not yet write, a DMREF proposal: watch the DMREF page for the next solicitation (expected odd-year window, early 2027 by the pattern); needs two or more senior personnel.",
 "Run the cheap measurement first (Flexible 80A V2 vs Silicone 40A or Rigid 10K, humid-air and immersion swelling, plus diffusivity): the Formlabs cube-test vs datasheet disagreement (0.7 vs +8 percent) is the concrete preliminary result every programme above will want.",
 "If the architecture partner is UK-based, test whether a UK university PI would co-lead an EPSRC responsive-mode grant (no deadline) and whether the practice is an eligible SME for Innovate UK Investor Partnerships (closes 19 Jan 2027, needs private investor money).",
 "For a European consortium route, EIC Pathfinder Open stage 1 (25 Feb 2027) is the only large dated target with a fit; it needs three partner countries.",
 "Do not spend effort on Autodesk Foundation, Schmidt, Simons or Holcim now; revisit Graham (25 Feb 2027) only for a small exhibition/prototype grant led by the practice.",
 "Re-read the DARPA/ARPA-E/DOE listings by hand in a browser (JavaScript pages) before ruling them out.",
]

result = {
 "label": "bm-funding-materials",
 "topic": "Funding for responsive biomaterials and computational architecture",
 "summary": SUMMARY, "lay_summary": LAY, "glossary": GLOSSARY,
 "table": TABLE + TABLE2, "findings": FINDINGS, "key_claims": KEY_CLAIMS,
 "reproduce": REPRODUCE, "citations": CITATIONS, "could_not_find": COULD_NOT_FIND,
 "recommendations": RECOMMENDATIONS,
 "scripts_written": [
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/fetch.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/grep.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/calc.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/precedent_funders.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/build_part1.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/build_part2.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/build_part3.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-funding-materials/build_result.py",
 ],
}
json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("wrote", OUT, os.path.getsize(OUT), "bytes;", len(result["table"]), "table rows;", len(FINDINGS), "findings")
