#!/usr/bin/env node
// Substitution budget for the flying-fish lineage from the machine-checked fixation theorems.
//   node lean/bound/compute.mjs        -> lean/bound/result.json (also folded into lean.json by report.mjs)
// Every number comes from lean/bound/parameters.json (each value with its source) and from
// dashboard/public/t/lean/lean.json (which theorems the kernel accepted). The arithmetic here applies the
// theorems' formulas; the theorems themselves are the only kernel-checked part, and the result says so.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The theorems the budget rests on (lean/Delphi/Favored.lean and Kimura.lean), with the formula each one
// licenses. If any is missing from the audit or depends on a non-standard axiom, nothing is computed.
export const THEOREMS = {
  neutral: { name: 'Delphi.neutral_expectedSubstitutions', formula: 'E[substitutions] = mu * T for the neutral Wright-Fisher chain, every M' },
  floor: { name: 'Delphi.favored_expectedSubstitutions_ge', formula: 'mu * T <= E[substitutions] for any favored chain (expected copy number never decreases)' },
  ceiling: { name: 'Delphi.expectedSubstitutions_le', formula: 'E[substitutions] <= M * mu * T for any fixation probability u <= 1' },
  wfSelection: { name: 'Delphi.wrightFisherSelection_fixation_one_ge', formula: '1/M <= u for Wright-Fisher with selection coefficient s >= 0' },
  fixationGe: { name: 'Delphi.FavoredChain.fixationProbability_ge', formula: 'i/M <= u(i) for any favored chain' }
};
const STANDARD = new Set(['propext', 'Classical.choice', 'Quot.sound']);

