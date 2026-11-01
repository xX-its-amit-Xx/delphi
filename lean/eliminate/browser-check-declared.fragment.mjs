// FRAGMENT spliced into lean/eliminate/browser-check.mjs by lean/eliminate/build-browser-check.mjs.
// Real JavaScript so it can be syntax-checked on its own; not a module on its own (it uses `result` and
// KERNEL_NOTE from the generated file). The ONE placeholder, named for the constant it fills, is the set of
// DECLARED checks read out of lean/registry/laws/*.json at generation time.
//
// WHY THIS EXISTS. Every other row in browser-check.mjs is a hand-written formula keyed by a constraint id in
// the generator's `USED` list. That means a law accepted into the registry whose constraint id is not in that
// list produces NO row: it is invisible to lean_check, to the Studio's red/amber/grey, to the optimizer's
// rejection rule and to the validation tool, and only shows up in `laws_without_browser_evaluation`, which
// nothing fails on. A living law base cannot require a code edit per law.
//
// So a law file may carry an OPTIONAL `browser_check` block, and this fragment evaluates it. The block is DATA:
// adding a law with one, and releasing a law set, puts a judged row in front of every surface with no code
// change anywhere. The arithmetic is a floating-point evaluation of the relation the law states; it is NOT a
// kernel check and it does not establish the Lean theorem — exactly the same standing as every other row here.
//
// Block shape (lean/registry/README.md "Declarative browser check"):
//   constraint  the row id (required). Must not be a constraint id of lean/constraints.json.
//   quantity    expression for the left-hand side (required), e.g. "gillArea_m2"
//   op          "le" | "lt" | "ge" | "gt" | "eq" | "between" (required)
//   bound       expression for the right-hand side (le/lt/ge/gt/eq), e.g. "k * mass_kg ^ 0.8"
//   lo, hi      expressions for the two ends (op "between")
//   defaults    {name: number} constants the expressions may use
//   inputs      spec fields that must be present; derived from the expressions when omitted
//   relation    one line of human-readable relation text for the row
//   note        one line saying what the row does and does not mean
//   unit        unit of `quantity` (reported, never converted)
//   band        "proved" | "empirical" | "hypothesis" (default "empirical")
//   tolerance   "relative" (default; the ulp tolerance every computed-bound row here uses) or "exact"
//
// Expressions are parsed and evaluated by the tiny arithmetic reader below: numbers, spec fields, `+ - * / ^`,
// parentheses, unary minus and sqrt/abs/log/exp/min/max/pow. There is no `eval`, no property access and no
// call into anything but those functions, so a law file cannot run code in the Studio.

/** The declarative checks read out of the law registry at generation time. */
export const DECLARED = __DECLARED__;

// ── a tiny arithmetic expression reader (no eval) ───────────────────────────
const DECL_FUNCS = {
  sqrt: Math.sqrt, abs: Math.abs, log: Math.log, log10: Math.log10, exp: Math.exp,
  min: Math.min, max: Math.max, pow: Math.pow,
};

/** Tokenise an arithmetic expression. Throws on any character the grammar does not contain. */
function declTokens(src) {
  const out = [];
  const re = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|[+\-*/^(),]))/g;
  let at = 0;
  while (at < src.length) {
    re.lastIndex = at;
    const m = re.exec(src);
    if (!m || m.index !== at) {
      if (!src.slice(at).trim()) break;
      throw new Error(`cannot read "${src.slice(at)}" in expression "${src}"`);
    }
    at = re.lastIndex;
    if (m[1] !== undefined) out.push({ t: 'num', v: +m[1] });
    else if (m[2] !== undefined) out.push({ t: 'name', v: m[2] });
    else out.push({ t: m[3] === '**' ? '^' : m[3] });
  }
  return out;
}

/**
 * Parse one expression into a tree. Precedence: ^ (right) > unary - > * / > + -.
 * Returns {tree, names}: `names` is every identifier the expression reads that is not a function.
 */
