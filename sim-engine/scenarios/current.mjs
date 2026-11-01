// current.mjs: holding station against a water current. Measured critical swimming speed (Ucrit) by
// stage for zebrafish, corrected for temperature with the measured Ucrit(T) curve, plus a physical upper
// bound for any fish: the speed at which rigid-body skin-friction drag power equals the whole red-muscle
// power. Pure ESM. Every constant fetched 2026-10-31 (modelCard.sources). No bird data.
import { ucritRel } from './temperature.mjs';
import { fickPower, FICK } from './glide.mjs'; // used only inside run(), so the glide <-> current import cycle is safe
const LIN = (value, unit, kind, source, reason) => (value == null || (typeof value === 'number' && !Number.isFinite(value)) ? { value: null, unit, kind: 'assumed', source: 'none', reason: reason || 'not computable from the inputs given' } : { value, unit, kind, source });


// Zebrafish Ucrit / Umax (Widrick et al. 2018, PLoS One 13:e0199712, which measured Umax and compiled the literature):
const UCRIT_ADULT_SL_S = 15.5;   // Plaut 2000 adult Ucrit, 28 degC, as compiled in Widrick 2018 Table 2 (measured-secondhand)
const UCRIT_ADULT_RANGE = [13.7, 17.9]; // adult column of the same table (Seebacher 13.7 ... Conradsen 17.9), SL/s; Fiaz's 10.3 is the 14 dpf column
// Widrick 2018 Table 2 is titled 'maximal swimming speed (Umax)', but its adult entries mix protocols: Plaut 2000 used a
// 65-min incremental (Ucrit-type) protocol, so its 15.5 SL/s is used here as Ucrit. That label is the module's reading, not the table's.
const UMAX_OVER_UCRIT = 1.15;    // "Umax exceeds Ucrit by about 15%" (Widrick 2018 Introduction, citing Gilbert et al.)
const UMAX_14DPF_SL_S = 12.1;    // Widrick 2018 Table 2, present study, 14 dpf, 25 degC (measured)
const UCRIT_5DPF_M_S = 0.03;     // "Ucrit rises from ~3 cm/s in 5 dpf larvae ..." (Widrick 2018 Introduction, measured-secondhand)
const SL_MM = dpf => 0.258 * dpf + 1.377; // Widrick 2018 Fig. 6A regression, 14-42 dpf
const WID = { cite: 'Widrick JJ et al. (2018). An open source microcontroller based flume for evaluating swimming performance of larval, juvenile, and adult zebrafish. PLoS One 13:e0199712', doi: 'https://doi.org/10.1371/journal.pone.0199712' };

// Flat-plate drag coefficients on wetted area, laminar 1.33 Re^-0.5 and turbulent 0.072 Re^-0.2, as used by
// Li et al. 2021 (Proc R Soc B 288:20211601, Fig. 2b caption), who show undulating fish have MUCH HIGHER drag:
// so these give a LOWER bound on drag and an UPPER bound on speed.
const LI = { cite: 'Li G et al. (2021). Fishes regulate tail-beat kinematics to minimize speed-specific cost of transport. Proc R Soc B 288:20211601', doi: 'https://doi.org/10.1098/rspb.2021.1601' };
// The switch at Re 5e5 is the conventional flat-plate transition (textbook, e.g. Schlichting; not fetched, not in Li 2021): a modelling choice.
const cdPlate = Re => (Re < 5e5 ? 1.33 / Math.sqrt(Re) : 0.072 * Re ** -0.2);

