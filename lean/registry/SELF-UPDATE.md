# LeanBio self-update

LeanBio is served to the public through an MCP server, an HTTP bridge, CLIs and a static `/api/lean/` mirror, and
all of them follow the latest LeanBio statements without a manual step:

1. **At runtime.** The single loader `lib/lean-source.mjs` can read laws from a remote source and re-check it
   every TTL. It verifies every law against the content hash its lawset pins, and swaps the new set in without a
   restart.
2. **In CI.** `.github/workflows/leanbio-publish.yml` rebuilds and redeploys the `/api/lean/` mirror whenever
   `lean/**` changes on main. `deploy-mcp.yml` redeploys the hosted server (its path filters cover
   `lean/registry/**`).
3. **Visibly.**
   - Every `lean_*` envelope says where its laws came from (`source`, `lawset_version`, `fetched_at`).
   - `lean_source_status` shows freshness and integrity.
   - `lean_changes(since_version)` and `/api/lean/changes.json` / `changes.xml` (Atom) say what changed.

## 1. Runtime: the remote source

| env | values | default |
|---|---|---|
| `LEANBIO_REMOTE` | `off` \| `mirror` \| `github` | `mirror` when hosted (`DELPHI_HTTP_PORT` set, i.e. Fly.io); `off` for local use (local files first) |
| `LEANBIO_MIRROR_URL` | base of a static mirror | `https://delphi-mission-control.ashenoy000.workers.dev/api/lean/` |
| `LEANBIO_REPO`, `LEANBIO_REF` | `owner/repo`, branch/tag/commit (github mode) | `fractastical/delphisci`, `main` |
| `LEANBIO_GITHUB_URL` | base of raw `lean/registry/` files (overrides repo+ref) | from REPO+REF |
| `LEANBIO_TTL_S` | seconds between checks | `600` |
| `LEANBIO_TIMEOUT_MS` | per-request timeout | `10000` |

