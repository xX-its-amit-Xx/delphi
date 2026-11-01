"""The ff-fins one-piece 1:1 SOLID glider, with a blind nose bore for optional ballast.

The bore is EMPTY as printed: the fish flies as-is, and dropping a steel rod in moves
the centre of mass forward to the computed margin. One print, both states.

blender.exe -b --python ff_solid_ballast.py -- <glb> <manifest> <outdir>
"""
import bpy, bmesh, json, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import kitlib as K

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST, OUTDIR = argv[0], argv[1], argv[2]
os.makedirs(OUTDIR, exist_ok=True)
man = json.load(open(MANIFEST, encoding="utf-8"))
META = {o["object"]: o for o in man["objects"]}
SL = man["parameters"]["standard_length_m"] * 1000.0
SCALE = SL / 0.82
MINWALL = 0.5
RHO_STEEL = 7.85e-3      # g/mm^3
RHO_RESIN = 1.12e-3      # Tough 2000, g/mm^3
RHO_AIR, G, CLMAX = 1.225, 9.80665, 0.78

BORE_D = 2.6             # 0.1 mm clearance on a 2.5 mm steel rod
BORE_START = 1.5         # leave a solid nose tip
BORE_L = 9.0

# the stability numbers this bore is sized against (measured earlier, same mesh)
NP_FROM_SNOUT = 16.724
MAC = 12.444

K.wipe()
SRC = K.import_glb(GLB, SCALE)
want = [n for n, m in META.items() if m["layer"] == "outer"]
want += [n for n, m in META.items()
         if m["layer"] == "skeleton" and ("fin_ray" in n or "fin_rays" in n)]
used = []
for nm in want:
    ob = SRC.get(nm)
    if not ob:
        continue
    if K.has_boundary(ob):
        K.solidify(ob, MINWALL)
    used.append(ob)
K.delete_all_but(set(used))
body = K.join(used, "ff_solid")
K.remesh(body, 0.12)
K.recalc(body)
K.fix_orientation(body)
K.ratio_decimate(body, 90000)
K.recalc(body)
K.fix_orientation(body)

v0, com0 = K.volume_com(body)
lo, hi = K.bbox_world(body)
snout = hi.x
# the bore runs aft along the body axis from just behind the snout tip
cz = com0.z
# The cutter must START OUTSIDE the body, or the result is a SEALED INTERNAL CAVITY
# rather than a bore: nothing can be inserted and an SLA print traps resin in it.
OVER = 3.0                      # how far the cutter pokes out past the snout
cut_len = OVER + BORE_L
cut = K.d_cylinder("bore", BORE_D / 2.0, cut_len, (0, 0, 0), segments=24,
                   flat_at=BORE_D)          # flat_at > r -> a plain round bore
cut.rotation_euler = (0, math.radians(90), 0)
K.apply_transform(cut)
cut.location = (snout + OVER - cut_len / 2.0, 0, cz)
K.apply_transform(cut)
bore_centroid_x_from_snout = BORE_L / 2.0
ok = K.boolean(body, cut, "DIFFERENCE")
# NEVER recalculate normals "outside" after a boolean: Blender orients each
# disconnected shell outward on its own, which turns a cavity inside out. Only
# correct a globally inverted result.
K.fix_orientation(body)
chk = K.check(body)

v1, com1 = K.volume_com(body)
v_mc = K.monte_carlo_volume(body, 400000)
vol_agrees = abs(v_mc - v1) / max(v1, 1e-9) < 0.02
lo, hi = K.bbox_world(body)
snout = hi.x
mw = K.min_thickness(body)
path = os.path.join(OUTDIR, "winged-zebrafish-ff-fins-solid-1to1-38.8mm.stl")
nb = K.export_stl(body, path)

# planform, for the glide numbers on THIS part
K.wipe()
import mathutils
bpy.ops.import_scene.gltf(filepath=GLB)
byn = {}
for ob in bpy.context.scene.objects:
    if ob.type == "MESH":
        byn.setdefault(ob.name.split(".")[0], ob)
S = mathutils.Matrix.Scale(SCALE, 4)
A = 0.0
for n in ("pectoral_fin_L", "pectoral_fin_R"):
    ob = byn[n]
    if ob.data.shape_keys:
        ob.shape_key_clear()
    M = S @ ob.matrix_world
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    for f in bm.faces:
        p, q, r = (M @ v.co for v in f.verts)
        A += abs((q - p).cross(r - p).z) / 2.0
    bm.free()
S_m2 = A * 1e-6


