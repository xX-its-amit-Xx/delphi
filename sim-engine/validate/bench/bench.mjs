// THE BENCH PACKAGE: a case, its conditions, its staged plan, its controls, what it consumes, what that
// costs, and the files to order it with - assembled into one object.
//
// ============================== WHAT A PI GETS, AND WHAT THEY DO NOT ==============================
// They get: which experiment is worth running and what answer is already published; the arms, each with
// the evidence that justifies spending embryos on it; the order of operations with a published method
// cited at every step and a gate saying what must be true before the next step; the reagent quantities
// with the arithmetic shown; a cost that labels itself a list-price lower bound; and two ordering files.
//
// They do not get: a bench protocol (see sop.mjs for why), a quote, a promise that the experiment works,
// or permission to start. Institutional animal-care approval comes first and this cannot grant it.
//
// ============================== THE RESULT THAT SURPRISES PEOPLE ==============================
// Reagent cost is driven by the NUMBER OF CONDITIONS, not by the number of embryos. A condition needs a
// few microlitres of mix; the embryos consume a per-cent or so of it. Doubling the embryos in an arm is
// free. Adding an arm costs a whole mix. And because guides and nuclease are sold in packs far larger
// than one experiment needs, most lines are bought once and barely touched - so the honest headline is
// that a first experiment costs about what a second, third and fourth one do together.

import * as Q from './quantities.mjs';
import * as C from './cases.mjs';
import * as K from './conditions.mjs';
import * as CTL from './controls.mjs';
import * as SOP from './sop.mjs';
import * as CAT from './catalog.mjs';
import * as ORD from './order.mjs';
import * as PWR from './power.mjs';

export const SCOPE =
  'Danio rerio only. Every price is a public LIST price, never a quote. Nothing here has been run at a ' +
  'bench by us. Institutional animal-care approval (IACUC or local equivalent) is required before the ' +
  'first injection and this module cannot grant it.';

/** Physical constants and working assumptions, each labelled by where it came from. The ones marked
 *  ASSUMPTION are ours: they are stated here rather than buried in a multiplication, so a lab can
 *  substitute its own and watch the budget move. */
export const PARAMETERS = {
  mix_volume_ul: { value: 5, kind: 'ASSUMPTION - OURS', why: 'a practical minimum volume to prepare and load a needle from. No published value was sourced. It is the single biggest lever on reagent cost in this package: halve it and the nuclease line roughly halves.' },
  injection_volume_nl: { value: 1, kind: 'measured', source: 'Zhao et al. 2021, doi 10.1016/j.ymeth.2020.12.004 - 1 nL into the cell in their best condition' },
  cas9_ng_per_ul: { value: 750, kind: 'measured', source: 'Zhao et al. 2021 best single condition: 0.75 ug/uL Cas9 with 4.5 uM guide, 93 % survival (57/61)' },
  guide_um: { value: 4.5, kind: 'measured', source: 'Zhao et al. 2021: threshold between 1.5 and 4.5 uM, plateau at 4.5; 13.5 uM no better' },
  cas9_kda: { value: 160, kind: 'approximation', why: 'S. pyogenes Cas9 is about 158-163 kDa depending on tags. Used only to convert between mass and moles when comparing vendor pack units, which are quoted in both.' },
  sgrna_nt: { value: 100, kind: 'approximation', why: 'a single-guide RNA is about 100 nt: a 20-nt spacer plus the 76-nt scaffold. Used to convert a concentration in uM to a mass.' },
  embryos_per_arm: { value: 100, kind: 'ASSUMPTION - OURS', why: 'no single published standard; F0 papers report per-condition counts from roughly 40 to over 180. Changing it changes almost nothing in the budget, which is itself the finding.' },
  pooled_embryos_per_amplicon: { value: 20, kind: 'convention', source: 'the editplan screening section pools about 20 embryos to confirm cutting' },
};

const P = k => PARAMETERS[k].value;

/** uM of a nucleic acid of n nucleotides -> ng/uL. */
function umToNgPerUl(um, nt) {
  const mw = nt * 321 + 159;                 // RNA average residue mass
  return +(um * 1e-6 * mw * 1000).toPrecision(5);   // mol/L * g/mol = g/L = ng/uL... * 1000 for uM->M handled above
}

