// THE ECOLOGY LAYER: biology permitting an organism is not the world permitting it.
//
// Every other layer in this repository asks whether a design is internally possible -- does the ontology
// allow the parts, do the laws hold, does lift carry the weight, does the stroke move the body. A design can
// pass all of that and still be something that could never exist, because existing is not a property of an
// organism. It is a property of an organism IN A PLACE, surrounded by everything already there and better at
// being there than it is. Most of the organisms biology permits are absent for that reason and no other.
//
// WHAT THIS LAYER DOES, AND THE LINE IT WILL NOT CROSS.
//
// It assembles the ingredients of that question from real records and refuses to finish the sum:
//
//   where        GBIF occurrence records for the design's clade: where that clade is actually recorded,
//                which is the only empirical answer available to "where could this live"
//   community    GBIF occurrences inside a stated geographic box: what is actually there, by how many
//                records, which is presence and sampling effort and NOT abundance
//   interactions GloBI records of what eats, is eaten by, parasitises or hosts the clade, each traceable
//                to the study that reported it
//   pressure     the intersection: which recorded predators of this clade are themselves recorded in the
//                chosen box. Not a prediction -- a list of animals that are both known to eat things like
//                this and known to be there.
//
// It does NOT predict competitive exclusion from any of that, because none of it contains a population
// parameter. Occurrence counts are not abundances. An interaction record is a report that it happened once,
// somewhere, not a functional response. There is no growth rate, no carrying capacity and no competition
// coefficient anywhere in GBIF or GloBI, and a model built by inventing them would be a model of its
// author's expectations wearing the clothes of two public databases.
//
// What it offers instead is the classical criterion with DECLARED parameters, the same bargain as
// flight_support_check: state r, K and the competition coefficients with their sources, and the mutual
// invasibility condition is evaluated exactly; decline to state them and the answer is a refusal naming
// what is missing. The arithmetic is Lotka-Volterra and it is honest about being a two-species
// phenomenological model with no space, no time-varying environment and no evolution.
//
// THE HOLDOUT. A community query over a geographic box returns birds. Aves is this project's frozen
// holdout, so every result is filtered by class before it is written anywhere, the count of what was
// dropped is reported, and no bird name, key or record reaches the repository or the cache.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const VERSION = '0.1.0';
export const SCOPE = 'Where a design\'s clade is actually recorded, what else is recorded there, and what is recorded as eating it -- from GBIF occurrences and GloBI interaction records, each traceable to its source. Occurrence counts are presence and sampling effort, never abundance. No population parameter exists in either database, so competitive exclusion is NOT predicted from them; it is evaluated only from growth rates, carrying capacities and competition coefficients the caller declares with sources, through the Lotka-Volterra mutual invasibility criterion, which is a two-species model with no space, no environmental variation and no evolution.';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CACHE = path.join(HERE, 'cache');
const ROOT = path.resolve(HERE, '..', '..', '..');
const KINDS = ['measured', 'measured-secondhand', 'borrowed', 'derived', 'calibrated', 'assumed'];

// The frozen holdout, read from the same file the rest of the repository reads it from.
let HOLDOUT = { clade: 'Aves', rank: 'class' };
try {
  const ex = JSON.parse(fs.readFileSync(path.join(ROOT, 'holdout', 'exam.json'), 'utf8'));
  if (ex?.clade) HOLDOUT = { clade: ex.clade, rank: ex.rank ?? 'class' };
} catch { /* the default above is the project's holdout; if the file moves, the filter still runs */ }

const queries = [];
let offline = false;
let lastCall = 0;
const PACE_MS = 350; // a free public API, asked at under three calls a second
const sleep = ms => new Promise(r => setTimeout(r, ms));
export function setOffline(v) { offline = !!v; }

