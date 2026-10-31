"""HYPOTHESIS ONLY. Candidate genetic routes to the four changes the physics thread's hypothetical powered flier
would need, written as genotype/flier-genome.json and genotype/flier-genome.md.

This is NOT a predicted genome and not a design. It is a map of which required changes have a known genetic route
in the literature this project fetched, which have only a partial one, and which have none. The honest answer is
expected to be "none" for most of it, and a "none" here is the useful result: it tells the next team where the
biology is missing rather than implying a buildable organism.

Inputs, all produced by this thread and all local:
  physics/flier/spec.json        the four required changes (parameter_diff_real_to_flier) from the physics thread
  genotype/interventions.json    manipulations shown to change a morphology parameter, with grades and stages
  genotype/causal-chains.json    graded gene-to-phenotype chains
  genotype/map.vetted.json       pleiotropy (blueprint nodes each gene touches)
  C:/Temp/genotype/agents/air_breathing.json, muscle_o2.json   two logged literature runs (optional; if a file is
                                 absent the item says so instead of being filled in)

No bird data anywhere: class Aves is a held-out clade in this project, so bird flight-muscle and respiratory
genetics are excluded by construction, and any input containing them would be a rule violation, not a shortcut.

Offline. Usage: python -I genotype/build_flier_genome.py
"""
import collections, json, os, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
AGENTS = "C:/Temp/genotype/agents"
def load(p, default=None):
    try: return json.load(open(p, encoding="utf8"))
    except Exception: return default
SPEC = load(os.path.join(ROOT, "physics", "flier", "spec.json"), {})
IV = load(os.path.join(HERE, "interventions.json"), {})
CH = load(os.path.join(HERE, "causal-chains.json"), {})
M = load(os.path.join(HERE, "map.vetted.json"), {})
AIR = load(os.path.join(AGENTS, "air_breathing.json"))
MO2 = load(os.path.join(AGENTS, "muscle_o2.json"))
diff = SPEC.get("parameter_diff_real_to_flier", {})
genes_map = M.get("genes", {})
sym2key = {v.get("symbol"): k for k, v in genes_map.items() if v.get("symbol")}
RANK = {g: i for i, g in enumerate(["missing", "hypothesis", "association", "necessity", "sufficiency", "mechanism"])}

def pleio(sym):
    br = (genes_map.get(sym2key.get(sym)) or {}).get("breadth") or {}
    return {"blueprint_nodes_touched": br.get("blueprint_nodes_direct"), "by_layer": br.get("layers")} if br else {"note": "not computed (gene not in the vetted map's gene table)"}

def routes_for(param_patterns, direction=None):
    """Interventions whose parameter matches any pattern, strongest evidence first, as candidate routes."""
    out = []
    for iv in IV.get("interventions", []):
        p = (iv.get("parameter") or "").lower()
        if not any(pat in p for pat in param_patterns): continue
        if direction and direction not in (iv.get("direction") or ""): continue
        out.append({"intervention_id": iv.get("id"), "gene": iv.get("gene"), "parameter": iv.get("parameter"), "level": iv.get("level"), "lesion": iv.get("lesion"),
                    "direction": iv.get("direction"), "evidence_grade": iv.get("evidence_grade"),
                    "effect_size": iv.get("effect_size"), "is_a_real_magnitude": iv.get("number_is_a_magnitude", False),
                    "stage": iv.get("stage"), "calibrated": iv.get("usable_as_a_calibrated_knob", False),
                    "chain_strength": (iv.get("chain") or {}).get("chain_strength"),
                    "pleiotropy": iv.get("pleiotropy") or pleio(iv.get("gene")),
                    "side_effects": iv.get("side_effects"), "lethality": iv.get("lethality"),
                    "sources": [{k: s.get(k) for k in ("pmid", "doi", "first_author", "year", "quote", "read")} for s in (iv.get("sources") or [])[:2]]})
    out.sort(key=lambda r: (-int(r["calibrated"]), -RANK.get(r["evidence_grade"], 0)))
    return out

items = []

