#!/usr/bin/env node
/*
 * Lasertag CTF - sync relay.
 *
 * Deliberately dependency-free: `node server.js` is the whole install step.
 * The server is NOT the referee. It stores an append-only event log per game
 * and fans it out; every phone computes the score itself from that log
 * (see public/game.js). That is what lets a phone keep playing with no signal
 * and still agree with everyone else once it reconnects.
 *
 * Transport is SSE + POST rather than WebSockets: EventSource reconnects by
 * itself, survives flaky mobile networks and dumb proxies, and needs no deps.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const PUBLIC = path.join(__dirname, 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'games.json');
const GAME_TTL_MS = 24 * 60 * 60 * 1000;
const TEST_HOOKS = process.env.ALLOW_TEST_HOOKS === '1';

/* ------------------------------------------------------------------ state */

/** code -> { code, createdAt, updatedAt, seq, events:[], clients:Set } */
const games = new Map();

// Ambiguous characters removed: no 0/O, 1/I/L, 5/S, 8/B.
const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXYZ2346799';

function newCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
  } while (games.has(code));
  return code;
}

function persist() {
  try {
    const dump = [];
    for (const g of games.values()) {
      dump.push({ code: g.code, createdAt: g.createdAt, updatedAt: g.updatedAt, seq: g.seq, events: g.events });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(dump));
  } catch (e) { /* best effort only */ }
}

function restore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const dump = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const now = Date.now();
    for (const g of dump) {
      if (now - g.updatedAt > GAME_TTL_MS) continue;
      games.set(g.code, { ...g, clients: new Set() });
    }
    console.log(`restored ${games.size} game(s)`);
  } catch (e) { console.warn('restore failed:', e.message); }
}

let persistTimer = null;
function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => { persistTimer = null; persist(); }, 2000);
}

setInterval(() => {
  const now = Date.now();
  let dropped = 0;
  for (const [code, g] of games) {
    if (now - g.updatedAt > GAME_TTL_MS && g.clients.size === 0) { games.delete(code); dropped++; }
  }
  if (dropped) persistSoon();
}, 10 * 60 * 1000).unref();

/* ------------------------------------------------------------------ utils */

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8'
      : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(payload);
}

function readJson(req, limitBytes = 1024 * 512) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limitBytes) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const file = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden');

  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'not found');
    const ext = path.extname(file).toLowerCase();
    // The service worker must never be served stale, or players get stuck on
    // an old build; everything else it caches itself anyway.
    const cache = rel === '/sw.js' || rel === '/index.html'
      ? 'no-cache' : 'public, max-age=3600';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(buf);
  });
}

/* ------------------------------------------------------------------ games */

function broadcast(game, events) {
  const payload = `data: ${JSON.stringify({ type: 'events', events, serverTime: Date.now() })}\n\n`;
  for (const res of game.clients) {
    try { res.write(payload); } catch (e) { game.clients.delete(res); }
  }
}

const VALID_TYPES = new Set([
  'join', 'setName', 'setTeam', 'leave', 'settings',
  'start', 'died', 'revived', 'scan', 'timeup', 'abort', 'rematch'
]);

function ingest(game, incoming) {
  const known = new Set(game.events.map(e => e.id));
  const accepted = [];
  const now = Date.now();

  for (const ev of incoming) {
    if (!ev || typeof ev.id !== 'string' || !VALID_TYPES.has(ev.type)) continue;
    if (known.has(ev.id)) continue;                 // idempotent replay
    if (typeof ev.ts !== 'number' || !isFinite(ev.ts)) ev.ts = now;
    // Clamp wildly skewed phone clocks so one bad device can't reorder history.
    if (ev.ts > now + 5 * 60 * 1000) ev.ts = now;
    if (ev.ts < now - 12 * 60 * 60 * 1000) ev.ts = now;
    ev.seq = ++game.seq;
    game.events.push(ev);
    known.add(ev.id);
    accepted.push(ev);
  }
  if (accepted.length) {
    game.updatedAt = now;
    broadcast(game, accepted);
    persistSoon();
  }
  return accepted;
}

