// CORROBORATION: take this project's own molecular statements to the literature's assembled causal
// graph, and record what comes back - including when what comes back is nothing.
//
// ============================== THE ONE RULE ==============================
// Four different things look like "no" and only one of them is evidence:
//
//   absent-and-dense          no relation, and both entities have rich neighbourhoods  -> a real negative
//   absent-but-sparse         no relation, and an entity has almost nothing            -> uninformative
//   absent-density-unknown    no relation, and the density probe could not run         -> no verdict yet
//   out-of-scope              the namespace holds zero nodes in that graph             -> not asked
//   unavailable               the service did not answer                               -> not asked
//
// Collapsing any of these into "refuted" would be the single worst thing this module could do, because
// the output is destined for records that other people cite.
//
// ============================== WHAT IT IS ALLOWED TO CONCLUDE ==============================
// Nothing, on its own. A missing relation in CoGEx means the assembled literature does not contain that
// statement; it does not mean the statement is false. A present relation means somebody wrote it down,
// possibly once, possibly in a paper later retracted - which is why every verdict carries the evidence
// profile and never a bare count.

import * as G from './cogex.mjs';

export const WHAT_THIS_IS =
  'A corroboration pass over the project\'s grounded molecular statements against INDRA CoGEx. It ' +
  'produces a verdict per pair with the evidence behind it, and it distinguishes five different kinds of ' +
  '"nothing found". It concludes nothing by itself: a statement absent from the assembled literature is ' +
  'not a false statement.';

/** Namespaces that denote a molecule or a gene product - the only things CoGEx carries relations between. */
const MOLECULAR = new Set(['HGNC', 'UP', 'UNIPROT', 'CHEBI', 'FPLX', 'PUBCHEM', 'CHEMBL', 'DRUGBANK', 'HMDB', 'MGI', 'ZFIN', 'ENSEMBL', 'NCBIGENE']);

const toCurie = id => {
  const s = String(id ?? '');
  const i = s.indexOf(':');
  return i < 0 ? s : `${s.slice(0, i).toLowerCase()}:${s.slice(i + 1)}`;
};

/** Pairs worth asking about, in two clearly separated classes. */
export function candidatePairs(records) {
  const asserted = [], coMention = [], selfLoops = [];
  for (const rec of records) {
    const st = rec.statement;
    // class 1: a typed statement we actually assert, with both sides grounded to a molecule
    if (st && st.family === 'indra' && st.subject?.id && st.object?.id) {
      const a = toCurie(st.subject.id), b = toCurie(st.object.id);
      const row = {
        record_id: rec.id, kind: 'asserted', asserted_type: st.type,
        a, b, a_name: st.subject.name ?? null, b_name: st.object.name ?? null,
        a_text: st.subject.text ?? null, b_text: st.object.text ?? null,
        draft: String(rec.id).startsWith('draft:'),
      };
      if (a === b) selfLoops.push({ ...row, why_excluded: 'subject and object ground to the SAME entity, so there is no pair to ask about. A self-loop is a degenerate extraction, not a molecular claim, and it should be fixed upstream rather than queried.' });
      else asserted.push(row);
      continue;
    }
    // class 2: two molecular entities co-mentioned in one record. NOT a statement we assert - but asking
    // whether the literature already relates them is cheap and occasionally surprising.
    const mol = (rec.entities ?? []).filter(e => MOLECULAR.has(String(e.db).toUpperCase()) && e.id);
    const uniq = [...new Map(mol.map(e => [toCurie(e.id), e])).values()];
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
      coMention.push({
        record_id: rec.id, kind: 'co-mention', asserted_type: null,
        a: toCurie(uniq[i].id), b: toCurie(uniq[j].id),
        a_name: uniq[i].name ?? null, b_name: uniq[j].name ?? null,
        a_text: uniq[i].text ?? null, b_text: uniq[j].text ?? null,
        draft: String(rec.id).startsWith('draft:'),
      });
    }
  }
  return {
    asserted, co_mention: coMention, self_loops: selfLoops,
    the_difference:
      'An ASSERTED pair is a claim this project makes and can therefore be corroborated or contradicted. ' +
      'A CO-MENTION pair is two molecules named in the same record, which this project does not claim are ' +
      'related at all - so a relation found for one is a lead, and the absence of one is not a finding ' +
      'about our record. The two classes must never be pooled into a single corroboration rate.',
  };
}

