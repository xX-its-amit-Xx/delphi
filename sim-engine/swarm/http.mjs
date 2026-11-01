#!/usr/bin/env node
// The HTTP bridge (sim-engine/http.mjs, same security rules) serving every sim-engine tool plus swarm_*, for remote
// agents that speak plain HTTP. Loopback by default; off-loopback needs DELPHI_STUDIO_TOKEN in the ENVIRONMENT.
//
//   node sim-engine/swarm/http.mjs                 http://127.0.0.1:7342
//   DELPHI_STUDIO_PORT=7350 node sim-engine/swarm/http.mjs
//
// POST /tool/swarm_claim {"role":"agent:remote-organ-1"}  and so on; see sim-engine/swarm/JOIN.md.
import { createBridge, discoverTools, assertSafeBind } from '../http.mjs';
import { SWARM_TOOLS } from './board.mjs';

const host = process.env.DELPHI_STUDIO_HOST || '127.0.0.1';
const port = Number(process.env.DELPHI_STUDIO_PORT || 7342);
const token = process.env.DELPHI_STUDIO_TOKEN || null;
try { assertSafeBind({ host, token }); } catch (e) { process.stderr.write(e.message + '\n'); process.exit(2); }
const { tools } = await discoverTools();
const all = [...tools.filter(t => !SWARM_TOOLS.some(s => s.name === t.name)), ...SWARM_TOOLS.map(t => ({ ...t, origin: 'swarm/board.mjs' }))];
const LOOP = new Set(['127.0.0.1', '::1', 'localhost']);
createBridge({ token, tools: all, exposed: !LOOP.has(host), log: l => process.stderr.write(l + '\n') })
  .listen(port, host, () => process.stderr.write(`swarm HTTP bridge on http://${host}:${port} (${all.length} tools; ${token ? 'bearer token required' : 'localhost only, no token'})\n`));
