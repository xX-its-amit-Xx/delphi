// temperature.mjs: acute water-temperature exposure. Critical thermal limits that move with acclimation
// temperature, the measured zebrafish Ucrit-temperature curve, and Q10 scaling of metabolic rate.
// Pure ESM, no imports. Every number below was fetched on 2026-10-31 (sources in modelCard). No bird data.

// Cortemeglia & Beitinger 2005, wild-type zebrafish, ramping CTM method (abstract, Crossref record):
//   acclimated 20 degC: CTmax 39.2 +/- 0.34, CTmin 6.2 +/- 0.28; acclimated 30 degC: CTmax 41.7 +/- 0.35, CTmin 10.6 +/- 0.53.
const CB = { Ta: [20, 30], CTmax: [39.2, 41.7], CTmin: [6.2, 10.6],
  cite: 'Cortemeglia C, Beitinger TL (2005). Temperature tolerances of wild-type and red transgenic zebra danios. Trans Am Fish Soc 134:1431-1437 (abstract)',
  doi: 'https://doi.org/10.1577/T04-197.1' };
const lin = (x, [x0, x1], [y0, y1]) => y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);

// Wakamatsu et al. 2019, adult PET-strain zebrafish reared at 28 degC, Ucrit (cm/s, mean, n = 10 each) at test temperature.
// At 38 degC all fish failed to swim at 10 cm/s (Ucrit < 10 cm/s, i.e. < 0.42 of the 28 degC value).
const WAK = [[12, 11.6], [14, 15.4], [16, 22.0], [24, 22.5], [26, 23.6], [28, 23.8], [30, 23.1], [34, 18.5], [36, 15.9]];
const WAK_REF = 23.8;
const WAK_SRC = 'Wakamatsu Y, Ogino K, Hirata H (2019). Swimming capability of zebrafish is governed by water temperature, caudal fin length and genetic background. Sci Rep 9:16307, Results (Fig. 3 values in text)';
const WAK_DOI = 'https://doi.org/10.1038/s41598-019-52592-w';
export function ucritRel(T) {
  if (T < WAK[0][0] || T > 38) return { value: null, reason: `${T} degC is outside the measured 12-38 degC` };
  if (T > 36) return { value: null, reason: 'above 36 degC: at 38 degC every fish failed to swim at 10 cm/s (Ucrit < 0.42 of the 28 degC value); no point value' };
  for (let i = 1; i < WAK.length; i++) if (T <= WAK[i][0]) return { value: lin(T, [WAK[i - 1][0], WAK[i][0]], [WAK[i - 1][1], WAK[i][1]]) / WAK_REF };
  return { value: WAK.at(-1)[1] / WAK_REF };
}

// Ripley et al. 2022: 28 degC-acclimated zebrafish, acute tests at 23.0-35.5 degC: SMR Q10 1.39, MMR Q10 1.15.
const Q10 = { SMR: 1.39, MMR: 1.15, range: [23, 35.5],
  cite: 'Ripley DM, Quinn FA, Dickson J, Arthur J, Shiels HA (2022). Thermal preference does not align with optimal temperature for aerobic scope in zebrafish (Danio rerio). J Exp Biol 225:jeb243774',
  doi: 'https://doi.org/10.1242/jeb.243774' };

const val = (s, k) => (s && s[k] && s[k].value != null ? s[k].value : null);
function metric(key, label, value, unit, better, kind, source, reason) {
  const ok = typeof value === 'number' ? Number.isFinite(value) : typeof value === 'boolean';
  const m = { key, label, value: ok ? value : null, unit, better, kind: ok ? kind : 'assumed', source: ok ? source : 'none' };
  if (!ok) m.reason = reason || 'not computable from the inputs given';
  return m;
}
const isZebrafish = s => /danio rerio|zebrafish/i.test(String(val(s, 'species') || ''));

