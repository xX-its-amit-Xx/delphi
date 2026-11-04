"""Shared bpy helpers for the scale theatre's ILLUSTRATION meshes.

Every function here takes PAGE coordinates, the frame the theatre draws in (world = body-frames pos * 2):

    +x anterior    +y dorsal    +z the animal's RIGHT  (-z is its left)

and converts to Blender's Z-up internally (blender = (x, -z, y)), so that after the glTF exporter's Y-up
conversion a vertex lands exactly where the page puts the schematic bead for the same slot. A sculptor
never has to think about Blender's axes.

Nothing here is measured. These helpers make smooth, plausible, textbook-shaped forms; the manifest and the
GLB both say "schematic-illustration" and THIS_IS_NOT_MORPHOMETRY, and so must anything built with them.

Overview (all return a bpy Object unless stated):

    coordinates   P(x, y, z) -> Blender Vector;  to_page(vec) -> (x, y, z);  slot(name, side, i) -> page xyz;
                  slot_r(name) -> page-units radius;  side_sign(side) -> +1 right / -1 left
    naming        part(obj, slot, side='single', i=None, role=None)    the clickable 'slot:...' node
                  deco(obj, parent, what)                               a non-clickable child 'deco:<slot>:<what>'
    materials     material(name, base, rough, metal, transmission, clearcoat, sheen, subsurface, alpha, ...)
    primitives    ellipsoid, lathe (surface of revolution with elliptic sections), tube (variable radius
                  along a smoothed path), helix_points, limb (skin modifier), blob (metaballs -> mesh),
                  membrane (a billowed, thickened sheet from an outline), icosphere, polyhedron
    surface       instance_on_surface (hairs, bristles, cilia, facets; triangle budget enforced),
                  scatter_in_ellipsoid (ribosomes, granules), proto_hair / proto_cilium / proto_bead / proto_hex
    finishing     move, transform, smooth, subdivide, displace_noise, gradient / bands (vertex colours),
                  mirror_z, join, triangles, page_bbox
    stage plumbing begin_frame / begin_stage / end_stage are called by build_mesh.py, not by sculptors

A sculptor writes frames/<frame>.py with one function:

    def build(spec, lib, stage):   # stage is the stage key, e.g. 'larva'
        ...create objects with lib.*, name the clickable ones with lib.part(...)

Objects created while a stage is open are parented to that stage's root empty automatically.
"""
import bpy
import bmesh
import json
import math
import os
import random
from mathutils import Vector, Matrix, noise

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES_JSON = os.path.normpath(os.path.join(HERE, '..', 'body-frames.json'))
GEOMETRY_BASIS = 'schematic-illustration'
ROLES = ('envelope', 'shell', 'appendage', 'interior')

# Default role of each slot, per frame. The page uses it: an ENVELOPE slot with no parts of its own is drawn
# as the body (the blueprint names the organism, not that region); a SHELL encloses everything and is picked
# last; INTERIOR organs are seen through a translucent envelope; APPENDAGES are opaque and outside.
DEFAULT_ROLE = {
    'insect': {'head': 'envelope', 'thorax': 'envelope', 'abdomen': 'envelope', 'cuticle': 'shell',
               'eye': 'appendage', 'antenna': 'appendage', 'mouthpart': 'appendage', 'wing': 'appendage',
               'haltere': 'appendage', 'leg': 'appendage'},
    'tetrapod': {'head': 'envelope', 'trunk': 'envelope', 'skin': 'shell', 'eye': 'appendage', 'ear': 'appendage',
                 'forelimb': 'appendage', 'hindlimb': 'appendage', 'wing_membrane': 'appendage', 'tail': 'appendage'},
    'prokaryote': {'cell_body': 'envelope', 'envelope': 'shell', 'flagellum': 'appendage'},
    'construct': {'surface': 'envelope'},
}

# ------------------------------------------------------------------------------------------------ state

_S = {'frame': None, 'slots': {}, 'stage': None, 'root': None, 'objects': [], 'nodes': [], 'n': 0,
      'budget': 150000, 'drivers_used': {}}


def _frames():
    with open(FRAMES_JSON, encoding='utf-8') as fh:
        return json.load(fh)['frames']


def begin_frame(frame, spec=None):
    """Called once by build_mesh.py. Loads the frame's slots (positions scaled to page units, x2)."""
    fr = _frames().get(frame)
    if fr is None:
        raise ValueError('no frame %r in body-frames.json' % frame)
    _S['frame'] = frame
    _S['slots'] = {s['slot']: s for s in fr['slots']}
    _S['spec'] = spec or {}
    _S['nodes'] = []


def begin_stage(key):
    """Called by build_mesh.py: an empty named 'stage:<key>' that every object made until end_stage hangs from."""
    root = bpy.data.objects.new('stage:%s' % key, None)
    root.empty_display_type = 'PLAIN_AXES'
    bpy.context.scene.collection.objects.link(root)
    root['node'] = 'stage:%s' % key
    root['stage'] = key
    root['role'] = 'stage'
    root['geometry_basis'] = GEOMETRY_BASIS
    _S['stage'], _S['root'], _S['objects'] = key, root, []
    return root


