"""Sculptor for the CONSTRUCT frame: cells assembled into a shape the donor organism never makes (a xenobot).

AN ILLUSTRATION, NOT MORPHOMETRY. The construct frame (sim-engine/scales/body-frames.json) declares a
spheroid with one ciliated face, an interior and paired contractile regions; that is all this draws, in the
manner of a textbook or museum model. Nothing here is measured, and nothing is taken from the donor's body
plan (that would be the exact error the construct frame exists to refuse).

What each slot is drawn as (all schematic):
  surface      the outer epidermis: one spheroid tiled with polygonal cells (a spherical Voronoi pattern,
               each cell a soft dome, the boundaries a shallow groove; a few smaller intercalated cells stand
               for the textbook epidermis's ionocytes and small secretory cells). Multiciliated cells sit singly among
               the others, salt-and-pepper, on the ventral (-y) face only -- the frame's "one ciliated face" --
               each with a tuft of a dozen long, tapered cilia. The multiciliated cells and the cilia are two
               SEPARATE pieces (deco:surface:mcc_cells over an intact base surface, deco:surface:cilia), each
               carrying extras.requires = MCC_REQUIRES, so the page draws them by the state of the multiciliated
               cell in the ladder (solid / violet ghost / hidden), never by the surface slot's state. The cilia are frozen at schematic phases of a metachronal wave
               running along x: the textbook beat, an extended power stroke toward -x and a curled recovery
               stroke close to the surface. Cell count, cell size, tuft size and cilium length are
               exaggerated for legibility (a real 0.5-1 mm construct has thousands of cells and cilia ~10 um).
  interior     the mesenchymal core: a loose cluster of rounded cells fused into one mass, with pockets where
               the contractile tissue lies. The page draws the epidermis see-through over it.
  contractile  cardiomyocyte-derived tissue, one smooth mass per side with a faint fibre grain. The page hides
               it if a ladder lacks it.

Stage keys: 'default' only (a construct's own declaration disowns a life cycle). No generation of the xenobot
run declares a shape, a size that differs between generations, or a ciliated fraction, so there are no
drivers: one spheroid serves every generation, and the node extras say its shape is schematic.
Slots: surface (envelope), interior, contractile (paired). +x anterior (direction of travel), +y dorsal,
+z the construct's right.
"""
import math
import random

import bmesh
from mathutils import Vector, noise, kdtree

SHAPE_NOTE = ('schematic: one spheroid for every generation. No generation of this design declares a shape, a '
              'size, or a ciliated fraction, so the outline, the cell tiling, the share of multiciliated cells, '
              'the tuft size, the cilium length and the beat phases are illustrative choices, not data. The beat '
              'shapes follow the textbook ciliary stroke (extended power stroke, curled recovery stroke); the '
              'wave length and phases are drawn, not simulated.')

# Body: a near-sphere, slightly broader than tall, centred a little above the frame origin so the surface
# node lands on the 'surface' slot (0, 0.2, 0) within tolerance and the interior slot sits low inside it.
C = Vector((0.0, 0.10, 0.0))
R = Vector((1.06, 0.95, 1.0))
N_CELLS = 540
TUFT = 13                   # cilia per multiciliated cell (schematic; real tufts carry ~100-150): fewer, so each reads as a hair
CIL_LEN = (0.12, 0.17)      # page units, exaggerated (a real cilium is ~10 um on a ~0.5-1 mm construct)
CIL_R = 0.0046              # base radius; each cilium tapers to a fine tip
CIL_SEG = 7                 # segments along a cilium: enough for the curled recovery stroke to read as a curve

# What the multiciliated cells and their cilia DEPICT (the mesh contract's extras.requires, see
# sim-engine/scales/mesh/depicts.mjs). The page draws these two pieces by the state of THAT part in the ladder,
# not by the surface slot's: present solid, ghost violet and labelled, absent hidden.
MCC_REQUIRES = ['CL_0005012', '/multicilia/i']
MCC_DEPICTS = 'cilia and multiciliated cells'
MCC_VIEW = ('drawn on the ventral (-y) face only, the one ciliated face the construct frame declares: the default view looks '
            'from slightly above, so tilt the body (drag upward) to see that face from below')
