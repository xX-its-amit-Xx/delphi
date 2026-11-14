# #33 Bioelectricity nonprofit and an optogenetic, hands-off xenobot variant - draft reply (PARTLY)

Target repo path: tracks/issues/replies/issue-33.md (new file; lead session posts it).
All papers below were opened as Europe PMC records (title + abstract) on 2026-11-13. Full texts not read.

## Q3. What published optogenetic control of contractile or ciliated tissue exists?
Contractile tissue - yes, well established:
| DOI | Year | What the abstract says |
|---|---|---|
| 10.1126/science.aaf4292 | 2016 | Tissue-engineered ray of rat heart cells on an elastomer body; it swims and follows a light cue. |
| 10.1073/pnas.1516139113 | 2016 | "Optogenetic skeletal muscle-powered adaptive biological machines". |
| 10.1063/5.0091507 | 2022 | "Multi-actuator light-controlled biological robots". |
Frog-embryo tissue, light-driven bioelectric control - yes, from the Levin line:
| 10.1242/bio.20133665 | 2013 | Light-activated Archaerhodopsin proton pump restores tail regeneration in frog tadpoles. |
| 10.4137/jcd.s18368 | 2014 | Light-triggered cell death (KillerRed) in targeted frog-embryo tissues. |
Xenobots themselves:
| 10.1126/scirobotics.abf1571 | 2021 | Cilia-driven living machines from frog cells. An earlier repo agent notes a light-RECORDING reporter only (it records exposure, it does not steer). |

Gap (honest): two searches (Crossref and Europe PMC, title terms optogenetic + cilia + beating/motility)
returned no paper showing optogenetic steering of cilia beating in frog multiciliated cells, and no paper
titled or described as an optogenetic xenobot. Absence in two quick searches is not proof of absence.
An earlier repo agent could not read US patent 12215344 (a possible channelrhodopsin-cilia claim): still unverified.

## Q2. What a computational-validation-only first step looks like (proposal, no wet lab, no imaging)
1. Extend the .life design file with a light vocabulary (the repo's notes decoder found it has none for
   actuation, sensors or light): opsin, wavelength, illuminated region, duty cycle.
2. State one Lean law: net thrust direction is a function of which surface patch is illuminated
   (resistive-force / low-Reynolds swimming), with explicit assumptions.
3. Check it against PUBLISHED numbers only: swimming speeds and turning in the three contractile
   papers above. Mark the ciliated case "prediction, untested".
4. Publish the prediction as an unsigned nanopublication draft labelled as a prediction.
Suggested new file: organism-design/optogenetic-variant/PLAN.md (owned by the organism thread).

## Q1. Which nonprofit?
Not answerable from public information. The repo's notes decoder found no nonprofit named
"Bioelectricity". Candidates already recorded in tracks/research/agents/pp-funding-bioelectricity-organism-design.json:
the Allen Discovery Center at Tufts and the Institute for Computationally Designed Organisms (icdorgs.org).
Single missing fact: the name of the nonprofit meant in the meeting notes.
