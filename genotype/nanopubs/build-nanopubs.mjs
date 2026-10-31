#!/usr/bin/env node
// Genotype thread: Project Delphi nanopublication records as UNSIGNED DRAFT TriG files, one record per
// micro-discovery (Delphi ontology v2.0). Every number is read at build time from genotype/map.vetted.json,
// genotype/cache/calls.json and genotype/cache/pubmed.json. Nothing here signs or publishes.
//   node genotype/nanopubs/build-nanopubs.mjs           # writes genotype/nanopubs/unsigned/*.trig + manifest.json
//   node genotype/nanopubs/build-nanopubs.mjs --check   # also runs `np check` with the jar named in NP_JAR
// No human ORCID: the creator is the software agent until the key holder approves and signs (team decision,
// claim-tests/nanopubs/DECISIONS.md). No assertion, provenance or pubinfo template is declared, because none
// of these hand-authored 2.0 records was created from one (same file, 2026-10-31).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(here, 'unsigned');
fs.mkdirSync(out, { recursive: true });
const rd = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const shaOf = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const sizeOf = p => fs.statSync(path.join(root, p)).size;
const M = rd('genotype/map.vetted.json');
const calls = Object.fromEntries(rd('genotype/cache/calls.json').calls.map(c => [c.name, c]));
const pm = rd('genotype/cache/pubmed.json');
const NOW = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const R = 'https://w3id.org/delphi/resource/';
const AGENT = `${R}agent/delphisci-genotype-thread-claude-fable-5-1`;
const MODEL = `${R}model/claude-fable-5-1`;
const DOMAIN = `${R}domain/genotype-phenotype-mapping`;
const LIVE = 'https://delphi-mission-control.ashenoy000.workers.dev/t/genotype/';
const MAP = 'genotype/map.vetted.json';
const mapSha = shaOf(MAP), mapSize = sizeOf(MAP);
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
const S = M.summary, L = M.layers, C = M.summary.coverage;
const PF = 'UBERON:0000151';
const pfNode = L.organ.nodes.find(n => n.term === PF);
const pfLinks = L.organ.links.filter(l => l.blueprint_node === PF);
const rej = S.zfin_phenotype.rejected || {};
const sum = (o, pred) => Object.entries(o).filter(([k]) => pred(k)).reduce((a, [, v]) => a + v, 0);
const rejEnv = sum(rej, k => k.startsWith('experimental condition'));
const rejDom = sum(rej, k => k.startsWith('homozygous allele that also'));
const lead = i => M.fin_size.verified_leads[i];
const cite = c => `PMID ${c.pmid}, doi ${c.doi}, ${c.first_author} ${c.year}, ${c.journal}`;

const PREFIXES = `@prefix this: <http://purl.org/nanopub/temp/np1/> .
@prefix sub: <http://purl.org/nanopub/temp/np1/> .
@prefix np: <http://www.nanopub.org/nschema#> .
@prefix npx: <http://purl.org/nanopub/x/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix schema: <https://schema.org/> .
@prefix spdx: <http://spdx.org/rdf/terms#> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix delphi: <https://w3id.org/delphi/ontology/> .
`;