WAVE = 0.42                 # metachronal wavelength along x, page units (illustrative)


def _ss(a, b, x):
    t = (x - a) / (b - a)
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return t * t * (3 - 2 * t)


def _hex(h):
    h = h.lstrip('#')
    return Vector(tuple(int(h[k:k + 2], 16) / 255.0 for k in (0, 2, 4)))


def _ico(level):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=level, radius=1.0)
    verts = [Vector(v.co).normalized() for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return verts, faces


def _paint(ob, cols):
    """Per-vertex sRGB colours into the 'Col' attribute that material(vertex_color=True) reads."""
    me = ob.data
    a = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for i, c in enumerate(cols):
        a.data[i].color_srgb = (min(1, max(0, c[0])), min(1, max(0, c[1])), min(1, max(0, c[2])), 1.0)
    me.update()


def _tangent_basis(n):
    ref = Vector((0, 1, 0)) if abs(n.y) < 0.9 else Vector((1, 0, 0))
    u = (ref - n * ref.dot(n)).normalized()
    return u, n.cross(u)


# ---------------------------------------------------------------------------------------------- epidermis

class Epidermis:
    """The surface as a function of direction, so cilia bases sit exactly on the sculpted cells."""

    def __init__(self, rng):
        s = math.sqrt(4 * math.pi / N_CELLS)
        self.s = s
        # Random seeds relaxed by a few Lloyd steps: an irregular but even tiling, as an epithelium looks,
        # instead of the visible spiral of a Fibonacci lattice.
        seeds = []
        while len(seeds) < N_CELLS:
            v = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))
            if v.length > 1e-6:
                seeds.append(v.normalized())
        samples = []
        while len(samples) < N_CELLS * 40:
            v = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))
            if v.length > 1e-6:
                samples.append(v.normalized())
        for _ in range(4):
            kd = kdtree.KDTree(len(seeds))
            for i, d in enumerate(seeds):
                kd.insert(d, i)
            kd.balance()
            acc = [Vector((0, 0, 0)) for _ in seeds]
            for q in samples:
                acc[kd.find(q)[1]] += q
            seeds = [a.normalized() if a.length > 1e-9 else seeds[i] for i, a in enumerate(acc)]
        self.seeds = seeds
        self.kd = kdtree.KDTree(len(seeds))
        for i, d in enumerate(seeds):
            self.kd.insert(d, i)
        self.kd.balance()
        # Cell types: multiciliated cells only on the ventral face, never touching one another (salt-and-pepper).
        self.kind = ['goblet'] * len(seeds)
        mcc = []
        order = sorted(range(len(seeds)), key=lambda i: rng.random())
        for i in order:
            d = seeds[i]
            p = 0.8 * _ss(0.10, -0.35, d.y)
            if rng.random() < p and all((d - seeds[j]).length > 1.32 * s for j in mcc):
                mcc.append(i)
                self.kind[i] = 'mcc'
            elif rng.random() < 0.22:
                self.kind[i] = 'pigment'
        # A few small intercalated cells (the textbook epidermis also has ionocytes and small secretory cells):
        # drawn as smaller domes by shrinking their share of the tiling.
        for i in order:
            if self.kind[i] != 'mcc' and rng.random() < 0.10:
                self.kind[i] = 'small'
        self.weight = [(-0.22 * s if k == 'small' else 0.0) for k in self.kind]
        self.mcc = mcc
        self.tint = [rng.uniform(-1, 1) for _ in seeds]
        self.amp = {'goblet': 0.014, 'pigment': 0.012, 'mcc': 0.03, 'small': 0.02}
        self.col = {'goblet': _hex('#bf9069'), 'pigment': _hex('#93644a'), 'mcc': _hex('#d3b48c'), 'small': _hex('#ad7f5c')}
        self.groove = _hex('#553826')

    def base(self, d):
        low = 1 + 0.045 * noise.noise(d * 1.3 + Vector((3.1, 1.7, 0.4))) + 0.014 * noise.noise(d * 3.3 + Vector((0.2, 5.0, 1.1)))
        return Vector((C.x + d.x * R.x * low, C.y + d.y * R.y * low, C.z + d.z * R.z * low))

    def normal0(self, d):
        return Vector((d.x / R.x, d.y / R.y, d.z / R.z)).normalized()

    def cell(self, d):
        near = sorted((dist - self.weight[i], i, dist) for _, i, dist in self.kd.find_n(d, 6))
        (w1, i1, d1), (w2, _, _) = near[0], near[1]
        e = (w2 - w1) / self.s
        h = _ss(0.0, 0.34, e)
        return i1, d1, h

    def dome(self, d, plain=False):
        """Dome height at direction d. plain=True draws a multiciliated cell as an ordinary (goblet-height)
        epidermal cell: the base surface under the separately styled multiciliated-cell patches."""
        i, d1, h = self.cell(d)
        k = self.kind[i]
        if plain and k == 'mcc':
            k = 'goblet'
        return self.amp[k] * (h ** 0.6) * (1 - 0.3 * min(1.0, (d1 / (self.s * (0.6 if k == 'small' else 1.0))) ** 2)) - 0.007 * (1 - h), i, h

    def point(self, d):
        dm, i, h = self.dome(d)
        return self.base(d) + self.normal0(d) * dm, i, h

    def colour(self, d, i, h, plain=False):
        k = self.kind[i]
        if plain and k == 'mcc':
            k = 'goblet'
        c = self.col[k] * (1 + 0.045 * self.tint[i])
        if k != 'mcc':
            spk = max(0.0, noise.noise(d * 46.0 + Vector((i * 0.37, 0, 0))))
            c = c * (1 - 0.16 * spk)
        g = h ** 0.7
        return self.groove.lerp(c, g)


