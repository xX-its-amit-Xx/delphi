"""genotype/compare-2x2.json: the four panels of the developmental comparison Amit asked for, with the genotype,
the phenotype values, the stage the perturbation acts at, whether it is germline, and an evidence grade per panel.

The 2x2 is species (zebrafish, flying fish) against fin state (enlarged "winged" paired fins, ordinary fins):
  A  zebrafish, ordinary fins        the real starting point, and the panel with the worst data (see below)
  B  zebrafish, enlarged paired fins the real experiment: Daane 2021's lat4a/kcnh2a trans-heterozygote
  C  flying fish, enlarged fins      the real animal, measured
  D  flying fish, ordinary fins      hypothetical; no flying-fish genetics exists, so its phenotype is read from
                                     the measured comparative series of its non-gliding relatives

Two honest limits are built into the file rather than written around:
  - every zebrafish fin measurement in Daane 2021 lives in a FIGURE PANEL. The text gives qualitative statements and
    one explicit negative. Nothing is digitised here; where a number does not exist, the field says so.
  - no fetched source measures pectoral fin length over standard length in a wild-type zebrafish, so panel A has no
    value on the same axis as panels C and D. The 2x2 therefore cannot be drawn to a single scale, and the file says
    that instead of supplying a number from elsewhere.

Offline. Usage: python -I genotype/build_compare_2x2.py
"""
import json, os, re, time

HERE = os.path.dirname(os.path.abspath(__file__))
def load(p, d=None):
    try: return json.load(open(p, encoding="utf8"))
    except Exception: return d
FR = load(os.path.join(HERE, "cache", "daane2021_fin_ratios.json"), {})
CH = load(os.path.join(HERE, "causal-chains.json"), {})
IV = load(os.path.join(HERE, "interventions.json"), {})
chain = {g["symbol"]: g for g in CH.get("genes", [])}
ivs = {i["id"]: i for i in IV.get("interventions", [])}
groups = FR.get("groups", {})
species_rows = FR.get("species", [])
def grp(name): return groups.get(name, {})
def quote(sym, pat):
    for st in (chain.get(sym, {}).get("chain") or []):
        for s in (st.get("sources") or []):
            if re.search(pat, str(s.get("quote") or ""), re.I): return {"quote": s["quote"], "pmid": s.get("pmid"), "doi": s.get("doi"), "read": s.get("read")}
    for c in CH.get("cross_gene", []):
        for s in (c.get("sources") or []):
            if re.search(pat, str(s.get("quote") or ""), re.I): return {"quote": s["quote"], "pmid": s.get("pmid"), "doi": s.get("doi"), "read": s.get("read")}
    # the interventions file carries quotes the chains do not, e.g. the body-size negative control
    for iv in IV.get("interventions", []):
        for s in (iv.get("sources") or []):
            if re.search(pat, str(s.get("quote") or ""), re.I): return {"quote": s["quote"], "pmid": s.get("pmid"), "doi": s.get("doi"), "read": s.get("read"), "from": iv.get("id")}
    return None

FIG_ONLY = ("The measurement exists but only as a figure panel: no numeric value for it appears anywhere in the paper's text, legends or Data S1, "
            "whose fourteen sheets are comparative genomics and beloniform specimen measurements, with no zebrafish sheet. Not digitised here.")