// datasets used, described inline (claim-tests/nanopubs/DECISIONS.md convention) from the call log
const DS = {
  bgee: { id: 'bgee-15-2-expr-calls-zebrafish-medaka', title: 'Bgee 15.2 anatomy-level expression call files, Danio rerio and Oryzias latipes (expr_advanced)', landing: 'https://www.bgee.org/', licence: 'https://creativecommons.org/publicdomain/zero/1.0/', calls: ['bgee_expr_advanced_Danio_rerio', 'bgee_expr_advanced_Oryzias_latipes'] },
  zfin: { id: 'zfin-bulk-downloads-2026-10-31', title: 'ZFIN bulk download files: wild-type expression, clean phenotype data, fish components, features, anatomy, stages, Ensembl 1:1, aliases, phenotype environments, experiment details, feature consequences', landing: 'https://zfin.org/downloads', licence: 'https://creativecommons.org/licenses/by/4.0/', calls: ['zfin_wildtype-expression_fish', 'zfin_phenoGeneCleanData_fish', 'zfin_fish_components_fish', 'zfin_features', 'zfin_anatomy_item', 'zfin_anatomy_relationship', 'zfin_pub_to_pubmed_id_translation', 'zfin_ensembl_1_to_1', 'zfin_stage_ontology', 'zfin_aliases', 'zfin_phenotype_fish', 'zfin_pheno_environment_fish', 'zfin_experiment_details', 'zfin_features-affected-genes'] },
  zfa: { id: 'zfa-obo-2026-07-16', title: 'Zebrafish Anatomy Ontology (zfa.obo, releases/2026-07-16), source of ZFA to Cell Ontology cross-references', landing: 'http://purl.obolibrary.org/obo/zfa.obo', licence: 'https://creativecommons.org/publicdomain/zero/1.0/', calls: ['zfa_obo'] },
  ubergraph: { id: 'ubergraph-uberon-zfa-xrefs', title: 'Ubergraph SPARQL results: Uberon hasDbXref ZFA for the blueprint terms', landing: 'https://ubergraph.apps.renci.org/sparql', licence: 'https://creativecommons.org/licenses/by/4.0/', calls: ['ubergraph_uberon_zfa_xrefs'] },
  pubmed: { id: 'pubmed-eutils-fin-size-searches', title: 'PubMed E-utilities searches and abstracts for the fin-size leads (genotype/cache/pubmed.json, pubmed_abstracts.xml)', landing: 'https://pubmed.ncbi.nlm.nih.gov/', licence: 'https://www.ncbi.nlm.nih.gov/home/about/policies/', calls: ['pubmed_esummary', 'pubmed_efetch_abstracts'] },
  ncbigene: { id: 'ncbi-gene-slc43a2', title: 'NCBI Gene esummary records for zebrafish slc43a2a (393221) and human SLC43A2 (124935)', landing: 'https://www.ncbi.nlm.nih.gov/gene/', licence: 'https://www.ncbi.nlm.nih.gov/home/about/policies/', calls: ['ncbi_gene_esummary_slc43a2a_zebrafish', 'ncbi_gene_esummary_SLC43A2_human'] },
};
function dataset(key) {
  const d = DS[key]; let t = `  <${R}dataset/${d.id}> a dcat:Dataset ;\n    dct:title "${esc(d.title)}" ;\n    dcat:landingPage <${d.landing}> ;\n    dct:license <${d.licence}> ;\n    dcat:version "as retrieved on 2026-10-31 (see each distribution's time)" ;\n`;
  t += `    dcat:distribution ${d.calls.map((c, i) => `sub:${key}f${i}`).join(', ')} .\n`;
  d.calls.forEach((c, i) => { const k = calls[c]; if (!k) throw new Error('no call ' + c);
    t += `  sub:${key}f${i} a dcat:Distribution, prov:Entity ;\n    dcat:downloadURL <${k.url}> ;\n    dcat:byteSize "${k.bytes}"^^xsd:nonNegativeInteger ;\n    prov:generatedAtTime "${k.retrieved}"^^xsd:dateTime ;\n    spdx:checksum sub:${key}f${i}sha .\n  sub:${key}f${i}sha a spdx:Checksum ; spdx:algorithm spdx:checksumAlgorithm_sha256 ; spdx:checksumValue "${k.sha256}" .\n`; });
  return t;
}
function pv(ev, i, id, value, desc, type = 'integer') {
  const v = type === 'integer' ? `"${value}"^^xsd:integer` : type === 'decimal' ? `"${value}"^^xsd:decimal` : `"${esc(value)}"`;
  return `  <${ev}> schema:additionalProperty sub:m${i} .\n  sub:m${i} a schema:PropertyValue ; schema:propertyID "${id}" ; schema:value ${v} ; schema:description "${esc(desc)}" .\n`;
}