def _cilium(base, n, t, L, phase, wob):
    """Centreline of one cilium in its beat plane (n, t): t points anterior (+x). Power stroke (first third of
    the cycle) sweeps an almost straight cilium from leaning forward to leaning back; recovery unrolls a
    curled cilium forward close to the surface."""
    K = CIL_SEG
    if phase < 0.33:
        p = _ss(0, 1, phase / 0.33)
        th = math.radians(55 - 130 * p)
        ang = [th + math.radians(16) * (k / K) ** 2 for k in range(K + 1)]
    else:
        r = (phase - 0.33) / 0.67
        tb = math.radians(-78 + 133 * r)
        tt = math.radians(-86 + 126 * r ** 2.2)
        ang = [tb + (tt - tb) * (k / K) ** 1.3 for k in range(K + 1)]
    b = n.cross(t)
    pts, p = [base], base.copy()
    ds = L / K
    for k in range(K):
        a = 0.5 * (ang[k] + ang[k + 1])
        a = max(-1.42, min(1.42, a))
        step = n * math.cos(a) + t * math.sin(a) + b * (wob * (k + 1) / K)
        p = p + step.normalized() * ds
        pts.append(p)
    return pts


def _tube_verts(pts, r0, sides=3):
    """A thin tapering tube along page-space pts, closed at the tip. Returns (verts, faces) in page coords."""
    verts, faces = [], []
    n = len(pts)
    prev = None
    for k, p in enumerate(pts):
        tdir = (pts[min(k + 1, n - 1)] - pts[max(k - 1, 0)]).normalized()
        if prev is None:
            ref = Vector((0, 1, 0)) if abs(tdir.y) < 0.9 else Vector((1, 0, 0))
            prev = (ref - tdir * ref.dot(tdir)).normalized()
        else:
            prev = (prev - tdir * prev.dot(tdir)).normalized()
        bb = tdir.cross(prev)
        r = r0 * (1 - 0.82 * (k / (n - 1)) ** 1.4)     # tapered: thick at the base, a fine tip
        for s in range(sides):
            a = 2 * math.pi * s / sides
            verts.append(tuple(p + (prev * math.cos(a) + bb * math.sin(a)) * r))
    tip = pts[-1] + (pts[-1] - pts[-2]).normalized() * r0 * 0.5
    for k in range(n - 1):
        a0, b0 = k * sides, (k + 1) * sides
        for s in range(sides):
            faces.append((a0 + s, a0 + (s + 1) % sides, b0 + (s + 1) % sides, b0 + s))
    ti = len(verts)
    verts.append(tuple(tip))
    last = (n - 1) * sides
    for s in range(sides):
        faces.append((last + s, last + (s + 1) % sides, ti))
    return verts, faces


