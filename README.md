<p align="center">
  <img src="assets/logo.svg" alt="DELPHI seal" width="220">
</p>

# delphisci

**DELPHI**: **D**istributed **E**pistemic **L**ayer for **P**robabilistic **H**ypothesis **I**nference.

This project was created for **Science Claw Hack @ MIT**.

## Goal

Our goal is to find the **fundamental theorems of biology**: the general laws that hold across organisms, scales, and systems, stated precisely enough to test.

To get there, we:

- extract candidate laws from the literature as claims, each traced back to its source papers and datasets;
- formalize them where possible, for example as Lean 4 theorems using the ontology's formal-verification terms;
- simulate them across many organisms, not just one model system, since a law that holds in only one organism is not fundamental;
- test them against real empirical data for each organism, and record the evidence and our assessments of it;
- publish each step as a nanopublication, so every candidate law, test, and assessment can be cited, queried, and challenged.

A machine-checked proof shows that a theorem follows from its stated assumptions. It does not show that living systems satisfy those assumptions, which is a question for evidence and experiment. Likewise, each organism's simulation is checked against that organism's own data, not data borrowed from another species.

## Approach

This project builds on the Project Delphi ontology and uses [nanopublications](https://nanopub.net/) (nanopubs) as the format for publishing and querying small, citable, machine-readable scientific claims.

## Design studio

Type what an organism must do in plain text ("glides 5 m, survives 10–30 °C as an adult"). The studio reads it into
criteria, lets people and agents edit the organism at body, organ system, organ, tissue, cell or gene level, runs it
through eleven perturbation scenarios (temperature, current, pressure, altitude, wind, glide, predator, grip, sleep,
day/night, digestion) at every developmental stage, and marks in red any design that breaks an accepted physical or
biological law. The laws are versioned data in [`lean/registry/`](lean/registry/README.md); the optimizer rejects any
candidate with a new binding violation and says "no design meets the spec" when nothing qualifies.

Three ways in:

- **In the browser:** [`/blueprint3d/perturb`](https://delphi-mission-control.ashenoy000.workers.dev/blueprint3d/perturb)
  on the dashboard (being merged into the main 3D viewer). It runs the same engine code as the server, copied by
  `dashboard/build-engine.mjs`.
- **From your own agent or shell (local):** the `sim-engine` MCP server (`node sim-engine/server.mjs`, stdio), its CLI
  (`node sim-engine/cli.mjs`, `node sim-engine/lean-cli.mjs`) and its HTTP bridge (`node sim-engine/http.mjs`, localhost
  only). Start with [`sim-engine/AGENT-GUIDE.md`](sim-engine/AGENT-GUIDE.md); the contract is
  [`sim-engine/CONTRACT.md`](sim-engine/CONTRACT.md) and the page [`/studio-api/`](https://delphi-mission-control.ashenoy000.workers.dev/studio-api/).
- **Hosted:** the `delphisci` MCP server (`claude mcp add --transport http delphisci https://delphisci-mcp.fly.dev/mcp`).
  Version 0.3.0 in [`mcp/`](mcp/README.md) adds the `lean_*` law tools (`lean_laws_list`, `lean_law_get`,
  `lean_lawset_get`, `lean_check`, `lean_verify`). The hosted copy serves `main` as of its last deploy, so check its
  `tools/list` before relying on them; a read-only mirror of the laws is at `/api/lean/` on the dashboard.

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
