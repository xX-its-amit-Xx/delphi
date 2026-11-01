// requirements.mjs - derive the functional requirement set FROM THE ANALOGUE, at the level our annotations
// actually support (loci, residues, rates, pathway memberships, expression contexts), never raw nucleotides.
//
// COVERAGE HONESTY IS THE POINT OF THIS FILE. We have NO flying-fish transcriptome, NO flying-fish proteome, no
// flying-fish mutant and no flying-fish assay; 9 of 3,860 genes carry a Hirundichthys identifier at all
// (omics/transcriptomic/SOURCES.md, omics/proteomic/SOURCES.md, omics/genes.json coverage.flying_fish). A scorer
// that silently assesses only what it can see would report a flattering fraction of a tiny denominator. So
// `assessable of total` is returned as a first-class number with a reason attached to every unassessable row.
//
// THREE DIRECTIONS, detected and reported, because they mean different things:
//   ADDITION    the design is to GAIN a function its base lacks. The analogue already has it. Requirement =
//               what the analogue has that the design lacks.
//   SUBTRACTION the design LOSES a function its base has. The analogue is an organism that already lacks it.
//               The question flips to "what did removing it cost, and is the loss like organisms that live
//               without it". A subtraction is a different animal, not a pile of unmet requirements.
//   NO_ANALOGUE no real organism we may read performs the function. The requirement set is EMPTY and that is
//               the finding, not a pass.
import fs from 'node:fs';
import path from 'node:path';
import { closestFunctionalAnalogue, registry } from './analogue.mjs';
import { genotypeOf, canonicalSymbol, baseGenome } from './designs.mjs';

const HERE = import.meta.dirname;
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
let _req = null, _res = null;
const reqData = () => (_req ??= read(path.join(HERE, 'data', 'analogue-requirements.json')));
const resData = () => (_res ??= fs.existsSync(path.join(HERE, 'data', 'design-residues.json')) ? read(path.join(HERE, 'data', 'design-residues.json')) : { residues: {} });

/** Which of ADDITION / SUBTRACTION / NO_ANALOGUE this is, with the evidence for the detection. */
export function detectDirection(design, analogue, { desiredText = null } = {}) {
  const base = analogue.base;
  const R = registry()[analogue.function.id];
  const baseIsAnalogue = base.id === 'flying-fish' || /Beloniformes/.test(base.taxon || '');
  const baseSatisfies = baseIsAnalogue && (analogue.function.id === 'glides_over_water' || analogue.function.id === 'enlarged_paired_pectoral_fins');
  const lossWords = /\bwithout\b|\bwingless\b|\bordinary\s+fins?\b|\bno\s+longer\b|\bloses?\b|\blosing\b|\bremove[ds]?\b|\bnon-?gliding\b|\bcannot\s+glide\b|\bgrounded\b/i;
  const lossText = typeof desiredText === 'string' ? lossWords.exec(desiredText) : null;
  const lossById = base.id === 'wingless-flying-fish' || design === 'wingless-flying-fish';

  if (!R.taxa.some(t => t.satisfies) || R.refuse) {
    return { direction: 'NO_ANALOGUE', detected_by: R.refuse ? 'the function\'s best analogue is refused data (frozen holdout) or extinct' : 'no taxon in the registry satisfies this function\'s operational definition',
      evidence: [
        { claim: `no organism we may read satisfies "${R.label}" for a teleost body plan`, source: 'functional/analogue.mjs registry()', kind: 'curated' },
        ...(R.refuse ? [{ claim: R.refuse, source: 'project holdout policy', kind: 'curated' }] : []),
        { claim: R.data_poor_statement, source: 'functional/analogue.mjs', kind: 'curated' },
      ] };
  }
  if (lossById || (baseSatisfies && lossText)) {
    return { direction: 'SUBTRACTION', detected_by: lossById ? 'the design is a recorded subtraction (its base satisfies the function and its parameters put it at the non-performing value)' : `the base satisfies the function and the desired phenotype names its removal ("${lossText[0]}")`,
      evidence: [
        { claim: `the base (${base.species}) satisfies "${R.label}"`, source: 'functional/analogue.mjs registry() taxa evidence', kind: 'measured' },
        { claim: lossById ? 'the design document puts pectoral_len_over_SL at the halfbeak group median 0.140 on a flying fish\'s body' : `the desired phenotype says the function is removed ("${lossText[0]}")`, source: lossById ? 'sim-engine organism document wingless-flying-fish' : 'the desired-phenotype text', kind: lossById ? 'curated' : 'assumed' },
      ] };
  }
  return { direction: 'ADDITION', detected_by: baseSatisfies ? 'the base already satisfies the function and nothing in the request removes it, so the design is read as keeping or extending it' : 'the base does not satisfy the function and the design is to gain it',
    evidence: [
      baseSatisfies
        ? { claim: `the base (${base.species}) already satisfies "${R.label}"`, source: 'functional/analogue.mjs registry()', kind: 'measured' }
        : { claim: `no glide, leap or aerial behaviour is reported for ${base.species} in any source this project fetched, and its pectoral fin length / SL is NOT MEASURED IN ANY FETCHED SOURCE (genotype/compare-2x2.json panel A). So "the base lacks the function" rests on the absence of any report, which is weaker than a measurement and is labelled as such`, source: 'genotype/compare-2x2.json; sim-engine organism document zebrafish-adult (pectoral_len_over_SL kind "assumed")', kind: 'assumed' },
    ] };
}

