// outreach/fish-biologists.mjs
//
// Candidate lab-in-the-loop partners for DELPHI's organism-design work on zebrafish
// morphology, development and CRISPR validation.
//
// WHAT THIS FILE IS
//   A research dossier on real scientists, built ONLY from the public professional record:
//   peer-reviewed papers, public preprints, institutional lab/faculty pages, and public
//   project pages. Nothing here is private, inferred about a person, or scraped from
//   anything that is not a public professional page.
//
// PRIVACY RULES THIS FILE OBEYS
//   - No contact details of any kind. No email addresses, no telephone numbers, no room
//     or building numbers, no personal social handles. `lab_url` is a public lab or
//     institutional faculty page and nothing else.
//   - Nothing personal: no nationality, age, family, health, politics or employment
//     grievances. Not recorded, not inferred, not implied.
//   - Every interest attributed to a person is either (a) something they publicly wrote
//     or published, with the source given, or (b) explicitly marked `inferred` as OUR
//     reading of their publication record. An inference is never written as their intent.
//   - `real_quotes` are VERBATIM. Each one was copied character-for-character from the
//     abstract of the cited work as served by the source named in `doi_or_url`. Where a
//     sentence could not be verified word-for-word it was DROPPED rather than paraphrased
//     into quotation marks. An empty `real_quotes` array is a correct answer.
//
// ATTRIBUTION (required by the PubMed MCP terms of use)
//   Article metadata in this file — titles, journals, years, author lists, PMIDs, DOIs and
//   the abstract text quoted in `real_quotes` — was retrieved from PubMed (NCBI/NLM) via
//   the PubMed MCP server, except where `verified_via` says Crossref. Every article cited
//   carries its DOI; the resolvable link for any entry is `https://doi.org/<doi>`.
//
// HOLDOUT
//   One clade is a frozen evaluation holdout for this project and is named nowhere in this
//   file — not in a taxon name, not in a trait word, not in a listed research interest.
//   Candidates whose record touches it are described by the work that is relevant to us.
//   Gate: `node holdout/check-leaks.mjs outreach` must report 0 leaks and 0 warnings.

/** How every DOI in this file was checked. */
export const DOI_VERIFICATION = Object.freeze({
  checked_on: '2026-11-06',
  methods: Object.freeze([
    'PubMed (NCBI E-utilities, via the PubMed MCP server): each PMID was fetched and the ' +
      'returned identifiers.doi, title, journal, year and author list were copied into this ' +
      'file rather than typed from memory.',
    'Crossref REST: GET https://api.crossref.org/works/{doi} for every DOI not covered by a ' +
      'PubMed record. HTTP 200 plus a matching title, container-title, year and author family ' +
      'name was required to accept it.',
  ]),
  result:
    'Every DOI in flagship_papers resolved: 42 entries, 41 distinct DOIs (one paper is a ' +
    'flagship for two candidates). Nothing unresolved was kept.',
  rejected: Object.freeze([
    '10.1016/j.celrep.2018.08.009 — a guessed DOI for a notochord-segmentation paper. ' +
      'Crossref resolved it to an unrelated virology paper, so it was discarded and the ' +
      'correct record (10.1016/j.devcel.2024.04.013) was retrieved from PubMed instead.',
    '10.1111/joa.12508 — resolved, but the Crossref author list does not include the ' +
      'candidate it was intended to support, so it was not used.',
  ]),
});

