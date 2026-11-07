// THE CROSS-GRAPH CLIENT: ask INDRA CoGEx whether the molecular claims in this project are in the
// literature's own causal graph, and REFUSE to ask when the question cannot be asked.
//
// ============================== WHAT THIS IS FOR ==============================
// This project asserts typed molecular statements - "albumin increases the amount of calcium carbonate",
// "sonic hedgehog is inhibited by cyclopamine" - extracted from text and grounded with Gilda. Nothing has
// ever checked them against the literature's own assembled causal graph. CoGEx is that graph: 97.8 M
// nodes and 610.5 M relationships over INDRA statements, measured 2026-11-06.
//
// A corroboration pass is worth more than a grounding pass. Grounding reports a coverage percentage.
// Corroboration can return a NEGATIVE on one of our own claims, and it did so on the first try.
//
// ============================== THE FOUR RULES THIS FILE OBEYS ==============================
// 1. REST FIRST. The deployment exposes 126 keyless POST endpoints AND an MCP endpoint with arbitrary
//    read Cypher. The Cypher tool is tempting and is NOT the supported surface: on 2026-11-06 it was
//    answering in 10-30 ms, and within the hour it returned
//      "Database unavailable: Couldn't connect to 172.31.76.196:7687"
//    - an internal address - while every REST endpoint kept answering correctly. So the REST endpoints
//    are the primary path here and Cypher is an optional extra that may be absent.
// 2. A SERVICE FAILURE IS NOT A NEGATIVE. "no relations found" and "could not ask" must never collapse
//    into the same verdict. They are separate return values and the caller cannot avoid the distinction.
// 3. NO SILENT ORTHOLOGUE BRIDGING. CoGEx is human-centric: zfin 0, zfa 0, ncbitaxon 0, ensembl 0 nodes
//    (uberon has 437). Gilda returns [] for "kcnk5b" while human KCNK5 grounds to hgnc:6280. This
//    project's organism-design work is Danio rerio, so the only route in is a human orthologue - which is
//    an ASSUMPTION ABOUT CONSERVATION, not a lookup. It therefore gets its own function, and the
//    zebrafish path refuses by default.
// 4. A COUNT OF RELATIONS IS NOT EVIDENCE. The REST payload carries belief, evidence_count,
//    has_database_evidence, has_reader_evidence and has_retracted_evidence per relation. Nine relations
//    can be nine single-sentence automated readings. Every verdict here carries the evidence profile, and
//    a count on its own is never returned.
//
// No credential is used and none is needed. No identifier of ours - no email, no account, no project
// name - is sent in any request.

export const SOURCE = {
  service: 'INDRA CoGEx / INDRA Biomedical Discovery Engine',
  operator: 'Gyori Lab, Northeastern University',
  rest_base: 'https://discovery.indra.bio/api',
  mcp: 'https://discovery.indra.bio/mcp',
  grounding: 'https://grounding.indra.bio',
  code_licence: 'BSD 2-Clause (indra_cogex, gilda, indra)',
  data_licence: 'NOT STATED ANYWHERE. /terms, /license and /robots.txt are all 404, the README names no licence for the graph contents, and the INDRA licence page covers only the software. Querying is one thing; redistributing derived sets inside signed records is another, and that question is open.',
  citable_paper: 'NONE FOUND. PubMed returns 0 results for "INDRA CoGEx". A record that leans on this service has to cite the code and the deployment with a retrieval date.',
  measured_size: { nodes: 97832239, relationships: 610528123, bioentity_nodes: 5425420, measured_on: '2026-11-06' },
  stale_figure_to_avoid: 'the widely repeated "54 million nodes / 325 million edges" is roughly 2x stale; it traces to a 2022 talk.',
  auth: 'none. The swagger spec declares no securityDefinitions and no security requirement.',
  rate_limit: 'NONE DOCUMENTED. Ten consecutive anonymous POSTs returned 200 with no 429 and no Retry-After. Absence of a documented limit is not permission to hammer it: this module serialises its calls and defaults to a small page size.',
};

