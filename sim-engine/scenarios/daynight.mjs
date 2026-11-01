// daynight.mjs — day vs night locomotor activity and the circadian clock in zebrafish, by stage and
// temperature: larval activity per minute (Prober 2006), adult share of activity in the light and its
// temperature dependence (López-Olmeda 2006), free-running periods (Chaigne 2024 larvae; López-Olmeda 2006
// adults) and temperature compensation (Hurd 1998 whole animal; Lahiri 2005 cell line). Pure ESM. No bird data.

const SRC = {
  prober2006: 'Prober DA et al. 2006. J Neurosci 26:13400. doi:10.1523/JNEUROSCI.4332-06.2006 (PMC6675014, full text read)',
  lopez2006: 'López-Olmeda JF, Madrid JA, Sánchez-Vázquez FJ 2006. Chronobiol Int 23:537. doi:10.1080/07420520600651065 (abstract read)',
  hurd1998: 'Hurd MW, Debruyne J, Straume M, Cahill GM 1998. Circadian rhythms of locomotor activity in zebrafish. Physiol Behav 65:465. doi:10.1016/S0031-9384(98)00183-8 (abstract read)',
  chaigne2024: 'Chaigne et al. 2024. PLoS Genet. doi:10.1371/journal.pgen.1011172 (PMC10919856, full text read)',
  lahiri2005: 'Lahiri K et al. 2005. Temperature regulates transcription in the zebrafish circadian clock. PLoS Biol 3:e351. doi:10.1371/journal.pbio.0030351 (PMC1233578, full text read)',
  hurdcahill2002: 'Hurd MW, Cahill GM 2002. Entraining signals initiate behavioral circadian rhythmicity in larval zebrafish. J Biol Rhythms 17:307. doi:10.1177/074873002129002618 (abstract read)',
};
const V = (s, k) => { const f = s?.[k]; return f && typeof f === 'object' && 'value' in f ? f.value : (f ?? null); };
const r3 = x => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const METRICS = [
  { key: 'rhythm_present', label: 'Day/night locomotor rhythm expressed', unit: 'bool', better: null },
  { key: 'activity_day_s_per_min', label: 'Time moving per minute, light phase (larva)', unit: 's/min', better: null },
  { key: 'activity_night_s_per_min', label: 'Time moving per minute, dark phase (larva)', unit: 's/min', better: null },
  { key: 'day_night_activity_ratio', label: 'Activity per hour, light / dark', unit: 'ratio', better: null },
  { key: 'diurnal_activity_fraction', label: 'Share of 24 h activity in the light phase', unit: 'fraction', better: null },
  { key: 'free_running_period_h', label: 'Free-running circadian period', unit: 'h', better: null },
];
const L = k => METRICS.find(m => m.key === k);
const met = (k, value, kind, source, extra = {}) => {
  const v = value == null || (typeof value === 'number' && !Number.isFinite(value)) ? null : value;
  return { key: k, label: L(k).label, value: v, unit: L(k).unit, better: L(k).better, kind: v == null ? 'assumed' : kind, source: v == null ? `no value: ${extra.reason || source}` : source, ...extra };
};
const nul = (k, reason) => met(k, null, 'assumed', reason, { reason });

