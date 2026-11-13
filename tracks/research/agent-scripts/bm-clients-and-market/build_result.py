"""Builds D:/Users/ashenoy00000/delphi-work/agents2/bm-clients-and-market.json.
Every evidence_quote is pulled from quotes.py (each already checked verbatim against the saved page) or checked here against the saved NSF API JSON.
Run:  python -I build_result.py      (re-runs the quote check first; stops if any quote is missing)"""
import json, sys, glob, os, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import quotes
missing = quotes.check()
if missing:
    sys.exit("missing quotes: %s" % missing)
Q = quotes.Q
OUT = "D:/Users/ashenoy00000/delphi-work/agents2/bm-clients-and-market.json"
NSFD = "D:/Users/ashenoy00000/delphi-work/data/bm-clients-market/nsf/"
nsf_text = " ".join(open(f, encoding="utf-8").read() for f in glob.glob(NSFD + "*.json"))

def F(claim, key=None, conf="high", value=None, source=None, quote=None):
    d = {"claim": claim, "confidence": conf}
    if key:
        d["source"] = Q[key][1]
        d["evidence_quote"] = Q[key][2]
    else:
        d["source"] = source or ""
        d["evidence_quote"] = quote or ""
    if value is not None:
        d["value"] = value
    return d

def NSF(claim, award_id, title, amount, conf="high"):
    assert ('"id":"%s"' % award_id) in nsf_text.replace(" ", "") or award_id in nsf_text, award_id
    assert title in nsf_text, title
    assert str(amount) in nsf_text, amount
    return {"claim": claim, "confidence": conf,
            "source": "https://api.nsf.gov/services/v1/awards.json?keyword=...&fundProgramName=SBIR+Phase+I (award id %s; saved JSON under data/bm-clients-market/nsf/)" % award_id,
            "evidence_quote": title, "value": "estimatedTotalAmt=%s USD" % amount}

findings = []
A = findings.append

# ---------- Mamou-Mani and Fab.Pub: who pays them ----------
A(F("Mamou-Mani's Tate Modern Turbine Hall piece (2025-26) was delivered inside an artist commission whose sponsor is Hyundai Motor; the practice is the architecture studio partner, so the payer of record is the artist/commission, not a materials buyer.", "tate_hyundai", value="sponsor=Hyundai Motor"))
A(F("The same Tate project used an independent structural engineer (Webb Yates Engineers) for suspension and load tests of the printed parts, i.e. a consultancy is already in the verification chain for printed architectural pieces.", "tate_webbyates"))
A(F("Neko Health is the named client of the Monolith Wall (260 printed panels in recycled PETG per the earlier record); Fab.Pub, not the practice, is the producer.", "neko_client", value="panels=260 (earlier record agents2/bm-mamou-mani-portfolio.json)"))
A(F("COS is the named client of Conifera, the 700-module PLA pavilion (Milan 2019); the project is a brand-funded installation.", "cos_client", value="modules=700 (earlier record)"))
A(F("Hermes is the named client of the Beijing Sanlitun facade, done by RDAI in collaboration with Mamou-Mani: a luxury retail client buying a facade through a lead architect, with Mamou-Mani as sub-consultant.", "hermes_client"))
A(F("Buro Happold, an engineering consultancy, was the client for Mamou-Mani's Wooden Waves ceiling installation: an engineering firm has already commissioned this practice.", "bh_client", value="year=2015 (earlier record)"))
A(F("Fab.Pub has a public material-intake route: a visitor is asked to send a material source, volume and intended application, and Fab.Pub then helps define a testing pathway. This is the most direct, documented door for offering a new material to this practice's fabrication arm.", "fp_intake"))
A(F("Fab.Pub says its material work involves collaboration with researchers and industry to test formulations in real manufacturing conditions, so sponsored or joint testing (not just sales) is the stated mode.", "fp_collab"))
A(F("Fab.Pub's quote form states a minimum budget of GBP 250 and the home page a minimum 2-week lead time; no price list or day rate for commissions was found on any page read.", "fp_minbudget", value="minimum_budget=GBP 250; lead_time>=2 weeks (from fp_leadtime quote)", conf="high"))
A(F("Fab.Pub offers franchise and joint-venture arrangements built around buying Mobile Factories; the investment amount is not published.", "fp_franchise"))
A(F("Fab.Pub is a joint venture between Therme Group and Mamou-Mani Architects (Therme's own blog), so a larger corporate backer sits behind the fabrication arm.", "therme_jv"))
A(F("The practice sells 'parametric consultancy' as a service (geometry adapted to environmental constraints), which is the closest existing service line to a law-constrained design tool.", "mm_consult"))