export function declParse(src) {
  const ts = declTokens(String(src));
  const names = new Set();
  let i = 0;
  const peek = () => ts[i];
  const eat = t => { if (!ts[i] || ts[i].t !== t) throw new Error(`expected ${t} in "${src}"`); return ts[i++]; };
  function primary() {
    const tk = peek();
    if (!tk) throw new Error(`expression "${src}" ends early`);
    if (tk.t === 'num') { i++; return { k: 'num', v: tk.v }; }
    if (tk.t === '-') { i++; return { k: 'neg', a: unary() }; }
    if (tk.t === '+') { i++; return unary(); }
    if (tk.t === '(') { i++; const e = sum(); eat(')'); return e; }
    if (tk.t === 'name') {
      i++;
      if (peek() && peek().t === '(') {
        if (!Object.prototype.hasOwnProperty.call(DECL_FUNCS, tk.v)) throw new Error(`unknown function "${tk.v}" in "${src}" (allowed: ${Object.keys(DECL_FUNCS).join(', ')})`);
        i++;
        const args = [];
        if (peek() && peek().t !== ')') { args.push(sum()); while (peek() && peek().t === ',') { i++; args.push(sum()); } }
        eat(')');
        return { k: 'call', f: tk.v, args };
      }
      names.add(tk.v);
      return { k: 'name', v: tk.v };
    }
    throw new Error(`unexpected "${tk.t}" in "${src}"`);
  }
  function unary() { const base = primary(); if (peek() && peek().t === '^') { i++; return { k: '^', a: base, b: unary() }; } return base; }
  function product() { let a = unary(); while (peek() && (peek().t === '*' || peek().t === '/')) { const op = ts[i++].t; a = { k: op, a, b: unary() }; } return a; }
  function sum() { let a = product(); while (peek() && (peek().t === '+' || peek().t === '-')) { const op = ts[i++].t; a = { k: op, a, b: product() }; } return a; }
  const tree = sum();
  if (i !== ts.length) throw new Error(`trailing "${ts.slice(i).map(t => t.v ?? t.t).join(' ')}" in "${src}"`);
  return { tree, names: [...names] };
}

/** Evaluate a parsed tree against an environment. Returns a finite number, or null when any input is missing. */
export function declEval(tree, env) {
  const go = n => {
    switch (n.k) {
      case 'num': return n.v;
      // hasOwnProperty, so an identifier that happens to name a prototype member ('constructor',
      // 'toString') reads as missing rather than reaching into the environment object.
      case 'name': { const v = Object.prototype.hasOwnProperty.call(env, n.v) ? env[n.v] : undefined; return typeof v === 'number' && Number.isFinite(v) ? v : null; }
      case 'neg': { const a = go(n.a); return a === null ? null : -a; }
      case 'call': { const as = n.args.map(go); return as.some(x => x === null) ? null : DECL_FUNCS[n.f](...as); }
      default: { const a = go(n.a), b = go(n.b);
        if (a === null || b === null) return null;
        const r = n.k === '+' ? a + b : n.k === '-' ? a - b : n.k === '*' ? a * b : n.k === '/' ? a / b : Math.pow(a, b);
        return Number.isFinite(r) ? r : null; }
    }
  };
  return go(tree);
}

const DECL_OPS = {
  le: { sym: '<=', exact: (x, y) => x <= y },
  lt: { sym: '<', exact: (x, y) => x < y },
  ge: { sym: '>=', exact: (x, y) => x >= y },
  gt: { sym: '>', exact: (x, y) => x > y },
  eq: { sym: '==', exact: (x, y) => x === y },
};

