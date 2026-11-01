#!/usr/bin/env node
// check-exposed: every Lean law must be reachable through every surface, from the same loader.
//
//   node lean/registry/check-exposed.mjs          human-readable; exit 1 on any failure
//   node lean/registry/check-exposed.mjs --json   machine-readable report
//   node lean/registry/check-exposed.mjs --fast   skip the two subprocess checks (MCP stdio round-trip, CLI spawn)
//
// Owned by the Lean-API work (not by the registry agent). Node only: no Lean toolchain is needed, so CI can run it
// on every PR; whether the Lean compiles is the separate `lake build` check.
//
// What counts as a law (the INVENTORY): every entry of lean/laws.json, every constraint in lean/constraints.json,
// every entry of lean/empirical.json, every file in lean/registry/laws/, every law_id a lawset names, every Lean
// module under lean/Delphi/ (Certificates/ excluded) that is not listed in INFRASTRUCTURE below, every Lean
// declaration whose name ends in `_rules_out` (the form an eliminating constraint lemma takes), and every Lean
// comment tag `@law <law_id>` (the way to mark a new theorem as a law before the registry entry exists).
//
// FAILS when any of these is not:
//   (a) a law in the registry with a law_id (constraints and modules: backed by one; theorems named by a law or
//       constraint: present in the Lean source)
//   (b) returned by lean_laws_list via the handler (sim-engine/tools/lean-tools.mjs), and by lean_law_get
//   (c) in the static mirror dashboard/public/api/lean/ (index.json + laws/<law_id>.json)
//   (d) reachable via the CLI (sim-engine/lean-cli.mjs `law <id>`, and mcp/cli.mjs `laws`)
//   (e) returned by the hosted server's tools (mcp/server.mjs over stdio: lean_laws_list), and by the sim-engine HTTP
//       bridge's tool discovery
//   (f) self-update: every lean_* envelope carries source, lawset_version and fetched_at; lean_changes covers every
//       lawset; .github/workflows/leanbio-publish.yml republishes the mirror and deploy-mcp.yml's path filters
//       cover the law sources (lean/registry/SELF-UPDATE.md)
// and when the static mirror or sim-engine/contract.json is stale relative to the sources (content comparison), or a
// registered theorem's statement no longer matches its pinned lean_ref.statement_sha256 (drift).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const R = (...p) => path.join(ROOT, ...p);
const imp = rel => import(pathToFileURL(R(rel)).href);
const JSON_OUT = process.argv.includes('--json');
const FAST = process.argv.includes('--fast');

// Lean modules that hold no law of their own. Each needs a reason; adding a module here is a reviewed decision.
const INFRASTRUCTURE = {
  'lean/Delphi/Audit.lean': 'prints axioms of other modules\' theorems; declares nothing',
  'lean/Delphi/Constraints.lean': 'eliminating lemmas (`*_rules_out`) for laws declared elsewhere; each lemma is checked below as a constraint',
};
// `*_rules_out` declarations that are deliberately not a constraint of their own. Each needs a reason.
const RULES_OUT_EXEMPT = {
  'Delphi.Constraints.cubeLaw_rules_out': 'unprimed form of cubeLaw_rules_out\' (constraint C7 uses the primed form); same law thompson1917-ch03-07',
  "Delphi.Constraints.supply_rules_out'": 'variant of supply_rules_out (constraint C3b); same law favored-fixation-lower-bound',
};

// This check is about the local tree: never let a configured remote law source (LEANBIO_REMOTE) stand in for it.
process.env.LEANBIO_REMOTE = 'off';

const failures = [];
const notes = [];
const fail = (check, item, msg, fix) => failures.push({ check, item, msg, fix });

const src = await imp('lib/lean-source.mjs');
const reg = src.load({ fresh: true });
const ids = new Set(reg.laws.map(l => l.law_id));
const readJson = rel => JSON.parse(fs.readFileSync(R(rel), 'utf8'));
const has = rel => fs.existsSync(R(rel));
const REGFIX = reg.origin === 'registry'
  ? 'add lean/registry/laws/<law_id>.json (node lean/registry/propose.mjs <file.lean> --meta meta.json --write), then node dashboard/build-lean-api.mjs'
  : 'add the law to lean/laws.json (lean/laws/build-laws.mjs) or create lean/registry/, then node dashboard/build-lean-api.mjs';

