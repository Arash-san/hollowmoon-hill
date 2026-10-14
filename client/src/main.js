// Hollowmoon Hill client: boots the world, logs in, and runs the game loop.
import './style.css';
import { THREE } from './engine/toon.js';
import { Stage } from './engine/stage.js';
import { FX, emojiTexture } from './engine/fx.js';
import { World, groundY } from './world/world.js';
import { Character } from './entities/character.js';
import { PlayerController } from './entities/player.js';
import { buildNpc } from './avatar/npcs.js';
import { Activities } from './activities.js';
import { BossView } from './boss.js';
import { Input } from './input.js';
import { Net } from './net.js';
import { UI, NPC_ICON } from './ui.js';
import { Audio } from './audio.js';
import { potionGame } from './games/potion.js';
import { carveGame } from './games/carve.js';
import { showMap } from './map.js';
import { MiniMap } from './minimap.js';
import { photoBoothModal } from './photobooth.js';
import { Spiders } from './spiders.js';
import { CLUES } from '../../shared/story.js';
import {
  NPCS, faceYaw, CANDLES, CANDLE_TIME, CAULDRON, CARVE_TABLE, BOSS_BELL, BRAZIERS, BOARD, ZONES, EMOTES, QUESTS, DANCE_FLOOR, SPAWN, WISP_SLOTS, wispPos,
  PHOTO_BOOTH, QUEST_ICON,
} from '../../shared/world.js';
import { randomAvatar } from '../../shared/avatar.js';

const IDLE_LINES = {
  mayor: ['Vote Gourdon! 🎃', 'Three quests = one REAL treat!', 'Have you seen the quest board?'],
  hex: ['Fresh potions! Hehehe!', 'Wisps… I need wisps!', 'Come stir my cauldron, dearie!'],
  count: ['Candy loans! Mwahaha!', 'Reasonable interest… mostly.', 'Admire my cape, mortal.'],
  bones: ["Deals so good they're spooky!", "Got pumpkins? I'm buyin'!", 'Bone-afide bargains!'],
  hayley: ['Pick the glowing ones!', 'Shoo, crows! Shoo!', 'The patch needs helpers!'],
  wisp: ['Who wants a riddle?', 'Ooooh, knowledge!', 'Riddles for candy!'],
  dj: ['Get on the floor!', 'Three dancers = PARTY!', '🎵 Boo-boo-boo 🎵'],
};
const NPC_PITCH = { mayor: 62, hex: 76, count: 55, bones: 70, hayley: 74, wisp: 82, dj: 66 };
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

class Game {
  async boot() {
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
    this.ui = new UI();
    this.audio = new Audio();
    this.stage = new Stage(document.getElementById('app'));
    this.scene = this.stage.scene;
    this.camera = this.stage.camera;
    this.fx = new FX(this.scene);
    this.world = new World(this.scene, this.stage.quality);
    this.acts = new Activities(this.scene, this.fx, this.world);
    this.boss = new BossView(this.scene, this.fx, this.audio, 'king');
    this.bossState = { state: 'idle' };
    // the finale: Mayor Gourdon as the giant Pumpkin King, rising from the plaza fountain
    this.finale = new BossView(this.scene, this.fx, this.audio, 'mayor');
    this.finaleState = { state: 'idle' };
    this.spiders = new Spiders(this.scene, this.fx);
    this.hp = 100;
    this.downUntil = 0;
    this.input = new Input(this.stage.renderer.domElement, this.ui);
    this.others = new Map();
    this.npcs = new Map();
    this.partyUntil = 0;
    this.lastMove = 0;
    this.lastSent = '';
    this.myId = null;
    this.state = null;
    this.buildNpcs();
    this.minimap = new MiniMap(this, document.getElementById('minimap'));
    this.tracked = localStorage.getItem('hh-track') || '';
    this.ui.tracked = this.tracked;
    this.bindUi();
    this.t0 = performance.now();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    window.__game = this;

    const params = new URLSearchParams(location.search);
    this.token = localStorage.getItem('hh-token');
    if (!this.token || params.get('fresh')) {
      this.token = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('hh-token', this.token);
    }
    this.ui.voiceToken = this.token;
    const savedName = localStorage.getItem('hh-name');
    const auto = params.get('name');
    this.ui.hideLoading();
    window.__ready = true;
    if (auto) this.login(auto);
    else this.ui.showLogin(savedName || '', (n) => this.login(n));
  }

  // ---------------------------------------------------------------- setup
  buildNpcs() {
    for (const [id, n] of Object.entries(NPCS)) {
      const c = new Character(this.scene, this.fx, { npc: buildNpc(n.look), name: n.name, plateColor: '#9ef0ff' });
      c.pos.set(n.x, groundY(n.x, n.z), n.z);
      c.homeYaw = c.yaw = faceYaw(n);
      c.root.rotation.y = c.yaw;
      c.idleAt = performance.now() + 3000 + Math.random() * 15000;
      this.npcs.set(id, c);
    }
  }

