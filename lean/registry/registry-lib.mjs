// Shared helpers for the law registry: canonical JSON, content hashes, loading laws and law sets, running Lean.
// Layout and schema: lean/registry/README.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REG = path.dirname(fileURLToPath(import.meta.url));
export const LEAN = path.resolve(REG, '..');
export const ROOT = path.resolve(REG, '../..');
export const LAWS_DIR = path.join(REG, 'laws');
export const LAWSETS_DIR = path.join(REG, 'lawsets');
export const STANDARD_AXIOMS = ['propext', 'Classical.choice', 'Quot.sound'];
export const STATUSES = ['proposed', 'candidate', 'accepted', 'contested', 'retired'];

/** Canonical JSON: object keys sorted, no whitespace. */
export function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}
export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

/** The fields a law's content hash covers. Status, approval, history and evidence are deliberately excluded. */
export function hashedView(law) {
  const r = law.lean_ref || {};
  return { law_id: law.law_id, version: law.version, kind: law.kind, class: law.class,
    lean_ref: { module: r.module ?? null, theorem: r.theorem ?? null, structure: r.structure ?? null, statement_sha256: r.statement_sha256 ?? null },
    statement_en: law.statement_en, hypotheses: law.hypotheses ?? [], scope: law.scope ?? null, shared_scope: law.shared_scope ?? null,
    non_vacuity_witness: law.non_vacuity_witness ?? null };
}
export const contentHash = law => sha256(canonical(hashedView(law)));

export function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
export function writeJson(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); }

export function loadLaws(dir = LAWS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => readJson(path.join(dir, f)));
}
export function lawsetPath(version, dir = LAWSETS_DIR) { return path.join(dir, `lawset-${version}.json`); }
export function loadLawset(version, dir = LAWSETS_DIR) { return readJson(lawsetPath(version, dir)); }
export function currentLawset(dir = LAWSETS_DIR) { const c = readJson(path.join(dir, 'current.json')); return loadLawset(c.version, dir); }
export function listLawsets(dir = LAWSETS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map(f => /^lawset-(\d+\.\d+\.\d+)\.json$/.exec(f)).filter(Boolean).map(m => m[1]).sort(semverCmp);
}
export function semverCmp(a, b) { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; }