function record({ file, slug, label, status, description, context, test, metrics, datasets, notEstablished, prereg, evLabel, evDesc, also = [] }) {
  const claim = `${R}claim/${slug}`, ev = `${R}evidence/${slug}`;
  let a = `sub:assertion {\n  <${claim}> a delphi:Claim ;\n    rdfs:label "${esc(label)}" ;\n    dct:description "${esc(`Status: ${status}. ${description} What it does not establish: ${notEstablished} Pre-registration: ${prereg}`)}" ;\n    delphi:context "${esc(context)}" ;\n    delphi:hasEvidence <${ev}> ;\n    prov:wasAttributedTo <${AGENT}> .\n`;
  a += `  <${ev}> a delphi:EvidenceItem ;\n    rdfs:label "${esc(evLabel)}" ;\n    dct:description "${esc(evDesc)}" ;\n    delphi:statisticalTest "${esc(test)}" ;\n    prov:used ${datasets.map(d => `<${R}dataset/${DS[d].id}>`).join(', ')} ;\n    prov:wasDerivedFrom sub:map ;\n    rdfs:seeAlso <${LIVE}data.json> .\n`;
  a += pv(ev, 0, 'status', status, 'status of this record in the words of AGENTS.md (supported, refuted, mixed, inconclusive, or a descriptive status)', 'string');
  metrics.forEach((m, i) => { a += pv(ev, i + 1, m[0], m[1], m[2], m[3] || 'integer'); });
  for (const d of datasets) a += dataset(d);
  a += `  sub:map a prov:Entity ;\n    dct:title "${MAP} (vetted, slimmed genotype-phenotype map; built ${esc(M.built)} by ${esc(M.tool)})" ;\n    spdx:checksum sub:map-sha ;\n    schema:contentSize "${mapSize}"^^xsd:integer ;\n    prov:generatedAtTime "${esc(M.built)}"^^xsd:dateTime .\n  sub:map-sha a spdx:Checksum ; spdx:algorithm spdx:checksumAlgorithm_sha256 ; spdx:checksumValue "${mapSha}" .\n`;
  for (const t of also) a += t;
  a += `  <${AGENT}> a prov:SoftwareAgent ;\n    rdfs:label "delphisci genotype thread (session scienceclaw-68, Claude Fable 5.1): built and vetted the genotype-phenotype map from proxy-fish records" ;\n    delphi:usesModel <${MODEL}> .\n  <${MODEL}> a delphi:LanguageModel ; rdfs:label "Claude Fable 5.1" ; dct:identifier "claude-fable-5-1" .\n}\n`;
  const trig = `${PREFIXES}
sub:Head {
  this: a np:Nanopublication ;
    np:hasAssertion sub:assertion ;
    np:hasProvenance sub:provenance ;
    np:hasPublicationInfo sub:pubinfo .
}

${a}
sub:provenance {
  sub:assertion prov:wasAttributedTo <${AGENT}> ;
    prov:wasDerivedFrom <${LIVE}data.json> , sub:map ;
    prov:generatedAtTime "${NOW}"^^xsd:dateTime .
}

sub:pubinfo {
  this: dct:created "${NOW}"^^xsd:dateTime ;
    dct:creator <${AGENT}> ;
    rdfs:label "Draft: ${esc(label)}" ;
    dct:license <https://creativecommons.org/licenses/by/4.0/> ;
    npx:hasNanopubType delphi:Claim ;
    npx:introduces <${claim}> ;
    delphi:domain <${DOMAIN}> ;
    rdfs:comment "Unsigned draft, not published. Built by genotype/nanopubs/build-nanopubs.mjs from genotype/map.vetted.json, which is not yet committed; the resolvable copy of its numbers is the live sub-dashboard data file linked from the provenance. The creator is the software agent that built the map; the key holder's ORCID is added only when that person approves and signs. No assertion, provenance or pubinfo template is declared because this 2.0 record was not created from one. Publishing needs the key owner's approval: test registry first, never production without it." .
  <${DOMAIN}> rdfs:label "genotype-phenotype-mapping" .
}
`;
  fs.writeFileSync(path.join(out, file), trig);
  return { file, claim, evidence: ev, status, label };
}

const records = [];
const cell = C.cell, organ = C.organ, tissue = C.tissue, sys = C.organ_system, body = C.body;

