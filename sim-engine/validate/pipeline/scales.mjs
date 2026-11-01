// THE MULTI-SCALE ANNOTATION SWEEP: "analyses functional annotations at every biological scale".
//
// For every DIFFERENCE between generated and base, and for every REQUIREMENT of the functional analogue, this
// reports, at each scale: what is known, how it is known (kind), how many independent sources agree, and WHAT IS
// UNKNOWN. The coverage number at each scale is a first-class output, never a footnote, because at several of
// these scales the honest answer for this project is "nothing is known here", and a sweep that printed only the
// rows it found would read as though the scale had been checked.
//
// Scales, in order:
//   sequence_genomic   locus, allele, conservation            omics/genomic + sequences/genes.json (+ the scorer's
//                                                             genotype_similarity site conservation when edits exist)
//   transcriptomic     where and when it is expressed          omics/transcriptomic (anatomy + developmental stage)
//   proteomic          domains, structure, interactions, MS    omics/proteomic
//   ptm                sites and their conservation            omics/ptm
//   pathway            memberships, cross-source concordance   omics/pathway
//   cell               cell types the design touches           omics/index/parts.json (CL:) -- NOT the 3D manifests
//   tissue  organ  organ_system  body                          the blueprint3d anatomy manifests + parts.json
//
// Data read (never written): omics/index/genes/<symbol>.json.gz, omics/index/parts.json.gz, omics/index/INDEX.json,
// omics/<layer>/MANIFEST.json, sequences/genes.json, dashboard/public/blueprint3d/model/*-manifest.json.
// omics/build-index.mjs is NOT run and NOT edited.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..');
const P = p => path.join(ROOT, p);
const readJson = p => { try { return JSON.parse(fs.readFileSync(P(p), 'utf8')); } catch { return null; } };
const readGz = p => { try { return JSON.parse(zlib.gunzipSync(fs.readFileSync(P(p)))); } catch { return null; } };

export const OMICS_LAYERS = ['genomic', 'transcriptomic', 'proteomic', 'ptm', 'pathway'];
export const ANATOMY_SCALES = ['cell', 'tissue', 'organ', 'organ_system', 'body'];
export const SCALES = ['sequence_genomic', 'transcriptomic', 'proteomic', 'ptm', 'pathway', ...ANATOMY_SCALES];

const uberon = s => (s == null ? null : String(s).replace('_', ':'));
const uniq = a => [...new Set(a.filter(x => x != null))];

// Measured coverage gaps, not remembered ones: scan-gaps.mjs counts the rows and writes this file. Every
// "what is unknown" line below that quotes a figure quotes it from here. If the file is missing the line still
// appears, but says that the figure was not measured rather than inventing one.
const GAPS = readJson('sim-engine/validate/pipeline/coverage-gaps.json');
const gap = layer => GAPS?.layers?.[layer] ?? null;
const UNMEASURED = '(figure not measured: run node sim-engine/validate/pipeline/scan-gaps.mjs)';
function finGapLine(layer, what) {
  const g = gap(layer);
  if (!g?.present) return `${what}: no row count was measured for the ${layer} layer ${UNMEASURED}.`;
  return `${what}: the ${layer} layer holds ${g.rows_with_fin_anatomy} row(s) with any fin anatomy and ${g.rows_with_pectoral_fin_anatomy} with a PECTORAL fin anatomy, out of ${g.rows} rows (measured ${GAPS.built}).`;
}
function analogueGapLine(layer) {
  const g = gap(layer);
  if (!g?.present) return `No flying-fish ${layer} data: row counts were not measured ${UNMEASURED}.`;
  const ex = Object.entries(g.exocoetid_rows || {});
  return `NO FLYING-FISH ${layer.toUpperCase()} DATA. Hirundichthys speculiger rows in this layer: ${g.hirundichthys_rows} of ${g.rows}. Exocoetidae rows of any species: ${ex.length ? ex.map(([s, n]) => `${n} ${s}`).join(', ') : 'none'}. Species present: ${Object.keys(g.by_species || {}).join(', ')}.`;
}

