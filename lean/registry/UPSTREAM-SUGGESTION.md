# Lean law tools on the hosted delphisci MCP: status and follow-ups

The original plan was to suggest this upstream. The scope then changed ("the upstream server is ours to modify,
as long as it's versioned"), so the tools were added to `mcp/` directly, in version **0.3.0** (see `mcp/CHANGELOG.md`).
This note records what reaches collaborators, and when.

## What collaborators get

- **When:** after the hub merges to `main`. `deploy-mcp.yml` then redeploys `delphisci-mcp.fly.dev`, and it also
  redeploys on any later change under `lean/registry/`, `lean/Delphi/`, `lean/laws.json`, `lean/constraints.json`,
  `lean/empirical.json` or `lean/eliminate/browser-check.mjs`.
- **Hosted tools:** `lean_laws_list`, `lean_law_get`, `lean_lawset_get`, `lean_check`, `lean_verify`.
  `lean_propose` is never registered in HTTP mode, because it runs a Lean build on submitted text.
- **`npx -y github:fractastical/delphi#<ref>`:** gets the same tools. The package `files` now include the loader, the
  handlers and the Lean sources (about 2 MB packed).

## Suggested follow-ups (not done)

1. **Commit in the image.** The Docker image has no `.git`, so `gitCommit()` returns null there. Statement hashes
   still pin the content. To also report a commit, pass `--build-arg GIT_SHA=$GITHUB_SHA` in `deploy-mcp.yml` and
   set `ENV DELPHI_GIT_SHA=$GIT_SHA` in the Dockerfile.
2. **Healthz.** Add `lawset: <current>` and the law count to `/healthz` and to the landing text in `mcp/http.mjs`, so
   anyone can see which lawset the hosted server serves.
3. **Contract test against the hosted URL.** After a deploy, compare `lean_laws_list` on the hosted server with
   `dashboard/public/api/lean/index.json` from the same commit. This would catch a deploy that shipped without the
   registry files.
4. **Rate limits.** `lean_check` is cheap (a pure function), but `lean_law_get` reads Lean source. Both sit under the
   existing 120 requests per minute per IP, which is fine at current usage.