# ---------- Comparable practices ----------
A(F("Foster + Partners' Applied Research + Development group reports a 2017 collaboration with Autodesk on predicting how a passively actuated facade responds to temperature change: direct evidence that a major practice spends effort on exactly this class of material behaviour. No evidence was found that they buy materials or fund outside labs for it.", "foster_passive", conf="high"))
A(F("Foster + Partners states it does research and development with universities and industry partners (page dated 2020 by AECbytes).", "foster_univ"))
A(F("Zaha Hadid Architects has an in-house research group (ZHA CODE) founded in 2007 per its history page; a 2018 press listing named Stratasys and the Block Research Group among collaborators (search summary, not fetched), so ZHA is a candidate collaborator rather than a documented customer.", "zha_code", conf="medium"))
A(F("ZHA CODE is described as a practice-embedded research group, i.e. R&D is inside the firm; any engagement would be a collaboration or pilot, not a purchase.", "zha_code2", conf="medium"))
A(F("Arup has long-running strategic research partnerships with universities (Cambridge for more than 60 years; Manchester announced in 2023 with materials named as a research area). Arup is therefore reachable through a university sponsored-research agreement; no Arup page read states that it buys outside material R&D directly.", "cam_arup", conf="medium"))
A(F("The Manchester-Arup strategic partnership names materials among its research areas.", "man_arup", conf="medium"))
A(F("A New Zealand research project lists Buro Happold and BioMat as international collaborators on scalable shading prototypes using biomaterial-based and 4D-printed components (project page, undated, preliminary).", "nz_bh", conf="medium"))

# ---------- Facade and shading manufacturers ----------
A(F("Schueco runs a start-up programme (GrowthFactory) aimed at start-ups that complement its building-envelope business; a responsive facade material would fit this stated scope.", "schueco_fit"))
A(F("Schueco's page says it offers start-ups non-financial resources (market access, know-how) rather than large budgets. The evidence therefore supports a pilot or co-development engagement, not a paid purchase.", "schueco_nonfin"))
A(F("Schueco's 2025 turnover was EUR 2.06 billion with 6,750 employees (company press page), so it is large enough to fund a pilot but nothing read shows it paying a start-up for material R&D.", "schueco_turnover", value="turnover=EUR 2.06 bn; employees=6750"))
A(F("WAREMA (sun shading) and Schueco both took part as 'external partners' in the publicly funded Synergy Facade project led by Fraunhofer ISE (2021-2024). Manufacturers join publicly funded research rather than commissioning it alone.", "ise_partners"))
A(F("The Synergy Facade project was sponsored by the German federal economics and climate ministry.", "ise_sponsor"))
A(F("Fraunhofer ISE says characterisation in its CONTINENT outdoor facility is commissioned by facade-technology manufacturers: a fee-for-service route by which a manufacturer would have third-party comfort and energy data on a new shading material.", "ise_commissioned"))
A(F("WAREMA Group revenue was about EUR 687 million in 2024 (EUR 753 million in 2023), so it is a mid-size firm with falling sales in the latest year reported.", "warema_rev", value="revenue_2024=EUR 687 m; revenue_2023=EUR 753 m"))

# ---------- Universities ----------
A(F("MIT's Self-Assembly Lab says it is supported annually by grants, gifts and sponsored research and invites companies to contact it about partnering: a documented sponsored-research door for programmable-material work.", "sal_sponsored"))
A(F("The lab's 4D printing programme was a collaboration with Stratasys and Autodesk, i.e. industry has funded or supplied printers for this field before.", "sal_4d"))
A(F("The University of Stuttgart's ICD ran a 2021-22 project on zero-energy self-shading, funded by a university-internal knowledge and technology transfer scheme. ICD is both a likely academic partner and a competitor for the same public funds.", "icd_wtt", conf="medium"))
A(F("Funding line for the ICD project (university-internal technology-transfer scheme).", "icd_fund", conf="medium"))