/** Namespaces CoGEx keys BioEntity nodes on, with the node counts measured on 2026-11-06. */
export const IN_SCOPE_NAMESPACES = {
  uniprot: 3041951, 'uniprot.chain': 612415, mesh: 354625, dbsnp: 275317, ncbigene: 272812,
  chebi: 216218, 'pubchem.compound': 202934, chembl: 86863, cas: 65664, hgnc: 49013, go: 46243,
  mondo: 23965, reactome: 22744, hp: 21643, ncit: 20535, interpro: 16870, lspci: 16595, efo: 16260,
  drugbank: 13609, doid: 12904, hmdb: 8088, mirbase: 7570, 'ec-code': 7081, umls: 5483, uberon: 437,
  fplx: 790,
};

/** Namespaces that are ZERO in CoGEx. Asking about one of these is not a miss, it is a category error. */
export const OUT_OF_SCOPE_NAMESPACES = {
  zfin: { nodes: 0, what: 'zebrafish genes' },
  zfa: { nodes: 0, what: 'zebrafish anatomy' },
  ncbitaxon: { nodes: 0, what: 'taxa' },
  ensembl: { nodes: 0, what: 'Ensembl gene ids' },
};

const norm = curie => String(curie ?? '').trim();
export function namespaceOf(curie) {
  const c = norm(curie);
  const i = c.indexOf(':');
  return i < 0 ? null : c.slice(0, i).toLowerCase();
}

/** Is this CURIE askable at all? Returns a refusal with a reason rather than a boolean. */
export function scopeOf(curie) {
  const ns = namespaceOf(curie);
  if (!ns) return { askable: false, reason: `"${curie}" is not a CURIE: no namespace prefix`, kind: 'malformed' };
  if (OUT_OF_SCOPE_NAMESPACES[ns]) {
    const o = OUT_OF_SCOPE_NAMESPACES[ns];
    return {
      askable: false, namespace: ns, kind: 'out-of-scope',
      reason: `CoGEx holds ${o.nodes} nodes in the "${ns}" namespace (${o.what}), measured 2026-11-06. This is not a sparse region of the graph, it is an absent one.`,
      what_to_do: ns === 'zfin' || ns === 'ensembl'
        ? 'use humanOrthologueBridge() explicitly, and label the result as resting on an orthology assumption. Do not treat the bridged answer as being about the zebrafish gene.'
        : 'there is no bridge for this namespace. The question cannot be asked of this graph.',
    };
  }
  if (!(ns in IN_SCOPE_NAMESPACES)) {
    return {
      askable: true, namespace: ns, kind: 'unmeasured',
      reason: `"${ns}" was not in the namespace census taken on 2026-11-06, so its coverage here is unknown. The query will run, and a null result from it means less than a null result in a measured namespace.`,
    };
  }
  return { askable: true, namespace: ns, kind: 'in-scope', nodes_in_namespace: IN_SCOPE_NAMESPACES[ns] };
}

// ---------------------------------------------------------------------------------------------------
// transport
// ---------------------------------------------------------------------------------------------------
const DEFAULT_TIMEOUT_MS = 90_000;

async function post(url, body, { timeout_ms = DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout_ms);
  try {
    const r = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await r.text();
    if (!r.ok) return { ok: false, status: r.status, error: `HTTP ${r.status}`, body: text.slice(0, 400) };
    try { return { ok: true, status: r.status, json: JSON.parse(text) }; }
    catch { return { ok: false, status: r.status, error: 'response was not JSON', body: text.slice(0, 400) }; }
  } catch (e) {
    return { ok: false, status: null, error: `transport: ${e?.name === 'AbortError' ? `timed out after ${timeout_ms} ms` : String(e?.message ?? e)}` };
  } finally { clearTimeout(t); }
}

const curieToPair = curie => { const ns = namespaceOf(curie); return [ns, norm(curie).slice(ns.length + 1)]; };

/** Rebuild a CURIE from the (namespace, identifier) pair a relation row carries.
 *
 *  THIS IS NOT COSMETIC. The endpoint is inconsistent about whether the identifier repeats its own
 *  prefix: a ChEBI node comes back as {source_ns: "CHEBI", source_id: "CHEBI:4021"} while an HGNC node
 *  comes back as {source_ns: "HGNC", source_id: "10848"}. Joining namespace and identifier naively gives
 *  "chebi:CHEBI:4021", which matches nothing - and the failure mode is silent and in the dangerous
 *  direction: every relation gets filtered out and the pair looks like a clean negative. The first
 *  version of this file had exactly that bug and reported 0 relations for SHH/cyclopamine, which has 9. */
