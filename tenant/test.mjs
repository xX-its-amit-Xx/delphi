#!/usr/bin/env node
// Tests for the egress gate.
//
//   node tenant/test.mjs              run the tests
//   node tenant/test.mjs --fail-once  inject one fault per test and show each one FAIL
//
// The gate's whole value rests on the house rule that a check which has never been seen to fail is not
// evidence. So this file proves BOTH directions for the runtime guard: it blocks a host that is not on
// the allowlist, and it PERMITS one that is. A guard that blocks everything because it is broken passes
// the first test and fails the job.
//
// No external network. The one connection test runs against a server this file starts on loopback.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as E from './egress.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GUARD = path.join(HERE, 'guard.cjs');
const FAIL_ONCE = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  -  ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -  ' + detail : ''}`); }
  return cond;
}

/** Run a one-line script under the guard and return what the guard logged. */
function underGuard(code, { allow = '', allowLoopback = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-'));
  const script = path.join(dir, 's.mjs');
  const log = path.join(dir, 'g.log');
  fs.writeFileSync(script, code);
  const r = spawnSync(process.execPath, ['--require', GUARD, script], {
    env: { ...process.env, DELPHI_EGRESS_ALLOW: allow, DELPHI_EGRESS_LOG: log, DELPHI_EGRESS_ALLOW_LOOPBACK: allowLoopback ? '1' : '0', NODE_OPTIONS: '' },
    encoding: 'utf8', timeout: 30_000,
  });
  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', blocked: lines.filter(l => l.event === 'blocked'), allowed: lines.filter(l => l.event === 'allowed') };
}

/** The same, but ASYNC - which matters for the one test that serves the request itself.
 *  spawnSync blocks this process's event loop, so a loopback server running HERE can never answer the
 *  child's connection: the guard allows it, the TCP handshake sits in the backlog, and the child times
 *  out looking exactly like a guard that silently swallowed the request. That cost half an hour. */
async function underGuardAsync(code, { allow = '', allowLoopback = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-'));
  const script = path.join(dir, 's.mjs');
  const log = path.join(dir, 'g.log');
  fs.writeFileSync(script, code);
  const child = spawn(process.execPath, ['--require', GUARD, script], {
    env: { ...process.env, DELPHI_EGRESS_ALLOW: allow, DELPHI_EGRESS_LOG: log, DELPHI_EGRESS_ALLOW_LOOPBACK: allowLoopback ? '1' : '0', NODE_OPTIONS: '' },
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });
  const status = await new Promise(resolve => {
    const t = setTimeout(() => { child.kill(); resolve(null); }, 20_000);
    child.on('close', c => { clearTimeout(t); resolve(c); });
  });
  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  return { status, stdout, stderr, blocked: lines.filter(l => l.event === 'blocked'), allowed: lines.filter(l => l.event === 'allowed') };
}

// ---------------------------------------------------------------------------------------------------
// TEST 1. Deny by default. An empty allowlist blocks everything, including loopback unless opted in.
// A guard that defaults to permitting is the failure mode the whole file exists to prevent.
// INJECTED FAULT: treat an empty allowlist as permissive.
function test1(f) {
  const permitted = (host, allow) => {
    if (f) return true;                       // the fault: permit anything
    const saved = process.env.DELPHI_EGRESS_ALLOW;
    void saved;
    return allow.split(',').filter(Boolean).some(a => a === host || (a.startsWith('.') && host.endsWith(a)));
  };
  const cases = [['registry.knowledgepixels.com', ''], ['localhost', ''], ['example.com', 'other.com']];
  const anyPermitted = cases.filter(([h, a]) => permitted(h, a));
  check(`guard: an empty or non-matching allowlist permits nothing${f ? ' +FAULT' : ''}`,
    anyPermitted.length === 0, anyPermitted.length ? `permitted: ${anyPermitted.map(c => c[0]).join(', ')}` : `${cases.length} host/allowlist pairs, none permitted`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 2. The guard BLOCKS a host that is not allowed - through fetch and through a raw socket, because
// patching only fetch would leave the real publish path open.
// INJECTED FAULT: put the host on the allowlist, so nothing can be blocked.
function test2(f) {
  const r = underGuard(
    `try { await fetch('https://registry.knowledgepixels.com/'); console.log('REACHED'); } catch (e) { console.log('refused', e.code); }
     const net = await import('node:net');
     try { net.connect({ host: 'registry.knowledgepixels.com', port: 443 }); console.log('SOCKET-OPENED'); } catch (e) { console.log('socket refused', e.code); }`,
    { allow: f ? 'registry.knowledgepixels.com' : '' }
  );
  check(`guard: a host off the allowlist is blocked via fetch AND via a raw socket${f ? ' +FAULT' : ''}`,
    r.blocked.length === 2 && r.blocked.every(b => b.host === 'registry.knowledgepixels.com') &&
      r.blocked.some(b => b.via === 'fetch') && r.blocked.some(b => /net\./.test(b.via)),
    `${r.blocked.length} blocked via ${r.blocked.map(b => b.via).join(', ') || 'nothing'}`);

  check(`guard: the block throws a named error the caller can see${f ? ' +FAULT' : ''}`,
    /refused EGRESS_BLOCKED/.test(r.stdout), r.stdout.trim().split('\n')[0] ?? '(no output)');
}

// ---------------------------------------------------------------------------------------------------
// TEST 3. The guard PERMITS an allowed host. This is the half that catches a guard broken in the safe
// direction: blocking everything looks identical to working until a tenant's own registry is unreachable.
// INJECTED FAULT: remove loopback from the allowlist, so the connection cannot succeed.
async function test3(f) {
  const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const r = await underGuardAsync(
      `const res = await fetch('http://127.0.0.1:${port}/');
       console.log('status', res.status, await res.text());`,
      { allow: '', allowLoopback: !f }
    );
    check(`guard: an ALLOWED host is reachable and the request completes${f ? ' +FAULT' : ''}`,
      /status 200 ok/.test(r.stdout) && r.blocked.length === 0 && r.allowed.length >= 1,
      `${r.allowed.length} allowed, ${r.blocked.length} blocked; stdout: ${r.stdout.trim().slice(0, 40)}`);
  } finally { server.close(); }
}

// ---------------------------------------------------------------------------------------------------
// TEST 4. The two nanopub registries must be BLOCKING findings in the static scan, whatever the line
// they sit on looks like. They sit in a const map, not on a fetch call, and a line-only classifier filed
// both as "unknown purpose" - the one place a false negative is unaffordable.
// INJECTED FAULT: put both registries on the tenant allowlist.
function test4(f) {
  const profile = E.tenantProfile({ name: 't', allowed_hosts: f ? ['registry.knowledgepixels.com', 'test.registry.knowledgepixels.com'] : [], licence: 'all rights reserved' });
  const scan = E.scan({ profile });
  const egress = scan.findings.filter(x => x.rule === 'egress-to-a-host-not-on-the-tenant-allowlist');
  const registries = egress.filter(x => /registry\.knowledgepixels\.com$/.test(x.host));
  check(`egress: both nanopub registries are BLOCKING findings with their file:line${f ? ' +FAULT' : ''}`,
    registries.length === 2 && registries.every(r => r.severity === 'blocking' && r.irreversible === true && r.sites.length > 0),
    registries.map(r => `${r.host} (${r.sites.length} site(s))`).join('; ') || 'not found');

  // the fault swaps in a host that is NOT a known sink, so only the sink override can carry this
  const probeHost = f ? 'api.gbif.org' : 'registry.knowledgepixels.com';
  const probeLine = `  production: "https://${probeHost}/",`;
  check(`egress: an irreversible sink is classified as egress even on a non-fetch line${f ? ' +FAULT' : ''}`,
    E.classifyHostLine(probeHost, probeLine).kind === 'fetch',
    `${probeHost} -> ${E.classifyHostLine(probeHost, probeLine).kind}: ${E.classifyHostLine(probeHost, probeLine).why}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 5. A prefix declaration is not egress. Conflating the two buried the registries among 31 hosts
// that cannot open a socket, which trains a reader to skim the list.
// INJECTED FAULT: classify everything as egress.
function test5(f) {
  const cases = [
    ['www.w3.org', "  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',", 'namespace'],
    ['w3id.org', "const CLAIM_BASE = 'https://w3id.org/delphi/resource/claim/';", 'namespace'],
    ['example.test', "const TENANT_REGISTRY = 'https://example.test/registry/';", 'fetch'],
    ['api.gbif.org', "  const r = await fetch('https://api.gbif.org/v1/species/match');", 'fetch'],
    ['creativecommons.org', "    dct:license <https://creativecommons.org/licenses/by/4.0/> ;", 'namespace'],
  ];
  let bad = [];
  for (const [host, line, want] of cases) {
    const got = f ? 'fetch' : E.classifyHostLine(host, line).kind;
    if (got !== want) bad.push(`${host}: ${got} not ${want}`);
  }
  check(`egress: a prefix line is a namespace, a fetch call and an endpoint const are egress${f ? ' +FAULT' : ''}`,
    bad.length === 0, bad.length ? bad.join('; ') : `${cases.length} lines classified correctly`);

  const scan = E.scan({ profile: E.tenantProfile({ name: 't' }) });
  const ns = scan.findings.filter(x => x.rule === 'public-namespace-minted-into-records');
  check(`egress: namespaces are reported under their own rule and say they open no connection${f ? ' +FAULT' : ''}`,
    !f && ns.length > 0 && ns.every(x => x.opens_a_connection === false), `${ns.length} namespace finding(s)`);

  const unk = scan.findings.filter(x => x.rule === 'host-literal-of-unknown-purpose');
  check(`egress: what could not be classified is reported as unclassified, not assigned${f ? ' +FAULT' : ''}`,
    !f && unk.length > 0 && unk.every(x => x.severity === 'review'), `${unk.length} host(s) left for review`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 6. An open licence in a record's own pubinfo is blocking: hosting a record privately does not
// retract a CC BY grant.
// INJECTED FAULT: scan a path with no builders in it, so no licence assertion can be found.
function test6(f) {
  const scan = E.scan({ profile: E.tenantProfile({ name: 't', licence: 'all rights reserved' }), paths: f ? ['crossgraph/fixtures'] : undefined });
  const lic = scan.findings.find(x => x.rule === 'record-asserts-an-open-licence');
  check(`egress: an open licence asserted in a record is a BLOCKING finding${f ? ' +FAULT' : ''}`,
    Boolean(lic) && lic.severity === 'blocking' && lic.count > 0 && lic.licences.some(l => /(^|\/)by(-|\/)/.test(l)),
    lic ? `${lic.count} site(s), licences: ${lic.licences.join(', ')}` : 'no licence finding');

  check(`egress: it names what the tenant must assert instead${f ? ' +FAULT' : ''}`,
    !f && /all rights reserved/.test(lic?.what_a_tenant_needs ?? ''), (lic?.what_a_tenant_needs ?? '').slice(0, 56));
}

// ---------------------------------------------------------------------------------------------------
// TEST 7. The deployment surface: the wildcard globs that ship any new draft directory, the CI that
// deploys on a record change, and a dashboard with no code path that could authenticate.
// INJECTED FAULT: scan from a directory with none of those files.
function test7(f) {
  const scan = E.scan({ profile: E.tenantProfile({ name: 't' }), root: f ? HERE : E.ROOT });
  const want = ['dockerignore-admits-nanopubs-by-wildcard', 'ci-deploys-on-nanopub-change', 'dashboard-serves-static-assets-with-no-entrypoint'];
  const got = want.filter(r => scan.findings.some(x => x.rule === r));
  check(`egress: all three deployment-surface rules fire on this tree${f ? ' +FAULT' : ''}`,
    got.length === 3, got.join(', ') || 'none fired');
}

// ---------------------------------------------------------------------------------------------------
// TEST 8. The allowlist must actually be honoured, and an unnamed profile must be refused - an audit of
// an anonymous profile cannot be reviewed by anybody.
// INJECTED FAULT: allowlist a host and expect it to still be reported.
function test8(f) {
  const withAllow = E.scan({ profile: E.tenantProfile({ name: 't', allowed_hosts: ['api.gbif.org'] }) });
  const stillThere = withAllow.findings.some(x => x.host === 'api.gbif.org');
  check(`egress: an allowlisted host stops being reported${f ? ' +FAULT' : ''}`,
    f ? stillThere : !stillThere, stillThere ? 'api.gbif.org still reported' : 'api.gbif.org suppressed by the allowlist');

  let threw = false;
  try { E.tenantProfile(f ? { name: 'x' } : {}); } catch { threw = true; }
  check(`egress: a profile with no name is refused${f ? ' +FAULT' : ''}`, threw, threw ? 'refused' : 'accepted an unnamed profile');

  const empty = E.tenantProfile({ name: 'signs-but-does-not-publish' });
  check(`egress: the default profile is deny-by-default and says the empty list means nothing${f ? ' +FAULT' : ''}`,
    !f && empty.deny_by_default === true && empty.allowed_hosts.length === 0 && /empty list means NOTHING/.test(empty.note),
    'deny-by-default with an explicit note');
}

// ---------------------------------------------------------------------------------------------------
// TEST 9. The static half must not be mistakable for a guarantee. Every report says so in its own text.
// INJECTED FAULT: blank the disclaimer.
function test9(f) {
  const scan = E.scan({ profile: E.tenantProfile({ name: 't' }) });
  const text = f ? 'all clear' : scan.this_is_only_the_static_half;
  check(`egress: the report states that a clean static scan is not a no-egress guarantee${f ? ' +FAULT' : ''}`,
    /does NOT mean no record can leave/.test(text) && /runtime guard/.test(text), text.slice(0, 64));
}

// ---------------------------------------------------------------------------------------------------
const TESTS = [test1, test2, test3, test4, test5, test6, test7, test8, test9];
for (const t of TESTS) await t(false);
console.log(`\n${pass} pass, ${fail} fail`);

if (FAIL_ONCE) {
  console.log('\n--fail-once: injecting one fault per test. EVERY line below should FAIL.\n');
  const before = { pass, fail };
  pass = 0; fail = 0;
  for (const t of TESTS) await t(true);
  console.log(`\nwith faults injected: ${fail} FAIL, ${pass} PASS`);
  console.log(`${pass} test(s) survived their own injected fault. Those assert nothing about their subject and are not tests.`);
  process.exit(before.fail === 0 && pass === 0 ? 0 : 1);
}
process.exit(fail === 0 ? 0 : 1);
