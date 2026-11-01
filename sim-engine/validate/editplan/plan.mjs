// Assembles one editing plan per gene edit, and the panel section that carries it into a design's
// validation report. See editplan.mjs for the pipeline and for what every number is and is not.
import { envelope, p } from '../../lib/envelope.mjs';
import * as E from './editplan.mjs';
import * as EVO2 from './evo2.mjs';

export const SCOPE =
  'A PROPOSAL for a wet lab to check, not a protocol and not a validated plan. No guide here has been tested, ' +
  'no embryo injected, no fish genotyped. There are two on-target scores and the difference matters: ' +
  '`on_target_doench2014` is a PUBLISHED model (Doench 2014 Rule Set 1, coefficients fetched and self-tested) ' +
  'fitted in mouse and human cells, so applying it to a zebrafish injection is a cross-species transfer; ' +
  '`on_target` is OUR HEURISTIC with weights we chose. Neither is Doench 2016 Rule Set 2, which cannot be ' +
  'reimplemented from published numbers, and neither is a measured efficiency. Off-target counts now come from ' +
  'an EXHAUSTIVE local scan of the GRCz11 primary assembly - complete for substitutions, but still blind to ' +
  'bulges, to alternative loci and to the laboratory strain\'s own genome, and a sequence match is not a cut. ' +
  'Evo2 likelihoods, where present, RANK options; they never gate a plan and are not phenotype predictions. ' +
  'HDR rates are quoted from the literature, not from our hands. Nothing here establishes that ' +
  'the edit produces the predicted phenotype - our own design validation (design-validation/REPORT.md) did not ' +
  'establish that and mostly could not score it. Danio rerio only: no human or other mammalian plan is produced. ' +
  'Any animal work needs institutional animal-care approval first. No Aves data is read anywhere in this module.';

/** How many guides to report per nuclease. */
const TOP = Number(process.env.EDITPLAN_TOP ?? 4);
/** Cut-site distances are ranked in buckets of this many bp; see the ranking rule below. */
export const RANK_BUCKET_BP = Number(process.env.EDITPLAN_RANK_BUCKET_BP ?? 10);
export const RANKING_RULE = `point change: cut-site distance bucketed to ${RANK_BUCKET_BP} bp, then the on-target heuristic, then exact distance. knockout: the on-target heuristic alone. The bucket exists because 1 bp versus 2 bp of cut-site proximity is not a real difference while a poly-T guide is dead.`;

/**
 * One editing plan for one gene edit.
 * @param gene   zebrafish gene symbol (resolved through Ensembl; an unresolvable symbol is a refusal)
 * @param spec   'p.W169L', 'p.Y285*' or 'knockout'
 */