/** ADDITION: the analogue's loci, each as a requirement on the design, with assessability decided by a stated rule. */
function additionRequirements(base) {
  const D = reqData();
  const res = resData().residues || {};
  const out = [];
  for (const r of D.requirements) {
    const st = r.analogue_state;
    const confirmed = !!(st.read && st.n_carrying_derived > 0);
    const orth = !r.zebrafish.none;
    const inUniverse = !!r.zebrafish.symbol;
    // The design's state at an UNEDITED locus is its base genome's state, so which genome that is decides what
    // can be read at all.
    const analogueBase = base.kind === 'analogue';
    const rr = analogueBase
      ? (confirmed ? { read: true, danio_residue: r.locus.alt, danio_position: r.locus.pos, percent_identity: 100,
          local_window: { identity: 1, usable: true }, carries_derived_state: true,
          method: "IDENTITY: the design's base genome IS the analogue's, so its state at an unedited locus is the analogue's own measured state (the per-species residues read from the Daane exon capture)" } : null)
      : base.kind === 'danio_reference' ? (res[r.id] || null) : null;
    const designRead = !!(rr?.read && rr.local_window?.usable);
    let assessable = true, why = null, depth = 'full';
    if (base.kind === 'undefined') { assessable = false; why = `UNASSESSABLE on the design side: ${base.why}`; }
    else if (!st.read) { assessable = false; why = `UNASSESSABLE on the analogue side: ${st.why}`; }
    else if (!confirmed) {
      assessable = false;
      why = st.n_with_data === 0
        ? `UNASSESSABLE on the analogue side: the publisher's sheet ticks this substitution for Exocoetidae, but our own re-read of the captured exons has NO residue at this site in any of the ${st.n_species} flying-fish species, so the analogue's state is unconfirmed`
        : `UNASSESSABLE on the analogue side: our own re-read of the captured exons finds the derived residue ${r.locus.alt} in 0 of ${st.n_with_data} flying-fish species with data at this site (${st.n_carrying_ancestral} carry the ancestral ${r.locus.ref}). The requirement is NOT CONFIRMED in the analogue, so requiring it of a design would be requiring something we cannot show the analogue has`;
    } else if (!orth) { assessable = false; why = `UNASSESSABLE on the design side: ${r.zebrafish.why} - without a zebrafish orthologue there is no locus in the design to compare`; }
    else if (!inUniverse) { depth = 'gene-level only'; why = 'the locus has a zebrafish orthologue but it is OUTSIDE our annotated gene universe (omics/genes.json, 3,860 genes), so the difference can be stated but NO resolution search is possible: no paralogue, expression, pathway or domain record can be looked up. An UNRESOLVED verdict here is the absence of a search, not the absence of a resolution'; }
    out.push({
      id: r.id, requirement: r.requirement, value: r.value, unit: r.unit, source: r.source, kind: r.kind,
      level: r.level, locus: r.locus, analogue_state: st, zebrafish: r.zebrafish,
      analogue_confirms_requirement: confirmed,
      assessable, unassessable_reason: assessable ? null : why, search_depth: assessable ? depth : 'none',
      search_depth_note: assessable && depth !== 'full' ? why : null,
      design_residue: rr ? { read: designRead, residue: rr.danio_residue ?? null, position: rr.danio_position ?? null, percent_identity: rr.percent_identity ?? null,
        local_window: rr.local_window ?? null, carries_derived_state: designRead ? rr.carries_derived_state : null,
        why_not_read: designRead ? null : (rr.read ? `LOW CONFIDENCE: ${rr.local_window?.why_not}` : rr.why), method: rr.method ?? null } : { read: false, why_not_read: 'no design-side residue read was attempted for this requirement level' },
      analogue_functional_data: r.zebrafish.flying_fish_id
        ? { has_flying_fish_protein_id: true, detail: r.zebrafish.flying_fish_id, expression: 'NONE - no flying-fish transcriptome exists', assay: 'NONE' }
        : { has_flying_fish_protein_id: false, detail: 'this locus has no Hirundichthys identifier in omics/genes.json, so nothing about the analogue\'s protein, expression or function at this locus is known to us; only its residue, read from the Daane exon capture', expression: 'NONE', assay: 'NONE' },
    });
  }
  return out;
}

