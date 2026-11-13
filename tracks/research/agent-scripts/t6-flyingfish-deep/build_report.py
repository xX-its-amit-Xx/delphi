# -*- coding: utf-8 -*-
"""Assemble D:/Users/ashenoy00000/delphi-work/agents2/t6-flyingfish-deep.json. Run: python -I -X utf8 build_report.py
(needs scratch/ texts produced by the other scripts in this folder; see reproduce list)."""
import json, os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from report_part1 import findings, FAILS, XR
from report_part2 import key_claims, table, citations, glossary, lay_summary

# authors always come from Crossref, never from memory
for c in citations:
    if c['doi_or_arxiv'] in XR and XR[c['doi_or_arxiv']].get('authors'):
        c['authors'] = '; '.join(XR[c['doi_or_arxiv']]['authors'])

summary = """STATE OF THE ART: FLYING FISH GLIDE, AND WHAT AN ELIMINATION-CERTIFICATE FRAMEWORK CAN AND CANNOT SAY ABOUT IT
(Tags: [M] measured in a source I read, [D] derived by arithmetic I did and saved in analysis.py, [A] assumed. Where I could only read an abstract or a second-hand quotation I say so.)

1. THE QUESTION. Can a 20-30 cm fish, which has no wings in the usual sense, cover tens of metres through air, and what do the laws of motion allow or forbid? The framework in the application repo answers the second half by writing each law as a Lean theorem and each candidate claim as a certificate that concludes False if the claim and the law cannot both hold.

2. THE SCIENCE FROM THE GROUND UP.
Step 1 [M]. Flying fishes are the family Exocoetidae. Adults are 150-500 mm long (Davenport 1994). Two-winged forms (Exocoetus) enlarge only the chest (pectoral) fins; four-winged forms (Cypselurus, Hirundichthys) enlarge the belly (pelvic) fins too.
Step 2 [M]. A glide is a trade of energy: height and speed are spent to pay for drag. For a steady glide with lift equal to weight, distance forward per metre of descent equals the lift-to-drag ratio L/D. [D] This is textbook mechanics; in the repo it is Delphi.glide_range_le.
Step 3 [M]. The only direct force measurement on flying-fish bodies is Park and Choi 2010: stuffed Cypselurus hiraii models in a 12 m/s wind tunnel, Reynolds number about 2e4. Best model: L/D 4.37 at about 0 degrees, CLmax 0.78 at 35 degrees, CDmin 0.055. Pelvic fins add more than 20 percent lift and make pitch more stable. Flying within 0.33 half-spans of water cuts drag by 14 percent (9 percent over a solid surface).
Step 4 [M, simulation]. Deng 2019 CFD gives L/D 4.7 and CLmax 1.03 for a differently built model. Its glide-distance numbers depend on an ASSUMED 20 m/s launch speed; see the contested list.
Step 5 [D]. Stall speed: the wings can hold weight only above v_min = sqrt(2W/(rho S CLmax)). For model L3 (0.06 kg, 0.012688 m2) this is 9.85 m/s. A fish leaving the water at 3.9-5.2 m/s (Makiguchi 2013, aquarium) is at 0.39-0.52 of that, so it cannot be gliding on lift alone; it is on a ballistic hop (apex 0.8-1.4 m, reach 1.5-2.7 m at 45 degrees by my arithmetic).
Step 6 [D]. Energy-height bound for a level lifting glide: x <= (L/D)(v0^2 - v_min^2)/(2g)/(1-delta). A 50 m glide at L/D 4.37 needs launch airspeed >= 17.9 m/s, or 17.0 with 14 percent ground effect. [A] The bound is a theorem only if lift equals weight; ballistic arcs, wind, updrafts and repeated taxiing are outside it.
Step 7 [M, second-hand]. Reported field behaviour: leap at about 10 m/s, glide up to 50 m at 15-20 m/s air speed, up to 400 m in 30 s with repeated taxiing, maximum recorded height 8 m. All from older film work I could not read (Hertel 1966, Edgerton and Breder 1941, Davenport 1990).
Step 8 [M]. Davenport's flight sequence: approach below the surface at under 30 body lengths per second, leap at a shallow angle, accelerate by taxiing with the tail beating up to 50 times a second, then glide. Red (aerobic) axial muscle is no more than a fast-cruising mackerel-type fish carries, so acceleration to take-off speed probably uses anaerobic white muscle (Davenport 1992, stated as probable, not measured).
Step 9 [D from E3]. Sustained powered level flight at L/D 4.37 needs 1.33 W at v_min for the 0.06 kg reference fish against an aerobic ceiling of 0.0833 W (registry law E3 2.1.0): a factor 16. So flight must be unpowered glide plus burst power. [A] The ceiling is built from zebrafish oxygen data (Palstra 2010: 82.18 umol O2 per g per hour = 2629.6 mg per kg per hour by my unit conversion) taken from 0.43 g fish; this is extrapolated across a 140-fold mass difference.
Step 10 [M]. Why they fly is unresolved: predator escape (Davenport 1994: dolphinfish and squid) versus energy saving (rejected by Davenport; listed as open by Park and Choi).
Step 11 [M]. Evolution: extant Exocoetidae have no fossils older than the Eocene (Xu 2013); the Triassic thoracopterids (Ladinian, 235-242 Ma) glided convergently, with a gradual four-stage sequence (Xu 2015). Molecular phylogeny supports a progressive two-wing to four-wing transition and a non-monophyletic Cheilopogon (Lewallen 2010). Genomics (Daane 2021, 35 species) finds convergent changes in fin, balance and muscle genes, and zebrafish alleles of lat4a and kcnh2a that together reproduce flying-fish fin proportions.

3. WHAT IS ESTABLISHED WITH NUMBERS. L/D 4.37 and CLmax 0.78 (tunnel, dead models); ground-effect drag cuts 9-14 percent; pectoral fin length exponent 1.058 [1.017, 1.099] across 49 museum fish (my recomputation); pectoral/SL 0.406-0.823 in flying fishes against at most 0.388 in other beloniforms in one 3-species dataset; wing loading 37-46 N/m2 on four models; fin and geometry limits 24 percent and 76 percent of standard length; 50 tail beats per second.

4. WHAT IS CONTESTED. (a) Real L/D: 4.37 measured, 4.7 CFD, 15.7 in Kawachi 1993 (3.6 times higher; I could not read it). (b) Deng's headline pairs 45.4 m from the 0-degree run with 13.2 m from the 10-degree run (whose best is 41.5 m), uses coefficients from 10 m/s but launches at 20 m/s. (c) Why they fly. (d) Pelvic fins: extra lift (Park and Choi) versus tailplane (Davenport). (e) Origin of flight: extension of ballistic leaps versus lift-supported taxiing first (Davenport 2003) versus progressive two-to-four-wing sequence (Lewallen). (f) Species count 50 versus 80. (g) Davenport 1992 wing-loading exponent 1.236 versus the 1.147 implied by its own mass and area exponents.

5. THE FRAMEWORK, AND WHAT THIS REVIEW CHANGES. The application repo is at law set 1.8.1 and has the four *_rules_out lemmas (vmin, aerobic flight, glide range, climb) that the 1.6.0 upstream copy lacks. The 50 m, 8 m field certificate treats 8 m as the only energy and so eliminates a claim the physics allows once launch kinetic energy is counted (20 m/s launch gives a 67.5 m bound). The stall-floor plus kinetic-energy wrapper is the missing piece. The fin-ratio gap law rests on three flying-fish species. The aerobic ceiling rests on zebrafish. I did not compile any Lean.

6. OPEN PROBLEMS. A modern tracked data set of wild glides (launch speed, height, distance, wind). Live-fish force measurements. Deng's free-flight CFD with the polar tied to the actual speed. Taxiing power measured not simulated. Whether the pelvic fins are lift or stability. Functional test of lat4a and kcnh2a in a flying fish. A flying-fish aerobic ceiling measured on flying fish.
"""