export async function editPlan(gene, spec, { network = true, species = 'danio_rerio', window = 30, offtarget = true, offtargetGuides = Number(process.env.EDITPLAN_OFFTARGET_GUIDES ?? 3), offtargetMethod = 'auto', arms = 'symmetric', flank = 220, evo2 = true } = {}) {
  const res = await E.resolveGenomic(gene, spec, { network, species, flank });
  if (!res.resolved) return { gene, edit: spec, refused: true, refusal: res.refusal, plan: null };

  const t = res.target;
  const targetPositions = t.kind === 'knockout' ? [t.genomic_window[0], t.genomic_window[1]] : t.genomic_positions;
  const strategy = t.kind === 'knockout' ? 'frameshift knockout by NHEJ in an early exon' : 'precise point change by HDR with an ssODN donor (plus a base-editor route where the change is a transition)';

  // --- guides, per nuclease
  const byNuclease = {};
  const allEnumerated = [];   // every protospacer found, not just the reported top few: the base-editor and
                              // prime-editing scans need the whole set, since the right guide for a base
                              // editor is the one that puts the target base in the window, not the top-ranked one.
  for (const nuc of ['SpCas9', 'SaCas9', 'AsCas12a']) {
    const maxCutDistance = t.kind === 'knockout' ? Infinity : window;
    let gs = E.enumerateGuides(res.window, nuc, { targetPositions, maxCutDistance });
    if (t.kind === 'knockout') {
      // A cut in an INTRON does not shift the frame. Keep only cuts inside a coding interval of the early CDS,
      // and say which codon the frameshift would start at and how much protein it removes.
      gs = gs.filter(g => (t.coding_intervals_in_window || []).some(iv => g.cut_site_chrom >= iv.start && g.cut_site_chrom <= iv.end))
        .map(g => {
          const cdsIdx = E.cdsIndexOfGenomic(res, g.cut_site_chrom);
          return { ...g, cut_cds_position: cdsIdx, frameshift_from_codon: cdsIdx == null ? null : Math.ceil(cdsIdx / 3),
            protein_fraction_lost_if_frameshift_here: cdsIdx == null ? null : +(1 - Math.ceil(cdsIdx / 3) / res.protein_length).toFixed(3),
            distance_cut_to_edit_bp: null, cut_is_in_a_coding_exon: true };
        });
    }
    // TWO on-target numbers, and the difference between them is the point. `on_target` is OUR heuristic
    // (weights we chose, not fitted). `on_target_doench2014` is a PUBLISHED model whose coefficients were
    // fetched from Doench 2014's Supplementary Table 9 in this run and self-tested against its reference
    // vectors. The published model applies only to SpCas9 / 20-nt / NGG, so for SaCas9 and Cas12a it
    // returns {ran:false} with the reason rather than a number computed on a geometry it never saw.
    gs = gs.map(g => ({ ...g, on_target: E.onTargetHeuristic(g.spacer), on_target_doench2014: E.DOENCH.ruleSet1(g.context_30mer) }));
    // Ranking rule, stated so it can be argued with:
    //  * knockout: the on-target heuristic alone (any cut inside the early-CDS window frameshifts).
    //  * point change: cut-site distance BUCKETED to 10 bp, then the heuristic. Bucketing because
    //    Prykhozhij 2018 shows proximity matters, but 1 bp versus 2 bp is not a real difference, while
    //    a guide with a poly-T run is simply dead. Without the bucket a 1-bp-closer dead guide wins.
    const bucket = g => Math.floor((g.distance_cut_to_edit_bp ?? 0) / RANK_BUCKET_BP);
    gs.sort((a, b) => (t.kind === 'knockout'
      ? (b.on_target.score - a.on_target.score) || ((b.protein_fraction_lost_if_frameshift_here ?? 0) - (a.protein_fraction_lost_if_frameshift_here ?? 0))
      : (bucket(a) - bucket(b)) || (b.on_target.score - a.on_target.score) || (a.distance_cut_to_edit_bp - b.distance_cut_to_edit_bp)));
    allEnumerated.push(...gs);
    byNuclease[nuc] = { n_found: gs.length, search_window_bp: t.kind === 'knockout' ? `the early-CDS window ${t.genomic_window[0]}-${t.genomic_window[1]}` : `cut site within ${window} bp of the edited codon`, guides: gs.slice(0, TOP) };
  }
  const spGuides = byNuclease.SpCas9.guides;
  const allGuides = [...spGuides, ...byNuclease.SaCas9.guides, ...byNuclease.AsCas12a.guides];
  const best = spGuides[0] || byNuclease.SaCas9.guides[0] || byNuclease.AsCas12a.guides[0] || null;
  const better_placed = (() => {
    if (t.kind === 'knockout') return { not_applicable: 'a knockout has no single edited base, so "which nuclease cuts closest to the edit" is not a question. Compare the knockout guides on how early they frameshift (frameshift_from_codon / protein_fraction_lost_if_frameshift_here) instead.' };
    if (!best) return null;
    const alt = [...byNuclease.SaCas9.guides, ...byNuclease.AsCas12a.guides]
      .filter(g => g.distance_cut_to_edit_bp != null && best.distance_cut_to_edit_bp != null && g.distance_cut_to_edit_bp < best.distance_cut_to_edit_bp);
    return alt.length ? { nuclease: alt[0].nuclease, distance_cut_to_edit_bp: alt[0].distance_cut_to_edit_bp, why: `its cut site is ${best.distance_cut_to_edit_bp - alt[0].distance_cut_to_edit_bp} bp closer to the edited base than the best SpCas9 guide, which matters because HDR falls off with distance from the break`, guide: alt[0] } : null;
  })();

  // --- off-target search against GRCz11, for the guide(s) we would actually order
  const offt = [];
  if (offtarget) {
    // The local exhaustive search costs ~22 s per guide, so the guides a lab would actually weigh against each
    // other are all searched, not just the top one (the NCBI path could afford only one, when it returned at all).
    const seen = new Set();
    const candidates = (t.kind === 'knockout' ? spGuides : [best, better_placed?.guide, ...spGuides].filter(Boolean))
      .filter(g => !seen.has(g.spacer) && seen.add(g.spacer));
    for (const g of candidates.slice(0, offtargetGuides)) {
      const nucDef = Object.values(E.NUCLEASES).find(n => n.name === g.nuclease);
      const pamSide = nucDef?.pam_side === '5prime' ? '5prime' : '3prime';
      const r = await E.offTargets(g.spacer, g.pam_motif, { network, pamSide, method: offtargetMethod });
      const spec = r.ran ? E.mitSpecificity(r.sites.filter(s => s.n_mismatches > 0)) : null;
      offt.push({ spacer: g.spacer, nuclease: g.nuclease, search: r, mit_specificity: spec,
        perfect_matches: r.ran ? r.sites.filter(s => s.n_mismatches === 0).length : null,
        on_target_found: r.ran ? r.sites.some(s => s.n_mismatches === 0 && s.chromosome === res.chromosome && s.hit_from <= g.protospacer_chrom[1] && s.hit_to >= g.protospacer_chrom[0]) : null,
        exonic_off_targets: r.ran ? r.sites.filter(s => s.n_mismatches > 0 && Array.isArray(s.gene_context) && s.gene_context.some(x => x.biotype === 'protein_coding')).map(s => ({ chromosome: s.chromosome, pos: [s.hit_from, s.hit_to], n_mismatches: s.n_mismatches, genes: s.gene_context.filter(x => x.biotype === 'protein_coding').map(x => x.symbol || x.id) })) : null });
    }
  }

  // --- donor (point changes only)
  const donors = [];
  if (t.kind !== 'knockout' && best) {
    for (const style of ['symmetric', 'asymmetric']) {
      const d = E.donorFor(res, best, { arms: style });
      donors.push({ style, guide: best.spacer, ...d });
    }
  }

  // --- base editor route, and prime editing where the change is a transversion
  const be = E.baseEditorOption(res, allEnumerated);
  const pe = E.primeEditOption(res, allEnumerated);

  const plan = {
    organism: { species: 'Danio rerio (zebrafish)', assembly: E.ASSEMBLY, strain_note: 'coordinates are the GRCz11 reference. Laboratory strains (AB, TU, WIK) differ from the reference at high SNP density; the protospacer and PAM must be sequenced in the actual breeding fish before ordering (falsifier "polymorphism").', germline: 'one-cell-stage embryo injection, then F0 outcross -> F1 genotyping -> F2 if a homozygote is needed' },
    strategy,
    locus: {
      gene: res.gene, gene_id: res.gene_id, transcript_id: res.transcript_id, protein_id: res.protein_id, protein_length_aa: res.protein_length,
      chromosome: res.chromosome, strand: res.strand, cds_length_nt: res.cds_length, n_exons: res.n_exons,
    },
    exact_genomic_change: t.kind === 'knockout'
      ? { kind: 'knockout: no single base change', target_window: t, note: t.rule }
      : { protein_change: `p.${t.reference_residue}${t.protein_position}${t.desired_residue}`,
          codon_number: t.protein_position, cds_positions: `c.${t.cds_positions[0]}-${t.cds_positions[2]}`,
          reference_codon: t.reference_codon, reference_amino_acid: t.reference_codon_amino_acid,
          genomic_positions: t.genomic_positions.map((p, i) => `${E.ASSEMBLY} ${res.chromosome}:${p} (codon base ${i + 1})`),
          genomic_codon_forward_strand: t.genomic_codon_forward_strand,
          genomic_codon_in_coding_orientation: t.genomic_codon_in_cds_orientation,
          strand: res.strand === 1 ? 'the gene is on the forward strand, so the coding codon reads directly off the forward strand' : 'the gene is on the REVERSE strand, so the forward-strand bases are the complement of the codon and are listed 3\'->5\' with respect to the coding sequence',
          genome_vs_cds_check: t.genome_codon_check,
          desired_codons: t.desired_codon_options,
          chosen: t.chosen_codon ? { codon: t.chosen_codon.codon, n_nucleotide_changes: t.chosen_codon.n_nt_changes,
            changes: t.chosen_codon.nt_changes.map(c => `${E.ASSEMBLY} ${res.chromosome}:${c.genomic_pos} ${c.genomic_ref}>${c.genomic_alt} (forward strand) = c.${c.cds_pos}${c.cds_ref}>${c.cds_alt}; ${c.transition ? 'transition' : 'TRANSVERSION'}`),
            codon_usage_fraction_of_synonymous_family: t.chosen_codon.codon_usage_fraction_of_family,
            codon_usage_per_thousand: t.chosen_codon.codon_usage_per_thousand,
            codon_usage_rule: 'among the codons for the desired residue, the one needing the fewest nucleotide changes; ties broken by the commoner codon in the zebrafish codon-usage table' } : null,
          codon_usage_source: t.codon_usage_source,
        },
    guides: byNuclease,
    recommended_guide: best,
    better_placed_alternative: better_placed,
    off_target: offt.length ? offt : { ran: false, reason: offtarget ? 'no guide to search' : 'offtarget:false' },
    hdr_donor: donors.length ? donors : { ran: false, reason: t.kind === 'knockout' ? 'a knockout needs no donor' : 'no guide to anchor a donor on' },
    base_editor_route: be,
    prime_editor_route: pe,
    reagents: E.ZEBRAFISH_REAGENTS,
    full_sequences_to_order: best ? orderSheet(res, best, donors, be, pe) : null,
    ranking_rule: RANKING_RULE,
    screening: screening(res, t),
    feasibility_and_what_is_not_established: E.FEASIBILITY,
    what_would_falsify_this_plan: E.FALSIFIERS,
  };
  // Evo2 RANKS; it never gates. Both of these are complete and meaningful with no key and no model: the
  // ranking section's own orders are computed from the plan, and the evo2 block degrades to {ran:false}
  // per field. Nothing above this line depends on either.
  plan.evo2 = evo2 ? await evo2Block(res, t, plan) : { ran: false, reason: 'evo2:false was passed; the Evo2 block was not built', note: EVO2.DEGRADATION };
  plan.ranking = ranking(res, t, plan, byNuclease);
  return { gene: res.gene, edit: typeof spec === 'string' ? spec : res.target.kind, refused: false, plan, resolved: res };
}

