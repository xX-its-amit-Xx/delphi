"""Structural verification of every parametric GLB against its manifest.

    python -I anatomy-model/parametric/verify.py

Checks, per file: the GLB container parses; every mesh node name matches the manifest piece list
exactly; node extras carry label / ontology_id / layer / side / organ_system / level; morph targets
are present on every mesh and named as the manifest says; the file is under 8 MB; and the builder's
own inside-check (no internal piece outside the skin, at any stage) came back clean.
"""
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
MODEL = os.path.join(REPO, "dashboard", "public", "blueprint3d", "model")
FILES = [("flying-fish-dev.glb", "flying-fish-dev-manifest.json"),
         ("zebrafish-dev.glb", "zebrafish-dev-manifest.json"),
         ("tff.glb", "tff-manifest.json"),
         ("winged-zebrafish.glb", "winged-zebrafish-manifest.json"),
         ("wingless-flying-fish.glb", "wingless-flying-fish-manifest.json"),
         ("ff-zf-chimera.glb", "ff-zf-chimera-manifest.json")]
LIMIT = 8 * 1024 * 1024


def read_gltf(path):
    with open(path, "rb") as fh:
        data = fh.read()
    magic, ver, total = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise RuntimeError("not a GLB")
    off, js, binlen = 12, None, 0
    while off < total:
        ln, ty = struct.unpack_from("<II", data, off)
        if ty == 0x4E4F534A:
            js = json.loads(data[off + 8:off + 8 + ln].decode("utf-8"))
        elif ty == 0x004E4942:
            binlen = ln
        off += 8 + ln + ((4 - ln % 4) % 4)
    if js is None:
        raise RuntimeError("no JSON chunk")
    return js, total, binlen, ver


def main():
    ok = True
    for glb, mf in FILES:
        gp, mp = os.path.join(MODEL, glb), os.path.join(MODEL, mf)
        print("=" * 70)
        print(glb)
        errs, warns = [], []
        g, total, binlen, ver = read_gltf(gp)
        man = json.load(open(mp, encoding="utf-8"))
        size = os.path.getsize(gp)
        print("  parses: glTF %d, %d bytes (%.2f MB), BIN %d bytes" % (ver, size, size / 1048576.0, binlen))
        if size > LIMIT:
            errs.append("over the 8 MB budget: %d bytes" % size)
        names = [n["name"] for n in g["nodes"] if "mesh" in n]
        mnames = [o["object"] for o in man["objects"]]
        if sorted(names) != sorted(mnames):
            errs.append("node names != manifest: +%s -%s" % (sorted(set(names) - set(mnames)),
                                                             sorted(set(mnames) - set(names))))
        else:
            print("  node names match the manifest: %d pieces" % len(names))
        need = ("label", "ontology_id", "layer", "side", "organ_system", "level")
        missing = [n["name"] for n in g["nodes"] if "mesh" in n
                   and any(f not in n.get("extras", {}) for f in need)]
        if missing:
            errs.append("%d nodes missing extras: %s" % (len(missing), missing[:4]))
        else:
            print("  every node carries %s" % ", ".join(need))
        want = [m["name"] for m in man["morph_targets"]]
        bad, nt = [], None
        for n in g["nodes"]:
            if "mesh" not in n:
                continue
            me = g["meshes"][n["mesh"]]
            tn = me.get("extras", {}).get("targetNames", [])
            cnt = len(me["primitives"][0].get("targets", []))
            if nt is None:
                nt = cnt
            if cnt != nt or tn != want:
                bad.append((n["name"], cnt, tn))
        if bad:
            errs.append("morph targets inconsistent on %d meshes, e.g. %s" % (len(bad), bad[:2]))
        else:
            print("  morph targets: %d on every mesh, named %s" % (nt, want))
        ic = man["inside_check"]["results"]
        dirty = {k: v for k, v in ic.items() if v}
        if dirty:
            errs.append("inside-check failures: %s" % dirty)
        else:
            print("  inside-check clean for all %d variants (%s)" % (len(ic), ", ".join(ic)))
        hyp = [o["object"] for o in man["objects"] if not o.get("hypothetical")]
        if man.get("hypothetical") and hyp:
            errs.append("%d pieces not marked hypothetical in a design: %s" % (len(hyp), hyp[:4]))
        elif man.get("hypothetical"):
            print("  all %d pieces marked hypothetical" % len(mnames))
        for e in errs:
            print("  FAIL:", e)
        for w in warns:
            print("  warn:", w)
        if errs:
            ok = False
        else:
            print("  OK")
    print("=" * 70)
    print("ALL PASS" if ok else "FAILURES PRESENT")
    return 0 if ok else 1


sys.exit(main())
