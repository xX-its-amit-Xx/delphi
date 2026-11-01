"""Structural verification of every parametric GLB against its manifest.

    python -I anatomy-model/parametric/verify.py

Checks, per file: the GLB container parses; every mesh node name matches the manifest piece list
exactly; node extras carry label / ontology_id / layer / side / organ_system / level; morph targets
are present on every mesh and named as the manifest says; the file is under 8 MB; and the builder's
own inside-check (no internal piece outside the skin, at any stage) came back clean.

Since generator 2.0.0 also (the "content" checks): the manifest carries manifest_version and
generator_version; its id names its own GLB; its MORPHOLOGICAL_NOT_GENETIC sentence fits its kind (a growth
series or a single-parent design must not carry the two-species chimera sentence); the aspect ratio is stored
under every named convention and they are mutually consistent; and when a growth series' adult stage and the
base set disagree in mass by more than 5%, adult_mass shows both with their roles.

    PARAMETRIC_MODEL_DIR=<dir> python -I verify.py     # run against a fixture directory instead
"""
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
MODEL = os.environ.get("PARAMETRIC_MODEL_DIR") or os.path.join(REPO, "dashboard", "public", "blueprint3d", "model")
CHIMERA_SENTENCE = "Flying fish and zebrafish are not crossable"
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


def content_checks(glb, man):
    errs = []
    for k in ("manifest_version", "generator_version"):
        if man.get(k) in (None, ""):
            errs.append("no %s (everything is modifiable only if versioned)" % k)
    want_id = os.path.splitext(glb)[0]
    if man.get("id") != want_id:
        errs.append("manifest id %r does not name its file %r" % (man.get("id"), want_id))
    cav = man.get("MORPHOLOGICAL_NOT_GENETIC") or ""
    nparents = len(man.get("parents") or [])
    stages = [t for t in man.get("morph_targets", []) if t.get("kind") == "stage"]
    if man.get("kind") == "reference" and stages:
        if CHIMERA_SENTENCE in cav or "GROWTH SERIES" not in cav:
            errs.append("growth-series manifest carries the wrong MORPHOLOGICAL_NOT_GENETIC sentence")
    elif nparents < 2 and CHIMERA_SENTENCE in cav:
        errs.append("single-parent manifest carries the two-species chimera sentence")
    elif nparents >= 2 and CHIMERA_SENTENCE not in cav:
        errs.append("multi-species blend lacks the chimera caveat")
    d = man.get("derived_from_the_mesh") or {}
    ab, one, f90, par = (d.get("span2_over_area_both"), d.get("aspect_ratio_one_fin"),
                         d.get("span2_over_wing_area_fish1990"), d.get("pectoral_aspect_ratio"))
    if None in (ab, one, f90):
        errs.append("aspect ratio not stored under every named convention")
    else:
        if par is not None and abs(par - ab) > 0.002:
            errs.append("pectoral_aspect_ratio %s != span2_over_area_both %s" % (par, ab))
        if abs(one - ab / 2.0) > 0.002:
            errs.append("aspect_ratio_one_fin %s != span2_over_area_both / 2" % one)
        if f90 > ab + 1e-9:
            errs.append("span2_over_wing_area_fish1990 exceeds span2_over_area_both (more area cannot raise AR)")
    base = next((t for t in man.get("morph_targets", []) if t.get("kind") == "resolved"), None)
    adult = [t for t in stages if t.get("stage") == "adult"]
    bm = (man.get("parameters") or {}).get("body_mass_kg")
    if adult and bm and adult[-1].get("mass_kg"):
        r = adult[-1]["mass_kg"] / bm
        am = man.get("adult_mass") or {}
        if abs(r - 1) > 0.05 and not (am.get("computed_here") and am.get("base_resolved_set")
                                      and am.get("growth_series_adult")):
            errs.append("adult stage mass is %.2fx the base mass and adult_mass does not show both with roles" % r)
    if base is not None and base.get("name") != "base_" + want_id:
        errs.append("base target %r is not base_<file id>" % base.get("name"))
    return errs


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
        errs.extend(content_checks(glb, man))
        if not errs:
            print("  content: versioned (manifest %s, generator %s), id '%s', caveat fits kind, AR conventions "
                  "consistent, adult mass reconciled" % (man.get("manifest_version"), man.get("generator_version"),
                                                         man.get("id")))
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
