# HYPOTHESIS: genetic routes to a powered-flying fish

**HYPOTHESIS THROUGHOUT. Not a predicted genome, not a design, and not a claim that any of this is achievable.**

Built 2026-10-31T21:55:18Z by `genotype/build_flier_genome.py` from the physics thread's `physics/flier/spec.json`, this thread's
`interventions.json` and `causal-chains.json`, and two logged literature runs. No bird data anywhere: class Aves is this
project's held-out clade, so the usual source of flight genetics is excluded by construction.

> No requirement has a route that reaches it. Three of the four are 'partial', and in each case the partial route answers a different question from the one asked: for the fin, a 1.65-fold area increase against the 3.9-fold required, with span and aspect ratio never measured at all; for the muscle, an increment on existing trunk muscle rather than an allocation to the pectoral fin, which no manipulation has ever been shown to enlarge; for air breathing, an anatomy that living fishes have evolved at least nine times over but whose construction genetics is mostly correlative and entirely absent for the flying fish's own order. Oxygen delivery is a flat 'none', and the Lean thread's kernel-checked elimination puts the shortfall at about 26-fold on a product of three physiological quantities that genetics does not report. The useful result of this exercise is the map of where the biology is missing, not a buildable design.

## The four required changes

| # | requirement | genetic route |
|---|---|---|
| 1 | pectoral lifting area about 3.9 times the real fish's and span about 2.5 times, at a similar aspect ratio | **partial** |
| 2 | a large aerobic pectoral flight muscle at about 16% of body mass, where the real fish has small fin muscles | **partial** |
| 3 | oxygen delivery about five times the bat range per kilogram, by haemoglobin capacity and cardiac output | **none** |
| 4 | a respiratory surface that works in air, since gills do not ventilate in air | **partial** |

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

**Route: partial.** PARTIAL for 'more muscle', NONE for 'a pectoral muscle at 16% of body mass'. Myostatin loss of function is a real, repeated, quantified genetic route to extra skeletal muscle in teleosts: 16% more skeletal muscle in a CRISPR mstn-knockout red sea bream breed, 21% higher body weight in TALEN mstnb-/- zebrafish, 29.7% higher body weight with more muscle cells in CRISPR MSTN channel catfish, 41% more back muscle in male CRISPR MSTN olive flounder, and significant gains in medaka, common carp and antisense-knockdown Nile tilapia. Four reasons it does not reach the requirement. (i) Every one of these is an INCREMENT on existing muscle, not an allocation: the red sea bream '16%' is a 16% increase in total skeletal muscle, which is not the same quantity as a muscle equal to 16% of body mass, and no fetched source reports pectoral fin muscle as a fraction of body mass in any fish. (ii) Every one of these is axial/trunk muscle. No fetched source reports mstn loss, or any other manipulation, enlarging the pectoral fin musculature; the only fin-muscle genetics found (met, six1a/b, six4a/b, tbx5, lbx1) is loss-of-function reducing fin muscle, with no gain-of-function in the other direction. (iii) The mstn effect in fish is predominantly hyperplastic and the link from fibre number to mass is not reliable: transgenic dominant-negative MSTN medaka doubled muscle fibre number with gross muscle mass unaltered, and the authors state MSTN loss of function failed to induce double-muscling in medaka. (iv) The side effects are concentrated exactly where a flight muscle needs support: short body and small centrum in red sea bream, fewer and shorter vertebrae in yellow catfish mstnb knockouts, and fat accumulating inside the muscle in zebrafish and tilapia. For scale, the most aerobically specialised teleost measured here, juvenile Pacific bluefin tuna, carries only 3.77-10.69% of body mass as red muscle in total, over the whole body.

