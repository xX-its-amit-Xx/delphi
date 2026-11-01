// Tests for the behaviour/physiology scenarios: predator, grip, sleep, daynight, digestion.
// Run: node sim-engine/test/scenarios-behaviour.mjs   (exit code 1 on any failure)
//
// Every check is written as check(name, predicate, good, bad): the predicate must accept `good` AND
// reject `bad`. `bad` is a deliberately wrong input (a swapped value, a mutated state, a broken result),
// so each check is shown to be able to fail on every run, not just once by hand.
// Fixtures are hand-built STATE objects (zebrafish larva, zebrafish adult, flying fish adult); their
// numbers are plausible test inputs, labelled 'assumed', not data.
import { loadScenarios, runScenario, validateResult } from '../scenarios/index.mjs';
import glideMod, { launchSpeed } from '../scenarios/glide.mjs';

const F = (value, unit = null, kind = 'assumed', source = 'test fixture') => ({ value, unit, kind, source });
const base = (o) => ({
  design_id: F('test'), body_density_kg_m3: F(1050, 'kg/m3'), wetted_area_m2: F(null), frontal_area_m2: F(null),
  caudal_area_m2: F(null), red_muscle_fraction: F(null), white_muscle_fraction: F(null), gill_area_m2: F(null),
  hb_P50_kPa: F(null), has_swimbladder: F(true), temperature_C: F(26, 'degC'),
  ambient: { air_density_kg_m3: F(1.225, 'kg/m3'), pressure_kPa: F(101.325, 'kPa'), water_density_kg_m3: F(1025, 'kg/m3') },
  parts: { intestine: { scale: 1 }, pectoral_fin_L: { scale: 1 }, pectoral_fin_R: { scale: 1 } }, ...o,
});
const FIX = {
  zebrafish_larva: base({ species: F('Danio rerio'), stage: F('larva'), ageDays: F(4, 'days post-hatching'), SL_m: F(0.0045, 'm'), mass_kg: F(8.5e-7, 'kg'), pectoral_area_both_m2: F(null), pectoral_span_m: F(null), temperature_C: F(28, 'degC') }),
  zebrafish_adult: base({ species: F('Danio rerio'), stage: F('adult'), ageDays: F(180, 'days post-hatching'), SL_m: F(0.036, 'm'), mass_kg: F(0.0007, 'kg'), pectoral_area_both_m2: F(3.0e-5, 'm2'), pectoral_span_m: F(0.012, 'm') }),
  flying_fish_adult: base({ species: F('Cypselurus hiraii'), stage: F('adult'), ageDays: F(365, 'days post-hatching'), SL_m: F(0.203, 'm'), mass_kg: F(0.06, 'kg'), pectoral_area_both_m2: F(0.006377, 'm2'), pectoral_span_m: F(0.261, 'm') }),
};
const withT = (s, T) => ({ ...s, temperature_C: F(T, 'degC') });
const withAge = (s, a, stage) => ({ ...s, ageDays: F(a), ...(stage ? { stage: F(stage) } : {}) });