/** Compile one declarative block once. Throws with the law_id on a malformed block (the generator fails loudly). */
export function declCompile(d) {
  const where = `${d.law_id} browser_check`;
  if (!d.constraint) throw new Error(`${where}: constraint id is required`);
  if (d.op !== 'between' && !DECL_OPS[d.op]) throw new Error(`${where}: op "${d.op}" is not one of ${Object.keys(DECL_OPS).join(', ')}, between`);
  const parse = (src, field) => { try { return declParse(src); } catch (e) { throw new Error(`${where}.${field}: ${e.message}`); } };
  const q = parse(d.quantity, 'quantity');
  const parts = [{ key: 'quantity', ...q }];
  if (d.op === 'between') {
    if (d.lo == null || d.hi == null) throw new Error(`${where}: op "between" needs lo and hi`);
    parts.push({ key: 'lo', ...parse(d.lo, 'lo') }, { key: 'hi', ...parse(d.hi, 'hi') });
  } else {
    if (d.bound == null) throw new Error(`${where}: op "${d.op}" needs bound`);
    parts.push({ key: 'bound', ...parse(d.bound, 'bound') });
  }
  const defaults = d.defaults || {};
  for (const [k, v] of Object.entries(defaults)) if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${where}.defaults.${k} is not a finite number`);
  const lookups = d.lookups || [];
  for (const k of lookups) { if (!k.name || !k.table) throw new Error(`${where}.lookups: each lookup needs a name and a resolved table (the generator fills these in)`); }
  const lookupNames = lookups.map(k => k.name);
  const read = [...new Set(parts.flatMap(p => p.names))].filter(n => !(n in defaults) && !lookupNames.includes(n));
  const inputs = d.inputs && d.inputs.length ? d.inputs : read;
  for (const n of inputs) if (!read.includes(n)) throw new Error(`${where}.inputs names "${n}", which no expression reads (or is supplied by a default or a lookup)`);
  for (const n of lookupNames) if (!parts.some(p => p.names.includes(n))) throw new Error(`${where}.lookups declares "${n}", which no expression reads`);
  return { ...d, compiled: Object.fromEntries(parts.map(p => [p.key, p.tree])), defaults, lookups, inputs, reads: read };
}

/**
 * Resolve one embedded reference table against a design. Returns {value, key, fallback, locator} or null.
 *
 * A law may bring its own reference data (lookups in its browser_check block), resolved at generation time into
 * a plain {key: number} table. Which key the design matched is REPORTED in the row, and a fallback is always
 * labelled as one: "which species' number decided this verdict" is part of the verdict, not an implementation
 * detail. Matching is exact, then case-insensitive, then an explicit alias; nothing is inferred from a genus.
 */
export function declLookup(k, design) {
  const want = design && (design[k.match] ?? null);
  const keys = Object.keys(k.table);
  const hit = want == null ? null
    : (k.table[want] !== undefined ? want
      : (k.aliases && k.aliases[want] !== undefined && k.table[k.aliases[want]] !== undefined) ? k.aliases[want]
        : keys.find(x => String(x).toLowerCase() === String(want).toLowerCase()) ?? null);
  if (hit != null) return { value: k.table[hit], key: hit, fallback: false, locator: (k.rows_used[hit] || {}).locator ?? null, matched_on: `${k.match} = ${want}` };
  if (k.fallback_key) return { value: k.table[k.fallback_key], key: k.fallback_key, fallback: true, locator: (k.rows_used[k.fallback_key] || {}).locator ?? null,
    matched_on: want == null ? `the design names no ${k.match}` : `no row for ${k.match} = ${want}` };
  return null;
}

/** Compiled blocks, keyed by constraint id. Built once at module load so a bad block fails the first call, loudly. */
const DECL_COMPILED = Object.fromEntries(DECLARED.map(d => [d.constraint, declCompile(d)]));
/** Which law each declared constraint belongs to (the generator also folds these into CONSTRAINT_LAW). */
export const DECLARED_LAW = Object.fromEntries(DECLARED.map(d => [d.constraint, d.law_id]));

/**
 * Rows for every declarative check. `s` is the normalised spec; `derived` carries the quantities the
 * hand-written rows computed (W_N, S_m2, powerRequired_W, ...) so a declared block may read them too.
 *
 * verdict: 'cannot-evaluate' when any input it reads is absent (the inputs are named in `missing`, which is
 * what the Studio shows instead of a colour), else 'holds' or 'violated'. A declared row NEVER guesses a
 * default for a missing input: an absent number means the law said nothing about this design.
 */
const refNums = r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.value]));

export function checkDeclared(s, derived) {
  const env = { ...(derived || {}), ...s };
  const rows = [];
  for (const d of Object.values(DECL_COMPILED)) {
    const scope = { ...env, ...d.defaults };
    // Reference values the law brings with it, keyed by a design field (usually taxon). A lookup that cannot be
    // resolved is a MISSING input named in the row, never a silent zero and never a quiet default.
    const resolved = {}, lookupMiss = [];
    for (const k of d.lookups) {
      const got = declLookup(k, s);
      if (!got || !(typeof got.value === 'number' && Number.isFinite(got.value))) {
        lookupMiss.push(`${k.name} (no row in ${k.source?.file || 'its reference table'} for ${k.match} = ${JSON.stringify(s[k.match] ?? null)}; ${Object.keys(k.table).length} key(s) available)`);
        continue;
      }
      scope[k.name] = got.value;
      resolved[k.name] = { value: got.value, unit: k.unit, from: k.source?.file ?? null, row: got.key, matched_on: got.matched_on,
        fallback: got.fallback, locator: got.locator, select: k.select, ...(got.fallback ? { fallback_warning: `no row matched this design, so the ${got.key} row was used: the verdict rests on another population's number` } : {}) };
    }
    const miss = [...d.inputs.filter(n => !(typeof scope[n] === 'number' && Number.isFinite(scope[n]))), ...lookupMiss];
    const base = { band: d.band || 'empirical', declared: true, declared_by_law: d.law_id,
      ...(Object.keys(resolved).length ? { reference_values: resolved } : {}),
      lawNote: 'row generated from the law file\'s own `browser_check` block (lean/registry/laws/' + d.law_id + '.json), not from a hand-written formula; the relation is evaluated in floating point and is NOT a kernel check',
      relation: d.relation || null, unit: d.unit || null };
    if (miss.length) { rows.push({ ...result(d.constraint, 'cannot-evaluate', {}, miss, d.note || null), ...base }); continue; }
    const q = declEval(d.compiled.quantity, scope);
    if (q === null) { rows.push({ ...result(d.constraint, 'cannot-evaluate', {}, d.inputs, (d.note ? d.note + ' | ' : '') + 'the quantity expression did not produce a finite number'), ...base }); continue; }
    const exact = d.tolerance === 'exact';
    if (d.op === 'between') {
      const lo = declEval(d.compiled.lo, scope), hi = declEval(d.compiled.hi, scope);
      if (lo === null || hi === null) { rows.push({ ...result(d.constraint, 'cannot-evaluate', { quantity: q }, d.inputs, 'a bound expression did not produce a finite number'), ...base }); continue; }
      const ok = exact ? (q >= lo && q <= hi) : (geTol(q, lo) && leTol(q, hi));
      rows.push({ ...result(d.constraint, ok ? 'holds' : 'violated', { quantity: q, lo, hi, unit: d.unit || null, ...refNums(resolved) }, [], d.note || null,
        { needed: { quantity_between: [lo, hi] }, available: { quantity: q } }), ...base });
      continue;
    }
    const b = declEval(d.compiled.bound, scope);
    if (b === null) { rows.push({ ...result(d.constraint, 'cannot-evaluate', { quantity: q }, d.inputs, 'the bound expression did not produce a finite number'), ...base }); continue; }
    const op = DECL_OPS[d.op];
    const ok = exact ? op.exact(q, b)
      : d.op === 'le' ? leTol(q, b) : d.op === 'ge' ? geTol(q, b)
      : d.op === 'eq' ? (leTol(q, b) && geTol(q, b)) : op.exact(q, b);
    rows.push({ ...result(d.constraint, ok ? 'holds' : 'violated', { quantity: q, bound: b, op: op.sym, unit: d.unit || null, ...refNums(resolved) }, [], d.note || null,
      { needed: { quantity: q }, available: { bound: b } }), ...base });
  }
  return rows;
}
