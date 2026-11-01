// Evo2 (NVIDIA NIM / BioNeMo) as a RANKER over edit plans that already exist.
//
// Amit's ask was "Evo2 via BioNeMo2 could be used to guide cassette design intelligently". This module is
// the honest version of that. Evo2 is a genomic language model: given DNA it returns a likelihood. That
// buys three legitimate things and no others.
//
// WHAT A LIKELIHOOD BUYS HERE
//   1. edited_vs_reference  Score the edited locus against the reference locus. A large drop flags an edit
//      the model finds unlikely FOR THIS GENOME - usually because the edit broke a motif the model has
//      learned, which is a reason to look again at the sequence, not a verdict.
//   2. silent_blocking_choice  Our blocking mutations and codon choices are currently picked by a hand rule
//      ("fewest nucleotide changes, ties to the commoner codon"). Evo2 can RANK the synonymous options by
//      likelihood instead, which is a better-motivated tie-break than codon frequency alone.
//   3. insert_outlier  Score the sequence a pegRNA or ssODN would install, in its genomic context, against
//      the reference. An insert whose likelihood is far below the locus's own is an outlier worth a look.
//
// ============================== WHAT A LIKELIHOOD IS NOT ==============================
//   * NOT a prediction that the edit produces the phenotype. This is the central point. Our own design
//     validation FAILED (design-validation/REPORT.md: NOT CLOSE / largely UNSHOWN, Lean gate FAILS), and no
//     model score may be presented as repairing that. A likelihood over DNA says the sequence looks like
//     the genome it was trained on. Fin length is not in that statement anywhere.
//   * NOT evidence of safety. A likely-looking edit can be lethal.
//   * NOT evidence of specificity. Evo2 scores the sequence you hand it. It does not search the genome,
//     it knows nothing about off-targets, and it cannot substitute for the off-target search. Specificity
//     comes from grcz11-local.mjs, and really from GUIDE-seq in the actual fish.
//   * NOT a cutting- or knock-in-efficiency prediction. It is not an on-target score. It is not
//     comparable with the Doench numbers and is never combined with them into one figure.
//   * NOT calibrated. A delta in log-likelihood has no units a wet lab can act on. There is no threshold
//     here, and this module deliberately does not invent one. It reports the numbers and their ORDER.
//
// HOW IT DEGRADES. The model RANKS; it never GATES. With no key every Evo2-derived field is
// {ran: false, reason: 'NVIDIA_API_KEY not set'} and the plan is complete without it: coordinates, guides,
// donors, pegRNAs, the base-editor route and the off-target table are all computed with no model involved.
// Nothing is withheld and no ranking changes.
//
// CREDENTIALS. The key is read from process.env.NVIDIA_API_KEY at call time and nowhere else. It is never
// written to a file, never cached, never logged, never echoed into output, and never put in a URL. Only the
// key's PREFIX SHAPE is reported, because that is the one diagnostic that matters here (see below).
//
// THE KEY WE WERE GIVEN DOES NOT WORK, and this is a credential-shape problem, not a code problem: it is a
// Brev-style key beginning "bak-", and NVIDIA NIM rejects it with HTTP 401. NIM keys begin "nvapi-" and
// come from build.nvidia.com. A working nvapi- key is the single thing that would turn every
// {ran: false} in this module into a number; nothing else is missing.

import { NIM, nimCall, nimHealth } from '../../generative/backends/providers.mjs';

export const MODEL = 'evo2-40b';
export const ENDPOINT_BASE = NIM.base;
export const WHAT_IT_IS =
  'Evo2 (Arc Institute), served as an NVIDIA NIM / BioNeMo endpoint at health.api.nvidia.com. A genomic ' +
  'language model trained on genomes across the tree of life. Used here only to score sequence likelihood.';
