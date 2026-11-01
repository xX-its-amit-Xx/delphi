// Shared helpers for the LeanBio law debate. No network here; no registry writes here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEBATE_DIR = path.resolve(import.meta.dirname);
export const ROOT = path.resolve(DEBATE_DIR, '..', '..', '..');
export const R = (...p) => path.join(ROOT, ...p);
export const D = (...p) => path.join(DEBATE_DIR, ...p);

export const sha256 = s => crypto.createHash('sha256').update(String(s).replace(/\r\n/g, '\n')).digest('hex');
export const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
export const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1) + '\n'); };
export const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------- the criteria lock
export const CRITERIA_FILE = D('CRITERIA.md');
export const LOCK_FILE = D('criteria.lock.json');
export const CRITERIA_VERSION = 'leanbio-debate-criteria/1.2.0';

export function criteriaHash() { return sha256(fs.readFileSync(CRITERIA_FILE, 'utf8')); }

/** Write the lock. Refuses to overwrite a lock for the same version with a different hash: the criteria are fixed
 *  before any debate runs, so a changed file means a new version, not a silent re-lock. */
export function writeLock({ force = false } = {}) {
  const hash = criteriaHash();
  if (fs.existsSync(LOCK_FILE) && !force) {
    const old = readJson(LOCK_FILE);
    if (old.version === CRITERIA_VERSION && old.criteria_sha256 !== hash) {
      throw new Error(`CRITERIA.md changed under locked version ${CRITERIA_VERSION}\n  locked: ${old.criteria_sha256}\n  now:    ${hash}\nBump CRITERIA_VERSION and re-lock, or restore the file. Rulings are never re-scored silently.`);
    }
    if (old.criteria_sha256 === hash) return old;
  }
  const prior = fs.existsSync(LOCK_FILE) ? readJson(LOCK_FILE) : null;
  const lock = { version: CRITERIA_VERSION, criteria_file: 'pipeline/leanbio/debate/CRITERIA.md', criteria_sha256: hash,
    locked_at: nowIso(), locked_before_any_debate: !fs.existsSync(D('out', 'rulings.json')),
    superseded: prior ? [{ version: prior.version, criteria_sha256: prior.criteria_sha256, locked_at: prior.locked_at,
      rulings_decided_under_it: fs.existsSync(D('out', 'rulings.json')) ? 'see out/rulings.json, which records the hash each ruling used' : 0 },
      ...(prior.superseded || [])] : [],
    note: 'The referee criteria were fixed and hashed before any debate ran. Every ruling records this hash.' };
  writeJson(LOCK_FILE, lock);
  return lock;
}

/** Read the lock and verify CRITERIA.md still hashes to it. Every entry point calls this first. */
export function requireLock() {
  if (!fs.existsSync(LOCK_FILE)) throw new Error('no criteria.lock.json: run `node pipeline/leanbio/debate/debate.mjs --lock` before any debate');
  const lock = readJson(LOCK_FILE);
  const hash = criteriaHash();
  if (hash !== lock.criteria_sha256) {
    throw new Error(`CRITERIA.md does not match the lock (locked ${lock.criteria_sha256.slice(0, 16)}..., now ${hash.slice(0, 16)}...). The criteria are fixed before the debate; fix the file or bump the version.`);
  }
  return lock;
}

// ---------------------------------------------------------------- atoms: a tiny evaluator for Lean inequalities
// The candidates' shared_scope.atoms are inequalities over `q.<quantity>` with decimal literals and the operators
// + - * / ^ and <= < >= > =. That is a small enough language to evaluate exactly, which is what C1 and C6 need: the
// generated browser-check only knows laws already in the registry, so a brand-new candidate has no row there.
const TOKEN = /\s*(\d+\.?\d*(?:[eE][+-]?\d+)?|q\.[A-Za-z_]\w*|[A-Za-z_]\w*|≤|≥|<=|>=|≠|!=|[-+*/^()<>=,])/y;

export function atomQuantities(atom) {
  return [...new Set([...String(atom).matchAll(/q\.([A-Za-z_]\w*)/g)].map(m => m[1]))];
}