// Pure-water dynamic viscosity (Pa s) and density at 0.101325 MPa, NIST Chemistry WebBook fluid data (fetched).
const NIST = [[5, 0.0015182, 999.97], [10, 0.0013059, 999.70], [15, 0.0011376, 999.10], [20, 0.0010016, 998.21], [25, 0.00089002, 997.05], [30, 0.00079722, 995.65], [35, 0.00071913, 994.03]];
const NIST_URL = 'https://webbook.nist.gov/cgi/fluid.cgi?Action=Data&Wide=on&ID=C7732185&Type=IsoBar&Digits=5&P=0.101325&THigh=35&TLow=5&TInc=5&RefState=DEF&TUnit=C&PUnit=MPa&DUnit=kg%2Fm3&HUnit=kJ%2Fmol&WUnit=m%2Fs&VisUnit=Pa*s&STUnit=N%2Fm (NIST Chemistry WebBook, water, isobaric)';
function water(T) {
  const t = Math.min(35, Math.max(5, T));
  for (let i = 1; i < NIST.length; i++) if (t <= NIST[i][0]) {
    const [a, b] = [NIST[i - 1], NIST[i]]; const f = (t - a[0]) / (b[0] - a[0]);
    return { mu: a[1] + f * (b[1] - a[1]), rho: a[2] + f * (b[2] - a[2]), clamped: t !== T };
  }
  return { mu: NIST.at(-1)[1], rho: NIST.at(-1)[2], clamped: true };
}

// Red muscle maximal power (scup, Rome et al. 1992 abstract) 134 W/kg at 20 degC, Q10 1.88: physiology/muscle.js.
const RED_PMAX = { value: 134, Tref: 20, Q10: 1.88, kind: 'borrowed', source: 'rome1992 abstract via physiology/muscle.js: scup red muscle maximal power 71 W/kg at 10 degC, 134 W/kg at 20 degC (Q10 1.88)' };
const MYOTOMAL_FRACTION = { value: 0.5, kind: 'assumed', source: 'physiology/index.js axialMuscleFraction default: assumed 0.5 of body mass; not fetched' };

const val = (s, k) => (s && s[k] && s[k].value != null ? s[k].value : null);
function metric(key, label, value, unit, better, kind, source, reason) {
  const ok = typeof value === 'number' ? Number.isFinite(value) : typeof value === 'boolean';
  const m = { key, label, value: ok ? value : null, unit, better, kind: ok ? kind : 'assumed', source: ok ? source : 'none' };
  if (!ok) m.reason = reason || 'not computable from the inputs given';
  return m;
}
const isZebrafish = s => /danio rerio|zebrafish/i.test(String(val(s, 'species') || ''));

/** Zebrafish Ucrit at 28 degC by age (days post-fertilisation) and SL. Returns {value m/s, kind, source} or value null. */
export function zebrafishUcrit28(dpf, SL_m) {
  if (dpf == null) return { value: null, reason: 'ageDays is null' };
  if (dpf < 5) return { value: null, reason: `~${dpf.toFixed(1)} dpf: before free swimming (5 dpf); no Ucrit measured` };
  if (dpf < 14) {
    const u14 = (UMAX_14DPF_SL_S / UMAX_OVER_UCRIT) * SL_MM(14) / 1000;
    return { value: UCRIT_5DPF_M_S + ((u14 - UCRIT_5DPF_M_S) * (dpf - 5)) / 9, kind: 'calibrated', source: `linear in age between ~0.03 m/s at 5 dpf (second-hand) and ${u14.toFixed(4)} m/s at 14 dpf (Umax 12.1 SL/s / 1.15 x SL 4.99 mm from the Widrick SL regression); the state's SL is not used below 14 dpf (${WID.cite})` };
  }
  if (SL_m == null) return { value: null, reason: 'SL_m is null' };
  if (SL_m > 0.0451) return { value: null, reason: `SL ${(SL_m * 1000).toFixed(0)} mm exceeds the zebrafish asymptotic length (Linf 45.1 mm SL, development/zebrafish/growth.json, FishBase): the SL-specific zebrafish Ucrit was measured on fish of 2-4 cm and SL-specific speed falls with size, so it is not extrapolated to this body` };
  const k14 = UMAX_14DPF_SL_S / UMAX_OVER_UCRIT;
  const k = dpf >= 28 ? UCRIT_ADULT_SL_S : k14 + ((UCRIT_ADULT_SL_S - k14) * (dpf - 14)) / 14;
  // Amendment A1: Plaut's 15.5 SL/s x SL is a read-back of the target paper -> calibrated.
  return { value: k * SL_m, kind: 'calibrated', source: dpf >= 28 ? `Plaut 2000 adult Ucrit 15.5 SL/s at 28 degC, compiled in ${WID.cite} Table 2 (other adult entries 13.7-17.9 SL/s; the table is titled Umax, Plaut's 65-min incremental protocol is a Ucrit-type test) x SL` : `SL-specific Ucrit linear from ${k14.toFixed(1)} SL/s (14 dpf) to 15.5 SL/s (28 dpf; Widrick: relative speed rises until 28 dpf then is flat) x SL` };
}

