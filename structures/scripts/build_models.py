"""Deliverable 1: structures/models.json

For every (species, protein) in the panel: find the UniProt accession(s), then ask the
AlphaFold DB API whether a predicted model exists, and record its version, mean pLDDT and
URLs -- or "absent", with which step failed (no UniProt entry vs UniProt entry but no
AlphaFold model). Nothing is downloaded here except small JSON.

Run:  python build_models.py
"""
import json, os, sys, statistics
import net
from panel import SPECIES, PROTEINS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = 'https://rest.uniprot.org'
AF = 'https://alphafold.ebi.ac.uk/api'


# ---------------------------------------------------------------- taxonomy
def resolve_taxa():
    out = {}
    for label, sci, cat, note in SPECIES:
        q = sci.replace(' ', '%20')
        d = net.jget(f'{UP}/taxonomy/search?query=scientific:%22{q}%22&format=json&size=5',
                     f'UniProt taxonomy lookup {sci}')
        hit = None
        for r in (d or {}).get('results', []):
            if r.get('scientificName', '').lower() == sci.lower():
                hit = r
                break
        if hit is None and (d or {}).get('results'):
            hit = d['results'][0]
        tid = hit.get('taxonId') if hit else None
        n_entries = None
        if tid:
            n_entries = net.total_results(
                f'{UP}/uniprotkb/search?query=taxonomy_id:{tid}&format=json&size=1&fields=accession',
                f'count UniProtKB entries in taxon {tid} ({sci})')
        out[label] = dict(scientific_name=sci, category=cat, note=note,
                          taxon_id=tid,
                          rank=hit.get('rank') if hit else None,
                          common_name=hit.get('commonName') if hit else None,
                          resolved=bool(hit),
                          uniprot_entries=n_entries)
    return out


# ---------------------------------------------------------------- uniprot
def uniprot_candidates(taxon_id, symbols, rank):
    """Search UniProtKB for these gene symbols within this taxon. Returns list of records."""
    recs = []
    seen = set()
    scope = 'taxonomy_id' if rank not in ('species', 'subspecies', 'strain', 'no rank', None) else 'organism_id'
    for sym in symbols:
        if not sym:
            continue
        url = (f'{UP}/uniprotkb/search?query=gene:{sym}+AND+{scope}:{taxon_id}'
               f'&fields=accession,id,protein_name,organism_name,organism_id,length,reviewed,gene_primary,xref_alphafolddb'
               f'&format=json&size=25')
        d = net.jget(url, f'UniProt search gene {sym} in taxon {taxon_id}')
        for r in (d or {}).get('results', []):
            acc = r.get('primaryAccession')
            if not acc or acc in seen:
                continue
            seen.add(acc)
            genes = [g.get('geneName', {}).get('value') for g in r.get('genes', []) if g.get('geneName')]
            recs.append(dict(
                accession=acc,
                uniprot_id=r.get('uniProtkbId'),
                reviewed=r.get('entryType', '').startswith('UniProtKB reviewed'),
                protein_name=((r.get('proteinDescription') or {}).get('recommendedName')
                              or (r.get('proteinDescription') or {}).get('submissionNames', [{}])[0]
                              or {}).get('fullName', {}).get('value'),
                organism=(r.get('organism') or {}).get('scientificName'),
                organism_taxon_id=(r.get('organism') or {}).get('taxonId'),
                length=(r.get('sequence') or {}).get('length'),
                gene_names=genes,
                query_symbol=sym,
            ))
    return recs


# protein key -> regex a protein NAME must match for a free-text hit to count. Used only for
# taxa whose UniProt entries carry no gene symbol at all (genome-annotation TrEMBL proteomes).
NAME_RX = {
    # Tightened after an audit: the first version matched PARALOGS. A free-text search for tbx5
    # returned "T-box transcription factor 4" for two bats, prdm1 returned PRDM15 and PRDM16, and
    # the plain word "hedgehog" matched "Hedgehog-interacting protein" as the colugo's shha. Each
    # pattern now has to name the specific family member, and shha excludes HHIP explicitly.
    'kcnk5b': r'subfamily K member 5\b|\bTASK-?2\b|potassium channel TASK2\b',
    'kcnh2a': r'subfamily H member 2\b|\bhERG\b|\bKCNH2\b',
    'gja1b': r'gap junction alpha-?1\b|gap junction protein alpha 1\b|connexin.?43\b|\bGJA1\b|^gap junction protein$',
    'slc43a2a': r'transporter small subunit 4\b|solute carrier family 43 member 2\b|\bLAT4\b|\bSLC43A2\b|^large neutral amino acids transporter small subunit$',
    'hhip': r'hedgehog.?interacting',
    'shha': r'sonic hedgehog|^protein hedgehog$|^hedgehog protein\b',
    'tbx5a': r'T-?box (transcription factor )?(protein )?(TBX)?5\b|\bTBX5\b',
    'prdm1a': r'PR domain zinc finger protein 1\b|\bPRDM1\b|BLIMP',
}



