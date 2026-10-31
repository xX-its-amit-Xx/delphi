"""Glider panel (scope addition): RefSeq proteins for the focal genes from NCBI E-utilities, for gliding mammals and
non-gliding controls. Species with an assembly but no annotation are recorded as such (no protein retrievable without
a genome download and tblastn). Writes C:/Temp/sequences/gliders_raw.json"""
import json, urllib.parse as U
from net import jget, get
E = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
SYM = {'kcnk5b': 'KCNK5', 'kcnh2a': 'KCNH2', 'slc43a2a': 'SLC43A2', 'gja1b': 'GJA1', 'tbx5a': 'TBX5', 'fgf10a': 'FGF10',
       'shha': 'SHH', 'hhip': 'HHIP', 'prdm1a': 'PRDM1'}
SPECIES = {
    'Petaurus breviceps': ('glider', 'marsupial (Petauridae)', 'GCF_028583685.1'),
    'Trichosurus vulpecula': ('control', 'marsupial (Phalangeridae), non-gliding relative of the sugar glider', 'GCF_011100635.1'),
    'Galeopterus variegatus': ('glider', 'colugo (Dermoptera)', 'GCF_000696425.1'),
    'Cynocephalus volans': ('glider', 'Philippine colugo (Dermoptera)', 'GCF_027409185.1'),
    'Gekko kuhli': ('glider', 'parachute gecko (syn. Ptychozoon kuhli); GenBank (not RefSeq) protein annotation', 'GCA_051903775.2'),
    'Sciurus vulgaris': ('control', 'tree squirrel, non-gliding relative of flying squirrels', 'GCF_902686455.1'),
    'Anolis carolinensis': ('control', 'non-gliding lizard (Iguania, same suborder as Draco)', 'GCF_035594765.1'),
    'Gekko japonicus': ('control', 'non-gliding gecko (same genus as the parachute gecko Gekko kuhli)', 'GCF_001447785.1'),
    'Thamnophis elegans': ('control', 'non-gliding colubrid snake (same family as Chrysopelea)', 'GCF_009769535.1'),
    'Xenopus tropicalis': ('control', 'non-gliding frog (distant from Rhacophoridae)', 'GCF_000004195.4'),
}
NOT_ANNOTATED = {
    'Glaucomys volans': ('glider', 'GCA_020662805.1 scaffold, no RefSeq/GenBank annotation'),
    'Glaucomys sabrinus': ('glider', 'GCA_058129135.1 / GCA_058129105.1 scaffold, no annotation'),
    'Pteromys volans': ('glider', 'GCA_051107445.1 chromosome-level, no annotation'),
    'Petaurista (giant flying squirrels)': ('glider', 'no assembly found'),
    'Draco maculatus': ('glider', 'GCA_056783515.1 chromosome-level, no annotation'),
    'Ptychozoon (genus name as such)': ('glider', 'no assembly under that name; Gekko kuhli (syn. Ptychozoon kuhli) IS annotated in GenBank and is included'),
    'Chrysopelea ornata': ('glider', 'GCA_019457695.2 scaffold, no annotation'),
    'Rhacophorus / Zhangixalus (gliding frogs)': ('glider', 'no assembly found'),
}


def main():
    out = {'species': {}, 'not_annotated': NOT_ANNOTATED, 'symbols': SYM}
    for org, (r, desc, asm) in SPECIES.items():
        rec = {'role': r, 'desc': desc, 'assembly': asm, 'genes': {}}
        for g, sym in SYM.items():
            term = f'{sym}[Gene Name] AND "{org}"[Organism] ' + ('' if org == 'Gekko kuhli' else ' AND refseq[filter]')
            d = jget(f'{E}/esearch.fcgi?db=protein&retmode=json&retmax=50&term={U.quote(term)}',
                     f'NCBI RefSeq protein search {sym} in {org} (glider panel)')
            ids = d['esearchresult']['idlist'] if d else []
            if not ids:
                rec['genes'][g] = None; continue
            s = jget(f'{E}/esummary.fcgi?db=protein&retmode=json&id={",".join(ids)}', f'NCBI protein summaries {sym} {org}')
            cands = [(s['result'][k]['slen'], s['result'][k]['accessionversion'], s['result'][k]['title']) for k in s['result']['uids']]
            cands = [c for c in cands if 'LOW QUALITY' not in c[2].upper()] or cands
            L, acc, title = max(cands)
            fa = get(f'{E}/efetch.fcgi?db=protein&rettype=fasta&retmode=text&id={acc}', f'NCBI efetch protein {acc} ({sym}, {org})',
                     accept='text/plain').decode()
            seq = ''.join(fa.split('\n')[1:]).replace('\n', '').strip()
            rec['genes'][g] = {'accession': acc, 'title': title, 'length': len(seq), 'n_isoforms': len(cands), 'seq': seq}
        out['species'][org] = rec
        print(org, {g: (v['accession'] if v else None) for g, v in rec['genes'].items()}, flush=True)
    json.dump(out, open('C:/Temp/sequences/gliders_raw.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
