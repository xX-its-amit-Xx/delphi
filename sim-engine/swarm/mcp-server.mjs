#!/usr/bin/env node
// The sim-engine MCP server plus the swarm board tools, on stdio. Until the hub registers SWARM_TOOLS in
// sim-engine/server.mjs (patch: sim-engine/tools/SWARM-REGISTER.md), this is the server a swarm agent connects to.
//
//   node sim-engine/swarm/mcp-server.mjs                     every server.mjs tool + swarm_*
//   SWARM_TOOLSET=worker node sim-engine/swarm/mcp-server.mjs the worker subset (what headless workers get)
//
// The worker subset leaves out every tool that writes outside the board: organism_create, organism_edit (it SAVES a
// saved document), session_open, session_post (a worker posts only through swarm_submit, which can only post a
// proposal or a comment), session_decide (humans decide), lean_propose (runs a local Lean build), and
// swarm_post_task (the recruiter posts tasks). Workers dry-run edits with swarm_try_edits.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS as BASE } from '../server.mjs';
import { SWARM_TOOLS } from './board.mjs';

export const WORKER_TOOLS = ['organism_get', 'organism_list_parts', 'scenario_list', 'scenario_run', 'scenario_timecourse', 'optimize', 'lean_laws_list', 'lean_law_get', 'lean_check',
  'session_read', 'swarm_claim', 'swarm_submit', 'swarm_status', 'swarm_try_edits'];

export function toolset(kind = process.env.SWARM_TOOLSET || 'full') {
  const all = [...BASE.filter(t => !SWARM_TOOLS.some(s => s.name === t.name)), ...SWARM_TOOLS];
  return kind === 'worker' ? all.filter(t => WORKER_TOOLS.includes(t.name)) : all;
}

const isMain = process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/').replace(/^\//, '')}`;
if (isMain) {
  const tools = toolset();
  const server = new Server({ name: 'delphisci-sim-engine-swarm', version: '0.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })) }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const tool = tools.find(t => t.name === request.params.name);
    if (!tool) throw new Error(`unknown tool: ${request.params.name}`);
    try {
      const out = await tool.handler(request.params.arguments || {});
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }], structuredContent: out };
    } catch (e) {
      const failure = { error: e.message, tool: tool.name };
      return { isError: true, content: [{ type: 'text', text: JSON.stringify(failure, null, 1) }], structuredContent: failure };
    }
  });
  await server.connect(new StdioServerTransport());
  process.stderr.write(`delphisci-sim-engine-swarm (${process.env.SWARM_TOOLSET || 'full'}: ${tools.length} tools) listening on stdio\n`);
}