# ---------- Formlabs ----------
A(F("Formlabs sells Open Material Mode as an optional one-time purchase per printer, free with a printer purchase for accredited educational institutions; the store page shows 'From $875' across six SKUs (the Form 4 SKU price was not separated).", "fl_omm", value="OMM price=from USD 875 (lowest of 6 SKUs)"))
A(F("Formlabs store price line for Open Material Mode.", "fl_omm_price", value="from USD 875 excl. sales tax"))
A(F("Formlabs gives in-kind donations of resin, powder and consumables to student groups and competition teams. This is the only sponsorship offer found; no sponsored-research or materials-partner programme for universities or architects was found.", "fl_inkind"))
A(F("Formlabs says over 300 top universities rely on its printers, so academic partners already own the machines and can host a proof of concept.", "fl_300", conf="medium"))
A(F("Formlabs Certified Materials is its route for third-party materials with pre-tuned print settings, a possible partner track for a new resin or powder; no application process or fee was found.", "fl_cert"))
A(F("The Certified Materials page lists a BEGO dental resin, a dental company partner and not a research or architecture one. I did not count every entry on the page.", "fl_bego", conf="medium"))
A(F("Disagreement inside one Formlabs page on the size of its materials team: the body says 40+ materials scientists and engineers, a heading says 60+ chemical engineers and developers.", "fl_team40", value="40+ vs 60+"))
A(F("Second statement of the figure on the same page.", "fl_team60", value="60+"))

# ---------- Funding routes ----------
A(F("SBIR/STTR ceilings stated by sbir.gov for 16 Oct 2026: Phase I up to USD 335,937 and Phase II up to USD 2,239,578 without SBA waiver.", "sbir_ceiling", value="phase_I_ceiling=USD 335,937; phase_II_ceiling=USD 2,239,578"))
A(F("The same site's 'apply' page gives older ranges: Phase I USD 50,000-323,000 and Phase II USD 650,000-2.2 million. Two pages on one site disagree (323,000 vs 335,937 is 12,937 USD, 3.8 percent, my arithmetic); the 'about' page is dated.", "sbir_apply_p1", value="USD 50,000-323,000", conf="high"))
A(F("Phase II range on the apply page.", "sbir_apply_p2", value="USD 650,000-2.2 million"))
A(F("SBIR eligibility: a for-profit US company with under 500 employees, owned and controlled by US citizens or permanent residents. A university or non-profit cannot receive the SBIR award directly.", "sbir_elig"))
A(F("STTR requires the small business to formally partner with a research institution, which suits a university-plus-company team.", "sttr_partner"))
A(F("Each agency may add up to USD 6,500 per year (Phase I) and USD 50,000 per award (Phase II) for technical and business assistance on top of the award.", "sbir_ta", value="TABA=USD 6,500/yr Phase I; USD 50,000 Phase II"))
A(F("NSF's Advanced Materials topic includes 'Structural and Infrastructural Materials' as a sub-topic, the closest NSF home for a building material.", "nsf_am5"))
A(F("NSF's Advanced Materials page features bioMASON, a small business funded by NSF, growing bricks with bacteria: a precedent for NSF funding a bio-based construction material company.", "nsf_biomason"))
A(NSF("NSF SBIR Phase II awarded to NextGlass LLC for a vacuum insulated glass window: precedent for NSF paying for a building-envelope product (amount is the award size, about USD 1.25 million).", "2545418", "SBIR Phase II: Low-Cost, High-Performance, Vacuum Insulated Glass Window", 1249929))
A(NSF("NSF SBIR Phase I (USD 305,000) for physics-informed modelling of 3D concrete printing bond strength: precedent for funding physics-constrained construction printing.", "2537548", "SBIR Phase I: A Physics-Informed Neural Network Supporting Computer Vision for 3DCP Bond Strength", 305000))
A(NSF("NSF SBIR Phase II to Z-Polymers for polymers for consumer 3D printing: precedent for a printable-polymer materials company.", "2537897", "SBIR Phase II: Durable High-Performance Polymers for Consumer 3D Printing of Engineering-Grade Products", 1249805))
A({"claim": "Own calculation on 118 distinct NSF award records returned by my keyword queries (script nsf_stats.py): median SBIR Phase I = USD 304,990 (n=20), median STTR Phase I = USD 305,000 (n=15), median SBIR Phase II = USD 1,246,061 (n=35), I-Corps = USD 50,000 (n=43). Keyword searches were noisy so this is a sample of NSF award sizes, not all awards.",
   "confidence": "medium", "source": "scripts/bm-clients-and-market/nsf_stats.py on data/bm-clients-market/nsf/*.json", "evidence_quote": "", "value": "NSF Phase I ~USD 305k; Phase II ~USD 1.25m; I-Corps USD 50k"})
