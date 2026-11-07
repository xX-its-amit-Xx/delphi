#!/usr/bin/env node
// opsin.mjs - CAN YOU PREDICT A ROD OPSIN'S ABSORPTION MAXIMUM FROM A HANDFUL OF AMINO-ACID SITES?
//
// ============================== WHY THIS MODULE EXISTS ==============================
// DELPHI needs retro-validatable predictions: claims whose answer is already in the literature, so a
// prediction made from structure can be scored against a measurement nobody in this pipeline chose.
// Rod opsin (RH1) spectral tuning is the best-looking candidate in comparative vision. The story is
// clean enough to put on a slide: rhodopsin absorbs maximally (lambda-max) near 500 nm; a short list of
// sites in the retinal-binding pocket - 83, 122, 207, 261, 292 in bovine numbering - carries almost all
// of the variation; each substitution at one of those sites shifts lambda-max by a characteristic number
// of nanometres; add the shifts up and you have the pigment.
//
// This module holds the real numbers for that story AND the measurements that break it. Both are needed,
// because the story is how a design pipeline would use the rule, and the breakage is the reason the
// pipeline's output must be a band with a stated failure mode rather than a number.
//
// The single most damaging fact in this file, and the reason it exists:
//
//   NATHANS 1990 BUILT 14 SITE-DIRECTED MUTANTS OF BOVINE RHODOPSIN AT SIX POSITIONS INCLUDING 83 AND
//   122 - two of the canonical tuning sites - AND MEASURED THEM ALL. Every mutant came out "surprisingly
//   close" to native bovine rhodopsin at lambda-max = 498 nm, and the paper's stated conclusion is that
//   this RULES OUT a significant role for these residues in spectral tuning. (doi:10.1021/bi00456a013)
//
// The same substitutions, placed in fish RH1 backgrounds, move lambda-max by 8-14 nm and are the accepted
// explanation of deep-water adaptation. Both results are real, both are in SITE_SHIFTS, and the
// contradiction is not a controversy anyone is litigating - it is epistasis. A site-shift value is a
// property of a substitution IN A BACKGROUND, and the background is a whole protein. Carried across
// species the value is not a constant; it is a correlation that happens to hold in the species the rule
// was fitted on.
//
// The second most damaging fact is in the same vein and comes from the one paper that measured the same
// substitution in several backgrounds at once: in cichlid RH1, D83N is worth about 8 nm in one species
// and 2-4 nm in others - "close to the measurement error". (doi:10.1073/pnas.0405302102)
//
// ============================== WHAT IT WILL NOT DO ==============================
// It will not return a point prediction for lambda-max. naiveAdditivePrediction() returns a BAND whose
// width is built from the SPREAD OF THE PUBLISHED SHIFT VALUES FOR THE SAME SUBSTITUTION, plus a count of
// the substitutions present for which no nm value has ever been published that we could retrieve. Its
// `point` field is null and stays null. A single nm figure out of this module would be read downstream as
// a prediction with an error bar of zero, and the error bar is the finding.
//
// It will not carry a number we did not retrieve. Every nm value below was read out of the paper's own
// text or abstract in this session, and `verified_how` on each source says which. Where a value is
// commonly quoted but we could not get it from the source (E122Q alone is the conspicuous case), the
// field is `{ value: null, null_reason, what_would_have_to_be_measured }`. Round numbers that "everyone
// knows" are exactly the ones that get fabricated, so they are the ones this file refuses hardest.
//
// It will not pair a sequence from one study with a measurement from another and call that a row. Three
// such pairings were available and are quarantined in CROSS_STUDY_PAIRINGS, where nothing scores them.
//
// ============================== DATA PROVENANCE ==============================
// Yokoyama et al. 2008 engineered and measured rhodopsins across a wider taxonomic span than this repo
// covers. The subset recorded here is MAMMALS AND FISHES ONLY, because this repo's comparative scope is
// mammals and fishes; rows outside that scope were not taken. The same applies to Yokoyama & Radlwimmer
// 2001's M/LWS panel. No row here was altered, only omitted.
//
// ============================== HOLDOUT ==============================
// One clade is a frozen evaluation holdout in this repo (holdout/split.json). This module names no member
// of it and reads no datum from it. Run `node holdout/check-leaks.mjs benchmarks/retro-validation`.
//
//   node benchmarks/retro-validation/data/opsin.mjs       # print retroValidate()
//   node benchmarks/retro-validation/data/test-opsin.mjs  # the tests (network: verifies accessions live)

// ====================================================================================================
// FREEZING
// ====================================================================================================
const deepFreeze = (o) => {
  if (o === null || typeof o !== 'object' || Object.isFrozen(o)) return o;
  Object.freeze(o);
  for (const k of Object.getOwnPropertyNames(o)) deepFreeze(o[k]);
  return o;
};

export const UNITS = deepFreeze({ lambda_max: 'nm', shift: 'nm' });

export const TAXONOMIC_SCOPE = deepFreeze({
  scope: 'mammals and fishes only',
  why: 'This repo\'s comparative scope is mammals and fishes. Source datasets that span more groups were subset, not rewritten.',
  rows_affected: ['MEASURED (from Yokoyama et al. 2008)', 'SITE_SHIFTS (M/LWS panel, from Yokoyama & Radlwimmer 2001)'],
  what_this_costs_the_benchmark:
    'The site rules were fitted across a wider span than we score on, so our scoring set is a subset of the fitting set. ' +
    'That makes every agreement here weaker evidence than it looks: see THE_HARD_PART.overlapping_fit.',
});

