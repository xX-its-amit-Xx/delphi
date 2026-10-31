"""Diff the parametric builder's faithful flying-fish reproduction against the committed GLB.

    python -I anatomy-model/parametric/diff_refactor.py NEW.glb [OUT.json]

Compares node names, per-node vertex counts and node translations between
dashboard/public/blueprint3d/model/flying-fish.glb (built by anatomy-model/build_fish.py) and the
GLB the parametric builder produces from the 'flying-fish' reference parameter set.
Dependency-free: reads the glTF JSON chunk out of the GLB container directly.
"""
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
REF = os.path.join(REPO, "dashboard", "public", "blueprint3d", "model", "flying-fish.glb")


def read_gltf(path):
    with open(path, "rb") as fh:
        data = fh.read()
    magic, ver, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "not a GLB: %s" % path
    off = 12
    while off < total:
        ln, ty = struct.unpack_from("<II", data, off)
        if ty == 0x4E4F534A:
            return json.loads(data[off + 8:off + 8 + ln].decode("utf-8")), total
        off += 8 + ln + ((4 - ln % 4) % 4)
    raise RuntimeError("no JSON chunk")


def summarise(path):
    g, total = read_gltf(path)
    acc = g.get("accessors", [])
    out = {}
    for n in g.get("nodes", []):
        if "mesh" not in n:
            continue
        m = g["meshes"][n["mesh"]]
        nv = sum(acc[p["attributes"]["POSITION"]]["count"] for p in m["primitives"])
        tgt = []
        for p in m["primitives"]:
            tgt = ["%d targets" % len(p.get("targets", []))] if p.get("targets") else []
        out[n["name"]] = {
            "vertices": nv,
            "translation": [round(v, 5) for v in n.get("translation", [0, 0, 0])],
            "extras": n.get("extras", {}),
            "targets": len(m["primitives"][0].get("targets", [])),
            "targetNames": m.get("extras", {}).get("targetNames", []),
        }
    return out, total, g


def main():
    new_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "refactor-diff.json")
    A, sa, ga = summarise(REF)
    B, sb, gb = summarise(new_path)
    na, nb = set(A), set(B)
    added = sorted(nb - na)
    removed = sorted(na - nb)
    common = sorted(na & nb)
    vdiff = [{"node": k, "committed_vertices": A[k]["vertices"], "parametric_vertices": B[k]["vertices"]}
             for k in common if A[k]["vertices"] != B[k]["vertices"]]
    tdiff = []
    for k in common:
        da = A[k]["translation"]
        db = B[k]["translation"]
        d = max(abs(x - y) for x, y in zip(da, db))
        if d > 1e-4:
            tdiff.append({"node": k, "committed": da, "parametric": db, "max_axis_delta": round(d, 6)})
    edel = []
    for k in common:
        ea, eb = A[k]["extras"], B[k]["extras"]
        for f in ("label", "ontology_id", "layer", "side", "organ_system", "level"):
            if ea.get(f) != eb.get(f):
                edel.append({"node": k, "field": f, "committed": ea.get(f), "parametric": eb.get(f)})
    res = {
        "committed": {"file": os.path.relpath(REF, REPO).replace("\\", "/"), "bytes": sa, "nodes": len(A)},
        "parametric_faithful": {"file": new_path.replace("\\", "/"), "bytes": sb, "nodes": len(B)},
        "verdict": ("FAITHFUL: identical piece list" if not added and not removed else
                    "piece list differs: %d added, %d removed" % (len(added), len(removed))),
        "pieces_added": added,
        "pieces_removed": removed,
        "pieces_identical_in_name": len(common),
        "node_translation_differences": tdiff,
        "node_vertex_count_differences": vdiff,
        "node_extras_differences": edel,
        "notes": [
            "The faithful run uses mesh_detail = 1.0 and keeps the solidify modifiers, so vertex counts "
            "are directly comparable with the committed model.",
            "The committed model carries a procedural scale normal map image; the parametric builder "
            "drops it (it is a texture, not geometry), which is the whole byte-size difference.",
            "Morph-target builds necessarily differ: mesh_detail is 0.62 and solidify is off, because "
            "Blender cannot apply a modifier to a mesh that carries shape keys.",
        ],
    }
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1)
    print(json.dumps({k: v for k, v in res.items() if k != "node_vertex_count_differences"}, indent=1))
    print("vertex-count differences:", len(vdiff))
    for v in vdiff[:12]:
        print("  ", v)


main()