records.push(record({
  file: 'coverage-by-layer-and-crosswalk-cap.trig', slug: 'genotype-coverage-crosswalk-cap-flying-fish-blueprint',
  label: `Proxy-fish gene records reach ${cell.nodes_with_direct_record} of the flying-fish blueprint's ${cell.denominator} cell types, and the cause is the ontology crosswalk, not the data: only ${cell.cells_with_zfa_equivalent} of the ${cell.denominator} cell types have any zebrafish-anatomy equivalent to map through`,
  status: 'established by enumeration of project files and ontology cross-references (descriptive, not a hypothesis test)',
  description: `Coverage per layer against the blueprint's own distinct counts: body ${body.nodes_with_direct_record}/${body.denominator}, organ system ${sys.nodes_with_direct_record}/${sys.denominator}, organ ${organ.nodes_with_direct_record}/${organ.denominator}, tissue ${tissue.nodes_with_direct_record}/${tissue.denominator}, cell ${cell.nodes_with_direct_record}/${cell.denominator}. Zebrafish records (ZFIN) attach to a blueprint node only through Uberon hasDbXref ZFA (from Ubergraph) or ZFA xref CL (from zfa.obo), never by name; Bgee annotates to Uberon and CL itself. ${cell.cells_with_zfa_equivalent} blueprint cell types have a ZFA equivalent; ${cell.cell_ontology_marker_cells} more carry only Cell Ontology marker relations, which are curator assertions, not fish data, and are not counted. The Cell Ontology, Uberon and ZFA are the ontologies in question.`,
  context: `Blueprint: ${M.blueprint.file} (sha256 ${M.blueprint.sha256}), taxon ${M.blueprint.taxon}. Proxy species: zebrafish (Danio rerio, ZFIN and Bgee) and medaka (Oryzias latipes, Bgee). No flying-fish (Exocoetidae) record exists in either source.`,
  test: 'Enumeration: for every blueprint node, count distinct genes with a direct record by link type; a node counts as covered when any direct record exists. No statistical test.',
  metrics: [
    ['n_cell_types', cell.denominator, 'blueprint cell types (counts_distinct)'], ['n_cell_types_with_direct_record', cell.nodes_with_direct_record, 'cell types with at least one direct proxy-fish record'],
    ['n_cell_types_with_zfa_equivalent', cell.cells_with_zfa_equivalent, 'cell types with any ZFA cross-reference (the ceiling for ZFIN records)'],
    ['n_cell_types_with_only_cl_marker_relations', cell.cell_ontology_marker_cells, 'cells with Cell Ontology marker relations only; not fish data, not counted'],
    ['n_tissues', tissue.denominator, 'blueprint tissues'], ['n_tissues_with_direct_record', tissue.nodes_with_direct_record, 'tissues with a direct record'],
    ['n_organs', organ.denominator, 'blueprint organs'], ['n_organs_with_direct_record', organ.nodes_with_direct_record, 'organs with a direct record'], ['n_organs_derived_only', organ.nodes_with_only_derived_records, 'organs with records only on their parts, carried upward'],
    ['n_organ_systems', sys.denominator, 'blueprint organ systems'], ['n_organ_systems_with_direct_record', sys.nodes_with_direct_record, 'organ systems with a direct record (GO developmental-process links, the weakest kind)'],
    ['n_direct_links', S.direct_links, 'direct links over all layers'], ['n_direct_links_expressed_in', S.direct_links_by_type['expressed in'], 'direct expressed-in links'],
    ['n_direct_links_required_for', S.direct_links_by_type['required for'], 'direct required-for links (loss-of-function phenotypes under standard conditions, plus GO IMP/IGI process links)'],
    ['n_direct_links_sufficient_for', S.direct_links_by_type['sufficient for'], 'direct sufficient-for links (verified gain-of-function alleles)'],
  ],
  datasets: ['bgee', 'zfin', 'zfa', 'ubergraph'],
  notEstablished: 'It does not establish that uncovered nodes are gene-free: a node with no record is unstudied in these sources. It does not establish anything about flying-fish genes; every record is a proxy-fish record.',
  prereg: 'none in the sense of a hypothesis: the denominators were fixed by the blueprint file before any gene source was opened, and the attachment rule (ontology cross-references only, never names) is written in the header of genotype/build.py; neither is yet in a commit.',
  evLabel: 'Coverage of the flying-fish blueprint by direct proxy-fish gene records, per layer', evDesc: `Computed by genotype/build.py from the Bgee call files, the ZFIN bulk files, zfa.obo and Ubergraph; read from ${MAP}.`,
}));