/**
 * The Evo2 block. Three legitimate uses, each labelled, each {ran:false} without a key.
 * See evo2.mjs for what a likelihood is and - at greater length - what it is not.
 */
async function evo2Block(res, t, plan) {
  const win = res.window;
  const key = EVO2.keyShape();
  const status = await EVO2.status().catch(e => ({ ran: false, reason: `the NIM health probe threw: ${e.message}` }));

  // Reference and edited windows, centred on the edit, clipped to the window we actually fetched. The
  // length is reported because it is NOT the configured context length when the fetched window is smaller.
  const centre = t.kind === 'knockout' ? Math.floor((t.genomic_window[0] + t.genomic_window[1]) / 2) : t.genomic_positions[0];
  const off = gp => gp - win.start;
  const half = Math.min(Math.floor(EVO2.CONTEXT_BP / 2), Math.min(off(centre), win.seq.length - 1 - off(centre)));
  const lo = off(centre) - half, hi = off(centre) + half;
  const refWindow = win.seq.slice(lo, hi + 1);
  const applyTo = changes => { const a = win.seq.split(''); for (const c of changes) a[off(c.genomic_pos)] = c.genomic_alt; return a.join('').slice(lo, hi + 1); };

  const block = {
    model: EVO2.MODEL, provider: 'NVIDIA NIM / BioNeMo', endpoint: EVO2.METHODS.endpoint,
    what_a_likelihood_is: EVO2.WHAT_IT_IS,
    what_a_likelihood_is_NOT: EVO2.WHAT_IT_IS_NOT,
    how_it_degrades: EVO2.DEGRADATION,
    credentials: EVO2.KEY_NOTE,
    key_present: key.present, key_shape: key.present ? key.prefix : null, key_usable_for_nim: key.usable_for_nim ?? false,
    provider_status: status,
    context: { reference_window_bp: refWindow.length, configured_context_bp: EVO2.CONTEXT_BP,
      note: refWindow.length < EVO2.CONTEXT_BP ? `the fetched genomic window is ${win.seq.length} nt, so the Evo2 context is ${refWindow.length} nt, not the configured ${EVO2.CONTEXT_BP}. Refetch with a larger flank for a longer context.` : null,
      centred_on: `${E.ASSEMBLY} ${res.chromosome}:${centre}` },
    ranks_never_gates: 'It RANKS; it never gates. Nothing in this block changes the plan: the coordinates, guides, donors, pegRNA, base-editor route and off-target table above were all computed with no model involved, and are unchanged whether or not this block ran.',
  };

  if (t.kind === 'knockout' || !t.chosen_codon) {
    block.not_applicable = t.kind === 'knockout'
      ? 'A knockout has no single intended base change, so "score the edited locus against the reference" has no edited locus to score. The frameshift allele a lab actually gets is whatever NHEJ produces, which is not designed and so cannot be scored in advance. Scoring the iSTOP route is possible in principle and was not built here.'
      : 'no chosen codon, so there is no edited locus to score';
    return block;
  }

  // (i) edited vs reference
  block.edited_vs_reference = await EVO2.editedVsReference({
    referenceWindow: refWindow, editedWindow: applyTo(t.chosen_codon.nt_changes),
    label: `p.${t.reference_residue}${t.protein_position}${t.desired_residue} via codon ${t.chosen_codon.codon}`,
  });

  // (ii) rank the synonymous codon options for the desired residue by likelihood, against OUR hand rule
  const codonOptions = (t.desired_codon_options || []).map((o, i) => ({
    id: o.codon, label: `codon ${o.codon} for ${t.desired_residue} (${o.n_nt_changes} nt change${o.n_nt_changes === 1 ? '' : 's'}, zebrafish usage ${o.codon_usage_fraction_of_family ?? '?'} of its synonymous family)`,
    editedWindow: applyTo(o.nt_changes), our_rule_rank: i + 1,
  }));
  block.codon_choice_ranking = await EVO2.rankSynonymousOptions(codonOptions, { what: `the ${codonOptions.length} codon options for ${t.desired_residue}` });
  block.codon_choice_ranking.why_this_is_a_legitimate_use =
    'Our rule picks the codon by "fewest nucleotide changes, ties to the commoner zebrafish codon". That is a defensible rule but it is ours, and it ignores sequence context entirely. A likelihood over the surrounding locus is at least context-aware. Both orders are reported; neither is evidence.';

  // (iii) silent blocking-mutation sets, and the insert a donor/pegRNA would install
  const donors = Array.isArray(plan.hdr_donor) ? plan.hdr_donor.filter(d => d.ran) : [];
  const blockOptions = [];
  for (const d of donors) {
    const applied = (d.blocking_mutations || []).filter(b => b.protein_unchanged);
    blockOptions.push({ id: `${d.style}-donor`, label: `${d.style} ssODN, ${applied.length} silent blocking mutation(s): ${applied.map(b => `${b.codon_before}->${b.codon_after} at codon ${b.codon} (${b.where})`).join('; ') || 'none'}`,
      editedWindow: applyTo([...t.chosen_codon.nt_changes, ...applied.map(b => ({ genomic_pos: b.genomic_pos, genomic_alt: b.genomic_alt }))]), our_rule_rank: blockOptions.length + 1 });
  }
  block.blocking_mutation_ranking = blockOptions.length
    ? await EVO2.rankSynonymousOptions(blockOptions, { what: 'the silent blocking-mutation sets our donor designs chose' })
    : { ran: false, reason: 'no donor with blocking mutations to rank', use: 'rank silent blocking-mutation sets by likelihood' };
  if (blockOptions.length) block.blocking_mutation_ranking.why_this_is_a_legitimate_use =
    'A blocking mutation is chosen here by "silent, single-base, in the PAM or the PAM-proximal seed, and the protein re-translated to confirm". That guarantees it is silent at the PROTEIN level and says nothing about whether it is silent at the sequence level - it can swap a common codon for a rare one, or break a splice or regulatory motif the model has learned. This is the use where a likelihood adds the most.';

  const pe = plan.prime_editor_route;
  block.insert_outlier = pe?.applicable && pe.designs?.[0]
    ? await EVO2.insertOutlier({ referenceWindow: refWindow, insertedWindow: applyTo(t.chosen_codon.nt_changes),
        insert: pe.designs[0].rtt_dna_5to3 || pe.designs[0].pegRNA_3prime_extension_dna_5to3 || null,
        label: `the sequence the pegRNA RTT would install at ${E.ASSEMBLY} ${res.chromosome}:${centre}` })
    : { ran: false, reason: `no pegRNA to check (${pe?.reason || 'prime editing not applicable here'})`, use: 'is the installed sequence an outlier in its genomic context' };
  return block;
}

