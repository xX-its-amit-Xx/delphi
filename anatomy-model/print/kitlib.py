"""Shared geometry + verification helpers for the winged-zebrafish print kit.

Conventions after glTF import into Blender:
  X = body length, head at +X        (glTF +X)
  Y = left-right / span              (glTF -Z)
  Z = dorsoventral / up              (glTF +Y)

All geometry is worked in MILLIMETRES at the kit scale.
"""
import bpy, bmesh, math, json, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

# ---------------------------------------------------------------- joinery spec
PEG_R        = 1.75   # organ/card peg radius
PEG_H        = 3.6
PEG_R_BIG    = 2.50   # carrier -> body-case peg radius
PEG_H_BIG    = 4.0
CLEARANCE    = 0.30   # radial clearance, sockets are this much larger
DEPTH_CLEAR  = 0.40   # socket is this much deeper than the peg is long
KEY_FLAT     = 0.62   # D-profile flat at this fraction of the radius, on +X
PLATE_T      = 5.0    # system-carrier plate thickness
PLATE_MARGIN = 4.0
MIN_WALL     = 1.2    # minimum strut / wall anywhere in the kit
MIN_FEATURE  = 6.0    # no part's longest dimension may be under this
CASE_WALL    = 1.6
TOKEN_AF     = 11.0   # token across flats
TOKEN_T      = 3.5
TOKEN_CLEAR  = 0.30


def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def act(ob):
    bpy.context.view_layer.objects.active = ob
    return ob


def new_mesh_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def d_cylinder(name, r, h, loc, flat_axis=0, segments=28, flat_at=None):
    """A cylinder with one flat chord cut on +X: a key, so a part seats one way only.

    Built by clamping vertex coordinates rather than by a boolean, which is both
    faster and cannot fail.
    """
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=r, radius2=r, depth=h)
    flat = r * KEY_FLAT if flat_at is None else flat_at
    for v in bm.verts:
        if v.co[flat_axis] > flat:
            v.co[flat_axis] = flat
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    ob = new_mesh_obj(name, bm)
    ob.location = loc
    return ob


def box(name, size, loc):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    ob = new_mesh_obj(name, bm)
    ob.location = loc
    return ob


def index_triangle(name, loc, size=3.2, height=0.9):
    """A raised index mark: a triangular prism pointing toward +X (the key flat).

    Aligning the mark on the child with the mark on the carrier means the part is
    the right way round.
    """
    bm = bmesh.new()
    h = size / 2.0
    vs = [bm.verts.new((size * 0.6, 0, 0)), bm.verts.new((-size * 0.4, h, 0)),
          bm.verts.new((-size * 0.4, -h, 0))]
    f = bm.faces.new(vs)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, -height / 2))
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    verts = [e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=verts, vec=(0, 0, height))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_mesh_obj(name, bm)
    ob.location = loc
    return ob


def hex_prism(name, across_flats, h, loc):
    bm = bmesh.new()
    r = across_flats / math.sqrt(3.0)          # circumradius for a hex given A/F
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=6,
                          radius1=r, radius2=r, depth=h)
    ob = new_mesh_obj(name, bm)
    ob.location = loc
    return ob


# ---------------------------------------------------------------- mesh surgery
def strip_sk(ob):
    if ob.data.shape_keys:
        ob.shape_key_clear()


def world_scale(ob, s):
    """Scale about the world origin WITHOUT destroying the object's own transform
    (mirrors and rotations from the glTF import must survive)."""
    strip_sk(ob)
    ob.matrix_world = Matrix.Scale(s, 4) @ ob.matrix_world


