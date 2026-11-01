// Belief score: INDRA SimpleScorer form, two-sided. Parameters and formula: belief-params.json (versioned).
import path from 'node:path';
import { HERE, readJson, round } from './lib.mjs';

export const PARAMS = readJson(path.join(HERE, 'belief-params.json'));

/**
 * items: [{side: 'support' | 'contradict', cls, key, note?}]
 * returns {belief, E, R, n: {support: {cls: n}, contradict: {cls: n}}, params}
 */
export function belief(items, params = PARAMS) {
  const count = side => {
    const by = {};
    for (const it of items.filter(i => i.side === side)) {
      if (!params.classes[it.cls]) throw new Error(`unknown evidence class ${it.cls}`);
      (by[it.cls] ||= new Set()).add(it.key);
    }
    return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.size]));
  };
  const combine = n => {
    let pWrong = 1;
    for (const [cls, k] of Object.entries(n)) {
      const { rand, syst } = params.classes[cls];
      pWrong *= Math.min(1, syst + rand ** k);
    }
    return 1 - pWrong;
  };
  const ns = count('support'), nc = count('contradict');
  const E = combine(ns), R = combine(nc);
  return { belief: round(E * (1 - R)), E: round(E), R: round(R), n: { support: ns, contradict: nc }, params: params.version };
}
