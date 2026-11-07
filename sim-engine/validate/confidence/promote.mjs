// THE PROMOTION GATE: "automatically update its modelling framework" meets the one property that makes
// these numbers worth showing anybody.
//
// ============================== THE TENSION, STATED PLAINLY ==============================
// The request behind this file is a loop: feed in lab results, let the system tune its own parameters,
// goals and settings until the results are reproducible. That is the right ambition and it is in direct
// conflict with the discipline that makes the existing numbers trustworthy - score-weights.json carries a
// never-edit-in-place rule and a pre-registration SHA-256, and the evaluation deliberately keeps failed
// runs. A loop that adjusts weights in place after seeing a result destroys exactly that.
//
// The resolution is not to refuse the loop. It is to make every iteration a VERSION:
//
//   propose  ->  freeze (weights + pre-registration, both hashed)  ->  re-run the blind evaluation
//            ->  promote ONLY IF it passes its own pre-registered endpoints
//
// This file is the last arrow. It reads the frozen evaluation artefacts and answers one question per
// version: may this be promoted to default? It writes nothing and it changes nothing.
//
// ============================== WHAT IT FINDS TODAY ==============================
// The version currently shipped as DEFAULT_VERSION would NOT pass this gate. That is not a complaint
// about the scorer thread, which documented the situation itself in SCORER-VERSION.md; it is the gate
// working on its first run, which is the only way to know it works at all.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VALIDATE = path.resolve(HERE, '..');

export const WHAT_THIS_IS =
  'A promotion gate for a self-updating scorer. One question per version: were its weights frozen with a ' +
  'hash, was a blind evaluation run against them, and did it pass its OWN pre-registered endpoints? ' +
  'Read-only.';

export const THE_PROTOCOL = Object.freeze([
  { step: 'propose', what: 'a new weight set or a new component, in a NEW file. Never an edit to a released one.' },
  { step: 'freeze', what: 'record the SHA-256 of the weights and of the pre-registration before any evaluation runs. A pre-registration written after a result is a result.' },
  { step: 'evaluate blind', what: 're-run the held-out family-out evaluation, built and run by an agent that did not build the scorer.' },
  { step: 'promote', what: 'only if the primary pre-registered endpoints pass. A version that fails its own endpoints may be RELEASED for inspection but must not become the default.' },
  { step: 'keep the failures', what: 'a failed run stays in results/. The history of what did not work is the only evidence that the passing version was not the twentieth attempt.' },
]);

export const WHY_NOT_JUST_TUNE =
  'Tuning against a held-out set, however carefully, turns it into a training set at a rate of roughly ' +
  'one bit per decision. The repository already protects against that with hashed pre-registrations and ' +
  'an evaluator built by a different agent. An automatic loop that re-fits after each lab result would ' +
  'spend that protection in a few iterations, and nothing in the output would look different. So the ' +
  'loop must COUNT its iterations and publish the count: a score promoted on the first blind evaluation ' +
  'and one promoted on the fortieth are not the same claim, even at the same AUC.';

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

/** Every evaluation run on disk, newest first, with the version it scored. */
export function evaluationRuns() {
  const dir = path.join(VALIDATE, 'evaluation/results');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== 'latest.json')
    .map(f => {
      const j = readJson(path.join(dir, f));
      return {
        file: f,
        version: j?.versions?.score_weights?.version ?? j?.versions?.label ?? null,
        weights_sha256: j?.versions?.score_weights?.sha256 ?? null,
        prereg_sha256: j?.versions?.benchmark?.prereg_sha256 ?? null,
        prereg_declared: j?.versions?.benchmark?.prereg_sha256_declared ?? null,
        overall_primary_pass: j?.overall_primary_pass ?? null,
        criteria: (j?.criteria ?? []).map(c => ({ id: c.id, primary: c.primary === true, pass: c.pass === true, text: c.text ?? null, value: c.value ?? null })),
        reanalysed: Boolean(j?.versions?.reanalysed),
      };
    })
    .filter(r => r.version)
    .sort((a, b) => b.file.localeCompare(a.file));
}

/** May this version be the default? */
/** The run that counts for a version: the newest, preferring the REANALYSED file where one exists.
 *  Without this, endpoints are counted once per file - and because every run is stored twice (raw and
 *  reanalysed) the first version of this gate reported "0/6 primary endpoints pass, failing P1, P2, P3,
 *  P1, P2, P3", double-counting every endpoint and hiding that P2 actually passes. */
export function authoritativeRun(version, runs) {
  const mine = runs.filter(r => r.version === version);
  if (!mine.length) return null;
  // Prefer the MAIN run for the version over a split variant. The results directory also holds files
  // like `_w1.2.0-specimen.json`, which score the same weights on a different split; picking one of
  // those because its timestamp happens to be later would report a variant's endpoints as the version's.
  const main = mine.filter(r => new RegExp(`_w${version.replace(/\./g, '\\.')}(_reanalysed)?\\.json$`).test(r.file));
  const pool = main.length ? main : mine;
  const stem = f => f.replace(/_reanalysed\.json$/, '').replace(/\.json$/, '');
  const newestStem = pool.map(r => stem(r.file)).sort().at(-1);
  const sameRun = pool.filter(r => stem(r.file) === newestStem);
  return sameRun.find(r => r.reanalysed || /_reanalysed\.json$/.test(r.file)) ?? sameRun[0];
}

