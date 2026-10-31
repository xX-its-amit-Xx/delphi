"""Multiple alignments (MAFFT) of focal-gene orthologues, percent-identity matrices, variant-site mapping,
and genes.json. Inputs (C:/Temp/sequences): selected.json, flyingfish_tblastn.json, daane_exons.json (optional).
Coordinate systems: every position is 1-based in the named species' Ensembl release-116 canonical protein, except the
Daane 2021 substitutions, which are 1-based in the medaka protein used by that paper (MEDAKA1-era annotation)."""
import json, os, subprocess, re
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__)); SEQ = os.path.dirname(HERE)
T = 'C:/Temp/sequences'
MAFFT = 'C:/Temp/sequences/tools/mafft-win/mafft.bat'
FOCAL = ['kcnk5b', 'kcnh2a', 'slc43a2a', 'gja1b', 'tbx5a', 'fgf10a', 'shha', 'hhip', 'prdm1a']
SPECIES = OrderedDict([
    ('danio_rerio', ('Danio rerio', 'zebrafish', 'reference teleost (Cypriniformes); the engineered fish is a zebrafish')),
    ('oryzias_latipes', ('Oryzias latipes', 'medaka', 'Beloniformes, the flying fish order; closest annotated proxy for flying fish')),
    ('myotis_lucifugus', ('Myotis lucifugus', 'little brown bat', 'bat (powered flight)')),
    ('pteropus_vampyrus', ('Pteropus vampyrus', 'large flying fox', 'bat (powered flight)')),
    ('rhinolophus_ferrumequinum', ('Rhinolophus ferrumequinum', 'greater horseshoe bat', 'bat (powered flight)')),
    ('mus_musculus', ('Mus musculus', 'mouse', 'non-flying mammal')),
    ('homo_sapiens', ('Homo sapiens', 'human', 'non-flying mammal')),
    ('drosophila_melanogaster', ('Drosophila melanogaster', 'fruit fly', 'flying insect; insect wings are not homologous to vertebrate limbs')),
])
BATS = ['myotis_lucifugus', 'pteropus_vampyrus', 'rhinolophus_ferrumequinum']
FF = 'hirundichthys_speculiger'

