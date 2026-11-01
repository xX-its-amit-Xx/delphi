// FRAGMENT spliced into browser-check.mjs by build-browser-check.mjs; the generator fills the __LAWSET_VERSION__, __LAWSETS__, __CONSTRAINT_LAW__ and __LAW_INFO__ placeholders from lean/registry.
// Law-set judgement. Each formula row is judged against ONE law set (default LAWSET_VERSION, the registry's current):
//   accepted  -> verdict as computed (violated is red)
//   candidate -> 'candidate-violated' (flagged, not red) unless opts.includeCandidates, then 'violated' with law.status 'candidate'
//   contested -> 'contested' (amber) where the formula says violated
//   proposed / retired / absent from the law set -> 'not-in-lawset'
//   outside the law's (or the constraint's) scope -> 'out-of-scope' (grey), whatever the formula says
// Every judged row keeps the formula's own verdict in computed_verdict, and carries lawset, law {law_id, version,
// kind, status}, scope_check {in_scope, reason, scope} and display ('red' | 'amber' | 'grey' | 'green' | 'none').
export const LAWSET_VERSION = __LAWSET_VERSION__;
export const LAWSETS = __LAWSETS__;
export const CONSTRAINT_LAW = __CONSTRAINT_LAW__;
export const LAW_INFO = __LAW_INFO__;

// Minimal taxonomy, the same placement rules as lib/lean-scope.mjs (keep the two in step).
const SCOPE_PARENT = { Exocoetidae: 'Beloniformes', Beloniformes: 'Teleostei', 'Danio rerio': 'Teleostei', Danio: 'Teleostei', Liparidae: 'Teleostei', Teleostei: 'Actinopterygii', Actinopterygii: 'Vertebrata', Vertebrata: 'Metazoa', Metazoa: 'any' };
const FLYING_FISH_GENERA = ['Cypselurus', 'Exocoetus', 'Hirundichthys', 'Cheilopogon', 'Parexocoetus', 'Fodiator', 'Prognichthys', 'Oxyporhamphus'];
function taxonNorm(t) {
  if (!t) return null;
  const s = String(t).trim(); const genus = s.split(/\s+/)[0];
  if (FLYING_FISH_GENERA.includes(genus)) return 'Exocoetidae';
  if (['Pseudoliparis', 'Notoliparis', 'Liparis'].includes(genus)) return 'Liparidae';
  if (/^zebrafish$/i.test(s) || /^Danio rerio\b/.test(s)) return 'Danio rerio';
  if (/^flying[- ]?fish$/i.test(s)) return 'Exocoetidae';
  return s;
}
export function taxonWithin(t, anc) {
  if (anc === 'any') return true;
  let x = taxonNorm(t); const a = taxonNorm(anc);
  if (!x) return false; if (x === a) return true;
  const seen = new Set();
  while (SCOPE_PARENT[x] && !seen.has(x)) { seen.add(x); x = SCOPE_PARENT[x]; if (x === a) return true; }
  return false;
}
const designTaxon = d => d.taxon || d.species || (d.organism && (d.organism.species || d.organism.taxon)) || null;
const designStage = d => d.life_stage || d.lifeStage || d.stage || null;

/** Scope of a constraint (its own, where the check is narrower than the law, else the law's). */
/** Does this generated checker know that law set? Callers can ask before judging. */
export function lawsetKnown(version) { return Object.prototype.hasOwnProperty.call(LAWSETS, version || LAWSET_VERSION); }

export function scopeOf(constraintId) {
  const lid = CONSTRAINT_LAW[constraintId]; const info = lid && LAW_INFO[lid];
  if (!info) return null;
  return info.constraint_scopes[constraintId] || info.scope;
}
/** -> {in_scope, reason, scope}. A scoped law says nothing about an organism the design does not name. */
export function scopeCheck(constraintId, design = {}, spec = {}) {
  const sc = scopeOf(constraintId);
  if (!sc) return { in_scope: true, reason: null, scope: null };
  const taxa = sc.taxa || ['any'];
  if (!taxa.includes('any')) {
    const t = designTaxon(design);
    if (!t) return { in_scope: false, reason: `scoped to ${taxa.join(', ')}${sc.basis ? ' (' + sc.basis + ')' : ''}; the design names no taxon, so this row is not judged. Pass taxon to judge it.`, scope: sc };
    if (!taxa.some(a => taxonWithin(t, a))) return { in_scope: false, reason: `scoped to ${taxa.join(', ')}${sc.basis ? ' (' + sc.basis + ')' : ''}; the design is ${t}.`, scope: sc };
  }
  const st = designStage(design);
  if (st && (sc.life_stages || []).length && !sc.life_stages.includes(st)) return { in_scope: false, reason: `scoped to life stages ${sc.life_stages.join(', ')}; the design is at ${st}.`, scope: sc };
  for (const [q, r] of Object.entries(sc.ranges || {})) {
    const v = typeof spec[q] === 'number' ? spec[q] : design[q];
    if (typeof v !== 'number' || !r) continue;
    if ((r.min != null && v < r.min) || (r.max != null && v > r.max)) return { in_scope: false, reason: `${q} = ${v}${r.unit ? ' ' + r.unit : ''} is outside the law's range [${r.min ?? '-inf'}, ${r.max ?? 'inf'}]${r.note ? ': ' + r.note : ''}.`, scope: sc };
  }
  return { in_scope: true, reason: null, scope: sc };
}