/** Does the graph's evidence support the type we asserted? */
export function classify(pair, rel, density = {}) {
  if (!rel || rel.status === 'refused') {
    return {
      verdict: 'out-of-scope',
      why: rel?.refused_because?.join(' ') ?? 'the pair was not askable',
      is_this_evidence_against_our_claim: false,
      because: 'nothing was asked. A namespace with zero nodes in the target graph cannot answer a question about its contents.',
    };
  }
  if (rel.status === 'unavailable') {
    return {
      verdict: 'unavailable', why: rel.why,
      is_this_evidence_against_our_claim: false,
      because: 'the service did not answer. An unavailable graph is not an empty graph.',
      retry: true,
    };
  }
  const p = rel.profile;
  if (p.n_relations === 0) {
    const dA = density.a, dB = density.b;
    const known = dA?.status === 'ok' && dB?.status === 'ok';
    if (!known) {
      return {
        verdict: 'absent-density-unknown',
        why: 'no relation between these entities, and the density probe could not establish whether either entity has a rich neighbourhood.',
        is_this_evidence_against_our_claim: false,
        because: 'a zero between two entities only means something if the entities are otherwise well connected. Without that, the zero is indistinguishable from a sparsely covered corner of the graph.',
        density: { a: dA?.status ?? 'not run', b: dB?.status ?? 'not run' },
      };
    }
    const dense = dA.dense && dB.dense;
    return {
      verdict: dense ? 'absent-and-dense' : 'absent-but-sparse',
      why: dense
        ? `no relation between these entities, although both have rich neighbourhoods (at least ${dA.distinct_partner_ids_lower_bound} and ${dB.distinct_partner_ids_lower_bound} distinct partners in a bounded probe).`
        : `no relation between these entities, and at least one of them is sparsely represented (${dA.distinct_partner_ids_lower_bound} and ${dB.distinct_partner_ids_lower_bound} distinct partners in a bounded probe).`,
      is_this_evidence_against_our_claim: dense,
      because: dense
        ? 'both entities are well covered, so the assembled literature had every opportunity to contain this statement and does not. That is a genuine negative about the statement\'s presence in the literature - though still not proof the statement is false.'
        : 'the absence is as likely to reflect thin coverage of one entity as anything about the statement.',
      density: { a: dA, b: dB },
    };
  }
  // relations exist: is the type we asserted among them, and how well supported?
  const asserted = pair.asserted_type;
  if (!asserted) {
    return {
      verdict: 'related-but-we-asserted-nothing',
      why: `${p.n_relations} relation(s) exist between two entities this project only co-mentions (${p.n_evidence} evidence(s), types: ${Object.keys(p.by_type).join(', ')}).`,
      is_this_evidence_against_our_claim: false,
      because: 'this project makes no claim about this pair, so there is nothing to corroborate. It is a lead: the literature relates two things our record mentions side by side.',
      profile: p,
    };
  }
  const t = p.by_type[asserted];
  const typesByEvidence = Object.entries(p.by_type).sort((x, y) => y[1].evidence - x[1].evidence);
  const modal = typesByEvidence[0]?.[0] ?? null;
  if (!t) {
    return {
      verdict: 'contradicted',
      why: `${p.n_relations} relation(s) exist between these entities, but NOT of the asserted type "${asserted}". Types present: ${Object.keys(p.by_type).join(', ')}.`,
      is_this_evidence_against_our_claim: true,
      because: 'the entities are related in the assembled literature, and the specific relation this project asserts is not among the relations found. That is the strongest negative this module can produce.',
      asserted_type: asserted, modal_type: modal, profile: p,
      caution: 'INDRA statement types are not mutually exclusive and an extraction can land on a neighbouring type (Activation vs IncreaseAmount, Inhibition vs DecreaseAmount). Check by hand before acting on a contradiction.',
    };
  }
  const weak = t.database_backed === 0 && t.evidence <= 2;
  return {
    verdict: weak ? 'corroborated-weakly' : 'corroborated',
    why: weak
      ? `the asserted type "${asserted}" is present but thinly: ${t.relations} relation(s), ${t.evidence} evidence(s), none database-backed, max belief ${t.max_belief.toFixed(3)}.`
      : `the asserted type "${asserted}" is present with ${t.relations} relation(s) and ${t.evidence} evidence(s), ${t.database_backed} database-backed, max belief ${t.max_belief.toFixed(3)}.`,
    is_this_evidence_against_our_claim: false,
    because: weak
      ? 'the assembled literature contains the statement, but thinly enough that it may rest on one or two automated readings of single sentences. Corroboration at this strength is a reason not to worry, not a reason to upgrade the claim.'
      : `the assembled literature contains this statement${modal === asserted ? ' and it is the best-supported relation between these two entities' : `, though the best-supported relation between them is "${modal}" rather than the asserted type`}. That is corroboration of PRESENCE in the literature, which is not the same as the statement being true.`,
    asserted_type: asserted,
    asserted_type_is_modal: modal === asserted,
    modal_type: modal,
    profile: p,
    caution: p.relations_with_retracted_evidence > 0
      ? `${p.relations_with_retracted_evidence} relation(s) here have evidence from a RETRACTED paper. Treat as absent until checked by hand.`
      : null,
  };
}

