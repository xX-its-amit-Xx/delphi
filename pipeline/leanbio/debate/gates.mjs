// The hard gates of CRITERIA.md, decided mechanically. No language model runs here, and none of these functions can
// be overridden by one: the referee may add reasons to a failed gate, never reverse it.
//
//   C1 nonVacuity  - a witness the law satisfies AND an in-range assignment the law REJECTS
//   C2 constants   - every non-structural literal in the statement is in meta.constants with a kind and a source,
//                    and the source actually carries the number (that part is evidence.mjs's GET)
//   C5 consistency - the propose.mjs status the candidate arrived with
//   C6 wildType    - the atoms evaluated against wildtype.json inside the law's own scope
import fs from 'node:fs';
import { D, R, readJson, evalAtoms, evalAtom, atomQuantities, statementConstants, inScope } from './lib.mjs';

export const PROVENANCE_KINDS = ['measured', 'derived', 'cited', 'calibrated', 'assumed'];
const DISQUALIFYING_KINDS = ['calibrated', 'assumed'];

// ---------------------------------------------------------------- C1: non-vacuity and a rejecting design
/** Search the law's own quantity space for an assignment the atoms REJECT, inside the declared ranges.
 *  A law that cannot be made false by any in-range assignment binds nothing, whatever its Lean status. */
export function nonVacuity(cand) {
  const atoms = cand.shared_scope?.atoms || [];
  const quantities = Object.keys(cand.shared_scope?.quantities || {});
  const witnessVals = cand.shared_scope?.witness_values || {};
  const out = { criterion: 'C1', witness_declared: !!cand.lean?.witness, witness_satisfies: null, rejecting_design: null, searched: 0 };

  // No shared scope at all is NOT the same defect as a tautology (CRITERIA.md 1.1.0, C1): the law may be perfectly
  // true and simply unmapped, so the studio has nothing to evaluate. That is `unclear` - it blocks promotion exactly
  // as C6 `unclear` does - and the fix is to name the quantities a design would have to carry.
  if (!atoms.length || !quantities.length) {
    const bca = cand.browser_check_absent || null;
    return { ...out, verdict: 'unclear', provable_but_not_checkable: true,
      missing_inputs: bca?.missing_inputs || null,
      would_constrain_if_supplied: bca?.would_constrain_if_supplied || null,
      why: `the candidate declares ${!atoms.length ? 'no shared_scope.atoms' : 'no shared quantities'}, so the studio has nothing to evaluate and the law binds no design today`
        + (bca ? `. The proposer says so itself (browser_check_absent: ${bca.verdict}${bca.missing_inputs ? `; it would need ${bca.missing_inputs.join(', ')}` : ''})${bca.would_constrain_if_supplied ? `, and that supplied, it would reject: ${bca.would_constrain_if_supplied}` : ''}`
             : '. The proposer did not say whether this is deliberate; declare shared_scope.atoms over quantities a design carries, or declare browser_check_absent with missing_inputs') };
  }
  // (1) the declared witness values must satisfy the atoms (propose.mjs proved a witness compiles; this checks the
  //     numbers the meta file hands the studio are the same ones).
  if (Object.keys(witnessVals).length) {
    const w = evalAtoms(atoms, witnessVals);
    out.witness_satisfies = w.verdict === 'holds';
    out.witness_eval = w;
    if (w.verdict === 'violated') {
      return { ...out, verdict: 'fail', why: `the declared witness_values do not satisfy the law's own atoms (${w.per.filter(p => p.value === false).map(p => p.atom).join('; ')}); the witness and the statement disagree` };
    }
  }
  // (2) search for a rejecting design. Scales are taken from the witness values where given, otherwise from the
  //     declared ranges, otherwise from a wide decade sweep: a law true over ten decades of its own quantities is
  //     not binding anything a designer could reach.
  const ranges = cand.scope?.ranges || {};
  const candidates = [];
  const base = {};
  for (const q of quantities) base[q] = Number(witnessVals[q] ?? midpoint(ranges[q]) ?? 1);
  const FACTORS = [0, 1e-6, 1e-3, 0.1, 0.5, 0.9, 1.1, 2, 10, 1e3, 1e6, -1];
  for (const q of quantities) for (const f of FACTORS) {
    const trial = { ...base };
    trial[q] = f === -1 ? -Math.abs(base[q] || 1) : (base[q] || 1) * f;
    candidates.push(trial);
  }
  // and the all-at-once extremes, which catch laws that only bind a ratio
  for (const f of [1e-6, 1e6]) candidates.push(Object.fromEntries(quantities.map(q => [q, (base[q] || 1) * f])));
  for (const trial of candidates) {
    out.searched++;
    const r = evalAtoms(atoms, trial);
    if (r.verdict === 'violated') {
      out.rejecting_design = { quantities: trial, rejected_by: r.per.filter(p => p.value === false).map(p => p.atom) };
      break;
    }
  }
  if (!out.rejecting_design) {
    return { ...out, verdict: 'fail', why: `no assignment of {${quantities.join(', ')}} out of ${out.searched} tried (including zero, negative and +-10^6 of the witness scale) makes the law false. It is a tautology over its own quantities: it would never turn a design dashed, so it constrains nothing` };
  }
  if (!cand.lean?.witness) {
    return { ...out, verdict: 'fail', why: 'meta.lean.witness names no declaration: propose.mjs requires a non-vacuity witness and this candidate carries none' };
  }
  return { ...out, verdict: 'pass', why: `a witness satisfies the law${out.witness_satisfies === false ? ' (declared witness_values could not be evaluated)' : ''}, and the in-range design ${JSON.stringify(out.rejecting_design.quantities)} is rejected by ${out.rejecting_design.rejected_by.join('; ')}` };
}
function midpoint(r) {
  if (!r) return null;
  if (Array.isArray(r) && r.length === 2 && r.every(Number.isFinite)) return (r[0] + r[1]) / 2;
  if (typeof r === 'object' && Number.isFinite(r.min) && Number.isFinite(r.max)) return (r.min + r.max) / 2;
  return null;
}

