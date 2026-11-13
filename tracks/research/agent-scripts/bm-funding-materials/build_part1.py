"""Part 1 of the result: table rows (one per programme) for bm-funding-materials.
All pages read 2026-11-12. Saved copies: D:/Users/ashenoy00000/delphi-work/data/bm-funding/ (manifest.tsv has url, date, bytes, sha256).
"""
READ = "read 2026-11-12"

def row(name, fields, source):
    return {"name": name, "fields": fields, "source": source}

TABLE = [
 # ---------------- NSF ----------------
 row("NSF DMREF (Designing Materials to Revolutionize and Engineer our Future), NSF 25-508",
     "award_usd=1.5M-2.0M over 4 yr; est_awards=20-25; total_usd=40M; eligibility=US institutions of higher education, team of >=2 senior/key personnel, max 5 lead proposals per organisation; "
     "last_window=2025-01-21 to 2025-02-04; recurrence=biennial in odd-numbered years if funded; next_deadline=NOT PUBLISHED (a 2027 window is expected, no solicitation later than 25-508 found); "
     "page_last_updated=2026-10-05; fit=GOOD in concept (closed-loop theory+computation+experiment is exactly the verified-law-to-printed-sample story), poor timing certainty; " + READ,
     "https://www.nsf.gov/funding/opportunities/dmref-designing-materials-revolutionize-engineer-our-future ; https://www.nsf.gov/funding/opportunities/dmref-designing-materials-revolutionize-engineer-our-future/nsf25-508/solicitation"),
 row("NSF MPS Materials Research Programs (incl. Biomaterials BMAT, Polymers POL, Condensed Matter and Materials Theory CMMT), NSF 26-521",
     "award_usd=not stated per award; own calc mean 333k-500k (100M/300 to 100M/200); est_awards=200-300; total_usd=100M; deadline=Proposals Accepted Anytime; posted=2026-08-17 (replaces NSF 23-611, 23-612); "
     "eligibility=US IHEs and other NSF-eligible orgs, max 1 proposal per PI/co-PI per fiscal year across the eight MPS materials programmes; "
     "fit=GOOD for a bioinspired/biomimetic materials-science proposal (BMAT scope names 'biomimetic, bioinspired'); " + READ,
     "https://www.nsf.gov/funding/opportunities/mps-materials-mps-materials-research-programs/nsf26-521/solicitation"),
 row("NSF ENG CMMI (AMDO: Advanced Manufacturing, Design and Operations; MAMS: Mechanics of Advanced Materials Systems; EBE, FRR, IIDS), NSF 26-515",
     "award_usd=not stated per award; own calc mean 364k-444k (100M/275 to 100M/225); est_awards=225-275; total_usd=100M; deadline=Proposals Accepted Anytime; posted=2026-08-17 (replaces PD 19-088Y Advanced Manufacturing and others); "
     "eligibility=NSF-eligible orgs, no per-PI limit; fit=GOOD (MAMS scope: how engineered and biological materials change shape or size; AMDO: manufacturing of materials); " + READ,
     "https://www.nsf.gov/funding/opportunities/engineering-eng-civil-mechanical-manufacturing-innovation/nsf26-515/solicitation"),
 row("NSF Future Manufacturing (FM): FMRG research grants and FMSG seed grants, NSF 24-525",
     "award_usd=FMRG up to 3.0M/4 yr; FMSG up to 0.5M/2 yr (last known structure); status=NOT ACCEPTING PROPOSALS; last_deadline=2025-06-18 (cancelled 2025-05-20); "
     "next_deadline=COULD NOT READ (NSF says a new manufacturing opportunity is planned for FY 2026; none found as of 2026-11-12); fit=GOOD if it reappears (manufacturing + convergence), currently unavailable; " + READ,
     "https://www.nsf.gov/funding/opportunities/fm-future-manufacturing ; https://www.nsf.gov/funding/opportunities/fm-future-manufacturing/updates/119854"),
 row("NSF EFRI (Emerging Frontiers in Research and Innovation), current topic Wave-Based Computing, NSF 26-524",
     "award_usd=Track 1 EAGER 100k-400k/2 yr; Track 2 up to 2.0M/4 yr; total_usd=30M; concept_outline_due=2026-11-19; full_proposal=2027-02-11 and 2028-02-10; "
     "fit=POOR (topic is wave-based computing; no materials/architecture topic open; a future EFRI topic cycle is not published); " + READ,
     "https://www.nsf.gov/funding/opportunities/efri-wbc-emerging-frontiers-research-innovation-efri-wave-based/nsf26-524/solicitation"),
 row("NSF SBIR/STTR Phase I and II (America's Seed Fund), NSF 26-510",
     "award_usd=Phase I up to 305k; Phase II up to 1.25M; est_awards=340; eligibility=for-profit US small business concerns only (<=500 employees incl. affiliates); Phase I needs an invited Project Pitch first; "
     "next_deadline=2027-03-04 then first Thursday in March annually; also 2027-07-07 and first Wednesday in July/November annually; fit=MEDIUM only if a company (not a university lab) is the applicant; " + READ,
     "https://www.nsf.gov/funding/opportunities/small-business-innovation-research-small-business-technology/nsf26-510/solicitation"),
 row("NSF TRAILBLAZER Engineering Impact Award, NSF 26-502",
     "award_usd=est 5 awards, total 15M; full_proposal_deadline=2026-07-24 (CLOSED); fit=POOR/closed; recurrence=unknown; " + READ,
     "https://www.nsf.gov/funding/opportunities/trailblazer-nsf-trailblazer-engineering-impact-award/nsf26-502/solicitation"),
 # ---------------- NIH / ARPA / DARPA / DOE ----------------
 row("NIH Research Project Grant, Parent R01 (clinical trial not allowed), PA-25-301",
     "award_usd=not read; standard due dates 5 Feb / 5 Jun / 5 Oct each year (pattern from the NOFO table; 2027-02-05 is my extension of the pattern, not a printed date); expires=2028-01-08; "
     "fit=POOR for a building-material project (needs a health application; I read only the parent notice, not an NIBIB-specific one); " + READ,
     "https://grants.nih.gov/grants/guide/pa-files/PA-25-301.html"),
 row("ARPA-H open funding opportunities (programme ISOs, Mission Office ISOs)",
     "listed_programmes=EHI, UNIQUE, SURPASS, SPECTRA (all health); small_business=no open opportunities; mission_office_ISO=rolling; deadline=NOT APPLICABLE; fit=POOR (health only); " + READ,
     "https://arpa-h.gov/explore-funding"),
 row("ARPA-E (DOE) open funding opportunities",
     "status=COULD NOT READ any open call: the ARPA-E eXCHANGE site is decommissioned and redirects to the consolidated DOE eXCHANGE, which is a JavaScript page with no list in the HTML; award=unknown; deadline=unknown; fit=UNKNOWN; " + READ,
     "https://arpa-e-foa.energy.gov/ ; https://eXCHANGE.energy.gov/"),
 row("DOE EERE Advanced Materials and Manufacturing Technologies Office (AMMTO) and Building Technologies Office (BTO)",
     "status=COULD NOT READ a dated open call (BTO funding page returned 404; AMMTO page lists a 'Funding Opportunities' link only); award=unknown; deadline=unknown; fit=UNKNOWN; " + READ,
     "https://www.energy.gov/eere/ammto/advanced-materials-and-manufacturing-technologies-office"),
 row("DARPA (Defense Sciences Office BAA; SBIR topics)",
     "status=COULD NOT READ a materials-relevant open call: the DARPA opportunities page is JavaScript-rendered; the SBIR topics page lists open topics in IPTO and BTO only (cyber, medical), none on materials; DSO office-wide BAA on SAM.gov not readable; award=unknown; deadline=unknown; fit=UNKNOWN; " + READ,
     "https://www.darpa.mil/work-with-us/opportunities ; https://www.darpa.mil/work-with-us/communities/small-business/sbir-sttr-topics"),
 row("BioMADE (Manufacturing USA institute) project calls",
     "status=no active project calls; next_call=none announced on the page; membership_based; fit=LOW-MEDIUM (bioindustrial manufacturing; page lists NSF America's Seed Fund as an external route); " + READ,
     "https://www.biomade.org/project-calls"),
 row("America Makes (Manufacturing USA, additive) open project calls",
     "status=no active project calls; forecast=Nov 2026 USD 52M part-performance qualification, USD 5.7M AIM-4AM 2.0, USD 35M automated welding of AM parts; Dec 2026 USD 2.2M; Mar 2027 USD 6M PADAM 3.0 (all metal/defence topics); fit=POOR; " + READ,
     "https://www.americamakes.us/our-focus/open-project-calls/"),
]
