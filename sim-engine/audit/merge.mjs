// Merge sidecar-{A,B,C,D}.json onto a fresh parse of the CURRENT modules.
// Usage: node merge.mjs <scratch> <repoRoot>
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const [SCR, ROOT] = process.argv.slice(2);
const parsedPath = path.join(SCR, 'parsed-final.json');
execFileSync(process.execPath, [path.join(SCR, 'tool/parse.mjs'), ROOT, parsedPath], { stdio: 'inherit' });
const P = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));
const side = [];
for (const g of ['A', 'B', 'C', 'D', 'E']) {
  const f = path.join(SCR, `sidecar-${g}.json`);
  if (fs.existsSync(f)) for (const e of JSON.parse(fs.readFileSync(f, 'utf8'))) side.push({ ...e, _group: g });
}
const norm = f => f.replace(/\\/g, '/').replace(/^.*?sim-engine\//, 'sim-engine/');
const near = (a, b) => Math.abs(Math.abs(a) - Math.abs(b)) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
const used = new Set();
function find(r) {
  const cands = side.map((e, i) => [e, i]).filter(([e]) => norm(e.file) === r.file && typeof e.value === 'number' && near(e.value, r.value));
  if (!cands.length) return null;
  const exact = cands.filter(([e]) => e.name === r.name);
  const dist = e => Math.min(...(e.lines || [1e9]).map(l => Math.abs(l - r.line)));
  const pool = exact.length ? exact : cands.filter(([e]) => dist(e) <= 12);
  if (!pool.length) return null;
  pool.sort((x, y) => Math.min(...(x[0].lines || [1e9]).map(l => Math.abs(l - r.line))) - Math.min(...(y[0].lines || [1e9]).map(l => Math.abs(l - r.line))));
  used.add(pool[0][1]);
  return { e: pool[0][0], how: exact.length ? 'file+name+value' : 'file+value (name changed since review)' };
}
const records = P.records.map(r => {
  const m = find(r);
  const base = { file: r.file, line: r.line, name: r.name, value: r.value, unit: r.unit, kind: r.kind, code: r.code,
    current_citation: r.current_citation, status: r.status };
  if (!m) return { ...base, proposed: null, verdict: 'unreviewed', rationale: 'constant appeared after the sourcing pass (owner edit); not yet reviewed', kind_flag: null };
  const e = m.e;
  return { ...base, status: e.status || r.status, current_citation: e.current_citation || r.current_citation,
    proposed: e.proposed || null, verdict: e.verdict, corrected_value: e.corrected_value ?? null, rationale: e.rationale || null,
    kind_flag: e.kind_flag || null, repo_chain: e.repo_chain || [], fetched_via: e.fetched_via || null, matched_by: m.how };
});
const orphans = side.filter((e, i) => !used.has(i)).map(({ _group, ...e }) => e);
const count = (xs, k) => xs.reduce((a, x) => ((a[x[k]] = (a[x[k]] || 0) + 1), a), {});
const out = {
  generated: new Date().toISOString(),
  method: 'Every numeric literal in code (strings and comments stripped) of sim-engine/scenarios/*.mjs and sim-engine/lib/state.mjs, plus every params default/min/max (including 0 and 1). Years and the harness unit-conversion set (0,1,2,3,4,10,100,1000,9.81,60,3600,24,273.15,101325,0.5, powers of ten) are skipped outside params. status = what the module carries today within 3 lines (url/DOI/PMC, author-year, repo-file, none). proposed = the primary source found by GET of Europe PMC / Crossref / the URL itself. verdict: confirmed (value seen in fetched text, quote given), corrected (source gives a different value), design-choice (modelling choice: label it, never kind measured), unverified (real citation, full text not fetchable), unsourceable (empirical, no source found), unreviewed (constant added after the sourcing pass).',
  harness_line_counts_before: { constant_lines: 159, url: 25, author_year_or_repo_file: 89, none: 45, source: 'sim-engine/validation/STUDIO-FINDINGS.md, Source audit (part 3)' },
  this_parse_line_counts: P.perFile,
  counts: { records: records.length, status_before: count(records, 'status'), verdict: count(records, 'verdict'),
    kind_flags: records.filter(r => r.kind_flag).length },
  records, orphaned_review_entries: orphans,
};
fs.writeFileSync(path.join(ROOT, 'sim-engine/scenarios/CONSTANTS-AUDIT.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.counts), 'orphans', orphans.length);
