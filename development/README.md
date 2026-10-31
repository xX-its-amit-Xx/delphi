# development/: data layer for the flying-fish growth time-lapse

**We do not simulate development.** The time-lapse uses only data. Length grows with age along a published
growth curve. Proportions change with size along fits to measured specimens. Stages are size and age
lookups. Where no flying-fish data exist (the embryo and the early pectoral fin), zebrafish stages from ZFIN
stand in, and every such number is labelled `proxy`. Nothing here models cells, genes or tissues producing a
shape.

**Conditions.** Per `conditions/baseline.json`, nutrition, temperature and other conditions stay at average
levels (water 25 °C, assumed). The growth curves are field fits, so they already include the average
conditions of the place they were measured. Growth is **not** adjusted for temperature or food. Where a
source reports the water temperature of a growth fit, it is kept as metadata only (`water_temperature_C_metadata`).

Default animal: *Hirundichthys affinis* (fourwing flyingfish, eastern Caribbean). It is the only flying fish with
an otolith-based growth curve, a maturity age and a longevity estimate that all come from the same region.

## Files

| file | what |
|---|---|
| `growth.json` | 12 FishBase von Bertalanffy rows (7 species; the reference is visible for every row), the default curve with three independent checks, length conversions, early-life field sizes, maturity and longevity |
| `allometry.json` | pectoral and pelvic fin length vs SL (Daane 2021, n = 49, fits computed here), fitted field length-weight rows, Davenport 1992 exponents, fin-area anchor, fetched notes on juvenile form |
| `stages.json` | egg → hatching → larva → juvenile → adult, with size, age, parts and ids; the zebrafish proxy staging series (ZFS ids, structures, ZFIN genes per stage); the first-glide answer |
| `trajectory.mjs` | `at(ageDays)` or `at({SL_m})` returns `{SL_m, mass_kg, finLength_SL, finArea_m2, wingLoading, vmin, stage, partsPresent}`; `describe()` gives the basis of each relation; `series()` |
| `trajectory.test.mjs` | `node development/trajectory.test.mjs` prints the trajectory at 10 sizes and runs checks |
| `sources.json` | full source records (keys used in every `source` field) |
| `calls.json` | every outbound request (318), with status, bytes and sha256 |

Every number is stored as `{value, unit, kind, source, locator}`. `kind` is one of `measured | secondary | proxy | assumed`.

## Relations used by trajectory.mjs

| quantity | relation | kind | basis |
|---|---|---|---|
| SL at age ≥ 14 d | SL = 0.927 × 23.3 (1 − e^(−3.12 (t − 0.01))) cm, t in years after hatching | secondary | FishBase growth autoctr 4651, Main Ref Oxenford et al. 1994 (otolith daily increments; "Validated by lab. rearing of larvae and mark-recapture of adults"). FishBase flags this row Questionable/outlier. SL/FL 0.927 is from the FishBase length-length page, which shows no reference, so it is unverified |
| checks on that curve | 11.2 cm FL at 80 d vs Campana 1993, "about 12 cm in length and an age of 80 d"; 19.9 cm FL at tm = 0.63 yr vs maturity at "about 190 mm" (Oxenford 1995); adults "about 1 yr" old (Campana 1993) | secondary/measured | three independent sources agree |
| SL from 0 to 14 d | straight line from 0.4 cm at hatching to the curve | **assumed** | no flying-fish hatch length or early growth was found |
| embryo (age < 0) | zebrafish ZFS stage at hpf = 60 (age + 7)/7 | proxy + assumed | ZFIN stage ontology. Incubation of 7 d is assumed; Munro 1954 only bounds it below 15 d |
| mass | W_g = 0.0116 FL_cm^3.01 | secondary | `physics/length-weight.csv`, *H. affinis* Barbados fitted row. Fitted on adults; applied to small fish by extrapolation |
| pectoral fin length / SL | pooled: fin_cm = 10^−0.2241 SL_cm^1.0579, i.e. ratio = 0.597 SL^0.058, capped at 0.79 | **measured fit** | Daane 2021 Data S1A, flying-fish rows (n = 49, SL 1.68–24 cm), log-log OLS: b = 1.058 ± 0.020 SE, r² = 0.983, rmse 0.049 in log10, residuals −0.196 to +0.099. Linear alternative: ratio = 0.633 + 0.00424 SL_cm (SE 0.0015; r² 0.15; rmse 0.070; residuals −0.240 to +0.169) |
| per-species fins | *E. volitans* b = 1.169 ± 0.032 (positive allometry); *H. rondeleti* 1.040 ± 0.027; *C. furcatus* 0.998 ± 0.031 | measured fit | same data; pick with `at(q, {species})` |
| fin / SL below 1.68 cm | ramp from 0.10 at hatching to the fit value | **assumed** | no flying-fish specimens below 1.65 cm SL |
| fin area | 0.006377 m² × (SL / 0.203 m)^1.834 | **assumed transfer** | Park & Choi 2010 model L3 (one *Cypselurus hiraii*) scaled with Davenport 1992's exponent from *Exocoetus obtusirostris* |
| wing loading, v_min | W/S; √(2W / (ρ S C_Lmax)), C_Lmax = 0.78, ρ = 1.225 | derived | the mass and area laws above. These imply wing loading ∝ SL^1.18, while Davenport reports 1.236 (the abstract has no CIs) |
| stage | egg < 0 d; hatching < 1 d; larva < 3 cm SL; juvenile < 17.6 cm SL; adult | assumed cut-offs placed on sourced sizes | Hunte 1995 notes that Balon (1985) concluded "flyingfish have no larval stage", so "larva" means caught by the neuston net. Adult = maturity at about 190 mm FL × 0.927 |