def end_stage():
    """Called by build_mesh.py. Stamps the stage on every object and returns [(obj, triangles)]."""
    _resolve_decos()
    out = []
    for ob in _S['objects']:
        if ob.name not in bpy.data.objects:
            continue
        ob['stage'] = _S['stage']
        out.append((ob, triangles(ob) if ob.type == 'MESH' else 0))
    _S['nodes'].extend(out)
    _S['stage'], _S['root'] = None, None
    return out


def stage():
    """The stage key currently being sculpted."""
    return _S['stage']


def frame():
    return _S['frame']


def driver(name, default=None):
    """A declared number from spec.drivers, recorded as used by the next part(); else `default` (schematic)."""
    d = (_S.get('spec') or {}).get('drivers', {}).get(name)
    if d is None:
        return default
    _S['drivers_used'][name] = d
    return d.get('value', default)

# ------------------------------------------------------------------------------------------- coordinates


def P(x, y=0.0, z=0.0):
    """Page coordinates (x anterior, y dorsal, z right) -> a Blender Vector (x, -z, y)."""
    if hasattr(x, '__len__'):
        x, y, z = x
    return Vector((x, -z, y))


def to_page(v):
    """Blender Vector -> page (x, y, z)."""
    return (v.x, v.z, -v.y)


def side_sign(side):
    """+1 for 'right' (and 'single'), -1 for 'left'."""
    return -1.0 if side == 'left' else 1.0


def slot(name, side='single', i=None):
    """Page position of a slot exactly as the page draws its schematic: pos * 2, z signed by side,
    and for a repeated slot (insect legs) the i-th repeat along x, i = 0 being the most POSTERIOR."""
    s = _S['slots'][name]
    x = s['x']
    if s.get('repeat') and i is not None:
        x += (i - (s['repeat'] - 1) / 2.0) * s.get('repeat_span', 0.2)
    return (2 * x, 2 * s['y'], 2 * s.get('z', 0) * side_sign(side))


def slot_r(name):
    """The slot's schematic radius in page units (r * 2)."""
    return 2 * _S['slots'][name]['r']

# ----------------------------------------------------------------------------------------------- naming


def _register(ob, parent=None):
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent if parent is not None else _S['root']
    _S['objects'].append(ob)
    return ob


def part(ob, slot_name, side='single', i=None, role=None):
    """Make `ob` the clickable node for a slot. Its glTF name becomes 'slot:<slot>[:<side>[:<i>]]' and its
    extras {slot, side, stage, role, geometry_basis}. The slot must exist in this frame and the side must
    match the slot's pairing, or the build fails here rather than on the page."""
    s = _S['slots'].get(slot_name)
    if s is None:
        raise ValueError('slot %r is not in the %s frame (body-frames.json)' % (slot_name, _S['frame']))
    paired = s.get('side') == 'paired'
    if paired and side not in ('left', 'right'):
        raise ValueError('slot %r is paired: side must be left or right, not %r' % (slot_name, side))
    if not paired and side != 'single':
        raise ValueError('slot %r is single: side must be single, not %r' % (slot_name, side))
    node = 'slot:' + slot_name
    if side != 'single' or i is not None:
        node += ':' + side
    if i is not None:
        node += ':%d' % i
    ob['node'] = node
    ob['slot'] = slot_name
    ob['side'] = side
    ob['role'] = role or DEFAULT_ROLE.get(_S['frame'], {}).get(slot_name, 'interior')
    ob['geometry_basis'] = GEOMETRY_BASIS
    if _S['drivers_used']:
        ob['drivers_used'] = json.dumps(_S['drivers_used'])
        _S['drivers_used'] = {}
    ob.name = '%s|%s' % (node, _S['stage'])
    return ob


def deco(ob, parent, what):
    """A decorative, NON-clickable piece (bristles, veins, cilia, facets) hung under a slot node, so it is
    shown, hidden and ghosted together with that slot. Named 'deco:<slot>:<what>'. It may be called before
    or after part() names the parent; the slot is resolved when the stage closes.
    parent=None with what='body:<what>' is for a piece that belongs to the whole organism (an egg's chorion):
    the page styles it with the body part."""
    _S['n'] += 1
    ob['deco'] = what
    ob['role'] = 'deco'
    ob['geometry_basis'] = GEOMETRY_BASIS
    if parent is not None:
        ob.parent = parent
    else:
        sl = what.split(':', 1)[0]
        ob['slot'], ob['side'], ob['node'] = sl, 'single', 'deco:%s' % what
    ob['_n'] = _S['n']
    ob.name = 'deco|%s|%d' % (_S['stage'], _S['n'])
    return ob


