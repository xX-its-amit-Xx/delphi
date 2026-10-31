# DELPHI MCP server test report

**Summary: 8 tools tested, 100 calls each sent to the hosted server and to a local copy. 4 tools passed every case
(`delphi_overview`, `delphi_search_claims`, `delphi_rank_claims`, `delphi_get_organism`) and 4 failed at least one
(`delphi_get_claim` 2, `delphi_graph` 1, `delphi_organisms` 1, `delphi_sparql` 3). Overall 93 of 100 cases passed.
The hosted server and a local run of `origin/main` gave identical answers on all 100 cases. The local server in the shared
working tree fails on Windows (F1).**

- Server: `https://delphisci-mcp.fly.dev/mcp` (Streamable HTTP, no auth). `/healthz` at test time:
  `{"ok":true,"files":2608,"built":"2026-10-31 17:42"}`.
- Run: 2026-10-31, about 18:05 to 18:15 UTC, from the Windows hackathon box. Calls were spaced at least 1.1 s apart
  (under 55 per minute; the limit is 120). Hosted latency: median 32 ms, max 257 ms. The slowest calls were the
  `source: "network"` ones, which forward to Knowledge Pixels.
- Tools were taken from the server's own `tools/list`. The hosted server has 8 tools. The shared working tree's
  `mcp/server.mjs` has only 6, because it lacks `delphi_organisms` and `delphi_get_organism` (see "Hosted versus local").
- Tester: the `validation` thread. Nothing in the server was changed. This report only describes what happened.

## How each answer was checked

Each case ran three ways:

1. **Hosted**: through the MCP SDK client over Streamable HTTP.
2. **Local MCP**: through the same SDK client over stdio, against `node mcp/server.mjs`. This ran twice:
   - against an `origin/main` snapshot at commit `2404c437`, extracted with `git archive` into `C:\Temp\delphi-validation\main`. One line was patched there (F1) so the local store loads on Windows. This is the fair hosted-versus-local comparison, because the hosted server is deployed from `main`.
   - against the shared working tree, unmodified. This is local `main` at `493b7700`, 372 commits behind `origin/main` and 38 ahead of it.
3. **Local CLI**: `node mcp/cli.mjs`, for 8 of the queries.

Separately, the repo files were indexed independently. Every unsigned TriG file was parsed with `oxigraph.parse` and its
quads were walked directly, with no SPARQL. The answers were checked against that index:

- **Claims**: title, statement and math match the file, and the right file is named as the nanopub.
- **Search**: the result count matches the independent count.
- **Ranking**: means, assessor counts and spreads were recomputed for every returned claim.
- **Graph**: compared with a re-filter of `docs/claims.json`.
- **Organisms**: compared with a re-filter of `organisms/merged/coverage.json`, plus per-taxon dataset and mention counts.

Each case had an expected outcome:

| expected | passes when |
|---|---|
| `ok` | it answers, and the answer agrees with the repo |
| `empty` | it answers with nothing found |
| `notfound` | it answers with nothing found, or returns an error that says "not found" or "no match" |
| `error` | it refuses with a message |

A raw SPARQL parser error counts as a failure for a not-found id, because the caller cannot tell it apart from a server
fault.

To reproduce:

```
node validation/mcp-test/run.mjs                      # hosted vs the working tree
LOCAL_REPO=C:/Temp/delphi-validation/main OUT=validation/mcp-test/results-main.json node validation/mcp-test/run.mjs
```

The raw records are in `validation/mcp-test-results.json`, with `runs.originMainSnapshot` and `runs.workingTree`. For
every case they hold the request, the truncated response, latency, verdict, repo check and hosted-equals-local flag.

## Failures, smallest reproduction first

All the hosted repros below assume an initialized session or a plain JSON-RPC POST. The server is stateless and answers
`tools/call` without `initialize`, so one `curl` line is enough:

```
curl -s https://delphisci-mcp.fly.dev/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"TOOL","arguments":ARGS}}'
```

### F1. The local source is broken on Windows: every local query fails. This is the most serious for this team.

- **Repro** (Windows, repo root): `node mcp/cli.mjs overview`
- **Result:** `Parser error at line 1 between columns 57 and 59: Unexpected escape character '\n'`.
- **Cause:** `mcp/lib.mjs` line 73, in both the working tree and `origin/main`, gives each file a base IRI built from
  `relative(REPO, f)`. On Windows that path has backslashes (`darwin-origin\nanopubs\...`), and a backslash inside
  `<...>` is not a valid Turtle IRI character.
