// resolve.mjs - THE HEART. For every difference between the DESIGN and the analogue's requirement set, classify
// the resolution on an explicit ladder, each class carrying its own evidence and a distinct label.
//
//   SAME           same gene, same functional state.
//   ALLELIC        same gene, different allele/residue - and that state exists in a real organism.
//   PARALOGUE      the required gene is absent/unedited but a paralogue could carry the function, WITH evidence
//                  that it does: expression in the right tissue and stage, domain retention, a documented rescue.
//                  Never merely "a paralogue exists".
//   ANALOGOUS_SET  a different gene set plausibly delivers the same function, evidenced through a shared pathway,
//                  GO term or domain (the omics pathway crosswalk, read through the gene cards).
//   COMPENSATORY   a documented compensation mechanism applies, by RULE (functional/compensation.mjs) rather than
//                  by hope. Scored only where a compensation classifier reports it DOCUMENTED with functional
//                  rescue; "plausible by rule" is an UNMET requirement with a review flag, never a resolution.
//   UNRESOLVED     nothing accounts for it. Loud, counted, listed gene by gene.
//
// HARD RULE, enforced in code: "could be compensated" is a HYPOTHESIS, not evidence. Every class above UNRESOLVED
// carries its evidence and the evidence's kind (measured / curated / inferred-electronic / borrowed-ortholog /
// predicted / assumed), and a row that cannot show the function is preserved is marked hypothesis: true. The
// caller's interface (validate/functional-interface.mjs) then reports demonstrated and hypothesised resolutions as
// two numbers that are never summed.
//
// WHY ALLELIC IS ALWAYS A HYPOTHESIS HERE. validate/functional-interface.mjs states the constraint plainly: the
// genotype_similarity fields it exposes are SEQUENCE-LEVEL STATES. "This residue exists in a real organism" is
// sound; "therefore the function is preserved" is not, because this project has no model that predicts a phenotype
// from a residue and its own design validation failed. So an ALLELIC row is hypothesis: true unless a documented
// functional assay or rescue of THAT state is cited.
import { canonicalSymbol } from './designs.mjs';
import * as C from './cards.mjs';
import { compensationApplies, RULE_SUMMARY, PAPERS } from './compensation.mjs';

export const LADDER = ['SAME', 'ALLELIC', 'PARALOGUE', 'ANALOGOUS_SET', 'COMPENSATORY', 'UNRESOLVED'];

/** Load the compensation thread's validated classifier if it has landed. Never throws, never guesses. */
let _comp = null;
export async function compensationClassifier() {
  if (_comp !== null) return _comp;
  for (const p of ['./compensation/classify.mjs', '../compensation/classify.mjs']) {
    try { const m = await import(p); if (typeof m.compensationVerdict === 'function') return (_comp = { ok: true, fn: m.compensationVerdict, from: p }); } catch { /* not landed */ }
  }
  return (_comp = { ok: false, from: null,
    reason: 'the validated compensation classifier (compensation/classify.mjs compensationVerdict) has not landed; '
      + 'functional/compensation.mjs supplies the evidenced rule table instead, and because that table can only ever '
      + 'reach "plausible by rule" - never "documented with functional rescue" - NO row is scored COMPENSATORY while '
      + 'the classifier is absent. The rule\'s refusals are still used, since a refusal cannot inflate a resolution.' });
}

