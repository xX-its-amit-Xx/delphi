// The SECOND Lean round of design validation.
//
// Round 1 judges a design against the law set that was in force WHEN THE DESIGN WAS MADE. Round 2 re-resolves
// the CURRENT law set -- which may have gained laws since -- and judges the same design again. Both rounds are
// reported, with the law-set version and the timestamp of each, and the difference is named:
//
//   newly_violated_since     laws the design now breaks that it did not break in round 1, split into the ones
//                            ADMITTED OR CHANGED since round 1 (the living-law-base case: the design did not
//                            move, the law base did) and the ones that were already there (which means the two
//                            rounds were given different numbers, and that is a bug in the caller, not a law
//                            change -- it is reported separately so it cannot be mistaken for one)
//   no_longer_violated_since laws the design broke in round 1 and no longer breaks (a law was loosened,
//                            retired, re-scoped or superseded). A law base that only tightens is not honest.
//   newly_unjudged_since     rows round 1 judged that round 2 does not (a law retired or left the set): the
//                            design is no longer checked against them, which is a loss of coverage, not a pass.
//
// A design that was valid last week and is not valid today is the whole point of a living law base, and it has
// to be visible without anyone re-running anything by hand. validate_design calls this instead of checking once.
//
// This module owns NOTHING of the scorer. It does not import sim-engine/validate/score*.mjs and never changes a
// score: the scorer's L component is computed from round 2 exactly as it was computed from the single round
// before, so scores are unchanged by construction. Hook for the scorer thread:
// sim-engine/validate/LEAN-ROUND2-HOOK.md.
//
// Evaluation is the generated browser-check (floating point), NOT a Lean kernel check -- the same standing as
// every other verdict in this project. What the second round adds is not more certainty; it is the knowledge of
// WHEN a verdict was formed and whether it still holds.

import * as LS from '../../lib/lean-source.mjs';