- **Effect:** every `source: "local"` call fails, whether through the stdio MCP server or the CLI. In the working-tree
  run that was 33 tool errors plus 6 not-found cases. This also breaks the `.cursor/mcp.json` stdio setup on this box.
  Only `delphi_graph` works, because it reads JSON and not TriG. The hosted server runs on Linux and is not affected.
- **Fix (not applied in the repo):** add `.replaceAll("\\", "/")` to the path. The `main` snapshot used here has
  exactly this one-line change, and with it the local server matched the hosted server on all 100 cases.

### F2. `delphi_get_claim`: ids containing a space or `>` return a raw SPARQL parser error. Failing cases: `claim-space-in-id`, `claim-iri-injection`.

- **Repro:** `{"name":"delphi_get_claim","arguments":{"id":"fisher kpp speed"}}`
- **Result:** `isError: true`, `error at 11:71: expected IRI parsing failed`. Expected `found: false`, which is what
  `"no-such-claim-xyz"` returns.
- **Cause:** `getClaim` splices the id unescaped into `<${iri}>` in the query text. With `"x> ?p ?o } } #"` it gives
  `error at 12:2: expected [_]`. I did not build a working injection. The impact is bounded: the store is read-only, and
  `delphi_sparql` already allows any read-only query. Still, the id is not validated, and the caller gets parser
  internals instead of "not found".

### F3. `delphi_sparql`: an `ASK` query crashes, and `CONSTRUCT` gives an unclear error. Failing cases: `sparql-ask`, `sparql-construct`.

- **Repro:** `{"name":"delphi_sparql","arguments":{"query":"ASK { GRAPH ?a { ?c a delphi:Claim } }"}}`
- **Result:** `Cannot read properties of undefined (reading 'bindings')`. This is a JavaScript TypeError from
  `simplify()`, which assumes SELECT results.
- **Repro:** `{"query":"CONSTRUCT { ?c a delphi:Claim } WHERE { GRAPH ?a { ?c a delphi:Claim } } LIMIT 1"}`
- **Result:** `Not supported RDF format media type: application/sparql-results+json`.
- **Note:** the tool description says SELECT only, so refusing is acceptable. The messages should say "only SELECT is
  supported".

### F4. `delphi_sparql`: any query whose text contains `PREFIX` gets no default prefixes. Failing case: `sparql-PREFIX-in-literal`.

- **Repro:** `{"query":"SELECT ?c WHERE { GRAPH ?a { ?c rdfs:label ?l FILTER(CONTAINS(?l, \"PREFIX\")) } } LIMIT 1"}`
- **Result:** `error at 1:43: expected one of Prefix not found ...`.
- **Cause:** the check is `query.includes("PREFIX")`. Here `PREFIX` appears only in a string literal, so no prefixes are
  declared and `rdfs:` is undefined.
- **Opposite case:** a query that declares a lowercase `prefix` still gets the defaults added. That is harmless, and the
  `sparql-lowercase-prefix` case passed.

### F5. `delphi_graph` and `delphi_organisms` silently ignore `source: "network"`. Failing cases: `graph-source-network`, `org-source-network`.

- **Repro:** `{"name":"delphi_graph","arguments":{"source":"network","limit":1}}`
- **Result:** a normal answer from the unpublished local snapshot, including drafts and claims never published. There is
  no warning. Unknown arguments are dropped by the input schema.
- **Risk:** a caller who wants only published data gets unpublished data and is not told. The schema should reject
  unknown keys, or the answer should say which source it used. `delphi_overview` with an unknown key (`foo`) is likewise
  ignored. That case was expected to answer, and it did.

### F6. A request body over 1 MB returns 502 with an empty body, not the intended 413. This is a protocol-level check, not a tool case.

- **Repro:** POST a 1.5 MB JSON body to `/mcp`.
- **Result:** the hosted server returns HTTP 502 with an empty body. Run locally (`DELPHI_HTTP_PORT=8799`), the
  connection is reset (curl exit 56).
- **Cause:** `readJson` in `mcp/http.mjs` calls `req.destroy()` as soon as the limit is passed, so the 413 written
  afterwards never reaches the client. On Fly, the proxy turns the reset into a 502.

The other protocol checks behaved correctly:

| request | status | body |
|---|---|---|
| `GET /mcp` | 405 | clear message |
| invalid JSON | 400 | "Body is not valid JSON" |
| unknown JSON-RPC method | 200 | -32601 |
| unknown tool | -32602 | "Tool delphi_nope not found" |
| missing `Accept` header | 406 | clear message |

