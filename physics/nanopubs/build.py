#!/usr/bin/env python
"""Write the physics thread's nanopublication drafts: UNSIGNED, Delphi ontology v2.0 terms, one record per nanopub.

Reads physics/results.json, physics/tests/thompson1917-ch02-06/result.json, physics/sources.json.
Writes physics/nanopubs/unsigned/*.trig and physics/nanopubs/manifest.json.

Nothing here is signed or published. An unsigned draft is not a publication (AGENTS.md). No human is named: the
key owner adds an ORCID at signing time. Hand-authored in v2.0 terms like the lean thread's records; no template is
declared because the published Delphi templates still use a retired namespace (team decision, DECISIONS.md).
Every record carries: the claim in plain words, its status, the evidence item with the computed numbers and the repo
file they came from, the pre-registration file and its hash, and what the record does not establish.
"""
import json, os, hashlib, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); PHYS = os.path.dirname(HERE); REPO = os.path.dirname(PHYS)
res = json.load(open(os.path.join(PHYS, 'results.json'), encoding='utf-8'))
pre_path = os.path.join(PHYS, 'tests', 'thompson1917-ch02-06', 'result.json')
pre = json.load(open(pre_path, encoding='utf-8'))
src = {s['id']: s for s in json.load(open(os.path.join(PHYS, 'sources.json'), encoding='utf-8'))['sources']}
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
H = {'result.json': sha(pre_path), 'glide-data.csv': sha(os.path.join(PHYS, 'glide-data.csv')),
     'comparison-data.csv': sha(os.path.join(PHYS, 'comparison-data.csv')), 'results.json': sha(os.path.join(PHYS, 'results.json'))}
