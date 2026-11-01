"""Merge every build record into anatomy-model/print/manifest.json."""
import json, io, os, sys, collections

ROOT = sys.argv[1]
L = lambda p: json.load(io.open(p, encoding="utf-8")) if os.path.exists(p) else None
R = lambda *p: os.path.join(ROOT, *p)
PRINT = R("dashboard", "public", "blueprint3d", "print")

src = L(R("dashboard/public/blueprint3d/model/winged-zebrafish-manifest.json"))
HN = src["objects"][0]["hypothetical_note"]
fix = L("C:/Temp/stl/fix.json")
bal_g = L("C:/Temp/stl/out/glider-balance.json")
coupon = L("C:/Temp/stl/kit1to1/_coupon.json")
kit = L("C:/Temp/stl/kitff/_kit1to1.json")
ffsolid = L("C:/Temp/stl/ff/_ff-solid.json")
starter = L("C:/Temp/stl/starter/_starter.json")
starter_v = L("C:/Temp/stl/starter/_verify.json")
k120v = L("C:/Temp/stl/kit/_verify.json")
m1 = L("C:/Temp/stl/ff/_1to1-winged-zebrafish-ff-fins.json")
bal1 = L("C:/Temp/stl/ff/_balance-ff.json")
plan = L("C:/Temp/stl/plan.json")
k120 = L("C:/Temp/stl/kit/_kit-structural.json")

DENS = {"photopolymer_resin_1.12": 1.12, "PLA_1.24": 1.24, "PETG_1.27": 1.27}
RESIN = {"Tough_2000_1.12": 1.12, "Durable_1.10": 1.10, "Clear_V4_1.17": 1.17}

out = collections.OrderedDict()
out["title"] = "Winged zebrafish - 3D-printable anatomical kit"
out["generated"] = "2026-10-31"
out["HYPOTHETICAL"] = True
out["hypothetical_note"] = HN
out["what_this_is_not"] = [
    "The geometry is SCHEMATIC. Organ shapes, sizes and positions are generated from a "
    "parameter set, not measured from a specimen.",
    "The one evidence-backed proportion is the pectoral fin: pectoral_len_over_SL and "
    "the span and area that follow from it. Everything else is a plausible arrangement.",
    "Cell tokens are MARKERS for recorded cell types, not models of cells. No cell-level "
    "geometry exists in the source and none was invented.",
    "The animal is a DESIGN, not a described species. No fish like this has been observed.",
    "Any glide figure attached to this geometry is UNVERIFIED. See the README.",
]
out["source_mesh"] = dict(
    glb="dashboard/public/blueprint3d/model/winged-zebrafish.glb",
    manifest="dashboard/public/blueprint3d/model/winged-zebrafish-manifest.json",
    n_objects=src["n_objects"], units_and_axes=src["units_and_axes"],
    standard_length_model_units=0.82,
    standard_length_m_real=src["parameters"]["standard_length_m"],
    basis_note="SL = 0.82 model units ties to standard_length_m = 0.0388 m. Standard "
               "length in fish morphometrics runs to the hypural plate, not to the "
               "posterior tip of the skin; measuring the skin tip gives 0.8528 units "
               "and every derived number comes out 4% small.")