// ====================================================================================================
// SOURCES. Every one of these was retrieved in-session; verified_how says how.
// ====================================================================================================
export const CITATIONS = deepFreeze({
  nathans_1990: {
    cite: 'Nathans, J. (1990) Determinants of visual pigment absorbance: role of charged amino acids in the putative transmembrane segments. Biochemistry 29:937-942.',
    doi: '10.1021/bi00456a013',
    pmid: '2111169',
    what_it_measured:
      '14 site-directed mutants of bovine rhodopsin at positions 83, 86, 122, 134, 135 and 211; digitonin solubilisation, ' +
      'reconstitution with 11-cis-retinal, photobleaching difference spectrum in the presence of hydroxylamine.',
    the_result_in_its_own_terms:
      'All mutant spectra were "surprisingly close to that of native bovine rhodopsin (lambda max = 498 nm), ruling out a ' +
      'significant role for these residues in spectral tuning."',
    verified_how:
      'PMID 2111169 resolved via PubMed MCP get_article_metadata; DOI 10.1021/bi00456a013 returned by the same record; ' +
      'title, journal, volume/pages and the full abstract read back, and the 498 nm figure and the "ruling out" clause are ' +
      'quoted from that abstract text.',
  },
  yokoyama_radlwimmer_2001: {
    cite: 'Yokoyama, S. & Radlwimmer, F.B. (2001) The molecular genetics and evolution of red and green color vision in vertebrates. Genetics 158:1697-1710.',
    doi: '10.1093/genetics/158.4.1697',
    pmid: '11545071',
    pmc: 'PMC1461741',
    what_it_measured:
      'Ancestral M/LWS pigments reconstructed by mutagenesis of contemporary pigments and assayed in vitro; multiple ' +
      'regression of lambda-max on substitution state across ancestral and contemporary pigments.',
    the_result_in_its_own_terms:
      'The "five-sites" rule: S180A, H197Y, Y277F, T285A, A308S and the double S180A/H197Y shift lambda-max by ' +
      '-7, -28, -8, -15, -27 and +11 nm respectively.',
    applies_to: 'M/LWS (red/green cone) pigments, NOT RH1. Recorded here because it is the rule the RH1 story is modelled on.',
    verified_how:
      'PMID 11545071 resolved via PubMed MCP get_article_metadata; the six nm values and their signs are quoted verbatim ' +
      'from the returned abstract text. DOI 10.1093/genetics/158.4.1697 returned by the same record.',
  },
  yokoyama_2000_jhered: {
    cite: 'Yokoyama, S. (2000) Color vision of the coelacanth (Latimeria chalumnae) and adaptive evolution of rhodopsin (RH1) and rhodopsin-like (RH2) pigments. J Hered 91:215-220.',
    doi: '10.1093/jhered/91.3.215',
    pmid: '10833047',
    the_result_in_its_own_terms:
      'Coelacanth RH1 lambda-max 478 nm and RH2 485 nm, "fully explained by independent double amino acid replacements ' +
      'E122Q/A292S and E122Q/M207L, respectively". And: "currently available mutagenesis experiments identify only 10 amino ' +
      'acid changes that shift the lambda max values of visual pigments more than 5 nm. Among these, D83N, E122Q, M207L, ' +
      'and A292S are associated strongly with the adaptive blue shifts in the lambda max values of RH1 and RH2 pigments."',
    verified_how:
      'PMID 10833047 resolved via PubMed MCP get_article_metadata; the 478/485 nm values, the two double-replacement ' +
      'attributions and the four-site sentence are quoted from the returned abstract. DOI from the same record.',
  },
  yokoyama_1999_pnas: {
    cite: 'Yokoyama, S., Zhang, H., Radlwimmer, F.B. & Blow, N.S. (1999) Adaptive evolution of color vision of the Comoran coelacanth (Latimeria chalumnae). PNAS 96:6279-6284.',
    doi: '10.1073/pnas.96.11.6279',
    pmid: '10339578',
    pmc: 'PMC26872',
    the_result_in_its_own_terms:
      'Coelacanth RH1 and RH2 lambda-max at 478 nm and 485 nm; "shifted about 20 nm toward blue compared with those of the ' +
      'corresponding orthologous pigments"; "each of these coadapted changes is fully explained by two amino acid replacements."',
    verified_how:
      'PMID 10339578 resolved via PubMed MCP get_article_metadata; values quoted from the returned abstract. The PMC full ' +
      'text was ALSO attempted (PMC26872) and could not be retrieved - the PMC page returned a browser-verification ' +
      'interstitial and the Europe PMC fullTextXML endpoint returned HTTP 500 - so NO per-mutant nm value is taken from ' +
      'this paper, only the figures that appear in the abstract.',
  },
  yokoyama_2008_pnas: {
    cite: 'Yokoyama, S., Tada, T., Zhang, H. & Britt, L. (2008) Elucidation of phenotypic adaptations: molecular analyses of dim-light vision proteins in vertebrates. PNAS 105:13480-13485.',
    doi: '10.1073/pnas.0802426105',
    pmid: '18768804',
    pmc: 'PMC2533215',
    what_it_measured:
      '11 engineered ancestral rhodopsins plus contemporary rhodopsins, expressed and reconstituted with 11-cis-retinal; ' +
      'dark spectra where obtainable, dark-light difference spectra otherwise.',
    the_result_in_its_own_terms:
      'Early ancestral rhodopsins absorbed maximally at 500 nm; contemporary rhodopsins range 480-525 nm and evolved on at ' +
      'least 18 separate occasions, "largely by amino acid replacements at 12 sites", with the remaining ~191 sites ' +
      '(~94%) under neutral evolution. A292S "usually decreases the lambda-max of rhodopsin by ~10 nm"; F261Y in pigment b ' +
      'increases it by 10 nm; the reverse S292A in the CONGER-A background increased lambda-max by 12 nm; and the three ' +
      'changes D83N/A292S, P194R/N195A/A292S and E122Q "decrease the lambda-max by 14-20 nm" as a group.',
    verified_how:
      'PMID 18768804 resolved via PubMed MCP get_article_metadata (DOI and PMC id from that record). The PubMed MCP ' +
      'full-text call returned an EMPTY full_text field, so the per-species lambda-max table and the per-substitution nm ' +
      'figures were instead read by live fetch of https://pmc.ncbi.nlm.nih.gov/articles/PMC2533215/ and are quoted from ' +
      'that page. The 14-20 nm figure is a RANGE OVER THREE CHANGES as the paper states it, not a value for any one of them.',
  },
  sugawara_2005_pnas: {
    cite: 'Sugawara, T., Terai, Y., Imai, H., Turner, G.F., Koblmuller, S., Sturmbauer, C., Shichida, Y. & Okada, N. (2005) Parallelism of amino acid changes at the RH1 affecting spectral sensitivity among deep-water cichlids from Lakes Tanganyika and Malawi. PNAS 102:5448-5453.',
    doi: '10.1073/pnas.0405302102',
    pmid: '15809435',
    pmc: 'PMC556224',
    what_it_measured:
      'RH1 sequences from 233 individual cichlids; 28 pigments cloned into pFLAG-CMV-5a, reconstituted in vitro with ' +
      '11-cis-retinal, lambda-max from dark-light difference spectra. Stated mean measurement error ~+/-1.4 nm.',
    the_result_in_its_own_terms:
      'lambda-max across 28 species spans 484 +/- 1 nm to 505 +/- 1 nm. A292S in Oreochromis niloticus shifted lambda-max ' +
      'from 505 +/- 1 to 491 +/- 2 nm (14 nm blue shift). The reverse N83D in Baileychromis centropomoides shifted 492 -> ' +
      '500 nm (8 nm red shift), so D83N is worth ~8 nm in THAT background - but in other species D83N shifted lambda-max ' +
      'by only about 2 to 4 nm, "close to the measurement error". A292S arose several times independently.',
    verified_how:
      'PMID 15809435 resolved via PubMed MCP get_article_metadata (DOI, PMC id, author list, abstract). The nm values and ' +
      'per-species lambda-max figures were read by live fetch of https://pmc.ncbi.nlm.nih.gov/articles/PMC556224/. Table 1 ' +
      'of that paper is a bitmap and its cells were NOT readable, so only the species values that appear in the running ' +
      'text were taken; no value was reconstructed from the figure.',
  },
  hunt_2001_jeb: {
    cite: 'Hunt, D.M., Dulai, K.S., Partridge, J.C., Cottrill, P. & Bowmaker, J.K. (2001) The molecular basis for spectral tuning of rod visual pigments in deep-sea fish. J Exp Biol 204:3333-3344.',
    doi: '10.1242/jeb.204.19.3333',
    pmid: '11606607',
    the_result_in_its_own_terms:
      'Rod opsin sequences from 28 deep-sea fish species across seven orders; rod lambda-max from ~520 nm to <470 nm, most ' +
      'between 490 and 477 nm. The 520 nm pigment in two species is associated with Phe261Tyr; the short-wave shifts in the ' +
      'other 26 are accountable by substitutions at eight further sites - 83, 122, 124, 132, 208, 292, 299 and 300. ' +
      'Critically: "Clustering of lambda-max values does not, however, involve a common subset of these substitutions in ' +
      'the different species."',
    verified_how:
      'PMID 11606607 resolved via PubMed MCP get_article_metadata; the site list, the lambda-max range and the ' +
      '"does not involve a common subset" clause are quoted from the returned abstract. DOI from the same record. No ' +
      'per-species nm value is taken from this paper: the abstract gives only the range.',
  },
  hope_1997: {
    cite: 'Hope, A.J., Partridge, J.C., Dulai, K.S. & Hunt, D.M. (1997) Mechanisms of wavelength tuning in the rod opsins of deep-sea fishes. Proc Biol Sci 264:155-163.',
    doi: '10.1098/rspb.1997.0023',
    pmid: '9061967',
    the_result_in_its_own_terms:
      'Rod lambda-max 483 nm in Hoplostethus mediterraneus and Gonostoma elongatum, 468 nm in Cataetyx laticeps. Sites 83 ' +
      'and 292 are "consistently substituted in the visual pigments of all four species".',
    verified_how:
      'PMID 9061967 resolved via PubMed MCP get_article_metadata; the three nm values and the sites-83-and-292 clause are ' +
      'quoted from the returned abstract. The fourth species\' value (Histiobranchus bathybius) is NOT in the abstract and ' +
      'is therefore absent from this file.',
    why_it_is_quarantined:
      'These lambda-max values are retinal measurements from this 1997 paper; the only UniProt sequences for these species ' +
      'are from Hunt et al. 2001, a different study. Pairing them is a cross-study pairing. See CROSS_STUDY_PAIRINGS.',
  },
  yokoyama_2014_plosgen: {
    cite: 'Yokoyama, S., Xing, J., Liu, Y., Faggionato, D., Altun, A. & Starmer, W.T. (2014) Epistatic adaptive evolution of human color vision. PLoS Genet 10:e1004884.',
    doi: '10.1371/journal.pgen.1004884',
    pmid: '25522367',
    pmc: 'PMC4270479',
    the_result_in_its_own_terms:
      'Seven mutations convert an ancestral mammalian SWS1 pigment from UV- to blue-sensitive. Of all 5,040 possible ' +
      'orderings of those seven mutations, 4,008 are "terminated prematurely by containing a dehydrated nonfunctional ' +
      'pigment" - the blue-sensitivity was reached "almost exclusively by epistasis".',
    applies_to: 'SWS1, not RH1. Recorded as the measured magnitude of epistasis in an opsin, which is what THE_HARD_PART rests on.',
    verified_how:
      'PMID 25522367 resolved via PubMed MCP get_article_metadata; the 4,008-of-5,040 figure and the "almost exclusively by ' +
      'epistasis" clause are quoted from the returned abstract. DOI and PMC id from the same record.',
  },
  uniprot_live: {
    cite: 'UniProt Consortium. UniProtKB REST API, https://rest.uniprot.org/uniprotkb/{accession}.json',
    retrieved: '2026-11-07',
    verified_how:
      'Every accession in MEASURED, BOVINE_RH1_REFERENCE and CROSS_STUDY_PAIRINGS was fetched individually from ' +
      'rest.uniprot.org in this session. Organism scientific name, entry name, sequence length and the full sequence were ' +
      'read back from the JSON and are what is stored here - the sequences below are copies of that response, not ' +
      'reconstructions. Gene names were read from the same JSON and are what disambiguates the paralogue pairs ' +
      '(fwo/dso, RH1-A/RH1-B). The literature cross-references were read from the same JSON and are what ties each ' +
      'accession to the paper that measured it.',
  },
  genbank_live: {
    cite: 'NCBI Entrez efetch, https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi',
    retrieved: '2026-11-07',
    verified_how:
      'AY296738 and AY296739 were fetched to settle which of the two Lucania goodei UniProt rhodopsin entries is RH1: the ' +
      'DEFINITION lines read "Lucania goodei RH1 opsin mRNA, complete cds" and "...RH2 opsin mRNA...". AAD30519.1 and ' +
      'AAD30520.1 were fetched to establish that the coelacanth RH1 protein record carries /gene="rh1" and the UniProt ' +
      'entry Q9W6I5 carries /gene="rh2" - which is why the coelacanth RH1 row is in DROPPED_ROWS and not in MEASURED.',
  },
});

export const CITATION_IDS = deepFreeze(Object.keys(CITATIONS));

// ====================================================================================================
// THE SITES, AND THE SHIFTS ATTRIBUTED TO THEM
// ====================================================================================================
// RULE_SITES is the five-site list this benchmark was asked to predict from. EXTENDED_SITES is every
// site named by a source above, which is three times longer - itself a fact about the rule.
export const RULE_SITES = deepFreeze([83, 122, 207, 261, 292]);

export const EXTENDED_SITES = deepFreeze({
  from_hunt_2001: [83, 122, 124, 132, 208, 261, 292, 299, 300],
  from_yokoyama_2008_named_in_text: [83, 96, 102, 122, 183, 194, 195, 253, 261, 289, 292, 317],
  note:
    'Yokoyama et al. 2008 attribute the 480-525 nm range to replacements at 12 sites; the 12 named in the text we could ' +
    'read are listed. Union of all sites named by any source here is larger than RULE_SITES by more than a factor of two.',
  union_size: 17,
});

