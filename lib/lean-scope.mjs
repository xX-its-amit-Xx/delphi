// Scope of a law or constraint versus a design: the 'out-of-scope' verdict. Pure ESM, no imports, so the SAME file
// runs in node (lib/lean-source.mjs checkDesign) and in the browser (dashboard/build-lean-api.mjs copies it to
// /api/lean/scope.mjs, which blueprint3d/lean-client.js imports). One implementation, two runtimes.
//
// A row is out of scope (grey; neither holds nor violated) when:
//   1. the law's scope.taxa does not include 'any' and the design's taxon is not within one of them, or the design
//      names no taxon (a law calibrated on flying fish says nothing about an unnamed organism);
//   2. the law's scope.life_stages is non-empty and the design states a life stage outside it;
//   3. a quantity named in scope.ranges is given by the design and lies outside [min, max].
// A law may carry constraint_scopes: {<constraint id>: {taxa, life_stages, ranges, basis}}, which replaces law.scope
// for that constraint (lean/registry/README.md). Where a constraint has none, a constraint that compares the design with the single
// reference specimen (browser-check REFERENCE: Cypselurus hiraii, Park and Choi 2010) is scoped to Exocoetidae,
// whatever the scope of its law: an exponent implied from one flying fish is not evidence about another clade.

// Minimal taxonomy: enough to place the project's organisms. Mirrors the PARENT table in
// lean/registry/registry-lib.mjs, plus flying-fish genera.
export const PARENT = {
  Exocoetidae: 'Beloniformes', Beloniformes: 'Teleostei', 'Danio rerio': 'Teleostei', Danio: 'Teleostei',
  Liparidae: 'Teleostei',
  Teleostei: 'Actinopterygii', Actinopterygii: 'Vertebrata', Vertebrata: 'Metazoa', Metazoa: 'any',
};
const FLYING_FISH_GENERA = ['Cypselurus', 'Exocoetus', 'Hirundichthys', 'Cheilopogon', 'Parexocoetus', 'Fodiator', 'Prognichthys', 'Oxyporhamphus'];
const SNAILFISH_GENERA = ['Pseudoliparis', 'Notoliparis', 'Liparis'];
const norm = t => {
  if (!t) return null;
  const s = String(t).trim();
  const genus = s.split(/\s+/)[0];
  if (FLYING_FISH_GENERA.includes(genus)) return 'Exocoetidae';
  if (SNAILFISH_GENERA.includes(genus)) return 'Liparidae';
  if (/^snailfish$/i.test(s)) return 'Liparidae';
  if (/^zebrafish$/i.test(s)) return 'Danio rerio';
  if (/^flying[- ]?fish$/i.test(s)) return 'Exocoetidae';
  return s;
};
export function taxonWithin(t, anc) {
  if (anc === 'any') return true;
  let x = norm(t); const a = norm(anc);
  if (!x) return false;
  if (x === a) return true;
  const seen = new Set();
  while (PARENT[x] && !seen.has(x)) { seen.add(x); x = PARENT[x]; if (x === a) return true; }
  return false;
}

export function designTaxon(d = {}) {
  return d.taxon || d.species || d.organism?.species || d.organism?.taxon || d.host?.species || null;
}
export function designStage(d = {}) { return d.life_stage || d.lifeStage || d.stage || null; }

// Rows that compare the design with the reference specimen (fallback per-constraint scope).
export function comparesWithReference(row) {
  const n = row && row.numbers;
  if (!n || typeof n !== 'object') return false;
  return 'lengthRatio' in n || /reference specimen/i.test(String(n.from || '')) || 'vminReference_m_s' in n;
}
export const REFERENCE_SCOPE = { taxa: ['Exocoetidae'], basis: 'compared with one reference specimen (Cypselurus hiraii, Park and Choi 2010 model L3)' };

// -> null when in scope, else { reason, scope }.
export function outOfScope(row, law, design = {}) {
  const cid = row && (row.id || row.constraint);
  const cs = law && law.constraint_scopes && cid ? law.constraint_scopes[cid] : null;
  const ls = cs || (law && law.scope) || {};
  const scopes = [];
  if (Array.isArray(ls.taxa) && ls.taxa.length && !ls.taxa.includes('any')) scopes.push({ taxa: ls.taxa, basis: cs ? `constraint ${cid} scope${cs.basis ? ': ' + cs.basis : ''}` : `law ${law.law_id} scope` });
  if (!cs && comparesWithReference(row)) scopes.push(REFERENCE_SCOPE);
  const taxon = designTaxon(design);
  for (const s of scopes) {
    if (!taxon) return { reason: `scoped to ${s.taxa.join(', ')} (${s.basis}); the design names no taxon, so this is not evaluated. Pass taxon to evaluate it.`, scope: s };
    if (!s.taxa.some(t => taxonWithin(taxon, t))) return { reason: `scoped to ${s.taxa.join(', ')} (${s.basis}); the design is ${taxon}.`, scope: s };
  }
  const stage = designStage(design);
  if (stage && Array.isArray(ls.life_stages) && ls.life_stages.length && !ls.life_stages.includes(stage)) {
    return { reason: `scoped to life stages ${ls.life_stages.join(', ')}; the design is at ${stage}.`, scope: { life_stages: ls.life_stages } };
  }
  for (const [q, r] of Object.entries(ls.ranges || {})) {
    const v = design[q];
    if (typeof v !== 'number' || !r) continue;
    if ((r.min != null && v < r.min) || (r.max != null && v > r.max)) {
      return { reason: `${q} = ${v}${r.unit ? ' ' + r.unit : ''} is outside the law's range [${r.min ?? '-inf'}, ${r.max ?? 'inf'}].`, scope: { ranges: { [q]: r } } };
    }
  }
  return null;
}