/** Every outbound request is cached by URL so a run reproduces offline, and every one is recorded. */
async function api(url, purpose) {
  const key = crypto.createHash('sha256').update(url).digest('hex');
  const file = path.join(CACHE, `${key}.json`);
  const id = `e${String(queries.length + 1).padStart(2, '0')}`;
  if (fs.existsSync(file)) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    queries.push({ id, purpose, url, from: 'cache', rows: Array.isArray(j.results) ? j.results.length : null });
    return j;
  }
  if (offline) { queries.push({ id, purpose, url, from: 'offline-miss', rows: null }); return null; }
  const t0 = Date.now();
  // GBIF rate-limits a client that asks quickly, and a 429 is not a result: it is this tool being a bad
  // citizen of a free public service. Space the calls out, retry a 429 with a growing wait, and give up
  // loudly rather than reporting a gap that is really a throttle.
  let r = null, attempt = 0;
  while (attempt < 4) {
    if (lastCall) { const gap = Date.now() - lastCall; if (gap < PACE_MS) await sleep(PACE_MS - gap); }
    lastCall = Date.now();
    r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'delphisci/0.1 (research; ecology layer)' } });
    if (r.status !== 429) break;
    attempt++;
    await sleep(1500 * attempt * attempt);
  }
  if (!r || !r.ok) { queries.push({ id, purpose, url, from: r?.status === 429 ? 'rate-limited' : 'error', status: r?.status ?? null, attempts: attempt + 1 }); return null; }
  const j = await r.json();
  // THE HOLDOUT SCREEN RUNS BEFORE THE CACHE WRITE, NOT AFTER.
  //
  // This was the second-worst kind of bug: the filter downstream worked perfectly, every result was clean,
  // and the raw responses were being written to disk unfiltered on the way past. A first unscoped community
  // query over a well-surveyed box returned 28 bird species, all 28 were correctly dropped from the result,
  // and all 28 were already in sim-engine/validate/ecology/cache/ by then -- about to be committed. The
  // frozen holdout is a rule about what may be IN this repository, not about what may appear in a result.
  if (holdoutInResponse(j)) {
    queries.push({ id, purpose, url, from: 'holdout-filtered', note: `the response is a record inside ${HOLDOUT.clade}, the frozen holdout. It was NOT written to the cache and is not returned.` });
    return null;
  }
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(j));
  queries.push({ id, purpose, url, from: 'network', ms: Date.now() - t0, rows: Array.isArray(j.results) ? j.results.length : null });
  return j;
}

/**
 * Is this response a record of something inside the frozen holdout clade?
 *
 * Deliberately checked on the RANK FIELDS rather than by searching the text: a GloBI scope string saying
 * "no Aves data (frozen holdout)" is a refusal and must stay cacheable, while a GBIF species record whose
 * class is Aves is a bird and must not be written anywhere. Occurrence counts and facet responses carry no
 * taxonomy at all and pass; the species lookups are where the records are.
 */
function holdoutInResponse(j) {
  if (!j || typeof j !== 'object') return false;
  const ranks = o => [o?.kingdom, o?.phylum, o?.class, o?.order, o?.family, o?.genus].filter(Boolean);
  if (ranks(j).includes(HOLDOUT.clade)) return true;
  if (Array.isArray(j.results) && j.results.some(x => ranks(x).includes(HOLDOUT.clade))) return true;
  return false;
}

const GBIF = 'https://api.gbif.org/v1';
const GLOBI = 'https://api.globalbioticinteractions.org';

function readQ(name, v, unit) {
  if (v == null) return { ok: false, why: `${name} was not given. It cannot be defaulted: a carrying capacity or a competition coefficient chosen by this tool would be this tool's expectation reported as ecology.` };
  if (typeof v === 'number') return { ok: false, why: `${name} was given as a bare number (${v} ${unit}) with no source.` };
  const src = typeof v.source === 'string' && v.source.trim() ? v.source.trim() : null;
  if (!src) return { ok: false, why: `${name} has no \`source\`.` };
  const given = typeof v.kind === 'string' ? v.kind.trim() : '';
  if (given && !KINDS.includes(given)) return { ok: false, why: `${name} has kind "${given}", which is not one of ${KINDS.join(', ')}.` };
  if (typeof v.value !== 'number' || !Number.isFinite(v.value)) return { ok: false, why: `${name} needs a numeric \`value\`.` };
  return { ok: true, value: v.value, unit, kind: given || 'assumed', source: src };
}

