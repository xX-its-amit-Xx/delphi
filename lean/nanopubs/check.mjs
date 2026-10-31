#!/usr/bin/env node
// Validates the unsigned drafts and records the result in lean/nanopubs/check.json.
//   node lean/nanopubs/check.mjs
// Two checks per file: (1) a strict TriG parse with the n3 library; (2) nanopub-java `check -v`.
// nanopub-java exits 0 even when a file fails to parse (observed 2026-10-31 on nanopub-1.95.0: an
// RDFParseException prints "Summary: 1 errors;" and still exits 0), so the exit code is never trusted:
// a file passes only if the output has a "Valid (but not trusty): " or "Valid and trusty: " line and no
// "RDF ERROR" / "Summary: N errors" text. ISSUES lines are kept so expected notes on unsigned drafts
// (no signature, temp graph URIs, no assertion template) are visible, not hidden.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'unsigned');
const jar = process.env.NANOPUB_JAR || 'C:/Temp/nanopub/nanopub.jar';
const n3dir = process.env.N3_DIR || 'C:/Temp/project-delphi-ontology/pipeline/node_modules';
if (!fs.existsSync(jar)) { console.error('nanopub-java jar not found: ' + jar + ' (set NANOPUB_JAR)'); process.exit(2); }
let Parser;
try { ({ Parser } = createRequire(path.join(n3dir, 'package.json')).call(null, 'n3')); } catch { ({ Parser } = createRequire(import.meta.url)('n3')); }
const jarVersion = process.env.NANOPUB_JAR_VERSION || '1.95.0'; // the release downloaded to C:/Temp/nanopub on 2026-10-31

// All matches are anchored to the START of a line: the verbose output echoes record labels and
// descriptions, so a record that merely quotes an error string (as the team's method record does)
// must not be read as a parse failure (Organism found this on its first self-test).
// Anchoring alone is NOT sufficient (Organism, 2026-10-31): `check -v` prints DESCRIPTION text on its own
// lines at column 0, so a record whose description or comment quotes "RDF ERROR:" or "Summary: 1 errors;"
// is indistinguishable from the tool's own lines by any pattern over the whole transcript. So the verdict
// is read only from the HEADER region of the file's block: the lines after "Reading file:" and before the
// first section marker. Issues are read only between "ISSUES:" and the next marker. Record content can
// reach neither region. One file per invocation, so there must be exactly one "Reading file:" line.
const MARKERS = /^(LABEL|TYPES|DESCRIPTION|AUTHORS|AUTHOR LIST|CREATORS|ISSUES|URI|SIGNER|PUBKEY|SUPERSEDES):/;
function npCheck(file) {
  const p = spawnSync('java', ['-jar', jar, 'check', '-v', file], { encoding: 'utf8', shell: true, maxBuffer: 16 * 1024 * 1024 });
  const lines = ((p.stdout || '') + (p.stderr || '')).split(/\r?\n/);
  const starts = lines.map((l, i) => /^Reading file: /.test(l) ? i : -1).filter(i => i >= 0);
  if (starts.length !== 1) return { exitCode: p.status, validLine: null, rdfError: true, trusty: false, issues: [], summary: `expected one "Reading file:" block, found ${starts.length}` };
  const body = lines.slice(starts[0] + 1);
  const firstMarker = body.findIndex(l => MARKERS.test(l));
  const header = firstMarker < 0 ? body : body.slice(0, firstMarker);
  const validLine = header.find(l => /^Valid (?:\(but not trusty\)|and trusty): \S+/.test(l)) || null;
  const rdfError = header.some(l => /^RDF ERROR: /.test(l)) || !validLine;
  // LAST "ISSUES:" marker, not the first: a literal may contain newlines, so a description can carry a
  // forged "ISSUES:" line followed by "- " lines, all printed at column 0 under DESCRIPTION, BEFORE the
  // validator prints the real section. Record content is printed only in the label and description,
  // which come before the validator's own sections, so nothing a record contains can appear after the
  // real ISSUES section (Organism, 2026-10-31, via the holdout thread's fixture shape).
  const issuesAt = body.map((l, i) => /^ISSUES:/.test(l) ? i : -1).filter(i => i >= 0).pop() ?? -1;
  let issues = [];
  if (issuesAt >= 0) { for (const l of body.slice(issuesAt + 1)) { if (MARKERS.test(l) || /^Summary: /.test(l)) break; if (/^- /.test(l)) issues.push(l.slice(2)); } }
  const summary = [...lines].reverse().find(l => /^Summary: /.test(l)) || '';
  return { exitCode: p.status, validLine: validLine ? validLine.trim() : null, rdfError, trusty: !!validLine && /^Valid and trusty: /.test(validLine), issues, summary };
}
function parses(file) { try { return { parsed: true, quads: new Parser({ format: 'application/trig' }).parse(fs.readFileSync(file, 'utf8')).length }; } catch (e) { return { parsed: false, parseError: String(e.message).slice(0, 300) }; } }