/** Load the per-gene omics card, or say it is absent. */
export function geneCard(symbol) {
  const o = readGz(`omics/index/genes/${symbol}.json.gz`);
  return o || null;
}

/** The FULL blueprint3d manifest from disk. The bundle's copy is trimmed to {file, organism, objects,
 *  parameters, units_and_axes, derived_from_the_mesh} and drops `ontology_label`, `levels`, `hypothetical` and
 *  `geometry_basis`, which the anatomy scales need. Reading the file is the only way to get them. */
export const MANIFEST_FILE = {
  'zebrafish-adult': 'zebrafish-dev', 'zebrafish-larva': 'zebrafish-dev', 'flying-fish': 'flying-fish-dev',
  'winged-zebrafish': 'winged-zebrafish', 'wingless-flying-fish': 'wingless-flying-fish', 'tff': 'tff', 'ff-zf-chimera': 'ff-zf-chimera',
};
export function fullManifest(organismId) {
  const stem = MANIFEST_FILE[organismId] ?? organismId;
  return readJson(`dashboard/public/blueprint3d/model/${stem}-manifest.json`);
}

let PARTS = null;
export function parts() { if (PARTS === null) PARTS = readGz('omics/index/parts.json.gz') || {}; return PARTS; }

/** Pull the entries of one (layer, feature) from a card, summarised the way every scale reports. */
function featureEntries(card, layer, feature, { anatomyIds = null } = {}) {
  const f = card?.layers?.[layer]?.features?.[feature];
  if (!f) return [];
  let es = f.entries || [];
  if (anatomyIds && anatomyIds.length) es = es.filter(e => e.anatomy && anatomyIds.includes(uberon(e.anatomy.uberon || e.anatomy.id)));
  return es;
}

const summariseEntries = es => es.map(e => ({
  value: e.v, n_sources: e.n_sources ?? (e.sources || []).length, sources: e.sources || [], kind: e.kind || [],
  n_rows: e.n ?? null, unit: e.unit ?? null,
  anatomy: e.anatomy ? { id: e.anatomy.id, label: e.anatomy.label, uberon: uberon(e.anatomy.uberon) } : null,
  stages: e.stages ?? null, evidence: e.evidence ?? null, species: e.species ?? null, detail: typeof e.value === 'object' ? e.value : null,
}));

const kindTally = es => { const t = {}; for (const e of es) for (const k of (e.kind || [])) t[k] = (t[k] || 0) + 1; return t; };
const agreeing = es => es.filter(e => (e.n_sources ?? 0) >= 2).length;


function ptmLayerGapLine() {
  const g = gap('ptm');
  if (!g?.present) return `PTM layer composition was not measured ${UNMEASURED}.`;
  const sp = Object.entries(g.by_species || {}).map(([s2, n]) => `${n} ${s2}`).join(', ');
  return `The PTM layer is ${sp} out of ${g.rows} rows, and holds ${g.rows_with_pectoral_fin_anatomy} row(s) with a pectoral-fin anatomy (${g.rows_with_fin_anatomy} with any fin anatomy), so PTM state in the edited structure is unknown.`;
}
function pathwayAnatomyGapLine() {
  const g = gap('pathway');
  if (!g?.present) return `Pathway-layer anatomy conditioning was not measured ${UNMEASURED}.`;
  return `Of ${g.rows} pathway/GO rows, ${g.rows_with_anatomy} carry any anatomy context and ${g.rows_with_fin_anatomy} any fin anatomy, so WHERE and WHEN a membership holds is unknown at every scale below the organism.`;
}

// -------------------------------------------------------------------------------- per-gene, per-scale sweeps

