// designs.mjs - what the DESIGN actually is, at the genotype level, with the source for every edit.
//
// The repository's organism documents (sim-engine/validate/data, loadBundle) carry PARAMETERS, not gene edits: the
// winged zebrafish there is a pectoral-fin proportion, not a genotype. The genotype of each named design is
// recorded elsewhere in the repository, so this file points at that record rather than inventing one, and SAYS
// which it used. A caller-supplied document whose `edits`/`genotype` arrays are populated always wins: then the
// genotype comes from the document through validate/genotype.mjs geneEdits(), which is the shared parser.
//
// Nothing here is a phenotype claim. An edit is a sequence STATE (see validate/genotype.mjs STATE_NOT_PHENOTYPE).

const DAANE = 'Daane et al. 2021, Curr Biol, doi 10.1016/j.cub.2021.08.054, PMID 34534441';

/** Documented genotypes, keyed by repository organism id. */
export const DOCUMENTED = {
  'winged-zebrafish': {
    label: 'the "winged zebrafish": the germline double heterozygote Daane et al. 2021 built and described as phenocopying the flying-fish bauplan',
    source: 'sequences/engineered-diff.json winged_zebrafish (from genotype/compare-2x2.json panel B and genotype/interventions.json kcnh2a-lof-x-lat4a-nr21-double-het)',
    kind: 'curated',
    not_ours: `the design is NOT ours: ${DAANE} built this animal. design-validation/REPORT.md states this plainly, and it bears on every claim made about it here.`,
    edits: [
      { gene: 'slc43a2a', aliases: ['lat4a'], kind: 'missense', ref: 'T', pos: 200, alt: 'K', raw: 'p.T200K', zygosity: 'heterozygous',
        allele: 'lat4a nr21 / ZFIN slc43a2a dmh26', nt_changes: null,
        source: `sequences/engineered-diff.json winged_zebrafish.protein_effects[0]; ${DAANE}`, kind_of_evidence: 'curated',
        note: 'a coding missense: 1 amino acid changed, 99.82 % identity to the unedited reference, whole protein retained' },
      { gene: 'kcnh2a', aliases: ['longfin', 'dt2'], kind: 'regulatory', raw: 'cis-regulatory inversion placing prrx1a regulatory sequence upstream of kcnh2a', zygosity: 'heterozygous',
        allele: 'longfin dt2', ref: null, pos: null, alt: null,
        source: `sequences/engineered-diff.json winged_zebrafish.kinds[1]; ${DAANE}; genotype/interventions.json`, kind_of_evidence: 'curated',
        note: 'coding sequence UNCHANGED, 0 amino acids changed; the effect is ectopic expression of a wild-type channel' },
    ],
  },
  tff: {
    label: 'TFF v2 - the HYPOTHETICAL truly flying fish. Its "genotype" is a list of edits one could name, not a design that would fly.',
    source: 'sequences/engineered-diff.json hypothetical_flier (from genotype/flier-genome.json item 1 candidate routes)',
    kind: 'assumed',
    status_caveat: 'genotype/flier-genome.json: "No requirement has a route that reaches it; this list is the edits one could name, not a design that would fly." HYPOTHESIS THROUGHOUT.',
    edits: [
      { gene: 'hhip', kind: 'nonsense', ref: 'Y', pos: 295, alt: '*', raw: 'p.Y295*', zygosity: null, allele: 'hhip uki hu418B',
        source: 'sequences/engineered-diff.json hypothetical_flier.protein_effects[0]', kind_of_evidence: 'curated',
        note: 'loss of function; largest measured pectoral fin area increase (+65 %); only 42.4 % of the reference protein retained' },
      { gene: 'kcnk5b', kind: 'missense', ref: 'W', pos: 169, alt: 'L', raw: 'p.W169L', zygosity: null, allele: 'alf (another longfin)',
        source: 'sequences/engineered-diff.json hypothetical_flier.protein_effects[1]', kind_of_evidence: 'curated', note: 'hyperactive channel' },
      { gene: 'gja1b', kind: 'missense', ref: 'T', pos: 154, alt: 'A', raw: 'p.T154A', zygosity: null, allele: 'Cx43 T154A dominant negative',
        source: 'sequences/engineered-diff.json hypothetical_flier.protein_effects[2]', kind_of_evidence: 'curated',
        note: 'delivered as a TRANSGENE in the source, not as an edit of the locus: treating it as a locus edit is already a departure from what was done' },
      { gene: 'slc43a2a', aliases: ['lat4a'], kind: 'missense', ref: 'F', pos: 326, alt: 'L', raw: 'p.F326L', zygosity: null, allele: null,
        source: 'sequences/engineered-diff.json hypothetical_flier.protein_effects[3]', kind_of_evidence: 'assumed',
        note: 'the flying-fish/gliding-halfbeak residue placed into zebrafish. HYPOTHETICAL: never engineered or tested in any species' },
    ],
  },
  'ff-zf-chimera': {
    label: '0.5 flying fish / 0.5 zebrafish MORPHOLOGICAL blend (a two-parent test case)',
    source: 'sim-engine organism document: parents [{flying-fish, 0.5}, {zebrafish-adult, 0.5}]; parameters are weighted blends, all of kind "assumed"',
    kind: 'assumed', edits: [],
    no_genotype_note:
      'This design has NO genotype. It is a weighted average of two parents\' SHAPE parameters. There is no such thing '
      + 'as a 50:50 blended genome, and nothing in the document says which alleles the chimera carries, so no locus-level '
      + 'difference from the analogue can be computed for it at all. That is a property of the design, not a gap in the data.',
  },
  'wingless-flying-fish': {
    label: 'wingless flying fish - a real flying fish with the pectoral fin proportion put at the halfbeak value (0.140)',
    source: 'sim-engine organism document: parent flying-fish, pectoral_len_over_SL 0.14 (halfbeak group median, Daane sheet A), kind "hypothetical"',
    kind: 'assumed', edits: [],
    direction: 'SUBTRACTION',
    no_genotype_note:
      'A SUBTRACTION design with no genotype: the function is removed by changing one shape parameter, not by changing a '
      + 'locus. Its genome is the flying fish\'s.',
  },
  'flying-fish': { label: 'the real flying fish (Exocoetidae), generic', source: 'sim-engine organism document (reference organism)', kind: 'measured', edits: [], is_the_analogue: true },
  'zebrafish-adult': { label: 'the real adult zebrafish, unedited', source: 'sim-engine organism document (reference organism)', kind: 'measured', edits: [], negative_control: true },
  'zebrafish-larva': { label: 'the real zebrafish larva, unedited', source: 'sim-engine organism document (reference organism)', kind: 'measured', edits: [] },
};

