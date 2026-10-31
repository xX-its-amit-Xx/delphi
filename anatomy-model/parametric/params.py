"""Parameter schema, reference organisms, designs and the chimera resolver.

Pure Python (no bpy, no numpy): importable from Blender and from plain python.

    python anatomy-model/parametric/params.py --dump     # write organisms/, designs/, resolved/, design-schema.json
    python anatomy-model/parametric/params.py --show tff # print one resolved set

THE GENERATIVE MODEL
--------------------
Every organism is either a REFERENCE (every parameter is a literal value with a kind and a
source) or a DESIGN:

    parameters = SUM over parents ( weight_i * parent_i.parameter ) + delta

with the weights summing to 1 and `delta` the explicit novel part.  The resolver records, for
every single parameter, which parents contributed at which weights and whether a delta moved
it, so the manifest can be read parameter by parameter.

THE HARD CAVEAT (repeated in every manifest, README and schema)
---------------------------------------------------------------
This is MORPHOLOGICAL interpolation, not genetic hybridisation.  Averaging two species' body
parameters says nothing about whether such an animal could be bred, is viable, or is
developmentally reachable; genomes do not average.  Flying fish and zebrafish are not
crossable.  A weighted blend is never a "hybrid" without that sentence next to it.
"""
import json
import os
import math

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

CAVEAT = ("MORPHOLOGICAL interpolation, not genetic hybridisation. Averaging two species' body "
          "parameters says nothing about whether such an animal could be bred, is viable, or is "
          "developmentally reachable; genomes do not average. Flying fish and zebrafish are not "
          "crossable. This is a shape, not an organism.")

KINDS = ("measured", "derived", "assumed", "hypothetical", "secondary")

# ---------------------------------------------------------------------------- schema
# key -> (unit, what it drives in the mesh, blend rule)
SCHEMA = {
    "standard_length_m":        ("m", "real-world standard length; sets the metres-per-model-unit scale", "arithmetic"),
    "body_mass_kg":             ("kg", "wet mass; with flight_muscle_fraction sets the girdle muscle volume", "arithmetic"),
    "body_depth_over_SL":       ("-", "maximum body depth / SL (full depth, not half)", "arithmetic"),
    "body_width_over_SL":       ("-", "maximum body width / SL (full width)", "arithmetic"),
    "body_section_exponent":    ("-", "superellipse exponent of the trunk cross-section (2 = ellipse)", "arithmetic"),
    "head_fraction_SL":         ("-", "fraction of SL over which the snout rounds off", "arithmetic"),
    "peduncle_depth_frac":      ("-", "caudal peduncle depth / maximum body depth", "arithmetic"),
    "peduncle_width_frac":      ("-", "caudal peduncle width / maximum body width", "arithmetic"),
    "pectoral_len_over_SL":     ("-", "longest pectoral fin ray, base to tip, / SL", "arithmetic"),
    "pectoral_span_over_SL":    ("-", "pectoral tip-to-tip span / SL (both fins, across the body)", "arithmetic"),
    "pectoral_area_over_SL2":   ("-", "membrane area of BOTH pectoral fins / SL^2 (the Park & Choi / physics-flier convention)", "arithmetic"),
    "pectoral_ray_count":       ("count", "lepidotrichia per pectoral fin (one named mesh each)", "round"),
    "pelvic_len_over_SL":       ("-", "longest pelvic fin ray / SL", "arithmetic"),
    "pelvic_ray_count":         ("count", "rays per pelvic fin", "round"),
    "dorsal_height_over_SL":    ("-", "tallest dorsal fin ray / SL", "arithmetic"),
    "dorsal_ray_count":         ("count", "dorsal fin rays", "round"),
    "anal_height_over_SL":      ("-", "tallest anal fin ray / SL", "arithmetic"),
    "anal_ray_count":           ("count", "anal fin rays", "round"),
    "caudal_upper_lobe_over_SL": ("-", "upper caudal lobe length / SL", "arithmetic"),
    "caudal_lower_lobe_over_SL": ("-", "lower caudal lobe length / SL", "arithmetic"),
    "caudal_ray_count":         ("count", "caudal fin rays", "round"),
    "vertebra_count":           ("count", "vertebrae (one named mesh each)", "round"),
    "myomere_count":            ("count", "trunk myomeres per side", "round"),
    "flight_muscle_fraction":   ("-", "pectoral/girdle muscle mass / body mass; sets the VOLUME of "
                                      "pectoral_muscle_L/R, so it visibly thickens the girdle musculature", "arithmetic"),
    "mesh_detail":              ("-", "global mesh resolution multiplier (1.0 = the committed flying-fish detail)", "min"),
}