/** Speed at which flat-plate (rigid) drag power equals available power: an upper bound on sustained speed. */
export function speedBound(P_W, rho, mu, L, Swet) {
  const pd = U => { const Re = (rho * U * L) / mu; return 0.5 * rho * cdPlate(Math.max(Re, 1)) * Swet * U ** 3; };
  let lo = 0, hi = 1;
  while (pd(hi) < P_W && hi < 1e3) hi *= 2;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (pd(mid) < P_W) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

const METRICS = [
  { key: 'ucrit_m_s', label: 'Critical swimming speed at this temperature', unit: 'm/s', better: 'higher' },
  { key: 'ucrit_bl_s', label: 'Critical swimming speed in body lengths', unit: 'BL/s', better: 'higher' },
  { key: 'umax_m_s', label: 'Maximum (short ramp) swimming speed', unit: 'm/s', better: 'higher' },
  { key: 'speed_margin_m_s', label: 'Ucrit minus current speed', unit: 'm/s', better: 'higher' },
  { key: 'current_fraction_of_ucrit', label: 'Current speed / Ucrit', unit: '1', better: 'lower' },
  { key: 'reynolds_number', label: 'Body Reynolds number at the current speed', unit: '1', better: null },
  { key: 'drag_at_current_N', label: 'Rigid-body skin-friction drag at the current speed (lower bound)', unit: 'N', better: 'lower' },
  { key: 'drag_power_at_current_W', label: 'Rigid-body drag power at the current speed (lower bound)', unit: 'W', better: 'lower' },
  { key: 'red_muscle_power_W', label: 'Whole red-muscle maximal power (upper bound on aerobic swimming power)', unit: 'W', better: 'higher' },
  { key: 'ucrit_upper_bound_m_s', label: 'Physical upper bound on sustained speed (rigid drag = red-muscle power)', unit: 'm/s', better: 'higher' },
];

export const needs = [{ field: 'myotomal_muscle_fraction', why: 'fraction of body mass that is myotomal muscle, for the red-muscle power bound. Absent, 0.5 (assumed, as physiology/index.js) is used.' }];

export default {
  key: 'current',
  title: 'Swimming against a current: critical swimming speed and a drag-power bound',
  group: 'environment',
  params: [
    { key: 'current_m_s', label: 'Current speed', unit: 'm/s', default: 0.2, min: 0, max: 3, kind: 'assumed', source: 'design input' },
  ],
  requires: ['SL_m', 'mass_kg'],
  metrics: METRICS,
  needs,
  run(state, params = {}) {
    const U = params.current_m_s ?? 0.2;
    const SL = val(state, 'SL_m'), m = val(state, 'mass_kg'), Swet = val(state, 'wetted_area_m2');
    const red = val(state, 'red_muscle_fraction');
    const T = val(state, 'temperature_C') ?? 25;
    const age = val(state, 'ageDays');
    const stage = String(val(state, 'stage') || '');
    const myo = val(state, 'myotomal_muscle_fraction') != null ? { value: state.myotomal_muscle_fraction.value, kind: state.myotomal_muscle_fraction.kind || 'assumed', source: state.myotomal_muscle_fraction.source || 'state' } : MYOTOMAL_FRACTION;
    const w = water(T);
    const notes = [];
    let inRange = true;
    if (w.clamped) { inRange = false; notes.push(`Water properties clamped to the 5-35 degC NIST table (T ${T}).`); }
    const sal = state && state.ambient && state.ambient.salinity_psu && state.ambient.salinity_psu.value;
    if (sal > 0) notes.push('Viscosity is for pure water; sea water is ~8% more viscous (not corrected), which slightly lowers Re and raises the laminar drag coefficient.');
    const prov = [
      { quantity: 'water viscosity (Pa s)', value: w.mu, kind: 'borrowed', source: NIST_URL + ' (pure water; borrowed for sea water)' },
      { quantity: 'water density (kg/m3)', value: w.rho, kind: 'borrowed', source: NIST_URL },
      { quantity: 'flat-plate drag coefficients', value: '1.33 Re^-0.5 / 0.072 Re^-0.2', kind: 'borrowed', source: `${LI.cite}, ${LI.doi} (Fig. 2b caption): rigid plate; undulating fish have much higher drag` },
      { quantity: 'red muscle max power (W/kg muscle) at 20 degC, Q10', value: '134, 1.88', kind: RED_PMAX.kind, source: RED_PMAX.source },
      { quantity: 'myotomal muscle fraction of body mass', value: myo.value, kind: myo.kind, source: myo.source },
    ];
    // Physical bound (any species)
    const Pred = red != null && m != null ? myo.value * red * m * RED_PMAX.value * RED_PMAX.Q10 ** ((T - RED_PMAX.Tref) / 10) : null;
    const Re = SL != null ? (w.rho * U * SL) / w.mu : null;
    const D = Re != null && Swet != null && U > 0 ? 0.5 * w.rho * cdPlate(Re) * Swet * U * U : U === 0 ? 0 : null;
    const Cd = Re != null && Re > 0 ? cdPlate(Re) : null;
    const amb = (state && state.ambient) || {};
    const pO2w = amb.pO2_kPa && amb.pO2_kPa.value != null ? amb.pO2_kPa.value : null;
    const fk = m != null && pO2w != null ? fickPower({ mass_kg: m, pO2_kPa: pO2w, P50_kPa: val(state, 'hb_P50_kPa') ?? FICK.P50_kPa.value, Q_ml_s: val(state, 'cardiac_output_max_ml_s') }) : null;
    const lean_inputs = {
      drag_coefficient: LIN(Cd, '1', 'borrowed', 'flat-plate C_D on wetted area at the current speed: 1.33 Re^-0.5 (Re < 5e5) or 0.072 Re^-0.2 (Li et al. 2021 formulas; rigid plate, a lower bound for an undulating fish)', U === 0 ? 'current speed is 0' : 'SL_m is null'),
      drag_area_m2: LIN(Cd != null && Swet != null ? Cd * Swet : null, 'm2', 'derived', 'drag_coefficient x wetted_area_m2 (STATE)', Swet == null ? 'wetted_area_m2 is null' : 'drag coefficient not computable'),
      aerobic_ceiling_W: LIN(fk ? fk.P_W : null, 'W', 'derived', fk ? `Fick bound eta E Q Ca: eta ${FICK.eta.value} (borrowed), E ${FICK.E_J_per_ml.value.toFixed(2)} J/ml, Q ${fk.Q_ml_s.toFixed(5)} ml/s (${val(state, 'cardiac_output_max_ml_s') != null ? 'STATE' : 'snapper 58.48 ml/min/kg, borrowed'}), Ca ${fk.Ca_ml_ml.toFixed(4)} ml/ml at water pO2 ${pO2w.toFixed(1)} kPa (PaO2 = water PO2, an upper bound; Hb capacity calibrated)` : 'none', m == null ? 'mass_kg is null' : 'state.ambient.pO2_kPa is null'),
    };
    const bound = Pred != null && Swet != null && SL != null ? speedBound(Pred, w.rho, w.mu, SL, Swet) : null;
    if (Re != null && Re > 5e5) notes.push('Re above 5e5: turbulent plate coefficient used.');
    // Measured Ucrit (zebrafish only)
    let uc = { value: null, reason: `no measured Ucrit for ${val(state, 'species') || 'this species'} (Europe PMC search 2026-10-31 found none for flying fish); zebrafish values are not substituted` };
    let ucKind = 'assumed';
    if (isZebrafish(state)) {
      const dpf = age != null ? age + 2 : null; // ageDays is days after hatching; zebrafish hatch ~2 dpf
      uc = zebrafishUcrit28(dpf, SL);
      const tr = ucritRel(T);
      if (uc.value != null) {
        if (tr.value == null) { uc = { value: null, reason: `temperature correction unavailable: ${tr.reason}` }; }
        else { uc = { ...uc, value: uc.value * tr.value, source: `${uc.source}; x ${tr.value.toFixed(3)} for ${T} degC (Wakamatsu 2019 Ucrit(T)/Ucrit(28 degC); its use below adult stage is borrowed)` }; ucKind = uc.kind; }
      }
      if (/\+/.test(String(val(state, 'species')))) { ucKind = 'borrowed'; notes.push('Blend of species: zebrafish Ucrit applied (borrowed).'); }
      if (state.design_id && !/^zebrafish$/i.test(String(state.design_id.value || ''))) notes.push('Ucrit is the wild-type zebrafish value scaled by SL; fin or body edits change only SL here. Wakamatsu 2019 found long caudal fins LOWER Ucrit (23 cm/s intact long-finned vs 26 cm/s clipped to 10 mm), which this module does not capture.');
      if (dpf != null && dpf >= 5 && dpf < 14) notes.push('5-14 dpf Ucrit is interpolated between a second-hand 5 dpf figure and a 14 dpf Umax.');
    }
    if (stage === 'egg') { inRange = false; notes.push('Egg stage: no swimming.'); }
    const umax = uc.value != null ? uc.value * UMAX_OVER_UCRIT : null;
    // survives = null: being unable to hold station is not modelled as lethal. feasible = can hold station.
    let feasible = null, limiting = null;
    if (uc.value != null) {
      feasible = U <= uc.value;
      limiting = U > umax ? `current exceeds Umax (${umax.toFixed(3)} m/s): swept downstream` : U > uc.value ? `current exceeds Ucrit (${uc.value.toFixed(3)} m/s): fatigue within minutes (burst swimming only)` : null;
    } else if (bound != null && U > bound) {
      feasible = false; limiting = `current exceeds the physical upper bound on sustained speed (${bound.toFixed(3)} m/s): even rigid-body drag would need more than the whole red-muscle power`;
    }
    const kSL = uc.value != null && SL ? uc.value / SL : null;
    const metrics = [
      metric('ucrit_m_s', METRICS[0].label, uc.value, 'm/s', 'higher', ucKind, uc.source, uc.reason),
      metric('ucrit_bl_s', METRICS[1].label, kSL, 'BL/s', 'higher', ucKind, 'ucrit_m_s / SL_m', uc.reason),
      metric('umax_m_s', METRICS[2].label, umax, 'm/s', 'higher', ucKind, 'Ucrit x 1.15 (Umax exceeds Ucrit by ~15%; Widrick 2018 citing Gilbert et al., second-hand)', uc.reason),
      metric('speed_margin_m_s', METRICS[3].label, uc.value != null ? uc.value - U : null, 'm/s', 'higher', ucKind, 'Ucrit - current', uc.reason),
      metric('current_fraction_of_ucrit', METRICS[4].label, uc.value ? U / uc.value : null, '1', 'lower', ucKind, 'current / Ucrit', uc.reason),
      metric('reynolds_number', METRICS[5].label, Re, '1', null, 'derived', 'rho U SL / mu (NIST water properties)', 'SL_m is null'),
      metric('drag_at_current_N', METRICS[6].label, D, 'N', 'lower', 'derived', '0.5 rho C_D(Re) S_wet U^2, flat-plate C_D on wetted area (Li 2021): a lower bound', Swet == null ? 'wetted_area_m2 is null' : null),
      metric('drag_power_at_current_W', METRICS[7].label, D != null ? D * U : null, 'W', 'lower', 'derived', 'drag x U (lower bound on the power needed to hold station)', Swet == null ? 'wetted_area_m2 is null' : null),
      metric('red_muscle_power_W', METRICS[8].label, Pred, 'W', 'higher', 'derived', `myotomal fraction (${myo.kind}) x red fraction x mass x 134 W/kg x 1.88^((T-20)/10) (scup red muscle, borrowed)`, red == null ? 'red_muscle_fraction is null' : null),
      metric('ucrit_upper_bound_m_s', METRICS[9].label, bound, 'm/s', 'higher', 'derived', 'speed at which 0.5 rho C_D S_wet U^3 = red-muscle power, propulsive efficiency 1: an upper bound, rests on an assumed myotomal fraction', Pred == null ? 'red-muscle power not computable' : 'wetted_area_m2 or SL_m is null'),
    ];
    return {
      metrics, lean_inputs, survives: null, feasible, feasibility_note: limiting, limiting: null, provenance: prov,
      scope: 'Steady uniform current; holding station for the minutes of a Ucrit protocol, not hours. Ucrit is the measured wild-type zebrafish value (by stage, x SL, x the measured temperature curve); turbulence, shelter-seeking, schooling, hypoxia and training are not modelled. The drag figures are rigid flat-plate lower bounds and the speed bound is a true upper bound only if the assumed myotomal fraction is not too low. survives = null (being swept downstream is not modelled as lethal); feasible = can hold station: current <= Ucrit (zebrafish), or false if the current exceeds the physical upper bound (any species). Ucrit is a read-back of Plaut 2000 (kind calibrated), not an independent prediction.',
      validity: { inRange, notes: notes.join(' ') || 'within the measured ranges' },
    };
  },
  modelCard: {
    equations: [
      'Ucrit(T, age) = k(age) x SL x r(T); k = 15.5 SL/s for >= 28 dpf (Plaut 2000), 10.5 SL/s at 14 dpf (Umax 12.1 / 1.15), linear between; 0.03 m/s at 5 dpf, linear to 14 dpf',
      'r(T) = Ucrit(T)/Ucrit(28 °C), measured (Wakamatsu 2019)',
      'Umax = 1.15 Ucrit; feasible (hold station) = current <= Ucrit; survives = null',
      'Re = rho U SL / mu; C_D = 1.33 Re^-0.5 (Re < 5e5) or 0.072 Re^-0.2, on wetted area',
      'D = 0.5 rho C_D S_wet U^2 (lower bound); P_red = f_myo f_red m 134 x 1.88^((T-20)/10) W',
      'U_bound: 0.5 rho C_D(U) S_wet U^3 = P_red (upper bound on sustained speed)',
    ],
    sources: [
      { cite: WID.cite, doi_or_url: WID.doi },
      { cite: 'Wakamatsu Y, Ogino K, Hirata H (2019). Sci Rep 9:16307 (Ucrit vs temperature, fin length)', doi_or_url: 'https://doi.org/10.1038/s41598-019-52592-w' },
      { cite: LI.cite, doi_or_url: LI.doi },
      { cite: 'NIST Chemistry WebBook, Thermophysical Properties of Fluid Systems: water at 0.101325 MPa, 5-35 °C', doi_or_url: 'https://webbook.nist.gov/chemistry/fluid/' },
      { cite: 'Rome LC et al. (1992), scup red muscle power, via physiology/muscle.js (abstract)', doi_or_url: 'physiology/sources.json id rome1992' },
    ],
    validity: 'Zebrafish from 5 dpf to adult and SL <= 45.1 mm (Linf), 12-36 °C (temperature curve), Re ~1e2-1e5. For other species, and for blended designs larger than a zebrafish, only the physical bound and drag are computed.',
    validatedAgainst: [
      { organism: 'Danio rerio adults (literature summary)', observation: 'Ucrit 40-55 cm/s in adults (Widrick 2018 Introduction, citing refs 10-13)', predicted: '46.5 cm/s for SL 30 mm at 28 °C', measured: '40-55 cm/s (second-hand)', source: `${WID.doi}. PASS, but partly circular: the 15.5 SL/s comes from one of the cited studies (Plaut 2000)` },
      { organism: 'Danio rerio, long-finned pet-store (PET) strain, adults, 28 °C', observation: 'Ucrit 23.8 ± 0.7 cm/s (males and females 22-24 cm/s)', predicted: '~46 cm/s for a 30 mm SL wild-type adult', measured: '22-24 cm/s', source: 'Wakamatsu 2019 (https://doi.org/10.1038/s41598-019-52592-w). FAIL by about 2x. The paper shows long caudal fins and genetic background lower Ucrit; SL was not reported in the text, so the BL/s comparison could not be made exactly. A design with long fins will be over-predicted.' },
      { organism: 'Danio rerio adults', observation: 'measured Ucrit must lie below the physical upper bound', predicted: 'see test/scenarios-environment.mjs (bound computed for the fixture)', measured: '15.5 SL/s', source: 'consistency check, not a test against an independent measurement' },
    ],
  },
};
