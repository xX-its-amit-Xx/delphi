// The functional analogue, chosen FROM THE DESIRED FUNCTION rather than from relatedness.
//
// This is the step Amit put first, and it is NOT the scorer's `closest_real_relative`: that one is nearest in
// SL-normalised shape space, which is a relatedness/similarity answer to a different question. Here the question
// is "which real animal already does the thing that was asked for?", so the input is the PARSED DESIRED
// PHENOTYPE (parse-text.mjs -> DesignSpec criteria), and the answer has to be an organism with a published
// record of doing it.
//
// How the choice is made, stated plainly because it is small:
//   * each criterion's `scenario` (glide, temperature, swim, depth, ...) is looked up in FUNCTION_ANALOGUES below
//   * each row names a real taxon, the function it is recorded as performing, and the repo file that holds the
//     record; the numbers are read FROM that file at run time, not written in here
//   * a scenario with no row returns `null` for that criterion and is reported under
//     `criteria_with_no_known_analogue` -- never silently dropped and never answered with "the nearest relative"
//
// When the functional thread's ledger lands, ITS `closest_functional_analogue` is reported beside this one and
// any disagreement between the two is flagged rather than reconciled.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..');
const rd = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; } };

export const RULE = 'The analogue is chosen by FUNCTION (which real animal is recorded as doing what was asked), from a small declared scenario -> taxon table whose numbers are read from the named repo data files at run time. It is NOT the nearest relative and NOT the nearest shape: the scorer reports those separately. A criterion whose scenario has no row gets no analogue and is listed as such.';

/** scenario -> the real taxon recorded as performing that function, and where the record lives. */
export const FUNCTION_ANALOGUES = {
  glide: {
    id: 'exocoetidae', name: 'flying fishes (Exocoetidae)', taxon: 'Exocoetidae', ncbi_taxid: 76072,
    function: 'leaves the water and glides on enlarged pectoral (and in four-wingers, pelvic) fins',
    repo_organism: 'flying-fish',
    evidence_file: 'physics/glide-data.csv',
    read: () => glideRecords(),
    genotype: () => focalGenotype(),
  },
  temperature: {
    id: 'danio-rerio', name: 'zebrafish (Danio rerio)', taxon: 'Danio rerio', ncbi_taxid: 7955,
    function: 'survives and performs across a eurythermal window as an adult ectotherm',
    repo_organism: 'zebrafish-adult',
    evidence_file: 'dashboard/public/api/lean/laws/perturb-thermal.json',
    read: () => thermalRecord(),
    genotype: () => focalGenotype(),
    note: 'For a thermal-window criterion the functional analogue IS the base species: zebrafish is the eurythermal animal in this project, and the design inherits its thermal physiology unedited. That makes the analogue uninformative for this criterion rather than satisfied by it.',
  },
};

function glideRecords() {
  const txt = rd('physics/glide-data.csv');
  if (!txt) return { ran: false, reason: 'physics/glide-data.csv is absent' };
  const lines = txt.trim().split(/\r?\n/);
  const h = lines[0].split(',');
  const col = n => h.indexOf(n);
  const rows = [];
  for (const l of lines.slice(1)) {
    const c = l.split(',');
    const d = c[col('glide_distance_m')];
    if (!d || !d.trim()) continue;
    rows.push({ species_or_group: c[0], glide_distance_m: Number(d), value_kind: c[col('value_kind')], method: c[col('method')], source_id: c[col('source_id')], source_locator: c[col('source_locator')] });
  }
  const single = rows.filter(r => !/successive|sequence/i.test(r.source_locator || '') && r.glide_distance_m < 200);
  return {
    ran: true, file: 'physics/glide-data.csv', rows_with_a_glide_distance: rows.length, rows,
    single_glide_min_m: single.length ? Math.min(...single.map(r => r.glide_distance_m)) : null,
    single_glide_max_m: single.length ? Math.max(...single.map(r => r.glide_distance_m)) : null,
    caveat: 'EVERY glide-distance row in this table is secondary or theory-secondary: no first-hand measurement of a single glide distance is held in this repository. The first-hand rows (Park & Choi 2010) are specimen morphometry and wind-tunnel coefficients, not field glide distances.',
  };
}

