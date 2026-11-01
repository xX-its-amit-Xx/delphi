// sleep.mjs — zebrafish sleep amount by stage, light phase and temperature, with the hypocretin levers
// that have measured effects (hcrt overexpression in larvae, Prober et al. 2006; hcrtr loss in adults,
// Yokogawa et al. 2007). A lookup on measurements, not a mechanistic sleep model. Pure ESM, no imports.
// No bird data. genotype/ does not carry hcrt or hcrtr, so the levers are scenario parameters.
//
// SLEEP DEFINITIONS ARE NOT INTERCHANGEABLE, so two series are reported side by side, never mixed:
//  * primary (sleep_fraction_night / sleep_fraction_day): the 6-second immobility criterion.
//    Night: Sorribes et al. 2013, the ONE study that applied the same criterion at every age (larva, juvenile,
//    adult, 28.5 C, 14:10 LD). Day: Yokogawa 2007 (adult, same 6 s criterion, a different lab).
//  * alternative (alt_*): each stage's own most-cited definition, from a single paper per stage:
//    larva = Choudhary 2026 (speed < 0.5 mm/s for >= 1 min), adult = Yokogawa 2007 (6 s, < 6 pixels/s).
// Lookup outputs are labelled 'calibrated': they are the source numbers read back (harness amendment A1).

const SRC = {
  sorribes2013: 'Sorribes A et al. 2013. The ontogeny of sleep-wake cycles in zebrafish: a comparison to humans. Front Neural Circuits 7:178. doi:10.3389/fncir.2013.00178 (PMC3826060, full text read; Table 1 "Percent time of night")',
  choudhary2026: 'Choudhary V et al. 2026. Eye movement kinematics reveal novel circadian organization of sleep substates. Nat Commun 17:4068. doi:10.1038/s41467-026-72222-0 (PMC13144723, full text read)',
  prober2006: 'Prober DA, Rihel J, Onah AA, Sung RJ, Schier AF 2006. J Neurosci 26:13400. doi:10.1523/JNEUROSCI.4332-06.2006 (PMC6675014, full text read)',
  yokogawa2007: 'Yokogawa T et al. 2007. Characterization of sleep in zebrafish and insomnia in hypocretin receptor mutants. PLoS Biol 5:e277. doi:10.1371/journal.pbio.0050277 (PMC2020497, full text read)',
};
const V = (s, k) => { const f = s?.[k]; return f && typeof f === 'object' && 'value' in f ? f.value : (f ?? null); };
const r3 = x => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const METRICS = [
  { key: 'sleep_fraction_night', label: 'Night sleep fraction, 6 s immobility criterion (one definition across ages)', unit: 'fraction', better: null },
  { key: 'sleep_fraction_day', label: 'Day sleep fraction, 6 s immobility criterion', unit: 'fraction', better: null },
  { key: 'alt_def_sleep_fraction_night', label: 'Night sleep fraction, stage-specific definition (larva: < 0.5 mm/s for >= 1 min; adult: 6 s)', unit: 'fraction', better: null },
  { key: 'alt_def_sleep_fraction_day', label: 'Day sleep fraction, stage-specific definition', unit: 'fraction', better: null },
  { key: 'sleep_hours_per_day', label: 'Sleep per 24 h (stage-specific definition, day and night from one paper)', unit: 'h', better: null },
  { key: 'night_sleep_latency_min', label: 'Latency to the first night sleep bout (larva)', unit: 'min', better: null },
  { key: 'sleep_criterion_s', label: 'Immobility criterion of the stage-specific definition', unit: 's', better: null },
];
const L = k => METRICS.find(m => m.key === k);
const met = (k, value, kind, source, extra = {}) => {
  const v = value == null || (typeof value === 'number' && !Number.isFinite(value)) ? null : value;
  return { key: k, label: L(k).label, value: v, unit: L(k).unit, better: L(k).better, kind: v == null ? 'assumed' : kind, source: v == null ? `no value: ${extra.reason || source}` : source, ...extra };
};
const nul = (k, reason) => met(k, null, 'assumed', reason, { reason });

