# ecology — would it be outcompeted?

*"Engineer a bacterium that eats carbon"* is a design problem. *"Will that bacterium still be there in six
weeks"* is an ecology problem, and it has a different answer — because the designed organism is not
released into an empty world. It arrives in one already occupied by lineages optimised on the same
resource for a very long time, and the usual outcome of that meeting is that the design is diluted out
while the incumbents eat the substrate it needed.

That worry is not vague. It is one of the better-established results in ecology, and it is arithmetic.

```
node ecology/test.mjs [--fail-once]
```

## R*, and the number that decides it

For growth limited by one resource, Monod (1949):

```
mu(R) = mu_max · R / (Ks + R)
```

A population persists only while `mu(R)` exceeds its loss rate `D`. Setting `mu(R*) = D`:

```
R* = Ks · D / (mu_max − D)        defined only while mu_max > D
```

Tilman (1977, 1982): with **one** limiting resource at steady state, the species with the **lowest R***
draws the resource below every other species' R* and **competitively excludes** them. Not "does better" —
excludes. The loser's growth at the equilibrium concentration is below its loss rate, so it declines
monotonically.

Three numbers per organism, and the question is settled.

## The result that should change how designs are written

```
design     mu_max 0.5   Ks 1.0   ->  R* = 0.25
incumbent  mu_max 0.3   Ks 0.1   ->  R* = 0.05     D = 0.1

winner: incumbent.  The design is excluded and would need to be 5× better.
```

**The design grows 67 % faster and still loses.** R* depends on affinity at least as much as on rate, and
a design optimised for maximum growth rate — which is what "make it eat carbon faster" usually means — is
not thereby safe. It is often the opposite: the engineered pathway costs something, and what it usually
costs is the low-substrate performance that decides the outcome.

This is the concrete form of the concern that a carbon-eating bacterium gets outcompeted by everything
already there. It is not that the design is bad. It is that **the quantity which decides survival is not
the quantity the design optimises**, and nothing in the pipeline was measuring it.

## What the module does with our own designs: refuses

```
cannot assess competition: mu_max, Ks are not measured for this design.
the bar it would have to clear: R* below 0.0500, set by <the best incumbent supplied>
```

This project has **no measured growth parameters for any designed organism**, so no verdict is produced.
What is produced instead is the bar, plus exactly which three numbers would settle it:

| needed | why it must be measured, not borrowed |
|---|---|
| `mu_max` | maximum specific growth rate for **this strain on this substrate**. Not the parent and not a relative: an engineered pathway usually costs growth rate, and that cost is the whole question. |
| `Ks` | half-saturation constant for the limiting resource. Low-substrate affinity decides the outcome and is rarely what a design optimises. |
| `D` | the loss rate of the environment entered — dilution, washout, grazing, death. Set by the environment, not the organism. |

A chemostat series at several dilution rates, or a batch curve fitted to Monod. **Days, not months — and
it is the cheapest experiment that can refute a release plan.**

The module states in its own output that it will not substitute plausible parameters, because a
competition outcome computed from invented growth constants looks exactly like one computed from
measurements, and would be the most confident wrong number in the system.

## What R* does not cover

Any of these can reverse the prediction, so a design that clears an R* comparison has cleared one hurdle
rather than the field:

- **more than one limiting resource** — two species coexist stably on two resources, and the
  single-resource conclusion lapses entirely
- spatial structure, biofilms, aggregates — R* assumes a well-mixed system
- predation, phage and grazing, which routinely stop the best competitor dominating
- **cross-feeding**, where the loser lives on the winner's waste
- fluctuating supply, where a worse R* with a faster response persists
- **horizontal gene transfer** moving the engineered function into an incumbent — after which the designed
  strain is irrelevant and its function is not
- evolution of any party during the experiment
- a deliberate containment or kill-switch design, which is an intentional guarantee of **losing**

Every returned verdict carries this list, because a competition number with no caveats reads as a safety
assessment, and it is not one.

## Not ours

The R* rule is textbook ecology — Monod 1949, Tilman 1977 and 1982 — and the module says so in every
result. What is new here is only the refusal to apply it without measured parameters, and the bar it
computes in the meantime.

15 assertions pass; 15 fail under `--fail-once`; 0 survive their own fault.