// ---------------------------------------------------------------------------------------------------
// GROUNDING SUSPICION: before reading a negative as a negative, ask whether the two things being
// compared are the two things the claim was about.
//
// The first full run over 46 pairs produced 8 absent-and-dense verdicts, and inspecting them showed that
// several were not about our claims at all. Among the entity pairs the pipeline had grounded:
//
//   "gas"       -> chebi:30778  gallic acid          (from a cellular-automaton text)
//   "star"      -> hgnc:11359   STAR                 (same text; the word was lowercase)
//   "arc"       -> a gene                            (from a text about a geometric arc)
//   "salt"      -> chebi:24866  salt                 (correct, and useless as a molecular entity)
//   "solutions" -> chebi:75958  solution             (same)
//
// A zero relation count between "gallic acid" and "STAR" says nothing whatsoever about a claim concerning
// gases and stars in a cellular automaton. Reporting it as a negative about that claim would be worse
// than reporting nothing, so a suspicion flag suppresses the negative rather than sitting beside it.
// ---------------------------------------------------------------------------------------------------

/** Words that denote a CLASS of substance rather than a substance. Grounding them is not wrong; using
 *  the result as one end of a molecular relation is. */
export const GENERIC_SUBSTANCE_WORDS = new Set([
  'salt', 'salts', 'solution', 'solutions', 'base', 'bases', 'acid', 'acids', 'gas', 'gases', 'ligand',
  'ligands', 'atom', 'atoms', 'ion', 'ions', 'protein', 'proteins', 'water', 'sugar', 'sugars', 'metal',
  'metals', 'oil', 'oils', 'fat', 'fats', 'mineral', 'minerals', 'molecule', 'molecules', 'crystal',
  'crystals', 'fluid', 'fluids', 'element', 'elements', 'compound', 'compounds', 'substance', 'cell',
  'cells', 'tissue', 'enzyme', 'enzymes', 'receptor', 'receptors', 'hormone', 'hormones',
]);

const squash = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Reasons to distrust a grounded pair, strongest first. */
export function groundingSuspicion(pair) {
  const flags = [];
  for (const side of ['a', 'b']) {
    const text = pair[`${side}_text`], name = pair[`${side}_name`], curie = pair[side];
    if (!text) continue;
    const t = squash(text), n = squash(name);
    // 1. the grounded entity's name has nothing in common with the words that were grounded
    if (t && n && !n.includes(t) && !t.includes(n)) {
      flags.push({ side, severity: 'high', kind: 'name-mismatch', detail: `the text "${text}" was grounded to "${name}" (${curie}), and neither string contains the other. A fuzzy match at this distance is usually a different concept.` });
      continue;
    }
    // 2. a class term used as if it were a molecule
    if (GENERIC_SUBSTANCE_WORDS.has(String(text).toLowerCase())) {
      flags.push({ side, severity: 'high', kind: 'generic-class-term', detail: `"${text}" names a CLASS of substance, not a substance. It grounds cleanly (${curie}) and is useless as one end of a molecular relation.` });
      continue;
    }
    // 3. a short lowercase token grounded to a gene symbol: the classic acronym collision
    if (/^[a-z]{2,4}$/.test(String(text)) && /^(hgnc|uniprot|up):/i.test(String(curie))) {
      flags.push({ side, severity: 'medium', kind: 'short-token-to-gene', detail: `the lowercase token "${text}" was grounded to the gene ${name} (${curie}). Three- and four-letter words collide with gene symbols constantly, and the source text being lowercase is evidence against the gene reading.` });
    }
  }
  const high = flags.filter(f => f.severity === 'high');
  return {
    suspicious: flags.length > 0,
    suppresses_a_negative: high.length > 0,
    flags,
    why_it_suppresses:
      high.length > 0
        ? 'a verdict about these two grounded entities is not a verdict about the claim, because at least one entity is probably not what the claim was about. The graph answer is kept for inspection and must not be counted as evidence either way.'
        : null,
  };
}