function sweepGenomic(symbol, card, { anatomyIds, focal, genotypeSim }) {
  const loc = summariseEntries(featureEntries(card, 'genomic', 'gene_location'));
  const alleles = summariseEntries(featureEntries(card, 'genomic', 'allele_count'));
  const phenAll = featureEntries(card, 'genomic', 'allele_phenotype');
  const phenHere = summariseEntries(featureEntries(card, 'genomic', 'allele_phenotype', { anatomyIds }));
  const fo = focal?.genes?.find(g => g.symbol === symbol) ?? null;
  const edited = (genotypeSim?.per_gene || []).find(g => g.gene === symbol) ?? null;
  const known = {
    locus: loc.length ? loc : (fo?.location_GRCz11 ? [{ value: fo.location_GRCz11, n_sources: 1, sources: ['Ensembl (sequences/genes.json)'], kind: ['curated'] }] : []),
    allele_count: alleles,
    allele_phenotypes_at_the_touched_anatomy: phenHere,
    allele_phenotypes_anywhere: phenAll.length,
    conservation: fo?.analogue_orthologue
      ? { kind: 'orthologue protein identity vs zebrafish', analogue_species: fo.analogue_orthologue.species, msa_identity_vs_zebrafish: fo.analogue_orthologue.msa_identity_vs_zebrafish, homology_type: fo.analogue_orthologue.homology_type, source: 'sequences/genes.json', note: 'protein-level identity across a called orthologue, NOT per-site conservation of the edited residue' }
      : null,
    edited_site_conservation: edited?.site_conservation ?? null,
  };
  const unknown = [];
  if (!known.locus.length) unknown.push('no genomic locus is recorded for this gene in omics/genomic or sequences/genes.json');
  if (!phenHere.length) unknown.push(`no allele phenotype is recorded at any of the anatomy terms this design touches (${phenAll.length} allele phenotype(s) are recorded at OTHER anatomy)`);
  if (!known.conservation) unknown.push('no flying-fish (analogue) orthologue has been called for this gene, so there is no cross-species conservation figure');
  if (!edited) unknown.push('this gene carries no edit in the generated design, so no per-site conservation of a changed residue exists; the identity figure above is whole-protein and says nothing about any single position');
  const all = [...known.locus, ...alleles, ...phenHere];
  return { gene: symbol, known, unknown, n_records: all.length, kinds: kindTally(all), multi_source_records: agreeing(all) };
}

function sweepTranscriptomic(symbol, card, { anatomyIds }) {
  const here = summariseEntries(featureEntries(card, 'transcriptomic', 'expressed_in', { anatomyIds }));
  const allExpr = featureEntries(card, 'transcriptomic', 'expressed_in');
  const notHere = summariseEntries(featureEntries(card, 'transcriptomic', 'not_expressed_in', { anatomyIds }));
  const levels = summariseEntries(featureEntries(card, 'transcriptomic', 'expression_level'));
  const markers = summariseEntries(featureEntries(card, 'transcriptomic', 'cell_type_marker'));
  const stages = uniq(here.flatMap(e => e.stages || []));
  const known = { expressed_in_the_touched_anatomy: here, not_expressed_in_the_touched_anatomy: notHere, expression_level: levels, cell_type_marker: markers,
    stages_with_a_record_at_the_touched_anatomy: stages, expressed_in_anywhere: allExpr.length,
    species_of_the_records: uniq([...here, ...levels].flatMap(e => e.species || [])) };
  const unknown = [];
  if (!here.length) unknown.push(`no expression record at any anatomy term this design touches (${allExpr.length} record(s) exist at OTHER anatomy)`);
  if (!stages.length) unknown.push('no developmental stage is attached to any expression record at the touched anatomy, so WHEN the gene is expressed there is unknown');
  if (!levels.length) unknown.push('no quantitative expression level (TPM or similar) is recorded, so only presence/absence is known, never amount');
  if (!markers.length) unknown.push('the gene is not recorded as a marker of any cell type, so its cell-level distribution within the tissue is unknown');
  unknown.push(analogueGapLine('transcriptomic') + ' Xu et al. 2021 report no RNA-seq for H. speculiger at all, so expression in the ANALOGUE is unknown at every gene and every anatomy.');
  unknown.push(finGapLine('transcriptomic', 'Fin-anatomy depth of this layer'));
  const all = [...here, ...notHere, ...levels, ...markers];
  return { gene: symbol, known, unknown, n_records: all.length, kinds: kindTally(all), multi_source_records: agreeing(all) };
}