The rate limit was not tested on purpose, because that would need more than 120 requests in a minute.

## Observations (not counted as failures)

- **The network ranking matches the local ranking.**
  - Rankings are not local-only any more. `README.md` says "No assessments are published to the network yet; ranking only
    works with `source: "local"`", but that is out of date. The network has 1,224 `dataset-resolvability/0.2.0`
    assessments over 612 claims.
  - `delphi_rank_claims` with `source: "network"` returned the same score and assessor count as local for all 500
    returned claims.
  - `dataset-resolvability/0.1.0` is local-only, so on the network it returns `[]`.
- **Tied ranks come back in different orders.**
  - Ties are broken only by assessor count. Equal scores can come back in a different order between local and network,
    or between runs. Example: `wolfram2002-ch06-12` and `wolfram2002-ch02-01`, both 0.9865, swap rank 1 and rank 2.
  - Sorting by claim IRI as a last key would make the order deterministic.
- **The ranking can't be read in full.** `limit` is capped at 500 and there is no offset, but 612 claims carry
  `dataset-resolvability/0.2.0`. The bottom 112 cannot be reached.
- **The network has more claims than local.**
  - The network has 888 claims and local `main` has 880.
  - The network-only claims are 3 in the `morphogenesis` domain.
  - `morphoeval-levin-youtube-channel-math` appears in 6 different nanopubs on the network: superseded copies are not
    filtered out. This is a documented gap.
  - For `fisher-kpp-speed`, local and network fields are equal, except that `rdf:type` comes back in a different order.
- **Docs are out of date.** The README says `delphi_organisms` covers 782 taxa, but the server reports 938 (289 at
  species rank).
- **Two counts of claims.** `delphi_graph` says `matched: 1166` claims, while `delphi_overview` counts 880. That is
  expected: the graph includes drafts and claims with no nanopub, and the docs say so. Callers should not mix the two
  counts.
- **"Not found" looks different in the two lookup tools.**
  - `delphi_get_claim` returns `{found: false}` for an unknown id, and `delphi_get_organism` returns an error,
    `No taxon matches "..."`. Both are clear, but they differ.
  - Claim ids are case-sensitive (`FISHER-KPP-SPEED` is not found). Organism lookup is not case-sensitive
    (`COLUMBA LIVIA` is found).
- **Input validation works.** 29 of the 31 cases that expected a refusal got one with a clear message, and the other
  2 are F5. Wrong types, out-of-range numbers, bad enums and missing required arguments get a `-32602` validation
  message. `INSERT DATA` is refused, and so is a `SERVICE <http://169.254.169.254/...>` federated query on the local source (the store has no SERVICE support), so the tool
  cannot be used to reach the cloud metadata endpoint.
- **Quote injection in text search did not get through.** In `search` and `rank`, literals are escaped with
  `JSON.stringify`, and both quote-injection cases returned nothing found.

## Hosted versus local

| comparison | identical answers | explanation |
|---|---|---|
| hosted vs `origin/main` snapshot (`2404c437`) + F1 path fix, local MCP | **100 / 100** | Hosted is exactly `main`. The data matches too: 2,608 TriG files, 880 claims, claim graph built 2026-10-31 17:42. |
| hosted vs `origin/main` snapshot, local CLI | 8 / 8 | The CLI and the stdio server return the same JSON. |
| hosted vs shared working tree (unpatched), local MCP | 41 / 100 | The working tree is 372 commits behind `origin/main`. Details below. |

The 59 differences against the working tree come from four causes:

1. **F1 breaks the local store.** Every local call that reads TriG fails.
2. **Its `mcp/` is older.** It has no `delphi_organisms` or `delphi_get_organism` (24 cases), and its graph has no
   `verification`, `math` or `theorem` filters. Because unknown keys are ignored (F5), it answers those cases unfiltered.
3. **Its data is older.**
   - It has 2,689 TriG files in the old layout (`darwin-origin/`, `math-bio-theorems/`), against `books/darwin-origin/`
     and `math-bio-claims/` on `main`.
   - It has 904 claims against 880.
   - Its `docs/claims.json` was built 03:41, against 17:42 on hosted. The graph has 880 claims against 1,166, and 16
     `proved` claims against 63.
4. **Nanopub paths differ.** The same claim is reported at a different file path. For example, hosted gives
   `math-bio-claims/nanopubs/unsigned/kimura-fixation-probability.trig`, and the working tree has it under
   `math-bio-theorems/`.

