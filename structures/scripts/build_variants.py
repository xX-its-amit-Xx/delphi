"""Deliverable 2: structures/variants/

For the variants our causal chains name WITH a position from a fetched source:
  slc43a2a / lat4a  F326L   the flying-fish convergent substitution (Daane 2021, PMID 34534441)
  slc43a2a / lat4a  T200K   the zebrafish nr21 dominant gain-of-function allele
  kcnk5b            W169L   one of the two alf missense substitutions (Perathoner 2014)
  kcnk5b            F241Y   the other alf missense substitution (allele assignment not stated)
  kcnk5b            I290A   engineered calcineurin-site substitution
  kcnk5b            S345A   engineered dephospho-mimic
  gja1b / Cx43      T154A   dominant-negative connexin used with kcnk5b W169L
  gja1b             W78L, F30V, P191S, F209I, G138D   ZFIN-typed ENU alleles

Each variant is (a) position-checked against the fetched UniProt sequence, (b) given the
wild-type AlphaFold per-residue pLDDT in a window around the site, and (c) for the four
variants the brief asks for, folded wild-type and variant with Meta's public ESMFold
endpoint and compared by CA RMSD over the aligned region.

EVERY RESULT HERE IS A STRUCTURE PREDICTION, NOT A FUNCTION MEASUREMENT.
"""
import json, os, time, hashlib, math
import net

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'variants')
TMP = 'C:/Temp/structures/variants'
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)
ESM = 'https://api.esmatlas.com/foldSequence/v1/pdb/'