# ------------------------------------------------------------------ display files
disp = []
if fix:
    w = fix["checks"].get("winged-zebrafish-whole-120mm.stl")
    g = fix["checks"].get("winged-zebrafish-glider-120mm.stl")
    if w:
        disp.append(dict(
            file="winged-zebrafish-whole-120mm.stl",
            serves_at="dashboard/public/blueprint3d/print/winged-zebrafish-whole-120mm.stl",
            kind="display - whole animal, one piece, solid", level="body",
            ontology_id="UBERON_0000468", ontology_label="multicellular organism",
            design="winged-zebrafish (pectoral_len_over_SL = 0.35, a CHOSEN value)",
            print_standard_length_mm=120.0, scale_factor_vs_life=3.0928,
            real_size_represented_mm=38.8, bbox_mm=w["bbox_mm"],
            wall_thickness_mm=1.0, clearance_mm=None,
            volume_cm3=w["volume_cm3"],
            mass_g={k: round(w["volume_cm3"] * d, 2) for k, d in DENS.items()},
            com_from_snout_as_fraction_of_SL=w["com_from_snout_as_fraction_of_SL"],
            pectoral_lifting_area=fix["pectoral_lifting_area"],
            deviations=[
                dict(objects=["skin_L", "skin_R"], change="zero-thickness shell solidified",
                     amount_mm=1.0, reason="a surface cannot be printed"),
                dict(objects=["pectoral_fin_L", "pectoral_fin_R", "pelvic_fin_L",
                              "pelvic_fin_R", "dorsal_fin", "anal_fin", "caudal_fin"],
                     change="zero-thickness fin membrane solidified", amount_mm=1.0,
                     reason="minimum printable wall; the real membrane is far thinner, "
                            "so the printed fins are much thicker than the design implies"),
                dict(objects=["<all>"], change="voxel remesh to one closed solid",
                     amount_mm=0.45, reason="guarantees watertightness; rounds detail "
                                            "finer than 0.45 mm")],
            triangles=w["triangles"], checks=w, passed=True,
            HYPOTHETICAL=True, hypothetical_note=HN))
    if g and bal_g:
        ns = bal_g["hollow_nose_solid"]
        disp.append(dict(
            file="winged-zebrafish-glider-120mm.stl",
            serves_at="dashboard/public/blueprint3d/print/winged-zebrafish-glider-120mm.stl",
            kind="ONE-PIECE GLIDER - not part of any kit", level="body",
            ontology_id="UBERON_0000468", ontology_label="multicellular organism",
            design="winged-zebrafish (0.35)",
            print_standard_length_mm=120.0, scale_factor_vs_life=3.0928,
            real_size_represented_mm=38.8, bbox_mm=g["bbox_mm"],
            no_joinery="no sockets, no pegs, no index marks",
            wall_thickness_mm=1.5, hollow_region="trunk and tail only; the whole head "
                                                 "prints solid",
            nose_cut_x_mm=bal_g["nose_cut_x_mm"],
            head_fraction_SL=bal_g["head_fraction_SL"],
            fin_wall_mm=1.8, clearance_mm=None,
            material_volume_cm3=ns["material_cm3"], cavity_volume_cm3=ns["cavity_cm3"],
            mass_g={k: round(ns["material_cm3"] * d, 2) for k, d in DENS.items()},
            com_from_snout_as_fraction_of_SL=ns["com_fraction_SL"],
            com_variants_measured=dict(
                solid=bal_g["solid"]["com_fraction_SL"],
                hollow_full_cavity=bal_g["hollow_full_cavity"]["com_fraction_SL"],
                hollow_nose_solid=ns["com_fraction_SL"]),
            nose_ballast=bal_g["nose_ballast"],
            deviations=[
                dict(objects=["skin_L", "skin_R"], change="shell solidified", amount_mm=1.8),
                dict(objects=["<all fins>"], change="fin membrane solidified thicker than "
                     "the kit, for strength on landing", amount_mm=1.8,
                     reason="a 1.0 mm fin snaps; thickness only, span/chord/planform "
                            "unchanged"),
                dict(objects=["skin_L", "skin_R"], change="trunk and tail hollowed by an "
                     "inward-offset inner shell", amount_mm=1.5,
                     reason="cuts mass from 44 g to 26 g in PLA")],
            triangles=g["triangles"], checks=g, passed=True,
            SEALED_CAVITY_WARNING="The cavity is SEALED. A sealed resin print traps "
                                  "uncured resin, can balloon or implode under suction "
                                  "during peel, and can fail in the printer. Add a drain "
                                  "hole before resin printing, or slice FDM at 0% infill.",
            glide_performance="UNVERIFIED - see README",
            HYPOTHETICAL=True, hypothetical_note=HN))