/** Strip Lean comments (line and nested block) so text checks do not trip on prose. */
export function stripLeanComments(src) {
  src = src.replace(/\r\n/g, '\n');
  let out = '', i = 0, depth = 0;
  while (i < src.length) {
    if (src.startsWith('/-', i)) { depth++; i += 2; continue; }
    if (depth && src.startsWith('-/', i)) { depth--; i += 2; continue; }
    if (depth) { i++; continue; }
    if (src.startsWith('--', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (src[i] === '"') { const j = src.indexOf('"', i + 1); out += src.slice(i, j + 1); i = j + 1; continue; }
    out += src[i++];
  }
  return out;
}

/**
 * The statement text of a declaration in a Lean module: from `theorem|lemma|def|structure <name>` to the
 * proof (`:=`) for theorems and lemmas; for structures and definitions the header line plus the indented lines
 * after it (fields, or the body: for a Prop-valued def the body IS the statement). Whitespace-normalised.
 */
export function statementText(src, fqName) {
  if (!fqName) return null;
  const code = stripLeanComments(src);
  const last = fqName.split('.').pop();
  const parts = fqName.split('.');
  const tail2 = parts.slice(-2).join('\\.');
  const re = new RegExp(`(^|\\n)\\s*(?:@\\[[^\\]]*\\]\\s*)?(?:noncomputable\\s+)?(?:private\\s+)?(theorem|lemma|def|structure|abbrev)\\s+(?:${tail2}|${last.replace(/'/g, "'")})(?=[\\s:({\\[])`, 'g');
  const m = re.exec(code);
  if (!m) return null;
  const start = m.index + m[0].search(/\S/);
  let end;
  if (m[2] === 'structure' || m[2] === 'def' || m[2] === 'abbrev') { // a structure or a definition: the header line plus the indented lines that follow it (the body is the content)
    const nl = code.indexOf('\n', start); end = nl < 0 ? code.length : nl;
    const re2 = /\n([ \t]+\S[^\n]*)/y; re2.lastIndex = end; let mm;
    while ((mm = re2.exec(code))) end = re2.lastIndex;
  }
  else { const p = code.indexOf(':=', start); end = p < 0 ? code.length : p; }
  return code.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function gitHead() { const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; }
export function gitClean(rel) { const r = spawnSync('git', ['status', '--porcelain', '--', rel], { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 && r.stdout.trim() === ''; }

function lakeEnv() {
  const cands = [process.env.ELAN_HOME, path.join(process.env.USERPROFILE || process.env.HOME || '', '.elan'), 'C:/Temp/elan'].filter(Boolean);
  let bin = '';
  for (const c of cands) { const d = path.join(c, 'bin'); if (fs.existsSync(path.join(d, process.platform === 'win32' ? 'lake.exe' : 'lake'))) { bin = d; break; } }
  const env = { ...process.env, PATH: (bin ? bin + path.delimiter : '') + process.env.PATH };
  if (bin && !process.env.ELAN_HOME) env.ELAN_HOME = path.dirname(bin);
  return { env, lake: bin ? path.join(bin, 'lake') : 'lake' };
}

/** Scratch dir for generated Lean files (hot data: local C:, never the near-full D:). */
export function scratchDir(tag) {
  const base = process.env.REGISTRY_SCRATCH || path.join(os.platform() === 'win32' && fs.existsSync('C:/Temp') ? 'C:/Temp' : os.tmpdir(), 'delphi-registry');
  const d = path.join(base, tag + '-' + process.pid + '-' + Date.now().toString(36));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Compile one Lean file with `lake env lean` inside lean/. Returns {ok, code, out}. */
export function leanCheck(file, { timeout = 600000 } = {}) {
  const { env, lake } = lakeEnv();
  const r = spawnSync(lake, ['env', 'lean', file], { cwd: LEAN, env, encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '') + (r.error ? String(r.error) : '');
  const hasError = /(^|\n)[^\n]*:\d+:\d+: error/.test(out) || /error:/.test(out);
  return { ok: r.status === 0 && !hasError, code: r.status, out };
}

/** Parse `#print axioms` output: {decl: [axioms]}. */
export function parseAxioms(out) {
  const res = {};
  for (const m of out.matchAll(/'([^']+)' depends on axioms: \[([^\]]*)\]/g)) res[m[1]] = m[2].split(',').map(s => s.trim()).filter(Boolean);
  for (const m of out.matchAll(/'([^']+)' does not depend on any axioms/g)) res[m[1]] = [];
  return res;
}

/** Taxon containment used for shared scope (a small explicit hierarchy; anything else must match exactly). */
const PARENT = { Exocoetidae: 'Beloniformes', Beloniformes: 'Teleostei', 'Danio rerio': 'Teleostei', Liparidae: 'Teleostei', Teleostei: 'Actinopterygii', Actinopterygii: 'Vertebrata', Vertebrata: 'Metazoa', Metazoa: 'any' };
export function taxonWithin(t, anc) { if (anc === 'any' || t === anc) return true; let x = t; const seen = new Set(); while (PARENT[x] && !seen.has(x)) { seen.add(x); x = PARENT[x]; if (x === anc) return true; } return false; }
export function scopesOverlap(a, b) {
  const ta = (a && a.taxa && a.taxa.length) ? a.taxa : ['any'], tb = (b && b.taxa && b.taxa.length) ? b.taxa : ['any'];
  return ta.some(x => tb.some(y => taxonWithin(x, y) || taxonWithin(y, x)));
}

/**
 * Minimal JSON Schema validator for the subset laws-registry.schema.json uses (type, required, enum, const,
 * properties, items, pattern, minLength, minItems, not, allOf with if/then). Returns a list of error strings.
 */
export function validate(schema, v, at = '$') {
  const errs = [];
  const typeOf = x => x === null ? 'null' : Array.isArray(x) ? 'array' : Number.isInteger(x) ? 'integer' : typeof x;
  const okType = (t, x) => t === typeOf(x) || (t === 'number' && typeof x === 'number') || (t === 'integer' && Number.isInteger(x));
  if (schema.type) { const ts = [].concat(schema.type); if (!ts.some(t => okType(t, v))) { errs.push(`${at}: type ${typeOf(v)} not in ${ts}`); return errs; } }
  if (schema.enum && !schema.enum.includes(v)) errs.push(`${at}: ${JSON.stringify(v)} not in enum`);
  if ('const' in schema && v !== schema.const) errs.push(`${at}: not const ${schema.const}`);
  if (typeof v === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(v)) errs.push(`${at}: does not match ${schema.pattern}`);
    if (schema.minLength && v.length < schema.minLength) errs.push(`${at}: shorter than ${schema.minLength}`);
  }
  if (schema.not && validate(schema.not, v, at).length === 0) errs.push(`${at}: matches a forbidden schema`);
  if (Array.isArray(v)) {
    if (schema.minItems && v.length < schema.minItems) errs.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.items) v.forEach((x, i) => errs.push(...validate(schema.items, x, `${at}[${i}]`)));
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const r of schema.required || []) if (!(r in v)) errs.push(`${at}: missing ${r}`);
    for (const [k, s] of Object.entries(schema.properties || {})) if (k in v) errs.push(...validate(s, v[k], `${at}.${k}`));
  }
  for (const s of schema.allOf || []) {
    if (s.if) { if (validate(s.if, v, at).length === 0 && s.then) errs.push(...validate(s.then, v, at)); }
    else errs.push(...validate(s, v, at));
  }
  return errs;
}

/** Async variant of leanCheck, for running mutants in parallel. */
export async function leanCheckAsync(file, { timeout = 600000 } = {}) {
  const { spawn } = await import('node:child_process');
  const { env, lake } = lakeEnv();
  return new Promise(resolve => {
    const p = spawn(lake, ['env', 'lean', file], { cwd: LEAN, env });
    let out = '';
    const t = setTimeout(() => { p.kill(); out += '\n[timeout]'; }, timeout);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('close', code => { clearTimeout(t); resolve({ ok: code === 0 && !/error:/.test(out), code, out }); });
    p.on('error', e => { clearTimeout(t); resolve({ ok: false, code: -1, out: out + String(e) }); });
  });
}

/** Lines (1-based) carrying an error in Lean output for a given file name. */
export function errorLines(out) {
  const ls = [];
  for (const m of out.matchAll(/:(\d+):(\d+): error/g)) ls.push(+m[1]);
  return ls;
}

/** Superseded law versions are kept, never deleted: lean/registry/law-versions/<law_id>@<version>.json. */
export const LAW_VERSIONS_DIR = path.join(REG, 'law-versions');
/** The law file at an exact version: the current file if it is at that version, else the archived snapshot, else null. */
export function loadLawVersion(lawId, version, { lawsDir = LAWS_DIR, versionsDir = LAW_VERSIONS_DIR } = {}) {
  const cur = path.join(lawsDir, lawId + '.json');
  if (fs.existsSync(cur)) { const l = readJson(cur); if (l.version === version) return l; }
  const snap = path.join(versionsDir, `${lawId}@${version}.json`);
  return fs.existsSync(snap) ? readJson(snap) : null;
}
