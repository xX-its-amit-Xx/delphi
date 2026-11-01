"""The 1:1 STARTER KIT: a small set of chunky parts that actually print at 38.8 mm.

blender.exe -b --python build_starter.py -- <glb> <manifest> <outdir> [clearance]

This kit deliberately abandons the fine anatomy. At life size a zebrafish kidney is a
thread ~0.4 mm across and a fin ray is finer than a hair; both are below what SLA holds.
Rather than inflate them 10-80x and call it anatomy, the small viscera are merged into
ONE visceral block and the fine skeleton into chunky carriers. Every merge is recorded.

There are no generated carrier plates here: a 1.6 mm plate with 1.8 mm sockets through
it is degenerate at this scale. Each part pegs straight into the left case half, so the
containment hierarchy is FLATTENED to body -> part. That is a real loss and it is stated.

Joinery is the coupon's: D-keyed peg 1.4 mm dia x 1.5 mm, stated radial clearance.
"""
import bpy, bmesh, json, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import kitlib as K

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST, OUTDIR = argv[0], argv[1], argv[2]
CLEAR = float(argv[3]) if len(argv) > 3 else 0.10
os.makedirs(OUTDIR, exist_ok=True)
man = json.load(open(MANIFEST, encoding="utf-8"))
META = {o["object"]: o for o in man["objects"]}
HN = man["objects"][0]["hypothetical_note"]
SL = man["parameters"]["standard_length_m"] * 1000.0
SCALE = SL / 0.82

K.PEG_R, K.PEG_H = 0.70, 1.50
K.CLEARANCE, K.DEPTH_CLEAR = CLEAR, 0.15
K.MIN_WALL, K.MIN_FEATURE = 0.50, 2.50   # the GATE
SHELL_WALL = 0.78      # solidify above the gate: a 0.50 shell voxel-remeshes to 0.497
INFLATE_TO = 0.72      # inflate until p05 clears the gate with margin
CASE_WALL = 0.90
VOX = 0.15   # coarser voxel keeps the files servable; the shell wall above
             # is raised to compensate for the extra rounding
V = ["vertebra_%02d" % i for i in range(1, 33)]
PRL = ["pectoral_fin_ray_L_%02d" % i for i in range(1, 13)]
PRR = ["pectoral_fin_ray_R_%02d" % i for i in range(1, 13)]


def log(*a):
    print("[starter]", *a, flush=True)


