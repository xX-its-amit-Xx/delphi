# A xenobot that sweeps particles into piles

```
node runs/xenobot/run.mjs
```

A xenobot is an assembly of *Xenopus laevis* cells shaped into something that animal never makes. It has no
taxon of its own, no genome of its own, no life cycle, no ancestors and no occurrence records — and it
moves, and does a job. This run started as a map of which layers notice. Two of them did not, and now do.

| gen | asked | what the system said |
|----|----|----|
| 0 | what *is* it? | declared a **construct**: `closest_relative_phenotype` refuses as one and names what IS answerable. The donor's 13 organ systems and 259 cell types are labelled the donor's. |
| 1 | ciliary swimming at 0.5–1 mm | **not contradicted**; the same construct with a single-hinge flap is **impossible**. |
| 2 | the task: sweep particles into piles | the functional registry still has no analogue, and `performance_check` answers it: **can move one or two** particles, not the twenty first claimed. |
| 3 | could it live anywhere? | as a construct **cannot-evaluate**; the donor **assembled** — 16,295 records, 35 recorded predators, none of which transfers. |

## The two layers this run added

**A construct layer.** `base.made_from` says "built from taxon X, not an instance of it", with what it
inherits and what it does not. `base.taxon` still carries the donor, because the cells really are that taxon
and the genome is unedited, so sequence questions stay answerable; `closest_relative_phenotype` refuses as a
construct and says exactly that.

Before it, every layer that wanted a taxon took the donor's and carried on. Nothing was wrong with any
individual answer and the subject was wrong throughout — the failure the rest of this repository spent two
runs removing from the clade logic, reappearing one level up: not a wrong clade, a wrong *kind of thing*.

**A task layer.** `performance_check { kind: "manipulation" }` asks whether the declared thrust exceeds the
Stokes drag on the particle it was asked to move. Asked to push twenty particles at once the design gets
0.13× the force it needs; asked to push one or two it gets 6.6×.

The design did not get stronger between those two calls. The **claim** got narrower, after the check named
the corner that failed. That is the loop working, and it is why the check reports a range rather than a
score: a design whose own stated range contains an impossible corner has not been shown to work.

Before it, three dimensions had been asked for across these runs and there were layers for two — shape (the
blueprint) and motion (the locomotion layer). What the thing *accomplishes* had neither vocabulary nor
check, which for a xenobot is the entire design brief.

## The control that makes the locomotion result worth having

The locomotion layer was the only one here whose subject was always really the construct, because it asks
for quantities rather than for an identity: a length, a speed, a medium and a gait. Cilia beat with an
extended power stroke and a curled recovery stroke — two different paths — so the scallop theorem does not
bind them, and Re ≈ 0.5 puts the construct at the top of the creeping regime.

The same construct with a single hinge that extends and retracts along one path comes back **impossible**.
A layer that returned "fine" for both would not be telling us anything about either.

## The refusal at the end

Asked about "Xenobot", GBIF cannot match it and the ecology layer refuses. That is the only possible answer:
occurrence databases record where people *found* things, and nobody has ever found one. Asked about the
donor they answer fully — and a xenobot is 0.5 mm of ciliated tissue with no mouth, no gut, no gonads and a
working life of days. It shares the genome and nothing else an ecologist would use. The run states the
donor's records and does not transfer them.

## Still missing

- **a shape**: `anatomy-model/parametric` is a parametric teleost builder, so nothing here can draw a
  ciliated spheroid, and no `.glb` exists for any generation
- **whether a pile forms**: moving particles and accumulating them are different problems, and the second is
  about where they are released
- **a functional analogue**: the registry holds four fish-and-flight functions and nothing that manipulates
  objects, so `functional_resolution` still reaches no verdict. `performance_check` answers the question;
  the registry simply has no real organism to compare the design against.