export function nodeCurie(ns, id) {
  const n = String(ns ?? '').toLowerCase();
  let i = String(id ?? '');
  if (i.toLowerCase().startsWith(`${n}:`)) i = i.slice(n.length + 1);
  return `${n}:${i}`;
}

// ---------------------------------------------------------------------------------------------------
// ground: a string to a CURIE, with the score and the source, never a bare symbol
// ---------------------------------------------------------------------------------------------------
export async function ground(text, opts = {}) {
  const res = await post(`${SOURCE.grounding}/ground`, { text }, opts);
  if (!res.ok) return { query: text, available: false, why: res.error, groundings: [] };
  const arr = Array.isArray(res.json) ? res.json : [];
  return {
    query: text,
    available: true,
    groundings: arr.map(m => ({
      curie: `${String(m.term?.db ?? '').toLowerCase()}:${m.term?.id}`,
      namespace: String(m.term?.db ?? '').toLowerCase(),
      identifier: m.term?.id ?? null,
      name: m.term?.entry_name ?? null,
      score: m.score ?? null,
      status: m.term?.status ?? null,
      organism: m.term?.organism ?? null,
      source: m.term?.source ?? null,
      resolver: 'gilda',
    })),
    top: arr.length ? {
      curie: `${String(arr[0].term?.db ?? '').toLowerCase()}:${arr[0].term?.id}`,
      name: arr[0].term?.entry_name ?? null, score: arr[0].score ?? null,
    } : null,
    empty_means:
      arr.length === 0
        ? 'Gilda has no entry for this string. For a zebrafish gene symbol that is EXPECTED, not a failure: its public index does not carry them. It is not evidence that the entity does not exist.'
        : null,
  };
}

/** The orthologue bridge. Separate, explicit, and it labels its own assumption in the return value. */
export async function humanOrthologueBridge(symbol, opts = {}) {
  const human = String(symbol ?? '').toUpperCase().replace(/[AB]$/, '');
  const g = await ground(human, opts);
  return {
    requested: symbol,
    tried_as_human_symbol: human,
    result: g.top,
    all: g.groundings,
    THIS_IS_AN_ASSUMPTION:
      'A human orthologue is not the queried gene. Any statement retrieved for the orthologue is evidence ' +
      'about the human gene, and applying it to the zebrafish gene assumes functional conservation that ' +
      'this bridge does not check. Zebrafish paralog pairs make this worse, not better: kcnk5a and kcnk5b ' +
      'both map to one human KCNK5, and the source literature attributes the absence of a kcnk5b ' +
      'loss-of-function phenotype to redundancy between exactly that pair. A bridged answer must be ' +
      'labelled as bridged everywhere it is shown.',
    how_the_symbol_was_transformed: `uppercased and a trailing a/b paralog suffix stripped: "${symbol}" -> "${human}". That transformation is a HEURISTIC, it is not an orthology database, and it will be wrong for genes whose names end in a or b for other reasons.`,
    what_would_be_better: 'a real orthology source (Ensembl Compara, ZFIN orthology, or the Alliance of Genome Resources) rather than string surgery. This function exists to make the assumption visible, not to be the right long-term answer.',
  };
}

