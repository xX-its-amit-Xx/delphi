// The ONE loader for the project's Lean laws. Every surface that exposes laws reads them through here:
//
//   sim-engine/tools/lean-tools.mjs   (our sim-engine MCP server, its HTTP bridge, sim-engine/lean-cli.mjs)
//   mcp/server.mjs + mcp/cli.mjs      (the hosted delphisci MCP at delphisci-mcp.fly.dev)
//   dashboard/build-lean-api.mjs      (the static mirror at /api/lean/ on the Cloudflare site)
//   lean/registry/check-exposed.mjs   (the enforcement check)
//
// Source of truth, in order:
//   1. lean/registry/  (one file per law: laws/<law_id>.json; releases: lawsets/lawset-<semver>.json and
//      lawsets/current.json; propose.mjs). Used as soon as lean/registry/laws/ holds at least one file.
//   2. Fallback while the registry does not exist yet: lean/laws.json + lean/constraints.json +
//      lean/empirical.json, mapped into registry-shaped entries here. Every entry built this way says so in
//      `origin`, its status keeps the original wording in `source_status`, and the single lawset is versioned
//      0.0.0-derived so nobody mistakes it for a release.
//
//   0. Optional, at runtime: a REMOTE source (LEANBIO_REMOTE=mirror|github; on by default for the hosted
//      server). The published lawsets and law files are fetched with ETag caching and a TTL, and each is checked
//      against its lawset's content_hash. A verified snapshot replaces 1/2 for queries, and a failed or tampered
//      fetch keeps the last good one. See "remote source" near the end of this file and lean/registry/SELF-UPDATE.md.
//
// Swapping sources is this file only. Nothing here writes to disk; propose() shells out to the registry's
// own propose.mjs, which decides where its output goes.
//
// Pure node (fs, path, crypto, child_process, global fetch). No Aves data is read or emitted: the sources it reads are the
// Lean modules and their JSON, which carry none.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { outOfScope } from './lean-scope.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..');
const R = (...p) => path.join(ROOT, ...p);
const rel = abs => path.relative(ROOT, abs).replace(/\\/g, '/');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = p => { try { fs.accessSync(p); return true; } catch { return false; } };

export const REGISTRY_DIR = R('lean', 'registry');
// The registry's own helpers (statementText, contentHash), reused rather than re-implemented so a pin means
// the same thing here as in the registry's build and tests.
let regLib = null;
try { if (exists(path.join(REGISTRY_DIR, 'registry-lib.mjs'))) regLib = await import(pathToFileURL(path.join(REGISTRY_DIR, 'registry-lib.mjs')).href); }
catch { regLib = null; }
export const LEAN_DIR = R('lean', 'Delphi');
export const FALLBACK_LAWSET = '0.0.0-derived';

// ── hashing ────────────────────────────────────────────────────────────────
// Line endings are normalised before hashing so a Windows checkout and the Linux CI/Docker image agree.
export function hashText(s) { return 'sha256:' + crypto.createHash('sha256').update(String(s).replace(/\r\n/g, '\n')).digest('hex'); }
export function hashFile(relPath) {
  const abs = R(relPath);
  return exists(abs) ? hashText(fs.readFileSync(abs, 'utf8')) : null;
}

let commitCache;
export function gitCommit() {
  if (commitCache !== undefined) return commitCache;
  const env = process.env.DELPHI_GIT_SHA || process.env.GIT_SHA || process.env.GITHUB_SHA;
  if (env) return (commitCache = env);
  try { commitCache = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { commitCache = null; } // no .git (the Docker image): content hashes still pin the bytes
  return commitCache;
}

// ── the files the laws come from ───────────────────────────────────────────
function walk(dir, pred, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '.lake' && e.name !== 'node_modules') walk(p, pred, out); }
    else if (pred(p)) out.push(p);
  }
  return out;
}

export function leanModules({ includeCertificates = false } = {}) {
  return walk(LEAN_DIR, p => p.endsWith('.lean'))
    .map(rel)
    .filter(p => includeCertificates || !p.includes('/Certificates/'))
    .sort();
}

export function registryPresent() {
  const d = path.join(REGISTRY_DIR, 'laws');
  return exists(d) && fs.readdirSync(d).some(f => f.endsWith('.json'));
}

// Every input whose change must regenerate the static mirror (and redeploy the hosted server).
export function sourceFiles() {
  const files = ['lean/laws.json', 'lean/constraints.json', 'lean/empirical.json', 'lean/eliminate/browser-check.mjs',
                 'lib/lean-source.mjs', 'lib/lean-scope.mjs', ...leanModules({ includeCertificates: false })];
  if (exists(REGISTRY_DIR)) {
    for (const p of walk(REGISTRY_DIR, p => /[\\/](laws|lawsets|law-versions)[\\/][^\\/]+\.json$/.test(p))) files.push(rel(p));
  }
  return [...new Set(files)].filter(f => exists(R(f))).sort();
}

export function sourceFingerprint() {
  const files = {};
  for (const f of sourceFiles()) files[f] = hashFile(f);
  return { hash: hashText(JSON.stringify(files)), files };
}

