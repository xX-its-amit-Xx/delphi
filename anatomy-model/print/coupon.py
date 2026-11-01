"""Fit-test coupon for Formlabs SLA, plus the life-size (1:1) solid volume and mass.

One STL: a socket bar with five sockets at five different radial clearances, each
labelled, and six identical pegs. Print it, try each peg in each socket, and the
tightest one that seats without forcing is the clearance the whole kit should use.

blender.exe -b --python coupon.py -- <glb> <manifest> <outdir>
"""
import bpy, bmesh, json, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import kitlib as K

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST, OUTDIR = argv[0], argv[1], argv[2]
os.makedirs(OUTDIR, exist_ok=True)
man = json.load(open(MANIFEST, encoding="utf-8"))
SL_M = man["parameters"]["standard_length_m"]
SCALE_1TO1 = (SL_M * 1000.0) / 0.82          # mm per model unit at life size

# ---- the values this kit is built on, for Formlabs SLA at 1:1 ----
PEG_D      = 1.40      # peg diameter
PEG_L      = 1.50      # peg length (blind)
SOCK_DEPTH = 1.80
CLEARANCES = [0.05, 0.08, 0.10, 0.12, 0.16]   # radial, mm
BAR = (48.0, 12.0, 2.6)
TEXT_H = 2.4
TEXT_D = 0.45


def text_solid(s, loc, height=TEXT_H, extrude=TEXT_D):
    cur = bpy.data.curves.new("t", "FONT")
    cur.body = s
    cur.size = height
    cur.extrude = extrude / 2.0
    cur.align_x = "CENTER"
    cur.align_y = "CENTER"
    ob = bpy.data.objects.new("txt_" + s, cur)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    K.act(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.view_layer.objects.active
    return ob


def fix_orientation(ob):
    v, _ = K.volume_com(ob)
    if v < 0:
        K.act(ob)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.flip_normals()
        bpy.ops.object.mode_set(mode="OBJECT")
    return ob


K.wipe()
pieces = []

# -------- the socket bar --------
bar = K.box("coupon_bar", BAR, (0, 0, BAR[2] / 2.0))
adds, cuts = [], []
n = len(CLEARANCES)
step = BAR[0] / (n + 0.6)
for i, c in enumerate(CLEARANCES):
    x = -BAR[0] / 2.0 + step * (i + 0.8)
    r = PEG_D / 2.0 + c
    # blind socket, open at the top
    # blind socket: cut from the top face down SOCK_DEPTH, leaving a floor
    cut_h = SOCK_DEPTH + 2.0
    cuts.append(K.d_cylinder("sk%d" % i, r, cut_h,
                             (x, 2.6, BAR[2] - SOCK_DEPTH + cut_h / 2.0),
                             flat_at=PEG_D / 2.0 * K.KEY_FLAT + c))
    # index mark showing which way the D-flat faces
    adds.append(K.index_triangle("mk%d" % i, (x + r + 1.3, 2.6, BAR[2] + 0.10),
                                 size=1.6, height=0.6))
    adds.append(text_solid("%02d" % int(round(c * 100)),
                           (x, -2.2, BAR[2] + TEXT_D / 2.0 - 0.15)))
adds.append(text_solid("CLEARANCE x100 mm", (0, -5.2, BAR[2] + 0.35 / 2.0 - 0.12),
                       height=1.5, extrude=0.35))
bar = K.join([bar] + adds, "coupon_bar")
K.remesh(bar, 0.12)
K.recalc(bar)
K.planar_decimate(bar, 3.0)
K.recalc(bar)
K.fix_orientation(bar)
for c in cuts:
    K.boolean(bar, c, "DIFFERENCE")
K.recalc(bar)
K.fix_orientation(bar)
if not K.check(bar)["watertight"]:
    K.remesh(bar, 0.09)
    K.recalc(bar)
    K.fix_orientation(bar)
pieces.append(bar)

# -------- six identical pegs on handles --------
for i in range(6):
    x = -BAR[0] / 2.0 + 4.5 + i * 8.0
    y = -12.0
    handle = K.d_cylinder("h%d" % i, 2.6, 1.3, (x, y, 0.65), segments=24)
    peg = K.d_cylinder("p%d" % i, PEG_D / 2.0, PEG_L + 0.6, (x, y, 1.3 + (PEG_L - 0.6) / 2.0))
    ob = K.join([handle, peg], "coupon_peg_%d" % i)
    K.remesh(ob, 0.07)
    K.recalc(ob)
    K.planar_decimate(ob, 3.0)
    K.recalc(ob)
    K.fix_orientation(ob)
    pieces.append(ob)

coupon = K.join(pieces, "coupon")
K.fix_orientation(coupon)
chk = K.check(coupon)
lo, hi = K.bbox_world(coupon)
path = os.path.join(OUTDIR, "FIT-TEST-COUPON__peg1.4mm__clearance-0.05-to-0.16.stl")
nb = K.export_stl(coupon, path)

out = dict(coupon=dict(
    file=os.path.basename(path), bytes=nb,
    peg_diameter_mm=PEG_D, peg_length_mm=PEG_L, socket_depth_mm=SOCK_DEPTH,
    clearances_radial_mm=CLEARANCES,
    bodies="1 socket bar + 6 identical pegs, as separate solids in one STL",
    bbox_mm=[round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z - lo.z, 2)],
    how_to_use="Print flat on the build platform. Try a peg in each socket. The "
               "tightest socket a peg enters by hand without forcing, and holds "
               "without glue, is the clearance to build the kit at. Report that "
               "number back and the kit is rebuilt to it.",
    checks=chk))