A(F("Innovate UK Smart grants are closed to new applications (UKRI guidance page). The task brief lists them as a route; they are not available now.", "ukri_smart", value="status=closed"))
A(F("A secondary source (Grantsights, 29 Oct 2026) says UKRI's replacement, Velocity, launches in autumn 2027 and will carry all Innovate UK support. I could not confirm the Velocity date on a UKRI page.", "velocity", conf="medium"))
A(F("Knowledge Transfer Partnerships: academic institutions, RTOs or Catapults lead with a UK business; round one of 2026-27 had a fund of up to GBP 10 million and is closed (listing status Closed). Later 2026-27 rounds were reported by an aggregator but I did not confirm their dates.", "ktp_ukri", value="round_fund=GBP 10 m", conf="high"))
A(F("KTP round-one listing status.", "ktp_closed", value="Closed"))
A(F("KTP projects run 12-36 months at about GBP 8,500 of eligible cost per month; Innovate UK pays a proportion and the business partner pays the rest. My arithmetic: 8,500 x 12 = GBP 102,000 to 8,500 x 36 = GBP 306,000 total eligible cost per project.", "ktp_costs", value="eligible_cost=GBP 102,000-306,000 per project (own arithmetic)"))
A(F("The Henry Royce Institute's Industrial Collaboration Programme funds industry-led, academic-engaged advanced-materials projects; Leeds won over GBP 300,000 in round six (21 Jul 2026), showing that the scheme is live. Eligibility and per-project size were not read.", "royce", value="Leeds award > GBP 300,000", conf="medium"))
A(F("AIA's Upjohn Research Initiative gave USD 100,000 across four architecture research projects in 2018 (the only year read), so it is a small, practitioner-facing funder; its current status is not confirmed.", "aia", value="USD 100,000 across 4 projects (2018)", conf="medium"))
A(F("The UK Lambert Toolkit provides model university-business collaboration agreements, including a contract-research model in which the university may not publish without the sponsor's permission; the guidance says it was last updated in 2018.", "lambert_5", conf="high"))
A(F("Lambert guidance age.", "lambert_old", value="last updated 2018"))

# ---------- structural finding (no single quote) ----------
A({"claim": "I found no firm that documents paying an outside party for a law-constrained or verified material or design rule as such. Documented payers are (1) clients buying finished installations (Hyundai/Tate, Neko Health, COS, Hermes, Buro Happold), (2) public funders, and (3) manufacturers who join publicly funded projects or buy test time. Absence of evidence in the pages read, not proof of absence.",
   "confidence": "medium", "source": "synthesis of the findings above; pages saved under data/bm-clients-market/ and data/mamou-mani/", "evidence_quote": ""})
A({"claim": "Contradicts bm-formlabs-printing-workflows.json (Open Material Mode reseller price about USD 3.7k, low confidence): Formlabs' own store page shows 'From $875' for six OMM SKUs and says OMM is free with a printer purchase for accredited educational institutions. The two are not strictly incompatible (the 3.7k figure came from one out-of-stock reseller listing; the $875 may be the Form 3 SKU) but the Form 4 price remains unresolved.",
   "confidence": "medium", "source": "https://formlabs.com/store/materials/open-material-mode/ vs agents2/bm-formlabs-printing-workflows.json", "evidence_quote": Q["fl_omm_price"][2]})
A({"claim": "Contradicts the task brief's list of routes: Innovate UK Smart grants are closed. Confirms the earlier spec-ip-landscape caution that sponsor rights and IP position matter before any sponsored-research or SBIR work: nothing here changes that file's finding that stimulus-responsive printed objects are a crowded patent field.",
   "confidence": "high", "source": Q["ukri_smart"][1], "evidence_quote": Q["ukri_smart"][2]})
A({"claim": "Deepens bm-passive-facades-evidence.json (no measured building benefit for humidity-driven shading; no commercial product found): this run also found no start-up or product selling a humidity-driven printed shading element. The documented academic work is public-funded (the Nature Communications 2024 paper lists Deutsche Forschungsgemeinschaft as funder in Crossref), which points to public grants, not market sales, as the first money.",
   "confidence": "medium", "source": "https://api.crossref.org/works/10.1038/s41467-024-54808-8", "evidence_quote": ""})