def _resolve_decos():
    for ob in _S['objects']:
        if ob.name not in bpy.data.objects or 'deco' not in ob or 'node' in ob:
            continue
        p = ob.parent
        while p is not None and 'slot' not in p:
            p = p.parent
        if p is None:
            raise ValueError('deco %r hangs from no slot node: call part() on its parent' % ob['deco'])
        ob['slot'], ob['side'] = p['slot'], p['side']
        ob['node'] = 'deco:%s:%s' % (p['slot'], ob['deco'])
        ob.name = '%s|%s|%d' % (ob['node'], _S['stage'], ob['_n'])
        del ob['_n']


# -------------------------------------------------------------------------------------------- materials


def _lin(c):
    """sRGB 0-1 (or '#rrggbb') -> linear, as Blender's Base Color expects."""
    if isinstance(c, str):
        h = c.lstrip('#')
        c = tuple(int(h[k:k + 2], 16) / 255.0 for k in (0, 2, 4))
    f = lambda u: u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


def _inp(bsdf, names, value):
    for n in names:
        if n in bsdf.inputs:
            try:
                bsdf.inputs[n].default_value = value
                return True
            except Exception:
                pass
    return False


_MATS = {}


def material(name, base='#cccccc', rough=0.5, metal=0.0, transmission=0.0, clearcoat=0.0, clearcoat_rough=0.08,
             sheen=0.0, sheen_rough=0.5, sheen_tint='#ffffff', subsurface=0.0, ior=1.45, alpha=1.0, specular=0.5,
             emission=None, emission_strength=0.0, vertex_color=False, double_sided=True):
    """A Principled BSDF material the glTF exporter maps to PBR + KHR extensions:
    transmission -> KHR_materials_transmission, clearcoat -> KHR_materials_clearcoat, sheen -> KHR_materials_sheen,
    ior -> KHR_materials_ior, emission -> emissive (+ KHR_materials_emissive_strength). `base` is sRGB
    ('#rrggbb' or a 0-1 tuple). vertex_color=True takes the base colour from the 'Col' attribute that
    gradient() paints, so a body can shade from a dark back to a pale belly without textures.
    alpha < 1 makes it BLEND. Cached by name, so call it freely."""
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    _inp(bsdf, ['Base Color'], _lin(base))
    _inp(bsdf, ['Roughness'], rough)
    _inp(bsdf, ['Metallic'], metal)
    _inp(bsdf, ['IOR'], ior)
    _inp(bsdf, ['Specular IOR Level', 'Specular'], specular)
    _inp(bsdf, ['Transmission Weight', 'Transmission'], transmission)
    _inp(bsdf, ['Coat Weight', 'Clearcoat'], clearcoat)
    _inp(bsdf, ['Coat Roughness', 'Clearcoat Roughness'], clearcoat_rough)
    _inp(bsdf, ['Sheen Weight', 'Sheen'], sheen)
    _inp(bsdf, ['Sheen Roughness'], sheen_rough)
    _inp(bsdf, ['Sheen Tint'], _lin(sheen_tint))
    _inp(bsdf, ['Subsurface Weight', 'Subsurface'], subsurface)
    if emission is not None:
        _inp(bsdf, ['Emission Color', 'Emission'], _lin(emission))
        _inp(bsdf, ['Emission Strength'], emission_strength or 1.0)
    if alpha < 1.0:
        _inp(bsdf, ['Alpha'], alpha)
        for attr, val in (('blend_method', 'BLEND'), ('surface_render_method', 'BLENDED')):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    if vertex_color:
        vc = nt.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    m.use_backface_culling = not double_sided
    m.diffuse_color = _lin(base)
    _MATS[name] = m
    return m

# ------------------------------------------------------------------------------------------ mesh basics


def mesh_object(name, verts, faces, mat=None, smooth_shade=True, page=True):
    """An object from raw vertices (page coords unless page=False) and faces. Registered in the open stage."""
    me = bpy.data.meshes.new(name)
    vs = [P(v) for v in verts] if page else [Vector(v) for v in verts]
    me.from_pydata(vs, [], faces)
    me.validate(clean_customdata=False)
    me.update()
    ob = bpy.data.objects.new(name, me)
    if mat is not None:
        me.materials.append(mat)
    if smooth_shade:
        smooth(ob)
    return _register(ob)


def move(ob, dx=0.0, dy=0.0, dz=0.0):
    """Translate an object's vertices by a PAGE offset (geometry is baked in place; transforms stay identity)."""
    d = P(dx, dy, dz)
    for v in ob.data.vertices:
        v.co += d
    ob.data.update()
    return ob


def transform(ob, fn):
    """Apply fn(page_xyz) -> page_xyz to every vertex (bend, compress, shear a whole form)."""
    for v in ob.data.vertices:
        v.co = P(fn(to_page(v.co)))
    ob.data.update()
    return ob


def smooth(ob):
    """Smooth shading on every face."""
    me = ob.data
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.update()
    return ob


