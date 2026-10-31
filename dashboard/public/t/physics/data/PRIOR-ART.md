# Prior art: what is known about how flying fish fly, and about Thompson's flight scaling

Physics thread, 2026-10-31. Searches and fetches: 97 logged calls (`SEARCHES.md`, `prior-art/_cmdlog.txt`): 9 `orx discover`
calls (OpenAlex and PubMed), 20 Europe PMC searches, 17 Crossref lookups, 11 Semantic Scholar lookups, and the page and PDF
fetches listed there. Every work cited here is in `sources.json` with a DOI that resolved in Crossref; `access` says whether the
full text or only the abstract was read. Nothing is cited from memory: three DOIs recalled from memory were verified by title
in Crossref before use, and one guess that returned 404 is not cited.

Regenerate the search table after new calls with the Python snippet in `SEARCHES.md`'s build (run `python -I` on the block in
the thread transcript, or re-run `analysis.py`, which does not touch it).

## 1. The question, and whether it has been answered already

**Issue #50 asks:** what does a flying fish actually do in the air, as one provenanced table. **Issue #43 asks:** is it inside
Thompson's flight envelope.

**Has the literature already measured flying-fish flight?** Partly, and mostly before 1995. What the accessible record holds:

| what | who measured it | how | access |
|---|---|---|---|
| Field glide speed 10 to 20 m s⁻¹, leap at about 10 m s⁻¹, glides to 50 m, total sequences to 400 m in 30 s, height to 8 m | Hertel 1966; Edgerton and Breder 1941; Davenport 1990, 1994; Fish 1990 (as quoted by Park and Choi 2010, Makiguchi et al. 2013, Deng et al. 2019) | stroboscopic film, field observation | the primary works were not fetchable; every number is second-hand |
| Morphometrics: mass, fin areas, span, aspect ratio 9 to 10.7 for five 0.04 to 0.06 kg Cypselurus hiraii | Park and Choi 2010 (10.1242/jeb.046052) | stuffed specimens, direct measurement | full text |
| Aerodynamic coefficients: C_L,max 0.78 at 35°, (L/D)max 4.37 at 0°, C_D,min 0.055; pelvic fins raise lift and L/D; ground effect helps | Park and Choi 2010 | wind tunnel at 12 m s⁻¹, Re 2 × 10⁴ | full text |
| Take-off: pitch 20.0 ± 3.3°, tail-beat 21.2 ± 4.6 Hz, estimated leap speed 3.9 to 5.2 m s⁻¹ (aquarium, sub-maximal) for 13 Cheilopogon heterurus doederleini of 178 to 263 g | Makiguchi et al. 2013 (10.3354/ab00494) | accelerometer loggers | full text |
| Allometry within Exocoetus obtusirostris: mass ∝ L^2.98, fin area ∝ L^1.83, wing loading ∝ L^1.24; pectoral fin length ≤ 76 to 79 % of standard length | Davenport 1992 (10.1017/S0025315400048761), 2003 (10.1046/j.1095-8649.2003.00041.x) | morphometrics | abstracts only |
| Fin area and span increase with mass across six genera; wing loading and aspect ratio scale like birds and bats rather than other gliders | Fish 1990 (10.1111/j.1469-7998.1990.tb04009.x) | morphometrics | abstract only |
| Theory: optimal glide path, L/D ~ 15.7 assumed, 80 m range; Hertel's 48 m trajectory | Kawachi et al. 1993; Hertel 1966 (quoted in Deng 2019) | models | second-hand |
| CFD on the Park and Choi geometry: C_L,max 1.05, L/D 4.7, predicted 45.4 m range | Deng et al. 2019 (10.1088/1748-3190/ab23e6) | simulation | full text; not used as data |

**Answer:** the measurement side exists but is thin and old, and the one open full-text morphometric source is for small specimens.
**No accessible source gives body mass, lifting area and a measured airspeed for the same fish.** The #50 table (`glide-data.csv`,
27 rows, 6 species or groups, 2 species with first-hand measurements) records that gap rather than filling it. This is the
finding, not a failure: anyone wanting Level 2 (fin size and proportion) for a flying fish must either obtain Davenport 1992 and
Fish 1990 in full or measure specimens.

**Has anyone placed flying fish on Thompson's envelope?** Not in the works found. Fish 1990 compares wing loading and aspect
ratio scaling to birds and bats (abstract); Park and Choi 2010 compare glide polars with bird wings. Neither tests the
v ∝ (W/S)^½ law or the L^3.5 power law as such. Europe PMC searches for "minimum flight speed" with "scaling" or "allometry" and
for "muscle power" with "flight" and "scaling" returned no paper that tests Thompson's chapter-II argument on gliders.
**Cannot tell** whether the older biomechanics literature (Pennycuick, Norberg, Rayner) does so: Norberg and Rayner 1987 and
Socha et al. 2015 were abstract-only (403 on the full texts) and Google Scholar was not searched. So the #43 test is not
described as new; it is described as a pre-registered re-check with sourced inputs.

