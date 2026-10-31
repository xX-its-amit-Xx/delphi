#!/usr/bin/env node
// Sound wrapper around `nanopub-java check`. The CLI exits 0 even when a file does not parse (verified 2026-10-31:
// garbage input and a truncated record both print "Summary: 1 errors;" and exit 0), so this script ignores the exit
// code and reads the output instead, one file per invocation, with anchored matches:
//   pass  = a line matching ^Valid (and, for unsigned drafts, "Valid (but not trusty)") naming the nanopub,
//           and a line ^Summary: 1 valid … with no "errors" component, and no ISSUES other than the three expected
//           for an unsigned draft (no signature, temporary graph URIs, creation time older than one hour).
//   fail  = anything else, including a parse exception, "errors" in the summary, or an unexpected issue.
// --selftest feeds deliberately broken input (garbage, truncated, a good file with one triple deleted) and requires
// each to FAIL before the real files are checked; if the self-test passes a broken file, the script stops.
//
//   node swarm/nanopubs/check.mjs [--jar C:/Temp/nanopub-java/nanopub.jar] [--selftest] [files...]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const JAR = arg('jar', process.env.NANOPUB_JAR || 'C:/Temp/nanopub-java/nanopub.jar');
const SELFTEST = argv.includes('--selftest');
let files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--jar');
if (!files.length) files = fs.readdirSync(path.join(here, 'unsigned')).filter(f => f.endsWith('.trig')).map(f => path.join(here, 'unsigned', f));

const EXPECTED_ISSUES = [/^Nanopub has no signature element\.$/, /^Unexpected graph uri: http:\/\/purl\.org\/nanopub\/temp\/np\d+\/(Head|assertion|provenance|pubinfo)$/, /^Nanopub creation time is older than one hour\.$/, /^Nanopub has no assertion template\.$/];

export function checkOne(file) {
  const r = spawnSync('java', ['-jar', JAR, 'check', '-v', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + '\n' + (r.stderr || '');
  const lines = out.split(/\r?\n/);
  const summary = lines.find(l => /^Summary: /.test(l)) || null;
  const valid = lines.filter(l => /^Valid(?: \(but not trusty\))?: \S+/.test(l));
  const exceptions = lines.filter(l => /^(org\.|java\.)[\w.]*Exception\b/.test(l) || /^ERROR\b/.test(l));
  // ISSUES block: lines starting with "- " after a line that is exactly "ISSUES:" until a blank or next header
  const issues = [];
  let inIssues = false;
  for (const l of lines) {
    if (/^ISSUES:$/.test(l)) { inIssues = true; continue; }
    if (inIssues) { if (/^- /.test(l)) issues.push(l.slice(2)); else if (l.trim() === '' || /^[A-Z ]+:$/.test(l) || /^Summary: /.test(l) || /^Reading file: /.test(l)) inIssues = false; }
  }
  const unexpected = issues.filter(i => !EXPECTED_ISSUES.some(re => re.test(i)));
  const summaryOk = !!summary && /^Summary: 1 valid(?: \(not trusty\))?;/.test(summary) && !/\berrors?;/.test(summary);
  const pass = summaryOk && valid.length === 1 && exceptions.length === 0 && unexpected.length === 0;
  return { file, pass, exit: r.status, summary, valid: valid[0] || null, exceptions: exceptions.slice(0, 2), unexpected_issues: unexpected };
}

function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npcheck-selftest-'));
  const good = files[0];
  const goodText = fs.readFileSync(good, 'utf8');
  const cases = {
    'garbage.trig': 'this is not trig\n',
    'truncated.trig': goodText.slice(0, Math.floor(goodText.length / 2)),
    'no-head-link.trig': goodText.replace(/\s*np:hasProvenance sub:provenance ;/, ' ;'),
    'empty.trig': '',
  };
  let ok = true;
  for (const [name, text] of Object.entries(cases)) {
    const p = path.join(dir, name); fs.writeFileSync(p, text);
    const r = checkOne(p);
    const line = `${r.pass ? 'PASSED (BAD)' : 'failed (good)'}  exit=${r.exit}  ${name}  summary=${r.summary}`;
    console.log('selftest', line);
    if (r.pass) ok = false;
  }
  const g = checkOne(good);
  console.log('selftest', `${g.pass ? 'passed (good)' : 'FAILED (BAD)'}  exit=${g.exit}  ${path.basename(good)}  summary=${g.summary}`);
  if (!g.pass) ok = false;
  fs.rmSync(dir, { recursive: true, force: true });
  return ok;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (SELFTEST && !selftest()) { console.error('SELF-TEST FAILED: the checker accepted broken input or rejected a good file. Not checking the real files.'); process.exit(2); }
  const results = files.map(checkOne);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${path.basename(r.file)}  ${r.summary || '(no summary line)'}${r.unexpected_issues.length ? '  unexpected: ' + r.unexpected_issues.join(' | ') : ''}${r.exceptions.length ? '  ' + r.exceptions[0] : ''}`);
  const n = results.filter(r => r.pass).length;
  const report = { checked_at: new Date().toISOString(), jar: JAR, note: 'nanopub-java check exits 0 on unparsable input; this report reads the per-file output with anchored matches and ignores the exit code', selftest: SELFTEST ? 'passed (broken inputs failed, good input passed)' : 'not run', passed: n, total: results.length, results };
  fs.writeFileSync(path.join(here, 'check-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${n}/${results.length} pass; report in swarm/nanopubs/check-report.json`);
  process.exit(n === results.length ? 0 : 1);
}
