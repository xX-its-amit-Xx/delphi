"""Deliverable 4: structures/pathways.json

Question: is a pathway our genes sit in INTACT in gliders and INCOMPLETE elsewhere, or the
same everywhere?

Input  genotype/pathways.json (GO:BP from the ZFIN GAF, Reactome, KEGG dre; every Reactome
       zebrafish row in it is orthology-inferred, which is carried through to the output)
Method for each selected pathway, for each zebrafish member gene: resolve the gene in Ensembl
       by symbol, then ask Ensembl Compara (REST /homology/id/...) for orthologues, and mark
       each panel species present / absent. Absence of an orthologue in a genome database is
       NOT absence of the gene: it is frequently an annotation gap, or no genome at all.
"""
import json, os, time, collections
import net

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.dirname(ROOT)
ENS = 'https://rest.ensembl.org'

# the pathways our eight genes sit in, chosen to stay inside a few hundred API calls:
# every pathway that directly contains one of them and has <= 40 member genes.
# Every pathway that directly contains one of our eight genes AND has at most 36 member genes.
# The cap is a budget decision: each gene needs an Ensembl Compara tree, and Ensembl REST was
# returning 503s under load during this run, so the union is held near a hundred genes.
PATHWAYS = ['dre04340', 'dre04540', 'GO:0045879', 'GO:0071805', 'GO:0042391',
            'GO:0033334', 'GO:0033333', 'GO:0035138', 'GO:0010644',
            'R-DRE-5632681', 'R-DRE-5358346']
PATHWAYS_DROPPED = {'GO:0033339': 'pectoral fin development, 40 member genes: over the per-pathway cap '
                                  'of 36 set for this run; GO:0035138 pectoral fin morphogenesis (9 genes) '
                                  'and GO:0033334 fin morphogenesis (15) cover the same question'}

OUR_GENES = ['kcnk5b', 'kcnh2a', 'cx43', 'slc43a2a', 'hhip', 'shha', 'tbx5a', 'prdm1a']


def ensembl_species_map(panel):
    """Which panel species does Ensembl have a genome for? Asked, not assumed."""
    info = net.jget(f'{ENS}/info/species?content-type=application/json',
                    'Ensembl list of species with genomes')
    # Prefer the exact species genome over a strain genome: a taxon-id lookup alone returns
    # oryzias_latipes_hni and mus_musculus_cbaj, which are strains, not the reference genomes.
    by_name, by_taxon = {}, {}
    for s in (info or {}).get('species', []):
        by_name[(s.get('name') or '').lower()] = s.get('name')
        by_taxon.setdefault(str(s.get('taxon_id')), []).append(s.get('name'))
    out = {}
    for label, meta in panel.items():
        tid = str(meta.get('taxon_id'))
        canon = (meta.get('scientific_name') or '').lower().replace(' ', '_')
        name = by_name.get(canon)
        if not name:
            cands = sorted(by_taxon.get(tid, []), key=len)
            name = cands[0] if cands else None
        out[label] = dict(taxon_id=meta.get('taxon_id'), category=meta['category'],
                          ensembl_species=name, in_ensembl=bool(name),
                          matched_by=('exact species name' if by_name.get(canon)
                                      else 'shortest genome name for this taxon id' if name else None),
                          other_genomes_for_this_taxon=sorted(by_taxon.get(tid, [])))
    return out


def gene_id(symbol):
    d = net.jget(f'{ENS}/xrefs/symbol/danio_rerio/{symbol}?object_type=gene&content-type=application/json',
                 f'Ensembl gene id for zebrafish {symbol}')
    for r in (d or []):
        if r.get('id', '').startswith('ENSDARG'):
            return r['id']
    return None


def orthologues(gid):
    d = net.jget(f'{ENS}/homology/id/danio_rerio/{gid}?type=orthologues&format=condensed'
                 f'&content-type=application/json',
                 f'Ensembl Compara orthologues of {gid}')
    if not d or not d.get('data'):
        return None
    by_sp = collections.defaultdict(list)
    for h in d['data'][0].get('homologies', []):
        by_sp[h.get('species')].append(dict(id=h.get('id'), type=h.get('type'),
                                            protein_id=h.get('protein_id')))
    return dict(by_sp)