function sweepProteomic(symbol, card, { anatomyIds }) {
  const E = f => summariseEntries(featureEntries(card, 'proteomic', f));
  const domains = E('domain'), superfam = E('homologous_superfamily'), struct = E('predicted_structure'),
    inter = E('interacts_with'), nInter = E('interaction_partner_count'), detected = E('protein_detected'),
    abund = E('protein_abundance'), loc = E('subcellular_location'), len = E('protein_length'), sites = E('site'), regions = E('region');
  const ms = [...detected, ...abund].filter(e => (e.kind || []).includes('measured'));
  const anyFinTissue = [...detected, ...abund].some(e => e.anatomy && anatomyIds.includes(uberon(e.anatomy.uberon || e.anatomy.id)));
  const known = { domains, homologous_superfamily: superfam, structure: struct, interactions: inter, interaction_partner_count: nInter,
    mass_spec_evidence: ms, protein_abundance: abund, subcellular_location: loc, protein_length: len, functional_sites: sites, regions };
  const unknown = [];
  if (!domains.length && !superfam.length) unknown.push('no domain or superfamily assignment: the protein architecture is unknown');
  if (!struct.length) unknown.push('no structure record (not even a predicted one)');
  if (!ms.length) unknown.push('NO mass-spectrometry evidence at all: the protein has never been detected in any measured proteomics dataset held here, only predicted or electronically inferred');
  if (!inter.length) unknown.push('no interaction partner is recorded, so the protein\'s place in any complex is unknown');
  if (!anyFinTissue) unknown.push('NO protein record is from any anatomy this design touches. ' + finGapLine('proteomic', 'Fin-anatomy depth of this layer') + ' Every protein measurement here is whole-organism or another tissue, so protein-level knowledge of the edited structure is unknown by construction.');
  unknown.push(analogueGapLine('proteomic'));
  const all = [...domains, ...superfam, ...struct, ...inter, ...detected, ...abund, ...loc, ...sites];
  return { gene: symbol, known, unknown, n_records: all.length, kinds: kindTally(all), multi_source_records: agreeing(all), mass_spec_records: ms.length, records_at_touched_anatomy: anyFinTissue ? 'yes' : 0 };
}

function sweepPtm(symbol, card) {
  const feats = card?.layers?.ptm?.features || {};
  const rows = [];
  for (const [feature, f] of Object.entries(feats)) for (const e of (f.entries || [])) {
    const d = typeof e.value === 'object' ? e.value : null;
    rows.push({ feature, value: e.v, n_sources: e.n_sources ?? 0, sources: e.sources || [], kind: e.kind || [],
      residue: d?.residue ?? null, position: d?.position ?? null, modification: d?.modification ?? null,
      conservation: d?.conservation ?? null, source_species: d?.source_species ?? null, zf_position: d?.zf_position ?? null });
  }
  const conserved = rows.filter(r => r.conservation === 'conserved').length;
  const borrowed = rows.filter(r => (r.kind || []).includes('borrowed-ortholog')).length;
  const known = { sites: rows, n_sites: rows.length, sites_called_conserved: conserved, sites_borrowed_from_a_human_or_mouse_orthologue: borrowed };
  const unknown = [];
  if (!rows.length) unknown.push('no PTM site of any kind is recorded for this gene: whether it is modified at all is unknown');
  if (rows.length && !rows.some(r => r.conservation != null)) unknown.push('no site carries a conservation call, so whether the modified position is conserved is unknown');
  if (borrowed) unknown.push(`${borrowed} of ${rows.length} site(s) are BORROWED from a human or mouse orthologue and were never observed on the zebrafish protein; the zebrafish position is an alignment inference`);
  unknown.push(ptmLayerGapLine());
  return { gene: symbol, known, unknown, n_records: rows.length, kinds: kindTally(rows), multi_source_records: agreeing(rows) };
}

