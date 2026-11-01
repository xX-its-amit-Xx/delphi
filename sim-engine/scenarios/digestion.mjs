// digestion.mjs — feeding and digestion: daily energy intake at the average (recommended) ration, faecal
// loss, specific dynamic action, routine metabolic cost with its Q10, the resulting daily energy balance,
// the maintenance ration, and gut passage time where it was measured. Pure ESM, no imports. No bird data.
// Nutrition is held at "average" (conditions/baseline.json); the average ration is the published
// recommendation for laboratory zebrafish.

const SRC = {
  licitra2024: 'Licitra R, Fronte B, Verri T, Marchese M, Sangiacomo C, Santorelli FM 2024. Zebrafish feed intake: a systematic review for standardizing feeding management in laboratory conditions. Biology (Basel) 13:209. doi:10.3390/biology13040209 (PMC11047914, full text read)',
  hejlesen2024: 'Hejlesen R et al. 2024. Assessing metabolic rates in zebrafish using a 3D-printed intermittent-flow respirometer. Biol Open 13:bio060375. doi:10.1242/bio.060375 (PMC11212631, full text read)',
  ripley2022: 'Ripley DM, Quinn FA, Dickson J, Arthur J, Shiels HA 2022. J Exp Biol 225:jeb243774. doi:10.1242/jeb.243774 (PMC9845742, full text read)',
  barrionuevo1999: 'Barrionuevo WR, Burggren WW 1999. O2 consumption and heart rate in developing zebrafish (Danio rerio): influence of temperature and ambient O2. Am J Physiol 276:R505. doi:10.1152/ajpregu.1999.276.2.R505 (abstract read)',
  durnford2026: 'Durnford FPH, Porter ES, Gamperl AK 2026. J Exp Biol. doi:10.1242/jeb.252059 (PMC13245903), Table 1, as carried in physiology/cardiac.js',
  gerry2014: 'Gerry SP, Ellerby DJ 2014. PLoS One 9:e106030. doi:10.1371/journal.pone.0106030: "oxycaloric value of 13.54 J mg-1 O2" (secondhand, as in physiology/muscle.js)',
  mcleod2016: 'McLeod IM, Clark TD 2016. Limited capacity for faster digestion in larval coral reef fish at an elevated temperature. PLoS One 11:e0155360. doi:10.1371/journal.pone.0155360 (PMC4871548, Table 4)',
  sumule2003: 'Sumule O, Koshio S, Teshima S, Ishikawa M 2003. Energy budget of Japanese flounder larvae. Aquac Res 34:877. doi:10.1046/j.1365-2109.2003.00896.x (abstract read)',
  zada2022: 'Zada A et al. 2022. TFAP2B haploinsufficiency impacts gastrointestinal function. Front Cell Dev Biol 10:901824. doi:10.3389/fcell.2022.901824 (PMC9304996, full text read)',
  bernreuther2009: 'Bernreuther M, Temming A, Herrmann JP 2009. Effect of temperature on the gastric evacuation in sprat Sprattus sprattus. J Fish Biol 75:1525. doi:10.1111/j.1095-8649.2009.02353.x (abstract read)',
  ferreira2019: 'Ferreira MS et al. 2019. Metabolic fuel use after feeding in the zebrafish. J Exp Biol 222:jeb194217. doi:10.1242/jeb.194217 (abstract read)',
};
const V = (s, k) => { const f = s?.[k]; return f && typeof f === 'object' && 'value' in f ? f.value : (f ?? null); };
const r3 = x => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const MG_PER_UMOL = 0.032, J_PER_MG = 13.54;
const METRICS = [
  { key: 'routine_metabolic_rate_mgO2_kg_h', label: 'Routine/standard metabolic rate', unit: 'mg O2/kg/h', better: null },
  { key: 'routine_cost_J_day', label: 'Routine metabolic cost', unit: 'J/day', better: 'lower' },
  { key: 'energy_intake_J_day', label: 'Energy ingested at the average ration', unit: 'J/day', better: 'higher' },
  { key: 'sda_cost_J_day', label: 'Specific dynamic action (cost of digesting)', unit: 'J/day', better: 'lower' },
  { key: 'net_energy_J_day', label: 'Net energy after faeces, SDA and routine metabolism', unit: 'J/day', better: 'higher' },
  { key: 'maintenance_ration_pct_bw_day', label: 'Ration that just balances routine metabolism', unit: '% body mass/day', better: 'lower' },
  { key: 'gut_passage_time_h', label: 'Gut passage time (75% of guts empty)', unit: 'h', better: null },
];
const L = k => METRICS.find(m => m.key === k);
const met = (k, value, kind, source, extra = {}) => {
  const v = value == null || (typeof value === 'number' && !Number.isFinite(value)) ? null : value;
  return { key: k, label: L(k).label, value: v, unit: L(k).unit, better: L(k).better, kind: v == null ? 'assumed' : kind, source: v == null ? `no value: ${extra.reason || source}` : source, ...extra };
};
const nul = (k, reason) => met(k, null, 'assumed', reason, { reason });