export const WHAT_IT_IS_NOT =
  'NOT a phenotype prediction: a likelihood says the sequence looks like the genomes the model was trained on, ' +
  'and says nothing about whether the edited fish has the trait. NOT evidence of safety. NOT evidence of ' +
  'specificity: it does not search the genome and knows nothing about off-targets. NOT a cutting or knock-in ' +
  'efficiency, and never combined with the Doench scores into one number. NOT calibrated: a log-likelihood ' +
  'delta has no units, and no threshold is asserted here. It RANKS; it does not GATE.';
export const DEGRADATION =
  'Every Evo2-derived field is {ran: false, reason: "NVIDIA_API_KEY not set"} without a key, and the editing plan ' +
  'is complete without any of them. The model never gates a plan and never changes a ranking that the plan ' +
  'computes for itself; it adds a separate, clearly-labelled ordering beside it.';
export const KEY_NOTE =
  'The key is read from the environment variable NVIDIA_API_KEY at call time only. It is never written to any file, ' +
  'logged, cached or echoed. NIM keys start "nvapi-" (build.nvidia.com). The key supplied to this project is a ' +
  'Brev-style key starting "bak-", which NIM rejects with HTTP 401 - a Brev key authenticates Brev GPU instances, ' +
  'not NIM inference endpoints. A working nvapi- key is the only missing piece.';

const NOT_SET = () => ({ ran: false, reason: 'NVIDIA_API_KEY not set', model: MODEL, what_this_would_add: WHAT_IT_IS, degradation: DEGRADATION, key_note: KEY_NOTE });

/** Key shape only - never the key. */
export function keyShape() {
  const k = process.env.NVIDIA_API_KEY;
  if (!k || !k.trim()) return { present: false, note: KEY_NOTE };
  const t = k.trim();
  return { present: true,
    prefix: t.startsWith('nvapi-') ? 'nvapi-' : t.startsWith('bak-') ? 'bak-' : 'unrecognised',
    usable_for_nim: t.startsWith('nvapi-'),
    note: t.startsWith('nvapi-') ? 'NIM key format' : t.startsWith('bak-')
      ? 'a Brev key, which NIM rejects with HTTP 401. NIM needs an nvapi- key from build.nvidia.com.'
      : 'prefix is neither nvapi- nor bak-; NIM expects nvapi-',
    length_only: t.length };
}

export async function status({ fresh = false } = {}) {
  const ks = keyShape();
  if (!ks.present) return { ...NOT_SET(), key: ks };
  const h = await nimHealth({ fresh });
  return { ran: h.status === 'ok', model: MODEL, endpoint: `${ENDPOINT_BASE}${NIM.endpoints.evo2}`,
    provider_status: h.status, http: h.http ?? null, key: ks,
    ...(h.status === 'ok' ? {} : { reason: `NVIDIA NIM reports "${h.status}"${h.http ? ` (HTTP ${h.http})` : ''}`, key_note: KEY_NOTE }) };
}

// ---------------------------------------------------------------- the one network call
/**
 * Mean per-base log-likelihood of one sequence under Evo2.
 *
 * NOTE ON THE ENDPOINT. build.nvidia.com documents the Evo2 NIM's `generate` route, which returns
 * generated continuation and, when asked, per-token logits. The scoring route's exact field names were NOT
 * exercised against a live key from this box, because the only key available is a Brev "bak-" key that NIM
 * rejects. So this function PARSES DEFENSIVELY over the plausible response shapes and, if it cannot find a
 * likelihood field, returns {ran: false, reason: 'the response carried no recognisable likelihood field',
 * response_keys: [...]} with the key names it did see - rather than inventing a number. That is the whole
 * point: an unparseable response must look like a failure, not like a score.
 */
