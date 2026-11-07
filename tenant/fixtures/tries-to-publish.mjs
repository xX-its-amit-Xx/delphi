// A PLANTED VIOLATION. This script does what a publish script does - it tries to POST a record to the
// public nanopub registry - and exists so the egress guard can be SEEN to stop it.
//
//   node tenant/check-egress.mjs --dry-run tenant/fixtures/tries-to-publish.mjs
//
// The house rule it serves: a gate that has never been observed to fail is not evidence of anything. The
// holdout leak checker is tested the same way, and so is every assertion in this repository's test files
// under --fail-once.
//
// It sends NOTHING of substance: the body is a fixed string with no record in it, and under the guard no
// connection is opened at all. Run WITHOUT the guard it would really contact the host, which is exactly
// why it lives in a fixtures directory and is never imported by anything.

const TARGETS = [
  { why: 'the production nanopub registry, which a publish script posts to', url: 'https://registry.knowledgepixels.com/' },
  { why: 'the "test" registry, which is also public', url: 'https://test.registry.knowledgepixels.com/' },
  { why: 'the public SPARQL endpoint, a read that still discloses the question', url: 'https://query.knowledgepixels.com/repo/full' },
  { why: 'a plain socket, to check the guard is not only patching fetch', url: 'raw-socket://example.com:443' },
];

let attempted = 0, blocked = 0;

for (const t of TARGETS) {
  attempted++;
  try {
    if (t.url.startsWith('raw-socket://')) {
      const net = await import('node:net');
      const [host, port] = t.url.replace('raw-socket://', '').split(':');
      await new Promise((resolve, reject) => {
        const s = net.connect({ host, port: Number(port) });
        s.on('connect', () => { s.destroy(); resolve(); });
        s.on('error', reject);
        setTimeout(() => { s.destroy(); reject(new Error('timeout')); }, 3000);
      });
    } else {
      await fetch(t.url, { method: 'POST', body: 'this is not a record', headers: { 'content-type': 'text/plain' } });
    }
    console.log(`REACHED   ${t.url}   (${t.why})`);
  } catch (e) {
    blocked++;
    console.log(`refused   ${t.url}   ${e?.code === 'EGRESS_BLOCKED' ? 'by the guard' : `by something else: ${e?.message ?? e}`}`);
  }
}

console.log(`\nattempted ${attempted}, refused ${blocked}`);
process.exit(blocked === attempted ? 0 : 1);
