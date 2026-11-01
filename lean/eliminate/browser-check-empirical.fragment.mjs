// FRAGMENT spliced into lean/eliminate/browser-check.mjs by lean/eliminate/build-browser-check.mjs.
// Real JavaScript so it can be syntax-checked on its own; the placeholder below is replaced with the
// empirical record at generation time. Not a module on its own (it uses META, result and KERNEL_NOTE).
// The one placeholder, named for the constant it fills, is the empirical record of lean/empirical.json.

/** The empirical layer: observations a reader may reject, each with its source and scope. */
export const EMPIRICAL = __EMPIRICAL__;

// Empirical rows belong in their own band in the Studio: they are conditional on an observation, not on a
// proof. Every row carries band: "empirical", the observation in plain words, and what rejecting it costs.
const empiricalRow = (id, verdict, numbers, missing, note, sides) => {
  const e = EMPIRICAL.entries.find(x => x.id === id) || {};
  return { ...result(id, verdict, numbers, missing, note, sides), band: 'empirical', status: e.status || 'empirical',
    observation: e.observation || null, observationSource: e.source || null, observationScope: e.scope || null,
    conditionalOn: id, rejectable: e.rejectable || null,
    kernel: 'conditional on an observation a reader may reject (' + id + ' of lean/empirical.json); the arithmetic is the same the kernel checks on the recorded examples, and this page evaluates it in floating point' };
};

/** Empirical rows for a design. Fields: mass_exponent (E2), power_required_W or the flight fields (E3),
 * o2_store_ml with flight_duration_s (E4), fin_length_over_SL (E5, a provenance flag, never a violation),
 * and lethality {death_hpf, scored_hpf} (E7). */
export function checkEmpirical(s, derived) {
  const num = x => typeof x === 'number' && Number.isFinite(x);
  const rows = [];
  const Preq = derived && num(derived.powerRequired_W) ? derived.powerRequired_W : (num(s.powerRequired_W) ? s.powerRequired_W : null);

  // E2: the fitted mass-exponent band.
  { const b = num(s.mass_exponent) ? s.mass_exponent : (derived && num(derived.impliedMassExponent) ? derived.impliedMassExponent : null);
    const src = num(s.mass_exponent) ? 'committed mass_exponent' : 'the exponent implied against the reference specimen';
    if (b === null) rows.push(empiricalRow('E2', 'cannot-evaluate', {}, ['mass_exponent (or a length different from the reference specimen)'], 'the band is [2.90, 3.02] over the six fitted field rows of five species'));
    else rows.push(empiricalRow('E2', geTol(b, 2.9) && leTol(b, 3.02) ? 'holds' : 'violated', { exponent: b, from: src, band: [2.9, 3.02] }, [],
      'within the band every fitted flying-fish study spans; outside it, no fit in the project\'s table supports the design',
      { needed: { exponent_between: [2.9, 3.02] }, available: { exponent: b } })); }

  // E3 (v2.0.0, law set 1.6.0): the ceiling inside the widened ranges (eta <= 0.23, Q*Ca <= 0.0187 ml O2/s at
  // 0.06 kg, from measured zebrafish MO2max, Palstra 2010). v1.0.0 (law sets 1.0.0-1.5.0) used 0.0458 W; the
  // law-set judgement re-applies that ceiling when an older law set is chosen (ceiling_v1_W below).
  { const ceiling = 0.0833, ceilingV1 = 0.0458;
    if (Preq === null) rows.push(empiricalRow('E3', 'cannot-evaluate', {}, ['airspeed_m_s and LD_max (or powerRequired_W)'], 'the ceiling is ' + ceiling + ' W at 0.06 kg; a different mass needs the O2 delivery per kg, which this row does not scale'));
    else rows.push(empiricalRow('E3', leTol(Preq, ceiling) ? 'holds' : 'violated', { powerRequired_W: Preq, ceiling_W: ceiling, shortfall_factor: Preq > 0 ? Preq / ceiling : null, ceiling_v1_W: ceilingV1 }, [],
      'stronger than the oxygen row C14, which rules only on the physiology a design commits: this one rules on the widened ranges its sources support (E3 v2; v1 claimed every teleost and was withdrawn after measured zebrafish exceeded it)',
      { needed: { power_W: Preq }, available: { power_W: ceiling } })); }

  // E4: the O2 store carried into the air.
  { const S = num(s.o2_store_ml) ? s.o2_store_ml : null, t = num(s.flight_duration_s) ? s.flight_duration_s : null;
    const E = num(s.oxycaloric_J_per_unit_O2) ? s.oxycaloric_J_per_unit_O2 : null;
    const miss = [];
    if (S === null) miss.push('o2_store_ml');
    if (t === null || !(t > 0)) miss.push('flight_duration_s');
    if (E === null) miss.push('oxycaloric_J_per_unit_O2');
    if (Preq === null) miss.push('airspeed_m_s and LD_max (or powerRequired_W)');
    if (miss.length) rows.push(empiricalRow('E4', 'cannot-evaluate', { o2_store_ml: S, flight_duration_s: t }, miss, 'no blood volume or venous O2 reserve is measured for a flying fish in this project, so a store must be committed'));
    else { const bound = E * S / t;
      rows.push(empiricalRow('E4', leTol(Preq, bound) ? 'holds' : 'violated', { powerRequired_W: Preq, store_ml: S, oxycaloric_J_per_ml: E, duration_s: t, meanPowerFromStore_W: bound }, [],
        'the aerobic part only: burst power on white-muscle stores is outside this bound, and that is what a flying fish is understood to use',
        { needed: { power_W: Preq }, available: { power_W: bound } })); } }

  // E5: the measured fin-ratio range. A PROVENANCE flag: "outside anything measured", never a violation.
  { const r = num(s.finLength_SL) ? s.finLength_SL : null;
    const lo = 0.406, hi = 0.823;
    if (r === null) rows.push(empiricalRow('E5', 'cannot-evaluate', { range: [lo, hi] }, ['fin_length_over_SL'], 'a flag, not a constraint: nothing is ever eliminated by it'));
    else rows.push({ ...empiricalRow('E5', r >= lo && r <= hi ? 'holds' : 'cannot-evaluate', { fin_length_over_SL: r, measuredRange: [lo, hi], median: 0.687, specimens: 49, outsideTheRecord: !(r >= lo && r <= hi) }, [],
      r >= lo && r <= hi ? 'inside the range of the 49 measured specimens' : 'OUTSIDE everything measured: 49 specimens run from 0.406 to 0.823. That is weaker than impossible, and no theorem here rules it out'),
      verdictKind: 'provenance' }); }

  // E7: lethality before the scoring stage.
  { const L = s.lethality || {};
    const d = num(L.death_hpf) ? L.death_hpf : null, sc = num(L.scored_hpf) ? L.scored_hpf : null;
    if (d === null || sc === null) rows.push(empiricalRow('E7', 'cannot-evaluate', {}, ['lethality.death_hpf', 'lethality.scored_hpf'], 'the project records lethality as free text for all but two levers (ezh2 and wls), so both times must be committed in hours'));
    else rows.push(empiricalRow('E7', sc < d ? 'holds' : 'violated', { death_hpf: d, scored_hpf: sc }, [],
      sc < d ? 'the animal is alive at the stage the phenotype is scored' : 'the animal does not reach the stage at which this phenotype exists, so no living animal shows it',
      { needed: { alive_until_hpf: sc }, available: { alive_until_hpf: d } })); }

  return rows;
}
