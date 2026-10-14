// Procedural animation for chibi avatars: locomotion, jumps, dizzy spells and 12 emotes. Each frame builds a
// target pose and eases the rig toward it, so transitions blend without keyframes.
import { damp } from '../engine/toon.js';

export const EMOTE_TIME = { wave: 2.2, heart: 2.4, laugh: 2.2, boo: 1.5, clap: 2.2, flip: 1.05, spin: 1.3, cheer: 2.0, dance: Infinity, zombie: Infinity, sit: Infinity, sleep: Infinity };
const FACE_FOR = { wave: 'happy', heart: 'love', laugh: 'laugh', boo: 'surprised', clap: 'happy', flip: 'happy', spin: 'happy', cheer: 'laugh', dance: 'happy', zombie: 'sleepy', sit: 'neutral', sleep: 'sleepy' };

const KEYS = ['bodyY', 'bodyRx', 'bodyRy', 'bodyRz', 'torsoRx', 'torsoRy', 'torsoRz', 'headRx', 'headRy', 'headRz', 'armLx', 'armLy', 'armLz', 'armRx', 'armRy', 'armRz', 'legLx', 'legRx', 'legLz', 'legRz', 'squash'];

export class Animator {
  constructor(avatar) {
    this.a = avatar;
    this.t = Math.random() * 10;
    this.phase = 0;
    this.pose = Object.fromEntries(KEYS.map((k) => [k, 0]));
    this.pose.squash = 1;
    this.emote = '';
    this.emoteT = 0;
    this.blinkAt = 2 + Math.random() * 3;
    this.blinkUntil = 0;
    this.faceOverride = '';
    this.onFx = null; // (kind, avatar) particle hooks
    this.lastFxBeat = -1;
  }

  play(e) {
    this.emote = e;
    this.emoteT = 0;
    this.lastFxBeat = -1;
    if (this.onFx) this.onFx(e, 'start');
  }

  stop() {
    this.emote = '';
  }

