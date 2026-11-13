# Assemble and verify the final result JSON. Run: python build.py   (not -I: it exec's sibling part files by path)
import sys, json, os, re
sys.stdout.reconfigure(encoding='utf8')
B = 'D:/Users/ashenoy00000/delphi-work/agents2/scripts/bm-buehler-materials-corpus/'
OUT = 'D:/Users/ashenoy00000/delphi-work/agents2/bm-buehler-materials-corpus.json'
for p in ('p1_sources.py', 'p2_findings_a.py', 'p3_findings_b.py', 'p4_corpus_findings.py', 'p5_table_text.py'):
    exec(open(B + p, encoding='utf8').read())

CORPUS = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/research/buehler-corpus.json and .../corpus/buehler.json'
def source_of(key, claim, quote):
    if claim.startswith('OWN CALCULATION'):
        return 'own calculation, script %scalc.py (output D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-buehler-materials-corpus/calc_out.json); inputs: %s' % (B, SRC[key]['url'])
    if key == 'corpus_json' and not quote:
        return 'own count, scripts %scorpus_stats.py and %scluster.py over %s' % (B, B, CORPUS)
    s = SRC[key]['url']
    if SRC[key]['path']:
        s += ' | local copy: ' + SRC[key]['path']
    return s

findings, failed, n = [], 0, 0
for (key, claim, value, conf, quote) in FA + FB + FC:
    if quote:
        n += 1
        if not check(key, quote) or len(quote.split()) > 40:
            failed += 1; print('QUOTE FAIL', key, quote[:90])
    findings.append(dict(claim=claim, source=source_of(key, claim, quote), value=value, confidence=conf, evidence_quote=quote))
print('quotes checked: %d, failed: %d, findings: %d' % (n, failed, len(findings)))
assert failed == 0

KEYQ = {
 'k1': ('Gu thesis Table 2.1 + Dimas thesis', 'gu_thesis', "Young's rnodulus [MPa] 2187 404 0.53 0.02 Strength [MPa] 46.41 3.23 0.72 0.04"),
 'k2': ('Dimas thesis', 'dimas_thesis', 'All specimens used in the study are printed at Objet Inc., in Billerica, MA, USA using an Objet Connex500TM multi-material 3D printer.'),
 'k3': ('Gu thesis ch.7', 'gu_thesis', 'the ML-designed hierarchical composite is approximately 25 times tougher than the stiff material and approximately 40 times tougher than the soft material.'),
 'k4': ('Flexible 80A V2 TDS', 'f80v2_tds', 'Deionized Water 1 day -26 +8% +3% 94% 89%'),
}
for k, (_, s, q) in KEYQ.items():
    assert check(s, q), k

key_claims = [
 dict(claim='The Buehler corpus does not close the project\'s evidence gap: no abstract among the 795 fetched works mentions vat-photopolymer, powder-bed or Formlabs printing, only 16 mention humidity-type stimuli, and none reports a hygroscopic expansion coefficient or diffusivity for a printed polymer (abstract-level; 319 of 493 track-5 works have abstracts). Every printed-composite result I could trace to a printer (Dimas and Gu theses) used single-print multi-material jetting (Objet Connex), which Form 4 and Fuse 1+ do not offer; Mirzaeifar 2015 says only "advanced multimaterial 3D printing".',
      source='own counts (corpus_stats.py) over buehler-corpus.json and buehler.json; ' + SRC['dimas_thesis']['url'],
      evidence_quote=KEYQ['k2'][2]),
 dict(claim='What transfers is design logic: stiffness ratio and soft/stiff topology as governing variables, a computational filter followed by printed tests (printed ML-chosen design about 25x tougher than the stiff material), a formal reduction before printing (Brommer), and humidity as a gated, hysteretic stimulus tested by RH sweeps and cycles. Molecular, crystallographic and nanometre-scale rules do not transfer.',
      source=SRC['gu_thesis']['url'] + ' ; ' + SRC['brommer_abs']['url'] + ' ; ' + SRC['silk_torsion_ft']['url'],
      evidence_quote=KEYQ['k3'][2]),
 dict(claim='Buehler-style hard/soft contrast is incompatible with an equal-thickness hygromorph bilayer: with moduli 2187 and 0.53 MPa (ratio 4126) the Timoshenko coefficient at equal thickness is 0.0058, 0.4 % of the 3/2 ceiling, and the optimum thickness ratio is 64; for the Rigid 10K / Flexible 80A V2 pair (ratio about 1700-1900, project estimate) it is 41-44. This is my arithmetic on the project\'s Lean-checked formula, not a Buehler result.',
      source='own calculation, script %scalc.py; moduli from %s' % (B, SRC['gu_thesis']['url']),
      evidence_quote=KEYQ['k1'][2]),
 dict(claim='Earlier-agent check: Flexible 80A Resin V2 is the exception to "stock Formlabs resins gain under 1 % in water in 24 h": its own data sheet (ASTM D471 slab) reports +8 % mass, +3 % volume and -26 Shore A after 1 day in deionized water, while the 0.7 % figure belongs to the older Flexible 80A in a different (cube) test. Data sheets re-fetched and sha256-matched this run.',
      source=SRC['f80v2_tds']['url'],
      evidence_quote=KEYQ['k4'][2]),
]

