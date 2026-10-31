"""Assemble genotype/interventions.json for the Design Studio from the subagents' interventions_*.json files.

Each entry is a genetic or pharmacological manipulation that was SHOWN in an experiment to change a morphology
parameter, with its level (coding, cis-regulatory or expression, TF dosage, epigenetic, pharmacological,
transgenic), its direction, its measured effect size where a paper gives a number, the stage(s) at which it was
measured, its onset, its evidence grade, and its sources with verbatim quotes. Entries a paper only proposes are
graded hypothesis and say so.

This script adds three things the subagents could not:
  - pleiotropy: the blueprint nodes each gene touches, from genotype/map.vetted.json (breadth), so the Studio can
    warn that moving a fin knob also moves the heart;
  - paralog guards: from genotype/causal-chains.json, so a route evidenced on one paralog is never offered for the
    other (tbx5a evidence must not be offered as a tbx5b route);
  - validation: an entry with no source, no identifier, no quote, an unrecognised level or grade, or a numeric
    effect size without a unit is kept but flagged, and the flags are counted in the output.
Nothing is invented and nothing is upgraded.

Offline. Usage: python -I genotype/assemble_interventions.py
"""
import collections, glob, json, os, re, time

HERE = os.path.dirname(os.path.abspath(__file__))
AGENTS = "C:/Temp/genotype/agents"
GRADES = ["missing", "hypothesis", "association", "necessity", "sufficiency", "mechanism"]
RANK = {g: i for i, g in enumerate(GRADES)}
LEVELS = ["coding", "cis-regulatory or expression", "TF dosage", "epigenetic", "pharmacological", "transgenic overexpression"]

M = json.load(open(os.path.join(HERE, "map.vetted.json"), encoding="utf8"))
genes_map = M["genes"]
sym2key = {}
for k, v in genes_map.items():
    if v.get("symbol"): sym2key.setdefault(v["symbol"], k)
CH = json.load(open(os.path.join(HERE, "causal-chains.json"), encoding="utf8"))
chain_by_sym = {g["symbol"]: g for g in CH["genes"]}
# paralog statements the chain agents recorded, keyed by symbol
paralog_notes = {g["symbol"]: g.get("paralog_note") for g in CH["genes"] if g.get("paralog_note")}
PARALOG_PAIRS = [("tbx5a", "tbx5b"), ("fgf10a", "fgf10b"), ("shha", "shhb"), ("pax7a", "pax7b")]

flags = collections.Counter()
def check(iv, agent):
    where = f'{agent}/{iv.get("id")}'
    if iv.get("evidence_grade") not in RANK: flags[f"grade not one of the five words: {iv.get('evidence_grade')!r}"] += 1
    if iv.get("level") not in LEVELS: flags[f"level not one of the six: {iv.get('level')!r}"] += 1
    srcs = iv.get("sources") or []
    if not srcs: flags[f"{where}: no sources at all"] += 1
    for s in srcs:
        if not (s.get("pmid") or s.get("doi")): flags["source with no PMID or DOI"] += 1
        if not s.get("quote"): flags["source with no verbatim quote"] += 1
    es = iv.get("effect_size") or {}
    if es.get("value") not in (None, "") and not es.get("unit"): flags[f"{where}: numeric effect size with no unit"] += 1
    st = iv.get("stage") or {}
    if st.get("reported") is True and not (st.get("stage_text") or st.get("age") or st.get("zfs")): flags[f"{where}: stage marked reported but empty"] += 1
    return iv