# -------- life-size solid volume and mass --------
K.wipe()
META = {o["object"]: o for o in man["objects"]}
SRC = K.import_glb(GLB, SCALE_1TO1)
want = [n for n, m in META.items() if m["layer"] == "outer"]
want += [n for n, m in META.items()
         if m["layer"] == "skeleton" and ("fin_ray" in n or "fin_rays" in n)]
used = []
MINWALL = 0.5
for nm in want:
    ob = SRC.get(nm)
    if not ob:
        continue
    if K.has_boundary(ob):
        K.solidify(ob, MINWALL)
    used.append(ob)
K.delete_all_but(set(used))
body = K.join(used, "life")
K.remesh(body, 0.12)
K.recalc(body)
fix_orientation(body)
K.ratio_decimate(body, 90000)
K.recalc(body)
fix_orientation(body)
v, com = K.volume_com(body)
lo, hi = K.bbox_world(body)
c2 = K.check(body)
p2 = os.path.join(OUTDIR, "winged-zebrafish-whole-1to1-38.8mm.stl")
nb2 = K.export_stl(body, p2)
RES = {"Tough_2000_1.12": 1.12, "Durable_1.10": 1.10, "Clear_V4_1.17": 1.17}
out["life_size_solid"] = dict(
    file=os.path.basename(p2), bytes=nb2,
    print_standard_length_mm=round(SL_M * 1000.0, 2), scale="1:1 life size",
    mm_per_model_unit=round(SCALE_1TO1, 4),
    bbox_mm=[round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z - lo.z, 2)],
    volume_cm3=round(v / 1000.0, 4), volume_mm3=round(v, 2),
    mass_g=dict((k, round(v / 1000.0 * d, 4)) for k, d in RES.items()),
    com_from_snout_as_fraction_of_SL=round((hi.x - com.x) / (SL_M * 1000.0), 4),
    min_wall_mm=MINWALL, checks=c2)

print("COUPON_JSON_BEGIN")
print(json.dumps(out, indent=1))
print("COUPON_JSON_END")
json.dump(out, open(os.path.join(OUTDIR, "_coupon.json"), "w"), indent=1)