/** Mass-specific routine/standard MO2 in mg O2 kg-1 h-1 at temperature T, with its provenance. */
export function routineMO2(species, stage, dpf, T) {
  const zebra = /danio/i.test(species);
  if (zebra && (stage === 'adult' || (dpf != null && dpf >= 100))) {
    const ref = 119 * 60 * MG_PER_UMOL, Q10 = 1.39, Tref = 26; // 119 umol/min/kg = 228.5 mg/kg/h
    return { v: T == null ? ref : ref * Math.pow(Q10, (T - Tref) / 10), kind: 'measured', Q10, Tref, src: `Hejlesen 2024: adult zebrafish "mean SMR of 119±15.9 µmol O2·min-1·kg-1" (423 mg fish, 26 C) = 228.5 mg/kg/h; Q10 1.39 for SMR over 23-35.5 C (Ripley 2022: "SMR Q 10 =1.39"); ${SRC.hejlesen2024}; ${SRC.ripley2022}`, valid: [23, 35.5] };
  }
  if (zebra) {
    // log-linear in age between ~40 umol/g/h at day 10 and 4.5 at day 100 (28 C); Q10 2.5 (2-3 for days 10-60)
    const d = dpf == null ? 10 : Math.min(100, Math.max(10, dpf));
    const u = Math.exp(Math.log(40) + (Math.log(4.5) - Math.log(40)) * (d - 10) / 90); // umol/g/h
    const ref = u * 1000 * MG_PER_UMOL, Q10 = 2.5, Tref = 28;
    return { v: T == null ? ref : ref * Math.pow(Q10, (T - Tref) / 10), kind: d === dpf ? 'derived' : 'borrowed', Q10, Tref, src: `Barrionuevo & Burggren 1999: "MO2 in normoxic fish at 28 degreesC peaked at approximately 40 micromol. g-1. h-1 at day 10, thereafter falling to 4-5 micromol. g-1. h-1 at day 100"; "Q10 for MO2 ... 2-3 from day 10 to day 60"; log-linear interpolation in age, Q10 2.5; ${SRC.barrionuevo1999}`, valid: [25, 31] };
  }
  const ref = 224.92, Q10 = 1.39, Tref = 28;
  return { v: T == null ? ref : ref * Math.pow(Q10, (T - Tref) / 10), kind: 'borrowed', Q10, Tref, src: `no flying-fish metabolic rate found: schoolmaster snapper resting MO2 224.92 mg O2/kg/h at 28 C (${SRC.durnford2026}), with the zebrafish SMR Q10 1.39; mass scaling ignored`, valid: [23, 31] };
}

