#!/usr/bin/env node
// Build functional/data/analogue-requirements.json: the FUNCTIONAL REQUIREMENT SET of the flying-fish analogue,
// at the level our annotations support (loci, residues, rates), with the analogue's own state MEASURED from the
// captured exons rather than copied from the publisher's sheet.
//
// Inputs (all local or already cached; no network here):
//   genotype/cache/daane2021_data_s1_mmc2.xlsx   -> C:/Temp/functional-cache/daane_sheets.json (scripts/dump_sheets.py)
//   C:/Temp/sequences/daane_sheetG.json          -> per-species residues projected on medaka coordinates
//                                                   (built by sequences/scripts/fetch_sheetG.py, another thread)
//   C:/Temp/functional-cache/ortho/<ENS*>.json   -> Ensembl Compara orthologue to Danio rerio (scripts/fetch-orthologues.mjs)
//   omics/genes.json                             -> the annotated zebrafish gene universe (join key zfin_id)
//
// No Aves anywhere: the panel is beloniform fishes and the orthologue target species is danio_rerio only.
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const CACHE = process.env.FUNCTIONAL_CACHE_DIR || 'C:/Temp/functional-cache';
const SEQ_CACHE = process.env.SEQUENCES_CACHE_DIR || 'C:/Temp/sequences';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const sheets = read(path.join(CACHE, 'daane_sheets.json'));
const sheetG = read(path.join(SEQ_CACHE, 'daane_sheetG.json'));
const genes = read(path.join(ROOT, 'omics', 'genes.json'));
const byEnsembl = new Map(genes.genes.filter(g => g.ensembl_gene).map(g => [g.ensembl_gene, g]));

const EXOCOETIDAE = 'flying fish (Exocoetidae)';
const GLIDING_HALFBEAK = 'flying (gliding) halfbeak';
const DAANE = 'Daane et al. 2021, Curr Biol, doi 10.1016/j.cub.2021.08.054, PMID 34534441, Data S1 (genotype/cache/daane2021_data_s1_mmc2.xlsx)';

function orthologue(id) {
  const f = path.join(CACHE, 'ortho', `${id}.json`);
  if (!fs.existsSync(f)) return { fetched: false };
  const o = read(f);
  const hs = (o.homologies || []).filter(h => /^ENSDARG/.test(h.danio_gene));
  return { fetched: true, http: o.http, source_species: o.source_species, homologies: hs };
}

/** The analogue's state at a sheet-G site, READ from the captured exons per Exocoetidae species. */
function analogueState(ensembl, pos, ref, alt) {
  const g = sheetG.genes[ensembl];
  if (!g) return { read: false, why: `no captured exon alignment for ${ensembl} in the sequences cache` };
  const grab = role => Object.entries(g).filter(([, v]) => v.role === role)
    .map(([sp, v]) => ({ species: sp.replace(/_/g, ' '), residue: (v.projected_on_medaka_coords || '')[pos - 1] || '-' }));
  const ff = grab(EXOCOETIDAE), gh = grab(GLIDING_HALFBEAK);
  const withData = ff.filter(x => x.residue !== '-');
  return {
    read: true,
    exocoetidae: ff, gliding_halfbeak: gh,
    n_species: ff.length, n_with_data: withData.length,
    n_carrying_derived: withData.filter(x => x.residue === alt).length,
    n_carrying_ancestral: withData.filter(x => x.residue === ref).length,
    gliding_halfbeak_carrying_derived: gh.filter(x => x.residue === alt).length,
  };
}

const requirements = [];

// ---- sheet G: convergent amino-acid substitutions ticked for Exocoetidae. A STATE requirement.
const seen = new Set();
for (const r of sheets['G - conv. aa subst.']) {
  const [id, symbol, sub] = r;
  if (!/^ENS[A-Z]*G\d+$/.test(id || '') || !symbol || symbol === 'NA') continue;
  const m = /^([A-Z])(\d+)([A-Z*])$/.exec(String(sub).trim());
  if (!m) continue;
  const [, ref, posS, alt] = m; const pos = Number(posS);
  if (ref === alt) continue;                               // synonymous as written (doc2d P44P)
  const key = `${id}:${sub}`; if (seen.has(key)) continue; seen.add(key);
  const st = analogueState(id, pos, ref, alt);
  const o = orthologue(id);
  const one2one = o.homologies?.find(h => h.type === 'ortholog_one2one') || o.homologies?.[0] || null;
  const zf = one2one ? byEnsembl.get(one2one.danio_gene) || null : null;
  requirements.push({
    id: `G:${id}:${sub}`, sheet: 'G - conv. aa subst.', level: 'residue',
    requirement: `the analogue carries the Exocoetidae-associated derived residue ${alt} in place of ${ref} at position ${pos} of ${symbol} (${id})`,
    value: alt, unit: 'amino acid', source: `${DAANE}, sheet G; the per-species residue re-read from the captured exons (sequences/scripts/fetch_sheetG.py)`,
    kind: st.read ? 'measured' : 'curated',
    locus: { source_id: id, source_symbol: symbol, source_species: o.source_species || null, substitution: sub, ref, pos, alt },
    analogue_state: st,
    zebrafish: zf ? { symbol: zf.symbol, zfin_id: zf.zfin_id, ensembl_gene: zf.ensembl_gene, uniprot: zf.uniprot || null, orthologue_type: one2one.type, taxonomy_level: one2one.taxonomy_level, flying_fish_id: zf.flying_fish || null }
      : one2one ? { symbol: null, ensembl_gene: one2one.danio_gene, orthologue_type: one2one.type, taxonomy_level: one2one.taxonomy_level, outside_gene_universe: true }
        : { none: true, why: o.fetched ? 'Ensembl Compara returned no Danio rerio orthologue for this locus' : 'orthologue not fetched' },
    n_danio_orthologues: o.homologies?.length ?? 0,
    all_danio_orthologues: (o.homologies || []).map(h => ({ ensembl_gene: h.danio_gene, type: h.type, symbol: byEnsembl.get(h.danio_gene)?.symbol || null })),
  });
}

