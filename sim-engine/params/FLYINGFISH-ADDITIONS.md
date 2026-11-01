# FLYINGFISH-ADDITIONS: measured flying-fish values found beyond Europe PMC

`ontogeny-flyingfish-additions.json` proposes changes to the flying-fish rows of `ontogeny.json`. It has not been
merged: the hub decides. The schema is the same (`{value, unit, kind, species, source{id, cite, doi_or_url,
locator}, note}`), and the stage keys match. Three extra keys:

- `proposal`: what to do with the field. The options are `replace`, `fill null`, `new field`, `bound only`,
  `corroborates`, or `stays null`.
- `alternatives`: values from other species or other estimates.
- `species`: named on every value.

Facts that are not state fields are listed under `life_history_and_ecology`: eggs, incubation, yolk absorption,
growth rates, temperature, depth, night behaviour, diet, gut and burst speeds.

I checked the file with a copy of the `test/ontogeny.mjs` value rules: 73 value objects, 0 failures, and no bird
terms. One step is needed before merging: add `pectoral_len_over_SL: 'fraction of SL'` to `EXTRA_UNITS` in
`sim-engine/test/ontogeny.mjs`.

**Search, 2026-11-01.** Sources used:

- Europe PMC, Crossref, OpenAlex, J-STAGE, KoreaScience.
- FishBase species, length-weight, length-length and larvae tables.
- The FishShapes v1 dataset.
- The CalCOFI Atlas 33 (Watson 1996, Exocoetidae).
- The FAO identification guide.
- All 25 chapters of the CERMES/UWI book *Biology and management of eastern Caribbean flyingfish* (Oxenford,
  Mahon & Hunte eds 2007). These include full reprints of Khokiattiwong et al. 2000 and Oxenford et al. 1994.
- Japanese, Korean and Indian rearing studies.
- Shimane prefectural fisheries reports.
- Wayback copies of Park & Choi 2010.

Every value below was read in a fetched source. Where only the abstract was available, the entry says so.

## Coverage, before → after (if the proposals are accepted)

Kinds: M measured · M2 measured-secondhand · B borrowed · D derived · A assumed. **null** = gap.

| field | 0 d | 3 d | 10 d | 30 d | 90 d | 365 d |
|---|---|---|---|---|---|---|
| SL_m | A → **M** | A (lab lower bound D) | A (lab lower bound D) | D (corroborated) | D (corroborated) | D |
| mass_kg | A | A | A | D | D (corroborated) | D (source now primary) |
| body_density_kg_m3 | **null** | **null** | **null** | **null** | **null** | **null** |
| wetted_area_m2 | **null** | **null** | **null** | **null** | **null** | **null** |
| frontal_area_m2 | **null** | **null** | **null** | **null** | **null** → D | **null** → D |
| pectoral_area_both_m2 | A | A | A | D | D | M |
| pectoral_span_m | A | A | A | D | D | M |
| pectoral_len_over_SL (new) | B | M | M | | | |
| pelvic_len_over_SL | D → B | D → M | D → M | M | M | M |
| caudal_area_m2 | **null** | **null** | **null** | **null** | **null** | **null** |
| red_muscle_fraction | **null** | **null** | **null** | **null** | **null** | B → D (flying fish) |
| white_muscle_fraction | **null** | **null** | **null** | **null** | **null** | **null** → D |
| gill_area_m2 | **null** | **null** | **null** | **null** | **null** | B |
| hb_P50_kPa | **null** | **null** | **null** | **null** | **null** | B |
| has_swimbladder | **null** | **null** | **null** | **null** → B | **null** → B | **null** → M2 |
| routine_metabolic_rate | **null** | **null** | **null** | **null** | **null** | **null** |
| standard_metabolic_rate | **null** | **null** | **null** | **null** | **null** | **null** |
| Ucrit_m_s | **null** | **null** | **null** | **null** | **null** | **null** |

**Before:** 103 cells: 69 null, 6 M, 13 D, 3 B, 12 A.

**After:** 103 cells: 63 null, 9 M, 1 M2, 14 D, 5 B, 11 A. The new field adds 3 more cells (2 M, 1 B).

## What was found, by field

**Hatch length (0 d SL).** The value is measured: 3.6–4.5 mm for *Hirundichthys* spp. (Watson 1996, p. 654). The
larvae hatch with the notochord already flexed, so body length is SL. This confirms the 4 mm that `ontogeny.json`
had assumed. Other species:

