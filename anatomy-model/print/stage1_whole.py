"""Stage 1: one watertight STL of the whole winged zebrafish at a stated print scale.

Run: blender.exe -b --python stage1_whole.py -- <glb> <manifest> <outdir> <target_SL_mm>
"""
import bpy, bmesh, json, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST, OUTDIR, TARGET_SL_MM = argv[0], argv[1], argv[2], float(argv[3])

man = json.load(open(MANIFEST, encoding="utf-8"))
objs_meta = {o["object"]: o for o in man["objects"]}
SL_UNITS = 0.82
SL_M = man["parameters"]["standard_length_m"]
MM_PER_UNIT = TARGET_SL_MM / SL_UNITS
LIFE_SCALE = TARGET_SL_MM / (SL_M * 1000.0)

MIN_WALL_MM = 1.0          # minimum printable wall at this scale
VOXEL_MM = 0.45            # remesh voxel -> guarantees watertight manifold

def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]

def strip_shapekeys(ob):
    if ob.data.shape_keys:
        ob.shape_key_clear()

def ensure_solid(ob, thickness_mm, mm_per_unit):
    """Solidify a zero-thickness shell. thickness given in print mm."""
    strip_shapekeys(ob)
    t_units = thickness_mm / mm_per_unit
    m = ob.modifiers.new("solid", "SOLIDIFY")
    m.thickness = t_units
    m.offset = 0.0
    m.use_even_offset = False
    m.nonmanifold_thickness_mode = "CONSTRAINTS"
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=m.name)

def is_shell(ob):
    """True if the mesh has boundary edges (open surface)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    open_edges = sum(1 for e in bm.edges if len(e.link_faces) < 2)
    bm.free()
    return open_edges > 0

def mesh_stats(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    nonman_e = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    nonman_v = 0
    for v in bm.verts:
        if not v.link_faces:
            nonman_v += 1
    tris = len(bm.faces)
    vol = bm.calc_volume(signed=True)
    bm.free()
    return dict(tris=tris, nonmanifold_edges=nonman_e, loose_verts=nonman_v,
                signed_volume=vol)

def recalc_outside(ob):
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

def main():
    wipe()
    meshes = import_glb(GLB)
    byname = {}
    for ob in meshes:
        base = ob.name.split(".")[0]
        byname.setdefault(base, ob)

    # Whole animal silhouette = the OUTER layer (skin, eyes, fin membranes)
    # plus the fin rays, which stick out past the membrane edge.
    want = [n for n, m in objs_meta.items() if m["layer"] == "outer"]
    want += [n for n, m in objs_meta.items()
             if m["layer"] == "skeleton" and ("fin_ray" in n or "fin_rays" in n)]

    used, deviations = [], []
    for n in want:
        ob = byname.get(n)
        if ob is None:
            continue
        strip_shapekeys(ob)
        if is_shell(ob):
            ensure_solid(ob, MIN_WALL_MM, MM_PER_UNIT)
            deviations.append(dict(object=n, change="solidified shell",
                                   amount_mm=MIN_WALL_MM))
        used.append(ob)

    # delete everything else
    bpy.ops.object.select_all(action="DESELECT")
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH" or ob not in used:
            ob.select_set(True)
    bpy.ops.object.delete()

    # join
    bpy.ops.object.select_all(action="DESELECT")
    for ob in used:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = used[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "whole_animal"

    # scale model units -> mm (blender unit = 1 mm for export convenience)
    body.scale = (MM_PER_UNIT,) * 3
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    pre = mesh_stats(body)

    # voxel remesh: unions the overlapping parts into one closed manifold solid
    bpy.context.view_layer.objects.active = body
    body.data.remesh_voxel_size = VOXEL_MM
    body.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()
    recalc_outside(body)
    post = mesh_stats(body)

    # decimate lightly to keep the file small without losing shape
    if post["tris"] > 400000:
        m = body.modifiers.new("dec", "DECIMATE")
        m.ratio = 400000.0 / post["tris"]
        bpy.ops.object.modifier_apply(modifier=m.name)
        post = mesh_stats(body)

    bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
    dims = body.dimensions

    os.makedirs(OUTDIR, exist_ok=True)
    fn = "00_whole-animal__SL%dmm__x%.2f-life.stl" % (int(TARGET_SL_MM), LIFE_SCALE)
    out = os.path.join(OUTDIR, fn)
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.ops.wm.stl_export(filepath=out, export_selected_objects=True,
                          global_scale=1.0, apply_modifiers=True)

    rec = dict(file=fn, path=out,
               target_SL_mm=TARGET_SL_MM, mm_per_model_unit=MM_PER_UNIT,
               life_scale_factor=LIFE_SCALE,
               real_standard_length_m=SL_M,
               real_standard_length_mm=SL_M * 1000.0,
               bbox_mm=[round(dims.x, 2), round(dims.y, 2), round(dims.z, 2)],
               min_wall_mm=MIN_WALL_MM, voxel_mm=VOXEL_MM,
               source_objects=sorted([o for o in want if o in byname]),
               pre_remesh=pre, post_remesh=post,
               deviations=deviations,
               bytes=os.path.getsize(out))
    print("STAGE1_JSON_BEGIN")
    print(json.dumps(rec, indent=1))
    print("STAGE1_JSON_END")

main()
