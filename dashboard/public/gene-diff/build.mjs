#!/usr/bin/env node
/* gene-diff/build.mjs — assembles dashboard/public/gene-diff/data.json
 *
 * This is a VIEW BUILDER. It re-shapes values that already exist in the repository and derives
 * nothing biological. Every number it writes carries the file it came from. Where a value does
 * not exist, it writes an ABSENCE object with the reason, because a gap that renders as blank
 * reads as identity, which is the one thing an alignment view must never do.
 *
 * Reads (never writes):
 *   sequences/alignments/<gene>.json       MAFFT alignments, percent identity, known variant sites
 *   sequences/engineered-diff.json         the designs as diffs against the zebrafish reference
 *   sequences/genes.json                   the focal gene panel
 *   genotype/sequence-layer.json           flying-fish orthologue calls AND the two that FAILED
 *   genotype/causal-chains.json            per-gene chains with an evidence grade on every link
 *   omics/proteomic|transcriptomic|ptm|pathway/annotations.jsonl.gz
 *   omics/index/genes/<symbol>.json.gz     per-gene cards (concordance, conflicts)
 *   sim-engine/params/ontogeny.json        staged values with kinds
 *   sim-engine/validate/functional/results.json   the resolution ledger, per case
 *   sim-engine/validate/functional/compensation/{VALIDATION.json,COMPENSATION.md}
 *   sim-engine/validate/editplan/RESULTS.md       exact GRCz11 coordinates and codons
 *   dashboard/public/validate-show/structures/index.json   the interaction-class counters
 *
 * Run: node dashboard/public/gene-diff/build.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');       // dashboard/public/gene-diff -> repo root
const R = p => join(REPO, p);
const readJson = p => JSON.parse(readFileSync(R(p), 'utf8'));
const readGz = p => JSON.parse(gunzipSync(readFileSync(R(p))).toString('utf8'));
const readJsonl = p => gunzipSync(readFileSync(R(p))).toString('utf8')
  .split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const note = [];
const absence = (what, why, source) => ({ absent: true, what, why, source: source || null });

/* ------------------------------------------------------------------ the cases
 * The four committed cases, plus the two controls the ledger runs beside them.
 * Nothing about a gene, an organism or a part is hardcoded here: the triple
 * (base, generated, analogue) is read out of the ledger and the design record. */
const CASES = ['winged-zebrafish', 'tff', 'wingless-flying-fish', 'ff-zf-chimera'];
const CONTROLS = ['zebrafish-adult', 'flying-fish'];

const results = readJson('sim-engine/validate/functional/results.json');
const engineered = readJson('sequences/engineered-diff.json');
const seqLayer = readJson('genotype/sequence-layer.json');
const chains = readJson('genotype/causal-chains.json');
const ontogeny = readJson('sim-engine/params/ontogeny.json');
const compValidation = readJson('sim-engine/validate/functional/compensation/VALIDATION.json');
const compRules = readJson('sim-engine/validate/functional/compensation/compensation-rules.json');
const packIndex = readJson('dashboard/public/validate-show/structures/index.json');
const crosswalkFile = readJson('omics/pathway/pathway-crosswalk.json');
/* id -> the top cross-source matches, by gene-set Jaccard (NOT a curated identity) */
const crosswalk = new Map((crosswalkFile.crosswalk || []).map(e => [e.id, e]));

/* The design records live in sim-engine/validate/functional/designs.mjs. The ledger's own
 * copy of design.edits is abbreviated (it drops ref/pos/alt for some cases), so the full
 * genotype is read from that module — it is a plain export with no side effects — and the
 * alignment columns come from sequences/engineered-diff.json. Nothing in sim-engine is written. */
const { DOCUMENTED } = await import(
  new URL('../../../sim-engine/validate/functional/designs.mjs', import.meta.url).href);
const designRecordOf = id => DOCUMENTED[id] || null;

/* ----------------------------------------------------- the alignments on disk */
const ALIGN_DIR = 'sequences/alignments';
const focalGenes = readJson('sequences/genes.json');
const alignmentCache = new Map();
function alignmentFor(gene) {
  if (alignmentCache.has(gene)) return alignmentCache.get(gene);
  const p = `${ALIGN_DIR}/${gene}.json`;
  const v = existsSync(R(p)) ? readJson(p) : null;
  alignmentCache.set(gene, v);
  return v;
}

/* position (1-based, own protein) <-> alignment column (1-based) for one aligned row */
function indexRow(aligned) {
  const posToCol = [null], colToPos = [null];
  let pos = 0;
  for (let i = 0; i < aligned.length; i++) {
    const c = aligned[i];
    if (c === '-' || c === '.') { colToPos.push(null); continue; }
    pos++; posToCol.push(i + 1); colToPos.push(pos);
  }
  return { posToCol, colToPos, ungapped: aligned.replace(/[-.]/g, '') };
}

/* ------------------------------------------------------------ the omics layers
 * Loaded once and bucketed by gene symbol. 830k rows in total, so this is the
 * expensive part of the build and it runs exactly once. */
function bucket(rows) {
  const by = new Map();
  for (const r of rows) {
    const s = r?.gene?.symbol; if (!s) continue;
    if (!by.has(s)) by.set(s, []);
    by.get(s).push(r);
  }
  return by;
}
const proteomic = bucket(readJsonl('omics/proteomic/annotations.jsonl.gz'));
const transcriptomic = bucket(readJsonl('omics/transcriptomic/annotations.jsonl.gz'));
const ptm = bucket(readJsonl('omics/ptm/annotations.jsonl.gz'));
const pathway = bucket(readJsonl('omics/pathway/annotations.jsonl.gz'));
note.push(`omics loaded: proteomic ${proteomic.size} genes, transcriptomic ${transcriptomic.size}, ptm ${ptm.size}, pathway ${pathway.size}`);

const cardFor = sym => existsSync(R(`omics/index/genes/${sym}.json.gz`)) ? readGz(`omics/index/genes/${sym}.json.gz`) : null;

/* ------------------------------------------------ editplan: exact coordinates
 * The planner needs the network to resolve a locus, so the committed coordinates are
 * read out of its own RESULTS.md table (section 1 and section 0b) rather than re-derived.
 * Each entry quotes the line it came from so the page can show the provenance. */