// Each entry: a substitution, the background it was measured in, and the shift as a value-with-units or
// an explicit refusal. `sign` is the direction as the source states it, independent of the value, so a
// substitution with a null value still carries its direction.
export const SITE_SHIFTS = deepFreeze([
  {
    substitution: 'A292S',
    site: 292,
    pigment_class: 'RH1',
    background: 'Oreochromis niloticus RH1 (lambda-max 505 +/- 1 nm)',
    shift: { value: -14, units: 'nm', sign: 'blue-shift' },
    measurement: 'in vitro regeneration with 11-cis-retinal; dark-light difference spectrum; 505 +/- 1 -> 491 +/- 2 nm',
    source: 'sugawara_2005_pnas',
    verified_how:
      'Read from the live fetch of PMC556224: the paper states the A292S change shifted lambda-max from 505 +/- 1 nm to ' +
      '491 +/- 2 nm in O. niloticus. The -14 nm is the difference of those two retrieved endpoints, not a separate claim.',
  },
  {
    substitution: 'A292S',
    site: 292,
    pigment_class: 'RH1',
    background: 'unspecified / across rhodopsins generally',
    shift: { value: -10, units: 'nm', sign: 'blue-shift', stated_as: 'approximate ("~10 nm")' },
    measurement: 'summary statement over the paper\'s engineered and contemporary pigments',
    source: 'yokoyama_2008_pnas',
    verified_how:
      'Read from the live fetch of PMC2533215: "usually decreases the lambda-max of rhodopsin by ~10 nm". Recorded as a ' +
      'SECOND value for the same substitution, deliberately not averaged with the -14 nm above - the gap between them is ' +
      'the quantity naiveAdditivePrediction turns into band width.',
  },
  {
    substitution: 'S292A',
    site: 292,
    pigment_class: 'RH1',
    background: 'CONGER-A (Conger myriaster rhodopsin, fresh-water form)',
    shift: { value: 12, units: 'nm', sign: 'red-shift' },
    measurement: 'in vitro regeneration; reverse mutation of A292S in that background',
    source: 'yokoyama_2008_pnas',
    is_the_reverse_of: 'A292S',
    verified_how:
      'Read from the live fetch of PMC2533215: S292A "increased the lambda-max by 12 nm" in CONGER-A. Kept as its own row ' +
      'rather than negated into an A292S value, because a reverse mutation in one background is not the forward mutation ' +
      'in another and the file should not hide that step.',
  },
  {
    substitution: 'D83N',
    site: 83,
    pigment_class: 'RH1',
    background: 'Baileychromis centropomoides RH1 (lambda-max 492 +/- 1 nm)',
    shift: { value: -8, units: 'nm', sign: 'blue-shift', inferred_from_reverse: true },
    measurement: 'in vitro regeneration; the reverse N83D shifted 492 -> 500 nm, i.e. +8 nm red',
    source: 'sugawara_2005_pnas',
    verified_how:
      'Read from the live fetch of PMC556224. The paper measured N83D (reverse) at +8 nm and infers D83N at -8 nm; this row ' +
      'records that the direction of measurement was the reverse one.',
  },
  {
    substitution: 'D83N',
    site: 83,
    pigment_class: 'RH1',
    background: 'other cichlid RH1 backgrounds in the same study',
    shift: { value: -3, units: 'nm', sign: 'blue-shift', stated_as: 'a range: "only about 2 to 4 nm"', range_nm: [-4, -2] },
    measurement: 'in vitro regeneration; same assay, same paper, different species',
    source: 'sugawara_2005_pnas',
    at_or_below_noise: true,
    verified_how:
      'Read from the live fetch of PMC556224: in other species D83N shifted lambda-max "only about 2 to 4 nm, which is ' +
      'close to the measurement error" (stated mean error ~+/-1.4 nm). The -3 is the midpoint of the paper\'s own stated ' +
      'range and range_nm carries the endpoints; no narrower value was published.',
  },
  {
    substitution: 'D83N (and five other charged-residue changes at 83, 86, 122, 134, 135, 211)',
    site: 83,
    pigment_class: 'RH1',
    background: 'bovine rhodopsin (lambda-max 498 nm)',
    shift: {
      value: null,
      units: 'nm',
      sign: 'none detected',
      null_reason:
        'The paper reports no per-mutant nm value in the text we retrieved; it reports that all 14 mutants were ' +
        '"surprisingly close" to native 498 nm and draws the conclusion that these residues do not tune the spectrum. ' +
        'A numeric shift here would be invented.',
      what_would_have_to_be_measured:
        'The per-mutant lambda-max table from Nathans 1990 (the paper is not open access and its tables were not ' +
        'retrievable in this session), or a re-measurement of bovine D83N under one stated protocol.',
    },
    measurement: 'digitonin solubilisation, 11-cis-retinal reconstitution, photobleaching difference spectrum with hydroxylamine',
    source: 'nathans_1990',
    this_is_the_counterexample: true,
    verified_how:
      'Quoted from the PubMed abstract for PMID 2111169. This row exists to keep the contradiction in the data structure ' +
      'rather than in a footnote: the same site that is worth 8 nm in a cichlid was measured at no detectable effect in bovine.',
  },
  {
    substitution: 'E122Q',
    site: 122,
    pigment_class: 'RH1',
    background: 'not isolated in any source we retrieved',
    shift: {
      value: null,
      units: 'nm',
      sign: 'blue-shift',
      null_reason:
        'Yokoyama et al. 2008 group E122Q with D83N/A292S and P194R/N195A/A292S and state that those three changes ' +
        '"decrease the lambda-max by 14-20 nm" - a range over three changes, two of which are multi-site. Splitting that ' +
        'range to get a number for E122Q alone would be arithmetic we invented. Yokoyama 1999/2000 report E122Q/A292S ' +
        'jointly accounting for the coelacanth RH1 shift of about 20 nm, again a pair.',
      what_would_have_to_be_measured:
        'A single-mutant E122Q lambda-max against its own wild-type background, reported as two numbers. Nathans 1990 did ' +
        'build mutants at 122 in bovine and found no significant effect, which is the only isolated 122 result we hold.',
    },
    measurement: 'n/a - no isolated single-mutant value retrieved',
    source: 'yokoyama_2008_pnas',
    also_see: ['yokoyama_2000_jhered', 'nathans_1990'],
    verified_how:
      'The 14-20 nm range and its three-change grouping were read from the live fetch of PMC2533215. The coelacanth pairing ' +
      'was read from the PubMed abstracts of PMID 10833047 and PMID 10339578. Neither gives E122Q alone.',
  },
  {
    substitution: 'E122Q/A292S (double)',
    site: null,
    sites: [122, 292],
    pigment_class: 'RH1',
    background: 'coelacanth RH1 vs its orthologous pigments',
    shift: { value: -20, units: 'nm', sign: 'blue-shift', stated_as: 'approximate ("about 20 nm")', is_a_double_mutant: true },
    measurement: 'in vitro regeneration with 11-cis-retinal; coelacanth RH1 lambda-max 478 nm',
    source: 'yokoyama_1999_pnas',
    also_see: ['yokoyama_2000_jhered'],
    verified_how:
      'Quoted from the PubMed abstracts of PMID 10339578 ("shifted about 20 nm toward blue compared with those of the ' +
      'corresponding orthologous pigments"; "fully explained by two amino acid replacements") and PMID 10833047 (names the ' +
      'pair as E122Q/A292S and gives RH1 at 478 nm). This is a DOUBLE and is flagged as one; it is not evidence that the ' +
      'two singles sum to -20.',
  },
  {
    substitution: 'M207L',
    site: 207,
    pigment_class: 'RH2',
    background: 'coelacanth RH2 (as E122Q/M207L)',
    shift: {
      value: null,
      units: 'nm',
      sign: 'blue-shift',
      null_reason:
        'M207L appears only inside the double E122Q/M207L, which accounts for coelacanth RH2 at 485 nm. No isolated M207L ' +
        'value was retrieved, and RH2 is a different pigment class from RH1.',
      what_would_have_to_be_measured: 'A single-mutant M207L lambda-max in a stated RH1 background, as two numbers.',
    },
    measurement: 'n/a',
    source: 'yokoyama_2000_jhered',
    verified_how:
      'Quoted from the PubMed abstract for PMID 10833047, which names E122Q/M207L for RH2 and lists M207L among the four ' +
      'changes "associated strongly with the adaptive blue shifts in the lambda max values of RH1 and RH2 pigments".',
  },
  {
    substitution: 'F261Y',
    site: 261,
    pigment_class: 'RH1',
    background: '"pigment b" of Yokoyama et al. 2008',
    shift: { value: 10, units: 'nm', sign: 'red-shift' },
    measurement: 'in vitro regeneration with 11-cis-retinal',
    source: 'yokoyama_2008_pnas',
    verified_how:
      'Read from the live fetch of PMC2533215: "F261Y in pigment b increases the lambda-max by 10 nm". The background is ' +
      'recorded by the paper\'s own internal label because that is how it names it.',
  },
  {
    substitution: 'F261Y',
    site: 261,
    pigment_class: 'RH1',
    background: 'two deep-sea fish species with 520 nm rod pigments',
    shift: {
      value: null,
      units: 'nm',
      sign: 'red-shift',
      null_reason:
        'Hunt et al. 2001 associate the 520 nm pigment with Phe261Tyr but the abstract gives no nm value for the ' +
        'substitution itself, only the pigment\'s lambda-max and the set\'s range.',
      what_would_have_to_be_measured: 'A 261-only mutant lambda-max against its own wild type in one of those backgrounds.',
    },
    measurement: 'microspectrophotometry of rod pigments; sequence association, not mutagenesis',
    source: 'hunt_2001_jeb',
    verified_how:
      'Quoted from the PubMed abstract for PMID 11606607. Recorded to make the point that the strongest red-shift ' +
      'attribution in the deep-sea literature is an ASSOCIATION across species, not a measured substitution effect.',
  },
  // --- The M/LWS five-sites rule. A different pigment class; here because it is the template. ---
  { substitution: 'S180A', site: 180, pigment_class: 'M/LWS', background: 'ancestral and contemporary M/LWS pigments (regression)', shift: { value: -7, units: 'nm', sign: 'blue-shift' }, measurement: 'in vitro assay of reconstructed ancestral pigments; multiple regression', source: 'yokoyama_radlwimmer_2001', verified_how: "Quoted from the PubMed abstract for PMID 11545071, which lists this substitution and its nm shift among the six terms of the five-sites regression; DOI 10.1093/genetics/158.4.1697 returned by the same PubMed record." },
  { substitution: 'H197Y', site: 197, pigment_class: 'M/LWS', background: 'ancestral and contemporary M/LWS pigments (regression)', shift: { value: -28, units: 'nm', sign: 'blue-shift' }, measurement: 'in vitro assay of reconstructed ancestral pigments; multiple regression', source: 'yokoyama_radlwimmer_2001', verified_how: "Quoted from the PubMed abstract for PMID 11545071, which lists this substitution and its nm shift among the six terms of the five-sites regression; DOI 10.1093/genetics/158.4.1697 returned by the same PubMed record." },
  { substitution: 'Y277F', site: 277, pigment_class: 'M/LWS', background: 'ancestral and contemporary M/LWS pigments (regression)', shift: { value: -8, units: 'nm', sign: 'blue-shift' }, measurement: 'in vitro assay of reconstructed ancestral pigments; multiple regression', source: 'yokoyama_radlwimmer_2001', verified_how: "Quoted from the PubMed abstract for PMID 11545071, which lists this substitution and its nm shift among the six terms of the five-sites regression; DOI 10.1093/genetics/158.4.1697 returned by the same PubMed record." },
  { substitution: 'T285A', site: 285, pigment_class: 'M/LWS', background: 'ancestral and contemporary M/LWS pigments (regression)', shift: { value: -15, units: 'nm', sign: 'blue-shift' }, measurement: 'in vitro assay of reconstructed ancestral pigments; multiple regression', source: 'yokoyama_radlwimmer_2001', verified_how: "Quoted from the PubMed abstract for PMID 11545071, which lists this substitution and its nm shift among the six terms of the five-sites regression; DOI 10.1093/genetics/158.4.1697 returned by the same PubMed record." },
  { substitution: 'A308S', site: 308, pigment_class: 'M/LWS', background: 'ancestral and contemporary M/LWS pigments (regression)', shift: { value: -27, units: 'nm', sign: 'blue-shift' }, measurement: 'in vitro assay of reconstructed ancestral pigments; multiple regression', source: 'yokoyama_radlwimmer_2001', verified_how: "Quoted from the PubMed abstract for PMID 11545071, which lists this substitution and its nm shift among the six terms of the five-sites regression; DOI 10.1093/genetics/158.4.1697 returned by the same PubMed record." },
  {
    substitution: 'S180A/H197Y (double)',
    site: null,
    sites: [180, 197],
    pigment_class: 'M/LWS',
    background: 'ancestral and contemporary M/LWS pigments (regression)',
    shift: { value: 11, units: 'nm', sign: 'red-shift', is_a_double_mutant: true, is_an_interaction_term: true },
    measurement: 'in vitro assay of reconstructed ancestral pigments; multiple regression',
    source: 'yokoyama_radlwimmer_2001',
    why_it_matters:
      'The singles are -7 and -28 nm, so additivity predicts -35 nm; the fitted double term is +11 nm. The five-sites rule ' +
      'the RH1 story is modelled on NEEDED AN INTERACTION TERM AT ITS OWN TWO BEST-SUPPORTED SITES to fit. Epistasis is not ' +
      'a caveat on this family of rules, it is inside the original regression.',
    verified_how: 'Quoted from the PubMed abstract for PMID 11545071, which lists the double alongside the five singles.',
  },
]);