// ---- sheet I: glider relative-evolutionary-rate genes. A RATE requirement, with no per-species state.
for (const r of sheets['I - Glider RER genes']) {
  const [id, symbol, rho, p, q] = r;
  if (!/^ENS[A-Z]*G\d+$/.test(id || '') || !symbol) continue;
  const o = orthologue(id);
  const one2one = o.homologies?.find(h => h.type === 'ortholog_one2one') || o.homologies?.[0] || null;
  const zf = one2one ? byEnsembl.get(one2one.danio_gene) || null : null;
  requirements.push({
    id: `I:${id}`, sheet: 'I - Glider RER genes', level: 'gene_evolutionary_rate',
    requirement: `${symbol} (${id}) shows a relative-evolutionary-rate shift correlated with gliding across the tree (rho ${Number(rho).toFixed(3)}, p ${Number(p).toExponential(2)}, q ${Number(q).toFixed(3)})`,
    value: Number(rho), unit: 'RER rho (rate-trait correlation)',
    source: `${DAANE}, sheet I`, kind: 'curated',
    locus: { source_id: id, source_symbol: symbol, source_species: o.source_species || null, rho: Number(rho), p: Number(p), q: Number(q) },
    analogue_state: { read: false, why: 'RER is a per-GENE rate correlation across the whole tree, not a per-species residue: there is no state in the analogue to compare a design against. Daane 2021 sheet I gives no site and no per-species value.' },
    zebrafish: zf ? { symbol: zf.symbol, zfin_id: zf.zfin_id, ensembl_gene: zf.ensembl_gene, uniprot: zf.uniprot || null, orthologue_type: one2one.type, taxonomy_level: one2one.taxonomy_level, flying_fish_id: zf.flying_fish || null }
      : one2one ? { symbol: null, ensembl_gene: one2one.danio_gene, orthologue_type: one2one.type, taxonomy_level: one2one.taxonomy_level, outside_gene_universe: true }
        : { none: true, why: o.fetched ? 'Ensembl Compara returned no Danio rerio orthologue for this locus' : 'orthologue not fetched' },
    n_danio_orthologues: o.homologies?.length ?? 0,
    all_danio_orthologues: (o.homologies || []).map(h => ({ ensembl_gene: h.danio_gene, type: h.type, symbol: byEnsembl.get(h.danio_gene)?.symbol || null })),
    q_below_0_05: Number(q) < 0.05,
  });
}

const out = {
  title: 'Functional requirement set of the flying-fish analogue (Exocoetidae), at the level our annotations support',
  built: new Date().toISOString(),
  tool: 'sim-engine/validate/functional/scripts/build-requirements.mjs',
  function: 'glides_over_water / enlarged_paired_pectoral_fins (the same source paper supplies both)',
  analogue: 'Exocoetidae (flying fishes), with the gliding halfbeaks as the second, independent glider in the same order',
  what_this_is:
    'Every locus Daane 2021 reports as DIFFERING in flying fishes, turned into a requirement on a design. Sheet G is '
    + 'a per-site state requirement (a residue). Sheet I is a per-gene RATE requirement and has no state, so nothing '
    + 'a design does can be compared against it; it is kept because leaving it out would flatter the coverage number.',
  what_this_is_not: [
    'NOT the set of loci that differ in flying fishes. It is the set KNOWN to differ: 74 coding loci against the 23,611 predicted protein-coding genes of the Hirundichthys speculiger assembly (0.31 %).',
    'NOT a causal set. Daane 2021 reports convergent substitutions and rate shifts; our own sequences/progression.json warns that tracking is not causing, and that the non-gliders score zero at these sites BY CONSTRUCTION.',
    'NOT a non-coding requirement set. Sheets K and M (accelerated conserved non-coding elements) are GO-term enrichment tables with no gene column, so the regulatory requirements - which is where most between-species difference lives - cannot be enumerated at all. That is a named gap, not a zero.',
  ],
  sources: {
    daane: DAANE,
    per_species_residues: 'C:/Temp/sequences/daane_sheetG.json (sequences/ thread: Zenodo translated exons, projected on medaka coordinates)',
    orthologues: 'Ensembl REST /homology/id/<species>/<id>?target_species=danio_rerio;type=orthologues (Compara); one JSON per locus in C:/Temp/functional-cache/ortho/',
    gene_universe: 'omics/genes.json (3,860 zebrafish genes; join key zfin_id)',
  },
  counts: {
    requirements: requirements.length,
    sheet_G: requirements.filter(r => r.level === 'residue').length,
    sheet_I: requirements.filter(r => r.level === 'gene_evolutionary_rate').length,
    with_a_danio_orthologue: requirements.filter(r => !r.zebrafish.none).length,
    with_a_danio_orthologue_in_our_gene_universe: requirements.filter(r => r.zebrafish.symbol).length,
    analogue_state_read: requirements.filter(r => r.analogue_state.read).length,
    with_a_flying_fish_protein_id: requirements.filter(r => r.zebrafish.flying_fish_id).length,
  },
  requirements,
};
const outFile = path.join(HERE, '..', 'data', 'analogue-requirements.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.counts, null, 1));
console.log('wrote', outFile);