// ── Lean source text ───────────────────────────────────────────────────────
const DECL = /^(?:@\[[^\]]*\]\s*)?(?:private\s+|protected\s+|noncomputable\s+)*(theorem|lemma|def|structure|class|abbrev|inductive|instance|axiom)\s+([^\s:(\[{]+)/;
const TOP = /^(?:@\[|private\s|protected\s|noncomputable\s|theorem\s|lemma\s|def\s|structure\s|class\s|abbrev\s|inductive\s|instance\s|axiom\s|namespace\s|end\s|end$|section|open\s|variable|\/-[-!]|#|example\s|set_option|attribute\s|omit\s|include\s)/;
const fileCache = new Map();
function leanLines(relPath) {
  if (!fileCache.has(relPath)) fileCache.set(relPath, exists(R(relPath)) ? fs.readFileSync(R(relPath), 'utf8').replace(/\r\n/g, '\n').split('\n') : null);
  return fileCache.get(relPath);
}

// All declarations in a module: [{name (fully qualified as far as namespaces show), short, keyword, line}].
export function declarations(relPath) {
  const lines = leanLines(relPath);
  if (!lines) return [];
  const ns = [];
  const out = [];
  lines.forEach((l, i) => {
    let m;
    if ((m = /^namespace\s+(\S+)/.exec(l))) ns.push(m[1]);
    else if ((m = /^end\s+(\S+)\s*$/.exec(l)) && ns.length && ns[ns.length - 1] === m[1]) ns.pop();
    else if ((m = DECL.exec(l))) {
      const short = m[2];
      out.push({ keyword: m[1], short, name: [...ns, short].join('.').replace(/^_root_\./, ''), line: i + 1 });
    }
  });
  return out;
}

function declText(relPath, line) {
  const lines = leanLines(relPath);
  let start = line - 1;
  // Pull in the docstring directly above.
  if (start > 0 && /-\/\s*$/.test(lines[start - 1])) {
    let j = start - 1;
    while (j >= 0 && !/^\s*\/--/.test(lines[j])) j--;
    if (j >= 0) start = j;
  }
  let end = line;
  while (end < lines.length && !(lines[end].length && !/^\s/.test(lines[end]) && TOP.test(lines[end]))) end++;
  while (end > line && !lines[end - 1].trim()) end--;
  return lines.slice(start, end).join('\n');
}

// Find a declaration by fully-qualified name. Looks in `module` first, then every Lean module.
export function findDecl(fullName, module = null) {
  if (!fullName) return null;
  const short = fullName.split('.').pop();
  const candidates = [module, ...leanModules({ includeCertificates: true })].filter(Boolean);
  for (const m of [...new Set(candidates)]) {
    const ds = declarations(m);
    const hit = ds.find(d => d.name === fullName) || ds.find(d => d.short === short && fullName.endsWith(d.name.split('.').slice(-2).join('.')));
    if (hit) return { ...hit, module: m, source: declText(m, hit.line) };
  }
  return null;
}

// Named hypotheses: identifiers in the theorem's signature that are Prop-valued structures/defs/classes
// declared in the same module. Their source text is returned so a reader sees exactly what is assumed.
function namedHypotheses(decl) {
  if (!decl) return [];
  const sig = decl.source.split(/:=/)[0];
  const local = declarations(decl.module).filter(d => ['structure', 'class', 'def', 'abbrev'].includes(d.keyword));
  const out = [];
  for (const d of local) {
    if (d.short === decl.short) continue;
    if (new RegExp(`(^|[^A-Za-z0-9_.'])(?:[A-Za-z0-9_]+\\.)*${d.short.replace(/[.*+?^${}()|[\]\\']/g, '\\$&')}(?![A-Za-z0-9_'])`).test(sig)) {
      const text = declText(decl.module, d.line);
      if (d.keyword === 'def' && !/:\s*Prop\b/.test(text.split(':=')[0])) continue; // only Prop-valued defs are hypotheses
      out.push({ name: d.name, keyword: d.keyword, module: decl.module, line: d.line, source: text });
    }
  }
  return out;
}

// ── fallback: registry-shaped entries from laws.json + constraints.json + empirical.json ────────
const PHYSICAL_MODULES = /\/(Scaling|Flight|Thompson|Altitude)\.lean$/;
function kindOf(l) {
  if (l.module && PHYSICAL_MODULES.test(l.module)) return 'physical';
  if (/^phenotype$/.test(l.level || '') && !l.module) return 'physical';
  return 'biological';
}
// laws.json wording -> registry status. The original wording is kept in source_status, verbatim.
function statusOf(s = '') {
  if (/contested|FROM a named hypothesis/i.test(s)) return 'contested';
  if (/^stated-not-proved/i.test(s)) return 'candidate';
  if (/^not formalised/i.test(s)) return 'proposed';
  if (/already proved|not an empirical entry/i.test(s)) return 'retired';
  if (/^proved|^empirical|^project convention/i.test(s)) return 'accepted';
  return 'proposed';
}

function deriveFromJson() {
  const lawsJson = readJson(R('lean', 'laws.json'));
  const cons = readJson(R('lean', 'constraints.json')).constraints;
  const emp = exists(R('lean', 'empirical.json')) ? readJson(R('lean', 'empirical.json')) : { entries: [] };
  const empById = Object.fromEntries((emp.entries || []).map(e => [e.id, e]));
  const commit = gitCommit();
  const laws = lawsJson.laws.map(l => {
    const e = empById[l.id];
    const cs = cons.filter(c => (l.constraints || []).includes(c.id));
    return {
      law_id: l.id,
      version: '1.0.0',
      kind: kindOf(l),
      status: statusOf(l.status),
      source_status: l.status,
      label: l.label || e?.title || l.id,
      statement: l.statement || e?.statement || null,
      statement_en: e?.observation || l.statement || null,
      level: l.level,
      lean_ref: l.module ? { module: l.module, theorem: l.theorem || null, commit, statement_sha256: null, content_hash: null } : null,
      hypotheses: [...new Set([...(l.scope?.assumed || []), ...cs.flatMap(c => c.assumptionsText || []), ...(e?.scope ? [].concat(e.scope) : [])])],
      scope: l.scope || (e ? { observation: e.observation, taxa: e.taxa, rejectable: e.rejectable } : null),
      sources: [l.source || e?.source].filter(Boolean),
      constraints: l.constraints || [],
      non_vacuity_witness: e && emp.nonVacuity ? emp.nonVacuity : null,
      faithfulness: l.faithfulness || null,
      history: [{ version: '1.0.0', date: lawsJson.built, change: 'derived from lean/laws.json by lib/lean-source.mjs (lean/registry/ not present yet)' }],
      supersedes: null,
      superseded_by: null,
      origin: 'derived:lean/laws.json',
    };
  });
  const lawset = {
    version: FALLBACK_LAWSET,
    created: lawsJson.built,
    note: 'Derived lawset: every non-retired entry of lean/laws.json. Not a release; lean/registry/ will replace it.',
    laws: laws.filter(l => l.status !== 'retired').map(l => ({ law_id: l.law_id, version: l.version, content_hash: entryHash(l) })),
  };
  return { origin: 'fallback', laws, lawsets: [lawset], current: FALLBACK_LAWSET, constraints: cons, versions: {} };
}

// Hash of a law entry's substance (not of its timestamps), so a lawset pins what it accepted.
export function entryHash(l) {
  const { history, origin, ...core } = l;
  return hashText(JSON.stringify(core, Object.keys(core).sort()));
}

// ── registry reader ────────────────────────────────────────────────────────
const semverKey = v => String(v).split(/[.+-]/).slice(0, 3).map(n => String(Number(n) || 0).padStart(6, '0')).join('.');
function readRegistry() {
  const lawFiles = fs.readdirSync(path.join(REGISTRY_DIR, 'laws')).filter(f => f.endsWith('.json')).sort();
  const cons = readJson(R('lean', 'constraints.json')).constraints;
  const lawsJson = exists(R('lean', 'laws.json')) ? readJson(R('lean', 'laws.json')).laws : [];
  const legacy = Object.fromEntries(lawsJson.map(l => [l.id, l]));
  const laws = lawFiles.map(f => {
    const j = readJson(path.join(REGISTRY_DIR, 'laws', f));
    const id = j.law_id || f.replace(/\.json$/, '');
    return {
      ...j,
      law_id: id,
      // Not every registry file carries a label; every surface needs one, so derive it rather than print "null".
      label: j.label || j.title || legacy[id]?.label || shortLabel(j.statement_en || j.statement) || id,
      // constraint ids: the registry's own list if it carries one, else laws.json's mapping for this id
      constraints: j.constraints || legacy[id]?.constraints || [],
      origin: `lean/registry/laws/${f}`,
    };
  });
  // Archived law versions (lean/registry/law-versions/<law_id>@<version>.json): what older lawsets pinned.
  const vDir = path.join(REGISTRY_DIR, 'law-versions');
  const versions = {};
  if (exists(vDir)) for (const f of fs.readdirSync(vDir).filter(f => /@.+\.json$/.test(f)).sort()) {
    const j = readJson(path.join(vDir, f));
    const id = j.law_id || f.split('@')[0];
    versions[`${id}@${j.version}`] = { ...j, law_id: id, label: j.label || legacy[id]?.label || shortLabel(j.statement_en) || id,
                                       constraints: j.constraints || [], origin: `lean/registry/law-versions/${f}`, archived: true };
  }
  const lsDir = path.join(REGISTRY_DIR, 'lawsets');
  const lawsets = exists(lsDir)
    ? fs.readdirSync(lsDir).filter(f => /^lawset-.+\.json$/.test(f)).map(f => ({ ...readJson(path.join(lsDir, f)), file: `lean/registry/lawsets/${f}` }))
    : [];
  lawsets.sort((a, b) => semverKey(a.version).localeCompare(semverKey(b.version)));
  let current = null;
  if (exists(path.join(lsDir, 'current.json'))) {
    const c = readJson(path.join(lsDir, 'current.json'));
    current = c.version || c.current || null;
  }
  if (!current && lawsets.length) current = lawsets[lawsets.length - 1].version;
  return { origin: 'registry', laws, lawsets, current, constraints: cons, versions };
}

function shortLabel(text) {
  if (!text || typeof text !== 'string') return null;
  const first = text.split(/(?<=[.;:])\s/)[0].trim().replace(/[.;:]$/, '');
  return first.length > 90 ? first.slice(0, 87).replace(/\s+\S*$/, '') + '...' : first;
}

let cache = null, cacheKey = null;
// The laws every query reads. With a remote source configured and a verified snapshot fetched (ensureFresh, see
// "remote source" below), that snapshot; otherwise the local files. `local: true` always reads the local files
// (build-lean-api.mjs, check-exposed.mjs and lean_verify check the local tree, never a remote).
export function load({ fresh = false, local = false } = {}) {
  if (!local) { const snap = remoteSnapshot(); if (snap) return snap; }
  // Reload when any source changes (cheap: stat mtimes), so long-running servers see new laws.
  const key = sourceFiles().map(f => `${f}:${fs.statSync(R(f)).mtimeMs}`).join('|');
  if (!fresh && cache && key === cacheKey) return cache;
  fileCache.clear();
  cache = registryPresent() ? readRegistry() : deriveFromJson();
  cacheKey = key;
  localLoadedAt = new Date().toISOString();
  return cache;
}

// ── queries (pure; the tool layers wrap these) ──────────────────────────────
function summary(l) {
  return { law_id: l.law_id, version: l.version, kind: l.kind, status: l.status, label: l.label,
           level: l.level ?? null, theorem: l.lean_ref?.theorem ?? null, module: l.lean_ref?.module ?? null,
           statement: l.statement_en || l.statement || null, sources: l.sources || [],
           scope: l.scope ? { taxa: l.scope.taxa || [], life_stages: l.scope.life_stages || [], ranges: l.scope.ranges || {} } : null,
           ...(l.constraint_scopes ? { constraint_scopes: l.constraint_scopes } : {}),
           constraints: l.constraints || [], ...(l.source_status ? { source_status: l.source_status } : {}) };
}

export function resolveLawset(version = 'current') {
  const reg = load();
  const v = !version || version === 'current' ? reg.current : version;
  const ls = reg.lawsets.find(s => s.version === v);
  if (!ls) throw new Error(`no lawset "${version}"; available: ${reg.lawsets.map(s => s.version).join(', ') || 'none'} (current: ${reg.current})`);
  return ls;
}

export function listLaws({ kind, status, scope, lawset, text } = {}) {
  const reg = load();
  let laws = reg.laws;
  if (lawset) laws = lawsetLaws(resolveLawset(lawset)).filter(Boolean);
  if (kind) laws = laws.filter(l => l.kind === kind);
  if (status) { const s = [].concat(status); laws = laws.filter(l => s.includes(l.status)); }
  if (scope) { const q = String(scope).toLowerCase(); laws = laws.filter(l => String(l.level || '').toLowerCase().includes(q) || JSON.stringify(l.scope || '').toLowerCase().includes(q)); }
  if (text) { const q = String(text).toLowerCase(); laws = laws.filter(l => `${l.law_id} ${l.label} ${l.statement}`.toLowerCase().includes(q)); }
  return { origin: reg.origin, current_lawset: reg.current, lawsets: reg.lawsets.map(s => s.version), count: laws.length, laws: laws.map(summary) };
}

// The law entries a lawset pins: the current file when its version matches, else the archived snapshot.
// A pinned version found in neither place yields null (check-exposed reports it).
export function lawVersion(id, version) {
  const reg = load();
  const cur = reg.laws.find(x => x.law_id === id);
  if (!version || (cur && cur.version === version)) return cur || null;
  return reg.versions?.[`${id}@${version}`] || null;
}
export function lawsetLaws(ls) { return ls.laws.map(x => lawVersion(x.law_id, x.version)); }

export function getLaw(id, version = null) {
  const reg = load();
  const l = version ? lawVersion(id, version) : reg.laws.find(x => x.law_id === id);
  if (!l) throw new Error(version ? `no law "${id}" at version ${version}` : `no law "${id}". lean_laws_list returns every law_id.`);
  // A mirror snapshot's law docs already are lean_law_get results (Lean source text, constraint lemmas and pin as
  // computed where the mirror was built). Recomputing them here would read this deployment's Lean files instead.
  if (reg.full_docs) {
    const { remote_integrity, origin: from, archived, ...doc } = l;
    return { ...doc, ...(archived ? { archived } : {}), remote: { from, integrity: remote_integrity } };
  }
  const module = l.lean_ref?.module || null;
  const declName = l.lean_ref?.theorem || l.lean_ref?.structure || null;
  let decl = declName ? findDecl(declName, module) : null;
  const structDecl = l.lean_ref?.structure && l.lean_ref.structure !== declName ? findDecl(l.lean_ref.structure, module) : null;
  // A stated-not-proved law has no theorem, but names the Lean hypothesis that carries it
  // ("named hypothesis MusclePowerLaw", "named hypothesis fick_aerobic_supply"): show that source instead.
  if (!decl && module) {
    const named = /named hypothesis\s+([A-Za-z_][A-Za-z0-9_'.]*)/.exec(l.source_status || JSON.stringify(l.hypotheses || ''));
    if (named) decl = findDecl(named[1], module) || findDecl(`Delphi.${named[1]}`, module);
  }
  const constraints = reg.constraints.filter(c => (l.constraints || []).includes(c.id)).map(c => {
    const lemma = findDecl(c.lemma, c.module);
    return { id: c.id, relation: c.relation, lemma: c.lemma, law: c.law, module: c.module, status: c.status,
             appliesWhen: c.appliesWhen, canEliminate: c.canEliminate, lemma_source: lemma?.source ?? null };
  });
  return {
    ...l,
    lean: decl ? { theorem: decl.name, module: decl.module, line: decl.line, source: decl.source,
                   named_hypotheses: [...(structDecl ? [{ name: structDecl.name, keyword: structDecl.keyword, module: structDecl.module, line: structDecl.line, source: structDecl.source }] : []),
                                      ...namedHypotheses(decl).filter(h => h.name !== structDecl?.name)] }
               : { theorem: l.lean_ref?.theorem ?? null, module, source: null, note: l.lean_ref?.theorem ? 'theorem not found in the Lean sources' : 'no Lean theorem: this law is not formalised' },
    constraint_details: constraints,
    pin: pinStatus(l),
    in_lawsets: reg.lawsets.filter(s => s.laws.some(x => x.law_id === id && (!x.version || x.version === l.version))).map(s => s.version),
    other_versions: Object.values(reg.versions || {}).filter(v => v.law_id === id && v.version !== l.version).map(v => v.version),
  };
}

export function getLawset(version = 'current') {
  const reg = load();
  const ls = resolveLawset(version);
  return { ...ls, is_current: ls.version === reg.current, origin: reg.origin,
           laws: ls.laws.map(x => { const l = lawVersion(x.law_id, x.version);
             // the lawset's own pinned status/kind win over the law file's current ones
             return l ? { ...summary(l), ...x, ...(l.archived ? { archived: true } : {}) } : { ...x, missing: true }; }) };
}

// constraint id -> law
export function constraintIndex() {
  const reg = load();
  const idx = {};
  for (const l of reg.laws) for (const c of l.constraints || []) if (!idx[c]) idx[c] = l;
  // An empirical constraint (E2...) whose own id is a law id belongs to that law.
  for (const c of reg.constraints) if (!idx[c.id]) idx[c.id] = reg.laws.find(l => l.law_id === c.claim_id || l.law_id === c.id) || null;
  return idx;
}

let bcPromise = null;
export function browserCheck() {
  bcPromise ||= import(pathToFileURL(R('lean', 'eliminate', 'browser-check.mjs')).href);
  return bcPromise;
}

// Evaluate a resolved state/design against one lawset. Evaluation is the generated browser-check (floating
// point, NOT a kernel check); law identity, version, kind and status come from the registry.
export async function checkDesign(design = {}, lawsetVersion = 'current') {
  const ls = resolveLawset(lawsetVersion);
  const inSet = new Map(ls.laws.map(x => [x.law_id, x]));
  const idx = constraintIndex();
  const byId = Object.fromEntries(load().laws.map(l => [l.law_id, l]));
  const bc = await browserCheck();
  // The registry generator's browser-check takes (design, {lawset, includeCandidates}); the older one ignores it.
  const rows = (bc.check || bc.default)(design, { lawset: ls.version, includeCandidates: true });
  const verdicts = [], violations = [], excluded = [], unmapped = [];
  for (const r of rows) {
    // Prefer the law the generated row names (registry-built browser-check), else the constraint index.
    const cur = (r.law?.law_id && byId[r.law.law_id]) || idx[r.id];
    const base = cur && inSet.get(cur.law_id) ? (lawVersion(cur.law_id, inSet.get(cur.law_id).version) || cur) : cur;
    if (!base) { unmapped.push(r.id); continue; }
    const pinned = inSet.get(base.law_id);
    if (!pinned) { excluded.push({ constraint: r.id, law_id: base.law_id, why: `not in lawset ${ls.version}` }); continue; }
    // Status and kind are pinned per lawset when the lawset records them; the law file is the fallback.
    const law = { ...base, version: pinned.version || base.version, status: pinned.status || base.status, kind: pinned.kind || base.kind };
    if (law.status === 'retired') { excluded.push({ constraint: r.id, law_id: law.law_id, why: 'retired' }); continue; }
    const binding = law.status === 'accepted';
    // Out of scope by the shared rule, or already so by a registry-built browser-check that scopes rows itself.
    const oos = outOfScope(r, law, design) || (r.verdict === 'out-of-scope' ? { reason: r.scope_check?.reason || 'out of scope (browser-check scope_check)' } : null);
    const v = { law_id: law.law_id, version: law.version, kind: law.kind, status: law.status, constraint: r.id,
                band: r.band, verdict: oos ? 'out-of-scope' : r.verdict, binding, missing: r.missing || r.missing_inputs || [],
                ...(oos ? { scope_reason: oos.reason, evaluator_verdict: r.computed_verdict || r.verdict } : {}) };
    verdicts.push(v);
    if (oos) continue;
    if (['violated', 'contested', 'candidate-violated'].includes(r.verdict)) {
      violations.push({ law_id: law.law_id, version: law.version, kind: law.kind, status: law.status, constraint: r.id, binding,
        inputs: r.numbers ?? null,
        message: `${law.label || law.law_id}: ${r.relation || `constraint ${r.id}`} fails for the committed numbers${r.note ? ` (${r.note})` : ''}` +
                 (binding ? '' : ` [advisory: law status is ${law.status}, not accepted]`) });
    }
  }
  const evaluated = new Set(rows.map(r => r.id));
  const notEvaluable = ls.laws.filter(x => !(idx && Object.entries(idx).some(([c, l]) => l?.law_id === x.law_id && evaluated.has(c))))
                              .map(x => x.law_id);
  return {
    lawset: ls.version,
    kernel: bc.KERNEL_NOTE,
    summary: { violated: violations.length, binding_violations: violations.filter(v => v.binding).length,
               holds: verdicts.filter(v => v.verdict === 'holds').length,
               out_of_scope: verdicts.filter(v => v.verdict === 'out-of-scope').length,
               cannot_evaluate: verdicts.filter(v => v.verdict === 'cannot-evaluate').length },
    verdicts, violations, excluded,
    laws_without_browser_evaluation: notEvaluable,
    ...(unmapped.length ? { unmapped_constraints: unmapped } : {}),
  };
}

// One law's pin, re-checked against the current Lean source.
//  registry: lean_ref.statement_sha256 = sha256 of the statement text of lean_ref.structure || lean_ref.theorem,
//            as registry-lib.statementText extracts it; content_hash = registry-lib.contentHash(law).
//  fallback: no pins exist, so only the module file hash and theorem existence are reported.
export function pinStatus(l) {
  const ref = l.lean_ref;
  if (!ref?.module) return null;
  const fileHash = hashFile(ref.module);
  const declName = ref.structure || ref.theorem || null;
  const found = declName ? !!findDecl(declName, ref.module) : null;
  const out = { module: ref.module, decl: declName, commit: ref.commit ?? null, module_hash: fileHash, theorem_found: found };
  if (fileHash == null) return { ...out, status: 'missing-file' };
  if (ref.statement_sha256 && regLib?.statementText) {
    const text = regLib.statementText(fs.readFileSync(R(ref.module), 'utf8'), declName);
    const now = text ? regLib.sha256(text) : null;
    out.pinned_statement_sha256 = ref.statement_sha256;
    out.current_statement_sha256 = now;
    if (l.content_hash && regLib.contentHash) { out.entry_hash_ok = regLib.contentHash(l) === l.content_hash; }
    out.status = now == null ? 'statement-missing' : now !== ref.statement_sha256 ? 'drift' : out.entry_hash_ok === false ? 'entry-hash-mismatch' : 'ok';
    return out;
  }
  return { ...out, status: found === false ? 'statement-missing' : 'unpinned' };
}

// Re-hash every pinned file and report drift. Pins: each law's lean_ref.content_hash (registry), plus the
// static mirror's recorded source fingerprint, plus the generated browser-check against constraints.json.
export function verify() {
  const reg = load({ local: true });
  const laws = [];
  for (const l of reg.laws) {
    const ps = pinStatus(l);
    if (ps) laws.push({ law_id: l.law_id, version: l.version, ...ps });
  }
  const fp = sourceFingerprint();
  let mirror = null;
  const idx = R('dashboard', 'public', 'api', 'lean', 'index.json');
  if (exists(idx)) {
    const j = readJson(idx);
    mirror = { built: j.built, pinned: j.source_fingerprint?.hash ?? null, current: fp.hash,
               stale: j.source_fingerprint?.hash !== fp.hash,
               changed: Object.keys({ ...fp.files, ...(j.source_fingerprint?.files || {}) }).filter(f => fp.files[f] !== j.source_fingerprint?.files?.[f]) };
  }
  let browser = null;
  try {
    const head = fs.readFileSync(R('lean', 'eliminate', 'browser-check.mjs'), 'utf8').split('\n')[0];
    const m = /constraints\.json \(built ([^)]+)\)/.exec(head);
    const built = readJson(R('lean', 'constraints.json')).built;
    browser = { generated_from: m?.[1] ?? null, constraints_built: built, stale: !!(m && m[1] !== built) };
  } catch { /* browser-check absent */ }
  const drift = laws.filter(x => ['drift', 'missing-file', 'statement-missing', 'entry-hash-mismatch'].includes(x.status) || x.theorem_found === false);
  return { origin: reg.origin, commit: gitCommit(), ok: drift.length === 0 && !(mirror?.stale),
           drift, laws, static_mirror: mirror, browser_check: browser,
           note: reg.origin === 'fallback' ? 'Fallback source: no statement pins exist, so per-law drift cannot appear until lean/registry/ pins statement hashes. Theorem existence and the static mirror are still checked.' : 'Per-law pin: lean_ref.statement_sha256 against the statement text now in the module (registry-lib.statementText), and content_hash against registry-lib.contentHash.' };
}

// Hand a proposed statement to the registry's own propose.mjs. Never auto-accepts: any "accepted" coming
// back is downgraded to "candidate" and flagged, because acceptance is a human decision.
export async function propose({ file, source, meta = {} } = {}) {
  const script = path.join(REGISTRY_DIR, 'propose.mjs');
  if (!exists(script)) throw new Error('lean/registry/propose.mjs does not exist yet; proposing needs the registry. Nothing was submitted.');
  let tmp = null;
  if (!file && source) {
    tmp = fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'lean-propose-'));
    file = path.join(tmp, 'Proposed.lean');
    fs.writeFileSync(file, source);
  }
  if (!file) throw new Error('propose needs `file` (path to a .lean file) or `source` (its text)');
  const metaPath = path.join(tmp || fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'lean-propose-')), 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta));
  const r = spawnSync(process.execPath, [script, path.resolve(file), '--meta', metaPath], { cwd: ROOT, encoding: 'utf8', timeout: 15 * 60_000 });
  let out;
  try { out = JSON.parse(r.stdout); }
  catch { throw new Error(`propose.mjs did not print JSON (exit ${r.status}): ${(r.stderr || r.stdout || '').slice(0, 2000)}`); }
  const st = out.status || out.verdict;
  if (st === 'accepted') { out.status = 'candidate'; out.downgraded_from = 'accepted'; out.note = 'never auto-accepted: acceptance is a human decision'; }
  if (!['candidate', 'contested', 'rejected', 'proposed'].includes(out.status || out.verdict)) out.status_unrecognised = st ?? null;
  return { exit: r.status, ...out };
}

// ── remote source: runtime self-update ─────────────────────────────────────
// A long-running server can follow the published laws without a redeploy. When LEANBIO_REMOTE is set, the tool
// layer calls ensureFresh() before every lean_* call. At most once per TTL it re-fetches the published lawsets
// and law files with conditional GETs (If-None-Match, so an unchanged source costs only 304s). It checks every
// pinned law against the content_hash its lawset records (registry-lib.contentHash, the same hash the registry
// pins), and swaps the new set in only if all of them match. Any failure (network, HTTP error, bad JSON, a hash
// mismatch, or a lawset naming a law that is not served) keeps the last good set; sourceStatus() reports it.
//
//   LEANBIO_REMOTE      off | mirror | github     default: mirror when hosted (DELPHI_HTTP_PORT set), else off
//                                                  (local dev reads the local files first)
//   LEANBIO_MIRROR_URL  base of the static mirror  default DEFAULT_MIRROR (serves index.json, laws/, lawsets/)
//   LEANBIO_REPO        owner/repo for github      default DEFAULT_REPO
//   LEANBIO_REF         branch, tag or commit      default main
//   LEANBIO_GITHUB_URL  base of the raw lean/registry/ files (overrides REPO + REF)
//   LEANBIO_TTL_S       seconds between checks     default 600
//   LEANBIO_TIMEOUT_MS  per-request timeout        default 10000
//
// What the integrity check establishes: every law that a fetched lawset pins was served with exactly the hashed
// content (statement, Lean reference and statement hash, hypotheses, scope, witness) that the lawset pinned. So a
// half-deployed mirror, a corrupted file or an edited law file is rejected. It cannot detect a publisher who
// rewrites a lawset and its law files together, because lawsets are not signed. Status and approval are outside
// the content hash by design; lean_lawset_get and lean_check use the lawset's own pinned status. Evaluation
// (lean_check) still runs the generated browser-check shipped with this deployment, so a new law version whose
// evaluator changed needs a redeploy before lean_check evaluates it with the new formula.

export const DEFAULT_MIRROR = 'https://delphi-mission-control.ashenoy000.workers.dev/api/lean/';
export const DEFAULT_REPO = 'fractastical/delphisci';
const REMOTE_MODES = ['off', 'mirror', 'github'];
const slash = u => (u.endsWith('/') ? u : u + '/');

export function remoteConfig(env = process.env) {
  const hosted = !!env.DELPHI_HTTP_PORT;
  let mode = String(env.LEANBIO_REMOTE || '').trim().toLowerCase();
  const asked = mode || null;
  if (!mode) mode = hosted ? 'mirror' : 'off';
  if (mode === 'on' || mode === '1' || mode === 'true') mode = 'mirror';
  if (mode === '0' || mode === 'false' || mode === 'local') mode = 'off';
  const invalid = !REMOTE_MODES.includes(mode) ? mode : null;
  if (invalid) mode = 'off';
  const ref = env.LEANBIO_REF || 'main';
  const repo = env.LEANBIO_REPO || DEFAULT_REPO;
  const url = mode === 'mirror' ? slash(env.LEANBIO_MIRROR_URL || DEFAULT_MIRROR)
    : mode === 'github' ? slash(env.LEANBIO_GITHUB_URL || `https://raw.githubusercontent.com/${repo}/${ref}/lean/registry/`)
    : null;
  return { mode, asked, invalid, hosted, url, ref: mode === 'github' ? ref : null, repo: mode === 'github' ? repo : null,
           ttl_ms: Math.max(0, Number(env.LEANBIO_TTL_S ?? 600)) * 1000, timeout_ms: Number(env.LEANBIO_TIMEOUT_MS ?? 10_000) };
}

const freshStats = () => ({ checks: 0, ok: 0, failed: 0, rejected: 0, requests: 0, not_modified: 0, swaps: 0 });
const remote = {
  key: null,          // mode|url the state below belongs to
  good: null,         // last good snapshot: { reg, lawset_version, fetched_at, checked_at, laws_verified, unpinned, changes }
  http: new Map(),    // url -> { etag, body } for If-None-Match
  checked_ms: 0,      // when the last check (success or failure) finished
  inflight: null,
  last_error: null,
  last_rejection: null,
  stats: freshStats(),
};
let localLoadedAt = null;

function resetRemote(key) {
  Object.assign(remote, { key, good: null, http: new Map(), checked_ms: 0, inflight: null, last_error: null, last_rejection: null, stats: freshStats() });
}

class Rejected extends Error {}

async function getJson(url, cfg, { text = false, optional = false } = {}) {
  const prev = remote.http.get(url);
  remote.stats.requests++;
  let res;
  try {
    res = await fetch(url, { headers: { Accept: text ? 'text/plain, */*' : 'application/json', 'User-Agent': 'delphisci-leanbio-loader',
                                        ...(prev?.etag ? { 'If-None-Match': prev.etag } : {}) },
                             signal: AbortSignal.timeout(cfg.timeout_ms) });
  } catch (e) { throw new Error(`GET ${url}: ${e.name === 'TimeoutError' ? 'timeout' : e.cause?.code || e.message}`); }
  if (res.status === 304 && prev) { remote.stats.not_modified++; return prev.body; }
  if (optional && res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  const raw = await res.text();
  let body;
  if (text) body = raw;
  else { try { body = JSON.parse(raw); } catch { throw new Error(`GET ${url}: not JSON`); } }
  const etag = res.headers.get('etag');
  if (etag) remote.http.set(url, { etag, body });
  return body;
}

// Run fn over items with a small concurrency cap (a refresh touches ~60 files, mostly 304s).
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

function verifyPinned(doc, pin, where) {
  if (!regLib?.contentHash) throw new Rejected('lean/registry/registry-lib.mjs is not available, so remote laws cannot be verified');
  if (!doc) throw new Rejected(`lawset ${where.lawset} pins ${pin.law_id}@${pin.version}, which the remote does not serve (${where.url})`);
  if (doc.law_id !== pin.law_id || (pin.version && doc.version !== pin.version)) throw new Rejected(`${where.url} is ${doc.law_id}@${doc.version}, lawset ${where.lawset} pins ${pin.law_id}@${pin.version}`);
  const got = regLib.contentHash(doc);
  if (pin.content_hash && got !== pin.content_hash) {
    const e = new Rejected(`content hash mismatch for ${pin.law_id}@${pin.version} (${where.url}): lawset ${where.lawset} pins ${pin.content_hash}, the served file hashes to ${got}`);
    e.detail = { law_id: pin.law_id, version: pin.version, url: where.url, lawset: where.lawset, expected: pin.content_hash, got };
    throw e;
  }
  return !!pin.content_hash;
}

// One snapshot from the static mirror (dashboard/build-lean-api.mjs output), whose law docs are lean_law_get results.
async function fetchMirror(cfg) {
  const index = await getJson(cfg.url + 'index.json', cfg);
  if (!Array.isArray(index?.lawsets) || !Array.isArray(index?.laws)) throw new Error(`${cfg.url}index.json is not a lean mirror index`);
  const lawsets = await pool(index.lawsets, 6, v => getJson(`${cfg.url}lawsets/${safeId(v)}.json`, cfg));
  const current = index.current_lawset;
  if (!lawsets.some(s => s.version === current)) throw new Rejected(`index.json names current lawset ${current}, which the mirror does not serve`);
  const curVer = Object.fromEntries(index.laws.map(l => [l.law_id, l.version]));
  const wanted = new Map(); // `${id}@${v}` -> url
  for (const l of index.laws) wanted.set(`${l.law_id}@${l.version}`, `${cfg.url}laws/${safeId(l.law_id)}.json`);
  for (const s of lawsets) for (const x of s.laws) if (!wanted.has(`${x.law_id}@${x.version}`))
    wanted.set(`${x.law_id}@${x.version}`, curVer[x.law_id] === x.version ? `${cfg.url}laws/${safeId(x.law_id)}.json` : `${cfg.url}laws/${safeId(x.law_id)}@${safeId(x.version)}.json`);
  const keys = [...wanted.keys()];
  const docs = await pool(keys, 8, k => getJson(wanted.get(k), cfg, { optional: true }));
  const byKey = Object.fromEntries(keys.map((k, i) => [k, docs[i]]));
  const changes = await getJson(cfg.url + 'changes.json', cfg, { optional: true }).catch(() => null);
  return assemble({ lawsets, current, byKey, wanted, currentKeys: index.laws.map(l => `${l.law_id}@${l.version}`), changes, full: true });
}

// One snapshot from raw registry files (lean/registry/ on a git ref). Raw hosting cannot list directories, so the
// lawsets are found by walking `previous` back from lawsets/current.json, and the laws are the ones they pin.
async function fetchGithub(cfg) {
  const cur = await getJson(cfg.url + 'lawsets/current.json', cfg);
  const lawsets = [];
  let file = cur.file || `lawset-${cur.version}.json`;
  const seen = new Set();
  while (file && !seen.has(file) && lawsets.length < 200) {
    seen.add(file);
    const s = await getJson(`${cfg.url}lawsets/${file}`, cfg);
    lawsets.push(s);
    file = s.previous ? `lawset-${s.previous}.json` : null;
  }
  const current = cur.version || lawsets[0]?.version;
  const latest = {}; // newest pinned version of each law (lawsets are walked newest first)
  for (const s of lawsets) for (const x of s.laws) if (!latest[x.law_id]) latest[x.law_id] = x.version;
  const ids = Object.keys(latest);
  // laws/<id>.json is the law's current file on the ref (it may be newer than any lawset: an unreleased version).
  const curDocs = await pool(ids, 8, id => getJson(`${cfg.url}laws/${safeId(id)}.json`, cfg, { optional: true }));
  const byKey = {}, wanted = new Map(), currentKeys = [];
  ids.forEach((id, i) => { const d = curDocs[i]; if (!d) return; const k = `${id}@${d.version}`; byKey[k] = d; wanted.set(k, `${cfg.url}laws/${safeId(id)}.json`); currentKeys.push(k); });
  const missing = [];
  for (const s of lawsets) for (const x of s.laws) { const k = `${x.law_id}@${x.version}`; if (!(k in byKey) && !missing.includes(k)) missing.push(k); }
  const old = await pool(missing, 8, k => { const [id, v] = [k.slice(0, k.lastIndexOf('@')), k.slice(k.lastIndexOf('@') + 1)];
    const u = `${cfg.url}law-versions/${safeId(id)}@${safeId(v)}.json`; wanted.set(k, u); return getJson(u, cfg, { optional: true }); });
  missing.forEach((k, i) => { byKey[k] = old[i]; });
  const md = await getJson(cfg.url + 'CHANGELOG.md', cfg, { text: true, optional: true }).catch(() => null);
  return assemble({ lawsets, current, byKey, wanted, currentKeys, changes: md ? changesFeed(parseLawsetChangelog(md), lawsets) : null, full: false });
}

function assemble({ lawsets, current, byKey, wanted, currentKeys, changes, full }) {
  let verified = 0;
  const files = new Set();
  for (const s of lawsets) for (const x of s.laws) {
    const k = `${x.law_id}@${x.version}`;
    if (verifyPinned(byKey[k], x, { lawset: s.version, url: wanted.get(k) })) { verified++; files.add(k); }
  }
  const pinned = new Set(lawsets.flatMap(s => s.laws.map(x => `${x.law_id}@${x.version}`)));
  const cons = exists(R('lean', 'constraints.json')) ? readJson(R('lean', 'constraints.json')).constraints : [];
  const curSet = new Set(currentKeys);
  const laws = [], versions = {};
  for (const [k, d] of Object.entries(byKey)) {
    if (!d) continue;
    const entry = { ...d, label: d.label || shortLabel(d.statement_en || d.statement) || d.law_id, constraints: d.constraints || [],
                    origin: wanted.get(k) || k, remote_integrity: pinned.has(k) ? 'verified' : 'unpinned' };
    if (curSet.has(k)) laws.push(entry); else versions[k] = { ...entry, archived: true };
  }
  laws.sort((a, b) => a.law_id.localeCompare(b.law_id));
  const ls = lawsets.map(s => ({ ...s, laws: s.laws.map(({ law_id, version, content_hash, status, kind }) => ({ law_id, version, content_hash, status, kind })) }))
                    .sort((a, b) => semverKey(a.version).localeCompare(semverKey(b.version)));
  return { reg: { origin: 'registry', laws, lawsets: ls, current, constraints: cons, versions, full_docs: full },
           laws_verified: files.size, pins_verified: verified, unpinned: laws.filter(l => l.remote_integrity === 'unpinned').map(l => l.law_id), changes };
}

async function refreshRemote(cfg) {
  remote.stats.checks++;
  try {
    const snap = cfg.mode === 'mirror' ? await fetchMirror(cfg) : await fetchGithub(cfg);
    const now = new Date().toISOString();
    const prev = remote.good;
    const sig = JSON.stringify([snap.reg.current, snap.reg.lawsets.map(s => [s.version, s.laws.map(x => `${x.content_hash}:${x.status}`)]),
                                snap.reg.laws.map(l => [l.law_id, l.version, l.status])]);
    const same = !!prev && prev.sig === sig;
    remote.good = { ...snap, sig, lawset_version: snap.reg.current, fetched_at: same ? prev.fetched_at : now, checked_at: now,
                    previous_lawset_version: same ? prev.previous_lawset_version : prev?.lawset_version ?? null };
    if (!same) remote.stats.swaps++;
    remote.stats.ok++;
    remote.last_error = null;
  } catch (e) {
    const at = new Date().toISOString();
    const kept = remote.good?.lawset_version ? `remote lawset ${remote.good.lawset_version} (last good)` : 'local files';
    if (e instanceof Rejected) { remote.stats.rejected++; remote.last_rejection = { at, reason: e.message, ...(e.detail || {}), kept }; }
    else remote.stats.failed++;
    remote.last_error = { at, message: e.message, kept };
  } finally {
    remote.checked_ms = Date.now();
  }
}

// Called by the tool layer before each lean_* call. Cheap while the TTL has not expired, and never throws.
export async function ensureFresh({ force = false } = {}) {
  const cfg = remoteConfig();
  const key = `${cfg.mode}|${cfg.url}`;
  if (remote.key !== key) resetRemote(key);
  if (cfg.mode === 'off') return sourceInfo();
  const due = !remote.checked_ms || Date.now() - remote.checked_ms >= cfg.ttl_ms;
  // A forced check (lean_source_status with refresh:true) is still limited to one per 30 s.
  if (due || (force && Date.now() - remote.checked_ms >= 30_000)) {
    remote.inflight ||= refreshRemote(cfg).finally(() => { remote.inflight = null; });
    await remote.inflight;
  }
  return sourceInfo();
}

function usingRemote() {
  const cfg = remoteConfig();
  return cfg.mode !== 'off' && !!remote.good && remote.key === `${cfg.mode}|${cfg.url}`;
}
export const remoteSnapshot = () => (usingRemote() ? remote.good.reg : null);

// The fields every lean_* envelope carries: where the laws came from, which lawset is current, and when.
export function sourceInfo() {
  const cfg = remoteConfig();
  if (usingRemote()) {
    return { source: `remote:${cfg.mode}`, lawset_version: remote.good.lawset_version, fetched_at: remote.good.fetched_at,
             checked_at: remote.good.checked_at, url: cfg.url, ...(cfg.ref ? { ref: cfg.ref } : {}),
             integrity: `verified: ${remote.good.laws_verified} law files, ${remote.good.pins_verified} pins across ${remote.good.reg.lawsets.length} lawsets, all match content_hash`,
             ...(remote.last_error ? { remote_error: remote.last_error.message } : {}) };
  }
  const reg = load({ local: true });
  return { source: cfg.mode === 'off' ? 'local' : 'local-fallback', lawset_version: reg.current, fetched_at: localLoadedAt,
           ...(cfg.mode !== 'off' ? { url: cfg.url, remote_error: remote.last_error?.message ?? 'not fetched yet' } : {}) };
}

// lean_source_status: the full picture.
export function sourceStatus() {
  const cfg = remoteConfig();
  let local;
  try { const r = load({ local: true }); local = { origin: r.origin, lawset_version: r.current, lawsets: r.lawsets.map(s => s.version), laws: r.laws.length, loaded_at: localLoadedAt }; }
  catch (e) { local = { error: e.message }; }
  return {
    ...sourceInfo(),
    mode: cfg.mode,
    mode_reason: cfg.invalid ? `LEANBIO_REMOTE="${cfg.invalid}" is not one of ${REMOTE_MODES.join('|')}; using off`
      : cfg.asked ? `LEANBIO_REMOTE=${cfg.asked}` : cfg.hosted ? 'default for the hosted server (DELPHI_HTTP_PORT set): mirror' : 'default for local use: off (local files first)',
    ttl_s: cfg.ttl_ms / 1000,
    ...(cfg.mode !== 'off' ? {
      remote: {
        url: cfg.url, ...(cfg.ref ? { ref: cfg.ref, repo: cfg.repo } : {}),
        lawset_version: remote.good?.lawset_version ?? null,
        previous_lawset_version: remote.good?.previous_lawset_version ?? null,
        lawsets: remote.good?.reg.lawsets.map(s => s.version) ?? [],
        laws: remote.good?.reg.laws.length ?? 0,
        laws_verified: remote.good?.laws_verified ?? 0,
        pins_verified: remote.good?.pins_verified ?? 0,
        unpinned_laws: remote.good?.unpinned ?? [],
        fetched_at: remote.good?.fetched_at ?? null,
        checked_at: remote.good?.checked_at ?? null,
        next_check_at: remote.checked_ms ? new Date(remote.checked_ms + cfg.ttl_ms).toISOString() : null,
        last_error: remote.last_error,
        last_rejection: remote.last_rejection,
        stats: { ...remote.stats },
      },
    } : {}),
    local,
    evaluator: 'lean_check evaluates with lean/eliminate/browser-check.mjs as shipped in this deployment; the remote source changes which laws, versions and statuses apply, not the evaluator code.',
  };
}

// ── changes feed (lawset CHANGELOG + the lawset pins) ──────────────────────
// lean/registry/CHANGELOG.md: "## <version> (<date>)", a prose paragraph, then "### <Section>" with "- " bullets.
export function parseLawsetChangelog(md) {
  const out = [];
  let cur = null, section = null;
  for (const line of String(md).replace(/\r\n/g, '\n').split('\n')) {
    let m;
    if ((m = /^##\s+(\d+\.\d+\.\d+\S*)\s*(?:\(([^)]*)\))?/.exec(line))) { cur = { version: m[1], date: m[2] || null, summary: '', changes: [] }; section = null; out.push(cur); continue; }
    if (!cur) continue;
    if ((m = /^###\s+(.+)/.exec(line))) { section = m[1].trim(); continue; }
    if ((m = /^\s*-\s+(.+)/.exec(line)) && section) {
      const text = m[1].trim();
      const id = /`([^`]+)`/.exec(text)?.[1] ?? null;
      const arrow = /(\S+)\s*->\s*(\S+)/.exec(text.replace(/`[^`]+`/, ''));
      cur.changes.push({ section, text: text.replace(/`/g, ''), ...(id ? { law_id: id } : {}), ...(arrow ? { from: arrow[1], to: arrow[2] } : {}) });
      continue;
    }
    if (!section && line.trim()) cur.summary += (cur.summary ? ' ' : '') + line.trim();
  }
  return out;
}

// Machine diff between consecutive lawsets: added, removed, version changes, status changes.
export function lawsetDiff(prev, next) {
  const a = Object.fromEntries((prev?.laws || []).map(x => [x.law_id, x]));
  const b = Object.fromEntries((next?.laws || []).map(x => [x.law_id, x]));
  const d = { added: [], removed: [], version: [], status: [] };
  for (const [id, x] of Object.entries(b)) {
    if (!a[id]) d.added.push({ law_id: id, version: x.version, status: x.status ?? null });
    else {
      if (a[id].version !== x.version) d.version.push({ law_id: id, from: a[id].version, to: x.version });
      if ((a[id].status ?? null) !== (x.status ?? null)) d.status.push({ law_id: id, from: a[id].status ?? null, to: x.status ?? null });
    }
  }
  for (const id of Object.keys(a)) if (!b[id]) d.removed.push({ law_id: id, version: a[id].version });
  return d;
}

// The feed served at /api/lean/changes.json (newest first). Deterministic: no generation timestamp.
export function changesFeed(entries, lawsets) {
  const sorted = [...lawsets].sort((x, y) => semverKey(x.version).localeCompare(semverKey(y.version)));
  const byV = Object.fromEntries(entries.map(e => [e.version, e]));
  const items = sorted.map((s, i) => {
    const e = byV[s.version];
    return { version: s.version, date: e?.date || (s.created ? String(s.created).slice(0, 10) : null), previous: s.previous ?? sorted[i - 1]?.version ?? null,
             title: shortLabel(e?.summary || s.note || '') || `lawset ${s.version}`, summary: e?.summary || s.note || null,
             changes: e?.changes || [], diff: lawsetDiff(sorted[i - 1], s), href: `lawsets/${safeId(s.version)}.json` };
  }).reverse();
  const unreleased = entries.filter(e => !sorted.some(s => s.version === e.version)).map(e => e.version);
  return { feed: 'delphisci LeanBio lawset changes', version: 1, current_lawset: items[0]?.version ?? null,
           generated_from: 'lean/registry/CHANGELOG.md (prose and bullets) + lean/registry/lawsets/lawset-*.json (diff)',
           ...(unreleased.length ? { changelog_versions_without_lawset: unreleased } : {}), entries: items };
}

const safeId = id => String(id).replace(/[^A-Za-z0-9._-]/g, '_');
const semverGt = (a, b) => semverKey(a).localeCompare(semverKey(b)) > 0;

// lean_changes: lawset releases after `since` (exclusive), newest first.
export function getChanges(since = null) {
  const reg = load();
  if (since && since !== 'current' && !/^\d+\.\d+\.\d+/.test(since)) throw new Error(`since must be a lawset version like 1.3.0, or "current" (got "${since}")`);
  let feed = usingRemote() ? remote.good.changes : null;
  if (!feed) {
    const md = !usingRemote() && exists(path.join(REGISTRY_DIR, 'CHANGELOG.md')) ? fs.readFileSync(path.join(REGISTRY_DIR, 'CHANGELOG.md'), 'utf8') : '';
    feed = changesFeed(parseLawsetChangelog(md), reg.lawsets);
  }
  const s = since === 'current' ? reg.current : since;
  const entries = s ? feed.entries.filter(e => semverGt(e.version, s)) : feed.entries;
  return { current_lawset: reg.current, since: s || null, up_to_date: !!s && entries.length === 0, count: entries.length,
           generated_from: feed.generated_from, entries };
}
