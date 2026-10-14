// Co-op bosses. The server runs health and the attack timeline and broadcasts each attack with a start time;
// clients draw the warnings and decide locally whether they dodged. Health scales with the number of fighters.
//   king:  the Gourd King in the Moonlit Courtyard (players ring the bell; shield phase with braziers)
//   mayor: the finale. Mayor Gourdon betrays the town and rises from the plaza fountain as a giant pumpkin.
//          Only officers (or the schedule) start it; no shield, but he calls spiders and gets angrier.
import { BOSSES, BRAZIERS } from '../shared/world.js';
const HIT_GAP = 330; // ms between counted hits per player
const DAMAGE = 10;

export class Boss {
  constructor(game, id = 'king') {
    this.game = game;
    this.id = id;
    this.def = BOSSES[id];
    this.A = this.def.center;
    this.state = 'idle'; // idle | intro | fight | shield | stunned | defeated
    this.hp = 0;
    this.maxHp = 0;
    this.fighters = new Map(); // sid -> {pid, hits}
    this.minions = new Map();
    this.braziers = BRAZIERS.map(() => 0); // lit-until time per brazier
    this.nextAttack = 0;
    this.stateUntil = 0;
    this.minionId = 1;
    this.lastHit = new Map();
    this.shieldDone = false;
  }

  inArena(p) {
    const A = this.A;
    return (p.x - A.x) ** 2 + (p.z - A.z) ** 2 < (A.r + 8) ** 2;
  }

  public() {
    return { b: this.id, state: this.state, hp: Math.round(this.hp), maxHp: Math.round(this.maxHp), fighters: this.fighters.size, braziers: this.braziers.map((t) => t > Date.now()), need: this.brazierNeed(), until: this.stateUntil };
  }

  send() {
    this.game.broadcast({ t: 'boss', ...this.public() });
  }

  ring(session) {
    if (this.state !== 'idle' || !this.def.bell) return false;
    const now = Date.now();
    this.state = 'intro';
    this.stateUntil = now + 4500;
    this.fighters.clear();
    this.minions.clear();
    this.shieldDone = false;
    this.braziers = BRAZIERS.map(() => 0);
    this.addFighter(session);
    for (const s of this.game.online()) if (this.inArena(s)) this.addFighter(s);
    this.maxHp = this.hp = this.hpFor(this.fighters.size);
    this.game.broadcast({ t: 'toast', text: `🔔 ${session.player.name} rang the bell! ${this.def.name} awakens in the ${this.def.place}!`, kind: 'boss' });
    this.send();
    return true;
  }

  // Officer-started fight: no bell ringer, and players get a minute to run to the courtyard.
  forceStart() {
    if (!['idle', 'defeated'].includes(this.state)) return false;
    const now = Date.now();
    this.state = 'intro';
    this.stateUntil = now + 8000;
    this.graceUntil = now + 75000;
    this.fighters.clear();
    this.minions.clear();
    this.shieldDone = false;
    this.swarmed = false;
    this.braziers = BRAZIERS.map(() => 0);
    for (const s of this.game.online()) if (this.inArena(s)) this.addFighter(s);
    // the finale is for the whole server, so it is as tough as everyone online together
    const crowd = this.id === 'mayor' ? this.game.online().length : Math.ceil(this.game.online().length / 2);
    this.maxHp = this.hp = this.hpFor(Math.max(this.fighters.size, crowd)) * (this.def.hpScale || 1);
    this.send();
    return true;
  }

  hpFor(n) {
    return 260 + 220 * Math.max(1, n);
  }

  addFighter(s) {
    if (this.fighters.has(s.sid)) return;
    this.fighters.set(s.sid, { pid: s.pid, hits: 0 });
    if (this.maxHp) {
      // keep the same fraction of health when more fighters arrive
      const frac = this.hp / this.maxHp;
      this.maxHp = this.hpFor(this.fighters.size);
      this.hp = this.maxHp * frac;
    }
  }

  brazierNeed() {
    return Math.min(4, Math.max(1, this.fighters.size));
  }

  hit(s, kind, id) {
    if (!['fight', 'shield', 'stunned'].includes(this.state) || !this.inArena(s)) return;
    const now = Date.now();
    if (now - (this.lastHit.get(s.sid) || 0) < HIT_GAP) return;
    this.lastHit.set(s.sid, now);
    this.addFighter(s);
    if (kind === 'minion') {
      const m = this.minions.get(id);
      if (!m) return;
      if (--m.hp <= 0) {
        this.minions.delete(id);
        this.game.broadcast({ t: 'bossAtk', b: this.id, kind: 'minionDie', id, by: s.sid });
        this.game.addCandy(s, 2, 'minion');
      }
      return;
    }
    if (this.state === 'shield') return this.game.toast(s, 'The Gourd King is shielded! Light the braziers together!');
    // the Fire Charm (from the Summoning) turns thrown candy into fireballs
    const dmg = (this.state === 'stunned' ? DAMAGE * 2 : DAMAGE) * (s.player.items?.fire ? 1.5 : 1);
    this.hp = Math.max(0, this.hp - dmg);
    this.fighters.get(s.sid).hits++;
    this.game.broadcast({ t: 'bossHit', b: this.id, by: s.sid, hp: Math.round(this.hp), dmg });
    if (this.hp <= 0) this.win();
    else if (this.id === 'mayor' && !this.swarmed && this.hp < this.maxHp * 0.55) {
      this.swarmed = true;
      this.game.spiderSwarm?.(this.A, 8);
      this.game.broadcast({ t: 'toast', text: '🕷️ "My little spiders! GET THEM!" Spiders pour out of the fountain!', kind: 'boss' });
    } else if (this.def.shield && !this.shieldDone && this.hp < this.maxHp * 0.5 && this.state === 'fight') {
      this.state = 'shield';
      this.shieldDone = true;
      this.game.broadcast({ t: 'toast', text: `🛡️ The Gourd King raised a shield! Light ${this.brazierNeed()} of the 4 braziers at the same time to break it!`, kind: 'boss' });
      this.send();
    }
  }