export default {
  key: 'digestion',
  title: 'Feeding and digestion: intake, SDA, routine cost and gut passage time',
  group: 'physiology',
  requires: ['mass_kg'],
  needs: ['species', 'stage', 'ageDays', 'temperature_C', 'parts.intestine'],
  params: [
    { key: 'ration_pct_bw_day', label: 'Daily ration, dry feed (null = stage average)', unit: '% body mass/day', default: null, min: 0, max: 400, kind: 'measured-secondhand', source: 'null -> Licitra 2024 recommendation at 28.5 C: "for larvae ... 9-10% of BW per day, minimum; for juveniles, 6-8% of BW; for adults, 5% of BW" (midpoints 9.5, 7, 5)' },
    { key: 'diet_energy_kJ_g', label: 'Energy density of the dry diet', unit: 'kJ/g', default: 20, min: 1, max: 30, kind: 'measured-secondhand', source: 'Licitra 2024: rates "based on the use of a dry diet containing 20 kj/g (as fed basis)"' },
    { key: 'faecal_loss_fraction', label: 'Fraction of ingested energy lost in faeces', unit: 'fraction', default: 0.228, min: 0, max: 0.9, kind: 'borrowed', source: 'Sumule 2003, Japanese flounder larvae on enriched Artemia: "22.8% to faecal loss" (35.4% on non-enriched); ' + SRC.sumule2003 },
    { key: 'sda_coefficient', label: 'SDA as a fraction of meal energy', unit: 'fraction', default: 0.1014, min: 0, max: 0.5, kind: 'borrowed', source: 'McLeod & Clark 2016, larval clownfish Amphiprion percula at 28.5 C: "SDA coefficient (%) 10.14 ± 1.34" (12.96 at 31.5 C); no zebrafish or cyprinid coefficient found; ' + SRC.mcleod2016 },
  ],
  metrics: METRICS,

  run(state, params) {
    const prov = []; const notes = []; let inRange = true;
    const P = (quantity, value, kind, source) => prov.push({ quantity, value, kind, source });
    const M = V(state, 'mass_kg'); const sp = String(V(state, 'species') || ''); const zebra = /danio/i.test(sp);
    const stage = String(V(state, 'stage') || '').toLowerCase(); const age = V(state, 'ageDays'); const T = V(state, 'temperature_C');
    const dpf = age == null ? null : age + 2;
    if (stage === 'egg' || (age != null && age < 0)) {
      const reason = 'embryo: lives on yolk, no feeding';
      return { metrics: METRICS.map(m => nul(m.key, reason)), survives: null, feasible: null, limiting: reason, provenance: [], scope: 'Endogenous (yolk) feeding is not modelled.', validity: { inRange: false, notes: reason } };
    }
    if (zebra && dpf != null && dpf < 5) notes.push(`about ${dpf} dpf: zebrafish larvae start exogenous feeding around 5 dpf (yolk not modelled).`);
    if (!zebra) { inRange = false; notes.push('no flying-fish metabolic rate, ration, SDA or gut transit was found; every input is borrowed (flying fish are copepod specialists, Van Noord 2013, doi:10.1111/jfb.12173, which no input reflects).'); }

    const R = routineMO2(sp, stage, dpf, T);
    if (T != null && (T < R.valid[0] || T > R.valid[1])) { inRange = false; notes.push(`temperature ${T} C outside ${R.valid[0]}-${R.valid[1]} C where the Q10 was measured.`); }
    P('routine MO2', r3(R.v), R.kind, R.src); P('MO2 Q10', R.Q10, R.kind === 'measured' ? 'measured' : 'measured-secondhand', R.src);
    P('oxycalorific coefficient', J_PER_MG, 'measured-secondhand', SRC.gerry2014);
    const routineJ = R.v * M * 24 * J_PER_MG;

    const larva = stage === 'hatching' || stage === 'larva';
    const defRation = larva ? 9.5 : stage === 'juvenile' ? 7 : 5;
    const ration = params.ration_pct_bw_day != null ? params.ration_pct_bw_day : defRation;
    const rKind = params.ration_pct_bw_day != null ? 'assumed' : (zebra ? 'measured-secondhand' : 'borrowed');
    P('ration', ration, rKind, params.ration_pct_bw_day != null ? 'user parameter' : 'Licitra 2024 recommended stage ration (a husbandry recommendation, not a measured intake)');
    const gut = state?.parts?.intestine; const noGut = gut && typeof gut.scale === 'number' && gut.scale <= 0;
    const intakeJ = noGut ? 0 : (ration / 100) * (M * 1000) * params.diet_energy_kJ_g * 1000;
    const faecesJ = intakeJ * params.faecal_loss_fraction;
    const sdaJ = intakeJ * params.sda_coefficient;
    const net = intakeJ - faecesJ - sdaJ - routineJ;
    const usable = (1 - params.faecal_loss_fraction - params.sda_coefficient);
    const maint = usable > 0 ? 100 * routineJ / ((M * 1000) * params.diet_energy_kJ_g * 1000 * usable) : null;
    P('faecal loss fraction', params.faecal_loss_fraction, 'borrowed', SRC.sumule2003);
    P('SDA coefficient', params.sda_coefficient, 'borrowed', SRC.mcleod2016);

    // gut passage time: measured only in 7 dpf larvae (28 C); temperature via the sprat evacuation exponent
    let gpt = null, gptReason = null;
    if (noGut) gptReason = 'intestine removed by a part edit';
    else if (zebra && larva) {
      gpt = 16 * (T == null ? 1 : Math.exp(-0.0775 * (T - 28)));
      P('gut passage time at 28 C', 16, 'measured', 'Zada 2022: "75% of wild type fish had an empty intestine 16 h after food intake" (7 dpf, 28 C); ' + SRC.zada2022);
      if (T != null) P('evacuation temperature exponent', 0.0775, 'borrowed', 'Bernreuther 2009, sprat: C24 = 0.0177 e^(0.0775 T), exponential between 7.5 and 16 C (Q10 about 2.2); ' + SRC.bernreuther2009);
      if (T != null && (T < 24 || T > 31)) notes.push('gut passage time extrapolated in temperature with a sprat exponent fitted below 16 C.');
    } else gptReason = zebra ? 'no juvenile or adult zebrafish gut transit time was found (zebrafish have no true stomach, Licitra 2024)' : 'no flying-fish gut transit time was found';

    const survives = noGut ? false : net >= 0;
    const limiting = noGut ? 'no intestine: nothing can be absorbed' : net >= 0
      ? `energy surplus ${r3(net)} J/day at ${ration}% BW/day (maintenance ${r3(maint)}% BW/day)`
      : `routine cost exceeds usable intake by ${r3(-net)} J/day at ${ration}% BW/day; maintenance needs ${r3(maint)}% BW/day`;
    if (noGut) notes.push('intestine part scale is 0.');
    const kIntake = rKind === 'assumed' ? 'derived' : 'derived';
    return {
      metrics: [
        met('routine_metabolic_rate_mgO2_kg_h', r3(R.v), R.kind === 'measured' ? (T == null || T === R.Tref ? 'calibrated' : 'derived') : R.kind, R.src),
        met('routine_cost_J_day', r3(routineJ), 'derived', 'MO2 x mass x 24 h x 13.54 J/mg O2'),
        met('energy_intake_J_day', r3(intakeJ), kIntake, `ration ${ration}% BW x mass x ${params.diet_energy_kJ_g} kJ/g` + (noGut ? ' (zero: no intestine)' : '')),
        met('sda_cost_J_day', r3(sdaJ), 'derived', 'SDA coefficient x intake'),
        met('net_energy_J_day', r3(net), 'derived', 'intake x (1 - faecal - SDA) - routine cost'),
        maint == null ? nul('maintenance_ration_pct_bw_day', 'faecal + SDA fractions leave nothing usable') : met('maintenance_ration_pct_bw_day', r3(maint), 'derived', 'routine cost / (mass x diet energy x (1 - faecal - SDA))'),
        gpt == null ? nul('gut_passage_time_h', gptReason) : met('gut_passage_time_h', r3(gpt), T == null || T === 28 ? 'calibrated' : 'derived', SRC.zada2022),
      ],
      survives, feasible: !noGut, limiting, provenance: prov,
      scope: 'survives = routine metabolism is covered by usable intake at this ration (false with no intestine); feasible = the animal can feed and absorb at all (an intestine is present). A daily energy budget at routine (resting) metabolism. It excludes locomotion, growth, reproduction and feeding behaviour, uses a husbandry ration rather than a measured intake, borrows faecal loss and SDA from other species, and treats SDA as a fixed fraction of the meal. A positive balance does not mean the fish grows at any particular rate.',
      validity: { inRange, notes: notes.join(' ') || 'within the measured stage and temperature ranges' },
    };
  },

  modelCard: {
    equations: [
      'adult zebrafish: MO2 = 228.5 x 1.39^((T - 26)/10) mg O2/kg/h',
      'larval/juvenile zebrafish: MO2 = exp(ln 40 + (ln 4.5 - ln 40)(d - 10)/90) umol/g/h x 32 x 2.5^((T - 28)/10), d = dpf clamped to 10-100',
      'routine cost (J/day) = MO2 x M x 24 x 13.54',
      'intake (J/day) = ration/100 x M(g) x E_diet;  SDA = c_SDA x intake;  faeces = f_F x intake',
      'net = intake (1 - f_F - c_SDA) - routine;  survives = net >= 0',
      'maintenance ration = 100 x routine / (M(g) x E_diet x (1 - f_F - c_SDA))',
      'larval gut passage time = 16 h x exp(-0.0775 (T - 28))',
    ],
    sources: [
      { cite: 'Hejlesen et al. 2024, Biol Open 13:bio060375 (adult SMR 119 umol/min/kg, 26 C)', doi_or_url: 'https://doi.org/10.1242/bio.060375' },
      { cite: 'Ripley et al. 2022, J Exp Biol 225:jeb243774 (SMR Q10 1.39)', doi_or_url: 'https://doi.org/10.1242/jeb.243774' },
      { cite: 'Barrionuevo & Burggren 1999, Am J Physiol 276:R505 (MO2 through development; Q10)', doi_or_url: 'https://doi.org/10.1152/ajpregu.1999.276.2.R505' },
      { cite: 'Licitra et al. 2024, Biology 13:209 (rations; 20 kJ/g; maintenance ~2%)', doi_or_url: 'https://doi.org/10.3390/biology13040209' },
      { cite: 'McLeod & Clark 2016, PLoS One 11:e0155360 (SDA coefficient 10.14%)', doi_or_url: 'https://doi.org/10.1371/journal.pone.0155360' },
      { cite: 'Sumule et al. 2003, Aquac Res 34:877 (faecal loss 22.8%)', doi_or_url: 'https://doi.org/10.1046/j.1365-2109.2003.00896.x' },
      { cite: 'Zada et al. 2022, Front Cell Dev Biol 10:901824 (75% guts empty at 16 h, 7 dpf, 28 C)', doi_or_url: 'https://doi.org/10.3389/fcell.2022.901824' },
      { cite: 'Bernreuther et al. 2009, J Fish Biol 75:1525 (evacuation exponent 0.0775 /C)', doi_or_url: 'https://doi.org/10.1111/j.1095-8649.2009.02353.x' },
      { cite: 'Durnford et al. 2026, J Exp Biol (snapper resting MO2, borrowed for flying fish)', doi_or_url: 'https://doi.org/10.1242/jeb.252059' },
      { cite: 'Gerry & Ellerby 2014, PLoS One 9:e106030 (13.54 J/mg O2)', doi_or_url: 'https://doi.org/10.1371/journal.pone.0106030' },
      { cite: 'Ferreira et al. 2019, J Exp Biol 222:jeb194217 (adult zebrafish SDA +78% at 7-8 h; validation only)', doi_or_url: 'https://doi.org/10.1242/jeb.194217' },
    ],
    validity: 'Zebrafish 5 dpf to adult at 23-31 C on a 20 kJ/g dry diet. Flying fish: every input borrowed. Gut passage time only for zebrafish larvae.',
    validatedAgainst: [
      { organism: 'Danio rerio adult', observation: 'maintenance feed intake (Licitra 2024, citing Fronte, unpublished): "a maintenance FI of ~2% of BW"', predicted: 'about 0.6% BW/day at 28.5 C', measured: '~2% BW/day (secondhand, unpublished data)', source: 'doi:10.3390/biology13040209 — FAILS low by about 3x: SMR excludes spontaneous activity, and diet digestibility and the borrowed SDA/faecal fractions are untested' },
      { organism: 'Danio rerio', observation: 'routine MO2 near 100 dpf from two labs', predicted: 'Barrionuevo d100 at 28 C: 4.5 umol/g/h = 144 mg/kg/h', measured: 'Hejlesen 2024 adult SMR at 26 C: 228.5 mg/kg/h', source: 'doi:10.1152/ajpregu.1999.276.2.R505 vs doi:10.1242/bio.060375 — the measured inputs disagree by 1.6x (more after temperature correction); the model jumps at 100 dpf where it switches source' },
      { organism: 'Danio rerio adult', observation: 'SDA time course (Ferreira 2019: peak +78% at 7-8 h, still elevated at 10 h, 2.12% ration)', predicted: 'a 10% SDA coefficient at 2.12% ration implies a triangular response lasting about 33 h if the peak is +78% of SMR at 28 C', measured: 'still elevated at 10 h; end not reported in the abstract', source: 'doi:10.1242/jeb.194217 — not refuted, not confirmed' },
    ],
  },
};