/**
 * The RANKING section: every order this plan computes, each with the rule that produced it and what that
 * rule cannot see. Separate orders, never one blended score - blending a published model, a heuristic we
 * invented and a language-model likelihood into a single number would hide exactly the distinctions that
 * matter. A lab reading this should be able to disagree with any one order without discarding the others.
 */
function ranking(res, t, plan, byNuclease) {
  const sp = byNuclease.SpCas9.guides;
  const row = g => ({ spacer: g.spacer, pam: g.pam, strand: g.strand, cut_site: `${res.chromosome}:${g.cut_site_chrom}`,
    distance_cut_to_edit_bp: g.distance_cut_to_edit_bp,
    doench2014_published: g.on_target_doench2014?.ran ? g.on_target_doench2014.score : null,
    our_heuristic: g.on_target.score,
    heuristic_flags: g.on_target.flags });
  const offt = Array.isArray(plan.off_target) ? plan.off_target : [];
  return {
    principle: 'Several independent orders, never one blended score. Each order names its rule and what that rule cannot see. They disagree, and the disagreements are the useful output.',
    orders: [
      { id: 'plan_order', rule: RANKING_RULE, cites: E.CUT_DISTANCE_EVIDENCE.one_line,
        what_it_cannot_see: 'specificity (it does not look at off-targets at all) and anything about the genome around the guide',
        guides: sp.map(row) },
      { id: 'doench2014_published_model', rule: 'Doench 2014 Rule Set 1 score, descending. SpCas9 / 20-nt / NGG only.',
        kind: 'published model, coefficients fetched in this run and self-tested', citation: E.DOENCH.CITATION,
        what_it_cannot_see: E.DOENCH.RULE_SET_1_NOT,
        self_test: E.DOENCH.selfTest(),
        guides: sp.filter(g => g.on_target_doench2014?.ran).map(row).sort((a, b) => b.doench2014_published - a.doench2014_published),
        guides_not_scorable: sp.filter(g => !g.on_target_doench2014?.ran).map(g => ({ spacer: g.spacer, reason: g.on_target_doench2014?.reason })) },
      { id: 'our_heuristic', rule: E.ON_TARGET_RULE.formula, kind: 'HEURISTIC - weights chosen by us, not fitted',
        THIS_IS_OURS: E.ON_TARGET_RULE.THIS_IS_OURS,
        what_it_cannot_see: E.ON_TARGET_RULE.what_it_is_not,
        guides: sp.map(row).sort((a, b) => b.our_heuristic - a.our_heuristic) },
      { id: 'measured_specificity_against_grcz11', rule: 'fewest close off-target sites in the GRCz11 primary assembly, then highest MIT (Hsu 2013) aggregate specificity. This is the only order here backed by an exhaustive search of a real genome rather than by a model.',
        kind: 'derived from an exhaustive local search', citation: E.MIT_CITATION,
        what_it_cannot_see: 'bulged off-targets, the laboratory strain\'s actual genome, chromatin and delivery, and whether any listed site is ever cut. It is a list of places to look, not a measurement.',
        guides: offt.filter(o => o.search?.ran).map(o => ({ spacer: o.spacer, nuclease: o.nuclease, method: o.search.method,
          sites_by_mismatch_count: o.search.sites_by_mismatch_count,
          n_sites_at_or_under_4_mismatches: o.search.n_sites_within_mismatch_limit,
          perfect_matches: o.perfect_matches, on_target_found: o.on_target_found,
          mit_specificity: o.mit_specificity?.specificity ?? null,
          n_exonic_off_targets: Array.isArray(o.exonic_off_targets) ? o.exonic_off_targets.length : null,
          exonic_off_targets: o.exonic_off_targets }))
          .sort((a, b) => (b.mit_specificity ?? 0) - (a.mit_specificity ?? 0)),
        guides_not_searched: offt.filter(o => !o.search?.ran).map(o => ({ spacer: o.spacer, reason: o.search?.reason })) },
      { id: 'evo2_likelihood', rule: 'Evo2 mean per-base log-likelihood of the edited locus, descending. RANKS, never gates.',
        kind: 'language-model likelihood', what_it_cannot_see: EVO2.WHAT_IT_IS_NOT,
        ran: plan.evo2?.edited_vs_reference?.ran ?? false,
        codon_choice: plan.evo2?.codon_choice_ranking ?? null,
        blocking_mutations: plan.evo2?.blocking_mutation_ranking ?? null,
        edited_vs_reference: plan.evo2?.edited_vs_reference ?? null },
    ],
    how_to_use_these_together:
      'Take a guide that is high in BOTH the published on-target order and the specificity order, and verify its ' +
      'protospacer and PAM by Sanger sequencing in the actual breeding fish before ordering anything. Where the orders ' +
      'disagree, prefer specificity: a guide that cuts slightly worse at the right place is recoverable, and a guide ' +
      'that cuts well in a second gene is not. Use the Evo2 order only to decide between options the other orders ' +
      'already rank equally.',
    what_no_order_here_establishes:
      'That the edit produces the phenotype. Our own design validation did not establish it: design-validation/REPORT.md ' +
      'scored 1 of 10 phenotypic parameters, that one FAILED, and the joint verdict was (NOT CLOSE / largely UNSHOWN, ' +
      'Lean gate FAILS). No on-target score, no off-target count and no model likelihood bears on that question, and ' +
      'none of them is presented here as if it did.',
  };
}

