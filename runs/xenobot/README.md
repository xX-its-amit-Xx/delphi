# A xenobot that sweeps particles into piles

```
node runs/xenobot/run.mjs
```

A xenobot is an assembly of *Xenopus laevis* cells shaped into something that animal never makes. It has no
taxon of its own, no genome of its own, no life cycle, no ancestors and no occurrence records — and it
moves, and does a job. This run is mostly a map of which layers notice.

| gen | asked | what the system said |
|----|----|----|
| 0 | what *is* it? | **wrong subject**: 13 organ systems, 67 organs, 259 cell types — for a frog. Every term correct, the subject wrong throughout. |
| 1 | ciliary swimming at 0.5–1 mm | **not contradicted**; the same construct with a single-hinge flap is **impossible**. |
| 2 | the task: sweep particles into piles | **no verdict**: the function registry holds four functions, all fish and flight. |
| 3 | could it live anywhere? | as a construct **cannot-evaluate**; the donor **assembled** — 16,295 records, 35 recorded predators, none of which transfers. |

## The two missing layers

**A construct layer.** "Made from taxon X, not an instance of it" is not expressible anywhere, so the
donor's taxon, clades, anatomy, genotype and ecology are all silently inherited. This is the failure the
rest of the repository spent two runs removing from the clade logic, reappearing one level up: not a wrong
clade, a wrong *kind of thing*.

**A task layer.** Three dimensions were asked for across these runs and there are layers for two. Shape:
the blueprint. Motion: the locomotion layer. **What the thing accomplishes, and to what** — neither
vocabulary nor check. For a xenobot that is the entire design brief.

## The control that makes the locomotion result worth having

The locomotion layer is the only one here whose subject is really the construct, because it asks for
quantities rather than for an identity: a length, a speed, a medium and a gait. Cilia beat with an extended
power stroke and a curled recovery stroke — two different paths — so the scallop theorem does not bind them,
and Re ≈ 0.5 puts the construct at the top of the creeping regime.

The same construct with a single hinge that extends and retracts along one path comes back **impossible**.
A layer that returned "fine" for both would not be telling us anything about either.

## The refusal at the end

Asked about "Xenobot", GBIF cannot match it and the layer refuses. That is the only possible answer:
occurrence databases record where people *found* things, and nobody has ever found one. Asked about the
donor they answer fully — and a xenobot is 0.5 mm of ciliated tissue with no mouth, no gut, no gonads and a
working life of days. It shares the genome and nothing else an ecologist would use. The run states the
donor's records and does not transfer them.