function sweepPathway(symbol, card) {
  const E = f => summariseEntries(featureEntries(card, 'pathway', f));
  const member = E('pathway_member'), proc = E('go_process'), fn = E('go_function'), comp = E('go_component'), rxn = E('reaction');
  const all = [...member, ...proc, ...fn, ...comp, ...rxn];
  const multi = all.filter(e => e.n_sources >= 2);
  const borrowed = all.filter(e => (e.kind || []).includes('borrowed-ortholog')).length;
  const experimental = all.filter(e => Array.isArray(e.evidence) ? e.evidence.some(x => /IMP|IDA|IGI|IPI|IEP|ECO:0000315|ECO:0000314/.test(String(x))) : false).length;
  const known = { pathway_memberships: member, go_process: proc, go_function: fn, go_component: comp, reactions: rxn,
    cross_source_concordance: { records: all.length, with_two_or_more_independent_sources: multi.length, sources: uniq(all.flatMap(e => e.sources)) } };
  const unknown = [];
  if (!member.length) unknown.push('no curated pathway membership (Reactome/KEGG/WikiPathways/Pathway Commons): the gene sits in no named pathway here');
  if (!all.length) unknown.push('no pathway or GO annotation at all');
  if (all.length && !experimental) unknown.push(`none of the ${all.length} pathway/GO records rests on an experimental evidence code: all are IEA, IBA, ISS or borrowed, so the gene's function here is inferred, never observed in this species`);
  if (borrowed) unknown.push(`${borrowed} of ${all.length} record(s) are borrowed from the human orthologue rather than annotated on the fish gene`);
  unknown.push(pathwayAnatomyGapLine());
  return { gene: symbol, known, unknown, n_records: all.length, kinds: kindTally(all), multi_source_records: multi.length, experimental_evidence_records: experimental };
}

// -------------------------------------------------------------------------------- the anatomical scales

/** Which manifest objects a changed parameter drives, and the ontology terms they carry. */
export function anatomyTouched(manifest, changedParams) {
  const objs = (manifest?.objects || []).filter(o => (o.driven_by_parameters || []).some(p => changedParams.includes(p)));
  const terms = new Map();
  for (const o of objs) {
    const id = uberon(o.ontology_id);
    if (id && !terms.has(id)) terms.set(id, { id, label: o.ontology_label ?? null, level: o.level ?? null, ontology_source: o.ontology_source ?? null, objects: [] });
    if (id) terms.get(id).objects.push({ object: o.object, label: o.label, level: o.level, layer: o.layer, side: o.side ?? null, geometry_basis: o.geometry_basis ?? null, hypothetical: !!o.hypothetical });
    const sid = uberon(o.organ_system_id);
    if (sid && !terms.has(sid)) terms.set(sid, { id: sid, label: o.organ_system ?? null, level: 'organ_system', ontology_source: o.ontology_source ?? null, objects: [], via: 'the organ_system of a driven object' });
  }
  return { objects_driven: objs.length, objects_total: (manifest?.objects || []).length, terms: [...terms.values()] };
}