// ---------------------------------------------------------------- C2: constants declared with a kind and a source
/** Mechanical half of C2: is every non-structural literal declared, with a kind that is allowed and a source string?
 *  The other half (does the source actually contain the number) is evidence.mjs, which performs a GET. */
export function constantsDeclared(cand) {
  const text = [cand.lean?.statement_text || '', ...(cand.shared_scope?.atoms || [])].join(' \n ');
  const literals = statementConstants(text);
  const declared = cand.constants || [];
  const byValue = new Map(declared.map(c => [String(c.value), c]));
  const rows = literals.map(lit => {
    const c = byValue.get(lit) || declared.find(d => Number(d.value) === Number(lit));
    if (!c) return { value: lit, declared: false, verdict: 'fail', why: `the literal ${lit} appears in the statement but is not in meta.constants: an undeclared constant has no provenance kind and no source` };
    if (!c.kind || !PROVENANCE_KINDS.includes(c.kind)) return { value: lit, declared: true, kind: c.kind ?? null, verdict: 'fail', why: `constant ${lit} has kind ${JSON.stringify(c.kind)}, not one of ${PROVENANCE_KINDS.join('/')}` };
    if (DISQUALIFYING_KINDS.includes(c.kind)) return { value: lit, declared: true, kind: c.kind, verdict: 'fail', why: `constant ${lit} is ${c.kind}: a calibrated number is never a result and an assumed one is a placeholder, so it may not sit inside a law that constrains a design` };
    if (!c.source || String(c.source).trim().length < 8) return { value: lit, declared: true, kind: c.kind, verdict: 'fail', why: `constant ${lit} (${c.kind}) names no retrievable source` };
    return { value: lit, declared: true, kind: c.kind, source: c.source, verdict: 'pass' };
  });
  const failed = rows.filter(r => r.verdict === 'fail');
  return { criterion: 'C2', literals, rows,
    verdict: failed.length ? 'fail' : (literals.length ? 'pass' : 'pass'),
    why: failed.length ? failed.map(r => r.why).join('; ')
      : literals.length ? `all ${literals.length} non-structural constant(s) declared with an allowed kind and a source`
      : 'the statement carries no empirical constant (structural literals only), so there is nothing to source' };
}