**What the physics changes about this requirement** (the physics thread's modelled result, not a biological measurement): The requirement is not simply a larger muscle. The physics thread's model gives 0.009 W of aerobic flight power from a bat-sized flight-muscle fraction built out of FISH RED MUSCLE, against 1.44 W needed: short by about two orders of magnitude. So item 2 is a request for a muscle TYPE with a mass-specific aerobic power far above anything fish red muscle delivers, and no genetic route to that is the same thing as a route to more muscle.

**A coincidence to guard against.** The best muscle-mass route reports '16% MORE skeletal muscle' in a myostatin-knockout red sea bream. The requirement is a flight muscle at '16% OF BODY MASS'. The coincidence of the figure 16 is meaningless: the first is a relative gain on whatever muscle the fish already had, the second is an absolute fraction of the whole animal, and no fetched source reports a pectoral muscle fraction for any fish at all. Nothing in this file licenses the inference that one delivers the other.

| gene | species | manipulation | effect | hyperplasia or hypertrophy | fibre type assayed |
|---|---|---|---|---|---|
| mstn (Pm-mstn) | Pagrus major (red sea bream) | coding | 16 % muscle mass | not reported in the abstract (paper not open | not reported |
| mstnb | Danio rerio (zebrafish) | coding | 21 % body weight | hyperplasia, explicitly not hypertrophy: mor | not reported; fibre-type composition w |
| MSTN | Ictalurus punctatus (channel catfish) | coding | 29.7 % body weight | hyperplasia implied: 'more muscle cells'; fi | not reported |
| MSTN | Paralichthys olivaceus (olive flounder) | coding | 41.24 % muscle growth | not reported | not reported |
| mstn (C315Y) | Oryzias latipes (medaka) | coding | 'a significant increase in body weight from  | both, sequentially: hyperplastic growth from | not reported |
| mstn (dominant-negative C315Y transgene) | Oryzias latipes (medaka) | transgenic | 2 fold | hyperplasia at adult stage; embryonic ectopi | not reported |
| mstn | Oreochromis niloticus (Nile tilapia) | cis-regulatory or expres | 'body weight and body length were significan | hyperplasia, explicitly not hypertrophy ('my | not reported as fibre type, but the me |
| mstnba | Cyprinus carpio (common carp) | coding | 'mstnba mutated fish have grown significantl | hyperplasia implied (more muscle cells); fib | not reported |

**What is missing:**

- Every fin-muscle result this thread has is about whether muscle forms, not about its mass fraction: the pax7 quadruple mutant develops muscle-less pectoral fins, and met is necessary for the abductor.
- A larger muscle is useless here unless it is aerobic rather than glycolytic, and fibre-type specification is a separate question from mass.
- Mass-specific aerobic POWER is the quantity the physics needs, and no genetic result in this literature reports it: genetics reports fibre type, mitochondrial content or mass, never watts per kilogram.
- Nothing connects a fin-muscle mass change to a flight-capable power output.

## 3. oxygen delivery about five times the bat range per kilogram, by haemoglobin capacity and cardiac output

**Route: none.** NONE. Three findings, all negative for the requirement. (1) Capacity: every fetched genetic result on fish globins runs downward. Icefishes lost both haemoglobin gene clusters through transposable-element-mediated deletion; Asian noodlefishes lost myoglobin outright and let haemoglobin, haptoglobin and hemogen deteriorate; Antarctic notothenioids reduced haemoglobin multiplicity to a single adult isoform with lower oxygen affinity; the icefish candidate gene FAAP20 is associated with LOW haematocrit. The zebrafish globin loci and their LCR give a well-mapped cis-regulatory handle (two loci, two developmental switches, GATA1/NFE2 motifs, reporter-confirmed LCR), and the Root effect is a demonstrated pH-driven unloading mechanism in fish swimbladders, but no fetched source reports any manipulation that RAISES blood oxygen capacity in a fish. (2) Pump: genetic routes to a bigger fish heart do exist, which is the one real positive here. Knockdown of miR-458-3p and miR-144-5p drives cardiomyocyte proliferation and enlarged heart development through bmp2 in an Antarctic icefish, and Tg(myl7:ATF3) zebrafish develop cardiac hypertrophy with increased cardiac cell proliferation. But the icefish route is compensation for having no haemoglobin at all, the zebrafish route is pathological (fibrosis, disorganised sarcomeres, long-QT-like dysfunction), and neither reports a rise in cardiac output or oxygen delivery. (3) Magnitude: measured fish performance is not close. The highest fetched fish maximum oxygen uptake is 781.31 +/- 16.50 mg O2 kg-1 h-1 with a maximum cardiac output of 69.12 +/- 2.39 ml min-1 kg-1 in schoolmaster snapper, i.e. roughly 9 ml O2 kg-1 min-1 by this agent's arithmetic, reached by raising heart rate and tissue extraction rather than stroke volume, and the fish envelope plateaus at about 1.75-fold resting cardiac output and 2.5-fold extraction in salmon and tilapia on warming. No fish in any fetched source approaches the per-kilogram oxygen delivery the physics thread asks for. I deliberately fetched no mammalian baseline, so the exact multiple belongs to the physics thread; the point for this thread is that the shortfall is not marginal and that no genetic route in the fetched literature addresses it.

**Lean's elimination.** The Lean thread eliminated sustained aerobic cruise for this flier with a certificate its own ledger reports as
kernel-accepted (3 theorems, compiled in 12.5 s). Recomputed here from the numbers they committed rather than
quoted: aerobic ceiling **0.035659 W** against **0.942838 W** required, short by **26.44x**.
`ceiling = muscular efficiency x oxycaloric equivalent x cardiac output x arterial O2 content; required = weight x airspeed / lift-to-drag`. Teleost proxy values committed by the lean thread; the generous case, since in air the gills do not ventilate and arterial content only falls.

The elimination is not about any single gene. It says the PRODUCT of muscular efficiency, cardiac output and arterial oxygen content must rise by about 26.4x over teleost values, while airborne. Genetics can act on each of those three factors, but the requirement is on their product, so a route that improves one by a few tens of percent does not approach it.

*Citation status: committed.*

**What is missing:**

- This thread's own data say nothing about oxygen delivery: the genotype map covers anatomy and gene links, not physiology.
- No bird comparison is permitted here (Aves is the project's held-out clade), which removes the usual source of flight-oxygen genetics.
- The requirement is on a PRODUCT of three physiological quantities, about 26.44x over teleost values. No genetic result in this literature reports any of the three as a quantity, let alone their product: genetics reports globin repertoires and heart sizes, not cardiac output in litres per minute or arterial oxygen content.

## 4. a respiratory surface that works in air, since gills do not ventilate in air

**Route: partial.** Real fishes breathe air by at least 9 distinct routes, so the ANATOMY is not hypothetical at all: this is the one requirement of the four that living fishes already meet, repeatedly and in several unrelated lineages. The GENETICS is a different matter. 8 of the 9 routes have some genetics attached, but only 2 rise above correlation to a functional result, so for most routes the molecular account of how the surface is built is not available. And the decisive fact for this project: NOTHING is known for Beloniformes, the order containing flying fishes, halfbeaks and needlefishes, and nothing at all for Exocoetidae. The homology of the gas bladder and the tetrapod lung is accepted and now supported at the level of cell types, but the molecular account of the switch between them is incomplete and partly negative, so even the best-studied starting point does not give a route.

**What the physics confirms about this requirement** (the physics thread's modelled result, not a biological measurement): With the oxygen chain wired, the physics thread's flier climbs at 2.8 m/s to 179 m and its flight power collapses at 66 seconds when the burst store empties, while the blood oxygen store is still at 35%. The store cannot be drawn on because gills do not ventilate in air. So the air-breathing surface is not an optional refinement of this design: without it the animal is, in the physics thread's words, 'a jumper with a long ballistic-plus-burst arc'.

- **respiratory gas bladder / physostomous swim bladder used as a lung** (Arapaima gigas (pirarucu), Heterotis niloticus, Pangasianodon hypophthalmus): genetics `association`, genes nkx2.1, sox2, bmp4, bmp16, hoxc4a.
- **true ventral lung (paired or unpaired), retained from the ancestral bony-fish condition** (Protopterus annectens (West African lungfish), Protopterus dolloi, Protopterus aethiopicus (marbled lungfish)): genetics `association`, genes npc2, mgst1, prdx1, nkx2.1, sox2.
- **suprabranchial chamber housing a gill-derived arborescent or labyrinthine respiratory organ** (Channa argus (northern snakehead), Channa maculata, Channa striata): genetics `association`, genes vegf, fgfr, zf-C2H2 family transcription factors, Homeobox family, bHLH family.
- **labyrinth organ (Anabantoidei)** (Anabas testudineus (climbing perch), Betta splendens (Siamese fighting fish), Trichopodus trichopterus (blue gourami)): genetics `association`, genes ca2 (carbonic anhydrase II, protein), atp1a1 (Na+/K+-ATPase, protein), pcna (proliferating cell nuclear antigen, protein).
- **posterior intestine used as an air-breathing organ (intestinal / gastrointestinal air breathing)** (Misgurnus anguillicaudatus (dojo loach / weatherloach), Paramisgurnus dabryanus (large-scale loach), Triplophysa tibetana (non-air-breathing comparison)): genetics `mechanism`, genes mex3a, tbx20, prok2, prokr1, loxl2b.
- **stomach or gastric diverticulum used as an air-breathing organ** (Pterygoplichthys anisitsi (Loricariidae), Otocinclus affinis (dwarf sucking catfish), Pterygoplichthys disjunctivus): genetics `association`, genes egfr.
- **skin / cutaneous surface used for aerial gas exchange** (Misgurnus anguillicaudatus (loach), Pelteobagrus fulvidraco (yellow catfish, water-breathing comparison), Scartelaos histophorus (mudskipper)): genetics `association`, genes fn1, itga5, itga11, loxl2a, loxl2b.
- **buccal, buccopharyngeal, opercular or palatal epithelium used for aerial gas exchange (including simple air-bubble holding with no specialised surface)** (Monopterus albus (swamp eel), Ophisternon bengalense (swamp eel), Electrophorus varii (electric eel)): genetics `hypothesis`, no genes identified.
- **barbel used as an air-breathing organ** (Misgurnus anguillicaudatus (dojo loach)): genetics `necessity`, genes fn1b.

**Costs and limits recorded across those routes.** These are reasons the requirement is harder than it looks, and they are biology, not physics:

- A barbel in air is a bare, thin-barriered surface and so is the most exposed to desiccation of any route here; no source read quantified water loss from it.
- A gas bladder is a poor buoyancy device away from the surface: 'on descend from the water surface its contribution as a buoyancy device is very limited because the swimbladder is compressed by increasing hydrostatic pressure' (Pelster 2021).
- A stomach full of air is a stomach not full of food; the digestive conflict documented for the loach hindgut applies by the same logic, but no source read here measured it for a gastric air breather.
- Air exposure dries and remodels the integument even in an obligate lung breather: in aestivating Protopterus dolloi 'short-term aestivation induces major reorganization, with narrowing of epidermal layers and decrease of mucous cells', and 'aestivation correlates with an increased oxidative stress and changes of Heat Shock Proteins expression'.
- Air exposure injures the surface it breathes with: in Scartelaos histophorus air exposure produces 'transient epidermal remodeling and markers of oxidative stress, reflecting reversible cellular damage'; in aestivating Protopterus dolloi there is 'narrowing of epidermal layers and decrease of mucous cells' followed by 're-thickening of epidermal layers'.
- At the unspecialised end the route works without any new structure at all - Awaous achieves 30% aerial uptake with no respiratory epithelium - but equally it cannot be scaled up without one.
- BUOYANCY CONFLICT, stated directly: 'Using the swimbladder as a buoyancy structure resulted in the loss of its function as an air-breathing organ and required the development of a gas secreting mechanism' (Pelster 2021). The two jobs are mutually exclusive in the erythrinids: the jeju uses the bladder for aerial respiration, the sister genus traira 'uses the swimbladder as a buoyancy organ and not for aerial oxygen uptake'.
- Blocking access to air kills these fish faster than hypoxia itself does: 'Mortality in the restricted group was higher than those in the control and the hypoxic groups' (normoxic water, air breathing denied).
- Blocking air breathing damages the organ: in the inhibited group 'Intraepithelial capillaries in posterior intestines of loaches from T05 were broken'.
- Both uses require surfactant: 'As gas-filled cavities the respiratory swimbladder and the buoyancy device require surfactant' (Pelster 2021).

**Nothing is known for the flying fish's own order.** NOTHING IS KNOWN. There is no literature on air breathing, aerial gas exchange, a respiratory gas bladder, or the genetics of any respiratory surface in Beloniformes, and none at all for Exocoetidae. The family is represented in PubMed by 33 records and the four flying-fish genera queried by 53, and the intersection of either set with any respiration or swim-bladder term is empty. The nearest beloniform with any gas-bladder literature at all is the medaka Oryzias latipes, and that work treats the swim bladder purely as a buoyancy organ whose inflation is a developmental-toxicology endpoint (thyroid disruptors, metals), not as a gas-exchange surface. Consequently every statement in this file about how a fish breathes air is proxy data from another order: Osteoglossiformes (Arapaima, Heterotis, Chitala), Cypriniformes (Misgurnus), Siluriformes (Clarias, Pangasianodon, Pterygoplichthys, Otocinclus), Anabantiformes (Channa, Betta, Trichogaster, Anabas), Synbranchiformes (Monopterus), Gymnotiformes (Electrophorus), Gobiiformes (mudskippers, Awaous, Gobionellus), Polypteriformes, Dipnoi and Actinistia. For the flying fish itself the gas bladder is, on the evidence available, an unstudied organ: there is no measurement of its vascularity, barrier thickness, surfactant, or whether it is physostomous, and no expression or functional genetics of any kind.

*Queries run: 8, all recorded in the agent's output file.*

**What is missing:**

- A gas bladder used for respiration conflicts with its use for buoyancy, which is a design cost, not a gene.
- Carbon dioxide excretion happens at the gills in water breathers, so an air-breathing fish still has to solve it.

## How to read this

- A route is listed because an experiment changed the parameter, never because a gene sounds relevant.
- Evidence grades are the project's five: association, necessity, sufficiency, mechanism, hypothesis.
- An effect size appears only where a paper gives a number; most of this literature reports morphology in figures.
- Pleiotropy is attached to every gene from the vetted map, because every lever here moves more than the fin.
- Stage regimes do not interpolate: a larval fin measurement is not an adult fin.