  bindUi() {
    const ui = this.ui, inp = this.input;
    ui.on('chat', (text) => this.net?.send({ t: 'chat', text }));
    ui.on('emote', (e) => this.doEmote(e));
    ui.on('talk', (npc, text) => {
      this.stopVoice();
      this.me?.speak(text);
      this.npcs.get(npc)?.say('…', 30, true);
      this.net.send({ t: 'talk', npc, text });
    });
    ui.on('npcSays', (npc, text) => {
      this.npcs.get(npc)?.speak(text);
      this.net?.send({ t: 'greet', npc });
    });
    ui.on('accept', () => this.net.send({ t: 'accept' }));
    ui.on('repay', () => this.net.send({ t: 'repay' }));
    ui.on('buyTicket', () => this.net.send({ t: 'buyTicket' }));
    ui.on('tickets', () => ui.tickets(this.state));
    ui.on('buyRevive', () => this.net.send({ t: 'buyRevive' }));
    ui.on('listening', () => this.stopVoice());
    ui.on('dialogClosed', () => {
      this.stopVoice();
      const npc = this.npcs.get(this.talkingTo);
      if (npc) npc.talkTarget = null;
      this.talkingTo = null;
    });
    const tapBtn = (sel, fn) => {
      const el = document.querySelector(sel);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.audio.start();
        this.audio.resume();
        fn();
      });
    };
    tapBtn('#act-jump', () => this.jump());
    tapBtn('#act-use', () => this.interact());
    tapBtn('#act-emote', () => ui.toggleEmotes());
    tapBtn('#act-chat', () => (ui.chatOpen() ? ui.closeChat() : ui.openChat()));
    tapBtn('#act-attack', () => this.attack());
    tapBtn('#prompt', () => this.interact());
    document.querySelector('#map-btn').onclick = () => showMap(ui, this);
    document.querySelector('#minimap').onclick = () => showMap(ui, this);
    document.querySelector('#booth-banner').onclick = () => {
      this.track('photo');
      showMap(ui, this, 'photo');
    };
    // tapping a quest on the checklist tracks it and shows where it is on the map
    ui.on('trackQuest', (id) => {
      this.track(id);
      showMap(ui, this, id);
    });
    document.querySelector('#quests-btn').onclick = () => this.questsModal();
    document.querySelector('#story-btn').onclick = () => this.state && ui.journal(this.state);
    document.querySelector('#help-btn').onclick = () => ui.help(touch);
    document.querySelector('#ticket-pill').onclick = () => ui.tickets(this.state);
    document.querySelector('#candy-pill').onclick = () => ui.toast('🍬 Candy buys potions, costume swaps and Treat Tickets (from the mayor).');
    document.querySelector('#sound-btn').onclick = (e) => {
      this.audio.start();
      e.currentTarget.textContent = this.audio.toggle() ? '🔊' : '🔇';
    };
    document.querySelector('#sound-btn').textContent = this.audio.on ? '🔊' : '🔇';
    inp.on('jump', () => this.jump());
    inp.on('interact', () => this.interact());
    inp.on('emotes', () => ui.toggleEmotes());
    inp.on('chat', () => (ui.chatOpen() ? null : ui.openChat()));
    inp.on('map', () => (ui.modalOpen() ? ui.closeModal() : showMap(ui, this)));
    inp.on('quests', () => this.questsModal());
    inp.on('journal', () => this.state && this.ui.journal(this.state));
    inp.on('attack', () => this.attack());
    inp.on('escape', () => {
      ui.closeEmotes();
      ui.closeChat();
      if (ui.modalOpen()) ui.closeModal();
      else if (ui.dialogNpc) ui.closeDialog();
    });
    inp.on('emoteKey', (i) => EMOTES[i] && this.doEmote(EMOTES[i].id));
    // hold V to talk to the NPC you are with
    inp.on('talkDown', () => ui.dialogNpc && !ui.typing && ui.voice.keyDown());
    inp.on('talkUp', () => ui.voice.keyUp());
    inp.on('tap', (x, y) => this.tapWorld(x, y));
    addEventListener('pointerdown', () => {
      this.audio.start();
      this.audio.resume();
    }, { once: false, passive: true });
  }

  // ---------------------------------------------------------------- login + network
  login(name) {
    localStorage.setItem('hh-name', name);
    this.audio.start();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    // relative to the page, so the game also works behind a path prefix (the officer portal serves it at /halloween/)
    const base = location.pathname.replace(/[^/]*$/, '');
    this.net = new Net(`${proto}://${location.host}${base}ws`);
    const n = this.net;
    n.on('open', () => n.send({ t: 'hello', token: this.token, name }));
    n.on('close', (ev) => {
      if (ev.code === 4000) this.ui.toast('You opened the game in another tab. This one is paused.', 'boss');
      else if (this.state) this.ui.toast('Reconnecting…');
    });
    n.on('needName', () => this.ui.showLogin('', (nm) => n.send({ t: 'hello', token: this.token, name: nm })));
    n.on('welcome', (m) => this.onWelcome(m));
    n.on('me', (m) => this.setState(m));
    n.on('join', (m) => this.addOther(m.p, true));
    n.on('leave', (m) => this.removeOther(m.id));
    n.on('tick', (m) => this.onTick(m));
    n.on('avatar', (m) => this.onAvatar(m));
    n.on('emote', (m) => this.onEmote(m));
    n.on('chat', (m) => this.onChat(m));
    n.on('toast', (m) => this.ui.toast(m.text, m.kind));
    n.on('spawn', (m) => (m.kind === 'pumpkin' ? this.acts.addPumpkin(m.item, true) : this.acts.addCandy(m.item)));
    n.on('despawn', (m) => this.onDespawn(m));
    n.on('wisp', (m) => {
      this.acts.catchWisp(m.slot, m.gen);
      if (m.by === this.myId) this.audio.play('wisp');
    });
    n.on('npc', (m) => this.onNpc(m));
    n.on('npcVoice', (m) => this.queueVoice(m));
    n.on('candy', (m) => this.onCandy(m));
    n.on('quest', (m) => this.onQuest(m));
    n.on('ticket', (m) => this.onTicket(m));
    n.on('fx', (m) => this.charById(m.id)?.applyEffect(m.fx));
    n.on('bats', (m) => this.charById(m.id)?.setBats(m.on));
    n.on('carving', (m) => this.acts.setCarving(m.item));
    n.on('carvingLikes', (m) => this.acts.setCarvingLikes(m.id, m.likes));
    n.on('boss', (m) => (m.b === 'mayor' ? this.onFinale(m) : this.onBoss(m)));
    n.on('bossAtk', (m) => (m.b === 'mayor' ? this.finale : this.boss).attack(m, n.serverTime()));
    n.on('bossHit', (m) => {
      const mayor = m.b === 'mayor';
      (mayor ? this.finale : this.boss).onHit(m.by, m.dmg);
      const st = mayor ? this.finaleState : this.bossState;
      st.hp = m.hp;
      this.refreshBossBar();
    });
    n.on('hp', (m) => {
      this.hp = m.hp;
      this.ui.setHp(m.hp, m.max, m.hit);
      if (m.hit && this.me) this.fx.text(`-${m.hit} ❤️`, this.me.pos.clone().setY(this.me.pos.y + 2.4), '#ff6b6b', 0.42);
    });
    n.on('down', (m) => this.onDown(m));
    n.on('clue', (m) => {
      const c = CLUES.find((x) => x.id === m.id);
      if (!c) return;
      this.audio.play('ticket');
      this.ui.banner('🔍 A clue!');
      this.ui.toast(`${c.icon} ${c.text} (read all clues in 📖)`, 'announce');
    });
    n.on('spiderDie', (m) => {
      this.spiders.remove(m.id);
      if (m.by === this.myId) this.audio.play('pickup');
    });
    n.on('ritual', (m) => this.acts.setRunes(m.filled));
    n.on('party', (m) => (this.dancers = m.dancers));
    n.on('event', (m) => this.onEvent(m));
    n.on('teleport', (m) => {
      if (!this.me) return;
      this.me.pos.set(m.x, 0, m.z);
      this.ctrl.snapCam = true;
      this.sendMove(true);
    });
    n.connect();
  }

  onWelcome(m) {
    this.myId = m.sid;
    const first = !this.me;
    // Madame Hex's prophecy, once per browser
    if (first && !localStorage.getItem('hh-prophecy')) setTimeout(() => {
      localStorage.setItem('hh-prophecy', '1');
      this.ui.prophecy();
    }, 1600);
    if (first) {
      this.me = new Character(this.scene, this.fx, { spec: m.me.avatar, name: m.me.name, title: m.me.avatar.title, likes: m.me.likes });
      this.me.pos.set(SPAWN.x + (Math.random() - 0.5) * 4, 0, SPAWN.z + Math.random() * 2);
      this.ctrl = new PlayerController(this.me, this.camera, this.input, this.world);
      this.ctrl.snapCam = true;
      this.ctrl.onJump = () => this.audio.play('jump');
      this.ctrl.onLand = () => this.audio.play('land');
      this.ui.showHud();
      setTimeout(() => {
        if (!localStorage.getItem('hh-helped')) {
          localStorage.setItem('hh-helped', '1');
          this.ui.help(touch);
        }
      }, 1200);
    } else {
      // reconnect: rebuild everything shared
      for (const id of [...this.others.keys()]) this.removeOther(id);
    }
    this.setState(m.me);
    for (const p of m.players) this.addOther(p, false);
    for (const [id] of this.acts.pumpkins) this.acts.remove('pumpkin', id);
    for (const [id] of this.acts.candies) this.acts.remove('candy', id);
    for (const p of m.world.pumpkins) this.acts.addPumpkin(p);
    for (const c of m.world.candies) this.acts.addCandy(c);
    this.acts.setWispGen(m.world.wisps);
    for (const c of m.world.carvings) this.acts.setCarving(c);
    this.onBoss({ ...m.world.boss });
    for (const mi of m.world.minions || []) this.boss.addMinion(mi);
    if (m.world.finale) this.onFinale({ ...m.world.finale });
    for (const mi of m.world.finaleMinions || []) this.finale.addMinion(mi);
    this.ui.setOnline(this.others.size + 1);
  }

  setState(me) {
    const prev = this.state;
    this.state = { ...(prev || {}), ...me };
    this.ui.setMe(this.state, prev);
    this.drawMeFace();
    if (this.ui.dialogNpc) this.ui.renderExtras(this.state);
    if (this.me && (me.avatar && JSON.stringify(me.avatar) !== JSON.stringify(this.me.spec))) {
      // handled by the avatar broadcast; keep the plate in sync
    }
    if (this.me) this.me.setBats(!!(this.state.debt && this.state.debt.late));
    // officer moderation: remember when each one ends on our own clock
    if (me.mod) this.modUntil = Object.fromEntries(Object.entries(me.mod).map(([k, ms]) => [k, performance.now() + ms]));
  }

  drawMeFace() {
    if (!this.me) return;
    const c = document.getElementById('me-face');
    const x = c.getContext('2d');
    const a = this.me.spec || this.state.avatar;
    x.clearRect(0, 0, 72, 72);
    x.fillStyle = a.skin;
    x.beginPath();
    x.arc(36, 40, 26, 0, Math.PI * 2);
    x.fill();
    if (a.hair.style !== 'bald') {
      x.fillStyle = a.hair.color;
      x.beginPath();
      x.arc(36, 36, 28, Math.PI * 1.02, Math.PI * 1.98);
      x.fill();
    }
    x.drawImage(this.me.avatar.face.canvas, 4, 22, 64, 44);
  }

  addOther(p, announce) {
    if (p.id === this.myId || this.others.has(p.id)) return;
    const c = new Character(this.scene, this.fx, { spec: p.avatar, name: p.name, title: p.title, likes: p.likes, outline: this.stage.quality > 0 });
    c.pos.set(p.x, p.y, p.z);
    c.yaw = p.ry;
    if (p.fx) c.applyEffect(p.fx);
    c.carving = p.carving;
    if (p.down) c.setPumpkin(true, p.carving);
    c.down = !!p.down;
    this.others.set(p.id, c);
    this.ui.setOnline(this.others.size + 1);
    if (announce) this.ui.chatLine('', `👻 ${p.name} joined the party!`, true);
  }

  removeOther(id) {
    const c = this.others.get(id);
    if (!c) return;
    this.ui.chatLine('', `${c.name} left.`, true);
    c.dispose();
    this.others.delete(id);
    this.ui.setOnline(this.others.size + 1);
  }

  charById(id) {
    return id === this.myId ? this.me : this.others.get(id);
  }

  onTick(m) {
    this.spiders.sync(m.sp);
    for (const [id, x, y, z, ry, a, e] of m.p) {
      if (id === this.myId) continue;
      const c = this.others.get(id);
      if (c) c.pushState(m.time, x, y, z, ry, a, e);
    }
  }

  onAvatar(m) {
    const c = this.charById(m.id);
    if (!c) return;
    c.title = m.avatar.title;
    c.setAvatar(m.avatar, { reveal: !!m.reveal || true });
    c.setPlate();
    if (m.id === this.myId) {
      this.state.avatar = m.avatar;
      this.drawMeFace();
      if (m.reveal) {
        this.ui.banner('✨ Meet the 3D you! ✨');
        this.audio.play('ticket');
        this.ui.toast(`You are now "${m.avatar.title}"! Your pet ${m.avatar.pet.replace('_', ' ')} is following you.`, 'win');
      }
    } else if (m.reveal) this.ui.chatLine('', `📸 ${c.name} got their 3D look: "${m.avatar.title}"!`, true);
  }

  onEmote(m) {
    const c = this.charById(m.id);
    if (!c) return;
    if (m.id !== this.myId) c.emote(m.e);
    if (m.e === 'heart' && m.target) {
      const t = this.charById(m.target);
      if (t) {
        this.fx.emoji('💜', t.pos.clone().setY(t.pos.y + 2.2), 4);
        if (m.likes !== undefined) {
          t.likes = m.likes;
          t.setPlate();
        }
      }
      if (m.target === this.myId) this.audio.play('heart');
    }
    // getting booed nearby makes you jump!
    if (m.e === 'boo' && m.id !== this.myId && this.me && c.pos.distanceTo(this.me.pos) < 4.5) {
      setTimeout(() => {
        this.ctrl.jump();
        this.fx.emoji('❗', this.me.pos.clone().setY(this.me.pos.y + 2.3), 1, { size: 0.6 });
        this.audio.play('boo');
      }, 350);
    }
  }

  onChat(m) {
    this.ui.chatLine(m.name, m.text);
    this.charById(m.id)?.say(m.text);
  }

  onDespawn(m) {
    this.acts.remove(m.kind, m.id, m.by === this.myId ? this.me.pos : null);
    if (m.by === this.myId) this.audio.play(m.kind === 'pumpkin' ? 'pickup' : 'candy');
  }

  onCandy(m) {
    if (m.n > 0 && this.me) this.fx.text(`+${m.n} 🍬`, this.me.pos.clone().setY(this.me.pos.y + 2.4), '#ffe066', 0.42);
  }

  onQuest(m) {
    const q = QUESTS.find((x) => x.id === m.id);
    if (m.done) {
      this.audio.play('quest');
      this.ui.banner(`✅ ${q.title}`);
      this.ui.toast(`Quest complete: ${q.title} (+${m.reward} 🍬)`, 'good');
      this.fx.confetti(this.me.pos.clone().setY(this.me.pos.y + 2), 50, 4);
    } else if (q) this.ui.toast(`${q.title}: ${m.n}/${m.goal}`);
  }

  onTicket(m) {
    this.audio.play('ticket');
    this.ui.banner('🎟️ Treat Ticket!');
    this.ui.toast(`You earned a Treat Ticket ${m.why}! Show your code at the club treat table for real candy.`, 'win');
    this.fx.sparkle(this.me.pos.clone().setY(this.me.pos.y + 1.5), '#ffd23f', 30, 2);
  }

  // NPC voices: sentence clips arrive one by one and play in order (a new reply cuts off the old one).
  queueVoice(m) {
    if (!this.audio.on) return;
    if (m.i === 0) this.stopVoice();
    const a = new window.Audio(`api/tts/${m.audio}.wav`);
    a.preservesPitch = false; // the playback rate also shifts the pitch: deeper Count, squeakier Bones
    a.playbackRate = m.rate || 1;
    a.preload = 'auto';
    (this.voiceQueue ||= []).push({ a, npc: m.npc });
    if (!this.voiceNow) this.playNextVoice();
  }

  playNextVoice() {
    const next = this.voiceQueue?.shift();
    this.voiceNow = next || null;
    if (!next) return;
    const npc = this.npcs.get(next.npc);
    next.a.onended = next.a.onerror = () => {
      if (npc) npc.talking = 0;
      this.playNextVoice();
    };
    next.a.onplaying = () => {
      if (npc) npc.talking = performance.now() + (next.a.duration / (next.a.playbackRate || 1)) * 1000;
    };
    next.a.play().catch(() => this.playNextVoice());
  }

  stopVoice() {
    this.voiceNow?.a.pause();
    this.voiceNow = null;
    this.voiceQueue = [];
  }

  onNpc(m) {
    const npc = this.npcs.get(m.npc);
    if (npc) {
      // the reply is a speech bubble over their head (paged if it is long)
      npc.speak(m.say);
      npc.talking = performance.now() + Math.min(5000, 900 + m.say.length * 45);
      this.audio.play('babble', { pitch: NPC_PITCH[m.npc], len: m.say.length });
    }
    if (this.ui.dialogNpc === m.npc) this.ui.showOffer(m.offer, this.state.candy);
  }

  onBoss(m) {
    const prev = this.bossState.state;
    this.bossState = { ...this.bossState, ...m };
    delete this.bossState.t;
    this.boss.setState(this.bossState);
    this.acts.setBraziers(this.bossState.braziers || [], this.bossState.state === 'shield');
    this.refreshBossBar();
    if (prev !== m.state && m.state === 'stunned') this.audio.play('dizzy');
  }

  onFinale(m) {
    const prev = this.finaleState.state;
    this.finaleState = { ...this.finaleState, ...m };
    delete this.finaleState.t;
    this.finale.setState(this.finaleState);
    this.refreshBossBar();
    const on = ['intro', 'fight', 'stunned'].includes(m.state);
    // the friendly mayor at his stall disappears while his giant self is loose
    const mayor = this.npcs.get('mayor');
    if (mayor) mayor.root.visible = !on;
    document.body.classList.toggle('finale', on);
    if (prev !== m.state && m.state === 'stunned') this.audio.play('dizzy');
  }

  // One boss bar: the finale wins over the Gourd King if both are up.
  refreshBossBar() {
    const f = this.finaleState;
    if (['intro', 'fight', 'shield', 'stunned'].includes(f.state)) this.ui.bossBar(f, '🎩🎃 Mayor Gourdon, the Pumpkin King');
    else this.ui.bossBar(this.bossState);
  }

  onDown(m) {
    const c = this.charById(m.id);
    if (!c) return;
    c.down = m.on;
    c.setPumpkin(m.on, m.carving ?? c.carving ?? this.state?.carving);
    if (m.id === this.myId) {
      this.downUntil = m.on ? performance.now() + 60000 : 0;
      this.ui.setDown(m.on, 60);
      if (m.on) this.audio.play('boo');
      else this.audio.play('ticket');
    } else if (m.on && this.me && c.pos.distanceTo(this.me.pos) < 30) this.ui.chatLine('', `🎃 ${c.name} turned into a pumpkin! Revive them with a 🧪 Revive Potion.`, true);
    if (!m.on && m.by) {
      const by = this.charById(m.by);
      if (by) this.ui.chatLine('', `💜 ${by.name} saved ${c.name}!`, true);
    }
  }

  onEvent(m) {
    if (m.kind === 'party') {
      this.partyUntil = performance.now() + (m.until || 20) * 1000;
      this.ui.banner('🕺 MONSTER MASH! 🕺');
      this.fx.confetti(new THREE.Vector3(DANCE_FLOOR.x, 3, DANCE_FLOOR.z), 120, 6);
      this.npcs.get('dj')?.emote('dance');
    }
    if (m.kind === 'ritual') {
      this.audio.play('ritual');
      this.ui.banner('🔮 The Summoning! 🔮');
      const c = ZONES.circle;
      for (let i = 0; i < 6; i++) setTimeout(() => this.fx.confetti(new THREE.Vector3(c.x + (Math.random() - 0.5) * 8, 4 + Math.random() * 4, c.z + (Math.random() - 0.5) * 8), 40, 5), i * 300);
      this.fx.sparkle(new THREE.Vector3(c.x, 2, c.z), '#b78bff', 60, 4);
      this.spirit = { t: 0 };
    }
    if (m.kind === 'bossWin') {
      this.audio.play('win');
      this.ui.banner(m.b === 'mayor' ? '🎉 TOWN SAVED! 🎉' : '👑 VICTORY! 👑');
    }
    if (m.kind === 'finale') {
      // the plot twist: the mayor turns on the town
      this.audio.play('roar');
      this.ui.banner("🎩 THE MAYOR'S BETRAYAL 🎩");
      const mayor = this.npcs.get('mayor');
      mayor?.say('Fools! You fell for my jolly act! NOW YOU ALL BECOME PUMPKINS!', 6);
      this.ui.toast('🎩 Mayor Gourdon was the villain all along! Everyone to Lantern Plaza and stop him!', 'boss');
      this.track('finale');
    }
  }

  // ---------------------------------------------------------------- actions
  jump() {
    if (!this.ctrl || this.ui.modalOpen()) return;
    if (this.me.anim.emote) this.me.anim.stop();
    this.ctrl.jump();
  }

  doEmote(e) {
    if (!this.me) return;
    this.me.emote(e);
    this.audio.play(e === 'heart' ? 'heart' : e === 'boo' ? 'boo' : 'pop');
    let target = null;
    if (e === 'heart') {
      let bd = 10;
      for (const [id, o] of this.others) {
        const d = o.pos.distanceTo(this.me.pos);
        if (d < bd) (bd = d), (target = id);
      }
      if (!target) this.ui.toast('💜 Get close to another player to send them a heart!');
    }
    this.net?.send({ t: 'emote', e, target });
    this.sendMove(true);
  }

  attack() {
    if (!this.me || this.downUntil) return;
    const now = performance.now();
    if (now - (this.lastThrow || 0) < 380) return;
    const target = this.spiders.nearest(this.me.pos, 8)
      || (this.finale.active() && this.finale.nearestTarget(this.me.pos))
      || (this.boss.active() && this.boss.nearestTarget(this.me.pos));
    if (!target) return;
    this.lastThrow = now;
    this.me.yaw = Math.atan2(target.pos().x - this.me.pos.x, target.pos().z - this.me.pos.z);
    this.me.emote('wave');
    this.audio.play('throw');
    const from = this.me.pos.clone().setY(this.me.pos.y + 1.4);
    const view = target.b === 'mayor' || (target.kind === 'minion' && this.finale.minions.has(target.id) && !this.boss.minions.has(target.id)) ? this.finale : this.boss;
    view.throwAt(from, target, () => this.net.send({ t: 'hit', kind: target.kind, id: target.id, b: view.id }), this.state?.items?.fire ? '🔥' : '🍬');
  }

  // Everything you can interact with near the player, nearest first.
  interactables() {
    const list = [];
    const st = this.state;
    for (const [id, n] of this.npcs) list.push({ x: n.pos.x, z: n.pos.z, r: 3.3, icon: '💬', short: 'Talk', label: `Talk to ${NPCS[id].name}`, act: () => this.openNpc(id), pri: 2 });
    for (const [id, e] of this.acts.pumpkins) list.push({ x: e.item.x, z: e.item.z, r: 2.3, icon: '🎃', short: 'Pick', label: 'Pick the glowing pumpkin', act: () => this.net.send({ t: 'pick', kind: 'pumpkin', id }), pri: 3 });
    const sNow = this.net?.serverTime() || 0;
    for (let i = 0; i < WISP_SLOTS; i++) {
      const g = this.acts.wispGen[i];
      if (g === undefined) continue;
      const p = wispPos(g, sNow);
      list.push({ x: p.x, z: p.z, r: 2.8, icon: '🫙', short: 'Catch', label: 'Catch the wisp!', act: () => this.net.send({ t: 'wisp', slot: i }), pri: 4 });
    }
    CANDLES.forEach((c, i) => {
      if (!this.acts.candleLit[i]) list.push({ x: c.x, z: c.z, r: 2.1, icon: '🕯️', short: 'Light', label: this.acts.candleRun ? 'Light the candle' : 'Light a candle (starts the Candle Vigil)', act: () => this.lightCandle(i), pri: 3 });
    });
    list.push({ x: CAULDRON.x, z: CAULDRON.z, r: 3, icon: '🧪', short: 'Brew', label: 'Brew a potion', act: () => potionGame(this.ui, this.audio, (score) => this.net.send({ t: 'quest', id: 'potion', score })), pri: 1 });
    list.push({ x: CARVE_TABLE.x, z: CARVE_TABLE.z, r: 3, icon: '🔪', short: 'Carve', label: 'Carve a pumpkin', act: () => carveGame(this.ui, this.audio, (png) => this.net.send({ t: 'carve', png })), pri: 1 });
    list.push({ x: BOARD.x, z: BOARD.z, r: 3, icon: '📜', short: 'Read', label: 'Read the quest board', act: () => this.questsModal(), pri: 0 });
    list.push({ x: PHOTO_BOOTH.x, z: PHOTO_BOOTH.z, r: 4.2, icon: '📸', short: 'Photo', label: 'Step into the Photo Booth', act: () => photoBoothModal(this.ui, this), pri: 2 });
    const bs = this.bossState.state;
    if (bs === 'idle') list.push({ x: BOSS_BELL.x, z: BOSS_BELL.z, r: 3.5, icon: '🔔', short: 'Ring', label: 'Ring the bell (wakes the Gourd King!)', act: () => this.ringBell(), pri: 2 });
    if (['fight', 'shield', 'stunned'].includes(bs)) BRAZIERS.forEach((b, i) => {
      if (!this.bossState.braziers?.[i]) list.push({ x: b.x, z: b.z, r: 3.2, icon: '🔥', short: 'Light', label: 'Light the brazier', act: () => this.net.send({ t: 'brazier', i }), pri: 3 });
    });
    for (const [id, c] of this.acts.carvings) {
      const s = this.world.carvingSlots[c.item.slot];
      if (s && c.item.pid !== this.state?.pid) list.push({ x: s.x, z: s.z, r: 2.4, icon: '💜', short: 'Like', label: `Love ${c.item.name}'s jack-o'-lantern`, act: () => this.net.send({ t: 'likePumpkin', id }), pri: 1 });
    }
    for (const [id, o] of this.others) {
      if (o.down) {
        const n = this.state?.items?.revive || 0;
        list.push({ x: o.pos.x, z: o.pos.z, r: 3.2, icon: '🧪', short: 'Revive', label: n ? `Revive ${o.name} with a Revive Potion (🧪 ${n} left)` : `${o.name} needs a Revive Potion (brew one at the cauldron)`, act: () => this.net.send({ t: 'revive', id }), pri: 5 });
      } else list.push({ x: o.pos.x, z: o.pos.z, r: 2.6, icon: '💜', short: 'Heart', label: `Send ${o.name} a heart`, act: () => this.doEmote('heart', id), pri: 0 });
    }
    void st;
    return list;
  }

  nearest() {
    if (!this.me) return null;
    const p = this.me.pos;
    let best = null, bs = Infinity;
    for (const it of this.interactables()) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d > it.r * Math.max(1, this.me.scaleNow)) continue;
      const score = d - it.pri * 0.6;
      if (score < bs) (bs = score), (best = it);
    }
    return best;
  }

  interact() {
    if (!this.me || this.ui.modalOpen() || this.downUntil) return;
    const it = this.nearest();
    if (it) {
      this.audio.play('click');
      it.act();
    }
  }

  tapWorld(sx, sy) {
    // tap on something near you on screen to use it (tablets)
    if (!this.me) return;
    const v = new THREE.Vector3();
    let best = null, bd = 70;
    for (const it of this.interactables()) {
      if (Math.hypot(it.x - this.me.pos.x, it.z - this.me.pos.z) > Math.max(it.r, 5)) continue;
      v.set(it.x, groundY(it.x, it.z) + 1, it.z).project(this.camera);
      const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight;
      const d = Math.hypot(px - sx, py - sy);
      if (d < bd) (bd = d), (best = it);
    }
    if (best) best.act();
  }

  openNpc(id) {
    this.ui.closeEmotes();
    this.ui.openDialog(id, this.state);
    this.talkingTo = id;
    const npc = this.npcs.get(id);
    npc.talkTarget = this.me;
    // turn the camera so you look at them over your shoulder, and face them
    const dx = npc.pos.x - this.me.pos.x, dz = npc.pos.z - this.me.pos.z;
    this.ctrl.camYaw = Math.atan2(-dx, -dz) + 0.35;
    this.me.yaw = Math.atan2(dx, dz);
    this.audio.play('babble', { pitch: NPC_PITCH[id], len: 30 });
  }

  ringBell() {
    this.net.send({ t: 'bell' });
    this.acts.ringBell();
    this.audio.play('bell');
  }

  lightCandle(i) {
    const run = this.acts.candleRun;
    if (!run) {
      this.acts.candleRun = { start: performance.now() };
      this.ui.toast(`🕯️ Candle Vigil! Light all ${CANDLES.length} candles in ${CANDLE_TIME} seconds!`, 'announce');
    }
    if (this.acts.lightCandle(i)) this.audio.play('pickup');
    const lit = this.acts.candleLit.filter(Boolean).length;
    if (lit === CANDLES.length) {
      const secs = (performance.now() - this.acts.candleRun.start) / 1000;
      this.net.send({ t: 'quest', id: 'candles', secs, lit });
      this.ui.toast(`All candles lit in ${secs.toFixed(1)} s! The ghosts sigh happily.`, 'good');
      this.fx.sparkle(new THREE.Vector3(ZONES.graveyard.x, 1.5, ZONES.graveyard.z), '#ffcf5a', 40, 3);
      this.acts.candleRun = null;
      setTimeout(() => this.acts.resetCandles(), 6000);
    }
  }

  // Where each quest happens, for the compass.
  questTarget(id) {
    // computed ones only when asked for (the clue quest looks up other quests' places)
    if (id === 'rescue') return this.downedFriend() || CAULDRON;
    if (id === 'clues') return this.nextClueTarget();
    const n = (k) => NPCS[k];
    return {
      hello: n('mayor'), harvest: ZONES.patch, wisps: ZONES.woods, potion: CAULDRON, candles: ZONES.graveyard, carve: CARVE_TABLE,
      riddle: n('wisp'), deal: n('count'), ritual: ZONES.circle, dance: DANCE_FLOOR, boss: BOSS_BELL, photo: PHOTO_BOOTH,
      finale: ZONES.plaza,
    }[id];
  }

  downedFriend() {
    let best = null, bd = Infinity;
    for (const o of this.others.values()) {
      if (!o.down || !this.me) continue;
      const d = o.pos.distanceTo(this.me.pos);
      if (d < bd) (bd = d), (best = { x: o.pos.x, z: o.pos.z });
    }
    return best;
  }

  // The prophecy quest points at the next quest that still hides a clue.
  nextClueTarget() {
    const have = new Set(this.state?.clues || []);
    const c = CLUES.find((x) => !have.has(x.id) && !this.state?.quests[x.quest]?.done);
    return c && c.quest !== 'clues' ? this.questTarget(c.quest) : null;
  }

  track(id) {
    this.tracked = id || '';
    localStorage.setItem('hh-track', this.tracked);
    if (this.state) this.ui.renderQuests(this.state, this.tracked);
  }

  // The quest the compass and mini-map point at: a live boss fight, else the tracked quest, else the first open one.
  trackedQuest() {
    if (!this.state) return null;
    if (['intro', 'fight', 'stunned'].includes(this.finaleState.state)) return QUESTS.find((x) => x.id === 'finale');
    if (this.boss.active() || this.bossState.state === 'intro') return QUESTS.find((x) => x.id === 'boss');
    const open = (q) => q && !this.state.quests[q.id]?.done && this.questTarget(q.id);
    const t = QUESTS.find((x) => x.id === this.tracked);
    return open(t) ? t : QUESTS.find(open) || null;
  }

  trackTarget() {
    const q = this.trackedQuest();
    const tgt = q && this.questTarget(q.id);
    return tgt ? { x: tgt.x, z: tgt.z, icon: QUEST_ICON[q.id], title: q.title, id: q.id } : null;
  }

  updateCompass() {
    if (!this.state || !this.me) return;
    const q = this.trackedQuest();
    const tgt = q && this.questTarget(q.id);
    if (!tgt) return this.ui.setCompass(null);
    const dx = tgt.x - this.me.pos.x, dz = tgt.z - this.me.pos.z;
    const dist = Math.round(Math.hypot(dx, dz));
    if (dist < 6) return this.ui.setCompass(null);
    // screen angle: 0 = straight ahead (up), positive = clockwise
    const camYaw = this.ctrl.camYaw;
    const world = Math.atan2(dx, dz);
    const ahead = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
    let a = -(world - ahead);
    a = Math.atan2(Math.sin(a), Math.cos(a));
    this.ui.setCompass({ title: q.title, dist, angle: a - Math.PI / 2 });
  }

  questsModal() {
    if (!this.state) return;
    this.ui.modal(`<h2>📜 Halloween Checklist</h2><div id="quest-panel-modal">${this.ui.questHtml()}</div>`);
  }

  sendMove(force = false) {
    if (!this.net || !this.me) return;
    const now = performance.now();
    if (!force && now - this.lastMove < 100) return;
    const p = this.me.pos;
    const a = this.ctrl.animState();
    const e = this.me.anim.emote || '';
    const key = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)},${this.me.yaw.toFixed(2)},${a},${e}`;
    if (!force && key === this.lastSent && now - this.lastMove < 1000) return;
    this.lastSent = key;
    this.lastMove = now;
    this.net.send({ t: 'move', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +this.me.yaw.toFixed(2), a, e });
  }

  // ---------------------------------------------------------------- loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = (now - this.t0) / 1000;
    const sNow = this.net?.serverTime() ?? t;
    this.input.update();

    if (this.me) {
      this.ctrl.speedBoost = this.downUntil ? 0 : (this.modUntil?.slow || 0) > now ? 0.4 : 1;
      if (this.downUntil) this.ui.setDown(true, (this.downUntil - now) / 1000);
      this.ctrl.update(dt);
      this.me.update(dt, t, this.camera);
      this.sendMove();
      // auto-pickup candy
      for (const [id, e] of this.acts.candies) {
        if (Math.hypot(e.item.x - this.me.pos.x, e.item.z - this.me.pos.z) < 1.4 * this.me.scaleNow && !e.asked) {
          e.asked = true;
          this.net.send({ t: 'pick', kind: 'candy', id });
          setTimeout(() => (e.asked = false), 1500);
        }
      }
      this.minimap.update(now);
      const near = this.nearest();
      this.ui.setPrompt(near, touch);
      if (now - (this.compassAt || 0) > 150) {
        this.compassAt = now;
        this.updateCompass();
      }
      // candle timer
      if (this.acts.candleRun) {
        const left = CANDLE_TIME - (now - this.acts.candleRun.start) / 1000;
        this.ui.activity(`🕯️ ${this.acts.candleLit.filter(Boolean).length}/${CANDLES.length} candles · ${Math.ceil(left)} s`);
        if (left <= 0) {
          this.acts.candleRun = null;
          this.acts.resetCandles();
          this.ui.toast('💨 A spooky wind blew out the candles! Try again.', 'boss');
          this.ui.activity('');
        }
      } else this.ui.activity('');
      // boss
      const inArena = Math.hypot(this.me.pos.x - ZONES.arena.x, this.me.pos.z - ZONES.arena.z) < ZONES.arena.r + 8;
      const inPlaza = Math.hypot(this.me.pos.x, this.me.pos.z) < ZONES.plaza.r + 8;
      const spider = this.spiders.nearest(this.me.pos, 8);
      this.ui.setAttack(!this.downUntil && ((this.boss.active() && inArena) || (this.finale.active() && inPlaza) || !!spider));
      this.audio.boss = (this.boss.active() && inArena) || (this.finale.active() && inPlaza);
      const players = [this.me, ...this.others.values()].filter((c) => !c.down);
      const fighter = this.downUntil ? null : this.me;
      const hitKing = this.boss.update(t, dt, sNow, inArena ? fighter : null, players);
      const hitMayor = this.finale.update(t, dt, sNow, inPlaza ? fighter : null, players);
      if (hitKing || hitMayor) {
        this.me.dizzy(2.4);
        this.audio.play('dizzy');
        this.net.send({ t: 'hurt', src: 'boss' });
        if (!this.dizzyTipped) {
          this.dizzyTipped = true;
          this.ui.toast('💫 Bonk! Jump over shockwaves and step out of the red circles! Too many hits and you turn into a pumpkin.', 'boss');
        }
        this.sendMove(true);
      }
      this.spiders.update(t, dt);
    } else {
      // attract mode behind the login card
      const a = t * 0.06;
      this.camera.position.set(Math.sin(a) * 32, 13, Math.cos(a) * 32);
      this.camera.lookAt(0, 2, 0);
      this.boss.update(t, dt, sNow, null, []);
      this.finale.update(t, dt, sNow, null, []);
      this.spiders.update(t, dt);
    }

    const renderT = sNow - 0.15;
    for (const [, o] of this.others) {
      o.interpolate(renderT);
      o.update(dt, t, this.camera);
    }
    this.updateNpcs(dt, t, now);
    this.acts.update(t, dt, sNow, this.me?.pos);
    const partying = now < this.partyUntil ? 1 : 0;
    this.audio.party = !!partying && this.me && Math.hypot(this.me.pos.x - DANCE_FLOOR.x, this.me.pos.z - DANCE_FLOOR.z) < 25;
    this.world.update(t, dt, this.camera, partying);
    if (this.spirit) this.updateSpirit(dt);
    this.fx.update(dt);
    this.stage.render();
    this.stage.adapt(dt);
  }

  updateNpcs(dt, t, now) {
    for (const [id, n] of this.npcs) {
      // turn toward whoever is talking to them, otherwise back home
      let want = n.homeYaw;
      if (n.talkTarget) want = Math.atan2(n.talkTarget.pos.x - n.pos.x, n.talkTarget.pos.z - n.pos.z);
      else if (this.me && n.pos.distanceTo(this.me.pos) < 5) want = Math.atan2(this.me.pos.x - n.pos.x, this.me.pos.z - n.pos.z);
      n.yaw = want;
      n.anim.faceOverride = n.talking && now < n.talking ? (Math.floor(now / 140) % 2 ? 'happy' : 'neutral') : '';
      if (id === 'dj' && !n.anim.emote) n.emote('dance');
      if (now > n.idleAt && !n.talkTarget) {
        n.idleAt = now + 18000 + Math.random() * 25000;
        if (this.me && n.pos.distanceTo(this.me.pos) < 30) {
          const lines = IDLE_LINES[id];
          n.say(lines[Math.floor(Math.random() * lines.length)], 4);
          if (Math.random() < 0.4 && id !== 'dj') n.emote(['wave', 'laugh', 'clap'][Math.floor(Math.random() * 3)]);
        }
      }
      if (n.talkTarget && this.ui.dialogNpc !== id) n.talkTarget = null;
      n.update(dt, t, this.camera);
    }
    // leaving the conversation range closes the dialog
    if (this.ui.dialogNpc && this.me) {
      const n = this.npcs.get(this.ui.dialogNpc);
      if (n && n.pos.distanceTo(this.me.pos) > 9) this.ui.closeDialog();
    }
  }

  updateSpirit(dt) {
    const s = this.spirit;
    s.t += dt;
    if (!s.sprite) {
      s.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture('🎃', 256), transparent: true, depthWrite: false }));
      s.sprite.position.set(ZONES.circle.x, 2, ZONES.circle.z);
      this.scene.add(s.sprite);
    }
    const k = Math.min(1, s.t / 2);
    s.sprite.scale.setScalar(2 + k * 7);
    s.sprite.position.y = 2 + k * 9 + Math.sin(s.t * 2) * 0.4;
    s.sprite.material.opacity = s.t < 6 ? Math.min(0.85, s.t) : Math.max(0, 0.85 - (s.t - 6));
    if (s.t > 7.5) {
      this.scene.remove(s.sprite);
      this.spirit = null;
    }
  }
}

new Game().boot().catch((e) => {
  console.error(e);
  document.getElementById('loading').innerHTML = `<p>Something went wrong 😿<br><small>${e.message}</small></p>`;
});

export { randomAvatar, NPC_ICON };
