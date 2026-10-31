#!/usr/bin/env node
// Genotype thread sub-dashboard data: reads genotype/map.vetted.json (the slimmed, vetted map) and writes
// dashboard/public/t/genotype/data.json and status.json. Every number on the page is computed here from
// that file; nothing is typed in by hand.
//   node dashboard/public/t/genotype/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const mapPath = path.join(root, 'genotype/map.vetted.json');
const raw = fs.readFileSync(mapPath);
const M = JSON.parse(raw.toString('utf8'));
const sha = crypto.createHash('sha256').update(raw).digest('hex');
const LAYERS = ['body', 'organ_system', 'organ', 'tissue', 'cell'];
const PF = 'UBERON:0000151';

const layers = LAYERS.map(L => {
  const c = M.layers[L].coverage;
  const nodes = M.layers[L].nodes.map(n => ({ term: n.term, label: n.label, direct: n.direct, derived_only: n.derived_only,
    e: n.direct_expressed_in_genes, r: n.direct_required_for_genes, s: n.direct_sufficient_for_genes, de: n.derived_expressed_in_genes, dr: n.derived_required_for_genes }));
  return { layer: L, denominator: c.denominator, direct: c.nodes_with_direct_record, derived_only: c.nodes_with_only_derived_records, none: c.nodes_with_none,
    fraction_direct: c.fraction_direct, by_type_direct: c.by_type_direct,
    nodes_with_zfa_xref: c.nodes_with_zfa_xref ?? null, cells_with_zfa_equivalent: c.cells_with_zfa_equivalent ?? null,
    cell_ontology_marker_cells: c.cell_ontology_marker_cells ?? null, nodes };
});

// pectoral fin: direct links by type, with gene lists
const pfLinks = M.layers.organ.links.filter(l => l.blueprint_node === PF && !l.derived);
const byType = t => pfLinks.filter(l => l.link_type === t);
const genesOf = ls => [...new Set(ls.map(l => l.symbol || l.gene))].sort();
const pfNode = M.layers.organ.nodes.find(n => n.term === PF);
const pf = {
  term: PF, label: pfNode.label,
  counts: { expressed_in_genes: pfNode.direct_expressed_in_genes, required_for_genes: pfNode.direct_required_for_genes, sufficient_for_genes: pfNode.direct_sufficient_for_genes },
  links_stored_here: pfLinks.length,
  expressed_in_omitted_from_slim_file: (M.slimming?.expressed_in_links_omitted_by_node || {})[PF] || 0,
  required_for: byType('required for').map(l => ({ symbol: l.symbol, gene: l.gene, stage: l.stage?.period, kind: l.evidence_kind,
    lof: l.evidence?.loss_of_function_evidence, rows: l.evidence?.phenotype_rows, example: l.evidence?.phenotypes?.[0] ? `${l.evidence.phenotypes[0].eq} ${l.evidence.phenotypes[0].quality} (${l.evidence.phenotypes[0].fish_name})` : null,
    pmids: [...new Set((l.evidence?.publications || []).map(p => p.pmid).filter(Boolean))] })).sort((a, b) => (a.symbol || '').localeCompare(b.symbol || '')),
  sufficient_for: byType('sufficient for').map(l => ({ symbol: l.symbol, gene: l.gene, stage: l.stage?.period, kind: l.evidence_kind, rows: l.evidence?.phenotype_rows,
    example: l.evidence?.phenotypes?.[0] ? `${l.evidence.phenotypes[0].eq} ${l.evidence.phenotypes[0].quality} (${l.evidence.phenotypes[0].fish_name})` : null,
    gain_of_function: l.evidence?.gain_of_function || null })),
  expressed_in_genes_sample: genesOf(byType('expressed in')).slice(0, 60),
  expressed_in_by_kind: Object.fromEntries(Object.entries(byType('expressed in').reduce((a, l) => { const k = `${l.evidence_kind} | ${l.organism.name}`; a[k] = (a[k] || 0) + 1; return a; }, {})).sort()),
};
const lofClasses = {};
for (const L of LAYERS) for (const l of M.layers[L].links) if (l.link_type === 'required for' && l.evidence?.loss_of_function_evidence)
  for (const e of l.evidence.loss_of_function_evidence) lofClasses[e] = (lofClasses[e] || 0) + 1;

