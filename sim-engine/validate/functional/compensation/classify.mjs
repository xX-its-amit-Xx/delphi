/**
 * compensation/classify.mjs
 *
 * Decide BY RULE whether a documented compensation mechanism can be invoked for a gene
 * that is absent or broken in a designed organism.
 *
 * The default is refusal. A gap only ever becomes COMPENSATORY when a rule fires and names
 * its source. Missing inputs yield 'unknown', never 'plausible-by-rule'.
 *
 * Rules and their evidence:  ./compensation-rules.json
 * Case table (both directions): ./compensation-cases.json
 * Prose, validation and limits: ./COMPENSATION.md
 *
 * Primary export:
 *   compensationVerdict({gene, alleleKind, paralogues, expression, pathway, omicsCard}) ->
 *     {class, rule_id, evidence[], kind, why, ...}
 *
 * class is one of 'documented' | 'plausible-by-rule' | 'not-expected' | 'unknown'.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const RULES = JSON.parse(fs.readFileSync(path.join(HERE, 'compensation-rules.json'), 'utf8'));
const CASES = JSON.parse(fs.readFileSync(path.join(HERE, 'compensation-cases.json'), 'utf8'));

export const CLASSES = ['documented', 'plausible-by-rule', 'not-expected', 'unknown'];

/** Priors on how often a compensation response is actually observed. Quoted, not invented. */
export const PRIORS = {
  paralogue_upregulation_after_knockout: {
    value: 16 / 74,
    as_fraction: '16 / 74 = 0.216',
    src: 'mellis2024',
    locator: 'Results; Fig. 1C,D',
    caveat: 'human and mouse, not zebrafish'
  },
  paralogous_pairs_showing_adaptation: {
    strict: '1 / 439',
    relaxed: '156 / 439 = 0.355',
    src: 'elbrolosy2026',
    locator: 'Discussion / note on paralogous pairs',
    caveat: 'human K562 cells; the authors disbelieve most of the relaxed set. The true value is not known.'
  },
  zebrafish_disruptive_alleles_with_no_phenotype: {
    value: 1065 / 1216,
    as_fraction: '1065 / 1216 = 0.876',
    src: 'kettleborough2013',
    locator: 'Results',
    caveat: 'The same paper explicitly declines to attribute that silence to paralogue redundancy.'
  }
};

// ---------------------------------------------------------------------------
// Allele-kind resolution
// ---------------------------------------------------------------------------

const ALLELE_KINDS = RULES.allele_kinds;

const ALIAS_TO_KIND = (() => {
  const m = new Map();
  for (const [kind, spec] of Object.entries(ALLELE_KINDS)) {
    if (kind === 'comment') continue;
    m.set(norm(kind), kind);
    for (const a of spec.aliases || []) m.set(norm(a), kind);
  }
  return m;
})();

function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/[\s_]+/g, '-');
}

/**
 * Resolve a caller's allele description onto the mRNA-fate vocabulary the rules test.
 * Returns {kind, spec} or null when it cannot be resolved -- which routes to R10, not to a guess.
 */