# ---- citations: built from the Crossref / arXiv records fetched in this run
D_ = 'D:/Users/ashenoy00000/delphi-work/data/buehler-papers/'
USED = {
 '10.1126/sciadv.aau9183': 'humidity-gated silk torsion (threshold 68-70 % RH, >300 deg/mm)',
 '10.1038/ncomms6942': 'water-removal stress in tendon collagen; RH to osmotic pressure relation',
 '10.1021/acsnano.7b01532': 'silk supercontraction (up to 50 % shrinkage) and mutation control',
 '10.1002/adma.201802306': 'silk/HAP/chitin nacre-like film with water-driven actuator',
 '10.1038/srep00035': 'exponential defect tolerance with hierarchy levels in one brittle material (simulation)',
 '10.1002/adfm.201300215': 'multi-material printed bone/sponge/nacre composites, soft/stiff topology',
 '10.1039/c3sm52890a': 'stiffness ratio as governing variable in printed composites',
 '10.1021/ab500120f': 'defect tolerance rises with hierarchical levels, printed',
 '10.1002/adma.201700060': 'conch-shell hierarchy, +70 % / +85 % impact performance',
 '10.1039/c8mh00653a': 'CNN design of hierarchical composites, additive manufacturing and test',
 '10.1038/ncomms8038': 'spider-web material distribution depends on load type; PDMS direct ink writing',
 '10.1088/0957-4484/27/2/024002': 'category theory used to carry a relation from model to printed prototype',
 '10.1002/adma.202300373': 'misorientation toughening (not transferable)',
 '10.1039/d3mh01277h': 'printed-scaffold myco-composite, 160 MPa modulus',
 '10.1002/adem.202000387': 'osteon fibre layout per load type, printed',
 '10.1089/3dp.2024.0014': 'printable biotic composite degradability (only printing + humidity hit in abstracts)',
 '10.1016/j.jmps.2026.106780': 'project record: category-theoretic framework for biological mechanics to stimulus-response systems (existence checked only; content from spec-marom-buehler-deep.json)',
}
citations = []
for doi, used in USED.items():
    j = json.load(open(D_ + 'crossref_' + doi.replace('/', '_') + '.json', encoding='utf8'))['message']
    au = ', '.join(((a.get('given', '')[:1] + '. ') if a.get('given') else '') + a.get('family', '') for a in j.get('author', []))
    yr = j['issued']['date-parts'][0][0]
    venue = (j.get('container-title') or [''])[0]
    citations.append(dict(authors=au, year=yr, title=(j.get('title') or [''])[0].replace('\n', ' '), venue=venue, doi_or_arxiv=doi, verified=True,
                          how_verified='Crossref API https://api.crossref.org/works/%s returned the record on 2026-11-12 (title and year match); saved at %s' % (doi, D_ + 'crossref_' + doi.replace('/', '_') + '.json'),
                          used_for=used))
ARX = {
 '2508.06591': ('R. K. Luu, J. Deng, M. S. Ibrahim, N.-J. Cho, M. Dao, S. Suresh, M. J. Buehler', 2025, 'Generative Artificial Intelligence Extracts Structure-Function Relationships from Plants for New Materials', 'coatings freeze humidity response; LLM-guided plant-material design'),
 '2108.07877': ('A. J. Lew, C. A. Stifler, C. A. Schmidt, M. J. Buehler, P. U. P. A. Gilbert', 2021, 'Small-misorientation toughness in biominerals evolved convergently', 'preprint of the misorientation result (not transferable)'),
 '2603.29592': ('R. K. Luu, M. J. Buehler', 2026, 'Bioinspired123D: Generative 3D Modeling System for Bioinspired Structures', 'language-model generator of fabricable bioinspired geometries'),
 '2604.26367': ('L. Marom, S. Tibbits, M. Zardini, M. J. Buehler', 2026, 'A Category-Theoretic Framework from Biological Mechanics to Engineered Stimulus-Response Systems', 'project record arXiv version (existence checked only)'),
}
for a, (au, yr, ti, used) in ARX.items():
    txt = open(D_ + 'arxiv_%s.atom' % a, encoding='utf8').read()
    assert ti.lower()[:40] in txt.lower(), a
    citations.append(dict(authors=au, year=yr, title=ti, venue='arXiv', doi_or_arxiv='arXiv:' + a, verified=True,
                          how_verified='arXiv export API id_list=%s returned an entry with this title on 2026-11-12; saved at %sarxiv_%s.atom' % (a, D_, a), used_for=used))