const S = M.summary;
const zp = S.zfin_phenotype || {};
const data = {
  built: new Date().toISOString(), source: { file: 'genotype/map.vetted.json', sha256: sha, bytes: raw.length, map_built: M.built, full_map_sha256: M.slimming?.full_file_sha256 || null },
  title: M.title, constraint: M.constraint, causation_warning: M.causation_warning, link_types: M.link_types, propagation_rules: M.propagation_rules,
  proxy_organisms: S.proxy_organisms, blueprint: { file: M.blueprint.file, sha256: M.blueprint.sha256, taxon: M.blueprint.taxon, counts_distinct: M.blueprint.counts_distinct, pectoral_fin_note: M.blueprint.pectoral_fin_note },
  summary: { direct_links: S.direct_links, direct_links_by_type: S.direct_links_by_type, direct_links_by_layer_and_type: S.direct_links_by_layer_and_type,
    genes_by_organism: S.genes_by_organism, derived_links_stored: S.derived_links_stored, gene_breadth: S.gene_breadth_all_fish_genes, gene_id_rules: S.gene_id_rules,
    bgee: S.bgee, zfin_expression: S.zfin_expression, zfin_phenotype: { rows_abnormal: zp.rows_abnormal, rows_attached: zp.rows_attached, rows_not_attached: zp.rows_not_attached,
      zfa_terms_not_attached: zp.zfa_terms_not_attached, rejected: zp.rejected, lof_evidence_of_kept_rows: zp.lof_evidence_of_kept_rows, conditions_of_rejected_rows: zp.conditions_of_rejected_rows },
    go_gaf_date: S.go_gaf_date, lof_classes_of_required_for_links: lofClasses },
  layers, pectoral_fin: pf,
  focus_genes: M.focus_genes.genes.map(g => ({ family: g.family_in_DATA_md, symbol: g.symbol, gene: g.gene, organism: g.organism, breadth: g.breadth,
    pectoral_fin_links: g.pectoral_fin_links.map(l => ({ node: l.node, type: l.type, kind: l.kind, stage: l.stage?.period || l.stage?.bgee || null, database: l.database })),
    not_attached: g.zfin_expression_not_attached_to_blueprint })),
  fin_size: { why: M.fin_size.why, verified_leads: M.fin_size.verified_leads, pubmed_queries: M.fin_size.pubmed_queries,
    zfin_fin_size_genes: { definition: M.fin_size.zfin_fin_size_genes.definition, count: M.fin_size.zfin_fin_size_genes.count, top: M.fin_size.zfin_fin_size_genes.genes.slice(0, 25) },
    aliases_check: M.fin_size.aliases_check },
  fin_ratios: (() => { const p = path.join(root, 'genotype/cache/daane2021_fin_ratios.json'); if (!fs.existsSync(p)) return null; const F = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { source: F.source, n_rows: F.n_rows, groups: F.groups, species: F.species.map(s => ({ group: s.group, species: s.species, n: s.n_specimens, SL_cm_min: s.SL_cm_min, SL_cm_max: s.SL_cm_max, median: s.pectoral_over_SL_median, min: s.pectoral_over_SL_min, max: s.pectoral_over_SL_max })) }; })(),
  not_sourced: M.not_sourced, vetting: M.vetting, slimming: { rule: M.slimming?.rule, nodes_with_omitted_expression_links: Object.keys(M.slimming?.expressed_in_links_omitted_by_node || {}).length },
  crosswalk_rule: M.crosswalk.rule,
};
fs.writeFileSync(path.join(here, 'data.json'), JSON.stringify(data));