| species | value | conditions | source |
|---|---|---|---|
| *H. affinis* | regression intercept 4.05 mm FL | lab-reared | Oxenford et al. 1994, Fig. 3 |
| *H. coromandelensis* | 3.47–4.23 mm | 27 °C | Vijayaraghavan 1973, p. 118 |
| *C. hiraii* | 4.7 mm TL | | Tsukahara 1959, p. 178 |
| *P. agoo* | 4.75–5.25 mm TL | | Park & Kim 1987 |
| Exocoetidae (family) | 3–6 mm | | Watson, p. 643 |

**Larval growth (3 d, 10 d SL).** Lab-reared *H. affinis* (Oxenford et al. 1994, Fig. 3): FL = 4.05 + 0.47 · age
mm, N 106, 24.4–28.6 °C. This gives 5.5 mm at 3 d and 8.8 mm at 10 d. Wild juveniles grow 1.41 mm/d (Fig. 4). The
lab line is therefore a lower bound, and the `ontogeny.json` ramp (7.1 and 14.2 mm) is plausible for wild fish.
Reared congeners at 3 d:

- *H. coromandelensis*: 3.2–4.2 mm SL.
- *C. hiraii*: about 7 mm TL.
- *P. agoo*: 7.9 mm TL.

At 10 d, *P. agoo* is 12.0 mm TL. The wild fit corroborates 30 d (47.6 mm SL vs 43.6) and 90 d (126 vs 113 mm).

**Fin development below 1.68 cm SL** (Watson 1996, morphometric tables):

- **At hatching (yolk-sac larvae):** pectoral length is 0.09–0.13 SL and pelvic 0.03–0.07 SL, from *Cheilopogon*,
  *Fodiator* and *Prognichthys*. These are borrowed from other genera, because Watson gives no yolk-sac
  *Hirundichthys* value. The assumed 0.10 pectoral start is confirmed. The pelvic value of 0.10 in
  `ontogeny.json`, set equal to the pectoral, is about 2× too high at hatch.
- ***Hirundichthys* postflexion larvae:** pectoral 0.22–0.52 SL (mean 0.35), pelvic 0.18–0.31 (mean 0.25).
- **Other markers:** flexion happens before hatching. Transformation is at about 16–25 mm (*Hirundichthys*). The
  caudal fin forks at 20.7 mm TL (*C. hiraii*, Park et al. 2016). Flight begins at about 50 mm (Davenport 1994,
  abstract).

**Frontal area (90 d, 365 d).** Derived from FishShapes v1 museum specimens: max depth and max width, treated as
an ellipse.

- Adult *H. affinis* (n 3): depth/SL 0.165, width/SL 0.143, giving 7.9 × 10⁻⁴ m² at 0.206 m SL.
- 90 d, from *H. rondeletii* (n 3): 2.4 × 10⁻⁴ m².

**Muscle (365 d).** *Cypselurus hiraii* spawning adults (mean 101 g, 198 mm) had dark muscle at 5.8% and 5.6% of
body weight, and ordinary muscle at 48.2% and 47.5% (Shimane Fisheries Experimental Station 1987, Table 1, p. 104).
The red fraction of myotomal muscle is therefore 0.104–0.107, which replaces the trout proxy of 0.05. The white
fraction is 0.893–0.896. Davenport 1992 (abstract) agrees qualitatively: red axial muscle is "no more than … in
mackerel", and take-off uses white muscle.

**Swim bladder.** The FAO guide's family diagnosis reads "Swimbladder large, extending posteriorly beyond body
cavity" (Parin 1999, p. 2162). I set this as M2 for adults and B for 30 d and 90 d juveniles. No larval
inflation size was found.

**Adult mass (365 d).** The *H. affinis* law W = 0.01160 FL^3.01 (g, FL, n 362) is now verified in
Khokiattiwong et al. 2000, p. 51 (full reprint). Before this, the reference was unverified. See the conflict
section below.

**Life history and ecology** (`life_history_and_ecology`, 31 values):

- **Eggs and incubation:**
  - Eggs are negatively buoyant, with adhesive filaments (*H. affinis*, Oxenford 2007).
  - Egg diameter: 1.47–1.87 mm across *Hirundichthys* and *Cypselurus*.
  - Incubation: 114–138 h at 27 °C (*H. coromandelensis*); 174 h at 24.9 °C (*P. agoo*); about 14 d at 20–22 °C
    (*C. hiraii*). Field-collected *H. affinis* eggs hatched 3–6 d after collection.
  - Yolk is absorbed and feeding starts at day 3–4.
- **Growth:** 0.47 mm/d in the lab and 1.41 mm/d in the wild (*H. affinis*). Wild growth rises 0.07 mm/d per
  0.5 °C (Oxenford et al. 1994, p. 589), which the temperature layer can use.