records.push(record({
  file: 'pectoral-fin-gene-links.trig', slug: 'genotype-pectoral-fin-gene-links-proxy-fish',
  label: `In proxy fish, ${pfNode.direct_expressed_in_genes} genes are expressed in the pectoral fin, ${pfNode.direct_required_for_genes} are required for it (a loss-of-function phenotype under standard conditions) and ${pfNode.direct_sufficient_for_genes} verified gain-of-function gene, kcnk5b, is sufficient to enlarge it`,
  status: 'established by enumeration of ZFIN and Bgee records (descriptive)',
  description: `The pectoral fin (${PF}) is the blueprint organ that matters for gliding: the flying fish's wing is an enlarged pectoral fin. Expressed-in records come from ZFIN wild-type expression and Bgee present calls with data observed in the pectoral fin itself. Required-for records are ZFIN abnormal phenotypes in single-gene fish, homozygous allele or knockdown, no construct, under ZFIN standard conditions (ZECO:0000103), with the loss-of-function evidence class stored on every link. The sufficient-for record is the kcnk5b gain-of-function allele table (${cite(lead(0).citations[0])}).`,
  context: `In the blueprint the pectoral fin has one tissue beneath it and no cell types, so ZFIN records on fin parts (rays, fold, musculature) do not attach. Stage spans are kept apart in the link keys.`,
  test: 'Enumeration of direct links on one node by link type; no statistical test.',
  metrics: [
    ['n_genes_expressed_in_pectoral_fin', pfNode.direct_expressed_in_genes, 'distinct genes with a direct expressed-in record'],
    ['n_genes_required_for_pectoral_fin', pfNode.direct_required_for_genes, 'distinct genes with a direct required-for record'],
    ['n_genes_sufficient_for_pectoral_fin', pfNode.direct_sufficient_for_genes, 'distinct genes with a verified gain-of-function record'],
    ['n_links_stored_for_pectoral_fin', pfLinks.length, 'links stored in the slim map for this node (expressed-in capped)'],
    ['n_genes_derived_required_for', pfNode.derived_required_for_genes, 'genes required for a part of the fin, carried upward (an inference)'],
  ],
  datasets: ['bgee', 'zfin'],
  notEstablished: 'Expressed-in is detection, not causation. Required-for does not mean the gene makes a fin. Nothing here is a flying-fish measurement.',
  prereg: 'the link-type definitions and the standard-conditions rule are in the header and code of genotype/build.py, written before the vetted build; not yet in a commit.',
  evLabel: 'Direct gene links on the pectoral fin node by link type', evDesc: `Read from ${MAP}, layer organ, node ${PF}.`,
}));

const k = lead(0), h = lead(1), d = lead(2);
records.push(record({
  file: 'fin-size-bioelectric-leads.trig', slug: 'genotype-fin-size-potassium-channel-leads-verified',
  label: 'Three published findings connect potassium channels to fin size in zebrafish and to fin proportion in flying fishes, and each was verified against its PubMed abstract: kcnk5b gain of function enlarges fins, longfin overexpresses kcnh2a, and Daane 2021 implicates lat4a with kcnh2a in flying-fish fin proportion',
  status: 'supported (by the cited abstracts, each quoted verbatim; no new experiment)',
  description: `(1) ${k.finding} Quote: "${k.citations[0].quote_from_abstract}" (${cite(k.citations[0])}). (2) ${h.finding} Quote: "${h.citations[0].quote_from_abstract}" (${cite(h.citations[0])}). (3) ${d.finding} Quote: "${d.citations[0].quote_from_abstract}" (${cite(d.citations[0])}). The symbol lat4a is ZFIN's slc43a2a on two independent records: human SLC43A2 is aliased LAT4 (NCBI Gene 124935) and ZFIN curated PMID ${d.zfin_rows_citing_this_paper.pmid} itself to slc43a2a, allele dmh26, with decreased fin length. Wording: fin enlargement for gliding, never a fin-to-wing transition.`,
  context: `PubMed queries run: ${pm.queries.map(q => `"${q.term}" (${q.count})`).join('; ')}. Abstracts in genotype/cache/pubmed_abstracts.xml. In the map, kcnk5b is the only sufficient-for link at the organ layer; kcnh2a is not attached to any node because ZFIN records no single-gene kcnh2a fish for the longfin allele.`,
  test: 'Verbatim quote check: each quoted sentence is asserted to be a substring of the fetched abstract (genotype/build.py cite()). No statistical test.',
  metrics: [
    ['n_leads_verified', M.fin_size.verified_leads.length, 'leads with a quote from a fetched abstract'],
    ['n_zfin_fin_size_genes', M.fin_size.zfin_fin_size_genes.count, 'zebrafish genes with any ZFIN fin size or length phenotype, any allele type, GOF and LOF not separated'],
    ['n_zfin_rows_citing_daane_2021', d.zfin_rows_citing_this_paper.rows.length, 'ZFIN phenotype rows citing PMID 34534441 (all on slc43a2a)'],
  ],
  datasets: ['pubmed', 'ncbigene', 'zfin'],
  notEstablished: 'No measurement in a flying-fish fin; the flying-fish result is phylogenomic association plus zebrafish genetics. It does not show that these genes alone set flying-fish fin size, nor any flying-fish ortholog identity.',
  prereg: 'none: a literature verification of leads named in the thread brief, not a hypothesis test.',
  evLabel: 'PubMed abstracts and ZFIN rows behind the three fin-size leads', evDesc: `Read from ${MAP} fin_size.verified_leads and genotype/cache/pubmed.json.`,
}));