# ---- (1) lifting area 3.9x at 2.5x span -----------------------------------------------------------
area = routes_for(["fin area", "span", "dorsoventral", "fin length", "fin size", "radial", "segment", "overgrowth", "endoskeletal"])
calibrated = [r for r in area if r["calibrated"]]
items.append({
 "item": 1, "requirement": "pectoral lifting area about 3.9 times the real fish's and span about 2.5 times, at a similar aspect ratio",
 "physics_numbers": {"lifting_area_m2": diff.get("lifting_area_m2"), "span_m": diff.get("span_m"), "aspect_ratio": diff.get("aspect_ratio"), "wing_loading_N_m2": diff.get("wing_loading_N_m2")},
 "route": "partial" if calibrated else ("hypothesis-level only" if area else "none"),
 "verdict": ("This is the ONE item with real genetic routes, because fin proportion is the trait this project studied. "
             "But no route reaches the required magnitude: the largest measured increase in pectoral fin area from any single "
             "manipulation is +65% of wild type (hhip loss of function at 72 hours post fertilisation), and the requirement is "
             "+290%, a 3.9-fold area. Nothing in the fetched literature multiplies a fin's area by 3.9, and no manipulation was "
             "measured as a span or an aspect ratio at all, so the shape requirement has no sourced route even where the size one "
             "partly does. Combining levers is untested: the one double mutant that changes fin proportion (kcnh2a with lat4a) "
             "redistributes size between fins rather than scaling one fin up."),
 "candidate_routes": area[:14], "n_candidate_routes": len(area), "n_calibrated": len(calibrated),
 "largest_measured_increase": next(({"gene": r["gene"], "value": (r["effect_size"] or {}).get("value"), "unit": (r["effect_size"] or {}).get("unit"),
                                     "parameter": "pectoral fin area", "stage": ((r["stage"] or {}).get("age") or (r["stage"] or {}).get("zfs") or (r["stage"] or {}).get("stage_text") or "")[:60], "grade": r["evidence_grade"]}
                                    for r in calibrated if r["gene"] == "hhip" and "area" in str((r["effect_size"] or {}).get("measured_as", "")).lower()), None),
 "what_is_missing": ["No manipulation anywhere was measured as a change in span or in aspect ratio.",
                     "No route reaches a 3.9-fold area; the best measured single-gene increase is 1.65-fold and it is larval, not adult.",
                     "The two stage regimes (embryonic fin bud, mature adult) cannot be interpolated, so a larval area change is not an adult fin.",
                     "Pectoral fin LENGTH has no calibrated route at all (see interventions.json no_sourced_genetic_route)."]})

# ---- (2) flight muscle 16% of body mass ----------------------------------------------------------
mo2_v = (MO2 or {}).get("verdict", {})
muscle_routes = (MO2 or {}).get("muscle_mass_routes", [])
fin_muscle_ch = [{"gene": g.get("symbol"), "chain_strength": g.get("chain_strength"), "deepest_level": g.get("deepest_level"),
                  "weakest_link": g.get("weakest_link"), "pleiotropy": pleio(g.get("symbol"))}
                 for g in CH.get("genes", []) if g.get("symbol") in ("mymk", "pax7a", "met", "mib1", "meox1", "foxc1a")]
items.append({
 "item": 2, "requirement": "a large aerobic pectoral flight muscle at about 16% of body mass, where the real fish has small fin muscles",
 "physics_numbers": {"flight_muscle_fraction": diff.get("flight_muscle_fraction"), "muscle_specific_mech_power_W_per_kg": diff.get("muscle_specific_mech_power_W_per_kg"),
                     "bat_comparison": (SPEC.get("sources") or {}).get("bat_flight_muscle_fraction")},
 "route": mo2_v.get("muscle_mass_16_percent", {}).get("route", "not yet researched") if MO2 else "not yet researched",
 "verdict": (mo2_v.get("muscle_mass_16_percent", {}).get("reasoning") if MO2 else
             "The literature run for this item has not finished, so no verdict is recorded. What this thread already holds is fin-muscle "
             "DEVELOPMENT genetics, not muscle-mass genetics: genes that decide whether fin muscle forms at all, not how much of it there is."),
 "muscle_mass_routes_from_literature": muscle_routes[:10],
 "aerobic_capacity": (MO2 or {}).get("aerobic_capacity", [])[:8],
 "fin_muscle_chains_this_thread_has": fin_muscle_ch,
 "what_is_missing": ([] if MO2 else ["The fish muscle-mass and oxygen-delivery literature run is unfinished."]) + [
   "Every fin-muscle result this thread has is about whether muscle forms, not about its mass fraction: the pax7 quadruple mutant develops muscle-less pectoral fins, and met is necessary for the abductor.",
   "A larger muscle is useless here unless it is aerobic rather than glycolytic, and fibre-type specification is a separate question from mass.",
   "Nothing connects a fin-muscle mass change to a flight-capable power output; the physics requirement is a specific power, which no genetic result reports."]})