citations += [
 dict(authors='L. S. S. Dimas', year=2013, title='Bio-inspired composites: a de novo approach to the conceptualization, design and synthesis of tough mesoscale structures with simple building blocks (MIT PhD thesis)', venue='MIT DSpace', doi_or_arxiv='hdl:1721.1/79497 (thesis; no DOI)', verified=True,
      how_verified='MIT DSpace REST API (https://dspace.mit.edu/server/api/discover/search/objects?query=handle:1721.1/79497) returned the item; PDF downloaded (16,437,095 bytes) and read', used_for='printer, material pair, effective stiffness ratio, 8x toughness modulus'),
 dict(authors='G. X. Gu', year=2018, title='Bioinspired algorithmic-driven design of additively manufactured composites (MIT PhD thesis)', venue='MIT DSpace', doi_or_arxiv='hdl:1721.1/119343 (thesis; no DOI)', verified=True,
      how_verified='MIT DSpace REST API (query=handle:1721.1/119343) returned the item; PDF downloaded (26,017,024 bytes) and read', used_for='Table 2.1 moduli, printer resolution, conch +85 %/+10 %, ML 25x/40x/4x, surrogate accuracy'),
]

summary = (
 'I clustered the 493 track-5 papers of the Buehler corpus (my keyword rules give 12 clusters; the largest are silk and filaments 118, collagen and bone 74, printed or machine-learning-designed hierarchical composites 70, and hierarchy, flaw-tolerance and size-effect work 69) and read abstracts or full texts for 15 of them, including 12 deep-dive papers: open-access full texts for the silk torsion, tendon, silica hierarchy, spider web, silk/HAP/chitin and plant-AI papers, and the two MIT PhD theses that contain the printed composite work. '
 'Result 1: the corpus is a source of design logic, not of resin or moisture numbers. None of 795 abstracts mentions vat-photopolymer, powder-bed or Formlabs printing (abstract-level; only 319 of 493 track-5 works have abstracts), 16 mention humidity-type stimuli, and no paper gives a hygroscopic expansion coefficient or diffusivity for a printed polymer. This confirms the earlier agents\' gaps and does not fill them. '
 'Result 2: the printed composites traced to a printer (Dimas and Gu theses; Mirzaeifar 2015 says only multimaterial printing) came from Objet Connex single-print two-material jetting (VeroWhitePlus/VeroMagenta against TangoBlackPlus, moduli 2187 and 0.53 MPa, ratio 4126 by my arithmetic; nominal ratio about 1500 and effective 45-60 after interface mixing per Dimas), which Form 4 and Fuse 1+ cannot do. '
 'Result 3: four ideas transfer: stiffness ratio and soft/stiff topology as governing variables; a computational filter followed by a few printed tests (printed ML design about 25x tougher than the stiff material, 100,000 candidates screened); a formal reduction before printing with a test beyond the model (Brommer 2015); and humidity as a gated, hysteretic stimulus (silk threshold 68-70 % RH, five-cycle sweeps) with a coating that freezes a face (paraffin wax). '
 'Not transferable: molecular and nanometre rules (including the exponential defect-tolerance law, simulated at 27 x 70 micrometres), crystal misorientation, protein-sequence mechanisms, and the fabrication routes (jetting, PDMS ink writing at 160 C, nanofibril casting, mycelium growth). '
 'Deepening: with Buehler-style contrast (n = 1700-4100) the project\'s Timoshenko coefficient at equal thickness is only 0.4-0.9 % of the 3/2 ceiling and the optimum thickness ratio is 41-64, so the stiffness ratio that helps fracture hurts curvature. '
 'Cross-check of earlier agents: Flexible 80A V2 gains 8 % mass in 1 day in water by its own ASTM D471 data sheet, so "under 1 %" holds for the Formlabs solvent table (which lists only the older Flexible 80A at 0.7 %) but not for that resin; the 39.2 % IPA uptake of Elastic 50A V2 against under 0.1 % for Rigid 10K is confirmed on the re-fetched page.'
)
lay_summary = (
 'Markus Buehler\'s group has written hundreds of papers on how bone, silk and shell get strong from their structure, and we searched them for rules that could guide a printed material that bends when the air turns damp. '
 'Almost none of the papers are about humidity, and none used the resin or powder printers that Formlabs sells; their printed samples came from a different machine that can spray a hard and a soft plastic in the same print. '
 'What carries over is the method: let a computer throw out bad designs, print only a few, test them, and write the rule you want to keep as a precise statement. '
 'One of our own calculations adds a warning: if the hard and soft plastics differ by a thousand times in stiffness, a two-layer strip of equal thickness curls about a hundred times less than the best possible, like a thermostat strip made of two metals that are far too unequal. '
 'So the demonstration should pick its two materials, and their thicknesses, together.'
)

result = dict(
 label='bm-buehler-materials-corpus',
 topic="What Buehler's materials papers say about design rules",
 summary=summary, lay_summary=lay_summary, findings=findings, key_claims=key_claims,
 recommendations=RECS, glossary=GLOSSARY, table=TABLE, reproduce=REPRODUCE, citations=citations, could_not_find=COULD_NOT_FIND,
 scripts_written=[B + f for f in sorted(os.listdir(B)) if f.endswith('.py')],
)
json.dump(result, open(OUT, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
chk = json.load(open(OUT, encoding='utf8'))
print('wrote', OUT, os.path.getsize(OUT), 'bytes; findings', len(chk['findings']), 'table', len(chk['table']), 'citations', len(chk['citations']))