# derived, never set directly; recomputed from the mesh after it is built
DERIVED = {
    "pectoral_aspect_ratio":    "pectoral_span^2 / (area of ONE pectoral fin), the Park & Choi 2010 convention",
    "lifting_area_m2":          "pectoral (both) + pelvic (both) + caudal membrane area, the physics/flier convention",
    "wing_loading_N_m2":        "body_mass * 9.81 / lifting_area_m2",
    "caudal_lobe_asymmetry":    "caudal_lower_lobe_over_SL / caudal_upper_lobe_over_SL (1 = homocercal-looking)",
    "flight_muscle_volume_m3":  "flight_muscle_fraction * body_mass / 1060 kg/m3 (teleost muscle density, assumed)",
}

# ---------------------------------------------------------------------------- sources
S_DAANE = ("Daane JM et al. 2021 Curr Biol doi:10.1016/j.cub.2021.08.054 Data S1A, flying-fish group "
           "median of 49 museum specimens, recomputed in genotype/cache/daane2021_fin_ratios.json")
S_PC = ("Park H & Choi H 2010 (physics/allometry.json, physics/flier/design.py src.real_fish): "
        "Cypselurus hiraii model L3, SL 0.203 m, mass 0.060 kg, pectoral span 0.261 m, pectoral "
        "area 0.006377 m2, pectoral aspect ratio 9.0-10.7")
S_SCHEM = "schematic (textbook-generic teleost); not a flying-fish or zebrafish measurement"
S_ZF_PAR = ("Parichy DM et al. 2009 Dev Dyn Table 3 regressions / FishBase morphometrics, via "
            "development/zebrafish/trajectory.mjs proportions()")
S_ZF_VERT = "anatomy-model/zebrafish/sources.json vertebrae_total (ZFIN / zebrafish anatomy literature)"


def p(value, kind, source, note=None):
    d = {"value": value, "kind": kind, "source": source}
    if note:
        d["note"] = note
    return d


