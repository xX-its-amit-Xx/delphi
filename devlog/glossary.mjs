// glossary.mjs - every technical term in the dev log, defined from THIS repository.
//
// ============================== WHAT THIS IS FOR ==============================
// A dev log that uses "ohnolog", "ZNGI", "non-vacuity" and "q = D^2/d" in the same paragraph is
// unreadable to anyone who has not read the modules. So every such term is clickable, and what opens is
// not a textbook definition: it is what the term means HERE, with the number this repository actually
// measured attached to it.
//
// Three rules the entries follow, because a glossary is the easiest place in a project to write something
// confidently wrong:
//
//   1. `concrete_example` is REQUIRED and must carry a real value from this repo where one exists. "e.g. a
//      gene" teaches nothing. "q = 0.918, more typical than 1,279 of 4,673 real fish" is the finding.
//   2. `long` names the thing a newcomer gets wrong. Most of these terms are not hard to define and are
//      very easy to misuse - orthology read as functional equivalence, a Carnegie stage subtracted from
//      another, an AUC read as a property of the scorer rather than of its decoys.
//   3. A term that could not be defined well goes in UNDEFINED_BUT_USED rather than getting a vague
//      entry. A glossary that covers everything is a glossary that is bluffing somewhere.
//
// HOLDOUT: one clade is a frozen evaluation holdout (holdout/split.json). No entry here names a member of
// it, and where that clade would be the obvious example, a different one is used and nothing is
// substituted for the comparison. Run `node holdout/check-leaks.mjs devlog`.
//
//   import { GLOSSARY, lookup, annotate, UNDEFINED_BUT_USED } from './glossary.mjs';

export const CATEGORIES = Object.freeze([
  'genomics', 'evolution', 'development', 'ecology', 'statistics', 'formal-methods', 'engineering',
  'project-specific',
]);

const e = o => Object.freeze({ ...o, aliases: Object.freeze(o.aliases), see_also: Object.freeze(o.see_also) });