/** Evaluate one atom for an assignment. Returns true | false | null (null = cannot evaluate). */
export function evalAtom(atom, q) {
  let src = String(atom).replace(/\s+/g, ' ').trim();
  // Lean sugar we accept: unicode relations, Real.sqrt, Real.log, |x|, (x : ℝ) ascriptions.
  src = src.replace(/\(\s*([^()]*?)\s*:\s*ℝ\s*\)/g, '($1)').replace(/Real\.(sqrt|log|exp|abs)/g, 'Math.$1')
           .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=').replace(/\^/g, '**')
           .replace(/\bq\.([A-Za-z_]\w*)/g, 'Q["$1"]');
  // A bare `=` between two expressions is Lean equality, not assignment.
  src = src.replace(/([^<>!=])=([^=])/g, '$1==$2');
  // Chained comparison `a <= b <= c` (Lean writes these): split into a conjunction.
  const chain = /^(.+?)(<=|<|>=|>)(.+?)(<=|<|>=|>)(.+)$/.exec(src);
  if (chain) {
    const a = evalExprCmp(`${chain[1]}${chain[2]}${chain[3]}`, q);
    const b = evalExprCmp(`${chain[3]}${chain[4]}${chain[5]}`, q);
    return a === null || b === null ? null : (a && b);
  }
  return evalExprCmp(src, q);
}

