"""Build the 56 structural parts of the winged-zebrafish kit.

blender.exe -b --python build_kit.py -- <glb> <manifest> <plan.json> <outdir> <SL_mm>

Joinery: blind D-profile peg into a matching D socket, 0.30 mm radial clearance.
Every organ sits on a boss of the height its anatomical position demands, so seating a
part does not move it off its true place in the body.
"""
import bpy, bmesh, json, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
import kitlib as K

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, MANIFEST, PLAN, OUTDIR, SL = argv[0], argv[1], argv[2], argv[3], float(argv[4])
SCALE = SL / 0.82
plan = json.load(open(PLAN, encoding="utf-8"))
os.makedirs(OUTDIR, exist_ok=True)

VOX_SMALL, VOX_BIG = 0.28, 0.5
SHELL_MARGIN = 1.25   # solidify above the gate; a shell at exactly MIN_WALL
                      # voxel-remeshes to just under it
INFLATE_TO = None     # set below, once K.MIN_WALL is known
BOSS_R = 4.5
LEG_R = 3.5
rec = {}
fails = []


def log(*a):
    print("[kit]", *a, flush=True)


# ------------------------------------------------------------------ utilities
def bvh(ob):
    return BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())


def bottom_surface_z(ob, x, y):
    """z of the lowest surface of ob in the column (x, y): shoot up from below."""
    lo, hi = K.bbox_world(ob)
    t = bvh(ob)
    for (dx, dy) in ((0, 0), (2, 0), (-2, 0), (0, 2), (0, -2), (4, 0), (-4, 0),
                     (0, 4), (0, -4), (6, 0), (-6, 0)):
        hit = t.ray_cast(Vector((x + dx, y + dy, lo.z - 5.0)), Vector((0, 0, 1)), 1e4)
        if hit[0] is not None:
            return hit[0].z, x + dx, y + dy
    return None, x, y


def inner_floor_z(ob, x, y):
    """Inside a hollow shell: shoot up from below, take the SECOND hit (the inner
    face of the bottom wall)."""
    lo, hi = K.bbox_world(ob)
    t = bvh(ob)
    org = Vector((x, y, lo.z - 5.0))
    d = Vector((0, 0, 1))
    hits = []
    for _ in range(6):
        h = t.ray_cast(org, d, 1e4)
        if h[0] is None:
            break
        hits.append(h[0].z)
        org = h[0] + d * 0.05
    if len(hits) >= 2:
        return hits[1]
    return hits[0] if hits else None


def dup(ob, name):
    n = ob.copy()
    n.data = ob.data.copy()
    n.name = name
    bpy.context.collection.objects.link(n)
    return n


def guarantee(ob, vox):
    """Make sure the part is a watertight, outward-oriented solid."""
    c = K.check(ob)
    if not (c["watertight"] and c["no_inverted_normals"]):
        K.remesh(ob, vox)
        K.recalc(ob)
        K.fix_orientation(ob)
        c = K.check(ob)
        c["needed_voxel_remesh_mm"] = vox
    return c


def add_peg(ob, name, r=K.PEG_R, h=K.PEG_H):
    """Put a keyed peg under the part at its footprint centre, plus a raised index
    mark on top beside it. Returns the peg tip position for the socket."""
    lo, hi = K.bbox_world(ob)
    cx, cy = (lo.x + hi.x) / 2.0, (lo.y + hi.y) / 2.0
    z, px, py = bottom_surface_z(ob, cx, cy)
    if z is None:
        return None
    # peg: from 1.6 mm inside the part down to h below the surface
    peg = K.d_cylinder(name + "_peg", r, h + 1.6, (px, py, z + 0.8 - h / 2.0))
    mark = K.index_triangle(name + "_mark", (px + r + 3.0, py, z + 0.3))
    merged = K.join([ob, peg, mark], ob.name)
    return dict(obj=merged, x=px, y=py, z=z, peg_r=r, peg_h=h)


