# A fruit fly that lives longer

```
node runs/long-lived-fruit-fly/run.mjs
```

| gen | asked | what the system said |
|----|----|----|
| 0 | a fruit fly that lives longer | **fail** / **absent**: the organism is placed as *Drosophila melanogaster*, the requirement is not read at all, and 0 of 12 scenarios measure anything like a lifespan. |
| 1 | *D. melanogaster* with wings and antennae | **pass** on the counts: 5 organ systems, 26 organs, 24 tissues, 45 cell types. **Not** correct: see below. A four-stage life history is declared, and the engine resolves a STATE at each stage. |
| 2 | walking, and flying | walk **not contradicted**; fly **partly evaluated** — the lift coefficient is refused, correctly. |
| 3 | where it lives and what eats it | **assembled**: 4,503 occurrence records, 29 recorded predators, the Boston insect community. |
| 4 | does it actually live longer? | **marginally-longer** in the wild, **longer** in a vial: 1.09x against 2.00x, from the same arithmetic with one input changed. |

## The correction

An earlier version of this table called generation 1 "all correct". It was not, and nobody had read the
labels. The blueprint for *Drosophila melanogaster* contains **bone marrow, hyaline cartilage, a penis and a
uropygial gland** (a preen gland, which no insect has), and contains **no brain, no gut, no muscle, no thorax, no abdomen
and no fat body**. The counts passed every gate.

It surfaced when the scale theatre joined the literature chain to the body: the chain's organs — the adult
fat body and the adult brain, where the longevity experiments act — had nothing to land on.
`sim-engine/scales/audit-taxon.mjs` explains it. Of 131 parts, **2** carry an `in_taxon` restriction specific
enough to be evidence that a fly has them; 44 are restricted only to Bilateria (the uropygial gland's
asserted constraint is Bilateria, which contains a fly), and 85 carry no restriction at all. The blueprint
keeps a part unless a constraint removes it, and for an insect the constraints almost never can. Insect
anatomy largely lives in FBbt, which nothing here queries.

## The life history

Egg 0 d, third-instar larva 5 d, pupa 9 d, adult 12 d, each with a declared mass and length. The track is
**not monotonic**: the larva is longer and heavier than the adult it becomes, so the theatre's age slider
shows the body shrinking at metamorphosis. It is a declared growth track and not development: nothing
divides, nothing forms, and the order of appearance is not modelled.

## The answer

**2x in a vial, 1.09x in the wild.** Doubling the intrinsic lifespan of an animal with an extrinsic hazard
of 0.08/day buys 9 % of a life, because the ceiling set by everything outside the animal is 12.5 days
whatever happens inside it. Abolishing intrinsic mortality *entirely* would give 1.21x the baseline. That is
the Medawar-Williams argument arriving as arithmetic over three declared rates, and it is the first result
in these runs that needed two layers at once: the ecology layer names what is eating the fly, and the
performance layer says what that costs the design.

It is also the first question here that had NO LAYER AT ALL. What follows is what that looked like.

**The request is about time-to-death and no SCENARIO models it.** Not a missing parameter set, not an
out-of-scope clade: a missing dimension. There is no mortality rate, no survival curve, no senescence model
and no cause of death anywhere in `sim-engine/` or the Lean law set — only growth tracks, for two teleosts.
The system refuses in four separate places rather than answering a nearby question it can do.

`performance_check { kind: "lifespan" }` now supplies the first of those three -- a constant two-term
hazard, E[T] = 1/(h_int + h_ext) -- and is explicit that the other two are still missing: the exponential
shape is assumed rather than fitted, and nothing anywhere connects a genotype edit to a hazard rate. The actual
*Drosophila* longevity literature is largely about insulin/IGF signalling, dietary restriction and
mitochondrial function. Until `runs/_chains/` nothing in this repository represented a pathway at all. The
chain now walks all seven rungs -- dFOXO, insulin receptor signalling, the fat body cell, a fat-body-to-brain
DILP6 signal, the adult fat body, the adult brain, adult lifespan -- 17 links, each quoted and graded, the
strongest a single experiment (Bai 2012) holding molecule, interaction, tissue and organ together. It is
literature, not proof, and it still supplies **no hazard rate**: every source reports a median or maximum
lifespan, so the performance layer's intrinsic hazard remains a declared number. Mechanism present,
parameterisation absent.

## The defect this run found

`parse_design_text` returned a **glide criterion** for "I want a fruit fly that lives longer". `familyGlide`
matches the free-standing word `fly`, `fruit fly` contains one, and the parser read the *name of the animal*
as a requirement that it be able to fly — a criterion nobody asked for, attached to a request about
lifespan, which the design would then have been judged against. One-word compounds (dragonfly, butterfly)
were always safe because no word boundary falls inside them. A name is not a verb.

## The refusal that is exactly right

Asked about flight, the locomotion layer delegates to `flight_support_check`, which **refuses**: the only
measured lift coefficients here are a stuffed *Cypselurus hiraii* and a live *Petaurus breviceps*. An insect
at Re ≈ 100 with a flapping wing is aerodynamically unlike both — unsteady, with leading-edge vortex lift
that no steady coefficient represents. Returning a number by borrowing one would be the exact failure the
clade-scoped coefficient table was built to stop.

## The sideways half-answer

GloBI records 29 taxa as eating this clade — damselflies, orb-weavers, dragonflies, bush-crickets — each
traceable to a study. That is the nearest the system gets, and it is not near: a list of predators is not a
mortality rate, and without a rate a longer intrinsic lifespan is not a longer life. A fly that lives twice
as long in a jar may live no longer at all where something eats it every week.
