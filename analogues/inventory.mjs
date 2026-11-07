#!/usr/bin/env node
// A curated inventory of comparative reference species for fish morphology and development, and a
// verifier that checks every entry against the live APIs.
//
//   node analogues/inventory.mjs            # verify every entry against NCBI Datasets and Ensembl REST
//   node analogues/inventory.mjs --list     # print the inventory without touching the network
//
// WHAT THIS IS FOR. A comparative claim about a fin, a jaw, a swim bladder or a pigment cell is only as
// good as the reference it is compared against, and the wrong reference is worse than none: a teleost-only
// comparison cannot tell a teleost novelty from a vertebrate ancestral state, and a comparison that
// reaches straight from a teleost to a mammal steps over the two lineages that would have told you which.
// So every entry below states WHAT QUESTION IT IS THE REFERENCE FOR. An entry with no stated question is
// a species someone liked the sound of, and `verifyInventory` treats a missing reason as a defect.
//
// EXCLUDED CLADES. One clade is withheld from this entire project under a frozen evaluation holdout and is
// therefore absent from this inventory by construction: see `EXCLUDED_CLADES` and `ALLOWED_GROUPS`. The
// inventory is a closed allow-list -- an entry is admitted only if its `group` is one of the enumerated
// groups -- so the withheld clade cannot enter by being added, and does not need to be named to be kept
// out. `verifyInventory` re-checks that closure on every run.
//
// COORDINATES ARE PER-ASSEMBLY. `assembly_accession` is the NCBI reference assembly; `ensembl_assembly` is
// the build Ensembl REST actually serves. They differ for most entries, and when they do, a coordinate
// from `geneBySymbol` is a coordinate on the Ensembl build and nothing else. The two fields are kept
// separate rather than reconciled, because quietly reconciling them is how a start position gets carried
// onto an assembly it does not belong to.
import { assemblyReport, geneBySymbol, health, cachedFetch, OUTCOME } from './fetch.mjs';
import { pathToFileURL } from 'node:url';

// One clade is held out of this project under a frozen evaluation holdout. Its name is not written here,
// in any comment, in any cache key or in any log line this module emits.
export const EXCLUDED_CLADES = Object.freeze(['<withheld under a frozen evaluation holdout>']);

// The closed allow-list of groups. Nothing outside these is in the inventory, and the withheld clade is
// not among them.
export const ALLOWED_GROUPS = Object.freeze([
  'teleost',              // ray-finned fishes after the teleost-specific genome duplication
  'holostean',            // ray-finned, before that duplication
  'sarcopterygian-fish',  // lobe-finned fishes
  'chondrichthyan',       // cartilaginous fishes
  'cyclostome',           // jawless fishes
  'amphibian',
  'mammal',
  'tunicate',
]);

// Provenance shorthand. Every accession in this file was read from one of these, not typed from memory.
export const SOURCES = Object.freeze({
  ncbi_reference: {
    id: 'ncbi-datasets-reference-query',
    what: 'NCBI Datasets v2alpha genome/taxon/{taxid}/dataset_report?filters.reference_only=true&filters.assembly_version=current',
    note: 'the accession NCBI currently flags as the reference assembly for that taxon',
    retrieved: '2026-11-06',
  },
  ncbi_named_build: {
    id: 'ncbi-datasets-named-build',
    what: 'NCBI Datasets v2alpha genome/accession/{accession}/dataset_report',
    note: 'a specific named build chosen because Ensembl REST serves its coordinates, confirmed by direct accession lookup',
    retrieved: '2026-11-06',
  },
  ensembl_species: {
    id: 'ensembl-info-species',
    what: 'Ensembl REST /info/species?division=EnsemblVertebrates',
    note: 'the species key and assembly name as Ensembl itself reports them',
    retrieved: '2026-11-06',
  },
});

const e = o => Object.freeze({
  ...o,
  provenance: Object.freeze({
    accession_from: o.accession_source ?? SOURCES.ncbi_reference.id,
    accession_query: (o.accession_source === SOURCES.ncbi_named_build.id ? SOURCES.ncbi_named_build : SOURCES.ncbi_reference).what,
    ensembl_key_from: SOURCES.ensembl_species.id,
    retrieved: '2026-11-06',
    ...(o.provenance_note ? { note: o.provenance_note } : {}),
  }),
});