# ---------- table ----------
T = lambda n, f, s: {"name": n, "fields": f, "source": s}
table = [
 T("Mamou-Mani Architects (London)", "type=architecture practice; evidence=named clients Hyundai Motor (via Tate commission), Neko Health, COS, Hermes/RDAI, Buro Happold; engagement=commission or joint pilot; size=fees not published (unverified); first_step=hand-scale sample via Fab.Pub intake", Q["tate_hyundai"][1]),
 T("Fab.Pub (Mamou-Mani + Therme Group JV)", "type=fabricator/materials arm; evidence=material-intake page ('send us the material source...'); minimum_budget=GBP 250; lead_time>=2 weeks; franchise=investment not published; engagement=paid prototype, test pathway, JV", Q["fp_intake"][1]),
 T("Foster + Partners Applied R+D (London)", "type=large practice; evidence=2017 Autodesk collaboration on passively actuated facade under temperature change; engagement=collaboration/pilot; size=not found; payer_evidence=none found", Q["foster_passive"][1]),
 T("Zaha Hadid Architects CODE (London)", "type=large practice with in-house research group; evidence=CODE founded 2007; engagement=collaboration; size=not found; payer_evidence=none found", Q["zha_code"][1]),
 T("Arup", "type=engineering consultancy; evidence=university strategic partnerships (Cambridge >60 years; Manchester 2023, materials named); engagement=sponsored research via a university; size=not found", Q["cam_arup"][1]),
 T("Buro Happold", "type=engineering consultancy; evidence=client for Wooden Waves (Mamou-Mani); collaborator on NZ biomaterial shading project; engagement=commission or collaboration; size=not found", Q["bh_client"][1]),
 T("Webb Yates Engineers", "type=structural engineer; evidence=suspension and load tests of Tate printed parts; engagement=fee-for-service verification; size=not found", Q["tate_webbyates"][1]),
 T("Schueco International (Bielefeld)", "type=facade manufacturer; evidence=GrowthFactory start-up programme (non-financial support), external partner in Synergy Facade; turnover_2025=EUR 2.06 bn; employees=6750; engagement=pilot / co-development; paid_evidence=none found", Q["schueco_fit"][1]),
 T("WAREMA Group", "type=sun-shading manufacturer; evidence=external partner in Synergy Facade; revenue_2024=EUR 687 m (2023: 753 m); engagement=joint public project or test commission; paid_evidence=none found", Q["warema_rev"][1]),
 T("Fraunhofer ISE (Freiburg) CONTINENT facility", "type=research institute with test facility; evidence=characterisation commissioned by facade manufacturers; engagement=fee-for-service testing; fee=not published", Q["ise_commissioned"][1]),
 T("MIT Self-Assembly Lab", "type=university lab; evidence=supported by grants, gifts and sponsored research; 4D printing with Stratasys and Autodesk; engagement=sponsored research or gift; size=not found", Q["sal_sponsored"][1]),
 T("University of Stuttgart ICD", "type=university institute; evidence=2021-22 zero-energy self-shading project, internal transfer funding; engagement=academic partner and competitor; size=not found", Q["icd_wtt"][1]),
 T("Formlabs", "type=printer maker; evidence=Open Material Mode from USD 875 (free for accredited education), in-kind consumables for student groups, Certified Materials track; no research-sponsorship programme found; engagement=in-kind support, certification; size=small", Q["fl_omm"][1]),
 T("bioMASON (US)", "type=bio-based construction-materials start-up; evidence=named as NSF-funded small business on NSF Advanced Materials page; engagement=peer / possible partner, not a documented buyer", Q["nsf_biomason"][1]),
 T("NSF America's Seed Fund (SBIR/STTR)", "type=US federal; eligibility=US for-profit under 500 staff, US-owned; Phase_I=up to USD 335,937 (about page) or USD 50k-323k (apply page); Phase_II=up to USD 2,239,578; sample medians Phase_I USD 305k, Phase_II USD 1.25m; STTR needs research-institution partner", Q["sbir_ceiling"][1]),
 T("Innovate UK KTP", "type=UK; lead=university/RTO/Catapult plus UK business; duration=12-36 months; eligible_cost=GBP 8,500/month (GBP 102k-306k per project, own arithmetic); round-one 2026-27 closed; later rounds not confirmed", Q["ktp_costs"][1]),
 T("Innovate UK Smart grants", "status=CLOSED to new applications; successor Velocity reported for autumn 2027 (secondary source)", Q["ukri_smart"][1]),
 T("Henry Royce Institute Industrial Collaboration Programme", "type=UK advanced-materials funder; evidence=Leeds won >GBP 300,000 in round six (Jul 2026); per-project size and eligibility not read", Q["royce"][1]),
 T("AIA Upjohn Research Initiative", "type=US architects' institute grant; evidence=USD 100,000 across 4 projects (2018); current status unverified", Q["aia"][1]),
 T("UK Lambert Toolkit (agreement templates)", "type=procurement template; use=university-business sponsored/collaborative research; guidance last updated 2018", Q["lambert_what"][1]),
]

