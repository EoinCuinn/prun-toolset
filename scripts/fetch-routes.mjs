// Fetch PUNoted's corp-wide route table at build time.
//
// /public/flights serves this data to any script, but rejects browser requests
// whose Origin isn't punoted.net — and a page can't avoid sending its Origin.
// The build runs as a script, so it can fetch it. The result is written into
// public/ and copied into the site by Vite; the page just reads the file.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE     = dirname(fileURLToPath(import.meta.url));
const OUT      = resolve(HERE, '../public/punoted_routes.json');
const ENDPOINT = 'https://api.punoted.net/public/flights/';

async function attempt() {
  const r = await fetch(ENDPOINT, {
    headers: { 'User-Agent': 'prun-toolset-build' },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const routes = await r.json();
  if (!Array.isArray(routes) || !routes.length) throw new Error('empty or unexpected response');
  return routes;
}

let routes = null;
let lastErr = null;
for (let i = 1; i <= 3 && !routes; i++) {
  try {
    routes = await attempt();
  } catch (e) {
    lastErr = e;
    console.warn(`[routes] attempt ${i} failed: ${e.message}`);
  }
}

if (!routes) {
  // Don't block every other tool's deploy over one endpoint; the page will
  // say the snapshot is missing.
  console.warn(`[routes] giving up: ${lastErr.message}. No snapshot written.`);
  process.exit(0);
}

writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), routes }));
console.log(`[routes] wrote ${routes.length} routes to public/punoted_routes.json`);
