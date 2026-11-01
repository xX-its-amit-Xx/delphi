"""Stage 1b: physical metrics of the shipped whole-animal mesh + a one-piece glider variant.

blender.exe -b --python stage1_metrics_glider.py -- <glb> <manifest> <shipped_stl> <outdir> <SL_mm>
"""
import bpy, bmesh, json, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST, SHIPPED, OUTDIR, SL_MM = argv[0], argv[1], argv[2], argv[3], float(argv[4])

man = json.load(open(MANIFEST, encoding="utf-8"))
meta = {o["object"]: o for o in man["objects"]}
SL_UNITS = 0.82
SL_M = man["parameters"]["standard_length_m"]
MM_PER_UNIT = SL_MM / SL_UNITS
LIFE = SL_MM / (SL_M * 1000.0)

FIN_WALL_KIT = 1.0
FIN_WALL_GLIDER = 1.8
HOLLOW_WALL = 1.5
VOXEL = 0.45
DENS = {"photopolymer_resin_1.12": 1.12, "PLA_1.24": 1.24, "PETG_1.27": 1.27}


def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def tri_bm(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


def volume_and_com(ob):
    """Signed volume (mm^3) and centre of mass (mm) for a closed mesh, uniform density."""
    bm = tri_bm(ob)
    M = ob.matrix_world
    V = 0.0
    C = Vector((0.0, 0.0, 0.0))
    for f in bm.faces:
        a, b, c = (M @ v.co for v in f.verts)
        v6 = a.dot(b.cross(c))          # 6 * signed tet volume
        V += v6
        C += (a + b + c) * v6           # centroid (a+b+c+0)/4 ; fold /4 below
    bm.free()
    vol = V / 6.0
    com = (C / 4.0) / V if abs(V) > 1e-12 else Vector((0, 0, 0))
    return vol, com


def manifold_report(ob):
    bm = tri_bm(ob)
    nonman = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    loose_v = sum(1 for v in bm.verts if not v.link_faces)
    loose_e = sum(1 for e in bm.edges if not e.link_faces)
    tris = len(bm.faces)
    # inverted normals: for a closed mesh, every face normal must point away from
    # the interior -> total signed volume positive AND no face with flipped winding
    flipped = 0
    M = ob.matrix_world
    _, com = volume_and_com(ob)
    for f in bm.faces:
        n = (M.to_3x3() @ f.normal)
        cen = M @ f.calc_center_median()
        if n.dot(cen - com) < 0:
            flipped += 1
    bm.free()
    return dict(tris=tris, nonmanifold_edges=nonman, loose_verts=loose_v,
                loose_edges=loose_e, faces_pointing_inward=flipped)


def strip_sk(ob):
    if ob.data.shape_keys:
        ob.shape_key_clear()


def solidify(ob, mm):
    strip_sk(ob)
    m = ob.modifiers.new("s", "SOLIDIFY")
    m.thickness = mm / MM_PER_UNIT
    m.offset = 0.0
    m.nonmanifold_thickness_mode = "CONSTRAINTS"
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=m.name)


