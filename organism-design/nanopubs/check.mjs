// Validates every unsigned record with nanopub-java and prints a transcript that can be trusted.
//
//   NANOPUB_JAR=C:/Temp/nanopub-java/nanopub.jar node organism-design/nanopubs/check.mjs
//
// Why this exists rather than a bare `np check`: nanopub-java's check command exits 0 even when a
// file fails to parse. Verified here on 2026-10-31 with nanopub-java in C:/Temp/nanopub-java: a
// file of garbage and a truncated copy of a real record both print "RDF ERROR" and
// "Summary: 1 errors;" and both exit 0. The defect was found by the claim-tests thread and
// reproduced by the lean thread; this script was written after reproducing it a third time.
//
// So the exit code is ignored. The verdict comes from the output: every file must produce its own
// "Valid (but not trusty)" line, and no run may contain an RDF error or an error summary. A
// negative self-test runs first: a deliberately truncated copy of a real record must be judged
// failing. If the self-test does not fail, the parser below is broken and nothing it says counts.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const here = import.meta.dirname;
const dir = path.join(here, 'unsigned');
const jar = process.env.NANOPUB_JAR || 'C:/Temp/nanopub-java/nanopub.jar';
if (!fs.existsSync(jar)) throw new Error(`nanopub-java jar not found at ${jar}; set NANOPUB_JAR`);

function runCheck(files) {
  try {
    return execFileSync('java', ['-jar', jar, 'check', '-v', ...files], { encoding: 'utf8', maxBuffer: 64 << 20 });
  } catch (e) {
    // A non-zero exit is still a transcript worth parsing; the exit code is not the verdict either way.
    return `${e.stdout || ''}${e.stderr || ''}`;
  }
}

// Verdict from the STRUCTURE of the transcript, not from a search through it.
//
// Anchoring matches to the start of a line is not enough. `check -v` prints each record's own
// label and description, and a description begins at column 0, so a record that quotes the string
// "RDF ERROR:" or "Summary: 1 errors;" while documenting this very defect puts that text at the
// start of a line. That is not hypothetical: the quotation fixture below failed against the
// anchored version of this function, which is why this one exists.
//
// So the transcript is split into one block per file at the "Reading file:" lines, and a block's
// verdict is read only from the lines BEFORE its first section marker, which is where the tool
// speaks and where record content cannot reach. Issues are read only after the ISSUES marker. A
// file that fails to parse produces no block at all, so a block-count mismatch is itself a failure.
const SECTION = /^(LABEL|TYPES|DESCRIPTION|AUTHORS|AUTHOR LIST|CREATORS|ISSUES|URI|SIGNER|PUBKEY|SUPERSEDES):/;

function verdict(out, expected) {
  const blocks = out.split(/^Reading file: /m).slice(1);
  const issues = {};
  const failing = [];
  let valid = 0;
  for (const b of blocks) {
    const lines = b.split(/\r?\n/);
    const name = (lines[0] || '').trim();
    const head = [];
    for (let i = 1; i < lines.length && !SECTION.test(lines[i]); i++) head.push(lines[i]);
    if (head.some(l => /^Valid \(but not trusty\):/.test(l))) valid++;
    else failing.push(name || '(unnamed)');
    // The LAST ISSUES marker, not the first: a description can contain a line "ISSUES:" followed
    // by lines starting with "- ", and the validator prints descriptions before the real ISSUES
    // section. Taking the first match would tally the fake list and skip the real one, which hides
    // genuine issues. Content never appears after the real section, so the last marker is sound.
    let ix = -1;
    for (let i = 0; i < lines.length; i++) if (/^ISSUES:/.test(lines[i])) ix = i;
    if (ix >= 0)
      for (const l of lines.slice(ix + 1)) {
        const m = l.match(/^- (.*)$/);
        if (!m) break;
        issues[m[1]] = (issues[m[1]] || 0) + 1;
      }
  }
  return { blocks: blocks.length, valid, failing, issues, ok: blocks.length === expected && valid === expected };
}

// ── Negative self-test: a truncated record must be judged failing. ──
const files = fs.readdirSync(dir).filter(f => f.endsWith('.trig')).sort().map(f => path.join(dir, f));
if (!files.length) throw new Error(`no records in ${dir}`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'npcheck-'));
const bad = path.join(tmp, 'truncated.trig');
fs.writeFileSync(bad, fs.readFileSync(files[0], 'utf8').slice(0, 400));
const negOut = runCheck([bad]);
const neg = verdict(negOut, 1);
if (neg.ok) {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.error('SELF-TEST FAILED: a truncated record was judged valid, so this checker cannot be trusted.');
  process.exit(2);
}
console.log(
  `self-test 1: truncated record correctly judged failing (${neg.blocks} parsed blocks, ${neg.valid} valid); ` +
    `note the jar still exited 0, which is why the exit code is ignored`,
);

