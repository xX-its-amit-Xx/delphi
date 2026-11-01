# Organism-design scorer benchmark (v1)

This benchmark tests whether the design scorer (`sim-engine/validate/score.mjs`, `designScore(design, opts)`) gives
real fish high scores and impossible or decoy designs low ones. It was built **independently of the scorer**: the
builder never read `score.mjs`, `score-weights.json`, `scorer-results*.json` or `validate/data/fishshapes-features.json`.
Raw data were fetched from the original sources (cached under `C:/Temp/benchmark-cache`) and checked by sha256.
Pass criteria are fixed in `BENCHMARK-PREREGISTRATION.md`, which was hashed before any score existed.

> **SCORER AUTHOR: DO NOT READ `heldout/`.** That folder is the blind test set (30% of fish families). Only the blind
> evaluator opens it, once, after the scorer and its weights are frozen. Reading it voids the headline result.

## Files

| path | what |
|---|---|
| `dev/items.jsonl` | Dev partition: positives and labelled negatives, one JSON object per line |
| `dev/own-models.jsonl` | The repository's own parametric organisms and designs (7). **Unlabelled**: scored and reported, never counted as positives (the hub's ruling: their peduncle widths and masses fall outside measured specimens of their families) |
| `heldout/items.jsonl`, `heldout/families.json` | Blind test partition. Off limits to the scorer author |
| `splits/splits.json` | Leave-one-specimen, species, genus and family-out definitions, plus the held-out rule |
| `sources.json` | Citation, licence and URL for the two large datasets (items point to them by `source.id`) |
| `BENCHMARK-PREREGISTRATION.md`, `PREREG.sha256` | What "pass" means, fixed before scoring |
| `manifest.json` | Counts by type, source and taxon, and the sha256 of every file |
| `build/build.py`, `build/lean_negatives.mjs` | Deterministic builders (seed 20261101). `build/stats.json` holds screening counts and raw-input hashes. `build/lean-controls.json` holds the Lean sanity controls |

Rebuild: `node build/lean_negatives.mjs C:/Temp/benchmark-cache/lean-negatives.json`, then `python build/build.py`. Run
these from a scratch directory, with the raw files in the cache.

## Item format

```
id, label: positive | negative | unlabelled,
subset (positives) | neg_type (negatives), difficulty (negatives: easy | standard | hard),
params: { trait: value }        <- THE DESIGN: parameter vector, design-schema names where they exist
features_present: [trait, ...]  <- which traits the item has (score on the shared subset, see below)
lean_spec (some items)          <- SI spec for lean_check (taxon, SL_m, mass_kg, finArea_m2, airspeed_m_s, ...)
doc (some items)                <- studio organism document {id, base:{parents}, edits}
taxon {species, genus, family, order[, class, family_fishbase, family_alt]}  (null for synthetic negatives; base_taxon kept for reporting)
source, exclusion {specimen, species, genus, family}, partition, donors / trait_donor (negatives)
```

Only `params`, and `lean_spec` or `doc` where present, may go to the scorer. Every other field is for the
evaluator (see the preregistration, section 1).

### Traits

| trait | schema name? | sources |
|---|---|---|
| `standard_length_m`, `body_mass_kg` | yes | FishShapes (measured mass), ontogeny, Park & Choi |
| `body_depth_over_SL`, `body_width_over_SL` | yes | FishShapes; depth also from FishBase |
| `peduncle_depth_frac` (min peduncle depth / max body depth), `peduncle_width_frac` (min peduncle width / max body width) | yes | FishShapes |
| `pectoral_span_over_SL`, `pectoral_area_over_SL2` (both fins), `pectoral_len_over_SL`, `pelvic_len_over_SL`, caudal, dorsal and anal lobe and height ratios | yes | Park & Choi, ontogeny, mutant baselines |
| `head_depth_over_body_depth`, `lower_jaw_over_SL`, `mouth_width_over_SL` | extra | FishShapes |
| `head_length_over_SL`, `caudal_fin_height_over_SL`, `caudal_fin_aspect_ratio`, `pre{dorsal,anal,pelvic,pectoral,orbital}_over_SL`, `eye_diameter_over_SL` | extra | FishBase MORPHMET (measured on pictures, so ratios only) |
| `pelvic_area_over_SL2`, `body_planform_area_over_SL2`, `fork_length_m`, organ volume fractions, flight-claim fields | extra | as listed |

**Shared subset.** For FishShapes-derived items it is `standard_length_m`, `body_mass_kg`, `body_depth_over_SL`,
`body_width_over_SL`, `peduncle_depth_frac` and `peduncle_width_frac` (all schema parameters). FishBase items share
only `body_depth_over_SL` with the schema. Their other traits test a scorer that uses them. **No large source
measures paired-fin size.** Fin traits come only from the small curated sets.