export async function scoreSequence(sequence, { timeoutMs = 300000 } = {}) {
  const ks = keyShape();
  if (!ks.present) return NOT_SET();
  if (!/^[ACGTacgt]+$/.test(sequence)) return { ran: false, reason: 'sequence must be A/C/G/T only (no N, no gaps)', length: sequence.length };
  let raw;
  try {
    raw = await nimCall('evo2', { sequence: sequence.toUpperCase(), num_tokens: 0, output_scores: true, enable_logits: true }, { maxWaitMs: timeoutMs });
  } catch (e) {
    return { ran: false, reason: `the Evo2 NIM call failed: ${e.message}`, model: MODEL, key: ks, key_note: ks.usable_for_nim ? undefined : KEY_NOTE };
  }
  const ll = pickLogLikelihood(raw);
  if (ll == null) return { ran: false, reason: 'the Evo2 response carried no recognisable likelihood field, so no number is reported', model: MODEL,
    response_keys: Object.keys(raw || {}), note: 'parsed defensively on purpose: a response we cannot read must look like a failure, not like a score.' };
  return { ran: true, model: MODEL, length_bp: sequence.length, mean_log_likelihood_per_base: +ll.mean.toFixed(6),
    total_log_likelihood: ll.total == null ? null : +ll.total.toFixed(4), source_field: ll.field,
    NOT: WHAT_IT_IS_NOT };
}

function pickLogLikelihood(r) {
  if (!r || typeof r !== 'object') return null;
  const cand = [['logits', r.logits], ['scores', r.scores], ['log_probs', r.log_probs], ['logprobs', r.logprobs],
    ['token_scores', r.token_scores], ['data.logits', r.data?.logits], ['data.scores', r.data?.scores]];
  for (const [field, v] of cand) {
    if (typeof v === 'number') return { mean: v, total: null, field };
    if (Array.isArray(v) && v.length && v.every(x => typeof x === 'number')) {
      const total = v.reduce((a, b) => a + b, 0);
      return { mean: total / v.length, total, field };
    }
  }
  for (const f of ['mean_log_likelihood', 'log_likelihood', 'loglikelihood', 'perplexity_log']) if (typeof r[f] === 'number') return { mean: r[f], total: null, field: f };
  return null;
}

// ---------------------------------------------------------------- the three legitimate uses
const CONTEXT_BP = Number(process.env.EDITPLAN_EVO2_CONTEXT_BP ?? 1000);

/** Shared "no key" shell so every Evo2 field in a plan looks the same when the model is absent. */
function offline(use, extra = {}) { return { use, ...NOT_SET(), ...extra }; }

/**
 * (i) Is the EDITED locus implausible for this genome, relative to the reference locus?
 * Scores reference and edited windows of the same length and reports the delta and its sign.
 */
export async function editedVsReference({ referenceWindow, editedWindow, label } = {}) {
  const use = 'edited locus vs reference locus';
  const interpretation =
    'A NEGATIVE delta means Evo2 finds the edited locus less likely than the reference, which is expected for ' +
    'almost any edit (the reference IS the genome the model learned). The number is only useful COMPARATIVELY: ' +
    'between two candidate edits at the same locus, or between a blocking-mutation set and its alternatives. ' +
    'There is no threshold here and none is implied. A large drop is a reason to re-read the sequence, never a ' +
    'verdict, and a small drop is NOT evidence that the edit works.';
  if (!keyShape().present) return offline(use, { label, interpretation });
  if (!referenceWindow || !editedWindow) return { use, ran: false, reason: 'need both referenceWindow and editedWindow' };
  const [ref, ed] = await Promise.all([scoreSequence(referenceWindow), scoreSequence(editedWindow)]);
  if (!ref.ran || !ed.ran) return { use, ran: false, reason: ref.ran ? ed.reason : ref.reason, label };
  return { use, ran: true, label, model: MODEL, window_bp: referenceWindow.length,
    reference_mean_log_likelihood_per_base: ref.mean_log_likelihood_per_base,
    edited_mean_log_likelihood_per_base: ed.mean_log_likelihood_per_base,
    delta_per_base: +(ed.mean_log_likelihood_per_base - ref.mean_log_likelihood_per_base).toFixed(6),
    direction: ed.mean_log_likelihood_per_base < ref.mean_log_likelihood_per_base ? 'the edit LOWERS the likelihood' : 'the edit RAISES the likelihood',
    interpretation, NOT: WHAT_IT_IS_NOT };
}