recommendations = [
    'Replace the pure-glide field certificate (8 m, 50 m, L/D 4.37) with the stall-floor energy-height wrapper: x <= (L/D)(v0^2 - vmin^2)/(2g)/(1-delta); a 50 m single-glide claim is then consistent only if launch airspeed is at least 17.0-17.9 m/s, and the certificate must carry the scope hypothesis lift = weight.',
    'Stamp every verdict with law set 1.8.1 and note that the upstream 1.6.0 pin lacks vmin_rules_out, aerobic_flight_rules_out and the glide/climb lemmas (present in the application repo Constraints.lean at lines 243, 316, 324, 331).',
    'Use the Makiguchi leaps as a falsification test of the stall-floor logic: any logged leap that is both airborne beyond about 0.5 s and below 9.85 m/s would contradict a lift-equals-weight reading.',
    'Treat Deng 2019 launch conditions as inputs: re-run with the coefficients at the launch Reynolds number before using 45.4 m or 13.2 m as targets, and never cite the two numbers as one trajectory.',
    'Mark the Palstra-derived aerobic ceiling as extrapolated from a 0.43 g fish; seek flying-fish or similar-size pelagic MO2max before relying on the 16x shortfall as more than order-of-magnitude.',
    'Label the fin-ratio gap law with its three-species base and the spreadsheet float artifact in the cached CSV; do not promote past candidate until more Exocoetidae species are measured.',
]

