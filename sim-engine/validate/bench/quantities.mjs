// Pure arithmetic for the bench package: how much of each reagent an experiment consumes, how many packs
// that is, and what the packs cost. No data, no opinions, no network - every function here is a formula
// whose inputs are named and whose output carries its own derivation.
//
// WHY THIS IS A SEPARATE FILE. The numbers that matter to a PI are quantities and money, and those are
// exactly the numbers it is easiest to produce confidently and wrongly. Keeping the arithmetic in one
// dependency-free file means every formula can be tested directly against a worked example, and means the
// catalogue (prices, which go stale) and the condition matrix (evidence, which is argued about) cannot
// quietly change what a multiplication does.
//
// THE ONE NON-OBVIOUS FACT THIS FILE ENCODES. Injection reagent consumption is NOT driven by the number of
// embryos. One embryo takes ~1 nL; a thousand embryos take ~1 uL. Nobody can pipette, or load a needle
// from, a 1 uL mix, so a lab prepares a few uL per condition and discards nearly all of it. Consumption is
// therefore `arms x mix_volume`, and doubling the embryos per arm costs essentially nothing while adding
// one more condition costs a full mix. `injectionMix()` returns both numbers so the package can say this
// out loud instead of implying that a bigger experiment costs proportionally more.

/** Round a required amount up to whole packs. Returns the leftover too, because leftover is the honest
 *  reason a small experiment costs as much as a large one. */
export function packsNeeded(needed, packSize) {
  if (!(packSize > 0)) return { packs: null, supplied: null, leftover: null, utilisation: null, why: 'no pack size known for this item, so the number of packs cannot be computed' };
  if (!(needed >= 0)) return { packs: null, supplied: null, leftover: null, utilisation: null, why: 'no requirement computed for this item' };
  const packs = Math.ceil(needed / packSize);
  const supplied = packs * packSize;
  return { packs, supplied, leftover: +(supplied - needed).toPrecision(6), utilisation: supplied > 0 ? +(needed / supplied).toFixed(3) : null };
}

/** Mass of one component in a prepared mix. conc in ng/uL, volume in uL -> ng. */
export function componentMass(concentration_ng_per_ul, mix_volume_ul) {
  if (concentration_ng_per_ul == null || mix_volume_ul == null) return null;
  return +(concentration_ng_per_ul * mix_volume_ul).toPrecision(6);
}

/** ng of a nucleic acid -> pmol, for ordering oligos that are sold by the nmole. */
export function ngToPmol(ng, length_nt, kind = 'ssDNA') {
  if (ng == null || !(length_nt > 0)) return null;
  // Average MW per residue: ssDNA ~ 327 g/mol, RNA ~ 321 g/mol. Both are the standard approximations used
  // by oligo suppliers' own calculators; they are approximations, and this function says so in its name's
  // documentation rather than pretending to 4 significant figures.
  const perResidue = kind === 'RNA' ? 321 : 327;
  const mw = length_nt * perResidue + (kind === 'RNA' ? 159 : 18);
  return +(ng / mw * 1000).toPrecision(6);   // ng / (g/mol) * 1000 = pmol
}

/** What one injection condition actually consumes.
 *  Returns BOTH the theoretical volume the embryos receive and the volume that must be prepared, because
 *  the gap between them is the whole story of this budget. */
export function injectionMix({ embryos, injection_volume_nl, mix_volume_ul, components }) {
  const delivered_ul = embryos != null && injection_volume_nl != null ? +(embryos * injection_volume_nl / 1000).toPrecision(6) : null;
  const prepared_ul = mix_volume_ul;
  const waste_fraction = delivered_ul != null && prepared_ul > 0 ? +(1 - delivered_ul / prepared_ul).toFixed(4) : null;
  const masses = {};
  for (const [id, conc] of Object.entries(components || {})) masses[id] = componentMass(conc, prepared_ul);
  return {
    embryos, injection_volume_nl, delivered_ul, prepared_ul, waste_fraction, component_mass_ng: masses,
    derivation: `delivered = ${embryos} embryos x ${injection_volume_nl} nL = ${delivered_ul} uL; prepared = ${prepared_ul} uL; each component mass = its concentration (ng/uL) x ${prepared_ul} uL`,
    the_point: prepared_ul != null && delivered_ul != null
      ? `${waste_fraction == null ? '' : (waste_fraction * 100).toFixed(1) + ' % of the prepared mix is never injected. '}Reagent cost here scales with the NUMBER OF CONDITIONS, not with the number of embryos: injecting twice as many embryos in this arm would consume the same reagent.`
      : 'not computable without both an embryo count and a prepared mix volume',
  };
}

/** Sum a list of order lines into a total, keeping unpriced lines visible rather than dropping them. */
export function rollup(lines) {
  let subtotal = 0;
  const unpriced = [];
  for (const l of lines) {
    if (l.extended_price_usd == null) { unpriced.push({ id: l.id, what: l.description, why: l.why_unpriced ?? 'no public list price read' }); continue; }
    subtotal += l.extended_price_usd;
  }
  return {
    subtotal_usd: +subtotal.toFixed(2),
    n_lines: lines.length,
    n_priced: lines.length - unpriced.length,
    n_unpriced: unpriced.length,
    unpriced,
    is_lower_bound: unpriced.length > 0,
    read_this_total_as: unpriced.length > 0
      ? `A LOWER BOUND. ${unpriced.length} of ${lines.length} lines carry no price that was read from a public page, so the true cost is higher than this number by an unknown amount. The unpriced lines are listed, not hidden in the total.`
      : 'Every line carries a price read from a public vendor page on the date given. It is still a LIST price: an institution with a contract pays less, and nothing here is a quote.',
  };
}

/** Line total = unit price x packs, to cents. */
export function extend(unit_price_usd, packs) {
  if (unit_price_usd == null || packs == null) return null;
  return +(unit_price_usd * packs).toFixed(2);
}

/** RFC 4180 CSV. Quotes every field that needs it; never emits a bare newline inside a field unquoted. */
export function toCSV(columns, rows) {
  const cell = v => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map(c => cell(c.header ?? c.key)).join(',');
  const body = rows.map(r => columns.map(c => cell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n') + '\r\n';
}