# ---------------------------------------------------------------------------- reference organisms
REFERENCES = {
    "flying-fish": {
        "name": "flying fish with enlarged pectoral fins (Exocoetidae), generic",
        "kind": "reference",
        "reproduces": "anatomy-model/build_fish.py / dashboard/public/blueprint3d/model/flying-fish.glb",
        "trajectory": "development/trajectory.mjs",
        "parameters": {
            "standard_length_m":        p(0.203, "measured", S_PC, "the Park & Choi L3 specimen; the committed "
                                          "flying-fish.glb is dimensionless, SL = 0.82 model units"),
            "body_mass_kg":             p(0.060, "measured", S_PC),
            "body_depth_over_SL":       p(0.170, "assumed", S_SCHEM, "2 * 0.085, the committed model's half-depth"),
            "body_width_over_SL":       p(0.136, "assumed", S_SCHEM, "2 * 0.068"),
            "body_section_exponent":    p(2.30, "assumed", S_SCHEM),
            "head_fraction_SL":         p(0.20, "assumed", S_SCHEM),
            "peduncle_depth_frac":      p(0.30, "assumed", S_SCHEM),
            "peduncle_width_frac":      p(0.35, "assumed", S_SCHEM),
            "pectoral_len_over_SL":     p(0.687, "measured", S_DAANE, "the ONE evidence-backed proportion in the model"),
            "pectoral_span_over_SL":    p(1.2857, "measured", S_PC, "0.261 m / 0.203 m"),
            "pectoral_area_over_SL2":   p(0.15475, "measured", S_PC, "0.006377 m2 / 0.203 m^2"),
            "pectoral_ray_count":       p(14, "assumed", S_SCHEM + "; no flying-fish ray count fetched"),
            "pelvic_len_over_SL":       p(0.22, "assumed", S_SCHEM + "; Daane Data S1A has pelvic/SL (median 0.42 for "
                                          "flying fish) but the committed model did not use it"),
            "pelvic_ray_count":         p(6, "assumed", S_SCHEM),
            "dorsal_height_over_SL":    p(0.10, "assumed", S_SCHEM),
            "dorsal_ray_count":         p(12, "assumed", S_SCHEM),
            "anal_height_over_SL":      p(0.085, "assumed", S_SCHEM),
            "anal_ray_count":           p(11, "assumed", S_SCHEM),
            "caudal_upper_lobe_over_SL": p(0.19, "assumed", S_SCHEM),
            "caudal_lower_lobe_over_SL": p(0.27, "assumed", S_SCHEM + "; hypocercal (lower lobe longer) IS a real "
                                           "exocoetid character, the 0.27/0.19 numbers are not measured"),
            "caudal_ray_count":         p(19, "assumed", S_SCHEM),
            "vertebra_count":           p(40, "assumed", S_SCHEM + "; not a flying-fish count"),
            "myomere_count":            p(32, "assumed", S_SCHEM),
            "flight_muscle_fraction":   p(0.040, "assumed", "NO measured pectoral-muscle mass fraction exists for any "
                                          "flying fish in the fetched sources (physics/flier/tff/tff.json: 'no fish "
                                          "value exists'). 0.04 is a placeholder so the parameter has a baseline; it "
                                          "is the weakest number in this set."),
            "mesh_detail":              p(0.62, "derived", "chosen so one GLB with 6 morph targets stays under 8 MB"),
        },
    },
    "zebrafish-adult": {
        "name": "zebrafish (Danio rerio), adult",
        "kind": "reference",
        "reproduces": "NOT the 189-piece anatomy-model/zebrafish/build_adult.py; this is the same generic-teleost "
                      "parametric body plan driven by zebrafish measurements, at lower detail. The detailed "
                      "zebrafish-adult.glb remains the anatomical reference.",
        "trajectory": "development/zebrafish/trajectory.mjs",
        "parameters": {
            "standard_length_m":        p(0.0388, "measured", "development/zebrafish/trajectory.mjs at(180 d); "
                                          "von Bertalanffy fit, Parichy 2009 + FishBase"),
            "body_mass_kg":             p(0.0006943, "derived", "Beaudouin 2015 ln W(mg) = -5.24 + 3.22 ln SL(mm), "
                                          "extrapolated above 15 mm"),
            "body_depth_over_SL":       p(0.2535, "measured", S_ZF_PAR, "FishBase morphometrics 0.25-0.257"),
            "body_width_over_SL":       p(0.135, "assumed", S_SCHEM + "; no zebrafish width/SL fetched"),
            "body_section_exponent":    p(2.10, "assumed", S_SCHEM),
            "head_fraction_SL":         p(0.231, "measured", S_ZF_PAR, "head_SL 0.225-0.237"),
            "peduncle_depth_frac":      p(0.38, "assumed", S_SCHEM),
            "peduncle_width_frac":      p(0.40, "assumed", S_SCHEM),
            "pectoral_len_over_SL":     p(0.155, "assumed", "NO fetched source measures pectoral length / SL in a "
                                          "wild-type zebrafish (genotype/compare-2x2.json panel A: 'NOT MEASURED IN "
                                          "ANY FETCHED SOURCE'). 0.155 is an assumed placeholder read off the "
                                          "needlefish-halfbeak end of the Daane series; it is NOT a zebrafish datum."),
            "pectoral_span_over_SL":    p(0.42, "assumed", S_SCHEM + "; follows the assumed fin length"),
            "pectoral_area_over_SL2":   p(0.016, "assumed", S_SCHEM + "; follows the assumed fin length"),
            "pectoral_ray_count":       p(12, "secondary", "zebrafish pectoral lepidotrichia ~11-13 (anatomy "
                                          "literature via anatomy-model/zebrafish/sources.json)"),
            "pelvic_len_over_SL":       p(0.13, "assumed", S_SCHEM),
            "pelvic_ray_count":         p(6, "secondary", "zebrafish pelvic rays 6-7"),
            "dorsal_height_over_SL":    p(0.16, "assumed", S_SCHEM),
            "dorsal_ray_count":         p(8, "secondary", "zebrafish dorsal rays 6-8"),
            "anal_height_over_SL":      p(0.14, "assumed", S_SCHEM),
            "anal_ray_count":           p(13, "secondary", "zebrafish anal rays 12-14"),
            "caudal_upper_lobe_over_SL": p(0.215, "assumed", S_SCHEM + "; zebrafish caudal is homocercal and forked"),
            "caudal_lower_lobe_over_SL": p(0.215, "assumed", S_SCHEM + "; equal lobes = homocercal"),
            "caudal_ray_count":         p(18, "secondary", "zebrafish principal caudal rays ~18"),
            "vertebra_count":           p(32, "measured", S_ZF_VERT),
            "myomere_count":            p(32, "derived", "set equal to the vertebra count (schematic link, as in "
                                          "anatomy-model/zebrafish/build_adult.py)"),
            "flight_muscle_fraction":   p(0.012, "assumed", "no zebrafish pectoral-muscle mass fraction fetched; a "
                                          "small placeholder for an ordinary-finned teleost"),
            "mesh_detail":              p(0.62, "derived", "as flying-fish"),
        },
    },
    "zebrafish-larva": {
        "name": "zebrafish (Danio rerio), larva at 5 days post-fertilisation",
        "kind": "reference",
        "reproduces": "NOT anatomy-model/zebrafish/build_larva.py (58 pieces); same note as zebrafish-adult.",
        "trajectory": "development/zebrafish/trajectory.mjs",
        "parameters": {
            "standard_length_m":        p(0.0042, "measured", "development/zebrafish/trajectory.mjs at(3 d) = 5 dpf; "
                                          "Parichy 2009 larval rate 0.32 mm/day from 3.4 mm at Pec-fin"),
            "body_mass_kg":             p(5.385e-7, "measured", "Beaudouin 2015 fit, within its <=15 mm range"),
            "body_depth_over_SL":       p(0.1491, "measured", S_ZF_PAR, "depthAtNape_SL at 4.2 mm SL"),
            "body_width_over_SL":       p(0.105, "assumed", S_SCHEM),
            "body_section_exponent":    p(2.00, "assumed", S_SCHEM),
            "head_fraction_SL":         p(0.2511, "measured", S_ZF_PAR),
            "peduncle_depth_frac":      p(0.55, "assumed", S_SCHEM + "; larval body tapers less"),
            "peduncle_width_frac":      p(0.55, "assumed", S_SCHEM),
            "pectoral_len_over_SL":     p(0.075, "measured", "development/zebrafish/trajectory.mjs: at 4.2 mm SL the "
                                          "pectoral is a larval fin (endoskeletal disc + fin fold, NO rays) "
                                          "(Hale 2014; Grandel 1998; Lalonde 2018). The 0.075 extent is assumed; the "
                                          "ABSENCE OF RAYS is measured."),
            "pectoral_span_over_SL":    p(0.22, "assumed", S_SCHEM),
            "pectoral_area_over_SL2":   p(0.006, "assumed", S_SCHEM),
            "pectoral_ray_count":       p(0, "measured", "no lepidotrichia below 6.4 mm SL (Lalonde & Akimenko 2018 "
                                          "Fig. 8); rays appear at 6.4 mm, numbered by 6.8 mm"),
            "pelvic_len_over_SL":       p(0.0, "measured", "pelvic bud milestone PB is passed at 7.2 mm SL "
                                          "(Parichy 2009 Table 4): absent at 4.2 mm"),
            "pelvic_ray_count":         p(0, "measured", "as above"),
            "dorsal_height_over_SL":    p(0.05, "measured", "median fin FOLD only; DR (dorsal ray) milestone at "
                                          "6.2 mm SL (Parichy 2009)"),
            "dorsal_ray_count":         p(0, "measured", "Parichy 2009 Table 4 milestone DR not yet passed"),
            "anal_height_over_SL":      p(0.05, "measured", "median fin fold; AR milestone at 5.8 mm SL"),
            "anal_ray_count":           p(0, "measured", "milestone AR not yet passed"),
            "caudal_upper_lobe_over_SL": p(0.10, "measured", "caudal fin fold, CR milestone (caudal rays) at 4.5 mm "
                                           "SL; at 4.2 mm the notochord tip is only beginning to flex (FLe 4.5 mm)"),
            "caudal_lower_lobe_over_SL": p(0.10, "measured", "symmetric larval fin fold"),
            "caudal_ray_count":         p(0, "measured", "CR milestone not yet passed at 4.2 mm SL"),
            "vertebra_count":           p(32, "secondary", "the full complement of somites is segmented by hatching; "
                                          "centra ossify later. Kept at 32 so the larva shares a topology with the adult."),
            "myomere_count":            p(32, "secondary", "as above"),
            "flight_muscle_fraction":   p(0.002, "assumed", "no girdle muscle measured; near-zero placeholder"),
            "mesh_detail":              p(0.62, "derived", "as flying-fish"),
        },
    },
}

