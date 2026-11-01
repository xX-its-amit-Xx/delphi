#!/usr/bin/env node
// validate_generation on the command line.
//
//   node sim-engine/validate-cli.mjs "<desired phenotype text>" --base zebrafish-adult --generated <design-id|file>
//
// Flags:
//   --base <id|file>       the base organism: a design id, an organism-document JSON, or a FASTA/plain sequence
//   --generated <id|file>  the generated organism, same forms
//   --json                 print the whole report object instead of the human summary
//   --out <file>           write the whole report object to a file (and still print the summary)
//   --network              allow network lookups (Ensembl, for reconstructing sequence at edited loci)
//   --lawset <v>           Lean lawset version (default: current)
//   --no-ensemble          ask the physics module to skip its uncertainty ensemble (faster)
//
// It prints the verdict SENTENCE, the five gates, the per-scale coverage table, and the verbatim unparsed
// remainder of the desired-phenotype text. The exit code is 0 when every gate passed, 1 when any gate failed,
// and 2 when nothing failed but something could not be assessed -- so a "could not assess" never reads as a
// clean run in a shell.

import fs from 'node:fs';
import { validateGeneration } from './validate/pipeline/index.mjs';

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const has = n => argv.includes(`--${n}`);
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--json', '--network', '--no-ensemble'].includes(argv[i - 1])));

if (has('help') || (!positional.length && !flag('generated'))) {
  process.stdout.write(`validate_generation -- the unifying validator (Amit's signature, 2026-11-01)

  node sim-engine/validate-cli.mjs "<desired phenotype text>" --base <id|file> --generated <id|file>

  --base <id|file>       base organism (design id, organism-document JSON, or FASTA/plain sequence)
  --generated <id|file>  generated organism, same forms
  --json                 print the whole report object
  --out <file>           write the whole report object to a file
  --network              allow Ensembl lookups (only used when the design has gene-level edits)
  --lawset <v>           Lean lawset version
  --no-ensemble          skip the physics module's uncertainty ensemble

Example:
  node sim-engine/validate-cli.mjs "a zebrafish that glides at least 5 m from a 1 m launch and survives 10-30 C as an adult" \\
       --base zebrafish-adult --generated winged-zebrafish

Exit codes: 0 every gate passed, 1 a gate failed, 2 nothing failed but something could not be assessed.
`);
  process.exit(0);
}

const desired = positional[0] ?? '';
const r = await validateGeneration({
  generated: flag('generated'), base: flag('base') ?? 'zebrafish-adult', desired_phenotype: desired,
  opts: { network: has('network'), lawset: flag('lawset') ?? undefined, physics: { ensemble: !has('no-ensemble') }, ensemble: !has('no-ensemble') },
});

if (flag('out')) fs.writeFileSync(flag('out'), JSON.stringify(r, null, 1));