def freetext_candidates(taxon_id, symbols, protein_key):
    """Fallback for taxa whose entries have no gene names: free-text search the symbol inside the
    taxon and keep only hits whose PROTEIN NAME matches the family regex. Lower confidence, flagged."""
    import re
    rx = re.compile(NAME_RX.get(protein_key, r'$^'), re.I)
    recs, seen = [], set()
    for sym in symbols:
        if not sym:
            continue
        url = (f'{UP}/uniprotkb/search?query={sym}+AND+taxonomy_id:{taxon_id}'
               f'&fields=accession,id,protein_name,organism_name,organism_id,length,reviewed,gene_primary'
               f'&format=json&size=25')
        d = net.jget(url, f'UniProt free-text fallback {sym} in taxon {taxon_id}')
        for r in (d or {}).get('results', []):
            acc = r.get('primaryAccession')
            if not acc or acc in seen:
                continue
            pd = r.get('proteinDescription') or {}
            name = ((pd.get('recommendedName') or (pd.get('submissionNames') or [{}])[0] or {})
                    .get('fullName', {}) or {}).get('value')
            if not name or not rx.search(name):
                continue
            seen.add(acc)
            genes = [g.get('geneName', {}).get('value') for g in r.get('genes', []) if g.get('geneName')]
            recs.append(dict(accession=acc, uniprot_id=r.get('uniProtkbId'),
                             reviewed=r.get('entryType', '').startswith('UniProtKB reviewed'),
                             protein_name=name, organism=(r.get('organism') or {}).get('scientificName'),
                             organism_taxon_id=(r.get('organism') or {}).get('taxonId'),
                             length=(r.get('sequence') or {}).get('length'), gene_names=genes,
                             query_symbol=sym, matched_by='protein name (gene symbol not annotated)'))
    return recs


def pick(recs, symbols):
    """Prefer a reviewed entry whose primary gene name matches a wanted symbol, then
    reviewed, then the longest unreviewed match."""
    low = [s.lower() for s in symbols]

    def score(r):
        g = [x.lower() for x in (r['gene_names'] or [])]
        exact = 1 if any(x in low for x in g) else 0
        return (r['reviewed'], exact, r['length'] or 0)
    return sorted(recs, key=score, reverse=True)[0] if recs else None


# ---------------------------------------------------------------- alphafold
def alphafold(acc):
    d = net.jget(f'{AF}/prediction/{acc}', f'AlphaFold DB prediction for {acc}')
    if not d:
        return None
    e = d[0] if isinstance(d, list) and d else (d if isinstance(d, dict) else None)
    if not e:
        return None
    return dict(
        entry_id=e.get('entryId'),
        model_version=e.get('latestVersion') or e.get('modelCreatedDate'),
        model_created=e.get('modelCreatedDate'),
        uniprot_accession=e.get('uniprotAccession'),
        uniprot_start=e.get('uniprotStart'), uniprot_end=e.get('uniprotEnd'),
        sequence_length=len(e.get('uniprotSequence') or '') or None,
        cif_url=e.get('cifUrl'), pdb_url=e.get('pdbUrl'), bcif_url=e.get('bcifUrl'),
        pae_url=e.get('paeDocUrl') or e.get('paeImageUrl'),
        global_metric_value=e.get('globalMetricValue'),
        model_entity_id=e.get('entryId'),
        am_annotations_url=e.get('amAnnotationsUrl'),
    )