// ---------------------------------------------------------------------------------------------------
// SPECIES
//
// ~20 comparative references. The teleosts carry the bulk of the developmental genetics; the holostean,
// lobe-finned, cartilaginous and jawless entries are the outgroups that decide whether a teleost feature
// is a novelty or an inheritance; the two mammals, the amphibian and the tunicate anchor the far end.

export const SPECIES = Object.freeze([
  // ---- teleosts -----------------------------------------------------------------------------------
  e({
    common: 'zebrafish', binomial: 'Danio rerio', ensembl: 'danio_rerio', ncbi_taxid: 7955,
    group: 'teleost',
    assembly_accession: 'GCF_000002035.6', assembly_name: 'GRCz11', ensembl_assembly: 'GRCz11',
    accession_source: SOURCES.ncbi_named_build.id,
    why: 'The reference body plan for fin and axial development: the fin-fold-to-fin-bud series, the median and paired fin skeletons, and the pigment pattern are all described on this animal, and the mutant and transgenic lines that establish gene function are its own. Every other entry here is read against it.',
    provenance_note: 'GRCz11 is deliberately NOT the accession NCBI currently flags as the reference (that is GCF_052040795.2, GRCz13ab, released 2026-08-28). GRCz11 is the build Ensembl REST serves, so it is the build the coordinates from geneBySymbol are on. GCF_000002035.6 now reports assembly_status "suppressed" for exactly that reason, which verifyInventory reports rather than hides.',
    superseded_by: 'GCF_052040795.2',
  }),
  e({
    common: 'medaka', binomial: 'Oryzias latipes', ensembl: 'oryzias_latipes', ncbi_taxid: 8090,
    group: 'teleost',
    assembly_accession: 'GCF_053564925.1', assembly_name: 'Olatipes_Hd-rR_3.1', ensembl_assembly: 'ASM223467v1',
    why: 'The second independently-developed teleost developmental model, ~115 Myr diverged from the zebrafish. A fin or pigment phenotype shared with it is a teleost feature; one found only in the zebrafish is a lineage feature or a line artefact. It also has true XY sex determination, so it separates sex-linked morphology from the rest.',
  }),
  e({
    common: 'three-spined stickleback', binomial: 'Gasterosteus aculeatus', ensembl: 'gasterosteus_aculeatus', ncbi_taxid: 69293,
    group: 'teleost',
    assembly_accession: 'GCF_964276395.1', assembly_name: 'fGasAcu3.hap1.1', ensembl_assembly: 'GAculeatus_UGA_version5',
    ensembl_taxid: 481459,
    why: 'The reference for repeated, mapped morphological evolution: pelvic-spine loss, lateral-plate armour reduction and gill-raker number have each been traced to specific loci across independent marine-to-freshwater populations. It is the entry that answers "has this morphological change a known genetic route?" rather than "is this gene conserved?".',
    provenance_note: 'Ensembl reports taxon_id 481459 for this species key (a population-level NCBI taxon) where the species-level NCBI taxon is 69293. Both are recorded; verifyInventory checks the Ensembl-reported taxon against ensembl_taxid, so the difference is declared rather than discovered as a mismatch.',
  }),
  e({
    common: 'Japanese pufferfish', binomial: 'Takifugu rubripes', ensembl: 'takifugu_rubripes', ncbi_taxid: 31033,
    group: 'teleost',
    assembly_accession: 'GCF_901000725.3', assembly_name: 'fTakRub1.3', ensembl_assembly: 'fTakRub1.2',
    why: 'The compact-genome control, ~385 Mb with the same gene complement as the zebrafish at a third of the length. When a regulatory element is present here, the element is conserved rather than incidental; when a gene is missing here, the loss is real and not an assembly gap. Also a body plan that discarded the pelvic fin and the ribs outright.',
  }),
  e({
    common: 'Mexican tetra', binomial: 'Astyanax mexicanus', ensembl: 'astyanax_mexicanus', ncbi_taxid: 7994,
    group: 'teleost',
    assembly_accession: 'GCF_023375975.1', assembly_name: 'AstMex3_surface', ensembl_assembly: 'Astyanax_mexicanus-2.0',
    why: 'The reference for loss of a structure within one species: cave and surface populations interbreed, yet the cave form has reduced eyes and pigment and rearranged cranial bones and lateral line. It is how to ask what the cost of losing an organ is, with the unreduced form available as a control that shares the genome.',
  }),
  e({
    common: 'turquoise killifish', binomial: 'Nothobranchius furzeri', ensembl: 'nothobranchius_furzeri', ncbi_taxid: 105023,
    group: 'teleost',
    assembly_accession: 'GCF_043380555.1', assembly_name: 'NfurGRZ-RIMD1', ensembl_assembly: 'Nfu_20140520',
    why: 'The reference for developmental arrest and compressed life history: embryos enter diapause for months and the adult lifespan is a few months. It is the entry for any claim that couples a developmental rate to a life-history schedule, because here the two were measured on the same animal.',
  }),
  e({
    common: 'Nile tilapia', binomial: 'Oreochromis niloticus', ensembl: 'oreochromis_niloticus', ncbi_taxid: 8128,
    group: 'teleost',
    assembly_accession: 'GCF_001858045.2', assembly_name: 'O_niloticus_UMD_NMBU', ensembl_assembly: 'O_niloticus_UMD_NMBU',
    why: 'The cichlid anchor: the clade that produced the best-documented rapid radiation of jaw and tooth morphologies, so it is the reference for feeding-apparatus shape and for pharyngeal-jaw remodelling. Its own assembly is a chromosome-level reference, which the fast-radiating lake species mostly are not.',
  }),
  e({
    common: 'Atlantic salmon', binomial: 'Salmo salar', ensembl: 'salmo_salar', ncbi_taxid: 8030,
    group: 'teleost',
    assembly_accession: 'GCF_965601325.2', assembly_name: 'fSalSal1', ensembl_assembly: 'Ssal_v3.1',
    why: 'The extra-duplication control. Salmonids underwent a further whole-genome duplication on top of the teleost one, so a gene with one copy in the zebrafish may have four here. It is the entry that shows whether an apparent gene-family expansion is about the trait under study or about the ploidy history of the lineage. It also carries a full anadromous metamorphosis.',
  }),
  e({
    common: 'northern pike', binomial: 'Esox lucius', ensembl: 'esox_lucius', ncbi_taxid: 8010,
    group: 'teleost',
    assembly_accession: 'GCF_011004845.1', assembly_name: 'fEsoLuc1.pri', ensembl_assembly: 'fEsoLuc1.pri',
    why: 'The salmonid sister lineage that did NOT duplicate. Paired with the salmon it isolates the effect of that duplication: a difference present in the salmon and absent here is attributable to the extra genome, and a difference present in both is older than it.',
  }),
  e({
    common: 'Atlantic cod', binomial: 'Gadus morhua', ensembl: 'gadus_morhua', ncbi_taxid: 8049,
    group: 'teleost',
    assembly_accession: 'GCF_902167405.1', assembly_name: 'gadMor3.0', ensembl_assembly: 'gadMor3.0',
    why: 'The gene-loss reference: this lineage lost MHC class II and much of the canonical adaptive-immunity set yet is a successful large-bodied fish. It is the entry that stops "this gene is present in every fish we checked" from becoming "this gene is necessary", and it has a well-described physoclistous swim bladder.',
  }),
  e({
    common: 'tiger tail seahorse', binomial: 'Hippocampus comes', ensembl: 'hippocampus_comes', ncbi_taxid: 109280,
    group: 'teleost',
    assembly_accession: 'GCF_001891065.2', assembly_name: 'H_comes_QL1_v1.1', ensembl_assembly: 'H_comes_QL1_v1',
    why: 'The extreme body-plan rearrangement inside the teleosts: no pelvic or caudal fin, a vertical trunk, a toothless tubular snout, dermal armour instead of scales, and male brooding. It is the reference for how far a teleost skeleton can be reorganised, and for which gene losses accompany losing a fin entirely.',
  }),
  e({
    common: 'southern platyfish', binomial: 'Xiphophorus maculatus', ensembl: 'xiphophorus_maculatus', ncbi_taxid: 8083,
    group: 'teleost',
    assembly_accession: 'GCF_002775205.1', assembly_name: 'X_maculatus-5.0-male', ensembl_assembly: 'X_maculatus-5.0-male',
    why: 'The reference for a fin modified into an organ with a different job: the male anal fin is rebuilt as a gonopodium under hormonal control, a documented case of an existing appendage being re-specified rather than a new one appearing. Also live-bearing, so it separates fin development from an egg-laying schedule.',
  }),
  e({
    common: 'Amazon molly', binomial: 'Poecilia formosa', ensembl: 'poecilia_formosa', ncbi_taxid: 48698,
    group: 'teleost',
    assembly_accession: 'GCF_000485575.1', assembly_name: 'Poecilia_formosa-5.1.2', ensembl_assembly: 'PoeFor_5.1.2',
    why: 'An all-female clonal lineage of hybrid origin. It is the control for whether a morphological difference needs recombination to be maintained, and it bounds how much morphological variation survives in a genome that is not being reshuffled.',
  }),
  e({
    common: 'turbot', binomial: 'Scophthalmus maximus', ensembl: 'scophthalmus_maximus', ncbi_taxid: 52904,
    group: 'teleost',
    assembly_accession: 'GCF_022379125.1', assembly_name: 'ASM2237912v1', ensembl_assembly: 'ASM1334776v1',
    why: 'The reference for losing bilateral symmetry during development: the larva is symmetric and metamorphosis migrates one eye across the skull and rebuilds the cranium and fins around a new body axis. It is the entry for any claim about left-right asymmetry being established after, not before, the body plan.',
  }),

  // ---- ray-finned outgroup before the teleost duplication -------------------------------------------
  e({
    common: 'spotted gar', binomial: 'Lepisosteus oculatus', ensembl: 'lepisosteus_oculatus', ncbi_taxid: 7918,
    group: 'holostean',
    assembly_accession: 'GCF_040954835.1', assembly_name: 'fLepOcu1.hap2', ensembl_assembly: 'LepOcu1',
    why: 'The single most load-bearing outgroup in this list. It is ray-finned but diverged BEFORE the teleost genome duplication, so it has one copy where a teleost has two, and it is the bridge used to decide which teleost duplicate kept the ancestral role -- and which tetrapod gene a teleost gene actually corresponds to. Without it, a one-to-many orthologue set from a teleost cannot be resolved at all.',
  }),

  // ---- lobe-finned fish ----------------------------------------------------------------------------
  e({
    common: 'coelacanth', binomial: 'Latimeria chalumnae', ensembl: 'latimeria_chalumnae', ncbi_taxid: 7897,
    group: 'sarcopterygian-fish',
    assembly_accession: 'GCF_037176945.1', assembly_name: 'fLatCha1.pri', ensembl_assembly: 'LatCha1',
    why: 'A living lobe-finned fish, on the tetrapod side of the ray-finned split. Its lobed, muscular fins carry the skeletal pattern that the tetrapod limb was built from, so it is the reference for distinguishing a fin radial from a limb element, and for which limb regulatory elements predate limbs.',
  }),

  // ---- cartilaginous fish --------------------------------------------------------------------------
  e({
    common: 'elephant shark', binomial: 'Callorhinchus milii', ensembl: 'callorhinchus_milii', ncbi_taxid: 7868,
    group: 'chondrichthyan',
    assembly_accession: 'GCF_018977255.1', assembly_name: 'IMCB_Cmil_1.0', ensembl_assembly: 'Callorhinchus_milii-6.1.3',
    why: 'The jawed-vertebrate outgroup to all bony fishes, and the slowest-evolving vertebrate genome sequenced. It is the reference for what the jawed ancestor had: a cartilaginous endoskeleton with no bone, paired fins with an unmodified girdle, and the ancestral state of any gene family a bony-fish comparison alone would read as universal.',
  }),

  // ---- jawless fish --------------------------------------------------------------------------------
  e({
    common: 'sea lamprey', binomial: 'Petromyzon marinus', ensembl: 'petromyzon_marinus', ncbi_taxid: 7757,
    group: 'cyclostome',
    assembly_accession: 'GCF_048934315.1', assembly_name: 'UKy_Petmar_22M1.pri1.0', ensembl_assembly: 'Pmarinus_7.0',
    why: 'A vertebrate with no jaws and no paired fins. It is the outgroup that dates the two features most comparative fish work depends on: any claim that a structure is "ancestral for vertebrates" has to be true here, and a gene network present here predates both the jaw and the paired appendage.',
  }),

  // ---- tetrapod outgroups --------------------------------------------------------------------------
  e({
    common: 'western clawed frog', binomial: 'Xenopus tropicalis', ensembl: 'xenopus_tropicalis', ncbi_taxid: 8364,
    group: 'amphibian',
    assembly_accession: 'GCF_000004195.4', assembly_name: 'UCB_Xtro_10.0', ensembl_assembly: 'UCB_Xtro_10.0',
    why: 'The nearest tetrapod with externally accessible embryos and a non-duplicated genome, and the animal on which fin-to-limb comparisons are actually run. Its metamorphosis also provides a second, independent case of a vertebrate rebuilding its locomotor apparatus mid-life, to read the flatfish and salmon cases against.',
  }),
  e({
    common: 'house mouse', binomial: 'Mus musculus', ensembl: 'mus_musculus', ncbi_taxid: 10090,
    group: 'mammal',
    assembly_accession: 'GCF_000001635.27', assembly_name: 'GRCm39', ensembl_assembly: 'GRCm39',
    why: 'The amniote limb reference and the best-annotated vertebrate gene set after the human one. Most statements about what a developmental gene does were established here, so it is where a fish gene\'s annotation came from -- which is exactly why its orthology type to a teleost gene has to be checked rather than assumed.',
  }),
  e({
    common: 'human', binomial: 'Homo sapiens', ensembl: 'homo_sapiens', ncbi_taxid: 9606,
    group: 'mammal',
    assembly_accession: 'GCF_000001405.40', assembly_name: 'GRCh38.p14', ensembl_assembly: 'GRCh38',
    why: 'The annotation hub: gene names, disease associations and protein families are curated here first and propagated outwards, so it is the common currency of a cross-species comparison. Included as the far end of the distance scale, not as a morphological model -- and because a teleost-to-human lookup is the one most likely to return a one-to-many set that gets misread as an equivalent.',
  }),

  // ---- invertebrate chordate -----------------------------------------------------------------------
  e({
    common: 'vase tunicate', binomial: 'Ciona intestinalis', ensembl: 'ciona_intestinalis', ncbi_taxid: 7719,
    group: 'tunicate',
    assembly_accession: 'GCF_018327825.1', assembly_name: 'ASM1832782v2', ensembl_assembly: 'KH',
    why: 'The invertebrate chordate outgroup: a notochord, a dorsal nerve cord and a post-anal tail with no vertebrae, no fins and a 140 Mb genome. It is the floor of the comparison -- a feature shared with it is chordate, not vertebrate, and a gene family absent here appeared on the vertebrate stem.',
  }),
]);

