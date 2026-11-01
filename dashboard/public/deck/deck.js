(function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = v => (typeof v === 'number' ? v.toLocaleString('en-US') : '—');
const n1 = v => (typeof v === 'number' ? v.toFixed(0) : '—');

const tkey = 'delphi-theme';
if (localStorage.getItem(tkey)) document.documentElement.dataset.theme = localStorage.getItem(tkey);
$('#themeBtn').onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next; try { localStorage.setItem(tkey, next); } catch {}
};
$('#pptx').onclick = () => { location.href = 'delphi-pitch.pptx'; };

const POL = {
  q2c_nomodel: 'Ask-to-settle, no model', q2c: 'Ask-to-settle, with model',
  collective_shared: 'Five agents, sharing', collective_isolated: 'Five agents, isolated',
  lazysp_alternate: 'Established search method', directed: 'Head toward the target', greedy: 'Always climb highest'
};
const ARM = { centralized: 'Swarm, led', decentralized: 'Swarm, peer-to-peer', isolated: 'Workers, isolated', single: 'One agent alone' };

// a bar row; every bar carries its own value label (light-mode relief rule)
const bar = (label, value, max, text, series = 1, extra = '') =>
  `<div class="brow"><span class="blab">${esc(label)}</span>
    <span class="btrack"><i class="bfill" data-w="${Math.max(0.5, value / max * 100).toFixed(1)}" style="background:var(--series-${series})"></i></span>
    <span class="bval" style="color:var(--text-primary)">${esc(text)}</span></div>${extra}`;


// ScienceClaw judging weights (scienceclawhack.ai): the deck is built around these, one slide per criterion.
const RUBRIC = {
  significance: 'Problem significance &middot; 20',
  impact: 'Scientific impact &middot; 25',
  agency: 'Decentralized agency &middot; 20',
  collective: 'Collective capability &middot; 25',
  execution: 'Execution &amp; validation &middot; 10',
  reuse: 'Reused by others &middot; +10'
};
const rub = k => RUBRIC[k] ? `<span class="rubric">${RUBRIC[k]}</span>` : '';

// a real plot, made from measured data, shown with where it came from
const FIG = {};
(window.__figs || []).forEach(f => { FIG[f.file.replace('fig/', '')] = f; });
const realFig = (name, lead, cls = '') => {
  const f = FIG[name];
  if (!f) return '';
  return `<figure class="real"><img src="${esc(f.file)}" alt="${esc(f.shows)}" class="${cls}" loading="lazy">
    <figcaption><b>${esc(lead || f.shows)}</b><br>${esc(f.provenance)}
      ${f.sha256 ? `<br><span class="prov">sha256 ${esc(f.sha256.slice(0, 32))}&hellip;</span>` : ''}</figcaption></figure>`;
};

const ribbon = st => st === 'live' ? '<span class="ribbon live">Evidence in hand</span>'
  : st === 'partial' ? '<span class="ribbon partial">Partly evidenced</span>'
  : '<span class="ribbon">Anticipated &mdash; no data yet</span>';

fetch('data.json').then(r => r.json()).then(build).catch(e => {
  $('#deck').innerHTML = `<div class="slide"><h1>Could not load the deck data</h1><p class="sub">${esc(e.message)}</p></div>`;
});