/** What one experiment consumes, per arm and in total. */
export function consumption(matrix, { knockin = false, donor_nt = 120 } = {}) {
  const guideNgPerUl = umToNgPerUl(P('guide_um'), P('sgrna_nt'));
  const perArm = Q.injectionMix({
    embryos: P('embryos_per_arm'),
    injection_volume_nl: P('injection_volume_nl'),
    mix_volume_ul: P('mix_volume_ul'),
    components: { cas9: P('cas9_ng_per_ul'), guide: guideNgPerUl, ...(knockin ? { donor: 100 } : {}) },
  });
  const injecting = matrix.arms.filter(a => a.variable !== null);   // the buffer control carries no nuclease
  const n = injecting.length;
  const total = {
    arms_consuming_reagent: n,
    buffer_control_arms: matrix.arms.length - n,
    cas9_ng: +(perArm.component_mass_ng.cas9 * n).toPrecision(6),
    guide_ng: +(perArm.component_mass_ng.guide * n).toPrecision(6),
    donor_ng: knockin ? +(perArm.component_mass_ng.donor * n).toPrecision(6) : null,
  };
  total.cas9_pmol = +(total.cas9_ng / (P('cas9_kda') * 1000) * 1000).toPrecision(5);
  total.guide_nmol = +(Q.ngToPmol(total.guide_ng, P('sgrna_nt'), 'RNA') / 1000).toPrecision(5);
  return {
    per_arm: perArm,
    guide_concentration_ng_per_ul: guideNgPerUl,
    total,
    the_shape_of_this_budget:
      `${n} injected arm(s) x ${P('mix_volume_ul')} uL = ${(n * P('mix_volume_ul')).toFixed(0)} uL of mix in total, ` +
      `of which about ${(n * P('embryos_per_arm') * P('injection_volume_nl') / 1000).toFixed(2)} uL is actually injected. ` +
      `Every reagent below is bought in a pack far larger than ${total.guide_nmol} nmol of guide or ${total.cas9_pmol} pmol of nuclease, ` +
      `so the quantities are not what the price depends on - the number of DISTINCT reagents is.`,
  };
}

/** The overexpression route consumes a plasmid and a transposase mRNA, not a nuclease and a guide.
 *  Both concentrations are published, so unlike the nuclease route nothing here is our assumption
 *  except the prepared mix volume, which is shared. */
export const OVEREXPRESSION_PARAMETERS = {
  plasmid_ng_per_ul_low: { value: 5, kind: 'measured', source: 'Perathoner et al. 2014, Materials and Methods, "Injections": plasmids 5-20 ng/ul' },
  plasmid_ng_per_ul_high: { value: 20, kind: 'measured', source: 'as above - the published range; the paper does not say which end produced its results' },
  transposase_mrna_ng_per_ul: { value: 25, kind: 'measured', source: 'Perathoner et al. 2014: Tol2 mRNA 25 ng/ul' },
  phenol_red_percent_v_v: { value: 20, kind: 'measured', source: 'Perathoner et al. 2014: 20 % (v/v) phenol red' },
  transcription_yield_ug_per_reaction: { value: null, kind: 'NOT FOUND', why: 'the vendor page read for the transcription kit gives reactions per kit but no yield per reaction that was captured here. Packs are therefore computed as one kit, NOT from a yield figure we would have had to invent. This is why the transposase line carries no leftover number.' },
};

export function overexpressionConsumption(matrix) {
  const O = k => OVEREXPRESSION_PARAMETERS[k].value;
  const injecting = matrix.arms.filter(a => !/^control:dsred-only$/.test(a.id));
  const perArm = (plasmid) => Q.injectionMix({
    embryos: P('embryos_per_arm'),
    injection_volume_nl: P('injection_volume_nl'),
    mix_volume_ul: P('mix_volume_ul'),
    components: { plasmid, transposase_mrna: O('transposase_mrna_ng_per_ul') },
  });
  const low = perArm(O('plasmid_ng_per_ul_low'));
  const high = perArm(O('plasmid_ng_per_ul_high'));
  const nArms = matrix.arms.length;   // every arm, including both controls, is an injected mix here
  return {
    per_arm_low_dose: low,
    per_arm_high_dose: high,
    total: {
      arms_consuming_reagent: nArms,
      buffer_control_arms: 0,
      plasmid_ng: +((low.component_mass_ng.plasmid + high.component_mass_ng.plasmid) + 2 * low.component_mass_ng.plasmid).toPrecision(6),
      transposase_mrna_ng: +(low.component_mass_ng.transposase_mrna * nArms).toPrecision(6),
      distinct_constructs: 3,
    },
    why_no_buffer_only_arm:
      'In the nuclease routes the buffer-injected arm is the baseline. Here the baseline is the MARKER-ONLY ' +
      'plasmid arm, because the question is not "does injection harm the embryo" but "does this transgene ' +
      'cause overgrowth that a transgene without the channel does not". A buffer arm is still worth running ' +
      'for the survival curve, and costs nothing but embryos - it is simply not the comparison.',
    the_shape_of_this_budget:
      `${nArms} injected arm(s) x ${P('mix_volume_ul')} uL of mix. The reagent masses are trivial ` +
      `(tens to hundreds of ng), the plasmid is unpriceable until it is obtained, and the transcription kit ` +
      `is 25 reactions where one session needs one. So the reagent total for this route is close to ` +
      `meaningless: the real cost is three verified constructs and about four months of tank space.`,
  };
}

