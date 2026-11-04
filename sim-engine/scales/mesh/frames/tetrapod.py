"""Sculptor for the TETRAPOD frame: a small mouse-like mammal (Mus-like) that may carry a gliding patagium.

AN ILLUSTRATION, NOT MORPHOMETRY. Every shape here is drawn by hand after generic textbook drawings of a
laboratory mouse: no specimen was measured, no proportion was taken from a dataset, and nothing is
species-specific beyond "a small rodent". Positions come from body-frames.json through lib.slot() (page
units, +x anterior, +y dorsal, +z the animal's RIGHT); the body is shaped around those slots so the page's
beads for tissues and cells land inside the organ they belong to.

Stage forms, keyed by the stage NAME the design declares (nothing is interpolated between them and
development is not simulated; the page scales each form by the declared length_ratio):

    neonate   pink and hairless, big head, eyes sealed under fused lids, ear flaps folded flat, short limbs
              tucked under a slightly curled body; the patagium is only a low fold of flank skin; the
              stomach is drawn milk-white (the textbook "milk spot" of a suckling pup)
    juvenile  short, sparse, greyer coat, head and ears proportionally larger than the adult's, standing on
              all fours; the patagium hangs as a loose fold of skin between the limbs
    adult     full agouti coat (dark dorsum, pale belly), long ringed tail, drawn in a GLIDING SPREAD with the
              patagium stretched from wrist to ankle

The poses are drawing choices, not data: nothing in any design declares a posture, a gait or that a stage
glides. Each pose-bearing node says so in its glTF extras ('illustration_note').

The full frame library is sculpted at every stage (hindlimbs, tail, wing_membrane included), and the PAGE
decides per ladder whether each slot is present, a ghost or absent. So a limb bone or a tail vertebra is
never drawn inside the skeleton node: that would make a limb look present through the skeleton when the
blueprint lacks it. The skeleton is axial (skull, column ending at the sacrum, ribs, sternum) plus girdles.

The wing_membrane is sized by hand (schematic) unless the spec carries the declared driver
'wing_membrane_area_SL2' (both membranes together, divided by snout-vent length squared). With it, the
adult membrane's free trailing edge bulges out (or in) until the area matches, its corners staying on the
drawn wrists and ankles; the node records the driver as declared, and its note gives the area actually
reached (the bulge is capped, and the note says when that stops it short). Spec drivers come from
sim-engine/scales/mesh/spec.mjs, which today emits none: no design declares a body length, so the
membrane is schematic, and its note quotes the spec's own driver_notes to say why.
"""
import math
import random

import bpy
from mathutils import Vector, noise

SIDES = ('right', 'left')
L = None  # the lib module, set by build()

FORM = {
    'neonate': dict(head=1.4, body=1.04, limb=0.85, ear='folded', ear_s=0.62, fur=0.0, eye='closed', eye_s=0.9,
                    tail=0.5, pose='tucked', curl=0.14, membrane='fold', whisker=0.3, coat='pink', snout=0.62),
    'juvenile': dict(head=1.1, body=1.0, limb=0.9, ear='open', ear_s=1.08, fur=0.5, eye='open', eye_s=1.08,
                     tail=0.82, pose='stand', curl=0.0, membrane='drape', whisker=0.75, coat='juvenile', snout=0.88),
    'adult': dict(head=1.0, body=1.0, limb=1.0, ear='open', ear_s=1.0, fur=1.0, eye='open', eye_s=1.0,
                  tail=1.0, pose='glide', curl=0.0, membrane='spread', whisker=1.0, coat='agouti', flat=0.9),
}

POSE_NOTE = {
    'tucked': 'pose drawn by hand: a newborn lying curled with its limbs tucked. No design declares a posture.',
    'stand': 'pose drawn by hand: standing on all fours with the patagium folded. No design declares a posture or a gait.',
    'glide': 'pose drawn by hand: a gliding spread, limbs out and the patagium stretched. No design declares a posture, '
             'and drawing it is not a claim that this animal glides.',
}

# Coat colours (sRGB): dorsal, flank, belly, hair root, hair tip ticking
COATS = {
    'agouti': dict(dorsal='#46362a', flank='#6b5541', belly='#d2c6b4', root='#2c2420', tip='#8f7455', muzzle='#7d6a58'),
    'juvenile': dict(dorsal='#4f4842', flank='#6f6861', belly='#cfc9be', root='#35302c', tip='#857c70', muzzle='#7c746b'),
    'pink': dict(dorsal='#df8f80', flank='#e8a191', belly='#f0b8aa', root='#df8f80', tip='#e8a191', muzzle='#eaa898'),
}

HEAD_C = (1.56, 0.20)          # page x, y of the head slot (0.78, 0.10) * 2
RUMP_X = -1.06


def _hex(c):
    if isinstance(c, str):
        h = c.lstrip('#')
        return tuple(int(h[k:k + 2], 16) / 255.0 for k in (0, 2, 4))
    return tuple(c[:3])