const METRICS = [
  { key: 'ctmax_C', label: 'Critical thermal maximum at this acclimation', unit: '°C', better: 'higher' },
  { key: 'ctmin_C', label: 'Critical thermal minimum at this acclimation', unit: '°C', better: 'lower' },
  { key: 'thermal_margin_C', label: 'Distance to the nearer critical limit', unit: '°C', better: 'higher' },
  { key: 'ucrit_relative', label: 'Ucrit relative to the 28 °C value (measured curve)', unit: '1', better: 'higher' },
  { key: 'smr_factor', label: 'Standard metabolic rate relative to acclimation temperature (Q10)', unit: '1', better: null },
  { key: 'mmr_factor', label: 'Maximum metabolic rate relative to acclimation temperature (Q10)', unit: '1', better: null },
];

export const needs = [];

export default {
  key: 'temperature',
  title: 'Water temperature: critical thermal limits, swimming capacity and metabolic rate',
  group: 'environment',
  params: [
    { key: 'water_temperature_C', label: 'Exposure water temperature', unit: '°C', default: 25, min: 0, max: 45, kind: 'assumed', source: 'design input; default = conditions/baseline.json water_temperature_C (25, assumed)' },
    { key: 'acclimation_temperature_C', label: 'Temperature the animal is acclimated to', unit: '°C', default: 25, min: 15, max: 35, kind: 'assumed', source: 'design input; default = conditions/baseline.json (25). Measured acclimation range of the CT data: 20-30 degC' },
  ],
  requires: ['species'],
  metrics: METRICS,
  needs,
  run(state, params = {}) {
    const T = params.water_temperature_C ?? 25;
    const Ta = params.acclimation_temperature_C ?? 25;
    const age = val(state, 'ageDays');
    const stage = String(val(state, 'stage') || '');
    const prov = [];
    const notes = [];
    let inRange = true;
    if (!isZebrafish(state)) {
      const why = `no thermal tolerance, Ucrit-temperature or Q10 measurement was found for ${val(state, 'species') || 'this species'} (searched Europe PMC 2026-10-31; flying fish: none). Zebrafish values are not substituted.`;
      return {
        metrics: METRICS.map(d => metric(d.key, d.label, null, d.unit, d.better, 'assumed', 'none', why)),
        survives: null, feasible: null, limiting: null, provenance: prov,
        scope: `Nothing computed: ${why}`,
        validity: { inRange: false, notes: why },
      };
    }
    const blended = /\+/.test(String(val(state, 'species')));
    const zkind = blended ? 'borrowed' : 'measured';
    if (blended) notes.push('Blend of species: zebrafish thermal data are applied to the whole design (borrowed).');
    if (stage === 'egg' || (age != null && age < 0)) {
      const why = 'embryo (egg stage): the CT data are for larvae (5-9 dpf) and adults; embryonic tolerance is not modelled';
      return { metrics: METRICS.map(d => metric(d.key, d.label, null, d.unit, d.better, 'assumed', 'none', why)), survives: null, feasible: null, limiting: null, provenance: prov, scope: why, validity: { inRange: false, notes: why } };
    }
    // ageDays is days after hatching; zebrafish hatch at ~2 dpf (development/zebrafish/stages.json).
    const dpf = age != null ? age + 2 : null;
    if (dpf != null && dpf < 5) { inRange = false; notes.push(`~${dpf.toFixed(1)} dpf is younger than the youngest CTmax measurement (5 dpf, Andreassen 2022).`); }
    if (dpf != null && dpf < 60) notes.push('Larval CTmax (5 and 9 dpf, 41.4 and 41.3 degC) equals the adult value (41.0) at 28 degC acclimation (Andreassen 2022); the acclimation slope is from adults and is borrowed for larvae. CTmin was not measured in larvae.');
    if (Ta < CB.Ta[0] || Ta > CB.Ta[1]) { inRange = false; notes.push(`Acclimation ${Ta} degC is outside the measured 20-30 degC: CT limits linearly extrapolated.`); }
    const ctmax = lin(Ta, CB.Ta, CB.CTmax);
    const ctmin = lin(Ta, CB.Ta, CB.CTmin);
    const margin = Math.min(ctmax - T, T - ctmin);
    const ur = ucritRel(T);
    if (Math.abs(Ta - 28) > 1) notes.push('The Ucrit curve was measured in 28 degC-reared fish; at another acclimation temperature it is borrowed.');
    const smrOk = T >= Q10.range[0] - 0.01 && T <= Q10.range[1] + 0.01 && Math.abs(Ta - 28) <= 3;
    if (!smrOk) notes.push(`Q10 values were measured for 28 degC-acclimated fish over 23-35.5 degC; outside that (T ${T}, acclimation ${Ta}) they are extrapolated.`);
    if (T < 0 || T > 45) inRange = false;
    prov.push(
      { quantity: 'CTmax at 20 / 30 degC acclimation', value: '39.2 / 41.7 degC', kind: zkind, source: `${CB.cite}, ${CB.doi}` },
      { quantity: 'CTmin at 20 / 30 degC acclimation', value: '6.2 / 10.6 degC', kind: zkind, source: `${CB.cite}, ${CB.doi}` },
      { quantity: 'Ucrit(T) curve, 28 degC-reared adults', value: JSON.stringify(WAK), kind: zkind, source: `${WAK_SRC}, ${WAK_DOI}` },
      { quantity: 'Q10 SMR / MMR', value: '1.39 / 1.15', kind: smrOk ? zkind : 'borrowed', source: `${Q10.cite}, ${Q10.doi}` },
    );
    const survives = T > ctmin && T < ctmax;
    const limiting = T >= ctmax ? `above CTmax (${ctmax.toFixed(1)} degC): loss of equilibrium in an acute ramp` : T <= ctmin ? `below CTmin (${ctmin.toFixed(1)} degC): loss of equilibrium in an acute ramp` : null;
    const feasibilityNote = ur.value != null && ur.value < 0.8 ? `swimming capacity reduced to ${(ur.value * 100).toFixed(0)}% of the 28 degC value`
      : ur.value == null && T > 36 ? 'swimming capacity collapses: at 38 degC every fish failed to swim at 10 cm/s (Wakamatsu 2019), below CTmax' : null;
    // Amendment A1: a line through the two points of the paper it is scored against is a read-back -> calibrated.
    const ctKind = Ta >= 20 && Ta <= 30 ? 'calibrated' : 'assumed';
    const metrics = [
      metric('ctmax_C', METRICS[0].label, ctmax, '°C', 'higher', ctKind, `linear in acclimation temperature between the two measured points (${CB.cite})`),
      metric('ctmin_C', METRICS[1].label, ctmin, '°C', 'lower', ctKind, `linear in acclimation temperature between the two measured points (${CB.cite})`),
      metric('thermal_margin_C', METRICS[2].label, margin, '°C', 'higher', ctKind, 'min(CTmax - T, T - CTmin); negative = past a limit'),
      metric('ucrit_relative', METRICS[3].label, ur.value, '1', 'higher', zkind === 'measured' && Math.abs(Ta - 28) <= 1 ? 'calibrated' : 'borrowed', `linear interpolation of the measured means (${WAK_SRC})`, ur.reason),
      metric('smr_factor', METRICS[4].label, Q10.SMR ** ((T - Ta) / 10), '1', null, smrOk ? 'calibrated' : 'assumed', `Q10 1.39 ^ ((T - T_acclimation)/10) (${Q10.cite})`),
      metric('mmr_factor', METRICS[5].label, Q10.MMR ** ((T - Ta) / 10), '1', null, smrOk ? 'calibrated' : 'assumed', `Q10 1.15 ^ ((T - T_acclimation)/10) (${Q10.cite})`),
    ];
    return {
      metrics, survives, feasible: null, feasibility_note: feasibilityNote, limiting, provenance: prov,
      scope: 'Acute exposure (minutes to hours) of an acclimated zebrafish. CT limits are ramp-test endpoints (loss of equilibrium), not lethal temperatures or long-term limits; chronic exposure, growth, reproduction and interactions with hypoxia are not modelled. Fin or wing edits do not change these numbers: the scenario reads only species, stage and temperature. survives = CTmin < T < CTmax; feasible = null (swimming capacity is in ucrit_relative and feasibility_note). CT limits, Ucrit(T) and Q10 are read back from their source papers (kind calibrated): not independent predictions.',
      validity: { inRange, notes: notes.join(' ') || 'within the measured ranges' },
    };
  },
  modelCard: {
    equations: [
      'CTmax(Ta) = 39.2 + 0.25 (Ta - 20)   [°C; Ta = acclimation temperature, 20-30 °C]',
      'CTmin(Ta) = 6.2 + 0.44 (Ta - 20)',
      'thermal_margin = min(CTmax - T, T - CTmin); survives = CTmin < T < CTmax',
      'Ucrit(T)/Ucrit(28 °C) = linear interpolation of measured means, 12-36 °C',
      'SMR(T)/SMR(Ta) = 1.39^((T - Ta)/10); MMR(T)/MMR(Ta) = 1.15^((T - Ta)/10)',
    ],
    sources: [
      { cite: CB.cite, doi_or_url: CB.doi },
      { cite: WAK_SRC, doi_or_url: WAK_DOI },
      { cite: Q10.cite, doi_or_url: Q10.doi },
      { cite: 'Morgan R, Finnøen MH, Jutfelt F (2018). CTmax is repeatable and doesn\'t reduce growth in zebrafish. Sci Rep 8:7099 (validation)', doi_or_url: 'https://doi.org/10.1038/s41598-018-25593-4' },
      { cite: 'Andreassen AH et al. (2022). Brain dysfunction during warming is linked to oxygen limitation in larval zebrafish. PNAS 119:e2207052119 (validation; larval CTmax)', doi_or_url: 'https://doi.org/10.1073/pnas.2207052119' },
      { cite: 'Rome LC et al. 1992 via physiology/muscle.js: scup red muscle power Q10 1.88 (used only in the failed alternative model)', doi_or_url: 'physiology/sources.json id rome1992' },
    ],
    validity: 'Zebrafish only (any design whose species includes Danio rerio); larvae from 5 dpf and adults; acclimation 20-30 °C; exposure 12-36 °C for Ucrit, 23-35.5 °C for Q10. Flying fish: no data, metrics null.',
    validatedAgainst: [
      { organism: 'Danio rerio adults, 28 °C acclimation, 0.3 °C/min ramp', observation: 'CTmax, first trial', predicted: '41.2 °C', measured: '40.97 ± 0.10 °C (n = 40)', source: 'Morgan et al. 2018 Results (https://doi.org/10.1038/s41598-018-25593-4). PASS: +0.23 °C, inside the ±0.5 °C criterion; different lab, strain and ramp rate from the calibration data' },
      { organism: 'Danio rerio adults, 28 °C', observation: 'CTmax (loss of equilibrium)', predicted: '41.2 °C', measured: '41.0 ± 0.1 °C (n = 15)', source: 'Andreassen et al. 2022 Results (https://doi.org/10.1073/pnas.2207052119). PASS (+0.2 °C)' },
      { organism: 'Danio rerio larvae, 5 dpf, 28 °C', observation: 'CTmax (loss of response)', predicted: '41.2 °C (adult slope borrowed)', measured: '41.4 ± 0.1 °C (n = 12); 9 dpf 41.3 ± 0.2', source: 'Andreassen et al. 2022. PASS (-0.2 °C); different endpoint (loss of response) from adults' },
      { organism: 'Danio rerio adults, 28 °C-reared', observation: 'Ucrit at 12-30 °C, tested against an ALTERNATIVE model: Ucrit ∝ (red-muscle power)^(1/3) with power Q10 1.88 (rome1992)', predicted: 'Ucrit(16)/Ucrit(28) = 0.78; Ucrit(12)/Ucrit(28) = 0.71', measured: '0.92 and 0.49 (Wakamatsu 2019)', source: 'FAIL in both directions (too sensitive on the 16-30 °C plateau, not sensitive enough below 16 °C). That is why the module uses the measured curve, not a Q10 power law.' },
    ],
  },
};
