# HYPOTHESIS: genetic routes to a powered-flying fish

**HYPOTHESIS THROUGHOUT. Not a predicted genome, not a design, and not a claim that any of this is achievable.**

Built 2026-10-31T21:06:58Z by `genotype/build_flier_genome.py` from the physics thread's `physics/flier/spec.json`, this thread's
`interventions.json` and `causal-chains.json`, and two logged literature runs. No bird data anywhere: class Aves is this
project's held-out clade, so the usual source of flight genetics is excluded by construction.

> Of the four required changes, only fin proportion has genetic routes in this literature, and even there no route reaches the required magnitude or addresses span and aspect ratio. The remaining three are where the biology is missing, which is the useful result of this exercise.

## The four required changes

| # | requirement | genetic route |
|---|---|---|
| 1 | pectoral lifting area about 3.9 times the real fish's and span about 2.5 times, at a similar aspect ratio | **partial** |
| 2 | a large aerobic pectoral flight muscle at about 16% of body mass, where the real fish has small fin muscles | **not yet researched** |
| 3 | oxygen delivery about five times the bat range per kilogram, by haemoglobin capacity and cardiac output | **not yet researched** |
| 4 | a respiratory surface that works in air, since gills do not ventilate in air | **not yet researched** |

## 1. pectoral lifting area about 3.9 times the real fish's and span about 2.5 times, at a similar aspect ratio

**Route: partial.** This is the ONE item with real genetic routes, because fin proportion is the trait this project studied. But no route reaches the required magnitude: the largest measured increase in pectoral fin area from any single manipulation is +65% of wild type (hhip loss of function at 72 hours post fertilisation), and the requirement is +290%, a 3.9-fold area. Nothing in the fetched literature multiplies a fin's area by 3.9, and no manipulation was measured as a span or an aspect ratio at all, so the shape requirement has no sourced route even where the size one partly does. Combining levers is untested: the one double mutant that changes fin proportion (kcnh2a with lat4a) redistributes size between fins rather than scaling one fin up.

Largest measured increase found: **hhip loss of function, 65 % of wild type** for pectoral fin area, graded `necessity`, at 72 hpf.
The pleiotropy on that lever is the catch, and it is recorded in the same entries: the gene has a direct record on 12 blueprint nodes, and
the reported side effects include the anal fin skeleton being completely absent, dorsal radials increased, caudal hypurals going from two to
five, increased head volume, a reduced pupil, and adult dwarfism. It enlarges the pectoral fin by disorganising the rest of the skeleton.

Each row is a manipulation that changed the parameter named in its own row, which is not always the parameter this item asks for.

