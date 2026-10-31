#!/usr/bin/env node
// Builds the blinded assessment inputs: for each formalized claim, the claim text from
// key-claims.json plus the Lean theorem's docstring and statement and the definitions it uses,
// read from the module source. Writes lean/assessment/inputs.json. Nothing about the proof or
// the module header (the builder's own explanation) is included.
//   node lean/assessment/build-inputs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const report = JSON.parse(fs.readFileSync(path.join(root, 'dashboard/public/t/lean/lean.json'), 'utf8'));
const key = JSON.parse(fs.readFileSync(path.join(root, 'math-bio-theorems/claims/key-claims.json'), 'utf8')).claims;

// Pull a declaration's docstring + full text (to the first blank line) from a module.
function decl(text, name) {
  const lines = text.split(/\r?\n/);
  const short = name.split('.').pop();
  const i = lines.findIndex(l => new RegExp(`^(noncomputable )?(theorem|lemma|def|structure) ${short.replace(/'/g, "'")}\\b`).test(l));
  if (i < 0) return null;
  let s = i; if (i > 0 && lines[i - 1].trim().endsWith('-/')) { s = i - 1; while (s > 0 && !lines[s].includes('/--')) s--; }
  let e = i; while (e < lines.length && lines[e].trim() !== '') e++;
  return lines.slice(s, e).join('\n');
}
// Statement only (docstring + lines up to `:=`), so the proof is never shown.
function stmt(text, name) {
  const d = decl(text, name); if (!d) return null;
  const out = []; for (const l of d.split('\n')) { out.push(l); if (/:=\s*(by)?\s*$/.test(l) || /\bwhere\s*$/.test(l)) break; }
  return out.join('\n').replace(/\s*:=\s*(by)?\s*$/, '').replace(/\s+where\s*$/, '');
}

const defsFor = {
  'Delphi.neutral_substitution_rate': ['NeutralChain', 'fixedBy', 'fixationProbability', 'wfKernel', 'wrightFisher', 'oneCopy', 'substitutionRate'],
  'Delphi.NeutralChain.fixedBy_tendsto': ['NeutralChain', 'fixedBy'],
  'Delphi.fisher_fundamental_theorem': ['meanFitness', 'variance', 'select', 'IsFreq'],
  'Delphi.twofold_cost_of_sex': ['asexualNext', 'odds']
};

const inputs = report.formalized.map(f => {
  const text = fs.readFileSync(path.join(root, f.module), 'utf8');
  const c = key.find(k => k.id === f.claim_id);
  const defs = (defsFor[f.theorem] || []).map(n => decl(text, n)).filter(Boolean)
    // `wrightFisher` is the one definition whose fields are proofs: show only its kernel, never the proofs.
    .map(d => d.includes('def wrightFisher') ? d.split('\n').filter(l => /^(\/--|noncomputable def wrightFisher|  P := )/.test(l)).join('\n') + '\n  -- remaining fields: the proofs that wfKernel satisfies the NeutralChain axioms (omitted)' : d);
  return {
    claim_id: f.claim_id, label: c.label, statement: c.statement, notation: c.notation, context: c.context,
    paper_title: c.paper?.title, paper_year: c.paper?.year, paper_doi: c.paper?.doi ? `, doi:${c.paper.doi}` : '',
    theorem: f.theorem, module: f.module,
    lean_docstring_and_statement: stmt(text, f.theorem),
    lean_definitions: defs.join('\n\n')
  };
});
fs.writeFileSync(path.join(here, 'inputs.json'), JSON.stringify(inputs, null, 1));
const tpl = fs.readFileSync(path.join(here, 'prompt.md'), 'utf8');
fs.mkdirSync(path.join(here, 'prompts'), { recursive: true });
for (const r of inputs) fs.writeFileSync(path.join(here, 'prompts', r.claim_id + '.md'), tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(r[k] ?? '')));
console.log(`inputs.json: ${inputs.length} claims; prompts/ written`);