export const byEnsembl = Object.freeze(Object.fromEntries(SPECIES.map(s => [s.ensembl, s])));
export const byTaxid = Object.freeze(Object.fromEntries(SPECIES.map(s => [s.ncbi_taxid, s])));
export const groupsPresent = () => [...new Set(SPECIES.map(s => s.group))].sort();

// ---------------------------------------------------------------------------------------------------
// Static defects: things checkable without a network, so an offline run still catches a bad entry.

export function inventoryDefects(species = SPECIES) {
  const defects = [];
  const seen = { ensembl: new Map(), taxid: new Map(), binomial: new Map() };
  for (const s of species) {
    const at = s.binomial || s.ensembl || '(unnamed entry)';
    if (!s.common) defects.push({ entry: at, defect: 'no common name' });
    if (!s.binomial) defects.push({ entry: at, defect: 'no binomial' });
    if (!s.ensembl) defects.push({ entry: at, defect: 'no Ensembl species key' });
    if (!Number.isInteger(s.ncbi_taxid) || s.ncbi_taxid <= 0) defects.push({ entry: at, defect: `taxid is not a positive integer (${s.ncbi_taxid})` });
    if (!/^GC[AF]_\d{9}\.\d+$/.test(s.assembly_accession || '')) defects.push({ entry: at, defect: `assembly_accession is not an accession (${s.assembly_accession})` });
    if (!s.assembly_name) defects.push({ entry: at, defect: 'no assembly_name' });
    if (!s.ensembl_assembly) defects.push({ entry: at, defect: 'no ensembl_assembly, so coordinates could not be attributed to a build' });
    if (!ALLOWED_GROUPS.includes(s.group)) defects.push({ entry: at, defect: `group "${s.group}" is not in ALLOWED_GROUPS, so the inventory is no longer a closed allow-list` });
    // The stated reason is the whole point of the inventory, so it is a hard requirement, not a nicety.
    if (!s.why || s.why.trim().length < 40) defects.push({ entry: at, defect: 'no stated reason for inclusion (`why`), or too short to name a question' });
    if (!s.provenance?.accession_from) defects.push({ entry: at, defect: 'no provenance for the accession' });
    if (!s.provenance?.ensembl_key_from) defects.push({ entry: at, defect: 'no provenance for the Ensembl key' });
    for (const [k, v] of [['ensembl', s.ensembl], ['taxid', s.ncbi_taxid], ['binomial', s.binomial]]) {
      if (v == null) continue;
      if (seen[k].has(v)) defects.push({ entry: at, defect: `duplicate ${k} ${v}, also on ${seen[k].get(v)}` });
      else seen[k].set(v, at);
    }
  }
  if (!EXCLUDED_CLADES.length) defects.push({ entry: '(inventory)', defect: 'EXCLUDED_CLADES is empty, so nothing records that anything is filtered out' });
  return defects;
}