/** The hub's scoring rule for a classifier verdict. Only a documented verdict WITH functional rescue counts. */
export function scoreCompensationVerdict(v) {
  if (!v) return { counts: false, why: 'no verdict' };
  const cls = String(v.class || '').toLowerCase();
  if (cls === 'documented' && v.functional_rescue === true) {
    return { counts: true, why: 'documented compensation WITH functional rescue', r07: v.r07_applies ?? null };
  }
  if (cls === 'documented') {
    return { counts: false, flag: 'review',
      why: 'DOCUMENTED but functional_rescue is not true. Compensation at the transcript or protein level is not rescue '
        + 'of the organism: vegfaa is a founding example of genetic compensation and still has severe vascular phenotypes '
        + 'across 22 publications; titin\'s paralogue rose 2.55-fold at protein level and the fish were still paralysed by '
        + '3 dpf. So this does NOT meet the requirement.' };
  }
  if (cls === 'plausible-by-rule') {
    return { counts: false, flag: 'review',
      why: 'PLAUSIBLE BY RULE is not scored. On the 13 retrospective cases independent of the papers the rules came from, '
        + 'the rule was right 4 of 13 and ALL NINE errors were FALSE POSITIVES - it predicted compensation where '
        + 'experimenters looked and found none (11 of 12 on cases drawn from its own source papers). That gap is exactly '
        + 'the "a hypothesis pays for a gap" failure the ladder exists to prevent.' };
  }
  if (cls === 'not-expected') return { counts: false, trusted: true, why: 'NOT EXPECTED, and refusals are the reliable direction of this rule (4 true negatives, 1 false negative). The requirement stays unmet.' };
  return { counts: false, why: `"${v.class}" is not scored as a pass. On real omics inputs the classifier returns "unknown" for 24 of 40 rows because our transcriptomic layer rarely has tissue-and-stage expression for a candidate compensator. That abstention is correct behaviour and is never turned into assent.` };
}

const ev = (claim, source, kind) => ({ claim, source, kind });

/** Does any edit in the design touch this requirement's gene? */
function editsOn(genotype, symbol) {
  if (!symbol) return [];
  const s = canonicalSymbol(symbol);
  return (genotype.edits || []).filter(e => canonicalSymbol(e.gene) === s);
}

// ---------------------------------------------------------------- PARALOGUE
/** PARALOGUE needs all of: a documented paralogue, expression in the right context, and domain retention.
 *  Anything less is refused and the reason is returned, so the row falls through to UNRESOLVED with that reason
 *  attached rather than being quietly upgraded. */
export function paralogueResolution(symbol, { anatomyLabel = 'fin' } = {}) {
  const paras = C.paralogues(symbol);
  if (!paras.length) return { applies: false, refusal: `no paralogue of ${symbol} is recorded in omics/genomic (Ensembl/ZFIN paralog rows)`, candidates: [] };
  const assessed = [];
  for (const p of paras) {
    if (!C.hasCard(p.symbol)) { assessed.push({ symbol: p.symbol, refused: `${p.symbol} has no omics card, so no expression or domain evidence can be read for it` }); continue; }
    const expr = C.finExpression(p.symbol);
    const dom = C.sharedDomains(symbol, p.symbol);
    if (!expr) { assessed.push({ symbol: p.symbol, refused: `no expression record places ${p.symbol} in any ${anatomyLabel} structure (omics/transcriptomic expressed_in)`, shared_domains: dom.length }); continue; }
    if (!dom.length) { assessed.push({ symbol: p.symbol, refused: `${p.symbol} is expressed in ${expr.where} but shares NO annotated domain, family or superfamily with ${symbol}, so there is no evidence it retains the molecular function`, expression: expr.where }); continue; }
    assessed.push({ symbol: p.symbol, qualifies: true, expression: expr, shared_domains: dom });
  }
  const ok = assessed.find(a => a.qualifies);
  if (!ok) {
    return { applies: false, candidates: assessed,
      refusal: `${paras.length} paralogue(s) of ${symbol} exist, and NONE carries the evidence the class requires `
        + `(expression in a ${anatomyLabel} structure AND a shared domain). "A paralogue exists" is not a resolution: `
        + `${assessed.map(a => `${a.symbol}: ${a.refused}`).join('; ')}` };
  }
  return {
    applies: true, paralogue: ok.symbol, candidates: assessed,
    evidence: [
      ev(`${ok.symbol} is a documented paralogue of ${symbol}`, C.paralogues(symbol).find(p => p.symbol === ok.symbol)?.source || 'omics/genomic paralog rows', C.paralogues(symbol).find(p => p.symbol === ok.symbol)?.kind || 'inferred-electronic'),
      ev(`${ok.symbol} is expressed in ${ok.expression.where} (stages: ${[...new Set(ok.expression.records.flatMap(r => r.stages))].join(', ') || 'not stated'})`, ok.expression.records[0].source, ok.expression.records[0].kind),
      ev(`${ok.symbol} and ${symbol} share ${ok.shared_domains.length} annotated domain/family term(s): ${ok.shared_domains.slice(0, 3).map(d => `${d.term} (${d.id})`).join('; ')}`, ok.shared_domains[0].a_source, ok.shared_domains[0].kind),
    ],
    documented_rescue: null,
    hypothesis: true,
    hypothesis_why: 'expression plus domain retention makes the paralogue a CANDIDATE to carry the function. No rescue experiment in our sources shows that it does, so the resolution is hypothesised, not demonstrated.',
  };
}