  // s: { speed 0..1.6, air: bool, vy, dizzy: bool }
  update(dt, s) {
    this.t += dt;
    const t = this.t;
    const a = this.a;
    const P = Object.fromEntries(KEYS.map((k) => [k, 0]));
    P.squash = 1;
    P.armLz = -0.12;
    P.armRz = 0.12;
    let lambda = 14;
    let face = 'neutral';

    if (this.emote) {
      this.emoteT += dt;
      if (this.emoteT > (EMOTE_TIME[this.emote] ?? 2)) this.emote = '';
    }
    const moving = s.speed > 0.05;
    if (moving && this.emote && EMOTE_TIME[this.emote] === Infinity && this.emote !== 'zombie' && this.emote !== 'dance') this.emote = '';

    // ---- locomotion
    if (s.air) {
      const up = s.vy > 0;
      P.legLx = up ? -0.7 : 0.3;
      P.legRx = up ? 0.4 : -0.5;
      P.armLz = -1.9;
      P.armRz = 1.9;
      P.armLx = -0.3;
      P.armRx = -0.3;
      P.squash = up ? 1.08 : 0.97;
      P.headRx = up ? -0.15 : 0.1;
      face = 'happy';
    } else if (moving) {
      const sp = Math.min(1.6, s.speed);
      this.phase += dt * (7 + sp * 5);
      const ph = this.phase;
      const amp = 0.45 + sp * 0.35;
      P.legLx = Math.sin(ph) * amp;
      P.legRx = -Math.sin(ph) * amp;
      P.armLx = -Math.sin(ph) * amp * 0.9;
      P.armRx = Math.sin(ph) * amp * 0.9;
      P.bodyY = Math.abs(Math.cos(ph)) * 0.06 * (0.6 + sp * 0.5);
      P.torsoRx = 0.08 + sp * 0.1;
      P.torsoRy = Math.sin(ph) * 0.12;
      P.headRx = -0.05;
      P.headRy = -Math.sin(ph) * 0.08;
      P.squash = 1 - Math.abs(Math.sin(ph)) * 0.03;
    } else {
      // idle breathing and little looks around
      P.squash = 1 + Math.sin(t * 2.2) * 0.012;
      P.headRz = Math.sin(t * 0.7) * 0.05;
      P.headRy = Math.sin(t * 0.37) * 0.18;
      P.armLz = -0.14 - Math.sin(t * 2.2) * 0.03;
      P.armRz = 0.14 + Math.sin(t * 2.2) * 0.03;
    }

    if (a.armPose === 'scarecrow' && !this.emote && !moving) {
      P.armLz = -1.35 + Math.sin(t * 1.5) * 0.05;
      P.armRz = 1.35 - Math.sin(t * 1.5) * 0.05;
    }
    if (a.ghost) {
      P.bodyY = 0.35 + Math.sin(t * 1.8) * 0.12;
      P.legLx = P.legRx = 0;
    }

    // ---- emotes
    const e = this.emote, et = this.emoteT;
    if (e && !s.air) {
      face = FACE_FOR[e] || face;
      switch (e) {
        case 'wave':
          P.armRz = 2.6 + Math.sin(et * 12) * 0.35;
          P.armRx = -0.2;
          P.headRz = -0.12;
          P.torsoRz = -0.06;
          break;
        case 'heart':
          P.armLz = -2.5;
          P.armRz = 2.5;
          P.armLx = -0.5;
          P.armRx = -0.5;
          P.armLy = 0.6;
          P.armRy = -0.6;
          P.headRz = Math.sin(et * 4) * 0.12;
          P.bodyY = Math.abs(Math.sin(et * 4)) * 0.04;
          this.beat(et, 0.45, 'heart');
          break;
        case 'laugh':
          P.headRx = -0.35 + Math.sin(et * 22) * 0.05;
          P.torsoRx = -0.15;
          P.bodyY = Math.abs(Math.sin(et * 11)) * 0.035;
          P.armLz = -0.6;
          P.armRz = 0.6;
          P.armLx = -0.6;
          P.armRx = -0.6;
          this.beat(et, 0.5, 'laugh');
          break;
        case 'boo': {
          const k = Math.min(1, et * 5);
          P.armLz = -2.3 * k;
          P.armRz = 2.3 * k;
          P.armLx = -1.2 * k;
          P.armRx = -1.2 * k;
          P.torsoRx = 0.35 * k;
          P.bodyY = Math.sin(Math.min(1, et * 3) * Math.PI) * 0.25;
          P.squash = 1 + 0.08 * k;
          break;
        }
        case 'clap': {
          const c = Math.sin(et * 16);
          P.armLx = -1.3;
          P.armRx = -1.3;
          P.armLy = 0.2 + c * 0.35;
          P.armRy = -0.2 - c * 0.35;
          P.armLz = -0.25;
          P.armRz = 0.25;
          P.bodyY = Math.abs(Math.sin(et * 8)) * 0.03;
          this.beat(et, 0.125, 'clap');
          break;
        }
        case 'flip': {
          const k = Math.min(1, et / 1.0);
          P.bodyY = Math.sin(k * Math.PI) * 1.1;
          P.bodyRx = -k * Math.PI * 2;
          P.legLx = -1.2 * Math.sin(k * Math.PI);
          P.legRx = -1.2 * Math.sin(k * Math.PI);
          P.armLz = -2.6;
          P.armRz = 2.6;
          lambda = 60;
          break;
        }
        case 'spin': {
          const k = Math.min(1, et / 1.3);
          P.bodyRy = (1 - Math.cos(k * Math.PI)) * Math.PI * 2;
          P.armLz = -1.5;
          P.armRz = 1.5;
          P.bodyY = Math.sin(k * Math.PI) * 0.12;
          lambda = 60;
          break;
        }
        case 'cheer':
          P.bodyY = Math.abs(Math.sin(et * 6)) * 0.35;
          P.armLz = -2.7 + Math.sin(et * 12) * 0.2;
          P.armRz = 2.7 - Math.sin(et * 12) * 0.2;
          P.legLx = -0.3 * Math.abs(Math.sin(et * 6));
          P.legRx = -0.3 * Math.abs(Math.sin(et * 6));
          this.beat(et, 0.5, 'cheer');
          break;
        case 'dance': {
          const b = et * 2 * Math.PI * 2; // two beats per second
          const move = Math.floor(et / 4) % 3;
          P.bodyY = Math.abs(Math.sin(b / 2)) * 0.1;
          if (move === 0) {
            P.armLz = -1.4 - Math.sin(b) * 0.9;
            P.armRz = 1.4 - Math.sin(b) * 0.9;
            P.torsoRz = Math.sin(b / 2) * 0.18;
            P.headRz = -Math.sin(b / 2) * 0.15;
            P.legLx = Math.max(0, Math.sin(b / 2)) * -0.5;
            P.legRx = Math.max(0, -Math.sin(b / 2)) * -0.5;
          } else if (move === 1) {
            P.armLx = -1.5;
            P.armRx = -1.5;
            P.armLy = Math.sin(b) * 0.7;
            P.armRy = Math.sin(b) * 0.7;
            P.torsoRy = Math.sin(b / 2) * 0.4;
            P.legLz = -0.15;
            P.legRz = 0.15;
          } else {
            P.armRz = 2.8;
            P.armLz = -0.3 - Math.max(0, Math.sin(b)) * 0.8;
            P.bodyRy = Math.sin(b / 4) * 0.8;
            P.headRx = Math.sin(b) * 0.15;
            P.legLx = Math.sin(b / 2) * 0.4;
            P.legRx = -Math.sin(b / 2) * 0.4;
          }
          this.beat(et, 1, 'note');
          break;
        }
        case 'zombie':
          P.armLx = -1.5 + Math.sin(t * 3) * 0.08;
          P.armRx = -1.5 - Math.sin(t * 3) * 0.08;
          P.armLz = -0.05;
          P.armRz = 0.05;
          P.headRz = 0.35 + Math.sin(t * 1.3) * 0.08;
          P.headRx = 0.15;
          P.torsoRz = -0.06;
          if (moving) {
            P.legLx *= 0.5;
            P.legRx *= 0.5;
            P.bodyY *= 0.4;
          }
          break;
        case 'sit':
          P.bodyY = -0.27;
          P.legLx = -1.45;
          P.legRx = -1.35;
          P.legLz = -0.12;
          P.legRz = 0.12;
          P.armLz = -0.45;
          P.armRz = 0.45;
          P.armLx = -0.5;
          P.armRx = -0.5;
          P.headRy = Math.sin(t * 0.5) * 0.3;
          break;
        case 'sleep':
          P.bodyY = -0.27;
          P.legLx = -1.45;
          P.legRx = -1.4;
          P.torsoRx = 0.25;
          P.headRx = 0.45;
          P.headRz = 0.25;
          P.armLz = -0.3;
          P.armRz = 0.3;
          P.squash = 1 + Math.sin(t * 1.4) * 0.025;
          this.beat(et, 1.2, 'zzz');
          break;
      }
    }

    if (s.dizzy) {
      face = 'dizzy';
      P.headRz = Math.sin(t * 6) * 0.25;
      P.bodyRz = Math.sin(t * 6) * 0.1;
      P.armLz = -0.7;
      P.armRz = 0.7;
    }

    // ---- blink
    if (t > this.blinkAt) {
      this.blinkUntil = t + 0.13;
      this.blinkAt = t + 2.5 + Math.random() * 3.5;
    }
    if (face === 'neutral' && t < this.blinkUntil) face = 'blink';
    if (this.faceOverride) face = this.faceOverride;
    a.face.set(face);

    // ---- apply with easing
    const p = this.pose;
    for (const k of KEYS) p[k] = damp(p[k], P[k], lambda, dt);
    if (!this.emote || (this.emote !== 'flip' && this.emote !== 'spin')) {
      // unwind full turns left over from flips and spins
      p.bodyRx = damp(p.bodyRx % (Math.PI * 2), P.bodyRx, lambda, dt);
      p.bodyRy = damp(p.bodyRy % (Math.PI * 2), P.bodyRy, lambda, dt);
    }
    a.body.position.y = p.bodyY;
    a.body.rotation.set(p.bodyRx, p.bodyRy, p.bodyRz);
    if (Math.abs(p.bodyRx) > 0.01) {
      // flip around the body centre, not the feet
      a.body.position.y += 0.7 * (1 - Math.cos(p.bodyRx));
      a.body.position.z = -Math.sin(p.bodyRx) * 0.7;
    } else a.body.position.z = 0;
    a.body.scale.set(1 / Math.sqrt(p.squash), p.squash, 1 / Math.sqrt(p.squash));
    a.torso.rotation.set(p.torsoRx, p.torsoRy, p.torsoRz);
    a.head.rotation.set(p.headRx, p.headRy, p.headRz);
    a.armL.rotation.set(p.armLx, p.armLy, p.armLz);
    a.armR.rotation.set(p.armRx, p.armRy, p.armRz);
    a.legL.rotation.set(p.legLx, 0, p.legLz);
    a.legR.rotation.set(p.legRx, 0, p.legRz);
    if (a.shadow) {
      const h = Math.max(0, p.bodyY);
      a.shadow.scale.setScalar(1 / (1 + h * 0.8));
    }

    // ---- secondary motion
    const parts = a.parts;
    const sway = Math.sin(t * 2.5) * 0.08 + (moving ? 0.25 + s.speed * 0.15 : 0);
    if (parts.ponytail) parts.ponytail.rotation.x = 0.35 + sway + p.bodyY * 1.5 + Math.sin(this.phase) * (moving ? 0.12 : 0);
    if (parts.cape) parts.cape.rotation.x = -(moving ? 0.25 + s.speed * 0.25 : 0.02) - Math.sin(t * 3) * 0.04 - (s.air ? 0.4 : 0);
    if (parts.veil) parts.veil.rotation.x = -(moving ? 0.25 : 0.05) - Math.sin(t * 2) * 0.05;
    if (parts.wingL) {
      const f = s.air ? Math.sin(t * 22) * 0.6 : Math.sin(t * 3) * 0.12;
      parts.wingL.rotation.y = 0.5 + f;
      parts.wingR.rotation.y = -0.5 - f;
    }
    if (parts.tail) parts.tail.rotation.y = Math.sin(t * 3) * 0.4;
    for (const k of ['antL', 'antR']) if (parts[k]) parts[k].rotation.z = Math.sin(t * 4 + (k === 'antL' ? 0 : 1.5)) * 0.18;
    if (parts.halo) {
      parts.halo.position.y += (Math.sin(t * 2) * 0.03 - (parts.halo.userData.bob || 0));
      parts.halo.userData.bob = Math.sin(t * 2) * 0.03;
      parts.halo.rotation.y = t;
    }
  }

  beat(et, every, kind) {
    const n = Math.floor(et / every);
    if (n !== this.lastFxBeat) {
      this.lastFxBeat = n;
      if (this.onFx) this.onFx(kind, 'beat');
    }
  }
}
