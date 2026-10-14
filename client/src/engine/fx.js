// Pooled sprite particles: emoji bursts (hearts, notes, zzz), confetti, sparkles, candy pops and floating text.
import { THREE, glowTexture } from './toon.js';
import { EMOJI_ICON, iconImage, leadIcon, stripEmoji } from '../icons.js';

const texCache = new Map();
export function emojiTexture(ch, size = 96) {
  const key = ch + size;
  if (!texCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    // the game's own icon when one exists (icons.js); emoji only as a fallback
    const img = EMOJI_ICON[ch] && iconImage(EMOJI_ICON[ch]);
    if (img && img.complete && img.naturalWidth) {
      x.drawImage(img, size * 0.06, size * 0.06, size * 0.88, size * 0.88);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      texCache.set(key, t);
      return t;
    }
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `${size * 0.78}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    x.fillText(ch, size / 2, size / 2 + size * 0.05);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return texCache.get(key);
}

export function textTexture(text, { color = '#fff', stroke = '#2a1440', font = '700 44px Fredoka, sans-serif', pad = 14 } = {}) {
  // emoji in floating text ("+5 🍬") become the game's icon after the words
  const lead = leadIcon(text);
  const img = lead && iconImage(lead);
  const words = lead ? stripEmoji(text) : text;
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  x.font = font;
  const tw = Math.ceil(x.measureText(words).width), iw = img ? 52 : 0;
  const w = tw + iw + pad * 2;
  c.width = w;
  c.height = 64;
  x.font = font;
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  x.lineWidth = 9;
  x.strokeStyle = stroke;
  x.strokeText(words, pad, 34);
  x.fillStyle = color;
  x.fillText(words, pad, 34);
  if (img && img.complete) x.drawImage(img, pad + tw + 4, 8, 48, 48);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData = { aspect: w / 64 };
  return t;
}

const CONFETTI = ['#ff7a1a', '#7b4dff', '#2ec4b6', '#ffd23f', '#ff4f8b', '#8ac926'];

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.live = [];
    this.pool = [];
  }

  sprite() {
    let s = this.pool.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      s.renderOrder = 5;
    }
    this.scene.add(s);
    return s;
  }

  spawn({ map, color = '#ffffff', pos, vel = [0, 1, 0], life = 1.2, size = 0.5, grow = 0, gravity = 0, additive = false, spin = 0, aspect = 1, fadeIn = 0.08 }) {
    const s = this.sprite();
    s.material.map = map;
    s.material.color.set(color);
    s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    s.material.rotation = 0;
    s.material.opacity = 0;
    s.material.needsUpdate = true;
    s.position.set(pos.x, pos.y, pos.z);
    s.scale.set(size * aspect, size, 1);
    this.live.push({ s, vel: new THREE.Vector3(...vel), life, age: 0, size, grow, gravity, spin, aspect, fadeIn });
    return s;
  }

  emoji(ch, pos, n = 1, opts = {}) {
    for (let i = 0; i < n; i++) {
      this.spawn({
        map: emojiTexture(ch), pos: { x: pos.x + (Math.random() - 0.5) * 0.5, y: pos.y + Math.random() * 0.3, z: pos.z + (Math.random() - 0.5) * 0.5 },
        vel: [(Math.random() - 0.5) * 0.8, 1.1 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8], life: 1.4, size: 0.42, grow: 0.15, ...opts,
      });
    }
  }

  sparkle(pos, color = '#ffe680', n = 10, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random();
      this.spawn({ map: glowTexture(), color, additive: true, pos, vel: [Math.cos(a) * spread * (1 + u), 1 + Math.random() * 2, Math.sin(a) * spread * (1 + u)], gravity: -3, life: 0.8 + Math.random() * 0.4, size: 0.35 + Math.random() * 0.25, grow: -0.3 });
    }
  }

  confetti(pos, n = 40, power = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn({ map: squareTexture(), color: CONFETTI[i % CONFETTI.length], pos, vel: [Math.cos(a) * power * Math.random(), 3 + Math.random() * power, Math.sin(a) * power * Math.random()], gravity: -6, life: 2 + Math.random(), size: 0.18, spin: (Math.random() - 0.5) * 12 });
    }
  }

  text(str, pos, color = '#ffe066', size = 0.45) {
    const map = textTexture(str, { color });
    this.spawn({ map, pos, vel: [0, 1.2, 0], life: 1.3, size, aspect: map.userData.aspect, fadeIn: 0.05 });
  }

  ring(pos, color = '#b78bff', size = 3, life = 0.8) {
    this.spawn({ map: ringTexture(), color, additive: true, pos, vel: [0, 0, 0], life, size: 0.5, grow: size, fadeIn: 0.01 });
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        this.scene.remove(p.s);
        p.s.material.map?.userData?.aspect && p.s.material.map.dispose?.();
        this.pool.push(p.s);
        this.live.splice(i, 1);
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.s.position.addScaledVector(p.vel, dt);
      const size = Math.max(0.01, p.size + p.grow * p.age);
      p.s.scale.set(size * p.aspect, size, 1);
      p.s.material.opacity = Math.min(1, p.age / p.fadeIn) * (k > 0.7 ? (1 - k) / 0.3 : 1);
      if (p.spin) p.s.material.rotation += p.spin * dt;
    }
  }
}

let sq, ring;
function squareTexture() {
  if (!sq) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(2, 4, 12, 8);
    sq = new THREE.CanvasTexture(c);
  }
  return sq;
}
function ringTexture() {
  if (!ring) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.strokeStyle = '#fff';
    x.lineWidth = 10;
    x.shadowColor = '#fff';
    x.shadowBlur = 12;
    x.beginPath();
    x.arc(64, 64, 50, 0, Math.PI * 2);
    x.stroke();
    ring = new THREE.CanvasTexture(c);
  }
  return ring;
}