// ---------------------------------------------------------------------------------------------------
// EXPRESSIBILITY: before asking whether the graph agrees, ask whether our statement is the kind of thing
// the graph can hold at all.
//
// This check exists because of what the first live run found. Record `thompson1917-ch09-06` is typed
// IncreaseAmount(ALB -> calcium carbonate), and CoGEx returned a clean absent-and-dense negative for it.
// But the claim's own statement text reads "Albumin increases the SOLUBILITY of calcium carbonate and
// phosphate". Increasing the solubility of a salt is not increasing its amount - if anything it is the
// opposite, since a more soluble salt precipitates less. INDRA has no statement type for solubility, so
// the claim is not expressible as an INDRA statement at all, and typing it IncreaseAmount to fit the
// vocabulary quietly changed what the claim says.
//
// So a negative from the graph can mean three different things, and the third is the one worth catching:
// the literature disagrees, OR nobody wrote it down, OR WE ASKED THE WRONG QUESTION.
// ---------------------------------------------------------------------------------------------------

/** Relation words that INDRA's vocabulary cannot express. Each is a physicochemical or biophysical
 *  property, not a causal influence on an amount or an activity. */
export const NOT_EXPRESSIBLE_AS_INDRA = [
  'solubility', 'soluble', 'insoluble', 'precipitat', 'viscosity', 'permeability', 'elasticity',
  'stiffness', 'osmolarity', 'osmotic', 'surface tension', 'diffusivity', 'buoyan', 'turgor',
  'refractive', 'conductivity', 'hardness', 'tensile', 'porosity', 'wettab',
];

/** INDRA's own type vocabulary, as used by this repository's relations table. */
export const INDRA_TYPES = [
  'Phosphorylation', 'Dephosphorylation', 'Ubiquitination', 'Acetylation', 'Methylation',
  'Activation', 'Inhibition', 'IncreaseAmount', 'DecreaseAmount', 'Complex', 'Translocation',
  'Conversion', 'Association', 'Influence',
];

export function expressibility(record) {
  const st = record?.statement;
  if (!st || st.family !== 'indra') return { checked: false, why: 'not an INDRA-family statement' };
  // `text` is where this repo keeps the claim sentence; the others are checked so the function does not
  // depend on one record shape.
  const text = `${record.text ?? ''} ${record.label ?? ''} ${record.statement_text ?? ''} ${record.quote ?? ''} ${record.claim ?? ''}`.toLowerCase();
  const hits = NOT_EXPRESSIBLE_AS_INDRA.filter(w => text.includes(w));
  if (!hits.length) return { checked: true, risk: 'none', asserted_type: st.type };
  return {
    checked: true, risk: 'TYPE MAY NOT BE EXPRESSIBLE',
    asserted_type: st.type,
    words_found: hits,
    trigger: st.trigger ?? null,
    typed_by_rule: st.rule ?? null,
    why:
      `the claim's own words include ${hits.map(h => `"${h}"`).join(', ')}, which INDRA's vocabulary has ` +
      `no statement type for. It was typed "${st.type}" anyway, which is the closest available label ` +
      `rather than the claim's meaning.`,
    how_the_mistyping_happens:
      st.trigger
        ? `the type came from a regex on the trigger word "${st.trigger}" plus the two nearest grounded ` +
          `molecular entities. That pattern cannot see WHAT is being increased: in "A increases the ` +
          `solubility of B" the grammatical object of the verb is the property, not B, and the rule reads ` +
          `it as if it were B.`
        : null,
    consequence:
      'a corroboration result for this pair answers a question the claim did not ask. Both a positive and ' +
      'a negative are uninterpretable until the typing is fixed or the record stops carrying an INDRA ' +
      'statement at all.',
    what_to_do: 'drop the INDRA-family statement from the record, or extend the relations table with a property-change family that does not pretend to be a causal INDRA type.',
  };
}