const EDITPLAN_MD = readFileSync(R('sim-engine/validate/editplan/RESULTS.md'), 'utf8');
function editplanRow(label) {
  // find a line of the section-1 table and return the three cells
  const re = new RegExp(`^\\|\\s*${label}\\s*\\|(.+)$`, 'm');
  const m = EDITPLAN_MD.match(re);
  if (!m) return null;
  return m[1].split('|').map(s => s.trim().replace(/\*\*/g, '')).filter((_, i, a) => i < a.length - 1 || true);
}
const EDITPLAN = (() => {
  const rows = {};
  for (const key of ['gene', 'canonical transcript', 'protein', 'chromosome / strand', 'CDS positions',
    'reference codon', 'genomic coordinates', 'genome vs CDS', 'desired codon', 'nucleotide change',
    'transition or transversion', 'codon usage of the new codon']) {
    const cells = editplanRow(key.replace(/[/]/g, '\\/'));
    if (cells) rows[key] = cells;
  }
  const col = i => Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v[i] ?? null]));
  const plans = {
    'kcnk5b:p.W169L': col(0),
    'kcnk5b:p.F241Y': col(1),
    'hhip:knockout': col(2),
  };
  // slc43a2a p.T200K is in section 0b prose, not the table
  const t200 = EDITPLAN_MD.match(/`slc43a2a` p\.T200K resolves cleanly:[\s\S]{0,420}?protein check\./);
  plans['slc43a2a:p.T200K'] = {
    gene: '`ENSDARG00000036848`',
    'chromosome / strand': '15 / +',
    'nucleotide change': 'c.599C>A = GRCz11 15:28,390,802',
    'transition or transversion': 'TRANSVERSION',
    quote: t200 ? t200[0].replace(/\s+/g, ' ').replace(/\*\*/g, '') : null,
  };
  const kcnh2aRefusal = EDITPLAN_MD.match(/> this module plans point changes[\s\S]*?NOT\*\* planned here\./);
  plans['kcnh2a:regulatory'] = {
    refused: true,
    refusal: kcnh2aRefusal ? kcnh2aRefusal[0].replace(/^> /gm, '').replace(/\s+/g, ' ').replace(/\*\*/g, '') : null,
  };
  return plans;
})();
for (const k of Object.keys(EDITPLAN)) {
  const v = EDITPLAN[k];
  if (!v.refused && !v.gene) note.push(`editplan: no table row parsed for ${k}`);
}

function editplanFor(gene, ed) {
  const keys = [
    `${gene}:${ed.raw || ''}`,
    ed.kind === 'regulatory' ? `${gene}:regulatory` : null,
    ed.kind === 'nonsense' ? `${gene}:knockout` : null,
  ].filter(Boolean);
  for (const k of keys) if (EDITPLAN[k]) return { key: k, ...EDITPLAN[k] };
  return absence('an exact GRCz11 editing plan for this change',
    `sim-engine/validate/editplan ran plans for kcnk5b p.W169L, kcnk5b p.F241Y, hhip loss of function and slc43a2a p.T200K. ${gene} ${ed.raw || ed.kind} is not among them, so no coordinate, codon or guide is shown for it.`,
    'sim-engine/validate/editplan/RESULTS.md');
}

/* ------------------------------------------------------------ scale 1: sequence */
const PROJECTED = new Set(                       // flying-fish rows that are tblastn projections
  (seqLayer.orthologues_not_resolved || []).map(o => o.gene));

function analogueRowKey(al) {
  // the functional analogue's own orthologue, when the alignment holds one
  if (al.alignment.hirundichthys_speculiger) return 'hirundichthys_speculiger';
  return null;
}

function annotationTracks(gene, al, baseIdx) {
  const tracks = { domains: [], ptm: [], alleles: [], notPlaced: [] };

  /* domains: InterPro / Pfam positions. They are numbered on the UniProt accession the
   * proteomic layer chose, which is NOT always the Ensembl protein the alignment holds.
   * A domain is placed only when the two lengths agree; otherwise it is refused in place. */
  const pro = proteomic.get(gene) || [];
  const lenRow = pro.find(r => r.feature === 'protein_length');
  const omicsLen = lenRow ? Number(lenRow.value) : null;
  const alignedLen = al.sequences.danio_rerio.length;
  const lengthsAgree = omicsLen != null && omicsLen === alignedLen;
  for (const r of pro) {
    if (r.feature !== 'domain' && r.feature !== 'region' && r.feature !== 'zinc_finger' && r.feature !== 'motif') continue;
    for (const p of r.positions || []) {
      const entry = {
        name: String(r.value), feature: r.feature, db: r.source.db, acc: r.source.accession,
        url: r.source.url, kind: r.kind, evidence: r.evidence,
        posStart: p.start, posEnd: p.end,
        colStart: lengthsAgree ? baseIdx.posToCol[p.start] ?? null : null,
        colEnd: lengthsAgree ? baseIdx.posToCol[p.end] ?? null : null,
        accession: r.protein_accession || null,
      };
      if (entry.colStart && entry.colEnd) tracks.domains.push(entry);
      else tracks.notPlaced.push({ ...entry, why: lengthsAgree
        ? `positions ${p.start}-${p.end} fall outside the aligned protein (${alignedLen} aa)`
        : `the proteomic layer numbers this domain on ${r.protein_accession || r.source.accession} (${omicsLen ?? 'length not recorded'} aa) and the alignment holds Ensembl ${al.sequences.danio_rerio.protein_id} (${alignedLen} aa); the two are not the same protein, so the positions are not placed on this alignment` });
    }
  }

  /* PTM sites. Placed only when the residue the source names is the residue at that
   * position of the aligned zebrafish protein — the cheapest real check available. */
  for (const r of ptm.get(gene) || []) {
    const v = r.value || {};
    const pos = v.zf_position ?? v.position;
    const res = v.zf_residue ?? v.residue;
    if (!pos) continue;
    const at = baseIdx.ungapped[pos - 1];
    const entry = {
      pos, residue: res, at, modification: v.modification || r.feature,
      feature: r.feature, conservation: v.conservation ?? null,
      borrowedFrom: r.kind === 'borrowed-ortholog' ? (v.source_species || r.species) : null,
      sourceProtein: v.source_protein || null,
      db: r.source.db, url: r.source.url, kind: r.kind, evidence: r.evidence,
      licence: r.source.licence || null,
      flyingFish: r.flying_fish ? {
        residue: r.flying_fish.residue, state: r.flying_fish.state,
        motifIdentity: r.flying_fish.motif_identity_vs_zebrafish ?? null,
        caveat: r.flying_fish.caveat,
      } : null,
      col: at === res ? baseIdx.posToCol[pos] ?? null : null,
      note: r.note || null,
    };
    if (entry.col) tracks.ptm.push(entry);
    else tracks.notPlaced.push({ ...entry, name: `${res || '?'}${pos} ${entry.modification}`, why: at === undefined
      ? `position ${pos} is past the end of the aligned protein (${alignedLen} aa)`
      : `the source names ${res} at ${pos} and the aligned protein carries ${at} there, so the site is numbered on another protein and is not placed` });
  }

  /* known alleles and convergent sites: the alignment file's own variant list, which
   * already carries the alignment column and the per-species residue. */
  for (const v of al.variants || []) {
    tracks.alleles.push({
      id: v.id, col: v.alignment_column_1based ?? null, pos: v.pos, ref: v.ref, alt: v.alt,
      what: v.what, source: v.source, coordSpecies: v.coord_species,
      refMatches: v.reference_matches ?? null,
      referenceResidue: v.reference_residue_in_ensembl116_protein ?? null,
      residues: v.residues || null,
    });
  }
  return tracks;
}

