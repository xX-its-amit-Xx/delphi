# delphisci MCP server changelog

Versions follow `version` in the root `package.json` (the server's package) and `VERSION` in `mcp/server.mjs`.

## 0.3.0 (2026-10-31)

- Added the Lean law tools: `lean_laws_list`, `lean_law_get`, `lean_lawset_get`, `lean_check`,
  `lean_verify`, and `lean_propose` (stdio only; never registered when `DELPHI_HTTP_PORT` is set, because it
  runs a Lean build). Handlers are imported from `sim-engine/tools/lean-tools.mjs`, which reads laws through
  the single loader `lib/lean-source.mjs` (the registry in `lean/registry/`, else `lean/laws.json` +
  `lean/constraints.json`). Results use the provenance envelope `{result, provenance, scope}`.
- `mcp/cli.mjs`: `laws`, `law`, `lawset`, `check`, `propose`, `verify` subcommands (shared with
  `sim-engine/lean-cli.mjs`).
- Packaging: `package.json` `files` and `.dockerignore` now ship the loader, the handlers and the Lean law
  sources, so the hosted image and `npx github:` installs serve the laws. `deploy-mcp.yml` redeploys on changes
  under `lean/registry/`, `lean/Delphi/`, `lean/laws.json`, `lean/constraints.json`, `lean/empirical.json`,
  `lean/eliminate/browser-check.mjs` and the shared loader/handlers.
- Fix: `mcp/lib.mjs` built nanopub base IRIs from `path.relative` with backslashes on Windows, which oxigraph
  rejected as escapes (`Unexpected escape character '\n'`), so the server failed to start from a Windows
  checkout. Paths are now normalised to `/`. No change on Linux (the hosted server).

## 0.2.0

- Claims, nanopubs, assessment rankings, the claim graph and SPARQL (`delphi_*` tools); Streamable HTTP mode.
