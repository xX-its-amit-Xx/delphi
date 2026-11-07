#!/usr/bin/env node
// provenance.mjs - WHERE DID THE THING ON SCREEN COME FROM? A CLOSED VOCABULARY AND A GATE.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// The molecular scale of this viewer zooms from an embryo to a single machine on a chromosome, and it
// draws ribosomes, polymerases and nucleosomes at positions along that chromosome. THE POSITIONS ARE
// INVENTED. There is no measurement that says this ribosome sits 412 nm from that one at this instant in
// this cell, and no simulation in this repo computes one. The drawing has to put each object SOMEWHERE,
// and wherever it puts it is a choice made by a layout function.
//
// That is fine. What is not fine is a viewer in which the invented position and the measured diameter
// look identical on screen. A reader who cannot tell the two apart has no way to use the thing, because
// everything it shows is either worthless (if it is all invention) or trustworthy (if it is all
// measurement) and they cannot find out which. So the separation has to be carried IN THE DATA, on every
// element, and it has to be enforced by something that refuses rather than warns.
//
// This module is that separation. It holds no rendering code, no geometry and no biology. It holds:
//
//   KINDS   a closed vocabulary of six provenance kinds. Closed, because an open one becomes a free-text
//           field, and a free-text provenance field is a place to write "see paper" and move on.
//   cite()  a validator that THROWS, naming the missing field. A validator that warns is a validator
//           that gets ignored: the warning scrolls past in a build log and the figure ships anyway.
//   audit() the same question asked of a whole view: how many of each kind, which ones fail the gate,
//           and may this be published.
//   share() what fraction of this view is depiction. A view that is mostly depiction has to say so at
//           the top. In a footnote it is an alibi, not a disclosure.
//   chip()  plain data for a provenance badge. No HTML and no styling: the renderer owns appearance,
//           this file owns the claim.
//
// ============================== DEPICTED IS A FIRST-CLASS KIND ==============================
// See THE_RULE. The short form: the alternative to labelling the invention is not having less invention,
// it is drawing nothing. Every molecular illustration ever published invented its positions.
//
// ============================== NO PROVENANCE SCORE ==============================
// audit() returns COUNTS BY KIND and a boolean. It does not return a number between 0 and 1 for "how
// well sourced is this view". See WHY_NOT_A_PROVENANCE_SCORE. Six kinds of evidence are not six values
// of one quantity, and the weighting that would turn them into one is a modelling choice nobody can
// defend. share() does return a fraction, but it is the fraction of ONE kind - a count divided by a
// count, with its numerator named - and not a fused quality score.
//
// ============================== WHAT IS VERIFIED HERE ==============================
// Every number, accession and identifier in VERIFIED_EXAMPLES and SERVICES was retrieved during the
// session that wrote this file (2026-11-07), and each entry carries `verified_how` saying what was
// fetched and what was read back. Entries that could not be retrieved are nulls with reasons, not
// plausible numbers. One service URL shape could not be confirmed and is recorded as unconfirmed rather
// than guessed.
//
//   node sim-engine/scales/molecular/provenance.mjs        # print worked()
//   node sim-engine/scales/molecular/test-provenance.mjs   # the tests

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};

// ---------------------------------------------------------------------------- the vocabulary

/**
 * The six kinds. `requires` is a list of REQUIREMENT PATHS: a dotted path into the claim, or several
 * alternatives separated by '|' of which at least one must be present. cite() walks this list, so the
 * vocabulary and the validator cannot drift apart - there is one list, not a list and a switch statement.
 *
 * `evidential` says whether the kind carries evidential weight about the world. DEPICTED does not, by
 * construction. NOT_ESTABLISHED does not either, but for the opposite reason: it is a record of absence.
 */
export const KINDS = deepFreeze({
  MEASURED: {
    kind: 'MEASURED',
    label: 'Measured',
    definition: 'A measurement reported in a cited publication or a public dataset, in a named organism and cell type.',
    requires: ['id', 'statement', 'organism', 'what_was_measured', 'source.doi|source.pmid', 'verified_how'],
    evidential: true,
    is_depiction: false,
  },
  DATABASE_RECORD: {
    kind: 'DATABASE_RECORD',
    label: 'Database record',
    definition: 'A specific record in a named public service, identified by accession and by the date it was retrieved.',
    requires: ['id', 'statement', 'service', 'accession', 'retrieved', 'verified_how'],
    evidential: true,
    is_depiction: false,
  },
  TOOL_OUTPUT: {
    kind: 'TOOL_OUTPUT',
    label: 'Tool output',
    definition: 'Produced by a named piece of software at a named version. The tool, not the world, is the source.',
    requires: ['id', 'statement', 'tool', 'tool_version', 'what_it_produced', 'verified_how'],
    evidential: true,
    is_depiction: false,
  },
  DERIVED: {
    kind: 'DERIVED',
    label: 'Derived here',
    definition: 'Computed in this repo from other sourced claims, carrying the formula and the ids of its inputs.',
    requires: ['id', 'statement', 'formula', 'inputs'],
    evidential: true,
    is_depiction: false,
  },
  DEPICTED: {
    kind: 'DEPICTED',
    label: 'Depicted',
    definition: 'Invented for the drawing - a position, an orientation, a colour, a count chosen to fit the frame. Carries no evidential weight and must say what it stands in for.',
    requires: ['id', 'statement', 'standing_in_for', 'invented'],
    evidential: false,
    is_depiction: true,
  },
  NOT_ESTABLISHED: {
    kind: 'NOT_ESTABLISHED',
    label: 'Not established',
    definition: 'We looked and could not source it. A labelled hole, with where we looked and what would fill it.',
    requires: ['id', 'statement', 'null_reason', 'what_would_resolve_it', 'where_we_looked'],
    evidential: false,
    is_depiction: false,
  },
});

export const KIND_NAMES = deepFreeze(Object.keys(KINDS));

// ---------------------------------------------------------------------------- services

/**
 * Services a DATABASE_RECORD may name, with the URL shape chip() builds. Each `verified_how` records
 * what was actually fetched in the session that wrote this file; a shape that could not be confirmed is
 * marked unconfirmed and chip() returns a null href for it rather than a URL nobody has opened.
 */
