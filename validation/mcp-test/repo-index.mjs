// Independent index of the repo's TriG files, built by parsing each file's quads directly
// (oxigraph.parse, no SPARQL), so the MCP answers can be checked against something that does not
// share the server's query code. Same file-selection rule as mcp/lib.mjs (unsigned and *-unsigned).
import oxigraph from "oxigraph";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const D = "https://w3id.org/delphi/ontology/";
const LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const DESC = "http://purl.org/dc/terms/description";
const NOTATION = "http://www.w3.org/2004/02/skos/core#notation";
const ISPARTOF = "http://purl.org/dc/terms/isPartOf";
const ATTR = "http://www.w3.org/ns/prov#wasAttributedTo";

export function trigFiles(REPO_ROOT = REPO) {
  // Mirrors mcp/lib.mjs localFiles() on origin/main: <project>/nanopubs and books/<project>/nanopubs.
  const dirs = d => { try { return readdirSync(d, { withFileTypes: true }).filter(x => x.isDirectory() && !x.name.startsWith(".") && x.name !== "node_modules").map(x => join(d, x.name)); } catch { return []; } };
  const out = [];
  for (const proj of [...dirs(REPO_ROOT), ...dirs(join(REPO_ROOT, "books"))]) {
    let ds; try { ds = readdirSync(join(proj, "nanopubs"), { withFileTypes: true }); } catch { continue; }
    for (const d of ds) if (d.isDirectory() && (d.name === "unsigned" || d.name.endsWith("-unsigned")))
      for (const f of readdirSync(join(proj, "nanopubs", d.name))) if (f.endsWith(".trig")) out.push(join(proj, "nanopubs", d.name, f));
  }
  return out;
}

export function buildIndex(REPO_ROOT = REPO) {
  const files = trigFiles(REPO_ROOT);
  const claims = new Map();      // iri -> {labels:Set, desc:Set, notation:Set, files:Set, domains:Set}
  const asmt = new Map();        // assessment iri -> {claim, type, score, assessor, parent, verdict}
  const get = iri => claims.get(iri) ?? claims.set(iri, { labels: new Set(), desc: new Set(), notation: new Set(), files: new Set(), domains: new Set() }).get(iri);
  const A = iri => asmt.get(iri) ?? asmt.set(iri, {}).get(iri);
  for (const f of files) {
    const rel = relative(REPO_ROOT, f).replaceAll("\\", "/");
    const quads = oxigraph.parse(readFileSync(f, "utf8"), { format: "application/trig", base_iri: "http://example.org/" + rel + "/" });
    let head = null, assertionG = null, pubinfoG = null, np = null;
    for (const q of quads) if (q.predicate.value === "http://www.nanopub.org/nschema#hasAssertion") { np = q.subject.value; assertionG = q.object.value; }
    for (const q of quads) if (q.predicate.value === "http://www.nanopub.org/nschema#hasPublicationInfo") pubinfoG = q.object.value;
    let domain = null;
    for (const q of quads) if (q.graph.value === pubinfoG && q.predicate.value === D + "domain" && q.subject.value === np) domain = q.object.value;
    for (const q of quads) {
      if (q.graph.value !== assertionG) continue;
      const s = q.subject.value, p = q.predicate.value, o = q.object.value;
      if (p === RDF_TYPE && o === D + "Claim") { const c = get(s); c.files.add(rel); if (domain) c.domains.add(domain); }
      if (p === D + "hasAssessment") A(o).claim = s;
      if (p === D + "assessmentType") A(s).type = o;
      if (p === D + "hasScore") A(s).score = Number(o);
      if (p === D + "hasVerdict") A(s).verdict = o;
      if (p === ATTR) A(s).assessor = o;
      if (p === ISPARTOF) A(s).parent = o;
    }
    for (const q of quads) {
      if (q.graph.value !== assertionG || !claims.has(q.subject.value) || !claims.get(q.subject.value).files.has(rel)) continue;
      const c = claims.get(q.subject.value), p = q.predicate.value;
      if (p === LABEL) c.labels.add(q.object.value);
      if (p === DESC) c.desc.add(q.object.value);
      if (p === NOTATION) c.notation.add(q.object.value);
    }
  }
  return { files: files.length, claims, asmt };
}

// Independent ranking: top-level assessments of `type`, one score per assessor; also reports
// claims where one assessor has more than one top-level score (the server keeps whichever row comes last).
export function rankIndependent(idx, type) {
  const by = new Map();
  for (const [iri, a] of idx.asmt) {
    if (a.type !== type || a.parent || a.score == null || !a.assessor || !a.claim) continue;
    const c = by.get(a.claim) ?? by.set(a.claim, new Map()).get(a.claim);
    (c.get(a.assessor) ?? c.set(a.assessor, []).get(a.assessor)).push(a.score);
  }
  const rows = [], dupes = [];
  for (const [claim, m] of by) {
    const per = [...m.values()];
    for (const [who, s] of m) if (s.length > 1 && new Set(s).size > 1) dupes.push({ claim, assessor: who, scores: s });
    const last = per.map(s => s[s.length - 1]);
    const mean = last.reduce((x, y) => x + y, 0) / last.length;
    rows.push({ claim, assessors: per.length, score: +mean.toFixed(4), spread: +(Math.max(...last) - Math.min(...last)).toFixed(4), ambiguous: per.some(s => new Set(s).size > 1) });
  }
  rows.sort((a, b) => b.score - a.score || b.assessors - a.assessors);
  return { rows, dupes };
}