function sequenceScaleFor(caseId, ledgerDesign) {
  const edits = ledgerDesign?.edits || [];
  if (!edits.length) {
    return {
      absent: true,
      what: 'a sequence diff',
      why: ledgerDesign?.no_genotype_note || 'this design carries no gene-level edits, so there is no sequence difference to align',
      source: 'sim-engine/validate/functional/results.json ledger.design',
      statusCaveat: ledgerDesign?.status_caveat || null,
    };
  }
  const editCols = new Map();   // gene -> [{col,...}]
  const effects = caseId === 'winged-zebrafish' ? engineered.winged_zebrafish.protein_effects
    : caseId === 'tff' ? engineered.hypothetical_flier.protein_effects : [];
  for (const e of effects) {
    if (!editCols.has(e.gene)) editCols.set(e.gene, []);
    editCols.get(e.gene).push(e);
  }

  const genes = [];
  for (const ed of edits) {
    const gene = ed.gene;
    const al = alignmentFor(gene);
    const effs = editCols.get(gene) || [];
    const eff = effs.find(e => e.zebrafish_position === ed.pos) || null;

    if (!al) {
      genes.push({
        gene, edit: ed, aminoAcidChange: null,
        alignment: absence('an alignment for this locus',
          `sequences/alignments/ holds MAFFT alignments for the 9 focal fin genes; ${gene} is not one of them`,
          'sequences/README.md'),
      });
      continue;
    }
    const baseAligned = al.alignment.danio_rerio;
    const baseIdx = indexRow(baseAligned);
    const tracks = annotationTracks(gene, al, baseIdx);

    /* the generated row: the base row with the recorded amino-acid change applied at the
     * recorded alignment column. A regulatory edit changes 0 amino acids and is said so. */
    let genAligned = baseAligned, aaChange = null, columnCheck = null;
    if (eff) {
      const col = eff.alignment_column;
      const have = baseAligned[col - 1];
      columnCheck = {
        col, expected: eff.zebrafish_residue_before, found: have,
        posFromColumn: baseIdx.colToPos[col], posRecorded: eff.zebrafish_position,
        ok: have === eff.zebrafish_residue_before && baseIdx.colToPos[col] === eff.zebrafish_position,
      };
      if (!columnCheck.ok) {
        note.push(`COLUMN CHECK FAILED ${gene} ${eff.edit}: column ${col} holds ${have} at own-protein position ${baseIdx.colToPos[col]}; the record says ${eff.zebrafish_residue_before}${eff.zebrafish_position}`);
      } else {
        genAligned = baseAligned.slice(0, col - 1) + eff.residue_after + baseAligned.slice(col);
        aaChange = { col, pos: eff.zebrafish_position, from: eff.zebrafish_residue_before, to: eff.residue_after };
      }
    }

    const anaKey = analogueRowKey(al);
    const anaMeta = anaKey ? al.sequences[anaKey] : null;
    const proxyMeta = al.sequences.oryzias_latipes || null;

    const rows = [
      { role: 'base', label: 'base', species: al.sequences.danio_rerio.species,
        common: al.sequences.danio_rerio.common, proteinId: al.sequences.danio_rerio.protein_id,
        length: al.sequences.danio_rerio.length, seq: baseAligned,
        provenance: al.sequences.danio_rerio.source, kind: 'measured' },
      { role: 'generated', label: 'generated', species: al.sequences.danio_rerio.species,
        common: `${al.sequences.danio_rerio.common}, edited`, proteinId: `${al.sequences.danio_rerio.protein_id} + ${ed.raw || ed.kind}`,
        length: al.sequences.danio_rerio.length, seq: genAligned,
        provenance: ed.source, kind: ed.kind_of_evidence || 'curated',
        identical: genAligned === baseAligned,
        identicalWhy: genAligned === baseAligned
          ? (ed.kind === 'regulatory'
            ? `${ed.allele || ed.gene} changes 0 amino acids: the coding sequence is unchanged and the effect is ectopic expression of a wild-type protein. There is no residue to colour, and a row drawn as identical here is the truth.`
            : 'no amino-acid change was placed on this alignment')
          : null },
    ];
    rows.push(anaKey
      ? { role: 'analogue', label: 'analogue', species: anaMeta.species, common: anaMeta.common,
          proteinId: anaMeta.protein_id, length: anaMeta.length, seq: al.alignment[anaKey],
          provenance: anaMeta.source, kind: 'measured',
          projection: PROJECTED.has(gene),
          projectionWhy: PROJECTED.has(gene)
            ? (seqLayer.orthologues_not_resolved.find(o => o.gene === gene) || {}).why_not_an_orthologue_call || null
            : null,
          caveat: anaMeta.caveat || null }
      : { role: 'analogue', ...absence(`the analogue's own ${gene} sequence`,
          'no flying-fish row is in this alignment', 'sequences/alignments') });
    if (proxyMeta) {
      rows.push({ role: 'proxy', label: 'analogue proxy', species: proxyMeta.species, common: proxyMeta.common,
        proteinId: proxyMeta.protein_id, length: proxyMeta.length, seq: al.alignment.oryzias_latipes,
        provenance: proxyMeta.source, kind: 'measured', why: proxyMeta.role });
    }

    /* classify every column that is not identical across the drawn rows */
    const cols = baseAligned.length;
    const domainAt = new Array(cols + 1).fill(null);
    for (const d of tracks.domains) for (let c = d.colStart; c <= d.colEnd; c++) if (!domainAt[c]) domainAt[c] = d;
    const ptmAt = new Map(); for (const p of tracks.ptm) ptmAt.set(p.col, p);
    const alleleAt = new Map(); for (const a of tracks.alleles) if (a.col) alleleAt.set(a.col, a);
    const editAt = new Map(); if (aaChange) editAt.set(aaChange.col, aaChange);

    const anaSeq = anaKey ? al.alignment[anaKey] : null;
    const GAP = ch => ch === '-' || ch === '.';
    const diffs = [], meaningCount = {};
    let anaGapCols = 0;
    for (let c = 1; c <= cols; c++) {
      const b = baseAligned[c - 1], g = genAligned[c - 1], a = anaSeq ? anaSeq[c - 1] : null;
      const genDiff = g !== b;
      const anaDiff = anaSeq != null && a !== b;
      if (!genDiff && !anaDiff) continue;
      /* A gap in the analogue row is NOT a residue difference. On a projected row it is
       * sequence the projection did not cover, and colouring it as divergence would make
       * the analogue look further away than the data says. It gets its own class. */
      const anaIsGap = anaSeq != null && (GAP(a) || GAP(b));
      if (anaIsGap) anaGapCols++;
      const meaning = editAt.has(c) ? 'edit'
        : (anaIsGap && !genDiff) ? 'gap'
        : alleleAt.has(c) ? 'allele'
        : ptmAt.has(c) ? 'ptm'
        : domainAt[c] ? 'domain'
        : 'unannotated';
      meaningCount[meaning] = (meaningCount[meaning] || 0) + 1;
      diffs.push({
        col: c, pos: baseIdx.colToPos[c], base: b, generated: g, analogue: a,
        genDiff, anaDiff, anaIsGap, meaning,
        domain: domainAt[c] ? { name: domainAt[c].name, acc: domainAt[c].acc, url: domainAt[c].url, db: domainAt[c].db, posStart: domainAt[c].posStart, posEnd: domainAt[c].posEnd } : null,
        ptm: ptmAt.get(c) || null,
        allele: alleleAt.get(c) || null,
        edit: editAt.get(c) || null,
      });
    }
    /* annotated diffs are the ones that get a drawer; the rest are counted, not listed.
     * A gap column is never a drawer: there is no residue there to say anything about. */
    const annotatedCols = diffs
      .filter(d => d.meaning !== 'unannotated' && d.meaning !== 'gap' || d.genDiff)
      .map(d => d.col);
    /* the same site can arrive from several databases; keep one refusal per site and reason */
    const seen = new Set();
    tracks.notPlaced = tracks.notPlaced.filter(n => {
      const k = `${n.name || n.modification || ''}|${n.posStart ?? n.pos}|${n.why}`;
      if (seen.has(k)) return false; seen.add(k); return true;
    });

    genes.push({
      gene, edit: ed, effect: eff || null, columnCheck,
      aminoAcidChange: aaChange,
      editplan: editplanFor(gene, ed),
      aligner: al.aligner, coordinateSystem: al.coordinate_system,
      columns: cols, rows, tracks, diffs, annotatedCols,
      meaningCount, anaGapCols,
      gapNote: anaGapCols ? `${anaGapCols} of the ${diffs.length} non-identical columns are a gap in one of the two rows rather than a different residue`
        + (PROJECTED.has(gene) ? ', and this analogue row is a tblastn projection, so its gaps are sequence the projection did not cover, not deletions' : '') + '.' : null,
      percentIdentity: anaKey && al.percent_identity?.matrix
        ? (al.percent_identity.matrix.danio_rerio || {})[anaKey] ?? null : null,
      identityToSpecies: eff?.identity_to_species || null,
      identityToReference: eff?.identity_to_unedited_reference || null,
      flyingFishOrthologue: (seqLayer.orthologues_resolved || []).find(o => o.gene === gene)
        || (seqLayer.orthologues_not_resolved || []).find(o => o.gene === gene) || null,
      hasCard: !!cardFor(gene),
    });
  }
  return { genes };
}

