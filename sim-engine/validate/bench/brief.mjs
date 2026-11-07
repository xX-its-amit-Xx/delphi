// THE PARTNER BRIEF: one page a PI can read in three minutes and decide against.
//
// ============================== WHY IT IS GENERATED, NOT WRITTEN ==============================
// A brief written by hand drifts from the package within a week: a price changes, a case is re-ranked,
// a correction lands, and the document a lab is reading no longer describes the thing. Every number here
// comes from benchPackage() at render time, so the brief cannot be stale without the package being
// stale too.
//
// ============================== THE ORDER IS THE ARGUMENT ==============================
// 1. What this is not. Before anything else, because the single fastest way to lose a collaborator is to
//    let them discover on page three that the "SOP" is not a protocol.
// 2. The approval gate. Nothing below it can start without it and we cannot grant it.
// 3. What we already know will happen, including the finding that the obvious cheap experiment is
//    uninformative. A brief that hides its own bad news is an advertisement.
// 4. How many animals, or an honest refusal naming the one missing number.
// 5. The money, as the marginal cost - the only figure meaningful to a lab that already injects.
// 6. What we are asking for, which is criticism before it is bench time.
//
// ============================== WHAT IT MAY NOT CONTAIN ==============================
// No sentence that implies a protocol, a quote, or evidence that the experiment will work. checkBrief()
// enforces that mechanically against the same refusal vocabulary the package already carries.

import * as B from './bench.mjs';
import * as C from './cases.mjs';
import * as PWR from './power.mjs';

export const WHAT_THIS_IS =
  'A one-page brief for a prospective partner lab, generated from the bench package so it cannot drift ' +
  'from it. It leads with what the package is not, states the approval gate before anything else, and ' +
  'gives the marginal cost rather than the list total.';

/** Phrases that would make the brief a different and worse document.
 *
 *  Each pattern matches the AFFIRMATIVE form only. The first version matched bare words - `\bquote\b`,
 *  `\bwill work\b` - and promptly flagged the brief's own disclaimer, "Not a protocol, not a quote, not
 *  evidence that the experiment will work". A checker that fires on the exact sentence it exists to
 *  protect is worse than no checker, because the obvious fix is to delete the sentence. */
export const FORBIDDEN = [
  { re: /\b(our|the|this)\s+protocol\b|\bstep-by-step\b|\bfollow\s+these\s+steps\b/i, why: 'implies a bench protocol. sop.mjs is a staged plan citing published methods and nobody here has run a step of it.' },
  { re: /\b(is|as)\s+a\s+quote\b|\bour\s+quote\b|\bquoted\s+price\b/i, why: 'implies a price quote. Every figure is a public list price and academic contract pricing is lower.' },
  { re: /\b(it|this|the experiment)\s+will\s+work\b|\bproven\s+to\b|\bguarantee[sd]?\b/i, why: 'implies evidence the experiment succeeds. There is none: nothing here has been run at a bench.' },
  { re: /\bturnkey\b|\bready\s+to\s+run\b|\bplug\s+and\s+play\b/i, why: 'implies the lab can start from this document. They cannot: approval comes first and the methods are in the cited papers.' },
];

/** The sentence the brief must contain. Its absence is as much a defect as a forbidden phrase. */
export const REQUIRED_DISCLAIMER = /Not a protocol, not a quote, not evidence that the experiment will work/;

/** Is this match NEGATED - "not a quote", "no price here is a quote", "never guaranteed"?
 *
 *  Stripping the quoted disclaimer was not enough. The catalogue's own price basis says "No price here
 *  is a quote", the package's scope says "not evidence that the experiment will work", and both are
 *  exactly the sentences the brief should carry. A checker that forbids the honest disclaimers and
 *  permits everything else has its sign backwards.
 *
 *  So the guard is general: a forbidden phrase preceded by a negation within the same clause is a
 *  DENIAL of the claim, which is the opposite of making it. */
const NEGATION = /\b(not|no|never|isn'?t|aren'?t|nothing|none)\b[^.;:]{0,40}$/i;

export function isNegated(text, index) {
  return NEGATION.test(text.slice(Math.max(0, index - 60), index));
}

export function checkBrief(text) {
  const body = text.split('\n').filter(l => !l.startsWith('> ')).join('\n');
  const hits = FORBIDDEN.filter(f => {
    const re = new RegExp(f.re.source, f.re.flags.includes('g') ? f.re.flags : f.re.flags + 'g');
    for (const m of body.matchAll(re)) if (!isNegated(body, m.index)) return true;
    return false;
  });
  const hasDisclaimer = REQUIRED_DISCLAIMER.test(text);
  return {
    ok: hits.length === 0 && hasDisclaimer,
    violations: hits.map(h => ({ pattern: String(h.re), why: h.why })),
    disclaimer_present: hasDisclaimer,
    disclaimer_missing_why: hasDisclaimer ? null : 'the brief must carry the package\'s own statement of what it is not, verbatim and before anything else.',
    checked_against: `${FORBIDDEN.length} forbidden claim shapes, outside the quoted disclaimer`,
    note: 'a regex is a weak check on prose. It catches the four phrasings that would most change what a reader believes, and it is not a substitute for reading the thing.',
  };
}

