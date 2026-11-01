#!/usr/bin/env node
// CLI for the germline editing plan. It prints a PROPOSAL for a wet lab to check, never a protocol.
//
//   node sim-engine/validate/editplan/cli.mjs --gene kcnk5b --change p.W169L
//   node sim-engine/validate/editplan/cli.mjs --gene hhip --change knockout --no-offtarget
//   node sim-engine/validate/editplan/cli.mjs --organism winged-zebrafish --panel
//   node sim-engine/validate/editplan/cli.mjs --gene kcnk5b --change p.F241Y --json
//
// Flags: --gene --change --organism --window <bp> --arms symmetric|asymmetric
//        --no-offtarget --no-network --panel --json --methods
import { editPlan, editPlansForDoc, panel, wrap, RANKING_RULE } from './plan.mjs';
import * as E from './editplan.mjs';

const argv = process.argv.slice(2);
const flag = n => argv.includes(`--${n}`);
const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

const BANNER = [
  '================================================================================',
  ' GERMLINE EDITING PLAN - A PROPOSAL FOR A WET LAB TO CHECK',
  ' Not a protocol. Not validated. Nothing here has been tested at a bench by us.',
  ' Danio rerio (GRCz11) only. Any animal work needs institutional animal-care',
  ' approval (IACUC or equivalent) BEFORE the first injection.',
  '================================================================================',
].join('\n');

function printPlan(r) {
  if (r.refused) { console.log(`\n### ${r.gene} ${r.edit}\n  REFUSED: ${r.refusal}\n`); return; }
  const pl = r.plan, L = pl.locus, X = pl.exact_genomic_change;
  console.log(`\n### ${L.gene} ${r.edit}  -  ${pl.strategy}`);
  console.log(`  locus      ${L.gene_id} / ${L.transcript_id} / ${L.protein_id} (${L.protein_length_aa} aa), ${E.ASSEMBLY} chr ${L.chromosome} strand ${L.strand}`);
  if (X.kind === 'knockout: no single base change') {
    console.log(`  target     ${X.note}`);
    console.log(`  coding nt  ${X.target_window.coding_nt_in_window} nt across ${X.target_window.coding_intervals_in_window.length} coding intervals (a cut in an intron does not shift the frame)`);
  } else {
    console.log(`  change     ${X.protein_change}  codon ${X.codon_number}  ${X.cds_positions}`);
    console.log(`  codon      ${X.reference_codon} (${X.reference_amino_acid}) -> ${X.chosen?.codon} (${X.chosen ? X.chosen.n_nucleotide_changes : '?'} nt change${X.chosen?.n_nucleotide_changes === 1 ? '' : 's'})`);
    for (const c of X.chosen?.changes || []) console.log(`             ${c}`);
    console.log(`  genome     ${X.genome_vs_cds_check}`);
    console.log(`  codon use  ${X.chosen?.codon} is ${(100 * (X.chosen?.codon_usage_fraction_of_synonymous_family ?? 0)).toFixed(1)} % of its synonymous family in zebrafish (${X.codon_usage_source?.database || 'not sourced'})`);
  }
  console.log(`  ranking    ${pl.ranking_rule}`);
  for (const n of ['SpCas9', 'SaCas9', 'AsCas12a']) {
    const b = pl.guides[n];
    console.log(`  ${n.padEnd(9)} ${b.n_found} protospacer(s) found; ${b.search_window_bp}`);
    for (const g of b.guides) console.log(`      ${g.spacer} ${g.pam}  strand ${g.strand > 0 ? '+' : '-'}  cut ${L.chromosome}:${g.cut_site_chrom}` +
      (g.distance_cut_to_edit_bp != null ? `  ${g.distance_cut_to_edit_bp} bp from edit` : `  frameshift from codon ${g.frameshift_from_codon} (loses ${(100 * (g.protein_fraction_lost_if_frameshift_here ?? 0)).toFixed(1)} % of the protein)`) +
      `  on-target ${g.on_target.score} [HEURISTIC]${g.on_target.flags.length ? '  !! ' + g.on_target.flags[0] : ''}`);
  }
  const bp = pl.better_placed_alternative;
  if (bp?.not_applicable) console.log(`  better     n/a - ${bp.not_applicable}`);
  else if (bp) console.log(`  better     ${bp.nuclease} is better placed: ${bp.why}`);
  const ots = Array.isArray(pl.off_target) ? pl.off_target : [];
  if (!ots.length) console.log(`  off-target NOT RUN (${pl.off_target?.reason || 'n/a'})`);
  for (const o of ots) {
    if (!o.search?.ran) { console.log(`  off-target ${o.spacer}: NOT RUN (${o.search?.reason})`); continue; }
    console.log(`  off-target ${o.spacer}: ${o.search.n_sites_within_mismatch_limit} GRCz11 site(s) with <= ${o.search.max_mismatches} mismatches (${o.perfect_matches} perfect, incl. the on-target); MIT specificity ${o.mit_specificity?.specificity} [PREDICTION, A FLOOR]`);
    for (const s of (o.search.sites || []).filter(x => x.n_mismatches > 0).slice(0, 6)) console.log(`      ${s.n_mismatches} mm at ${s.mismatch_positions.join(',')}  chr${s.chromosome}:${s.hit_from}-${s.hit_to}  ${Array.isArray(s.gene_context) && s.gene_context.length ? s.gene_context.map(g => (g.symbol || g.id) + ' (' + g.biotype + ')').join(', ') : 'no gene within 2 kb'}`);
    if (o.exonic_off_targets?.length) console.log(`      !! ${o.exonic_off_targets.length} site(s) sit in or near a PROTEIN-CODING gene; sequence these in the founders`);
  }
  for (const d of (Array.isArray(pl.hdr_donor) ? pl.hdr_donor : []).filter(x => x.ran)) {
    console.log(`  ssODN      ${d.style}, ${d.length_nt} nt, arms ${d.arms.left_nt}/${d.arms.right_nt} (${d.arms.asymmetry}); protein check: ${d.protein_check?.status}`);
    console.log(`             order 5'-${d.sequence_to_order_5to3}-3'`);
    for (const b of d.blocking_mutations) console.log(`             blocking: ${b.where} ${E.ASSEMBLY} ${L.chromosome}:${b.genomic_pos} ${b.genomic_ref}>${b.genomic_alt}, codon ${b.codon} ${b.codon_before}->${b.codon_after} (${b.amino_acid}, silent: ${b.protein_unchanged}; usage ${b.codon_usage_fraction_of_family_before}->${b.codon_usage_fraction_of_family_after})`);
    if (d.blocking_warning) console.log(`             !! ${d.blocking_warning}`);
  }
  const be = pl.base_editor_route;
  if (be?.candidates) {
    console.log(`  base edit  ${be.strategy}: ${be.reachable ? be.candidates.length + ' iSTOP candidate(s)' : 'NOT reachable - ' + be.reason}`);
    for (const c of (be.candidates || []).slice(0, 3)) console.log(`      codon ${c.codon_number} ${c.codon}->${c.resulting_codon} (loses ${(100 * c.protein_fraction_lost).toFixed(1)} %)  ${c.spacer} ${c.pam} strand ${c.strand > 0 ? '+' : '-'}  C at window position ${c.position_of_target_C_in_protospacer}${c.bystander_C_in_window.length ? '  bystander C at ' + c.bystander_C_in_window.join(',') : ''}`);
  } else console.log(`  base edit  ${be?.reachable ? be.editor_class + ': ' + be.edit : 'NOT reachable - ' + (be?.reason || 'n/a')}`);
  const pe = pl.prime_editor_route;
  if (pe?.applicable) {
    const d = pe.designs[0];
    console.log(`  prime edit pegRNA designed (${pe.zebrafish_precedent})`);
    console.log(`      spacer ${d.spacer} ${d.pam} strand ${d.strand > 0 ? '+' : '-'}, nick ${L.chromosome}:${d.nick_site_chrom}, ${d.nick_to_edit_bp} bp to the edit`);
    console.log(`      3' extension 5'-${d.pegRNA_3prime_extension_dna_5to3}-3'  (RTT ${d.rtt_length_nt} nt + PBS ${d.pbs_length_nt} nt)`);
    console.log(`      PE3 nick: ${d.pe3_nicking_guide?.found ? d.pe3_nicking_guide.spacer + ' at ' + d.pe3_nicking_guide.distance_from_pe2_nick_nt + ' nt' : d.pe3_nicking_guide?.reason}`);
  } else console.log(`  prime edit not applicable: ${pe?.reason}`);
  console.log('\n  --- NOT ESTABLISHED ---');
  console.log(`  HDR rate to expect: ${pl.feasibility_and_what_is_not_established.hdr_in_zebrafish.headline_rate}`);
  console.log(`  Mosaicism:          ${pl.feasibility_and_what_is_not_established.mosaicism.statement}`);
  console.log(`  Phenotype:          ${pl.feasibility_and_what_is_not_established.design_validation_failed.statement}`);
  console.log(`  Approval:           ${pl.feasibility_and_what_is_not_established.approval.statement}`);
  console.log('\n  --- WHAT WOULD FALSIFY THIS PLAN ---');
  for (const f of pl.what_would_falsify_this_plan) console.log(`  [${f.id}] ${f.what_would_falsify}\n      how: ${f.how}  kills: ${f.kills}`);
}

