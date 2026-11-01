"""Decimate finished STLs to a sane size for a web-served folder, then clean them.

A 40 mm part does not need 260,000 triangles: the voxel remesh that guarantees
watertightness also tessellates every flat face to death. Decimation here is purely a
file-size measure and must not change the shape, so the volume is re-measured after and
a part whose volume moves by more than 0.5% is written back at full resolution.

blender.exe -b --python finalize.py -- <dir> <max_tris>
"""
import bpy, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kitlib as K

argv = sys.argv[sys.argv.index("--") + 1:]
DIR = argv[0]
CAP = int(argv[1]) if len(argv) > 1 else 24000

rep = {}
for fn in sorted(f for f in os.listdir(DIR) if f.lower().endswith(".stl")):
    path = os.path.join(DIR, fn)
    before_bytes = os.path.getsize(path)
    K.wipe()
    bpy.ops.wm.stl_import(filepath=path)
    ob = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
    v0, _ = K.volume_com(ob)
    c0 = K.check(ob)
    if c0["triangles"] <= CAP:
        rep[fn] = dict(skipped=True, triangles=c0["triangles"], bytes=before_bytes)
        print("%-56s keep  %6d tris" % (fn, c0["triangles"]), flush=True)
        continue
    K.planar_decimate(ob, 1.0)           # collapse coplanar faces first: free, exact
    c1 = K.check(ob)
    if c1["triangles"] > CAP:
        K.ratio_decimate(ob, CAP)
    K.cleanup(ob)
    K.fix_orientation(ob)
    v1, _ = K.volume_com(ob)
    c2 = K.check(ob)
    drift = abs(v1 - v0) / max(abs(v0), 1e-9)
    ok = (c2["watertight"] and c2["no_inverted_normals"] and drift < 0.005)
    if not ok:
        # decimation hurt it: put the original back untouched
        K.wipe()
        bpy.ops.wm.stl_import(filepath=path)
        ob = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
        K.cleanup(ob)
        K.fix_orientation(ob)
        c2 = K.check(ob)
        rep[fn] = dict(reverted=True, reason="decimation broke the mesh or moved its "
                       "volume by %.2f%%" % (drift * 100), triangles=c2["triangles"])
        print("%-56s REVERT %6d tris (drift %.2f%%)" % (fn, c2["triangles"],
                                                        drift * 100), flush=True)
    else:
        rep[fn] = dict(triangles_before=c0["triangles"], triangles_after=c2["triangles"],
                       volume_drift_pct=round(drift * 100, 4))
    nb = K.export_stl(ob, path)
    rep[fn]["bytes_before"] = before_bytes
    rep[fn]["bytes_after"] = nb
    if not rep[fn].get("reverted") and not rep[fn].get("skipped"):
        print("%-56s %6d -> %6d tris   %5.1f -> %5.1f MB" %
              (fn, c0["triangles"], c2["triangles"], before_bytes / 1e6, nb / 1e6),
              flush=True)

tot = sum(v.get("bytes_after", v.get("bytes", 0)) for v in rep.values())
json.dump(dict(dir=DIR, cap=CAP, total_bytes=tot, parts=rep),
          open(os.path.join(DIR, "_finalize.json"), "w"), indent=1)
print("FINALIZE", json.dumps(dict(files=len(rep), total_mb=round(tot / 1e6, 2))))
