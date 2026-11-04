# micro — the zoom from embryo to atom

Phase 0 of a view that goes from a developing zebrafish embryo down to individual atoms. This phase
contains **no geometry at all**. It is the contract everything else has to obey: which levels can honestly
be computed, which are measured, which are drawn, how fast the clock runs, and which rendering pipeline
each level routes to. Geometry built before that contract exists is geometry that will have to be thrown
away when it turns out to be lying.

```
sim-engine/scales/micro/
  ladder.mjs       the scale ladder, and the arithmetic that locates the computable boundary
  staging.mjs      the developmental clock: Kimmel's stages and the temperature retiming law
  environment.mjs  the dish and the wild, as measured numbers rather than backdrops
  pipeline.mjs     measured rendering limits and the rule that routes a level to a pipeline
```

## The one hard limit, with the arithmetic

A zebrafish egg is 0.7 mm across and holds about **6×10¹⁸ water molecules**. The largest all-atom
simulations ever published are of order 10⁹–10¹⁰ atoms, for nanoseconds. The egg is therefore roughly a
**billion times** too large to simulate atom by atom, and no hardware roadmap closes a gap of that size.

So this cannot be one simulation. `ladder.mjs` computes where the boundary actually falls rather than
asserting it:

| level | size | atoms of water | verdict |
|---|---|---|---|
| embryo | 700 µm | 1.3×10¹⁹ | beyond anyone |
| one blastomere | 88 µm | 2.5×10¹⁶ | beyond anyone |
| a mitochondrion | 1 µm | 3.7×10¹⁰ | beyond anyone |
| 100 nm cytoplasm box | 100 nm | 7.0×10⁷ | only at supercomputer scale |
| a ribosome in water | 25 nm | 5.7×10⁵ | **computable** |
| atoms, hydrogen bonds, van der Waals | 5 nm | 4.6×10³ | **computable** |
| covalent bonds breaking, electrons | 1 nm | — | **refused** |

Those counts are **water only** — protein, lipid and nucleic acid are on top, so each is a floor. The
boundary sits between 1 µm and 100 nm, and it moves by itself if the ceilings are revised; no prose needs
rewriting.

Three words are allowed to describe a level, and exactly one applies at a time: **computed** (a solver ran,
equations shown, cost counted), **measured** (published experimental data — a recording, nothing solved),
**depicted** (neither; arranged for legibility). Depicted is not a failure state — almost every published
cell illustration is depicted. It is only dishonest when it is unlabelled.

**The electronic level is refused, not faked.** A classical force field holds covalent bonds as springs
with fixed connectivity: it cannot break one, and it has no electrons to move. Animating a bond breaking
on top of a classical trajectory would be drawing an event the physics underneath does not contain.

## The clock, and an error caught in it

`staging.mjs` implements Kimmel et al. 1995's retiming law, from the legend to their Figure 2:

```
H_T = h / (0.055 T − 0.57)
```

This is what makes the environment toggle mean something: a dish at 28.5 °C and a sun-warmed pool margin
at 34.9 °C are the same embryo running at different speeds. It reproduces the paper's own worked value
exactly — 20-somite at 25 °C returns 23.6 h against the 23.6 h they print.

**A discrepancy worth recording.** By definition the denominator should be exactly 1 at 28.5 °C. It is not:
`0.055 × 28.5 − 0.57 = 0.9975`, so the law as printed runs the standard temperature 0.25 % slow. Almost
certainly rounding — both coefficients are two significant figures — but the first draft of this file
asserted it was "1.0 exactly", which is false, and a 0.25 % error nobody has written down is how a clock
drifts. The law is used **as published** by default; a normalised variant exists and is flagged as ours.

**The honest problem the toggle exposes.** The law is validated between 25 °C and 33 °C. Zebrafish were
measured occupying water from **24.5 °C to 35.3 °C**. The real habitat runs past *both* ends of the window
where our clock is validated — so the laboratory is the easy case and the wild is where we are
extrapolating. `rateAt()` returns `extrapolated: true` and the reason.

**Cells divide out of step because the staging paper says they do**, not because a random number generator
was asked to make it look alive. Cycles 2–7 are "rapid and synchronous"; at the midblastula transition they
"give way to lengthened asynchronous ones"; 1k-cell shows "slight cell-cycle asynchrony" and high shows
"substantial division asynchrony". Before h 2.25 a synchronous animation is *correct*. Hatching is
asynchronous too, and the paper says outright it "is not useful as a staging index" — so it must not drive
a clock.

## Two environments, as numbers

