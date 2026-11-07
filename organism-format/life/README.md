# `.life` — a developmental trajectory, where a file can be *wrong* rather than merely incomplete

A `.organism` describes a design **at rest**. Stages appear in it as metadata: a named time at which some
phenotype value is claimed to hold. That is the right shape for *"here is a design and here is what we
believe about it"*, and it is the wrong shape for the thing being designed, which is a **developmental
trajectory**.

The difference is not cosmetic:

> **A snapshot cannot be wrong about a trajectory — it has nothing to be wrong with.**

Make time the primary axis and the file starts making checkable claims: that this cell count follows that
one, that this compliance falls as that lineage separates, that the mesh at E2.5 is the same animal as the
mesh at E1.5. Those claims can be false, which is what makes them worth storing.

So the two formats fail differently, and that is why they are two formats:

| | can be |
|---|---|
| `.organism` | **incomplete** — a field is missing, and the reader says which |
| `.life` | **inconsistent** — stages out of order, a genome naming one animal and measurements taken on another, a channel declared in the header and measured on 3 of 400 cells |

None of the second list is a missing field, and none of it would be caught by a reader that only checked
for missing fields. So most of `read.mjs` is about consistency, and the counts it returns are the point: a
boolean says a channel is *present*, and a count says it was measured on **0 of 31 cells**.

```
node organism-format/life/export-all.mjs              # read, export, compare, and say what was lost
node organism-format/life/make-example.mjs            # rebuild the worked example
node organism-format/life/test-{stl,fasta,read,compare}.mjs [--fail-once]
```

## The four things it yields

A format earns its extension by what can be got **out** of it.

| | out | by | for |
|---|---|---|---|
| 1 | a **genome**, as FASTA | `fasta.mjs` | sequence comparison, tree search |
| 2 | a **mesh per stage**, as binary STL | `stl.mjs` | rendering, simulation input, 3D printing |
| 3 | a **phenotype vector per stage** | `compare.mjs` | phenotypic comparison |
| 4 | **provenance for every number** | `spec.mjs`, `read.mjs` | so none of the above is mistaken for a measurement |

**The fourth is what makes the other three safe.** An STL is a triangle soup with no idea whether it came
from a confocal stack or from somebody's guess, and a FASTA is letters with no idea whether the edit was
ever made. Once geometry leaves the file as a mesh its provenance is gone — so the mesh is stamped, in the
80-byte header and in the filename, and the exporter refuses to write an unstamped one.

## The channels

