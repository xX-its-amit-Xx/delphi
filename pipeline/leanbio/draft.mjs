#!/usr/bin/env node
// Nanopub draft for one LeanBio record: the claim's grounded entities, its typed statement and its belief score,
// as an UNSIGNED TriG draft in the repo's existing format (temp np1 namespace, Delphi ontology v2.0 prefixes,
// software-agent creator, no human ORCID). Nothing is signed or published here.
//
//   node pipeline/leanbio/draft.mjs <record id>            # print the TriG
//   node pipeline/leanbio/draft.mjs --top 5 --write         # write drafts for the queue head to nanopubs/unsigned/
//   import { renderDraft } from './draft.mjs'
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { HERE, OUT, ROOT, readJson } from './lib.mjs';

const lit = s => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`;
const slug = id => id.replace(/^draft:/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/\.trig$/, '').slice(0, 120);
/** CURIE -> resolvable IRI (bioregistry resolves every prefix used here). */
export const iriOf = curie => {
  const [p, ...rest] = String(curie).split(':');
  const local = rest.join(':');
  if (/^(UBERON|CL|GO|ZFA|CHEBI|HP|NCBITaxon|DOID|EFO)$/.test(p) && /^\d+$/.test(local) && p !== 'EFO') return `http://purl.obolibrary.org/obo/${p}_${local}`;
  return `https://bioregistry.io/${p.toLowerCase()}:${local}`;
};
const head = () => { const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };

export function renderDraft(rec, { created = new Date().toISOString().replace(/\.\d+Z$/, 'Z') } = {}) {
  const S = `https://w3id.org/delphi/resource/leanbio/statement/${slug(rec.id)}`;
  const agent = 'https://w3id.org/delphi/resource/agent/delphisci-leanbio-pipeline';
  const commit = head() || 'main';
  const basedOn = rec.origin === 'claim' ? `https://w3id.org/delphi/resource/claim/${rec.id}` : `https://github.com/fractastical/delphisci/blob/${commit}/${rec.source}`;
  const ents = (rec.entities || []).filter(e => e.status === 'grounded');
  const amb = (rec.entities || []).filter(e => e.status === 'ambiguous');
  const st = rec.statement;
  const b = rec.belief;
  const pv = (k, id, value, desc) => `  sub:${k} a schema:PropertyValue ; schema:propertyID ${lit(id)} ; schema:value ${value} ; schema:description ${lit(desc)} .`;
  const lines = [];
  lines.push(`@prefix this: <http://purl.org/nanopub/temp/np1/> .`, `@prefix sub: <http://purl.org/nanopub/temp/np1/> .`, `@prefix np: <http://www.nanopub.org/nschema#> .`, `@prefix npx: <http://purl.org/nanopub/x/> .`, `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .`, `@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`, `@prefix dct: <http://purl.org/dc/terms/> .`, `@prefix prov: <http://www.w3.org/ns/prov#> .`, `@prefix schema: <https://schema.org/> .`, `@prefix delphi: <https://w3id.org/delphi/ontology/> .`, '');
  lines.push(`sub:Head {`, `  this: a np:Nanopublication ;`, `    np:hasAssertion sub:assertion ;`, `    np:hasProvenance sub:provenance ;`, `    np:hasPublicationInfo sub:pubinfo .`, `}`, '');
  lines.push(`sub:assertion {`);
  lines.push(`  <${S}> a schema:Claim ;`);
  lines.push(`    rdfs:label ${lit(rec.text)} ;`);
  lines.push(`    schema:isBasedOn <${basedOn}> ;`);
  if (ents.length) lines.push(`    schema:about ${ents.map(e => `<${iriOf(e.id)}>`).join(', ')} ;`);
  lines.push(`    schema:additionalProperty sub:relation, sub:belief${st.subject?.id ? ', sub:subject' : ''}${st.object?.id ? ', sub:object' : ''} ;`);
  lines.push(`    rdfs:comment ${lit(`Grounded with Gilda (grounding.indra.bio) and, for identifiers Gilda does not index, MyGene.info, OLS4 and the repo taxon inventory (taxa may come from the inventory claim map, organisms/merged/taxa.json mentioned_in); acceptance rule in pipeline/leanbio/README.md. ${amb.length ? `Ambiguous groundings not asserted here: ${amb.map(e => `${e.text} -> ${e.id}`).join('; ')}.` : 'No ambiguous grounding.'}`)} .`);
  for (const e of ents) lines.push(`  <${iriOf(e.id)}> rdfs:label ${lit(e.name || e.id)} ; dct:identifier ${lit(e.id)} .`);
  lines.push(pv('relation', 'relation_type', lit(st.type), `INDRA-style statement type from the fixed vocabulary ${st.vocabulary} (pipeline/leanbio/relations.json); rule that fired: ${st.rule}. A heuristic typing, not a curated statement.`));
  if (st.subject?.id) lines.push(pv('subject', 'relation_subject', `<${iriOf(st.subject.id)}>`, `Subject of the typed statement (mention "${st.subject.text}").`));
  if (st.object?.id) lines.push(pv('object', 'relation_object', `<${iriOf(st.object.id)}>`, `Object of the typed statement (mention "${st.object.text}").`));
  lines.push(pv('belief', 'leanbio_belief', `"${b.belief}"^^xsd:decimal`, `Computed score, not a probability: belief = E * (1 - R) with E = ${b.E}, R = ${b.R} under ${b.params} (pipeline/leanbio/belief-params.json), from independent evidence counts ${JSON.stringify(b.n)}. The parameters are hand-set and not calibrated; the score orders the formalization queue.`));
  lines.push(`}`, '');
  lines.push(`sub:provenance {`);
  lines.push(`  sub:assertion prov:wasAttributedTo <${agent}> ;`);
  lines.push(`    prov:wasDerivedFrom <${basedOn}>, <https://github.com/fractastical/delphisci/blob/${commit}/pipeline/leanbio/run.mjs> .`);
  lines.push(`  <https://github.com/fractastical/delphisci/blob/${commit}/pipeline/leanbio/run.mjs> rdfs:comment ${lit('The LeanBio pipeline runner. This commit is local to the hackathon tree and the pipeline files may not be in it yet; the URL resolves after the pipeline is committed and pushed.')} .`);
  lines.push(`  <${agent}> a prov:SoftwareAgent ; rdfs:label ${lit('delphisci LeanBio pipeline (pipeline/leanbio)')} .`);
  lines.push(`}`, '');
  lines.push(`sub:pubinfo {`);
  lines.push(`  this: dct:created "${created}"^^xsd:dateTime ;`);
  lines.push(`    dct:creator <${agent}> ;`);
  lines.push(`    rdfs:label ${lit(`LeanBio grounding, statement type and belief for ${rec.id}`)} ;`);
  lines.push(`    dct:license <https://creativecommons.org/licenses/by/4.0/> ;`);
  lines.push(`    npx:hasNanopubType schema:Claim ;`);
  lines.push(`    npx:introduces <${S}> ;`);
  lines.push(`    rdfs:comment ${lit('UNSIGNED DRAFT generated by pipeline/leanbio/draft.mjs: not signed, not published to any registry. Intended for the nanopub TEST registry first; production publication needs the ORCID key owner\'s explicit approval. No human owner is named in this draft: dct:creator is the software agent. No assertion or provenance template is declared (none exists for LeanBio statements yet).')} .`);
  lines.push(`}`);
  return lines.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const args = process.argv.slice(2);
  const records = readJson(path.join(OUT, 'records.json')).records;
  const byId = new Map(records.map(r => [r.id, r]));
  const topI = args.indexOf('--top');
  const ids = topI >= 0 ? readJson(path.join(OUT, 'queue.json')).queue.slice(0, Number(args[topI + 1]) || 5).map(q => q.id) : args.filter(a => !a.startsWith('--'));
  for (const id of ids) {
    const rec = byId.get(id);
    if (!rec) { console.error(`no record ${id}`); process.exitCode = 1; continue; }
    const ttl = renderDraft(rec);
    if (args.includes('--write')) {
      const f = path.join(HERE, 'nanopubs/unsigned', `leanbio-${slug(id)}.trig`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, ttl);
      console.log(`wrote ${path.relative(ROOT, f).replace(/\\/g, '/')}`);
    } else process.stdout.write(ttl);
  }
}