/** SUBTRACTION: the analogue is an organism that already LACKS the function. */
function subtractionRequirements() {
  const D = reqData();
  const out = [];
  for (const r of D.requirements) {
    if (r.level !== 'residue') continue;
    const st = r.analogue_state;
    const nonGliderCarries = 0;        // by construction: see unassessable_reason below
    out.push({
      id: `SUB:${r.id}`, requirement: `an organism that lacks gliding carries the ancestral residue ${r.locus.ref} at position ${r.locus.pos} of ${r.locus.source_symbol}; the design, descended from a glider, carries the derived ${r.locus.alt} unless it reverted it`,
      value: r.locus.ref, unit: 'amino acid', source: r.source, kind: r.kind, level: 'residue', locus: r.locus,
      analogue_state: { read: st.read, loss_analogue: 'non-gliding halfbeaks (Hemiramphidae), 12 species in the Daane panel', note: 'their state at these sites is ANCESTRAL BY CONSTRUCTION' },
      zebrafish: r.zebrafish, analogue_confirms_requirement: nonGliderCarries === 0,
      assessable: false, search_depth: 'none',
      unassessable_reason:
        'UNASSESSABLE BY CONSTRUCTION. Daane 2021 sheet G lists only substitutions that are shared by gliders and ABSENT '
        + 'from the outgroups, so every non-gliding species carries the ancestral residue at these sites BY DEFINITION '
        + '(sequences/progression.json read_this_first[1] says exactly this: "THE NON-GLIDERS SCORE ZERO BY CONSTRUCTION ... '
        + 'the zero is circular and is not a finding"). A locus set built that way carries no information about whether a '
        + 'glider genotype is compatible with a non-gliding body, which is the only question a subtraction asks. '
        + 'Our own data says more: the gliding halfbeaks carry about as many derived states as the flying fishes at a fin '
        + 'ratio 2.5x smaller, so derived-state count does not track the function even among gliders.',
      what_would_make_it_assessable:
        'a measured, secondarily NON-gliding exocoetid - a species that descends from gliders and lost the habit - whose '
        + 'state at these sites could be read. No such species is in the Daane panel or in any source we fetched.',
      analogue_functional_data: { has_flying_fish_protein_id: !!r.zebrafish.flying_fish_id, expression: 'NONE', assay: 'NONE' },
    });
  }
  return out;
}

