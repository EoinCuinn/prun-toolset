// Build-time data snapshot for the Shipping Routes page.
//
// Source: PUNoted /public/flights/ — corp-wide route table. It rejects browser
// origins, so it is fetched here, during the build (no Origin header).
// The bundle is encrypted with PAGE_PASS (a corp password, NOT the PUNoted key)
// so the stored file is unreadable without it.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pbkdf2Sync, randomBytes, createCipheriv } from 'node:crypto';

const HERE       = dirname(fileURLToPath(import.meta.url));
const PLAIN_OUT  = resolve(HERE, '../public/punoted_data.json');
const ENC_OUT    = resolve(HERE, '../public/punoted_data.enc.json');
const ROUTES_URL = 'https://api.punoted.net/public/flights/';
const PASS       = (process.env.PAGE_PASS || '').trim();

// Length only — never the value, so a deploy log shows which password a build used.
if (PASS) console.log(`[data] PAGE_PASS length: ${PASS.length}`);

// ── ships: paused ───────────────────────────────────────────────────────────
// PUNoted's owner flagged its frontend-only fleet endpoint as not meant for
// outside tools (2026-11-16). Not called until a protected corp-wide endpoint
// exists. Re-enable here when it does.
const ships = null;

async function getJSON(url, headers = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'prun-toolset-build', ...headers },
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

// ── routes (no key) ─────────────────────────────────────────────────────────
let routes = null;
for (let i = 1; i <= 3 && !routes; i++) {
  try {
    const r = await getJSON(ROUTES_URL);
    if (!Array.isArray(r) || !r.length) throw new Error('empty response');
    routes = r;
    console.log(`[data] routes: ${routes.length}`);
  } catch (e) {
    console.warn(`[data] routes attempt ${i}: ${e.message}`);
  }
}

// ── ships (key) ─────────────────────────────────────────────────────────────
// (paused — see the note above; `ships` stays null until a protected endpoint exists)

if (!routes) {
  // Fail the build rather than publish a site with no data file: Render keeps
  // the previous successful deploy live, so the last good snapshot survives.
  console.error('[data] no routes after retries — failing the build to keep the previous deploy live');
  process.exit(1);
}

const bundle = { generated: new Date().toISOString(), routes, ships };

if (PASS) {
  const salt = randomBytes(16);
  const iv   = randomBytes(12);
  const dk   = pbkdf2Sync(PASS, salt, 200000, 32, 'sha256');
  const c    = createCipheriv('aes-256-gcm', dk, iv);
  const ct   = Buffer.concat([c.update(JSON.stringify(bundle), 'utf8'), c.final()]);
  const tag  = c.getAuthTag();
  writeFileSync(ENC_OUT, JSON.stringify({
    v: 1,
    kdf: 'PBKDF2-SHA256', iterations: 200000, cipher: 'AES-256-GCM',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: Buffer.concat([ct, tag]).toString('base64'),
  }));
  console.log(`[data] wrote encrypted bundle (routes ${routes.length}, ships ${ships ? ships.length : 0}) — password required`);
} else {
  // No PAGE_PASS set: still produce the data, but say loudly that it's in the open.
  writeFileSync(PLAIN_OUT, JSON.stringify(bundle));
  console.warn('[data] PAGE_PASS not set — wrote an UNENCRYPTED bundle (readable by anyone with the URL)');
}