  lightBrazier(s, i) {
    if (!this.def.shield || !BRAZIERS[i] || !['fight', 'shield', 'stunned'].includes(this.state)) return;
    const b = BRAZIERS[i];
    if ((s.x - b.x) ** 2 + (s.z - b.z) ** 2 > 16) return;
    this.addFighter(s);
    this.braziers[i] = Date.now() + 12000;
    const lit = this.braziers.filter((t) => t > Date.now()).length;
    if (this.state === 'shield' && lit >= this.brazierNeed()) {
      this.state = 'stunned';
      this.stateUntil = Date.now() + 9000;
      this.braziers = BRAZIERS.map(() => 0);
      this.game.broadcast({ t: 'toast', text: '💥 Shield broken! The Gourd King is dizzy: double damage!', kind: 'boss' });
    }
    this.send();
  }

  win() {
    this.state = 'defeated';
    this.stateUntil = Date.now() + 45000;
    this.minions.clear();
    const names = [];
    for (const [sid, f] of this.fighters) {
      const s = this.game.sessions.get(sid);
      if (!s || f.hits < 1) continue;
      names.push(s.player.name);
      this.game.completeQuest(s, this.def.quest);
      this.game.bossTicket(s, this.id);
    }
    this.game.broadcast({ t: 'event', kind: 'bossWin', b: this.id, names });
    this.game.broadcast({ t: 'toast', text: `🎉 ${this.def.winText} Heroes: ${names.join(', ') || 'nobody?'}`, kind: 'win' });
    if (this.def.winSay) this.game.sayAloud(this.def.winSay);
    this.send();
  }

  tick(now) {
    // forget fighters who left
    for (const sid of this.fighters.keys()) if (!this.game.sessions.has(sid)) this.fighters.delete(sid);
    if (this.state === 'idle') return;
    if (this.state === 'defeated') {
      if (now > this.stateUntil) (this.state = 'idle'), this.minions.clear(), this.send(), this.game.bossIdle?.(this.id);
      return;
    }
    if (this.state === 'intro') {
      if (now > this.stateUntil) {
        this.state = 'fight';
        this.nextAttack = now + 2500;
        this.send();
      }
      return;
    }
    // everyone left the courtyard: the king goes back to sleep
    const present = this.game.online().filter((s) => this.inArena(s));
    for (const s of present) this.addFighter(s);
    if (!present.length && now > (this.graceUntil || 0)) {
      this.state = 'idle';
      this.minions.clear();
      this.game.broadcast({ t: 'toast', text: 'The Gourd King got bored and went back to sleep...', kind: 'boss' });
      this.send();
      return;
    }
    if (this.state === 'stunned' && now > this.stateUntil) {
      this.state = 'fight';
      this.nextAttack = now + 1500;
      this.send();
    }
    // minions walk to their nearest target; the clients animate them from the same data
    for (const [id, m] of this.minions) if (now > m.dies) this.minions.delete(id), this.game.broadcast({ t: 'bossAtk', b: this.id, kind: 'minionDie', id });
    if (this.state === 'stunned' || now < this.nextAttack || !present.length) return;
    const enraged = this.hp < this.maxHp * 0.35;
    const roll = Math.random();
    // attack times are in server-clock seconds, the clock clients sync to
    const st = this.game.serverTime();
    const A = this.A;
    if (roll < 0.38) {
      this.game.broadcast({ t: 'bossAtk', b: this.id, kind: 'slam', at: +(st + 1.2).toFixed(3), speed: enraged ? 12 : 9, rings: enraged ? 2 : 1 });
      this.nextAttack = now + (enraged ? 3300 : 4300);
    } else if (roll < 0.78 || this.minions.size >= 6) {
      const spots = [];
      for (const s of present) {
        const count = enraged ? 3 : 2;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2, r = i === 0 ? 0.5 : 2 + Math.random() * 4;
          spots.push({ x: +(s.x + Math.cos(a) * r).toFixed(2), z: +(s.z + Math.sin(a) * r).toFixed(2) });
        }
      }
      this.game.broadcast({ t: 'bossAtk', b: this.id, kind: 'seeds', at: +(st + 1.5).toFixed(3), spots: spots.slice(0, 24), r: 2.2 });
      this.nextAttack = now + (enraged ? 3000 : 4000);
    } else {
      const list = [];
      const n = Math.min(2 + present.length, 5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random();
        const m = { id: this.minionId++, x: +(A.x + Math.cos(a) * (this.def.minionR || 3)).toFixed(2), z: +(A.z + (this.def.minionDz ?? -4) + Math.sin(a) * 2).toFixed(2), hp: 2, born: now, dies: now + 16000, seed: Math.random() };
        this.minions.set(m.id, m);
        list.push(m);
      }
      this.game.broadcast({ t: 'bossAtk', b: this.id, kind: 'minions', list });
      this.nextAttack = now + 4500;
    }
  }
}
