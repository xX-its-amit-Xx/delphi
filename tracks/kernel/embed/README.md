# `delphi` — the method, inside a project that already exists

A command-line toolset over the kernel in `../kernel.mjs`. No dependencies beyond Node 20.

**What question does this answer?** How does a project that is not this one adopt the method — a
source and its words, then a number, then a checked statement, then a verdict, and only then a result?

**What can you do with it that you could not before?** Run one command in your own repository, and
from then on get a refusal, with its reason, whenever a result would outlive its justification.

```bash
node tracks/kernel/embed/delphi.mjs help
```

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

## The files here

| file | what it is |
|---|---|
| `delphi.mjs` | the command line |
| `graph.mjs` | the store as a graph: `graph.json`, JSON-LD and one self-contained page |
| `best-practices.mjs` | the method document. Each rule names the guard in `kernel.mjs` that enforces it; `--check` fails if a guard has gone |
| `test-embed.mjs` | drives the real command line in a temporary project: a baseline that must pass, then 28 faults, one at a time |
| `cookbook.mjs` | runs every recipe against a checkout of a public repository and writes `COOKBOOK.md` from what came back |
| `COOKBOOK.md` | the cookbook. Generated; do not edit by hand |
| `cookbook/` | the store, graph and report that run produced |

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
- Lean files are checked by `tracks/lean/check.sh`, which needs a Lean 4 toolchain. Without one a
  Lean law is refused as unchecked. It is never passed.
- The tool is not packaged for installation yet: it runs from this repository by path.

## Check it

```bash
node tracks/kernel/embed/test-embed.mjs            # 52 checks, 28 injected faults, none may survive
node tracks/kernel/embed/best-practices.mjs --check
node tracks/kernel/embed/cookbook.mjs --check      # the recorded run is self-consistent (offline)
python tracks/video/cli-graph.py --check           # the film's figures all resolve
```