export function promotable(version, { runs = null } = {}) {
  const all = runs ?? evaluationRuns();
  const authoritative = authoritativeRun(version, all);
  const mine = authoritative ? [authoritative] : [];
  const everyRun = all.filter(r => r.version === version);
  const checks = [];

  checks.push({
    id: 'weights-frozen-with-a-hash',
    pass: mine.some(r => typeof r.weights_sha256 === 'string' && r.weights_sha256.length === 64),
    detail: mine[0]?.weights_sha256 ? `sha256 ${mine[0].weights_sha256.slice(0, 12)}...` : 'no weights hash recorded in any evaluation run',
    why: 'without a hash there is no way to know the evaluated weights are the shipped weights.',
  });
  checks.push({
    id: 'preregistration-hash-matches-what-was-declared',
    pass: mine.some(r => r.prereg_sha256 && r.prereg_declared && r.prereg_sha256 === r.prereg_declared),
    detail: mine[0] ? `recorded ${String(mine[0].prereg_sha256).slice(0, 12)}... declared ${String(mine[0].prereg_declared).slice(0, 12)}...` : 'no run',
    why: 'a pre-registration that changed between declaration and evaluation is not a pre-registration.',
  });
  checks.push({
    id: 'a-blind-evaluation-was-run',
    pass: mine.length > 0,
    detail: `${everyRun.length} evaluation file(s) on disk for version ${version}; the authoritative one is ${authoritative?.file ?? 'none'}`,
    why: 'a version with no evaluation has no evidence, whatever its design.',
  });
  const primary = mine.flatMap(r => r.criteria.filter(c => c.primary));
  const failedPrimary = primary.filter(c => !c.pass);
  checks.push({
    id: 'passes-its-own-primary-endpoints',
    pass: primary.length > 0 && failedPrimary.length === 0,
    detail: primary.length
      ? `${primary.length - failedPrimary.length}/${primary.length} primary endpoints pass${failedPrimary.length ? `; failing: ${failedPrimary.map(c => c.id).join(', ')}` : ''}`
      : 'no primary endpoints recorded',
    why: 'this is the whole gate. A version that fails the endpoints it declared in advance may be released for inspection; it must not become the number a partner reads.',
  });

  const failed = checks.filter(c => !c.pass);
  return {
    version,
    promotable: failed.length === 0,
    checks,
    blocked_by: failed.map(c => c.id),
    authoritative_run: authoritative?.file ?? null,
    all_runs_on_disk: everyRun.map(r => r.file),
    what_a_failure_means:
      failed.length === 0
        ? null
        : 'not that the version is bad. It means the version has not earned the right to be the default, ' +
          'and the honest action is to keep shipping the previous default (or none) while saying which ' +
          'endpoint failed. Shipping it anyway and mentioning the failure in a document is the same as ' +
          'not having a gate.',
  };
}

/** The gate applied to everything released, plus what is actually shipped. */
export function audit() {
  const runs = evaluationRuns();
  const versions = [...new Set(runs.map(r => r.version))].sort();
  const report = versions.map(v => promotable(v, { runs }));
  const weightsFiles = fs.existsSync(VALIDATE)
    ? fs.readdirSync(VALIDATE).filter(f => /^score-weights(\.v[\d.]+)?\.json$/.test(f))
    : [];
  // the shipped default, read without importing score.mjs (which would pull in the whole scorer)
  let shipped = null;
  const scoreSrc = path.join(VALIDATE, 'score.mjs');
  if (fs.existsSync(scoreSrc)) {
    const m = /DEFAULT_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(fs.readFileSync(scoreSrc, 'utf8'));
    shipped = m ? m[1] : null;
  }
  const shippedReport = shipped ? report.find(r => r.version === shipped) ?? promotable(shipped, { runs }) : null;
  return {
    what_this_is: WHAT_THIS_IS,
    protocol: THE_PROTOCOL,
    why_not_just_tune: WHY_NOT_JUST_TUNE,
    weights_files_on_disk: weightsFiles,
    versions_evaluated: versions,
    per_version: report,
    shipped_default: shipped,
    shipped_default_promotable: shippedReport?.promotable ?? null,
    the_finding: shippedReport && shippedReport.promotable === false
      ? `the shipped default (${shipped}) would NOT pass this gate: blocked by ${shippedReport.blocked_by.join(', ')}. ` +
        'That is the gate working on its first run. A gate that passes everything on the day it is ' +
        'written is not evidence of anything.'
      : null,
    any_promotable: report.filter(r => r.promotable).map(r => r.version),
    note_on_rank_score:
      'the evaluation records that one output of the newest version - its separate rank_score - does pass ' +
      'the primary endpoints, while the composite `score` does not. This gate is about a VERSION, so it ' +
      'reports the version as not promotable. Promoting one output of a version and not another is a ' +
      'legitimate move and it needs its own pre-registration, naming which output is the default.',
  };
}