/** Which reference genome the design's sequence actually comes from. The ledger needs this, because the design's
 *  state at an unedited locus IS its base's state - and that is a different answer for a zebrafish-based design, a
 *  flying-fish-based design, and a design with no genome at all. */
export const BASE_GENOME = {
  'zebrafish-adult': { kind: 'danio_reference', species: 'Danio rerio', assembly: 'GRCz11', source: 'sim-engine organism document (reference organism)' },
  'zebrafish-larva': { kind: 'danio_reference', species: 'Danio rerio', assembly: 'GRCz11', source: 'sim-engine organism document (reference organism)' },
  'winged-zebrafish': { kind: 'danio_reference', species: 'Danio rerio', assembly: 'GRCz11', source: 'the design is the zebrafish reference plus 2 edited loci (sequences/engineered-diff.json: "Not a full genome. It is a short list of edits to the zebrafish reference (GRCz11)")' },
  'flying-fish': { kind: 'analogue', species: 'Exocoetidae (Hirundichthys speculiger for sequence)', assembly: 'GCA_018398805.1', source: 'sim-engine organism document (reference organism); the analogue itself' },
  tff: { kind: 'analogue', species: 'Exocoetidae', assembly: 'GCA_018398805.1', source: 'sim-engine organism document: parent flying-fish at weight 1',
    incoherence_note: "the TFF's parent is the flying fish, but the four edits recorded for it are ZEBRAFISH alleles (hhip uki hu418B, kcnk5b alf, Cx43 T154A transgene) with zebrafish coordinates. The record is internally inconsistent about which genome is being edited, and that inconsistency is reported rather than resolved here." },
  'wingless-flying-fish': { kind: 'analogue', species: 'Exocoetidae', assembly: 'GCA_018398805.1', source: 'sim-engine organism document: parent flying-fish at weight 1' },
  'ff-zf-chimera': { kind: 'undefined', species: null, source: 'sim-engine organism document: parents [{flying-fish, 0.5}, {zebrafish-adult, 0.5}]',
    why: 'a 50:50 WEIGHTED AVERAGE OF SHAPE PARAMETERS is not a genome. The document does not say which allele the chimera carries at any locus, and there is no coherent way to average two genomes, so the design side of every locus-level requirement is unreadable. That is a property of the design, not a gap in the data.' },
};
export function baseGenome(design) {
  const id = typeof design === 'string' ? design : (design?.organism && typeof design.organism === 'string' ? design.organism : design?.doc?.id || design?.id || null);
  if (id && BASE_GENOME[id]) return { id, ...BASE_GENOME[id] };
  if (design && typeof design === 'object' && 'specimen' in design) return { id: null, kind: 'undefined', species: null, why: 'a specimen record is a set of body measurements and carries no genome at all' };
  return { id, kind: 'undefined', species: null, why: `no base genome is recorded for "${id}" in designs.mjs BASE_GENOME, and none is assumed` };
}

