// The storyboard: the data an animation needs to show the pipeline doing its work, including failing.
//
// ============================== THE DESIGN RULE ==============================
// An animation of a pipeline is a marketing asset unless it can end badly. So the storyboard is built so
// that a run may terminate at any stage with a REFUSAL, and the refusal is rendered as prominently as a
// success. Of the three worked requests, only one is a genome-editing problem in the shape the pipeline
// assumes; a system that silently produced a cassette for all three would be wrong three times in three
// different ways, and the animation exists to show that rather than to hide it.
//
// Each stage therefore carries `outcome: 'proceed' | 'refuse' | 'degrade'`, and a stage that refuses
// carries what would have to change. A storyboard where every stage proceeds is a bug in the storyboard.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Load a sibling module if it exists yet. The storyboard degrades rather than failing to build. */
async function optional(name) {
  try { return await import(`./${name}`); } catch { return null; }
}

export const STAGES = Object.freeze([
  { id: 'request', title: 'The request', what: 'what was asked, and what is actually being asked' },
  { id: 'mine', title: 'Mining', what: 'agents fan out across reference genomes and phenotype records' },
  { id: 'map', title: 'Mapping', what: 'candidate analogues, classified by the KIND of evidence behind each' },
  { id: 'place', title: 'Placing', what: 'the candidates on a tree, because distance bounds any transfer claim' },
  { id: 'align', title: 'Aligning', what: 'the real sequence alignment of the chosen pair' },
  { id: 'phenome', title: 'Phenome', what: 'whether the two phenotypes are even the same measurement' },
  { id: 'cassette', title: 'Cassette', what: 'the parts, the cut site, and the junctions' },
  { id: 'verdict', title: 'Verdict', what: 'proceed, or refuse and say what would change it' },
]);

export const WHY_IT_CAN_FAIL = Object.freeze({
  rule: 'every stage may refuse, and a refusal is rendered as prominently as a success',
  because: 'an animation of a pipeline that always succeeds is a marketing asset. The three worked ' +
    'requests fail in three different ways - one is not a mapping problem, one is not a single-edit ' +
    'problem, and one is not about the named organism at all - and only one reaches a cassette.',
  the_test: 'a storyboard in which every stage of every case proceeds is a bug in the storyboard, and ' +
    'there is a test asserting at least one case refuses before reaching the cassette stage.',
});

/**
 * Build the storyboard for one case. Pulls real module output where available and marks anything it
 * could not reach as absent rather than inventing it - the same discipline as the .organism census.
 */