def _cilia(lib, epi, rng, mat):
    verts, faces = [], []
    s = epi.s
    for i in epi.mcc:
        cd = epi.seeds[i]
        u, v = _tangent_basis(cd)
        tuft_phase = (epi.base(cd).x / WAVE) + 0.08 * noise.noise(cd * 5.0)
        for _ in range(TUFT):
            a, m = rng.uniform(0, 2 * math.pi), 0.24 * s * math.sqrt(rng.random())
            off = (u * math.cos(a) + v * math.sin(a)) * m
            d = (cd + off).normalized()
            base, _, _ = epi.point(d)
            n0 = epi.normal0(d)
            fan = off / (0.24 * s)
            n = (n0 + fan * 0.35).normalized()                         # a tuft fans out from its cell
            t = Vector((1, 0, 0)) - n * n.x
            if t.length < 0.2:
                t = Vector((0, 0, 1)) - n * n.z
            t.normalize()
            side_fan = fan.dot(n.cross(t))                              # splay sideways too, not only in the beat plane
            ph = (tuft_phase + rng.uniform(-0.1, 0.1)) % 1.0
            pts = _cilium(base - n * 0.004, n, t, rng.uniform(*CIL_LEN), ph, 0.4 * side_fan + rng.uniform(-0.08, 0.08))
            vv, ff = _tube_verts(pts, CIL_R * rng.uniform(0.85, 1.1), sides=4)
            o = len(verts)
            verts.extend(vv)
            faces.extend(tuple(o + j for j in f) for f in ff)
    if not verts:
        return None
    return lib.mesh_object('cilia', verts, faces, mat)


# ------------------------------------------------------------------------------------------- the build

