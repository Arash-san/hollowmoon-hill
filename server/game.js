// Game server: sessions, persistent players, pickups, quests, NPC deals, treat tickets and group events.
// Movement is client-driven (relayed at 10 Hz); anything that pays out candy or tickets is checked here.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ZONES, NPCS, QUESTS, PHOTO_BOOTH, TICKET_EVERY, BOSS_TICKET, MAX_TICKETS, TICKET_CANDY_PRICE, RITUAL_RUNES, RUNE_RADIUS, RITUAL_MIN_PLAYERS,
  GM_EVENTS, MODS, WISP_SLOTS, wispPos, CAULDRON, CARVE_TABLE, BOSS_BELL, DANCE_FLOOR, DANCE_EMOTES, POTIONS, EMOTES, CANDLES, dist2, SPAWN, WORLD_RADIUS,
} from '../shared/world.js';
import { randomAvatar, cleanAvatar } from '../shared/avatar.js';
import { load, saveSoon, saveNow, DATA, keys } from './store.js';
import { clean, cleanName } from './filter.js';
import { npcReply, validateOffer, isDiscount, RIDDLES } from './npc.js';
import { Boss } from './boss.js';
import { CLUES, CLUES_NEEDED, FINALE_SPEECH } from '../shared/story.js';
import { speak, sentences, ttsEnabled } from './tts.js';
import { insideIsland, ISLAND_MAX } from '../shared/terrain.js';
import { CLASSES, classFromCostume, MANOR_DOOR, ROOM, ROOM_SPAWN, ROOM_MIN, ROOM_MAX, PLATES, ROOM_EXIT, TEAM_COLORS, CONTEST_SECONDS, STENCILS } from '../shared/features.js';

const QUEST_IDS = new Set(QUESTS.map((q) => q.id));
const EMOTE_IDS = new Set(EMOTES.map((e) => e.id));
const PUMPKIN_MAX = 12;
const CANDY_MAX = 22;
const LOAN_MS = 10 * 60 * 1000;
const CARVING_SLOTS = 36;
const MAX_HP = 100;
const DOWN_MS = 60000; // a pumpkin-cursed player gets up by themselves after a minute if nobody helps
const SPIDER_COUNT = 8;
const SPIDER_SPEED = 4.2; // between walking (3.6) and running (7.2)
const HURT = { boss: 20, minion: 10 };
// spiders live in the dark parts of town; the plaza and market are safe (except during the finale)
const SPIDER_HOMES = [ZONES.graveyard, ZONES.woods, ZONES.woods, ZONES.patch, ZONES.circle, ZONES.lake, ZONES.graveyard, ZONES.cottage];
const SAFE = [ZONES.plaza, ZONES.market];
const KEYS = keys();
// what the room speaker page hears (it is a listener, not a player)
const LISTENER_MSGS = new Set(['say', 'toast', 'event', 'boss']);

const rand = (a, b) => a + Math.random() * (b - a);
const now = () => Date.now();

export class Game {
  constructor() {
    this.state = load();
    this.state.players ||= {};
    this.state.carvings ||= [];
    this.state.nextCarving ||= 1;
    this.state.schedule ||= []; // officer-scheduled events [{id, kind, at, warned, done}]
    this.sessions = new Map(); // sid -> session
    this.nextSid = 1;
    this.pumpkins = new Map();
    this.candies = new Map();
    this.nextItem = 1;
    this.wispGen = Array.from({ length: WISP_SLOTS }, (_, i) => i * 1000 + Math.floor(Math.random() * 900));
    this.boss = new Boss(this, 'king');
    this.finale = new Boss(this, 'mayor');
    this.bear = new Boss(this, 'bear');
    this.rooms = new Map(); // Gloom Manor instances
    this.nextRoom = 1;
    this.contest = { active: false };
    this.spiders = new Map();
    this.nextSpider = 1;
    for (let i = 0; i < SPIDER_COUNT; i++) this.spawnSpider();
    this.ritual = { cooldown: 0, since: 0, filled: [] };
    this.party = { cooldown: 0, since: 0, dancers: [] };
    this.t0 = now();
    for (let i = 0; i < PUMPKIN_MAX; i++) this.spawnPumpkin();
    for (let i = 0; i < CANDY_MAX; i++) this.spawnCandy();
    setInterval(() => this.tick(), 100);
  }

  // ---------- helpers ----------
  online() {
    return [...this.sessions.values()].filter((s) => s.player);
  }
  send(s, msg) {
    if (s.ws.readyState === 1) s.ws.send(JSON.stringify(msg));
  }
  broadcast(msg, except) {
    const data = JSON.stringify(msg);
    const heard = LISTENER_MSGS.has(msg.t);
    for (const s of this.sessions.values()) if ((s.player || (s.listener && heard)) && s !== except && s.ws.readyState === 1) s.ws.send(data);
  }
  toast(s, text, kind = 'info') {
    this.send(s, { t: 'toast', text, kind });
  }
  dirty() {
    saveSoon(this.state);
  }
  serverTime() {
    return (now() - this.t0) / 1000;
  }

  publicPlayer(s) {
    const p = s.player;
    return { id: s.sid, name: p.name, avatar: p.avatar, title: p.avatar.title, photo: !!p.photo, x: s.x, y: s.y, z: s.z, ry: s.ry, likes: p.likes || 0, fx: s.fx || null, down: !!s.down, carving: p.carving || null, cls: p.cls || null, color: this.colorOf(s), room: s.room || 0 };
  }

  privateState(p) {
    const quests = {};
    for (const q of QUESTS) quests[q.id] = p.quests[q.id] || { n: 0, done: false };
    return {
      name: p.name, code: p.code, avatar: p.avatar, photo: !!p.photo, candy: p.candy, pumpkins: p.pumpkins, wisps: p.wisps, quests,
      tickets: p.tickets, redeemed: p.redeemed, likes: p.likes || 0, debt: p.debt || null, carving: p.carving || null, ticketCode: p.ticketCode,
      mod: this.activeMods(p),
      items: p.items || {}, clues: p.clues || [], cls: p.cls || null,
    };
  }
  sendMe(s) {
    this.send(s, { t: 'me', ...this.privateState(s.player) });
  }

  // ---------- connection ----------
  connect(ws) {
    const s = { sid: this.nextSid++, ws, player: null, pid: null, x: SPAWN.x, y: 0, z: SPAWN.z, ry: 0, a: 'idle', e: '', lastChat: 0, lastTalk: 0, busy: false, fx: null, lastMove: now() };
    this.sessions.set(s.sid, s);
    ws.on('message', (data) => {
      let m;
      try {
        m = JSON.parse(data);
      } catch {
        return;
      }
      try {
        this.handle(s, m);
      } catch (e) {
        console.error('handler error', m?.t, e);
      }
    });
    ws.on('close', () => this.disconnect(s));
    return s;
  }

  disconnect(s) {
    if (s.room) this.leaveRoom(s, false);
    this.sessions.delete(s.sid);
    if (s.player) {
      s.player.lastSeen = now();
      this.broadcast({ t: 'leave', id: s.sid });
      this.dirty();
    }
  }

  newCode() {
    const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const used = new Set(Object.values(this.state.players).map((p) => p.code));
    for (;;) {
      const c = Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
      if (!used.has(c)) return c;
    }
  }