# Known variants, from genotype/interventions.json lesions (zebrafish coordinates) and Daane 2021 sheet G (medaka coordinates).
VARIANTS = {
    'slc43a2a': [
        {'id': 'lat4a_F326L', 'coord_species': 'oryzias_latipes', 'pos': 326, 'ref': 'F', 'alt': 'L',
         'what': 'convergent substitution in flying fishes and both flying-halfbeak lineages (Daane 2021 Data S1 sheet G row 2; position relative to the medaka protein)',
         'source': 'genotype/cache/daane2021_data_s1_mmc2.xlsx sheet "G - conv. aa subst." row 2; genotype/interventions.json lat4a-F326L-flyingfish-substitution'},
        {'id': 'lat4a_nr21_T200K', 'coord_species': 'danio_rerio', 'pos': 200, 'ref': 'T', 'alt': 'K',
         'what': 'lat4a nr21 (dmh26) dominant gain-of-function allele; half of the winged-zebrafish double heterozygote',
         'source': 'genotype/interventions.json slc43a2a-nr21-T200K-het, kcnh2a-lof-x-lat4a-nr21-double-het'}],
    'kcnk5b': [
        {'id': 'alf_W169L', 'coord_species': 'danio_rerio', 'pos': 169, 'ref': 'W', 'alt': 'L',
         'what': 'one of the two alf missense alleles (Perathoner 2014; allele assignment not stated in fetched text); also the hyperactive transgene',
         'source': 'genotype/interventions.json kcnk5b-alf-ty86d-het, kcnk5b-W169L-mosaic-overexpression'},
        {'id': 'alf_F241Y', 'coord_species': 'danio_rerio', 'pos': 241, 'ref': 'F', 'alt': 'Y',
         'what': 'the other alf missense allele (Perathoner 2014)', 'source': 'genotype/interventions.json kcnk5b-alf-ty86d-het'},
        {'id': 'I290A', 'coord_species': 'danio_rerio', 'pos': 290, 'ref': 'I', 'alt': 'A',
         'what': 'putative calcineurin-binding site mutant', 'source': 'genotype/interventions.json kcnk5b-I290A-calcineurin-site'},
        {'id': 'S345A', 'coord_species': 'danio_rerio', 'pos': 345, 'ref': 'S', 'alt': 'A',
         'what': 'calcineurin dephospho-mimic', 'source': 'genotype/interventions.json kcnk5b-S345A-dephospho-mimic'}],
    'gja1b': [
        {'id': 'j7e1_F30V', 'coord_species': 'danio_rerio', 'pos': 30, 'ref': 'F', 'alt': 'V', 'what': 'short-fin ENU allele', 'source': 'genotype/interventions.json gja1b-j7e1'},
        {'id': 'stp_tl28d_W78L', 'coord_species': 'danio_rerio', 'pos': 78, 'ref': 'W', 'alt': 'L', 'what': 'steopsel allele', 'source': 'genotype/interventions.json gja1b-stp-tl28d'},
        {'id': 'dmh35_G138D', 'coord_species': 'danio_rerio', 'pos': 138, 'ref': 'G', 'alt': 'D', 'what': 'dominant allele', 'source': 'genotype/interventions.json gja1b-dmh35'},
        {'id': 'T154A', 'coord_species': 'danio_rerio', 'pos': 154, 'ref': 'T', 'alt': 'A', 'what': 'dominant-negative Cx43 used as a transgene (preprint)', 'source': 'genotype/interventions.json aramaki-kondo-celltype-promoters-PREPRINT'},
        {'id': 'j7e2_P191S', 'coord_species': 'danio_rerio', 'pos': 191, 'ref': 'P', 'alt': 'S', 'what': 'short-fin ENU allele', 'source': 'genotype/interventions.json gja1b-j7e2'},
        {'id': 'j7e3_F209I', 'coord_species': 'danio_rerio', 'pos': 209, 'ref': 'F', 'alt': 'I', 'what': 'short-fin ENU allele', 'source': 'genotype/interventions.json gja1b-j7e3'}],
    'kcnh2a': [
        {'id': 'lfr1_Y669N', 'coord_species': 'danio_rerio', 'pos': 669, 'ref': 'Y', 'alt': 'N', 'what': 'cis revertant of longfin', 'source': 'genotype/interventions.json kcnh2a-cis-loss-of-function-revertants'},
        {'id': 'lfr2_L739Q', 'coord_species': 'danio_rerio', 'pos': 739, 'ref': 'L', 'alt': 'Q', 'what': 'cis revertant of longfin', 'source': 'genotype/interventions.json kcnh2a-cis-loss-of-function-revertants'},
        {'id': 'WL7_Y418X', 'coord_species': 'danio_rerio', 'pos': 418, 'ref': 'Y', 'alt': '*', 'what': 'cis nonsense revertant of longfin', 'source': 'genotype/interventions.json kcnh2a-cis-loss-of-function-revertants'}],
    'hhip': [
        {'id': 'uki_hu540A_Y285X', 'coord_species': 'danio_rerio', 'pos': 285, 'ref': 'Y', 'alt': '*', 'what': 'nonsense allele, larger pectoral fins', 'source': 'genotype/flier-genome.json item 1 hhip-uki-loss-fin-dorsoventral'},
        {'id': 'uki_hu418B_Y295X', 'coord_species': 'danio_rerio', 'pos': 295, 'ref': 'Y', 'alt': '*', 'what': 'nonsense allele, larger pectoral fins', 'source': 'genotype/flier-genome.json item 1 hhip-uki-loss-fin-area'},
        {'id': 'H215Rfs', 'coord_species': 'danio_rerio', 'pos': 215, 'ref': 'H', 'alt': 'fs', 'what': 'CRISPR frameshift', 'source': 'genotype/flier-genome.json item 1 hhip-crispr-loss-endoskeletal-disc-shape'},
        {'id': 'F242Sfs', 'coord_species': 'danio_rerio', 'pos': 242, 'ref': 'F', 'alt': 'fs', 'what': 'CRISPR frameshift', 'source': 'genotype/flier-genome.json item 1 hhip-crispr-loss-endoskeletal-disc-shape'}],
    'prdm1a': [
        {'id': 'm805_W154X', 'coord_species': 'danio_rerio', 'pos': 154, 'ref': 'W', 'alt': '*', 'what': 'premature stop in the SET domain', 'source': 'genotype/interventions.json prdm1a-null-m805-*'}],
}


def mafft(seqs):
    fa = os.path.join(T, 'mafft_in.fa')
    with open(fa, 'w') as f:
        for k, s in seqs.items():
            f.write(f'>{k}\n{s}\n')
    p = subprocess.run([MAFFT, '--quiet', '--localpair', '--maxiterate', '1000', fa.replace('/', '\\')], capture_output=True, text=True, shell=True)
    txt = p.stdout[p.stdout.index('>'):]
    out, k = OrderedDict(), None
    for line in txt.splitlines():
        line = line.strip()
        if line.startswith('>'):
            k = line[1:]; out[k] = ''
        elif k and re.fullmatch(r'[A-Za-z*\-]+', line):
            out[k] += line.upper()
    for k in seqs:
        assert out[k].replace('-', '') == seqs[k].upper(), k
    return out


