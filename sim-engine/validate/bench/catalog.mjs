// THE CATALOGUE: real vendors, real catalogue numbers, real published LIST prices.
//
// ============================== THE RULE THIS FILE OBEYS ==============================
// A price with no read date and no `sourced: true` is not in this file. Not as an estimate, not as a
// recalled figure, not as "about". Where a vendor publishes no price, the row stays, `unit_price_usd` is
// null, and `why_unsourced` says what happened - because a quote-only item is a real budget line and
// dropping it would make the total look smaller than the experiment is.
//
// A WEAKER SPOT, DISCLOSED RATHER THAN HIDDEN: not every priced row carries a direct product URL. The
// primary vendor pages do; several reseller lines (the Fisher-distributed consumables and bulk salts)
// were read from that vendor's catalogue but their individual product URLs were not recorded. Those rows
// are still marked sourced and dated, because the price WAS read - but they are one step harder for a
// reader to re-check than a row with a link. `provenanceGaps()` lists exactly which ones, and the module
// reports the count rather than letting it pass unnoticed.
//
// EVERY PRICE HERE IS A LIST PRICE. Academic institutions buy on contract and pay less, often much less.
// Nothing in this file is a quote, and the budget that consumes it says so on every total.
//
// ============================== THINGS THAT WOULD HAVE GONE WRONG ==============================
// Found while sourcing, each of which a plausible-looking guess would have got wrong:
//   * IDT's guide RNAs have NO catalogue number at all - they are custom syntheses priced by scale. That
//     is a genuine problem for an ordering portal, where a line with no supplier part number silently
//     degrades to free text at list price. Flagged per row, not smoothed over.
//   * The Eppendorf Microloader part number everyone cites (5242956003) is dead: Eppendorf's own search
//     returns nothing and the reseller listing says discontinued. Micromanipulation moved to another
//     distributor in May 2023.
//   * NEB T1030 was replaced by T1130 in December 2024. A stale bill of materials orders a dead SKU.
//   * Addgene's own record calls the Hwang 2013 plasmid "DR274", not "pDR274" - searching a portal for
//     "pDR274" may miss it.
//   * A 120 nt repair template cannot be ordered as a standard oligo at any price: the standard scales
//     stop at 90-100 bases, so it must be an Ultramer. The price break is between product lines, not
//     within one.
// Sigma-Aldrich could not be read at all (the site refuses automated and ordinary browser reads alike),
// so the one Sigma item here carries NO number and NO price, and names a substitute that does.

export const PRICE_BASIS =
  'Every price is a PUBLIC LIST PRICE in USD, read from the vendor\'s own page on the date in `read_on`. ' +
  'Academic and non-profit institutions buy on contract and pay less. No price here is a quote, none ' +
  'includes shipping, tax or surcharges, and none should be presented to a finance office as a cost.';

export const READ_ON = '2026-11-04';