  hello(s, m) {
    const token = String(m.token || '').slice(0, 64);
    if (token.length < 16) return this.send(s, { t: 'error', text: 'bad token' });
    const pid = crypto.createHash('sha256').update(token).digest('hex').slice(0, 20);
    let p = this.state.players[pid];
    const name = cleanName(m.name);
    if (!p) {
      if (!name) return this.send(s, { t: 'needName' });
      p = this.state.players[pid] = {
        pid, name, code: this.newCode(), avatar: randomAvatar(pid), photo: false, candy: 15, pumpkins: 0, wisps: 0, quests: {}, tickets: 0, redeemed: 0,
        likes: 0, likedBy: [], debt: null, trust: {}, history: {}, riddle: Math.floor(Math.random() * RIDDLES.length), created: now(), ticketCode: null,
      };
    } else if (name && name !== p.name) p.name = name;
    // one live session per player: a second tab takes over
    for (const other of this.sessions.values()) if (other !== s && other.pid === pid) other.ws.close(4000, 'opened elsewhere');
    s.pid = pid;
    s.player = p;
    s.down = 0;
    s.room = 0;
    s.hp = this.maxHp(s);
    p.items ||= { revive: 0, fire: 0 };
    p.clues ||= [];
    s.x = SPAWN.x + rand(-3, 3);
    s.z = SPAWN.z + rand(-2, 2);
    this.dirty();
    this.send(s, {
      t: 'welcome', sid: s.sid, me: this.privateState(p), time: this.serverTime(),
      players: this.online().filter((o) => o !== s).map((o) => this.publicPlayer(o)),
      world: {
        pumpkins: [...this.pumpkins.values()], candies: [...this.candies.values()], wisps: this.wispGen,
        carvings: this.state.carvings.map((c) => this.carvingPublic(c)), boss: this.boss.public(), minions: ['fight', 'shield', 'stunned'].includes(this.boss.state) ? [...this.boss.minions.values()] : [],
        finale: this.finale.public(), finaleMinions: ['fight', 'stunned'].includes(this.finale.state) ? [...this.finale.minions.values()] : [],
        bear: this.bear.public(), bearMinions: ['fight', 'stunned'].includes(this.bear.state) ? [...this.bear.minions.values()] : [],
        contest: this.contest.active ? { stencil: this.contest.stencil, left: (this.contest.until - now()) / 1000 } : null,
      },
    });
    this.send(s, { t: 'hp', hp: s.hp, max: this.maxHp(s), color: this.colorOf(s) });
    this.broadcast({ t: 'join', p: this.publicPlayer(s) }, s);
  }

  handle(s, m) {
    if (m.t === 'hello') return this.hello(s, m);
    if (m.t === 'ping') return this.send(s, { t: 'pong', c: m.c, time: this.serverTime() });
    if (m.t === 'listen') {
      if (m.key !== KEYS.admin) return this.send(s, { t: 'error', text: 'Wrong admin key in the link' });
      s.listener = true;
      return this.send(s, { t: 'listening' });
    }
    if (!s.player) return;
    const p = s.player;
    switch (m.t) {
      case 'move': {
        const x = Number(m.x), y = Number(m.y), z = Number(m.z);
        if (![x, y, z].every(Number.isFinite)) return;
        if (!s.room && x * x + z * z > (ISLAND_MAX + 5) ** 2) return;
        s.x = x;
        s.y = Math.max(-2, Math.min(20, y));
        s.z = z;
        s.ry = Number(m.ry) || 0;
        s.a = String(m.a || 'idle').slice(0, 12);
        s.e = EMOTE_IDS.has(m.e) ? m.e : '';
        s.lastMove = now();
        return;
      }
      case 'emote':
        return this.emote(s, m);
      case 'chat': {
        if (this.modded(p, 'mute')) return this.toast(s, '🔇 An officer muted your chat for a few minutes.');
        if (now() - s.lastChat < 1200) return;
        const text = clean(m.text, 140);
        if (!text) return;
        s.lastChat = now();
        return this.broadcast({ t: 'chat', id: s.sid, name: p.name, text });
      }
      case 'pick':
        if (s.down) return;
        return this.pick(s, m);
      case 'wisp':
        if (s.down) return;
        return this.catchWisp(s, m);
      case 'talk':
        return this.talk(s, m);
      case 'greet':
        return this.greet(s, String(m.npc));
      case 'accept':
        return this.accept(s, m);
      case 'repay':
        return this.repay(s);
      case 'buyTicket':
        return this.buyTicket(s);
      case 'quest':
        return this.claim(s, m);
      case 'carve':
        return this.carve(s, m);
      case 'likePumpkin':
        return this.likePumpkin(s, m);
      case 'bell':
        if (this.modded(p, 'block')) return this.toast(s, '🚫 An officer paused you from the boss for a few minutes.');
        if (dist2(s, BOSS_BELL) > 25) return;
        if (!this.boss.ring(s)) this.toast(s, this.boss.state === 'defeated' ? 'The Gourd King is still recovering. Try again in a moment!' : 'The fight is already on!');
        return;
      case 'hit':
        if (this.modded(p, 'block') || s.down) return;
        if (m.kind === 'spider') return this.hitSpider(s, Number(m.id));
        return (m.b === 'mayor' ? this.finale : m.b === 'bear' ? this.bear : this.boss).hit(s, m.kind === 'minion' ? 'minion' : 'boss', Number(m.id));
      case 'pickClass':
        return this.pickClass(s, String(m.cls));
      case 'special':
        return this.special(s, m);
      case 'pvp':
        return this.pvp(s, Number(m.id));
      case 'enterRoom':
        return this.enterRoom(s);
      case 'leaveRoom':
        return this.leaveRoom(s, true);
      case 'roomStart':
        return this.roomStart(s);
      case 'hurt':
        return this.hurt(s, HURT[m.src] || 0, m.src);
      case 'revive':
        return this.revive(s, Number(m.id));
      case 'buyRevive':
        return this.buyRevive(s);
      case 'brazier':
        if (this.modded(p, 'block') || s.down) return;
        return this.boss.lightBrazier(s, Number(m.i));
      case 'shuffle':
        if (p.photo) return this.toast(s, 'Your look comes from the photo booth. Ask an officer for a retake!');
        p.avatar = randomAvatar(p.pid + now());
        this.dirty();
        this.broadcast({ t: 'avatar', id: s.sid, avatar: p.avatar, photo: false });
        return this.sendMe(s);
    }
  }

  // ---------- currency and quests ----------
  addCandy(s, n, why) {
    s.player.candy = Math.max(0, s.player.candy + n);
    this.dirty();
    this.send(s, { t: 'candy', n, why, total: s.player.candy });
  }

  completeQuest(s, id) {
    const p = s.player;
    const q = QUESTS.find((x) => x.id === id);
    if (!q) return false;
    const st = (p.quests[id] ||= { n: 0, done: false });
    if (st.done) return false;
    st.done = true;
    st.n = q.goal || 1;
    st.at = now();
    p.candy += q.reward;
    this.send(s, { t: 'quest', id, done: true, reward: q.reward });
    const clue = CLUES.find((c) => c.quest === id);
    if (clue && !p.clues.includes(clue.id)) {
      p.clues.push(clue.id);
      this.send(s, { t: 'clue', id: clue.id });
      setTimeout(() => s.player && this.progress(s, 'clues'), 50);
    }
    const done = QUESTS.filter((x) => p.quests[x.id]?.done).length;
    const earned = Math.floor(done / TICKET_EVERY);
    const fromQuests = p.questTickets || 0;
    if (earned > fromQuests) {
      p.questTickets = earned;
      this.giveTicket(s, `for finishing ${done} quests`);
    }
    this.dirty();
    this.sendMe(s);
    return true;
  }

  progress(s, id, by = 1) {
    const q = QUESTS.find((x) => x.id === id);
    const st = (s.player.quests[id] ||= { n: 0, done: false });
    if (st.done) return;
    st.n = Math.min(q.goal || 1, st.n + by);
    if (st.n >= (q.goal || 1)) this.completeQuest(s, id);
    else {
      this.send(s, { t: 'quest', id, n: st.n, goal: q.goal });
      this.dirty();
    }
  }

  giveTicket(s, why) {
    const p = s.player;
    if (p.tickets >= MAX_TICKETS) {
      this.toast(s, `You have the maximum of ${MAX_TICKETS} Treat Tickets. Thank you for playing so much! 💜`);
      return false;
    }
    p.tickets++;
    if (!p.ticketCode) p.ticketCode = p.code;
    this.send(s, { t: 'ticket', tickets: p.tickets, why });
    this.dirty();
    return true;
  }