def subdivide(ob, levels=1):
    """A Catmull-Clark subdivision modifier (applied at export). Each level multiplies faces by 4."""
    if levels <= 0:
        return ob
    md = ob.modifiers.new('subdiv', 'SUBSURF')
    md.levels = levels
    md.render_levels = levels
    return ob


def _catmull(pts, n):
    """Catmull-Rom through tuples `pts` (any dimension), n samples including both ends."""
    if len(pts) < 2:
        return list(pts)
    k = len(pts[0])
    ext = [tuple(2 * a - b for a, b in zip(pts[0], pts[1]))] + list(pts) + [tuple(2 * a - b for a, b in zip(pts[-1], pts[-2]))]
    out = []
    segs = len(pts) - 1
    for s in range(n):
        u = s / (n - 1) * segs
        i = min(int(u), segs - 1)
        t = u - i
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        t2, t3 = t * t, t * t * t
        out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
                                (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in range(k)))
    return out


def catmull(pts, n):
    """Public Catmull-Rom resampler (see _catmull)."""
    return _catmull([tuple(p) for p in pts], n)


def ellipsoid(name, center, radii, mat=None, segments=32, rings=18, rotate=None, subdiv=0):
    """A UV ellipsoid. center and radii (rx, ry, rz) in page axes; rotate=(axis 'x'|'y'|'z', radians) in page axes."""
    cx, cy, cz = center
    rx, ry, rz = radii if hasattr(radii, '__len__') else (radii, radii, radii)
    verts, faces = [], []
    verts.append((0.0, ry, 0.0))
    for r in range(1, rings):
        th = math.pi * r / rings
        for s in range(segments):
            ph = 2 * math.pi * s / segments
            verts.append((rx * math.sin(th) * math.cos(ph), ry * math.cos(th), rz * math.sin(th) * math.sin(ph)))
    verts.append((0.0, -ry, 0.0))
    top, bot = 0, len(verts) - 1
    for s in range(segments):
        faces.append((top, 1 + (s + 1) % segments, 1 + s))
    for r in range(rings - 2):
        a, b = 1 + r * segments, 1 + (r + 1) * segments
        for s in range(segments):
            faces.append((a + s, a + (s + 1) % segments, b + (s + 1) % segments, b + s))
    last = 1 + (rings - 2) * segments
    for s in range(segments):
        faces.append((last + s, last + (s + 1) % segments, bot))
    verts = [_rot(v, rotate) for v in verts]
    verts = [(v[0] + cx, v[1] + cy, v[2] + cz) for v in verts]
    ob = mesh_object(name, verts, faces, mat)
    return subdivide(ob, subdiv)


def _rot(v, rotate):
    if not rotate:
        return v
    rots = rotate if isinstance(rotate[0], (list, tuple)) else [rotate]
    x, y, z = v
    for ax, a in rots:
        c, s = math.cos(a), math.sin(a)
        if ax == 'x':
            y, z = y * c - z * s, y * s + z * c
        elif ax == 'y':
            z, x = z * c - x * s, z * s + x * c
        else:
            x, y = x * c - y * s, x * s + y * c
    return (x, y, z)