SPEC = [
    dict(file="01__body-case__half-L", sources=["skin_L"], wall=CASE_WALL,
         system="integumental system", organ="skin of body", level="organ",
         oid="UBERON_0002097", side="L", seats_into=None,
         notes=["the case the whole kit seats inside; also the integumental system, "
                "which really is the animal's outer boundary"]),
    dict(file="02__body-case__half-R", sources=["skin_R"], wall=CASE_WALL,
         system="integumental system", organ="skin of body", level="organ",
         oid="UBERON_0002097", side="R", seats_into="01__body-case__half-L",
         notes=["mates to the left half on the midline with three keyed pins"]),
    dict(file="03__axial__spine", sources=V, wall=SHELL_WALL,
         system="musculoskeletal system", organ="vertebral column", level="organ",
         oid=None, side="mid", seats_into="01__body-case__half-L",
         merge="32 -> 1",
         notes=["MERGED: all 32 vertebrae. At 1:1 a vertebra is ~1.6 mm long with "
                "neural and haemal spines far under the printable wall.",
                "consequence: individual vertebrae cannot be removed"]),
    dict(file="04__cranium__skull-block", sources=["skull_L", "skull_R", "eye_L", "eye_R"],
         wall=SHELL_WALL, system="musculoskeletal system + sense organ system",
         organ="skull with both eyes", level="organ", oid=None, side="mid",
         seats_into="01__body-case__half-L", merge="4 -> 1, crosses organ systems",
         notes=["MERGED ACROSS A SYSTEM BOUNDARY: the eyes (2.2 mm at 1:1) are fused "
                "into the skull block. Eyes belong to the ENTIRE SENSE ORGAN SYSTEM "
                "(UBERON_0000970), not the musculoskeletal system.",
                "the two skull halves are also fused: separated, each is a 0.15 mm "
                "shell at this scale",
                "consequence: the sense organ system has no piece of its own"]),
    dict(file="05__pectoral-fin__plate-L", sources=["pectoral_fin_L"] + PRL,
         wall=SHELL_WALL, system="musculoskeletal system", organ="pectoral fin",
         level="organ", oid="UBERON_0000151", side="L",
         seats_into="01__body-case__half-L", merge="13 -> 1",
         notes=["MERGED: membrane and all 12 rays as one plate; a ray at 1:1 is finer "
                "than a hair",
                "THE ONE EVIDENCE-BACKED PROPORTION OF THIS DESIGN LIVES IN THIS PART"]),
    dict(file="06__pectoral-fin__plate-R", sources=["pectoral_fin_R"] + PRR,
         wall=SHELL_WALL, system="musculoskeletal system", organ="pectoral fin",
         level="organ", oid="UBERON_0000151", side="R",
         seats_into="01__body-case__half-L", merge="13 -> 1",
         notes=["MERGED: membrane and all 12 rays as one plate",
                "THE ONE EVIDENCE-BACKED PROPORTION OF THIS DESIGN LIVES IN THIS PART"]),
    dict(file="07__viscera__organ-block",
         sources=["heart", "spleen", "liver", "intestine", "oesophagus", "swim_bladder",
                  "kidney", "head_kidney", "gonad_L", "gonad_R"],
         wall=SHELL_WALL, system="MIXED - circulatory, hematopoietic, digestive, gas "
         "bladder, renal, reproductive", organ="viscera", level="organ", oid=None,
         side="mid", seats_into="01__body-case__half-L",
         merge="10 -> 1, crosses SIX organ systems",
         notes=["MERGED ACROSS SIX ORGAN SYSTEMS. At 1:1 the spleen is 1.3 mm, the "
                "heart 2.1 mm, the head kidney 1.6 mm and the kidney a 0.4 mm thread. "
                "None can be a separate handleable piece and none can be printed at "
                "its real thickness.",
                "THIS IS THE KIT'S BIGGEST LOSS: six organ systems share one piece, so "
                "the containment hierarchy the project is built on is not expressed "
                "here at all. The 120 mm kit is the one that teaches it.",
                "consequence: no organ in this block can be removed or identified "
                "separately except by eye"]),
    dict(file="08__myotome__muscle-L", sources=["muscle_L"], wall=SHELL_WALL,
         system="musculoskeletal system", organ="myotome", level="tissue", oid=None,
         side="L", seats_into="01__body-case__half-L",
         notes=["tissue level: the axial swimming muscle"]),
    dict(file="09__myotome__muscle-R", sources=["muscle_R"], wall=SHELL_WALL,
         system="musculoskeletal system", organ="myotome", level="tissue", oid=None,
         side="R", seats_into="01__body-case__half-L",
         notes=["tissue level: the axial swimming muscle"]),
    dict(file="10__caudal-fin__plate", sources=["caudal_fin", "caudal_fin_rays"],
         wall=SHELL_WALL, system="musculoskeletal system", organ="caudal fin",
         level="organ", oid=None, side="mid", seats_into="01__body-case__half-L",
         merge="2 -> 1", notes=["MERGED: membrane and rays as one plate"]),
]


def dup(ob, name):
    n = ob.copy(); n.data = ob.data.copy(); n.name = name
    bpy.context.collection.objects.link(n)
    return n


def bottom_z(ob, x, y):
    lo, hi = K.bbox_world(ob)
    t = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    for dx, dy in ((0, 0), (.6, 0), (-.6, 0), (0, .6), (0, -.6), (1.6, 0), (-1.6, 0),
                   (0, 1.6), (0, -1.6), (3, 0), (-3, 0)):
        h = t.ray_cast(Vector((x + dx, y + dy, lo.z - 4)), Vector((0, 0, 1)), 1e4)
        if h[0] is not None:
            return h[0].z, x + dx, y + dy
    return None, x, y


K.wipe()
SRC = K.import_glb(GLB, SCALE)
log("imported", len(SRC), "objects at", round(SCALE, 3), "mm/unit")
built, fails = {}, []

