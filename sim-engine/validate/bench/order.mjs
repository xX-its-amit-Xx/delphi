// THE ORDERING EXPORT: files a research assistant can actually use.
//
// ============================== THE FINDING THAT SHAPES THIS FILE ==============================
// There is NO universal ordering-portal import format, and the usual assumption that there is one is
// wrong in a specific, expensive way. Of the major institutional portals, only two have a documented
// END-USER bulk line upload. The others have importers that exist but are administrator or integration
// paths a PI cannot run: one states plainly that only a buyer can run the import, another reads its flat
// file from an SFTP drop and cannot update an existing requisition, and two have no user-facing line
// import at all.
//
// Worse, for PUNCHOUT suppliers - which is how most lab consumables are actually bought - a buyer-authored
// file is structurally impossible. In punchout the VENDOR authors the cart message and posts it back; the
// supplier part number is the join key and only the vendor's catalogue owns that keyspace; and punchout
// catalogue rows carry no price at all, because the price is set per session. One major portal refuses
// them by name, saying its import does not support punchout items.
//
// So a single "portal CSV" would be a file that looks right and works nowhere. This module emits TWO
// artefacts instead:
//
//   1. A PORTABLE REQUISITION CSV - the columns every system shares, plus the institution-specific columns
//      present but BLANK. A requester pastes from it, or hands it to the buyer who can run the real import.
//   2. A VENDOR QUICK-ORDER FILE PER SUPPLIER - and this is the one that actually works. Every major lab
//      vendor has a quick-order paste box with its own tiny format. It needs no institutional
//      configuration, and - the real point - it is the only route that preserves CONTRACT pricing, which
//      is what replaces the list prices in this package with what the lab will actually pay.
//
// The documented workflow: punch out from the institutional portal, use the vendor's own quick-order paste
// inside that punchout session, return the cart. The cart comes back carrying the vendor's real part
// numbers and the institution's contract prices.

export const NO_UNIVERSAL_FORMAT =
  'There is no universal ordering-portal import format. Only some portals offer an end-user bulk line ' +
  'upload at all; several of the importers that exist can only be run by a buyer or an administrator. For ' +
  'punchout suppliers a buyer-authored file is structurally impossible, because the vendor owns the part ' +
  'number keyspace and sets the price per session. This module therefore emits a portable requisition CSV ' +
  'AND a per-vendor quick-order file, and says which one to use where.';

/** Tier (a): emit always. These map cleanly across every system examined. */
export const CORE_COLUMNS = [
  { key: 'line_number', header: 'Line' },
  { key: 'description', header: 'Description' },
  { key: 'quantity', header: 'Quantity' },
  { key: 'uom', header: 'UOM' },
  { key: 'unit_price', header: 'Unit Price' },
  { key: 'currency', header: 'Currency' },
  { key: 'extended_price', header: 'Extended Price' },
  { key: 'supplier_name', header: 'Supplier' },
  { key: 'supplier_part_number', header: 'Supplier Part Number' },
];

/** Tier (b): emit the column, leave it BLANK. Each is per-institution, and a guessed value is worse than
 *  an empty one - it routes the order to the wrong fund and is caught late or not at all. */
export const INSTITUTION_COLUMNS = [
  { key: 'account_code', header: 'Account Code' },
  { key: 'cost_center', header: 'Cost Center' },
  { key: 'project_code', header: 'Project Code' },
  { key: 'ship_to', header: 'Ship To' },
  { key: 'commodity_code', header: 'Commodity Code' },
  { key: 'need_by_date', header: 'Need By Date' },
];

/** Tier (c): names and units vary between systems. Emitted neutrally, with the mapping documented. */
export const VARIABLE_COLUMNS = [
  { key: 'catalog_number', header: 'Catalog Number' },
  { key: 'pack_size', header: 'Pack Size' },
  { key: 'catalog_number_with_pack', header: 'Catalog Number With Pack' },
  { key: 'manufacturer', header: 'Manufacturer' },
  { key: 'notes', header: 'Notes' },
];

