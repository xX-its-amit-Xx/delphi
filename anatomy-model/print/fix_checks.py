"""Correct manifold/orientation check + correct pectoral planform (world-space scale).

blender.exe -b --python fix_checks.py -- <glb> <manifest> <stl_a> <stl_b> <out.json> <SL_mm>
"""
import bpy, bmesh, json, sys, os
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST = argv[0], argv[1]
STLS = [argv[2], argv[3]]
OUT, SL_MM = argv[4], float(argv[5])
man = json.load(open(MANIFEST, encoding="utf-8"))
SL_M = man["parameters"]["standard_length_m"]
MM_PER_UNIT = SL_MM / 0.82
LIFE = SL_MM / (SL_M * 1000.0)


def check(ob):
    """Proper watertight + orientation test.

    manifold      : every edge has exactly 2 faces, no loose geometry
    consistent    : every edge is contiguous (its two faces wind oppositely)
                    -> no inverted normals ANYWHERE, concavity-proof
    outward       : signed volume > 0 -> the consistent orientation points out
    """
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bad_edge = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    noncontig = sum(1 for e in bm.edges if len(e.link_faces) == 2 and not e.is_contiguous)
    loose_v = sum(1 for v in bm.verts if not v.link_faces)
    loose_e = sum(1 for e in bm.edges if not e.link_faces)
    tris = len(bm.faces)
    M = ob.matrix_world
    V = 0.0
    C = Vector((0, 0, 0))
    for f in bm.faces:
        a, b, c = (M @ v.co for v in f.verts)
        v6 = a.dot(b.cross(c))
        V += v6
        C += (a + b + c) * v6
    bm.free()
    vol = V / 6.0
    com = (C / 4.0) / V if abs(V) > 1e-12 else Vector((0, 0, 0))
    return dict(triangles=tris, nonmanifold_edges=bad_edge,
                inconsistently_wound_edges=noncontig,
                loose_verts=loose_v, loose_edges=loose_e,
                signed_volume_mm3=round(vol, 1),
                watertight=bool(bad_edge == 0 and loose_v == 0 and loose_e == 0),
                no_inverted_normals=bool(noncontig == 0 and vol > 0)), vol, com


res = {"checks": {}}
for p in STLS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.stl_import(filepath=p)
    ob = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
    c, vol, com = check(ob)
    bb = [ob.matrix_world @ Vector(v) for v in ob.bound_box]
    snout = max(v.x for v in bb)
    c["volume_cm3"] = round(vol / 1000.0, 3)
    c["com_from_snout_as_fraction_of_SL"] = round((snout - com.x) / SL_MM, 4)
    c["bbox_mm"] = [round(ob.dimensions.x, 2), round(ob.dimensions.y, 2),
                    round(ob.dimensions.z, 2)]
    res["checks"][os.path.basename(p)] = c

# ---- pectoral planform, preserving each object's own world transform ----
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
byname = {}
for ob in bpy.context.scene.objects:
    if ob.type == "MESH":
        byname.setdefault(ob.name.split(".")[0], ob)

S = Matrix.Scale(MM_PER_UNIT, 4)
areas = {}
ys = []
tot = 0.0
for n in ("pectoral_fin_L", "pectoral_fin_R"):
    ob = byname[n]
    if ob.data.shape_keys:
        ob.shape_key_clear()
    M = S @ ob.matrix_world            # scale in WORLD space, keep mirror/rotation
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    a = 0.0
    for f in bm.faces:
        p, q, r = (M @ v.co for v in f.verts)
        nz = (q - p).cross(r - p)
        a += abs(nz.z) / 2.0           # project onto the span-chord (horizontal) plane
    bm.free()
    areas[n] = round(a, 2)
    tot += a
    ys += [(M @ Vector(c)).y for c in ob.bound_box]

span = max(ys) - min(ys)
res["pectoral_lifting_area"] = dict(
    note="projected planform of the two pectoral fin membranes (single-layer source "
         "sheets, not the thickened print geometry), projected onto the horizontal "
         "span-chord plane; each object's own world transform preserved.",
    per_fin_mm2=areas, both_fins_mm2=round(tot, 2),
    both_fins_m2_at_print_scale=round(tot * 1e-6, 8),
    both_fins_m2_at_life_scale=round(tot * 1e-6 / (LIFE ** 2), 10),
    tip_to_tip_span_mm_at_print_scale=round(span, 2),
    tip_to_tip_span_mm_at_life_scale=round(span / LIFE, 3),
    aspect_ratio_span2_over_area=round(span ** 2 / tot, 3))

print("FIX_JSON_BEGIN")
print(json.dumps(res, indent=1))
print("FIX_JSON_END")
json.dump(res, open(OUT, "w"), indent=1)
