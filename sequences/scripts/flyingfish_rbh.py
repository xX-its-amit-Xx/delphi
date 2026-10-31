"""Real annotated flying-fish proteins: Xu et al. 2021 (Front Genet 12:695700) Hirundichthys speculiger protein set from
figshare 10.6084/m9.figshare.14600634.v1 (Hirundichthys_speculiger.pep.fa). Orthologues of the focal zebrafish genes are
called by reciprocal best hit (blastp) against the Ensembl release-116 zebrafish proteome (pep.all, all isoforms).
Writes C:/Temp/sequences/flyingfish_rbh.json"""
import json, subprocess, gzip, os, re
B = 'C:/Temp/sequences/tools/ncbi-blast-2.17.0+/bin/'
FS = 'C:/Temp/sequences/figshare/Hspec.pep.fa'
DR = 'C:/Temp/sequences/ensembl_ftp/dr.pep.fa'
FOCAL = ['kcnk5b', 'kcnh2a', 'slc43a2a', 'gja1b', 'tbx5a', 'fgf10a', 'shha', 'hhip', 'prdm1a']

if not os.path.exists(DR):
    with gzip.open(DR + '.gz', 'rt') as f, open(DR, 'w') as o:
        o.write(f.read())
# map zebrafish protein -> gene
p2g, p2s = {}, {}
for line in open(DR):
    if line.startswith('>'):
        pid = line[1:].split()[0].split('.')[0]
        m = re.search(r'gene:(ENSDARG\d+)', line); m2 = re.search(r'gene_symbol:(\S+)', line)
        p2g[pid] = m.group(1) if m else None; p2s[pid] = m2.group(1) if m2 else None
for fa, name in [(FS, 'hspec'), (DR, 'drer')]:
    if not os.path.exists(f'C:/Temp/sequences/figshare/{name}.pin'):
        subprocess.run([B + 'makeblastdb.exe', '-in', fa, '-dbtype', 'prot', '-out', f'C:/Temp/sequences/figshare/{name}'], capture_output=True)
seqs_fs, cur = {}, None
for line in open(FS):
    if line.startswith('>'):
        cur = line[1:].split()[0]; seqs_fs[cur] = []
    else:
        seqs_fs[cur].append(line.strip())
seqs_fs = {k: ''.join(v).rstrip('*') for k, v in seqs_fs.items()}

sel = json.load(open('C:/Temp/sequences/selected.json'))
fmt = '6 qseqid sseqid pident length qlen slen evalue bitscore'
def blast(qfa, db, n=5):
    p = subprocess.run([B + 'blastp.exe', '-query', qfa, '-db', db, '-outfmt', fmt, '-evalue', '1e-5', '-max_target_seqs', str(n)],
                       capture_output=True, text=True)
    return [l.split('\t') for l in p.stdout.splitlines()]
out = {}
for g in FOCAL:
    z = sel[g]['danio_rerio']
    q = 'C:/Temp/sequences/rbh_q.fa'; open(q, 'w').write(f">{z['protein_id']}\n{z['seq']}\n")
    fwd = blast(q, 'C:/Temp/sequences/figshare/hspec')
    if not fwd:
        out[g] = {'status': 'no forward hit'}; continue
    tried = []
    for best in sorted(fwd, key=lambda r: -float(r[7]))[:5]:
        hit = best[1]
        open(q, 'w').write(f">{hit}\n{seqs_fs[hit]}\n")
        rev = blast(q, 'C:/Temp/sequences/figshare/drer', 10)
        rbest = max(rev, key=lambda r: float(r[7])) if rev else None
        rgene = p2g.get(rbest[1].split('.')[0]) if rbest else None
        rsym = p2s.get(rbest[1].split('.')[0]) if rbest else None
        tried.append({'flyingfish_protein': hit, 'forward_pident': float(best[2]), 'reverse_gene': rgene, 'reverse_symbol': rsym})
        if rgene == z['gene_id'] or rsym == g:
            break
    else:
        best = max(fwd, key=lambda r: float(r[7])); hit = best[1]
        rgene, rsym = tried[0]['reverse_gene'], tried[0]['reverse_symbol']
    out[g] = {'zebrafish_query': z['protein_id'], 'zebrafish_gene': z['gene_id'], 'flyingfish_protein': hit,
              'forward_pident': float(best[2]), 'forward_bits': float(best[7]), 'flyingfish_length': len(seqs_fs[hit]),
              'reverse_best_zebrafish_gene': rgene, 'reverse_best_zebrafish_symbol': rsym,
              'reciprocal_best_hit': rgene == z['gene_id'] or rsym == g, 'forward_hits_tried': tried, 'seq': seqs_fs[hit],
              'runner_up_forward': [(r[1], float(r[2]), float(r[7])) for r in sorted(fwd, key=lambda r: -float(r[7]))[1:3]]}
    print(g, hit, best[2], len(seqs_fs[hit]), 'RBH' if out[g]['reciprocal_best_hit'] else f'NOT RBH (reverse -> {rsym})', flush=True)
v = subprocess.run([B + 'blastp.exe', '-version'], capture_output=True, text=True).stdout.splitlines()[0]
json.dump({'tool': v, 'method': 'reciprocal best blastp hit, zebrafish Ensembl 116 protein -> Xu 2021 H. speculiger pep.fa -> zebrafish Ensembl 116 pep.all; evalue 1e-5; best by bitscore; if the top forward hit is not reciprocal, the next forward hits (up to 5) are tried; a reverse hit to a zebrafish gene with the same symbol counts (Ensembl 116 has two gene IDs named fgf10a)',
           'genes': out}, open('C:/Temp/sequences/flyingfish_rbh.json', 'w'), indent=1)