def colmap(aln_row):
    """residue position (1-based) -> column index (0-based)"""
    m, p = {}, 0
    for i, c in enumerate(aln_row):
        if c != '-':
            p += 1; m[p] = i
    return m


def pos_at(aln_row, col):
    if aln_row[col] == '-':
        return None
    return sum(1 for c in aln_row[:col + 1] if c != '-')


def ident(a, b):
    pairs = [(x, y) for x, y in zip(a, b) if x not in '-X' and y not in '-X']
    if not pairs:
        return None, 0
    return round(100 * sum(1 for x, y in pairs if x == y) / len(pairs), 1), len(pairs)


def project(aln, anchor, proj_seq):
    """place a sequence given in anchor-residue coordinates ('-' = not covered) into the alignment columns"""
    row = ['-'] * len(aln[anchor])
    for p, c in colmap(aln[anchor]).items():
        if p - 1 < len(proj_seq) and proj_seq[p - 1] != '-':
            row[c] = proj_seq[p - 1]
    return ''.join(row)


def main():
    sel = json.load(open(f'{T}/selected.json'))
    ffb = json.load(open(f'{T}/flyingfish_tblastn.json')) if os.path.exists(f'{T}/flyingfish_tblastn.json') else {'genes': {}}
    dx = json.load(open(f'{T}/daane_exons.json')) if os.path.exists(f'{T}/daane_exons.json') else {}
    gl = json.load(open(f'{T}/gliders_raw.json')) if os.path.exists(f'{T}/gliders_raw.json') else {}
    rbh = json.load(open(f'{T}/flyingfish_rbh.json'))
    os.makedirs(os.path.join(SEQ, 'alignments'), exist_ok=True)
    mafft_ver = subprocess.run([MAFFT, '--version'], capture_output=True, text=True, shell=True)
    mafft_ver = (re.search(r'v\d+\.\d+ \([^)]*\)', mafft_ver.stdout + mafft_ver.stderr) or [None])[0]
    genes_out = OrderedDict()
    summary = {}
    for g in FOCAL:
        s = sel[g]
        seqs = OrderedDict((sp, s[sp]['seq']) for sp in SPECIES if sp in s)
        rb = rbh['genes'].get(g) or {}
        if rb.get('reciprocal_best_hit'):
            seqs[FF] = rb['seq'].upper().replace('*', '').replace('.', '')
        for org, rec in gl.get('species', {}).items():
            v = rec['genes'].get(g)
            if v:
                seqs['ncbi:' + org.replace(' ', '_')] = v['seq'].upper().replace('*', '')
        aln = mafft(seqs)
        # flying fish: projected tblastn hits on medaka coordinates
        extra = OrderedDict()
        fg = ffb['genes'].get(g)
        ff_ok = bool(fg and fg['covered_positions'] and fg['identity_to_medaka_over_covered'] >= 60 and fg['covered_positions'] >= 0.3 * fg['query_len'])
        if fg and ff_ok and FF not in seqs:
            extra[FF] = project(aln, fg.get('anchor', 'oryzias_latipes'), fg['projected_on_medaka_coords'])
        dropped = {}
        cand = {}
        for sp_name, d in (dx.get(g) or {}).items():
            if 'oryzias_latipes' not in aln: continue
            if d['covered'] < 0.3 * len(seqs['oryzias_latipes']):
                dropped[sp_name] = 'captured exons cover <30% of the medaka protein'; continue
            cand[sp_name] = project(aln, 'oryzias_latipes', d['projected_on_medaka_coords'])
        if cand:
            ids_ = {k: ident(v, aln['oryzias_latipes'])[0] for k, v in cand.items()}
            med_ = sorted(ids_.values())[len(ids_) // 2]
            for k, v in cand.items():
                if abs(ids_[k] - med_) > 8:
                    dropped[k] = f'identity to medaka {ids_[k]}% vs beloniform median {med_}%: likely a paralogue exon (teleost a/b copies) or misassembly'
                else:
                    extra['daane2021:' + k] = v
        rows = OrderedDict(list(aln.items()) + list(extra.items()))
        names = list(rows)
        mat = {a: {b: ident(rows[a], rows[b])[0] for b in names} for a in names}
        over = {a: {b: ident(rows[a], rows[b])[1] for b in names} for a in names}
        # variants
        vout = []
        for v in VARIANTS.get(g, []):
            anchor = v['coord_species']
            rec = dict(v)
            if anchor not in aln:
                rec['status'] = 'anchor species missing'; vout.append(rec); continue
            cm = colmap(aln[anchor])
            col = cm.get(v['pos'])
            ref_seen = seqs[anchor][v['pos'] - 1] if v['pos'] <= len(seqs[anchor]) else None
            rec['reference_residue_in_ensembl116_protein'] = ref_seen
            rec['reference_matches'] = ref_seen == v['ref']
            if col is None:
                rec['status'] = 'position beyond protein'; vout.append(rec); continue
            rec['alignment_column_1based'] = col + 1
            rec['window_anchor'] = aln[anchor][max(0, col - 7):col + 8]
            rec['residues'] = OrderedDict()
            for n in names:
                c = rows[n][col]
                rec['residues'][n] = {'residue': c if c != '-' else None,
                                      'position_in_own_protein': pos_at(rows[n], col) if n in aln else None,
                                      'window': rows[n][max(0, col - 7):col + 8]}
            vout.append(rec)
        rec_aln = OrderedDict()
        rec_aln['gene'] = g
        rec_aln['coordinate_system'] = ('Positions are 1-based residue numbers in each species\' Ensembl release 116 canonical protein '
                                        '(protein_id given). Alignment columns are 1-based. Variant anchors: zebrafish positions refer to the '
                                        'zebrafish protein; lat4a F326L refers to the medaka protein as numbered by Daane 2021. Projected '
                                        'flying-fish rows are placed on medaka residues; residues inserted relative to medaka are dropped and '
                                        'uncovered positions are gaps, so those rows have no own-protein numbering.')
        rec_aln['aligner'] = f'MAFFT {mafft_ver} --localpair --maxiterate 1000 (L-INS-i)'
        rec_aln['sequences'] = OrderedDict()
        for sp in aln:
            if sp == FF:
                rec_aln['sequences'][sp] = {'species': 'Hirundichthys speculiger', 'common': 'mirrorwing flyingfish',
                    'role': 'flying fish (Exocoetidae): annotated protein from Xu et al. 2021 (Front Genet 12:695700), orthology by reciprocal best blastp hit to zebrafish',
                    'protein_id': rb['flyingfish_protein'], 'length': len(seqs[sp]), 'assembly': 'GCA_018398805.1 (same assembly as the figshare annotation)',
                    'source': 'figshare 10.6084/m9.figshare.14600634.v1 Hirundichthys_speculiger.pep.fa',
                    'caveat': 'H. speculiger is not one of the species Daane 2021 measured for fin length (Cheilopogon, Exocoetus, Hirundichthys rondeleti): cross-species within the family. Annotation is automated (BLAST/InterPro hits), not curated.'}
                continue
            if sp.startswith('ncbi:'):
                org = sp[5:].replace('_', ' '); rec = gl['species'][org]; v = rec['genes'][g]
                rec_aln['sequences'][sp] = {'species': org, 'role': rec['role'] + ': ' + rec['desc'], 'protein_id': v['accession'],
                                            'title': v['title'], 'length': v['length'], 'assembly': rec['assembly'],
                                            'source': 'NCBI E-utilities efetch (longest RefSeq isoform; GenBank for Gekko kuhli)'}
                continue
            meta = SPECIES[sp]
            rec_aln['sequences'][sp] = {'species': meta[0], 'common': meta[1], 'role': meta[2], 'gene_id': s[sp]['gene_id'],
                                        'protein_id': s[sp]['protein_id'], 'length': len(seqs[sp]),
                                        'homology_type': s[sp].get('type'), 'source': 'Ensembl REST release 116 /homology'}
        for n in extra:
            if n == FF:
                rec_aln['sequences'][n] = {'species': 'Hirundichthys speculiger', 'common': 'mirrorwing flyingfish',
                    'role': 'flying fish; NOT an annotated protein: tblastn hits of the ' + ('medaka' if fg.get('anchor', 'oryzias_latipes') == 'oryzias_latipes' else 'zebrafish (no medaka orthologue in Ensembl)') + ' protein in the unannotated scaffold assembly, projected onto the residues of that protein',
                    'assembly': 'GCA_018398805.1', 'scaffold': fg['best_scaffold'], 'covered_medaka_positions': fg['covered_positions'],
                    'source': 'NCBI FTP genomic.fna + local tblastn (' + ffb.get('tool', '') + ')'}
            else:
                spn = n.split(':', 1)[1]
                rec_aln['sequences'][n] = {'species': spn.replace('_', ' '), 'role': dx[g][spn]['role'],
                    'covered_medaka_positions': sum(1 for c in dx[g][spn]['projected_on_medaka_coords'] if c != '-'),
                    'source': 'Daane 2021 Zenodo translated_exons (targeted capture), exons projected onto medaka residues'}
        rec_aln['alignment'] = rows
        rec_aln['percent_identity'] = {'definition': 'identical / aligned residue pairs (columns where both rows have a residue; gaps and X excluded)',
                                       'matrix': mat, 'aligned_pairs': over}
        rec_aln['variants'] = vout
        rec_aln['daane2021_rows_dropped'] = dropped
        if g == 'slc43a2a':
            rec_aln['key_test_lat4a_site'] = lat4a_test(vout, names)
        with open(os.path.join(SEQ, 'alignments', f'{g}.json'), 'w') as f:
            json.dump(rec_aln, f, indent=1)
        # genes.json entry
        genes_out[g] = OrderedDict([
            ('zebrafish_gene', s.get('_zebrafish_gene')), ('zfin_id', s.get('_zfin_id')), ('location_GRCz11', s.get('_location')),
            ('description', s.get('_description')),
            ('orthologues', OrderedDict((sp, {'species': SPECIES[sp][0], 'gene_id': s[sp]['gene_id'], 'protein_id': s[sp]['protein_id'],
                                             'length': len(s[sp]['seq']), 'homology_type': s[sp].get('type'),
                                             'n_candidates': s[sp].get('n_candidates'),
                                             'ensembl_perc_id_vs_zebrafish': s[sp].get('ensembl_perc_id_target'),
                                             'msa_identity_vs_zebrafish': mat['danio_rerio'][sp], 'sequence': s[sp]['seq']})
                                        for sp in SPECIES if sp in s)),
            ('missing_species', [SPECIES[sp][0] for sp in SPECIES if sp not in s]),
            ('glider_panel_ncbi', OrderedDict((org, ({'role': rec['role'], 'accession': rec['genes'][g]['accession'], 'length': rec['genes'][g]['length'],
                                                     'msa_identity_vs_zebrafish': mat['danio_rerio'].get('ncbi:' + org.replace(' ', '_'))}
                                                    if rec['genes'].get(g) else None))
                                              for org, rec in gl.get('species', {}).items())),
            ('flying_fish', {'Hirundichthys_speculiger_annotated_Xu2021': {k: rb.get(k) for k in ('flyingfish_protein', 'flyingfish_length', 'forward_pident', 'reciprocal_best_hit', 'reverse_best_zebrafish_symbol', 'forward_hits_tried')},
                             'used_in_alignment': 'annotated protein (RBH)' if FF in seqs else ('tblastn projection on the unannotated assembly' if FF in extra else 'none'),
                             'Hirundichthys_speculiger_tblastn': ({'anchor_protein': fg.get('anchor'), 'used_in_alignment': ff_ok,
                                                                   'excluded_reason': None if ff_ok else 'best scaffold below 60% identity or 30% coverage: likely a paralogue or missing from the assembly',
                                                                   'covered_anchor_positions': fg['covered_positions'], 'anchor_length': fg['query_len'],
                                                                   'identity_to_anchor_over_covered': fg['identity_to_medaka_over_covered'],
                                                                   'scaffold': fg['best_scaffold']} if fg else None),
                             'daane2021_species': sorted((dx.get(g) or {}).keys())}),
        ])
        summary[g] = {sp: mat['danio_rerio'].get(sp) for sp in names}
        print(g, {k: v for k, v in summary[g].items()}, flush=True)
    json.dump({'genes': genes_out, 'mafft': mafft_ver}, open(f'{T}/genes_partial.json', 'w'), indent=1)


def lat4a_test(vout, names):
    v = [x for x in vout if x['id'] == 'lat4a_F326L'][0]
    if 'residues' not in v:
        return {'status': v.get('status')}
    r = v['residues']
    bats = {b: r[b]['residue'] for b in BATS if b in r}
    return {'question': 'At the lat4a/slc43a2a site where flying fishes and flying halfbeaks converge on L (medaka F326), what residue do bats carry?',
            'medaka_residue_at_326': r.get('oryzias_latipes', {}).get('residue'),
            'bat_residues': bats, 'bat_positions': {b: r[b]['position_in_own_protein'] for b in BATS if b in r},
            'mouse': r.get('mus_musculus', {}).get('residue'), 'human': r.get('homo_sapiens', {}).get('residue'),
            'zebrafish': r.get('danio_rerio', {}).get('residue'),
            'flying_fish_rows': {n: r[n]['residue'] for n in names if n == FF or n.startswith('daane2021:')},
            'bats_carry_L': any(x == 'L' for x in bats.values())}


if __name__ == '__main__':
    main()