// ---------------------------------------------------------------------------------------------------
// verifyInventory: actually call the APIs

const PER_ENTRY_OUTCOMES = Object.freeze(['verified', 'flagged', 'broken', 'unchecked']);

/**
 * Check every entry against the live APIs: the accession must resolve on NCBI Datasets to the organism
 * and taxon the entry claims, and the Ensembl species key must resolve on Ensembl REST to the assembly
 * the entry claims.
 *
 * Per-entry `state`:
 *   'verified'  both APIs resolved it and every field they returned matched the entry
 *   'flagged'   both resolved, but something they returned disagrees with the entry, or the assembly is
 *               not 'current' -- the entry is usable and the disagreement is reported, never swallowed
 *   'broken'    an API said no: the accession or the species key does not exist. Not silently kept.
 *   'unchecked' an API failed, or we did not ask -- says nothing about the entry either way
 *
 * 'broken' and 'unchecked' are kept apart on purpose: a down API must never be allowed to look like a bad
 * accession, because the fix for one is to wait and the fix for the other is to delete the entry.
 */
export async function verifyInventory({ species = SPECIES, checkHealth = true, probeGene = null, concurrency = 1 } = {}) {
  const started = new Date().toISOString();
  const h = checkHealth ? await health() : null;
  const defects = inventoryDefects(species);

  // Ensembl's own species list, fetched once: a per-species call would be 22 requests for one table.
  let ensemblIndex = null, ensemblIndexError = null;
  if (!h || h.apis.find(a => a.name === 'ensembl-rest')?.reachable) {
    const r = await cachedFetch('https://rest.ensembl.org/info/species?division=EnsemblVertebrates');
    if (r.error || r.status >= 400) ensemblIndexError = r.error || `HTTP ${r.status}`;
    else {
      try {
        const j = JSON.parse(r.body);
        ensemblIndex = new Map((j.species || []).map(s => [s.name, s]));
      } catch (err) { ensemblIndexError = `species list did not parse: ${err.message}`; }
    }
  } else {
    ensemblIndexError = 'Ensembl REST not reachable; species keys were not asked about';
  }

  const results = [];
  for (const s of species) {
    const notes = [], problems = [];
    let state = 'verified';
    const demote = to => { if (PER_ENTRY_OUTCOMES.indexOf(to) > PER_ENTRY_OUTCOMES.indexOf(state)) state = to; };

    // --- the accession, on NCBI Datasets ---
    const rep = await assemblyReport(s.assembly_accession);
    const accession_check = { outcome: rep.outcome, status: rep.status ?? null };
    if (rep.outcome === OUTCOME.ANSWERED) {
      const d = rep.data;
      accession_check.assembly_name = d.assembly_name;
      accession_check.organism = d.organism;
      accession_check.taxid = d.taxid;
      accession_check.assembly_level = d.assembly_level;
      accession_check.assembly_status = d.assembly_status;
      accession_check.total_sequence_length = d.total_sequence_length;
      accession_check.release_date = d.release_date;
      if (d.organism !== s.binomial) problems.push(`NCBI calls ${s.assembly_accession} "${d.organism}", the entry says "${s.binomial}"`);
      if (d.taxid !== s.ncbi_taxid) problems.push(`NCBI taxid for ${s.assembly_accession} is ${d.taxid}, the entry says ${s.ncbi_taxid}`);
      if (d.assembly_name !== s.assembly_name) problems.push(`NCBI assembly name is "${d.assembly_name}", the entry says "${s.assembly_name}"`);
      if (d.assembly_status && d.assembly_status !== 'current') {
        notes.push(`assembly_status is "${d.assembly_status}"${s.superseded_by ? `, superseded by ${s.superseded_by} (declared in the entry)` : ''}`);
        if (!s.superseded_by) problems.push(`assembly_status "${d.assembly_status}" and the entry does not declare what superseded it`);
      }
      if (!(d.total_sequence_length > 0)) problems.push('NCBI returned no total_sequence_length');
    } else if (rep.outcome === OUTCOME.ABSENT) {
      problems.push(`NCBI Datasets has no such accession: ${rep.reason}`);
      accession_check.reason = rep.reason;
      demote('broken');
    } else {
      notes.push(`accession not checked (${rep.outcome}): ${rep.error || rep.reason}`);
      accession_check.detail = rep.error || rep.reason;
      demote('unchecked');
    }

    // --- the Ensembl species key ---
    const ensembl_check = {};
    if (ensemblIndex) {
      const got = ensemblIndex.get(s.ensembl);
      if (!got) {
        ensembl_check.outcome = OUTCOME.ABSENT;
        problems.push(`Ensembl REST does not serve the species key "${s.ensembl}"`);
        demote('broken');
      } else {
        ensembl_check.outcome = OUTCOME.ANSWERED;
        ensembl_check.assembly = got.assembly;
        ensembl_check.taxon_id = got.taxon_id;
        ensembl_check.release = got.release ?? null;
        if (got.assembly !== s.ensembl_assembly) problems.push(`Ensembl serves assembly "${got.assembly}" for ${s.ensembl}, the entry says "${s.ensembl_assembly}"; coordinates would be attributed to the wrong build`);
        const expectTaxid = s.ensembl_taxid ?? s.ncbi_taxid;
        if (String(got.taxon_id) !== String(expectTaxid)) problems.push(`Ensembl reports taxon ${got.taxon_id} for ${s.ensembl}, the entry expects ${expectTaxid}`);
      }
    } else {
      ensembl_check.outcome = OUTCOME.NOT_ASKED;
      ensembl_check.reason = ensemblIndexError;
      notes.push(`Ensembl key not checked: ${ensemblIndexError}`);
      demote('unchecked');
    }

    // --- optional: a gene symbol that should resolve in every entry, proving the key is queryable ---
    let gene_check = null;
    if (probeGene && ensembl_check.outcome === OUTCOME.ANSWERED) {
      const g = await geneBySymbol(s.ensembl, probeGene);
      gene_check = { symbol: probeGene, outcome: g.outcome, id: g.data?.id ?? null, reason: g.reason ?? g.error ?? null };
      // A missing gene is a fact about the gene, not a defect in the entry, so it never demotes.
      notes.push(`probe gene ${probeGene}: ${g.outcome}${g.data?.id ? ` -> ${g.data.id}` : ''}`);
    }

    if (problems.length && state === 'verified') state = 'flagged';
    const entryDefects = defects.filter(d => d.entry === s.binomial);
    if (entryDefects.length) { problems.push(...entryDefects.map(d => `static defect: ${d.defect}`)); if (state === 'verified') state = 'flagged'; }

    results.push({ binomial: s.binomial, common: s.common, ensembl: s.ensembl, group: s.group, accession: s.assembly_accession, state, problems, notes, accession_check, ensembl_check, gene_check });
  }

  const tally = Object.fromEntries(PER_ENTRY_OUTCOMES.map(k => [k, results.filter(r => r.state === k).length]));
  return {
    started,
    finished: new Date().toISOString(),
    n_entries: species.length,
    excluded_clades: [...EXCLUDED_CLADES],
    allowed_groups: [...ALLOWED_GROUPS],
    groups_present: groupsPresent(),
    health: h,
    static_defects: defects,
    results,
    tally,
    // 'verified' + 'flagged' are entries the APIs resolved; 'broken' are entries to delete or fix;
    // 'unchecked' are entries this run says nothing about.
    verified: results.filter(r => r.state === 'verified').map(r => r.binomial),
    flagged: results.filter(r => r.state === 'flagged').map(r => ({ binomial: r.binomial, problems: r.problems })),
    broken: results.filter(r => r.state === 'broken').map(r => ({ binomial: r.binomial, problems: r.problems })),
    unchecked: results.filter(r => r.state === 'unchecked').map(r => ({ binomial: r.binomial, notes: r.notes })),
    clean: defects.length === 0 && results.every(r => r.state === 'verified'),
  };
}

