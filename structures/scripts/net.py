"""Shared HTTP helper for the structures/ layer.

Every call is logged to structures/calls.json and the raw body cached under
C:/Temp/structures/raw. No personal identifiers are sent: generic User-Agent,
no email or tool parameter on any endpoint.
"""
import json, os, time, hashlib, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                      # .../structures
CALLS = os.path.join(ROOT, 'calls.json')
CACHE = 'C:/Temp/structures/raw'
os.makedirs(CACHE, exist_ok=True)
UA = 'delphi-structures/0.1 (python-urllib)'


_BUF = []
_SPOOL = os.path.join(CACHE, '..', 'calls.spool.jsonl')


def _load():
    if os.path.exists(CALLS):
        try:
            with open(CALLS, encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []
    return []


def _log(entry):
    """Append to an in-memory buffer and a line-per-call spool on C:.

    The project file structures/calls.json is written once, at process exit, by flush().
    Rewriting the whole JSON array on every call failed on the near-full D: volume
    (OSError 22), and the spool means nothing is lost if a run dies.
    """
    _BUF.append(entry)
    try:
        with open(_SPOOL, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry) + chr(10))
    except Exception:
        pass


def flush():
    """Merge the whole spool into structures/calls.json. Idempotent, one write.

    The spool (on C:) holds every call every process in this layer has made, so merging from
    the spool rather than only from this process's buffer means a write lost to a race with a
    sibling process is recovered by the next flush.
    """
    if not _BUF and not os.path.exists(_SPOOL):
        return
    calls = _load()
    seen = {(c.get('time'), c.get('url'), c.get('purpose')) for c in calls}
    pool = []
    try:
        with open(_SPOOL, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        pool.append(json.loads(line))
                    except Exception:
                        pass
    except Exception:
        pass
    for e in pool + _BUF:
        k = (e.get('time'), e.get('url'), e.get('purpose'))
        if k not in seen:
            calls.append(e)
            seen.add(k)
    calls.sort(key=lambda c: c.get('time') or '')
    tmp = CALLS + '.tmp'
    for attempt in range(5):
        try:
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(calls, f, indent=1)
            os.replace(tmp, CALLS)
            return
        except OSError:
            time.sleep(1 + attempt)
    # last resort: leave the spool on C: and say so
    print(f'WARNING: could not write {CALLS}; {len(_BUF)} calls are in {_SPOOL}')


import atexit
atexit.register(flush)


def get(url, purpose, accept='application/json', data=None, cache=True, retries=3,
        timeout=180, content_type='application/json'):
    """GET (or POST when data is given). Returns raw bytes, or None on failure."""
    raw = data.decode('utf-8', 'replace') if isinstance(data, bytes) else (data or '')
    key = hashlib.sha1((url + raw).encode()).hexdigest()[:20]
    path = os.path.join(CACHE, key)
    if cache and os.path.exists(path):
        with open(path, 'rb') as f:
            return f.read()
    if isinstance(data, str):
        data = data.encode()
    for i in range(retries):
        headers = {'User-Agent': UA, 'Accept': accept}
        if data:
            headers['Content-Type'] = content_type
        req = urllib.request.Request(url, data=data, headers=headers)
        t = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read()
                status = r.status
            _log({'time': t, 'method': 'POST' if data else 'GET', 'url': url,
                  'body': raw[:4000] or None, 'status': status, 'bytes': len(body),
                  'purpose': purpose, 'cache_file': path.replace('\\', '/')})
            with open(path, 'wb') as f:
                f.write(body)
            time.sleep(0.12)
            return body
        except urllib.error.HTTPError as e:
            err = e.read()[:400].decode('utf-8', 'replace')
            _log({'time': t, 'method': 'POST' if data else 'GET', 'url': url,
                  'body': raw[:4000] or None, 'status': e.code, 'bytes': 0,
                  'purpose': purpose, 'error': str(e), 'error_body': err})
            if e.code in (400, 404, 403, 422):
                return None
            time.sleep(1 + i)
        except Exception as e:
            _log({'time': t, 'method': 'POST' if data else 'GET', 'url': url,
                  'body': raw[:4000] or None, 'status': None, 'bytes': 0,
                  'purpose': purpose, 'error': repr(e)})
            time.sleep(1 + i)
    return None


def jget(url, purpose, **kw):
    b = get(url, purpose, **kw)
    if not b:
        return None
    try:
        return json.loads(b)
    except Exception:
        return None


def jpost(url, purpose, payload, **kw):
    b = get(url, purpose, data=json.dumps(payload), **kw)
    if not b:
        return None
    try:
        return json.loads(b)
    except Exception:
        return None


def download(url, dest, purpose, accept='*/*', **kw):
    """Fetch a file to dest (under C:/Temp). Returns dest or None."""
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    b = get(url, purpose, accept=accept, **kw)
    if not b:
        return None
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'wb') as f:
        f.write(b)
    return dest


def total_results(url, purpose):
    """UniProt returns the match count in the x-total-results header; fetch just that."""
    import urllib.request
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    t = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            n = r.headers.get('x-total-results')
            body = r.read()
        _log({'time': t, 'method': 'GET', 'url': url, 'status': 200, 'bytes': len(body),
              'purpose': purpose, 'x_total_results': n})
        return int(n) if n is not None else None
    except Exception as e:
        _log({'time': t, 'method': 'GET', 'url': url, 'status': None, 'bytes': 0,
              'purpose': purpose, 'error': repr(e)})
        return None
