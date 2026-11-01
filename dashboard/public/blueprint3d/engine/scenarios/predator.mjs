// predator.mjs — addition of a predator: Mauthner fast-start (latency, peak speed, peak acceleration),
// the looming-stimulus evasion geometry of McKee & McHenry 2020 (after Weihs & Webb 1984 / Soto et al. 2015),
// the measured larval escape probability of Stewart et al. 2013, and, for fish with lifting fins, the aerial
// escape (the leading hypothesis for why flying fish glide; Davenport 1994, quoted in Makiguchi et al. 2013).
// Pure ESM; imports only the sibling scenario glide.mjs (the shared glide model), so it runs in node and the browser. No bird data anywhere.

const SRC = {
  burgess2007: 'Burgess HA, Granato M 2007. Sensorimotor gating in larval zebrafish. J Neurosci 27:4984. doi:10.1523/JNEUROSCI.0615-07.2007 (PMC6672105, full text read)',
  turrini2023: 'Turrini L et al. 2023. Int J Mol Sci 24:9833. doi:10.3390/ijms24129833 (PMC10298537) citing Kim DH et al. 2017 Nat Methods 14:1107, doi:10.1038/nmeth.4429',
  vandepol2021: 'van de Pol ILE, Hermaniuk A, Verberk WCEP 2021. Front Physiol 12:738804. doi:10.3389/fphys.2021.738804 (PMC8691434, full text read)',
  schuster2023: 'Schuster S 2023. The archerfish predictive C-start. J Comp Physiol A. doi:10.1007/s00359-023-01658-2 (PMC10465633) citing Harper & Blake 1991 (pike)',
  mckee2020: 'McKee A, McHenry MJ 2020. Integr Org Biol 2:obaa023. doi:10.1093/iob/obaa023 (PMC7750966, full text read)',
  stewart2013: 'Stewart WJ, Cardenas GS, McHenry MJ 2013. Zebrafish larvae evade predators by sensing water flow. J Exp Biol 216:388. doi:10.1242/jeb.072751 (abstract read)',
  liu2026: 'Liu Y et al. 2026. Biomimetics 11:156. doi:10.3390/biomimetics11020156 (PMC12938309): adult zebrafish "L = 3.60 ± 0.14 cm"',
  makiguchi2013: 'Makiguchi Y et al. 2013. Take-off performance of flying fish Cypselurus heterurus doederleini measured with miniature acceleration data loggers. Aquat Biol 18:105. doi:10.3354/ab00494 (publisher OA PDF, physics/prior-art/raw/pdf-takahashi-2013.pdf)',
  parkchoi2010: 'Park H, Choi H 2010. Aerodynamic characteristics of flying fish in gliding flight. J Exp Biol 213:3269. doi:10.1242/jeb.046052 (Table 2 model L3, as transcribed in physics/glide-data.csv)',
  woytanowski2013: 'Woytanowski JR, Coughlin DJ 2013. Biol Open 2:274. doi:10.1242/bio.20133509 (white-muscle Vmax Q10 ~1.5 quoted there citing Coughlin et al. 1996; as used in physiology/muscle.js)',
  danos2012: 'Danos N, Lauder GV 2012. Challenging zebrafish escape responses by increasing water viscosity. J Exp Biol 215:1854. doi:10.1242/jeb.068957 (full text read via the Wayback copy http://web.archive.org/web/20180531045058/http://jeb.biologists.org:80/content/215/11/1854.full)',
  trujillo2022: 'Trujillo JE et al. 2022. J Exp Biol 225:jeb243973. doi:10.1242/jeb.243973 (PMC9845744) citing Domenici & Hale 2019',
  bridge: 'dashboard/public/t/physics/sim/NOTES-FOR-HUB.md section 3: lifting area = 1.98965 x pectoral area (one Park & Choi specimen); an assumed transfer',
};

