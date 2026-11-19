#!/usr/bin/env node
// Audit somebody else's Lean file — including our own — and say what the kernel actually accepted.
//
//   node tracks/kernel/audit-lean.mjs <file.lean | https://...raw...>  [--out <dir>] [--json]
//
// Why this exists. "Machine-checked, 0 sorry" is the claim every formalisation project makes, and it
// is not checkable from a file that never asks Lean to print its axioms. Three different things can
// be true of such a file:
//
//   (a) the theorems are fine and nobody can tell          <- the common case, and it is a shame
//   (b) a `sorry` is in there and Lean only warned about it <- happened in this repo
//   (c) a result is assumed with a hand-written `axiom`     <- passes any "no sorry" grep
//
// So this tool does not grep. It appends one `#print axioms` line per theorem to a COPY, runs the
// repo's strict checker over both, and reports the two verdicts side by side. The copy is written to
// a scratch directory; the audited file is never written back over the original, and the original is
// never modified.
//
// What it deliberately does NOT record: any prose, comment, identifier or organism name from the
// audited file, beyond the names of declarations that FAILED. Third-party corpora name species, and
// this repo holds a clade out of its training on purpose; the report is counts, hashes and verdicts
// so that auditing a stranger's file cannot leak the held-out roster into our tree. Failed
// declaration names are screened against the roster and redacted if they match.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { realLeanCheck, ROOT } from './kernel.mjs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const JSON_OUT = process.argv.includes('--json');
const target = process.argv[2];
if (!target || target.startsWith('--')) { console.error('usage: node tracks/kernel/audit-lean.mjs <file.lean | url> [--out <dir>] [--json]'); process.exit(2); }

const SCRATCH = arg('--out', path.join(process.env.TEMP ?? os.tmpdir(), 'delphi-lean-audit'));
fs.mkdirSync(SCRATCH, { recursive: true });

// ---------------------------------------------------------------------------------------------------
// fetch or read. A downloaded file is untrusted data: it goes in its own directory and is only ever
// read, never executed, and the Lean toolchain is pointed at it by absolute path.

let src, origin;
if (/^https?:\/\//.test(target)) {
  const dl = path.join(SCRATCH, 'downloaded', path.basename(new URL(target).pathname) || 'file.lean');
  fs.mkdirSync(path.dirname(dl), { recursive: true });
  const r = spawnSync('curl', ['-sL', '-m', '60', '-A', 'research-client/1.0', '-o', dl, '-w', '%{http_code}', target], { encoding: 'utf8' });
  if (r.stdout.trim() !== '200') { console.error(`could not fetch (HTTP ${r.stdout.trim()}): ${target}`); process.exit(1); }
  src = fs.readFileSync(dl, 'utf8');
  origin = { kind: 'url', ref: target, saved_to: dl };
} else {
  const abs = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
  src = fs.readFileSync(abs, 'utf8');
  origin = { kind: 'file', ref: path.relative(ROOT, abs).split(path.sep).join('/') };
}

const sha = crypto.createHash('sha256').update(src, 'utf8').digest('hex');

// ---------------------------------------------------------------------------------------------------
// what the file says about itself

