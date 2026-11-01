// Per-constant parser for sim-engine/scenarios/*.mjs + lib/state.mjs.
// Usage: node parse.mjs <repoRoot> <out.json>
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2]; const OUT = process.argv[3];
const SIM = path.join(ROOT, 'sim-engine');
const files = fs.readdirSync(path.join(SIM, 'scenarios')).filter(f => f.endsWith('.mjs')).map(f => 'scenarios/' + f).concat(['lib/state.mjs']);
const CONVERSIONS = new Set([0, 1, 2, 3, 4, 10, 100, 1000, 9.81, 9.80665, 60, 3600, 24, 273.15, 101325, 0.5, 1e3, 1e6, 1e-3, 1e-6, 1e-9, 1e9]);
const srcRe = /(https?:\/\/[^\s'"`,)]+|doi[:\s]*10\.\d{4,}\/[^\s'"`,)]+|\b10\.\d{4,}\/[^\s'"`,)]+|pmid[:\s]*\d{6,9}|PMC\d{5,})/i;
const nameRe = /([A-Z][a-z]+(?: et al\.?| & [A-Z][a-z]+)?,? ?(19|20)\d\d|[a-z]+(19|20)\d\d\b|\b[\w-]+\/[\w./-]+\.(json|js|mjs|py|csv|md)\b)/;
const repoRe = /\b[\w-]+\/[\w./-]+\.(json|js|mjs|py|csv|md|lean)\b|\b[\w-]+\.(json|py|lean)\b/;
const ayRe = /([A-Z][a-z]+(?: et al\.?| & [A-Z][a-z]+)?,? ?\(?(19|20)\d\d|[a-z]+-?(19|20)\d\d\b)/;
const strip = t => t.replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, m => '"' + ' '.repeat(Math.max(0, m.length - 2)) + '"').replace(/\/\/.*$/, m => ' '.repeat(m.length));
const out = [], perFile = {};
for (const f of files) {
  const src = fs.readFileSync(path.join(SIM, f), 'utf8'); const lines = src.split(/\r?\n/);
  let inBlock = false, lineCount = 0, lineStat = { url: 0, named: 0, none: 0 };
  let curConst = null;
  lines.forEach((ln, i) => {
    if (inBlock) { if (ln.includes('*/')) inBlock = false; return; }
    if (/^\s*\/\*/.test(ln) && !ln.includes('*/')) { inBlock = true; return; }
    if (/^\s*(\*|\/\/|import\b)/.test(ln)) return;
    const mc = ln.match(/^\s*(?:export\s+)?(?:const|let|function)\s+([A-Za-z_$][\w$]*)/); if (mc) curConst = mc[1];
    const code = strip(ln.replace(/\/\*.*?\*\//g, m => ' '.repeat(m.length)));
    const isParam = /\bkey:\s*'/.test(ln) && /\b(default|min|max):/.test(ln);
    const ctx = lines.slice(Math.max(0, i - 3), i + 4).join(' ');
    const m = ctx.match(srcRe), nm = ctx.match(nameRe);
    const lineStatus = m ? 'url' : nm ? (repoRe.test(nm[0]) && !ayRe.test(ctx) ? 'repo-file' : 'author-year') : 'none';
    // harness-comparable line count
    const hn = [...code.matchAll(/(?<![\w.$#])(\d+\.\d+|\d{2,}|\d(?:e-?\d+))(?![\w%])/gi)].map(x => Number(x[1])).filter(n => Number.isFinite(n) && !CONVERSIONS.has(n) && !(Number.isInteger(n) && n >= 1900 && n <= 2035));
    if (hn.length) { lineCount++; lineStat[m ? 'url' : nm ? 'named' : 'none']++; }
    // per-constant records
    const re = /(?<![\w.$#])(\d+\.\d+(?:e-?\d+)?|\d+(?:e-?\d+)?)(?![\w%])/gi; let x;
    while ((x = re.exec(code))) {
      const before = code.slice(0, x.index); const v = (/[:=,([]\s*-\s*$/.test(before) ? -1 : 1) * Number(x[1]);
      const prop = (before.match(/([A-Za-z_$][\w$]*)\s*:\s*[-(]?\s*$/) || [])[1];
      const paramField = isParam && ['default', 'min', 'max'].includes(prop);
      if (!paramField) {
        if (CONVERSIONS.has(v) || (Number.isInteger(v) && v >= 1900 && v <= 2035)) continue;
        if (/\[\s*$/.test(before) && Number.isInteger(v) && v < 20) continue; // array index
      }
      if (/\.at\(\s*-?\s*$|\.toFixed\(\s*$|\.toExponential\(\s*$|\.slice\([^)]*$|toPrecision\(\s*$/.test(before)) continue;
      const key = (ln.match(/\bkey:\s*'([^']+)'/) || [])[1];
      const unit = (ln.match(/\bunit:\s*'([^']*)'/) || [])[1] ?? null;
      const kind = (ln.match(/\bkind:\s*'([^']+)'/) || [])[1] ?? null;
      const comment = (ln.match(/\/\/\s*(.*)$/) || [])[1] || null;
      const srcStr = (ln.match(/\bsource:\s*(['"`])((?:\\.|(?!\1).)*)\1/) || [])[2] || null;
      const name = paramField ? `param ${key}.${prop}` : [curConst, key, prop].filter(Boolean).join('.') || `line ${i + 1}`;
      const citeText = [srcStr, comment, lines.slice(Math.max(0, i - 3), i).filter(l => /^\s*\/\//.test(l)).join(' ')].filter(Boolean).join(' | ');
      out.push({ file: 'sim-engine/' + f, line: i + 1, name, value: v, unit, kind, code: ln.trim().slice(0, 220),
        current_citation: (m ? m[1] : nm ? nm[0] : null), citation_context: citeText.slice(0, 400), status: lineStatus });
    }
  });
  perFile[f] = { harness_lines: lineCount, ...lineStat };
}
fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), perFile, records: out }, null, 1));
const tot = Object.values(perFile).reduce((a, b) => ({ l: a.l + b.harness_lines, u: a.u + b.url, n: a.n + b.named, z: a.z + b.none }), { l: 0, u: 0, n: 0, z: 0 });
console.log('records', out.length, 'harness-method lines', tot, JSON.stringify(perFile));
const st = {}; for (const r of out) st[r.status] = (st[r.status] || 0) + 1; console.log(st);
