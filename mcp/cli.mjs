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
};
// Lean law subcommands: parsed again from raw argv by the shared CLI so numbers stay strings (lawset "1.2.0").
const { parseArgs } = await import("../sim-engine/lean-cli.mjs");
for (const [name, fn] of Object.entries(LEAN)) commands[name] = () => fn(parseArgs(rest));

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