const money = n => (n == null ? 'quote required' : `$${n.toFixed(2)}`);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render the brief's own markdown subset to HTML. Deliberately tiny: this file WRITES the markdown, so
 *  the converter only has to handle what it emits, and a general-purpose library would be a dependency
 *  and an attack surface for the sake of six rules. */
export function renderHtml(markdown, { title = 'DELPHI partner brief' } = {}) {
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (/^#{1,3}\s/.test(line)) {
      closeList();
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#+\s/, ''))}</h${level}>`);
    } else if (/^>\s?/.test(line)) {
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
    } else if (/^\s*-\s/.test(line)) {
      const depth = (line.match(/^\s*/)[0].length >= 2) ? 1 : 0;
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li${depth ? ' class="sub"' : ''}>${inline(line.replace(/^\s*-\s/, ''))}</li>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^\d+\.\s/, ''))}</li>`);
    } else if (line === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();

  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --fg:#16191d; --mute:#5b6572; --line:#e3e7ec; --accent:#1f6feb; --warn:#8a5a00; --bg:#fff; }
  @media (prefers-color-scheme: dark) { :root { --fg:#e8eaed; --mute:#9aa3ad; --line:#252b33; --accent:#6ea8fe; --warn:#d9a86c; --bg:#0f1216; } }
  body { max-width:46rem; margin:0 auto; padding:2.2rem 1.1rem 5rem; background:var(--bg); color:var(--fg);
         font:16px/1.65 ui-serif,Georgia,Cambria,"Times New Roman",serif; }
  h1 { font-size:1.55rem; line-height:1.25; margin:0 0 .3rem; }
  h2 { font-size:1.08rem; margin:2.1rem 0 .5rem; padding-top:.9rem; border-top:1px solid var(--line);
       font-family:ui-sans-serif,system-ui,sans-serif; letter-spacing:.01em; }
  h3 { font-size:1rem; margin:1.3rem 0 .3rem; font-family:ui-sans-serif,system-ui,sans-serif; }
  p { margin:.6rem 0; }
  ul { margin:.5rem 0; padding-left:1.15rem; }
  li { margin:.22rem 0; }
  li.sub { list-style:circle; margin-left:1rem; }
  blockquote { margin:.8rem 0; padding:.7rem .9rem; border-left:3px solid var(--warn);
               background:color-mix(in srgb, var(--warn) 8%, transparent); font-style:italic; }
  code { font:13.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
         background:color-mix(in srgb, var(--fg) 7%, transparent); padding:.1em .32em; border-radius:3px; }
  em { color:var(--mute); }
  a { color:var(--accent); }
  strong { font-weight:650; }
</style>
${out.join('\n')}
`;
}