def apply_transform(ob):
    act(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def has_boundary(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    n = sum(1 for e in bm.edges if len(e.link_faces) < 2)
    bm.free(); return n > 0


def solidify(ob, mm, offset=0.0):
    strip_sk(ob)
    m = ob.modifiers.new("solid", "SOLIDIFY")
    m.thickness = mm
    m.offset = offset
    m.use_even_offset = False
    m.nonmanifold_thickness_mode = "CONSTRAINTS"
    act(ob)
    bpy.ops.object.modifier_apply(modifier=m.name)


def inflate(ob, mm):
    """Push every surface outward along its normal by mm. Used to raise thin
    struts to the minimum wall. Recorded as a deviation."""
    m = ob.modifiers.new("inf", "DISPLACE")
    m.direction = "NORMAL"
    m.mid_level = 0.0
    m.strength = mm
    act(ob)
    bpy.ops.object.modifier_apply(modifier=m.name)


def remesh(ob, vox):
    act(ob)
    ob.data.remesh_voxel_size = vox
    ob.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()


def recalc(ob):
    act(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def join(objs, name):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    act(objs[0])
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


def boolean(ob, cutter, op="DIFFERENCE"):
    m = ob.modifiers.new("bool", "BOOLEAN")
    m.operation = op
    m.object = cutter
    m.solver = "EXACT"
    act(ob)
    try:
        bpy.ops.object.modifier_apply(modifier=m.name)
        ok = True
    except Exception:
        ob.modifiers.remove(m)
        ok = False
    bpy.ops.object.select_all(action="DESELECT")
    cutter.select_set(True)
    bpy.ops.object.delete()
    return ok


def delete_all_but(keep):
    bpy.ops.object.select_all(action="DESELECT")
    for o in list(bpy.context.scene.objects):
        if o not in keep:
            o.select_set(True)
    bpy.ops.object.delete()


# ---------------------------------------------------------------- measurement
def tri_bm(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


def volume_com(ob):
    bm = tri_bm(ob)
    M = ob.matrix_world
    V = 0.0; C = Vector((0, 0, 0))
    for f in bm.faces:
        a, b, c = (M @ v.co for v in f.verts)
        v6 = a.dot(b.cross(c))
        V += v6; C += (a + b + c) * v6
    bm.free()
    vol = V / 6.0
    com = (C / 4.0) / V if abs(V) > 1e-12 else Vector((0, 0, 0))
    return vol, com


def check(ob):
    """watertight + no-inverted-normals, the correct way (see README)."""
    bm = tri_bm(ob)
    bad = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    noncontig = sum(1 for e in bm.edges if len(e.link_faces) == 2 and not e.is_contiguous)
    lv = sum(1 for v in bm.verts if not v.link_faces)
    le = sum(1 for e in bm.edges if not e.link_faces)
    tris = len(bm.faces)
    bm.free()
    vol, com = volume_com(ob)
    return dict(triangles=tris, nonmanifold_edges=bad,
                inconsistently_wound_edges=noncontig,
                loose_verts=lv, loose_edges=le,
                volume_mm3=round(vol, 2),
                watertight=bool(bad == 0 and lv == 0 and le == 0),
                no_inverted_normals=bool(noncontig == 0 and vol > 0))


def min_thickness(ob, samples=900):
    """Measured minimum local wall thickness.

    From each sampled vertex, cast a ray along the INWARD normal and take the
    shortest hit on a genuinely OPPOSING surface. The opposing test matters: at a
    convex edge the ray grazes the adjacent face a few microns away, and a naive
    first-hit reading reports that as a near-zero wall. We therefore require the hit
    face to point back at the ray (dot(hit_normal, ray_dir) < -0.5, i.e. within 60
    degrees of head-on) and to be further than a small floor. Returns None when no
    opposing surface is found, which is what a thin sliver of a part legitimately
    gives.
    """
    me = ob.data
    try:
        tree = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    except Exception:
        return None
    n = len(me.vertices)
    if n == 0:
        return None
    step = max(1, n // samples)
    best = None
    eps = 2e-3
    for i in range(0, n, step):
        v = me.vertices[i]
        d = -v.normal
        if d.length < 0.5:
            continue
        d = d.normalized()
        origin = v.co + d * eps
        hit = tree.ray_cast(origin, d, 1e4)
        if hit[0] is None or hit[1] is None or hit[3] is None:
            continue
        if hit[1].dot(d) < 0.5:         # far wall is hit from inside: normal runs
            continue                    # ALONG the ray, not against it
        dist = hit[3] + eps
        if dist > 5e-3 and (best is None or dist < best):
            best = dist
    return round(best, 4) if best is not None else None


def cleanup(ob, dist=1e-5):
    """Remove the duplicate vertices and zero-area slivers a voxel remesh plus a
    boolean can leave behind. A handful of these show up as non-manifold edges in the
    exported file even when the in-session mesh looked fine."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    # NOTE: bmesh.ops.dissolve_degenerate is deliberately NOT used here. On a thin
    # plate it collapses geometry across the thickness and CREATES non-manifold
    # edges - it turned one carrier from 28 bad edges into 32. Removing duplicate
    # vertices and loose geometry is enough.
    bmesh.ops.triangulate(bm, faces=bm.faces)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


def export_stl(ob, path):
    cleanup(ob)
    fix_orientation(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    act(ob)
    bpy.ops.wm.stl_export(filepath=path, export_selected_objects=True,
                          global_scale=1.0, apply_modifiers=True)
    return os.path.getsize(path)


def bbox_world(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def import_glb(glb, scale):
    """Import the GLB scaled to kit millimetres. Objects that already existed in the
    scene are left alone, so this can be called again alongside work in progress."""
    pre = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    d = {}
    for ob in list(bpy.context.scene.objects):
        if ob in pre or ob.type != "MESH":
            continue
        d.setdefault(ob.name.split(".")[0], ob)
    for ob in d.values():
        world_scale(ob, scale)
        apply_transform(ob)
    # drop the import's empties and any duplicate meshes, but never pre-existing work
    delete_all_but(set(d.values()) | pre)
    return d


def planar_decimate(ob, degrees=3.0):
    """Collapse coplanar triangles. Voxel remesh leaves flat faces tessellated into
    thousands of needless triangles; this removes them without changing the shape."""
    m = ob.modifiers.new("dis", "DECIMATE")
    m.decimate_type = "DISSOLVE"
    m.angle_limit = math.radians(degrees)
    act(ob)
    bpy.ops.object.modifier_apply(modifier=m.name)
    # re-triangulate so the STL is valid
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    return ob


def ratio_decimate(ob, target_tris):
    bm = tri_bm(ob); n = len(bm.faces); bm.free()
    if n <= target_tris:
        return ob
    m = ob.modifiers.new("dec", "DECIMATE")
    m.ratio = float(target_tris) / n
    act(ob)
    bpy.ops.object.modifier_apply(modifier=m.name)
    return ob


def fix_orientation(ob):
    """A voxel remesh can come back inside-out. Flip if the signed volume is negative."""
    v, _ = volume_com(ob)
    if v < 0:
        act(ob)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.flip_normals()
        bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def monte_carlo_volume(ob, samples=400000, seed=11):
    """Volume by point-in-solid sampling (ray parity). Independent of face winding,
    so it catches a boolean that left a cavity inside out - which the surface
    integral and the edge-contiguity test both miss."""
    import random
    from mathutils.bvhtree import BVHTree
    lo, hi = bbox_world(ob)
    tree = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    w = (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
    rnd = random.Random(seed)
    up = Vector((0, 0, 1))
    hits = 0
    for _ in range(samples):
        p = Vector((lo.x + rnd.random() * w[0], lo.y + rnd.random() * w[1],
                    lo.z + rnd.random() * w[2]))
        n = 0
        o = p.copy()
        for _ in range(128):
            h = tree.ray_cast(o, up, 1e4)
            if h[0] is None:
                break
            n += 1
            o = h[0] + up * 1e-4
        if n % 2:
            hits += 1
    return w[0] * w[1] * w[2] * hits / float(samples)


def wall_stats(ob, want=6000):
    """Distribution of local wall thickness. The STRICT MINIMUM is not usable as a
    gate: on a voxel-remeshed surface a few rays hit a crease and report microns.
    Use p05, and only when there are enough valid samples to mean anything."""
    from mathutils.bvhtree import BVHTree
    me = ob.data
    try:
        tree = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    except Exception:
        return None
    n = len(me.vertices)
    if not n:
        return None
    step = max(1, n // want)
    eps = 2e-3
    ds = []
    for i in range(0, n, step):
        v = me.vertices[i]
        d = -v.normal
        if d.length < 0.5:
            continue
        d = d.normalized()
        h = tree.ray_cast(v.co + d * eps, d, 1e4)
        if h[0] is None or h[1] is None or h[3] is None:
            continue
        # the far wall is hit FROM INSIDE: its outward normal points ALONG the
        # inward ray, so the test is dot > +0.5. Requiring dot < -0.5 selects only
        # creases and near-tangent facets, i.e. exactly the noise.
        if h[1].dot(d) < 0.5:
            continue
        dist = h[3] + eps
        if dist > 5e-3:
            ds.append(dist)
    if not ds:
        return dict(samples=0)
    ds.sort()
    q = lambda p: ds[min(len(ds) - 1, int(p * len(ds)))]
    return dict(samples=len(ds), min=round(ds[0], 4), p05=round(q(0.05), 4),
                p25=round(q(0.25), 4), median=round(q(0.50), 4))