/* ---------------------------------------------------------------- routing */

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  if (req.method === 'OPTIONS') return send(res, 204, '');

  // POST /api/game  -> create
  if (req.method === 'POST' && url === '/api/game') {
    const code = newCode();
    const game = { code, createdAt: Date.now(), updatedAt: Date.now(), seq: 0, events: [], clients: new Set() };
    games.set(code, game);
    persistSoon();
    return send(res, 200, { code, serverTime: Date.now() });
  }

  const m = url.match(/^\/api\/game\/([A-Za-z0-9]{1,8})(\/[a-z]+)?(\?.*)?$/);
  if (m) {
    const code = m[1].toUpperCase();
    const sub = m[2] || '';
    const game = games.get(code);

    /* PUT re-creates a game the server has forgotten -- a restart, a redeploy,
       or a free-tier host with an ephemeral disk. The phones still hold the
       full event log, so whoever gets back first hands it over and the game
       carries on. Idempotent, and it never overwrites a live game. */
    if (!game && req.method === 'PUT' && !sub) {
      const fresh = {
        code, createdAt: Date.now(), updatedAt: Date.now(),
        seq: 0, events: [], clients: new Set()
      };
      games.set(code, fresh);
      persistSoon();
      return send(res, 200, { code, restored: true, serverTime: Date.now() });
    }

    if (!game) return send(res, 404, { error: 'no such game', code });

    /* Test-only, and off unless ALLOW_TEST_HOOKS=1: drop a game the way a
       restart on an ephemeral disk would, so the recovery path can be tested. */
    if (TEST_HOOKS && req.method === 'POST' && sub === '/forget') {
      for (const c of game.clients) { try { c.end(); } catch (e) { } }
      games.delete(code);
      persistSoon();
      return send(res, 200, { ok: true, forgotten: code });
    }

    // GET /api/game/:code -> full log (cold start / hard refresh)
    if (req.method === 'GET' && !sub) {
      return send(res, 200, { code, events: game.events, serverTime: Date.now() });
    }

    if (req.method === 'PUT' && !sub) {          // already exists: nothing to do
      return send(res, 200, { code, restored: false, serverTime: Date.now() });
    }

    // GET /api/game/:code/stream?since=N -> SSE
    if (req.method === 'GET' && sub === '/stream') {
      const since = Number(new URL(url, 'http://x').searchParams.get('since') || 0);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write('retry: 3000\n\n');
      const missed = game.events.filter(e => e.seq > since);
      res.write(`data: ${JSON.stringify({ type: 'events', events: missed, serverTime: Date.now(), hello: true })}\n\n`);

      game.clients.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { } }, 20000);
      req.on('close', () => { clearInterval(ping); game.clients.delete(res); });
      return;
    }

    // POST /api/game/:code/events
    if (req.method === 'POST' && sub === '/events') {
      let body;
      try { body = await readJson(req); }
      catch (e) { return send(res, 400, { error: String(e.message) }); }
      const accepted = ingest(game, Array.isArray(body.events) ? body.events : []);
      return send(res, 200, {
        ok: true,
        acceptedIds: accepted.map(e => e.id),
        seq: game.seq,
        serverTime: Date.now()
      });
    }
  }

  if (url.startsWith('/api/time')) return send(res, 200, { serverTime: Date.now() });

  if (url.startsWith('/api/')) return send(res, 404, { error: 'unknown endpoint' });

  return serveStatic(req, res, url);
});

restore();
server.listen(PORT, () => {
  console.log(`Lasertag CTF relay listening on http://localhost:${PORT}`);
});

process.on('SIGINT', () => { persist(); process.exit(0); });
process.on('SIGTERM', () => { persist(); process.exit(0); });
