// THE EXPERIMENT, STAGE BY STAGE: what happens, in what order, with which published method to work from,
// and what has to be true before the next stage is allowed to start.
//
// ============================== WHAT THIS IS, AND WHAT IT REFUSES TO BE ==============================
// This is a PLAN, not a bench protocol. The difference is not a disclaimer, it is the design of the file:
// every stage names a PUBLISHED method to work from and does not restate its steps. Where a number is
// needed - a concentration, a stage, a count - it comes from conditions.mjs with the paper that measured
// it attached, or it is marked as having no published value.
//
// There are two reasons for building it this way rather than writing out the bench steps.
//   1. HONESTY. Nobody here has done this at a bench. A procedure written from reading is a procedure with
//      no provenance, and it would be the only unsourced thing in a repository where everything else
//      carries its label. The cited protocols have been executed, reviewed and corrected by their authors.
//   2. CORRECTNESS. A protocol restated is a protocol that silently goes stale and loses its errata. A
//      citation stays correct and lets the lab read the authors' own cautions.
//
// What this file therefore adds, which a pile of citations does not: the ORDER, the DECISION GATES (what
// result forbids going on), the per-arm parameters, and the counts that drive the bill of materials.
//
// ============================== THE GATES ARE THE POINT ==============================
// Most of the money in a failed experiment is spent after the moment it became unsalvageable. Each stage
// below carries `gate`: a condition that must hold before the next stage may start, and what it costs to
// find out. Two of them - sequencing the protospacer in the lab's own fish, and confirming the guide cuts
// at all - cost under a hundred dollars between them and can each invalidate everything downstream.
//
// Danio rerio only. Institutional animal-care approval is required before the first injection, and this
// module cannot grant it.

export const WHAT_THIS_IS =
  'A staged plan that cites a published method at every step. It is NOT a bench protocol: it does not ' +
  'restate the cited methods, it does not replace them, and no step in it has been performed at a bench by ' +
  'us. A laboratory works from the cited papers and from its own established practice; what this adds is ' +
  'the order, the decision gates, the per-condition parameters and the counts that the bill of materials ' +
  'is computed from.';

export const APPROVAL_GATE = {
  before_anything: 'institutional animal-care approval (IACUC in the United States, or the local equivalent)',
  detail: 'The approved protocol must name the line, the numbers, the endpoints and the justification. Zebrafish are additionally regulated once larvae reach independent feeding, which is the point at which several of the cases in cases.mjs stop being embryo work. This module does not and cannot grant any of this, and nothing in it is a reason to start.',
  also: 'Institutional biosafety registration covers the nuclease and any plasmid or synthetic nucleic acid, separately from animal care. Check both before ordering, not after.',
};

/** The published methods a stage can tell a lab to work from. Keyed so a stage cites by id and the list
 *  stays in one place; every entry is a paper, never a paraphrase of one. */