// ── (a) inventory -> registry ────────────────────────────────────────────────
const lawsJson = has('lean/laws.json') ? readJson('lean/laws.json').laws : [];
for (const l of lawsJson) if (!ids.has(l.id)) fail('a:registry', l.id, `lean/laws.json entry "${l.id}" has no registry law_id`, REGFIX);
const empirical = has('lean/empirical.json') ? readJson('lean/empirical.json').entries || [] : [];
for (const e of empirical) if (!ids.has(e.id)) fail('a:registry', e.id, `lean/empirical.json entry "${e.id}" has no registry law_id`, REGFIX);
const cidx = src.constraintIndex();
for (const c of reg.constraints) {
  if (!cidx[c.id]) fail('a:registry', c.id, `constraint ${c.id} (lean/constraints.json, lemma ${c.lemma}) is backed by no registry law`, `list "${c.id}" in the constraints of its law (lean/registry/laws/<law_id>.json)`);
  for (const n of [c.lemma, c.law]) if (n && !src.findDecl(n, c.module)) fail('a:lean', `${c.id}:${n}`, `constraint ${c.id} names ${n}, which is not declared in any Lean module`, 'fix the name in lean/constraints.json or restore the declaration');
}
for (const ls of reg.lawsets) for (const x of ls.laws) {
  if (!ids.has(x.law_id)) fail('a:registry', x.law_id, `lawset ${ls.version} names "${x.law_id}", which has no law file`, 'restore the law file (laws are retired, never deleted)');
  else if (x.version && !src.lawVersion(x.law_id, x.version)) fail('a:registry', `${x.law_id}@${x.version}`, `lawset ${ls.version} pins ${x.law_id}@${x.version}, which is neither the current law file nor an archived snapshot`, `archive it as lean/registry/law-versions/${x.law_id}@${x.version}.json`);
}
// Archived versions (law-versions/<id>@<v>.json) keep older lawsets reproducible: their theorems must still exist,
// and they count as backing for the lemmas they name (a superseded lemma is not dead code).
const archived = Object.values(reg.versions || {});
for (const v of archived) {
  if (v.lean_ref?.theorem && !src.findDecl(v.lean_ref.theorem, v.lean_ref.module)) fail('a:lean', `${v.law_id}@${v.version}`, `archived ${v.law_id}@${v.version} names ${v.lean_ref.theorem}, no longer in the Lean sources; older lawsets pinning it cannot reproduce`, 'restore the theorem (keep superseded lemmas compiled)');
}
for (const l of reg.laws) {
  const ref = l.lean_ref;
  if (ref?.theorem && !src.findDecl(ref.theorem, ref.module)) fail('a:lean', l.law_id, `law ${l.law_id} names theorem ${ref.theorem}, not found in the Lean sources`, 'fix lean_ref.theorem or restore the theorem');
  if (ref?.module && !has(ref.module)) fail('a:lean', l.law_id, `law ${l.law_id} points at missing module ${ref.module}`, 'fix lean_ref.module');
}
// Pinned statements: a registered theorem whose statement changed without a new law version is drift.
for (const d of src.verify().drift) fail('drift', d.law_id, `law ${d.law_id}: ${d.status} (${d.decl || d.module})`, d.status === 'drift' ? 'the Lean statement changed: bump the law version and re-pin lean_ref.statement_sha256 (lean/registry), or revert the Lean edit' : 'fix lean_ref in the law file');
const covered = new Set([...reg.laws, ...archived].map(l => l.lean_ref?.module).filter(Boolean));
const allModules = src.leanModules({ includeCertificates: false });
for (const m of allModules) {
  if (INFRASTRUCTURE[m]) continue;
  if (!covered.has(m)) fail('a:lean', m, `Lean module ${m} backs no registry law`, `register its law(s) (${REGFIX.split(',')[0]}), or, if it truly holds no law, add it to INFRASTRUCTURE in lean/registry/check-exposed.mjs with a reason`);
}
const constraintLemmas = new Set([...reg.constraints.map(c => c.lemma), ...archived.map(v => v.lean_ref?.theorem).filter(Boolean)]);
const tags = [];
for (const m of src.leanModules({ includeCertificates: true })) {
  const text = fs.readFileSync(R(m), 'utf8');
  for (const t of text.matchAll(/@law\s+([A-Za-z0-9_.-]+)/g)) tags.push({ module: m, id: t[1] });
  if (m.includes('/Certificates/')) continue;
  for (const d of src.declarations(m)) {
    if (!/_rules_out'?$/.test(d.short) || !['theorem', 'lemma'].includes(d.keyword)) continue;
    if (constraintLemmas.has(d.name) || RULES_OUT_EXEMPT[d.name]) continue;
    fail('a:lean', d.name, `${d.name} (${m}:${d.line}) is an eliminating lemma that no constraint or law uses`, 'add a constraint for it in lean/constraints.json mapped to a registry law, or add it to RULES_OUT_EXEMPT with a reason');
  }
}
for (const t of tags) if (!ids.has(t.id)) fail('a:registry', t.id, `${t.module} tags "@law ${t.id}" but the registry has no such law_id`, REGFIX);

// ── (b) handlers ─────────────────────────────────────────────────────────────
const tools = await imp('sim-engine/tools/lean-tools.mjs');
const T = Object.fromEntries(tools.LEAN_TOOLS.map(t => [t.name, t]));
const listed = new Set((await T.lean_laws_list.handler({})).result.laws.map(l => l.law_id));
for (const id of ids) {
  if (!listed.has(id)) fail('b:handler', id, `lean_laws_list does not return ${id}`, 'lib/lean-source.mjs listLaws must return every law');
  try { const g = await T.lean_law_get.handler({ id }); if (g.result.law_id !== id) throw new Error('wrong law'); }
  catch (e) { fail('b:handler', id, `lean_law_get(${id}) failed: ${e.message}`, 'see lib/lean-source.mjs getLaw'); }
}
try { await T.lean_lawset_get.handler({ version: 'current' }); } catch (e) { fail('b:handler', 'lean_lawset_get', e.message, 'lean/registry/lawsets/current.json'); }
// Self-update: every lean_* envelope says where its laws came from (source, lawset_version, fetched_at), and the
// status and changes tools answer.
for (const t of tools.LEAN_TOOLS.filter(t => !t.local && t.name !== 'lean_check')) {
  try {
    const args = t.name === 'lean_law_get' ? { id: [...ids][0] } : {};
    const r = await t.handler(args);
    for (const k of ['source', 'lawset_version', 'fetched_at']) if (r[k] == null) throw new Error(`envelope has no ${k}`);
    if (r.lawset_version !== reg.current) throw new Error(`envelope lawset_version ${r.lawset_version} is not the current lawset ${reg.current}`);
  } catch (e) { fail('b:source', t.name, `${t.name}: ${e.message}`, 'wrap the handler with withSource() in sim-engine/tools/lean-tools.mjs'); }
}
try {
  const c = (await T.lean_changes.handler({})).result;
  const vs = new Set(c.entries.map(e => e.version));
  for (const ls of reg.lawsets) if (!vs.has(ls.version)) fail('b:changes', ls.version, `lean_changes has no entry for lawset ${ls.version}`, 'add a "## <version> (<date>)" section to lean/registry/CHANGELOG.md (release.mjs writes one)');
} catch (e) { fail('b:changes', 'lean_changes', e.message, 'lib/lean-source.mjs getChanges'); }
// CI self-update: the mirror republishes and the hosted server redeploys when laws change.
const wf = rel => (has(rel) ? fs.readFileSync(R(rel), 'utf8') : null);
const pub = wf('.github/workflows/leanbio-publish.yml');
if (!pub) fail('ci:publish', 'leanbio-publish.yml', '.github/workflows/leanbio-publish.yml is missing: the /api/lean/ mirror would not republish when laws change', 'restore the workflow (lean/registry/SELF-UPDATE.md)');
else for (const need of ['lean/**', 'build-lean-api.mjs', 'check-exposed.mjs', 'wrangler', 'CLOUDFLARE_API_TOKEN']) if (!pub.includes(need)) fail('ci:publish', need, `leanbio-publish.yml does not mention ${need}`, 'see lean/registry/SELF-UPDATE.md');
const dep = wf('.github/workflows/deploy-mcp.yml');
if (dep) for (const need of ['lean/registry/**', 'lib/lean-source.mjs', 'sim-engine/tools/lean-tools.mjs']) if (!dep.includes(`"${need}"`)) fail('ci:deploy-mcp', need, `deploy-mcp.yml path filters do not cover ${need}`, 'add it under on.push.paths');
try { await T.lean_check.handler({ design: {} }); } catch (e) { fail('b:handler', 'lean_check', e.message, 'lean/eliminate/browser-check.mjs'); }

// ── (c) static mirror ────────────────────────────────────────────────────────
const mirror = await imp('dashboard/build-lean-api.mjs');
if (!has('dashboard/public/api/lean/index.json')) fail('c:mirror', 'index.json', 'static mirror dashboard/public/api/lean/ does not exist', 'node dashboard/build-lean-api.mjs');
else {
  const idx = readJson('dashboard/public/api/lean/index.json');
  const inIdx = new Set(idx.laws.map(l => l.law_id));
  for (const id of ids) {
    if (!inIdx.has(id)) fail('c:mirror', id, `${id} missing from /api/lean/index.json`, 'node dashboard/build-lean-api.mjs');
    if (!has(`dashboard/public/api/lean/laws/${id.replace(/[^A-Za-z0-9._-]/g, '_')}.json`)) fail('c:mirror', id, `/api/lean/laws/${id}.json missing`, 'node dashboard/build-lean-api.mjs');
  }
  for (const v of archived) if (!has(`dashboard/public/api/lean/laws/${v.law_id}@${v.version}.json`)) fail('c:mirror', `${v.law_id}@${v.version}`, `/api/lean/laws/${v.law_id}@${v.version}.json missing`, 'node dashboard/build-lean-api.mjs');
  const d = mirror.diff();
  if (d.length) fail('stale:mirror', `${d.length} files`, `static mirror is stale relative to the sources: ${d.slice(0, 6).map(x => `${x.file} (${x.why})`).join(', ')}${d.length > 6 ? ', ...' : ''}`, 'node dashboard/build-lean-api.mjs');
}

// ── (d) CLIs ─────────────────────────────────────────────────────────────────
const cli = await imp('sim-engine/lean-cli.mjs');
for (const id of ids) {
  try { const { out } = await cli.run(['law', id, '--result']); if (out.law_id !== id) throw new Error('wrong law'); }
  catch (e) { fail('d:cli', id, `lean-cli law ${id} failed: ${e.message}`, 'sim-engine/lean-cli.mjs'); }
}
if (!FAST) {
  for (const [bin, label] of [['sim-engine/lean-cli.mjs', 'sim-engine/lean-cli.mjs laws'], ['mcp/cli.mjs', 'mcp/cli.mjs laws']]) {
    const r = spawnSync(process.execPath, [R(bin), 'laws'], { cwd: ROOT, encoding: 'utf8', timeout: 120_000, maxBuffer: 64 << 20 });
    let got = null;
    try { got = new Set(JSON.parse(r.stdout).result.laws.map(l => l.law_id)); } catch { }
    if (!got) fail('d:cli', label, `${label} did not print the law list (exit ${r.status}): ${(r.stderr || '').slice(0, 300)}`, `run: node ${bin} laws`);
    else for (const id of ids) if (!got.has(id)) fail('d:cli', id, `${label} does not return ${id}`, bin);
  }
}

// ── (e) servers ──────────────────────────────────────────────────────────────
// sim-engine stdio server: its published contract must carry every lean_* tool with the handler module's schema.
const contractPath = 'sim-engine/contract.json';
if (has(contractPath)) {
  const contract = readJson(contractPath);
  const dump = spawnSync(process.execPath, [R('sim-engine/server.mjs'), '--dump-contract'], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 64 << 20 });
  let live = null; try { live = JSON.parse(dump.stdout); } catch { }
  if (!live) fail('stale:contract', contractPath, `node sim-engine/server.mjs --dump-contract failed (exit ${dump.status}): ${(dump.stderr || '').slice(0, 300)}`, 'fix sim-engine/server.mjs');
  else if (JSON.stringify(live) !== JSON.stringify(contract)) fail('stale:contract', contractPath, 'sim-engine/contract.json differs from what server.mjs publishes now', 'node sim-engine/server.mjs --dump-contract > sim-engine/contract.json');
  for (const t of tools.LEAN_TOOLS) {
    const c = contract.tools?.find(x => x.name === t.name);
    if (!c) fail('e:sim-engine', t.name, `${t.name} is not in sim-engine/contract.json (not registered in sim-engine/server.mjs)`, 'apply sim-engine/tools/LEAN-REGISTER.md, then regenerate contract.json');
    else if (JSON.stringify(c.inputSchema) !== JSON.stringify(t.inputSchema)) fail('e:sim-engine', t.name, `${t.name} in contract.json is not the lean-tools.mjs definition (old wrapper still registered?)`, 'apply sim-engine/tools/LEAN-REGISTER.md, then regenerate contract.json');
  }
}
if (has('sim-engine/http.mjs')) {
  try {
    const { discoverTools } = await imp('sim-engine/http.mjs');
    const { tools: ht } = await discoverTools();
    for (const t of tools.LEAN_TOOLS) if (!ht.some(x => x.name === t.name)) fail('e:http', t.name, `sim-engine HTTP bridge does not discover ${t.name}`, 'sim-engine/http.mjs discoverTools');
  } catch (e) { notes.push(`sim-engine/http.mjs discovery not checked: ${e.message}`); }
}
// The hosted delphisci MCP: spawn it over stdio (exactly what `npx github:...` runs) and ask it.
if (!FAST && has('mcp/server.mjs')) {
  try {
    const { Client } = await import(pathToFileURL(R('node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js')).href);
    const { StdioClientTransport } = await import(pathToFileURL(R('node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js')).href);
    const env = { ...process.env, LEANBIO_REMOTE: 'off' }; delete env.DELPHI_HTTP_PORT;
    const transport = new StdioClientTransport({ command: process.execPath, args: [R('mcp/server.mjs')], cwd: ROOT, env, stderr: 'pipe' });
    const client = new Client({ name: 'check-exposed', version: '1' });
    await client.connect(transport);
    const names = (await client.listTools()).tools.map(t => t.name);
    for (const t of tools.LEAN_TOOLS) if (!names.includes(t.name)) fail('e:mcp', t.name, `mcp/server.mjs (stdio) does not offer ${t.name}`, 'register it in mcp/server.mjs (leanTool(...))');
    const r = await client.callTool({ name: 'lean_laws_list', arguments: {} });
    const got = new Set(JSON.parse(r.content[0].text).result.laws.map(l => l.law_id));
    for (const id of ids) if (!got.has(id)) fail('e:mcp', id, `mcp lean_laws_list does not return ${id}`, 'mcp/server.mjs must use sim-engine/tools/lean-tools.mjs');
    await client.close();
  } catch (e) { fail('e:mcp', 'mcp/server.mjs', `could not query mcp/server.mjs over stdio: ${e.message}`, 'npm install at the repo root; node mcp/server.mjs'); }
}
// Packaging: the hosted image and `npx github:` installs must contain what the loader reads.
if (has('package.json')) {
  const files = readJson('package.json').files || [];
  const di = has('.dockerignore') ? fs.readFileSync(R('.dockerignore'), 'utf8') : '';
  for (const need of ['lib/lean-source.mjs', 'lib/lean-scope.mjs', 'sim-engine/tools/lean-tools.mjs', 'sim-engine/lib/envelope.mjs', 'lean/registry/laws/', 'lean/registry/lawsets/', 'lean/registry/law-versions/', 'lean/registry/registry-lib.mjs', 'lean/laws.json', 'lean/constraints.json', 'lean/eliminate/browser-check.mjs', 'lean/Delphi']) {
    if (!files.some(f => f === need || f.startsWith(need))) fail('e:package', need, `package.json "files" does not ship ${need}`, 'add it to "files" in package.json');
    if (di && !di.split(/\r?\n/).some(l => l.startsWith('!' + need))) fail('e:package', need, `.dockerignore does not let ${need} into the image`, `add !${need}... to .dockerignore`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────
const summary = { ok: failures.length === 0, origin: reg.origin, laws: ids.size, constraints: reg.constraints.length,
  lean_modules: allModules.length, lawsets: reg.lawsets.map(s => s.version), current: reg.current, failures, notes };
if (JSON_OUT) console.log(JSON.stringify(summary, null, 1));
else {
  console.log(`check-exposed: ${ids.size} laws (${reg.origin}), ${reg.constraints.length} constraints, ${allModules.length} Lean modules, lawsets ${summary.lawsets.join(', ') || 'none'} (current ${reg.current})`);
  for (const n of notes) console.log(`  note: ${n}`);
  if (!failures.length) console.log('  OK: every law is in the registry, the handlers, the static mirror, both CLIs, the MCP servers and the contract; nothing is stale.');
  else {
    const by = {};
    for (const f of failures) (by[f.check] ||= []).push(f);
    for (const [k, fs_] of Object.entries(by)) {
      console.log(`  FAIL ${k} (${fs_.length})`);
      for (const f of fs_.slice(0, 12)) console.log(`    - ${f.msg}\n      fix: ${f.fix}`);
      if (fs_.length > 12) console.log(`    ... ${fs_.length - 12} more`);
    }
    console.log(`\n${failures.length} failure(s). Rule: any new Lean law must be exposed through the registry, the MCP tools, the CLI and /api/lean/ (lean/registry/AGENTS-RULE.md).`);
  }
}
process.exit(failures.length ? 1 : 0);