export function computeBound(R, P) {
  const audit = Object.fromEntries(Object.entries(THEOREMS).map(([k, t]) => [k, R.audit.theorems.find(a => a.theorem === t.name) || null]));
  const missing = Object.entries(audit).filter(([, a]) => !a).map(([k]) => THEOREMS[k].name);
  const nonStandard = Object.entries(audit).filter(([, a]) => a && a.axioms.some(x => !STANDARD.has(x))).map(([k]) => THEOREMS[k].name);
  const verified = R.build.ok && R.sorryTotal === 0 && missing.length === 0 && nonStandard.length === 0;
  if (!verified) return { verified, missing, nonStandard, note: 'theorems not verified; no bound computed' };

  const d = P.durationMa, g = P.generationTimeYears, mu = P.mutationRatePerSitePerGeneration, G = P.genomeSites.value;
  // Generations available: duration / generation time. Low uses the youngest age and the longest generation.
  const alt = d.alternativeFirstAppearance || null;
  const T = { low: d.low * 1e6 / g.high, high: d.high * 1e6 / g.low, sensitivity2y: d.low * 1e6 / g.sensitivityHigh, sensitivityAltFossil: alt ? alt.low * 1e6 / g.high : null };
  // Neutral budget per site: mu * T (theorem `neutral`); independent of M, so of N.
  const neutralPerSite = { low: mu.low * T.low, high: mu.high * T.high, sensitivity2y: mu.low * T.sensitivity2y, sensitivityAltFossil: alt ? mu.low * T.sensitivityAltFossil : null };
  const neutralPerGenome = { low: neutralPerSite.low * G, high: neutralPerSite.high * G, sensitivity2y: neutralPerSite.sensitivity2y * G, sensitivityAltFossil: alt ? neutralPerSite.sensitivityAltFossil * G : null };
  // Ceiling per site as a function of N (M = 2N): 2 N mu T (theorem `ceiling`). Grows without bound in N.
  const ceilingPerSiteByN = P.populationSize.tableValues.map(N => ({ N, low: 2 * N * mu.low * T.low, high: 2 * N * mu.high * T.high }));
  return {
    verified, computed: new Date().toISOString(), leanReportBuilt: R.built,
    theorems: Object.fromEntries(Object.entries(THEOREMS).map(([k, t]) => [k, { ...t, axioms: audit[k].axioms }])),
    inputs: {
      durationMa: { low: d.low, high: d.high, source: d.source.label, url: d.source.url, records: d.source.records || null, verified: d.source.verified || null, alternativeFirstAppearance: alt },
      generationTimeYears: { low: g.low, high: g.high, sensitivityHigh: g.sensitivityHigh, sources: g.sources.map(s => s.label) },
      mutationRatePerSitePerGeneration: { low: mu.low, high: mu.high, sources: mu.sources.map(s => s.label) },
      genomeSites: { value: G, source: P.genomeSites.source.label },
      populationSize: { pointEstimates: P.populationSize.pointEstimates.map(p => `${p.species}: ${p.value} (${p.source})`), tableValues: P.populationSize.tableValues },
      undefined: { selectionCoefficient: P.selectionCoefficient.note, fractionOfMutationsFavored: P.fractionOfMutationsFavored.note, requiredSubstitutions: P.requiredSubstitutions.note }
    },
    generations: T,
    neutralPerSite, neutralPerGenome,
    floor: {
      statement: 'Expected adaptive substitutions over T generations are at least mu_f * T per site, where mu_f is the rate of mutations that selection does not oppose. mu_f is undefined, so the floor is a function of mu_f: at mu_f = mu it equals the neutral budget; at mu_f = 0 it is 0.',
      atMuFEqualsMu: neutralPerGenome, independentOfN: true
    },
    ceiling: { statement: 'Expected substitutions over T generations are at most 2 N mu T per site (every mutation that arises fixes). Grows linearly in N and is vacuous for a feasibility question.', perSiteByN: ceilingPerSiteByN, independentOfN: false },
    comparison: { required: null, verdict: 'inconclusive', reason: 'The quantity the budget would have to be compared with, the number of substitutions a wing requires, is undefined; no figure is invented. The floor on adaptive substitutions also depends on the undefined fraction of mutations that selection favours. What is established: the neutral budget and the floor do not depend on N (the parameter the literature constrains least), and the ceiling is vacuous.' },
    kernelChecked: [
      'Delphi.FavoredChain.fixationProbability_ge: in an absorbing chain on 0..M copies whose expected copy number never decreases (selection neutral or for the mutant), with positive one-step escape from every interior state, a lineage of i copies fixes with probability at least i/M; the limit exists because fixation is absorbing.',
      'Delphi.wrightFisherSelection_fixation_one_ge: Wright-Fisher sampling with mutant relative fitness 1+s, s >= 0, is such a chain, so one new mutant fixes with probability at least 1/M.',
      'Delphi.neutral_expectedSubstitutions: with the proved neutral fixation probability 1/M, the defined expected count M mu u T equals mu T for every M.',
      'Delphi.favored_expectedSubstitutions_ge and Delphi.expectedSubstitutions_le: for any favored chain mu T <= M mu u T, and for any u <= 1, M mu u T <= M mu T.'
    ],
    assumed: [
      'The expected count M mu u T is a definition (Kimura 1968: new mutants per generation times fixation probability, summed over generations). Independent fates, no linkage or interference, constant M, constant mu, constant s and non-overlapping generations enter through that definition and are not proved.',
      'The numbers for T, mu, G and N come from the literature sources named in lean/bound/parameters.json, none of which measures Exocoetidae for mu or generation time; the fossil first appearance is a minimum age, and it rests on two PBDB occurrence records from one publication (Bannikov 2014, Monte Bolca); the next-oldest record (David 1946) is 37.71 to 33.9 Ma and is carried as a sensitivity case.',
      'The selection coefficient, the fraction of mutations selection favours, and the number of substitutions a wing requires are undefined; the result is a one-sided budget with nothing to compare it to.',
      'Nothing here is about which substitutions, in which genes, or whether they are reachable in sequence; a count of fixations is not a path to a wing.'
    ]
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const root = path.resolve(here, '../..');
  const R = JSON.parse(fs.readFileSync(path.join(root, 'dashboard/public/t/lean/lean.json'), 'utf8'));
  const P = JSON.parse(fs.readFileSync(path.join(here, 'parameters.json'), 'utf8'));
  const out = computeBound(R, P);
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1));
  if (!out.verified) { console.error('not verified:', JSON.stringify({ missing: out.missing, nonStandard: out.nonStandard })); process.exit(1); }
  console.log(`generations ${out.generations.low.toExponential(2)} to ${out.generations.high.toExponential(2)}; neutral budget per site ${out.neutralPerSite.low.toFixed(3)} to ${out.neutralPerSite.high.toFixed(3)}, per genome ${out.neutralPerGenome.low.toExponential(2)} to ${out.neutralPerGenome.high.toExponential(2)}; verdict ${out.comparison.verdict}`);
}
