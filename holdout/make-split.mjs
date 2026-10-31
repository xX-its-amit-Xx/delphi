#!/usr/bin/env node
// Freezes the held-out exam for DELPHI: which organisms no builder may use, and what the
// exam over them looks like. Everything is derived from repo files; nothing is typed by hand.
//
//   node holdout/make-split.mjs                   # write holdout/{split,exam}.json, holdout-taxa.csv, CHECKSUMS.json
//   node holdout/make-split.mjs --verify          # recompute and compare with CHECKSUMS.json (exit 1 on any change)
//   node holdout/make-split.mjs --clade Mammalia  # size an alternative clade (writes to holdout/alt/<clade>/)
//
// Inputs (read only): organisms/merged/taxa.json, organisms/merged/datasets.json,
//                     dashboard/genomes.cache.json, docs/claims.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

// ------------------------------------------------------------------------------------------
// THE RULE. Change the clade here (or with --clade) and nothing else.
// ------------------------------------------------------------------------------------------
const CLADES = {
  Aves: {
    label: 'birds', singular: 'bird',
    // Taxa in the inventory that sit above class rank and contain the held-out clade. They are
    // neither held out nor available for building, because their data mixes both sides.
    containers: ['Animalia', 'Metazoa', 'Eumetazoa', 'Bilateria', 'Deuterostomia', 'Chordata', 'Vertebrata', 'Craniata',
      'Gnathostomata', 'Osteichthyes', 'Sarcopterygii', 'Tetrapoda', 'Amniota', 'Sauropsida', 'Diapsida', 'Archosauria',
      'Dinosauria', 'Theropoda'],
    // Trait tables whose rows for held-out species are the exam's answer key.
    traitSources: { avonet: /^avonet/, amniote: /^amniote-life-history/, anage: /^anage-build/, eltontraits: /^eltontraits/ }
  },
  Mammalia: {
    label: 'mammals', singular: 'mammal',
    containers: ['Animalia', 'Metazoa', 'Eumetazoa', 'Bilateria', 'Deuterostomia', 'Chordata', 'Vertebrata', 'Craniata',
      'Gnathostomata', 'Osteichthyes', 'Sarcopterygii', 'Tetrapoda', 'Amniota', 'Synapsida', 'Therapsida'],
    traitSources: { pantheria: /^pantheria/, amniote: /^amniote-life-history/, anage: /^anage-build/, eltontraits: /^eltontraits/ }
  }
};
const DEFAULT_CLADE = 'Aves';
const PROVISIONAL = true; // flip to false once Amit confirms the clade; the hub asked for this to be stated

const cladeName = opt('--clade', DEFAULT_CLADE);
const clade = CLADES[cladeName];
if (!clade) { console.error(`unknown clade ${cladeName}; known: ${Object.keys(CLADES).join(', ')}`); process.exit(2); }
const outDir = cladeName === DEFAULT_CLADE ? path.join(root, 'holdout') : path.join(root, 'holdout', 'alt', cladeName);

const INPUTS = ['organisms/merged/taxa.json', 'organisms/merged/datasets.json', 'dashboard/genomes.cache.json', 'docs/claims.json'];
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const readRaw = p => fs.readFileSync(path.join(root, p));
const rd = p => JSON.parse(readRaw(p).toString('utf8'));

const taxa = rd(INPUTS[0]);
const datasets = rd(INPUTS[1]);
const genomes = rd(INPUTS[2]);
const claims = rd(INPUTS[3]).claims;

// NCBI's "reference genome" flag also covers scaffold-level and contig-level assemblies, so the
// exam counts an organism as genome-ready only when its best assembly is chromosome-level or complete.
const GENOME_READY = new Set(['Chromosome', 'Complete Genome']);

function assign(t) {
  const cls = t.lineage?.class || null;
  if (cls === cladeName) return ['holdout', `lineage.class is ${cladeName}`];
  if (clade.containers.includes(t.accepted_name)) return ['excluded', `ranks above ${cladeName} and contains it, so its data mixes held-out and training organisms`];
  if (cls) return ['train', `lineage.class is ${cls}`];
  return ['train', `no class in lineage (rank ${t.rank}, phylum ${t.lineage?.phylum || 'unknown'}); does not contain ${cladeName}`];
}

