"""Sculptor for the PROKARYOTE frame: a rod-shaped cell drawn as a cutaway illustration.

AN ILLUSTRATION, NOT A MEASUREMENT. The forms follow the textbook picture of a Gram-negative rod (the
plan Cupriavidus-like cells share): a three-layer envelope (outer membrane, a peptidoglycan net, inner
membrane) with a stepped cutaway window on the cell's right side, a closed, faintly tinted cytoplasm, a tangled
nucleoid, ribosomes, protein complexes studding the inner membrane, faceted microcompartments, glossy
storage granules and one polar flagellum with its hook and motor. Nothing is measured or species-specific.

Stage forms, keyed by the declared growth-phase NAME (nothing is interpolated between them):

    lag         a plump rod; a loose nucleoid; few, small granules
    growing     a slimmer rod with a division septum constricting at mid-cell, two segregating nucleoid lobes,
                the most ribosomes
    stationary  a stubby rod packed with many large granules; a condensed nucleoid; few ribosomes

Every stage spans the same length (x about -0.95..1.35, centred on the cell_body slot): the page applies the
declared length_ratio on top, so no stage size is baked in. Width:length, and every COUNT drawn (granules,
ribosomes, complexes, microcompartments) is a schematic choice for that stage form, recorded on each node's
extras under 'schematic'. A slot being sculpted here says nothing about whether this organism has it: the page
shows each slot as present, ghost or absent from the ladder (so the flagellum, which this run's chain does not
establish, is drawn by the page only as a ghost or hidden).

Page axes (lib): +x anterior, +y dorsal, +z the cell's right. The flagellum leaves the POSTERIOR (-x) pole, as
body-frames.json places it; the cutaway faces +z, the side the theatre's default camera sees.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

SIDES = ('right', 'left')
HL = 1.15            # half-length of every stage form (page units); see the docstring
CAPF = 0.92          # pole roundness: cap length / radius (1 = hemispherical)
FORM = {
    #   R: outer envelope radius; sept: mid-cell constriction depth; counts are per side;
#   gran = (mirrored pairs around a central granule, pair radius min, max, central radius)
    'lag':        dict(R=0.50, sept=0.00, ribo=280, gran=(1, 0.045, 0.06, 0.075), nuc='loose', mc=10, carb=2),
    'growing':    dict(R=0.43, sept=0.30, ribo=360, gran=(1, 0.05, 0.065, 0.08), nuc='two', mc=13, carb=3),
    'stationary': dict(R=0.58, sept=0.00, ribo=170, gran=(5, 0.10, 0.155, 0.18), nuc='condensed', mc=8, carb=2),
}
OFF = {'om': 0.0, 'pg': 0.034, 'im': 0.062, 'cyto': 0.078}   # inward offset of each layer from the outer surface
# The stepped cutaway: (x from, x to) relative to mid-cell, (angle from, angle to) measured from +z toward +y.
# Each deeper layer is cut back less, so the three layers read as terraces from the default camera.
WIN = {'om': (-0.64, 0.64, -0.42, 1.80), 'pg': (-0.53, 0.53, -0.30, 1.64), 'im': (-0.42, 0.42, -0.16, 1.48),
       'cyto': (-0.35, 0.35, -0.06, 1.38)}


# ------------------------------------------------------------------------------------------- the rod
class Rod:
    """Analytic rod shared by every part of one stage, so interior parts are placed inside the real surface."""

    def __init__(self, cx, R, sept):
        self.cx, self.R, self.sept = cx, R, sept

    def squeeze(self, x):
        return 1.0 - self.sept * math.exp(-((x - self.cx) / 0.12) ** 2)

    def r_at(self, x, off=0.0):
        R, hl = self.R - off, HL - off
        lc = R * CAPF
        u = abs(x - self.cx)
        if u >= hl:
            return 0.0
        flat = hl - lc
        r = R if u <= flat else R * math.sqrt(max(0.0, 1 - ((u - flat) / lc) ** 2))
        return r * self.squeeze(x)

    def inside(self, p, rad, off):
        """Is a sphere at page p with radius rad inside the layer at offset off (with the rod's caps)?"""
        x, y, z = p
        return math.hypot(y, z) + rad <= self.r_at(x, off) and abs(x - self.cx) + rad <= HL - off

    def rings(self, off, ncap, ncyl):
        """Meridian samples (x, r) from the posterior pole to the anterior pole, poles excluded."""
        R, hl = self.R - off, HL - off
        lc = R * CAPF
        x0, x1 = self.cx - hl, self.cx + hl
        out = []
        for k in range(1, ncap + 1):
            ph = 0.5 * math.pi * k / ncap
            out.append((x0 + lc * (1 - math.cos(ph)), R * math.sin(ph)))
        for k in range(1, ncyl):
            out.append((x0 + lc + (x1 - x0 - 2 * lc) * k / ncyl, R))
        for k in range(ncap, 0, -1):
            ph = 0.5 * math.pi * k / ncap
            out.append((x1 - lc * (1 - math.cos(ph)), R * math.sin(ph)))
        return [(x, r * self.squeeze(x)) for x, r in out], x0, x1


def shell(lib, rod, name, off, mat, sides=64, ncap=16, ncyl=44, window=None, thick=0.0, wire=0.0, twist=0.0):
    """One closed (or windowed) rod surface at inward offset `off`. window = (xa, xb, th0, th1): faces whose
    centre lies in that x range and at angle th (from +z toward +y, radians) in [th0, th1] are removed, which
    leaves a clean grid-aligned cutaway. thick > 0 solidifies inward (the cut edge shows the layer's
    thickness); wire > 0 turns the surface into a net (the peptidoglycan sacculus); twist turns each ring by
    that fraction of a facet, so the net's long lines wind as shallow helices instead of a globe's meridians."""
    rings, x0, x1 = rod.rings(off, ncap, ncyl)
    verts = [(x0, 0.0, 0.0)]
    for j, (x, r) in enumerate(rings):
        for s in range(sides):
            a = 2 * math.pi * (s + twist * j) / sides
            verts.append((x, r * math.sin(a), r * math.cos(a)))
    verts.append((x1, 0.0, 0.0))
    n, last = len(rings), len(verts) - 1
    faces = []

    def keep(idx):
        if window is None:
            return True
        xa, xb, t0, t1 = window
        c = [sum(verts[i][k] for i in idx) / len(idx) for k in range(3)]
        th = math.atan2(c[1], c[2])
        return not (xa <= c[0] <= xb and t0 <= th <= t1)

    for s in range(sides):
        f = (0, 1 + (s + 1) % sides, 1 + s)
        if keep(f):
            faces.append(f)
    for r in range(n - 1):
        a, b = 1 + r * sides, 1 + (r + 1) * sides
        for s in range(sides):
            f = (a + s, a + (s + 1) % sides, b + (s + 1) % sides, b + s)
            if keep(f):
                faces.append(f)
    ring = 1 + (n - 1) * sides
    for s in range(sides):
        f = (ring + s, ring + (s + 1) % sides, last)
        if keep(f):
            faces.append(f)
    ob = lib.mesh_object(name, verts, faces, mat)
    lib._fix_normals(ob)
    if wire > 0:
        md = ob.modifiers.new('net', 'WIREFRAME')
        md.thickness = wire
        md.use_even_offset = True
        md.use_boundary = True
        md.use_replace = True
    elif thick > 0:
        md = ob.modifiers.new('thick', 'SOLIDIFY')
        md.thickness = thick
        md.offset = -1.0
        md.use_even_offset = True
        md.use_rim = True
    return ob


# ------------------------------------------------------------------------------------------ helpers
def ico_proto(subdiv, scale=(1, 1, 1), offset=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    v = [Vector((p.co.x * scale[0] + offset[0], p.co.y * scale[1] + offset[1], p.co.z * scale[2] + offset[2])) for p in bm.verts]
    f = [tuple(q.index for q in face.verts) for face in bm.faces]
    bm.free()
    return v, f


def ribosome_proto():
    """Two fused subunits: a large one and a small one sitting on it (the textbook 70S silhouette)."""
    v1, f1 = ico_proto(0, (1.0, 0.92, 0.86))
    v2, f2 = ico_proto(0, (0.72, 0.62, 0.55), (0.0, 0.0, 0.78))
    return v1 + v2, f1 + [tuple(i + len(v1) for i in f) for f in f2]


def scatter(lib, name, centres, proto, mat, rng):
    """One joined mesh of `proto` copies at page `centres` [(p, size)], each randomly turned."""
    pv, pf = proto
    verts, faces = [], []
    for p, s in centres:
        rot = Matrix.Rotation(rng.uniform(0, 2 * math.pi), 3, Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))).normalized())
        c = lib.P(p)
        base = len(verts)
        verts.extend(c + rot @ (v * s) for v in pv)
        faces.extend(tuple(base + i for i in f) for f in pf)
    if not verts:
        return None
    return lib.mesh_object(name, [tuple(v) for v in verts], faces, mat, page=False)


