"""Life-size (1:1) solid build + the numbers a glide estimate needs, for any design GLB.

blender.exe -b --python measure_1to1.py -- <glb> <manifest> <outdir> <tag>
"""
import bpy, bmesh, json, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector, Matrix
import kitlib as K

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST, OUTDIR, TAG = argv[0], argv[1], argv[2], argv[3]
os.makedirs(OUTDIR, exist_ok=True)
man = json.load(open(MANIFEST, encoding="utf-8"))
META = {o["object"]: o for o in man["objects"]}
SL_M = man["parameters"]["standard_length_m"]
SL_MM = SL_M * 1000.0
SCALE = SL_MM / 0.82
MINWALL = 0.5          # Formlabs SLA, supported wall
RHO_AIR = 1.225
G = 9.80665
CLMAX = 0.78           # Park & Choi, measured on a ~20 cm STUFFED flying fish
RESINS = {"Tough_2000_1.12": 1.12, "Durable_1.10": 1.10, "Clear_V4_1.17": 1.17}

# ---------------- planform (lifting) area of the pectoral membranes ----------
K.wipe()
bpy.ops.import_scene.gltf(filepath=GLB)
byname = {}
for ob in bpy.context.scene.objects:
    if ob.type == "MESH":
        byname.setdefault(ob.name.split(".")[0], ob)
S = Matrix.Scale(SCALE, 4)
areas, ys = {}, []
tot = 0.0
for n in ("pectoral_fin_L", "pectoral_fin_R"):
    ob = byname[n]
    if ob.data.shape_keys:
        ob.shape_key_clear()
    M = S @ ob.matrix_world
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    a = 0.0
    for f in bm.faces:
        p, q, r = (M @ v.co for v in f.verts)
        a += abs((q - p).cross(r - p).z) / 2.0
    bm.free()
    areas[n] = round(a, 3)
    tot += a
    ys += [(M @ Vector(c)).y for c in ob.bound_box]
span_mm = max(ys) - min(ys)
S_m2 = tot * 1e-6

# ---------------- the 1:1 SOLID body ----------------
K.wipe()
SRC = K.import_glb(GLB, SCALE)
want = [n for n, m in META.items() if m["layer"] == "outer"]
want += [n for n, m in META.items()
         if m["layer"] == "skeleton" and ("fin_ray" in n or "fin_rays" in n)]
used, dev = [], []
for nm in want:
    ob = SRC.get(nm)
    if not ob:
        continue
    if K.has_boundary(ob):
        K.solidify(ob, MINWALL)
        dev.append(nm)
    used.append(ob)
K.delete_all_but(set(used))
body = K.join(used, "life_" + TAG)
K.remesh(body, 0.12)
K.recalc(body)
K.fix_orientation(body)
K.ratio_decimate(body, 90000)
K.recalc(body)
K.fix_orientation(body)
v_mm3, com = K.volume_com(body)
lo, hi = K.bbox_world(body)
chk = K.check(body)
path = os.path.join(OUTDIR, "%s-whole-1to1-%.1fmm.stl" % (TAG, SL_MM))
nb = K.export_stl(body, path)

out = dict(tag=TAG, design_glb=os.path.basename(GLB),
           print_standard_length_mm=round(SL_MM, 2), scale="1:1 life size",
           mm_per_model_unit=round(SCALE, 4),
           bbox_mm=[round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z - lo.z, 2)],
           solid_volume_cm3=round(v_mm3 / 1000.0, 4),
           min_wall_mm=MINWALL, solidified_objects=dev,
           com_from_snout_mm=round(hi.x - com.x, 3),
           com_from_snout_as_fraction_of_SL=round((hi.x - com.x) / SL_MM, 4),
           pectoral_planform=dict(per_fin_mm2=areas, both_fins_mm2=round(tot, 3),
                                  both_fins_m2=S_m2,
                                  tip_to_tip_span_mm=round(span_mm, 3),
                                  aspect_ratio_span2_over_area=round(span_mm ** 2 / tot, 3)),
           file=os.path.basename(path), bytes=nb, triangles=chk["triangles"], checks=chk)

glide = {}
for rk, rho in RESINS.items():
    m_kg = v_mm3 / 1000.0 * rho / 1000.0
    W = m_kg * G
    WS = W / S_m2
    vmin = math.sqrt(2 * W / (RHO_AIR * S_m2 * CLMAX))
    glide[rk] = dict(mass_g=round(m_kg * 1000.0, 4),
                     weight_N=round(W, 6),
                     wing_loading_N_m2=round(WS, 2),
                     v_min_m_s=round(vmin, 2))
out["glide_if_thrown"] = dict(
    assumptions=dict(C_Lmax=CLMAX, air_density_kg_m3=RHO_AIR, g=G,
                     lifting_area_used="pectoral planform only, both fins",
                     formula="v_min = sqrt( 2 W / (rho * S * C_Lmax) )"),
    UNVERIFIED="C_Lmax 0.78 is Park & Choi's measurement on a ~20 cm STUFFED REAL flying "
               "fish. At 4 cm the Reynolds number is roughly 5x lower and the flow regime "
               "is different, so this coefficient does not transfer. Nothing here has been "
               "wind-tunnel tested, no stability analysis has been done, and the real "
               "performance is unknown until somebody throws it.",
    per_resin=glide)

print("M1TO1_JSON_BEGIN")
print(json.dumps(out, indent=1))
print("M1TO1_JSON_END")
json.dump(out, open(os.path.join(OUTDIR, "_1to1-%s.json" % TAG), "w"), indent=1)