export const METHODS = {
  rnp_injection: { what: 'Cas9 protein injected as a ribonucleoprotein with synthetic sgRNA at the one-cell stage', citation: 'Burger et al. 2016, Development 143:2025-2037, doi 10.1242/dev.134809', why: 'higher and earlier activity in zebrafish embryos than mRNA' },
  mrna_injection: { what: 'nCas9n mRNA transcribed from pT3TS-nCas9n, injected with sgRNA', citation: 'Jao, Wente & Chen 2013, PNAS 110:13904-13909, doi 10.1073/pnas.1308335110', why: 'the long-standing zebrafish-codon-optimised, nuclear-localised Cas9 mRNA route; cheaper per injection than protein, slower to act' },
  t7_sgrna: { what: 'sgRNA transcribed in vitro from a T7 template', citation: 'Hwang et al. 2013, Nat Biotechnol 31:227-229, doi 10.1038/nbt.2501', why: 'the cheap route to a guide; needs a 5\' G, which may add a mismatch at protospacer position 1' },
  ssodn_donor: { what: 'single-stranded oligodeoxynucleotide repair template for a point change', citation: 'Boel et al. 2018, Dis Model Mech 11:dmm035352, doi 10.1242/dmm.035352, PMID 30355591', why: 'measured error-free HDR of 1-4 % of alleles in zebrafish and identified homology-arm length as the dominant factor' },
  ssodn_asymmetric: { what: 'anti-sense asymmetric ssODN design and phosphorothioate end protection', citation: 'Prykhozhij et al. 2018, Nucleic Acids Res 46:e102, doi 10.1093/nar/gky512, PMID 29905858', why: 'reports a 3- to 10-fold gain from asymmetry - but DISAGREES with Boel 2018, which found no benefit. An erratum exists (doi 10.1093/nar/gky674). Both donors are emitted because the literature does not settle this.' },
  founder_screening: { what: 'prioritising founders by fin biopsy before setting up outcrosses', citation: 'Carrington et al. 2022, BMC Genomics 23:810, doi 10.1186/s12864-022-08971-1, PMID 36476416', why: 'measured 1-5 % germline transmission, and established lines by screening 12 or fewer fish per gene - this is the stage that decides how many tanks the experiment needs' },
  f0_multiguide: { what: 'multiple guides per gene to drive biallelic disruption in the injected generation', citation: 'Kroll et al. 2021, eLife 10:e59683, doi 10.7554/eLife.59683', why: 'the method the F0 cases in cases.mjs depend on; see conditions.mjs for what it measured' },
  amplicon_readout: { what: 'amplicon sequencing across the whole edited locus, both alleles', citation: 'Boel et al. 2018 (above)', why: 'Boel measured INTEGRATION OF DONOR FRAGMENTS at the cut site, so a correct base at the edited position does not mean a clean allele. A restriction digest or a read of the edited base alone will miss this.' },
  tol2_mosaic_overexpression: { what: 'a Tol2 donor plasmid carrying ef1a:gene plus ef1a:DsRed in cis, co-injected with transposase mRNA into the one-cell zygote, producing mosaic expressing clones in fish raised to adulthood', citation: 'Perathoner et al. 2014, PLoS Genet 10(1):e1004080, doi 10.1371/journal.pgen.1004080 (method as used); Tol2 transgenesis after Kawakami 2007 and the Tol2kit, Kwan et al. 2007, Dev Dyn 236:3088-3099', why: 'the only published route in this program that produces fin ENLARGEMENT in the injected generation, with no cross and no point edit. Its inferential weight comes from two controls in the same design: a marker-only plasmid (0/240) and a conductance-dead channel variant (no overgrowth, n = 32).' },
};

/** Stages for mosaic overexpression from an injected Tol2 plasmid. Not an edit: no guide, no nuclease,
 *  no genotyping of a locus - and a readout in adults, so the long pole is husbandry, not reagents. */
