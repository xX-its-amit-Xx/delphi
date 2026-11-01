# Rule paragraph for AGENTS.md (for the hub to paste; the hub owns AGENTS.md)

Paste the section below into `AGENTS.md`, for example after "Querying claims, math and rankings".

---

## Lean laws: one source, every surface (enforced)

Get Lean laws from the API, never from a list you copied. Agents use the `lean_*` MCP tools:
`lean_laws_list`, `lean_law_get`, `lean_lawset_get`, `lean_check`, `lean_verify`, and `lean_propose`
(local stdio only). They are on the hosted `delphisci` server, on `sim-engine/server.mjs`, and on the
sim-engine HTTP bridge (`POST /tool/lean_*`). Without MCP, use `node mcp/cli.mjs laws|law|lawset|check|verify`
or `node sim-engine/lean-cli.mjs ...`. Pages use `dashboard/public/blueprint3d/lean-client.js`, which reads the
live bridge if one is configured and otherwise the static mirror `/api/lean/`. Never paste law ids, statuses or
statements into a page.

All of these read laws through one loader, `lib/lean-source.mjs`. Its source is the versioned registry
`lean/registry/` (one file per law, lawsets under `lean/registry/lawsets/`), with `lean/laws.json` +
`lean/constraints.json` as the fallback until the registry exists.

**Any new Lean law, empirical constraint or eliminating lemma (`*_rules_out`) must be added to the registry
and exposed through the MCP tools, the CLI and the static API in the same change.** In practice:

1. Register the law: `node lean/registry/propose.mjs <file.lean> --meta meta.json --write`. It never
   auto-accepts; acceptance is a human approval recorded in the law file.
2. Map every new constraint to that law (`constraints` in the law file).
3. Regenerate: `node dashboard/build-lean-api.mjs`, and `node sim-engine/server.mjs --dump-contract > sim-engine/contract.json`
   if tools changed.
4. Run `node lean/registry/check-exposed.mjs`. It must pass.

`check-exposed.mjs` fails if any law in the Lean modules, `laws.json`, `constraints.json`, `empirical.json` or
the registry is missing from the registry, from `lean_laws_list`, from `/api/lean/`, from either CLI or from the
hosted MCP server's tools. It also fails if the mirror or `contract.json` is stale. It runs as a pre-commit hook
(enable once per clone with `git config core.hooksPath .githooks`) and in CI
(`.github/workflows/lean-exposed.yml`). A Lean module that holds no law goes into `INFRASTRUCTURE` in
`check-exposed.mjs` with a reason; do not delete laws to make the check pass (laws are retired, never removed).
To mark a new theorem as a law before its registry entry exists, put `-- @law <law_id>` next to it. The check then
holds you to registering that id.

---