panels = [
 {"panel": "A", "species": "Danio rerio (zebrafish)", "fin_state": "ordinary fins", "role": "the real starting point",
  "genotype": {"description": "wild type", "alleles": [], "level": None, "germline": None},
  "phenotype": {"pectoral_over_SL": None, "value_status": "NOT MEASURED IN ANY FETCHED SOURCE",
                "note": ("No fetched source reports pectoral fin length over standard length for a wild-type zebrafish. The only wild-type zebrafish fin "
                         "measurement this thread holds is caudal lepidotrichial segment length, 290.7 +/- 32.7 micrometres (n = 10 fin rays), which is a "
                         "different quantity on a different fin. So panel A cannot be placed on the same axis as panels C and D, and the comparison is "
                         "qualitative on the zebrafish side."),
                "what_is_known": "caudal ray segment length 290.7 +/- 32.7 um (n=10 rays), wild type, from the connexin literature"},
  "stage_of_perturbation": None, "evidence_grade": "not applicable (no perturbation)",
  "sources": []},

 {"panel": "B", "species": "Danio rerio (zebrafish)", "fin_state": "enlarged paired fins, the 'winged zebrafish'", "role": "the real experiment, and the closest thing to a made flying fish",
  "genotype": {"description": ("trans-heterozygote of two dominant alleles: lat4a nr21 (ZFIN slc43a2a, allele dmh26, a T200K substitution in a conserved domain of "
                               "the L-type amino acid transporter, on chromosome 15) together with kcnh2a lof (the classic longfin dt2 allele, a chromosome-2 "
                               "inversion that leaves both coding regions intact and places the prrx1a regulatory region upstream of the kcnh2a transcription "
                               "start site, so kcnh2a is ectopically expressed in fins)"),
               "alleles": ["lat4a nr21 / + (dmh26, T200K, gain of function)", "kcnh2a lof / + (lof dt2, cis-regulatory inversion)"],
               "level": "one coding and one cis-regulatory, in combination",
               "germline": True,
               "germline_note": ("Both are germline alleles carried in the fish line, so the perturbation is present from fertilisation, which is what 'from the "
                                 "beginning of development' requires. Note the contrast with the same paper's sufficiency experiment, which injected a HUMAN "
                                 "KCNH2 transgene to make somatic mosaic clones: that one is NOT germline and is a different experiment."),
               "gain_of_function_evidence": ("lat4a nr21 is a gain of function, shown by reversion: CRISPR frameshifts made in cis to the nr21 allele revert the fin "
                                             "phenotype to wild type, and fish lacking lat4a altogether have no fin phenotype.")},
  "phenotype": {"pectoral_over_SL": None, "value_status": "FIGURE PANELS ONLY", "figure_panels": ["Figure 4B pectoral fin length", "Figure 4C caudal fin length", "Figures S2A and S2B lepidotrichial segments"],
                "note": FIG_ONLY,
                "qualitative_in_the_papers_words": {"paired_fins": "overgrown", "medial_fins": "wild-type-sized", "caudal_fin": "generally wild type in size but hypocercal, with an elongated ventral lobe",
                                                    "segments": "regular segmentation is maintained, unlike the kcnk5b overgrowth mutant whose segmentation is irregular"},
                "single_mutants_for_contrast": {"kcnh2a lof / + alone": "all fins overgrown", "lat4a nr21 / + alone": "all fins shortened, and lepidotrichial segments shorter",
                                                "lat4a nr21 body size": "NOT reduced: the paper states the mutant 'does not have a statistically decreased body size', so the fin change is allometric, not a change in overall growth",
                                                "lat4a null (mh152)": "no fin phenotype at all"},
                "why_this_panel_matters": ("The non-additivity is the result: two dominant alleles that each change all fins combine to change the fins DIFFERENTLY from "
                                           "each other, leaving medial fins wild type while the paired fins stay overgrown. That fin-type-specific outcome is what "
                                           "resembles a flying fish, not the size change alone.")},
  "stage_of_perturbation": {"germline": True, "acts_from": "fertilisation (both alleles are in the germline)",
                            "when_phenotype_is_scored": "adult; the fin measurements and the images are of adult fish"},
  "evidence_grade": "mechanism for the interaction (reversion, in-cis CRISPR, qRT-PCR showing kcnh2a expression is unchanged by nr21, so lat4a acts downstream rather than through kcnh2a levels)",
  "the_papers_own_claim": quote("slc43a2a", r"remarkably similar") or quote("kcnh2a", r"remarkably similar"),
  "sources": [s for s in [quote("slc43a2a", r"non-additive"), quote("slc43a2a", r"hypocercal"), quote("slc43a2a", r"does not have a statistically decreased body size")] if s]},

 {"panel": "C", "species": "Exocoetidae (flying fishes)", "fin_state": "enlarged pectoral fins, the real animal", "role": "the target phenotype, measured",
  "genotype": {"description": ("UNKNOWN. No flying-fish genetic manipulation exists and no flying-fish functional genetics of any kind was found. What exists is "
                              "comparative sequence evidence: a convergent F326L substitution in lat4a present in both gliding halfbeak genera and in at least 7 of 9 "
                              "sequenced flying-fish species, and the kcnh2a locus implicated by the same phylogenomic analysis. Neither has been tested in any species."),
               "alleles": ["lat4a F326L (convergent substitution, never engineered or assayed)"], "level": "coding, inferred from sequence only", "germline": "not applicable (natural variation)"},
  "phenotype": {"pectoral_over_SL": grp("flying fish").get("pectoral_over_SL_median"), "value_status": "MEASURED, by the Daane authors on museum specimens",
                "range": [grp("flying fish").get("pectoral_over_SL_min"), grp("flying fish").get("pectoral_over_SL_max")],
                "n_specimens": grp("flying fish").get("n_specimens"), "SL_range_cm": [grp("flying fish").get("SL_cm_min"), grp("flying fish").get("SL_cm_max")],
                "species": [r for r in species_rows if r.get("group") == "flying fish"],
                "allometry_in_the_papers_words": "the length of flying fish pectoral fins increases rapidly as the body grows, and the relationship is identical across two- and four-wing flying fishes"},
  "stage_of_perturbation": {"germline": "not applicable", "acts_from": "the species' own development; nothing was perturbed",
                            "note": "Specimens are preserved adults and juveniles across a 1.7 to 24 cm standard-length range; the smallest specimens have the lowest ratios, so the trait develops with size rather than being fixed."},
  "evidence_grade": "measurement (not an experiment): a morphometric series, with the genetics only associated by comparative genomics",
  "sources": [{"doi": "10.1016/j.cub.2021.08.054", "pmid": "34534441", "note": "Data S1A, sheet 'A - fin measurement'; re-tabulated by genotype/fin_ratios_table.py"}]},

 {"panel": "D", "species": "Exocoetidae (flying fishes)", "fin_state": "ordinary fins, the 'wingless flying fish'", "role": "hypothetical; the panel with no genetics at all",
  "genotype": {"description": ("HYPOTHESIS ONLY. No experiment has ever removed or reduced a flying fish's pectoral fins, and no flying-fish gene has been manipulated. "
                              "Two routes are conceivable from the comparative evidence and neither has been tested in any organism: reverting the convergent lat4a F326L "
                              "substitution to the ancestral residue, or reverting the kcnh2a regulatory state implicated by the phylogenomics. Both are labelled hypothesis "
                              "and must not be presented as routes that are known to work."),
               "alleles": ["lat4a F326L reverted to ancestral (untested)", "kcnh2a regulatory state reverted (untested, and the regulatory lesion in flying fish is not even characterised)"],
               "level": "hypothesis", "germline": "would have to be germline to act from the beginning of development, which is itself untested"},
  "phenotype": {"pectoral_over_SL": None, "value_status": "NOT OBSERVABLE: no such animal exists. The values below are its non-gliding RELATIVES, measured, and stand in for the phenotype.",
                "nearest_real_proxies": {k: {"median": grp(k).get("pectoral_over_SL_median"), "range": [grp(k).get("pectoral_over_SL_min"), grp(k).get("pectoral_over_SL_max")],
                                             "n_specimens": grp(k).get("n_specimens")} for k in ("flying halfbeak", "halfbeak", "needlefish") if grp(k)},
                "reading": ("Within the same order, pectoral fin length over standard length runs from about %s in needlefishes and %s in halfbeaks, through %s in the two "
                            "gliding halfbeak genera, to %s in flying fishes. The gliding halfbeaks sit between the two, which is why the series reads as a graded trait "
                            "rather than a switch. A 'wingless flying fish' would be expected to sit near the halfbeak end, but that is an inference from relatives, not a "
                            "measurement of a flying fish.") % (grp("needlefish").get("pectoral_over_SL_median"), grp("halfbeak").get("pectoral_over_SL_median"),
                                                                grp("flying halfbeak").get("pectoral_over_SL_median"), grp("flying fish").get("pectoral_over_SL_median"))},
  "stage_of_perturbation": {"germline": "would have to be", "acts_from": "not applicable: no perturbation has been done"},
  "evidence_grade": "hypothesis for the genotype; measurement for the proxy phenotypes",
  "sources": [{"doi": "10.1016/j.cub.2021.08.054", "pmid": "34534441", "note": "comparative series from Data S1A; the convergent substitution from sheet 'G - conv. aa subst.'"}]},
]