export const SERVICES = deepFreeze({
  RCSB_PDB: {
    service: 'RCSB_PDB',
    label: 'RCSB PDB',
    accession_looks_like: 'a 4-character PDB id such as 1KX5, or an extended 8-character id',
    record_url: 'https://www.rcsb.org/structure/{ACC}',
    api_url: 'https://data.rcsb.org/rest/v1/core/entry/{ACC}',
    url_confirmed: true,
    verified_how: 'GET https://data.rcsb.org/rest/v1/core/entry/4V6X returned JSON with struct.title "Structure of the human 80S ribosome"; GET https://www.rcsb.org/structure/4V6X returned HTTP 200.',
  },
  EMDB: {
    service: 'EMDB',
    label: 'EMDB',
    accession_looks_like: 'an EMD id such as EMD-2938',
    record_url: 'https://www.ebi.ac.uk/emdb/{ACC}',
    api_url: 'https://www.ebi.ac.uk/emdb/api/entry/{ACC}',
    url_confirmed: false,
    url_unconfirmed_reason: 'the API endpoint was fetched and parsed, but the human-readable record URL shape was not opened in this session, so it is not asserted.',
    verified_how: 'GET https://www.ebi.ac.uk/emdb/api/entry/EMD-2938 returned HTTP 200 and JSON with admin.title "Structure of the human 80S ribosome", resolution 3.6 Angstrom (res_type BY AUTHOR), map.pixel_spacing 1.1 Angstrom on each axis, map.dimensions 300x300x300, map_release 2015-05-13.',
  },
  UNIPROT: {
    service: 'UNIPROT',
    label: 'UniProtKB',
    accession_looks_like: 'an accession such as P24928',
    record_url: 'https://www.uniprot.org/uniprotkb/{ACC}/entry',
    api_url: 'https://rest.uniprot.org/uniprotkb/{ACC}.json',
    url_confirmed: true,
    verified_how: 'GET https://rest.uniprot.org/uniprotkb/P24928.json returned entryType "UniProtKB reviewed (Swiss-Prot)", sequence.length 1970, sequence.molWeight 217206; GET https://www.uniprot.org/uniprotkb/P24928/entry returned HTTP 200.',
  },
  PUBMED: {
    service: 'PUBMED',
    label: 'PubMed',
    accession_looks_like: 'a numeric PMID such as 23523369',
    record_url: 'https://pubmed.ncbi.nlm.nih.gov/{ACC}/',
    api_url: null,
    url_confirmed: true,
    verified_how: 'Records 23523369, 24843027 and 22015688 were retrieved through the PubMed MCP tools, each returning title, journal, citation and DOI; GET https://pubmed.ncbi.nlm.nih.gov/23523369/ was reachable (HTTP 203 from a scripted client).',
  },
  ENSEMBL: {
    service: 'ENSEMBL',
    label: 'Ensembl',
    accession_looks_like: 'a stable id such as ENSG00000181222',
    record_url: null,
    api_url: 'https://rest.ensembl.org/lookup/id/{ACC}?content-type=application/json',
    url_confirmed: false,
    url_unconfirmed_reason: 'rest.ensembl.org returned HTTP 503 Service Unavailable on every attempt in this session, so neither the API nor the record URL shape was confirmed. Listed so a caller can name the service, but chip() will not build a link for it.',
    verified_how: 'GET https://rest.ensembl.org/info/ping and GET https://rest.ensembl.org/lookup/id/ENSG00000181222 both returned HTTP 503. Nothing was read back.',
  },
});

export const DOI_URL = 'https://doi.org/{DOI}';

// ---------------------------------------------------------------------------- the gate