  bossTicket(s, id = 'king') {
    const p = s.player;
    if (id === 'bear') return; // the bear pays its quest reward, not a ticket
    const flag = id === 'mayor' ? 'finaleTicket' : 'bossTicket';
    if (!BOSS_TICKET || p[flag]) return;
    p[flag] = true;
    this.giveTicket(s, id === 'mayor' ? 'for saving Hollowmoon Hill' : 'for toppling the Gourd King');
  }

  buyTicket(s) {
    const p = s.player;
    if (dist2(s, NPCS.mayor) > 64) return;
    if (p.candy < TICKET_CANDY_PRICE) return this.toast(s, `A Treat Ticket costs ${TICKET_CANDY_PRICE} candy. Keep collecting!`);
    if (p.tickets >= MAX_TICKETS) return this.toast(s, `You already have the maximum of ${MAX_TICKETS} tickets.`);
    p.candy -= TICKET_CANDY_PRICE;
    this.giveTicket(s, `bought from the mayor`);
    this.sendMe(s);
  }

  // ---------- pickups ----------
  spawnPumpkin() {
    const z = ZONES.patch;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (z.r - 2);
    const item = { id: this.nextItem++, x: +(z.x + Math.cos(a) * r).toFixed(2), z: +(z.z + Math.sin(a) * r).toFixed(2), s: +rand(0.8, 1.25).toFixed(2) };
    this.pumpkins.set(item.id, item);
    return item;
  }