def icosphere(name, center, radius, mat=None, subdiv=2):
    """An icosphere (even triangles; good for cells, granules, eyes before facets)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in bm.verts:
        v.co = P(center[0] + v.co.x * radius, center[1] + v.co.z * radius, center[2] - v.co.y * radius)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    if mat is not None:
        me.materials.append(mat)
    smooth(ob)
    return _register(ob)


def polyhedron(name, center, radius, mat=None):
    """A flat-shaded icosahedron: the textbook picture of a polyhedral microcompartment."""
    ob = icosphere(name, center, radius, mat, subdiv=0)
    ob.data.polygons.foreach_set('use_smooth', [False] * len(ob.data.polygons))
    return ob


def lathe(name, profile, mat=None, sides=32, samples=48, cap=True, subdiv=1):
    """A smooth body of revolution along x with ELLIPTIC sections. profile = [(x, ry, rz, yc), ...] control
    points from POSTERIOR to ANTERIOR or the other way round (page units; yc = centre height, default 0).
    They are Catmull-Rom smoothed into `samples` rings. With cap=True each end closes on a rounded pole.
    The workhorse for heads, thoraces, abdomens, trunks, maggots, rods."""
    prof = [tuple(p) + (0.0,) * (4 - len(p)) for p in profile]
    rings = _catmull(prof, samples)
    verts, faces = [], []
    for (x, ry, rz, yc) in rings:
        ry, rz = max(ry, 1e-4), max(rz, 1e-4)
        for s in range(sides):
            a = 2 * math.pi * s / sides
            verts.append((x, yc + ry * math.cos(a), rz * math.sin(a)))
    n = len(rings)
    for r in range(n - 1):
        a, b = r * sides, (r + 1) * sides
        for s in range(sides):
            faces.append((a + s, a + (s + 1) % sides, b + (s + 1) % sides, b + s))
    if cap:
        for end, ring0 in ((0, 0), (1, (n - 1) * sides)):
            x, ry, rz, yc = rings[0] if end == 0 else rings[-1]
            dx = rings[1][0] - rings[0][0] if end == 0 else rings[-1][0] - rings[-2][0]
            pole = (x - math.copysign(min(ry, rz) * 0.35, dx) if end == 0 else x + math.copysign(min(ry, rz) * 0.35, dx), yc, 0.0)
            pi = len(verts)
            verts.append(pole)
            for s in range(sides):
                f = (ring0 + (s + 1) % sides, ring0 + s, pi) if end == 0 else (ring0 + s, ring0 + (s + 1) % sides, pi)
                faces.append(f)
    ob = mesh_object(name, verts, faces, mat)
    _fix_normals(ob)
    return subdivide(ob, subdiv)


def _fix_normals(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


def _frames_along(pts):
    """Tangents and parallel-transported normals along a polyline (Blender Vectors)."""
    tans = []
    for i in range(len(pts)):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        t = (b - a)
        tans.append(t.normalized() if t.length > 1e-9 else Vector((1, 0, 0)))
    ref = Vector((0, 0, 1)) if abs(tans[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = [(ref - tans[0] * ref.dot(tans[0])).normalized()]
    for i in range(1, len(pts)):
        n = nrm[-1] - tans[i] * nrm[-1].dot(tans[i])
        nrm.append(n.normalized() if n.length > 1e-9 else nrm[-1])
    return tans, nrm


def tube(name, points, radius, mat=None, sides=12, samples=None, cap=True, subdiv=0, flatten=1.0):
    """A tube along a smoothed path. points are page xyz control points; radius is one number or one per
    control point (interpolated, so a leg can taper and swell at a joint). Rounded caps. flatten < 1
    squashes the section (a ribbon-like vessel). Good for guts, tubules, antennae, veins, tails, flagella."""
    n = samples or max(8, len(points) * 6)
    rad = radius if hasattr(radius, '__len__') else [radius] * len(points)
    ctrl = [tuple(p) + (r,) for p, r in zip(points, rad)]
    sm = _catmull(ctrl, n)
    pts = [P(s[0], s[1], s[2]) for s in sm]
    rs = [max(s[3], 1e-4) for s in sm]
    tans, nrms = _frames_along(pts)
    verts, faces = [], []
    for p, t, nn, r in zip(pts, tans, nrms, rs):
        b = t.cross(nn)
        for s in range(sides):
            a = 2 * math.pi * s / sides
            verts.append(p + (nn * math.cos(a) * flatten + b * math.sin(a)) * r)
    for i in range(len(pts) - 1):
        a0, b0 = i * sides, (i + 1) * sides
        for s in range(sides):
            faces.append((a0 + s, a0 + (s + 1) % sides, b0 + (s + 1) % sides, b0 + s))
    if cap:
        for end in (0, 1):
            i = 0 if end == 0 else len(pts) - 1
            ring = i * sides
            d = -tans[0] if end == 0 else tans[-1]
            pi = len(verts)
            verts.append(pts[i] + d * rs[i] * 0.8)
            for s in range(sides):
                faces.append((ring + (s + 1) % sides, ring + s, pi) if end == 0 else (ring + s, ring + (s + 1) % sides, pi))
    ob = mesh_object(name, verts, faces, mat, page=False)
    _fix_normals(ob)
    return subdivide(ob, subdiv)


def helix_points(start, axis_dir, length, radius, turns, n=80, radius_growth=0.0):
    """Points of a helix (page coords) starting at `start`, running along unit `axis_dir` for `length`.
    radius_growth widens the coil along its length (a flagellar filament leaving its hook)."""
    ax = Vector(axis_dir).normalized()
    ref = Vector((0, 1, 0)) if abs(ax.y) < 0.9 else Vector((1, 0, 0))
    u = (ref - ax * ref.dot(ax)).normalized()
    v = ax.cross(u)
    out = []
    for k in range(n):
        t = k / (n - 1)
        r = radius * min(1.0, t * 6) * (1 + radius_growth * t)
        a = 2 * math.pi * turns * t
        p = Vector(start) + ax * (length * t) + (u * math.cos(a) + v * math.sin(a)) * r
        out.append((p.x, p.y, p.z))
    return out


def limb(name, points, radii, mat=None, subdiv=2, edges=None):
    """A jointed limb grown with Blender's SKIN modifier: one vertex per joint (page coords), one radius per
    joint, smoothed by subdivision. edges defaults to a chain; pass [(i, j), ...] for a branching hand.
    Falls back to tube() if the skin modifier cannot run headless."""
    try:
        me = bpy.data.meshes.new(name)
        me.from_pydata([P(p) for p in points], edges or [(k, k + 1) for k in range(len(points) - 1)], [])
        ob = bpy.data.objects.new(name, me)
        _register(ob)
        bpy.context.view_layer.objects.active = ob
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        ob.select_set(True)
        bpy.ops.object.modifier_add(type='SKIN')
        for k, sv in enumerate(me.skin_vertices[0].data):
            r = radii[k] if hasattr(radii, '__len__') else radii
            sv.radius = (r, r)
            sv.use_root = (k == 0)
        ob.modifiers[-1].use_smooth_shade = True
        subdivide(ob, subdiv)
        if mat is not None:
            me.materials.append(mat)
        return ob
    except Exception:
        return tube(name, points, radii, mat, sides=10)


_MB = [0]


def blob(name, balls, mat=None, resolution=0.03, smooth_shade=True):
    """Organic merged shapes from metaballs, converted to a mesh. balls = [(center, radius)] or
    [(center, (rx, ry, rz))] in page coords; `radius` is the SURFACE radius a lone ball would have.
    Neighbouring balls fuse smoothly: fat bodies, livers, kidneys, nucleoids, a xenobot's lumpy body."""
    _MB[0] += 1
    mb = bpy.data.metaballs.new('mbtmp%d' % _MB[0])
    mb.resolution = resolution
    mb.threshold = 0.6
    k = 1.0 / 0.575            # a lone ball of radius R has its 0.6 isosurface at ~0.575 R
    for c, r in balls:
        if hasattr(r, '__len__'):
            el = mb.elements.new(type='ELLIPSOID')
            m = max(r)
            el.radius = m * k
            el.size_x, el.size_y, el.size_z = r[0] / m, r[2] / m, r[1] / m
        else:
            el = mb.elements.new(type='BALL')
            el.radius = r * k
        el.co = P(c)
    tmp = bpy.data.objects.new('mbtmp%d' % _MB[0], mb)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.metaballs.remove(mb)
    me.name = name
    ob = bpy.data.objects.new(name, me)
    if mat is not None:
        me.materials.clear()
        me.materials.append(mat)
    if smooth_shade:
        smooth(ob)
    return _register(ob)