const rows = taxa.map(t => {
  const [assignment, reason] = assign(t);
  const ncbi = t.identifiers?.ncbi_taxid ?? null;
  const g = ncbi != null ? genomes[ncbi] : null;
  const level = g?.best?.level ?? null;
  const traits = {};
  for (const [k, re] of Object.entries(clade.traitSources)) traits[k] = t.datasets.some(id => re.test(id));
  return {
    key: t.key, slug: t.slug, name: t.accepted_name, rank: t.rank,
    phylum: t.lineage?.phylum || null, class: t.lineage?.class || null, order: t.lineage?.order || null, family: t.lineage?.family || null,
    ids: { gbif: t.identifiers?.gbif_usage_key ?? null, ncbi, wikidata: t.identifiers?.wikidata_qid ?? null },
    assignment, reason,
    projects: t.projects, mentions: t.mention_count, claims: t.mentioned_in.length,
    genome: g ? { assemblies: g.total, ncbi_reference_flag: g.reference, best_accession: g.best?.acc ?? null, best_level: level, ready: GENOME_READY.has(level), retrieved: g.retrieved } : null,
    traits, datasets: t.datasets
  };
});

const by = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] ||= []).push(x); return m; }, {});
const groups = by(rows, r => r.assignment);
const holdout = groups.holdout || [];
const isSpecies = r => r.rank === 'species' || r.rank === 'subspecies';
const species = holdout.filter(isSpecies);

// Claims whose mentioned organisms fall on one side or the other.
const taxaByClaim = {};
for (const t of taxa) for (const c of t.mentioned_in) (taxaByClaim[c] ||= []).push(t.key);
const assignOf = Object.fromEntries(rows.map(r => [r.key, r.assignment]));
const claimSides = claims.map(c => {
  const ks = taxaByClaim[c.id] || [];
  const sides = new Set(ks.map(k => assignOf[k]));
  const side = ks.length === 0 ? 'no-organism' : sides.has('holdout') ? (sides.has('train') ? 'mixed' : 'holdout') : sides.has('train') ? 'train' : 'excluded-only';
  return { id: c.id, side, holdout_taxa: ks.filter(k => assignOf[k] === 'holdout'), n_taxa: ks.length, kind: c.kind, status: c.status, label: c.label };
});
const claimCounts = Object.fromEntries(Object.entries(by(claimSides, c => c.side)).map(([k, v]) => [k, v.length]));

const anyTrait = r => Object.values(r.traits).some(Boolean);
const summary = {
  taxa: rows.length,
  holdout: holdout.length, train: (groups.train || []).length, excluded: (groups.excluded || []).length,
  holdout_species: species.length,
  holdout_species_with_assembly: species.filter(r => r.genome && r.genome.assemblies > 0).length,
  holdout_species_genome_ready: species.filter(r => r.genome?.ready).length,
  holdout_species_reference_flag_but_not_ready: species.filter(r => r.genome && r.genome.ncbi_reference_flag > 0 && !r.genome.ready).length,
  holdout_species_no_assembly: species.filter(r => !r.genome || r.genome.assemblies === 0).length,
  holdout_species_with_trait_table: species.filter(anyTrait).length,
  holdout_species_exam_ready: species.filter(r => r.genome?.ready && anyTrait(r)).length,
  holdout_mentions: holdout.reduce((a, r) => a + r.mentions, 0),
  holdout_higher_taxa: holdout.length - species.length,
  claims: claimCounts,
  trait_sources: Object.fromEntries(Object.keys(clade.traitSources).map(k => [k, species.filter(r => r.traits[k]).length]))
};

const split = {
  clade: cladeName, label: clade.label, provisional: PROVISIONAL,
  rule: [
    `An organism is held out when the inventory's lineage puts it in class ${cladeName} (any rank: species, genus, family, order, or the class itself).`,
    `The rule is the class, not the list: a ${clade.singular} species that is not in the inventory is held out too.`,
    `A taxon above class rank that contains ${cladeName} (${clade.containers.join(', ')}) is excluded from both sides, because its data mixes them.`,
    'Everything else is available for building (train).',
    "Genome-ready means the best NCBI assembly is chromosome-level or a complete genome. NCBI's reference flag alone is not enough, because it also marks scaffold-level and contig-level assemblies."
  ],
  inputs: INPUTS,
  summary,
  taxa: rows.map(({ datasets, ...r }) => ({ ...r, n_datasets: datasets.length }))
};