// ---------------------------------------------------------------- C5: consistency with the accepted set
export function consistency(cand) {
  const s = cand.propose_status || cand.status || null;
  if (s === 'contested') {
    // contested_with entries may be strings or {law_id, ...} objects depending on who wrote the law file.
    const ids = (cand.contested_with || []).map(x => (typeof x === 'string' ? x : x?.law_id || x?.id || JSON.stringify(x)));
    return { criterion: 'C5', verdict: 'contested', contested_with: ids,
      why: `propose.mjs proved a contradiction with ${ids.join(', ') || 'an accepted law'} in Lean; the accepted law is not demoted and this candidate is not promoted` };
  }
  if (s === 'candidate') return { criterion: 'C5', verdict: 'pass', why: 'propose.mjs constructed a joint witness with every accepted law whose scope overlaps' };
  if (s === 'proposed') return { criterion: 'C5', verdict: 'unclear', why: 'propose.mjs reached status `proposed`: neither a joint witness nor a contradiction was proved, so joint consistency is unknown' };
  // A MISSING status is a metadata gap, not a proved inconsistency. Reporting it as `fail` turned a law whose board
  // task had not been posted yet into a REJECT, which reads as a scientific verdict it has not earned. An unknown
  // status is `unclear`: it blocks promotion and says what is missing. Only a status that propose.mjs itself refused
  // is a fail.
  if (s == null) return { criterion: 'C5', verdict: 'unclear', why: 'the candidate carries no propose.mjs status (no `status_after_propose` in its meta, no board task naming it and no registry entry), so joint consistency with the accepted set is unknown. Run lean/registry/propose.mjs and record the outcome; this is a metadata gap, not an inconsistency' };
  if (['retired', 'rejected', 'refused'].includes(s)) return { criterion: 'C5', verdict: 'fail', why: `the candidate arrived with status ${JSON.stringify(s)}: propose.mjs or a person already refused it, so there is nothing to debate` };
  return { criterion: 'C5', verdict: 'unclear', why: `the candidate arrived with an unrecognised propose.mjs status ${JSON.stringify(s)}; only candidate, proposed or contested can be debated, so joint consistency is unknown` };
}

