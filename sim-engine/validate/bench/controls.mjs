// POSITIVE CONTROLS, and the finding that the edit planner ranks guides on the wrong quantity.
//
// ============================== WHY A CONTROL LOCUS BELONGS IN A BUDGET ==============================
// Every case in cases.mjs can fail in two completely different ways: the biology is not what the design
// claims, or the injection did not work. Those failures look identical in the data - a clutch of normal
// embryos - and only one of them is interesting. A control locus separates them for the price of a few
// extra embryos, which is the cheapest insurance anywhere in this package.
//
// ============================== THE FIN-DESIGN CONTROL IS UNUSUALLY GOOD ==============================
// tbx5a crispants have NO pectoral fins, at 100 % (43/43), scorable with a stereoscope at 3 dpf. For a
// design whose whole claim is about pectoral fins, that is a control that proves the exact competence the
// real assay needs: that this lab, on this day, can score pectoral fin state in injected embryos. It is
// not a test of the design and is never presented as one.
//
// ============================== SCOPE ==============================
// Danio rerio. `verified_in_this_run` means the quote was read from the publisher's own page in this run.
// It does not mean we reproduced anything.

export const WHY_A_CONTROL =
  'A null result has two causes that look the same: the biology is not what was claimed, or the injection ' +
  'failed. A control locus injected alongside - or, as the only paper to recommend one puts it, in a ' +
  'separate validation round - tells those apart. Without it a negative result from any case in cases.mjs ' +
  'is uninterpretable, and the embryos were spent for nothing.';

export const CONTROLS = [
  {
    id: 'tbx5a', mutant_name: 'heartstrings',
    phenotype: 'no pectoral fins (with a non-looping heart and pericardial oedema)',
    scored_with: 'stereoscope', binary: true, earliest_stage: '3 dpf',
    penetrance: '100 % (43/43) of F0 larvae did not develop pectoral fins',
    basis: 'per-embryo', n: 43, guides: 3, delivery: 'synthetic crRNA:tracrRNA RNP, injected into the yolk',
    quote: '100% (43/43) of the tbx5a F0 larvae did not develop pectoral fins',
    where: 'Results, Figure 4A; "Pectoral fins were inspected at 3 dpf" (Fig. 4A legend and Methods)',
    citation: 'Kroll et al. 2021, eLife 10:e59683, doi 10.7554/eLife.59683, PMC7793621',
    verified_in_this_run: true,
    why_this_one_for_a_fin_design:
      'It proves the laboratory can score PECTORAL FIN STATE in injected embryos at 3 dpf - the exact ' +
      'competence every fin case in cases.mjs depends on. A pigment control proves the injection worked; ' +
      'this proves the readout works. They are different claims and a fin experiment wants both.',
    what_it_does_not_show: 'anything about the design. It removes fins; the design claims to enlarge them. It is an assay control, not a test.',
  },
  {
    id: 'slc24a5', mutant_name: 'golden',
    phenotype: 'unpigmented eye and retinal pigment epithelium',
    scored_with: 'stereoscope, on the paper\'s published 1-5 scale where only score 1 (no detectable pigmented cell) counts',
    binary: false, earliest_stage: '2 dpf',
    penetrance: '95 % (55/58) and 100 % (37/37)',
    basis: 'per-embryo', n: '58 and 37', guides: 3, delivery: 'Cas9 protein + synthetic crRNA:tracrRNA RNP, 1:1, ~1 nL into the yolk',
    quote: 'we recommend targeting a pigmentation gene such as slc24a5 to quantify success rate at injections',
    where: 'Figure 7A legend',
    citation: 'Kroll et al. 2021, eLife 10:e59683, doi 10.7554/eLife.59683',
    verified_in_this_run: true,
    why_this_one: 'the ONLY locus any paper examined here explicitly recommends for this purpose, and the one measured at the same 2 dpf readout by several laboratories across different delivery chemistries, which is what makes it robust to whatever chemistry a lab actually runs.',
  },
  {
    id: 'tyr', mutant_name: 'tyrosinase',
    phenotype: 'no melanin in the eye or body', scored_with: 'naked eye or stereoscope', binary: true, earliest_stage: '2 dpf',
    penetrance: '59/59 (100 %) with only two guides',
    basis: 'per-embryo', n: 59, guides: 2, delivery: 'synthetic crRNA RNP into the yolk',
    quote: 'using just two RNPs to target tyr yielded 59/59 F0 embryos with no eye pigmentation',
    where: 'Results, Figure 1D',
    citation: 'Kroll et al. 2021, eLife 10:e59683, doi 10.7554/eLife.59683',
    verified_in_this_run: true,
    note: 'with the three-guide set at a 1:1 Cas9:gRNA ratio, 71/74 larvae lacked eye pigmentation (Fig. 1-figure supplement 1).',
  },
  {
    id: 'tbx16', mutant_name: 'spadetail',
    phenotype: 'bent tail ending in a clump of cells', scored_with: 'naked eye', binary: true, earliest_stage: '1 dpf',
    penetrance: '100 % (93/93) of injected larvae were evident spadetail mutants',
    basis: 'per-embryo', n: 93, guides: 'not stated in the visible text; the Methods describe three loci per gene as the general protocol',
    delivery: 'synthetic crRNA RNP into the yolk',
    quote: '100% (93/93) of the injected larvae were evident spadetail mutants',
    where: 'Results, Figure 1-figure supplement 2',
    citation: 'Kroll et al. 2021, eLife 10:e59683, doi 10.7554/eLife.59683',
    verified_in_this_run: true,
    note: 'the earliest readout of any control here - 1 dpf - so it is the fastest way to know an injection session failed.',
  },
  {
    id: 'rx3', mutant_name: 'chokh',
    phenotype: 'eyes absent', scored_with: 'naked eye or stereoscope, no reporter line', binary: true, earliest_stage: '2 dpf',
    penetrance: '98.43 % for the best single guide',
    basis: 'per-embryo', n: 127, guides: 1, delivery: 'Cas9-NLS protein RNP, single guide',
    citation: 'Lin et al. 2025, Nucleic Acids Res 53(5):gkaf180, doi 10.1093/nar/gkaf180, PMID 40103232, Supplementary Table S2',
    verified_in_this_run: false,
    caveat: 'the per-guide percentages live in a supplementary spreadsheet that was read by a research agent, not by this run. The paper\'s main text was read here and is consistent with them, but these specific numbers are one step weaker than the Kroll figures above.',
    why_not_the_default_control: 'it has the cleanest single-guide numbers of any locus found, but no paper proposes it as an injection control, and "no eyes" is more easily confused with general injection damage than loss of pigment is.',
  },
];