def _mix(a, b, t):
    a, b = _hex(a), _hex(b)
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def _ss(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------------------------------- body plan


class Body:
    """The body outline of one stage: a smoothed profile (x, ry, rz, yc) from rump to nose, with the head
    scaled about the head slot and the trunk plumped by the stage's FORM."""

    def __init__(self, f):
        hs, bs = f['head'], f['body']
        # A small rodent's outline, drawn by hand (x, vertical radius, lateral radius, centre height):
        #   tail root   a narrow neck of skin (about a fifth of the haunch) the rump rounds down into
        #   haunch      the widest point, over the hips and thighs (x about -0.55), the back highest just in
        #               front of it (the lumbar arch)
        #   waist       a gentle narrowing over the last ribs, the ribcage a little narrower than the haunch
        #   shoulder    a rounded swelling over the forelimb root (x 0.84), lower than the lumbar arch
        #   neck        a clear waist behind the skull: the chin and throat rise above the chest line
        #   skull       wider than the neck at the cheeks, then the tapering muzzle
        base = [
            (-1.10, 0.042, 0.042, 0.10), (-1.05, 0.105, 0.11, 0.095), (-0.97, 0.22, 0.26, 0.088), (-0.84, 0.34, 0.42, 0.082),
            (-0.60, 0.44, 0.55, 0.085), (-0.34, 0.462, 0.535, 0.095), (-0.06, 0.44, 0.48, 0.078), (0.26, 0.405, 0.43, 0.05),
            (0.56, 0.38, 0.4, 0.058), (0.84, 0.335, 0.375, 0.085), (1.08, 0.24, 0.225, 0.14), (1.28, 0.282, 0.268, 0.188),
            (1.47, 0.283, 0.272, 0.208), (1.66, 0.218, 0.208, 0.192), (1.83, 0.138, 0.132, 0.128), (1.95, 0.078, 0.075, 0.08),
            (2.03, 0.035, 0.035, 0.065)]
        SH, NK, OC = 9, 10, 11       # shoulder, neck, back of the skull: used by the neck rule below
        flat = f.get('flat', 1.0)
        prof = []
        for x, ry, rz, yc in base:
            x = snout(x, f)
            w = _ss(0.95, 1.35, x)
            k = 1 + (hs - 1) * w            # head scale, blended in across the neck
            b = 1 + (bs - 1) * (1 - w)      # trunk plumpness
            fl = 1 + (flat - 1) * (1 - w)    # dorsoventral flattening of the trunk
            prof.append((HEAD_C[0] + (x - HEAD_C[0]) * k if w > 0 else x, ry * k * b * fl, rz * k * b / fl ** 0.5,
                         HEAD_C[1] + (yc - HEAD_C[1]) * k if w > 0 else yc))
        # the neck pinches to about 0.76 of the line from shoulder to cranium in an adult (so the head reads as
        # a head), but hardly at all under a pup's big head (which would otherwise leave a hump)
        a, c = prof[SH], prof[OC]
        t = (prof[NK][0] - a[0]) / max(c[0] - a[0], 1e-9)
        lin = [a[j] + (c[j] - a[j]) * t for j in (1, 2)]
        nk = 0.76 + 0.6 * max(0.0, hs - 1.0)
        # (less from above than from the side: a mouse's neck is short and thick)
        prof[NK] = (prof[NK][0], max(prof[NK][1], lin[0] * nk), max(prof[NK][2], lin[1] * (nk + 0.06)), prof[NK][3])
        self.profile = prof
        self.rings = L.catmull(prof, 200)
        self.nose_x = prof[-1][0]
        self.sl = self.nose_x - RUMP_X     # snout-vent length in page units

    def at(self, x):
        """(ry, rz, yc) of the body at page x (clamped to the ends)."""
        r = self.rings
        if x <= r[0][0]:
            return r[0][1:]
        for a, b in zip(r, r[1:]):
            if a[0] <= x <= b[0]:
                t = (x - a[0]) / max(b[0] - a[0], 1e-9)
                return tuple(p + (q - p) * t for p, q in zip(a[1:], b[1:]))
        return r[-1][1:]

    def wall(self, x, a, inset=1.0, side=1.0):
        """A point on the body wall at x and angle a (0 = dorsal midline, pi = ventral), scaled by inset."""
        ry, rz, yc = self.at(x)
        return (x, yc + ry * inset * math.cos(a), side * rz * inset * math.sin(a))

    def belly(self, p):
        """Flatten the trunk's ventral side by 10% (a resting rodent's belly is flatter than its back); the
        head is left round. Applied to every piece of a stage at the end, so organs keep their place inside."""
        x, y, z = p
        ry, rz, yc = self.at(x)
        if y >= yc:
            return p
        k = 0.10 * (1.0 - _ss(0.95, 1.35, x))
        return (x, yc - (yc - y) * (1.0 - k), z)

    def dorsality(self, p):
        """-1 at the ventral midline .. +1 at the dorsal midline, for colouring."""
        ry, rz, yc = self.at(p[0])
        return max(-1.0, min(1.0, (p[1] - yc) / max(ry, 1e-6)))


def snout(x, f):
    """Shorten the muzzle ahead of the eyes by the stage's snout factor (a pup's face is blunt)."""
    return x if x <= 1.70 else 1.70 + (x - 1.70) * f.get('snout', 1.0)


def H(p, f):
    """Scale a head-region point about the head slot by the stage's head scale (muzzle shortened first)."""
    hs = f['head']
    x = snout(p[0], f)
    return (HEAD_C[0] + (x - HEAD_C[0]) * hs, HEAD_C[1] + (p[1] - HEAD_C[1]) * hs, p[2] * hs)


# --------------------------------------------------------------------------------------------- helpers


def paint(ob, fn):
    """Vertex colour 'Col' from fn(page_xyz) -> '#hex' or rgb (sRGB)."""
    me = ob.data
    attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    cache = {}
    for loop in me.loops:
        vi = loop.vertex_index
        c = cache.get(vi)
        if c is None:
            c = _hex(fn(L.to_page(me.vertices[vi].co)))
            cache[vi] = c
        attr.data[loop.index].color_srgb = (c[0], c[1], c[2], 1.0)
    me.update()
    return ob


def ripple(ob, sides, fn):
    """Scale each ring of a lib.tube (built with subdiv=0) about its centre by fn(t, ring_index, n_rings)."""
    me = ob.data
    n = (len(me.vertices) - 2) // sides
    for i in range(n):
        vs = [me.vertices[i * sides + s] for s in range(sides)]
        c = sum((v.co for v in vs), Vector()) / sides
        k = fn(i / max(n - 1, 1), i, n)
        for v in vs:
            v.co = c + (v.co - c) * k
    me.update()
    return ob


def join(objs, name):
    """lib.join, then merge duplicate material slots (lib.join keeps one slot per joined piece, and the glTF
    exporter writes one primitive per slot: a 200-piece skeleton would become 200 draw calls)."""
    ob = L.join(objs, name)
    me = ob.data
    mats = list(me.materials)
    uniq, remap = [], []
    for m in mats:
        if m not in uniq:
            uniq.append(m)
        remap.append(uniq.index(m))
    if len(uniq) < len(mats):
        idx = [0] * len(me.polygons)
        me.polygons.foreach_get('material_index', idx)
        idx = [remap[i] if i < len(remap) else 0 for i in idx]
        me.materials.clear()
        for m in uniq:
            me.materials.append(m)
        me.polygons.foreach_set('material_index', idx)
        me.update()
    return ob


def note(ob, text):
    ob['illustration_note'] = text
    return ob


# Pieces that DEPICT one specific organ hung under another slot's node (the gallbladder under the liver, the
# aorta under the heart). Without this a deco is drawn whenever its parent slot is, so a blueprint with a liver
# but no gallbladder would show a solid gallbladder. extras.requires makes the page style the piece by THAT
# organ's state (sim-engine/scales/mesh/depicts.mjs): ids first, the label regex only when no id is in the
# ladder at all. Generic features of the sculpt (fur, whiskers, claws, tendons, nerves...) carry no requires.
REQUIRES = {
    'gallbladder': (['UBERON_0002110', '/gall ?bladder/i'], 'gallbladder'),
    'parathyroid': (['UBERON_0001132', '/parathyroid/i'], 'parathyroid gland'),
    'aorta': (['UBERON_0000947', '/aort/i'], 'aorta and carotids'),
    'great_veins': (['/vena cava|pulmonary vein/i'], 'venae cavae and pulmonary veins'),
    'adrenal': (['UBERON_0002369', '/adrenal/i'], 'adrenal gland'),
    'ureter': (['UBERON_0000056', '/ureter/i'], 'ureter'),
    'trachea': (['UBERON_0003126', '/trache/i'], 'trachea'),
    'lid': (['UBERON_0001711', '/eyelid/i'], 'eyelids'),
}


def depicts(ob, what):
    req, label = REQUIRES[what]
    ob['requires'] = list(req)
    ob['depicts'] = label
    return ob


def fur(name, target, count, length, width, coat, body, mat, seed=1, mask=None, flat=0.82, comb=(-1.0, -0.12, 0.0),
        length_fn=None, skin_fn=None):
    """A coat of hair cards over `target`: each hair is one thin triangle with a random roll, combed back
    along the body and lying nearly flat, with the shading normal of the skin underneath, so the coat reads
    as soft fur rather than spikes. Colour: the root is the skin's own coat colour there (so a strand melts
    into the pelt instead of reading as a dark stroke), the tip a soft agouti ticking from the coat palette."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = target.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    tris, cum, s = [], [], 0.0
    for lt in me.loop_triangles:
        ids = lt.vertices
        a, b, c = (me.vertices[i].co.copy() for i in ids)
        na, nb, nc = (me.vertices[i].normal.copy() for i in ids)
        area = ((b - a).cross(c - a)).length / 2
        if area > 0:
            s += area
            tris.append((a, b, c, na, nb, nc))
            cum.append(s)
    ev.to_mesh_clear()
    rng = random.Random(seed)
    import bisect
    verts, faces, nrm, col = [], [], [], []
    comb_b = L.P(comb).normalized()
    tries = 0
    placed = 0
    while placed < count and tries < count * 6:
        tries += 1
        k = bisect.bisect_left(cum, rng.random() * s)
        a, b, c, na, nb, nc = tris[min(k, len(tris) - 1)]
        u, v = rng.random(), rng.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        p = a + (b - a) * u + (c - a) * v
        n = (na * (1 - u - v) + nb * u + nc * v).normalized()
        pp = L.to_page(p)
        if mask is not None and not mask(pp):
            continue
        t = comb_b - n * comb_b.dot(n)
        if t.length < 1e-4:
            t = n.orthogonal()
        t.normalize()
        jit = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * 0.35
        d = (t * flat + n * (1 - flat) + jit * 0.5).normalized()
        if d.dot(n) < 0.12:
            d = (d + n * (0.12 - d.dot(n))).normalized()
        Lh = rng.uniform(*length) * (length_fn(pp) if length_fn else 1.0)
        w = rng.uniform(*width)
        s1 = n.cross(d).normalized()
        s2 = d.cross(s1).normalized()
        roll = math.pi / 2 + rng.uniform(-1.0, 1.0) * 0.22
        sw = (s1 * math.cos(roll) + s2 * math.sin(roll)).normalized()
        base = p - n * 0.004
        tip = p + d * Lh
        dz = body.dorsality(pp)
        g = _ss(-0.5, 0.3, dz)
        sk = _hex(skin_fn(pp)) if skin_fn else _mix(coat['belly'], coat['dorsal'], g)
        root = tuple(q * 0.9 for q in sk)                         # the pelt's own colour, a shade deeper
        tipc = _mix(sk, _mix(coat['belly'], coat['tip'], g), 0.45)  # ticked tip, close to the pelt
        j = rng.uniform(0.92, 1.08)
        tipc = tuple(min(1.0, q * j) for q in tipc)
        if rng.random() < 0.04 and dz > -0.2:
            tipc = _mix(sk, '#2d2621', 0.6)       # a darker guard hair here and there
        i0 = len(verts)
        verts += [base - sw * w, base + sw * w, tip]
        faces += [(i0, i0 + 1, i0 + 2)]
        nrm += [n] * 3
        col += [root, root, tipc]
        placed += 1
    if not verts:
        return None
    ob = L.mesh_object(name, [tuple(v) for v in verts], faces, mat, page=False)
    me = ob.data
    attr = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for loop in me.loops:
        c = col[loop.vertex_index]
        attr.data[loop.index].color_srgb = (c[0], c[1], c[2], 1.0)
    try:
        me.normals_split_custom_set_from_vertices([tuple(q) for q in nrm])
    except Exception:
        pass
    me.update()
    return ob


def mats(f):
    lib = L
    coat = f['coat']
    m = {
        'skin': lib.material('tetrapod.skin.' + coat, base='#ffffff', rough=0.5 if coat != 'pink' else 0.36, sheen=0.35,
                             sheen_tint=COATS[coat]['tip'], sheen_rough=0.5, subsurface=0.2, clearcoat=0.3 if coat == 'pink' else 0.0,
                             clearcoat_rough=0.3, alpha=0.5, vertex_color=True),
        'flesh': lib.material('tetrapod.flesh.' + coat, base='#ffffff', rough=0.62, sheen=0.3, sheen_tint=COATS[coat]['tip'],
                              subsurface=0.2, vertex_color=True),
        'fur': lib.material('tetrapod.fur.' + coat, base='#ffffff', rough=0.82, sheen=0.22, sheen_tint=COATS[coat]['tip'],
                            sheen_rough=0.5, alpha=0.42, vertex_color=True),
        'limb': lib.material('tetrapod.limb.' + coat, base=COATS[coat]['flank'] if coat != 'pink' else '#efb0a1', rough=0.6,
                             sheen=0.3, sheen_tint=COATS[coat]['tip'], subsurface=0.25),
        'pink': lib.material('tetrapod.pink', base='#e0998c', rough=0.45, subsurface=0.35, sheen=0.15, sheen_tint='#f0c4ba'),
        'ear': lib.material('tetrapod.ear', base='#d9978b', rough=0.5, subsurface=0.45, sheen=0.15, sheen_tint='#f0c4ba'),
        'ear_rim': lib.material('tetrapod.ear_rim', base='#a87468', rough=0.5, sheen=0.2, sheen_tint='#d9a89c'),
        'nose': lib.material('tetrapod.nose', base='#d98a86', rough=0.28, clearcoat=0.6, clearcoat_rough=0.15, subsurface=0.3),
        'dark': lib.material('tetrapod.dark', base='#2a1f1c', rough=0.4),
        'claw': lib.material('tetrapod.claw', base='#e6dccd', rough=0.32, clearcoat=0.4),
        'whisker': lib.material('tetrapod.whisker', base='#ffffff', rough=0.3, clearcoat=0.5, vertex_color=True),
        'eye': lib.material('tetrapod.eye', base='#0b0807', rough=0.04, clearcoat=1.0, clearcoat_rough=0.01, specular=0.8),
        'lid': lib.material('tetrapod.lid', base='#b9817b', rough=0.4, subsurface=0.35, clearcoat=0.3),
        'membrane': lib.material('tetrapod.patagium.' + coat, base='#ffffff', rough=0.55, sheen=0.3, sheen_tint=COATS[coat]['tip'],
                                 subsurface=0.4, alpha=0.88, vertex_color=True),
        'margin': lib.material('tetrapod.patagium_margin.' + coat, base=COATS[coat]['dorsal'], rough=0.6, sheen=0.3,
                               sheen_tint=COATS[coat]['tip']),
        'tail': lib.material('tetrapod.tail', base='#ffffff', rough=0.5, sheen=0.3, subsurface=0.25, clearcoat=0.15,
                             vertex_color=True),
        'brain': lib.material('tetrapod.brain', base='#ebd2c6', rough=0.5, subsurface=0.4),
        'cerebellum': lib.material('tetrapod.cerebellum', base='#dcb7a8', rough=0.5, subsurface=0.4),
        'cord': lib.material('tetrapod.cord', base='#b89a5e', rough=0.5, subsurface=0.3),
        'nerve': lib.material('tetrapod.nerve', base='#b8952e', rough=0.5),   # textbook nerve yellow, not white
        # warm, mid-tone bone (an old-ivory, not white, so the skeleton sits behind the organs instead of shouting
        # over them like an X-ray); a newborn's skeleton is still largely cartilage, drawn the colour of the pup's
        # own flesh and mostly see-through, so its coloured organs read first
        'bone': (lib.material('tetrapod.bone.pink', base='#a8786f', rough=0.7, subsurface=0.2, alpha=0.16) if coat == 'pink'
                 else lib.material('tetrapod.bone', base='#a89678', rough=0.75)),
        'cartilage': (lib.material('tetrapod.cartilage.pink', base='#a87d76', rough=0.6, subsurface=0.2, alpha=0.12) if coat == 'pink'
                      else lib.material('tetrapod.cartilage', base='#9aa39c', rough=0.6, subsurface=0.2, alpha=0.6)),
        'enamel': lib.material('tetrapod.enamel', base='#d9b07a', rough=0.35, clearcoat=0.4),
        'heart': lib.material('tetrapod.heart', base='#93292a', rough=0.38, subsurface=0.3, clearcoat=0.35),
        'atrium': lib.material('tetrapod.atrium', base='#b4483f', rough=0.4, subsurface=0.3, clearcoat=0.3),
        'artery': lib.material('tetrapod.artery', base='#b8342f', rough=0.35, clearcoat=0.3),
        'vein': lib.material('tetrapod.vein', base='#4c6b9a', rough=0.35, clearcoat=0.3),
        'lung': lib.material('tetrapod.lung', base='#e39b98', rough=0.62, subsurface=0.45, sheen=0.15, sheen_tint='#f0c0bc'),
        'trachea': lib.material('tetrapod.trachea', base='#ffffff', rough=0.4, subsurface=0.25, vertex_color=True),
        'liver': lib.material('tetrapod.liver', base='#6b2620', rough=0.3, clearcoat=0.55, clearcoat_rough=0.1),
        'gallbladder': lib.material('tetrapod.gallbladder', base='#7f9550', rough=0.3, clearcoat=0.5),
        'stomach': lib.material('tetrapod.stomach.' + coat, base='#f2ece2' if coat == 'pink' else '#d99f88', rough=0.4,
                                subsurface=0.3, clearcoat=0.3),
        'intestine': lib.material('tetrapod.intestine', base='#d9a07c', rough=0.42, subsurface=0.3, clearcoat=0.3),
        'caecum': lib.material('tetrapod.caecum', base='#c78e6c', rough=0.42, subsurface=0.3, clearcoat=0.3),
        'colon': lib.material('tetrapod.colon', base='#b98063', rough=0.42, subsurface=0.25, clearcoat=0.3),
        'kidney': lib.material('tetrapod.kidney', base='#86372d', rough=0.35, clearcoat=0.45),
        'ureter': lib.material('tetrapod.ureter', base='#e9d6b3', rough=0.4),
        'gonad': lib.material('tetrapod.gonad', base='#f0d4c6', rough=0.45, subsurface=0.4, clearcoat=0.2),
        'muscle': lib.material('tetrapod.muscle', base='#a8423b', rough=0.5, subsurface=0.25, sheen=0.2, sheen_tint='#d98a80'),
        'tendon': lib.material('tetrapod.tendon', base='#eae2d2', rough=0.3, clearcoat=0.4),
        'lymph': lib.material('tetrapod.lymph', base='#93a26c', rough=0.42, subsurface=0.3, clearcoat=0.2),
        'lymphatic': lib.material('tetrapod.lymphatic', base='#c9d1a8', rough=0.4),
        'thyroid': lib.material('tetrapod.thyroid', base='#b35f47', rough=0.4, subsurface=0.3, clearcoat=0.3),
        'parathyroid': lib.material('tetrapod.parathyroid', base='#e2b98e', rough=0.4),
    }
    return m


def coat_colour(body, coat, f):
    """Agouti-style gradient: dark dorsum, warm flank, pale belly; the muzzle a little paler."""
    c = COATS[coat]

    def fn(p):
        d = body.dorsality(p)
        col = _mix(c['belly'], c['flank'], _ss(-0.55, 0.15, d))
        col = _mix(col, c['dorsal'], _ss(0.2, 0.9, d))
        if p[0] > H((1.78, 0, 0), f)[0]:
            col = _mix(col, c['muzzle'], _ss(H((1.78, 0, 0), f)[0], H((1.95, 0, 0), f)[0], p[0]) * 0.7)
        if coat == 'pink' and p[2] < 0:
            # the "milk spot": a suckling pup's milk-filled stomach showing white through the thin skin of its left flank
            d2 = (p[0] - 0.12) ** 2 / 0.035 + (p[1] - 0.12) ** 2 / 0.02
            col = _mix(col, '#f7f2ea', 0.85 * math.exp(-d2 * 2.5) * _ss(-0.1, -0.35, p[2]))
        return col
    return fn


# --------------------------------------------------------------------------------------------- build


def build(spec, lib, stage):
    global L
    L = lib
    f = dict(FORM.get(stage, FORM['adult']))
    f['stage'] = stage
    f['spec'] = spec or {}
    M = mats(f)
    body = Body(f)
    envelope(M, body, f)
    head_parts(M, body, f)
    limbs(M, body, f)
    tail(M, body, f)
    interior(M, body, f)
    for ob in list(lib._S['objects']):
        if ob.type == 'MESH' and ob.name in bpy.data.objects:
            lib.transform(ob, body.belly)
    if f['curl']:
        k = f['curl']
        for ob in list(lib._S['objects']):
            if ob.type == 'MESH' and ob.name in bpy.data.objects:
                lib.transform(ob, lambda p: (p[0], p[1] - k * (p[0] - 0.3) ** 2, p[2]))


def envelope(M, body, f):
    lib = L
    coat = f['coat']
    paintc = coat_colour(body, coat, f)
    prof = body.profile
    # trunk: rump to neck, a hair inside the skin
    tp = [(x, ry * 0.975, rz * 0.975, yc) for x, ry, rz, yc in prof if x <= 1.32]
    tr = lib.lathe('trunk', tp, M['flesh'], sides=22, samples=28)
    paint(tr, paintc)
    lib.part(tr, 'trunk')
    # head: neck to nose. Where it overlaps the trunk (the neck, x < 1.3) it sits a little inside the trunk's
    # surface, so the page's see-through envelopes never draw two coincident surfaces there (that blended twice,
    # as a pale collar round the neck)
    hp = [(x, ry * k, rz * k, yc) for x, ry, rz, yc in prof if x >= 1.0 for k in [0.95 if x < 1.3 else 0.975]]
    hd = lib.lathe('head', hp, M['flesh'], sides=24, samples=24)
    paint(hd, paintc)
    lib.part(hd, 'head')
    # skin: the whole outline, carrying the coat
    sk = lib.lathe('skin', prof, M['skin'], sides=30, samples=50)
    paint(sk, paintc)
    lib.part(sk, 'skin')
    if f['fur'] > 0:
        eyes = [H(lib.slot('eye', s), f) for s in SIDES]
        nose_x = body.nose_x

        def mask(p):
            if p[0] > nose_x - 0.06:
                return False
            for e in eyes:
                if (p[0] - e[0]) ** 2 + (p[1] - e[1]) ** 2 + (p[2] - e[2]) ** 2 < (0.062 * f['eye_s']) ** 2:
                    return False
            return True

        def lenf(p):
            if p[0] > 1.2:                               # short hair on the face
                return 0.45 + 0.4 * _ss(nose_x, 1.25, p[0])
            if p[0] < -0.9:
                return 0.7
            d = body.dorsality(p)
            return 0.62 + 0.38 * _ss(0.35, 0.8, abs(d))    # long where the coat makes the silhouette, short on the flank
        # many thin, short, tapering strands (one triangle each: base on the skin, a point at the tip) read as a
        # soft pelt; fewer, wider or longer ones read as straw
        n = int(20000 * f['fur'])
        L_ = (0.045, 0.078) if f['fur'] >= 1 else (0.036, 0.06)
        fr = fur('fur', sk, n, L_, (0.0018, 0.003), COATS[coat], body, M['fur'], seed=13, mask=mask, length_fn=lenf, skin_fn=paintc)
        if fr is not None:
            lib.deco(fr, sk, 'fur')


def head_parts(M, body, f):
    lib = L
    hs = f['head']
    hd = [o for o in lib._S['objects'] if o.get('node') == 'slot:head'][-1]
    nx = body.nose_x
    ny = body.profile[-1][3]
    # rhinarium + nostrils
    nose = lib.ellipsoid('nose', (nx - 0.012, ny + 0.002, 0), (0.035 * hs, 0.03 * hs, 0.042 * hs), M['nose'], segments=20, rings=12)
    lib.deco(nose, hd, 'nose')
    nos = [lib.ellipsoid('nostril', (nx + 0.012, ny + 0.006, k * 0.017 * hs), (0.008, 0.007, 0.011), M['dark'], segments=10, rings=6)
           for k in (1, -1)]
    lib.deco(join(nos, 'nostrils'), hd, 'nostrils')
    # vibrissae: rows of long, curved whiskers on each mystacial pad, dark at the root, pale at the tip
    if f['whisker'] > 0:
        rng = random.Random(7)
        th = max(0.55, f['whisker'])

        def whisker(pts, radii):
            ob = lib.tube('whisker', pts, [r * th for r in radii], M['whisker'], sides=3, samples=9, cap=False)
            b0, Lw = Vector(pts[0]), sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
            # a fine hair: darker only at the very root, silvery along its length
            return paint(ob, lambda p: _mix(_mix('#4a3d36', '#a39a90', _ss(0.0, 0.3, (Vector(p) - b0).length / max(Lw, 1e-6))), '#e8e3d9',
                                            _ss(0.45, 1.0, (Vector(p) - b0).length / max(Lw, 1e-6))))
        for s in SIDES:
            k = lib.side_sign(s)
            ws = []
            # 4 rows x 3 per side on the mystacial pad, plus one above the eye (13 per side). Fine hairs that
            # sweep out sideways and a little back, the upper rows level and the lower rows only slightly down,
            # each arcing gently back toward its tip: a light spray to the side, not a beard.
            for row in range(4):
                for colm in range(3):
                    base = H((1.86 + 0.032 * colm, 0.118 - 0.024 * row - 0.006 * colm, k * (0.092 - 0.012 * colm - 0.006 * row)), f)
                    Lw = (0.40 - 0.07 * colm - 0.025 * abs(row - 1.0)) * f['whisker'] * rng.uniform(0.92, 1.06)
                    d = Vector((-0.05 - 0.06 * row + 0.05 * colm, 0.12 - 0.07 * row, k * 1.0)).normalized()
                    bend = Vector((-0.3, -0.04, 0.0))
                    pts = [tuple(Vector(base) + d * Lw * t + bend * Lw * 0.4 * t * t) for t in (0, 0.33, 0.66, 1.0)]
                    ws.append(whisker(pts, [0.0021, 0.0015, 0.0009, 0.0003]))
            # one supraorbital whisker, arcing up and back above the eye
            e = H(lib.slot('eye', s), f)
            b0 = Vector((e[0] - 0.02, e[1] + 0.055, e[2] * 0.9))
            d = Vector((-0.5, 0.55, k * 0.65)).normalized()
            pts = [tuple(b0 + d * 0.16 * f['whisker'] * t + Vector((-0.06, -0.02, 0)) * t * t) for t in (0, 0.5, 1.0)]
            ws.append(whisker(pts, [0.0016, 0.001, 0.0003]))
            lib.deco(join(ws, 'vibrissae'), hd, 'vibrissae')
    # eyes: glossy black globes with a lid rim; sealed under fused lids in a neonate
    for s in SIDES:
        k = lib.side_sign(s)
        ex, ey, ez = H(lib.slot('eye', s), f)
        # a mouse's eye is a dark bead set INTO the head, not stuck on it (a pup's sealed lid keeps its old size)
        r = (0.054 if f['eye'] == 'open' else 0.074) * f['eye_s']
        out = Vector((0.35, 0.25, k * 0.9)).normalized()
        if f['eye'] == 'open':
            # the head's outward normal where the eye sits (from the body outline, by finite differences), and
            # the globe's centre 0.6 r inside the skin there: a low dome of about 0.4 r shows through the lids
            hry, hrz, hyc = body.at(ex)
            cy = max(-0.95, min(0.95, (ey - hyc) / max(hry, 1e-6)))
            a_ = math.acos(cy)
            surf = Vector(body.wall(ex, a_, 1.0, k))
            dx = 0.01
            g1, g0 = Vector(body.wall(ex + dx, a_, 1.0, k)), Vector(body.wall(ex - dx, a_, 1.0, k))
            ta = (g1 - g0).normalized()                                                  # along the head
            tb = (Vector(body.wall(ex, a_ + 0.02, 1.0, k)) - Vector(body.wall(ex, a_ - 0.02, 1.0, k))).normalized()   # around it
            out = ta.cross(tb).normalized()
            if out.z * k < 0:
                out = -out
            ec = surf - out * (r * 0.6)
            ex, ey, ez = ec.x, ec.y, ec.z
            e = lib.ellipsoid('eye', (ex, ey, ez), (r, r, r), M['eye'], segments=24, rings=16)
        else:
            # sealed: the dark eye shows only as a low bulge under the fused lids, sunk into the head
            hry, hrz, hyc = body.at(ex - 0.01)
            cy = max(-0.95, min(0.95, (ey - hyc) / max(hry, 1e-6)))
            ez = k * (hrz * math.sqrt(1 - cy * cy) - r * 0.45)
            e = lib.ellipsoid('eye', (ex - 0.01, ey, ez), (r * 0.95, r * 0.75, r * 0.6), M['lid'], segments=24, rings=14)
        lib.part(e, 'eye', s)
        # lid rim / sealed-lid slit: a ring (open) or a short dark line (closed)
        u = Vector((1, 0, 0)) - out * out.x
        u.normalize()
        v = out.cross(u)
        if f['eye'] == 'open':
            # the lid margin: a slightly almond ring lying ON the globe just inside the line where it meets the
            # skin, thicker above and below, so the lids hug the eye instead of floating round it
            ring, rr = [], []
            for i in range(25):
                a = i * 2 * math.pi / 24
                A, B = 0.8 * math.cos(a), 0.74 * math.sin(a)
                d = out * math.sqrt(max(0.0, 1 - A * A - B * B)) + u * A + v * B
                ring.append(tuple(Vector((ex, ey, ez)) + d.normalized() * r * 1.03))
                rr.append((0.0042 + 0.0022 * abs(math.sin(a))) * f['eye_s'])
            rim = lib.tube('lid_rim', ring, rr, M['margin'], sides=6, samples=40, cap=False)
            depicts(lib.deco(rim, e, 'lid'), 'lid')
        else:
            # the slit where the fused lids will part, lying on the sealed bulge
            C = Vector((ex - 0.01, ey, ez))
            rad = Vector((r * 0.95, r * 0.75, r * 0.6))
            sl = []
            for t in (-0.8, -0.4, 0.0, 0.4, 0.8):
                q = Vector((t * 0.95, -0.12 * t * t, 0.0))
                q.z = k * math.sqrt(max(0.0, 1 - q.x ** 2 - q.y ** 2))
                sl.append(tuple(C + Vector((q.x * rad.x, q.y * rad.y, q.z * rad.z * 1.04))))
            depicts(lib.deco(lib.tube('lid_slit', sl, 0.0042, M['dark'], sides=5, samples=14), e, 'lid'), 'lid')
    # ears: thin, cupped, rounded pinnae facing forward-out; folded flat against the head in a neonate
    for s in SIDES:
        k = lib.side_sign(s)
        es = f['ear_s']
        if f['ear'] == 'open':
            # an upright oval pinna, a little taller than wide, tilted back about 15 degrees
            base = Vector(H((1.40, 0.38, 0.15 * k), f))
            N = Vector((0.75, 0.08, 0.66 * k)).normalized()
            U = Vector((-0.47, 1.0, 0.42 * k))
            hgt, wid, cup = 0.225 * es, 0.088 * es, -0.04 * es
        else:
            base = Vector(H((1.40, 0.38, 0.13 * k), f))
            N = Vector((0.15, 0.75, 0.62 * k)).normalized()
            U = Vector((-1.0, 0.25, 0.1 * k))
            hgt, wid, cup = 0.13 * es, 0.08 * es, -0.01
        U = (U - N * U.dot(N)).normalized()
        W = N.cross(U).normalized()
        pts = []
        for i in range(28):
            a = 2 * math.pi * i / 28
            vv = 0.5 * (1 - math.cos(a))
            uu = math.sin(a) * (0.5 + 0.5 * _ss(0.0, 0.35, vv))
            pts.append(tuple(base + U * (hgt * vv) + W * (wid * uu)))
        ear = lib.membrane('ear', pts, M['ear'], billow=cup, normal=tuple(N), thickness=0.014, rings=4)
        note(ear, 'proportions drawn by hand after a generic textbook mouse; not measured')
        lib.part(ear, 'ear', s)
        rim = lib.tube('ear_rim', pts[3:26], [0.005] + [0.0085] * 21 + [0.005], M['ear_rim'], sides=6, samples=60)
        lib.deco(rim, ear, 'rim')


# ------------------------------------------------------------------------------------------- limbs


def paw(M, parent, at, fwd, n, length, spread, what, root_r=0.03, droop=0.4):
    """A small rodent paw at `at`: a palm pad and n splayed digits with pale claws, pointing along fwd (page)."""
    lib = L
    fwd = Vector(fwd).normalized()
    side = Vector((0, 1, 0)).cross(fwd).normalized()
    down = Vector((0, -1, 0))
    at = Vector(at)
    palm_c = at + fwd * length * 0.25
    ang = math.atan2(-fwd.z, fwd.x)
    pieces = [lib.ellipsoid('palm', tuple(palm_c), (length * 0.42, root_r * 0.55, root_r * 1.15), M['pink'], segments=16, rings=10,
                            rotate=('y', ang))]
    claws = []
    for j in range(n):
        t = (j - (n - 1) / 2) / max((n - 1) / 2, 1)
        d = (fwd + side * t * spread).normalized()
        l = length * (1.0 - 0.28 * abs(t))
        b = palm_c + d * length * 0.3 + side * t * root_r * 0.7
        pts = [tuple(b), tuple(b + d * l * 0.5 + down * l * 0.05), tuple(b + d * l + down * l * droop * 0.25)]
        pieces.append(lib.tube('digit', pts, [root_r * 0.42, root_r * 0.34, root_r * 0.26], M['pink'], sides=8, samples=10))
        tip = Vector(pts[-1])
        claws.append(lib.tube('claw', [tuple(tip), tuple(tip + d * l * 0.22 + down * l * 0.12)], [root_r * 0.22, 0.001], M['claw'],
                              sides=6, samples=5))
    pw = join(pieces, what)
    lib.deco(pw, parent, what)
    lib.deco(join(claws, 'claws'), parent, 'claws')


POSES = {
    #             forelimb joints (shoulder, elbow, wrist, paw-root) at side +1, paw direction
    # glide: the arm leaves the body at the shoulder (under the shoulder bulge, not the lower chest), the
    # elbow is drawn back and down (a bend of about 28 degrees), the forearm reaches forward-out to the wrist
    # elbow drawn back and down (a bend of about 60 degrees), the forearm reaching forward-out to the wrist, the
    # wrist a little raised; the knee forward and out, the shank swept back to the ankle
    'glide': dict(fore=[(0.86, 0.03, 0.22), (0.72, -0.07, 0.54), (1.0, -0.06, 0.9), (1.06, -0.06, 0.95)], fore_dir=(0.8, 0, 0.6),
                  hind=[(-0.6, -0.05, 0.25), (-0.4, -0.13, 0.55), (-0.74, -0.11, 0.93), (-0.81, -0.115, 0.97)], hind_dir=(-0.85, 0, 0.45)),
    'stand': dict(fore=[(0.86, 0.02, 0.22), (0.74, -0.25, 0.3), (0.92, -0.5, 0.3), (0.95, -0.53, 0.3)], fore_dir=(1, 0, 0.12),
                  hind=[(-0.6, -0.04, 0.25), (-0.36, -0.27, 0.34), (-0.72, -0.42, 0.31), (-0.68, -0.53, 0.31)], hind_dir=(1, 0, 0.1)),
    # a newborn on its belly: elbows and knees out to the side, paws drawn in under the chin and the belly
    'tucked': dict(fore=[(0.88, -0.04, 0.24), (0.78, -0.27, 0.38), (0.98, -0.42, 0.33), (1.04, -0.44, 0.3)], fore_dir=(0.9, 0, -0.25),
                   hind=[(-0.56, -0.08, 0.27), (-0.34, -0.28, 0.42), (-0.6, -0.42, 0.38), (-0.56, -0.47, 0.34)], hind_dir=(0.95, 0, -0.2)),
}

# Limb radii, drawn by hand: (joint radii shoulder/hip, elbow/knee, wrist/ankle, paw root) and the swelling of
# the muscle belly in each segment (upper arm / thigh at 0.4 of its length, forearm / shank at 0.3), so a limb
# reads as a limb with joints rather than a uniform tube.
LIMB_R = {'fore': dict(joints=(0.07, 0.036, 0.024, 0.022), bellies=(0.06, 0.034)),
          'hind': dict(joints=(0.095, 0.046, 0.027, 0.026), bellies=(0.086, 0.042))}


def limb_path(pts, kind):
    """Control points and radii for a limb tube through its four joints, with a muscle belly in the two long
    segments (the third segment, wrist to paw root, is short and plain)."""
    jr, br = LIMB_R[kind]['joints'], LIMB_R[kind]['bellies']
    P_ = [Vector(p) for p in pts]
    cp, rr = [P_[0]], [jr[0]]
    for seg, (tb, rb) in enumerate(((0.4, br[0]), (0.3, br[1]))):
        a, b = P_[seg], P_[seg + 1]
        cp += [a.lerp(b, tb), b]
        rr += [rb, jr[seg + 1]]
    cp.append(P_[3])
    rr.append(jr[3])
    return [tuple(p) for p in cp], rr


def _scale_limb(pts, k):
    """Shorten a limb about its first (girdle) joint by k."""
    o = Vector(pts[0])
    return [tuple(o + (Vector(p) - o) * k) for p in pts]


def limbs(M, body, f):
    lib = L
    P = POSES[f['pose']]
    ls = f['limb']
    note_txt = POSE_NOTE[f['pose']]
    for s in SIDES:
        k = lib.side_sign(s)
        fp = _scale_limb([(x, y, z * k) for x, y, z in P['fore']], ls)
        # a muscular upper arm (its root buried in the shoulder), a narrower elbow, a forearm swelling just
        # below the elbow, a slim wrist
        cp, rr = limb_path(fp, 'fore')
        fl = lib.tube('forelimb', cp, rr, M['limb'], sides=12, samples=22, subdiv=1)
        note(fl, note_txt)
        lib.part(fl, 'forelimb', s)
        fd = P['fore_dir']
        paw(M, fl, fp[-1], (fd[0], fd[1], fd[2] * k), 4, 0.085 * max(ls, 0.75), 0.55, 'paw', root_r=0.03)
        hp = _scale_limb([(x, y, z * k) for x, y, z in P['hind']], ls)
        cp, rr = limb_path(hp, 'hind')
        hl = lib.tube('hindlimb', cp, rr, M['limb'], sides=12, samples=22, subdiv=1)
        note(hl, note_txt)
        lib.part(hl, 'hindlimb', s)
        hd = P['hind_dir']
        paw(M, hl, hp[-1], (hd[0], hd[1], hd[2] * k), 5, 0.13 * max(ls, 0.75), 0.42, 'foot', root_r=0.034, droop=0.25)
        membrane(M, body, f, s, fp, hp)


def resample(pts, n):
    """n points spaced evenly by arc length along a Catmull-Rom curve through pts (page tuples)."""
    dense = L.catmull([tuple(p) for p in pts], max(40, n * 6))
    d = [0.0]
    for a, b in zip(dense, dense[1:]):
        d.append(d[-1] + math.dist(a, b))
    out, j = [], 0
    for i in range(n):
        t = d[-1] * i / (n - 1)
        while j < len(d) - 2 and d[j + 1] < t:
            j += 1
        f = (t - d[j]) / max(d[j + 1] - d[j], 1e-9)
        out.append(tuple(a + (b - a) * f for a, b in zip(dense[j], dense[j + 1])))
    return out


def coons(name, inner, outer, front, rear, mat, lift=0.0, lift_dir=(0, 1, 0), thickness=0.009, subdiv=1, make=True, taper=1.0,
          wrinkle=0.0):
    """A smooth sheet spanning four boundary curves (a bilinear Coons patch), page coords. inner and outer run
    front to rear with the same count; front and rear run inner to outer with the same count; corners must
    meet. `lift` bulges the middle along lift_dir (camber), zero on every edge. `wrinkle` adds soft folds of
    that height running from the body out toward the free edge (slack skin gathered between the limbs),
    fading out at every edge. `taper` < 1 thins the sheet from `thickness` at the inner edge to
    taper * thickness at the outer edge. Returns (object, area)."""
    nu, nv = len(inner), len(front)
    I = [Vector(p) for p in inner]
    O = [Vector(p) for p in outer]
    F = [Vector(p) for p in front]
    R = [Vector(p) for p in rear]
    ld = Vector(lift_dir).normalized()
    verts = []
    for j in range(nv):
        v = j / (nv - 1)
        for i in range(nu):
            u = i / (nu - 1)
            p = ((1 - v) * I[i] + v * O[i] + (1 - u) * F[j] + u * R[j]
                 - ((1 - u) * (1 - v) * I[0] + u * (1 - v) * I[-1] + (1 - u) * v * O[0] + u * v * O[-1]))
            env = math.sin(math.pi * u) * math.sin(math.pi * v) ** 0.8
            p = p + ld * (lift * env + wrinkle * env * math.sin(math.pi * u * 7.0 + 1.3 * v) * (0.4 + 0.6 * v))
            verts.append(tuple(p))
    faces = [(j * nu + i, j * nu + i + 1, (j + 1) * nu + i + 1, (j + 1) * nu + i) for j in range(nv - 1) for i in range(nu - 1)]
    area = 0.0
    for a, b, c, d in faces:
        A, B, C, D = (Vector(verts[q]) for q in (a, b, c, d))
        area += ((B - A).cross(D - A)).length / 2 + ((B - C).cross(D - C)).length / 2
    if not make:
        return None, area
    ob = L.mesh_object(name, verts, faces, mat)
    if thickness > 0:
        md = ob.modifiers.new('thick', 'SOLIDIFY')
        md.thickness = thickness
        md.offset = 0.0
        if taper < 1.0:
            vg = ob.vertex_groups.new(name='thick')
            for j in range(nv):
                vg.add(list(range(j * nu, (j + 1) * nu)), 1.0 - j / (nv - 1), 'REPLACE')
            md.vertex_group = 'thick'
            md.thickness_vertex_group = taper
    L.subdivide(ob, subdiv)
    return ob, area


# The spread patagium's camber: its middle billows this far (page units) above the plane of its edges, as a
# skin sail between the drawn limbs does when air presses on it from below, with soft folds of slack skin
# running out from the flank (drawing choices, like the pose).
SAG = 0.15
WRINKLE = 0.022


def membrane(M, body, f, s, fore, hind):
    """The wing_membrane slot: a patagium of furred skin from wrist to ankle along the flank. In the spread its
    leading edge runs along the forelimb and its rear edge along the hindlimb, so the limbs carry it."""
    lib = L
    k = lib.side_sign(s)
    form = f['membrane']
    flank = lambda x, a=1.75, inset=0.97: body.wall(x, a, inset, k)   # lateral body wall, below the midline
    nu = 30
    ratio = sched = None
    if form == 'spread':
        w, a_ = Vector(fore[2]), Vector(hind[2])
        el, kn = Vector(fore[1]), Vector(hind[1])
        xf, xr = 0.84, -0.56
        inner = resample([flank(x) for x in (xf, 0.5, 0.15, -0.2, xr)], nu)
        trail = [tuple(w)]
        tts = [j / 10 for j in range(1, 10)]
        for t in tts:                                # trailing edge, bowed in toward the body, drooping a little
            p = w.lerp(a_, t)
            bow = 0.15 * math.sin(math.pi * t) ** 0.8 + 0.03 * math.sin(2 * math.pi * t)      # deepest behind the middle
            trail.append((p.x, p.y - 0.045 * math.sin(math.pi * t) + 0.014 * math.sin(3 * math.pi * t), p.z - bow * k))   # drooping, fluttering
        trail.append(tuple(a_))
        front_c = [flank(xf), tuple(el + Vector((-0.03, 0.01, 0.0))), tuple(el.lerp(w, 0.5) + Vector((-0.025, 0.005, 0.0))), tuple(w)]
        rear_c = [flank(xr), tuple(kn + Vector((0.03, 0.01, 0.0))), tuple(kn.lerp(a_, 0.5) + Vector((0.025, 0.005, 0.0))), tuple(a_)]
        # declared sizing: move the free edge laterally (away from the flank) until both membranes / SL^2 matches
        ratio = lib.driver('wing_membrane_area_SL2')
        nv = 9
        zin = abs(inner[nu // 2][2])

        def stretched(g):
            # only the free trailing edge moves: its corners stay on the drawn wrist and ankle (the limbs are not re-posed)
            # a smooth sine bulge (g > 1 outward, g < 1 inward), zero at the corners
            return ([trail[0]] + [(p[0], p[1], k * (abs(p[2]) + (g - 1) * 0.5 * math.sin(math.pi * t))) for p, t in zip(trail[1:-1], tts)]
                    + [trail[-1]], front_c, rear_c)

        def ratio_at(g):
            tr, fc, rc = stretched(g)
            return 2 * coons('probe', inner, resample(tr, nu), resample(fc, nv), resample(rc, nv), None, lift=SAG, wrinkle=WRINKLE, make=False)[1] / body.sl ** 2
        sched = ratio_at(1.0)
        g = 1.0
        if ratio:
            for _ in range(4):           # a few fixed-point steps; area grows about linearly with the stretch
                g = max(0.3, min(3.0, g * float(ratio) / max(ratio_at(g), 1e-6)))
        reached = ratio_at(g)            # measured before the outline is replaced by its stretched copy
        if ratio:
            trail, front_c, rear_c = stretched(g)
        outer = resample(trail, nu)
        wm, area = coons('wing_membrane', inner, outer, resample(front_c, nv), resample(rear_c, nv), M['membrane'], lift=SAG, wrinkle=WRINKLE,
                         thickness=0.012, taper=0.35)
    else:
        # a ridge of skin OUTSIDE the body wall: its root runs along the flank ON the skin surface (never inside
        # it) between the limb roots, and its free edge stands well clear of the flank, most in the middle and
        # running back into the skin at both ends, so from above or the side it breaks the body's outline and
        # cannot be read as something inside the body. A pup's stands straight out at the widest point of the
        # flank; a juvenile's hangs a little lower and further out, below the coat.
        a_root, out_max, down_max = (1.7, 0.17, 0.07) if form == 'drape' else (1.58, 0.135, 0.02)
        xf, xr = (0.84, -0.58) if form == 'drape' else (0.8, -0.5)
        xs = [xf + (xr - xf) * i / (nu - 1) for i in range(nu)]
        inner, outer = [], []
        for i, x in enumerate(xs):
            t = math.sin(math.pi * i / (nu - 1)) ** 0.6
            ry, rz, yc = body.at(x)
            p = body.wall(x, a_root, 1.0, k)            # on the skin itself
            nrm = Vector((0.0, math.cos(a_root) / ry, k * math.sin(a_root) / rz)).normalized()   # outward normal there
            inner.append(p)
            q = Vector(p) + nrm * (out_max * t) + Vector((0.0, -down_max * t, 0.0))
            outer.append(tuple(q))
        nv = 5
        front_c = resample([inner[0], outer[0]], nv)
        rear_c = resample([inner[-1], outer[-1]], nv)
        wm, area = coons('wing_membrane', inner, outer, front_c, rear_c, M['membrane'], lift=0.014, lift_dir=(0, -1, 0), thickness=0.012,
                         taper=0.45)
    zin = abs(inner[nu // 2][2])
    pale = '#b39280' if f['coat'] != 'pink' else '#f0b6a8'
    skin_col = coat_colour(body, f['coat'], f)

    def col(p):
        if form == 'spread':     # furred like the back near the body, thinner and paler toward the free edge,
            # with the folds of slack skin shaded along their crests and troughs
            t = _ss(zin + 0.05, zin + 0.6, abs(p[2]))
            c = _mix(_mix(COATS[f['coat']]['dorsal'], COATS[f['coat']]['flank'], 0.6), pale, t * 0.8)
            u = (p[0] - xr) / max(xf - xr, 1e-6)
            w = math.sin(math.pi * u * 7.0) * math.sin(math.pi * max(0.0, min(1.0, u)))
            return tuple(q * (1.0 + 0.07 * w) for q in c)
        # a fold of flank skin: the flank's own colour (not the pale belly below its root), a shade deeper
        return tuple(q * 0.94 for q in _mix(COATS[f['coat']]['flank'], COATS[f['coat']]['dorsal'], 0.25))
    paint(wm, col)
    if form == 'spread':
        why = ' '.join(n for n in (f['spec'].get('driver_notes') or []) if 'wing_membrane' in n or 'liftingArea' in n)
        if ratio:
            txt = ('Its free edge is stretched laterally so both membranes / SL^2 = %.3f, sized by the declared driver '
                   'wing_membrane_area_SL2 = %.3f' % (reached, float(ratio)))
            txt += '.' if abs(reached - float(ratio)) < 0.01 * float(ratio) else (
                ' (the free edge may bulge out by at most one body width, with its corners kept on the drawn wrist and ankle, '
                'so the declared value is not reached).')
        else:
            txt = ('Proportions are schematic: both membranes together / SL^2 = %.3f, set by hand (limited by how far the '
                   'drawn limbs reach). ' % sched) + (why or 'No design declares a membrane area for it.')
        note(wm, 'patagium drawn by hand from wrist to ankle. ' + txt)
        wm['area_SL2'] = round(reached, 4)
    else:
        note(wm, 'a fold of flank skin standing out from the body wall between the limb roots, drawn by hand at this stage; '
                 'no design declares a membrane size or a developmental stage for it')
    lib.part(wm, 'wing_membrane', s)
    if form == 'spread':
        rim = lib.tube('patagium_rim', outer, 0.0065, M['margin'], sides=6, samples=48)
        lib.deco(rim, wm, 'rim')


def tail(M, body, f):
    lib = L
    tl = f['tail']
    tx, ty, _ = lib.slot('tail')
    if f['pose'] == 'tucked':
        ctrl = [(RUMP_X + 0.08, 0.04, 0), (RUMP_X - 0.25 * tl, -0.02, 0.05), (RUMP_X - 0.5 * tl, -0.16, 0.25),
                (RUMP_X - 0.55 * tl, -0.32, 0.5), (RUMP_X - 0.4 * tl, -0.4, 0.68)]
    elif f['pose'] == 'stand':
        ctrl = [(RUMP_X + 0.08, 0.05, 0), (RUMP_X - 0.45 * tl, 0.0, 0.02), (RUMP_X - 1.0 * tl, -0.18, -0.08),
                (RUMP_X - 1.55 * tl, -0.36, 0.06), (RUMP_X - 2.0 * tl, -0.45, 0.22)]
    else:
        ctrl = [(RUMP_X + 0.08, 0.06, 0), (RUMP_X - 0.45 * tl, 0.05, 0.0), (RUMP_X - 0.95 * tl, 0.08, 0.02),
                (RUMP_X - 1.45 * tl, 0.15, -0.03), (RUMP_X - 1.9 * tl, 0.24, 0.0)]
    sides = 10
    rad = [0.068, 0.052, 0.04, 0.028, 0.012]
    if f['coat'] == 'pink':
        rad = [r * 0.8 for r in rad]
    nr = 240
    tb = lib.tube('tail', ctrl, rad, M['tail'], sides=sides, samples=nr)
    ripple(tb, sides, lambda t, i, n: 1.0 + (0.06 if f['coat'] != 'pink' else 0.02) * (0.5 + 0.5 * math.cos(i * 2 * math.pi / 3.0)))
    me = tb.data
    attr = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    pink = f['coat'] == 'pink'
    for loop in me.loops:
        vi = loop.vertex_index
        ring = min(vi // sides, nr - 1)
        v = me.vertices[vi].co
        c = sum((me.vertices[ring * sides + q].co for q in range(sides)), Vector()) / sides
        up = (v - c).normalized().z if (v - c).length > 1e-9 else 0.0   # Blender z = page dorsal
        base = _mix('#d8b2a4' if not pink else '#f2bcae', '#8a7466' if not pink else '#e6a596', _ss(-0.4, 0.8, up))
        groove = 0.5 + 0.5 * math.cos(ring * 2 * math.pi / 3.0)
        col = tuple(q * (0.82 + 0.18 * groove) for q in base)
        attr.data[loop.index].color_srgb = (col[0], col[1], col[2], 1.0)
    me.update()
    lib.subdivide(tb, 0)
    note(tb, POSE_NOTE[f['pose']] + ' Tail length and ring count drawn by hand.')
    lib.part(tb, 'tail')


# ----------------------------------------------------------------------------------------- interior


def cord_y(x):
    pts = [(1.36, 0.235), (1.22, 0.24), (1.05, 0.27), (0.8, 0.305), (0.4, 0.315), (0.0, 0.31), (-0.4, 0.29), (-0.7, 0.24),
           (-0.86, 0.19), (-1.05, 0.12)]
    if x >= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x1 <= x <= x0:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def interior(M, body, f):
    brain(M, f)
    spinal(M, f)
    skeleton(M, body, f)
    heart(M, f)
    lungs(M, f)
    liver(M, f)
    gut(M, f)
    paired_organs(M, body, f)


def brain(M, f):
    lib = L
    hs = f['head']
    bx, by, _ = lib.slot('brain')
    sc = hs ** 0.85

    def B(x, y, z):
        return (bx + (x - bx) * sc, by + (y - by) * sc, z * sc)
    parts = []
    for k in (1, -1):
        # a cerebral hemisphere: egg-shaped, broader behind, smooth (a mouse cortex has no folds)
        h = lib.ellipsoid('hemisphere', B(bx + 0.02, by + 0.01, 0.058 * k), (0.125 * sc, 0.085 * sc, 0.066 * sc), M['brain'],
                          segments=28, rings=18)
        lib.transform(h, lambda p, k=k: (p[0], p[1] + 0.02 * (1 - ((p[0] - bx) / 0.13) ** 2) * (1 if p[1] > by else 0),
                                         p[2] * (1.0 + 0.25 * max(0.0, (bx - p[0]) / 0.13))))
        parts.append(h)
        parts.append(lib.ellipsoid('olfactory', B(bx + 0.165, by - 0.025, 0.026 * k), (0.05 * sc, 0.032 * sc, 0.026 * sc), M['brain'],
                                   segments=16, rings=10, rotate=('z', -0.3)))
    cb = lib.ellipsoid('cerebellum', B(bx - 0.135, by - 0.005, 0), (0.05 * sc, 0.06 * sc, 0.085 * sc), M['cerebellum'], segments=28, rings=20)
    lib.transform(cb, lambda p: (p[0], p[1], p[2]))
    me = cb.data
    for v in me.vertices:   # folia: fine transverse ridges
        pp = L.to_page(v.co)
        a = math.atan2(pp[1] - B(bx, by - 0.005, 0)[1], pp[0] - B(bx - 0.135, 0, 0)[0])
        g = 1 + 0.045 * math.cos(a * 9)
        c = Vector(L.P(B(bx - 0.135, by - 0.005, 0)))
        v.co = c + (v.co - c) * g
    me.update()
    parts.append(cb)
    parts.append(lib.tube('brainstem', [B(bx - 0.08, by - 0.04, 0), B(bx - 0.15, by - 0.06, 0), B(bx - 0.2, by - 0.05, 0)],
                          [0.035 * sc, 0.03 * sc, 0.026 * sc], M['cerebellum'], sides=12, samples=10))
    br = join(parts, 'brain')
    lib.part(br, 'brain')


def spinal(M, f):
    lib = L
    xs = [1.3, 1.2, 1.05, 0.95, 0.8, 0.4, 0.0, -0.3, -0.55, -0.75, -0.86]
    rs = [0.026, 0.026, 0.03, 0.03, 0.025, 0.024, 0.024, 0.028, 0.022, 0.014, 0.008]
    sc = lib.tube('spinal_cord', [(x, cord_y(x), 0) for x in xs], rs, M['cord'], sides=12, samples=70)
    lib.part(sc, 'spinal_cord')
    nerves = []
    x = 1.12
    while x > -0.72:
        y = cord_y(x)
        for k in (1, -1):
            lg = 0.1 if (0.85 < x < 1.1 or -0.45 < x < -0.15) else 0.07
            nerves.append(lib.tube('nerve', [(x, y, 0.02 * k), (x - 0.02, y - 0.03, (0.02 + lg * 0.6) * k), (x - 0.05, y - 0.07, (0.02 + lg) * k)],
                                   [0.0045, 0.0038, 0.0024], M['nerve'], sides=4, samples=6))
        x -= 0.11
    for j in range(5):
        a = (j - 2) * 0.012
        nerves.append(lib.tube('cauda', [(-0.84, cord_y(-0.84), a), (-0.93, cord_y(-0.93) - 0.01, a * 1.6), (-1.0, cord_y(-1.0) - 0.02, a * 2.2)],
                               0.0025, M['nerve'], sides=4, samples=8))
    lib.deco(join(nerves, 'nerves'), sc, 'nerves')


def skeleton(M, body, f):
    lib = L
    hs = f['head']
    bones, cart = [], []
    # vertebral column: cervical, thoracic, lumbar, sacral and the first caudals that sit inside the rump
    xs, x = [], 1.24
    for j in range(33):
        xs.append(x)
        x -= 0.045 if j < 7 else (0.064 if j < 20 else (0.085 if j < 26 else 0.06))
    th = []
    for j, x in enumerate(xs):
        if x < -1.05:
            break
        y = cord_y(x) - 0.052
        ln = 0.032 if j < 7 else (0.045 if j < 20 else 0.06)
        r = 0.022 if j < 7 else (0.026 if j < 20 else 0.032)
        if j >= 26:
            r = 0.026 - 0.002 * (j - 26)
        bones.append(lib.tube('centrum', [(x + ln / 2, y + 0.002, 0), (x - ln / 2, y - 0.002, 0)], r, M['bone'], sides=8, samples=3))
        if j == 1:   # the axis' tall spine
            bones.append(lib.tube('spine', [(x + 0.01, y + 0.03, 0), (x - 0.02, y + 0.08, 0)], [0.012, 0.006], M['bone'], sides=5, samples=4,
                                  flatten=0.5))
        elif 7 <= j < 20:
            hgt = 0.045 if j < 10 else 0.03
            bones.append(lib.tube('spine', [(x, y + 0.03, 0), (x - 0.03, y + 0.035 + hgt, 0)], [0.009, 0.004], M['bone'], sides=5, samples=4,
                                  flatten=0.5))
            th.append((x, y))
        elif 20 <= j < 26:
            bones.append(lib.tube('spine', [(x, y + 0.03, 0), (x + 0.02, y + 0.07, 0)], [0.012, 0.006], M['bone'], sides=5, samples=4, flatten=0.5))
            for k in (1, -1):
                bones.append(lib.tube('transverse', [(x, y, 0.025 * k), (x + 0.025, y - 0.01, 0.085 * k)], [0.008, 0.004], M['bone'], sides=5, samples=4))
    # ribs: 13 pairs, 7 reaching the sternum through costal cartilage
    ys_st = []
    for i, (x, y) in enumerate(th):
        for k in (1, -1):
            amax = 2.45 if i < 7 else (2.2 if i < 10 else 1.85)
            pts = [(x, y + 0.005, 0.025 * k)]
            for a in [0.9 + (amax - 0.9) * t / 7 for t in range(8)]:
                pts.append(body.wall(x - 0.18 * (a / math.pi), a, 0.84, k))
            # (a newborn's ribs are slender and only partly ossified)
            bones.append(lib.tube('rib', pts, 0.0065 if f['coat'] != 'pink' else 0.0045, M['bone'], sides=5, samples=14))
            if i < 7:
                e = pts[-1]
                xs_ = x - 0.18 * (2.95 / math.pi) - 0.02
                ry, rz, yc = body.at(xs_)
                st = (xs_ + 0.02, yc - ry * 0.84, 0.015 * k)
                cart.append(lib.tube('costal', [e, ((e[0] + st[0]) / 2, (e[1] + st[1]) / 2 - 0.02, (e[2] + st[2]) / 2 * 1.2), st],
                                     0.0055, M['cartilage'], sides=5, samples=8))
                if k == 1:
                    ys_st.append(st)
    # sternum: sternebrae down the ventral midline
    for j, st in enumerate(ys_st[:6]):
        bones.append(lib.ellipsoid('sternebra', (st[0] + 0.02, st[1] + 0.005, 0), (0.04, 0.012, 0.016), M['bone'], segments=10, rings=6))
    if ys_st:
        st = ys_st[-1]
        cart.append(lib.ellipsoid('xiphoid', (st[0] - 0.08, st[1] + 0.01, 0), (0.05, 0.008, 0.02), M['cartilage'], segments=10, rings=6))
    # scapulae and pelvis (girdles belong to the trunk; no limb bone is drawn here)
    for k in (1, -1):
        sp = [(0.9, -0.01, 0.27 * k), (0.62, 0.27, 0.19 * k), (0.72, 0.33, 0.14 * k), (0.84, 0.3, 0.16 * k)]
        bones.append(lib.membrane('scapula', sp, M['bone'], billow=0.01, normal=(0, 0.3, k), thickness=0.008, rings=3, subdiv=1))
        bones.append(lib.tube('scapular_spine', [(0.88, 0.02, 0.28 * k), (0.72, 0.28, 0.19 * k)], [0.008, 0.005], M['bone'], sides=5, samples=6))
        bones.append(lib.tube('clavicle', [(0.9, -0.02, 0.26 * k), (1.0, -0.08, 0.12 * k), (1.02, -0.1, 0.03 * k)], 0.006, M['bone'], sides=5, samples=8))
        bones.append(lib.tube('ilium', [(-0.42, 0.22, 0.06 * k), (-0.55, 0.1, 0.14 * k), (-0.64, 0.0, 0.2 * k)], [0.022, 0.016, 0.014],
                              M['bone'], sides=8, samples=10, flatten=0.45))
        bones.append(lib.tube('ischium', [(-0.64, 0.0, 0.2 * k), (-0.78, 0.02, 0.15 * k), (-0.86, -0.06, 0.08 * k)], [0.013, 0.012, 0.012],
                              M['bone'], sides=7, samples=10, flatten=0.6))
        bones.append(lib.tube('pubis', [(-0.64, 0.0, 0.2 * k), (-0.72, -0.1, 0.11 * k), (-0.82, -0.11, 0.02 * k), (-0.86, -0.06, 0.08 * k)],
                              0.009, M['bone'], sides=6, samples=12))
        ring = [(-0.64 + 0.03 * math.cos(a), -0.0 + 0.03 * math.sin(a), 0.21 * k) for a in [i * math.pi / 6 for i in range(13)]]
        bones.append(lib.tube('acetabulum', ring, 0.006, M['bone'], sides=4, samples=20, cap=False))
    # skull, drawn open (arches, ridges and jaws), so the brain inside stays in view
    sk = []
    HX = lambda x: H((x, 0, 0), f)[0]
    W = lambda x, a, ins, k=1.0: body.wall(HX(x), a, ins, k)     # skull curves follow the head outline, always inside it
    for k in (1, -1):
        sk.append(lib.tube('mandible', [W(1.42, 1.75, 0.8, k), W(1.45, 2.25, 0.8, k), W(1.6, 2.45, 0.8, k), W(1.78, 2.62, 0.78, k),
                                        W(1.93, 2.9, 0.75, k)], [0.012, 0.022, 0.024, 0.017, 0.01], M['bone'], sides=8, samples=24, flatten=0.45))
        sk.append(lib.tube('zygoma', [W(x, 1.6, 0.82, k) for x in (1.47, 1.58, 1.7, 1.79)], 0.011, M['bone'], sides=6, samples=16))
        sk.append(lib.tube('temporal_ridge', [W(x, 0.6, 0.84, k) for x in (1.3, 1.42, 1.6, 1.78, 1.93)], 0.009, M['bone'], sides=6, samples=22))
        sk.append(lib.tube('maxilla', [W(x, 2.0, 0.78, k) for x in (1.6, 1.75, 1.9)], [0.012, 0.012, 0.01], M['bone'], sides=6, samples=12))
        for j in range(3):   # molar rows
            sk.append(lib.ellipsoid('molar', H((1.6 + 0.028 * j, 0.072, 0.07 * k), f), (0.012, 0.011, 0.011), M['bone'], segments=8, rings=6))
            sk.append(lib.ellipsoid('molar', H((1.6 + 0.028 * j, 0.03, 0.068 * k), f), (0.012, 0.011, 0.011), M['bone'], segments=8, rings=6))
        # incisors: the rodent's ever-growing, orange-enamelled teeth (unerupted, so short and inside, in a newborn)
        if f['stage'] == 'neonate':
            sk.append(lib.tube('incisor', [H(p, f) for p in [(1.84, 0.11, 0.012 * k), (1.9, 0.095, 0.012 * k)]], 0.009, M['enamel'],
                               sides=6, samples=4))
            continue
        # the upper pair curves down out of the snout and shows only a short tip below the upper lip; the lower
        # pair stays behind it, inside the mouth
        sk.append(lib.tube('incisor', [H(p, f) for p in [(1.87, 0.10, 0.011 * k), (1.935, 0.07, 0.011 * k), (1.955, 0.025, 0.011 * k),
                                                         (1.952, -0.008, 0.011 * k)]], [0.0085, 0.0085, 0.0075, 0.0055], M['enamel'], sides=7, samples=12))
        sk.append(lib.tube('incisor', [H(p, f) for p in [(1.82, -0.0, 0.01 * k), (1.9, 0.0, 0.01 * k), (1.932, 0.012, 0.01 * k),
                                                         (1.938, 0.022, 0.01 * k)]], [0.0075, 0.0075, 0.0065, 0.005], M['enamel'], sides=7, samples=12))
    sk.append(lib.tube('sagittal', [W(x, 0.0, 0.82) for x in (1.3, 1.42, 1.56, 1.74, 1.88, 1.95)], 0.01, M['bone'], sides=6, samples=24))
    # the occipital crest: an arch over the back of the skull, following the head wall (not a closed hoop)
    oc = [W(1.31, a, 0.8) for a in [-1.25 + 2.5 * i / 10 for i in range(11)]]
    sk.append(lib.tube('occipital', oc, [0.004] + [0.0065] * 9 + [0.004], M['bone'], sides=6, samples=22))
    skel = join(bones + sk + cart, 'skeleton')
    lib.part(skel, 'skeleton')


def heart(M, f):
    lib = L
    hx, hy, _ = lib.slot('heart')
    v = lib.blob('ventricles', [((hx - 0.01, hy - 0.01, -0.01), (0.095, 0.085, 0.08)), ((hx - 0.08, hy - 0.055, -0.035), 0.05),
                                ((hx - 0.115, hy - 0.08, -0.045), 0.025)], M['heart'], resolution=0.011)
    a = lib.blob('atria', [((hx + 0.07, hy + 0.06, 0.055), 0.045), ((hx + 0.07, hy + 0.065, -0.06), 0.04)], M['atrium'], resolution=0.011)
    ht = join([v, a], 'heart')
    lib.part(ht, 'heart')
    art = [lib.tube('aorta', [(hx + 0.04, hy + 0.05, 0.0), (hx + 0.1, hy + 0.14, 0.0), (hx + 0.06, hy + 0.2, -0.015), (hx - 0.05, hy + 0.17, -0.015),
                              (hx - 0.25, hy + 0.16, 0), (hx - 0.45, hy + 0.16, 0), (hx - 0.62, hy + 0.15, 0)],
                    [0.022, 0.02, 0.018, 0.016, 0.015, 0.014, 0.011], M['artery'], sides=10, samples=40)]
    for k in (1, -1):
        art.append(lib.tube('carotid', [(hx + 0.1, hy + 0.16, 0.0), (hx + 0.25, hy + 0.15, 0.04 * k), (hx + 0.55, hy + 0.08, 0.06 * k)],
                            0.007, M['artery'], sides=6, samples=12))
    depicts(lib.deco(join(art, 'aorta'), ht, 'aorta'), 'aorta')
    ven = [lib.tube('vena_cava', [(hx + 0.07, hy + 0.04, 0.07), (hx - 0.05, hy + 0.01, 0.08), (hx - 0.3, hy - 0.02, 0.07),
                                  (hx - 0.55, hy + 0.04, 0.05)], [0.017, 0.016, 0.015, 0.012], M['vein'], sides=10, samples=30),
           lib.tube('vena_cava', [(hx + 0.09, hy + 0.08, 0.06), (hx + 0.25, hy + 0.12, 0.05), (hx + 0.5, hy + 0.08, 0.07)], 0.011, M['vein'],
                    sides=8, samples=12)]
    for k in (1, -1):
        ven.append(lib.tube('pulmonary', [(hx + 0.02, hy + 0.07, -0.02), (hx + 0.06, hy + 0.13, -0.03 * k), (hx + 0.02, hy + 0.12, 0.12 * k),
                                          (hx - 0.01, hy + 0.1, 0.19 * k)], [0.016, 0.014, 0.012, 0.009], M['vein'], sides=8, samples=16))
    depicts(lib.deco(join(ven, 'veins'), ht, 'great_veins'), 'great_veins')


def lungs(M, f):
    lib = L
    hx, hy, _ = lib.slot('heart')
    for s in SIDES:
        k = lib.side_sign(s)
        lx, ly, lz = lib.slot('lung', s)
        if k < 0:   # left lung: one lobe
            lobes = [lib.blob('lung', [((lx + 0.02, ly + 0.01, lz - 0.0), (0.17, 0.12, 0.085)), ((lx - 0.14, ly - 0.05, lz + 0.01), (0.1, 0.1, 0.08)),
                                       ((lx + 0.17, ly + 0.05, lz * 0.75), (0.07, 0.06, 0.06))], M['lung'], resolution=0.017)]
        else:       # right lung: superior, middle, inferior and post-caval lobes
            lobes = [lib.blob('lung', b, M['lung'], resolution=0.017) for b in (
                [((lx + 0.15, ly + 0.04, lz * 0.82), (0.085, 0.075, 0.075))],
                [((lx + 0.02, ly - 0.08, lz * 1.02), (0.08, 0.075, 0.072))],
                [((lx - 0.1, ly + 0.02, lz * 0.98), (0.12, 0.1, 0.085)), ((lx - 0.2, ly - 0.03, lz * 0.9), 0.06)],
                [((hx - 0.2, hy - 0.02, 0.1), (0.07, 0.055, 0.055))])]
        for j, o in enumerate(lobes):
            lib.displace_noise(o, 0.006, 22.0, seed=3 + j + (5 if k < 0 else 0))
        lu = join(lobes, 'lung') if len(lobes) > 1 else lobes[0]
        lib.part(lu, 'lung', s)
        br = [lib.tube('bronchus', [(hx + 0.14, hy + 0.08, 0.0), (lx + 0.06, ly + 0.0, lz * 0.55), (lx - 0.05, ly - 0.01, lz * 0.85)],
                       [0.014, 0.011, 0.007], M['cartilage'], sides=8, samples=12)]
        if k > 0:
            tr = lib.tube('trachea', [(1.2, 0.04, 0), (1.05, 0.055, 0), (0.88, 0.08, 0), (hx + 0.14, hy + 0.08, 0)], 0.022, M['trachea'],
                          sides=12, samples=60)
            paint(tr, lambda p: _mix('#c9a79c', '#f1e8de', 0.5 + 0.5 * math.cos(p[0] * 2 * math.pi / 0.032)))
            depicts(lib.deco(tr, lu, 'trachea'), 'trachea')
            br.append(lib.ellipsoid('larynx', (1.2, 0.04, 0), (0.035, 0.03, 0.032), M['cartilage'], segments=12, rings=8))
        lib.deco(join(br, 'airway'), lu, 'airway')


def _dome(ob, x0, k):
    """Curve a lobe so its anterior face is concave, following the dome of the diaphragm."""
    return L.transform(ob, lambda p: (p[0] - k * ((p[1] + 0.05) ** 2 + p[2] ** 2) + k * 0.02, p[1], p[2]))


def liver(M, f):
    lib = L
    lx, ly, lz = lib.slot('liver')
    lobes = [
        lib.ellipsoid('median_lobe', (lx + 0.07, ly - 0.02, 0.05), (0.1, 0.07, 0.15), M['liver'], segments=24, rings=14, rotate=('x', 0.2)),
        lib.ellipsoid('left_lateral', (lx + 0.03, ly - 0.03, -0.12), (0.1, 0.075, 0.13), M['liver'], segments=24, rings=14, rotate=('x', -0.35)),
        lib.ellipsoid('right_lobe', (lx - 0.02, ly + 0.03, lz + 0.09), (0.09, 0.08, 0.1), M['liver'], segments=24, rings=14, rotate=('x', 0.45)),
        lib.ellipsoid('caudate', (lx - 0.1, ly + 0.08, lz + 0.05), (0.06, 0.05, 0.06), M['liver'], segments=16, rings=10),
    ]
    for o in lobes:
        _dome(o, lx, 0.9)
    lv = join(lobes, 'liver')
    lib.part(lv, 'liver')
    gb = lib.ellipsoid('gallbladder', (lx + 0.12, ly - 0.08, 0.06), (0.03, 0.022, 0.022), M['gallbladder'], segments=14, rings=8)
    depicts(lib.deco(gb, lv, 'gallbladder'), 'gallbladder')


def gut(M, f):
    lib = L
    gx, gy, gz = lib.slot('gut')
    pieces = []
    # stomach: a J-shaped sac on the left, behind the liver
    pieces.append(lib.tube('stomach', [(0.22, 0.07, -0.08), (0.17, 0.02, -0.17), (0.06, -0.07, -0.16), (0.0, -0.12, -0.04),
                                       (0.07, -0.13, 0.08), (0.12, -0.11, 0.13)], [0.075, 0.098, 0.09, 0.07, 0.042, 0.028],
                           M['stomach'], sides=12, samples=22, subdiv=1))
    pieces.append(lib.tube('oesophagus', [(1.15, 0.11, 0.0), (0.9, 0.14, -0.01), (0.6, 0.14, -0.04), (0.35, 0.11, -0.07), (0.23, 0.08, -0.08)],
                           0.013, M['stomach'], sides=8, samples=30))
    # small intestine: a long tube coiled through the ventral abdomen (a smoothed, confined random walk)
    c = Vector((gx - 0.14, gy - 0.04, 0.0))
    R = Vector((0.26, 0.12, 0.25))
    p = Vector((0.08, -0.12, 0.16))
    d = Vector((-1, 0, 0.3)).normalized()
    pts = [tuple(p)]
    for i in range(260):
        q = Vector(((p - c).x / R.x ** 2, (p - c).y / R.y ** 2, (p - c).z / R.z ** 2))
        out = max(0.0, ((p - c).x / R.x) ** 2 + ((p - c).y / R.y) ** 2 + ((p - c).z / R.z) ** 2 - 0.55)
        n = noise.noise_vector(p * 7.0 + Vector((3.1, 1.7, 0.4)))
        d = (d + n * 0.9 - q * 0.02 * (1 + 8 * out)).normalized()
        p = p + d * 0.022
        if i % 2 == 0:
            pts.append(tuple(p))
    pieces.append(lib.tube('small_intestine', pts, 0.026, M['intestine'], sides=8, samples=int(len(pts) * 2.4)))
    # caecum: the large, comma-shaped blind sac of a rodent
    pieces.append(lib.tube('caecum', [(-0.45, -0.2, 0.15), (-0.33, -0.1, 0.27), (-0.14, -0.11, 0.3), (-0.04, -0.2, 0.24), (-0.08, -0.29, 0.12)],
                           [0.06, 0.072, 0.066, 0.05, 0.028], M['caecum'], sides=10, samples=22, subdiv=1))
    # colon to rectum, beaded with pellets toward the end
    col = lib.tube('colon', [(-0.45, -0.2, 0.15), (-0.42, -0.06, 0.18), (-0.26, 0.02, 0.04), (-0.38, 0.03, -0.14), (-0.62, 0.02, -0.1),
                             (-0.8, 0.06, -0.03), (-0.99, 0.07, 0.0)], 0.028, M['colon'], sides=10, samples=120)
    ripple(col, 10, lambda t, i, n: 1.0 + (0.35 * max(0.0, math.sin(i * 0.55)) if t > 0.6 else 0.0))
    pieces.append(col)
    g = join(pieces, 'gut')
    lib.part(g, 'gut')


def paired_organs(M, body, f):
    lib = L
    for s in SIDES:
        k = lib.side_sign(s)
        # kidney: a bean with its hilum facing the midline, and a ureter running back
        kx, ky, kz = lib.slot('kidney', s)
        kd = lib.ellipsoid('kidney', (kx, ky, kz), (0.078, 0.05, 0.042), M['kidney'], segments=24, rings=14)
        lib.transform(kd, lambda p: (p[0], p[1], p[2] + k * 0.03 * math.exp(-((p[0] - kx) ** 2 + (p[1] - ky) ** 2) / 0.0012)
                                     if (p[2] - kz) * k < 0 else p[2]))
        lib.part(kd, 'kidney', s)
        ur = lib.tube('ureter', [(kx, ky - 0.01, kz - k * 0.035), (kx - 0.15, ky - 0.12, kz - k * 0.12), (-0.68, -0.15, 0.05 * k),
                                 (-0.78, -0.16, 0.02 * k)], 0.006, M['ureter'], sides=5, samples=20)
        adr = lib.ellipsoid('adrenal_cap', (kx + 0.07, ky + 0.01, kz - k * 0.01), (0.022, 0.016, 0.018), M['parathyroid'], segments=10, rings=6)
        # two pieces, not one join: the ureter and the adrenal are different organs with different states
        depicts(lib.deco(ur, kd, 'ureter'), 'ureter')
        depicts(lib.deco(adr, kd, 'adrenal'), 'adrenal')
        # gonad: a neutral ovoid with its duct (no sex is declared, so neither testis nor ovary is specified)
        gx, gy, gz = lib.slot('gonad', s)
        gd = lib.ellipsoid('gonad', (gx, gy, gz), (0.06, 0.042, 0.04), M['gonad'], segments=20, rings=12, rotate=('y', 0.35 * k))
        lib.part(gd, 'gonad', s)
        du = lib.tube('duct', [(gx + 0.04, gy + 0.03, gz - k * 0.02), (gx + 0.02, gy + 0.06, gz - k * 0.07), (gx - 0.08, gy + 0.03, gz - k * 0.13),
                               (-0.84, -0.12, 0.02 * k)], 0.007, M['ureter'], sides=5, samples=20)
        lib.deco(du, gd, 'duct')
        # muscle: a fusiform bundle of fascicles hugging the flank, with pale tendons at each end
        mx, my, mz = lib.slot('muscle', s)
        fas = []
        for j, (dy, dx, sc) in enumerate(((0.0, 0.0, 1.0), (0.05, 0.05, 0.8), (-0.05, -0.04, 0.85))):
            ob = lib.lathe('fascicle', [(mx - 0.5 * sc + dx, 0.01, 0.01, my + dy), (mx - 0.25 * sc + dx, 0.032 * sc, 0.022 * sc, my + dy),
                                        (mx + dx, 0.042 * sc, 0.026 * sc, my + dy), (mx + 0.3 * sc + dx, 0.03 * sc, 0.02 * sc, my + dy),
                                        (mx + 0.55 * sc + dx, 0.01, 0.01, my + dy)], M['muscle'], sides=8, samples=13, subdiv=1)
            fas.append(ob)
        mu = join(fas, 'muscle')
        lib.transform(mu, lambda p: (p[0], p[1], k * (abs(body.wall(p[0], math.acos(max(-1, min(1, (p[1] - body.at(p[0])[2]) / body.at(p[0])[0]))),
                                                                      0.86)[2]) - 0.03 + p[2])))
        lib.part(mu, 'muscle', s)
        tend = [lib.tube('tendon', [(mx - 0.5, my, 0), (mx - 0.62, my + 0.01, 0)], [0.008, 0.004], M['tendon'], sides=6, samples=5),
                lib.tube('tendon', [(mx + 0.55, my, 0), (mx + 0.68, my + 0.02, 0)], [0.008, 0.004], M['tendon'], sides=6, samples=5)]
        for t_ in tend:
            lib.transform(t_, lambda p: (p[0], p[1], k * abs(body.wall(p[0], 1.85, 0.84)[2])))
        lib.deco(join(tend, 'tendons'), mu, 'tendons')
        # immune: a chain of lymph nodes on a lymphatic vessel under the dorsal flank
        ix, iy, iz = lib.slot('immune', s)
        nodes = []
        for j, (x, r) in enumerate(((ix + 0.28, 0.036), (ix + 0.1, 0.05), (ix - 0.1, 0.045), (ix - 0.28, 0.034))):
            nodes.append(lib.ellipsoid('lymph_node', (x, iy - 0.01 * j, iz * (0.96 + 0.02 * j)), (r * 1.25, r * 0.8, r * 0.75), M['lymph'],
                                       segments=16, rings=10, rotate=('y', 0.3 * k)))
        im = join(nodes, 'immune')
        lib.part(im, 'immune', s)
        ly = lib.tube('lymphatic', [(ix + 0.42, iy + 0.02, iz * 0.9), (ix + 0.1, iy, iz * 0.98), (ix - 0.1, iy - 0.02, iz * 1.0),
                                    (ix - 0.42, iy - 0.04, iz * 0.98)], 0.006, M['lymphatic'], sides=5, samples=30)
        lib.deco(ly, im, 'lymphatic')
        # endocrine: a thyroid lobe beside the trachea, with its parathyroid
        nx, ny, nz = lib.slot('endocrine', s)
        en = lib.ellipsoid('thyroid', (nx, 0.065, k * 0.07), (0.055, 0.03, 0.022), M['thyroid'], segments=18, rings=10, rotate=('x', -0.3 * k))
        lib.part(en, 'endocrine', s)
        pt = lib.ellipsoid('parathyroid', (nx + 0.03, 0.08, k * 0.082), (0.011, 0.009, 0.009), M['parathyroid'], segments=8, rings=6)
        depicts(lib.deco(pt, en, 'parathyroid'), 'parathyroid')
