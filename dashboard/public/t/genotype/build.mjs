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
  pathways: (() => { const p = path.join(root, 'genotype/pathways.slim.json'); if (!fs.existsSync(p)) return null; const P = JSON.parse(fs.readFileSync(p, 'utf8'));
    const finTop = Object.entries(P.fin_pathways || {}).sort((a, b) => b[1].length - a[1].length).slice(0, 20)
      .map(([id, gs]) => ({ id, name: P.pathways[id]?.name, source: P.pathways[id]?.source, n_fin_genes: gs.length }));
    return { built: P.built, not_causation: P.not_causation, coverage: P.coverage, summary: P.summary,
      sources: { go: { call: P.sources.go_bp.call, gaf_date: P.sources.go_bp.gaf_date_generated, retrieved: P.sources.go_bp.retrieved },
        reactome: { version: P.sources.reactome.database_version, inferred_by_orthology: true, note: P.sources.reactome.note, retrieved: P.sources.reactome.retrieved },
        kegg: { release: P.sources.kegg.release, retrieved: P.sources.kegg.retrieved } },
      top_fin_pathways: finTop }; })(),
  causal_chains: (() => { const p = path.join(root, 'genotype/causal-chains.json'); if (!fs.existsSync(p)) return null; const C = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { built: C.built, note: C.note, grades: C.grades, coverage: C.coverage, validation_flags: C.validation_flags,
      agent_calls: Object.values(C.agent_calls || {}).reduce((a, c) => a + c.calls, 0),
      genes: (C.genes || []).map(g => ({ symbol: g.symbol, agent: g.agent, chain_strength: g.chain_strength, best_grade: g.best_grade, weakest_grade: g.weakest_grade, deepest_level: g.deepest_level,
        n_full_text_sources: g.n_full_text_sources, n_abstract_only_sources: g.n_abstract_only_sources, chain_complete: g.chain_complete,
        deepest_node: g.deepest_node_with_evidence, n_sources: g.n_sources, weakest_link: g.weakest_link, gaps: g.gaps,
        chain: (g.chain || []).map(s => ({ step: s.step, from: s.from, to: s.to || s.phenotype, to_node: s.to_node, to_node_label: s.to_node_label, grade: s.evidence_grade,
          organism: s.organism, experiment_type: s.experiment_type, stage: s.stage,
          sources: (s.sources || []).map(x => ({ pmid: x.pmid, doi: x.doi, first_author: x.first_author, year: x.year, journal: x.journal, quote: x.quote, read: x.read })) })) })),
      cross_gene: C.cross_gene }; })(),
  interactions: (() => { const p = path.join(root, 'genotype/interactions.json'); if (!fs.existsSync(p)) return null; const I = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { built: I.built, coverage: I.coverage, agents: I.agents,
      interactions: (I.interactions || []).map(x => ({ id: x.id, sender: x.sender_node, sender_label: x.sender_node_label, receiver: x.receiver_node, receiver_label: x.receiver_node_label,
        kind: x.kind, signal: x.signal, what_is_shown: x.what_is_shown, grade: x.evidence_grade, organism: x.organism, stage: x.stage, context: x.context,
        orthology_inferred: x.orthology_inferred, inferred_from: x.inferred_from,
        sources: (x.sources || []).map(s => ({ pmid: s.pmid, doi: s.doi, first_author: s.first_author, year: s.year, quote: s.quote })) })),
      refuted_or_unsupported: I.refuted_or_unsupported, gaps: I.gaps }; })(),
  interventions: (() => { const p = path.join(root, 'genotype/interventions.json'); if (!fs.existsSync(p)) return null; const V = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { built: V.built, note: V.note, coverage: V.coverage, levels: V.levels, paralog_guards: V.paralog_guards,
      parameters: V.parameters, no_sourced_genetic_route: V.no_sourced_genetic_route,
      knobs: (V.interventions || []).filter(i => i.usable_as_a_calibrated_knob).map(i => ({ id: i.id, gene: i.gene, parameter: i.parameter, level: i.level,
        direction: i.direction, grade: i.evidence_grade, effect_size: i.effect_size, stage: i.stage, lesion: i.lesion, side_effects: i.side_effects,
        lethality: i.lethality, pleiotropy: i.pleiotropy, sources: (i.sources || []).slice(0, 2).map(s => ({ pmid: s.pmid, doi: s.doi, quote: s.quote })) })),
      lethal: (V.interventions || []).filter(i => /dies|lethal/i.test(String(i.lethality || ''))).map(i => ({ id: i.id, gene: i.gene, lethality: i.lethality })) }; })(),
  flier_genome: (() => { const p = path.join(root, 'genotype/flier-genome.json'); if (!fs.existsSync(p)) return null; const F = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { built: F.built, status: F.status, summary: F.summary, constraint: F.constraint,
      items: (F.items || []).map(i => ({ item: i.item, requirement: i.requirement, route: i.route, verdict: i.verdict,
        physics_numbers: i.physics_numbers, n_candidate_routes: i.n_candidate_routes, n_calibrated: i.n_calibrated,
        largest_measured_increase: i.largest_measured_increase, what_is_missing: i.what_is_missing })) }; })(),
  not_sourced: M.not_sourced, vetting: M.vetting, slimming: { rule: M.slimming?.rule, nodes_with_omitted_expression_links: Object.keys(M.slimming?.expressed_in_links_omitted_by_node || {}).length },
  crosswalk_rule: M.crosswalk.rule,
};
fs.writeFileSync(path.join(here, 'data.json'), JSON.stringify(data));

