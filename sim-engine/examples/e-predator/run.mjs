// Example (e): predator. Which organisms can escape a strike by air?
//   node sim-engine/examples/e-predator/run.mjs
// scenario_run predator with default parameters (tools/studio.mjs). Writes nothing outside this folder.
import { scenarioRun } from '../../tools/studio.mjs';
import { n, q, metric, checker, finish, slim, table } from '../_lib.mjs';

// The brief asked about "the five organisms"; the bundle holds seven (3 reference organisms + 4 designs).
// All seven are run; the first five are the three references and the two headline designs.
const ORGS = ['zebrafish-adult', 'zebrafish-larva', 'flying-fish', 'tff', 'winged-zebrafish', 'wingless-flying-fish', 'ff-zf-chimera'];
const { checks, expect } = checker();

const runs = {};
for (const o of ORGS) runs[o] = await scenarioRun({ organism: o, scenario: 'predator' });
const R = Object.fromEntries(ORGS.map(o => {
  const run = runs[o].result.run, g = k => metric(run, k);
  return [o, { ok: run.ok, survives: run.survives ?? null, limiting: run.limiting ?? run.feasibility_note ?? null, error: run.error ?? null,
    aerial: g('aerial_escape_available'), aerialDist: g('aerial_escape_distance_m'), vmin: g('aerial_glide_min_speed_m_s'),
    speed: g('peak_escape_speed_m_s'), Kcrit: g('critical_predator_speed_ratio'), pEscape: g('escape_probability'), latency: g('startle_latency_ms'),
    launchProv: run.provenance?.find(p => /launch|leap|water-exit/i.test(p.quantity)) ?? null }];
}));
const yes = ORGS.filter(o => R[o].aerial?.value === true), no = ORGS.filter(o => R[o].aerial?.value === false), unk = ORGS.filter(o => R[o].aerial?.value == null);

// ------------------------------------------------------------- expectations
expect('predator ran for all seven organisms', ORGS.every(o => R[o].ok), JSON.stringify(ORGS.filter(o => !R[o].ok).map(o => [o, R[o].error])));
expect('TFF can escape by air', R.tff.aerial?.value === true, JSON.stringify(R.tff.aerial));
expect('no zebrafish (adult, larva, winged) can escape by air', ['zebrafish-adult', 'zebrafish-larva', 'winged-zebrafish'].every(o => R[o].aerial?.value !== true), JSON.stringify(['zebrafish-adult', 'zebrafish-larva', 'winged-zebrafish'].map(o => R[o].aerial?.value)));
expect('wingless flying fish cannot escape by air', R['wingless-flying-fish'].aerial?.value === false, JSON.stringify(R['wingless-flying-fish'].aerial));
expect('blend (ff-zf-chimera) gets no aerial verdict (no launch speed for a blend is invented)', R['ff-zf-chimera'].aerial?.value == null, JSON.stringify(R['ff-zf-chimera'].aerial));
expect('an aerial escape always comes with a positive glide distance', ORGS.every(o => R[o].aerial?.value !== true || R[o].aerialDist?.value > 0), JSON.stringify(ORGS.map(o => [o, R[o].aerial?.value, R[o].aerialDist?.value])));
expect('aerial verdict follows v_min: a lower v_min never loses an escape a higher one has (among fish with the same launch speed)', (() => {
  const ffam = ['flying-fish', 'tff', 'wingless-flying-fish'].filter(o => R[o].aerial?.value != null);
  return ffam.every(a => ffam.every(b => !(R[a].vmin.value <= R[b].vmin.value && R[b].aerial.value === true && R[a].aerial.value === false)));
})(), JSON.stringify(['flying-fish', 'tff', 'wingless-flying-fish'].map(o => [o, R[o].vmin?.value, R[o].aerial?.value])));

// ------------------------------------------------------------- README
const readme = `
**Question.** A predator strikes (the McKee & McHenry 2020 approach model with its default parameters: approach-speed ratio K = 1.5, visual threshold 14°, latency 0.76 s).
Which organisms can leave the water and glide out of reach?
\`scenario_run\` predator on each organism at its reference age.

**Headline.** **Can escape by air: ${yes.join(', ') || 'none'}.** Cannot: ${no.join(', ') || 'none'}. No verdict (no model): ${unk.join(', ') || 'none'}.
${yes.map(o => `- ${o}: glide v_min ${q(R[o].vmin)}, aerial escape distance ${q(R[o].aerialDist)}.`).join('\n')}
${no.map(o => `- ${o} cannot: glide v_min ${q(R[o].vmin)}${R[o].launchProv ? `, launch ${n(R[o].launchProv.value)} m/s (${R[o].launchProv.kind})` : ''}.`).join('\n')}
${unk.map(o => `- ${o}: no verdict (${R[o].aerial?.kind}). ${o === 'zebrafish-larva' ? `The larval branch of the model is an escape-probability lookup (P = ${n(R['zebrafish-larva'].pEscape?.value)}, labelled ${R['zebrafish-larva'].pEscape?.kind}) with no aerial step.` : o === 'ff-zf-chimera' ? 'A blend has no measured leap speed, and none is invented.' : ''}`).join('\n')}

The brief said "the five organisms". The bundle holds seven (three references and four designs), so all seven are shown.

## Every organism

${table(['organism', 'aerial escape available', 'aerial escape distance', 'glide v_min', 'peak escape speed (water)', 'critical predator speed ratio', 'P(escape) per strike', 'survives the strike (water)', 'limiting'],
  ORGS.map(o => { const r = R[o]; return [o, q(r.aerial, ''), q(r.aerialDist), q(r.vmin), q(r.speed), q(r.Kcrit, ''), q(r.pEscape, ''), String(r.survives), r.limiting || ''] }))}

How to read it:
- \`survives\` is the in-water C-start escape. Every adult escapes the default strike while the predator is slower than the critical speed ratio. The larva's outcome is probabilistic (\`escape_probability\`; its kind is in the table), so \`survives\` is null.
- \`aerial_escape_available\` asks whether the fish can leave the water at its own sourced launch speed and stay airborne (launch speed >= glide v_min). The aerial distance uses the glide model, which includes the level kinetic phase (outside the Lean glide theorem; see example a).
- The winged zebrafish's larger fin lowers v_min (compare zebrafish-adult), but nowhere near its own burst speed, so the wing does not buy an aerial escape.

## Scope (from the tool, zebrafish-adult run)

${runs['zebrafish-adult'].scope}
`;

finish({
  dir: import.meta.dirname, title: 'Example (e): escape from a predator by air', checks,
  headline: `aerial escape: yes = ${yes.join(', ') || 'none'}; no = ${no.join(', ')}; no verdict = ${unk.join(', ') || 'none'}`,
  output: { organisms: ORGS, summary: R, runs: Object.fromEntries(ORGS.map(o => [o, slim(runs[o])])) },
  readme,
});
