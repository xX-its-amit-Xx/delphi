#!/usr/bin/env node
// Does the ontology actually place these parts in this organism?
//
//   node sim-engine/scales/audit-taxon.mjs --run long-lived-fruit-fly
//   node sim-engine/scales/audit-taxon.mjs                 # every run
//   node sim-engine/scales/audit-taxon.mjs --offline        # use the cache only
//
// WHY THIS EXISTS. Joining the phenotype layer to the literature chain showed that the blueprint for
// Drosophila melanogaster contains bone marrow, hyaline cartilage, a penis and a uropygial gland, and does
// NOT contain a brain, a gut, a thorax, an abdomen, a muscle or a fat body. The counts passed every gate.
// Nobody read the labels, including the run that called that generation "all correct".
//
// The cause is that the blueprint keeps a structure unless a taxon constraint removes it, and an absent
// constraint is not evidence of presence: Uberon's taxon constraints are incomplete, and insect anatomy
// largely lives in FBbt, which nothing here queries. So "no constraint forbids it" became "a fly has it".
//
// This script asks the opposite question. For every part it fetches the `in_taxon` (RO_0002162) and
// `never_in_taxon` (RO_0002161) restrictions Ubergraph serves, and reports three things:
//
//   placed       some in_taxon restriction includes this organism's clade
//   contested    there IS an in_taxon restriction and NONE of them includes this organism
//   unconstrained no in_taxon restriction exists, so the ontology is silent and the part is unevidenced
//
// `contested` is a defect in the blueprint. `unconstrained` is not a defect and not a licence either, and
// counting the two separately is the whole point.
//
// HELD-OUT CLADES. A restricting taxon is named only if it appears in lib/lean-taxonomy.mjs, which the
// taxonomy builder generates with the held-out clades removed. A part restricted to a held-out clade is
// therefore reported as restricted to "a clade this project does not hold", which is both the honest
// statement and the one that keeps a held-out name out of this file.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TAXA } from '../../lib/lean-taxonomy.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..');
// The raw SPARQL responses are cached OUTSIDE the repository, in the OS temp directory. They are unscreened:
// a constraint on some part could name a held-out clade by IRI, and a cache inside the tree would carry it
// into a commit before anything looked. The previous round of this project did exactly that with the
// ecology cache. Only the screened, derived audit (taxon-audit.json) is written into the repository.
const CACHE = path.join(os.tmpdir(), 'delphi-scales-sparql');
const ENDPOINT = 'https://ubergraph.apps.renci.org/sparql';
const arg = f => process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : null;
const offline = process.argv.includes('--offline');
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const BY_TAXID = new Map(Object.entries(TAXA).map(([name, v]) => [String(v.taxid), name]));

fs.mkdirSync(CACHE, { recursive: true });