def main():
    pw = json.load(open(os.path.join(REPO, 'genotype', 'pathways.json'), encoding='utf-8'))
    models = json.load(open(os.path.join(ROOT, 'models.json'), encoding='utf-8'))
    panel = models['species']
    G, P = pw['genes'], pw['pathways']
    sym = {k: v['symbol'] for k, v in G.items()}

    sp = ensembl_species_map(panel)
    print('Ensembl coverage of the panel:')
    for k, v in sp.items():
        print(f'  {k:50s} {v["ensembl_species"] or "NOT IN ENSEMBL"}')

    out = dict(
        title='Pathway component presence/absence across the DELPHI flight/gliding species panel, by orthology',
        built=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        tool='structures/scripts/build_pathways.py',
        question='Is a pathway our genes sit in intact in gliders and incomplete elsewhere, or the same everywhere?',
        bird_exclusion='Class Aves is this project\'s frozen holdout: no bird genome was queried and no bird '
                       'species is in the panel, until the holdout exam runs.',
        pathways_dropped=PATHWAYS_DROPPED,
        inputs=dict(pathway_membership='genotype/pathways.json (built by genotype/build_pathways.py)',
                    sources=pw['sources'],
                    carried_caveat=('Every Reactome zebrafish row in genotype/pathways.json is '
                                    'inferred_by_orthology = 1, as that file records. So for Reactome '
                                    'pathways this analysis compares orthology against orthology, and the '
                                    'zebrafish membership itself is not experimental.')),
        method=dict(
            orthology='Ensembl REST: /xrefs/symbol/danio_rerio/{symbol} for the gene id, then '
                      '/homology/id/danio_rerio/{id}?type=orthologues&format=condensed for every '
                      'orthologue Ensembl Compara holds. A species counts as PRESENT when Compara '
                      'returns at least one orthologue in it.',
            query_species=('Every member gene is a ZEBRAFISH gene from genotype/pathways.json, so zebrafish '
                           'is the query species and is marked present by construction. Ensembl Compara does '
                           'not list a gene as its own orthologue; a first version of this table therefore '
                           'read 0/N for zebrafish in every pathway, which was an artefact, not a finding.'),
            do_not_over_read=('An orthologue missing from Compara is NOT evidence the gene is missing from '
                              'the animal. Three different things produce the same blank: (1) the species '
                              'has no genome in Ensembl at all, (2) it has a genome but the gene is not '
                              'annotated or not placed in a Compara tree, (3) the gene is really absent. '
                              'Only (3) is biology, and this method cannot tell them apart. Rows are '
                              'therefore split into no_genome and genome_but_no_orthologue.')),
        ensembl_species=sp,
        ensembl_release=net.jget(f'{ENS}/info/data?content-type=application/json', 'Ensembl REST release'),
        pathways={}, genes={}, summary={})

    want = {k: v for k, v in sp.items() if v['in_ensembl']}
    print(f'{len(want)} of {len(sp)} panel species have an Ensembl genome')

    # union of member genes over the selected pathways
    members = {}
    for pid in PATHWAYS:
        p = P.get(pid)
        if not p:
            print(f'  pathway {pid} not in genotype/pathways.json -- skipped')
            continue
        members[pid] = p['genes']
    union = sorted({g for gs in members.values() for g in gs})
    print(f'{len(members)} pathways, {len(union)} distinct zebrafish member genes')

    def one_gene(gk):
        s = sym.get(gk)
        if not s:
            return gk, dict(symbol=None, status='no symbol in genotype/pathways.json')
        gid = gene_id(s)
        if not gid:
            return gk, dict(symbol=s, status='not found in Ensembl by symbol',
                            is_one_of_ours=s in OUR_GENES)
        orth = orthologues(gid)
        row = dict(symbol=s, ensembl_gene=gid, is_one_of_ours=s in OUR_GENES, present_in={})
        if orth is None:
            row['status'] = 'Ensembl returned no homology record (gene not in a Compara tree)'
            row['present_in'] = {k: False for k in want}
        else:
            row['status'] = 'ok'
            row['n_species_with_orthologue'] = len(orth)
            for label, meta in want.items():
                # Compara does not return a gene as its own orthologue, so the QUERY species
                # (zebrafish) would read as absent everywhere. It is present by construction.
                if meta['ensembl_species'] == 'danio_rerio':
                    row['present_in'][label] = True
                    row.setdefault('orthologue_types', {})[label] = ['query species (present by construction)']
                    continue
                hits = orth.get(meta['ensembl_species'], [])
                row['present_in'][label] = bool(hits)
                if hits:
                    row.setdefault('orthologue_ids', {})[label] = [h['id'] for h in hits[:4]]
                    row.setdefault('orthologue_types', {})[label] = sorted({h['type'] for h in hits})
        return gk, row

    from concurrent.futures import ThreadPoolExecutor
    gene_rows = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        for n, (gk, row) in enumerate(ex.map(one_gene, union), start=1):
            gene_rows[gk] = row
            if n % 20 == 0:
                print(f'  {n}/{len(union)} genes', flush=True)

    out['genes'] = gene_rows

    # per-pathway counts per species
    for pid, gs in members.items():
        p = P[pid]
        rec = dict(name=p['name'], source=p['source'], n_member_genes=p['n_genes'],
                   contains_our_genes=sorted({sym[g] for g in gs if sym.get(g) in OUR_GENES}),
                   per_species={}, zebrafish_evidence_note=None)
        if p['source'] == 'Reactome':
            rec['zebrafish_evidence_note'] = ('Reactome zebrafish membership is inferred by orthology in '
                                              'genotype/pathways.json, not experimental.')
        testable = [g for g in gs if gene_rows.get(g, {}).get('status') == 'ok']
        rec['member_genes_with_an_ensembl_compara_tree'] = len(testable)
        for label, meta in want.items():
            present = sum(1 for g in testable if gene_rows[g]['present_in'].get(label))
            rec['per_species'][label] = dict(
                category=meta['category'], present=present, testable=len(testable),
                fraction=round(present / len(testable), 3) if testable else None,
                absent_genes=sorted(gene_rows[g]['symbol'] for g in testable
                                    if not gene_rows[g]['present_in'].get(label))[:40])
        out['pathways'][pid] = rec

    # headline: does any pathway separate gliders from non-gliders?
    glide = {'glider_fish', 'glider_mammal'}
    head = []
    for pid, rec in out['pathways'].items():
        g = [v['fraction'] for k, v in rec['per_species'].items()
             if v['category'] in glide and v['fraction'] is not None]
        ng = [v['fraction'] for k, v in rec['per_species'].items()
              if v['category'] not in glide and v['fraction'] is not None]
        head.append(dict(pathway=pid, name=rec['name'],
                         glider_species_in_ensembl=len(g),
                         glider_mean_completeness=round(sum(g) / len(g), 3) if g else None,
                         nonglider_mean_completeness=round(sum(ng) / len(ng), 3) if ng else None,
                         separates_gliders=None if not g else 'no glider species has an Ensembl genome'
                         if not g else None))
    out['summary'] = dict(
        pathways_compared=len(out['pathways']),
        distinct_member_genes=len(union),
        genes_with_compara_tree=sum(1 for v in gene_rows.values() if v.get('status') == 'ok'),
        panel_species=len(sp), panel_species_in_ensembl=len(want),
        glider_species_in_ensembl=sorted(k for k, v in want.items()
                                         if sp[k]['category'] in glide),
        per_pathway=head)

    with open(os.path.join(ROOT, 'pathways.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print(json.dumps({k: v for k, v in out['summary'].items() if k != 'per_pathway'}, indent=1))


if __name__ == '__main__':
    main()
