"""Generate the Formlabs proof-of-concept print files for the hygromorphic bilayer biomaterial concept.

    python -I tracks/print/make_poc.py [out_dir]

Writes binary STL files (millimetres, flat on z = 0), a top-view SVG per plate,
and manifest.json with every dimension, the volume, triangle count and sha256 of each file.
No dependencies beyond the standard library. Same input, same bytes.

TWO ROUTES, FOUR FILES. A resin printer cures one resin per print.
Route 1, the new material: print ONE plate and dip one face in a crosslinker. The dipped face swells
less, so the single print behaves as a bilayer with no glue line.
  single-print-plate.stl
Route 2, stock resins, to test the law before the new material exists: print two plates and bond them:
  active-plate.stl   the layer that swells in water      (stock stand-in: Flexible 80A V2;
                                                          target: the new crosslinked bio-based resin)
  passive-plate.stl  the layer that does not              (Flexible 50A / Silicone 40A)
  bonding-jig.stl    a rigid plate with square pins that register the two plates while they bond

WHAT IS ON EACH PLATE (same layout on both, so part k on one plate bonds to part k on the other)
  A. six free coupons 30 x 3 mm       experiment 0: measure each layer's own swelling strain first
  B. three strips 30 x 3 mm + tab     object 1: one curvature, compared with kappa = f(m,n) * d_eps / h
  C. a ladder of ten fingers           object 2: active thickness steps from 0.20 to 0.80 mm, which walks
                                       the thickness ratio m through the optimum the Lean theorem predicts
  D. a five-blade louvre tile          the architectural concept: blades 40 x 8 mm that open when wet

HOW THE MESH IS BUILT. Every part is a set of axis-aligned boxes standing on z = 0. The plate is a
height field on the grid made by all box edges; faces are emitted per grid cell and walls are split at
every height level, so neighbouring faces always share whole edges. test_poc.py checks the result is a
closed surface (every edge used by exactly two triangles, in opposite directions) and that the mesh
volume equals the sum of cell area x height.
"""
import hashlib, json, pathlib, struct, sys

# mm. The design note (tracks/research/agents/bm-poc-designs.json) used 0.4 / 0.6 mm layers and 0.2 mm fingers.
# Those are under Formlabs' published 0.4 mm supported-wall minimum (tracks/research/agents/pr-print-geometry-review.json),
# so every thickness is doubled here. The thickness RATIO, which is what the law depends on, is unchanged; the price is
# half the curvature and about four times the response time (time goes as thickness squared).
ACTIVE_T, PASSIVE_T, SPINE_T = 0.80, 1.20, 1.60
MONO_T = ACTIVE_T + PASSIVE_T                              # single-print plate: full thickness, one face dipped in crosslinker
MONO_LADDER = [round(1.0 + i * (1.5 / 9), 3) for i in range(10)]   # 1.0 ... 2.5 mm: tests curvature proportional to 1/h
LADDER_T = [round(0.40 + i * (1.20 / 9), 3) for i in range(10)]   # 0.40 ... 1.60 mm active thickness
HOLE, PIN, PIN_H, JIG_T = 2.0, 1.8, 2.5, 2.0              # square registration holes and pins (0.1 mm clearance a side)