key_claims = [
 {"claim": "Innovate UK Smart grants, which the brief lists, are closed to new applications; Knowledge Transfer Partnerships, SBIR/STTR and the Royce ICP are the live routes read in this run.",
  "source": Q["ukri_smart"][1], "evidence_quote": Q["ukri_smart"][2]},
 {"claim": "SBIR needs a US-owned for-profit company; a university-and-company team would use STTR, which requires a formal research-institution partner. Phase I ceiling USD 335,937 and Phase II USD 2,239,578 as of 16 Oct 2026 (the apply page still shows the older USD 323,000 Phase I top).",
  "source": Q["sbir_ceiling"][1], "evidence_quote": Q["sbir_ceiling"][2]},
 {"claim": "The practice's documented clients pay for finished installations (Hyundai Motor via the Tate commission, Neko Health, COS, Buro Happold), and Fab.Pub has an explicit door for new materials (send material source, volume, application) with a GBP 250 minimum job budget; no commission fees are published.",
  "source": Q["fp_intake"][1], "evidence_quote": Q["fp_intake"][2]},
 {"claim": "No evidence was found that any facade manufacturer or Formlabs pays outsiders for new material R&D: Schueco says it offers start-ups non-financial resources, and Formlabs offers in-kind consumables and certification, not research money.",
  "source": Q["schueco_nonfin"][1], "evidence_quote": Q["schueco_nonfin"][2]},
]

recommendations = [
 "Treat the proof of concept as a sample plus a verified design rule, not a product. Nothing read shows anyone paying for a rule as such; the documented money is installation fees, public grants and test fees. The project record's thin-bilayer limit (about 0.2-0.9 mm total thickness for stock-resin humidity actuation, bm-passive-facades-evidence.json) points to interior, installation and demonstrator uses first, not full-scale shading.",
 "Approach Fab.Pub through its public material-intake route with a hand-scale sample, a one-page rule sheet (the 3/2 ceiling and what it permits) and a request for a joint test pathway. Ask Mamou-Mani what a paid prototype or joint pilot would cost, since no fee is published.",
 "Choose the money route by who the applicant is. US for-profit: NSF Project Pitch under Advanced Materials sub-topic 5 (Structural and Infrastructural Materials), roughly USD 305k Phase I; check the current solicitation and deadline on seedfund.nsf.gov. Team with a university: STTR. UK company plus university: a KTP in a later round (round-one 2026-27 closed) or Royce ICP. Smart grants are not available.",
 "For a UK university-company deal use a Lambert Toolkit agreement as a starting point; the contract-research model lets the sponsor control publication. Settle background IP first, since the earlier IP scan found the responsive-printed-object field crowded.",
 "To get manufacturer evidence without selling to them, price a Fraunhofer ISE CONTINENT characterisation request, or join a publicly funded consortium as Warema and Schueco did.",
 "Do not plan on Formlabs money. Ask for in-kind resin only if a student or accredited academic partner is the applicant, and use free Open Material Mode through an educational partner if a non-Formlabs resin is needed.",
]

lay_summary = ("We looked for people who might pay for a printable material that follows proven rules. "
 "We found plenty of people who pay for finished installations, such as a car maker backing an art commission in a London gallery, a health clinic and a fashion brand. "
 "We found almost no one who pays for the material or the rule on its own. "
 "The likely first money is public: grants in the US and UK that pay universities and small companies to prove an idea. "
 "Big window and shade makers join those public projects but say they offer help, not cash. "
 "Think of it as selling a seed sample to a garden designer: she may plant it, but a research fund will pay for growing it.")