/** Render the brief for one case. Returns markdown. */
export function brief(caseId, opts = {}) {
  const p = B.benchPackage(caseId, opts);
  if (p.refused) return `# refused\n\n${p.why}\n`;
  const k = p.case;
  const ranked = p.ranked_among;
  const power = p.power;
  const L = [];

  L.push(`# ${k.question}`);
  L.push('');
  L.push(`*A proposal from the DELPHI validation harness. Case \`${k.id}\`, ranked ${ranked.find(r => r.id === k.id)?.rank} of ${ranked.length}.*`);
  L.push('');

  L.push('## Read this first: what this is not');
  L.push('');
  L.push(`> ${p.what_this_package_is_not}`);
  L.push('');
  L.push('It is a costed, sourced experimental **proposal** with decision gates, assembled from published methods. The methods themselves stay in the papers it cites, on purpose: a restated protocol loses its errata.');
  L.push('');

  L.push('## Before anything: approval');
  L.push('');
  L.push(`**${p.plan.approval.what ?? 'Institutional animal-care approval (IACUC or local equivalent), plus biosafety registration for the nuclease and any synthetic nucleic acid.'}**`);
  const gate0 = p.plan.stages[0]?.gate;
  if (gate0) L.push(`Stage 0 of every route: *${gate0.must_hold}* — otherwise *${gate0.if_not}*.`);
  L.push('');
  L.push('This module cannot grant any of it, and nothing in the plan starts without it.');
  L.push('');

  L.push('## What is already known, including the part that argues against us');
  L.push('');
  L.push(`**${p.knockouts_are_normal.headline}**`);
  L.push('');
  for (const e of p.knockouts_are_normal.evidence) L.push(`- *${e.gene}* — ${e.finding}. “${e.quote}” (${e.citation})`);
  L.push('');
  if (k.published_expectation) {
    L.push(`**What this case expects:** ${k.published_expectation.what}`);
    L.push('');
    if (k.published_expectation.numbers) L.push(`Numbers: ${k.published_expectation.numbers}`);
    else L.push(`**No published numbers exist for this comparison.** ${k.published_expectation.caveat ?? ''}`);
    L.push('');
  }
  if (k.measurement_mismatch) {
    L.push(`**A mismatch we have not resolved.** The published number measures the ${k.measurement_mismatch.what_the_published_number_measures}; the design's claim is about the ${k.measurement_mismatch.what_the_design_claims}. ${k.measurement_mismatch.status}`);
    L.push('');
  }

  L.push('## How many animals');
  L.push('');
  if (power.powerable) {
    L.push(`**${power.n_per_arm_to_use} per arm**, and that number counts ${power.and_now_the_part_that_bites.what_n_counts}`);
    L.push('');
    L.push(`- vs the marker-only control: n = ${power.primary_comparison.n_per_arm}`);
    L.push(`- vs the specificity control: n = ${power.specificity_comparison.n_per_arm} ← the binding one`);
    if (power.primary_comparison.use_an_exact_test) L.push(`- ${power.primary_comparison.use_an_exact_test_because}`);
    L.push('');
    L.push('Two fractions sit between that number and the embryos to inject, and neither is published:');
    for (const f of power.and_now_the_part_that_bites.two_unpublished_fractions_sit_between_them) L.push(`- ${f}`);
    L.push('');
    L.push(`*${power.and_now_the_part_that_bites.a_cheap_way_to_de_risk_it}*`);
  } else {
    L.push('**This comparison cannot be powered yet**, and we would rather say so than produce a number.');
    L.push('');
    L.push(`- missing: **${power.the_one_missing_quantity}**`);
    L.push(`- from: ${power.where_it_would_come_from}`);
    if (power.this_is_a_data_request_not_an_experiment) L.push('- **this is a data request, not an experiment.** One extraction would make it runnable.');
    L.push('');
    // `what_we_refuse_to_do` is phrased as the object of "we refuse to", so it is introduced rather than
    // repeated - an earlier version printed "We will not substitute ...: substitute ...".
    L.push(`What we refuse to do: ${power.what_we_refuse_to_do}`);
  }
  L.push('');

  L.push('## The experiment, in brief');
  L.push('');
  L.push(`- **organism** ${k.organism}, ${k.base}`);
  L.push(`- **what is done** ${k.edit.change} (${k.edit.kind})`);
  L.push(`- **readout** ${k.assay}, at ${k.readout_stage}`);
  L.push(`- **time to an answer** about ${k.months_to_answer} month(s)`);
  L.push(`- **arms** ${p.conditions.n_arms}, ${p.conditions.design}`);
  for (const a of p.conditions.arms) L.push(`  - \`${a.id}\` — ${a.value}`);
  L.push('');
  if (p.controls.the_controls_are_in_the_design_instead) {
    L.push('**The controls are the experiment here.**');
    for (const c of p.controls.the_controls_are_in_the_design_instead) L.push(`- \`${c.id}\` — published ${c.published_result}. Proves ${c.proves}.`);
    if (p.controls.what_is_still_missing) L.push(`- **Still missing:** ${p.controls.what_is_still_missing}`);
  } else if (p.controls.injection_control) {
    L.push(`**Controls:** \`${p.controls.injection_control.id}\` (${p.controls.injection_control.penetrance}) proves the injection worked` +
      (p.controls.readout_control ? `; \`${p.controls.readout_control.id}\` (${p.controls.readout_control.penetrance}) proves the lab can score the readout.` : '.'));
  }
  L.push('');

  L.push('## Money');
  L.push('');
  L.push(`**${money(p.budget.marginal_cost_usd)}** is what this adds in a lab that already runs zebrafish injections.`);
  L.push(`${money(p.budget.subtotal_usd)} is the whole list, including ${money(p.budget.already_in_most_labs_usd)} of bulk salts, consumables and general kits such a lab already owns.`);
  L.push('');
  if (p.budget.is_lower_bound) L.push(`**This total is a lower bound.** ${p.bill_of_materials.filter(l => l.extended_price_usd == null).map(l => `\`${l.id}\`: ${l.why_unpriced}`).join(' ')}`);
  L.push('');
  L.push('Not included, and for any case needing a generation these dominate everything above:');
  for (const x of p.budget.what_is_not_in_this_total) L.push(`- ${x}`);
  L.push('');
  L.push(`*${p.budget.price_basis}*`);
  L.push('');

  L.push('## What we are asking for');
  L.push('');
  L.push('1. **Tell us what is wrong with this before anyone orders anything.** Blunt is more useful than polite. The traps list, the stop rules and the ordering files come with it.');
  L.push('2. If the power section above refuses, the missing number is a literature or source-data question, not bench time.');
  L.push('3. If you run it: blind scoring, both controls in the same session from the same clutch, and per-animal values rather than summaries. The return format is in the package.');
  L.push('');
  L.push(`*Generated from \`sim-engine/validate/bench\` at render time. Every figure above is re-derived from the package, so this page cannot be newer or older than the thing it describes. Case ranking rule: ${p.case.id === C.rank()[0].id ? 'this is the top-ranked case.' : 'see the package.'}*`);

  return L.join('\n') + '\n';
}
