#!/usr/bin/env node
// The sim-engine MCP server: our own simulation backend, spoken over stdio.
//
//   node sim-engine/server.mjs
//
// The low-level Server API is used deliberately, rather than the McpServer helper, because the tool
// names and their JSON Schemas ARE the contract with the Design Studio (see CONTRACT.md). Declaring
// them as literal JSON Schema keeps the contract readable in one place instead of being generated
// from validator objects. Swapping in the collaborator's server later should be a config change, and
// that is only true if the schemas here are the whole interface.
//
// Every tool returns { result, provenance, scope }. A caller that ignores `provenance` and `scope`
// is using numbers without knowing whether they were measured, borrowed or assumed.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import * as morphogen from './tools/morphogen-diffusion.mjs';
import * as protein from './tools/protein-structure.mjs';
import { physiologySchema, physiologyChain, growthSchema, growthTrajectory } from './tools/wrappers.mjs';
import { LEAN_TOOLS } from './tools/lean-tools.mjs';
import { STUDIO_TOOLS } from './tools/studio.mjs';
import { SPEC_TOOLS } from './tools/spec-tools.mjs';

export const TOOLS = [
  { name: 'morphogen_diffusion', ...morphogen.schema, handler: args => morphogen.run(args) },
  { name: 'protein_structure', ...protein.schema, handler: args => protein.run(args) },
  { name: 'physiology_chain', ...physiologySchema, handler: args => physiologyChain(args) },
  { name: 'growth_trajectory', ...growthSchema, handler: args => growthTrajectory(args) },
  // Lean laws: lean_laws_list, lean_law_get, lean_lawset_get, lean_check, lean_propose, lean_verify.
  // One loader (lib/lean-source.mjs); the same handlers serve mcp/server.mjs, http.mjs and lean-cli.mjs.
  ...LEAN_TOOLS,
  // Design Studio: organism documents, STATE, scenarios, optimisation, co-design sessions (tools/studio.mjs).
  ...STUDIO_TOOLS,
  // Functional criteria: parse_design_text, design_from_spec (tools/spec-tools.mjs, lib/spec.mjs, lib/parse-text.mjs).
  ...SPEC_TOOLS,
];

// flight_sim is deliberately absent. It would wrap the physics simulation's equations, which are not
// exposed as a module, and physics/ belongs to another thread. Listing a tool that cannot run would
// be worse than not listing it. See CONTRACT.md, "Not in v1".

const server = new Server(
  { name: 'delphisci-sim-engine', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  const tool = TOOLS.find(t => t.name === request.params.name);
  if (!tool) throw new Error(`unknown tool: ${request.params.name}`);
  try {
    const out = await tool.handler(request.params.arguments || {});
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }], structuredContent: out };
  } catch (e) {
    // A failed tool reports the failure as a result rather than inventing one. The Design Studio
    // must be able to tell "the endpoint was down" from "the answer is zero".
    const failure = { error: e.message, tool: tool.name };
    return { isError: true, content: [{ type: 'text', text: JSON.stringify(failure, null, 1) }], structuredContent: failure };
  }
});

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  // --dump-contract writes the schemas CONTRACT.md documents, so the document cannot drift from the
  // code: regenerate it rather than editing the schemas by hand in two places.
  if (process.argv.includes('--dump-contract')) {
    console.log(JSON.stringify({
      server: 'delphisci-sim-engine', version: '0.1.0', contract_version: (await import('./lib/envelope.mjs')).CONTRACT_VERSION, changelog: 'sim-engine/CHANGELOG.md', transport: 'stdio',
      envelope: { contract_version: 'semver string', result: 'tool-specific', provenance: '[{quantity, value, kind, source}]', scope: 'string, mandatory', weakest_input: 'kind', counts: '{kind: n}' },
      scenario_result: { metrics: '[{key,label,value,unit,better,kind,source}]', survives: 'true|false|null: the organism survives the perturbation', feasible: 'true|false|null: the behaviour asked about is possible', limiting: 'string|null', provenance: '[...]', scope: 'string', validity: '{inRange, notes}' },
      provenance_kinds: Object.fromEntries(Object.entries((await import('./lib/provenance.mjs')).KINDS)),
      tools: TOOLS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })),
    }, null, 1));
    process.exit(0);
  }
  await server.connect(new StdioServerTransport());
  process.stderr.write('delphisci-sim-engine listening on stdio\n');
}
