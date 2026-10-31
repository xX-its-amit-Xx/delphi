# anatomy-model/zebrafish: segmented zebrafish, adult and larva

Most of our genotype-to-phenotype evidence was measured in zebrafish (*Danio rerio*): the gene map, the causal
chains, the cell and tissue interactions, and the interventions in `genotype/interventions.json`. A zebrafish model
lets the Design Studio apply those results without moving them across species. It can also test whether the Studio
reproduces known mutant phenotypes. There are two models, one for each stage at which the measured knobs live:

| model | stage | file | objects |
|---|---|---|---|
| adult | adult, sex not specified | `dashboard/public/blueprint3d/model/zebrafish-adult.glb` (4.4 MB) | 189 |
| larva | ~4-5 dpf, at posterior swim bladder inflation (Parichy 2009 milestone pSB, ~3.5 mm SL) | `dashboard/public/blueprint3d/model/zebrafish-larva.glb` (2.5 MB) | 58 |

Both follow the flying-fish precedent (`anatomy-model/build_fish.py`):

- Every anatomical piece is its own named mesh.
- Left and right halves are separate objects (`_L` / `_R`), so the viewer can split the fish sagittally.
- Pieces sit in four layers: outer, muscle, skeleton, organ.
- Each piece carries glTF node extras: `label`, `ontology_id`, `zfa_id`, `uberon_id`, `layer`, `side`,
  `organ_system`, `level`.
- A manifest gives each piece a `geometry_basis`. It says either `sourced: <ref, value>` or `schematic`.

| file | what |
|---|---|
| `build_adult.py` | adult model, plus the shared toolkit (mesh helpers, body frame, registry, export, renders) |
| `build_larva.py` | larva model; imports the toolkit from `build_adult.py` (whose `main` does not run on import) |
| `manifest-adult.json`, `manifest-larva.json` | one entry per mesh object; copies sit next to the GLBs in `dashboard/public/blueprint3d/model/` |
| `sources.json` | every sourced value, with verbatim quotes, DOI/PMCID and the derivation; cross-checks; what was not found |
| `calls.json` | the Ubergraph SPARQL calls (POSTed), the ZFA→Uberon table, part_of checks, a final re-verification, and the literature URLs fetched |

## Rebuild