| | dish | wild |
|---|---|---|
| temperature | 28.5 °C | 27.5 °C at the one observed courtship site; 24.5–34.9 °C measured across sites |
| conductivity | 150–1700 µS/cm | 62.3–218 µS/cm |
| turbidity | clear by construction | 2.03–20.90 NTU |
| depth | a dish | 3–10 cm at the courtship site |
| parental care | parents removed; mesh floors stop them eating the eggs | none — and the adults eat the eggs |
| clock | inside the validated window | outside it at both ends |

Wild water is *less* conductive than facility water: the dish is not a neutral version of the wild, it is
saltier. And **egg survival in the wild is not published** — the standard reference says the impact of
predation and competition on wild zebrafish is "entirely unknown", so predation is depicted as something
that *happens*, never as a rate.

## What actually renders, measured on this machine

`pipeline.mjs` holds numbers measured here against this repository's Blender 4.2.23, not quoted from docs.

**The decisive fact: animated instancing does not exist in glTF.** Blender's exporter *deletes* animation
channels on any node it collapses into `EXT_mesh_gpu_instancing`, and three.js reads instance transforms
exactly once into static matrices. When a population is both large and moving, the file format has run out
and no exporter flag rescues it.

**Blender is not the bottleneck — its exporter is.** Geometry nodes build and iterate 10⁷ instances in 6 s.
The glTF exporter allocates a Python node per instance and goes superlinear: 0.19 s at 10³, 2.9 s at 10⁴,
**176 s at 10⁵**. Other measured numbers: GPU instancing costs exactly **40 bytes/instance**; per-object
keyframes cost **16.2 bytes/object-frame**; three.js `InstancedMesh` costs **64 bytes/instance** for a full
matrix, five times a vec3 offset; a Blender point cloud exports as **nothing**; and float16 positions
(6 B/atom/frame) beat gzipped float32 (10.7 B) while being directly GPU-uploadable.

So the rule: **Blender-baked GLB when few, large and authored; raw binary buffer when many, small, or
moving** — crossover at ~10⁵ instances or the instant anything moves per frame, whichever comes first.

Where that puts the embryo: through the 1k-cell stage it is ~1000 moving bodies, about **5 MB for 300
frames** of per-object keyframes — comfortably bakeable with full materials. Past a few thousand cells it
crosses to the buffer route. The small embryo can be baked and the larger one cannot, and the pipeline
switches under the viewer rather than pretending one route covers both.

Mesoscale Explorer (MIT, Mol* framework) reached the same split independently and renders billions of atoms
in a browser. Its manifest format — a repeated entity plus a list of instance transforms — is worth reading
before inventing one.

## The ceilings are now sourced, and they are worse than the placeholders

| record | value | the catch |
|---|---|---|
| largest biomolecular MD ever | **1,016,813,441 atoms** | bought **2.42 ns** total, including equilibration. Nothing biological happens in 2.42 ns. |
| best size × time | 64,423,983 atoms for **1.2 µs** | the honest number to quote for "what large-scale MD can do" |
| longest trajectory ever | **1.03 ms** | for a *58-residue protein* — a system ~10¹⁴× smaller than a cell |
| only atomic cytoplasm run | 103,708,785 atoms, 20 ns | **one tenth** of a bacterium, no DNA, no membrane, no cytoskeleton |
| largest whole-cell model | 561 million particles | **built and never integrated** — its paper says equilibrating it is not possible |

Size and time are **different records held by different runs**. Quoting them as one capability is the
commonest overstatement in this field, so every entry carries both or says which it is. With the real
ceilings in, a single **mitochondrion is 52× the largest simulation ever run**, one cell is 3.5×10⁷×, and
the embryo is 1.8×10¹⁰×.

Atom counts now include protein, not just water (~10¹¹ atoms per µm³), because a model that simulated only
the water would not be a model of a cell.

## `refusals.mjs` — what the view may not claim

Ten refusals, each naming a published limit and what would be needed instead. They don't stop the view
showing anything; they constrain the **caption**. `checkCaption(level, text)` enforces it mechanically —
and caught a bug in itself: the first version used `\b(simulat|…)\b`, where a trailing word boundary after
`simulat` can never match "simulation", so it passed every caption it existed to catch.

Seven specific numbers are barred from being rendered as measured, including the two most likely errors in
any subcellular view: **water is not 55 M inside a cell** (that's pure water; the measured quantity is a
~70% volume fraction) and **glucose is not 5 mM inside a cell** (that's blood — the measured intracellular
value is ~0.1 mM, about 50× lower, and the abundant species is glucose-6-phosphate).

## Still pending

Phase 1 proper: fetching the Shah tracks, reconstructing lineage from the `parent` chain, and baking the
first embryo GLB. `datasets.mjs` records which sets may be used for what, and `permitted()` enforces it.