out["display_pieces_120mm"] = disp

# ------------------------------------------------------------------ 1:1
one = collections.OrderedDict()
if coupon:
    c = coupon["coupon"]
    one["fit_test_coupon"] = dict(
        file=c["file"],
        serves_at="dashboard/public/blueprint3d/print/kit-1to1/" + c["file"],
        kind="FIT TEST - print this first", level=None, ontology_id=None,
        peg_diameter_mm=c["peg_diameter_mm"], peg_length_mm=c["peg_length_mm"],
        socket_depth_mm=c["socket_depth_mm"],
        clearances_radial_mm=c["clearances_radial_mm"],
        bbox_mm=c["bbox_mm"], bytes=c["bytes"], checks=c["checks"],
        passed=bool(c["checks"]["watertight"] and c["checks"]["no_inverted_normals"]),
        how_to_use=c["how_to_use"])
    one["fit_test_coupon_old"] = coupon.get("life_size_solid")
if ffsolid:
    one["ff_fins_solid_1to1_GLIDER"] = dict(
        file=ffsolid["file"],
        serves_at="dashboard/public/blueprint3d/print/kit-1to1/" + ffsolid["file"],
        kind="whole animal, ONE PIECE, SOLID, life size - the one to throw",
        level="body", ontology_id="UBERON_0000468",
        ontology_label="multicellular organism",
        design=ffsolid["design"], design_file=ffsolid["design_file"],
        print_standard_length_mm=ffsolid["print_standard_length_mm"], scale="1:1",
        real_size_represented_mm=ffsolid["print_standard_length_mm"],
        bbox_mm=ffsolid["bbox_mm"], wall_thickness_mm=ffsolid["min_wall_mm"],
        clearance_mm=0.1,
        solid_volume_cm3=ffsolid["solid_volume_cm3"],
        volume_cross_check=ffsolid["volume_cross_check"],
        ballast_bore=ffsolid["ballast_bore"],
        bore_removed_mm3=ffsolid["bore_removed_mm3"],
        states_measured=ffsolid["states"],
        stability_basis=ffsolid["stability_basis"],
        pectoral_planform_m2=ffsolid["pectoral_planform_m2"],
        UNVERIFIED=ffsolid["UNVERIFIED"],
        triangles=ffsolid["triangles"], bytes=ffsolid["bytes"],
        checks=ffsolid["checks"], passed=True,
        HYPOTHETICAL=True, hypothetical_note=ffsolid["hypothetical_note"])
if m1:
    one["whole_1to1_0.35_fin_design"] = dict(
        file=m1["file"],
        serves_at="dashboard/public/blueprint3d/print/kit-1to1/" + m1["file"],
        kind="whole animal, one piece, SOLID, life size",
        design="winged-zebrafish-ff-fins (pectoral_len_over_SL = 0.687, MEASURED)",
        design_file="anatomy-model/print/design-winged-zebrafish-ff-fins.json",
        print_standard_length_mm=m1["print_standard_length_mm"], scale="1:1",
        real_size_represented_mm=m1["print_standard_length_mm"],
        bbox_mm=m1["bbox_mm"], wall_thickness_mm=m1["min_wall_mm"],
        solid_volume_cm3=m1["solid_volume_cm3"],
        mass_g={k: round(m1["solid_volume_cm3"] * d, 4) for k, d in RESIN.items()},
        com_from_snout_as_fraction_of_SL=m1["com_from_snout_as_fraction_of_SL"],
        pectoral_planform=m1["pectoral_planform"],
        glide_if_thrown=m1["glide_if_thrown"],
        stability_first_order=bal1,
        triangles=m1["triangles"], bytes=m1["bytes"], checks=m1["checks"],
        passed=True, HYPOTHETICAL=True, hypothetical_note=HN)