// ---------------------------------------------------------------- C6: would it have fired on a wild-type organism?
export function wildType(cand, { dossier = null } = {}) {
  const wt = dossier || readJson(D('wildtype.json'));
  const atoms = cand.shared_scope?.atoms || [];
  const needs = [...new Set(atoms.flatMap(atomQuantities))];
  const out = { criterion: 'C6', atoms, needs, dossier_version: wt.version, in_scope: 0, evaluated: 0, fired: [], held: [], skipped: [] };
  // A law with no atoms cannot be evaluated against anything, so it must not read as `pass`. Without this, every
  // organism in scope counted as "evaluated", nothing could fire, and the law collected a free C6 pass - exactly the
  // vacuous pass C6 exists to prevent. (Found 2026-11-01 on development-growth-asymptote, which declares no
  // shared_scope.atoms and was reported as holding for all 24 in-scope organisms.)
  if (!atoms.length) return { ...out, verdict: 'unclear',
    why: 'the candidate declares no shared_scope.atoms, so there is no formula to evaluate against a wild-type organism: C6 is untested, not satisfied' };
  // A law with no atoms cannot be evaluated against anything, so it must not read as `pass`. Without this, every
  // organism in scope counted as "evaluated", nothing could fire, and the law collected a free C6 pass - which is
  // exactly the vacuous pass C6 exists to prevent. (Found 2026-11-01 on development-growth-asymptote, which has no
  // shared_scope.atoms and was reported as holding for all 24 in-scope organisms.)
  if (!atoms.length) return { ...out, verdict: 'unclear',
    why: 'the candidate declares no shared_scope.atoms, so there is no formula to evaluate against a wild-type organism: C6 is untested, not satisfied' };
  // An area-derived quantity cannot be read off a specimen whose fins were folded: that row is not a lifting
  // configuration, and refuting a wing-loading law with it would be dishonest.
  const AREA_DERIVED = new Set(['wingLoading', 'liftingArea', 'CLmax', 'LDmax', 'aspectRatio']);
  const needsArea = needs.some(q => AREA_DERIVED.has(q));
  for (const o of wt.organisms) {
    if (!inScope(o.taxon, cand.scope)) { out.skipped.push({ organism: o.organism, why: 'outside the law\'s declared scope' }); continue; }
    out.in_scope++;
    if (needsArea && o.lifting === false) { out.skipped.push({ organism: o.organism, locator: o.locator, why: `${o.configuration}: an area-derived quantity cannot be read from it` }); continue; }
    const missing = needs.filter(q => !(q in o.quantities));
    if (missing.length) { out.skipped.push({ organism: o.organism, locator: o.locator, why: `lacks ${missing.join(', ')}` }); continue; }
    out.evaluated++;
    const r = evalAtoms(atoms, o.quantities);
    const row = { organism: o.organism, locator: o.locator, source: o.source, quantities: Object.fromEntries(needs.map(q => [q, o.quantities[q]])), verdict: r.verdict,
      failing_atoms: r.per.filter(p => p.value === false).map(p => p.atom) };
    if (r.verdict === 'violated') out.fired.push(row); else if (r.verdict === 'holds') out.held.push(row); else out.skipped.push({ organism: o.organism, why: r.why });
  }
  if (out.fired.length) {
    const f = out.fired[0];
    return { ...out, verdict: 'fail', why: `the law fires on ${out.fired.length} wild-type organism(s) inside its own scope. ${f.organism} (${f.locator}) has ${JSON.stringify(f.quantities)}, which fails ${f.failing_atoms.join('; ')} (${f.source}). A real animal does not violate a law in that law's own scope, so the law is wrong about biology` };
  }
  if (!out.in_scope) return { ...out, verdict: 'unclear', why: `no wild-type organism in ${wt.version} falls inside the scope ${JSON.stringify(cand.scope?.taxa || [])}: the law is untested against any real animal, so it may not be promoted (CRITERIA.md C6)` };
  if (!out.evaluated) return { ...out, verdict: 'unclear', why: `${out.in_scope} wild-type organism(s) are in scope but none carries ${needs.join(', ')}: the law cannot be evaluated against a real animal, so it may not be promoted` };
  return { ...out, verdict: 'pass', why: `the law holds for all ${out.evaluated} wild-type organism(s) in scope that carry ${needs.join(', ')} (${out.held.map(h => h.organism).slice(0, 6).join(', ')})` };
}

// ---------------------------------------------------------------- known open disputes (CRITERIA.md 1.1.0)
/** A candidate that asserts one arm of a question this project holds open is CONTESTED, not promotable. */
export function knownDispute(cand) {
  let doc; try { doc = readJson(D('open-disputes.json')); } catch { return { verdict: 'pass', why: 'no open-disputes.json' }; }
  const hay = JSON.stringify({ s: cand.statement_en, a: cand.shared_scope?.atoms, h: cand.hypotheses, q: cand.shared_scope?.quantities, src: cand.sources, l: cand.label }).toLowerCase();
  const hits = doc.disputes.map(d => ({ id: d.id, question: d.question, arms: d.arms, where: d.where,
    matched: d.keywords.filter(k => hay.includes(String(k).toLowerCase())) })).filter(h => h.matched.length);
  if (!hits.length) return { criterion: 'disputes', verdict: 'pass', why: 'the candidate matches no known open dispute', checked: doc.disputes.map(d => d.id) };
  return { criterion: 'disputes', verdict: 'flag', hits,
    why: `the candidate's text matches ${hits.length} known open dispute(s): ${hits.map(h => `${h.id} (on ${h.matched.join(', ')})`).join('; ')}. If it asserts one arm it is CONTESTED and may not be promoted while the question is open; the referee says which arm, or that it takes none.` };
}

