"""Part 2: UK, EU, private and architecture programmes (table rows)."""
READ = "read 2026-11-12"

def row(name, fields, source):
    return {"name": name, "fields": fields, "source": source}

TABLE2 = [
 # ---------------- UK ----------------
 row("EPSRC standard research grant (responsive mode)",
     "award=no stated limit; EPSRC pays 80% of full economic cost; deadline=Open - no closing date (EPSRC batches internally); eligibility=UK research organisations eligible for EPSRC; "
     "fit=GOOD if a UK university PI leads (UK precedent: an EPSRC-funded hygromorphic-architecture paper, see precedent-funders finding); not available to a US-only team; " + READ,
     "https://www.ukri.org/opportunity/epsrc-standard-research-grant-nov-2023-responsive-mode/"),
 row("EPSRC new investigator award (applicant-led)",
     "award=80% FEC, no cap stated in the text I read; deadline=Open - no closing date; opened 2026-08-05; eligibility=UK research org, must be first EPSRC application as project lead; fit=MEDIUM (needs a UK early-career PI); " + READ,
     "https://www.ukri.org/opportunity/epsrc-new-investigator-award-applicant-led-mode/"),
 row("EPSRC / Innovate UK National Materials Innovation Programme: Digital Materials Sandpit",
     "award=3-8 projects up to 33 months sharing up to GBP 7.12M (own calc mean 0.89M-2.37M per project); EPSRC pays 80% FEC; opens=2026-10-29; CLOSES=2026-11-26 16:00 (14 days after reading); "
     "eligibility=UK research organisation to receive grant; industry partners welcome but unfunded; four-day sandpit attendance; fit=MEDIUM (digital integration of materials research; not specific to printed hygromorphs); " + READ,
     "https://iuk-business-connect.org.uk/opportunities/national-materials-innovation-programme-digital-materials-sandpit/"),
 row("Innovate UK Investor Partnerships: National Materials Innovation Programme 1",
     "award=project total costs GBP 50k-2M; up to 70% of costs covered depending on category and size; needs aligned private investment from a selected investor partner; opens=2026-11-02; CLOSES=2027-01-19 11:00 (68 days after reading); "
     "eligibility=UK registered SMEs; sectors tagged include Manufacturing, Materials, Infrastructure; fit=MEDIUM only through a UK SME with an investor (whether the architecture practice qualifies as an eligible SME was NOT checked); " + READ,
     "https://iuk-business-connect.org.uk/opportunities/investor-partnerships-national-materials-innovation-programme-1/"),
 row("AHRC Design Generators (UKRI, Future Observatory: Design the Green Transition)",
     "award=GBP 150k-200k, 9-12 months (duration from a search summary, not the UKRI page text I saved); total=GBP 1.0M; status=CLOSED; closed=2026-04-09; recurrence=unknown; fit=MEDIUM-GOOD for a design-led UK project, watch for a repeat; " + READ,
     "https://www.ukri.org/opportunity/design-generators/"),
 # ---------------- EU ----------------
 row("EIC Pathfinder Open 2027 (Horizon Europe)",
     "award=up to EUR 4M per grant plus EUR 50k booster; programme_budget_2027=EUR 166M; stage_1_deadline=2027-02-25; stage_2=2027-09-16; TRL 1-4; eligibility=consortium of >=3 independent legal entities in different countries "
     "(at least one in an EU Member State; others in Member States or Horizon-associated countries); fit=MEDIUM-GOOD for the high-risk 'new material + proof-of-law' idea if a European consortium forms (whether a London practice or UK university is eligible was NOT checked on this page); " + READ,
     "https://eic.ec.europa.eu/eic-funding-opportunities/eic-pathfinder_en"),
 row("ERC Consolidator Grant 2027",
     "award=up to EUR 2M over 5 yr (+ up to EUR 1M start-up/other eligible costs); opens=2026-09-24; DEADLINE=2027-01-12 (61 days after reading); eligibility=individual PI at an EU or associated host, PhD-window rules; fit=LOW-MEDIUM (curiosity-driven single-PI science, not a product pilot); " + READ,
     "https://erc.europa.eu/apply-grant/consolidator-grant"),
 row("ERC Advanced Grant 2027",
     "award=up to EUR 2.5M over 5 yr; opens=2027-05-27; deadline=2027-08-26; eligibility=established PI, EU/associated host; fit=LOW (needs a senior track record); " + READ,
     "https://erc.europa.eu/apply-grant/advanced-grant"),
 row("ERC Starting Grant 2027",
     "award=up to EUR 1.5M over 5 yr (+ up to EUR 1M); deadline=NOT SHOWN on the page (page lists 2027 evaluation timelines only; a search summary gave 2026-10-14, i.e. closed; not verified on a primary page); fit=LOW-MEDIUM; " + READ,
     "https://erc.europa.eu/apply-grant/starting-grant"),
 row("ERC Proof of Concept 2027",
     "award=lump sum EUR 150k for 18 months; opens=2026-11-12; deadlines=2027-03-10 and 2027-09-16 (17:00 Brussels); eligibility=only PIs of an ongoing ERC main grant, or one that ended after 2026-01-01; fit=POOR for a new team (needs an ERC grant first); " + READ,
     "https://erc.europa.eu/apply-grant/proof-concept"),
 row("Horizon Europe Cluster 4, HORIZON-CL4-2027-01-MAT-PROD-06 (circular innovative advanced materials, RIA)",
     "award=EUR 5.0-6.5M EU contribution per project (36 months in the table); call HORIZON-CL4-2027-01 opens=2026-10-13, deadline=2027-02-02 (82 days after reading); source is a consultancy table because the EU portal is not machine-readable; "
     "eligibility=multi-country consortium (standard for RIA; not re-verified here); fit=LOW-MEDIUM (industrial circular-materials framing); " + READ,
     "https://accelopment.com/blog/funding/horizon-europe-cluster-4-remaining-calls-2026-2027/"),
 row("EIT Community New European Bauhaus: 2027 Catalyse NEB (via Innovate UK Business Connect)",
     "award=EUR 22k each; opens=2026-10-26; closes=2027-01-15 16:00; eligibility=start-ups (details not read beyond the summary line); fit=LOW (small, start-up only); " + READ,
     "https://iuk-business-connect.org.uk/opportunities/eit-community-new-european-bauhaus-2027-catalyse-neb/"),
 # ---------------- Private foundations ----------------
 row("Autodesk Foundation (catalytic funding for design and engineering solutions)",
     "award=USD 100k-1M, most 250k-500k; eligibility=nonprofits and startups; process=small selection invited to apply each year (no open deadline); areas=Energy and Materials, Health and Resilience, Work and Prosperity; fit=LOW now (invite-only; a later startup/nonprofit vehicle could fit 'materials innovation' and 'built environment'); " + READ,
     "https://www.autodesk.org/funding"),
 row("Schmidt Sciences (all programmes) and its 2026 pilot 'AI for Actionable Matter Modeling'",
     "policy=does not accept unsolicited proposals; open-call list is dynamic and could not be read; matter-modeling pilot: Track I up to USD 100k (6-12 mo), Track II USD 100k-500k (12-18 mo); deadline=2026-04-30 per search summaries of university pages (closed; not on the Technion page I saved); "
     "eligibility=501(c)(3) or equivalent (from search summary); fit=LOW-MEDIUM (AI for matter modelling, not a verified-law material); " + READ,
     "https://www.schmidtsciences.org/opportunities ; https://trdf.technion.ac.il/en/calls-for-proposals/schmidt-sciences-ai-for-actionable-matter-modeling/"),
 row("Simons Foundation Collaborations in Mathematics and the Physical Sciences (2028 RFA)",
     "award=up to USD 2M per year for 4 yr incl. 20% indirect; LOI deadline=2026-10-29 (PASSED); full proposal=2027-02-24 12:00 ET (104 days; only after LOI notification by 2027-01-01); award start=2028-01-01; fit=LOW (large theory-led collaborations; LOI already missed); " + READ,
     "https://www.simonsfoundation.org/funding/funding-opportunities/mathematics-physical-sciences/simons-collaborations-in-mathematics-and-the-physical-sciences/"),
 row("Alfred P. Sloan Foundation (grants; Sloan Research Fellowships)",
     "status=COULD NOT READ (sloan.org returned HTTP 403 to my client); search summaries disagree on whether unsolicited proposals are accepted and give a 2026-09-15 sponsor deadline for the 2027 fellowships (closed, nomination-based, USD 75k per a search listing); fit=UNKNOWN; " + READ,
     "https://sloan.org/grants/apply (403)"),
 row("Wyss Institute (Harvard): Technology Development Fellowship; external collaboration",
     "award=stipend USD 93,933/yr plus USD 10,000/yr research fund, up to 3 yr (document dated 2024-08-14); process=nomination by email, postdoc within 5 yr of PhD, no deadline printed; collaboration page lists programmes but no open call; deadline=COULD NOT READ; fit=LOW for a grant, MEDIUM as a host for a postdoc on bioinspired engineering; " + READ,
     "https://wyss-prod.s3.us-west-2.amazonaws.com/app/uploads/2025/09/24163136/Wyss-Technology-Development-Fellowship-Final-8.14.24.pdf ; https://wyss.harvard.edu/collaboration/"),
 row("MIT-adjacent programmes",
     "status=NOT SEARCHED beyond the Wyss and patent context; no MIT programme page was fetched; deadline=COULD NOT READ; fit=UNKNOWN", "n/a"),
 # ---------------- Architecture and design foundations ----------------
 row("Graham Foundation grants (to organisations; to individuals) and Carter Manny Award",
     "grants_to_organisations_deadline=2027-02-25 (105 days after reading); grants_to_individuals=deadline passed (next date not printed); Carter Manny Award deadline=2026-11-15 (PhD dissertations only: Research Award up to USD 20k, Writing Award up to USD 25k); "
     "production/R&D grant sizes (up to USD 20k / 10k) come from search summaries only, not a Graham page I saved; fit=MEDIUM for an architecture-practice or organisation-led material prototype/exhibition, small money; " + READ,
     "https://grahamfoundation.org/grant_programs/?mode=individual ; https://grahamfoundation.org/grants"),
 row("Holcim Foundation Awards for Sustainable Construction",
     "status=the page describes the awards in the past tense ('From 2004-25 ... has been') and says the foundation is entering a new chapter; deadline=none found; fit=POOR/closed; " + READ,
     "https://www.holcimfoundation.org/awards"),
]