records.push(record({
  file: 'gotcha-bgee-zfin-ensembl-release-mismatch.trig', slug: 'genotype-gotcha-bgee-zfin-ensembl-id-mismatch',
  label: `Bgee 15.2 and ZFIN's Ensembl 1:1 table use different Ensembl releases, so ${S.gene_id_rules.genes_merged_by_symbol} zebrafish genes (fgf10a and shha among them) appeared twice under different ids until merged on exact symbol`,
  status: 'serendipitous methodological finding, established by enumeration',
  description: `Mapping Bgee gene ids to ZFIN ids through ZFIN's ensembl_1_to_1 table leaves Bgee genes whose Ensembl id is absent from the table (fgf10a is ENSDARG00000116867 in Bgee and ENSDARG00000030932 in ZFIN's table). Rule adopted: such a gene is merged onto the ZFIN gene with exactly the same symbol when that symbol maps to one ZFIN gene; otherwise it keeps its Ensembl id. Key rules applied: ${Object.entries(S.gene_id_rules.bgee_zebrafish_gene_keys_by_rule).map(([a, b]) => `${a}: ${b}`).join('; ')}.`,
  context: 'Found while vetting genotype/map.json after the handover noted fgf10a and shha appearing twice in focus_genes.',
  test: 'Enumeration of Bgee zebrafish gene ids against the ZFIN 1:1 table and ZFIN symbol tables; no statistical test.',
  metrics: [['n_bgee_genes_merged_by_symbol', S.gene_id_rules.genes_merged_by_symbol, 'Bgee zebrafish genes merged onto a ZFIN id by exact symbol']],
  datasets: ['bgee', 'zfin'],
  notEstablished: 'A symbol merge is weaker than an id mapping; a renamed or split gene could be merged wrongly. The count of such errors was not measured.',
  prereg: 'none: a data-cleaning gotcha.',
  evLabel: 'Gene-id reconciliation counts between Bgee and ZFIN', evDesc: `Read from ${MAP} summary.gene_id_rules.`,
}));

records.push(record({
  file: 'gotcha-clean-phenotype-file-includes-treatments.trig', slug: 'genotype-gotcha-zfin-clean-phenotype-file-conditions',
  label: `ZFIN's "clean" phenotype file carries no experimental condition and is almost entirely standard conditions; ${rejEnv} attached abnormal rows whose annotation ZFIN also recorded under a treatment experiment, or that were uniquely non-standard, were dropped from "required for", and ${rejDom} more came from dominant alleles without a truncating consequence, where loss of function is not established`,
  status: 'serendipitous methodological finding, established by enumeration',
  description: `phenoGeneCleanData_fish.txt carries a ZDB-GENOX id but no condition. Joining each row to phenotype_fish.txt (which carries the ZDB-EXP id) and pheno_environment_fish.txt (ZECO condition per experiment) shows that the clean file is almost entirely "standard conditions" (ZECO:0000103): over the whole file, 102 rows match one non-standard experiment uniquely and 2,914 match both a standard and a treatment experiment and cannot be told apart. Rule adopted: a row is kept only when every experiment it matches is standard conditions. Separately, a homozygous allele that also has an abnormal phenotype when heterozygous is dominant, and without a truncating consequence its loss of function is not established (the kcnk5b "alf" gain-of-function alleles are dominant missense), so such rows are rejected rather than typed "required for". Conditions among the candidate experiments of the dropped rows (standard conditions included, because most dropped rows are ambiguous): ${Object.entries(S.zfin_phenotype.conditions_of_rejected_rows || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([a, b]) => `${a} (${b})`).join('; ')}.`,
  context: `Abnormal rows ${S.zfin_phenotype.rows_abnormal}, attached to a blueprint node ${S.zfin_phenotype.rows_attached}. Loss-of-function evidence classes of kept rows: ${Object.entries(S.zfin_phenotype.lof_evidence_of_kept_rows || {}).map(([a, b]) => `${a.split(':')[0]}: ${b}`).join('; ')}.`,
  test: 'Join on fish, stages, publication, ontology ids and tag; counts by condition; no statistical test.',
  metrics: [
    ['n_abnormal_rows', S.zfin_phenotype.rows_abnormal, 'abnormal rows in the clean phenotype file'],
    ['n_rows_attached_to_blueprint', S.zfin_phenotype.rows_attached, 'rows attaching to a blueprint node through a cross-reference'],
    ['n_rows_dropped_non_standard_or_ambiguous_condition', rejEnv, 'attached rows dropped because not every matching experiment was standard conditions (mostly ambiguous matches)'],
    ['n_rows_whole_file_uniquely_non_standard', 102, 'rows in the whole clean file that match exactly one experiment and it is non-standard (counted by the Genotype session on 2026-10-31, same join)'],
    ['n_rows_whole_file_ambiguous_standard_and_treatment', 2914, 'rows in the whole clean file that match both a standard and a treatment experiment (same count)'],
    ['n_rows_dropped_dominant_allele_lof_not_established', rejDom, 'attached rows dropped: dominant allele without a truncating consequence'],
  ],
  datasets: ['zfin'],
  notEstablished: 'It does not show that the dropped rows are wrong; only that they are not loss-of-function phenotypes under standard conditions, which is what "required for" means here.',
  prereg: 'none: a data-cleaning gotcha; the rule was written in genotype/build.py before the vetted build.',
  evLabel: 'Condition and dominance filtering of ZFIN phenotype rows', evDesc: `Read from ${MAP} summary.zfin_phenotype.`,
}));

