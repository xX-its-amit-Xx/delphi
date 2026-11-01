"""Build the winged-zebrafish-ff-fins GLB with the project's own parametric builder.

This injects a design defined in THIS folder into the parametric resolver at runtime.
Nothing under anatomy-model/parametric/ is modified or written to; that code is read
and used as a library, and the output goes wherever --glb points (C:\\Temp for us).

  blender.exe -b --python anatomy-model/print/build_ff_fins.py -- \\
      --design anatomy-model/print/design-winged-zebrafish-ff-fins.json \\
      --glb C:/Temp/stl/ff/winged-zebrafish-ff-fins.glb --no-render
"""
import sys, os, json, runpy

HERE = os.path.dirname(os.path.abspath(__file__))
ANAT = os.path.dirname(HERE)
PARAM = os.path.join(ANAT, "parametric")
sys.path.insert(0, PARAM)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def _arg(flag, default=None):
    return argv[argv.index(flag) + 1] if flag in argv else default


DESIGN = _arg("--design", os.path.join(HERE, "design-winged-zebrafish-ff-fins.json"))
spec = json.load(open(DESIGN, encoding="utf-8"))
DID = spec.get("id") or "winged-zebrafish-ff-fins"

import params as PRM  # noqa: E402

if DID in PRM.DESIGNS:
    raise SystemExit("refusing to shadow an existing design id: %s" % DID)

# the resolver only needs the generative fields; the rest of the file is provenance
PRM.DESIGNS[DID] = {
    "name": spec["name"],
    "kind": "design",
    "hypothetical": True,
    "parents": spec["parents"],
    "deltas": spec["deltas"],
    "falls_out": spec.get("falls_out", []),
    "real_experimental_counterpart": spec.get("real_experimental_counterpart"),
    "caveat_morphological_not_genetic": spec["caveat_morphological_not_genetic"],
}
print("[ff-fins] injected design", DID, "->", spec["deltas"]["pectoral_len_over_SL"]["value"])

res = PRM.resolve(DID)
print("[ff-fins] resolved pectoral_len_over_SL =",
      res["parameters"]["pectoral_len_over_SL"])
print("[ff-fins] resolved pectoral_span_over_SL =",
      res["parameters"]["pectoral_span_over_SL"])
print("[ff-fins] resolved pectoral_area_over_SL2 =",
      res["parameters"]["pectoral_area_over_SL2"])

# hand control to the project's builder, with our organism id
glb = _arg("--glb", os.path.join("C:\\Temp", "stl", "ff", DID + ".glb"))
os.makedirs(os.path.dirname(glb), exist_ok=True)
new = ["--organism", DID, "--glb", glb,
       "--manifest", os.path.splitext(glb)[0] + "-manifest.json"]
if "--no-render" in argv:
    new.append("--no-render")
if "--detail" in argv:
    new += ["--detail", _arg("--detail")]
sys.argv = [sys.argv[0], "--"] + new
runpy.run_path(os.path.join(PARAM, "build.py"), run_name="__main__")