A stage carries cells, and one cell may carry several *kinds* of measurement at once. That shape is taken
from the **Unified Transcriptome and Mechanics Map** (UTMM; Habibi, Sinha, Yang et al. 2026, bioRxiv
[10.64898/2026.02.23.706394](https://doi.org/10.64898/2026.02.23.706394)), which measures, within an
**intact 3D embryo** and for the same cell, transcriptome and mechanics and geometry together.

| channel | carries | the point of it |
|---|---|---|
| `transcriptome` | `panel`, `counts_or_reference`, **`in_situ`** | a transcriptome measured after dissociation has thrown away the neighbour relations a multicellularity claim is *about*, so the flag is required |
| `mechanics` | `readout_kind`, `readout_value`, `unit`, **`method`**, `frequency_Hz`, `is_relative` | an inferred readout and an AFM modulus differ by more than their error bars |
| `geometry` | `centre`, `radius`, `surface_area`, **`exposed_surface_area`**, `mean_curvature` | *exposed* surface — the part facing outward rather than a neighbour — is what distinguishes an inner cell from an outer one, and it is the geometric quantity lineage bias tracks |
| `lineage` | `parent`, `fate`, `fate_confidence` | what the cell came from and what it is becoming |
| `signalling` | `pathway`, `readout`, `readout_value` | pathway activity where it was actually measured |

A format that cannot hold that shape cannot hold the measurement that matters most for multicellularity:
what state a cell is in **and** what its neighbours are doing to it. UTMM's own finding is of exactly that
form — cytoplasmic softening from 2-cell through morula, with lineage bias aligning to mechanical
difference *between* cells. None of it is expressible as a per-organism phenotype value.

Channel provenance lives **on the channel**, not on each number: at four hundred cells you stamp the
measurement, not every float in it. A channel with no stamp of its own is **not** counted as measured — it
is counted separately and reported, because inheriting the stage's stamp is how a guess comes to look like
a confocal stack.

## The refusals, which are the actual design

Each one exists because the alternative produces something that **looks like a measurement**.

| refusal | what it stops |
|---|---|
| `no_interpolated_stage` | a state computed between two stages written as a stage. Interpolation is a `derived` value if the rule is stated and a `depicted` one otherwise; a reader that cannot tell them apart will eventually report an interpolation as an observation. |
| `no_unstamped_mesh` | an exported mesh without the provenance of the geometry it came from. If the geometry is `assumed` or `depicted`, the export says so **in the file and in its name**, or there is no export. |
| `no_cross_unit_distance` | arithmetic across time units, and **any** arithmetic on an ordinal one. Carnegie 12 minus Carnegie 10 is not 2 of anything. |
| `no_single_number_distance` | genetic and phenotypic distance summed. The weight is a modelling decision with consequences for every tree built from it, and a file format has no business making it silently. |
| `no_identity_drift` | a file whose edit list targets one reference and whose phenotype was measured on another. That is not a record, it is two records. |

And three outcomes from the reader, where **the middle one is the point**:

| outcome | meaning |
|---|---|
| `refused` | the file says something that cannot be true, or omits something whose absence changes what a reader believes |
| `degraded` | readable and usable, but something a reader **must** be told is missing — and the reader says what |
| `ok` | internally consistent, and every value carries a kind and a scope |

Two standing rules behind that table. **Degraded is not a pass**: a degraded file comes back with its
degradations listed, never silently upgraded, because the second program in the chain has no other way to
find out. And **nothing checked is not a pass**: if the file carries no assembly the identity check cannot
run, and *"no constraint could be applied"* is not agreement, so an unapplied constraint degrades the file
rather than passing it.

## What it looks like on the worked example

`examples/mouse-preimplantation.life` — a mouse preimplantation series, zygote to morula, assembled from
published stage structure. Read through `read.mjs`:

```
status:  DEGRADED
         DEGRADED: readable and usable, but 7 thing(s) a reader must be told.

census:  10 measured-secondhand / 5 assumed / 5 depicted / 5 derived / 5 not-established
         30 value(s): 15 may be treated as data, 10 may not, 5 are not established at all.

constraints: 11 applied, 1 could not be applied: genome and phenotype name the same organism

channel coverage, over 31 cell(s) in 5 of 5 stage(s):
  geometry       NOT a measured channel: present on 31 of 31 cells, measured on 0
  lineage        NOT a measured channel: present on 16 of 31 cells, measured on 0
```

**Geometry is present on 31 of 31 cells and measured on 0 of them.** That is the file, stated plainly: it
is a drawing with a bibliography. `rendering` is allowed for all 5 stages; `rendering_as_evidence` comes
back *"no: no stage has measured geometry, so every mesh is a depiction"*. The `transcriptome`, `mechanics`
and `signalling` channels are in the vocabulary and on **0 cells** here — UTMM measures the transcriptome
per cell in situ across 742 cells and 69 embryos, and we have the paper, not the data.

`export-all.mjs` then produces the artefacts and prints what each one lost:

```
  zygote       zygote.DEPICTION.stl           320 tri     16 084 B  cells 1/1  units=um
  two-cell     two-cell.DEPICTION.stl         640 tri     32 084 B  cells 2/2  units=um
  four-cell    four-cell.DEPICTION.stl       1280 tri     64 084 B  cells 4/4  units=um
  eight-cell   eight-cell.DEPICTION.stl      2560 tri    128 084 B  cells 8/8  units=um
  morula       morula.DEPICTION.stl          5120 tri    256 084 B  cells 16/16  units=um
  genome (FASTA)            -  NOT WRITTEN: 0 records: refused, see above
```

Five stages, five refusals first: `exportStage` declines every one of them until the caller types
`{ allowDepicted: true }` at the call site, and then the marker goes in the name. The header is the whole
metadata budget:

```
"life-stl/0.1.0 stage=morula provenance=depicted units=um DEPICTION"
```

The FASTA **refuses**, and the refusal is correct. This genome is `reference-only`: no edits, no inline
sequences. A FASTA of it would be the published GRCm39 assembly, which is not `fasta.mjs`'s to emit — see
`no_reconstructed_chromosome`, whose whole subject is that a reference genome with a few letters changed
gets read as assembled evidence. Zero records, so no `.fa` file is written either: a zero-byte file called
a genome parses without complaint and reads as an *empty* genome rather than an *absent* one.

Compared to itself, both distances come out exactly 0 and the script asserts it:

```
phenotypic distance: 0   over 10 trait component(s), 15 excluded
genetic distance:    0   edits 0 vs 0, assembly "GRCm39"
combined distance:   null   <- null on purpose
```

`n_traits_used` is asserted positive too, because a distance of 0 over 0 traits is not agreement. The 15
exclusions are instructive: `cytoplasmic_compliance` ×5 is `not-established` and has no number to subtract,
and `total_volume_conserved` ×5 and `utmm_coverage` ×5 are categorical. `true - false = 1` is a number with
no units, so they are excluded and **counted**, never coerced.

## The three corrections

The most instructive part of the spec, and they are kept in it rather than silently applied, because each
one is a way a format can be wrong that is hard to see afterwards.

**1. A field name can impose a unit the measurement does not have.** Version 0.1.0 of the spec specified
`elastic_modulus_Pa` outright, following the PubMed/PMC abstract: *"cytoplasmic stiffness (high-frequency
elastic modulus)"*. **That deposit is a stale version.** bioRxiv v2 (2026-10-23) rewrites it to
*"high-frequency intracellular mechanical compliance"* and *"a relative, non-invasive readout"* — the
authors deliberately retreated from calling the passive readout a modulus. The accessible text reports it
only as `RMSD0` and `dRMSD`, displacements, with no values in nm and no published conversion to Pa. A
format that had required pascals would have forced everyone filling it in to invent them. Requiring
`elastic_modulus_Pa` does not make the data a modulus; it makes the file lie in a way no reader can detect.
Hence `readout_kind` and `is_relative`, which let a displacement stay a displacement. The pascal figures
that do exist (~35 Pa at 2/4-cell, ~10 Pa at 8-cell) come from a **separate** optical-tweezers validation
on endocytosed beads and are carried in the example under their own name,
`shear_modulus_from_bead_validation_Pa`, with a scope that says so.

**2. UTMM does not cover the zygote, though both of its abstracts say "from the zygote".** Every reported
cohort starts at late 2-cell (transcriptome) or 4-cell (mechanics). No zygote transcriptome, mechanics
value or cell count appears in the accessible text. A zygote row in a `.life` may carry standard embryology
and must not carry a UTMM-derived field — which is what the example's zygote stage does, with the reason
written into the stage note.

**3. "Positional geometry rather than cell shape predicts Hippo/YAP" is not UTMM's result.** It is a
citation to prior work: Royer et al. 2020, *Development*,
[doi:10.1242/dev.189449](https://doi.org/10.1242/dev.189449), which identified exposed surface area as the
best correlate of nuclear YAP. **UTMM never measures YAP.** Its own claim is the different and weaker one:
that geometry separates *transcriptionally* defined states. YAP appears nowhere in the example except in a
`not_established` entry explaining its absence.

## Two axes of geometry provenance

The first version of this spec collapsed these into one and got it wrong. `no_unstamped_mesh` originally
gated on the provenance of the **numbers** — each cell's centre and radius. Building the exporter showed
that is not sufficient.

| axis | question |
|---|---|
| `numbers` | where the centres, radii and measured areas came from (the `KINDS` vocabulary) |
| `shape` | what shape model turned them into triangles — **almost always a depiction** |

**A sphere is a depiction of shape however good the numbers are.** Real blastomeres are flattened against
their neighbours, with contact faces whose curvature is set by the adhesion-to-cortical-tension balance,
and in a compacted morula those flat faces are most of the cell surface. So a stage with perfectly measured
centres and radii still exports a drawing, and under the one-axis rule it would export unmarked. The second
axis is what makes the first honest: every `exportStage` result carries `shape_model` whatever the
provenance of the numbers was.

It has a consequence worth stating plainly. **A sphere packing has no contact faces**, so every cell's
exposed surface area comes out too large, and biased in the direction that makes inner cells resemble outer
ones — the one geometric quantity the geometry channel exists to carry. Any mesh export therefore
*contradicts* a measured `exposed_surface_area`, and `exportStage` names the cells it contradicts rather
than quietly overriding them. (On the committed example it contradicts none, because the example declares
`exposed_surface_area: null` on all 31 cells and says why.)

Two smaller things that also do not survive: binary STL has no unit field and most slicers assume
millimetres, so a micrometre embryo is wrong by a factor of 1000 without any complaint — the export states
the unit it dropped. And an 80-byte header beginning `solid` makes several readers sniff the file as ASCII
STL and fail, so the format tag goes first.

## What survives an export, and what does not

| | STL | FASTA |
|---|---|---|
| shape / letters | yes | yes |
| units | **no** — no unit field exists | n/a |
| provenance | 80 bytes of header and a filename marker | one free-text description line |
| cell or record identity | **no** — triangles are not grouped | the identifier only |
| topology — which cell touches which | **no** | n/a |
| transcriptome, mechanics, signalling | **no field they could go in** | n/a |
| coordinates | n/a | description line only, where no tool looks |
| phase, ploidy, zygosity | n/a | **no** — a diploid and a haploid design produce identical FASTA |
| whether it exists in a physical tube | n/a | **no** — a window typed from a paper and one read off a sequencer are byte-identical |
| the stage | one per file, in the name | **no** — a genome FASTA is timeless |

`export-all.mjs` prints both lists verbatim from `WHAT_AN_STL_LOSES` and `WHAT_A_FASTA_LOSES` rather than
paraphrasing them, because a paraphrase would drift from the exporter it describes and the drift would be
invisible: the demo would keep printing a reassuring list of losses while the exporter lost something else.

## Tests

| module | assertions pass | fail under `--fail-once` | survive their own fault |
|---|---|---|---|
| `test-stl.mjs` | 63 | 63 | 0 |
| `test-fasta.mjs` | 38 | 38 | 0 |
| `test-read.mjs` | 56 | 56 | 0 |
| `test-compare.mjs` | 69 | 69 | 0 |
| **total** | **226** | **226** | **0** |

`--fail-once` injects a fault under each assertion in turn. An assertion that still passes asserts nothing
about its subject, so the useful number in the last column is zero. Two of these assertions exist because
the test found a live bug: `stl.mjs` shipped a path traversal in its suggested filename (`../../etc/passwd`
sanitised to `..-..-etc-passwd`, which still traverses), and `read.mjs` reported *"unchecked"* on the
project's own worked example because it looked for `genome.assembly` and the example writes
`genome.reference.assembly`.

## What is not built

Specifically, not as a disclaimer.

- **No measured geometry exists anywhere in this directory.** Every committed stage is `depicted`, so the
  non-refusing branch of `exportStage` — the one that writes a mesh *without* the `DEPICTION` marker — has
  never produced a file from real data. It is exercised only by the tests.
- **No mesh with contact faces.** The spheres interpenetrate and are left that way on purpose; a boolean
  union would look more like an embryo while being further from the data. What would fix it is segmented
  surfaces from an imaging volume, or a stated mechanical model (Surface Evolver, cortex-energy
  minimisation) exported as a `derived` mesh with its rule named. Neither is written.
- **No transcriptome, mechanics or signalling channel on any cell in any committed file.** The vocabulary
  is there and the coverage counter reports `present on 0 of 31 cells` for all three. The per-stage
  mechanics that is carried is an *ordinal rank*, not a per-cell channel.
- **No tree builder.** `compare.mjs` validates a matrix for neighbour joining — square, finite, zero
  diagonal, symmetric, non-negative — and stops there. It does not check the four-point condition,
  additivity, or whether the distances mean anything, and a matrix can pass every check it makes and still
  be a matrix of *coverage* rather than of biology.
- **No liftover.** A comparison across two assemblies, or across two declared coordinate conventions, is
  refused rather than resolved. The example declares no `coordinate_convention` at all, so every genetic
  distance computed from it carries a warning that identical edits could be counted as differences and
  nothing in the output would look wrong.
- **The FASTA path has never run on a `.life` with edits.** The committed `.life` is `reference-only`, so
  the only exercise of the edit-to-window path against a real file is `test-fasta.mjs` reading the
  `.organism` example's single `PROPOSED` edit.
- **Identity is unconfirmed on the worked example, not confirmed.** The genome names `GRCm39` and no
  phenotype or measurement record names anything, so `checkIdentity` returns `checked: false` and the file
  degrades. 11 of 12 constraints applied; the twelfth could not run.
- **One of the example's seven degradations is a reader bug, not a file defect.** `read.mjs` does
  `doc.not_established.map(String)` while the example writes `not_established` as `{what, answer}` objects,
  so all four minimum entries stringify to `[object Object]` and none can match — the file answers all four
  verbatim and is told it is missing all four. `write.mjs` reads `e.what ?? e` and does not have the
  problem. Named here rather than patched, because the fix belongs in `read.mjs` with a test under it.
- **Not a stable public standard.** Version 0.1.0, one project, and the spec has already been corrected
  three times by reading a paper instead of its abstract.