/** Resolve a dotted path. Returns undefined for any missing link, never throws. */
function at(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Is a value PRESENT in the sense the gate needs? An empty string, an empty array and an empty object
 * are absent. This matters: a record whose `organism` is '' has had the field filled in by a template
 * and never answered, which is the most common way a provenance field becomes decorative.
 */
export function present(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value === true;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

/** Does the claim satisfy one requirement path (which may offer alternatives separated by '|')? */
export function satisfies(claim, requirement) {
  return requirement.split('|').some(p => present(at(claim, p)));
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/**
 * Validate a provenance record. Returns a deep-frozen normalised copy. THROWS on anything incomplete,
 * and the message always names the field that is missing or wrong, because an error that says only
 * "invalid claim" sends the reader to read this file instead of fixing their record.
 */
export function cite(claim) {
  const where = `cite(${claim && typeof claim === 'object' && claim.id ? claim.id : '<no id>'})`;
  if (claim === null || typeof claim !== 'object' || Array.isArray(claim)) {
    throw new Error(`${where}: a claim must be a plain object, got ${Array.isArray(claim) ? 'an array' : typeof claim}`);
  }
  if (!present(claim.kind)) throw new Error(`${where}: missing required field "kind" - one of ${KIND_NAMES.join(', ')}`);
  const spec = KINDS[claim.kind];
  if (!spec) throw new Error(`${where}: field "kind" is "${claim.kind}", which is not in the closed vocabulary (${KIND_NAMES.join(', ')})`);

  for (const req of spec.requires) {
    if (!satisfies(claim, req)) {
      throw new Error(`${where}: ${claim.kind} claim is missing required field "${req}" - ${spec.definition}`);
    }
  }

  // Per-kind checks that presence alone cannot make. Each names its own field.
  if (claim.kind === 'DATABASE_RECORD') {
    if (!SERVICES[claim.service]) {
      throw new Error(`${where}: field "service" is "${claim.service}", which is not a known service (${Object.keys(SERVICES).join(', ')})`);
    }
    if (typeof claim.retrieved !== 'string' || !ISO_DAY.test(claim.retrieved) || Number.isNaN(Date.parse(claim.retrieved))) {
      throw new Error(`${where}: field "retrieved" must be an ISO date (YYYY-MM-DD or a full ISO timestamp), got ${JSON.stringify(claim.retrieved)}`);
    }
  }
  if (claim.kind === 'DERIVED') {
    if (!Array.isArray(claim.inputs)) throw new Error(`${where}: field "inputs" must be an array of claim ids, got ${typeof claim.inputs}`);
    const bad = claim.inputs.findIndex(x => typeof x !== 'string' || x.trim().length === 0);
    if (bad >= 0) throw new Error(`${where}: field "inputs" entry ${bad} is not a claim id string, got ${JSON.stringify(claim.inputs[bad])}`);
  }
  if (claim.kind === 'DEPICTED' && present(at(claim, 'value.value'))) {
    // A depiction that carries a number is the exact failure this module exists to stop: the number gets
    // read off the screen and quoted, and the DEPICTED label goes with the position, not with the number.
    throw new Error(`${where}: field "value" is set on a DEPICTED claim - a depiction may not carry a number. Split it: the measured quantity is its own MEASURED or DERIVED claim, and the drawing cites that.`);
  }
  if (claim.kind === 'NOT_ESTABLISHED' && present(at(claim, 'value.value'))) {
    throw new Error(`${where}: field "value" carries a number on a NOT_ESTABLISHED claim - if a value was found the kind is wrong, and if it was not, the number is invented.`);
  }
  if (claim.value !== undefined) {
    const v = claim.value;
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      throw new Error(`${where}: field "value" must be an object { value, units } or { value: null, units, null_reason, what_would_resolve_it }, got ${Array.isArray(v) ? 'an array' : v === null ? 'null' : typeof v}`);
    }
    if (!Object.hasOwn(v, 'value')) throw new Error(`${where}: missing required field "value.value" - use null, with a reason, for a number you could not retrieve`);
    if (!present(v.units)) throw new Error(`${where}: missing required field "value.units" - a bare number is not a quantity`);
    if (v.value === null) {
      if (!present(v.null_reason)) throw new Error(`${where}: missing required field "value.null_reason" - a null without a reason is indistinguishable from a forgotten field`);
      if (!present(v.what_would_resolve_it)) throw new Error(`${where}: missing required field "value.what_would_resolve_it"`);
    } else if (typeof v.value !== 'number' && !Array.isArray(v.value)) {
      throw new Error(`${where}: field "value.value" must be a number, an array (a range, as [lo, hi]), or null, got ${typeof v.value}`);
    }
  }
  return deepFreeze(structuredClone(claim));
}

/** Does this claim pass the gate? The non-throwing form, for auditing a list you did not build. */
export function check(claim) {
  try { cite(claim); return { ok: true, error: null }; }
  catch (e) { return { ok: false, error: e.message }; }
}

// ---------------------------------------------------------------------------- auditing a whole view

/**
 * Counts by kind, the ones that fail the gate, and whether this view may be published.
 *
 * THE ONE JUDGEMENT CALL, stated rather than buried: a NOT_ESTABLISHED claim is NOT counted as
 * unsourced. It is a labelled hole - we looked, we failed, and we said so - and a gate that blocked
 * publication on it would make the honest record more expensive than quietly dropping the row, which is
 * precisely the incentive this repo is trying not to create. `holes` reports them separately so a view
 * can show them, and `publishable_with_no_holes` is there for a caller who wants the strict reading
 * without this file deciding for them.
 *
 * UNSOURCED means: fails cite(). Incomplete provenance, an unknown kind, a missing accession, a
 * depiction carrying a number. Those block publication.
 */
export function audit(items) {
  if (!Array.isArray(items)) throw new Error(`audit(): expected an array of claims, got ${items === null ? 'null' : typeof items}`);
  const by_kind = {};
  for (const k of KIND_NAMES) by_kind[k] = 0;
  const unsourced = [], holes = [], unknown_kind = [];
  items.forEach((item, index) => {
    const r = check(item);
    const kind = item && typeof item === 'object' ? item.kind : undefined;
    if (Object.hasOwn(by_kind, kind)) by_kind[kind]++; else unknown_kind.push({ index, id: item?.id ?? null, kind: kind ?? null });
    if (!r.ok) unsourced.push({ index, id: item?.id ?? null, kind: kind ?? null, error: r.error });
    else if (kind === 'NOT_ESTABLISHED') holes.push({ index, id: item.id, statement: item.statement });
  });
  return {
    total: items.length,
    by_kind,
    unknown_kind,
    unsourced,
    holes,
    publishable: unsourced.length === 0,
    publishable_with_no_holes: unsourced.length === 0 && holes.length === 0,
    why_not: unsourced.length === 0 ? [] : unsourced.map(u => u.error),
  };
}

/**
 * What fraction of this view is depiction.
 *
 * This is a count divided by a count with its numerator named, not a quality score: a view of ten claims
 * of which nine are DEPICTED is 0.9 depicted, and that is a fact about the view, not a grade. The flag
 * exists so the renderer can put the disclosure at the top. A reader who has to scroll to the footnote
 * to learn that the positions are invented has already believed them.
 */
export function share(items) {
  if (!Array.isArray(items)) throw new Error(`share(): expected an array of claims, got ${items === null ? 'null' : typeof items}`);
  const total = items.length;
  const depicted = items.filter(i => i && i.kind === 'DEPICTED').length;
  const fraction = total === 0 ? null : depicted / total;
  const mostly_depicted = fraction !== null && fraction > 0.5;
  return {
    total,
    depicted,
    fraction,
    mostly_depicted,
    say_at_top: fraction !== null && fraction > 0,
    headline: total === 0
      ? 'Nothing in this view yet.'
      : depicted === 0
        ? 'Nothing in this view is depicted; every element cites a source.'
        : `${depicted} of ${total} elements in this view are DEPICTED: their positions, orientations or colours were invented for the drawing and carry no evidential weight.`,
  };
}

// ---------------------------------------------------------------------------- badges

/**
 * Plain data for a provenance badge: {label, kind, href, title}. No HTML, no classes, no colours - a
 * renderer that wants a pill and a renderer that wants a footnote marker both get what they need from
 * this, and neither can be broken by a change of stylesheet here.
 *
 * href is a resolvable link or null. It is null when there is nothing to resolve (a depiction, a
 * derivation) and also when the service's record URL shape was not confirmed, because a link that
 * 404s is worse than no link: it reads as provenance and delivers nothing.
 */
export function chip(claim) {
  const c = cite(claim); // an invalid claim gets no badge at all
  const spec = KINDS[c.kind];
  let href = null;
  if (c.kind === 'MEASURED') {
    if (present(at(c, 'source.doi'))) href = DOI_URL.replace('{DOI}', c.source.doi);
    else if (present(at(c, 'source.pmid'))) href = SERVICES.PUBMED.record_url.replace('{ACC}', String(c.source.pmid));
  } else if (c.kind === 'DATABASE_RECORD') {
    const svc = SERVICES[c.service];
    if (svc.url_confirmed && svc.record_url) href = svc.record_url.replace('{ACC}', c.accession);
  } else if (c.kind === 'TOOL_OUTPUT' && present(c.tool_url)) {
    href = c.tool_url;
  }
  const title = c.kind === 'MEASURED'
    ? `Measured in ${c.organism}${present(c.cell_type) ? `, ${c.cell_type}` : ''}: ${c.what_was_measured}. Source: ${present(at(c, 'source.doi')) ? `doi:${c.source.doi}` : `PMID ${c.source.pmid}`}.`
    : c.kind === 'DATABASE_RECORD'
      ? `${SERVICES[c.service].label} record ${c.accession}, retrieved ${String(c.retrieved).slice(0, 10)}.`
      : c.kind === 'TOOL_OUTPUT'
        ? `Produced by ${c.tool} ${c.tool_version}: ${c.what_it_produced}. The tool is the source, not a measurement.`
        : c.kind === 'DERIVED'
          ? `Computed here as ${c.formula}, from ${c.inputs.length} sourced input${c.inputs.length === 1 ? '' : 's'}: ${c.inputs.join(', ')}.`
          : c.kind === 'DEPICTED'
            ? `Invented for the drawing: ${c.invented}. It stands in for ${c.standing_in_for}. No evidential weight.`
            : `Not established: ${c.null_reason} Looked in: ${c.where_we_looked} Would be resolved by: ${c.what_would_resolve_it}`;
  return { label: spec.label, kind: c.kind, href, title };
}

// ---------------------------------------------------------------------------- the rule

export const THE_RULE = deepFreeze({
  one_line: 'DEPICTED is a kind of provenance, not a confession.',
  why_it_is_first_class:
    'A drawing of a ribosome inside a cell has to put the ribosome SOMEWHERE. There is no measurement of ' +
    'where that particular ribosome was at that particular instant, and no physics in this repo computes ' +
    'one, so the position comes out of a layout function. That is true of every molecular illustration ' +
    'ever published, including the ones on the covers of the textbooks. The choice available is not ' +
    'between invented positions and measured ones; it is between invented positions that are labelled ' +
    'and invented positions that are not.',
  what_goes_wrong_without_it:
    'Without a DEPICTED kind there are two bad outcomes and no good one. Either the position is given a ' +
    'fake source - the paper that measured the ribosome DIAMETER gets cited for the ribosome POSITION, ' +
    'because it was the nearest citation to hand - or the position carries no provenance at all, which ' +
    'in a view where everything else carries provenance reads as an oversight rather than as a claim ' +
    'about invention. Both make the view less honest than simply saying: we put it there.',
  what_it_buys:
    'Separability. A reader can ask of any element on screen: is this a thing someone measured, or a ' +
    'thing we drew? share() answers that for a whole view in one number with a named numerator, so a ' +
    'view that is nine-tenths invention says so above the fold instead of in a footnote. And a designer ' +
    'using this viewer to build an organism can see exactly which of the things they are reasoning about ' +
    'are load-bearing and which are scenery.',
  the_hard_part:
    'A DEPICTED claim must say WHAT IT IS STANDING IN FOR, and that is the field people want to leave ' +
    'blank. "Position of a ribosome" is not an answer; "the position of one of the roughly 6500 ' +
    'ribosomes this cell is modelled as having, chosen so that the local density matches the count and ' +
    'the volume" is. cite() throws without it, because a depiction that cannot say what it depicts is ' +
    'not a depiction, it is decoration.',
  and_the_counts:
    'The same applies to counts chosen to fit a frame. If the view draws forty ribosomes because forty ' +
    'is what renders at 60 fps, that forty is DEPICTED and the real count is a separate MEASURED or ' +
    'NOT_ESTABLISHED claim that the depiction cites. cite() refuses a DEPICTED claim carrying a number ' +
    'for exactly this reason: a number on screen gets quoted, and the label travels with the position.',
});

export const WHY_NOT_A_PROVENANCE_SCORE = deepFreeze({
  the_temptation:
    'It is easy to write a function that returns 0.82 for "how well sourced is this view", and a ' +
    'dashboard will happily display it.',
  why_not:
    'Six kinds of evidence are not six values of one quantity. A DATABASE_RECORD with an accession and a ' +
    'retrieval date and a MEASURED value from one cell line in one growth state are not comparable, and ' +
    'collapsing them requires weights. No weighting is defensible, every weighting is invisible once it ' +
    'is inside a float, and a 0.82 gets read downstream as a probability that the view is right.',
  what_is_returned_instead:
    'audit() returns counts by kind and a boolean. The counts are incommensurable on purpose: a reader ' +
    'who wants to know whether a view is well sourced has to look at what KIND of sourcing it has, ' +
    'which is the actual question.',
  the_one_fraction:
    'share() returns a fraction, and it is not an exception to this. It is one count over the total with ' +
    'its numerator named - the DEPICTED count - and it answers one question rather than summarising six.',
});

// ---------------------------------------------------------------------------- verified examples

/**
 * A seed set, every entry retrieved in the session that wrote this file. These exist so the viewer team
 * has real records to render against rather than placeholders that quietly become the shipped values,
 * and so the tests exercise the gate on records that are not shaped for it.
 *
 * Organism and cell type are on every count and rate, because they change the answer. A rate measured in
 * a human breast cancer line is not a rate about an embryo, and a machine count in a bacterium in
 * stationary phase is not a machine count in a dividing animal cell.
 */
export const VERIFIED_EXAMPLES = deepFreeze([
  {
    id: 'pdb.4v6x.entry',
    kind: 'DATABASE_RECORD',
    statement: 'Cryo-EM structure of the human 80S ribosome, deposited as PDB 4V6X: 237685 deposited atoms across 87 polymer entities, reported resolution 5 Angstrom.',
    service: 'RCSB_PDB',
    accession: '4V6X',
    retrieved: '2026-11-07',
    organism: 'Homo sapiens',
    value: { value: 237685, units: 'deposited atoms' },
    extra: { resolution_angstrom: 5, polymer_entities: 87, method: 'ELECTRON MICROSCOPY', initial_release: '2014-07-09' },
    source: { doi: '10.1038/nature12104', pmid: 23636399, citation: 'Anger, A.M., Armache, J.-P., Berninghausen, O., Habeck, M., Subklewe, M., Wilson, D.N. & Beckmann, R. (2013) Structures of the human and Drosophila 80S ribosome. Nature 497:80-85.' },
    verified_how: 'GET https://data.rcsb.org/rest/v1/core/entry/4V6X on 2026-11-07. Read back struct.title "Structure of the human 80S ribosome", exptl.method ELECTRON MICROSCOPY, rcsb_entry_info.resolution_combined [5], deposited_atom_count 237685, polymer_entity_count 87, initial_release_date 2014-07-09, and the primary citation with DOI 10.1038/nature12104 and PubMed 23636399.',
  },
  {
    id: 'emdb.emd-2938.voxel_spacing',
    kind: 'DATABASE_RECORD',
    statement: 'The human 80S ribosome reconstruction EMD-2938 has a voxel spacing of 1.1 Angstrom on each axis.',
    service: 'EMDB',
    accession: 'EMD-2938',
    retrieved: '2026-11-07',
    organism: 'Homo sapiens',
    value: { value: 1.1, units: 'Angstrom per voxel' },
    verified_how: 'GET https://www.ebi.ac.uk/emdb/api/entry/EMD-2938 on 2026-11-07. Read back admin.title "Structure of the human 80S ribosome", map.pixel_spacing x/y/z each 1.1 Angstrom, final_reconstruction.resolution 3.6 Angstrom (res_type BY AUTHOR), method singleParticle, map_release 2015-05-13.',
  },
  {
    id: 'emdb.emd-2938.box_voxels',
    kind: 'DATABASE_RECORD',
    statement: 'The EMD-2938 map is 300 voxels on each edge.',
    service: 'EMDB',
    accession: 'EMD-2938',
    retrieved: '2026-11-07',
    organism: 'Homo sapiens',
    value: { value: 300, units: 'voxels per edge' },
    verified_how: 'Same fetch as emdb.emd-2938.voxel_spacing: map.dimensions read back as col 300, row 300, sec 300.',
  },
  {
    id: 'derived.ribosome_box_bound',
    kind: 'DERIVED',
    statement: 'The EMD-2938 reconstruction box is 330 Angstrom on an edge, so the deposited map cannot represent a particle longer than 330 Angstrom. This BOUNDS the human 80S ribosome\'s longest dimension; it is not a measurement of it.',
    formula: 'box_edge_angstrom = voxel_spacing_angstrom * voxels_per_edge',
    inputs: ['emdb.emd-2938.voxel_spacing', 'emdb.emd-2938.box_voxels'],
    value: { value: 330, units: 'Angstrom (upper bound on the particle\'s longest dimension)' },
    caveat: 'A box is chosen with padding around the particle, so the particle is strictly smaller than the box, by an amount this derivation cannot recover. A viewer that needs a ribosome DIAMETER must cite a measurement of the diameter, not this bound.',
  },
  {
    id: 'pdb.1kx5.nucleosome',
    kind: 'DATABASE_RECORD',
    statement: 'Nucleosome core particle NCP147 at 1.94 Angstrom (PDB 1KX5): histones from Xenopus laevis, 147 base pairs of human alpha-satellite-derived DNA, 16755 deposited atoms.',
    service: 'RCSB_PDB',
    accession: '1KX5',
    retrieved: '2026-11-07',
    organism: 'Xenopus laevis (histones); Homo sapiens (the DNA sequence)',
    value: { value: 147, units: 'base pairs of DNA in the core particle' },
    extra: { resolution_angstrom: 1.94, deposited_atoms: 16755, polymer_entities: 6, method: 'X-RAY DIFFRACTION' },
    source: { doi: '10.1016/S0022-2836(02)00386-8', pmid: 12079350, citation: 'Davey, C.A., Sargent, D.F., Luger, K., Maeder, A.W. & Richmond, T.J. (2002) Solvent mediated interactions in the structure of the nucleosome core particle at 1.9 A resolution. J Mol Biol 319:1097-1113.' },
    verified_how: 'GET https://data.rcsb.org/rest/v1/core/entry/1KX5 on 2026-11-07: title "X-Ray Structure of the Nucleosome Core Particle, NCP147, at 1.9 A Resolution", resolution_combined [1.94], deposited_atom_count 16755, polymer_entity_count 6, primary citation DOI 10.1016/S0022-2836(02)00386-8 / PubMed 12079350. GET .../polymer_entity/1KX5/1 and /2 returned the two 147-nucleotide DNA strands with source organism Homo sapiens; /3 returned histone H3 with source organism Xenopus laevis. The 147 bp count was read off the deposited DNA entity sequences, not taken from a textbook.',
  },
  {
    id: 'pdb.1i6h.pol2',
    kind: 'DATABASE_RECORD',
    statement: 'RNA polymerase II elongation complex at 3.3 Angstrom (PDB 1I6H), from Saccharomyces cerevisiae: 28430 deposited atoms across 12 polymer entities.',
    service: 'RCSB_PDB',
    accession: '1I6H',
    retrieved: '2026-11-07',
    organism: 'Saccharomyces cerevisiae',
    value: { value: 28430, units: 'deposited atoms' },
    extra: { resolution_angstrom: 3.3, polymer_entities: 12, method: 'X-RAY DIFFRACTION' },
    source: { doi: '10.1126/science.1059495', pmid: 11313499, citation: 'Gnatt, A.L., Cramer, P., Fu, J., Bushnell, D.A. & Kornberg, R.D. (2001) Structural basis of transcription: an RNA polymerase II elongation complex at 3.3 A resolution. Science 292:1876-1882.' },
    verified_how: 'GET https://data.rcsb.org/rest/v1/core/entry/1I6H on 2026-11-07: resolution_combined [3.3], deposited_atom_count 28430, polymer_entity_count 12, primary citation DOI 10.1126/science.1059495 / PubMed 11313499. GET .../polymer_entity/1I6H/1 returned source organism Saccharomyces cerevisiae. Named here as a yeast structure: this is not a structure of a mammalian polymerase, and the viewer must not label it as one.',
  },
  {
    id: 'uniprot.p24928.rpb1',
    kind: 'DATABASE_RECORD',
    statement: 'Human RNA polymerase II largest subunit RPB1 (POLR2A), UniProtKB P24928: 1970 residues, 217206 Da.',
    service: 'UNIPROT',
    accession: 'P24928',
    retrieved: '2026-11-07',
    organism: 'Homo sapiens',
    value: { value: 1970, units: 'amino acid residues' },
    extra: { mass_da: 217206, entry_type: 'UniProtKB reviewed (Swiss-Prot)', sequence_version: 3, last_sequence_update: '2026-06-10' },
    verified_how: 'GET https://rest.uniprot.org/uniprotkb/P24928.json on 2026-11-07. Read back primaryAccession P24928, uniProtkbId RPB1_HUMAN, recommendedName "DNA-directed RNA polymerase II subunit RPB1", organism Homo sapiens (taxon 9606), sequence.length 1970, sequence.molWeight 217206, entryAudit.sequenceVersion 3.',
  },
  {
    id: 'tool.sasa.1crn',
    kind: 'TOOL_OUTPUT',
    statement: 'Running this repo\'s Shrake-Rupley accessibility code over PDB 1CRN (crambin, from the plant Crambe abyssinica) gives a total solvent-accessible surface area of 2963.17 square Angstrom over 46 residues and 327 atoms, and a net surface charge of -1 at the standard 0.20 relative-accessibility cut.',
    tool: 'delphisci benchmarks/retro-validation/structure.mjs (residueSasa, surfaceCharge)',
    tool_version: '19310 bytes, sha256 cb49e827c150a2cc..., run on Node v24.13.0',
    what_it_produced: 'per-residue solvent-accessible areas summed to a total, and the net charge over solvent-exposed ionisable residues',
    organism: 'Crambe abyssinica',
    value: { value: 2963.17, units: 'square Angstrom (total solvent-accessible surface area)' },
    also: { residues: 46, atoms_parsed: 327, z_surface: -1, exposed_ionisable: 3, buried_ionisable: 1, sphere_points: 256 },
    inputs_fetched: 'https://files.rcsb.org/download/1CRN.pdb (49491 bytes), 2026-11-07',
    verified_how: 'GET https://files.rcsb.org/download/1CRN.pdb on 2026-11-07 (49491 bytes), then structure.mjs parsePDB -> 327 atoms, residueSasa({points:256}) -> 46 residue rows summing to 2963.17, surfaceCharge({points:256}) -> z_surface -1, exposed_ionisable 3, buried_ionisable 1. Tool identity read back as 19310 bytes / sha256 prefix cb49e827c150a2cc and node --version v24.13.0. The entry metadata was confirmed separately: GET https://data.rcsb.org/rest/v1/core/entry/1CRN returned title "WATER STRUCTURE OF A HYDROPHOBIC PROTEIN AT ATOMIC RESOLUTION. PENTAGON RINGS OF WATER MOLECULES IN CRYSTALS OF CRAMBIN", resolution 1.5 Angstrom, 327 deposited atoms, primary citation DOI 10.1073/pnas.81.19.6014 / PubMed 16593516.',
    not_a_measurement: 'This is what the software returns on that input. It is a property of the deposited coordinates plus the numerical method (probe radius, sphere sampling, exposure cut), not a measured area of a protein in solution.',
  },
  {
    id: 'rate.pol2_elongation.human_mcf7',
    kind: 'MEASURED',
    statement: 'RNA polymerase II gene-body elongation rate in human MCF-7 cells after estradiol induction: median 2.1 kb/min across 140 genes, with the middle 90% of genes between 0.37 and 3.57 kb/min. In human AC16 cardiomyocytes after TNF-alpha, the median was 2.80 kb/min across 26 genes.',
    organism: 'Homo sapiens',
    cell_type: 'MCF-7 breast cancer line (estradiol) and AC16 cardiomyocyte line (TNF-alpha)',
    what_was_measured: 'the distance travelled by the leading edge of the Pol II transcription wave over a 10-40 minute induction time course, measured by GRO-seq and fitted by linear regression',
    value: { value: 2.1, units: 'kb/min (median)' },
    spread: { middle_90_percent: [0.37, 3.57], units: 'kb/min', second_cell_type_median: 2.80 },
    method: 'GRO-seq with a three-state hidden Markov model for the wave end; the authors report a median absolute inference error of 0.064 kb/min on simulated data and an upper bound of 0.312 kb/min across biological replicates.',
    source: { doi: '10.1016/j.molcel.2013.02.015', pmid: 23523369, citation: 'Danko, C.G., Hah, N., Luo, X., Martins, A.L., Core, L., Lis, J.T., Siepel, A. & Kraus, W.L. (2013) Signaling pathways differentially affect RNA polymerase II initiation, pausing, and elongation rate in cells. Molecular Cell 50:212-222.' },
    verified_how: 'Retrieved through the PubMed MCP tools on 2026-11-07: metadata for PMID 23523369 (Mol Cell 50:212-222, DOI 10.1016/j.molcel.2013.02.015) and the PMC full text (PMC3640649). Read back verbatim: "For all 140 genes, we found that the rates ranged between 0.37 and 3.57 kb/min for the middle 90% of genes, with a median rate of 2.1 kb/ min"; "We observed a median rate of 2.80 kb/min. for 26 genes"; and the error estimates 0.064 and 0.312 kb/min.',
  },
  {
    id: 'rate.pol2_elongation.mouse_es',
    kind: 'MEASURED',
    statement: 'RNA polymerase II elongation rate in mouse embryonic stem cells: average 0.5 kb/min in the first 5-12.5 min of a gene, 1.8 kb/min at 12.5-25 min and 2.4 kb/min at 25-50 min, i.e. Pol II accelerates as it moves into the gene body. Rates spanned 0.5-4 kb/min across about 1000 genes.',
    organism: 'Mus musculus',
    cell_type: 'embryonic stem cells',
    what_was_measured: 'the position of the Pol II inhibition wave after triptolide or flavopiridol treatment, tracked by GRO-seq, converted to a rate per gene',
    value: { value: [0.5, 4], units: 'kb/min (range across about 1000 genes)' },
    spread: { early_mean: 0.5, early_sd: 0.43, mid_mean: 1.8, mid_sd: 0.69, late_mean: 2.4, late_sd: 0.79, units: 'kb/min', n_genes: { early: 141, mid: 938, late: 245 } },
    source: { doi: '10.7554/eLife.02407', pmid: 24843027, citation: 'Jonkers, I., Kwak, H. & Lis, J.T. (2014) Genome-wide dynamics of Pol II elongation and its interplay with promoter proximal pausing, chromatin, and exons. eLife 3:e02407.' },
    verified_how: 'Retrieved through the PubMed MCP tools on 2026-11-07: metadata for PMID 24843027 (eLife 3:e02407, DOI 10.7554/eLife.02407) and the PMC full text (PMC4001325). Read back verbatim: "We directly measured 141 early (5-12.5 min), 938 mid (12.5-25 min), and 245 late (25-50 min) elongation rates, with average elongation rates of 0.5, 1.8 and 2.4 kb/min respectively"; the standard deviations 0.43, 0.69 and 0.79 kb/min; "On average, Pol II travels about 100 kb during 50 min of FP treatment. This corresponds to an elongation rate of about 2 kb/min"; and "we measured elongation rates ranging from 0.5 to 4 kb/min at ~1000 genes". GET https://doi.org/10.7554/eLife.02407 returned HTTP 200.',
  },
  {
    id: 'rate.pol2_elongation.fast_outlier',
    kind: 'MEASURED',
    statement: 'A fluorescent-RNA-tagging measurement on an integrated HIV-1-derived reporter in human cells calculated a transcription rate above 50 kb/min - more than an order of magnitude above the GRO-seq medians - and the same paper states that averaged estimates in mammalian cells range between 1.3 and 4.3 kb/min.',
    organism: 'Homo sapiens',
    cell_type: 'a human cell line carrying an integrated HIV-1-derived reporter vector',
    what_was_measured: 'fluorescence recovery after photobleaching of nascent RNA at a single integrated transgene in living single cells',
    value: { value: 50, units: 'kb/min (a lower bound: the paper reports "above 50 kb/min")' },
    source: { doi: '10.1038/embor.2011.196', pmid: 22015688, citation: 'Maiuri, P., Knezevich, A., De Marco, A., Mazza, D., Kula, A., McNally, J.G. & Marcello, A. (2011) Fast transcription rates of RNA polymerase II in human cells. EMBO Reports 12:1280-1285.' },
    verified_how: 'Retrieved through the PubMed MCP tools on 2026-11-07: metadata for PMID 22015688 (EMBO Rep 12:1280-1285, DOI 10.1038/embor.2011.196). Read back from the abstract: "Averaged estimates of RNA polymerase II (RNAPII) elongation rates in mammalian cells have been shown to range between 1.3 and 4.3 kb min(-1)" and "The calculated transcription rate above 50 kb min(-1) points towards a wide dynamic range of RNAPII velocities in living cells."',
  },
  {
    id: 'count.machines_per_cell.ecoli_stationary',
    kind: 'MEASURED',
    statement: 'In Escherichia coli in stationary culture, absolute-quantification proteomics puts a single bacterium at about 6500 ribosomes, about 300 RNA polymerase molecules and about 10 DNA polymerase assemblies.',
    organism: 'Escherichia coli',
    cell_type: 'whole cell, stationary-phase culture',
    what_was_measured: 'protein copy number per cell, from multi-enzyme-digestion FASP shotgun proteomics with the Total Protein Approach, with protein per cell fixed by quantifying DNA content in the same sample',
    value: { value: 6500, units: 'ribosomes per cell' },
    also: { rna_polymerase_molecules_per_cell: 300, dna_polymerase_assemblies_per_cell: 10 },
    source: { doi: '10.1016/j.jprot.2014.07.012', pmid: 25063446, citation: 'Wisniewski, J.R. & Rakus, D. (2014) Multi-enzyme digestion FASP and the "Total Protein Approach"-based absolute quantification of the Escherichia coli proteome. Journal of Proteomics 109:322-331.' },
    verified_how: 'Retrieved through the PubMed MCP tools on 2026-11-07: metadata for PMID 25063446 (J Proteomics 109:322-331, DOI 10.1016/j.jprot.2014.07.012). Read back from the abstract: "In stationary culture, a single bacterium contains about 6500 copies of ribosomes, 300 molecules of RNA polymerase and 10 DNA polymerase assembles."',
    organism_warning: 'This is a bacterium in stationary phase. It is NOT a count for an animal cell, and it is not even the count for the same bacterium growing fast - ribosome content scales with growth rate. A viewer that draws a dividing animal cell may not use this number, and the hole where that number should be is count.ribosomes_per_cell.mammalian_embryonic below.',
  },
  {
    id: 'count.ribosomes_per_cell.mammalian_embryonic',
    kind: 'NOT_ESTABLISHED',
    statement: 'How many ribosomes are in a dividing mammalian embryonic cell.',
    null_reason: 'No primary measurement of absolute ribosome number per cell for a mammalian embryonic cell type was retrieved in this session.',
    where_we_looked: 'PubMed, via the PubMed MCP search tool, on 2026-11-07: "number of ribosomes per cell HeLa quantification absolute" (0 results), "ribosome content per cell mammalian copy number quantitative proteomics ribosomal protein" (0 results), and "ribosomes per cell absolute quantification" (17 results, of which the only per-cell machine counts returned were for a bacterium and for microalgal rRNA gene copy number).',
    what_would_resolve_it: 'An absolute-quantification proteomics or polysome-profiling measurement that reports ribosomes per cell for a named mammalian cell type at a named growth state, or a cell-volume-plus-concentration measurement from which it can be derived with both inputs cited. Until then the viewer must either show the hole or cite the bacterial number WITH its organism, and must not silently scale the bacterial number by a volume ratio.',
    verified_how: 'The three searches above were run and their result sets inspected. The absence recorded here is the absence of a retrieved source, not a claim that no such measurement exists.',
  },
  {
    id: 'depicted.ribosome_positions',
    kind: 'DEPICTED',
    statement: 'The positions and orientations of the ribosomes drawn in the cytoplasm at this zoom level.',
    standing_in_for: 'the instantaneous spatial arrangement of the ribosomes in one cell, which is not measured for any individual cell and is not computed by any physics in this repo',
    invented: 'every (x, y, z) and every rotation, produced by a layout function; the local number density is tuned so the drawn cluster reads as dense rather than to match any measured density',
    no_evidential_weight: true,
    cites: ['count.machines_per_cell.ecoli_stationary', 'count.ribosomes_per_cell.mammalian_embryonic'],
    note: 'The number of ribosomes the layout draws is itself depicted - it is whatever renders at frame rate. The real count is the two claims in `cites`, one of which is a labelled hole.',
  },
  {
    id: 'depicted.chromosome_path',
    kind: 'DEPICTED',
    statement: 'The three-dimensional path of the chromosome fibre the camera flies along.',
    standing_in_for: 'chromatin folding in an interphase nucleus, for which population-average contact frequencies exist but a single-cell fibre path at this resolution does not',
    invented: 'the entire curve, including every loop and every turn; nucleosome spacing along the curve is drawn at a visually legible interval, not at a measured repeat length',
    no_evidential_weight: true,
    note: 'The nucleosome CORE is sourced (pdb.1kx5.nucleosome: 147 bp). The SPACING between cores along this drawn fibre is not; a nucleosome repeat length for this organism and cell type was not retrieved for this file and must be its own claim before any spacing is stated on screen.',
  },
]);

// ---------------------------------------------------------------------------- what we got wrong

export const THE_GUESSED_PMID = deepFreeze({
  what_happened:
    'Assembling the elongation-rate evidence for this file, the first lookup was a batch of six PMIDs ' +
    'written from memory for papers that were expected to be the right ones. One of the six was the ' +
    'intended paper. The other five resolved to real, correctly-formatted, completely unrelated ' +
    'articles: a paper on an Alzheimer receptor complex, a paper on RNA helicases in cell ' +
    'differentiation, a paper on a long non-coding RNA in tumour microenvironment, a materials-science ' +
    'paper on a self-assembling protein, and a chromatin paper on histone variants.',
  why_it_matters_more_than_an_ordinary_mistake:
    'Every one of those identifiers came back HTTP 200 with a title, a journal, a volume and a DOI. ' +
    'Nothing about the response said "wrong paper". Had the batch been used to populate a citation ' +
    'field without reading the titles back, this file would now carry five numeric claims attached to ' +
    'five real DOIs that do not support them - which is strictly worse than carrying no citation at ' +
    'all, because a resolvable DOI is exactly what stops a reader checking.',
  how_it_was_caught:
    'By reading the returned titles instead of the returned status codes. The guessed identifiers were ' +
    'then thrown away and the papers were found by author-and-topic search, which returned different ' +
    'PMIDs - 23523369 and 24843027 - whose titles match what was wanted.',
  the_general_lesson:
    'AN IDENTIFIER IS NOT EVIDENCE THAT IT IS THE RIGHT IDENTIFIER. A DOI or a PMID recalled rather than ' +
    'retrieved is a guess with a checksum, and the checksum passes. The only thing that establishes a ' +
    'citation is fetching it and reading the title back against the claim it is attached to.',
  what_changed_in_the_code:
    'Every MEASURED and DATABASE_RECORD entry in VERIFIED_EXAMPLES carries `verified_how` stating the ' +
    'exact request made and the exact strings read back, and cite() requires that field. A citation ' +
    'whose provenance record cannot say what was read back does not pass the gate.',
});

export const KNOWN_LIMITATIONS = deepFreeze([
  'cite() checks that a provenance field is FILLED IN, not that it is TRUE. A MEASURED claim with a ' +
  'well-formed DOI that does not support the statement passes. The gate stops omission, not ' +
  'misattribution, and THE_GUESSED_PMID is the record of how easy misattribution is.',
  'The DEPICTED/MEASURED boundary is drawn by whoever writes the claim. A layout function that happens ' +
  'to reproduce a measured density is still DEPICTED by this vocabulary, and a measurement copied into ' +
  'a position field is still MEASURED. Nothing here can inspect the renderer to check.',
  'There is no requirement that a DERIVED claim\'s `inputs` resolve to claims that exist: cite() checks ' +
  'that the ids are non-empty strings, not that they are in the set being audited. Resolving them is ' +
  'the caller\'s job and a dangling input is a silent gap. audit() does not close it either.',
  'The ENSEMBL service entry has no confirmed record URL because rest.ensembl.org returned HTTP 503 ' +
  'throughout this session, and the EMDB record URL shape was not opened. chip() returns a null href ' +
  'for both rather than a link nobody has resolved.',
  'Deciding that a NOT_ESTABLISHED claim does not block publication is a judgement, not a derivation. ' +
  'audit() exposes `publishable_with_no_holes` so a caller can take the other view, but one of the two ' +
  'had to be the default and the reasoning for this one is written out in audit()\'s doc comment.',
  'Retrieval dates are recorded, staleness is not acted on. A DATABASE_RECORD retrieved years ago still ' +
  'passes the gate; records change, and a caller that cares must compare `retrieved` against its own ' +
  'tolerance.',
]);

// ---------------------------------------------------------------------------- worked example

export function worked() {
  const a = audit(VERIFIED_EXAMPLES);
  const s = share(VERIFIED_EXAMPLES);
  const lines = [];
  lines.push('provenance.mjs - the evidence layer for the molecular zoom');
  lines.push('');
  lines.push(`claims: ${a.total}   publishable: ${a.publishable}   unsourced: ${a.unsourced.length}   labelled holes: ${a.holes.length}`);
  lines.push('by kind: ' + KIND_NAMES.map(k => `${k}=${a.by_kind[k]}`).join('  '));
  lines.push('');
  lines.push('depiction share: ' + s.headline);
  lines.push('');
  lines.push('badges:');
  for (const c of VERIFIED_EXAMPLES) {
    const ch = chip(c);
    lines.push(`  [${ch.label}] ${c.id}`);
    lines.push(`      ${ch.href ?? '(no link: nothing to resolve)'}`);
  }
  if (a.holes.length) {
    lines.push('');
    lines.push('labelled holes:');
    for (const h of a.holes) lines.push(`  ${h.id} - ${h.statement}`);
  }
  lines.push('');
  lines.push('THE_RULE: ' + THE_RULE.one_line);
  return lines.join('\n');
}

// Run worked() only when this file IS the entry point. The obvious spelling - endsWith('provenance.mjs')
// - is wrong, because 'test-provenance.mjs' also ends with it, so importing the module from its own
// test printed the whole worked() report above the test output. Compare the basename exactly.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').split('/').pop() === 'provenance.mjs') {
  console.log(worked());
}