  spawnCandy() {
    // anywhere on the island, away from the edge and the lake
    let x, z;
    for (;;) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 80;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      if (insideIsland(x, z, 8) && dist2({ x, z }, ZONES.lake) > (ZONES.lake.r + 2) ** 2) break;
    }
    const item = { id: this.nextItem++, x: +x.toFixed(2), z: +z.toFixed(2), k: Math.floor(Math.random() * 4) };
    this.candies.set(item.id, item);
    return item;
  }

  pick(s, m) {
    const id = Number(m.id);
    const pool = m.kind === 'pumpkin' ? this.pumpkins : this.candies;
    const item = pool.get(id);
    if (!item || dist2(s, item) > 12) return;
    pool.delete(id);
    this.broadcast({ t: 'despawn', kind: m.kind, id, by: s.sid });
    if (m.kind === 'pumpkin') {
      s.player.pumpkins++;
      this.progress(s, 'harvest');
      this.addCandy(s, 1, 'pumpkin');
      setTimeout(() => this.broadcast({ t: 'spawn', kind: 'pumpkin', item: this.spawnPumpkin() }), rand(5000, 12000));
    } else {
      this.addCandy(s, [3, 4, 5, 8][item.k] || 3, 'candy');
      setTimeout(() => this.broadcast({ t: 'spawn', kind: 'candy', item: this.spawnCandy() }), rand(8000, 20000));
    }
    this.sendMe(s);
  }

  catchWisp(s, m) {
    const slot = Number(m.slot);
    if (!(slot >= 0 && slot < WISP_SLOTS)) return;
    const w = wispPos(this.wispGen[slot], this.serverTime());
    // clients lag a little behind the server clock, so be generous
    if (dist2(s, w) > 30) return;
    this.wispGen[slot] += 1;
    this.broadcast({ t: 'wisp', slot, gen: this.wispGen[slot], by: s.sid });
    s.player.wisps++;
    this.progress(s, 'wisps');
    this.addCandy(s, 2, 'wisp');
    this.sendMe(s);
  }

  claim(s, m) {
    const id = String(m.id);
    if (!QUEST_IDS.has(id)) return;
    if (id === 'potion' && dist2(s, CAULDRON) < 49 && Number(m.score) >= 1) {
      this.completeQuest(s, 'potion');
      this.addCandy(s, Math.min(15, Math.round(Number(m.score) * 3)), 'potion bonus');
      const items = (s.player.items ||= {});
      const before = items.revive || 0;
      items.revive = Math.min(5, before + 2);
      if (items.revive > before) this.toast(s, `🧪 Madame Hex bottles ${items.revive - before} Revive Potion${items.revive - before > 1 ? 's' : ''} for you. Use one on a friend who turned into a pumpkin!`, 'good');
      this.sendMe(s);
      // the brewed potion takes effect right away (a free sample)
      const kinds = Object.keys(POTIONS);
      this.applyPotion(s, kinds[Math.floor(Math.random() * kinds.length)]);
    } else if (id === 'candles' && dist2(s, ZONES.graveyard) < 22 * 22 && Number(m.secs) >= 8 && Number(m.lit) >= CANDLES.length) {
      this.completeQuest(s, 'candles');
    }
  }

  // ---------- emotes and hearts ----------
  emote(s, m) {
    if (!EMOTE_IDS.has(m.e)) return;
    if (this.modded(s.player, 'mute')) return;
    const target = this.sessions.get(Number(m.target));
    let tid = null;
    if (m.e === 'heart' && target && target !== s && target.player && dist2(s, target) < 100) {
      tid = target.sid;
      const tp = target.player;
      tp.likedBy ||= [];
      if (!tp.likedBy.includes(s.pid)) {
        tp.likedBy.push(s.pid);
        tp.likes = tp.likedBy.length;
        this.toast(target, `💜 ${s.player.name} sent you a heart!`, 'heart');
        this.sendMe(target);
      }
      this.completeQuest(s, 'friend');
      this.dirty();
    }
    this.broadcast({ t: 'emote', id: s.sid, e: m.e, target: tid, likes: target?.player?.likes });
  }

  // ---------- NPCs ----------
  async talk(s, m) {
    const id = String(m.npc);
    const npc = NPCS[id];
    const p = s.player;
    const text = clean(m.text, 220);
    if (!npc || !text) return;
    if (dist2(s, npc) > 100) return this.toast(s, `Walk closer to ${npc.name} to talk.`);
    if (s.busy || now() - s.lastTalk < 900) return;
    s.busy = true;
    s.lastTalk = now();
    if (id === 'mayor') this.completeQuest(s, 'hello');
    const hist = (p.history[id] ||= []);
    const ctx = {
      name: p.name, title: p.avatar.title, candy: p.candy, pumpkins: p.pumpkins, wisps: p.wisps, debt: id === 'count' && p.debt ? p.debt.due : 0,
      trust: p.trust[id] || 0, riddle: RIDDLES[p.riddle % RIDDLES.length],
    };
    try {
      const r = await npcReply(id, ctx, hist, text);
      p.trust[id] = Math.max(-5, Math.min(5, (p.trust[id] || 0) + r.mood));
      hist.push({ role: 'user', content: text }, { role: 'assistant', content: r.say });
      if (hist.length > 12) hist.splice(0, hist.length - 12);
      let offer = validateOffer(id, r.offer, ctx, r.say);
      if (offer?.kind === 'gift') {
        // gifts arrive at once, but each NPC only gives one gift per player every 5 minutes
        p.lastGift ||= {};
        if (now() - (p.lastGift[id] || 0) > 5 * 60 * 1000) {
          p.lastGift[id] = now();
          this.addCandy(s, offer.amount, `gift from ${npc.name}`);
        }
        offer = null;
      }
      s.offer = offer ? { npc: id, ...offer, at: now() } : null;
      this.send(s, { t: 'npc', npc: id, say: r.say, offer: offer ? { label: offer.label, kind: offer.kind, price: offer.price || 0 } : null, trust: p.trust[id] });
      this.voiceLine(s, id, r.say);
      if (r.riddleSolved && npc.riddles) {
        p.riddle = (p.riddle + 1 + Math.floor(Math.random() * 3)) % RIDDLES.length;
        p.history[id] = [];
        const first = this.completeQuest(s, 'riddle');
        if (!first) this.addCandy(s, 5, 'riddle');
      }
      this.dirty();
    } catch (e) {
      console.error('npc error', e.message);
      this.send(s, { t: 'npc', npc: id, say: `*${npc.name} seems lost in thought... try again in a moment.*`, offer: null });
    } finally {
      s.busy = false;
    }
  }

  // ---------- NPC voices ----------
  async voiceLine(s, npcId, text) {
    const v = NPCS[npcId]?.voice;
    if (!v || !ttsEnabled()) return;
    const seq = (s.voiceSeq = (s.voiceSeq || 0) + 1); // a newer reply cancels the rest of an older one
    let i = 0;
    for (const line of sentences(text)) {
      if (seq !== s.voiceSeq || !s.player) return;
      try {
        const audio = await speak(line, v.id, v.speed);
        if (audio && seq === s.voiceSeq) this.send(s, { t: 'npcVoice', npc: npcId, audio, i: i++, rate: v.rate || 1 });
      } catch (e) {
        console.error('tts', e.message);
        return;
      }
    }
  }

  // Greetings are the same every time, so each NPC's is made once and reused.
  async greet(s, npcId) {
    const npc = NPCS[npcId];
    if (!npc?.voice || !ttsEnabled() || dist2(s, npc) > 144) return;
    s.voiceSeq = (s.voiceSeq || 0) + 1;
    this.greetings ||= {};
    try {
      const ids = (this.greetings[npcId] ||= await Promise.all(sentences(npc.greeting).map((l) => speak(l, npc.voice.id, npc.voice.speed))));
      const seq = s.voiceSeq;
      ids.forEach((audio, i) => audio && seq === s.voiceSeq && this.send(s, { t: 'npcVoice', npc: npcId, audio, i, rate: npc.voice.rate || 1 }));
    } catch (e) {
      console.error('tts greet', e.message);
    }
  }

  // Announcements in the Mayor's voice (the room speaker plays them).
  async sayAloud(text) {
    let audio = null;
    try {
      audio = await speak(String(text).replace(/\p{Extended_Pictographic}/gu, ''), NPCS.mayor.voice.id, 1.0);
    } catch (e) {
      console.error('tts say', e.message);
    }
    this.broadcast({ t: 'say', text, audio });
  }

  accept(s) {
    const o = s.offer;
    const p = s.player;
    if (!o || now() - o.at > 3 * 60 * 1000) return this.toast(s, 'That offer has expired. Ask again!');
    const npc = NPCS[o.npc];
    if (dist2(s, npc) > 144) return this.toast(s, `Walk back to ${npc.name} first.`);
    const need = (o.price || 0);
    if (need > p.candy) return this.toast(s, `You need ${need} candy for that (you have ${p.candy}).`);
    if ((o.pumpkins || 0) > p.pumpkins || (o.wisps || 0) > p.wisps) return this.toast(s, "You don't have those items any more.");
    s.offer = null;
    let line = '';
    switch (o.kind) {
      case 'loan':
        if (p.debt) return this.toast(s, 'Repay your current loan first!');
        p.debt = { npc: 'count', amount: o.amount, due: o.due, until: now() + LOAN_MS };
        p.candy += o.amount;
        line = `🦇 You borrowed ${o.amount} candy. Repay ${o.due} to Count Snackula within 10 minutes!`;
        break;
      case 'sell_potion':
        p.candy -= o.price;
        this.applyPotion(s, o.potion);
        line = `🧪 You drank the ${POTIONS[o.potion].name}!`;
        break;
      case 'sell_costume':
      case 'sell_pet':
        p.candy -= o.price || 0;
        p.pumpkins -= o.pumpkins || 0;
        p.wisps -= o.wisps || 0;
        p.avatar = cleanAvatar({ ...p.avatar, [o.kind === 'sell_costume' ? 'costume' : 'pet']: o.choice }, p.pid);
        this.broadcast({ t: 'avatar', id: s.sid, avatar: p.avatar, photo: !!p.photo });
        line = `✨ New ${o.kind === 'sell_costume' ? 'costume piece' : 'pet'}: ${o.choice.replace(/_/g, ' ')}!`;
        break;
      case 'buy_items':
        if (o.item === 'wisp') p.wisps -= o.count;
        else p.pumpkins -= o.count;
        p.candy += o.count * o.each;
        line = `💰 Sold ${o.count} ${o.item === 'wisp' ? 'wisp jar' : 'pumpkin'}${o.count > 1 ? 's' : ''} for ${o.count * o.each} candy.`;
        break;
    }
    if (isDiscount(o)) this.completeQuest(s, 'deal');
    this.toast(s, line, 'good');
    this.dirty();
    this.sendMe(s);
  }

  repay(s) {
    const p = s.player;
    if (!p.debt) return;
    if (dist2(s, NPCS.count) > 144) return this.toast(s, 'Walk to Count Snackula at the Midnight Market to repay.');
    if (p.candy < p.debt.due) return this.toast(s, `You need ${p.debt.due} candy to repay (you have ${p.candy}).`);
    p.candy -= p.debt.due;
    p.debt = null;
    p.trust.count = Math.min(5, (p.trust.count || 0) + 2);
    this.toast(s, '🦇 Loan repaid! The Count bows deeply. The bats fly away.', 'good');
    this.broadcast({ t: 'fx', id: s.sid, fx: s.fx });
    this.dirty();
    this.sendMe(s);
  }

  applyPotion(s, kind) {
    const until = now() + POTIONS[kind].secs * 1000;
    s.fx = { kind, until };
    this.broadcast({ t: 'fx', id: s.sid, fx: s.fx });
  }

  // ---------- carving ----------
  carvingPublic(c) {
    return { id: c.id, name: c.name, slot: c.slot, likes: c.likes.length, v: c.v || 1 };
  }

  carve(s, m) {
    const p = s.player;
    const contest = m.contest && this.contest.active;
    if (!contest && dist2(s, CARVE_TABLE) > 64) return;
    const data = String(m.png || '');
    if (!data.startsWith('data:image/png;base64,') || data.length > 400000) return this.toast(s, 'That carving is too big. Try fewer strokes!');
    let c = this.state.carvings.find((x) => x.pid === p.pid);
    if (!c) {
      const used = new Set(this.state.carvings.map((x) => x.slot));
      let slot = 0;
      while (used.has(slot) && slot < CARVING_SLOTS) slot++;
      if (slot >= CARVING_SLOTS) {
        // gallery full: replace the oldest one
        const oldest = this.state.carvings.sort((a, b) => a.at - b.at)[0];
        slot = oldest.slot;
        this.state.carvings = this.state.carvings.filter((x) => x !== oldest);
      }
      c = { id: this.state.nextCarving++, pid: p.pid, name: p.name, slot, likes: [], at: now(), v: 0 };
      this.state.carvings.push(c);
    }
    c.v = (c.v || 0) + 1;
    c.at = now();
    fs.writeFileSync(path.join(DATA, 'carvings', `${c.id}.png`), Buffer.from(data.slice(22), 'base64'));
    p.carving = c.id;
    this.completeQuest(s, 'carve');
    if (contest) {
      const score = Math.max(0, Math.min(100, Math.round(Number(m.score) || 0)));
      const prev = this.contest.scores.get(p.pid);
      if (!prev || score > prev.score) this.contest.scores.set(p.pid, { name: p.name, score, carving: c.id });
      this.toast(s, `🔪 Your carving scored ${score}%! Results when the timer runs out.`, 'good');
    }
    this.broadcast({ t: 'carving', item: this.carvingPublic(c) });
    this.dirty();
  }

  // A carving from a photographed paper drawing (the booth). Same storage as the carving table.
  setCarvingImage(pid, png) {
    const p = this.state.players[pid];
    if (!p) return null;
    let c = this.state.carvings.find((x) => x.pid === pid);
    if (!c) {
      const used = new Set(this.state.carvings.map((x) => x.slot));
      let slot = 0;
      while (used.has(slot) && slot < CARVING_SLOTS) slot++;
      if (slot >= CARVING_SLOTS) {
        const oldest = this.state.carvings.sort((a, b) => a.at - b.at)[0];
        slot = oldest.slot;
        this.state.carvings = this.state.carvings.filter((x) => x !== oldest);
      }
      c = { id: this.state.nextCarving++, pid, name: p.name, slot, likes: [], at: now(), v: 0 };
      this.state.carvings.push(c);
    }
    c.v = (c.v || 0) + 1;
    c.at = now();
    fs.writeFileSync(path.join(DATA, 'carvings', `${c.id}.png`), png);
    p.carving = c.id;
    this.broadcast({ t: 'carving', item: this.carvingPublic(c) });
    for (const s of this.online()) if (s.pid === pid) {
      this.completeQuest(s, 'carve');
      this.toast(s, '🎃 Your drawing is now your glowing pumpkin! It shines in the plaza gallery, and it is the pumpkin you turn into.', 'win');
      this.sendMe(s);
    }
    this.dirty();
    return c;
  }

  likePumpkin(s, m) {
    const c = this.state.carvings.find((x) => x.id === Number(m.id));
    if (!c || c.pid === s.pid || c.likes.includes(s.pid)) return;
    c.likes.push(s.pid);
    this.broadcast({ t: 'carvingLikes', id: c.id, likes: c.likes.length, by: s.sid });
    const owner = this.online().find((o) => o.pid === c.pid);
    if (owner) this.toast(owner, `🎃 ${s.player.name} loved your jack-o'-lantern!`, 'heart');
    this.dirty();
  }

  // ---------- photo booth ----------
  setPhotoAvatar(pid, avatar, costumeWords = '') {
    const p = this.state.players[pid];
    if (!p) return null;
    const cls = classFromCostume(costumeWords);
    if (cls && !p.clsPicked) {
      p.cls = cls;
      for (const s of this.online()) if (s.pid === pid) this.toast(s, `🔮 The booth spirits see your costume: you are a ${CLASSES[cls].name}! Power: ${CLASSES[cls].power}.`, 'win');
    }
    p.avatar = avatar;
    p.photo = true;
    this.dirty();
    for (const s of this.online())
      if (s.pid === pid) {
        this.broadcast({ t: 'avatar', id: s.sid, avatar, photo: true, reveal: true });
        this.completeQuest(s, 'photo');
        this.sendMe(s);
      }
    return p;
  }

  // ---------- group events ----------
  tick() {
    const t = now();
    this.boss.tick(t);
    this.finale.tick(t);
    this.bear.tick(t);
    this.tickRooms(t);
    this.tickContest(t);
    const players = this.online();
    // positions to everyone at 10 Hz
    if (players.length) {
      const list = players.map((s) => [s.sid, +s.x.toFixed(2), +s.y.toFixed(2), +s.z.toFixed(2), +s.ry.toFixed(2), s.a, s.e]);
      this.broadcast({ t: 'tick', p: list, time: this.serverTime(), sp: this.tickSpiders(t, players) });
    }
    this.tickHealth(t, players);
    // loans: overdue debt makes the Count's bats follow you (purely cosmetic) until you repay
    for (const s of players) {
      const d = s.player.debt;
      if (d && t > d.until && !d.late) {
        d.late = true;
        this.toast(s, "🦇 Your loan is overdue! Count Snackula's bats will follow you until you repay.", 'boss');
        this.broadcast({ t: 'bats', id: s.sid, on: true });
      }
      if (s.fx && t > s.fx.until) {
        s.fx = null;
        this.broadcast({ t: 'fx', id: s.sid, fx: null });
      }
    }
    this.tickRitual(t, players);
    this.tickParty(t, players);
    this.tickSchedule(t);
  }

  tickRitual(t, players) {
    const need = players.length >= 3 ? 3 : RITUAL_MIN_PLAYERS;
    const filled = RITUAL_RUNES.map((r) => players.find((s) => !this.modded(s.player, 'block') && s.y < 2.5 && dist2(s, r) < RUNE_RADIUS * RUNE_RADIUS)?.sid || 0);
    const count = filled.filter(Boolean).length;
    const key = filled.join(',');
    if (key !== this.ritual.key) {
      this.ritual.key = key;
      this.broadcast({ t: 'ritual', filled, need, cooldown: this.ritual.cooldown > t });
    }
    if (t < this.ritual.cooldown || count < need) {
      this.ritual.since = 0;
      return;
    }
    if (!this.ritual.since) this.ritual.since = t;
    if (t - this.ritual.since > 2500) {
      this.ritual.since = 0;
      this.ritual.cooldown = t + 20000;
      const names = [];
      for (const sid of filled) {
        const s = this.sessions.get(sid);
        if (!s) continue;
        names.push(s.player.name);
        this.completeQuest(s, 'ritual');
        this.addCandy(s, 10, 'ritual');
        const items = (s.player.items ||= {});
        if (!items.fire) {
          items.fire = 1;
          this.toast(s, '🔥 The Pumpkin Spirit gave you a FIRE CHARM! Your candy throws are now fireballs (1.5x damage).', 'win');
          this.sendMe(s);
        }
      }
      this.broadcast({ t: 'event', kind: 'ritual', names });
      const moon = filled.map((sid) => this.sessions.get(sid)).find((x) => x?.player?.items?.moon);
      if (moon && this.bear.state === 'idle') {
        moon.player.items.moon--;
        this.sendMe(moon);
        this.bear.forceStart();
        this.broadcast({ t: 'toast', text: `🐻 ${moon.player.name} poured a Moon Potion on the runes… THE PUMPKIN BEAR AWAKENS at the Summoning Circle!`, kind: 'boss' });
      }
      this.broadcast({ t: 'toast', text: `🔮 ${names.join(', ')} completed the Summoning! The Great Pumpkin Spirit rises!`, kind: 'win' });
    }
  }

  tickParty(t, players) {
    const dancers = players.filter((s) => !this.modded(s.player, 'block') && dist2(s, DANCE_FLOOR) < DANCE_FLOOR.r * DANCE_FLOOR.r && DANCE_EMOTES.includes(s.e) && t - s.lastMove < 1500);
    const ids = dancers.map((s) => s.sid).sort();
    if (ids.join() !== this.party.key) {
      this.party.key = ids.join();
      this.broadcast({ t: 'party', dancers: ids, partying: t < this.party.until });
    }
    // an officer-started party pays out with any number of dancers
    const forced = t < (this.party.forced || 0);
    if (dancers.length < (forced ? 1 : 3) || (t < this.party.cooldown && !forced)) {
      this.party.since = 0;
      return;
    }
    if (!this.party.since) this.party.since = t;
    if (t - this.party.since > 6000) {
      this.party.forced = 0;
      this.party.since = 0;
      this.party.cooldown = t + 25000;
      this.party.until = t + 20000;
      const names = dancers.map((s) => s.player.name);
      for (const s of dancers) {
        this.completeQuest(s, 'dance');
        this.addCandy(s, 8, 'party');
      }
      this.broadcast({ t: 'event', kind: 'party', names, until: 20 });
      this.broadcast({ t: 'toast', text: `🕺 MONSTER MASH! ${names.join(', ')} started a dance party!`, kind: 'win' });
    }
  }

  // ---------- game master (officers) ----------
  activeMods(p) {
    const t = now(), out = {};
    for (const [k, until] of Object.entries(p.mod || {})) if (until > t) out[k] = until - t; // ms left
    return out;
  }
  modded(p, kind) {
    return (p?.mod?.[kind] || 0) > now();
  }

  // action: slow | block | mute (for `minutes`), clear, plaza (send back to the plaza)
  moderate(pid, action, minutes = 5) {
    const p = this.state.players[pid];
    if (!p) return null;
    const s = this.online().find((x) => x.pid === pid);
    if (action === 'clear') p.mod = {};
    else if (action === 'plaza') {
      if (s) this.send(s, { t: 'teleport', x: SPAWN.x, z: SPAWN.z });
    } else if (MODS[action]) {
      p.mod ||= {};
      p.mod[action] = now() + Math.max(1, Math.min(60, Number(minutes) || 5)) * 60000;
    } else return null;
    this.dirty();
    if (s) {
      const msg = {
        slow: '🐌 An officer slowed you down for a few minutes. Play nice! 💜',
        block: '🚫 An officer paused you from the boss and group games for a few minutes.',
        mute: '🔇 An officer muted your chat and emotes for a few minutes.',
        clear: '✅ You are free to go again. Have fun! 💜',
        plaza: '⛲ An officer sent you back to Lantern Plaza.',
      }[action];
      this.toast(s, msg, action === 'clear' ? 'good' : 'boss');
      this.sendMe(s);
    }
    console.log(`gm: ${action} ${p.name} ${action === 'clear' || action === 'plaza' ? '' : `${minutes} min`}`);
    return p;
  }

  // Start an event now (from the Game Master page or the schedule).
  startEvent(kind) {
    const ev = GM_EVENTS[kind];
    if (!ev) return false;
    if (kind === 'boss' && !this.boss.forceStart()) return false;
    if (kind === 'finale') {
      if (!this.finale.forceStart()) return false;
      this.broadcast({ t: 'event', kind: 'finale' });
      setTimeout(() => this.sayAloud(FINALE_SPEECH), 4000);
      setTimeout(() => this.spiderSwarm(ZONES.plaza, 6), 20000);
    }
    if (kind === 'spiders') this.spiderSwarm(ZONES.graveyard, 10);
    if (kind === 'carving' && !this.startContest()) return false;
    if (kind === 'party') {
      const t = now();
      this.party.forced = t + 25000;
      this.party.cooldown = 0;
      this.party.until = t + 25000;
      this.broadcast({ t: 'event', kind: 'party', names: [], until: 25 });
    }
    this.broadcast({ t: 'toast', text: `${ev.icon} ${ev.say}`, kind: 'announce' });
    this.sayAloud(ev.say);
    console.log('gm: event', kind);
    return true;
  }

  scheduleEvent(kind, at) {
    if (!GM_EVENTS[kind] || !(at > now())) return null;
    const item = { id: crypto.randomBytes(4).toString('hex'), kind, at, warned: false, done: false };
    this.state.schedule.push(item);
    this.dirty();
    return item;
  }
  unschedule(id) {
    this.state.schedule = this.state.schedule.filter((x) => x.id !== id);
    this.dirty();
  }

  tickSchedule(t) {
    for (const e of this.state.schedule) {
      if (e.done) continue;
      const ev = GM_EVENTS[e.kind];
      if (!e.warned && t > e.at - 60000) {
        e.warned = true;
        this.broadcast({ t: 'toast', text: `⏰ In 1 minute: ${ev.icon} ${ev.label}!`, kind: 'announce' });
      }
      if (t >= e.at) {
        e.done = true;
        this.startEvent(e.kind);
        this.dirty();
      }
    }
  }

  gmView() {
    return {
      online: this.online().map((s) => ({ pid: s.pid, name: s.player.name, code: s.player.code, title: s.player.avatar.title, mod: this.activeMods(s.player), quests: QUESTS.filter((q) => s.player.quests[q.id]?.done).length, candy: s.player.candy })),
      schedule: this.state.schedule.filter((e) => !e.done || now() - e.at < 10 * 60000),
      boss: this.boss.state,
      events: GM_EVENTS,
      mods: MODS,
    };
  }

  // ---------- health: get hit too much and you turn into a pumpkin until a friend revives you ----------
  hurt(s, n, src) {
    if (!n || s.down || !s.player) return;
    const t = now();
    if (t - (s.lastHurt || 0) < 600) return;
    s.lastHurt = t;
    s.hp = Math.max(0, s.hp - n);
    this.send(s, { t: 'hp', hp: s.hp, max: this.maxHp(s), hit: n, src });
    if (s.hp <= 0) this.knockDown(s);
  }

  knockDown(s) {
    s.down = now() + DOWN_MS;
    s.hp = 0;
    this.broadcast({ t: 'down', id: s.sid, on: true, carving: s.player.carving || null });
    this.toast(s, '🎃 Oh no, you turned into a pumpkin! A friend can revive you with a Revive Potion, or the moonlight frees you in a minute.', 'boss');
  }

  getUp(s, hp, by = null) {
    s.down = 0;
    s.hp = hp;
    this.broadcast({ t: 'down', id: s.sid, on: false, by });
    this.send(s, { t: 'hp', hp: s.hp, max: this.maxHp(s) });
  }

  revive(s, targetSid) {
    const tgt = this.sessions.get(targetSid);
    const items = (s.player.items ||= {});
    if (!tgt || !tgt.player || tgt === s || !tgt.down || s.down) return;
    if (dist2(s, tgt) > 20) return this.toast(s, 'Get closer to your pumpkin friend!');
    if (!items.revive) return this.toast(s, '🧪 You need a Revive Potion. Brew one at Madame Hex\'s cauldron, or buy one from her (20 candy).');
    items.revive--;
    this.getUp(tgt, 70, s.sid);
    this.toast(tgt, `💜 ${s.player.name} saved you with a Revive Potion!`, 'heart');
    this.toast(s, `🧪 You saved ${tgt.player.name}! What a hero.`, 'good');
    this.completeQuest(s, 'rescue');
    this.addCandy(s, 5, 'rescue');
    this.sendMe(s);
  }

  buyRevive(s) {
    const p = s.player;
    const items = (p.items ||= {});
    if (dist2(s, NPCS.hex) > 100) return this.toast(s, 'Madame Hex sells Revive Potions at her cottage.');
    if ((items.revive || 0) >= 5) return this.toast(s, 'Your bag only fits 5 Revive Potions!');
    if (p.candy < 20) return this.toast(s, 'A Revive Potion costs 20 candy.');
    p.candy -= 20;
    items.revive = (items.revive || 0) + 1;
    this.toast(s, '🧪 Hehehe! One Revive Potion, dearie. Save a friend with it!', 'good');
    this.dirty();
    this.sendMe(s);
  }

  tickHealth(t, players) {
    if (t - (this.healAt || 0) < 1000) return;
    this.healAt = t;
    for (const s of players) {
      if (s.down && t > s.down) {
        this.getUp(s, 50);
        this.toast(s, '🌕 The moonlight lifted the pumpkin curse. Back on your feet!', 'good');
      } else if (!s.down && s.hp < this.maxHp(s) && t - (s.lastHurt || 0) > 8000) {
        s.hp = Math.min(this.maxHp(s), s.hp + 4);
        this.send(s, { t: 'hp', hp: s.hp, max: this.maxHp(s) });
      }
    }
  }

  // ---------- spiders: they chase people in the dark parts of town and steal candy ----------
  spawnSpider(home = SPIDER_HOMES[this.nextSpider % SPIDER_HOMES.length], opts = {}) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * home.r * 0.8;
    const sp = { id: this.nextSpider++, x: home.x + Math.cos(a) * r, z: home.z + Math.sin(a) * r, ry: 0, home, goal: null, flee: 0, loot: 0, ...opts };
    this.spiders.set(sp.id, sp);
    return sp;
  }

  spiderSwarm(center, n) {
    for (let i = 0; i < n; i++) this.spawnSpider({ x: center.x, z: center.z, r: 8 }, { swarm: true, dies: now() + 70000 });
  }

  tickSpiders(t, players) {
    const dt = 0.1;
    const finale = ['intro', 'fight', 'stunned'].includes(this.finale.state);
    const out = [];
    for (const sp of this.spiders.values()) {
      if (sp.dies && t > sp.dies) {
        this.spiders.delete(sp.id);
        continue;
      }
      let goal = null;
      if (t < sp.flee) goal = sp.goal;
      else {
        // chase the nearest player in reach who is not a pumpkin and not somewhere safe
        let best = null, bd = 11 * 11;
        for (const s of players) {
          if (s.down || s.room || this.modded(s.player, 'block')) continue;
          if (!sp.swarm && !finale && SAFE.some((z) => dist2(s, z) < z.r * z.r)) continue;
          const d = dist2(sp, s);
          if (d < bd) (bd = d), (best = s);
        }
        if (best) {
          goal = { x: best.x, z: best.z };
          if (bd < 1.1 && t - (best.lastBite || 0) > 1500) {
            best.lastBite = t;
            const stolen = Math.min(3, best.player.candy);
            if (stolen) {
              best.player.candy -= stolen;
              sp.loot += stolen;
              this.send(best, { t: 'candy', n: -stolen, why: 'spider', total: best.player.candy });
              this.sendMe(best);
            }
            this.toast(best, stolen ? `🕷️ A spider bit you and ran off with ${stolen} candy! Throw candy at it (🍬) to get it back.` : '🕷️ A spider bit you!', 'boss');
            best.lastHurt = 0;
            this.hurt(best, 10, 'spider');
            // run away for a few seconds, toward home
            sp.flee = t + 4000;
            sp.goal = { x: sp.home.x, z: sp.home.z };
          }
        } else if (!sp.goal || dist2(sp, sp.goal) < 1 || Math.random() < 0.01) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * sp.home.r;
          sp.goal = { x: sp.home.x + Math.cos(a) * r, z: sp.home.z + Math.sin(a) * r };
        }
        goal ||= sp.goal;
      }
      if (goal) {
        const dx = goal.x - sp.x, dz = goal.z - sp.z, d = Math.hypot(dx, dz);
        const speed = (t < sp.flee ? SPIDER_SPEED * 1.2 : goal === sp.goal ? SPIDER_SPEED * 0.4 : SPIDER_SPEED) * dt;
        if (d > 0.2) {
          sp.x += (dx / d) * Math.min(d, speed);
          sp.z += (dz / d) * Math.min(d, speed);
          sp.ry = Math.atan2(dx, dz);
        }
      }
      out.push([sp.id, +sp.x.toFixed(2), +sp.z.toFixed(2), +sp.ry.toFixed(2)]);
    }
    return out;
  }

  hitSpider(s, id) {
    const sp = this.spiders.get(id);
    if (!sp || dist2(s, sp) > 12 * 12) return;
    const t = now();
    if (t - (s.lastSpiderHit || 0) < 300) return;
    s.lastSpiderHit = t;
    this.spiders.delete(id);
    const back = sp.loot + 2;
    this.broadcast({ t: 'spiderDie', id, by: s.sid });
    this.addCandy(s, back, sp.loot ? 'got the candy back' : 'spider');
    this.sendMe(s);
    if (!sp.swarm) setTimeout(() => this.spawnSpider(sp.home), 25000);
  }

  // ---------- classes ----------
  maxHp(s) {
    return CLASSES[s.player?.cls]?.hp || MAX_HP;
  }

  pickClass(s, cls) {
    const p = s.player;
    if (!CLASSES[cls]) return;
    // the first pick is free; changing later needs a word with Madame Hex
    if (p.clsPicked && dist2(s, NPCS.hex) > 144) return this.toast(s, 'Madame Hex can change your class at her cottage.');
    p.cls = cls;
    p.clsPicked = true;
    s.hp = Math.min(s.hp, this.maxHp(s));
    if (!s.down) s.hp = this.maxHp(s);
    this.send(s, { t: 'hp', hp: s.hp, max: this.maxHp(s) });
    this.broadcast({ t: 'cls', id: s.sid, cls });
    this.toast(s, `✨ You are a ${CLASSES[cls].name}! Your power: ${CLASSES[cls].power} (button or F).`, 'win');
    this.dirty();
    this.sendMe(s);
  }

  special(s, m) {
    const c = CLASSES[s.player.cls];
    const t = now();
    if (!c || s.down || this.modded(s.player, 'block')) return;
    if (t - (s.specialAt || 0) < c.cd * 1000 - 300) return;
    s.specialAt = t;
    if (s.player.cls === 'witch') {
      // a big fireball at the target the client picked (a spider, a boss or a minion)
      if (m.kind === 'spider') this.hitSpider(s, Number(m.id));
      else if (m.kind) {
        const b = m.b === 'mayor' ? this.finale : m.b === 'bear' ? this.bear : this.boss;
        b.lastHit?.delete?.(s.sid);
        b.hit(s, m.kind === 'minion' ? 'minion' : 'boss', Number(m.id), 3);
      }
    } else if (s.player.cls === 'vampire') {
      s.hp = Math.min(this.maxHp(s), s.hp + 15);
      this.send(s, { t: 'hp', hp: s.hp, max: this.maxHp(s) });
    } else if (s.player.cls === 'zombie') {
      // the groan scares spiders and minions close by
      for (const sp of [...this.spiders.values()]) if (dist2(s, sp) < 49) this.hitSpider(s, sp.id), (s.lastSpiderHit = 0);
      for (const b of [this.boss, this.finale, this.bear]) {
        for (const [id, mi] of b.minions) if (dist2(s, mi) < 36) b.minions.delete(id), this.broadcast({ t: 'bossAtk', b: b.id, kind: 'minionDie', id, by: s.sid });
      }
    }
    this.broadcast({ t: 'power', id: s.sid, cls: s.player.cls });
  }

  // ---------- arena duels: only in the Moonlit Courtyard, and only while the Gourd King sleeps ----------
  inDuelZone(s) {
    const A = ZONES.arena;
    return !s.room && (s.x - A.x) ** 2 + (s.z - A.z) ** 2 < A.r * A.r && this.boss.state === 'idle';
  }

  pvp(s, targetSid) {
    const tgt = this.sessions.get(targetSid);
    const t = now();
    if (!tgt?.player || tgt === s || s.down || tgt.down || !this.inDuelZone(s) || !this.inDuelZone(tgt)) return;
    if (dist2(s, tgt) > 14 * 14 || t - (s.lastPvp || 0) < 450 || this.modded(s.player, 'block')) return;
    s.lastPvp = t;
    tgt.lastHurt = 0;
    this.hurt(tgt, s.player.items?.fire ? 15 : 10, 'pvp');
    this.broadcast({ t: 'pvpHit', by: s.sid, id: tgt.sid });
    if (tgt.down) {
      this.addCandy(s, 5, 'duel win');
      this.broadcast({ t: 'toast', text: `⚔️ ${s.player.name} won a duel against ${tgt.player.name}!`, kind: 'info' });
    }
  }

  // ---------- team colours ----------
  colorOf(s) {
    const r = s.room && this.rooms.get(s.room);
    if (r) return r.color;
    let h = 0;
    for (const ch of String(s.pid || s.sid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return TEAM_COLORS[h % TEAM_COLORS.length];
  }

  // ---------- Gloom Manor: team rooms for 2-4 players ----------
  roomView(r) {
    return { t: 'room', id: r.id, state: r.state, step: r.step, color: r.color, members: [...r.members].map((sid) => ({ id: sid, name: this.sessions.get(sid)?.player?.name || '?' })), min: ROOM_MIN, max: ROOM_MAX };
  }
  roomSend(r, msg) {
    for (const sid of r.members) {
      const s = this.sessions.get(sid);
      if (s) this.send(s, msg);
    }
  }

  enterRoom(s) {
    if (s.room || s.down) return;
    if (dist2(s, MANOR_DOOR) > 64) return this.toast(s, 'Walk up to the door of Gloom Manor.');
    // join a team that is still gathering (friends who walk in together end up in the same room)
    let r = [...this.rooms.values()].find((x) => x.state === 'waiting' && x.members.size < ROOM_MAX);
    if (!r) {
      r = { id: this.nextRoom++, members: new Set(), state: 'waiting', step: 0, code: [], hints: new Map(), created: now(), color: TEAM_COLORS[this.nextRoom % TEAM_COLORS.length] };
      this.rooms.set(r.id, r);
    }
    r.members.add(s.sid);
    s.room = r.id;
    s.onPlate = null;
    this.send(s, { t: 'teleport', x: ROOM_SPAWN.x + rand(-2, 2), z: ROOM_SPAWN.z + rand(-1, 1), room: r.id });
    this.broadcast({ t: 'inRoom', id: s.sid, room: r.id, color: r.color });
    this.roomSend(r, this.roomView(r));
    this.toast(s, r.members.size < ROOM_MIN ? '🏚️ Welcome to Gloom Manor! Wait for at least one friend to join, then start the Spirit Lock.' : '🏚️ Your team is here! Press Start when everyone is in.', 'announce');
    if (r.members.size >= ROOM_MAX) this.roomStart(s);
  }

  roomStart(s) {
    const r = this.rooms.get(s.room);
    if (!r || r.state !== 'waiting') return;
    if (r.members.size < ROOM_MIN) return this.toast(s, `The Spirit Lock needs at least ${ROOM_MIN} people. Bring a friend!`);
    r.state = 'playing';
    r.step = 0;
    r.code = Array.from({ length: 4 }, () => PLATES[Math.floor(Math.random() * PLATES.length)].id);
    // split the code between the players, so nobody can solve it alone
    const members = [...r.members];
    r.hints = new Map(members.map((sid) => [sid, []]));
    r.code.forEach((col, i) => r.hints.get(members[i % members.length]).push({ i, color: col }));
    for (const sid of members) {
      const m = this.sessions.get(sid);
      if (m) this.send(m, { t: 'roomHints', hints: r.hints.get(sid) });
    }
    this.roomSend(r, this.roomView(r));
    this.roomSend(r, { t: 'toast', text: '🔒 The Spirit Lock wakes up! Each of you sees part of the colour code. Talk, then step on the plates in the right order.', kind: 'announce' });
  }

  leaveRoom(s, teleport) {
    const r = this.rooms.get(s.room);
    s.room = 0;
    if (teleport) this.send(s, { t: 'teleport', x: MANOR_DOOR.x + rand(-2, 2), z: MANOR_DOOR.z + 4, room: 0 });
    this.broadcast({ t: 'inRoom', id: s.sid, room: 0, color: this.colorOf(s) });
    if (!r) return;
    r.members.delete(s.sid);
    if (!r.members.size) this.rooms.delete(r.id);
    else this.roomSend(r, this.roomView(r));
  }

  tickRooms(t) {
    for (const r of this.rooms.values()) {
      if (r.state === 'waiting' && r.members.size >= ROOM_MIN && t - r.created > 45000) {
        // nobody pressed start: go anyway
        const any = this.sessions.get([...r.members][0]);
        if (any) this.roomStart(any);
      }
      if (r.state !== 'playing') continue;
      for (const sid of r.members) {
        const s = this.sessions.get(sid);
        if (!s) continue;
        const plate = PLATES.find((p) => dist2(s, p) < p.r * p.r && s.y < 1.2);
        if (!plate) {
          s.onPlate = null;
          continue;
        }
        if (s.onPlate === plate.id) continue;
        s.onPlate = plate.id;
        if (plate.id === r.code[r.step]) {
          r.step++;
          this.roomSend(r, { t: 'roomStep', step: r.step, plate: plate.id, ok: true });
          if (r.step >= r.code.length) this.roomWin(r);
        } else {
          r.step = 0;
          this.roomSend(r, { t: 'roomStep', step: 0, plate: plate.id, ok: false });
          this.roomSend(r, { t: 'toast', text: '👻 Wrong plate! The spirits shriek and the lock resets. Start again from the first colour.', kind: 'boss' });
        }
      }
    }
  }

  roomWin(r) {
    r.state = 'done';
    this.roomSend(r, this.roomView(r));
    const names = [];
    for (const sid of r.members) {
      const s = this.sessions.get(sid);
      if (!s) continue;
      names.push(s.player.name);
      this.completeQuest(s, 'manor');
      this.addCandy(s, 15, 'spirit lock');
      const items = (s.player.items ||= {});
      items.moon = (items.moon || 0) + 1;
      items.revive = Math.min(5, (items.revive || 0) + 1);
      this.toast(s, '🌕 The lock opens! You found a MOON POTION (and a Revive Potion). Take it to the Summoning Circle with friends to wake the Pumpkin Bear!', 'win');
      this.sendMe(s);
    }
    this.broadcast({ t: 'toast', text: `🏚️ ${names.join(', ')} cracked the Spirit Lock in Gloom Manor!`, kind: 'win' });
    setTimeout(() => {
      for (const sid of [...r.members]) {
        const s = this.sessions.get(sid);
        if (s) this.leaveRoom(s, true);
      }
    }, 7000);
  }

  // ---------- carving contest ----------
  startContest() {
    if (this.contest.active) return false;
    const stencil = STENCILS[Math.floor(Math.random() * STENCILS.length)];
    this.contest = { active: true, stencil, until: now() + (CONTEST_SECONDS + 20) * 1000, scores: new Map() };
    this.broadcast({ t: 'contest', state: 'on', stencil, left: CONTEST_SECONDS + 20 });
    return true;
  }

  tickContest(t) {
    const c = this.contest;
    if (!c.active || t < c.until) return;
    c.active = false;
    const ranked = [...c.scores.entries()].sort((a, b) => b[1].score - a[1].score);
    const top = ranked.slice(0, 3).map(([pid, v]) => ({ name: v.name, score: v.score, carving: v.carving, pid }));
    ranked.forEach(([pid, v], i) => {
      const s = this.online().find((x) => x.pid === pid);
      if (!s) return;
      this.addCandy(s, i === 0 ? 30 : i < 3 ? 15 : 5, 'carving contest');
      if (i === 0) this.giveTicket(s, 'for winning the carving contest');
      this.sendMe(s);
    });
    this.broadcast({ t: 'contest', state: 'done', top: top.map(({ pid, ...rest }) => rest), count: ranked.length });
    this.broadcast({ t: 'toast', text: top.length ? `🏆 Carving contest winner: ${top[0].name} with ${top[0].score}%!` : '🔪 The carving contest ended. Nobody carved this time!', kind: 'win' });
  }

  bossIdle(id) {
    if (id === 'mayor') this.broadcast({ t: 'toast', text: '🎃 Mayor Gourdon is back to his normal size… and he promises to be a GOOD mayor from now on.', kind: 'announce' });
  }

  // ---------- officer views ----------
  adminList() {
    const onlinePids = new Set(this.online().map((s) => s.pid));
    return Object.values(this.state.players)
      .map((p) => ({
        pid: p.pid, name: p.name, code: p.code, photo: !!p.photo, online: onlinePids.has(p.pid), candy: p.candy, tickets: p.tickets, redeemed: p.redeemed,
        quests: QUESTS.filter((q) => p.quests[q.id]?.done).length, title: p.avatar.title, lastSeen: p.lastSeen || p.created, avatar: p.avatar,
      }))
      .sort((a, b) => b.online - a.online || (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  redeem(pid, n = 1) {
    const p = this.state.players[pid];
    if (!p) return null;
    p.redeemed = Math.max(0, Math.min(p.tickets, (p.redeemed || 0) + n));
    this.dirty();
    for (const s of this.online()) if (s.pid === pid) this.sendMe(s), this.toast(s, n > 0 ? '🍬 Enjoy your treat! Happy Halloween!' : 'Ticket restored.', 'good');
    return p;
  }

  shutdown() {
    saveNow(this.state);
  }
}