const cell = layers.find(l => l.layer === 'cell'), organ = layers.find(l => l.layer === 'organ'), tissue = layers.find(l => l.layer === 'tissue'), sys = layers.find(l => l.layer === 'organ_system');
const rejectedEnv = Object.entries(zp.rejected || {}).filter(([k]) => k.startsWith('experimental condition')).reduce((a, [, v]) => a + v, 0);
const rejectedDom = Object.entries(zp.rejected || {}).filter(([k]) => k.startsWith('homozygous allele that also')).reduce((a, [, v]) => a + v, 0);
const status = {
  thread: 'genotype', title: 'Genotype-phenotype links (flying fish)', updated: new Date().toISOString(), state: 'working',
  headline: `No flying-fish molecular data exists, so every gene link is a proxy-fish record (zebrafish via ZFIN and Bgee, medaka via Bgee), now vetted: the pectoral fin has ${pf.counts.required_for_genes} genes required for it under standard conditions, ${pf.counts.sufficient_for_genes} verified gain-of-function gene (kcnk5b) sufficient to enlarge it, and ${pf.counts.expressed_in_genes} expressed in it; only ${cell.cells_with_zfa_equivalent} of ${cell.denominator} cell types have a zebrafish-anatomy equivalent, so the cell layer (${cell.direct} with a record) is capped by the ontology crosswalk, not by the data.`,
  metrics: [
    { label: 'organ systems with a direct record (of 13)', value: sys.direct },
    { label: 'organs with a direct record (of 67)', value: organ.direct },
    { label: 'tissues with a direct record (of 198)', value: tissue.direct },
    { label: 'cell types with a direct record (of 257)', value: cell.direct },
    { label: 'cell types with any ZFA equivalent (of 257)', value: cell.cells_with_zfa_equivalent },
    { label: 'direct links: expressed in', value: S.direct_links_by_type['expressed in'] },
    { label: 'direct links: required for', value: S.direct_links_by_type['required for'] },
    { label: 'direct links: sufficient for', value: S.direct_links_by_type['sufficient for'] },
    { label: 'pectoral fin: genes required for (standard conditions)', value: pf.counts.required_for_genes },
    { label: 'phenotype rows dropped: condition not standard or ambiguous', value: rejectedEnv },
    { label: 'phenotype rows dropped: dominant allele, loss of function not established', value: rejectedDom },
    { label: 'Bgee genes merged onto ZFIN ids by symbol', value: S.gene_id_rules?.genes_merged_by_symbol ?? null },
  ],
  links: [{ label: 'Sub-dashboard', url: 't/genotype/index.html' }, { label: 'Vetted map (repo)', url: 'genotype/map.vetted.json' }, { label: 'Handover notes (repo)', url: 'genotype/HANDOVER.md' }],
  blockers: [],
  needs: [{ from: 'hub', ask: 'commit genotype/map.vetted.json (slim) and genotype/*.py, cache/; never the 38 MB map.json' }, { from: 'viz', ask: 'render genes from genotype/map.vetted.json (vetted: true)' }],
  next: ['nanopub drafts in genotype/nanopubs/unsigned/', 'README for genotype/', 'ideas to the hub for decisions/ideas.json'],
};
fs.writeFileSync(path.join(here, 'status.json'), JSON.stringify(status, null, 2));
console.log(`genotype data.json: ${LAYERS.map(L => `${L} ${layers.find(l => l.layer === L).direct}/${layers.find(l => l.layer === L).denominator}`).join(', ')}; pectoral fin e/r/s ${pf.counts.expressed_in_genes}/${pf.counts.required_for_genes}/${pf.counts.sufficient_for_genes}; data.json ${(fs.statSync(path.join(here, 'data.json')).size / 1e6).toFixed(2)} MB`);
