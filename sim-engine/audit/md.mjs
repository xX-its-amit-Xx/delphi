// Write CONSTANTS-AUDIT.md from CONSTANTS-AUDIT.json. Usage: node md.mjs <repoRoot>
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'sim-engine/scenarios/CONSTANTS-AUDIT.json'), 'utf8'));
const R = J.records, short = f => f.replace('sim-engine/', '');
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const L = [];
L.push('# Constants audit of the studio scenario modules', '',
  `Generated ${J.generated} by re-parsing the module versions on disk at that time (owners were landing fixes; line numbers drift, match on file + name + value). Machine-readable sidecar: \`CONSTANTS-AUDIT.json\` (one record per constant). Sidecar only: no scenario module was edited.`, '');
const corr = R.filter(r => r.verdict === 'corrected').map(r => ({ ...r, sev: Math.abs(Number(r.corrected_value) - r.value) / Math.abs(r.value) > 0.05 ? 'substantive' : 'rounding' })).sort((a, b) => (a.sev > b.sev ? -1 : 1));
L.push(`## Corrections (wrong values): ${corr.length}`, '');
if (!corr.length) L.push('None found.');
else {
  L.push('Substantive = off by more than 5 %; rounding = the module value is a rounded version of the source value (fix, low priority).', '');
  L.push('| severity | file:line | constant | in module | source says | source, locator | quote |', '|---|---|---|---|---|---|---|');
  const seen = new Set();
  for (const r of corr) { const k = r.file + r.name + r.value; if (seen.has(k)) continue; seen.add(k);
    L.push(`| ${r.sev} | ${short(r.file)}:${r.line} | ${esc(r.name)} | ${r.value} | **${esc(r.corrected_value)}** | ${esc(r.proposed?.cite)} ${esc(r.proposed?.doi_or_url)}, ${esc(r.proposed?.locator)} | ${esc(r.proposed?.quote).slice(0, 240)} |`); }
}
L.push('');
L.push(...fs.readFileSync(new URL('./owner-notes.md', import.meta.url), 'utf8').split(/\r?\n/), '');
const kf = R.filter(r => r.kind_flag);
L.push(`## Kind labels to fix: ${kf.length}`, '', 'Design choices must never carry kind `measured`; empirical values must not overstate provenance.', '');
const seenK = new Set();
for (const r of kf) { const k = r.file + r.name + r.kind_flag; if (seenK.has(k)) continue; seenK.add(k); L.push(`- ${short(r.file)}:${r.line} \`${esc(r.name)}\` = ${r.value}: ${esc(r.kind_flag)}`); }
L.push('');
const c = J.counts, h = J.harness_line_counts_before;
L.push('## Counts', '',
  `**Before (harness, per line):** ${h.constant_lines} constant-bearing lines in the scenario modules: ${h.url} with a URL/DOI, ${h.author_year_or_repo_file} author-year or repo file only, ${h.none} nothing.`, '',
  `**This parse (per constant, ${c.records} records incl. lib/state.mjs and every param default/min/max):** status as found: ${Object.entries(c.status_before).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '',
  `**After this pass (verdicts):** ${Object.entries(c.verdict).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
const withUrl = R.filter(r => r.proposed && /https?:\/\/|10\.\d{4,}\//.test(String(r.proposed.doi_or_url || ''))).length;
L.push(`Records that now have a fetchable primary URL/DOI proposed: ${withUrl} of ${R.length}. Design choices are labelled with a one-line rationale instead of a source, which is legitimate as long as they are shown as assumed.`, '');
L.push('| file | records | confirmed | corrected | design-choice | unverified | unsourceable | unreviewed |', '|---|---|---|---|---|---|---|---|');
const files = [...new Set(R.map(r => r.file))];
for (const f of files) { const xs = R.filter(r => r.file === f), n = v => xs.filter(r => r.verdict === v).length;
  L.push(`| ${short(f)} | ${xs.length} | ${n('confirmed')} | ${n('corrected')} | ${n('design-choice')} | ${n('unverified')} | ${n('unsourceable')} | ${n('unreviewed')} |`); }
L.push('');
for (const [v, title] of [['unverified', 'Unverified (real citation, full text not fetchable)'], ['unsourceable', 'Unsourceable (empirical, no source found)'], ['unreviewed', 'Unreviewed (appeared after the sourcing pass)']]) {
  const xs = R.filter(r => r.verdict === v); if (!xs.length) continue;
  L.push(`## ${title}: ${xs.length}`, '');
  for (const r of xs) L.push(`- ${short(r.file)}:${r.line} \`${esc(r.name)}\` = ${r.value}: ${esc(r.rationale)}`);
  L.push('');
}
if (J.orphaned_review_entries?.length) L.push(`## Review entries whose constant is no longer in the module: ${J.orphaned_review_entries.length}`, '', 'These were reviewed on the earlier snapshot and have since been removed or changed by the owner (see `orphaned_review_entries` in the JSON).', '');
L.push('## How to apply', '', '1. Corrections first (table above): change the value and attach the quoted source.', '2. For each `confirmed` record whose module carries only an author-year or repo file, add `proposed.doi_or_url` and the locator next to the constant.', '3. For each `design-choice` record, label the parameter kind `assumed` (never `measured`) and paste the rationale into its `source`.', '4. Re-run `node <scratch>/tool/merge.mjs` (parser + merge) to refresh this file against the edited modules.', '');
fs.writeFileSync(path.join(ROOT, 'sim-engine/scenarios/CONSTANTS-AUDIT.md'), L.join('\n'));
console.log('md written', corr.length, 'corrections', kf.length, 'kind flags');