export function resolveAlleleKind(alleleKind) {
  const k = norm(alleleKind);
  if (!k || k === 'unknown' || k === 'null' || k === 'undefined') return null;
  const hit = ALIAS_TO_KIND.get(k);
  if (hit) return { kind: hit, spec: ALLELE_KINDS[hit] };
  // One deliberate, narrow bit of leniency: a caller may pass e.g. 'nonsense-ptc' or
  // 'frameshift_del'. Match on a known kind appearing as a whole hyphen-delimited token.
  const tokens = new Set(k.split('-'));
  for (const [alias, kind] of ALIAS_TO_KIND) {
    if (!alias.includes('-') && tokens.has(alias)) return { kind, spec: ALLELE_KINDS[kind], loose: true };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Evidence helpers
// ---------------------------------------------------------------------------

function ruleById(id) {
  return RULES.rules.find(r => r.rule_id === id);
}

/** Build the evidence[] array for a rule, resolving each source id to its citation. */
function evidenceFor(ruleId, extra = []) {
  const r = ruleById(ruleId);
  const out = [];
  for (const s of (r?.sources || [])) {
    const src = RULES.sources[s.src];
    out.push({
      src: s.src,
      citation: src?.citation ?? '(source id not found)',
      pmid: src?.pmid ?? null,
      pmcid: src?.pmcid ?? null,
      doi: src?.doi ?? null,
      locator: s.locator ?? null,
      quote: s.quote ?? null
    });
  }
  for (const e of extra) {
    const src = RULES.sources[e.src];
    out.push({
      src: e.src,
      citation: src?.citation ?? '(source id not found)',
      pmid: src?.pmid ?? null,
      pmcid: src?.pmcid ?? null,
      doi: src?.doi ?? null,
      locator: e.locator ?? null,
      quote: e.quote ?? null
    });
  }
  return out;
}

function counterEvidenceFor(ruleId) {
  const r = ruleById(ruleId);
  return (r?.counter_evidence || []).map(c => ({
    note: c.note,
    src: c.src ?? null,
    locator: c.locator ?? null,
    quote: c.quote ?? null
  }));
}

function verdict({ cls, ruleId, kind, why, extraEvidence = [], ...rest }) {
  const r = ruleById(ruleId);
  const v = {
    class: cls,
    rule_id: ruleId,
    rule_name: r?.name ?? null,
    kind,
    why,
    confidence: rest.confidence ?? r?.confidence ?? null,
    basis: r?.basis ?? null,
    evidence: evidenceFor(ruleId, extraEvidence),
    counter_evidence: counterEvidenceFor(ruleId),
    ...rest
  };
  delete v.confidence_override;
  assertInvariants(v);
  return v;
}

/**
 * The one hard guarantee of this module: a class that ASSERTS compensation must name a rule
 * and carry at least one resolved source. A violation is a programming error, so it throws
 * rather than silently shipping an unsourced compensation claim into the score.
 */
function assertInvariants(v) {
  if (!CLASSES.includes(v.class)) {
    throw new Error(`compensationVerdict: illegal class ${JSON.stringify(v.class)}`);
  }
  const asserts = v.class === 'documented' || v.class === 'plausible-by-rule';
  if (asserts) {
    if (!v.rule_id) throw new Error('compensationVerdict: asserted compensation without a rule_id');
    const ok = (v.evidence || []).filter(e => e.src && e.citation && !e.citation.startsWith('(source id'));
    if (ok.length === 0) {
      throw new Error(
        `compensationVerdict: rule ${v.rule_id} asserted class '${v.class}' with no resolved source. ` +
        `This module must never assert compensation without naming its evidence.`
      );
    }
  }
  return v;
}

// ---------------------------------------------------------------------------
// Input extraction from an omics card
// ---------------------------------------------------------------------------

/** Pull within-species paralogues out of an omics index card (omics/index/genes/<sym>.json.gz). */
export function paraloguesFromCard(card) {
  const entries = card?.layers?.genomic?.features?.paralog?.entries;
  if (!Array.isArray(entries)) return null; // null = not recorded, NOT "none"
  const out = [];
  for (const e of entries) {
    // The index normalises rows inconsistently: sometimes `v` is the paralogue SYMBOL and the
    // structured row sits in `value`; sometimes `v` is the structured row serialised as JSON.
    // Handle all three shapes, or we silently drop paralogues (which this code did at first,
    // and which turned 'unknown' into a false 'not-expected' for vegfaa).
    let obj = (e.value && typeof e.value === 'object') ? e.value : null;
    if (!obj && typeof e.v === 'string' && e.v.trim().startsWith('{')) {
      try { obj = JSON.parse(e.v); } catch { obj = null; }
    }
    if (!obj && e.v && typeof e.v === 'object') obj = e.v;
    if (obj) {
      out.push({
        symbol: obj.symbol ?? (typeof e.v === 'string' && !e.v.trim().startsWith('{') ? e.v : null),
        ensembl_gene: obj.ensembl_gene ?? null,
        zfin_id: obj.zfin_id ?? null,
        identity_pct: typeof obj.identity_pct === 'number' ? obj.identity_pct : null,
        type: obj.type ?? null,
        source: 'Ensembl Compara (omics/genomic)'
      });
    } else if (typeof e.v === 'string' && e.v.trim()) {
      out.push({ symbol: e.v, ensembl_gene: null, zfin_id: null, identity_pct: null, type: null,
                 source: 'Ensembl Compara (omics/genomic)' });
    }
  }
  // An EMPTY result means the card recorded no paralogue rows, which is "not recorded", NOT an
  // assertion that none exists. Returning [] here would trip R11 and manufacture a confident
  // refusal out of silence, so return null and let R10 answer 'unknown'.
  return out.length ? out : null;
}

/** Pull the transcriptomic evidence out of an omics card into the shape R06 tests. */
export function expressionFromCard(card) {
  const t = card?.layers?.transcriptomic?.features;
  if (!t) return null;
  const grab = f => (t[f]?.entries || []).map(e => ({
    label: e.v ?? null,
    anatomy: e.anatomy ?? null,
    stages: e.stages ?? [],
    sources: e.sources ?? [],
    kind: e.kind ?? [],
    unit: e.unit ?? null
  }));
  return {
    expressed_in: grab('expressed_in'),
    not_expressed_in: grab('not_expressed_in'),
    expression_level: grab('expression_level')
  };
}

// ---------------------------------------------------------------------------
// Matching helpers for the tissue/stage condition of R06
// ---------------------------------------------------------------------------

function anatomyMatches(entry, want) {
  if (!want) return false;
  const wantId = norm(want.id);
  const wantLabel = norm(want.label ?? (typeof want === 'string' ? want : ''));
  const a = entry.anatomy || {};
  if (wantId && (norm(a.id) === wantId || norm(a.uberon) === wantId)) return true;
  if (wantLabel && (norm(a.label) === wantLabel || norm(entry.label) === wantLabel)) return true;
  return false;
}

function stageMatches(entry, want) {
  if (!want) return false;
  const w = norm(want.label ?? want.id ?? (typeof want === 'string' ? want : ''));
  if (!w) return false;
  return (entry.stages || []).some(s => {
    const n = norm(s);
    return n === w || n.includes(w) || w.includes(n);
  });
}

function wantFrom(requirement, expression) {
  const req = requirement || expression?.required || null;
  if (!req) return { anatomy: null, stage: null };
  return { anatomy: req.anatomy ?? null, stage: req.stage ?? null };
}

/**
 * Evaluate R06 for one candidate compensator.
 * Returns {state: 'expressed'|'not-expressed'|'no-data'|'no-requirement', detail}
 */
function evaluateExpression(symbol, expression, requirement) {
  const want = wantFrom(requirement, expression);
  if (!want.anatomy && !want.stage) {
    return { state: 'no-requirement', detail: 'the caller supplied no required anatomy or stage, so the tissue/stage condition of R06 cannot be tested' };
  }
  // Expression may be given per gene, or as a single block when there is one candidate.
  const block = expression?.byGene?.[symbol]
    ?? expression?.byGene?.[String(symbol).toLowerCase()]
    ?? (expression && (expression.expressed_in || expression.not_expressed_in) ? expression : null);
  if (!block) {
    return { state: 'no-data', detail: `no transcriptomic evidence supplied for candidate compensator ${symbol}` };
  }
  const neg = (block.not_expressed_in || []).filter(e => anatomyMatches(e, want.anatomy));
  if (neg.length) {
    return {
      state: 'not-expressed',
      detail: `the omics layer asserts ${symbol} is NOT expressed in ${want.anatomy?.label ?? want.anatomy?.id}`,
      rows: neg
    };
  }
  const pos = (block.expressed_in || []).filter(e => anatomyMatches(e, want.anatomy));
  if (!pos.length) {
    return { state: 'no-data', detail: `no expressed_in row for ${symbol} in ${want.anatomy?.label ?? want.anatomy?.id ?? '(unspecified anatomy)'}; absence of a row means "not recorded", never "not expressed"` };
  }
  if (want.stage) {
    const staged = pos.filter(e => stageMatches(e, want.stage));
    if (!staged.length) {
      return {
        state: 'no-data',
        detail: `${symbol} is recorded as expressed in ${want.anatomy?.label ?? want.anatomy?.id} but NOT at the required stage ${want.stage?.label ?? want.stage?.id}; the stage condition of R06 is untested, not satisfied`,
        rows: pos
      };
    }
    return { state: 'expressed', detail: `${symbol} is recorded as expressed in ${want.anatomy?.label ?? want.anatomy?.id} at ${want.stage?.label ?? want.stage?.id}`, rows: staged };
  }
  return {
    state: 'no-data',
    detail: `${symbol} is recorded as expressed in ${want.anatomy?.label ?? want.anatomy?.id} but no required stage was supplied, so R06's stage condition is untested`,
    rows: pos
  };
}

// ---------------------------------------------------------------------------
// Case lookup (R09)
// ---------------------------------------------------------------------------

/** All case rows for a gene symbol, case-insensitively. */
export function casesForGene(gene) {
  const g = norm(typeof gene === 'string' ? gene : gene?.symbol);
  if (!g) return [];
  return CASES.cases.filter(c => {
    const cg = norm(c.gene);
    return cg === g || cg.split(' + ').map(norm).includes(g);
  });
}

function caseAlleleCompatible(c, resolved) {
  if (!resolved) return false;
  const ck = resolveAlleleKind(c.allele_kind);
  if (!ck) return false;
  if (ck.kind === resolved.kind) return true;
  // Treat the mRNA fate as the compatibility test, since that is what the mechanism turns on.
  return ck.spec.mrna_made === resolved.spec.mrna_made
      && ck.spec.mrna_decayed === resolved.spec.mrna_decayed
      && !!ck.spec.knockdown === !!resolved.spec.knockdown;
}

// ---------------------------------------------------------------------------
// The classifier
// ---------------------------------------------------------------------------

/**
 * @param {object} input
 * @param {string|{symbol:string}} input.gene        required
 * @param {string} input.alleleKind                  e.g. 'missense', 'nonsense', 'gene-absent'
 * @param {Array|null} input.paralogues              null/undefined = not recorded; [] = ASSERTED none
 * @param {object|null} input.expression             {required:{anatomy,stage}, byGene:{sym:{expressed_in,...}}}
 * @param {object|null} input.pathway                optional pathway context, recorded not decisive
 * @param {object|null} input.omicsCard              an omics/index/genes/<sym>.json card
 * @param {object|null} [input.requirement]          {anatomy:{id,label}, stage:{id,label}} -- the functional requirement's context
 * @param {boolean} [input.mrnaDestabilised]         caller-asserted mRNA destabilisation (the R03 exception)
 * @param {boolean} [input.upregulationInKnockdown]  for the R08 protein-feedback discriminator
 * @param {boolean} [input.upregulationInMutant]
 * @param {string[]} [input.namedAdaptingGenes]      published adapting-gene relationships, if any
 * @param {boolean} [input.zygoticOnlyNull]          R13 maternal-rescue confound
 * @param {string} [input.organism]                  e.g. 'Danio rerio', 'Hirundichthys speculiger'
 */
export function compensationVerdict(input = {}) {
  const {
    gene, alleleKind, paralogues, expression, pathway, omicsCard,
    requirement = null, mrnaDestabilised, upregulationInKnockdown, upregulationInMutant,
    namedAdaptingGenes = null, zygoticOnlyNull = false, organism = null,
    // Validation only. Disables the case-table lookup (R09) so the RULE CHAIN can be tested
    // against the published outcomes instead of reading them back out of the table.
    skipCaseTable = false
  } = input;

  const symbol = typeof gene === 'string' ? gene : gene?.symbol ?? null;
  const flags = [];

  if (!symbol) {
    return verdict({
      cls: 'unknown', ruleId: 'R10-MISSING-INPUTS-ARE-UNKNOWN', kind: 'none',
      why: 'No gene was supplied, so no rule can be applied.',
      inputs_missing: ['gene']
    });
  }

  // ---- R12: does this organism have an expression layer at all? (flag only) ----
  const noExpressionOrganism = organism && !/danio\s+rerio/i.test(organism);
  if (noExpressionOrganism) {
    flags.push({
      rule_id: 'R12-NO-EXPRESSION-DATA-AT-ALL',
      note: `organism '${organism}' is not Danio rerio. Every expression-dependent rule below rests on ` +
            `zebrafish transfer. The flying fish has no expression data at all, so a verdict for a ` +
            `flying-fish design is a zebrafish verdict wearing a flying-fish label.`
    });
  }

  // ---- Resolve the allele kind. Unresolvable -> R10, never a guess. ----
  const resolved = resolveAlleleKind(alleleKind);
  if (!resolved) {
    return verdict({
      cls: 'unknown', ruleId: 'R10-MISSING-INPUTS-ARE-UNKNOWN', kind: 'none',
      why: `The allele kind ${JSON.stringify(alleleKind ?? null)} could not be resolved onto the mRNA-fate ` +
           `vocabulary the rules test, so no rule applies. 'unknown' is NOT evidence that compensation ` +
           `does not occur, and must not be scored as a pass.`,
      gene: symbol, allele_kind: alleleKind ?? null,
      inputs_missing: ['alleleKind'],
      accepted_allele_kinds: Object.keys(ALLELE_KINDS).filter(k => k !== 'comment'),
      flags
    });
  }
  if (resolved.loose) {
    flags.push({ note: `allele kind '${alleleKind}' was matched loosely onto '${resolved.kind}'` });
  }

  // ---- Derive missing inputs from the omics card, recording that we did ----
  let paras = paralogues;
  if (paras == null && omicsCard) {
    paras = paraloguesFromCard(omicsCard);
    if (paras) flags.push({ note: `paralogues derived from the supplied omics card (${paras.length} rows)` });
  }
  let expr = expression;
  if (expr == null && omicsCard) {
    const e = expressionFromCard(omicsCard);
    if (e) {
      expr = { required: requirement, byGene: { [symbol]: e } };
      flags.push({ note: 'expression derived from the supplied omics card' });
    }
  }
  if (expr && requirement && !expr.required) expr = { ...expr, required: requirement };

  const base = { gene: symbol, allele_kind: resolved.kind, organism: organism ?? null, flags, pathway: pathway ?? null };

  // ---- R13: maternal-rescue confound ----
  if (zygoticOnlyNull) {
    return verdict({
      cls: 'unknown', ruleId: 'R13-MATERNAL-RESCUE-IS-NOT-COMPENSATION', kind: 'maternal-confound',
      why: `${symbol} was supplied as a zygotic-only null. A zygotic null carrying wild-type maternal ` +
           `transcript looks exactly like a compensated mutant, and that is not compensation. A designed ` +
           `organism has no wild-type mother, so nothing inferred from a zygotic-only zebrafish null ` +
           `transfers to the design.`,
      ...base
    });
  }

  // ---- R09: documented case lookup ----
  const cases = skipCaseTable ? [] : casesForGene(symbol);
  const matching = cases.filter(c => caseAlleleCompatible(c, resolved));
  if (matching.length) {
    // Prefer a row whose allele_kind resolves to exactly this kind.
    const exact = matching.find(c => resolveAlleleKind(c.allele_kind)?.kind === resolved.kind) ?? matching[0];
    const adaptation = exact.adaptation;
    const rescued = exact.phenotype_rescued;
    const negative = exact.direction && /NOT-RESCUED|NOT-INDUCED|NEGATIVE/.test(exact.direction);
    const adaptationObserved = adaptation === true || (typeof adaptation === 'string' && /^YES|partial|tissue-dependent/i.test(adaptation));

    if (!adaptationObserved) {
      // A documented ABSENCE of compensation. This is a confident refusal, not an unknown.
      return verdict({
        cls: 'not-expected', ruleId: 'R09-DOCUMENTED-CASE-LOOKUP', kind: 'none',
        why: `Published outcome for ${symbol} (${exact.case_id}): compensation was ${adaptation === false ? 'tested and NOT observed' : `recorded as ${JSON.stringify(adaptation)}`}` +
             `${rescued === false ? ', and the phenotype was not rescued' : ''}. The case table overrides inference.`,
        case_id: exact.case_id, case: exact, documented_direction: 'no-compensation',
        functional_rescue: rescued === true,
        extraEvidence: (exact.evidence || []).map(e => ({ src: e.src, locator: e.locator, quote: e.quote })),
        ...base
      });
    }

    // Compensation documented. R07 now decides whether that means the requirement is met.
    const functional_rescue = rescued === true ? true : (rescued === false ? false : 'unknown');
    const r07 = functional_rescue !== true;
    return verdict({
      cls: 'documented', ruleId: 'R09-DOCUMENTED-CASE-LOOKUP', kind: exact.mechanism ?? 'transcriptional-adaptation',
      why: `Published outcome for ${symbol} (${exact.case_id}): a compensating gene (${(exact.compensator || []).join(', ') || 'unnamed'}) ` +
           `was observed to be upregulated (${JSON.stringify(adaptation)}).` +
           (r07
             ? ` BUT R07 APPLIES: phenotype_rescued is ${JSON.stringify(rescued)}, so this is a documented ADAPTATION, ` +
               `not a documented RESCUE. It must NOT be scored as a met requirement.`
             : ` The phenotype was also rescued, so the requirement is covered for this allele in this tissue only.`),
      case_id: exact.case_id, case: exact,
      documented_direction: 'compensation-observed',
      functional_rescue,
      r07_applies: r07,
      confidence: exact.confidence_cap ? exact.confidence_cap.split(' ')[0] : 'high',
      allele_specific_warning:
        `Documented for allele '${exact.allele ?? resolved.kind}' only. El-Brolosy 2019 found two PTC alleles of ` +
        `these very genes (hbegfa^sa18135, vcla^sa14599) that do NOT adapt, so a lesion class is not an allele.`,
      extraEvidence: (exact.evidence || []).map(e => ({ src: e.src, locator: e.locator, quote: e.quote })),
      ...base
    });
  }
  if (cases.length) {
    flags.push({
      note: `${cases.length} case row(s) exist for ${symbol} but none is compatible with allele kind ` +
            `'${resolved.kind}' (they cover: ${cases.map(c => c.allele_kind).join(', ')})`
    });
  }

  // ---- R04: knockdown ----
  if (resolved.spec.knockdown) {
    if (upregulationInKnockdown === true && upregulationInMutant === true) {
      return verdict({
        cls: 'documented', ruleId: 'R08-PROTEIN-FEEDBACK-IS-A-DIFFERENT-MECHANISM', kind: 'protein-feedback',
        why: `${symbol} shows the compensating gene upregulated in BOTH knockdown and mutant. Concordance is the ` +
             `discriminator: this is a protein feedback loop, not transcriptional adaptation, and it is the one ` +
             `mechanism that survives a knockdown-style design gap.`,
        ...base
      });
    }
    return verdict({
      cls: 'not-expected', ruleId: 'R04-KNOCKDOWN-NOT-ADAPTATION', kind: 'none',
      why: `${symbol} carries a knockdown-style perturbation ('${resolved.kind}'), which does not produce the mutant ` +
           `mRNA decay products that trigger transcriptional adaptation. A design that merely reduces a gene's dose ` +
           `does not get to borrow the mutant compensation literature. ` +
           `Protein-feedback compensation (R08) is NOT excluded, but needs evidence of upregulation in BOTH ` +
           `knockdown and mutant, which was not supplied.`,
      ...base
    });
  }

  // ---- R01: no mRNA -> no transcriptional adaptation. Falls through to the paralogue path. ----
  let taRefusal = null;
  if (resolved.spec.mrna_made === false) {
    taRefusal = {
      ruleId: 'R01-NO-MRNA-NO-ADAPTATION',
      // A gene that is absent or silenced is a clean loss of function, which is exactly the
      // situation every sourced paralogue-buffering case (mef2ca, pcdh15, ankfn1) describes.
      allowsParalogueBuffering: true,
      why: `'${resolved.kind}' makes no mutant mRNA, so there is no transcript to decay and transcriptional ` +
           `adaptation is positively excluded. This is the ordinary case for a designed organism that simply ` +
           `does not carry the gene.`
    };
  } else if (resolved.spec.mrna_decayed === false) {
    // ---- R03: missense / in-frame / synonymous / start-loss ----
    if (mrnaDestabilised === true) {
      return verdict({
        cls: 'unknown', ruleId: 'R03-MISSENSE-NOT-EXPECTED', kind: 'none',
        why: `'${resolved.kind}' would normally be refused by R03, but the caller asserts the transcript IS ` +
             `destabilised. Because the real requirement is destabilisation rather than a PTC as such (Xie 2025), ` +
             `the refusal no longer holds and no rule decides this case. 'unknown', not 'plausible'.`,
        r03_exception: true, ...base
      });
    }
    taRefusal = {
      ruleId: 'R03-MISSENSE-NOT-EXPECTED',
      // DELIBERATE SCOPE LIMIT, added after this exact case failed its own test.
      // R06's paralogue-buffering path is evidenced ONLY for null-like alleles: every sourced
      // case (mef2ca, pcdh15a/b, ankfn1) is a loss-of-function allele. Extending it to a missense
      // allele would be unsourced, and worse, a missense product can be dominant-negative, which
      // a paralogue cannot buffer at all. So a missense allele gets NO compensation path.
      allowsParalogueBuffering: false,
      why: `'${resolved.kind}' is translated normally and is not a nonsense-mediated-decay substrate, so the mutant ` +
           `transcript is not destabilised and transcriptional adaptation is not expected. A MISSENSE ALLELE MUST ` +
           `NOT BE CLASSED COMPENSABLE.`
    };
  }

  // A missense-family allele is refused outright: no mechanism in this rule base has evidence
  // covering it, so there is no path left to 'plausible-by-rule'.
  if (taRefusal && taRefusal.allowsParalogueBuffering === false) {
    return verdict({
      cls: 'not-expected', ruleId: taRefusal.ruleId, kind: 'none',
      why: `${taRefusal.why} ` +
           `The paralogue-buffering path (R06) is NOT available either: every sourced paralogue-buffering case ` +
           `(mef2ca, pcdh15a/b, ankfn1) is a loss-of-function allele, so applying R06 to a missense allele would ` +
           `be unsourced extrapolation -- and a missense product may be dominant-negative, which no paralogue can ` +
           `buffer. Protein-feedback compensation (R08) is also unavailable, since it is triggered by loss of the ` +
           `protein's repressive activity, not by a change in its sequence.`,
      paralogue_path: 'refused: R06 is evidenced only for null-like alleles',
      ...base
    });
  }

  // ---- R11: an ASSERTED absence of any candidate compensator ----
  const noNamedAdapting = !namedAdaptingGenes || namedAdaptingGenes.length === 0;
  if (Array.isArray(paras) && paras.length === 0 && noNamedAdapting) {
    return verdict({
      cls: 'not-expected', ruleId: 'R11-NO-CANDIDATE-COMPENSATOR', kind: 'none',
      why: `The caller asserts ${symbol} has no paralogues and names no adapting gene. Both mechanisms need a ` +
           `target, so neither has anything to act through. NOTE: adapting genes need not be paralogues ` +
           `(egfl7's are emilin family members), so this refusal rests on the caller's assertion that BOTH are absent.`,
      ...base
    });
  }
  if (paras == null) {
    // Not recorded is not the same as none. Our Ensembl rows are asymmetric, so refuse to over-read.
    return verdict({
      cls: 'unknown', ruleId: 'R10-MISSING-INPUTS-ARE-UNKNOWN', kind: 'none',
      why: `No paralogue information was supplied for ${symbol}, and no case row covers this allele. ` +
           `Our Ensembl Compara rows are asymmetric (vclb lists vcla, vcla lists nothing), so an absent ` +
           `paralogue list must never be read as 'no paralogue'.` +
           (taRefusal ? ` Separately, ${taRefusal.ruleId} already excludes transcriptional adaptation here.` : ''),
      inputs_missing: ['paralogues'],
      transcriptional_adaptation: taRefusal ? { class: 'not-expected', rule_id: taRefusal.ruleId } : null,
      ...base
    });
  }

  // ---- R06: candidate compensators must be expressed where and when the function is required ----
  const candidates = [
    ...(namedAdaptingGenes || []).map(s => ({ symbol: s, identity_pct: null, source: 'caller-named adapting gene' })),
    ...paras
  ].filter(c => c.symbol);

  if (!candidates.length) {
    return verdict({
      cls: 'unknown', ruleId: 'R10-MISSING-INPUTS-ARE-UNKNOWN', kind: 'none',
      why: `${paras.length} paralogue row(s) exist for ${symbol} but none carries a gene SYMBOL, so no candidate ` +
           `compensator can be looked up for expression. (Ensembl Compara rows in omics/genomic often carry only ` +
           `an ensembl_gene id with symbol: null.)`,
      inputs_missing: ['paralogue symbols'],
      paralogue_rows: paras.length,
      ...base
    });
  }

  if (!expr) {
    return verdict({
      cls: 'unknown', ruleId: 'R10-MISSING-INPUTS-ARE-UNKNOWN', kind: 'none',
      why: `Candidate compensators exist for ${symbol} (${candidates.map(c => c.symbol).join(', ')}) but NO EXPRESSION ` +
           `DATA was supplied, so R06's tissue and stage conditions cannot be tested. Paralogue existence alone ` +
           `never licenses compensation: 26% of zebrafish genes sit in ohnologue pairs, while only 1 of 439 ` +
           `paralogous pairs met strict adaptation criteria in the largest survey. 'unknown', not 'plausible'.`,
      inputs_missing: ['expression'],
      candidates: candidates.map(c => c.symbol),
      priors: PRIORS,
      ...base
    });
  }

  const assessed = candidates.map(c => ({ ...c, expression: evaluateExpression(c.symbol, expr, requirement ?? expr.required) }));
  const expressedOnes = assessed.filter(a => a.expression.state === 'expressed');
  const negatedOnes = assessed.filter(a => a.expression.state === 'not-expressed');

  if (expressedOnes.length) {
    const best = expressedOnes[0];
    const want = wantFrom(requirement ?? expr.required, expr);
    if (taRefusal) {
      // The lesion excludes transcriptional adaptation, but an already-expressed paralogue may still buffer.
      return verdict({
        cls: 'plausible-by-rule', ruleId: 'R06-PARALOGUE-MUST-BE-EXPRESSED', kind: 'paralogue-buffering',
        why: `Transcriptional adaptation is excluded for ${symbol} by ${taRefusal.ruleId}. However the paralogue ` +
             `${best.symbol} is recorded as expressed in ${want.anatomy?.label ?? want.anatomy?.id} at ` +
             `${want.stage?.label ?? want.stage?.id}, so constitutive paralogue buffering is possible by rule. ` +
             `THIS IS A WEAK CLASS: an expressed paralogue is necessary, nowhere near sufficient, and the largest ` +
             `systematic survey found 1 of 439 paralogous pairs adapting under strict criteria. Score it well below ` +
             `'documented' and never as a met requirement on its own.`,
        confidence: 'low',
        transcriptional_adaptation: { class: 'not-expected', rule_id: taRefusal.ruleId, why: taRefusal.why },
        candidate: best.symbol,
        candidates: assessed.map(a => ({ symbol: a.symbol, identity_pct: a.identity_pct, state: a.expression.state, detail: a.expression.detail })),
        functional_rescue: 'unknown',
        priors: PRIORS,
        ...base
      });
    }
    // Decay-competent allele AND an expressed, sequence-similar candidate: R02 + R05 + R06 all pass.
    const hasSimilarity = best.identity_pct != null || (namedAdaptingGenes || []).includes(best.symbol);
    if (!hasSimilarity) {
      return verdict({
        cls: 'unknown', ruleId: 'R05-SEQUENCE-SIMILARITY-REQUIRED', kind: 'none',
        why: `${symbol} has a decay-triggering allele and ${best.symbol} is expressed in the right place and time, ` +
             `but R05's sequence-similarity condition cannot be tested: ${best.symbol} is neither a published ` +
             `adapting gene nor a paralogue with a stated percent identity. R05 must NOT be implemented as ` +
             `'ran BLAST, got a hit' -- the source's own threshold was an E-value up to 1,000,000, at which almost ` +
             `any gene pair matches.`,
        inputs_missing: ['sequence similarity (identity_pct or a named adapting-gene relationship)'],
        candidates: assessed.map(a => ({ symbol: a.symbol, identity_pct: a.identity_pct, state: a.expression.state })),
        ...base
      });
    }
    return verdict({
      cls: 'plausible-by-rule', ruleId: 'R02-DECAY-TRIGGER-REQUIRED', kind: 'transcriptional-adaptation',
      why: `${symbol} carries '${resolved.kind}', which destabilises the mutant transcript (R02); ${best.symbol} ` +
           `shares sequence similarity with it (${best.identity_pct != null ? best.identity_pct.toFixed(1) + '% identity' : 'published adapting gene'}) (R05); ` +
           `and ${best.symbol} is recorded as expressed in ${want.anatomy?.label ?? want.anatomy?.id} at ` +
           `${want.stage?.label ?? want.stage?.id} (R06). Every condition of the transcriptional-adaptation rule ` +
           `chain is satisfied, so adaptation is plausible BY RULE. ` +
           `IT IS NOT DOCUMENTED, AND IT IS NOT A RESCUE: two PTC alleles of genes that do adapt (hbegfa^sa18135, ` +
           `vcla^sa14599) fail to adapt, and in titin the paralogue rose 2.55-fold at protein level without ` +
           `rescuing the phenotype.`,
      confidence: resolved.kind === 'frameshift' ? 'low-medium' : 'medium',
      chain: ['R02-DECAY-TRIGGER-REQUIRED', 'R05-SEQUENCE-SIMILARITY-REQUIRED', 'R06-PARALOGUE-MUST-BE-EXPRESSED'],
      candidate: best.symbol,
      candidates: assessed.map(a => ({ symbol: a.symbol, identity_pct: a.identity_pct, state: a.expression.state })),
      functional_rescue: 'unknown',
      r07_applies: true,
      priors: PRIORS,
      extraEvidence: [
        ...evidenceRefs('R05-SEQUENCE-SIMILARITY-REQUIRED'),
        ...evidenceRefs('R06-PARALOGUE-MUST-BE-EXPRESSED')
      ],
      ...base
    });
  }

  if (negatedOnes.length && negatedOnes.length === assessed.length) {
    return verdict({
      cls: 'not-expected', ruleId: 'R06-PARALOGUE-MUST-BE-EXPRESSED', kind: 'none',
      why: `Every candidate compensator for ${symbol} (${negatedOnes.map(a => a.symbol).join(', ')}) is asserted by the ` +
           `omics layer NOT to be expressed in the required tissue. A buffer that is not present where the function ` +
           `is needed cannot carry it. ` +
           (taRefusal ? `${taRefusal.ruleId} independently excludes transcriptional adaptation.` : ''),
      candidates: assessed.map(a => ({ symbol: a.symbol, state: a.expression.state, detail: a.expression.detail })),
      ...base
    });
  }

  // Candidates exist, expression evidence is partial or silent -> unknown.
  return verdict({
    cls: 'unknown', ruleId: 'R10-MISSING-INPUTS-ARE-UNKNOWN', kind: 'none',
    why: `Candidate compensators exist for ${symbol} but none could be shown expressed in the required tissue and ` +
         `stage: ${assessed.map(a => `${a.symbol}: ${a.expression.detail}`).join(' | ')}. Absence of an expression ` +
         `row means 'not recorded', never 'not expressed', so this is 'unknown' rather than either a refusal or a pass.` +
         (taRefusal ? ` Separately, ${taRefusal.ruleId} excludes transcriptional adaptation.` : ''),
    inputs_missing: ['expression in the required anatomy/stage'],
    candidates: assessed.map(a => ({ symbol: a.symbol, identity_pct: a.identity_pct, state: a.expression.state, detail: a.expression.detail })),
    transcriptional_adaptation: taRefusal ? { class: 'not-expected', rule_id: taRefusal.ruleId } : null,
    priors: PRIORS,
    ...base
  });
}

function evidenceRefs(ruleId) {
  return (ruleById(ruleId)?.sources || []).map(s => ({ src: s.src, locator: s.locator, quote: s.quote }));
}

export { RULES, CASES };
export default compensationVerdict;