# ------------------------------------------------------------------ pass 0: glb
K.wipe()
log("importing glb at", SCALE, "mm per model unit")
SRC = K.import_glb(GLB, SCALE)
log("imported", len(SRC), "objects")

PARTS = {p["file"]: p for p in plan["parts"]}
built = {}          # file -> dict(obj=, rec=)


def gather(p):
    """Duplicate the source objects this part needs, apply its op, return one object."""
    srcs = [dup(SRC[s], p["file"] + "__" + s) for s in p["sources"] if s in SRC]
    missing = [s for s in p["sources"] if s not in SRC]
    if not srcs:
        return None, missing, []
    dev = []
    op = p.get("op", "")
    wall = p.get("wall", K.MIN_WALL) * SHELL_MARGIN
    for s in srcs:
        if K.has_boundary(s):
            K.solidify(s, wall)
            dev.append(dict(objects=[s.name.split("__")[-1]],
                            change="zero-thickness shell solidified", amount_mm=wall,
                            reason="a surface cannot be printed; the real structure is "
                                   "thinner than this, so the printed part is thicker "
                                   "than the design implies"))
    ob = K.join(srcs, p["file"]) if len(srcs) > 1 else srcs[0]
    ob.name = p["file"]
    if len(srcs) > 1:
        dev.append(dict(objects=[s for s in p["sources"]],
                        change="merged into one printed part",
                        amount_mm=None, reason="; ".join(p.get("notes", [])[:1])
                        or "fragility / minimum part size"))
    return ob, missing, dev


# ------------------------------------------------- pass 1: organs and tissues
order = [f for f, p in PARTS.items() if p["kind"] in ("organ", "tissue")]
for f in order:
    p = PARTS[f]
    ob, missing, dev = gather(p)
    if ob is None:
        fails.append(dict(part=f, why="no source object found", missing=missing))
        log("FAIL(no source)", f)
        continue
    if len(p["sources"]) > 1 or p.get("op") in ("solidify_shell", "merge",
                                                "merge_solidify_inflate",
                                                "merge_and_inflate"):
        K.remesh(ob, VOX_SMALL)
        K.recalc(ob)
        dev.append(dict(objects=["<part>"], change="voxel remesh to fuse the merged "
                        "pieces into one closed solid", amount_mm=VOX_SMALL,
                        reason="guarantees watertightness; rounds detail finer than "
                               "this voxel"))
    # MEASURED wall distribution, then inflate if the 5th percentile is under the
    # limit. Gating on the strict minimum gates on noise; see README.
    w0 = K.wall_stats(ob)
    w1, total, passes = w0, 0.0, 0
    def _p05(w):
        return w["p05"] if (w and w.get("samples", 0) >= 60) else None
    while _p05(w1) is not None and _p05(w1) < K.MIN_WALL * 1.35 and passes < 4:
        amt = max((K.MIN_WALL * 1.35 - _p05(w1)) / 2.0, 0.05)
        K.inflate(ob, amt)
        K.remesh(ob, VOX_SMALL)
        K.recalc(ob)
        K.fix_orientation(ob)
        total += amt
        passes += 1
        w1 = K.wall_stats(ob)
    t0 = w0.get("p05") if w0 else None
    t1 = w1.get("p05") if w1 else None
    if total > 0:
        dev.append(dict(objects=["<part>"],
                        change="inflated along surface normals to reach the minimum wall",
                        total_amount_mm=round(total, 3), passes=passes,
                        wall_p05_before_mm=t0, wall_p05_after_mm=t1,
                        wall_distribution_before=w0, wall_distribution_after=w1,
                        reason="ANATOMY ALTERED: the structure is genuinely thinner than "
                               "%.2f mm at this scale and would not print" % K.MIN_WALL))
    built[f] = dict(obj=ob, dev=dev, min_wall_before=t0, min_wall_after=t1,
                    missing=missing)
    log("organ ok", f, "minwall", t0, "->", t1)

