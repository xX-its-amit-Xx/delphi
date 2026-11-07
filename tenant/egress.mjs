// THE STATIC HALF OF THE EGRESS GATE: every outbound host this repository can reach from a publish or
// build path, enumerated, classified, and checked against what a tenant approved.
//
// ============================== THE TWO HALVES, AND WHY BOTH ==============================
// guard.cjs is the RUNTIME half: it intercepts at the socket, so it catches a host however it was built.
// But it only sees the code paths a test actually executes, and the publish scripts cannot be executed in
// a test (they read a signing key from the operator's home directory and POST to a real registry).
//
// This file is the STATIC half: it reads the source and finds every host literal, every licence
// assertion and every public namespace that a tenant record would inherit. It catches what the runtime
// guard never gets a chance to see. Neither half is sufficient and the gate reports them separately, so
// a passing static scan is never mistaken for a demonstrated guarantee.
//
// ============================== WHAT A VIOLATION MEANS ==============================
// Not "someone did something wrong". Every finding below is correct behaviour for the PUBLIC project:
// the registry is public on purpose, CC BY 4.0 is deliberate, and w3id.org/delphi is the project's real
// namespace. They are violations only against a tenant profile that says records must not leave. The
// gate exists so that the list of things a tenant deployment has to change is computed rather than
// remembered.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const WHAT_THIS_IS =
  'The static half of a no-egress gate. It enumerates every outbound host, licence assertion and public ' +
  'namespace reachable from the nanopub publish and build paths, and reports what a tenant profile would ' +
  'have to change. A clean static scan is NOT a demonstrated no-egress guarantee - see guard.cjs for the ' +
  'runtime half, and --dry-run for the two together.';

/** Hosts that are PUBLIC by design. Reaching any of them with a tenant record is the thing to prevent. */
export const PUBLIC_SINKS = {
  'registry.knowledgepixels.com': { what: 'the PRODUCTION nanopub registry', irreversible: true, note: 'a nanopub published here is immutable and cannot be withdrawn' },
  'test.registry.knowledgepixels.com': { what: 'the "test" nanopub registry', irreversible: true, note: 'PUBLIC, not a staging environment. Publishing a tenant record here is a disclosure, not a dry run.' },
  'query.knowledgepixels.com': { what: 'the public nanopub SPARQL endpoint', irreversible: false, note: 'read-only, but a query carries the shape of what is being asked' },
  'w3id.org': { what: 'the public IRI namespace and ontology host', irreversible: false },
  'delphibio.org': { what: 'the public project site', irreversible: false },
  'delphisci-mcp.fly.dev': { what: 'the public, unauthenticated hosted MCP server', irreversible: false },
  'forum.delphibio.org': { what: 'the public agent forum', irreversible: false },
  'discovery.indra.bio': { what: 'INDRA CoGEx (third party)', irreversible: false },
  'grounding.indra.bio': { what: 'Gilda (third party)', irreversible: false },
  'api.github.com': { what: 'GitHub', irreversible: false },
  'raw.githubusercontent.com': { what: 'GitHub raw content', irreversible: false },
};

/** Where a record is built, signed or published from. These are the paths a tenant profile constrains. */
export const PUBLISH_PATHS = [
  'darwin-origin/build', 'thompson-growth-form/build', 'wolfram-nks/build', 'math-bio-theorems',
  'lean/nanopubs', 'holdout/nanopubs', 'genotype/nanopubs', 'organism-design/nanopubs',
  'physics/nanopubs', 'swarm/nanopubs', 'claim-tests/nanopubs', 'pipeline/leanbio',
];

const CODE = /\.(mjs|js|cjs|mts|ts|py)$/i;
const SKIP = /node_modules|[\\/]\.git[\\/]|\.lake[\\/]/;

function walk(p) {
  if (!fs.existsSync(p)) return [];
  const st = fs.statSync(p);
  if (!st.isDirectory()) return [p];
  return fs.readdirSync(p).flatMap(n => walk(path.join(p, n))).filter(f => !SKIP.test(f));
}

const HOST_RE = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?/gi;