AGENT = 'https://w3id.org/delphi/resource/agent/delphisci-physics-thread-builder'
CLAIM = 'https://w3id.org/delphi/resource/claim/thompson1917-ch02-06'
DOM = 'https://w3id.org/delphi/resource/domain/biomechanics-and-scaling'
def lit(s): return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ') + '"'
WORDS = {0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten'}
def doi(id_): return f"<https://doi.org/{src[id_]['doi']}>"

PREFIX = """@prefix this: <http://purl.org/nanopub/temp/np1/> .
@prefix sub: <http://purl.org/nanopub/temp/np1/> .
@prefix np: <http://www.nanopub.org/nschema#> .
@prefix npx: <http://purl.org/nanopub/x/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix delphi: <https://w3id.org/delphi/ontology/> .
@prefix schema: <https://schema.org/> .

sub:Head {
  this: a np:Nanopublication ;
    np:hasAssertion sub:assertion ;
    np:hasProvenance sub:provenance ;
    np:hasPublicationInfo sub:pubinfo .
}
"""
PREREG = (f"Pre-registration: physics/tests/thompson1917-ch02-06/result.json, written 2026-10-31T18:21:00Z before any wing loading, lifting area or lift coefficient was read, amended 2026-10-31T18:26:00Z before any fit ran (the file lists both and the values seen before each); sha256 at build {H['result.json']}. The git commit that timestamps it is pending: the physics thread does not commit; the hub does.")
NOTSIGNED = "Unsigned draft. Not a publication. The test registry comes first and production needs the ORCID key owner's explicit approval every time."

def record(fname, kind, iri, label, desc, status, evid_iri, evid_label, evid_desc, derived, notestab, scopes=None, related=None, counts=None, extra_comments=None):
    scopes = scopes or []; counts = counts or {}; extra_comments = extra_comments or []
    a = [PREFIX, 'sub:assertion {']
    a.append(f'  <{iri}> a delphi:{kind}, skos:Concept ;')
    a.append(f'    rdfs:label {lit(label)} ;')
    a.append(f'    dct:description {lit(desc)} ;')
    for k, v in counts.items():
        a.append(f'    schema:additionalProperty [ a schema:PropertyValue ; schema:propertyID "{k}" ; schema:value {v} ] ;')
    for cmt in extra_comments:
        a.append(f'    rdfs:comment {lit(cmt)} ;')
    a.append(f'    delphi:context {lit("Claim under test: thompson1917-ch02-06 (D Arcy Thompson 1917, On Growth and Form, ch. II, Project Gutenberg 55264 lines 1716-1790), with thompson1917-ch02-07 and thompson1917-ch02-10. Taxon: Exocoetidae, NCBI Taxonomy 76072, GBIF 2968. Class Aves is the frozen holdout (holdout/exam.json); no bird value enters this record.")} ;')
    a.append(f'    delphi:hasEvidence <{evid_iri}> ;')
    a.append(f'    prov:wasDerivedFrom {", ".join(derived)} ;')
    for s in scopes: a.append(f'    skos:scopeNote {lit(s)} ;')
    a.append(f'    rdfs:comment {lit("Status: " + status + ". " + notestab)} ;')
    a.append(f'    rdfs:comment {lit(PREREG)} ;')
    if related: a.append(f'    skos:related <{related}> ;')
    a.append(f'    rdfs:seeAlso <https://delphi-mission-control.ashenoy000.workers.dev/t/physics/>, <https://delphi-mission-control.ashenoy000.workers.dev/t/physics/results.json> .')
    a.append(f'  <{evid_iri}> a delphi:EvidenceItem ;')
    a.append(f'    rdfs:label {lit(evid_label)} ;')
    a.append(f'    dct:description {lit(evid_desc)} ;')
    a.append(f'    dct:subject <{iri}> ;')
    a.append(f'    rdfs:comment {lit("Computed by physics/analysis.py from physics/glide-data.csv (sha256 " + H["glide-data.csv"] + ") and physics/comparison-data.csv (sha256 " + H["comparison-data.csv"] + "); numbers in physics/results.json (sha256 " + H["results.json"] + "). Every input value carries its source, locator, retrieval time and value kind in those files.")} ;')
    a.append(f'    prov:wasDerivedFrom <https://delphi-mission-control.ashenoy000.workers.dev/t/physics/results.json>, <https://delphi-mission-control.ashenoy000.workers.dev/t/physics/data/glide-data.csv>, <https://delphi-mission-control.ashenoy000.workers.dev/t/physics/data/comparison-data.csv> .')
    a.append('}')
    a.append('')
    a.append('sub:provenance {')
    a.append(f'  sub:assertion prov:wasAttributedTo <{AGENT}> ;')
    a.append(f'    prov:wasDerivedFrom <https://delphi-mission-control.ashenoy000.workers.dev/t/physics/data/result.json>, <https://delphi-mission-control.ashenoy000.workers.dev/t/physics/results.json> .')
    a.append(f'  <{AGENT}> a prov:SoftwareAgent ;')
    a.append(f'    rdfs:label {lit("delphisci physics thread (Claude Fable 5.1 writing the data tables, the analysis script and this builder; a builder, not an assessor)")} ;')
    a.append(f'    delphi:usesModel <https://w3id.org/delphi/resource/model/claude-fable-5-1> .')
    a.append(f'  <https://w3id.org/delphi/resource/model/claude-fable-5-1> a delphi:LanguageModel ;')
    a.append(f'    rdfs:label "Claude Fable 5.1" ;')
    a.append(f'    dct:identifier "claude-fable-5-1" .')
    a.append('}')
    a.append('')
    a.append('sub:pubinfo {')
    a.append(f'  this: dct:created "{NOW}"^^xsd:dateTime ;')
    a.append(f'    dct:creator <{AGENT}> ;')
    a.append(f'    rdfs:label {lit(label)} ;')
    a.append(f'    rdfs:comment {lit(NOTSIGNED + " Owner ORCID not set: the key owner adds it at signing time; until then no human is named in this record.")} ;')
    a.append(f'    rdfs:comment {lit("Hand-authored in Delphi ontology v2.0 terms (https://w3id.org/delphi/ontology/) by the builder, not created from a template: the published Delphi templates still use legacy probknow IRIs (team decision 2026-10-31, DECISIONS.md), so no nt:wasCreatedFromTemplate is declared and a template-conformance checker will report none.")} ;')
    a.append(f'    dct:license <https://creativecommons.org/licenses/by/4.0/> ;')
    a.append(f'    npx:hasNanopubType <https://w3id.org/delphi/ontology/{kind}> ;')
    a.append(f'    npx:introduces <{iri}> ;')
    a.append(f'    delphi:domain <{DOM}> .')
    a.append(f'  <{DOM}> rdfs:label "biomechanics-and-scaling" .')
    a.append('}')
    os.makedirs(os.path.join(HERE, 'unsigned'), exist_ok=True)
    p = os.path.join(HERE, 'unsigned', fname)
    open(p, 'w', encoding='utf-8').write('\n'.join(a) + '\n')
    return {'file': 'physics/nanopubs/unsigned/' + fname, 'kind': kind, 'iri': iri, 'status': status, 'label': label}

B = res['interpretation_B']; A = res['interpretation_A']; C = res['interpretation_C']; cov = res['coverage']
man = []
# 1. Reading B
man.append(record('evidence-flying-fish-inside-envelope.trig', 'Hypothesis',
    'https://w3id.org/delphi/resource/hypothesis/flying-fish-glides-at-or-above-minimum-lift-speed',
    'A flying fish glides at or above the slowest speed its fins can hold it up at',
    f"From the measured weight ({B['W_N']:.4f} N), reference lifting area ({B['reference_area_m2']:.5f} m2) and maximum lift coefficient ({B['C_Lmax']}) of a darkedged-wing flying fish specimen (Park and Choi 2010, model L3), the slowest lift-supported speed is v_min = sqrt(2W/(rho S C_Lmax)) = {B['v_min_m_s']:.2f} m/s at rho = 1.225 kg/m3. Published field glide speeds for flying fish are {B['airspeed_range_m_s'][0]:.0f} to {B['airspeed_range_m_s'][1]:.0f} m/s (Hertel 1966, Fish 1990, Davenport 1994, as quoted by Park and Choi 2010 and Makiguchi et al. 2013). The quoted speeds overlap the pre-registered band [v_min, 3 v_min] = [{B['v_min_m_s']:.2f}, {B['three_v_min_m_s']:.2f}] m/s, so under this reading the fish is inside Thompson's envelope: supported.",
    'supported',
    'https://w3id.org/delphi/resource/evidence/physics-thompson-ch02-06-reading-B',
    'Computation of v_min for Cypselurus hiraii specimen L3 and comparison with quoted field glide speeds',
    f"Inputs: body mass 0.06 kg, pectoral fin area 6377 mm2, pelvic fin area 1837 mm2, body planform 4474 mm2, C_Lmax 0.78 at 35 deg attack (Park and Choi 2010, J Exp Biol 213:3269, Tables 1 and 2, full text retrieved {src['park-choi-2010']['retrieved_at']}); airspeed 10 to 20 m/s (Park and Choi 2010 introduction quoting Hertel 1966, Fish 1990, Davenport 1994; Makiguchi et al. 2013 introduction quoting Edgerton and Breder 1941 and Davenport 1990). Result: wing loading {B['W_N']/B['reference_area_m2']:.1f} N/m2, v_min {B['v_min_m_s']:.2f} m/s, band to {B['three_v_min_m_s']:.2f} m/s, verdict inside. Second specimen, descriptive only: Cheilopogon heterurus doederleini 0.226 kg over 0.0225 m2 (Kawachi et al. 1993 as quoted by Deng et al. 2019) gives {B['second_specimen']['wing_loading_N_m2']:.1f} N/m2 and v_min {B['second_specimen']['v_min_with_Park_Choi_CLmax_m_s']:.1f} m/s with the borrowed C_Lmax.",
    [doi('park-choi-2010'), doi('makiguchi-2013'), doi('deng-2019')],
    "Does not establish: that the glide speeds were measured on the fish whose wing loading was measured (the speeds are family-level, second-hand figures for larger fish of several genera; the morphometrics are 40 to 60 g stuffed specimens of one species, a weakness the pre-registration did not foresee and that is recorded there as a caveat); that C_Lmax is the same in free flight as in the wind tunnel; anything about Thompson's scaling law across sizes (that is reading A, inconclusive); anything about birds.",
    scopes=["Assumed, not proved: sea-level air density 1.225 kg/m3; steady lift-supported flight with lift equal to weight; C_Lmax from a stuffed specimen at 12 m/s applies in free flight.",
            "Measured: W, S, C_Lmax (Park and Choi 2010). Secondary: the field airspeed range. Simulation excluded: Deng 2019 CFD values enter no verdict."],
    related=CLAIM))
# 2. Reading A
g = A['gliders']; p = A['powered']; pool = A['pooled_descriptive_only']
man.append(record('evidence-speed-vs-wing-loading-inconclusive.trig', 'Hypothesis',
    'https://w3id.org/delphi/resource/hypothesis/airspeed-scales-with-wing-loading-one-half-non-bird',
    'Across non-bird fliers, airspeed grows as the square root of wing loading: untested at this power',
    f"Thompson's argument predicts that characteristic airspeed v scales with wing loading W/S to the power 1/2. On the taxa with a fetched W/S and speed, fitted separately for gliders and powered fliers as pre-registered: gliders n = {g['n']} (flying fish, northern flying squirrel), too few for a fit; powered fliers n = {p['n']} (three bats, three hoverflies), log-log slope {p['slope']:.2f} with 95 percent CI {p['slope_ci95'][0]:.2f} to {p['slope_ci95'][1]:.2f}, but the wing loadings span {p['decades_of_WS']:.2f} decades against the pre-registered minimum of 1.0. Both verdicts are inconclusive (underpowered). The pooled slope across all {pool['n']} points, {pool['slope']:.2f} +- {pool['slope_se']:.2f} (r2 {pool['r2']:.2f}), is descriptive only because it mixes two physical regimes.",
    'inconclusive',
    'https://w3id.org/delphi/resource/evidence/physics-thompson-ch02-06-reading-A',
    'Ordinary least squares of log10 airspeed on log10 wing loading, gliders and powered fliers separately',
    "Points: " + "; ".join(f"{q['species']} ({q['mode']}): W/S {q['WS']:.2f} N/m2, v {q['v']:.2f} m/s, {q['provenance']}" for q in A['points']) + f". Gliders: n {g['n']}, decades {g['decades_of_WS']:.2f}, {g['why']}. Powered: n {p['n']}, slope {p['slope']:.3f}, CI {p['slope_ci95'][0]:.3f} to {p['slope_ci95'][1]:.3f}, r2 {p['r2']:.2f}, decades {p['decades_of_WS']:.2f}, {p['why']}. Pooled descriptive slope {pool['slope']:.3f} +- {pool['slope_se']:.3f}.",
    [doi('park-choi-2010'), doi('bahlman-2013'), doi('span-efficiency-2026')],
    "Does not establish: the truth or falsity of the scaling law; it records that the accessible data cannot decide it at the pre-registered power. The bat and hoverfly values come from a compilation whose primary sources were not fetched and whose mass and area columns disagree with its wing-loading column for insects by a factor of 5 to 8. Bat speeds are wind-tunnel test speeds, not cruising speeds. No bird enters the fit (Aves holdout). The next team needs three or more glider taxa with first-hand wing loading and speed (Davenport 1992 and Fish 1990 full texts would supply flying-fish species) before this reading can be decided.",
    scopes=["Assumed, not proved: constant air density and lift coefficient across taxa, which is what turns the lift equation into a slope of 1/2."],
    related=CLAIM,
    extra_comments=["Identifier note: the Bahlman et al. 2013 DOI cited in prov:wasDerivedFrom above is real. It resolved in Crossref on 2026-10-31T18:15:48Z with matching title and journal (physics/prior-art/raw/cr-bahlman-2013.json) and the full text was read from PubMed Central PMC3565731. The Delphi lint's fabricated-DOI pattern matches the Royal Society year.number article form and reports it as DUMMY-DOI; that is a false positive and the real identifier is kept."]))
# 3. Reading C
man.append(record('evidence-muscle-power-cannot-tell.trig', 'Hypothesis',
    'https://w3id.org/delphi/resource/hypothesis/flying-fish-muscle-power-sufficient-for-level-flight',
    'Whether a flying fish has the muscle power for level flight cannot be told from published numbers',
    f"The mechanical power to fly level at the minimum lift-supported speed with the best measured glide ratio is P_req = W v_min / (L/D)max = {C['P_req_W_at_v_min']:.2f} W for the 0.06 kg specimen ({C['P_req_per_kg_body_W_kg']:.1f} W per kg of body mass). No fetched source gives the muscle mass fraction or the mass-specific muscle power of a flying fish, so the available power cannot be computed and the pre-registered verdict is cannot-tell (inconclusive, missing input).",
    'inconclusive',
    'https://w3id.org/delphi/resource/evidence/physics-thompson-ch02-06-reading-C',
    'Power required for level flight at v_min for Cypselurus hiraii specimen L3',
    f"P_req = {B['W_N']:.4f} N x {B['v_min_m_s']:.2f} m/s / {B['LD_max']} = {C['P_req_W_at_v_min']:.3f} W. {C['what_would_decide_it']} Davenport 1992 (abstract) states only that flying fish possess no more red axial muscle than cruising pelagic fish such as mackerel and that take-off probably uses anaerobic white muscle.",
    [doi('park-choi-2010'), doi('davenport-1992')],
    "Does not establish: that flying fish could or could not power flight; it records a missing input. The (L/D)max of 4.37 is from a stuffed specimen in a wind tunnel. Thompson's premise that muscle power scales as body mass (P_avail proportional to L^3) is itself an assumption and is sent to the Lean thread as a named hypothesis, not a fact (physics/FORMAL-STATEMENTS.md, R6).",
    related='https://w3id.org/delphi/resource/claim/thompson1917-ch02-07'))
# 4. Coverage finding
man.append(record('finding-flying-fish-glide-data-coverage.trig', 'Hypothesis',
    'https://w3id.org/delphi/resource/hypothesis/flying-fish-glide-data-no-complete-species-record-accessible',
    'No open source gives body mass, fin area and a measured glide speed for the same flying fish',
    f"A logged search of OpenAlex, PubMed, Europe PMC, Crossref and Semantic Scholar (97 calls, physics/SEARCHES.md) assembled {cov['rows']} rows for {WORDS[cov['n_species_or_groups']]} species or groups of Exocoetidae from {WORDS[len(cov['sources'])]} fetched sources. Only {WORDS[len(cov['species_with_first_hand_measurements'])]} species have first-hand measurements (Cypselurus hiraii: mass, fin areas, span, lift and drag coefficients; Cheilopogon heterurus doederleini: length, mass, take-off pitch and an estimated leap speed in captivity). Every glide speed, glide distance and flight height is a second-hand quote of works from 1941 to 1994 whose full texts are paywalled or unavailable online. No species has mass, fin area and a measured airspeed in the same accessible source. Status: supported, as a statement about the accessible literature on 2026-10-31.",
    'supported',
    'https://w3id.org/delphi/resource/evidence/physics-glide-data-coverage',
    'Coverage count of physics/glide-data.csv by column and value kind',
    "; ".join(f"{k}: rows with a value {v['rows_with_value']}, species or groups {len(v['species'])}, value kinds {v['by_value_kind']}" for k, v in cov['per_column'].items()) + ". Missing: " + " ".join(cov['what_is_missing']),
    [doi('park-choi-2010'), doi('makiguchi-2013'), doi('davenport-1994'), doi('davenport-1992'), doi('davenport-2003'), doi('fish-1990'), doi('deng-2019')],
    "Does not establish: that the measurements do not exist; Davenport 1992 and Fish 1990 almost certainly contain wing loadings for several species behind a paywall, and Hertel 1966, Edgerton and Breder 1941 and Davenport 1990 hold the primary field speeds. Google Scholar and museum collections were not searched. This is a finding about access, written so the next team does not repeat the search.",
    related='https://w3id.org/delphi/resource/claim/darwin1859-ch06-05',
    counts={'n_rows': cov['rows'], 'n_species': cov['n_species_or_groups'], 'n_sources': len(cov['sources'])}))

# 5. Bridge: fin proportion of the wind-tunnel specimens against measured flying fish
br = json.load(open(os.path.join(PHYS, 'bridge.json'), encoding='utf-8'))
ffg = br['groups']['flying fish']; pcb = br['park_choi_specimens_upper_bound']
man.append(record('finding-wind-tunnel-specimens-proportioned-like-flying-fish.trig', 'Hypothesis',
    'https://w3id.org/delphi/resource/hypothesis/park-choi-specimens-fin-proportion-within-flying-fish-range',
    'The wind-tunnel fish whose wing loading sets the envelope have fin proportions like real flying fish',
    f"Daane et al. 2021 measured pectoral fin length and standard length on 109 preserved beloniform specimens (Harvard MCZ). Recounted from the Genotype thread's per-specimen file: flying fish median pectoral length over standard length {ffg['median']:.3f} (range {ffg['min']:.3f} to {ffg['max']:.3f}, n {ffg['n']}), gliding halfbeaks {br['groups']['flying halfbeak']['median']:.3f}, halfbeaks {br['groups']['halfbeak']['median']:.3f}, needlefishes {br['groups']['needlefish']['median']:.3f}. The five specimens of Park and Choi (2010) report only tip-to-tip span and dihedral, so fin length over standard length is bounded above by half span over cos(dihedral) over standard length: " + ", ".join(f"{q['model']} at most {q['pectoral_over_SL_upper_bound']:.3f}" for q in pcb) + ". These bounds lie inside the flying-fish range and at or below its median, and far above every halfbeak and needlefish. Status: supported, as a consistency statement.",
    'supported',
    'https://w3id.org/delphi/resource/evidence/physics-bridge-fin-proportion',
    'Recount of Daane et al. 2021 Data S1A ratios and upper bounds for the Park and Choi specimens',
    "Recount agrees with the Genotype thread's summary for all four groups (n and median identical). Bounds use the dihedral angles stated by Park and Choi (22, 12, 7 deg for L1, L2, L3); model M's angle is not legible, so the largest stated angle is used, giving the loosest bound. Body width is not reported, so the true ratio is lower by half the body width over (cos(dihedral) times standard length). Computed by physics/bridge.py into physics/bridge.json.",
    [doi('park-choi-2010'), '<https://doi.org/10.1016/j.cub.2021.08.054>'],
    "Does not establish: fin area, mass or glide performance for any Daane specimen (lengths only, preserved); that Cypselurus hiraii is in the Daane table (it is not; no synonymy with Cheilopogon is claimed); any length-to-area conversion (none is made, no sourced shape factor exists); anything about the genes beyond the citation: Daane et al. 2021 report that lat4a with kcnh2a reproduces the flying-fish fin proportion in zebrafish, which the Genotype thread records separately.",
    scopes=["Measured: Daane et al. 2021 lengths (109 specimens) and Park and Choi 2010 spans. Derived: the upper bound, an inequality that needs only body width >= 0.", "Say fin enlargement for gliding, never fin-to-wing: the wing is an enlarged pectoral fin."],
    related='https://w3id.org/delphi/resource/claim/darwin1859-ch06-05',
    counts={'n_specimens': br['source']['rows_read']}))

# 6. Simulator result (exploratory)
man.append(record('finding-simulator-taxi-glide-sequence-posthoc.trig', 'Hypothesis',
    'https://w3id.org/delphi/resource/hypothesis/flying-fish-simulator-reproduces-taxi-glide-sequence',
    'A point-mass model with measured fin aerodynamics reproduces a flying fish taxi-and-glide sequence, but only after post-hoc changes',
    "A 2D side-view model (RK4, 1 ms) of the Park and Choi 2010 specimen L3, with its measured mass, areas, lift and drag coefficients and ground effect, swims to 10 m/s, taxis with the tail in the water, lifts off at 16.5 m/s, glides 36 m in 3.1 s to 3.1 m, and repeats: six glides, 288 m in 23 s, against field figures of up to 50 m per glide at 15 to 20 m/s and 400 m in 30 s. The validation was pre-registered before the first run; the model was then changed after seeing results (taxi trim law, approach angle, breach rule, taxi thrust factor), so tests 1 to 3 are exploratory and the status of this record is inconclusive. The single glide exceeds the pure-glide bound h_max (L/D)max = 35 m by the kinetic energy gained in the taxi, which shows why long field flights need repeated taxis.",
    'inconclusive',
    'https://w3id.org/delphi/resource/evidence/physics-simulator-run-6',
    'Run 6 of the simulator, headless, with the run log',
    "Pre-registration physics/sim/PREREG.md (sha256 in PREREG.sha256, written 2026-10-31T20:34Z before run 1). Run log physics/sim/RUNS.md: six runs and two sweeps, every change with its reason; four deviations listed. Parameters and kinds in dashboard/public/t/physics/sim/params.json: measured (Park and Choi 2010), secondary (field figures), assumed (control law, breach rule, lobe geometry, water drag) and tuned (swim thrust to 10 m/s, taxi thrust factor 0.7 to the taxi length). Test 4, that the real fish cannot power-fly, is untouched and not run (physiology chain pending).",
    [doi('park-choi-2010'), doi('makiguchi-2013'), doi('deng-2019'), doi('davenport-1994')],
    "Does not establish: that the parameters are right (several are assumed or tuned to the very figures used as targets); that the field figures, all second-hand, are accurate; that the model generalises beyond one 60 g specimen; anything about powered flight; anything about birds. A simulation that runs proves the program executes and nothing more.",
    scopes=["Simulated: every number in the evidence item. Measured: the fin polar and morphometrics. Secondary: the field targets. The record is exploratory by the hub's ruling of 2026-10-31."],
    related=CLAIM))
# 7. Design study
spec = json.load(open(os.path.join(PHYS, 'flier', 'spec.json'), encoding='utf-8')); pb = spec['power_budget']; dg = spec['design']
man.append(record('hypothesis-truly-flying-fish-design-requirements.trig', 'Hypothesis',
    'https://w3id.org/delphi/resource/hypothesis/truly-flying-fish-requirements-sixty-gram',
    "HYPOTHETICAL: a 60 g flying fish that climbs under its own power would need four times the fin area, sixteen percent flight muscle and about five times a bat's oxygen supply per kilogram",
    f"Design study, not an organism. Keeping the real specimen's mass (0.06 kg), fin section (C_Lmax 0.78, L/D max 4.37, Park and Choi 2010) and the simulator's equations, and changing only morphology and physiology: wing loading 12 N/m2 (inside the bat range 6.5 to 14.25) needs lifting area {dg['lifting_area_m2']['value']:.4f} m2, 3.9 times the real reference area, span {dg['span_m']['value']:.2f} m at aspect ratio 9. Level flight at the best speed costs {pb['P_req_min_level_W']:.2f} W mechanical including 0.48 W of flapping inertia; a 1 m/s climb {pb['P_req_min_climb_1_m_s_W']:.2f} W. At a muscle specific power of 202 W/kg derived from a bat (Pipistrellus nathusii: 0.140 W maximum mechanical power from 0.69 g of flight muscle), the bat mean muscle fraction (9.13 percent) gives 1.1 W, not enough for level flight; 16 percent gives 1.94 W and covers the climb. At 10 percent conversion efficiency (bat-measured 7.0 to 10.4) the climb needs {pb['metabolic_power_W_for_climb']:.1f} W metabolic, {pb['metabolic_W_per_kg_body']:.0f} W per kg body, about {pb['O2_demand_ml_per_min_per_kg']:.0f} ml O2 per minute per kg, while airborne, where gills do not ventilate: an air-breathing respiratory surface is therefore a design requirement, not an option. Status: untested hypothesis (design study); the oxygen side awaits the physiology chain and the Lean O2-to-power bound, and the simulated climb is power-limited only.",
    'inconclusive',
    'https://w3id.org/delphi/resource/evidence/physics-flier-design-budget',
    'Power and oxygen budget of the designed flier from sourced non-bird values',
    "Inputs (physics/flier/spec.json, sources block): bat flight muscle fraction mean 9.13 percent, minimum 7.8 (10.1038/s42003-024-06032-9 citing Bullen and McKenzie 2004); P. nathusii mechanical power 0.046 to 0.140 W for 7.6 g and conversion efficiency 7.0 to 10.4 percent (10.1098/rspb.2023.0045); inertial power 8 W/kg (10.1098/rsif.2022.0315); bat wing loadings 6.5 to 14.25 N/m2 (compilation); pterosaur hatchling wing loading 15.8 to 17.9 N/m2 and aspect ratio 6.1 to 6.5 (10.1038/s41598-021-92499-z); bumblebee hovering 559 W/kg, efficiency 7.3 to 14.7 percent (10.1098/rsbl.2025.0325); oxycaloric equivalent 20.1 J per ml O2. No bird value: class Aves is the frozen holdout. Computed by physics/flier/design.py. In the simulator the flier lifts off at 11.6 m/s and climbs to 42 m in 40 s with the real fish's equations, on muscle power alone with no oxygen limit applied.",
    ['<https://doi.org/10.1038/s42003-024-06032-9>', '<https://doi.org/10.1098/rspb.2023.0045>', '<https://doi.org/10.1098/rsif.2022.0315>', '<https://doi.org/10.1038/s41598-021-92499-z>', '<https://doi.org/10.1098/rsbl.2025.0325>', doi('park-choi-2010')],
    "Does not establish: that such a fish could develop (development is not simulated); that fins of four times the area keep the measured polar; that any respiratory surface can deliver the oxygen in air; that the derived muscle specific power applies to fish muscle; anything about birds. It is a statement of requirements under the stated equations, not a prediction that the organism is possible.",
    scopes=["Hypothetical throughout; every input is a bat, insect or pterosaur value or a measured flying-fish value; the muscle specific power is derived from two sourced bat numbers."],
    related='https://w3id.org/delphi/resource/claim/darwin1859-ch06-05'))
# 8. FishBase coverage
import csv as _csv
lw = list(_csv.DictReader(open(os.path.join(PHYS, 'length-weight.csv'), encoding='utf-8')))
fitted = [r for r in lw if r['note'].startswith('fitted')]
man.append(record('finding-fishbase-length-weight-coverage.trig', 'Hypothesis',
    'https://w3id.org/delphi/resource/hypothesis/fishbase-length-weight-exocoetidae-coverage',
    'FishBase lists length-weight parameters for nineteen flying-fish species, but only seven rows look like fitted field studies',
    f"Of 27 Exocoetidae species summary pages fetched from FishBase on 2026-10-31, 19 have a length-weight page, giving {len(lw)} rows of W = a L^b. {len(fitted)} rows carry a locality and a sample size (Kuroshio off Taiwan 2008 to 2017 for Cheilopogon atrisignis, C. unicolor, Cypselurus poecilopterus and Hirundichthys oxycephalus; Caicara do Norte 2011 to 2012 for H. affinis by sex); the remaining {len(lw)-len(fitted)} rows have b exactly 3.000, a sample size of two to six and no locality, and look like FishBase-derived estimates rather than measurements; the list page shows no reference for any row. No study is listed for Cypselurus hiraii, the only species with measured wing aerodynamics. Status: supported, as a statement about FishBase as served on 2026-10-31.",
    'supported',
    'https://w3id.org/delphi/resource/evidence/physics-fishbase-length-weight-table',
    'physics/length-weight.csv built from the fetched FishBase pages',
    "Each row: species, a, b, sex, length range and type, r2, n, locality, FishBase row count on the page, retrieval time, and a note saying whether it looks fitted or estimated. Fetches logged in physics/SEARCHES.md (tags fb-summary-*, fb-lw-*).",
    ['<https://www.fishbase.se/>'],
    "Does not establish: the references behind the rows (not shown on the list page and not fetched); that the b = 3.000 rows are wrong, only that they are unverified; anything about species with no page.",
    counts={'n_rows': len(lw), 'n_species': 19}))

# 9. Test 4 result (confirmatory test of the coupled model)
man.append(record('evidence-test4-real-fish-powered-flight.trig', 'Hypothesis',
    'https://w3id.org/delphi/resource/hypothesis/coupled-model-real-flying-fish-cannot-power-fly',
    'The coupled simulator correctly denies the real flying fish powered flight at its own muscle, but lets it power-fly for half a minute if given a bat\'s flight-muscle fraction',
    "Pre-registered test 4 (physics/sim/PREREG.md): the model must not let the real fish gain net mechanical energy while airborne. Run on 2026-10-31 with the physiology chain (gill counter-current, haemoglobin, cardiac output, Hill-type muscle, blood and burst stores; physiology/ at the hub's commit). Arm (a), chain default of no flight muscle: the fish gains nothing (0 J/kg; flight power 0 W against 1.44 W required): supported. Arm (b), flight muscle at the bat mean of 9.13 percent with the launch capped by the chain: never airborne, so trivially supported. Arm (b'), added after (b) and more generous to flight (uncapped launch, flapping allowed): the fish gains 54 J/kg of mechanical energy and sustains 26 s bouts of 337 m at 16.5 m/s on its burst store (1.60 W available against 1.44 W required) until the store empties: the model FAILS its key test under the pre-registered non-bird upper bound. Status: refuted for the model as configured under (b'); supported under (a). A second finding: with the chain capping the launch, the real fish cannot reach lift-off at all, because its axial burst power (8.75 W) cannot drive the thrust the tuned hydrodynamics demand (about 36 to 40 W), which shows the tuned water drag and thrust of runs 5 and 6 to be unphysical.",
    'refuted',
    'https://w3id.org/delphi/resource/evidence/physics-simulator-test4',
    'Test 4 runs (a), (b), (b\') and the flier readout with the chain on',
    "Numbers from the simulator's own validation table, headless, recorded in physics/sim/RUNS.md: (a) net gain 0.0 J/kg, P_avail(flight) 0.00 W, P_req(level) min 1.44 W; (b) identical, never airborne (60 s taxi at 3.5 m/s, burst store 0 percent); (b') net gain 54.0 J/kg, P_avail(flight) 1.60 W, glides of 337 m in 26.2 s to 6.9 m at 16.5 m/s, burst store 0 percent at the end, blood O2 store 38 percent. Flier with the chain on: climbs to 179 m at 66 s, then its flight power falls below 0.5 W, limited by the burst store (0 percent) with the blood O2 store at 35 percent. Physiology copy sha256-identical to physiology/ (node physiology/test.mjs passed per the hub). Flags added for (b'): launchcap=0, flap=1, tmax.",
    [doi('park-choi-2010'), '<https://doi.org/10.1038/s42003-024-06032-9>'],
    "Does not establish: that a real flying fish can power-fly (it has no 9 percent flight muscle: Davenport 1992); that the chain's white-muscle burst power applies to fin muscle; that the field sequence is reachable at all under the chain (it is not, with the tuned launch); anything about birds. Tests 1 to 3 remain post-hoc. What the fail means: the pre-registered upper bound, or the chain's burst power as applied to a flight muscle, or both, are too generous, and the hydrodynamic launch is unphysical; the next version must fix the launch against the chain's power before any validation claim.",
    scopes=["Simulated throughout. The pre-registration and run log are the evidence of what was fixed before and changed after each run."],
    related=CLAIM))

# 10. v2: launch from physiology only
man.append(record('finding-sim-v2-launch-not-reachable.trig', 'Hypothesis',
    'https://w3id.org/delphi/resource/hypothesis/coupled-model-v2-real-fish-cannot-reach-liftoff-from-physiology-power',
    'Driven by its modelled physiology alone, a 60 g flying fish cannot reach lift-off speed in the coupled model, and its aerobic power is two orders of magnitude short of powered flight',
    "Simulator version 2, pre-registered before any run (physics/sim/PREREG-v2.md, sha256 2dde1f61f3aa65ebd116bbad302d61419cf4c7198cdccbbc5e3a05def8056828): swim and taxi thrust come only from the physiology chain's axial power (aerobic plus burst), with the body water drag kept as a named assumption (no fetched coefficient; logged search epmc-v2-fish-drag) and swept from C_d 0.03 to 0.3; sustained powered flight defined in advance as aerobic-only net mechanical energy gain held for 10 s. Result: the real fish never becomes airborne in any arm; peak speed 10.0 m/s at C_d 0.1, 13.7 at 0.03, 7.3 at 0.3, against about 16 m/s needed for its fins to lift it under the run-6 trim law and measured polar; the burst store empties in the attempt. Test 4 v2 is therefore recorded as not reachable under these assumptions, neither passed nor failed, as the pre-registration provided. Independently of reachability, the chain's aerobic flight power for a bat-sized flight muscle (9.13 percent of body mass, red fibres 5 percent of it at the scup red-muscle maximum of 134 W/kg at 20 C, Q10 1.88) is 0.009 W against 1.44 W required for level flight. Status: inconclusive for the test; the power shortfall is a supported statement about the model.",
    'inconclusive',
    'https://w3id.org/delphi/resource/evidence/physics-simulator-v2-runs',
    'Version-2 runs (a), (b), (c) and the drag sweep, 90 s each, headless',
    "physics/sim/RUNS.md, v2 section: (a) fmf 0: not airborne, peak 10.0 m/s; (b) fmf 0.0913 flapping from total power: not airborne, aerobic flight power max 0.009 W, no burst bout; (c) fmf 0.0913 flapping from aerobic power: not airborne; sweep C_d 0.03 peak 13.7 m/s, C_d 0.3 peak 7.3 m/s; burst store 0 percent and blood O2 store 25 to 28 percent at the end of each. Physiology copy sha256-identical to the committed physiology/. Flags v2=1, flapsrc, fmf, cdw, tmax as pre-registered; nothing tuned.",
    [doi('park-choi-2010'), '<https://doi.org/10.1038/s42003-024-06032-9>'],
    "Does not establish: that a real flying fish cannot reach 15 to 20 m/s (it does, in the field); it establishes that the model's assumed water drag, assumed lobe thrust model, or the chain's burst-store proxy (mahi-mahi), or more than one, are wrong for this fish, in that order of suspicion; which one is not decided here. Does not establish anything about birds. The v1 record (test 4 passed at own muscle, failed at the post-hoc upper bound) stands unchanged.",
    scopes=["Simulated throughout; the pre-registration fixed the launch model, the definition of sustained flight, the arms and the sweep before any run."],
    related=CLAIM))
json.dump({'built': NOW, 'signed': 0, 'published': 0, 'hashes': H, 'records': man}, open(os.path.join(HERE, 'manifest.json'), 'w', encoding='utf-8'), indent=2)
print(json.dumps(man, indent=1))
