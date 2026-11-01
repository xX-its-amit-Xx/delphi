#!/usr/bin/env node
// browser-check-declared.test: the declarative evaluator, the one thing that lets a NEW law bind without a
// code edit. Run after lean/eliminate/build-browser-check.mjs.
//
//   node lean/eliminate/browser-check-declared.test.mjs
//
// It tests the parser, the evaluator, the missing-input rule and the reference-table lookup against the
// generated lean/eliminate/browser-check.mjs, plus whatever declarative blocks the registry currently holds.
import assert from 'node:assert/strict';
import { declParse, declEval, declLookup, DECLARED, checkDeclared, CONSTRAINT_LAW } from './browser-check.mjs';

let failed = 0;
const t = (name, fn) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n       ${e.message.split('\n')[0]}`); } };
const ev = (src, env) => declEval(declParse(src).tree, env);

t('arithmetic, precedence and functions', () => {
  assert.equal(ev('1 + 2 * 3', {}), 7);
  assert.equal(ev('(1 + 2) * 3', {}), 9);
  assert.equal(ev('2 ^ 3 ^ 2', {}), 512, 'exponentiation is right-associative');
  assert.equal(ev('-2 ^ 2', {}), -4, 'unary minus binds looser than ^');
  assert.equal(ev('1e6 * SL_m ^ 3', { SL_m: 0.04 }), 64.00000000000001);
  assert.equal(ev('sqrt(Du * Dv)', { Du: 2, Dv: 8 }), 4);
  assert.equal(ev('max(a, b, 3)', { a: 1, b: 2 }), 3);
  assert.equal(ev('abs(0 - x)', { x: 5 }), 5);
});

t('an identifier with no value yields null, never 0 or NaN', () => {
  assert.equal(ev('mass_kg', {}), null);
  assert.equal(ev('mass_kg * 2', {}), null, 'null must propagate, so a missing input cannot become a bound');
  assert.equal(ev('mass_kg', { mass_kg: 'heavy' }), null, 'a non-number is missing, not coerced');
  assert.equal(ev('mass_kg', { mass_kg: NaN }), null);
  assert.equal(ev('1 / 0', {}), null, 'a non-finite result is missing, not Infinity');
});

t('the expression grammar is closed: no eval, no property access, no unknown call', () => {
  for (const bad of ['process.exit(1)', 'a[0]', 'fetch("x")', 'a; b', '1 + ', 'f(1)', '`x`', 'a => a', 'a.b', '{}']) {
    assert.throws(() => declParse(bad), undefined, `"${bad}" must be rejected by the parser`);
  }
  // a bare identifier is only ever a spec field: one that happens to name a global or a prototype member
  // must read as MISSING, not reach into anything.
  for (const name of ['globalThis', 'constructor', 'toString', 'hasOwnProperty', '__proto__', 'process'])
    assert.equal(ev(name, {}), null, `"${name}" must read as missing`);
});

t('a reference table resolves by the design field, and a fallback is labelled as one', () => {
  const k = { name: 'Linf_m', match: 'taxon', unit: 'm', select: 'max', table: { 'Hirundichthys affinis': 0.216, 'Cheilopogon nigricans': 0.2 },
    rows_used: { 'Hirundichthys affinis': { locator: 'autoctr 4651' } }, aliases: { 'flying-fish': 'Hirundichthys affinis' },
    fallback_key: 'Hirundichthys affinis', source: { file: 'development/growth.json' } };
  assert.equal(declLookup(k, { taxon: 'Cheilopogon nigricans' }).value, 0.2);
  assert.equal(declLookup(k, { taxon: 'Cheilopogon nigricans' }).fallback, false);
  assert.equal(declLookup(k, { taxon: 'hirundichthys AFFINIS' }).key, 'Hirundichthys affinis', 'case-insensitive match');
  assert.equal(declLookup(k, { taxon: 'flying-fish' }).key, 'Hirundichthys affinis', 'explicit alias');
  const fb = declLookup(k, { taxon: 'Danio rerio' });
  assert.equal(fb.fallback, true, 'an unmatched taxon must fall back only when the block says so, and say that it did');
  assert.match(fb.matched_on, /no row for taxon = Danio rerio/);
  assert.equal(declLookup({ ...k, fallback_key: null }, { taxon: 'Danio rerio' }), null, 'with no fallback_key an unmatched taxon is MISSING, never substituted');
  assert.equal(declLookup(k, {}).fallback, true);
});

t('every declarative block in the registry is wired to its law and emits a row', () => {
  for (const d of DECLARED) {
    assert.ok(d.law_id, 'a block must carry its law_id');
    assert.equal(CONSTRAINT_LAW[d.constraint], d.law_id, `row ${d.constraint} must be attributed to ${d.law_id}`);
    assert.ok(d.relation && d.note, `${d.law_id}: relation and note are required prose`);
  }
  const rows = checkDeclared({}, {});
  assert.equal(rows.length, DECLARED.length, 'one row per declarative block, always, even with an empty design');
  for (const r of rows) {
    assert.equal(r.declared, true);
    assert.ok(['cannot-evaluate', 'holds', 'violated'].includes(r.verdict), `${r.id}: ${r.verdict}`);
    if (r.verdict === 'cannot-evaluate') assert.ok(r.missing.length, `${r.id}: cannot-evaluate must name what is missing`);
  }
});

t('a declarative row reports holds / violated / cannot-evaluate on the same relation', () => {
  const d = DECLARED.find(x => x.constraint === 'TL1');
  if (!d) { console.log('     (skipped: the TL1 loop-test law is not in the registry right now)'); return; }
  const at = s => checkDeclared(s, {}).find(r => r.id === 'TL1');
  assert.equal(at({ SL_m: 0.04, mass_kg: 0.0009 }).verdict, 'holds');
  assert.equal(at({ SL_m: 0.04, mass_kg: 1e9 }).verdict, 'violated');
  assert.equal(at({ SL_m: 0.04 }).verdict, 'cannot-evaluate');
  assert.deepEqual(at({ SL_m: 0.04 }).missing, ['mass_kg'], 'the row must name the input it lacked');
  assert.equal(at({ SL_m: 0.04, mass_kg: 1e9 }).numbers.bound, 64.00000000000001, 'the bound it was judged against is reported');
});

console.log(failed ? `\n${failed} assertion(s) failed.` : `\nall assertions passed (${DECLARED.length} declarative block(s) in the registry).`);
process.exit(failed ? 1 : 0);