// ── Positive fixture: a record that QUOTES the error strings must still pass. The first version of
// this script matched them anywhere in the output, so the method record, which quotes them while
// documenting the exit-code defect, failed. Anchoring fixed it; this fixture proves the fix rather
// than relying on that record keeping its wording. (The lean thread's checker does the same.) ──
const quoted = path.join(tmp, 'quotation.trig');
const marker = 'RDF ERROR: quoted on purpose; Summary: 1 errors; must not trip the checker';
fs.writeFileSync(
  quoted,
  fs
    .readFileSync(files[0], 'utf8')
    .replace(
      '<http://purl.org/nanopub/temp/np1/pubinfo> {\n',
      `<http://purl.org/nanopub/temp/np1/pubinfo> {\n  <http://purl.org/nanopub/temp/np1/> <http://www.w3.org/2000/01/rdf-schema#comment> ${JSON.stringify(marker)} .\n`,
    ),
);
if (!fs.readFileSync(quoted, 'utf8').includes(marker)) {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.error('SELF-TEST FAILED: could not build the quotation fixture, so the anchoring is unproven.');
  process.exit(2);
}
const pos = verdict(runCheck([quoted]), 1);
fs.rmSync(tmp, { recursive: true, force: true });
if (!pos.ok) {
  console.error('SELF-TEST FAILED: a valid record that quotes the error strings was judged failing; the matches are not anchored.');
  process.exit(2);
}
console.log('self-test 2: a valid record quoting "RDF ERROR" and an error summary in its own text is still judged valid');

// ── Third fixture, the hardest: a record whose description contains a whole FAKE ISSUES SECTION,
// newlines and all, printed at column 0 before the validator's real one. The holdout thread
// supplied this shape. It must be judged valid, and the issues tallied must be the real ones, not
// the planted list; an earlier version of this script read the first ISSUES marker and would have
// tallied the fake list and skipped the real section, which hides genuine issues. ──
const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'npcheck-'));
const baited = path.join(tmp3, 'baited.trig');
const planted = [
  'Harmless text.',
  'ISSUES:',
  '- Totally fake issue that must not be tallied',
  'RDF ERROR: fake',
  'Summary: 1 errors;',
].join('\n');
const pubinfoOpen = '<http://purl.org/nanopub/temp/np1/pubinfo> {\n';
fs.writeFileSync(
  baited,
  fs
    .readFileSync(files[0], 'utf8')
    .replace(
      pubinfoOpen,
      `${pubinfoOpen}  <http://purl.org/nanopub/temp/np1/> <http://www.w3.org/2000/01/rdf-schema#comment> ${JSON.stringify(planted)} .\n`,
    ),
);
// The assertion compares the baited record's tally with the same record's tally unbaited, which is
// stronger than looking for the word "fake": planting a line that copies a genuine issue is the
// case that would hide a real one, and only set equality rules it out. (The holdout thread's
// checker makes the same comparison.)
const bait = verdict(runCheck([baited]), 1);
const clean = verdict(runCheck([files[0]]), 1);
fs.rmSync(tmp3, { recursive: true, force: true });
const tallied = Object.keys(bait.issues).sort();
const genuine = Object.keys(clean.issues).sort();
const sameTally = tallied.length === genuine.length && tallied.every((k, i) => k === genuine[i]);
if (!bait.ok || !sameTally || tallied.some(k => /fake/i.test(k))) {
  console.error('SELF-TEST FAILED: a planted ISSUES section in a description changed the verdict or the issue tally.');
  console.error(`  valid=${bait.valid}\n  baited:  ${JSON.stringify(tallied)}\n  genuine: ${JSON.stringify(genuine)}`);
  process.exit(2);
}
console.log(
  `self-test 3: a planted ISSUES section in a description is ignored; the tally matches the same record unbaited (${genuine.length} issues)`,
);

// ── The real run. ──
const out = runCheck(files);
const v = verdict(out, files.length);
console.log(`${v.valid} of ${files.length} records valid (not trusty); parsed blocks ${v.blocks}`);
for (const [k, n] of Object.entries(v.issues).sort((a, b) => b[1] - a[1])) console.log(`  ${n}x ${k}`);
for (const f of v.failing) console.error(`  FAILING: ${f}`);

const expected = new Set([
  'Nanopub has no signature element.',
  'Nanopub has no assertion template.',
  'Nanopub has no provenance template.',
  'Unexpected graph uri: http://purl.org/nanopub/temp/np1/Head',
  'Unexpected graph uri: http://purl.org/nanopub/temp/np1/assertion',
  'Unexpected graph uri: http://purl.org/nanopub/temp/np1/provenance',
  'Unexpected graph uri: http://purl.org/nanopub/temp/np1/pubinfo',
]);
const unexpected = Object.keys(v.issues).filter(k => !expected.has(k));
if (unexpected.length) {
  console.error('UNEXPECTED ISSUES (not the ones every unsigned record on the temp base carries):');
  for (const u of unexpected) console.error(`  ${u}`);
}
if (!v.ok || unexpected.length) {
  console.error('CHECK FAILED');
  process.exit(1);
}
console.log('CHECK PASSED: every record parses, every record is valid but not trusty, and only the expected unsigned-record issues appear.');