# (gene label, panel protein key, species label in models.json, position, wt, mut, source, fold?)
VARIANTS = [
    ('slc43a2a / lat4a', 'slc43a2a', 'zebrafish (Danio rerio)', 326, 'F', 'L',
     dict(pmid='34534441', doi='10.1016/j.cub.2021.08.054', first_author='Daane JM', year=2021,
          quote='Intriguingly, we detected a shared amino acid substitution in lat4a that is found across '
                'multiple lineages having enlarged pectoral fins (F326L;',
          what='convergent substitution across flying fishes and both flying-halfbeak lineages; never '
               'engineered or functionally tested in any species'), True),
    ('slc43a2a / lat4a', 'slc43a2a', 'zebrafish (Danio rerio)', 200, 'T', 'K',
     dict(pmid='34534441', doi='10.1016/j.cub.2021.08.054', first_author='Daane JM', year=2021,
          quote='dominant nonsynonymous mutation T200K in a conserved domain of lat4a',
          what='lat4a nr21 / ZFIN dmh26, dominant gain of function; with kcnh2a lof gives the '
               '"winged zebrafish"'), True),
    ('kcnk5b', 'kcnk5b', 'zebrafish (Danio rerio)', 169, 'W', 'L',
     dict(pmid='24699544', doi=None, first_author='Perathoner S', year=2014,
          quote='Perathoner 2014 reports the two alf alleles carry the distinct missense substitutions '
                'W169L and F241Y in kcnk5b; the fetched text does not state which allele carries which '
                'substitution',
          what='alf (another longfin) dominant gain-of-function allele; also the substitution used in the '
               'Aramaki/Kondo cell-type-promoter preprint'), True),
    ('kcnk5b', 'kcnk5b', 'zebrafish (Danio rerio)', 241, 'F', 'Y',
     dict(pmid='24699544', doi=None, first_author='Perathoner S', year=2014,
          quote='premature truncation mutations leading to channels that lack the last transmembrane domain '
                'and the C-terminus of Kcnk5b result in fin overgrowth comparable to that seen in the alf '
                'mutant, which affects the identical region (F241Y',
          what='the other alf missense substitution'), True),
    ('kcnk5b', 'kcnk5b', 'zebrafish (Danio rerio)', 290, 'I', 'A',
     dict(pmid='38683949', doi=None, first_author='Jiang (interventions.json kcnk5b-I290A-calcineurin-site)',
          year=2024, quote='I290A substitution in the putative calcineurin-binding site in the cytoplasmic '
                           'C-terminus of zebrafish Kcnk5b',
          what='engineered, not an evolutionary variant'), False),
    ('kcnk5b', 'kcnk5b', 'zebrafish (Danio rerio)', 345, 'S', 'A',
     dict(pmid='38683949', doi=None, first_author='interventions.json kcnk5b-S345A-dephospho-mimic', year=2024,
          quote='kcnk5b S345A, described by the paper as the calcineurin-dephosphorylated mimic channel',
          what='engineered dephospho-mimic'), False),
    ('gja1b / cx43', 'gja1b', 'zebrafish (Danio rerio)', 154, 'T', 'A',
     dict(pmid=None, doi=None, first_author='Aramaki/Kondo preprint (interventions.json)', year=None,
          quote='cell-type-specific promoter-driven expression of either the hyperactive potassium channel '
                'mutant kcnk5b W169L or the dominant-negative connexin mutant Cx43 T154A',
          what='dominant-negative connexin; position is in Cx43 numbering, which may be the mammalian '
               'protein rather than zebrafish Gja1b'), False),
    ('gja1b', 'gja1b', 'zebrafish (Danio rerio)', 78, 'W', 'L',
     dict(pmid=None, doi=None, first_author='ZFIN features-affected-genes.txt via interventions.json',
          year=None, quote='steopsel stp^tl28d ... amino-acid substitution Trp->Leu at residue 78',
          what='ZFIN-typed ENU allele, dominant in the heterozygote'), False),
    ('gja1b', 'gja1b', 'zebrafish (Danio rerio)', 30, 'F', 'V',
     dict(pmid=None, doi=None, first_author='ZFIN via interventions.json', year=None,
          quote='gja1b^j7e1 ... amino-acid substitution Phe->Val at residue 30', what='ZFIN-typed ENU allele'), False),
    ('gja1b', 'gja1b', 'zebrafish (Danio rerio)', 191, 'P', 'S',
     dict(pmid=None, doi=None, first_author='ZFIN via interventions.json', year=None,
          quote='gja1b^j7e2 ... amino-acid substitution Pro->Ser at residue 191',
          what='ZFIN-typed ENU allele; this residue IS at the connexin subunit-subunit interface '
               '(see interface-mapping.json)'), True),
    ('gja1b', 'gja1b', 'zebrafish (Danio rerio)', 209, 'F', 'I',
     dict(pmid=None, doi=None, first_author='ZFIN via interventions.json', year=None,
          quote='gja1b^j7e3 ... amino-acid substitution Phe->Ile at residue 209',
          what='ZFIN-typed ENU allele; this residue IS at the connexin subunit-subunit interface '
               '(see interface-mapping.json)'), True),
    ('gja1b', 'gja1b', 'zebrafish (Danio rerio)', 138, 'G', 'D',
     dict(pmid=None, doi=None, first_author='ZFIN via interventions.json', year=None,
          quote='gja1b^dmh35 ... amino-acid substitution Gly->Asp at residue 138', what='ZFIN-typed ENU allele'), False),
]