export const HOW_TO_USE_A_CONTROL = {
  recommendation: 'Run slc24a5 to prove the injection works, and - for any case whose readout is a fin - tbx5a to prove the readout works.',
  important_caveat:
    'No paper examined here actually CO-INJECTS a control locus into the same embryos as the real target. ' +
    'Kroll\'s recommendation is for a SEPARATE validation round. Co-injection would split the Cas9 between ' +
    'two targets and change the dose at both, so a control arm means extra embryos in the same session, not ' +
    'extra guides in the same needle - and that is how the bill of materials counts it.',
  a_better_engineering_answer_exists:
    'Burger et al. 2016 (doi 10.1242/dev.134809) instead used a Cas9-EGFP fusion as a per-embryo injection ' +
    'marker, which reports on EVERY embryo rather than on a sample of a separate round. For an experiment ' +
    'whose readout is a small quantitative difference, that is arguably the better control, because it lets ' +
    'an uninjected embryo be excluded rather than silently diluting the effect.',
};

// ---------------------------------------------------------------------------------------------------
// THE FINDING THAT CRITICISES OUR OWN PIPELINE.
// ---------------------------------------------------------------------------------------------------
export const GUIDE_PLACEMENT = {
  headline: 'Guide placement decides whether a knockout experiment works at all, and it is not what the edit planner ranks on.',
  evidence: [
    { finding: 'cutting efficiency does not predict whether a phenotype appears',
      quote: 'However, no significant correlation was observed with Lindel score and editing efficiency.',
      note: 'Lindel score DID track the knockout score (>75 high, <75 low) while failing to track editing efficiency. The quantity that predicts a phenotype and the quantity that predicts a cut are different quantities.',
      citation: 'Lin et al. 2025, doi 10.1093/nar/gkaf180, Results and Fig. 2', verified_in_this_run: true },
    { finding: 'the rule that did work was positional, not efficiency-based',
      quote: 'high phenotypic penetrance in F0 zebrafish is better achieved by selecting gRNAs targeting the sequences encoding the N-terminus of a functional domain, i.e. the first half of the functional domain, which is termed the "first-half domain rule."',
      citation: 'Lin et al. 2025, Discussion', verified_in_this_run: true },
    { finding: 'the strategy the edit planner currently implements is the one this paper reports as ineffective',
      quote: 'Contrary to common strategies, targeting early coding exons to induce PTCs was not effective in achieving high phenotype penetrance.',
      citation: 'Lin et al. 2025, Discussion', verified_in_this_run: true },
    { finding: 'the size of the design space tested',
      quote: 'We designed 51 gRNAs (35 ID and 16 OD) across the six target genes',
      note: 'ID = inside an annotated functional domain, OD = outside one.',
      citation: 'Lin et al. 2025, Results', verified_in_this_run: true },
    { finding: 'same gene, same pipeline, different guide: 31.63 % versus 100 % penetrance (noto), and several genes span 0 % to over 86 %',
      citation: 'Lin et al. 2025, Supplementary Table S2', verified_in_this_run: false,
      caveat: 'read from the supplementary spreadsheet by a research agent, not re-read here. The aggregate design (51 guides, 35 inside and 16 outside domains) IS verified above and is consistent with it.' },
  ],
  what_this_says_about_our_own_edit_planner: {
    the_problem:
      'sim-engine/validate/editplan ranks knockout guides by on-target CUTTING efficiency - Doench 2014 plus ' +
      'our own heuristic - and, for a knockout, filters to cuts inside an early coding exon and reports the ' +
      'protein fraction lost to a frameshift there. That is precisely the early-exon PTC strategy Lin 2025 ' +
      'reports as not effective, ranked by precisely the quantity Lin 2025 found does not correlate with ' +
      'phenotype penetrance.',
    what_is_NOT_being_claimed:
      'That the edit planner is wrong. Doench 2014 predicts cutting and does it honestly; the planner labels ' +
      'it as a cutting score and never calls it a phenotype score. The gap is that nothing downstream ever ' +
      'converts cutting into the probability of seeing a phenotype, so a user reading a high on-target score ' +
      'can reasonably believe the experiment is likely to work when the published evidence does not support ' +
      'that inference.',
    also_unsettled:
      'Lin 2025 and Kroll 2021 give opposite advice on exon strategy - Lin against early coding exons, Kroll ' +
      'prioritising early and asymmetric exons. Both are peer-reviewed. This is recorded as a disagreement ' +
      'in the literature, not resolved here, and a guide chosen under either rule should say which.',
    suggested_change: 'add a domain-position term to the knockout ranking and report it as a SEPARATE order, the way editplan already reports several orders that disagree, rather than blending it into one score.',
  },
};