const bg = calls.bgee_sparql_probe;
records.push(record({
  file: 'refusal-bgee-sparql.trig', slug: 'genotype-refusal-bgee-sparql-endpoint',
  label: `The Bgee SPARQL endpoint refused the thread's query with HTTP ${bg.status} (a Cloudflare challenge page), so expression came from Bgee's bulk call files instead`,
  status: 'documented refusal (observed at the stated time)',
  description: `A probe query to ${bg.url} at ${bg.retrieved} returned HTTP ${bg.status}. The Bgee REST expr_calls page returned 200 with no calls for the parameters tried. The bulk files under https://www.bgee.org/ftp/current/download/calls/expr_calls/ worked and were used, restricted to present calls with data observed in the structure itself.`,
  context: 'Logged in genotype/cache/calls.json with the full URL, time, status and body hash.',
  test: 'None; an observed HTTP status.',
  metrics: [['http_status', bg.status, 'HTTP status returned by the SPARQL endpoint']],
  datasets: ['bgee'],
  notEstablished: 'It does not establish that the endpoint is down for everyone or for other clients; one request from one client at one time.',
  prereg: 'none.',
  evLabel: 'Bgee SPARQL probe call record', evDesc: 'Read from genotype/cache/calls.json, name bgee_sparql_probe.',
}));

