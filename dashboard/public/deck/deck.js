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

  // ---------------- slide renderers: one idea, one visual, as few words as possible ----------------
  const SL = {};

  SL.title = () => `
    <div class="eyebrow">DELPHI &middot; ScienceClaw Hackathon &middot; MIT Media Lab</div>
    <h1>Which experiment would<br>justify the next step?</h1>
    <p class="sub">We turn claims about how life works into experiments a machine can check &mdash; and say plainly when the evidence is not there yet.</p>
    <div class="route" data-anim="route-intro">
      ${(N.route?.nodes || ['VFVS', '…', 'AIKG']).map((nd, i, a) =>
        `<div class="node${i === 0 ? ' start' : i === a.length - 1 ? ' end' : ''}" data-i="${i}">${esc(nd)}</div>`
        + (i < a.length - 1 ? `<div class="link" data-i="${i}"></div>` : '')).join('')}
    </div>
    <p class="caption">A real route through a real enzyme: every step measured, every step uphill, the whole thing machine-checked.</p>`;

  SL.question = () => `${ribbon(st('question'))}${rub('significance')}
    <h2>Science has a backlog.</h2>
    <div class="heroes">
      <div class="hero s1"><div class="n" data-count="${N.claims}">0</div><div class="l">claims pulled out of Darwin, Thompson, Turing, Wolfram and others</div></div>
      <div class="hero s2"><div class="n" data-count="${N.claimTests}">0</div><div class="l">of them tested against real data this weekend</div></div>
    </div>
    <p class="caption">The gap is the opportunity, not an embarrassment. Most of these claims have never had a dataset pointed at them, because nobody had a cheap way to ask which dataset would settle which claim.</p>`;

  SL.gap = () => `${ribbon(st('gap'))}${rub('impact')}
    <h2>So we built the asking machine.</h2>
    <div class="bars" style="max-width:760px">
      ${bar('Claims extracted', N.claims, N.claims, n0(N.claims), 1)}
      ${bar('Given a pre-registered test', N.claimTests, N.claims, n0(N.claimTests), 2)}
      ${bar('Machine-checked in Lean', N.leanProved || 0, N.claims, n0(N.leanProved), 3)}
    </div>
    <div class="legend"><span><i style="background:var(--series-1)"></i>extracted</span><span><i style="background:var(--series-2)"></i>tested on data</span><span><i style="background:var(--series-3)"></i>proved</span></div>
    <p class="caption">Each stage is narrower than the last, on purpose. A claim only advances when a named dataset can settle it and two independent assessors agree it can.</p>`;

  SL.pipeline = () => `${ribbon(st('pipeline'))}${rub('agency')}
    <h2>Ten specialists, one chain.</h2>
    <div class="chain" data-anim="chain">
      ${[['A1', 'say it plainly'], ['A2', 'find the sources'], ['A3', 'name the species'], ['A4', 'find the data'],
         ['A5', 'inventory'], ['A6', 'all scales?'], ['A7', 'write the maths'], ['A8', 'run the test'],
         ['A9', 'is it faithful?'], ['A10', 'publish it']].map(([k, v], i) =>
        `<div class="stage${i === 7 || i === 8 ? ' key' : ''}" data-i="${i}"><b>${k}</b>${esc(v)}</div>`).join('')}
    </div>
    <p class="caption">Two rules carry most of the weight. Nothing scores its own work, so the agent that runs a test never judges it. And every test is written down before the data is opened, so a disappointing answer stays the answer.</p>`;

  SL.route = () => {
    const r = N.route, sweep = N.kappaSweep || [];
    if (!r) return `${ribbon('anticipated')}<h2>A route, and its weakest step.</h2><div class="ghostbox"><div class="gi">Waiting on ${esc(needs('route'))}</div></div>`;
    return `${ribbon(st('route'))}${rub('impact')}
      <h2>Four changes. No usable shortcut.</h2>
      <div class="route" data-anim="route-break" data-weakest="${r.weakest}">
        ${r.nodes.map((nd, i, a) => `<div class="node${i === 0 ? ' start' : i === a.length - 1 ? ' end' : ''}" data-i="${i}">${esc(nd)}</div>`
          + (i < a.length - 1 ? `<div class="link" data-i="${i}"></div>` : '')).join('')}
      </div>
      <div class="stepnote" id="stepnote"></div>
      <label class="tiny" style="display:block;margin-top:14px">Caution dial &kappa;
        <input type="range" id="kap" min="0" max="${sweep.length - 1}" step="1" value="${Math.max(0, sweep.findIndex(k => k.kappa === N.kappaUsed))}"></label>
      <p class="caption">Going straight needs ${r.nodes.length - 1} changes; every direct ordering drops downhill somewhere, so the usable path is a ${r.nodes.length - 1}-step detour. Turn the dial up &mdash; demand a little more margin before believing a step &mdash; and at &kappa;&nbsp;${r.breaksAt} the route stops being defensible. <b>That is the product:</b> it tells you which measurement would settle it.</p>`;
  };

  SL.scoreboard = () => {
    const P = (N.policies || []).slice().sort((a, b) => b.certified - a.certified);
    if (!P.length) return `${ribbon('anticipated')}<h2>What settled it fastest.</h2><div class="ghostbox"><div class="gi">Waiting on ${esc(needs('scoreboard'))}</div></div>`;
    const mx = Math.max(...P.map(p => p.episodes));
    return `${ribbon(st('scoreboard'))}${rub('impact')}
      <h2>Asking beats guessing.</h2>
      ${realFig('cert_vs_assays.png', 'Every policy, every episode: how many reach a correct answer as experiments are spent', 'figwide')}
      <p class="caption">Same budget, same starting data, 100 runs each. The curves that climb fastest are the ones choosing experiments to <em>settle the question</em> rather than chasing the best-looking variant. Nobody issued a single false certificate. Right-censored, so an unresolved run counts against its policy instead of vanishing.</p>`;
  };

  SL.twist = () => {
    const p = N.panel;
    if (!p) return `${ribbon('anticipated')}<h2>Then we checked it ourselves.</h2><div class="ghostbox"><div class="gi">Waiting on ${esc(needs('twist'))}</div></div>`;
    const theirs = p.theirVfvsEpisodes, tot = p.theirEpisodes;
    return `${ribbon(st('twist'))}${rub('execution')}
      <h2>Then we tried to break our own best result.</h2>
      <div class="collapse">
        <div class="panelcard"><h3>Their panel</h3>
          <div class="big" style="color:var(--series-2)">${n0(p.theirLazyOnly)}</div>
          <p class="tiny">extra wins for the leading method, over ${n0(tot)} runs</p>
          <div class="pairgrid" data-anim="pairs-theirs">${Array.from({ length: 20 }, (_, i) => `<span class="${i < 17 ? 'hit' : ''}"></span>`).join('')}</div>
          <p class="tiny" style="margin-top:8px">${n0(theirs)} of ${n0(tot)} runs start from the same genotype. Nearly every extra win is that one family.</p></div>
        <div class="panelcard"><h3>Our fresh panel &mdash; ${p.pairs} pairs they never used</h3>
          <div class="big" style="color:var(--series-3)">${n0(p.separatingPairs)}</div>
          <p class="tiny">pair separating the top two methods</p>
          <div class="pairgrid" data-anim="pairs-ours">${Array.from({ length: p.pairs }, (_, i) => `<span class="${i === 0 ? 'hit' : 'same'}"></span>`).join('')}</div>
          <p class="tiny" style="margin-top:8px">On the other ${p.pairs - 1} pairs, all five methods resolve exactly the same set.</p></div>
      </div>
      <p class="caption"><b>The ranking held; the margin did not.</b> We pre-registered the panel before running it. The order came out the same, but a gap of ${n0(p.theirLazyOnly)} collapsed to ${n0(p.separatingPairs)} once the pairs were not chosen by the people being measured. The benchmark was measuring its own composition.</p>
      <p class="srcline">Our run: ${p.pairs} pairs, seed fixed and written down before the first episode. Zero false certificates. Source: evolve/panel.json</p>`;
  };


  SL.crosscheck = () => {
    const C = N.crosscheck;
    if (!C) return `${ribbon('anticipated')}<h2>Two swarms, same claims.</h2><div class="ghostbox"><div class="gi">Waiting on ${esc(needs('crosscheck'))}</div></div>`;
    const tot = C.overlapping;
    return `${ribbon(st('crosscheck'))}${rub('collective')}
      <h2>Two independent swarms. Same claims. Six of eight agree.</h2>
      <div class="heroes">
        <div class="hero s3"><div class="n" data-count="${C.agreements}">0</div><div class="l">of ${tot} claims where both swarms reached the same verdict, working separately</div></div>
        <div class="hero s2"><div class="n" data-count="${C.disagreements}">0</div><div class="l">where they differ &mdash; and both differences are methodological, not factual</div></div>
        <div class="hero"><div class="n" style="font-size:clamp(1.6rem,3.5vw,2.6rem)">${n0(C.theirTests)} + ${n0(C.ourTests)}</div><div class="l">claim tests across the two swarms</div></div>
      </div>
      <table class="mini" style="margin-top:18px;max-width:900px">
        <tr><th>claim</th><th>our verdict</th><th>their verdict</th><th>why they differ</th></tr>
        ${C.differing.map(d => `<tr><td>${esc(d.claim.split('/').pop())}</td>
          <td><b>${esc(d.ours)}</b></td><td><b>${esc(d.theirs)}</b></td>
          <td>${d.kind === 'same-data-different-analysis'
            ? `same dataset and same method, different pre-registered age range &mdash; ${d.ourValue ? (+d.ourValue).toFixed(2) : '?'} for ages 2&ndash;19 against ${d.theirValue ? (+d.theirValue).toFixed(2) : '?'} once infants are pooled in`
            : 'different operationalisation of the same sentence'}</td></tr>`).join('')}
      </table>
      <p class="caption">Nobody coordinated these. One swarm ran on Cursor, one here, and the overlap was accidental. <b>Then we chased the disagreements down.</b> On Thompson's cube law the two swarms <em>reproduce each other exactly</em> once the age range matches: their own 2&ndash;20 year window gives 2.74, ours gives 2.76. The whole gap is infants, who scale near 2.1 and drag the pooled exponent to 2.41. So the verdict turns on one pre-registered choice &mdash; is infancy inside &ldquo;during growth&rdquo;? &mdash; not on anyone's method. Neither number is 3.</p>
      <p class="srcline">Computed by dashboard/crosscheck.mjs from git, comparing HEAD against the collaborator branch at ${esc((C.theirsDate || '').slice(0, 10))}. No file was merged to make the comparison.</p>`;
  };

  SL.swarm = () => {
    const A = N.swarmArms || [];
    if (!A.length) return `${ribbon('anticipated')}<h2>Does a group beat one agent?</h2><div class="ghostbox"><div class="gi">Waiting on ${esc(needs('swarm'))}</div></div>`;
    return `${ribbon(st('swarm'))}${rub('collective')}
      <h2>A group beats one agent &mdash; when attention is the bottleneck.</h2>
      <div class="bars grouped" style="max-width:860px">
        ${A.map(a => `<div class="brow"><span class="blab">${esc(ARM[a.key] || a.key)}</span>
          <span class="pair">
            <span class="btrack" style="height:12px"><i class="bfill" data-w="${a.exp1 / 20 * 100}" style="background:var(--series-1)"></i></span>
            <span class="btrack" style="height:12px"><i class="bfill" data-w="${a.exp2 / 20 * 100}" style="background:var(--series-4)"></i></span>
          </span>
          <span class="bval">${a.exp1}&thinsp;&middot;&thinsp;${a.exp2}<span class="tiny"> /20</span></span></div>`).join('')}
      </div>
      <div class="legend"><span><i style="background:var(--series-1)"></i>run 1, from memory</span><span><i style="background:var(--series-4)"></i>run 2, must fetch the page</span></div>
      <div class="figrow" style="margin-top:14px">${realFig('swarm_exp1.svg', 'Run 1')}${realFig('swarm_exp2.svg', 'Run 2, every dataset fetched and checked')}</div>
      <p class="caption">Two pre-registered runs, same model and budget. The single agent lost mostly by running out of room to think and leaving answers blank, not by reasoning worse. <b>The same contest on the enzyme benchmark found no advantage at all</b> &mdash; there the members are deterministic code, so sharing adds nothing. Collaboration pays when the limit is attention.</p>`;
  };

  SL.proof = () => {
    const p = N.proofs;
    if (!p) return `${ribbon('anticipated')}<h2>What a machine checked.</h2><div class="ghostbox"><div class="gi">Waiting on ${esc(needs('proof'))}</div></div>`;
    return `${ribbon(st('proof'))}${rub('execution')}
      <h2>We broke the proofs on purpose.</h2>
      <div class="heroes">
        <div class="hero s3"><div class="n" data-count="${p.rejected}">0</div><div class="l">of ${p.mutations} deliberate breakages correctly rejected</div></div>
        <div class="hero"><div class="n">${p.buildExit === 0 ? 'clean' : 'exit ' + p.buildExit}</div><div class="l">rebuild from source, on our own copy</div></div>
        <div class="hero"><div class="n">${N.leanProved ?? '—'}</div><div class="l">of our own laws machine-checked, zero gaps</div></div>
      </div>
      <p class="caption">Reversing an inequality, weakening a wall, deleting a check, moving one measured number &mdash; each must stop the proof compiling, and each did. ${p.generic ? 'The theorems are general, not arithmetic about fixed constants.' : ''} ${N.leanAssessors ? 'Our own proofs were then judged blind by a different company’s model, because the one that wrote them cannot grade them.' : ''}</p>
      ${p.discrepancy ? `<div class="flag"><b>Found by checking, not by trusting:</b> one receipt in the partner project credits a proof module that does not exist in the repository. The proofs themselves are sound; the paperwork about them overstated the coverage. We are showing this rather than dropping it.</div>` : ''}`;
  };

  SL.nulls = () => `${ribbon(st('nulls'))}${rub('execution')}
    <h2>Two things that did not work.</h2>
    <div class="heroes">
      <div class="hero"><div class="n" style="color:var(--ghost)">0</div><div class="l">benefit from a protein language model, across ${N.gpu?.sizes || 5} sizes and ${n0(N.gpu?.variants)} variants on an H100</div></div>
      <div class="hero"><div class="n" style="color:var(--ghost)">0</div><div class="l">saving from reusing a claim, over an ordinary cache, within one context</div></div>
    </div>
    ${realFig('ablation.png', 'Remove the learned model and the curves do not move', 'figwide')}
    <p class="caption">A deliberately shuffled model scored as well as the real one. We lead with this because a null you can reproduce is worth more than a result you cannot &mdash; and because most teams will not show you theirs.</p>`;

  SL.wing = () => `${ribbon('anticipated')}
    <h2>Where this goes next.</h2>
    <p class="sub">The same question at the scale of a whole organism: which genes make a flying fish wing a wing?</p>
    <div class="collapse">
      <div><div class="ghostbox"><div class="gi"><b>Printed flying-fish pectoral fin</b><br>no specimen, no scan, no print exists</div></div>
        <p class="tiny" style="margin-top:8px">Anticipated: a 3D print from a CT scan, with the load-bearing rays measured.</p></div>
      <div><div class="ghostbox"><div class="gi"><b>Fruit-fly wing, scaled to match</b><br>no matched control exists</div></div>
        <p class="tiny" style="margin-top:8px">Anticipated: the same shape at the same span, to separate scale from structure.</p></div>
      <div><div class="ghostbox"><div class="gi"><b>Which genes move which feature</b><br>no measurement, no model</div></div>
        <p class="tiny" style="margin-top:8px">Anticipated: gene to structure to flight performance, each link evidenced or refused.</p></div>
    </div>
    <p class="caption">This slide stays grey until there is something real behind it. An insect wing and a fish fin solve the same problem with unrelated parts, which makes the comparison worth running &mdash; and makes a pretty rendering easy to mistake for a result. ${esc(needs('wing'))}.</p>`;

  SL.scales = () => `${ribbon('partial')}
    <h2>The honest state of the ladder.</h2>
    <div class="chain" data-anim="chain">
      ${[['molecule', 'live'], ['tissue', 'partial'], ['organ', 'partial'], ['whole organism', 'partial'], ['population', 'live']]
        .map(([k, s], i) => `<div class="stage${s === 'live' ? ' key' : ''}" data-i="${i}"><b>${s === 'live' ? 'evidenced' : 'thin'}</b>${esc(k)}</div>`).join('')}
    </div>
    <p class="caption">We can go from a sequence to a measured growth rate, and from a claim to a population-level test. The middle of the ladder is where the data thins out, and we are not going to pretend otherwise: the species with a complete record at every scale is a short list, and we publish its length rather than loosening the definition. ${esc(needs('scales'))}.</p>`;


  SL.records = () => {
    const R = N.records;
    if (!R || !R.drafts) return `${ribbon('anticipated')}<h2>Findings, made citable.</h2><div class="ghostbox"><div class="gi">No records drafted yet</div></div>`;
    const mx = Math.max(...R.sets.map(x => x.drafts));
    const names = { lean: 'Proofs and their assessments', organism: 'Blueprints, predictions, a refusal', swarm: 'The swarm experiments', claims: 'Claim tests, including refutations' };
    return `${ribbon(st('records'))}
      ${rub('reuse')}<h2>Every finding, made citable.</h2>
      <div class="bars" style="max-width:800px">
        ${R.sets.map((x, i) => bar(names[x.thread] || x.thread, x.drafts, mx, String(x.drafts), [3, 1, 4, 2][i % 4])).join('')}
      </div>
      <div class="heroes" style="margin-top:22px">
        <div class="hero s3"><div class="n" data-count="${R.drafts}">0</div><div class="l">records drafted and validated, one finding each, with its evidence attached</div></div>
        <div class="hero"><div class="n" style="color:var(--ghost)">${R.signed}</div><div class="l">signed &mdash; publishing is irreversible and waits on the key owner</div></div>
      </div>
      <p class="caption">A record is not a summary. Each one carries the claim in one sentence, its status including <em>refuted</em> and <em>inconclusive</em>, the dataset with its identifier, the commit proving the test was written before the data was opened, and what it does not establish. Refutations are published too; publishing only successes builds a victory log.</p>
      <div class="flag">While drafting these we found that the published record templates still use a retired vocabulary, so declaring one would have asserted something false about how every record was made. We dropped the declaration, measured the problem across five templates, and are reporting it upstream &mdash; including that it affects ${R.priorProduction ? R.priorProduction.records : 'existing'} records published before this weekend.</div>`;
  };

  SL.honest = () => `${ribbon('live')}
    <h2>What we are not claiming.</h2>
    <ul class="plain">
      <li><b>No wet lab.</b> Nothing here was measured at a bench by us; no new organism, protein or variant was made.</li>
      <li><b>No proof about biology.</b> The machine checked the reasoning from measurements to a safe route. That the measurements bracket the truth is <em>assumed</em>, and two replicates cannot justify it across ${n0(N.enzymeMeasured)} variants.</li>
      <li><b>"Blocked" is not "impossible."</b> It means unreachable in the measured four-position graph, never in biology.</li>
      <li><b>The publications are unsigned drafts.</b> Valid, unpublished, and described as drafts.</li>
      <li><b>${N.recount ? `${N.recount.confirmed} of ${N.recount.total}` : 'Most'} outside numbers reproduced exactly</b>; the one we could not check, we said so rather than fill in.</li>
    </ul>
    <p class="caption">Every one of these is on the public dashboard too, next to the result it limits.</p>`;

  SL.ask = () => `${ribbon('live')}
    <h2>What we want.</h2>
    <ul class="plain">
      <li><b>One historical campaign from one lab.</b> Give us a finished enzyme-engineering campaign and we will replay it at matched budget and show, in assays and days, where the decision could have been reached sooner.</li>
      <li><b>A second assessor, from a different company.</b> One is not enough for a verdict to travel with a publication, and we will not let the model that wrote a proof grade it.</li>
      <li><b>A harder panel.</b> Our own check showed a benchmark can measure its own composition. Send pairs we did not pick.</li>
    </ul>
    <p class="caption">Live dashboard, every number traceable to a file: <b>delphi-mission-control.ashenoy000.workers.dev/start/</b></p>`;

  // ---------------- assemble ----------------
  const order = D.slides.map(s => s.id).filter(id => SL[id]);
  $('#deck').innerHTML = order.map(id =>
    `<section class="slide" data-id="${id}" data-state="${st(id)}">${SL[id]()}</section>`).join('');

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
  if (location.hash) { const i = order.indexOf(location.hash.slice(1)); if (i >= 0) setTimeout(() => go(i), 60); }
}
})();