/**
 * @param {object} a
 *   taxon      the design's clade, as a scientific name GBIF can match
 *   where      optional { name, bbox: [latMin, latMax, lonMin, lonMax], source } -- the place to ask about.
 *              Without it the layer reports where the clade is recorded and asks for a place.
 *   community_limit  how many co-occurring species to resolve (default 12)
 *   competition      optional, for the invasion criterion:
 *                    { resident: { name, K, r }, invader: { K, r }, alpha_invader_on_resident,
 *                      alpha_resident_on_invader }  each number as {value, source}
 */
export async function ecologyCheck(a = {}) {
  queries.length = 0;
  const base = { tool: 'ecology_check', version: VERSION, taxon: a.taxon ?? null, ran: false };
  if (!a.taxon) return { ...base, verdict: 'cannot-evaluate', reason: 'no taxon. The question "could this exist" is a question about a clade in a place, and without the clade there is nothing to look up.' };

  // ---------------------------------------------------------------- 1. is the design's clade itself the holdout?
  const match = await api(`${GBIF}/species/match?name=${encodeURIComponent(a.taxon)}`, `GBIF: resolve "${a.taxon}" to a backbone key`);
  // A refusal has to say WHICH refusal it is. "Could not match" and "matched, and is inside the clade this
  // project may not read" are different facts about the world, and reporting the second as the first would
  // hide the holdout behind what looks like a gap in GBIF.
  if (queries[queries.length - 1]?.from === 'holdout-filtered') return { ...base, verdict: 'refused',
    reason: `"${a.taxon}" resolves to a taxon inside ${HOLDOUT.clade}, this project's frozen holdout. The record was not written to the cache and is not returned. This is not a gap in GBIF: the name matched, and the match is one this repository may not read.`, queries };
  if (!match || !match.usageKey) return { ...base, verdict: 'cannot-evaluate',
    reason: `GBIF could not match "${a.taxon}" to its backbone taxonomy${offline ? ' and this run is offline, so the lookup was not attempted' : ''}. Without a key there are no occurrence records to read.`, queries };
  if (match.class === HOLDOUT.clade || match.phylum === HOLDOUT.clade || match.kingdom === HOLDOUT.clade) {
    return { ...base, verdict: 'refused',
      reason: `"${a.taxon}" is inside ${HOLDOUT.clade}, this project's frozen holdout. No occurrence or interaction record for it may be read.`, queries };
  }
  const resolved = { name: match.scientificName, canonical: match.canonicalName ?? match.species ?? match.scientificName, key: match.usageKey, rank: match.rank, status: match.status,
    kingdom: match.kingdom ?? null, phylum: match.phylum ?? null, class: match.class ?? null, order: match.order ?? null, family: match.family ?? null,
    confidence: match.confidence ?? null,
    note: match.status && match.status !== 'ACCEPTED' ? `GBIF reports this name as ${match.status}; the accepted name it maps to is what the records are counted under.` : null };

  // ---------------------------------------------------------------- 2. where is this clade actually recorded?
  const occ = await api(`${GBIF}/occurrence/search?taxonKey=${resolved.key}&limit=0&facet=country&facetLimit=12`, `GBIF: how many occurrence records exist for ${resolved.name}, and in which countries`);
  const recorded = occ ? {
    total_records: occ.count,
    countries: (occ.facets?.find(f => f.field === 'COUNTRY')?.counts ?? []).map(c => ({ country: c.name, records: c.count })),
    reading: occ.count === 0
      ? `GBIF holds NO occurrence records for ${resolved.name}. That is not evidence of absence: laboratory organisms, microbes and anything not collected by a naturalist are systematically under-recorded in occurrence databases. It means this layer cannot say where the clade is from records.`
      : `GBIF holds ${occ.count.toLocaleString('en-US')} occurrence records for ${resolved.name}, concentrated in ${(occ.facets?.[0]?.counts ?? []).slice(0, 3).map(c => c.name).join(', ')}.`,
    caveat: 'Occurrence records are presence and collector effort. They are heavily biased toward wealthy countries, roadsides, protected areas and charismatic taxa. A blank map is a map of where nobody looked as often as it is a map of where the organism is not.',
  } : null;

  // ---------------------------------------------------------------- 3. what is actually in the chosen place?
  let community = null, holdoutDropped = 0;
  if (a.where?.bbox) {
    const [latMin, latMax, lonMin, lonMax] = a.where.bbox;
    const box = `decimalLatitude=${latMin},${latMax}&decimalLongitude=${lonMin},${lonMax}`;
    const lim = Math.min(Math.max(Number(a.community_limit ?? 12), 1), 40);
    // SCOPE THE COMMUNITY TO THE DESIGN'S OWN CLASS, and say so.
    //
    // Two reasons, one ecological and one about this project. Ecologically, "what else is here" is not a
    // useful question when the answer is every organism anyone has ever recorded in the box: the taxa that
    // compete with an insect for an insect's living are other insects, and ranking them against trees and
    // mammals by record count tells you about naturalists rather than about the place. And for this
    // project: GBIF's occurrence counts are dominated by bird records -- in a well-surveyed terrestrial box
    // the top 28 species by record count were ALL Aves, which is the frozen holdout, so an unscoped query
    // returns a community that is entirely unusable here. Scoping by class fixes both, and the holdout
    // filter below stays as a backstop rather than as the thing doing the work.
    const scopeKey = a.community_within_key ?? match.classKey ?? match.phylumKey ?? match.kingdomKey ?? null;
    const scopeName = a.community_within ?? resolved.class ?? resolved.phylum ?? resolved.kingdom ?? null;
    const scoped = scopeKey ? `&${match.classKey && scopeKey === match.classKey ? 'classKey' : 'taxonKey'}=${scopeKey}` : '';
    const fac = await api(`${GBIF}/occurrence/search?${box}${scoped}&limit=0&facet=speciesKey&facetLimit=${lim + 10}`,
      `GBIF: which ${scopeName ?? ''} species are recorded inside ${a.where.name ?? 'the stated box'}`.replace('  ', ' '));
    const counts = fac?.facets?.find(f => f.field === 'SPECIES_KEY')?.counts ?? [];
    const rows = [];
    for (const c of counts) {
      if (rows.length >= lim) break;
      const sp = await api(`${GBIF}/species/${c.name}`, `GBIF: name of species key ${c.name}`);
      if (!sp) continue;
      // THE HOLDOUT FILTER. A box query returns birds; none of them may be written anywhere.
      if (sp.class === HOLDOUT.clade || sp.phylum === HOLDOUT.clade) { holdoutDropped++; continue; }
      rows.push({ species: sp.scientificName ?? sp.canonicalName, key: c.name, records: c.count,
        kingdom: sp.kingdom ?? null, class: sp.class ?? null, order: sp.order ?? null, family: sp.family ?? null });
    }
    community = {
      where: { name: a.where.name ?? null, bbox: a.where.bbox, source: a.where.source ?? 'stated by the caller without a source' },
      scoped_to: scopeName ? { clade: scopeName, key: scopeKey,
        why: `The community is the design's own class, not everything recorded in the box. Taxa that compete with ${resolved.canonical} for its living are other ${scopeName}; ranking them against every plant and vertebrate by record count measures naturalists rather than the place. An unscoped query over a well-surveyed terrestrial box returns almost nothing but ${HOLDOUT.clade}, which this project may not read.` } : null,
      total_records_in_box: fac?.count ?? null,
      species: rows,
      holdout_filtered: { clade: HOLDOUT.clade, species_dropped: holdoutDropped,
        note: `${holdoutDropped} species inside ${HOLDOUT.clade} were returned by GBIF for this box and were dropped before anything was written (with the community scoped to a non-${HOLDOUT.clade} class this should be zero, and a non-zero count means the scoping did not apply). ${HOLDOUT.clade} is the frozen holdout; no name, key or record from it enters this repository. The community below is therefore INCOMPLETE BY DESIGN, and in most terrestrial boxes that is a large and ecologically central omission.` },
      caveat: 'Ranked by number of occurrence records, which is the number of times somebody recorded it, not how many there are. A common unrecorded species sits below a rare well-surveyed one.',
    };
  }

  // ---------------------------------------------------------------- 4. what is recorded as interacting with it?
  const inter = {};
  for (const type of ['eatenBy', 'eats', 'interactsWith']) {
    const j = await api(`${GLOBI}/taxon/${encodeURIComponent(resolved.canonical)}/${type}`, `GloBI: what is recorded as ${type} ${resolved.canonical}`);
    if (!j?.data) { inter[type] = { records: 0, taxa: [], note: 'no records returned' }; continue; }
    const taxa = [];
    for (const row of j.data) {
      const [, itype, targets] = row;
      for (const t of (Array.isArray(targets) ? targets : [targets])) {
        if (typeof t === 'string' && t.trim() && !taxa.some(x => x.taxon === t)) taxa.push({ taxon: t, interaction: itype });
      }
    }
    inter[type] = { records: j.data.length, taxa: taxa.slice(0, 60), total_taxa: taxa.length,
      source: `Global Biotic Interactions (GloBI), ${GLOBI}/taxon/${resolved.canonical}/${type}` };
  }
  // WHAT KIND OF RELATIONSHIP, not just how many. GloBI labels every record with an interaction type, and
  // the types answer different questions: being eaten is not being parasitised is not being pollinated. A
  // design is asked whether it would be outcompeted, eaten, or able to strike up something mutual, and the
  // three have different evidence behind them, so they are reported apart rather than summed into a count
  // of "interactions". The grouping below is ours; the types and the taxa are GloBI's.
  const KIND = {
    eaten: ['preyedUponBy', 'eatenBy', 'killedBy'],
    eats: ['eats', 'preysOn', 'kills'],
    parasitised_by: ['hasParasite', 'hasPathogen', 'hasEctoparasite', 'hasEndoparasite', 'parasitizedBy'],
    parasitises: ['parasiteOf', 'pathogenOf', 'ectoParasiteOf', 'endoParasiteOf'],
    mutualism_or_symbiosis: ['pollinates', 'pollinatedBy', 'mutualistOf', 'symbiontOf', 'hasSymbiont', 'commensalistOf', 'hasHost', 'visitsFlowersOf', 'flowersVisitedBy'],
    hosts: ['hostOf'],
    other: ['interactsWith', 'adjacentTo', 'coOccursWith'],
  };
  const seen = new Map();
  for (const [bucket, types] of Object.entries(inter)) {
    if (!types?.taxa) continue;
    for (const t of types.taxa) {
      const k = Object.entries(KIND).find(([, list]) => list.includes(t.interaction))?.[0] ?? 'other';
      if (!seen.has(k)) seen.set(k, new Map());
      if (!seen.get(k).has(t.taxon)) seen.get(k).set(t.taxon, t.interaction);
    }
  }
  const relationships = Object.fromEntries([...seen.entries()].map(([k, m]) => [k,
    { count: m.size, taxa: [...m.entries()].slice(0, 40).map(([taxon, interaction]) => ({ taxon, interaction })) }]));
  const unmapped = [...new Set(Object.values(inter).flatMap(b => (b.taxa ?? []).map(t => t.interaction)))]
    .filter(t => !Object.values(KIND).flat().includes(t));

  const interactions = { ...inter, relationships,
    relationships_note: `Grouped from GloBI's own interaction types. ${relationships.eaten?.count ?? 0} taxa recorded eating this clade, ${relationships.parasitised_by?.count ?? 0} recorded parasitising it, ${relationships.mutualism_or_symbiosis?.count ?? 0} in a recorded mutualistic or symbiotic relationship with it, ${relationships.hosts?.count ?? 0} it is recorded hosting. COMPETITION IS NOT AMONG THEM, and that is not an oversight: competition is the one ecological relationship that leaves almost no direct observational trace, because it is two organisms NOT doing something to each other. GloBI records interactions that somebody watched happen. Nobody watches an exclusion.${unmapped.length ? ` Types this grouping does not recognise, left in "other": ${unmapped.join(', ')}.` : ''}`,
    caveat: 'An interaction record says it was observed at least once and reported. It is not a rate, not a preference, and not evidence that it happens where you are asking about. GloBI aggregates many datasets of very different quality, and the absence of a record is usually absence of a study.' };

  // ---------------------------------------------------------------- 5. the intersection: pressure actually present
  let pressure = null;
  if (community && inter.eatenBy?.taxa?.length) {
    const here = community.species.map(s => s.species);
    const hereGenus = new Set(here.map(n => String(n).split(' ')[0]));
    const present = inter.eatenBy.taxa.filter(t => here.includes(t.taxon) || hereGenus.has(String(t.taxon).split(' ')[0]));
    pressure = {
      recorded_predators_of_this_clade: inter.eatenBy.total_taxa,
      of_which_recorded_in_this_box: present.length,
      taxa: present,
      reading: present.length
        ? `${present.length} of the ${inter.eatenBy.total_taxa} taxa GloBI records as eating ${resolved.name} are themselves recorded in ${community.where.name ?? 'this box'}. That is a list of animals known to eat things like this and known to be here. It is not a predation rate and does not become one by being counted.`
        : `None of the ${inter.eatenBy.total_taxa} taxa GloBI records as eating ${resolved.name} appear in this box's top ${community.species.length} by record count. Read that as a gap in two databases before reading it as an empty niche: the box list is truncated, record-ranked and missing every ${HOLDOUT.clade} species.`,
    };
  }

  // ---------------------------------------------------------------- 6. can it invade? only from declared parameters
  const competition = await invasion(a.competition, resolved);

  const ran = !!(recorded || community || interactions);
  return { ...base, ran, verdict: competition?.verdict ?? (community ? 'assembled' : 'assembled-without-a-place'),
    resolved, recorded_range: recorded, community, interactions, predation_pressure: pressure, competition,
    queries,
    reading: [
      recorded?.reading,
      community ? `In ${community.where.name ?? 'the stated box'} GBIF holds ${community.total_records_in_box?.toLocaleString('en-US')} records; the ${community.species.length} most-recorded non-${HOLDOUT.clade} species are listed.` : 'No place was given, so there is no community to compare against: pass `where` with a bounding box.',
      pressure?.reading,
      competition ? competition.reading : 'No population parameters were declared, so whether this design could establish against what is there has NOT been evaluated. That question needs numbers no occurrence database contains.',
    ].filter(Boolean).join(' '),
    what_this_cannot_say: [
      'whether the design would be outcompeted: that needs growth rates, carrying capacities and competition coefficients, and none of them is in an occurrence record or an interaction record',
      'how abundant anything is: occurrence counts are records, which is sampling effort as much as biology',
      'whether the design could eat what is there, or be eaten by what is there: the interaction records are for its CLADE, and a design is by construction not its clade',
      'anything about the places nobody has surveyed, which is most places',
      `anything about ${HOLDOUT.clade}, which is filtered out of every result here by design and is a central part of most terrestrial communities`,
    ] };
}