/* --------------------------------------------- scale 2: the per-gene drawers */
const STAGE_ORDER_CAVEAT =
  'No developmental ordering of ZFS stages is sourced anywhere in this repository, so stages are listed by ZFS identifier. That order is not a sourced developmental order.';

function expressionPanel(gene) {
  const rows = transcriptomic.get(gene) || [];
  if (!rows.length) return absence('expression for this gene', 'no row in omics/transcriptomic for this symbol', 'omics/transcriptomic/annotations.jsonl.gz');
  const cells = new Map();   // anatomy|stage -> cell
  const bySource = {}, byFeature = {};
  for (const r of rows) {
    bySource[r.source.db] = (bySource[r.source.db] || 0) + 1;
    byFeature[r.feature] = (byFeature[r.feature] || 0) + 1;
    if (r.feature !== 'expressed_in' && r.feature !== 'not_expressed_in' && r.feature !== 'cell_type_marker') continue;
    const an = r.context?.anatomy;
    const st = r.context?.stage;
    const key = `${an?.id || 'no-anatomy'}|${st?.id || 'no-stage'}`;
    if (!cells.has(key)) cells.set(key, {
      anatomy: an ? { id: an.id, label: an.label, uberon: an.uberon || null } : null,
      stage: st ? { id: st.id, label: st.label } : null,
      present: 0, absent: 0, marker: 0, dbs: {}, kinds: {}, evidence: {},
    });
    const c = cells.get(key);
    if (r.feature === 'expressed_in') c.present++;
    else if (r.feature === 'not_expressed_in') c.absent++;
    else c.marker++;
    c.dbs[r.source.db] = (c.dbs[r.source.db] || 0) + 1;
    c.kinds[r.kind] = (c.kinds[r.kind] || 0) + 1;
    if (r.evidence) c.evidence[r.evidence] = (c.evidence[r.evidence] || 0) + 1;
  }
  const all = [...cells.values()];
  const score = c => (c.present + c.absent + c.marker) + Object.keys(c.dbs).length * 10;
  all.sort((a, b) => score(b) - score(a));
  const shown = all.slice(0, 48);
  const stageIds = [...new Set(shown.map(c => c.stage?.id).filter(Boolean))].sort();
  const anatomyIds = [...new Set(shown.map(c => c.anatomy?.id).filter(Boolean))];
  /* the non-independence that matters: Bgee imports ZFIN's in situ data */
  const dbs = Object.keys(bySource);
  return {
    rows: rows.length, bySource, byFeature,
    cells: shown, cellsTotal: all.length,
    stageIds, anatomyIds,
    stageOrderCaveat: STAGE_ORDER_CAVEAT,
    nonIndependence: dbs.includes('Bgee') && dbs.includes('ZFIN')
      ? 'Bgee imports ZFIN\'s in situ data, so a ZFIN row and a Bgee row supporting the same call are NOT two independent sources. omics/transcriptomic/SOURCES.md: "Bgee\'s zebrafish pectoral-fin calls are almost entirely ZFIN in situ. Only 9 genes have a non-in-situ Bgee pectoral-fin call, so Bgee adds no independent fin evidence."'
      : null,
    source: 'omics/transcriptomic/annotations.jsonl.gz; provenance per row',
  };
}