export const CANDIDATES = [
  // ---------------------------------------------------------------------------- 1
  {
    id: 'jacob-daane',
    name: 'Jacob M. Daane',
    institution: 'University of Houston, Department of Biology and Biochemistry',
    lab_url: 'https://www.daanelab.org/',
    field:
      'Comparative and functional genomics of fish form; evolution of relative size and ' +
      'proportion in paired fins; phylogenomics of teleost skeletal traits.',
    why_relevant_to_delphi:
      'He is the closest match in the field to the exact quantity our fin-ratio programme is ' +
      'built on. The pectoral-fin allometry in development/allometry.json is a log-log fit WE ' +
      'computed over 49 specimen rows from his 2021 Data S1A (b = 1.058 +/- 0.020 SE, ' +
      'r2 = 0.983), and the two loci his paper puts at the centre of fin proportion — lat4a ' +
      'and kcnh2a — are two of the three genes our winged-zebrafish design edits. Our ' +
      'genotype thread independently settled lat4a = slc43a2a against his annotation. He is ' +
      'therefore the one person who can say whether our re-fit of his data is a legitimate use ' +
      'of it, and whether the design we built on top of it asks a question he has not already ' +
      'answered. Separately, his record of intersecting a phylogenomic signal with a mutant ' +
      'screen is the closest existing instance of the loop we are trying to close.',
    flagship_papers: [
      {
        title: 'Modulation of bioelectric cues in the evolution of flying fishes',
        year: 2021,
        journal: 'Current Biology',
        doi: '10.1016/j.cub.2021.08.054',
        pmid: '34534441',
        why_it_matters:
          'Supplies both the specimen measurements our fin-ratio fit is computed from and the ' +
          'two loci our design edits, in one paper.',
      },
      {
        title: 'Historical contingency shapes adaptive radiation in Antarctic fishes',
        year: 2019,
        journal: 'Nature Ecology & Evolution',
        doi: '10.1038/s41559-019-0914-2',
        pmid: '31182814',
        why_it_matters:
          'Shows the method we would be buying into: a genome-scale comparative signal tested ' +
          'by making the predicted change in zebrafish.',
      },
      {
        title:
          'Genetic Screen for Postembryonic Development in the Zebrafish: Dominant Mutations ' +
          'Affecting Adult Form',
        year: 2017,
        journal: 'Genetics',
        doi: '10.1534/genetics.117.300187',
        pmid: '28835471',
        why_it_matters:
          '72 adult-viable mutants of adult shape — the empirical answer to "which body ' +
          'proportions are even reachable by single mutations", which our design layer assumes ' +
          'rather than knows.',
      },
      {
        title:
          'The origin and evolution of dorsal determination mechanisms in vertebrate paired ' +
          'appendages',
        year: 2026,
        journal: 'Current Biology',
        doi: '10.1016/j.cub.2026.05.046',
        pmid: '42320467',
        why_it_matters:
          'A current, 13-author, multi-country fin-patterning paper — evidence the relevant work ' +
          'is live and already runs as a consortium.',
      },
    ],
    key_figures_or_findings: [
      'Phylogenomic analysis across 35 species of flying fishes and relatives recovered coding ' +
        'and regulatory signatures of convergently enlarged paired fins (Curr Biol 2021, ' +
        'doi 10.1016/j.cub.2021.08.054, via PubMed).',
      'lat4a (an L-type amino acid transporter) and kcnh2a (a potassium channel) regulate fin ' +
        'proportion in zebrafish, and their interaction phenocopies flying-fish fin proportions ' +
        '(same paper).',
      'Antarctic notothenioid study: targeted sequencing of >250,000 loci across 46 species; ' +
        'altered trip11, col1a2 and col1a1a function in zebrafish phenocopies the skeletal ' +
        'reduction (Nat Ecol Evol 2019, doi 10.1038/s41559-019-0914-2, via PubMed).',
      'Adult dominant screen: 72 adult-viable mutants, linked mutations identified for 22 of 25 ' +
        'mutants analysed (Genetics 2017, doi 10.1534/genetics.117.300187, via PubMed).',
    ],
    real_quotes: [
      {
        quote:
          'Changes to allometry, or the relative proportions of organs and tissues within ' +
          'organisms, is a common means for adaptive character change in evolution. However, ' +
          'little is understood about how relative size is specified during development and ' +
          'shaped during evolution.',
        source_title: 'Modulation of bioelectric cues in the evolution of flying fishes',
        doi_or_url: 'https://doi.org/10.1016/j.cub.2021.08.054',
        context:
          'Opening sentences of the published abstract (PubMed record for PMID 34534441). This ' +
          'is the gap statement our fin-ratio programme is aimed at, in his words rather than ours.',
      },
      {
        quote:
          'We show that interaction between these genetic loci in zebrafish closely phenocopies ' +
          'the observed fin proportions of flying fishes.',
        source_title: 'Modulation of bioelectric cues in the evolution of flying fishes',
        doi_or_url: 'https://doi.org/10.1016/j.cub.2021.08.054',
        context:
          'From the same abstract. The existence of this result is also the main reason a naive ' +
          'version of our proposal is already done.',
      },
    ],
    public_record: [
      'Runs the Daane Lab at the University of Houston; the lab page carries the tagline ' +
        '"Evolutionary and developmental genetics @ University of Houston" ' +
        '(https://www.daanelab.org/).',
      'The lab page posted "New funding from NSF!" on 1 Aug 2024 (no amount or award number is ' +
        'given on the page, and none is asserted here).',
      'Senior/corresponding author on the 2019 Nature Ecology & Evolution notothenioid paper and ' +
        'first author on the 2021 Current Biology flying-fish paper.',
    ],
    collaboration_angle:
      'The natural ask is small and concrete: a read on whether our re-fit of his published ' +
      'specimen measurements is sound, and whether the fin-proportion prediction our model makes ' +
      'is distinguishable from what his lat4a x kcnh2a double already shows. If it is, the bench ' +
      'arm is one he is already equipped for. WE would have to bring: the full derivation of the ' +
      'allometric fit with its residuals and the alternative linear fit, the explicit statement ' +
      'of which of our numbers are measured versus assumed (the .organism file does this ' +
      'mechanically), and the negative results below stated up front — in particular that our ' +
      'guide ranking is uninformative, which means WE cannot promise him a good guide and should ' +
      'not pretend otherwise.',
    openness_evidence: [
      {
        claim:
          'Publishes the per-specimen measurements behind the fin allometry as supplementary ' +
          'data (Data S1A), which is how we were able to re-fit it at all.',
        basis: 'stated',
        source: 'https://doi.org/10.1016/j.cub.2021.08.054',
      },
      {
        claim:
          'Works in large multi-institution teams: the 2026 Current Biology paper has 13 authors ' +
          'across the US, Spain and Slovakia.',
        basis: 'stated',
        source: 'https://doi.org/10.1016/j.cub.2026.05.046',
      },
      {
        claim:
          'Comfortable moving between comparative genomics and a zebrafish bench test in the ' +
          'same study, which is structurally what a lab-in-the-loop partnership is.',
        basis: 'inferred',
        source:
          'Our reading of the design of doi 10.1038/s41559-019-0914-2 and ' +
          'doi 10.1016/j.cub.2021.08.054. He has not said he wants external computational partners.',
      },
    ],
    caution:
      'He may have the least to gain of anyone on this list, because he has already done the ' +
      'experiment our design is pointed at. The honest framing is that we are asking for ' +
      'correction of our use of his data, not offering him a discovery. There is also a real ' +
      'chance the first answer is "your fit is fine and the prediction is already published", ' +
      'which would end the collaboration at one email and should be accepted gracefully. ' +
      'Finally, a new-ish lab is the worst place to spend four months of tank space on someone ' +
      "else's untested prediction.",
  },

  // ---------------------------------------------------------------------------- 2
  {
    id: 'matthew-harris',
    name: 'Matthew P. Harris',
    institution:
      "Boston Children's Hospital (Orthopaedic Research Laboratories) and Harvard Medical " +
      'School, Department of Genetics',
    lab_url: 'https://research.childrenshospital.org/research-units/fishbone-lab',
    field:
      'Genetics of adult/postembryonic skeletal form in fishes; size, shape and proportion ' +
      'regulation; forward genetics on adult phenotypes; fin-to-limb comparative development.',
    why_relevant_to_delphi:
      'Our whole fin-size programme sits inside the literature his lab built. kcnk5b — the gene ' +
      'our top-ranked bench case overexpresses, with the W169L allele our structures thread ' +
      'modelled — comes from his 2014 paper, and the key uncomfortable fact in our bench brief ' +
      'is from that lineage too: in this programme loss of function does not change fin size, so ' +
      'only precise gain-of-function changes are informative. That single constraint is what ' +
      'turned our plan from a knockout into an overexpression experiment. His 2021 Cell paper is ' +
      'also the sharpest existing counter-example to our morphology scorer: zebrafish carrying ' +
      'supernumerary long bones in the pectoral fin are animals whose trait vector our scorer has ' +
      'never seen and would have no basis to rank.',
    flagship_papers: [
      {
        title: 'Bioelectric signaling regulates size in zebrafish fins',
        year: 2014,
        journal: 'PLoS Genetics',
        doi: '10.1371/journal.pgen.1004080',
        pmid: '24453984',
        why_it_matters:
          'The source of kcnk5b, of the gain-of-function logic our bench case inherits, and of ' +
          'the somatic-transgenesis design our proposal copies.',
      },
      {
        title: 'Latent developmental potential to form limb-like skeletal structures in zebrafish',
        year: 2021,
        journal: 'Cell',
        doi: '10.1016/j.cell.2021.01.003',
        pmid: '33545089',
        why_it_matters:
          'Demonstrates reachable fin anatomies that are outside any trait distribution we have ' +
          'fitted — i.e. the exact region where our plausibility scorer is blind.',
      },
      {
        title:
          'Zebrafish eda and edar mutants reveal conserved and ancestral roles of ectodysplasin ' +
          'signaling in vertebrates',
        year: 2008,
        journal: 'PLoS Genetics',
        doi: '10.1371/journal.pgen.1000206',
        pmid: '18833299',
        why_it_matters:
          'Establishes dose-sensitive, organ-specific responses and buffering of adult skeletal ' +
          'phenotypes — a direct warning that a single predicted ratio may not be robust to ' +
          'genetic background.',
      },
      {
        title: 'Modulation of bioelectric cues in the evolution of flying fishes',
        year: 2021,
        journal: 'Current Biology',
        doi: '10.1016/j.cub.2021.08.054',
        pmid: '34534441',
        why_it_matters:
          'Senior author on the paper our fin-ratio fit is computed from.',
      },
    ],
    key_figures_or_findings: [
      'alf mutants carry gain-of-function mutations in kcnk5b, a two-pore-domain potassium ' +
        'channel; the mutations raise K+ conductance and hyperpolarise the cell, and the channel ' +
        'must be able to conduct K+ to enlarge fins and barbels (PLoS Genet 2014, ' +
        'doi 10.1371/journal.pgen.1004080, via PubMed).',
      'kcnk5b acts locally within the mesenchyme of fins and barbels — which is why our bench ' +
        'case scores overgrowth against marker-positive mesenchyme in the same fin rather than ' +
        'against injection status (same paper).',
      'Activating mutations in vav2 and waslb produce supernumerary long bones in the pectoral ' +
        'fin that integrate into musculature and form joints; the phenotype requires Hox11 ' +
        'function (Cell 2021, doi 10.1016/j.cell.2021.01.003, via PubMed).',
      'eda/edar loss affects fin rays, scales and pharyngeal teeth but not early development, ' +
        'with substantial buffering across genetic backgrounds (PLoS Genet 2008, ' +
        'doi 10.1371/journal.pgen.1000206, via PubMed).',
    ],
    real_quotes: [
      {
        quote:
          'The scaling relationship between the size of an appendage or organ and that of the ' +
          'body as a whole is tightly regulated during animal development.',
        source_title: 'Bioelectric signaling regulates size in zebrafish fins',
        doi_or_url: 'https://doi.org/10.1371/journal.pgen.1004080',
        context:
          'First sentence of the published abstract (PubMed record for PMID 24453984). It is the ' +
          'premise our fin-ratio traits assume without testing.',
      },
      {
        quote:
          'Our findings reveal a latent, limb-like pattern ability in fins that is activated by ' +
          'simple genetic perturbation.',
        source_title:
          'Latent developmental potential to form limb-like skeletal structures in zebrafish',
        doi_or_url: 'https://doi.org/10.1016/j.cell.2021.01.003',
        context:
          'Closing sentence of the published abstract (PubMed record for PMID 33545089). We cite ' +
          'it as the clearest published evidence that reachable fin morphologies extend outside ' +
          'the cloud our scorer was fitted to.',
      },
    ],
    public_record: [
      'Runs the Harris Laboratory ("Fishbone Lab") in the Orthopaedic Research Laboratories at ' +
        "Boston Children's Hospital, part of the Genetics Department at Harvard Medical School " +
        '(https://research.childrenshospital.org/research-units/fishbone-lab).',
      'The lab page states it uses forward genetics in fishes to find variants regulating adult ' +
        'form, and runs comparative genomic and embryological studies in other fish species.',
      'Corresponding author on the 2014 PLoS Genetics, 2021 Cell, 2021 Current Biology and 2026 ' +
        'Current Biology papers above.',
    ],
    collaboration_angle:
      'Two distinct asks, and they should not be mixed. (1) A sanity read on our top-ranked ' +
      'bench package before anyone orders anything — it is built directly on his 2014 design, ' +
      'including the DsRed-only and non-conductive GFG->AAA controls, and the missing piece we ' +
      'already know about is a positive control for transposition in the host facility. (2) The ' +
      'more interesting one: his vav2/waslb fish are a ready-made adversarial test set for our ' +
      'morphology scorer. If we can score his published supernumerary-bone animals and the ' +
      'scorer calls them typical, that is a result for us and costs him nothing but permission ' +
      'and a measurement protocol. WE would have to bring: the full package with its stop rules ' +
      'and traps list, the per-animal return format, and an explicit statement that the guide ' +
      'ranking we would otherwise hand him is worthless on zebrafish.',
    openness_evidence: [
      {
        claim:
          'Released a community resource of 63 stable Gal4 enhancer-trap transgenic lines ' +
          'explicitly framed as "a useful resource for the zebrafish community".',
        basis: 'stated',
        source: 'https://doi.org/10.1089/zeb.2012.0775',
      },
      {
        claim:
          'The lab page states its position allows productive interaction with clinical ' +
          'researchers at the hospital; it names no external computational collaborators.',
        basis: 'stated',
        source: 'https://research.childrenshospital.org/research-units/fishbone-lab',
      },
      {
        claim:
          'Routinely co-authors across institutions and countries (Tubingen, Washington ' +
          'University, Toronto, Lehigh, Wheaton, Santander, Seville, Bratislava across the papers ' +
          'above), so an external partner is structurally normal for this lab.',
        basis: 'inferred',
        source:
          'Our reading of the author affiliation lists on the four flagship papers, retrieved ' +
          'from PubMed. He has not stated an interest in external computational partners.',
      },
    ],
    caution:
      'He is the originator of the biology we are proposing to re-test, which cuts both ways: ' +
      'high relevance, but also the highest chance that our prediction is either already known ' +
      'to him or already known to be wrong. A clinically embedded lab has no obvious use for a ' +
      'computational plausibility score, and our strongest current offer to him is a list of our ' +
      'own failures. The 2014 construct is also not in a public repository, so one branch of our ' +
      'own plan is effectively a request for a reagent from the Tubingen authors, which is a ' +
      'favour, not a collaboration — asking for both at once would be too much.',
  },

  // ---------------------------------------------------------------------------- 3
  {
    id: 'miguel-moreno-mateos',
    name: 'Miguel A. Moreno-Mateos',
    institution:
      'Andalusian Centre for Developmental Biology (CABD), Pablo de Olavide University / CSIC / ' +
      'Junta de Andalucia, Seville, and Department of Molecular Biology and Biochemical ' +
      'Engineering, Pablo de Olavide University',
    lab_url: 'https://investiga.upo.es/investigadores/160221/detalle?lang=en',
    field:
      'In vivo CRISPR-Cas methodology in fish embryos: guide-activity determinants and ' +
      'prediction, alternative nucleases and PAM-relaxed variants, RNA targeting, ' +
      'homology-directed repair.',
    why_relevant_to_delphi:
      'Our CRISPR guide-ranking benchmark is literally built on his data. The 499 sgRNAs with ' +
      'measured mutagenesis in injected zebrafish embryos are from the CRISPRscan paper he first ' +
      '-authored; we located 307 of them uniquely in GRCz11 and scored three models against the ' +
      'measured activity. The result is that the score our design pipeline ranks guides by ' +
      '(Doench 2014 Rule Set 1) comes out at rho = -0.037, CI [-0.149, 0.073], and our own ' +
      'heuristic at 0.082, CI [-0.024, 0.196] — both straddling zero — while his CRISPRscan ' +
      'reaches 0.269, CI [0.165, 0.364]. We state openly that 0.269 is an upper bound rather ' +
      'than an estimate, because it is being scored on the study that fitted it. The obvious next ' +
      'piece of work is an INDEPENDENT zebrafish activity set, and he is the person most likely ' +
      'to know whether one exists or could be generated cheaply.',
    flagship_papers: [
      {
        title: 'CRISPRscan: designing highly efficient sgRNAs for CRISPR-Cas9 targeting in vivo',
        year: 2015,
        journal: 'Nature Methods',
        doi: '10.1038/nmeth.3543',
        pmid: '26322839',
        why_it_matters:
          'Both the ground truth and the only model that beat chance in our benchmark; its ' +
          'Supplementary Table 3 is the coefficient set we reimplemented and verified.',
      },
      {
        title: 'CRISPR-Cpf1 mediates efficient homology-directed repair and temperature-controlled genome editing',
        year: 2017,
        journal: 'Nature Communications',
        doi: '10.1038/s41467-017-01836-2',
        pmid: '29222508',
        why_it_matters:
          'Shows editing efficiency in fish is temperature-dependent — a covariate our ' +
          'guide-ranking benchmark does not model at all.',
      },
      {
        title: 'CRISPR-Cas13d Induces Efficient mRNA Knockdown in Animal Embryos',
        year: 2020,
        journal: 'Developmental Cell',
        doi: '10.1016/j.devcel.2020.07.013',
        pmid: '32768421',
        why_it_matters:
          'A knockdown route that sidesteps the gain-of-function constraint blocking several of ' +
          'our fin cases.',
      },
      {
        title: 'Genome editing in animals with minimal PAM CRISPR-Cas9 enzymes',
        year: 2022,
        journal: 'Nature Communications',
        doi: '10.1038/s41467-022-30228-4',
        pmid: '35552388',
        why_it_matters:
          'Tests 40 sites in two species and reports how far the CRISPRscan algorithm transfers ' +
          'to new nucleases — the generalisation question our benchmark is about.',
      },
    ],
    key_figures_or_findings: [
      'Guanine enrichment and adenine depletion increase sgRNA stability and activity in vivo, ' +
        'while differential sgRNA loading, nucleosome positioning and Cas9 off-target binding ' +
        'were not major determinants (Nat Methods 2015, doi 10.1038/nmeth.3543, via PubMed).',
      'CRISPRscan: a predictive sgRNA-scoring algorithm fitted on sgRNAs with activity measured ' +
        'in injected zebrafish embryos (same paper). In OUR benchmark its Spearman rho on 307 of ' +
        'those guides is 0.269, CI [0.165, 0.364] — reported by us as an upper bound because the ' +
        'scoring set is its own training set.',
      'CRISPR-RfxCas13d gave a 76% average decrease in transcript levels in zebrafish embryos and ' +
        'worked in medaka, killifish and mouse embryos (Dev Cell 2020, ' +
        'doi 10.1016/j.devcel.2020.07.013, via PubMed).',
      'SpG and SpRY mutate in vivo at a lower rate than SpCas9 at equivalent formulations, ' +
        'recoverable by optimising mRNA-gRNA or RNP concentration, across 40 targets in zebrafish ' +
        'and C. elegans (Nat Commun 2022, doi 10.1038/s41467-022-30228-4, via PubMed).',
    ],
    real_quotes: [
      {
        quote:
          'However, variable activity across different single guide RNAs (sgRNAs) remains a ' +
          'significant limitation.',
        source_title:
          'CRISPRscan: designing highly efficient sgRNAs for CRISPR-Cas9 targeting in vivo',
        doi_or_url: 'https://doi.org/10.1038/nmeth.3543',
        context:
          'Second sentence of the published abstract (PubMed record for PMID 26322839). It is the ' +
          'problem our benchmark says our own pipeline has not solved.',
      },
      {
        quote:
          'We also found that the CRISPRscan algorithm could help to predict SpG and SpRY targets ' +
          'with high activity in vivo.',
        source_title: 'Genome editing in animals with minimal PAM CRISPR-Cas9 enzymes',
        doi_or_url: 'https://doi.org/10.1038/s41467-022-30228-4',
        context:
          'From the published abstract (PubMed record for PMID 35552388). This is a published ' +
          'transfer test of his own model, which is why he is the right person to ask about an ' +
          'independent held-out activity set.',
      },
    ],
    public_record: [
      'Principal investigator at the CABD, a joint CSIC / Pablo de Olavide University / Junta de ' +
        'Andalucia centre in Seville; listed in the Pablo de Olavide research portal under the ' +
        'CABD and the Department of Molecular Biology and Biochemical Engineering ' +
        '(https://investiga.upo.es/investigadores/160221/detalle?lang=en).',
      'CRISPRscan is distributed as a public web tool (https://www.crisprscan.org/), which is how ' +
        'the model reached our pipeline in the first place.',
      'Corresponding author on the 2017 Nature Communications, 2020 Developmental Cell and 2022 ' +
        'Nature Communications papers above.',
    ],
    collaboration_angle:
      'Not an animal-time ask at all, which makes it the cheapest approach on this list. The ask ' +
      'is a methods question: does an independent zebrafish sgRNA activity set exist that ' +
      'CRISPRscan has not seen, and if not, what is the smallest injection series that would ' +
      'produce one? A fair held-out comparison of CRISPRscan against the cross-species transfer ' +
      'our pipeline currently uses is a publishable negative result that costs him mostly ' +
      'judgement. WE would have to bring: the reimplementation and its verification (his 25 ' +
      'published scored sgRNAs reproduce at rho = 1.0000, max |difference| = 0.0000, at a ' +
      'coordinate offset we derived rather than assumed), the 307-guide table with GRCz11 ' +
      'coordinates, the seeded bootstrap, and the fact that the implementation failed its first ' +
      'run because reverse-complementing a genomic window flips its flanks.',
    openness_evidence: [
      {
        claim:
          'Released CRISPRscan as a public scoring tool and published the full coefficient table, ' +
          'plus 25 scored sgRNAs that let a third party verify a reimplementation. We used ' +
          'exactly that.',
        basis: 'stated',
        source: 'https://doi.org/10.1038/nmeth.3543',
      },
      {
        claim:
          'Works in large cross-border consortia: the 2022 Nature Communications paper spans ' +
          'CABD, IDIBELL, CRG, Yale and Massachusetts General Hospital.',
        basis: 'stated',
        source: 'https://doi.org/10.1038/s41467-022-30228-4',
      },
      {
        claim:
          'Treats "does my predictor transfer to a new setting" as a question worth publishing, ' +
          'which is the same question our benchmark asks.',
        basis: 'inferred',
        source:
          'Our reading of doi 10.1038/s41467-022-30228-4 and doi 10.1038/s41467-017-01836-2. He ' +
          'has not invited this comparison.',
      },
    ],
    caution:
      'The headline we would be bringing him is that a model fitted on his assay beats two models ' +
      'that were not — which is a flattering result for him and an unflattering one for us, so ' +
      'there is little in it for him beyond the held-out test. A tool-development lab may also ' +
      'simply not care about a design pipeline it has no stake in. And 191 of his 499 guides did ' +
      'not match uniquely in GRCz11 under our exact-match rule; those 191 are a selection rather ' +
      'than a random sample, and he is quite likely to point out a locating method we got wrong ' +
      'before he points at anything else. Note also that a different researcher publishing as ' +
      '"M. A. Moreno-Mateos" works in computational mechanics; do not conflate the two records.',
  },

  // ---------------------------------------------------------------------------- 4
  {
    id: 'kryn-stankunas',
    name: 'Kryn Stankunas',
    institution:
      'University of Oregon, Department of Biology and Institute of Molecular Biology',
    lab_url: 'https://imb.uoregon.edu/stankunas',
    field:
      'Zebrafish fin regeneration and skeletal patterning; control of appendage outgrowth ' +
      'duration and organ size; ion and Hedgehog signalling in bone progenitors; mouse heart ' +
      'development.',
    why_relevant_to_delphi:
      'His 2021 Development paper is the second of the three fin-size facts our bench brief is ' +
      'built on — the one that says homozygous loss of kcnh2a has no overt effect on fin length, ' +
      'so the informative edits are regulatory or gain-of-function. kcnh2a is also one of the two ' +
      'loci in our fin-ratio design. More importantly for us, his mechanism is TIME: fin size is ' +
      'set by how long outgrowth continues, not by a positional set-point. Our model has no time ' +
      'axis at all — every trait in the scorer is a single ratio measured once, which is exactly ' +
      'the structural reason only 1 of our 48 theorem-carrying laws is expressible on our trait ' +
      'set. If fin proportion is a rate-times-duration quantity, a one-shot ratio model is the ' +
      'wrong shape, and he is the person who can say so with data.',
    flagship_papers: [
      {
        title:
          'longfin causes cis-ectopic expression of the kcnh2a ether-a-go-go K+ channel to ' +
          'autonomously prolong fin outgrowth',
        year: 2021,
        journal: 'Development',
        doi: '10.1242/dev.199384',
        pmid: '34061172',
        why_it_matters:
          'The source of the loss-of-function constraint that reshaped our bench plan, and of the ' +
          'duration-based model of fin size that our ratio-only trait set cannot express.',
      },
      {
        title: 'Limited dedifferentiation provides replacement tissue during zebrafish fin regeneration',
        year: 2012,
        journal: 'Developmental Biology',
        doi: '10.1016/j.ydbio.2012.02.031',
        pmid: '22426105',
        why_it_matters:
          'Lineage restriction means a fin is a set of per-ray units, not a single plastic field — ' +
          'a constraint our whole-fin ratio traits silently ignore.',
      },
      {
        title:
          'Shh promotes direct interactions between epidermal cells and osteoblast progenitors to ' +
          'shape regenerated zebrafish bone',
        year: 2017,
        journal: 'Development',
        doi: '10.1242/dev.143792',
        pmid: '28351866',
        why_it_matters:
          'Ray branching is a discrete, mechanistically dissected shape decision — a far better ' +
          'target for a testable computational prediction than a continuous ratio.',
      },
    ],
    key_figures_or_findings: [
      'longfin-t2 overexpresses kcnh2a on chromosome 2; disrupting kcnh2a in cis rescues the ' +
        'phenotype, making longfin-t2 a regulatory kcnh2a allele (Development 2021, ' +
        'doi 10.1242/dev.199384, via PubMed).',
      'Chemical inhibition of Kcnh2a during late-stage regeneration fully suppresses overgrowth, ' +
        'and calcineurin inhibition likewise acts late — so fin size is tuned by outgrowth ' +
        'DURATION (same paper).',
      'Epidermal and intra-ray fibroblast and osteoblast lineages stay developmentally restricted ' +
        'through regeneration; no multipotent progenitor was found (Dev Biol 2012, ' +
        'doi 10.1016/j.ydbio.2012.02.031, via PubMed).',
      'Shha from the epidermis, not osteoblast-derived Ihha, drives ray branching; Hh/Smo output ' +
        'is confined to a narrow distal regenerate zone (Development 2017, ' +
        'doi 10.1242/dev.143792, via PubMed).',
    ],
    real_quotes: [
      {
        quote:
          'We conclude ion signaling within the growth-determining mesenchyme lineage controls fin ' +
          'size by tuning outgrowth periods rather than altering positional information or ' +
          'cell-level growth potency.',
        source_title:
          'longfin causes cis-ectopic expression of the kcnh2a ether-a-go-go K+ channel to ' +
          'autonomously prolong fin outgrowth',
        doi_or_url: 'https://doi.org/10.1242/dev.199384',
        context:
          'Closing sentence of the published abstract (PubMed record for PMID 34061172). We cite ' +
          'it as the clearest published argument that our ratio-only, single-timepoint trait set ' +
          'is the wrong representation for fin size.',
      },
      {
        quote: 'We found no evidence for the existence of multipotent progenitors.',
        source_title:
          'Limited dedifferentiation provides replacement tissue during zebrafish fin regeneration',
        doi_or_url: 'https://doi.org/10.1016/j.ydbio.2012.02.031',
        context:
          'From the published abstract (PubMed record for PMID 22426105). A negative result ' +
          'stated plainly, which is the register we want this outreach to be in.',
      },
    ],
    public_record: [
      'Professor of Biology and Full Member of the Institute of Molecular Biology at the ' +
        'University of Oregon; the profile lists cell biology, developmental biology and genetics ' +
        'as research areas (https://imb.uoregon.edu/stankunas).',
      'The profile describes three lab programmes: heart development, organ regeneration ' +
        '(zebrafish, with Scott Stewart), and chemical genetic technologies including TU-tagging ' +
        "developed with Chris Doe's lab.",
      'Corresponding author on the 2017 and 2021 Development papers above.',
    ],
    collaboration_angle:
      'The best-shaped ask on this list, because it is a modelling argument rather than a favour. ' +
      'If fin size is set by outgrowth duration, then the right computational object is a ' +
      'trajectory, not a ratio — and we already have a trajectory layer (development/) that ' +
      'returns fin length over age from published growth curves and labels every number measured, ' +
      'secondary, proxy or assumed. Proposal: he tells us what a duration-based prediction would ' +
      'have to look like to be falsifiable in his regeneration assay, and we build it; the bench ' +
      'arm only happens if the prediction survives that. WE would have to bring the trajectory ' +
      'layer with its provenance labels intact, an honest statement that the early-life portion ' +
      'of it is assumed rather than measured, and the law-expressibility result below, which is ' +
      'the formal version of his point.',
    openness_evidence: [
      {
        claim:
          'Develops and publishes reusable methodology (TU-tagging for cell-type-specific ' +
          'nascent-RNA labelling) jointly with another lab at the same institution.',
        basis: 'stated',
        source: 'https://imb.uoregon.edu/stankunas',
      },
      {
        claim:
          'Characterised and published a uniquely effective Smo inhibitor (BMS-833923) as a ' +
          'community-usable tool alongside the biology.',
        basis: 'stated',
        source: 'https://doi.org/10.1242/dev.143792',
      },
      {
        claim:
          'Publishes clean negative results and model-discriminating experiments, which suggests ' +
          'a collaborator who would tell us our model is wrong early rather than late.',
        basis: 'inferred',
        source:
          'Our reading of doi 10.1016/j.ydbio.2012.02.031 and doi 10.1242/dev.199384. Not a ' +
          'statement he has made.',
      },
    ],
    caution:
      'A smaller lab than several others here, split across heart and fin programmes, so bench ' +
      'capacity is genuinely scarce; the regeneration programme also runs on adult fish, which is ' +
      'the most expensive animal time there is. The deeper problem is on our side: his result ' +
      'implies our current trait representation is the wrong shape for the question, and we do ' +
      'not yet have a time-resolved scorer to replace it. Approaching him before we do would be ' +
      'asking him to design our model for us.',
  },

  // ---------------------------------------------------------------------------- 5
  {
    id: 'kenneth-poss',
    name: 'Kenneth D. Poss',
    institution:
      'University of Wisconsin-Madison, Department of Cell and Regenerative Biology; Director of ' +
      'Regenerative Biology, Morgridge Institute for Research',
    lab_url: 'https://crb.wisc.edu/staff/poss-kenneth/',
    field:
      'Vertebrate regeneration in zebrafish: appendage (fin), heart and spinal cord; regeneration ' +
      'enhancer elements; injury-triggered gene regulation.',
    why_relevant_to_delphi:
      'He built the one mechanism in this field that is explicitly engineerable: tissue ' +
      'regeneration enhancer elements, injury-activated regulatory sequences that can be wired to ' +
      'a chosen effector to change regenerative output. Our organism-design format exists to ' +
      'carry a design to a bench, and a TREE-driven cassette is the only published construct ' +
      'class we have found where "write a design, express it on injury, read a morphological ' +
      'outcome" is a described workflow rather than a hope. He is also the most useful possible ' +
      'critic of our bench packages: his lab routinely runs fin amputation with per-animal ' +
      'readouts, so he knows precisely what our power section is getting wrong.',
    flagship_papers: [
      {
        title: 'Modulation of tissue repair by regeneration enhancer elements',
        year: 2016,
        journal: 'Nature',
        doi: '10.1038/nature17644',
        pmid: '27049946',
        why_it_matters:
          'The engineerable control element our organism-design format would most want to emit, ' +
          'with tissue-specific modules already dissected.',
      },
      {
        title:
          'Voltage-gated sodium channel is required for innervation and regeneration of amputated ' +
          'adult zebrafish fins',
        year: 2022,
        journal: 'Proceedings of the National Academy of Sciences',
        doi: '10.1073/pnas.2200342119',
        pmid: '35867745',
        why_it_matters:
          'A third bioelectric component in fin outgrowth, from a temperature-sensitive forward ' +
          'screen — more evidence that our single-gene fin cases are under-specified.',
      },
      {
        title: "Keeping at arm's length during regeneration",
        year: 2014,
        journal: 'Developmental Cell',
        doi: '10.1016/j.devcel.2014.04.007',
        pmid: '24780734',
        why_it_matters:
          'States the positional-identity and completion problem — how a regenerate knows when to ' +
          'stop — which is the same question our fin-ratio target implicitly answers.',
      },
    ],
    key_figures_or_findings: [
      'leptin b (lepb) is highly induced in regenerating zebrafish hearts and fins; a short ' +
        'upstream/distal DNA element acquires open-chromatin marks during regeneration and drives ' +
        'injury-dependent expression from minimal promoters (Nature 2016, ' +
        'doi 10.1038/nature17644, via PubMed).',
      'That element is divisible into tissue-specific modules sufficient for expression in ' +
        'regenerating fins or hearts separately, and enhancer-effector transgenes using it ' +
        'controlled regeneration efficacy (same paper).',
      'A temperature-sensitive mutation in the major neuronal voltage-gated sodium channel gene ' +
        'disrupts blastema formation and axon regrowth, but not morphogenesis of established ' +
        'regenerates (PNAS 2022, doi 10.1073/pnas.2200342119, via PubMed).',
    ],
    real_quotes: [
      {
        quote:
          "Our findings provide evidence for 'tissue regeneration enhancer elements' (TREEs) that " +
          'trigger gene expression in injury sites and can be engineered to modulate the ' +
          'regenerative potential of vertebrate organs.',
        source_title: 'Modulation of tissue repair by regeneration enhancer elements',
        doi_or_url: 'https://doi.org/10.1038/nature17644',
        context:
          'Closing sentence of the published abstract (PubMed record for PMID 27049946). The word ' +
          '"engineered" is his, and it is why this is the one mechanism our design format could ' +
          'target without overclaiming.',
      },
      {
        quote:
          'Although the limb or fin may be years removed from its initial creation by an embryonic ' +
          'primordium, the blastema that emerges at the injury site fashions a close mimic of ' +
          'adult form.',
        source_title: "Keeping at arm's length during regeneration",
        doi_or_url: 'https://doi.org/10.1016/j.devcel.2014.04.007',
        context:
          'From the published abstract of the review (PubMed record for PMID 24780734). It frames ' +
          'the completion problem our fin-ratio prediction would have to engage with.',
      },
    ],
    public_record: [
      'Professor in the Department of Cell and Regenerative Biology, University of ' +
        'Wisconsin-Madison, and Director of Regenerative Biology at the Morgridge Institute for ' +
        'Research; the departmental page credits him with discovering heart regeneration in ' +
        'zebrafish and with identifying tissue regeneration enhancer elements ' +
        '(https://crb.wisc.edu/staff/poss-kenneth/).',
      'The same page records that he was James B. Duke Professor of Regenerative Biology at Duke ' +
        'University from 2003 to 2024 — relevant because older lab links point at Duke.',
      'Affiliated with the Howard Hughes Medical Institute during the Duke period, per the author ' +
        'affiliation on the 2014 Developmental Cell paper (doi 10.1016/j.devcel.2014.04.007, ' +
        'via PubMed).',
    ],
    collaboration_angle:
      'The right ask is a design-format one, not an animal one: what would a TREE-based cassette ' +
      'have to specify, field by field, for his lab to consider it a complete and checkable ' +
      'design rather than a sketch? That is a direct test of whether our .organism format earns ' +
      'its claim to be portable. A bench arm, if it ever happened, would be a fin-amputation ' +
      'regeneration readout, which his lab runs as routine. WE would have to bring the format ' +
      'with its enforcement intact — every value carrying a kind and a scope, the reader refusing ' +
      'a file rather than guessing one — plus the honest headline that on our own example design ' +
      'a simulator may use 2 of 15 values, 9 are not-established, and the axis the whole design ' +
      'claim rests on is not one the pre-registered scorecard could score.',
    openness_evidence: [
      {
        claim:
          'Published TREEs as an engineerable, transferable element class and showed the element ' +
          'activating in injured neonatal mouse tissue — i.e. framed for reuse outside the ' +
          'original system.',
        basis: 'stated',
        source: 'https://doi.org/10.1038/nature17644',
      },
      {
        claim:
          'Multi-institution collaboration is normal practice: the 2022 PNAS paper is a joint ' +
          'Wisconsin, Duke and Academia Sinica effort in which his lab contributed to work led ' +
          'elsewhere.',
        basis: 'stated',
        source: 'https://doi.org/10.1073/pnas.2200342119',
      },
      {
        claim:
          'A newly built institute programme is usually the moment a lab is most open to new ' +
          'methodological partners — but this is our guess about timing, not anything he has said.',
        basis: 'inferred',
        source: 'https://crb.wisc.edu/staff/poss-kenneth/',
      },
    ],
    caution:
      'The weakest fit of the fin-side candidates on subject matter: his question is regeneration, ' +
      'ours is morphological proportion, and the overlap is the tissue rather than the problem. He ' +
      'also runs one of the most visible regeneration programmes in the world and has just moved ' +
      'institutions, which is the single worst time to ask for bench capacity. And we have nothing ' +
      'he needs: no reagent, no dataset he lacks, and a scoring layer whose two external ' +
      'benchmarks came out at chance. If the format critique is not interesting to him on its own ' +
      'merits, there is no second reason for him to reply.',
  },

  // ---------------------------------------------------------------------------- 6
  {
    id: 'michel-bagnat',
    name: 'Michel Bagnat',
    institution: 'Duke University, Department of Cell Biology',
    lab_url: 'https://scholars.duke.edu/person/m.bagnat',
    field:
      'Morphogenesis of the vertebrate axial skeleton in zebrafish; notochord vacuole biology; ' +
      'tissue mechanics and physical self-organisation of the spine.',
    why_relevant_to_delphi:
      'He does the thing our morphology scorer most conspicuously cannot: derive a body ' +
      'proportion from a physical mechanism instead of from a distribution of observed ' +
      'specimens. Our worst failure is precisely of that kind — a law-derived constraint says ' +
      'the dorsal fin lies on the body (predorsal <= 1 SL), and the scorer rates an animal whose ' +
      'dorsal fin begins 1.02 standard lengths from the snout, past the end of the fish, as more ' +
      'typical than 4,068 of 4,673 real specimens (87.1%), at q = 0.347 against a median real ' +
      'fish of 0.650. Axial-length and segment-count proportions are his home ground, and his ' +
      'work shows where the physical bound actually is: packing density, aspect ratio, and a ' +
      'fixed spatial interval between myoseptum contacts. That is the raw material for ' +
      'constraints a plausibility model cannot learn.',
    flagship_papers: [
      {
        title: 'Notochord vacuoles absorb compressive bone growth during zebrafish spine formation',
        year: 2020,
        journal: 'eLife',
        doi: '10.7554/eLife.51221',
        pmid: '31995030',
        why_it_matters:
          'A mechanical, not statistical, account of why the axis is straight and the vertebrae ' +
          'symmetrical — the form of constraint our scorer lacks.',
      },
      {
        title: 'Notochord segmentation in zebrafish controlled by iterative mechanical signaling',
        year: 2024,
        journal: 'Developmental Cell',
        doi: '10.1016/j.devcel.2024.04.013',
        pmid: '38697108',
        why_it_matters:
          'Identifies a fixed spatial interval as the thing that drives sequential segmentation — ' +
          'a candidate hard bound on segment-count and axial-proportion traits.',
      },
      {
        title: 'Tissue self-organization underlies morphogenesis of the notochord',
        year: 2018,
        journal: 'Philosophical Transactions of the Royal Society B',
        doi: '10.1098/rstb.2017.0320',
        pmid: '30249771',
        why_it_matters:
          'Derives an in vivo cell arrangement from sphere- and foam-packing theory and a silicone ' +
          'tube model, then tests the predictions in fish — the closest published template for ' +
          'what we claim to want to do.',
      },
    ],
    key_figures_or_findings: [
      'A mutation in the kinase gene dstyk fragments notochord vacuoles and produces a severe ' +
        'congenital-scoliosis-like phenotype; localised vacuole disruption causes vertebral ' +
        'malformation and axis curving at those sites (eLife 2020, doi 10.7554/eLife.51221, ' +
        'via PubMed).',
      'Myoseptum-notochord linkages initiate notochord segments by locally deforming the ' +
        'extracellular matrix and recruiting focal-adhesion machinery at the contact points ' +
        '(Dev Cell 2024, doi 10.1016/j.devcel.2024.04.013, via PubMed).',
      'A fixed spatial interval between those cues is critical for sequential segment initiation; ' +
        'irregular somite patterning gives non-sequential, dysmorphic segmentation (same paper).',
      'Vacuolated-cell arrangement in the notochord is reproduced by a silicone-tube and ' +
        'water-absorbing-bead physical model and predicted by the theory of packing spheres and ' +
        'foams in cylinders; it is governed by cell density and the aspect ratio of the notochord ' +
        'rod (Philos Trans R Soc B 2018, doi 10.1098/rstb.2017.0320, via PubMed).',
    ],
    real_quotes: [
      {
        quote:
          'We investigated the origin of this pattern and found that it can be achieved purely by ' +
          'simple physical principles.',
        source_title: 'Tissue self-organization underlies morphogenesis of the notochord',
        doi_or_url: 'https://doi.org/10.1098/rstb.2017.0320',
        context:
          'From the published abstract (PubMed record for PMID 30249771). This is the sentence we ' +
          'would quote back to explain what our scorer is missing.',
      },
      {
        quote:
          'Together, our data show that notochord vacuoles function as a hydrostatic scaffold that ' +
          'guides symmetrical growth of vertebrae and spine formation.',
        source_title:
          'Notochord vacuoles absorb compressive bone growth during zebrafish spine formation',
        doi_or_url: 'https://doi.org/10.7554/eLife.51221',
        context:
          'Closing sentence of the published abstract (PubMed record for PMID 31995030).',
      },
    ],
    public_record: [
      'Faculty in the Department of Cell Biology at Duke University; his Duke Scholars profile ' +
        'states his research focus as cellular and physiologic mechanisms controlling ' +
        'morphogenesis (https://scholars.duke.edu/person/m.bagnat).',
      'Lead/corresponding author on the eLife 2020, Developmental Cell 2024 and Philosophical ' +
        'Transactions B 2018 papers above.',
      'Routinely co-authors with physics, chemistry and mathematics groups (Duke Physics and ' +
        'Chemistry, NC State Mathematics) on the papers above.',
    ],
    collaboration_angle:
      'This is the best collaboration-angle argument in the file, and it is not a request for ' +
      'bench time. Our registry has 48 theorem-carrying laws and exactly ONE is expressible on ' +
      'our ten trait ratios, because the laws speak in quantities our traits do not carry: two ' +
      'sizes, a population, a power budget, a genotype. His constraints are different in kind — ' +
      'they are stated in a packing density, an aspect ratio and a fixed interval, all of which ' +
      'are measurable on a single specimen. The ask: name two or three axial-proportion bounds ' +
      'that follow from the mechanics rather than from the specimen cloud, and we encode them as ' +
      'Lean constraints with non-vacuity witnesses and re-run the hard-negative benchmark against ' +
      'them. If the scorer still calls the violators typical, that is a clean published result ' +
      'with his name on the constraint and ours on the failure. WE would have to bring the ' +
      'registry, the expressibility audit, the 4,673-specimen trait table, and the q = 0.347 ' +
      'counter-example so he can see the failure mode before agreeing to anything.',
    openness_evidence: [
      {
        claim:
          'Publishes with physicists, chemists and mathematicians as co-authors on the biology ' +
          'itself, not as a service relationship — the 2024 Developmental Cell paper is ' +
          'co-corresponded with a Duke chemistry/physics group.',
        basis: 'stated',
        source: 'https://doi.org/10.1016/j.devcel.2024.04.013',
      },
      {
        claim:
          'Posted the 2024 work as a bioRxiv preprint (doi 10.1101/2023.03.27.534101) more than a ' +
          'year before journal publication.',
        basis: 'stated',
        source: 'https://doi.org/10.1101/2023.03.27.534101',
      },
      {
        claim:
          'A lab that already builds coarse-grained mathematical models of its own system is more ' +
          'likely to engage with a formal constraint layer than one that does not.',
        basis: 'inferred',
        source:
          'Our reading of doi 10.1098/rstb.2017.0320 and doi 10.1016/j.devcel.2024.04.013. Not ' +
          'something he has said.',
      },
    ],
    caution:
      'He works on the axial skeleton, not on fins, so the fin-ratio programme — our largest ' +
      'investment — is off his axis. He also already has the modelling collaborators he needs, ' +
      'in-house and at NC State, which is the strongest reason to expect a polite no: we would be ' +
      'offering a weaker version of something he has. And the constraint-encoding ask puts the ' +
      'intellectual work on his side and the credit risk on ours; if he supplies the bounds and ' +
      'our scorer fails them, the interesting result is about our failure, which is a thin reason ' +
      'for him to spend an afternoon.',
  },

  // ---------------------------------------------------------------------------- 7
  {
    id: 'david-kingsley',
    name: 'David M. Kingsley',
    institution: 'Stanford University School of Medicine, Department of Developmental Biology',
    lab_url: 'https://kingsley.stanford.edu/',
    field:
      'Molecular basis of vertebrate evolution; genetic architecture of skeletal change in ' +
      'natural populations; regulatory mutations and enhancer deletions; stickleback and mouse ' +
      'genetics.',
    why_relevant_to_delphi:
      'He answered, with real animals, the question our design layer keeps assuming: how many ' +
      'genetic changes of what size does it take to delete or resize a paired appendage? For ' +
      'pelvic reduction the answer was one major plus four minor loci, with the major one a ' +
      'tissue-specific Pitx1 enhancer lost by recurrent deletion. That is the sanity check our ' +
      'winged-zebrafish design needs: our .organism file declares 15 values of which 9 are ' +
      'not-established, and the design claim rests on an axis the scorecard could not score — ' +
      'whereas his programme shows what a defensible genotype-to-skeletal-proportion claim ' +
      'actually requires. His enhancer-deletion result also matters directly to our edit planning: ' +
      'the informative change in our own fin cases is regulatory or gain-of-function, never a ' +
      'knockout, which is exactly his finding in a different appendage.',
    flagship_papers: [
      {
        title:
          'Genetic and developmental basis of evolutionary pelvic reduction in threespine ' +
          'sticklebacks',
        year: 2004,
        journal: 'Nature',
        doi: '10.1038/nature02415',
        pmid: '15085123',
        why_it_matters:
          'The genetic architecture of a large paired-appendage change, measured rather than ' +
          'assumed: one major and four minor loci.',
      },
      {
        title: 'Adaptive evolution of pelvic reduction in sticklebacks by recurrent deletion of a Pitx1 enhancer',
        year: 2010,
        journal: 'Science',
        doi: '10.1126/science.1182213',
        pmid: '20007865',
        why_it_matters:
          'A specific regulatory lesion causing a specific skeletal loss, repeatedly, in the wild ' +
          '— the gold standard our design claims should be measured against.',
      },
      {
        title: 'The genomic basis of adaptive evolution in threespine sticklebacks',
        year: 2012,
        journal: 'Nature',
        doi: '10.1038/nature10944',
        pmid: null,
        why_it_matters:
          'A large public comparative genomic resource for a skeletal-variation system; verified ' +
          'via Crossref (28 authors, Kingsley last).',
      },
    ],
    key_figures_or_findings: [
      'Genome-wide linkage mapping showed pelvic reduction is controlled by one major and four ' +
        'minor chromosome regions, with Pitx1 mapping to the major region (Nature 2004, ' +
        'doi 10.1038/nature02415, via PubMed).',
      'Pelvic-reduced fish show the same left-right asymmetry as Pitx1 knockout mice but no change ' +
        'in Pitx1 protein sequence; the change is site-specific regulatory, with reduced or absent ' +
        'expression in pelvic and caudal fin precursors (same paper).',
      'Pelvic loss in different natural populations occurred through deletions of a tissue-specific ' +
        'Pitx1 enhancer, with molecular signatures of positive selection, while Pitx1 null ' +
        'mutations are lethal in laboratory animals (Science 2010, doi 10.1126/science.1182213, ' +
        'via PubMed).',
    ],
    real_quotes: [
      {
        quote:
          'Regulatory mutations in major developmental control genes may provide a mechanism for ' +
          'generating rapid skeletal changes in natural populations, while preserving the ' +
          'essential roles of these genes in other processes.',
        source_title:
          'Genetic and developmental basis of evolutionary pelvic reduction in threespine ' +
          'sticklebacks',
        doi_or_url: 'https://doi.org/10.1038/nature02415',
        context:
          'Closing sentence of the published abstract (PubMed record for PMID 15085123). It is the ' +
          'general principle behind why our own fin cases are all regulatory or gain-of-function.',
      },
      {
        quote:
          'These studies illustrate how major expression and morphological changes can arise from ' +
          'single mutational leaps in natural populations, producing new adaptive alleles via ' +
          'recurrent regulatory alterations in a key developmental control gene.',
        source_title:
          'Adaptive evolution of pelvic reduction in sticklebacks by recurrent deletion of a Pitx1 ' +
          'enhancer',
        doi_or_url: 'https://doi.org/10.1126/science.1182213',
        context:
          'Closing sentence of the published abstract (PubMed record for PMID 20007865).',
      },
    ],
    public_record: [
      'Runs the Kingsley Lab in the Department of Developmental Biology at Stanford University ' +
        'School of Medicine; the lab page states its focus as "The Molecular Basis of Vertebrate ' +
        'Evolution" and lists mice, sticklebacks, and human and chimpanzee stem cells as study ' +
        'systems (https://kingsley.stanford.edu/).',
      'Howard Hughes Medical Institute affiliation appears in his author affiliations on both ' +
        'stickleback papers above ("Department of Developmental Biology and Howard Hughes Medical ' +
        'Institute, Stanford University"), and the lab page carries an HHMI link.',
      'The lab page runs a public "Bone of the Week" feature and lists Publications and ' +
        'Protocols & Links sections.',
    ],
    collaboration_angle:
      'Not a bench ask — a design-criticism ask, and a benchmark one. (1) Review our .organism ' +
      'example as a genotype-to-proportion claim and tell us what a reviewer of his standard would ' +
      'demand before taking it seriously; the format is built to make that criticism cheap, ' +
      'because every value already carries whether it is measured, assumed or not-established. ' +
      '(2) Stickleback pelvic-reduced versus pelvis-complete populations are a natural adversarial ' +
      'test set for our morphology scorer: two real, viable, large-effect skeletal morphs where we ' +
      'can check whether the scorer treats a real, selected-for appendage loss as impossible. WE ' +
      'would have to bring the scorer, its decoy-difficulty curve (AUC 0.891 on shuffles falling ' +
      'to 0.536 on real fish nudged a quarter standard deviation) and the measurement protocol, ' +
      'because the ask only works if the traits are measured his way, not ours.',
    openness_evidence: [
      {
        claim:
          'Co-authored a 28-author genome-scale stickleback resource paper spanning Stanford, the ' +
          'Broad Institute, the Wellcome Trust Sanger Institute, HudsonAlpha and others.',
        basis: 'stated',
        source: 'https://doi.org/10.1038/nature10944',
      },
      {
        claim:
          'The lab page maintains a public Protocols & Links section and an open outreach feature, ' +
          'i.e. it publishes material beyond papers.',
        basis: 'stated',
        source: 'https://kingsley.stanford.edu/',
      },
      {
        claim:
          'Work spanning wild populations, laboratory crosses and mouse/human comparisons suggests ' +
          'a lab used to importing methods from outside its own system.',
        basis: 'inferred',
        source:
          'Our reading of the three flagship papers. He has not stated an interest in ' +
          'computational design collaborations.',
      },
    ],
    caution:
      'The weakest zebrafish fit on the list: he works in sticklebacks and mice, and a stickleback ' +
      'facility cannot run our zebrafish bench packages at all. A very senior, HHMI-scale lab also ' +
      'has no structural need for a small computational group, and the honest offer is a critique ' +
      'request plus an invitation to let us test our scorer on his morphs — both of which take ' +
      'his time and give him nothing. There is also a real risk of looking naive: he has spent ' +
      'twenty years establishing how hard it is to tie a genotype to a skeletal proportion, and we ' +
      'would be arriving with a design whose central axis is unscored.',
  },

  // ---------------------------------------------------------------------------- 8
  {
    id: 'craig-albertson',
    name: 'R. Craig Albertson',
    institution:
      'University of Massachusetts Amherst, Department of Biology (Organismic & Evolutionary ' +
      'Biology)',
    lab_url: 'https://www.umass.edu/organismic-evolutionary/about/directory/r-craig-albertson',
    field:
      'Evo-devo of the bony fish skeleton; genetics and development of craniofacial shape; ' +
      'phenotypic plasticity; geometric morphometrics; cichlid, zebrafish and Antarctic icefish ' +
      'systems.',
    why_relevant_to_delphi:
      'He is the strongest shape-quantification critic available. Our morphology scorer is a ' +
      'Mahalanobis plausibility model over ten length-over-standard-length ratios for a single ' +
      'specimen, and its measured failure is specific: constraints whose boundary lies just ' +
      'outside the observed marginal range, which is where most anatomical impossibilities live. ' +
      'An anatomically impossible animal sits at q = 0.918 and is called typical. His lab does ' +
      'quantitative shape analysis properly — landmark-based geometric morphometrics on fish ' +
      'skulls, including on zebrafish mutants — so he can say whether a ten-ratio vector is a ' +
      'defensible shape representation at all, or whether we have thrown away exactly the ' +
      'covariance structure that carries the anatomy. His plasticity work adds a second problem ' +
      'we have not modelled: the same genotype produces different bone deposition under different ' +
      'mechanical demand, so a single predicted ratio may not even be well defined.',
    flagship_papers: [
      {
        title: 'Hedgehog signaling is necessary and sufficient to mediate craniofacial plasticity in teleosts',
        year: 2020,
        journal: 'Proceedings of the National Academy of Sciences',
        doi: '10.1073/pnas.1921856117',
        pmid: '32719137',
        why_it_matters:
          'Shows a predicted morphological value is environment-dependent, which our ' +
          'single-number trait targets do not admit.',
      },
      {
        title:
          'Deficiency of zebrafish fgf20a results in aberrant skull remodeling that mimics both ' +
          'human cranial disease and evolutionarily important fish skull morphologies',
        year: 2013,
        journal: 'Evolution & Development',
        doi: '10.1111/ede.12052',
        pmid: '24261444',
        why_it_matters:
          'A worked example of using geometric morphometrics to give a quantitative description of ' +
          'a zebrafish mutant skull — the methodological standard our trait table should be held ' +
          'to.',
      },
      {
        title: 'Directional selection has shaped the oral jaws of Lake Malawi cichlid fishes',
        year: 2003,
        journal: 'Proceedings of the National Academy of Sciences',
        doi: '10.1073/pnas.0930235100',
        pmid: null,
        why_it_matters:
          'Early demonstration that shape differences among real fish carry a measurable ' +
          'evolutionary signal rather than noise; verified via Crossref ' +
          '(Albertson, Streelman, Kocher).',
      },
    ],
    key_figures_or_findings: [
      'Rates of bone deposition within functionally salient elements of the cichlid feeding ' +
        'apparatus change when fish are forced to use alternate foraging modes, and the level and ' +
        'pattern of plasticity differs among closely related species (PNAS 2020, ' +
        'doi 10.1073/pnas.1921856117, via PubMed).',
      'Reducing Hedgehog levels in transgenic zebrafish dampens the ability to modulate bone ' +
        'deposition with mechanical demand; raising them increases that sensitivity (same paper).',
      'The dob/fgf20a zebrafish mutant shows altered skull-vault geometry and midfacial hypoplasia ' +
        'generated by post-embryonic remodelling — decreased osteoblastogenesis and increased ' +
        'osteoclastogenesis — quantified by geometric morphometrics (Evol Dev 2013, ' +
        'doi 10.1111/ede.12052, via PubMed).',
      "The lab's current topics include evolution of reduced bone density in Antarctic icefishes " +
        '(https://www.umass.edu/organismic-evolutionary/about/directory/r-craig-albertson).',
    ],
    real_quotes: [
      {
        quote:
          'There is increasing awareness that these two fields can be mutually informative when ' +
          'natural variation mimics pathology.',
        source_title:
          'Deficiency of zebrafish fgf20a results in aberrant skull remodeling that mimics both ' +
          'human cranial disease and evolutionarily important fish skull morphologies',
        doi_or_url: 'https://doi.org/10.1111/ede.12052',
        context:
          'From the published abstract (PubMed record for PMID 24261444). The paper is co-authored ' +
          'with W. J. Cooper and others; the sentence is the framing we would be building on, not ' +
          'a personal statement.',
      },
      {
        quote:
          'These data advance a mechanistic understanding of phenotypic plasticity in the teleost ' +
          'feeding apparatus and in doing so contribute key insights into the origins of adaptive ' +
          'morphological radiations.',
        source_title:
          'Hedgehog signaling is necessary and sufficient to mediate craniofacial plasticity in ' +
          'teleosts',
        doi_or_url: 'https://doi.org/10.1073/pnas.1921856117',
        context:
          'Closing sentence of the published abstract (PubMed record for PMID 32719137).',
      },
    ],
    public_record: [
      'Professor of Biology in Organismic & Evolutionary Biology at the University of ' +
        'Massachusetts Amherst; the directory page states the lab works "at the intersection of ' +
        'genes, development and evolution", using the craniofacial skeleton of bony fishes as its ' +
        'model (https://www.umass.edu/organismic-evolutionary/about/directory/r-craig-albertson).',
      'The page lists three programmes: cichlid head-shape diversity and its interaction with the ' +
        'environment, post-embryonic zebrafish craniofacial development via mutagenesis screens ' +
        'and quantitative shape analysis, and bone-density evolution in Antarctic icefishes.',
      'Corresponding author on the 2020 PNAS paper above.',
    ],
    collaboration_angle:
      'A methods audit we badly need and a cheap one to give: does a ten-ratio, ' +
      'single-specimen, normalised-by-standard-length trait vector preserve enough shape ' +
      'information to support a plausibility claim, and if not, what is the minimum landmark set ' +
      'that would? The bench-adjacent version is better still: his mutagenesis screens already ' +
      'generate adult zebrafish with quantified skeletal dysmorphology, so there may be an ' +
      'existing, already-collected set of real, viable, abnormal fish that our scorer can be run ' +
      'against with no new animals at all. WE would have to bring the trait table and its ' +
      'construction, the full decoy-difficulty result, the near-miss that nearly invalidated a ' +
      'law mapping (pectoral fin LENGTH / SL versus the snout-to-fin-BASE distance: two words ' +
      'apart, unrelated measurements), and a commitment to adopt his measurement definitions ' +
      'rather than defend ours.',
    openness_evidence: [
      {
        claim:
          'Publishes with external groups across institutions (Washington State University ' +
          'Tri-Cities on the 2013 paper; a multi-programme UMass team plus the Karlstrom lab on ' +
          'the 2020 paper).',
        basis: 'stated',
        source: 'https://doi.org/10.1111/ede.12052',
      },
      {
        claim:
          'The 2013 paper explicitly offers the mutant line as "an experimentally tractable model" ' +
          'for others to examine, which is an offer of a shared resource.',
        basis: 'stated',
        source: 'https://doi.org/10.1111/ede.12052',
      },
      {
        claim:
          'A lab whose stated method is quantitative shape analysis is the most likely of any here ' +
          'to find a trait-representation audit intrinsically interesting.',
        basis: 'inferred',
        source:
          'Our reading of the directory page and the two flagship papers. Not something he has said.',
      },
    ],
    caution:
      'He works on the skull, not on fins, so the specific prediction our programme most wants ' +
      'tested is outside his assay. The likeliest outcome of a trait-representation audit is that ' +
      'he tells us ten normalised ratios are not a shape representation at all and we should be ' +
      'doing landmark-based morphometrics — correct, useful and a large amount of rework, with no ' +
      'publication in it for him. And our honest position is weak: the scorer he would be auditing ' +
      'has already failed its own external benchmark, so we are asking a shape expert to spend ' +
      'time diagnosing a tool we already know is broken.',
  },

  // ---------------------------------------------------------------------------- 9
  {
    id: 'peter-wainwright',
    name: 'Peter C. Wainwright',
    institution:
      'University of California, Davis, Department of Evolution and Ecology',
    lab_url: 'https://fishlab.ucdavis.edu/',
    field:
      'Functional morphology and macroevolution of teleost fishes; form-function mapping; ' +
      'comparative morphological datasets; diversification of feeding, body shape and swimming.',
    why_relevant_to_delphi:
      'He named the exact problem our morphology scorer has. Our scorer is a distance-to-real-fish ' +
      'model, and the benchmark finding is that distance to real fish does not bound anatomical ' +
      'possibility: it is a plausibility model, not a viability model, and it rates an impossible ' +
      'animal at q = 0.918. Many-to-one mapping is the formal reason this is not a fixable bug — ' +
      'when a functional property is determined by three or more parts, many morphologies share ' +
      'the same function, so there are large neutral surfaces of morphological variation. A ' +
      'scorer that ranks by typicality will happily sit anywhere on such a surface, including off ' +
      'the end of the viable region. He is also the person most likely to know which comparative ' +
      'trait datasets would give us a genuinely independent specimen set, instead of the 4,673 we ' +
      'already fitted to.',
    flagship_papers: [
      {
        title: 'Many-to-One Mapping of Form to Function: A General Principle in Organismal Design?',
        year: 2005,
        journal: 'Integrative and Comparative Biology',
        doi: '10.1093/icb/45.2.256',
        pmid: null,
        why_it_matters:
          'The principle that explains why a typicality score cannot bound viability; verified via ' +
          'Crossref (Wainwright, 2005).',
      },
      {
        title: 'Functional Versus Morphological Diversity in Macroevolution',
        year: 2007,
        journal: 'Annual Review of Ecology, Evolution, and Systematics',
        doi: '10.1146/annurev.ecolsys.38.091206.095706',
        pmid: null,
        why_it_matters:
          'States the neutral-surface consequence directly, in a review we can cite as the ' +
          'theoretical frame for our own failure; verified via Crossref.',
      },
      {
        title: 'Functional Innovations and the Conquest of the Oceans by Acanthomorph Fishes',
        year: 2017,
        journal: 'Current Biology',
        doi: '10.1016/j.cub.2017.03.044',
        pmid: null,
        why_it_matters:
          'Frames which functional innovations actually opened new regions of fish design space — ' +
          'the question our design programme is really asking; verified via Crossref ' +
          '(Wainwright, Longo).',
      },
      {
        title: 'Nocturnality constrains morphological and functional diversity in the eyes of reef fishes',
        year: 2011,
        journal: 'BMC Evolutionary Biology',
        doi: '10.1186/1471-2148-11-338',
        pmid: '22098687',
        why_it_matters:
          'A worked example of a large comparative morphological trait dataset (265 species, 43 ' +
          'families) used to show a constraint on diversity — the shape of evidence our scorer ' +
          'would need.',
      },
    ],
    key_figures_or_findings: [
      'Any functional property determined by three or more underlying parts expresses many-to-one ' +
        'mapping of form to function, producing surfaces of morphological variation that are ' +
        'neutral with respect to that property (Annu Rev Ecol Evol Syst 2007, ' +
        'doi 10.1146/annurev.ecolsys.38.091206.095706, verified via Crossref).',
      'Potential morphological diversity in a lineage is a function of the number of independent ' +
        'parameters needed to describe the form; structural duplication and functional decoupling ' +
        'raise it (same review).',
      'Comparative dataset of eye morphology for 265 teleost reef fish species across 43 families; ' +
        'nocturnal species show large relative eye size, high optical ratio and large rounded ' +
        'pupils, at the cost of reduced depth of focus, while diurnal species are much more ' +
        'diverse (BMC Evol Biol 2011, doi 10.1186/1471-2148-11-338, via PubMed).',
    ],
    real_quotes: [
      {
        quote:
          'The functional properties of organisms are determined by underlying parts, but any ' +
          'property that is determined by three or more parts expresses many-to-one mapping of ' +
          'form to function, in which many morphologies will have the same functional property.',
        source_title: 'Functional Versus Morphological Diversity in Macroevolution',
        doi_or_url: 'https://doi.org/10.1146/annurev.ecolsys.38.091206.095706',
        context:
          'From the published abstract as served by Crossref for doi ' +
          '10.1146/annurev.ecolsys.38.091206.095706. This is the single best external statement of ' +
          'why our plausibility scorer cannot be made into a viability scorer by tuning.',
      },
      {
        quote:
          'This ubiquitous feature of organismal design results in surfaces of morphological ' +
          'variation that are neutral with respect to the functional property, and enhances the ' +
          'potential for simultaneously optimizing two or more functions of the system.',
        source_title: 'Functional Versus Morphological Diversity in Macroevolution',
        doi_or_url: 'https://doi.org/10.1146/annurev.ecolsys.38.091206.095706',
        context:
          'The following sentence of the same abstract (Crossref). We would cite both together.',
      },
    ],
    public_record: [
      'The lab page describes him as "a fish biologist and functional morphologist" — his own ' +
        'self-description, quoted here as a public professional fact rather than as a quotation ' +
        'from a paper (https://fishlab.ucdavis.edu/).',
      'Leads the Wainwright Lab ("FishLab") at the University of California, Davis; the lab page ' +
        'lists current topics including diversification of fish feeding mechanisms, evolution of ' +
        'fish body shapes, diversification of fish swimming behaviour and general principles in ' +
        'morphological evolution (https://fishlab.ucdavis.edu/).',
      'Author of the 2005 Integrative and Comparative Biology paper and the 2007 Annual Review ' +
        'chapter that introduced and developed the many-to-one mapping framing.',
      'Co-author on multi-institution phylogenetic and palaeontological work (e.g. the 2013 Proc ' +
        'R Soc B cichlid timescale paper, doi 10.1098/rspb.2013.1733, via PubMed).',
    ],
    collaboration_angle:
      'Pure theory and data, no animals. Two asks. (1) Is our failure mode the predicted ' +
      'consequence of many-to-one mapping, and if so what is the right null — i.e. what would a ' +
      'viability model have to add to a typicality model to stop ranking an impossible animal as ' +
      'typical? (2) Which published comparative trait datasets would give us a specimen set ' +
      'genuinely independent of the 4,673 we fitted to, so the decoy-difficulty curve can be ' +
      're-measured out of sample. WE would have to bring the benchmark in full — AUC 0.891 on ' +
      'shuffled negatives collapsing to 0.536 on real fish nudged a quarter standard deviation, ' +
      'the constructed impossible animal at q = 0.918, and the law-derived violator at q = 0.347 ' +
      '— plus an admission that 12,152 of our 12,606 held-out negatives were shuffles, which is ' +
      'precisely and only what a Mahalanobis distance can detect.',
    openness_evidence: [
      {
        claim:
          'Publishes large comparative morphological datasets in the open literature, including in ' +
          'fully open-access venues (BMC Evolutionary Biology).',
        basis: 'stated',
        source: 'https://doi.org/10.1186/1471-2148-11-338',
      },
      {
        claim:
          'Works across institutions and disciplines, including with palaeontologists and ' +
          'systematists at Oxford, Yale and Tennessee.',
        basis: 'stated',
        source: 'https://doi.org/10.1098/rspb.2013.1733',
      },
      {
        claim:
          'Has repeatedly written general-principle papers aimed at other fields rather than only ' +
          'at fish specialists, which suggests receptiveness to a question posed from outside ' +
          'organismal biology.',
        basis: 'inferred',
        source:
          'Our reading of doi 10.1093/icb/45.2.256 and ' +
          'doi 10.1146/annurev.ecolsys.38.091206.095706.',
      },
    ],
    caution:
      'He is not a lab-in-the-loop partner in the sense the brief means: this lab does not run ' +
      'CRISPR, does not run zebrafish husbandry, and would not run our bench package. Counting ' +
      'him as a wet-lab candidate would be dishonest bookkeeping. He is also a comparative ' +
      'macroevolutionary biologist being asked about a design-engineering problem, and the ' +
      'correct answer to our question may simply be that typicality was never going to bound ' +
      'viability and we should have known — which costs him an email and gains him nothing. We ' +
      'have nothing he needs.',
  },

  // ---------------------------------------------------------------------------- 10
  {
    id: 'george-lauder',
    name: 'George V. Lauder',
    institution:
      'Harvard University, Museum of Comparative Zoology and Department of Organismic and ' +
      'Evolutionary Biology',
    lab_url: 'https://sites.harvard.edu/glauder/',
    field:
      'Fish biomechanics and hydrodynamics; fin function and control surfaces; comparative ' +
      'swimming kinematics; biorobotic physical models of fish propulsion.',
    why_relevant_to_delphi:
      'Our fin-ratio programme claims a fin proportion matters, and the only way that claim can be ' +
      'wrong-but-plausible is if fin area and shape do not do what we assume hydrodynamically. ' +
      'Our own physics layer is explicit that the fin-area law is an assumed transfer — one model ' +
      'of one specimen, scaled by an exponent measured in a different species — and that the ' +
      'wing-loading relation it implies (proportional to SL^1.18) disagrees with the published ' +
      '1.236. He is the person who can say whether a fin-area-to-performance claim of that shape ' +
      'is testable at all. His comparative kinematics result is also a direct warning about our ' +
      'method: morphological traits correlated with the expected locomotor modes, but did not ' +
      'accurately represent the actual kinematics — which is exactly the failure our morphology ' +
      'scorer makes in a different register.',
    flagship_papers: [
      {
        title: 'Convergence of undulatory swimming kinematics across a diversity of fishes',
        year: 2021,
        journal: 'Proceedings of the National Academy of Sciences',
        doi: '10.1073/pnas.2113206118',
        pmid: '34853171',
        why_it_matters:
          'A 44-species test showing morphology-based categories fail to predict measured ' +
          'kinematics — the cleanest external analogue of our scorer failure.',
      },
      {
        title: 'Locomotor function of the dorsal fin in rainbow trout: kinematic patterns and hydrodynamic forces',
        year: 2005,
        journal: 'Journal of Experimental Biology',
        doi: '10.1242/jeb.01922',
        pmid: '16339868',
        why_it_matters:
          'Measures what a median fin actually contributes, with force ratios — the kind of number ' +
          'our fin traits silently assume.',
      },
      {
        title:
          'Understanding Fish Linear Acceleration Using an Undulatory Biorobotic Model with Soft ' +
          'Fluidic Elastomer Actuated Morphing Median Fins',
        year: 2018,
        journal: 'Soft Robotics',
        doi: '10.1089/soro.2017.0085',
        pmid: '29634444',
        why_it_matters:
          'A physical model as the experimental platform: a route to testing a morphological ' +
          'prediction with no animals at all.',
      },
      {
        title:
          'Functional morphology and hydrodynamics of backward swimming in bluegill sunfish, ' +
          'Lepomis macrochirus',
        year: 2016,
        journal: 'Zoology',
        doi: '10.1016/j.zool.2016.05.002',
        pmid: '27291816',
        why_it_matters:
          'Shows fins are used as a coordinated set, so a single fin ratio is not an independently ' +
          'meaningful design variable.',
      },
    ],
    key_figures_or_findings: [
      'In rainbow trout the dorsal-fin wake directs flow predominantly laterally, with a ' +
        'lateral:thrust force ratio of 5-6, and at 2.0 body lengths per second the dorsal fin no ' +
        'longer adds momentum to the wake (J Exp Biol 2005, doi 10.1242/jeb.01922, via PubMed).',
      'Across 44 species, oscillation amplitude during steady locomotion is similar enough to be ' +
        'modelled by a second-degree polynomial, and the expected decrease in head:tail amplitude ' +
        'across traditional swimming modes was not found (PNAS 2021, ' +
        'doi 10.1073/pnas.2113206118, via PubMed).',
      'In a robotic model, erecting the soft dorsal/anal fins raised linear acceleration by up to ' +
        '32.5% over the folded state, while the side-force oscillation magnitude fell 24.8% even ' +
        'though lateral projected body area rose 16.9% (Soft Robot 2018, ' +
        'doi 10.1089/soro.2017.0085, via PubMed).',
    ],
    real_quotes: [
      {
        quote:
          'While the expected swimming modes correlated with morphological traits, they did not ' +
          'accurately represent the kinematics of BCF locomotion.',
        source_title: 'Convergence of undulatory swimming kinematics across a diversity of fishes',
        doi_or_url: 'https://doi.org/10.1073/pnas.2113206118',
        context:
          'From the published abstract (PubMed record for PMID 34853171). We cite it as an ' +
          'independent instance of a morphology-based classifier failing against measurement.',
      },
      {
        quote:
          'We suggest that the distinction often made between median and paired fin (MPF) ' +
          'propulsion and body and caudal fin (BCF) propulsion in fishes obscures the important ' +
          'role of multiple propulsors acting in a coordinated fashion.',
        source_title:
          'Locomotor function of the dorsal fin in rainbow trout: kinematic patterns and ' +
          'hydrodynamic forces',
        doi_or_url: 'https://doi.org/10.1242/jeb.01922',
        context:
          'From the published abstract (PubMed record for PMID 16339868). It is the argument ' +
          'against treating one fin ratio as an independent design variable.',
      },
    ],
    public_record: [
      'Runs the Lauder Laboratory at the Museum of Comparative Zoology, Harvard University; the ' +
        'lab site publishes research videos and downloadable reprints ' +
        '(https://sites.harvard.edu/glauder/).',
      'Long-running collaborations with engineering groups on biorobotic fish platforms, including ' +
        'the multi-material 3D-printed morphing-fin robot in Soft Robotics 2018 ' +
        '(doi 10.1089/soro.2017.0085, via PubMed).',
      'Senior author on the 2021 PNAS comparative kinematics study spanning Harvard, Stockholm ' +
        'University, Yale, Aberystwyth, the University of Florida and the US Geological Survey ' +
        '(doi 10.1073/pnas.2113206118, via PubMed).',
    ],
    collaboration_angle:
      'The most unusual and possibly the cheapest bench route in the file: a physical model ' +
      'instead of an animal. If our fin-ratio prediction can be cast as a performance claim about ' +
      'fin area and stiffness, his robotic platform can test it with no IACUC approval, no ' +
      'husbandry and no four-month generation time — and a negative result there would stop us ' +
      'before we ever ask a fish lab for 30 animals per arm. WE would have to bring the claim in ' +
      'mechanical terms rather than genetic ones, the explicit labelling of which of our physics ' +
      'numbers are measured versus assumed transfers (the fin-area law is an assumed transfer and ' +
      'says so in the data file), and the wing-loading discrepancy stated as a known problem ' +
      'rather than buried.',
    openness_evidence: [
      {
        claim:
          'The lab site publishes research videos and downloadable reprints openly.',
        basis: 'stated',
        source: 'https://sites.harvard.edu/glauder/',
      },
      {
        claim:
          'Sustained co-authorship with mechanical-engineering and robotics groups at other ' +
          'institutions, with the engineering partners as first authors.',
        basis: 'stated',
        source: 'https://doi.org/10.1089/soro.2017.0085',
      },
      {
        claim:
          'Explicitly frames robotic platforms as systems for studying questions "difficult to ' +
          'analyze in freely swimming fishes", which is the opening for a model-based test of a ' +
          'computational prediction.',
        basis: 'stated',
        source: 'https://doi.org/10.1089/soro.2017.0085',
      },
    ],
    caution:
      'This is not a genetics lab and never will be: it cannot validate a CRISPR prediction, run ' +
      'our bench packages, or say anything about kcnk5b. A robotic test also answers a different ' +
      'question from the one our design claim makes — it would tell us whether a fin of that area ' +
      'performs, not whether a fish can be made to grow one — and conflating the two would be ' +
      'exactly the laundering our organism format exists to prevent. Our own physics layer is ' +
      'also honest that the fin-area law is an assumed transfer, so a biomechanist may reasonably ' +
      'conclude there is nothing yet to test.',
  },

  // ---------------------------------------------------------------------------- 11
  {
    id: 'adam-summers',
    name: 'Adam P. Summers',
    institution:
      'University of Washington, Friday Harbor Laboratories (Department of Biology and School of ' +
      'Aquatic and Fishery Sciences)',
    lab_url: 'https://www.adamsummers.org/',
    field:
      'Comparative biomechanics of fish skeletons; mineralised and tessellated cartilage; ' +
      'CT-based 3D morphology of ray-finned fishes; open 3D specimen data and visualisation ' +
      'software.',
    why_relevant_to_delphi:
      'Our morphology scorer is fitted on 4,673 real fish described by ten length ratios, and its ' +
      'demonstrated blind spot is anatomical: an animal whose snout and eye overhang the back of ' +
      'its head by 2% of body length — leaving no room for braincase, jaw, gills or operculum — ' +
      'is scored as typical. That failure is invisible in ratio space and obvious in a volume. ' +
      'He runs the largest effort to put fish anatomy into open 3D volumes, so he is the person ' +
      'who can tell us whether a geometric no-overlap check against real scanned skulls is ' +
      'feasible, and whether an open CT corpus could serve as the independent specimen set our ' +
      'benchmark needs. His tessellated-cartilage mechanics is also a reminder that identical ' +
      'external proportions can sit on materials differing roughly 45-fold in stiffness, which ' +
      'our trait vector cannot see at all.',
    flagship_papers: [
      {
        title:
          'Increasing the impact of vertebrate scientific collections through 3D imaging: The ' +
          'openVertebrate (oVert) Thematic Collections Network',
        year: 2024,
        journal: 'BioScience',
        doi: '10.1093/biosci/biad120',
        pmid: null,
        why_it_matters:
          'The open 3D specimen infrastructure that could supply an independent, volumetric test ' +
          'set for our scorer; verified via Crossref (36 authors, Summers among them).',
      },
      {
        title: 'Stress relaxation behavior of tessellated cartilage from the jaws of blue sharks',
        year: 2013,
        journal: 'Journal of the Mechanical Behavior of Biomedical Materials',
        doi: '10.1016/j.jmbbm.2013.08.014',
        pmid: '24055795',
        why_it_matters:
          'Quantifies how far material properties can diverge beneath identical geometry — a ' +
          'dimension our ratio-only traits discard.',
      },
      {
        title: 'Mineralized cartilage in the skeleton of chondrichthyan fishes',
        year: 2006,
        journal: 'Zoology',
        doi: '10.1016/j.zool.2006.03.002',
        pmid: null,
        why_it_matters:
          'The reference account of a skeletal tissue type whose constraints are mechanical rather ' +
          'than statistical; verified via Crossref (Dean, Summers).',
      },
      {
        title:
          'Stiffening the stingray skeleton - an investigation of durophagy in Myliobatid ' +
          'stingrays (Chondrichthyes, Batoidea, Myliobatidae)',
        year: 2000,
        journal: 'Journal of Morphology',
        doi: '10.1002/(SICI)1097-4687(200002)243:2<113::AID-JMOR1>3.0.CO;2-A',
        pmid: null,
        why_it_matters:
          'A worked case of inferring a functional bound from skeletal structure; verified via ' +
          'Crossref (Summers, sole author). Note the legacy bracketed DOI format.',
      },
    ],
    key_figures_or_findings: [
      'For loading parallel to the tessellated layer, the equilibrium modulus of that layer is ' +
        'about 45 times greater than that of uncalcified cartilage, while tessellation has ' +
        'relatively little effect on viscoelasticity under loading normal to the layer ' +
        '(J Mech Behav Biomed Mater 2013, doi 10.1016/j.jmbbm.2013.08.014, via PubMed).',
      'oVert describes building a multi-institution digitisation community producing high-fidelity ' +
        'online 3D digital specimens, and identifies remaining technological and social hurdles ' +
        '(BioScience 2024, doi 10.1093/biosci/biad120, verified via Crossref).',
      'His lab page lists #ScanAllFish, a project to CT-scan all ray-finned fishes, and free ' +
        'open-source software for 3D visualisation (https://www.adamsummers.org/).',
    ],
    real_quotes: [
      {
        quote:
          'High-fidelity digital 3D models allow people from multiple communities to ' +
          'simultaneously access and use scientific specimens.',
        source_title:
          'Increasing the impact of vertebrate scientific collections through 3D imaging: The ' +
          'openVertebrate (oVert) Thematic Collections Network',
        doi_or_url: 'https://doi.org/10.1093/biosci/biad120',
        context:
          'From the published abstract as served by Crossref. He is one of 36 co-authors, so this ' +
          'is a collective statement of the project he is part of, not a personal quotation.',
      },
      {
        quote:
          'Correlation of experimental data with present combined composite models showed that the ' +
          'equilibrium modulus of the tessellated layer for this loading direction is about 45 ' +
          'times greater than that for uncalcified cartilage.',
        source_title: 'Stress relaxation behavior of tessellated cartilage from the jaws of blue sharks',
        doi_or_url: 'https://doi.org/10.1016/j.jmbbm.2013.08.014',
        context:
          'From the published abstract (PubMed record for PMID 24055795). He is a co-author, not ' +
          'first or last; the sentence is the paper’s, not a personal statement.',
      },
    ],
    public_record: [
      'Professor at the University of Washington Friday Harbor Laboratories, appointed in the ' +
        'Department of Biology and the School of Aquatic and Fishery Sciences; the site also lists ' +
        'research associate positions at the Burke Museum of Natural History, the Museum of ' +
        'Vertebrate Zoology at UC Berkeley and the Los Angeles County Museum ' +
        '(https://www.adamsummers.org/).',
      'Site lists #ScanAllFish (CT-scanning all ray-finned fishes), free open-source 3D ' +
        'visualisation software, a #SciComm section and pages for Press, Teaching, Consulting and ' +
        'Editorial Positions.',
      'Co-author on the openVertebrate (oVert) Thematic Collections Network paper ' +
        '(doi 10.1093/biosci/biad120, verified via Crossref).',
    ],
    collaboration_angle:
      'No animals, no injections, and possibly no new data at all: the ask is whether an open CT ' +
      'corpus can be turned into a geometric viability check. Concretely — can we measure, on ' +
      'real scanned skulls, the actual envelope within which a snout-and-eye position leaves room ' +
      'for a braincase, jaw, gills and operculum, and use it as a hard constraint instead of a ' +
      'distance-to-cloud score? That converts our worst failure into a measurement. WE would have ' +
      'to bring the counter-example that motivates it (an anatomically impossible animal scored at ' +
      'q = 0.918, ranked more plausible than 1,279 of 4,673 real fish, which 20,000 draws from our ' +
      'fitted model never found but a search found at once), the statement that our scorer is a ' +
      'plausibility model rather than a viability model, and the engineering to do the volumetric ' +
      'work ourselves rather than asking his group to do it.',
    openness_evidence: [
      {
        claim:
          'Lists free open-source 3D visualisation software and the #ScanAllFish open-scanning ' +
          'project among the lab’s own activities.',
        basis: 'stated',
        source: 'https://www.adamsummers.org/',
      },
      {
        claim:
          'Co-authored a paper whose explicit purpose is making 3D data of museum specimens openly ' +
          'available to a broad audience including scientists, students, teachers and artists.',
        basis: 'stated',
        source: 'https://doi.org/10.1093/biosci/biad120',
      },
      {
        claim:
          'A lab organised around releasing specimen data and visualisation tools is the most ' +
          'likely on this list to say yes to a data-reuse question — though reuse of an open ' +
          'corpus needs no permission, which also means it needs no collaborator.',
        basis: 'inferred',
        source: 'Our reading of the lab page and the oVert paper.',
      },
    ],
    caution:
      'This is not a lab-in-the-loop candidate in the brief’s sense at all: no zebrafish, no ' +
      'CRISPR, no developmental genetics, and nothing that could run our bench package. It is a ' +
      'data and geometry partnership mislabelled if counted as a wet-lab one. Worse for the ' +
      'approach, the resource is already open — we can do the volumetric check without asking, so ' +
      'there is no favour to trade and no obvious reason for him to engage beyond interest. And ' +
      'the chondrichthyan skeletal work, which is the bulk of his mechanics, is largely irrelevant ' +
      'to a teleost fin-proportion programme.',
  },

  // ---------------------------------------------------------------------------- 12
  {
    id: 'ingo-braasch',
    name: 'Ingo Braasch',
    institution: 'Michigan State University, Department of Integrative Biology',
    lab_url: 'https://www.fishevodevogeno.org/',
    field:
      'Comparative teleost and ray-finned fish genomics; genome duplication and gene loss; ' +
      'orthology and conserved non-coding elements; evo-devo of fish gene function across gar, ' +
      'bowfin, zebrafish, medaka and killifishes.',
    why_relevant_to_delphi:
      'Everything downstream of a gene name in our pipeline depends on orthology being right, and ' +
      'we have already been bitten: our genotype thread had to settle lat4a = slc43a2a before the ' +
      'fin-ratio design could name a target at all, and our law layer nearly applied a bound on ' +
      'pectoral fin LENGTH / SL to the snout-to-fin-BASE distance — two names, two words apart, ' +
      'unrelated measurements. He works on exactly the failure mode that produces both: gene and ' +
      'trait identity after genome duplication. His lab’s framing of chromosome-level ' +
      'assemblies as the prerequisite for conserved-synteny-based orthology is the methodological ' +
      'check our cross-species claims currently lack, and the spotted gar bridge is the published ' +
      'route for deciding whether a zebrafish gene is the right counterpart of anything.',
    flagship_papers: [
      {
        title:
          'The spotted gar genome illuminates vertebrate evolution and facilitates human-teleost ' +
          'comparisons',
        year: 2016,
        journal: 'Nature Genetics',
        doi: '10.1038/ng.3526',
        pmid: '26950095',
        why_it_matters:
          'The reference resource for deciding whether a zebrafish gene corresponds to what a ' +
          'cross-species claim assumes it does.',
      },
      {
        title: 'The bowfin genome illuminates the developmental evolution of ray-finned fishes',
        year: 2021,
        journal: 'Nature Genetics',
        doi: '10.1038/s41588-021-00914-y',
        pmid: null,
        why_it_matters:
          'Extends that bridge and was co-authored with the fin-genetics group on this list; ' +
          'verified via Crossref (Thompson et al., Harris and Braasch last two).',
      },
      {
        title:
          'A new model army: Emerging fish models to study the genomics of vertebrate Evo-Devo',
        year: 2014,
        journal:
          'Journal of Experimental Zoology Part B: Molecular and Developmental Evolution',
        doi: '10.1002/jez.b.22589',
        pmid: null,
        why_it_matters:
          'States plainly why orthology calls in teleosts are hard and what is required to make ' +
          'them reliable; verified via Crossref.',
      },
    ],
    key_figures_or_findings: [
      'The slowly evolving spotted gar genome has conserved whole chromosomes from bony vertebrate ' +
        'ancestors, and conserved non-coding elements undetectable in direct human-teleost ' +
        'comparisons become apparent using gar as a bridge (Nat Genet 2016, doi 10.1038/ng.3526, ' +
        'via PubMed).',
      'For duplicated teleost genes, the sums of expression domains and expression levels often ' +
        'approximate the patterns and levels of the single gar gene, consistent with ' +
        'subfunctionalisation (same paper).',
      'Orthology calls in vertebrates, especially teleosts, are complicated by divergent evolution ' +
        'of gene repertoires and functions after two rounds of vertebrate genome duplication and a ' +
        'third at the base of teleosts (J Exp Zool B 2014, doi 10.1002/jez.b.22589, verified via ' +
        'Crossref).',
      'The lab released a chromosome-level genome assembly and NCBI RefSeq gene annotations for ' +
        'Nematolebias whitei publicly in December 2020, and lists Build-a-Fish and Killi-Kits as ' +
        'outreach tools (https://www.fishevodevogeno.org/).',
    ],
    real_quotes: [
      {
        quote:
          'The gar genome provides a resource for understanding evolution after genome ' +
          'duplication, the origin of vertebrate genomes and the function of human regulatory ' +
          'sequences.',
        source_title:
          'The spotted gar genome illuminates vertebrate evolution and facilitates human-teleost ' +
          'comparisons',
        doi_or_url: 'https://doi.org/10.1038/ng.3526',
        context:
          'Closing sentence of the published abstract (PubMed record for PMID 26950095). He is ' +
          'first author.',
      },
      {
        quote:
          'Orthology calls in vertebrates, especially in teleost fish, are complicated by ' +
          'divergent evolution of gene repertoires and functions following two rounds of genome ' +
          'duplication in the ancestor of vertebrates and a third round at the base of teleost ' +
          'fish.',
        source_title:
          'A new model army: Emerging fish models to study the genomics of vertebrate Evo-Devo',
        doi_or_url: 'https://doi.org/10.1002/jez.b.22589',
        context:
          'From the published abstract as served by Crossref. He is first author. This is the ' +
          'problem statement for the gene-identity errors our own pipeline has already made.',
      },
    ],
    public_record: [
      'Faculty in the Department of Integrative Biology at Michigan State University; runs the ' +
        'Fish Evo Devo Geno lab, which states it studies genomic and morphological change in ' +
        'vertebrates over macro-evolutionary timescales using gar, bowfin, zebrafish, medaka and ' +
        'killifishes (https://www.fishevodevogeno.org/).',
      'Released a public chromosome-level Rio Pearlfish genome assembly with NCBI RefSeq ' +
        'annotations (December 2020) and runs Build-a-Fish and Killi-Kits as public STEM outreach ' +
        '(same page).',
      'First author of the spotted gar genome paper (doi 10.1038/ng.3526, via PubMed) and senior ' +
        'author of the bowfin genome paper (doi 10.1038/s41588-021-00914-y, verified via ' +
        'Crossref); the lab page records joining the PASEDB Executive Council as Community ' +
        'Engagement Officer.',
    ],
    collaboration_angle:
      'The cheapest high-value ask in the file, and the one most likely to find a real error. ' +
      'Audit the gene- and trait-identity assumptions in our fin-ratio design and our edit plans: ' +
      'is lat4a = slc43a2a the right call, are the fin-size loci we name the orthologues the ' +
      'source papers meant, and does any cross-species transfer in our pipeline survive a ' +
      'synteny-based check? No animals, no injections, no approvals. WE would have to bring the ' +
      'genotype map and the reasoning behind each identity call, the law-mapping near-miss written ' +
      'up as a near-miss rather than a success, and an offer worth something in return — our ' +
      'orthology and trait-naming checks are reusable, and if a check of ours is useful he should ' +
      'get it as a tool rather than as a favour.',
    openness_evidence: [
      {
        claim:
          'Released a chromosome-level genome assembly with public RefSeq annotations, stated on ' +
          'the lab page as made publicly available.',
        basis: 'stated',
        source: 'https://www.fishevodevogeno.org/',
      },
      {
        claim:
          'Led and co-led very large international consortium genome papers (the gar paper has ' +
          'over 60 authors across more than a dozen countries).',
        basis: 'stated',
        source: 'https://doi.org/10.1038/ng.3526',
      },
      {
        claim:
          'Holds a stated community-engagement role (PASEDB Executive Council, Community ' +
          'Engagement Officer) and publishes outreach toolkits.',
        basis: 'stated',
        source: 'https://www.fishevodevogeno.org/',
      },
    ],
    caution:
      'Not a lab-in-the-loop partner for a morphological experiment: this is a genomics and ' +
      'evo-devo lab, and nothing in our bench packages is work it would run. The audit we want ' +
      'is also unglamorous — checking someone else’s gene-name assignments is a referee’s ' +
      'job, not a collaboration, and we should expect a pointer to the right database rather than ' +
      'an ongoing relationship. The one genuine risk of asking is that the answer is "your ' +
      'identity calls are wrong", which would invalidate parts of the design we have already ' +
      'built; that is a good reason to ask and a bad reason to expect him to enjoy it.',
  },
];