// ====================================================================================================
// THE BOVINE REFERENCE, FOR SITE NUMBERING
// ====================================================================================================
export const BOVINE_RH1_REFERENCE = deepFreeze({
  accession: 'P02699',
  uniprot_entry: 'OPSD_BOVIN',
  organism: 'Bos taurus',
  common_name: 'Bovine',
  taxon_id: 9913,
  gene: 'RHO',
  protein: 'Rhodopsin',
  length: 348,
  sequence:
    'MNGTEGPNFYVPFSNKTGVVRSPFEAPQYYLAEPWQFSMLAAYMFLLIMLGFPINFLTLYVTVQHKKLRTPLNYILLNLAVADLFMVFGGFTTTLYTSLHG' +
    'YFVFGPTGCNLEGFFATLGGEIALWSLVVLAIERYVVVCKPMSNFRFGENHAIMGVAFTWVMALACAAPPLVGWSRYIPEGMQCSCGIDYYTPHEETNNES' +
    'FVIYMFVVHFIIPLIVIFFCYGQLVFTVKEAAAQQQESATTQKAEKEVTRMVIIMVIAFLICWLPYAGVAFYIFTHQGSDFGPIFMTIPAFFAKTSAVYNP' +
    'VIYIMMNKQFRNCMVTTLCCGKNPLGDDEASTTVSKTETSQVAPA',
  lambda_max: { value: 498, units: 'nm', method: 'photobleaching difference spectrum, digitonin, 11-cis-retinal, with hydroxylamine', source: 'nathans_1990' },
  numbering_is_the_convention_because:
    'Every site label in SITE_SHIFTS is a position in THIS sequence. Nothing in this file is numbered in its own ' +
    'species\' coordinates.',
  verified_how:
    'Fetched live from https://rest.uniprot.org/uniprotkb/P02699.json. Read back: primaryAccession P02699, uniProtkbId ' +
    'OPSD_BOVIN, organism.scientificName "Bos taurus", taxonId 9913, gene RHO, recommendedName "Rhodopsin", ' +
    'sequence.length 348, crc64 33FDA196803E81F3. The sequence above is that response\'s sequence.value.',
});

// ====================================================================================================
// MEASURED: ROWS WHERE ONE PAPER MEASURED THE PIGMENT AND THE ACCESSION IS ITS SEQUENCE
// ====================================================================================================
// Admission rule for this table, applied before anything else: the UniProt entry's own literature
// cross-reference must name the paper that reports the lambda-max, OR the paper's sequence must be
// identifiable from the entry by gene name / GenBank DEFINITION. Rows that failed are in DROPPED_ROWS.
export const MEASURED = deepFreeze([
  {
    id: 'anguilla-japonica-fwo',
    organism: 'Anguilla japonica',
    common_name: 'Japanese eel',
    taxon_id: 7937,
    group: 'bony fish',
    habitat: 'fresh-water form',
    pigment: 'RH1',
    paper_label: 'EEL-A',
    uniprot: 'Q9PUA2',
    uniprot_entry: 'Q9PUA2_ANGJA',
    gene: 'fwo',
    length: 352,
    lambda_max: { value: 500, units: 'nm' },
    method: 'in vitro expression and reconstitution with 11-cis-retinal; dark spectrum',
    source: 'yokoyama_2008_pnas',
    verified_how:
      'lambda-max 500 nm for EEL-A read from the live fetch of PMC2533215. Accession fetched live from ' +
      'rest.uniprot.org/uniprotkb/Q9PUA2.json: organism "Anguilla japonica" (taxon 7937), entry Q9PUA2_ANGJA, protein ' +
      '"Rhodopsin", length 352, gene name "fwo" (fresh-water opsin) with synonym FW-rho - which is what assigns this ' +
      'accession to EEL-A rather than to the deep-sea paralogue. The sequence stored here is that response\'s sequence.value.',
  },
  {
    id: 'anguilla-japonica-dso',
    organism: 'Anguilla japonica',
    common_name: 'Japanese eel',
    taxon_id: 7937,
    group: 'bony fish',
    habitat: 'deep-sea form',
    pigment: 'RH1',
    paper_label: 'EEL-B',
    uniprot: 'Q9PUA1',
    uniprot_entry: 'Q9PUA1_ANGJA',
    gene: 'dso',
    length: 352,
    lambda_max: { value: 479, units: 'nm' },
    method: 'in vitro expression and reconstitution with 11-cis-retinal; dark spectrum',
    source: 'yokoyama_2008_pnas',
    informative_end: 'blue-shifted',
    verified_how:
      'lambda-max 479 nm for EEL-B read from the live fetch of PMC2533215. Accession fetched live: organism "Anguilla ' +
      'japonica", entry Q9PUA1_ANGJA, length 352, gene name "dso" (deep-sea opsin) with synonym DS-rho. The gene names ' +
      'fwo/dso are the whole basis of the A/B assignment for this pair and are quoted from UniProt, not guessed.',
  },
  {
    id: 'lepidopus-fitchi-rh1a',
    organism: 'Lepidopus fitchi',
    common_name: 'Pacific scabbardfish',
    taxon_id: 515182,
    group: 'bony fish',
    habitat: 'mesopelagic',
    pigment: 'RH1',
    paper_label: 'SCABBARD-A',
    uniprot: 'B4YA23',
    uniprot_entry: 'B4YA23_9SCOM',
    gene: 'RH1-A',
    length: 350,
    lambda_max: { value: 507, units: 'nm' },
    method: 'in vitro expression and reconstitution with 11-cis-retinal; dark spectrum',
    source: 'yokoyama_2008_pnas',
    verified_how:
      'lambda-max 507 nm for SCABBARD-A read from the live fetch of PMC2533215. Accession fetched live: organism ' +
      '"Lepidopus fitchi", entry B4YA23_9SCOM, length 350, gene name "RH1-A" (from EMBL ACB45449.1 / EU407252), and the ' +
      'entry\'s single literature cross-reference is PubMed 18768804 - the same paper that reports the 507 nm. The gene ' +
      'name A/B is what pairs this accession with SCABBARD-A.',
  },
  {
    id: 'lepidopus-fitchi-rh1b',
    organism: 'Lepidopus fitchi',
    common_name: 'Pacific scabbardfish',
    taxon_id: 515182,
    group: 'bony fish',
    habitat: 'mesopelagic',
    pigment: 'RH1',
    paper_label: 'SCABBARD-B',
    uniprot: 'B4YA24',
    uniprot_entry: 'B4YA24_9SCOM',
    gene: 'RH1-B',
    length: 350,
    lambda_max: { value: 481, units: 'nm' },
    method: 'in vitro expression and reconstitution with 11-cis-retinal; dark spectrum',
    source: 'yokoyama_2008_pnas',
    informative_end: 'blue-shifted',
    verified_how:
      'lambda-max 481 nm for SCABBARD-B read from the live fetch of PMC2533215. Accession fetched live: entry ' +
      'B4YA24_9SCOM, length 350, gene name "RH1-B" (EMBL ACB45450.1 / EU407253), literature cross-reference PubMed ' +
      '18768804. The same-species pair B4YA23/B4YA24 differing by 26 nm is the strongest single row-pair in this table, ' +
      'because the genetic background is as close as comparative data gets.',
  },
  {
    id: 'lucania-goodei-rh1',
    organism: 'Lucania goodei',
    common_name: 'bluefin killifish',
    taxon_id: 232977,
    group: 'bony fish',
    habitat: 'fresh-water, shallow',
    pigment: 'RH1',
    paper_label: 'BFN KILLIFISH',
    uniprot: 'Q7T2U5',
    uniprot_entry: 'Q7T2U5_9TELE',
    gene: null,
    length: 354,
    lambda_max: { value: 504, units: 'nm' },
    method: 'in vitro expression and reconstitution with 11-cis-retinal; dark spectrum',
    source: 'yokoyama_2008_pnas',
    verified_how:
      'lambda-max 504 nm read from the live fetch of PMC2533215. UniProt has TWO Lucania goodei rhodopsin entries and ' +
      'NEITHER carries a gene name, so the assignment was settled at GenBank: efetch of the EMBL accessions behind them ' +
      'returned DEFINITION "Lucania goodei RH1 opsin mRNA, complete cds" for AY296738 (= Q7T2U5) and "...RH2 opsin ' +
      'mRNA..." for AY296739 (= Q7T2U4). Q7T2U4 is therefore excluded from this table as a cone pigment.',
  },
  {
    id: 'stenobrachius-leucopsarus-rh1',
    organism: 'Stenobrachius leucopsarus',
    common_name: 'northern lampfish',
    taxon_id: 91658,
    group: 'bony fish',
    habitat: 'mesopelagic',
    pigment: 'RH1',
    paper_label: 'LAMPFISH',
    uniprot: 'B4YA22',
    uniprot_entry: 'B4YA22_9TELE',
    gene: 'RH1',
    length: 345,
    lambda_max: { value: 492, units: 'nm' },
    method: 'in vitro expression and reconstitution with 11-cis-retinal; DARK-LIGHT DIFFERENCE SPECTRUM',
    dark_spectrum_obtained: false,
    source: 'yokoyama_2008_pnas',
    informative_end: 'blue-shifted',
    verified_how:
      'lambda-max 492 nm read from the live fetch of PMC2533215, which states for this pigment that the value is from a ' +
      'difference spectrum and that a dark spectrum was not obtained. That is recorded rather than smoothed over: a ' +
      'difference-spectrum lambda-max and a dark-spectrum lambda-max are not interchangeable at the few-nm scale this ' +
      'benchmark scores at. Accession fetched live: entry B4YA22_9TELE, length 345, gene RH1, cross-reference PubMed 18768804.',
  },
  {
    id: 'chauliodus-macouni-rh1',
    organism: 'Chauliodus macouni',
    common_name: 'Pacific viperfish',
    taxon_id: 302055,
    group: 'bony fish',
    habitat: 'deep-sea',
    pigment: 'RH1',
    paper_label: 'VIPERFISH',
    uniprot: 'B4YA21',
    uniprot_entry: 'B4YA21_9TELE',
    gene: 'RH1',
    length: 352,
    lambda_max: { value: 489, units: 'nm' },
    method: 'in vitro expression and reconstitution with 11-cis-retinal; DARK-LIGHT DIFFERENCE SPECTRUM',
    dark_spectrum_obtained: false,
    source: 'yokoyama_2008_pnas',
    informative_end: 'blue-shifted',
    verified_how:
      'lambda-max 489 nm read from the live fetch of PMC2533215, which states this is a difference spectrum with no dark ' +
      'spectrum obtained. Accession fetched live: entry B4YA21_9TELE, length 352, gene RH1, cross-reference PubMed 18768804.',
  },
  {
    id: 'aristostomias-scintillans-rh1',
    organism: 'Aristostomias scintillans',
    common_name: 'shiny loosejaw',
    taxon_id: 319440,
    group: 'bony fish',
    habitat: 'deep-sea',
    pigment: 'RH1',
    paper_label: 'LOOSEJAW',
    uniprot: 'B4YA19',
    uniprot_entry: 'B4YA19_9TELE',
    gene: 'RH1',
    length: 346,
    lambda_max: { value: 526, units: 'nm' },
    method: 'microspectrophotometry (MSP) of rod photoreceptors',
    secondary_quotation: true,
    source: 'yokoyama_2008_pnas',
    informative_end: 'red-shifted',
    verified_how:
      'lambda-max 526 nm read from the live fetch of PMC2533215, where it is attributed to that paper\'s own reference 15 ' +
      'and labelled as microspectrophotometry. WE DID NOT RETRIEVE REFERENCE 15, so this row is flagged ' +
      'secondary_quotation: the number is what Yokoyama et al. 2008 print, and the chain to the instrument has one link we ' +
      'did not walk. It is also the only MSP row in this table and the only red-shifted one, so it is simultaneously the ' +
      'most informative row and the weakest-provenance row. Accession fetched live: entry B4YA19_9TELE, length 346, gene ' +
      'RH1, cross-reference PubMed 18768804.',
  },
  {
    id: 'oreochromis-niloticus-rh1',
    organism: 'Oreochromis niloticus',
    common_name: 'Nile tilapia',
    taxon_id: 8128,
    group: 'bony fish',
    habitat: 'fresh-water, shallow',
    pigment: 'RH1',
    uniprot: 'Q8JIH6',
    uniprot_entry: 'Q8JIH6_ORENI',
    gene: null,
    length: 308,
    is_partial_sequence: true,
    lambda_max: { value: 505, units: 'nm', uncertainty_nm: 1, stated_as: '505 +/- 1 nm' },
    method: 'in vitro regeneration with 11-cis-retinal in pFLAG-CMV-5a; dark-light difference spectrum',
    source: 'sugawara_2005_pnas',
    verified_how:
      'lambda-max 505 +/- 1 nm read from the live fetch of PMC556224, where O. niloticus is also the wild-type background ' +
      'for that paper\'s A292S experiment. Accession fetched live: entry Q8JIH6_ORENI, organism "Oreochromis niloticus" ' +
      '(taxon 8128), protein "Rhodopsin", length 308, and literature cross-references PubMed 12270908 AND PubMed 15809435 - ' +
      'the second being this measuring paper, which is what admits the row. The 308-residue length means the entry is ' +
      'PARTIAL: it begins around bovine position 13 and ends around bovine 320, so site 292 is covered but the termini are not.',
  },
  {
    id: 'cyphotilapia-frontosa-rh1',
    organism: 'Cyphotilapia frontosa',
    common_name: 'frontosa cichlid',
    taxon_id: 27783,
    group: 'bony fish',
    habitat: 'deep-water (lacustrine)',
    pigment: 'RH1',
    uniprot: 'Q8JII5',
    uniprot_entry: 'Q8JII5_CYPFR',
    gene: null,
    length: 308,
    is_partial_sequence: true,
    lambda_max: { value: 487, units: 'nm', uncertainty_nm: 2, stated_as: '487 +/- 2 nm' },
    method: 'in vitro regeneration with 11-cis-retinal in pFLAG-CMV-5a; dark-light difference spectrum',
    source: 'sugawara_2005_pnas',
    informative_end: 'blue-shifted',
    verified_how:
      'lambda-max 487 +/- 2 nm read from the running text of the live fetch of PMC556224 (that paper\'s Table 1 is a bitmap ' +
      'and was NOT readable, so only text-stated species values were taken). Accession fetched live: entry Q8JII5_CYPFR, ' +
      'organism "Cyphotilapia frontosa" (taxon 27783), length 308, literature cross-references PubMed 12270908 and 15809435.',
  },
  {
    id: 'trematocara-macrostoma-rh1',
    organism: 'Trematocara macrostoma',
    taxon_id: 195092,
    group: 'bony fish',
    habitat: 'deep-water (lacustrine)',
    pigment: 'RH1',
    uniprot: 'Q8JIG9',
    uniprot_entry: 'Q8JIG9_9CICH',
    gene: null,
    length: 308,
    is_partial_sequence: true,
    lambda_max: { value: 488, units: 'nm', uncertainty_nm: 1, stated_as: '488 +/- 1 nm' },
    method: 'in vitro regeneration with 11-cis-retinal in pFLAG-CMV-5a; dark-light difference spectrum',
    source: 'sugawara_2005_pnas',
    informative_end: 'blue-shifted',
    verified_how:
      'lambda-max 488 +/- 1 nm read from the running text of the live fetch of PMC556224. Accession fetched live: entry ' +
      'Q8JIG9_9CICH, organism "Trematocara macrostoma" (taxon 195092), length 308, literature cross-references PubMed ' +
      '12270908 and 15809435.',
  },
  {
    id: 'bos-taurus-rh1',
    organism: 'Bos taurus',
    common_name: 'bovine',
    taxon_id: 9913,
    group: 'mammal',
    habitat: 'terrestrial',
    pigment: 'RH1',
    uniprot: 'P02699',
    uniprot_entry: 'OPSD_BOVIN',
    gene: 'RHO',
    length: 348,
    lambda_max: { value: 498, units: 'nm' },
    method: 'photobleaching difference spectrum; digitonin; 11-cis-retinal; with hydroxylamine',
    source: 'nathans_1990',
    role: 'terrestrial anchor and the numbering reference',
    verified_how:
      'lambda-max 498 nm quoted from the PubMed abstract for PMID 2111169, which gives it as the native bovine value in ' +
      'that paper\'s own assay. Accession fetched live from rest.uniprot.org: P02699 / OPSD_BOVIN / "Bos taurus" / 348 aa. ' +
      'Note the 2 nm disagreement with the 500 nm that Yokoyama et al. 2008 use as the ancestral rhodopsin value: that ' +
      'disagreement is BETWEEN ASSAYS, is smaller than several of the shifts this benchmark scores, and is folded into the ' +
      'prediction baseline band rather than resolved. See THE_HARD_PART.method_differences.',
  },
]);

