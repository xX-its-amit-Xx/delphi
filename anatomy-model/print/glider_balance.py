"""Does leaving the nose solid pull the glider's centre of mass forward?

Builds the glider three ways and measures each, then works out the nose ballast the
chosen one would still need.

blender.exe -b --python glider_balance.py -- <glb> <manifest> <outdir> <SL_mm>
"""
import bpy, bmesh, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import kitlib as K

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST, OUTDIR, SL = argv[0], argv[1], argv[2], float(argv[3])
man = json.load(open(MANIFEST, encoding="utf-8"))
SCALE = SL / 0.82
FIN = 1.8
WALL = 1.5
VOX = 0.45
DENS_PLA = 1.24
META = {o["object"]: o for o in man["objects"]}


def build_outer():
    byname = K.import_glb(GLB, SCALE)
    want = [n for n, m in META.items() if m["layer"] == "outer"]
    want += [n for n, m in META.items()
             if m["layer"] == "skeleton" and ("fin_ray" in n or "fin_rays" in n)]
    used = []
    for n in want:
        ob = byname.get(n)
        if not ob:
            continue
        if K.has_boundary(ob):
            K.solidify(ob, FIN)
        used.append(ob)
    K.delete_all_but(set(used))
    body = K.join(used, "outer")
    K.remesh(body, VOX)
    K.recalc(body)
    return body


def build_cavity(nose_cut_x=None, protect=()):
    """Shrunk skin shell = the cavity. nose_cut_x: discard cavity forward of this x."""
    byname = K.import_glb(GLB, SCALE)
    srcs = []
    for n in ("skin_L", "skin_R"):
        ob = byname[n]
        K.solidify(ob, FIN)
        srcs.append(ob)
    K.delete_all_but(set(srcs) | set(protect))
    cav = K.join(srcs, "cavity")
    K.remesh(cav, VOX)
    K.recalc(cav)
    m = cav.modifiers.new("d", "DISPLACE")
    m.direction = "NORMAL"; m.mid_level = 0.0; m.strength = -WALL
    K.act(cav)
    bpy.ops.object.modifier_apply(modifier=m.name)
    K.remesh(cav, VOX)
    K.recalc(cav)
    if nose_cut_x is not None:
        bm = bmesh.new(); bm.from_mesh(cav.data)
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                               plane_co=(nose_cut_x, 0, 0), plane_no=(1, 0, 0),
                               clear_outer=True, clear_inner=False)
        bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if len(e.link_faces) == 1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(cav.data); bm.free()
        K.recalc(cav)
    return cav


res = {}
SNOUT = None

# ---- variant 1: solid ----
K.wipe()
body = build_outer()
v, c = K.volume_com(body)
lo, hi = K.bbox_world(body)
SNOUT = hi.x
res["solid"] = dict(material_cm3=round(v / 1000, 3),
                    mass_g_PLA=round(v / 1000 * DENS_PLA, 2),
                    com_from_snout_mm=round(SNOUT - c.x, 2),
                    com_fraction_SL=round((SNOUT - c.x) / SL, 4))

# ---- variants 2 and 3: hollow, cavity full vs nose left solid ----
HEAD = man["parameters"]["head_fraction_SL"]
nose_cut = SNOUT - HEAD * SL          # keep the whole head solid
res["head_fraction_SL"] = HEAD
res["nose_cut_x_mm"] = round(nose_cut, 2)

for tag, cut in (("hollow_full_cavity", None), ("hollow_nose_solid", nose_cut)):
    K.wipe()
    body = build_outer()
    ov, ocom = K.volume_com(body)
    cav = build_cavity(cut, protect=[body])
    iv, icom = K.volume_com(cav)
    mat = ov - iv
    com = (ocom * ov - icom * iv) / mat
    lo, hi = K.bbox_world(body)
    sn = hi.x
    # fuse for export/check
    K.act(cav)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.flip_normals()
    bpy.ops.object.mode_set(mode="OBJECT")
    g = K.join([body, cav], "glider_" + tag)
    chk = K.check(g)
    path = os.path.join(OUTDIR, "glider_%s.stl" % tag)
    nb = K.export_stl(g, path)
    res[tag] = dict(cavity_cm3=round(iv / 1000, 3),
                    outer_cm3=round(ov / 1000, 3),
                    material_cm3=round(mat / 1000, 3),
                    mass_g_PLA=round(mat / 1000 * DENS_PLA, 2),
                    com_from_snout_mm=round(sn - com.x, 2),
                    com_fraction_SL=round((sn - com.x) / SL, 4),
                    checks=chk, bytes=nb, path=path)

# ---- nose ballast arithmetic for whichever hollow variant wins ----
best = min(("hollow_full_cavity", "hollow_nose_solid"),
           key=lambda t: res[t]["com_fraction_SL"])
m_s = res[best]["mass_g_PLA"]
x_s = res[best]["com_from_snout_mm"]
ballast_at = 8.0                       # a weight pressed into the nose, 8 mm aft of the tip
bal = {}
for tgt in (0.40, 0.42, 0.45):
    x_t = tgt * SL
    if x_t <= ballast_at:
        continue
    m_b = m_s * (x_s - x_t) / (x_t - ballast_at)
    bal["target_com_%.2f_SL" % tgt] = dict(
        target_com_from_snout_mm=round(x_t, 2),
        ballast_g=round(m_b, 2),
        ballast_fraction_of_shell_mass=round(m_b / m_s, 3),
        total_mass_g=round(m_s + m_b, 2))
res["nose_ballast"] = dict(best_variant=best, ballast_position_mm_from_snout=ballast_at,
                           shell_mass_g_PLA=m_s, shell_com_from_snout_mm=x_s,
                           options=bal)

print("BAL_JSON_BEGIN")
print(json.dumps(res, indent=1))
print("BAL_JSON_END")
json.dump(res, open(os.path.join(OUTDIR, "glider-balance.json"), "w"), indent=1)