def membrane(name, outline, mat=None, billow=0.0, normal=(0, 1, 0), thickness=0.012, rings=7, subdiv=1):
    """A sheet spanning a closed outline (page coords, any rough plane), meshed as concentric rings so it
    subdivides cleanly, billowed by `billow` along `normal` (page) most at the middle, and thickened.
    Insect wings, a patagium, an ear pinna, a fin web."""
    c = Vector((0, 0, 0))
    for p in outline:
        c += Vector(p)
    c /= len(outline)
    nrm = Vector(normal).normalized()
    verts, faces = [tuple(c + nrm * billow)], []
    m = len(outline)
    for k in range(1, rings + 1):
        f = k / rings
        lift = billow * (1 - f * f)
        for p in outline:
            q = c + (Vector(p) - c) * f + nrm * lift
            verts.append(tuple(q))
    for s in range(m):
        faces.append((0, 1 + s, 1 + (s + 1) % m))
    for k in range(rings - 1):
        a, b = 1 + k * m, 1 + (k + 1) * m
        for s in range(m):
            faces.append((a + s, b + s, b + (s + 1) % m, a + (s + 1) % m))
    ob = mesh_object(name, verts, faces, mat)
    _fix_normals(ob)
    if thickness > 0:
        md = ob.modifiers.new('thick', 'SOLIDIFY')
        md.thickness = thickness
        md.offset = 0.0
    return subdivide(ob, subdiv)

# ------------------------------------------------------------------------------------ surface detail


def proto_hair(sides=3, segments=2, bend=0.25):
    """A unit hair along +Z (length 1, base radius 1, tapering to a point, bending toward +X).
    Prototype vertices are (rx, ry, z, bx): rx, ry scale with the instance RADIUS, z and the bend bx with its
    LENGTH, so a long hair stays thin. Faces index those vertices."""
    verts, faces = [], []
    for k in range(segments + 1):
        t = k / (segments + 1)
        r = 1 - t
        for s in range(sides):
            a = 2 * math.pi * s / sides
            verts.append((r * math.cos(a), r * math.sin(a), t, bend * t * t))
    tip = len(verts)
    verts.append((0.0, 0.0, 1.0, bend))
    for k in range(segments):
        a, b = k * sides, (k + 1) * sides
        for s in range(sides):
            faces.append((a + s, a + (s + 1) % sides, b + (s + 1) % sides, b + s))
    top = segments * sides
    for s in range(sides):
        faces.append((top + s, top + (s + 1) % sides, tip))
    return verts, faces


def proto_cilium(sides=3, segments=4, bend=0.5):
    """A unit cilium: thin, even, whip-curved along +Z toward +X (the effective stroke direction)."""
    verts, faces = [], []
    for k in range(segments + 1):
        t = k / segments
        r = 1 - 0.4 * t
        for s in range(sides):
            a = 2 * math.pi * s / sides
            verts.append((r * math.cos(a), r * math.sin(a), t, bend * math.sin(t * math.pi / 2) ** 2))
    for k in range(segments):
        a, b = k * sides, (k + 1) * sides
        for s in range(sides):
            faces.append((a + s, a + (s + 1) % sides, b + (s + 1) % sides, b + s))
    return verts, faces


