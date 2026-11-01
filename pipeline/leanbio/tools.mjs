// LeanBio MCP tools, in the {name, title, description, inputSchema, handler} shape of sim-engine/tools/*.mjs.
// Registration (applied by the hub, not here): sim-engine/tools/LEANBIO-REGISTER.md and mcp/LEANBIO-PATCH.md.
//
//   leanbio_queue   the formalization candidate queue, ordered by belief (pipeline/leanbio/out/queue.json)
//   leanbio_ground  text -> grounded entity mentions, or one entity -> grounding (Gilda + fallbacks, cached)
//   leanbio_claim   one claim -> nanopub draft (unsigned TriG) + belief breakdown + linked Lean laws
//
// Results use the provenance envelope shape {result, provenance, scope} used by the lean_* tools.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT, readJson, exists } from './lib.mjs';
import { groundText, groundEntity, flushCaches } from './ground.mjs';
import { renderDraft } from './draft.mjs';
import { PARAMS } from './belief.mjs';

const prov = (quantity, value, kind, source) => ({ quantity, value, kind, source });
const SCOPE = 'Belief is an ordering heuristic (INDRA SimpleScorer form, hand-set parameters, not calibrated), not a probability that the claim is true. Groundings are machine output (Gilda and fallbacks) with the acceptance rule in pipeline/leanbio/README.md; ambiguous ones are flagged, never auto-resolved. Records touching the held-out exam clade are withheld before any processing. Drafts are UNSIGNED and unpublished.';
let recCache = null;
const records = () => {
  const p = path.join(OUT, 'records.json');
  const m = fs.statSync(p).mtimeMs;
  if (!recCache || recCache.m !== m) recCache = { m, byId: new Map(readJson(p).records.map(r => [r.id, r])) };
  return recCache.byId;
};
const lawNow = id => { const p = path.join(ROOT, 'lean/registry/laws', `${id}.json`); if (!exists(p)) return null; const l = readJson(p); return { law_id: l.law_id, version: l.version, status: l.status, class: l.class, theorem: l.lean_ref?.theorem || null, module: l.lean_ref?.module || null }; };

export const queueSchema = {
  title: 'LeanBio formalization queue',
  description: 'Claims and nanopub drafts that are candidates for a LeanBio (Lean 4) statement, ordered by formalizability (theorem before named hypothesis) then belief. Excludes anything already in the law registry, anything below the queue threshold, and items a reviewer declined. Each item has its belief breakdown (E support, R contradiction, independent evidence counts), its INDRA-style relation type and its grounded entities.',
  inputSchema: { type: 'object', properties: {
    limit: { type: 'integer', minimum: 1, maximum: 500, default: 20 },
    min_belief: { type: 'number', minimum: 0, maximum: 1, description: 'Only items at or above this belief' },
    relation: { type: 'string', description: 'Only this relation type, e.g. ScalingLaw, Bound, Equality, Dynamics, Inhibition' },
    origin: { type: 'string', enum: ['claim', 'draft'] },
  } },
};
export async function queue({ limit = 20, min_belief, relation, origin } = {}) {
  const q = readJson(path.join(OUT, 'queue.json'));
  const items = q.queue.filter(x => (min_belief == null || x.belief >= min_belief) && (!relation || x.relation === relation) && (!origin || x.origin === origin));
  return { result: { params: q.params, total: items.length, items: items.slice(0, limit) }, provenance: [prov('queue', 'pipeline/leanbio/out/queue.json', 'derived', 'node pipeline/leanbio/run.mjs'), prov('belief parameters', PARAMS.version, 'assumed', 'pipeline/leanbio/belief-params.json (hand-set)')], scope: SCOPE };
}

export const groundSchema = {
  title: 'Ground text or an entity to ontology identifiers',
  description: 'Text -> entity mentions with groundings (Gilda NER over grounding.indra.bio; zebrafish gene symbols via MyGene.info; taxa via the repo inventory and OLS4 NCBITaxon). Or entity -> one grounding decision (identifiers such as UBERON:0000151 are verified against OLS4). Each mention has status grounded | ambiguous | low-confidence | ungroundable, the best match and alternatives. Responses are cached in pipeline/leanbio/cache/.',
  inputSchema: { type: 'object', properties: {
    text: { type: 'string', description: 'Free text to annotate' },
    entity: { type: 'string', description: 'One entity name or identifier, instead of text' },
    kind: { type: 'string', enum: ['any', 'gene', 'taxon'], default: 'any' },
    context: { type: 'string', description: 'Context for an entity (e.g. "zebrafish") to pick the organism' },
    offline: { type: 'boolean', default: false, description: 'Answer from the cache only (no network)' },
  } },
};
export async function ground({ text, entity, kind = 'any', context = '', offline = false } = {}) {
  if (!text && !entity) throw new Error('give text or entity');
  const result = entity ? await groundEntity(entity, { kind, context, offline }) : await groundText(text, { offline });
  if (!offline) flushCaches();
  return { result, provenance: [prov('grounder', 'Gilda public REST API', 'derived', 'https://grounding.indra.bio (cached in pipeline/leanbio/cache/gilda-*.json)'), prov('acceptance rule', 'score >= 0.70, or >= 0.50 with a shared word stem; ambiguous if a different entry is within 0.05', 'assumed', 'pipeline/leanbio/ground.mjs')], scope: SCOPE };
}

export const claimSchema = {
  title: 'LeanBio record for one claim',
  description: 'One claim (docs/claims.json id, e.g. "maynardsmith-hitchhiking") or draft ("draft:<repo path>") -> its grounded entities, INDRA-style statement, evidence items, belief breakdown, linked Lean laws with their CURRENT registry status, queue position or the reason it is not queued, and an unsigned nanopub draft (TriG) carrying the groundings and belief.',
  inputSchema: { type: 'object', required: ['id'], properties: {
    id: { type: 'string' },
    draft: { type: 'boolean', default: true, description: 'Include the TriG draft' },
  } },
};
export async function claim({ id, draft = true } = {}) {
  const rec = records().get(id);
  if (!rec) throw new Error(`no LeanBio record ${id} (unknown, or withheld by the held-out guard)`);
  const q = readJson(path.join(OUT, 'queue.json')).queue.find(x => x.id === id);
  const result = {
    id: rec.id, origin: rec.origin, text: rec.text, statement: rec.statement, entities: rec.entities,
    grounding: { mentions: rec.grounding.mentions, declared: rec.grounding.declared },
    evidence: rec.evidence, evidence_items: rec.evidence_items, belief: rec.belief,
    linked_laws: rec.linked_laws.map(l => lawNow(l.law_id) || l),
    queue: q ? { rank: q.rank } : rec.queue,
    nanopub_draft: draft ? renderDraft(rec) : undefined,
  };
  return { result, provenance: [prov('record', 'pipeline/leanbio/out/records.json', 'derived', 'node pipeline/leanbio/run.mjs'), prov('laws', 'lean/registry/laws/*.json', 'derived', 'read at call time')], scope: SCOPE };
}

export const LEANBIO_TOOLS = [
  { name: 'leanbio_queue', ...queueSchema, handler: queue },
  { name: 'leanbio_ground', ...groundSchema, handler: ground },
  { name: 'leanbio_claim', ...claimSchema, handler: claim },
];
export const LEANBIO_TOOL_NAMES = LEANBIO_TOOLS.map(t => t.name);