/** Bill of materials for the overexpression route. The construct line has no price, which makes this the
 *  first emitted package whose total legitimately declares itself a lower bound. */
export function overexpressionBOM({ sanger_reactions = 6 } = {}) {
  const lines = [];
  const add = (id, opts) => { const l = CAT.priceLine(id, opts); if (l) lines.push(l); };

  add('construct-ef1a-kcnk5b', { packs: 3 });
  lines[lines.length - 1].requirement = 'three constructs: ef1a:kcnk5b, the ef1a:DsRed-only control, and the non-conductive GFG->AAA control. Not optional, and not priceable.';
  add('addgene-tol2-transposase', { packs: 1 });
  lines[lines.length - 1].requirement = 'one plasmid, as the template for transposase mRNA. ACADEMIC/NONPROFIT ONLY on the record read.';
  add('mmessage-sp6', { packs: 1 });
  lines[lines.length - 1].requirement = 'one kit = 25 reactions; a session needs one. The first line to borrow instead of buy.';
  add('primers-idt', { packs: 2, bases: 20 });
  lines[lines.length - 1].requirement = 'transgene-detection primers, for the PCR that attributes overgrowth when the marker is invisible';
  add('q5-neb', { packs: 1 });
  add('cleanup-neb', { packs: 1 });
  for (const id of ['capillaries', 'microloaders', 'injection-mould', 'agarose', 'phenol-red']) add(id, { packs: 1 });
  for (const id of ['nacl', 'kcl', 'mgso4', 'cacl2', 'methylene-blue']) add(id, { packs: 1 });
  if (sanger_reactions > 0) {
    add('sanger-eurofins', { packs: sanger_reactions });
    lines[lines.length - 1].requirement = `${sanger_reactions} reaction(s): verifying all three constructs across the promoter-insert junction and the insert, which the plan gates on`;
  }
  return lines;
}

/** The bill of materials: real catalogue lines, quantities rounded up to whole packs. */
export function billOfMaterials(cons, { knockin = false, donor_nt = 120, guides = 1, sanger_reactions = 0, amplicon_samples = 6, guide_route = 'synthetic' } = {}) {
  const lines = [];
  const add = (id, opts) => { const l = CAT.priceLine(id, opts); if (l) lines.push(l); };

  // nuclease: one pack covers the whole experiment many times over, which the leftover field will show
  const cas9 = CAT.item('cas9-neb');
  const cas9Packs = Q.packsNeeded(cons.total.cas9_pmol, cas9.pack_size);
  add('cas9-neb', { packs: cas9Packs.packs });
  lines[lines.length - 1].requirement = `${cons.total.cas9_pmol} pmol needed; one pack supplies ${cas9.pack_size} pmol`;
  lines[lines.length - 1].leftover = cas9Packs.leftover;

  // guides
  if (guide_route === 'synthetic') {
    const g = CAT.item('sgrna-synthego');
    const need = cons.total.guide_nmol / guides;
    const packs = Q.packsNeeded(need, g.pack_size);
    for (let i = 0; i < guides; i++) { add('sgrna-synthego', { packs: packs.packs }); lines[lines.length - 1].requirement = `guide ${i + 1} of ${guides}: ${need.toPrecision(3)} nmol needed; one pack supplies ${g.pack_size} nmol`; }
  } else {
    add('engen-sgrna-kit', { packs: 1 });
    lines[lines.length - 1].requirement = `in-house transcription for ${guides} guide(s): about $26.30 per guide against $84 synthetic, at the cost of making the template and the trade-off noted on the line`;
  }

  // repair template, knock-in only
  if (knockin) { add('ultramer-idt', { packs: 1, bases: donor_nt, phosphorothioate_bonds: 4 }); add('primers-idt', { packs: 2, bases: 20 }); }
  else add('primers-idt', { packs: 2, bases: 20 });

  // PCR and clean-up for the readouts
  add('q5-neb', { packs: 1 });
  add('cleanup-neb', { packs: 1 });

  // injection consumables
  for (const id of ['capillaries', 'microloaders', 'injection-mould', 'agarose', 'phenol-red']) add(id, { packs: 1 });
  for (const id of ['nacl', 'kcl', 'mgso4', 'cacl2', 'methylene-blue']) add(id, { packs: 1 });

  // readout services
  if (sanger_reactions > 0) { add('sanger-eurofins', { packs: sanger_reactions }); lines[lines.length - 1].requirement = `${sanger_reactions} reaction(s): sequencing the protospacer and PAM in the breeding fish before anything is ordered`; }
  if (amplicon_samples > 0) { add('amplicon-plasmidsaurus', { packs: amplicon_samples }); lines[lines.length - 1].requirement = `${amplicon_samples} sample(s): one per injected arm to confirm cutting, plus the phenotype-stage genotyping`; }

  return lines;
}