def proto_bead(subdiv=1):
    """A unit sphere (ribosomes, granules, facet lenses)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    verts = [(v.co.x, v.co.y, v.co.z, 0.0) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return verts, faces


def proto_hex(height=0.35):
    """A flattened hexagonal dome: one ommatidial facet, base radius 1 in XY, rising `height` along +Z."""
    verts = [(0.0, 0.0, height, 0.0)]
    for s in range(6):
        a = 2 * math.pi * s / 6
        verts.append((math.cos(a), math.sin(a), 0.0, 0.0))
    faces = [(0, 1 + s, 1 + (s + 1) % 6) for s in range(6)]
    return verts, faces


def _tris(faces):
    return sum(len(f) - 2 for f in faces)


def _surface_samples(target, count, rng, mask):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = target.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    mw = target.matrix_world
    tris = []
    for lt in me.loop_triangles:
        a, b, c = (mw @ me.vertices[i].co for i in lt.vertices)
        area = ((b - a).cross(c - a)).length / 2
        if area > 0:
            tris.append((a, b, c, area))
    ev.to_mesh_clear()
    if not tris:
        return []
    cum, s = [], 0.0
    for t in tris:
        s += t[3]
        cum.append(s)
    out, tries = [], 0
    import bisect
    while len(out) < count and tries < count * 30:
        tries += 1
        k = bisect.bisect_left(cum, rng.random() * s)
        a, b, c, _ = tris[min(k, len(tris) - 1)]
        u, v = rng.random(), rng.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        p = a + (b - a) * u + (c - a) * v
        n = (b - a).cross(c - a).normalized()
        if mask is None or mask(to_page(p), to_page(n)):
            out.append((p, n))
    return out


def instance_on_surface(name, target, proto, count, mat=None, length=(0.04, 0.06), radius=0.004, seed=1,
                        lean=None, lean_amount=0.0, mask=None, budget_tris=30000, sink=0.15):
    """Scatter copies of a prototype (proto_hair, proto_cilium, proto_hex, proto_bead...) over the surface of
    `target`, each standing on the local normal, optionally leaning toward page direction `lean`. Joined into
    ONE mesh (one draw call). `count` is capped so the result stays under `budget_tris`. mask(page_pos,
    page_normal) -> bool restricts where they grow (e.g. only the ventral face). Returns the object, or None
    if nothing was placed. Name it with deco(), not part(): surface detail is never a clickable part."""
    pv, pf = proto
    per = _tris(pf)
    count = int(min(count, max(0, budget_tris // max(per, 1))))
    rng = random.Random(seed)
    samples = _surface_samples(target, count, rng, mask)
    if not samples:
        return None
    lean_v = P(lean).normalized() if lean is not None else None
    verts, faces = [], []
    for p, n in samples:
        z = n.copy()
        if lean_v is not None and lean_amount:
            z = (z + lean_v * lean_amount).normalized()
        ref = Vector((0, 0, 1)) if abs(z.z) < 0.9 else Vector((1, 0, 0))
        x = (ref - z * ref.dot(z)).normalized()
        if lean_v is not None:
            xl = lean_v - z * lean_v.dot(z)
            if xl.length > 1e-6:
                x = xl.normalized()
        y = z.cross(x)
        L = rng.uniform(*length) if hasattr(length, '__len__') else length
        R = rng.uniform(*radius) if hasattr(radius, '__len__') else radius
        base = len(verts)
        origin = p - n * (L * sink)
        for vx, vy, vz, bx in pv:
            verts.append(origin + x * (vx * R + bx * L) + y * (vy * R) + z * (vz * L))
        faces.extend(tuple(base + i for i in f) for f in pf)
    ob = mesh_object(name, [tuple(v) for v in verts], faces, mat, page=False)
    return ob


def scatter_in_ellipsoid(name, center, radii, proto, count, mat=None, size=(0.01, 0.02), seed=1, budget_tris=20000,
                         avoid=None):
    """Scatter copies of a prototype through an ellipsoid volume (page coords): ribosomes in a cytoplasm,
    granules, vesicles. avoid(page_pos) -> True skips a point (keep out of a nucleoid). One joined mesh."""
    pv, pf = proto
    count = int(min(count, max(0, budget_tris // max(_tris(pf), 1))))
    rng = random.Random(seed)
    verts, faces = [], []
    placed, tries = 0, 0
    while placed < count and tries < count * 40:
        tries += 1
        u = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if u.length > 1:
            continue
        q = (center[0] + u.x * radii[0], center[1] + u.y * radii[1], center[2] + u.z * radii[2])
        if avoid and avoid(q):
            continue
        s = rng.uniform(*size)
        base = len(verts)
        c = P(q)
        verts.extend(c + Vector(v[:3]) * s for v in pv)
        faces.extend(tuple(base + i for i in f) for f in pf)
        placed += 1
    if not verts:
        return None
    return mesh_object(name, [tuple(v) for v in verts], faces, mat, page=False)

# ---------------------------------------------------------------------------------------- finishing


def displace_noise(ob, amount=0.03, scale=3.0, seed=0):
    """Organic lumpiness: move each vertex along its normal by Perlin noise. Use before subdivision."""
    me = ob.data
    off = Vector((seed * 7.31, seed * 3.17, seed * 1.93))
    for v in me.vertices:
        v.co = v.co + v.normal * amount * noise.noise(v.co * scale + off)
    me.update()
    return ob


def gradient(ob, stops, axis='y'):
    """Paint the 'Col' vertex colour along a page axis. stops = [(t, '#rrggbb'), ...] with t in page units
    along `axis` ('x', 'y' or 'z'); colours between stops are interpolated. Pair with
    material(..., vertex_color=True). A dark dorsum over a pale belly, banded abdominal tergites."""
    me = ob.data
    attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    idx = {'x': 0, 'y': 1, 'z': 2}[axis]
    st = sorted((t, _hex(c)) for t, c in stops)

    def col(t):
        if t <= st[0][0]:
            return st[0][1]
        for (t0, c0), (t1, c1) in zip(st, st[1:]):
            if t <= t1:
                f = (t - t0) / max(t1 - t0, 1e-9)
                return tuple(a + (b - a) * f for a, b in zip(c0, c1))
        return st[-1][1]
    for loop in me.loops:
        pv = to_page(me.vertices[loop.vertex_index].co)
        c = col(pv[idx])
        attr.data[loop.index].color_srgb = (c[0], c[1], c[2], 1.0)
    me.update()
    return ob


def bands(ob, axis_values, colour_a, colour_b, axis='x', soft=0.25):
    """Alternating colour bands (abdominal segments): boundaries at axis_values (page units)."""
    stops = []
    for k, v in enumerate(sorted(axis_values)):
        c0, c1 = (colour_a, colour_b) if k % 2 == 0 else (colour_b, colour_a)
        stops += [(v - soft * 0.1, c0), (v + soft * 0.1, c1)]
    return gradient(ob, stops, axis)


def _hex(c):
    if isinstance(c, str):
        h = c.lstrip('#')
        return tuple(int(h[k:k + 2], 16) / 255.0 for k in (0, 2, 4))
    return tuple(c[:3])


def mirror_z(ob, name=None):
    """A copy of `ob` mirrored to the other side (page z -> -z), normals fixed, modifiers and materials kept.
    Build the right side, then mirror_z it and part(..., 'left'). Children (decos) are mirrored too."""
    me = ob.data.copy()
    for v in me.vertices:
        v.co.y = -v.co.y
    me.flip_normals()
    me.update()
    cp = bpy.data.objects.new(name or (ob.name + '_m'), me)
    for md in ob.modifiers:
        n = cp.modifiers.new(md.name, md.type)
        for prop in ('levels', 'render_levels', 'thickness', 'offset', 'use_smooth_shade'):
            if hasattr(md, prop):
                try:
                    setattr(n, prop, getattr(md, prop))
                except Exception:
                    pass
    _register(cp)
    for ch in list(ob.children):
        if ch.type == 'MESH':
            c2 = mirror_z(ch, ch.name + '_m')
            c2.parent = cp
            for k in ('deco', 'slot', 'role', 'geometry_basis', 'node'):
                if k in ch:
                    c2[k] = ch[k]
    return cp


def join(objs, name):
    """Merge several mesh objects (with modifiers applied) into one plain mesh, keeping per-face materials."""
    objs = [o for o in objs if o is not None]
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    mats = []
    for o in objs:
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev)
        me.transform(o.matrix_world)
        off = len(mats)
        for m in me.materials:
            mats.append(m)
        for p in me.polygons:
            p.material_index += off
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    for m in mats:
        out.materials.append(m)
    for o in objs:
        if o in _S['objects']:
            _S['objects'].remove(o)
        bpy.data.objects.remove(o)
    ob = bpy.data.objects.new(name, out)
    smooth(ob)
    return _register(ob)


def triangles(ob):
    """Triangles this object exports (modifiers applied)."""
    if ob.type != 'MESH':
        return 0
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    ev.to_mesh_clear()
    return n


def page_bbox(obs):
    """Page-coordinate bounding box of evaluated meshes: {'x': [min, max], 'y': [...], 'z': [...]}."""
    dg = bpy.context.evaluated_depsgraph_get()
    lo, hi = [1e9] * 3, [-1e9] * 3
    for ob in obs:
        if ob.type != 'MESH':
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ob.matrix_world
        for v in me.vertices:
            p = to_page(mw @ v.co)
            for k in range(3):
                lo[k] = min(lo[k], p[k])
                hi[k] = max(hi[k], p[k])
        ev.to_mesh_clear()
    return {a: [round(lo[k], 3), round(hi[k], 3)] for k, a in enumerate('xyz')}