let pass = 0, fail = 0;
function check(name, pred, good, bad) {
  let okGood, okBad;
  try { okGood = !!pred(good); } catch (e) { okGood = false; }
  try { okBad = !pred(bad); } catch (e) { okBad = true; }
  if (okGood && okBad) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${okGood ? '' : ' [good input rejected]'}${okBad ? '' : ' [bad input accepted: the check cannot fail]'}`); }
}
const mv = (r, k) => r.metrics?.find(m => m.key === k)?.value;
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;

const { scenarios, errors } = await loadScenarios();
const MINE = ['predator', 'grip', 'sleep', 'daynight', 'digestion'];
const S = k => scenarios.get(k);
const run = (k, st, p = {}) => runScenario(S(k), st, p);

console.log('registry');
check('all five modules load and validate', ks => ks.every(k => scenarios.has(k)) && !errors.some(e => MINE.some(k => e.startsWith(k + '.mjs'))), MINE, [...MINE, 'no_such_scenario']);

console.log('interface, every module x every fixture');
for (const k of MINE) for (const [fx, st] of Object.entries(FIX)) {
  const r = run(k, st);
  check(`${k} on ${fx}: runs and passes validateResult`, x => x.ok === true && validateResult(S(k), x).length === 0, r, { ...r, metrics: [...(r.metrics || []), { key: 'not_declared', value: 1, unit: '-', better: null, kind: 'derived', source: 'x' }] });
  check(`${k} on ${fx}: emits exactly the static metric list, in order`, x => JSON.stringify(x.metrics.map(m => m.key)) === JSON.stringify(S(k).metrics.map(m => m.key)), r, { ...r, metrics: r.metrics.slice(1) });
  check(`${k} on ${fx}: every null metric carries a reason, no NaN`, x => x.metrics.every(m => (m.value === null ? typeof m.reason === 'string' && m.reason.length > 0 : (typeof m.value !== 'number' || Number.isFinite(m.value)))), r, { ...r, metrics: [{ ...r.metrics[0], value: null, reason: undefined }] });
}

console.log('predator');
{
  const L = run('predator', FIX.zebrafish_larva), A = run('predator', FIX.zebrafish_adult), FF = run('predator', FIX.flying_fish_adult);
  check('larval Mauthner latency (5.3 ms) is shorter than adult (8 ms)', ([l, a]) => mv(l, 'startle_latency_ms') === 5.3 && mv(a, 'startle_latency_ms') === 8 && mv(l, 'startle_latency_ms') < mv(a, 'startle_latency_ms'), [L, A], [A, L]);
  const Lab = run('predator', FIX.zebrafish_larva, { lateral_line_intact: 0 });
  check('larval escape probability 0.7 intact (Stewart 2013)', r => mv(r, 'escape_probability') === 0.7, L, Lab);
  check('larval escape probability 0.05 with lateral line ablated', r => mv(r, 'escape_probability') === 0.05, Lab, L);
  check('larva: survives is null (probabilistic outcome)', r => r.survives === null, L, A);
  const A26 = run('predator', withT(FIX.zebrafish_adult, 26));
  check('adult zebrafish critical K = 2.11 at 26 C (McKee & McHenry 2020 "more than twice")', r => near(mv(r, 'critical_predator_speed_ratio'), 2.11, 0.03), A26, run('predator', withT(FIX.zebrafish_adult, 26), { theta_thresh_deg: 30 }));
  check('adult zebrafish escapes at K = 1.5 and is caught at K = 3', ([a, b]) => a.survives === true && b.survives === false, [A26, run('predator', withT(FIX.zebrafish_adult, 26), { predator_speed_ratio: 3 })], [run('predator', withT(FIX.zebrafish_adult, 26), { predator_speed_ratio: 3 }), A26]);
  check('larval peak speed is the absolute 0.2 m/s at 26 C (secondhand; no assumed larval length), BL/s = U/SL', r => near(mv(r, 'peak_escape_speed_m_s'), 0.2, 1e-6) && near(mv(r, 'peak_escape_speed_BL_s'), 0.2 / 0.0045, 0.01), run('predator', withT(FIX.zebrafish_larva, 26)), L);
  check('flying fish: glide minimum speed 9.4-10.4 m/s (field launch ~10 m/s)', r => mv(r, 'aerial_glide_min_speed_m_s') > 9.4 && mv(r, 'aerial_glide_min_speed_m_s') < 10.4, FF, A);
  const FF10 = run('predator', FIX.flying_fish_adult, { launch_speed_m_s: 10 });
  check('flying fish at a 10 m/s leap what-if: aerial escape available (feasible); adult zebrafish: not', ([f, z]) => mv(f, 'aerial_escape_available') === true && f.feasible === true && mv(z, 'aerial_escape_available') === false && z.feasible === false, [FF10, A], [A, FF10]);
  const glideLaunch = launchSpeed(FIX.flying_fish_adult, 0).value; // read from glide.mjs, never hard-coded
  const FFg = run('predator', FIX.flying_fish_adult, { launch_speed_m_s: glideLaunch });
  check('default launch speed is glide.mjs launchSpeed (' + glideLaunch + ' m/s now): same verdict and distance as that explicit what-if', r => typeof glideLaunch === 'number' && mv(r, 'aerial_escape_available') === mv(FFg, 'aerial_escape_available') && near(mv(r, 'aerial_escape_distance_m'), mv(FFg, 'aerial_escape_distance_m'), 1e-6) && r.provenance.some(q => /launch/.test(q.quantity) && q.value === glideLaunch), FF, run('predator', FIX.flying_fish_adult, { launch_speed_m_s: 6 }));
  for (const v of [0, 10, 15, 20]) {
    const pr = run('predator', FIX.flying_fish_adult, { launch_speed_m_s: v });
    const gl = runScenario(glideMod, FIX.flying_fish_adult, { launch_airspeed_override_m_s: v });
    const gd = gl.metrics.find(m => m.key === 'glide_range_total_m').value;
    check('aerial distance identical to glide.mjs glide_range_total_m (launch ' + (v || 'default') + ' m/s)', r => near(mv(r, 'aerial_escape_distance_m'), gd, 1e-3), pr, run('predator', FIX.flying_fish_adult, { launch_speed_m_s: v || 15, aerial_launch_height_m: 4 }));
  }
  check('glide band 15-20 m/s brackets the 50 m field glide', ([x, y]) => mv(x, 'aerial_escape_distance_m') < 50 && mv(y, 'aerial_escape_distance_m') > 50, [run('predator', FIX.flying_fish_adult, { launch_speed_m_s: 15 }), run('predator', FIX.flying_fish_adult, { launch_speed_m_s: 20 })], [FF10, FF10]);
  check('flying fish: underwater failure becomes survives=null when an aerial escape exists', r => r.survives === null && /aerial escape/.test(r.limiting), run('predator', FIX.flying_fish_adult, { predator_speed_ratio: 5, launch_speed_m_s: 10 }), run('predator', FIX.zebrafish_adult, { predator_speed_ratio: 5 }));
  check('adult zebrafish C-start 0.84 m/s at TL 33 mm, 26 C (Danos & Lauder 2012, Re 27,800)', r => near(mv(r, 'peak_escape_speed_m_s'), 0.842, 0.005), run('predator', withT({ ...FIX.zebrafish_adult, SL_m: F(0.033, 'm') }, 26)), run('predator', withT(FIX.zebrafish_adult, 26)));
  check('adult latency and larval escape probability are read-backs (calibrated)', ([x, l]) => x.metrics.find(m => m.key === 'startle_latency_ms').kind === 'calibrated' && l.metrics.find(m => m.key === 'escape_probability').kind === 'calibrated', [A, L], [FF, L]);
  check('flying fish latency is labelled borrowed (no flying-fish measurement)', r => r.metrics.find(m => m.key === 'startle_latency_ms').kind === 'borrowed', FF, A);
  check('egg: nothing computed', r => r.metrics.every(m => m.value === null), run('predator', withAge(FIX.zebrafish_larva, -1, 'egg')), L);
}

console.log('sleep');
{
  const L = run('sleep', FIX.zebrafish_larva), A = run('sleep', FIX.zebrafish_adult), FF = run('sleep', FIX.flying_fish_adult);
  check('6 s series (one definition): larva 58.17% > adult 33.37% night (Sorribes 2013)', ([l, x]) => mv(l, 'sleep_fraction_night') === 0.582 && mv(x, 'sleep_fraction_night') === 0.334 && mv(l, 'sleep_fraction_night') > mv(x, 'sleep_fraction_night'), [L, A], [A, L]);
  check('juvenile 6 s night = 54.25%', r => mv(r, 'sleep_fraction_night') === 0.543, run('sleep', withAge(FIX.zebrafish_adult, 35, 'juvenile')), A);
  check('adult: day (5.1%) below night under the 6 s criterion', r => mv(r, 'sleep_fraction_day') === 0.051 && mv(r, 'sleep_fraction_day') < mv(r, 'sleep_fraction_night'), A, { ...A, metrics: A.metrics.map(m => m.key === 'sleep_fraction_day' ? { ...m, value: 0.9 } : m) });
  check('larva: no 6 s daytime value, null with a reason (not silently filled)', r => mv(r, 'sleep_fraction_day') === null && /6 s criterion/.test(r.metrics.find(m => m.key === 'sleep_fraction_day').reason), L, A);
  check('alternative definitions: larva 83.9% / 19.6% (Choudhary, 1 min) at 28 C; adult 58.1% (Yokogawa)', ([l, x]) => mv(l, 'alt_def_sleep_fraction_night') === 0.839 && mv(l, 'alt_def_sleep_fraction_day') === 0.196 && mv(x, 'alt_def_sleep_fraction_night') === 0.581, [L, A], [A, L]);
  check('both definitions are reported for the larva and differ (no silent pick)', r => mv(r, 'sleep_fraction_night') != null && mv(r, 'alt_def_sleep_fraction_night') != null && mv(r, 'sleep_fraction_night') !== mv(r, 'alt_def_sleep_fraction_night'), L, { ...L, metrics: L.metrics.map(m => m.key === 'alt_def_sleep_fraction_night' ? { ...m, value: mv(L, 'sleep_fraction_night') } : m) });
  check('larva sleeps more at 24 C than at 28 C (alternative series)', ([c, w]) => mv(c, 'alt_def_sleep_fraction_day') > mv(w, 'alt_def_sleep_fraction_day') && mv(c, 'alt_def_sleep_fraction_night') > mv(w, 'alt_def_sleep_fraction_night'), [run('sleep', withT(FIX.zebrafish_larva, 24)), L], [L, run('sleep', withT(FIX.zebrafish_larva, 24))]);
  const Ah = run('sleep', FIX.zebrafish_adult, { hcrtr_loss: 1 });
  check('hcrtr loss cuts adult night sleep by 25% in both series (Yokogawa 2007: 20-30%)', r => near(mv(r, 'sleep_fraction_night'), 0.3337 * 0.75, 0.002) && near(mv(r, 'alt_def_sleep_fraction_night'), 0.581 * 0.75, 0.002), Ah, A);
  check('hcrt overexpression raises larval night sleep latency 13 -> 77 min (Prober 2006)', r => mv(r, 'night_sleep_latency_min') === 77, run('sleep', FIX.zebrafish_larva, { hcrt_overexpression: 1 }), L);
  check('lookup sleep values are labelled calibrated (amendment A1)', r => ['sleep_fraction_night', 'sleep_fraction_day', 'alt_def_sleep_fraction_night'].every(k => r.metrics.find(m => m.key === k).kind === 'calibrated'), A, FF);
  check('larva before 5 dpf: no sleep numbers', r => r.metrics.every(m => m.value === null), run('sleep', withAge(FIX.zebrafish_larva, 1)), L);
  check('flying fish: flagged out of range (borrowed zebrafish values)', r => r.validity.inRange === false && r.metrics.find(m => m.key === 'sleep_fraction_night').kind === 'borrowed', FF, A);
  check('sleep h/day = alt f_day*14 + alt f_night*10', r => near(mv(r, 'sleep_hours_per_day'), 0.051 * 14 + 0.581 * 10, 0.002), A, L);
}

console.log('daynight');
{
  const L = run('daynight', FIX.zebrafish_larva), A = run('daynight', FIX.zebrafish_adult);
  for (const [n, r] of [['larva', L], ['adult', A]]) check(`${n}: diurnal (most activity in the light)`, x => mv(x, 'diurnal_activity_fraction') > 0.5, r, { ...r, metrics: r.metrics.map(m => m.key === 'diurnal_activity_fraction' ? { ...m, value: 0.3 } : m) });
  check('adult diurnality higher at 20 C than 26 C (López-Olmeda 2006: 87% vs 77%)', ([c, w]) => mv(c, 'diurnal_activity_fraction') > mv(w, 'diurnal_activity_fraction'), [run('daynight', withT(FIX.zebrafish_adult, 20)), run('daynight', withT(FIX.zebrafish_adult, 26))], [run('daynight', withT(FIX.zebrafish_adult, 26)), run('daynight', withT(FIX.zebrafish_adult, 20))]);
  check('adult 12:12 share at 26 C = 0.77', r => near(mv(r, 'diurnal_activity_fraction'), 0.77, 0.001), run('daynight', withT(FIX.zebrafish_adult, 26), { light_hours: 12 }), run('daynight', withT(FIX.zebrafish_adult, 20), { light_hours: 12 }));
  check('free-running period: larva 25.08 h, adult 23.25 h', ([l, a]) => mv(l, 'free_running_period_h') === 25.08 && mv(a, 'free_running_period_h') === 23.25, [L, A], [A, L]);
  check('larval period within 1 SD of the LL measurement 24.93 ± 1.87 h (Chaigne 2024)', r => Math.abs(mv(r, 'free_running_period_h') - 24.93) <= 1.87, L, { ...L, metrics: L.metrics.map(m => m.key === 'free_running_period_h' ? { ...m, value: 28 } : m) });
  check('larva at 3 dpf: rhythm not present', r => mv(r, 'rhythm_present') === false, run('daynight', withAge(FIX.zebrafish_larva, 1)), L);
}

console.log('digestion');
{
  const A26 = run('digestion', withT(FIX.zebrafish_adult, 26)), A36 = run('digestion', withT(FIX.zebrafish_adult, 36)), L = run('digestion', FIX.zebrafish_larva);
  check('adult SMR at 26 C = 228.5 mg O2/kg/h (Hejlesen 2024: 119 umol/min/kg)', r => near(mv(r, 'routine_metabolic_rate_mgO2_kg_h'), 228.48, 0.05), A26, A36);
  check('adult SMR Q10 over 10 C = 1.39 (Ripley 2022)', ([a, b]) => near(mv(b, 'routine_metabolic_rate_mgO2_kg_h') / mv(a, 'routine_metabolic_rate_mgO2_kg_h'), 1.39, 0.001), [A26, A36], [A26, A26]);
  const noGut = { ...FIX.zebrafish_adult, parts: { ...FIX.zebrafish_adult.parts, intestine: { scale: 0 } } };
  check('intestine removed: zero intake, survives=false, feasible=false', r => r.survives === false && r.feasible === false && mv(r, 'energy_intake_J_day') === 0, run('digestion', noGut), A26);
  const maint = mv(A26, 'maintenance_ration_pct_bw_day');
  check('at the (3-decimal) maintenance ration the net balance is zero within 1% of routine cost', r => Math.abs(mv(r, 'net_energy_J_day')) < 0.01 * mv(r, 'routine_cost_J_day'), run('digestion', withT(FIX.zebrafish_adult, 26), { ration_pct_bw_day: maint }), run('digestion', withT(FIX.zebrafish_adult, 26), { ration_pct_bw_day: maint * 2 }));
  check('larval gut passage 16 h at 28 C (Zada 2022), shorter when warmer', ([a, b]) => near(mv(a, 'gut_passage_time_h'), 16, 1e-6) && mv(b, 'gut_passage_time_h') < 16, [L, run('digestion', withT(FIX.zebrafish_larva, 31))], [run('digestion', withT(FIX.zebrafish_larva, 31)), L]);
  check('adult gut passage time is null with a reason (no measurement found)', r => mv(r, 'gut_passage_time_h') === null && /not found|no juvenile/.test(r.metrics.find(m => m.key === 'gut_passage_time_h').reason), A26, L);
  const A285 = run('digestion', withT(FIX.zebrafish_adult, 28.5));
  check('VALIDATION (documented failure): predicted adult maintenance ration is ~0.6% BW/day, below the ~2% reported', r => mv(r, 'maintenance_ration_pct_bw_day') > 0.4 && mv(r, 'maintenance_ration_pct_bw_day') < 1.0, A285, run('digestion', withT(FIX.zebrafish_adult, 28.5), { faecal_loss_fraction: 0.85 }));
  check('flying fish: all borrowed, flagged out of range', r => r.validity.inRange === false && r.metrics[0].kind === 'borrowed', run('digestion', withT(FIX.flying_fish_adult, 28)), A26);
}

console.log('grip');
{
  const A = run('grip', FIX.zebrafish_adult), FF = run('grip', FIX.flying_fish_adult);
  check('zebrafish: no gripping structure, feasible false, survives null, forces null', r => mv(r, 'has_gripping_structure') === false && r.feasible === false && r.survives === null && mv(r, 'adhesive_force_N') === null, A, run('grip', FIX.zebrafish_adult, { disc_area_m2: 8e-4 }));
  check('flying fish: no gripping structure', r => mv(r, 'has_gripping_structure') === false, FF, run('grip', FIX.flying_fish_adult, { disc_area_m2: 8e-4 }));
  const cling = base({ species: F('design with a pelvic suction disc'), stage: F('adult'), SL_m: F(0.095, 'm'), mass_kg: F(0.02, 'kg'), pectoral_area_both_m2: F(null),
    parts: { pelvic_suction_disc: { scale: 1, area_m2: 8e-4 } } });
  const C = run('grip', cling);
  check('clingfish-like disc (8 cm^2, 20 g, 30 kPa): 80-230 body weights as measured', r => mv(r, 'safety_factor_body_weights') >= 80 && mv(r, 'safety_factor_body_weights') <= 230 && r.feasible === true && r.survives === null, C, run('grip', cling, { adhesive_stress_kPa: 1.5 }));
  check('goby-like suction (1.5 kPa) on the same disc still holds (6 BW) but far less', r => mv(r, 'safety_factor_body_weights') > 1 && mv(r, 'safety_factor_body_weights') < 10, run('grip', cling, { adhesive_stress_kPa: 1.5 }), C);
  const lowP = { ...cling, ambient: { ...cling.ambient, pressure_kPa: F(50, 'kPa') } };
  check('stress is capped at ambient pressure', r => near(mv(r, 'adhesive_force_N'), 50e3 * 8e-4, 1e-3), run('grip', lowP, { adhesive_stress_kPa: 80 }), run('grip', cling, { adhesive_stress_kPa: 80 }));
  const noArea = { ...cling, parts: { pelvic_suction_disc: { scale: 1 } } };
  check('disc present without an area: no invented force, feasible null', r => mv(r, 'has_gripping_structure') === true && mv(r, 'adhesive_force_N') === null && r.feasible === null, run('grip', noArea), C);
  check('disc removed by a part edit (scale 0) counts as absent', r => mv(r, 'has_gripping_structure') === false, run('grip', { ...cling, parts: { pelvic_suction_disc: { scale: 0, area_m2: 8e-4 } } }), C);
  // clingfish validation arithmetic from Wainwright 2013 extremes
  const sf = (kPa, cm2, g) => kPa * 1e3 * cm2 * 1e-4 / (g * 1e-3 * 9.81);
  check('Wainwright 2013 extremes bracket the measured 80-230 BW (arithmetic check)', ([lo, hi]) => lo < 80 && hi > 230, [sf(20, 12.3, 42), sf(50, 3.9, 8.2)], [sf(30, 8, 20), sf(30, 8, 20)]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