### Printed trajectory (from the test)

```
SL_cm  age_d   stage     mass_g    fin/SL  finArea_cm2  WL_N/m2  vmin_m/s
0.4    0       hatching  0.000924  0.1     0.0475       0.9589   1.42
1      5.88    larva     0.0146    0.3415  0.255        2.817    2.43
1.68   12.54   larva     0.0695    0.6151  0.661        5.185    3.29
3      21.14   juvenile  0.398     0.6361  1.91         10.25    4.63
5      34.45   juvenile  1.85      0.6552  4.88         18.7     6.26
8      57.77   juvenile  7.62      0.6733  11.6         32.49    8.25
12     98.52   juvenile  25.8      0.6893  24.3         52.35    10.5
16     161.59  juvenile  61.4      0.7008  41.2         73.42    12.4
19     251.37  adult     103       0.7078  56.5         89.86    13.7
21     423.05  adult     139       0.712   67.9         101.1    14.5
```

## What the 3D viewer needs

- **Pectoral fin / SL barely changes over the measured range.** Pooled, it goes from about 0.61 at 1.7 cm SL to 0.71
  at 21 cm. The smallest specimens (1.7 to 3 cm SL) already have fins 0.54 to 0.76 of SL. Above 10 cm the mean is
  0.703 (sd 0.041, n 22). So a small flying fish already has long wings. The clear exception is *Exocoetus
  volitans*: its ratio rises from about 0.54 at 3 cm to 0.72 at 17 cm.
- **Pelvic fins are relatively larger in small four-wingers.** *H. rondeleti* pelvic/SL is 0.374 below 5 cm and
  0.297 at 10 cm or more; *C. furcatus* goes from 0.49 to 0.366. Larval *H. affinis* have pectoral and pelvic fins
  "of approximately equal size" (Hunte 1995).
- **Juvenile looks** (FishBase, secondary): dark vertical bars on the body and mottled or black paired fins in several
  species. *Hirundichthys* juveniles have no chin barbel. The barbel information for *Cypselurus nossibe* is thin:
  only its smallest juvenile (4.7 cm SL) has a tiny barbel.
- **Egg:** 1.7–3.1 mm (*Exocoetus*). In non-*Exocoetus* genera it carries attachment filaments; in *Hirundichthys*
  these are cords of filaments at one pole that hold the egg to floating objects (Munro 1954).
- Below 1.68 cm SL, and before hatching, everything is proxy or assumed. The renderer should show this, for example
  by dimming the overlay.

## First glide (answer to the viewer's C9 artefact)

No fetched source gives a size or age at first gliding, or any glide speed for juveniles or larvae (searches are
listed in `stages.json → first_gliding`). What is sourced is Davenport 1992: wing loading rises with size, so
there is "the requirement for increased flying speed resulting from increased wing-loading during growth".
Checking a hatchling at a fixed 10 m/s is therefore meaningless. The derived v_min falls from about 14 m/s in an
adult to about 1.4 m/s at hatching. What limits a small fish is reaching and holding airspeed (burst swimming,
take-off), and we have no juvenile data on that. `vmin_glide_m_s` is a derived number, not a glide or no-glide verdict.

## Measured vs secondary vs proxy vs assumed

- **Flying-fish measured:** pectoral and pelvic fin length vs SL (Daane 2021 specimens); field larval and juvenile
  sizes (Hunte 1995, Oxenford 1995); adult age about 1 yr (Campana 1993); egg filaments (Munro 1954 abstract);
  Brazil maturity length (Oliveira 2015 abstract).
