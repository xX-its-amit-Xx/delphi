"""genotype/sequence-layer.json: a SEQUENCE-level evidence layer for the fin-size genes, kept strictly apart from
the expression and phenotype layers of the map.

Why it is a separate layer and not folded into the map: an orthologue in the flying-fish gene set shows that the
gene is PRESENT in a flying fish. It says nothing about where it is expressed, when it acts, or what happens when
it is lost, which is what every other link in this project's map is built from. Presence is not place or time of
action, and the two must not be averaged into one confidence.

Inputs (read-only; owned by the sequences thread): sequences/genes.json, gliders.json, progression.json.
This thread's own grades come from genotype/causal-chains.json. Offline.
Usage: python -I genotype/build_sequence_layer.py
"""
import json, os, time

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
def load(p, d=None):
    try: return json.load(open(os.path.join(ROOT, p), encoding="utf8"))
    except Exception: return d
GEN = load("sequences/genes.json", {}) or {}
GLI = load("sequences/gliders.json", {}) or {}
PRO = load("sequences/progression.json", {}) or {}
CH = load("genotype/causal-chains.json", {}) or {}
chain = {g["symbol"]: g for g in CH.get("genes", [])}
FFKEY = "Hirundichthys_speculiger_annotated_Xu2021"

orthologues, failed = [], []
for sym, v in (GEN.get("genes") or {}).items():
    ff = ((v.get("flying_fish") or {}).get(FFKEY)) or {}
    if not ff: continue
    ch = chain.get(sym) or {}
    rec = {"gene": sym, "zebrafish_gene": v.get("zebrafish_gene"), "zfin_id": v.get("zfin_id"),
           "flying_fish_protein": ff.get("flyingfish_protein"), "protein_length": ff.get("flyingfish_length"),
           "percent_identity_to_zebrafish": ff.get("forward_pident"), "reciprocal_best_hit": ff.get("reciprocal_best_hit"),
           "reverse_best_zebrafish_symbol": ff.get("reverse_best_zebrafish_symbol"),
           "phenotype_layer_chain_strength": ch.get("chain_strength"), "phenotype_layer_best_single_link": ch.get("best_grade"),
           "what_this_adds": ("The gene is present in the annotated flying-fish gene set as a clean reciprocal best hit, so the proxy-species work on it is about a gene "
                              "the flying fish actually has. It adds nothing about expression, stage or function in a flying fish.")}
    if ff.get("reciprocal_best_hit"): orthologues.append(rec)
    else:
        rec["why_not_an_orthologue_call"] = (("Reciprocal best hit FAILED: the flying-fish protein's best match back in the zebrafish proteome is %s, not %s. This is a hit "
                                              "found by searching a zebrafish or medaka protein against the flying-fish set, not an orthologue call, and it must not be "
                                              "reported as one. For a duplicated gene family this is the expected failure mode and it means the paralogue cannot be "
                                              "distinguished at this identity level.") % (ff.get("reverse_best_zebrafish_symbol"), sym))
        rec["what_this_adds"] = "A sequence similar to this gene exists in the flying fish, but which paralogue it is was not resolved."
        failed.append(rec)

site = GLI.get("lat4a_site_326_across_gliders") or {}
BELON = {"hirundichthys_speculiger"}
groups = PRO.get("groups_in_order") or {}
fin = {k: v.get("fin_ratio_group_median") for k, v in groups.items()}
derived = {k: v.get("mean_derived_states_of_38_sites") for k, v in groups.items()}
glider_outside_beloniformes = {k: v for k, v in site.items() if k not in BELON and k not in ("danio_rerio", "oryzias_latipes")}