reproduce = [
    {'what': 'Environment', 'command_or_url': 'Python 3.14 (C:\\Python314), pdftotext from MSYS2 poppler, curl; all Python run with python -I -X utf8; no packages beyond the standard library', 'expected': 'scripts run unmodified'},
    {'what': 'Fetch open texts (PMC XML via NCBI efetch, Makiguchi PDF, Europe PMC records)', 'command_or_url': 'python -I D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-deep/fetch.py ; curl -A delphi-research/0.1 "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=9172250&rettype=xml" (also ids 3013094, 3574442, 4321159, 8217709, 4685536); curl -L https://link.springer.com/article/10.1007/BF00044128', 'expected': 'files and sha256 listed in D:/Users/ashenoy00000/delphi-work/data/t6-flyingfish/MANIFEST.txt (about 1.1 MB total)'},
    {'what': 'Verify every cited DOI and dump abstracts', 'command_or_url': 'python -I -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-deep/dump_abstracts.py', 'expected': '22 lines ending ok; Crossref abstract length 0 for Deng 2019, Makiguchi, Davenport 1994, Daane, Kawachi, Palstra, Lewallen, Ran (publisher withholds abstract)'},
    {'what': 'Extract text of the cached Park and Choi, Deng and Makiguchi PDFs (reading order)', 'command_or_url': 'pdftotext <repo>/physics/prior-art/raw/wb-park-choi-2010.pdf scratch/t6-flyingfish-deep/pc_raw.txt ; same for pdf2-deng-2019.pdf -> deng_raw.txt ; pdftotext data/t6-flyingfish/makiguchi2013.pdf -> mak_raw.txt ; python totext.py <xml> <txt> for the PMC files', 'expected': 'search pc_raw.txt for "4.37 (0) 0.78 (35)" and "maximum reduction of the drag by 14%"; deng_raw.txt for "take-off speed is fixed at 20 m"'},
    {'what': 'All calculations (stall speed, range bounds, power ratios, Daane fin ratios and log-log fit, Palstra unit conversion)', 'command_or_url': 'python -I -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-deep/analysis.py', 'expected': 'vmin_L3 9.854; v0_needed_50m_noGE 17.93, GE14 17.03; Deng bound 95.82 and ratio 0.4738; Palstra 2629.6; Daane flying fish n=49 b=1.0579 CI [1.0176, 1.0982] r2 0.9834; groups 49/19/22/19'},
    {'what': 'Rebuild this report and re-check every evidence_quote against its source text', 'command_or_url': 'python -I -X utf8 D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-deep/build_report.py', 'expected': 'prints QUOTE FAILURES: 0 and writes D:/Users/ashenoy00000/delphi-work/agents2/t6-flyingfish-deep.json'},
    {'what': 'Registry facts (read only)', 'command_or_url': 'grep -n "rules_out" D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/Delphi/Constraints.lean ; read lean/registry/CHANGELOG.md sections 1.6.0 to 1.8.1 ; lean/registry/lawsets/current.json', 'expected': 'vmin_rules_out line 243, aerobic_flight_rules_out 316, glide_range_rules_out 324, climb_rules_out 331; current version 1.8.1'},
    {'what': 'Not reproducible', 'command_or_url': 'Kawachi 1993, Hertel 1966, Davenport 1990/1992 tables, Fish 1990 full text, Park and Choi Table 1 areas (column order scrambled by text extraction; areas taken from project reading)', 'expected': 'paywalled or unreadable in this run'},
]

