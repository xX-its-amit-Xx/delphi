// What an illustration-mesh piece DEPICTS, and so what state the page must draw it in.
//
// A slot node is styled by the parts that land in its slot (present / ghost / body / cells / absent). A piece
// that depicts ONE SPECIFIC part -- the cilia tufts of a multiciliated cell on a construct's surface, a larva's
// salivary glands hung under its gut -- must not borrow its slot's state: a solid surface would otherwise draw
// solid cilia although the blueprint lacks the multiciliated cell. Such a node carries
//
//     extras.requires = ["CL_0005012", "/multicilia/i"]      ontology ids and/or label regexes
//
// and is styled by depictState(requires, ladder.parts), independent of its parent slot:
//
//   ids first   a part whose ontology id (or id, minus a 'ghost:' prefix; ':' and '_' are the same) equals one
//               of the ids. If any blueprint part (from !== 'chain') matches -> present; else, if a chain part
//               matches -> ghost.
//   labels      ONLY when no id matches any part at all (not even a ghost): a part whose label matches one of
//               the regexes, with the same present/ghost rule.
//   absent      nothing matches.
//
// Ids outrank labels on purpose. When the literature chain names the very part a piece depicts and the
// blueprint lacks it, a blueprint part that merely shares a word ("airway submucosal gland duct multiciliated
// cell" for a construct's epidermal multiciliated cell) does not make the piece solid; the page lists such parts
// as `related` instead. There is no ontology reasoner on the page, so a SUBCLASS of a required id counts only if
// its label matches a regex and no required id is in the ladder. This can under-claim; it never over-claims.
// Body-level parts (the organism itself) never satisfy a requirement.
//
// dashboard/public/blueprint3d/studio-live/theatre.js is a classic script and cannot import this module, so it
// carries a verbatim copy of the block between the two marker lines below; sim-engine/scales/test/mesh.mjs
// checks the copies are identical (text, minus `export `) and behave identically on every bundle.

// >>> depicts
function depictsParse(r) {
  const s = String(r ?? '').trim();
  const m = /^\/(.+)\/([a-z]*)$/.exec(s);
  if (m) { try { return { kind: 're', src: s, re: new RegExp(m[1], m[2].replace(/[gy]/g, '')) }; } catch { return null; } }
  if (/^[A-Za-z][A-Za-z0-9]*[_:][A-Za-z0-9]+$/.test(s)) return { kind: 'id', src: s, id: s.replace(':', '_') };
  return null;
}
export function depictState(requires, parts) {
  const list = Array.isArray(requires) ? requires : [];
  const reqs = list.map(depictsParse);
  const ids = reqs.filter(r => r?.kind === 'id'), res = reqs.filter(r => r?.kind === 're');
  const idOf = p => String(p?.ontology_id ?? p?.id ?? '').replace(/^ghost:/, '').replace(':', '_');
  const pool = (Array.isArray(parts) ? parts : []).filter(p => p && p.level !== 'body');
  const byId = pool.filter(p => ids.some(r => r.id === idOf(p)));
  const byLabel = pool.filter(p => !byId.includes(p) && res.some(r => r.re.test(String(p.label ?? ''))));
  const decide = (hits, by) => {
    const real = hits.filter(p => p.from !== 'chain');
    if (real.length) return { state: 'present', rep: real[0], by, matched: real };
    return { state: 'ghost', rep: hits[0], by, matched: hits };
  };
  const out = byId.length ? decide(byId, 'id') : byLabel.length ? decide(byLabel, 'label') : { state: 'absent', rep: null, by: null, matched: [] };
  return { ...out, related: out.by === 'id' ? byLabel : [], valid: list.length > 0 && reqs.every(Boolean), requires: list.map(String) };
}
// <<< depicts

/** Is this a usable requires list: a non-empty array of ontology ids or /regex/flags strings that compile? */
export function requiresProblems(requires) {
  if (!Array.isArray(requires) || !requires.length) return ['requires must be a non-empty array'];
  return requires.map((r, i) => depictsParse(r) ? null : `requires[${i}] = ${JSON.stringify(r)} is neither an ontology id (PREFIX_123) nor a /regex/flags`).filter(Boolean);
}

/** The block theatre.js must carry verbatim (between the markers), with `export ` removed. */
export function depictsBlock(source) {
  const m = /\/\/ >>> depicts\r?\n([\s\S]*?)\/\/ <<< depicts/.exec(String(source));
  return m ? m[1].replace(/\r\n/g, '\n').replace(/^export /gm, '') : null;
}
