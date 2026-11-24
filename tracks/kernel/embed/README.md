# `delphi` — the method, inside a project that already exists

A command-line toolset over the kernel in `../kernel.mjs`. No dependencies beyond Node 20.

**What question does this answer?** How does a project that is not this one adopt the method — a
source and its words, then a number, then a checked statement, then a verdict, and only then a result?

**What can you do with it that you could not before?** Run one command in your own repository, and
from then on get a refusal, with its reason, whenever a result would outlive its justification.

## Install

```bash
npm install --save-dev https://delphi-mission-control.ashenoy000.workers.dev/blueprint3d/studio-live/tracks/kernel/files/delphisci-delphi-0.3.0.tgz
npx delphi init
npx delphi help
```

Node 20 or later, no dependencies. The package is not on the npm registry; the address above is a
tarball. From a checkout of this repository the same command line is `node tracks/kernel/embed/delphi.mjs`.

| command | what it does |
|---|---|
| `init` | adds `.delphi/` (store, laws folder, generated method document, graph) and changes nothing else |
| `evidence` | records a source and the exact words read in it; refuses without a quote and a locator |
| `fact` | records a measured number under that evidence; refuses without a unit and its conditions |
| `audit <file.lean>` | copies a Lean file into `laws/` with one `#print axioms` line per theorem; the original is only read |
| `law` | records a statement Lean accepted, with the axioms printed; refuses a file that asks for no audit |
| `verdict` | applies a law to facts: `inside`, `outside` or `cannot-assess` (which is never a pass) |
| `build` | mints an artifact and hashes its files, or records a refusal naming what was missing |
| `verify` | recomputes every id and chain link in the store |
| `doctor` | finds what rots without anyone touching the store: an edited proof file, a regenerated artifact, a check that has answered nothing twice |
| `summary` `log` `trace` `why` | read the store; `why <name>` walks a result or a refusal back to the words under it |
| `graph` | rewrites the project's knowledge graph (also done automatically after every mint) |
| `best-practices` | prints the method document, generated from the kernel's guards |
| `version` | the installed version, and the kernel's |

## The files here

| file | what it is |
|---|---|
| `delphi.mjs` | the command line |
| `graph.mjs` | the store as a graph: `graph.json`, JSON-LD and one self-contained page |
| `best-practices.mjs` | the method document. Each rule names the guard in `kernel.mjs` that enforces it; `--check` fails if a guard has gone |
| `lean-check.mjs` | the Lean check: runs Lean in the Lake project a file belongs to and rejects anything that is not an audited proof. `--probes` checks the checker |
| `test-embed.mjs` | drives the real command line in a temporary project: a baseline that must pass, then 29 faults, one at a time |
| `test-install.mjs` | packs the npm package, installs it into an empty folder and drives the installed copy |
| `cookbook.mjs` | runs every recipe against checkouts of three public repositories, through the installed package, and writes `COOKBOOK.md` from what came back |
| `examples/` | the three recipes: Lean proofs with no audit, README numbers with no Lean, Lean proofs that publish their own audit |
| `COOKBOOK.md` | the cookbook. Generated; do not edit by hand |
| `cookbook/<name>/` | the store, graph and report each run produced |

## "Private knowledge graph", precisely

Every command that mints a node rewrites `.delphi/graph/` before it exits, so the project's own record
of what it has checked is never behind its store. That is all "published immediately" means here:
published into a folder the project owns. The tool opens no socket and contacts no registry.
Publishing to an outside registry is irreversible and needs the signing key's owner, so it is not a
build step and there is no command for it.

## What it does not do

- It does not say a theorem is the right theorem, or that a formal statement matches the biology it
  is named after. Both need a reader.
- A law given with `--script` is checked by a script, and its record says so on its face.
- `--expr` runs a JavaScript expression you typed, with only the quantity names in scope. It is a
  convenience for arithmetic, not a sandbox for code you do not trust.
- A Lean file is checked inside the nearest Lake project above it, so it sees your toolchain and your
  libraries. To use a different project, set `DELPHI_LEAN_PROJECT` or pass `--lean-project` to `init`;
  the law record says which was used. With no Lean on the machine a Lean law is refused as
  unchecked. It is never passed.
- It does not build your Lean project. Run `lake build` first, as you would before any check.
- It is not published to the npm registry. Whether to claim a name there is a decision for a person.

## Check it

```bash
node tracks/kernel/embed/test-embed.mjs            # 53 checks, 29 injected faults, none may survive
node tracks/kernel/embed/test-install.mjs          # pack, install into an empty folder, drive that copy
node tracks/kernel/embed/lean-check.mjs --probes   # five bad Lean files rejected, one good one accepted
node tracks/kernel/embed/best-practices.mjs --check
node tracks/kernel/embed/cookbook.mjs --check      # the three recorded runs are self-consistent (offline)
python tracks/video/cli-graph.py --check           # the film's figures all resolve
```
