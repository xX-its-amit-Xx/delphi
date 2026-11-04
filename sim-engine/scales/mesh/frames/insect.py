"""Sculptor for the INSECT frame: a higher-fly body plan in four stage forms.

AN ILLUSTRATION, NOT MORPHOMETRY. Every form here is shaped by hand after textbook drawings of a
Drosophila-like fly (Demerec's "Biology of Drosophila", the FlyBase anatomy pictures, standard entomology
plates). Nothing is measured, nothing is fitted to a specimen, and no number in this file is data: counts
(bristles, facets, ovarioles, denticles), lengths, angles, colours and the wing's vein layout are all drawn
to read as "a fly" at a glance. Stage forms are keyed by the declared stage NAME only:

    egg    a chorion with two paddle-tipped dorsal appendages and a micropyle; inside, the blastoderm drawn
           as a fate map (head / thorax / abdomen regions) and the pole cells at the posterior pole (gonad)
    larva  a third-instar maggot: translucent segmented body wall, ventral denticle belts, the black
           mouth-hook skeleton, anterior and posterior spiracles on silvery dorsal tracheal trunks, brain
           lobes and a short ventral nerve cord, a long gut with salivary glands, lobed fat body, Malpighian
           tubules, small gonads, the dorsal vessel. No eyes, wings, legs or halteres (a larva has none of
           them as adult organs), so those slots are not built here.
    pupa   a barrel puparium (the hardened last larval cuticle) with anterior spiracle horns, around a
           pharate adult whose wings, halteres and legs lie folded as pads against the body
    adult  the imago: compound eyes with facet relief, ocelli, branched aristae, a proboscis, bristled
           thorax and scutellum, two veined wings held slightly spread and tented, halteres, six jointed legs in a
           standing pose, a banded abdomen; inside, brain, flight muscles, gut, fat body, Malpighian
           tubules, ovaries, dorsal vessel, ventral nerve cord and tracheae, at the frame's slots.

Coordinates are PAGE units through lib (+x anterior, +y dorsal, +z the fly's RIGHT; world = body-frames pos
x 2). Slot centres follow body-frames.json; the forms are drawn around them. Which slots a design HAS is the
page's decision per ladder, never this file's: every slot is sculpted whenever the stage has that organ.
"""
import math
from mathutils import Vector

SIDES = ('right', 'left')

# Choices a viewer could mistake for data. Each goes into the node's glTF extras as `illustration_note`
# (the manifest already marks every node's proportions 'schematic').
NOTES = {
    'eye': 'facet relief is decorative: the facet count and lattice are drawn, not counted from a specimen',
    'wing': 'vein layout is a textbook schematic of a higher-fly wing (costa, L1-L6, two crossveins); posture '
            '(slightly spread and tented, roof-like), the smoky tint and the faint interference tint are drawn for '
            'legibility, not measured',
    'leg': 'standing pose and segment proportions are drawn, not measured',
    'gonad': 'drawn as a female pair of ovaries with ovarioles; the design does not declare a sex',
    'thorax': 'bristle positions follow the textbook chaetotaxy pattern loosely; counts are illustrative',
    'abdomen': 'tergite banding is a generic pattern, not a phenotype',
    'cuticle': 'drawn as a thin glassy coat over the body',
    'fat_body': 'in the pupa the fat body is drawn as loose cells, as textbooks show it during metamorphosis',
}


def note(ob, slot_name):
    if slot_name in NOTES:
        ob['illustration_note'] = NOTES[slot_name]
    return ob

# ------------------------------------------------------------------------------------------- materials


def mats(lib):
    m = lib.material
    return {
        # adult cuticle: amber-tan chitin, vertex-painted, with a clear coat
        'body': m('insect.cuticle_tan', base='#ffffff', rough=0.36, clearcoat=0.55, clearcoat_rough=0.2, vertex_color=True),
        'head': m('insect.head', base='#ffffff', rough=0.4, clearcoat=0.45, clearcoat_rough=0.22, vertex_color=True),
        'leg': m('insect.leg', base='#ffffff', rough=0.42, clearcoat=0.4, clearcoat_rough=0.25, vertex_color=True),
        'eye': m('insect.eye_base', base='#4e0b08', rough=0.5, clearcoat=0.2),
        'facet': m('insect.eye_facet', base='#c42a1e', rough=0.14, clearcoat=1.0, clearcoat_rough=0.03, specular=0.7),
        'ocellus': m('insect.ocellus', base='#7b2c16', rough=0.12, clearcoat=1.0, clearcoat_rough=0.02),
        'bristle': m('insect.bristle', base='#1c130c', rough=0.42, clearcoat=0.3),
        'arista': m('insect.arista', base='#3a2a1a', rough=0.45),
        'funiculus': m('insect.funiculus', base='#c9a46e', rough=0.6, sheen=0.8, sheen_tint='#f3e3c4', sheen_rough=0.4),
        'proboscis': m('insect.proboscis', base='#a8794a', rough=0.45, clearcoat=0.3),
        # smoky, not glassy: a membrane with transmission and a near-white tint vanished against the page's light
        # background, leaving only the veins. Alpha 0.42 with a grey-brown tint reads as a blade at any angle.
        'wing': m('insect.wing_membrane', base='#ffffff', rough=0.22, alpha=0.42, ior=1.52,
                  sheen=0.35, sheen_tint='#d9ccff', clearcoat=0.45, clearcoat_rough=0.08, vertex_color=True),
        'vein': m('insect.wing_vein', base='#6a5034', rough=0.38, clearcoat=0.3),
        'fringe': m('insect.wing_fringe', base='#5c4a39', rough=0.5),
        'haltere': m('insect.haltere', base='#e2c793', rough=0.4, clearcoat=0.4),
        'claw': m('insect.claw', base='#1e140d', rough=0.3, clearcoat=0.6),
        'pulvillus': m('insect.pulvillus', base='#e8dcc0', rough=0.5, sheen=0.5),
        'shell': m('insect.cuticle_coat', base='#e9d2a6', rough=0.12, transmission=0.5, alpha=0.18, clearcoat=1.0,
                   clearcoat_rough=0.04),
        # interior organs: soft, slightly translucent, textbook tints
        'brain': m('insect.brain', base='#efdccb', rough=0.55, subsurface=0.4, sheen=0.3),
        'muscle': m('insect.flight_muscle', base='#c7695a', rough=0.5, subsurface=0.25, sheen=0.35, sheen_tint='#f2b6a8'),
        'gut': m('insect.gut', base='#d9a75f', rough=0.42, subsurface=0.25, clearcoat=0.35),
        'crop': m('insect.crop', base='#e8d2a4', rough=0.3, subsurface=0.3, clearcoat=0.5, alpha=0.85),
        'sheath': m('insect.ovary_sheath', base='#f3d9d2', rough=0.25, alpha=0.22, clearcoat=0.6),
        'fat': m('insect.fat_body', base='#f3e6b5', rough=0.6, subsurface=0.45),
        'malp': m('insect.malpighian', base='#e8c45a', rough=0.4, subsurface=0.2, clearcoat=0.3),
        'ovary': m('insect.ovary', base='#efc0bd', rough=0.5, subsurface=0.4),
        'oocyte': m('insect.oocyte', base='#f5dfb9', rough=0.45, subsurface=0.4),
        'heart': m('insect.heart', base='#c6585a', rough=0.45, subsurface=0.3),
        'nerve': m('insect.nerve', base='#f1e8d6', rough=0.5, subsurface=0.35),
        'trachea': m('insect.trachea', base='#dfe7ee', rough=0.2, metal=0.6, clearcoat=0.4),
        'airsac': m('insect.air_sac', base='#e7eef4', rough=0.15, metal=0.4, alpha=0.6, clearcoat=0.6),
        # larva
        'larva': m('insect.larval_wall', base='#ffffff', rough=0.3, subsurface=0.5, transmission=0.15, alpha=0.5,
                   clearcoat=0.45, clearcoat_rough=0.12, vertex_color=True),
        'larva_coat': m('insect.larval_cuticle', base='#f7f1e4', rough=0.1, transmission=0.6, alpha=0.14,
                        clearcoat=1.0, clearcoat_rough=0.03),
        'sclerite': m('insect.sclerite', base='#0e0a07', rough=0.55, clearcoat=0.2),
        'denticle': m('insect.denticle', base='#9c8462', rough=0.6),
        'denticle_hook': m('insect.denticle_hook', base='#4a3420', rough=0.45, clearcoat=0.3),
        'spiracle': m('insect.spiracle', base='#7a4a22', rough=0.35, clearcoat=0.6),
        'salivary': m('insect.salivary_gland', base='#f0e6d6', rough=0.3, subsurface=0.4, alpha=0.8),
        # pupa
        'puparium': m('insect.puparium', base='#ffffff', rough=0.3, clearcoat=0.7, clearcoat_rough=0.12, alpha=0.82,
                      vertex_color=True),
        'pharate': m('insect.pharate', base='#ffffff', rough=0.4, subsurface=0.4, clearcoat=0.3, vertex_color=True),
        'pad': m('insect.appendage_pad', base='#e2d0ad', rough=0.4, subsurface=0.4, clearcoat=0.3),
        'larval_fat': m('insect.larval_fat_body', base='#f6efd8', rough=0.5, subsurface=0.5, alpha=0.78),
        'larval_gut': m('insect.larval_gut', base='#c6964a', rough=0.35, subsurface=0.3, clearcoat=0.5),
        'pupal_eye': m('insect.pupal_eye', base='#c3948c', rough=0.42, clearcoat=0.35, clearcoat_rough=0.2),
        'yellow_body': m('insect.yellow_body', base='#d8b13c', rough=0.4, subsurface=0.3),
        # egg
        'chorion': m('insect.chorion', base='#ffffff', rough=0.3, transmission=0.4, alpha=0.4, clearcoat=0.7,
                     clearcoat_rough=0.1, sheen=0.6, sheen_tint='#fff6e6', vertex_color=True),
        'appendage': m('insect.dorsal_appendage', base='#f3ecdd', rough=0.35, clearcoat=0.5, sheen=0.4),
        'yolk': m('insect.blastoderm', base='#ffffff', rough=0.5, subsurface=0.45, vertex_color=True),
        'pole': m('insect.pole_cells', base='#e9a9ab', rough=0.4, subsurface=0.4, clearcoat=0.3),
    }

# --------------------------------------------------------------------------------------------- helpers


def hexrgb(c):
    h = c.lstrip('#')
    return tuple(int(h[k:k + 2], 16) / 255.0 for k in (0, 2, 4))


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0 if e1 != e0 else 1e-9)))
    return t * t * (3 - 2 * t)


def paint(lib, ob, fn):
    """Vertex colours from fn(page_pos, page_normal) -> rgb (0-1). Pair with a vertex_color material."""
    me = ob.data
    attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    cache = {}
    for loop in me.loops:
        vi = loop.vertex_index
        if vi not in cache:
            v = me.vertices[vi]
            cache[vi] = fn(lib.to_page(v.co), lib.to_page(v.normal))
        c = cache[vi]
        attr.data[loop.index].color_srgb = (c[0], c[1], c[2], 1.0)
    me.update()
    return ob