| gene | parameter it was measured on | level | direction | grade | effect size | calibrated | pleiotropy |
|---|---|---|---|---|---|---|---|
| gja1b | ray segment length / fin ray length (and | coding | decrease | `mechanism` | 95 % of wild type | yes | not computed |
| hhip | fin dorsoventral extent | coding | increase | `necessity` | 50 % of wild type | yes | 12 nodes |
| prdm1a | other (endoskeletal disk length; no node | coding | decrease | `necessity` | 8.7 % of wild type | yes | 11 nodes |
| hhip | pectoral fin area | coding | increase | `necessity` | 65 % of wild type | yes | 12 nodes |
| hhip | endoskeletal disc shape | coding | increase | `mechanism` | elongation of the endochondral (endoskeletal) disc | no | 12 nodes |
| kcnh2a | other (fin regenerate outgrowth / overgr | pharmacological | decrease | `mechanism` | 'fully suppresses overgrowth' - a qualitative stat | no | 8 nodes |
| kcnk5b | other (local fin overgrowth; the negativ | transgenic overexpression | no change | `mechanism` | zero overgrowths among 32 fish carrying DsRed-posi | no | 11 nodes |
| wls | pectoral fin length | coding | decrease | `mechanism` | pectoral fin scored as smaller by Alcian blue cart | no | 12 nodes |
| gja1b | ray segment length | pharmacological | decrease | `mechanism` | segment length; GAP27 'recapitulated the sof b123  | no | not computed |
| gja1b (required partner) + kcna5 (Xenopus laevis transgene) | ray segment length (combination: potassi | transgenic overexpression | increase | `mechanism` | segment length: 'a significant increase in segment | no | not computed |

**What is missing:**

- No manipulation anywhere was measured as a change in span or in aspect ratio.
- No route reaches a 3.9-fold area; the best measured single-gene increase is 1.65-fold and it is larval, not adult.
- The two stage regimes (embryonic fin bud, mature adult) cannot be interpolated, so a larval area change is not an adult fin.
- Pectoral fin LENGTH has no calibrated route at all (see interventions.json no_sourced_genetic_route).

## 2. a large aerobic pectoral flight muscle at about 16% of body mass, where the real fish has small fin muscles

**Route: not yet researched.** The literature run for this item has not finished, so no verdict is recorded. What this thread already holds is fin-muscle DEVELOPMENT genetics, not muscle-mass genetics: genes that decide whether fin muscle forms at all, not how much of it there is.

**What the physics changes about this requirement** (the physics thread's modelled result, not a biological measurement): The requirement is not simply a larger muscle. The physics thread's model gives 0.009 W of aerobic flight power from a bat-sized flight-muscle fraction built out of FISH RED MUSCLE, against 1.44 W needed: short by about two orders of magnitude. So item 2 is a request for a muscle TYPE with a mass-specific aerobic power far above anything fish red muscle delivers, and no genetic route to that is the same thing as a route to more muscle.

**What is missing:**

- The fish muscle-mass and oxygen-delivery literature run is unfinished.
- Every fin-muscle result this thread has is about whether muscle forms, not about its mass fraction: the pax7 quadruple mutant develops muscle-less pectoral fins, and met is necessary for the abductor.
- A larger muscle is useless here unless it is aerobic rather than glycolytic, and fibre-type specification is a separate question from mass.
- Mass-specific aerobic POWER is the quantity the physics needs, and no genetic result in this literature reports it: genetics reports fibre type, mitochondrial content or mass, never watts per kilogram.
- Nothing connects a fin-muscle mass change to a flight-capable power output.

## 3. oxygen delivery about five times the bat range per kilogram, by haemoglobin capacity and cardiac output

**Route: not yet researched.** The literature run for this item has not finished, so no verdict is recorded.

**What is missing:**

- This thread's own data say nothing about oxygen delivery: the genotype map covers anatomy and gene links, not physiology.
- No bird comparison is permitted here (Aves is the project's held-out clade), which removes the usual source of flight-oxygen genetics.

## 4. a respiratory surface that works in air, since gills do not ventilate in air

**Route: not yet researched.** The air-breathing literature run has not finished, so no verdict is recorded.

**What the physics confirms about this requirement** (the physics thread's modelled result, not a biological measurement): With the oxygen chain wired, the physics thread's flier climbs at 2.8 m/s to 179 m and its flight power collapses at 66 seconds when the burst store empties, while the blood oxygen store is still at 35%. The store cannot be drawn on because gills do not ventilate in air. So the air-breathing surface is not an optional refinement of this design: without it the animal is, in the physics thread's words, 'a jumper with a long ballistic-plus-burst arc'.

**What is missing:**

- The air-breathing literature run is unfinished.
- A gas bladder used for respiration conflicts with its use for buoyancy, which is a design cost, not a gene.
- Carbon dioxide excretion happens at the gills in water breathers, so an air-breathing fish still has to solve it.

## How to read this

- A route is listed because an experiment changed the parameter, never because a gene sounds relevant.
- Evidence grades are the project's five: association, necessity, sufficiency, mechanism, hypothesis.
- An effect size appears only where a paper gives a number; most of this literature reports morphology in figures.
- Pleiotropy is attached to every gene from the vetted map, because every lever here moves more than the fin.
- Stage regimes do not interpolate: a larval fin measurement is not an adult fin.