/** THE ENTRY POINT. Returns the requirement set for THIS design and THIS function, with the direction and the
 *  coverage numbers. `target` is the desired phenotype (text or a registry key) when the caller has one. */
export async function requirementSet(design, target, { designFinSL = null } = {}) {
  const desiredText = typeof target === 'string' ? target : (target?.desired_phenotype || target?.text || null);
  const analogue = closestFunctionalAnalogue(design, target, { designFinSL });
  const dir = detectDirection(design, analogue, { desiredText });
  const genotype = await genotypeOf(design);
  const base = baseGenome(design);
  const D = reqData();

  let requirements = [];
  if (dir.direction === 'ADDITION') requirements = additionRequirements(base);
  else if (dir.direction === 'SUBTRACTION') requirements = subtractionRequirements();
  // NO_ANALOGUE: the set stays empty, deliberately.

  const total = requirements.length;
  const assessable = requirements.filter(r => r.assessable);
  const byReason = {};
  for (const r of requirements.filter(x => !x.assessable)) {
    const k = r.unassessable_reason.split(':')[0] + (/analogue side/.test(r.unassessable_reason) ? ': analogue side' : /design side/.test(r.unassessable_reason) ? ': design side' : '');
    byReason[k] = (byReason[k] || 0) + 1;
  }
  return {
    direction: dir.direction, direction_detected_by: dir.detected_by, direction_evidence: dir.evidence,
    analogue, genotype, base_genome: base,
    requirements,
    source_dataset: dir.direction === 'NO_ANALOGUE' ? null : { title: D.title, built: D.built, sources: D.sources, counts: D.counts, what_this_is: D.what_this_is, what_this_is_not: D.what_this_is_not },
    coverage: {
      requirements_total: total,
      requirements_assessable: assessable.length,
      assessable_fraction: total ? +(assessable.length / total).toFixed(4) : null,
      unassessable: total - assessable.length,
      unassessable_by_reason: byReason,
      search_depth_full: assessable.filter(r => r.search_depth === 'full').length,
      search_depth_gene_level_only: assessable.filter(r => r.search_depth === 'gene-level only').length,
      design_side_residue_read: requirements.filter(r => r.design_residue?.read).length,
      analogue_loci_with_any_flying_fish_identifier: requirements.filter(r => r.analogue_functional_data?.has_flying_fish_protein_id).length,
      analogue_loci_with_any_flying_fish_EXPRESSION_or_ASSAY: 0,
      note: dir.direction === 'NO_ANALOGUE'
        ? 'the requirement set is EMPTY because no analogue may be read for this function. An empty ledger is not a pass.'
        : `we can assess ${assessable.length} of ${total} requirements; the rest are unassessable, each with its own stated reason. `
          + 'ZERO of the loci have flying-fish expression or functional-assay data of any kind, because no flying-fish '
          + 'transcriptome, proteome, mutant or assay exists in any archive we searched. Every "requirement" is therefore '
          + 'a SEQUENCE STATE in the analogue, never a measured function of the analogue.',
    },
    scope:
      'The requirement set is the set of loci Daane 2021 reports as KNOWN to differ in flying fishes (74 coding loci '
      + 'against 23,611 predicted genes = 0.31 % of the gene set), plus nothing for the regulatory changes, which cannot '
      + 'be enumerated because the accelerated-CNE sheets give GO terms and no gene names. It is not a causal set and '
      + 'not a complete one.',
  };
}