function anatomyScale(level, terms, { manifestLevels, geneSet, manifest, changedParams = [] }) {
  const PJ = parts();
  let rows = terms.filter(t => (t.level || null) === level);
  // The BODY scale is always in scope: a design is a whole organism, and the function asked for (a glide range,
  // a thermal window) is a whole-body property whatever parameter was moved. It is included even when no changed
  // parameter drives a body-level object, and says which of the two it is.
  if (level === 'body') {
    const driven = terms.some(t => t.level === 'body');
    if (!driven) rows = [{ id: 'UBERON:0000468', label: 'multicellular organism', level: 'body', ontology_source: 'omics/index/parts.json', objects: [],
      via: 'always in scope: the design is a whole organism and the desired function is a whole-body property. NO changed parameter drives a body-level object in this design.' }];
  }
  const known = rows.map(t => {
    const p = PJ[t.id] || null;
    const annotated = p?.genes || [];
    const swept = annotated.filter(g => geneSet.includes(g.s));
    return {
      id: t.id, label: t.label || p?.label || null, level, in_3d_blueprint: p ? !!p.in_blueprint : null,
      objects_in_the_design_at_this_scale: (t.objects || []).map(o => o.object),
      geometry_basis: uniq((t.objects || []).map(o => o.geometry_basis)),
      hypothetical: (t.objects || []).some(o => o.hypothetical),
      genes_annotated_here: annotated.length,
      genes_annotated_here_and_swept: swept.map(g => g.s),
      layers_with_a_record_here: uniq(annotated.flatMap(g => g.l || [])),
      ontology_source: t.ontology_source ?? null,
      ...(t.via ? { reached_via: t.via } : {}),
    };
  });
  const unknown = [];
  if (!rows.length) {
    if (level === 'cell') unknown.push('NO CELL-SCALE OBJECT EXISTS. Every blueprint3d anatomy manifest declares its levels as "body / organ system / organ / tissue" and every one of its objects is level organ or tissue (checked across all six manifests: 96-108 organ, 4 tissue, 0 cell). There is no cell-type geometry, no cell-type parameter and no cell count in any design, so the cell scale of this design is entirely unassessed. omics/index/parts.json holds 8 CL: cell terms, but none is linked to a design object.');
    else {
      unknown.push(`no anatomy term at the ${level} scale is driven by any changed parameter, so this scale was not reached by the difference set`);
      const atLevel = (manifest?.objects || []).filter(o => o.level === level);
      if (atLevel.length) unknown.push(`the design DOES carry ${atLevel.length} object(s) at the ${level} scale -- ${atLevel.map(o => `${o.object} (driven by ${(o.driven_by_parameters || []).join(', ') || 'nothing'})`).join('; ')} -- and NONE of them is driven by any of the changed parameter(s) ${changedParams.join(', ') || '(none)'}. The design therefore changes the scale above without changing these, which is a gap in the design, not only in the data.`);
      else unknown.push(`the design carries no object at the ${level} scale at all (the manifest declares its levels as "${manifestLevels ?? 'unstated'}"), so there is nothing to assess here`);
    }
  }
  for (const r of known) {
    if (r.genes_annotated_here === 0) unknown.push(`${r.label || r.id}: no gene in the omics universe is annotated at this term, so nothing is known here molecularly`);
    else if (!r.genes_annotated_here_and_swept.length) unknown.push(`${r.label || r.id}: ${r.genes_annotated_here} gene(s) are annotated here but NONE is in the swept gene set, so the molecular detail at this scale was not read`);
    else if (r.genes_annotated_here > r.genes_annotated_here_and_swept.length) unknown.push(`${r.label || r.id}: ${r.genes_annotated_here - r.genes_annotated_here_and_swept.length} of ${r.genes_annotated_here} genes annotated here were NOT swept (the sweep covers the focal panel plus edited genes, not every annotated gene)`);
    if (r.geometry_basis.includes('schematic')) unknown.push(`${r.label || r.id}: the geometry is schematic, so its size and position are a drawing, not a measurement`);
  }
  const coverage = {
    terms_at_this_scale: known.length,
    terms_with_any_molecular_record: known.filter(r => r.genes_annotated_here > 0).length,
    terms_with_a_swept_gene: known.filter(r => r.genes_annotated_here_and_swept.length > 0).length,
    fraction_with_a_swept_gene: known.length ? +(known.filter(r => r.genes_annotated_here_and_swept.length > 0).length / known.length).toFixed(4) : 0,
    manifest_declares_levels: manifestLevels ?? null,
    // A scale is ASSESSABLE only when a term at it was reached AND something is known there molecularly.
    // A term with no gene annotated against it has been named, not assessed.
    assessable: known.some(r => r.genes_annotated_here > 0),
    assessable_rule: 'a term at this scale was reached by the difference set AND at least one gene in the omics universe is annotated against it; naming a term is not assessing it',
  };
  return { scale: level, kind: 'anatomical', known, unknown: uniq(unknown), coverage };
}