out = {
 "title": "Four-panel developmental comparison: zebrafish and flying fish, with and without enlarged paired fins",
 "status": ("Panels A to C rest on real data; panel D is HYPOTHESIS ONLY. Nothing here is a flying-fish genetic experiment, because none exists. "
            "A flying fish's wing is an enlarged pectoral fin, so this is about fin proportion, not about a fin becoming a wing."),
 "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tool": "genotype/build_compare_2x2.py",
 "axes": {"species": ["Danio rerio (zebrafish)", "Exocoetidae (flying fishes)"], "fin_state": ["ordinary fins", "enlarged paired fins"]},
 "the_two_limits_of_this_comparison": [
   ("The zebrafish side has no number on the flying fish's axis. No fetched source measures pectoral fin length over standard length in a wild-type zebrafish, and "
    "every measurement of the winged zebrafish lives in a figure panel. So the 2x2 cannot be drawn to one scale: the zebrafish panels are qualitative and the "
    "flying-fish panels are quantitative."),
   ("Only one of the four panels is an experiment. Panel B is a real germline double heterozygote. Panel C is a morphometric series. Panel A is a baseline that was "
    "never measured on this axis, and panel D is an animal that does not exist.")],
 "panels": panels,
 "quantitative_summary_where_numbers_exist": {k: {"median_pectoral_over_SL": grp(k).get("pectoral_over_SL_median"), "n_specimens": grp(k).get("n_specimens")}
                                              for k in ("flying fish", "flying halfbeak", "halfbeak", "needlefish") if grp(k)},
 "how_to_read_this": ["A figure-only measurement is reported as figure-only. Nothing was digitised from a plot.",
                      "Germline is stated per panel, because 'from the beginning of development' excludes the somatic mosaic experiments in the same paper.",
                      "The winged zebrafish is a trans-heterozygote of two DOMINANT alleles, so it is not a knockout of anything.",
                      "The interesting result in panel B is non-additivity between the two alleles, not the size change."]}
json.dump(out, open(os.path.join(HERE, "compare-2x2.json"), "w", encoding="utf8"), separators=(",", ":"))
print(json.dumps({"panels": [{"panel": p["panel"], "species": p["species"], "fin_state": p["fin_state"], "value": p["phenotype"].get("pectoral_over_SL"),
                              "status": p["phenotype"]["value_status"][:46], "germline": p["genotype"].get("germline"), "grade": p["evidence_grade"][:40]} for p in panels],
                  "numbers": out["quantitative_summary_where_numbers_exist"]}, indent=1))
print("compare-2x2.json KB", round(os.path.getsize(os.path.join(HERE, "compare-2x2.json")) / 1e3))