// ---------------------------------------------------------------- ANALOGOUS SET
/** Amit's "entirely different, analogous set of genes": do the genes the design DOES edit share a pathway, GO term
 *  or domain with the required gene? Evidence is the shared term with its id, database and kind. */
export function analogousSetResolution(symbol, genotype) {
  const edited = [...new Set((genotype.edits || []).map(e => canonicalSymbol(e.gene)))].filter(g => g && g !== canonicalSymbol(symbol));
  if (!edited.length) return { applies: false, refusal: 'the design edits no other gene, so there is no alternative set to deliver the function' };
  if (!C.hasCard(symbol)) return { applies: false, refusal: `${symbol} has no omics card, so no pathway, GO or domain term can be read for it` };
  const hits = [];
  for (const g of edited) {
    if (!C.hasCard(g)) { hits.push({ gene: g, refused: `${g} has no omics card` }); continue; }
    const pw = C.sharedPathwayTerms(symbol, g), dm = C.sharedDomains(symbol, g);
    if (!pw.length && !dm.length) { hits.push({ gene: g, refused: `${g} shares no pathway, GO term or domain with ${symbol}` }); continue; }
    hits.push({ gene: g, shared_pathway_terms: pw, shared_domains: dm });
  }
  const ok = hits.filter(h => !h.refused);
  if (!ok.length) return { applies: false, candidates: hits, refusal: `none of the design's edited genes (${edited.join(', ')}) shares a pathway, GO term or domain with ${symbol}: ${hits.map(h => h.refused).join('; ')}` };
  const best = ok.sort((a, b) => (b.shared_pathway_terms.length + b.shared_domains.length) - (a.shared_pathway_terms.length + a.shared_domains.length))[0];
  const terms = [...best.shared_pathway_terms, ...best.shared_domains];
  return {
    applies: true, genes: ok.map(h => h.gene), candidates: hits,
    evidence: [
      ev(`the design edits ${best.gene}, which shares ${terms.length} annotated term(s) with the required gene ${symbol}: ${terms.slice(0, 4).map(t => `${t.term}${t.id ? ` (${t.id})` : ''}`).join('; ')}`, terms[0].a_source, terms[0].kind),
      ev(`shared membership comes from the omics pathway crosswalk (GO / Reactome / WikiPathways) as built in omics/pathway/ and read through the gene cards`, 'omics/pathway/pathway-crosswalk.json; omics/index/genes/*.json.gz', 'curated'),
    ],
    hypothesis: true,
    hypothesis_why:
      'Shared pathway or domain membership is real, cited evidence that two genes act in the same process. That the '
      + 'edited set DELIVERS the required function is a different claim, and no experiment in our sources tests it. '
      + 'This project\'s own pre-registered design validation matched the real mutant at 1 of 74 loci, so a '
      + 'same-pathway argument is exactly the kind of inference it found wanting. Hypothesis, not demonstration.',
  };
}