def main():
    taxa = resolve_taxa()
    with open(os.path.join(ROOT, 'taxa.json'), 'w', encoding='utf-8') as f:
        json.dump(taxa, f, indent=1)
    print('resolved taxa:')
    for k, v in taxa.items():
        print(f'  {k:52s} taxon {v["taxon_id"]} ({v["rank"]})')

    out = {
        'title': 'AlphaFold DB / UniProt coverage for the DELPHI flight-and-gliding protein panel',
        'built': None,
        'tool': 'structures/scripts/build_models.py',
        'bird_exclusion': ('Class Aves is this project\'s frozen holdout: no bird sequence or structure '
                           'was fetched and no bird species is named in this panel, until the holdout exam runs.'),
        'pterosaurs': ('Pterosaurs are extinct and leave no DNA or protein, so no structural or sequence '
                       'comparison is possible for them anywhere in this layer.'),
        'method': ('Per (species, protein): UniProtKB search for each candidate gene symbol restricted to the '
                   'taxon, one record picked by (reviewed, exact gene-symbol match, length); then the AlphaFold DB '
                   'prediction API for that accession. "absent" distinguishes no-UniProt-entry from '
                   'UniProt-entry-but-no-AlphaFold-model. Family-level taxa (Exocoetidae, Hemiramphidae, Belonidae) '
                   'are searched across the whole taxonomic subtree.'),
        'species': taxa,
        'proteins': {k: {kk: vv for kk, vv in v.items() if kk != 'fly_symbols'} for k, v in PROTEINS.items()},
        'matrix': {},
        'summary': {},
    }

    n_model = n_uniprot_only = n_absent = 0
    for label, meta in taxa.items():
        tid = meta['taxon_id']
        out['matrix'][label] = {}
        for pk, pmeta in PROTEINS.items():
            syms = list(pmeta['symbols'])
            if 'Drosophila' in label:
                syms = list(pmeta['fly_symbols']) + syms
            if tid is None:
                out['matrix'][label][pk] = dict(status='absent', reason='taxon could not be resolved in UniProt')
                n_absent += 1
                continue
            recs = uniprot_candidates(tid, syms, meta['rank'])
            how = 'gene symbol'
            if not recs:
                recs = freetext_candidates(tid, syms, pk)
                how = 'protein name (no gene symbol in this proteome)'
            if not recs:
                out['matrix'][label][pk] = dict(
                    status='absent',
                    reason='no UniProtKB entry for any candidate gene symbol, and no free-text hit whose '
                           'protein name matches the family, in this taxon',
                    symbols_tried=syms, taxon_total_uniprot_entries=meta.get('uniprot_entries'))
                n_absent += 1
                print(f'  ABSENT  {label:46s} {pk:10s} (no UniProt entry)')
                continue
            # pick in score order, but prefer a candidate that actually HAS an AlphaFold model
            ordered = sorted(recs, key=lambda r: (r['reviewed'],
                                                  1 if any(x.lower() in [s.lower() for s in syms]
                                                           for x in (r['gene_names'] or [])) else 0,
                                                  r['length'] or 0), reverse=True)
            best, af = ordered[0], None
            for cand in ordered[:6]:
                a = alphafold(cand['accession'])
                if a:
                    best, af = cand, a
                    break
            cell = dict(status='model' if af else 'uniprot_only', uniprot=best, matched_how=how,
                        confidence=('gene symbol in UniProt' if how == 'gene symbol'
                                    else 'LOWER: matched on protein name only, because this proteome '
                                         'carries no gene symbols; the name had to name the specific '
                                         'family member, but orthology was not verified by a tree'),
                        n_uniprot_candidates=len(recs),
                        other_accessions=[r['accession'] for r in ordered if r['accession'] != best['accession']][:8])
            if af:
                cell['alphafold'] = af
                cell['alphafold_url'] = f'https://alphafold.ebi.ac.uk/entry/{best["accession"]}'
                n_model += 1
                print(f'  MODEL   {label:46s} {pk:10s} {best["accession"]} pLDDT~{af["global_metric_value"]}')
            else:
                cell['reason'] = ('UniProt entries exist but AlphaFold DB has no prediction for any of the '
                                  f'{min(len(ordered), 6)} best candidate accessions')
                n_uniprot_only += 1
                print(f'  NO-AF   {label:46s} {pk:10s} {best["accession"]}')
            out['matrix'][label][pk] = cell

    import time
    out['built'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    out['summary'] = dict(cells=len(taxa) * len(PROTEINS), with_alphafold_model=n_model,
                          uniprot_only=n_uniprot_only, absent=n_absent,
                          species=len(taxa), proteins=len(PROTEINS))
    with open(os.path.join(ROOT, 'models.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out['summary'], indent=1))


if __name__ == '__main__':
    main()