// ---------------------------------------------------------------------------------------------------
// relations between two grounded entities
// ---------------------------------------------------------------------------------------------------
/** Summarise the evidence profile of a set of relations. A count alone is never returned. */
export function evidenceProfile(relations) {
  let evidence = 0, dbBacked = 0, readerOnly = 0, retracted = 0, medscanOnly = 0, maxBelief = 0;
  const byType = {};
  for (const r of relations) {
    const d = r.data ?? r;
    const t = d.stmt_type ?? 'unknown';
    const ev = Number(d.evidence_count ?? 0);
    byType[t] = byType[t] ?? { relations: 0, evidence: 0, database_backed: 0, max_belief: 0 };
    byType[t].relations += 1;
    byType[t].evidence += ev;
    if (d.has_database_evidence) byType[t].database_backed += 1;
    byType[t].max_belief = Math.max(byType[t].max_belief, Number(d.belief ?? 0));
    evidence += ev;
    if (d.has_database_evidence) dbBacked += 1; else if (d.has_reader_evidence) readerOnly += 1;
    if (d.has_retracted_evidence) retracted += 1;
    if (d.medscan_only) medscanOnly += 1;
    maxBelief = Math.max(maxBelief, Number(d.belief ?? 0));
  }
  return {
    n_relations: relations.length,
    n_evidence: evidence,
    relations_with_database_evidence: dbBacked,
    relations_with_reader_evidence_only: readerOnly,
    relations_with_retracted_evidence: retracted,
    relations_from_medscan_only: medscanOnly,
    max_belief: +maxBelief.toFixed(4),
    by_type: byType,
    how_to_read_this:
      'n_relations is the weakest number here. A relation supported by one automated reading of one ' +
      'sentence counts the same as one supported by a curated database, so read ' +
      'relations_with_database_evidence and n_evidence first. A non-zero ' +
      'relations_with_retracted_evidence means at least one supporting paper has been retracted and the ' +
      'relation should be treated as absent until checked by hand.',
  };
}

/** Relations between two CURIEs, via the supported REST endpoint. */
export async function relationsBetween(curieA, curieB, opts = {}) {
  const scopeA = scopeOf(curieA), scopeB = scopeOf(curieB);
  if (!scopeA.askable || !scopeB.askable) {
    return {
      a: curieA, b: curieB, status: 'refused',
      refused_because: [scopeA, scopeB].filter(s => !s.askable).map(s => s.reason),
      scope: { a: scopeA, b: scopeB },
      this_is_not_a_negative: 'nothing was asked, so nothing was found. Do not record this as an absence of evidence.',
    };
  }
  const res = await post(`${SOURCE.rest_base}/indra_subnetwork_relations`, { nodes: [curieToPair(curieA), curieToPair(curieB)] }, opts);
  if (!res.ok) {
    return {
      a: curieA, b: curieB, status: 'unavailable', why: res.error, http_status: res.status,
      this_is_not_a_negative: 'the service did not answer. An unavailable graph is not an empty graph, and this must never be recorded as "no relation found".',
    };
  }
  const all = Array.isArray(res.json) ? res.json : [];
  // the endpoint returns the induced subnetwork, which includes self-edges and edges to bound conditions
  const between = all.filter(r => {
    const s = nodeCurie(r.source_ns, r.source_id), t = nodeCurie(r.target_ns, r.target_id);
    const x = norm(curieA).toLowerCase(), y = norm(curieB).toLowerCase();
    return (s === x && t === y) || (s === y && t === x);
  });
  return {
    a: curieA, b: curieB, status: 'ok',
    scope: { a: scopeA, b: scopeB },
    n_in_induced_subnetwork: all.length,
    relations: between,
    profile: evidenceProfile(between),
    types_present: Object.keys(evidenceProfile(between).by_type),
    note: all.length !== between.length
      ? `${all.length - between.length} relation(s) in the induced subnetwork do not connect these two entities directly (self-edges, or edges involving bound conditions). They are excluded from the profile and would inflate a naive count.`
      : null,
    endpoint: `${SOURCE.rest_base}/indra_subnetwork_relations`,
  };
}

/** A BOUNDED density probe: is this entity dense enough that a zero means something?
 *  Returns a LOWER BOUND on distinct partners, never a count - counting exactly would need to page the
 *  whole neighbourhood, and the question "is a zero here informative" does not need an exact answer. */