export const COLUMN_NOTES = {
  supplier_part_number:
    'THE FIELD THAT DECIDES EVERYTHING. The general matching rule across portals: a line is treated as a ' +
    'catalogue item only when supplier, supplier part number and unit of measure ALL match the catalogue ' +
    'exactly. Anything else silently becomes a free-text non-catalogue line at list price, routed to a ' +
    'buyer. A near-miss does not error; it just quietly costs more and takes longer.',
  uom:
    'Prefer the vendor\'s own unit-of-measure string verbatim over a tidied one. At least one major portal ' +
    'maps an unrecognised supplier unit to "EA" by DEFAULT and warns that this presents invalid catalogue ' +
    'data - which is precisely how an order for one case becomes an order for one tube.',
  pack_size:
    'The biggest trap in the whole export. Systems disagree about where pack size lives: one keeps it as ' +
    'two parts, one returns it and will not accept it, one takes a unit code but no size, and one requires ' +
    'the pack size FUSED INTO THE SKU (as in a part number ending "-100G"). This file therefore emits ' +
    'catalog_number and pack_size separately AND a concatenated variant, so whichever the portal wants is ' +
    'already there.',
  unit_price:
    'No currency symbols and no thousands separators: 1099.00, never $1,099.00. At least one system rejects ' +
    'the formatted version. Prices here are LIST prices and will be replaced by contract prices when the ' +
    'order goes through a punchout session.',
  catalog_number:
    'Appears variously as Catalog No., Part Number, SKU, Supplier Part Number or a vendor-specific field, ' +
    'and is required in some portal configurations and explicitly optional in others. Several items in this ' +
    'package HAVE NO CATALOGUE NUMBER AT ALL because they are custom syntheses - those lines will always be ' +
    'free text, and the Notes column says so.',
  manufacturer:
    'Manufacturer part number is a DISTINCT field from supplier part number in every system examined. Do not ' +
    'collapse them: the reseller lines in this package have both, and they differ.',
};

/** Per-vendor quick-order formats, read from each vendor's own published template. These are the files
 *  that actually work, so their limits are recorded exactly. */
export const VENDOR_QUICK_ORDER = {
  'Thermo Fisher': { columns: ['Catalog Number', 'Quantity'], required: ['Catalog Number'], max_rows: 350, note: 'an ID column is additionally required for assays, siRNA and oligos.' },
  'Fisher Scientific': { columns: ['Part Number', 'UOM', 'Quantity Ordered'], required: ['Part Number'], max_rows: 100, note: 'unit of measure is optional and uses short codes such as PK, CS, EA.' },
  'NEB': { columns: ['Catalog #', 'Quantity'], required: ['Catalog #'], max_rows: 40, max_quantity: 999, note: 'the published template also carries recipient name and e-mail columns.' },
  'IDT': { columns: null, required: null, max_rows: null, note: 'guide RNAs, Ultramers and primers are custom syntheses ordered through IDT\'s own sequence entry tools, not by catalogue number. Only the enzymes and tracrRNA have catalogue numbers that a quick-order box would accept.' },
  'Addgene': { columns: null, required: null, max_rows: null, note: 'ordered individually from the plasmid record. Shipping is calculated at checkout and is never published, so it cannot appear in this file.' },
  'Synthego': { columns: null, required: null, max_rows: null, note: 'custom synthesis; no catalogue number is shown on the product page.' },
};

export const WORKFLOW = [
  'Check the bill of materials against what the lab already has. Nothing here knows your freezer.',
  'Hand the portable requisition CSV to whoever runs purchasing, or use it to fill a non-catalogue form line by line.',
  'For each vendor that has one, use the per-vendor quick-order file INSIDE a punchout session from your own portal. This is the step that replaces the list prices here with your institution\'s contract prices.',
  'Return the cart to the portal. It comes back carrying the vendor\'s real part numbers and your real prices.',
  'Expect the total to change. Every price in this package is a list price, and that is the point of doing it this way.',
];

