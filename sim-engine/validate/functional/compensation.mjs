// compensation.mjs - when is genetic compensation / transcriptional adaptation EXPECTED, and when is it NOT?
//
// Why a rule table and not a judgement. "It could be compensated" is the single easiest way to make an unresolved
// gap disappear, and it is a hypothesis about an unobserved mechanism, never evidence. Zebrafish is the organism
// in which transcriptional adaptation was characterised, so the conditions under which it happens are published
// and can be applied as a RULE with citations instead of applied by hope. Every condition below comes from a paper
// fetched through Europe PMC in this thread (abstracts read; cached under C:/Temp/functional-cache/epmc/).
//
// The rule is deliberately HARD TO SATISFY, and a satisfied rule still yields a HYPOTHESIS, never a demonstration:
// sim-engine/validate/functional-interface.mjs puts COMPENSATORY in HYPOTHESIS by definition and never sums it
// with demonstrated resolutions.

export const PAPERS = Object.freeze({
  elbrolosy2019: { pmid: '30944477', pmcid: 'PMC6707827', doi: '10.1038/s41586-019-1064-z', year: 2019, journal: 'Nature',
    first_author: 'El-Brolosy MA', title: 'Genetic compensation triggered by mutant mRNA degradation',
    quotes: [
      'by analysing several models of transcriptional adaptation in zebrafish and mouse, we uncover a requirement for mutant mRNA degradation',
      'Alleles that fail to transcribe the mutated gene do not exhibit transcriptional adaptation, and these alleles give rise to more severe phenotypes than alleles displaying mutant mRNA decay',
      'Transcriptome analysis in alleles displaying mutant mRNA decay reveals the upregulation of a substantial proportion of the genes that exhibit sequence similarity with the mutated gene\u2019s mRNA, suggesting a sequence-dependent mechanism',
    ], read: 'abstract' },
  ma2019: { pmid: '30944473', doi: '10.1038/s41586-019-1057-y', year: 2019, journal: 'Nature', first_author: 'Ma Z',
    title: 'PTC-bearing mRNA elicits a genetic compensation response via Upf3a and COMPASS components',
    quotes: [
      'mRNA bearing a premature termination codon (PTC) promptly triggers a GCR that involves Upf3a and components of the COMPASS complex',
      'the GCR is dependent on both the presence of a PTC and the nucleotide sequence of the transgene mRNA, which is homologous to the compensatory endogenous genes',
      'capn3a-null and nid1a-null mutants appear normal [where the corresponding morphants are not]',
    ], read: 'abstract' },
  rossi2015: { pmid: '26168398', doi: '10.1038/nature14580', year: 2015, journal: 'Nature', first_author: 'Rossi A',
    title: 'Genetic compensation induced by deleterious mutations but not gene knockdowns',
    quotes: [
      'egfl7 mutants do not show any obvious phenotype while animals injected with egfl7 morpholino (morphants) exhibit severe vascular defects',
      'Comparing egfl7 mutant and morphant proteomes and transcriptomes, we identify a set of proteins and genes that are upregulated [in the mutant]',
      'induced by deleterious mutations but NOT gene knockdowns (the paper\u2019s own title)',
    ], read: 'abstract' },
  kok2015: { pmid: '25533206', pmcid: 'PMC4487878', doi: '10.1016/j.devcel.2014.11.018', year: 2015, journal: 'Developmental Cell',
    first_author: 'Kok FO', title: 'Reverse genetic screening reveals poor correlation between morpholino-induced and mutant phenotypes in zebrafish',
    quotes: [
      'mutants for ten different genes failed to recapitulate published Morpholino-induced phenotypes',
      'approximately 80% of morphant phenotypes were not observed in mutant embryos',
    ], read: 'abstract' },
  serobyan2023: { pmid: '37384903', pmcid: 'PMC10310345', doi: '10.1371/journal.pgen.1010806', year: 2023, journal: 'PLoS Genetics',
    title: 'Partial sequence identity in a 25-nucleotide long element is sufficient for transcriptional adaptation in the Caenorhabditis elegans act-5/act-3 model',
    quotes: [
      'a 25-base pair (bp) element which exhibits 60% identity with a sequence in the act-5 mRNA and which, in the context of a minimal promoter, is sufficient to induce ectopic expression',
      'The 25 nucleotide (nt) element in the act-5 mRNA lies between the premature termination codon (PTC) and the next exon/exon junction',
    ], read: 'abstract' },
  yeast2026: { pmid: '42626986', pmcid: 'PMC13537020', doi: '10.1093/molbev/msag219', year: 2026, journal: 'Molecular Biology and Evolution',
    title: 'Signatures of nonsense-mediated mRNA decay but no evidence for transcriptional adaptation associated with protein-truncating variants in wild yeast diploids',
    quotes: [
      'despite evidence of this mRNA surveillance activity, we did not detect a clear signature of transcriptional adaptation',
      'our findings suggest that TA is not a universal response to loss-of-function mutations in yeast',
    ], read: 'abstract', role: 'the negative control for the whole mechanism: NMD without transcriptional adaptation' },
});