export const CATALOG = [
  // ---------------------------------------------------------------- guides
  { id: 'crrna-idt', what: 'Alt-R CRISPR-Cas9 crRNA (target-specific half of the two-part guide system)',
    vendor: 'IDT', catalogue_number: null, no_catalogue_number_because: 'custom synthesis priced by scale; IDT issues no catalogue number for guide RNAs',
    pack_size: 2, pack_unit: 'nmol', uom: 'EA', unit_price_usd: 96.00, read_on: READ_ON, sourced: true,
    url: 'https://www.idtdna.com/pages/products/crispr-genome-editing/alt-r-crispr-cas9-system',
    note: 'pairs with one tracrRNA purchase, which is amortised across every target. The economical route for a series of guides.' },
  { id: 'tracrrna-idt', what: 'Alt-R CRISPR-Cas9 tracrRNA (universal half; one purchase serves every crRNA)',
    vendor: 'IDT', catalogue_number: '1072532', pack_size: 5, pack_unit: 'nmol', uom: 'EA',
    unit_price_usd: 112.00, read_on: READ_ON, sourced: true,
    url: 'https://www.idtdna.com/pages/products/crispr-genome-editing/alt-r-crispr-cas9-system',
    alternatives: [{ catalogue_number: '1072533', pack_size: 20, unit_price_usd: 223.00 }, { catalogue_number: '1072534', pack_size: 100, unit_price_usd: 568.00 }] },
  { id: 'sgrna-synthego', what: 'synthetic single-guide RNA, tube format',
    vendor: 'Synthego', catalogue_number: null, no_catalogue_number_because: 'custom synthesis; no catalogue number shown',
    pack_size: 1.5, pack_unit: 'nmol', uom: 'EA', unit_price_usd: 84.00, read_on: READ_ON, sourced: true,
    url: 'https://www.synthego.com/products/crispr-kits/synthetic-sgrna',
    note: 'the cheapest single synthetic guide found at a usable scale. Scales above 200 nmol require a quote.' },
  { id: 'sgrna-idt', what: 'Alt-R CRISPR-Cas9 single-guide RNA, standard desalt',
    vendor: 'IDT', catalogue_number: null, no_catalogue_number_because: 'custom synthesis priced by scale',
    pack_size: 2, pack_unit: 'nmol', uom: 'EA', unit_price_usd: 130.00, read_on: READ_ON, sourced: true,
    url: 'https://www.idtdna.com/pages/products/crispr-genome-editing/alt-r-crispr-cas9-system',
    note: 'IDT states its predesigned guides are guaranteed for zebrafish among a short list of species.' },

  // ---------------------------------------------------------------- nuclease
  { id: 'cas9-idt', what: 'Alt-R S.p. Cas9 Nuclease V3 (nuclear localisation signals and C-terminal 6-His tag)',
    vendor: 'IDT', catalogue_number: '1081058', pack_size: 100, pack_unit: 'ug', uom: 'EA',
    unit_price_usd: 223.00, read_on: READ_ON, sourced: true,
    url: 'https://www.idtdna.com/pages/products/crispr-genome-editing/alt-r-crispr-enzymes/cas9-protein',
    pmol_per_pack: 610, note: '100 ug = 610 pmol, so about $0.37 per pmol.',
    alternatives: [{ catalogue_number: '1081059', pack_size: 500, unit_price_usd: 865.00 }] },
  { id: 'cas9-neb', what: 'EnGen Spy Cas9 NLS',
    vendor: 'NEB', catalogue_number: 'M0646T', pack_size: 500, pack_unit: 'pmol', uom: 'EA',
    unit_price_usd: 170.00, read_on: READ_ON, sourced: true,
    url: 'https://www.neb.com/en-us/products/m0646-engen-spy-cas9-nls',
    note: 'about $0.34 per pmol, the lowest cost per pmol found. Compare on pmol, not on mass - the vendors quote different units and a mass comparison misleads.',
    alternatives: [{ catalogue_number: 'M0646M', pack_size: 2500, unit_price_usd: 678.00 }] },
  { id: 'cas9-thermo', what: 'TrueCut Cas9 Protein v2',
    vendor: 'Thermo Fisher', catalogue_number: 'A36496', pack_size: 10, pack_unit: 'ug', uom: 'EA',
    unit_price_usd: 78.75, read_on: READ_ON, sourced: true,
    url: 'https://www.thermofisher.com/order/catalog/product/A36496',
    note: 'lowest absolute price, smallest pack. $78.75 is the list price; the page also showed a lower online price.' },

  // ---------------------------------------------------------------- repair template (knock-in only)
  { id: 'ultramer-idt', what: 'Ultramer DNA Oligo, for a repair template of 45-200 bases',
    vendor: 'IDT', catalogue_number: null, no_catalogue_number_because: 'custom synthesis priced per base',
    pack_size: 4, pack_unit: 'nmol', uom: 'EA', unit_price_usd: null, price_per_base_usd: 1.05, read_on: READ_ON, sourced: true,
    url: 'https://www.idtdna.com/pages/products/custom-dna-rna/dna-oligos/ultramer-dna-oligos',
    priced_by: 'length', phosphorothioate_per_bond_usd: 4.51,
    note: 'A 120 nt donor costs $126.00; with the usual four phosphorothioate bonds (two per end) $144.04. There is NO price break within the Ultramer range - it is flat per base. The break is between product lines: standard oligo scales stop at 90-100 bases, so a 120 nt donor cannot be ordered as a standard oligo at all.' },
  { id: 'hdr-donor-idt', what: 'Alt-R HDR Donor Oligo (enhanced Ultramer built for homology-directed repair, up to 200 bases)',
    vendor: 'IDT', catalogue_number: null, no_catalogue_number_because: 'custom synthesis priced by scale',
    pack_size: 2, pack_unit: 'nmol', uom: 'EA', unit_price_usd: 161.00, read_on: READ_ON, sourced: true,
    url: 'https://www.idtdna.com/pages/products/crispr-genome-editing/alt-r-hdr-donor-oligos',
    note: 'priced by scale only, with no per-bond modification surcharge listed - so the phosphorothioate and proprietary patterns appear to be included. That is a reading of the price table\'s STRUCTURE, not something IDT states in words. For a 120 nt donor this costs more than a plain Ultramer plus four phosphorothioate bonds ($161 against $144.04).' },

  // ---------------------------------------------------------------- genotyping primers and PCR
  { id: 'primers-idt', what: 'custom DNA oligo, 25 nmole scale, standard desalt (genotyping and sequencing primers)',
    vendor: 'IDT', catalogue_number: null, no_catalogue_number_because: 'custom synthesis priced per base',
    pack_size: 25, pack_unit: 'nmol', uom: 'EA', unit_price_usd: null, price_per_base_usd: 0.47, read_on: READ_ON, sourced: true,
    url: 'https://www.idtdna.com/pages/products/custom-dna-rna/dna-oligos/custom-dna-oligos',
    priced_by: 'length', length_limits: '15-60 bases at this scale',
    note: 'a 20-mer is $9.40, so a primer pair is $18.80.' },
  { id: 'q5-neb', stock_item: true, what: 'Q5 High-Fidelity DNA Polymerase (proofreading, for amplicons that will be sequenced)',
    vendor: 'NEB', catalogue_number: 'M0491S', pack_size: 100, pack_unit: 'units', uom: 'EA',
    unit_price_usd: 138.00, read_on: READ_ON, sourced: true, url: 'https://www.neb.com/en-us/products/m0491-q5-high-fidelity-dna-polymerase' },
  { id: 'cleanup-neb', stock_item: true, what: 'Monarch Spin PCR & DNA Cleanup Kit (5 ug)',
    vendor: 'NEB', catalogue_number: 'T1130S', pack_size: 50, pack_unit: 'preps', uom: 'EA',
    unit_price_usd: 107.00, read_on: READ_ON, sourced: true, url: 'https://www.neb.com/en-us/products/t1130-monarch-spin-pcr-dna-cleanup-kit',
    supersedes: 'T1030, discontinued 2024-12-02. A bill of materials copied from an older protocol will order a dead SKU.' },

  // ---------------------------------------------------------------- in-house guide synthesis (the cheap route)
  { id: 'engen-sgrna-kit', stock_item: true, what: 'EnGen sgRNA Synthesis Kit, S. pyogenes (oligo template straight to sgRNA)',
    vendor: 'NEB', catalogue_number: 'E3322V', pack_size: 10, pack_unit: 'reactions', uom: 'EA',
    unit_price_usd: 263.00, read_on: READ_ON, sourced: true, url: 'https://www.neb.com/en-us/products/e3322-engen-sgrna-synthesis-kit-s-pyogenes',
    note: '$26.30 per guide against $84-130 for a synthetic one. The counterweight, from IDT\'s own published data: in-vitro-transcribed guides triggered innate immune stress genes in cultured human cells where chemically modified guides did not. That matters less in embryos than in primary cells, but it is a real trade-off and not only a price one.' },
  { id: 'hiscribe-neb', stock_item: true, what: 'HiScribe T7 High Yield RNA Synthesis Kit',
    vendor: 'NEB', catalogue_number: 'E2040S', pack_size: 50, pack_unit: 'reactions', uom: 'EA',
    unit_price_usd: 270.00, read_on: READ_ON, sourced: true, url: 'https://www.neb.com/en-us/products/e2040-hiscribe-t7-high-yield-rna-synthesis-kit',
    note: '$5.40 per reaction - the cheapest guide route of all, at the cost of making and purifying the template yourself.' },

  // ---------------------------------------------------------------- injection consumables
  { id: 'capillaries', stock_item: true, what: 'thin-wall borosilicate capillaries with filament, 1.00/0.78 mm',
    vendor: 'Fisher Scientific (reselling Sutter)', catalogue_number: 'NC9955576', supplier_part_number: 'FGGBF1007810',
    pack_size: 250, pack_unit: 'each', uom: 'PK', unit_price_usd: 98.57, read_on: READ_ON, sourced: true,
    note: 'Sutter itself publishes NO prices for any of its roughly seventy glass products - quotation only. This is the reseller line, which is what a portal can actually order.' },
  { id: 'microloaders', stock_item: true, what: 'microloader tips for back-filling injection needles',
    vendor: 'World Precision Instruments', catalogue_number: '506029', pack_size: 192, pack_unit: 'tips (2 x 96)', uom: 'PK',
    unit_price_usd: 315.00, read_on: READ_ON, sourced: true,
    replaces: 'the Eppendorf part number cited in most protocols (5242956003) is DEAD: Eppendorf\'s own site returns no result for it, its product page 404s, and the reseller listing says discontinued by the supplier. Eppendorf micromanipulation moved to another distributor in May 2023.' },
  { id: 'injection-mould', stock_item: true, what: 'microinjection mould for aligning embryos',
    vendor: 'Fisher Scientific (reselling Adaptive Science Tools)', catalogue_number: 'NC0771399', supplier_part_number: 'TU1',
    pack_size: 1, pack_unit: 'each', uom: 'EA', unit_price_usd: 58.75, read_on: READ_ON, sourced: true,
    alternatives: [{ vendor: 'World Precision Instruments', catalogue_number: 'Z-MOLDS', what: 'zebrafish microinjection and transplantation moulds', unit_price_usd: 278.00 }] },
  { id: 'agarose', stock_item: true, what: 'UltraPure Agarose (injection plates)',
    vendor: 'Thermo Fisher (Invitrogen)', catalogue_number: '16500100', pack_size: 100, pack_unit: 'g', uom: 'EA',
    unit_price_usd: 272.00, read_on: READ_ON, sourced: true, url: 'https://www.thermofisher.com/order/catalog/product/16500100' },
  { id: 'phenol-red', stock_item: true, what: 'phenol red solution, to make the injected bolus visible',
    vendor: 'MP Biomedicals (via Fisher Scientific)', catalogue_number: 'MP091690049', pack_size: 100, pack_unit: 'mL', uom: 'EA',
    unit_price_usd: 129.00, read_on: READ_ON, sourced: true,
    note: 'The Sigma-Aldrich part number cited in most protocols could NOT be verified: sigmaaldrich.com refuses to serve its product and search pages to automated readers AND to an ordinary signed-out browser session. Neither its number nor its price is confirmed here, so this substitute is listed instead. Any Sigma price for this item seen elsewhere is hearsay until someone reads it by hand.' },

  // ---------------------------------------------------------------- embryo medium salts
  { id: 'nacl', stock_item: true, what: 'sodium chloride (E3 medium)', vendor: 'Fisher Scientific', catalogue_number: 'BP358-212', pack_size: 2.5, pack_unit: 'kg', uom: 'EA', unit_price_usd: 172.60, read_on: READ_ON, sourced: true, note: 'list price; the page also showed a lower promotional price.' },
  { id: 'kcl', stock_item: true, what: 'potassium chloride (E3 medium; also the injection-mix salt whose concentration governs Cas9 solubility)', vendor: 'Fisher Scientific', catalogue_number: 'BP366-500', pack_size: 500, pack_unit: 'g', uom: 'EA', unit_price_usd: 169.00, read_on: READ_ON, sourced: true },
  { id: 'mgso4', stock_item: true, what: 'magnesium sulfate heptahydrate (E3 medium)', vendor: 'Fisher Scientific', catalogue_number: 'M63-500', pack_size: 500, pack_unit: 'g', uom: 'EA', unit_price_usd: 401.50, read_on: READ_ON, sourced: true },
  { id: 'cacl2', stock_item: true, what: 'calcium chloride dihydrate (E3 medium)', vendor: 'Fisher Scientific', catalogue_number: 'C79-500', pack_size: 500, pack_unit: 'g', uom: 'EA', unit_price_usd: 286.50, read_on: READ_ON, sourced: true },
  { id: 'methylene-blue', stock_item: true, what: 'methylene blue (added to embryo medium to suppress mould)', vendor: 'Fisher Scientific', catalogue_number: 'M291-25', pack_size: 25, pack_unit: 'g', uom: 'EA', unit_price_usd: 242.00, read_on: READ_ON, sourced: true },

  // ---------------------------------------------------------------- readout services
  { id: 'sanger-eurofins', what: 'Sanger sequencing reaction, tube format',
    vendor: 'Eurofins Genomics', catalogue_number: null, no_catalogue_number_because: 'a service, not a stocked item',
    pack_size: 1, pack_unit: 'reaction', uom: 'EA', unit_price_usd: 9.30, read_on: READ_ON, sourced: true,
    note: 'the only commercial per-reaction Sanger LIST price readable on a vendor page. Plate format is $5.60 per reaction with a 24-sample minimum. Search engines still cache an older $8.35 tube price; that is stale.',
    alternatives: [{ what: 'plate format, minimum 24 samples', unit_price_usd: 5.60 }] },
  { id: 'amplicon-plasmidsaurus', what: 'amplicon genotyping: allele composition and frequency at a single locus',
    vendor: 'Plasmidsaurus', catalogue_number: null, no_catalogue_number_because: 'a service',
    pack_size: 1, pack_unit: 'sample', uom: 'EA', unit_price_usd: 30.00, read_on: READ_ON, sourced: true,
    note: 'no minimum batch size, one to two day turnaround. This answers the question a crispant experiment actually asks - what alleles, at what frequency - which is why it is the default readout line here.' },
  { id: 'amplicon-genewiz', what: 'Amplicon-EZ amplicon sequencing, about 50,000 reads',
    vendor: 'GENEWIZ from Azenta', catalogue_number: null, no_catalogue_number_because: 'a service',
    pack_size: 1, pack_unit: 'sample', uom: 'EA', unit_price_usd: 58.00, read_on: READ_ON, sourced: true,
    price_is_a_floor: 'the page says "as low as $58 per sample", so this is a floor and not a firm price',
    note: 'no minimum sample number. Roughly double the Plasmidsaurus line but with far more reads. There is NO service called "CRISPR-EZ" on any readable page - the real one is named High-Throughput Genotyping / CRISPR Validation and is unpriced.' },

  // ---------------------------------------------------------------- plasmids
  { id: 'addgene-pt3ts-ncas9n', what: 'pT3TS-nCas9n (zebrafish-codon-optimised, nuclear-localised Cas9 mRNA template)',
    vendor: 'Addgene', catalogue_number: '46757', pack_size: 1, pack_unit: 'plasmid (agar stab)', uom: 'EA',
    unit_price_usd: 94.00, read_on: READ_ON, sourced: true, url: 'https://www.addgene.org/46757/',
    verified_against_the_record: true,
    citation: 'Jao, Wente & Chen 2013, PNAS 110:13904-13909, doi 10.1073/pnas.1308335110',
    note: 'academic/non-profit price. Flagged on the record as Academic/Nonprofit Terms, so not available to industry. SHIPPING IS NOT PUBLISHED and must stay as to-be-determined rather than guessed.',
    only_needed_if: 'you are running the Cas9 mRNA route rather than protein. The RNP route needs no plasmid at all.' },
  { id: 'addgene-dr274', what: 'DR274 (T7 sgRNA expression vector)',
    vendor: 'Addgene', catalogue_number: '42250', pack_size: 1, pack_unit: 'plasmid (agar stab)', uom: 'EA',
    unit_price_usd: 94.00, read_on: READ_ON, sourced: true, url: 'https://www.addgene.org/42250/',
    verified_against_the_record: true,
    citation: 'Hwang et al. 2013, Nat Biotechnol 31:227-229, doi 10.1038/nbt.2501',
    note: 'Addgene\'s own record names it "DR274", NOT "pDR274" as the protocol literature writes it. Searching a portal for "pDR274" may return nothing.',
    only_needed_if: 'you are transcribing guides from a vector rather than from an annealed-oligo template or buying them synthetic.' },

  // ---------------------------------------------------------------- the overexpression route (Tol2)
  // Added 2026-11-06 with the kcnk5b-overexpression-f0 case. Prices read on that date, not on READ_ON.
  { id: 'addgene-tol2-transposase', what: 'pCS2FA CO Tol2 TPase (codon-optimised Tol2 transposase; template for transposase mRNA)',
    vendor: 'Addgene', catalogue_number: '133032', pack_size: 1, pack_unit: 'plasmid (agar stab)', uom: 'EA',
    unit_price_usd: 94.00, read_on: '2026-11-06', sourced: true, url: 'https://www.addgene.org/133032/',
    verified_against_the_record: true,
    depositing_lab: 'Charles Nathan Hancock, University of South Carolina Aiken',
    citation: 'Mackey et al. 2020, microPublication Biology',
    availability: 'ACADEMICS AND NONPROFITS ONLY. The record states "Not Available to Industry", so a company cannot order this line at all and needs a different transposase source.',
    note: 'This is NOT the pCS2FA-transposase of the Tol2kit (Kwan et al. 2007, Dev Dyn 236:3088-3099), which is distributed from the Tol2kit itself rather than under this number. A codon-optimised transposase is not the same reagent as the original clone, and a lab reproducing Perathoner 2014 exactly should obtain the clone that paper used.',
    only_needed_if: 'you are making your own transposase mRNA. A lab with transposase mRNA in the freezer needs neither this nor the transcription kit.',
    shipping: 'calculated at checkout from the destination and never published; stays to-be-determined.' },
  { id: 'mmessage-sp6', what: 'mMESSAGE mMACHINE SP6 Transcription Kit (capped mRNA synthesis, for transposase mRNA)',
    vendor: 'Thermo Fisher Scientific (Invitrogen)', catalogue_number: 'AM1340', pack_size: 25, pack_unit: 'reaction', uom: 'EA',
    unit_price_usd: 578.00, read_on: '2026-11-06', sourced: true,
    url: 'https://www.thermofisher.com/order/catalog/product/AM1340',
    note: 'One kit is 25 reactions and a single reaction makes far more transposase mRNA than one injection session needs, so the leftover field will dominate this line. It is the single most expensive item in the overexpression route and the first thing to borrow rather than buy.',
    stock_item: true,
    stock_item_because: 'a kit of this kind is general molecular biology equipment in any lab that makes mRNA; it is not specific to this experiment.' },
  { id: 'construct-ef1a-kcnk5b', what: 'ef1a:kcnk5b + ef1a:DsRed Tol2 donor plasmid (and the ef1a:DsRed-only control plasmid)',
    vendor: null, catalogue_number: null, no_catalogue_number_because: 'not deposited in any repository that could be read',
    pack_size: 1, pack_unit: 'plasmid', uom: 'EA', unit_price_usd: null, read_on: '2026-11-06', sourced: false,
    why_unsourced:
      'The construct is not in Addgene or any other searchable repository. In the source paper it was built from two gift plasmids ' +
      '(Ale237 from A. Mongera and 587jk from J. Krauss) and the non-conductive variant was made by PCR mutagenesis. So this line is ' +
      'either a request to the corresponding author of Perathoner et al. 2014 (free, but on their timetable and subject to an MTA), ' +
      'or a cloning project of three constructs: wild-type, the DsRed-only control, and the GFG->AAA specificity control.',
    consequence: 'ANY budget for this route is a LOWER BOUND until this line is resolved. It is the one line that cannot be priced and cannot be skipped.',
    citation: 'Perathoner et al. 2014, Materials and Methods, "Cloning of overexpression vectors", doi 10.1371/journal.pgen.1004080' },
];

