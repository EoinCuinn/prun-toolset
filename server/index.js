// PUNoted shipping-routes proxy.
//
// Why this exists: PUNoted's /public/flights serves the route table to any
// script, but rejects browser requests whose Origin isn't punoted.net. A
// browser can't omit Origin, so this service makes the fetch server-side
// (like the scripts do), caches it for an hour, and hands it to the page.
//
// The page must present the same key that's configured here in PUNOTED_KEY.
// The key is set in the Render dashboard — never committed to the repo.
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const PORT      = process.env.PORT || 10000;
const UPSTREAM  = 'https://api.punoted.net/public/flights/';
const API_KEY   = (process.env.PUNOTED_KEY || '').trim();
const TTL_MS    = 60 * 60 * 1000;
const ALLOWED   = (process.env.ALLOWED_ORIGINS || 'https://prun-toolset.onrender.com')
  .split(',').map(s => s.trim()).filter(Boolean);

let cache = null;  // { ts, body }

function originOk(origin) {
  if (!origin) return true;                                  // curl / server-to-server
  if (ALLOWED.includes(origin)) return true;
  return /^http:\/\/localhost(:\d+)?$/.test(origin);         // local dev
}

function keyOk(presented) {
  if (!API_KEY) return false;
  const a = Buffer.from(String(presented || ''));
  const b = Buffer.from(API_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function getRoutes() {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache;
  const r = await fetch(UPSTREAM, {
    headers: { 'User-Agent': 'prun-toolset-proxy' },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  const body = await r.text();
  const parsed = JSON.parse(body);                           // validate before caching
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('upstream returned no routes');
  cache = { ts: Date.now(), body };
  return cache;
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const cors = {};
  if (origin && originOk(origin)) {
    cors['Access-Control-Allow-Origin'] = origin;
    cors['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    cors['Access-Control-Allow-Headers'] = 'X-Prun-Key';
    cors['Access-Control-Max-Age'] = '86400';
  }
  cors['Vary'] = 'Origin';

  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(obj));
  };

  if (!originOk(origin)) return send(403, { detail: 'Origin not allowed.' });
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.method !== 'GET') return send(405, { detail: 'Method not allowed.' });
  if (req.url.startsWith('/healthz')) return send(200, { ok: true });
  if (!req.url.startsWith('/routes')) return send(404, { detail: 'Not found.' });

  if (!API_KEY) return send(503, { detail: 'Proxy is missing PUNOTED_KEY.' });

  const presented = req.headers['x-prun-key']
    || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!keyOk(presented)) return send(401, { detail: 'Key rejected.' });

  try {
    const c = await getRoutes();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Cache-Age': String(Math.round((Date.now() - c.ts) / 1000)),
      ...cors,
    });
    res.end(c.body);
  } catch (e) {
    if (cache) {                                             // serve stale rather than fail
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Cache-Age': String(Math.round((Date.now() - cache.ts) / 1000)),
        'X-Stale': '1',
        ...cors,
      });
      return res.end(cache.body);
    }
    console.error('upstream failed:', e.message);
    send(502, { detail: 'Upstream fetch failed.' });
  }
});

server.listen(PORT, () => console.log(`shipping-routes proxy listening on :${PORT}`));