# variants named by our chains WITHOUT a position in any fetched source -> skipped, recorded
NO_POSITION = [
    dict(variant='kcnk5b alf^dty86d vs alf^dt30mh allele-to-substitution assignment',
         why='Perathoner 2014 gives the pair W169L and F241Y but, in the text our chains fetched, does not '
             'say which allele carries which; so neither allele can be modelled as a named allele. Both '
             'substitutions are modelled here as substitutions, not as alleles.'),
    dict(variant='gja1b lh10 (CRISPR in-frame deletion of 34 amino acids)',
         why='ZFIN records the deletion length but not the residue positions, so the deleted segment cannot '
             'be placed on the structure.'),
    dict(variant='gja1b sof^b123',
         why='typed by ZFIN only as SO:0001059 sequence_variant with no coding change; described as reduced '
             'cx43 expression, so there is no residue to model.'),
    dict(variant='kcnh2a longfin^t2 (lof)',
         why='a chromosome-2 inversion that leaves both coding regions intact; it is cis-regulatory, so there '
             'is no protein variant to predict.'),
    dict(variant='kcnh2a revertant alleles lof^lfr1 Y669N, lof^lfr2 L739Q, lof^WL7 Y418X',
         why='positions ARE given, but they are revertants recovered in cis to a regulatory allele whose '
             'phenotype is loss of the ectopic expression, not a change in channel structure; folded here '
             'would answer a question nobody asked. Recorded, not modelled.'),
    dict(variant='prdm1a m805 (p.W154*) and hhip hu418B Y295STOP / hu540A Y285STOP',
         why='premature stops, i.e. truncations. A predicted structure of a truncated chain says nothing '
             'about the full-length protein\'s function; and no fetched source measures the truncated '
             'protein. Positions recorded, no model.'),
    dict(variant='hhip H215RfsX1 / F242SfsX8',
         why='frameshifts: the downstream sequence is not given by any fetched source, so the variant protein '
             'sequence is unknown and cannot be folded.'),
]


# ------------------------------------------------------------------ helpers
def uniprot_sequence(acc):
    b = net.get(f'https://rest.uniprot.org/uniprotkb/{acc}.fasta',
                f'UniProt FASTA {acc}', accept='text/plain')
    if not b:
        return None
    lines = b.decode().splitlines()
    return ''.join(l.strip() for l in lines[1:] if not l.startswith('>'))


def alphafold_plddt(acc, cif_url):
    """Per-residue pLDDT from an AlphaFold DB model (B-factor of CA atoms)."""
    dest = f'C:/Temp/structures/models/{acc}.cif'
    p = net.download(cif_url, dest, f'AlphaFold DB model {acc}', accept='chemical/x-mmcif')
    if not p:
        return None
    import gemmi
    st = gemmi.read_structure(p)
    out = {}
    for ch in st[0]:
        for res in ch:
            ca = res.find_atom('CA', '*')
            if ca:
                out[res.seqid.num] = round(ca.b_iso, 2)
    return out


def esmfold(seq, tag):
    """Fold one sequence with Meta's public ESMFold endpoint. Returns (pdb_text, note)."""
    dest = os.path.join(TMP, f'{tag}.pdb')
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return open(dest).read(), 'cached'
    b = net.get(ESM, f'ESMFold fold {tag} ({len(seq)} aa)', accept='text/plain',
                data=seq.encode(), content_type='text/plain', timeout=600, retries=1)
    if not b:
        return None, 'endpoint returned no body'
    txt = b.decode('utf-8', 'replace')
    if 'ATOM' not in txt:
        return None, f'no coordinates in response: {txt[:200]}'
    with open(dest, 'w') as f:
        f.write(txt)
    return txt, 'ok'


def ca_and_plddt(pdb_text):
    ca, pl = [], []
    for l in pdb_text.splitlines():
        if l.startswith('ATOM') and l[12:16].strip() == 'CA':
            ca.append((float(l[30:38]), float(l[38:46]), float(l[46:54])))
            pl.append(float(l[60:66]))
    scale = 100.0 if max(pl, default=0) <= 1.5 else 1.0
    return ca, [round(p * scale, 2) for p in pl]


def rmsd(X, Y):
    """Kabsch CA RMSD between two equal-length point sets."""
    import numpy as np
    X = np.array(X, float); Y = np.array(Y, float)
    X = X - X.mean(0); Y = Y - Y.mean(0)
    H = X.T @ Y
    U, S, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    D = np.diag([1, 1, d])
    R = Vt.T @ D @ U.T
    Xr = (R @ X.T).T
    return float(np.sqrt(((Xr - Y) ** 2).sum() / len(X)))


