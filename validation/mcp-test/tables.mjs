// Renders the per-tool tables of validation/MCP-TEST-REPORT.md from validation/mcp-test/results-main.json.
import { readFileSync, writeFileSync } from "node:fs";
const r = JSON.parse(readFileSync("validation/mcp-test/results-main.json", "utf8"));
const esc = s => String(s).replace(/\|/g, "\|").replace(/\n/g, " ");
const short = a => { const s = typeof a === "string" ? a : JSON.stringify(a); return s.length > 90 ? s.slice(0, 87) + "..." : s; };
let md = "";
for (const t of r.tools.hosted) {
  const rs = r.cases.filter(c => c.tool === t.name);
  const p = rs.filter(c => c.hosted.verdict.startsWith("pass")).length;
  md += `### ${t.name} (${p}/${rs.length} passed)\n\nParameters: ${t.params.map(x => "`" + x + "`").join(", ")}\n\n| case | arguments | expect | verdict | repo | =local | ms | response (start) |\n|---|---|---|---|---|---|---|---|\n`;
  for (const c of rs) md += `| ${c.id} | \`${esc(short(c.args))}\` | ${c.expect} | ${esc(c.hosted.verdict.slice(0, 90))} | ${esc(c.hosted.repoCheck.slice(0, 60))} | ${c.hostedEqualsLocal ? "yes" : "no"} | ${c.hosted.ms} | ${esc(c.hosted.response.replace(/\s+/g, " ").slice(0, 80))} |\n`;
  md += "\n";
}
md += "### Local CLI versus hosted\n\n| case | command | rows | = local MCP | = hosted |\n|---|---|---|---|---|\n";
for (const c of r.cli) md += `| ${c.case} | \`${esc(c.argv.join(" ").slice(0, 100))}\` | ${c.rows ?? "-"} | ${c.equalsLocalMcp} | ${c.equalsHosted} |\n`;
const rep = readFileSync("validation/MCP-TEST-REPORT.md", "utf8");
writeFileSync("validation/MCP-TEST-REPORT.md", rep.replace(/<!-- TABLES -->[\s\S]*$/, "<!-- TABLES -->\n" + md));
const val = r.cases.filter(c => c.expect === "error"); console.log("error-expected", val.length, val.filter(c => c.hosted.verdict.startsWith("pass")).length, "cli", r.cli.length, r.cli.filter(c => c.equalsHosted === true).length);