export async function densityProbe(agentName, { limit = 200, partner_namespace = null, ...opts } = {}) {
  const res = await post(`${SOURCE.rest_base}/get_statements`, { agent: agentName, limit, return_source_counts: true }, opts);
  if (!res.ok) return { agent: agentName, status: 'unavailable', why: res.error };
  const stmts = Array.isArray(res.json) ? (res.json[0] ?? []) : [];
  const ids = new Set(), nsCount = {};
  for (const st of stmts) {
    const agents = [st.subj, st.obj, ...(Array.isArray(st.members) ? st.members : [])].filter(Boolean);
    for (const ag of agents) for (const [db, v] of Object.entries(ag.db_refs ?? {})) {
      if (db === 'TEXT' || db === 'TEXT_NORM') continue;
      nsCount[db] = (nsCount[db] ?? 0) + 1;
      ids.add(`${db}:${v}`);
    }
  }
  const wanted = partner_namespace ? [...ids].filter(i => i.toLowerCase().startsWith(`${partner_namespace.toLowerCase()}:`)) : [...ids];
  return {
    agent: agentName, status: 'ok',
    statements_examined: stmts.length,
    page_limit: limit,
    distinct_partner_ids_lower_bound: wanted.length,
    partner_namespace: partner_namespace ?? 'any',
    namespaces_seen: nsCount,
    dense: wanted.length >= 10,
    dense_threshold: 10,
    why_a_lower_bound: `only the first ${stmts.length} statement(s) were examined (page limit ${limit}), so the true partner count is at least this and probably much larger. An exact count would require paging the whole neighbourhood, which this question does not need: it only has to separate "this node has a rich neighbourhood, so a zero between it and X is informative" from "this node has almost nothing, so a zero means nothing".`,
    threshold_is_ours: 'the dense/not-dense cut at 10 distinct partners is OUR choice, not a published criterion. It is stated here so it can be disagreed with.',
  };
}

/** Mechanism rather than co-annotation: do two genes share a pathway? */
export async function sharedPathways(curies, opts = {}) {
  const scopes = curies.map(scopeOf);
  const bad = scopes.filter(s => !s.askable);
  if (bad.length) return { status: 'refused', refused_because: bad.map(s => s.reason) };
  const res = await post(`${SOURCE.rest_base}/get_shared_pathways_for_genes`, { genes: curies.map(curieToPair) }, opts);
  if (!res.ok) return { status: 'unavailable', why: res.error };
  const rows = Array.isArray(res.json) ? res.json : [];
  return {
    status: 'ok', genes: curies,
    n_shared_pathways: rows.length,
    pathways: rows.map(r => ({ curie: `${String(r.data?.db_ns ?? '').toLowerCase()}:${r.data?.db_id}`, name: r.data?.name ?? null })),
    why_this_endpoint_and_not_an_overlap_count:
      'Shared pathway membership is a MECHANISM statement. A count of shared GO annotations is a statement ' +
      'about what has been annotated, and annotation tracks what laboratories chose to study - which is ' +
      'the bias that already collapsed a published-looking gene-set overlap in this project (crude odds ' +
      'ratio 2.66, p=1e-9, falling to a Mantel-Haenszel 0.94 at equal annotation depth). Pathways are not ' +
      'free of that bias either, but they are a claim about biology rather than about bibliography.',
  };
}

/** Service reachability, as a first-class answer. */
export async function health(opts = {}) {
  const rest = await post(`${SOURCE.rest_base}/get_go_terms_for_gene`, { gene: ['hgnc', '11998'] }, { timeout_ms: 30_000, ...opts });
  let cypher = null;
  try {
    const r = await post(SOURCE.mcp, {
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'execute_cypher', arguments: { params: { query: 'RETURN 1 AS ok', max_results: 1, timeout_ms: 10_000 } } },
    }, { timeout_ms: 30_000, ...opts });
    const text = r.ok ? (r.json?.result?.content?.[0]?.text ?? '') : r.error;
    cypher = { ok: r.ok && !/unavailable|error/i.test(String(text)), detail: String(text).slice(0, 200) };
  } catch (e) { cypher = { ok: false, detail: String(e?.message ?? e) }; }
  return {
    rest: { ok: rest.ok, detail: rest.ok ? 'answered' : rest.error },
    cypher,
    which_to_trust: 'REST. On 2026-11-06 the Cypher tool went from answering in 10-30 ms to reporting an unreachable internal Neo4j address within the hour, while every REST endpoint kept answering. Anything built on execute_cypher inherits that.',
  };
}
