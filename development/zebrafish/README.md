# development/zebrafish/: zebrafish growth trajectory for side-by-side comparison

Same rules as `../README.md`: **no mechanistic simulation**. Growth comes from staging tables, a measured growth
rate and a published von Bertalanffy fit. Proportions come from measured regressions. Every number carries
`{value, unit, kind, source, locator}`. Zebrafish is data-rich, so this side is mostly `measured`. The few
assumptions are listed below.

**Temperature.** The sources were reared at lab temperatures: 28.5 °C (Parichy 2009, and the Kimmel/ZFIN hpf
series), 28 °C (Lalonde & Akimenko 2018) and 27.1 ± 2.0 °C (Beaudouin 2015). The project baseline is 25 °C
(`conditions/baseline.json`). Per the project rule these temperatures are recorded as metadata and **not**
corrected for. Parichy shows that temperature changes growth rate (0.45 mm/d at 24 °C vs 0.54 at 33 °C) but barely
changes size at each stage.

## Files
`growth.json`, `allometry.json`, `stages.json`, `trajectory.mjs`, `trajectory.test.mjs` (`node development/zebrafish/trajectory.test.mjs`),
`sources.json`, `calls.json` (the zebrafish subset of the session's request log; no personal identifiers sent).

## Relations

| quantity | relation | kind | source |
|---|---|---|---|
| embryo stage | ZFS stage from hpf | measured | ZFIN stage ontology, which implements Kimmel et al. 1995 (paper not open; abstract fetched) |
| hatching | 48 hpf, 3.1 mm | secondary | FishBase larvae page (Main Ref Kimmel 1995): "Length at birth (mm) 3.1", "Hatching occurs 48 h after fertilization"; Hale 2014: 48–72 hpf, 3.1–3.5 mm |
| Pec-fin stage | 3.4 mm SL at ~60 hpf | measured | Parichy 2009, Fig. 32 |
| larval growth | SL = 3.4 + 0.32 (dpf − 2.5) mm, up to 11.0 mm | measured rate (0.32 ± 0.004 mm/d, individually reared); linear form assumed | Parichy 2009 |
| juvenile → adult | SL = 45.1 (1 − e^(−3.97/365 (dpf − 0.55))) mm | secondary; t0 set so the curve is continuous at stage J (assumed) | FishBase growth autoctr 4255: lab, unlimited food, Pauly 1978 compilation |
| mass | W_mg = e^−5.24 SL_mm^3.22 (b 95% CI 2.97–3.46) | measured fit (juveniles 10–50 dpf, ≤ ~15 mm; extrapolated above) | Beaudouin 2015. The paper does not state the log base; natural log is inferred from units (ln gives 8.8 mg at 10 mm, log10 would give micrograms) |
| proportions 3.4–12 mm | SL = 4.12·depth at nape + 1.62; SL = 3.29·head + 0.73; SL = 9.49·eye + 0.22; SL = 1.48·SVL + 0.55 (r² ≥ 0.98) | measured | Parichy 2009 Table 3 |
| adult proportions | body depth ≈ 0.25 SL; head ≈ 0.23 SL; pre-pectoral ≈ 0.24 SL | secondary | FishBase morphometrics on 2 photographs |
| post-embryonic milestones | 14 milestones by SL, from posterior swim bladder inflation 3.5 mm to juvenile 11.0 mm | measured | Parichy 2009 Table 4 (**"P" = pelvic** there) |
| pectoral fin | bud at 24 hpf, AER 30, musculature 36, cartilage/girdle 42, fin fold 48–60 hpf; endoskeletal disc + fold through ~2 weeks; **first lepidotrichia at 6.4 mm SL (≈ 11.9 dpf on this curve)**, numbered rays at 6.8–7.2 mm | measured | ZFIN stage ranges (`genotype/fin-subtree.json`); Hale 2014; Grandel 1998 abstract; Lalonde & Akimenko 2018 Fig. 8 controls |
| pectoral fin length / SL | **not found** (Daane 2018 measured it but gives it only in a figure) | n/a | `finLength_SL` is `null` |
| stage cut-offs | larva < 11.0 mm SL (J); juvenile < 24 mm SL; adult | measured / secondary | Parichy 2009; FishBase maturity (Lm 23 M / 25 F mm SL, tm 0.20 yr, domesticated) |

Checks: stage J falls at 26.3 dpf (Parichy: "the juvenile period lasts from ~4 weeks post-fertilization"), and SL
at 73 dpf (tm) is 24.6 mm, inside FishBase's Lm range of 23–25 mm. Alternative wild growth at 25 °C (Spence et al.
2007, Bangladesh: Linf 3.7 cm TL, K 1.2/yr) is in `growth.json` but not used.

**Assumed (only these):** the linear shape of larval growth (only a mean rate is reported), the straight line between
3.1 mm at 48 hpf and 3.4 mm at 60 hpf, t0 of the adult VB (chosen for continuity), and the extrapolation of the
length-mass fit beyond 15 mm.

## compareAt(ageDays, {mode})

- `mode: 'absolute'` (default): **the same absolute time.** `ageDays` is days after hatching for both species. The
  zebrafish hatches at 2 dpf; the flying fish's 7-day incubation is assumed. On one clock the zebrafish runs ahead:
  at 100 days after hatching it is an adult (30 mm SL) while the flying fish is a 12 cm juvenile.
- `mode: 'stage'`: **normalised by life stage.** `ageDays` is flying-fish days after hatching. The zebrafish is shown
  at the same stage progress: 0–1 egg, 1–2 larva, 2–3 juvenile, 3–4 adult up to 95% of Linf, linear within each stage.
  Both animals are then always in the same stage, e.g. flying fish 100 d ↔ zebrafish 43.6 d (both juveniles, 2.44).
- Each mode returns `{mode, axis, progress, flyingFish, zebrafish}`; `axis` states which normalisation was used.
  Stage cut-offs differ between species (flying-fish larva/juvenile at 3 cm SL is assumed; zebrafish J at 11 mm is
  measured), so stage-normalised comparisons carry the flying fish's assumptions.

## SOURCES

| key | citation | access |
|---|---|---|
| kimmel-1995 | Kimmel et al. 1995 Dev Dyn 203:253, doi 10.1002/aja.1002030302 | abstract (Europe PMC); stages via ZFIN, hatch via FishBase |
| zfin-stages | ZFIN stage_ontology.txt | fetched |
| parichy-2009 | Parichy et al. 2009 Dev Dyn 238:2975, PMC3030279 | full text + tables (PMC OAI) |
| lalonde-2018 | Lalonde & Akimenko 2018 PLoS ONE 13:e0192500, PMC5805328 | full text |
| hale-2014 | Hale 2014 Integr Comp Biol, PMC4097112 | full text |
| grandel-1998 | Grandel & Schulte-Merker 1998 Mech Dev, PMID 10349624 | abstract |
| beaudouin-2015 | Beaudouin et al. 2015 PLoS ONE 10:e0125841, PMC4418570 | full text |
| daane-2018 | Daane et al. 2018 Sci Rep 8:10391, PMC6039437 | full text (fin length only plotted) |
| fishbase-zf | FishBase *Danio rerio* (SpecCode 4653) summary, growth, refs, LW, maturity, LL, larvae, egg, morphometrics | fetched |
| repo-fin-subtree | `genotype/fin-subtree.json` | repo (read) |

Not reachable: Singleman & Holtzman 2014 (Zebrafish 11:396, PMC4108942; the full text is not served to scripts).