function orderSheet(res, g, donors, be, pe) {
  const sc = E.ZEBRAFISH_REAGENTS.scaffold;
  const needsG = g.spacer[0] !== 'G';
  return {
    protospacer_plus_pam_5to3: g.protospacer_plus_pam,
    sgRNA_spacer_dna_5to3: g.spacer,
    sgRNA_spacer_rna_5to3: g.spacer.replace(/T/g, 'U'),
    sgRNA_full_rna_if_T7_transcribed: `${needsG ? 'G' : ''}${g.spacer.replace(/T/g, 'U')}${sc.sequence.replace(/T/g, 'U')}`,
    sgRNA_scaffold_dna: sc.sequence, sgRNA_scaffold_citation: sc.citation,
    five_prime_G: needsG ? 'the spacer does not start with G, so a 5\'-G is prepended for T7 transcription. That G is a mismatch at protospacer position 1, which is tolerated but is a real difference from the genomic protospacer. A synthetic (chemically modified) sgRNA avoids this.' : 'the spacer already starts with G, so no extra base is needed for T7',
    ssODN_symmetric_5to3: donors.find(d => d.style === 'symmetric' && d.ran)?.sequence_to_order_5to3 || null,
    ssODN_asymmetric_5to3: donors.find(d => d.style === 'asymmetric' && d.ran)?.sequence_to_order_5to3 || null,
    base_editor_guide_5to3: be?.guides?.[0]?.spacer || null,
    prime_editing_pegRNA_rna_5to3: pe?.designs?.[0]?.pegRNA_full_rna_5to3 || null,
    prime_editing_pegRNA_3prime_extension_dna: pe?.designs?.[0]?.pegRNA_3prime_extension_dna_5to3 || null,
    prime_editing_pe3_nicking_spacer: pe?.designs?.[0]?.pe3_nicking_guide?.spacer || null,
    genotyping_primers: 'NOT designed by this module. Design them outside the ssODN footprint (so the donor cannot template the PCR) and amplicon-sequence; do not rely on a restriction digest.',
  };
}
function screening(res, t) {
  return {
    f0: { do: 'inject at the one-cell stage; at 1-2 dpf pool ~20 embryos and amplicon-sequence the target to confirm the guide cuts at all', why: 'an F0 is a mosaic: its phenotype is not the phenotype of the designed genotype' },
    f1: { do: 'raise the remaining F0 to adulthood, outcross each to wild type, and amplicon-sequence the full locus in 24+ F1 per founder', why: 'F1 carry single clean alleles. Boel 2018 says expect ssODN fragments integrated at the locus, so sequence the whole amplicon, not just the edited base' },
    f2: t.kind === 'knockout' || t.kind === 'nonsense' ? { do: 'intercross F1 carriers for homozygotes; score Mendelian ratios', why: 'a loss-of-function phenotype usually needs the homozygote' } : { do: 'intercross F1 carriers if the design calls for a homozygote; the published winged-zebrafish genotype is a double HETEROZYGOTE, so check which the design actually asks for', why: 'zygosity is part of the design, not a detail' },
    time: 'two generations. Danio rerio reaches sexual maturity at roughly 3 months under standard husbandry, so F2 homozygotes are ~6-8 months from the first injection at best.',
    approval_first: E.FEASIBILITY.approval.statement,
  };
}