export const GLOSSARY = Object.freeze([

  // =================================================================================================
  // genomics
  // =================================================================================================
  e({
    id: 'ortholog',
    term: 'ortholog',
    aliases: ['orthologue', 'orthologs', 'orthologues', 'orthology'],
    short: 'Two genes in different species that descend from a single gene in their common ancestor, separated by speciation rather than duplication.',
    long: 'Orthology is a statement about the branching history of a gene family: the last event separating the two copies was a species split. It is the most-used mapping in this pipeline and the most over-read one. The newcomer error is to treat "orthologue" as "does the same job" - orthology ranks by ancestry and says nothing about current function, and orthology calls themselves differ between methods on identical genomes (Altenhoff 2016), so "the orthologue" is method-dependent before it is anything else.',
    concrete_example: 'analogues/analogy.mjs gives bare sequence-orthology a support band of [0.20, 0.60] for a one-to-one call and [0.05, 0.40] for one-to-many, and refuses an orthology claim that does not state its homology type at all.',
    why_it_matters_here: 'Every borrow DELPHI designs rests on a gene-to-gene mapping, and the pipeline upstream of analogy.mjs answered that question with orthology as though orthology were the answer.',
    see_also: ['paralog', 'ohnolog', 'homology', 'the ortholog conjecture', 'one-to-many orthology', 'synteny'],
    category: 'genomics',
  }),
  e({
    id: 'paralog',
    term: 'paralog',
    aliases: ['paralogue', 'paralogs', 'paralogues', 'paralogy'],
    short: 'Two genes related by a duplication event rather than a speciation, so both can sit inside one genome.',
    long: 'Paralogues arise when a gene is copied within a lineage. The error is to rank them below orthologues for function by default: after a duplication the two copies commonly split the ancestral job, so the copy that inherited the function you care about may be a paralogue of the gene an orthology table nominates. Paralogy is also the first explanation for a knockout with no phenotype, because the sibling copy covers what was removed.',
    concrete_example: 'kcnk5a and kcnk5b are the pair in this repo: crossgraph/README.md records that both map to the single human KCNK5, and the literature attributes the ABSENT kcnk5b loss-of-function phenotype to redundancy between exactly that pair.',
    why_it_matters_here: 'kcnk5b carries the strongest sufficiency claim in the design inventory and the weakest necessity claim, for a reason that is specifically about being one of a pair.',
    see_also: ['ortholog', 'ohnolog', 'subfunctionalisation', 'knockout', 'transcriptional adaptation'],
    category: 'genomics',
  }),
  e({
    id: 'ohnolog',
    term: 'ohnolog',
    aliases: ['ohnologue', 'ohnologs', 'ohnologues'],
    short: 'A paralogue pair created by a whole-genome duplication rather than a local one - named after Susumu Ohno.',
    long: 'Ohnologs are the specific case where the duplication was the entire genome, so the two copies started out in corresponding neighbourhoods on different chromosomes. The distinction from a recent tandem or local duplication is not cosmetic, because it changes what you expect of the pair, and the evidence that separates them is conserved synteny rather than sequence similarity. The common mistake is calling any duplicate pair in a teleost an ohnolog pair because teleosts had a genome duplication.',
    concrete_example: 'analogy.mjs records that it is NOT established whether kcnk5a and kcnk5b arose at the teleost-specific whole-genome duplication or by a later local duplication, because no synteny analysis of the pair is held in this repo.',
    why_it_matters_here: 'It is the cleanest case in the repository of a claim that sounds settled, is widely assumed, and has no evidence filed behind it.',
    see_also: ['paralog', 'synteny', 'teleost genome duplication', 'one-to-many orthology'],
    category: 'genomics',
  }),
  e({
    id: 'synteny',
    term: 'synteny',
    aliases: ['syntenic', 'conserved synteny'],
    short: 'Two loci sitting in corresponding genomic neighbourhoods - the same genes, in the same order, around each.',
    long: 'Conserved synteny is the strongest evidence in this project for an ANCESTRY claim: it corroborates that an orthology call is right, and it is the main way to tell an ohnolog pair from a recent local duplication. It is also zero evidence about function, in any degree, and it is the evidence kind most often cited as though that distinction did not exist. Neighbourhood is not job.',
    concrete_example: 'analogy.mjs gives synteny a base band of [0.10, 0.40] and a corroboration weight of 0.5, raised to 0.75 under ALT_BANDS - the sceptic weighting - precisely because it is what distinguishes an ohnolog pair from a local duplication.',
    why_it_matters_here: 'The synteny check that would settle the kcnk5a/kcnk5b origin question is the single missing measurement behind the repo\'s most load-bearing gene claim.',
    see_also: ['ohnolog', 'ortholog', 'analogy', 'homology'],
    category: 'genomics',
  }),
  e({
    id: 'one-to-many-orthology',
    term: 'one-to-many orthology',
    aliases: ['one-to-many', 'many-to-many', 'co-orthologue', 'duplicate-pair problem'],
    short: 'When one gene in species A corresponds to two or more in species B, so the phrase "the orthologue in B" does not denote anything.',
    long: 'A one-to-many relationship is not an imprecise one-to-one; there is no single object for the phrase to pick out. Picking one of the copies and calling it "the" orthologue is a category error rather than an approximation, and under subfunctionalisation neither copy is the functional equivalent, because neither does the whole job. It shows up at the bench as a partial or absent phenotype that reads as "this gene is not required".',
    concrete_example: 'analogy.mjs refuses to call a one-to-many orthologue a functional equivalent, and gives the honest mapping as a SET: human KCNK5 -> { kcnk5a, kcnk5b }, with the division of labour unknown.',
    why_it_matters_here: 'This is the failure mode of the exact organism the repository designs in, so the refusal is not hypothetical hygiene.',
    see_also: ['ortholog', 'ohnolog', 'teleost genome duplication', 'subfunctionalisation'],
    category: 'genomics',
  }),
  e({
    id: 'crispr',
    term: 'CRISPR',
    aliases: ['CRISPR-Cas9', 'CRISPR editing'],
    short: 'A programmable nuclease system: an RNA guide takes a protein nuclease to a matching DNA site and the protein cuts it.',
    long: 'In this repository CRISPR is a cutting system, not an editing system: it makes a double-strand break, and what happens afterwards is repair, which is where knock-in versus indel is decided. The newcomer error is to treat "we have a good guide" as "we have an edit" - cutting well and mattering are different claims, and in the programme the benchmark was built for, the knockouts are phenotypically normal.',
    concrete_example: 'Two of the three worked design requests in analogues/cases.mjs turn out not to be genome-editing problems at all; the glowing-fly case is a transgenesis problem, and the pipeline produced a cassette for it anyway.',
    why_it_matters_here: 'Fluency is named as Delphi\'s characteristic failure: a design system will emit a cassette for any request put to it.',
    see_also: ['Cas9', 'PAM', 'sgRNA', 'HDR', 'NHEJ', 'cassette', 'Delphi'],
    category: 'genomics',
  }),
  e({
    id: 'cas9',
    term: 'Cas9',
    aliases: ['SpCas9', 'Cas9 nuclease'],
    short: 'The RNA-guided nuclease itself; the Streptococcus pyogenes version (SpCas9) makes a blunt cut 3 bp from its PAM.',
    long: 'Cas9 is loaded with a guide RNA, scans for a PAM, checks the adjacent 20 nt against the guide, and cuts both strands. Everything geometric in a cassette layout is measured from that cut, so the enzyme variant is not an implementation detail: a different Cas protein has a different PAM, a different spacer length, and in some cases a staggered rather than blunt break. An off-by-one in the cut position designs an insertion one base off and nothing downstream complains.',
    concrete_example: 'align.mjs cutSite() places the blunt break between the bases at pamIndex-4 and pamIndex-3, i.e. between spacer positions 17 and 18 counting from the PAM-distal end of a 20 nt spacer, labelled basis "mechanistic".',
    why_it_matters_here: 'All cassette coordinates in the repo are relative to that one number, which is why it is stated with its basis rather than inlined.',
    see_also: ['CRISPR', 'PAM', 'protospacer', 'spacer', 'sgRNA'],
    category: 'genomics',
  }),
  e({
    id: 'pam',
    term: 'PAM',
    aliases: ['NGG', 'protospacer adjacent motif'],
    short: 'The short motif immediately 3\' of the target site that the nuclease must recognise before it will cut - no PAM, no cut.',
    long: 'For SpCas9 the PAM is NGG, three bases on the same strand as the protospacer and immediately downstream of it. It is a property of the protein, not of the guide, which is why you cannot target an arbitrary position: the available cut sites in a locus are set by where the PAMs are. The error is designing the edit first and looking for a PAM afterwards.',
    concrete_example: 'layoutCassette() refuses with rule `pam_missing` when locus.sequence[pamIndex..pamIndex+2] does not match /^[ACGT]GG$/, on the grounds that the cut site the cassette is positioned against does not exist.',
    why_it_matters_here: 'It is one of the four numbers the cassette module enforces with a stated basis ("definitional") rather than a remembered convention.',
    see_also: ['Cas9', 'protospacer', 'spacer', 'cassette'],
    category: 'genomics',
  }),
  e({
    id: 'protospacer',
    term: 'protospacer',
    aliases: ['protospacers'],
    short: 'The 20 nt of GENOMIC DNA immediately 5\' of the PAM: the target itself, not the guide that pairs with it.',
    long: 'Protospacer and spacer are two sides of one pairing: the protospacer is in the genome, the spacer is in the guide RNA. Keeping them separate matters because an oligo as ordered is often not the protospacer - a T7 transcription template carries added 5\' G residues that are not genomic, so matching the oligo against a genome fails or matches the wrong place.',
    concrete_example: 'benchmarks/crispr-ontarget queries each guide with its 3\'-most 20 nt and then defines the protospacer as the 20 nt immediately 5\' of the PAM, which lets an 18-mer and a 22-mer oligo be scored on the same genomic site; 307 of 499 located uniquely in GRCz11.',
    why_it_matters_here: 'Without that convention the benchmark would have silently scored 191 unlocated guides as a random sample rather than reporting them as a selection.',
    see_also: ['PAM', 'spacer', 'Cas9', 'sgRNA'],
    category: 'genomics',
  }),
  e({
    id: 'spacer',
    term: 'spacer',
    aliases: ['guide sequence', 'spacer sequence'],
    short: 'The 20 nt variable part of the guide RNA that base-pairs with the protospacer and sets where the cut lands.',
    long: 'The spacer is the only part of the guide you choose, and its length is definitional rather than adjustable: shorten or lengthen it and the cut geometry the whole cassette is positioned against moves by that offset, while the construct still looks correct. Two sequence features reject a spacer outright rather than merely deprioritising it, and one of them is invisible to the eye because the spacer is still a valid 20-mer.',
    concrete_example: 'validateSpacer() hard-rejects any run of 4 or more T (an RNA polymerase III termination signal, so a U6-driven guide is truncated or absent) and only FLAGS a GC fraction outside 40-80 %, because that band is a design-tool convention with no efficiency figure attached.',
    why_it_matters_here: 'It is the repository\'s cleanest example of separating a mechanistic rule from a convention instead of enforcing both at the same strength.',
    see_also: ['protospacer', 'sgRNA', 'PAM', 'promoter', 'cassette'],
    category: 'genomics',
  }),
  e({
    id: 'sgrna',
    term: 'sgRNA',
    aliases: ['single-guide RNA', 'guide RNA', 'sgRNAs'],
    short: 'The chosen 20 nt spacer fused to a constant ~76 nt scaffold that Cas9 binds; the spacer alone is an inert 20-mer.',
    long: 'A single-guide RNA fuses what were originally two RNAs (the crRNA repeat and the tracrRNA) into one molecule. The scaffold is constant, which makes it easy to forget, and that is exactly where a specific failure hides: a truncated or mutated stem-loop stops Cas9 loading, and the symptom - "the guide does not work" - is then chased in the spacer.',
    concrete_example: 'CASSETTE_PARTS.sgrna_scaffold records 76-82 nt with basis "definitional", and SGRNA_PART_ORDER keeps the sgRNA unit (promoter, spacer, scaffold) as a SEPARATE construct from the donor - putting the spacer inside the donor cassette is refused, not laid out.',
    why_it_matters_here: 'It is a recoverable design error the layout engine refuses rather than silently rendering, which is the pattern the whole module follows.',
    see_also: ['spacer', 'Cas9', 'promoter', 'cassette'],
    category: 'genomics',
  }),
  e({
    id: 'hdr',
    term: 'HDR',
    aliases: ['homology-directed repair', 'homology directed repair'],
    short: 'Repair that copies a donor template into a break using flanking sequence identity - the only route that installs a designed insert.',
    long: 'HDR is what turns a cut into an edit: the cell finds sequence matching the regions either side of the break and templates the repair from it. It competes with end-joining and usually loses, which is why arm length, donor form and cell-cycle state all matter. The newcomer error is to expect an efficiency number; this repository asserts none anywhere, and labels every threshold definitional, mechanistic or conventional instead.',
    concrete_example: 'WHAT_THIS_DOES_NOT_PREDICT in align.mjs opens with "HDR efficiency. No number here predicts it", and homologyArmAdvice() returns a BAND (30-60 nt for ssODN, 500-1000 bp for plasmid) with basis "conventional" rather than an optimum.',
    why_it_matters_here: 'Refusing to assert an efficiency is the aletheia discipline applied to a module that would look more useful with a fabricated percentage in it.',
    see_also: ['NHEJ', 'homology arm', 'cassette', 'knock-in', 'Aletheia'],
    category: 'genomics',
  }),
  e({
    id: 'nhej',
    term: 'NHEJ',
    aliases: ['non-homologous end joining', 'end-joining', 'MMEJ'],
    short: 'Repair that rejoins a break directly, without a template, usually leaving a small insertion or deletion at the join.',
    long: 'End-joining is the default outcome of a Cas9 cut and the mechanism behind most knockouts: the indel shifts the reading frame and the protein is lost. It is also what you get when an HDR design fails, which is the trap - the experiment produces edited cells either way, so a knock-in attempt that silently became a knockout still yields sequencing reads and selected clones.',
    concrete_example: 'CASSETTE_PARTS.homology_arm_5 states the consequence of omitting the arm outright: "there is no HDR at all - the donor cannot be templated in, and the cut repairs by NHEJ/MMEJ into indels".',
    why_it_matters_here: 'Every `failure` field in the cassette vocabulary is written to describe the construct that still assembles and still sequences, which is the only kind of error worth a vocabulary.',
    see_also: ['HDR', 'knockout', 'knock-in', 'homology arm'],
    category: 'genomics',
  }),
  e({
    id: 'homology-arm',
    term: 'homology arm',
    aliases: ['homology arms', 'arm length'],
    short: 'Donor sequence matching the genome either side of the cut; the strand-invasion substrate that makes repair homology-directed.',
    long: 'Arms are what make a donor a template rather than a loose piece of DNA. Two things go wrong quietly. Too short, and HDR collapses while the surviving events are enriched for one-sided integration - which a single junction PCR scores as correct. Asymmetric, and you get one clean junction and one ragged one, and the usual 5\'-junction PCR calls the clone correct.',
    concrete_example: 'CASSETTE_LIMITS enforces a floor of 300 bp per arm for a dsDNA or plasmid donor and 30 nt for an ssODN donor; below it layoutCassette() returns refused with rule `homology_arm_too_short` and the enforced number, basis and source attached, rather than laying out a cassette that cannot work.',
    why_it_matters_here: 'The floor is labelled "conventional" and described as permissive rather than a target, so the number cannot be quoted back as a measured cliff.',
    see_also: ['HDR', 'cassette', 'knock-in', 'NHEJ'],
    category: 'genomics',
  }),
  e({
    id: 'safe-harbour',
    term: 'safe harbour',
    aliases: ['safe harbor', 'safe-harbour locus'],
    short: 'A genomic location chosen for an insertion because it supports expression without disrupting anything nearby.',
    long: 'A safe harbour is where you put a construct when the point is to ADD a function rather than alter one. The error is treating it as a free slot: "safe" is a claim about the neighbourhood that has to be supported for the organism and locus in question, and an inserted cassette can still act on transcription next door. Where the goal is addition, the older transgenesis routes are often simpler than a targeted knock-in.',
    concrete_example: 'analogues/cases.mjs treats the glowing-fly request this way: no endogenous fly gene is altered, so germline transgenesis (P-element, or phiC31 at an attP site) is the standard route and CRISPR knock-in at a safe harbour is recorded as possible but not required.',
    why_it_matters_here: 'It is one of the two worked requests that turned out not to be a genome-editing problem, which is the evidence behind the "fluency" criticism of the design layer.',
    see_also: ['transgenesis', 'knock-in', 'cassette', 'CRISPR'],
    category: 'genomics',
  }),
  e({
    id: 'cassette',
    term: 'cassette',
    aliases: ['knock-in cassette', 'HDR cassette', 'donor cassette'],
    short: 'The ordered construct that gets inserted - arms, promoter, coding sequence, tag, terminator, marker - each with its own failure mode.',
    long: 'A cassette is a layout problem as much as a sequence problem, because the parts have an order and the junctions between them are where frame slips and read-through live. The part that is most often omitted is the one whose absence leaves the construct looking complete; the part most often mis-sized is the one whose length is not a multiple of three at a fusion junction.',
    concrete_example: 'DONOR_PART_ORDER is [homology_arm_5, promoter, cds, linker, tag, terminator, selection_marker, homology_arm_3]; layoutCassette() sorts a spec into that order, reports `reordered: true` when it had to, and returns junction sequences with 12 bp of flank on each side for primer design.',
    why_it_matters_here: 'The repo\'s design layer will produce a cassette for any request put to it, so the vocabulary that says what each part is FOR is also the vocabulary that shows when none of them was needed.',
    see_also: ['homology arm', 'promoter', 'terminator', 'knock-in', 'HDR'],
    category: 'genomics',
  }),
  e({
    id: 'promoter',
    term: 'promoter',
    aliases: ['promoters', 'U6 promoter'],
    short: 'The regulatory sequence that drives transcription of what follows it; which promoter you need depends on what reads it.',
    long: 'A promoter is not a generic "on" part. Two distinct errors appear in the cassette vocabulary: adding one to an in-frame fusion knock-in, where the HOST promoter should drive the insert, gives a second unregulated transcript; and truncating one removes the distal regulatory elements first, so expression survives in the cell line you test and fails in the tissue you care about. For guides there is a third: a polymerase mismatch.',
    concrete_example: 'CASSETTE_PARTS.sgrna_promoter records that a T7 unit delivered as plasmid DNA is not transcribed in the cell and a U6 unit used for in-vitro transcription is not transcribed in the tube - and that U6, being Pol III, also constrains the spacer via the 4+ T termination signal.',
    why_it_matters_here: 'It is the clearest case in the module where choosing the wrong part, not omitting one, is the realistic error.',
    see_also: ['terminator', 'cassette', 'spacer', 'sgRNA'],
    category: 'genomics',
  }),
  e({
    id: 'terminator',
    term: 'terminator',
    aliases: ['polyA', 'polyadenylation signal', 'terminator region'],
    short: 'The sequence that ends transcription and adds the polyA tail; leave it out and transcription runs into the neighbouring genome.',
    long: 'A terminator is the classic omission, because a cassette still looks complete without one. The consequence is read-through: long chimeric transcripts, non-polyadenylated and therefore unstable mRNA, and interference with the next gene along. None of that announces itself as a missing part; it reads as poor expression.',
    concrete_example: 'CASSETTE_PARTS.terminator gives 100-800 bp with the note that common polyA signals (SV40, bGH) sit in the 130-250 bp range, and names read-through as "the classic omission because the cassette still looks complete without it".',
    why_it_matters_here: 'Each part\'s `failure` field exists so the dev log can say what a missing part does, rather than only that the part is missing.',
    see_also: ['promoter', 'cassette', 'knock-in'],
    category: 'genomics',
  }),
  e({
    id: 'transgenesis',
    term: 'transgenesis',
    aliases: ['transgenic', 'germline transgenesis'],
    short: 'Adding exogenous DNA to a genome at a site of the method\'s choosing, rather than editing a chosen endogenous locus.',
    long: 'Transgenesis predates CRISPR and remains the right answer whenever the goal is to ADD a function rather than change one - a reporter, an extra copy, a heterologous protein. The error this project made is the reverse of the usual one: reaching for genome editing because the pipeline is an editing pipeline, when the request did not involve altering any endogenous gene.',
    concrete_example: 'cases.mjs records the P-element route and the phiC31 integrase route (Groth 2004), where fertile injected adults produced transgenic offspring and 100 % of those progeny carried a precise insertion - "transgenesis is simpler, older and better characterised" than a knock-in for a reporter.',
    why_it_matters_here: 'Named explicitly as the right deliverable for one of the three worked requests, against a pipeline whose only design surface is an edit list.',
    see_also: ['safe harbour', 'knock-in', 'CRISPR', 'Delphi'],
    category: 'genomics',
  }),
  e({
    id: 'knock-in',
    term: 'knock-in',
    aliases: ['knockin', 'knock-ins'],
    short: 'Installing a designed sequence at a chosen genomic position, usually by HDR from a donor whose arms match the cut site.',
    long: 'A knock-in is a cut plus a template plus the cell choosing the templated route. Its characteristic silent failure is frame: an insert whose length is not a multiple of three at a fusion junction shifts everything downstream, and the construct still assembles, still sequences, and produces nothing. The check is the junction frame, not the total length - and nothing in this repository translates, so nothing here verifies it.',
    concrete_example: 'CASSETTE_LIMITS.maxInsert caps the sequence between the arms at 5,000 bp as a stated convention - "knock-in protocols are written for inserts of a few kb and switch to other strategies (integrase, recombinase landing pad, serial knock-in) beyond that" - with no efficiency claim for any size.',
    why_it_matters_here: 'Frame verification at a fusion junction is on the explicit list of things the module does NOT predict, which is where a dashboard would otherwise imply it does.',
    see_also: ['HDR', 'cassette', 'homology arm', 'knockout', 'safe harbour'],
    category: 'genomics',
  }),
  e({
    id: 'knockout',
    term: 'knockout',
    aliases: ['knock-out', 'knockouts', 'loss of function', 'loss-of-function'],
    short: 'Destroying a gene\'s function, typically by an end-joining indel that shifts the frame, to ask what the gene was needed for.',
    long: 'A knockout tests necessity, one-sidedly: it shows the gene is required for something, never that it could do another gene\'s job. The hard part is a knockout with NO phenotype, which is consistent with three different situations that look identical from outside - redundancy with a paralogue, transcriptional adaptation, and the gene genuinely being dispensable - and nothing in the knockout distinguishes them.',
    concrete_example: 'analogy.mjs gives loss-of-function phenotype similarity a band of [0.25, 0.65] and states that an ABSENT phenotype establishes least of all, citing Rossi 2015 and El-Brolosy 2019; kcnk5b is the repo\'s instance.',
    why_it_matters_here: 'The gene with the strongest sufficiency claim in the design inventory has its necessity evidence missing for exactly this reason.',
    see_also: ['knock-in', 'NHEJ', 'paralog', 'transcriptional adaptation', 'rescue'],
    category: 'genomics',
  }),
  e({
    id: 'rescue',
    term: 'rescue',
    aliases: ['complementation', 'cross-species complementation', 'rescue experiment'],
    short: 'Putting a candidate gene into a background missing that function and asking whether it returns - the only direct test of function.',
    long: 'Of the seven evidence kinds in analogy.mjs, rescue is the only one that asks the question of interest instead of a correlate of it. It is still not a blank cheque: rescue is directional (B rescuing A does not entail the reverse), assay-specific, and context-specific, and a FAILURE to rescue is weak evidence against analogy because it can fail on codon usage, folding, dose or timing.',
    concrete_example: 'Kachroo 2015 replaced 414 essential yeast genes with their human orthologues one at a time and roughly half could not do the job - which analogy.mjs uses as the base rate for "orthologous means interchangeable" in the most favourable case imaginable.',
    why_it_matters_here: 'It sets the ceiling the whole analogy module is calibrated against: the strongest available evidence kind still earns only a [0.55, 0.90] band.',
    see_also: ['analogy', 'ortholog', 'knockout', 'the ortholog conjecture'],
    category: 'genomics',
  }),
  e({
    id: 'transcriptional-adaptation',
    term: 'transcriptional adaptation',
    aliases: ['genetic compensation', 'transcriptional compensation'],
    short: 'Degradation of a mutant transcript upregulating a related gene, so the mutant looks healthy for a reason unrelated to redundancy.',
    long: 'Transcriptional adaptation is an active response to the mutant mRNA, not passive backup by a sibling copy. It matters because it is a second, independent explanation for a silent knockout that is indistinguishable from redundancy without further measurement. Distinguishing them requires measuring the paralogue\'s transcript in the mutant, which is a different experiment from the knockout itself.',
    concrete_example: 'analogy.mjs lists the missing measurement explicitly: "distinguishing redundancy from transcriptional adaptation requires measuring kcnk5a transcript in a kcnk5b mutant, and that measurement is not held here either".',
    why_it_matters_here: 'It is why "no phenotype" cannot be reported as "not required" anywhere in this repository without naming which of the three explanations was excluded.',
    see_also: ['knockout', 'paralog', 'subfunctionalisation'],
    category: 'genomics',
  }),
  e({
    id: 'transcriptome',
    term: 'transcriptome',
    aliases: ['transcriptomic', 'transcript profile'],
    short: 'The set of RNA transcripts present in a sample, used as a proxy for which genes are active there.',
    long: 'A transcriptome is a snapshot of transcripts, and three gaps separate it from function: transcript presence is not protein presence, protein presence is not activity, and a transcriptome measured after dissociation has thrown away the neighbour relations that a multicellularity claim is about. The third is why the `.life` format makes an in-situ flag mandatory on the channel rather than optional metadata.',
    concrete_example: 'In the committed mouse-preimplantation example the transcriptome channel is in the vocabulary and present on 0 of 31 cells - UTMM measures it per cell in situ across 742 cells and 69 embryos, "and we have the paper, not the data".',
    why_it_matters_here: 'The coverage counter reports present-on-N-of-M rather than a boolean, so an empty channel cannot read as a populated one.',
    see_also: ['in situ', 'compliance vs modulus', 'provenance', 'blastomere'],
    category: 'genomics',
  }),
  e({
    id: 'percent-identity',
    term: 'percent identity',
    aliases: ['% identity', 'pairwise identity', 'percent id'],
    short: 'Identical aligned residues over a denominator - and there are three defensible denominators, which is the whole problem.',
    long: 'Identity over gap-free columns ignores every indel; identity over the shorter sequence is the usual choice when one input is a fragment; identity over total alignment length penalises the length difference itself. Papers rarely say which they used, and the three can differ by tens of points on the same alignment. Picking one silently is how the ambiguity does its damage.',
    concrete_example: 'percentIdentity() returns all three with their denominators spelled out; test-align.mjs pins one alignment where they come out 80.0 / 66.7 / 50.0.',
    why_it_matters_here: 'The 30 % identity floor this project cites from Rost 1999 is meaningless without knowing which denominator it is 30 % of.',
    see_also: ['Needleman-Wunsch', 'Smith-Waterman', 'affine gap', 'BLOSUM62', 'homology'],
    category: 'genomics',
  }),
  e({
    id: 'blosum62',
    term: 'BLOSUM62',
    aliases: ['BLOSUM', 'substitution matrix'],
    short: 'A published amino-acid substitution matrix of log-odds scores in half-bits - the NCBI BLAST protein default.',
    long: 'BLOSUM62 scores a substitution by how often it is observed in aligned blocks relative to chance, so a conservative swap costs little and a radical one costs a lot. Two things trip people up: the entries are log-odds in half-bits rather than any kind of probability, and the ambiguity rows (B, Z, X) and the stop row (*) are part of the matrix, so a sequence containing an unexpected character needs a declared fallback rather than an exception.',
    concrete_example: 'align.mjs carries the matrix as data with `fallback: -4` ("anything outside the alphabet scores as the * row does"), and test-align.mjs asserts its symmetry plus spot checks, because a transcription slip in a 24x24 table is otherwise invisible.',
    why_it_matters_here: 'It is the one place a hand-transcribed published table enters the codebase, so the test is the provenance.',
    see_also: ['percent identity', 'Needleman-Wunsch', 'affine gap'],
    category: 'genomics',
  }),

  // =================================================================================================
  // evolution
  // =================================================================================================
  e({
    id: 'homology',
    term: 'homology',
    aliases: ['homologous', 'homologue', 'homolog'],
    short: 'A claim about ANCESTRY - two things descend from one thing in a common ancestor - saying nothing about what either now does.',
    long: 'Homology is the claim Owen drew in 1843 and it remains the most commonly collapsed distinction in comparative genomics. The collapse runs one way almost every time: an orthology table is consulted, a row comes back, and the row is read as a licence to transfer function. Homology and function are supported by different evidence and either can hold without the other.',
    concrete_example: 'analogy.mjs separates the two at the top of the file - "HOMOLOGY is a claim about ANCESTRY... ANALOGY is a claim about FUNCTION" - and sorts its seven evidence kinds by which of the two each is about: four are about ancestry, two are correlates of function, and exactly one tests function.',
    why_it_matters_here: 'Four of the seven evidence kinds the pipeline had been using are evidence about ancestry that was being spent as evidence about function.',
    see_also: ['analogy', 'ortholog', 'paralog', 'synteny', 'convergent evolution'],
    category: 'evolution',
  }),
  e({
    id: 'analogy',
    term: 'analogy',
    aliases: ['analogue', 'analogous', 'functional analogue'],
    short: 'A claim about FUNCTION: two things do the same job, whether or not they share an ancestor.',
    long: 'Analogy is what a design programme actually needs, because "this lineage solved the problem by a route unavailable to the host" is the premise of borrowing in the first place. A framework that can only speak through orthology is therefore blind to the cases it exists to serve. The error is assuming analogy requires homology; the strongest functional analogues on this project\'s list have zero orthology.',
    concrete_example: 'analogy.mjs returns words rather than a number - the strongest evidence kind present, what is absent and what each absence would add, and a confidence BAND recomputed under a second weighting (ALT_BANDS) so the reader can see how much of the verdict was the evidence and how much was the authors.',
    why_it_matters_here: 'WHY_NOT_ONE_NUMBER is the repo\'s canonical argument against fusing incommensurable evidence into a float that gets read downstream as a probability.',
    see_also: ['homology', 'rescue', 'convergent evolution', 'ortholog', 'the ortholog conjecture'],
    category: 'evolution',
  }),
  e({
    id: 'the-ortholog-conjecture',
    term: 'the ortholog conjecture',
    aliases: ['ortholog conjecture', 'orthologue conjecture'],
    short: 'The untested assumption that orthologues are more functionally alike than paralogues - stated as a conjecture, and not settled.',
    long: 'Nearly every cross-species function transfer leans on this conjecture without naming it. It has been tested directly and has not come out cleanly: Nehrt 2011 found paralogues functionally MORE similar than orthologues in mammals, and Stamboulian 2020 found it holds for some data types and not others. A pipeline that treats orthology as functional equivalence is betting on an open question.',
    concrete_example: 'analogy.mjs cites Gabaldon & Koonin 2013 as the paper that states it as a conjecture, and uses it as the reason bare sequence-orthology "does not establish anything about current function".',
    why_it_matters_here: 'It is the single assumption that, if granted, would make the entire analogy module unnecessary - so it is named rather than inherited.',
    see_also: ['ortholog', 'paralog', 'analogy', 'rescue'],
    category: 'evolution',
  }),
  e({
    id: 'teleost-genome-duplication',
    term: 'teleost genome duplication',
    aliases: ['teleost-specific whole-genome duplication', 'whole-genome duplication', 'teleost duplication', 'TGD'],
    short: 'A duplication of the whole genome in the teleost lineage after the tetrapod split, leaving fish genes in pairs where a mammal has one.',
    long: 'The duplication is why zebrafish genetics so often produces a one-to-many relationship to a mammalian gene. Both copies are formally orthologues of the single mammalian gene, so "the zebrafish orthologue of gene X" frequently does not pick out a gene. The name is the instance, not the problem: the same shape appears wherever a duplication sits on one side of a comparison - salmonid, plant polyploidy, the two rounds at the base of the vertebrates, every recent tandem duplication.',
    concrete_example: 'analogy.mjs cites Amores 1998, Jaillon 2004 and Postlethwait 2000 for the duplication, and names the repo\'s own instance: kcnk5a and kcnk5b in Danio rerio, both mapping to the single human KCNK5.',
    why_it_matters_here: 'The repository designs in a teleost, so this is the default state of its gene mappings rather than an edge case.',
    see_also: ['ohnolog', 'one-to-many orthology', 'paralog', 'subfunctionalisation'],
    category: 'evolution',
  }),
  e({
    id: 'subfunctionalisation',
    term: 'subfunctionalisation',
    aliases: ['subfunctionalization', 'duplication-degeneration-complementation', 'DDC'],
    short: 'After a duplication the two copies divide the ancestral job between them, so neither copy does all of it.',
    long: 'Under the duplication-degeneration-complementation model (Force 1999) each copy loses part of the ancestral regulation and keeps a complementary part, which is how both survive. The experimental consequence is concrete and expensive: knock out one copy and you get a partial phenotype or none, the result reads as "this gene is not required", and the conclusion is wrong - the gene is required for its share of a divided job.',
    concrete_example: 'analogy.mjs states that for kcnk5a/kcnk5b, "how the ancestral function divides between them, if it does" is NOT established, because no expression comparison of the two copies in the pectoral fin is held in this repo.',
    why_it_matters_here: 'It is the mechanism that makes picking one member of a duplicate pair wrong at the bench rather than merely imprecise.',
    see_also: ['paralog', 'ohnolog', 'one-to-many orthology', 'teleost genome duplication', 'knockout'],
    category: 'evolution',
  }),
  e({
    id: 'convergent-evolution',
    term: 'convergent evolution',
    aliases: ['convergence', 'convergent'],
    short: 'Independent lineages arriving at the same solution from different ancestral material - analogy with no orthology at all.',
    long: 'Convergent structures are the strongest functional analogues available and the ones an orthology-only framework cannot see. The subtlety is that "convergent at the level of the structure" is compatible with shared regulatory machinery underneath (Shubin 2009, deep homology), and that compatibility does not make the structures homologous - which is where the two claims get mixed back together.',
    concrete_example: 'analogy.mjs names the antifreeze glycoprotein of an Antarctic notothenioid and the chemically identical protein in a northern gadid, built from different ancestral genes (Chen 1997; Zhuang 2019) - zero orthology, and among the strongest functional analogues on its list.',
    why_it_matters_here: 'These are exactly the pairs a borrow-from-another-lineage design programme cares about, and exactly the pairs an orthology table cannot return.',
    see_also: ['analogy', 'homology', 'ortholog'],
    category: 'evolution',
  }),
  e({
    id: 'allometry',
    term: 'allometry',
    aliases: ['allometric', 'allometric exponent', 'log-log exponent'],
    short: 'How a trait changes with body size, written as a power law whose exponent is the slope of a log-log fit between two sizes.',
    long: 'An allometric law is a relation between two different sizes, which is why it cannot be evaluated on a single normalised specimen: dividing a length by standard length has already removed the size the law is written in. The deeper question the project has not settled is whether an allometric exponent is a constraint, a regularity or a habit - exponents hold until they do not, and more measurements sharpen the exponent without telling you whether an exception refutes the law or merely bounds it.',
    concrete_example: 'The registry law `disc-pectoral-length-allometry` records pectoral fin length scaling with standard length as SL^b with b = 1.058, 95 % CI [1.017, 1.099], from OLS on log-log over n = 49 museum specimens, r^2 = 0.983.',
    why_it_matters_here: 'Allometry is the main reason only 1 of 48 theorem-carrying laws is expressible on the ten body-ratio traits: every allometry needs two sizes and the traits carry one.',
    see_also: ['standard length', 'q', 'non-vacuity', 'Nous'],
    category: 'evolution',
  }),
  e({
    id: 'fixation-probability',
    term: 'fixation probability',
    aliases: ['fixation', 'Kimura fixation probability'],
    short: 'The chance that a new allele eventually takes over a finite population rather than being lost.',
    long: 'For a neutral allele the answer is startlingly simple - its current frequency - and that simplicity is what makes it formalisable. The error is quoting the neutral result in a selective setting: Kimura\'s result with selection is a different, harder statement, and the version proved in this repository covers only the neutral case.',
    concrete_example: 'The registry entry `kimura-fixation-probability` carries the Lean theorem Delphi.NeutralChain.fixedBy_tendsto - fixation probability i/M for any neutral absorbing chain, hence for the exact finite Wright-Fisher chain - with `assumed: ["Neutral case only (s = 0)..."]` stated in scope.',
    why_it_matters_here: 'It is a clean example of a law whose Lean content is narrower than its English label, with the narrowing written into the record rather than left to the reader.',
    see_also: ['Lean', 'non-vacuity', 'axiom', 'Nous'],
    category: 'evolution',
  }),

  // =================================================================================================
  // development
  // =================================================================================================
  e({
    id: 'carnegie-stage',
    term: 'Carnegie stage',
    aliases: ['Carnegie', 'carnegie_stage'],
    short: 'An ORDINAL human embryo staging scheme based on morphology, not a duration - so stage numbers cannot be subtracted.',
    long: 'Carnegie stages are ranked descriptions of form, and the mapping from stage to days is a range per stage. Stages 12 to 23 span roughly four to eight weeks, unevenly. The error is arithmetic: treating the numbers as a clock gives differences that look like durations and are not.',
    concrete_example: 'organism-format/life/spec.mjs lists `carnegie_stage` in ORDINAL_UNITS and the refusal `no_cross_unit_distance` states the reason in one line: "Carnegie 12 minus Carnegie 10 is not 2 of anything."',
    why_it_matters_here: 'Time is the primary axis of a `.life` file, so a unit that forbids arithmetic has to be declared rather than inferred.',
    see_also: ['somite', 'morula', 'provenance', 'holdout'],
    category: 'development',
  }),
  e({
    id: 'somite',
    term: 'somite',
    aliases: ['somites', 'somite pairs', 'myotome'],
    short: 'One of the paired blocks of mesoderm laid down in sequence along the body axis; they become the segmented muscle and vertebrae.',
    long: 'Somites are added one pair at a time by a clock-like process, which makes somite number a usable developmental clock and a usable species-level count. The trap for a model builder is that published counts are RANGES across individuals, so committing to one integer is a modelling decision, and it should be recorded as one.',
    concrete_example: 'anatomy-model/zebrafish records myotomes_L/R as 32 chevron segments, taken as the midpoint of the 30-34 somite pairs given by Kimmel 1995 via ZFIN - the midpoint is in the record as the basis, not just the 32.',
    why_it_matters_here: 'It is a small instance of the repo\'s rule that a number arrived at by a choice must carry the choice.',
    see_also: ['Carnegie stage', 'provenance', 'morula'],
    category: 'development',
  }),
  e({
    id: 'morula',
    term: 'morula',
    aliases: ['morulae', 'compacted morula'],
    short: 'The solid ball of cells an early embryo becomes after a few cleavages, before any fluid cavity forms.',
    long: 'A morula is defined by cell count and compaction rather than by a wall-clock age, which is why a `.life` stage pins itself in BOTH time and temperature: "morula" means different things across species and across temperatures. Compaction matters geometrically too - in a compacted morula the flattened contact faces between cells are most of the cell surface.',
    concrete_example: 'The committed example `mouse-preimplantation.life` runs zygote to morula over 5 stages and 31 cells, exporting morula.DEPICTION.stl at 5,120 triangles and 256,084 bytes from 16 of 16 cells.',
    why_it_matters_here: 'It is the last stage of the only worked developmental trajectory in the repository, and every stage of it is depicted rather than measured.',
    see_also: ['blastomere', 'inner cell mass', 'trophectoderm', 'Carnegie stage', 'STL'],
    category: 'development',
  }),
  e({
    id: 'blastomere',
    term: 'blastomere',
    aliases: ['blastomeres'],
    short: 'One of the cells produced by the cleavage divisions of an early embryo, before differentiation.',
    long: 'Blastomeres are not spheres, and that fact has a modelling consequence the first version of this spec got wrong. Real blastomeres are flattened against their neighbours, with contact-face curvature set by the balance between adhesion and cortical tension, so a sphere per cell is a DEPICTION of shape however well measured the centres and radii are.',
    concrete_example: 'GEOMETRY_PROVENANCE_AXES splits geometry provenance into `numbers` and `shape` for exactly this reason - "a sphere is a depiction of shape however good the numbers are" - so every exportStage() result carries a shape_model whatever the provenance of the numbers.',
    why_it_matters_here: 'Under the original one-axis rule a mesh built from perfectly measured coordinates would have been exported unmarked, and it is still a drawing.',
    see_also: ['morula', 'inner cell mass', 'trophectoderm', 'provenance', 'STL'],
    category: 'development',
  }),
  e({
    id: 'trophectoderm',
    term: 'trophectoderm',
    aliases: ['trophoblast'],
    short: 'The outer cell layer of a preimplantation embryo, which becomes placental tissue rather than the embryo proper.',
    long: 'Trophectoderm versus inner cell mass is the first fate decision in a mammalian embryo, and position within the ball is the best-known correlate of which way a cell goes. The modelling trap is assigning the fate FROM position in a model you built, and then reading the assignment back as evidence about position - which is circular.',
    concrete_example: 'In mouse-preimplantation.life the trophectoderm fates are labelled as "assigned from radial position in a DEPICTED packing. Not a measurement, and not a prediction either - UTMM finds that positional geometry rather than cell shape predicts trophectoderm profile, which this packing is not good enough to test."',
    why_it_matters_here: 'It is the example file saying, in its own notes, that it cannot test the thing its structure is shaped around.',
    see_also: ['inner cell mass', 'blastomere', 'morula', 'provenance'],
    category: 'development',
  }),
  e({
    id: 'inner-cell-mass',
    term: 'inner cell mass',
    aliases: ['ICM', 'inner cells'],
    short: 'The inner group of cells in a preimplantation embryo that goes on to form the embryo itself.',
    long: 'What geometrically distinguishes an inner cell from an outer one is EXPOSED surface area - the part of the membrane facing outward rather than a neighbour - which is also the quantity lineage bias tracks. The consequence for any sphere-packed model is specific and biased in the worst direction: a sphere packing has no contact faces, so every cell\'s exposed area comes out too large, and biased towards making inner cells resemble outer ones.',
    concrete_example: 'The `.life` spec states that any mesh export therefore CONTRADICTS a measured exposed_surface_area, and exportStage() names the cells it contradicts rather than overriding them; on the committed example it contradicts none, because all 31 cells declare exposed_surface_area: null and say why.',
    why_it_matters_here: 'The bias runs in the direction that would manufacture the finding, which is why the exporter reports the contradiction instead of resolving it.',
    see_also: ['trophectoderm', 'blastomere', 'morula', 'STL', 'provenance'],
    category: 'development',
  }),
  e({
    id: 'in-situ',
    term: 'in situ',
    aliases: ['in-situ', 'in_situ'],
    short: 'Measured with the cells still in place in the intact tissue, so each cell\'s neighbours are still known.',
    long: 'In situ is the difference between knowing a cell\'s state and knowing a cell\'s state plus what is next to it. For any claim about multicellularity the neighbour relations ARE the subject, so a measurement taken after dissociation has discarded the thing being claimed. That is why the flag is required rather than optional on the transcriptome channel: the same numbers mean different things with and without it.',
    concrete_example: 'CHANNELS.transcriptome in spec.mjs carries `panel`, `counts_or_reference` and a required `in_situ` flag, because "a transcriptome measured after dissociation has thrown away the neighbour relations a multicellularity claim is about".',
    why_it_matters_here: 'A format that cannot hold "what state a cell is in AND what its neighbours are doing to it" cannot hold the measurement that matters most for multicellularity.',
    see_also: ['transcriptome', 'compliance vs modulus', 'inner cell mass', 'provenance'],
    category: 'development',
  }),
  e({
    id: 'compliance-vs-modulus',
    term: 'compliance vs modulus',
    aliases: ['compliance', 'elastic modulus', 'modulus', 'high-frequency compliance'],
    short: 'Compliance is how much something yields and a modulus is a stiffness in pascals, so a relative displacement readout is the first.',
    long: 'The pair matters because a field name can impose a unit the measurement does not have. Requiring pascals does not make a displacement a modulus; it makes everyone filling in the field invent a conversion, and the resulting file lies in a way no reader can detect. The newcomer error here is trusting an abstract: the deposited abstract said "elastic modulus" and the authors had already retreated from that word.',
    concrete_example: 'Spec v0.1.0 required `elastic_modulus_Pa` following the PubMed/PMC abstract; bioRxiv v2 (2026-10-23) rewrites it to "high-frequency intracellular mechanical compliance", "a relative, non-invasive readout", reported only as RMSD0 and dRMSD. The pascal figures that do exist (~35 Pa at 2/4-cell, ~10 Pa at 8-cell) come from a separate optical-tweezers bead validation and are carried under their own name, shear_modulus_from_bead_validation_Pa.',
    why_it_matters_here: 'It is the first of the three spec corrections found by reading the paper instead of its abstract, and the reason `readout_kind` and `is_relative` exist.',
    see_also: ['in situ', 'transcriptome', 'provenance', 'Aletheia'],
    category: 'development',
  }),

  // =================================================================================================
  // ecology
  // =================================================================================================
  e({
    id: 'r-star',
    term: 'R*',
    aliases: ['R-star', 'R star', 'Rstar'],
    short: 'The resource concentration at which a species\' growth exactly balances its losses - the bar it must get below to persist.',
    long: 'R* turns "will my designed organism survive out there" into arithmetic on three numbers: mu_max, Ks and the loss rate D the competitors share. The subtlety is that lower is better, which reads backwards at first: the winner is the species that can still break even when the resource is scarcest. R* is undefined when mu_max does not exceed D, and that case is not a tie - the organism washes out at any resource concentration.',
    concrete_example: 'ecology/rstar.mjs computes R* = Ks * D / (mu_max - D) and then refuses to use it: "THIS PROJECT HAS NONE OF THOSE NUMBERS FOR ANY DESIGNED ORGANISM", so assessDesign() returns the bar a design would have to clear and declines to say whether it clears it.',
    why_it_matters_here: 'It is the repo\'s clearest refusal-as-result: the module would be more impressive with invented growth parameters and would then produce "the most confident wrong number in the whole system".',
    see_also: ['Monod kinetics', 'competitive exclusion', 'ZNGI', 'consumption vector', 'founder control'],
    category: 'ecology',
  }),
  e({
    id: 'monod-kinetics',
    term: 'Monod kinetics',
    aliases: ['Monod', 'Monod equation', 'half-saturation', 'Ks'],
    short: 'Growth rate rising with resource and saturating: mu(R) = mu_max * R / (Ks + R), where Ks is the half-saturation constant.',
    long: 'Monod gives two parameters that answer different questions. mu_max is how fast the organism grows when resource is plentiful; Ks is how well it does when resource is scarce, and it is Ks that mostly decides a competition. The design error is optimising the one that is easy to measure: an engineered pathway usually costs growth rate, and low-substrate affinity is rarely what a design optimises.',
    concrete_example: 'rstar.mjs asks for mu_max measured "for THIS strain on THIS substrate. Not the parent strain, and not a related species", and notes the whole measurement is "a chemostat series at several dilution rates, or a batch growth curve fitted to Monod. Days of work, not months, and it is the cheapest experiment that can refute a release plan."',
    why_it_matters_here: 'It makes the refusal actionable: the module names the experiment rather than only the missing field.',
    see_also: ['R*', 'ZNGI', 'competitive exclusion'],
    category: 'ecology',
  }),
  e({
    id: 'zngi',
    term: 'ZNGI',
    aliases: ['zero net growth isocline', 'isocline', 'isoclines'],
    short: 'The curve in resource space where a species exactly breaks even; its SHAPE depends on whether the resources can substitute for each other.',
    long: 'With two essential resources the isocline is L-shaped, cornered at the two single-resource R* values, because Liebig\'s law of the minimum applies. With perfectly substitutable resources it is the straight line R1/R1* + R2/R2* = 1 through the same two intercepts. The mix-up does not shade the answer, it inverts it, and the module refuses to guess which kind the resources are.',
    concrete_example: 'coexist.mjs spells out the inversion: the same measured R1* and R2* put a supply point BELOW an L-shaped isocline (nothing grows, the scarce resource is mandatory) and comfortably ABOVE the straight isocline through the same intercepts - "same four numbers, nothing persists against both do".',
    why_it_matters_here: 'It is the repository\'s sharpest example of a parameter whose default would be a silent, sign-flipping assumption, so there is no default.',
    see_also: ['R*', 'Monod kinetics', 'consumption vector', 'founder control', 'competitive exclusion'],
    category: 'ecology',
  }),
  e({
    id: 'competitive-exclusion',
    term: 'competitive exclusion',
    aliases: ['competitively excludes', 'exclusion'],
    short: 'On one limiting resource at steady state, the lowest-R* species draws it below every rival\'s break-even point: exclusion, not winning.',
    long: 'Exclusion is monotone decline, not a smaller share: the loser\'s growth at the equilibrium resource concentration is below its loss rate. The common misreading is that two resources make the result lapse. They do not - it generalises. A species with the lower R* on BOTH resources still excludes outright; the single-resource conclusion lapses only where the isoclines CROSS, which is where there is a real trade-off.',
    concrete_example: 'WHAT_R_STAR_IGNORES carries that correction in place, pointing at ecology/coexist.mjs: uncrossed isoclines admit no coexistence equilibrium at any supply point, "for all 49 consumption-vector pairs the test sweeps".',
    why_it_matters_here: 'The caveat list is edited when a later module refutes an item, rather than left to read as an open worry.',
    see_also: ['R*', 'ZNGI', 'founder control', 'consumption vector'],
    category: 'ecology',
  }),
  e({
    id: 'founder-control',
    term: 'founder control',
    aliases: ['bistable', 'priority effect'],
    short: 'A bistable outcome where whichever species establishes first excludes the other, and a rare invader always declines.',
    long: 'Founder control arises from crossed isoclines with the consumption ratios the wrong way round, and it looks like coexistence in every summary statistic that does not test invasion. Reporting it as coexistence is the most consequential error the two-resource module could make, because the two give opposite predictions for a release: under founder control the design persists only if it gets there first and in numbers.',
    concrete_example: 'coexist.mjs computes the verdict by MUTUAL INVASIBILITY rather than wedge geometry - both can invade means coexistence, NEITHER can means founder control - and test-coexist.mjs asserts that founder control "is reported in its own bucket, never folded into the coexistence bucket".',
    why_it_matters_here: 'A test exists whose only job is to stop a category being quietly merged into a more reassuring one.',
    see_also: ['ZNGI', 'competitive exclusion', 'consumption vector', 'R*'],
    category: 'ecology',
  }),
  e({
    id: 'consumption-vector',
    term: 'consumption vector',
    aliases: ['consumption vectors', 'consumption ratio'],
    short: 'How fast a species draws each resource down, as a ratio - a separate measurement from the isoclines, and the one that decides coexistence.',
    long: 'Isoclines say whether coexistence is POSSIBLE; consumption vectors say whether it happens. Two species can have perfectly crossed isoclines - the textbook picture of coexistence - and still exclude one another because each is consuming the wrong resource. Stable coexistence requires each species to consume relatively more of the resource that more limits its own growth.',
    concrete_example: 'coexist.mjs states the rule as a sentence it can print: "stable coexistence needs A to consume relatively more of the resource limiting A and B relatively more of the resource limiting B; the reverse gives founder control."',
    why_it_matters_here: 'It is the second measurement a design would need and the one most likely to be skipped, because the isoclines alone already make a convincing picture.',
    see_also: ['ZNGI', 'founder control', 'competitive exclusion', 'R*'],
    category: 'ecology',
  }),

  // =================================================================================================
  // statistics
  // =================================================================================================
  e({
    id: 'mahalanobis-distance',
    term: 'Mahalanobis distance',
    aliases: ['Mahalanobis', 'Mahalanobis D'],
    short: 'Distance from a point to a cloud\'s centre measured in units of the cloud\'s own spread and correlation, not in raw units.',
    long: 'Mahalanobis distance is what makes a trait vector "far from real animals" in a way that respects which traits move together. That is also its exact limitation: it detects broken CORRELATION structure, so a decoy that preserves the correlations is nearly invisible to it. And because a Gaussian assigns probability across the whole of its own support, impossible regions included, Mahalanobis distance can never bound possibility - only typicality.',
    concrete_example: 'The design scorer\'s q is D^2/d, so its expectation is exactly 1.000 for any d-dimensional Gaussian. Samples drawn from the fitted model average q = 0.996, while REAL held-out specimens average 0.876 - real fish sit closer to the centre than the model\'s own draws do.',
    why_it_matters_here: 'The joint Mahalanobis term reaches 0.8833 of the full scorer\'s discrimination - "one term wearing a costume" - so measuring it measures the scorer.',
    see_also: ['q', 'overdispersion', 'AUC', 'hard negative', 'decoy', 'gate'],
    category: 'statistics',
  }),
  e({
    id: 'auc',
    term: 'AUC',
    aliases: ['area under the curve', 'AUROC', 'ROC AUC'],
    short: 'The chance a randomly chosen positive scores above a randomly chosen negative - a property of the scorer AND of the negatives.',
    long: 'An AUC has no meaning without its negatives, and that is the usual misreading: a reported AUC is quoted as a property of the model. Change the decoy generator and the same scorer, unchanged, moves from excellent to chance. 0.5 is chance and 1.0 is perfect separation, but neither endpoint tells you whether the separation was hard to achieve.',
    concrete_example: 'The same frozen joint-model.v1.3.0 against 4,673 held-out positives scores AUC 0.8915 [0.884, 0.899] on shuffled negatives, 0.6627 on draws from its own fitted Gaussian, and 0.5363 [0.521, 0.552] - chance - on real fish nudged a quarter of a standard deviation.',
    why_it_matters_here: 'The headline accuracy of the design layer turned out to be largely a statement about its decoy generator, which is why benchmarks/README.md calls AUC 0.89 a productivity figure.',
    see_also: ['decoy', 'hard negative', 'Mahalanobis distance', 'bootstrap confidence interval', 'overdispersion'],
    category: 'statistics',
  }),
  e({
    id: 'hard-negative',
    term: 'hard negative',
    aliases: ['hard negatives', 'constructed negative'],
    short: 'A negative example built to be as nearly acceptable as possible - the worst case, which has to be searched for rather than sampled.',
    long: 'Drawing negatives finds typical negatives; a worst case is not a sample. So the hard negative has to be constructed: minimise the score subject to breaking a constraint no real specimen breaks. The constraint has to be CHECKED against real data rather than chosen by intuition, because a plausible-sounding constraint that real animals break turns the whole exercise into mislabelling real animals as impossible.',
    concrete_example: 'Minimising q subject to the snout plus the eye overhanging the back of the head by 2 % of body length yields q = 0.918 - called typical, and ranked more plausible than 1,279 of 4,673 real fish. 20,000 draws from the fitted model produced 88 violations and not one inside q < 1; the search finds one immediately.',
    why_it_matters_here: 'The gate at sim-engine/validate/gate/containment.mjs exists because of this one constructed animal.',
    see_also: ['decoy', 'AUC', 'q', 'gate', 'Mahalanobis distance'],
    category: 'statistics',
  }),
  e({
    id: 'decoy',
    term: 'decoy',
    aliases: ['decoys', 'decoy generator', 'shuffle negative'],
    short: 'A synthetic negative example used to test a scorer; how it is generated decides what the test can detect.',
    long: 'A shuffle keeps each trait\'s marginal distribution and destroys the correlation between traits - which is precisely and only what a Mahalanobis distance detects. So a benchmark built on shuffles is testing the one thing the scorer is guaranteed to find. The generator, not the scorer, sets the difficulty, and it is usually not reported at all.',
    concrete_example: '12,152 of the 12,606 held-out negatives in the design benchmark are shuffles. Replacing them with real fish jittered by a quarter of a standard deviation drops the AUC from 0.891 to 0.536.',
    why_it_matters_here: 'Separating the scorer from its negatives was the whole point of benchmarks/design-hard-negatives, and nobody had done it before.',
    see_also: ['hard negative', 'AUC', 'Mahalanobis distance', 'overdispersion'],
    category: 'statistics',
  }),
  e({
    id: 'bootstrap-confidence-interval',
    term: 'bootstrap confidence interval',
    aliases: ['bootstrap', 'bootstrap CI', 'seeded bootstrap'],
    short: 'An interval built by resampling the data with replacement many times, so you can see how much of a statistic is sampling noise.',
    long: 'A bootstrap interval answers "could this number have come out differently with a different sample of the same size". The thing it is for is deciding whether an effect is there at all: an interval that includes zero means the point estimate is not distinguishable from no relationship, however suggestive its sign. Seeding the resampling is what makes the interval reproducible rather than merely plausible.',
    concrete_example: 'On 307 measured sgRNAs the guide scores come out CRISPRscan rho = 0.269, CI [0.165, 0.364] (excludes zero); Doench 2014 Rule Set 1 rho = -0.037, CI [-0.149, 0.073]; the project\'s own heuristic rho = 0.082, CI [-0.024, 0.196]. Two of the three straddle zero.',
    why_it_matters_here: 'Without the intervals, -0.037 and 0.082 would have been read as "weak" rather than as "indistinguishable from no information".',
    see_also: ["Spearman's rho", 'AUC', 'overdispersion', '--fail-once'],
    category: 'statistics',
  }),
  e({
    id: 'spearmans-rho',
    term: "Spearman's rho",
    aliases: ['Spearman', 'Spearman correlation', 'rho'],
    short: 'Correlation computed on ranks rather than values, so it measures monotone agreement without assuming a linear relation.',
    long: 'Rank correlation is the right statistic when you only care about ordering - which is the case for anything used to RANK candidates. The trap is scoring a model on the data that fitted it: the resulting number is an upper bound on its advantage, not an estimate of it, and it cannot be compared with a held-out number from another model as though both were the same kind of quantity.',
    concrete_example: 'CRISPRscan reaches rho = 0.269 on the zebrafish guides, but it was FITTED on that study\'s injections, so the benchmark reports it as an upper bound; Doench and the project heuristic never saw the data and reach zero. "The model with home advantage reaches 0.27 and the two in use reach zero."',
    why_it_matters_here: 'The score the whole design programme ranks guides by is statistically indistinguishable from no information on its own target organism.',
    see_also: ['bootstrap confidence interval', 'AUC', 'sgRNA', 'holdout'],
    category: 'statistics',
  }),
  e({
    id: 'overdispersion',
    term: 'overdispersion',
    aliases: ['overdispersed'],
    short: 'A fitted distribution that is wider than the data it was fitted to, usually because it pooled over groups with different centres.',
    long: 'Pooling a covariance over many groups absorbs the between-group variation into the within-group spread, so the fitted cloud comes out wider and flatter than the real one. The counter-intuitive consequence is that the model can separate REAL data from its OWN typical samples: it is detecting that it is misspecified, not that a sample is implausible. A design placed at the mode of such a model scores as less typical than an ordinary member of the real population.',
    concrete_example: '77.1 % of real fish sit inside q < 1 against only 56.5 % of the fitted model\'s own samples, because the covariance was pooled over 311 families. The benchmark predicted in writing that model-drawn decoys would score ~0.5 "by construction"; they scored 0.663.',
    why_it_matters_here: 'benchmarks/README.md keeps that wrong prediction on the record because "the wrong prediction was more informative than the right one would have been".',
    see_also: ['Mahalanobis distance', 'q', 'decoy', 'AUC'],
    category: 'statistics',
  }),
  e({
    id: 'q',
    term: 'q',
    aliases: ['typicality score', 'q = D^2/d', 'min q'],
    short: 'This project\'s typicality number: squared Mahalanobis distance divided by the number of traits, so q = 1 is the average for the model.',
    long: 'Dividing by the dimension makes q comparable across trait counts and puts the typical radius at q = 1, so q < 1 reads as "typical". The error is reading q as plausibility of EXISTENCE. q is distance to the cloud of real specimens, and distance to real specimens does not bound anatomical possibility - a design can be ordinary by this measure and still be an animal that cannot be built.',
    concrete_example: 'The median real fish sits at q = 0.650. A hand-found impossible animal reaches q = 0.918; the law-derived one - dorsal fin beginning 1.02 standard lengths from the snout, past the end of the fish - reaches q = 0.347, more typical than 4,068 of 4,673 real specimens (87.1 %). A head longer than the body IS caught, at q = 3.95.',
    why_it_matters_here: 'The failure is specific: constraints whose boundary lies just outside the observed marginal range, which is where most anatomical impossibilities live.',
    see_also: ['Mahalanobis distance', 'hard negative', 'gate', 'overdispersion', 'standard length'],
    category: 'statistics',
  }),

  // =================================================================================================
  // formal-methods
  // =================================================================================================
  e({
    id: 'lean',
    term: 'Lean',
    aliases: ['Lean 4', 'lake env lean'],
    short: 'The dependent-type-theory language and proof assistant this project\'s laws are stated and machine-checked in.',
    long: 'Lean checks that a proof establishes its stated theorem; it does not check that the theorem says what you meant. That gap is the one bug a formalisation can have that no amount of proof checking catches, and this repository names it rather than claiming the opposite. "73 Lean-checked theorems" is a productivity figure: it measures how much was built and cannot come out badly.',
    concrete_example: 'A `statement_en` sits beside every law in the registry and nothing checks the correspondence - "a sound proof of the wrong statement passes every check in this repository, and that gap is not mutation-shaped".',
    why_it_matters_here: 'Lean is the Nous layer, and proving the wrong statement soundly is named as that layer\'s quieter characteristic failure.',
    see_also: ['proof assistant', 'axiom', 'sorry', 'non-vacuity', 'mutation testing', 'Nous'],
    category: 'formal-methods',
  }),
  e({
    id: 'proof-assistant',
    term: 'proof assistant',
    aliases: ['proof checker', 'kernel', 'kernel-checked'],
    short: 'Software that mechanically verifies each step of a proof against a small trusted kernel, so acceptance is not a matter of opinion.',
    long: 'The guarantee a proof assistant gives is narrow and exact: the proof term typechecks against the stated theorem, using the axioms it declares. It does not guarantee the theorem is interesting, relevant, or a faithful rendering of English. A proof assistant that accepts everything you give it is not one - which is why this project mutated its own laws to check.',
    concrete_example: 'benchmarks/lean-mutation compiles mutants with `lake env lean` in a scratch directory and writes nothing under lean/; it also compiles the ORIGINAL statement first, "so that a failing mutant cannot be a failing build".',
    why_it_matters_here: 'The sanity check matters as much as the mutants, and its absence is the most common way a mutation benchmark fools itself.',
    see_also: ['Lean', 'axiom', 'mutation testing', 'non-vacuity', 'vacuous truth'],
    category: 'formal-methods',
  }),
  e({
    id: 'axiom',
    term: 'axiom',
    aliases: ['axioms', 'propext', 'Classical.choice', 'Quot.sound'],
    short: 'An assumption a proof rests on without proving it; which axioms a theorem uses is part of what the theorem claims.',
    long: 'Every Lean proof depends on some axioms, and the standard three are unremarkable. What matters is whether a proof also depends on a PROJECT-SPECIFIC axiom, because such an axiom is an unproved claim about the subject matter smuggled in as logic. Checking the dependency list is cheap and is the difference between "machine-checked" and "machine-checked, given something we asserted".',
    concrete_example: 'The 48 non-vacuity witnesses in lean/registry/lean/Witnesses.lean compile depending only on `propext`, `Classical.choice` and `Quot.sound` - "no `sorry`, no project-specific axiom".',
    why_it_matters_here: 'It is what makes the formal layer\'s clean pass a real pass rather than a report about itself.',
    see_also: ['Lean', 'sorry', 'non-vacuity', 'proof assistant'],
    category: 'formal-methods',
  }),
  e({
    id: 'sorry',
    term: 'sorry',
    aliases: ['`sorry`', 'sorry tactic'],
    short: 'Lean\'s placeholder that closes any goal unproved; a file containing one compiles while proving nothing at that point.',
    long: 'A `sorry` is an admission, and it is a legitimate tool while a proof is being written. It becomes dangerous at the point where a build is reported as passing, because "it compiles" and "it is proved" come apart silently. Any claim that a formal layer is machine-checked has to include the absence of `sorry` to mean anything.',
    concrete_example: 'The non-vacuity audit reports that all 48 theorem-carrying laws have compiled Lean witnesses with "no `sorry`, no project-specific axiom" - stated as part of the result, not as a footnote.',
    why_it_matters_here: 'It is one half of the two-part condition that turns "73 theorems" from a productivity figure into a soundness claim.',
    see_also: ['Lean', 'axiom', 'non-vacuity', 'proof assistant'],
    category: 'formal-methods',
  }),
  e({
    id: 'non-vacuity',
    term: 'non-vacuity',
    aliases: ['non-vacuity witness', 'nonvacuity', 'non-vacuous'],
    short: 'Proof that a theorem\'s hypotheses can all be satisfied at once, so the theorem is about something rather than about nothing.',
    long: 'A non-vacuity witness exhibits one object meeting every hypothesis. Without it, a registry can hold a theorem that is perfectly true and perfectly empty, and nothing in the proof distinguishes the two cases. This is the first thing to check in a law registry and the check most registries have no field for - a field, not prose, because prose cannot be compiled.',
    concrete_example: 'All 48 laws that carry a Lean module and theorem also carry a witness, and all 35 accepted ones do; the witnesses are Lean theorems - cubeLaw_witness, areaLaw_witness, fick_witness - and for the Kimura law the witness is that "the Wright-Fisher binomial chain is a NeutralChain for every M > 0".',
    why_it_matters_here: 'It is the one benchmark of the three levels that came out as a clean pass, and benchmarks/README.md says so plainly.',
    see_also: ['vacuous truth', 'Lean', 'axiom', 'sorry', 'mutation testing', 'Nous'],
    category: 'formal-methods',
  }),
  e({
    id: 'vacuous-truth',
    term: 'vacuous truth',
    aliases: ['vacuously true', 'vacuity', 'unsatisfiable hypotheses'],
    short: 'A conditional claim that holds only because its premises can never all be met - true, and about nothing.',
    long: 'Vacuity is the characteristic failure of a formal layer, and it is invisible from inside: the proof is correct, the theorem is true, and the content is zero. It is not detected by proof checking, because there is nothing wrong with the proof; it is detected by exhibiting a witness. Vacuity\'s quieter cousin is proving the wrong statement soundly, which passes every check this repository has.',
    concrete_example: 'devlog/framework.mjs names vacuity as the Nous layer\'s characteristic failure: "A theorem with unsatisfiable hypotheses is true and says nothing; a theorem whose English gloss does not match its Lean passes every check this repository has."',
    why_it_matters_here: 'The whole non-vacuity field in the law registry exists to make this failure visible rather than assumed away.',
    see_also: ['non-vacuity', 'Lean', 'proof assistant', 'Nous'],
    category: 'formal-methods',
  }),
  e({
    id: 'mutation-testing',
    term: 'mutation testing',
    aliases: ['mutant', 'mutants', 'kill rate'],
    short: 'Deliberately changing a statement into something false and checking the system rejects it - which tests the checker, not the proof.',
    long: 'The naive version counts "kills" and is worthless: changing a statement breaks its proof, so the assistant rejects the mutant for a reason unrelated to whether the mutant is false. So outcomes must be split three ways - REFUTED (the negation is provable), UNPROVEN (nothing was settled either way), SURVIVED (the mutant is provable, so the mutation did not change what the statement claimed). Only the first is evidence, and a SURVIVED mutant indicts the statement, not the assistant.',
    concrete_example: 'The first mutant moved a bound from 0.406 to 0.5 and expected a refutation - but the bound sits in a disjunct (r < 0.406 OR 0.823 < r), so widening it WEAKENS the claim and the mutant stayed true, with Lean returning the goal 0.406 <= 0.45 |- False. Tightening to 0.3 is the mutation that can be false, and 0.35 refutes it.',
    why_it_matters_here: 'Both of this benchmark\'s own mistakes were caught by a deliberately weakened control mutant that had to survive; without it, three UNPROVENs would have been reported as a clean sweep.',
    see_also: ['Lean', 'proof assistant', 'non-vacuity', '--fail-once', 'hard negative'],
    category: 'formal-methods',
  }),

  // =================================================================================================
  // engineering
  // =================================================================================================
  e({
    id: 'needleman-wunsch',
    term: 'Needleman-Wunsch',
    aliases: ['needlemanWunsch', 'global alignment'],
    short: 'Dynamic programming for the best GLOBAL alignment: both sequences end to end, gaps included wherever needed.',
    long: 'Global alignment assumes the two sequences correspond along their whole length, which is right for two full-length orthologous coding sequences and wrong for a fragment against a genome - where it will stretch the short sequence across the long one with terminal gaps. Its cost is the other thing to know: time and memory both scale as the product of the two lengths.',
    concrete_example: 'align.mjs implements it with the three-matrix Gotoh recursion at 27 bytes per cell and refuses above MAX_CELLS = 4,000,000 - comfortable to about 2000 x 2000 - "refusing instead of allocating ~110 MB and appearing to hang".',
    why_it_matters_here: 'The refusal is the design: there is no banded or linear-space path here, and the module says so instead of trying.',
    see_also: ['Smith-Waterman', 'affine gap', 'percent identity', 'BLOSUM62'],
    category: 'engineering',
  }),
  e({
    id: 'smith-waterman',
    term: 'Smith-Waterman',
    aliases: ['smithWaterman', 'local alignment'],
    short: 'The same dynamic programme restricted to the best LOCAL alignment: the highest-scoring subsegment pair, ignoring the rest.',
    long: 'Local alignment is the right choice when only part of each sequence corresponds - a domain, an exon, a fragment. The clamp at zero is what makes it local, and it is also what makes a local score hard to interpret: a high local score over a short stretch can mean very little, and nothing in this module attaches a significance value to it.',
    concrete_example: 'WHAT_THIS_DOES_NOT_PREDICT states it directly: "needlemanWunsch/smithWaterman return a score, not an E-value; a local alignment score has no significance attached here."',
    why_it_matters_here: 'A dashboard panel showing an alignment score would otherwise imply a significance the module never computed.',
    see_also: ['Needleman-Wunsch', 'affine gap', 'percent identity'],
    category: 'engineering',
  }),
  e({
    id: 'affine-gap',
    term: 'affine gap',
    aliases: ['affine gaps', 'gapOpen', 'gapExtend', 'Gotoh'],
    short: 'Charging a gap once for the event and then per residue, so one insertion comes out as one gap instead of several scattered ones.',
    long: 'Under a linear penalty each gap residue costs the same wherever it sits, so the optimiser spends gap residues wherever they buy a match and produces a row of scattered single-base gaps - a worse biological hypothesis (six events instead of one) that also looks wrong to anyone who has seen an alignment. The thing to check before quoting any published gap numbers is WHICH convention was used, since gapOpen may or may not include the first gap residue.',
    concrete_example: 'test-align.mjs asserts exactly this: the same pair of sequences scored affine yields 1 gap run, scored linear yields 2. DEFAULT_SCORING states its convention - gap cost is gapOpen + (L-1) * gapExtend, the EMBOSS needle/water convention - because "the numbers in a published alignment mean nothing without knowing which".',
    why_it_matters_here: 'It is the alignment module\'s clearest instance of writing down a convention that is usually left implicit and therefore usually wrong somewhere.',
    see_also: ['Needleman-Wunsch', 'Smith-Waterman', 'percent identity', 'BLOSUM62'],
    category: 'engineering',
  }),
  e({
    id: 'fasta',
    term: 'FASTA',
    aliases: ['.fa', 'FASTA export'],
    short: 'A plain text sequence format - a description line, then letters - in which almost nothing about a sequence\'s status is representable.',
    long: 'FASTA is letters with no idea whether the edit was ever made. A diploid and a haploid design produce identical FASTA; a window typed from a paper and one read off a sequencer are byte-identical; phase, ploidy, zygosity and stage have no field. That is fine as long as a reader is told, which is why the exporter prints what it lost rather than paraphrasing it.',
    concrete_example: 'On the committed `.life` example the FASTA export REFUSES: the genome is reference-only, so a FASTA of it would be the published GRCm39 assembly, which is not the exporter\'s to emit. Zero records, and no `.fa` file is written either, because "a zero-byte file called a genome parses without complaint and reads as an EMPTY genome rather than an ABSENT one".',
    why_it_matters_here: 'The refusal is correct, and the refusal-to-write-an-empty-file is a second, separate correctness decision.',
    see_also: ['STL', 'provenance', 'transcriptome', 'percent identity'],
    category: 'engineering',
  }),
  e({
    id: 'stl',
    term: 'STL',
    aliases: ['binary STL', '.stl', 'triangle soup'],
    short: 'A mesh format that is nothing but triangles: no units, no cell identity, no topology, and no provenance unless you put it in the header.',
    long: 'An STL is a triangle soup with no idea whether it came from a confocal stack or somebody\'s guess. Two specific traps: binary STL has no unit field and most slicers assume millimetres, so a micrometre embryo is wrong by a factor of 1000 without any complaint; and an 80-byte header beginning with "solid" makes several readers sniff the file as ASCII STL and fail.',
    concrete_example: 'The whole metadata budget is the 80-byte header, used as `"life-stl/0.1.0 stage=morula provenance=depicted units=um DEPICTION"`, with the marker repeated in the filename - and exportStage() declines every depicted stage until the caller types `{ allowDepicted: true }` at the call site.',
    why_it_matters_here: 'Once geometry leaves the file as a mesh its provenance is gone, so the stamp has to travel inside the bytes and the name.',
    see_also: ['FASTA', 'provenance', 'blastomere', 'morula', 'inner cell mass'],
    category: 'engineering',
  }),
  e({
    id: 'fail-once',
    term: '--fail-once',
    aliases: ['fail-once', 'fault injection'],
    short: 'A test-suite flag that injects one fault under each assertion in turn; an assertion that still passes was asserting nothing.',
    long: 'The useful number from a `--fail-once` run is zero survivors. It catches the assertion that is accidentally tautological - a check whose condition cannot fail, or which tests the test rather than the subject. The discipline it enforces is that each assertion is written twice, once correctly and once inverted, so the inverted form must be a real negation rather than a tightened threshold.',
    concrete_example: 'Across the three benchmark directories the totals are 19 + 3 + 42 assertions with 0 survivors; the `.life` modules run 226 assertions, 226 of which fail under --fail-once, 0 surviving. Two of those assertions exist because the fault injection found live bugs - a path traversal in stl.mjs\'s suggested filename, and read.mjs reporting "unchecked" on the project\'s own example because it looked for genome.assembly where the example writes genome.reference.assembly.',
    why_it_matters_here: 'It is the house test discipline for the whole repository, and it has twice caught a bug in the code rather than in the test.',
    see_also: ['mutation testing', 'gate', 'holdout', 'Aletheia'],
    category: 'engineering',
  }),
  e({
    id: 'gate',
    term: 'gate',
    aliases: ['containment gate', 'admit()', 'not_applicable'],
    short: 'A yes/no refusal that runs BEFORE a scorer, so an impossible design never receives a plausibility number at all.',
    long: 'A gate is different in kind from a score: exact arithmetic, no free parameters, and the answer is yes or no. Adding an impossibility PENALTY to a score would only trade one arbitrary constant for another. The rule that keeps a gate honest is that a constraint may gate only if it holds on EVERY real specimen, because a gate that rejects real animals is worse than no gate - and "the traits were missing" is not a pass.',
    concrete_example: 'Only `eye-in-head` is cleared to gate, on support 1 of n = 4,673. Three constraints that sound obviously true are carried in REFUSED_AS_GATES: "the pectoral fin sits behind the head" holds on only 60.62 % of real fish, prepectoral <= prepelvic on 69.66 %, predorsal <= preanal on 97.58 % - "a tendency. 2.4 % of real fish break it, and a gate must refuse nothing real."',
    why_it_matters_here: 'The gate is currently available and UNUSED - score.mjs belongs to another thread - and containment.mjs says so, so the benchmark result still stands.',
    see_also: ['hard negative', 'q', 'Mahalanobis distance', 'standard length', 'Aletheia'],
    category: 'engineering',
  }),

  // =================================================================================================
  // project-specific
  // =================================================================================================
  e({
    id: 'delphi',
    term: 'Delphi',
    aliases: ['the oracle'],
    short: 'The generation layer: it proposes organisms, designs edits, simulates development and scores plausibility.',
    long: 'Delphi is the oracle - what could be built, and what would happen if it were. Its characteristic failure is FLUENCY: an oracle is never short of an answer, so the design layer will produce a cassette for any request put to it, including requests that are not genome-editing problems. Delphi cannot tell a good design from a fluent one, which is why it is not run alone.',
    concrete_example: 'Two of the three worked requests in analogues/cases.mjs are not genome-editing problems at all, and the whole "agentic biomaterials" goal - a xenobot is assembled from cells WITHOUT editing a genome - is a class the design surface (an edit list against a reference assembly) cannot express.',
    why_it_matters_here: 'The pipeline as built is strongest at the layer the programme goals need least, and framework.mjs calls that the uncomfortable implication.',
    see_also: ['Nous', 'Aletheia', 'cassette', 'q', 'CRISPR'],
    category: 'project-specific',
  }),
  e({
    id: 'nous',
    term: 'Nous',
    aliases: ['intellect'],
    short: 'The inference layer: it states laws, proves theorems, and checks that a conclusion follows from its premises.',
    long: 'Nous is what follows from what, independently of whether anyone has looked. Its characteristic failure is vacuity, and its quieter cousin is proving the wrong statement soundly. Nous cannot tell a sound proof from a relevant one - soundness is not relevance - so a registry can be formally impeccable and say nothing about any organism.',
    concrete_example: 'Of the 48 theorem-carrying laws, exactly 1 is expressible on the design scorer\'s ten body-ratio traits - a rate of 2.1 % - because the registry speaks in quantities those traits do not carry: two sizes, a population, a power budget, a genotype.',
    why_it_matters_here: '"A law you cannot evaluate on your data is not yet a constraint on your design" is the finding that sized the gap between the formal and design layers.',
    see_also: ['Delphi', 'Aletheia', 'Lean', 'non-vacuity', 'vacuous truth', 'allometry'],
    category: 'project-specific',
  }),
  e({
    id: 'aletheia',
    term: 'Aletheia',
    aliases: ['un-concealment', 'unconcealment', 'disclosure'],
    short: 'The disclosure layer: it measures against the world, records provenance, refuses, and says what is not known.',
    long: 'The Greek word is privative - a-letheia, NOT-hidden, from lethe, forgetting - which is a better name for this layer than "truth", because almost nothing here establishes that a claim is correct. What it does is stop things being concealed: a depicted mesh marked as depicted, a value marked not-established, a scorer measured against data it did not choose. Its characteristic failure is the false negative that looks like diligence - a check that reports clean because it could not find the field it was checking.',
    concrete_example: 'This repository produced exactly that twice in one week: read.mjs reported "unchecked" on the project\'s own worked example because it looked for genome.assembly where the file writes genome.reference.assembly, and read.mjs stringifies not_established objects to [object Object] so a file that answers all four minimum entries verbatim is told it is missing all four.',
    why_it_matters_here: 'Aletheia is the only layer that can say NO on evidence, which is why most recent work lives there and why a refusal is treated as a result.',
    see_also: ['Delphi', 'Nous', 'provenance', 'holdout', 'gate', '--fail-once'],
    category: 'project-specific',
  }),
  e({
    id: 'holdout',
    term: 'holdout',
    aliases: ['held-out', 'the holdout', 'frozen evaluation holdout', 'check-leaks'],
    short: 'A whole clade set aside before any building, so laws can be re-scored on organisms nothing was fitted or sanity-checked against.',
    long: 'A law fitted to the organisms it was built on proves nothing about the rest, so the exam has to be frozen before the building starts and scored by someone who built nothing, against pre-registered pass and fail criteria. The discipline is harder than it sounds: a single sanity check on held-out data spends the blind, and a holdout kept honest can come back INCONCLUSIVE rather than decisive - which is still the correct outcome to report.',
    concrete_example: 'The split holds 88 taxa. The cost was chosen knowingly: the held-out counts fall below the builders\' own minimum sample sizes - 13 against 50 for Kimura heterozygosity, 8 against 15 for Hamilton senescence - so both examined tests read inconclusive, where the alternative clade would have made 1 of 2 decisive and 3 already-built tests post hoc.',
    why_it_matters_here: '"A clean blind that cannot yet decide was taken over a decisive-looking test on a contaminated design", and holdout/check-leaks.mjs scans the tree for names that would break it.',
    see_also: ['Aletheia', "Spearman's rho", 'AUC', '--fail-once', 'provenance'],
    category: 'project-specific',
  }),
  e({
    id: 'provenance',
    term: 'provenance',
    aliases: ['provenance kind', 'KINDS', 'depicted', 'measured-secondhand'],
    short: 'Where a number came from, recorded in a closed vocabulary beside the number, so a guess cannot be read as a measurement.',
    long: 'Provenance is what makes an export safe: a mesh, a sequence or a trait vector carries no record of its own origin. The vocabulary is deliberately a single shared one, because a second vocabulary for the same idea is how two parts of a system come to disagree about a fact. The pattern to watch for is a value inheriting a stamp from its container - that is how a guess comes to look like a confocal stack.',
    concrete_example: 'The KINDS vocabulary is measured, measured-secondhand, borrowed, derived, calibrated, assumed, depicted. On the worked `.life` example the census reads 10 measured-secondhand / 5 assumed / 5 depicted / 5 derived / 5 not-established: "15 values may be treated as data, 10 may not, 5 are not established at all."',
    why_it_matters_here: 'Geometry on that example is present on 31 of 31 cells and measured on 0 - "a drawing with a bibliography" - which a boolean "has geometry" field would have hidden.',
    see_also: ['Aletheia', 'STL', 'FASTA', 'compliance vs modulus', 'in situ', 'holdout'],
    category: 'project-specific',
  }),
  e({
    id: 'standard-length',
    term: 'standard length',
    aliases: ['SL', 'standard lengths', 'over_SL'],
    short: 'A fish\'s snout-to-tail-base length, used as the denominator that makes body measurements comparable between specimens.',
    long: 'Dividing every measurement by standard length removes size, which is exactly what you want for comparing shape and exactly what breaks any law written about size. Two measurements can also be two words apart and be unrelated quantities: fin LENGTH and the snout-to-fin-BASE distance are different numbers on the same fin, and a bound from one applied to the other is a bound on a different quantity entirely.',
    concrete_example: 'Registry law E5 bounds pectoral fin LENGTH / SL to [0.406, 0.823] from 49 specimens (median 0.687), while the trait block carries `prepectoral_over_SL`, the snout-to-fin-base distance - "two words apart, unrelated measurements". And `scaling-area-law` is worse than unmeasurable on normalised traits: dividing an area by SL^2 IS the law, so it becomes a tautology with nothing to forbid.',
    why_it_matters_here: 'It is the structural reason the law layer and the design layer barely touch, rather than a shortfall in either.',
    see_also: ['allometry', 'q', 'gate', 'Nous', 'Mahalanobis distance'],
    category: 'project-specific',
  }),
]);