export default {
  key: 'daynight',
  title: 'Day/night activity and circadian clock (zebrafish measurements)',
  group: 'behaviour',
  requires: ['stage'],
  needs: ['species', 'ageDays', 'temperature_C'],
  params: [
    { key: 'light_hours', label: 'Hours of light per 24 h', unit: 'h', default: 14, min: 1, max: 23, kind: 'assumed', source: 'larval data 14:10 LD (Prober 2006); adult data 12:12 LD (López-Olmeda 2006; Hurd 1998) — default 14 h is the larval protocol condition [kind refers to the default; min/max are slider limits chosen for the design studio (design choice), not data]' },
  ],
  metrics: METRICS,

  run(state, params) {
    const prov = []; const notes = []; let inRange = true;
    const P = (quantity, value, kind, source) => prov.push({ quantity, value, kind, source });
    const stage = String(V(state, 'stage') || '').toLowerCase(); const sp = String(V(state, 'species') || '');
    const zebra = /danio/i.test(sp); const age = V(state, 'ageDays'); const T = V(state, 'temperature_C');
    const dpf = age == null ? null : age + 2; const Lh = params.light_hours; const k0 = zebra ? 'measured' : 'borrowed'; const kc = zebra ? 'calibrated' : 'borrowed'; // lookups read back from their source (amendment A1)
    if (!zebra) { inRange = false; notes.push(`no diel activity measurement for ${sp || 'this species'} was found (flying fish searched: none); zebrafish values are borrowed.`); }
    const larva = stage === 'hatching' || stage === 'larva';
    if (stage === 'egg' || (larva && dpf != null && dpf < 5)) {
      const reason = 'locomotor rhythm not yet expressed: robust activity rhythm begins on the fifth day (Prober 2006); the clock "develops gradually over the first 4 days of life" (Hurd & Cahill 2002)';
      return { metrics: [met('rhythm_present', false, k0, SRC.prober2006 + '; ' + SRC.hurdcahill2002), ...METRICS.slice(1).map(m => nul(m.key, reason))],
        survives: null, feasible: null, limiting: null, provenance: [], scope: 'Before 5 dpf no locomotor rhythm is reported; the molecular clock may already run (not modelled).', validity: { inRange: true, notes: reason } };
    }
    let aDay = null, aNight = null, ratio, frac, tau, tauSrc;
    if (larva) {
      aDay = 7; aNight = 0.5; ratio = aDay / aNight;
      P('larval activity day/night', [aDay, aNight], k0, 'Prober 2006: "the total amount of time a single larva moves each minute is typically 4-10 s during the day and 0-1 s at night" (midpoints 7 and 0.5), 28.5 C, 14:10 LD');
      if (Lh !== 14) notes.push('larval activity was measured under 14:10 LD.');
      if (T != null && Math.abs(T - 28.5) > 2) { inRange = false; notes.push(`temperature ${T} C: larval activity measured at 28.5 C; no temperature effect modelled.`); }
      tau = 25.08; tauSrc = 'Chaigne 2024: larval period in DD "25.08 ± 1.59 hours (n = 114)" (raised 28 C, recorded 27 C); ' + SRC.chaigne2024;
    } else {
      // share of activity in the light under 12:12 LD, linear in temperature between 20 and 26 C
      const tc = T == null ? 26 : Math.min(26, Math.max(20, T));
      if (T == null) notes.push('temperature null: 26 C value used.');
      else if (T < 20 || T > 26) { inRange = false; notes.push(`temperature ${T} C outside the measured 20-26 C; clamped.`); }
      const f12 = 0.87 + (0.77 - 0.87) * (tc - 20) / 6;
      ratio = f12 / (1 - f12);
      P('adult share of activity in light at 12:12', r3(f12), T != null && T !== 20 && T !== 26 ? 'derived' : k0, 'López-Olmeda 2006: "diurnalism was higher at 20 degrees C than at 26 degrees C (87% and 77%, respectively)", 12:12 LD; linear interpolation in temperature; ' + SRC.lopez2006);
      if (stage === 'juvenile') notes.push('juvenile: adult values borrowed (no juvenile data found).');
      tau = 23.25; tauSrc = 'López-Olmeda 2006: adults in dim LL at 22.5 C "displayed free-running rhythms (tau=22.9 to 23.6 h)" (4 of 6 groups); midpoint; ' + SRC.lopez2006;
    }
    frac = ratio * Lh / (ratio * Lh + (24 - Lh));
    // temperature compensation of the period
    if (T != null && (T < 18 || T > 28.5)) { inRange = false; notes.push(`period: temperature compensation shown only for 18-28.5 C (Hurd 1998).`); }
    P('period temperature compensation', 'period constant 18-28.5 C', 'measured', 'Hurd 1998: "The free-running period of rhythmic animals was not affected by temperature within this range" (18-28.5 C, adults); cell-line Q10 = 0.9 for 20-30 C (Lahiri 2005, PAC-2 cells) not applied to the whole animal');
    const kRatio = larva ? k0 : 'derived';
    const ks = !zebra || stage === 'juvenile' ? 'borrowed' : null;
    const kRatio2 = larva ? kc : 'derived';
    return {
      metrics: [
        met('rhythm_present', true, k0, larva ? 'Prober 2006: "WT larvae exhibit robust locomotor activity beginning on the fifth day of development and are much more active during the day than at night"' : 'Hurd 1998: "86% of the fish were most active during the light phase" (25 C, 12:12 LD)'),
        larva ? met('activity_day_s_per_min', aDay, ks || 'calibrated', SRC.prober2006) : nul('activity_day_s_per_min', 'no adult activity in s/min was fetched; adults are given as a share of activity'),
        larva ? met('activity_night_s_per_min', aNight, ks || 'calibrated', SRC.prober2006) : nul('activity_night_s_per_min', 'no adult activity in s/min was fetched'),
        met('day_night_activity_ratio', r3(ratio), ks || kRatio2, larva ? 'day / night midpoints, Prober 2006' : 'f/(1-f) of the 12:12 share (equal phase lengths)'),
        met('diurnal_activity_fraction', r3(frac), 'derived', `ratio x ${Lh} / (ratio x ${Lh} + ${24 - Lh})`),
        met('free_running_period_h', tau, ks || 'calibrated', tauSrc),
      ],
      survives: null, feasible: null, limiting: null, provenance: prov,
      scope: 'Activity patterns of laboratory zebrafish in LD and constant conditions. Not a clock model: no entrainment dynamics, phase response, light intensity, masking, temperature cycles (2 C cycles entrain the clock, Lahiri 2005) or feeding cues. Says nothing about survival.',
      validity: { inRange, notes: notes.join(' ') || 'within the measured stage, temperature and photoperiod' },
    };
  },

  modelCard: {
    equations: [
      'larva: activity 7 s/min (light), 0.5 s/min (dark) -> ratio 14',
      'adult: f12(T) = 0.87 + (0.77 - 0.87)(T - 20)/6, T clamped to 20-26 C; ratio = f12/(1 - f12)',
      'share of activity in light for L light hours = ratio L / (ratio L + 24 - L)',
      'free-running period: larva 25.08 h (DD), adult 23.25 h (dim LL); constant over 18-28.5 C',
    ],
    sources: [
      { cite: 'Prober et al. 2006, J Neurosci 26:13400', doi_or_url: 'https://doi.org/10.1523/JNEUROSCI.4332-06.2006' },
      { cite: 'López-Olmeda, Madrid & Sánchez-Vázquez 2006, Chronobiol Int 23:537', doi_or_url: 'https://doi.org/10.1080/07420520600651065' },
      { cite: 'Hurd et al. 1998, Physiol Behav 65:465', doi_or_url: 'https://doi.org/10.1016/S0031-9384(98)00183-8' },
      { cite: 'Chaigne et al. 2024, PLoS Genet', doi_or_url: 'https://doi.org/10.1371/journal.pgen.1011172' },
      { cite: 'Lahiri et al. 2005, PLoS Biol 3:e351', doi_or_url: 'https://doi.org/10.1371/journal.pbio.0030351' },
      { cite: 'Hurd & Cahill 2002, J Biol Rhythms 17:307', doi_or_url: 'https://doi.org/10.1177/074873002129002618' },
    ],
    validity: 'Zebrafish larvae from 5 dpf at about 28.5 C (14:10 LD) and adults at 20-26 C (12:12 LD); period compensation 18-28.5 C. Other species borrow zebrafish values.',
    validatedAgainst: [
      { organism: 'Danio rerio (all lookups)', observation: 'activity per minute, adult shares at 20/26 C and both periods are read back from their sources', predicted: 'the source values', measured: 'the source values', source: 'labelled calibrated (amendment A1): not validations' },
      { organism: 'Danio rerio larva', observation: 'free-running period in constant light (Chaigne 2024)', predicted: '25.08 h (the DD value)', measured: '24.93 ± 1.87 h in LL (n = 66)', source: 'doi:10.1371/journal.pgen.1011172 — consistent; same paper, different lighting condition' },
      { organism: 'Danio rerio adult', observation: 'diurnality at 25 C, 12:12 LD (Hurd 1998)', predicted: 'share of activity in light 0.79', measured: '86% of fish most active in the light', source: 'doi:10.1016/S0031-9384(98)00183-8 — same direction; different quantities (share of activity vs share of fish), so only a sign check' },
      { organism: 'Danio rerio larva', observation: 'light/dark contrast from an independent lab (Choudhary 2026 sleep fractions)', predicted: 'activity ratio 14 (Prober)', measured: 'wake ratio (1-0.196)/(1-0.839) = 5.0', source: 'doi:10.1038/s41467-026-72222-0 — DISAGREES by about 3x; wakefulness is not the same as movement time, but the gap is large' },
    ],
  },
};