/** Vendors that publish nothing, and sites that cannot be read. This is as much a deliverable as the
 *  prices: it tells a lab which lines will need a phone call before the order can be placed. */
export const UNPRICEABLE = [
  { vendor: 'Sigma-Aldrich / MilliporeSigma', problem: 'the site refuses to serve product and search pages to automated readers and to an ordinary signed-out browser alike', consequence: 'no Sigma catalogue number or price is asserted anywhere in this file' },
  { vendor: 'Sutter Instrument', problem: 'publishes a full catalogue with no prices at all; quotation only', consequence: 'the capillary line uses the reseller equivalent, which a portal can order' },
  { vendor: 'Azenta', problem: 'blocks automated reads entirely', consequence: 'the amplicon line comes from genewiz.com, the same company\'s other site' },
  { vendor: 'GENEWIZ (Sanger), GenScript (guides), Thermo (several pack sizes)', problem: 'price behind sign-in or a design tool', consequence: 'quote-required lines, carried in the bill of materials with a null price so the total declares itself a lower bound' },
  { vendor: 'Addgene (shipping)', problem: 'shipping is calculated at checkout from the destination and is never published', consequence: 'every Addgene line carries shipping as to-be-determined' },
];

export function item(id) { return CATALOG.find(c => c.id === id) ?? null; }