def ell_d(p, c, ext):
    return sum(((p[k] - c[k]) / ext[k]) ** 2 for k in range(3))


def coil(lib, rng, centre, ext, n_ctrl, step, samples, supercoil=0.007, turns_per_unit=30.0, persist=0.82):
    """A tangled fibre: a persistent random walk (it bends smoothly, like a stiff polymer) confined to an
    ellipsoid, resampled, then wound with a fine supercoil carried on a parallel-transported frame."""
    p = Vector(centre)
    vel = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))).normalized()
    pts = [tuple(p)]
    for _ in range(n_ctrl):
        jitter = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        vel = (vel * persist + jitter * (1 - persist)).normalized()
        d = ell_d(p + vel * step, centre, ext)
        if d > 0.7:   # steer back toward the middle of the domain
            back = (Vector(centre) - p)
            back = Vector((back.x / ext[0] ** 2, back.y / ext[1] ** 2, back.z / ext[2] ** 2)).normalized()
            vel = (vel + back * (0.9 * (d - 0.55))).normalized()
        p = p + vel * step
        pts.append(tuple(p))
    sm = [Vector(q) for q in lib.catmull(pts, samples)]
    tans = []
    for i in range(len(sm)):
        t = sm[min(i + 1, len(sm) - 1)] - sm[max(i - 1, 0)]
        tans.append(t.normalized() if t.length > 1e-9 else Vector((1, 0, 0)))
    ref = Vector((0, 0, 1)) if abs(tans[0].z) < 0.9 else Vector((1, 0, 0))
    u = (ref - tans[0] * ref.dot(tans[0])).normalized()
    out, acc = [], 0.0
    for i, q in enumerate(sm):
        t = tans[i]
        u = (u - t * u.dot(t))
        u = u.normalized() if u.length > 1e-9 else u
        v = t.cross(u)
        if i:
            acc += (sm[i] - sm[i - 1]).length
        a = 2 * math.pi * turns_per_unit * acc
        out.append(tuple(q + (u * math.cos(a) + v * math.sin(a)) * supercoil))
    return out