glossary = [
 {"term": "SBIR / STTR", "plain": "US government grants that pay small companies (STTR: together with a university) to test a new technology."},
 {"term": "Phase I / Phase II", "plain": "The first small grant to prove an idea, then a larger one to build it."},
 {"term": "KTP (Knowledge Transfer Partnership)", "plain": "A UK scheme in which a university and a company share the cost of a project that places a graduate in the company."},
 {"term": "Sponsored research agreement", "plain": "A contract in which a company pays a university to do research, and the contract sets who owns the results."},
 {"term": "Lambert Toolkit", "plain": "Template contracts from the UK government for university-business research deals."},
 {"term": "Open Material Mode", "plain": "A paid unlock that lets a Formlabs printer use resin or powder made by other companies."},
 {"term": "Facade", "plain": "The outer skin of a building."},
 {"term": "Consultancy (engineering)", "plain": "A firm that sells engineering advice and checks, such as testing that a hanging part is safe."},
 {"term": "Non-dilutive funding", "plain": "Money that does not require giving up a share of the company."},
 {"term": "In-kind", "plain": "Goods such as resin given instead of cash."},
]

reproduce = [
 {"what": "Re-fetch the pages and check every quote is verbatim", "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/quotes.py (pages are saved in D:/Users/ashenoy00000/delphi-work/data/bm-clients-market/ and data/mamou-mani/; re-download with fetch.py URL)", "expected": "every line starts OK; final line 'missing: []'"},
 {"what": "Download a page with a generic user-agent and log url/date/bytes/sha256", "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/fetch.py https://www.sbir.gov/about", "expected": "HTTP 200; a line appended to data/bm-clients-market/manifest.tsv; text contains 'up to $335,937' (value may change after 2026-11-12)"},
 {"what": "Query NSF award sizes (public API, no login)", "command_or_url": "python -I .../nsf_awards.py \"4D printing\" then python -I .../nsf_stats.py", "expected": "Phase I median about 305,000; Phase II median about 1.25 million; I-Corps 50,000 (sample of 118 distinct awards; results shift as NSF adds awards)"},
 {"what": "Confirm Innovate UK Smart grants are closed", "command_or_url": "https://www.ukri.org/councils/innovate-uk/guidance-for-applicants/guidance-for-specific-funds/smart-innovation-funding-guidance", "expected": "text 'Smart grants are now closed for new applications'"},
 {"what": "Confirm KTP project cost and fund", "command_or_url": "https://apply-for-innovation-funding.service.gov.uk/competition/2380/overview/3e170dd3-4458-4c7e-a096-e0ea50b88040 ; arithmetic 8500*12=102000, 8500*36=306000", "expected": "'typically GBP 8,500 per month'; 12 to 36 months"},
 {"what": "Verify the two citations", "command_or_url": "python -I .../crossref.py --doi 10.1038/s41467-024-54808-8 ; python -I .../crossref.py --doi 10.1201/9780429426506-177", "expected": "titles as in the citations list"},
 {"what": "Rebuild this JSON", "command_or_url": "python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/build_result.py", "expected": "writes agents2/bm-clients-and-market.json; fails if a quote is missing"},
 {"what": "Tools and versions", "command_or_url": "Python 3.14 standard library only (urllib, json, re, html); no third-party packages", "expected": "n/a"},
]

citations = [
 {"authors": "Cheng, T.; Tahouni, Y.; Sahin, E. S.; Ulrich, K.; Lajewski, S.; Bonten, C.; et al.", "year": 2024,
  "title": "Weather-responsive adaptive shading through biobased and bioinspired hygromorphic 4D-printing", "venue": "Nature Communications",
  "doi_or_arxiv": "10.1038/s41467-024-54808-8", "verified": True,
  "how_verified": "Crossref API https://api.crossref.org/works/10.1038/s41467-024-54808-8 returned the record on 2026-11-12; funder listed as Deutsche Forschungsgemeinschaft (EXC 2193/1-390951807).",
  "used_for": "Shows that the closest published hygromorphic shading work is publicly funded (DFG cluster), supporting the point that first money is public."},
 {"authors": "Abdel-Rahman, Kosicki, Michalatos, Tsigkari", "year": 2019,
  "title": "Design of thermally deformable laminates using machine learning", "venue": "Advances in Engineering Materials, Structures and Systems (book chapter)",
  "doi_or_arxiv": "10.1201/9780429426506-177", "verified": True,
  "how_verified": "Crossref API https://api.crossref.org/works/10.1201/9780429426506-177 returned the record on 2026-11-12. Author affiliations were not in the record; the link to Foster + Partners rests on the AECbytes article describing the same Autodesk laminate study.",
  "used_for": "Peer-reviewed trace of the Foster + Partners / Autodesk work on passively actuated facade laminates."},
]