# ------------------------------------------------------- pass 2: the body case
MIDX = None
for side in ("L", "R"):
    base = dup(SRC["skin_" + side], "case_src_" + side)
    K.solidify(base, K.CASE_WALL)
    K.remesh(base, VOX_BIG)
    K.recalc(base)
    lo, hi = K.bbox_world(base)
    if MIDX is None:
        MIDX = (lo.x + hi.x) / 2.0
    for half in ("fore", "aft"):
        f = "integumental__skin-of-body__case-%s-%s" % (side, half)
        ob = dup(base, f)
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.bisect_plane(
            bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
            plane_co=(MIDX, 0, 0), plane_no=(1, 0, 0),
            clear_outer=(half == "aft"), clear_inner=(half == "fore"))
        bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if len(e.link_faces) == 1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(ob.data); bm.free()
        K.recalc(ob)
        t0 = K.min_thickness(ob)
        built[f] = dict(obj=ob, dev=[
            dict(objects=["skin_" + side], change="zero-thickness body shell solidified",
                 amount_mm=K.CASE_WALL,
                 reason="the source skin is a surface; this is the case wall"),
            dict(objects=["skin_" + side], change="split at mid-length and the cut capped",
                 amount_mm=None, reason="a %.0f mm half would not fit a 200 mm plate"
                 % (hi.x - lo.x))],
            min_wall_before=t0, min_wall_after=t0, missing=[])
        log("case ok", f, "minwall", t0)
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    bpy.ops.object.delete()

# ------------------------------------------------------- pass 3: the carriers
# children first need their pegs, so that the carrier knows where to drill.
pegged = {}
for f, b in list(built.items()):
    p = PARTS[f]
    if p["kind"] not in ("organ", "tissue"):
        continue
    r = add_peg(b["obj"], f)
    if r is None:
        fails.append(dict(part=f, why="could not find a bottom surface for the peg"))
        log("FAIL(peg)", f)
        continue
    b["obj"] = r["obj"]
    pegged[f] = r
    b["joinery"] = dict(peg_radius_mm=r["peg_r"], peg_length_mm=r["peg_h"],
                        peg_at=[round(r["x"], 2), round(r["y"], 2), round(r["z"], 2)])

carriers = [f for f, p in PARTS.items() if p["kind"] == "carrier"]
CARD_PARENT = {c["file"]: c["parent"] for c in plan["cards"]}
card_sock = {}

