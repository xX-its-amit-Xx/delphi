# sim-engine/scales: the scale theatre

One designed organism, at every level this repository can say anything about, in 3D. Click a part and you
see which Lean law reaches it (and can open the proof), which checks looked at it, and the graded,
quoted literature chain from a protein up to it.

```
node sim-engine/scales/audit-taxon.mjs          # does the ontology actually place each part in this organism?
node sim-engine/scales/build.mjs                # the scale ladder for every run, and the page bundle
node sim-engine/scales/serve.mjs                # serve dashboard/public; prints the theatre url
node sim-engine/scales/shoot.mjs                # screenshots from the real page
node sim-engine/scales/test/scales.mjs          # 43 tests
```

**You do not normally run any of these.** Running a simulation opens the theatre for you:

- `node runs/<name>/run.mjs` opens it on that run in live mode, and rebuilds the ladder after every
  generation, so the open page redraws as the design is checked. `DELPHI_OPEN=0` runs headless.
- an agent calls the MCP tool **`studio_theatre { run }`**, or passes `run` to **`session_open`**.
- `node mcp/cli.mjs tool session_open ...` at a terminal opens it too. A pipe or a CI job does not.

The test suite never opens anything and never starts a server: with `DELPHI_OPEN` unset, `session_open`
reports a url only if a server is already up, and otherwise has no side effects at all.

## The files

| file | what it is |
|---|---|
| `../lib/scales.mjs` | the join: blueprint + checks + laws + chain + taxon audit + growth track, per generation |
| `body-frames.json` | five schematic body plans (insect, tetrapod, prokaryote, construct, teleost). **Declared positions, not morphometry.** |
| `part-laws.json` | which of the 41 Lean laws is about which kind of part, through which quantity |
| `audit-taxon.mjs` | `in_taxon` / `never_in_taxon` from Ubergraph's nonredundant graph, graded by how specific the constraint is |
| `build.mjs` | replays each run's own organism call and resolves a STATE at every declared life stage |
| `serve.mjs`, `../tools/theatre.mjs` | the static server and the launcher |
| `../../dashboard/public/blueprint3d/studio-live/theatre.{html,js}`, `drawings.js` | the page |
| `../../runs/_chains/<run>.json` | the molecule-to-organ chains, each link quoted from a fetched document and adversarially re-verified |

## Four colours, four kinds of statement

| | |
|---|---|
| **proof** | a Lean theorem, kernel-checked, with a module and a line. The chip opens the source. |
| **check** | arithmetic in `sim-engine/validate/`, resting on something undisputed but not formalised |
| **literature** | a graded, quoted link from a paper, usually in another species |
| **declared** | a number a person typed, carrying the source string that says they typed it |

Nothing leaves `scales.mjs` without one of these four, and a test pins it. The view is worth having only
if a reader can tell a proof from a citation from a guess without reading.

## What a law chip's status means

`supports` / `violates` only when a check actually evaluated the law. Quantities present and nothing run is
**`constrains-but-not-evaluated`** — having the numbers is not the same as anyone having checked them.
`out-of-scope` means the law's own `scope.taxa` excludes the organism. `wrong-quantity` means the law's
quantity does not represent this organism's physics at all (a steady lift coefficient for an insect).

## What it found that nothing else had

**The fruit fly's body is not a fly's.** Joining the literature chain to the blueprint showed that the
chain's organs — the adult fat body and the adult brain, where the longevity experiments act — are not in
the blueprint, which instead contains bone marrow, hyaline cartilage, a penis and a uropygial gland. The
taxon audit says why: of 131 parts, **2** carry an `in_taxon` restriction specific enough to be evidence
that a fly has them; 44 are restricted only to Bilateria, and 85 carry no restriction at all. The
blueprint keeps a part unless a constraint removes it, and the constraints almost never can. Mouse: 79 of
737. The chain's anatomy that the blueprint lacks is drawn as **ghosts**, marked `blueprint_has_it: false`.

## What it does not do

- **No geometry is measured.** Every position is a slot in `body-frames.json`.
- **Development is not simulated.** The age axis is a declared growth track the engine resolves a STATE
  at; nothing divides, nothing forms, and order of appearance is not modelled. The fruit fly's track is
  deliberately non-monotonic (the larva is longer than the adult), and the xenobot has none, because its
  own declaration says it does not inherit a life cycle.
- **The molecular rungs are not proofs.** `gene-regulatory-dynamics` is not formalised; nothing in Lean
  connects a molecule to a tissue.
