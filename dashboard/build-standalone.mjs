#!/usr/bin/env node
// Builds the standalone MorphoLemma site: the blog and both technical views on their own
// origin, so the writing can be read and shared without the mission-control dashboard
// around it. The /docs page on the dashboard stays exactly as it is and matches by
// construction, because BOTH are built from the same dashboard/public/docs directory.
//
// What changes for the standalone copy, and only this:
//   1. docs/ moves to the site root, so the blog is at /
//   2. shared/ is copied in, since docs/ loads shell.css, shell.js and chat.js from it
//   3. ../ links (blueprint3d, deck, the dashboard itself) become absolute URLs back to
//      mission control, because those pages are NOT part of this site and a relative link
//      would 404 rather than quietly working
//   4. the dashboard nav strip is removed — it is mission control's chrome, not the blog's
//
//   node dashboard/build-standalone.mjs [outdir]
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = path.join(here, 'public');
const OUT = process.argv[2] || 'C:/Temp/deploy-blog';
const HUB = 'https://delphi-mission-control.ashenoy000.workers.dev';
const must = (c, m) => { if (!c) { console.error(`build-standalone FAILED: ${m}`); process.exit(1); } };

must(fs.existsSync(path.join(SRC, 'docs/index.html')), 'docs/index.html not found — run build-shell.mjs first');

fs.rmSync(path.join(OUT, 'public'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'public'), { recursive: true });

// Generators and build scripts never ship.
// Match on the BASENAME, not the full path: a regex with a path separator in it is one
// heredoc away from being silently wrong on Windows, which is how the generators shipped
// in the first build of this file.
const SKIP = n => /^(build|shoot|usecases|_.*)\.mjs$/i.test(n);
let n = 0, bytes = 0;
const copy = (from, to) => {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copy(a, b); continue; }
    if (SKIP(e.name)) continue;
    fs.copyFileSync(a, b); n++; bytes += fs.statSync(a).size;
  }
};
copy(path.join(SRC, 'docs'), path.join(OUT, 'public'));
fs.mkdirSync(path.join(OUT, 'public/shared'), { recursive: true });
copy(path.join(SRC, 'shared'), path.join(OUT, 'public/shared'));

// Rewrite the page itself.
const page = path.join(OUT, 'public/index.html');
let html = fs.readFileSync(page, 'utf8');
const before = html;

// The dashboard nav strip, injected by build-shell. It links to threads that only exist
// on mission control, so it has no business on a standalone blog.
html = html.replace(/<header class="dsh">[\s\S]*?<\/header>/, '');
must(!/class="dsh"/.test(html), 'dashboard nav strip still present after strip');

// ../anything -> absolute back to the hub, EXCEPT ../shared which ships with this site.
html = html.replace(/(src|href)="\.\.\/(?!shared\/)([^"]*)"/g, (_m, attr, rest) => `${attr}="${HUB}/${rest}"`);
html = html.replace(/(src|href)="\.\.\/shared\//g, (_m, attr) => `${attr}="shared/`);
must(!/"\.\.\//.test(html), 'a ../ reference survived the rewrite');
must(html !== before, 'nothing was rewritten — the page shape must have changed');

fs.writeFileSync(page, html);

// The chat route needs the worker; without it the assistant 404s on its own site.
fs.copyFileSync(path.join(here, 'worker.mjs'), path.join(OUT, 'worker.mjs'));
fs.writeFileSync(path.join(OUT, 'wrangler.toml'),
  `name = "morpholemma"\nmain = "worker.mjs"\ncompatibility_date = "2026-10-01"\n\n`
  + `[assets]\ndirectory = "./public"\nbinding = "ASSETS"\n`);

console.log(`standalone: ${n} files, ${(bytes / 1048576).toFixed(1)} MB -> ${OUT}`);
console.log(`  blog at /, technical views behind the same toggle, ../ links point back to the hub`);