/**
 * Lotka-Volterra mutual invasibility, from declared parameters only.
 *
 *   dN1/dt = r1 N1 (K1 - N1 - a12 N2) / K1
 *
 * A species invades when rare against a resident sitting at its own carrying capacity if its per-capita
 * growth rate is positive there. For the invader against resident at N_res = K_res that is
 * K_inv - a_res_on_inv * K_res > 0, and symmetrically for the resident against the invader.
 *   both invade      -> coexistence
 *   neither          -> founder control: whichever arrives first excludes the other
 *   one only         -> that one excludes the other
 */
async function invasion(c, resolved) {
  if (!c) return null;
  const need = {
    'invader K': readQ('competition.invader.K', c.invader?.K, 'individuals'),
    'resident K': readQ('competition.resident.K', c.resident?.K, 'individuals'),
    'alpha, resident on invader': readQ('competition.alpha_resident_on_invader', c.alpha_resident_on_invader, '1'),
    'alpha, invader on resident': readQ('competition.alpha_invader_on_resident', c.alpha_invader_on_resident, '1'),
  };
  const bad = Object.entries(need).filter(([, v]) => !v.ok);
  if (bad.length) return { verdict: 'cannot-evaluate',
    reason: bad.map(([k, v]) => `${k}: ${v.why}`).join(' | '),
    what_is_missing: bad.map(([k]) => k),
    reading: `Whether this design could establish against ${c.resident?.name ?? 'the resident'} was NOT evaluated: ${bad.length} of the four parameters the criterion needs were not declared with sources. They do not exist in GBIF or GloBI and this tool will not supply them.` };
  const Ki = need['invader K'].value, Kr = need['resident K'].value;
  const aRI = need['alpha, resident on invader'].value, aIR = need['alpha, invader on resident'].value;
  const invaderCan = Ki - aRI * Kr > 0;
  const residentCan = Kr - aIR * Ki > 0;
  const outcome = invaderCan && residentCan ? 'coexistence'
    : !invaderCan && !residentCan ? 'founder-control'
      : invaderCan ? 'invader-excludes-resident' : 'resident-excludes-invader';
  return {
    verdict: outcome === 'resident-excludes-invader' ? 'outcompeted'
      : outcome === 'coexistence' ? 'can-coexist'
        : outcome === 'invader-excludes-resident' ? 'can-establish-and-displace' : 'priority-dependent',
    outcome, invader_can_invade_when_rare: invaderCan, resident_can_invade_when_rare: residentCan,
    criterion: { invader: `K_inv - a(res on inv) * K_res = ${fmtn(Ki - aRI * Kr)}`, resident: `K_res - a(inv on res) * K_inv = ${fmtn(Kr - aIR * Ki)}` },
    parameters: Object.fromEntries(Object.entries(need).map(([k, v]) => [k, { value: v.value, kind: v.kind, source: v.source }])),
    resident: c.resident?.name ?? null,
    reading: outcome === 'resident-excludes-invader'
      ? `Against ${c.resident?.name ?? 'the resident'}, the design CANNOT invade when rare: at the resident's carrying capacity its per-capita growth rate is negative. It is excluded, on these parameters.`
      : outcome === 'coexistence'
        ? `Both species can increase when rare against the other, so on these parameters they coexist. Each limits itself more than it limits the other.`
        : outcome === 'invader-excludes-resident'
          ? `The design can invade when rare and the resident cannot invade against it: on these parameters the design displaces ${c.resident?.name ?? 'the resident'}.`
          : `Neither can invade against the other, so the outcome depends on which arrives first. On these parameters the design establishes only if it gets there first.`,
    model_caveat: 'Lotka-Volterra two-species competition: phenomenological, no space, no age structure, no environmental variation, no evolution, no third species, and one competition coefficient standing for every way two organisms can get in each other\'s way. The outcome above is a property of the four numbers that were declared. It is as good as they are and no better, and every one of them is an input to this result rather than an output of it.',
  };
}

const fmtn = x => (Math.abs(x) >= 1000 || (Math.abs(x) < 0.01 && x !== 0) ? x.toExponential(3) : String(Math.round(x * 1e4) / 1e4));