/** Provenance entries for the envelope: every number labelled by kind. */
export function provenanceFor(plans) {
  const prov = [
    p('GRCz11 coordinates', 'Ensembl REST', 'measured', 'Ensembl REST /lookup/symbol, /sequence/id?type=cds, /map/cds, /sequence/region against the GRCz11 primary assembly; the reference codon was checked against the genome, not assumed'),
    p('zebrafish codon usage', plans.find(x => x.plan?.exact_genomic_change?.codon_usage_source?.n_codons)?.plan.exact_genomic_change.codon_usage_source.n_codons ?? null, 'measured', 'Kazusa Codon Usage Database, Danio rerio [gbvrt], fetched and parsed in this run'),
    p('on-target score (published model)', 'Doench 2014 Rule Set 1', 'measured-secondhand', `${E.DOENCH.CITATION}. Coefficients FETCHED from the paper's Supplementary Table 9 in this run and self-tested against its reference vectors (${E.DOENCH.selfTest().ok ? 'self-test PASSES' : 'SELF-TEST FAILS - do not use these numbers'}). Fitted in mouse and human cell lines, so using it on a zebrafish injection is a transfer across species, delivery and readout. ${E.DOENCH.RULE_SET_1_NOT}`),
    p('on-target score (Rule Set 2)', null, 'assumed', `NOT IMPLEMENTED, and now established rather than assumed: ${E.DOENCH.RULE_SET_2.what_was_checked}`),
    p('on-target score (our heuristic)', E.ON_TARGET_RULE.id, 'assumed', `a transparent HEURISTIC we combined from published observations (${E.ON_TARGET_RULE.terms.map(t => t.term).join(', ')}); the weights are OURS and were not fitted. Retained because it is the only on-target number that covers SaCas9 and Cas12a. ${E.ON_TARGET_RULE.what_it_is_not}`),
    p('off-target position weights', 'Hsu 2013 MIT weights', 'measured-secondhand', E.MIT_CITATION),
    p('MIT specificity', null, 'derived', 'computed from the Hsu 2013 weights over the GRCz11 sites found by the local exhaustive search. A PREDICTION. It is no longer a floor from a heuristic aligner: the site list it aggregates is complete for substitutions. It is still a floor with respect to BULGED off-targets, which are not modelled.'),
    p('off-target site list', `${E.ASSEMBLY} primary assembly, local exhaustive scan`, 'derived', 'every position of both strands of the GRCz11 primary assembly (993 sequences, 1,373,471,384 bp) tested; PAM-anchored, no seeding step, so no site at or under the mismatch limit can be missed. The PAM is CHECKED at every reported site. Gene context from Ensembl /overlap/region. Replaces the NCBI blastn-short path, which never returned: ' + E.NCBI_QUEUE_EXPERIENCE),
    p('ssODN symmetric arm length', '60/60 nt (120 nt total)', 'measured-secondhand', 'Boel et al. 2018, doi 10.1242/dmm.035352: "120 nt being identified as the most optimal length to promote HDR", measured at four zebrafish sgRNA sites. CORRECTED in this run from 40/40, which was a convention and sat in the length range Boel measured to be up to tenfold worse. The 60+60 per-arm split is OUR reading of "symmetrical".'),
    p('ssODN asymmetric arm length', '36/91 nt', 'borrowed', 'Richardson et al. 2016, doi 10.1038/nbt.3481, measured in HUMAN cells. The asymmetric STRATEGY is a zebrafish result (Prykhozhij 2018) but a confounded one, and Boel 2018 found asymmetry gave no benefit: the two zebrafish papers disagree and this plan does not pick a winner. See ARM_LENGTH_EVIDENCE.'),
    p('cut-site proximity thresholds', '<10 nt ideal; 20-30 % of maximum at 20 nt', 'measured-secondhand', 'Paquet et al. 2016, Nature 533, doi 10.1038/nature17664, in MURINE cells, quoted in Prykhozhij 2018\'s introduction. CORRECTED in this run: these numbers were previously attributed by implication to Prykhozhij as zebrafish data. Prykhozhij supports cut-site proximity only QUALITATIVELY in zebrafish. See CUT_DISTANCE_EVIDENCE.'),
    p('Evo2 likelihood', EVO2.MODEL, 'assumed', `a genomic language-model likelihood, used only to RANK options the plan already produced. ${EVO2.WHAT_IT_IS_NOT} ${EVO2.DEGRADATION}`),
    p('error-free HDR rate in zebrafish', '1-4 % of alleles', 'measured', 'Boel et al. 2018, Dis Model Mech 11:dmm035352, doi 10.1242/dmm.035352 - measured by NGS at THEIR loci, not ours. Borrowed to bound the order of magnitude.'),
    p('prime-editing rate in zebrafish', 'up to 30 % somatic, germline transmission shown', 'measured', 'Petri et al. 2022, Nat Biotechnol 40:189-193, doi 10.1038/s41587-021-00901-y - at THEIR loci, not ours'),
    p('pegRNA PBS and RTT lengths', '13 nt / edit-distance + 15 nt', 'assumed', 'the published defaults of Anzalone et al. 2019, Nature 576:149-157, doi 10.1038/s41586-019-1711-4; not optimised for this locus, and prime editing needs a length screen at every new site'),
    p('phenotype produced by the edit', null, 'assumed', 'NOT ESTABLISHED. design-validation/REPORT.md scored 1 of 10 phenotypic parameters, that one FAILED, and the joint verdict was (NOT CLOSE / largely UNSHOWN, Lean gate FAILS)'),
  ];
  return prov;
}