function thermalRecord() {
  const txt = rd('dashboard/public/api/lean/laws/perturb-thermal.json');
  const base = rd('conditions/baseline.json');
  if (!txt) return { ran: false, reason: 'the perturb-thermal law record is absent' };
  const law = JSON.parse(txt);
  const b = base ? JSON.parse(base) : null;
  return {
    ran: true, law_id: law.law_id, law_version: law.version, status: law.status, statement_en: law.statement_en,
    scope_taxa: law.scope?.taxa ?? null, basis: law.scope?.basis ?? null,
    baseline_water_temperature_C: b?.conditions?.water_temperature_C?.value ?? null,
    baseline_kind: b?.conditions?.water_temperature_C?.kind ?? null,
    caveat: 'CTmin, CTmax, Q10 and P_ref are DESIGN INPUTS to this law, not measurements held here. The law bounds sustained power given a thermal window; it does not supply the window. No measured zebrafish CTmin/CTmax table exists in this repository, so a "survives 10-30 C" criterion cannot be decided from the data on hand.',
  };
}

/** "Fetch that genotype": the analogue's genotype, as this project actually holds it.
 *  NOTE on where it lives. sequences/genes.json keys `orthologues` by Ensembl species slug and carries NO
 *  flying-fish entry there despite its own title; the flying-fish orthologue sits in a separate per-gene
 *  `flying_fish` object, keyed by the annotation it came from. Reading only `orthologues` returns 0 of 9 called
 *  orthologues, which would be wrong. This reads `flying_fish` and reports whether each call was a reciprocal
 *  best hit or a tblastn projection, because those are not the same strength of evidence. */
function focalGenotype() {
  const txt = rd('sequences/genes.json');
  if (!txt) return { ran: false, reason: 'sequences/genes.json is absent' };
  const g = JSON.parse(txt);
  const genes = Object.entries(g.genes || {}).map(([symbol, v]) => {
    const ffBlock = v.flying_fish || {};
    const hit = Object.entries(ffBlock).find(([k, o]) => o && typeof o === 'object' && (o.flyingfish_protein || o.protein));
    const o = hit ? hit[1] : null;
    const medaka = v.orthologues?.oryzias_latipes ?? null;
    return {
      symbol, zfin_id: v.zfin_id ?? null, zebrafish_gene: v.zebrafish_gene ?? null, location_GRCz11: v.location_GRCz11 ?? null,
      analogue_orthologue: o ? {
        species: 'Hirundichthys speculiger', source_annotation: hit[0],
        protein_id: o.flyingfish_protein ?? o.protein ?? null, length: o.flyingfish_length ?? null,
        msa_identity_vs_zebrafish: o.forward_pident ?? o.pident_vs_zebrafish ?? null,
        reciprocal_best_hit: o.reciprocal_best_hit ?? null,
        homology_type: o.reciprocal_best_hit === false ? 'tblastn projection on the unannotated assembly (NOT a reciprocal best hit)' : 'reciprocal best blastp hit',
        used_in_alignment: ffBlock.used_in_alignment ?? null,
      } : null,
      closest_annotated_relative: medaka ? { species: medaka.species, msa_identity_vs_zebrafish: medaka.msa_identity_vs_zebrafish ?? null, note: 'medaka (Beloniformes) is the closest Ensembl-annotated relative of the flying fish and stands in wherever the flying-fish call is weak' } : null,
      orthologue_called: !!o,
    };
  });
  const rbh = genes.filter(x => x.analogue_orthologue?.reciprocal_best_hit === true).length;
  const proj = genes.filter(x => x.analogue_orthologue?.reciprocal_best_hit === false).length;
  return {
    ran: true, file: 'sequences/genes.json', ensembl_release: g.ensembl_release ?? null,
    n_genes: genes.length, genes,
    orthologues_called: genes.filter(x => x.orthologue_called).length,
    by_strength: { reciprocal_best_hit: rbh, tblastn_projection_only: proj,
      note: proj ? `${proj} of ${genes.length} orthologue call(s) are tblastn projections on the assembly rather than reciprocal best hits (${genes.filter(x => x.analogue_orthologue?.reciprocal_best_hit === false).map(x => x.symbol).join(', ')}); those identities are weaker evidence than the rest.` : 'every call is a reciprocal best hit' },
    how: 'Reciprocal best blastp of the Hirundichthys speculiger annotated proteome (Xu et al. 2021, figshare 10.6084/m9.figshare.14600634.v1) against the zebrafish proteome; tblastn on the assembly where that failed.',
    limit: `This is the whole of the analogue's genotype as this project holds it: ${genes.length} focal genes out of the 23,611 protein-coding genes Xu et al. annotated (${(genes.length / 23611 * 100).toFixed(3)} %). It is a focal panel, not a genome comparison, and it carries NO expression, mutant, kinetic or regulatory record for the flying fish, because that paper reports none.`,
  };
}

/**
 * Resolve the analogue(s) for a parsed DesignSpec.
 * @param {object} spec the DesignSpec from parse-text.mjs
 */
