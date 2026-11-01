// A live co-design session over MCP stdio: the script spawns `node sim-engine/server.mjs`, speaks MCP
// JSON-RPC to it through the SDK client, and plays three roles:
//   agent:physics   proposes a pectoral-fin edit with scenario evidence
//   agent:genotype  comments with the genotype/ causal-chain caveat for fin size
//   human           approves the proposal with session_decide
// then runs lean_check on the approved design.
//   node sim-engine/examples/codesign-demo/run.mjs
// The server's session store is pointed at a fresh temp folder (STUDIO_SESSIONS_DIR), so nothing is written
// to sim-engine/sessions/. The session JSONL and the organism document are copied here afterwards.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SIM, n, q, metric, checker, finish, table } from '../_lib.mjs';

const DIR = import.meta.dirname;
const STORE = fs.mkdtempSync(path.join(process.env.CODESIGN_TMP || (process.platform === 'win32' ? 'C:/Temp' : os.tmpdir()), 'delphi-codesign-'));
const ORG_ID = 'codesign-demo-wzf';
const WHATIF_LAUNCH = 10;
const { checks, expect } = checker();
const log = []; // every MCP call: {role, tool, arguments, isError, result}

const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(SIM, 'server.mjs')], cwd: SIM,
  env: { ...process.env, STUDIO_SESSIONS_DIR: STORE }, stderr: 'pipe' });
const client = new Client({ name: 'delphi-codesign-demo', version: '1.0.0' });
await client.connect(transport);
const serverInfo = client.getServerVersion();
const tools = (await client.listTools()).tools.map(t => t.name);

async function call(role, name, args) {
  const r = await client.callTool({ name, arguments: args });
  const out = r.structuredContent ?? JSON.parse(r.content?.[0]?.text ?? 'null');
  log.push({ role, tool: name, arguments: args, isError: !!r.isError, result: out });
  if (r.isError) return { error: out?.error ?? 'error', raw: out };
  return out;
}

