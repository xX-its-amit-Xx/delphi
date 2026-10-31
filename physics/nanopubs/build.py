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
json.dump({'built': NOW, 'signed': 0, 'published': 0, 'hashes': H, 'records': man}, open(os.path.join(HERE, 'manifest.json'), 'w', encoding='utf-8'), indent=2)
print(json.dumps(man, indent=1))