// =====================================================================================================
// Honest gaps. A term used in the repo that could not be defined well goes HERE, not above.
// =====================================================================================================

export const UNDEFINED_BUT_USED = Object.freeze([
  Object.freeze({
    term: '3DISS',
    where_seen: 'organism-format/life/spec.mjs header, as UTMM\'s "targeted in situ RNA sequencing in 3D"',
    why_not_defined: 'the expansion is in the repo but the method is not: nothing here says what the probe panel is, how reads are assigned to cells in a volume, or what the detection limit per cell is. An entry would be restating the acronym.',
  }),
  Object.freeze({
    term: 'RMSD0 / dRMSD',
    where_seen: 'spec.mjs correction 1, as the only form UTMM\'s per-cell mechanics is reported in',
    why_not_defined: 'the accessible text gives no units, no baseline definition and no conversion to pascals. The repo knows they are displacements and that they are relative; it does not know what they are displacements OF, over what interval.',
  }),
  Object.freeze({
    term: 'bridge (e.g. Delphi.Registry.bridge_E5)',
    where_seen: 'the `shared_scope.bridge` field of registry law JSON',
    why_not_defined: 'it evidently connects a law\'s stated atoms to the Lean theorem\'s own vocabulary, but lean/ is another thread\'s folder and nothing in the readable registry states what a bridge must prove for the connection to be sound.',
  }),
  Object.freeze({
    term: 'faithfulness (e.g. "faithful-with-narrower-scope (1 provider: openai)")',
    where_seen: '`evidence.faithfulness` in lean/registry/laws/*.json',
    why_not_defined: 'the value names a verdict and a provider count, which implies a model-judged comparison of statement_en against the Lean. The procedure, the prompt and the agreement rate are not recorded anywhere I could read, so I cannot say what the label licenses.',
  }),
  Object.freeze({
    term: 'flyingFishAudit / cannot-evaluate',
    where_seen: '`evidence.flyingFishAudit: { "cannot-evaluate": 7 }` in registry law JSON',
    why_not_defined: 'a counter of seven somethings that could not be evaluated. What the seven items are, and whether the count is of designs, specimens or constraints, is not stated beside it.',
  }),
  Object.freeze({
    term: 'statement_sha256 vs content_hash',
    where_seen: 'the `lean_ref` block of every registry law',
    why_not_defined: 'two hashes sit side by side and the registry does not say what text each covers, so I cannot explain which one changes when a statement is reworded without changing its meaning - which is the only question worth asking about them.',
  }),
  Object.freeze({
    term: 'the four-point condition / additivity',
    where_seen: 'organism-format/life/README.md, in the list of what compare.mjs does NOT check',
    why_not_defined: 'named only as absent. compare.mjs validates a distance matrix for neighbour joining and stops; nothing in the repo states the condition, so defining it here would be importing a textbook rather than reporting the code.',
  }),
  Object.freeze({
    term: 'liftover',
    where_seen: 'organism-format/life/README.md ("No liftover"), and the coordinate-convention note in spec.mjs',
    why_not_defined: 'the repo refuses the operation rather than implementing it, so there is no behaviour here to describe. What a liftover would have to guarantee about an edit\'s coordinates across two assemblies is exactly what is missing.',
  }),
  Object.freeze({
    term: 'actinodin / actinotrichia (and1, and2)',
    where_seen: 'the zhang_2010 citation in analogues/analogy.mjs',
    why_not_defined: 'cited for the fact that these genes have no tetrapod counterpart. Nothing else about them is held here, and a glossary entry built only on the citation line would be a paraphrase of a title.',
  }),
  Object.freeze({
    term: 'Hirschberg / WFA (linear-space and wavefront alignment)',
    where_seen: 'the cost note at the top of analogues/align.mjs',
    why_not_defined: 'named as the algorithms this module deliberately does not implement. I can say what they would buy - megabase sequence without O(n*m) memory - but not how, from anything in this repository.',
  }),
  Object.freeze({
    term: 'organ_containment (the constraint class)',
    where_seen: 'benchmarks/design-hard-negatives/README.md: "the benchmark\'s own organ_containment class, the right idea, has three items"',
    why_not_defined: 'the class is named and counted but its membership rule is not written down, so I cannot say what would qualify a fourth item.',
  }),
]);