# ---------------------------------------------------------------------------- designs
# delta forms:  {"value": x, ...}  sets absolutely     {"scale": k, ...}  multiplies the blend
DESIGNS = {
    "tff": {
        "name": "TFF v2 - HYPOTHETICAL truly flying fish",
        "kind": "design",
        "hypothetical": True,
        "spec": "physics/flier/tff/tff.json (v2) and physics/flier/design.py",
        "fit_span_area": True,
        "body_plan_statement": "The body plan is the flying fish's, with the spec's wing area, span and "
                               "flight-muscle fraction applied. Nothing here is anatomy: no such animal has "
                               "been described, dissected or measured. EVERY piece is hypothetical.",
        "parents": [{"organism": "flying-fish", "weight": 1.0}],
        "deltas": {
            "pectoral_span_over_SL": {"scale": 0.66442 / 0.261, "reason":
                "TFF span 0.66442 m (= sqrt(9 * W / 12), physics/flier/design.py) over the real fish's measured "
                "0.261 m (Park & Choi L3). Body SL unchanged, so the span RATIO carries the whole change.",
                "evidence": "hypothetical"},
            "pectoral_area_over_SL2": {"scale": 0.04905 / 0.012688, "reason":
                "lifting area 0.04905 m2 at wing loading 12 N/m2 over the real reference area 0.012688 m2. The "
                "multiplier is applied to EVERY lifting surface (pectoral, pelvic, caudal) so the TOTAL lifting "
                "area hits the spec and the surfaces keep their measured proportions.",
                "evidence": "hypothetical"},
            "pelvic_len_over_SL": {"scale": math.sqrt(0.04905 / 0.012688), "reason":
                "same area multiplier, taken on the linear dimension (sqrt), so the pelvic planform scales with the rest",
                "evidence": "hypothetical"},
            "caudal_upper_lobe_over_SL": {"scale": math.sqrt(0.04905 / 0.012688), "reason": "as pelvic", "evidence": "hypothetical"},
            "caudal_lower_lobe_over_SL": {"scale": math.sqrt(0.04905 / 0.012688), "reason": "as pelvic", "evidence": "hypothetical"},
            "flight_muscle_fraction": {"value": 0.16, "reason":
                "physics/flier/tff/tff.json tff.muscle.fraction = 0.16, aerobic (red) flight muscle. Above the bat "
                "mean 0.0913 (PMC10966098); no fish value exists.",
                "evidence": "hypothetical"},
        },
        "falls_out": ["wing_loading_N_m2", "pectoral_aspect_ratio", "lifting_area_m2"],
    },
    "winged-zebrafish": {
        "name": "winged zebrafish - zebrafish with the pectoral fin proportion moved toward the flying fish",
        "kind": "design",
        "hypothetical": True,
        "parents": [{"organism": "zebrafish-adult", "weight": 1.0}],
        "real_experimental_counterpart": {
            "exists": True,
            "what": "the germline lat4a nr21/+ ; kcnh2a lof/+ double heterozygote (genotype/compare-2x2.json panel B)",
            "caveat": "This is the closest real experiment, and its paired-fin measurements exist ONLY in figure "
                      "panels (Fig. 4B pectoral fin length): no numeric value appears in the paper's text, legends "
                      "or Data S1, and nothing is digitised here. So the 0.35 below is NOT that experiment's number; "
                      "it is a chosen point between the zebrafish placeholder and the flying-fish median. The real "
                      "fish's fins are described as 'overgrown', with medial fins wild-type-sized and the caudal "
                      "hypocercal.",
        },
        "deltas": {
            "pectoral_len_over_SL": {"value": 0.35, "reason":
                "a chosen point between the zebrafish placeholder (0.155) and the flying-fish measured median "
                "(0.687), near the flying-halfbeak median 0.274-0.388 (Daane groups). Chosen, not measured.",
                "evidence": "hypothetical"},
            "pectoral_span_over_SL": {"scale": 0.35 / 0.155, "reason": "span follows the fin length", "evidence": "hypothetical"},
            "pectoral_area_over_SL2": {"scale": (0.35 / 0.155) ** 1.834, "reason":
                "area follows length^1.834 (Davenport 1992 exponent, development/trajectory.mjs P.area.exp); an "
                "assumed transfer from flying fish to zebrafish", "evidence": "hypothetical"},
        },
        "falls_out": ["pectoral_aspect_ratio", "lifting_area_m2", "wing_loading_N_m2"],
    },
    "wingless-flying-fish": {
        "name": "wingless flying fish - flying fish with the pectoral fin proportion at the halfbeak value",
        "kind": "design",
        "hypothetical": True,
        "parents": [{"organism": "flying-fish", "weight": 1.0}],
        "deltas": {
            "pectoral_len_over_SL": {"value": 0.14, "reason":
                "halfbeak group median pectoral/SL = 0.140 (n = 22, genotype/cache/daane2021_fin_ratios.json). "
                "The VALUE is measured - in halfbeaks. Putting it on a flying fish's body is the hypothesis: "
                "genotype/compare-2x2.json says a wingless flying fish 'would be expected to sit near the halfbeak "
                "end, but that is an inference from relatives, not a measurement of a flying fish.'",
                "evidence": "measured value, hypothetical transfer"},
            "pectoral_span_over_SL": {"scale": 0.14 / 0.687, "reason": "span follows the fin length", "evidence": "hypothetical"},
            "pectoral_area_over_SL2": {"scale": (0.14 / 0.687) ** 1.834, "reason":
                "area follows length^1.834 (Davenport 1992)", "evidence": "hypothetical"},
        },
        "falls_out": ["pectoral_aspect_ratio", "lifting_area_m2", "wing_loading_N_m2"],
    },
    "ff-zf-chimera": {
        "name": "0.5 flying fish / 0.5 zebrafish morphological blend (two-parent test case)",
        "kind": "design",
        "hypothetical": True,
        "purpose": "exists to show the two-parent mechanism works. It is a shape halfway between two body "
                   "parameter sets and NOTHING else.",
        "parents": [{"organism": "flying-fish", "weight": 0.5},
                    {"organism": "zebrafish-adult", "weight": 0.5}],
        "deltas": {},
        "falls_out": ["pectoral_aspect_ratio", "lifting_area_m2", "wing_loading_N_m2"],
    },
}