import { G, PARK_CHOI, glidePath, glideParts, launchSpeed, liftingArea, airDensity, polarOf } from './glide.mjs';
const V = (s, k) => { const f = s?.[k]; return f && typeof f === 'object' && 'value' in f ? f.value : (f ?? null); };
const amb = (s, k) => { const a = s?.ambient && 'value' in Object(s.ambient) && typeof s.ambient.value === 'object' ? s.ambient.value : s?.ambient; const f = a?.[k]; return f && typeof f === 'object' && 'value' in f ? f.value : (f ?? null); };
const met = (key, label, value, unit, better, kind, source, extra = {}) => {
  const v = value == null || (typeof value === 'number' && !Number.isFinite(value)) ? null : value;
  return { key, label, value: v, unit, better, kind: v == null ? 'assumed' : kind, source: v == null ? `no value: ${extra.reason || source}` : source, ...extra };
};
const r3 = x => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

const METRICS = [
  { key: 'startle_latency_ms', label: 'Mauthner (startle) latency', unit: 'ms', better: 'lower' },
  { key: 'peak_escape_speed_m_s', label: 'Peak escape speed', unit: 'm/s', better: 'higher' },
  { key: 'peak_escape_speed_BL_s', label: 'Peak escape speed', unit: 'body lengths/s', better: 'higher' },
  { key: 'peak_escape_acceleration_m_s2', label: 'Peak escape acceleration', unit: 'm/s^2', better: 'higher' },
  { key: 'escape_probability', label: 'Escape probability per strike (larva, measured lookup)', unit: 'fraction', better: 'higher' },
  { key: 'response_distance_m', label: 'Predator distance when the escape starts (visual looming)', unit: 'm', better: 'higher' },
  { key: 'min_distance_to_predator_m', label: 'Closest approach of predator (optimal escape angle)', unit: 'm', better: 'higher' },
  { key: 'critical_predator_speed_ratio', label: 'Predator/prey speed ratio above which the predator gets within strike reach', unit: 'ratio', better: 'higher' },
  { key: 'aerial_glide_min_speed_m_s', label: 'Minimum air speed to stay aloft at CLmax', unit: 'm/s', better: 'lower' },
  { key: 'aerial_escape_available', label: 'Aerial escape available (launch speed >= glide minimum speed)', unit: 'bool', better: 'higher' },
  { key: 'aerial_escape_distance_m', label: 'Aerial escape distance (glide.mjs range bound)', unit: 'm', better: 'higher' },
];
const label = k => METRICS.find(m => m.key === k);
const nullMetric = (k, reason) => { const m = label(k); return met(k, m.label, null, m.unit, m.better, 'assumed', reason, { reason }); };