/**
 * FROZEN. What a lab-in-the-loop request actually costs the lab that says yes.
 * Written from our own bench-package work so the numbers are ours to defend, and
 * deliberately refuses to let the small consumables figure stand in for the real cost.
 */
export const WHAT_WE_WOULD_BE_ASKING = Object.freeze({
  summary:
    'A powerable version of our top-ranked zebrafish experiment is about 30 scorable animals ' +
    'per arm and roughly $169 in marginal consumables. That is small. It is also not the cost: ' +
    'the real cost is skilled time, not consumables. What we would actually be asking for is a ' +
    'trained person, a microinjection rig and four months of tank space, and we should say so ' +
    'first rather than lead with the cheap number.',

  the_small_number: Object.freeze({
    animals_per_arm: 30,
    what_that_number_counts:
      'Scorable adults that carry fin-expressing clones — NOT injected embryos. Two unpublished ' +
      'fractions sit between this number and the embryos to inject: survival of injected embryos ' +
      'to adulthood in that facility on that mix, and the fraction of surviving adults with ' +
      'marker-positive cells in the fins. The published effect size is conditioned on the second ' +
      'fraction, and the conditioning fraction itself is not published.',
    arms: 4,
    arms_detail:
      'Two published controls (marker-only, and a non-conductive channel variant) plus two doses. ' +
      'The controls are the experiment here, not an accessory to it.',
    marginal_consumables_usd: 168.6,
    marginal_consumables_basis:
      'What the package adds in a lab that already runs zebrafish injections. The whole parts ' +
      'list is $3,136.52, of which $2,967.92 is bulk salts, consumables and general kits such a ' +
      'lab already owns. Every price is a public list price read from the vendor page on a ' +
      'recorded date. No price is a quote; none includes shipping, tax or surcharges; academic ' +
      'buyers pay less on contract.',
    the_number_is_a_lower_bound:
      'The construct is not in Addgene or any searchable repository. In the source paper it was ' +
      'built from two gift plasmids and the specificity variant was made by PCR mutagenesis, so ' +
      'this line is either a request to a corresponding author — free, but on their timetable and ' +
      'subject to an MTA — or a cloning project of three constructs.',
    statistics_caveat:
      'The smallest expected cell count in the binding comparison is 0.200, below the usual 5 at ' +
      'which the normal approximation is trusted. Use Fisher’s exact test and expect it to ' +
      'need slightly MORE animals than 30, not fewer.',
  }),

  the_real_cost: Object.freeze([
    'A skilled person’s weeks. Microinjection of one-cell zygotes, raising injected fish to ' +
      'adulthood, blind scoring of a morphological endpoint, and per-animal record keeping. ' +
      'Labour is the largest real cost of all and is not in the $169 or the $3,136.',
    'About four months to an answer, because the readout is in adults. Four months of tank space ' +
      'is a scheduling commitment, not a consumable.',
    'Husbandry and facility costs, which for any case needing a generation dominate everything in ' +
      'the parts list.',
    'Imaging and scoring time: fluorescence screening of larvae, then adult scoring of local ' +
      'overgrowth against marker-positive mesenchyme in the same fin. Blind scoring costs more ' +
      'time than unblinded scoring, and we are asking for blind scoring.',
    'Capital we cannot supply: microinjection rig, stereoscope, micromanipulator, incubator. A ' +
      'lab either has these or the request is not addressed to the right lab.',
    'Institutional animal-care approval (IACUC or local equivalent) and biosafety registration ' +
      'for the nuclease and any synthetic nucleic acid, covering this line, these numbers and ' +
      'these endpoints. We cannot grant any of it and nothing starts without it.',
    'Institutional overhead, shipping, tax and vendor surcharges — one supplier in our list never ' +
      'publishes shipping at all.',
    'A missing positive control. There is no recorded published candidate for a construct known ' +
      'to integrate and express in fin tissue in a given facility. A lab new to this transgenesis ' +
      'route should run one before committing four months of tank space, and that pilot is on ' +
      'them, not us.',
    'The opportunity cost of saying yes: the same person, the same rig and the same tanks are the ' +
      'binding constraint on the lab’s own programme.',
  ]),

  what_a_fair_ask_looks_like: Object.freeze([
    'Ask for criticism before asking for animals. The first request is "tell us what is wrong ' +
      'with this before anyone orders anything" — blunt is more useful than polite — and it comes ' +
      'with the traps list, the stop rules and the ordering files.',
    'If our own power section refuses for lack of a number, that missing number is a literature ' +
      'or source-data question, not bench time. Do not spend a partner’s animals on our ' +
      'homework.',
    'Prefer asks with no animals in them at all where one exists: a trait-representation audit, a ' +
      'gene-identity audit, a constraint-derivation conversation, a physical model, or reuse of an ' +
      'already-open 3D corpus.',
    'Offer a scope the lab can decline in one line without it being awkward, and accept the ' +
      'decline.',
    'If it is run: blind scoring, both controls in the same session from the same clutch, ' +
      'per-animal values rather than summaries, and the return format supplied in advance.',
  ]),
});