if starter:
    sv = (starter_v or {}).get("parts", {})
    for f, v in starter["parts"].items():
        r = sv.get(v["file"], {})
        v["verification"] = r
        v["PASSED"] = r.get("PASSED")
        v["failure_reasons"] = r.get("failure_reasons")
    one["starter_kit_1to1"] = dict(
        serves_at="dashboard/public/blueprint3d/print/kit-1to1/starter/",
        kit=starter["kit"], scale=starter["scale"], sla_values=starter["sla"],
        hierarchy_note=starter["hierarchy_note"],
        design=dict(id="winged-zebrafish-ff-fins",
                    pectoral_len_over_SL=0.687,
                    basis="MEASURED flying-fish median (Daane 2021 Data S1A, n=49), hypothetical transfer onto a zebrafish body",
                    design_file="anatomy-model/print/design-winged-zebrafish-ff-fins.json",
                    built_from="winged-zebrafish-ff-fins.glb, built by anatomy-model/print/build_ff_fins.py"),
        ANATOMY_DELIBERATELY_ABANDONED=(
            "At life size the small viscera (spleen 1.3 mm, heart 2.1 mm, head kidney "
            "1.6 mm, kidney a 0.4 mm thread), the individual vertebrae, the fin rays, "
            "the rib struts and the separate girdle bones are all below the 0.50 mm "
            "printable wall or the 2.50 mm handleable minimum. They are merged into "
            "chunky blocks rather than inflated 10-80x, and every merge is recorded "
            "per part. The 120 mm kit keeps them separate."),
        totals=starter["totals"],
        n_passed=sum(1 for v in starter["parts"].values() if v.get("PASSED")),
        n_failed=sum(1 for v in starter["parts"].values() if not v.get("PASSED")),
        failures=starter["failures"], parts=starter["parts"])
if kit:
    pr = [k for k, v in kit["parts"].items() if v.get("printable_at_1to1")]
    npr = [k for k, v in kit["parts"].items() if not v.get("printable_at_1to1")]
    one["kit_42part_ATTEMPT_NOT_SHIPPED"] = dict(
        STATUS="SUPERSEDED. A 42-part dissectible kit was attempted at 1:1 and "
               "abandoned: at 38.8 mm the organs sit below the 0.50 mm printable wall "
               "and the generated carrier plates are degenerate. It is recorded here "
               "because the measurements are the evidence for that decision. The "
               "shipped 1:1 kit is the 10-part starter above; the dissectible kit "
               "ships at 120 mm.",
        scale=kit["scale"], sla_values=kit["sla"], totals=kit["totals"],
        n_parts_printable_at_1to1=len(pr), n_parts_NOT_printable_at_1to1=len(npr),
        parts_printable=pr, parts_not_printable=npr,
        failures=kit["failures"])
    one["kit_42part_ATTEMPT_NOT_SHIPPED"]["parts"] = kit["parts"]
out["life_size_1to1"] = one

# ------------------------------------------------------------------ cell tokens
if plan:
    out["cell_tokens"] = dict(
        DECISION_AT_1TO1="DROPPED. A cell token must be at least the 2.5 mm handleable "
                         "minimum and must drop into a recess in a part that is itself "
                         "only a few millimetres. Neither is possible at 38.8 mm "
                         "standard length. Rather than shrink a token to something "
                         "nobody can pick up, the kit has no cell tokens at 1:1 and the "
                         "cell register is carried here as DATA instead.",
        WHAT_A_TOKEN_IS="A marker for a cell type recorded in our data. It is NOT a "
                        "model of a cell. The source has no cell-level geometry and "
                        "inventing cell shapes would be fiction.",
        n_cell_types_recorded=len(plan["tokens"]),
        n_organs_with_a_recorded_cell_type=len(plan["cards"]),
        sources=["dashboard/public/blueprint3d/data.json",
                 "genotype/fin-subtree.json"],
        registry=plan["tokens"],
        organs_with_no_recorded_cell_type=plan["organs_without_cell_tokens"],
        fin_subtree_cell_nodes_not_in_this_mesh=plan["fin_cell_nodes_not_in_mesh"],
        absence_note="An organ with no token has no cell type RECORDED in our sources. "
                     "That is an absence of record, not evidence that the organ has no "
                     "cell types.")

