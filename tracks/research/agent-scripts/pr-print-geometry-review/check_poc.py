#!/usr/bin/env python3
"""Check the five proof-of-concept objects in bm-poc-designs.json against Formlabs
print limits read on 2026-11-13.  One command, no network, standard library only:

    python -I check_poc.py [path/to/bm-poc-designs.json]

Writes violations.tsv and limits_used.tsv next to this script and prints a summary.
Every limit carries its source URL and whether the page was OPENED today or is SNIPPET-only.
The object geometry is transcribed from the 'table' rows of the designs file; each
transcribed dimension string is asserted to be present in that row, so a change in
the designs file makes this script stop instead of silently checking stale numbers.
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT = "D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/research/agents/bm-poc-designs.json"

O, S = "opened", "snippet-only"
# name: (value, unit, status, source, note)
LIMITS = {
 "form4_build_mm": ((200.0, 125.0, 210.0), "mm", O, "https://formlabs.com/3d-printers/resin/tech-specs/", "20.0 x 12.5 x 21.0 cm"),
 "form4l_build_mm": ((353.0, 196.0, 350.0), "mm", O, "https://formlabs.com/3d-printers/form-4l/", ""),
 "form4_layer_min_mm": (0.025, "mm", O, "https://formlabs.com/3d-printers/resin/tech-specs/", "25-200 um, resin dependent"),
 "form4_layer_max_mm": (0.200, "mm", O, "https://formlabs.com/3d-printers/resin/tech-specs/", ""),
 "elastomer_layer_min_mm": (0.100, "mm", "prior-agent (not re-opened)", "bm-poc-designs.json finding 12 (product pages)", "Flexible 50A, Silicone 40A minimum layer 100 um"),
 "generic_wall_mm": (0.2, "mm", O, "https://formlabs.com/support/Design-specifications-for-3D-models-Form-4-generation/", "Grey V5 at 50 um; '0.2 mm or less may warp' so 0.2 itself is AT the limit"),
 "generic_span_mm": (29.0, "mm", O, "https://formlabs.com/support/Design-specifications-for-3D-models-Form-4-generation/", "5 mm wide x 3 mm thick rigid beam"),
 "generic_clearance_mm": (0.4, "mm", O, "https://formlabs.com/support/Design-specifications-for-3D-models-Form-4-generation/", ""),
 "f80v2_wall_mm": (1.5, "mm", O, "https://now.formlabs.com/resources/flexible-80a-resin", "Form Now service guide for Flexible 80A V2, supported and unsupported; conservative"),
 "f80v1_wall_sup_min_mm": (0.4, "mm", O, "https://formlabs.com/support/Using-Flexible-80A-Resin-V1/", "V1 page; no V2 design table found on the support site"),
 "f80v1_wall_unsup_min_mm": (0.6, "mm", O, "https://formlabs.com/support/Using-Flexible-80A-Resin-V1/", "V1 page"),
 "f50_wall_sup_min_mm": (0.4, "mm", O, "https://formlabs.com/global/support/Using-Elastic-Resin/", "Flexible 50A = Elastic 50A V2 renamed; recommended 0.6"),
 "f50_wall_unsup_min_mm": (0.6, "mm", O, "https://formlabs.com/global/support/Using-Elastic-Resin/", "recommended 0.8"),
 "f50_span_max_mm": (0.6, "mm", O, "https://formlabs.com/global/support/Using-Elastic-Resin/", "horizontal span/bridge maximum 600 um"),
 "f50_clearance_mm": (1.0, "mm", O, "https://formlabs.com/global/support/Using-Elastic-Resin/", "between adjacent parts"),
 "f50_isolated_support_max_mm": (20.0, "mm", O, "https://formlabs.com/global/support/Using-Elastic-Resin/", ""),
 "si40_wall_unsup_mm": (0.7, "mm", O, "https://formlabs.com/support/Using-Silicone-40A-Resin/", "unsupported thin walls thinner than 0.7 mm not recommended"),
 "si40_aspect_max": (8.0, "ratio", O, "https://formlabs.com/support/Using-Silicone-40A-Resin/", "height:thickness when printed perpendicular to the platform"),
 "fuse_build_mm": ((165.0, 165.0, 300.0), "mm", O, "https://formlabs.com/3d-printers/fuse-1/tech-specs/", "Fuse 1+ 30W"),
 "fuse_tpu_part_max_mm": ((161.2, 161.2, 295.0), "mm", O, "https://formlabs.com/support/Design-specifications-for-3D-models-Fuse-1/", "TPU 90A largest part"),
 "pa12_wall_vertical_mm": (0.6, "mm", O, "https://formlabs.com/support/Design-specifications-for-3D-models-Fuse-1/", "horizontal walls 0.3"),
 "pa12_wall_service_mm": (0.8, "mm", O, "https://now.formlabs.com/resources/nylon-12-sls", "Form Now guide, conservative"),
 "tpu_wall_mm": (1.0, "mm", O, "https://now.formlabs.com/resources/tpu-90a-sls", ""),
 "sls_hole_mm": (1.0, "mm", O, "https://formlabs.com/support/Design-specifications-for-3D-models-Fuse-1/", ""),
}

A80, P50, PSI = "Flexible 80A V2", "Flexible 50A", "Silicone 40A"
# (object, part, resin, L, w, t, free_sheet, must_contain_in_table_row)
PARTS = []
def add(obj, part, resin, L, w, t, token):
    PARTS.append(dict(obj=obj, part=part, resin=resin, L=L, w=w, t=t, token=token))

add(1, "active layer", A80, 30, 3, 0.4, "active=0.4 mm Flexible 80A V2")
add(1, "passive layer A", P50, 30, 3, 0.6, "passive=0.6 mm Flexible 50A")
add(1, "passive layer B", PSI, 30, 3, 0.6, "Silicone 40A (pair B)")
for a in (0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8):           # ratio ladder, total 1.0 mm
    add(2, "ratio ladder active %.1f" % a, A80, 30, 3, a, "active 0.2/0.3/0.4/0.5/0.6/0.7/0.8 mm")
    add(2, "ratio ladder passive %.1f" % (1 - a), P50, 30, 3, round(1 - a, 2), "ratio ladder at h=1.0 mm")
for tot, a in ((0.5, 0.2), (1.0, 0.4), (1.5, 0.6), (2.0, 0.8)):   # thickness ladder
    add(2, "thickness ladder active %.1f (total %.1f)" % (a, tot), A80, 30, 3, a, "total 0.5/1.0/1.5/2.0 mm (active 0.2/0.4/0.6/0.8)")
    add(2, "thickness ladder passive %.1f (total %.1f)" % (tot - a, tot), P50, 30, 3, round(tot - a, 2), "total 0.5/1.0/1.5/2.0 mm (active 0.2/0.4/0.6/0.8)")
for w in (3, 6, 12, 24, 60):
    add(3, "tile w=%d active" % w, A80, 60, w, 0.4, "0.4 mm Flexible 80A V2 + 0.6 mm Flexible 50A")
    add(3, "tile w=%d passive" % w, P50, 60, w, 0.6, "width {3, 6, 12, 24, 60} mm")
for name, L, w, a, p, tok in (("trunk", 50, 3, 0.8, 1.2, "trunk 50 x 3 x 2.0 mm (0.8+1.2)"),
                              ("branch", 25, 2.5, 0.4, 0.6, "2 branches 25 x 2.5 x 1.0 mm (0.4+0.6)"),
                              ("twig", 12.5, 1.5, 0.2, 0.3, "4 twigs 12.5 x 1.5 x 0.5 mm (0.2+0.3)")):
    add(4, name + " active", A80, L, w, a, tok)
    add(4, name + " passive", P50, L, w, p, tok)
add(5, "blade active", A80, 120, 9, 1.2, "3 blades 120 x 9 x 3.0 mm (1.2 mm Flexible 80A V2 + 1.8 mm passive)")
add(5, "blade passive", P50, 120, 9, 1.8, "3 blades 120 x 9 x 3.0 mm (1.2 mm Flexible 80A V2 + 1.8 mm passive)")

FOOTPRINTS = {1: (30, 3), 2: (70, 42), 3: (60, 60), 4: (87.5, 60), 5: (150, 60)}  # obj4: 50+25+12.5 chain length; width is an upper guess
GAPS = {2: ("comb finger gap = pitch 6 - width 3", 3.0, "pitch 6 mm"), 5: ("blade gap = pitch 20 - width 9", 11.0, "pitch 20 mm")}

EPS = 1e-9
def lim(k): return LIMITS[k][0]

def check_part(p):
    out = []
    t, r = p["t"], p["resin"]
    def v(rule, key, relation, sev):
        out.append((p["obj"], p["part"], r, rule, t, relation, lim(key), LIMITS[key][2], sev, LIMITS[key][3]))
    if t <= lim("generic_wall_mm") + EPS:
        v("Form 4 generic wall (Grey V5, 50 um): 0.2 mm or less may warp or detach", "generic_wall_mm", "<=", "HARD")
    if r == A80:
        if t < lim("f80v2_wall_mm") - EPS:
            v("Flexible 80A V2 Form Now minimum wall (supported and unsupported)", "f80v2_wall_mm", "<", "SERVICE-RULE")
        if t < lim("f80v1_wall_sup_min_mm") - EPS:
            v("Flexible 80A V1 supported-wall minimum (no V2 table on support site)", "f80v1_wall_sup_min_mm", "<", "HARD")
        elif t < lim("f80v1_wall_unsup_min_mm") - EPS:
            v("Flexible 80A V1 unsupported-wall minimum (a free sheet is unsupported)", "f80v1_wall_unsup_min_mm", "<", "AT-RISK")
    if r == P50:
        if t < lim("f50_wall_sup_min_mm") - EPS:
            v("Flexible 50A supported-wall minimum", "f50_wall_sup_min_mm", "<", "HARD")
        elif t < lim("f50_wall_unsup_min_mm") - EPS:
            v("Flexible 50A unsupported-wall minimum", "f50_wall_unsup_min_mm", "<", "AT-RISK")
    if r == PSI:
        if t < lim("si40_wall_unsup_mm") - EPS:
            v("Silicone 40A: unsupported walls thinner than 0.7 mm not recommended", "si40_wall_unsup_mm", "<", "HARD")
        if p["L"] / t > lim("si40_aspect_max"):
            out.append((p["obj"], p["part"], r, "Silicone 40A aspect ratio if printed upright (L/t); print flat or tilted instead",
                        round(p["L"] / t, 1), ">", lim("si40_aspect_max"), LIMITS["si40_aspect_max"][2], "ORIENTATION", LIMITS["si40_aspect_max"][3]))
    # layer quantisation at the elastomer minimum layer
    n = t / lim("elastomer_layer_min_mm")
    if abs(n - round(n)) > 1e-6:
        out.append((p["obj"], p["part"], r, "thickness not a multiple of the 0.1 mm elastomer layer", t, "mod", 0.1, LIMITS["elastomer_layer_min_mm"][2], "HARD", LIMITS["elastomer_layer_min_mm"][3]))
    elif round(n) <= 3:
        out.append((p["obj"], p["part"], r, "sheet is only %d printed layers at 0.1 mm (thickness error of one layer = %d %%)" % (round(n), round(100 / round(n))),
                    t, "layers", round(n), LIMITS["elastomer_layer_min_mm"][2], "AT-RISK", LIMITS["elastomer_layer_min_mm"][3]))
    return out

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    rows = [t for t in d["table"] if t["name"].startswith("Object ")]
    assert len(rows) == 5, "expected five Object rows, found %d" % len(rows)
    fields = {int(t["name"].split()[1]): t["fields"] for t in rows}
    for p in PARTS:
        assert p["token"] in fields[p["obj"]], "designs file changed: %r not in object %d" % (p["token"], p["obj"])
    for o, (_, _, tok) in GAPS.items():
        assert tok in fields[o], "designs file changed: %r" % tok

    viol = []
    for p in PARTS:
        viol += check_part(p)
    passes = []
    bx, by, bz = lim("form4_build_mm")
    for o, (x, y) in FOOTPRINTS.items():
        ok = x <= bx and y <= by
        passes.append((o, "footprint %g x %g mm vs Form 4 %g x %g" % (x, y, bx, by), "PASS" if ok else "FAIL"))
    fx, fy, fz = lim("fuse_build_mm")
    passes.append((5, "frame about 150 x 60 mm vs Fuse 1+ 30W %g x %g x %g" % (fx, fy, fz), "PASS" if 150 <= fx and 60 <= fy else "FAIL"))
    for o, (name, gap, _) in GAPS.items():
        passes.append((o, "%s = %g mm vs Flexible 50A adjacent-part clearance %g" % (name, gap, lim("f50_clearance_mm")), "PASS" if gap >= lim("f50_clearance_mm") else "FAIL"))
    # every flat strip exceeds the elastomer bridge limit -> cannot be printed as an unsupported span
    for o in (1, 2, 3, 4, 5):
        L = max(p["L"] for p in PARTS if p["obj"] == o)
        viol.append((o, "all strips (length up to %g mm)" % L, P50, "Flexible 50A horizontal span/bridge maximum: strips must sit on the platform or on dense supports, never bridge",
                     L, ">", lim("f50_span_max_mm"), LIMITS["f50_span_max_mm"][2], "ORIENTATION", LIMITS["f50_span_max_mm"][3]))
    unspecified = [
        (5, "frame wall thickness, hole/slot sizes and blade-clamp clearance are not given in the designs file; cannot be checked (Nylon 12 needs wall >= 0.6 vertical / 0.8 service, holes >= 1.0, mating clearance 0.2-0.4 mm)"),
        (0, "no embossed/engraved label, hole or drain hole is specified on any object; nothing to check"),
        (0, "the designs file gives nominal bars only: no mesh, no orientation, no support plan, no fillets at the comb spine or Y-junctions"),
    ]

    hdr = ["object", "part", "resin", "rule", "design_value", "relation", "limit", "limit_status", "severity", "limit_source"]
    with open(os.path.join(HERE, "violations.tsv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n"); w.writerow(hdr); w.writerows(viol)
    with open(os.path.join(HERE, "limits_used.tsv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n"); w.writerow(["limit", "value", "unit", "status", "source", "note"])
        for k, (val, unit, st, src, note) in LIMITS.items():
            w.writerow([k, val, unit, st, src, note])

    print("violations: %d rows -> violations.tsv" % len(viol))
    sev = {}
    for r in viol:
        sev[(r[0], r[8])] = sev.get((r[0], r[8]), 0) + 1
    for o in (1, 2, 3, 4, 5):
        print("object %d: " % o + ", ".join("%s=%d" % (s, sev.get((o, s), 0)) for s in ("HARD", "AT-RISK", "SERVICE-RULE", "ORIENTATION")))
    print("\nHARD violations (below a published minimum):")
    for r in viol:
        if r[8] == "HARD":
            print("  obj %d | %s | %s | %g %s %g | %s" % (r[0], r[1], r[2], r[4], r[5], r[6], r[3]))
    print("\nchecks that pass:")
    for o, s, res in passes:
        print("  obj %d | %s | %s" % (o, s, res))
    print("\nnot checkable:")
    for o, s in unspecified:
        print("  obj %s | %s" % (o or "all", s))
    hard = sum(1 for r in viol if r[8] == "HARD")
    print("\nTOTAL hard=%d at-risk=%d service-rule=%d orientation=%d" % (
        hard, sum(1 for r in viol if r[8] == "AT-RISK"), sum(1 for r in viol if r[8] == "SERVICE-RULE"),
        sum(1 for r in viol if r[8] == "ORIENTATION")))

if __name__ == "__main__":
    main()