could_not_find = [
    'Full text of Kawachi, Inada and Azuma 1993 (ScienceDirect returned no abstract); its 80 m and L/D 15.7 are known only through Deng 2019.',
    'Hertel 1966 (book), Breder 1930, Hubbs 1933, Edgerton and Breder 1941, Davenport 1990: the primary field and film sources of 10 m/s leap, 50 m glide, 400 m total, 8 m maximum height. I cite none of them; the numbers are labelled second-hand.',
    'Any public raw data set of wild flying-fish glide trajectories; none found in my searches (Europe PMC, Crossref); I did not search Zenodo, Dryad or Figshare in this run, the scout reported none.',
    'Full texts of Davenport 1992, 2003, Fish 1990 (paywalled): the 1.147 versus 1.236 wing-loading exponent gap cannot be resolved without the tables.',
    'The bioRxiv taxi preprint full text (the project cache holds a Cloudflare error page, error code 1015); only the abstract is read, so assumptions behind 36 W versus 350 W (rigid kinematics, 10 m/s imposed) are unchecked.',
    'Park and Choi Table 1: pdftotext scrambles the column order, so areas and mass were not re-read by me; mass 0.06 kg and SL 203 mm for L3 are visible, the areas 0.006377 + 0.001837 + 0.004474 m2 come from the project reading (physics/glide-data.csv) and agree with the printed numbers 6377, 1837, 4474 appearing in the extract.',
    'Daane 2021 Data S1A was not fetched by me; the fin-ratio analysis uses the project cache genotype/cache/daane2021_data_s1A_fin_measurements.csv (109 rows), which carries a spreadsheet float artifact.',
    'No Lean build was run (not needed, and the headroom rule limits it); statements about certificates being compiled rest on reading files, not on compiling.',
    'Ran 2026 (Biomimetic Intelligence and Robotics) and Chen and Hu 2026 full text: only record and abstract; Ran has no abstract in Crossref and is not cited.',
    'Rules 8 compliance: three sources (Park and Choi, Fish 1990, Davenport 1994) contain comparisons to other flying animals in their text; I omitted all of those and used only the fish results.',
    'A flying-fish-specific measured aerobic capacity (MO2max, cardiac output): not found; the registry E3 ceiling uses zebrafish.',
]

out = {
    'label': 't6-flyingfish-deep',
    'topic': 'Track 6 deep literature: the flying fish glide and its elimination-certificate evaluation framework',
    'summary': summary,
    'lay_summary': lay_summary,
    'findings': findings,
    'key_claims': key_claims,
    'table': table,
    'reproduce': reproduce,
    'citations': citations,
    'could_not_find': could_not_find,
    'glossary': glossary,
    'recommendations': recommendations,
    'scripts_written': [
        'D:/Users/ashenoy00000/delphi-work/agents2/scripts/t6-flyingfish-deep/' + f for f in
        ['search.py', 'fetch.py', 'totext.py', 'crossref.py', 'crsearch.py', 'epmc_abs.py', 'epmc_search.py', 'dump_abstracts.py', 'analysis.py', 'report_part1.py', 'report_part2.py', 'build_report.py']],
}
for k in key_claims:
    if not k.get('evidence_quote'):
        k['evidence_quote'] = ''
print('QUOTE FAILURES:', len(FAILS))
for f in FAILS:
    print(' ', f)
blob = json.dumps(out, ensure_ascii=False)
bad = re.findall(r'\b([held-out clade]|[held-out clade]|[held-out clade]|feather|feathers|beak|beaks|hawk|petrel|vulture|nighthawk|wood duck|cormorant|pelican)\b', blob, re.I)
print('FROZEN-HOLDOUT WORDS FOUND:', bad)
dest = 'D:/Users/ashenoy00000/delphi-work/agents2/t6-flyingfish-deep.json'
json.dump(out, open(dest, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('wrote', dest, os.path.getsize(dest), 'bytes;', len(findings), 'findings;', len(citations), 'citations;', len(table), 'table rows')