function proteomicPanel(gene) {
  const rows = proteomic.get(gene) || [];
  if (!rows.length) return absence('protein-level data for this gene', 'no row in omics/proteomic for this symbol', 'omics/proteomic/annotations.jsonl.gz');
  const out = { rows: rows.length, domains: [], structure: null, detection: [], abundance: [], length: null, families: [], topology: null, location: [] };
  for (const r of rows) {
    if (r.feature === 'domain' || r.feature === 'region' || r.feature === 'zinc_finger' || r.feature === 'motif')
      out.domains.push({ name: String(r.value), feature: r.feature, db: r.source.db, acc: r.source.accession, url: r.source.url, positions: r.positions || null, kind: r.kind, evidence: r.evidence, accession: r.protein_accession || null });
    else if (r.feature === 'predicted_structure')
      out.structure = { ...(r.value && typeof r.value === 'object' ? r.value : {}), db: r.source.db, url: r.source.url, kind: r.kind, evidence: r.evidence };
    else if (r.feature === 'protein_detected')
      out.detection.push({ value: r.value, db: r.source.db, url: r.source.url, kind: r.kind, evidence: r.evidence });
    else if (r.feature === 'protein_abundance')
      out.abundance.push({ value: r.value, unit: r.unit, anatomy: r.context?.anatomy || null, db: r.source.db, url: r.source.url, kind: r.kind, evidence: r.evidence });
    else if (r.feature === 'protein_length') out.length = { value: Number(r.value), accession: r.protein_accession || r.source.accession, db: r.source.db };
    else if (r.feature === 'protein_family') out.families.push(String(r.value));
    else if (r.feature === 'membrane_topology') out.topology = String(r.value);
    else if (r.feature === 'subcellular_location') out.location.push(String(r.value));
  }
  out.noFinTissue = packIndex.global.fin_tissue_proteomics;
  out.noFlyingFishProteome = packIndex.global.flying_fish;
  if (!out.structure) out.structureAbsence = absence('an AlphaFold model', 'no predicted_structure row for this gene', 'omics/proteomic');
  if (!out.detection.length) out.detectionAbsence = absence('mass-spectrometry detection', 'no protein_detected row: the protein is inferred from the gene and has never been seen in a zebrafish MS experiment in our pack', 'omics/proteomic');
  return out;
}

function ptmPanel(gene) {
  const rows = ptm.get(gene) || [];
  if (!rows.length) return absence('PTM sites for this gene', 'no row in omics/ptm for this symbol', 'omics/ptm/annotations.jsonl.gz');
  const sites = rows.map(r => {
    const v = r.value || {};
    return {
      pos: v.zf_position ?? v.position ?? null, residue: v.zf_residue ?? v.residue ?? null,
      modification: v.modification || r.feature, feature: r.feature,
      conservation: v.conservation ?? null,
      borrowedFrom: r.kind === 'borrowed-ortholog' ? (v.source_species || r.species) : null,
      sourceProtein: v.source_protein || null,
      db: r.source.db, url: r.source.url, licence: r.source.licence || null, kind: r.kind, evidence: r.evidence,
      motif: r.motif || null,
      flyingFish: r.flying_fish ? { residue: r.flying_fish.residue, state: r.flying_fish.state, motifIdentity: r.flying_fish.motif_identity_vs_zebrafish ?? null, caveat: r.flying_fish.caveat } : null,
    };
  });
  const borrowed = sites.filter(s => s.borrowedFrom).length;
  const conserv = {};
  for (const s of sites) if (s.conservation) conserv[s.conservation] = (conserv[s.conservation] || 0) + 1;
  return {
    rows: rows.length, sites: sites.slice(0, 60), sitesTotal: sites.length,
    borrowed, conservation: conserv,
    borrowedRule: 'A site marked "borrowed from Homo sapiens" was reported in the human protein and mapped onto the zebrafish protein by alignment. It is not a zebrafish measurement.',
    source: 'omics/ptm/annotations.jsonl.gz',
  };
}

function pathwayPanel(gene) {
  const rows = pathway.get(gene) || [];
  if (!rows.length) return absence('pathway membership for this gene', 'no row in omics/pathway for this symbol (KEGG rows are local-only and never deployed)', 'omics/pathway/annotations.jsonl.gz');
  const members = [];
  const bySource = {};
  for (const r of rows) {
    bySource[r.source.db] = (bySource[r.source.db] || 0) + 1;
    if (r.feature !== 'pathway_member' && r.feature !== 'go_process') continue;
    members.push({
      name: String(r.value), feature: r.feature, db: r.source.db, acc: r.source.accession, url: r.source.url,
      kind: r.kind, evidence: r.evidence,
      concordance: r.concordance || null,
    });
  }
  const card = cardFor(gene);
  const cardPathway = card?.layers?.pathway || null;
  return {
    rows: rows.length, bySource,
    members: members.slice(0, 40), membersTotal: members.length,
    cardSummary: card?.summary?.pathway || null,
    cardConcordance: cardPathway ? Object.fromEntries(Object.entries(cardPathway.features || {}).map(([f, v]) => [f, { nRows: v.n_rows, nDistinct: v.n_distinct, nMultiSource: v.n_multi_source }])) : null,
    conflicts: card?.conflicts || [],
    crosswalkNote: `Cross-source equivalence between pathway databases is a gene-set Jaccard overlap (omics/pathway/pathway-crosswalk.json, ${crosswalk.size} pathways), not a curated identity: KEGG Wnt and Reactome "Signaling by WNT" overlap at J = 0.19.`,
    keggCaveat: 'KEGG rows are local-only and are not in the deployed annotation file, so no KEGG membership appears here.',
    source: 'omics/pathway/annotations.jsonl.gz',
  };
}

/* developmental time: the organism's own sourced stage series, beside the gene's stages */
function ontogenyAxis(speciesKey) {
  const sp = ontogeny.species?.[speciesKey];
  if (!sp) return absence(`an ontogeny series for ${speciesKey}`, 'sim-engine/params/ontogeny.json has no entry for this species', 'sim-engine/params/ontogeny.json');
  return {
    taxon: sp.taxon, reference: sp.growth_reference || null,
    stages: (sp.stages || []).map(s => ({
      key: s.key, ageDays: s.age_days, dpf: s.dpf ?? null, label: s.label,
      fields: Object.fromEntries(Object.entries(s.fields || {}).map(([k, v]) => [k, {
        value: v.value, unit: v.unit ?? null, kind: v.kind,
        source: v.source?.cite || null, locator: v.source?.locator || null, note: v.note || null,
      }])),
    })),
    kinds: ontogeny.kinds, nullRule: ontogeny.null_rule, ageAxis: ontogeny.age_axis,
    source: 'sim-engine/params/ontogeny.json',
  };
}