const opts = { network: !flag('no-network'), offtarget: !flag('no-offtarget'), window: +val('window', 30), arms: val('arms', 'symmetric') };

if (flag('methods')) { console.log(JSON.stringify({ species_limit: E.SPECIES_REFUSAL, on_target: E.ON_TARGET_RULE, ranking: RANKING_RULE, off_target_db: E.OFFTARGET_DB, mit: E.MIT_CITATION, feasibility: E.FEASIBILITY, falsifiers: E.FALSIFIERS }, null, 1)); process.exit(0); }

const gene = val('gene'), change = val('change'), organism = val('organism');
let plans;
if (gene && change) plans = [await editPlan(gene, change, opts)];
else if (organism) { const { getDoc } = await import('../../tools/studio.mjs'); const { doc } = await getDoc(organism); plans = await editPlansForDoc(doc, opts); }
else { console.error('give --gene <symbol> --change <p.W169L|knockout>, or --organism <id>. --methods for the scoring rules.'); process.exit(2); }

if (flag('json')) console.log(JSON.stringify(wrap(plans), null, 1));
else if (flag('panel')) console.log(JSON.stringify(panel(plans), null, 1));
else { console.log(BANNER); for (const r of plans) printPlan(r); console.log(`\n${BANNER.split('\n')[0]}\nPROPOSAL ONLY. Check every coordinate and every protospacer in your own fish before ordering anything.\n`); }