/** Semver compare for law-set versions ("0.0.0-derived" sorts below everything). */
export function cmpLawset(a, b) {
  const p = v => String(v || '').split('-')[0].split('.').map(n => Number(n) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/**
 * The law set a design was made under, and how we know.
 *   explicit         the caller passed `from`
 *   document-edit    the newest lawset_version stamped on one of the document's edits (organism.mjs appendEdit
 *                    records it on every edit, which is exactly "the law set in force when the design was made")
 *   document-field   doc.lawset_version
 *   session          the law set recorded when a co-design session was opened
 *   unknown          nothing on the design says; round 1 then uses the current set and says so, and the two
 *                    rounds are identical by construction rather than by luck
 */
export function lawsetOfDesign(doc, explicit = null) {
  if (explicit) return { version: explicit, basis: 'explicit', detail: 'the caller named the round-1 law set' };
  const stamps = (doc?.edits || []).map(e => e.lawset_version).filter(Boolean);
  if (stamps.length) {
    const newest = stamps.slice().sort(cmpLawset).pop();
    return { version: newest, basis: 'document-edit', detail: `the newest lawset_version stamped on the document's ${stamps.length} recorded edit(s); the design's last edit was made under law set ${newest}` };
  }
  if (doc?.lawset_version) return { version: doc.lawset_version, basis: 'document-field', detail: 'the document\'s own lawset_version field' };
  return { version: null, basis: 'unknown', detail: 'nothing on this design records a law set (an unedited repository organism, an inline document, or a raw spec), so round 1 is run against the CURRENT set and the two rounds are identical by construction, not by evidence' };
}

const key = v => `${v.law_id}::${v.constraint}`;

/** One round: the lawset it used, when it ran, and the rows and violations it produced. */
async function round(spec, lawsetVersion, label) {
  const started = new Date().toISOString();
  let r, error = null;
  try { r = await LS.checkDesign(spec, lawsetVersion || 'current'); }
  catch (e) { error = e.message; r = { lawset: lawsetVersion, verdicts: [], violations: [], summary: {}, excluded: [] }; }
  return {
    round: label,
    lawset_version: r.lawset,
    requested_lawset: lawsetVersion || 'current',
    ran_at: started,
    ...(error ? { error } : {}),
    ...(r.unknown_lawset ? { unknown_lawset: true, unknown_lawset_reason: r.unknown_lawset_reason } : {}),
    summary: r.summary,
    verdicts: r.verdicts,
    violations: r.violations,
    excluded: r.excluded || [],
    laws_without_browser_evaluation: r.laws_without_browser_evaluation || [],
  };
}

/** What a law set says about one law: present, at which version, with which pinned status. */
function pinsOf(version) {
  try {
    const ls = LS.resolveLawset(version);
    return new Map(ls.laws.map(x => [x.law_id, x]));
  } catch { return new Map(); }
}

/**
 * Both rounds and their difference.
 *
 *   leanRounds({ design, from })                      a resolved SI spec (what lean_check takes)
 *   leanRounds({ organism, ageDays, conditions })     an organism id / document: the spec is resolved here and
 *                                                     the round-1 law set is read off the document's edits
 *
 * `from` overrides the round-1 law set; `to` overrides round 2 (default: current).
 */
export async function leanRounds({ design = null, organism = null, ageDays, conditions = {}, from = null, to = null, extraSpec = {} } = {}) {
  let spec = design, doc = null, resolvedBy = 'the caller passed a resolved spec';
  if (!spec) {
    if (!organism) throw new Error('leanRounds needs either design (a resolved SI spec) or organism');
    const [{ getDoc }, { resolveState, leanSpec }, { loadBundle }] = await Promise.all([
      import('../tools/studio.mjs'), import('../lib/state.mjs'), import('../lib/data-node.mjs'),
    ]);
    const bundle = await loadBundle();
    const g = await getDoc(organism);
    doc = g.doc;
    spec = leanSpec(resolveState(doc, ageDays, conditions, bundle));
    resolvedBy = `resolved from the ${g.origin} organism document through resolveState + leanSpec`;
  } else if (organism && typeof organism === 'object') doc = organism;
  spec = { ...spec, ...extraSpec };

  const made = lawsetOfDesign(doc, from);
  const current = LS.load().current;
  const r1Version = made.version || current;
  const r2Version = to || current;

  const round1 = { ...(await round(spec, r1Version, 'round-1 (the law set the design was made under)')), lawset_basis: made.basis, lawset_basis_detail: made.detail };
  const round2 = { ...(await round(spec, r2Version, 'round-2 (the law set in force now)')), lawset_basis: to ? 'explicit' : 'current', lawset_basis_detail: to ? 'the caller named the round-2 law set' : 'lean/registry/lawsets/current.json, re-resolved at call time' };

  // What the law base did between the two rounds: the pins, so a "new law" is a fact about the releases rather
  // than an inference from the verdicts.
  const p1 = pinsOf(round1.lawset_version), p2 = pinsOf(round2.lawset_version);
  const admitted = [], changed = [], withdrawn = [];
  for (const [id, b] of p2) {
    const a = p1.get(id);
    if (!a) { admitted.push({ law_id: id, version: b.version, status: b.status }); continue; }
    if (a.version !== b.version || a.status !== b.status) changed.push({ law_id: id, from: { version: a.version, status: a.status }, to: { version: b.version, status: b.status } });
  }
  for (const [id, a] of p1) if (!p2.has(id)) withdrawn.push({ law_id: id, version: a.version, status: a.status });
  const movedIds = new Set([...admitted.map(x => x.law_id), ...changed.map(x => x.law_id)]);

  const v1 = new Map(round1.violations.map(v => [key(v), v]));
  const v2 = new Map(round2.violations.map(v => [key(v), v]));
  const judged1 = new Set(round1.verdicts.filter(v => v.verdict !== 'cannot-evaluate' && v.verdict !== 'unknown-lawset').map(v => key(v)));
  const judged2 = new Set(round2.verdicts.filter(v => v.verdict !== 'cannot-evaluate' && v.verdict !== 'unknown-lawset').map(v => key(v)));

  const brief = (v, extra = {}) => ({ law_id: v.law_id, law_version: v.version, constraint: v.constraint, status: v.status,
    binding: v.binding, kind: v.kind, inputs: v.inputs ?? null, message: v.message, ...extra });

  const newlyViolated = [], newlyViolatedSameLawBase = [];
  for (const [k, v] of v2) {
    if (v1.has(k)) continue;
    const moved = movedIds.has(v.law_id);
    const a = admitted.find(x => x.law_id === v.law_id), c = changed.find(x => x.law_id === v.law_id);
    const row = brief(v, { law_base_change: a ? { kind: 'admitted', ...a } : c ? { kind: 'changed', ...c } : null,
      why: a ? `law ${v.law_id}@${a.version} was admitted to law set ${round2.lawset_version} after this design was made (status ${a.status}); the design did not change, the law base did`
        : c ? `law ${v.law_id} changed from ${c.from.version}/${c.from.status} to ${c.to.version}/${c.to.status} after this design was made`
        : `this row violates in round 2 and not in round 1, yet law ${v.law_id} is pinned identically in both law sets: the two rounds cannot have been given the same numbers. Treat this as a CALLER bug, not a law change.` });
    (moved ? newlyViolated : newlyViolatedSameLawBase).push(row);
  }

  // A violation the design already had, which has become BINDING because the law was raised to accepted. The
  // design did not move and the relation did not move: the registry decided the law is now one that counts.
  // In the Studio this row goes from grey (advisory) to red, so it has to be reported as a change of verdict.
  const newlyBinding = [];
  for (const [k, v] of v2) {
    const a = v1.get(k);
    if (!a || !v.binding || a.binding) continue;
    const c = changed.find(x => x.law_id === v.law_id);
    newlyBinding.push(brief(v, { was: { status: a.status, binding: a.binding }, law_base_change: c ? { kind: 'changed', ...c } : null,
      why: `the design broke law ${v.law_id} in round 1 too, but its status was ${a.status} then and is ${v.status} now`
        + `${c ? ` (law set ${round2.lawset_version} pins it ${c.to.version}/${c.to.status})` : ''}: the violation was advisory and is now binding, so the Studio draws this row red where it drew it grey` }));
  }

  const noLonger = [];
  for (const [k, v] of v1) {
    if (v2.has(k)) continue;
    const w = withdrawn.find(x => x.law_id === v.law_id), c = changed.find(x => x.law_id === v.law_id);
    noLonger.push(brief(v, { law_base_change: w ? { kind: 'withdrawn', ...w } : c ? { kind: 'changed', ...c } : null,
      why: w ? `law ${v.law_id} is not in law set ${round2.lawset_version} any more, so the design is no longer judged by it: that is a loss of coverage, not a pass`
        : c ? `law ${v.law_id} changed from ${c.from.version}/${c.from.status} to ${c.to.version}/${c.to.status}; the design's numbers now satisfy it`
        : judged2.has(k) ? 'the row is still judged and now holds' : 'the row is no longer judged (inputs or scope changed)' }));
  }

  const newlyUnjudged = [...judged1].filter(k => !judged2.has(k)).map(k => {
    const v = round1.verdicts.find(x => key(x) === k);
    return { law_id: v.law_id, constraint: v.constraint, round1_verdict: v.verdict,
      round2_verdict: round2.verdicts.find(x => key(x) === k)?.verdict ?? 'no row at all',
      why: 'round 1 reached a verdict here and round 2 does not; the design is less covered than it was, which is never a pass' };
  });

  // The releases between the two rounds, with the changelog prose, so the report says WHY the law base moved.
  let between = [];
  try {
    const ch = LS.getChanges(round1.lawset_version);
    between = (ch.entries || []).filter(e => cmpLawset(e.version, round1.lawset_version) > 0 && cmpLawset(e.version, round2.lawset_version) <= 0)
      .map(e => ({ version: e.version, date: e.date, summary: e.summary, added: (e.diff?.added || []).map(x => x.law_id), status: (e.diff?.status || []).map(x => `${x.law_id} ${x.from} -> ${x.to}`) }));
  } catch { between = []; }

  const sameSet = round1.lawset_version === round2.lawset_version;
  return {
    design_spec_resolved_by: resolvedBy,
    rounds_identical: sameSet,
    round1, round2,
    law_base_moved: { from: round1.lawset_version, to: round2.lawset_version, releases_between: between, admitted, changed, withdrawn },
    newly_violated_since: newlyViolated,
    newly_binding_since: newlyBinding,
    newly_violated_without_a_law_change: newlyViolatedSameLawBase,
    no_longer_violated_since: noLonger,
    newly_unjudged_since: newlyUnjudged,
    binding_newly_violated_since: newlyViolated.filter(v => v.binding),
    verdict_changed: !sameSet && (newlyViolated.length > 0 || newlyBinding.length > 0 || noLonger.length > 0 || newlyUnjudged.length > 0),
    summary: sameSet
      ? `Both rounds used law set ${round1.lawset_version} (${made.basis === 'unknown' ? 'nothing on the design records the set it was made under, so there is nothing to compare' : 'the design was made under the current set, so nothing has changed since'}). ${round2.summary.binding_violations ?? 0} binding violation(s).`
      : `Round 1 judged this design against law set ${round1.lawset_version} (${made.detail}); round 2 against ${round2.lawset_version}. `
        + `${admitted.length} law(s) admitted, ${changed.length} changed, ${withdrawn.length} withdrawn since. `
        + (newlyViolated.length ? `The design now breaks ${newlyViolated.length} law(s) it did not break when it was made (${newlyViolated.map(v => v.law_id).join(', ')}), of which ${newlyViolated.filter(v => v.binding).length} are binding.` : 'The design breaks no law that it did not already break.')
        + (newlyBinding.length ? ` ${newlyBinding.length} violation(s) it already had are now BINDING (${newlyBinding.map(v => v.law_id).join(', ')}): the law was raised to accepted since.` : '')
        + (noLonger.length ? ` ${noLonger.length} violation(s) have gone away.` : '')
        + (newlyUnjudged.length ? ` ${newlyUnjudged.length} row(s) are no longer judged at all.` : ''),
    note: 'Both rounds are floating-point evaluations of the Lean-backed formulas (lean/eliminate/browser-check.mjs), NOT kernel checks. Round 1 reproduces the verdict the design was given when it was made, because law sets are immutable and pin each law at a version; round 2 is the verdict it would be given today. A violation of a non-accepted law is advisory (binding:false) in both rounds: candidate is the automatic ceiling and a candidate law never invalidates a design on its own.',
  };
}

export default leanRounds;