const files = fs.readdirSync(dir).filter(f => f.endsWith('.trig')).sort();
if (files.length === 0) { console.error('no drafts in ' + dir); process.exit(2); }

// Self-test first: a truncated copy of a real record must be judged invalid by both checks, or the
// checker itself is broken and nothing is reported.
// Second fixture: a copy of a real record whose pubinfo dct:description quotes the tool's own error
// strings, with "Summary: 1 errors;" on a line of its own so it prints at column 0 under DESCRIPTION.
// It must be judged VALID, or the checker is reading record content as tool output.
const selfTestDir = fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMP || '/tmp', 'np-selftest-'));
const src0 = fs.readFileSync(path.join(dir, files[0]), 'utf8');
const truncated = path.join(selfTestDir, 'truncated-' + files[0]);
fs.writeFileSync(truncated, src0.slice(0, 1500));
const quoting = path.join(selfTestDir, 'quoting-' + files[0]);
if (!src0.includes('  this: dct:created ')) throw new Error('self-test fixture: expected "this: dct:created" in pubinfo of ' + files[0]);
fs.writeFileSync(quoting, src0.replace('  this: dct:created ', '  this: dct:description "RDF ERROR: quoted on purpose by the checker self-test.\\nSummary: 1 errors;\\nRDF ERROR: still a quotation, not a tool line." ;\n    dct:created '));
// Third fixture: a copy whose description carries a forged ISSUES section (real newlines in the literal,
// so "ISSUES:" and "- fake ..." lines print at column 0 under DESCRIPTION, before the validator's own
// section). It must be judged valid with exactly the genuine issues tallied and nothing matching "fake".
const baited = path.join(selfTestDir, 'baited-' + files[0]);
fs.writeFileSync(baited, src0.replace('  this: dct:created ', '  this: dct:description "Bait for the checker self-test.\\nISSUES:\\n- fake issue planted by the self-test\\n- fake issue two\\nSummary: 0 errors;" ;\n    dct:created '));
const st = { parse: parses(truncated), np: npCheck(truncated), qparse: parses(quoting), qnp: npCheck(quoting), bparse: parses(baited), bnp: npCheck(baited), genuine: npCheck(path.join(dir, files[0])) };
fs.rmSync(selfTestDir, { recursive: true, force: true });
const selfTest = {
  truncated: { file: `truncated copy of ${files[0]} (1500 bytes)`, parseRejected: !st.parse.parsed, npRejected: st.np.rdfError && !st.np.validLine, npExitCode: st.np.exitCode, npSummary: st.np.summary },
  quoting: { file: `copy of ${files[0]} whose dct:description quotes "RDF ERROR:" and "Summary: 1 errors;" at column 0`, parsed: st.qparse.parsed, npValid: !!st.qnp.validLine && !st.qnp.rdfError, npExitCode: st.qnp.exitCode, npSummary: st.qnp.summary },
  baited: { file: `copy of ${files[0]} whose dct:description carries a forged "ISSUES:" section with two "- fake" entries at column 0`, parsed: st.bparse.parsed, npValid: !!st.bnp.validLine && !st.bnp.rdfError, issuesTallied: st.bnp.issues.length, genuineIssues: st.genuine.issues.length, fakeTallied: st.bnp.issues.filter(i => /fake/.test(i)).length }
};
// Set equality with the same record unbaited, not just equal counts and no "fake": a planted line that
// copies a genuine issue is the case that hides a real one, and only equality rules it out (Organism).
selfTest.baited.setEqual = st.bnp.issues.length === st.genuine.issues.length && [...st.bnp.issues].sort().every((x, i) => x === [...st.genuine.issues].sort()[i]);
selfTest.baited.ok = selfTest.baited.parsed && selfTest.baited.npValid && selfTest.baited.fakeTallied === 0 && selfTest.baited.setEqual && selfTest.baited.genuineIssues > 0;
selfTest.ok = selfTest.truncated.parseRejected && selfTest.truncated.npRejected && selfTest.quoting.parsed && selfTest.quoting.npValid && selfTest.baited.ok;
console.log(`self-test, truncated record: parse ${selfTest.truncated.parseRejected ? 'rejected' : 'ACCEPTED'}, np check ${selfTest.truncated.npRejected ? 'rejected' : 'ACCEPTED'} (exit code ${selfTest.truncated.npExitCode}, "${selfTest.truncated.npSummary}")`);
console.log(`self-test, record quoting error strings in its description: parse ${selfTest.quoting.parsed ? 'ok' : 'FAILED'}, np check ${selfTest.quoting.npValid ? 'valid' : 'FAILED'} ("${selfTest.quoting.npSummary}")`);
console.log(`self-test, record with a forged ISSUES section: np check ${selfTest.baited.npValid ? 'valid' : 'FAILED'}, ${selfTest.baited.issuesTallied} issue(s) tallied vs ${selfTest.baited.genuineIssues} genuine, ${selfTest.baited.fakeTallied} fake tallied -> ${selfTest.baited.ok ? 'ok' : 'FAILED'}`);
if (!selfTest.ok) { console.error('checker self-test FAILED (a broken record judged valid, a quoting record judged broken, or a forged ISSUES section tallied); refusing to report'); fs.writeFileSync(path.join(here, 'check.json'), JSON.stringify({ summary: { run: new Date().toISOString(), allOk: false, selfTest }, results: [] }, null, 1)); process.exit(1); }

const results = [];
for (const f of files) {
  const file = path.join(dir, f);
  const r = { file: `lean/nanopubs/unsigned/${f}`, ...parses(file) };
  r.npCheck = npCheck(file);
  r.ok = r.parsed && !!r.npCheck.validLine && !r.npCheck.rdfError;
  results.push(r);
  console.log(`${f}: parse ${r.parsed ? 'ok' : 'FAILED'}; np check ${r.ok ? 'valid' : 'FAILED'}${r.npCheck.issues.length ? ` (${r.npCheck.issues.length} note(s))` : ''}`);
}
const summary = { run: new Date().toISOString(), tool: `nanopub-java ${jarVersion} check -v (exit code ignored; verdict read from the header region of the per-file block only) + n3 TriG parse`, selfTest, files: results.length, parsed: results.filter(r => r.parsed).length, npValid: results.filter(r => r.ok).length, trusty: results.filter(r => r.npCheck.trusty).length, allOk: selfTest.ok && results.length > 0 && results.every(r => r.ok) };
fs.writeFileSync(path.join(here, 'check.json'), JSON.stringify({ summary, results }, null, 1));
console.log(JSON.stringify(summary));
if (!summary.allOk) process.exitCode = 1;
