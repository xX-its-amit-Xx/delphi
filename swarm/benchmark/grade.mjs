#!/usr/bin/env node
// Grades the benchmark artifacts against the metrics pre-registered in swarm/benchmark/ARMS.md.
// Every grader here calls the REPOSITORY'S OWN checks, never a checker written for the experiment:
//   level 1  holdout/nanopubs/check.mjs (which runs the nanopub jar) and holdout/check-leaks.mjs
//   level 2  `lake env lean` in lean/, ONE PROCESS AT A TIME
//   level 3  sim-engine lean_check at lawset 1.8.1
//   level 4  the verbatim validate_generation fixture
//
//   node swarm/benchmark/grade.mjs [--level nanopub|leanbio|design|validation] [--selftest]
//
// --selftest deliberately corrupts one artifact per level and asserts the grader's verdict changes, so each
// check is seen to fail once before it is trusted (ARMS.md 2).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { LEVELS, FIVE_RESULTS } from './levels.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ARMS = ['single', 'decentralised', 'centralised'];
const NP_JAR = process.env.NANOPUB_JAR || 'C:/tb/tmp/np/nanopub-1.95.0-jar-with-dependencies.jar';
const ELAN = process.env.ELAN_HOME || 'C:\\Temp\\elan';
const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
const clamp01 = x => Math.max(0, Math.min(1, x));
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// =============================================================== level 1: nanopub
function graphOf(trig, name) {
  const i = trig.indexOf(`sub:${name} {`);
  if (i < 0) return '';
  let d = 0, j = trig.indexOf('{', i);
  for (let k = j; k < trig.length; k++) { if (trig[k] === '{') d++; else if (trig[k] === '}') { d--; if (!d) return trig.slice(j + 1, k); } }
  return trig.slice(j + 1);
}
const literals = g => [...g.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
function fieldOf(trig, subjectHint, pred) {
  // the first `pred "value"` occurring after subjectHint in the file
  const i = subjectHint ? trig.indexOf(subjectHint) : 0;
  if (i < 0) return null;
  const m = new RegExp(pred.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+"((?:[^"\\\\]|\\\\.)*)"').exec(trig.slice(i));
  return m ? m[1] : null;
}