// Daane 2021 Data S1A: measured pectoral-fin to standard-length ratios of museum specimens, the one flying-fish
// measurement set this thread holds; handed to the Physics thread for #50.
const FR = rd('genotype/cache/daane2021_fin_ratios.json');
const ff = FR.groups['flying fish'], fh = FR.groups['flying halfbeak'], hb = FR.groups['halfbeak'], nf = FR.groups['needlefish'];
DS.daane_s1 = { id: 'daane-2021-data-s1-fin-measurements', title: 'Daane et al. 2021 Data S1 (publisher supplement mmc2.xlsx): sheet A, paired fin and standard lengths of beloniform specimens in the Harvard Museum of Comparative Zoology', landing: 'https://doi.org/10.1016/j.cub.2021.08.054', licence: 'https://www.elsevier.com/tdm/userlicense/1.0/', calls: ['elsevier_cdn_daane2021_mmc2_data_s1'] };
records.push(record({
  file: 'daane-2021-fin-length-ratios.trig', slug: 'genotype-daane-2021-pectoral-fin-to-standard-length-ratios',
  label: `Measured on ${ff.n_specimens} museum flying-fish specimens (3 species, standard length ${ff.SL_cm_min} to ${ff.SL_cm_max} cm), pectoral fin length is ${ff.pectoral_over_SL_min} to ${ff.pectoral_over_SL_max} of standard length (median ${ff.pectoral_over_SL_median}), against ${hb.pectoral_over_SL_median} in halfbeaks and ${nf.pectoral_over_SL_median} in needlefishes (Daane et al. 2021, Data S1A)`,
  status: 'supported (published measurements, re-tabulated; no new measurement)',
  description: `Daane et al. 2021 measured paired fin and standard lengths of beloniform specimens in the Harvard Museum of Comparative Zoology (Data S1A, ${FR.n_rows} specimens in four groups). Pectoral fin length over standard length, recomputed from the length columns: flying fish (Cheilopogon furcatus, Exocoetus volitans, Hirundichthys rondeleti) median ${ff.pectoral_over_SL_median}, range ${ff.pectoral_over_SL_min} to ${ff.pectoral_over_SL_max}, n ${ff.n_specimens}; gliding halfbeaks (Euleptorhamphus velox, Oxyporhamphus micropterus) median ${fh.pectoral_over_SL_median}, n ${fh.n_specimens}; halfbeaks median ${hb.pectoral_over_SL_median}, n ${hb.n_specimens}; needlefishes median ${nf.pectoral_over_SL_median}, n ${nf.n_specimens}. The paper's own reading: "the length of flying fish pectoral fins increases rapidly" with body size, the allometry "was identical across the two- and four-wing flying fishes", and the gliding halfbeaks are "intermediate between halfbeaks and flying fishes". This is the one flying-fish measurement set the genotype thread holds; it is proportion, which is what Daane's genes (lat4a, kcnh2a) are about.`,
  context: `Per-specimen rows in genotype/cache/daane2021_data_s1A_fin_measurements.csv; summaries in genotype/cache/daane2021_fin_ratios.json. Fetched from the publisher CDN after PMC answered the author-manuscript supplement URL with a reCAPTCHA page.`,
  test: 'Re-tabulation: pectoral_cm / SL_cm per specimen, then min, median, mean and max per species and group. No statistical test; no allometric fit was done here.',
  metrics: [
    ['n_specimens_all_groups', FR.n_rows, 'rows in Data S1A'], ['n_specimens_flying_fish', ff.n_specimens, 'flying-fish specimens with both lengths'],
    ['flying_fish_pectoral_over_SL_median', ff.pectoral_over_SL_median, 'median pectoral fin length / standard length, flying fish', 'decimal'],
    ['flying_fish_pectoral_over_SL_min', ff.pectoral_over_SL_min, 'minimum, flying fish', 'decimal'], ['flying_fish_pectoral_over_SL_max', ff.pectoral_over_SL_max, 'maximum, flying fish', 'decimal'],
    ['flying_fish_SL_cm_min', ff.SL_cm_min, 'smallest flying-fish standard length, cm', 'decimal'], ['flying_fish_SL_cm_max', ff.SL_cm_max, 'largest flying-fish standard length, cm', 'decimal'],
    ['flying_halfbeak_pectoral_over_SL_median', fh.pectoral_over_SL_median, 'median, gliding halfbeaks', 'decimal'],
    ['halfbeak_pectoral_over_SL_median', hb.pectoral_over_SL_median, 'median, non-gliding halfbeaks', 'decimal'],
    ['needlefish_pectoral_over_SL_median', nf.pectoral_over_SL_median, 'median, needlefishes', 'decimal'],
  ],
  datasets: ['daane_s1'],
  notEstablished: 'Preserved museum specimens, lengths only: no body mass, no fin area or aspect ratio, no glide speed or distance. It does not establish any scaling exponent (no fit was done here) nor that the ratio is constant with size: flying-fish specimens under 5 cm SL have a median ratio of 0.645 (n 21) against 0.70 at 5 cm and above (n 28), so small juveniles are not simply scaled adults.',
  prereg: 'none: a published dataset re-tabulated for the Physics thread.',
  evLabel: 'Pectoral fin length over standard length by group, from Daane 2021 Data S1A', evDesc: 'Computed by genotype/fin_ratios_table.py from the cached spreadsheet.',
}));

fs.writeFileSync(path.join(here, 'manifest.json'), JSON.stringify({ built: NOW, map: MAP, map_sha256: mapSha, map_bytes: mapSize, unsigned: true, records }, null, 2));
console.log(`${records.length} unsigned draft records in ${out}`);

if (process.argv.includes('--check')) {
  const jar = process.env.NP_JAR || 'C:/tb/tmp/np/nanopub-1.95.0-jar-with-dependencies.jar';
  for (const r of records) {
    const res = spawnSync('java', ['-jar', jar, 'check', path.join(out, r.file)], { encoding: 'utf8' });
    const txt = (res.stdout || '') + (res.stderr || '');
    const verdict = /Valid nanopub/i.test(txt) ? 'VALID' : /valid \(unsigned\)|unsigned/i.test(txt) && !/not valid|invalid|error/i.test(txt) ? 'VALID (unsigned)' : 'CHECK OUTPUT';
    console.log(r.file, '->', verdict, '|', txt.trim().split(/\r?\n/).slice(0, 3).join(' / '));
  }
}
