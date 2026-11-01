// Dependency loaders for the unifying validator. EVERY component here is owned by another thread. This file
// imports their stated entry points and reports "did not run", with the reason, when one is absent. It never
// substitutes a stand-in result, and it never computes a component itself: an absent dependency is an
// unassessed gate, which is a different thing from a passed one.
//
// Owned elsewhere (not edited here):
//   sim-engine/validate/score.mjs            assess(), namedResults()   -- the scorer thread
//   sim-engine/validate/functional-interface.mjs                        -- the scorer thread
//   sim-engine/validate/functional/index.mjs functionalResolution()     -- the functional thread
//   sim-engine/validate/physics/index.mjs    physicsCheck()             -- the physics thread
//   sim-engine/validate/editplan/            resolveGenomic() etc.      -- the editplan thread
//   sim-engine/lib/parse-text.mjs            parseDesignText()          -- the spec thread

/** physicsCheck(design, opts) from the physics thread. Expected shape (what this pipeline reads, all optional
 *  except `ran`):
 *    { ran: true, target_function?: string, checks: [{ id, quantity?, value?, unit?, status: 'pass'|'fail'|'cannot-evaluate',
 *      requirement?, margin?, source?, kind? }], verdict?: string, scope?: string }
 *  Anything else is carried through untouched and reported as the module gave it. */
export async function loadPhysics() {
  for (const spec of ['./../physics/index.mjs', './../physics/physics.mjs']) {
    try {
      const m = await import(spec);
      if (typeof m.physicsCheck === 'function') return { ok: true, fn: m.physicsCheck, module: spec.replace('./../', 'sim-engine/validate/') };
      return { ok: false, reason: `${spec.replace('./../', 'sim-engine/validate/')} exists but exports no physicsCheck(design, opts) function` };
    } catch (e) {
      if (!/Cannot find module|ERR_MODULE_NOT_FOUND/i.test(String(e?.message))) return { ok: false, reason: `the physics module failed to load: ${e.message}` };
    }
  }
  return { ok: false, reason: 'sim-engine/validate/physics/ has not landed yet: no physics check was run, and nothing was assumed in its place. The repo-level physics/results.json is a glide-envelope study of real Exocoetidae, not a check of this design against this desired phenotype, so it is not used here.' };
}

/** The editplan thread's Ensembl GRCz11 coordinate mapping. Used ONLY to reconstruct sequence at edited loci;
 *  the mapping itself is not duplicated. */
export async function loadEditplan() {
  try {
    const m = await import('./../editplan/editplan.mjs');
    if (typeof m.resolveGenomic !== 'function') return { ok: false, reason: 'sim-engine/validate/editplan/editplan.mjs exports no resolveGenomic()' };
    return { ok: true, m };
  } catch (e) { return { ok: false, reason: `sim-engine/validate/editplan/ could not be loaded: ${e.message}` }; }
}

/** The functional thread's ledger, through the scorer thread's interface (which validates the shape and
 *  recomputes its counts). */
export async function loadFunctionalInterface() {
  try {
    const m = await import('./../functional-interface.mjs');
    return { ok: true, m };
  } catch (e) { return { ok: false, reason: `functional-interface.mjs could not be loaded: ${e.message}` }; }
}