function evalExprCmp(src, q) {
  if (/[^0-9A-Za-z_."'\[\]{}\s()+\-*/<>=!&|,.]/.test(src.replace(/\*\*/g, ''))) return null; // unknown Lean syntax
  if (/\b(?!Math|Q|true|false|abs|sqrt|log|exp|min|max|pow)[A-Za-z_]\w*\b/.test(src.replace(/Q\["\w+"\]/g, ''))) return null; // a free symbol we do not know
  const names = [...src.matchAll(/Q\["(\w+)"\]/g)].map(m => m[1]);
  for (const n of names) if (!(n in q) || q[n] == null || !Number.isFinite(Number(q[n]))) return null;
  try {
    // eslint-disable-next-line no-new-func
    const f = new Function('Q', 'Math', `"use strict"; return (${src});`);
    const v = f(Object.fromEntries(Object.entries(q).map(([k, x]) => [k, Number(x)])), Math);
    return typeof v === 'boolean' ? v : null;
  } catch { return null; }
}

/** Evaluate a conjunction of atoms. {verdict: 'holds'|'violated'|'cannot-evaluate', per: [...]} */
export function evalAtoms(atoms, q) {
  const per = (atoms || []).map(a => ({ atom: a, value: evalAtom(a, q), quantities: atomQuantities(a) }));
  if (!per.length) return { verdict: 'cannot-evaluate', per, why: 'the candidate declares no shared_scope.atoms, so nothing can be evaluated against an organism' };
  if (per.some(p => p.value === false)) return { verdict: 'violated', per, why: 'at least one atom is false' };
  if (per.some(p => p.value === null)) return { verdict: 'cannot-evaluate', per, why: 'at least one atom could not be evaluated (missing quantity or syntax outside the evaluator)' };
  return { verdict: 'holds', per, why: 'every atom is true' };
}

// ---------------------------------------------------------------- numeric literals in a statement
const STRUCTURAL = new Set(['0', '1', '2', '0.0', '1.0', '2.0', '3', '100']);

/** Every decimal literal in a statement that is not structural. Used by C2. */
export function statementConstants(text) {
  const out = new Map();
  for (const m of String(text || '').matchAll(/(?<![\w.])(\d+\.?\d*(?:[eE][+-]?\d+)?)(?![\w.])/g)) {
    const raw = m[1];
    if (STRUCTURAL.has(raw)) continue;
    out.set(raw, (out.get(raw) || 0) + 1);
  }
  return [...out.keys()];
}

// ---------------------------------------------------------------- scope
/** Does a taxon label sit inside a scope's taxa list? Uses the repo's taxon strings, with a small ancestry table. */
const ANCESTRY = {
  'Cypselurus hiraii': ['Cypselurus', 'Exocoetidae', 'Beloniformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Cheilopogon atrisignis': ['Cheilopogon', 'Exocoetidae', 'Beloniformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Hirundichthys affinis': ['Hirundichthys', 'Exocoetidae', 'Beloniformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Exocoetus volitans': ['Exocoetus', 'Exocoetidae', 'Beloniformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Danio rerio': ['Danio', 'Cyprinidae', 'Cypriniformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Glaucomys sabrinus': ['Glaucomys', 'Sciuridae', 'Pteromyini', 'Rodentia', 'Mammalia', 'Chordata'],
  'Galeopterus variegatus': ['Cynocephalidae', 'Dermoptera', 'Mammalia', 'Chordata'],
  'Pseudoliparis sp.': ['Liparidae', 'Scorpaeniformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Pleuronectes platessa': ['Pleuronectes', 'Pleuronectidae', 'Pleuronectiformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Cheilopogon heterurus doederleini': ['Cheilopogon heterurus', 'Cheilopogon', 'Exocoetidae', 'Beloniformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Cheilopogon unicolor': ['Cheilopogon', 'Exocoetidae', 'Beloniformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Cypselurus poecilopterus': ['Cypselurus', 'Exocoetidae', 'Beloniformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Hirundichthys oxycephalus': ['Hirundichthys', 'Exocoetidae', 'Beloniformes', 'Teleostei', 'Actinopterygii', 'Chordata'],
  'Galeopterus variegatus': ['Galeopterus', 'Cynocephalidae', 'Dermoptera', 'Mammalia', 'Chordata'],
  'Glossophaga soricina': ['Glossophaga', 'Phyllostomidae', 'Chiroptera', 'Mammalia', 'Chordata'],
  'Leptonycteris yerbabuenae': ['Leptonycteris', 'Phyllostomidae', 'Chiroptera', 'Mammalia', 'Chordata'],
  'Plecotus auritus': ['Plecotus', 'Vespertilionidae', 'Chiroptera', 'Mammalia', 'Chordata'],
  'Tadarida brasiliensis': ['Tadarida', 'Molossidae', 'Chiroptera', 'Mammalia', 'Chordata'],
  'Episyrphus balteatus': ['Episyrphus', 'Syrphidae', 'Diptera', 'Insecta', 'Arthropoda'],
  'Eristalis pertinax': ['Eristalis', 'Syrphidae', 'Diptera', 'Insecta', 'Arthropoda'],
  'Syrphus ribesii': ['Syrphus', 'Syrphidae', 'Diptera', 'Insecta', 'Arthropoda'],
};
export function taxonLineage(taxon) { return [taxon, ...(ANCESTRY[taxon] || [])]; }
export function inScope(taxon, scope) {
  const taxa = scope?.taxa || [];
  if (!taxa.length) return true; // an empty taxa list means "every organism" - C3 judges whether that is honest
  const lin = taxonLineage(taxon).map(x => x.toLowerCase());
  return taxa.some(t => lin.includes(String(t).toLowerCase()));
}

// ---------------------------------------------------------------- held-out clade guard (no Aves)
// The roster lives in holdout/; this folder names no held-out organism. Any candidate, source or organism whose text
// touches the roster is dropped before it is debated.
export function holdoutRoster() {
  for (const f of ['holdout/roster.json', 'holdout/holdout.json', 'holdout/exam.json']) {
    const p = R(f);
    if (!fs.existsSync(p)) continue;
    try {
      const j = readJson(p);
      const terms = new Set();
      const walk = v => {
        if (typeof v === 'string') { if (/^[A-Z][A-Za-z ().-]{2,60}$/.test(v)) terms.add(v); return; }
        if (Array.isArray(v)) return v.forEach(walk);
        if (v && typeof v === 'object') return Object.values(v).forEach(walk);
      };
      walk(j.clade ?? j);
      if (terms.size) return { file: f, terms: [...terms] };
    } catch { /* fall through */ }
  }
  return { file: null, terms: ['Aves', 'bird', 'birds', 'avian'] };
}
const HOLDOUT_RE = /\b(aves|avian|bird|birds|neornithes|passerin\w*|columbiform\w*|anseriform\w*|galliform\w*|apodiform\w*|hummingbird\w*|pigeon|sparrow|starling|goose|geese|duck|swift)\b/i;
export function touchesHoldout(text) {
  const t = String(text || '');
  if (HOLDOUT_RE.test(t)) return HOLDOUT_RE.exec(t)[0];
  const { terms } = holdoutRoster();
  for (const term of terms) if (term.length > 3 && new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t)) return term;
  return null;
}