// ====================================================================================================
// WHAT WAS AVAILABLE AND NOT TAKEN
// ====================================================================================================
export const DROPPED_ROWS = deepFreeze([
  {
    organism: 'Latimeria chalumnae',
    group: 'bony fish (lobe-finned)',
    pigment: 'RH1',
    lambda_max_reported: { value: 478, units: 'nm', source: 'yokoyama_1999_pnas', also: 'yokoyama_2000_jhered' },
    why_dropped:
      'No UniProt entry could be tied to the RH1 that was measured. The coelacanth entry whose literature cross-reference ' +
      'IS the measuring paper (Q9W6I5) carries gene name "rh2", and GenBank efetch confirms AAD30520.1 is "RH2 opsin" ' +
      'while the rh1 protein is AAD30519.1 - which has no UniProt accession we could find. The other two Latimeria ' +
      'rhodopsin entries (Q9W6I4, H3BAC8) are genome-assembly predictions with gene names LOC102353290 and LOC102347432 ' +
      'and no literature link.',
    what_would_have_to_be_measured:
      'Nothing new - this needs a resolvable accession, or the row can use GenBank AAD30519.1 directly once someone ' +
      'decides this benchmark may cite protein records that are not in UniProt.',
    note: 'This is the single most-cited RH1 blue-shift in the literature and it is NOT in our scoring table.',
  },
  {
    organism: 'Conger myriaster',
    group: 'bony fish',
    pigment: 'RH1',
    lambda_max_reported: { value: null, units: 'nm', candidates: [486, 485], source: 'yokoyama_2008_pnas' },
    why_dropped:
      'Yokoyama et al. 2008 report two conger pigments, CONGER-A at 486 nm and CONGER-B at 485 nm, and UniProt has exactly ' +
      'ONE Conger myriaster rhodopsin (Q98UJ4, gene "cond"). "cond" reads as the deep-sea form, which would make it ' +
      'CONGER-B, but that is an inference from a four-letter gene symbol. The two candidate values differ by 1 nm, so ' +
      'guessing would barely change the residual - which is exactly why it would be an invisible fabrication rather than a ' +
      'visible one.',
    what_would_have_to_be_measured:
      'The correspondence between Yokoyama et al. 2008\'s CONGER-A/B labels and EMBL AB043818, from that paper\'s own ' +
      'methods or supplementary accession list.',
  },
  {
    organism: 'Idiacanthus antrostomus',
    common_name: 'Pacific blackdragon',
    group: 'bony fish',
    pigment: 'RH1',
    lambda_max_reported: { value: null, units: 'nm', null_reason: 'The measuring paper states no value was obtained for this pigment.' },
    why_dropped: 'There is no measurement to score against. Recorded so the absence is visible in the data rather than in the gap between two rows.',
    what_would_have_to_be_measured: 'A lambda-max for this pigment, by any stated method.',
  },
  {
    organism: 'Astyanax mexicanus',
    group: 'bony fish',
    pigment: 'RH1',
    lambda_max_reported: { value: 504, units: 'nm', secondary: true },
    why_dropped:
      'Yokoyama et al. 2008 quote 504 nm for this species from their own reference 12, which we did not retrieve. One ' +
      'secondary-quotation row (the loosejaw) is already in MEASURED and flagged; adding a second would make the flag ' +
      'ordinary. UniProt also offers four Astyanax rhodopsin entries, all genome predictions with no literature link, so ' +
      'the accession would have been a guess too.',
    what_would_have_to_be_measured: 'The primary measurement, from the paper that made it.',
  },
  {
    organism: 'Histiobranchus bathybius',
    group: 'bony fish',
    pigment: 'RH1',
    lambda_max_reported: { value: null, units: 'nm', null_reason: 'Hope et al. 1997 measured four species; its abstract gives values for three. This one is not among them and we did not retrieve the full text.' },
    why_dropped: 'No retrieved value, and no UniProt opsin entry for the species was found either.',
    what_would_have_to_be_measured: 'The per-species MSP table of Hope et al. 1997 (doi 10.1098/rspb.1997.0023).',
  },
]);

// ====================================================================================================
// QUARANTINE: SEQUENCE FROM ONE STUDY, MEASUREMENT FROM ANOTHER
// ====================================================================================================
// These three would have taken MEASURED from 12 rows to 15 and added the bluest pigment in the file
// (468 nm). They are not in MEASURED and retroValidate() does not score them. The sequences are real, the
// lambda-max values are real, and the pairing is an assumption: same species, same laboratory, four years
// apart, certainly different individuals, and - for two of the three - a different assay (MSP of a retina
// vs nothing, since Hunt et al. 2001 did not re-measure these). A design pipeline that silently did this
// pairing would report three extra successes it had not earned.
export const CROSS_STUDY_PAIRINGS = deepFreeze([
  {
    organism: 'Gonostoma elongatum',
    common_name: 'elongated bristlemouth fish',
    taxon_id: 91970,
    group: 'bony fish',
    uniprot: 'G9HXI2',
    uniprot_entry: 'G9HXI2_9TELE',
    length: 353,
    sequence_source: 'hunt_2001_jeb',
    lambda_max: { value: 483, units: 'nm' },
    lambda_max_source: 'hope_1997',
    method: 'microspectrophotometry of rod photoreceptors',
    is_same_material: false,
    why_quarantined: 'Sequence from Hunt et al. 2001 (the entry\'s literature cross-reference is PubMed 11606607); lambda-max from Hope et al. 1997. Different study, different individuals.',
    verified_how: 'Accession fetched live from rest.uniprot.org: organism "Gonostoma elongatum" (taxon 91970), length 353, literature cross-reference PubMed 11606607. lambda-max quoted from the PubMed abstract of PMID 9061967.',
  },
  {
    organism: 'Hoplostethus mediterraneus',
    common_name: 'Mediterranean slimehead',
    taxon_id: 114863,
    group: 'bony fish',
    uniprot: 'G9HXK4',
    uniprot_entry: 'G9HXK4_9TELE',
    length: 300,
    is_partial_sequence: true,
    sequence_source: 'hunt_2001_jeb',
    lambda_max: { value: 483, units: 'nm' },
    lambda_max_source: 'hope_1997',
    method: 'microspectrophotometry of rod photoreceptors',
    is_same_material: false,
    why_quarantined: 'As above. Also a 300-residue partial sequence that begins after bovine position 1.',
    verified_how: 'Accession fetched live: organism "Hoplostethus mediterraneus" (taxon 114863), length 300, literature cross-reference PubMed 11606607. lambda-max quoted from the PubMed abstract of PMID 9061967. A second Hoplostethus entry (Q8AWP7, 252 aa) was rejected: its only literature link is a phylogenetics paper, PubMed 12565036.',
  },
  {
    organism: 'Cataetyx laticeps',
    taxon_id: 546511,
    group: 'bony fish',
    uniprot: 'G9HXK1',
    uniprot_entry: 'G9HXK1_9TELE',
    length: 287,
    is_partial_sequence: true,
    sequence_source: 'hunt_2001_jeb',
    lambda_max: { value: 468, units: 'nm' },
    lambda_max_source: 'hope_1997',
    method: 'microspectrophotometry of rod photoreceptors',
    is_same_material: false,
    why_quarantined:
      'As above - and this is the bluest pigment anywhere in this file, so it is the row a benchmark would most want and ' +
      'the one whose provenance is weakest. Keeping it out of MEASURED costs the benchmark its widest lever arm. That is ' +
      'the price.',
    verified_how: 'Accession fetched live: organism "Cataetyx laticeps" (taxon 546511), length 287, literature cross-reference PubMed 11606607. lambda-max quoted from the PubMed abstract of PMID 9061967.',
  },
]);

