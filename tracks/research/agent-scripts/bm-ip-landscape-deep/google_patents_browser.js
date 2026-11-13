// REPRODUCE (Google Patents blocks curl/WebFetch with HTTP 503 from this network; a real Chrome tab works).
// 1. Open any page on https://patents.google.com/ in Chrome (e.g. /patent/US11155025B2/en).
// 2. Paste this into the DevTools console (it ran via the claude-in-chrome javascript tool on 2026-11-12).
// 3. window.gp('US11155025B2') -> stores {title, assignees, priority, filing, status, events, abstract, claims} in window.R[n]
//    window.gq('name','"hygromorphic" "3D printing"') -> stores {total, rows} in window.Q[name]  (same endpoint the search UI uses)
window.R = window.R || {}; window.Q = window.Q || {};
window.gp = async function (n) {
  const r = await fetch('/patent/' + n + '/en'); if (!r.ok) { window.R[n] = { http: r.status }; return n + ' HTTP ' + r.status }
  const d = new DOMParser().parseFromString(await r.text(), 'text/html');
  const q = (s) => { const e = d.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : '' };
  const qa = (s) => Array.from(d.querySelectorAll(s)).map(e => e.textContent.replace(/\s+/g, ' ').trim());
  window.R[n] = { number: n, url: location.origin + '/patent/' + n + '/en', title: (d.title || '').replace(/ - Google Patents$/, ''),
    assignees: Array.from(new Set(qa('dd[itemprop=assigneeCurrent]').concat(qa('dd[itemprop=assigneeOriginal]')))),
    priority: q('time[itemprop=priorityDate]'), filing: q('time[itemprop=filingDate]'), status: q('span[itemprop=status]'),
    events: qa('dd[itemprop=events]'), abstract: q('div.abstract'), claims: q('section[itemprop=claims]') };
  return n + ' ok';
};
window.gq = async function (name, q, extra) {
  const inner = 'q=' + encodeURIComponent(q) + '&num=25' + (extra || '');
  const r = await fetch('/xhr/query?url=' + encodeURIComponent(inner) + '&exp=');
  if (!r.ok) { window.Q[name] = 'HTTP ' + r.status; return name + ' HTTP ' + r.status }
  const res = (await r.json()).results, rows = [];
  for (const c of (res.cluster || [])) for (const x of (c.result || [])) { const p = x.patent;
    rows.push([p.publication_number, p.priority_date, p.grant_date || '', (p.assignee || '').slice(0, 40), (p.title || '').replace(/<[^>]+>/g, '').slice(0, 100)].join(' | ')) }
  window.Q[name] = { q, total: res.total_num_results, rows }; return name + ' total ' + res.total_num_results;
};
// Patents fetched with gp(): WO2018033422A1 DE112019001411T5 EP4019251B1 US11155025B2 US9931829B2 US20150158244A1 US20170151733A1
// US20180251649A1 US20200130261A1 US12655582B2 US12225924B2 US12575478B2 US20250213312A1 US12361183B2 US8473895B2 US10513089B2
// US11772399B2 EP3988317B1 US12435707B2 US20240390556A1 US20250186656A1 US20260001811A1 EP4783825A1 US11157672B1 US7574334B2 US10457780B2
// Searches run with gq(): see QUERIES list in the result file (table row "Search-count summary").