const esc = v => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const rowOf = (cols, r) => cols.map(c => esc(r[c.key])).join(',');

/** The portable requisition CSV: core columns filled, institution columns present and blank. */
export function requisitionCSV(lines) {
  const cols = [...CORE_COLUMNS, ...INSTITUTION_COLUMNS, ...VARIABLE_COLUMNS];
  const head = cols.map(c => esc(c.header)).join(',');
  const body = lines.map((l, i) => rowOf(cols, {
    line_number: i + 1,
    description: l.what,
    quantity: l.packs,
    uom: l.uom ?? 'EA',
    unit_price: l.unit_price_usd == null ? '' : l.unit_price_usd.toFixed(2),
    currency: 'USD',
    extended_price: l.extended_price_usd == null ? '' : l.extended_price_usd.toFixed(2),
    supplier_name: l.vendor,
    supplier_part_number: l.supplier_part_number ?? l.catalogue_number ?? '',
    catalog_number: l.catalogue_number ?? '',
    pack_size: l.pack_size == null ? '' : `${l.pack_size} ${l.pack_unit ?? ''}`.trim(),
    catalog_number_with_pack: l.catalogue_number && l.pack_size != null ? `${l.catalogue_number}-${l.pack_size}${(l.pack_unit ?? '').toUpperCase().slice(0, 2)}` : '',
    manufacturer: l.supplier_part_number ? l.vendor.replace(/ \(.*\)$/, '') : '',
    notes: [l.no_catalogue_number_because && `NO CATALOGUE NUMBER: ${l.no_catalogue_number_because}. This line will be free text.`,
      l.why_unpriced && `NO PRICE: ${l.why_unpriced}.`,
      l.price_is_a_floor && `PRICE IS A FLOOR: ${l.price_is_a_floor}.`,
      l.supersedes && `SUPERSEDES: ${l.supersedes}`,
      l.replaces && `NOTE: ${l.replaces}`].filter(Boolean).join(' '),
    account_code: '', cost_center: '', project_code: '', ship_to: '', commodity_code: '', need_by_date: '',
  }));
  return [head, ...body].join('\r\n') + '\r\n';
}

/** One quick-order file per vendor that publishes a format, plus a list of the lines that cannot go in one. */
export function vendorQuickOrders(lines) {
  const out = {}, unorderable = [];
  for (const l of lines) {
    const vendorKey = Object.keys(VENDOR_QUICK_ORDER).find(v => l.vendor?.startsWith(v));
    const fmt = vendorKey ? VENDOR_QUICK_ORDER[vendorKey] : null;
    const part = l.supplier_part_number ?? l.catalogue_number;
    if (!fmt || !fmt.columns || !part) {
      unorderable.push({ what: l.what, vendor: l.vendor, why: !part ? (l.no_catalogue_number_because ?? 'no catalogue number') : (fmt ? fmt.note : 'this vendor publishes no quick-order format') });
      continue;
    }
    (out[vendorKey] ||= { format: fmt, rows: [] }).rows.push({ part, quantity: l.packs, uom: l.uom ?? 'EA', what: l.what });
  }
  const files = {};
  for (const [vendor, { format, rows }] of Object.entries(out)) {
    const head = format.columns.join(',');
    const body = rows.map(r => format.columns.map(c => esc(/quantity/i.test(c) ? r.quantity : /uom/i.test(c) ? r.uom : r.part)).join(','));
    files[vendor] = {
      filename: `quick-order-${vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
      csv: [head, ...body].join('\r\n') + '\r\n',
      rows: rows.length,
      over_limit: format.max_rows != null && rows.length > format.max_rows
        ? `${rows.length} rows exceeds this vendor's published limit of ${format.max_rows}; split the file.` : null,
      note: format.note,
    };
  }
  return { files, unorderable, workflow: WORKFLOW };
}