export function overexpressionStages(ctx = {}) {
  const arms = ctx.arms ?? [];
  return [
    { id: 'approval', day: null, what: 'institutional animal-care and biosafety approval in hand', follow: null,
      gate: { must_hold: 'approval covers this line, these numbers and these endpoints', if_not: 'nothing below may start', cost_to_check: 'none' },
      additional_for_this_route: 'this route creates animals carrying an integrated transgene and raises them to adulthood, which in many institutions is a different approval category from a transient injection experiment. Check that specifically rather than assuming the nuclease protocol covers it.' },
    { id: 'obtain-constructs', day: -60, what: 'obtain or build THREE plasmids: ef1a:kcnk5b + ef1a:DsRed, the ef1a:DsRed-only control, and the non-conductive GFG->AAA variant',
      follow: ['tol2_mosaic_overexpression'],
      why: 'the constructs are not in a public repository. Either request them from the corresponding author of the source paper (free, on their timetable, usually under an MTA) or clone all three - and the controls are not optional, so it is three constructs either way.',
      gate: { must_hold: 'all three plasmids are sequence-verified across the promoter-insert junction and the insert', if_not: 'nothing downstream is interpretable, and a silently wrong control is worse than no control', cost_to_check: 'Sanger reads per construct', falsifier: 'construct-wrong' },
      this_is_the_long_pole_before_injection: true },
    { id: 'transposase-mrna', day: -14, what: 'transcribe capped Tol2 transposase mRNA, or borrow an aliquot',
      follow: ['tol2_mosaic_overexpression'],
      note: 'the transcription kit is 25 reactions and one reaction makes far more than a session needs. Borrowing an aliquot removes the most expensive line in this route.',
      gate: { must_hold: 'the mRNA is intact on a gel and the concentration is measured, not assumed', if_not: 'no transposition, no integration, and the injection looks like it worked', cost_to_check: 'one gel lane' } },
    { id: 'order', day: -10, what: 'order the plasmid, transcription reagents and injection consumables', follow: null,
      gate: { must_hold: 'the constructs are verified', if_not: 'do not order', cost_to_check: 'none' } },
    { id: 'prepare-mixes', day: 0, what: `prepare one injection mix per arm (${arms.length || 'n'} arms), each plasmid + transposase mRNA + phenol red`,
      parameters: { arms: arms.map(a => a.id) } },
    { id: 'inject', day: 0, what: 'inject the one-cell zygote, one clutch split across arms where possible',
      follow: ['tol2_mosaic_overexpression'],
      parameters: { pressure: '275 Pa (40 psi)', duration: '100 ms', note: 'as published; rig-specific in practice' },
      gate: { must_hold: 'the marker-only control and the conductance-dead control are injected in the SAME session from the SAME clutch', if_not: 'the overgrowth call has no reference rate and the experiment has not been run', cost_to_check: 'embryos and two more needles' } },
    { id: 'survival', day: 1, what: 'score survival and gross morphology at 24 hpf per arm, and RECORD THE CURVE',
      gate: { must_hold: 'survival is recorded per arm, whatever it is', if_not: 'the toxicity of this route stays unknown and the next session repeats the guess', cost_to_check: 'none, it is counting' },
      why_record_rather_than_compare: 'the published stop rules in conditions.mjs were measured for nuclease injections. For a plasmid-plus-transposase mix they are borrowed, so this session is where a real number for this route starts to exist.' },
    { id: 'enrich-transgene-positive', day: 4, what: 'screen larvae for DsRed and keep the positives',
      why: 'it saves tank space, but it does NOT predict fin expression: the published denominator is fish showing DsRed in the FINS as adults, and larval expression elsewhere does not imply it.',
      gate: { must_hold: 'the enrichment step is recorded as an enrichment, not as the transgene-positive rate', if_not: 'the final penetrance denominator is wrong', cost_to_check: 'none' } },
    { id: 'raise-to-adult', day: 5, what: 'raise injected fish to adulthood', parameters: { months: 3.5, tanks: Math.max(arms.length, 1) },
      note: 'THIS is the cost of the route. Four arms is four tanks for about four months, and no reagent line in the bill of materials comes close to it.' },
    { id: 'score-overgrowth', day: 110, what: 'score local fin and barbel overgrowth, blind to arm, against DsRed signal in the fin mesenchyme',
      gate: { must_hold: 'scoring is blind to arm AND the two control arms are scored in the same session by the same scorer', if_not: 'the result is not evidence', cost_to_check: 'none, it is a labelling discipline' },
      note: 'a patchy local phenotype is a more subjective call than a normalised area ratio. Score twice, or have two people score, and record the disagreement rate.' },
    { id: 'confirm-transgene', day: 110, what: 'PCR the transgene from overgrown tissue, including from overgrown fins with NO visible DsRed',
      why: 'in the source, some overgrown fins had no detectable marker at all (W169L 2/26, wt 2/11), attributed to promoter variegation. The marker is evidence of expression, not of presence.',
      gate: { must_hold: 'overgrowth is attributed by PCR, not by fluorescence alone', if_not: 'the association between the transgene and the phenotype is weaker than it looks', cost_to_check: 'one PCR per scored fin' } },
    { id: 'analysis', day: null, what: 'compare the overgrowth rate against the marker-only and conductance-dead arms, and against the published 0/240 and n = 32',
      gate: { must_hold: 'the comparison was powered before the embryos were injected', if_not: 'a null result is uninterpretable and the experiment answered nothing', cost_to_check: 'free, and for THIS route it is actually possible - see power.mjs, because both control rates are published' } },
  ];
}