interventions, no_route, per_agent = [], [], {}
for path in sorted(glob.glob(os.path.join(AGENTS, "interventions_*.json"))):
    try: d = json.load(open(path, encoding="utf8"))
    except Exception as e: flags[f"{os.path.basename(path)}: unreadable ({type(e).__name__})"] += 1; continue
    agent = d.get("agent") or os.path.basename(path)
    for iv in (d.get("interventions") or []):
        iv["agent"] = agent
        check(iv, agent)
        sym = iv.get("gene")
        key = sym2key.get(sym)
        br = (genes_map.get(key) or {}).get("breadth") or {}
        iv["pleiotropy"] = {"gene_key": key, "blueprint_nodes_touched": br.get("blueprint_nodes_direct"), "by_layer": br.get("layers"),
                            "note": ("This gene has a direct record on %s blueprint nodes across %s layers, so a change to it is not confined to the fin."
                                     % (br.get("blueprint_nodes_direct"), len((br.get("layers") or {}))) if br else
                                     "Not in the vetted map's gene table (it may be a pharmacological agent, a non-zebrafish gene, or a gene with no blueprint-attached record), so pleiotropy was not computed.")}
        ch = chain_by_sym.get(sym)
        iv["chain"] = {"chain_strength": ch.get("chain_strength"), "best_single_link": ch.get("best_grade"), "deepest_level": ch.get("deepest_level"),
                       "weakest_link": ch.get("weakest_link")} if ch else {"note": "no causal chain was built for this gene"}
        es = iv.get("effect_size") or {}
        iv["has_numeric_effect_size"] = es.get("value") not in (None, "")
        iv["stage_reported"] = bool((iv.get("stage") or {}).get("reported"))
        # A number is not an effect magnitude if it is a drug dose, a penetrance or a count of affected animals.
        # The subagents said so in their own unit and measured_as fields, so that text is what decides here: a knob
        # the Studio can calibrate needs a magnitude of the morphology change, not a concentration or a frequency.
        unit = str(es.get("unit", "")).lower()
        how = (str(es.get("measured_as", "")) + " " + str(es.get("statistic", ""))).lower()
        # The unit decides whether the number is a concentration; the wording decides whether it counts animals.
        is_dose = bool(re.search(r"\b(µm|um|mm|nm|mg|ng|%\s*dmso)\b|dose", unit))
        counts_animals = bool(re.search(r"penetrance|frequenc|proportion of (fish|embryos|larvae|chimeras|clutch)|"
                                        r"(number|count) of (fish|embryos|larvae|chimeras|overgrowths|affected)|"
                                        r"% of (injected|treated)? ?(fish|embryos|larvae)", unit + " " + how))
        iv["number_is_a_magnitude"] = bool(iv["has_numeric_effect_size"] and not is_dose and not counts_animals)
        iv["usable_as_a_calibrated_knob"] = bool(iv["number_is_a_magnitude"] and iv["stage_reported"])
        if iv["has_numeric_effect_size"] and not iv["number_is_a_magnitude"]:
            iv["number_kind"] = "not a morphology magnitude (a dose, a penetrance or a count of affected animals); kept with the paper's own wording"
        for a, b in PARALOG_PAIRS:
            if sym in (a, b):
                other = b if sym == a else a
                iv["paralog_guard"] = {"paralog": other, "do_not_transfer": True,
                                       "note": paralog_notes.get(sym) or paralog_notes.get(other) or
                                       f"{sym} and {other} are teleost-duplication paralogs. Evidence on one is not evidence for the other, and this project found no cross-rescue. The Studio must not offer a {other} route on {sym} evidence."}
        interventions.append(iv)
    for nr in (d.get("no_sourced_genetic_route") or []):
        no_route.append({**nr, "agent": agent})
    per_agent[agent] = {"file": os.path.basename(path), "interventions": len(d.get("interventions") or []), "summary": d.get("summary"), "fetch_log": d.get("fetch_log"),
                        **({"design_studio_notes": d["design_studio_notes"]} if d.get("design_studio_notes") else {})}