function chainFor(gene) {
  const g = (chains.genes || []).find(x => x.symbol === gene);
  if (!g) return absence('a causal chain for this gene', `genotype/causal-chains.json carries chains for ${chains.coverage.genes_with_a_chain} genes; ${gene} is not one of them`, 'genotype/causal-chains.json');
  return {
    symbol: g.symbol, chainStrength: g.chain_strength, weakestGrade: g.weakest_grade, bestGrade: g.best_grade,
    weakestLink: g.weakest_link || null, complete: g.chain_complete,
    nSources: g.n_sources, nFullText: g.n_full_text_sources, nAbstractOnly: g.n_abstract_only_sources,
    steps: (g.chain || []).map(s => ({
      step: s.step, from: s.from, to: s.to, grade: s.evidence_grade, organism: s.organism,
      experiment: s.experiment_type || null, stage: s.stage || null,
      sources: (s.sources || []).slice(0, 3).map(x => ({ pmid: x.pmid, year: x.year, firstAuthor: x.first_author, title: x.title, read: x.read })),
      notes: s.notes || null,
    })),
    grades: chains.grades,
    gaps: g.gaps || null,
  };
}

function interactionPanel(gene) {
  const rows = (proteomic.get(gene) || []).filter(r => r.feature === 'interacts_with');
  const byClass = {};
  for (const r of rows) {
    const k = r.interaction_class || '(class not recorded)';
    if (!byClass[k]) byClass[k] = { n: 0, partners: [] };
    byClass[k].n++;
    if (byClass[k].partners.length < 14) byClass[k].partners.push({
      partner: String(r.value), score: r.score ?? null, db: r.source.db, url: r.source.url,
      kind: r.kind, evidence: r.evidence, channels: r.channels || null,
      inUniverse: r.partner?.in_universe ?? null,
    });
  }
  const countRow = (proteomic.get(gene) || []).find(r => r.feature === 'interaction_partner_count');
  return {
    total: rows.length, byClass,
    partnerCount: countRow ? { value: countRow.value, evidence: countRow.evidence, db: countRow.source.db } : null,
    absence: rows.length ? null : absence('an interaction neighbourhood', 'no interacts_with row above the STRING 0.700 cut for this gene', 'omics/proteomic'),
  };
}

/* ------------------------------------------- scale 3: compensation and analogy */
const COMP_MD = readFileSync(R('sim-engine/validate/functional/compensation/COMPENSATION.md'), 'utf8');
const COMP_HEADLINE = (() => {
  const m = COMP_MD.match(/drawn from the papers it was derived from, and 4\/13 on cases independent of them \(31%\)[\s\S]{0,320}?\n\n/);
  return m ? m[0].replace(/\s+/g, ' ').replace(/\*\*/g, '').trim() : null;
})();

const compensation = {
  accuracyIndependent: { correct: 4, of: 13, pct: 31 },
  accuracyAtHome: { correct: 11, of: 12 },
  allErrorsAreFalsePositives: true,
  verdict: compValidation.honest_accounting?.verdict || null,
  headline: COMP_HEADLINE,
  scoringRule: results.cases['winged-zebrafish']?.ledger?.compensation_rule?.scoring_rule || null,
  classes: compRules.classes || null,
  renderRule:
    '"plausible-by-rule" is an UNMET requirement with a review flag, never a resolved compensation. '
    + 'A requirement is MET by compensation only on class "documented" AND functional_rescue === true. '
    + 'All nine of the rule\'s independent errors are false positives: it predicted a compensation response where none was published.',
  source: 'sim-engine/validate/functional/compensation/{COMPENSATION.md,VALIDATION.json,compensation-rules.json}',
};

function analogyFor(row, caseGenes) {
  /* the proposed analogous or supplementary set, drawn from what the repo actually holds for
   * this gene: its pathway memberships and the cross-source crosswalk. The verdict class is
   * carried verbatim and never upgraded. */
  const pw = pathwayPanel(row.gene);
  const proposals = [];
  if (!pw.absent) {
    const seen = new Set();
    for (const m of pw.members) {
      if (seen.has(m.acc)) continue; seen.add(m.acc);
      if (proposals.length >= 8) break;
      const cw = crosswalk.get(m.acc) || null;
      proposals.push({
        set: m.name, acc: m.acc, db: m.db, url: m.url, kind: m.kind,
        crosswalk: cw ? {
          source: cw.source, size: cw.size,
          matches: Object.entries(cw.best_matches || {}).flatMap(([src, list]) =>
            (list || []).slice(0, 1).map(x => ({ source: src, id: x.id, name: x.name, jaccard: x.jaccard, sharedGenes: x.shared_genes }))),
        } : null,
        whatThisIs: 'annotated co-membership of a pathway or GO process. It is NOT a demonstration that this set compensates for the missing state.',
      });
    }
  }
  return {
    gene: row.gene, verdictClass: row.class, verdictVerbatim: row.difference,
    searchDepth: row.search_depth,
    unresolvedCaveat: row.unresolved_caveat || null,
    hypothesis: row.hypothesis === true,
    hypothesisWhy: row.hypothesis_why || null,
    requirement: row.requirement,
    proposals,
    pathwayAbsence: pw.absent ? pw : null,
    classifierRan: false,
    classifierNote:
      `The compensation classifier returned no COMPENSATORY row for any case in this ledger `
      + `(every case's counts.COMPENSATORY is 0). Nothing here is a compensation finding: these are `
      + `pathway sets the gene is annotated into. The rule that would propose a compensation scores `
      + `4 of 13 (31 %) on cases independent of the papers it was built from, with all nine errors false positives.`,
    requirementStatus: 'UNMET — review flag',
  };
}

