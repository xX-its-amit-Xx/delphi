"""File-naming and data-logging convention for the bilayer swelling pilot (experiment id BM1). Standard library only.
usage:  python -I naming.py selftest            run built-in positive and negative tests
        python -I naming.py check FILE...       validate file names (exit 1 if any fail)
        python -I naming.py log-check CSV       validate a measurements CSV against the schema
        python -I naming.py manifest DIR        write SHA256 manifest (MANIFEST.tsv) for every file under DIR

FILE NAME  BM1_<batch>_<specimen>_<kind>_<cond>_<elapsed>_<utc>.<ext>
  batch    P<2 digits>        print job number (one resin per job on Form 4)
  specimen S<3 digits>        unique within batch; bilayers use B<3 digits>
  kind     MASS | IMG | SCN | EDG | RHL | NOTE      (mass, camera image, scanner image, cut-edge microscope image, humidity log, note)
  cond     DRY | R<2 digits> | H2O | IPA | PRE | WSH      DRY=dry reference jar, R33/R75/R97 = salt-jar % RH, H2O immersion, IPA=wash,
           PRE=pre-leach soak, WSH=after wash
  elapsed  t<4 digits>h        whole hours since the start of that condition (t0000h = start)
  utc      YYYYMMDDTHHMMSSZ    time of the reading, UTC, never local
  ext      csv | json | dng | tif | png | txt
LOG COLUMNS (one row per reading, UTF-8, comma separated, header required, LF line ends):
  utc,batch,specimen,quantity,value,unit,uncertainty,instrument,operator_code,rh_pct,temp_c,note
  quantity in {mass,length,width,thickness_edge,tip_deflection,radius,shore,rh,temp}; unit in {mg,g,mm,um,1/m,degC,%RH}"""
import re, sys, csv, os, hashlib
NAME = re.compile(r'^BM1_P\d{2}_[SB]\d{3}_(MASS|IMG|SCN|EDG|RHL|NOTE)_(DRY|R\d{2}|H2O|IPA|PRE|WSH)_t\d{4}h_\d{8}T\d{6}Z\.(csv|json|dng|tif|png|txt)$')
QUANT = {'mass', 'length', 'width', 'thickness_edge', 'tip_deflection', 'radius', 'shore', 'rh', 'temp'}
UNITS = {'mg', 'g', 'mm', 'um', '1/m', 'degC', '%RH', 'ShoreA'}
HEAD = ['utc', 'batch', 'specimen', 'quantity', 'value', 'unit', 'uncertainty', 'instrument', 'operator_code', 'rh_pct', 'temp_c', 'note']
UTC = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
def check_name(n):
    return bool(NAME.match(os.path.basename(n)))
def check_log(path):
    errs = []
    raw = open(path, 'rb').read()
    if b'\r\n' in raw: errs.append('CRLF line ends')
    rows = list(csv.reader(raw.decode('utf8').splitlines()))
    if not rows or rows[0] != HEAD: errs.append('header differs from schema'); return errs
    for i, r in enumerate(rows[1:], 2):
        if len(r) != len(HEAD): errs.append('line %d: %d fields' % (i, len(r))); continue
        d = dict(zip(HEAD, r))
        if not UTC.match(d['utc']): errs.append('line %d: utc not ISO-8601 Z' % i)
        if d['quantity'] not in QUANT: errs.append('line %d: quantity %r' % (i, d['quantity']))
        if d['unit'] not in UNITS: errs.append('line %d: unit %r' % (i, d['unit']))
        for f in ('value', 'uncertainty'):
            try: float(d[f])
            except ValueError: errs.append('line %d: %s not a number' % (i, f))
    return errs
def manifest(d):
    out = []
    for root, _, files in os.walk(d):
        for f in sorted(files):
            if f == 'MANIFEST.tsv': continue
            p = os.path.join(root, f)
            h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
            out.append('%s\t%d\t%s' % (os.path.relpath(p, d).replace(os.sep, '/'), os.path.getsize(p), h))
    open(os.path.join(d, 'MANIFEST.tsv'), 'w', encoding='utf8', newline='\n').write('path\tbytes\tsha256\n' + '\n'.join(out) + '\n')
    return len(out)
def selftest():
    good = ['BM1_P01_S003_IMG_H2O_t0024h_20261113T143000Z.dng', 'BM1_P02_B012_MASS_DRY_t0000h_20261112T090000Z.csv', 'BM1_P01_S001_EDG_PRE_t0048h_20261114T101500Z.tif']
    bad = ['BM1_P1_S003_IMG_H2O_t0024h_20261113T143000Z.dng',          # batch needs 2 digits
           'BM1_P01_S003_IMG_H2O_t24h_20261113T143000Z.dng',          # elapsed needs 4 digits
           'BM1_P01_S003_IMG_H2O_t0024h_2026-11-13T14:30:00Z.dng',    # utc must be compact
           'BM1_P01_S003_IMG_WATER_t0024h_20261113T143000Z.dng',      # unknown condition
           'bm1_P01_S003_IMG_H2O_t0024h_20261113T143000Z.dng',        # case
           'BM1_P01_S003_IMG_H2O_t0024h_20261113T143000Z.jpg']        # ext not allowed
    for n in good: assert check_name(n), n
    for n in bad: assert not check_name(n), n
    import tempfile
    t = tempfile.mkdtemp()
    g = os.path.join(t, 'ok.csv'); b = os.path.join(t, 'bad.csv')
    open(g, 'w', newline='\n').write(','.join(HEAD) + '\n2026-11-12T09:00:00Z,P01,S003,mass,174.3,mg,0.05,BAL1,AB,33.1,22.4,synthetic example\n')
    open(b, 'w', newline='\n').write(','.join(HEAD) + '\n12/11/2026 9:00,P01,S003,weight,abc,grams,0.05,BAL1,AB,33.1,22.4,\n')
    assert check_log(g) == [], check_log(g)
    e = check_log(b); assert len(e) >= 4, e      # the check must be able to fail
    print('selftest ok: %d good names pass, %d bad names fail, good log passes, bad log fails with %d errors' % (len(good), len(bad), len(e)))
if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(2)
    if a[0] == 'selftest': selftest()
    elif a[0] == 'check':
        bad = [n for n in a[1:] if not check_name(n)]
        for n in bad: print('BAD NAME', n)
        sys.exit(1 if bad else 0)
    elif a[0] == 'log-check':
        e = check_log(a[1]); print('\n'.join(e) or 'log ok'); sys.exit(1 if e else 0)
    elif a[0] == 'manifest': print(manifest(a[1]), 'files hashed')