def flat(lib, ob, col):
    c = hexrgb(col)
    return paint(lib, ob, lambda p, n: c)


def closed_cr(pts, per):
    """Closed Catmull-Rom through 2D/3D tuples, `per` samples per segment."""
    out, m = [], len(pts)
    for i in range(m):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % m], pts[(i + 2) % m]
        for j in range(per):
            t = j / per
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
                             for a, b, c, d in zip(p0, p1, p2, p3)))
    return out


def lines(lib, name, items, mat, sides=3):
    """Tapered hairs / bristles / thin sclerites: items = [(points, base_radius), ...], each a polyline in page
    coords tapering to a point. One joined, cheap mesh (sides x rings quads + a tip fan per line)."""
    verts, faces = [], []
    for pts, r0 in items:
        pts = [Vector(p) for p in pts]
        n = len(pts)
        if n < 2:
            continue
        tan = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
        ref = Vector((0, 1, 0)) if abs(tan[0].y) < 0.9 else Vector((1, 0, 0))
        u = tan[0].cross(ref).normalized()
        base = len(verts)
        for i in range(n - 1):
            t = tan[i]
            u = (u - t * u.dot(t)).normalized()
            w = t.cross(u)
            r = r0 * (1 - i / (n - 1)) ** 0.8
            for s in range(sides):
                a = 2 * math.pi * s / sides
                verts.append(tuple(pts[i] + (u * math.cos(a) + w * math.sin(a)) * r))
        tip = len(verts)
        verts.append(tuple(pts[-1]))
        for i in range(n - 2):
            a0, b0 = base + i * sides, base + (i + 1) * sides
            for s in range(sides):
                faces.append((a0 + s, a0 + (s + 1) % sides, b0 + (s + 1) % sides, b0 + s))
        last = base + (n - 2) * sides
        for s in range(sides):
            faces.append((last + s, last + (s + 1) % sides, tip))
    if not faces:
        return None
    return lib.mesh_object(name, verts, faces, mat)


def surf(lib, ob, origin, direction):
    """Ray-cast onto an object (no modifiers needed): -> (page point, page normal) or None."""
    o = lib.P(origin)
    d = lib.P(direction).normalized()
    ok, loc, nrm, _ = ob.ray_cast(o, d)
    if not ok:
        return None
    return Vector(lib.to_page(loc)), Vector(lib.to_page(nrm)).normalized()


def around(lib, ob, x, theta, yc=0.0):
    """Surface point of a body of revolution at x, angle theta around the x axis (0 = dorsal, +pi/2 = right)."""
    o = (x, yc + 3.0 * math.cos(theta), 3.0 * math.sin(theta))
    return surf(lib, ob, o, (0.0, -math.cos(theta), -math.sin(theta)))


def bristle_path(p, n, length, back=(-1.0, 0.0, 0.0), rise=0.35, k=6):
    """A macrochaeta: leaves the surface along its normal, then arcs back along `back` (tangent-projected)."""
    b = Vector(back)
    b = (b - n * b.dot(n))
    b = b.normalized() if b.length > 1e-6 else Vector((-1, 0, 0))
    pts = []
    for i in range(k):
        t = i / (k - 1)
        up = rise * math.sin(t * math.pi * 0.5) * (1 - 0.35 * t)
        pts.append(tuple(p - n * 0.006 + (n * up + b * t) * length))
    return pts


def profile(fn, x0, x1, n):
    """Sample fn(x) -> (ry, rz, yc) into a lathe profile, ordered from x0 to x1."""
    out = []
    for i in range(n):
        x = x0 + (x1 - x0) * i / (n - 1)
        ry, rz, yc = fn(x)
        out.append((x, max(ry, 0.002), max(rz, 0.002), yc))
    return out


def eye_sites(center, radii, tilt, n, keep):
    """Facet sites over a whole eye ellipsoid: a Fibonacci (phyllotactic) spiral, which packs nearly
    hexagonally, mapped onto the ellipsoid; keep(page point) drops the sites buried in the head.
    Returns [(page point, page normal, facet radius)]. The count is illustrative."""
    cx, cy, cz = center
    rx, ry, rz = radii
    ct, st = math.cos(tilt), math.sin(tilt)
    rot = lambda w: Vector((w.x * ct - w.y * st, w.x * st + w.y * ct, w.z))
    golden = math.pi * (3 - math.sqrt(5))
    d0 = math.sqrt(4 * math.pi / n)
    out = []
    for i in range(n):
        y = 1 - 2 * (i + 0.5) / n
        rr = math.sqrt(max(0.0, 1 - y * y))
        th = golden * i
        u = Vector((math.cos(th) * rr, y, math.sin(th) * rr))
        q = Vector((u.x * rx, u.y * ry, u.z * rz))
        g = Vector((u.x / rx, u.y / ry, u.z / rz))
        nn = Vector((q.x / rx ** 2, q.y / ry ** 2, q.z / rz ** 2)).normalized()
        p = rot(q) + Vector((cx, cy, cz))
        if not keep(p):
            continue
        area = rx * ry * rz * g.length            # local stretch of the unit sphere's area element
        out.append((p, rot(nn), 0.5 * d0 * math.sqrt(area)))
    return out


def outside_head(p, margin=0.9):
    ry, rz, yc = head_fn(p[0])
    if ry < 0.01:
        return True
    return ((p[1] - yc) / ry) ** 2 + (p[2] / rz) ** 2 > margin


def facets(lib, name, sites, mat, height=0.26):
    """Hexagonal lens domes (7 verts, 6 tris each) on given sites."""
    verts, faces = [], []
    for p, nn, r in sites:
        ref = Vector((0, 1, 0)) if abs(nn.y) < 0.9 else Vector((1, 0, 0))
        u = nn.cross(ref).normalized()
        w = nn.cross(u)
        base = len(verts)
        verts.append(tuple(p + nn * (r * height)))
        for s in range(6):
            a = 2 * math.pi * s / 6 + math.pi / 6
            verts.append(tuple(p - nn * 0.008 + (u * math.cos(a) + w * math.sin(a)) * (r * 0.98)))
        for s in range(6):
            faces.append((base, base + 1 + s, base + 1 + (s + 1) % 6))
    return lib.mesh_object(name, verts, faces, mat)

# ------------------------------------------------------------------------------------- adult body shapes
# Each returns (ry, rz, yc) at x. Shared by the adult, its cuticle coat and the pharate adult in the pupa.


def head_fn(x):
    # a broad, short capsule: wider (z) than tall (y), flattened front to back
    x0, x1 = 1.21, 1.73
    t = (x - x0) / (x1 - x0)
    u = 2 * min(max(t, 0.0), 1.0) - 1
    p = 2.3 if u < 0 else 2.7
    e = max(0.0, 1 - abs(u) ** p) ** (1 / p)
    e *= (1 - 0.14 * smoothstep(0.45, 1.0, t))
    return 0.31 * e, 0.295 * e, 0.07 + 0.02 * (1 - t)


def thorax_fn(x):
    x0, x1 = 0.10, 1.24
    t = (x - x0) / (x1 - x0)
    tt = min(max(t, 0.0), 1.0)
    e = math.sin(math.pi * tt) ** 0.55
    hump = 1.0 + 0.10 * math.exp(-((tt - 0.48) / 0.28) ** 2)
    return 0.405 * e * hump, 0.365 * e, 0.035 + 0.03 * math.sin(math.pi * tt) - 0.04 * smoothstep(0.75, 1.0, tt)


TERGITES = [0.13, -0.08, -0.29, -0.50, -0.71, -0.92, -1.10]   # anterior edges of tergites 1-6, then the tip plate


def abdomen_fn(x):
    x0, x1 = -1.30, 0.42
    t = (x - x0) / (x1 - x0)
    tt = min(max(t, 0.0), 1.0)
    # an egg-shaped abdomen, broad at its base (flies have no waist), widest behind the middle
    if tt >= 0.6:
        e = math.sqrt(max(0.0, 1 - ((tt - 0.6) / 0.4) ** 2)) ** 0.85
    else:
        e = math.sin(0.5 * math.pi * tt / 0.6) ** 0.75
    return 0.41 * e, 0.44 * e, -0.035 - 0.03 * (1 - tt)


def tergite_phase(x):
    """0 at a tergite's anterior edge, rising to 1 at its posterior edge (where it overlaps the next)."""
    for a, b in zip(TERGITES, TERGITES[1:]):
        if b <= x <= a:
            return (a - x) / (a - b)
    return None


def sculpt_abdomen(lib, ob, amount=0.035):
    """Overlapping tergite plates: each swells slightly toward its posterior margin, dorsally and laterally."""
    def f(p):
        x, y, z = p
        ph = tergite_phase(x)
        ry, rz, yc = abdomen_fn(x)
        if ph is None:
            return p
        dors = smoothstep(-0.55, 0.1, (y - yc) / max(ry, 1e-3))
        s = 1 + amount * dors * (ph ** 1.6)
        return (x, yc + (y - yc) * s, z * s)
    return lib.transform(ob, f)


def sculpt_thorax(lib, ob):
    """Flatter sternum, fuller notum."""
    def f(p):
        x, y, z = p
        _, _, yc = thorax_fn(x)
        if y < yc:
            y = yc + (y - yc) * 0.86
        return (x, y, z)
    return lib.transform(ob, f)


def body_colour_thorax(p, n):
    x, y, z = p
    notum = hexrgb('#a06b36')
    pleura = hexrgb('#c39558')
    stern = hexrgb('#d4b07a')
    up = n[1]
    c = mix(pleura, notum, smoothstep(0.1, 0.7, up))
    c = mix(c, stern, smoothstep(-0.2, -0.75, up))
    # two faint darker dorsal stripes (vittae)
    if up > 0.5:
        s = math.exp(-((abs(z) - 0.11) / 0.03) ** 2)
        c = mix(c, hexrgb('#80522a'), 0.45 * s * smoothstep(0.25, 1.1, x))
    return c


def body_colour_abdomen(p, n):
    x, y, z = p
    pale = hexrgb('#d7ae63')
    dark = hexrgb('#3d2817')
    belly = hexrgb('#e7d3a3')
    ph = tergite_phase(x)
    up = n[1]
    c = pale
    if ph is not None:
        band = smoothstep(0.55, 0.78, ph)
        # bands narrow toward the sides, as on the textbook female
        band *= smoothstep(-0.45, 0.25, up)
        c = mix(pale, dark, band)
    elif x < TERGITES[-1]:
        c = mix(pale, dark, 0.65)
    return mix(c, belly, smoothstep(-0.25, -0.7, up))


def body_colour_head(p, n):
    x, y, z = p
    c = hexrgb('#b98a4c')
    # frons (between the eyes, above the antennae) orange-tan; occiput darker
    c = mix(c, hexrgb('#c8853f'), smoothstep(1.55, 1.7, x) * smoothstep(0.1, 0.3, y) * (1 - smoothstep(0.08, 0.16, abs(z))))
    c = mix(c, hexrgb('#8a6035'), smoothstep(1.4, 1.24, x))
    # ocellar triangle
    if y > 0.31 and abs(z) < 0.07 and 1.33 < x < 1.46:
        c = mix(c, hexrgb('#4b301b'), 0.7)
    return c