const decls = [...src.matchAll(/^\s*(?:private\s+|protected\s+)?(theorem|lemma)\s+([A-Za-z_][\w'!?]*)/gm)].map((m) => ({ kw: m[1], name: m[2] }));
const names = [...new Set(decls.map((d) => d.name))];
const namespaces = [...src.matchAll(/^namespace\s+([A-Za-z_][\w.]*)/gm)].map((m) => m[1]);
const prefix = namespaces.length ? namespaces.join('.') + '.' : '';
const counts = {
  lines: src.split('\n').length,
  bytes: Buffer.byteLength(src),
  theorems: decls.filter((d) => d.kw === 'theorem').length,
  lemmas: decls.filter((d) => d.kw === 'lemma').length,
  distinct_declarations: names.length,
  axiom_declarations: (src.match(/^\s*axiom\s+/gm) ?? []).length,
  print_axioms_lines: (src.match(/^#print axioms/gm) ?? []).length,
  sorry_occurrences: (src.match(/\bsorry\b/g) ?? []).length,
  sorry_outside_comments: (src.replace(/\/-[\s\S]*?-\//g, ' ').replace(/--[^\n]*/g, ' ').match(/\bsorry\b/g) ?? []).length,
  imports: [...new Set([...src.matchAll(/^import\s+(\S+)/gm)].map((m) => m[1]))],
};

// ---------------------------------------------------------------------------------------------------
// the audited copy, and the two verdicts

const auditedPath = path.join(SCRATCH, path.basename(origin.ref).replace(/\.lean$/, '') + '.Audited.lean');
fs.writeFileSync(auditedPath, `${src}\n\n-- ===== ${names.length} axiom-audit line(s) appended by tracks/kernel/audit-lean.mjs. Not in the original. =====\n${names.map((n) => `#print axioms ${prefix}${n}`).join('\n')}\n`);

const asIs = realLeanCheck(path.isAbsolute(origin.saved_to ?? target) ? (origin.saved_to ?? target) : path.join(process.cwd(), target));
const audited = realLeanCheck(auditedPath);

// Declaration names only matter when one FAILS, and even then they are screened: a third-party corpus
// may name a species this repo is blind to by design.
let heldWords = [];
try {
  const split = JSON.parse(fs.readFileSync(path.join(ROOT, 'holdout/split.json'), 'utf8'));
  heldWords = (split.taxa ?? []).filter((t) => t.assignment === 'holdout')
    .flatMap((t) => [t.name, t.slug, ...(t.name ? t.name.split(/\s+/) : [])])
    .filter((w) => w && String(w).length > 3).map((w) => String(w).toLowerCase());
} catch { heldWords = []; }
const screen = (s) => heldWords.some((w) => String(s).toLowerCase().includes(w)) ? '[withheld: matches the held-out roster]' : s;

const failedLines = (audited.verdict === 'CHECKED' ? [] : (audited.detail ? [audited.detail] : [])).map(screen);

const report = {
  audited_by: 'tracks/kernel/audit-lean.mjs',
  at: new Date().toISOString(),
  origin,
  sha256: sha,
  counts,
  claim_in_the_file: {
    says_zero_sorry: /zero\s+`?sorry|0\s+`?sorry|no\s+`?sorry/i.test(src),
    note: 'A file can say this truthfully and still be unverifiable from its own contents. The two verdicts below are what settle it.',
  },
  verdict_as_published: { verdict: asIs.verdict, detail: screen(asIs.detail ?? ''), toolchain: asIs.toolchain, audited_declarations: asIs.audited },
  verdict_with_audit_added: { verdict: audited.verdict, detail: failedLines.join(' '), toolchain: audited.toolchain, audited_declarations: audited.audited, axioms: audited.axioms, axioms_are: audited.axioms_are },
  conclusion: audited.verdict === 'CHECKED' && asIs.verdict !== 'CHECKED'
    ? `The proofs hold: all ${names.length} declaration(s) were accepted with axioms within [${audited.axioms.join(', ')}]. The file as published could not show that, because it asks for no axiom audit. The claim is true and was not checkable; adding ${names.length} line(s) makes it checkable.`
    : audited.verdict === 'CHECKED' && asIs.verdict === 'CHECKED'
      ? 'The file as published is already auditable and the kernel accepts it. Nothing to add.'
      : `The audited copy was NOT accepted. Something in this file does not hold, or does not hold for the reason the file states. See the detail above.`,
  what_this_does_not_say: [
    'Nothing here says the theorems are the right theorems. A statement can be kernel-valid and say nothing: hypotheses that contradict each other prove anything, and no script catches that (tracks/lean/probes/ProbeVacuous.lean exists to make the point).',
    'Nothing here checks that the formal statement matches the biology it is named after. That needs a reader.',
    'Only declaration names were used. No prose, comment or identifier from the audited file is reproduced in this report.',
  ],
  audited_copy: auditedPath,
};

const outFile = path.join(SCRATCH, path.basename(origin.ref).replace(/\.lean$/, '') + '.audit.json');
fs.writeFileSync(outFile, JSON.stringify(report, null, 1) + '\n');

if (JSON_OUT) console.log(JSON.stringify(report, null, 1));
else {
  console.log(`audited  ${origin.ref}`);
  console.log(`         sha256 ${sha.slice(0, 16)}...  ${counts.lines} lines, ${counts.theorems} theorem(s) + ${counts.lemmas} lemma(s), ${counts.imports.length} import(s)`);
  console.log(`         sorry: ${counts.sorry_outside_comments} outside comments (${counts.sorry_occurrences} including comments)   hand-written axioms: ${counts.axiom_declarations}   axiom-audit lines: ${counts.print_axioms_lines}`);
  console.log(`as published     ${report.verdict_as_published.verdict}  ${report.verdict_as_published.detail}`);
  console.log(`with audit added ${report.verdict_with_audit_added.verdict}  axioms [${audited.axioms.join(', ')}] (${audited.axioms_are})`);
  console.log(`\n${report.conclusion}`);
  console.log(`\nreport   ${outFile}`);
}
process.exit(audited.verdict === 'CHECKED' ? 0 : 1);
