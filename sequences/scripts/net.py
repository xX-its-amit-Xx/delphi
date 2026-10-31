"""Shared HTTP helper: every call is logged to sequences/calls.json and cached under C:/Temp/sequences/raw.
No personal identifiers are sent (no email/tool params, generic User-Agent)."""
import json, os, time, hashlib, urllib.request, urllib.error, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
SEQ = os.path.dirname(HERE)
CALLS = os.path.join(SEQ, os.environ.get('SEQ_CALLS', 'calls.json'))
CACHE = 'C:/Temp/sequences/raw'
os.makedirs(CACHE, exist_ok=True)
UA = 'delphi-sequences/0.1 (python-urllib)'

def _load():
    if os.path.exists(CALLS):
        with open(CALLS, encoding='utf-8') as f: return json.load(f)
    return []

def _log(entry):
    calls = _load(); calls.append(entry)
    with open(CALLS, 'w', encoding='utf-8') as f: json.dump(calls, f, indent=1)

def get(url, purpose, accept='application/json', data=None, cache=True, retries=4):
    key = hashlib.sha1((url + (data.decode() if isinstance(data, bytes) else (data or ''))).encode()).hexdigest()[:20]
    path = os.path.join(CACHE, key)
    if cache and os.path.exists(path):
        with open(path, 'rb') as f: body = f.read()
        return body
    last = None
    for i in range(retries):
        req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, 'Accept': accept,
                                     **({'Content-Type': 'application/json'} if data else {})})
        t = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                body = r.read(); status = r.status
            _log({'time': t, 'method': 'POST' if data else 'GET', 'url': url,
                  'body': data.decode() if data else None, 'status': status, 'bytes': len(body),
                  'purpose': purpose, 'cache_file': path})
            with open(path, 'wb') as f: f.write(body)
            time.sleep(0.12)
            return body
        except urllib.error.HTTPError as e:
            last = e
            _log({'time': t, 'method': 'POST' if data else 'GET', 'url': url, 'status': e.code,
                  'bytes': 0, 'purpose': purpose, 'error': str(e)})
            if e.code in (400, 404): return None
            time.sleep(2 * (i + 1))
        except Exception as e:
            last = e
            _log({'time': t, 'method': 'GET', 'url': url, 'status': None, 'bytes': 0, 'purpose': purpose, 'error': repr(e)})
            time.sleep(2 * (i + 1))
    return None

def jget(url, purpose, **kw):
    b = get(url, purpose, **kw)
    return json.loads(b) if b else None