for f in carriers:
    p = PARTS[f]
    kids = [k for k in p["holds"] if k in pegged]
    cards_here = [k for k in p["holds"] if k in CARD_PARENT]
    if not kids:
        fails.append(dict(part=f, why="no seated children were built"))
        log("FAIL(carrier empty)", f)
        continue
    xs, ys, zs = [], [], []
    for k in kids:
        r = pegged[k]
        lo, hi = K.bbox_world(built[k]["obj"])
        xs += [lo.x, hi.x]; ys += [lo.y, hi.y]; zs.append(r["z"])
    # card sockets sit in a row along the plate's aft edge
    plate_top = min(zs) - 2.0
    x0, x1 = min(xs) - K.PLATE_MARGIN, max(xs) + K.PLATE_MARGIN
    y0, y1 = min(ys) - K.PLATE_MARGIN, max(ys) + K.PLATE_MARGIN
    if cards_here:
        y0 -= 16.0
    w, d = x1 - x0, y1 - y0
    plate = K.box(f, (w, d, K.PLATE_T),
                  ((x0 + x1) / 2.0, (y0 + y1) / 2.0, plate_top - K.PLATE_T / 2.0))
    bosses, sockets, marks = [], [], []
    boss_rec = []
    for k in kids:
        r = pegged[k]
        h = r["z"] - 0.2 - plate_top
        if h > 0.8:
            bosses.append(K.d_cylinder(f + "_boss_" + k, BOSS_R, h,
                                       (r["x"], r["y"], plate_top + h / 2.0),
                                       segments=20))
            boss_rec.append(dict(child=k, boss_height_mm=round(h, 2),
                                 boss_radius_mm=BOSS_R))
        else:
            boss_rec.append(dict(child=k, boss_height_mm=0.0, boss_radius_mm=None))
        top = max(r["z"] - 0.2, plate_top)
        depth = r["peg_h"] + K.DEPTH_CLEAR
        sockets.append(K.d_cylinder(f + "_sock_" + k, r["peg_r"] + K.CLEARANCE,
                                    depth * 2.0, (r["x"], r["y"], top - depth)))
        marks.append(K.index_triangle(f + "_mk_" + k,
                                      (r["x"] + r["peg_r"] + 3.0, r["y"], top + 0.3)))
    # card sockets
    cy = y0 + 8.0
    for i, cf in enumerate(cards_here):
        cx = x0 + 14.0 + i * 20.0
        depth = K.PEG_H + K.DEPTH_CLEAR
        sockets.append(K.d_cylinder(f + "_sock_card_" + str(i),
                                    K.PEG_R + K.CLEARANCE, depth * 2.0,
                                    (cx, cy, plate_top - depth)))
        marks.append(K.index_triangle(f + "_mk_card_" + str(i),
                                      (cx + K.PEG_R + 3.0, cy, plate_top + 0.3)))
        card_sock[cf] = dict(x=cx, y=cy, z=plate_top)
    # leg down to the case floor
    side = p["side"] if p["side"] in ("L", "R") else "L"
    casef = p["parent"]
    anchor_x = min(max((x0 + x1) / 2.0, x0 + 8), x1 - 8)
    anchor_y = -5.0 if side == "L" else 5.0
    leg_rec = None
    if casef in built:
        fz = inner_floor_z(built[casef]["obj"], anchor_x, anchor_y)
        if fz is not None and fz < plate_top - K.PLATE_T - 1.0:
            lh = (plate_top - K.PLATE_T) - fz + 1.0
            bosses.append(K.d_cylinder(f + "_leg", LEG_R, lh,
                                       (anchor_x, anchor_y,
                                        plate_top - K.PLATE_T - lh / 2.0 + 0.5),
                                       segments=20))
            leg_rec = dict(case_part=casef, leg_height_mm=round(lh, 2),
                           leg_radius_mm=LEG_R,
                           anchor=[round(anchor_x, 2), round(anchor_y, 2),
                                   round(fz, 2)])
    ob = K.join([plate] + bosses + marks, f)
    ok_all = True
    for s in sockets:
        if not K.boolean(ob, s, "DIFFERENCE"):
            ok_all = False
    c = guarantee(ob, VOX_SMALL)
    built[f] = dict(obj=ob, dev=[dict(objects=["<generated>"],
                    change="carrier plate generated, not derived from the mesh",
                    amount_mm=None,
                    reason="the source model has no organ-system geometry; the tray is "
                           "a printing fixture that expresses part_of containment, not "
                           "an anatomical structure")],
                    min_wall_before=K.PLATE_T, min_wall_after=K.PLATE_T, missing=[],
                    joinery=dict(plate_thickness_mm=K.PLATE_T, bosses=boss_rec,
                                 leg=leg_rec, sockets=len(sockets),
                                 all_sockets_cut=ok_all))
    log("carrier ok", f, "sockets", len(sockets), "bosses", len(boss_rec))
    if not ok_all:
        fails.append(dict(part=f, why="at least one socket boolean failed"))