/**
 * FROZEN and deliberately unflattering. Three measured negative results about our own
 * system, stated the way a careful scientist would want them stated before deciding
 * whether to spend their lab's time on us. These are reasons to say no. Hiding them
 * would make every other claim in this file worth less.
 */
export const WHAT_WE_BRING_HONESTLY = Object.freeze({
  stance:
    'Two of the three levels of our system come out at chance against external ground truth and ' +
    'one passes. A partner should hear all three before deciding, and should hear them from us ' +
    'rather than discover them.',

  negative_results: Object.freeze([
    Object.freeze({
      id: 'guide-ranking-is-uninformative',
      claim:
        'The score we rank CRISPR guides by is statistically indistinguishable from no ' +
        'information on zebrafish.',
      numbers:
        'Against 307 sgRNAs with activity measured in injected zebrafish embryos: Doench 2014 ' +
        'Rule Set 1, which our edit planner actually uses, gives Spearman rho = -0.037, 95% CI ' +
        '[-0.149, 0.073]. Our own heuristic gives 0.082, CI [-0.024, 0.196]. Both intervals ' +
        'straddle zero and Doench’s point estimate is slightly negative. CRISPRscan, fitted ' +
        'on zebrafish injections, reaches 0.269, CI [0.165, 0.364] — and that is an upper bound ' +
        'rather than an estimate, because it is being scored on the study that fitted it.',
      what_it_means_for_a_partner:
        'If we hand you a ranked guide list, the ranking carries no demonstrated information for ' +
        'your organism. We cannot promise you a good guide. This is a fact about OUR ranking, not ' +
        'a criticism of Doench 2014, which never claimed to transfer and whose own module text in ' +
        'our codebase calls it a transfer across species and assay.',
      source: 'benchmarks/crispr-ontarget/ (ground truth: doi 10.1038/nmeth.3543)',
    }),
    Object.freeze({
      id: 'morphology-scorer-calls-an-impossible-fish-typical',
      claim:
        'Our morphology scorer is a plausibility model, not a viability model, and distance to ' +
        'real fish does not bound anatomical possibility.',
      numbers:
        'Decoy-difficulty curve: AUC 0.891 against shuffled negatives falls to 0.536 — chance — ' +
        'against real fish nudged a quarter of a standard deviation. 12,152 of our 12,606 ' +
        'held-out negatives were shuffles, and a shuffle destroys exactly and only the ' +
        'trait-trait correlation a Mahalanobis distance detects. A constructed animal whose snout ' +
        'and eye overhang the back of its head by 2% of body length — no room for braincase, jaw, ' +
        'gills or operculum — scores q = 0.918 and ranks more plausible than 1,279 of 4,673 real ' +
        'fish; 20,000 draws from the fitted model never found it and a search found it at once. ' +
        'The worst law-derived violator is worse: a dorsal fin beginning 1.02 standard lengths ' +
        'from the snout, past the end of the fish, at q = 0.347, more typical than 4,068 of 4,673 ' +
        'real specimens (87.1%), against a median real fish of 0.650.',
      what_it_means_for_a_partner:
        'If we tell you a designed animal is plausible, we have told you it is close to the ' +
        'specimen cloud, and nothing about whether it could exist. The failure is specific to ' +
        'constraints whose boundary lies just outside the observed marginal range — which is ' +
        'where most anatomical impossibilities live.',
      source: 'benchmarks/design-hard-negatives/',
    }),
    Object.freeze({
      id: 'law-registry-barely-reaches-our-own-traits',
      claim:
        'Only 1 of the 48 theorem-carrying laws in our formal registry is expressible as a ' +
        'constraint on our own trait set — a rate of 2.1%.',
      numbers:
        'The ten traits are all length divided by standard length for one specimen; the registry ' +
        'mostly speaks in quantities those traits do not carry — two sizes (every allometry), a ' +
        'population, a power or oxygen budget, a genotype. One law is worse than unmeasurable: ' +
        'dividing an area by SL squared IS the law, so on normalised traits it is a tautology ' +
        'with nothing to forbid. The near miss is the instructive one: a law bounds pectoral fin ' +
        'LENGTH / SL to [0.406, 0.823] while our trait block carries the snout-to-fin-BASE ' +
        'distance — two words apart, unrelated measurements — and treating them as the same ' +
        'quantity would have applied a bound from 49 museum specimens to a different number ' +
        'entirely.',
      what_it_means_for_a_partner:
        'A law we cannot evaluate on our data is not yet a constraint on our design. When we say ' +
        'a design satisfies our formal layer, for 47 of 48 laws that statement is vacuous on the ' +
        'traits we actually carry.',
      source: 'benchmarks/design-hard-negatives/laws.mjs',
    }),
  ]),

  what_does_pass: Object.freeze({
    claim:
      'The formal layer itself holds up, and it is the one thing we can offer without ' +
      'qualification.',
    numbers:
      'All 48 laws carrying a Lean module and theorem also carry a machine-checked non-vacuity ' +
      'witness, depending only on propext, Classical.choice and Quot.sound — no sorry, no ' +
      'project-specific axiom. In mutation testing, 1 mutant was refuted and the control behaved. ' +
      'A theorem with unsatisfiable hypotheses is vacuously true and proves nothing; this is the ' +
      'first thing to check in a law registry and the check most registries have no field for.',
    honest_scope:
      'Two targets and three mutants. A method and a first result, not a coverage figure over the ' +
      '48 laws.',
  }),

  also_true_and_also_unflattering: Object.freeze([
    'On our own flagship design, the portable organism file declares 15 values of which 9 are ' +
      'not-established and 4 assumed; a simulator may use 2 of them. The pre-registered scorecard ' +
      'could score 1 of 10 declared phenotypic axes, and the axis the whole design claim rests on ' +
      '— pectoral fin length / SL — is not the one it could score.',
    'Our development layer does not simulate development. Length grows along a published curve ' +
      'and proportions change along fits to measured specimens; nothing models cells, genes or ' +
      'tissues producing a shape. Several relations in it are labelled assumed or assumed ' +
      'transfer, including the fin-area law, and the wing loading it implies disagrees with the ' +
      'published exponent.',
    'Our CRISPRscan reimplementation failed on its first run, because the genomic windows were ' +
      'built from scan coordinates that are correct on the plus strand and wrong on the minus ' +
      'strand. Only 5 of 25 protospacers sat where the arithmetic said, and the offset sweep then ' +
      'showed a best fit at the WRONG offset. We keep that in the record on purpose.',
    'We have no animals, no facility, no approvals and no reagents. Everything we can contribute ' +
      'is code, derivations, provenance discipline and benchmarks that are allowed to come out ' +
      'badly.',
  ]),

  why_this_is_stated_up_front:
    'A productivity figure cannot come out badly. "61 laws registered" and "AUC 0.89" measure how ' +
    'much was built. A benchmark has to be able to come out badly, which means the answer has to ' +
    'come from somewhere the system does not control. Ours did, twice, and came out at chance. A ' +
    'careful scientist should weigh that before giving us a person’s weeks, and would be ' +
    'right to say no.',
});

export default { CANDIDATES, WHAT_WE_WOULD_BE_ASKING, WHAT_WE_BRING_HONESTLY, DOI_VERIFICATION };