# ---- (3) O2 delivery about 5x the bat range per kg -----------------------------------------------
items.append({
 "item": 3, "requirement": "oxygen delivery about five times the bat range per kilogram, by haemoglobin capacity and cardiac output",
 "physics_numbers": {"O2_delivery_ml_per_min_per_kg_required": diff.get("O2_delivery_ml_per_min_per_kg_required"),
                     "bat_metabolic_power_per_weight_W_per_N": (SPEC.get("sources") or {}).get("bat_metabolic_power_per_weight_W_per_N")},
 "route": mo2_v.get("oxygen_delivery_5x_bat", {}).get("route", "not yet researched") if MO2 else "not yet researched",
 "verdict": (mo2_v.get("oxygen_delivery_5x_bat", {}).get("reasoning") if MO2 else
             "The literature run for this item has not finished, so no verdict is recorded."),
 "oxygen_delivery_entries": (MO2 or {}).get("oxygen_delivery", [])[:10],
 "closest_fish_figure": mo2_v.get("oxygen_delivery_5x_bat", {}).get("closest_fish_figure") if MO2 else None,
 "what_is_missing": ["This thread's own data say nothing about oxygen delivery: the genotype map covers anatomy and gene links, not physiology.",
                     "No bird comparison is permitted here (Aves is the project's held-out clade), which removes the usual source of flight-oxygen genetics."]})

# ---- (4) a respiratory surface that works in air -------------------------------------------------
air_routes = (AIR or {}).get("routes", [])
with_gen = [r for r in air_routes if (r.get("genetics") or {}).get("known")]
items.append({
 "item": 4, "requirement": "a respiratory surface that works in air, since gills do not ventilate in air",
 "physics_numbers": {"note": "the climb requires the oxygen flux in item 3 while airborne"},
 "route": ("partial" if with_gen else "anatomy known, genetics none") if AIR else "not yet researched",
 "verdict": (("Real fishes breathe air by several routes, so the ANATOMY is not hypothetical, but the GENETICS of building such a surface is "
              "largely absent: %d of %d fetched routes have any genetics attached. Nothing is known for Beloniformes, the order containing flying "
              "fishes.") % (len(with_gen), len(air_routes)) if AIR else
             "The air-breathing literature run has not finished, so no verdict is recorded."),
 "routes": [{"route": r.get("route"), "anatomy": r.get("anatomy"), "taxa": r.get("taxa"), "obligate_or_facultative": r.get("obligate_or_facultative"),
             "genetics_known": (r.get("genetics") or {}).get("known"), "genetics": r.get("genetics"), "costs_and_limits": r.get("costs_and_limits"),
             "sources": [{k: s.get(k) for k in ("pmid", "doi", "first_author", "year", "quote", "read")} for s in (r.get("sources") or [])[:2]]} for r in air_routes],
 "beloniformes": (AIR or {}).get("beloniformes_and_exocoetidae"),
 "gas_bladder_lung_homology": (AIR or {}).get("gas_bladder_lung_homology"),
 "what_is_missing": ([] if AIR else ["The air-breathing literature run is unfinished."]) + [
   "A gas bladder used for respiration conflicts with its use for buoyancy, which is a design cost, not a gene.",
   "Carbon dioxide excretion happens at the gills in water breathers, so an air-breathing fish still has to solve it."]})

routed = sum(1 for i in items if i["route"] in ("partial", "known"))
out = {
 "title": "HYPOTHESIS: candidate genetic routes to the four changes a powered-flying fish would need",
 "status": "HYPOTHESIS THROUGHOUT. Not a predicted genome, not a design, and not a claim that any of this is achievable.",
 "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tool": "genotype/build_flier_genome.py",
 "constraint": (M.get("constraint") or "") + " No bird data is used anywhere: class Aves is this project's held-out clade, so bird flight-muscle and respiratory genetics are excluded by construction.",
 "physics_spec": {"file": "physics/flier/spec.json", "note": SPEC.get("note"), "parameter_diff_real_to_flier": diff,
                  "what_physics_says_it_does_not_establish": SPEC.get("what_this_does_not_establish")},
 "summary": {"items": len(items), "items_with_any_route": routed, "items_with_no_route_or_unresearched": len(items) - routed,
             "honest_reading": ("Of the four required changes, only fin proportion has genetic routes in this literature, and even there no route reaches the "
                                "required magnitude or addresses span and aspect ratio. The remaining three are where the biology is missing, which is the "
                                "useful result of this exercise.")},
 "items": items,
 "how_to_read_this": ["A route is listed because an experiment changed the parameter, never because a gene sounds relevant.",
                      "Evidence grades are the project's five: association, necessity, sufficiency, mechanism, hypothesis.",
                      "An effect size appears only where a paper gives a number; most of this literature reports morphology in figures.",
                      "Pleiotropy is attached to every gene from the vetted map, because every lever here moves more than the fin.",
                      "Stage regimes do not interpolate: a larval fin measurement is not an adult fin."]}
