#!/usr/bin/env node
// Slide figure: verified datasets of 20 per arm, primary run and replicate side by side, fabricated identifiers
// marked, cost under each arm. Every number comes from compare/results.json. Output: dashboard/public/t/swarm/figure-verified.svg
// Usage: node swarm/compare/figure.mjs [--results compare/results.json] [--out <path>] [--title "..."]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const R = JSON.parse(fs.readFileSync(path.resolve(here, arg('results', 'results.json')), 'utf8'));
const OUT = path.resolve(here, arg('out', '../../dashboard/public/t/swarm/figure-verified.svg'));
const TITLE = arg('title', 'Verified datasets out of 20 claims, same model, tools and budget');
const ARMS = [['single', 'single agent'], ['isolated', 'isolated workers'], ['centralized', 'centralized swarm'], ['decentralized', 'decentralized board']];
// Light-theme tokens from the dashboard. One hue for the measure; replicate is the same hue at lower lightness/opacity.
const C = { ink: '#14201f', mute: '#5a6b69', line: '#d9dfdb', accent: '#0e7c86', accent2: '#8fc6cb', bad: '#b3392f', soft: '#eef2ef', bg: '#ffffff' };
const W = 960, H = 560, L = 70, Rm = 30, T = 130, B = 120, N = R.claims || 20;
const plotW = W - L - Rm, plotH = H - T - B, g = plotW / ARMS.length, bw = Math.min(70, g * 0.28), gap = 6;
const y = v => T + plotH - (v / N) * plotH;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" role="img" aria-label="${esc(TITLE)}">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<text x="${L}" y="36" font-size="22" font-weight="700" fill="${C.ink}">${esc(TITLE)}</text>
<text x="${L}" y="58" font-size="13" fill="${C.mute}">Pre-registered rule: an arm beats another only with zero fabricated identifiers and at least 2 more verified datasets.</text>
<text x="${L}" y="76" font-size="13" fill="${C.mute}">${ARMS.some(([k]) => R.arms[k]?.replicates?.length) ? 'The primary run decides; one replicate is shown beside it.' : 'One run per arm. "Verified" here also needs the agent to have fetched the landing page itself, per the run log.'}</text>`;
// gridlines and axis
for (const v of [0, 5, 10, 15, 20]) s += `<line x1="${L}" x2="${W - Rm}" y1="${y(v)}" y2="${y(v)}" stroke="${v ? C.line : C.mute}" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" font-size="12" text-anchor="end" fill="${C.mute}">${v}</text>`;
s += `<text x="${L - 46}" y="${T + plotH / 2}" font-size="12" fill="${C.mute}" transform="rotate(-90 ${L - 46} ${T + plotH / 2})" text-anchor="middle">verified datasets (of ${N})</text>`;
const bar = (x, v, fill, label, fab) => {
  if (v == null) return `<text x="${x + bw / 2}" y="${y(0) - 8}" font-size="11" text-anchor="middle" fill="${C.mute}">not run</text>`;
  const top = y(v), h = y(0) - top;
  let o = `<path d="M${x} ${y(0)} V${top + 4} a4 4 0 0 1 4 -4 H${x + bw - 4} a4 4 0 0 1 4 4 V${y(0)} Z" fill="${fill}"/>`;
  o += `<text x="${x + bw / 2}" y="${top - 8}" font-size="15" font-weight="700" text-anchor="middle" fill="${C.ink}">${v}</text>`;
  o += `<text x="${x + bw / 2}" y="${y(0) + 16}" font-size="11" text-anchor="middle" fill="${C.mute}">${label}</text>`;
  if (fab) o += `<g><circle cx="${x + bw / 2}" cy="${top - 34}" r="9" fill="${C.bad}"/><text x="${x + bw / 2}" y="${top - 30}" font-size="12" font-weight="700" text-anchor="middle" fill="#fff">!</text><text x="${x + bw / 2}" y="${top - 50}" font-size="11" font-weight="600" text-anchor="middle" fill="${C.bad}">${fab} fabricated id</text></g>`;
  return o;
};
ARMS.forEach(([k, nice], i) => {
  const a = R.arms[k], p = a?.primary, r = a?.replicates?.[0];
  const cx = L + g * i + g / 2, x1 = r ? cx - bw - gap / 2 : cx - bw / 2, x2 = cx + gap / 2;
  s += bar(x1, p?.verified ?? null, C.accent, r ? 'primary' : 'primary run', p?.fabricated_identifiers);
  if (r) s += bar(x2, r.verified, C.accent2, 'replicate', r.fabricated_identifiers);
  s += `<text x="${cx}" y="${y(0) + 40}" font-size="14" font-weight="600" text-anchor="middle" fill="${C.ink}">${esc(nice)}</text>`;
  if (p) s += `<text x="${cx}" y="${y(0) + 58}" font-size="12" text-anchor="middle" fill="${C.mute}">$${p.cost_usd_list.toFixed(2)} list price, ${p.minutes_wall.toFixed(1)} min, ${p.calls} call${p.calls === 1 ? '' : 's'}</text>`;
  if (p && r) s += `<text x="${cx}" y="${y(0) + 74}" font-size="11" text-anchor="middle" fill="${C.mute}">replicate $${r.cost_usd_list.toFixed(2)}, ${r.minutes_wall.toFixed(1)} min</text>`;
});
// legend
const lx = L, ly = 100, anyRep = ARMS.some(([k]) => R.arms[k]?.replicates?.length);
s += `<rect x="${lx}" y="${ly - 10}" width="12" height="12" rx="2" fill="${C.accent}"/><text x="${lx + 18}" y="${ly}" font-size="12" fill="${C.ink}">primary run (decides)</text>`;
if (anyRep) s += `<rect x="${lx + 150}" y="${ly - 10}" width="12" height="12" rx="2" fill="${C.accent2}"/><text x="${lx + 168}" y="${ly}" font-size="12" fill="${C.ink}">replicate</text>`;
// footer: verdicts and provenance
const v = (R.comparisons || []).filter(c => /beats|fails/.test(c.verdict)).map(c => c.verdict.replace(/ \(.*\)/, '')).join(' · ');
s += `<text x="${L}" y="${H - 28}" font-size="12" fill="${C.ink}">${esc(v)}</text>`;
s += `<text x="${L}" y="${H - 10}" font-size="11" fill="${C.mute}">DELPHI swarm thread, ScienceClaw 2026-10-31. Model ${esc(R.arms.single?.primary.model || R.arms.centralized?.primary.model || '')}. "Verified" = the landing page returns HTTP 200 and names the dataset. Built from results.json.</text>`;
s += `</svg>`;
fs.writeFileSync(OUT, s);
console.log('wrote', path.relative(path.join(here, '..', '..'), OUT), `${(s.length / 1024).toFixed(1)} KB`);
