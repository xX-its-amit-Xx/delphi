"""Record what the ESMFold endpoint did and did not serve, and roll the experimental geometry
from interface-mapping.json into variants/variants.json so each variant has one place to look.
"""
import json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'variants', 'variants.json')


def main():
    v = json.load(open(P, encoding='utf-8'))
    im = json.load(open(os.path.join(ROOT, 'interface-mapping.json'), encoding='utf-8'))
    geo = {(r['protein'], r['zebrafish_position']): r for r in im['variant_positions_on_structures']}

    calls = json.load(open(os.path.join(ROOT, 'calls.json'), encoding='utf-8'))
    esm = [c for c in calls if 'ESMFold' in (c.get('purpose') or '')]
    by_status = collections.Counter(c.get('status') for c in esm)
    ok = [c for c in esm if c.get('status') == 200]
    v['esmfold_service'] = dict(
        endpoint='https://api.esmatlas.com/foldSequence/v1/pdb/',
        calls_made=len(esm), by_http_status={str(k): n for k, n in by_status.items()},
        first_success=ok[0]['time'] if ok else None, last_success=ok[-1]['time'] if ok else None,
        what_happened=('The endpoint served the first two folds (a 350-residue window of zebrafish '
                       'Kcnk5b, wild type and W169L) and then returned HTTP 504 '
                       '"Endpoint request timed out" to every later request, including a deliberate '
                       '66-residue probe. So this is a service outage during the run, not a '
                       'sequence-length limit: one wild-type/variant pair was obtained and the rest '
                       'were not.'),
        consequence=('For the variants without an ESMFold pair, what is reported instead is (a) the '
                     'per-residue pLDDT of the wild-type AlphaFold DB model around the site and (b) the '
                     'position measured in a deposited experimental structure (distance to the partner '
                     'subunit, to a bound ligand, to a bound ion), which is stronger evidence than a '
                     'prediction anyway. The missing runs are reproducible: rerun '
                     'structures/scripts/build_variants.py when the endpoint is up; the cache makes '
                     'everything else free.'),
        label='STRUCTURE PREDICTION, NOT FUNCTION')

    for x in v['variants']:
        g = geo.get((x['protein_key'], x['position']))
        if g:
            x['experimental_structure'] = dict(
                pdb_id=(g.get('structure') or {}).get('pdb_id'),
                resolution_A=(g.get('structure') or {}).get('resolution_A'),
                reference_uniprot=(g.get('structure') or {}).get('reference_uniprot'),
                identity_zebrafish_vs_structure_protein=(g.get('structure') or {})
                .get('identity_zebrafish_vs_structure_protein'),
                mapped_position=g.get('mapped_position_in_structure_protein'),
                residue_in_structure=g.get('residue_in_structure_protein'),
                is_an_interface_residue=g.get('is_an_interface_residue'),
                interface_hits=g.get('interface_hits'),
                inside_selectivity_filter=g.get('inside_the_selectivity_filter_of_our_protein'),
                measured=g.get('measured_in_the_coordinates'),
                note='this is where the residue SITS, measured in deposited coordinates; it is not a '
                     'measurement of what the substitution DOES')
    counts = dict(
        variants=len(v['variants']),
        position_check_passed=sum(1 for x in v['variants'] if x['position_check'].get('ok')),
        position_check_failed=sum(1 for x in v['variants'] if not x['position_check'].get('ok')),
        esmfold_pairs_obtained=sum(1 for x in v['variants'] if (x.get('esmfold') or {}).get('ok')),
        esmfold_pairs_attempted=sum(1 for x in v['variants'] if (x.get('esmfold') or {}).get('run')),
        placed_on_an_experimental_structure=sum(1 for x in v['variants']
                                                if (x.get('experimental_structure') or {}).get('mapped_position')),
        at_an_interface_residue=sum(1 for x in v['variants']
                                    if (x.get('experimental_structure') or {}).get('is_an_interface_residue')))
    v['summary'] = counts
    with open(P, 'w', encoding='utf-8') as f:
        json.dump(v, f, indent=1)
    print(json.dumps(counts, indent=1))
    print(json.dumps(v['esmfold_service']['by_http_status'], indent=1))


if __name__ == '__main__':
    main()
