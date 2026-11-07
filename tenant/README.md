# tenant — the no-egress gate, in two halves

The piece of [issue #6](https://github.com/fractastical/delphi/issues/6) that can live in the repository
and be tested: a gate that answers *could a tenant's record reach a public host from here*, and that has
been **seen to fail**.

```
node tenant/check-egress.mjs                                        the static half
node tenant/check-egress.mjs --profile my-tenant.json
node tenant/check-egress.mjs --dry-run tenant/fixtures/tries-to-publish.mjs   the runtime half
node tenant/test.mjs [--fail-once]
```

Exit 1 on any blocking finding, so it can sit in CI next to `node pipeline/leanbio/check.mjs`.

## Why two halves, and why neither is enough

**`guard.cjs` is the runtime half.** Preload it and the process can only reach hosts you named:

```
DELPHI_EGRESS_ALLOW=registry.example-tenant.internal node --require ./tenant/guard.cjs <script>
```

It intercepts at the socket — `net.connect`, `net.Socket.prototype.connect`, `tls.connect`,
`http(s).request/get` and `fetch` — so it does not care whether the host came from a constant, an
environment variable or a string built at runtime, how many publish scripts exist, or whether a
dependency opens its own connection. It propagates itself to child processes through `NODE_OPTIONS`,
because a publish path that shells out to a jar would otherwise walk straight past it.

**Deny by default.** An empty or absent `DELPHI_EGRESS_ALLOW` blocks everything, loopback included unless
`DELPHI_EGRESS_ALLOW_LOOPBACK=1`. A guard that defaults to permitting is the failure mode this exists to
prevent. Every block throws a named `EgressBlocked` error *and* appends to a log, because a silent block
looks exactly like a network error and would be debugged as one.

Against the planted violation in `fixtures/tries-to-publish.mjs`:

```
connection attempts: 4 (0 allowed, 4 BLOCKED)
  BLOCKED  registry.knowledgepixels.com        via fetch
  BLOCKED  test.registry.knowledgepixels.com   via fetch
  BLOCKED  query.knowledgepixels.com           via fetch
  BLOCKED  example.com:443                     via net.connect
```

That last line is the point of the fixture: the guard catches a raw socket, not only `fetch`.

**But the runtime half only sees code it gets to execute**, and the publish scripts cannot be executed in
a test — they read a signing key from the operator's home directory and POST to a real registry. So
`egress.mjs` is the **static half**: it reads the source and finds every host literal, licence assertion
and public namespace a tenant record would inherit. The two are reported separately and a clean static
scan is never presented as a demonstrated guarantee.

## What the static scan finds on this tree today

433 URL literals across 29 files in 12 publish/build paths, 33 distinct hosts. **3 blocking findings:**

| severity | rule | what |
|---|---|---|
| **blocking** | `egress-to-a-host-not-on-the-tenant-allowlist` | `registry.knowledgepixels.com` — the production registry, **irreversible** |
| **blocking** | same | `test.registry.knowledgepixels.com` — also public; publishing there is a disclosure, not a dry run |
| **blocking** | `record-asserts-an-open-licence` | 21 sites asserting CC BY 4.0 in a record's own pubinfo |
| high | `egress-…` | `github.com`, `doi.org`, `api.gbif.org`, `pubmed.ncbi.nlm.nih.gov`, `query.knowledgepixels.com` |
| high | `public-namespace-minted-into-records` | 11 naming authorities, `w3id.org` among them |
| high | `dockerignore-admits-nanopubs-by-wildcard` | two blanket globs where every other path is an allowlist |
| high | `ci-deploys-on-nanopub-change` | `deploy-mcp.yml` |
| high | `dashboard-serves-static-assets-with-no-entrypoint` | `wrangler.jsonc` declares no `main`, so nothing could authenticate |
| review | `host-literal-of-unknown-purpose` | 17 hosts the scanner would not guess about |

**None of this is a bug in the public project.** The registry is public on purpose, CC BY 4.0 is
deliberate, and `w3id.org/delphi` is the real namespace. They are violations only against a tenant
profile that says records must not leave. The gate exists so the list of things a tenant deployment has
to change is *computed* rather than remembered.

## A URL in source is not egress

The first version of this scanner reported **33 public sinks** and buried the two that matter among 31
that cannot open a socket. `http://www.w3.org/1999/02/22-rdf-syntax-ns#` is an **identifier**: it appears
in a prefix declaration, it is never dereferenced, and no byte leaves the machine because of it. Reporting
it as an egress risk trains a reader to skim the list, which is how a real finding gets missed.

So every host literal is classified three ways and the two risks are reported under **different rules**:

- **fetch** — the line calls something that connects, *or* the URL is assigned to an endpoint-shaped
  constant → an **egress** risk.
- **namespace** — a prefix/base declaration, or a naming authority → a **disclosure** risk of a different
  kind: a tenant record minted under a public namespace is publicly named in its own text, wherever it is
  stored. It opens no connection, and the finding says so.
- **unclassified** — reported *as* unclassified, never silently assigned, because guessing in either
  direction makes the other two lists wrong.

Two asymmetries are deliberate. An **irreversible public sink is always treated as egress** whatever its
line looks like — the registry map is `const REGISTRIES = { test: "https://test.registry…" }`, a
line-only classifier filed both registries as "unknown purpose", and that is the one place a false
negative is unaffordable. And the endpoint-constant pattern carries a leading `\w*` because **an
underscore is a word character**: `\bREGISTR` never matches inside `TENANT_REGISTRY`, so a pattern
anchored that way missed every constant named in the house style.

## What the gate cannot do

`guard.cjs` is a guard inside one process. It cannot stop a child that is not also preloaded (so it
propagates itself), it cannot stop a native addon that opens its own socket, and **it is not a sandbox**.
A real tenant deployment needs a deny-by-default network policy outside the process as well. This is the
half that fits in a repository and can be tested.

The static half will pass a host built at runtime, a dependency's own socket, or any path it was not
pointed at. It says so in its own output, in every report.

## The tests prove both directions

16 assertions; 16 fail under `--fail-once`; 0 survive their own fault. One of them exists specifically
because a guard can be **broken in the safe direction**: blocking everything looks identical to working
until a tenant's own registry is unreachable. So `test3` starts a loopback server, allows it, and asserts
the request **completes**.

That test also cost an hour and left a comment behind: `spawnSync` blocks this process's event loop, so a
server running *here* can never answer the child's connection. The guard allowed it, the handshake sat in
the backlog, and the child timed out looking exactly like a guard that had silently swallowed the
request. It now uses an async spawn.

## Still not built, from issue #6

Per-tenant data scoping in the store, key custody per tenant, an append-only audit log, dashboard
authentication, per-tenant IRI minting and private template resolution. And the questions that need
counsel rather than code: whether a tenant graph starts empty given that 4,925 records already assert CC
BY and 269 are permanently on the public production registry; who buys the KEGG commercial licence; and
whether a signed-but-unpublished private store satisfies a deletion obligation.