/** The conditions, each with the paper that establishes it. `required` conditions must ALL hold. */
export const CONDITIONS = Object.freeze([
  { id: 'mutant_mRNA_is_made_and_then_degraded', required: true,
    statement: 'the lesion must leave a mutant mRNA that IS transcribed and then degraded. An allele that fails to transcribe the gene at all shows no transcriptional adaptation and gives a MORE severe phenotype.',
    satisfied_by: ['nonsense (premature termination codon)', 'frameshift producing a PTC'],
    not_satisfied_by: ['missense (no PTC, no decay trigger)', 'in-frame deletion without a PTC', 'full-locus / promoter deletion (no transcript at all)', 'morpholino or other knockdown (no mutant mRNA; Rossi 2015 and Kok 2015 are the whole point)', 'cis-regulatory rearrangement that changes WHERE a wild-type coding sequence is expressed'],
    paper: 'elbrolosy2019' },
  { id: 'a_sequence_similar_gene_exists', required: true,
    statement: 'the compensating ("adapting") gene must share mRNA sequence with the mutated gene: the response is sequence-dependent, and in the one case where the element was mapped, 25 bp at 60 % identity was sufficient.',
    satisfied_by: ['a paralogue with demonstrable mRNA sequence similarity'],
    not_satisfied_by: ['an unrelated gene in the same pathway (that is the ANALOGOUS SET class, not this one)'],
    paper: 'ma2019 + serobyan2023' },
  { id: 'the_adapting_gene_is_expressed_in_the_relevant_context', required: true,
    statement: 'upregulating a gene that is not expressed in the tissue and stage where the function is needed cannot supply the function. This condition is ours, not a paper\u2019s, and is labelled as such: it is a necessary condition for a functional rescue, not a condition on the transcriptional-adaptation mechanism itself.',
    satisfied_by: ['an expression record for the adapting gene in the relevant anatomy (ZFA) and stage (ZFS)'],
    not_satisfied_by: ['no expression record in the relevant context'],
    paper: null, ours: true },
  { id: 'universality_must_not_be_assumed', required: false,
    statement: 'transcriptional adaptation is NOT a universal response to loss of function: in wild yeast diploids, protein-truncating variants show clear NMD and no detectable transcriptional adaptation. So even with every condition met, the response is a possibility, not an expectation.',
    paper: 'yeast2026' },
]);

export const RULE_SUMMARY =
  'COMPENSATORY may be proposed only when (1) the design\'s lesion in the required gene produces a mutant mRNA that '
  + 'is transcribed and then degraded (a PTC or PTC-producing frameshift - NOT a missense, NOT a knockdown, NOT a '
  + 'cis-regulatory rearrangement), (2) a sequence-similar gene exists to be upregulated, and (3) that gene is '
  + 'expressed in the anatomy and stage where the function is needed. All three must hold; a satisfied rule still '
  + 'yields a HYPOTHESIS, because the mechanism is not universal even where its triggers are present.';

/** Classify a lesion for condition 1. Returns {triggers, why, class}. */
export function lesionTriggersDecay(edit) {
  const k = (edit?.kind || '').toLowerCase();
  const raw = (edit?.raw || edit?.edit || '').toString();
  if (k === 'nonsense' || /\*\s*$/.test(raw) || /\bY\d+\*/.test(raw)) return { triggers: true, lesion_class: 'nonsense (PTC)', why: 'a premature termination codon is the trigger El-Brolosy 2019 and Ma 2019 identify', paper: 'elbrolosy2019 + ma2019' };
  if (k === 'frameshift' || /\bfs\b/i.test(raw)) return { triggers: true, lesion_class: 'frameshift (likely PTC)', why: 'a frameshift usually produces a downstream PTC; whether it does for THIS allele is not checked here, so the trigger is probable rather than established', paper: 'elbrolosy2019' };
  if (k === 'knockout') return { triggers: null, lesion_class: 'knockout, molecular nature unspecified', why: 'a "knockout" can be a PTC allele (decay, adaptation possible) or a whole-locus deletion (no transcript, NO adaptation, more severe phenotype). The design does not say which, so the rule cannot be applied either way', paper: 'elbrolosy2019' };
  if (k === 'missense') return { triggers: false, lesion_class: 'missense', why: 'no premature termination codon, so no mutant-mRNA decay and no documented trigger for transcriptional adaptation', paper: 'elbrolosy2019' };
  if (k === 'regulatory' || /inversion|enhancer|cis-regulatory|transgene/i.test(raw)) return { triggers: false, lesion_class: 'cis-regulatory rearrangement', why: 'the coding sequence is intact and the transcript is not degraded; the effect is where and how much the wild-type protein is made. No decay trigger, so no transcriptional adaptation', paper: 'elbrolosy2019' };
  if (k === 'expression') return { triggers: false, lesion_class: 'expression change (knockdown or overexpression)', why: 'Rossi 2015 and Kok 2015: knockdowns do NOT induce compensation - that discrepancy is the observation the whole field is built on', paper: 'rossi2015 + kok2015' };
  return { triggers: null, lesion_class: k || 'unknown', why: 'the lesion type is not one the rule covers, so the rule is not applied', paper: null };
}