def place_spheres(rng, rod, count, rmin, rmax, off, region, ok, tries=4000):
    """Non-overlapping spheres inside the layer at `off`, sampled in `region` (page box), filtered by ok(p, r)."""
    got = []
    (xa, xb), (ya, yb), (za, zb) = region
    for _ in range(tries):
        if len(got) >= count:
            break
        r = rng.uniform(rmin, rmax)
        p = (rng.uniform(xa, xb), rng.uniform(ya, yb), rng.uniform(za, zb))
        if not rod.inside(p, r + 0.012, off):
            continue
        if not ok(p, r):
            continue
        if any(math.dist(p, q) < r + s + 0.018 for q, s in got):
            continue
        got.append((p, r))
    return got


def note(ob, text):
    ob['schematic'] = text
    return ob


# -------------------------------------------------------------------------------------------- build
def build(spec, lib, stage):
    f = FORM.get(stage, FORM['growing'])
    rng = random.Random({'lag': 11, 'growing': 23, 'stationary': 37}.get(stage, 5))
    M = {
        'cyto': lib.material('prok.cytoplasm', base='#bfe0d4', rough=0.28, alpha=0.42, clearcoat=0.4, ior=1.37),
        'om': lib.material('prok.outer_membrane', base='#7fa9bb', rough=0.2, alpha=0.55, clearcoat=0.5, clearcoat_rough=0.12),
        'pg': lib.material('prok.peptidoglycan', base='#c8a45e', rough=0.45, sheen=0.4, sheen_tint='#fff3d6'),
        'im': lib.material('prok.inner_membrane', base='#e8a582', rough=0.3, alpha=0.55, sheen=0.5, sheen_tint='#fff0e0', clearcoat=0.4),
        'dna': lib.material('prok.nucleoid', base='#3a5590', rough=0.42, sheen=0.45, sheen_tint='#b8c8ff', clearcoat=0.2),
        'ribo': lib.material('prok.ribosome', base='#a05f86', rough=0.45, sheen=0.3),
        'carb': lib.material('prok.carboxysome', base='#79a07a', rough=0.32, clearcoat=0.5, clearcoat_rough=0.15),
        'gran': lib.material('prok.granule', base='#ddd5c3', rough=0.08, clearcoat=1.0, clearcoat_rough=0.03, sheen=0.25, sheen_tint='#fff8ec', ior=1.5),
        'mem': lib.material('prok.membrane_complex', base='#c98a32', rough=0.4, sheen=0.3, clearcoat=0.25),
        'mem2': lib.material('prok.membrane_complex_head', base='#a8652a', rough=0.4, clearcoat=0.3),
        'flag': lib.material('prok.flagellum', base='#5d6e7b', rough=0.3, clearcoat=0.6),
        'hook': lib.material('prok.flagellar_hook', base='#4f5b65', rough=0.38, clearcoat=0.4),
        'motor': lib.material('prok.flagellar_motor', base='#8d7756', rough=0.4, metal=0.1, clearcoat=0.3),
    }
    cx = lib.slot('cell_body')[0]
    R = f['R']
    rod = Rod(cx, R, f['sept'])
    x0, x1 = cx - HL, cx + HL

    # ---- cell body: the cytoplasm as a CLOSED, faintly tinted capsule just inside the inner membrane (with the
    # septum where the form has one). It is never cut: a run whose blueprint has only the cell (no envelope, no
    # contents) must show a clean rod, not a notched one. The stepped cutaway belongs to the envelope layers alone,
    # so the terraces appear only where the envelope itself is drawn.
    win = {k: (cx + w[0], cx + w[1], w[2], w[3]) for k, w in WIN.items()}
    body = shell(lib, rod, 'cell_body', OFF['cyto'], M['cyto'], sides=64, ncap=16, ncyl=44)
    lib.displace_noise(body, amount=0.004, scale=5.0, seed=2)
    lib.part(body, 'cell_body')
    note(body, 'width:length (%.2f) and the %s are a schematic %s-phase form; overall size is the page\'s declared '
         'length_ratio, not a measurement' % (2 * R / (2 * HL), 'mid-cell septum' if f['sept'] else 'rod outline', stage))

    # ---- envelope: outer membrane + peptidoglycan net + inner membrane, stepped cutaway on the right side
    om = shell(lib, rod, 'outer_membrane', OFF['om'], M['om'], sides=64, ncap=14, ncyl=44, window=win['om'], thick=0.014)
    pg = shell(lib, rod, 'peptidoglycan', OFF['pg'], M['pg'], sides=40, ncap=7, ncyl=26, window=win['pg'], wire=0.0065, twist=0.5)
    im = shell(lib, rod, 'inner_membrane', OFF['im'], M['im'], sides=56, ncap=12, ncyl=40, window=win['im'], thick=0.009)
    env = lib.join([om, pg, im], 'envelope')
    lib.part(env, 'envelope')
    note(env, 'three layers drawn as a textbook Gram-negative envelope; layer spacing is exaggerated so each reads, '
         'and the cutaway window is an illustration convention')

    # ---- nucleoid
    cyo = OFF['cyto']
    nx, ny, nz = lib.slot('nucleoid')
    Rc = R - cyo
    if f['nuc'] == 'two':
        lobes = [((cx - 0.5, ny, 0.0), (0.36, Rc * 0.58, Rc * 0.58)), ((cx + 0.5, ny, 0.0), (0.36, Rc * 0.58, Rc * 0.58))]
        n_ctrl, step, persist = 520, 0.017, 0.7
    elif f['nuc'] == 'condensed':
        lobes = [((nx, ny, 0.0), (0.32, Rc * 0.36, Rc * 0.36))]
        n_ctrl, step, persist = 640, 0.013, 0.66
    else:
        lobes = [((nx, ny, 0.0), (0.62, Rc * 0.55, Rc * 0.55))]
        n_ctrl, step, persist = 760, 0.019, 0.72
    strands = []
    for c, ext in lobes:
        pts = coil(lib, rng, c, ext, n_ctrl, step, samples=1100 if len(lobes) == 2 else 1900, supercoil=0.005, persist=persist)
        strands.append(lib.tube('nucleoid_strand', pts, 0.009, M['dna'], sides=5, samples=len(pts), cap=True))
    dna = lib.join(strands, 'nucleoid')
    lib.part(dna, 'nucleoid')
    note(dna, 'the fibre is a confined random walk wound with a fine supercoil: no sequence, no topology and no measured '
         'compaction; %s for the %s form' % ({'two': 'two segregating lobes', 'condensed': 'a condensed body',
                                              'loose': 'one loose domain'}[f['nuc']], stage))

    def in_nucleoid(p, pad):
        return any(ell_d(p, c, (e[0] + pad, e[1] + pad, e[2] + pad)) < 1 for c, e in lobes)

    # ---- storage granules (PHA-like): glossy, nearly white, several sizes
    gran_all = {}
    n_pairs, gmin, gmax, g0 = f['gran']
    SQ = 1.05            # the largest squash a granule gets below, so the no-overlap test holds for the drawn shape
    GAP = 0.012          # clear space between two granules' surfaces

    def clear(c, r, placed):
        return all(math.dist(c, o) >= (r + t) * SQ + GAP for o, t in placed)
    for s in SIDES:
        k = lib.side_sign(s)
        gx, gy, gz = lib.slot('storage_granule', s)
        # A central granule at an anchor (the slot, for the sparse forms), and mirrored pairs around it, so the
        # node's bounding-box centre (where the page aims a click and a label) always falls on a granule.
        anchor = (gx, gy, gz) if stage != 'stationary' else (cx - 0.05, 0.04, k * 0.24)
        other = [q for side in SIDES if side != s for q in gran_all.get(side, [])]
        r0 = g0
        while (not rod.inside(anchor, r0 + 0.012, cyo) or not clear(anchor, r0, other)) and r0 > 0.03:
            r0 *= 0.9
        got = [(anchor, r0)]
        tries = 0
        while len(got) < 1 + 2 * n_pairs and tries < 4000:
            tries += 1
            r = rng.uniform(gmin, gmax)
            p = (anchor[0] + rng.uniform(-0.95, 0.95), anchor[1] + rng.uniform(-0.32, 0.32), anchor[2] + rng.uniform(-0.2, 0.2))
            q = tuple(2 * anchor[i] - p[i] for i in range(3))
            if math.dist(p, q) < 2 * r * SQ + GAP:
                continue
            good = True
            for c in (p, q):
                if (not rod.inside(c, r * SQ + 0.012, cyo) or in_nucleoid(c, r * 0.3) or k * c[2] < r * 0.3
                        or (f['sept'] and abs(c[0] - cx) < r + 0.08) or not clear(c, r, got + other)):
                    good = False
                    break
            if good:
                got += [(p, r), (q, r)]
        gran_all[s] = got
        objs = []
        for i, (p, r) in enumerate(got):
            if i % 2 == 1 or i == 0:   # a mirrored pair shares its slight squash, keeping the cluster centred
                j = [r * rng.uniform(0.94, 1.05) for _ in range(3)]
            objs.append(lib.ellipsoid('granule', p, j, M['gran'], segments=28, rings=16))
        g = lib.join(objs, 'storage_granule')
        lib.part(g, 'storage_granule', s)
        note(g, '%d granule(s) drawn on this side: a schematic count and size for the %s form, not counted or sized '
             'from any cell' % (len(got), stage))

    # ---- carboxysomes: faceted icosahedral microcompartments, near the slot (anterior, ventral)
    carb_all = {}
    for s in SIDES:
        k = lib.side_sign(s)
        ax_, ay, az = lib.slot('carboxysome', s)
        region = ((ax_ - 0.32, ax_ + 0.32), (-Rc, Rc * 0.3), (0.02, Rc) if k > 0 else (-Rc, -0.02))
        taken = gran_all[s] + gran_all['left' if s == 'right' else 'right']
        got = place_spheres(rng, rod, f['carb'], 0.055, 0.072, cyo, region,
                            lambda p, r: not in_nucleoid(p, r * 0.5) and all(math.dist(p, q) > r + t + 0.02 for q, t in taken)
                            and (not f['sept'] or abs(p[0] - cx) > r + 0.08))
        carb_all[s] = got
        objs = []
        for p, r in got:
            o = lib.icosphere('carboxysome', (0.0, 0.0, 0.0), r, M['carb'], subdiv=0)
            o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons))
            turn = Matrix.Rotation(rng.uniform(0, 6.3), 3, Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 1.0)).normalized())
            for v in o.data.vertices:
                v.co = turn @ v.co
            lib.move(o, *p)
            bv = o.modifiers.new('bevel', 'BEVEL')
            bv.width = r * 0.09
            bv.segments = 2
            bv.limit_method = 'NONE'
            objs.append(o)
        c = lib.join(objs, 'carboxysome')
        c.data.polygons.foreach_set('use_smooth', [False] * len(c.data.polygons))
        lib.part(c, 'carboxysome', s)
        note(c, '%d microcompartment(s) on this side: a schematic count; the faceted shell is the textbook picture' % len(got))

    # ---- ribosomes: many small two-subunit granules through the cytoplasm, kept out of the nucleoid
    blockers = [q for s in SIDES for q in gran_all[s] + carb_all[s]]
    proto = ribosome_proto()
    for s in SIDES:
        k = lib.side_sign(s)
        cen, tries = [], 0
        while len(cen) < f['ribo'] and tries < f['ribo'] * 60:
            tries += 1
            p = (rng.uniform(x0, x1), rng.uniform(-Rc, Rc), k * rng.uniform(0.0, Rc))
            sz = rng.uniform(0.010, 0.0135)
            if not rod.inside(p, sz + 0.01, cyo) or in_nucleoid(p, 0.0):
                continue
            if any(math.dist(p, q) < r + sz + 0.005 for q, r in blockers):
                continue
            cen.append((p, sz))
        rb = scatter(lib, 'ribosome', cen, proto, M['ribo'], rng)
        lib.part(rb, 'ribosome', s)
        note(rb, '%d ribosomes drawn on this side: a schematic density for the %s form (a real cell holds thousands '
             'to tens of thousands)' % (len(cen), stage))

    # ---- membrane complexes: protein clusters embedded in the inner membrane, dorsal-lateral as the slot puts them
    im_r = lambda x: rod.r_at(x, OFF['im'] + 0.005)
    for s in SIDES:
        k = lib.side_sign(s)
        objs, placed, tries = [], [], 0
        while len(placed) < f['mc'] and tries < 600:
            tries += 1
            x = rng.uniform(x0 + 0.3, x1 - 0.3)
            if f['sept'] and abs(x - cx) < 0.16:
                continue
            th = rng.uniform(0.15, 1.45)
            if any(abs(x - a) < 0.09 and abs(th - b) < 0.28 for a, b in placed):
                continue
            w = win['im']   # only where the inner membrane is still there (the right side carries the cutaway)
            if k > 0 and w[0] - 0.03 <= x <= w[1] + 0.03 and w[2] - 0.1 <= th <= w[3] + 0.1:
                continue
            placed.append((x, th))
            r = im_r(x)
            nrm = Vector((0.0, math.sin(th), k * math.cos(th)))
            tan = Vector((1.0, 0.0, 0.0))
            bit = nrm.cross(tan)
            base = Vector((x, 0.0, 0.0)) + nrm * r
            kind = len(placed) % 3
            if kind == 0:   # ATP-synthase-like: membrane ring, stalk, and a head in the cytoplasm
                ring = lib.ellipsoid('cx_ring', tuple(base), (0.024, 0.024, 0.024), M['mem'], segments=14, rings=8)
                lib.transform(ring, lambda q, b=base, n=nrm: tuple(Vector(q) - n * (Vector(q) - b).dot(n) * 0.45))
                stalk = lib.tube('cx_stalk', [tuple(base - nrm * 0.01), tuple(base - nrm * 0.045)], 0.0065, M['mem'], sides=8, samples=4)
                head = lib.ellipsoid('cx_head', tuple(base - nrm * 0.068), (0.027, 0.027, 0.027), M['mem2'], segments=14, rings=9)
                objs += [ring, stalk, head]
            else:           # respiratory / hydrogenase-like complexes: fused lobes spanning the membrane
                balls = [(tuple(base), 0.022), (tuple(base + tan * 0.026 + nrm * 0.006), 0.017),
                         (tuple(base - bit * 0.02 - nrm * 0.012), 0.016)]
                if kind == 1:   # an L-shaped arm reaching into the cytoplasm
                    balls += [(tuple(base - nrm * 0.035 - tan * 0.012), 0.016), (tuple(base - nrm * 0.058 - tan * 0.02), 0.015)]
                objs.append(lib.blob('cx_blob', balls, M['mem'], resolution=0.0075))
        m = lib.join(objs, 'membrane_complex')
        lib.part(m, 'membrane_complex', s)
        note(m, '%d complexes on this side: schematic shapes and a schematic count, embedded in the inner membrane' % len(placed))

    # ---- flagellum: motor in the envelope at the posterior pole, a curved hook, then a smooth helical filament
    px = x0
    hook_pts = [(px + 0.02, 0.0, 0.0), (px - 0.04, 0.004, 0.0), (px - 0.09, 0.022, 0.008), (px - 0.13, 0.05, 0.02)]
    hook = lib.tube('hook', hook_pts, [0.021, 0.021, 0.020, 0.018], M['hook'], sides=12, samples=24)
    start = Vector(hook_pts[-1])
    t_end = (Vector(hook_pts[-1]) - Vector(hook_pts[-2])).normalized()
    axis = Vector((-1.0, -0.03, 0.02)).normalized()
    u = (t_end - axis * t_end.dot(axis))
    u = u.normalized() if u.length > 1e-6 else Vector((0, 1, 0))
    v = axis.cross(u)
    # 1.2 long: the filament ends near x = -2.3, inside the theatre's fitted view (1.55 ran off the canvas)
    length, rad_h, turns, nh = 1.2, 0.08, 1.6, 120
    hel = []
    for i in range(nh):
        t = i / (nh - 1)
        ramp = 1 - (1 - min(1.0, t / 0.22)) ** 2          # the coil opens smoothly out of the hook
        a = 2 * math.pi * turns * t
        q = start + axis * (length * t) + (u * math.sin(a) + v * (1 - math.cos(a))) * rad_h * ramp
        hel.append(tuple(q))
    rad = [0.0175 - 0.005 * (i / (nh - 1)) ** 2 for i in range(nh)]
    fil = lib.tube('filament', [hook_pts[-2]] + hel, [0.0185] + rad, M['flag'], sides=10, samples=560)
    fl = lib.join([hook, fil], 'flagellum')
    lib.part(fl, 'flagellum')
    note(fl, 'one polar filament is the frame\'s textbook plan; helix pitch, radius and length are schematic. Drawn by '
         'the page only where the blueprint has a flagellum (a ghost where only the literature names one)')
    motor = []
    for dx, r, t in ((0.075, 0.032, 0.008), (0.045, 0.026, 0.006), (0.018, 0.024, 0.006)):
        motor.append(lib.lathe('motor_ring', [(px + dx - t, r * 0.6, r * 0.6), (px + dx - t * 0.5, r, r), (px + dx + t * 0.5, r, r),
                                              (px + dx + t, r * 0.6, r * 0.6)], M['motor'], sides=20, samples=8, subdiv=0))
    motor.append(lib.tube('motor_rod', [(px + 0.09, 0.0, 0.0), (px + 0.01, 0.0, 0.0)], 0.009, M['motor'], sides=8, samples=4))
    mot = lib.join(motor, 'motor')
    lib.deco(mot, fl, 'motor')