def build(spec, lib, stage):
    rng = random.Random(1729)

    skin = lib.material('construct.epidermis', base='#bf9069', rough=0.42, clearcoat=0.35, clearcoat_rough=0.28,
                        sheen=0.12, sheen_tint='#f3dcc0', subsurface=0.2, vertex_color=True)
    # Cilia when a design HAS them: a tinted (warm straw), glossy, unsheened hair, so a tuft reads as a few long
    # tapered hairs and not as white fluff or mould. (Without the part in the blueprint the page draws them violet.)
    cilia_m = lib.material('construct.cilia', base='#c39a45', rough=0.32, clearcoat=0.45, clearcoat_rough=0.2, sheen=0.0)
    core_m = lib.material('construct.mesenchyme', base='#e2a882', rough=0.5, subsurface=0.3, sheen=0.25, clearcoat=0.12,
                          sheen_tint='#fff0e0', vertex_color=True)
    musc_m = lib.material('construct.cardiac', base='#a6524a', rough=0.42, clearcoat=0.22, clearcoat_rough=0.3,
                          subsurface=0.2, vertex_color=True)

    # --- surface: the tiled epidermis
    # The surface slot draws every epidermal cell as an ordinary one (multiciliated cells at goblet height and
    # colour). The multiciliated cells themselves are a SEPARATE piece laid over it (the same tiling, their own
    # taller, paler domes, lifted a hair above the base), so the page can draw them -- and their cilia -- by the
    # state of the multiciliated cell in the ladder: hiding them leaves an intact epidermis, never a hole.
    epi = Epidermis(rng)
    dirs, faces = _ico(7)
    disp, disp_m, cols, cols_m, cell_of = [], [], [], [], []
    for d in dirs:
        dm, i, h = epi.dome(d)
        dp, _, _ = epi.dome(d, plain=True)
        disp_m.append(dm)
        disp.append(dp)
        cols_m.append(epi.colour(d, i, h))
        cols.append(epi.colour(d, i, h, plain=True))
        cell_of.append(i)
    # Two passes of neighbour averaging on the dome height: soft, rounded cell edges with no stair-steps.
    nbr = [set() for _ in dirs]
    for f in faces:
        for a in f:
            nbr[a].update(f)
    avg = lambda vals, z: [vals[k] * 0.5 + sum((vals[j] for j in nb), z) / len(nb) * 0.5 for k, nb in enumerate(nbr)]
    for _ in range(3):
        disp = avg(disp, 0.0)
        disp_m = avg(disp_m, 0.0)
    for _ in range(2):
        cols = avg(cols, Vector((0, 0, 0)))
        cols_m = avg(cols_m, Vector((0, 0, 0)))
    verts = [tuple(epi.base(d) + epi.normal0(d) * dm) for d, dm in zip(dirs, disp)]
    body = lib.mesh_object('surface', verts, faces, skin)
    _paint(body, cols)
    dec = body.modifiers.new('dec', 'DECIMATE')
    dec.ratio = 0.6
    lib.part(body, 'surface')
    body['shape_basis'] = SHAPE_NOTE
    body['cells_drawn'] = ('%d epidermal cells drawn as one surface; %d multiciliated cells with %d cilia each are a separate '
                           'piece over it (schematic counts)' % (N_CELLS, len(epi.mcc), TUFT))

    # --- the multiciliated cells: their own domes over the base, a separately styled piece
    # Every face touching a multiciliated cell; the ring of vertices just outside the cell sits at the base surface's
    # own height, so the patch's rim slopes into the groove between cells instead of floating as a jagged edge.
    is_m = set(epi.mcc)
    mf = [f for f in faces if any(cell_of[a] in is_m for a in f)]
    if mf:
        remap = {}
        for f in mf:
            for a in f:
                remap.setdefault(a, len(remap))
        mv = [None] * len(remap)
        mc = [None] * len(remap)
        for a, k in remap.items():
            d = dirs[a]
            lift = max(disp_m[a], disp[a]) + 0.003 if cell_of[a] in is_m else disp[a] + 0.0008
            mv[k] = tuple(epi.base(d) + epi.normal0(d) * lift)
            mc[k] = cols_m[a] if cell_of[a] in is_m else cols[a]     # the rim takes the base's own colour: no seam
        patches = lib.mesh_object('mcc_cells', mv, [tuple(remap[a] for a in f) for f in mf], skin)
        _paint(patches, mc)
        # not decimated: a decimated rim leaves long slivers whose shading reads as a hard, angular edge
        lib.deco(patches, body, 'mcc_cells')
        patches['requires'] = list(MCC_REQUIRES)
        patches['depicts'] = MCC_DEPICTS
        patches['view_note'] = MCC_VIEW
        patches['shape_basis'] = ('schematic: %d multiciliated cells, salt-and-pepper among the others on the ventral face; '
                                  'count, size and placement illustrative' % len(epi.mcc))

    cil = _cilia(lib, epi, rng, cilia_m)
    if cil is not None:
        lib.deco(cil, body, 'cilia')
        cil['requires'] = list(MCC_REQUIRES)
        cil['depicts'] = MCC_DEPICTS
        cil['view_note'] = MCC_VIEW
        cil['beat'] = ('illustrative: textbook ciliary beat shapes frozen at phases of a metachronal wave along x; '
                       'not simulated, not timed, wavelength drawn not measured')

    # --- contractile: one smooth mass per side, set into pockets of the core
    pockets = []
    for side in ('right', 'left'):
        sx, sy, sz = lib.slot('contractile', side)
        sg = lib.side_sign(side)
        cc = Vector((sx, sy - 0.02, sz + sg * 0.04))                # the slot's beads (z 0.23-0.33) fall inside it
        rr = Vector((0.33, 0.21, 0.155))
        pockets.append((cc, rr))
        dv, df = _ico(5)
        mv, mc = [], []
        fib = Vector((math.cos(0.5), math.sin(0.5), 0.0))          # fibre grain, oblique in the x-y plane
        perp = Vector((-fib.y, fib.x, 0.0))
        for d in dv:
            q = Vector((d.x * rr.x, d.y * rr.y, d.z * rr.z))
            lx = q.x / rr.x
            q.z += sg * 0.06 * (1 - lx * lx)                         # a lens that hugs the body wall
            q.y += 0.03 * lx * lx
            w = math.sin(2 * math.pi * q.dot(perp) / 0.028 + 1.3 * noise.noise(q * 9.0))
            nrm = Vector((d.x / rr.x, d.y / rr.y, d.z / rr.z)).normalized()
            q += nrm * (0.0012 * w + 0.006 * noise.noise(q * 6.0 + Vector((sg, 0, 0))))
            mv.append(tuple(cc + q))
            mc.append(_hex('#8f3f3b').lerp(_hex('#a24e48'), 0.5 + 0.5 * w))
        m = lib.mesh_object('contractile', mv, df, musc_m)
        _paint(m, mc)
        lib.part(m, 'contractile', side)
        m['shape_basis'] = 'schematic: position from the contractile slot in body-frames.json; size and fibre grain illustrative'

    # --- interior: the mesenchymal core, a loose cluster of rounded cells around the contractile pockets
    ix, iy, iz = lib.slot('interior')
    ic = Vector((ix, iy, iz))
    balls = []
    tries = 0
    while len(balls) < 58 and tries < 5000:
        tries += 1
        u = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if u.length > 1:
            continue
        rb = rng.uniform(0.12, 0.175)
        p = ic + Vector((u.x * 0.56, u.y * 0.44, u.z * 0.52))
        bad = False
        for cc, rr in pockets:
            q = p - cc
            if (q.x / (rr.x + rb * 0.6)) ** 2 + (q.y / (rr.y + rb * 0.6)) ** 2 + (q.z / (rr.z + rb * 0.75)) ** 2 < 1:
                bad = True
                break
            # nothing of the core lies outboard of the contractile mass, so its outer face stays in view and a
            # click on it opens the contractile card, not the core's
            if abs(q.x) < rr.x + rb * 0.6 and -rr.y - rb < q.y < rr.y + 0.3 and math.copysign(1, cc.z) * q.z > -0.08:
                bad = True
                break
        if bad or any((p - b).length < 0.8 * (rb + br) for b, br in balls):
            continue
        balls.append((p, rb))
    core = lib.blob('interior', [(tuple(p), r) for p, r in balls], core_m, resolution=0.032)
    kd = kdtree.KDTree(len(balls))
    for k, (p, r) in enumerate(balls):
        kd.insert(p, k)
    kd.balance()
    tints = [rng.uniform(0, 1) for _ in balls]
    cc_cols = []
    for v in core.data.vertices:
        pv = Vector(lib.to_page(v.co))
        (_, k1, d1), (_, k2, d2) = kd.find_n(pv, 2)
        h = _ss(0.0, 0.06, (d2 - d1))
        base_c = _hex('#e6ab84').lerp(_hex('#d08a64'), tints[k1])
        cc_cols.append(_hex('#9a5e45').lerp(base_c, 0.3 + 0.7 * h))
    _paint(core, cc_cols)
    lib.part(core, 'interior')
    core['shape_basis'] = 'schematic: a cluster of %d rounded mesenchymal cells, illustrative count and size' % len(balls)
    root = lib._S.get('root')
    if root is not None:
        root['shape_basis'] = SHAPE_NOTE
