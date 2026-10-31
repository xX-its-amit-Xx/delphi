"""blastp medaka query proteins against the Daane 2021 translated captured exons (Zenodo 10.5281/zenodo.5082978,
translated_exons.tar.gz, 35 beloniform species) and project the best orthologous exon hits onto medaka residue
coordinates. Paralogue guard: an exon hit is placed only at >= MIN_PID % identity and best bitscore per region.
Writes C:/Temp/sequences/daane_exons.json (focal genes) and C:/Temp/sequences/daane_sheetG.json (sheet G genes)."""
import json, subprocess, sys
BLASTP = 'C:/Temp/sequences/tools/ncbi-blast-2.17.0+/bin/blastp.exe'
DB = 'C:/Temp/sequences/zenodo/daane_exons'
MIN_PID = 75.0
FOCAL = ['kcnk5b', 'kcnh2a', 'slc43a2a', 'gja1b', 'tbx5a', 'fgf10a', 'shha', 'hhip', 'prdm1a']

FLY = {'Cheilopogon_furcatus', 'Cheilopogon_papilio', 'Cheilopogon_xenopterus', 'Cypselurus_callopterus', 'Exocoetus_volitans',
       'Fodiator_rostratus', 'Hirundichthys_rondeleti', 'Parexocoetus_brachypterus', 'Prognichthys_tringa'}
FLYHB = {'Euleptorhamphus_viridis', 'Oxyporhamphus_micropterus'}
HB = {'Hemiramphus_far', 'Hemiramphus_brasiliensis', 'Rhynchorhamphus_georgii', 'Hyporhamphus_quoyi', 'Hyporhamphus_brederi',
      'Hyporhamphus_unifasciatus', 'Melapedalion_breve', 'Arrhamphus_sclerolepis', 'Chriodorus_atherinoides', 'Zenarchopterus_spp',
      'Hemiramphodon_pgonognathus', 'Hemiramphodon_tengah'}


def role(sp):
    if sp in FLY: return 'flying fish (Exocoetidae)'
    if sp in FLYHB: return 'flying (gliding) halfbeak'
    if sp in HB: return 'halfbeak (non-gliding)'
    return 'needlefish or saury (non-gliding)'


def run(queries):
    fa = 'C:/Temp/sequences/daane_q.fa'
    with open(fa, 'w') as f:
        for k, s in queries.items():
            f.write(f'>{k}\n{s}\n')
    fmt = '6 qseqid sseqid pident qstart qend evalue bitscore qseq sseq'
    p = subprocess.run([BLASTP, '-query', fa, '-db', DB, '-outfmt', fmt, '-evalue', '1e-5', '-max_target_seqs', '20000',
                        '-num_threads', '4', '-seg', 'no'], capture_output=True, text=True)
    hits = {}
    for line in p.stdout.splitlines():
        q, s, pid, qs, qe, ev, bits, qseq, sseq = line.split('\t')
        sp = s.split('|')[0]
        hits.setdefault(q, {}).setdefault(sp, []).append(dict(exon=s.split('|')[1], pid=float(pid), qs=int(qs), qe=int(qe),
                                                              bits=float(bits), qseq=qseq, sseq=sseq))
    out = {}
    for q, bysp in hits.items():
        L = len(queries[q]); out[q] = {}
        for sp, hs in bysp.items():
            proj = ['-'] * L; cover = [False] * L; used = []
            for h in sorted(hs, key=lambda h: -h['bits']):
                if h['pid'] < MIN_PID: continue
                rng = range(h['qs'] - 1, h['qe'])
                if sum(cover[i] for i in rng) > 0.2 * len(rng): continue
                qi = h['qs'] - 1
                for a, b in zip(h['qseq'], h['sseq']):
                    if a == '-': continue
                    if not cover[qi] and b not in '-X': proj[qi] = b
                    qi += 1
                for i in rng: cover[i] = True
                used.append(h['exon'])
            out[q][sp] = {'role': role(sp), 'projected_on_medaka_coords': ''.join(proj), 'exons_used': used,
                          'covered': sum(c != '-' for c in proj)}
    return out


if __name__ == '__main__':
    which = sys.argv[1]
    if which == 'focal':
        sel = json.load(open('C:/Temp/sequences/selected.json'))
        q = {g: sel[g]['oryzias_latipes']['seq'] for g in FOCAL if sel.get(g, {}).get('oryzias_latipes')}
        res = run(q)
        json.dump(res, open('C:/Temp/sequences/daane_exons.json', 'w'))
        for g in res: print(g, len(res[g]), sorted((v['covered'] for v in res[g].values()))[:3], len(q[g]))
    else:
        d = json.load(open('C:/Temp/sequences/sheetG_proteins.json'))['genes']
        q = {gid: v['seq'] for gid, v in d.items()}
        res = run(q)
        json.dump({'min_pid': MIN_PID, 'genes': res}, open('C:/Temp/sequences/daane_sheetG.json', 'w'))
        print(len(res))