// ---------------------------------------------------------------------------------------------------
// A URL IN SOURCE IS NOT NECESSARILY EGRESS, and conflating the two makes the gate useless.
//
// The first version of this scanner reported 33 "public sinks in the publish path" and buried the two
// that matter among 31 that cannot open a socket. `http://www.w3.org/1999/02/22-rdf-syntax-ns#` is an
// IDENTIFIER: it appears in a prefix declaration, it is never dereferenced, and no byte leaves the
// machine because of it. Reporting it as an egress risk trains a reader to skim the list, which is how a
// real finding gets missed.
//
// So a host literal is classified three ways, and the two risks are reported under DIFFERENT rules:
//   fetch        the line calls something that opens a connection        -> an EGRESS risk
//   namespace    the line declares a prefix, or the host is a naming     -> a DISCLOSURE risk of a
//                authority that exists to mint identifiers                 different kind: a tenant
//                                                                           record minted in a public
//                                                                           namespace is public in its
//                                                                           own text
//   unclassified neither pattern matched                                 -> reported AS unclassified,
//                                                                           never silently assigned
// ---------------------------------------------------------------------------------------------------

/** Hosts that exist to mint identifiers. Dereferencing them is possible but is not what they are for. */
export const NAMING_AUTHORITIES = new Set([
  'www.w3.org', 'purl.org', 'purl.obolibrary.org', 'schema.org', 'spdx.org', 'creativecommons.org',
  'xmlns.com', 'orcid.org', 'doi.org', 'w3id.org', 'www.nanopub.org', 'bioregistry.io',
]);

const FETCH_CALL = /\b(fetch|axios|request|urlopen|urlretrieve|requests\.(get|post)|got|undici|http\.get|https\.get|curl|wget|publish|np\.publish|\.post|\.get)\s*\(/i;
const PREFIX_DECL = /\b(prefix|@prefix|PREFIX|xmlns|namespace|_BASE|BASE|IRI|iri)\b|['"][a-z]+['"]\s*:\s*['"]https?:/;

// A configured endpoint is egress even though its own line opens nothing. The registry map is exactly
// this shape - `const REGISTRIES = { test: "https://test.registry..." }` - and a line-only classifier
// filed BOTH nanopub registries as "unknown purpose", which is the one place a false negative is
// unaffordable. So the classifier also looks back a few lines for an endpoint-ish declaration.
// NOTE on the leading \w*: an underscore IS a word character, so `\bREGISTR` never matches inside
// `TENANT_REGISTRY` - there is no word boundary after `TENANT_`. A pattern anchored that way missed every
// constant named in the house style, which is most of them.
// `base` is deliberately absent from the lowercase alternative so that `CLAIM_BASE` and other IRI bases
// stay classified as namespaces rather than endpoints: an IRI base mints identifiers, it is not fetched.
const ENDPOINT_CONST = /\w*(REGISTR|ENDPOINT|_URL|_HOST|SERVER|_API)\w*\s*[:=]|\b(url|endpoint|host|server|registry)\s*:/i;

export function classifyHostLine(host, line, context = '') {
  const h = String(host).toLowerCase();
  // An irreversible public sink is ALWAYS treated as egress, whatever the line looks like. The cost of
  // missing one is a record that cannot be withdrawn, so the asymmetry is deliberate.
  const sink = PUBLIC_SINKS[h];
  if (sink?.irreversible) return { kind: 'fetch', why: 'the host is an irreversible public sink, so it is treated as egress regardless of how the line reads' };
  if (FETCH_CALL.test(line)) return { kind: 'fetch', why: 'the line calls something that opens a connection' };
  if (ENDPOINT_CONST.test(line) || ENDPOINT_CONST.test(context)) return { kind: 'fetch', why: 'the URL is assigned to a configured endpoint, which is dereferenced elsewhere' };
  if (PREFIX_DECL.test(line)) return { kind: 'namespace', why: 'the line declares a prefix, base or namespace' };
  if (NAMING_AUTHORITIES.has(h)) return { kind: 'namespace', why: 'the host is a naming authority whose URLs are identifiers' };
  return { kind: 'unclassified', why: 'neither a connection call, an endpoint declaration nor a prefix declaration was recognised near this line' };
}

/** Every outbound host literal in the publish/build paths, with the file and line it sits on. */
export function hostLiterals({ paths = PUBLISH_PATHS, root = ROOT } = {}) {
  const found = [];
  for (const rel of paths) {
    for (const file of walk(path.join(root, rel)).filter(f => CODE.test(f))) {
      const text = fs.readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        for (const m of line.matchAll(HOST_RE)) {
          const host = m[1].toLowerCase();
          found.push({
            host, file: path.relative(root, file).replace(/\\/g, '/'), line: i + 1,
            excerpt: line.trim().slice(0, 160),
            public_sink: PUBLIC_SINKS[host] ?? null,
            env_overridable: /process\.env\.[A-Z_]+\s*(\?\?|\|\|)/.test(line),
            ...classifyHostLine(host, line, lines.slice(Math.max(0, i - 4), i).join('\n')),
          });
        }
      });
    }
  }
  return found;
}

