// The claim graph as built for docs/claim-graph.html: every claim with thinker, year, proof status,
// testability and the truth scores from truth/raw, read from docs/claims.json. Rebuild that file
// with `node docs/build-claim-graph.mjs`.

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "./lib.mjs";

export const CLAIMS_JSON = join(REPO, "docs/claims.json");

let cache = null;

function load() {
  const mtime = statSync(CLAIMS_JSON).mtimeMs;
  if (cache?.mtime === mtime) return cache.data;
  const data = JSON.parse(readFileSync(CLAIMS_JSON, "utf8"));
  for (const c of data.claims) {
    const p = c.truth_by.map(x => x.p_true);
    c.disagreement = p.length > 1 ? +(Math.max(...p) - Math.min(...p)).toFixed(3) : null;
  }
  cache = { mtime, data };
  return data;
}

const has = (value, needle) => String(value ?? "").toLowerCase().includes(needle.toLowerCase());
const mean = xs => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null);

const SORTS = {
  truth: (a, b) => (b.truth ?? -1) - (a.truth ?? -1),
  "truth-asc": (a, b) => (a.truth ?? 2) - (b.truth ?? 2),
  disagreement: (a, b) => (b.disagreement ?? -1) - (a.disagreement ?? -1),
  testability: (a, b) => (b.testability ?? -1) - (a.testability ?? -1),
  year: (a, b) => a.year - b.year,
};
export const SORT_KEYS = Object.keys(SORTS);

const GROUPS = {
  thinker: c => c.thinker,
  work: c => c.work,
  decade: c => `${Math.floor(c.year / 10) * 10}s`,
  status: c => c.status,
  kind: c => c.kind,
};
export const GROUP_KEYS = Object.keys(GROUPS);

export function browseClaims({
  text, thinker, work, status, kind, yearFrom, yearTo, minTruth, maxTruth, minTruthAssessors = 0,
  published, sort = "truth", groupBy, limit = 20, source = "local",
} = {}) {
  // This tool reads one local snapshot (docs/claims.json) and nothing else. It used to accept and
  // silently drop source: "network", so a caller who asked for published data got unpublished
  // drafts without being told (issue #56 F5). Refuse instead, and name the source in the answer.
  if (source !== "local") {
    throw new Error(`delphi_graph has no "${source}" source: it reads the local docs/claims.json snapshot, which includes unpublished drafts. For what is published use delphi_sparql or delphi_search_claims with source "network", or filter here with published: true.`);
  }
  const { built, claims } = load();
  const hits = claims.filter(c =>
    (!text || has(`${c.label} ${c.statement} ${c.quote ?? ""}`, text))
    && (!thinker || has(c.thinker, thinker))
    && (!work || has(c.work, work))
    && (!status || c.status === status)
    && (!kind || has(c.kind, kind))
    && (yearFrom == null || c.year >= yearFrom)
    && (yearTo == null || c.year <= yearTo)
    && (minTruth == null || (c.truth != null && c.truth >= minTruth))
    && (maxTruth == null || (c.truth != null && c.truth <= maxTruth))
    && c.truth_by.length >= minTruthAssessors
    && (published == null || (published ? c.registry === "production" : c.registry !== "production")));

  if (groupBy) {
    if (!GROUPS[groupBy]) throw new Error(`groupBy must be one of ${GROUP_KEYS.join(", ")}`);
    const groups = new Map();
    for (const c of hits) {
      const k = GROUPS[groupBy](c);
      (groups.get(k) ?? groups.set(k, []).get(k)).push(c);
    }
    return {
      source: "local-snapshot", built, matched: hits.length, groupBy,
      groups: [...groups].map(([group, cs]) => ({
        group, claims: cs.length,
        meanTruth: mean(cs.map(c => c.truth).filter(v => v != null)),
        meanDisagreement: mean(cs.map(c => c.disagreement).filter(v => v != null)),
        meanTestability: mean(cs.map(c => c.testability).filter(v => v != null)),
        published: cs.filter(c => c.registry === "production").length,
        statuses: cs.reduce((m, c) => ({ ...m, [c.status]: (m[c.status] ?? 0) + 1 }), {}),
      })).sort((a, b) => b.claims - a.claims),
    };
  }

  if (!SORTS[sort]) throw new Error(`sort must be one of ${SORT_KEYS.join(", ")}`);
  return {
    source: "local-snapshot", built, matched: hits.length,
    claims: [...hits].sort(SORTS[sort]).slice(0, Math.min(Number(limit) || 20, 500)).map(c => ({
      id: c.id, title: c.label, statement: c.statement, thinker: c.thinker, year: c.year, work: c.work, chapter: c.chapter,
      kind: c.kind, status: c.status, truth: c.truth, truthBy: c.truth_by, disagreement: c.disagreement,
      testability: c.testability, nanopub: c.nanopub, registry: c.registry, draft: c.draft || undefined,
    })),
  };
}
