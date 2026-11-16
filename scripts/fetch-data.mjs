// Build-time data snapshot for the Shipping Routes page.
//
// Two PUNoted endpoints, both of which reject browser origins:
//   /public/flights/  — corp-wide route table. No key needed.
//   /internal/ships/  — corp fleet (the data behind the Excel Fleet/Ships
//                       sheets). REQUIRES the key: 401 without it.
// Running during the build is the script path, so neither origin block applies.
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
const SHIPS_URL  = 'https://api.punoted.net/internal/ships/';
const KEY        = (process.env.PUNOTED_KEY || '').trim();
const PASS       = (process.env.PAGE_PASS || '').trim();

// Length only — never the value. Lets a deploy log show which password the
// build actually used (e.g. after an env-var change that didn't apply yet).
if (PASS) console.log(`[data] PAGE_PASS length: ${PASS.length}`);

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
let ships = null;
if (KEY) {
  try {
    const raw = await getJSON(SHIPS_URL, { Authorization: `Bearer ${KEY}` });
    const list = Array.isArray(raw) ? raw : (raw.ships || raw.data || []);
    ships = list.map(s => ({
      name: s.name || s.displayname || '?',
      cls: s.ship_type || 'UNKNOWN',
      volume: +s.volume || 0,
      mass: +s.mass || 0,
      flow: +s.stlfuelflowrate || 0,
      company: s.companycode || '?',
      transit: !!s.flightid,
    }));
    console.log(`[data] ships: ${ships.length}`);
  } catch (e) {
    console.warn(`[data] ships failed: ${e.message}`);
  }
} else {
  console.warn('[data] PUNOTED_KEY not set — ships/fleet will be missing');
}

if (!routes) {
  console.warn('[data] no routes; nothing written');
  process.exit(0);
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
