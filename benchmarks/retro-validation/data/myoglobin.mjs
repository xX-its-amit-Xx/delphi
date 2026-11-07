#!/usr/bin/env node
// myoglobin.mjs - GROUND TRUTH FOR A PREDICTION WE CAN TEST TODAY, WITH NO WET LAB.
//
// ============================== WHAT THIS IS ==============================
// Mirceta et al. 2013 (Science 340:1234192, DOI 10.1126/science.1234192, PMID 23766330) reported that
// the NET SURFACE CHARGE of myoglobin (they call it Zmb) is elevated in diving mammals, and that this
// elevation is mechanistically linked to the maximal myoglobin concentration a muscle can carry. If
// that is real and if it scales, then from a myoglobin SEQUENCE ALONE - no animal, no tank, no
// catheter - a predictor should be able to order mammals by dive capacity. That is a prediction with a
// sign, a falsifier, and existing data to check it against. It is the cheapest honest test of this
// repo's whole premise that a function can be read off a borrowed sequence.
//
// So this file is the TARGET half of that test: 26 mammalian myoglobins, each with its sequence, and
// a maximum dive duration where one could be retrieved. It computes nothing. The predictor is a
// separate module; keeping them apart is the point, because a file that both derives the feature and
// holds the answer cannot be used to find out that the feature was wrong.
//
// ============================== THE THING TO READ BEFORE USING THIS ==============================
// FOUR limits, and they are not footnotes. A predictor built on this file without them will overclaim.
//
//   1. WE COULD NOT RETRIEVE MIRCETA'S OWN NUMBERS, OR THEIR DEFINITION OF Zmb. The paper is
//      paywalled: it has no PMCID (PubMed's id converter returns none), and the publisher page
//      returned HTTP 403. What we hold is the PubMed metadata record - title, authors, abstract, MeSH.
//      So we do not know their exact operational definition of "net surface charge": which residues
//      counted as surface, at which pH, with which pKa set, whether the haem propionates were
//      included. Any Zmb a predictor computes here is OUR definition, not theirs, and a predictor that
//      says it "reproduces Mirceta" is lying. See MIRCETA_2013.not_retrieved.
//
//   2. THE RETRIEVED SENTENCE IS NOT THE REGRESSION WE WANT. The abstract says charge is elevated in
//      DIVING SPECIES and is linked to maximal myoglobin CONCENTRATION. It does not, in the text we
//      actually have, state a quantitative Zmb-against-dive-duration relationship. The direction is
//      retrieved; the functional form, slope and scatter are not. See EXPECTED_DIRECTION.
//
//   3. "MAXIMUM DIVE DURATION" IS NOT ONE MEASUREMENT. A species maximum from decades of tagging is a
//      different quantity from the longest dive in one three-month deployment on eight animals, and
//      both differ from the longest dive seen in a 24-hour tag record. All three are in this file,
//      each labelled with its DURATION_KIND, because a maximum is an extreme-value statistic and
//      therefore grows with effort. Pooling them without the label manufactures a correlation with
//      sampling intensity and calls it biology.
//
//   4. THE TERRESTRIAL ANCHORS HAVE NO DIVE DURATION, AND THAT IS NOT A ZERO. Human, mouse, horse and
//      cow are here as the low-charge end of the axis, and their duration is null with a stated
//      reason, not 0. Writing 0 would be inventing a measurement; it would also be the single easiest
//      way to fake a strong correlation, since four exact zeros at one end of a scatter will carry a
//      regression on their own.
//
// ============================== DATA PROVENANCE ==============================
// Every accession below was fetched live from https://rest.uniprot.org/uniprotkb/<acc>.json on
// FETCHED_ON, and the organism name and sequence length READ BACK from that response are stored on the
// row. Nothing here was recalled. Five candidate accessions were read and then dropped, three of them
// for residue-level ambiguity that this file's own tests caught after the first draft was written; they
// are all in ROWS_DROPPED with the reason, because a dropped row is evidence about the search and a
// silent drop is not. See SEQUENCE_AMBIGUITY, which is the most transferable thing in this file.
//
// The subset is MAMMALS ONLY, because this repo's comparative scope is mammals and fishes. Mirceta's
// own analysis spanned a 130-species mammalian phylogeny; the compilation tables we read for dive
// durations cover more mammals than we use. We took only the rows we could verify end to end.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). This file names no member
// of it and reads no datum from it. Run `node holdout/check-leaks.mjs benchmarks/retro-validation`.
//
//   node benchmarks/retro-validation/data/myoglobin.mjs        # print summary()
//   node benchmarks/retro-validation/data/test-myoglobin.mjs   # the tests