class Plate:
    def __init__(self):
        self.boxes, self.holes = [], []

    def box(self, x, y, w, d, h):
        self.boxes.append((round(x, 4), round(y, 4), round(x + w, 4), round(y + d, 4), h))

    def hole(self, cx, cy, s=HOLE):
        self.holes.append((round(cx - s / 2, 4), round(cy - s / 2, 4), round(cx + s / 2, 4), round(cy + s / 2, 4)))

    def field(self):
        xs = sorted({v for b in self.boxes for v in (b[0], b[2])} | {v for b in self.holes for v in (b[0], b[2])})
        ys = sorted({v for b in self.boxes for v in (b[1], b[3])} | {v for b in self.holes for v in (b[1], b[3])})
        H = [[0.0] * (len(ys) - 1) for _ in range(len(xs) - 1)]
        for i in range(len(xs) - 1):
            cx = (xs[i] + xs[i + 1]) / 2
            for j in range(len(ys) - 1):
                cy = (ys[j] + ys[j + 1]) / 2
                h = max([b[4] for b in self.boxes if b[0] < cx < b[2] and b[1] < cy < b[3]] or [0.0])
                if any(b[0] < cx < b[2] and b[1] < cy < b[3] for b in self.holes):
                    h = 0.0
                H[i][j] = h
        return xs, ys, H

    def triangles(self):
        xs, ys, H = self.field()
        nx, ny = len(xs) - 1, len(ys) - 1
        zs = sorted({0.0} | {h for col in H for h in col})
        T = []

        def quad(a, b, c, d):                      # counter-clockwise seen from outside
            T.append((a, b, c)); T.append((a, c, d))

        def h(i, j):
            return H[i][j] if 0 <= i < nx and 0 <= j < ny else 0.0

        for i in range(nx):
            for j in range(ny):
                z = H[i][j]
                x0, x1, y0, y1 = xs[i], xs[i + 1], ys[j], ys[j + 1]
                if z > 0:
                    quad((x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z))          # top, normal +z
                    quad((x0, y0, 0), (x0, y1, 0), (x1, y1, 0), (x1, y0, 0))          # bottom, normal -z
        # walls between a cell and its +x / +y neighbour (including the outside), split at every height level
        for i in range(-1, nx):
            for j in range(ny):
                a, b = h(i, j), h(i + 1, j)
                if a == b:
                    continue
                x, y0, y1 = xs[i + 1], ys[j], ys[j + 1]
                lo, hi = min(a, b), max(a, b)
                for k in range(len(zs) - 1):
                    if zs[k] >= lo and zs[k + 1] <= hi:
                        z0, z1 = zs[k], zs[k + 1]
                        if a > b:   # solid on the -x side, normal +x
                            quad((x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1))
                        else:
                            quad((x, y0, z0), (x, y0, z1), (x, y1, z1), (x, y1, z0))
        for i in range(nx):
            for j in range(-1, ny):
                a, b = h(i, j), h(i, j + 1)
                if a == b:
                    continue
                y, x0, x1 = ys[j + 1], xs[i], xs[i + 1]
                lo, hi = min(a, b), max(a, b)
                for k in range(len(zs) - 1):
                    if zs[k] >= lo and zs[k + 1] <= hi:
                        z0, z1 = zs[k], zs[k + 1]
                        if a > b:   # solid on the -y side, normal +y
                            quad((x0, y, z0), (x0, y, z1), (x1, y, z1), (x1, y, z0))
                        else:
                            quad((x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1))
        return T

    def volume(self):
        xs, ys, H = self.field()
        return sum((xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]) * H[i][j] for i in range(len(xs) - 1) for j in range(len(ys) - 1))


def layout(kind):
    """kind: 'active' | 'passive' | 'mono' | 'jig'. Returns (Plate, parts list for the manifest)."""
    p, parts = Plate(), []
    t = {'active': ACTIVE_T, 'mono': MONO_T}.get(kind, PASSIVE_T)
    spine = MONO_LADDER[-1] if kind == 'mono' else SPINE_T
    pins = []
    # A. six free coupons (not on the jig: they are measured unbonded)
    for k in range(6):
        if kind != 'jig':
            p.box(0, k * 5.0, 30, 3, t)
    parts.append(dict(part='A free coupons', n=6, size_mm=[30, 3, t], purpose='experiment 0: free swelling strain of this layer'))
    # B. three strips with a 6 x 6 tab and one registration hole
    for k in range(3):
        y = 32 + k * 8.0
        if kind != 'jig':
            p.box(0, y, 6, 6, spine); p.box(6, y + 1.5, 30, 3, t); p.hole(3, y + 3)
        pins.append((3, y + 3))
    parts.append(dict(part='B strips', n=3, size_mm=[30, 3, t], tab_mm=[6, 6, spine], purpose='object 1: single bilayer strip'))
    # C. ladder of ten fingers on a spine
    x0 = 42.0
    if kind != 'jig':
        p.box(x0, 0, 6, 57, spine)
        for k in range(10):
            p.box(x0 + 6, k * 6.0, 30, 3, {'active': LADDER_T, 'mono': MONO_LADDER}.get(kind, [PASSIVE_T] * 10)[k])
        p.hole(x0 + 3, 4); p.hole(x0 + 3, 53)
    pins += [(x0 + 3, 4), (x0 + 3, 53)]
    parts.append(dict(part='C ladder', n=10, finger_mm=[30, 3], thickness_mm={'active': LADDER_T, 'mono': MONO_LADDER}.get(kind, [PASSIVE_T] * 10),
                      purpose='total thickness stepped: curvature should fall as 1/h' if kind == 'mono' else 'object 2: thickness ratio m swept through the predicted optimum'))
    # D. louvre tile: five blades 40 x 8 on a spine
    x1 = 84.0
    if kind != 'jig':
        p.box(x1, 0, 6, 48, spine)
        for k in range(5):
            p.box(x1 + 6, k * 10.0, 40, 8, t)
        p.hole(x1 + 3, 4); p.hole(x1 + 3, 44)
    pins += [(x1 + 3, 4), (x1 + 3, 44)]
    parts.append(dict(part='D louvre tile', n=5, blade_mm=[40, 8, t], purpose='architectural concept: blades curl open when wet'))
    if kind == 'jig':
        p.box(-2, -2, 136, 62, JIG_T)
        for (cx, cy) in pins:
            p.box(cx - PIN / 2, cy - PIN / 2, PIN, PIN, JIG_T + PIN_H)
        parts = [dict(part='bonding jig', base_mm=[136, 62, JIG_T], pins=len(pins), pin_mm=[PIN, PIN, PIN_H],
                      hole_mm=HOLE, clearance_per_side_mm=round((HOLE - PIN) / 2, 3))]
    return p, parts