// ====================================================================================================
// SEQUENCES, EMBEDDED SO A PREDICTOR RUNS OFFLINE
// ====================================================================================================
// Each is the `sequence.value` of the live UniProt JSON response for that accession, copied unmodified.
export const SEQUENCES = deepFreeze({
  P02699: BOVINE_RH1_REFERENCE.sequence,
  Q9PUA2:
    'MNGTEGPNFYVPMSNATGVVRSPFEYPQYYLAEPWAYSALAAYMFFLIIAGFPINFLTLYVTIEHKKLRTPLNYILLNLAVADLFMVFGGFTTTMYTSMHG' +
    'YFVFGPTGCNIEGFFATLGGEIALWCLVVLAIERWVVVCKPMSNFRFGENHAIMGVAFTWLMALACAAPPLFGWSRYIPEGMQCSCGIDYYTPNPETYNES' +
    'FVIYMFVCHFTIPLTVVSFCYGRLVCTVKEAAAQQQESETTQRAEREVTRMVVIMVISFLVCWVPYASVAWYIFTHQGSSFGPIFMTIPAFFAKSSALYNP' +
    'LIYICMNKQFRNCMITTLCCGKNPFEEEEGASTTASKTEASSVSSVSPA',
  Q9PUA1:
    'MNGTEGPNFYIPMSNITGVVRSPFEYPQYYLAEPWAYTILAAYMFTLILLGFPVNFLTLYVTIEHKKLRTPLNYILLNLAVANLFMVFGGFTTTMYTSMHG' +
    'YFVFGETGCNLEGYFATLGGEISLWSLVVLAIERWVVVCKPMSNFRFGENHAIMGLAFTWIMANTCALPPLFGWSRYIPEGMQCSCGVDYYTLKPEVNNES' +
    'FVIYMFIVHFSIPLTIISFCYGRLVCTVKEAAAQQQESETTQRAEREVTRMVVIMVIAFLVCWIPYASVAWYIFTHQGSTFGPVFMTVPSFFAKSSAIYNP' +
    'LIYICLNSQFRNCMITTLFCGKNPFQEEEGASTTASKTEASSVSSVSPA',
  B4YA23:
    'MNGTEGSFFYVPMSNATGVVRSPYEYPQYYLANPAAYSVLAAYMFFLIIFGFPINFLTLYVTIEHKKLRTALNYILLNLAVADLFMVIGGFTTTMVTSMHG' +
    'FFIFGRAGCNLEGFFATHGGEISLWSLVVLAIERWLVVCKPISNFRFGENHAVMGVAFTWIMASSCSVPPLVGWSRYIPEGLQCSCGVDYYTRAEGFNNES' +
    'FVIYMFIVHFIVPLTVISFCYGRLLCAVKEAAAAQQESETTQRAEREVTRMVVLMMISYLICWIPYAGTAWYIFTHQGTEFGPLFMTLPAFFAKSSSVYNP' +
    'LIYVCMNKQFRHCMITTLCCGKNPFEEEADAASKTEASASSSSVAPA',
  B4YA24:
    'MNGTEGPDFYIPMSNATGVVRSPYEYPQYYLANPAAFSVLAAYMMFLILVGFPMNFLTLYVTIEHKKLRTALNYILLNLAVANLFMIIGGFTTTVVTSING' +
    'FFIFGRAGCMLEGFFATHGGEISLWSLVVLAIERWLVVCKPIANFRFGENHAVMGVAFTWVMASACSVPPLVGWSRYIPEGLQCACGIDYYTRAEGFNNES' +
    'FVIYMFTCHFIGPLCVICFCYGRLLCAVKEAAAAQQESETTQRAEREVTRMVILMLVSFLMCWVPYASTAWFIFTHQGSTFGPIFMAIPSFFAKSSAIYNP' +
    'LIYVCMNKQFRHCMITTLCCGKNPFEEEAEAASKTRASASSSSVAPA',
  Q7T2U5:
    'MNGTEGPYFYVPMVNTTGIVRSPYEYPQYYLVSPAAYAALGCYMFFLIIVGFPINFLTLYVTIEHKKLRTPLNYILLNLAVADLFMVFGGFTTTIYTSMHG' +
    'YFVLGRLGCNLEGFFATLGGEIGLWSLVVLAIERWLVVCKPISNFRFTENHAIMGLAFTWIMACACAVPPLVGWSRYIPEGMQCSCGVDYYTRAEGFNNES' +
    'FVIYMFICHFIIPLVIVFFCYGRLLCAVKEAAAAQQESETTQRAEREVTRMVIIMVIGFLVCWCPYAGVAWYIFTNQGTEFGPLFMTIPAFFAKTASIYNP' +
    'MIYICLNKQFRHCMITTLCCGKNPFEEEEGASSTASKTEASSVSSSSVSPA',
  B4YA22:
    'MNGTEGDGFYVPMSNATGIVRSPFEYPQYYLVNPAAYAMLGAYMFFLILVGFPVNFLTLYVTIEHKKLRTPLNYILLNLAVGDLLMVLGGFTTTIYTSMHG' +
    'YFVLGKLGCAIEGFMATHGGQVALWSLVVLAVERWLVVCKPISSFRFQESHSLMGLAVTWVMATACSVPPLVGWSRYIPEGMQCSCGIDYYTRAPGVNNES' +
    'YVVYMFSCHFIGPMAIIFFCYGQLLCAVKAAAAAQQESETTQRAEREVTRMVIMMVISFLVCWVPYASVAWWIFCNQGAEFGPVFMTLPAFFAKSSAIYNP' +
    'LIYICMNKQFRECMITTLFCGKNPFGEEAASEASSTSSVAPA',
  B4YA21:
    'MNGTEGPYFYIPMLNTTGVVRSPYDYPQYYLVSPVAFFALGAYMFFLILTCFPVNFLTLYVTIEHKKLRTALNYVLLNLAVANLFMVIGGFTTTLYSSMNG' +
    'YFVFGRLGCNLEGFFATHGGEIALWSLVVLAVERYLVVCKPIANFRFGENHAIMGLAFSWVMACSCSVPPLVGWSRYIPEGMQGGCGVDYYTRAEGSNNES' +
    'FVIYMFCVHFAVPLFIISFCYGRLLCAVKEAAAAQQESETTQRAEREVTRMVIVMVCSFLVTWLPYAGVAWWIFCNQGAEFGPLFVAIPSFFAKSSALYNL' +
    'IIYICMNKQFRHCMITTLCCGKNPFEEEEGASTTASKTEASSTSSVSPA',
  B4YA19:
    'MNGTEGPDFYVPMSNATGIVRSPYEYPRYYLVSPVAYFMLGSYMFFLILTCFPVNFLTLYVTIEHKKLRTALNYILLNLAVANLFMVFGGFTTTIYTCMNG' +
    'YFVLGRLGCNLEGFFATTGGEIALWSLVVLAVERYLVVCKPIESFRFGENHALMGLASSWIMAGTCSVPPLVGWSRYIPEGFQVACGIDYYTRAEGYNNES' +
    'FVIYMFILHFIIPMIVIFFCYGRLLCAVKEAAAAQQESETTQRAEREVTRLVIMMVVSYLVTWVPYASVAWYIFCNQGTNFGPIFMGLPIFFAKTSALFNP' +
    'VIYICMNKQFRHCIITTLCCGKNPFEDEEEGSTKTEASSVSPA',
  Q8JIH6:
    'MVNTTGIVRSPYEYPQHYLVSPAAYAALGAYMFFLILAGFPINFLTLYVTIEHKKLRTPLNYILLNLAVADLFMVFGGFTTTMYTSMHGYFVLGRLGCNLE' +
    'GFFATLGGEIGLWSLVVLAVERWLVVCKPISNFRFGENHAIMGLAFTWLAALSCAGPPLVGWSRYIPEGMQCSCGVDYYTRAEGFNNESFVIYMFICHFLI' +
    'PLTVVFFCYGRLLCAVKEAAAAQQESETTQRAEREVTRMVVIMVISFLICWLPYAGVAWYIFTHQGSEFGPVFMTLPAFFAKSSSIYNPLIYICMNKQFRH' +
    'CMITT',
  Q8JII5:
    'MTNTTGIVRSPYEYPQHYLVNPAAYAALGAYMFFLILVGFPINFLTLYVTIEHKKLRTPLNYILLNLAVADLFMVFGGFTTTIYTSMHGYFVLGRLGCNLE' +
    'GFFATLGGEIGLWSLVVLAIERWLVVCKPISNFRFGENHAIMGLAFTWVAALSCAAPPLVGWSRYIPEGMQVSCGVDYYTRAEGFNNESFVIYMFICHFMI' +
    'PLTVVFFCYGRLLCAVKEAAAAQQESETTQRAEREVTRMVIMMVISFLVCWLPYAGVAWFIFTHQGSEFGPVFMTLPSFFAKAAAIYNPIIYICMNKQFRH' +
    'CMITT',
  Q8JIG9:
    'MANTTGIVRSPYEYPQHYLVSPAAYAALAAYMFFLILVGFPINFLTLYVTIEHKKLRTPLNYILLNLAVADLFMVFGGFTTTIYTSMHGYFVLGRLGCNLE' +
    'GFFATLGGEIGLWSLVVLAIERWLVVCKPISNFRFGENHAIMGLAFTWVAACSCAVPPLVGWSRYIPEGMQCACGVDYYTRAEGFNNESFVIYMFVCHFSI' +
    'PLFIVFFCYGRLLCAVKEAAAAQQESETTQRAEREVTRMVIMMVISFLICWLPYASVAWYIFTHQGSEFGPVFMTLPSFFAKSSAIYNPVIYICMNKQFRH' +
    'CMITT',
  G9HXI2:
    'MNGTEGPFFYVPMSNASGMVRSPYEYPQYYLVSPAAYFVLAAYMFFLILTCFPVNFLTLYVTIEHKKLRTALNYVLLNLAVANLFMVIGGFTTTMYSSMNG' +
    'YFVLGRLGCNIEGFFATHGGEIALWSLVVLAIERYLVVCKPIANFRFGENHAIMGLAFTWVMASSCSVPPLVGWSRYIPEGMQVACGIDYYTRAPGYNNES' +
    'FVIYMFACHFAIPLVIISFCYGRLLCAVKEAAAAQQESETTQRAEREVSRMVVLMVCSFLICWLPYAGVAWWIFCNQGTEFGPIFMTAPSFFAKSSALYNP' +
    'LIYICMNKQFRHCMITTLCCGKNPFEEEEGASTTASKTEASSVSSSSVGP',
  G9HXK4:
    'PFFYVPMSNASGMVRSPYEYPQYYLVSPAAYFVMAAYMFFLIVTSLPVHFLTLYVTIEHKKLRTPLNYILLNLAVANLFMVFGGFTTTMYSSMHGYFVLGR' +
    'TGCNIEGFFATLGGEIALWALVVLAVERWVVVCKPISNFRFTENHAIMGVSLTWLMACACSVPPLVGWSRYIPEGMQCACGIDYYTRAPGVNNESFVIYMF' +
    'VCHFSIPLTIIFFCYGRLLCAVKEAAAAQQESESTQRAEREVTRMVVLMVIAFLICWLPYASVAWYIFTHQGSEFGPVFMTLPSFFAKSSAIYNPMIY',
  G9HXK1:
    'VNPAAYAALGAYMFLLILLGFPINFLTLYVTVQHKKLRTPLNYILLNLAVANLFMVFGGFTTTMYTSMHGYFILGRLGCNLEGFFATLGGEISLWSLVILA' +
    'IERWLVVCKPISNFRFGENHAIMGVSATWIMALTCAGPPLIGWSRYIPEGIQCSCGVDYFTRAEGFNNESFVIYMFLCHFTIPLTIVFFCYGRLLCAVKDA' +
    'AAAQQESETTQRAEKEVTRMVILMVIAFHICWLPYASVAWYSFTHHGAEIGPVVMTLPSFFAKSSAIYNPMIYICMNRQFRNCMI',
});