function build(D) {
  window.__figs = (D.numbers && D.numbers.figures) || [];
  (D.numbers.figures || []).forEach(f => { FIG[f.file.replace('fig/', '')] = f; });
  const N = D.numbers, S = Object.fromEntries(D.slides.map(s => [s.id, s]));
  const st = id => (S[id] || {}).state || 'live';
  const needs = id => (S[id] || {}).needs || '';
  const F = N.facts || {};
  const NEG = Object.fromEntries((N.negatives || []).map(n => [n.id, n]));
  const SHOT = Object.fromEntries((N.pageShots || []).map(p => [p.file.replace(/^fig\/page_|\.png$/g, ''), p]));
  const LT = N.leanTruth, NP = N.nanopubTruth;
  const DEL = N.deliverables || [];
  const delOf = n => DEL.find(x => x.n === n);

  // Which of the four this slide delivers. Same marker, same place, every time, so the viewer always
  // knows where in the four they are. Derived from data.json, never typed per slide.
  const badge = id => {
    const ns = ((S[id] || {}).deliverable) || [];
    if (!ns.length || id === 'four') return '';   // the map slide numbers its own cards
    return `<div class="badge">${ns.map(n => {
      const dd = delOf(n);
      return `<span class="bn" title="${esc(dd ? dd.name : '')}"><i>${n}</i>${esc(dd ? dd.name : '')}</span>`;
    }).join('')}</div>`;
  };

  // ---------------- shared pieces ----------------
  const srcs = list => `<p class="srcline">Read from ${list.filter(Boolean).map(esc).join(' &middot; ')}</p>`;
  const ghost = id => `${ribbon('anticipated')}<div class="ghostbox"><div class="gi">Waiting on ${esc(needs(id))}</div></div>`;

  // A screenshot of one of our own pages. Never a drawing: if the shot is missing the slide says so.
  const pageFig = (key, lead, cls = 'figshot') => {
    const p = SHOT[key];
    if (!p) return `<div class="ghostbox" style="min-height:150px"><div class="gi">No screenshot: the page did not render in the headless check, so nothing is shown here</div></div>`;
    return `<figure class="real"><img src="${esc(p.file)}" alt="${esc(p.shows)}" class="${cls}" loading="lazy">
      <figcaption><b>${esc(lead || p.shows)}</b><br>${esc(p.provenance)}
        <br><span class="prov">sha256 ${esc((p.sha256 || '').slice(0, 32))}&hellip;</span></figcaption></figure>`;
  };

  // A result row: the claim, the number, the verdict. Used wherever a count carries the point.
  const rrow = (label, value, sub, tone = '') =>
    `<div class="rrow"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="v ${tone}">${esc(value)}</span></div>`;

  // The four figures of a negative result, laid out as one row of tiles.
  const negTiles = n => `<div class="heroes negtiles">
    ${(n.figures || []).map(([l, v]) => `<div class="hero s2">
      <div class="n">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('')}
  </div>`;

  // ---------------- slide renderers: one idea, one visual, as few words as possible ----------------
  const SL = {};

  // ════════ 1-4 · the fire ════════

  SL.title = () => `
    <div class="eyebrow">MorphoLemma &middot; ScienceClaw &middot; MIT Media Lab</div>
    <h1>Biology has never built<br>the thing you check a<br>design against.</h1>
    <p class="sub" style="max-width:40ch">Mathematics has mathlib. Biology has papers, protocols, and the
      people who know how to make them work.</p>
    <div class="route" data-anim="route-intro">
      ${['claim', 'nanopub', 'debate', 'Lean', 'axiom', 'design', 'validate'].map((nd, i, a) =>
        `<div class="node${i === 0 ? ' start' : i === a.length - 1 ? ' end' : ''}" data-i="${i}">${esc(nd)}</div>`
        + (i < a.length - 1 ? `<div class="link" data-i="${i}"></div>` : '')).join('')}
    </div>
    <p class="caption">Every step above is a running system. Where a result does not exist, the slide is greyed
      instead of guessed &mdash; including on our own headline claim, which fails.</p>`;

  SL.tacit = () => {
    const t = F.tacit;
    if (!t || !t.verified) return ghost('tacit');
    return `${ribbon(st('tacit'))}
      <h2>The knowledge that makes biology work is not written down.</h2>
      <p class="sub" style="max-width:56ch">${esc(t.sentence)}</p>
      <div class="rows">
        ${t.literature.map(l => `<div class="rrow" style="grid-template-columns:1fr">
          <span><b>${esc(l.cite)}</b>
            <small><em style="color:var(--accent);font-style:normal;font-weight:650">${esc(l.role)}</em>
              &nbsp;&mdash;&nbsp; ${esc(l.what)}${l.caveat
                ? ` <span style="color:var(--serious)"><b>Caveat:</b> ${esc(l.caveat)}</span>` : ''}</small>
          </span></div>`).join('')}
      </div>
      ${t.punchline ? `<div class="flag"><b>${esc(t.punchline)}</b> That third line is not a footnote on the
        other two. It is the finding: the discipline that lives on this problem never even named it.</div>` : ''}
      <p class="caption">A claim about biology&rsquo;s own literature, not about agents. The gap is not that
        agents are weak at biology. It is that biology has never produced the formal artefact that would let
        anything &mdash; human or agent &mdash; check a design.</p>
      ${srcs([t.locator])}`;
  };

  SL.noobject = () => `${ribbon('live')}
    <h2>So an agent has nothing to check against.</h2>
    <div class="split">
      <div>
        <div class="rows">
          ${rrow('<b>In mathematics</b>', 'a kernel proof', 'An agent writes a statement, a proof assistant accepts or rejects it, and the verdict needs no referee. Agents are extremely good at this.')}
          ${rrow('<b>In biology</b>', 'a reviewer', 'An agent proposes a design. Nothing can say whether it is consistent with what is already known, at any scale, because what is already known has no machine-checkable form.')}
        </div>
        <p class="caption">A design model can generate a sequence all day. Without a formal object to check it
          against, every proposal is as good as every other proposal, and the only filter left is an experiment
          that costs a year.</p>
      </div>
      <div>
        <div class="scope"><h4>What is missing, precisely</h4><ul>
          <li>A statement of a biological law that a machine can evaluate on a candidate design.</li>
          <li>A way to tell a law that <em>binds</em> from one that merely sounds true.</li>
          <li>A record of what each law rests on, so a later correction can reach every result built on it.</li>
        </ul></div>
      </div>
    </div>`;

  SL.contrast = () => {
    const m = F.mathlib, b = F.biologyFormal, fp = F.formalisationPapers;
    const greyed = !b || !b.verified;
    return `${ribbon(greyed ? 'partial' : 'live')}
      <h2>The asymmetry, in one line.</h2>
      <div class="heroes negtiles" style="align-items:flex-start">
        <div class="hero s1"><div class="n">${m && m.verified ? n0(m.theorems) : '&mdash;'}</div>
          <div class="l">theorems in mathlib, over ${m ? n0(m.definitions) : '&mdash;'} definitions, from ${m ? n0(m.contributors) : '&mdash;'} contributors${m && m.asOf ? ` &mdash; ${esc(m.asOf)}` : ''}</div></div>
        <div class="hero s4"><div class="n">${fp && fp.verified ? n0(fp.value) : '&mdash;'}</div>
          <div class="l">papers this year whose abstract talks about formalising maths in Lean; ${fp ? fp.october : '&mdash;'} in October alone. We counted these ourselves.</div></div>
        <div class="hero"><div class="n" style="color:var(--critical)">${greyed ? '?' : (b.value + ' of ' + b.of)}</div>
          <div class="l">${esc((b && b.claimWithoutANumber) || 'Nothing comparable exists for biology.')}</div></div>
      </div>
      ${greyed
        ? `<div class="flag"><b>We will not put a number here.</b> ${esc(b.whyNoNumber)}</div>`
        : `<p class="sub" style="max-width:62ch">${esc(b.sentence)}</p>
           <div class="split">
             <div class="scope warn"><h4>What we are NOT claiming</h4>
               <p style="margin:0">${esc(b.counterexamples)}</p></div>
             <div class="scope"><h4>The narrow sense in which this is new</h4>
               <p style="margin:0">${esc(b.narrowFirst)}</p></div>
           </div>`}
      <p class="caption">A bald &ldquo;zero biology theorems&rdquo; would be false, and the newest
        counterexample is six days old. The zero we can defend is a zero <em>of something</em>: zero of
        mathlib&rsquo;s 34 subject areas. You can check it from the stage.</p>
      ${srcs([m && m.locator, fp && fp.locator, b && b.locator])}`;
  };

  SL.attrition = () => {
    const a = F.attrition;
    if (!a || !a.verified) return ghost('attrition');
    return `${ribbon('live')}
      <h2>That is why this is expensive.</h2>
      <div class="heroes">
        <div class="hero s2"><div class="n">9 in 10</div>
          <div class="l">drug programmes that enter clinical trials never reach approval</div></div>
      </div>
      <p class="sub" style="max-width:52ch">If almost everything that reaches a trial fails, the leverage is not in
        running more trials. It is in theoretical biology: knowing which experiment would change what you believe,
        before the experiment is paid for.</p>
      <div class="flag"><b>Say it exactly this way.</b> ${esc(a.trap)}</div>
      ${a.corrigendum ? `<p class="tiny"><b>Corrigendum:</b> ${esc(a.corrigendum)}</p>` : ''}
      <p class="tiny">${a.sources.map(esc).join(' &nbsp;&middot;&nbsp; ')} &nbsp;&middot;&nbsp; ${esc(a.range)}</p>
      ${srcs([a.locator])}`;
  };

  // ════════ 5-7 · the Forum ════════

  SL.four = () => {
    if (!DEL.length) return ghost('four');
    return `${ribbon(st('four'))}
      <h2>Four things exist. Here they are.</h2>
      <div class="fourgrid">
        ${DEL.map(x => `<article class="dcard">
          <header><i>${x.n}</i><h3>${esc(x.name)}${x.inDevelopment
            ? ' <span class="wip">in development</span>' : ''}</h3></header>
          ${SHOT[x.shot] ? `<img src="${esc(SHOT[x.shot].file)}" alt="${esc(SHOT[x.shot].shows)}" loading="lazy">`
            : '<div class="noshot">no screenshot</div>'}
          <p>${esc(x.what)}</p>
        </article>`).join('')}
      </div>
      <p class="caption">Every panel is a screenshot of a page that is running, not a drawing. From here on,
        each slide carries the number of the deliverable it belongs to.</p>
      ${srcs(DEL.map(x => SHOT[x.shot] ? SHOT[x.shot].route : null))}`;
  };

  SL.forum = () => {
    const L = N.lawreg;
    const accepted = (L?.inLawset || []).find(r => r.status === 'accepted');
    return `${ribbon(st('forum'))}
      <h2>MorphoLemma: a theorem becomes an axiom only if it survives both gates.</h2>
      ${delOf(1) ? `<p class="sub" style="max-width:68ch;margin-bottom:.7em"><b>The way in is the
        deliverable.</b> ${esc(delOf(1).how)}</p>` : ''}
      <div class="chain" data-anim="chain">
        ${[['upload', 'a nanopub-backed theorem'], ['debate', 'agents argue it on the existing evidence'],
           ['Lean', 'the kernel checks that it follows from its premises'],
           ['axiom', 'accepted: it may now constrain a design'],
           ['or', 'rejected, contested or retired &mdash; kept, with its reason']]
          .map(([k, v], i) => `<div class="stage${i === 1 || i === 2 ? ' key' : ''}" data-i="${i}"><b>${k}</b>${v}</div>`).join('')}
      </div>
      <div class="split" style="margin-top:14px">
        <div>
          <p class="sub" style="max-width:50ch">Both gates, or neither. A statement that compiles but loses the
            debate is not a law. A statement that wins the debate but does not follow from its premises is not a
            law either. Neither failure is deleted: it is recorded with its reason, so nobody proposes it again.</p>
          ${L ? `<div class="bars" style="max-width:620px">
            ${(L.inLawset || []).map((r, i) => bar(r.status, r.n, L.inLawsetTotal,
              `${r.n}  (${r.physical} physical, ${r.biological} biological)`,
              r.status === 'accepted' ? 3 : r.status === 'retired' ? 4 : r.status === 'contested' ? 2 : 1)).join('')}
          </div>` : ''}
        </div>
        <div class="scope"><h4>The line the whole thing rests on</h4>
          <p style="margin:0">Lean proves that a conclusion follows from stated premises. It does not adjudicate
          reality. Every theorem here is of the form &ldquo;if these premises hold, then this follows&rdquo;, and a
          kernel proof of it is silent on whether any organism satisfies the premises.</p></div>
      </div>
      ${srcs(L ? ['lean/registry/lawsets/current.json', `lawset ${L.lawset}`, 'lean/registry/laws/*.json'] : [])}`;
  };

  SL.provenance = () => `${ribbon(st('provenance'))}
    <h2>Today&rsquo;s theorems came out of four books.</h2>
    <div class="figrow">
      <div>
        <div class="rows">
          ${rrow('<b>Darwin</b> &mdash; <i>On the Origin of Species</i>, 1859', 'primary', 'Sentences read from the source text itself')}
          ${rrow('<b>Thompson</b> &mdash; <i>On Growth and Form</i>, 1917', 'primary', 'Scaling and growth claims, taken verbatim and then operationalised')}
          ${rrow('<b>Turing</b> &mdash; reaction&ndash;diffusion', 'secondary', 'Reached through the mathematical-biology literature that formalised it')}
          ${rrow('<b>Wolfram</b> &mdash; <i>A New Kind of Science</i>', 'tertiary', 'Computation-in-biology claims, the least dataset-shaped of the four')}
        </div>
        <p class="caption">Decentralised agent swarms distilled the assertions into nanopublications and argued the
          evidence sources <b>before</b> anything was formalised. Formalising first would have produced beautiful
          proofs of sentences nobody had checked anyone actually wrote.</p>
        ${LT ? `<div class="flag"><b>And then almost none of it was proved.</b> Of the
          ${n0(LT.claimsExtracted)} claims we extracted from these books, <b>four</b> are proved in the
          built Lean library &mdash; all four Thompson&rsquo;s, none Darwin&rsquo;s, none Wolfram&rsquo;s.
          ${esc(LT.avesNote)} So two of the four are not on any slide here.</div>` : ''}
      </div>
      ${pageFig('graph', 'The claim graph as served: each claim linked to the tests that checked it, the Lean theorem that formalised it, and the taxa it names', 'figwide')}
    </div>
    ${srcs(['docs/claims.json', 'darwin-origin/', 'thompson-growth-form/', 'wolfram-nks/', 'math-bio-theorems/'])}`;

  SL.swarm = () => {
    const arms = N.swarmArms || [];
    if (!arms.length) return ghost('swarm');
    const max = Math.max(...arms.flatMap(a => [a.exp1 || 0, a.exp2 || 0]), 20);
    return `${ribbon(st('swarm'))}
      <h2>The distillation was done by a swarm, and we measured whether that mattered.</h2>
      <div class="bars grouped" style="max-width:860px">
        ${arms.map((a, i) => bar(ARM[a.key] || a.key, a.exp2 ?? a.exp1, max,
          `${a.exp1 ?? '&mdash;'} / ${a.exp2 ?? '&mdash;'} of 20`, (i % 4) + 1)).join('')}
      </div>
      <div class="legend"><span>Each arm wrote 20 pre-registered test plans, each naming one real public dataset.
        Both numbers are plans whose dataset URL and DOI a script could actually fetch. Same model, same prompt,
        same schema, same budget.</span></div>
      <p class="caption">Peer-to-peer and led swarms both beat one agent working alone, and
        <b>${N.swarmFabricated === 0 ? 'no arm fabricated a single identifier' : 'fabricated identifiers were counted'}</b>
        &mdash; every URL and DOI was fetched once by script, and a 404 counts as fabrication, not as bad luck.</p>
      ${srcs(['swarm/PREREG.md', 'swarm/compare/results.json', 'swarm/compare/verify.mjs'])}`;
  };

  SL.bench4 = () => {
    const B = N.benchmark;
    if (!B) return ghost('bench4');
    const ARMN = { single: 'One agent', decentralised: 'Decentralised swarm', centralised: 'Centralised swarm' };
    const cell = (r, a) => r.noArtifact.includes(a)
      ? '<span class="no">no artifact</span>'
      : `<span class="${r[a] === Math.max(r.single, r.decentralised, r.centralised) ? 'top' : ''}">${r[a].toFixed(3)}</span>`;
    return `${ribbon('live')}
      <h2>Three architectures, one budget. Quality did not separate.</h2>
      <p class="sub" style="max-width:66ch">Same total budget per task, byte-identical inputs. At every stage
        shown, the spread <em>within</em> an arm is larger than the gap <em>between</em> arms. The swarms cost
        ${esc(B.cost.range)} the dollars and ${esc(B.cost.tokens)} the tokens.</p>
      <div class="tscroll"><table class="mini bench">
        <tr><th>stage</th><th>one agent</th><th>decentralised</th><th>centralised</th><th>gap</th><th>within-arm spread</th><th></th></tr>
        ${B.rows.map(r => `<tr>
          <td><b>${esc(r.title)}</b></td>
          <td>${cell(r, 'single')}</td><td>${cell(r, 'decentralised')}</td><td>${cell(r, 'centralised')}</td>
          <td>${r.gap.toFixed(3)}</td><td>${r.spread.toFixed(3)}</td>
          <td><span class="tag ${r.separates ? 'neg' : 'grey'}">${r.separates ? 'separates' : 'does not separate'}</span></td>
        </tr>`).join('')}
      </table></div>
      <div class="split" style="margin-top:14px">
        <div class="flag" style="margin-top:0"><b>The result is about our framework, not about swarms.</b>
          All three arms were handed the same trap: a validation run where no gate failed, four of five were
          <em>cannot-assess</em>, and the scorer&rsquo;s own composite read ${B.trapComposite} and called itself
          plausible. ${B.allArmsHonest ? 'Every arm got all five statuses right, summed nothing, refused to read '
          + 'cannot-assess as a pass, and named the composite only with its disclaimer.'
          : 'The arms did not all handle it the same way.'}
          <b>There is no architectural difference in honesty.</b> The guardrails hold whoever is driving.</div>
        <div class="scope warn"><h4>Read these two before quoting us</h4><ul>
          <li><b>n = ${B.N}</b> tasks per cell, no replicates. A difference smaller than the within-arm spread is
            reported as not separating, and no significance is claimed.</li>
          <li><b>No arm had tools.</b> This measures three <em>reasoning</em> architectures over fixed inputs.
            Our own system is tool-coordinated, so this says nothing about it.</li>
        </ul></div>
      </div>
      <div class="split" style="margin-top:10px">
        <div class="scope"><h4>The one difference that replicated &mdash; and its answer</h4>
          <p style="margin:0">The centralised arm produced <b>no artifact in ${B.merge.tasksWithNoArtifact} of
          ${B.merge.tasks}</b> nanopub tasks. The equal-budget rule gave it a $${B.merge.capPerCall} cap per call
          across 5 calls; ${B.merge.callsOverCap} of its ${B.merge.callsTotal} calls hit that cap. A post-hoc
          re-allocation of the <b>same total</b>, spent unevenly, produced an artifact in
          ${B.merge.rescued} of ${B.merge.rescueOf}. So: centralisation works here, and is budget-fragile at the
          join. The rescue is post-hoc and was not pre-registered.</p></div>
        <div class="scope warn"><h4>One stage is not shown</h4>
          <p style="margin:0">The design stage is omitted. Its briefs are infeasible at lawset 1.8.1: all three
          arms violate the same five binding laws, and changing one field drops the violations from five to zero.
          &ldquo;Accepted&rdquo; was unreachable by construction, so that stage measures the brief, not the arms.
          The benchmark printed that on its own figure rather than burying it.</p></div>
      </div>
      <p class="caption">Whole matrix: ${B.cost.cells} cells, ${B.cost.calls} logged calls, $${B.cost.dollars}.
        Every bar on <a href="${esc(B.page)}">${esc(B.page)}</a> opens the run that produced it &mdash; the prompt
        as sent, the raw output, tokens, cost, stop reason and the grader&rsquo;s reasoning.</p>
      ${srcs(B.sources)}`;
  };

  SL.mcp = () => `${ribbon(st('mcp'))}
    <h2>Served as an MCP server, so an agent can ask it things.</h2>
    <div class="figrow">
      ${pageFig('capability', 'The capability map, live: who would use this, what they would ask, and every tool that is missing', 'figwide')}
      <div>
        <div class="rows">
          ${rrow('Personas', '14', 'One per person or agent with a reason to open a formalised law registry over biology &mdash; and what they do today without it')}
          ${rrow('Use cases', '32', 'One row per job, with the tool sequence that answers it today; 9 are answerable now, 8 are not')}
          ${rrow('Grand questions', '14', 'Each split into the formalisable core and the empirical remainder, with why no proof reaches the remainder')}
          ${rrow('Ranked tool gaps', '27', 'Ranked at build time. A test tampers with a stored rank to prove no gap can assert its own importance.')}
        </div>
        <div class="scope warn" style="margin-top:12px"><h4>And what it cannot do</h4>
          <p style="margin:0">Most of these questions are mostly empirical remainder. A capability map that let
          progress on the formal part be read as progress on the empirical part would be worse than no map.</p></div>
      </div>
    </div>
    ${srcs(['/leanbio/capability.html', 'pipeline/leanbio/capability-map/build.mjs', 'dashboard/public/leanbio/capability.json'])}`;

  // ════════ 8-9 · what the theorems constrain ════════

  SL.constrain = () => {
    const A = N.anatomy;
    return `${ribbon(st('constrain'))}
      <h2>Those theorems constrain a text-to-organism model.</h2>
      <div class="figrow">
        ${pageFig('blueprint', 'The blueprint the studio writes into: a morphological change on a base organism, resolved down every layer', 'figwide')}
        <div>
          <p class="sub" style="max-width:46ch">You type a phenotype. The model has to say which genetic change
            produces it, at every layer and at every developmental stage &mdash; and every layer it touches is an
            existing ontology term, so a law can be evaluated on it.</p>
          ${A ? `<div class="rows">
            ${rrow('Named pieces across the models', String(A.pieces), 'flying fish, adult zebrafish and larval zebrafish')}
            ${rrow('Mapped to an ontology term', String(A.mapped), `${A.unmapped} are not, and are shown as unmapped rather than quietly dropped`)}
            ${rrow('Values that are a real measurement', String(A.sourcedValues), 'everything else in the flying-fish model is schematic, and the page says so on its face')}
          </div>` : ''}
          <div class="flag">One measured proportion carries the flying-fish model: pectoral fin length 0.687 of
            standard length, n&nbsp;=&nbsp;49 museum specimens. Body depth, fin spread, organ shapes and every count
            are illustrative.</div>
        </div>
      </div>
      ${srcs(['anatomy-model/manifest.json', 'anatomy-model/zebrafish/', 'Daane et al. 2021, doi 10.1016/j.cub.2021.08.054'])}`;
  };

  SL.lawreg = () => {
    const L = N.lawreg, R = N.lawRowFacts;
    if (!L) return ghost('lawreg');
    return `${ribbon(st('lawreg'))}
      <h2>A law that binds nothing is worse than no law.</h2>
      <div class="split">
        <div>
          <p class="sub" style="max-width:52ch">An accepted law that evaluates nowhere gives false assurance: the
            law base reads as though a design had been checked against it when nothing was. So every accepted law
            that produces no design row is listed, with a written reason and what would make it bind.</p>
          <div class="rows">
            ${rrow('Laws in lawset ' + esc(L.lawset), String(L.inLawsetTotal), 'versioned, pinned to a commit, and mirrored into the MCP server')}
            ${R ? rrow('Accepted', String(R.accepted), 'may rule a design out') : ''}
            ${R ? rrow('&hellip; of which produce <b>no design row</b>', String(R.noDesignRow), 'each with a written reason, and the check fails if an entry stops being true', 'no') : ''}
            ${rrow('Retired, never deleted', String((L.inLawset || []).find(r => r.status === 'retired')?.n ?? 0), 'so an older lawset still reproduces')}
          </div>
        </div>
        <div class="scope"><h4>Three of the fifteen reasons, verbatim</h4><ul>
          <li><b>kimura-fixation-probability</b> &mdash; fixation probability of an allele in a population; a design commits no population size or selection coefficient.</li>
          <li><b>scaling-bending-law</b> &mdash; the section modulus needs a cross-section; the resolved state carries none, so no design can be judged.</li>
          <li><b>fick-principle</b> &mdash; it is the named hypothesis the aerobic bound rests on, not the law that rules anything out, so it owns no constraint.</li>
        </ul></div>
      </div>
      ${srcs(['lean/registry/check-exposed.mjs', 'lean/registry/lawsets/current.json', 'mcp/server.mjs'])}`;
  };

  SL.studio = () => {
    const T = N.studio;
    if (!T || !T.shot) return ghost('studio');
    const s = T.shot;
    return `${ribbon(st('studio'))}
      <h2>Design Studio <span class="alias">(MorphoSwarm)</span>: type the phenotype, get the criteria.</h2>
      <p class="sub" style="max-width:64ch;margin-bottom:.7em">Part of <b>delphi-frontier</b>, and
        <span class="wip">actively in development</span> &mdash; the screen below is where it is today,
        not where it stops.</p>
      <div class="figrow">
        <figure class="real"><img src="${esc(s.file)}" alt="The design studio parsing a typed phenotype on the real engine" class="figshot" loading="lazy">
          <figcaption><b>Typed into the live studio, not a mock-up:</b> &ldquo;${esc(s.typed)}&rdquo;<br>
            ${esc(s.engineLine || '')} &mdash; ${esc(s.criteria)} criteria parsed, ${s.valid ? 'valid against the engine' : 'NOT valid against the engine'}.
            <br><span class="prov">sha256 ${esc((s.sha256 || '').slice(0, 32))}&hellip;</span></figcaption></figure>
        <div>
          <p class="sub" style="max-width:44ch">The studio turns a sentence into criteria the engine can actually
            run. A clause it cannot parse is shown in red and is <b>not</b> checked by anything downstream, rather
            than being silently dropped.</p>
          <div class="rows">
            ${rrow('Scenarios the engine runs', String((T.scenarios || []).length), (T.scenarios || []).join(', '))}
          </div>
        </div>
      </div>
      ${srcs(T.sources || [])}`;
  };

  SL.sim = () => `${ribbon(st('sim'))}
    <h2>Then physics, flow and development stress-test it.</h2>
    <div class="figrow">
      ${pageFig('physics', 'The flying-fish simulator: the solver computes the trajectory and the anatomy meshes fly it, sample by sample', 'figwide')}
      <div>
        <div class="rows">
          ${rrow('<b>Physics simulation</b>', 'runs', 'A glide solver over the design&rsquo;s own mesh and mass, with ground effect, headwind, altitude and depth as parameters')}
          ${rrow('<b>Developmental simulation</b>', 'runs', 'The same design resolved at each stage, so a criterion can be demanded at adult and failed at larva')}
          ${rrow('<b>Flow matching</b>', 'not here yet', 'The generative half of the design model; nothing in this deck rests on it', 'no')}
        </div>
        <div class="flag">The simulator page carries its own banner: <b>not a validated result</b>. Tests 1 to 3 are
          post-hoc, and under the pre-registered upper bound the model lets a real fish gain net energy &mdash; which
          shows the tuned launch thrust to be unphysical. Both outcomes are in the run log; nothing was retuned.</div>
      </div>
    </div>
    ${srcs(['/t/physics/sim/', 'physics/sim/RUNS.md', 'physics/PREREG.md', 'sim-engine/CONTRACT.md'])}`;

  // ════════ 10 · the harness, and then what it said ════════

  SL.harness = () => `${ribbon(st('harness'))}
    <h2>The validation harness, in four moves.</h2>
    <div class="chain" data-anim="chain">
      ${[['1', 'take the predicted sequence and the desired function'],
         ['2', 'find the closest FUNCTIONAL analogue, not the closest relative'],
         ['3', 'annotate every functional difference, interpretably'],
         ['4', 'score formally in LeanBio, then run physics on the mesh']]
        .map(([k, v], i) => `<div class="stage key" data-i="${i}"><b>step ${k}</b>${v}</div>`).join('')}
    </div>
    <div class="figrow" style="margin-top:12px">
      ${pageFig('validate', 'The harness on the headline design, at the physics act: five named results, each with its own gate', 'figwide')}
      <div>
        <p class="sub" style="max-width:42ch">Five named results, side by side, each with its own gate. They are
          never summed. Where the evidence does not exist the page leaves a marked gap instead of drawing
          something pretty &mdash; nine gaps on this run.</p>
        <div class="scope warn"><h4>On the run shown</h4>
          <p style="margin:0">1&nbsp;pass &middot; 2&nbsp;fail &middot; 2&nbsp;not assessed. The next three slides
          are what the two failures and the gaps actually say.</p></div>
      </div>
    </div>
    ${srcs(['sim-engine/validate/pipeline/index.mjs', 'dashboard/public/validate-show/run-winged-zebrafish.json'])}`;

  SL.physicsgate = () => {
    const n = NEG.physicsgate;
    if (!n) return ghost('physicsgate');
    return `${ribbon('live')}
      <h2>Our headline design does not fly.</h2>
      ${negTiles(n)}
      <p class="sub" style="max-width:58ch">${esc(n.detail)}</p>
      <div class="flag">This is the design the whole deck is built around, and the gate it fails is the one that
        matters. A deck that claimed a working flying fish would lose to one honest question; this is the answer
        to that question, put on a slide before anyone has to ask it.</div>
      ${srcs([n.locator])}`;
  };

  SL.funcledger = () => {
    const n = NEG.funcledger;
    if (!n) return ghost('funcledger');
    return `${ribbon('live')}
      <h2>And the negative control scores exactly as well.</h2>
      ${negTiles(n)}
      <p class="sub" style="max-width:60ch">${esc(n.detail)}</p>
      <div class="split" style="margin-top:4px">
        <div class="scope warn"><h4>Why that is the sharpest result we have</h4>
          <p style="margin:0">On this ledger the designed fish is exactly as far from the flying fish&rsquo;s known
          requirement set as an unedited zebrafish is. The control was pre-registered, and it behaved as it must.</p></div>
        <div class="scope"><h4>What the ledger is not</h4>
          <p style="margin:0">Every requirement is a <b>sequence state</b> of the analogue, never a measured
          function of it: no flying-fish transcriptome, proteome, mutant or assay exists in any archive we
          searched. Zero of the loci have functional data of any kind.</p></div>
      </div>
      ${srcs([n.locator])}`;
  };

  SL.knownbad = () => {
    const ids = ['compensation', 'edges', 'deadlaws', 'nevertried', 'noapproval'];
    const got = ids.map(i => NEG[i]).filter(Boolean);
    if (!got.length) return ghost('knownbad');
    return `${ribbon(got.length === ids.length ? 'live' : 'partial')}
      <h2>${['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][got.length] || got.length} more results that go against us.</h2>
      <div class="rows">
        ${got.map(n => rrow(`<b>${esc(n.headline)}</b>`, n.keyFigure || '', esc(n.detail), 'no')).join('')}
      </div>
      ${ids.length !== got.length ? `<div class="flag">${ids.length - got.length} further result(s) are not shown:
        their source file no longer says what this deck claimed, so the claim was dropped rather than reprinted.</div>` : ''}
      <p class="caption">Each one is read back out of its own source file at build time. If a number drifts, the row
        disappears from this slide rather than quietly going stale.</p>
      ${srcs(got.map(n => n.locator))}`;
  };

  SL.nocomposite = () => `${ribbon('live')}
    <h2>We are not going to give you one number.</h2>
    <div class="split">
      <div>
        <p class="sub" style="max-width:52ch">Three different composite values for this same design are under
          investigation right now. Until that is settled, no composite score goes on any slide, in any deck, or
          into any record. You get the gates.</p>
        <div class="rows">
          ${rrow('Physics gate', 'FAIL', 'the design does not do what was asked', 'no')}
          ${rrow('Functional-analogue ledger', 'FAIL', '19 differences unresolved; the unedited control scores the same', 'no')}
          ${rrow('Phenotype similarity', 'PASS', 'the one gate it clears', 'yes')}
          ${rrow('Genotype similarity', 'CANNOT ASSESS', 'the design carries no gene-level edit, so no sequence was compared. This is not a pass.')}
          ${rrow('Lean law check', 'CANNOT ASSESS', 'no accepted law could be evaluated on this design: 25 cannot-evaluate, 10 out of scope')}
        </div>
      </div>
      <div class="scope warn"><h4>Why a single score is the dangerous output</h4>
        <p style="margin:0">A composite hides which gate failed and lets &ldquo;cannot assess&rdquo; average
        against &ldquo;pass&rdquo;. Two of the five results above are not verdicts at all. Summing them would turn
        an absence of evidence into a middling grade, which is the one thing this system exists to prevent.</p></div>
    </div>
    ${srcs(['dashboard/public/validate-show/run-winged-zebrafish.json → verdict', 'sim-engine/validate/SCORER-RESULTS.md'])}`;

  // ════════ 11-12 · the second server, and the round trip ════════

  SL.secondmcp = () => {
    const V = N.studioval;
    return `${ribbon(st('secondmcp'))}
      <h2>Design studio and harness, served as a second MCP server.</h2>
      <div class="split">
        <div>
          <p class="sub" style="max-width:50ch">Two servers, two jobs. The first answers questions about the law
            registry. The second takes a phenotype, returns a design, and validates it &mdash; so an agent can run
            the whole loop without a human in it.</p>
          ${V ? `<div class="rows">
            ${rrow('Rows scored by the harness', String(V.scored), 'against a pre-registration hashed before the first number was produced')}
            ${rrow('Pass', String(V.tally?.pass ?? '&mdash;'), 'the prediction matched a target taken from the literature', 'yes')}
            ${rrow('Circular', String(V.tally?.circular ?? '&mdash;'), 'the engine was asked to reproduce a number it was given. Counted, named, and never scored as a pass.', 'no')}
            ${rrow('Fail', String(V.tally?.fail ?? '&mdash;'), 'the prediction missed its target', 'no')}
            ${rrow('No target', String(V.tally?.['no-target'] ?? '&mdash;'), 'no literature value exists to check against')}
            ${rrow('Self-test', `${V.selftest?.ok ?? '&mdash;'} of ${V.selftest?.total ?? '&mdash;'}`, 'every assertion was checked to be capable of failing before it was trusted', 'yes')}
          </div>` : ''}
        </div>
        <div class="scope warn"><h4>The circular rows are the point</h4>
          <p style="margin:0">Five of the scored rows are circular: the engine reproduced a value that had been fed
          into it. A harness that counted those as passes would report a working validator. Ours labels them and
          keeps them visible on the scorecard.</p></div>
      </div>
      ${srcs(['mcp/server.mjs', 'sim-engine/validate/SCORER-RESULTS.md', 'sim-engine/contract.json'])}`;
  };

  SL.roundtrip = () => `${ribbon('anticipated')}
    <h2 style="color:var(--ghost)">The round trip.</h2>
    <div class="route" data-anim="route-intro">
      ${['phenotype', 'design', 'sequence', 'fresh session', 'design', 'phenotype?'].map((nd, i, a) =>
        `<div class="node${i === 0 ? ' start' : i === a.length - 1 ? ' end' : ''}" data-i="${i}">${esc(nd)}</div>`
        + (i < a.length - 1 ? `<div class="link" data-i="${i}"></div>` : '')).join('')}
    </div>
    <div class="split" style="margin-top:16px">
      <div class="ghostbox"><div class="gi">Not run. ${esc(needs('roundtrip'))}</div></div>
      <div class="scope"><h4>Why it is the test that matters</h4>
        <p style="margin:0">Feed the predicted sequence back into Design Studio in a session that has never seen the
        original ask, and see whether the phenotype comes back. It is the one check the system cannot pass by
        remembering, and the only one that would show the mapping is a mapping rather than a lookup.</p></div>
    </div>
    <p class="caption">Both halves exist and both are served. Nothing has been run end to end and back, so this
      slide stays grey.</p>`;

  SL.honest = () => {
    const c = N.corrections, R = N.records;
    return `${ribbon('live')}
      <h2>What we are not claiming.</h2>
      <ul class="plain">
        <li><b>No wet lab.</b> Nothing here was measured at a bench by us; no organism, protein or variant was made.</li>
        <li><b>No proof about biology.</b> Every theorem says a conclusion follows from premises. That any organism
          satisfies those premises is assumed, and a kernel proof is silent on it.</li>
        <li><b>We did not design an organism.</b> The &ldquo;designed&rdquo; fish is Daane et&nbsp;al. 2021&rsquo;s
          published double heterozygote, and our pre-registered test of it came back unsupported. The apparatus is
          ours; the animal is not.</li>
        ${c ? `<li><b>${c.total} of our own claims were corrected in one day</b> &mdash; ${c.ours} by our own checks,
          ${c.collaborator} by a collaborator&rsquo;s independent cross-check. Each was withdrawn or narrowed in
          public, never as a silent edit.</li>` : ''}
        ${NP ? `<li><b>Published, and that cuts both ways.</b> ${n0(NP.onProduction)} of our records are live on the
          public production nanopub registry (${n0(NP.darwinOnProduction)} Darwin claims, ${NP.mathBioOnProduction}
          classical math-biology theorems, ${esc(NP.approverNote)}, which stays in the manifest and is not
          reproduced here); ${n0(NP.signed)} records are signed in all.
          But ${n0(NP.withNoApprovalField)} of the ${n0(NP.onProduction)} carry no approval field at all.
          A further ${NP.unsignedThreadDrafts} thread drafts are written and deliberately unsigned, and
          ${NP.avesDraftsExcluded} Aves-holdout drafts are excluded from every count on this slide.</li>` : ''}
        <li><b>No bird data anywhere.</b> Class Aves is a frozen holdout, excluded at build time from every layer,
          figure and record in this deck.</li>
      </ul>
      <p class="caption">All of this is on the public dashboard too, next to the result it limits.</p>`;
  };

  SL.ask = () => `${ribbon('live')}
    <h2>What we want.</h2>
    <div class="rows">
      ${rrow('<b>Laws, from people who own them.</b>', '', 'Upload a theorem with its nanopub. If it holds in Lean and survives the debate, it becomes an axiom that constrains every design after it &mdash; and it keeps your name on it.')}
      ${rrow('<b>One functional assay on a non-model organism.</b>', '', 'Zero of the 73 requirements in our ledger have functional data of any kind. One real assay would move more rows than another year of sequence.')}
      ${rrow('<b>A second kernel, and a second debate.</b>', '', 'We will not let the system that wrote a proof grade it. Run the registry against your own checker and tell us where it disagrees.')}
    </div>
    <p class="sub" style="margin-top:22px">MorphoLemma &mdash; the system this repository still calls DELPHI.</p>
    <p class="tiny">delphi-mission-control.ashenoy000.workers.dev</p>`;

  // ---------------- assemble ----------------
  const order = D.slides.map(s => s.id).filter(id => SL[id]);
  $('#deck').innerHTML = order.map(id =>
    `<section class="slide" data-id="${id}" data-state="${st(id)}">${badge(id)}${SL[id]()}</section>`).join('');

  $('#dots').innerHTML = order.map((id, i) =>
    `<button data-i="${i}" class="${st(id)}" title="${esc(id)} — ${esc(st(id))}" aria-label="${esc(id)}"></button>`).join('');
  $('#meter').textContent = `${D.progress.live} evidenced · ${D.progress.partial} partial · ${D.progress.anticipated} anticipated`;
  const coreIdx = order.map((id, i) => S[id] && S[id].core ? i : -1).filter(i => i >= 0);
  $$('#dots button').forEach((b, i) => { if (coreIdx.includes(i)) b.classList.add('core'); });

  const slides = $$('.slide'), deck = $('#deck');
  const go = i => slides[Math.max(0, Math.min(slides.length - 1, i))].scrollIntoView({ behavior: 'smooth' });
  let cur = 0;
  $('#dots').onclick = e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); };
  addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
    if (e.key === 'Home') go(0); if (e.key === 'End') go(slides.length - 1);
    if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      const fwd = e.key === 'ArrowRight';
      const next = fwd ? coreIdx.find(i => i > cur) : [...coreIdx].reverse().find(i => i < cur);
      if (next !== undefined) go(next);
    }
  });

  // ---------------- animation: triggered on entry, each one showing a change in the evidence ----------------
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const seen = new WeakSet();

  // The end state, painted without motion. A slide nobody has scrolled to still has its bars at zero
  // and its hero numbers at 0, which is what a print, a PDF export or a screenshot would capture, so
  // those paths settle every slide first rather than publishing a deck full of zeros.
  const settleSlide = sl => {
    // the transition must go first: a value set while one is running is the target, not what paints
    $$('.bfill,.node,.link,.stage', sl).forEach(el => { el.style.transition = 'none'; });
    $$('.bfill', sl).forEach(el => { const w = el.dataset.w + '%'; el.style.setProperty('--w', w); el.style.width = w; });
    $$('[data-count]', sl).forEach(el => { const to = +el.dataset.count; if (isFinite(to)) el.textContent = to.toLocaleString('en-US'); });
    $$('.node,.link,.stage', sl).forEach(el => el.classList.add('in'));
    $$('.pairgrid span', sl).forEach(el => { el.style.transition = 'none'; });
  };

  const animate = sl => {
    // bars grow from zero: magnitude is the message
    $$('.bfill', sl).forEach((el, i) => {
      const w = el.dataset.w + '%'; el.style.setProperty('--w', w);
      if (reduce) { el.style.width = w; return; }
      setTimeout(() => { el.style.width = w; }, 90 + i * 85);
    });
    // count up the hero numbers
    $$('[data-count]', sl).forEach(el => {
      const to = +el.dataset.count; if (!isFinite(to)) return;
      if (reduce) { el.textContent = to.toLocaleString('en-US'); return; }
      const t0 = performance.now(), dur = 850;
      const step = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US'); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    // the route draws itself, step by step: that IS the claim
    const rt = $('[data-anim]', sl);
    if (rt && /route/.test(rt.dataset.anim)) {
      const parts = [...rt.children];
      parts.forEach((el, i) => reduce ? el.classList.add('in') : setTimeout(() => el.classList.add('in'), 120 + i * 110));
    }
    // the pipeline lights up in dependency order
    if (rt && rt.dataset.anim === 'chain') {
      $$('.stage', rt).forEach((el, i) => reduce ? el.classList.add('in') : setTimeout(() => el.classList.add('in'), 80 + i * 70));
    }
    // the collapse: their concentrated wins, then ours
    const pt = $('[data-anim="pairs-theirs"]', sl), po = $('[data-anim="pairs-ours"]', sl);
    if (pt && !reduce) {
      $$('span', pt).forEach((el, i) => { const was = el.className; el.className = ''; setTimeout(() => { el.className = was; }, 200 + i * 28); });
      if (po) $$('span', po).forEach((el, i) => { const was = el.className; el.className = ''; setTimeout(() => { el.className = was; }, 900 + i * 28); });
    }
  };

  // still mode: reduced motion, print, PDF export, or ?still=1 for screenshots
  const still = reduce || /[?&]still=1/.test(location.search);
  const settleAll = () => slides.forEach(sl => { seen.add(sl); settleSlide(sl); });
  if (still) settleAll();
  addEventListener('beforeprint', settleAll);

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    cur = slides.indexOf(e.target);
    $$('#dots button').forEach((b, i) => b.classList.toggle('on', i === cur));
    $('#prog').style.width = ((cur + 1) / slides.length * 100) + '%';
    if (!seen.has(e.target)) { seen.add(e.target); animate(e.target); }
  }), { root: deck, threshold: 0.55 });
  slides.forEach(s => io.observe(s));

  // ---------------- the caution dial on the route slide: purposeful, not decorative ----------------
  const kap = $('#kap');
  if (kap && N.route && N.kappaSweep) {
    const sweep = N.kappaSweep, r = N.route;
    const paint = () => {
      const k = sweep[+kap.value];
      const links = $$('.route[data-anim="route-break"] .link');
      const broken = k.kappa >= (r.breaksAt || Infinity);
      links.forEach((l, i) => l.classList.toggle('broken', broken && i === r.weakest));
      $('#stepnote').innerHTML = `&kappa; = ${k.kappa} &nbsp;&middot;&nbsp; ${n0(k.reachable_from_start)} variants still reachable &nbsp;&middot;&nbsp; `
        + (k.open ? `<span style="color:var(--good)">a usable route still exists</span>`
                  : `<span style="color:var(--serious)">no route this data can support</span>`)
        + (broken && k.open ? ` &nbsp;&middot;&nbsp; <span style="color:var(--serious)">step ${r.weakest + 1} no longer defensible</span>` : '');
    };
    kap.oninput = paint; paint();
  }

  // deep link: #slide-id
  const show = i => { const sl = slides[i]; if (sl && !seen.has(sl)) { seen.add(sl); animate(sl); } };
  if (location.hash) {
    const i = order.indexOf(location.hash.slice(1));
    if (i >= 0) setTimeout(() => { go(i); show(i); }, 60);
  }
  // belt and braces: whatever is resting in the viewport gets its final values, even if the
  // observer never fired (it does not, reliably, under a headless virtual clock)
  setTimeout(() => slides.forEach(sl => {
    const r = sl.getBoundingClientRect();
    if (r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.4 && !seen.has(sl)) { seen.add(sl); settleSlide(sl); }
  }), 1200);
}
})();