# parameters, normalised loosely for grouping but keeping each agent's own wording on the entry
def norm(p):
    """Group an agent's own parameter wording into a bucket the Studio can offer as one knob.

    The agents wrote long descriptive strings, many beginning 'other (...)', so the text inside the parentheses is
    matched too. Anything that is a transcript level or a pathway readout rather than a morphology measurement goes
    to one explicit bucket, because the Studio must not offer those as morphology knobs.
    """
    p = (p or "").lower()
    if re.search(r"transcript level|expression level|pathway output|cyclopia|depolarization level|shha expression|rcan2 transcription", p):
        return "not a morphology parameter (transcript level or pathway readout)"
    for pat, name in (("segment", "ray segment length"), ("regenerate", "regenerate length"),
                      ("bud size", "pectoral fin bud size"), ("bud growth", "pectoral fin bud size"),
                      ("induction", "pectoral fin induction (fin present or absent)"),
                      ("overgrowth", "local fin overgrowth in clones (present or absent, not a length)"),
                      ("endoskeletal", "endoskeletal disc size or shape"),
                      ("anterior-posterior", "fin anterior-posterior extent"), ("dorsoventral", "fin dorsoventral extent"),
                      ("area", "fin area or span"), ("span", "fin area or span"),
                      ("barbel", "fin and barbel size together"), ("body", "body length"), ("caudal", "caudal fin"),
                      ("cleithrum", "cleithrum or girdle"), ("girdle", "cleithrum or girdle"), ("coracoid", "cleithrum or girdle"),
                      ("fin fold", "fin fold size"), ("radial", "radial number or shape"), ("hypural", "caudal fin"),
                      ("muscle", "fin musculature"), ("actinotrichi", "actinotrichium"),
                      ("pectoral fin length", "pectoral fin length"), ("lepidotrichium", "fin ray presence or length"),
                      ("ray", "fin ray presence or length"), ("fin size", "fin area or span"),
                      ("fin length", "fin length (fin not specified or not pectoral)"), ("cartilage", "cartilage or craniofacial (not a fin parameter)")):
        if pat in p: return name
    return p or "unstated"
by_param = collections.defaultdict(list)
for iv in interventions: by_param[norm(iv.get("parameter"))].append(iv)
params = {}
for p, ivs in sorted(by_param.items()):
    params[p] = {"n_interventions": len(ivs), "directions": dict(collections.Counter(i.get("direction") for i in ivs)),
                 "bidirectional": len({i.get("direction") for i in ivs} & {"increase", "decrease"}) == 2,
                 "levels": dict(collections.Counter(i.get("level") for i in ivs)),
                 "best_grade": max((i.get("evidence_grade") for i in ivs), key=lambda g: RANK.get(g, 0)),
                 "with_numeric_effect_size": sum(i["has_numeric_effect_size"] for i in ivs),
                 "with_stage_reported": sum(i["stage_reported"] for i in ivs),
                 "calibrated_knobs": [i["id"] for i in ivs if i["usable_as_a_calibrated_knob"]],
                 "genes": sorted({i.get("gene") for i in ivs if i.get("gene")}),
                 "intervention_ids": [i["id"] for i in ivs]}

NOTE = ("Every entry is a manipulation that was SHOWN in an experiment, or is explicitly graded hypothesis where a paper only proposes it. All of it is "
        "proxy-species work, overwhelmingly zebrafish: no genetic manipulation has ever been done in a flying fish, so nothing here is a flying-fish result. "
        "A flying fish's wing is an enlarged pectoral fin. `usable_as_a_calibrated_knob` is true only where a paper gives BOTH a number and the stage it was "
        "measured at; most of this literature reports morphology in figure panels, so most entries carry the paper's words instead of a value and the Studio "
        "must not interpolate one. Stages fall into non-interpolable regimes (embryonic fin bud against reproductively mature adult): an effect measured in "
        "one does not transfer to the other. Pleiotropy is computed from the vetted map, not from the papers.")