# ----------------------------------------- pass 4: case sockets + midline pins
for f, p in PARTS.items():
    if p["kind"] != "case" or f not in built:
        continue
    case = built[f]["obj"]
    lo, hi = K.bbox_world(case)
    cut = []
    for cf in carriers:
        if cf not in built:
            continue
        lg = built[cf].get("joinery", {}).get("leg")
        if not lg or lg["case_part"] != f:
            continue
        ax, ay, az = lg["anchor"]
        depth = 4.0
        cut.append(K.d_cylinder(f + "_cs_" + cf, LEG_R + K.CLEARANCE, depth * 2.0,
                                (ax, ay, az - depth + 0.5)))
    # midline mating: pins on L, sockets on R, on the sagittal rim
    xs = [lo.x + (hi.x - lo.x) * t for t in (0.25, 0.55, 0.85)]
    add = []
    for i, x in enumerate(xs):
        zc = (lo.z + hi.z) / 2.0 + (hi.z - lo.z) * (0.15 if i % 2 else -0.15)
        if p["side"] == "L":
            pin = K.d_cylinder(f + "_pin_%d" % i, K.PEG_R, 7.0, (x, 0, zc))
            pin.rotation_euler = (math.radians(90), 0, 0)
            K.apply_transform(pin)
            pin.location = (x, -1.5, zc)
            K.apply_transform(pin)
            add.append(pin)
        else:
            s = K.d_cylinder(f + "_msk_%d" % i, K.PEG_R + K.CLEARANCE, 9.0, (x, 0, zc))
            s.rotation_euler = (math.radians(90), 0, 0)
            K.apply_transform(s)
            s.location = (x, 2.0, zc)
            K.apply_transform(s)
            cut.append(s)
    if add:
        case = K.join([case] + add, f)
    okc = True
    for s in cut:
        if not K.boolean(case, s, "DIFFERENCE"):
            okc = False
    c = guarantee(case, VOX_BIG)
    built[f]["obj"] = case
    built[f]["joinery"] = dict(
        carrier_sockets=len(cut) - (0 if p["side"] == "L" else 3),
        midline="3 keyed pins on the left half, 3 matching sockets on the right half, "
                "on the sagittal rim, so the bilateral halves mate on the midline",
        all_booleans_ok=okc)
    if not okc:
        fails.append(dict(part=f, why="at least one case boolean failed"))
    log("case joinery", f, "cuts", len(cut))

# ------------------------------------------------------------ export + verify
out = {}
for f, b in built.items():
    ob = b["obj"]
    path = os.path.join(OUTDIR, f + ".stl")
    nb = K.export_stl(ob, path)
    c = K.check(ob)
    lo, hi = K.bbox_world(ob)
    dims = [round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z - lo.z, 2)]
    mt = K.wall_stats(ob)
    p = PARTS[f]
    ok = c["watertight"] and c["no_inverted_normals"]
    if not ok:
        fails.append(dict(part=f, why="failed the watertight / normals check", checks=c))
    if max(dims) < K.MIN_FEATURE:
        fails.append(dict(part=f, why="longest dimension %.2f mm is under the %.1f mm "
                          "minimum feature size" % (max(dims), K.MIN_FEATURE)))
    out[f] = dict(file=f + ".stl", kind=p["kind"], system=p["system"], organ=p["organ"],
                  part=p["part"], level=p["level"], side=p.get("side"),
                  ontology_id=p.get("ontology_id"),
                  ontology_label=p.get("ontology_label"),
                  seats_into=p.get("parent"), holds=p.get("holds"),
                  source_objects=p["sources"], merged_from=p.get("merged_from"),
                  notes=p.get("notes"), deviations=b["dev"],
                  measured_wall_distribution=mt,
                  wall_p05_mm=(mt.get("p05") if mt and mt.get("samples",0)>=60 else None),
                  bbox_mm=dims, triangles=c["triangles"], bytes=nb,
                  volume_mm3=c["volume_mm3"], checks=c,
                  joinery=b.get("joinery"), passed=ok)
    log("exported", f, dims, "tris", c["triangles"], "ok", ok)

res = dict(scale=dict(print_standard_length_mm=SL, mm_per_model_unit=SCALE,
                      scale_factor_vs_life=SL / 38.8),
           parts=out, failures=fails, midx_mm=MIDX)
json.dump(res, open(os.path.join(OUTDIR, "_kit-structural.json"), "w"), indent=1)
log("DONE structural", len(out), "parts,", len(fails), "failures")
print("KIT_SUMMARY", json.dumps(dict(built=len(out), failures=len(fails))))
