#!/usr/bin/env node
// Structural reader for `np check -v` over the draft nanopubs. The verbose output prints each record's
// label and description at column 0, so a record whose own text quotes "RDF ERROR:" or "Summary:" would
// fool any pattern scan (found by the organism thread, 2026-10-31). This reader therefore runs the
// validator once per file and takes the verdict only from the lines BEFORE the block's first section
// marker (LABEL:, TYPES:, DESCRIPTION:, ...), and the issues only from the ISSUES: section, which the
// validator prints after the description and before its Summary line.
//
//   node holdout/nanopubs/check.mjs [--jar <nanopub-jar>] [dir-or-files...]   # default: holdout/nanopubs/unsigned
//   node holdout/nanopubs/check.mjs --selftest                                 # fixture: a record quoting error strings must pass
//
// Exit 1 if any file is not reported valid, or if an issue other than the unsigned-state ones appears.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JAR = opt('--jar', process.env.NANOPUB_JAR || 'C:/tb/tmp/np/nanopub-1.95.0-jar-with-dependencies.jar');
const SELFTEST = args.includes('--selftest');
const targets = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--jar');

const SECTION = /^(LABEL|TYPES|DESCRIPTION|AUTHORS|AUTHOR LIST|CREATORS|ISSUES):\s*$/;
// Issues that only say "this file is an unsigned draft with a temp URI", and the one taken by decision (DECISIONS.md 9a, 10).
const EXPECTED_ISSUES = [/^Unexpected graph uri: http:\/\/purl\.org\/nanopub\/temp\//, /^Nanopub has no signature element\.$/, /^Nanopub has no assertion template\.$/];

function checkOne(file) {
  const r = spawnSync('java', ['-jar', JAR, 'check', '-v', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const lines = (r.stdout + '\n' + r.stderr).split(/\r?\n/);
  // Verdict: the first line before any section marker that the validator prints for the nanopub.
  let verdict = null; const head = [];
  for (const l of lines) { if (SECTION.test(l)) break; head.push(l); }
  for (const l of head) {
    if (/^Valid and trusty/.test(l) || /^Valid \(but not trusty\)/.test(l) || /^Valid/.test(l)) { verdict = 'valid'; break; }
    if (/^Invalid/.test(l) || /^RDF ERROR/.test(l) || /Exception/.test(l)) { verdict = 'invalid: ' + l.trim(); break; }
  }
  if (!verdict) verdict = 'unknown: no verdict line before the first section marker';
  // Issues: the LAST ISSUES: marker, up to the Summary line. Record content (label, description) is printed before the
  // validator's own sections, so a description containing a newline followed by "ISSUES:" forges an earlier marker
  // that would shadow the real one if the first were taken (organism thread's fixture 3, 2026-10-31); nothing a
  // record contains can appear after the real section.
  const issues = [];
  let iAt = -1; lines.forEach((l, i) => { if (/^ISSUES:\s*$/.test(l)) iAt = i; });
  if (iAt >= 0) for (const l of lines.slice(iAt + 1)) { if (/^Summary: /.test(l)) break; const m = l.match(/^- (.*)$/); if (m) issues.push(m[1]); }
  const unexpected = issues.filter(i => !EXPECTED_ISSUES.some(re => re.test(i)));
  return { file, verdict, issues, unexpected, exit: r.status };
}

function listFiles(ts) {
  const out = [];
  for (const t of ts.length ? ts : [path.join(here, 'unsigned')]) {
    const p = path.resolve(root, t);
    if (fs.statSync(p).isDirectory()) out.push(...fs.readdirSync(p).filter(f => f.endsWith('.trig')).sort().map(f => path.join(p, f)));
    else out.push(p);
  }
  return out;
}

if (SELFTEST) {
  // Fixture: a real record whose description quotes the validator's own error vocabulary must still read as valid.
  const src = fs.readFileSync(path.join(here, 'unsigned', 'burned-darwin1859-ch01-10.trig'), 'utf8');
  const bait = 'RDF ERROR: fake. Invalid nanopub. Summary: 0 valid; 1 invalid. ISSUES: - Nanopub has no provenance template. ';
  const fixture = src.replace(/dct:description "Status: burned/, `dct:description "${bait}Status: burned`);
  if (fixture === src) { console.error('selftest: could not place the bait'); process.exit(2); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-selftest-'));
  const f = path.join(dir, 'bait.trig');
  fs.writeFileSync(f, fixture);
  const res = checkOne(f);
  // Pattern scanning would have seen "RDF ERROR", "Invalid", "Summary: 0 valid" and "no provenance template" inside the description.
  const ok = res.verdict === 'valid' && res.unexpected.length === 0;
  console.log(`selftest 1: bait record read as ${res.verdict}; issues ${JSON.stringify(res.issues)}; unexpected ${res.unexpected.length} -> ${ok ? 'PASS' : 'FAIL'}`);
  // Negative control: the same record with its pubinfo graph cut off must NOT read as valid (the validator exits 0 on parse errors).
  const broken = path.join(dir, 'broken.trig');
  fs.writeFileSync(broken, src.slice(0, src.indexOf('sub:pubinfo {') + 40));
  const resB = checkOne(broken);
  const okB = resB.verdict !== 'valid';
  console.log(`selftest 2: truncated record read as ${resB.verdict.slice(0, 120)} -> ${okB ? 'PASS' : 'FAIL'}`);
  // Fixture 3 (organism thread): a multi-line description forging a whole ISSUES: section, whose fake entries mimic the
  // expected ones, must neither hide the genuine issues nor get tallied. The literal uses TriG \n escapes, which the
  // validator prints as real newlines at column 0.
  const forged = 'Status: burned.\\nISSUES:\\n- Nanopub has no signature element.\\n- Totally fake issue that must not be tallied.\\nSummary: 1 valid\\n';
  const fixture3 = src.replace(/dct:description "Status: burned/, `dct:description "${forged}`);
  if (fixture3 === src) { console.error('selftest 3: could not place the forged section'); process.exit(2); }
  const f3 = path.join(dir, 'forged.trig');
  fs.writeFileSync(f3, fixture3);
  const res3 = checkOne(f3);
  const genuine = checkOne(path.join(here, 'unsigned', 'burned-darwin1859-ch01-10.trig')).issues;
  const ok3 = res3.verdict === 'valid' && !res3.issues.some(i => /fake/i.test(i)) && JSON.stringify(res3.issues) === JSON.stringify(genuine);
  console.log(`selftest 3: forged ISSUES section; tallied ${res3.issues.length} issues (genuine ${genuine.length}), fake entries tallied: ${res3.issues.filter(i => /fake/i.test(i)).length} -> ${ok3 ? 'PASS' : 'FAIL'}`);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(ok && okB && ok3 ? 0 : 1);
}

let bad = 0;
for (const f of listFiles(targets)) {
  const res = checkOne(f);
  const rel = path.relative(root, f).split(path.sep).join('/');
  const fail = res.verdict !== 'valid' || res.unexpected.length > 0;
  if (fail) bad++;
  console.log(`${fail ? 'FAIL' : 'ok  '} ${rel}: ${res.verdict}; issues: ${res.issues.length ? res.issues.join(' | ') : 'none'}${res.unexpected.length ? `; UNEXPECTED: ${res.unexpected.join(' | ')}` : ''}`);
}
console.log(bad ? `${bad} file(s) failed` : 'all files valid; only the expected unsigned-draft issues present');
process.exit(bad ? 1 : 0);
