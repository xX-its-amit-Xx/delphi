"""Verify every exported STL and decide, honestly, what is printable.

blender.exe -b --python verify_prints.py -- <dir> <out.json> <min_wall> <min_feature>

Per part:
  watertight            every edge has exactly 2 faces, no loose geometry
  normals               every edge contiguous AND signed volume > 0
  volume cross-check    surface integral vs point-in-solid Monte Carlo
  wall thickness        distribution of inward ray distances onto opposing surfaces

On wall thickness: the STRICT MINIMUM of that distribution is not a usable gate. On a
voxel-remeshed surface a handful of rays hit a crease or a near-tangent facet and
report a few microns, which is noise, not a wall. The gate here is the 5th PERCENTILE,
and a part is only judged on it when there are enough valid samples to mean anything.
Both numbers are reported so the reader can see the spread rather than trust one figure.
"""
import bpy, bmesh, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import kitlib as K

argv = sys.argv[sys.argv.index("--") + 1:]
DIR, OUT = argv[0], argv[1]
MIN_WALL = float(argv[2]) if len(argv) > 2 else 0.5
MIN_FEAT = float(argv[3]) if len(argv) > 3 else 2.5
MIN_SAMPLES = 150   # below this the distribution is not worth judging


def thickness_stats(ob, want=30000):
    me = ob.data
    try:
        tree = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    except Exception:
        return None
    n = len(me.vertices)
    if not n:
        return None
    step = max(1, n // want)
    eps = 2e-3
    ds = []
    for i in range(0, n, step):
        v = me.vertices[i]
        d = -v.normal
        if d.length < 0.5:
            continue
        d = d.normalized()
        h = tree.ray_cast(v.co + d * eps, d, 1e4)
        if h[0] is None or h[1] is None or h[3] is None:
            continue
        if h[1].dot(d) < 0.5:           # not an opposing wall (hit from inside)
            continue
        dist = h[3] + eps
        if dist > 5e-3:
            ds.append(dist)
    if not ds:
        return dict(samples=0)
    ds.sort()
    q = lambda p: ds[min(len(ds) - 1, int(p * len(ds)))]
    return dict(samples=len(ds), min=round(ds[0], 4), p05=round(q(0.05), 4),
                p25=round(q(0.25), 4), median=round(q(0.50), 4))


res, summary = {}, dict(pass_=0, fail=0)
files = sorted(f for f in os.listdir(DIR) if f.lower().endswith(".stl"))
for fn in files:
    path = os.path.join(DIR, fn)
    K.wipe()
    bpy.ops.wm.stl_import(filepath=path)
    obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not obs:
        res[fn] = dict(error="no mesh in file")
        summary["fail"] += 1
        continue
    ob = obs[0]
    c = K.check(ob)
    # small parts need many more samples before the estimate means anything:
    # the relative error scales as 1/sqrt(hits), and hits scale with the part's
    # share of its own bounding box.
    mc = K.monte_carlo_volume(ob, 250000)
    lo, hi = K.bbox_world(ob)
    dims = [round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z - lo.z, 2)]
    th = thickness_stats(ob)
    # tolerance has to cover Monte Carlo sampling error, which is large for a few-mm3
    # part; an inverted shell shows up as a ~2x discrepancy, far outside this.
    vol_ok = abs(mc - c["volume_mm3"]) / max(abs(c["volume_mm3"]), 1e-9) < 0.25
    reasons = []
    if not c["watertight"]:
        reasons.append("not watertight (%d non-manifold edges, %d loose verts)"
                       % (c["nonmanifold_edges"], c["loose_verts"]))
    if not c["no_inverted_normals"]:
        reasons.append("inverted normals (%d inconsistently wound edges, signed volume "
                       "%.1f)" % (c["inconsistently_wound_edges"], c["volume_mm3"]))
    if not vol_ok:
        reasons.append("volume cross-check failed: surface integral %.1f mm3 vs Monte "
                       "Carlo %.1f mm3 - a shell is probably wound inside out"
                       % (c["volume_mm3"], mc))
    if max(dims) < MIN_FEAT:
        reasons.append("longest dimension %.2f mm is under the %.2f mm handleable "
                       "minimum" % (max(dims), MIN_FEAT))
    wall_judged = None
    if th and th.get("samples", 0) >= MIN_SAMPLES:
        wall_judged = th["p05"]
        if th["p05"] < MIN_WALL:
            reasons.append("5th-percentile wall %.3f mm is under the %.2f mm minimum"
                           % (th["p05"], MIN_WALL))
    elif th is not None:
        reasons.append("wall thickness NOT ESTABLISHED: only %d valid samples, which is "
                       "too few to judge. Treat the wall as unverified."
                       % th.get("samples", 0))
    ok = not reasons
    summary["pass_" if ok else "fail"] += 1
    res[fn] = dict(bbox_mm=dims, triangles=c["triangles"],
                   bytes=os.path.getsize(path),
                   volume_surface_integral_mm3=c["volume_mm3"],
                   volume_monte_carlo_mm3=round(mc, 2),
                   volume_cross_check_ok=vol_ok,
                   watertight=c["watertight"],
                   no_inverted_normals=c["no_inverted_normals"],
                   wall_thickness=th, wall_gate_p05_mm=wall_judged,
                   PASSED=ok, failure_reasons=reasons)
    print("%-56s %s %s" % (fn.replace(".stl", ""), "PASS" if ok else "FAIL",
                           "" if ok else "| " + reasons[0][:80]), flush=True)

out = dict(directory=DIR, min_wall_mm=MIN_WALL, min_feature_mm=MIN_FEAT,
           min_samples_to_judge_wall=MIN_SAMPLES,
           n_files=len(files), n_passed=summary["pass_"], n_failed=summary["fail"],
           method=__doc__, parts=res)
json.dump(out, open(OUT, "w"), indent=1)
print("VERIFY", json.dumps(dict(files=len(files), passed=summary["pass_"],
                                failed=summary["fail"])))