/** Priced rows a reader cannot re-check from a link in this file. Disclosed, not hidden. */
export function provenanceGaps() {
  const priced = CATALOG.filter(c => c.unit_price_usd != null || c.price_per_base_usd != null);
  const noUrl = priced.filter(c => !c.url);
  return {
    n_priced: priced.length,
    n_without_a_direct_url: noUrl.length,
    rows: noUrl.map(c => ({ id: c.id, vendor: c.vendor, catalogue_number: c.catalogue_number })),
    what_this_means: 'the price was read on the date given, but this file does not carry a link straight to it. To re-check one, search the vendor catalogue for the catalogue number shown.',
  };
}

/** Price one line, handling the two ways things are sold: by the pack, and by the base. */
export function priceLine(id, { packs = 1, bases = null, phosphorothioate_bonds = 0 } = {}) {
  const it = item(id);
  if (!it) return null;
  if (it.priced_by === 'length') {
    if (!(bases > 0)) return { ...it, packs, extended_price_usd: null, why_unpriced: 'priced per base, and no length was given' };
    const synth = bases * it.price_per_base_usd;
    const mods = (phosphorothioate_bonds || 0) * (it.phosphorothioate_per_bond_usd ?? 0);
    return { ...it, packs, bases, unit_price_usd: +(synth + mods).toFixed(2), extended_price_usd: +((synth + mods) * packs).toFixed(2),
      derivation: `${bases} bases x $${it.price_per_base_usd}/base${mods ? ` + ${phosphorothioate_bonds} phosphorothioate bonds x $${it.phosphorothioate_per_bond_usd}` : ''}` };
  }
  if (it.unit_price_usd == null) return { ...it, packs, extended_price_usd: null, why_unpriced: it.why_unsourced ?? 'no public list price could be read' };
  return { ...it, packs, extended_price_usd: +(it.unit_price_usd * packs).toFixed(2) };
}