Why the hosted default is `mirror` and not `github`: `lean/registry/` is not on `fractastical/delphisci` main yet
(PR #36 is open). Raw GitHub currently returns 404 for `lean/registry/lawsets/current.json`, so github mode
would fall back to local files until that merges. After the merge, `LEANBIO_REMOTE=github` on Fly follows main
directly, with no mirror deploy in between.

How a check works (`ensureFresh()`, called by the tool layer before each `lean_*` call):

- **When.** At most once per TTL. The hosted server also fetches once at startup, so the first call does not
  wait.
- **What it fetches.**
  - **mirror:** `index.json`, every `lawsets/<v>.json`, every `laws/<id>.json`, the archived
    `laws/<id>@<v>.json` an older lawset pins, and `changes.json`. That is about 61 requests, each sent with
    `If-None-Match`. Against the live Cloudflare mirror an unchanged check is 60 × 304.
  - **github:** `lawsets/current.json`, then each older lawset by walking `previous` (raw hosting cannot list
    directories), the law files they pin (`laws/<id>.json` or `law-versions/<id>@<v>.json`), and
    `CHANGELOG.md`.
- **Integrity.** Every law a fetched lawset pins must satisfy
  `registry-lib.contentHash(served file) === lawset.laws[i].content_hash`, the same hash `release.mjs` pins. One
  mismatch, or one pinned file that is missing, rejects the whole fetch. The last good set stays in service, and
  the rejection is recorded in `lean_source_status.remote.last_rejection`.
- **Failures.** A network error, HTTP error or bad JSON also keeps the last good set, recorded in `last_error`.
  If no remote set has ever been fetched, the loader serves the local files and labels them `local-fallback`.
- **Lean source text.**
  - **mirror:** law docs are already `lean_law_get` results, built where the mirror was built, so they are
    served as-is.
  - **github:** the Lean text comes from this deployment's files, and the `pin` status says whether it still
    matches the pinned statement hash.

What the check does NOT establish:

- **Authorship.** Lawsets are not signed, so a publisher who rewrites a lawset and its law files together is
  not detected. The check catches a half-deployed mirror, a corrupted file or an edited law file.
- **Status changes.** `status` and approval are outside the content hash by design. `lean_lawset_get` and
  `lean_check` use the lawset's own pinned status.
- **New evaluator code.** `lean_check` evaluates with the `lean/eliminate/browser-check.mjs` shipped in the
  deployment. A new law version whose evaluator changed needs the redeploy that `deploy-mcp.yml` performs.

`build-lean-api.mjs`, `check-exposed.mjs` and `lean_verify` always read the local tree: they force
`LEANBIO_REMOTE=off` or call `load({local: true})`.

Envelope fields added to every `lean_*` result (sim-engine contract 0.3.4):

```
"source": "remote:mirror",                  // local | local-fallback | remote:mirror | remote:github
"lawset_version": "1.5.0",                  // current lawset of that source
"fetched_at": "2026-11-01T04:03:48.617Z",   // when this content was fetched (local: when the files were loaded)
"source_detail": { "url": "...", "checked_at": "...", "integrity": "verified: 53 law files, 301 pins across 6 lawsets, all match content_hash", "remote_error": "..." }
```

The two new tools are on both MCP servers, the HTTP bridge and the CLIs:

- **`lean_source_status {refresh?}`.** Mode and why it was chosen, URL/ref, TTL, current and previous remote
  lawset, `fetched_at` / `checked_at` / `next_check_at`, request / 304 / swap / reject counts, `last_error`,
  `last_rejection`, and the local lawset for comparison. `refresh: true` forces a check, at most once per 30 s.
  CLI: `node mcp/cli.mjs source [--refresh]`.
- **`lean_changes {since_version?}`.** Releases newer than `since_version`, newest first. Each entry has
  `summary` and `changes` (the CHANGELOG prose and bullets) and a `diff` computed from the lawset pins
  (`added`, `removed`, `version`, `status`). `up_to_date: true` when there is nothing newer.
  CLI: `node mcp/cli.mjs changes 1.3.0`.

`GET /healthz` on the hosted server now includes `lean: {source, lawset_version, fetched_at, ...}` and the
server version, and the landing page names the law source.

## 2. CI: republishing the mirror

`.github/workflows/leanbio-publish.yml` runs on a push to main that touches `lean/**`, `lib/lean-*.mjs`,
`sim-engine/tools/lean-tools.mjs` or `dashboard/build-lean-api.mjs`. Its steps:

1. `npm ci` (root and sim-engine).
2. `node dashboard/build-lean-api.mjs`.
3. `node lean/registry/check-exposed.mjs`. The job stops here if this is red.
4. `node sim-engine/test/lean-self-update.mjs`.
5. `npx wrangler@4 deploy` from `dashboard/`.
6. Poll the live `index.json` until it serves the new `current_lawset`.

**The secret must be added by a repo admin; no token is in any file.** Add it under Settings, then Secrets and
variables, then Actions:

- `CLOUDFLARE_API_TOKEN`: a token with "Workers Scripts: Edit" on the account that owns the
  `delphi-mission-control` worker.
- `CLOUDFLARE_ACCOUNT_ID`: optional.

Without the token, steps 1 to 4 still run and the deploy is skipped with a warning. The deploy publishes
`dashboard/public/` as committed. Optional repo variable: `LEANBIO_SITE_URL`, if the site moves.

`check-exposed.mjs` now also fails when:

- a `lean_*` envelope lacks `source` / `lawset_version` / `fetched_at`;
- `lean_changes` misses a lawset;
- `leanbio-publish.yml` is missing;
- `deploy-mcp.yml`'s path filters stop covering `lean/registry/**`, `lib/lean-source.mjs` or
  `sim-engine/tools/lean-tools.mjs`.

## 3. Change feeds

`dashboard/build-lean-api.mjs` now also writes:

- `/api/lean/changes.json`: `{current_lawset, entries: [{version, date, previous, title, summary, changes, diff, href}]}`,
  newest first, generated from `lean/registry/CHANGELOG.md` and `lawsets/lawset-*.json`.
- `/api/lean/changes.xml`: the same as Atom 1.0. One `<entry>` per lawset, and `<updated>` is the release date,
  so the file is deterministic and `--check` stays meaningful.

Both appear on the live site at the next mirror deploy. Until then, a `mirror` client builds the feed from the
lawset notes and pins.

## 4. Demo (run 2026-11-01, 04:03 to 04:06 UTC, Windows, node 24)

The helper scripts live outside the repo in `C:/Temp/leanbio-demo/bin/`:

- `serve.mjs <dir> <port>`: a static test mirror. Strong ETags, 304 on If-None-Match, files read from disk on
  every request.
- `copy-live.mjs <url> <dir>`: copies the live mirror byte for byte.
- `release.mjs <dir> <version> <law_id> <status>`: publishes a new lawset on the test mirror (current lawset
  with one status changed; `current.json` and `index.json` updated).
- `tamper.mjs <dir> <law_id>`: edits one law file's `statement_en` without touching any lawset.
- `mcp-call.mjs <port> <tool> '<json>' [fields]`: one MCP `tools/call` over Streamable HTTP (POST /mcp),
  printing selected envelope fields.
- `run.sh`: defines `run`, which echoes a command and then runs it.

### 4a. Against the LIVE mirror

```
cd delphisci
DELPHI_HTTP_PORT=8791 LEANBIO_REMOTE=mirror LEANBIO_MIRROR_URL=https://delphi-mission-control.ashenoy000.workers.dev/api/lean/ LEANBIO_TTL_S=20 node mcp/server.mjs
# log:
delphisci MCP on :8791/mcp (2758 TriG files, claim graph 2026-10-31 03:41)
lean laws: remote:mirror lawset 1.5.0 (https://delphi-mission-control.ashenoy000.workers.dev/api/lean/)
```

```
$ curl -s localhost:8791/healthz
{"ok":true,"version":"0.4.0","files":2758,"built":"2026-10-31 03:41","lean":{"source":"remote:mirror","lawset_version":"1.5.0","fetched_at":"2026-11-01T04:03:48.617Z","checked_at":"2026-11-01T04:04:24.325Z","url":"https://delphi-mission-control.ashenoy000.workers.dev/api/lean/","integrity":"verified: 53 law files, 301 pins across 6 lawsets, all match content_hash"}}
$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8791 lean_lawset_get '{}' source lawset_version fetched_at source_detail.integrity result.version result.previous result.is_current
{
 "source": "remote:mirror",
 "lawset_version": "1.5.0",
 "fetched_at": "2026-11-01T04:03:48.617Z",
 "source_detail.integrity": "verified: 53 law files, 301 pins across 6 lawsets, all match content_hash",
 "result.version": "1.5.0",
 "result.previous": "1.4.0",
 "result.is_current": true
}

$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8791 lean_source_status '{}' source lawset_version fetched_at result.mode result.mode_reason result.ttl_s result.remote.url result.remote.laws result.remote.laws_verified result.remote.pins_verified result.remote.checked_at result.remote.next_check_at result.remote.last_error result.remote.stats
{
 "source": "remote:mirror",
 "lawset_version": "1.5.0",
 "fetched_at": "2026-11-01T04:03:48.617Z",
 "result.mode": "mirror",
 "result.mode_reason": "LEANBIO_REMOTE=mirror",
 "result.ttl_s": 20,
 "result.remote.url": "https://delphi-mission-control.ashenoy000.workers.dev/api/lean/",
 "result.remote.laws": 52,
 "result.remote.laws_verified": 53,
 "result.remote.pins_verified": 301,
 "result.remote.checked_at": "2026-11-01T04:04:24.325Z",
 "result.remote.next_check_at": "2026-11-01T04:04:44.325Z",
 "result.remote.last_error": null,
 "result.remote.stats": {
  "checks": 2,
  "ok": 2,
  "failed": 0,
  "rejected": 0,
  "requests": 122,
  "not_modified": 60,
  "swaps": 1
 }
}

$ sleep 21

$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8791 lean_laws_list '{"status":"contested"}' source lawset_version fetched_at result.count
{
 "source": "remote:mirror",
 "lawset_version": "1.5.0",
 "fetched_at": "2026-11-01T04:03:48.617Z",
 "result.count": 3
}

$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8791 lean_source_status '{}' fetched_at result.remote.checked_at result.remote.stats
{
 "fetched_at": "2026-11-01T04:03:48.617Z",
 "result.remote.checked_at": "2026-11-01T04:04:51.914Z",
 "result.remote.stats": {
  "checks": 3,
  "ok": 3,
  "failed": 0,
  "rejected": 0,
  "requests": 183,
  "not_modified": 119,
  "swaps": 1
 }
}
```

The live mirror (Cloudflare) answered every unchanged file with 304: each check is 61 requests, of which 60 are
304s, and the 61st is `changes.json`, a 404 until this build is deployed. `fetched_at` stays at the first fetch
because the content did not change; `checked_at` advances with each check.

### 4b. A new lawset, then a tampered file, on a local test mirror, with no restart

The server keeps the mirror URL it started with, so phase b runs a second server (port 8793) against a local
copy of the live mirror. That server is never restarted.

```
$ node bin/copy-live.mjs https://delphi-mission-control.ashenoy000.workers.dev/api/lean/ C:/Temp/leanbio-demo/mirror
copied 61 files of lawset 1.5.0 from https://delphi-mission-control.ashenoy000.workers.dev/api/lean/ to C:/Temp/leanbio-demo/mirror
node C:/Temp/leanbio-demo/bin/serve.mjs C:/Temp/leanbio-demo/mirror 8792
DELPHI_HTTP_PORT=8793 LEANBIO_REMOTE=mirror LEANBIO_MIRROR_URL=http://127.0.0.1:8792/api/lean/ LEANBIO_TTL_S=15 node mcp/server.mjs
# log:
delphisci MCP on :8793/mcp (2758 TriG files, claim graph 2026-10-31 03:41)
lean laws: remote:mirror lawset 1.5.0 (http://127.0.0.1:8792/api/lean/)
```

```
$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8793 lean_lawset_get '{}' source lawset_version fetched_at source_detail.url result.version
{
 "source": "remote:mirror",
 "lawset_version": "1.5.0",
 "fetched_at": "2026-11-01T04:05:01.742Z",
 "source_detail.url": "http://127.0.0.1:8792/api/lean/",
 "result.version": "1.5.0"
}

$ node /c/Temp/leanbio-demo/bin/release.mjs C:/Temp/leanbio-demo/mirror 1.6.0-demo perturb-pressure accepted
test mirror now serves lawset 1.6.0-demo (previous 1.5.0): perturb-pressure candidate -> accepted

$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8793 lean_lawset_get '{}' source lawset_version fetched_at result.version
{
 "source": "remote:mirror",
 "lawset_version": "1.5.0",
 "fetched_at": "2026-11-01T04:05:01.742Z",
 "result.version": "1.5.0"
}

$ sleep 16

$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8793 lean_lawset_get '{}' source lawset_version fetched_at result.version result.previous result.note
{
 "source": "remote:mirror",
 "lawset_version": "1.6.0-demo",
 "fetched_at": "2026-11-01T04:05:24.762Z",
 "result.version": "1.6.0-demo",
 "result.previous": "1.5.0",
 "result.note": "DEMO release on a local test mirror: perturb-pressure candidate -> accepted. Not a real release."
}

$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8793 lean_changes '{"since_version":"1.5.0"}' lawset_version result.count result.entries.0.version result.entries.0.diff
{
 "lawset_version": "1.6.0-demo",
 "result.count": 1,
 "result.entries.0.version": "1.6.0-demo",
 "result.entries.0.diff": {
  "added": [],
  "removed": [],
  "version": [],
  "status": [
   {
    "law_id": "perturb-pressure",
    "from": "candidate",
    "to": "accepted"
   }
  ]
 }
}

$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8793 lean_source_status '{}' result.remote.lawset_version result.remote.previous_lawset_version result.remote.fetched_at result.remote.stats
{
 "result.remote.lawset_version": "1.6.0-demo",
 "result.remote.previous_lawset_version": "1.5.0",
 "result.remote.fetched_at": "2026-11-01T04:05:24.762Z",
 "result.remote.stats": {
  "checks": 2,
  "ok": 2,
  "failed": 0,
  "rejected": 0,
  "requests": 123,
  "not_modified": 59,
  "swaps": 2
 }
}

$ node /c/Temp/leanbio-demo/bin/tamper.mjs C:/Temp/leanbio-demo/mirror E1
tampered laws\E1.json: statement_en now starts "TAMPERED: areaExponent < 2 and 1 < wingL..."

$ sleep 16

$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8793 lean_law_get '{"id":"E1"}' source lawset_version fetched_at source_detail.remote_error result.statement_en
{
 "source": "remote:mirror",
 "lawset_version": "1.6.0-demo",
 "fetched_at": "2026-11-01T04:05:24.762Z",
 "source_detail.remote_error": "content hash mismatch for E1@1.0.0 (http://127.0.0.1:8792/api/lean/laws/E1.json): lawset 1.0.0 pins f1ef3d6938a0e49689c0a878a32c7161395b50070ba1047548c0ef265411e376, the served file hashes to dfff1588f5d42b56e660fc4c8dcd5ac3db96338504db6d1c5e3c78b1b558b0d3",
 "result.statement_en": "areaExponent < 2 and 1 < wingLoadingExponent, with the mass exponent in [2.90, 3.02]."
}

$ node /c/Temp/leanbio-demo/bin/mcp-call.mjs 8793 lean_source_status '{}' result.remote.lawset_version result.remote.last_rejection result.remote.stats
{
 "result.remote.lawset_version": "1.6.0-demo",
 "result.remote.last_rejection": {
  "at": "2026-11-01T04:05:41.268Z",
  "reason": "content hash mismatch for E1@1.0.0 (http://127.0.0.1:8792/api/lean/laws/E1.json): lawset 1.0.0 pins f1ef3d6938a0e49689c0a878a32c7161395b50070ba1047548c0ef265411e376, the served file hashes to dfff1588f5d42b56e660fc4c8dcd5ac3db96338504db6d1c5e3c78b1b558b0d3",
  "law_id": "E1",
  "version": "1.0.0",
  "url": "http://127.0.0.1:8792/api/lean/laws/E1.json",
  "lawset": "1.0.0",
  "expected": "f1ef3d6938a0e49689c0a878a32c7161395b50070ba1047548c0ef265411e376",
  "got": "dfff1588f5d42b56e660fc4c8dcd5ac3db96338504db6d1c5e3c78b1b558b0d3",
  "kept": "remote lawset 1.6.0-demo (last good)"
 },
 "result.remote.stats": {
  "checks": 3,
  "ok": 2,
  "failed": 0,
  "rejected": 1,
  "requests": 185,
  "not_modified": 119,
  "swaps": 2
 }
}
```

What this shows:

- **Within the TTL, the old set is still served.** The new lawset `1.6.0-demo` was published, and the call
  that followed still got 1.5.0.
- **After the TTL, the same running server serves `1.6.0-demo`.** `previous_lawset_version` is 1.5.0, and
  `lean_changes` reports the status change computed from the pins.
- **The tampered `laws/E1.json` was rejected.** The served file hashes to `dfff1588...`, but the lawsets pin
  `f1ef3d69...`. The server kept lawset `1.6.0-demo` and the untampered E1 statement, and reported the
  rejection in `last_rejection` and in every envelope's `source_detail.remote_error`.
- **The test mirror log confirms the traffic:** 119 responses were 304, and full 200s were sent only for
  changed files (`index.json`, `lawsets/1.6.0-demo.json`, the tampered `laws/E1.json`).

`1.6.0-demo` exists only in `C:/Temp/leanbio-demo/mirror/`. It is not a release, and the repo's registry was
not touched.

## 5. Tests

- `node sim-engine/test/lean-self-update.mjs` (14 tests, in-process mirror and raw-registry servers on
  127.0.0.1, no internet). It covers:
  - mode defaults;
  - local envelopes;
  - first fetch and verification;
  - no refetch inside the TTL, 304s after it;
  - pickup of a new lawset;
  - `lean_changes` diff and `since=current`;
  - tamper rejection, missing pinned file, HTTP 500, recovery, and unreachable-at-start fallback;
  - `changes.json` and `changes.xml` well-formedness;
  - github mode against `lean/registry/` itself.

  The test was made to fail once, with 13 tests at that point (github mode was added afterwards), by disabling
  the hash comparison (`if (false && pin.content_hash && ...)` in `verifyPinned`):

```
self-update (local lawset 1.5.0, test mirror http://127.0.0.1:55704/api/lean/)
  ok    mode defaults: local dev is off (local files first), the hosted server is mirror, junk is off
  ok    local mode: every lean_* envelope says source "local", the lawset version and when it was loaded
  ok    mirror mode: first call fetches, verifies every pinned law, and serves the remote lawset
  ok    within the TTL nothing is re-fetched
  ok    after the TTL the check is conditional: 304s, fetched_at unchanged, checked_at advances
  ok    a new lawset published on the mirror is picked up after the TTL, without a restart
  ok    lean_changes(since_version) reports the new release with its diff; since=current is up to date
  FAIL  a tampered law file (content hash mismatch) is rejected and the last good set kept
          AssertionError [ERR_ASSERTION]: the tampered text is not served
              at file:///D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/sim-engine/test/lean-self-update.mjs:146:10
              at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
  ok    a lawset pinning a law the mirror does not serve is rejected too
  ok    a server error keeps the last good set and is reported
  ok    once the mirror is consistent again the next check succeeds and clears the error
  ok    remote unreachable from the start: falls back to the local files, says so
  ok    changes.json covers every lawset and changes.xml is well-formed Atom

12 passed, 1 failed
```

  With the comparison restored, all 14 pass.
- `node lean/registry/check-exposed.mjs` is green, including the new self-update checks (part 2). Before the
  workflow and the rebuilt mirror existed it failed on `ci:publish` (workflow missing) and `stale:mirror`
  (`changes.json` and `changes.xml` missing).
- `node sim-engine/test/lean-tools.mjs`: 25 passed.
- CI runs both tests in `lean-exposed.yml` and in `leanbio-publish.yml`.
