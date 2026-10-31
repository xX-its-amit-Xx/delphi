"""tblastn the medaka orthologue protein of each focal gene against the Hirundichthys speculiger
scaffold assembly GCA_018398805.1 (unannotated; downloaded to C:/Temp), and project the hits onto
medaka protein coordinates. Output: C:/Temp/sequences/flyingfish_tblastn.json"""
import json, subprocess, os, sys
BLAST = 'C:/Temp/sequences/tools/ncbi-blast-2.17.0+/bin/tblastn.exe'
DB = 'C:/Temp/sequences/ffgenome/hspec'
OUT = 'C:/Temp/sequences/flyingfish_tblastn.json'
genes = sys.argv[1:]
raw = json.load(open('C:/Temp/sequences/orthologs_raw.json'))
sel = json.load(open('C:/Temp/sequences/selected.json'))
res = {}
for g in genes:
    anchor = 'oryzias_latipes' if sel[g].get('oryzias_latipes') else 'danio_rerio'
    med = sel[g][anchor]
    q = f'C:/Temp/sequences/q_{g}.fa'
    open(q, 'w').write(f">{med['protein_id']}\n{med['seq']}\n")
    fmt = '6 qseqid sseqid pident length qstart qend sstart send evalue bitscore sframe qseq sseq'
    p = subprocess.run([BLAST, '-query', q, '-db', DB, '-outfmt', fmt, '-evalue', '1e-5', '-max_target_seqs', '20',
                        '-seg', 'no'], capture_output=True, text=True)
    hsps = []
    for line in p.stdout.strip().splitlines():
        f = line.split('\t')
        hsps.append(dict(sseqid=f[1], pident=float(f[2]), length=int(f[3]), qstart=int(f[4]), qend=int(f[5]),
                         sstart=int(f[6]), send=int(f[7]), evalue=float(f[8]), bits=float(f[9]), sframe=int(f[10]),
                         qseq=f[11], sseq=f[12]))
    # best scaffold+strand by summed bits
    tot = {}
    for h in hsps: tot[(h['sseqid'], h['sframe'] > 0)] = tot.get((h['sseqid'], h['sframe'] > 0), 0) + h['bits']
    proj = ['-'] * len(med['seq']); used = []
    if tot:
        best = max(tot, key=tot.get)
        cand = sorted([h for h in hsps if (h['sseqid'], h['sframe'] > 0) == best], key=lambda h: -h['bits'])
        cover = [False] * len(med['seq'])
        for h in cand:
            rng = range(h['qstart'] - 1, h['qend'])
            if sum(cover[i] for i in rng) > 0.2 * len(rng): continue
            qi = h['qstart'] - 1
            for a, b in zip(h['qseq'], h['sseq']):
                if a == '-': continue  # insertion in flying fish relative to medaka: dropped
                if not cover[qi]: proj[qi] = b if b != '-' else '-'
                qi += 1
            for i in rng: cover[i] = True
            used.append({k: h[k] for k in ('sseqid', 'pident', 'qstart', 'qend', 'sstart', 'send', 'evalue', 'bits')})
    covered = sum(1 for c in proj if c != '-')
    ident = sum(1 for a, b in zip(med['seq'], proj) if b != '-' and a == b)
    res[g] = {'anchor': anchor, 'query': med['protein_id'], 'query_len': len(med['seq']), 'best_scaffold': used[0]['sseqid'] if used else None,
              'n_hsps_total': len(hsps), 'hsps_used': sorted(used, key=lambda h: h['qstart']),
              'projected_on_medaka_coords': ''.join(proj), 'covered_positions': covered,
              'identity_to_medaka_over_covered': round(100 * ident / covered, 1) if covered else None,
              'scaffolds_hit': sorted(set(h['sseqid'] for h in hsps))}
    print(g, res[g]['best_scaffold'], covered, '/', len(med['seq']), res[g]['identity_to_medaka_over_covered'], flush=True)
v = subprocess.run([BLAST, '-version'], capture_output=True, text=True).stdout.strip().splitlines()[0]
json.dump({'tool': v, 'db': 'GCA_018398805.1 genomic.fna (NCBI FTP), makeblastdb nucl', 'genes': res}, open(OUT, 'w'), indent=1)