# ---------------------------------------------------------------------------- resolver
def _blend_rule(key):
    return SCHEMA[key][2]


def resolve(design_id, designs=None, references=None):
    """Resolve a design (or a reference id) to {parameters, provenance, moved_parameters, ...}."""
    designs = designs if designs is not None else DESIGNS
    references = references if references is not None else REFERENCES
    if design_id in references:
        ref = references[design_id]
        params = {k: dict(v) for k, v in ref["parameters"].items()}
        prov = {k: {"value": v["value"], "kind": v["kind"], "source": v["source"],
                    "ancestry": "reference organism (literal value)", "delta": None}
                for k, v in params.items()}
        for k, v in params.items():
            if v.get("note"):
                prov[k]["note"] = v["note"]
        return {"id": design_id, "name": ref["name"], "kind": "reference", "parents": [],
                "parameters": {k: v["value"] for k, v in params.items()},
                "parameter_detail": params, "provenance_per_parameter": prov,
                "moved_parameters": [], "caveat": None, "record": ref}

    d = designs[design_id]
    parents = d["parents"]
    wsum = sum(x["weight"] for x in parents)
    if abs(wsum - 1.0) > 1e-9:
        raise ValueError("weights for %s sum to %r, not 1" % (design_id, wsum))
    resolved_parents = {x["organism"]: resolve(x["organism"], designs, references) for x in parents}

    out, prov = {}, {}
    for key in SCHEMA:
        rule = _blend_rule(key)
        contribs = []
        acc = 0.0 if rule != "min" else None
        for x in parents:
            pr = resolved_parents[x["organism"]]
            pv = pr["parameters"][key]
            pk = pr["parameter_detail"][key]["kind"]
            contribs.append({"organism": x["organism"], "weight": x["weight"], "value": pv, "kind": pk})
            if rule == "min":
                acc = pv if acc is None else min(acc, pv)
            else:
                acc += x["weight"] * pv
        blended = acc
        kinds = {c["kind"] for c in contribs}
        # inherited kind: the weakest of the contributing kinds
        order = ["measured", "secondary", "derived", "assumed", "hypothetical"]
        inherited_kind = sorted(kinds, key=lambda k: order.index(k) if k in order else 9)[-1]

        delta = d["deltas"].get(key)
        if delta is not None:
            if "value" in delta:
                final = delta["value"]
                dform = "set to %r" % final
            elif "scale" in delta:
                final = blended * delta["scale"]
                dform = "blend x %.6g" % delta["scale"]
            elif "add" in delta:
                final = blended + delta["add"]
                dform = "blend + %r" % delta["add"]
            else:
                raise ValueError("delta on %s needs value/scale/add" % key)
        else:
            final = blended
            dform = None

        if rule == "round":
            final_out = int(round(final))
            rounded = {"unrounded": final, "rounded_to": final_out} if abs(final - final_out) > 1e-9 else None
        else:
            final_out = final
            rounded = None

        if len(parents) == 1 and parents[0]["weight"] == 1.0:
            anc = "100%% %s" % parents[0]["organism"]
        else:
            anc = " + ".join("%.0f%% %s" % (c["weight"] * 100, c["organism"]) for c in contribs)

        entry = {
            "value": final_out,
            "unit": SCHEMA[key][0],
            "drives": SCHEMA[key][1],
            "blend_rule": rule,
            "ancestry": anc,
            "parents": contribs,
            "blended_value": blended,
            "delta": None if delta is None else {"applied": dform, "reason": delta["reason"],
                                                 "evidence": delta.get("evidence", "hypothetical")},
            "kind": inherited_kind if delta is None else "hypothetical",
        }
        if rounded:
            entry["rounding"] = rounded
        if delta is not None and delta.get("evidence") == "none":
            entry["NO_ANCESTOR_NO_EVIDENCE"] = True
        out[key] = final_out
        prov[key] = entry

    moved = sorted(d["deltas"].keys())
    rec = dict(d)
    rec["caveat_morphological_not_genetic"] = CAVEAT
    return {
        "id": design_id, "name": d["name"], "kind": "design",
        "hypothetical": d.get("hypothetical", True),
        "parents": parents,
        "parameters": out,
        "parameter_detail": {k: {"value": prov[k]["value"], "kind": prov[k]["kind"],
                                 "source": prov[k]["ancestry"] + ("" if prov[k]["delta"] is None
                                                                  else "; delta: " + prov[k]["delta"]["reason"])}
                             for k in prov},
        "provenance_per_parameter": prov,
        "moved_parameters": moved,
        "lean_recheck": {
            "why": "a design inherits whatever constraints its parents satisfy; every delta needs re-checking",
            "run": "lean/eliminate/browser-check.mjs on exactly these parameters",
            "parameters": moved,
        },
        "caveat": CAVEAT,
        "record": rec,
    }


