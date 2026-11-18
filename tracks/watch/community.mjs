#!/usr/bin/env node
// Stage 3 of the paper watcher: turn the checked extractions into things other scientists can use.
//
//   node tracks/watch/community.mjs
//
// Writes, from the committed watcher files only (no network):
//   studio-live/tracks/alphaxiv/data.json     what the public page shows (laws, checked papers, lists)
//   studio-live/tracks/alphaxiv/feed.xml      an Atom feed: one entry per checked or nearly-checkable paper
//   studio-live/tracks/alphaxiv/stubs/*.lean  a starter Lean file for every "law wanted"
//   tracks/watch/community/digest.md          this week's post for a Community, ready to paste
//   tracks/watch/community/comments/*.md      one ready-to-paste comment per checked paper
// Nothing is posted anywhere. Posting is a person's decision.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SITE = 'https://delphi-mission-control.ashenoy000.workers.dev/blueprint3d/studio-live/tracks';
const PUB = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/tracks/alphaxiv');
const OUT = path.join(HERE, 'community');
const J = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const cfg = J('usecases.json'), sum = J('summary.json'), papers = J('extractions.json').papers;
const queue = fs.readFileSync(path.join(HERE, 'queue.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const qBy = new Map(queue.map((q) => [q.key, q]));
const scrub = (s) => String(s ?? '').replace(/[A-Z]:[\\/]Users[\\/][^\\/"\s]+/g, '<home>');
const xml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (p) => (p.arxiv_id ? `https://arxiv.org/abs/${p.arxiv_id}` : p.doi ? `https://doi.org/${p.doi}` : null);
const ucTitle = Object.fromEntries(cfg.usecases.map((u) => [u.id, u.title]));
const instances = Object.fromEntries((fs.existsSync(path.join(HERE, 'lean/WatchInstances.lean')) ? fs.readFileSync(path.join(HERE, 'lean/WatchInstances.lean'), 'utf8') : '')
  .split(/\r?\n/).map((l) => l.match(/^theorem (\S+) : (.*) := by norm_num$/)).filter(Boolean).map((m) => [`Watch.${m[1]}`, m[2]]));

const pub = (p) => ({ slug: p.slug, title: p.title, usecase: p.usecase, usecase_title: ucTitle[p.usecase] ?? p.usecase, link: link(p), alphaxiv: p.alphaxiv ?? null, doi: p.doi ?? null,
  arxiv_id: p.arxiv_id ?? null, preprint: !!p.preprint, published: p.published ?? null, read: p.read ?? null, back_catalogue: qBy.get(p.key)?.status === 'seed' });

// 1. checked papers, with every check and the sentence each number came from
const checked = papers.filter((p) => p.badge).map((p) => ({ ...pub(p), badge: p.badge, second_reader: p.second_reader ?? null,
  checks: p.checks.filter((c) => c.result !== 'refused').map((c) => ({ label: c.label, law: c.law, says: c.says ?? cfg.laws[c.law]?.says, result: c.result, theorem: c.theorem ?? null,
    prop: c.theorem ? instances[c.theorem] ?? null : null, detail: c.detail ?? null, by: c.by ?? (c.theorem ? 'Lean kernel' : null), quotes: (c.quotes ?? []).slice(0, 2), note: scrub(c.note ?? '') || null })) }));
// 2. the law breakers: every check that came out outside the law
const breakers = checked.flatMap((p) => p.checks.filter((c) => c.result === 'outside').map((c) => ({ paper: p.title, slug: p.slug, link: p.link, label: c.label, law: c.law, says: c.says, by: c.by })));
// 3. one number short: relevant papers where at least one input a law needs was not printed
const short = papers.filter((p) => p.outcome === 'partial_inputs' || p.outcome === 'numbers_only_in_figure').map((p) => ({ ...pub(p), missing: p.missing ?? [], why: p.why ?? '', outcome: p.outcome }));
// 4. laws wanted: regularities papers report that no law of ours covers, each with a starter Lean file
fs.rmSync(path.join(PUB, 'stubs'), { recursive: true, force: true }); fs.mkdirSync(path.join(PUB, 'stubs'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'comments'), { recursive: true });
const wanted = [];
for (const p of papers) for (const c of p.candidate_laws ?? []) {
  const n = wanted.length + 1, file = `wanted-${String(n).padStart(2, '0')}.lean`;
  const vars = (c.quantities ?? []).map((q, i) => `  -- x${i + 1} : ${String(q).replace(/\s+/g, ' ')}`).join('\n');
  fs.writeFileSync(path.join(PUB, 'stubs', file), `import Mathlib
/-!
# Law wanted ${n}

Statement, in the paper's terms:
  ${String(c.statement).replace(/\s+/g, ' ').replace(/-\//g, '- /')}

Source: ${p.title} (${link(p) ?? p.key})
Where: ${String(c.where ?? '').replace(/-\//g, '- /')}
Quote: "${String(c.quote ?? '').replace(/\s+/g, ' ').replace(/-\//g, '- /')}"

Quantities:
${vars || '  -- (none listed)'}

What to do: replace \`True\` below with the statement as a proposition over real numbers, state every
assumption as a hypothesis, and prove it or say which assumption fails. A file counts only when
\`bash tracks/lean/check.sh <file>\` prints ALL CHECKED (no sorry, no new axioms).
-/
namespace LawWanted${n}

/-- TODO: the law as a proposition. -/
def Statement : Prop := True

theorem statement_holds : Statement := trivial

end LawWanted${n}
`);
  wanted.push({ n, statement: c.statement, quantities: c.quantities ?? [], quote: c.quote ?? null, where: c.where ?? null, paper: p.title, link: link(p), usecase_title: ucTitle[p.usecase] ?? p.usecase, stub: `stubs/${file}` });
}
// 5. the laws a visitor can try their own numbers on (everything with a closed-form inequality)
const laws = Object.entries(cfg.laws).filter(([, L]) => L.lhs).map(([id, L]) => ({ id, says: L.says, inputs: L.inputs, parts: [[L.lhs, L.rhs], ...(L.lhs2 ? [[L.lhs2, L.rhs2]] : [])], kind: L.kind, general_theorem: L.general_theorem }));

const week = new Date().toISOString().slice(0, 10);
const data = { made_by: 'tracks/watch/community.mjs', built: week, site: SITE, summary: { sentence: sum.sentence, reasons: sum.reasons, by_source: sum.by_source ?? [], by_usecase: sum.by_usecase, caveat: sum.caveat, found: sum.found, checked: sum.checked },
  laws, checked, breakers, short, wanted, repo_issues: 'https://github.com/fractastical/delphi/issues/new' };
fs.mkdirSync(PUB, { recursive: true });
fs.writeFileSync(path.join(PUB, 'data.json'), JSON.stringify(data, null, 1) + '\n');

// ---- feed ----
const entries = [...checked.map((p) => ({ id: `checked-${p.slug}`, title: `Checked: ${p.title} (${p.badge})`, href: `${SITE}/alphaxiv/#paper-${p.slug}`, text: `${p.checks.length} checks of the paper's printed numbers against Lean4Bio laws: ${p.badge}.`, date: p.published })),
  ...short.map((p) => ({ id: `short-${p.slug}`, title: `One number short: ${p.title}`, href: `${SITE}/alphaxiv/#short-${p.slug}`, text: `Could be checked if the paper also printed: ${p.missing.join('; ')}`, date: p.published }))];
fs.writeFileSync(path.join(PUB, 'feed.xml'), `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
 <title>Lean4Bio paper watch</title>
 <subtitle>New papers whose printed numbers were checked against laws stated in Lean 4, and papers one number short of being checkable.</subtitle>
 <link href="${SITE}/alphaxiv/"/>
 <link rel="self" href="${SITE}/alphaxiv/feed.xml"/>
 <id>${SITE}/alphaxiv/feed.xml</id>
 <updated>${week}T00:00:00Z</updated>
${entries.map((e) => ` <entry><title>${xml(e.title)}</title><link href="${xml(e.href)}"/><id>${SITE}/alphaxiv/#${e.id}</id><updated>${(e.date ?? week).slice(0, 10)}T00:00:00Z</updated><summary>${xml(e.text)}</summary></entry>`).join('\n')}
</feed>
`);

// ---- digest and comments (drafts; nothing is posted by this script) ----
const fresh = checked.filter((p) => !p.back_catalogue);
const digest = `# Lean4Bio paper watch, ${week}

${sum.sentence}

${sum.reasons.map((r) => `- ${r.n}: ${r.plain}`).join('\n')}

## Checked this round
${fresh.length ? fresh.map((p) => `- **${p.title}** (${p.link ?? ''}): ${p.badge}. Proof and quotes: ${SITE}/alphaxiv/#paper-${p.slug}`).join('\n') : '- none'}

## One number short
These papers are about the right thing but leave out a number a law needs. Authors or readers who know the value: tell us and we will run the check.
${short.length ? short.map((p) => `- **${p.title}** (${p.link ?? ''}). Missing: ${p.missing.join('; ')}`).join('\n') : '- none'}

## Laws wanted
Regularities these papers report that nobody has stated in Lean yet. Each has a starter file.
${wanted.length ? wanted.map((w) => `- ${w.statement} (from: ${w.paper}) ${SITE}/alphaxiv/${w.stub}`).join('\n') : '- none'}

## Try it
Type your own numbers and get the Lean theorem: ${SITE}/alphaxiv/#try

${sum.caveat}
`;
fs.writeFileSync(path.join(OUT, 'digest.md'), digest);
for (const p of checked) {
  const out = p.checks.filter((c) => c.result === 'outside').length;
  fs.writeFileSync(path.join(OUT, 'comments', `${p.slug}.md`), `We ran the numbers printed in this paper through ${new Set(p.checks.map((c) => c.law)).size === 1 ? 'a law' : 'laws'} stated in Lean 4 (Lean4Bio). Result: ${p.badge}${out ? `; ${out} ${out === 1 ? 'record sits' : 'records sit'} outside the law, which is the interesting part` : ''}.

What was checked: ${[...new Set(p.checks.map((c) => c.says))].join(' ')}

Every number, the sentence it was copied from, and the machine-checked statement: ${SITE}/alphaxiv/#paper-${p.slug}

This is arithmetic on numbers a reader agent copied from the text. It is not a review and it certifies nothing. If we copied a number wrongly, please say so and we will correct it.
`);
}
console.log(`community: ${checked.length} checked papers, ${breakers.length} checks outside a law, ${short.length} one number short, ${wanted.length} laws wanted, ${entries.length} feed entries`);