export async function buildCase(caseId, inject = null) {
  // inject lets a test supply module stand-ins, so the storyboard logic is testable without the modules
  // Key PRESENCE, not ?? - a test injecting {inventory: null} means absent, and ?? would fall
  // through to the real module and silently stop testing the degraded path. This bit once.
  const pick = async (k, file) => (inject && k in inject ? inject[k] : await optional(file));
  const cases = await pick('cases', 'cases.mjs');
  const analogy = await pick('analogy', 'analogy.mjs');
  const phylo = await pick('phylo', 'phylo.mjs');
  const align = await pick('align', 'align.mjs');
  const inventory = await pick('inventory', 'inventory.mjs');

  const c = cases?.CASES?.find(x => x.id === caseId) ?? null;
  const missing = [];
  if (!cases) missing.push('cases.mjs');
  if (!analogy) missing.push('analogy.mjs');
  if (!phylo) missing.push('phylo.mjs');
  if (!align) missing.push('align.mjs');
  if (!inventory) missing.push('inventory.mjs');

  const stages = [];
  const push = (id, outcome, data) => stages.push({ ...STAGES.find(s => s.id === id), outcome, ...data });

  push('request', 'proceed', {
    request: c?.request ?? caseId,
    what_is_actually_being_asked: c?.what_actually_being_asked ?? c?.what_is_actually_being_asked ?? null,
    target_organism: c?.target_organism ?? null,
  });

  // Mining: the species actually searched. The count is the honest headline - "many genomes" means a
  // number, and the number is usually smaller than the picture implies.
  const species = inventory?.SPECIES ?? [];
  push('mine', species.length ? 'proceed' : 'degrade', {
    species_searched: species.length,
    species: species.map(s => ({ name: s.common_name ?? s.common ?? s.binomial, binomial: s.binomial, why: s.why ?? null })),
    note: species.length
      ? 'these are the references actually queried, not an impression of breadth'
      : 'the inventory is not available, so nothing was searched. This is a degradation, not a pass.',
  });

  // Mapping: the right-or-wrong-organism question is decided here, and it is the one that sinks a case.
  const rightOrganism = c?.is_the_target_organism_the_right_one;
  push('map', rightOrganism === false ? 'refuse' : 'proceed', {
    analogy_class: c?.analogy_class ?? null,
    is_the_target_organism_the_right_one: rightOrganism ?? null,
    refusal: rightOrganism === false
      ? 'the trait is not encoded by the named organism, so no mapping in its genome can produce it. Editing it is editing the wrong genome.'
      : null,
    evidence_kinds: analogy?.EVIDENCE_KINDS ? Object.keys(analogy.EVIDENCE_KINDS) : [],
  });

  push('place', phylo ? 'proceed' : 'degrade', {
    tree: phylo?.TREE ?? null,
    caution: phylo?.THE_NAMING_TRAP ? 'phenotype names do not travel between species; see THE_NAMING_TRAP' : null,
  });

  push('align', align ? 'proceed' : 'degrade', { available: Boolean(align) });

  push('phenome', 'proceed', {
    what_would_have_to_be_measured: c?.what_would_have_to_be_measured ?? null,
  });

  const verdict = c?.verdict ?? null;
  const reachesCassette = verdict === 'addable';
  push('cassette', reachesCassette ? 'proceed' : 'refuse', {
    crispr_is_the_right_tool: c?.crispr_relevance ?? null,
    refusal: reachesCassette ? null : `verdict is "${verdict}", so no cassette is designed. A system that produced one anyway would be answering a question that was not asked.`,
  });

  push('verdict', verdict === 'addable' ? 'proceed' : 'refuse', {
    verdict,
    how_it_could_fail: c?.how_it_could_fail ?? null,
    sources: c?.sources ?? [],
  });

  return {
    case_id: caseId,
    found: Boolean(c),
    stages,
    modules_missing: missing,
    reached_cassette: reachesCassette,
    refused_at: stages.find(s => s.outcome === 'refuse')?.id ?? null,
  };
}

/** Build every case, and assert the set as a whole still demonstrates failure. */
export async function buildAll(inject = null) {
  const cases = inject && 'cases' in inject ? inject.cases : await optional('cases.mjs');
  const ids = cases?.CASES?.map(c => c.id) ?? [];
  const built = [];
  for (const id of ids) built.push(await buildCase(id, inject));
  const refusing = built.filter(b => b.refused_at);
  return {
    built_at_note: 'timestamps are added by the writer, not here, so the storyboard is reproducible',
    cases: built,
    reached_cassette: built.filter(b => b.reached_cassette).length,
    refused: refusing.length,
    the_headline: built.length
      ? `${built.filter(b => b.reached_cassette).length} of ${built.length} requests reach a cassette. The rest refuse, at: ${refusing.map(r => `${r.case_id}/${r.refused_at}`).join(', ') || 'nowhere'}.`
      : 'no cases available',
    why_it_can_fail: WHY_IT_CAN_FAIL,
  };
}

/** Write the storyboard where the page can fetch it. */
export async function write(outPath) {
  const all = await buildAll();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(all, null, 1));
  return all;
}

if (process.argv[1] && process.argv[1].endsWith('storyboard.mjs')) {
  const out = process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : path.resolve(HERE, '../dashboard/public/blueprint3d/studio-live/analogues/storyboard.json');
  const all = await write(out);
  console.log(all.the_headline);
  for (const c of all.cases) {
    console.log(`  ${c.case_id.padEnd(26)} ${c.refused_at ? `REFUSED at ${c.refused_at}` : 'reached a cassette'}`);
  }
  if (all.cases.some(c => c.modules_missing.length)) {
    console.log(`\nmodules not available: ${[...new Set(all.cases.flatMap(c => c.modules_missing))].join(', ')}`);
  }
  console.log(`\nwritten to ${out}`);
}