def all_ids():
    return list(REFERENCES) + list(DESIGNS)


# ---------------------------------------------------------------------------- schema file
def schema_doc():
    return {
        "title": "DELPHI parametric organism / design schema",
        "version": 1,
        "generative_model": {
            "formula": "parameters = SUM over parents ( weight_i * parent_i.parameter ) + delta",
            "constraint": "weights sum to 1",
            "reference_organisms": list(REFERENCES),
            "note": "Any proposed organism has its roots in another, or is a blend of two or more, plus an "
                    "explicit novel part (the deltas).",
        },
        "THE_HARD_CAVEAT": CAVEAT,
        "design_file": {
            "name": "string",
            "kind": "'design'",
            "hypothetical": "bool",
            "parents": [{"organism": "id of a reference organism or another design", "weight": "number, all summing to 1"}],
            "deltas": {"<parameter>": {
                "value | scale | add": "set absolutely | multiply the blend | offset the blend",
                "reason": "string; why this parameter moved",
                "evidence": "measured | hypothetical | 'measured value, hypothetical transfer' | none"}},
            "falls_out": ["derived quantities that must NOT be set by hand because the deltas already fix them"],
        },
        "output_manifest_guarantee": {
            "provenance_per_parameter": "for EVERY parameter: ancestry (which parents at which weights), the "
                                        "parents' own values and kinds, the blended value, whether a delta moved it, "
                                        "the delta's reason and evidence, and the final kind",
            "entirely_delta": "a parameter whose delta has evidence 'none' has NO ancestor and NO evidence. It is "
                              "flagged NO_ANCESTOR_NO_EVIDENCE because that is exactly where a claim needs the most "
                              "scrutiny.",
            "moved_parameters": "the list of parameters a delta touched, for lean/eliminate/browser-check.mjs",
        },
        "parameters": {k: {"unit": v[0], "drives": v[1], "blend_rule": v[2]} for k, v in SCHEMA.items()},
        "derived_never_set_directly": DERIVED,
        "kinds": list(KINDS),
    }