// ====================================================================================================
// ALIGNMENT, SO SITE NUMBERS MEAN THE SAME THING IN EVERY ROW
// ====================================================================================================
// Numbering drift is one of the four things THE_HARD_PART is about, so it is handled by alignment and not
// by an offset constant. Needleman-Wunsch, linear gap, no dependencies. Rod opsins are conserved enough
// that this is unambiguous in the transmembrane core where all the rule sites sit; it is NOT reliable in
// the termini, which is why alignmentQuality() is reported alongside every mapping.
const SCORE = Object.freeze({ match: 2, mismatch: -1, gap: -3 });

export function align(a, b) {
  const n = a.length, m = b.length;
  const H = new Int32Array((n + 1) * (m + 1));
  const w = m + 1;
  for (let i = 1; i <= n; i++) H[i * w] = i * SCORE.gap;
  for (let j = 1; j <= m; j++) H[j] = j * SCORE.gap;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const d = H[(i - 1) * w + (j - 1)] + (a[i - 1] === b[j - 1] ? SCORE.match : SCORE.mismatch);
      const u = H[(i - 1) * w + j] + SCORE.gap;
      const l = H[i * w + (j - 1)] + SCORE.gap;
      H[i * w + j] = d > u ? (d > l ? d : l) : (u > l ? u : l);
    }
  }
  // Traceback: map[i] = 0-based index into b aligned to a[i-1], or null for a gap.
  const map = new Array(n + 1).fill(null);
  let i = n, j = m, matches = 0, aligned = 0;
  while (i > 0 && j > 0) {
    const d = H[(i - 1) * w + (j - 1)] + (a[i - 1] === b[j - 1] ? SCORE.match : SCORE.mismatch);
    if (H[i * w + j] === d) {
      map[i] = j - 1; aligned++; if (a[i - 1] === b[j - 1]) matches++;
      i--; j--;
    } else if (H[i * w + j] === H[(i - 1) * w + j] + SCORE.gap) { i--; }
    else { j--; }
  }
  return { map, score: H[n * w + m], aligned, matches, identity: aligned ? matches / aligned : 0 };
}

const _alignCache = new Map();
function bovineAlignment(acc) {
  if (_alignCache.has(acc)) return _alignCache.get(acc);
  const seq = SEQUENCES[acc];
  if (!seq) throw new Error(`no embedded sequence for ${acc}`);
  const r = align(BOVINE_RH1_REFERENCE.sequence, seq);
  _alignCache.set(acc, r);
  return r;
}

export function alignmentQuality(acc) {
  const { aligned, matches, identity, score } = bovineAlignment(acc);
  return Object.freeze({
    accession: acc,
    aligned_positions: aligned,
    identical_positions: matches,
    identity_to_bovine: Number(identity.toFixed(4)),
    score,
    is_a_point_estimate_of_homology_not_of_function: true,
  });
}

/** Residue in `acc` aligned to position `site` of bovine P02699 (1-based bovine numbering). */
export function bovineSiteResidue(acc, site) {
  if (!Number.isInteger(site) || site < 1 || site > BOVINE_RH1_REFERENCE.length) {
    throw new Error(`site ${site} is outside bovine 1..${BOVINE_RH1_REFERENCE.length}`);
  }
  const { map } = bovineAlignment(acc);
  const idx = map[site];
  const seq = SEQUENCES[acc];
  return Object.freeze({
    accession: acc,
    bovine_site: site,
    bovine_residue: BOVINE_RH1_REFERENCE.sequence[site - 1],
    residue: idx === null ? null : seq[idx],
    position_in_this_sequence: idx === null ? null : idx + 1,
    covered: idx !== null,
    not_covered_reason: idx === null ? 'the sequence has a gap or a truncation at this bovine position; many entries here are partial' : null,
  });
}

/** What the rule needs: the residue at each rule site, and the substitution relative to bovine. */
export function siteProfile(acc, sites = RULE_SITES) {
  const rows = sites.map((s) => {
    const r = bovineSiteResidue(acc, s);
    return Object.freeze({
      ...r,
      substitution: r.covered && r.residue !== r.bovine_residue ? `${r.bovine_residue}${s}${r.residue}` : null,
      differs_from_bovine: r.covered ? r.residue !== r.bovine_residue : null,
    });
  });
  return Object.freeze({
    accession: acc,
    sites: Object.freeze(rows),
    substitutions_vs_bovine: Object.freeze(rows.filter((r) => r.substitution).map((r) => r.substitution)),
    uncovered_sites: Object.freeze(rows.filter((r) => !r.covered).map((r) => r.bovine_site)),
    alignment: alignmentQuality(acc),
  });
}

// ====================================================================================================
// THE PREDICTION. A BAND. THE POINT IS null AND STAYS null.
// ====================================================================================================
// Baseline: the two anchor measurements we actually hold for an unshifted rod pigment - bovine at 498 nm
// (Nathans 1990) and the ancestral rhodopsins at 500 nm (Yokoyama et al. 2008). Nothing between them is
// preferred, so the baseline is the interval.
export const BASELINE = deepFreeze({
  lo: 498, hi: 500, units: 'nm',
  from: ['nathans_1990 (bovine native, 498 nm)', 'yokoyama_2008_pnas (early ancestral rhodopsins, 500 nm)'],
  why_an_interval: 'Two retrieved measurements of a nominally unshifted rod pigment disagree by 2 nm, under different assays. Picking one would import a 2 nm bias into every prediction and hide it.',
});

/** Every retrieved RH1 shift value for a given substitution string, as a band. */
export function shiftBand(substitution) {
  const rows = SITE_SHIFTS.filter(
    (s) => s.pigment_class === 'RH1' && !s.shift.is_a_double_mutant &&
      (s.substitution === substitution || s.substitution.startsWith(`${substitution} `)),
  );
  const quantified = rows.filter((s) => typeof s.shift.value === 'number');
  if (!rows.length) {
    return Object.freeze({
      substitution, lo: null, hi: null, units: 'nm', n_sources: 0, quantified: false,
      null_reason: 'No source in this file reports any shift for this substitution in an RH1 background.',
      what_would_have_to_be_measured: `A single-mutant ${substitution} lambda-max against its own wild type, as two numbers.`,
    });
  }
  if (!quantified.length) {
    return Object.freeze({
      substitution, lo: null, hi: null, units: 'nm', n_sources: rows.length, quantified: false,
      directions: Object.freeze([...new Set(rows.map((s) => s.shift.sign))]),
      null_reason: rows.map((s) => s.shift.null_reason).filter(Boolean)[0] ?? 'Direction reported; magnitude not reported.',
      what_would_have_to_be_measured: rows.map((s) => s.shift.what_would_have_to_be_measured).filter(Boolean)[0] ?? null,
    });
  }
  const vals = quantified.flatMap((s) => (s.shift.range_nm ? s.shift.range_nm : [s.shift.value]));
  return Object.freeze({
    substitution, lo: Math.min(...vals), hi: Math.max(...vals), units: 'nm',
    n_sources: rows.length, n_quantified: quantified.length, quantified: true,
    backgrounds: Object.freeze(quantified.map((s) => s.background)),
    width_is_between_backgrounds: quantified.length > 1,
  });
}

export function naiveAdditivePrediction(acc) {
  const profile = siteProfile(acc);
  const contributions = profile.substitutions_vs_bovine.map((sub) => ({ substitution: sub, band: shiftBand(sub) }));
  const quantified = contributions.filter((c) => c.band.quantified);
  const unquantified = contributions.filter((c) => !c.band.quantified);
  const lo = BASELINE.lo + quantified.reduce((a, c) => a + c.band.lo, 0);
  const hi = BASELINE.hi + quantified.reduce((a, c) => a + c.band.hi, 0);
  return deepFreeze({
    accession: acc,
    point: null,
    score: null,
    lambda_max_nm: null,
    band: { lo: Math.min(lo, hi), hi: Math.max(lo, hi), units: 'nm' },
    baseline: BASELINE,
    substitutions_at_rule_sites: profile.substitutions_vs_bovine,
    quantified_contributions: quantified.map((c) => ({ substitution: c.substitution, lo: c.band.lo, hi: c.band.hi, units: 'nm' })),
    unquantified_substitutions: unquantified.map((c) => ({ substitution: c.substitution, why: c.band.null_reason })),
    n_unquantified: unquantified.length,
    uncovered_sites: profile.uncovered_sites,
    model: 'additive over RULE_SITES, shifts taken as published, no interaction terms',
    the_model_is_known_to_be_wrong_because:
      'Yokoyama & Radlwimmer 2001 needed an interaction term at their own two best sites (S180A/H197Y: singles -7 and -28, ' +
      'double +11), and Nathans 1990 measured no effect at all for 83 and 122 in bovine. Additivity is the model this ' +
      'benchmark is testing, not a model it believes.',
    why_no_point_estimate:
      'The band\'s width comes from the disagreement between published values for the SAME substitution in different ' +
      'backgrounds. A point would be a choice among those backgrounds, and the choice would be invisible one function ' +
      'call downstream. There is no fused scalar in this return value and there is not going to be one.',
    unknown_contributions_not_in_the_band: unquantified.length > 0
      ? `${unquantified.length} substitution(s) at rule sites have no published nm value we could retrieve, so the band is ` +
        'NARROWER THAN THE TRUE UNCERTAINTY, not wider. Read it as a lower bound on the spread.'
      : null,
  });
}