None of these is a hosted-server bug. They mean that any thread querying MCP from the shared tree on Windows gets errors,
and once F1 is patched it would get answers about an older repo than the one the team presents. The hub may want to
sync the shared tree with `origin/main`.

## Per-tool results (hosted, against the `origin/main` comparison run)

Columns:

- **verdict**: the hosted verdict.
- **repo**: whether the answer agrees with the independent parse of the files.
- **=local**: whether the hosted JSON equals the local MCP JSON from the `main` snapshot.
- **ms**: hosted latency.

<!-- TABLES -->
### delphi_overview (6/6 passed)

Parameters: `source`

| case | arguments | expect | verdict | repo | =local | ms | response (start) |
|---|---|---|---|---|---|---|---|
| overview-default | `{}` | ok | pass | agrees | yes | 271 | { "source": "local", "files": 2608, "domains": [ { "domain": "https://w3id.org/d |
| overview-local | `{"source":"local"}` | ok | pass | agrees | yes | 173 | { "source": "local", "files": 2608, "domains": [ { "domain": "https://w3id.org/d |
| overview-network | `{"source":"network"}` | ok | pass | n/a | yes | 230 | { "source": "network", "endpoint": "https://query.knowledgepixels.com/repo/full" |
| overview-bad-source | `{"source":"bogus"}` | error | pass | n/a | yes | 11 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_over |
| overview-wrong-type | `{"source":7}` | error | pass | n/a | yes | 11 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_over |
| overview-unknown-arg | `{"foo":"bar"}` | ok | pass | n/a | yes | 145 | { "source": "local", "files": 2608, "domains": [ { "domain": "https://w3id.org/d |

### delphi_search_claims (15/15 passed)

Parameters: `text`, `domain`, `mathOnly`, `limit`, `source`

| case | arguments | expect | verdict | repo | =local | ms | response (start) |
|---|---|---|---|---|---|---|---|
| search-fixation | `{"text":"fixation"}` | ok | pass | agrees | yes | 72 | [ { "claim": "https://w3id.org/delphi/resource/claim/kimura-fixation-probability |
| search-fixation-math | `{"text":"fixation","mathOnly":true}` | ok | pass | agrees | yes | 53 | [ { "claim": "https://w3id.org/delphi/resource/claim/kimura-fixation-probability |
| search-domain-math-limit5 | `{"domain":"math","limit":5}` | ok | pass | agrees | yes | 66 | [ { "claim": "https://w3id.org/delphi/resource/claim/fisher-ftns", "title": "Fis |
| search-latex-sqrt | `{"text":"\\sqrt","mathOnly":true,"limit":50}` | ok | pass | agrees | yes | 55 | [ { "claim": "https://w3id.org/delphi/resource/claim/fisher-infinitesimal", "tit |
| search-empty-text | `{"text":""}` | ok | pass | agrees | yes | 163 | [ { "claim": "https://w3id.org/delphi/resource/claim/darwin1859-ch01-01", "title |
| search-no-args | `{}` | ok | pass | agrees | yes | 119 | [ { "claim": "https://w3id.org/delphi/resource/claim/darwin1859-ch01-01", "title |
| search-nomatch | `{"text":"zzqqxx-no-such-phrase"}` | empty | pass | agrees | yes | 62 | [] |
| search-long-10kB | `{"text":"fixation fixation fixation fixation fixation fixation fixation fixation fixati...` | empty | pass | n/a | yes | 66 | [] |
| search-quote-injection | `{"text":"\")) } UNION { BIND(1 AS ?x) } #"}` | empty | pass | n/a | yes | 69 | [] |
| search-unicode | `{"text":"Wright–Fisher"}` | ok | pass | agrees | yes | 53 | [] |
| search-wrong-type-text | `{"text":123}` | error | pass | n/a | yes | 11 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_sear |
| search-limit-0 | `{"text":"fixation","limit":0}` | error | pass | n/a | yes | 8 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_sear |
| search-limit-501 | `{"text":"fixation","limit":501}` | error | pass | n/a | yes | 9 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_sear |
| search-limit-string | `{"text":"fixation","limit":"5"}` | error | pass | n/a | yes | 8 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_sear |
| search-network | `{"text":"fixation","source":"network"}` | ok | pass | n/a | yes | 100 | [ { "claim": "https://w3id.org/delphi/resource/claim/kimura-fixation-probability |

### delphi_get_claim (10/12 passed)

Parameters: `id`, `source`

| case | arguments | expect | verdict | repo | =local | ms | response (start) |
|---|---|---|---|---|---|---|---|
| claim-short-id | `{"id":"fisher-kpp-speed"}` | ok | pass | agrees | yes | 47 | { "claim": "https://w3id.org/delphi/resource/claim/fisher-kpp-speed", "source":  |
| claim-full-iri | `{"id":"https://w3id.org/delphi/resource/claim/fisher-kpp-speed"}` | ok | pass | agrees | yes | 45 | { "claim": "https://w3id.org/delphi/resource/claim/fisher-kpp-speed", "source":  |
| claim-darwin | `{"id":"darwin1859-ch09-03"}` | ok | pass | agrees | yes | 118 | { "claim": "https://w3id.org/delphi/resource/claim/darwin1859-ch09-03", "source" |
| claim-unknown | `{"id":"no-such-claim-xyz"}` | notfound | pass | agrees | yes | 66 | { "claim": "https://w3id.org/delphi/resource/claim/no-such-claim-xyz", "found":  |
| claim-empty-id | `{"id":""}` | notfound | pass | n/a | yes | 63 | { "claim": "https://w3id.org/delphi/resource/claim/", "found": false, "source":  |
| claim-missing-id | `{}` | error | pass | n/a | yes | 9 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_get_ |
| claim-wrong-type | `{"id":42}` | error | pass | n/a | yes | 10 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_get_ |
| claim-long-id-10k | `{"id":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...` | notfound | pass | n/a | yes | 75 | { "claim": "https://w3id.org/delphi/resource/claim/xxxxxxxxxxxxxxxxxxxxxxxxxxxxx |
| claim-space-in-id | `{"id":"fisher kpp speed"}` | notfound | fail: unclear error for a not-found id: error at 11:71: expected IRI parsing failed | n/a | yes | 35 | error at 11:71: expected IRI parsing failed |
| claim-iri-injection | `{"id":"x> ?p ?o } } #"}` | notfound | fail: unclear error for a not-found id: error at 12:2: expected [_] | n/a | yes | 38 | error at 12:2: expected [_] |
| claim-case | `{"id":"FISHER-KPP-SPEED"}` | notfound | pass | n/a | yes | 67 | { "claim": "https://w3id.org/delphi/resource/claim/FISHER-KPP-SPEED", "found": f |
| claim-network | `{"id":"fisher-kpp-speed","source":"network"}` | ok | pass | n/a | yes | 100 | { "claim": "https://w3id.org/delphi/resource/claim/fisher-kpp-speed", "source":  |

### delphi_rank_claims (14/14 passed)

Parameters: `type`, `domain`, `minAssessors`, `limit`, `source`

| case | arguments | expect | verdict | repo | =local | ms | response (start) |
|---|---|---|---|---|---|---|---|
| rank-list-types | `{}` | ok | pass | n/a | yes | 213 | { "error": "Pass `type`, one of the assessment types below.", "assessmentTypes": |
| rank-dr010 | `{"type":"dataset-resolvability/0.1.0","limit":10}` | ok | pass | agrees | yes | 114 | [ { "rank": 1, "claim": "https://w3id.org/delphi/resource/claim/darwin1859-ch09- |
| rank-dr020-min2 | `{"type":"dataset-resolvability/0.2.0","minAssessors":2,"limit":500}` | ok | pass | agrees | yes | 242 | [ { "rank": 1, "claim": "https://w3id.org/delphi/resource/claim/wolfram2002-ch06 |
| rank-domain-filter | `{"type":"dataset-resolvability/0.1.0","domain":"darwin","limit":5}` | ok | pass | n/a | yes | 143 | [ { "rank": 1, "claim": "https://w3id.org/delphi/resource/claim/darwin1859-ch09- |
| rank-domain-filter-limit-first | `{"type":"dataset-resolvability/0.2.0","domain":"wolfram","limit":5}` | ok | pass | n/a | yes | 157 | [ { "rank": 1, "claim": "https://w3id.org/delphi/resource/claim/wolfram2002-ch06 |
| rank-unknown-type | `{"type":"no-such-type/9.9"}` | empty | pass | n/a | yes | 28 | [] |
| rank-empty-type | `{"type":""}` | ok | pass | n/a | yes | 136 | { "error": "Pass `type`, one of the assessment types below.", "assessmentTypes": |
| rank-long-type | `{"type":"yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy...` | empty | pass | n/a | yes | 27 | [] |
| rank-quote-injection | `{"type":"a\" ; ?p ?o . } #"}` | empty | pass | n/a | yes | 49 | [] |
| rank-min-assessors-0 | `{"type":"dataset-resolvability/0.1.0","minAssessors":0}` | error | pass | n/a | yes | 9 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_rank |
| rank-wrong-type | `{"type":["dataset-resolvability/0.1.0"]}` | error | pass | n/a | yes | 9 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_rank |
| rank-network | `{"type":"dataset-resolvability/0.1.0","source":"network"}` | ok | pass | n/a | yes | 91 | [] |
| rank-dr020-local-top10 | `{"type":"dataset-resolvability/0.2.0","limit":10}` | ok | pass | agrees | yes | 174 | [ { "rank": 1, "claim": "https://w3id.org/delphi/resource/claim/wolfram2002-ch06 |
| rank-dr020-network-top10 | `{"type":"dataset-resolvability/0.2.0","limit":10,"source":"network"}` | ok | pass | n/a | yes | 225 | [ { "rank": 1, "claim": "https://w3id.org/delphi/resource/claim/wolfram2002-ch02 |

### delphi_graph (14/15 passed)

Parameters: `text`, `thinker`, `work`, `status`, `verification`, `math`, `theorem`, `kind`, `yearFrom`, `yearTo`, `minTruth`, `maxTruth`, `minTruthAssessors`, `published`, `sort`, `groupBy`, `limit`

| case | arguments | expect | verdict | repo | =local | ms | response (start) |
|---|---|---|---|---|---|---|---|
| graph-default | `{}` | ok | pass | agrees | yes | 13 | { "built": "2026-10-31 17:42", "matched": 1166, "claims": [ { "id": "wolfram2002 |
| graph-darwin-disagreement | `{"thinker":"darwin","sort":"disagreement","limit":5}` | ok | pass | agrees | yes | 15 | { "built": "2026-10-31 17:42", "matched": 247, "claims": [ { "id": "darwin1859-c |
| graph-group-thinker | `{"groupBy":"thinker"}` | ok | pass | agrees | yes | 13 | { "built": "2026-10-31 17:42", "matched": 1166, "groupBy": "thinker", "groups":  |
| graph-proved | `{"status":"proved","limit":500}` | ok | pass | agrees | yes | 18 | { "built": "2026-10-31 17:42", "matched": 63, "claims": [ { "id": "fisher-kpp-sp |
| graph-year-inverted | `{"yearFrom":1950,"yearTo":1850}` | empty | pass | agrees | yes | 10 | { "built": "2026-10-31 17:42", "matched": 0, "claims": [] } |
| graph-min-truth-0.9 | `{"minTruth":0.9,"limit":500}` | ok | pass | agrees | yes | 27 | { "built": "2026-10-31 17:42", "matched": 131, "claims": [ { "id": "wolfram2002- |
| graph-bad-status | `{"status":"bogus"}` | error | pass | n/a | yes | 10 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_grap |
| graph-bad-sort | `{"sort":"random"}` | error | pass | n/a | yes | 11 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_grap |
| graph-min-truth-2 | `{"minTruth":2}` | error | pass | n/a | yes | 10 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_grap |
| graph-long-text | `{"text":"fixation fixation fixation fixation fixation fixation fixation fixation fixati...` | empty | pass | n/a | yes | 20 | { "built": "2026-10-31 17:42", "matched": 0, "claims": [] } |
| graph-wrong-type | `{"yearFrom":"1859"}` | error | pass | n/a | yes | 9 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_grap |
| graph-source-network | `{"source":"network","limit":1}` | error | fail: expected an error, got an answer | n/a | yes | 9 | { "built": "2026-10-31 17:42", "matched": 1166, "claims": [ { "id": "wolfram2002 |
| graph-verification-lean | `{"verification":"lean","limit":500}` | ok | pass | agrees | yes | 15 | { "built": "2026-10-31 17:42", "matched": 47, "claims": [ { "id": "thompson1917- |
| graph-theorem | `{"theorem":true,"limit":500}` | ok | pass | agrees | yes | 18 | { "built": "2026-10-31 17:42", "matched": 63, "claims": [ { "id": "fisher-kpp-sp |
| graph-bad-verification | `{"verification":"magic"}` | error | pass | n/a | yes | 10 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_grap |

### delphi_organisms (14/15 passed)

Parameters: `text`, `taxonClass`, `rank`, `project`, `hasAxis`, `missingAxis`, `genomeLevel`, `minScore`, `maxScore`, `minMentions`, `sort`, `groupBy`, `overview`, `limit`

| case | arguments | expect | verdict | repo | =local | ms | response (start) |
|---|---|---|---|---|---|---|---|
| org-default | `{}` | ok | pass | agrees | yes | 249 | { "generated": "2026-10-31", "axes": [ { "id": "genome", "label": "genome sequen |
| org-overview | `{"overview":true}` | ok | pass | agrees | yes | 13 | { "generated": "2026-10-31", "taxa": 938, "speciesRank": 289, "datasets": 1679,  |
| org-aves-genome-no-traits | `{"taxonClass":"Aves","hasAxis":["genome"],"missingAxis":["traits"],"limit":50}` | ok | pass | agrees | yes | 13 | { "generated": "2026-10-31", "axes": [ { "id": "genome", "label": "genome sequen |
| org-group-class | `{"groupBy":"class"}` | ok | pass | agrees | yes | 21 | { "generated": "2026-10-31", "matched": 938, "groupBy": "class", "groups": [ { " |
| org-sort-mentions | `{"sort":"mentions","limit":5}` | ok | pass | agrees | yes | 17 | { "generated": "2026-10-31", "axes": [ { "id": "genome", "label": "genome sequen |
| org-score-inverted | `{"minScore":80,"maxScore":10}` | empty | pass | agrees | yes | 11 | { "generated": "2026-10-31", "axes": [ { "id": "genome", "label": "genome sequen |
| org-nomatch | `{"text":"zzqqxx"}` | empty | pass | agrees | yes | 10 | { "generated": "2026-10-31", "axes": [ { "id": "genome", "label": "genome sequen |
| org-empty-text | `{"text":""}` | ok | pass | agrees | yes | 10 | { "generated": "2026-10-31", "axes": [ { "id": "genome", "label": "genome sequen |
| org-long-text | `{"text":"fixation fixation fixation fixation fixation fixation fixation fixation fixati...` | empty | pass | n/a | yes | 31 | { "generated": "2026-10-31", "axes": [ { "id": "genome", "label": "genome sequen |
| org-bad-axis | `{"hasAxis":["telepathy"]}` | error | pass | n/a | yes | 15 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_orga |
| org-axis-not-array | `{"hasAxis":"genome"}` | error | pass | n/a | yes | 9 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_orga |
| org-limit-1001 | `{"limit":1001}` | error | pass | n/a | yes | 11 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_orga |
| org-wrong-type | `{"minScore":"50"}` | error | pass | n/a | yes | 8 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_orga |
| org-bad-sort | `{"sort":"random"}` | error | pass | n/a | yes | 9 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_orga |
| org-source-network | `{"source":"network","limit":1}` | error | fail: expected an error, got an answer | n/a | yes | 11 | { "generated": "2026-10-31", "axes": [ { "id": "genome", "label": "genome sequen |

### delphi_get_organism (9/9 passed)

Parameters: `id`, `includeMentions`

| case | arguments | expect | verdict | repo | =local | ms | response (start) |
|---|---|---|---|---|---|---|---|
| getorg-slug | `{"id":"columba-livia"}` | ok | pass | agrees | yes | 73 | { "taxon": { "key": "gbif:2495414", "slug": "columba-livia", "accepted_name": "C |
| getorg-gbif | `{"id":"gbif:2495414","includeMentions":false}` | ok | pass | agrees | yes | 66 | { "taxon": { "key": "gbif:2495414", "slug": "columba-livia", "accepted_name": "C |
| getorg-name-upper | `{"id":"COLUMBA LIVIA"}` | ok | pass | agrees | yes | 71 | { "taxon": { "key": "gbif:2495414", "slug": "columba-livia", "accepted_name": "C |
| getorg-vernacular | `{"id":"rock pigeon"}` | ok | pass | agrees | yes | 74 | { "taxon": { "key": "gbif:2495414", "slug": "columba-livia", "accepted_name": "C |
| getorg-unknown | `{"id":"no-such-taxon-xyz"}` | notfound | pass | n/a | yes | 11 | No taxon matches "no-such-taxon-xyz" |
| getorg-empty | `{"id":""}` | error | pass | n/a | yes | 9 | id is required (taxon key like gbif:2495414, slug, or accepted name) |
| getorg-missing | `{}` | error | pass | n/a | yes | 8 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_get_ |
| getorg-wrong-type | `{"id":2495414}` | error | pass | n/a | yes | 14 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_get_ |
| getorg-long | `{"id":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...` | notfound | pass | n/a | yes | 14 | No taxon matches "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx |

### delphi_sparql (11/14 passed)

Parameters: `query`, `source`

| case | arguments | expect | verdict | repo | =local | ms | response (start) |
|---|---|---|---|---|---|---|---|
| sparql-count-claims | `{"query":"SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { GRAPH ?a { ?c a delphi:Claim } }"}` | ok | pass | agrees | yes | 38 | [ { "n": 880 } ] |
| sparql-own-prefix | `{"query":"PREFIX d: <https://w3id.org/delphi/ontology/> SELECT (COUNT(DISTINCT ?c) AS ?...` | ok | pass | agrees | yes | 25 | [ { "n": 880 } ] |
| sparql-lowercase-prefix | `{"query":"prefix d: <https://w3id.org/delphi/ontology/> SELECT (COUNT(DISTINCT ?c) AS ?...` | ok | pass | agrees | yes | 50 | [ { "n": 880 } ] |
| sparql-PREFIX-in-literal | `{"query":"SELECT ?c WHERE { GRAPH ?a { ?c rdfs:label ?l FILTER(CONTAINS(?l, \"PREFIX\")...` | ok | fail: tool error: error at 1:43: expected one of Prefix not found, ['%'], ['-' | '0' ..= ' | n/a | yes | 25 | error at 1:43: expected one of Prefix not found, ['%'], ['-' | '0' ..= '9' | '\u |
| sparql-ask | `{"query":"ASK { GRAPH ?a { ?c a delphi:Claim } }"}` | ok | fail: tool error: Cannot read properties of undefined (reading 'bindings') | n/a | yes | 31 | Cannot read properties of undefined (reading 'bindings') |
| sparql-construct | `{"query":"CONSTRUCT { ?c a delphi:Claim } WHERE { GRAPH ?a { ?c a delphi:Claim } } LIMI...` | ok | fail: tool error: Not supported RDF format media type: application/sparql-results+json | n/a | yes | 30 | Not supported RDF format media type: application/sparql-results+json |
| sparql-update-insert | `{"query":"INSERT DATA { <urn:x> <urn:y> <urn:z> }"}` | error | pass | n/a | yes | 24 | error at 8:10: expected CONSTRUCT |
| sparql-empty | `{"query":""}` | error | pass | n/a | yes | 35 | error at 8:1: expected [_] |
| sparql-missing | `{}` | error | pass | n/a | yes | 9 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_spar |
| sparql-malformed | `{"query":"SELEKT * WHERE {"}` | error | pass | n/a | yes | 30 | error at 8:10: expected CONSTRUCT |
| sparql-wrong-type | `{"query":5}` | error | pass | n/a | yes | 9 | MCP error -32602: Input validation error: Invalid arguments for tool delphi_spar |
| sparql-long-comment | `{"query":"SELECT ?x WHERE { BIND(1 AS ?x) } #zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz...` | ok | pass | n/a | yes | 36 | [ { "x": 1 } ] |
| sparql-service-ssrf | `{"query":"SELECT * WHERE { SERVICE <http://169.254.169.254/latest/meta-data/> { ?s ?p ?...` | error | pass | n/a | yes | 79 | The service <http://169.254.169.254/latest/meta-data/> is not supported |
| sparql-network | `{"query":"SELECT (COUNT(*) AS ?n) WHERE { GRAPH ?a { ?c a delphi:Claim } }","source":"n...` | ok | pass | n/a | yes | 103 | [ { "n": 888 } ] |

### Local CLI versus hosted

| case | command | rows | = local MCP | = hosted |
|---|---|---|---|---|
| overview-default | `node mcp/cli.mjs overview` | - | true | true |
| search-fixation-math | `node mcp/cli.mjs search fixation --math-only` | 3 | true | true |
| claim-short-id | `node mcp/cli.mjs claim fisher-kpp-speed` | - | true | true |
| rank-dr010 | `node mcp/cli.mjs rank dataset-resolvability/0.1.0 --limit 10` | 10 | true | true |
| graph-darwin-disagreement | `node mcp/cli.mjs graph --thinker darwin --sort disagreement --limit 5` | - | true | true |
| graph-group-thinker | `node mcp/cli.mjs graph --group-by thinker` | - | true | true |
| sparql-count-claims | `node mcp/cli.mjs sparql SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE { GRAPH ?a { ?c a delphi:Claim } }` | 1 | true | true |
| claim-unknown | `node mcp/cli.mjs claim no-such-claim-xyz` | - | true | true |