async function sparql(query, key) {
  const c = path.join(CACHE, `${key}.json`);
  if (fs.existsSync(c)) return rd(c);
  if (offline) return { results: { bindings: [] }, _offline: true };
  const r = await fetch(ENDPOINT, { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json',
      'User-Agent': 'delphisci-scales/0.11 (ScienceClaw; research use)' },
    body: new URLSearchParams({ query }) });
  if (!r.ok) throw new Error(`Ubergraph ${r.status} for ${key}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  fs.writeFileSync(c, JSON.stringify(j));
  return j;
}

/**
 * in_taxon / never_in_taxon for a batch of terms, from the NONREDUNDANT graph.
 *
 * This graph matters more than it looks. Ubergraph's default union graph serves the materialised closure, so
 * asking it for the in_taxon of the uropygial gland returns 29 rows -- the real constraint plus every
 * superclass of it, up to `independent continuant`. Any test of the form "does some in_taxon contain this
 * organism" then answers YES for every animal part of every animal, because Metazoa is in the closure. The
 * nonredundant graph returns the one asserted edge, which is the only one that constrains anything.
 */
async function constraintsFor(iris, key) {
  const vals = iris.map(i => `<${i}>`).join(' ');
  const q = `PREFIX RO: <http://purl.obolibrary.org/obo/RO_>
SELECT ?s ?p ?t WHERE { VALUES ?s { ${vals} } VALUES ?p { RO:0002162 RO:0002161 }
  GRAPH <http://reasoner.renci.org/nonredundant> { ?s ?p ?t } }`;
  const j = await sparql(q, key);
  const out = new Map();
  for (const b of j.results?.bindings ?? []) {
    const s = b.s.value, p = b.p.value.endsWith('0002162') ? 'in_taxon' : 'never_in_taxon';
    const taxid = /NCBITaxon_(\d+)/.exec(b.t.value)?.[1] ?? null;
    if (!out.has(s)) out.set(s, { in_taxon: [], never_in_taxon: [] });
    out.get(s)[p].push({ taxid, iri: b.t.value });
  }
  return { map: out, offline: Boolean(j._offline) };
}

const nameOf = taxid => BY_TAXID.get(String(taxid)) ?? null;

/**
 * Which of these taxa CONTAIN the organism, decided on the server.
 *
 * Asked this way rather than by name, because a constraining clade may be one this project holds out, and
 * lib/lean-taxonomy.mjs deliberately does not contain it. Ubergraph can still answer whether the organism is
 * inside it, so the audit reaches the right verdict without a held-out name ever entering a local file.
 */
async function containing(organismTaxid, taxids, key) {
  if (!organismTaxid || !taxids.length) return new Set();
  const vals = taxids.map(t => `<http://purl.obolibrary.org/obo/NCBITaxon_${t}>`).join(' ');
  const q = `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?t WHERE { VALUES ?t { ${vals} }
  <http://purl.obolibrary.org/obo/NCBITaxon_${organismTaxid}> rdfs:subClassOf ?t }`;
  const j = await sparql(q, key);
  return new Set((j.results?.bindings ?? []).map(b => /NCBITaxon_(\d+)/.exec(b.t.value)?.[1]).filter(Boolean));
}

async function audit(run) {
  const RUN = path.join(ROOT, 'runs', run);
  const OUT = path.join(RUN, 'scales');
  if (!fs.existsSync(OUT)) { console.error(`no runs/${run}/scales — run sim-engine/scales/build.mjs first`); return null; }
  const gens = fs.readdirSync(path.join(RUN, 'gen')).filter(f => /^gen\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a.slice(3)) - parseInt(b.slice(3))).map(f => rd(path.join(RUN, 'gen', f)));

  const perGen = {};
  let offlineSeen = false;
  for (const g of gens) {
    if (!g.blueprint) continue;
    const bp = rd(path.join(RUN, g.blueprint));
    const taxon = g.phenotype?.taxon ?? bp.reading?.taxon_label ?? null;
    const chain = new Set([taxon, ...((TAXA[taxon]?.ancestors) ?? [])].filter(Boolean));
    const nodes = (bp.nodes ?? []).filter(n => n.iri && n.level !== 'body');
    const iris = [...new Set(nodes.map(n => n.iri))];

    const map = new Map();
    for (let i = 0; i < iris.length; i += 90) {
      const batch = iris.slice(i, i + 90);
      const key = `taxcon-${run}-g${g.generation}-${i}`;
      const { map: m, offline: o } = await constraintsFor(batch, key);
      offlineSeen = offlineSeen || o;
      for (const [k, v] of m) map.set(k, v);
    }

    // Decide containment once, on the server, for every distinct constraining taxon in this generation.
    const organismTaxid = TAXA[taxon]?.taxid ?? null;
    const allTaxids = [...new Set([...map.values()].flatMap(c => [...c.in_taxon, ...c.never_in_taxon]).map(t => t.taxid).filter(Boolean))];
    const contains = await containing(organismTaxid, allTaxids, `taxcontains-${run}-g${g.generation}`);
    if (!organismTaxid) offlineSeen = offlineSeen || false;

    const rows = [];
    for (const n of nodes) {
      const c = map.get(n.iri) ?? { in_taxon: [], never_in_taxon: [] };
      const includes = c.in_taxon.filter(t => contains.has(String(t.taxid)));
      const forbids = c.never_in_taxon.filter(t => contains.has(String(t.taxid)));
      // A restricting clade is named only when this project's taxonomy table holds it, so a held-out clade
      // is reported without being named.
      const restricted_to = c.in_taxon.map(t => nameOf(t.taxid) ?? 'a clade this project does not hold');
      // HOW SPECIFIC is the constraint? This turned out to be the whole question. The uropygial gland --
      // a preen gland, which no insect has -- survives in a fruit fly's blueprint not because a constraint was ignored but
      // because its asserted non-redundant in_taxon is BILATERIA, which contains a fly. The same is true of
      // bone marrow and of a penis. A constraint that holds for most animals alive cannot distinguish one
      // animal from another, so "has a constraint" is not the useful fact: how far down the lineage it
      // reaches is.
      //
      // `ranks_above` counts how many steps up this organism's own lineage the constraining clade sits, so 0
      // is the organism itself and a large number is a clade it shares with most of the animal kingdom. A
      // constraint in the top third of the lineage is called VACUOUS, which is a statement about what it can
      // discriminate and not an accusation against the ontology.
      const lineage = TAXA[taxon]?.ancestors ?? [];
      const depth = t => { const nm = nameOf(t.taxid); if (!nm) return null; if (nm === taxon) return 0; const i = lineage.indexOf(nm); return i < 0 ? null : i + 1; };
      const depths = includes.map(depth).filter(d => d != null);
      const nearest = depths.length ? Math.min(...depths) : null;
      const vacuousAt = Math.max(3, Math.floor((lineage.length + 1) * 0.66));

      let verdict, why;
      if (forbids.length) { verdict = 'forbidden'; why = `the ontology asserts never_in_taxon for a clade containing ${taxon}, so this part should not be here at all`; }
      else if (includes.length && nearest != null && nearest >= vacuousAt) {
        verdict = 'placed-vacuously';
        why = `the only in_taxon restriction is to ${includes.map(t => nameOf(t.taxid) ?? 'a clade this project does not hold').join(', ')}, ${nearest} ranks above ${taxon} in a lineage of ${lineage.length + 1}. It contains ${taxon} and it contains most animals, so it cannot tell this organism from another and is no evidence that this part belongs here.`;
      }
      else if (includes.length) { verdict = 'placed'; why = `an in_taxon restriction is to ${includes.map(t => nameOf(t.taxid) ?? 'a clade this project does not hold').join(', ')}${nearest != null ? `, ${nearest} rank(s) above ${taxon}` : ''}, which contains ${taxon}`; }
      else if (c.in_taxon.length) { verdict = 'contested'; why = `every in_taxon restriction on this part is to ${[...new Set(restricted_to)].join(', ')}, none of which contains ${taxon}. The blueprint kept it because no constraint removed it, and an absent constraint is not evidence of presence.`; }
      else { verdict = 'unconstrained'; why = 'the ontology carries no in_taxon restriction for this part, so it is silent about whether this organism has it. Silence is not presence.'; }
      rows.push({ id: n.id, iri: n.iri, label: n.label, level: n.level, verdict, why,
        in_taxon: [...new Set(restricted_to)], never_in_taxon_hits: forbids.length,
        ranks_above_the_organism: nearest, lineage_length: lineage.length + 1, vacuous_at_or_above: vacuousAt });
    }
    const counts = rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] ?? 0) + 1; return a; }, {});
    perGen[g.generation] = { taxon, counts, total: rows.length, parts: rows };
  }

  const worst = Object.values(perGen)[0] ?? { counts: {}, total: 0 };
  const out = {
    what: 'Whether the ontology actually places each part of the blueprint in this organism.',
    contract_version: '0.11.0', run, built: new Date().toISOString(),
    endpoint: ENDPOINT, offline: offlineSeen,
    verdicts: { placed: 'some in_taxon restriction includes this organism', contested: 'there IS an in_taxon restriction and none includes this organism -- a defect in the blueprint',
      'placed-vacuously': 'the only in_taxon restriction is to a clade in the top third of this organism lineage -- true of it and of most animals, so it discriminates nothing',
      unconstrained: 'no in_taxon restriction exists, so the ontology is silent; not a defect and not a licence',
      forbidden: 'never_in_taxon asserts this part cannot be in this organism' },
    held_out: 'A restricting clade is named only if lib/lean-taxonomy.mjs holds it. The taxonomy builder omits held-out clades, so a part restricted to one is reported as restricted to "a clade this project does not hold".',
    generations: perGen,
    headline: `Of ${worst.total} parts: ${worst.counts.placed ?? 0} placed specifically, ${worst.counts['placed-vacuously'] ?? 0} placed only vacuously, ${worst.counts.unconstrained ?? 0} unconstrained, ${worst.counts.contested ?? 0} contested, ${worst.counts.forbidden ?? 0} forbidden. Only the first number is evidence that a part belongs in ${worst.taxon}.`,
    what_it_shows: 'Taxon constraints cannot do the work the blueprint layer asks of them. The blueprint keeps a part unless a constraint removes it, and for the great majority of parts the ontology either says nothing at all or says only that the part occurs somewhere in a clade containing most of the animal kingdom. That is why a fruit fly came back with bone marrow and a preen gland and without a brain: nothing in the pipeline was ever in a position to object.',
  };
  fs.writeFileSync(path.join(OUT, 'taxon-audit.json'), JSON.stringify(out, null, 1));
  console.log(`${run}: ${out.headline}`);
  return out;
}

const only = arg('--run');
const RUNS = path.join(ROOT, 'runs');
const runs = only ? [only] : fs.readdirSync(RUNS).filter(d => !d.startsWith('_') && fs.existsSync(path.join(RUNS, d, 'summary.json')));
for (const r of runs) await audit(r);
