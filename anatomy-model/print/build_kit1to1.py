"""The 1:1 life-size snap/press-fit kit, built for Formlabs SLA.

blender.exe -b --python build_kit1to1.py -- <glb> <manifest> <outdir> [<clearance_mm>]

Design values, all chosen for Formlabs SLA at 38.8 mm standard length and all stated
in the README with their reason:
  minimum wall           0.50 mm   (Formlabs holds ~0.4 mm supported; 0.5 for margin)
  minimum handleable part 2.50 mm  (smaller than this cannot be picked up and seated)
  peg                    1.40 mm diameter x 1.50 mm, D-keyed so it seats one way only
  radial clearance       0.10 mm   (confirm with the fit coupon, then rebuild to it)
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
SL_MM = man["parameters"]["standard_length_m"] * 1000.0
SCALE = SL_MM / 0.82

# ---- SLA values at 1:1 ----
K.PEG_R, K.PEG_H = 0.70, 1.50
K.CLEARANCE, K.DEPTH_CLEAR = CLEAR, 0.15
K.MIN_WALL, K.MIN_FEATURE = 0.50, 2.50
K.PLATE_T, K.PLATE_MARGIN = 1.6, 1.5
K.CASE_WALL = 0.60
BOSS_R, LEG_R = 1.20, 1.00
VOX = 0.085
V = ["vertebra_%02d" % i for i in range(1, 33)]
PRL = ["pectoral_fin_ray_L_%02d" % i for i in range(1, 13)]
PRR = ["pectoral_fin_ray_R_%02d" % i for i in range(1, 13)]
rec, fails = {}, []


def log(*a):
    print("[1to1]", *a, flush=True)


# ------------------------------------------------------------------ part plan
def P(file, kind, system, organ, part, sources, level, oid, olabel, side, parent,
      notes=(), holds=None, merge_note=None):
    return dict(file=file, kind=kind, system=system, organ=organ, part=part,
                sources=list(sources), level=level, ontology_id=oid,
                ontology_label=olabel, side=side, parent=parent, notes=list(notes),
                holds=holds, merge_note=merge_note)


PLAN = []
for s in ("L", "R"):
    PLAN.append(P("integumental__skin-of-body__case-%s" % s, "case", "integumental",
                  "skin of body", "case " + s, ["skin_" + s], "organ",
                  "UBERON_0002097", "skin of body", s, None,
                  ["the integumental system is the animal's outer boundary, so it is "
                   "also the case the kit seats inside",
                   "at 1:1 the half is 40 mm and needs no fore/aft split"]))

PLAN += [
    P("musculoskeletal__axial__carrier", "carrier", "musculoskeletal",
      "axial skeleton", "carrier", [], "organ system", "UBERON_0002416",
      "musculoskeletal system", "mid", "integumental__skin-of-body__case-L",
      holds=["musculoskeletal__vertebral-column__spine",
             "musculoskeletal__skull__half-L", "musculoskeletal__skull__half-R",
             "musculoskeletal__rib-cage__ribs-L", "musculoskeletal__rib-cage__ribs-R",
             "musculoskeletal__dorsal-fin__fin-plate",
             "musculoskeletal__anal-fin__fin-plate",
             "musculoskeletal__caudal-fin__fin-plate"]),
    P("musculoskeletal__vertebral-column__spine", "organ", "musculoskeletal",
      "vertebral column", "spine (all 32 vertebrae)", V, "organ", None, "vertebra",
      "mid", "musculoskeletal__axial__carrier",
      ["MERGED: all 32 vertebrae into one spine piece. At 1:1 a vertebra is about "
       "1.6 mm long and 3.8 mm tall, below the 2.5 mm handleable minimum in its long "
       "axis and far too small to seat by hand.",
       "consequence: individual vertebrae cannot be removed; the column's regional "
       "change in shape is still visible along the piece"],
      merge_note="32 -> 1"),
]
for s in ("L", "R"):
    PLAN += [
        P("musculoskeletal__skull__half-%s" % s, "organ", "musculoskeletal", "skull",
          "half %s (eye included)" % s, ["skull_" + s, "eye_" + s], "organ", None,
          "skull, with the ipsilateral eye merged in", s,
          "musculoskeletal__axial__carrier",
          ["MERGED ACROSS A SYSTEM BOUNDARY: the eye is 2.19 mm at 1:1, below the "
           "handleable minimum, so it is fused into the skull half that surrounds it. "
           "The eye belongs to the ENTIRE SENSE ORGAN SYSTEM (UBERON_0000970), not to "
           "the musculoskeletal system, so the kit's containment hierarchy is broken "
           "here. This is recorded rather than hidden.",
           "consequence: the sense organ system has no piece of its own at 1:1"],
          merge_note="2 -> 1, crosses organ systems"),
        P("musculoskeletal__rib-cage__ribs-%s" % s, "organ", "musculoskeletal",
          "rib cage", "ribs %s" % s, ["ribs_" + s], "organ", None, "ribs", s,
          "musculoskeletal__axial__carrier",
          ["ribs are thin struts and are thickened to the minimum wall; the amount is "
           "recorded per part"]),
        P("musculoskeletal__pectoral-girdle__girdle-%s" % s, "organ", "musculoskeletal",
          "pectoral girdle", "girdle %s" % s,
          ["cleithrum_" + s, "scapula_" + s, "coracoid_" + s], "organ",
          "UBERON_0007830", "pectoral girdle skeleton", s,
          "musculoskeletal__appendicular__carrier-%s" % s,
          ["MERGED: scapula (0.57 mm) and coracoid (1.23 mm) at 1:1 are far below the "
           "2.5 mm handleable minimum and below the 0.5 mm wall in places. They are "
           "fused to the cleithrum (8.9 mm), their true neighbour in the girdle.",
           "consequence: the three girdle bones cannot be separated"],
          merge_note="3 -> 1"),
        P("musculoskeletal__pectoral-fin__fin-plate-%s" % s, "organ", "musculoskeletal",
          "pectoral fin", "fin plate %s" % s,
          ["pectoral_fin_" + s] + (PRL if s == "L" else PRR), "organ",
          "UBERON_0000151", "pectoral fin", s,
          "musculoskeletal__appendicular__carrier-%s" % s,
          ["MERGED: the membrane and all 12 rays print as one fin plate. A single ray "
           "at 1:1 is a hair.",
           "THE EVIDENCE-BACKED PROPORTION OF THIS DESIGN LIVES IN THIS PART"],
          merge_note="13 -> 1"),
        P("musculoskeletal__pelvic-fin__fin-plate-%s" % s, "organ", "musculoskeletal",
          "pelvic fin", "fin plate %s" % s,
          ["pelvic_fin_" + s, "pelvic_fin_rays_" + s], "organ", None, "pelvic fin", s,
          "musculoskeletal__appendicular__carrier-%s" % s,
          ["MERGED: membrane and rays print as one plate"], merge_note="2 -> 1"),
        P("musculoskeletal__pectoral-muscle__muscle-%s" % s, "tissue",
          "musculoskeletal", "pectoral muscle", "muscle %s" % s,
          ["pectoral_muscle_" + s], "tissue", None, "pectoral muscle", s,
          "musculoskeletal__appendicular__carrier-%s" % s),
        P("musculoskeletal__myotome__muscle-%s" % s, "tissue", "musculoskeletal",
          "myotome", "muscle %s" % s, ["muscle_" + s], "tissue", None,
          "axial muscle / myotome", s,
          "musculoskeletal__appendicular__carrier-%s" % s),
        P("musculoskeletal__appendicular__carrier-%s" % s, "carrier", "musculoskeletal",
          "appendicular skeleton", "carrier %s" % s, [], "organ system",
          "UBERON_0002416", "musculoskeletal system", s,
          "integumental__skin-of-body__case-%s" % s,
          holds=["musculoskeletal__pectoral-girdle__girdle-%s" % s,
                 "musculoskeletal__pectoral-fin__fin-plate-%s" % s,
                 "musculoskeletal__pelvic-fin__fin-plate-%s" % s,
                 "musculoskeletal__pectoral-muscle__muscle-%s" % s,
                 "musculoskeletal__myotome__muscle-%s" % s]),
    ]
for nm, src in (("dorsal-fin", ["dorsal_fin", "dorsal_fin_rays"]),
                ("anal-fin", ["anal_fin", "anal_fin_rays"]),
                ("caudal-fin", ["caudal_fin", "caudal_fin_rays"])):
    PLAN.append(P("musculoskeletal__%s__fin-plate" % nm, "organ", "musculoskeletal",
                  nm.replace("-", " "), "fin plate", src, "organ", None,
                  nm.replace("-", " "), "mid", "musculoskeletal__axial__carrier",
                  ["MERGED: membrane and rays print as one plate"], merge_note="2 -> 1"))

OTHER = [
    ("nervous", "nervous system", "UBERON_0001016",
     [("nervous__brain__organ", ["brain"], "brain", "UBERON_0000955", "mid"),
      ("nervous__spinal-cord__organ", ["spinal_cord"], "spinal cord",
       "UBERON_0002240", "mid")]),
    ("respiratory", "respiratory system", "UBERON_0001004",
     [("respiratory__gills__organ-L", ["gills_L"], "gills", None, "L"),
      ("respiratory__gills__organ-R", ["gills_R"], "gills", None, "R")]),
    ("digestive", "digestive system", "UBERON_0001007",
     [("digestive__oesophagus__organ", ["oesophagus"], "oesophagus",
       "UBERON_0001043", "mid"),
      ("digestive__intestine__organ", ["intestine"], "intestine", None, "mid"),
      ("digestive__liver__organ", ["liver"], "liver", "UBERON_0002107", "mid")]),
    ("gas-bladder", "gas bladder", None,
     [("gas-bladder__swim-bladder__organ", ["swim_bladder"], "swim bladder", None,
       "mid")]),
    ("renal", "renal system", "UBERON_0001008",
     [("renal__kidney__organ", ["kidney", "head_kidney"], "kidney and head kidney",
       "UBERON_0002113", "mid")]),
    ("reproductive", "reproductive system", "UBERON_0000990",
     [("reproductive__gonad__organ-L", ["gonad_L"], "gonad", "UBERON_0000991", "L"),
      ("reproductive__gonad__organ-R", ["gonad_R"], "gonad", "UBERON_0000991", "R")]),
    ("viscera", "MIXED - circulatory + hematopoietic", None,
     [("viscera__heart-and-spleen__organ-block", ["heart", "spleen"],
       "heart and spleen", "UBERON_0000948 + UBERON_0002106", "mid")]),
]
for slug, syslabel, sysid, organs in OTHER:
    PLAN.append(P("%s__system__carrier" % slug, "carrier", slug, syslabel, "carrier",
                  [], "organ system", sysid, syslabel, "mid",
                  "integumental__skin-of-body__case-L",
                  holds=[o[0] for o in organs]))
    for f, src, label, oid, side in organs:
        notes = []
        mn = None
        if f.endswith("organ-block"):
            notes = ["MERGED ACROSS SYSTEM BOUNDARIES: heart (2.09 mm, circulatory "
                     "system) and spleen (1.33 mm, hematopoietic system) are both below "
                     "the 2.5 mm handleable minimum at 1:1 and neither system has a "
                     "second organ to merge with. They print as one block, so two organ "
                     "systems share a single piece and the containment hierarchy is "
                     "broken here. Recorded, not hidden.",
                     "consequence: the circulatory and hematopoietic systems have no "
                     "piece of their own at 1:1"]
            mn = "2 -> 1, crosses organ systems"
        elif len(src) > 1:
            notes = ["MERGED: head kidney (1.63 mm) is below the handleable minimum and "
                     "is fused to the kidney, which is in the same organ system"]
            mn = "2 -> 1"
        PLAN.append(P(f, "organ", slug, label, "organ", src, "organ", oid, label, side,
                      "%s__system__carrier" % slug, notes, merge_note=mn))

PARTS = {p["file"]: p for p in PLAN}
log("plan:", len(PLAN), "parts;",
    sum(1 for p in PLAN if p["kind"] == "carrier"), "carriers")


# ------------------------------------------------------------------ geometry
def bvh(ob):
    return BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())


def bottom_z(ob, x, y):
    lo, hi = K.bbox_world(ob)
    t = bvh(ob)
    for dx, dy in ((0, 0), (.6, 0), (-.6, 0), (0, .6), (0, -.6), (1.4, 0), (-1.4, 0),
                   (0, 1.4), (0, -1.4), (2.5, 0), (-2.5, 0)):
        h = t.ray_cast(Vector((x + dx, y + dy, lo.z - 3)), Vector((0, 0, 1)), 1e4)
        if h[0] is not None:
            return h[0].z, x + dx, y + dy
    return None, x, y


def inner_floor(ob, x, y):
    lo, hi = K.bbox_world(ob)
    t = bvh(ob)
    o, d, hits = Vector((x, y, lo.z - 3)), Vector((0, 0, 1)), []
    for _ in range(6):
        h = t.ray_cast(o, d, 1e4)
        if h[0] is None:
            break
        hits.append(h[0].z)
        o = h[0] + d * 0.02
    return hits[1] if len(hits) >= 2 else (hits[0] if hits else None)


def dup(ob, name):
    n = ob.copy(); n.data = ob.data.copy(); n.name = name
    bpy.context.collection.objects.link(n)
    return n


K.wipe()
SRC = K.import_glb(GLB, SCALE)
log("imported", len(SRC), "source objects at", round(SCALE, 3), "mm/unit")
built = {}

for p in PLAN:
    if p["kind"] not in ("organ", "tissue", "case"):
        continue
    srcs = [dup(SRC[s], p["file"] + "__" + s) for s in p["sources"] if s in SRC]
    if not srcs:
        fails.append(dict(part=p["file"], why="no source object"))
        continue
    dev = []
    wall = K.CASE_WALL if p["kind"] == "case" else K.MIN_WALL
    for s in srcs:
        if K.has_boundary(s):
            K.solidify(s, wall)
            dev.append(dict(objects=[s.name.split("__")[-1]],
                            change="zero-thickness shell solidified", amount_mm=wall))
    ob = K.join(srcs, p["file"]) if len(srcs) > 1 else srcs[0]
    ob.name = p["file"]
    if len(srcs) > 1 or any(d["change"].startswith("zero") for d in dev):
        K.remesh(ob, VOX)
        K.recalc(ob); K.fix_orientation(ob)
        if len(srcs) > 1:
            dev.append(dict(objects=p["sources"], change="merged into one printed part",
                            amount_mm=None, count=len(p["sources"]),
                            reason=(p["notes"][0] if p["notes"] else "fragility")))
    t0 = K.min_thickness(ob)
    t1, total = t0, 0.0
    passes = 0
    # one pass is not enough when the structure is far below the limit: inflating a
    # 0.02 mm sheet by 0.24 mm does not give 0.5 mm, because the surface moves on
    # both sides and the remesh rounds it back. Iterate, and record the TOTAL.
    while t1 is not None and t1 < K.MIN_WALL and passes < 4:
        amt = max((K.MIN_WALL - t1) / 2.0, 0.03)
        K.inflate(ob, amt)
        K.remesh(ob, VOX)
        K.recalc(ob); K.fix_orientation(ob)
        total += amt
        passes += 1
        t1 = K.min_thickness(ob)
    if total > 0:
        ratio = (t1 / t0) if (t0 and t1) else None
        dev.append(dict(objects=["<part>"],
                        change="inflated along surface normals to reach the minimum wall",
                        total_amount_mm=round(total, 4), passes=passes,
                        measured_min_wall_before_mm=t0,
                        measured_min_wall_after_mm=t1,
                        thickness_multiplied_by=(round(ratio, 1) if ratio else None),
                        reason="ANATOMY ALTERED: at 1:1 this structure is genuinely "
                               "thinner than %.2f mm and cannot be printed as it is"
                               % K.MIN_WALL))
    built[p["file"]] = dict(obj=ob, dev=dev, mw0=t0, mw1=t1)
    log("part", p["file"], "minwall", t0, "->", t1)

# ---- pegs on every seated child ----
pegged = {}
for f, b in list(built.items()):
    if PARTS[f]["kind"] == "case":
        continue
    ob = b["obj"]
    lo, hi = K.bbox_world(ob)
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    z, px, py = bottom_z(ob, cx, cy)
    if z is None:
        fails.append(dict(part=f, why="no bottom surface found for the peg"))
        continue
    peg = K.d_cylinder(f + "_peg", K.PEG_R, K.PEG_H + 0.8, (px, py, z + 0.4 - K.PEG_H / 2))
    mark = K.index_triangle(f + "_mk", (px + K.PEG_R + 1.1, py, z + 0.15),
                            size=1.1, height=0.4)
    ob = K.join([ob, peg, mark], f)
    K.fix_orientation(ob)
    b["obj"] = ob
    pegged[f] = dict(x=px, y=py, z=z)
    b["joinery"] = dict(peg_diameter_mm=K.PEG_R * 2, peg_length_mm=K.PEG_H,
                        key="D-profile flat, so the part seats in one rotation only",
                        index_mark="raised triangle beside the peg; align it with the "
                                   "triangle beside the socket",
                        peg_at=[round(px, 2), round(py, 2), round(z, 2)])

# ---- carriers ----
for p in PLAN:
    if p["kind"] != "carrier":
        continue
    f = p["file"]
    kids = [k for k in p["holds"] if k in pegged]
    if not kids:
        fails.append(dict(part=f, why="no seated children"))
        continue
    xs, ys, zs = [], [], []
    for k in kids:
        lo, hi = K.bbox_world(built[k]["obj"])
        xs += [lo.x, hi.x]; ys += [lo.y, hi.y]; zs.append(pegged[k]["z"])
    top = min(zs) - 0.8
    x0, x1 = min(xs) - K.PLATE_MARGIN, max(xs) + K.PLATE_MARGIN
    y0, y1 = min(ys) - K.PLATE_MARGIN, max(ys) + K.PLATE_MARGIN
    plate = K.box(f, (x1 - x0, y1 - y0, K.PLATE_T),
                  ((x0 + x1) / 2, (y0 + y1) / 2, top - K.PLATE_T / 2))
    adds, cuts, bosses = [], [], []
    for k in kids:
        r = pegged[k]
        h = r["z"] - 0.1 - top
        if h > 0.4:
            adds.append(K.d_cylinder(f + "_b_" + k, BOSS_R, h,
                                     (r["x"], r["y"], top + h / 2), segments=16))
            bosses.append(dict(child=k, boss_height_mm=round(h, 3),
                               boss_diameter_mm=BOSS_R * 2))
        else:
            bosses.append(dict(child=k, boss_height_mm=0.0))
        tz = max(r["z"] - 0.1, top)
        d = K.PEG_H + K.DEPTH_CLEAR
        cuts.append(K.d_cylinder(f + "_s_" + k, K.PEG_R + K.CLEARANCE, d + 2.0,
                                 (r["x"], r["y"], tz - d + (d + 2.0) / 2 - 0.0),
                                 flat_at=K.PEG_R * K.KEY_FLAT + K.CLEARANCE))
        adds.append(K.index_triangle(f + "_m_" + k,
                                     (r["x"] + K.PEG_R + 1.1, r["y"], tz + 0.12),
                                     size=1.1, height=0.4))
    # leg down into the case half
    casef = p["parent"]
    ax = min(max((x0 + x1) / 2, x0 + 2), x1 - 2)
    ay = -1.8 if p["side"] != "R" else 1.8
    leg = None
    if casef in built:
        fz = inner_floor(built[casef]["obj"], ax, ay)
        if fz is not None and fz < top - K.PLATE_T - 0.4:
            lh = (top - K.PLATE_T) - fz + 0.5
            adds.append(K.d_cylinder(f + "_leg", LEG_R, lh,
                                     (ax, ay, top - K.PLATE_T - lh / 2 + 0.25),
                                     segments=16))
            leg = dict(case_part=casef, leg_height_mm=round(lh, 3),
                       leg_diameter_mm=LEG_R * 2,
                       anchor=[round(ax, 2), round(ay, 2), round(fz, 2)])
    ob = K.join([plate] + adds, f)
    allcut = all(K.boolean(ob, c, "DIFFERENCE") for c in cuts)
    # a carrier is a plate with THROUGH holes and no internal cavity, so
    # recalculate-outside is both safe and needed after the boolean
    K.recalc(ob); K.fix_orientation(ob)
    c = K.check(ob)
    if not (c["watertight"] and c["no_inverted_normals"]):
        K.remesh(ob, VOX); K.recalc(ob); K.fix_orientation(ob)
    built[f] = dict(obj=ob, dev=[dict(objects=["<generated>"],
                    change="carrier plate generated; it is a printing fixture, not an "
                           "anatomical structure", amount_mm=None,
                    reason="the source model has no organ-system geometry; the tray is "
                           "what makes part_of containment physical")],
                    mw0=K.PLATE_T, mw1=K.PLATE_T,
                    joinery=dict(plate_thickness_mm=K.PLATE_T, bosses=bosses,
                                 leg=leg, sockets=len(cuts),
                                 socket_diameter_mm=round((K.PEG_R + K.CLEARANCE) * 2, 3),
                                 radial_clearance_mm=K.CLEARANCE,
                                 all_sockets_cut=allcut))
    if not allcut:
        fails.append(dict(part=f, why="a socket boolean failed"))
    log("carrier", f, "kids", len(kids))

# ---- case: carrier sockets + midline mating ----
for p in PLAN:
    if p["kind"] != "case" or p["file"] not in built:
        continue
    f = p["file"]
    case = built[f]["obj"]
    lo, hi = K.bbox_world(case)
    cuts, adds = [], []
    nleg = 0
    for q in PLAN:
        if q["kind"] != "carrier":
            continue
        lg = built.get(q["file"], {}).get("joinery", {}).get("leg")
        if not lg or lg["case_part"] != f:
            continue
        ax, ay, az = lg["anchor"]
        d = 1.2
        cuts.append(K.d_cylinder(f + "_cs_" + q["file"], LEG_R + K.CLEARANCE, d + 2.0,
                                 (ax, ay, az - d + (d + 2.0) / 2),
                                 flat_at=LEG_R * K.KEY_FLAT + K.CLEARANCE))
        nleg += 1
    for i, t in enumerate((0.28, 0.55, 0.82)):
        x = lo.x + (hi.x - lo.x) * t
        zc = (lo.z + hi.z) / 2 + (hi.z - lo.z) * (0.16 if i % 2 else -0.16)
        if p["side"] == "L":
            pin = K.d_cylinder(f + "_pin%d" % i, K.PEG_R, 2.6, (0, 0, 0))
            pin.rotation_euler = (math.radians(90), 0, 0)
            K.apply_transform(pin)
            pin.location = (x, -0.6, zc)
            K.apply_transform(pin)
            adds.append(pin)
        else:
            s = K.d_cylinder(f + "_ms%d" % i, K.PEG_R + K.CLEARANCE, 3.4, (0, 0, 0),
                             flat_at=K.PEG_R * K.KEY_FLAT + K.CLEARANCE)
            s.rotation_euler = (math.radians(90), 0, 0)
            K.apply_transform(s)
            s.location = (x, 0.9, zc)
            K.apply_transform(s)
            cuts.append(s)
    if adds:
        case = K.join([case] + adds, f)
    ok = all(K.boolean(case, c, "DIFFERENCE") for c in cuts)
    K.recalc(case); K.fix_orientation(case)
    c = K.check(case)
    if not (c["watertight"] and c["no_inverted_normals"]):
        K.remesh(case, 0.12); K.recalc(case); K.fix_orientation(case)
    built[f]["obj"] = case
    built[f]["joinery"] = dict(
        carrier_sockets=nleg, wall_mm=K.CASE_WALL,
        midline="3 keyed pins on the left half, 3 matching sockets on the right half, "
                "set on the sagittal rim so the bilateral halves mate on the midline",
        all_booleans_ok=ok)
    if not ok:
        fails.append(dict(part=f, why="a case boolean failed"))
    log("case", f, "carrier sockets", nleg)

# ------------------------------------------------------------ export + verify
out = {}
for f, b in built.items():
    ob = b["obj"]
    cc = K.check(ob)
    if not (cc["watertight"] and cc["no_inverted_normals"]):
        K.remesh(ob, VOX)
        K.recalc(ob); K.fix_orientation(ob)
        b["dev"].append(dict(objects=["<part>"],
                             change="final voxel remesh to recover a closed solid",
                             amount_mm=VOX,
                             reason="the part was not watertight after its booleans"))
    path = os.path.join(OUTDIR, f + ".stl")
    nb = K.export_stl(ob, path)
    c = K.check(ob)
    lo, hi = K.bbox_world(ob)
    dims = [round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z - lo.z, 2)]
    mw = K.min_thickness(ob)
    v_mc = K.monte_carlo_volume(ob, 40000)
    vol_ok = abs(v_mc - c["volume_mm3"]) / max(abs(c["volume_mm3"]), 1e-9) < 0.08
    p = PARTS[f]
    ok = c["watertight"] and c["no_inverted_normals"] and vol_ok
    if not vol_ok:
        fails.append(dict(part=f, why="surface-integral volume %.1f mm3 disagrees with "
                          "the independent Monte Carlo volume %.1f mm3 by more than 8%%: "
                          "a shell is probably wound inside out"
                          % (c["volume_mm3"], v_mc)))
    if not ok:
        fails.append(dict(part=f, why="failed the watertight / normals check", checks=c))
    if max(dims) < K.MIN_FEATURE:
        fails.append(dict(part=f, why="longest dimension %.2f mm is under the %.2f mm "
                          "handleable minimum" % (max(dims), K.MIN_FEATURE)))
    if mw is not None and mw < K.MIN_WALL - 1e-3:
        fails.append(dict(part=f, why="measured minimum wall %.3f mm is under the "
                          "%.2f mm limit" % (mw, K.MIN_WALL)))
    out[f] = dict(file=f + ".stl", kind=p["kind"], system=p["system"],
                  organ=p["organ"], part=p["part"], level=p["level"],
                  side=p["side"], ontology_id=p["ontology_id"],
                  ontology_label=p["ontology_label"],
                  seats_into=p["parent"], holds=p.get("holds"),
                  source_objects=p["sources"],
                  source_object_count=len(p["sources"]),
                  merge=p.get("merge_note"), notes=p["notes"],
                  deviations=b["dev"], measured_min_wall_mm=mw,
                  bbox_mm=dims, triangles=c["triangles"], bytes=nb,
                  volume_mm3=c["volume_mm3"],
                  volume_cross_check=dict(surface_integral_mm3=c["volume_mm3"],
                                          monte_carlo_mm3=round(v_mc, 2),
                                          agree=vol_ok),
                  checks=c,
                  joinery=b.get("joinery"), passed=ok,
                  printable_at_1to1=bool(ok and (mw is None or mw >= K.MIN_WALL - 1e-3)
                                         and max(dims) >= K.MIN_FEATURE),
                  HYPOTHETICAL=True, hypothetical_note=HN)
    log("exported", f, dims, c["triangles"], "ok", ok)

tot_v = sum(v["volume_mm3"] for v in out.values() if v["volume_mm3"] > 0)
res = dict(scale=dict(print_standard_length_mm=round(SL_MM, 2), scale="1:1 life size",
                      mm_per_model_unit=round(SCALE, 4)),
           sla=dict(min_wall_mm=K.MIN_WALL, min_handleable_part_mm=K.MIN_FEATURE,
                    peg_diameter_mm=K.PEG_R * 2, peg_length_mm=K.PEG_H,
                    radial_clearance_mm=K.CLEARANCE,
                    depth_clearance_mm=K.DEPTH_CLEAR,
                    plate_thickness_mm=K.PLATE_T, case_wall_mm=K.CASE_WALL),
           totals=dict(parts=len(out),
                       total_material_volume_cm3=round(tot_v / 1000.0, 4),
                       by_kind={k: sum(1 for v in out.values() if v["kind"] == k)
                                for k in ("case", "carrier", "organ", "tissue")}),
           parts=out, failures=fails, hypothetical_note=HN)
json.dump(res, open(os.path.join(OUTDIR, "_kit1to1.json"), "w"), indent=1)
print("KIT1TO1", json.dumps(dict(parts=len(out), failures=len(fails),
                                 volume_cm3=round(tot_v / 1000.0, 4))))
