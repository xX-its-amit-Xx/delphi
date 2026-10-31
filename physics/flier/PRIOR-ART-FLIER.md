# Prior art for part C: what powered, flapping flight to altitude requires, from non-bird fliers

Physics thread, 2026-10-31 ~21:00 UTC. Logged searches: eight Europe PMC queries (`physics/SEARCHES.md`, tags `epmc-C-*`)
and eight PubMed Central full texts (`pmc-C-*`). **Class Aves is the frozen holdout: no bird value is used as a parameter,
comparison or figure. Where a needed value exists only for birds it is marked "unavailable (holdout)".** Every number below
is quoted from a fetched full text with its identifier; the design in `spec.json` uses only these.

## What the literature gives (bats, insects, pterosaurs)

| quantity | value | taxon | source (full text read) | kind |
|---|---|---|---|---|
| Flight-muscle fraction of body mass | mean 9.13 %, minimum 7.8 % | extant bats | PMC10966098 (10.1038/s42003-024-06032-9), quoting Bullen and McKenzie 2004 | secondary |
| Mechanical flight power | 0.046 to 0.140 W, mean 0.092 W, for a 7.6 g bat | Pipistrellus nathusii | PMC10154928 (10.1098/rspb.2023.0045) | measured (aerodynamic) |
| Conversion efficiency (metabolic to mechanical) | 7.0 to 10.4 %, rising with speed | P. nathusii | PMC10154928 | measured |
| Metabolic power per unit weight | 7.1 to 18.7 W per N | P. nathusii | PMC10154928 | measured |
| Inertial power of flapping | about 8 W/kg, nearly speed-independent; 6 to 7 W/kg in Plecotus and Glossophaga | Cynopterus brachyotis model | PMC9490335 (10.1098/rsif.2022.0315) | modelled |
| Profile power | 5 to 15 W/kg over the speed range | bat model | PMC9490335 | modelled |
| Wing loading | 6.5, 11.05, 14.25 N/m² | three bats | physics/comparison-data.csv (compilation) | secondary |
| Hovering metabolic power | 559 W/kg body; efficiency 7.3 to 14.7 % | Bombus terrestris | PMC12606204 (10.1098/rsbl.2025.0325) | measured |
| Wing loading and aspect ratio | 15.83 to 17.88 N/m², AR 6.1 to 6.5 (hatchlings); Draco 22.7 to 24.2 N/m² | pterosaurs (modelled from fossils) | PMC8298463 (10.1038/s41598-021-92499-z) | modelled |
| Muscle efficiency used in a bat energetics model | η = 0.23 | 278 bat species model | PMC9169619 (10.1073/pnas.2103745119) | assumed in that paper (it is the bird-derived value; NOT used here) |
| Powered flight needs muscle fraction above the gliding value | a 38 to 41 g Eocene bat with 8 % flight muscle could not climb in normodense air; 10 % gave positive climb but only at unsafe airspeeds | Onychonycteris finneyi model | PMC10966098 | modelled |
| Flight-muscle mass-specific mechanical power | not stated directly for bats or insects in the fetched texts; **derived** here as P_mech / (body mass × muscle fraction) = 133 (mean) to 202 (max) W/kg muscle from the two P. nathusii numbers above | derived | | derived |
| Maximum sustained climb rate of a bat or insect | not found in the fetched texts | | | not found |
| Flight-muscle fraction of a flying fish | not reported; Davenport 1992 (abstract): no more red axial muscle than a cruising mackerel; take-off probably anaerobic white muscle | Exocoetidae | 10.1017/S0025315400048761 | abstract |

## What this means for a "truly flying" fish (details and arithmetic in `spec.json`)

1. **Wing loading.** The real specimen sits at 46 N/m² (reference area) and glides at or above 9.85 m/s. Bats fly at 6.5 to
   14 N/m²; pterosaur hatchlings at 16 to 18. A 60 g fish that flies like a bat needs about four times its lifting area:
   0.049 m² at 12 N/m², span about 0.66 m at the fish's own aspect ratio of 9 (a 20 cm body with 66 cm of fin).
2. **Power.** With the measured fin polar unchanged, level flight at the best speed costs about 1 W mechanical plus about
   0.5 W of flapping inertia; a 1 m/s climb adds 0.6 W. At the bat-derived specific power (up to 202 W/kg muscle) the bat
   MEAN muscle fraction (9.1 %) gives 1.1 W: not enough even for level flight (1.28 W at the best speed), let alone a climb. Climbing at 1 m/s needs a flight-muscle fraction of about
   0.16 (0.15 falls 0.05 W short), above the bat mean and minimum (the bat maximum is not in the fetched texts). That is the first thing the genome
   would have to change: a large, aerobic pectoral flight-muscle mass where the real fish has small fin muscles.
3. **Oxygen.** Sustaining the climb at 10 % conversion efficiency means about 18 W metabolic, 300 W per kg body: above the
   bat range (70 to 183 W/kg body) and below bumblebee hovering (559). At 20.1 J per ml O₂ that is 0.9 ml O₂/s, about 900 ml
   O₂ per minute per kg: the gill, haemoglobin and cardiac modules must say whether any fish circulation can deliver it, and
   the Lean O₂-to-power bound will make that a checked inequality rather than an assumption. Burst (anaerobic) flight for a few
   seconds is a different question, and so is air-breathing.
4. **Lean constraints.** The flier commits, as an illustrative candidate (`lean-candidate.json`), to C9 at a 7 m/s cruise
   (v_min for 12 N/m² and C_L,max 0.78 is 5.0 m/s: consistent) with a control candidate at 4 m/s that C9 must eliminate, and
   the real fish at its quoted 15 m/s glide (consistent). Strength (C8) and bending (C12) cannot rule without a sourced breaking
   stress for fin rays; none was fetched. R6 (muscle power ∝ L³) is not invoked: the flier keeps the real fish's mass.

## Not found, not claimed

No fetched source gives a bat's maximum flight-muscle fraction, a bat or insect maximum sustained climb rate, a fish
pectoral-muscle specific power, or any flying-fish muscle mass. Google Scholar was not searched. Nothing here is new: the
power-available versus power-required comparison is Pennycuick's and Norberg's method as applied in the bat papers above.
