"""Sequences for universe zebrafish accessions that UniProtKB no longer serves (deleted TrEMBL entries:
'Not part of a reference proteome'), from UniParc; the latest sequence version of each accession is kept."""
import json, gzip, os, time, requests
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
C = 'C:/Temp/omics-cache/ptm/uniprot'
G = json.load(open(f'{ROOT}/omics/genes.json', encoding='utf-8'))['genes']
have = set()
for f in os.listdir(C):
    if f.startswith('zf_') and f[3].isdigit():
        have |= {e['primaryAccession'] for e in json.load(gzip.open(f'{C}/{f}', 'rt', encoding='utf-8'))}
miss = sorted({g['uniprot'] for g in G if g.get('uniprot') and g['uniprot'] not in have})
out = {}
for i in range(0, len(miss), 95):
    b = miss[i:i + 95]
    r = requests.get('https://rest.uniprot.org/uniparc/stream', params={'query': '(' + ' OR '.join(b) + ')', 'fields': 'upi,accession,sequence', 'format': 'tsv'}, timeout=120)
    r.raise_for_status()
    for line in r.text.splitlines()[1:]:
        upi, accs, seq = line.split('\t')
        for a in accs.split('; '):
            acc, _, ver = a.partition('.')
            if acc in b and (acc not in out or int(ver or 0) > out[acc][1]):
                out[acc] = (seq, int(ver or 0), upi)
    time.sleep(1)
json.dump({a: {'sequence': s, 'version': v, 'upi': u} for a, (s, v, u) in out.items()}, gzip.open(f'{C}/zf_uniparc.json.gz', 'wt', encoding='utf-8'))
print(len(miss), 'missing;', len(out), 'recovered from UniParc')