const deepFreeze = (o) => {
  if (o && (typeof o === 'object') && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};

// ====================================================================================================
// THE DATE
// ====================================================================================================
// Every UniProt read and every full-text fetch recorded below happened on this date. UniProt entries
// are revised; a sequence stored here is a snapshot, and a predictor that re-fetches may get a
// different one. That is a fact about the resource, not a defect in the file.
export const FETCHED_ON = '2026-11-07';

// ====================================================================================================
// SOURCES - EVERY ONE OF THESE WAS ACTUALLY RETRIEVED
// ====================================================================================================
// `verified_how` says exactly what was fetched and what was read out of it. Where a number comes from a
// sentence, the sentence is quoted verbatim. Where it comes from a table, the table is named and the
// primary study the table itself credits is recorded in `table_credits`, unretrieved and labelled so.
export const SOURCES = deepFreeze({
  mirceta_2013: {
    what: "Mirceta S, Signore AV, Burns JM, Cossins AR, Campbell KL, Berenbrink M (2013) Evolution of mammalian diving capacity traced by myoglobin net surface charge. Science 340(6138):1234192.",
    doi: '10.1126/science.1234192',
    pmid: '23766330',
    pmcid: null,
    verified_how: 'PubMed MCP get_article_metadata on PMID 23766330 returned the record: title, full abstract, author list, MeSH terms, journal, pages. DOI in the record matches 10.1126/science.1234192. convert_article_ids on the same PMID returned NO pmcid, so there is no PMC full text. A WebFetch of https://www.science.org/doi/10.1126/science.1234192 returned HTTP 403.',
    retrieved: 'metadata record and abstract',
    not_retrieved: 'full text, figures, figure legends, supplementary tables, the Zmb values per species, and the operational definition of Zmb',
  },
  schorr_2014: {
    what: 'Schorr GS, Falcone EA, Moretti DJ, Andrews RD (2014) First long-term behavioral records from Cuvier’s beaked whales (Ziphius cavirostris) reveal record-breaking dives. PLoS ONE 9(3):e92633.',
    doi: '10.1371/journal.pone.0092633',
    pmid: '24670984',
    pmcid: 'PMC3966784',
    verified_how: 'Full text XML fetched from Europe PMC (/PMC3966784/fullTextXML, 101719 bytes) and read. The Results section states verbatim: "The deepest dive reached 2992 m, and the longest dive lasted 137.5 min." The abstract of the same fetched document states "dives to 2992 m depth and lasting 137.5 min, both new mammalian dive records" from 3732 hours of dive data across eight tagged whales.',
    note: 'A Formal Comment (Tyack et al. 2015, PMC4683059) and a rebuttal exist on this paper; both were seen in the fetched reference block. Neither was retrieved, and neither is known here to dispute the 137.5 min figure.',
  },
  hyperoodon_2025: {
    what: 'Long-term depth records of satellite-tagged northern bottlenose whales reveal extraordinary dive capabilities. Ecology and Evolution (2025).',
    doi: '10.1002/ece3.71862',
    pmid: '40740810',
    pmcid: 'PMC12310271',
    verified_how: 'Full text XML fetched from Europe PMC (/PMC12310271/fullTextXML, 163748 bytes) and read. Figure 4 legend states verbatim: "Dive profiles (black lines) reconstructed from dive summary information, containing the (a) longest dive (98 min; ID 161593) and (b) two deepest dives (both to 2288 m; ID 161588) in the data set."',
    note: 'The same fetched text refers, in its introduction, to "the longest dive lasting 2 h and 10 min (Wensveen et al. ...)". That 130 min figure was NOT retrieved from its own source and is not used here; the 98 min value is the maximum in the dataset this paper itself reports.',
  },
  cribriform_2020: {
    what: 'Olfaction at depth: cribriform plate size declines with dive depth and duration in aquatic arctoid carnivorans. Ecology and Evolution (2020). Appendix TABLE A2 compiles mean and maximum dive depth and duration for aquatic arctoid carnivorans with per-value references.',
    doi: '10.1002/ece3.6343',
    pmid: '32760503',
    pmcid: 'PMC7391337',
    verified_how: 'Full text XML fetched from Europe PMC (/PMC7391337/fullTextXML, 260400 bytes); TABLE A2 extracted and read cell by cell. The table’s own caption states: "Maximum dive depth and duration values were sourced from single studies." Each maximum used below was read from that table together with the study the table credits for it.',
    source_kind: 'compilation table, read directly',
    table_credits_were_not_retrieved: 'The primary studies TABLE A2 credits (Stewart & DeLong 1995, Heerah et al. 2013, Blanchet et al. 2015, Hamilton et al. 2018, Gjertz et al. 2001, Costa et al. 2007, Ralls et al. 1995) were NOT retrieved. Each value below therefore carries this compilation as its source and names the credited study as an attribution, not as a source we checked.',
  },
  mmp_cetaceans_2025: {
    what: 'Molecular adaptations in MMP genes support lung elasticity and diving adaptations in cetaceans. BMC Genomics (2025).',
    doi: '10.1186/s12864-025-11751-2',
    pmid: '40474088',
    pmcid: 'PMC12143041',
    verified_how: 'Full text XML fetched from Europe PMC (/PMC12143041/fullTextXML) and read. Its introduction states verbatim: "Sperm whales (Physeter macrocephalus) can dive to depths of up to 3,000 m, with maximum dive durations of 138 min [8–10]."',
    source_kind: 'review statement, read directly',
    table_credits_were_not_retrieved: 'That sentence cites its own references 8-10, which were NOT retrieved. The 138 min figure is therefore a review statement we read, not a primary measurement we checked.',
  },
  fahlman_2018: {
    what: 'Fahlman A, et al. (2018) Modeling tissue and blood gas kinetics in coastal and offshore common bottlenose dolphins, Tursiops truncatus. Frontiers in Physiology 9:838.',
    doi: '10.3389/fphys.2018.00838',
    pmid: '30072907',
    pmcid: 'PMC6060447',
    verified_how: 'Full text XML fetched from Europe PMC (/PMC6060447/fullTextXML, 65266 bytes) and read. The Discussion states verbatim: "With a maximal dive duration of 9 min, this provided a considerable scope for the Bermuda dolphins." The Methods of the same fetched document describe DTAG deployments programmed to release after <24 h on offshore animals near Bermuda.',
    note: 'This is the longest dive in a set of sub-24-hour tag records on a handful of offshore animals. It is a lower bound on the species maximum and is labelled as such.',
  },
  hooded_seal_2024: {
    what: 'Circadian coupling of mitochondria in a deep-diving mammal. Journal of Experimental Biology (2024).',
    doi: '10.1242/jeb.246990',
    pmid: '38495024',
    pmcid: 'PMC11058691',
    verified_how: 'Full text XML fetched from Europe PMC (/PMC11058691/fullTextXML, 61542 bytes) and read. Its introduction states verbatim: "Among them, the hooded seal is known for its remarkable diving capacity (Folkow and Blix, 1999): dives exceeding durations of 1 h and depths of 1600 m have been recorded (Andersen et al. ...)".',
    note: 'This is a LOWER BOUND ("exceeding 1 h"), not a maximum. It is recorded on the hooded seal row as a lower bound and its duration stays null.',
  },
  uniprot: {
    what: 'UniProtKB, the protein sequence and annotation resource.',
    endpoint: 'https://rest.uniprot.org/uniprotkb/<accession>.json',
    verified_how: `Each accession in ROWS and ROWS_DROPPED was fetched individually on ${'2026-11-07'} and the JSON parsed. The organism scientific name, NCBI taxon id, protein name, gene name, sequence length, entry type and sequence were read out of the response and are stored verbatim on the row as *_read_back fields. No accession was written from memory and then assumed to resolve.`,
  },
});

// ====================================================================================================
// THE PAPER'S RECORD
// ====================================================================================================
export const MIRCETA_2013 = deepFreeze({
  ...SOURCES.mirceta_2013,
  title: 'Evolution of mammalian diving capacity traced by myoglobin net surface charge.',
  journal: 'Science 340(6138):1234192, 14 June 2013',
  authors: ['Mirceta S', 'Signore AV', 'Burns JM', 'Cossins AR', 'Campbell KL', 'Berenbrink M'],
  abstract_retrieved: 'Extended breath-hold endurance enables the exploitation of the aquatic niche by numerous mammalian lineages and is accomplished by elevated body oxygen stores and adaptations that promote their economical use. However, little is known regarding the molecular and evolutionary underpinnings of the high muscle myoglobin concentration phenotype of divers. We used ancestral sequence reconstruction to trace the evolution of this oxygen-storing protein across a 130-species mammalian phylogeny and reveal an adaptive molecular signature of elevated myoglobin net surface charge in diving species that is mechanistically linked with maximal myoglobin concentration. This observation provides insights into the tempo and routes to enhanced dive capacity evolution within the ancestors of each major mammalian aquatic lineage and infers amphibious ancestries of echidnas, moles, hyraxes, and elephants, offering a fresh perspective on the evolution of this iconic respiratory pigment.',
  abstract_verified_how: 'Returned verbatim by PubMed MCP get_article_metadata for PMID 23766330. Not transcribed from memory.',
  what_the_abstract_does_say: [
    'Charge is ELEVATED in diving species - a group contrast, with a direction.',
    'That elevation is MECHANISTICALLY LINKED to maximal myoglobin CONCENTRATION - a protein-chemistry claim, about solubility at high concentration, not about behaviour.',
    'The method was ancestral sequence reconstruction across a 130-species mammalian phylogeny.',
    'The analysis is explicitly phylogenetic, so species are not independent points and a naive cross-species regression is the wrong test of it.',
  ],
  what_the_abstract_does_NOT_say: [
    'No slope, intercept, r2 or confidence interval for charge against dive duration appears in the retrieved text.',
    'No per-species charge value appears in the retrieved text.',
    'No statement that charge predicts dive duration CONTINUOUSLY, as opposed to separating divers from non-divers, appears in the retrieved text.',
    'The operational definition of net surface charge - residues counted, pH, pKa set, treatment of the haem - does not appear in the retrieved text.',
  ],
  therefore: 'A predictor using this file may test the DIRECTION and the GROUP SEPARATION against retrieved text. It may not claim to reproduce, confirm or refute Mirceta’s quantitative result, because that result was never in our hands.',
});

// ====================================================================================================
// THE DIRECTION BEING TESTED
// ====================================================================================================
export const EXPECTED_DIRECTION = deepFreeze({
  sign: 'positive',
  claim: 'Higher myoglobin net surface charge goes with greater dive capacity; low charge goes with no diving.',
  exact_sentence_retrieved: 'We used ancestral sequence reconstruction to trace the evolution of this oxygen-storing protein across a 130-species mammalian phylogeny and reveal an adaptive molecular signature of elevated myoglobin net surface charge in diving species that is mechanistically linked with maximal myoglobin concentration.',
  sentence_source: 'Abstract of PMID 23766330, retrieved verbatim via PubMed MCP get_article_metadata.',
  what_the_sentence_licenses: 'A one-sided, directional hypothesis: divers > non-divers in net surface charge. Nothing about the shape of the relationship within divers.',
  what_the_sentence_does_not_license: 'A monotone, continuous prediction of maximum dive duration in minutes from charge. The abstract links charge to myoglobin CONCENTRATION, and concentration to dive capacity is a second step that the retrieved text does not quantify.',
  how_it_could_be_wrong_here: [
    'The direction could hold between divers and non-divers and carry no information WITHIN divers. Then the whole apparent correlation in this file is one group contrast wearing a regression line.',
    'Maximum dive duration scales steeply with body mass. Cetaceans are both large and high-charge, so mass is a confound with the right sign and will inflate any naive fit.',
    'Our Zmb is not their Zmb (limit 1 above). A null result could be our definition, not their biology.',
    'The duration values are extreme-value statistics with unequal effort (DURATION_KINDS). Effort correlates with how charismatic and tractable a species is, which is not independent of how deep it dives.',
  ],
});

// ====================================================================================================
// DURATION KINDS - A CLOSED VOCABULARY, BECAUSE "MAXIMUM" IS NOT ONE MEASUREMENT
// ====================================================================================================
export const DURATION_KINDS = deepFreeze({
  'species-maximum-directly-reported': {
    means: 'A species-level maximum stated as such in a primary study we fetched and read.',
    effort: 'large: multi-animal, multi-month instrumented records',
    use_for_regression: true,
  },
  'species-maximum-from-compilation-table': {
    means: 'A species-level maximum read out of a compilation table we fetched, which credits a primary study we did NOT fetch.',
    effort: 'large, but asserted at one remove',
    use_for_regression: true,
  },
  'species-maximum-review-statement': {
    means: 'A species-level maximum stated in the prose of a review or research paper we fetched, citing sources we did NOT fetch.',
    effort: 'unknown; the number has no methods section attached to it here',
    use_for_regression: true,
  },
  'observed-maximum-in-one-study': {
    means: 'The longest dive in ONE study’s own records. A lower bound on the species maximum, not an estimate of it.',
    effort: 'small: few animals, short deployments',
    use_for_regression: false,
  },
});
export const DURATION_KIND_IDS = deepFreeze(Object.keys(DURATION_KINDS));

export const HABITS = deepFreeze(['fully-aquatic', 'amphibious', 'semi-aquatic', 'strictly-terrestrial']);
export const CLADES = deepFreeze(['cetacean', 'pinniped', 'sirenian', 'mustelid', 'rodent', 'primate', 'perissodactyl', 'artiodactyl']);

const NO_DIVE_NULL = {
  value: null,
  units: 'min',
  null_reason: 'Strictly terrestrial. Maximum dive duration is not a measured trait for this species, and we retrieved no such measurement. It is recorded as null rather than 0 because 0 would be a fabricated measurement, and four exact zeros at one end of the axis would carry a regression on their own.',
  what_would_have_to_be_measured: 'Nothing. For a strictly terrestrial mammal the quantity is undefined; what belongs in a predictor is the categorical fact that it does not dive, which is in `habit`.',
  source: null,
};

// ====================================================================================================
// THE SEQUENCES, AS READ BACK FROM UNIPROT ON THE FETCH DATE
// ====================================================================================================
// Embedded so the predictor runs offline. Each was taken from the `sequence.value` field of the live
// JSON response for that accession; none was typed from memory. All 26 are 154 aa and contain only the
// twenty standard residue letters - no B, Z or X - which is checked by the tests and is why three
// species that were here in the first draft are now in ROWS_DROPPED. See SEQUENCE_AMBIGUITY.
const SEQUENCES = deepFreeze({
  P02185: 'MVLSEGEWQLVLHVWAKVEADVAGHGQDILIRLFKSHPETLEKFDRFKHLKTEAEMKASEDLKKHGVTVLTALGAILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSRHPGDFGADAQGAMNKALELFRKDIAAKYKELGYQG', // Physeter macrocephalus
  P02182: 'MGLSEAEWQLVLHVWAKVEADLSGHGQEILIRLFKGHPETLEKFDKFKHLKSEAEMKASEDLKKHGHTVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISDAIIHVLHSRHPSDFGADAQAAMTKALELFRKDIAAKYKELGFHG', // Ziphius cavirostris
  R9RZA4: 'MGLSEAEWQLVLHVWAKVEADLSGHGQEILIRLFKGHPETLEKFEKFKHLKSEAEMKASEDLKKHGHTVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISDAIIHVLHSKHPSDFGADAQGAMTKALELFRKDIAAKYKELGFHG', // Hyperoodon ampullatus
  P68279: 'MGLSDGEWQLVLNVWGKVEADLAGHGQDVLIRLFKGHPETLEKFDKFKHLKTEADMKASEDLKKHGNTVLTALGAILKKKGHHDAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSRHPAEFGADAQGAMNKALELFRKDIAAKYKELGFHG', // Tursiops truncatus
  P02174: 'MGLSDGEWQLVLNVWGKVEADLAGHGQDILIRLFKGHPETLEKFDKFKHLKTEADMKASEDLKKHGNTVLTALGAILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSRHPAEFGADAQGAMNKALELFRKDIAAKYKELGFHG', // Globicephala melas
  P02173: 'MGLSDGEWQLVLNVWGKVEADLAGHGQDILIRLFKGHPETLEKFDKFKHLKTEADMKASEDLKKHGNTVLTALGAILKKKGHHDAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSRHPAEFGADAQGAMNKALELFRKDIAAKYKELGFHG', // Orcinus orca
  A0A140GN53: 'MGLSEGEWQLVLNVWGKVEADLAGHGQDVLIRLFKGHPETLEKFDKFKHLKTEAEMKASEDLKKHGNTVLTALGGILKKKGHHDAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSRHPGDFGADAQGAMNKALELFRKDIAAKYKELGFHG', // Delphinapterus leucas
  P02179: 'MVLSDAEWHLVLNIWAKVEADVAGHGQDILIRLFKGHPETLEKFDKFKHLKTEAEMKASEDLKKHGNTVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISDAIIHVLHSRHPAEFGADAQAAMNKALELFRKDIAAKYKELGFQG', // Balaenoptera acutorostrata
  R9RY75: 'MGLSEGEWQLVLNVWGKVEADLAGHGQDVLIRLFKGHPETLEKFDKFRHLKTEAEMKASEDLKKHGNTVLTALGGILKKKGHHDAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSRHPGDFGADAQGAMNKALELFRKDIAAKYKELGFHG', // Monodon monoceros
  R9S002: 'MGLSDGEWHLVLNIWGKVETDLAGHGQEVLIRLFRSHPETLEKFDKFKHLKSEDDMRRSEDLRKHGNTVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISEAIIQVLHNKHPGEFGADTQAAMKKALELFRNDIATKYKELGFHG', // Mirounga angustirostris
  R9RY82: 'MGLSDGEWHLVLNIWGKVETDLAGHGQEVLIRLFKSHPETLEKFDKFKHLKSEDDMRRSEDLRKHGNTVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSKHPAEFGADTQAAMKKALELFRNDIAAKYKELGFHG', // Leptonychotes weddellii
  P68080: 'MGLSDGEWHLVLNVWGKVETDLAGHGQEVLIRLFKSHPETLEKFDKFKHLKSEDDMRRSEDLRKHGNTVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSKHPAEFGADAQAAMKKALELFRNDIAAKYKELGFHG', // Phoca vitulina
  R9RZL2: 'MGLSDGEWHLVLNIWGKVETDLAGHGQEVLIRLFKSHPETLEKFDKFKHLKSEDDMRRSEDLRKHGNTVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISEAIIQVLHSKHPGEFGADTQAAMKKALELFRNDIAAKYKELGFHG', // Erignathus barbatus
  R9S006: 'MGLSDGEWQLVLNVWGKVEADLAGHGQEVLIRLFKGHPETLEKFDKFKHLKSEDEMKRSEDLKKHGKTVLTALGGIFKKKGHHDAELKPLAQSHATKHKIPIKYLEFISEAIIQVLQSKHPGDFGADTHAAMKKALELFRNDIAAKYRELGFQG', // Odobenus rosmarus
  P02161: 'MGLSDGEWQLVLNIWGKVEADLVGHGQEVLIRLFKGHPETLEKFDKFKHLKSEDEMKRSEDLKKHGKTVLTALGGILKKKGHHDAELKPLAQSHATKHKIPIKYLEFISEAIIHVLQSKHPGDFGADTHAAMKKALELFRNDIAAKYRELGFQG', // Zalophus californianus
  P68081: 'MGLSDGEWHLVLNVWGKVETDLAGHGQEVLIRLFKSHPETLEKFDKFKHLKSEDDMRRSEDLRKHGNTVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSKHPAEFGADAQAAMKKALELFRNDIAAKYKELGFHG', // Halichoerus grypus
  R9RZ94: 'MGLSDGEWHLVLNVWGKVETDLAGHGQEVLIRLFKSHPETLEKFDKFKHLKSEDDMRRSEDLRKHGNTVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSKHPAEFGADAQAAMKKALELFRNDIAAKYKELGFHG', // Cystophora cristata
  A0A2Y9DG99: 'MALSDGEWQLVLNVWGKVEADIAGHGLEVLISLFKGHPETLEKFDKFKHLKSEEEMKACEDLKKHGVTVLTALGGILKKKGHHQAEIQPLAQSHATKHKIPVKYLEFISEAIIHVLQSKHPGDFGADAQGAMSKALELFRNAMAANYKELGFQG', // Trichechus manatus latirostris
  R9S070: 'MVLSDGEWQLVLNVWGKVEADIAGHGLEVLISLFKGHPETLEKFDKFKHLKTEEEMKACEDLKKHGTTVLTALGGILKKKGHHQAEIQPLAQSHATKHKIPVKYLEFISEAIIHVLQSKHPGDFGADAQGAMRKALELFRNDMAAKYKELGFQG', // Dugong dugon
  A0A2Y9KZQ2: 'MGLSDGEWQLVLNVWGKVEADLAGHGQEVLIRLFKGHPETLEKFDKFKHLKSEDEMKGSEDLKKHGNTVLTALGGILKKKGKHEAELKPLAQSHATKHKIPIKYLEFISEAIIQVLQSKHPRDFGADAQAAMRKALELFRNDIAAKYKELGFQG', // Enhydra lutris kenyoni
  P11343: 'MGLSDGEWQLVLNVWGKVEADLAGHGQEVLIRLFKGHPETLEKFDKFKHLKSEDEMKGSEDLKKHGNTVLTALGGILKKKGKHEAELKPLAQSHATKHKIPIKYLEFISEAIIQVLQSKHPGDFGADAQGAMKRALELFRNDIAAKYKELGFQG', // Lutra lutra
  A0A250XVB6: 'MGLSDGEWQLVLKVWGKVEADLAGHGQEVLIRLFKGHPETLEKFDKFKHLKSEDEMKASEDLKKHGVTVLTALGGVLKKKGHHEAEIKPLAQSHATKHKIPIKYLEFISEAIIHVLQSKHPGDFGADAKSAMSKALELFRHDIAAKYKELGFQG', // Castor canadensis
  P02144: 'MGLSDGEWQLVLNVWGKVEADIPGHGQEVLIRLFKGHPETLEKFDKFKHLKSEDEMKASEDLKKHGATVLTALGGILKKKGHHEAEIKPLAQSHATKHKIPVKYLEFISECIIQVLQSKHPGDFGADAQGAMNKALELFRKDMASNYKELGFQG', // Homo sapiens
  P04247: 'MGLSDGEWQLVLNVWGKVEADLAGHGQEVLIGLFKTHPETLDKFDKFKNLKSEEDMKGSEDLKKHGCTVLTALGTILKKKGQHAAEIQPLAQSHATKHKIPVKYLEFISEIIIEVLKKRHSGDFGADAQGAMSKALELFRNDIAAKYKELGFQG', // Mus musculus
  P68082: 'MGLSDGEWQQVLNVWGKVEADIAGHGQEVLIRLFTGHPETLEKFDKFKHLKTEAEMKASEDLKKHGTVVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISDAIIHVLHSKHPGDFGADAQGAMTKALELFRNDIAAKYKELGFQG', // Equus caballus
  P02192: 'MGLSDGEWQLVLNAWGKVEADVAGHGQEVLIRLFTGHPETLEKFDKFKHLKTEAEMKASEDLKKHGNTVLTALGGILKKKGHHEAEVKHLAESHANKHKIPVKYLEFISDAIIHVLHAKHPSDFGADAQAAMSKALELFRNDMAAQYKVLGFHG', // Bos taurus
});

const row = (o) => ({
  ...o,
  uniprot: { ...o.uniprot, verified_on: FETCHED_ON, verified_how: SOURCES.uniprot.verified_how, endpoint: `https://rest.uniprot.org/uniprotkb/${o.uniprot.accession}.json` },
  sequence: SEQUENCES[o.uniprot.accession],
});

// ====================================================================================================
// THE ROWS
// ====================================================================================================
// One row per species. `uniprot.organism_read_back` and `uniprot.length_read_back` are what the live
// JSON actually said, not what we expected it to say; the tests compare them against `latin` and
// against the stored sequence, so a wrong accession cannot sit here quietly.
export const ROWS = deepFreeze([
  // ---------- CETACEANS ----------
  row({
    latin: 'Physeter macrocephalus', common: 'sperm whale', clade: 'cetacean', habit: 'fully-aquatic',
    uniprot: { accession: 'P02185', entry_name: 'MYG_PHYMC', organism_read_back: 'Physeter macrocephalus', taxon_id_read_back: 9755, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: {
      value: 138, units: 'min', kind: 'species-maximum-review-statement',
      source: { doi: SOURCES.mmp_cetaceans_2025.doi, pmid: SOURCES.mmp_cetaceans_2025.pmid, pmcid: SOURCES.mmp_cetaceans_2025.pmcid },
      quote: 'Sperm whales (Physeter macrocephalus) can dive to depths of up to 3,000 m, with maximum dive durations of 138 min [8–10].',
      primary_source_retrieved: false,
      caveat: 'A review statement. Its own references 8-10 were not retrieved, so the methods behind 138 min are unknown to this file.',
    },
  }),
  row({
    latin: 'Ziphius cavirostris', common: 'Cuvier’s beaked whale', clade: 'cetacean', habit: 'fully-aquatic',
    uniprot: { accession: 'P02182', entry_name: 'MYG_ZIPCA', organism_read_back: 'Ziphius cavirostris', taxon_id_read_back: 9760, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: {
      value: 137.5, units: 'min', kind: 'species-maximum-directly-reported',
      source: { doi: SOURCES.schorr_2014.doi, pmid: SOURCES.schorr_2014.pmid, pmcid: SOURCES.schorr_2014.pmcid },
      quote: 'The deepest dive reached 2992 m, and the longest dive lasted 137.5 min.',
      primary_source_retrieved: true,
      caveat: 'From 3732 h of dive data on eight tagged whales. The strongest-evidenced duration in this file.',
    },
  }),
  row({
    latin: 'Hyperoodon ampullatus', common: 'northern bottlenose whale', clade: 'cetacean', habit: 'fully-aquatic',
    uniprot: { accession: 'R9RZA4', entry_name: 'R9RZA4_HYPAP', organism_read_back: 'Hyperoodon ampullatus', taxon_id_read_back: 48744, protein_name_read_back: 'Myoglobin', gene_read_back: 'Mb', length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    max_dive_duration: {
      value: 98, units: 'min', kind: 'observed-maximum-in-one-study',
      source: { doi: SOURCES.hyperoodon_2025.doi, pmid: SOURCES.hyperoodon_2025.pmid, pmcid: SOURCES.hyperoodon_2025.pmcid },
      quote: 'containing the (a) longest dive (98 min; ID 161593) and (b) two deepest dives (both to 2288 m; ID 161588) in the data set',
      primary_source_retrieved: true,
      caveat: 'The longest dive in THAT dataset. The same paper cites a longer dive (2 h 10 min) attributed to another study we did not retrieve, so 98 min is very likely below the species maximum.',
    },
  }),
  row({
    latin: 'Tursiops truncatus', common: 'common bottlenose dolphin', clade: 'cetacean', habit: 'fully-aquatic',
    uniprot: { accession: 'P68279', entry_name: 'MYG_TURTR', organism_read_back: 'Tursiops truncatus', taxon_id_read_back: 9739, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: {
      value: 9, units: 'min', kind: 'observed-maximum-in-one-study',
      source: { doi: SOURCES.fahlman_2018.doi, pmid: SOURCES.fahlman_2018.pmid, pmcid: SOURCES.fahlman_2018.pmcid },
      quote: 'With a maximal dive duration of 9 min, this provided a considerable scope for the Bermuda dolphins.',
      primary_source_retrieved: true,
      caveat: 'Longest dive in sub-24-hour DTAG records on a few offshore animals. A lower bound. Coastal animals in the same study dived far less; the species spans ecotypes with different dive behaviour and one number cannot represent it.',
    },
  }),
  row({
    latin: 'Globicephala melas', common: 'long-finned pilot whale', clade: 'cetacean', habit: 'fully-aquatic',
    uniprot: { accession: 'P02174', entry_name: 'MYG_GLOME', organism_read_back: 'Globicephala melas', taxon_id_read_back: 9731, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'No maximum dive duration for this species could be retrieved. Open-access searches of Europe PMC for this binomial with "longest dive" or "dive duration" returned no document stating a species maximum that we could read.',
      what_would_have_to_be_measured: 'A published species maximum from satellite or archival tag records, or access to one of the paywalled compilations that carry it.',
      source: null,
    },
  }),
  row({
    latin: 'Orcinus orca', common: 'killer whale', clade: 'cetacean', habit: 'fully-aquatic',
    uniprot: { accession: 'P02173', entry_name: 'MYG_ORCOR', organism_read_back: 'Orcinus orca', taxon_id_read_back: 9733, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'No species maximum retrieved. One fetched paper described this species as diving "just over 10 minutes" in a comparative aside, which is prose about typical behaviour and not a maximum, so it was not used.',
      what_would_have_to_be_measured: 'A published species maximum from tag records.',
      source: null,
    },
  }),
  row({
    latin: 'Delphinapterus leucas', common: 'beluga whale', clade: 'cetacean', habit: 'fully-aquatic',
    uniprot: { accession: 'A0A140GN53', entry_name: 'A0A140GN53_DELLE', organism_read_back: 'Delphinapterus leucas', taxon_id_read_back: 9749, protein_name_read_back: 'Myoglobin', gene_read_back: null, length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    accession_note: 'The reviewed beluga entry P83682 was fetched first and DROPPED: it carries eleven X residues. This unreviewed genome-derived entry has none. See ROWS_DROPPED and SEQUENCE_AMBIGUITY - an unreviewed entry with determined residues beats a reviewed one with undetermined ones for a charge feature.',
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'No species maximum retrieved from any open-access document we fetched.',
      what_would_have_to_be_measured: 'A published species maximum from satellite tag records.',
      source: null,
    },
  }),
  row({
    latin: 'Monodon monoceros', common: 'narwhal', clade: 'cetacean', habit: 'fully-aquatic',
    uniprot: { accession: 'R9RY75', entry_name: 'R9RY75_MONMO', organism_read_back: 'Monodon monoceros', taxon_id_read_back: 40151, protein_name_read_back: 'Myoglobin', gene_read_back: null, length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'No species maximum retrieved. Open-access searches for this binomial with "longest dive" returned documents that mention the species without stating a species maximum we could read.',
      what_would_have_to_be_measured: 'A published species maximum from satellite tag records.',
      source: null,
    },
  }),
  row({
    latin: 'Balaenoptera acutorostrata', common: 'common minke whale', clade: 'cetacean', habit: 'fully-aquatic',
    uniprot: { accession: 'P02179', entry_name: 'MYG_BALAC', organism_read_back: 'Balaenoptera acutorostrata', taxon_id_read_back: 9767, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'No species maximum retrieved. This row is in the file on purpose: a large, fully aquatic but comparatively shallow-diving baleen whale is the case that separates "charge tracks dive capacity" from "charge tracks being a whale".',
      what_would_have_to_be_measured: 'A published species maximum from tag records.',
      source: null,
    },
  }),

  // ---------- PINNIPEDS ----------
  row({
    latin: 'Mirounga angustirostris', common: 'northern elephant seal', clade: 'pinniped', habit: 'amphibious',
    uniprot: { accession: 'R9S002', entry_name: 'R9S002_MIRAN', organism_read_back: 'Mirounga angustirostris', taxon_id_read_back: 9716, protein_name_read_back: 'Myoglobin', gene_read_back: 'Mb', length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    max_dive_duration: {
      value: 119, units: 'min', kind: 'species-maximum-from-compilation-table',
      source: { doi: SOURCES.cribriform_2020.doi, pmid: SOURCES.cribriform_2020.pmid, pmcid: SOURCES.cribriform_2020.pmcid, table: 'TABLE A2, Phocidae, Mirounga angustirostris, "Max. duration (min)"' },
      attributed_by_that_table_to: 'Stewart & DeLong (1995)',
      primary_source_retrieved: false,
    },
  }),
  row({
    latin: 'Leptonychotes weddellii', common: 'Weddell seal', clade: 'pinniped', habit: 'amphibious',
    uniprot: { accession: 'R9RY82', entry_name: 'R9RY82_LEPWE', organism_read_back: 'Leptonychotes weddellii', taxon_id_read_back: 9713, protein_name_read_back: 'Myoglobin', gene_read_back: 'Mb', length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    max_dive_duration: {
      value: 96, units: 'min', kind: 'species-maximum-from-compilation-table',
      source: { doi: SOURCES.cribriform_2020.doi, pmid: SOURCES.cribriform_2020.pmid, pmcid: SOURCES.cribriform_2020.pmcid, table: 'TABLE A2, Phocidae, Leptonychotes weddellii, "Max. duration (min)"' },
      attributed_by_that_table_to: 'Heerah et al. (2013)',
      primary_source_retrieved: false,
    },
  }),
  row({
    latin: 'Phoca vitulina', common: 'harbor seal', clade: 'pinniped', habit: 'amphibious',
    uniprot: { accession: 'P68080', entry_name: 'MYG_PHOVI', organism_read_back: 'Phoca vitulina', taxon_id_read_back: 9720, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: {
      value: 37, units: 'min', kind: 'species-maximum-from-compilation-table',
      source: { doi: SOURCES.cribriform_2020.doi, pmid: SOURCES.cribriform_2020.pmid, pmcid: SOURCES.cribriform_2020.pmcid, table: 'TABLE A2, Phocidae, Phoca vitulina, "Max. duration (min)"' },
      attributed_by_that_table_to: 'Blanchet et al. (2015)',
      primary_source_retrieved: false,
    },
  }),
  row({
    latin: 'Erignathus barbatus', common: 'bearded seal', clade: 'pinniped', habit: 'amphibious',
    uniprot: { accession: 'R9RZL2', entry_name: 'R9RZL2_ERIBA', organism_read_back: 'Erignathus barbatus', taxon_id_read_back: 39304, protein_name_read_back: 'Myoglobin', gene_read_back: 'Mb', length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    max_dive_duration: {
      value: 24, units: 'min', kind: 'species-maximum-from-compilation-table',
      source: { doi: SOURCES.cribriform_2020.doi, pmid: SOURCES.cribriform_2020.pmid, pmcid: SOURCES.cribriform_2020.pmcid, table: 'TABLE A2, Phocidae, Erignathus barbatus, "Max. duration (min)"' },
      attributed_by_that_table_to: 'Hamilton et al. (2018)',
      primary_source_retrieved: false,
    },
  }),
  row({
    latin: 'Odobenus rosmarus', common: 'walrus', clade: 'pinniped', habit: 'amphibious',
    uniprot: { accession: 'R9S006', entry_name: 'R9S006_9CARN', organism_read_back: 'Odobenus rosmarus', taxon_id_read_back: 9707, protein_name_read_back: 'Myoglobin', gene_read_back: 'Mb', length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    max_dive_duration: {
      value: 24, units: 'min', kind: 'species-maximum-from-compilation-table',
      source: { doi: SOURCES.cribriform_2020.doi, pmid: SOURCES.cribriform_2020.pmid, pmcid: SOURCES.cribriform_2020.pmcid, table: 'TABLE A2, Odobenidae, Odobenus rosmarus, "Max. duration (min)"' },
      attributed_by_that_table_to: 'Gjertz et al. (2001)',
      primary_source_retrieved: false,
    },
  }),
  row({
    latin: 'Zalophus californianus', common: 'California sea lion', clade: 'pinniped', habit: 'amphibious',
    uniprot: { accession: 'P02161', entry_name: 'MYG_ZALCA', organism_read_back: 'Zalophus californianus', taxon_id_read_back: 9704, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: {
      value: 20.1, units: 'min', kind: 'species-maximum-from-compilation-table',
      source: { doi: SOURCES.cribriform_2020.doi, pmid: SOURCES.cribriform_2020.pmid, pmcid: SOURCES.cribriform_2020.pmcid, table: 'TABLE A2, Otariidae, Zalophus californianus, "Max. duration (min)"' },
      attributed_by_that_table_to: 'Costa et al. (2007)',
      primary_source_retrieved: false,
    },
  }),
  row({
    latin: 'Halichoerus grypus', common: 'gray seal', clade: 'pinniped', habit: 'amphibious',
    uniprot: { accession: 'P68081', entry_name: 'MYG_HALGR', organism_read_back: 'Halichoerus grypus', taxon_id_read_back: 9711, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'Not in the compilation table we read (TABLE A2 of the cribriform paper covers aquatic arctoid carnivorans and this species is absent from it), and no open-access document we fetched stated a species maximum.',
      what_would_have_to_be_measured: 'A published species maximum from tag records.',
      source: null,
    },
  }),
  row({
    latin: 'Cystophora cristata', common: 'hooded seal', clade: 'pinniped', habit: 'amphibious',
    uniprot: { accession: 'R9RZ94', entry_name: 'R9RZ94_CYSCR', organism_read_back: 'Cystophora cristata', taxon_id_read_back: 39293, protein_name_read_back: 'Myoglobin', gene_read_back: 'Mb', length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'Only a LOWER BOUND was retrievable: a paper we fetched states that "dives exceeding durations of 1 h and depths of 1600 m have been recorded". "Exceeding 1 h" is not a maximum, and promoting it to 60 min would understate a species that is known to beat it.',
      lower_bound: { value: 60, units: 'min', strict: true, source: { doi: SOURCES.hooded_seal_2024.doi, pmid: SOURCES.hooded_seal_2024.pmid, pmcid: SOURCES.hooded_seal_2024.pmcid }, quote: 'dives exceeding durations of 1 h and depths of 1600 m have been recorded' },
      what_would_have_to_be_measured: 'The maximum dive duration reported by the primary tagging studies that bound cites, which were not retrieved.',
      source: null,
    },
  }),

  // ---------- SIRENIANS ----------
  row({
    latin: 'Trichechus manatus latirostris', common: 'Florida manatee', clade: 'sirenian', habit: 'fully-aquatic',
    uniprot: { accession: 'A0A2Y9DG99', entry_name: 'A0A2Y9DG99_TRIMA', organism_read_back: 'Trichechus manatus latirostris', taxon_id_read_back: 127582, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    taxon_note: 'The accession is for the subspecies T. m. latirostris; any dive datum found later for T. manatus would be at species level.',
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'No maximum submergence or dive duration for a sirenian could be retrieved. Open-access searches returned nothing stating one. Sirenians are the most informative missing rows in this file: fully aquatic, shallow, continuously grazing, and therefore the clade where "aquatic" and "long-duration diver" come apart.',
      what_would_have_to_be_measured: 'A published maximum submergence time from tagged manatees, or the sirenian rows of a paywalled dive-capacity compilation.',
      source: null,
    },
  }),
  row({
    latin: 'Dugong dugon', common: 'dugong', clade: 'sirenian', habit: 'fully-aquatic',
    uniprot: { accession: 'R9S070', entry_name: 'R9S070_DUGDU', organism_read_back: 'Dugong dugon', taxon_id_read_back: 29137, protein_name_read_back: 'Myoglobin', gene_read_back: 'Mb', length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'No maximum dive duration retrieved. Open-access searches for this binomial with "dive duration" returned no document stating one.',
      what_would_have_to_be_measured: 'A published maximum dive duration from tagged dugongs.',
      source: null,
    },
  }),

  // ---------- MUSTELIDS ----------
  row({
    latin: 'Enhydra lutris kenyoni', common: 'northern sea otter', clade: 'mustelid', habit: 'fully-aquatic',
    uniprot: { accession: 'A0A2Y9KZQ2', entry_name: 'A0A2Y9KZQ2_ENHLU', organism_read_back: 'Enhydra lutris kenyoni', taxon_id_read_back: 391180, protein_name_read_back: 'Myoglobin', gene_read_back: null, length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    taxon_note: 'The sequence is from the subspecies E. l. kenyoni; the dive duration below is reported for the species E. lutris. A subspecies/species mismatch, recorded rather than smoothed over.',
    max_dive_duration: {
      value: 4.1, units: 'min', kind: 'species-maximum-from-compilation-table',
      source: { doi: SOURCES.cribriform_2020.doi, pmid: SOURCES.cribriform_2020.pmid, pmcid: SOURCES.cribriform_2020.pmcid, table: 'TABLE A2, Mustelidae, Enhydra lutris, "Max. duration (min)"' },
      attributed_by_that_table_to: 'Ralls et al. (1995)',
      primary_source_retrieved: false,
      caveat: 'A fully aquatic mammal with a very short maximum dive. The row that most cheaply breaks a predictor that has learned "aquatic means long".',
    },
  }),
  row({
    latin: 'Lutra lutra', common: 'European otter', clade: 'mustelid', habit: 'semi-aquatic',
    uniprot: { accession: 'P11343', entry_name: 'MYG_LUTLU', organism_read_back: 'Lutra lutra', taxon_id_read_back: 9657, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'Not present in TABLE A2 of the compilation we read, and no open-access document we fetched stated a species maximum.',
      what_would_have_to_be_measured: 'A published maximum dive duration for wild European otters.',
      source: null,
    },
  }),

  // ---------- SEMI-AQUATIC RODENT ----------
  // There was a muskrat row here and a Eurasian beaver row. Both were dropped: their classical
  // Swiss-Prot entries carry B and Z - Asp/Asn and Glu/Gln undistinguished by the peptide sequencing of
  // the era. Those are the exact residues a net charge is made of. See SEQUENCE_AMBIGUITY.
  row({
    latin: 'Castor canadensis', common: 'American beaver', clade: 'rodent', habit: 'semi-aquatic',
    uniprot: { accession: 'A0A250XVB6', entry_name: 'A0A250XVB6_CASCN', organism_read_back: 'Castor canadensis', taxon_id_read_back: 51338, protein_name_read_back: 'Myoglobin', gene_read_back: null, length_read_back: 154, entry_type_read_back: 'UniProtKB unreviewed (TrEMBL)' },
    accession_note: 'Substituted for the congener Castor fiber, whose reviewed entry P14396 was fetched and dropped for three B residues. This is a DIFFERENT SPECIES, not a better entry for the same one; it is a semi-aquatic beaver either way, but any claim about Castor fiber specifically does not transfer.',
    max_dive_duration: {
      value: null, units: 'min',
      null_reason: 'No species maximum retrieved from any open-access document we fetched.',
      what_would_have_to_be_measured: 'A published maximum dive duration for wild beavers.',
      source: null,
    },
  }),

  // ---------- STRICTLY TERRESTRIAL ANCHORS ----------
  // The low-charge, no-dive end of the axis. Their duration is null, not 0. See NO_DIVE_NULL.
  row({
    latin: 'Homo sapiens', common: 'human', clade: 'primate', habit: 'strictly-terrestrial', anchor: true,
    uniprot: { accession: 'P02144', entry_name: 'MYG_HUMAN', organism_read_back: 'Homo sapiens', taxon_id_read_back: 9606, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: { ...NO_DIVE_NULL, null_reason: NO_DIVE_NULL.null_reason + ' Trained human static apnoea records exist, but they measure a different construct (a trained, motionless, surface breath-hold, often after hyperventilation or oxygen pre-breathing) and none was retrieved here; putting one in this column would compare a sporting record with a foraging dive.' },
  }),
  row({
    latin: 'Mus musculus', common: 'house mouse', clade: 'rodent', habit: 'strictly-terrestrial', anchor: true,
    uniprot: { accession: 'P04247', entry_name: 'MYG_MOUSE', organism_read_back: 'Mus musculus', taxon_id_read_back: 10090, protein_name_read_back: 'Myoglobin', gene_read_back: 'Mb', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: { ...NO_DIVE_NULL },
  }),
  row({
    latin: 'Equus caballus', common: 'horse', clade: 'perissodactyl', habit: 'strictly-terrestrial', anchor: true,
    uniprot: { accession: 'P68082', entry_name: 'MYG_HORSE', organism_read_back: 'Equus caballus', taxon_id_read_back: 9796, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: { ...NO_DIVE_NULL },
  }),
  row({
    latin: 'Bos taurus', common: 'cattle', clade: 'artiodactyl', habit: 'strictly-terrestrial', anchor: true,
    uniprot: { accession: 'P02192', entry_name: 'MYG_BOVIN', organism_read_back: 'Bos taurus', taxon_id_read_back: 9913, protein_name_read_back: 'Myoglobin', gene_read_back: 'MB', length_read_back: 154, entry_type_read_back: 'UniProtKB reviewed (Swiss-Prot)' },
    max_dive_duration: { ...NO_DIVE_NULL },
  }),
]);

export const TERRESTRIAL_ANCHORS = deepFreeze(['Homo sapiens', 'Mus musculus', 'Equus caballus', 'Bos taurus']);

// ====================================================================================================
// ROWS DROPPED - WHAT WAS LOOKED AT AND NOT KEPT
// ====================================================================================================
// A silent drop is a lie about the search. Each of these was fetched and read before being dropped.
export const ROWS_DROPPED = deepFreeze([
  {
    accession: 'P32428',
    organism_read_back: 'Ondatra zibethicus',
    length_read_back: 154,
    protein_name_read_back: 'Myoglobin',
    reason: 'Full length, right organism, reviewed - and UNUSABLE for a charge feature. The sequence contains two B and three Z residues: B means Asp-or-Asn and Z means Glu-or-Gln, left undistinguished by the peptide sequencing this classical entry came from. Those are precisely the residues that carry negative charge. Five ambiguous positions put a +/-5 band on any net charge, which is larger than the whole spread of the crude feature across this file. No alternative muskrat myoglobin entry was found, so the species was dropped rather than guessed. See SEQUENCE_AMBIGUITY.',
    verified_how: 'Fetched https://rest.uniprot.org/uniprotkb/P32428.json on ' + '2026-11-07' + ', read the sequence, and found the non-standard letters by set difference against the twenty standard residues. The file’s own tests are what flagged it.',
  },
  {
    accession: 'P14396',
    organism_read_back: 'Castor fiber',
    length_read_back: 154,
    protein_name_read_back: 'Myoglobin',
    reason: 'Same defect as P32428: three B residues (Asp-or-Asn undetermined). Dropped, and the congener Castor canadensis (A0A250XVB6, no ambiguous residues) used in its place - a species substitution, recorded on that row as such. See SEQUENCE_AMBIGUITY.',
    verified_how: 'Fetched https://rest.uniprot.org/uniprotkb/P14396.json on ' + '2026-11-07' + ' and found three B residues by set difference against the standard twenty.',
  },
  {
    accession: 'P83682',
    organism_read_back: 'Delphinapterus leucas',
    length_read_back: 154,
    protein_name_read_back: 'Myoglobin',
    reason: 'Reviewed beluga myoglobin, full length, and carrying ELEVEN X residues - positions where the identity is simply unknown. Eleven unknown residues can hide up to eleven charges. Replaced by the unreviewed genome-derived entry A0A140GN53, same organism, no X. A reviewed entry is not automatically the better entry: for a feature read off individual residues, determined beats curated.',
    verified_how: 'Fetched https://rest.uniprot.org/uniprotkb/P83682.json on ' + '2026-11-07' + ', then fetched A0A140GN53 and confirmed it has no non-standard letters.',
  },
  {
    accession: 'A0A2Y9KLX4',
    organism_read_back: 'Enhydra lutris kenyoni',
    length_read_back: 146,
    protein_name_read_back: 'Myoglobin',
    reason: 'Resolved to the right organism and the right protein, but is 146 aa - not full-length mammalian myoglobin (154 aa). A truncated record would change any surface-charge computation. A0A2Y9KZQ2, 154 aa, same organism, was kept instead.',
    verified_how: 'Fetched https://rest.uniprot.org/uniprotkb/A0A2Y9KLX4.json on ' + '2026-11-07' + ' and read the organism and sequence length out of the response.',
  },
  {
    accession: 'R9RZA9',
    organism_read_back: 'Trichechus manatus',
    length_read_back: 30,
    protein_name_read_back: 'Myoglobin',
    reason: 'A 30-residue fragment. Seen in a UniProt search listing for this organism alongside two other fragments (R9S085, 38 aa; R9S012, 31 aa). Useless for a sequence-derived feature. The 154 aa subspecies entry A0A2Y9DG99 was used instead.',
    verified_how: 'Read from a live UniProt search over organism_name:Trichechus+manatus with the length field requested, on ' + '2026-11-07' + '.',
  },
  {
    accession: null,
    organism_read_back: null,
    sought: 'Enhydra lutris (species-level myoglobin, reviewed)',
    reason: 'A search for gene:MB AND organism_name:Enhydra returned ZERO hits, because the sea otter entries carry no gene name. Only a protein-name search found them, all at subspecies level. Recorded because "no orthologue found" would have been the wrong conclusion from the first search, and this file is in a repo that refuses that inference by name.',
    verified_how: 'Two live UniProt searches on ' + '2026-11-07' + ': gene:MB AND organism_name:Enhydra (0 hits), then myoglobin AND organism_name:Enhydra (3 hits).',
  },
]);

// ====================================================================================================
// PROVENANCE
// ====================================================================================================
export const PROVENANCE = deepFreeze({
  subset: 'mammals only',
  why: 'This repo’s comparative scope is mammals and fishes. Where a source dataset spanned more groups than that, only the mammalian rows were taken. No row here is from outside that scope.',
  what_mirceta_reported: {
    retrieved: true,
    quote: EXPECTED_DIRECTION.exact_sentence_retrieved,
    from: 'the abstract of PMID 23766330, returned verbatim by PubMed MCP get_article_metadata',
    and_what_we_could_not_quote: 'The figure that carries the relationship, its legend, its axes, its statistics, and the per-species charge values. The paper has no PMCID and the publisher page returned HTTP 403, so none of the figures or the supplementary tables were retrieved. We therefore state the DIRECTION on retrieved text and make NO quantitative claim about the paper’s own figure.',
  },
  uniprot: {
    fetched_on: FETCHED_ON,
    how: SOURCES.uniprot.verified_how,
    n_accessions_fetched: 34,
    n_kept: 26,
    n_dropped_after_reading: 5,
    n_alternates_fetched_and_not_needed: 3,
    note: 'Of 34 individual accession fetches, 26 are rows, 5 were read and dropped (ROWS_DROPPED), and the rest were candidate alternates fetched while replacing a dropped row and not needed once a clean one was found.',
    sequences_are_a_snapshot: 'Sequences are embedded so the predictor runs offline. They are a snapshot taken on the fetch date; UniProt entries are revised, and a later fetch may differ. A predictor that cares should re-fetch and diff, not assume.',
  },
  dive_durations: {
    how: 'Each non-null duration carries its own source identifier, because these numbers are overwhelmingly from the diving literature rather than from Mirceta. Six come from one compilation table we read; three from primary or review documents we read; the rest are null.',
    the_uncomfortable_part: 'Six of eleven non-null durations come from a single compilation table (DOI 10.1002/ece3.6343). They are not independent of each other: one compiler’s inclusion rules and one set of judgements sit behind all six. If that table is systematically off, six rows move together and nothing in this file would notice.',
  },
});

// ====================================================================================================
// SEQUENCE-LEVEL FACTS WE CAN STATE WITHOUT A MODEL
// ====================================================================================================
// Deliberately NOT a charge computation. Charge needs a pH, a pKa set and a surface definition, all of
// which are modelling choices that belong to the predictor and must be declared there, where they can
// be varied. What belongs here is only what is in the sequence itself.
export const composition = (seq) => {
  const n = (set) => [...seq].filter((c) => set.includes(c)).length;
  return Object.freeze({
    length: seq.length,
    Lys: n('K'), Arg: n('R'), His: n('H'), Asp: n('D'), Glu: n('E'),
    basic_KR: n('K') + n('R'),
    acidic_DE: n('D') + n('E'),
    // KR minus DE. A crude, pH-free, surface-free count. NOT Zmb, and must not be reported as Zmb.
    KR_minus_DE: n('K') + n('R') - (n('D') + n('E')),
  });
};
// ====================================================================================================
// THE AMBIGUITY TRAP - FOUND BY THIS FILE'S OWN TESTS, NOT BY FORESIGHT
// ====================================================================================================
// The first draft of this file had three rows whose sequences were not strings of the twenty standard
// residues. The assertion that caught them exists because "every sequence is amino-acid letters" looked
// like a formality. It was not.
export const SEQUENCE_AMBIGUITY = deepFreeze({
  the_problem: 'Myoglobin is the classic protein of mid-century peptide sequencing, so many of the reviewed entries are old. Edman chemistry of that era could not always distinguish Asp from Asn, or Glu from Gln, and UniProt records the uncertainty honestly as B (Asp-or-Asn) and Z (Glu-or-Gln). Other entries carry X where the residue is unknown outright.',
  why_it_is_fatal_HERE_specifically: 'B and Z are exactly the two ambiguities that matter for a NET CHARGE. Asp and Glu carry a negative charge; Asn and Gln do not. Every B or Z is a +/-1 of uncertainty on the feature, and the whole spread of the crude feature across this file is about four units. A single classical entry with five such positions has an error bar wider than the signal.',
  so_the_rule_here: 'No row may contain a non-standard residue letter. A species with no unambiguous entry is dropped, not patched, not majority-voted, not filled in from a relative.',
  what_was_dropped_for_this: ['P32428 Ondatra zibethicus: 2 B, 3 Z', 'P14396 Castor fiber: 3 B', 'P83682 Delphinapterus leucas: 11 X'],
  the_general_lesson: 'A reviewed, curated entry is not automatically the better entry. For a feature computed from individual residues, an unreviewed genome-derived sequence with every position determined beats a hand-curated one with eleven unknowns. The usual quality ranking is about annotation, and annotation is not what this feature reads.',
  how_this_was_caught: 'A test assertion that every sequence matches ^[ACDEFGHIKLMNPQRSTVWY]+$. It was written as a formality and failed on first run against three of twenty-six rows.',
});

// ====================================================================================================
// IDENTICAL SEQUENCES - THREE "SPECIES" THAT ARE ONE DATA POINT
// ====================================================================================================
// Computed from the rows, not asserted, so it cannot drift away from them.
export const identicalSequenceGroups = () => {
  const by = new Map();
  for (const r of ROWS) { if (!by.has(r.sequence)) by.set(r.sequence, []); by.get(r.sequence).push(r.latin); }
  return Object.freeze([...by.values()].filter((g) => g.length > 1).map((g) => Object.freeze([...g])));
};
export const distinctSequences = () => [...new Set(ROWS.map((r) => r.sequence))].length;
export const IDENTICAL_SEQUENCES_MEAN = deepFreeze({
  what: 'Some rows in this file carry byte-identical myoglobin sequences across different species. identicalSequenceGroups() lists them.',
  why_it_matters: 'For a feature computed from the sequence alone, rows in one such group are ONE data point with several labels. Counted as several, they inflate any group contrast and pretend to an independence they do not have. A regression must take at most one member of each group, or weight them to one.',
  and_the_harder_point: 'Identical sequence with DIFFERENT measured dive capacity would be a direct refutation of a sequence-only predictor: same input, different output, no feature can separate them. This file cannot run that test yet, because within its identical group only one member has a non-null duration. Filling the other durations is therefore the single highest-value thing to add to this file - not more species.',
  not_an_error: 'These rows are not duplicates to be deleted. They are a real statement about conservation within a clade, and deleting them would hide it.',
});

export const NOT_ZMB = deepFreeze({
  warning: 'composition().KR_minus_DE IS NOT Zmb. It counts every ionisable residue whether buried or exposed, fixes no pH, uses no pKa set, and ignores the haem. It is here so that a predictor has a baseline to beat and a reader can see that the baseline is crude. Reporting it as a net surface charge, or comparing it to a number from Mirceta, would be a fabrication.',
  what_a_real_Zmb_would_need: [
    'A surface definition: solvent accessibility from a structure, or a stated proxy, per residue.',
    'A pH, stated. Mirceta’s pH is not known to this file.',
    'A pKa set, stated, and the sensitivity of the result to it.',
    'A decision about the haem propionate groups, stated.',
    'A statement that the definition is OURS, since theirs was not retrieved.',
  ],
});

// ====================================================================================================
// SELECTORS
// ====================================================================================================
export const byLatin = (latin) => ROWS.find((r) => r.latin === latin);
export const withDuration = () => ROWS.filter((r) => r.max_dive_duration.value !== null);
export const nullDuration = () => ROWS.filter((r) => r.max_dive_duration.value === null);
// The subset a regression may legitimately use: species-level maxima only. One-study observed maxima
// are lower bounds and are excluded by their DURATION_KIND, not by hand.
export const regressionSet = () => withDuration().filter((r) => DURATION_KINDS[r.max_dive_duration.kind].use_for_regression === true);
export const divers = () => ROWS.filter((r) => r.habit !== 'strictly-terrestrial');
export const anchors = () => ROWS.filter((r) => r.habit === 'strictly-terrestrial');

// ====================================================================================================
// THE BASELINE PROBE - RUN ON THIS FILE'S OWN CONTENTS, WITH THE CRUDE FEATURE, AND REPORTED
// ====================================================================================================
// This is NOT the predictor and NOT Zmb. It is the crudest feature anyone would try - KR minus DE, no
// pH, no surface - run against the data above so that the file states up front what the easy answer
// does. It is reported per axis, in words from a closed vocabulary, with no fused score, because the
// three axes disagree and a single number would hide that.
//
// It is here because the result is uncomfortable and burying it in a predictor's output would be worse.
export const PROBE_VERDICTS = deepFreeze(['separates', 'does-not-separate', 'as-expected', 'inverted', 'absent', 'with-terrestrial-anchors', 'with-divers']);

const spearman = (xs, ys) => {
  const rank = (a) => { const s = [...a].sort((p, q) => p - q); return a.map((v) => (s.indexOf(v) + s.lastIndexOf(v)) / 2 + 1); };
  const rx = rank(xs), ry = rank(ys);
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const mx = mean(rx), my = mean(ry);
  const num = rx.reduce((acc, v, i) => acc + (v - mx) * (ry[i] - my), 0);
  const den = Math.sqrt(rx.reduce((acc, v) => acc + (v - mx) ** 2, 0) * ry.reduce((acc, v) => acc + (v - my) ** 2, 0));
  return den === 0 ? null : num / den;
};

export const baselineProbe = () => {
  const c = (r) => composition(r.sequence).KR_minus_DE;
  const anchorVals = anchors().map(c);
  const diverVals = divers().map(c);
  const rs = regressionSet();
  const rho = spearman(rs.map(c), rs.map((r) => r.max_dive_duration.value));
  const sirenians = ROWS.filter((r) => r.clade === 'sirenian');
  return Object.freeze({
    feature: 'composition().KR_minus_DE',
    feature_is_not_zmb: NOT_ZMB.warning,
    axes: Object.freeze({
      anchor_separation: Object.freeze({
        verdict: Math.max(...anchorVals) < Math.max(...diverVals) && anchorVals.every((v) => v <= 0) ? 'separates' : 'does-not-separate',
        detail: `every strictly terrestrial anchor is at or below ${Math.max(...anchorVals)}; the aquatic and semi-aquatic rows reach ${Math.max(...diverVals)}`,
        anchor_values: Object.freeze(anchorVals),
        means: 'The one part of EXPECTED_DIRECTION the retrieved abstract actually licenses - divers above non-divers - holds for even this crude feature.',
      }),
      within_diver_ordering: Object.freeze({
        verdict: rho === null ? 'absent' : (rho < -0.3 ? 'inverted' : (rho > 0.3 ? 'as-expected' : 'absent')),
        spearman_rho: rho,
        n: rs.length,
        not_a_p_value: 'No p-value is reported. n is 9, the rows are not phylogenetically independent, six of them share one compiler, and a p-value here would be read as evidence it cannot carry.',
        means: 'Among species-level maxima, the crude feature orders dive capacity BACKWARDS. The pinnipeds and the deep-diving cetaceans sit at the same crude charge as each other while their maxima differ fourteen-fold, and the two highest crude values in the whole file belong to a walrus and a sea lion.',
      }),
      sirenian_placement: Object.freeze({
        verdict: Math.max(...sirenians.map(c)) <= Math.max(...anchorVals) ? 'with-terrestrial-anchors' : 'with-divers',
        values: Object.freeze(sirenians.map((r) => Object.freeze({ latin: r.latin, value: c(r) }))),
        means: 'Both sirenians - fully aquatic mammals - fall at or below the terrestrial anchors on this feature. Their dive durations are null here, so this file cannot say whether that is the feature failing or the sirenians genuinely being shallow, continuous grazers. It is the single most informative gap in the file.',
      }),
    }),
    what_this_does_and_does_not_show: [
      'SHOWS: the group contrast survives an almost insultingly crude feature, so a predictor that only separates divers from non-divers has demonstrated very little.',
      'SHOWS: on this subset, with this crude feature, the within-diver ordering is inverted, which is the second falsifier in WHAT_WOULD_FALSIFY firing before any predictor was written.',
      'DOES NOT SHOW: anything about Mirceta et al.’s result. Their Zmb is a surface charge at a stated pH, which this is not, and their analysis was phylogenetic across 130 species, which this is not.',
      'DOES NOT SHOW: that a proper Zmb will also invert. That is the experiment; this is the baseline it has to beat, and the bar it has to clear is now on the record before the attempt.',
    ],
    fused_score: null,
    overall_verdict: null,
  });
};

// ====================================================================================================
// WHAT WOULD FALSIFY THE PREDICTION - WRITTEN BEFORE THE PREDICTOR EXISTS
// ====================================================================================================
export const WHAT_WOULD_FALSIFY = deepFreeze({
  the_prediction: 'A charge-like feature computed from these sequences orders these mammals by dive capacity, in the positive direction, and separates divers from the four terrestrial anchors.',
  falsifiers: [
    'The four terrestrial anchors do NOT sit at the low end. That is the cheapest and most decisive failure: the group contrast is the only part of the claim the retrieved text actually supports.',
    'The anchors separate but the ordering WITHIN divers is no better than chance. The claim then reduces to a two-group difference and must be reported as such, not as a predictor of minutes.',
    'The sea otter (fully aquatic, 4.1 min) is placed with the long-duration divers. That would show the feature had learned "aquatic", not "dive capacity".',
    'The ordering is destroyed by controlling for body mass. Mass is the known strong correlate of dive duration and is confounded with clade here.',
    'The ordering holds only when the observed-maximum-in-one-study rows are included. Those are lower bounds; a result that needs them is a result about sampling effort.',
  ],
  what_this_file_cannot_falsify: 'Mirceta et al.’s own result. Their Zmb definition and their numbers were not retrieved, their analysis was phylogenetic and ours would not be, and 26 species is not their 130. A negative result here is a negative result about OUR feature on OUR subset.',
});

// ====================================================================================================
// UNCERTAINTIES
// ====================================================================================================
export const UNCERTAINTIES = deepFreeze([
  'The paper’s own Zmb definition and per-species values were not retrieved (no PMCID; publisher returned HTTP 403). Everything downstream is our reconstruction of a method we have not read.',
  'The retrieved abstract links charge to myoglobin CONCENTRATION, not to dive duration in minutes. The quantitative step a predictor will take is one the retrieved text does not license.',
  '11 of 26 rows have a duration; 15 are null. The sirenian and gray-seal nulls are the most costly, because sirenians are the clade that separates "aquatic" from "deep diver".',
  'Three rows - harbor seal, gray seal, hooded seal - share ONE byte-identical myoglobin sequence, so they are one data point with three labels. Only one of the three has a non-null duration, which is why the file cannot yet run the sharpest available test: identical sequence against different measured dive capacity. See IDENTICAL_SEQUENCES_MEAN.',
  'Three species were dropped for ambiguous or undetermined residues (B, Z, X) in their only available entry, and one of those three was replaced by a congener rather than the same species. See SEQUENCE_AMBIGUITY.',
  'Six of 11 non-null durations come from one compilation table, so they are correlated through one compiler.',
  'Three durations are lower bounds from single studies, flagged by DURATION_KIND and excluded from regressionSet().',
  'Two rows (sea otter, Florida manatee) have subspecies-level accessions against species-level or absent dive data.',
  'Maximum dive duration is an extreme-value statistic: it grows with tagging effort, and effort is not independent of how interesting a species is.',
  'Dive duration scales with body mass, which this file does not carry. A predictor that ignores mass will take credit for it.',
  'All 26 sequences are 154 aa, so alignment is trivial here - which also means this file cannot exercise any gap handling a predictor may need elsewhere.',
]);

// ====================================================================================================
export const summary = () => {
  const d = withDuration(), r = regressionSet();
  const byClade = {};
  for (const x of ROWS) byClade[x.clade] = (byClade[x.clade] || 0) + 1;
  const byKind = {};
  for (const x of d) byKind[x.max_dive_duration.kind] = (byKind[x.max_dive_duration.kind] || 0) + 1;
  return Object.freeze({
    n_rows: ROWS.length,
    n_with_duration: d.length,
    n_null_duration: nullDuration().length,
    n_in_regression_set: r.length,
    n_dropped: ROWS_DROPPED.length,
    n_distinct_sequences: distinctSequences(),
    identical_sequence_groups: identicalSequenceGroups(),
    clades: Object.freeze(byClade),
    duration_kinds: Object.freeze(byKind),
    duration_range_min: Object.freeze([Math.min(...d.map((x) => x.max_dive_duration.value)), Math.max(...d.map((x) => x.max_dive_duration.value))]),
    anchors: TERRESTRIAL_ANCHORS,
    fetched_on: FETCHED_ON,
    headline: 'Twenty-six mammalian myoglobins, every accession resolved live, eleven with a sourced maximum dive duration and fifteen honestly null. No charge is computed here and no fused score is exported.',
    not_a_score: null,
  });
};

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('myoglobin.mjs')) {
  const s = summary();
  console.log('\nmyoglobin.mjs - retro-validation ground truth\n');
  console.log(s);
  console.log('\nrows with a duration:');
  for (const r of withDuration()) console.log(`  ${String(r.max_dive_duration.value).padStart(6)} min  ${r.max_dive_duration.kind.padEnd(40)} ${r.latin} (${r.common})`);
  console.log('\nrows without one:');
  for (const r of nullDuration()) console.log(`     null      ${r.habit.padEnd(21)} ${r.latin} (${r.common})`);
  const p = baselineProbe();
  console.log('\nbaseline probe (crude KR-DE, NOT Zmb):');
  for (const [axis, v] of Object.entries(p.axes)) console.log(`  ${axis.padEnd(24)} ${v.verdict}`);
  console.log(`  within-diver spearman rho ${p.axes.within_diver_ordering.spearman_rho.toFixed(3)} (n=${p.axes.within_diver_ordering.n})`);
  console.log(`\n${WHAT_WOULD_FALSIFY.falsifiers[0]}\n`);
}