export function controlFor(kase) {
  // The overexpression route injects a plasmid and transposase mRNA. Every control in CONTROLS is a
  // CRISPR control: it proves that a NUCLEASE injection worked. Offering one here would prove something
  // about an experiment the lab is not running, so the route gets its own answer instead.
  if (/tol2|transgenesis/i.test(kase?.edit?.kind ?? '')) {
    return {
      injection_control: null,
      readout_control: null,
      why:
        'NONE OF THE PUBLISHED CONTROLS IN THIS FILE TRANSFER. slc24a5 and tbx5a are CRISPR controls: they ' +
        'show that a guide-and-nuclease injection cut and produced a phenotype. This route injects a Tol2 ' +
        'donor plasmid with transposase mRNA and no nuclease at all, so a working slc24a5 crispant would ' +
        'say nothing about whether this injection delivered a transgene.',
      the_controls_are_in_the_design_instead: [
        { id: 'control:dsred-only', proves: 'that overgrowth needs the channel, not the injection or the transgene machinery', published_result: '0/240' },
        { id: 'control:non-conductive', proves: 'that overgrowth needs the channel to CONDUCT, which is the mechanism claim', published_result: 'no overgrowth, n = 32 fins with DsRed-positive tissue' },
      ],
      the_injection_control_this_route_actually_needs:
        'the marker itself. DsRed expression IS the delivery control, which is why the construct carries it ' +
        'in cis - but only as evidence of expression, not of presence: in the source, some overgrown fins ' +
        'had no detectable DsRed (W169L 2/26, wt 2/11), so the plan gates on a PCR rather than on fluorescence.',
      what_is_still_missing:
        'a positive control for TRANSPOSITION itself - a construct known to integrate and express in fin ' +
        'tissue in this facility. A lab new to Tol2 should run one before committing four months of tank ' +
        'space, and no published candidate for it is recorded here.',
      caveat: HOW_TO_USE_A_CONTROL.important_caveat,
    };
  }
  const fin = /fin/i.test(kase?.assay ?? '') || /fin/i.test(kase?.question ?? '');
  const injection = CONTROLS.find(c => c.id === 'slc24a5');
  const readout = fin ? CONTROLS.find(c => c.id === 'tbx5a') : null;
  return {
    injection_control: injection,
    readout_control: readout,
    why: readout
      ? 'two controls: one proves the injection worked at all, one proves this lab can score the state of a pectoral fin in an injected embryo. A fin experiment needs both, and they fail in different ways.'
      : 'one control, to prove the injection worked. No readout control is proposed because the case\'s assay is not a fin assay and no published control matches it.',
    caveat: HOW_TO_USE_A_CONTROL.important_caveat,
  };
}