# ------------------------------------------------------------------------------------------------ build


def build(spec, lib, stage):
    M = mats(lib)
    {'egg': egg, 'larva': larva, 'pupa': pupa}.get(stage, adult)(lib, M)

# ------------------------------------------------------------------------------------------------ adult


def adult(lib, M):
    head = adult_head(lib, M)
    thorax = adult_thorax(lib, M)
    abdomen = adult_abdomen(lib, M)
    for s in SIDES:
        adult_eye(lib, M, s)
        adult_antenna(lib, M, s)
        adult_wing(lib, M, s)
        adult_haltere(lib, M, s)
        for i in range(3):
            adult_leg(lib, M, s, i)
    adult_proboscis(lib, M)
    interior(lib, M)
    coat_t = lib.lathe('coat_t', profile(lambda x: tuple(v + d for v, d in zip(thorax_fn(x), (0.014, 0.014, 0))), 0.085, 1.255, 26), M['shell'], sides=30, samples=26, subdiv=0)
    coat_a = lib.lathe('coat_a', profile(lambda x: tuple(v + d for v, d in zip(abdomen_fn(x), (0.02, 0.02, 0))), -1.32, 0.435, 30), M['shell'], sides=30, samples=30, subdiv=0)
    cu = lib.join([lib.lathe('coat_h', profile(lambda x: tuple(v + d for v, d in zip(head_fn(x), (0.012, 0.012, 0))), 1.205, 1.745, 22), M['shell'], sides=28, samples=22, subdiv=0),
                   coat_t, coat_a], 'cuticle')
    note(lib.part(cu, 'cuticle'), 'cuticle')


def adult_head(lib, M):
    ts = [0.5 - 0.5 * math.cos(math.pi * i / 33) for i in range(34)]
    hd = lib.lathe('head', [(1.21 + 0.52 * t,) + tuple(max(v, 0.002) for v in head_fn(1.21 + 0.52 * t)[:2]) + (head_fn(1.21 + 0.52 * t)[2],) for t in ts],
                   M['head'], sides=44, samples=48, subdiv=0)
    paint(lib, hd, body_colour_head)
    lib.part(hd, 'head')
    # ocelli: three simple eyes on the vertex
    oc = [lib.ellipsoid('ocellus', c, (0.02, 0.012, 0.02), M['ocellus'], segments=12, rings=8)
          for c in ((1.43, 0.355, 0.0), (1.375, 0.352, 0.035), (1.375, 0.352, -0.035))]
    ocl = lib.deco(lib.join(oc, 'ocelli'), hd, 'ocelli')
    # The ocelli are their own sense organs, not part of what "head" means: drawn only by the ocellus's own state
    # in the ladder (sim-engine/scales/mesh/depicts.mjs), never just because the head is drawn.
    ocl['requires'] = ['UBERON_0003161', '/ocell/i']
    ocl['depicts'] = 'ocelli'
    # head macrochaetae: ocellar, vertical, postvertical, orbitals; vibrissae at the mouth edge
    items = []
    for k in (1, -1):
        for (x, z, L, back) in ((1.41, 0.025, 0.13, (-0.4, 0.3, 0.9 * k)), (1.31, 0.11, 0.16, (-1, 0.2, -0.3 * k)),
                                (1.29, 0.2, 0.15, (-1, 0.1, 0.5 * k)), (1.27, 0.05, 0.12, (-1, 0.2, -0.6 * k)),
                                (1.56, 0.17, 0.12, (-0.6, 0.4, 0.5 * k)), (1.49, 0.185, 0.13, (-0.8, 0.4, 0.3 * k)),
                                (1.44, 0.19, 0.11, (-1.0, 0.4, 0.2 * k))):
            h = surf(lib, hd, (x, 1.2, z * k), (0, -1, 0))
            if h:
                items.append((bristle_path(h[0], h[1], L, back, rise=0.5), 0.0055))
        h = surf(lib, hd, (2.4, -0.12, 0.12 * k), (-1, 0, 0))
        if h:
            items.append((bristle_path(h[0], h[1], 0.11, (0.6, -0.6, 0.2 * k), rise=0.3), 0.005))
    br = lines(lib, 'head_bristles', items, M['bristle'], sides=5)
    if br:
        lib.deco(br, hd, 'bristles')
    hairs = lib.instance_on_surface('head_setulae', hd, lib.proto_hair(bend=0.3), 220, M['bristle'], length=(0.02, 0.035),
                                    radius=0.0028, seed=11, lean=(-1, 0.4, 0), lean_amount=0.9,
                                    mask=lambda p, n: n[1] > 0.25 and p[0] < 1.6, budget_tris=2600)
    if hairs is not None:
        lib.deco(hairs, hd, 'setulae')
    return hd


def adult_eye(lib, M, s):
    k = lib.side_sign(s)
    c = (1.51, 0.125, 0.245 * k)
    radii = (0.215, 0.285, 0.165)
    tilt = -0.2
    eye = lib.ellipsoid('eye', c, tuple(r - 0.009 for r in radii), M['eye'], segments=36, rings=22, rotate=('z', tilt))
    lib.part(eye, 'eye', s)
    note(eye, 'eye')
    sites = eye_sites(c, radii, tilt, 1300, outside_head)
    lib.deco(facets(lib, 'facets', sites, M['facet']), eye, 'facets')
    # interfacet bristles: tiny, sparse
    ib = lines(lib, 'interfacet', [([tuple(p), tuple(p + nn * 0.018 + Vector((-0.004, 0.006, 0)))], 0.0016)
                                   for idx, (p, nn, r) in enumerate(sites) if idx % 14 == 0], M['bristle'], sides=3)
    if ib:
        lib.deco(ib, eye, 'interfacet_bristles')


def adult_antenna(lib, M, s):
    k = lib.side_sign(s)
    scape = lib.tube('scape', [(1.685, 0.205, 0.05 * k), (1.715, 0.20, 0.058 * k)], [0.024, 0.026], M['head'], sides=10)
    pedicel = lib.ellipsoid('pedicel', (1.735, 0.19, 0.064 * k), (0.03, 0.034, 0.03), M['head'], segments=14, rings=10)
    flag = lib.ellipsoid('funiculus', (1.765, 0.115, 0.07 * k), (0.042, 0.082, 0.036), M['funiculus'], segments=18, rings=12,
                         rotate=('z', -0.35))
    ant = lib.join([scape, pedicel, flag], 'antenna')
    flat(lib, ant, '#ab7b44')
    lib.part(ant, 'antenna', s)
    # the arista: a branched bristle from the third segment, sweeping forward, up and out
    base = Vector((1.775, 0.17, 0.085 * k))
    shaft = [tuple(base + Vector((0.09 * t, 0.16 * t + 0.03 * t * t, 0.11 * t * k))) for t in [i / 7 for i in range(8)]]
    items = [(shaft, 0.0065)]
    for j in range(1, 7):
        t = j / 7.5
        p = base + Vector((0.09 * t, 0.16 * t + 0.03 * t * t, 0.11 * t * k))
        L = 0.05 * (1 - 0.45 * t)
        items.append(([tuple(p), tuple(p + Vector((0.025, 0.04, 0.012 * k)) * (L / 0.05))], 0.0022))
        if j % 2 == 0:
            items.append(([tuple(p), tuple(p + Vector((0.03, -0.028, 0.006 * k)) * (L / 0.05))], 0.0018))
    ar = lines(lib, 'arista', items, M['arista'], sides=4)
    lib.deco(ar, ant, 'arista')


def adult_proboscis(lib, M):
    pr = lib.tube('proboscis', [(1.52, -0.12, 0), (1.55, -0.21, 0), (1.585, -0.28, 0)], [0.062, 0.05, 0.045], M['proboscis'], sides=16)
    lab = lib.blob('labellum', [((1.61, -0.335, 0.042), (0.06, 0.04, 0.045)), ((1.61, -0.335, -0.042), (0.06, 0.04, 0.045)),
                                ((1.59, -0.3, 0.0), 0.04)], M['proboscis'], resolution=0.01)
    mo = lib.join([pr, lab], 'mouthpart')
    lib.part(mo, 'mouthpart')
    # pseudotracheal grooves on the labellar lobes, as fine dark lines
    items = []
    for k in (1, -1):
        for j in range(5):
            a = -0.9 + 0.45 * j
            p0 = Vector((1.61 + 0.02 * math.cos(a), -0.378, 0.03 * k))
            items.append(([tuple(p0), tuple(p0 + Vector((0.05 * math.cos(a), 0.014, 0.03 * k)))], 0.0024))
    gr = lines(lib, 'pseudotracheae', items, M['arista'], sides=3)
    if gr:
        lib.deco(gr, mo, 'pseudotracheae')


def adult_thorax(lib, M):
    th = lib.lathe('thorax', profile(thorax_fn, 0.10, 1.24, 30), M['body'], sides=48, samples=40, subdiv=0)
    sculpt_thorax(lib, th)
    # scutellum: the rounded shield behind the scutum
    sc = lib.ellipsoid('scutellum', (0.25, 0.305, 0.0), (0.17, 0.095, 0.19), M['body'], segments=32, rings=16)
    lib.transform(sc, lambda p: (p[0], p[1] - 0.04 * ((p[0] - 0.25) / 0.17) ** 2, p[2]))
    neck = lib.tube('neck', [(1.16, 0.02, 0), (1.25, 0.05, 0)], [0.09, 0.075], M['body'], sides=16)
    th = lib.join([th, sc, neck], 'thorax')
    paint(lib, th, body_colour_thorax)
    lib.part(th, 'thorax')
    note(th, 'thorax')
    # macrochaetae (pairs): (x, theta from dorsal, length)
    items = []
    for k in (1, -1):
        for x, theta, L in ((0.80, 0.30, 0.30), (0.57, 0.30, 0.32),                       # dorsocentrals
                            (1.04, 1.05, 0.18), (0.93, 0.95, 0.2),                         # humeral, presutural
                            (0.88, 1.25, 0.2), (0.76, 1.28, 0.2),                          # notopleurals
                            (0.68, 0.88, 0.22), (0.45, 0.98, 0.24),                        # supra-alar, postalar
                            (0.72, 2.05, 0.16), (0.58, 2.15, 0.14)):                       # sternopleurals
            h = around(lib, th, x, theta * k, yc=thorax_fn(x)[2])
            if h:
                items.append((bristle_path(h[0], h[1], L, (-1, 0.05, -0.15 * k)), 0.0068))
        for x, th_, L in ((0.33, 0.55, 0.28), (0.17, 0.22, 0.36)):                         # scutellars
            h = surf(lib, th, (x, 1.2, math.sin(th_) * 0.17 * k), (0, -1, 0))
            if h:
                items.append((bristle_path(h[0], h[1], L, (-1, 0.15, -0.35 * k), rise=0.4), 0.007))
    br = lines(lib, 'macrochaetae', items, M['bristle'], sides=5)
    lib.deco(br, th, 'macrochaetae')
    mic = lib.instance_on_surface('microchaetae', th, lib.proto_hair(bend=0.35), 900, M['bristle'], length=(0.028, 0.045),
                                  radius=0.0032, seed=2, lean=(-1, 0.2, 0), lean_amount=1.4,
                                  mask=lambda p, n: n[1] > 0.35 and 0.36 < p[0] < 1.14, budget_tris=6500)
    if mic is not None:
        lib.deco(mic, th, 'microchaetae')
    return th