def has_boundary(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    n = sum(1 for e in bm.edges if len(e.link_faces) < 2)
    bm.free(); return n > 0


def recalc(ob):
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def remesh(ob, vox=VOXEL):
    bpy.context.view_layer.objects.active = ob
    ob.data.remesh_voxel_size = vox
    ob.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()


def import_glb():
    bpy.ops.import_scene.gltf(filepath=GLB)
    d = {}
    for ob in bpy.context.scene.objects:
        if ob.type == "MESH":
            d.setdefault(ob.name.split(".")[0], ob)
    return d


def planform_area_mm2(ob, axis=2):
    """Projected area of a single-layer sheet onto the plane normal to `axis`."""
    bm = tri_bm(ob)
    M = ob.matrix_world
    tot = 0.0
    for f in bm.faces:
        a, b, c = (M @ v.co for v in f.verts)
        n = (b - a).cross(c - a)
        tot += abs(n[axis]) / 2.0
    bm.free()
    return tot


def build_body(fin_wall, name):
    """Join outer layer + fin rays, scale to mm, voxel remesh -> closed solid."""
    byname = import_glb()
    want = [n for n, m in meta.items() if m["layer"] == "outer"]
    want += [n for n, m in meta.items()
             if m["layer"] == "skeleton" and ("fin_ray" in n or "fin_rays" in n)]
    used, dev = [], []
    for n in want:
        ob = byname.get(n)
        if not ob:
            continue
        strip_sk(ob)
        if has_boundary(ob):
            solidify(ob, fin_wall)
            dev.append(dict(object=n, change="solidified open shell", amount_mm=fin_wall))
        used.append(ob)
    bpy.ops.object.select_all(action="DESELECT")
    for ob in list(bpy.context.scene.objects):
        if ob.type != "MESH" or ob not in used:
            ob.select_set(True)
    bpy.ops.object.delete()
    bpy.ops.object.select_all(action="DESELECT")
    for ob in used:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = used[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = name
    body.scale = (MM_PER_UNIT,) * 3
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    remesh(body)
    recalc(body)
    return body, dev, sorted(n for n in want if n in byname)


out = {}

# ---------- A. metrics of the shipped solid ----------
wipe()
bpy.ops.wm.stl_import(filepath=SHIPPED)
shipped = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
vol, com = volume_and_com(shipped)
rep = manifold_report(shipped)
bb = [shipped.matrix_world @ Vector(c) for c in shipped.bound_box]
snout_x = max(v.x for v in bb)
tail_x = min(v.x for v in bb)
out["whole_animal_solid"] = dict(
    file=os.path.basename(SHIPPED),
    print_standard_length_mm=SL_MM,
    scale_factor_vs_life=round(LIFE, 4),
    real_standard_length_m=SL_M,
    bbox_mm=[round(shipped.dimensions.x, 2), round(shipped.dimensions.y, 2),
             round(shipped.dimensions.z, 2)],
    volume_mm3=round(vol, 1),
    volume_cm3=round(vol / 1000.0, 3),
    centre_of_mass_mm_blender_xyz=[round(com.x, 2), round(com.y, 2), round(com.z, 2)],
    snout_x_mm=round(snout_x, 2),
    com_from_snout_mm=round(snout_x - com.x, 2),
    com_from_snout_as_fraction_of_SL=round((snout_x - com.x) / SL_MM, 4),
    mass_g=dict((k, round(vol / 1000.0 * d, 2)) for k, d in DENS.items()),
    checks=rep)

# ---------- B. pectoral planform (lifting) area, single-layer membranes ----------
wipe()
byname = import_glb()
fin_areas = {}
tot = 0.0
for n in ("pectoral_fin_L", "pectoral_fin_R"):
    ob = byname[n]
    strip_sk(ob)
    ob.scale = (MM_PER_UNIT,) * 3
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    a = planform_area_mm2(ob, axis=2)        # project onto X-Y (span x chord) plane
    fin_areas[n] = round(a, 2)
    tot += a
span_mm = None
_bl = byname["pectoral_fin_L"]
_br = byname["pectoral_fin_R"]
ys = [(_bl.matrix_world @ Vector(c)).y for c in _bl.bound_box] + \
     [(_br.matrix_world @ Vector(c)).y for c in _br.bound_box]
span_mm = max(ys) - min(ys)
out["pectoral_lifting_area"] = dict(
    note="projected planform of the two pectoral fin MEMBRANES, single-layer source "
         "sheets (not the thickened print geometry), projected onto the horizontal "
         "span-chord plane.",
    per_fin_mm2=fin_areas,
    both_fins_mm2=round(tot, 2),
    both_fins_m2_at_print_scale=round(tot * 1e-6, 8),
    both_fins_m2_at_life_scale=round(tot * 1e-6 / (LIFE ** 2), 10),
    tip_to_tip_span_mm_at_print_scale=round(span_mm, 2),
    aspect_ratio_span2_over_area=round(span_mm ** 2 / tot, 3))

# ---------- C. one-piece glider variant ----------
wipe()
body, dev, srcs = build_body(FIN_WALL_GLIDER, "glider")
ov, ocom = volume_and_com(body)

# inner cavity: shrink a skin-only solid inward by HOLLOW_WALL and flip it
byname2 = import_glb()
inner_src = []
for n in ("skin_L", "skin_R"):
    ob = byname2[n]
    strip_sk(ob)
    solidify(ob, FIN_WALL_GLIDER)
    inner_src.append(ob)
bpy.ops.object.select_all(action="DESELECT")
for ob in list(bpy.context.scene.objects):
    if ob.type == "MESH" and ob not in inner_src and ob.name != "glider":
        ob.select_set(True)
bpy.ops.object.delete()
bpy.ops.object.select_all(action="DESELECT")
for ob in inner_src:
    ob.select_set(True)
bpy.context.view_layer.objects.active = inner_src[0]
bpy.ops.object.join()
inner = bpy.context.view_layer.objects.active
inner.name = "cavity"
inner.scale = (MM_PER_UNIT,) * 3
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
remesh(inner)
recalc(inner)
# shrink inward
m = inner.modifiers.new("d", "DISPLACE")
m.direction = "NORMAL"
m.mid_level = 0.0
m.strength = -HOLLOW_WALL
bpy.context.view_layer.objects.active = inner
bpy.ops.object.modifier_apply(modifier=m.name)
remesh(inner)
recalc(inner)
iv, icom = volume_and_com(inner)

hollow_ok = iv > 0 and iv < ov
if hollow_ok:
    # flip the cavity and join -> hollow solid (outer shell + inverted inner shell)
    bpy.context.view_layer.objects.active = inner
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.flip_normals()
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    inner.select_set(True); body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    g = bpy.context.view_layer.objects.active
    mat_vol = ov - iv
    # COM of the shell = (ov*ocom - iv*icom) / (ov - iv)
    gcom = (ocom * ov - icom * iv) / mat_vol
else:
    g = body
    mat_vol = ov
    gcom = ocom

grep = manifold_report(g) if not hollow_ok else None
bm = tri_bm(g)
gtris = len(bm.faces)
nonman = sum(1 for e in bm.edges if len(e.link_faces) != 2)
bm.free()

bbg = [g.matrix_world @ Vector(c) for c in g.bound_box]
gsnout = max(v.x for v in bbg)

os.makedirs(OUTDIR, exist_ok=True)
gfn = "winged-zebrafish-glider-120mm.stl"
gpath = os.path.join(OUTDIR, gfn)
bpy.ops.object.select_all(action="DESELECT")
g.select_set(True)
bpy.ops.wm.stl_export(filepath=gpath, export_selected_objects=True)

out["glider_one_piece"] = dict(
    file=gfn, path=gpath,
    print_standard_length_mm=SL_MM, scale_factor_vs_life=round(LIFE, 4),
    hollowed=hollow_ok, hollow_wall_mm=HOLLOW_WALL if hollow_ok else None,
    hollow_region="body only; fins and fin rays printed solid",
    fin_wall_mm=FIN_WALL_GLIDER,
    outer_envelope_volume_cm3=round(ov / 1000.0, 3),
    cavity_volume_cm3=round(iv / 1000.0, 3) if hollow_ok else 0.0,
    material_volume_cm3=round(mat_vol / 1000.0, 3),
    mass_g=dict((k, round(mat_vol / 1000.0 * d, 2)) for k, d in DENS.items()),
    centre_of_mass_mm_blender_xyz=[round(gcom.x, 2), round(gcom.y, 2), round(gcom.z, 2)],
    com_from_snout_mm=round(gsnout - gcom.x, 2),
    com_from_snout_as_fraction_of_SL=round((gsnout - gcom.x) / SL_MM, 4),
    triangles=gtris, nonmanifold_edges=nonman,
    bytes=os.path.getsize(gpath),
    deviations=dev, source_objects=srcs,
    sealed_cavity_warning=("the cavity is sealed; for resin printing add a drain hole. "
                           "For FDM slice with 0 infill and this wall.") if hollow_ok else None)

print("METRICS_JSON_BEGIN")
print(json.dumps(out, indent=1))
print("METRICS_JSON_END")
json.dump(out, open(os.path.join(OUTDIR, "stage1-metrics.json"), "w"), indent=1)
