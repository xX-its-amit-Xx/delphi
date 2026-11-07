#!/usr/bin/env node
// Emit the scale-ladder bundle the page fetches: the rungs, the coverage, and the REAL cells from the
// worked .life example so the one well-represented level is drawn from data rather than from a sketch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNGS, THE_GAP, coverage, span } from './represent.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/scale/ladder.json');

// the real cells, from the real file. If it is not there, say so rather than drawing a plausible cloud.
let cells = [], cellsFrom = null;
try {
  const life = JSON.parse(fs.readFileSync(path.join(ROOT, 'organism-format/life/examples/mouse-preimplantation.life'), 'utf8'));
  const last = life.timeline.stages[life.timeline.stages.length - 1];
  cells = (last.geometry?.cells ?? []).map(c => ({
    id: c.id, centre: c.channels.geometry.centre, radius: c.channels.geometry.radius,
  }));
  cellsFrom = { file: 'organism-format/life/examples/mouse-preimplantation.life', stage: last.id, provenance: last.geometry?.provenance?.kind ?? null };
} catch (e) { cellsFrom = { error: String(e.message).slice(0, 120) }; }

const bundle = {
  what_this_is: 'the scale ladder from organelle to organism, and HOW EACH LEVEL IS REPRESENTED in this project\u2019s files - which is a different question from whether it can be simulated.',
  rungs: RUNGS, coverage: coverage(), span: span(), the_gap: THE_GAP,
  cells, cells_from: cellsFrom,
  honesty_note: cells.length
    ? `the cell rung is drawn from ${cells.length} real cells in the worked example, whose geometry provenance is "${cellsFrom.provenance}" - a drawing, not a measurement`
    : 'no real cells available; the cell rung would be a sketch, and the page says so',
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(bundle, null, 1));
console.log(`${RUNGS.length} rungs | ${coverage().headline}`);
console.log(`cells: ${cells.length} from ${cellsFrom?.stage ?? 'nowhere'} (${cellsFrom?.provenance ?? 'n/a'})`);
console.log(`written to ${path.relative(ROOT, OUT).split(path.sep).join('/')} (${fs.statSync(OUT).size} bytes)`);
