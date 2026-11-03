// ecology_check: the population-level layer as an MCP tool. It makes outbound calls to two public APIs
// (GBIF and GloBI), both cached under sim-engine/validate/ecology/cache/, so it is LOCAL ONLY -- the hosted
// server makes no outbound call on an anonymous caller's behalf and writes no cache file for them.
import { envelope, p } from '../lib/envelope.mjs';
import { ecologyCheck, setOffline, SCOPE, VERSION } from '../validate/ecology/index.mjs';

const Q = d => ({ type: 'object', properties: { value: { type: 'number' }, source: { type: 'string' }, kind: { type: 'string' } }, required: ['value', 'source'],
  description: `${d} A quantity WITH ITS SOURCE. A bare number is refused.` });

export const ECOLOGY_TOOLS = [
  {
    name: 'ecology_check',
    title: 'Could it actually exist there? (who else is already in that place)',
    description: 'Biology permitting an organism is not the world permitting it. Every other check in this repository asks whether a design is '
      + 'internally possible; most of the organisms biology permits are absent because something already there is better at being there. '
      + 'This assembles the ingredients of that question from real records and refuses to finish the sum. '
      + 'WHERE: GBIF occurrence records for the design\'s clade, with the country breakdown -- the only empirical answer to "where could this live". '
      + 'COMMUNITY: GBIF occurrences inside a stated bounding box, scoped to the design\'s own class, because the taxa competing with an insect for an '
      + 'insect\'s living are other insects. INTERACTIONS: GloBI records of what eats, is eaten by and interacts with the clade, each traceable to the '
      + 'study that reported it. PRESSURE: the intersection -- which recorded predators of this clade are themselves recorded in that box. '
      + 'It does NOT predict competitive exclusion from any of it, because none of it contains a population parameter: occurrence counts are presence and '
      + 'sampling effort, never abundance, and an interaction record is a report that it happened once, not a rate. '
      + 'Competitive outcome is evaluated ONLY from growth rates, carrying capacities and competition coefficients the caller declares with sources, '
      + 'through the Lotka-Volterra mutual invasibility criterion -- a two-species phenomenological model with no space, no environmental variation and no '
      + 'evolution, whose answer is a property of the four declared numbers. '
      + 'Results are filtered by the frozen holdout clade before anything is written or cached.',
    inputSchema: {
      type: 'object',
      properties: {
        taxon: { type: 'string', description: "The design's clade, as a scientific name GBIF's backbone can match. Without it there is nothing to look up." },
        where: { type: 'object', description: 'The place to ask about: { name, bbox: [latMin, latMax, lonMin, lonMax], source }. Without it the tool reports where the clade is recorded and says no community was compared.',
          properties: { name: { type: 'string' }, bbox: { type: 'array', items: { type: 'number' } }, source: { type: 'string' } } },
        community_limit: { type: 'number', description: 'How many co-occurring species to resolve and name (default 12, max 40). Each one costs a GBIF call, and the calls are paced.' },
        community_within: { type: 'string', description: "Override the clade the community is scoped to (default: the design's own class)." },
        community_within_key: { type: 'number', description: 'The GBIF key for that clade, if overriding.' },
        competition: { type: 'object', description: 'Optional, and the ONLY route to an outcome. { resident: {name, K, r}, invader: {K, r}, alpha_resident_on_invader, alpha_invader_on_resident } with each number as {value, source}. Mutual invasibility is then evaluated exactly: both invade -> coexistence; neither -> whichever arrives first wins; one only -> that one excludes the other.',
          properties: { resident: { type: 'object' }, invader: { type: 'object' }, alpha_resident_on_invader: Q('How much one resident individual suppresses the invader, relative to an invader individual.'), alpha_invader_on_resident: Q('And the other way round.') } },
        offline: { type: 'boolean', description: 'Answer only from the cache under sim-engine/validate/ecology/cache/. A cache miss is reported as a miss, never silently skipped.' },
      },
      required: ['taxon'],
    },
    handler: async (args = {}) => {
      setOffline(!!args.offline);
      const r = await ecologyCheck(args);
      const net = (r.queries ?? []).filter(q => q.from === 'network').length;
      const cached = (r.queries ?? []).filter(q => q.from === 'cache').length;
      const prov = [
        p('occurrence records', r.recorded_range?.total_records ?? null, 'measured-secondhand',
          `GBIF occurrence search for ${r.resolved?.name ?? args.taxon}. Occurrence records are presence and collector effort, biased toward wealthy countries, roadsides and charismatic taxa.`),
        p('community', r.community?.species?.length ?? null, 'measured-secondhand',
          r.community ? `GBIF occurrences inside ${r.community.where.name ?? 'the stated box'}, scoped to ${r.community.scoped_to?.clade ?? 'no clade'}, ranked by record count -- which is how often somebody recorded it, not how many there are.` : 'no place was given'),
        p('interactions', r.interactions?.eatenBy?.total_taxa ?? null, 'measured-secondhand',
          `Global Biotic Interactions (GloBI) records for ${r.resolved?.canonical ?? args.taxon}. An interaction record is an observation somebody reported, not a rate and not evidence it happens in the place asked about.`),
        p('competitive outcome', r.competition?.outcome ?? null, r.competition?.outcome ? 'derived' : 'assumed',
          r.competition?.outcome ? `Lotka-Volterra mutual invasibility over parameters the caller declared: ${Object.entries(r.competition.parameters ?? {}).map(([k, v]) => `${k} = ${v.value} (${v.source})`).join('; ')}` : 'no population parameters were declared, so no outcome was computed'),
        p('queries', `${net} network, ${cached} cached`, 'derived', 'sim-engine/validate/ecology/cache/, keyed by URL; every call is listed in `queries` with its purpose'),
        p('ecology_check version', VERSION, 'derived', 'sim-engine/validate/ecology/index.mjs'),
      ];
      return envelope(r, prov, SCOPE);
    },
  },
];