/** Assemble everything. */
export function benchPackage(caseId, opts = {}) {
  const kase = C.caseById(caseId);
  if (!kase) return { refused: true, why: `no case with id "${caseId}". Known: ${C.CASES.map(c => c.id).join(', ')}` };
  const overexpression = /tol2|transgenesis/i.test(kase.edit?.kind ?? '');
  const knockin = !overexpression && kase.scorable_in_injected_generation === false && /point/i.test(kase.edit?.kind ?? '');
  const matrix = K.matrix(kase, { knockin });
  const controls = CTL.controlFor(kase);
  const cons = overexpression ? overexpressionConsumption(matrix) : consumption(matrix, { knockin });
  const guides = overexpression ? 0 : (opts.guides ?? (knockin ? 1 : 4));
  const arms = matrix.arms;
  const stages = SOP.stagesFor(kase, { arms, assay: kase.assay, readout_stage: kase.readout_stage, pool_size: P('pooled_embryos_per_amplicon'), dominant: /dominant/i.test(kase.why ?? '') });
  const lines = overexpression
    ? overexpressionBOM({ sanger_reactions: opts.sanger_reactions ?? 6 })
    : billOfMaterials(cons, { knockin, guides, sanger_reactions: opts.sanger_reactions ?? 2, amplicon_samples: opts.amplicon_samples ?? (arms.length + 2) });
  const budget = Q.rollup(lines);
  // The number a PI in a working zebrafish facility actually wants: what THIS experiment adds, as opposed
  // to what it would cost to equip a bench from nothing. Most of the total is bulk salts, consumables and
  // general molecular biology kits that any lab running injections already owns.
  const marginal = Q.rollup(lines.filter(l => !l.stock_item));
  const stock = Q.rollup(lines.filter(l => l.stock_item));

  return {
    scope: SCOPE,
    case: kase,
    ranked_among: C.rank().map(c => ({ rank: c.rank, id: c.id, confidence: c.confidence })),
    allele_corrections: C.ALLELE_CORRECTIONS,
    knockouts_are_normal: C.KNOCKOUTS_ARE_NORMAL,
    ranking_changed: C.RANKING_CHANGED,
    conditions: matrix,
    controls,
    guide_placement: overexpression ? null : CTL.GUIDE_PLACEMENT,
    plan: stages,
    power: PWR.powerFor(caseId),
    parameters: overexpression ? { ...PARAMETERS, ...OVEREXPRESSION_PARAMETERS } : PARAMETERS,
    consumption: cons,
    bill_of_materials: lines,
    budget: {
      ...budget,
      marginal_cost_usd: marginal.subtotal_usd,
      already_in_most_labs_usd: stock.subtotal_usd,
      which_number_to_quote:
        `$${marginal.subtotal_usd.toFixed(2)} is what this experiment ADDS in a lab that already runs ` +
        `zebrafish injections - nuclease, guides, primers and sequencing. $${budget.subtotal_usd.toFixed(2)} ` +
        `is the whole list including $${stock.subtotal_usd.toFixed(2)} of bulk salts, consumables and ` +
        `general kits that such a lab already owns. Quoting the larger number to a facility that has a ` +
        `rig is wrong by about ${(stock.subtotal_usd / Math.max(marginal.subtotal_usd, 1)).toFixed(1)}x, ` +
        `and quoting the smaller one to a lab starting from nothing is wrong the other way.`,
      price_basis: CAT.PRICE_BASIS,
      what_is_not_in_this_total: [
        'fish husbandry and facility costs, which for any case needing a generation dominate everything here',
        'labour - the largest real cost of all',
        'shipping, tax and vendor surcharges; one supplier never publishes shipping at all',
        'the microinjection rig, stereoscope, micromanipulator and incubator, which are capital a lab either has or does not',
        'institutional overhead',
      ],
      unpriceable_vendors: CAT.UNPRICEABLE,
    },
    ordering: {
      no_universal_format: ORD.NO_UNIVERSAL_FORMAT,
      requisition_csv: ORD.requisitionCSV(lines),
      vendor_quick_orders: ORD.vendorQuickOrders(lines),
      column_notes: ORD.COLUMN_NOTES,
    },
    what_this_package_is_not:
      'Not a protocol, not a quote, not evidence that the experiment will work, and not permission to ' +
      'start. The cassette it is built around comes from sim-engine/validate/editplan, which calls itself ' +
      'a proposal for a wet lab to check - this package inherits that status exactly and adds no ' +
      'confidence to it.',
  };
}