/** Licence assertions a tenant record would inherit. CC BY is an irrevocable grant to redistribute. */
export function licenceAssertions({ root = ROOT, paths = PUBLISH_PATHS } = {}) {
  const found = [];
  for (const rel of paths) {
    for (const file of walk(path.join(root, rel)).filter(f => CODE.test(f))) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!/creativecommons\.org|dct:license|dcterms:license/i.test(line)) return;
        const open = /creativecommons\.org\/(licenses\/(by|by-sa|by-nc)[^"'\s>]*|publicdomain)/i.exec(line);
        found.push({
          file: path.relative(root, file).replace(/\\/g, '/'), line: i + 1,
          excerpt: line.trim().slice(0, 160),
          grants_redistribution: Boolean(open),
          licence: open ? open[1] : null,
        });
      });
    }
  }
  return found;
}

/** The deployment surface: what the hosted image and the CI would ship. */
export function deploymentSurface({ root = ROOT } = {}) {
  const out = { dockerignore_nanopub_globs: [], ci_deploy_on_nanopub_change: [], dashboard_has_auth: null };
  const di = path.join(root, '.dockerignore');
  if (fs.existsSync(di)) {
    fs.readFileSync(di, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (/^!.*nanopubs.*\*/.test(line.trim())) out.dockerignore_nanopub_globs.push({ line: i + 1, pattern: line.trim() });
    });
  }
  const wf = path.join(root, '.github/workflows');
  if (fs.existsSync(wf)) {
    for (const f of fs.readdirSync(wf)) {
      const text = fs.readFileSync(path.join(wf, f), 'utf8');
      if (/nanopubs/.test(text) && /\bdeploy\b/i.test(text)) out.ci_deploy_on_nanopub_change.push(f);
    }
  }
  const wr = path.join(root, 'dashboard/wrangler.jsonc');
  if (fs.existsSync(wr)) {
    const text = fs.readFileSync(wr, 'utf8');
    out.dashboard_has_auth = /"main"\s*:/.test(text);
    out.dashboard_wrangler_bytes = fs.statSync(wr).size;
  }
  return out;
}

/** A tenant profile: the only hosts a tenant's records may reach, and what its records must assert. */
export function tenantProfile({ name, allowed_hosts = [], licence = null, iri_base = null } = {}) {
  if (!name) throw new Error('a tenant profile needs a name: an unnamed profile cannot be audited');
  return {
    name,
    allowed_hosts: allowed_hosts.map(h => h.toLowerCase()),
    licence,
    iri_base,
    deny_by_default: true,
    note: 'allowed_hosts is an allowlist and the empty list means NOTHING is reachable. A profile with no hosts is the correct default for a tenant that signs but does not publish.',
  };
}