could_not_find = [
 "Any published fee, day rate or commission value for Mamou-Mani or Fab.Pub beyond the GBP 250 minimum job budget; their franchise investment amount is also unpublished.",
 "Any page showing Foster + Partners, ZHA, Arup or Buro Happold buying external material research (only collaborations and in-house groups). Foster's own page URLs returned HTTP 403 to my fetch; I used an AECbytes feature (2020) instead.",
 "Any facade or shading maker (Schueco, WAREMA, Hunter Douglas, Permasteelisa, Colt) that pays a start-up or university for material R&D. Hunter Douglas, Permasteelisa and Colt: a search found no university research collaboration and I did not fetch their sites.",
 "Any start-up or product selling a humidity-driven printed shading or cladding element (a web search returned only academic projects).",
 "A market-size figure for responsive or passive shading; I found only two company revenue figures (Schueco, WAREMA) and did not use any analyst figure.",
 "Whether the team is a US for-profit company, a UK company, or a university group; this decides SBIR vs STTR vs KTP and I did not guess.",
 "Current NSF Project Pitch status and next full-proposal deadline: aggregator pages disagree (one says March 4, 2027; another says pitches were paused) and I did not read the NSF solicitation text.",
 "KTP round dates after round one of 2026-27 (aggregators gave Round 2 and 3 dates; unverified here) and the grant percentage by business size (garbled in the search snippet).",
 "Royce ICP eligibility and per-project size; the Leeds page gives only a total across projects (over GBP 300,000).",
 "Formlabs: any sponsored-research, materials-partner or architecture-practice programme; the Form 4 Open Material Mode price (the page shows only 'From $875' for six SKUs); the full list of Certified Materials. Formlabs' Developer Platform page returned 404.",
 "Whether anyone would pay for the Lean-checked rule itself. No source was found; this is a market-test question for the team.",
 "Procurement timelines (how long a sponsored research agreement or SBIR award takes to sign). Not researched.",
 "MIT Self-Assembly Lab sponsor list and fee levels; the partners page gave no names or amounts.",
 "Arup Global Research Challenge details: only a 2017 trade-press article was read and it is not used for any claim.",
]

summary = ("Who would pay, and for what: the evidence supports three payers and one gap. "
 "(1) Clients pay for finished installations: Mamou-Mani's pages name Hyundai Motor (through the artist's Tate Modern commission), Neko Health, COS, Hermes (via RDAI) and Buro Happold as sponsors or clients, and its fabrication arm Fab.Pub (a Therme Group joint venture) has a public material-intake route and a GBP 250 minimum budget, but no published fees. "
 "(2) Public funders pay for proof-of-concept research: NSF SBIR/STTR (Phase I ceiling USD 335,937 and Phase II USD 2,239,578 as of 16 Oct 2026; my sample of 118 NSF awards has medians near USD 305k and USD 1.25m), UK Knowledge Transfer Partnerships (GBP 8,500 per month of eligible cost, 12-36 months; round one of 2026-27 closed), and the Royce industrial collaboration programme. Innovate UK Smart grants, named in the brief, are closed. "
 "(3) Manufacturers take part rather than pay: Warema and Schueco were 'external partners' in a ministry-funded Fraunhofer ISE project, Fraunhofer ISE says manufacturers commission facility tests, and Schueco's start-up programme offers non-financial help. "
 "Gap: no firm was found that pays for a law-constrained material or verified rule as such; Foster + Partners and ZHA have in-house research and a 2017 Autodesk passive-facade study but no buying evidence. Formlabs offers Open Material Mode (from USD 875, free to accredited education), in-kind consumables for student groups and a certified-materials track, but no sponsored-research programme. "
 "Contradictions with earlier files: Open Material Mode price (store page 'from $875' vs a reseller listing of about USD 3.7k in bm-formlabs-printing-workflows.json); Smart grants closed; SBIR Phase I top is USD 335,937 on one sbir.gov page and USD 323,000 on another.")

result = {
 "label": "bm-clients-and-market",
 "topic": "Who would pay, and for what: buyers, partners and procurement routes for a law-constrained printable responsive material",
 "summary": summary, "lay_summary": lay_summary,
 "findings": findings, "key_claims": key_claims, "table": table,
 "recommendations": recommendations, "reproduce": reproduce, "citations": citations,
 "could_not_find": could_not_find, "glossary": glossary,
 "scripts_written": [
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/fetch.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/grep.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/g.sh",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/quotes.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/nsf_awards.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/nsf_stats.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/crossref.py",
  "D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-clients-and-market/build_result.py"],
}
json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("wrote", OUT, "findings", len(findings), "table", len(table))
