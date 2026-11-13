"""Write data/bm-hw-repro/MANIFEST.tsv: path, source URL, fetch date, bytes, sha256. Standard library only."""
import os, hashlib
D = r'D:\Users\ashenoy00000\delphi-work\data\bm-hw-repro'
U = {
 'store_form-4_.html': 'https://formlabs.com/store/form-4/', 'store_form-wash_.html': 'https://formlabs.com/store/form-wash/',
 'store_form-cure_.html': 'https://formlabs.com/store/form-cure/', 'store_materials_tough-1000-resin_.html': 'https://formlabs.com/store/materials/tough-1000-resin/',
 'mat_flexible-80a-resin.html': 'https://formlabs.com/store/materials/flexible-80a-resin/', 'mat_flexible-50a-resin.html': 'https://formlabs.com/store/materials/flexible-50a-resin/',
 'mat_silicone-40a-resin.html': 'https://formlabs.com/store/materials/silicone-40a-resin/', 'mat_rigid-10k-resin.html': 'https://formlabs.com/store/materials/rigid-10k-resin/',
 'st_fuse-1.html': 'https://formlabs.com/store/fuse-1/', 'st_fuse-sift.html': 'https://formlabs.com/store/fuse-sift/', 'st_fuse-blast.html': 'https://formlabs.com/store/fuse-blast/',
 'pw_nylon-12-powder.html': 'https://formlabs.com/store/materials/nylon-12-powder/', 'omm.html': 'https://formlabs.com/store/materials/open-material-mode/',
 'support_Form-Wash-Time-Settings_.html': 'https://formlabs.com/support/Form-Wash-Time-Settings/',
 'support_Form-Cure-2nd-Generation-time-and-temperature-settings_.html': 'https://formlabs.com/support/Form-Cure-2nd-Generation-time-and-temperature-settings/',
 'software_preform_.html': 'https://formlabs.com/software/preform/', 'preform_open.html': 'https://formlabs.com/support/Opening-a-model-in-PreForm/',
 'vendors/adafruit_sht45.html': 'https://www.adafruit.com/product/5665', 'greenspan/g.pdf': 'https://doi.org/10.6028/jres.081A.011 -> https://nvlpubs.nist.gov/nistpubs/jres/81A/jresv81An1p89_A1b.pdf',
}
rows = []
for root, _, fs in os.walk(D):
    for f in sorted(fs):
        p = os.path.join(root, f); rel = os.path.relpath(p, D).replace(os.sep, '/')
        if rel == 'MANIFEST.tsv': continue
        src = U.get(rel, 'derived text/extract of a file above (script html2txt.py) or other saved page')
        rows.append('%s\t%s\t2026-11-12\t%d\t%s' % (rel, src, os.path.getsize(p), hashlib.sha256(open(p, 'rb').read()).hexdigest()))
open(os.path.join(D, 'MANIFEST.tsv'), 'w', encoding='utf8', newline='\n').write('path\tsource\tfetched\tbytes\tsha256\n' + '\n'.join(rows) + '\n')
print(len(rows), 'files')