/* ------------------------------------------ scale 5: the control plane arrows */
function controlPlane(caseId, ledger) {
  const control = results.cases['zebrafish-adult']?.ledger;
  const rowsById = new Map((ledger.ledger || []).map(r => [r.id, r]));
  const ctrlById = new Map((control?.ledger || []).map(r => [r.id, r]));
  const moved = [];
  for (const [id, r] of rowsById) {
    const c = ctrlById.get(id);
    if (!c) { moved.push({ id, gene: r.gene, from: null, to: r.class }); continue; }
    if (c.class !== r.class) moved.push({ id, gene: r.gene, from: c.class, to: r.class, requirement: r.requirement });
  }
  const arrows = [];
  for (const ed of ledger.design?.edits || []) {
    const al = alignmentFor(ed.gene);
    const eff = (caseId === 'winged-zebrafish' ? engineered.winged_zebrafish.protein_effects
      : caseId === 'tff' ? engineered.hypothetical_flier.protein_effects : [])
      .find(e => e.gene === ed.gene && e.zebrafish_position === ed.pos) || null;
    /* DRIVES: what the edit changes by definition of the edit itself */
    const drives = [];
    if (eff) drives.push({
      to: `${ed.gene} residue ${eff.zebrafish_position}: ${eff.zebrafish_residue_before} becomes ${eff.residue_after}`,
      relation: 'DRIVES', why: 'this is the edit: the sequence state at that position is what the edit changes',
      kind: ed.kind_of_evidence || 'curated', source: eff ? 'sequences/engineered-diff.json' : null,
    });
    if (ed.kind === 'regulatory') drives.push({
      to: `${ed.gene} coding sequence: unchanged (0 amino acids)`,
      relation: 'DRIVES', why: ed.note || 'the effect is ectopic expression of a wild-type protein, not a protein change',
      kind: ed.kind_of_evidence || 'curated', source: 'sequences/engineered-diff.json',
    });
    const epAny = editplanFor(ed.gene, ed);
    const ep = epAny && !epAny.absent ? epAny : null;
    if (ep && !ep.refused) drives.push({
      to: `a GRCz11 coordinate: ${ep['nucleotide change'] || ep['genomic coordinates'] || 'see the plan'}`,
      relation: 'DRIVES', why: 'the reference codon was read back out of the genome and re-translated, so the coordinate is measured, not inferred',
      kind: 'measured', source: 'sim-engine/validate/editplan/RESULTS.md section 1',
    });
    if (ep && ep.refused) drives.push({
      to: 'no editing plan',
      relation: 'REFUSED', why: ep.refusal,
      kind: 'curated', source: 'sim-engine/validate/editplan/RESULTS.md section 0b',
    });
    /* CORRELATED: everything the gene is merely annotated beside */
    const correlated = [];
    const ex = expressionPanel(ed.gene);
    if (!ex.absent) correlated.push({
      to: `${ex.cellsTotal} anatomy x stage expression cells for ${ed.gene}`,
      relation: 'ANNOTATED NEARBY', why: 'an expression record says where and when a transcript was seen in a wild-type animal. It does not say the edit changes it, and nothing in our sources measured expression in the edited animal.',
      kind: 'curated/measured per row', source: 'omics/transcriptomic',
    });
    const ix = interactionPanel(ed.gene);
    if (ix.total) correlated.push({
      to: `${ix.total} interaction edges for ${ed.gene}`,
      relation: 'ANNOTATED NEARBY', why: 'an interaction edge is a database assertion about the wild-type protein. Of 3,283 edges in our pack, 2 are curated zebrafish experiments.',
      kind: 'predicted/curated per edge', source: 'omics/proteomic',
    });
    const pw = pathwayPanel(ed.gene);
    if (!pw.absent) correlated.push({
      to: `${pw.membersTotal} pathway or GO memberships for ${ed.gene}`,
      relation: 'ANNOTATED NEARBY', why: 'membership is a gene-set annotation. A gene-set overlap between two databases is a Jaccard number, not a mechanism.',
      kind: 'inferred-electronic mostly', source: 'omics/pathway',
    });
    const ch = chainFor(ed.gene);
    if (!ch.absent) correlated.push({
      to: `a causal chain whose WEAKEST link is graded "${ch.chainStrength}"`,
      relation: ch.chainStrength === 'mechanism' || ch.chainStrength === 'necessity' || ch.chainStrength === 'sufficiency'
        ? 'EXPERIMENTALLY SUPPORTED, in another animal' : 'ANNOTATED NEARBY',
      why: `a chain is only as strong as its weakest link, and this one is "${ch.chainStrength}". ${chains.grades[ch.chainStrength] || ''}`,
      kind: 'curated', source: 'genotype/causal-chains.json',
    });
    arrows.push({ gene: ed.gene, edit: ed, drives, correlated });
  }
  return {
    arrows,
    rowsMoved: moved,
    comparison: control ? {
      design: ledger.counts, control: control.counts,
      controlRole: results.cases['zebrafish-adult'].role,
      sameUnresolved: ledger.counts?.UNRESOLVED === control.counts?.UNRESOLVED ? ledger.counts.UNRESOLVED : null,
      statement: `The design's ${ledger.design?.n_edits ?? 0} edit(s) move ${moved.length} row(s) of the ${(ledger.ledger || []).length}-row ledger. `
        + `An UNEDITED zebrafish run against the same requirement set scores ${control.counts.UNRESOLVED} UNRESOLVED — the same number as the design.`,
    } : null,
    ownValidation: {
      headline: 'Our own design validation FAILED.',
      number: '1 of 74 loci (1.4 %)',
      quote: 'A genetic overlap count against the loci known to differ in flying fishes: 1 of 74 (1.4%), and the 74 is coding-only because sheets K and M carry no gene column, so the true denominator is larger by an unknown amount.',
      source: 'design-validation/REPORT.md; dashboard/public/api/lean/failed-theorems/ft-design-validation-closeness.json',
    },
  };
}

/* ------------------------------------------------------------------ interactome */
const interactomeGlobal = {
  edges: Object.values(packIndex.global.interaction_class_totals).reduce((a, b) => a + b, 0),
  byClass: packIndex.global.interaction_class_totals,
  honesty: packIndex.global.interaction_honesty,
  classNames: {
    curated_zebrafish: 'curated zebrafish experiment (IntAct)',
    experimental_zebrafish: 'STRING edge whose zebrafish experiments channel reaches 0.4',
    experimental_transferred: 'experiment transferred from another species',
    curated_pathway_database: 'pathway-database assertion',
    predicted: 'text-mining / co-expression prediction',
  },
  source: 'dashboard/public/validate-show/structures/index.json global.interaction_class_totals',
  metabolome: absence('a metabolome layer',
    'this repository has no metabolomic dataset. omics/ carries five layers — genomic, transcriptomic, proteomic, pathway, ptm — and no metabolite measurement of any organism in this project exists in it.',
    'omics/SCHEMA.md'),
};

/* ----------------------------------------------------------------- assemble */
const geneCache = new Map();
function genePanels(gene) {
  if (geneCache.has(gene)) return geneCache.get(gene);
  const card = cardFor(gene);
  const v = {
    gene,
    card: card ? { symbol: card.symbol, zfinId: card.zfin_id, xrefs: card.xrefs, summary: card.summary, conflicts: card.conflicts || [], built: card.built } : absence('an omics card', 'this gene is outside the 3,860-gene annotated universe (omics/genes.json)', 'omics/index/genes/'),
    expression: expressionPanel(gene),
    proteomic: proteomicPanel(gene),
    ptm: ptmPanel(gene),
    pathway: pathwayPanel(gene),
    interactions: interactionPanel(gene),
    chain: chainFor(gene),
    flyingFish: (seqLayer.orthologues_resolved || []).find(o => o.gene === gene)
      || (seqLayer.orthologues_not_resolved || []).find(o => o.gene === gene) || null,
    links: {
      card: card ? `../t/genotype/#${gene}` : null,
      validateShow: '../validate-show/',
      zfin: card?.zfin_id ? `https://zfin.org/${card.zfin_id}` : null,
      ensembl: card?.xrefs?.ensembl_gene ? `https://www.ensembl.org/Danio_rerio/Gene/Summary?g=${card.xrefs.ensembl_gene}` : null,
      uniprot: card?.xrefs?.uniprot ? `https://www.uniprot.org/uniprotkb/${card.xrefs.uniprot}` : null,
    },
  };
  geneCache.set(gene, v);
  return v;
}