def adult_abdomen(lib, M):
    ab = lib.lathe('abdomen', profile(abdomen_fn, -1.30, 0.42, 60), M['body'], sides=48, samples=96, subdiv=0)
    sculpt_abdomen(lib, ab)
    paint(lib, ab, body_colour_abdomen)
    lib.part(ab, 'abdomen')
    note(ab, 'abdomen')
    # setae along each tergite's posterior margin
    def margin(p, n):
        ph = tergite_phase(p[0])
        return ph is not None and ph > 0.8 and n[1] > -0.2
    se = lib.instance_on_surface('tergite_setae', ab, lib.proto_hair(bend=0.3), 700, M['bristle'], length=(0.035, 0.06),
                                 radius=0.003, seed=5, lean=(-1, 0.1, 0), lean_amount=1.3, mask=margin, budget_tris=4200)
    if se is not None:
        lib.deco(se, ab, 'setae')
    return ab

# ------------------------------------------------------------------------------------------------ wings


WING_OUTLINE = [(0.00, 0.026), (0.07, 0.048), (0.22, 0.082), (0.42, 0.118), (0.62, 0.152), (0.78, 0.170), (0.90, 0.153),
                (0.97, 0.10), (1.00, 0.032), (0.99, -0.04), (0.945, -0.115), (0.865, -0.18), (0.75, -0.225), (0.6, -0.248),
                (0.44, -0.24), (0.30, -0.205), (0.21, -0.17), (0.155, -0.158), (0.105, -0.12), (0.05, -0.068), (0.012, -0.03)]
VEINS = {   # (s, c) control points of a higher-fly wing, drawn after the textbook pattern
    'L1': [(0.02, 0.022), (0.2, 0.062), (0.41, 0.108)],
    'L2': [(0.06, 0.012), (0.3, 0.054), (0.56, 0.104), (0.86, 0.162)],
    'L3': [(0.05, 0.0), (0.35, 0.022), (0.7, 0.042), (0.995, 0.034)],
    'L4': [(0.06, -0.02), (0.4, -0.046), (0.75, -0.072), (0.958, -0.098)],
    'L5': [(0.05, -0.034), (0.3, -0.1), (0.55, -0.168), (0.74, -0.221)],
    'L6': [(0.03, -0.042), (0.15, -0.092), (0.25, -0.132)],
    'acv': [(0.405, 0.025), (0.415, -0.044)],
    'pcv': [(0.655, -0.064), (0.62, -0.183)],
}


class WingFrame:
    """Maps wing coordinates (s along the span 0..1, c along the chord, + anterior, both in wing lengths) to page."""

    def __init__(self, k, hinge, length, sweep, dihedral, camber, fold=None, roll=0.0):
        self.k, self.h, self.L, self.camber = k, Vector(hinge), length, camber
        d = Vector((-math.sin(sweep) * math.cos(dihedral), math.sin(dihedral), k * math.cos(sweep) * math.cos(dihedral)))
        up = Vector((0, 1, 0))
        a = up.cross(d) * k
        a = (a - d * a.dot(d)).normalized()
        n = a.cross(d)
        if n.y < 0:
            n = -n
        n = n.normalized()
        # roll: turn the blade about its own span, so the inner (trailing) edges rise toward the midline and the
        # outer (leading) edges drop -- the roof-like resting posture of many flies. A posture choice for
        # legibility: the theatre's camera sits about 20 degrees above the body, and a flat blade is seen edge-on.
        if roll:
            c, s = math.cos(roll), math.sin(roll)
            a, n = (a * c - n * s).normalized(), (n * c + a * s).normalized()
        self.d, self.a, self.n = d.normalized(), a, n

    def __call__(self, s, c, lift=0.0):
        bow = self.camber * math.sin(math.pi * min(max(s, 0), 1)) * (1 - (2 * (c + 0.04) / 0.3) ** 2)
        return self.h + self.d * (s * self.L) + self.a * (c * self.L) + self.n * (bow * self.L + lift)

    def inverse(self, p):
        r = Vector(p) - self.h
        return r.dot(self.d) / self.L, r.dot(self.a) / self.L


def wing_membrane(lib, name, W, mat, rings=12, per=6):
    out = closed_cr(WING_OUTLINE, per)
    cs = (0.5, -0.04)
    verts = [tuple(W(*cs))]
    faces = []
    m = len(out)
    for r in range(1, rings + 1):
        f = (r / rings) ** 0.85
        for (s, c) in out:
            verts.append(tuple(W(cs[0] + (s - cs[0]) * f, cs[1] + (c - cs[1]) * f)))
    for i in range(m):
        faces.append((0, 1 + i, 1 + (i + 1) % m))
    for r in range(rings - 1):
        a, b = 1 + r * m, 1 + (r + 1) * m
        for i in range(m):
            faces.append((a + i, b + i, b + (i + 1) % m, a + (i + 1) % m))
    ob = lib.mesh_object(name, verts, faces, mat)
    return ob, out


def wing_tint(W):
    """A faint thin-film tint (illustrative), strongest near the membrane's middle, plus pale base."""
    base = hexrgb('#90887b')            # smoky grey-brown, so the blade reads against a light page
    rim_col = hexrgb('#5e5446')         # a darker trailing-edge rim
    lower = sorted((s, c) for s, c in WING_OUTLINE if c < 0)

    def trailing(s):
        """The outline's chord coordinate on the trailing (c < 0) side at span s."""
        if s <= lower[0][0]:
            return lower[0][1]
        for (s0, c0), (s1, c1) in zip(lower, lower[1:]):
            if s0 <= s <= s1:
                return c0 + (c1 - c0) * (s - s0) / max(s1 - s0, 1e-9)
        return lower[-1][1]

    def fn(p, n):
        s, c = W.inverse(p)
        ph = 2.2 * s - 3.0 * c
        t = 0.5 + 0.5 * math.sin(ph * math.pi * 2)
        tint = mix(hexrgb('#9a8ea2'), hexrgb('#8a9c90'), t)
        w = 0.35 * smoothstep(0.12, 0.45, s) * (1 - smoothstep(0.85, 1.0, s))
        col = mix(base, tint, w)
        if c < 0:
            col = mix(col, rim_col, 0.8 * smoothstep(0.72, 0.97, c / min(trailing(s), -1e-3)))
        col = mix(col, rim_col, 0.6 * smoothstep(0.93, 1.0, s))
        return mix(col, hexrgb('#a08f78'), 1 - smoothstep(0.0, 0.1, s))
    return fn


