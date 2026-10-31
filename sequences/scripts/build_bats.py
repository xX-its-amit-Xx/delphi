"""Add bat wing regulatory regions (Europe PMC, fetched; see calls.json) to the regions table -> sequences/genome-regions.json.
Each entry paraphrases the fetched abstract; nothing is added from memory."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); SEQ = os.path.dirname(HERE)
raw = json.load(open('C:/Temp/sequences/epmc_raw.json'))
rec = {}
for k, v in raw.items():
    for r in v['results']:
        rec.setdefault(r['id'], dict(r, query_key=k))

def cite(i):
    r = rec[i]
    return {'europepmc_id': r['id'], 'pmid': r['pmid'], 'doi': r['doi'], 'year': r['pubYear'], 'authors': (r['authorString'] or '')[:120],
            'title': r['title'], 'found_by_query': raw[r['query_key']]['query']}

bats = [
    {'region': 'Prx1 (Prrx1) limb enhancer', 'kind': 'cis-regulatory enhancer (non-coding)', 'tested': 'yes, mouse knock-in',
     'finding': 'Replacing the mouse Prx1 limb enhancer with the orthologous bat sequence raised Prx1 expression in developing forelimb bones and gave significantly longer forelimbs; deleting the mouse enhancer left limb length normal, showing regulatory redundancy.',
     'cite': cite('18198333')},
    {'region': 'BAR116, telomeric to the HoxD cluster (one of 166 bat accelerated regions overlapping limb enhancer marks)', 'kind': 'bat-accelerated conserved non-coding region acting as enhancer',
     'tested': 'yes, mouse enhancer assay', 'finding': '166 bat accelerated regions overlap H3K27ac/p300 limb peaks; five Myotis lucifugus BARs drove limb expression in mice. The Myotis BAR116 sequence gave robust forelimb expression at E12.5 where the mouse sequence gave none, matching high-forelimb Hoxd10-Hoxd11 expression in Miniopterus bat embryos.',
     'cite': cite('27019019')},
    {'region': '2,796 bat-accelerated regions inside H3K27ac peaks of developing bat autopods; differential forelimb/hindlimb expression of >7,000 genes incl. Tbx5-as1 and Hottip', 'kind': 'genome-wide regulatory map (ChIP-seq, RNA-seq) in Miniopterus natalensis',
     'tested': 'mapping, not functional', 'finding': 'Thousands of regions are differentially marked between forelimb and hindlimb; several accelerated regions cluster near limb-associated genes.',
     'cite': cite('27019111')},
    {'region': 'Interdigital Fgf8 and Gremlin expression (forelimb webbing retention)', 'kind': 'expression pattern of signalling genes; regulatory change implied, no enhancer named',
     'tested': 'yes, functional bead assay in bat embryos', 'finding': 'In Carollia perspicillata only hindlimb interdigits undergo apoptosis; forelimb webbing is retained with a distinct Fgf8 pattern plus the Bmp inhibitor Gremlin, and its maintenance depends on combined high Fgf signalling and Bmp inhibition.',
     'cite': cite('17015842')},
    {'region': 'MEIS2 and TBX3 programme in distal fibroblasts forming the wing membrane (chiropatagium)', 'kind': 'repurposed transcription-factor programme (trans) identified by single-cell analysis',
     'tested': 'yes, transgenic ectopic expression in mouse distal limb', 'finding': 'A specific fibroblast population expressing MEIS2 and TBX3 gives rise to the chiropatagium; ectopic MEIS2+TBX3 in mouse distal limb activated wing-associated genes and caused digit fusion.',
     'cite': cite('40670657')},
    {'region': 'Regulatory domains around PBX1 (MEIS dimerisation partner); MEIS2-TWIST1 binding', 'kind': 'cis-regulatory divergence predicted by sequence-to-function models across >100 genomes (preprint)',
     'tested': 'model-based plus functional genomics; preprint, not peer reviewed', 'finding': 'Divergent regulatory regions, prominent in the PBX1 regulatory domain, are predicted to drive bat-specific forelimb expression.',
     'cite': cite('PPR1247007')},
    {'region': 'PDGFD+ mesenchymal progenitors; Notch activation and WNT/beta-catenin suppression in Rhinolophus sinicus forelimbs', 'kind': 'cell-population and pathway signal (single-cell), no specific genomic region',
     'tested': 'descriptive', 'finding': 'Forelimbs show prolonged chondrogenesis and delayed osteogenesis.', 'cite': cite('40681542')},
]
reg = json.load(open('C:/Temp/sequences/regions_partial.json'))
reg['birds_excluded'] = 'Birds (class Aves) are excluded from this file until the project holdout exam runs.'
reg['pterosaurs'] = 'Pterosaurs are extinct (Mesozoic) and have no DNA, so no genomic region can be named for them; their only comparison is morphological (physics/flier/PRIOR-ART-FLIER.md).'
reg['bats'] = {'what': 'regulatory regions and programmes implicated in bat wing development, from Europe PMC searches (queries and hit counts in sequences/calls.json; each entry paraphrases the fetched abstract)',
               'reading': 'Every bat entry is regulatory (enhancers, accelerated non-coding regions, expression programmes); none is a protein-coding change. That matches the flying-fish side, where accelerated non-coding elements far outnumber convergent coding substitutions.',
               'regions': bats,
               'review_for_context': cite('33576369')}
json.dump(reg, open(os.path.join(SEQ, 'genome-regions.json'), 'w'), indent=1)
print('ok', len(bats))
