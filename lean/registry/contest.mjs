#!/usr/bin/env node
// Record that a measured wild organism (or another law) contradicts a law within that law's scope. The law's
// status becomes 'contested' (an 'accepted' law is NOT demoted by this script: for an accepted law it adds an
// open_conflicts entry for a human, as propose.mjs does). Nothing is deleted; the law keeps its version
// (status is not a hashed field) and gains a history entry. A new law set must be cut with release.mjs for the
// change to reach the checker.
//   node lean/registry/contest.mjs <law_id> --observation <observation.json>
//   import { contest } from './contest.mjs'
// observation.json: {id, organism, taxon, measured, contradicts, source, quote, quote_kind:'primary'|'secondhand', lean_check?}
import path from 'node:path';
import { REG, LAWS_DIR, readJson, writeJson, contentHash } from './registry-lib.mjs';

export function contest(lawId, obs, { lawsDir = LAWS_DIR } = {}) {
  const f = path.join(lawsDir, lawId + '.json');
  const law = readJson(f);
  const today = new Date().toISOString().slice(0, 10);
  const entry = { law_id: `external:observation:${obs.id}`, reason: `${obs.organism} (${obs.taxon}): ${obs.measured}; contradicts ${obs.contradicts}`, observation: obs };
  if (law.status === 'accepted') {
    law.open_conflicts = [...(law.open_conflicts || []).filter(x => x.law_id !== entry.law_id), { ...entry, recorded: today, note: 'accepted law: a human decides whether to contest or retire it' }];
  } else {
    law.status = 'contested';
    law.contested_with = [...(law.contested_with || []).filter(x => x.law_id !== entry.law_id), entry];
    law.history = [...(law.history || []), { version: law.version, date: today, change: `contested by observation ${obs.id}: ${entry.reason}` }];
  }
  if (contentHash(law) !== law.content_hash) throw new Error('internal: contesting changed a hashed field');
  writeJson(f, law);
  return law;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(REG, 'contest.mjs')) {
  const [id] = process.argv.slice(2); const oi = process.argv.indexOf('--observation');
  if (!id || oi < 0) { console.error('usage: node lean/registry/contest.mjs <law_id> --observation <observation.json>'); process.exit(2); }
  const law = contest(id, readJson(process.argv[oi + 1]));
  console.log(`${law.law_id}: ${law.status}`, JSON.stringify(law.contested_with || law.open_conflicts, null, 1));
}