const exam = {
  clade: cladeName, label: clade.label, provisional: PROVISIONAL,
  what_is_tested: 'Each candidate law that a builder supports on training organisms is re-scored, by an assessor who did not build it, on the held-out species below, using the same pre-registered pass and fail criteria. A law counts as generalizing only if it passes here.',
  rules_for_builders: [
    `Do not fit, tune, select or sanity-check anything on data for a ${clade.singular}: no ${cladeName} rows from trait tables, genomes, occurrence counts, fossils, or claim texts that only ${cladeName} organisms support.`,
    "A claim test's planned_datasets may name a shared table (AnAge, EltonTraits, the Amniote database) only with the held-out class filtered out, and the filter must be in the committed analysis script.",
    'The exam is run once, after building stops, on the frozen roster below. The roster’s SHA-256 is in CHECKSUMS.json; node holdout/make-split.mjs --verify checks it.',
    'Reading this file is allowed. It names organisms, identifiers and which tables cover them; it contains no trait values.'
  ],
  roster: species.map(r => ({ key: r.key, name: r.name, rank: r.rank, order: r.order, family: r.family, ids: r.ids, genome: r.genome && { best_accession: r.genome.best_accession, best_level: r.genome.best_level, ready: r.genome.ready }, traits: r.traits, mentions: r.mentions, claims: r.claims })),
  higher_taxa_also_held_out: holdout.filter(r => !isSpecies(r)).map(r => ({ key: r.key, name: r.name, rank: r.rank })),
  claims_mentioning_holdout: claimSides.filter(c => c.side === 'holdout' || c.side === 'mixed').map(c => ({ id: c.id, side: c.side, label: c.label, kind: c.kind, holdout_taxa: c.holdout_taxa })),
  summary
};

const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
const traitKeys = Object.keys(clade.traitSources);
const csv = [['key', 'name', 'rank', 'order', 'family', 'gbif', 'ncbi_taxid', 'wikidata', 'assignment', 'mentions', 'claims', 'assemblies', 'best_assembly', 'best_level', 'genome_ready', ...traitKeys].join(',')]
  .concat(holdout.map(r => [r.key, r.name, r.rank, r.order, r.family, r.ids.gbif, r.ids.ncbi, r.ids.wikidata, r.assignment, r.mentions, r.claims,
    r.genome?.assemblies ?? '', r.genome?.best_accession ?? '', r.genome?.best_level ?? '', r.genome ? r.genome.ready : '', ...traitKeys.map(k => r.traits[k])].map(q).join(',')))
  .join('\n') + '\n';

const outputs = {
  'split.json': JSON.stringify(split, null, 1) + '\n',
  'exam.json': JSON.stringify(exam, null, 1) + '\n',
  'holdout-taxa.csv': csv
};
const manifest = {
  clade: cladeName, provisional: PROVISIONAL,
  inputs: Object.fromEntries(INPUTS.map(p => [p, { sha256: sha256(readRaw(p)), bytes: readRaw(p).length }])),
  outputs: Object.fromEntries(Object.entries(outputs).map(([k, v]) => [k, { sha256: sha256(v), bytes: Buffer.byteLength(v) }])),
  generator: 'holdout/make-split.mjs'
};

if (flag('--verify')) {
  const mp = path.join(outDir, 'CHECKSUMS.json');
  if (!fs.existsSync(mp)) { console.error('no CHECKSUMS.json to verify against'); process.exit(1); }
  const frozen = JSON.parse(fs.readFileSync(mp, 'utf8'));
  let bad = 0;
  for (const [p, v] of Object.entries(frozen.inputs)) if (manifest.inputs[p]?.sha256 !== v.sha256) { console.log(`CHANGED input  ${p}`); bad++; }
  for (const [p, v] of Object.entries(frozen.outputs)) {
    const onDisk = fs.existsSync(path.join(outDir, p)) ? sha256(fs.readFileSync(path.join(outDir, p))) : null;
    if (onDisk !== v.sha256) { console.log(`CHANGED output file ${p}`); bad++; }
    if (manifest.outputs[p]?.sha256 !== v.sha256) { console.log(`RECOMPUTED differs ${p}`); bad++; }
  }
  console.log(bad ? `FROZEN SPLIT BROKEN: ${bad} difference(s) since ${frozen.frozen_at}` : `frozen split intact (frozen ${frozen.frozen_at}, clade ${frozen.clade}${frozen.provisional ? ', provisional' : ''})`);
  process.exit(bad ? 1 : 0);
}

fs.mkdirSync(outDir, { recursive: true });
for (const [k, v] of Object.entries(outputs)) fs.writeFileSync(path.join(outDir, k), v);
const mp = path.join(outDir, 'CHECKSUMS.json');
const prev = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : null;
const unchanged = prev && JSON.stringify(prev.outputs) === JSON.stringify(manifest.outputs) && JSON.stringify(prev.inputs) === JSON.stringify(manifest.inputs);
manifest.frozen_at = unchanged ? prev.frozen_at : new Date().toISOString();
fs.writeFileSync(mp, JSON.stringify(manifest, null, 1) + '\n');
console.log(`${cladeName}: ${summary.holdout} held out (${summary.holdout_species} species, ${summary.holdout_species_genome_ready} genome-ready, ${summary.holdout_species_exam_ready} genome+traits), ${summary.train} train, ${summary.excluded} excluded; claims: ${JSON.stringify(claimCounts)}; frozen_at ${manifest.frozen_at}${unchanged ? ' (unchanged)' : ''}`);