## 2. Comparison lineages (non-bird; Aves is the frozen holdout)

| lineage | source fetched | what it gives | what it lacks |
|---|---|---|---|
| Flying squirrel Glaucomys sabrinus | Bahlman et al. 2013 (10.1098/rsif.2012.0794), full text | AGV 7.2 m s⁻¹, launch 5.4, reference mass 92.7 g, wing loading 59 N m⁻², non-equilibrium glides; Table 3 of mammalian glider wing loadings 38 to 143 N m⁻² | wing loading is a published population value, not these animals |
| Colugo Galeopterus variegatus | Byrnes et al. 2008 (10.1098/rspb.2007.1684), full text | asymptotic glide speed 10.1 m s⁻¹, mass 0.75 to 1.4 kg, landing 3.99 | no wing area or loading |
| Bats | compilation Table 1 of 10.1093/icb/icag077 (full text) | three species with wind-tunnel speed and wing loading | primary sources not fetched; speeds are test speeds |
| Bats, fastest | McCracken et al. 2016 (10.1098/rsos.160398), full text | Tadarida brasiliensis 11 to 12 g, ground-speed maxima 27 to 44.5 m s⁻¹ | no wing area; bursts, not cruise |
| Diptera | same compilation | three hoverflies with speed and wing loading | the compilation's own mass and area columns disagree with its wing-loading column by 5 to 8× for insects, so these values carry a flag |

## 3. What the test found (details in `results.json`, pre-registration in `tests/thompson1917-ch02-06/result.json`)

- **Reading B, the fish on its own envelope: inside.** From measured W = 0.589 N, reference area 0.01269 m², C_L,max 0.78 the minimum
  lift-supported speed is 9.85 m s⁻¹. Quoted field glide speeds are 10 to 20 m s⁻¹. Caveat: the speeds are family-level second-hand
  figures for larger fish; the morphometrics are 60 g specimens of one species.
- **Reading A, speed vs wing loading: inconclusive (underpowered) in both regimes.** Gliders: 2 taxa with both numbers. Powered fliers:
  6 taxa, slope 0.42 (95 % CI 0.11 to 0.73), but the wing loadings span 0.93 decades against the pre-registered minimum of 1.0. The
  pooled slope across all 8 points is 0.54 ± 0.09 (r² 0.85); it mixes two regimes and decides nothing, by the hub's ruling.
- **Reading C, could the muscles power level flight: cannot tell.** P_req = 1.33 W (22 W per kg body mass) at v_min with (L/D) 4.37;
  no source gives a muscle mass fraction or specific power for a flying fish.
- **Reading D, the exponents: provable.** Sent to the Lean thread in `FORMAL-STATEMENTS.md`, with strength ∝ L² first.

## 4. Wording and framing rules inherited from the hub's prior-art report

- Say "fin enlargement for gliding", never "fin-to-wing": the flying fish's wing is an enlarged pectoral fin (Daane et al. 2021,
  10.1016/j.cub.2021.08.054, is the genetics anchor for that proportion change; `allometry.json` is the measurement side of the same trait).
- Claim no novelty beyond "we did not find a pre-registered test of Thompson's flight scaling on gliders in the sources we could reach".
- Any fossil time comes with its PBDB record id; none is used here.

## 5. Unverified leads (not cited for numbers)

- Davenport 1992 full text: the wing loadings for Hirundichthys affinis, Cypsilurus cyanopterus and C. heterurus plotted in Park and
  Choi 2010 Fig. 4 would give three more glider points with first-hand W/S. Paywalled (Cambridge Core). A reader with access could add them.
- Fish 1990 full text: fin area and span regressions across six genera.
- Hertel 1966 (book), Edgerton and Breder 1941 (Zoologica), Davenport 1990 (abstract read: post-larvae only) for the primary field speeds.
- Stafford et al. and Bishop (wing loadings in Bahlman 2013 Table 3) for colugo and other glider W/S; the colugo entry there is n.a.
- Walker et al. 2009, Wolf et al. 2010, Von Busse et al. 2012, Norberg 1970/1976 for the primary bat and hoverfly values.
- Pennycuick's flight-performance models and Norberg and Rayner 1987 for muscle power scaling (reading C) and for bat cruising speeds.