// =====================================================================================================
// lookup and annotate
// =====================================================================================================

const INDEX = new Map();          // lowercased term or alias -> entry
const BY_ID = new Map();
for (const entry of GLOSSARY) {
  BY_ID.set(entry.id, entry);
  for (const key of [entry.term, ...entry.aliases]) {
    const k = key.toLowerCase();
    if (INDEX.has(k) && INDEX.get(k) !== entry) {
      throw new Error(`glossary: "${key}" is claimed by both ${INDEX.get(k).id} and ${entry.id}`);
    }
    INDEX.set(k, entry);
  }
}

/** Case-insensitive, alias-aware. Returns the entry or null; never throws on a miss. */
export function lookup(term) {
  if (typeof term !== 'string') return null;
  return INDEX.get(term.trim().toLowerCase()) ?? BY_ID.get(term.trim()) ?? null;
}

/** Every entry an id or a `see_also` could name, for a page that wants to build its own index. */
export function byId(id) {
  return typeof id === 'string' ? (BY_ID.get(id) ?? null) : null;
}

/** All searchable strings, longest first. Longest-first is what makes annotate() prefer the long term. */
const CANDIDATES = Object.freeze(
  [...INDEX.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
);

const isWordChar = c => c !== undefined && /[A-Za-z0-9_]/.test(c);

/**
 * Scan `text` and return the spans where glossary terms occur, non-overlapping, longest match first.
 *
 * Three rules, each of which exists because the naive version gets it wrong:
 *   - LONGEST MATCH WINS. "Mahalanobis distance" beats the alias "Mahalanobis" at the same position.
 *   - NO MATCH INSIDE A WORD. "PAM" does not match inside "PAMPHLET". The boundary is only enforced on
 *     an end whose own character is a word character, so "R*" and "--fail-once" still match.
 *   - NO OVERLAP. Once a span is taken the scan resumes after it, so a page can wrap every span without
 *     nesting one inside another.
 *
 * Returns [{ start, end, text, id, term, matched, category }], ascending by start. `end` is exclusive.
 */
export function annotate(text) {
  if (typeof text !== 'string' || !text) return [];
  const lower = text.toLowerCase();
  const spans = [];
  let i = 0;
  while (i < text.length) {
    let hit = null;
    for (const cand of CANDIDATES) {
      if (cand.length > text.length - i) continue;
      if (!lower.startsWith(cand, i)) continue;
      const end = i + cand.length;
      if (isWordChar(cand[0]) && isWordChar(text[i - 1])) continue;
      if (isWordChar(cand[cand.length - 1]) && isWordChar(text[end])) continue;
      hit = { cand, end };
      break;                       // CANDIDATES is longest-first, so the first hit is the longest
    }
    if (hit) {
      const entry = INDEX.get(hit.cand);
      spans.push(Object.freeze({
        start: i,
        end: hit.end,
        text: text.slice(i, hit.end),
        id: entry.id,
        term: entry.term,
        matched: hit.cand,
        category: entry.category,
      }));
      i = hit.end;
    } else {
      i++;
    }
  }
  return spans;
}

/** Counts per category, for the dev log's own index page. */
export function categoryCounts() {
  const out = {};
  for (const c of CATEGORIES) out[c] = 0;
  for (const g of GLOSSARY) out[g.category]++;
  return out;
}

// Run directly only. `endsWith('glossary.mjs')` would also fire for test-glossary.mjs, so the pattern
// requires a path separator (or the start of the string) immediately before the filename.
if (process.argv[1] && /(^|[\\/])glossary\.mjs$/.test(process.argv[1])) {
  console.log(`${GLOSSARY.length} terms, ${CANDIDATES.length} searchable strings`);
  for (const [c, n] of Object.entries(categoryCounts())) console.log(`  ${String(n).padStart(3)}  ${c}`);
  console.log(`\n${UNDEFINED_BUT_USED.length} term(s) seen in the repo and NOT defined:`);
  for (const u of UNDEFINED_BUT_USED) console.log(`  - ${u.term}`);
}
