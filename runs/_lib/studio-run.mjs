// The harness every use-case run under runs/ is built on.
//
// It does four things and nothing else: calls MCP tools and keeps the whole result, runs repository scripts
// and keeps their output, posts what happened to a Design Studio session so the live page can show it, and
// writes a per-generation record with a diff against the generation before.
//
// Every call goes through the tool registrations in mcp/server.mjs -- the same objects the server hands an
// agent -- so nothing a run does can work in a way the MCP surface does not.
//
// runs/flying-mouse/ predates this file and has its own copy of the same logic, with narration specific to
// that question. It was left alone rather than refactored: it is a committed, verified artifact and churning
// it to remove duplication would risk the thing the duplication is there to protect.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TOOLS } from '../../mcp/server.mjs';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const byName = Object.fromEntries(TOOLS.map(([name, description, inputSchema, fn]) => [name, { name, fn }]));

export function makeRun({ dir, question, author, session: wantSession = true, only = null }) {
  const HERE = dir;
  const LOG = path.join(HERE, 'log'), GEN = path.join(HERE, 'gen');
  for (const d of [LOG, GEN]) fs.mkdirSync(d, { recursive: true });
  // A full run starts from an empty log directory, so files from an earlier run with different step
  // numbering cannot survive beside the new ones and make the folder read as though calls happened twice.
  if (only == null) for (const f of fs.readdirSync(LOG)) fs.unlinkSync(path.join(LOG, f));
  const journal = path.join(HERE, 'journal.jsonl');
  if (only == null) fs.writeFileSync(journal, '');

  let step = 0, session = null;
  const record = [];
  const note = e => fs.appendFileSync(journal, JSON.stringify({ i: step, ...e }) + '\n');

  async function mcp(name, args, { generation = null, why = '' } = {}) {
    const t = byName[name];
    if (!t) throw new Error(`no MCP tool "${name}" is registered; mcp/cli.mjs tools lists ${TOOLS.length}`);
    step++;
    const file = `${String(step).padStart(2, '0')}-${name}${generation != null ? `-gen${generation}` : ''}.json`;
    const t0 = Date.now();
    let out, error = null;
    try { out = await t.fn(args); } catch (e) { error = String(e?.message ?? e); out = { error }; }
    fs.writeFileSync(path.join(LOG, file), JSON.stringify({ tool: name, generation, why, args, ms: Date.now() - t0, result: out }, null, 1));
    note({ type: 'call', tool: name, generation, why, ms: Date.now() - t0, log: `log/${file}`, error });
    if (error) console.log(`  ! ${name}: ${error.slice(0, 160)}`);
    return out?.result ?? out;
  }

  function script(label, cmd, args, { generation = null } = {}) {
    step++;
    const file = `${String(step).padStart(2, '0')}-${label}${generation != null ? `-gen${generation}` : ''}.log`;
    let stdout = '', code = 0;
    try { stdout = execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }); }
    catch (e) { stdout = `${e.stdout ?? ''}${e.stderr ?? ''}`; code = e.status ?? 1; }
    fs.writeFileSync(path.join(LOG, file), `$ ${cmd} ${args.join(' ')}\n\n${stdout}`);
    note({ type: 'script', label, generation, cmd: `${cmd} ${args.join(' ')}`, exit: code, log: `log/${file}` });
    return { stdout, code };
  }

  async function finding(generation, tool, verdict, body, detail = {}) {
    note({ type: 'finding', generation, tool, verdict, body, detail });
    console.log(`  [gen ${generation}] ${tool}: ${verdict} -- ${String(body).slice(0, 130)}`);
    if (session) await mcp('session_post', { session, author, kind: 'finding', tool, verdict, generation, body, detail });
  }

  async function thinking(generation, body) {
    note({ type: 'thinking', generation, body });
    console.log(`\n[gen ${generation}] ${body}`);
    if (session) await mcp('session_post', { session, author, kind: 'comment', body: `generation ${generation}: ${body}` });
  }

  /** Per-generation record, with a diff against the one before. */
  function writeGen(g) {
    const prev = record[record.length - 1] ?? null;
    const diff = prev ? {
      phenotype: Object.fromEntries(Object.keys(g.phenotype?.counts ?? {}).map(k => [k, (g.phenotype.counts[k] ?? 0) - (prev.phenotype?.counts?.[k] ?? 0)])),
      genotype_markers_added: (g.genotype?.markers ?? []).filter(x => !(prev.genotype?.markers ?? []).includes(x)),
      genotype_markers_removed: (prev.genotype?.markers ?? []).filter(x => !(g.genotype?.markers ?? []).includes(x)),
      gates_changed: Object.entries(g.gates ?? {}).filter(([k, v]) => prev.gates?.[k] !== v).map(([k, v]) => `${k}: ${prev.gates?.[k] ?? 'not asked'} -> ${v}`),
    } : null;
    const out = { ...g, question, diff_from_previous: diff };
    record.push(out);
    fs.writeFileSync(path.join(GEN, `gen${g.generation}.json`), JSON.stringify(out, null, 1));
    note({ type: 'generation', ...out });
    return out;
  }

  /** Run organism-design/blueprint.mjs and return the parsed blueprint. */
  function blueprint(generation, text, { offline = false, runName } = {}) {
    const out = path.join('runs', runName, 'gen', `gen${generation}.blueprint.json`);
    const r = script('blueprint', process.execPath, ['organism-design/blueprint.mjs', text, '--out', out, ...(offline ? ['--offline'] : [])], { generation });
    const f = path.join(ROOT, out);
    if (!fs.existsSync(f)) throw new Error(`blueprint.mjs wrote nothing for generation ${generation}:\n${r.stdout.slice(0, 1500)}`);
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  }

  /** genome_sketch.markers is a list of {cell_label, gene_products:[{label}]}, one per annotated cell type. */
  const markersOf = bp => [...new Set((bp.genome_sketch?.markers ?? []).flatMap(m => (m.gene_products ?? []).map(g => g.label)))].sort();
  const markerCellsOf = bp => (bp.genome_sketch?.markers ?? []).map(m => ({ cell: m.cell_label, products: (m.gene_products ?? []).map(g => g.label) }));

  async function open() {
    if (!wantSession) return null;
    const s = await mcp('session_open', { title: question.slice(0, 90), author }, { why: 'the Design Studio co-design log this run writes to' });
    session = s.session;
    fs.writeFileSync(path.join(HERE, 'session.txt'), session + '\n');
    console.log(`session: ${session}  (sim-engine/sessions/${session}.jsonl)`);
    return session;
  }

  function finish(extra = {}) {
    const summary = { question, built: new Date().toISOString(), session,
      generations: record.map(g => ({ generation: g.generation, asked: g.asked, gates: g.gates, what_it_taught: g.what_it_taught })),
      verdict: record.length ? record[record.length - 1].what_it_taught : null,
      tool_calls: step, journal: 'journal.jsonl', logs: 'log/', ...extra };
    fs.writeFileSync(path.join(HERE, 'summary.json'), JSON.stringify(summary, null, 1));
    console.log(`\n${step} tool calls and scripts, all logged under ${path.relative(ROOT, LOG).replace(/\\/g, '/')}/`);
    console.log(`generations: ${record.map(g => `${g.generation}:${Object.values(g.gates ?? {}).join('/')}`).join('  ')}`);
    return summary;
  }

  return { mcp, script, finding, thinking, writeGen, blueprint, markersOf, markerCellsOf, open, finish,
    get session() { return session; }, get step() { return step; }, record, HERE, LOG, GEN };
}

/** Pull the gate verdicts out of a harness tool result without pretending a paragraph is a token. */
export function gateOf(r) {
  const refused = !!(r?.error || r?.ran === false || r?.cannot_assess || r?.gate === 'cannot-assess');
  const sentence = String(r?.gate ?? r?.verdict ?? 'ran');
  return { refused, sentence, token: refused ? 'refused' : sentence.length > 24 ? 'ran, no verdict' : sentence };
}
