# `.organism` — a portable organism file that cannot launder a guess into a fact

An `.stl` file is honest because of what it refuses to carry. It holds triangles. It does not claim the
object can be printed, that the material exists, or that the part will bear load — and because everyone
knows that, a dozen programs can read one without arguing about what it means.

An organism file is harder, because the interesting fields are **claims**. *"Pectoral fin length /
standard length = 0.31"* is not a triangle: it is measured, or predicted, or copied from a relative, or
assumed. A format that stores the number without the distinction launders a guess into a fact the moment
a second program reads it.

So this format is built around one rule:

> **Every value carries a `kind` and a `scope`.** A value with no kind is not a value, and the reader
> refuses the file rather than guessing one.

```
node organism-format/write.mjs            # build the example from committed artefacts
node organism-format/test.mjs [--fail-once]
```

## What it looks like on a real design

`examples/winged-zebrafish.organism`, generated from `design-validation/scorecard.json`,
`sim-engine/params/ontogeny.json` and the bench cases — nothing retyped, so it cannot drift:

```
reader: ok: 15 value(s), all with a kind and a scope.
values by kind: { "not-established": 9, "assumed": 4, "measured": 2 }
  simulate           excludes 13 value(s) of kind ["not-established","assumed"]
  publish_a_number   excludes 13 value(s)
  render             excludes  9 value(s) of kind ["not-established"]
```

**A simulator may use 2 of the 15 values in this organism.** That is the design, stated plainly for the
first time. The file is mostly `not-established`, and that is the content rather than an omission: the
pre-registered scorecard could score 1 of 10 declared phenotypic axes, and the axis the whole design
claim rests on — pectoral fin length / SL — is not the one it could score.

## `not-established` is a first-class value

Most formats cannot say this. They have a field, and the field is either filled or absent — and an absent
field reads as *"nobody thought about it"*, which is a far weaker statement than *"we declared this axis
in advance, went looking, and the value does not exist in any source we could reach"*.

```json
"pectoral fin length / SL": {
  "v": null, "unknown": true, "kind": "not-established",
  "why": "design value exists only in a figure (not digitised)",
  "what_would_resolve_it": "a measured wild-type adult zebrafish pectoral-fin-length / SL allometry. None was found in any fetched source, and a partner lab could produce one from existing adults with calipers and no injection.",
  "scope": "a value on this axis says nothing about any other axis, and nothing about whether the organism is viable."
}
```

An unknown needs a **reason** and a **scope** like any other value, and it must carry **no number** — a
test found that hole: `{v: 0.31, unknown: true}` originally skipped every provenance check while still
presenting a number a careless reader would use. That is exactly the laundering the format exists to
stop, so the reader now catches it.

## Why not a FASTA

The obvious design is "the FASTA plus a phenotype table". A zebrafish primary assembly is 1.37 Gbp, 410 MB
compressed, and 99.999 % of it is identical to the reference. Embedding it makes the file unportable and,
worse, **hides the design**: a reader cannot tell which bases are the point.

So the genome is an **edit list against a named assembly**, with edited windows inline. Kilobytes, and it
states exactly what differs. Inline sequence is allowed for a transgene with no reference to diff
against, flagged separately, and the reader warns above 100 kb.

## The reader refuses, degrades, or accepts

| outcome | meaning |
|---|---|
| `refused` | something is missing whose absence changes what a reader believes |
| `degraded` | readable, but named values **may not be treated as data** |
| `ok` | every value carries a kind and a scope |

The middle one is the point. A reader that silently accepted a degraded file would make the format
worthless, because the next program in the chain would have no way to know.

**Refusals**, each because the absence would mislead rather than merely annoy:

- a stage with **no temperature** — the same embryo at 25 °C and 33 °C is at different stages at the same
  hour, so a developmental time without a temperature is not a time
- a missing **`validation`** block — an *empty* one says "nothing was checked", which is information; an
  absent one reads as though checking was not relevant
- fewer than the four minimum **`not_established`** entries (*exists, viable, built, approved*) — the
  claims a reader is most likely to make on the file's behalf
- an **edit list with no named assembly** — a list of edits to nothing

## `usableFor(file, purpose)`

The question the format exists to answer:

| purpose | may consume |
|---|---|
| `render` | anything, provided the caption says which — `depicted` exists for this |
| `simulate` | `measured`, `derived`, `calibrated`. A simulation that consumes an assumed value produces a result about the assumption. |
| `publish_a_number` | `measured` only |
| `compare_to_a_real_organism` | `measured`, `measured-secondhand` — comparing a prediction to a measurement and calling it agreement is the error this guards |

## What it is not

Not a simulation — it is the input a simulator reads, and it says which of its numbers a simulator may
treat as data. Not evidence that the organism is viable, buildable or sane. Not a licence to build
anything: it carries no approval and cannot grant one. Not a stable public standard — version 0.1.0,
written in a week, by one project.

It also carries **no ecology**. `environment` names what is absent — predation, competition, food,
flow, conspecifics — because a file that carried a phenotype and nothing else would invite the reader to
assume the phenotype is enough. It is not: a designed organism that cannot feed itself among
better-adapted competitors is a design that fails outside the file, and nothing here models that yet.

21 assertions pass; 21 fail under `--fail-once`; 0 survive their own fault.