// ====================================================================================================
// RETRO-VALIDATION
// ====================================================================================================
// No fused score. Per-row verdicts from a closed vocabulary, and counts.
export const VERDICTS = deepFreeze(['inside-band', 'outside-band-blue', 'outside-band-red', 'no-prediction']);

export function retroValidate() {
  const rows = MEASURED.map((r) => {
    const p = naiveAdditivePrediction(r.uniprot);
    const m = r.lambda_max.value;
    let verdict;
    if (m === null) verdict = 'no-prediction';
    else if (m >= p.band.lo && m <= p.band.hi) verdict = 'inside-band';
    else if (m < p.band.lo) verdict = 'outside-band-blue';
    else verdict = 'outside-band-red';
    const miss = verdict === 'inside-band' ? 0
      : verdict === 'outside-band-blue' ? m - p.band.lo
      : verdict === 'outside-band-red' ? m - p.band.hi : null;
    return Object.freeze({
      id: r.id, organism: r.organism, group: r.group, accession: r.uniprot,
      measured_nm: m, band: p.band, verdict,
      miss_nm: miss === null ? null : Number(miss.toFixed(1)),
      substitutions_at_rule_sites: p.substitutions_at_rule_sites,
      n_unquantified: p.n_unquantified,
      method: r.method,
      dark_spectrum_obtained: r.dark_spectrum_obtained ?? true,
      secondary_quotation: r.secondary_quotation ?? false,
    });
  });
  const counts = Object.fromEntries(VERDICTS.map((v) => [v, rows.filter((r) => r.verdict === v).length]));
  const misses = rows.filter((r) => typeof r.miss_nm === 'number' && r.miss_nm !== 0).map((r) => Math.abs(r.miss_nm));
  return deepFreeze({
    n: rows.length,
    rows,
    counts,
    worst_miss_nm: misses.length ? Math.max(...misses) : 0,
    median_abs_miss_nm: misses.length ? misses.sort((a, b) => a - b)[Math.floor(misses.length / 2)] : 0,
    n_rows_with_no_rule_site_substitution: rows.filter((r) => r.substitutions_at_rule_sites.length === 0).length,
    headline:
      'Rows scored, per-row verdicts from a closed vocabulary, and the worst miss in nanometres. No aggregate accuracy ' +
      'figure is returned, because the interesting structure is which rows miss and in which direction.',
    fused_scalar: null,
    accuracy: null,
    what_a_hit_does_not_show:
      'A row landing inside the band is weak evidence: the band is wide by construction, it is built from values fitted on ' +
      'an overlapping set of species, and rows with unquantified substitutions have bands that are too narrow for the ' +
      'wrong reason. Read the misses, not the hits.',
    what_is_excluded:
      `${DROPPED_ROWS.length} rows with real published lambda-max values were dropped for unresolvable accessions or ` +
      `secondary provenance, and ${CROSS_STUDY_PAIRINGS.length} cross-study pairings are quarantined. Including them would ` +
      'change these counts.',
  });
}

// ====================================================================================================
// THE HARD PART
// ====================================================================================================
export const THE_HARD_PART = deepFreeze({
  headline:
    'Site-based lambda-max prediction looks like physics and acts like a correlation. The five-site rule is real, it is ' +
    'well measured, and it is a statement about substitutions IN THE BACKGROUNDS THEY WERE MEASURED IN. Every step from ' +
    'there to "predict this pigment from its sequence" is a step the data does not license.',

  epistasis: [
    'The site rule is additive. Its own authors needed a non-additive term to fit it: in Yokoyama & Radlwimmer 2001 the ' +
      'singles S180A and H197Y are -7 and -28 nm, so additivity predicts -35 nm for the pair, and the fitted double term ' +
      'is +11 nm. The interaction is bigger than four of the five single effects.',
    'The same substitution has different magnitudes in different species measured in ONE paper with ONE assay. Sugawara et ' +
      'al. 2005 measured D83N at about 8 nm in Baileychromis centropomoides and at 2-4 nm - "close to the measurement ' +
      'error" - in other cichlids. Same substitution, same site, same laboratory, same instrument, a factor of three.',
    'A292S is reported at -14 nm in one background (Sugawara et al. 2005, in Oreochromis niloticus) and at about -10 nm as ' +
      'a general statement (Yokoyama et al. 2008). Both are in SITE_SHIFTS and neither is averaged away.',
    'The hardest version: Nathans 1990 built bovine mutants at 83 and 122 and found NO significant spectral effect, ' +
      'concluding in the paper itself that these residues do not tune the spectrum. Two of the five canonical sites were ' +
      'measured as inert in the one background everyone numbers from. The rule and its counterexample are the same ' +
      'literature.',
    'The magnitude of opsin epistasis has been measured directly, in a different pigment class: of the 5,040 orderings of ' +
      'the seven mutations that convert an ancestral mammalian SWS1 pigment from UV- to blue-sensitive, Yokoyama et al. ' +
      '2014 find 4,008 pass through a dehydrated nonfunctional pigment. Roughly four fifths of paths through a seven-step ' +
      'mutational space are blocked. Independence of sites is not a mild approximation in this protein family.',
  ],

  numbering_drift: [
    'Every site label in this file is a bovine P02699 coordinate, and no sequence here is bovine. Fish RH1 sequences in ' +
      'MEASURED run 308-354 residues against bovine\'s 348, so a bare integer does not transfer and an offset constant ' +
      'would be wrong for at least some rows.',
    'This module therefore aligns rather than offsets, and reports alignmentQuality() with every mapping. In the ' +
      'transmembrane core, where all the rule sites sit, the alignment is unambiguous. It is not reliable in the termini.',
    'Four entries in SEQUENCES are explicitly PARTIAL (the three cichlids at 308 residues, and two of the quarantined ' +
      'entries at 287 and 300). A partial entry can silently fail to cover a rule site, which is why bovineSiteResidue() ' +
      'returns `covered: false` and a reason instead of a residue.',
    'The literature itself drifts: Hunt et al. 2001 name site 208, while the RH1/RH2 literature from the same period ' +
      'names 207. Nothing here resolves that; both numbers appear in EXTENDED_SITES exactly as their sources give them.',
  ],

  method_differences: [
    'MEASURED mixes three assays. Nine rows are in vitro regeneration with 11-cis-retinal; of those, two are DARK-LIGHT ' +
      'DIFFERENCE SPECTRA where the paper states a dark spectrum was not obtained. One row is microspectrophotometry of ' +
      'rod photoreceptors. One is a photobleaching difference spectrum in digitonin with hydroxylamine.',
    'The disagreement between assays is not small relative to what we are predicting. Bovine rhodopsin is 498 nm in ' +
      'Nathans 1990 and the ancestral rhodopsins are 500 nm in Yokoyama et al. 2008; that 2 nm is comparable to the whole ' +
      'measured effect of D83N in most of the cichlids. The prediction baseline is an interval for exactly this reason.',
    'Chromophore identity is a further confound this file does not control. Sugawara et al. 2005 assume an A1-derived ' +
      'chromophore from an A1:A2 ratio measured in two species; MSP of a live retina measures whatever chromophore that ' +
      'retina is using. An A1/A2 difference moves lambda-max by more than several of the site effects.',
    'Stated precisions differ by row. The cichlid rows carry +/-1 to +/-2 nm from the paper; the Yokoyama rows are printed ' +
      'as integers with no interval. A residual of 3 nm means different things in the two halves of the table.',
  ],

  overlapping_fit: [
    'The site rules were fitted on sequence/lambda-max pairs from a set of species that OVERLAPS the set scored here. ' +
      'Yokoyama et al. 2008 is both the source of eight MEASURED rows and the source of several SITE_SHIFTS values. ' +
      'Scoring the rule on those rows is closer to measuring the fit\'s residual than to testing a prediction.',
    'This is a leakage problem with no clean fix inside this data, because the comparative literature on RH1 is small and ' +
      'the same laboratories produced both the sequences and the rules. The honest statement is that retroValidate() ' +
      'reports IN-SAMPLE residuals for part of its table, and the per-row `source` field is what lets a reader see which ' +
      'rows those are.',
    'It gets worse in the direction that flatters the method: the rows whose provenance is cleanest are the ones from the ' +
      'paper that also supplied the rule.',
    'The one same-species pair in the table - Lepidopus fitchi RH1-A at 507 nm and RH1-B at 481 nm, 26 nm apart with the ' +
      'genetic background as close as comparative data gets - is the single most informative comparison here, and it comes ' +
      'from that same paper.',
  ],

  and_the_rule_was_never_claimed_to_do_this:
    'Hunt et al. 2001 sequenced rod opsins from 28 deep-sea species and stated plainly that the clustering of lambda-max ' +
    'values "does not involve a common subset of these substitutions in the different species". The people who built the ' +
    'site lists reported, in the abstract, that the sites do not combine the same way twice. The over-claim is downstream ' +
    'of them, and this module is downstream of them, so the over-claim would be ours.',

  what_would_make_this_a_real_benchmark: [
    'A held-out species set measured after the rule was fixed, by one assay, with one chromophore, reported with intervals.',
    'Single-mutant values for E122Q and M207L in a stated RH1 background, as two numbers each - the two conspicuous nulls here.',
    'The same substitution measured in five or more backgrounds, which would turn shiftBand() from a two-value range into ' +
      'a distribution and make the band mean something.',
    'Resolvable accessions for the dropped rows, starting with the coelacanth RH1 - the most-cited blue shift in this ' +
      'literature and absent from our scoring table.',
  ],
});

export const WHAT_THIS_IS = deepFreeze(
  'Measured rod opsin (RH1) absorption maxima for mammals and fishes, with the published per-site spectral shifts that are ' +
  'supposed to predict them, every number traceable to a source retrieved in-session, and a prediction function that ' +
  'returns a band and refuses a point. It exists to be scored against, including when it fails.',
);

// ====================================================================================================
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') ?? '\u0000')) {
  const v = retroValidate();
  console.log(`\nopsin retro-validation: ${v.n} rows (mammals and fishes only)\n`);
  for (const r of v.rows) {
    const subs = r.substitutions_at_rule_sites.join(',') || '(none at rule sites)';
    console.log(
      `  ${r.verdict.padEnd(19)} ${String(r.measured_nm).padStart(3)} nm  band [${r.band.lo}, ${r.band.hi}]  ` +
      `miss ${String(r.miss_nm).padStart(5)}  ${r.organism} (${r.accession})  ${subs}`,
    );
  }
  console.log(`\n  counts: ${JSON.stringify(v.counts)}`);
  console.log(`  worst miss: ${v.worst_miss_nm} nm   median |miss|: ${v.median_abs_miss_nm} nm`);
  console.log(`  rows with no substitution at any rule site: ${v.n_rows_with_no_rule_site_substitution}`);
  console.log(`\n  ${v.what_a_hit_does_not_show}`);
  console.log(`  ${v.what_is_excluded}\n`);
}