try {
  expect('server lists session_decide', tools.includes('session_decide'), tools.join(', '));
  expect('server lists lean_check', tools.includes('lean_check'), tools.join(', '));

  // --- setup by the human: an organism document and a session
  const created = await call('human', 'organism_create', { id: ORG_ID, parents: [{ organism: 'winged-zebrafish', weight: 1 }], notes: 'codesign demo: start from the repository winged zebrafish' });
  expect('organism_create succeeded', !created.error, created.error);
  const opened = await call('human', 'session_open', { title: 'codesign demo winged zebrafish fin', author: 'human', organism: ORG_ID });
  expect('session_open succeeded', !opened.error, opened.error);
  const S = opened.result?.session;

  // --- agent:physics gathers evidence: the current design vs the proposed fin
  const before = await call('agent:physics', 'organism_get', { organism: ORG_ID });
  const area0 = before.result.parameters.pectoral_area_over_SL2?.value ?? before.result.parameters.pectoral_area_over_SL2;
  const ffGet = await call('agent:physics', 'organism_get', { organism: 'flying-fish' });
  const areaFF = ffGet.result.parameters.pectoral_area_over_SL2?.value ?? ffGet.result.parameters.pectoral_area_over_SL2;
  const edit = { target: { level: 'body', id: 'body' }, param: 'pectoral_area_over_SL2', op: 'set', value: areaFF,
    reason: `raise pectoral area/SL^2 from ${area0} to the reference flying-fish value ${areaFF} (organism_get flying-fish); the value is a morphology target, not a measured zebrafish phenotype` };
  const proposedDoc = { ...before.result.doc, edits: [...before.result.doc.edits, { ...edit, author: 'agent:physics', ts: 'proposal-preview' }] };
  const gl0 = await call('agent:physics', 'scenario_run', { organism: ORG_ID, scenario: 'glide', params: { launch_height_m: 1 } });
  const gl1 = await call('agent:physics', 'scenario_run', { organism: proposedDoc, scenario: 'glide', params: { launch_height_m: 1 } });
  const gw0 = await call('agent:physics', 'scenario_run', { organism: ORG_ID, scenario: 'glide', params: { launch_height_m: 1, launch_airspeed_override_m_s: WHATIF_LAUNCH } });
  const gw1 = await call('agent:physics', 'scenario_run', { organism: proposedDoc, scenario: 'glide', params: { launch_height_m: 1, launch_airspeed_override_m_s: WHATIF_LAUNCH } });
  for (const [k, v] of Object.entries({ gl0, gl1, gw0, gw1 })) expect(`physics evidence run ${k} succeeded`, !v.error && v.result?.run?.ok, v.error);
  const m = (r, k) => metric(r.result.run, k);
  const ev = (label, r) => ({ label, scenario: 'glide', params: r.result.run.params, feasible: r.result.run.feasible, note: r.result.run.feasibility_note ?? r.result.run.limiting ?? null,
    v_min_m_s: m(r, 'v_min_m_s'), launch_airspeed_m_s: m(r, 'launch_airspeed_m_s'), glide_range_total_m: m(r, 'glide_range_total_m'), glide_range_lean_bound_m: m(r, 'glide_range_lean_bound_m'), wing_loading_N_m2: m(r, 'wing_loading_N_m2'),
    new_binding_violations: (r.result.new_binding_violations || []).map(v => v.law_id ?? v) });
  const evidence = [ev('current design, own launch speed', gl0), ev('proposed fin, own launch speed', gl1), ev(`current design, what-if ${WHATIF_LAUNCH} m/s launch (assumed)`, gw0), ev(`proposed fin, what-if ${WHATIF_LAUNCH} m/s launch (assumed)`, gw1)];
  const rationale = `Wing loading ${n(m(gl0, 'wing_loading_N_m2').value)} -> ${n(m(gl1, 'wing_loading_N_m2').value)} N/m2 and v_min ${n(m(gl0, 'v_min_m_s').value)} -> ${n(m(gl1, 'v_min_m_s').value)} m/s (derived). ` +
    `At its own launch speed (${n(m(gl0, 'launch_airspeed_m_s').value)} m/s, ${m(gl0, 'launch_airspeed_m_s').kind}) it still cannot glide: feasible ${gl1.result.run.feasible}. ` +
    `Only under the what-if ${WHATIF_LAUNCH} m/s launch (assumed) does the glide grow, ${n(m(gw0, 'glide_range_total_m').value)} -> ${n(m(gw1, 'glide_range_total_m').value)} m, of which ${n(m(gw1, 'glide_range_lean_bound_m').value)} m is covered by the Lean bound glide_range_le. ` +
    `New binding Lean violations with the edit: ${evidence[1].new_binding_violations.length ? evidence[1].new_binding_violations.join(', ') : 'none'}.`;
  const proposal = await call('agent:physics', 'session_post', { session: S, author: 'agent:physics', kind: 'proposal', body: 'Enlarge the pectoral fin to the flying-fish area ratio.', edits: [edit], rationale, evidence });
  expect('physics proposal accepted (validated, not applied)', !proposal.error && proposal.result?.entry?.status === 'open', proposal.error || JSON.stringify(proposal.result?.entry));
  const PID = proposal.result?.entry?.proposal_id;

  // an agent may not apply its own edit: this must be refused
  const bypass = await call('agent:physics', 'session_post', { session: S, author: 'agent:physics', kind: 'edit', body: 'trying to apply directly', edits: [edit] });
  expect('direct edit by an agent role is refused', !!bypass.error && /human/.test(bypass.error), JSON.stringify(bypass).slice(0, 200));

  // --- agent:genotype reads the causal chains (genotype/causal-chains.json, read only) and comments
  const chains = JSON.parse(fs.readFileSync(path.join(SIM, '..', 'genotype', 'causal-chains.json'), 'utf8'));
  const k5 = chains.genes.find(g => g.symbol === 'kcnk5b'), k2 = chains.genes.find(g => g.symbol === 'kcnh2a');
  const nStrong = chains.genes.filter(g => g.reaches_necessity_or_better).length, nChain = chains.genes.filter(g => g.chain_strength_necessity_or_better).length;
  const gtBody = `Genotype caveat for this edit. pectoral_area_over_SL2 is a morphology parameter: no causal chain in genotype/causal-chains.json maps any gene to a quantitative fin area, and gene-level edits are recorded-only in the studio (no model consumes them). ` +
    `The fin-size candidates closest to "a bigger pectoral fin" are kcnk5b (chain strength ${k5?.chain_strength}, best link ${k5?.best_grade}) and kcnh2a (chain strength ${k2?.chain_strength}). For kcnk5b the chain breaks at ${k5?.weakest_link?.split('.')[0]}. ` +
    `Gaps include: "${k5?.gaps?.[2]}" ` +
    `Dataset-wide constraint: "${chains.constraint}" So approving this edit fixes a shape; it does not name a genotype that would produce it.`;
  const comment = await call('agent:genotype', 'session_post', { session: S, author: 'agent:genotype', kind: 'comment', body: gtBody });
  expect('genotype comment posted', !comment.error, comment.error);

  // --- human decides
  const decision = await call('human', 'session_decide', { session: S, proposal_id: PID, decision: 'approve', decided_by_role: 'human',
    reason: 'Approved as a morphology experiment only: physics evidence shows lower wing loading and v_min, no new binding Lean violation; genotype caveat accepted (no genotype is claimed). The glide gain exists only under the assumed launch speed.' });
  expect('session_decide approved and applied the edit', !decision.error && decision.result?.entry?.decision === 'approve' && decision.result?.entry?.applied?.length === 1, decision.error || JSON.stringify(decision.result?.entry).slice(0, 300));
  const again = await call('human', 'session_decide', { session: S, proposal_id: PID, decision: 'reject', decided_by_role: 'human', reason: 'second decision must be refused' });
  expect('a second decision on the same proposal is refused', !!again.error, JSON.stringify(again).slice(0, 200));

  // --- lean_check on the approved design
  const after = await call('agent:physics', 'organism_get', { organism: ORG_ID });
  const st = after.result.state.values;
  const prov = gl1.result.run.provenance;
  const pq = name => prov.find(p => p.quantity === name);
  // the what-if glide of the approved fin, as a committed claim; Fick inputs from the glide model's own provenance
  const pw = gw1.result.run.provenance, pwq = name => pw.find(p => p.quantity === name);
  const base = { taxon: 'Danio rerio', life_stage: 'adult', SL_m: st.SL_m, mass_kg: st.mass_kg, finArea_m2: st.lifting_area_m2, CLmax: pq('C_Lmax')?.value, LD_max: pq('(L/D)max')?.value,
    airspeed_m_s: WHATIF_LAUNCH, rho: pwq('air density (kg/m3)')?.value, glideHeight_m: 1, groundEffect: 0,
    efficiency: pwq('Fick eta')?.value, oxycaloric_J_per_unit_O2: pwq('Fick E_O2 (J/ml)')?.value, cardiacOutput: pwq('cardiac output (ml/s)')?.value, arterialO2: pwq('Hb O2 capacity (ml/ml)')?.value,
    fin_length_over_SL: after.result.parameters.pectoral_len_over_SL?.value ?? after.result.parameters.pectoral_len_over_SL };
  const claims = {
    lean_covered: { ...base, glideDistance_m: m(gw1, 'glide_range_lean_bound_m').value },
    studio_total: { ...base, glideDistance_m: m(gw1, 'glide_range_total_m').value },
  };
  const design = claims.studio_total;
  const leanA = await call('agent:physics', 'lean_check', { design: claims.lean_covered });
  const lean = await call('agent:physics', 'lean_check', { design: claims.studio_total });
  expect('lean_check ran (both claims)', !lean.error && !leanA.error, lean.error || leanA.error);
  const vrow = (L, id) => (L.result?.verdicts || []).find(v => (v.constraint ?? v.id) === id);
  const C15a = vrow(leanA, 'C15'), C15b = vrow(lean, 'C15'), C14 = vrow(lean, 'C14'), C16 = vrow(lean, 'C16');
  expect('C15: the Lean-covered glide distance holds the glide bound', C15a?.verdict === 'holds', JSON.stringify(C15a)?.slice(0, 200));
  expect('C15: the studio total (with the kinetic phase) breaks the steady-glide bound (validation D2)', C15b?.verdict === 'violated', JSON.stringify(C15b)?.slice(0, 200));
  const verdicts = lean.result?.verdicts || [];
  const byVerdict = verdicts.reduce((a, v) => ((a[v.verdict] = (a[v.verdict] || 0) + 1), a), {});
  const binding = (lean.result?.violations || []).filter(v => v.binding);
  const read = await call('human', 'session_read', { session: S });
  expect('session has open, proposal, comment, decision entries', ['open', 'proposal', 'comment', 'decision'].every(t => read.result.entries.some(e => e.type === t)), JSON.stringify(read.result.entries.map(e => e.type)));
  expect('organism now carries the approved edit with approved_by human', after.result.doc.edits.some(e => e.param === 'pectoral_area_over_SL2' && e.approved_by === 'human' && e.proposal_id === PID), JSON.stringify(after.result.doc.edits).slice(0, 300));
  expect('approved edit introduced no new binding Lean violation (as the evidence said)', evidence[1].new_binding_violations.length === 0, evidence[1].new_binding_violations.join(','));

  // --- copy the artefacts here and write the transcript
  const jsonl = fs.readFileSync(path.join(STORE, `${S}.jsonl`), 'utf8');
  fs.writeFileSync(path.join(DIR, 'session.jsonl'), jsonl);
  fs.copyFileSync(path.join(STORE, 'organisms', `${ORG_ID}.json`), path.join(DIR, `${ORG_ID}.json`));
  fs.writeFileSync(path.join(DIR, 'mcp-log.json'), JSON.stringify({ server: serverInfo, tools, calls: log }, null, 1));

  const entries = jsonl.trim().split('\n').map(l => JSON.parse(l));
  const tx = ['# Co-design session transcript', '', `Session \`${S}\` on \`${ORG_ID}\` (parent: winged-zebrafish). Spoken over MCP stdio to \`${serverInfo?.name} ${serverInfo?.version}\`. The raw log is \`session.jsonl\`, and every MCP call with its full result is in \`mcp-log.json\`. Authors are role labels, not people.`, ''];
  for (const e of entries) {
    tx.push(`## seq ${e.seq} · ${e.type} · ${e.author ?? e.decided_by_role}`, '', `*${e.ts}, lawset ${e.lawset_version}*`, '');
    if (e.type === 'open') tx.push(`Opened "${e.title}" on organism \`${e.organism}\`.`, '');
    if (e.body) tx.push(e.body, '');
    if (e.type === 'proposal') {
      tx.push(`**Proposal ${e.proposal_id}** (status at posting: ${e.status}). Edits:`, '', table(['target', 'param', 'op', 'value', 'reason'], e.edits.map(x => [`${x.target.level}:${x.target.id}`, x.param, x.op, n(x.value), x.reason])), '', `**Rationale.** ${e.rationale}`, '', '**Evidence** (scenario_run glide, attached verbatim):', '',
        table(['run', 'feasible', 'v_min', 'launch speed', 'glide total', 'Lean-covered part', 'wing loading', 'new binding Lean violations'], e.evidence.map(x => [x.label, String(x.feasible), q(x.v_min_m_s), q(x.launch_airspeed_m_s), q(x.glide_range_total_m), q(x.glide_range_lean_bound_m), q(x.wing_loading_N_m2), x.new_binding_violations.join(', ') || 'none'])), '');
    }
    if (e.type === 'decision') tx.push(`**${e.decision.toUpperCase()}** ${e.proposal_id}: ${e.reason}`, '', `Applied ${e.applied?.length ?? 0} edit(s). Lean violations recorded at that moment: ${(e.violations || []).length ? e.violations.map(v => `${v.law_id} (${v.severity}${v.baseline_violated ? ', base organism also violates it' : ''})`).join('; ') : 'none'}.`, '');
  }
  tx.push('## Refused on purpose', '', `- agent:physics tried \`session_post kind:"edit"\`: refused with "${bypass.error}".`, `- A second \`session_decide\` on ${PID}: refused with "${again.error}".`, '',
    '## lean_check on the approved design (agent:physics)', '',
    `Two claims about the approved fin under the what-if ${WHATIF_LAUNCH} m/s launch (assumed), both from 1 m. Claim A is the Lean-covered glide distance, ${n(claims.lean_covered.glideDistance_m)} m. Claim B is the studio's total, ${n(claims.studio_total.glideDistance_m)} m, which includes the level kinetic phase.`,
    `Shared inputs (SI): \`${JSON.stringify(base)}\`. SL, mass and lifting area come from organism_get STATE. CLmax, L/D, air density and the Fick inputs come from the glide scenario's provenance (kinds: CLmax ${pq('C_Lmax')?.kind}, L/D ${pq('(L/D)max')?.kind}, eta ${pwq('Fick eta')?.kind}, E_O2 ${pwq('Fick E_O2 (J/ml)')?.kind}, cardiac output ${pwq('cardiac output (ml/s)')?.kind}, arterial O2 ${pwq('Hb O2 capacity (ml/ml)')?.kind}). The airspeed is the assumed what-if.`, '',
    table(['constraint', 'law', 'claim A verdict', 'claim B verdict', 'message (claim B)'], verdicts.filter(v => v.verdict !== 'cannot-evaluate' || ['C15', 'C14', 'C16'].includes(v.constraint)).map(v => [v.constraint, v.law_id, vrow(leanA, v.constraint)?.verdict, v.verdict, ((lean.result?.violations || []).find(x => x.constraint === v.constraint)?.message || '').slice(0, 220)])), '',
    `Claim B verdict counts: ${Object.entries(byVerdict).map(([k, v]) => `${v} ${k}`).join(', ')}. Binding violations (claim B): ${binding.length ? binding.map(v => v.law_id ?? v.id).join(', ') : 'none'}.`,
    '', 'This is a floating-point evaluation of the Lean-backed formulas, not a kernel check.', '');
  fs.writeFileSync(path.join(DIR, 'transcript.md'), tx.join('\n'));

  const readme = `
A live, scripted co-design session over **MCP stdio**. The script spawns \`node sim-engine/server.mjs\`, connects with the MCP SDK client, and plays three roles on one organism.
The read-me states only outcomes; the turn-by-turn account is in [transcript.md](transcript.md), the raw log is [session.jsonl](session.jsonl), and every tool call with its full result is in [mcp-log.json](mcp-log.json).

**Headline.** agent:physics proposed raising the winged zebrafish's \`pectoral_area_over_SL2\` from ${n(area0)} to ${n(areaFF)} (the reference flying-fish value). agent:genotype added the causal-chain caveat, and **human approved it with \`session_decide\`**. The edit is now in the organism document, stamped \`approved_by: human\`, \`proposal_id: ${PID}\`.
- Physics evidence: wing loading ${q(m(gl0, 'wing_loading_N_m2'))} -> ${q(m(gl1, 'wing_loading_N_m2'))}, v_min ${q(m(gl0, 'v_min_m_s'))} -> ${q(m(gl1, 'v_min_m_s'))}.
  At its own launch speed (${q(m(gl0, 'launch_airspeed_m_s'))}) it **still cannot glide** (feasible ${gl1.result.run.feasible}). Under a what-if ${WHATIF_LAUNCH} m/s launch (*assumed*), the glide goes from ${q(m(gw0, 'glide_range_total_m'))} to ${q(m(gw1, 'glide_range_total_m'))}. Only ${q(m(gw1, 'glide_range_lean_bound_m'))} of that is inside the Lean bound.
- Genotype caveat: no gene in genotype/causal-chains.json maps to a quantitative fin area. The nearest candidate, kcnk5b, has chain strength *${k5?.chain_strength}*. ${chains.genes.length} genes have chains (${nStrong} have at least one link graded necessity or better; ${nChain} have a weakest link that strong), and all of it is zebrafish proxy data. Approving the edit fixes a shape, not a genotype.
- Guard rails held: an agent's direct \`kind:"edit"\` was refused, and so was a second decision on the same proposal.
- \`lean_check\` on the approved fin's what-if glide: for the glide bound C15, the Lean-covered ${n(claims.lean_covered.glideDistance_m)} m gives **${C15a?.verdict}** and the studio's ${n(claims.studio_total.glideDistance_m)} m total gives **${C15b?.verdict}**, because the level kinetic phase lies outside the steady-glide theorem (validation D2). Sustained flight: C14 ${C14?.verdict}, C16 ${C16?.verdict}. Binding violations: ${binding.length ? binding.map(v => v.law_id ?? v.id).join(', ') : 'none'}. (A floating-point evaluation, not a kernel check.)

MCP tools the server listed at run time (${tools.length}): ${tools.map(t => `\`${t}\``).join(', ')}.
${tools.includes('design_from_spec') ? '' : '`parse_design_text` and `design_from_spec` were **not** in the MCP tool list at run time (see tools/SPEC-REGISTER.md). Examples (a) and (b) call those handlers directly.'}