// ---------------------------------------------------------------------------------------------------

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const listOnly = process.argv.includes('--list');
  console.log(`\nanalogues/inventory: ${SPECIES.length} comparative reference species`);
  console.log(`excluded_clades: ${JSON.stringify([...EXCLUDED_CLADES])}`);
  console.log(`groups: ${groupsPresent().join(', ')}\n`);
  if (listOnly) {
    for (const s of SPECIES) {
      console.log(`  ${s.common} (${s.binomial})  [${s.group}]`);
      console.log(`     ensembl ${s.ensembl} @ ${s.ensembl_assembly}   ncbi ${s.assembly_accession} (${s.assembly_name})   taxid ${s.ncbi_taxid}`);
      console.log(`     why: ${s.why}`);
      console.log(`     provenance: ${s.provenance.accession_from}\n`);
    }
    const d = inventoryDefects();
    console.log(d.length ? `${d.length} static defect(s):\n${d.map(x => `  ${x.entry}: ${x.defect}`).join('\n')}` : 'no static defects');
    process.exit(d.length ? 1 : 0);
  }
  const v = await verifyInventory();
  for (const r of v.results) {
    const mark = { verified: 'ok      ', flagged: 'FLAGGED ', broken: 'BROKEN  ', unchecked: 'unchecked' }[r.state];
    console.log(`  ${mark} ${r.common.padEnd(26)} ${r.accession.padEnd(18)} ${r.accession_check.assembly_name ?? '-'}  ${r.accession_check.total_sequence_length ? `${(r.accession_check.total_sequence_length / 1e6).toFixed(1)} Mb` : ''}`);
    for (const p of r.problems) console.log(`           ! ${p}`);
    for (const n of r.notes) console.log(`           . ${n}`);
  }
  console.log(`\n${Object.entries(v.tally).map(([k, n]) => `${n} ${k}`).join(', ')}; ${v.static_defects.length} static defect(s)`);
  if (v.broken.length) console.log(`BROKEN entries must be fixed or removed: ${v.broken.map(b => b.binomial).join(', ')}`);
  process.exit(v.broken.length || v.static_defects.length ? 1 : 0);
}