// ---------------------------------------------------------------- the accepted set, for C4
/** Accepted laws whose scope overlaps the candidate's, with their statements: the critic and referee get these so
 *  C4 (independence) is argued against the real set and not from memory. */
export function overlappingAccepted(cand) {
  const dir = R('lean', 'registry', 'laws');
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    let l; try { l = readJson(`${dir}/${f}`); } catch { continue; }
    if (l.status !== 'accepted') continue;
    const taxaOverlap = !l.scope?.taxa?.length || !cand.scope?.taxa?.length
      || l.scope.taxa.some(t => (cand.scope.taxa || []).some(u => String(t).toLowerCase() === String(u).toLowerCase()))
      || (cand.scope.taxa || []).some(u => (l.scope.taxa || []).some(t => inScope(u, { taxa: [t] })));
    const qOverlap = Object.keys(l.shared_scope?.quantities || {}).some(q => q in (cand.shared_scope?.quantities || {}));
    if (!taxaOverlap && !qOverlap) continue;
    out.push({ law_id: l.law_id, version: l.version, statement_en: l.statement_en, scope: l.scope,
      atoms: l.shared_scope?.atoms || [], quantities: Object.keys(l.shared_scope?.quantities || {}),
      shares_quantities: Object.keys(l.shared_scope?.quantities || {}).filter(q => q in (cand.shared_scope?.quantities || {})) });
  }
  // The ones that share a quantity first: those are the ones a restatement would hide behind.
  return out.sort((a, b) => b.shares_quantities.length - a.shares_quantities.length).slice(0, 12);
}

/** Does an accepted law's atom set already imply the candidate's, over the shared quantities? A cheap numeric
 *  implication probe: sample the shared space, and report whether every point the accepted law admits the candidate
 *  admits too (which would make the candidate add nothing) or vice versa. Evidence for C4, not a proof. */
export function implicationProbe(cand, accepted) {
  const shared = accepted.shares_quantities;
  if (!shared.length || !accepted.atoms.length || !(cand.shared_scope?.atoms || []).length) return null;
  const base = Object.fromEntries(Object.keys(cand.shared_scope.quantities).map(q => [q, Number(cand.shared_scope.witness_values?.[q] ?? 1)]));
  let acceptedOnly = 0, candidateOnly = 0, both = 0, neither = 0, n = 0;
  const FACTORS = [1e-3, 0.01, 0.1, 0.3, 0.6, 0.8, 1, 1.25, 1.6, 2, 5, 50, 1e3];
  for (const q of shared) for (const f of FACTORS) {
    const t = { ...base }; t[q] = (base[q] || 1) * f;
    const a = evalAtoms(accepted.atoms, t).verdict, c = evalAtoms(cand.shared_scope.atoms, t).verdict;
    if (a === 'cannot-evaluate' || c === 'cannot-evaluate') continue;
    n++;
    if (a === 'holds' && c === 'holds') both++;
    else if (a === 'holds') acceptedOnly++;   // the accepted law admits a point the candidate forbids -> new content
    else if (c === 'holds') candidateOnly++;  // the candidate admits a point the accepted law forbids -> weaker
    else neither++;
  }
  return { shared_quantities: shared, sampled: n, accepted_admits_candidate_forbids: acceptedOnly, candidate_admits_accepted_forbids: candidateOnly, both, neither,
    reading: !n ? 'not evaluable' : acceptedOnly === 0 ? 'over the sampled points the candidate forbids nothing the accepted law allows: it may add no constraint (evidence for C4 fail, not a proof)' : `the candidate forbids ${acceptedOnly} of ${n} sampled points the accepted law allows: it adds constraint` };
}