/** The validation-report panel section, so a design's report carries its editing plan. */
export function panel(plans) {
  const sections = plans.map(r => {
    if (r.refused) return { gene: r.gene, edit: r.edit, status: 'REFUSED', headline: r.refusal, rows: [] };
    const pl = r.plan, g = pl.recommended_guide, ot = Array.isArray(pl.off_target) ? pl.off_target[0] : null;
    const otReason = ot?.search?.reason || (Array.isArray(pl.off_target) ? 'no guide to search' : pl.off_target?.reason) || 'n/a';
    const be = pl.base_editor_route;
    // A knockout's base-editor route is an iSTOP scan (candidates), a point change's is a single CBE/ABE edit.
    const beCell = be?.candidates
      ? (be.reachable ? `iSTOP: codon ${be.candidates[0].codon_number} ${be.candidates[0].codon}->${be.candidates[0].resulting_codon} removes ${(100 * be.candidates[0].protein_fraction_lost).toFixed(1)} % of the protein, guide ${be.candidates[0].spacer} (C at window position ${be.candidates[0].position_of_target_C_in_protospacer})` : `NOT reachable: ${be.reason}`)
      : (be?.reachable === true ? `${be.editor_class}: ${be.edit}` : `NOT reachable: ${be?.reason || '-'}`);
    const d = Array.isArray(pl.hdr_donor) ? pl.hdr_donor.find(x => x.ran) : null;
    return {
      gene: r.gene, edit: r.edit, status: 'PROPOSED, NOT VALIDATED',
      headline: pl.strategy,
      rows: [
        ['locus', `${pl.locus.gene} ${pl.locus.gene_id} / ${pl.locus.transcript_id}, ${E.ASSEMBLY} chr ${pl.locus.chromosome}, strand ${pl.locus.strand}`, 'measured'],
        ['exact change', r.edit === 'knockout' ? pl.exact_genomic_change.note : pl.exact_genomic_change.chosen?.changes?.join('; ') || '-', 'measured'],
        ['guide (SpCas9)', g ? `${g.spacer} + ${g.pam} (strand ${g.strand}), cut at ${pl.locus.chromosome}:${g.cut_site_chrom}${g.distance_cut_to_edit_bp != null ? `, ${g.distance_cut_to_edit_bp} bp from the edit` : ''}` : 'none found in the window', 'derived'],
        ['on-target, published model', g?.on_target_doench2014?.ran ? `${g.on_target_doench2014.score} (Doench 2014 Rule Set 1)` : `not scorable: ${g?.on_target_doench2014?.reason || '-'}`, 'published model, fitted in MOUSE/HUMAN cells - a cross-species transfer, and NOT Rule Set 2'],
        ['on-target, our heuristic', g ? `${g.on_target.score} (${E.ON_TARGET_RULE.id})` : '-', 'HEURISTIC - weights chosen by us, not fitted, NOT a measured efficiency'],
        ['off-target sites in GRCz11', ot?.search?.ran
          ? `${ot.search.n_sites_within_mismatch_limit} sites with <= ${ot.search.max_mismatches} mismatches (by mismatch count: ${JSON.stringify(ot.search.sites_by_mismatch_count)}); ${ot.perfect_matches} perfect match(es)${ot.on_target_found ? ', which includes the intended on-target site - a positive control that the search and the coordinates agree' : ''}; MIT specificity ${ot.mit_specificity?.specificity}; ${Array.isArray(ot.exonic_off_targets) ? ot.exonic_off_targets.length : '?'} mismatched site(s) within 2 kb of a protein-coding gene. Search: ${ot.search.method}.`
          : `NOT RUN (${otReason}) - absence of listed off-targets is NOT evidence of specificity`,
          ot?.search?.method === 'local-exhaustive' ? 'derived - EXHAUSTIVE for substitutions over the GRCz11 primary assembly; still blind to bulges, to alternative loci and to the laboratory strain\'s own genome. A sequence match is not a cut.' : 'derived - a floor, not a ceiling'],
        ['ssODN donor', d ? `${d.length_nt} nt, arms ${d.arms.left_nt}/${d.arms.right_nt}, ${d.blocking_mutations_applied} silent blocking mutation(s), protein check ${d.protein_check?.status}` : (r.edit === 'knockout' ? 'not needed (frameshift)' : 'none'), 'derived'],
        ['base editor', beCell, 'derived'],
        ['prime editing', pl.prime_editor_route?.applicable ? `pegRNA designed: PBS ${pl.prime_editor_route.designs[0].pbs_length_nt} nt, RTT ${pl.prime_editor_route.designs[0].rtt_length_nt} nt, nick ${pl.prime_editor_route.designs[0].nick_to_edit_bp} bp from the edit (${pl.prime_editor_route.zebrafish_precedent})` : `not applicable: ${pl.prime_editor_route?.reason || '-'}`, 'derived - no efficiency predicted'],
        ['HDR rate to expect', E.FEASIBILITY.hdr_in_zebrafish.headline_rate, 'measured in OTHER loci (Boel 2018)'],
        ['phenotype predicted?', 'NOT ESTABLISHED (design-validation/REPORT.md: 1 of 10 parameters scored, that one failed)', 'assumed'],
        ['Evo2 (NVIDIA NIM / BioNeMo)', pl.evo2?.edited_vs_reference?.ran
          ? `edited locus vs reference: delta ${pl.evo2.edited_vs_reference.delta_per_base} per base (${pl.evo2.edited_vs_reference.direction}). RANKS only.`
          : `not run: ${pl.evo2?.edited_vs_reference?.reason || pl.evo2?.not_applicable || pl.evo2?.reason || 'NVIDIA_API_KEY not set'}`,
          'language-model likelihood - NOT a phenotype prediction, NOT evidence of safety or specificity, and it never gates this plan'],
        ['approval', 'institutional animal-care approval (IACUC or equivalent) required before any injection', 'n/a'],
      ],
    };
  });
  return {
    title: 'Germline editing plan (proposal)',
    subtitle: 'What it would take to build this design in Danio rerio, and everything that is not established about doing so.',
    banner: 'PROPOSAL FOR A WET LAB TO CHECK. Not validated, not a protocol, not approved. Do not run blind.',
    sections,
    falsifiers: E.FALSIFIERS,
    not_established: Object.fromEntries(Object.entries(E.FEASIBILITY).map(([k, v]) => [k, typeof v === 'string' ? v : v.statement])),
  };
}

