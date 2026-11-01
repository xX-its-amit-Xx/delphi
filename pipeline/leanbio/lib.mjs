// Shared helpers for the LeanBio pipeline: paths, the held-out-clade guard, TriG scanning, JSON I/O.
// Everything here is pure Node (no network); network calls live in ground.mjs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const OUT = path.join(HERE, 'out');
export const CACHE = path.join(HERE, 'cache');
export const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
export const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n'); };
export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
export const exists = p => fs.existsSync(p);

/** Draft folders the pipeline reads. The held-out exam folder is never read (its records are about the exam). */
export const DRAFT_DIRS = [
  'claim-tests/nanopubs/unsigned',
  'genotype/nanopubs/unsigned',
  'lean/nanopubs/unsigned',
  'organism-design/nanopubs/unsigned',
  'physics/nanopubs/unsigned',
  'swarm/nanopubs/unsigned',
  'swarm/nanopubs/evidence',
];

// ── Held-out clade guard ───────────────────────────────────────────────────────────────────────────
// The held-out clade is defined in holdout/ (exam.json, split.json). Nothing in this folder names it: the
// guard reads the roster at run time, and every record that touches it is withheld before any grounding call,
// scoring or output. Only the COUNT of withheld records is reported.
let guardCache = null;
export function heldOutGuard() {
  if (guardCache) return guardCache;
  const exam = readJson(path.join(ROOT, 'holdout/exam.json'));
  const split = readJson(path.join(ROOT, 'holdout/split.json'));
  const held = split.taxa.filter(t => t.assignment === 'holdout');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const claimIds = new Set((exam.claims_mentioning_holdout || []).map(c => c.id));
  const names = [...new Set(held.flatMap(t => [t.name, t.slug && t.slug.includes('-') ? t.slug : null]).filter(Boolean))];
  const nameRe = names.length ? new RegExp(`\\b(${names.map(esc).join('|')})\\b`, 'i') : /$^/;
  const taxids = new Set(held.map(t => t.ids && t.ids.ncbi).filter(Boolean).map(String));
  const clade = exam.clade; if (!clade) throw new Error('holdout/exam.json has no clade');
  // class-level words, as holdout/check-leaks.mjs treats them (its "weak" signals); here they withhold the record
  const classRe = new RegExp(`\\b(${esc(clade)}|birds?|avian|AVONET)\\b`, 'i');
  const taxidRe = /NCBITaxon[_:](\d+)|taxid\D{0,5}(\d+)/gi;
  guardCache = {
    claimIds,
    /** true when this text or claim id touches the held-out clade */
    hits(text = '', claimId = null) {
      if (claimId && claimIds.has(claimId)) return true;
      if (classRe.test(text) || nameRe.test(text)) return true;
      for (const m of String(text).matchAll(taxidRe)) if (taxids.has(m[1] || m[2])) return true;
      for (const id of claimIds) if (text.includes(id)) return true;
      return false;
    },
  };
  return guardCache;
}

// ── TriG scanning (regex level; the drafts are hand-built TriG from a handful of builders) ────────────
const unq = s => s.replace(/\\"/g, '"').replace(/\\n/g, ' ');
export function scanTrig(src) {
  const lit = (prop) => [...src.matchAll(new RegExp(`${prop}\\s+"((?:[^"\\\\]|\\\\.)*)"`, 'g'))].map(m => unq(m[1]));
  const pv = {};
  for (const m of src.matchAll(/schema:propertyID\s+"([^"]+)"\s*;\s*schema:value\s+("((?:[^"\\]|\\.)*)"|[^;\s]+)/g)) pv[m[1]] = unq(m[3] ?? m[2]);
  const types = [...new Set([...src.matchAll(/npx:hasNanopubType\s+([^;.\n]+)/g)].flatMap(m => m[1].split(',').map(s => s.trim().replace(/^delphi:/, '').replace(/^<.*[/#]([^/#>]+)>$/, '$1'))))];
  const claimLinks = [...new Set([...src.matchAll(/w3id\.org\/delphi\/resource\/claim\/([A-Za-z0-9._-]+)/g)].map(m => m[1]))];
  const dois = [...new Set([...src.matchAll(/\b(10\.\d{4,9}\/[^\s"<>,;)]+[^\s"<>,;.)])/g)].map(m => m[1]))];
  const pmids = [...new Set([...src.matchAll(/(?:pubmed\.ncbi\.nlm\.nih\.gov\/|PMID[:\s]+)(\d{5,9})/gi)].map(m => m[1]))];
  const curies = [...new Set([
    ...[...src.matchAll(/purl\.obolibrary\.org\/obo\/([A-Za-z]+)_(\d+)/g)].map(m => `${m[1].toUpperCase()}:${m[2]}`),
    ...[...src.matchAll(/\b(NCBITaxon|UBERON|CL|GO|ZFA|CHEBI):(\d+)\b/g)].map(m => `${m[1]}:${m[2]}`),
    ...[...src.matchAll(/\b(ZDB-GENE-\d{6}-\d+)\b/g)].map(m => `ZFIN:${m[1]}`),
    ...[...src.matchAll(/\b(ENS[A-Z]*G\d{11})\b/g)].map(m => `ENSEMBL:${m[1]}`),
  ])].filter(c => !/^BFO:/.test(c));
  const pubLabel = (/sub:pubinfo\s*\{[\s\S]*?rdfs:label\s+"((?:[^"\\]|\\.)*)"/.exec(src) || [])[1];
  const assertion = (/sub:assertion\s*\{([\s\S]*?)\n\}/.exec(src) || [])[1] || '';
  const label = unq(pubLabel || (/rdfs:label\s+"((?:[^"\\]|\\.)*)"/.exec(assertion) || [])[1] || '');
  const description = unq((/dct:description\s+"((?:[^"\\]|\\.)*)"/.exec(assertion) || [])[1] || '');
  const orcid = /orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/.test(src);
  return { label, description, status: pv.status || null, plain: pv.plain_language_statement || null, types, claimLinks, dois, pmids, curies, orcid, comments: lit('rdfs:comment') };
}

export function listDrafts() {
  const out = [];
  for (const d of DRAFT_DIRS) {
    const abs = path.join(ROOT, d);
    if (!exists(abs)) continue;
    for (const f of fs.readdirSync(abs).filter(f => f.endsWith('.trig')).sort()) out.push(path.join(abs, f));
  }
  return out;
}

export const round = (x, n = 3) => (x == null ? null : Math.round(x * 10 ** n) / 10 ** n);