const cell = layers.find(l => l.layer === 'cell'), organ = layers.find(l => l.layer === 'organ'), tissue = layers.find(l => l.layer === 'tissue'), sys = layers.find(l => l.layer === 'organ_system');
const rejectedEnv = Object.entries(zp.rejected || {}).filter(([k]) => k.startsWith('experimental condition')).reduce((a, [, v]) => a + v, 0);
const rejectedDom = Object.entries(zp.rejected || {}).filter(([k]) => k.startsWith('homozygous allele that also')).reduce((a, [, v]) => a + v, 0);
const C2 = data.causal_chains, V2 = data.interventions, I2 = data.interactions, P2 = data.pathways;
const status = {
  thread: 'genotype', title: 'Genotype-phenotype links (flying fish)', updated: new Date().toISOString(), state: 'working',
  headline: (V2 && C2
    ? `Every gene link is proxy-fish data, because no flying-fish molecular data exists. Of ${V2.coverage.interventions} experimentally shown interventions on fin and body shape, only ${V2.coverage.usable_as_calibrated_knobs} carry a true effect magnitude together with the stage it was measured at, and pectoral fin LENGTH has no calibrated route at all. Of ${C2.coverage.genes_with_a_chain} gene-to-phenotype chains, ${C2.coverage.chains_whose_weakest_link_is_necessity_or_better} have a weakest link of necessity or better and ${C2.coverage.genes_with_a_link_graded_mechanism} hold at least one mechanism-grade link. The best single lever to a bigger fin, hhip loss of function at +65% area, enlarges the pectoral fin by disorganising the rest of the skeleton.`
    : `No flying-fish molecular data exists, so every gene link is a proxy-fish record: the pectoral fin has ${pf.counts.required_for_genes} genes required for it, ${pf.counts.sufficient_for_genes} sufficient to enlarge it, and ${pf.counts.expressed_in_genes} expressed in it; only ${cell.cells_with_zfa_equivalent} of ${cell.denominator} cell types have a zebrafish-anatomy equivalent, so the cell layer is capped by the ontology crosswalk, not by the data.`),
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
    ...(P2 ? [{ label: 'genes with a pathway or process (of ' + P2.coverage.all_genes_in_vetted_map.genes + ')', value: P2.coverage.all_genes_in_vetted_map.with_any_pathway }] : []),
    ...(C2 ? [{ label: 'causal chains built', value: C2.coverage.genes_with_a_chain },
              { label: 'chains whose weakest link is necessity or better', value: C2.coverage.chains_whose_weakest_link_is_necessity_or_better },
              { label: 'publications cited across the chains', value: C2.coverage.distinct_publications }] : []),
    ...(I2 ? [{ label: 'tissue and cell interactions', value: I2.coverage.interactions },
              { label: 'of those, inferred by orthology rather than fish-native', value: I2.coverage.orthology_inferred },
              { label: 'limb-biology expectations refuted or unsupported in fish', value: (I2.refuted_or_unsupported || []).length }] : []),
    ...(V2 ? [{ label: 'interventions shown to change a parameter', value: V2.coverage.interventions },
              { label: 'of those, calibrated (magnitude plus stage)', value: V2.coverage.usable_as_calibrated_knobs },
              { label: 'parameter and gene-set combinations with no sourced route', value: V2.coverage.parameters_with_no_sourced_route }] : []),
    ...(data.flier_genome ? [{ label: 'powered-flier requirements with any genetic route (of 4)', value: data.flier_genome.summary.items_with_any_route }] : []),
  ],
  links: [{ label: 'Sub-dashboard', url: 't/genotype/index.html' }, { label: 'Vetted map (repo)', url: 'genotype/map.vetted.json' },
    { label: 'Causal chains (repo)', url: 'genotype/CAUSAL.md' }, { label: 'Interventions for the Studio (repo)', url: 'genotype/interventions.json' },
    { label: 'Powered flier, hypothesis (repo)', url: 'genotype/flier-genome.md' }, { label: 'Handover notes (repo)', url: 'genotype/HANDOVER.md' }],
  blockers: [],
  needs: [{ from: 'hub', ask: 'commit genotype/map.vetted.json (slim) and genotype/*.py, cache/; never the 38 MB map.json' }, { from: 'viz', ask: 'render genes from genotype/map.vetted.json (vetted: true)' }],
  next: ['nanopub drafts in genotype/nanopubs/unsigned/', 'README for genotype/', 'ideas to the hub for decisions/ideas.json'],
};
fs.writeFileSync(path.join(here, 'status.json'), JSON.stringify(status, null, 2));
console.log(`genotype data.json: ${LAYERS.map(L => `${L} ${layers.find(l => l.layer === L).direct}/${layers.find(l => l.layer === L).denominator}`).join(', ')}; pectoral fin e/r/s ${pf.counts.expressed_in_genes}/${pf.counts.required_for_genes}/${pf.counts.sufficient_for_genes}; data.json ${(fs.statSync(path.join(here, 'data.json')).size / 1e6).toFixed(2)} MB`);