for sp in SPEC:
    srcs = [dup(SRC[s], sp["file"] + "__" + s) for s in sp["sources"] if s in SRC]
    if not srcs:
        fails.append(dict(part=sp["file"], why="no source object"))
        continue
    dev = []
    for s in srcs:
        if K.has_boundary(s):
            K.solidify(s, sp["wall"])
            dev.append(dict(objects=[s.name.split("__")[-1]],
                            change="zero-thickness shell solidified",
                            amount_mm=sp["wall"],
                            reason="a surface cannot be printed; the real membrane is "
                                   "far thinner, so this part is much thicker than the "
                                   "anatomy"))
    ob = K.join(srcs, sp["file"]) if len(srcs) > 1 else srcs[0]
    ob.name = sp["file"]
    K.remesh(ob, VOX)
    K.recalc(ob)
    K.fix_orientation(ob)
    if len(srcs) > 1:
        dev.append(dict(objects=sp["sources"], count=len(sp["sources"]),
                        change="merged into one printed part", amount_mm=None,
                        reason=sp["notes"][0]))
    # inflate on the ROBUST wall statistic until it clears the minimum
    w0 = K.wall_stats(ob)
    w1, total, passes = w0, 0.0, 0
    p05 = lambda w: w["p05"] if (w and w.get("samples", 0) >= 60) else None
    while p05(w1) is not None and p05(w1) < INFLATE_TO and passes < 4:
        amt = max((INFLATE_TO - p05(w1)) / 2.0, 0.05)
        K.inflate(ob, amt)
        K.remesh(ob, VOX)
        K.recalc(ob)
        K.fix_orientation(ob)
        total += amt
        passes += 1
        w1 = K.wall_stats(ob)
    if total > 0:
        dev.append(dict(objects=["<part>"],
                        change="inflated along surface normals to reach the 0.50 mm "
                               "printable wall",
                        total_amount_mm=round(total, 3), passes=passes,
                        wall_before=w0, wall_after=w1,
                        reason="ANATOMY ALTERED: this structure is genuinely thinner "
                               "than 0.50 mm at life size"))
    built[sp["file"]] = dict(obj=ob, spec=sp, dev=dev, wall=w1)
    log("built", sp["file"], "wall", (w1 or {}).get("p05"), "samples",
        (w1 or {}).get("samples"))

# ---- pegs on everything that seats into the case, then sockets in the case ----
case_L = built["01__body-case__half-L"]["obj"]
case_R = built["02__body-case__half-R"]["obj"]
sockets = []
for f, b in built.items():
    sp = b["spec"]
    if sp["seats_into"] != "01__body-case__half-L":
        continue
    ob = b["obj"]
    lo, hi = K.bbox_world(ob)
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    z, px, py = bottom_z(ob, cx, cy)
    if z is None:
        fails.append(dict(part=f, why="no bottom surface for a peg"))
        continue
    peg = K.d_cylinder(f + "_peg", K.PEG_R, K.PEG_H + 0.9,
                       (px, py, z + 0.45 - K.PEG_H / 2))
    mark = K.index_triangle(f + "_mk", (px + K.PEG_R + 1.2, py, z + 0.18),
                            size=1.2, height=0.45)
    ob = K.join([ob, peg, mark], f)
    K.fix_orientation(ob)
    b["obj"] = ob
    b["joinery"] = dict(peg_diameter_mm=K.PEG_R * 2, peg_length_mm=K.PEG_H,
                        radial_clearance_mm=K.CLEARANCE,
                        key="D-profile flat: the part seats in one rotation only",
                        index_mark="raised triangle beside the peg; align it with the "
                                   "triangle beside the socket",
                        seats_into="01__body-case__half-L",
                        peg_at=[round(px, 2), round(py, 2), round(z, 2)])
    d = K.PEG_H + K.DEPTH_CLEAR
    sockets.append(K.d_cylinder("sock_" + f, K.PEG_R + K.CLEARANCE, d + 2.0,
                                (px, py, z - d + (d + 2.0) / 2),
                                flat_at=K.PEG_R * K.KEY_FLAT + K.CLEARANCE))
    sockets.append(None)   # marker: also emboss an index triangle on the case
    built[f]["mark_at"] = (px + K.PEG_R + 1.2, py, z)

marks = [K.index_triangle("csm_%d" % i, (b["mark_at"][0], b["mark_at"][1],
                                         b["mark_at"][2] + 0.1), size=1.2, height=0.45)
         for i, (f, b) in enumerate(built.items()) if "mark_at" in b]
# midline mating pins: 3 on the left half, 3 sockets on the right
lo, hi = K.bbox_world(case_L)
pins, msocks = [], []
for i, t in enumerate((0.26, 0.54, 0.82)):
    x = lo.x + (hi.x - lo.x) * t
    zc = (lo.z + hi.z) / 2 + (hi.z - lo.z) * (0.18 if i % 2 else -0.18)
    pin = K.d_cylinder("mp%d" % i, K.PEG_R, 2.8, (0, 0, 0))
    pin.rotation_euler = (math.radians(90), 0, 0)
    K.apply_transform(pin)
    pin.location = (x, -0.7, zc)
    K.apply_transform(pin)
    pins.append(pin)
    ms = K.d_cylinder("ms%d" % i, K.PEG_R + K.CLEARANCE, 3.6, (0, 0, 0),
                      flat_at=K.PEG_R * K.KEY_FLAT + K.CLEARANCE)
    ms.rotation_euler = (math.radians(90), 0, 0)
    K.apply_transform(ms)
    ms.location = (x, 1.0, zc)
    K.apply_transform(ms)
    msocks.append(ms)