def _dump():
    with open(os.path.join(HERE, "design-schema.json"), "w", encoding="utf-8") as fh:
        json.dump(schema_doc(), fh, indent=1)
    for k, v in REFERENCES.items():
        with open(os.path.join(HERE, "organisms", k + ".json"), "w", encoding="utf-8") as fh:
            json.dump(v, fh, indent=1)
    for k, v in DESIGNS.items():
        rec = dict(v)
        rec["caveat_morphological_not_genetic"] = CAVEAT
        with open(os.path.join(HERE, "designs", k + ".json"), "w", encoding="utf-8") as fh:
            json.dump(rec, fh, indent=1)
    for k in all_ids():
        r = resolve(k)
        r.pop("record", None)
        with open(os.path.join(HERE, "resolved", k + ".json"), "w", encoding="utf-8") as fh:
            json.dump(r, fh, indent=1)
    print("wrote design-schema.json, %d organisms, %d designs, %d resolved"
          % (len(REFERENCES), len(DESIGNS), len(all_ids())))


if __name__ == "__main__":
    import sys
    if "--dump" in sys.argv:
        _dump()
    if "--show" in sys.argv:
        r = resolve(sys.argv[sys.argv.index("--show") + 1])
        r.pop("record", None)
        print(json.dumps(r, indent=1))