// ---------------------------------------------------------------- the ladder
/** Classify ONE assessable requirement. Returns a ledger row in the shape validate/functional-interface.mjs wants. */
export async function resolveOne(req, genotype, { direction = 'ADDITION' } = {}) {
  const symbol = req.zebrafish?.symbol || null;
  const gene = symbol || req.locus?.source_symbol || null;
  const edits = editsOn(genotype, symbol);
  const comp = await compensationClassifier();
  const row = { id: req.id, gene, component: req.level, difference: null, class: 'UNRESOLVED', evidence: [], kind: null, hypothesis: false,
    requirement: req.requirement, search_depth: req.search_depth, direction };
  const push = (...e) => row.evidence.push(...e);
  const weakest = () => { const order = ['assumed', 'predicted', 'borrowed-ortholog', 'inferred-electronic', 'curated', 'measured']; const ks = row.evidence.map(e => e.kind).filter(Boolean); return order.find(k => ks.includes(k)) || null; };

  const need = req.level === 'residue' ? `${req.locus.alt}${req.locus.pos}` : 'a rate shift';
  const analogueEv = ev(
    req.level === 'residue'
      ? `the analogue carries ${req.locus.alt} at ${req.locus.source_symbol} position ${req.locus.pos} in ${req.analogue_state.n_carrying_derived} of ${req.analogue_state.n_with_data} Exocoetidae species with data (${req.analogue_state.gliding_halfbeak_carrying_derived} of 2 gliding halfbeaks also carry it)`
      : req.requirement,
    req.source, req.kind);

  // ---- SAME: the design already carries the required state.
  if (req.design_residue?.read && req.design_residue.carries_derived_state === true) {
    row.class = 'SAME';
    row.difference = `none at the residue level: the zebrafish reference already carries ${req.locus.alt} at the homologous site (position ${req.design_residue.position})`;
    push(analogueEv,
      ev(`the design's base protein carries ${req.design_residue.residue} at the column aligned to ${req.locus.source_symbol} ${req.locus.pos}, which IS the analogue's derived state. Read by global alignment at ${req.design_residue.percent_identity} % identity, local window identity ${req.design_residue.local_window.identity}`, 'functional/data/design-residues.json (functional/scripts/read-design-residues.mjs)', 'measured'),
      ev('so this requirement is met ancestrally, not by the design. Sheet G is built from substitutions absent in the beloniform OUTGROUPS, and zebrafish is not in that panel, which is why the state had to be read rather than assumed to differ', 'sequences/progression.json read_this_first[1]', 'curated'));
    row.kind = weakest();
    return row;
  }

  // ---- the design edits this very gene
  if (edits.length) {
    const e = edits[0];
    const sameSite = req.level === 'residue' && e.pos === req.locus.pos;
    const sameState = sameSite && e.alt === req.locus.alt;
    if (sameState) {
      row.class = 'SAME';
      row.difference = `none: the design's edit ${e.raw} puts the analogue's own derived state at the required site`;
      push(analogueEv, ev(`the design carries ${e.raw} on ${gene} (${e.allele || 'no named allele'}; zygosity ${e.zygosity || 'unstated'})`, e.source, e.kind_of_evidence || 'curated'));
      if (/HYPOTHETICAL|never engineered/i.test(e.note || '')) { row.hypothesis = true; row.hypothesis_why = e.note; }
      row.kind = weakest();
      return row;
    }
    row.class = 'ALLELIC';
    row.difference = req.level === 'residue'
      ? `same gene, DIFFERENT state: the requirement is ${req.locus.ref}${req.locus.pos}${req.locus.alt} and the design carries ${e.raw}${sameSite ? ' at the same position but a different residue' : ` at position ${e.pos ?? 'n/a'}, a different site`}`
      : `the design edits ${gene}, but the requirement is a gene-level rate shift with no state to match`;
    push(analogueEv,
      ev(`the design carries ${e.raw} on ${gene} (${e.allele || 'no named allele'}; ${e.kind}; zygosity ${e.zygosity || 'unstated'})`, e.source, e.kind_of_evidence || 'curated'),
      ev(`the design's state is NOT the analogue's state: ${sameSite ? 'same position, different residue' : 'a different position in the same protein'}`, 'sequences/engineered-diff.json; functional/data/analogue-requirements.json', 'measured'));
    if (e.allele) push(ev(`${e.allele} is a real, documented allele, so the design's state exists in a real organism`, e.source, 'curated'));
    row.hypothesis = true;
    row.hypothesis_why =
      'ALLELIC is sound as "this difference is an allele that occurs in a real organism" and UNSOUND as "this '
      + 'difference is functionally neutral" (validate/functional-interface.mjs). No experiment in our sources shows '
      + `that ${e.raw} produces the same functional state as ${req.level === 'residue' ? `${req.locus.ref}${req.locus.pos}${req.locus.alt}` : 'the requirement'}, so the resolution is hypothesised. `
      + 'design-validation/REPORT.md records the same fact as a pre-registered result: the design "does not reproduce the flying fish\'s substitution; it changes a different position in the same transporter".';
    row.kind = weakest();
    return row;
  }

  // ---- the gene is not edited: a real difference. Search the ladder for a resolution, with evidence.
  row.difference = req.level === 'residue'
    ? `the design does not carry ${need} at ${gene}: the locus is not edited, and the design's base residue ${req.design_residue?.read ? `is ${req.design_residue.residue}, not ${req.locus.alt}` : 'at the homologous site was NOT READ'}`
    : `the design does nothing at ${gene}, and the requirement is a gene-level rate shift that no single edit could satisfy anyway`;
  push(analogueEv);
  if (req.design_residue?.read) push(ev(`the design's base carries ${req.design_residue.residue} at the aligned column (window identity ${req.design_residue.local_window.identity})`, 'functional/data/design-residues.json', 'measured'));
  else if (req.design_residue) push(ev(`the design's residue at this site could not be read: ${req.design_residue.why_not_read}. The difference is therefore asserted at GENE level (the design does not edit this locus), not at residue level`, 'functional/data/design-residues.json', 'inferred-electronic'));
  if (req.search_depth !== 'full') {
    push(ev(req.search_depth_note || 'no resolution search was possible for this locus', 'functional/requirements.mjs search_depth', 'curated'));
    row.unresolved_caveat = 'this UNRESOLVED is the absence of a SEARCH, not the absence of a resolution';
    row.kind = weakest();
    return row;
  }

  // PARALOGUE
  const par = paralogueResolution(symbol);
  if (par.applies) {
    row.class = 'PARALOGUE'; push(...par.evidence);
    row.hypothesis = true; row.hypothesis_why = par.hypothesis_why; row.paralogue = par.paralogue; row.kind = weakest();
    return row;
  }
  row.paralogue_refused = par.refusal;

  // ANALOGOUS SET
  const an = analogousSetResolution(symbol, genotype);
  if (an.applies) {
    row.class = 'ANALOGOUS_SET'; push(...an.evidence);
    row.hypothesis = true; row.hypothesis_why = an.hypothesis_why; row.analogous_genes = an.genes; row.kind = weakest();
    return row;
  }
  row.analogous_set_refused = an.refusal;

  // COMPENSATORY - by rule, and only where a validated classifier says documented WITH functional rescue.
  const lesion = edits[0] || null;
  if (comp.ok) {
    let v = null;
    try { v = await comp.fn({ gene: symbol, lesion, requirement: req.requirement, paralogues: C.paralogues(symbol) }); } catch (err) { row.compensation_error = err.message; }
    const s = scoreCompensationVerdict(v);
    row.compensation = { classifier: comp.from, verdict: v?.class ?? null, functional_rescue: v?.functional_rescue ?? null, r07_applies: v?.r07_applies ?? null, scored: s };
    if (s.counts) {
      row.class = 'COMPENSATORY'; row.hypothesis = true;
      push(ev(`a documented compensation mechanism with functional rescue applies at ${symbol}`, `compensation classifier (${comp.from})`, 'curated'),
        ev(RULE_SUMMARY, 'functional/compensation.mjs RULE_SUMMARY', 'curated'));
      row.hypothesis_why = 'COMPENSATORY is a hypothesis by definition in validate/functional-interface.mjs: it is a claim about a mechanism nobody observed in THIS design.';
      row.kind = weakest();
      return row;
    }
    if (s.flag === 'review') row.review_flag = s.why;
    push(ev(`compensation was tested and NOT scored: ${s.why}`, `compensation classifier (${comp.from})`, 'curated'));
  } else {
    const r = compensationApplies({ requirementGene: symbol, lesion, similarGene: null, expression: null });
    row.compensation = { classifier: null, classifier_absent: comp.reason, rule_applied: 'functional/compensation.mjs compensationApplies()', applies: r.applies, refusal: r.refusal };
    push(...r.evidence, ev(`compensation REFUSED by rule: ${r.refusal}`, `functional/compensation.mjs (${Object.values(PAPERS).length} papers, Europe PMC)`, 'curated'));
  }

  row.class = 'UNRESOLVED';
  row.kind = weakest();
  return row;
}

/** Classify every assessable requirement. Unassessable ones are NOT turned into ledger rows: counting our own
 *  ignorance as the design's failure would be as dishonest as hiding it. They are reported in coverage. */
export async function resolveAll(reqSet) {
  const rows = [];
  for (const r of reqSet.requirements) if (r.assessable) rows.push(await resolveOne(r, reqSet.genotype, { direction: reqSet.direction }));
  return rows;
}