/** Stages for a knockout read out in the injected generation (the cheap case). */
export function f0Stages(ctx = {}) {
  const arms = ctx.arms ?? [];
  return [
    { id: 'approval', day: null, what: 'institutional animal-care and biosafety approval in hand', follow: null,
      gate: { must_hold: 'approval covers this line, these numbers and these endpoints', if_not: 'nothing below may start', cost_to_check: 'none' } },
    { id: 'verify-locus', day: -14, what: 'PCR and Sanger-sequence the protospacer and PAM in the ACTUAL breeding fish, not the reference',
      follow: null, parameters: { amplicons: 1, fish: 'a few of the breeding stock' },
      why: 'AB, TU and WIK carry high SNP density. A SNP in the PAM makes the guide dead, and the edit plan\'s coordinates are all GRCz11 reference.',
      gate: { must_hold: 'the protospacer and PAM in the lab\'s strain match the planned guide', if_not: 'pick another guide from the plan BEFORE ordering anything', cost_to_check: 'one PCR and one Sanger read - the cheapest way to invalidate the whole plan', falsifier: 'polymorphism' } },
    { id: 'order', day: -10, what: 'order guides, nuclease and consumables', follow: null,
      gate: { must_hold: 'the locus check passed', if_not: 'do not order', cost_to_check: 'none' },
      note: 'this is the stage the bill of materials exists for; nothing is ordered before verify-locus passes' },
    { id: 'prepare-mixes', day: 0, what: `prepare one injection mix per condition (${arms.length || 'n'} arms)`,
      follow: ['rnp_injection', 'mrna_injection'], parameters: { arms: arms.map(a => a.id) },
      note: 'one mix per arm is what drives reagent consumption - see quantities.injectionMix, where the delivered volume is a per-cent or so of the prepared volume' },
    { id: 'inject', day: 0, what: 'inject at the one-cell stage, one clutch split across arms where possible',
      follow: ['rnp_injection', 'f0_multiguide'],
      why_split_a_clutch: 'splitting one clutch across arms removes clutch-to-clutch variance from the comparison between conditions, which is the largest nuisance term in this kind of experiment. It cannot remove it from a comparison against a historical control.',
      gate: { must_hold: 'an uninjected and a buffer-injected control from the SAME clutch are set up alongside', if_not: 'survival and phenotype are uninterpretable', cost_to_check: 'embryos only' } },
    { id: 'survival', day: 1, what: 'score survival and gross morphology at 24 hpf; record per arm',
      gate: { must_hold: 'survival in the injected arms is not catastrophically below the buffer control', if_not: 'the dose is toxic - see the dose rows in conditions.mjs before re-injecting', cost_to_check: 'none, it is counting' } },
    { id: 'confirm-cutting', day: 2, what: 'pool embryos per arm and amplicon-sequence the target to confirm the guide cuts at all',
      follow: ['amplicon_readout'], parameters: { pooled_embryos_per_arm: ctx.pool_size ?? null },
      why: 'this is the only measurement that separates "the guide does not work" from "the gene does not do what was claimed". Without it a null phenotype is uninterpretable.',
      gate: { must_hold: 'indels are detected at the target', if_not: 'the phenotype readout below means nothing; fix the guide, not the hypothesis', cost_to_check: 'one amplicon per arm', falsifier: 'no-cut' } },
    { id: 'phenotype', day: ctx.readout_day ?? 2, what: ctx.assay ?? 'the case\'s phenotype assay at its specified stage',
      parameters: { stage: ctx.readout_stage ?? null },
      gate: { must_hold: 'scoring is done blind to arm', if_not: 'the result is not evidence', cost_to_check: 'none, it is a labelling discipline' } },
    { id: 'analysis', day: null, what: 'compare arms against the published expectation recorded in cases.mjs',
      gate: { must_hold: 'the comparison was powered before the embryos were injected', if_not: 'a null result is uninterpretable and the experiment answered nothing', cost_to_check: 'free, but only if done first - which is why it is a gate and not a step' } },
  ];
}

