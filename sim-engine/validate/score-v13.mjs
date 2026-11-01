// Scorer v1.3.0 = v1.2.0 plus ONE new term: a joint (correlation-aware) plausibility term for the body-shape trait
// vector. Everything else — weights, floor, alpha, the 0.5 cut, the evidence map, the per-trait envelopes, the
// definitional and organ rules, the Lean gate, the coverage factor, rank_score — is v1.2.0 unchanged, reached
// through the injection points in score-v12.mjs so that v1.2.0's own behaviour is untouched and still frozen.
//
// THE FINDING THAT MOTIVATES IT. The benchmark's standard decoys take each trait from a different family. Every
// marginal therefore stays exactly where real fish are, and only the CORRELATIONS between traits break. No
// collection of per-trait envelopes can see that, however well tuned: v1.2.0 scored AUC 0.498 against FishBase
// decoys, i.e. a coin flip. Detecting shuffled synthetic organisms REQUIRES a joint model. See joint.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { designScoreV12 } from './score-v12.mjs';
import { jointTerm } from './joint.mjs';

const DIR = import.meta.dirname;
const W = JSON.parse(fs.readFileSync(path.join(DIR, 'score-weights.v1.3.0.json'), 'utf8'));
export const SCORER_V13 = Object.freeze({ ...W, weights_file: 'sim-engine/validate/score-weights.v1.3.0.json',
  joint_model_file: 'sim-engine/validate/data/joint-model.v1.3.0.json', joint_calibration_file: 'sim-engine/validate/data/joint-calibration.v1.3.0.json' });

/** v1.3.0. Same signature as designScore: (design, opts) with reference_set_excluding, lean_spec, lawset, ... */
export async function designScoreV13(design, opts = {}) {
  // The joint fit holds out every family the caller excludes, so a real fish is never scored by a model that saw
  // its own family. genus:/species:/order: entries do not remove a family from the fit; that is reported.
  const excl = [...(opts.reference_set_excluding || []), ...(opts.exclude || [])];
  const famOut = excl.filter(e => /^family:/i.test(String(e))).map(e => String(e).slice(7));
  const nonFamily = excl.filter(e => !/^family:/i.test(String(e)));
  let joint = null;
  const r = await designScoreV12(design, {
    ...opts,
    _weights: W,
    _scorer: SCORER_V13,
    _extraPartsFn: (params) => {
      joint = jointTerm(params, { excludeFamilies: famOut });
      if (!joint.ran || joint.p_value == null) return [];
      // A calibrated p-value, so it takes the same alpha transform as the other calibrated terms in P.
      return [{ part: `p_joint (${joint.block}, d=${joint.d})`, p: joint.p_value, value: Math.min(1, joint.p_value / W.alpha) }];
    },
  });
  return { ...r, joint: joint ? { ...joint, families_held_out_of_fit: famOut, exclusions_not_applied_to_the_fit: nonFamily } : { ran: false, reason: 'the joint term did not run' }, scorer: SCORER_V13 };
}
