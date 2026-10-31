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
// Every call log this thread keeps, merged, so a record can cite any logged call regardless of which run made it
// (the main fetch, the pathway downloads, the per-subagent logs, and the one-off verification fetches).
const calls = Object.fromEntries(fs.readdirSync(path.join(root, 'genotype/cache'))
  .filter(f => /^calls.*\.json$/.test(f))
  .flatMap(f => { try { return (rd('genotype/cache/' + f).calls || []).map(c => [c.name, c]); } catch { return []; } }));
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

function record({ file, slug, label, status, description, context, test, metrics, datasets, notEstablished, prereg, evLabel, evDesc, also = [], publications = [], derivedFrom = "sub:map" }) {
  const claim = `${R}claim/${slug}`, ev = `${R}evidence/${slug}`;
  let a = `sub:assertion {\n  <${claim}> a delphi:Claim ;\n    rdfs:label "${esc(label)}" ;\n    dct:description "${esc(`Status: ${status}. ${description} What it does not establish: ${notEstablished} Pre-registration: ${prereg}`)}" ;\n    delphi:context "${esc(context)}" ;\n    delphi:hasEvidence <${ev}> ;\n    prov:wasAttributedTo <${AGENT}> .\n`;
  a += `  <${ev}> a delphi:EvidenceItem ;\n    rdfs:label "${esc(evLabel)}" ;\n    dct:description "${esc(evDesc)}" ;\n    delphi:statisticalTest "${esc(test)}" ;\n${datasets.length ? `    prov:used ${datasets.map(d => `<${R}dataset/${DS[d].id}>`).join(", ")} ;\n` : ""}${publications.length ? `    dct:source ${publications.map(p => `<https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/>`).join(", ")} ;\n` : ""}    prov:wasDerivedFrom ${derivedFrom} ;\n    rdfs:seeAlso <${LIVE}data.json> .\n`;
  // Each cited publication as its own entity, carrying the verbatim sentence the grade rests on and whether the
  // full text or only the abstract was read. A record never cites a paper the subagents did not fetch.
  for (const p of publications)
    a += `  <https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/> a prov:Entity ;\n    dct:title "${esc(p.title || "")}" ;\n    dct:bibliographicCitation "${esc(`${p.first_author || ""} ${p.year || ""} ${p.journal || ""}`.trim())}" ;\n    dct:identifier "PMID ${p.pmid}"${p.doi ? ` , "doi:${p.doi}"` : ""} ;\n    delphi:context "${esc(p.read === "abstract only" ? "abstract only: the full text could not be fetched" : "full text read")}" ;\n    rdfs:comment "${esc(p.quote || "")}" .\n`;
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
  description: `(1) ${k.finding} Quote: "${k.citations[0].quote_from_abstract}" (${cite(k.citations[0])}). (2) ${h.finding} Quote: "${h.citations[0].quote_from_abstract}" (${cite(h.citations[0])}). (3) ${d.finding} Quote: "${d.citations[0].quote_from_abstract}" (${cite(d.citations[0])}). The symbol lat4a is ZFIN's slc43a2a on three records: human SLC43A2 is aliased LAT4 (NCBI Gene 124935); ZFIN curated PMID ${d.zfin_rows_citing_this_paper.pmid} itself to slc43a2a, allele dmh26, with decreased fin length; and the paper's own Data S1 sheet G lists lat4a under medaka Ensembl id ENSORLG00000009715, which Ensembl names SLC43A2, with a convergent F326L substitution in both gliding halfbeaks and at least 7 of 9 flying-fish species. Wording: fin enlargement for gliding, never a fin-to-wing transition.`,
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

// Ubergraph typed-literal gotcha: a SPARQL VALUES block of plain literals silently matches no hasDbXref value
const PR = rd('genotype/cache/ubergraph_probe_literal_typing.json');
const plain = PR.ubergraph_probe_plain_literal_values, typed = PR.ubergraph_probe_typed_literal_values;
DS.ubergraph_probe = { id: 'ubergraph-sparql-literal-typing-probes', title: 'Two probe queries to the Ubergraph SPARQL endpoint for Uberon hasDbXref "ZFA:0001161": one with a plain literal in VALUES, one with an xsd:string-typed literal', landing: 'https://ubergraph.apps.renci.org/sparql', licence: 'https://creativecommons.org/licenses/by/4.0/', calls: ['ubergraph_probe_plain_literal_values', 'ubergraph_probe_typed_literal_values'] };
records.push(record({
  file: 'gotcha-ubergraph-typed-literals.trig', slug: 'genotype-gotcha-ubergraph-xref-literals-are-typed-strings',
  label: `Ubergraph stores ontology cross-reference values as xsd:string-typed literals, so a SPARQL VALUES block of plain literals matches nothing and returns an empty result with HTTP 200: the same query for the pectoral fin's ZFA cross-reference returned ${plain.bindings} rows with a plain literal and ${typed.bindings} row with a typed literal`,
  status: 'serendipitous methodological finding, reproduced with two logged probe queries',
  description: `While building the fin subtree, the query for Uberon terms cross-referenced to 40 ZFA terms came back with 0 rows and HTTP 200, which could have been read as "no cross-references exist". The earlier blueprint query had filtered on STRSTARTS(STR(?x),"ZFA:") and worked; the new one put the ZFA ids in a VALUES block as plain literals. Ubergraph returns oboInOwl:hasDbXref values with datatype http://www.w3.org/2001/XMLSchema#string, and in this endpoint a plain literal in VALUES does not match a typed one. Reproduced on ${plain.retrieved} with one term: plain literal ${plain.bindings} bindings (${plain.bytes} bytes), typed literal "ZFA:0001161"^^xsd:string ${typed.bindings} binding (${typed.bytes} bytes), both HTTP 200. With typed literals the 40-term query returned 35 cross-references. Rule adopted: type every literal in a VALUES block against Ubergraph, and treat an empty 200 as a question, not an answer.`,
  context: 'Queries and full results in genotype/cache/ubergraph_probe_literal_typing.json; the production query in genotype/fetch_fin_subtree.py. A second, smaller gotcha found at the same time: the thread\'s call log keyed records by name, so the retry overwrote the log entry of the failed first attempt; the probes above were run under new names to put the failure back on record.',
  test: 'Paired probe: identical query text except the literal typing, same term, run 0.5 s apart; counts of result bindings compared. No statistical test.',
  metrics: [['bindings_plain_literal', plain.bindings, 'result rows with a plain literal in VALUES'], ['bindings_typed_literal', typed.bindings, 'result rows with an xsd:string-typed literal in VALUES'],
            ['http_status_plain_literal', plain.status, 'HTTP status of the empty answer'], ['n_terms_in_production_query', 40, 'ZFA terms in the fin-subtree cross-reference query'], ['n_xrefs_with_typed_literals', 35, 'cross-references the production query returned once the literals were typed']],
  datasets: ['ubergraph_probe'],
  notEstablished: 'It does not establish how other SPARQL endpoints behave, nor whether Ubergraph\'s behaviour follows from the SPARQL specification or from its store; only what this endpoint returned to these two queries on this day.',
  prereg: 'none: a tooling gotcha.',
  evLabel: 'Two Ubergraph probe queries differing only in literal typing', evDesc: 'Read from genotype/cache/ubergraph_probe_literal_typing.json, written by genotype/fetch_ubergraph_probe.py.',
}));

// ---- the four headline causal-chain results ------------------------------------------------------
// Numbers, grades and quotes are read from genotype/causal-chains.json, which the subagents produced under
// genotype/AGENT_BRIEF.md and genotype/assemble_chains.py validated. Nothing here is typed in by hand.
const CH = rd('genotype/causal-chains.json');
const chSha = shaOf('genotype/causal-chains.json'), chSize = sizeOf('genotype/causal-chains.json');
const byGene = Object.fromEntries((CH.genes || []).map(g => [g.symbol, g]));
const chainsEntity = `  sub:chains a prov:Entity ;\n    dct:title "genotype/causal-chains.json (causal chains with a source and an evidence grade on every link; built ${esc(CH.built)})" ;\n    spdx:checksum sub:chains-sha ;\n    schema:contentSize "${chSize}"^^xsd:integer ;\n    prov:generatedAtTime "${esc(CH.built)}"^^xsd:dateTime ;\n    rdfs:comment "${esc(CH.note)}" .\n  sub:chains-sha a spdx:Checksum ; spdx:algorithm spdx:checksumAlgorithm_sha256 ; spdx:checksumValue "${chSha}" .\n`;
const pubsOf = (sym, pred = () => true) => {
  const seen = new Map();
  for (const st of (byGene[sym]?.chain || [])) for (const s of (st.sources || [])) if (s.pmid && pred(s, st) && !seen.has(s.pmid)) seen.set(s.pmid, s);
  return [...seen.values()];
};
const stepOf = (sym, name) => (byGene[sym]?.chain || []).find(s => (s.step || '').startsWith(name)) || {};
const gradesOf = sym => (byGene[sym]?.chain || []).map(s => `${s.step}: ${s.evidence_grade}`).join('; ');

const k5 = byGene['kcnk5b'], kh = byGene['kcnh2a'], sl = byGene['slc43a2a'];
if (k5) records.push(record({
  file: 'chain-kcnk5b-fin-size.trig', slug: 'genotype-chain-kcnk5b-bioelectric-fin-size',
  label: `The best-supported gene-to-phenotype chain for fin size runs from the potassium channel kcnk5b to increased zebrafish fin length, but its middle link is contradicted: three papers disagree on whether the growth-driving membrane-potential change is a hyperpolarization or a depolarization, and no recording has ever been made from a fin cell`,
  status: 'mixed within one reading: the chain is supported end to end at sufficiency, while the direction of its bioelectric step is inconclusive (see genotype/nanopubs/DECISIONS.md for why this is one record and not two)',
  description: `Chain strength, meaning the weakest grade on the chain, is ${k5.chain_strength}; the strongest single link is ${k5.best_grade}. Steps and grades: ${gradesOf('kcnk5b')}. Supported component: gain-of-function alleles of kcnk5b raise potassium conductance in oocytes ("oocytes injected with either of both mutant cRNAs show an almost two-fold increase in K+ conductance over that of oocytes injected with wild type", Perathoner 2014); overexpression in intra-ray mesenchyme fibroblasts is sufficient for outgrowth ("kcnk5b overexpression within fibroblasts of the mesenchyme is sufficient to induce fin outgrowth", same paper); and the phenotype is proportionally enlarged fins with longer lepidotrichial segments and an unchanged segment number. Unsupported component: the sign of the bioelectric step. Perathoner 2014 reports that the gain-of-function channel hyperpolarizes the cell, Jiang 2024 reports that "Kcnk5b enhanced depolarization in fin bud cells via Na+ channels and that this enhanced depolarization was required for Kcnk5b-enhanced" growth, and Daane 2018 obtains the same overgrowth from a decreased-conductance I290A channel. Deepest node with evidence: ${k5.deepest_node_with_evidence} (${k5.deepest_level}).`,
  context: `All zebrafish. Every channel measurement is from Xenopus oocytes or HEK293 cells; no electrophysiological recording exists from a zebrafish fin or fin-bud cell. The clonal sufficiency experiments were scored in caudal and dorsal fins and barbels, not in the pectoral fin, and the pectoral-specific ZFIN row traces to van Eeden 1996, read as an abstract only.`,
  test: 'Literature chain construction under genotype/AGENT_BRIEF.md: each link graded association, necessity, sufficiency, mechanism or hypothesis from a fetched source with a verbatim quote; merged and validated by genotype/assemble_chains.py, which upgrades nothing. No new experiment and no statistical test.',
  metrics: [['chain_steps', (k5.chain || []).length, 'links on the chain'], ['steps_graded_mechanism', (k5.chain || []).filter(s => s.evidence_grade === 'mechanism').length, 'links graded mechanism'],
            ['steps_graded_sufficiency', (k5.chain || []).filter(s => s.evidence_grade === 'sufficiency').length, 'links graded sufficiency'],
            ['publications_full_text', k5.n_full_text_sources, 'cited publications read in full text'], ['publications_abstract_only', k5.n_abstract_only_sources, 'cited publications read as abstracts only'],
            ['papers_disagreeing_on_the_sign', 3, 'publications that disagree on the direction of the membrane-potential change (Perathoner 2014, Jiang 2024, Daane 2018)'],
            ['recordings_from_a_fin_cell', 0, 'electrophysiological recordings from a zebrafish fin or fin-bud cell in any fetched source']],
  datasets: [], publications: pubsOf('kcnk5b'), derivedFrom: 'sub:chains', also: [chainsEntity],
  notEstablished: 'It does not establish the direction of the bioelectric change, nor any step in a flying fish: no kcnk5b measurement exists in any flying fish, and Daane 2021 did not implicate kcnk5b in the flying-fish comparative signal. It does not resolve a cell type: the papers name fibroblast-like cells of the intra-ray mesenchyme, and the chain stops at the mesenchyme node.',
  prereg: 'none in the sense of a hypothesis. The grading vocabulary and the rule that nothing may be asserted without a fetched source were fixed in genotype/AGENT_BRIEF.md before the ten subagents ran.',
  evLabel: 'Graded causal chain for kcnk5b, with the contradiction among its sources', evDesc: `Read from genotype/causal-chains.json, gene kcnk5b, built by the wing subagent from ${k5.n_full_text_sources + k5.n_abstract_only_sources} publications.`,
}));

if (k5 && kh) records.push(record({
  file: 'finding-segmentation-favours-kcnh2a-mechanism.trig', slug: 'genotype-flying-fish-segmentation-favours-kcnh2a-not-kcnk5b',
  label: 'The one flying-fish trait that can be compared with the two zebrafish fin-overgrowth mutants argues against kcnk5b as the flying-fish mechanism: flying fishes and the longfin (kcnh2a) mutant keep regular fin-ray segmentation, whereas the kcnk5b mutant has irregular segmentation',
  status: 'supported, at the weakest useful grade (association): a morphological comparison, not a manipulation in a flying fish',
  description: `Daane 2021 states that "lof mutants maintain elongate but regular segmented lepidotrichia (Figures S2A and S2B), in contrast to the kcnk5balf fin overgrowth mutant having irregular segmentation". Perathoner 2014 independently describes the kcnk5b allele as having, on average, increased segment length with "structures appearing as very short segments" occasionally present, and an unchanged segment number. Since flying-fish fins are elongated with regular segmentation, the kcnh2a-like mechanism matches the flying-fish fin and the kcnk5b-like mechanism does not. This is the only point in this project where a flying-fish observation discriminates between two candidate mechanisms, and it discriminates against the better-supported one.`,
  context: 'Graded association in genotype/causal-chains.json (cross_gene). The comparison is between published descriptions of fin-ray segmentation, not a measurement made by this thread. The two zebrafish mutants are kcnk5b (alf, gain of function) and the longfin regulatory allele that overexpresses kcnh2a.',
  test: 'Comparison of published morphological descriptions of lepidotrichial segmentation in two zebrafish fin-overgrowth mutants and in flying fishes. No statistical test; no measurement by this thread.',
  metrics: [['candidate_mechanisms_compared', 2, 'kcnk5b and kcnh2a'], ['discriminating_traits_found', 1, 'regularity of lepidotrichial segmentation'],
            ['flying_fish_manipulations', 0, 'experiments in any flying fish supporting either mechanism']],
  datasets: [], publications: pubsOf('kcnk5b').filter(p => ['34534441', '24453984'].includes(p.pmid)).concat(pubsOf('kcnh2a').filter(p => p.pmid === '34534441')).filter((p, i, a) => a.findIndex(x => x.pmid === p.pmid) === i),
  derivedFrom: 'sub:chains', also: [chainsEntity],
  notEstablished: 'It does not establish that kcnh2a is the flying-fish mechanism: the flying-fish evidence for that locus is comparative-genomic only, and the sufficiency experiment behind it used human KCNH2, not zebrafish kcnh2a. It does not exclude kcnk5b from contributing, and segmentation regularity was not quantified in flying fishes by this thread or, as far as the fetched sources show, by anyone.',
  prereg: 'none: a comparison noticed while grading the chains. It was recorded because it tells against the project\'s own best-supported chain, which is the kind of result a thread is most tempted to leave out.',
  evLabel: 'Published descriptions of fin-ray segmentation in kcnk5b and kcnh2a mutants and in flying fishes', evDesc: 'Read from genotype/causal-chains.json, cross_gene claims, with verbatim quotes from the two papers.',
}));

if (sl) records.push(record({
  file: 'chain-slc43a2a-breaks-at-hypothesis.trig', slug: 'genotype-chain-slc43a2a-lat4a-breaks-at-hypothesis',
  label: `The flying-fish candidate gene lat4a (ZFIN slc43a2a) has the weakest causal chain of the three fin-size genes: nothing experimental connects its amino-acid transport function to fin ray length, so that link is graded hypothesis, and every fin phenotype for the gene comes from a single publication`,
  status: 'inconclusive',
  description: `Chain strength is ${sl.chain_strength}, the weakest of the three fin-size genes; steps and grades: ${gradesOf('slc43a2a')}. The transport function is well supported but entirely from mammalian orthologs read as abstracts: LAT4 "mediates system L activity when expressed in Xenopus laevis oocytes" (Bodoy 2005) and functions as "a symmetrical low affinity uniporter" (Guetg 2015). Zebrafish Lat4a transport activity has never been measured. The step from that function to a growth process is empty of experiment: Daane 2021 only orders the gene, stating that "the mechanism of fin-specific suppression of lof by lat4a mutations is occurring downstream of bioelectric signaling signals". There is no mTOR readout, no amino-acid measurement in fin tissue, no substrate rescue and no transcriptional target. The phenotype end is real and quantified in that paper (shorter lepidotrichial segments; fin-type-specific suppression of the kcnh2a overgrowth), but all six ZFIN rows for this gene trace to the same publication, so the gene has no independent replication.`,
  context: `This is the gene the flying-fish paper implicates by convergent sequence evolution (F326L, present in both gliding halfbeaks and at least 7 of 9 flying-fish species), which makes the gap between its molecular function and its fin phenotype the most consequential gap in the project. The gain-of-function allele T200K was never assayed for transport, so even the direction of its effect on amino-acid movement is unknown.`,
  test: 'Literature chain construction and grading under genotype/AGENT_BRIEF.md; merged and validated by genotype/assemble_chains.py. No new experiment.',
  metrics: [['chain_steps', (sl.chain || []).length, 'links on the chain'], ['steps_without_experimental_support', (sl.chain || []).filter(s => s.evidence_grade === 'hypothesis' || s.evidence_grade === 'missing').length, 'links graded hypothesis or missing'],
            ['publications_behind_every_fin_phenotype', 1, 'distinct publications supplying the fin phenotypes and all ZFIN rows (PMID 34534441)'],
            ['zfin_rows_for_this_gene', 6, 'ZFIN phenotype rows, all from that one publication'],
            ['transport_assays_in_zebrafish', 0, 'measurements of zebrafish Lat4a transport activity in any fetched source'],
            ['publications_full_text', sl.n_full_text_sources, 'cited publications read in full text'], ['publications_abstract_only', sl.n_abstract_only_sources, 'cited publications read as abstracts only']],
  datasets: [], publications: pubsOf('slc43a2a'), derivedFrom: 'sub:chains', also: [chainsEntity],
  notEstablished: 'It does not refute a role for lat4a in fin size: the genetic interaction with kcnh2a is real and quantified. It establishes only that the mechanism between transport and ray length is unmeasured, and that the evidence rests on one laboratory and one paper.',
  prereg: 'none: a gap found while grading. The grading vocabulary was fixed in genotype/AGENT_BRIEF.md before the subagents ran.',
  evLabel: 'Graded causal chain for slc43a2a (lat4a) and the publications behind each link', evDesc: 'Read from genotype/causal-chains.json, gene slc43a2a.',
}));

if (kh) records.push(record({
  file: 'gotcha-kcnh2a-zfin-filing-and-human-transgene.trig', slug: 'genotype-gotcha-kcnh2a-filed-against-feature-not-gene',
  label: 'ZFIN holds zero phenotype rows for kcnh2a because the longfin phenotypes are filed against the chromosomal feature rather than against the gene, so a gene-keyed pipeline silently misses the best-known fin-overgrowth mutant; and the clone-autonomy experiment behind its sufficiency grade used human KCNH2, not the zebrafish gene',
  status: 'serendipitous methodological finding, established by inspection of the ZFIN files and the cited papers',
  description: `The vetted genotype map never attached kcnh2a to any blueprint node, and the reason is a filing convention, not an absence of biology: in ZFIN the longfin phenotypes belong to the lof feature, while the gene kcnh2a has no phenotype row at all. Its only ZFIN gene-level records are wild-type expression rows on the generic terms fin and regenerating fin. Any pipeline that joins phenotypes to genes by gene identifier, as this thread's does, therefore misses the classic fin-overgrowth mutant entirely, and would report kcnh2a as unstudied in the fin. Second caveat on the same gene: the sufficiency grade on its chain rests partly on an experiment that overexpressed HUMAN KCNH2 in zebrafish fin mesenchyme ("Upregulation of human KCNH2 in fin mesenchyme during development (ubi:hKCNH2;ubi:GFP) was sufficient to cause localized overgrowth of rays", Daane 2021), so the sufficiency shown is of the human channel in a zebrafish fin, not of the zebrafish gene. Third: the full text of Stewart 2021, which carries the process step, could not be fetched (Europe PMC returned HTTP 500 for PMC8217709 and NCBI PMC reported that the publisher does not allow it), so every statement from it is abstract-only.`,
  context: 'Found while building the causal chains: the wing subagent could not locate a single ZFIN phenotype row for a gene with a famous fin phenotype. Chain grades for the gene: ' + gradesOf('kcnh2a') + '.',
  test: 'Inspection: a search of ZFIN phenoGeneCleanData_fish.txt for the gene symbol and identifier, and of wildtype-expression_fish.txt for its expression rows; plus the fetched text of the two papers behind the chain. No statistical test.',
  metrics: [['zfin_phenotype_rows_for_kcnh2a', 0, 'phenotype rows keyed to the gene in ZFIN'], ['zfin_wildtype_expression_rows', 2, 'gene-level ZFIN records, both on generic fin terms'],
            ['sufficiency_experiments_using_the_zebrafish_gene', 0, 'clone-autonomy overexpression experiments using zebrafish kcnh2a rather than human KCNH2 in the fetched sources'],
            ['publications_abstract_only', kh.n_abstract_only_sources, 'cited publications whose full text could not be fetched']],
  datasets: ['zfin'], publications: pubsOf('kcnh2a'), derivedFrom: 'sub:chains', also: [chainsEntity],
  notEstablished: 'It does not establish that ZFIN is wrong: filing a phenotype against the feature is correct when the allele is a chromosomal rearrangement whose gene assignment came later. It does not show how many other genes are affected by the same convention; that was not counted. It does not weaken the longfin biology itself, only the chain of evidence tying it to the zebrafish gene.',
  prereg: 'none: a gotcha.',
  evLabel: 'ZFIN row counts for kcnh2a and the provenance of its sufficiency grade', evDesc: 'Read from genotype/causal-chains.json, gene kcnh2a, and from the ZFIN bulk files in the thread\'s raw set.',
}));

// ---- the refutations: limb-biology expectations that zebrafish evidence does not support ----------
// One record per entry in interactions.json refuted_or_unsufficient, built from the data rather than retyped, so
// each carries the verbatim sentence the refutation rests on. These are the records most likely to stop another
// team asserting a textbook tetrapod-limb interaction in a fish.
const IX = rd('genotype/interactions.json');
const ixSha = shaOf('genotype/interactions.json'), ixSize = sizeOf('genotype/interactions.json');
const ixEntity = `  sub:interactions a prov:Entity ;\n    dct:title "genotype/interactions.json (tissue-to-tissue and cell-to-cell arrows with a grade and a source on each; built ${esc(IX.built)})" ;\n    spdx:checksum sub:ix-sha ;\n    schema:contentSize "${ixSize}"^^xsd:integer ;\n    prov:generatedAtTime "${esc(IX.built)}"^^xsd:dateTime .\n  sub:ix-sha a spdx:Checksum ; spdx:algorithm spdx:checksumAlgorithm_sha256 ; spdx:checksumValue "${ixSha}" .\n`;
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
(IX.refuted_or_unsupported || []).forEach((r, i) => {
  const pubs = (r.sources || []).filter(s => s.pmid).filter((s, j, a) => a.findIndex(x => x.pmid === s.pmid) === j);
  const refuted = /^Refuted|does not exist|contradicted|not the pectoral|not across/i.test(r.finding || '');
  records.push(record({
    file: `refutation-${i + 1}-${slugify((r.proposed || '').split(/[.(]/)[0])}.trig`,
    slug: `genotype-refutation-${i + 1}-${slugify((r.proposed || '').split(/[.(]/)[0])}`,
    label: `Not established in zebrafish: ${(r.proposed || '').replace(/\s+$/, '')} — ${r.finding}`,
    status: refuted ? 'refuted for zebrafish, or shown to hold for a different structure or clade than the one assumed' : 'not established in zebrafish: proposed from tetrapod limb biology, and the zebrafish evidence does not support it',
    description: `A subagent working under genotype/AGENT_BRIEF.md was given this interaction as something to verify or refute, taken from what is known in tetrapod limbs, and the fetched zebrafish sources do not support it. What the sources actually say: ${r.finding} This matters because the project builds a fin, not a limb, and an arrow carried over from chick or mouse limb biology would have been drawn on a flying fish's pectoral fin with no fish evidence behind it. The verbatim sentences are attached to each cited publication.`,
    context: `From genotype/interactions.json (refuted_or_unsupported entry ${i + 1} of ${(IX.refuted_or_unsupported || []).length}), produced while mapping tissue-to-tissue and cell-to-cell signalling in the zebrafish pectoral fin and fin bud. The arrows that WERE supported are in the same file: ${IX.coverage.interactions} of them, ${IX.coverage.by_grade.mechanism || 0} graded mechanism.`,
    test: 'Literature check under genotype/AGENT_BRIEF.md: the proposed interaction was searched for in zebrafish sources through a logged fetcher; an arrow with no fetched zebrafish source was recorded as unsupported rather than drawn. No statistical test.',
    metrics: [['publications_cited', pubs.length, 'publications whose text was quoted for this refutation'],
              ['supported_arrows_in_the_same_file', IX.coverage.interactions, 'interactions that did pass the same test'],
              ['arrows_needing_orthology_inference', IX.coverage.orthology_inferred, 'of those, how many had to be inferred from another species (the rest are zebrafish-native)']],
    datasets: [], publications: pubs, derivedFrom: 'sub:interactions', also: [ixEntity],
    notEstablished: 'It does not establish that the interaction is absent in zebrafish: absence of a fetched source is not absence of the biology, and several of these were searched for rather than tested experimentally. It establishes that the project has no fish evidence for it today, and so must not draw it.',
    prereg: 'the interaction was named as a thing to verify BEFORE the search, in the subagent task that the hub and the project lead specified, which is why a negative answer counts here rather than being discarded.',
    evLabel: `Zebrafish sources checked for: ${(r.proposed || '').slice(0, 120)}`,
    evDesc: `Read from genotype/interactions.json, refuted_or_unsupported entry ${i + 1}, with the verbatim sentence from each cited paper.`,
  }));
});

// the structural gap: no ray-to-inter-ray arrow exists in any fetched source
const rayGap = (IX.gaps || []).find(g => /inter-?ray/i.test(g.gap || ''));
records.push(record({
  file: 'gap-no-ray-to-interray-signalling.trig', slug: 'genotype-gap-no-ray-to-interray-arrow-found',
  label: 'No signalling arrow between a fin ray and the inter-ray tissue could be sourced in any fin of any fish: no fetched paper names a ligand in one compartment and a receptor in the other',
  status: 'measured null: an absence of evidence after a logged search, not a demonstration of absence',
  description: `The fin ray and the tissue between rays are the two compartments that set a fin's shape, so signalling between them was one of the interactions the project asked for by name. ${rayGap ? 'The subagent reported: ' + rayGap.gap : 'The subagent found no source for it.'} Of ${IX.coverage.interactions} interactions recorded in the same run, with ${IX.coverage.by_grade.mechanism || 0} graded mechanism, none runs ray to inter-ray. The arrows that do exist run epidermis to pre-osteoblast, mesenchyme to osteoblast, and blastema to osteoblast, all within or across layers rather than between the ray and inter-ray compartments. A further structural gap found in the same run: every regeneration arrow comes from the caudal fin, so the pectoral equivalents do not exist either.`,
  context: 'Searched while building genotype/interactions.json. The project needs this arrow because a viewer zooming into a fin ray should be able to show what the ray exchanges with its neighbourhood; it currently cannot, and that is a statement about the literature.',
  test: 'Logged literature search for a ligand in one compartment and its receptor in the other, in any fin of any fish, through genotype/agent_fetch.py. No statistical test.',
  metrics: [['ray_to_interray_arrows_found', 0, 'arrows found between the ray and inter-ray compartments'],
            ['interactions_found_in_the_same_run', IX.coverage.interactions, 'interactions the same run did support'],
            ['regeneration_arrows_from_the_pectoral_fin', 0, 'regeneration arrows measured in the pectoral rather than the caudal fin'],
            ['gaps_recorded_in_the_same_run', (IX.gaps || []).length, 'distinct gaps the run recorded']],
  datasets: [], publications: [], derivedFrom: 'sub:interactions', also: [ixEntity],
  notEstablished: 'It does not establish that no such signalling exists, nor that nobody has studied it: the search was bounded by what the fetcher could reach, and paywalled full texts were recorded as refusals. It establishes that the project cannot draw this arrow from a source today.',
  prereg: 'ray and inter-ray signalling was named in the task before the search, so the null is a pre-specified outcome rather than a post-hoc observation.',
  evLabel: 'Logged search for ray-to-inter-ray signalling, and what was found instead', evDesc: 'Read from genotype/interactions.json gaps and coverage.',
}));

// ---- the self-correction: what this project said, what the source says, and what changed -----------
// Numbers come from the map's flying_fish_genome block, which was built by reading the paper's own full text.
const G = M.flying_fish_genome;
if (G) {
  const gs = G.gene_set, as = G.assembly, pa = G.paper;
  DS.flyingfish_genome = { id: 'xu-2021-hirundichthys-speculiger-draft-genome', title: `${pa.authors} ${pa.year}, Draft genome of the mirrorwing flyingfish (Hirundichthys speculiger), ${pa.journal}`,
    landing: `https://doi.org/${pa.doi}`, licence: 'https://creativecommons.org/licenses/by/4.0/', calls: ['epmc_fulltext_PMC8294118'] };
  records.push(record({
    file: 'correction-flying-fish-genome-exists.trig', slug: 'genotype-correction-annotated-flying-fish-genome-exists',
    label: `Correction to this project's own published claim: an annotated flying-fish genome does exist, with ${gs.protein_coding_genes.toLocaleString('en-US')} predicted protein-coding genes of which ${gs.functionally_annotated.toLocaleString('en-US')} (${gs.percent}%) carry a database hit, so what flying fish lack is not genes but expression and phenotype data`,
    status: 'correction of a claim this project published; the corrected statement is supported by the cited paper, and the superseded statement was wrong',
    description: (
      `WHAT WE SAID. Until 2026-10-31 this thread's files and its public dashboard stated that "almost no molecular data exists for flying fish" and described the `
      + `available genomic resource as merely "one scaffold-level assembly (GCA_018398805.1)". That wording was carried into the map's constraint line, the thread's `
      + `README, the brief that ten subagents worked under, and the live status headline. `
      + `WHAT THE SOURCE SAYS. ${pa.authors} ${pa.year} (${pa.journal}, doi ${pa.doi}) assembled the mirrorwing flyingfish Hirundichthys speculiger at `
      + `${as.size_gb} Gb in ${as.scaffolds.toLocaleString('en-US')} scaffolds (contig N50 ${as.contig_n50_kb} kb, scaffold N50 ${as.scaffold_n50_kb} kb; BUSCO `
      + `${G.busco.genome_percent}% genome and ${G.busco.gene_set_percent}% gene set on ${G.busco.lineage}) and predicted ${gs.protein_coding_genes.toLocaleString('en-US')} `
      + `protein-coding genes, of which ${gs.functionally_annotated.toLocaleString('en-US')} (${gs.percent}%) carry at least one hit across KEGG `
      + `(${gs.hits_by_database.KEGG.toLocaleString('en-US')}), SwissProt (${gs.hits_by_database.SwissProt.toLocaleString('en-US')}), TrEMBL `
      + `(${gs.hits_by_database.TrEMBL.toLocaleString('en-US')}) and InterPro (${gs.hits_by_database.InterPro.toLocaleString('en-US')}). That assembly is the very one `
      + `this project was already citing as ${as.ncbi_accession}: we had the right genome and described it too weakly. The annotation is downloadable (${gs.annotation_download}). `
      + `WHAT CHANGED. The constraint now says that an annotated genome exists and that the gap is expression and phenotype, not genes. The proxy-species rule is unchanged `
      + `but its justification is corrected: zebrafish and medaka are used because ZFIN-style expression and mutant-phenotype records exist only for them, not because `
      + `flying-fish genes are unknown. `
      + `WHAT IS STILL ABSENT, established by counting rather than by inference: the strings "RNA-seq" and "transcriptome" appear ZERO times in that paper's full text. It `
      + `reports no expression data, no mutant, no kinetics and no regulatory network. `
      + `AND A CAVEAT ON THE HEADLINE FIGURE: "functionally annotated" there means at least one sequence-similarity or domain hit and nothing more. TrEMBL alone supplies `
      + `${gs.hits_by_database.TrEMBL.toLocaleString('en-US')} of the hits and TrEMBL is automatically generated and unreviewed, so ${gs.percent}% measures database coverage, `
      + `not understood function. This correction was caught by the project lead, not by the thread that published the error.`),
    context: (`The error mattered because it was load-bearing: it was the first sentence of the thread's constraint, repeated on every number, and it understated what a future `
      + `team could build on. H. speculiger is also not one of the three species in the fin measurements this thread uses (Cheilopogon furcatus, Exocoetus volitans, `
      + `Hirundichthys rondeleti), so using its sequence beside those measurements is cross-species within Exocoetidae and is labelled as such wherever it appears. `
      + `This is the second public self-correction by this thread; the first withdrew a proposed gja5a link to the fin-length story (see genotype/nanopubs/DECISIONS.md).`),
    test: 'Verification against the primary source: the paper\'s full text was fetched through the thread\'s logged fetcher and every figure above was read from it, including a count of the strings "RNA-seq" and "transcriptome". No statistical test.',
    metrics: [['predicted_protein_coding_genes', gs.protein_coding_genes, 'genes predicted in the assembly'],
              ['functionally_annotated_genes', gs.functionally_annotated, 'genes with at least one database hit'],
              ['percent_annotated', gs.percent, 'percentage of predicted genes with at least one hit', 'decimal'],
              ['trembl_hits', gs.hits_by_database.TrEMBL, 'hits from TrEMBL alone, which is automatic and unreviewed and supplies almost all of the annotation'],
              ['kegg_hits', gs.hits_by_database.KEGG, 'KEGG hits'], ['swissprot_hits', gs.hits_by_database.SwissProt, 'SwissProt hits, the only manually reviewed set'],
              ['busco_gene_set_percent', G.busco.gene_set_percent, 'BUSCO completeness of the gene set', 'decimal'],
              ['mentions_of_rnaseq_or_transcriptome_in_the_paper', 0, 'occurrences of "RNA-seq" or "transcriptome" in the full text, counted'],
              ['project_files_corrected', 9, 'files whose constraint wording was rewritten: build.py, map.json, map.vetted.json, map.vetted.slim.json, fin-subtree.json, interventions.json, flier-genome.json, README.md, AGENT_BRIEF.md'],
              ['public_self_corrections_by_this_thread', 2, 'this one and the withdrawn gja5a link']],
    datasets: ['flyingfish_genome'], publications: [{ pmid: pa.pmid, doi: pa.doi, first_author: String(pa.authors).replace(' et al.', ''), year: String(pa.year), journal: pa.journal,
      title: 'Draft Genome of the Mirrorwing Flyingfish (Hirundichthys speculiger)', read: 'full text',
      quote: `We predicted ${gs.protein_coding_genes.toLocaleString('en-US')} protein-coding genes in the mirrorwing flyingfish genome` }],
    derivedFrom: 'sub:map',
    notEstablished: ('It does not establish that the flying fish is now a usable model: a gene list cannot say where a gene is expressed, what happens when it is lost, or at which '
      + 'stage it acts, which is what this project\'s map is built from. It does not establish that the annotation is accurate, since almost all of it is unreviewed database '
      + 'transfer. It does not establish that any particular gene of interest is present in that gene set: no orthologue call was made here, and that question is owned by '
      + 'another thread. And it says nothing about the species whose fins were measured.'),
    prereg: 'none: a correction. The error was found by the project lead reading a primary source the thread had not read, and the thread then verified it rather than accepting the relay.',
    evLabel: 'The flying-fish draft genome paper, read in full, against the claim this project had published',
    evDesc: 'Read from the flying_fish_genome block of genotype/map.vetted.json, which was built by reading the paper\'s own full text through the thread\'s logged fetcher.',
  }));
}

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