## Contents (v1)

**Positives: real, existing fish**

| subset | n | notes |
|---|---|---|
| `fishshapes_specimen` | 16,461 specimens | FishShapes v1 (Price et al. 2022 Ecology, CC0; Zenodo 6642650, raw sha256 `7447fdc9…`); 8 dropped for no SL, 54 by a transcription-error screen (a ratio above 2, a peduncle or head deeper than 1.5× the body, or Fulton K outside [0.02, 30]) |
| `fishbase_picture` | 13,114 pictures | FishBase MORPHMET v24.07 (rfishbase parquet mirror; **CC BY-NC 4.0**). Includes some sharks, rays, lampreys and hagfish: real fish, `taxon.class` tagged |
| `specimen_with_fins` | 3 | Park & Choi 2010 *Cypselurus hiraii* L1–L3: SL, mass, pectoral span and area, pelvic area |
| `specimen_mass_length` | 13 | Makiguchi 2013 *Cheilopogon heterurus*: fork length and mass |
| `ontogeny_stage` | 12 | Every zebrafish and flying-fish stage in `sim-engine/params/ontogeny.json`, with per-trait kinds in `param_kinds` (many derived or assumed). Reported as a separate subset |
| `mutant_quantified` | 8 | hhip uki (+65% pectoral area; +50% dorsoventral extent), prdm1a tp39 (−30% pectoral length), prdm1a m805 (−10.6% fin fold), gja1b sof (50%) and stp (95%), FK506 (+50%), valproic acid (84%), from `genotype/interventions.json` |
| `mutant_qualitative` | 4 | Daane 2021 winged zebrafish (kcnh2a lof/+ ; lat4a nr21/+), longfin, another longfin (alf) and alf dty86. Direction only: the numbers exist only in figures |
| `mutant_baseline` | 2 | Wild-type pair for the mutant tests (adult and larva) |

Positive taxa: 13,606 species, 3,735 genera, 560 families, 98 orders.

**Negatives**, labelled by `neg_type`:

| type | difficulty | how |
|---|---|---|
| `decoy_shuffle_all` | standard | One real specimen per species. Every trait is taken from a specimen of another family, with length and mass taken together from one donor. Marginals stay realistic and correlations are broken |
| `decoy_shuffle_shape` | standard | Size and mass kept, and every shape ratio taken from other families |
| `decoy_shuffle_one` | hard | Only one trait swapped in. It may well still be plausible |
| `out_of_range_extrapolation` | easy | One trait set to 2, 3 or 5× the maximum (or 1/2, 1/3 or 1/5 of the minimum) seen across all screened fish in that source |
| `chimera_extreme_corner` | hard | Every trait at the 0.5th or 99.5th percentile. Each value is real on its own, and the combination is an extreme chimera |
| `law_breaker` | easy | Real Park & Choi specimens with flight claims that **violate accepted Lean laws** (C9 minimum speed, C15 glide ratio). Each was confirmed with `lean/eliminate/browser-check.mjs` `check()`, which must return ≥1 violated row with an absolute relation and registry status `accepted`. The verdicts are stored in `lean_check`. The same specimens with realistic claims violate nothing (`build/lean-controls.json`). This is not a kernel check |
| `impossible_combo` | easy | Glide wing loading or glide claims combined with a zebrafish body or launch speed, and zebrafish-sized pectorals on a flying-fish glide. Each was Lean-confirmed in the same way. One candidate (current 10× Ucrit) was dropped because no accepted law fired on it |
| `organ_containment` | easy | An internal organ asked to exceed the body volume (swim bladder 5.1% of body volume × 25, 40 or 80; liver, heart or brain overfill; girdle muscle × 8 or 15). Checked by arithmetic against partedit's refusal rule; the part ids were not validated against the mesh manifest in v1 |

## Splits and partitions

See `splits/splits.json`. For every item, `exclusion` lists the specimen (museum lot or picture), species, genus
and family of every real specimen it was built from. For a positive that is the item itself. For a negative it is
the base specimen plus all trait donors. Under a split, the scorer's reference set must drop every record that
matches. Decoys and extrapolations draw their donors only from their own partition, so held-out families never leak
into dev negatives.

Held-out: 168 of 560 families, chosen by salted hash before scoring.

## Caveats

- FishShapes and the scorer's own reference data very likely overlap. That is why the leave-out splits and the
  held-out families exist. **Only LOFO on held-out is the headline.**
- FishBase ratios are measured on pictures of single specimens, which may be drawings. Their quality varies.
- The mutant absolute fin values rest on the repository's **assumed** wild-type fin placeholders, so mutants are a
  relative test against `paired_baseline`.
- No bird (Aves) data anywhere. Bird orders and class are filtered explicitly and asserted absent from the final
  taxa. The count is 0 dropped, because the sources hold only fish.