json.dump(out, open(os.path.join(HERE, "flier-genome.json"), "w", encoding="utf8"), separators=(",", ":"))

# ---- the markdown ---------------------------------------------------------------------------------
L = [f"# HYPOTHESIS: genetic routes to a powered-flying fish\n", f"**{out['status']}**\n",
     f"Built {out['built']} by `genotype/build_flier_genome.py` from the physics thread's `physics/flier/spec.json`, this thread's",
     "`interventions.json` and `causal-chains.json`, and two logged literature runs. No bird data anywhere: class Aves is this",
     "project's held-out clade, so the usual source of flight genetics is excluded by construction.\n",
     f"> {out['summary']['honest_reading']}\n", "## The four required changes\n",
     "| # | requirement | genetic route |", "|---|---|---|"]
for i in items:
    L.append(f"| {i['item']} | {i['requirement']} | **{i['route']}** |")
L.append("")
for i in items:
    L += [f"## {i['item']}. {i['requirement']}\n", f"**Route: {i['route']}.** {i['verdict']}\n"]
    if i["item"] == 1 and i.get("largest_measured_increase"):
        m = i["largest_measured_increase"]
        stage = m["stage"].split(" is the stage")[0].split(",")[0].strip() or "stage not reported"
        L += [f"Largest measured increase found: **{m['gene']} loss of function, {m['value']} {m['unit']}** for {m['parameter']}, graded `{m['grade']}`, at {stage}.",
              "The pleiotropy on that lever is the catch, and it is recorded in the same entries: the gene has a direct record on 12 blueprint nodes, and",
              "the reported side effects include the anal fin skeleton being completely absent, dorsal radials increased, caudal hypurals going from two to",
              "five, increased head volume, a reduced pupil, and adult dwarfism. It enlarges the pectoral fin by disorganising the rest of the skeleton.\n"]
    rs = i.get("candidate_routes") or []
    if rs:
        L += ["Each row is a manipulation that changed the parameter named in its own row, which is not always the parameter this item asks for.\n",
              "| gene | parameter it was measured on | level | direction | grade | effect size | calibrated | pleiotropy |", "|---|---|---|---|---|---|---|---|"]
        for r in rs[:10]:
            es = r.get("effect_size") or {}
            val = f"{es.get('value')} {es.get('unit')}" if r.get("is_a_real_magnitude") else (str(es.get("measured_as") or "no number")[:50])
            n = (r.get("pleiotropy") or {}).get("blueprint_nodes_touched")
            L.append(f"| {r['gene']} | {str(r.get('parameter') or '?')[:40]} | {r['level']} | {r['direction']} | `{r['evidence_grade']}` | {val} | "
                     f"{'yes' if r['calibrated'] else 'no'} | {str(n) + ' nodes' if n else 'not computed'} |")
        L.append("")
    for r in (i.get("routes") or [])[:8]:
        L.append(f"- **{r.get('route')}** ({', '.join((r.get('taxa') or [])[:4])}): genetics known: {r.get('genetics_known')}.")
    if i.get("routes"): L.append("")
    if i.get("what_is_missing"):
        L += ["**What is missing:**\n"] + [f"- {x}" for x in i["what_is_missing"]] + [""]
L += ["## How to read this\n"] + [f"- {x}" for x in out["how_to_read_this"]]
open(os.path.join(HERE, "flier-genome.md"), "w", encoding="utf8").write("\n".join(L) + "\n")
print(json.dumps(out["summary"], indent=1))
for i in items: print(f'  item {i["item"]}: route={i["route"]:28s} candidates={len(i.get("candidate_routes") or i.get("routes") or [])}')
print("flier-genome.json KB", round(os.path.getsize(os.path.join(HERE, "flier-genome.json")) / 1e3), "| .md KB", round(os.path.getsize(os.path.join(HERE, "flier-genome.md")) / 1e3))
