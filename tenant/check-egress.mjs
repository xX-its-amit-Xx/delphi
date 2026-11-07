#!/usr/bin/env node
// THE EGRESS GATE. Two halves, reported separately, because neither is sufficient.
//
//   node tenant/check-egress.mjs                      static scan against the default (empty) profile
//   node tenant/check-egress.mjs --profile FILE.json  static scan against a tenant profile
//   node tenant/check-egress.mjs --json
//   node tenant/check-egress.mjs --dry-run SCRIPT [-- args...]
//        run SCRIPT under the runtime guard and report every host it tried to reach
//
// Exit 1 if anything blocking is found, 0 otherwise - so it can be a CI step next to
// `node pipeline/leanbio/check.mjs`, which is where issue #6 asks for it.
//
// THE HOUSE RULE THIS OBEYS: a check that has never been seen to fail is not evidence. Run
// `node tenant/test.mjs --fail-once` to watch every assertion here fail on a planted violation, and
// `--dry-run tenant/fixtures/tries-to-publish.mjs` to watch the runtime half catch a real attempt.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as E from './egress.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const has = n => argv.includes(`--${n}`);
const val = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };

const profile = val('profile')
  ? E.tenantProfile(JSON.parse(fs.readFileSync(val('profile'), 'utf8')))
  : E.tenantProfile({
      name: 'default-deny (no profile given)',
      allowed_hosts: [],
      licence: null,
      iri_base: null,
    });

// ---------------------------------------------------------------------------------------------------
// the runtime half
// ---------------------------------------------------------------------------------------------------
if (has('dry-run')) {
  const script = val('dry-run');
  if (!script) { console.error('--dry-run needs a script path'); process.exit(2); }
  const rest = argv.slice(argv.indexOf('--dry-run') + 2).filter(a => a !== '--');
  const log = path.join(process.env.TEMP || process.env.TMPDIR || '.', `egress-${process.pid}.log`);
  try { fs.rmSync(log, { force: true }); } catch {}
  const guard = path.join(HERE, 'guard.cjs');

  console.log(`running ${script} under the egress guard`);
  console.log(`  allowed hosts : ${profile.allowed_hosts.length ? profile.allowed_hosts.join(', ') : '(none - deny by default)'}`);
  console.log(`  log           : ${log}\n`);

  const r = spawnSync(process.execPath, ['--require', guard, script, ...rest], {
    env: { ...process.env, DELPHI_EGRESS_ALLOW: profile.allowed_hosts.join(','), DELPHI_EGRESS_LOG: log },
    encoding: 'utf8', timeout: 120_000,
  });

  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  const blocked = lines.filter(l => l.event === 'blocked');
  const allowed = lines.filter(l => l.event === 'allowed');

  console.log(`script exit code : ${r.status}${r.error ? ` (${r.error.message})` : ''}`);
  if (r.stdout?.trim()) console.log(`stdout           : ${r.stdout.trim().split('\n').slice(0, 6).join('\n                   ')}`);
  if (r.stderr?.trim()) console.log(`stderr           : ${r.stderr.trim().split('\n').slice(0, 6).join('\n                   ')}`);
  console.log(`\nconnection attempts: ${lines.length - 1} (${allowed.length} allowed, ${blocked.length} BLOCKED)`);
  for (const b of blocked) console.log(`  BLOCKED  ${b.host}${b.port ? ':' + b.port : ''}  via ${b.via}`);
  for (const a of allowed) console.log(`  allowed  ${a.host}${a.port ? ':' + a.port : ''}  via ${a.via}`);

  console.log(
    blocked.length
      ? `\nThe guard stopped ${blocked.length} attempt(s). That is the gate working, not a failure.`
      : '\nNo connection was attempted or blocked. A script that never reaches the network proves nothing about the guard - check that it actually ran (exit code and stdout above).'
  );
  process.exit(blocked.length ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------------
// the static half
// ---------------------------------------------------------------------------------------------------
const scan = E.scan({ profile });

if (has('json')) { console.log(JSON.stringify(scan, null, 1)); process.exit(scan.passes ? 0 : 1); }

const bar = '='.repeat(100);
console.log(`\n${bar}\n EGRESS GATE (static half) - tenant profile: ${profile.name}\n${bar}\n`);
console.log(scan.what_this_is);
console.log(`\nscanned ${scan.scanned.paths.length} publish/build paths: ${scan.scanned.host_literals} URL literal(s) in ${scan.scanned.files_with_a_host_literal} file(s), ${scan.scanned.distinct_hosts} distinct host(s).\n`);

const order = { blocking: 0, high: 1, review: 2 };
for (const f of [...scan.findings].sort((a, b) => order[a.severity] - order[b.severity])) {
  console.log(`[${f.severity.toUpperCase()}] ${f.rule}${f.host ? `  ${f.host}` : ''}${f.count ? `  (${f.count})` : ''}`);
  if (f.what) console.log(`    ${f.what}${f.irreversible ? '   *** IRREVERSIBLE ***' : ''}`);
  if (f.note) console.log(`    ${f.note}`);
  console.log(`    ${f.why_it_matters}`);
  if (f.what_a_tenant_needs) console.log(`    TENANT: ${f.what_a_tenant_needs}`);
  if (f.sites?.length) console.log(`    at: ${f.sites.slice(0, 4).join('  ')}${f.n_sites > 4 ? `  (+${f.n_sites - 4} more)` : ''}`);
  if (f.patterns) for (const p of f.patterns) console.log(`    .dockerignore:${p.line}  ${p.pattern}`);
  if (f.workflows) console.log(`    workflows: ${f.workflows.join(', ')}`);
  console.log();
}

console.log(`${scan.blocking_count} blocking finding(s).`);
console.log(`\n${scan.this_is_only_the_static_half}\n`);
console.log(`${bar}\n Run the runtime half too:\n   node tenant/check-egress.mjs --dry-run tenant/fixtures/tries-to-publish.mjs\n${bar}\n`);
process.exit(scan.passes ? 0 : 1);