const out = {
  built: new Date().toISOString(),
  tool: 'dashboard/public/gene-diff/build.mjs',
  what: 'A gene diff that starts at the sequence and expands outward through every scale this repository holds. It is a VIEW: no value here was derived by this build, and every absence is stated in place.',
  noAves: 'Class Aves is this project\'s frozen holdout. No bird sequence, annotation or orthologue is read by this build or shown on this page.',
  honesty: {
    compensation,
    interactome: interactomeGlobal,
    finTissue: packIndex.global.fin_tissue_proteomics,
    flyingFishProteome: packIndex.global.flying_fish,
    ownValidation: '1 of 74 loci (1.4 %). Our own design validation FAILED and the claim that we can design an organism was dropped as UNSUPPORTED.',
  },
  ontogeny: { zebrafish: ontogenyAxis('zebrafish'), flyingFish: ontogenyAxis('flying_fish') },
  divergenceContext: {
    label: engineered.context_natural_divergence.label,
    method: engineered.context_natural_divergence.method,
    perSpecies: engineered.context_natural_divergence.per_species,
    headline: engineered.headline,
  },
  cases: [],
  genes: {},
  notes: note,
};

for (const id of [...CASES, ...CONTROLS]) {
  const c = results.cases[id];
  if (!c) { note.push(`case ${id} is not in results.json`); continue; }
  const L = c.ledger || {};
  const record = designRecordOf(id);
  const design = (L.design || record) ? {
    label: record?.label || L.design?.label || null,
    genotype_source: record?.source || L.design?.genotype_source || null,
    genotype_provenance: L.design?.genotype_provenance || record?.kind || null,
    kind: record?.kind || null,
    n_edits: record?.edits?.length ?? L.design?.n_edits ?? 0,
    /* the full edits, with ref/pos/alt/raw, from designs.mjs; the ledger's copy is abbreviated */
    edits: (record?.edits?.length ? record.edits : (L.design?.edits || [])),
    editsFrom: record?.edits?.length ? 'sim-engine/validate/functional/designs.mjs DOCUMENTED' : 'results.json ledger.design.edits',
    not_ours: record?.not_ours || L.design?.not_ours || null,
    status_caveat: record?.status_caveat || L.design?.status_caveat || null,
    no_genotype_note: record?.no_genotype_note || L.design?.no_genotype_note || null,
    direction: record?.direction || null,
  } : null;
  const seq = sequenceScaleFor(id, design);
  const analogues = (L.ledger || [])
    .filter(r => r.class === 'UNRESOLVED' || r.class === 'PARALOGUE' || r.class === 'ANALOGOUS_SET')
    .map(r => analogyFor(r, seq.genes || []));

  const caseOut = {
    id, role: c.role, desiredPhenotype: c.desired_phenotype,
    isCommitted: CASES.includes(id),
    design: design ? {
      label: design.label, source: design.genotype_source, provenance: design.genotype_provenance,
      kind: design.kind, nEdits: design.n_edits, edits: design.edits, editsFrom: design.editsFrom,
      notOurs: design.not_ours || null, direction: design.direction || null,
      statusCaveat: design.status_caveat || null, noGenotypeNote: design.no_genotype_note || null,
    } : absence('a design record', 'the ledger carries no design for this case', 'sim-engine/validate/functional/results.json'),
    analogue: L.closest_functional_analogue ? {
      id: L.closest_functional_analogue.id, name: L.closest_functional_analogue.name,
      taxon: L.closest_functional_analogue.taxon, function: L.closest_functional_analogue.function,
      operationalDefinition: L.closest_functional_analogue.function_operational_definition,
      noAnalogue: !!L.closest_functional_analogue.no_analogue,
      basis: L.closest_functional_analogue.basis,
      dataPoor: !!L.closest_functional_analogue.data_poor,
      dataPoorStatement: L.closest_functional_analogue.data_poor_statement || null,
      direction: L.closest_functional_analogue.direction || null,
      nearestPartial: (L.closest_functional_analogue.nearest_partial_analogues || []).map(p => ({
        name: p.name, taxon: p.taxon, supplies: p.supplies || null, doesNotSupply: p.does_not_supply || null,
      })),
      source: L.closest_functional_analogue.source || null,
    } : absence('a functional analogue', 'the ledger records none for this case', 'sim-engine/validate/functional/results.json'),
    baseGenome: L.base_genome || null,
    sequence: seq,
    ledger: {
      ran: L.ran, counts: L.counts || null, headline: L.headline || null,
      coverage: L.coverage || null, resolutionTwoWays: L.resolution_two_ways || null,
      requirementSetScope: L.requirement_set_scope || null,
      rows: (L.ledger || []).map(r => ({
        id: r.id, gene: r.gene, component: r.component, class: r.class, difference: r.difference,
        requirement: r.requirement, searchDepth: r.search_depth, direction: r.direction,
        hypothesis: !!r.hypothesis, hypothesisWhy: r.hypothesis_why || null,
        unresolvedCaveat: r.unresolved_caveat || null,
        evidence: (r.evidence || []).map(e => ({ claim: e.claim, source: e.source, kind: e.kind })),
      })),
      unresolvedGenes: L.unresolved_genes || null,
      scope: L.scope || null,
    },
    analogy: analogues,
    controlPlane: (L.ledger || []).length || (design?.edits || []).length ? controlPlane(id, L) : null,
  };
  out.cases.push(caseOut);

  for (const g of seq.genes || []) out.genes[g.gene] = genePanels(g.gene);
  for (const r of L.ledger || []) if (!out.genes[r.gene]) out.genes[r.gene] = genePanels(r.gene);
}

mkdirSync(HERE, { recursive: true });
const file = join(HERE, 'data.json');
writeFileSync(file, JSON.stringify(out));
const kb = (readFileSync(file).length / 1024).toFixed(0);
console.log(`wrote ${file} (${kb} KB)`);
console.log(`cases ${out.cases.length}, genes ${Object.keys(out.genes).length}`);
for (const n of note) console.log('  note: ' + n);
