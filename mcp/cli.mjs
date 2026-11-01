#!/usr/bin/env node
// Same queries as the MCP server, for agents and people without MCP. Prints JSON.
//
//   node mcp/cli.mjs overview [--source network]
//   node mcp/cli.mjs search --text fixation --math-only
//   node mcp/cli.mjs claim fisher-kpp-speed
//   node mcp/cli.mjs rank --type dataset-resolvability/0.1.0 --limit 10
//   node mcp/cli.mjs graph --thinker turing --sort disagreement
//   node mcp/cli.mjs graph --group-by thinker
//   node mcp/cli.mjs sparql 'SELECT ...'
//   node mcp/cli.mjs laws --kind biological --status accepted     (Lean laws; same handlers as sim-engine/lean-cli.mjs)
//   node mcp/cli.mjs law kimura-substitution-rate
//   node mcp/cli.mjs lawset current
//   node mcp/cli.mjs check design.json --lawset current
//   node mcp/cli.mjs propose Law.lean --meta meta.json
//   node mcp/cli.mjs verify
//   node mcp/cli.mjs source [--refresh]                         (Lean law source: local, or remote mirror/github)
//   node mcp/cli.mjs changes 1.3.0                              (lawset releases after 1.3.0)
//   node mcp/cli.mjs tools                                      every tool this server registers
//   node mcp/cli.mjs tool validate_generation --json '{"desired_phenotype":"...","generated":"winged-zebrafish","base":"zebrafish-adult"}'

import { browseClaims } from "./graph.mjs";
import { getClaim, overview, rankClaims, searchClaims, sparql } from "./lib.mjs";
import { COMMANDS as LEAN } from "../sim-engine/lean-cli.mjs";

const [cmd, ...rest] = process.argv.slice(2);
const opts = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith("--")) { positional.push(a); continue; }
  const key = a.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());
  const next = rest[i + 1];
  if (next === undefined || next.startsWith("--")) opts[key] = true;
  else { opts[key] = /^-?\d+(\.\d+)?$/.test(next) ? Number(next) : next === "true" ? true : next === "false" ? false : next; i++; }
}

const commands = {
  overview: () => overview(opts.source),
  search: () => searchClaims({ text: positional[0], ...opts }),
  claim: () => getClaim({ id: positional[0] ?? opts.id, source: opts.source }),
  rank: () => rankClaims({ type: positional[0], ...opts }),
  graph: () => browseClaims({ text: positional[0], ...opts }),
  sparql: () => sparql(positional[0] ?? opts.query, opts.source),
  organisms: () => opts.overview ? organismsOverview() : browseOrganisms({
    text: positional[0], ...opts,
    hasAxis: opts.hasAxis ? String(opts.hasAxis).split(",") : [],
    missingAxis: opts.missingAxis ? String(opts.missingAxis).split(",") : [],
  }),
  organism: () => getOrganism({ id: positional[0] ?? opts.id, includeMentions: opts.includeMentions !== false }),
};
// Lean law subcommands: parsed again from raw argv by the shared CLI so numbers stay strings (lawset "1.2.0").
const { parseArgs } = await import("../sim-engine/lean-cli.mjs");
for (const [name, fn] of Object.entries(LEAN)) commands[name] = () => fn(parseArgs(rest));
// LeanBio subcommands (pipeline/leanbio/tools.mjs), for parity with the leanbio_* MCP tools.
const { LEANBIO_TOOLS } = await import("../pipeline/leanbio/tools.mjs");
const lb = Object.fromEntries(LEANBIO_TOOLS.map(t => [t.name, t]));
commands["leanbio-queue"] = () => lb.leanbio_queue.handler({ limit: Number(positional[0] || 20) });
commands["leanbio-ground"] = () => lb.leanbio_ground.handler({ text: positional.join(" ") });
commands["leanbio-claim"] = () => lb.leanbio_claim.handler({ id: positional[0] });

// `tool <name>` / `tools`: the generic passthrough. It drives the SAME registrations createServer() exposes, so
// the hosted policy (network/BLAST forced off, local-only tools absent) is identical here and the CLI cannot
// drift from the server.
const { TOOLS: REGISTERED } = await import("./server.mjs");
commands.tools = () => ({ count: REGISTERED.length, tools: REGISTERED.map(([name, description]) => ({ name, description: String(description).split("\n")[0].slice(0, 160) })) });
commands.tool = async () => {
  const name = positional[0];
  const spec = REGISTERED.find(([n]) => n === name);
  if (!spec) throw new Error(`unknown tool: ${name}\nknown: ${REGISTERED.map(([n]) => n).join(", ")}`);
  const args = { ...Object.fromEntries(Object.entries(opts).filter(([k]) => k !== "json")), ...(opts.json ? JSON.parse(opts.json) : {}) };
  return spec[3](args);
};

if (!commands[cmd]) {
  console.error(`Usage: node mcp/cli.mjs <${Object.keys(commands).join("|")}> [args] [--source local|network]`);
  process.exit(1);
}
try {
  console.log(JSON.stringify(await commands[cmd](), null, 2));
} catch (e) {
  console.error(e?.message ?? e);
  process.exit(1);
}