def glide(mass_g):
    W = mass_g / 1000.0 * G
    return dict(mass_g=round(mass_g, 4),
                wing_loading_N_m2=round(W / S_m2, 2),
                v_min_m_s=round(math.sqrt(2 * W / (RHO_AIR * S_m2 * CLMAX)), 2))


m_shell = (v1 if vol_agrees else v_mc) * RHO_RESIN
cg_shell = snout - com1.x
FILLS = {
    "empty (as printed)": 0.0,
    "2.5 mm steel rod x 9 mm": RHO_STEEL * math.pi * 1.25 ** 2 * 9.0,
    "M2.5 x 8 mm steel grub screw (approx)": RHO_STEEL * math.pi * 1.25 ** 2 * 8.0 * 0.85,
}
states = {}
for name, mb in FILLS.items():
    if mb <= 0:
        cg = cg_shell
        tot = m_shell
    else:
        tot = m_shell + mb
        cg = (m_shell * cg_shell + mb * bore_centroid_x_from_snout) / tot
    sm = (NP_FROM_SNOUT - cg) / MAC
    st = glide(tot)
    st.update(ballast_g=round(mb, 4),
              cg_from_snout_mm=round(cg, 3),
              cg_as_fraction_of_SL=round(cg / SL, 4),
              static_margin_fraction_of_MAC=round(sm, 4),
              stable=bool(sm > 0))
    states[name] = st

out = dict(
    file=os.path.basename(path), bytes=nb,
    design="winged-zebrafish-ff-fins (pectoral_len_over_SL = 0.687, MEASURED median, "
           "Daane 2021 Data S1A, n=49)",
    design_file="anatomy-model/print/design-winged-zebrafish-ff-fins.json",
    scale="1:1 life size", print_standard_length_mm=round(SL, 2),
    SOLID=True, hollow=False, min_wall_mm=MINWALL,
    bbox_mm=[round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z - lo.z, 2)],
    solid_volume_cm3=round(v1 / 1000.0, 4),
    volume_cross_check=dict(
        surface_integral_mm3=round(v1, 2),
        monte_carlo_mm3=round(v_mc, 2),
        agree_within_2pc=vol_agrees,
        why="the surface integral is only valid if every shell is wound correctly; an "
            "independent point-in-solid Monte Carlo catches a boolean that inverted a "
            "cavity, which the edge-contiguity test cannot see"),
    volume_before_bore_cm3=round(v0 / 1000.0, 4),
    bore_removed_mm3=round(v0 - v1, 2),
    measured_min_wall_mm=mw,
    ballast_bore=dict(
        diameter_mm=BORE_D, depth_mm=BORE_L, starts_mm_behind_snout_tip=BORE_START,
        axis="along the body axis, on the midline, at the height of the centre of mass",
        open_at="the snout, so it is NOT a sealed cavity and needs no drain hole",
        clearance_note="2.6 mm bore for a 2.5 mm steel part: 0.1 mm diametral slip fit",
        sized_for="a 2.5 mm steel rod 9 mm long, about 0.35 g, which is what the "
                  "first-order stability estimate says is needed for a +10% margin",
        boolean_succeeded=ok),
    pectoral_planform_m2=S_m2,
    states=states,
    stability_basis=dict(neutral_point_from_snout_mm=NP_FROM_SNOUT,
                         mean_aerodynamic_chord_mm=MAC,
                         METHOD="FIRST-ORDER, FLAT-PLATE, PECTORAL FINS ONLY: the "
                                "neutral point is the quarter-chord of the pectoral "
                                "planform's mean aerodynamic chord, ignoring the body, "
                                "the median fins, the caudal fin, downwash, sweep and "
                                "dihedral. It says the question is live; it does not "
                                "say what the answer is."),
    UNVERIFIED="C_Lmax 0.78 is Park & Choi's measurement on a ~20 cm STUFFED REAL "
               "flying fish. At 4 cm the Reynolds number is roughly 5x lower and the "
               "flow regime differs, so the coefficient does not transfer. No tunnel "
               "test, no flight test, no stability analysis beyond the first-order "
               "estimate above.",
    checks=chk, triangles=chk["triangles"],
    HYPOTHETICAL=True, hypothetical_note=man["objects"][0]["hypothetical_note"])

print("FFSOLID_JSON_BEGIN")
print(json.dumps(out, indent=1))
print("FFSOLID_JSON_END")
json.dump(out, open(os.path.join(OUTDIR, "_ff-solid.json"), "w"), indent=1)