out = {
 "title": "Sequence-level layer: which fin-size genes are present in the annotated flying-fish gene set, and what the lat4a convergent site does and does not show",
 "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tool": "genotype/build_sequence_layer.py",
 "layer_boundary": ("THIS IS A SEQUENCE LAYER AND NOTHING MORE. An orthologue call shows a gene is present in a flying fish. Every other link in this project's map rests on "
                    "expression or phenotype, which do not exist for any flying fish. Presence is not place of action and not time of action, so a sequence result must never "
                    "be combined with a phenotype grade into one confidence, and a gene's chain strength is unchanged by having been found in the gene set."),
 "source": {"owner": "the sequences thread (sequences/genes.json, gliders.json, progression.json); this thread only reads them",
            "flying_fish_gene_set": GEN.get("flying_fish_status"), "method": "reciprocal best hit against the zebrafish proteome", "aligner": GEN.get("aligner"),
            "birds_excluded": GEN.get("birds_excluded")},
 "orthologues_resolved": orthologues, "orthologues_not_resolved": failed,
 "counts": {"genes_queried": len(orthologues) + len(failed), "clean_reciprocal_best_hits": len(orthologues), "failed_reciprocal_best_hit": len(failed)},
 "lat4a_convergent_site": {
   "site": "lat4a (ZFIN slc43a2a) position 326, the F326L substitution Daane 2021 reports as convergent in gliding beloniforms",
   "annotated_flying_fish_protein_carries": site.get("hirundichthys_speculiger"),
   "within_beloniformes": {k: {"fin_over_SL_group_median": fin.get(k), "residues_at_326": v.get("lat4a_326_residues"),
                               "mean_derived_states_of_38_sites": v.get("mean_derived_states_of_38_sites"), "range": v.get("range_derived_states"),
                               "n_species_sequenced": v.get("n_species_sequenced")} for k, v in groups.items()},
   "it_tracks_gliding_within_beloniformes": ("The derived L is carried by the annotated flying-fish protein, by 8 of 9 flying fishes in Daane's exon data (Parexocoetus is F, "
                                             "as the paper itself says) and by BOTH gliding halfbeak genera, while the non-gliding relatives carry the ancestral F with one "
                                             "saury carrying I. So within this order the substitution does track gliding."),
   "there_is_no_convergence_with_gliding_MAMMALS": {
     "finding": ("Outside Beloniformes the site is ancestral in every glider tested: all three bats, both colugos, the sugar glider, plus mouse, human, the reptile controls and "
                 "the frog all carry F. So this is a beloniform-specific change, NOT a general gliding signature, and it must not be presented as convergence with gliding "
                 "mammals."),
     "residues": glider_outside_beloniformes,
     "caveat_from_the_sequences_thread": GLI.get("gene_set_caveat")},
   "three_reasons_this_is_weaker_than_it_looks": [
     ("THE LADDER IS FLAT, AND SLIGHTLY INVERTED. Gliding halfbeaks carry a mean of %s derived states of the 38 sites at a fin ratio of %s, while flying fishes carry %s at a fin "
      "ratio of %s. The count therefore does not scale with fin length, and the group with the smaller fin carries marginally MORE derived residues. Nothing here is a "
      "dose-response.") % (derived.get("flying (gliding) halfbeak"), fin.get("flying (gliding) halfbeak"), derived.get("flying fish (Exocoetidae)"), fin.get("flying fish (Exocoetidae)")),
     ("THE NON-GLIDER ZERO IS CIRCULAR. Daane's sheet G lists only substitutions shared by gliders and absent from outgroups, so non-gliding species score zero at these sites by "
      "construction. The zero is a property of how the site list was built, not a finding about non-gliders."),
     ("TRACKING IS NOT CAUSING, and this project's own phenotype layer agrees: the chain for slc43a2a has a weakest link graded hypothesis, because nothing experimental connects "
      "the transporter's function to fin ray length in any species. A sequence that tracks a trait does not supply that missing step.")],
   "statistics_note": (PRO.get("read_this_first") or [None])[0]},
 "what_this_layer_changes_about_the_fin_size_story": [
   "It removes one objection: the fin-size genes are not absent from flying fish. Seven of nine are present as clean reciprocal best hits, with 56 to 89 percent identity to their zebrafish counterparts.",
   "It strengthens the lat4a identification by one more independent route: the annotated flying-fish protein carries the derived residue that Daane's exon data report.",
   "It does NOT raise any gene's evidence grade, because no grade in this project rests on presence.",
   "It does NOT make the flying fish a model organism: there is still no expression, no mutant and no functional measurement in any flying fish.",
   "kcnh2a and shha are the two genes it cannot speak for, and they include one of the three wing genes.",
 ],
 "species_caveat": ("The annotated gene set is Hirundichthys speculiger. The fin measurements this project uses are Cheilopogon furcatus, Exocoetus volitans and Hirundichthys "
                    "rondeleti. Only the last shares a genus with the sequenced animal, so sequence and morphometry are cross-species within Exocoetidae wherever they are used together."),
}
json.dump(out, open(os.path.join(HERE, "sequence-layer.json"), "w", encoding="utf8"), separators=(",", ":"))
print(json.dumps({"counts": out["counts"], "resolved": [o["gene"] for o in orthologues], "not_resolved": [{f["gene"]: f["reverse_best_zebrafish_symbol"]} for f in failed],
                  "lat4a_326_flying_fish": out["lat4a_convergent_site"]["annotated_flying_fish_protein_carries"],
                  "fin_vs_derived": {k: [fin.get(k), derived.get(k)] for k in groups}}, indent=1))
print("sequence-layer.json KB", round(os.path.getsize(os.path.join(HERE, "sequence-layer.json")) / 1e3))
