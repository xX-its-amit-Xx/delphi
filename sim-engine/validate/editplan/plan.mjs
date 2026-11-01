// Assembles one editing plan per gene edit, and the panel section that carries it into a design's
// validation report. See editplan.mjs for the pipeline and for what every number is and is not.
import { envelope, p } from '../../lib/envelope.mjs';
import * as E from './editplan.mjs';

export const SCOPE =
  'A PROPOSAL for a wet lab to check, not a protocol and not a validated plan. No guide here has been tested, ' +
  'no embryo injected, no fish genotyped. On-target scores are a labelled HEURISTIC (not Doench 2016 Rule Set 2, ' +
  'not a measured efficiency); off-target counts come from a heuristic aligner against GRCz11 and are a FLOOR, ' +
  'never a ceiling; HDR rates are quoted from the literature, not from our hands. Nothing here establishes that ' +
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
export async function editPlan(gene, spec, { network = true, species = 'danio_rerio', window = 30, offtarget = true, offtargetGuides = 1, arms = 'symmetric', flank = 220 } = {}) {
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
    gs = gs.map(g => ({ ...g, on_target: E.onTargetHeuristic(g.spacer) }));
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
    if (!best) return null;
    const alt = [...byNuclease.SaCas9.guides, ...byNuclease.AsCas12a.guides]
      .filter(g => g.distance_cut_to_edit_bp != null && best.distance_cut_to_edit_bp != null && g.distance_cut_to_edit_bp < best.distance_cut_to_edit_bp);
    return alt.length ? { nuclease: alt[0].nuclease, distance_cut_to_edit_bp: alt[0].distance_cut_to_edit_bp, why: `its cut site is ${best.distance_cut_to_edit_bp - alt[0].distance_cut_to_edit_bp} bp closer to the edited base than the best SpCas9 guide, which matters because HDR falls off with distance from the break`, guide: alt[0] } : null;
  })();

  // --- off-target search against GRCz11, for the guide(s) we would actually order
  const offt = [];
  if (offtarget) {
    for (const g of (t.kind === 'knockout' ? spGuides : [best, better_placed?.guide].filter(Boolean)).slice(0, offtargetGuides)) {
      const r = await E.offTargets(g.spacer, g.pam_motif, { network });
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
  return { gene: res.gene, edit: typeof spec === 'string' ? spec : res.target.kind, refused: false, plan, resolved: res };
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
    p('on-target guide score', E.ON_TARGET_RULE.id, 'assumed', `a transparent HEURISTIC we combined from published observations (${E.ON_TARGET_RULE.terms.map(t => t.term).join(', ')}); the weights are OURS and were not fitted. ${E.ON_TARGET_RULE.what_it_is_not}`),
    p('off-target position weights', 'Hsu 2013 MIT weights', 'measured-secondhand', E.MIT_CITATION),
    p('MIT specificity', null, 'derived', 'computed from the Hsu 2013 weights over the GRCz11 sites found by NCBI blastn-short; a PREDICTION, and a floor because the aligner is heuristic'),
    p('off-target site list', E.OFFTARGET_DB, 'derived', 'NCBI BLAST URL API, blastn-short word_size 7 against the zebrafish genome assembly; gene context from Ensembl /overlap/region'),
    p('ssODN arm lengths', '40/40 and 36/91 nt', 'borrowed', 'the symmetric design follows published zebrafish point-knock-in protocols; the 36/91 asymmetric design is Richardson 2016, measured in HUMAN cells and borrowed here'),
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
    const d = Array.isArray(pl.hdr_donor) ? pl.hdr_donor.find(x => x.ran) : null;
    return {
      gene: r.gene, edit: r.edit, status: 'PROPOSED, NOT VALIDATED',
      headline: pl.strategy,
      rows: [
        ['locus', `${pl.locus.gene} ${pl.locus.gene_id} / ${pl.locus.transcript_id}, ${E.ASSEMBLY} chr ${pl.locus.chromosome}, strand ${pl.locus.strand}`, 'measured'],
        ['exact change', r.edit === 'knockout' ? pl.exact_genomic_change.note : pl.exact_genomic_change.chosen?.changes?.join('; ') || '-', 'measured'],
        ['guide (SpCas9)', g ? `${g.spacer} + ${g.pam} (strand ${g.strand}), cut at ${pl.locus.chromosome}:${g.cut_site_chrom}${g.distance_cut_to_edit_bp != null ? `, ${g.distance_cut_to_edit_bp} bp from the edit` : ''}` : 'none found in the window', 'derived'],
        ['on-target score', g ? `${g.on_target.score} (${E.ON_TARGET_RULE.id})` : '-', 'heuristic - NOT a measured efficiency'],
        ['off-target sites in GRCz11', ot?.search?.ran ? `${ot.search.n_sites_within_mismatch_limit} sites with <= ${ot.search.max_mismatches} mismatches (${ot.perfect_matches} perfect, including the on-target); MIT specificity ${ot.mit_specificity?.specificity}` : `not run: ${ot?.search?.reason || 'n/a'}`, 'derived - a floor, not a ceiling'],
        ['ssODN donor', d ? `${d.length_nt} nt, arms ${d.arms.left_nt}/${d.arms.right_nt}, ${d.blocking_mutations_applied} silent blocking mutation(s), protein check ${d.protein_check?.status}` : (r.edit === 'knockout' ? 'not needed (frameshift)' : 'none'), 'derived'],
        ['base editor', pl.base_editor_route?.reachable === true ? `${pl.base_editor_route.editor_class}: ${pl.base_editor_route.edit}` : `NOT reachable: ${pl.base_editor_route?.reason || pl.base_editor_route?.note || '-'}`, 'derived'],
        ['prime editing', pl.prime_editor_route?.applicable ? `pegRNA designed: PBS ${pl.prime_editor_route.designs[0].pbs_length_nt} nt, RTT ${pl.prime_editor_route.designs[0].rtt_length_nt} nt, nick ${pl.prime_editor_route.designs[0].nick_to_edit_bp} bp from the edit (${pl.prime_editor_route.zebrafish_precedent})` : `not applicable: ${pl.prime_editor_route?.reason || '-'}`, 'derived - no efficiency predicted'],
        ['HDR rate to expect', E.FEASIBILITY.hdr_in_zebrafish.headline_rate, 'measured in OTHER loci (Boel 2018)'],
        ['phenotype predicted?', 'NOT ESTABLISHED (design-validation/REPORT.md: 1 of 10 parameters scored, that one failed)', 'assumed'],
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