out = {
 "title": "Known genetic and pharmacological interventions on fin and body morphology parameters, for the Design Studio",
 "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tool": "genotype/assemble_interventions.py", "vetted": True, "note": NOTE,
 "constraint": M["constraint"],
 "levels": {"coding": "a change in the protein-coding sequence (allele, amino-acid substitution)",
            "cis-regulatory or expression": "a change in where or how much the gene is expressed, without changing the protein",
            "TF dosage": "a change in the amount of a transcription factor", "epigenetic": "a change in chromatin state or silencing",
            "pharmacological": "a drug or inhibitor, with its dose where the source gives one", "transgenic overexpression": "an introduced construct"},
 "grades": {g: d for g, d in zip(GRADES, ["no fetched source", "proposed in a paper, not shown there", "expression or correlation only",
            "loss of function changes it", "gain of function changes it", "a pathway step shown experimentally"])},
 "coverage": {"interventions": len(interventions), "genes": len({i.get("gene") for i in interventions}),
              "by_level": dict(collections.Counter(i.get("level") for i in interventions)),
              "by_grade": dict(collections.Counter(i.get("evidence_grade") for i in interventions)),
              "by_direction": dict(collections.Counter(i.get("direction") for i in interventions)),
              "with_numeric_effect_size": sum(i["has_numeric_effect_size"] for i in interventions),
              "with_stage_reported": sum(i["stage_reported"] for i in interventions),
              "usable_as_calibrated_knobs": sum(i["usable_as_a_calibrated_knob"] for i in interventions),
              "parameters_covered": len(params), "parameters_with_no_sourced_route": len(no_route),
              "distinct_publications": len({(s.get("pmid") or s.get("doi")) for i in interventions for s in (i.get("sources") or [])} - {None}),
              "with_paralog_guard": sum(1 for i in interventions if i.get("paralog_guard"))},
 "validation_flags": dict(flags), "agents": per_agent,
 "parameters": params, "no_sourced_genetic_route": no_route,
 "paralog_guards": {"rule": ("After the teleost genome duplication zebrafish often carries two paralogs, and this project found no cross-rescue for any of the pairs "
                             "below. The Studio must never offer a route for one paralog on evidence gathered for the other, and must never present either as "
                             "the flying-fish gene: orthology to a flying-fish gene is an assumption nowhere established here."),
                    "pairs": {a: {"paralog": b, "interventions_for_this_paralog": sum(1 for i in interventions if i.get("gene") == a),
                                  "interventions_for_the_other": sum(1 for i in interventions if i.get("gene") == b),
                                  "note": paralog_notes.get(a) or paralog_notes.get(b) or "teleost-duplication paralogs; evidence on one is not evidence for the other",
                                  "chain_evidence": {s: (chain_by_sym[s].get("chain_strength") if s in chain_by_sym else "no chain built") for s in (a, b)}}
                              for a, b in PARALOG_PAIRS},
                    "tbx5a_tbx5b_specifically": ("Asked for by the hub. tbx5a is the pectoral fin initiation gene whose null never develops a fin bud, and it also builds "
                                                 "the heart (its mutant is 'heartstrings'), so it is the worst pleiotropy case in the set. tbx5b has ZERO experimental "
                                                 "molecular-function evidence (its GO annotation is inferred by ancestry only) and no sub-organ phenotype. Neither gene has an "
                                                 "intervention entry in this file yet, because no interventions extraction has been run for them; until one is, the Studio has "
                                                 "no sourced tbx5 route of any kind and must offer none.")},
 "interventions": sorted(interventions, key=lambda i: (-int(i["usable_as_a_calibrated_knob"]), -RANK.get(i.get("evidence_grade"), 0), str(i.get("parameter")))),
}
dst = os.path.join(HERE, "interventions.json")
json.dump(out, open(dst, "w", encoding="utf8"), separators=(",", ":"))
print(json.dumps({"coverage": out["coverage"], "flags": dict(flags)}, indent=1))
for p, v in params.items(): print(f'  {p:44s} n={v["n_interventions"]:3d} best={v["best_grade"]:11s} bidirectional={v["bidirectional"]} knobs={len(v["calibrated_knobs"])}')
print("interventions.json KB", round(os.path.getsize(dst) / 1e3))
