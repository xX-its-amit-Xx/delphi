#!/usr/bin/env node
// Builds dashboard/public/claimbook.json: one record per claim joining everything we know about it —
// the original sentence and its source, what the data said, what Lean proved, the English the prover
// wrote beside each step, the mutations that must fail, and the independent faithfulness verdict.
//
// The English explanations are not generated here. They are the doc comments the Lean thread wrote
// above each declaration, extracted verbatim, so the page shows the prover's own words.
//   node dashboard/build-claimbook.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const R = p => { try { return fs.readFileSync(path.join(root, p), 'utf8').split(String.fromCharCode(13)).join(''); } catch { return null; } };
const J = p => { const t = R(p); try { return t ? JSON.parse(t) : null; } catch { return null; } };

const lean = J('dashboard/public/t/lean/lean.json');

// ---- pull every declaration out of a Lean module with the doc comment above it ----
function declarations(src, file) {
  if (!src) return [];
  const out = [];
  const lines = src.split('\n');
  let doc = null, docStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\/--/.test(l)) {                                  // start of a doc comment
      docStart = i;
      const buf = [];
      let j = i;
      for (; j < lines.length; j++) {
        buf.push(lines[j].replace(/^\/--\s?/, '').replace(/\s*-\/$/, ''));
        if (/-\/\s*$/.test(lines[j])) break;
      }
      doc = buf.join('\n').trim();
      i = j;
      continue;
    }
    const m = l.match(/^(theorem|lemma|def|noncomputable def|structure)\s+([A-Za-z_][A-Za-z0-9_.']*)/);
    if (m) {
      // the body runs to the next blank line followed by a non-indented line
      const body = [];
      let j = i;
      for (; j < lines.length; j++) {
        body.push(lines[j]);
        const next = lines[j + 1];
        if (next !== undefined && next.trim() === '' && (lines[j + 2] === undefined || /^\S/.test(lines[j + 2]))) break;
        if (body.length > 60) break;
      }
      out.push({
        kind: m[1], name: m[2], file,
        line: i + 1, docLine: doc ? docStart + 1 : null,
        english: doc, source: body.join('\n').trimEnd()
      });
      doc = null;
      i = j;
    } else if (l.trim() !== '' && doc && !/^\s/.test(l)) {
      doc = null;                                           // doc comment that attached to nothing we parse
    }
  }
  return out;
}

const modules = ['Kimura', 'Favored', 'Fisher', 'MaynardSmith'];
const decls = [];
for (const m of modules) {
  const f = `lean/Delphi/${m}.lean`;
  decls.push(...declarations(R(f), f));
}

// module headers are the plain-English introduction to each law
const headers = {};
for (const m of modules) {
  const src = R(`lean/Delphi/${m}.lean`) || '';
  const h = src.match(/^\/-\n([\s\S]*?)\n-\//);
  if (h) headers[`lean/Delphi/${m}.lean`] = h[1].trim();
}

// ---- find a claim's data test, ours or the collaborator's ----
const testIndex = [];
const ctRoot = path.join(root, 'claim-tests');
if (fs.existsSync(ctRoot)) {
  for (const proj of fs.readdirSync(ctRoot, { withFileTypes: true })) {
    if (!proj.isDirectory() || ['assessment', 'nanopubs'].includes(proj.name)) continue;
    for (const t of fs.readdirSync(path.join(ctRoot, proj.name), { withFileTypes: true })) {
      if (!t.isDirectory()) continue;
      const rel = `claim-tests/${proj.name}/${t.name}`;
      const res = J(`${rel}/result.json`);
      if (!res) continue;
      testIndex.push({
        dir: rel, claim_id: res.claim_id || t.name, verdict: res.verdict, status: res.status,
        hypothesis: res.hypothesis, pass: res.pass_criterion, fail: res.fail_criterion,
        measured: res.measured || null,
        datasets: (res.datasets || []).map(d => ({ id: d.id || d.name, url: d.url || null, retrieved: d.retrieved_at || null, sha256: d.sha256 || null })),
        caveats: res.caveats || [],
        interpretation: res.interpretation || null,
        faithfulness: J(`${rel}/faithfulness.json`),
        openresearch: J(`${rel}/openresearch.json`) ? true : false
      });
    }
  }
}

// ---- join ----
const claims = (lean?.formalized || []).map(f => {
  const mine = testIndex.filter(t => (t.claim_id || '').startsWith(f.claim_id.split('--')[0]));
  const related = decls.filter(d => d.name === f.theorem || d.name === f.theorem.replace(/^Delphi\./, '')
    || (f.proofScope?.dependsOn || []).includes(d.name));
  // the named theorem, plus every declaration in the same module (the proof's supporting cast)
  const inModule = decls.filter(d => d.file === f.module);
  const named = inModule.find(d => f.theorem.endsWith(d.name)) || related[0] || null;
  return {
    claim_id: f.claim_id,
    label: f.label,
    statement: f.statement,
    notation: f.notation,
    context: f.context,
    paper: f.paper,
    lean: {
      theorem: f.theorem, module: f.module, status: f.status,
      header: headers[f.module] || null,
      named: named ? { name: named.name, line: named.line, english: named.english, source: named.source } : null,
      supporting: inModule.filter(d => d !== named && d.english).slice(0, 14)
        .map(d => ({ kind: d.kind, name: d.name, line: d.line, english: d.english, source: d.source })),
      proofScope: f.proofScope || null,
      mutations: (f.mutations || []).map(m => ({ id: m.id, description: m.description, outcome: m.outcome })),
      faithfulness: f.faithfulness, verdicts: f.verdicts || [], assessmentComplete: f.assessmentComplete
    },
    dataTests: mine
  };
});

// claims with a data test but no Lean proof, so the page can show both directions of the gap
const formalizedIds = new Set(claims.map(c => c.claim_id));
const testedOnly = testIndex.filter(t => !formalizedIds.has(t.claim_id))
  .map(t => ({ claim_id: t.claim_id, verdict: t.verdict, dir: t.dir, measured: t.measured, faithfulness: t.faithfulness }));

const out = {
  builtAt: new Date().toISOString(),
  note: 'English explanations are the Lean author\'s own doc comments, extracted verbatim from the source. Nothing on this page is paraphrased by the dashboard.',
  counts: {
    formalized: claims.length,
    withDataTest: claims.filter(c => c.dataTests.length).length,
    testedButNotFormalized: testedOnly.length,
    declarationsExtracted: decls.length
  },
  claims, testedOnly
};
fs.writeFileSync(path.join(here, 'public/claimbook.json'), JSON.stringify(out, null, 1));
console.log(`claimbook.json: ${claims.length} formalized claims, ${out.counts.withDataTest} of them with a data test, ${testedOnly.length} tested but not formalized`);
for (const c of claims) {
  console.log(`  ${c.claim_id}: lean ${c.lean.named ? 'source ok' : 'NO SOURCE'} (${c.lean.supporting.length} supporting), ${c.dataTests.length} data test(s)${c.dataTests[0] ? ' -> ' + c.dataTests[0].verdict : ''}`);
}