- **Secondary:** all von Bertalanffy parameters (FishBase transcriptions; we read none of the primary growth papers);
  length-weight and length-length rows (FishBase list pages without references, so unverified); egg diameters
  (Hunte citing Bruun 1935 and Breder 1938); maturity tm; juvenile colour and barbel notes (FishBase summaries);
  Davenport exponents (abstract only, no CIs).
- **Proxy (zebrafish):** embryo staging; pectoral fin bud onset (Prim-5, 24 hpf); AER, cartilage and girdle onset;
  the larval endoskeletal disc and when fin rays form (Hale 2014, Grandel 1998); ZFIN genes per stage. ZFIN gives the
  start of pectoral lepidotrichia as "Unknown", and Parichy 2009 says "Pectoral fins were not scored".
- **Assumed:** hatch length 0.4 cm; incubation 7 d; the linear 0–14 d segment; the fin-ratio ramp below 1.68 cm;
  the larva/juvenile cut at 3 cm SL; transferring fin area across species and sizes; constant C_Lmax.

## Coverage

FishBase lists 75 Exocoetidae species. All 75 had their summary, growth and maturity pages fetched. Growth rows exist
for 7 species: *H. affinis* (4 rows), *H. oxycephalus* (2), *Parexocoetus brachypterus*, *Cypselurus opisthopus*,
*Cheilopogon atrisignis*, *C. cyanopterus* and *C. nigricans* (2). FishBase has no growth rows for *Exocoetus*,
*Fodiator* or *Prognichthys*. The fin data cover *H. rondeleti*, *E. volitans* and *C. furcatus*. Species are mixed
across relations: growth and mass are *H. affinis*, the fins are pooled from three other species, and the fin area
comes from *C. hiraii* and *E. obtusirostris*.

## SOURCES

| key | citation | access |
|---|---|---|
| fishbase-growth / refs / maturity / summary / ll | FishBase (fishbase.se) list, detail and reference pages | fetched HTML |
| oxenford-1994 | Oxenford, Hunte, Deane, Campana 1994, Mar Biol 118:585, doi 10.1007/BF00347505 | Crossref metadata only; values via FishBase |
| campana-1993 | Campana, Oxenford, Smith 1993, MEPS 100:211, doi 10.3354/meps100211 | open full PDF |
| hunte-1995 | Hunte, Oxenford, Mahon 1995, MEPS 117:25, doi 10.3354/meps117025 | open full PDF |
| oxenford-1995 | Oxenford, Mahon, Hunte 1995, MEPS 117:39, doi 10.3354/meps117039 | open full PDF |
| munro-1954 | Munro 1954, Aust J Mar Freshw Res 5:64, doi 10.1071/MF9540064 | Crossref abstract |
| oliveira-2015 | Oliveira et al. 2015, Braz J Biol 75:198, doi 10.1590/1519-6984.11513 | Crossref abstract |
| davenport-1992 | Davenport 1992, J Mar Biol Assoc UK 72:25, doi 10.1017/S0025315400048761 | Crossref abstract |
| daane-2021 | Daane et al. 2021 Curr Biol, Data S1A | repo `genotype/cache/` (read) |
| repo-length-weight | `physics/length-weight.csv` | repo (read) |
| park-choi-2010 | Park & Choi 2010 J Exp Biol, model L3 | repo `physics/glide-data.csv` (read) |
| zfin-stages | ZFIN `stage_ontology.txt` | fetched |
| repo-fin-subtree | `genotype/fin-subtree.json` (ZFIN stage ranges and genes) | repo (read) |
| repo-blueprint | `dashboard/public/blueprint3d/data.json` | repo (read) |
| hale-2014 | Hale 2014 Integr Comp Biol, PMC4097112 | PMC OAI full text |
| grandel-1998 | Grandel & Schulte-Merker 1998 Mech Dev, PMID 10349624 | Europe PMC abstract |
| parichy-2009 | Parichy et al. 2009 Dev Dyn, PMC3030279 | PMC OAI full text |
| baseline | `conditions/baseline.json` | repo (read) |

Not reachable, and so not cited for values: Hubbs & Kampa 1946 (Copeia, California flyingfish egg, prolarva and
juvenile); Davenport 1994 (Rev Fish Biol Fish); Khokiattiwong et al. 2000 and Stevens et al. 2003 (Springer pages
blocked automated fetches); Kimmel 1995 (cited only through Hale 2014).

## Call log

`calls.json` lists 318 requests to fishbase.se, ebi.ac.uk (Europe PMC), api.crossref.org, int-res.com,
ncbi.nlm.nih.gov (PMC OAI), zfin.org, api.semanticscholar.org (used for abstracts; its model-written summaries were
not used) and link.springer.com / doi.org (blocked). No personal identifiers were sent. Raw responses and scripts are
in `C:/Temp/devsim/` (`scripts/build.py` regenerates the JSON files).