/**
 * Judge formula rows against a law set. opts: {lawset: 'x.y.z' (default LAWSET_VERSION), includeCandidates: false}.
 *
 * FAILS SOFT on an unknown law set. A law set released after this file was generated (lean/registry/lawsets/current.json
 * bumped, browser-check.mjs not regenerated) must not break every caller: that happened once, and every checkDesign
 * threw mid-release. Instead every row comes back 'unknown-lawset' (display 'grey', so nothing is judged red or green)
 * with the reason and the versions this file knows, and `lawsetKnown(v)` lets a caller ask first. release.mjs
 * regenerates this file, and check-exposed fails if current.json names a version this file does not know.
 */
export function judgeRows(rows, design = {}, spec = {}, opts = {}) {
  const ver = opts.lawset || LAWSET_VERSION;
  const ls = LAWSETS[ver];
  if (!ls) {
    const reason = `law set ${ver} is unknown to this generated checker (it knows ${Object.keys(LAWSETS).join(', ')}): regenerate it with node lean/eliminate/build-browser-check.mjs. Nothing was judged.`;
    return rows.map(r => ({ ...r, verdict: 'unknown-lawset', computed_verdict: r.verdict, lawset: ver, lawset_known: false,
      law: CONSTRAINT_LAW[r.id] ? { law_id: CONSTRAINT_LAW[r.id], version: null, kind: LAW_INFO[CONSTRAINT_LAW[r.id]].kind, status: 'unknown-lawset' } : null,
      scope_check: null, display: 'grey', note: r.note ? r.note + ' | ' + reason : reason, unknown_lawset_reason: reason }));
  }
  return rows.map(r => {
    const lid = CONSTRAINT_LAW[r.id];
    if (!lid) return { ...r, lawset: ver, law: null, computed_verdict: r.verdict, scope_check: null, display: r.verdict === 'violated' ? 'red' : r.verdict === 'holds' ? 'green' : 'none' };
    const pin = ls.laws[lid];
    const law = { law_id: lid, version: pin ? pin.version : null, kind: pin ? pin.kind : LAW_INFO[lid].kind, status: pin ? pin.status : 'not-in-lawset' };
    let sc = scopeCheck(r.id, design, spec);
    // Version-dependent constant: E3 1.0.0 (law sets 1.0.0-1.5.0) ruled at 0.0458 W, E3 2.0.0 at 0.0833 W.
    // Re-applying the pinned version's ceiling keeps verdicts against older law sets reproducible.
    if (r.id === 'E3' && pin && pin.version === '1.0.0' && r.numbers && typeof r.numbers.powerRequired_W === 'number' && typeof r.numbers.ceiling_v1_W === 'number') {
      const P = r.numbers.powerRequired_W, c1 = r.numbers.ceiling_v1_W;
      r = { ...r, verdict: leTol(P, c1) ? 'holds' : 'violated', numbers: { ...r.numbers, ceiling_W: c1, shortfall_factor: P > 0 ? P / c1 : null, ceiling_pinned_by: 'E3@1.0.0' } };
    }
    // A fragment may already have decided this row is out of scope BY CLAIM KIND (what the design claims, not which
    // organism it is: an unpowered glide against an aerobic bound, say). Carry its reason into scope_check, with the
    // law's applies_to/excludes, so a consumer never has to fall back to `note` to find out why. `kind` tells the two
    // apart: 'claim-kind' (the caller asked the wrong law) vs 'organism' (taxon, life stage or range).
    if (r.verdict === 'out-of-scope') {
      const info = LAW_INFO[lid] || {};
      sc = { in_scope: false, kind: 'claim-kind', reason: r.note || 'out of scope for what this design claims',
        scope: { applies_to: (info.scope && info.scope.applies_to) || [], excludes: (info.scope && info.scope.excludes) || [] } };
    } else if (!sc.in_scope) sc = { ...sc, kind: 'organism' };
    let verdict = r.verdict;
    if (!pin || law.status === 'proposed' || law.status === 'retired') verdict = 'not-in-lawset';
    else if (!sc.in_scope && (r.verdict === 'holds' || r.verdict === 'violated')) verdict = 'out-of-scope';
    else if (r.verdict === 'violated' && law.status === 'contested') verdict = 'contested';
    else if (r.verdict === 'violated' && law.status === 'candidate') verdict = opts.includeCandidates ? 'violated' : 'candidate-violated';
    const display = verdict === 'violated' ? 'red' : verdict === 'contested' ? 'amber' : verdict === 'out-of-scope' || verdict === 'not-in-lawset' || verdict === 'candidate-violated' ? 'grey' : verdict === 'holds' ? 'green' : 'none';
    return { ...r, verdict, computed_verdict: r.verdict, lawset: ver, law, candidate: law.status === 'candidate' || undefined, scope_check: sc, display };
  });
}