/** Run the pass. Hits the network unless `relationsBetween`/`densityProbe` are injected. */
export async function report(records, {
  include_co_mentions = false,
  max_pairs = 50,
  relationsBetween = G.relationsBetween,
  densityProbe = G.densityProbe,
} = {}) {
  const cands = candidatePairs(records);
  const pairs = include_co_mentions ? [...cands.asserted, ...cands.co_mention] : cands.asserted;
  const capped = pairs.slice(0, max_pairs);
  const dropped = pairs.length - capped.length;
  const byId = new Map(records.map(r => [r.id, r]));
  const densityCache = new Map();
  const results = [];
  for (const pair of capped) {
    const rel = await relationsBetween(pair.a, pair.b);
    let density = {};
    if (rel.status === 'ok' && rel.profile.n_relations === 0) {
      for (const side of ['a', 'b']) {
        const name = pair[`${side}_name`] ?? pair[`${side}_text`];
        if (!name) { density[side] = { status: 'not run', why: 'no name available to probe with' }; continue; }
        if (!densityCache.has(name)) densityCache.set(name, await densityProbe(name));
        density[side] = densityCache.get(name);
      }
    }
    const suspicion = groundingSuspicion(pair);
    const verdict = classify(pair, rel, density);
    if (suspicion.suppresses_a_negative && verdict.is_this_evidence_against_our_claim) {
      verdict.is_this_evidence_against_our_claim = false;
      verdict.suppressed_by_grounding_suspicion = true;
      verdict.because = `SUPPRESSED. ${suspicion.why_it_suppresses} The graph answer is kept above; the reading it would have supported was: ${verdict.because}`;
    }
    results.push({ ...pair, relations: rel, ...verdict, grounding_suspicion: suspicion, expressibility: expressibility(byId.get(pair.record_id)) });
  }
  const tally = {};
  for (const r of results) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  const mistyped = results.filter(r => r.expressibility?.risk && r.expressibility.risk !== 'none');
  const suspect = results.filter(r => r.grounding_suspicion?.suspicious);
  const suppressed = results.filter(r => r.suppressed_by_grounding_suspicion);
  return {
    what_this_is: WHAT_THIS_IS,
    source: G.SOURCE,
    counts: {
      records_examined: records.length,
      asserted_pairs: cands.asserted.length,
      co_mention_pairs: cands.co_mention.length,
      self_loops_excluded: cands.self_loops.length,
      pairs_queried: capped.length,
      pairs_dropped_by_cap: dropped,
    },
    cap_disclosure: dropped > 0
      ? `${dropped} pair(s) were NOT queried because max_pairs is ${max_pairs}. A tally computed over a capped set is not a coverage figure.`
      : null,
    self_loops: cands.self_loops,
    tally,
    grounding_quality: {
      pairs_with_a_suspect_grounding: suspect.length,
      negatives_suppressed: suppressed.length,
      flags: suspect.map(r => ({ record_id: r.record_id, verdict: r.verdict, pair: `${r.a} (${r.a_text}) / ${r.b} (${r.b_text})`, flags: r.grounding_suspicion.flags })),
      what_this_measures:
        'This is a finding about OUR grounding pipeline, not about CoGEx and not about the claims. A pair ' +
        'whose entities are not what the claim was about produces a graph answer that looks like evidence ' +
        'and is not. The flags are therefore more valuable than the verdicts they suppress.',
    },
    expressibility_warnings: mistyped.map(r => ({ record_id: r.record_id, verdict: r.verdict, ...r.expressibility })),
    read_the_expressibility_warnings_first: mistyped.length > 0
      ? `${mistyped.length} queried pair(s) carry a statement type that may not express what the claim says. For those, BOTH a positive and a negative verdict are uninterpretable, and the verdict above should be ignored until the typing is settled.`
      : null,
    results,
    how_to_read_the_tally:
      'Only `contradicted` and `absent-and-dense` are negatives about our own statements, and only the ' +
      'first is strong. `out-of-scope`, `unavailable` and `absent-density-unknown` are questions that were ' +
      'not answered and must stay in the denominator of any coverage claim rather than being dropped from it.',
  };
}
