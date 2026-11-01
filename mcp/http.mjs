// Streamable HTTP transport for the hosted server. Stateless: every POST /mcp gets a fresh
// McpServer, so any number of machines can serve it. The SPARQL store is module-level and shared.

import { createServer as createHttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { browseClaims } from "./graph.mjs";
import { localFileCount } from "./lib.mjs";
import { ensureFresh, sourceInfo } from "../lib/lean-source.mjs";

const RATE_LIMIT = Number(process.env.DELPHI_RATE_LIMIT ?? 120); // requests per IP per minute
const MAX_BODY = 1 << 20;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const hits = new Map();
function limited(ip) {
  const minute = Math.floor(Date.now() / 60_000);
  const h = hits.get(ip);
  if (!h || h.minute !== minute) { hits.set(ip, { minute, n: 1 }); return false; }
  return ++h.n > RATE_LIMIT;
}
setInterval(() => {
  const minute = Math.floor(Date.now() / 60_000);
  for (const [ip, h] of hits) if (h.minute < minute) hits.delete(ip);
}, 60_000).unref();

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("Request body too large"), { status: 413 })); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(Object.assign(new Error("Body is not valid JSON"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { ...CORS, "Content-Type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

const rpcError = (res, status, message) =>
  send(res, status, { jsonrpc: "2.0", error: { code: -32000, message }, id: null });

const landing = (host, files, built) => `delphisci MCP server

Candidate laws of biology as nanopub claims, their math, assessor rankings and model truth scores.
Source: https://github.com/fractastical/delphi

Connect an MCP client to:  https://${host}/mcp   (Streamable HTTP, no auth)

Cursor (.cursor/mcp.json):   { "mcpServers": { "delphisci": { "url": "https://${host}/mcp" } } }
Claude Code:                 claude mcp add --transport http delphisci https://${host}/mcp

Data: ${files} TriG files; claim graph built ${built}. Lean laws: ${(i => `${i.source}, lawset ${i.lawset_version}`)(safeSourceInfo())} (tool lean_source_status). Limit: ${RATE_LIMIT} requests/minute per IP.
`;

// The Lean law source (local, or the remote the loader self-updates from) and its current lawset, for /healthz.
function safeSourceInfo() { try { return sourceInfo(); } catch (e) { return { error: e.message }; } }
let serverVersion = null;

export function serveHttp(createServer, port, version = null) {
  serverVersion = version;
  // Fetch the remote law source once at startup so the first lean_* call does not wait on it.
  ensureFresh().then(i => console.log(`lean laws: ${i.source} lawset ${i.lawset_version}${i.url ? ` (${i.url})` : ""}${i.remote_error ? `; remote error: ${i.remote_error}` : ""}`)).catch(() => {});
  const files = localFileCount();
  const { built } = browseClaims({ limit: 1 });

  const http = createHttpServer(async (req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    const ip = req.headers["fly-client-ip"] ?? req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? req.socket.remoteAddress;

    if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
    if (path === "/healthz") return send(res, 200, { ok: true, version: serverVersion, files, built, lean: safeSourceInfo() });
    if (path === "/" && req.method === "GET") return send(res, 200, landing(req.headers.host, files, built), "text/plain; charset=utf-8");
    if (path !== "/mcp") return send(res, 404, { error: "Not found. The MCP endpoint is /mcp." });
    if (req.method !== "POST") return rpcError(res, 405, "Method not allowed: this server is stateless, use POST /mcp.");
    if (limited(ip)) {
      res.setHeader("Retry-After", "60");
      return rpcError(res, 429, `Rate limit: ${RATE_LIMIT} requests per minute per IP.`);
    }

    let body;
    try { body = await readJson(req); }
    catch (e) { return rpcError(res, e.status ?? 400, e.message); }

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) rpcError(res, 500, "Internal server error");
    }
  });

  http.listen(port, () => console.log(`delphisci MCP on :${port}/mcp (${files} TriG files, claim graph ${built})`));
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => {
    http.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  });
}
