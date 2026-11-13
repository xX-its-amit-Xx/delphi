"""Write D:/Users/ashenoy00000/delphi-work/data/bilayer-theory/MANIFEST.json: url, fetch date, bytes, sha256 of every kept file.
Run: python make_manifest.py"""
import hashlib, json, os, datetime
root = 'D:/Users/ashenoy00000/delphi-work/data/bilayer-theory'
src = {
 'stoney1909/paper-doi-10_1098_rspa_1909_0021.pdf': 'https://archive.org/download/paper-doi-10_1098_rspa_1909_0021/paper-doi-10_1098_rspa_1909_0021.pdf',
 'stoney1909/paper-doi-10_1098_rspa_1909_0021_djvu.txt': 'https://archive.org/download/paper-doi-10_1098_rspa_1909_0021/paper-doi-10_1098_rspa_1909_0021_djvu.txt',
 'timoshenko1925/josa_1925-09_vol11_iss3.pdf': 'https://archive.org/download/sim_optical-society-of-america-journal_1925-09_11_3/sim_optical-society-of-america-journal_1925-09_11_3.pdf (J. Opt. Soc. Am. & Rev. Sci. Instr. vol 11 issue 3, Sept 1925; Timoshenko pp 233-255)',
 'timoshenko1925/josa_1925-09_vol11_iss3_djvu.txt': 'https://archive.org/download/sim_optical-society-of-america-journal_1925-09_11_3/sim_optical-society-of-america-journal_1925-09_11_3_djvu.txt',
 'pezzulla2016/arxiv-1509.05259.pdf': 'https://arxiv.org/pdf/1509.05259',
 'stoney-ext/unt_7024.pdf': 'https://digital.library.unt.edu/ark:/67531/metadc707457/m2/1/high_res_d/7024.pdf (Freund, Floro, Chason preprint of Appl. Phys. Lett. 74, 1987 (1999))',
 'anisostoney/arxiv-1712.07974.pdf': 'https://arxiv.org/pdf/1712.07974',
 'alben-arxiv/arxiv-1110.1007.pdf': 'https://arxiv.org/pdf/1110.1007',
 'holmes2019/arxiv-1809.04620.pdf': 'https://arxiv.org/pdf/1809.04620',
 'formlabs-tds/Nylon-12-TDS.pdf': 'https://media.formlabs.com/m/2a02034348060e54/original/-ENUS-Nylon-12-TDS.pdf',
 'formlabs-tds/Nylon-11-CF-TDS.pdf': 'https://media.formlabs.com/m/78601243ded7e922/original/-ENUS-Nylon-11-CF-TDS.pdf',
 'formlabs-tds/Flexible-80A-V2-TDS.pdf': 'https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf',
}
out = []
for rel, url in src.items():
    p = os.path.join(root, rel)
    if not os.path.exists(p):
        out.append({'file': rel, 'url': url, 'missing': True}); continue
    b = open(p, 'rb').read()
    out.append({'file': rel, 'url': url, 'fetched': '2026-11-12', 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()})
json.dump(out, open(os.path.join(root, 'MANIFEST.json'), 'w'), indent=1)
print(sum(o.get('bytes', 0) for o in out), 'bytes total'); print(json.dumps(out, indent=1))