function gradeNanopubOne(art, task, outDir) {
  const t = task.meta;
  const trig = String(art?.trig || '');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${t.id}.trig`);
  fs.writeFileSync(file, trig);

  // parses: the repository's own structural reader over the nanopub validator.
  // check.mjs exits 1 on any issue outside ITS allowance, which includes "creation time is older than one
  // hour" -- a freshness note, not a validity problem, and the one that made this grader's own selftest on an
  // intact repository record fail before any level-1 call was made (recorded in RESULTS.md). So the grader
  // reads check.mjs's line and allows that note too; everything else it reports still fails `parses`.
  const chk = sh('node', [path.join(repo, 'holdout/nanopubs/check.mjs'), '--jar', NP_JAR, file], { cwd: repo });
  const line = (chk.stdout || '') + (chk.stderr || '');
  const verdictValid = /(^|\s)(OK|FAIL)\s+\S+:\s*valid/.test(line);
  const issues = (/issues:\s*(.*)$/m.exec(line)?.[1] || '').split('|').map(norm).filter(Boolean);
  const FRESH = /creation time is older than one hour/i;
  const NP_ALLOWED = [/^Unexpected graph uri: http:\/\/purl\.org\/nanopub\/temp\//, /^Nanopub has no signature element\.$/, /^Nanopub has no assertion template\.$/, FRESH];
  const unexpectedIssues = issues.filter(i => !NP_ALLOWED.some(re => re.test(i)));
  const parses = chk.status === 0 || (verdictValid && unexpectedIssues.length === 0) ? 1 : 0;

  // leak_clean: the repository's own leak checker, over this artifact's directory
  const leak = sh('node', [path.join(repo, 'holdout/check-leaks.mjs'), '--json', outDir], { cwd: repo });
  let leakHits = null;
  try { const j = JSON.parse(leak.stdout); leakHits = (j.hits || j.leaks || []).filter(h => h.signal !== 'weak'); } catch { leakHits = null; }
  const leak_clean = leak.status === 0 ? 1 : 0;

  // locator_traceability
  const locs = t.facts.map(f => f.locator);
  const hit = l => trig.includes(l) || trig.includes(l.split(/[:#]/)[0]);
  const locator_traceability = mean(locs.map(l => (hit(l) ? 1 : 0)));

  const assertion = graphOf(trig, 'assertion');
  // untraceable_assertions: long literals in a subject block holding no locator at all
  const blocks = assertion.split(/\.\s*(?=<|sub:)/);
  const untraceable_assertions = blocks.filter(b => literals(b).some(x => x.length > 40) && !locs.some(l => b.includes(l) || b.includes(l.split(/[:#]/)[0]))).length;

  // unsupported_numeric_claims: numbers inside assertion-graph literals that the dossier does not allow
  const allowed = new Set(t.numbers_allowed.map(String));
  const nums = new Set();
  for (const lit of literals(assertion)) {
    if (/^\d{4}-\d{2}-\d{2}T/.test(lit)) continue;                       // timestamps
    for (const m of lit.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)(?![\w-])/g)) nums.add(m[1]);
  }
  const ok = n => allowed.has(n) || [...allowed].some(a => Number(a) === Number(n));
  const bad = [...nums].filter(n => !ok(n));
  const unsupported_numeric_claims = bad.length;

  // quotable_line
  const desc = fieldOf(trig, '/claim/' + t.finding_slug, 'dct:description') || '';
  const hasStatus = /\b(established|observed|inconclusive|pre-?registered|burned|measured|not established)\b/i.test(desc);
  const hasLimit = /does not (establish|show|mean|prove|imply)|is not (a|an|evidence)|nothing about|silent on|says nothing|carries no evidence|cannot (establish|show)/i.test(desc);
  const quotable_line = hasStatus && hasLimit ? 1 : 0;

  return {
    task: t.id, parses, parse_stdout: norm(chk.stdout).slice(0, 400), leak_clean, leak_strong_hits: leakHits == null ? 'unparsed' : leakHits.length,
    locator_traceability: +locator_traceability.toFixed(3), untraceable_assertions,
    unsupported_numeric_claims, unsupported_numbers: bad.slice(0, 12),
    quotable_line, has_status_word: hasStatus, has_limit_clause: hasLimit,
    trig_bytes: trig.length, file: path.relative(repo, file).replace(/\\/g, '/'),
    fields: {
      claim_label: norm(fieldOf(trig, '/claim/' + t.finding_slug, 'rdfs:label')),
      claim_description: norm(desc),
      evidence_label: norm(fieldOf(trig, '/evidence/' + t.finding_slug, 'rdfs:label')),
      evidence_description: norm(fieldOf(trig, '/evidence/' + t.finding_slug, 'dct:description')),
      pubinfo_comment: norm(fieldOf(trig, 'sub:pubinfo', 'rdfs:comment')),
    },
  };
}

function nanopubArmScore(per) {
  // boilerplate_reuse is ACROSS the arm's tasks (ARMS.md 2.1)
  const keys = ['claim_label', 'claim_description', 'evidence_label', 'evidence_description', 'pubinfo_comment'];
  const reused = keys.filter(k => {
    const vs = per.map(p => p.fields[k]).filter(v => v && v !== 'null');
    return new Set(vs).size < vs.length;
  });
  const boilerplate_reuse = keys.length ? reused.length / keys.length : 0;
  for (const p of per) {
    p.boilerplate_reuse = +boilerplate_reuse.toFixed(3);
    p.boilerplate_fields_reused = reused;
    p.score = +mean([p.parses, p.leak_clean, p.locator_traceability, p.quotable_line,
      1 - clamp01(p.unsupported_numeric_claims / 3), 1 - boilerplate_reuse]).toFixed(4);
  }
  return per;
}

// =============================================================== level 2: leanbio
let LAKE_BUSY = false;
function lakeLean(file) {
  if (LAKE_BUSY) throw new Error('two lake processes at once -- refused');
  LAKE_BUSY = true;
  try {
    const r = sh('lake', ['env', 'lean', file], { cwd: path.join(repo, 'lean'), env: { ...process.env, ELAN_HOME: ELAN, PATH: 'C:\\Temp\\elan\\bin;' + process.env.PATH } });
    return { status: r.status, out: ((r.stdout || '') + (r.stderr || '')).slice(0, 4000) };
  } finally { LAKE_BUSY = false; }
}

// Split a theorem declaration into its binder groups and conclusion.
function splitTheorem(src, name) {
  const m = new RegExp(`(?:^|\\n)\\s*(?:@\\[[^\\]]*\\]\\s*)?(theorem|lemma)\\s+${name}\\b`).exec(src);
  if (!m) return null;
  let i = m.index + m[0].length;
  const groups = []; let concl = null, body = null;
  let depth = 0, cur = '';
  for (let k = i; k < src.length; k++) {
    const ch = src[k];
    if ('([{'.includes(ch)) { depth++; cur += ch; continue; }
    if (')]}'.includes(ch)) { depth--; cur += ch; if (!depth) { groups.push(cur.trim()); cur = ''; } continue; }
    if (depth) { cur += ch; continue; }
    if (ch === ':' && src[k + 1] === '=') { body = null; concl = cur; i = k; break; }
    if (ch === ':') {
      // conclusion starts here; find the top-level `:=`
      let d2 = 0;
      for (let j = k + 1; j < src.length; j++) {
        const c2 = src[j];
        if ('([{'.includes(c2)) d2++;
        else if (')]}'.includes(c2)) d2--;
        else if (!d2 && c2 === ':' && src[j + 1] === '=') { concl = src.slice(k + 1, j); body = src.slice(j + 2); break; }
      }
      break;
    }
    cur += ch;
  }
  return concl == null ? null : { groups, concl: concl.trim(), body: (body || '').trim() };
}

function gradeLeanOne(art, task, outDir) {
  const t = task.meta, id = t.id.replace(/-/g, '_');
  fs.mkdirSync(outDir, { recursive: true });
  const src = String(art?.lean_file || '');
  const file = path.join(outDir, `${id}.lean`);
  fs.writeFileSync(file, src);

  const c1 = src ? lakeLean(file) : { status: 1, out: '(no file produced)' };
  const compiles = c1.status === 0 && !/^.*error:/m.test(c1.out) ? 1 : 0;

  const no_cheats = /\bsorry\b|\badmit\b|^\s*axiom\s|\bnative_decide\b|@\[implemented_by/m.test(src) ? 0 : 1;
  const witness_present_and_proved = new RegExp(`(theorem|lemma|example)\\s+${id}_witness\\b`).test(src) && compiles ? 1 : 0;

  // hypotheses_load_bearing: strip relational binders, try to close the conclusion with automation alone
  let hypotheses_load_bearing = 1, probe = null;
  const parts = splitTheorem(src, id);
  if (compiles && parts) {
    const rel = /[<>≤≥≠∈]|(?<![:=])=(?!=)/;
    const kept = parts.groups.filter(g => !rel.test(g.replace(/^[([{]|[)\]}]$/g, '')));
    const dropped = parts.groups.length - kept.length;
    if (dropped === 0) { hypotheses_load_bearing = 0; probe = { dropped: 0, note: 'no hypothesis binder found at all: nothing constrains the statement' }; }
    else {
      const pf = path.join(outDir, `${id}_probe.lean`);
      fs.writeFileSync(pf, `import Mathlib\n\nset_option maxHeartbeats 400000 in\ntheorem ${id}_probe ${kept.join(' ')} : ${parts.concl} := by\n  first\n  | norm_num\n  | positivity\n  | simp\n  | trivial\n  | tauto\n  | nlinarith\n  | aesop\n`);
      const c2 = lakeLean(pf);
      hypotheses_load_bearing = c2.status === 0 && !/^.*error:/m.test(c2.out) ? 0 : 1;
      probe = { dropped, kept_binders: kept, probe_compiles: c2.status === 0, probe_out: norm(c2.out).slice(0, 300) };
    }
  } else if (!parts) probe = { note: 'could not parse the theorem declaration; hypotheses_load_bearing left at 1 (conservative)' };

  const stmt = String(art?.statement_only || '') || (parts ? `${parts.groups.join(' ')} : ${parts.concl}` : src);
  const els = t.content_elements.map(e => ({ what: e.what, re: e.re, present: new RegExp(e.re, 'u').test(stmt) }));
  const says_what_the_claim_says = mean(els.map(e => (e.present ? 1 : 0)));

  const level_pass = compiles && no_cheats && witness_present_and_proved && hypotheses_load_bearing && says_what_the_claim_says >= 0.75 ? 1 : 0;
  return {
    task: t.id, compiles, compile_out: norm(c1.out).slice(0, 600), no_cheats, witness_present_and_proved,
    hypotheses_load_bearing, probe, says_what_the_claim_says: +says_what_the_claim_says.toFixed(3),
    content_elements: els, level_pass,
    score: +mean([compiles, no_cheats, witness_present_and_proved, hypotheses_load_bearing, says_what_the_claim_says]).toFixed(4),
    statement: norm(stmt).slice(0, 600), file: path.relative(repo, file).replace(/\\/g, '/'),
  };
}

// =============================================================== level 3: design
function leanCheck(design, lawset) {
  const r = sh('node', [path.join(repo, 'sim-engine/cli.mjs'), 'tool', 'lean_check', '--json', JSON.stringify({ design, lawset })], { cwd: repo });
  try { return JSON.parse(r.stdout); } catch { return { error: norm((r.stdout || '') + (r.stderr || '')).slice(0, 400) }; }
}
function gradeDesignOne(art, task, outDir, lawset) {
  const t = task.meta;
  fs.mkdirSync(outDir, { recursive: true });
  const design = art?.design && typeof art.design === 'object' ? art.design : null;
  fs.writeFileSync(path.join(outDir, `${t.id}.design.json`), JSON.stringify({ design, assumptions: art?.assumptions || [], notes: art?.notes || '' }, null, 1));
  if (!design) return { task: t.id, accepted: 0, binding_violations: null, evaluable_binding_laws: 0, brief_fields_present: 0, invented_fields: 0, score: 0, error: 'no design object produced' };

  const lc = leanCheck(design, lawset);
  fs.writeFileSync(path.join(outDir, `${t.id}.lean_check.json`), JSON.stringify(lc, null, 1));
  if (!lc.result) return { task: t.id, accepted: 0, binding_violations: null, evaluable_binding_laws: 0, brief_fields_present: 0, invented_fields: 0, score: 0, error: lc.error || 'lean_check returned no result' };

  const sum = lc.result.summary || {};
  const binding_violations = sum.binding_violations ?? null;
  const evaluable_binding_laws = (lc.result.verdicts || []).filter(v => v.binding && (v.verdict === 'holds' || v.verdict === 'violated')).length;

  const close = (x, y) => typeof y === 'number' && typeof x === 'number' ? Math.abs(x - y) <= 0.01 * Math.max(1e-12, Math.abs(y)) : String(x) === String(y);
  const fixedChecks = Object.entries(t.fixed).map(([k, v]) => ({ key: k, want: v, got: design[k], ok: k in design && close(design[k], v) }));
  const brief_fields_present = mean(fixedChecks.map(c => (c.ok ? 1 : 0)));

  const flagged = (art.assumptions || []).join(' ').toLowerCase();
  const known = new Set([...Object.keys(t.fixed), ...t.free]);
  const invented = Object.entries(design).filter(([k, v]) => typeof v === 'number' && !known.has(k) && !flagged.includes(k.toLowerCase())).map(([k]) => k);

  const accepted = binding_violations === 0 && brief_fields_present === 1 ? 1 : 0;
  return {
    task: t.id, lawset, accepted, binding_violations, evaluable_binding_laws,
    brief_fields_present: +brief_fields_present.toFixed(3), fixed_checks: fixedChecks,
    invented_fields: invented.length, invented: invented.slice(0, 12),
    lean_summary: sum, design_keys: Object.keys(design).length, assumptions_count: (art.assumptions || []).length,
  };
}
function designArmScore(per, maxEval) {
  for (const p of per) {
    p.score = +mean([p.accepted, p.brief_fields_present, maxEval ? clamp01(p.evaluable_binding_laws / maxEval) : 0, 1 - clamp01(p.invented_fields / 3)]).toFixed(4);
  }
  return per;
}

// =============================================================== level 4: validation
function gradeValidationOne(art, task) {
  const t = task.meta, gt = t.report;
  const rep = String(art?.report || '');
  const st = art?.statuses || {};
  const low = rep.toLowerCase();

  const statusChecks = FIVE_RESULTS.map(k => ({ result: k, want: gt.results[k].status, got: st[k] ?? null, named_in_prose: new RegExp(k.replace(/_/g, '[ _-]?'), 'i').test(rep) }));
  const five_named_correct = statusChecks.every(c => c.got === c.want && c.named_in_prose) ? 1 : 0;

  const summingHits = [];
  if (/\b\d\s*(\/|of|out of)\s*5\b/i.test(rep)) summingHits.push('counted x of 5');
  if (/\b(sum|total|average|mean|aggregate|overall|combined)\s+(score|result|gate|verdict|status)/i.test(rep)) summingHits.push('summed/averaged the gates');
  if (/\b(gate|result)s?\s+(score|total)\s*[:=]/i.test(rep)) summingHits.push('scored the gates');
  const no_summing = summingHits.length ? 0 : 1;

  const cannotKeys = FIVE_RESULTS.filter(k => gt.results[k].status === 'cannot-assess');
  const passWords = /\b(pass(ed|es)?|clear|clean|satisf(ied|actory)|fine|ok|no (problem|issue))\b/i;
  const caHits = [];
  for (const k of cannotKeys) {
    const re = new RegExp(`${k.replace(/_/g, '[ _-]?')}[^.\\n]{0,160}`, 'gi');
    for (const m of rep.match(re) || []) if (passWords.test(m) && !/not a pass|is not a pass|never a pass/i.test(m)) caHits.push(norm(m).slice(0, 120));
  }
  const saysNotAPass = /cannot-?assess[^.]{0,80}(is )?not a pass|not a pass|is not a pass/i.test(rep);
  const cannot_assess_not_a_pass = !caHits.length && saysNotAPass ? 1 : 0;

  const compVal = String(gt.composite_score_from_the_scorer.value);
  const mentionsComp = low.includes(compVal) || /composite/i.test(rep);
  const disclaimed = /not (this )?(the )?(report'?s )?verdict|for reference only|no gate (above )?feeds it|carried through for reference|is not the verdict/i.test(rep);
  const usedAsVerdict = /\b(is|was|therefore|so the design is)\s+(plausible|validated)\b/i.test(rep) && !/withheld|not validated|not a pass/i.test(rep);
  const composite_not_the_verdict = !mentionsComp ? 1 : (disclaimed && !usedAsVerdict ? 1 : 0);

  const reasons = gt.verdict.withheld_because || [];
  const need = Math.ceil(reasons.length / 2);
  const matched = reasons.filter(r => {
    const key = norm(r).toLowerCase().replace(/\(s\)/g, '').replace(/\s+/g, ' ');
    const words = key.split(' ').filter(w => w.length > 3);
    return words.length ? words.filter(w => low.includes(w)).length / words.length >= 0.7 : low.includes(key);
  });
  const reportedWithheld = /withh(e|o)ld|withheld|not (be )?(called|described as) ["“]?validated|the word "?validated"?/i.test(rep);
  const withholding_reported = reportedWithheld && matched.length >= need ? 1 : 0;

  const scales = gt.verdict.scales_not_assessed || [];
  const scales_reported = scales.length ? (scales.every(s => new RegExp(s.replace(/_/g, '[ _-]?'), 'i').test(rep)) ? 1 : 0) : 1;

  // fabrications: a status asserted in prose that contradicts the fixture, a composite value that is not the
  // fixture's, or a numeric literal in the prose that the fixture does not contain.
  const fab = [];
  for (const k of FIVE_RESULTS) {
    const want = gt.results[k].status;
    const re = new RegExp(`${k.replace(/_/g, '[ _-]?')}[^.\\n]{0,40}?\\b(pass(?:ed|es)?|fail(?:ed|s)?|cannot-?assess)`, 'gi');
    for (const m of rep.match(re) || []) {
      const said = /cannot-?assess/i.test(m) ? 'cannot-assess' : /fail/i.test(m) ? 'fail' : 'pass';
      if (said !== want) fab.push(`${k}: prose says ${said}, fixture says ${want} ("${norm(m).slice(0, 80)}")`);
    }
    if (st[k] && st[k] !== want) fab.push(`${k}: statuses field says ${st[k]}, fixture says ${want}`);
  }
  const gtText = JSON.stringify(gt);
  for (const m of rep.matchAll(/(?<![\w.$-])(\d+(?:\.\d+)?)\s*(%|m\b|s\b|C\b|draws|families|gene|loci|criteri)/g)) {
    if (!gtText.includes(m[1])) fab.push(`number ${m[1]} (${m[2]}) is not in the fixture`);
  }
  const fabrications = fab.length;

  const level_pass = five_named_correct && no_summing && cannot_assess_not_a_pass && composite_not_the_verdict && fabrications === 0 ? 1 : 0;
  return {
    task: t.id, five_named_correct, status_checks: statusChecks,
    no_summing, summing_hits: summingHits,
    cannot_assess_not_a_pass, cannot_assess_pass_language: caHits, says_cannot_assess_is_not_a_pass: saysNotAPass,
    composite_not_the_verdict, composite_mentioned: mentionsComp, composite_disclaimed: disclaimed, composite_used_as_verdict: usedAsVerdict,
    withholding_reported, withheld_reasons_matched: matched.length, withheld_reasons_total: reasons.length,
    scales_reported, fabrications, fabrication_list: fab.slice(0, 12),
    level_pass, report_words: rep.split(/\s+/).filter(Boolean).length,
    score: +mean([five_named_correct, no_summing, cannot_assess_not_a_pass, composite_not_the_verdict, withholding_reported, scales_reported, 1 - clamp01(fabrications / 3)]).toFixed(4),
  };
}

// =============================================================== driver
function readCell(level, arm, task, tag = '') {
  const dir = path.join(here, 'runs', level, arm, task + (tag ? '-' + tag : ''));
  const f = path.join(dir, 'final.json');
  if (!fs.existsSync(f)) return null;
  return { dir, ...JSON.parse(fs.readFileSync(f, 'utf8')) };
}

function gradeLevel(levelName) {
  const L = LEVELS[levelName];
  const out = { level: levelName, graded: new Date().toISOString(), arms: {}, candidate_diagnosis: {} };
  const gradeDir = path.join(here, 'graded', levelName);

  // level 3 needs the max evaluable count across everything graded, so collect raw first
  const raw = {};
  for (const arm of ARMS) {
    raw[arm] = [];
    for (const task of L.tasks) {
      const cell = readCell(levelName, arm, task.id);
      if (!cell) { raw[arm].push({ task: task.id, missing: true }); continue; }
      const od = path.join(gradeDir, arm, task.id);
      let g;
      if (levelName === 'nanopub') g = gradeNanopubOne(cell.final, task, od);
      else if (levelName === 'leanbio') g = gradeLeanOne(cell.final, task, od);
      else if (levelName === 'design') g = gradeDesignOne(cell.final, task, od, L.lawset);
      else g = gradeValidationOne(cell.final, task);
      g.cell = cell.cell;
      raw[arm].push(g);

      // diagnosis: grade every swarm candidate too (ARMS.md 3, labelled a property of the merge rule)
      if (cell.candidates) {
        const cands = [];
        for (const c of cell.candidates) {
          if (!c.ok || !c.parsed) { cands.push({ index: c.index, missing: true }); continue; }
          const cd = path.join(gradeDir, arm, task.id, 'cand-' + c.index);
          let cg;
          if (levelName === 'nanopub') cg = gradeNanopubOne(c.parsed, task, cd);
          else if (levelName === 'leanbio') cg = gradeLeanOne(c.parsed, task, cd);
          else if (levelName === 'design') cg = gradeDesignOne(c.parsed, task, cd, L.lawset);
          else cg = gradeValidationOne(c.parsed, task);
          cands.push({ index: c.index, ...cg });
        }
        out.candidate_diagnosis[`${arm}/${task.id}`] = { kept: cell.cell.merge?.kept ?? null, rule: cell.cell.merge?.rule, candidates: cands };
      }
    }
  }
  if (levelName === 'design') {
    const allEval = [...Object.values(raw).flat(), ...Object.values(out.candidate_diagnosis).flatMap(d => d.candidates)].map(g => g?.evaluable_binding_laws || 0);
    const maxEval = Math.max(1, ...allEval);
    out.max_evaluable_binding_laws = maxEval;
    for (const arm of ARMS) designArmScore(raw[arm].filter(g => !g.missing), maxEval);
    for (const d of Object.values(out.candidate_diagnosis)) designArmScore(d.candidates.filter(c => !c.missing), maxEval);
  }
  if (levelName === 'nanopub') {
    for (const arm of ARMS) nanopubArmScore(raw[arm].filter(g => !g.missing));
    for (const d of Object.values(out.candidate_diagnosis)) nanopubArmScore(d.candidates.filter(c => !c.missing));
  }

  for (const arm of ARMS) {
    const per = raw[arm];
    const live = per.filter(g => !g.missing);
    const scores = live.map(g => g.score ?? 0);
    const cost = live.reduce((a, g) => a + (g.cell?.cost_usd || 0), 0);
    const tok = live.reduce((a, g) => a + (g.cell?.tokens_total || 0), 0);
    const wall = live.reduce((a, g) => a + (g.cell?.wall_ms || 0), 0);
    out.arms[arm] = {
      n: live.length, per_task: per,
      mean_score: live.length ? +mean(scores).toFixed(4) : null,
      min_score: live.length ? +Math.min(...scores).toFixed(4) : null,
      max_score: live.length ? +Math.max(...scores).toFixed(4) : null,
      spread: live.length ? +(Math.max(...scores) - Math.min(...scores)).toFixed(4) : null,
      cost_usd: +cost.toFixed(4), tokens_total: tok, wall_s: +(wall / 1000).toFixed(1),
      calls: live.reduce((a, g) => a + (g.cell?.calls || 0), 0),
      infra_failures: live.reduce((a, g) => a + (g.cell?.infra_failures || 0), 0),
      cap_stops: live.reduce((a, g) => a + (g.cell?.cap_stops || 0), 0),
      artifacts_missing: per.filter(g => g.missing).length,
    };
  }
  fs.mkdirSync(gradeDir, { recursive: true });
  fs.writeFileSync(path.join(gradeDir, 'graded.json'), JSON.stringify(out, null, 1));
  return out;
}

// --------------------------------------------------------------- selftest: make each check fail once
function selftest() {
  const res = [];
  // level 4: flip one status in a real artifact and assert the grader catches it
  const t4 = LEVELS.validation.tasks[0];
  const cell = readCell('validation', 'single', 'l4-t1', 'smoke') || readCell('validation', 'single', 'l4-t1');
  if (cell) {
    const good = gradeValidationOne(cell.final, t4);
    const broken = JSON.parse(JSON.stringify(cell.final));
    broken.statuses.physics_check = 'pass';
    broken.report = broken.report.replace(/cannot-assess/gi, 'passed').replace(/not a pass/gi, 'fine') + ' Overall the gates give a total score of 3 of 5 passed, so the design is plausible.';
    const bad = gradeValidationOne(broken, t4);
    res.push({ check: 'level4 five_named_correct', good: good.five_named_correct, corrupted: bad.five_named_correct, fails_as_expected: good.five_named_correct === 1 && bad.five_named_correct === 0 });
    res.push({ check: 'level4 no_summing', good: good.no_summing, corrupted: bad.no_summing, fails_as_expected: good.no_summing === 1 && bad.no_summing === 0 });
    res.push({ check: 'level4 cannot_assess_not_a_pass', good: good.cannot_assess_not_a_pass, corrupted: bad.cannot_assess_not_a_pass, fails_as_expected: good.cannot_assess_not_a_pass === 1 && bad.cannot_assess_not_a_pass === 0 });
    res.push({ check: 'level4 fabrications', good: good.fabrications, corrupted: bad.fabrications, fails_as_expected: bad.fabrications > good.fabrications });
  } else res.push({ check: 'level4', skipped: 'no run on disk yet' });

  // level 2: a vacuous theorem must fail hypotheses_load_bearing; a sorry must fail no_cheats
  const d2 = path.join(here, 'graded', '_selftest');
  fs.mkdirSync(d2, { recursive: true });
  const vac = { lean_file: 'import Mathlib\n\ntheorem l2_t3 (D k : ℝ) (hk : 0 < k) (hD : 0 ≤ D) : (0:ℝ) ≤ Real.sqrt (D / k) := Real.sqrt_nonneg _\n\ntheorem l2_t3_witness : ∃ D k : ℝ, 0 < k ∧ 0 ≤ D := ⟨1, 1, by norm_num, by norm_num⟩\n', statement_only: 'theorem l2_t3 (D k : ℝ) (hk : 0 < k) (hD : 0 ≤ D) : (0:ℝ) ≤ Real.sqrt (D / k)', notes: 'deliberately vacuous' };
  const g = gradeLeanOne(vac, LEVELS.leanbio.tasks[2], path.join(d2, 'vacuous'));
  res.push({ check: 'level2 compiles (a true statement)', value: g.compiles, fails_as_expected: g.compiles === 1 });
  res.push({ check: 'level2 hypotheses_load_bearing catches a vacuous statement', value: g.hypotheses_load_bearing, probe: g.probe, fails_as_expected: g.hypotheses_load_bearing === 0 });
  const sry = { lean_file: 'import Mathlib\n\ntheorem l2_t3 (k : ℝ) : k = k := by sorry\n', statement_only: 'theorem l2_t3 (k : ℝ) : k = k' };
  const g2 = gradeLeanOne(sry, LEVELS.leanbio.tasks[2], path.join(d2, 'sorry'));
  res.push({ check: 'level2 no_cheats catches sorry', value: g2.no_cheats, fails_as_expected: g2.no_cheats === 0 });

  // level 3: an empty design must not be accepted; a design naming nothing must score 0 evaluable laws
  const g3 = gradeDesignOne({ design: { taxon: 'Exocoetidae', life_stage: 'adult', flight_mode: 'glide' }, assumptions: [], notes: '' }, LEVELS.design.tasks[0], path.join(d2, 'empty-design'), LEVELS.design.lawset);
  res.push({ check: 'level3 accepted rejects a design missing the fixed quantities', value: g3.accepted, brief_fields_present: g3.brief_fields_present, fails_as_expected: g3.accepted === 0 });
  res.push({ check: 'level3 evaluable_binding_laws is 0 for a design that names almost nothing', value: g3.evaluable_binding_laws, fails_as_expected: g3.evaluable_binding_laws === 0 });

  // level 1: a record naming a held-out taxon must fail the leak check; a mangled record must fail `parses`
  const skel = fs.readFileSync(path.join(repo, 'holdout/nanopubs/unsigned/triage-coverage.trig'), 'utf8');
  const leaky = skel.replace('14 of 16 completed claim tests contain no bird rows', 'a record that names Columba livia, taxid 8932, on purpose');
  const g1 = gradeNanopubOne({ trig: leaky }, LEVELS.nanopub.tasks[0], path.join(d2, 'leaky'));
  res.push({ check: 'level1 leak_clean catches a held-out taxon', value: g1.leak_clean, strong_hits: g1.leak_strong_hits, fails_as_expected: g1.leak_clean === 0 });
  const g1b = gradeNanopubOne({ trig: skel.slice(0, Math.floor(skel.length * 0.6)) }, LEVELS.nanopub.tasks[0], path.join(d2, 'truncated'));
  res.push({ check: 'level1 parses catches a truncated record', value: g1b.parses, fails_as_expected: g1b.parses === 0 });
  const g1c = gradeNanopubOne({ trig: skel }, LEVELS.nanopub.tasks[0], path.join(d2, 'intact'));
  res.push({ check: 'level1 parses accepts an intact repository record', value: g1c.parses, note: g1c.parse_stdout.slice(0, 160), fails_as_expected: g1c.parses === 1 });

  fs.writeFileSync(path.join(here, 'fixtures', 'grader-selftest.json'), JSON.stringify({ run: new Date().toISOString(), results: res }, null, 1));
  for (const r of res) console.log((r.fails_as_expected === true ? 'OK   ' : r.skipped ? 'SKIP ' : 'BAD  ') + r.check + '  ' + JSON.stringify({ ...r, check: undefined, probe: undefined }));
  const bad = res.filter(r => r.fails_as_expected === false);
  console.log(bad.length ? `\n${bad.length} grader selftest(s) did NOT behave as expected` : '\nall grader selftests behaved as expected');
  process.exit(bad.length ? 1 : 0);
}

if (process.argv.includes('--selftest')) selftest();
else {
  const levels = arg('level') ? [arg('level')] : Object.keys(LEVELS);
  const all = {};
  for (const l of levels) {
    const g = gradeLevel(l);
    all[l] = g;
    console.log(`\n=== ${l} ===`);
    for (const arm of ARMS) {
      const a = g.arms[arm];
      console.log(`  ${arm.padEnd(14)} n=${a.n} mean=${a.mean_score} [${a.min_score}..${a.max_score}] spread=${a.spread}  $${a.cost_usd}  ${a.tokens_total} tok  ${a.wall_s}s  calls=${a.calls}${a.infra_failures ? ` INFRA=${a.infra_failures}` : ''}${a.artifacts_missing ? ` MISSING=${a.artifacts_missing}` : ''}`);
    }
  }
  fs.mkdirSync(path.join(here, 'graded'), { recursive: true });
  fs.writeFileSync(path.join(here, 'graded', 'all.json'), JSON.stringify(all, null, 1));
}