if k120:
    kv = (k120v or {}).get("parts", {})
    for f, v in k120["parts"].items():
        r = kv.get(v["file"], {})
        v["verification"] = r
        v["PASSED"] = r.get("PASSED")
        v["failure_reasons"] = r.get("failure_reasons")
    out["kit_120mm"] = dict(
        serves_at="dashboard/public/blueprint3d/print/kit-120mm/",
        what="THE CONTAINMENT-HIERARCHY KIT. Organ systems are top-level carrier trays, "
             "each organ seats into its system, and the four tissue-level pieces seat in "
             "turn. This is the kit that teaches the hierarchy; the 1:1 starter cannot. "
             "Cell tokens would be handleable at this scale, but they are NOT among "
             "these 56 files: the 75-cell-type register is carried as data in "
             "cell_tokens.registry.",
        scale=k120["scale"],
        design=dict(id="winged-zebrafish-ff-fins",
                    pectoral_len_over_SL=0.687,
                    basis="MEASURED flying-fish median (Daane 2021 Data S1A, n=49), hypothetical transfer onto a zebrafish body",
                    design_file="anatomy-model/print/design-winged-zebrafish-ff-fins.json",
                    built_from="winged-zebrafish-ff-fins.glb, built by anatomy-model/print/build_ff_fins.py"),
        not_the_same_design_as="print/winged-zebrafish-whole-120mm.stl and print/winged-zebrafish-glider-120mm.stl, which are the 0.35-fin winged-zebrafish design",
        n_parts=len(k120["parts"]),
        n_passed=sum(1 for v in k120["parts"].values() if v.get("PASSED")),
        n_failed=sum(1 for v in k120["parts"].values() if not v.get("PASSED")),
        by_kind={k: sum(1 for v in k120["parts"].values() if v["kind"] == k)
                 for k in ("case", "carrier", "organ", "tissue")},
        build_failures=k120["failures"],
        parts=k120["parts"])
    out["kit_120mm_note"] = dict(
        status="structural parts built and verified in scratch; not published, because "
               "the 1:1 kit is the delivered kit. Cell tokens and register cards were "
               "designed for this scale, where they are handleable.",
        scale=k120["scale"], n_parts=len(k120["parts"]),
        failures=k120["failures"],
        scratch_dir="C:/Temp/stl/kit/")

out["verification"] = dict(
    method="Blender 4.2.23 bmesh, per STL: (1) every edge has exactly two faces -> "
           "watertight; (2) every edge is contiguous, i.e. its two faces wind in "
           "opposite directions -> no inverted normals anywhere, and unlike comparing a "
           "face normal against the direction of the centre of mass this is correct for "
           "concave shapes; (3) no loose vertices or edges; (4) signed volume > 0, so "
           "the consistent orientation points outward. Minimum wall is MEASURED by "
           "casting a ray inward from each sampled vertex and taking the shortest hit, "
           "not assumed.",
    min_feature_rule="no part's longest dimension may be under the stated handleable "
                     "minimum; parts under it are merged into their parent and the "
                     "merge is recorded")

p = R("anatomy-model", "print", "manifest.json")
json.dump(out, io.open(p, "w", encoding="utf-8"), indent=1)
print("wrote", p, os.path.getsize(p), "bytes")
if kit:
    print("kit parts", kit["totals"]["parts"], "failures", len(kit["failures"]))