const ALIAS_TO_SYMBOL = { lat4a: 'slc43a2a', lat4b: 'slc43a2b', longfin: 'kcnh2a', cx43: 'gja1b', prdm1: 'prdm1a' };
export const canonicalSymbol = s => (s ? (ALIAS_TO_SYMBOL[String(s).toLowerCase()] || String(s).toLowerCase()) : s);

/** The design's genotype. Document edits win; otherwise the documented record; otherwise an explicit "unknown". */
export async function genotypeOf(design) {
  const id = typeof design === 'string' ? design
    : design?.organism && typeof design.organism === 'string' ? design.organism
      : design?.doc?.id || design?.id || null;
  const doc = design?.doc || (design && typeof design === 'object' && (design.edits || design.genotype) ? design : null);
  if (doc && ((doc.edits || []).length || (doc.genotype || []).length)) {
    const { geneEdits } = await import('../genotype.mjs');
    const edits = geneEdits(doc).map(e => ({ ...e, gene: canonicalSymbol(e.gene), source: `the design document (${e.source})`, kind_of_evidence: 'assumed' }));
    return { id, label: `caller-supplied design document${id ? ` (${id})` : ''}`, source: 'the design document, parsed by sim-engine/validate/genotype.mjs geneEdits()', provenance: 'document', edits, kind: 'assumed' };
  }
  if (id && DOCUMENTED[id]) {
    const d = DOCUMENTED[id];
    return { id, ...d, provenance: 'repository record', edits: d.edits.map(e => ({ ...e, gene: canonicalSymbol(e.gene) })) };
  }
  if (design && typeof design === 'object' && 'specimen' in design) {
    return { id: null, label: design.label || 'a specimen record', provenance: 'none', edits: [], kind: 'measured',
      no_genotype_note: 'a specimen record is a set of body measurements: it carries no genotype, so no locus-level difference from the analogue can be computed.' };
  }
  return { id, label: id || 'unknown design', provenance: 'none', edits: [], kind: 'assumed',
    no_genotype_note: `no genotype is recorded for "${id}" in the design document or in designs.mjs DOCUMENTED, and none is guessed. Every requirement is therefore unassessable on the design side.` };
}