/** Plans for every gene edit on an organism document (uses validate/genotype.mjs geneEdits). */
export async function editPlansForDoc(doc, opts = {}) {
  const { geneEdits } = await import('../genotype.mjs');
  const edits = geneEdits(doc);
  const out = [];
  if (!edits.length) return [{ gene: null, edit: null, refused: true, plan: null,
    refusal: `the document "${doc.id || 'inline'}" carries NO gene-level edits (no doc.edits at level "gene" and no doc.genotype), so there is nothing to plan. ` +
      'This is a real and easy-to-miss case: the repository winged-zebrafish document holds only morphological parameters. ' +
      'Its genotype is recorded elsewhere - sequences/engineered-diff.json and genotype/compare-2x2.json panel B - as ' +
      'slc43a2a (lat4a nr21) p.T200K heterozygous PLUS a kcnh2a (longfin dt2) cis-regulatory inversion. Pass those as ' +
      'doc.genotype [{gene, change}], or use gene + change directly. Note that the inversion is a construct problem this ' +
      'module refuses to plan (see the kcnh2a refusal), so a complete plan for that genotype does not exist here.' }];
  for (const ed of edits) {
    const spec = ed.kind === 'knockout' ? 'knockout'
      : ed.kind === 'missense' || ed.kind === 'nonsense' ? `p.${ed.ref}${ed.pos}${ed.alt}`
      : null;
    if (!spec) { out.push({ gene: ed.gene, edit: ed.raw, refused: true, refusal: `this module plans point changes (p.<REF><POS><ALT>) and knockouts. "${ed.raw}" is a ${ed.kind}: ${ed.kind === 'regulatory' ? 'a cis-regulatory inversion or transgene insertion is a different construct problem and is NOT planned here' : 'not supported'}.`, plan: null }); continue; }
    out.push(await editPlan(ed.gene, spec, opts));
  }
  return out;
}

/** The whole thing as an envelope. */
export function wrap(plans, extraScope = '') {
  return envelope({ n_plans: plans.length, n_refused: plans.filter(x => x.refused).length, plans, panel: panel(plans) },
    provenanceFor(plans), SCOPE + (extraScope ? ' ' + extraScope : ''));
}