export default {
  key: 'sleep',
  title: 'Sleep: amount by stage, light phase and temperature (zebrafish measurements, two definitions shown)',
  group: 'behaviour',
  requires: ['stage'],
  needs: ['species', 'ageDays', 'temperature_C'],
  params: [
    { key: 'light_hours', label: 'Hours of light per 24 h', unit: 'h', default: 14, min: 0, max: 24, kind: 'measured', source: '14:10 LD is the protocol of every zebrafish sleep measurement used here (Sorribes 2013; Prober 2006; Yokogawa 2007; Choudhary 2026)' },
    { key: 'hcrt_overexpression', label: 'Hypocretin (hcrt) overexpression, larva (0/1)', unit: 'bool', default: 0, min: 0, max: 1, kind: 'measured', source: SRC.prober2006 },
    { key: 'hcrtr_loss', label: 'Hypocretin receptor (hcrtr) loss of function, adult (0/1)', unit: 'bool', default: 0, min: 0, max: 1, kind: 'measured', source: SRC.yokogawa2007 },
  ],
  metrics: METRICS,

  run(state, params) {
    const prov = []; const notes = []; let inRange = true;
    const P = (quantity, value, kind, source) => prov.push({ quantity, value, kind, source });
    const stage = String(V(state, 'stage') || '').toLowerCase(); const sp = String(V(state, 'species') || '');
    const zebra = /danio/i.test(sp); const age = V(state, 'ageDays'); const T = V(state, 'temperature_C');
    const dpf = age == null ? null : age + 2; // zebrafish hatch at 2 dpf (development/zebrafish/trajectory.mjs)
    const Lh = params.light_hours; const kc = zebra ? 'calibrated' : 'borrowed';
    if (!zebra) { inRange = false; notes.push(`no sleep measurement for ${sp || 'this species'} was found (flying fish searched: none); zebrafish values are borrowed and should not be trusted.`); }
    const larva = stage === 'hatching' || stage === 'larva';
    if (stage === 'egg' || (larva && dpf != null && dpf < 5)) {
      const reason = stage === 'egg' ? 'embryo: sleep not defined' : `larva at about ${dpf} dpf: "WT larvae exhibit robust locomotor activity beginning on the fifth day of development" (Prober 2006); sleep is not measured earlier`;
      return { metrics: METRICS.map(m => nul(m.key, reason)), survives: null, feasible: null, limiting: null, provenance: [], scope: 'No sleep measurement exists for this stage; nothing is computed.', validity: { inRange: false, notes: reason } };
    }
    if (T != null && Math.abs(T - 28.5) > 1.5) notes.push(`6 s series measured at 28.5 C only; no temperature effect applied to it (T = ${T} C).`);
    if (T != null && Math.abs(T - 28.5) > 3 && !larva) inRange = false;

    // ---- primary series: 6 s criterion
    const sor = larva ? { v: 0.5817, lab: '6-10 dpf' } : stage === 'juvenile' ? { v: 0.5425, lab: '4-6 weeks' } : { v: 0.3337, lab: '4-6 months' };
    let nightA = sor.v;
    const sorSrc = `Sorribes 2013 Table 1, zebrafish sleep "Percent time of night" ${sor.lab}: ${(sor.v * 100).toFixed(2)}% (criterion: "after six or more consecutive 1-s bins of non-movement, the seventh second and above were classified as sleep", applied to larvae as well; 28.5 C, 14:10 LD); ${SRC.sorribes2013}`;
    P('night sleep, 6 s criterion', sor.v, 'measured', sorSrc);
    let dayA = null, dayAReason = null;
    if (!larva && stage !== 'juvenile') { dayA = 0.051; P('adult day sleep, 6 s criterion', 0.051, 'measured', 'Yokogawa 2007: "5.1% ± 1.3% of time during the day" (a different lab from the 6 s night value)'); }
    else dayAReason = 'no daytime sleep with the 6 s criterion was fetched for larvae or juveniles (Sorribes Table 1 reports night only)';

    // ---- alternative series: stage-specific definition, day and night from one paper
    let nightB, dayB, lat, crit, altSrc, kB = kc;
    if (larva) {
      nightB = 0.839; dayB = 0.196; crit = 60;
      altSrc = 'Choudhary 2026: sleep (speed < 0.5 mm/s for >= 1 min) "accounted for 19.6 ± 1.0% of daytime and 83.9 ± 1.5% of nighttime", larvae 5-8 dpf, 14:10 LD, reared at 28 C; ' + SRC.choudhary2026;
      P('larval day/night sleep, 1 min criterion', [dayB, nightB], 'measured', altSrc);
      if (dpf != null && dpf > 10) { inRange = false; notes.push(`larva at ${dpf} dpf: larval data cover 5-10 dpf.`); }
      if (T != null) {
        const tc = Math.min(28, Math.max(24, T));
        if (T < 24 || T > 28) { inRange = false; notes.push(`temperature ${T} C outside the measured 24-28 C; the alternative-definition effect is clamped.`); }
        const rd = Math.pow(8.1 / 5.9, (28 - tc) / 4), rn = Math.pow(84.2 / 79.8, (28 - tc) / 4);
        dayB *= rd; nightB = Math.min(1, nightB * rn); if (tc !== 28) kB = 'derived';
        P('temperature factor on the alternative series (day, night)', [r3(rd), r3(rn)], 'derived', 'Choudhary 2026 Suppl. Fig. 6a-c: 24 C 8.1% day / 84.2% night; 28 C 5.9% / 79.8%; ratio applied multiplicatively, exponent (28 - T)/4');
      }
      lat = 13; P('night sleep latency', 13, 'measured', 'Prober 2006: "median sleep latency of 77 min compared with 13 min for WT"');
      if (params.hcrt_overexpression >= 0.5) {
        lat = 77; nightA = null; nightB = null;
        notes.push('hcrt overexpression: Prober 2006 reports bout structure (26 vs 64 night rest bouts; night active bouts 87 vs 14 min) and latency, not a night sleep fraction, so night fractions are not computed.');
      }
      if (params.hcrtr_loss >= 0.5) notes.push('hcrtr loss was measured in adults; ignored for larvae.');
    } else {
      nightB = 0.581; dayB = 0.051; crit = 6; lat = undefined;
      altSrc = 'Yokogawa 2007: adults sleep "5.1% ± 1.3% of time during the day, 58.1% ± 3.3% of time during the night" (n=13, 28.5 C, 14:10 LD; inactivity < 6 pixels/s lasting at least 6 s); ' + SRC.yokogawa2007;
      if (stage === 'juvenile') { kB = 'borrowed'; notes.push('juvenile: the alternative series borrows adult values (no juvenile data with that definition).'); }
      P('adult day/night sleep, 6 s criterion (Yokogawa)', [dayB, nightB], 'measured', altSrc);
      if (params.hcrtr_loss >= 0.5) {
        nightA *= 0.75; nightB *= 0.75; kB = 'derived';
        P('hcrtr loss night-sleep factor', 0.75, 'derived', 'Yokogawa 2007: "sleep amounts were decreased by 20%-30% during the night" in hcrtr mutants; midpoint 25%');
      }
      if (params.hcrt_overexpression >= 0.5) notes.push('hcrt overexpression was measured in larvae; ignored for adults.');
    }
    const kA = params.hcrtr_loss >= 0.5 && !larva ? 'derived' : kc;
    const hours = nightB == null ? null : dayB * Lh + nightB * (24 - Lh);
    if (Lh !== 14) notes.push(`light_hours = ${Lh}: phase fractions measured under 14:10 LD are assumed to hold per hour of each phase (light itself suppresses adult sleep by 90%, Yokogawa 2007, so photoperiod is not neutral).`);
    notes.push('two sleep definitions are reported side by side: the 6 s series (sleep_fraction_*) is comparable across ages; the alt_def_* series uses each stage\'s own definition and gives larvae much more sleep.');
    return {
      metrics: [
        nightA == null ? nul('sleep_fraction_night', 'not reported as a fraction under hcrt overexpression') : met('sleep_fraction_night', r3(nightA), kA, sorSrc),
        dayA == null ? nul('sleep_fraction_day', dayAReason) : met('sleep_fraction_day', dayA, kc, SRC.yokogawa2007),
        nightB == null ? nul('alt_def_sleep_fraction_night', 'not reported as a fraction under hcrt overexpression') : met('alt_def_sleep_fraction_night', r3(nightB), kB, altSrc),
        met('alt_def_sleep_fraction_day', r3(dayB), kB, altSrc),
        hours == null ? nul('sleep_hours_per_day', 'night fraction unavailable') : met('sleep_hours_per_day', r3(hours), 'derived', `stage-specific definition: day fraction x ${Lh} h + night fraction x ${24 - Lh} h`),
        lat === undefined ? nul('night_sleep_latency_min', 'sleep latency was measured in larvae only (Prober 2006)') : met('night_sleep_latency_min', lat, kc, SRC.prober2006),
        met('sleep_criterion_s', crit, 'measured', larva ? 'Choudhary 2026: speed < 0.5 mm/s for >= 1 min (Prober 2006 likewise uses 1 min bins of zero movement)' : 'Yokogawa 2007: "an interval of inactivity (<6 pixels/s) lasting at least 6 s"'),
      ],
      survives: null, feasible: null, limiting: null, provenance: prov,
      scope: 'Behavioural sleep (immobility with raised arousal threshold) as measured in laboratory zebrafish under 14:10 LD, under two definitions shown side by side. Not a mechanistic sleep model: no homeostatic pressure, deprivation, light pulses, melatonin, social or predator context. survives/feasible are null: sleep is not a survival test here.',
      validity: { inRange, notes: notes.join(' ') },
    };
  },

  modelCard: {
    equations: [
      '6 s series (night): larva 0.5817, juvenile 0.5425, adult 0.3337 (Sorribes 2013); day: adult 0.051 (Yokogawa 2007); x 0.75 at night with hcrtr loss',
      'alternative larva (1 min): f_day = 0.196 x (8.1/5.9)^((28 - T)/4);  f_night = 0.839 x (84.2/79.8)^((28 - T)/4),  T clamped to 24-28 C',
      'alternative adult (6 s, Yokogawa): f_day = 0.051;  f_night = 0.581',
      'sleep h/day = f_day x L + f_night x (24 - L) on the alternative series',
      'larval night sleep latency = 13 min (WT) or 77 min (hcrt overexpression)',
    ],
    sources: [
      { cite: 'Sorribes et al. 2013, Front Neural Circuits 7:178 (6 s criterion at every age; night sleep 58.17 / 54.25 / 33.37 %)', doi_or_url: 'https://doi.org/10.3389/fncir.2013.00178' },
      { cite: 'Choudhary et al. 2026, Nat Commun 17:4068 (larval sleep fractions, 1 min criterion; 24 vs 28 C runs)', doi_or_url: 'https://doi.org/10.1038/s41467-026-72222-0' },
      { cite: 'Prober et al. 2006, J Neurosci 26:13400 (larval 1 min criterion; hcrt overexpression; onset at 5 dpf)', doi_or_url: 'https://doi.org/10.1523/JNEUROSCI.4332-06.2006' },
      { cite: 'Yokogawa et al. 2007, PLoS Biol 5:e277 (adult 6 s criterion and fractions; hcrtr mutant)', doi_or_url: 'https://doi.org/10.1371/journal.pbio.0050277' },
    ],
    validity: 'Zebrafish larvae 5-10 dpf, juveniles 4-6 weeks and adults, at 28.5 C (6 s series) or 24-28 C (larval alternative) under 14:10 LD. Other species borrow zebrafish values; no flying fish sleep data were found.',
    validatedAgainst: [
      { organism: 'Danio rerio adult', observation: 'night sleep with the SAME 6 s criterion in two labs', predicted: '33.4% (Sorribes, primary series)', measured: '58.1 ± 3.3% (Yokogawa 2007)', source: 'doi:10.1371/journal.pbio.0050277 — DISAGREES 1.7x: same nominal criterion, different arenas, tracking thresholds and strains. Both are shown; neither is a model prediction' },
      { organism: 'Danio rerio larva', observation: 'night sleep under two definitions', predicted: '58.2% with the 6 s criterion (Sorribes)', measured: '83.9% with < 0.5 mm/s for >= 1 min (Choudhary 2026)', source: 'doi:10.1038/s41467-026-72222-0 — not a validation: the definitions differ (a speed threshold counts slow drifting as sleep, a pixel threshold does not); shown side by side' },
      { organism: 'Danio rerio larva', observation: 'share of 24 h inactive (Prober 2006: about 30% of time in each of three activity states)', predicted: '46% of 24 h asleep (alternative series)', measured: '~30% inactive', source: 'doi:10.1523/JNEUROSCI.4332-06.2006 — FAILS by 1.5x; different criteria again' },
      { organism: 'Danio rerio', observation: 'larva sleeps more than adult at night', predicted: '58.2% vs 33.4% (6 s series)', measured: 'same (Sorribes Table 1)', source: 'doi:10.3389/fncir.2013.00178 — read-back (calibrated, amendment A1), not a validation' },
    ],
  },
};