def adult_wing(lib, M, s):
    k = lib.side_sign(s)
    W = WingFrame(k, (0.80, 0.33, 0.25 * k), 2.05, sweep=math.radians(66), dihedral=math.radians(8), camber=0.018,
                  roll=k * math.radians(28))
    w, outline = wing_membrane(lib, 'wing', W, M['wing'])
    paint(lib, w, wing_tint(W))
    lib.part(w, 'wing', s)
    note(w, 'wing')
    lift = 0.0035
    tubes = []
    # costa: along the leading edge from the base round the tip to L4's end
    lead = [p for p in closed_cr(WING_OUTLINE, 6)]
    end = VEINS['L4'][-1]
    i_end = min(range(len(lead) // 2 + 10), key=lambda i: (lead[i][0] - end[0]) ** 2 + (lead[i][1] - end[1]) ** 2)
    costa = lead[:i_end + 1]
    costa = [(ss - 0.004, cc - 0.004) for ss, cc in costa[::2]]
    tubes.append(lib.tube('costa', [tuple(W(ss, cc, lift)) for ss, cc in costa],
                          [0.0085 * (1 - 0.45 * j / len(costa)) for j in range(len(costa))], M['vein'], sides=6, samples=70))
    for name, pts in VEINS.items():
        r0 = 0.0052 if name.startswith('L') else 0.004
        rr = [r0 * (1 - 0.45 * j / max(1, len(pts) - 1)) for j in range(len(pts))]
        tubes.append(lib.tube(name, [tuple(W(ss, cc, lift)) for ss, cc in pts], rr, M['vein'], sides=6,
                              samples=8 if name in ('acv', 'pcv') else 36))
    veins = lib.join(tubes, 'veins')
    lib.deco(veins, w, 'veins')
    # marginal fringe on the trailing edge and short costal bristles on the leading edge
    items = []
    for j, (ss, cc) in enumerate(outline):
        if cc < -0.03 and 0.12 < ss < 0.985 and j % 2 == 0:
            p = W(ss, cc)
            q = W(ss + (ss - 0.5) * 0.025, cc - 0.022)
            items.append(([tuple(p), tuple(p + (q - p).normalized() * 0.035)], 0.0018))
        if cc > 0.05 and 0.05 < ss < 0.6 and j % 1 == 0:
            p = W(ss, cc, lift)
            items.append(([tuple(p), tuple(p + W.d * 0.03 + W.n * 0.01 + W.a * 0.006)], 0.0026))
    fr = lines(lib, 'fringe', items, M['fringe'], sides=3)
    if fr:
        lib.deco(fr, w, 'fringe')
    # wing hinge: a small sclerotised knuckle
    hinge = lib.ellipsoid('hinge', tuple(W(0.01, -0.005)), (0.05, 0.035, 0.05), M['leg'], segments=12, rings=8)
    flat(lib, hinge, '#9d6c38')
    lib.deco(hinge, w, 'hinge')


def adult_haltere(lib, M, s):
    k = lib.side_sign(s)
    st = lib.tube('haltere_stalk', [(0.43, 0.24, 0.26 * k), (0.395, 0.25, 0.31 * k), (0.355, 0.245, 0.345 * k)], [0.013, 0.01, 0.012],
                  M['haltere'], sides=8)
    knob = lib.ellipsoid('haltere_knob', (0.335, 0.243, 0.365 * k), (0.042, 0.036, 0.034), M['haltere'], segments=14, rings=10)
    h = lib.join([st, knob], 'haltere')
    lib.part(h, 'haltere', s)

# ------------------------------------------------------------------------------------------------- legs


# Joint positions (right side), leg i = 0 hind, 1 mid, 2 fore: coxa base, coxa end, trochanter end, knee,
# tibia end, tarsus end. A standing pose: fore legs reach forward, mid legs out, hind legs back.
LEGS = {
    2: [(0.98, -0.20, 0.10), (1.02, -0.36, 0.17), (1.04, -0.41, 0.21), (1.30, -0.22, 0.46), (1.50, -0.80, 0.58), (1.84, -0.93, 0.66)],
    1: [(0.64, -0.25, 0.14), (0.63, -0.38, 0.21), (0.63, -0.42, 0.25), (0.67, -0.20, 0.68), (0.64, -0.82, 0.93), (0.55, -0.93, 1.24)],
    0: [(0.40, -0.23, 0.13), (0.35, -0.37, 0.20), (0.33, -0.41, 0.24), (0.08, -0.17, 0.57), (-0.24, -0.80, 0.73), (-0.6, -0.93, 0.83)],
}
TARSI = [0.36, 0.17, 0.15, 0.13, 0.19]


def leg_colour(p, n):
    y = p[1]
    return mix(hexrgb('#b3824a'), hexrgb('#6a4628'), smoothstep(-0.7, -0.92, y))


def adult_leg(lib, M, s, i, fold=None, mat=None):
    """One jointed leg: coxa, trochanter, femur, tibia, five tarsomeres, claws and pulvilli."""
    k = lib.side_sign(s)
    J = [Vector((x, y, z * k)) for x, y, z in LEGS[i]]
    if fold is not None:
        J = [Vector(fold(tuple(p))) for p in J]
    segs = []

    def seg(a, b, r0, r1, bulge=1.08, sides=10):
        m = (a + b) * 0.5
        segs.append(lib.tube('seg', [tuple(a), tuple(m), tuple(b)], [r0, max(r0, r1) * bulge, r1], mat or M['leg'], sides=sides, samples=10))

    fore = 1.15 if i == 2 else 1.0
    seg(J[0], J[1], 0.055 * fore, 0.045, 1.0)               # coxa
    seg(J[1], J[2], 0.036, 0.034, 1.0, 10)                  # trochanter
    seg(J[2], J[3], 0.04 * fore, 0.032, 1.18)               # femur
    seg(J[3], J[4], 0.028, 0.024, 1.06)                     # tibia
    # tarsus: five tarsomeres along a gentle arch from the tibia's end to the foot
    a, b = J[4], J[5]
    acc, prev = 0.0, a
    pts = []
    for f in TARSI:
        acc += f
        p = a.lerp(b, acc)
        p.y += 0.04 * math.sin(math.pi * acc) if fold is None else 0.0
        pts.append(p)
    for j, p in enumerate(pts):
        r = 0.02 - 0.0018 * j
        seg(prev, p, r, r * 0.85, 1.05, 8)
        prev = p
    leg = lib.join(segs, 'leg')
    paint(lib, leg, leg_colour if fold is None else (lambda p, n: hexrgb('#efe5d1')))
    lib.part(leg, 'leg', s, i)
    note(leg, 'leg')
    if fold is not None:
        return leg
    d = (b - a).normalized()
    side = Vector((0, 0, 1)).cross(d).normalized() if abs(d.z) < 0.9 else Vector((1, 0, 0))
    claws = []
    for sg in (1, -1):
        base = b + side * 0.008 * sg
        claws.append(([tuple(base), tuple(base + d * 0.03 + Vector((0, -0.01, 0))), tuple(base + d * 0.042 + Vector((0, -0.032, 0)))], 0.0055))
    cl = lines(lib, 'claws', claws, M['claw'], sides=4)
    pv = lib.ellipsoid('pulvilli', tuple(b + d * 0.02 + Vector((0, -0.015, 0))), (0.022, 0.009, 0.016), M['pulvillus'], segments=10, rings=6)
    lib.deco(cl, leg, 'claws')
    lib.deco(pv, leg, 'pulvilli')
    br = lib.instance_on_surface('leg_bristles', leg, lib.proto_hair(bend=0.4), 260, M['bristle'], length=(0.022, 0.04),
                                 radius=0.0026, seed=20 + i + (0 if k > 0 else 9), lean=(d.x, -1.0, d.z), lean_amount=1.1,
                                 mask=lambda p, n: p[1] > -0.9, budget_tris=1000)
    if br is not None:
        lib.deco(br, leg, 'bristles')
    return leg

# --------------------------------------------------------------------------------------------- interior


def interior(lib, M, fit=None, pupal=False):
    """Organs inside the adult (or, with pupal=True, the pharate adult), at the frame's slots."""
    F = fit or (lambda p: p)

    def T(ob):
        return lib.transform(ob, F) if fit else ob

    # brain: two hemispheres, optic lobes reaching toward the eyes, antennal lobes, the suboesophageal zone
    bx, by, _ = lib.slot('brain')
    br = T(lib.blob('brain', [((bx - 0.02, by + 0.02, 0.06), (0.085, 0.08, 0.07)), ((bx - 0.02, by + 0.02, -0.06), (0.085, 0.08, 0.07)),
                              ((bx + 0.03, by - 0.01, 0.17), (0.06, 0.09, 0.05)), ((bx + 0.03, by - 0.01, -0.17), (0.06, 0.09, 0.05)),
                              ((bx + 0.09, by - 0.05, 0.035), 0.035), ((bx + 0.09, by - 0.05, -0.035), 0.035),
                              ((bx - 0.01, by - 0.13, 0.0), (0.06, 0.045, 0.06))], M['brain'], resolution=0.014))
    lib.part(br, 'brain')
    # flight muscles: dorsal longitudinal bundles arching under the notum, dorsoventral bundles at the sides
    for s in SIDES:
        k = lib.side_sign(s)
        fx, fy, fz = lib.slot('flight_muscle', s)
        fibres = []
        for row in range(3):
            for col in range(2):
                z = (0.045 + 0.05 * col) * k
                yb = 0.26 - 0.09 * row
                pts = [(0.30, yb - 0.04, z), (0.50, yb + 0.03, z), (0.75, yb + 0.04, z), (0.98, yb - 0.04, z)]
                fibres.append(lib.tube('dlm', pts, [0.034, 0.046, 0.046, 0.032], M['muscle'], sides=10, samples=22, flatten=0.8))
        for x in (0.52, 0.76):
            fibres.append(lib.tube('dvm', [(x, 0.28, 0.19 * k), (x + 0.03, 0.05, 0.235 * k), (x + 0.01, -0.18, 0.19 * k)], [0.045, 0.06, 0.042],
                                   M['muscle'], sides=10, samples=16))
        fm = T(lib.join(fibres, 'flight_muscle'))
        lib.part(fm, 'flight_muscle', s)
    # gut: oesophagus, proventriculus, crop on its duct, looping midgut, hindgut and rectum
    gx, gy, _ = lib.slot('gut')
    path = [(1.58, -0.17, 0), (1.48, -0.06, 0), (1.32, -0.03, 0), (1.12, -0.04, 0), (0.95, -0.06, 0)]
    oes = lib.tube('oesophagus', path, [0.018, 0.018, 0.018, 0.02, 0.022], M['gut'], sides=10, samples=30)
    prov = lib.ellipsoid('proventriculus', (0.90, -0.07, 0), (0.07, 0.06, 0.06), M['gut'], segments=16, rings=10)
    mid = lib.tube('midgut', [(0.86, -0.08, 0), (0.6, -0.1, 0.02), (0.3, -0.12, 0.0), (0.05, -0.14, 0.12), (-0.25, -0.15, 0.14),
                              (-0.42, -0.06, 0.0), (-0.25, 0.04, -0.13), (gx, gy, -0.17), (0.02, -0.06, -0.06), (-0.12, -0.1, 0.06),
                              (-0.45, -0.18, 0.08), (-0.58, -0.08, 0.0)],
                   [0.03, 0.034, 0.038, 0.045, 0.05, 0.05, 0.048, 0.046, 0.044, 0.044, 0.042, 0.04], M['gut'], sides=12, samples=120)
    hind = lib.tube('hindgut', [(-0.58, -0.08, 0.0), (-0.75, -0.02, -0.04), (-0.92, 0.0, 0.0), (-1.05, -0.03, 0)], [0.03, 0.028, 0.03, 0.03],
                    M['gut'], sides=10, samples=24)
    rect = lib.ellipsoid('rectum', (-1.08, -0.04, 0), (0.09, 0.065, 0.06), M['gut'], segments=16, rings=10)
    parts = [oes, prov, mid, hind, rect]
    if not pupal:
        duct = lib.tube('crop_duct', [(0.95, -0.08, 0), (0.6, -0.2, -0.05), (0.25, -0.24, -0.06)], 0.009, M['gut'], sides=6, samples=20)
        crop = lib.blob('crop', [((0.12, -0.23, -0.07), (0.1, 0.06, 0.08)), ((0.04, -0.21, -0.02), (0.08, 0.05, 0.07))], M['crop'], resolution=0.014)
        parts += [duct, crop]
    else:
        parts.append(lib.blob('yellow_body', [((-0.15, -0.1, 0.0), 0.1), ((-0.25, -0.08, 0.05), 0.08)], M['yellow_body'], resolution=0.014))
    gut = T(lib.join(parts, 'gut'))
    lib.part(gut, 'gut')
    # fat body: lobed sheets under the dorsal and lateral abdominal wall (loose cells in the pupa)
    for s in SIDES:
        k = lib.side_sign(s)
        fx, fy, fz = lib.slot('fat_body', s)
        if pupal:
            import random
            rng = random.Random(31 if k > 0 else 37)
            cells = []
            for j in range(26):
                cells.append(lib.icosphere('fat_cell', (rng.uniform(-0.8, 0.15), rng.uniform(-0.05, 0.25), k * rng.uniform(0.08, 0.3)),
                                           rng.uniform(0.025, 0.04), M['fat'], subdiv=2))
            fb = T(lib.join(cells, 'fat_body'))
        else:
            balls = []
            for j in range(9):
                x = 0.12 - 0.12 * j
                ang = 0.55 + 0.35 * math.sin(j * 1.7)
                ry, rz, yc = abdomen_fn(x)
                rr = 0.78
                balls.append(((x, yc + ry * rr * math.cos(ang), k * rz * rr * math.sin(ang)), (0.07, 0.05, 0.06)))
                ang2 = 1.15 + 0.2 * math.cos(j * 2.3)
                balls.append(((x - 0.05, yc + ry * rr * math.cos(ang2), k * rz * rr * math.sin(ang2)), (0.06, 0.05, 0.05)))
            balls.append(((fx, fy, fz), 0.07))
            fb = T(lib.blob('fat_body', balls, M['fat'], resolution=0.02))
            lib.displace_noise(fb, 0.008, 22.0, seed=3 if k > 0 else 4)
        lib.part(fb, 'fat_body', s)
        note(fb, 'fat_body') if pupal else None
    # Malpighian tubules: an anterior and a posterior tubule a side, from the midgut-hindgut junction
    for s in SIDES:
        k = lib.side_sign(s)
        mx, my, mz = lib.slot('malpighian', s)
        a = lib.tube('malpighian_a', [(-0.58, -0.08, 0.03 * k), (-0.45, 0.02, 0.14 * k), (-0.25, 0.10, 0.22 * k), (-0.05, 0.14, 0.2 * k),
                                      (-0.2, 0.18, 0.12 * k), (mx + 0.15, my, mz)], 0.014, M['malp'], sides=7, samples=50)
        b = lib.tube('malpighian_p', [(-0.58, -0.08, 0.03 * k), (mx, my - 0.06, mz * 0.9), (-0.85, 0.12, 0.22 * k), (-1.0, 0.05, 0.16 * k),
                                      (-0.9, -0.05, 0.1 * k), (-0.75, 0.04, 0.18 * k)], 0.014, M['malp'], sides=7, samples=50)
        m = T(lib.join([a, b], 'malpighian'))
        lib.part(m, 'malpighian', s)
    # ovaries: a bundle of ovarioles each, egg chambers growing toward the oviduct
    for s in SIDES:
        k = lib.side_sign(s)
        ox, oy, oz = lib.slot('gonad', s)
        parts = []
        n_ov = 8 if pupal else 12
        for j in range(n_ov):
            a = 2 * math.pi * j / n_ov
            off = Vector((0, 0.055 * math.cos(a), 0.05 * math.sin(a)))
            beads = 4 if pupal else 6
            for b in range(beads):
                t = b / (beads - 1)
                p = Vector((ox + 0.16 - 0.3 * t, oy, oz)) + off * (0.55 + 0.6 * math.sin(math.pi * (0.2 + 0.7 * t)))
                r = (0.012 + 0.028 * t ** 1.5) * (0.6 if pupal else 1.0)
                parts.append(lib.icosphere('egg_chamber', tuple(p), r, M['oocyte'] if b == beads - 1 and not pupal else M['ovary'], subdiv=2 if r > 0.025 else 1))
        sheath = lib.ellipsoid('ovary_sheath', (ox, oy, oz), (0.2, 0.11, 0.1) if not pupal else (0.12, 0.07, 0.065), M['ovary'],
                               segments=20, rings=12)
        lib.transform(sheath, lambda p: (p[0], p[1], p[2]))
        duct = lib.tube('oviduct', [(ox - 0.16, oy, oz), (ox - 0.3, oy - 0.03, oz * 0.5), (-1.0, -0.12, 0.0)], 0.016, M['ovary'], sides=8)
        g = T(lib.join(parts + [duct], 'gonad'))
        lib.part(g, 'gonad', s)
        note(g, 'gonad')
        sh = T(sheath)
        sh.data.materials.clear()
        sh.data.materials.append(M['sheath'])
        lib.deco(sh, g, 'peritoneal_sheath')
    # dorsal vessel: chambered heart in the abdomen, aorta forward through the thorax to the brain
    hx, hy, _ = lib.slot('heart')
    ctrl, rad = [], []
    for j in range(9):
        x = -0.95 + 0.13 * j
        ry, rz, yc = abdomen_fn(x)
        ctrl.append((x, yc + ry - 0.07, 0))
        rad.append(0.03 if j % 2 == 0 else 0.022)
    ctrl += [(0.3, 0.31, 0), (0.7, 0.36, 0), (1.05, 0.22, 0), (1.3, 0.16, 0)]
    rad += [0.016, 0.013, 0.012, 0.01]
    ht = T(lib.tube('heart', ctrl, rad, M['heart'], sides=10, samples=90))
    lib.part(ht, 'heart')
    # ventral nerve cord: the fused thoracico-abdominal ganglion, cervical connective, leg and abdominal nerves
    nx, ny, _ = lib.slot('nerve_cord')
    parts = [lib.tube('cervical', [(1.42, -0.06, 0), (1.25, -0.08, 0), (1.05, -0.16, 0)], 0.022, M['nerve'], sides=10),
             lib.blob('ganglion', [((0.95, -0.2, 0), (0.09, 0.055, 0.075)), ((0.78, -0.22, 0), (0.09, 0.06, 0.085)),
                                   ((0.6, -0.22, 0), (0.08, 0.055, 0.08)), ((0.46, -0.21, 0), (0.07, 0.05, 0.06))], M['nerve'], resolution=0.012),
             lib.tube('abdominal_nerve', [(0.42, -0.2, 0), (0.1, -0.24, 0), (nx - 0.3, ny + 0.02, 0), (-0.75, -0.2, 0)], [0.018, 0.012, 0.01, 0.006],
                      M['nerve'], sides=8)]
    if not pupal:
        for k in (1, -1):
            for i in range(3):
                c = Vector(LEGS[i][0])
                parts.append(lib.tube('leg_nerve', [(0.5 + 0.22 * i, -0.22, 0.05 * k), (c.x, c.y - 0.04, c.z * k * 0.8)], 0.008, M['nerve'], sides=6))
    vn = T(lib.join(parts, 'nerve_cord'))
    lib.part(vn, 'nerve_cord')
    # tracheae: abdominal air sacs and the lateral trunks with their spiracles
    for s in SIDES:
        k = lib.side_sign(s)
        tx, ty, tz = lib.slot('trachea', s)
        sac = lib.blob('air_sac', [((0.06, 0.1, 0.16 * k), (0.11, 0.07, 0.06)), ((-0.16, 0.1, 0.2 * k), (0.1, 0.07, 0.06))],
                       M['airsac'], resolution=0.016)
        trunks = [lib.tube('trunk', [(1.1, 0.06, 0.18 * k), (0.8, 0.0, 0.28 * k), (0.45, 0.04, 0.26 * k), (0.2, 0.0, 0.22 * k),
                                     (-0.4, 0.02, 0.3 * k), (-0.8, 0.0, 0.26 * k), (-1.05, -0.02, 0.14 * k)],
                           [0.012, 0.016, 0.016, 0.018, 0.016, 0.013, 0.009], M['trachea'], sides=8, samples=60)]
        for x in (0.0, -0.21, -0.42, -0.63, -0.84):
            ry, rz, yc = abdomen_fn(x)
            trunks.append(lib.tube('branch', [(x, 0.0, 0.29 * k), (x - 0.03, yc + 0.06, rz * 0.92 * k)], [0.008, 0.006], M['trachea'], sides=6, samples=8))
        tr = T(lib.join([sac] + trunks, 'trachea'))
        lib.part(tr, 'trachea', s)

# ------------------------------------------------------------------------------------------------ larva


L_BOUNDS = [1.36, 1.15, 0.95, 0.75, 0.505, 0.26, 0.015, -0.23, -0.475, -0.72, -0.965, -1.21]   # head|T1|T2|T3|A1..A8


def larva_R(x):
    """Body radius of the maggot: a cone in front, a long even trunk, a blunt rear; grooves at segment borders."""
    pts = [(1.64, 0.003), (1.60, 0.07), (1.5, 0.13), (1.36, 0.195), (1.15, 0.262), (0.95, 0.31), (0.75, 0.34), (0.3, 0.37),
           (-0.5, 0.372), (-1.0, 0.345), (-1.3, 0.29), (-1.5, 0.215), (-1.6, 0.12), (-1.645, 0.003)]
    for (x0, r0), (x1, r1) in zip(pts, pts[1:]):
        if x1 <= x <= x0:
            t = (x0 - x) / (x0 - x1)
            t = t * t * (3 - 2 * t) * 0.35 + t * 0.65
            r = r0 + (r1 - r0) * t
            break
    else:
        r = 0.003
    g = min(abs(x - b) for b in L_BOUNDS)
    return r * (1 - 0.045 * math.exp(-(g / 0.022) ** 2))


def larva_fn(x):
    r = larva_R(x)
    return r * 0.93, r, -0.01


def larva_colour(p, n):
    x = p[0]
    c = hexrgb('#efe4cb')
    g = min(abs(x - b) for b in L_BOUNDS)
    c = mix(c, hexrgb('#c9b58c'), 0.75 * math.exp(-(g / 0.024) ** 2))
    return mix(c, hexrgb('#fbf8f0'), smoothstep(0.2, 0.9, n[1]) * 0.5)


def denticle_band(lib, b, mat, n_x=7, n_a=20):
    """One raised ventral band just in front of the segment border at x = b (page units): a strip over the
    ventral arc, its height swelling in the middle and fading at both edges into the body wall."""
    xs = [b - 0.06 + 0.046 * i / (n_x - 1) for i in range(n_x)]
    angs = [-0.8 + 1.6 * j / (n_a - 1) for j in range(n_a)]
    verts, faces = [], []
    for x in xs:
        u = (x - xs[0]) / (xs[-1] - xs[0])
        ry, rz, yc = larva_fn(x)
        for a in angs:
            h = 0.002 + 0.008 * math.sin(math.pi * u) ** 0.7 * (1 - smoothstep(0.55, 0.8, abs(a)))
            verts.append((x, yc - (ry + h) * math.cos(a), (rz + h) * math.sin(a)))
    for i in range(n_x - 1):
        for j in range(n_a - 1):
            a0, b0 = i * n_a + j, (i + 1) * n_a + j
            faces.append((a0, a0 + 1, b0 + 1, b0))
    ob = lib.mesh_object('denticle_band', verts, faces, mat)
    return ob


def larva(lib, M):
    """A third-instar maggot, head at +x, x in about [-1.65, 1.65]."""
    def region(name, x0, x1, n):
        ob = lib.lathe(name, profile(larva_fn, x0, x1, n), M['larva'], sides=40, samples=n, subdiv=0, cap=False)
        paint(lib, ob, larva_colour)
        return ob
    head = region('head', 1.645, 1.355, 16)
    lib.part(head, 'head')
    thor = region('thorax', 1.36, 0.745, 30)
    lib.part(thor, 'thorax')
    abd = region('abdomen', 0.75, -1.645, 110)
    lib.part(abd, 'abdomen')
    # ventral denticle belts at the front of each abdominal segment: one raised, darker band per segment with
    # two rows of larger hooks on it. (Thousands of micro-hooks read as grey dust at the theatre's distance; a
    # band reads as a belt. The band width, the two rows and the hook count are illustrative.)
    belts = L_BOUNDS[3:-1] + [L_BOUNDS[-1]]
    den = [denticle_band(lib, b, M['denticle']) for b in belts]
    hooks = []
    for j, b in enumerate(belts):
        for row, xr in enumerate((b - 0.046, b - 0.026)):
            ry, rz, yc = larva_fn(xr)
            for q in range(8):
                a = -0.62 + 1.24 * (q + 0.5 * (row % 2)) / 8.0
                base = Vector((xr, yc - (ry + 0.012) * math.cos(a), (rz + 0.012) * math.sin(a)))
                out = Vector((0.0, -math.cos(a), math.sin(a)))
                hooks.append(([tuple(base), tuple(base + out * 0.011 + Vector((-0.005, 0, 0))), tuple(base + out * 0.014 + Vector((-0.014, 0, 0)))], 0.0045))
    hk_ob = lines(lib, 'denticle_hooks', hooks, M['denticle_hook'], sides=4)
    lib.deco(lib.join(den + ([hk_ob] if hk_ob else []), 'denticle_belts'), abd, 'denticle_belts')
    # creeping welts: faint transverse ridges between the belts, drawn as fine lines
    # mouth hooks and the cephalopharyngeal skeleton, black, seen through the head
    sk = []
    for k in (1, -1):
        sk.append(([(1.50, -0.03, 0.02 * k), (1.60, -0.045, 0.022 * k), (1.655, -0.075, 0.02 * k), (1.665, -0.11, 0.016 * k)], 0.012))
        sk.append(([(1.46, 0.0, 0.026 * k), (1.36, 0.05, 0.038 * k), (1.22, 0.1, 0.042 * k)], 0.016))   # dorsal cornu
        sk.append(([(1.46, -0.03, 0.026 * k), (1.34, -0.045, 0.038 * k), (1.2, -0.02, 0.042 * k)], 0.016))  # ventral cornu
    hk = lines(lib, 'mouth_hooks', sk, M['sclerite'], sides=6)
    hpiece = lib.tube('h_piece', [(1.43, -0.015, 0.035), (1.43, -0.015, -0.035)], 0.014, M['sclerite'], sides=8)
    mo = lib.join([hk, hpiece], 'mouthpart')
    lib.part(mo, 'mouthpart')
    # brain hemispheres and the short larval ventral nerve cord, with segmental nerves fanning back
    br = lib.blob('brain', [((1.0, 0.07, 0.075), 0.085), ((1.0, 0.07, -0.075), 0.085)], M['brain'], resolution=0.012)
    lib.part(br, 'brain')
    vnc = lib.tube('nerve_cord', [(1.0, -0.02, 0), (0.82, -0.08, 0), (0.62, -0.11, 0), (0.5, -0.12, 0)], [0.05, 0.05, 0.04, 0.02],
                   M['nerve'], sides=14, samples=24)
    nerves = [vnc]
    for k in (1, -1):
        for j, b in enumerate(L_BOUNDS[2:]):
            nerves.append(lib.tube('segmental_nerve', [(0.56, -0.12, 0.01 * k), (b + 0.12, -0.2, 0.2 * k), (b, -0.22, 0.3 * k)], 0.0045,
                                   M['nerve'], sides=5, samples=12))
    vn = lib.join(nerves, 'nerve_cord')
    lib.part(vn, 'nerve_cord')
    # gut: oesophagus, proventriculus with gastric caeca, a long coiled midgut, hindgut to the anal pads
    gp = [(1.5, -0.04, 0), (1.25, -0.02, 0), (1.02, -0.02, 0), (0.86, -0.04, 0)]
    oes = lib.tube('oesophagus', gp, 0.022, M['larval_gut'], sides=10, samples=20)
    prov = lib.ellipsoid('proventriculus', (0.82, -0.04, 0), (0.06, 0.055, 0.055), M['larval_gut'], segments=14, rings=10)
    caeca = [lib.tube('caecum', [(0.76, -0.04, 0), (0.74 + 0.06 * math.cos(a), -0.04 + 0.1 * math.sin(a), 0.1 * math.cos(a + 1)),
                                 (0.86 + 0.06 * math.cos(a), -0.04 + 0.16 * math.sin(a), 0.14 * math.cos(a + 1))], [0.03, 0.026, 0.02],
                      M['larval_gut'], sides=8, samples=12) for a in (0.6, 2.2, 3.8, 5.4)]
    mid = lib.tube('midgut', [(0.76, -0.04, 0), (0.45, -0.1, 0.14), (0.15, -0.12, -0.16), (-0.15, -0.06, 0.16), (-0.42, -0.14, -0.12),
                              (-0.2, 0.06, -0.04), (0.25, 0.02, 0.1), (-0.05, -0.16, 0.05), (-0.6, -0.04, 0.12), (-0.88, -0.12, -0.08),
                              (-1.02, 0.02, 0.06)], 0.045, M['larval_gut'], sides=12, samples=150)
    hind = lib.tube('hindgut', [(-1.02, 0.02, 0.06), (-1.2, 0.0, 0.0), (-1.34, -0.06, 0), (-1.43, -0.13, 0)], [0.04, 0.035, 0.03, 0.025],
                    M['larval_gut'], sides=10, samples=24)
    sal = [lib.blob('salivary_gland', [((1.0 - 0.1 * j, -0.0 + 0.02 * j, 0.14 * k), 0.045 + 0.004 * j) for j in range(7)] +
                    [((1.1, -0.04, 0.06 * k), 0.02)], M['salivary'], resolution=0.016) for k in (1, -1)]
    gut = lib.join([oes, prov, mid, hind] + caeca, 'gut')
    lib.part(gut, 'gut')
    sg = lib.join(sal, 'salivary_glands')
    lib.deco(sg, gut, 'salivary_glands')
    # The salivary glands are an organ of their own, not part of the gut: drawn by the salivary gland's state.
    sg['requires'] = ['UBERON_0001044', '/saliva|salivary gland/i']
    sg['depicts'] = 'salivary glands'
    for s in SIDES:
        k = lib.side_sign(s)
        # fat body: big lobed sheets filling the sides
        balls = []
        for j in range(20):
            x = 0.72 - 0.1 * j
            r = larva_R(x)
            for ang, sz in ((0.85, (0.08, 0.045, 0.06)), (1.4, (0.07, 0.04, 0.05))):
                a = ang + 0.15 * math.sin(j * 1.9 + ang)
                balls.append(((x + 0.03 * math.sin(j + ang), r * 0.74 * math.cos(a), k * r * 0.74 * math.sin(a)), sz))
        fb = lib.blob('fat_body', balls, M['larval_fat'], resolution=0.026)
        lib.displace_noise(fb, 0.01, 16.0, seed=9 if k > 0 else 10)
        lib.part(fb, 'fat_body', s)
        g = lib.ellipsoid('gonad', (-0.5, 0.14, 0.2 * k), (0.05, 0.04, 0.04), M['ovary'], segments=16, rings=10)
        lib.part(g, 'gonad', s)
        m = lib.join([lib.tube('malpighian', [(-0.98, 0.0, 0.04 * k), (-0.7, 0.08, 0.2 * k), (-0.35, 0.02, 0.22 * k), (-0.1, 0.1, 0.18 * k)], 0.015, M['malp'], sides=7, samples=36),
                      lib.tube('malpighian', [(-0.98, 0.0, 0.04 * k), (-1.15, 0.1, 0.18 * k), (-1.3, 0.02, 0.15 * k), (-1.2, -0.08, 0.1 * k)], 0.015, M['malp'], sides=7, samples=30)],
                     'malpighian')
        lib.part(m, 'malpighian', s)
        # tracheae: the dorsal trunk from anterior to posterior spiracle, transverse connectives, segmental branches
        trunk_pts = [(1.2, 0.16, 0.2 * k), (1.0, 0.2, 0.15 * k)] + [(b, larva_R(b) * 0.62, larva_R(b) * 0.36 * k) for b in L_BOUNDS[3:]] + [(-1.45, 0.13, 0.08 * k), (-1.56, 0.12, 0.075 * k)]
        tr = [lib.tube('dorsal_trunk', trunk_pts, 0.026, M['trachea'], sides=10, samples=90)]
        for b in L_BOUNDS[3:]:
            r = larva_R(b)
            tr.append(lib.tube('branch', [(b, r * 0.62, r * 0.36 * k), (b - 0.06, r * 0.3, r * 0.72 * k), (b - 0.08, -r * 0.2, r * 0.75 * k)],
                               [0.011, 0.008, 0.004], M['trachea'], sides=6, samples=10))
        trach = lib.join(tr, 'trachea')
        lib.part(trach, 'trachea', s)
        # anterior spiracle: a fan of finger-like papillae on T1; posterior spiracle on its stalk at the rear
        base = Vector((1.2, 0.17, 0.15 * k))
        fan = [([tuple(base), tuple(base + Vector((0.02 + 0.015 * math.cos(a), 0.05 + 0.02 * math.sin(a), 0.03 * k + 0.035 * math.sin(a) * k)))], 0.012)
               for a in [j * 0.5 - 1.2 for j in range(6)]]
        an = lines(lib, 'anterior_spiracle', fan, M['spiracle'], sides=6)
        lib.deco(an, trach, 'anterior_spiracle')
        stalk = lib.tube('posterior_spiracle', [(-1.5, 0.12, 0.07 * k), (-1.6, 0.18, 0.08 * k), (-1.66, 0.21, 0.085 * k)], [0.04, 0.034, 0.03],
                         M['spiracle'], sides=12, samples=10)
        plate = lib.ellipsoid('spiracle_plate', (-1.672, 0.215, 0.086 * k), (0.012, 0.034, 0.034), M['sclerite'], segments=14, rings=8)
        sp = lib.join([stalk, plate], 'posterior_spiracle')
        lib.deco(sp, trach, 'posterior_spiracle')
    ht = lib.tube('heart', [(-1.35, 0.25, 0), (-1.0, 0.29, 0), (-0.6, 0.31, 0), (-0.2, 0.31, 0), (0.4, 0.3, 0), (0.9, 0.24, 0)],
                  [0.03, 0.036, 0.034, 0.02, 0.014, 0.01], M['heart'], sides=10, samples=60)
    lib.part(ht, 'heart')
    cu = lib.lathe('cuticle', profile(lambda x: tuple(v + d for v, d in zip(larva_fn(x), (0.012, 0.012, 0))), 1.66, -1.66, 60),
                   M['larva_coat'], sides=32, samples=60, subdiv=0)
    lib.part(cu, 'cuticle')

# -------------------------------------------------------------------------------------------------- pupa


def puparium_R(x):
    t = (x + 1.6) / 3.22
    tt = min(max(t, 0.0), 1.0)
    e = math.sin(math.pi * tt) ** 0.25
    e *= 1 - 0.06 * smoothstep(0.8, 1.0, tt)
    rib = 1 - 0.018 * (0.5 + 0.5 * math.cos((x - 0.03) * 2 * math.pi / 0.245))
    return 0.53 * e * rib


def pupal_eye_cap(lib, k, mat, nx=18, na=22):
    """The developing compound eye as a curved cap that follows the head contour: a patch of the head's own
    surface (head_fn) about the lateral eye site, lifted by at most 0.012 in the middle and closed by an inner
    sheet sunk 0.014 below the surface, so it reads as an eye forming under the pupal cuticle, not as a lens
    stuck on. Footprint about 0.6 of the head radius; illustrative."""
    xc, half_x = 1.50, 0.165
    a0, half_a = 1.30 * k, 0.72                        # angle from dorsal (+y) toward this side
    verts, faces = [], []

    def pt(x, a, lift):
        ry, rz, yc = head_fn(x)
        return (x, yc + (ry + lift) * math.cos(a), (rz + lift) * math.sin(a))
    for layer, sgn in ((0, 1.0), (1, -1.0)):
        for i in range(nx):
            u = -1 + 2 * i / (nx - 1)
            for j in range(na):
                v = -1 + 2 * j / (na - 1)
                w = max(0.0, 1 - u * u - v * v)       # elliptic footprint
                # squeeze the grid onto the ellipse, so the cap's rim is round rather than square
                rr = math.hypot(u, v)
                sc = 1.0 if rr <= 1 else 1.0 / rr
                x = xc + half_x * u * sc
                a = a0 + half_a * v * sc
                lift = (0.012 * w ** 0.5) if sgn > 0 else -0.014 * w ** 0.5
                verts.append(pt(x, a, lift))
    base = nx * na
    for i in range(nx - 1):
        for j in range(na - 1):
            q = (i * na + j, i * na + j + 1, (i + 1) * na + j + 1, (i + 1) * na + j)
            faces.append(q)
            faces.append(tuple(base + t for t in reversed(q)))
    ob = lib.mesh_object('eye', verts, faces, mat)
    lib._fix_normals(ob)
    return ob


def pupa(lib, M):
    """A barrel puparium (the hardened last larval cuticle) around a pharate adult with folded appendages."""
    S = 0.92
    X0 = -1.3       # the adult's posterior tip maps to x = -1.38, its head to about 1.21

    def fit(p):  # pharate adult: the adult plan scaled to fit inside the puparium
        return ((p[0] - X0) * S - 1.38, p[1] * S - 0.02, p[2] * S)

    def pharate_colour(p, n):
        c = mix(hexrgb('#efe3c9'), hexrgb('#fbf6ea'), smoothstep(-0.2, 0.8, n[1]))
        ph = tergite_phase((p[0] + 1.38) / S + X0)
        return mix(c, hexrgb('#d9c7a2'), 0.7 * smoothstep(0.86, 0.98, ph)) if ph is not None and p[0] < 0.2 else c

    ts = [0.5 - 0.5 * math.cos(math.pi * i / 25) for i in range(26)]
    hd = lib.lathe('head', [(1.21 + 0.52 * t,) + tuple(max(v, 0.002) for v in head_fn(1.21 + 0.52 * t)[:2]) + (head_fn(1.21 + 0.52 * t)[2],) for t in ts],
                   M['pharate'], sides=36, samples=36, subdiv=0)
    lib.transform(hd, fit)
    paint(lib, hd, pharate_colour)
    lib.part(hd, 'head')
    th = lib.lathe('thorax', profile(thorax_fn, 0.10, 1.24, 24), M['pharate'], sides=40, samples=30, subdiv=0)
    sculpt_thorax(lib, th)
    lib.transform(th, fit)
    paint(lib, th, pharate_colour)
    lib.part(th, 'thorax')
    ab = lib.lathe('abdomen', profile(abdomen_fn, -1.30, 0.42, 40), M['pharate'], sides=40, samples=70, subdiv=0)
    sculpt_abdomen(lib, ab, 0.05)
    lib.transform(ab, fit)
    paint(lib, ab, pharate_colour)
    lib.part(ab, 'abdomen')
    for s in SIDES:
        k = lib.side_sign(s)
        eye = pupal_eye_cap(lib, k, M['pupal_eye'])
        lib.transform(eye, fit)
        lib.part(eye, 'eye', s)
        note(eye, 'eye')
        ant = lib.ellipsoid('antenna', (1.71, 0.13, 0.08 * k), (0.035, 0.08, 0.035), M['pad'], segments=14, rings=10, rotate=('z', -0.5))
        lib.transform(ant, fit)
        lib.part(ant, 'antenna', s)
        # wing pad: the folded wing as a smooth sheath along the side, tip reaching the third abdominal segment
        wp = lib.ellipsoid('wing', (0.36, -0.1, 0.345 * k), (0.46, 0.13, 0.045), M['pad'], segments=32, rings=16, rotate=('z', 0.3))
        lib.transform(wp, lambda p, k=k: (p[0], p[1], p[2] + k * 0.03 * max(0.0, 1 - ((p[0] - 0.36) / 0.46) ** 2)))
        lib.transform(wp, fit)
        lib.part(wp, 'wing', s)
        hp = lib.ellipsoid('haltere', (0.3, 0.16, 0.33 * k), (0.07, 0.04, 0.03), M['pad'], segments=12, rings=8)
        lib.transform(hp, fit)
        lib.part(hp, 'haltere', s)
        for i in range(3):
            z0 = (0.07 + 0.065 * (2 - i)) * k
            pts = [(LEGS[i][0][0], -0.22, z0), (LEGS[i][0][0] - 0.05, -0.33, z0), (LEGS[i][0][0] - 0.4, -0.37, z0 * 1.05),
                   (LEGS[i][0][0] - 0.8 + 0.12 * i, -0.36, z0 * 1.05), (-0.55 + 0.1 * i, -0.34, z0 * 0.95), (-0.78 + 0.12 * i, -0.3, z0 * 0.9)]
            leg = lib.tube('leg', pts, [0.04, 0.036, 0.034, 0.03, 0.026, 0.02], M['pad'], sides=12, samples=40)
            lib.transform(leg, fit)
            lib.part(leg, 'leg', s, i)
            note(leg, 'leg')
    mo = lib.ellipsoid('mouthpart', (1.58, -0.26, 0.0), (0.09, 0.06, 0.06), M['pad'], segments=16, rings=10, rotate=('z', 0.6))
    lib.transform(mo, fit)
    lib.part(mo, 'mouthpart')
    interior(lib, M, fit=fit, pupal=True)
    # the puparium: barrel-shaped, ribbed at the old segment borders, amber-brown, darker behind
    pu = lib.lathe('cuticle', profile(lambda x: (puparium_R(x) * 0.95, puparium_R(x), 0.0), -1.6, 1.62, 90), M['puparium'],
                   sides=44, samples=110, subdiv=0)

    def pcol(p, n):
        x = p[0]
        c = mix(hexrgb('#a8692e'), hexrgb('#6b3b17'), smoothstep(1.0, -1.4, x))
        c = mix(c, hexrgb('#c08445'), 0.35 * smoothstep(0.2, 0.9, n[1]))
        if abs(x - 1.05) < 0.012 and p[1] > 0.0:           # the operculum's seam, where the adult will emerge
            c = mix(c, hexrgb('#3e2210'), 0.7)
        return c
    paint(lib, pu, pcol)
    lib.part(pu, 'cuticle')
    horns = []
    for k in (1, -1):
        base = Vector((1.3, 0.2, 0.17 * k))
        horns.append(([tuple(base), tuple(base + Vector((0.08, 0.1, 0.05 * k))), tuple(base + Vector((0.12, 0.17, 0.08 * k)))], 0.03))
        for a in range(5):
            tip = base + Vector((0.12, 0.17, 0.08 * k))
            horns.append(([tuple(tip), tuple(tip + Vector((0.03 * math.cos(a), 0.04, 0.03 * math.sin(a) * k)))], 0.01))
        pb = Vector((-1.5, 0.1, 0.05 * k))
        horns.append(([tuple(pb), tuple(pb + Vector((-0.08, 0.06, 0.02 * k)))], 0.03))
    hn = lines(lib, 'spiracles', horns, M['spiracle'], sides=8)
    lib.deco(hn, pu, 'spiracles')
    # The pupa's spiracle horns hang under the puparium (cuticle) but are the tracheal system's openings: drawn by
    # the tracheal system's state, not the cuticle's.
    hn['requires'] = ['/trache|spiracl/i']
    hn['depicts'] = 'spiracles (tracheal system)'

# --------------------------------------------------------------------------------------------------- egg


def egg_fn(x):
    t = x / 1.6
    r = math.sqrt(max(0.0, 1 - t ** 2)) ** 0.9
    # the dorsal side flatter than the ventral (yc drops a little at the ends)
    return 0.55 * r, 0.58 * r, -0.03 * (1 - t * t)


def egg(lib, M):
    """The egg: chorion, dorsal appendages, micropyle; inside, the blastoderm as a fate map and the pole cells.
    The eggshell pieces hang under the fate-map regions (the chorion under the abdomen region, which fills most of
    the egg; the dorsal appendages and micropyle under the head region, where they sit), so the page shows and
    hides them with a slot of the frame rather than with a 'body' slot the frame does not have."""
    def ycol(tone):
        base = hexrgb(tone)
        return lambda p, n: mix(base, hexrgb('#fff6df'), 0.25 * smoothstep(0.3, 1.0, n[1]))

    def band(name, x0, x1, tone):
        ob = lib.lathe(name, profile(lambda x: tuple(v * 0.9 for v in egg_fn(x / 0.95))[:2] + (egg_fn(x / 0.95)[2],), x0, x1, 18), M['yolk'],
                       sides=48, samples=24, subdiv=0, cap=False)
        paint(lib, ob, ycol(tone))
        return ob
    hd_r = lib.part(band('head', 0.95, 1.52, '#efd7a2'), 'head')
    lib.part(band('thorax', 0.45, 0.95, '#ead09a'), 'thorax')
    ab_r = lib.part(band('abdomen', -1.52, 0.45, '#e9cd96'), 'abdomen')
    ch = lib.lathe('chorion', profile(egg_fn, -1.6, 1.6, 90), M['chorion'], sides=128, samples=200, subdiv=0)
    lib.transform(ch, lambda p: (p[0], p[1] if p[1] < 0 else p[1] * 0.92, p[2]))
    from mathutils import noise as _noise

    # the chorion's polygonal relief (the imprints of the follicle cells that made it): Voronoi cell borders,
    # pressed in slightly and drawn a shade darker. Cell size and count are illustrative.
    def edge_at(p):
        try:
            d, _ = _noise.voronoi(Vector(p) * 8.0, distance_metric='DISTANCE')
            return smoothstep(0.07, 0.0, d[1] - d[0])
        except Exception:
            return 0.0
    me = ch.data
    for v in me.vertices:
        e = edge_at(lib.to_page(v.co))
        if e > 0:
            v.co = v.co - v.normal * (0.006 * e)
    me.update()
    paint(lib, ch, lambda p, n: mix(hexrgb('#fbf8f1'), hexrgb('#cbbb98'), 0.85 * edge_at(p)))
    lib.deco(ch, ab_r, 'chorion')
    fil = []
    for k in (1, -1):
        pts = [(1.05, 0.42, 0.09 * k), (1.35, 0.6, 0.15 * k), (1.62, 0.76, 0.22 * k), (1.82, 0.84, 0.28 * k)]
        fil.append(lib.tube('dorsal_appendage', pts, [0.035, 0.028, 0.024, 0.022], M['appendage'], sides=10, samples=30))
        pad = lib.ellipsoid('paddle', (1.9, 0.86, 0.31 * k), (0.12, 0.022, 0.065), M['appendage'], segments=16, rings=8, rotate=('y', -0.4 * k))
        fil.append(pad)
    lib.deco(lib.join(fil, 'dorsal_appendages'), hd_r, 'dorsal_appendages')
    mp = lib.tube('micropyle', [(1.57, 0.0, 0), (1.66, 0.01, 0)], [0.05, 0.03], M['appendage'], sides=12, samples=6)
    lib.deco(mp, hd_r, 'micropyle')

    for s in SIDES:
        k = lib.side_sign(s)
        cells = [((-1.43 + 0.03 * math.cos(j * 2.1), 0.02 + 0.05 * math.sin(j * 1.3), k * (0.02 + 0.035 * ((j * 7) % 5) / 4)), 0.028)
                 for j in range(7)]
        pc = lib.join([lib.icosphere('pole_cell', c, r, M['pole'], subdiv=2) for c, r in cells], 'pole_cells')
        lib.part(pc, 'gonad', s)
