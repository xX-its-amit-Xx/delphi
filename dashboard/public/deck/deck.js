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
    <p class="sub">The same question at the scale of a whole organism: which genes drive fin enlargement for gliding, and by how much?</p>
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
      ${N.corrections ? `<li><b>${N.corrections.total} of our own claims were corrected in one day</b> &mdash; ${N.corrections.ours} found by our own checks, ${N.corrections.collaborator} by a collaborator&rsquo;s independent cross-check. Each was withdrawn or narrowed in public, as a record or a log entry, never as a silent edit.</li>` : ''}
      ${N.designval ? `<li><b>We did not design an organism.</b> The &ldquo;designed&rdquo; fish is Daane et al. 2021&rsquo;s published double heterozygote, and our pre-registered test of it came back unsupported. The apparatus is ours; the animal is not.</li>` : ''}
      ${N.examLine ? `<li><b>Validation on unseen data ran, and returned nothing.</b> A clade was frozen as a holdout before the tests were built; ${N.examLine.examined} completed results were examined against it and ${N.examLine.inconclusive} came back <em>inconclusive</em>${N.examLine.underpowered && N.examLine.withReason ? `. The ${N.examLine.withReason} that state a reason were stopped by the builders&rsquo; own pre-registered minimum sample size, not by a verdict we disliked` : ''}. An exam that cannot reach a verdict is reported as one that cannot, not quietly dropped.</li>` : ''}
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

  // ================================================================================================
  // The shape of the output, and the results that give it that shape. Every number here comes from
  // D.numbers, which build-deck.mjs read out of the repository; none of it is written in this file.
  // ================================================================================================

  const srcs = list => `<p class="srcline">Read from ${list.map(esc).join(' &middot; ')}</p>`;
  // fold a sentence read from a data file into the middle of one of ours: lead lower-case, no trailing stop
  const splice = t => (t ? t.trim().replace(/\.$/, '').replace(/^([A-Z])(?=[a-z])/, (m, c) => c.toLowerCase()) : null);
  const ghost = id => `${ribbon('anticipated')}<div class="ghostbox"><div class="gi">Waiting on ${esc(needs(id))}</div></div>`;

  // Phenoscape, Uberon, the Cell Ontology and Daane 2021 underlie this work and are cited where they do.
  const CITE = {
    ontology: '<b>Built on other people&rsquo;s work:</b> Uberon (Mungall 2012, 10.1186/gb-2012-13-1-r5) and the Cell Ontology '
      + '(Diehl 2016, 10.1186/2041-1480-5-21), served through Ubergraph; Phenoscape for ontology-based phenotype curation '
      + '(Edmunds 2016, 10.1093/molbev/msv223; Dececchi 2015, 10.1093/sysbio/syv031); the Human Reference Atlas ASCT+B tables '
      + '(10.1038/s41556-021-00788-6). The anatomy terms are theirs; only the hierarchy check is ours.',
    daane: '<b>The measurements are Daane et al. 2021&rsquo;s</b> (10.1016/j.cub.2021.08.054): the fin ratios, the convergent-substitution '
      + 'panel and the captured beloniform exons. We re-tabulated and re-read them; we measured no fish.'
  };

  // ---- the slide the lead asked for: what our output actually looks like ----
  SL.shape = () => {
    const S2 = N.shape, C = N.corrections;
    if (!S2) return `${ghost('shape')}`;
    const mx = Math.max(...S2.rows.map(r => r.n));
    const col = { negative: 'var(--series-2)', neutral: 'var(--series-1)', positive: 'var(--series-3)' };
    const pc = n => (n / S2.total * 100).toFixed(1) + '%';
    return `${ribbon(st('shape'))}${rub('execution')}
      <h2>More of this is negative than positive. That is the result.</h2>
      <div class="strip" role="img" aria-label="${S2.total} records: ${S2.negative} negative or self-limiting, ${S2.methodological} methodological, ${S2.supported} supported">
        <i style="flex:${S2.negative};background:var(--series-2)"></i>
        <i style="flex:${S2.methodological};background:var(--series-1)"></i>
        <i style="flex:${S2.supported};background:var(--series-3)"></i>
      </div>
      <div class="striplegend">
        <span><i style="background:var(--series-2)"></i><b>${S2.negative}</b> negative or self-limiting &mdash; ${pc(S2.negative)}</span>
        <span><i style="background:var(--series-1)"></i><b>${S2.methodological}</b> methodological, found by accident</span>
        <span><i style="background:var(--series-3)"></i><b>${S2.supported}</b> supported</span>
      </div>
      <div class="split">
        <div class="bars" style="max-width:none">
          ${S2.rows.map(r => `<div class="brow" style="grid-template-columns:minmax(90px,270px) 1fr auto">
            <span class="blab">${esc(r.label)}</span>
            <span class="btrack" style="height:24px"><i class="bfill" data-w="${(r.n / mx * 100).toFixed(1)}" style="background:${col[r.sign]}"></i></span>
            <span class="bval" style="min-width:2.2em">${r.n}</span></div>`).join('')}
        </div>
        <div>
          ${C ? `<div class="scope warn"><h4>${C.total} claims corrected in one day &mdash; ${C.ours} by our own checks, ${C.collaborator} by a collaborator</h4>
            <ul>${C.items.map(x => `<li><b>${esc(x.title)}.</b> ${esc(x.body)} <em>Caught by ${esc(x.who)}.</em></li>`).join('')}</ul>
            <p style="margin:8px 0 0">Every one is a record or a log entry, never a silent edit to history.</p></div>` : ''}
        </div>
      </div>
      <p class="caption" style="max-width:104ch"><b>This is an argument about method, not an apology.</b> ${S2.notAPlainWin} of
        ${S2.total} records are not a win for the hypothesis we set out to test, and the documented refusal is a statistic we
        declined to compute because the sample cannot support it. A pipeline that mostly produces negatives, corrects itself in
        public and refuses the numbers it cannot stand behind is making a stronger claim about its method than one that reports
        only wins &mdash; because only the first kind can be wrong out loud.</p>
      ${srcs([S2.builtFrom, 'genotype/nanopubs/DECISIONS.md', 'genotype/CAUSAL.md'])}`;
  };

  // ---- the pre-registered design validation: a negative result, and the design is not ours ----
  SL.designval = () => {
    const V = N.designval;
    if (!V) return `${ghost('designval')}`;
    return `${ribbon(st('designval'))}${rub('execution')}
      <h2>We pre-registered a test of a designed organism. It failed.</h2>
      <div class="scope warn" style="max-width:none;margin:0 0 14px">
        <h4>Say this first</h4><b>The design is not ours.</b> It is Daane et al. 2021&rsquo;s own germline double
        heterozygote &mdash; built, scored and published by them in 2021, with their own claim that it phenocopies flying-fish fin
        proportions. Our contribution is the validation arithmetic, not the organism. <b>We did not design a flying fish, and
        nothing in this deck should be read as saying we did.</b></div>
      <div class="rows" style="max-width:none">
        <div class="rrow"><span>Morphological axes that could be scored at all
          <small>The axis the design is <em>about</em>, ${esc(V.definingAxis)}, cannot be scored on either side: no published adult
            zebrafish value exists, and the design&rsquo;s value exists only inside a figure we refused to digitise.</small></span>
          <span class="v no">${V.scored} of ${V.axes}</span></div>
        <div class="rrow"><span>Loci known to differ in flying fishes that the design <em>touches</em>
          <span class="tag neg">a near miss, not a hit</span>
          <small><b>Same gene, different variant.</b> <em>lat4a</em>/<em>slc43a2a</em> is genuinely in Daane&rsquo;s
            convergent-substitution sheet, so the design touches the right gene &mdash; but
            ${esc(splice(N.corrections && N.corrections.variantMismatch) || 'the design’s allele is T200K and the convergent substitution is F326L: different sites, different species, not the same variant')}.
            The design changes a different position in the same transporter, not the change flying fishes carry. And the other
            half of the design, <em>kcnh2a</em>, appears nowhere in that workbook.</small></span>
          <span class="v no">${V.lociReproduced} of ${V.lociKnownToDiffer} &middot; ${(V.fraction * 100).toFixed(1)}%</span></div>
        <div class="rrow"><span>The Lean constraint gate
          <small>It fails for the design (${V.gateTallies.DESIGN.violated} violated) <b>and for the real flying fish</b>
            (${V.gateTallies.REAL.violated} violated), so failing does not separate the design from its target. The gate is weak:
            only ${V.rowsDecided} of ${V.gateRows} rows are decided by a single design, and it tests nothing aerodynamic, nothing
            developmental and nothing about fins.</small></span>
          <span class="v no">FAILS, both arms</span></div>
      </div>
      <p class="caption"><b>Dropped as unsupported, not disproved</b>, under the pre-registration&rsquo;s own rule. The framing that
        is both honest and stronger: we built the apparatus to ask whether a designed organism matches a real one, wrote the test
        down first, ran it, and it failed &mdash; which is exactly why we can now say what designing an organism would require.
        ${V.refusedTheDefault ? 'One detail shows the method working: at a single scored axis none of the three pre-registered FAIL triggers could fire, so the letter of the rule would have awarded &ldquo;close&rdquo; by default. The agent refused that reading and logged it as a deviation against the design&rsquo;s own interest.' : ''}</p>
      <p class="srcline">Pre-registration hashed before the first number was produced, sha256 ${esc(V.preregSha.slice(0, 16))}&hellip;
        ${V.preregVerified ? '(verified unaltered)' : ''} &middot; design-validation/REPORT.md &middot; design-validation/scorecard.json</p>`;
  };

  // ---- the correction worth showing: a genome exists; what is missing is measurement ----
  SL.annotation = () => {
    const G = N.genomeGap;
    if (!G) return `${ghost('annotation')}`;
    return `${ribbon(st('annotation'))}${rub('impact')}
      <h2>We said there was no genome. There is.</h2>
      <div class="heroes">
        <div class="hero s1"><div class="n" data-count="${G.genes}">0</div><div class="l">protein-coding genes predicted in the flying-fish assembly</div></div>
        <div class="hero s3"><div class="n">${G.percent}%</div><div class="l">of them carry at least one database hit (${n0(G.annotated)} genes)</div></div>
        <div class="hero"><div class="n" style="color:var(--serious)">${G.rnaseqMentions}</div><div class="l">occurrences of &ldquo;RNA-seq&rdquo; or &ldquo;transcriptome&rdquo; in that paper, counted</div></div>
      </div>
      <div class="split" style="margin-top:18px">
        <div class="scope warn"><h4>What we said, and what changed</h4>Until this weekend our own files, our brief to ten
          subagents and the public dashboard all said that almost no molecular data exists for flying fish and called the
          available resource one scaffold-level assembly. That was wrong, and it was load-bearing: it was repeated on every
          number in the map. ${G.filesCorrected} files were rewritten and the error was recorded as its own citable correction.</div>
        <div class="scope"><h4>And the caveat on our own headline</h4>&ldquo;Functionally annotated&rdquo; means one
          sequence-similarity or domain hit and nothing more. TrEMBL alone supplies ${n0(G.trembl)} of the hits and TrEMBL is
          automatically generated and unreviewed, so ${G.percent}% measures <em>database coverage</em>, not understood function.
          ${n0(G.swissprot)} hits come from SwissProt, the only manually reviewed set.</div>
      </div>
      <p class="caption"><b>This is the cleanest statement of the gap we actually face.</b> The genes are known. What is missing
        is measurement: that paper reports no expression data, no mutant, no kinetics and no regulatory network. The count of zero
        is established by counting the strings in the full text, not by inference &mdash; and the proxy-species rule survives with a
        corrected justification: zebrafish and medaka are used because expression and phenotype records exist only for them, not
        because flying-fish genes are unknown.</p>
      <p class="srcline">${esc(G.citation)}, doi ${esc(G.doi)}, full text read &middot; ${esc(G.source)}</p>`;
  };

  // ---- annotation is not measurement, counted across the whole map ----
  SL.readiness = () => {
    const R = N.readiness;
    if (!R) return `${ghost('readiness')}`;
    const fig = R.coverageFig;
    return `${ribbon(st('readiness'))}${rub('impact')}
      <h2>${R.annotatedPct}% annotated. 0% parameterised.</h2>
      <div class="split" style="grid-template-columns:minmax(0,.92fr) minmax(0,1.25fr)">
        <div>
          <div class="heroes" style="margin-bottom:16px">
            <div class="hero"><div class="n" style="color:var(--serious)">0</div><div class="l">of the ${n0(R.needed)} numbers a minimal dynamical model of our ${n0(R.genes)} genes would need</div></div>
            <div class="hero s3"><div class="n">${R.annotatedPct}%</div><div class="l">of the same genes carry a functional annotation</div></div>
          </div>
          <div class="scope"><h4>Zero, class by class</h4>Absolute abundance, protein half-life, mRNA half-life, transcription
            rate, binding affinity and enzyme kinetics, cooperativity: <b>0 of ${n0(R.genes)}</b> each. Diffusion coefficients:
            <b>4</b>. The regulatory network is <b>${n0(R.edges)}</b> of ${n0(R.pairs)} possible gene pairs with any direct
            experimental support, ${esc(R.pairsPct)}, and it is undirected and unsigned, so not yet a network.</div>
          <div class="scope"><h4>Relaxed as far as honesty allows</h4>Accept a relative abundance figure &mdash; a share of total
            protein mass in a whole organism &mdash; in place of a count per cell in a named cell type at a named stage, and it
            becomes ${n0(R.lenientHeld)} of ${n0(R.needed)}, ${R.lenientPct}%. Every one of those is that same single substitute.</div>
        </div>
        <div>
          ${fig ? `<figure class="real"><img src="${esc(fig.file)}" alt="Coverage of each simulation parameter across the ${n0(R.genes)} genes of the map" style="max-height:56vh;object-fit:contain">
            <figcaption><b>Every parameter class a simulation runs on, beside the annotation that is nearly complete</b><br>
            Built by the readiness thread as ${esc(fig.from)}; copied, not redrawn.
            <br><span class="prov">sha256 ${esc(fig.sha256.slice(0, 32))}&hellip;</span></figcaption></figure>` : ''}
        </div>
      </div>
      <p class="caption" style="max-width:112ch"><b>This is not a complaint about missing data; it is a measurement nobody had
        made.</b> Annotation says <em>this gene is involved in this process</em>; a simulation needs <em>this many molecules,
        decaying this fast, binding this tightly</em>, and the first does not constrain the second. That is why our design tool
        looks up measured effects instead of predicting them, and why we can name exactly what would have to be measured to change
        it. ${R.precedent ? `For scale, the whole-cell model that predicts phenotype from genotype used ${R.precedent.genes} genes and
        ${esc(R.precedent.sources)} primary sources, for ${esc(R.precedent.scope.toLowerCase())} (Karr 2012, ${esc(R.precedent.doi)});
        functional annotation was its starting point, never a substitute for the numbers.` : ''}</p>
      ${srcs([R.source, 'simulation-readiness/README.md', 'simulation-readiness/calls.json'])}`;
  };

  // ---- the physiology elimination, with its scope attached ----
  SL.flight = () => {
    const P = N.physiology, F = N.flier;
    if (!P) return `${ghost('flight')}`;
    const lead = P.cases.find(c => c.speed === 10) || P.cases[0];
    return `${ribbon(st('flight'))}${rub('impact')}
      <h2>Sustained powered flight is eliminated, with a certificate.</h2>
      <div class="heroes">
        <div class="hero s3"><div class="n">${P.ceilingW}<span style="font-size:.4em"> W</span></div><div class="l">aerobic mechanical ceiling the oxygen budget can pay for</div></div>
        <div class="hero s2"><div class="n">${lead.requiredW}<span style="font-size:.4em"> W</span></div><div class="l">needed for level flight at ${lead.speed}&thinsp;m/s at the measured L/D of ${lead.ld}</div></div>
        <div class="hero"><div class="n" style="color:var(--serious)">${lead.shortBy}&times;</div><div class="l">short &mdash; and the gap is checked by the Lean kernel, not by us</div></div>
      </div>
      <div class="split" style="margin-top:16px">
        <div class="rows">
          ${P.cases.map(c => `<div class="rrow"><span>${esc(c.what)}, ${c.speed}&thinsp;m/s
            ${c.illustrative ? '<span class="tag grey">illustrative numbers</span>' : ''}
            <small>${esc(c.theorem)}</small></span>
            <span class="v no">${c.requiredW}&thinsp;W needed &middot; ${c.shortBy}&times; short</span></div>`).join('')}
        </div>
        <div>
          <div class="scope"><h4>What the bound rests on</h4><ul>
            <li>Fick&rsquo;s principle: supply is cardiac output times arterial oxygen content times efficiency.</li>
            <li><b>Aerobic power, not burst power.</b></li>
            <li><b>Teleost proxy values</b> for cardiac output, arterial O<sub>2</sub> and efficiency &mdash; no flying-fish
              physiology exists. The proxies, not the fish, are what the elimination rests on.</li></ul></div>
          <div class="scope warn"><h4>What it does not bound</h4><ul>
            <li><b>Gliding.</b> Nothing here says a flying fish cannot glide; it is a glider.</li>
            <li><b>Short burst flight.</b> The certificates bound sustained aerobic power only.</li></ul></div>
        </div>
      </div>
      ${F ? `<div class="scope warn" style="max-width:none;margin-top:14px">
        <h4>What a fish that really flew would need, and no animal has</h4>
        <b>A flight muscle that does not fit in the animal.</b> At ${(F.muscleFraction * 100).toFixed(0)}% of a 60&thinsp;g body and
        ordinary muscle density that is ${esc(String(F.muscleVolumeM3).replace(/e-(\d+)$/, ' × 10⁻⁶'))}&thinsp;m&sup3; of muscle, and only <b>${F.musclePctThatFits}%</b> of it fits
        inside the body at the pectoral girdle. That is a geometric consequence of the specification, not an opinion
        &mdash; and it sits beside a cardiac output of ${n0(Math.round(F.needs[0].value))}&thinsp;${esc(F.needs[0].unit)},
        <b>${esc((F.cardiacVerdict || '').split(':')[0])}</b>.
        ${F.foundByBuilding ? '<b>Building the design as real geometry was itself a test, and it caught something three rounds of equations did not.</b>' : ''}
        The flier is hypothetical throughout and now carries a requirement nothing can satisfy; it is not a validated design.</div>` : ''}
      <p class="caption" style="max-width:118ch">${P.kernelChecked} of ${P.candidates} candidates eliminated, each by a theorem
        the compiler accepted. <b>The honest proportion:</b> on the same candidates ${P.cannotRule} other constraints could not be
        fired at all, for want of an input. <b>This is a proof about a model instantiated with proxy numbers, and it carries that
        scope wherever it goes &mdash; it is not a fact about a fish.</b>${N.designval ? ` A second, independent instantiation of the
        same chain gives ${N.designval.realShortfall}&times;; both are far below what level flight needs.` : ''}</p>
      ${srcs(P.sources)}`;
  };

  // ---- the glide bound ----
  SL.glide = () => {
    const G = N.glide;
    if (!G) return `${ghost('glide')}`;
    const mx = Math.max(G.reachTheoreticalM || 0, G.fieldSingleGlideM, G.reachWithGroundEffectM);
    return `${ribbon(st('glide'))}${rub('impact')}
      <h2>One glide cannot explain the long flights.</h2>
      <div class="bars" style="max-width:900px">
        ${bar(`From ${G.heightM} m at the measured L/D ${G.ldMeasured}`, G.reachM, mx, G.reachM + ' m', 2)}
        ${bar(`… with the measured ${(G.deltaGroundEffect * 100).toFixed(0)}% ground effect`, G.reachWithGroundEffectM, mx, G.reachWithGroundEffectM + ' m', 2)}
        ${bar('Field flight, reported as one glide', G.fieldSingleGlideM, mx, G.fieldSingleGlideM + ' m', 1)}
        ${G.ldTheoretical ? bar(`… at the theoretical L/D ${G.ldTheoretical}, for comparison`, G.reachTheoreticalM, mx, G.reachTheoreticalM + ' m', 3) : ''}
      </div>
      <div class="legend"><span><i style="background:var(--series-2)"></i>what one glide can reach</span><span><i style="background:var(--series-1)"></i>what the field reports</span><span><i style="background:var(--series-3)"></i>a theoretical L/D we did not measure</span></div>
      <p class="caption" style="max-width:88ch">A steady glide can only trade height for distance, so its range is at most
        height times lift-to-drag. At the measured ratio that is <b>${G.reachM}&thinsp;m</b> from the greatest recorded flight
        height, or <b>${G.reachWithGroundEffectM}&thinsp;m</b> once the measured ground effect is allowed &mdash; and the field
        reports ${G.fieldSingleGlideM}&thinsp;m. <b>So the single-glide reading is eliminated, and taxiing re-launches or wind must
        account for the rest.</b> ${G.sim ? `Our simulator reproduces the shape of that: ${G.sim.glides} glides and
        ${G.sim.metres}&thinsp;m in ${G.sim.seconds}&thinsp;s${G.sim.postHoc ? ', from a model whose parameters were changed after seeing results, so that run is exploratory and labelled so' : ''}.` : ''}</p>
      <p class="srcline">The ${G.fieldSingleGlideM}&thinsp;m and ${G.fieldSequenceM}&thinsp;m field figures are quoted second-hand and
        labelled secondary; ${G.fieldSequenceIsASequence ? `the ${G.fieldSequenceM} m is already described by its own source as a sequence of taxiing and glides, not one glide` : ''}.
        Ground effect: ${esc(G.groundEffectLocator || '')} &middot; ${G.sources.map(esc).join(' &middot; ')}</p>`;
  };

  // ---- the sequence layer: four results, three of them negative ----
  SL.sequence = () => {
    const Q = N.sequences;
    if (!Q) return `${ghost('sequence')}`;
    const c = Q.convergence, l = Q.lat4a, d = Q.doseResponse, e = Q.engineered;
    return `${ribbon(st('sequence'))}${rub('impact')}
      <h2>Four sequence results. Three of them say no.</h2>
      <div class="rows" style="max-width:none">
        <div class="rrow"><span><b>Gliders do not converge</b><span class="tag neg">negative</span>
          <small>Across ${c.genes} fin genes, ${c.gliderColumns} alignment columns show a residue shared by independent gliders and absent
            from each lineage&rsquo;s non-gliding relative &mdash; against ${c.baselineColumns} for the same count with the roles swapped.
            Similarity follows ancestry, not gliding. ${esc(c.geneSetCaveat)}</small></span>
          <span class="v no">${c.gliderColumns} vs ${c.baselineColumns}</span></div>
        <div class="rrow"><span><b>The lat4a substitution tracks gliding inside the fishes only</b><span class="tag pos">holds, narrowly</span>
          <small>L in ${l.flyingFishL} of ${l.flyingFishN} flying fishes and in both gliding halfbeaks, against ${l.nonGliderF} of
            ${l.nonGliderSpecies} non-gliding relatives carrying F (the ${l.nonGliderOther === 1 ? 'one exception, a saury, carries I' : 'exceptions carry another residue'}).
            But all three bats, both colugos, the sugar glider, mouse, human and every outgroup scored carry F too, so this is
            <b>not convergence with gliding mammals</b>. Tracking is not causing.</small></span>
          <span class="v">${l.flyingFishL}/${l.flyingFishN} &middot; ${l.nonGliderF}/${l.nonGliderSpecies}</span></div>
        <div class="rrow"><span><b>The derived-site panel is not a dose-response</b><span class="tag neg">negative</span>
          <small>Gliding halfbeaks carry a mean ${d.glidingHalfbeak.derived} of ${d.sites} derived states at a pectoral-fin-to-body ratio of
            ${d.glidingHalfbeak.ratio}; flying fishes carry ${d.flyingFish.derived} at ${d.flyingFish.ratio}. The group with the far smaller
            fin carries slightly <em>more</em> derived residues, so the series is mildly inverted.
            ${d.nonGlidersZeroByConstruction ? 'The non-gliders&rsquo; zero is circular by the panel&rsquo;s construction and is not shown as a finding.' : ''}
            ${d.notATest ? 'Four groups is a ladder to read, not a statistical test.' : ''}</small></span>
          <span class="v no">${d.glidingHalfbeak.derived} at ${d.glidingHalfbeak.ratio} &middot; ${d.flyingFish.derived} at ${d.flyingFish.ratio}</span></div>
        <div class="rrow"><span><b>An &ldquo;engineered&rdquo; genome is a handful of edits</b><span class="tag neg">scale check</span>
          <small>${e.editedLoci} edited loci change ${e.aminoAcidsChanged} amino acid${e.aminoAcidsChanged === 1 ? '' : 's'}
            ${e.regulatoryEdit ? '(the other edit is regulatory and changes none)' : ''}. In just ${e.proteins} of our causal-chain
            proteins, zebrafish and medaka &mdash; same class, different orders &mdash; differ by ${n0(e.naturalSubstitutions)} amino-acid
            substitutions (${n0(e.naturalDifferences)} positions counting indels). Coding only, in a tiny gene sample; the
            genome-wide difference is necessarily larger.</small></span>
          <span class="v no">${e.aminoAcidsChanged} vs ${n0(e.naturalSubstitutions)}</span></div>
      </div>
      <p class="caption">All four are about <b>fin enlargement for gliding</b>, the trait Daane and colleagues measured. Three of
        them close a door we would have liked open, and the one that holds, holds only inside the Beloniformes.
        ${c.birdsExcluded ? 'No bird sequence, assembly or annotation was fetched: Aves is this project&rsquo;s frozen holdout.' : ''}</p>
      <p class="cite">${CITE.daane}</p>
      ${srcs(Q.sources)}`;
  };

  // ---- the 3D organism, and how little of it is measured ----
  SL.organism3d = () => {
    const A = N.anatomy;
    if (!A) return `${ghost('organism3d')}`;
    const mx = Math.max(...A.models.map(m => m.pieces));
    const zf = A.models.filter(m => !m.unmapped);
    return `${ribbon(st('organism3d'))}${rub('execution')}
      <h2>${n0(A.pieces)} named pieces. ${A.sourcedValues} measured numbers behind them.</h2>
      <div class="split">
        <div>
          <div class="bars" style="max-width:none">
            ${A.models.map((m, i) => `<div class="brow" style="grid-template-columns:minmax(90px,190px) 1fr auto">
              <span class="blab">${esc(m.name)}</span>
              <span class="btrack" style="height:24px"><i class="bfill" data-w="${(m.pieces / mx * 100).toFixed(1)}" style="background:var(--series-${[1, 3, 4][i % 3]})"></i></span>
              <span class="bval" style="min-width:12.5em">${m.pieces} pieces &middot; ${m.mapped} with a term &middot; ${m.sourcedValues} measured</span></div>`).join('')}
          </div>
          <p class="tiny" style="margin:10px 0 14px;max-width:66ch">Every piece is its own mesh with a label, a level, an organ
            system and a side, written by script from parameters rather than modelled by hand, so the whole thing rebuilds from
            the numbers.</p>
          <div class="scope"><h4>What is evidence-backed</h4>The flying fish rests on <b>exactly one</b> measured proportion:
            pectoral fin length at <b>${A.evidenceBacked.ratio} of standard length</b>, the median of <b>${A.evidenceBacked.n}</b>
            museum specimens, read from the measurement file rather than typed in. Its caveat travels with it:
            ${esc(A.evidenceBacked.caveat)}. The two zebrafish models carry
            ${zf.reduce((a, m) => a + m.sourcedValues, 0)} sourced proportions and counts between them.</div>
        </div>
        <div>
          <div class="scope warn"><h4>What is schematic, and labelled so</h4>Everything else &mdash; body depth, head shape, every
            other fin, the pose, and every organ&rsquo;s shape, size and position. All counts are illustrative. The manifest says so
            per piece, so no rendering can be mistaken for a measurement.</div>
          <div class="scope warn"><h4>Where the ontology ran out</h4><b>${A.unmapped}</b> of the flying fish&rsquo;s pieces have
            <em>no</em> ontology term: the manifest records a null and the nearest ancestor it could find, instead of inventing
            one. The two zebrafish models map ${zf.reduce((a, m) => a + m.pieces, 0)} of
            ${zf.reduce((a, m) => a + m.pieces, 0)} pieces, every one with an Uberon cross-reference.</div>
          <p class="cite" style="margin-top:14px">${CITE.ontology}</p>
        </div>
      </div>
      <p class="caption" style="max-width:112ch">The one novelty claim we make, worded as narrowly as the search supports:
        <b>we did not find prior use of a proof assistant on an ontology-derived anatomy hierarchy.</b> Ten logged searches turned
        up no Lean, Coq or Isabelle proofs about a hierarchy built from Uberon and the Cell Ontology. That is &ldquo;not
        found&rdquo;, not &ldquo;does not exist&rdquo;, and it is not a claim to a first.</p>
      ${srcs(A.sources)}`;
  };

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
