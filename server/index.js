// Hollowmoon Hill server: static client, WebSocket game, photo booth and treat table APIs.
//   node server/index.js            (PORT=8830, HOST=0.0.0.0)
// Booth:  /booth.html?key=<booth key>     Treat table: /admin.html?key=<admin key>   (keys in data/keys.json)
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { Game } from './game.js';
import { keys, DATA } from './store.js';
import { designAvatar, VISION_MODEL } from './avatarAgent.js';
import { CHAT_MODEL } from './npc.js';
import { randomAvatar } from '../shared/avatar.js';
import { transcribe, voiceEnabled } from './voice.js';
import { PHOTO_BOOTH, dist2 } from '../shared/world.js';
import { clip, ttsEnabled } from './tts.js';
import { drawingToCarving } from './drawing.js';

const PORT = Number(process.env.PORT || 8830);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(import.meta.dirname, '..');
const STATIC = path.resolve(ROOT, process.env.STATIC_DIR || 'dist');
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11445';
const KEYS = keys();

const game = new Game();

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json' };

function sendJson(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveFile(res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'content-length': st.size, 'cache-control': cache });
    fs.createReadStream(file).pipe(res);
  });
}

// One photo at a time through the vision model, newest booth request first is not needed: plain FIFO.
let avatarQueue = Promise.resolve();
function queueAvatar(job) {
  const run = avatarQueue.then(job, job);
  avatarQueue = run.catch(() => {});
  return run;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    // ----- booth -----
    if (p.startsWith('/api/booth/')) {
      if (url.searchParams.get('key') !== KEYS.booth && url.searchParams.get('key') !== KEYS.admin) return sendJson(res, 403, { error: 'bad key' });
      if (p === '/api/booth/queue') {
        const list = game.adminList().filter((x) => x.online || Date.now() - x.lastSeen < 30 * 60 * 1000).map(({ pid, name, code, photo, online, title, avatar }) => ({ pid, name, code, photo, online, title, avatar }));
        return sendJson(res, 200, { players: list });
      }
      if (p === '/api/booth/photo' && req.method === 'POST') {
        const pid = url.searchParams.get('pid');
        if (!game.state.players[pid]) return sendJson(res, 404, { error: 'unknown player' });
        const photo = await readBody(req, 12 * 1024 * 1024);
        const result = await queueAvatar(() => designAvatar(photo, pid));
        // the photo itself is not kept: only the avatar design is stored
        const player = game.setPhotoAvatar(pid, result.avatar, result.raw?.costume);
        console.log(`avatar for ${player?.name} in ${result.ms} ms`);
        return sendJson(res, 200, { avatar: result.avatar, ms: result.ms, name: player?.name });
      }
      // a photo of a pumpkin drawn on paper becomes the player's glowing carving
      if (p === '/api/booth/drawing' && req.method === 'POST') {
        const pid = url.searchParams.get('pid');
        if (!game.state.players[pid]) return sendJson(res, 404, { error: 'unknown player' });
        const png = await drawingToCarving(await readBody(req, 12 * 1024 * 1024));
        const c = game.setCarvingImage(pid, png);
        return sendJson(res, 200, { ok: true, carving: c?.id });
      }
      if (p === '/api/booth/reset' && req.method === 'POST') {
        const pid = url.searchParams.get('pid');
        const pl = game.state.players[pid];
        if (!pl) return sendJson(res, 404, { error: 'unknown player' });
        game.setPhotoAvatar(pid, randomAvatar(pid + Date.now()));
        pl.photo = false;
        return sendJson(res, 200, { ok: true });
      }
    }
    // ----- treat table -----
    if (p.startsWith('/api/admin/')) {
      if (url.searchParams.get('key') !== KEYS.admin) return sendJson(res, 403, { error: 'bad key' });
      if (p === '/api/admin/players') return sendJson(res, 200, { players: game.adminList(), online: game.online().length });
      if (p === '/api/admin/redeem' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 10000)).toString() || '{}');
        const pl = game.redeem(body.pid, body.undo ? -1 : 1);
        return pl ? sendJson(res, 200, { tickets: pl.tickets, redeemed: pl.redeemed }) : sendJson(res, 404, { error: 'unknown player' });
      }
      if (p === '/api/admin/gm') return sendJson(res, 200, game.gmView());
      if (p === '/api/admin/event' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 10000)).toString() || '{}');
        return game.startEvent(String(body.kind)) ? sendJson(res, 200, { ok: true }) : sendJson(res, 409, { error: 'That event is already running (or unknown).' });
      }
      if (p === '/api/admin/schedule' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 10000)).toString() || '{}');
        if (body.remove) return game.unschedule(String(body.remove)), sendJson(res, 200, { ok: true });
        const item = game.scheduleEvent(String(body.kind), Number(body.at));
        return item ? sendJson(res, 200, item) : sendJson(res, 400, { error: 'Pick an event and a time in the future.' });
      }
      if (p === '/api/admin/mod' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 10000)).toString() || '{}');
        const pl = game.moderate(String(body.pid), String(body.action), Number(body.minutes));
        return pl ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'unknown player or action' });
      }
      if (p === '/api/admin/announce' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 10000)).toString() || '{}');
        const text = String(body.text || '').slice(0, 200);
        game.broadcast({ t: 'toast', text: `📣 ${text}`, kind: 'announce' });
        game.sayAloud(text);
        return sendJson(res, 200, { ok: true });
      }
    }
    // ----- voice: hold-to-talk with NPCs (speech to text on Freesia) -----
    if (p === '/api/voice' && req.method === 'POST') {
      // only a player connected right now, identified by their secret game token
      const token = String(req.headers['x-hh-token'] || '');
      const pid = token.length >= 16 ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 20) : '';
      const s = game.online().find((x) => x.pid === pid);
      if (!s) return sendJson(res, 403, { error: 'join the game first' });
      if (!voiceEnabled()) return sendJson(res, 503, { error: 'voice is off' });
      const t = Date.now();
      s.voice = (s.voice || []).filter((x) => t - x < 60000);
      if (s.voiceBusy || s.voice.length >= 10) return sendJson(res, 429, { error: 'Too fast! Wait a moment.' });
      s.voice.push(t);
      s.voiceBusy = true;
      try {
        const audio = await readBody(req, 4 * 1024 * 1024);
        const r = await transcribe(audio, String(req.headers['content-type'] || ''));
        console.log(`voice ${s.player.name}: ${r.seconds}s audio -> ${r.ms} ms`);
        return sendJson(res, 200, { text: r.text });
      } catch (e) {
        console.error('voice', e.message);
        return sendJson(res, 502, { error: 'Could not hear that. Try again or type.' });
      } finally {
        s.voiceBusy = false;
      }
    }
    // ----- self-service photo booth: a player standing in the booth tent sends their own photo -----
    if (p === '/api/drawing' && req.method === 'POST') {
      // the in-game booth: a player photographs their own paper pumpkin drawing
      const token = String(req.headers['x-hh-token'] || '');
      const pid = token.length >= 16 ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 20) : '';
      const s = game.online().find((x) => x.pid === pid);
      if (!s) return sendJson(res, 403, { error: 'Join the game first.' });
      if (dist2(s, PHOTO_BOOTH) > 81) return sendJson(res, 403, { error: 'Step into the Photo Booth first.' });
      if (Date.now() - (s.drawingAt || 0) < 10000) return sendJson(res, 429, { error: 'One moment, the booth is still working.' });
      s.drawingAt = Date.now();
      const png = await drawingToCarving(await readBody(req, 8 * 1024 * 1024));
      const c = game.setCarvingImage(pid, png);
      return sendJson(res, 200, { ok: true, carving: c?.id });
    }
    if (p === '/api/selfie' && req.method === 'POST') {
      const token = String(req.headers['x-hh-token'] || '');
      const pid = token.length >= 16 ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 20) : '';
      const s = game.online().find((x) => x.pid === pid);
      if (!s) return sendJson(res, 403, { error: 'Join the game first.' });
      if (dist2(s, PHOTO_BOOTH) > 81) return sendJson(res, 403, { error: 'Step into the Photo Booth first.' });
      const pl = s.player;
      if (pl.photo) return sendJson(res, 409, { error: 'You already have your 3D look. Ask an officer for a retake!' });
      if ((pl.selfies || 0) >= 3) return sendJson(res, 429, { error: 'The booth is tired of you 😄 Ask an officer for help.' });
      if (s.selfieBusy || Date.now() - (s.selfieAt || 0) < 20000) return sendJson(res, 429, { error: 'One moment, the booth is still working.' });
      s.selfieBusy = true;
      s.selfieAt = Date.now();
      try {
        const photo = await readBody(req, 8 * 1024 * 1024);
        pl.selfies = (pl.selfies || 0) + 1;
        const result = await queueAvatar(() => designAvatar(photo, pid));
        // the photo itself is not kept: only the avatar design is stored
        game.setPhotoAvatar(pid, result.avatar, result.raw?.costume);
        console.log(`selfie avatar for ${pl.name} in ${result.ms} ms`);
        return sendJson(res, 200, { ok: true, title: result.avatar.title });
      } catch (e) {
        console.error('selfie', e.message);
        return sendJson(res, 502, { error: 'The booth jammed. Try again in a moment!' });
      } finally {
        s.selfieBusy = false;
      }
    }
    if (p.startsWith('/api/tts/')) {
      const buf = clip(p.slice(9).replace('.wav', ''));
      if (!buf) return sendJson(res, 404, { error: 'gone' });
      res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': buf.length, 'cache-control': 'private, max-age=300' });
      return res.end(buf);
    }
    if (p === '/api/health') return sendJson(res, 200, { ok: true, online: game.online().length, vision: VISION_MODEL, chat: CHAT_MODEL, voice: voiceEnabled(), tts: ttsEnabled() });
    if (p.startsWith('/carvings/')) {
      const id = Number(p.slice(10).replace('.png', ''));
      return serveFile(res, path.join(DATA, 'carvings', `${id}.png`), 'no-cache');
    }
    // ----- static client -----
    let file = path.join(STATIC, decodeURIComponent(p === '/' ? '/index.html' : p));
    if (!file.startsWith(STATIC)) {
      res.writeHead(403);
      return res.end();
    }
    serveFile(res, file, p.startsWith('/assets/') && /-[A-Z0-9]{8}\./i.test(p) ? 'public, max-age=31536000, immutable' : 'no-cache');
  } catch (e) {
    console.error(p, e);
    if (!res.headersSent) sendJson(res, 500, { error: e.message });
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 512 * 1024 });
wss.on('connection', (ws) => game.connect(ws));

// Load both models now so the first player does not wait half a minute.
async function warm() {
  for (const model of [CHAT_MODEL, VISION_MODEL]) {
    try {
      await fetch(`${OLLAMA}/api/chat`, { method: 'POST', body: JSON.stringify({ model, stream: false, think: false, keep_alive: -1, messages: [{ role: 'user', content: 'hi' }], options: { num_predict: 1, num_ctx: 4096 } }) });
      console.log('warmed', model);
    } catch (e) {
      console.log('could not warm', model, e.message);
    }
  }
}

server.listen(PORT, HOST, () => {
  console.log(`Hollowmoon Hill on http://${HOST}:${PORT}  booth key ${KEYS.booth.slice(0, 3)}…  (see data/keys.json)`);
  warm();
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (game.shutdown(), process.exit(0)));
