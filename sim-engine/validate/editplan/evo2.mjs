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

// The shared nimHealth() probe folds an 8-residue peptide on the ESMFold NIM, and that path now 404s.
// A 404 on a DIFFERENT model is not evidence about Evo2, and letting it gate this block would report
// "Evo2 unavailable" while Evo2 is answering. So the status probe calls the Evo2 endpoint this module
// actually uses, with the smallest legal request (one generated token, no logits).
export async function status({ fresh = false } = {}) {
  const ks = keyShape();
  if (!ks.present) return { ...NOT_SET(), key: ks };
  const endpoint = `${ENDPOINT_BASE}${NIM.endpoints.evo2}`;
  let http = null, error = null;
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sequence: 'ACGTACGTACGTACGT', num_tokens: 1 }),
    });
    http = r.status;
  } catch (e) { error = e.message; }
  const ok = http === 200 || http === 202;
  return { ran: ok, model: MODEL, endpoint, probe: 'POST evo2 generate (16 bp, 1 token)',
    provider_status: ok ? 'ok' : error ? 'unreachable' : 'error', http, key: ks,
    ...(ok ? {} : { reason: error ? `the Evo2 endpoint was unreachable: ${error}` : `the Evo2 endpoint returned HTTP ${http}`, key_note: KEY_NOTE }) };
}

// ---------------------------------------------------------------- the one network call
//
// HOW THE LIKELIHOOD IS OBTAINED, now that a working nvapi- key exists (2026-11-01).
//
// There is NO scoring route on this NIM. Probed against the live key from this box:
//   POST /biology/arc/evo2-40b/score        -> 404
//   POST /biology/arc/evo2-40b/logits       -> 404
//   POST /biology/arc/evo2-40b/embeddings   -> 404
//   POST /biology/arc/evo2-40b/forward      -> 200, but returns LAYER ACTIVATIONS (a base64 .npy of
//                                              blocks.28.mlp.l3), not logits. `output_layers: ["logits"]`
//                                              is rejected: "StripedHyena has no attribute `logits`".
//   POST /biology/arc/evo2-40b/generate     -> 200, and with enable_logits returns the next-token logit
//                                              vector (512-wide, byte vocabulary indexed by ASCII code).
//
// So the mean per-base log-likelihood here is computed by TEACHER FORCING through the generate route: for
// each position i, the prefix seq[0..i) is sent, the returned next-token logits are log-softmaxed, and the
// log-probability of the TRUE base seq[i] is read off. That is the textbook definition of the quantity, not
// an approximation of it - but it costs one HTTP call per base, which is why windows are short.
//
// Position 0 has no prefix and is not scored; the mean is over the L-1 scored positions, and `scored_bp`
// says so in every result. The vocabulary mapping was verified against the live endpoint rather than
// assumed: ACGT sit at their ASCII indices 65/67/71/84 and dominate the distribution on genomic input.

const EVO2_GEN_URL = `${NIM.base}${NIM.endpoints.evo2}`;
const CONCURRENCY = Number(process.env.EDITPLAN_EVO2_CONCURRENCY ?? 4);

/** One next-token logit vector for a prefix. Returns null on any non-200 or unparseable body. */
async function nextTokenLogits(prefix, timeoutMs) {
  const k = process.env.NVIDIA_API_KEY;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(EVO2_GEN_URL, {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${k}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sequence: prefix, num_tokens: 1, enable_logits: true }),
    });
    if (!r.ok) return { ok: false, http: r.status };
    const j = await r.json();
    const lg = Array.isArray(j?.logits) ? j.logits[0] : null;
    if (!Array.isArray(lg) || !lg.length) return { ok: false, http: r.status, reason: 'no logits in a 200 response' };
    return { ok: true, logits: lg };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timed out' : e.message };
  } finally { clearTimeout(t); }
}

function logSoftmaxAt(logits, ch) {
  const i = ch.charCodeAt(0);
  if (i >= logits.length) return null;
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  let sum = 0;
  for (const v of logits) sum += Math.exp(v - max);
  return (logits[i] - max) - Math.log(sum);
}

/**
 * Mean per-base log-likelihood of one sequence under Evo2, by teacher forcing (see the note above).
 *
 * Still parses defensively: if any position fails to come back readable, this returns {ran: false} with the
 * count of failures rather than a mean over whatever happened to succeed. A partial pass is not a score.
 */
export async function scoreSequence(sequence, { timeoutMs = 120000 } = {}) {
  const ks = keyShape();
  if (!ks.present) return NOT_SET();
  if (!/^[ACGTacgt]+$/.test(sequence)) return { ran: false, reason: 'sequence must be A/C/G/T only (no N, no gaps)', length: sequence.length };
  const seq = sequence.toUpperCase();
  const L = seq.length;
  if (L < 2) return { ran: false, reason: 'need at least 2 bases: position 0 has no prefix and is not scored' };

  const lp = new Array(L).fill(null);
  const failures = [];
  let next = 1;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= L) return;
      // Transient failures on this endpoint are NOT a property of the sequence. The dominant one,
      // confirmed against the live key, is HTTP 429: the NIM rate-limits well below the concurrency a
      // per-base pass wants. So a 429 backs off hard and exponentially rather than counting as a
      // failure, and anything else gets a short retry.
      let got = null;
      for (let attempt = 0; attempt < 7; attempt++) {
        got = await nextTokenLogits(seq.slice(0, i), timeoutMs);
        if (got.ok) break;
        const rateLimited = got.http === 429;
        const wait = rateLimited ? Math.min(16000, 800 * 2 ** attempt) + Math.random() * 400 : 400 * (attempt + 1);
        if (!rateLimited && attempt >= 2) break;
        await new Promise(r => setTimeout(r, wait));
      }
      if (!got.ok) { failures.push({ position: i, ...got }); continue; }
      const v = logSoftmaxAt(got.logits, seq[i]);
      if (v == null || !Number.isFinite(v)) { failures.push({ position: i, reason: `base ${seq[i]} outside the returned vocabulary` }); continue; }
      lp[i] = v;
    }
  };
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, L - 1) }, worker));
  const elapsed_ms = Date.now() - t0;

  if (failures.length) return {
    ran: false,
    reason: `${failures.length} of ${L - 1} scored positions did not come back readable, so no mean is reported`,
    model: MODEL, length_bp: L, failures: failures.slice(0, 5), n_failures: failures.length,
    note: 'a mean over only the positions that happened to succeed would be a different quantity wearing this one\'s name.',
  };

  const vals = lp.slice(1);
  const total = vals.reduce((a, b) => a + b, 0);
  return {
    ran: true, model: MODEL, length_bp: L, scored_bp: vals.length,
    mean_log_likelihood_per_base: +(total / vals.length).toFixed(6),
    total_log_likelihood: +total.toFixed(4),
    source_field: 'teacher-forced next-token logits from the generate route (no scoring route exists)',
    calls: vals.length, elapsed_ms,
    NOT: WHAT_IT_IS_NOT,
  };
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
