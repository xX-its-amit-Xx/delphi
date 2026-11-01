<p align="center">
  <img src="assets/logo.svg" alt="DELPHI seal" width="220">
</p>

# delphisci

**DELPHI**: **D**istributed **E**pistemic **L**ayer for **P**robabilistic **H**ypothesis **I**nference.

This project was created for **Science Claw Hack @ MIT**.

> ### The two names
>
> **LeanBio Forum** and **DELPHI** are the same system. `DELPHI` is the name used throughout
> this repository — every path, module, URL and record id uses it, and none of that is being
> renamed. **LeanBio Forum** is the name the project is presented under: the pitch deck at
> `dashboard/public/deck/`, and the public pages under `/leanbio/`. If you see one name in a file
> and the other on a slide, they refer to the same thing.



## Product report — start here

**[→ The product report](https://delphi-mission-control.ashenoy000.workers.dev/docs/)** is the
human-readable guide to the whole system, with a **For humans / For agents** toggle on every page.
Each of the five surfaces opens with the thing itself running:

| | Surface | What the report covers |
|---|---|---|
| 1 | **Generating nanopubs** | The format, the errors that actually happen (each one observed, not hypothetical), the three validator complaints that are *not* errors, and what to do when you are unsure. |
| 2 | **Nanopubs → Lean** | The two gates, the non-vacuity witness, the `hypotheses_load_bearing` test — and the three moves for formalising from **conflicting** evidence. |
| 3 | **The MCP server** | Every tool family, the transports, and the capability map it was designed around: personas, use cases, grand questions. |
| 4 | **Design Studio & export** | Example uses, and how to get results out to your own validator — `.stl` mesh, genome sequence, design JSON, with the caveats each carries. |
| 5 | **Validation harness** | The five named results that are never summed, neighbour checking and functional explainability, Lean verification at a pinned lawset, why there is no composite verdict, and BYOK key handling. |

It also lists **what is not built**, so no section has to be vague about it.

## Goal

Our goal is to find the **fundamental theorems of biology**: the general laws that hold across organisms, scales, and systems, stated precisely enough to test.

To get there, we:

- extract candidate laws from the literature as claims, each traced back to its source papers and datasets;
- formalize them where possible, for example as Lean 4 theorems using the ontology's formal-verification terms;
- simulate them across many organisms, not just one model system, since a law that holds in only one organism is not fundamental;
- test them against real empirical data for each organism, and record the evidence and our assessments of it;
- publish each step as a nanopublication, so every candidate law, test, and assessment can be cited, queried, and challenged.

A machine-checked proof shows that a theorem follows from its stated assumptions. It does not show that living systems satisfy those assumptions, which is a question for evidence and experiment. Likewise, each organism's simulation is checked against that organism's own data, not data borrowed from another species.

## Progress at a glance

Illustrated summaries of what has been done so far, regenerated as the project moves. All counts come from the repo itself (git history, `delphi_overview`, `organisms/merged/`, `cell-geometry/results/`).

### Everything so far

Claims, assessments, nanopub files, organisms, claim tests, registries and commits per hour, from the first commit through the overnight run.

![Snapshot of everything so far](assets/repo-snapshot.png)

### Commit history, animated

One frame per commit of the opening evening (18:40 to midnight, Oct 30, 2026): claims extracted, assessments, nanopub files, and the repo layout filling in.

![Animated commit history](assets/repo-history.gif)

### Organisms overnight

The parallel cloud-agent run that vendored organism reference data for every chapter of Darwin and Thompson: 782 taxa, 3,340 mentions, 1,372 dataset records, merged in [`organisms/`](organisms/README.md).

![Organisms overnight run](assets/organisms-overnight.gif)

### Nebius

Cellpose-SAM on the Nebius Scientific AI Platform segmented micrographs from seven species to test three of Thompson's cell-packing claims; see [`cell-geometry/`](cell-geometry/README.md).

![What we did with Nebius](assets/nebius-snapshot.png)

## Approach

This project builds on the Project Delphi ontology and uses [nanopublications](https://nanopub.net/) (nanopubs) as the format for publishing and querying small, citable, machine-readable scientific claims.

## Design studio

### Run your generated design through DELPHI validation

**Three inputs, one call, five named results.** Hand the validator your generated design, the base
organism it came from, and the desired phenotype in plain English — the same prompt your generator got.

```
validate_generation {
  "generated":         "winged-zebrafish",
  "base":              "zebrafish-adult",
  "desired_phenotype": "a zebrafish that glides at least 5 m from a 1 m launch and survives 10-30 C as an adult"
}
```

Five results come back side by side, each with its own gate, **never summed**: `genotype_similarity`,
`phenotype_similarity`, `lean_check`, `functional_resolution`, `physics_check`. Each is `pass`, `fail` or
`cannot-assess`, and **`cannot-assess` is not `pass`**. This is the real output of that call, run
2026-11-01:

```
genotype_similarity    CANNOT-ASSESS  no gene-level edit, so no edited sequence state to compare. Not a pass
phenotype_similarity   PASS           inside the calibrated shape distribution (body p 1)
lean_check             CANNOT-ASSESS  no Lean law could be evaluated (25 cannot-evaluate, 10 out of scope)
functional_resolution  FAIL           19 differences from the closest functional analogue are UNRESOLVED
physics_check          FAIL           cannot glide: reachable launch speed 0.67 m/s is below v_min 8.64 m/s,
                                      so lift cannot carry the weight. The lifting area is 166.37x too small

[the scorer thread's own composite, for reference only, NOT this verdict: 0.878 (plausible), v1.0.0]
The word "validated" is WITHHELD: 2 gates failed; 2 could not be assessed; 3 biological scales could not
be assessed; no sequence was compared at any locus.
```

**The scorer calls that design plausible at 0.878. The physics says it cannot leave the water.** Both
sit in the same report and neither is allowed to hide the other. That contrast is the argument for five
named results over one number, and the design is the project's own headline case: a zebrafish with its
pectoral fins scaled up (length and span ×2.26, planform area ×4.45) and nothing else changed. The
report names the reason at the tissue scale too — the wing grew and the pectoral muscle that would have
to move it was never touched.

Full worked example, including the control (the real flying fish as `generated`, which meets the glide
criterion the design misses): [`sim-engine/AGENT-GUIDE.md`](sim-engine/AGENT-GUIDE.md) §0.6, or the page
[`/studio-api/`](https://delphi-mission-control.ashenoy000.workers.dev/studio-api/).

#### Three ways to make that call

**Hosted MCP, for any agent, nothing installed:**

```bash
claude mcp add --transport http delphisci https://delphisci-mcp.fly.dev/mcp
```

**The hosted server does not have the validator.** At the 2026-11-01T06:06Z check it served 16 tools —
the `delphi_*` claim, graph, organism and forum tools — and no `lean_*` and no `validate_generation`. It
is DELPHI's knowledge layer. To validate a design, clone:

```bash
git clone https://github.com/fractastical/delphisci && cd delphisci
npm install && (cd sim-engine && npm install)
claude mcp add delphi-sim-engine -- node "$PWD/sim-engine/server.mjs"   # 54 tools, the validator
claude mcp add delphisci-local   -- node "$PWD/mcp/server.mjs"          # 21 tools, claims + lean_*
```

**No MCP?** The CLI, or the HTTP bridge, with the same arguments and the same envelope:

```bash
node sim-engine/validate-cli.mjs "a zebrafish that glides at least 5 m from a 1 m launch and survives 10-30 C as an adult" \
     --base zebrafish-adult --generated winged-zebrafish     # exit 0 pass, 1 a gate failed, 2 cannot-assess

node sim-engine/http.mjs            # 127.0.0.1:7341, loopback only
curl -s -X POST 127.0.0.1:7341/tool/validate_generation -H 'content-type: application/json' \
  -d '{"generated":"winged-zebrafish","base":"zebrafish-adult","desired_phenotype":"...as above..."}' \
  | jq '.result.results | map_values(.status)'
```

A tool is local-only for one of three reasons, and that is the whole rule: it **runs a Lean build**
(`lean_propose`, refused off loopback), it **writes** (`organism_create`, `session_*`, `swarm_*`, which
append under `sim-engine/sessions/`), or it **reads repository data that is not in the deployed image**
(`validate_generation`, `functional_resolution`, `physics_check`, `design_score`, `edit_plan`,
`closest_relative_*`, which read the five omics layers, the FishShapes reference set, the captured exons
and the GRCz11 coordinate tables; the hosted image packs about 2 MB of claims and law sources).

#### Read this before you trust the numbers

Not an appendix. A collaborator who takes these results at face value will be misled in six measured
ways, each with the page that proves it.

1. **"Real organisms score plausible" is close to worthless on its own.** Blind, held-out, family-out:
   **98–99.6 % of real organisms score above the plausibility cut in every scorer version, and only
   12–17 % of negatives score below it.**
   → [`sim-engine/validate/evaluation/SCORER-EVALUATION.md`](sim-engine/validate/evaluation/SCORER-EVALUATION.md),
   [`/scorer/`](https://delphi-mission-control.ashenoy000.workers.dev/scorer/)
2. **The composite has never beaten its own strongest single term.** v1.3.0 `rank_score` P1 AUC **0.875**
   against its joint Mahalanobis term alone at **0.883** (−0.008, CI −0.020 to 0.002; over all held-out
   items −0.007, CI −0.013 to −0.002, significantly worse). The joint term alone passes all three primary
   endpoints by itself. → same file
3. **`functional_resolution` covers about a third of the requirements, and the analogue has no functional
   data.** 22 of 73 assessable (**30.1 %**); 2 met, both ancestrally; 19 unresolved; and **0 of the 73
   loci carry any flying-fish expression, proteomic or functional-assay data of any kind.**
   → [`sim-engine/validate/functional/RESULTS.md`](sim-engine/validate/functional/RESULTS.md)
4. **No genome was compared, on any run.** All seven repository organisms carry `edits: []`, so
   `sequence_basis` is **`document-only`** and `loci_covered` is **0** on every call. The report prints
   "NO SEQUENCE WAS ASSESSED" in words.
   → [`sim-engine/validate/pipeline/RESULTS.md`](sim-engine/validate/pipeline/RESULTS.md)
5. **Every glide-based physics check grades `circular`.** All ten criterion rows in the physics controls
   carry `model_confidence: circular` or `circular-in-part`; the glide module's model card says "PARTLY
   CIRCULAR … Not independent evidence." What is *not* circular is the four negative controls, each an
   inequality between two independently sourced quantities — which is why a physics `fail` carries weight
   here and a physics `pass` carries much less.
   → [`sim-engine/validate/physics/RESULTS.md`](sim-engine/validate/physics/RESULTS.md),
   [`/t/physics/`](https://delphi-mission-control.ashenoy000.workers.dev/t/physics/)
6. **15 accepted laws evaluate nothing on a design** (of 36 accepted in lawset 1.8.1). Until a guard was
   written on 2026-11-01, a law could be accepted, released, served by every surface and run no
   arithmetic; its first run caught `aerobic-power-bound`, accepted, silently losing constraint `C14` to
   `fick-principle` on an alphabetical tie-break. Each of the 15 now carries a written reason that the
   guard re-checks. → [`lean/registry/LIVE-LOOP-DEMO.md`](lean/registry/LIVE-LOOP-DEMO.md) §0; re-run
   `node lean/registry/check-exposed.mjs`

And the standing one: `lean_check` is a floating-point evaluation of a Lean-backed formula, not a kernel
proof.

Four rules a collaborator's agent must keep: **role labels, never personal identifiers**
(`agent:physics`, not a name); **a `calibrated` number is never a result**; **Aves is a frozen holdout**,
so no bird data is fetched, entered, compared against or used as a parent; and **agents propose, humans
decide** (`session_post` with `kind: "proposal"`, never `"edit"`).

Hand your agent the Claude Code skill at
[`sim-engine/skill/delphi-studio/SKILL.md`](sim-engine/skill/delphi-studio/SKILL.md) and it has all of
the above: copy it into `.claude/skills/delphi-studio/`.

### The rest of the studio

Type what an organism must do in plain text ("glides 5 m, survives 10–30 °C as an adult"). The studio reads it into
criteria, lets people and agents edit the organism at body, organ system, organ, tissue, cell or gene level, runs it
through eleven perturbation scenarios (temperature, current, pressure, altitude, wind, glide, predator, grip, sleep,
day/night, digestion) at every developmental stage, and marks in red any design that breaks an accepted physical or
biological law. The laws are versioned data in [`lean/registry/`](lean/registry/README.md); the optimizer rejects any
candidate with a new binding violation and says "no design meets the spec" when nothing qualifies.

Three ways in:

- **In the browser:** [Open the Fish, Perturb & optimise mode](https://delphi-mission-control.ashenoy000.workers.dev/blueprint3d/explode.html?mode=perturb)
  on the dashboard (standalone harness: `/blueprint3d/perturb`). It runs the same engine code as the server, copied by
  `dashboard/build-engine.mjs`.
- **From your own agent or shell (local):** the `sim-engine` MCP server (`node sim-engine/server.mjs`, stdio), its CLI
  (`node sim-engine/cli.mjs`, `node sim-engine/lean-cli.mjs`, `node sim-engine/validate-cli.mjs`) and its HTTP bridge
  (`node sim-engine/http.mjs`, localhost only). Start with [`sim-engine/AGENT-GUIDE.md`](sim-engine/AGENT-GUIDE.md); the
  contract is [`sim-engine/CONTRACT.md`](sim-engine/CONTRACT.md) and the page
  [`/studio-api/`](https://delphi-mission-control.ashenoy000.workers.dev/studio-api/).
- **Hosted:** the `delphisci` MCP server (`claude mcp add --transport http delphisci https://delphisci-mcp.fly.dev/mcp`).
  Version 0.3.0 in [`mcp/`](mcp/README.md) adds the `lean_*` law tools (`lean_laws_list`, `lean_law_get`,
  `lean_lawset_get`, `lean_check`, `lean_verify`), but the hosted copy serves `main` as of its last deploy and did
  **not** have them at the 2026-11-01 check, so read its `tools/list` before relying on them; a read-only mirror of the
  laws is at `/api/lean/` on the dashboard.

What it does not establish:

- **No numeric prediction about a real zebrafish counts as independent evidence yet.** The independent, pre-registered
  harness ([`sim-engine/validation/STUDIO-RESULTS.md`](sim-engine/validation/STUDIO-RESULTS.md), findings in
  `STUDIO-FINDINGS.md`) scores the in-band wild-type numbers as *circular*: the modules were calibrated to, or
  interpolate, the papers they are scored against. Its passes are negative, law and optimizer controls, signs and
  contract checks, and every negative and optimizer control held. Verdicts changed by amendments written after the
  results are shown next to the pre-registered ones, never in their place.
- Law verdicts in the studio are floating-point checks of Lean-backed formulas, not kernel proofs, and many laws cannot
  be evaluated from the organism state at all; those are reported as not checkable, never as passing. A law's status is a
  registry decision, and the accepted set was grandfathered in at bootstrap without per-law review.
- An edited organism is a shape, not a viable or breedable animal: mixing parents is morphological interpolation, not
  genetic hybridisation. Every number carries its provenance kind (measured, borrowed, derived, calibrated, assumed), and
  a calibrated number is never a result.
- The printable kit ([`anatomy-model/print/`](anatomy-model/print/README.md), viewer at `/print/`) is verified as
  geometry; its flight is untested, and the winged zebrafish is a design, not a species. No Aves data is used anywhere.

## Best practices

Before building, publishing, or querying nanopubs, read [BEST_PRACTICES.md](BEST_PRACTICES.md). It is adapted from the Project Delphi Ontology's publishing guide.

## Related projects

- **Project Delphi Ontology**: [fractastical/project-delphi-ontology](https://github.com/fractastical/project-delphi-ontology)
  - Open pull requests: [project-delphi-ontology/pulls](https://github.com/fractastical/project-delphi-ontology/pulls)

## Querying nanopubs

A nanopublication bundles a single assertion with its provenance and publication info as RDF named graphs. The following resources cover how to find and query them.

To query this project's claims, their math and their assessment rankings, use the `delphisci` MCP server or its CLI in [`mcp/`](mcp/README.md). Agents should start with [AGENTS.md](AGENTS.md), which defines the specialist roles of the claim
pipeline (A1-A13), the inter-agent communication rules, and the shared source of truth. Live team
dashboard: https://delphi-mission-control.ashenoy000.workers.dev/start/

### Web interfaces

- [Nanodash](https://nanodash.knowledgepixels.com/): browse, search, and publish nanopubs in the browser.
- [Nanopub Query](https://query.knowledgepixels.com/): SPARQL endpoints over the nanopub network, including a full repository and per-type and per-pubkey repositories.

### SPARQL

You can send SPARQL queries to the Nanopub Query service. For example, this query lists recent nanopubs with their assertion graphs:

```sparql
PREFIX np: <http://www.nanopub.org/nschema#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?np ?assertion ?created WHERE {
  GRAPH ?head {
    ?np a np:Nanopublication ;
        np:hasAssertion ?assertion .
  }
  OPTIONAL { ?np dct:created ?created . }
}
ORDER BY DESC(?created)
LIMIT 20
```

See the [nanopub-query repository](https://github.com/knowledgepixels/nanopub-query) for available endpoints and usage details.

### Libraries and tooling

- [nanopub-py](https://github.com/fair-workflows/nanopub): Python library for searching, fetching, and publishing nanopubs.
- [nanopub-java](https://github.com/Nanopublication/nanopub-java): Java library and CLI.
- [Nanopub registry](https://github.com/knowledgepixels/nanopub-registry): the decentralized registry that stores and serves nanopubs.

### Background

- [nanopub.net](https://nanopub.net/): overview of the nanopublication model and ecosystem.
- [Nanopublication guidelines](https://nanopub.net/guidelines/working_draft/): the formal specification.