def write_stl(path, tris, name):
    with open(path, 'wb') as f:
        f.write(name.encode().ljust(80, b' ')[:80])
        f.write(struct.pack('<I', len(tris)))
        for a, b, c in tris:
            ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
            n = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
            l = (n[0] ** 2 + n[1] ** 2 + n[2] ** 2) ** 0.5 or 1.0
            f.write(struct.pack('<12fH', n[0] / l, n[1] / l, n[2] / l, *a, *b, *c, 0))


RESIN = {'mono': 'the new crosslinkable bio-based resin, printed once; one face is then dipped in crosslinker (stock stand-in: Flexible 80A V2)',
         'active': 'Flexible 80A V2 (stand-in for the new crosslinked bio-based resin)',
         'passive': 'Flexible 50A or Silicone 40A', 'jig': 'any rigid resin (Grey V5, Rigid 10K)'}


def main(out):
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    man = dict(units='mm', orientation='flat on z = 0 as modelled; the print orientation is chosen in PreForm',
               source='tracks/print/make_poc.py', law='kappa = f(m,n) * d_eps / h, ceiling 3/2 at m^2 n = 1 (tracks/lean/HygromorphCeilingCheck.lean)',
               files=[])
    for kind in ('mono', 'active', 'passive', 'jig'):
        p, parts = layout(kind)
        tris = p.triangles()
        name = {'mono': 'single-print-plate', 'active': 'active-plate', 'passive': 'passive-plate', 'jig': 'bonding-jig'}[kind]
        path = out / f'{name}.stl'
        write_stl(path, tris, f'DELPHI hygromorph PoC {name} mm')
        xs, ys, H = p.field()
        heights = sorted({h for col in H for h in col if h > 0})
        man['files'].append(dict(file=path.name, resin=RESIN[kind], triangles=len(tris), bytes=path.stat().st_size,
                                 sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                                 bbox_mm=[round(xs[-1] - xs[0], 3), round(ys[-1] - ys[0], 3), heights[-1]],
                                 volume_mm3=round(p.volume(), 3), thinnest_feature_mm=heights[0], parts=parts))
        # top-view picture, plain SVG so it needs no plotting library: darker = thicker
        sc, pad = 6.0, 4.0
        W, Hh = (xs[-1] - xs[0] + 2 * pad) * sc, (ys[-1] - ys[0] + 2 * pad) * sc
        r = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {Hh:.0f}" role="img" aria-label="{name} top view">',
             f'<rect width="{W:.0f}" height="{Hh:.0f}" fill="#f4f1ea"/>']
        for i in range(len(xs) - 1):
            for j in range(len(ys) - 1):
                if H[i][j] > 0:
                    g = int(205 - 150 * H[i][j] / heights[-1])
                    r.append(f'<rect x="{(xs[i] - xs[0] + pad) * sc:.1f}" y="{(ys[-1] - ys[j + 1] + pad) * sc:.1f}" '
                             f'width="{(xs[i + 1] - xs[i]) * sc + 0.4:.1f}" height="{(ys[j + 1] - ys[j]) * sc + 0.4:.1f}" fill="rgb({g - 40},{g},{g - 15})"/>')
        r.append(f'<text x="8" y="16" font-family="sans-serif" font-size="12" fill="#333">{name}: {xs[-1] - xs[0]:.0f} x {ys[-1] - ys[0]:.0f} mm, thickness {heights[0]} to {heights[-1]} mm (darker = thicker)</text></svg>')
        (out / f'{name}.svg').write_text(chr(10).join(r), encoding='utf-8', newline=chr(10))
    (out / 'manifest.json').write_text(json.dumps(man, indent=1), encoding='utf-8', newline='\n')
    for f in man['files']:
        print(f"{f['file']:20s} {f['triangles']:6d} tris  bbox {f['bbox_mm']}  vol {f['volume_mm3']} mm3  thinnest {f['thinnest_feature_mm']} mm")


if __name__ == '__main__':
    here = pathlib.Path(__file__).resolve().parent
    main(sys.argv[1] if len(sys.argv) > 1 else here.parent.parent / 'dashboard/public/blueprint3d/studio-live/tracks/print')