Storage: the server's session store was a fresh temp folder (\`STUDIO_SESSIONS_DIR\`). Nothing was written to sim-engine/sessions/. The session log and the organism document (\`${ORG_ID}.json\`) were copied into this folder.
`;
  finish({ dir: DIR, title: 'Co-design demo over MCP stdio', checks, readme,
    headline: `proposal ${PID} by agent:physics (pectoral_area_over_SL2 ${n(area0)} -> ${n(areaFF)}), genotype caveat (kcnk5b chain ${k5?.chain_strength}), approved by human via session_decide; agent edit and double decision refused; lean_check C15 ${C15a?.verdict} for the Lean-covered glide and ${C15b?.verdict} for the studio total; C14 ${C14?.verdict}, C16 ${C16?.verdict}`,
    output: { session: S, store: STORE, tools, lean_check_claims: claims, lean_check_lean_covered: leanA, lean_check_studio_total: lean, evidence } });
} catch (e) {
  fs.writeFileSync(path.join(DIR, 'mcp-log.json'), JSON.stringify({ server: serverInfo, tools, calls: log, fatal: e.stack }, null, 1));
  expect('script completed without an exception', false, e.message);
  finish({ dir: DIR, title: 'Co-design demo over MCP stdio', checks, readme: `The run threw: \`${e.message}\`. See mcp-log.json.`, headline: `FAILED: ${e.message}`, output: { fatal: e.stack } });
} finally {
  await client.close();
  fs.rmSync(STORE, { recursive: true, force: true }); // the artefacts were copied into this folder
}
