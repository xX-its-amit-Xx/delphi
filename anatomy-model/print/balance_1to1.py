"""Where is the pectoral planform's area centroid, and how does it sit against the
centre of mass? This is the difference between "needs ballast" and "do not guess".

blender.exe -b --python balance_1to1.py -- <glb> <manifest> <com_fraction_SL> <out.json>
"""
import bpy, bmesh, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector, Matrix
import kitlib as K

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST, COM_F, OUT = argv[0], argv[1], float(argv[2]), argv[3]
man = json.load(open(MANIFEST, encoding="utf-8"))
SL = man["parameters"]["standard_length_m"] * 1000.0
SCALE = SL / 0.82

K.wipe()
bpy.ops.import_scene.gltf(filepath=GLB)
byname = {}
for ob in bpy.context.scene.objects:
    if ob.type == "MESH":
        byname.setdefault(ob.name.split(".")[0], ob)
S = Matrix.Scale(SCALE, 4)

A = 0.0
Ax = 0.0
c2 = 0.0           # integral of chord^2 dy, for the mean aerodynamic chord
snout = None
strips = {}
for n in ("pectoral_fin_L", "pectoral_fin_R"):
    ob = byname[n]
    if ob.data.shape_keys:
        ob.shape_key_clear()
    M = S @ ob.matrix_world
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    for f in bm.faces:
        p, q, r = (M @ v.co for v in f.verts)
        a = abs((q - p).cross(r - p).z) / 2.0
        A += a
        Ax += a * (p.x + q.x + r.x) / 3.0
        # bin the triangle into spanwise strips to recover chord(y)
        yb = round(((p.y + q.y + r.y) / 3.0), 0)
        s = strips.setdefault(yb, [1e9, -1e9])
        for v in (p, q, r):
            s[0] = min(s[0], v.x); s[1] = max(s[1], v.x)
    bm.free()

# snout from the skin
sk = byname["skin_L"]
if sk.data.shape_keys:
    sk.shape_key_clear()
Ms = S @ sk.matrix_world
snout = max((Ms @ v.co).x for v in sk.data.vertices)

x_ac_centroid = Ax / A
# mean aerodynamic chord over the binned strips
num = sum((hi - lo) ** 2 for lo, hi in strips.values())
den = sum((hi - lo) for lo, hi in strips.values())
MAC = num / den if den else 0.0

cg_from_snout = COM_F * SL
# the quarter-chord of the area centroid is the usual first-order neutral point
np_from_snout = (snout - x_ac_centroid) - MAC * 0.25 + MAC * 0.5
# (area centroid sits at mid-chord of the MAC; the aerodynamic centre is a quarter
#  chord back from the leading edge, i.e. 0.25 MAC aft of the LE = 0.25 MAC forward
#  of mid-chord)
np_from_snout = (snout - x_ac_centroid) - 0.25 * MAC

static_margin = (np_from_snout - cg_from_snout) / MAC

out = dict(
    standard_length_mm=SL,
    snout_x_mm=round(snout, 3),
    pectoral_planform_area_mm2=round(A, 3),
    area_centroid_from_snout_mm=round(snout - x_ac_centroid, 3),
    area_centroid_as_fraction_of_SL=round((snout - x_ac_centroid) / SL, 4),
    mean_aerodynamic_chord_mm=round(MAC, 3),
    estimated_neutral_point_from_snout_mm=round(np_from_snout, 3),
    estimated_neutral_point_as_fraction_of_SL=round(np_from_snout / SL, 4),
    centre_of_mass_as_fraction_of_SL=COM_F,
    centre_of_mass_from_snout_mm=round(cg_from_snout, 3),
    static_margin_fraction_of_MAC=round(static_margin, 4),
    verdict=("CG is FORWARD of the estimated neutral point: statically stable in pitch "
             "by this first-order estimate, no nose ballast indicated"
             if static_margin > 0 else
             "CG is AFT of the estimated neutral point: statically UNSTABLE in pitch by "
             "this first-order estimate; nose ballast would be needed"),
    ballast_to_reach_10pc_margin=None,
    CAVEAT="This is a flat-plate, first-order estimate. The neutral point is taken as "
           "the quarter-chord of the pectoral planform's mean aerodynamic chord and "
           "ignores the body, the median fins, the caudal fin, downwash, and any "
           "sweep or dihedral. It is an order-of-magnitude check on whether the "
           "question 'does it need ballast' even arises. It is NOT a stability analysis "
           "and nothing here has been tested in a tunnel or in flight.")

if static_margin < 0.10:
    # mass to move the CG forward to a 10% margin, ballast placed 3 mm behind the snout
    tgt = np_from_snout - 0.10 * MAC
    bpos = 3.0
    if tgt > bpos:
        out["ballast_to_reach_10pc_margin"] = dict(
            target_cg_from_snout_mm=round(tgt, 3),
            ballast_position_mm_from_snout=bpos,
            ballast_fraction_of_shell_mass=round(
                (cg_from_snout - tgt) / (tgt - bpos), 4))

print("BAL1_JSON_BEGIN")
print(json.dumps(out, indent=1))
print("BAL1_JSON_END")
json.dump(out, open(OUT, "w"), indent=1)