/** Stages for a precise point change. Everything above, plus the generations. */
export function knockinStages(ctx = {}) {
  const dominant = ctx.dominant === true;
  return [
    ...f0Stages(ctx).filter(s => s.id !== 'phenotype' && s.id !== 'analysis'),
    { id: 'raise-f0', day: 5, what: 'raise the injected embryos to sexual maturity', parameters: { months: 3 },
      note: 'an F0 is a MOSAIC. Its phenotype is not the phenotype of the designed genotype, and nothing may be concluded from it.' },
    { id: 'screen-founders', day: 90, what: 'fin-biopsy and prioritise founders before setting up outcrosses', follow: ['founder_screening'],
      why: 'germline transmission was measured at 1-5 % of founders; biopsy-first is what keeps the number of tanks finite',
      gate: { must_hold: 'at least one founder transmits the intended allele', if_not: 'no amount of downstream work recovers it; re-inject, or switch route', cost_to_check: 'biopsies plus sequencing', falsifier: 'no-hdr' } },
    { id: 'f1', day: 120, what: 'outcross transmitting founders to wild type and amplicon-sequence the FULL locus in the F1',
      follow: ['amplicon_readout'],
      gate: { must_hold: 'an F1 carries the intended change with no donor fragment and no nearby indel', if_not: 'the allele is not clean and the phenotype would be uninterpretable', cost_to_check: 'one amplicon per F1 screened', falsifier: 'template-integration' } },
    dominant
      ? { id: 'phenotype-f1', day: 210, what: 'measure the phenotype in heterozygous F1, blind to genotype',
          why: 'the allele is DOMINANT, so the heterozygote is informative and the F2 intercross is not required. This removes one cross and about three months.',
          gate: { must_hold: 'scoring is blind and the comparison was powered first', if_not: 'the result is not evidence', cost_to_check: 'none' } }
      : { id: 'f2', day: 210, what: 'intercross F1 carriers for homozygotes and score Mendelian ratios',
          gate: { must_hold: 'homozygotes are recoverable', if_not: 'the allele may be lethal; the homozygous version of the plan dies here', cost_to_check: 'one clutch and its genotyping', falsifier: 'lethality' } },
    { id: 'analysis', day: null, what: 'compare against the published expectation recorded in cases.mjs' },
  ];
}

/** Pick the stage list a case needs, and say why. */
export function stagesFor(kase, ctx = {}) {
  const overexpression = /tol2|transgenesis/i.test(kase?.edit?.kind ?? '');
  const f0 = kase?.scorable_in_injected_generation === true;
  const dominant = /dominant/i.test(kase?.why ?? '') || ctx.dominant === true;
  if (overexpression) {
    return {
      route: 'overexpression',
      why: 'the case is not an edit at all: a Tol2 donor plasmid is injected, so there is no guide to verify, no cut to confirm and no locus to genotype - but the readout is in adults, so no cross is needed and the experiment is still months long',
      stages: overexpressionStages(ctx),
      what_this_is: WHAT_THIS_IS,
      approval: APPROVAL_GATE,
    };
  }
  return {
    route: f0 ? 'f0' : 'knockin',
    why: f0
      ? 'the case is scorable in the injected generation, so no cross is needed and the whole experiment is days rather than months'
      : `the case needs a precise change or a homozygote, so it runs through ${dominant ? 'one cross (the allele is dominant, so a heterozygous F1 is informative)' : 'two crosses'}`,
    stages: f0 ? f0Stages(ctx) : knockinStages({ ...ctx, dominant }),
    what_this_is: WHAT_THIS_IS,
    approval: APPROVAL_GATE,
  };
}