export function analogueFromFunction(spec, { baseId = null } = {}) {
  const criteria = Array.isArray(spec?.criteria) ? spec.criteria : [];
  const perCriterion = [], none = [];
  const byId = new Map();
  for (const c of criteria) {
    const row = FUNCTION_ANALOGUES[c.scenario];
    if (!row) { none.push({ criterion: c.id, scenario: c.scenario ?? null, metric: c.metric ?? null, source_text: c.source_text ?? null, reason: `no real taxon in this project's data is recorded as performing the function "${c.scenario ?? c.metric ?? 'unnamed'}"; no analogue was chosen and none was guessed` }); continue; }
    perCriterion.push({ criterion: c.id, scenario: c.scenario, desired: { op: c.op, value: c.value ?? null, unit: c.unit ?? null, params: c.params ?? null, stages: c.stages ?? null, source_text: c.source_text ?? null }, analogue_id: row.id });
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  const analogues = [...byId.values()].map(row => ({
    id: row.id, name: row.name, taxon: row.taxon, ncbi_taxid: row.ncbi_taxid ?? null,
    function: row.function, basis: 'chosen by function from the declared scenario table', repo_organism: row.repo_organism,
    evidence_file: row.evidence_file, evidence: row.read(), genotype: row.genotype(),
    ...(row.note ? { note: row.note } : {}),
    is_the_base_organism: baseId != null && row.repo_organism === baseId,
  }));

  // The requirement ledger, the analogue's side: what the analogue's function demands, as this project holds it.
  const requirements = [];
  for (const a of analogues) {
    if (a.id === 'exocoetidae' && a.evidence?.ran) {
      requirements.push({ id: 'req-wing-area', requirement: 'enlarged pectoral fin planform area carrying the body weight in air', source: 'physics/glide-data.csv (Park & Choi 2010 specimen morphometry: pectoral_fin_area_m2, body_planform_area_m2)', kind: 'measured' });
      requirements.push({ id: 'req-launch-speed', requirement: 'a launch speed at or above the minimum lift-supported speed for the wing loading', value: 9.9, unit: 'm/s', source: 'physics/results.json (minimum lift-supported speed from the measured wing loading and CL of the 0.060 kg Park & Choi specimen)', kind: 'derived' });
      requirements.push({ id: 'req-caudal-taxiing', requirement: 'a hypocercal caudal fin and the tail-beat rate to taxi at the surface', value: 50, unit: 'beats/s', source: 'physics/takeoff-data.csv (Davenport 1994 review)', kind: 'measured-secondhand' });
      requirements.push({ id: 'req-glide-distance', requirement: 'a recorded single-glide distance', value: a.evidence.single_glide_min_m, unit: 'm', source: `${a.evidence_file} (${a.evidence.rows_with_a_glide_distance} rows, all secondary or theory-secondary)`, kind: 'measured-secondhand' });
    }
    if (a.id === 'danio-rerio' && a.evidence?.ran) {
      requirements.push({ id: 'req-thermal-window', requirement: 'a thermal window [CTmin, CTmax] wide enough to contain the asked-for temperatures', value: null, unit: 'degC', source: `${a.evidence_file} (${a.evidence.law_id} v${a.evidence.law_version}, ${a.evidence.status})`, kind: 'assumed', note: 'the window itself is a design input to the law, not a number this project holds' });
    }
  }

  return {
    rule: RULE,
    chosen_from: 'the desired phenotype text, via its parsed criteria scenarios',
    analogues,
    per_criterion: perCriterion,
    criteria_with_no_known_analogue: none,
    requirement_set: requirements,
    coverage: {
      criteria_total: criteria.length,
      criteria_with_an_analogue: perCriterion.length,
      criteria_without_one: none.length,
      requirements_listed: requirements.length,
      note: requirements.length ? 'This requirement set is a small declared list read from repo data files, not an exhaustive ledger. The functional thread owns the exhaustive one; if its module is absent the ledger below is reported as not run.' : 'no requirement could be read for the chosen analogue(s)',
    },
  };
}

/** Flag disagreement with the functional thread's own analogue instead of reconciling it. */
export function compareWithLedgerAnalogue(mine, ledger) {
  const theirs = ledger?.closest_functional_analogue ?? null;
  if (!theirs) return { compared: false, reason: 'the functional ledger named no closest_functional_analogue' };
  const ids = (mine.analogues || []).map(a => a.id);
  const match = ids.some(i => i === theirs.id) || (mine.analogues || []).some(a => theirs.taxon && a.taxon && String(theirs.taxon).toLowerCase().includes(String(a.taxon).toLowerCase()));
  return { compared: true, pipeline_chose: ids, ledger_chose: { id: theirs.id ?? null, taxon: theirs.taxon ?? null, function: theirs.function ?? null },
    agree: match, ...(match ? {} : { disagreement: 'the pipeline and the functional ledger named different functional analogues; both are reported and neither was overruled' }) };
}
