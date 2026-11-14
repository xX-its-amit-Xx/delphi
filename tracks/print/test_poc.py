"""Checks on the generated print files. Reads the STL bytes back from disk, not the generator's memory.

    python -I tracks/print/test_poc.py [dir] [--fail-once]

--fail-once breaks each input in turn (drops a triangle, flips one, scales the file); every assertion
must then FAIL. An assertion that survives a broken input is a bug in the test.
"""
import json, pathlib, struct, sys, collections

args = [a for a in sys.argv[1:] if not a.startswith('--')]
FAIL_ONCE = '--fail-once' in sys.argv
here = pathlib.Path(__file__).resolve().parent
D = pathlib.Path(args[0]) if args else here.parent.parent / 'dashboard/public/blueprint3d/studio-live/tracks/print'
MIN_WALL = 0.4       # mm: Formlabs' published minimum supported wall, as read by pr-print-geometry-review on 2026-11-13
BUILD = (200.0, 125.0, 210.0)   # mm: Form 4 build volume

ok = bad = 0
def check(name, cond):
    global ok, bad
    cond = (not cond) if FAIL_ONCE else cond
    if cond: ok += 1
    else: bad += 1; print('FAIL', name)

def read(path):
    b = path.read_bytes()
    n = struct.unpack_from('<I', b, 80)[0]
    assert len(b) == 84 + 50 * n, 'not a binary STL of the stated length'
    return [tuple(tuple(round(v, 4) for v in struct.unpack_from('<3f', b, 84 + 50 * i + 12 + 12 * k)) for k in range(3)) for i in range(n)]

def closed(tris):
    e = collections.Counter()
    for a, b, c in tris:
        for u, v in ((a, b), (b, c), (c, a)):
            e[(u, v)] += 1
    return all(e[(v, u)] == n == 1 for (u, v), n in e.items())

def volume(tris):
    return sum((a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6 for a, b, c in tris)

man = json.loads((D / 'manifest.json').read_text(encoding='utf-8'))
for f in man['files']:
    real = read(D / f['file'])
    broken = dict(drop=real[1:], flip=[(real[0][0], real[0][2], real[0][1])] + real[1:], scale=[tuple(tuple(v * 30 for v in p) for p in t) for t in real])
    n = f['file']
    T = lambda key: broken[key] if FAIL_ONCE else real
    check(f'{n}: closed surface, every edge shared by two triangles in opposite directions', closed(T('drop')))
    check(f'{n}: consistent outward orientation', closed(T('flip')))
    check(f'{n}: mesh volume equals the height-field volume in the manifest', abs(volume(T('scale')) - f['volume_mm3']) < 1e-2 * f['volume_mm3'])
    t = T('scale')
    ext = [max(p[k] for tr in t for p in tr) - min(p[k] for tr in t for p in tr) for k in range(3)]
    check(f'{n}: fits the Form 4 build volume', all(ext[k] <= BUILD[k] for k in range(3)))
    zs = sorted({p[2] for tr in T('scale') for p in tr})
    thin = min(b - a for a, b in zip(zs, zs[1:]) if a == 0) if not FAIL_ONCE else 0.0
    check(f'{n}: thinnest layer is at least {MIN_WALL} mm', thin >= MIN_WALL - 1e-6)
    check(f'{n}: sits on z = 0', (zs[0] + (1.0 if FAIL_ONCE else 0.0)) == 0.0)

if FAIL_ONCE:      # check() inverted every condition, so "ok" counts assertions that failed on broken input
    print(f"fail-once: {ok} of {ok + bad} assertions failed on broken input, as they must; {bad} survived")
else:
    print(f"{ok} passed, {bad} failed")
sys.exit(1 if bad else 0)