export default {
  key: 'predator',
  title: 'Addition of a predator: fast-start escape, evasion geometry and aerial escape',
  group: 'behaviour',
  requires: ['SL_m'],
  needs: ['stage', 'species', 'ageDays', 'mass_kg', 'temperature_C', 'pectoral_area_both_m2', 'ambient.air_density_kg_m3'],
  params: [
    { key: 'predator_speed_ratio', label: 'Predator approach speed / prey escape speed (K)', unit: 'ratio', default: 1.5, min: 0.1, max: 10, kind: 'assumed', source: 'McKee & McHenry 2020 Fig. 5 example K = 1.5 (a modelled case, not a measured predator speed); ' + SRC.mckee2020 + ' — K = 1.5 is a modelled scenario, not a measured predator [kind refers to the default; min/max are slider limits chosen for the design studio (design choice), not data]' },
    { key: 'predator_width_SL', label: 'Predator body width in prey body lengths', unit: 'SL', default: 0.69, min: 0.05, max: 10, kind: 'assumed', source: 'McKee & McHenry 2020 model width w = 2.5 cm ("comparable to the cichlid") / adult zebrafish L = 3.6 cm (Liu 2026) [kind refers to the default; min/max are slider limits chosen for the design studio (design choice), not data]' },
    { key: 'strike_distance_SL', label: 'Predator strike (suction) reach in prey body lengths', unit: 'SL', default: 0.56, min: 0.01, max: 10, kind: 'assumed', source: 'McKee & McHenry 2020: "small values for the minimum distance (d min < 2 cm) were considered threatening", citing Wainwright et al. 2001; 2 cm / 3.6 cm [kind refers to the default; min/max are slider limits chosen for the design studio (design choice), not data]' },
    { key: 'theta_thresh_deg', label: 'Visual angle that triggers the escape', unit: 'deg', default: 14, min: 1, max: 90, kind: 'assumed', source: 'McKee & McHenry 2020: best fits 10.3 deg < theta < 15.8 deg in adult zebrafish; 14 deg used in their model sweep — 14 deg is the modelling value inside the measured 10.3-15.8 deg range [kind refers to the default; min/max are slider limits chosen for the design studio (design choice), not data]' },
    { key: 'visual_latency_s', label: 'Latency from visual threshold to escape', unit: 's', default: 0.76, min: 0, max: 3, kind: 'assumed', source: 'McKee & McHenry 2020: "threshold values correspond to a range in latency between 740 ms and 780 ms" (adult zebrafish) — 0.76 s is the midpoint of the measured 740-780 ms [kind refers to the default; min/max are slider limits chosen for the design studio (design choice), not data]' },
    { key: 'lateral_line_intact', label: 'Lateral line intact (1) or ablated (0) — larval flow sensing', unit: 'bool', default: 1, min: 0, max: 1, kind: 'assumed', source: 'Stewart et al. 2013: P(escape) 0.7 intact vs 0.05 after pharmacological ablation [a design switch: the user chooses it; only the effect it turns on is sourced]' },
    { key: 'aerial_launch_height_m', label: 'Height at the start of the glide (as glide.mjs)', unit: 'm', default: 1, min: 0, max: 10, kind: 'assumed', source: 'glide.mjs default (design input) [kind refers to the default; min/max are slider limits chosen for the design studio (design choice), not data]' },
    { key: 'launch_speed_m_s', label: 'What-if water-exit speed for the aerial escape (0 = the organism’s own sourced speed, as glide.mjs)', unit: 'm/s', default: 0, min: 0, max: 30, kind: 'assumed', source: 'passed to glide.mjs launchSpeed as its override: 0 uses the organism’s sourced leap/burst speed (flying fish ~10 m/s as adults, makiguchi-2013 citing Davenport 1994; zebrafish Umax from current.mjs) [kind refers to the default; min/max are slider limits chosen for the design studio (design choice), not data]' },
  ],
  metrics: METRICS,

  run(state, params) {
    const prov = []; const notes = []; let inRange = true;
    const P = (quantity, value, kind, source) => prov.push({ quantity, value, kind, source });
    const SL = V(state, 'SL_m'); const stage = String(V(state, 'stage') || '').toLowerCase();
    const sp = String(V(state, 'species') || ''); const zebra = /danio/i.test(sp);
    const flier = /exocoet|cypselurus|cheilopogon|hirundichthys|flying/i.test(sp);
    const T = V(state, 'temperature_C'); const mass = V(state, 'mass_kg'); const age = V(state, 'ageDays');
    const out = {};
    if (stage === 'egg' || (age != null && age < 0)) {
      const reason = 'embryo in the egg: no locomotor escape';
      return { metrics: METRICS.map(m => nullMetric(m.key, reason)), survives: null, limiting: reason, provenance: [],
        scope: 'An embryo cannot perform a fast-start; nothing is computed.', validity: { inRange: false, notes: reason } };
    }
    const larva = stage === 'hatching' || stage === 'larva' || (stage === '' && SL < 0.01);
    if (/ \+ /.test(sp)) notes.push('blend of species: zebrafish values are used if any parent is Danio.');

    // temperature scaling of speeds (borrowed white-muscle Vmax Q10)
    const Q10 = 1.5, Tref = 26;
    const qT = T == null ? 1 : Math.pow(Q10, (T - Tref) / 10);
    if (T == null) notes.push('temperature null: speeds left at the 26 C reference.');
    else if (T < 23 || T > 28) { inRange = false; notes.push(`temperature ${T} C outside 23-28 C: the escape data were taken at 23-27 C (Burgess & Granato) and with fish held at 27 C (McKee & McHenry); Danos & Lauder give no temperature.`); }
    P('speed Q10', Q10, 'borrowed', SRC.woytanowski2013 + '; muscle Vmax Q10 applied to whole-fish escape speed; 26 C reference assumed');

    // startle latency (Mauthner)
    const lat = larva ? 5.3 : 8; const latKind = zebra ? 'calibrated' : 'borrowed'; // a value read straight back from its source (amendment A1)
    const latSrc = larva
      ? 'Burgess & Granato 2007: SLC responses "initiated within 5.3 ± 2.0 ms of the stimulus (mean ± SD)", larvae 6-7 dpf, 23-27 C; ' + SRC.burgess2007
      : 'ADULT zebrafish measured inside a larval-titled paper: Burgess & Granato 2007 Results (PPI "persisting into adulthood"): "Startle responses in adult fish typically occur within 20 ms of an acoustic/vibrational stimulus (Eaton et al., 1981). Using a vibrational stimulus, we found similar results, with modal latency to startle being 8 ms (Fig. 5F, inset)". Read in the PMC article page https://pmc.ncbi.nlm.nih.gov/articles/PMC6672105/ (Europe PMC does not serve this full text). Teleost latencies 5-150 ms (Trujillo 2022 citing Domenici & Hale 2019)';
    if (!zebra) notes.push('startle latency borrowed from zebrafish; no measurement for this species was fetched.');
    out.startle_latency_ms = met('startle_latency_ms', label('startle_latency_ms').label, lat, 'ms', 'lower', latKind, latSrc);
    P('startle latency', lat, latKind, latSrc);
    if (larva && zebra && age != null && age + 2 < 5) { inRange = false; notes.push(`larva at about ${age + 2} dpf: latency and speed data are from 5-7 dpf larvae.`); }

    // peak escape speed and acceleration
    let BLs, spdKind, spdSrc, acc = null, accKind = 'assumed', accSrc = 'no fetched value';
    if (larva) {
      BLs = 0.2 / SL; spdKind = zebra ? 'measured-secondhand' : 'borrowed'; // absolute 200 mm/s; BL/s follows the state's own SL (no assumed larval length)
      spdSrc = 'larval zebrafish "peak acceleration of 20,000 mm/s2 and a peak velocity of 200 mm/s" (Turrini 2023 citing Kim 2017), used as an absolute speed (the larval length is not given in the citing text), so BL/s = 0.2 m/s / STATE SL; DanioVision tracking gives ~63 mm/s (van de Pol 2021), a frame-rate-limited lower bound';
      acc = 20 * qT; accKind = spdKind; accSrc = 'Turrini 2023 citing Kim 2017: 20,000 mm/s^2, x Q10 factor; held size-independent within the larval range (assumption)';
    } else if (flier && !zebra) {
      BLs = 4.51 / 0.308; spdKind = 'derived';
      spdSrc = 'Makiguchi 2013: tail-beat 21.2 ± 4.6 Hz at water exit in 30.8 ± 3.1 cm fish -> leap speed 3.87-5.15 m/s by Wardle\'s formula (stride 0.6-0.8 L); midpoint 4.51 m/s / 0.308 m (fork length taken as SL). An estimate from tail-beat, not a measured speed';
    } else {
      BLs = (27800 * 1.0e-3 / (1000 * 0.033)) / 0.033; spdKind = zebra ? 'derived' : 'borrowed';
      spdSrc = 'Danos & Lauder 2012 (adult zebrafish, "mean total length 33.0±1.3 mm", 5 fish, 1 ms frames): "The mean maximum Reynolds number in 1 mPa s water was 27,800 (±2140 s.e.m.)", Re computed from "fish length, maximum linear velocity per sequence" -> U = Re mu / (rho L) = 0.842 m/s = 25.5 TL/s (rho 1000 kg/m3 assumed). Applied per SL, which understates by SL/TL. ' + SRC.danos2012;
    }
    const Upk = BLs * SL * qT;
    out.peak_escape_speed_m_s = met('peak_escape_speed_m_s', 'Peak escape speed', r3(Upk), 'm/s', 'higher', spdKind, spdSrc);
    out.peak_escape_speed_BL_s = met('peak_escape_speed_BL_s', 'Peak escape speed', r3(BLs * qT), 'body lengths/s', 'higher', spdKind, spdSrc);
    out.peak_escape_acceleration_m_s2 = acc == null ? nullMetric('peak_escape_acceleration_m_s2', 'no fetched peak acceleration for post-larval zebrafish or flying fish')
      : met('peak_escape_acceleration_m_s2', 'Peak escape acceleration', r3(acc), 'm/s^2', 'higher', accKind, accSrc);
    P('peak escape speed', r3(Upk), spdKind, spdSrc);

    let survives = null, limiting = null;
    if (larva) {
      // measured escape probability (flow sensing)
      const pe = params.lateral_line_intact >= 0.5 ? 0.7 : 0.05; const k = zebra ? 'calibrated' : 'borrowed'; // read-back of Stewart 2013 (A1)
      out.escape_probability = met('escape_probability', label('escape_probability').label, pe, 'fraction', 'higher', k,
        'Stewart et al. 2013: larvae escaped adult zebrafish strikes with mean P(escape)=0.7 (N=13); 0.05 with the lateral line ablated (N=11); ' + SRC.stewart2013);
      P('escape probability', pe, k, SRC.stewart2013);
      limiting = `per-strike escape probability ${pe} (measured lookup, adult zebrafish predator); the outcome is probabilistic, so survives is null`;
      const why = 'the visual looming model was fitted to adults; larvae detect strikes mainly by flow (Stewart 2013)';
      for (const k2 of ['response_distance_m', 'min_distance_to_predator_m', 'critical_predator_speed_ratio']) out[k2] = nullMetric(k2, why);
    } else {
      out.escape_probability = nullMetric('escape_probability', 'larval lookup only (Stewart 2013); post-larval escape uses the looming geometry');
      // visual looming evasion geometry (McKee & McHenry 2020 eqs 4-5)
      const vBL = 0.037 / 0.036; const vKind = zebra ? 'derived' : 'borrowed';
      const v = vBL * SL * qT; const K = params.predator_speed_ratio; const u = K * v;
      const W = params.predator_width_SL * SL, s = params.strike_distance_SL * SL;
      const th = params.theta_thresh_deg * Math.PI / 180, tl = params.visual_latency_s;
      const dThr = W / (2 * Math.tan(th / 2));
      const dResp = dThr - u * tl;
      const dMin = dResp <= 0 ? 0 : (K <= 1 ? dResp : dResp / K);
      const Kcrit = dThr / (s + v * tl);
      P('mean escape speed', r3(v), vKind, 'McKee & McHenry 2020: "mean escape speed measured in response to the live predator (v = 3.7 cm s-1, N = 63)", normalised by L = 3.6 cm from a different adult cohort (Liu 2026)');
      P('predator speed u = K v', r3(u), 'derived', 'parameter K x v');
      P('threshold distance W/(2 tan(theta/2))', r3(dThr), 'derived', 'geometry');
      out.response_distance_m = met('response_distance_m', label('response_distance_m').label, r3(Math.max(0, dResp)), 'm', 'higher', 'derived', 'd_resp = W/(2 tan(theta/2)) - u t_lat; ' + SRC.mckee2020);
      out.min_distance_to_predator_m = met('min_distance_to_predator_m', label('min_distance_to_predator_m').label, r3(dMin), 'm', 'higher', 'derived', 'McKee & McHenry 2020 eqs 4-5 (Weihs & Webb 1984; Soto et al. 2015) at the optimal escape angle');
      out.critical_predator_speed_ratio = met('critical_predator_speed_ratio', label('critical_predator_speed_ratio').label, r3(Kcrit), 'ratio', 'higher', 'derived', 'K* = d_thr / (s + v t_lat), from (d_thr - K v t_lat)/K = s; valid when K* > 1');
      survives = dMin >= s;
      limiting = survives ? `predator closest approach ${r3(dMin)} m stays outside strike reach ${r3(s)} m (escape works while K < ${r3(Kcrit)})`
        : `predator gets within strike reach: closest approach ${r3(dMin)} m < ${r3(s)} m at K = ${K} (critical K = ${r3(Kcrit)}); the ${tl} s visual latency is the bottleneck`;
      if (!zebra) notes.push('looming threshold, latency and escape speed are adult-zebrafish values borrowed in body lengths.');
    }

    // aerial escape: the SAME computation as glide.mjs (its launchSpeed, glidePath and glideParts, same launch
    // height, ground effect on), so the studio gives one answer; the takeoff check is launch speed >= v_min.
    const Ap = V(state, 'pectoral_area_both_m2');
    let Umin = null, avail = null, dAir = null, launch = null;
    const S = liftingArea(state);
    if (S.value != null && S.value > 0 && mass != null && !larva) {
      const rho = airDensity(state); const polar = polarOf(state);
      const W = mass * G; const span = V(state, 'pectoral_span_m');
      const ls = launchSpeed(state, params.launch_speed_m_s ?? 0);
      launch = ls.value;
      const gp = glidePath({ W, S: S.value, rho: rho.value, v0: launch ?? 0, h: params.aerial_launch_height_m, span, groundEffect: true });
      Umin = gp.vmin;
      if (launch != null) { avail = launch >= Umin; dAir = glideParts(gp, avail).total; }
      else notes.push(`aerial escape: ${ls.reason}`);
      P('lifting area', S.value, S.kind, S.source);
      P('air density', rho.value, rho.kind, rho.source);
      P('glide polar CLmax / (L/D)max', `${PARK_CHOI.CL_max} / ${PARK_CHOI.LD_max}`, polar.kind, polar.source);
      P('launch (water-exit) speed', launch, launch != null ? ls.kind : 'assumed', launch != null ? `glide.mjs launchSpeed: ${ls.source}` : `none: ${ls.reason}`);
      if (span == null) notes.push('pectoral_span_m null: no ground effect applied.');
    }
    const airReason = larva ? 'larvae: no aerial escape modelled' : (Ap == null && S.value == null ? 'no pectoral_area_both_m2 or lifting_area_m2 in STATE' : (mass == null ? 'mass_kg is null in STATE' : 'no lifting area'));
    out.aerial_glide_min_speed_m_s = Umin == null ? nullMetric('aerial_glide_min_speed_m_s', airReason)
      : met('aerial_glide_min_speed_m_s', label('aerial_glide_min_speed_m_s').label, r3(Umin), 'm/s', 'lower', 'derived', 'glide.mjs glidePath v_min = sqrt(2 W / (rho S CLmax)); CLmax 0.78 (Park & Choi 2010)');
    out.aerial_escape_available = avail == null ? nullMetric('aerial_escape_available', launch == null && Umin != null ? 'no sourced launch speed for this organism (glide.mjs launchSpeed)' : airReason)
      : met('aerial_escape_available', label('aerial_escape_available').label, avail, 'bool', 'higher', 'derived', `takeoff check: launch speed ${r3(launch)} m/s vs v_min ${r3(Umin)} m/s (launch speed from glide.mjs launchSpeed)`);
    out.aerial_escape_distance_m = dAir == null ? nullMetric('aerial_escape_distance_m', launch == null && Umin != null ? 'no sourced launch speed for this organism' : airReason)
      : met('aerial_escape_distance_m', label('aerial_escape_distance_m').label, r3(dAir), 'm', 'higher', 'derived', `identical to glide.mjs glide_range_total_m (glidePath + glideParts: level kinetic phase with measured ground effect + descent from ${params.aerial_launch_height_m} m); 0 when the takeoff check fails`);
    if (avail && survives === false) {
      survives = null;
      limiting += `; an aerial escape of about ${r3(dAir)} m is available. Whether leaving the water saves the fish is not measured (it is the leading hypothesis: Davenport 1994; Makiguchi 2013 saw flying fish leap when pursued by blacktip sharks)`;
    }

    return {
      metrics: METRICS.map(m => out[m.key]),
      survives, feasible: avail, limiting, provenance: prov,
      scope: 'survives = the fish evades the predator (null when the outcome is probabilistic or rests on an unmeasured aerial escape); feasible = an aerial escape is physically available (takeoff check). A kinematic encounter model, not a survival rate. It does not model predator strike kinematics, suction flow, escape direction choice, habituation, schooling, turbidity or light; the larval probability is a measured lookup for one predator (adult zebrafish). Adult zebrafish peak speed is a single-lab mean of 5 fish, applied per SL; other post-larval species borrow it. The aerial distance is the glide.mjs still-air range bound (with ground effect; the launch airspeed comes from glide.mjs, which for adult flying fish is the taxi-end speed) and says nothing about what the predator does next.',
      validity: { inRange: inRange && SL > 0.002 && SL < 0.5, notes: notes.join(' ') || 'within the ranges of the sources' },
    };
  },

  modelCard: {
    equations: [
      'speed(T) = speed_ref x 1.5^((T - 26)/10)   (borrowed muscle Vmax Q10)',
      'U_peak = BL_s x SL x 1.5^((T-26)/10);  larva U_peak = 0.2 m/s x Q10 factor (absolute; BL/s = U/SL);  flying fish 4.51/0.308 = 14.6;  adult zebrafish 25.5 (Danos & Lauder 2012: Re 27,800, TL 33 mm)',
      'd_thr = W / (2 tan(theta_thresh/2));   d_resp = d_thr - u t_lat;   u = K v',
      'd_min = d_resp if K <= cos(alpha);  else d_min = d_resp |sin alpha| / sqrt(K^2 - 2K cos alpha + 1); at the optimal alpha (cos alpha = 1/K) d_min = d_resp / K',
      'survives = d_min >= strike reach s;   K* = d_thr / (s + v t_lat)',
      'larva: P(escape) = 0.70 (lateral line intact) or 0.05 (ablated), measured lookup',
      'takeoff check: aerial escape available if U_launch >= v_min = sqrt(2 m g / (rho_air CLmax A_lift)); U_launch = glide.mjs launchSpeed (whatever glide reports: at writing 15 m/s taxi-end airspeed for adult flying fish, min(10 m/s, 30 BL/s) below adult size, zebrafish Umax) unless a what-if is set',
      'd_air = glide.mjs glideParts(glidePath(v0 = U_launch, h = launch height, ground effect on)).total  (= glide.mjs glide_range_total_m), 0 if the takeoff check fails',
    ],
    sources: [
      { cite: 'Burgess & Granato 2007, J Neurosci 27:4984 (SLC latency 5.3 ms larva; adult modal 8 ms)', doi_or_url: 'https://doi.org/10.1523/JNEUROSCI.0615-07.2007' },
      { cite: 'McKee & McHenry 2020, Integr Org Biol 2:obaa023 (visual threshold, latency, escape speed, evasion model)', doi_or_url: 'https://doi.org/10.1093/iob/obaa023' },
      { cite: 'Stewart, Cardenas & McHenry 2013, J Exp Biol 216:388 (larval P(escape) 0.7 / 0.05)', doi_or_url: 'https://doi.org/10.1242/jeb.072751' },
      { cite: 'Turrini et al. 2023, Int J Mol Sci 24:9833, citing Kim et al. 2017 Nat Methods (larval 200 mm/s, 20 m/s^2)', doi_or_url: 'https://doi.org/10.3390/ijms24129833' },
      { cite: 'van de Pol et al. 2021, Front Physiol 12:738804 (larval startle ~63 mm/s, DanioVision)', doi_or_url: 'https://doi.org/10.3389/fphys.2021.738804' },
      { cite: 'Danos & Lauder 2012, J Exp Biol 215:1854 (adult zebrafish C-start: max Re 27,800 at TL 33 mm -> 0.84 m/s)', doi_or_url: 'https://doi.org/10.1242/jeb.068957' },
      { cite: 'Schuster 2023, J Comp Physiol A (teleost context: pike < 11 BL/s; archerfish 24 BL/s); no longer used for a value', doi_or_url: 'https://doi.org/10.1007/s00359-023-01658-2' },
      { cite: 'Liu et al. 2026, Biomimetics 11:156 (adult zebrafish L = 3.6 cm)', doi_or_url: 'https://doi.org/10.3390/biomimetics11020156' },
      { cite: 'Makiguchi et al. 2013, Aquat Biol 18:105 (flying fish leap under shark pursuit; 21.2 Hz; 3.87-5.15 m/s estimate; field 10 m/s quoted)', doi_or_url: 'https://doi.org/10.3354/ab00494' },
      { cite: 'Park & Choi 2010, J Exp Biol 213:3269 (CLmax 0.78, L/D 4.37)', doi_or_url: 'https://doi.org/10.1242/jeb.046052' },
      { cite: 'Woytanowski & Coughlin 2013, Biol Open 2:274 (muscle Vmax Q10 ~1.5)', doi_or_url: 'https://doi.org/10.1242/bio.20133509' },
      { cite: 'Trujillo et al. 2022, J Exp Biol 225:jeb243973 (teleost latencies 5-150 ms, citing Domenici & Hale 2019)', doi_or_url: 'https://doi.org/10.1242/jeb.243973' },
    ],
    validity: 'Zebrafish larvae 5-7 dpf and adults at 23-28 C (sources: 23-27 C, 27 C; Danos & Lauder unstated); looming geometry fitted to adult zebrafish facing a 15 cm cichlid; aerial part only for post-larval designs with a pectoral area and mass in STATE. Values for non-zebrafish species are borrowed in body lengths.',
    validatedAgainst: [
      { organism: 'Danio rerio adult', observation: 'McKee & McHenry 2020: escape fails at all angles when the predator approaches at more than about twice the escape speed (w = 2.5 cm)', predicted: 'critical K = 2.11 with the paper\'s own inputs', measured: '"more than twice as fast"', source: 'doi:10.1093/iob/obaa023 — NOT independent: same model and inputs, so this checks the implementation only' },
      { organism: 'Cypselurus hiraii / Exocoetidae', observation: 'water-exit speed needed to glide vs field launch speed', predicted: 'v_min = 9.85 m/s (60 g, lifting area 0.01269 m^2, CLmax 0.78; via glide.mjs)', measured: 'about 10 m/s in the field (secondhand: Makiguchi 2013 citing Edgerton & Breder 1941, Davenport)', source: 'doi:10.3354/ab00494; doi:10.1242/jeb.046052 — consistent; the captive leap estimates (3.87-5.15 m/s) would NOT suffice' },
      { organism: 'Exocoetidae (several genera)', observation: 'single glide distance: up to 50 m at 15-20 m/s airspeed (secondhand, Makiguchi 2013 citing Edgerton & Breder 1941)', predicted: 'with a 15-20 m/s what-if launch: 32.9-71.8 m (identical to glide.mjs for the L3 specimen, 1 m launch height); at a 10 m/s leap what-if (no taxi): 5.0 m; at the glide.mjs adult default (15 m/s taxi-end) 32.9 m', measured: 'up to 50 m', source: 'doi:10.3354/ab00494 — inside the 15-20 m/s band, but partly circular: the 15-20 m/s airspeed comes from the same observation, and real fish reach it by taxiing, which is not modelled. An earlier version used its own energy-height formula (22 m); it was replaced so predator and glide report one number' },
      { organism: 'Danio rerio adult', observation: 'peak C-start speed', predicted: '0.84 m/s at TL 33 mm (input from Danos & Lauder 2012)', measured: 'Re 27,800 -> 0.84 m/s', source: 'doi:10.1242/jeb.068957 — a read-back, not a validation (amendment A1); replaces the earlier borrowed pike bound of 11 BL/s (0.41 m/s), which was half the measured value' },
      { organism: 'Danio rerio larva', observation: 'peak escape speed', predicted: '0.2 m/s (input, secondhand)', measured: '~63 mm/s by DanioVision (van de Pol 2021)', source: 'doi:10.3389/fphys.2021.738804 — a 3x disagreement between two measurements that reflects tracking frame rate; not an independent test' },
    ],
  },
};