- **Temperature and depth:**
  - Barbados SST range over a year is 26.75–28.95 °C (Khokiattiwong et al. 2000, p. 53).
  - Mean SST during the adult surveys was 27.3 °C (Oxenford et al. 1995).
  - Flying fish are limited to water above 20–23 °C (Davenport 1994, abstract).
  - Spawning is at 0–20 m. FishBase gives a depth range of 0–100 m, which I did not verify.
- **Night behaviour:** *C. hiraii* spawning schools rest inactive near the bottom at night, about 3 m above it, and
  rise to the surface at dawn (Kojima 1969). Flying fish are attracted to lights at night.
- **Diet:** zooplankton (FAO). Six eastern Pacific species are copepod specialists, at 58–97% of prey by number
  (Van Noord et al. 2013, abstract).
- **Gut:** no distinct stomach. This is borrowed from a needlefish (*Xenentodon*, Gupta 1971), so it is labelled
  borrowed (beloniform).
- **Speeds:**
  - The take-off speed of *Cheilopogon doederleini* is *estimated* at 3.9–5.2 m/s, with tail beats at 21.2 Hz
    (Makiguchi et al. 2013).
  - Speeds of "about 10 m/s" are quoted secondhand.
  - *H. affinis* post-larvae swim at 4 body lengths/s when slow and 36 body lengths/s at most (Davenport 1990,
    abstract).
  - None of these is a Ucrit.

## Adult mass discrepancy: resolved as far as the sources allow

| | species | length | mass |
|---|---|---|---|
| `ontogeny.json` adult | *Hirundichthys affinis*, Barbados | 20.6 cm SL = 22.2 cm FL | 131.6 g (FL law, n 362) |
| Park & Choi 2010 | *Cypselurus hiraii*, Korea | 19.9–20.9 cm SL | 40–60 g, fresh, before stuffing |

- **Different species.** The two values come from different genera.
- **No length-type error.** The FL law is applied correctly: SL is converted with 0.927 (FishBase length-length
  list: SL = 0.927 FL). Park & Choi define SL correctly, as snout to caudal base (Fig. 2), and weighed the fish
  fresh.
- **Independent checks agree with the 132 g.** *H. affinis* museum specimens (FishShapes) give 112–125 g at
  20.6 cm SL. Brazilian FL laws give about 122 g.
- **Park & Choi are the outliers.** All 79 FishShapes exocoetids have Fulton K = 0.98–2.27 (median 1.43). Park &
  Choi's fish have K = 0.51–0.72.
- ***C. hiraii* itself is not that light.** Spawning adults averaged 101 g at 198 mm (Shimane 1987). FishBase's
  maximum length for *C. hiraii* is 20.1 cm SL, so the Park & Choi fish are at the species' recorded maximum.
- **Conclusion.** The ~2× gap is real. The Park & Choi masses are anomalously low for their stated SL; it is not a
  species effect or an SL/FL/TL mix-up. Their cause is unresolved: a reporting error, or very lean post-spawning
  fish. Their lift "check" cannot settle it, because it assumes lift equals weight at an arbitrary 12 m/s.
- **Recommendation:**
  - Keep 0.13 kg for the *H. affinis* state.
  - Use Park & Choi for fin areas and aerodynamic coefficients, but not for mass.
  - For a *C. hiraii* wing loading, use about 0.10 kg.

## Nulls that remain null after a real search (a result)

- **Body density and swim-bladder volume, all stages:** nothing for any flying fish. Only the eggs' negative
  buoyancy is known.
- **Routine and standard metabolic rate, all stages:** nothing. The one likely source could not be obtained:
  Belokopytin & Abolmasova 1988 (J Ichthyol 28:148–151, metabolism of tropical Atlantic flying fishes at several
  swimming speeds). I found it only as a citation in Davenport 1994. Ikeda 2016 (JEMBE) is paywalled.
- **Ucrit, all stages:** nothing. Burst and take-off speeds exist; a needlefish flow-tank study (Liao 2002) gives no
  Ucrit.
- **Gill area, Hb, P50, haematocrit:** nothing for any flying fish or beloniform. Gray 1954 has no beloniform, and
  FishBase has no rows. The mackerel and trout proxies stay.
- **Wetted area and caudal-fin area:** nothing.
- **Larval muscle fractions, gills and swim bladder (0–10 d):** nothing.
- **Leads that failed:**
  - Munro 1954 (CSIRO 503).
  - Hubbs & Kampa 1946 (JSTOR).
  - Evans 1961 and Lewis et al. 1962 (Bull Mar Sci, Cloudflare).
  - Breder 1938 (BHL 403).
  - Imai 1959 (Kagoshima repository down, the main Japanese hatch-length source).
  - Davenport 1994 full text (paywall).
  - FY1988 Shimane report: the dark-muscle table is image-only.