/**
 * (ii) Rank synonymous options (desired codons, and silent blocking-mutation sets) by likelihood rather
 * than by our hand rule. `options` is [{id, label, editedWindow, our_rule_rank}].
 */
export async function rankSynonymousOptions(options = [], { what = 'synonymous options' } = {}) {
  const use = `rank ${what} by Evo2 likelihood instead of by our hand rule`;
  const our_rule = 'edit_plan currently picks the desired codon by "fewest nucleotide changes, ties broken by the commoner zebrafish codon", and picks blocking mutations by "silent, and protein re-translated to confirm". Both are OUR rules. This ranking is an alternative ORDER over the same already-valid options; it never introduces an option our rules rejected, and it never removes one they accepted.';
  if (!keyShape().present) return offline(use, { n_options: options.length, our_rule, options: options.map(o => ({ id: o.id, label: o.label, our_rule_rank: o.our_rule_rank ?? null, evo2: { ran: false, reason: 'NVIDIA_API_KEY not set' } })) });
  if (!options.length) return { use, ran: false, reason: 'no options to rank' };
  const scored = [];
  for (const o of options) {
    const s = await scoreSequence(o.editedWindow);
    scored.push({ id: o.id, label: o.label, our_rule_rank: o.our_rule_rank ?? null,
      mean_log_likelihood_per_base: s.ran ? s.mean_log_likelihood_per_base : null, evo2_ran: s.ran, reason: s.reason });
  }
  const ok = scored.filter(s => s.evo2_ran).sort((a, b) => b.mean_log_likelihood_per_base - a.mean_log_likelihood_per_base);
  ok.forEach((s, i) => { s.evo2_rank = i + 1; });
  return { use, ran: ok.length > 0, model: MODEL, our_rule, n_scored: ok.length, options: scored,
    evo2_preferred: ok[0] ? { id: ok[0].id, label: ok[0].label } : null,
    agrees_with_our_rule: ok[0] && ok[0].our_rule_rank === 1,
    disagreement_note: ok[0] && ok[0].our_rule_rank !== 1
      ? 'Evo2 prefers a different option from our hand rule. NEITHER is evidence. The disagreement is the useful output: it marks a choice worth making deliberately rather than by default.'
      : null,
    NOT: WHAT_IT_IS_NOT };
}

/**
 * (iii) Is the sequence a pegRNA or ssODN would INSTALL an outlier in its own genomic context?
 */
export async function insertOutlier({ referenceWindow, insertedWindow, insert, label } = {}) {
  const use = 'is the installed sequence an outlier in its genomic context';
  const interpretation =
    'Compares the locus carrying the installed sequence against the untouched locus. A large drop means the ' +
    'installed sequence sits oddly in this genome - most often because a blocking mutation disrupted a motif. ' +
    'It is a flag to re-read the donor, not a rejection, and a SMALL drop is not evidence the donor works.';
  if (!keyShape().present) return offline(use, { label, insert, interpretation });
  const r = await editedVsReference({ referenceWindow, editedWindow: insertedWindow, label });
  return { ...r, use, insert, interpretation };
}

export const METHODS = {
  model: MODEL, what_it_is: WHAT_IT_IS, what_it_is_not: WHAT_IT_IS_NOT,
  endpoint: `${ENDPOINT_BASE}${NIM.endpoints.evo2}`,
  legitimate_uses: ['edited locus vs reference locus', 'ranking silent blocking mutations and codon choices by likelihood instead of by our hand rule', 'flagging a pegRNA/ssODN insert whose sequence is an outlier in context'],
  illegitimate_uses_refused_here: [
    'presenting a likelihood as a prediction that the edit produces the phenotype (our design validation FAILED and no model score repairs that)',
    'presenting a likelihood as evidence of safety or of specificity',
    'letting a model score gate, veto or filter a plan',
    'combining a likelihood with the Doench on-target scores into a single figure',
    'inventing a threshold for "implausible"',
  ],
  degradation: DEGRADATION, credentials: KEY_NOTE,
  context_window_bp: CONTEXT_BP,
};

export { CONTEXT_BP };