if (has('json')) { process.stdout.write(JSON.stringify(r, null, 1) + '\n'); }
else {
  const L = s => process.stdout.write(s + '\n');
  L('');
  L('=== validate_generation ' + r.version + ' ===');
  L('');
  L('INPUTS');
  L(`  desired phenotype : "${r.inputs.desired_phenotype.text ?? '(none)'}"`);
  L(`  parsed into       : ${r.inputs.desired_phenotype.criteria_parsed} criterion/criteria -- ${r.inputs.desired_phenotype.criteria.map(c => `${c.id} ${c.scenario}/${c.metric ?? c.op} ${c.op} ${c.value ?? ''}${c.unit ?? ''}`).join('; ')}`);
  L(`  generated         : ${r.inputs.generated.given} ${r.inputs.generated.supplied_as ?? ''}${r.inputs.generated.id ? ` (${r.inputs.generated.id})` : ''}`);
  L(`  base              : ${r.inputs.base.given} ${r.inputs.base.supplied_as ?? ''}${r.inputs.base.id ? ` (${r.inputs.base.id})` : ''}`);
  L(`  sequence basis    : ${r.inputs.sequence.sequence_basis}, ${r.inputs.sequence.loci_covered} locus/loci covered`);
  L(`                      ${r.inputs.sequence.statement}`);
  if (r.inputs.desired_phenotype.unparsed_verbatim.length) {
    L('');
    L('UNPARSED DESIRED-PHENOTYPE TEXT (an unparsed requirement is an UNCHECKED requirement)');
    for (const u of r.inputs.desired_phenotype.unparsed_verbatim) L(`  * "${u.text}"\n      ${u.reason}`);
  }
  if (r.inputs.desired_phenotype.refused_verbatim.length) {
    L('');
    L('REFUSED CLAUSES');
    for (const u of r.inputs.desired_phenotype.refused_verbatim) L(`  * "${u.text}"\n      ${u.reason}`);
  }
  L('');
  L(`DIFFERENCES (${r.differences.n})`);
  for (const d of r.differences.entries.slice(0, 25)) {
    if (d.kind === 'parameter') {
      const t = d.toward_the_analogue ? ' | ' + Object.entries(d.toward_the_analogue).map(([k, v]) => `${k}: ${v.moved}`).join(', ') : '';
      L(`  ${d.parameter}: ${d.base_value} -> ${d.generated_value} (${d.direction}${d.ratio ? `, x${d.ratio}` : ''})${t}`);
    } else if (d.kind === 'gene') L(`  gene ${d.gene}: ${d.edit}`);
    else L(`  sequence ${d.record}: ${d.mismatches_in_the_aligned_prefix} mismatch(es) in ${d.aligned_positions_compared} aligned bp`);
  }
  L('');
  L('FUNCTIONAL ANALOGUE (chosen from the desired function, not from relatedness)');
  for (const a of r.analogue.analogues) L(`  ${a.name} -- ${a.function}\n      evidence: ${a.evidence_file}; genotype: ${a.genotype?.ran ? `${a.genotype.orthologues_called}/${a.genotype.n_genes} focal orthologues called` : 'not fetched'}${a.is_the_base_organism ? ' [NOTE: this analogue IS the base organism]' : ''}`);
  for (const n of r.analogue.criteria_with_no_known_analogue) L(`  ${n.criterion} (${n.scenario}): NO ANALOGUE -- ${n.reason}`);
  L('');
  L('PER-SCALE COVERAGE');
  for (const [s, c] of Object.entries(r.per_scale_coverage)) {
    const d = c.genes_swept != null
      ? `${c.genes_with_at_least_one_record}/${c.genes_swept} genes with a record, ${c.genes_with_two_or_more_independent_sources_agreeing} with >=2 independent sources`
      : `${c.terms_with_a_swept_gene ?? 0}/${c.terms_at_this_scale ?? 0} terms with a swept gene`;
    L(`  ${s.padEnd(18)} ${c.assessable ? 'assessable    ' : 'NOT ASSESSABLE'}  ${d}`);
  }
  L('');
  L('NAMED RESULTS (five, never summed)');
  for (const [k, v] of Object.entries(r.results)) L(`  ${k.padEnd(22)} ${v.status.toUpperCase().padEnd(14)} ${v.gate}`);
  if (r.composite_score_from_the_scorer) L(`\n  [the scorer thread's own composite, for reference only, NOT this verdict: ${r.composite_score_from_the_scorer.value} (${r.composite_score_from_the_scorer.plausible ? 'plausible' : 'implausible'}), v${r.composite_score_from_the_scorer.version}]`);
  L('');
  L('VERDICT');
  L('  ' + r.verdict.statement.replace(/\. /g, '.\n  '));
  if (r.notes.length) { L(''); L('NOTES'); for (const n of r.notes) L('  * ' + n); }
  L('');
  L(`(${r.ms} ms)`);
}

process.exit(r.verdict.failed.length ? 1 : r.verdict.could_not_assess.length || r.verdict.scales_not_assessed.length ? 2 : 0);