/** Apply the rule. `candidate` = {requirementGene, lesion (an edit on that gene, or null), similarGene, expression}.
 *  Returns {applies, hypothesis, evidence[], refusal}. It REFUSES far more often than it applies, by design. */
export function compensationApplies({ requirementGene, lesion = null, similarGene = null, expression = null } = {}) {
  const evidence = [];
  const cite = id => { const p = PAPERS[id]; return p ? `${p.first_author || p.title.slice(0, 40)} ${p.year}, ${p.journal}, PMID ${p.pmid}${p.doi ? `, doi ${p.doi}` : ''}` : id; };
  if (!lesion) {
    return { applies: false, hypothesis: false,
      refusal: `no lesion: the design does not touch ${requirementGene}, so there is no mutant mRNA to be degraded and condition 1 of the rule cannot be met. An UNMET requirement at an UNEDITED locus is not a candidate for transcriptional adaptation at all - that mechanism answers "what happens when you break gene X", not "what happens when gene X was never given the analogue's state".`,
      evidence: [{ claim: CONDITIONS[0].statement, source: cite('elbrolosy2019'), kind: 'curated' }] };
  }
  const t = lesionTriggersDecay(lesion);
  evidence.push({ claim: `the design's lesion in ${requirementGene} is ${t.lesion_class}: ${t.why}`, source: t.paper ? t.paper.split(' + ').map(cite).join('; ') : 'functional/compensation.mjs lesionTriggersDecay', kind: 'curated' });
  if (t.triggers !== true) {
    return { applies: false, hypothesis: false, evidence,
      refusal: t.triggers === false
        ? `condition 1 FAILS: ${t.lesion_class} produces no mutant-mRNA decay, so transcriptional adaptation is not expected. This is the published rule applied, not a judgement about this gene.`
        : `condition 1 CANNOT BE DECIDED: ${t.why}. The class is refused rather than granted on a maybe.` };
  }
  if (!similarGene) {
    return { applies: false, hypothesis: false, evidence,
      refusal: 'condition 2 FAILS: no sequence-similar gene was found to be upregulated. The response is sequence-dependent (Ma 2019; Serobyan 2023 mapped it to a 25 bp element at 60 % identity), so without one there is nothing for the mechanism to act on.' };
  }
  evidence.push({ claim: `a sequence-similar candidate exists: ${similarGene.symbol}${similarGene.similarity ? ` (${similarGene.similarity})` : ''}`, source: similarGene.source || 'omics/genomic paralog rows', kind: similarGene.kind || 'inferred-electronic' });
  if (!expression) {
    return { applies: false, hypothesis: false, evidence,
      refusal: `condition 3 FAILS: no expression record places ${similarGene.symbol} in the anatomy and stage where the function is needed, so upregulating it could not supply the function even if the mechanism fired.` };
  }
  evidence.push({ claim: `${similarGene.symbol} is expressed in ${expression.anatomy || 'the relevant anatomy'}${expression.stage ? ` at ${expression.stage}` : ''}`, source: expression.source, kind: expression.kind || 'curated' });
  evidence.push({ claim: 'transcriptional adaptation is not universal even where its triggers are present (NMD without detectable adaptation in wild yeast diploids), so this remains a hypothesis', source: cite('yeast2026'), kind: 'curated' });
  return { applies: true, hypothesis: true, evidence,
    refusal: null,
    statement: `all three conditions hold, so transcriptional adaptation of ${similarGene.symbol} is a LIVE HYPOTHESIS for the lesion in ${requirementGene}. It is not an observation: no experiment in our sources shows it happening for this gene pair.` };
}