From the repo root, with Blender 4.2.23 LTS (portable, `C:\Temp\tools\blender\`):

```
C:\Temp\tools\blender\blender-4.2.23-windows-x64\blender.exe -b --factory-startup --python anatomy-model\zebrafish\build_adult.py -- [--no-render] [--samples 24]
C:\Temp\tools\blender\blender-4.2.23-windows-x64\blender.exe -b --factory-startup --python anatomy-model\zebrafish\build_larva.py -- [--no-render] [--samples 24]
```

Other options: `--glb PATH`, `--manifest PATH`, `--renders DIR`, and `--only name1,name2` (renders only the named
views). Each build takes a few seconds. With 8 Cycles renders it takes about a minute.

Each script checks that every internal object lies inside the skin surface and prints `INSIDE_CHECK OK`. The
exception is the end of the adult posterior intestine, which opens at the vent.

The scripts read `sources.json` and `calls.json`. They make no network calls. Renders are written to
`C:\Temp\fish-models\zebrafish-renders\{adult,larva}\`:

| render | view |
|---|---|
| 01 | whole, three-quarter |
| 02 | lateral |
| 03 | split halves |
| 04 | skin off |
| 05 | muscle off (skeleton and organs) |
| 06 | organs only |
| 07 | skeleton only |
| 08 | adult: organs, lateral; larva: dorsal |

## Axes, scale, viewer notes

- **Axes.** The GLB is glTF Y-up. Head at **+X**, back at **+Y**, the fish's left side at **-Z**. This matches
  the flying fish.
- **Adult scale.** Standard length is 0.78 units and total length about 0.96 units. The reference adult SL is
  25.7 mm (Hur 2017), so 1 unit is about 33 mm.
- **Larva scale.** SL is 0.88 units, measured from the snout to the notochord tip (the pre-flexion SL of
  Parichy 2009). The total length to the fin-fold edge is about 0.97 units. 1 unit is about 4.0 mm at 3.5 mm SL.
- **Origins and the manifest.** Each object's origin is at its bounding-box centre, and `centre_gltf` gives that
  centre. `ontology_id` is the **ZFA** id. `uberon_id` is its Uberon cross-reference.
- **Viewer compatibility.** The current viewer (`explode.html`) resolves `ontology_id` against `data.json` and then
  falls back to `zfa_id`. ZFA ids that are not in its files will show as "no node in the files" until the viewer
  learns ZFA. The viewer loads `model/flying-fish.glb` and `model/manifest.json` today. Pointing it at these
  models (`model/zebrafish-*.glb` with `model/manifest-*.json`) is a viewer change, left to the hub.
- **Gotchas carried over from the flying fish.**
  - Vertex-coloured materials (skin, eyes, fins, fin folds, notochord) have a **white** base colour, so `COLOR_0`
    shows unmodified.
  - Membranes are BLEND-transparent: adult fins alpha 0.80, larval fin folds 0.26, larval skin 0.16, otic
    vesicle 0.6.

## Adult (189 objects)

- **outer (17)**
  - `skin_L/R` with the stripe pattern in vertex colours. From back to belly: olive dorsum, 2D, interstripe, 1D,
    the wide interstripe at the horizontal myoseptum, 1V, interstripe, 2V (posterior only), white belly. The
    stripes run ~5° off the horizontal myoseptum and continue onto the caudal fin, as Parichy 2009 describes.
    Stripe widths are schematic.
  - `eye_L/R`, `maxillary_barbel_L/R`, `nasal_barbel_L/R`, `lateral_line_L/R` (a neuromast row).
  - Fin membranes: `pectoral_fin_L/R`, `pelvic_fin_L/R`, `dorsal_fin`, `anal_fin` (blue/gold bands), `caudal_fin`
    (forked, with horizontal stripes).
- **muscle (2):** `muscle_L/R`. Each is 32 W-shaped myomeres, split into epaxial and hypaxial halves at the
  horizontal myoseptum.
- **skeleton (140)**
  - Fin rays, one object per lepidotrichium, segmented and branched distally (the leading rays are unbranched):
    `pectoral_fin_ray_L/R_01..10`, `pelvic_fin_ray_L/R_01..07`, `dorsal_fin_ray_01..10`, `anal_fin_ray_01..15`,
    `caudal_fin_ray_01..18`, plus `caudal_fin_procurrent_rays`.
  - Vertebrae `vertebra_01..32`. Numbers 01-04 are the Weberian vertebrae; precaudal vertebrae carry
    parapophyses; caudal vertebrae carry haemal arches and spines.
  - `ribs_L/R` and `weberian_ossicles_L/R` (scaphium, claustrum, intercalarium and tripus, simplified).
  - Head: `neurocranium_L/R` (roof shell), `opercle_L/R`, `dentary_L/R`, `premaxilla_L/R`, `maxilla_L/R`,
    `ceratobranchial_5_L/R` with pharyngeal teeth. Zebrafish have no oral teeth.
  - Pectoral girdle: `cleithrum_L/R`, `scapula_L/R`, `coracoid_L/R`, `pectoral_radials_L/R`.
  - `basipterygium_L/R`, `dorsal_fin_radials`, `anal_fin_radials`, `hypurals` (1-5), `parhypural`.
- **organ (30)**
  - Brain regions: `brain_olfactory_bulbs`, `brain_telencephalon`, `brain_optic_tectum`, `brain_hypothalamus`,
    `brain_cerebellum`, `brain_medulla_oblongata`; also `spinal_cord`.
  - `inner_ear_L/R` (with three otoliths) and `gills_L/R` (4 arches with filaments).
  - Heart: `heart_sinus_venosus`, `heart_atrium`, `heart_ventricle`, `heart_bulbus_arteriosus`.
  - Gut, with **no stomach**: `oesophagus` → `intestinal_bulb` → looped `mid_intestine` → `posterior_intestine` to
    the vent.
  - `liver` (3 lobes), `gall_bladder`, `pancreas` (diffuse lobules), `spleen`.
  - Two-chambered swim bladder: `swim_bladder_anterior_chamber`, `swim_bladder_posterior_chamber`,
    `pneumatic_duct`.
  - `kidney`, `head_kidney`, `gonad_L/R`.

## Larva (58 objects)

The pectoral fin is drawn as its measurable parts, because those are the DELPHI knobs at this stage:

| object | knob |
|---|---|
| `cleithrum_L/R` | prdm1a cleithrum length, 4 dpf |
| `pectoral_fin_endoskeletal_disc_L/R` | prdm1a endoskeletal disc length, 4 dpf |
| `pectoral_fin_fold_L/R` | prdm1a fin fold size, 4 dpf; hhip pectoral fin area, 72 hpf |
| `pectoral_fin_musculature_L/R`, `pectoral_fin_actinotrichia_L/R` | (no knob) |

- **outer (14)**
  - `skin_L/R` (nearly transparent), `eye_L/R`.
  - The larval melanophore stripes Parichy 2009 describes: `melanophore_stripe_dorsal`, `_ventral`,
    `_lateral_L/R`, `_yolk`. The cells are dendritic; their counts are schematic.
  - `lateral_line_neuromasts_L/R`.
  - `median_fin_fold`: one continuous fold, dorsal, around the tail and ventral to the preanal region. It is not
    separate fins.
  - `pectoral_fin_fold_L/R`.
- **muscle (4):** `myotomes_L/R` (32 chevron segments; Kimmel 1995 gives 30-34 somite pairs) and
  `pectoral_fin_musculature_L/R`.
- **skeleton (13)**
  - `notochord`, a vacuolated rod; vertebrae are not ossified yet.
  - Head cartilages: `neurocranium_cartilage`, `meckels_cartilage`, `ceratohyal_cartilage`,
    `pharyngeal_arch_cartilages_L/R`.
  - `cleithrum_L/R`, `pectoral_fin_endoskeletal_disc_L/R`, `pectoral_fin_actinotrichia_L/R`,
    `median_fin_fold_actinotrichia`.
- **organ (27)**
  - Brain: `brain_telencephalon`, `brain_optic_tectum`, `brain_cerebellum`, `brain_medulla_oblongata`; also
    `spinal_cord`.
  - Eyes and ears: `lens_L/R`, `otic_vesicle_L/R`, `otoliths_L/R` (two per ear).
  - Heart: `heart_atrium`, `heart_ventricle`, `heart_bulbus_arteriosus`.
  - Yolk: `yolk` (remnant) and `yolk_extension`.
  - Gut and digestive glands: `oesophagus`, `intestinal_bulb`, `intestine` to the vent, `liver` (left side),
    `pancreas` (right side).
  - `swim_bladder`: the single posterior lobe, inflating.
  - Kidney: `pronephros` and `pronephric_duct_L/R`.
  - Vessels: `dorsal_aorta`, `posterior_cardinal_vein`.

## Sourced vs schematic

All values below were read from text fetched in this session. The quotes are in `sources.json`.

**Adult.** Standard length 25.7 mm (Hur 2017) is used to evaluate the Parichy 2009 Table 3 size regressions:

| value | result | source |
|---|---|---|
| body depth at the dorsal fin origin | **0.287 SL** | 1/3.49, control zebrafish, Jiang 2026 |
| depth at nape | **0.227 SL** | Parichy 2009 Table 3 regression |
| depth at the anal fin origin (HAA) | **0.233 SL** | Parichy 2009 Table 3 regression |
| head (nose to operculum) | **0.295 SL** | Parichy 2009 Table 3 regression |
| eye diameter | **0.104 SL** | Parichy 2009 Table 3 regression |
| snout to vent | **0.661 SL** | Parichy 2009 Table 3 regression |

Parichy notes that its regressions depart moderately from linearity above ~15 mm SL. The counts are sourced:

| count | value | source |
|---|---|---|
| vertebrae | **32** (4 Weberian + 10 precaudal + 15 caudal + 3 caudal fin) | Bearce 2022 (Van Wynsberghe 2023 gives 31) |
| pectoral fin rays | **10** | Corcoran 2026 |
| pelvic fin rays | **7** | Corcoran 2026 |
| dorsal fin rays | **~10** | Parichy 2009 (Corcoran counts 8) |
| anal fin rays | **~15** | Parichy 2009 (Corcoran 13, Adachi 15.8) |
| caudal principal rays | **18** | inferred from Surette 2025 |
| hypurals | **5** | Parichy 2009 |
| gill-bearing arches per side | **4** | Kimmel 1995, via ZFIN |

The stripe order and the fact that body and fin stripes are continuous come from Parichy 2009.

**Schematic in the adult:**

- body width, outline curvature and caudal peduncle depth (0.115)
- fin lengths: pectoral 0.19, pelvic 0.14, caudal 0.28 SL
- fin origins: dorsal 0.52, pelvic 0.47, anal = vent + 0.015 SL
- the fork shape of the caudal fin
- the rib pair count (10, one per precaudal vertebra)
- myomere count, set equal to the vertebra count
- all skull and jaw shapes
- the shape, size and position of every organ
- the counts of barbels, neuromasts and gill filaments

**Larva.** The Parichy 2009 regressions are evaluated at the pSB milestone, 3.5 mm SL:

| value | result | source |
|---|---|---|
| depth at nape | **0.130 SL** | Parichy 2009 regression |
| head (nose to operculum) | **0.241 SL** | Parichy 2009 regression |
| eye diameter | **0.099 SL** | Parichy 2009 regression |
| snout to vent | **0.570 SL** | Parichy 2009 regression |
| myotomes | **32** | midpoint of 30-34 somite pairs, Kimmel 1995 via ZFIN |
| swim bladder at inflation | **a single posterior lobe** | Parichy 2009 |

The larval melanophore stripe pattern is also from Parichy 2009. Direct eye measurements at 96-120 hpf are smaller,
0.07-0.08 of body length (Liu 2026, Jafari 2026). They are recorded in `sources.json` as cross-checks, and the model
keeps the regression value. The pectoral fin length (0.13 SL) is schematic. It is chosen so the fin reaches past
the middle of the yolk, as Kimmel describes from 60 h.

**Wild-type pectoral fin area at 72 hpf.** The hhip paper (Koudijs 2005, PMC1189072) measured area as a pixel
count. The text reports only the mutant change: +65% area, +50% dorsoventral size. Absolute wild-type values appear
only as bar charts (Fig. 2H-I), so none is recorded.

**Not found in any fetched text:** adult fin lengths and fin origin positions, caudal peduncle depth, rib pair
count, and larval notochord, yolk, otic vesicle, heart and swim bladder sizes.

## Ontology (ZFA, with Uberon xrefs)

Coverage is 247/247 objects with a ZFA id and an Uberon xref (adult 189/189, larva 58/58). No id is null.

- Every id was found in Ubergraph by an exact `rdfs:label` or `oboInOwl:hasExactSynonym` match. The queries were
  POSTed, with literals typed as `xsd:string`.
- The Uberon id is the class whose `oboInOwl:hasDbXref` carries the ZFA id.
- A final re-query of all 98 ids used, including the organ-system ids, found no label changes, no deprecations and
  no xref changes (`calls.json` → `verification`).

Some mappings are deliberately broader than the mesh. Each says so in its manifest note:

| object | mapped to | why |
|---|---|---|
| adult `muscle_L/R` | `myotome` | ZFA's segmented trunk muscle |
| `caudal_fin_procurrent_rays` | `caudal fin lepidotrichium` | |
| `inner_ear_L/R` | `inner ear` | the mesh includes its otoliths |
| larva `neurocranium_cartilage` | `neurocranium` | |
| larva `swim_bladder` | `posterior chamber swim bladder` | the lobe present at inflation |
| `yolk_extension` | `extension` | ZFA's label for the yolk extension |

**Organ systems.** These are assigned by hand. ZFA part_of links to system terms were checked for a subset; the
results are in `calls.json` → `part_of_checks`. Three groups have no ZFA part_of link to any system, so their
`organ_system_id` is null with a note: the fins, the swim bladder (`buoyancy`) and the notochord. The yolk has no
organ system either.

## Limits

- **All anatomy is schematic** apart from the values listed above. Organ positions follow textbook teleost and
  zebrafish layout, not segmented scan data. No external meshes were used.
- **The adult skull is simplified.** It has a roof shell, the opercle and jaw bars. Individual cranial bones,
  branchiostegal rays and the full branchial skeleton are not modelled.
- **The fins are in one pose.** The adult pectoral fins are swept back and down; the larval pectoral fins are held
  out from the body.
- **No sex differences.** The gonads are generic.