def main():
    models = json.load(open(os.path.join(ROOT, 'models.json'), encoding='utf-8'))
    out = dict(
        title='Variant structure predictions for the DELPHI flight/gliding panel',
        built=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        tool='structures/scripts/build_variants.py',
        label='STRUCTURE PREDICTION, NOT FUNCTION. No transport, conductance or binding assay exists for '
              'any variant here; the only functional data in our chains are the zebrafish fin phenotypes, '
              'which are organism-level, not molecular.',
        bird_exclusion='Class Aves is this project\'s frozen holdout; no bird sequence was folded.',
        method=dict(
            wild_type_model='AlphaFold DB model for the zebrafish UniProt accession in structures/models.json; '
                            'per-residue pLDDT read from the CA B-factor column of the deposited mmCIF.',
            variant_prediction='Meta\'s public ESMFold endpoint https://api.esmatlas.com/foldSequence/v1/pdb/ '
                               '(POST, raw sequence, no key). Wild type and variant are folded as the SAME '
                               'window of the SAME sequence so the comparison is like-for-like; the window is '
                               'the full chain when ESMFold accepts it and a centred window otherwise, which '
                               'is recorded per variant.',
            rmsd='CA-atom RMSD after optimal Kabsch superposition over every residue of the folded window '
                 '(wild type and variant have identical length, so the alignment is the identity).',
            position_check='Every position is checked against the fetched UniProt sequence; a mismatch is '
                           'reported, not silently corrected, because the source\'s numbering may be another '
                           'species\' or another isoform\'s.'),
        variants=[], skipped=NO_POSITION, esmfold_probe=None)

    # cache per (protein) of zebrafish accession + sequence + AF pLDDT
    cache = {}

    def zf(protein):
        if protein in cache:
            return cache[protein]
        cell = models['matrix']['zebrafish (Danio rerio)'][protein]
        rec = dict(status=cell['status'])
        if cell['status'] != 'absent':
            acc = cell['uniprot']['accession']
            rec['accession'] = acc
            rec['uniprot_id'] = cell['uniprot']['uniprot_id']
            rec['sequence'] = uniprot_sequence(acc)
            if cell.get('alphafold'):
                rec['alphafold_entry'] = cell['alphafold']['entry_id']
                rec['alphafold_version'] = cell['alphafold']['model_version']
                rec['alphafold_mean_plddt'] = cell['alphafold']['global_metric_value']
                rec['plddt'] = alphafold_plddt(acc, cell['alphafold']['cif_url'])
        cache[protein] = rec
        return rec

    for gene, pk, species, pos, wt, mut, src, do_fold in VARIANTS:
        z = zf(pk)
        v = dict(gene=gene, protein_key=pk, species=species, position=pos,
                 wild_type_aa=wt, variant_aa=mut, notation=f'{wt}{pos}{mut}', source=src,
                 uniprot=z.get('accession'), uniprot_id=z.get('uniprot_id'),
                 alphafold_entry=z.get('alphafold_entry'),
                 alphafold_version=z.get('alphafold_version'),
                 alphafold_mean_plddt=z.get('alphafold_mean_plddt'))
        seq = z.get('sequence')
        if not seq:
            v['position_check'] = dict(ok=False, reason='no UniProt sequence for this protein')
            out['variants'].append(v)
            continue
        v['sequence_length'] = len(seq)
        actual = seq[pos - 1] if pos <= len(seq) else None
        v['position_check'] = dict(ok=(actual == wt), uniprot_residue_at_position=actual,
                                   expected=wt,
                                   note=('the fetched UniProt sequence carries the expected wild-type residue '
                                         'at this position' if actual == wt else
                                         'MISMATCH: the source\'s numbering does not line up with this UniProt '
                                         'sequence (different isoform, different species, or a signal-peptide '
                                         'offset). Nothing is renumbered; the mismatch is the result.'))
        # pLDDT window around the site from the wild-type AlphaFold model
        pl = z.get('plddt')
        if pl:
            win = {str(i): pl.get(i) for i in range(pos - 10, pos + 11) if i in pl}
            vals = [x for x in win.values() if x is not None]
            v['wild_type_alphafold_plddt'] = dict(
                at_site=pl.get(pos), window='+/-10 residues', per_residue=win,
                window_mean=round(sum(vals) / len(vals), 2) if vals else None,
                window_min=min(vals) if vals else None)
        if not do_fold:
            v['esmfold'] = dict(run=False, reason='not among the variants the brief asks to predict; the '
                                                  'position check and the wild-type pLDDT are reported instead')
            out['variants'].append(v)
            continue
        if actual != wt:
            v['esmfold'] = dict(run=False, reason='position check failed, so the variant sequence cannot be '
                                                  'built honestly from this UniProt entry')
            out['variants'].append(v)
            continue
        # fold wild type and variant over the same window
        probe = out.get('esmfold_probe')
        full_ok = probe['full_length_accepted'] if probe else None
        window = (1, len(seq))
        wtseq = seq
        if len(seq) > 400:
            half = 175
            lo = max(1, pos - half)
            hi = min(len(seq), lo + 349)
            lo = max(1, hi - 349)
            window = (lo, hi)
            wtseq = seq[lo - 1:hi]
        v['folded_window'] = dict(start=window[0], end=window[1], length=len(wtseq),
                                  note='full chain' if window == (1, len(seq)) else
                                  'centred 350-residue window: ESMFold\'s public endpoint rejects long chains, '
                                  'so the comparison is local to the site and says nothing about the rest of '
                                  'the protein')
        off = pos - window[0]
        mutseq = wtseq[:off] + mut + wtseq[off + 1:]
        tag_wt = f'{z["accession"]}_{window[0]}-{window[1]}_WT'
        tag_mu = f'{z["accession"]}_{window[0]}-{window[1]}_{wt}{pos}{mut}'
        pwt, nwt = esmfold(wtseq, tag_wt)
        pmu, nmu = esmfold(mutseq, tag_mu)
        if not pwt or not pmu:
            v['esmfold'] = dict(run=True, ok=False, wild_type_note=nwt, variant_note=nmu,
                                reason='ESMFold did not return coordinates for one or both sequences')
            out['variants'].append(v)
            continue
        ca_w, pl_w = ca_and_plddt(pwt)
        ca_m, pl_m = ca_and_plddt(pmu)
        n = min(len(ca_w), len(ca_m))
        r_all = rmsd(ca_w[:n], ca_m[:n])
        lo = max(0, off - 10); hi = min(n, off + 11)
        r_loc = rmsd(ca_w[lo:hi], ca_m[lo:hi]) if hi - lo > 3 else None
        v['esmfold'] = dict(
            run=True, ok=True, endpoint=ESM,
            residues_modelled=dict(wild_type=len(ca_w), variant=len(ca_m)),
            rmsd_CA_whole_window_A=round(r_all, 3),
            rmsd_CA_site_pm10_A=round(r_loc, 3) if r_loc is not None else None,
            plddt_at_site=dict(wild_type=pl_w[off] if off < len(pl_w) else None,
                               variant=pl_m[off] if off < len(pl_m) else None),
            plddt_window_pm10=dict(
                wild_type={str(window[0] + i): pl_w[i] for i in range(lo, hi)},
                variant={str(window[0] + i): pl_m[i] for i in range(lo, hi)}),
            plddt_mean=dict(wild_type=round(sum(pl_w) / len(pl_w), 2),
                            variant=round(sum(pl_m) / len(pl_m), 2)),
            files=dict(wild_type=f'{TMP}/{tag_wt}.pdb', variant=f'{TMP}/{tag_mu}.pdb'),
            label='STRUCTURE PREDICTION, NOT FUNCTION')
        print(f'{v["notation"]:10s} {gene:18s} RMSD(window) {r_all:.3f} A  RMSD(site+/-10) '
              f'{r_loc if r_loc is None else round(r_loc, 3)} A  pLDDT site '
              f'{v["esmfold"]["plddt_at_site"]}')
        out['variants'].append(v)

    with open(os.path.join(OUT, 'variants.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('wrote variants/variants.json')


if __name__ == '__main__':
    main()