// -------------------------------------------------------------------------------- the whole sweep

/**
 * @param {object} a
 * @param {Array}  a.differences  [{kind:'parameter'|'gene', parameter?, gene?, base_value?, generated_value?, ...}]
 * @param {object} a.manifest     the generated design's blueprint3d manifest (or null)
 * @param {Array}  a.requirements the analogue's requirement set
 * @param {object} a.focal        sequences/genes.json focal panel, as analogue.mjs read it
 * @param {object} a.genotypeSim  the scorer's genotype_similarity (for per-site conservation of real edits)
 */
export function multiScaleSweep({ differences = [], manifest = null, requirements = [], focal = null, genotypeSim = null, extraGenes = [] } = {}) {
  const changedParams = differences.filter(d => d.kind === 'parameter').map(d => d.parameter);
  const editedGenes = differences.filter(d => d.kind === 'gene').map(d => d.gene).filter(Boolean);
  const touched = anatomyTouched(manifest, changedParams);
  const anatomyIds = touched.terms.map(t => t.id);

  // The gene set swept: the focal panel (the only genes with a called analogue orthologue) plus any edited gene,
  // plus anything the caller added. Everything else annotated at the touched anatomy is counted, not read.
  const focalSymbols = (focal?.genes || []).map(g => g.symbol);
  const geneSet = uniq([...focalSymbols, ...editedGenes, ...extraGenes]);
  const PJ = parts();
  const annotatedAtTouched = uniq(anatomyIds.flatMap(id => (PJ[id]?.genes || []).map(g => g.s)));

  const cards = new Map();
  for (const g of geneSet) cards.set(g, geneCard(g));
  const missingCards = geneSet.filter(g => !cards.get(g));

  const scales = {};
  const perGene = {
    sequence_genomic: [], transcriptomic: [], proteomic: [], ptm: [], pathway: [],
  };
  for (const g of geneSet) {
    const c = cards.get(g);
    if (!c) continue;
    perGene.sequence_genomic.push(sweepGenomic(g, c, { anatomyIds, focal, genotypeSim }));
    perGene.transcriptomic.push(sweepTranscriptomic(g, c, { anatomyIds }));
    perGene.proteomic.push(sweepProteomic(g, c, { anatomyIds }));
    perGene.ptm.push(sweepPtm(g, c));
    perGene.pathway.push(sweepPathway(g, c));
  }

  const idx = readJson('omics/index/INDEX.json');
  for (const layer of OMICS_LAYERS) {
    const scale = layer === 'genomic' ? 'sequence_genomic' : layer;
    const rows = perGene[scale];
    const withAny = rows.filter(r => r.n_records > 0).length;
    const withMulti = rows.filter(r => r.multi_source_records > 0).length;
    const man = readJson(`omics/${layer}/MANIFEST.json`);
    scales[scale] = {
      scale, kind: 'molecular', layer,
      genes_swept: rows.length,
      per_gene: rows,
      unknown: uniq(rows.flatMap(r => r.unknown)),
      coverage: {
        genes_swept: rows.length,
        genes_in_the_sweep_set: geneSet.length,
        gene_cards_absent: missingCards,
        genes_with_at_least_one_record: withAny,
        fraction_of_swept_genes_with_a_record: rows.length ? +(withAny / rows.length).toFixed(4) : 0,
        genes_with_two_or_more_independent_sources_agreeing: withMulti,
        fraction_with_corroboration: rows.length ? +(withMulti / rows.length).toFixed(4) : 0,
        genes_annotated_at_the_touched_anatomy_but_NOT_swept: Math.max(0, annotatedAtTouched.length - rows.filter(r => annotatedAtTouched.includes(r.gene)).length),
        genes_annotated_at_the_touched_anatomy_total: annotatedAtTouched.length,
        layer_rows_in_the_repository: man?.rows ?? idx?.layers?.[layer]?.rows ?? null,
        layer_genes_in_the_repository: man?.genes_covered ?? idx?.layers?.[layer]?.genes ?? null,
        layer_status: man?.status ?? idx?.layers?.[layer]?.status ?? null,
        assessable: rows.length > 0 && withAny > 0,
      },
    };
    if (!rows.length) scales[scale].unknown.unshift(`no gene was swept at the ${scale} scale: the difference set names no gene and the focal panel could not be read, so this scale is UNASSESSED rather than clear`);
  }

  for (const level of ANATOMY_SCALES) scales[level] = anatomyScale(level, touched.terms, { manifestLevels: manifest?.levels ?? null, geneSet, manifest, changedParams });

  // Requirements of the analogue, mapped onto the scales at which each one could even be checked.
  const reqScales = requirements.map(r => {
    const t = `${r.requirement} ${r.id}`.toLowerCase();
    const at = [];
    if (/area|span|loading|fin|caudal/.test(t)) at.push('organ', 'tissue');
    if (/speed|launch|beats|glide/.test(t)) at.push('body');
    if (/thermal|window|temperature/.test(t)) at.push('body', 'organ_system');
    const reachable = uniq(at).filter(s => scales[s]?.coverage?.assessable);
    return { id: r.id, requirement: r.requirement, value: r.value ?? null, unit: r.unit ?? null, source: r.source, kind: r.kind,
      scales_at_which_it_would_be_checked: uniq(at), scales_actually_assessable: reachable,
      checkable_here: reachable.length > 0,
      ...(reachable.length ? {} : { why_not: 'none of the scales at which this requirement lives is assessable from the data on hand' }) };
  });

  return {
    note: 'Every row below is a PROXY-species annotation (zebrafish, medaka, Mexican tetra) or an annotation borrowed from a human/mouse orthologue. None is a measurement of the designed organism, and none is a measurement of the flying fish. Absence of a row means "not recorded", never "not present".',
    difference_set: { parameters_changed: changedParams, genes_edited: editedGenes, n_differences: differences.length },
    anatomy_reached: { ...touched, terms: touched.terms.map(({ objects, ...t }) => ({ ...t, n_objects: objects.length })) },
    gene_set: { swept: geneSet, rule: 'the focal panel from sequences/genes.json (the only genes with a called flying-fish orthologue) plus every gene carrying an edit in the generated design', cards_absent: missingCards,
      genes_annotated_at_the_touched_anatomy: annotatedAtTouched.length,
      not_swept: Math.max(0, annotatedAtTouched.length - geneSet.filter(g => annotatedAtTouched.includes(g)).length),
      coverage_statement: `${geneSet.filter(g => annotatedAtTouched.includes(g)).length} of the ${annotatedAtTouched.length} genes annotated at the anatomy this design touches were swept. The rest were counted, not read.` },
    requirements_by_scale: reqScales,
    scales,
    per_scale_coverage: Object.fromEntries(SCALES.map(s => [s, scales[s]?.coverage ?? { assessable: false, note: 'scale not computed' }])),
    unassessable_scales: SCALES.filter(s => !scales[s]?.coverage?.assessable),
  };
}