case_L = K.join([case_L] + pins + marks, "01__body-case__half-L")
K.fix_orientation(case_L)
cut_ok = True
for s in sockets:
    if s is None:
        continue
    if not K.boolean(case_L, s, "DIFFERENCE"):
        cut_ok = False
K.recalc(case_L)          # the case has THROUGH sockets, no internal cavity
K.fix_orientation(case_L)
# ALWAYS remesh the case after its booleans. A voxel remesh is guaranteed to return
# a closed manifold, and an EXACT boolean on a 260k-triangle shell reliably leaves a
# handful of sliver edges that a conditional repair kept missing. 0.11 mm is fine
# enough to keep the 1.4 mm midline pins and the socket bores.
K.remesh(case_L, 0.15)
K.recalc(case_L); K.fix_orientation(case_L)
built["01__body-case__half-L"]["obj"] = case_L
built["01__body-case__half-L"]["joinery"] = dict(
    sockets_for_parts=len([s for s in sockets if s is not None]),
    midline="3 keyed pins on this half; the right half carries 3 matching sockets",
    radial_clearance_mm=K.CLEARANCE, wall_mm=CASE_WALL, all_booleans_ok=cut_ok)

ok_R = all(K.boolean(case_R, s, "DIFFERENCE") for s in msocks)
K.recalc(case_R)
K.fix_orientation(case_R)
K.remesh(case_R, 0.15)
K.recalc(case_R); K.fix_orientation(case_R)
built["02__body-case__half-R"]["obj"] = case_R
built["02__body-case__half-R"]["joinery"] = dict(
    midline="3 sockets matching the left half's pins, on the sagittal rim",
    radial_clearance_mm=K.CLEARANCE, wall_mm=CASE_WALL, all_booleans_ok=ok_R)

# ---- export ----
out = {}
for f, b in built.items():
    ob = b["obj"]
    c = K.check(ob)
    if not (c["watertight"] and c["no_inverted_normals"]):
        K.remesh(ob, VOX)
        K.recalc(ob)
        K.fix_orientation(ob)
        b["dev"].append(dict(objects=["<part>"], change="final voxel remesh to recover "
                             "a closed solid", amount_mm=VOX))
        c = K.check(ob)
    path = os.path.join(OUTDIR, f + ".stl")
    nb = K.export_stl(ob, path)
    lo, hi = K.bbox_world(ob)
    dims = [round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z - lo.z, 2)]
    w = K.wall_stats(ob)
    sp = b["spec"]
    out[f] = dict(file=f + ".stl", system=sp["system"], organ=sp["organ"],
                  level=sp["level"], side=sp["side"], ontology_id=sp["oid"],
                  seats_into=sp["seats_into"], source_objects=sp["sources"],
                  source_object_count=len(sp["sources"]), merge=sp.get("merge"),
                  notes=sp["notes"], deviations=b["dev"],
                  measured_wall=w, bbox_mm=dims, triangles=c["triangles"], bytes=nb,
                  volume_mm3=c["volume_mm3"], checks=c, joinery=b.get("joinery"),
                  HYPOTHETICAL=True, hypothetical_note=HN)
    log("exported", f, dims, c["triangles"])

tot = sum(v["volume_mm3"] for v in out.values() if v["volume_mm3"] > 0)
json.dump(dict(kit="1:1 starter kit", scale=dict(print_standard_length_mm=round(SL, 2),
                                                 scale="1:1 life size",
                                                 mm_per_model_unit=round(SCALE, 4)),
               sla=dict(min_wall_mm=K.MIN_WALL, min_handleable_part_mm=K.MIN_FEATURE,
                        peg_diameter_mm=K.PEG_R * 2, peg_length_mm=K.PEG_H,
                        radial_clearance_mm=K.CLEARANCE, case_wall_mm=CASE_WALL,
                        resin="Formlabs Tough 2000"),
               hierarchy_note="FLATTENED: there are no organ-system carriers at 1:1, so "
                              "every part pegs straight into the body case. The "
                              "containment hierarchy is NOT expressed by this kit; the "
                              "120 mm kit is the one that teaches it.",
               totals=dict(parts=len(out),
                           total_material_volume_cm3=round(tot / 1000.0, 4)),
               parts=out, failures=fails, hypothetical_note=HN),
          open(os.path.join(OUTDIR, "_starter.json"), "w"), indent=1)
print("STARTER", json.dumps(dict(parts=len(out), failures=len(fails),
                                 volume_cm3=round(tot / 1000.0, 4))))