/** The static scan. Returns findings, never throws. */
export function scan({ root = ROOT, profile = null, paths = PUBLISH_PATHS } = {}) {
  const hosts = hostLiterals({ root, paths });
  const licences = licenceAssertions({ root, paths });
  const surface = deploymentSurface({ root });
  const allow = new Set(profile?.allowed_hosts ?? []);

  const findings = [];
  // 1. a public sink reachable from a publish path
  const byHost = new Map();
  for (const h of hosts) {
    if (!byHost.has(h.host)) byHost.set(h.host, []);
    byHost.get(h.host).push(h);
  }
  for (const [host, sites] of byHost) {
    if (allow.has(host)) continue;
    const sink = PUBLIC_SINKS[host];
    const kinds = new Set(sites.map(s => s.kind));
    // a host is an EGRESS risk only where the line actually opens a connection
    const fetchSites = sites.filter(s => s.kind === 'fetch');
    const unclassified = sites.filter(s => s.kind === 'unclassified');
    if (fetchSites.length) {
      findings.push({
        severity: sink?.irreversible ? 'blocking' : 'high',
        rule: 'egress-to-a-host-not-on-the-tenant-allowlist',
        host,
        what: sink?.what ?? 'a host not on the tenant allowlist',
        irreversible: Boolean(sink?.irreversible),
        note: sink?.note ?? null,
        sites: fetchSites.map(s => `${s.file}:${s.line}`),
        any_env_overridable: fetchSites.some(s => s.env_overridable),
        why_it_matters: sink?.irreversible
          ? 'a record that reaches this host cannot be withdrawn. This is the finding the gate exists for.'
          : 'a connection is opened to it from a path that handles records. Even a read discloses the shape of the question.',
      });
    }
    if (kinds.has('namespace') && NAMING_AUTHORITIES.has(host) === false && !sink) continue;
    if (kinds.has('namespace')) {
      const nsSites = sites.filter(s => s.kind === 'namespace');
      findings.push({
        severity: 'high',
        rule: 'public-namespace-minted-into-records',
        host,
        what: sink?.what ?? 'a public naming authority',
        sites: nsSites.slice(0, 6).map(s => `${s.file}:${s.line}`),
        n_sites: nsSites.length,
        opens_a_connection: false,
        why_it_matters:
          'this is NOT an egress risk - a prefix declaration opens no socket. It is a disclosure risk of ' +
          'a different kind: a tenant record minted under a public namespace carries that namespace in ' +
          'its own text, so the record is publicly named wherever it is stored. A tenant needs its own ' +
          'collision-free namespace, which is a decision rather than a refactor.',
      });
    }
    if (unclassified.length) {
      findings.push({
        severity: 'review',
        rule: 'host-literal-of-unknown-purpose',
        host,
        sites: unclassified.slice(0, 6).map(s => `${s.file}:${s.line}`),
        n_sites: unclassified.length,
        why_it_matters:
          'the scanner could not tell from the line whether this URL is dereferenced or is an identifier. ' +
          'It is reported rather than assigned, because guessing in either direction would make the other ' +
          'two lists wrong.',
      });
    }
  }
  // 2. a licence that grants redistribution
  const granting = licences.filter(l => l.grants_redistribution);
  if (granting.length) {
    findings.push({
      severity: 'blocking',
      rule: 'record-asserts-an-open-licence',
      count: granting.length,
      licences: [...new Set(granting.map(l => l.licence))],
      sites: granting.map(l => `${l.file}:${l.line}`),
      why_it_matters:
        'a record that asserts CC BY in its own pubinfo has granted redistribution irrevocably. Hosting ' +
        'it privately does not retract the grant, so a "private" record with an open licence is private ' +
        'only by accident of where it is stored.',
      what_a_tenant_needs: profile?.licence
        ? `assert ${profile.licence} instead, and make the builder refuse to emit an open licence for this tenant.`
        : 'a tenant licence has not been chosen. Until it is, no tenant record should be built at all.',
    });
  }
  // 3. the blanket globs that ship any new draft directory
  if (surface.dockerignore_nanopub_globs.length) {
    findings.push({
      severity: 'high',
      rule: 'dockerignore-admits-nanopubs-by-wildcard',
      patterns: surface.dockerignore_nanopub_globs,
      why_it_matters:
        '.dockerignore is an explicit allowlist for every other path. These globs mean ANY new ' +
        '*/nanopubs/unsigned directory is shipped to the public hosted server by default, with nobody ' +
        'editing a list. A tenant corpus added under that shape would deploy itself.',
    });
  }
  // 4. CI that deploys on a record change
  if (surface.ci_deploy_on_nanopub_change.length) {
    findings.push({
      severity: 'high',
      rule: 'ci-deploys-on-nanopub-change',
      workflows: surface.ci_deploy_on_nanopub_change,
      why_it_matters: 'merging a tenant record would trigger a public deployment. A tenant corpus must never be a deploy trigger.',
    });
  }
  // 5. the dashboard
  if (surface.dashboard_has_auth === false) {
    findings.push({
      severity: 'high',
      rule: 'dashboard-serves-static-assets-with-no-entrypoint',
      note: `dashboard/wrangler.jsonc is ${surface.dashboard_wrangler_bytes} bytes and declares no "main", so there is no code path that could authenticate a request.`,
      why_it_matters: 'authenticating the query server while the dashboard serves the same data openly protects nothing.',
    });
  }

  const blocking = findings.filter(f => f.severity === 'blocking');
  return {
    what_this_is: WHAT_THIS_IS,
    profile,
    scanned: { paths, files_with_a_host_literal: new Set(hosts.map(h => h.file)).size, host_literals: hosts.length, distinct_hosts: byHost.size },
    hosts: [...byHost.keys()].sort(),
    findings,
    blocking_count: blocking.length,
    passes: blocking.length === 0,
    this_is_only_the_static_half:
      'A clean result here means no public host, open licence, wildcard glob or deploy trigger was found ' +
      'in the scanned paths. It does NOT mean no record can leave: a host built at runtime, a dependency ' +
      'opening its own socket, or a path not scanned would all pass this. Run the runtime guard.',
  };
}
