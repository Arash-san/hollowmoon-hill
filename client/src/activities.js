// In-world activity objects: collectible pumpkins and candy, wisps, graveyard candles, the jack-o'-lantern gallery,
// summoning runes, braziers and the boss bell.
import { THREE, toonMesh, glowMat, col, merge, tf, sphere, cone, cyl, torus, glowSprite, glowTexture } from './engine/toon.js';
import * as PR from './world/props.js';
import { groundY } from './world/world.js';
import { textTexture } from './engine/fx.js';
import { CANDLES, WISP_SLOTS, wispPos, RITUAL_RUNES, BRAZIERS, BOSS_BELL, RUNE_RADIUS } from '../../shared/world.js';


function propMesh(o, outline = true) {
  const g = new THREE.Group();
  if (o.toon.length) g.add(toonMesh(merge(o.toon), { outline }));
  if (o.glow.length) g.add(new THREE.Mesh(merge(o.glow), glowMat));
  return g;
}

const CANDY_COLORS = [['#ff4f8b', '#fff4e3'], ['#2ec4b6', '#fff4e3'], ['#ffd23f', '#ff7a1a'], ['#7b4dff', '#ffd23f']];
const candyGeos = CANDY_COLORS.map(([a, b]) => merge([
  col(tf(sphere(0.2, 12, 8), { s: [1.2, 0.9, 0.9] }), (x) => (Math.abs(Math.sin(x * 30)) > 0.5 ? a : b), 0, true),
  col(tf(cone(0.14, 0.2, 6), { p: [0.32, 0, 0], r: [0, 0, Math.PI / 2] }), a),
  col(tf(cone(0.14, 0.2, 6), { p: [-0.32, 0, 0], r: [0, 0, -Math.PI / 2] }), a),
]));

export class Activities {
  constructor(scene, fx, world) {
    this.scene = scene;
    this.fx = fx;
    this.world = world;
    this.pumpkins = new Map();
    this.candies = new Map();
    this.wisps = [];
    this.wispGen = [];
    this.carvings = new Map();
    this.candleLit = new Array(CANDLES.length).fill(false);
    this.candleRun = null;
    this.buildCandles();
    this.buildRunes();
    this.buildBraziers();
    this.buildBell();
    for (let i = 0; i < WISP_SLOTS; i++) this.buildWisp(i);
  }

  // ---------------------------------------------------------------- pickups
  addPumpkin(item, pop = false) {
    if (this.pumpkins.has(item.id)) return;
    const g = propMesh(PR.pumpkin(item.id, item.s || 1, true));
    const s = glowSprite('#ffb347', 2.2 * (item.s || 1), 0.45);
    s.position.y = 0.35;
    g.add(s);
    g.position.set(item.x, groundY(item.x, item.z), item.z);
    g.rotation.y = item.id;
    this.scene.add(g);
    this.pumpkins.set(item.id, { item, g, t: pop ? 0 : 1 });
    if (pop) this.fx.sparkle(g.position.clone().setY(g.position.y + 0.5), '#ffb347', 8);
  }

  addCandy(item) {
    if (this.candies.has(item.id)) return;
    const m = toonMesh(candyGeos[item.k % 4], { width: 0.012 });
    const g = new THREE.Group();
    g.add(m);
    const s = glowSprite(CANDY_COLORS[item.k % 4][0], 1.1, 0.4);
    g.add(s);
    g.position.set(item.x, groundY(item.x, item.z) + 0.7, item.z);
    this.scene.add(g);
    this.candies.set(item.id, { item, g, m });
  }

  remove(kind, id, collectorPos) {
    const pool = kind === 'pumpkin' ? this.pumpkins : this.candies;
    const e = pool.get(id);
    if (!e) return;
    pool.delete(id);
    const p = e.g.position.clone();
    this.scene.remove(e.g);
    this.fx.sparkle(p.setY(p.y + 0.4), kind === 'pumpkin' ? '#ffb347' : '#ff8fb8', 10);
    if (collectorPos) this.fx.ring(p, kind === 'pumpkin' ? '#ffb347' : '#ff8fb8', 2, 0.5);
  }

  // ---------------------------------------------------------------- wisps
  buildWisp(i) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(sphere(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: '#d9fbff' }));
    g.add(core);
    const halo = glowSprite('#7df9ff', 1.8, 0.75);
    g.add(halo);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(sphere(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: '#1c3a5a' }));
      eye.position.set(sx * 0.06, 0.03, 0.16);
      g.add(eye);
    }
    this.scene.add(g);
    this.wisps.push({ g, trail: 0 });
  }

  setWispGen(gens) {
    this.wispGen = gens.slice();
  }

  catchWisp(slot, gen, pos) {
    const w = this.wisps[slot];
    if (w) {
      this.fx.sparkle(w.g.position.clone(), '#7df9ff', 16, 1.4);
      this.fx.ring(w.g.position.clone(), '#7df9ff', 2.5, 0.6);
    }
    this.wispGen[slot] = gen;
    void pos;
  }

  // ---------------------------------------------------------------- candles (personal)
  buildCandles() {
    this.candles = CANDLES.map((c) => {
      const g = new THREE.Group();
      g.add(toonMesh(merge([col(cyl(0.09, 0.1, 0.5, 10), '#f1e3c2'), col(tf(cyl(0.18, 0.2, 0.06, 10), { p: [0, -0.25, 0] }), '#8a6a3a')]), { width: 0.012 }));
      g.children[0].position.y = 0.3;
      const flame = new THREE.Group();
      flame.add(new THREE.Mesh(tf(sphere(0.07, 8, 6), { s: [0.8, 1.7, 0.8] }), new THREE.MeshBasicMaterial({ color: '#ffcf5a' })));
      flame.add(glowSprite('#ffb347', 1.4, 0.8));
      flame.position.y = 0.66;
      flame.visible = false;
      g.add(flame);
      g.position.set(c.x, groundY(c.x, c.z), c.z);
      this.scene.add(g);
      return { g, flame };
    });
  }

  lightCandle(i) {
    if (this.candleLit[i]) return false;
    this.candleLit[i] = true;
    this.candles[i].flame.visible = true;
    this.fx.sparkle(this.candles[i].g.position.clone().setY(0.8), '#ffcf5a', 8, 0.6);
    return true;
  }

  resetCandles() {
    this.candleLit.fill(false);
    for (const c of this.candles) c.flame.visible = false;
  }

  // ---------------------------------------------------------------- carvings gallery
  setCarving(item) {
    const slot = this.world.carvingSlots[item.slot];
    if (!slot) return;
    const old = this.carvings.get(item.id);
    if (old) this.scene.remove(old.g);
    const g = new THREE.Group();
    g.add(toonMesh(merge(PR.pumpkin(item.id * 7, 0.9).toon)));
    const tex = new THREE.TextureLoader().load(`carvings/${item.id}.png?v=${item.v || 1}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.385, 24, 16, Math.PI / 2 - 0.9, 1.8, 0.28 * Math.PI, 0.5 * Math.PI), new THREE.MeshBasicMaterial({ map: tex, color: '#ffcf6a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    face.position.y = 0.29;
    face.scale.y = 0.78;
    g.add(face);
    const s = glowSprite('#ffa94a', 1.6, 0.35);
    s.position.set(0, 0.35, 0.3);
    g.add(s);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(`${item.name} ${item.likes ? '💜' + item.likes : ''}`.trim(), { font: '600 34px Fredoka, sans-serif' }), transparent: true, depthWrite: false }));
    const asp = label.material.map.userData.aspect;
    label.scale.set(0.32 * asp, 0.32, 1);
    label.position.y = 1.15;
    g.add(label);
    g.position.set(slot.x, slot.y + groundY(slot.x, slot.z), slot.z);
    g.rotation.y = slot.rot;
    this.scene.add(g);
    this.carvings.set(item.id, { item, g, label });
  }

  setCarvingLikes(id, likes) {
    const c = this.carvings.get(id);
    if (!c) return;
    c.item.likes = likes;
    c.label.material.map.dispose();
    c.label.material.map = textTexture(`${c.item.name} 💜${likes}`, { font: '600 34px Fredoka, sans-serif' });
    c.label.scale.set(0.32 * c.label.material.map.userData.aspect, 0.32, 1);
    this.fx.emoji('💜', c.g.position.clone().setY(c.g.position.y + 1), 3);
  }

  // ---------------------------------------------------------------- summoning runes
  buildRunes() {
    this.runes = RITUAL_RUNES.map((r) => {
      const mat = new THREE.MeshBasicMaterial({ map: runeTexture(), color: '#7b4dff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(RUNE_RADIUS * 2.2, RUNE_RADIUS * 2.2).rotateX(-Math.PI / 2), mat);
      m.position.set(r.x, groundY(r.x, r.z) + 0.07, r.z);
      this.scene.add(m);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 8, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#b78bff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set(r.x, 4, r.z);
      this.scene.add(beam);
      return { m, beam, on: false };
    });
  }

  setRunes(filled) {
    this.runes.forEach((r, i) => {
      r.on = !!filled[i];
      r.m.material.color.set(r.on ? '#ffd23f' : '#7b4dff');
    });
  }

  // ---------------------------------------------------------------- boss courtyard props
  buildBraziers() {
    this.braziers = BRAZIERS.map((b) => {
      const flame = new THREE.Group();
      flame.add(new THREE.Mesh(tf(cone(0.35, 0.9, 8), { p: [0, 0.4, 0] }), new THREE.MeshBasicMaterial({ color: '#ffb347' })));
      flame.add(glowSprite('#ff7a1a', 3.2, 0.85));
      flame.position.set(b.x, 1.5, b.z);
      flame.visible = false;
      this.scene.add(flame);
      const hint = glowSprite('#9ef0ff', 1.2, 0.0);
      hint.position.set(b.x, 1.6, b.z);
      this.scene.add(hint);
      return { flame, hint };
    });
  }

  setBraziers(lit, shield) {
    this.braziers.forEach((b, i) => {
      b.flame.visible = !!lit[i];
      b.hint.material.opacity = shield && !lit[i] ? 0.6 : 0;
    });
  }

  buildBell() {
    const bell = toonMesh(PR.bell());
    bell.position.set(0, -0.75, 0);
    const pivot = new THREE.Group();
    pivot.position.set(BOSS_BELL.x, 3.2, BOSS_BELL.z);
    pivot.add(bell);
    this.scene.add(pivot);
    this.bell = pivot;
    this.bellSwing = 0;
  }

  ringBell() {
    this.bellSwing = 1;
  }

  // ---------------------------------------------------------------- per frame
  update(t, dt, serverT, playerPos) {
    for (const [, e] of this.pumpkins) {
      if (e.t < 1) e.t = Math.min(1, e.t + dt * 3);
      const s = e.t < 1 ? Math.sin(e.t * Math.PI * 0.5) * (1 + Math.sin(e.t * Math.PI) * 0.3) : 1;
      e.g.scale.setScalar(s);
      e.g.position.y = groundY(e.item.x, e.item.z) + Math.abs(Math.sin(t * 2 + e.item.id)) * 0.08;
    }
    for (const [, e] of this.candies) {
      e.m.rotation.y = t * 2 + e.item.id;
      e.g.position.y = groundY(e.item.x, e.item.z) + 0.7 + Math.sin(t * 3 + e.item.id) * 0.12;
    }
    for (let i = 0; i < this.wisps.length; i++) {
      const w = this.wisps[i];
      const gen = this.wispGen[i];
      if (gen === undefined) {
        w.g.visible = false;
        continue;
      }
      w.g.visible = true;
      const p = wispPos(gen, serverT);
      const prev = w.g.position.clone();
      w.g.position.set(p.x, p.y + groundY(p.x, p.z), p.z);
      if (prev.distanceToSquared(w.g.position) > 1e-4) w.g.lookAt(prev.lerp(w.g.position, 2));
      w.trail += dt;
      if (w.trail > 0.09) {
        w.trail = 0;
        this.fx.spawn({ map: glowTexture(), color: '#7df9ff', additive: true, pos: w.g.position, vel: [0, 0.1, 0], life: 0.7, size: 0.4, grow: -0.5 });
      }
    }
    for (const c of this.candles) if (c.flame.visible) c.flame.children[0].scale.y = 1 + Math.sin(t * 17 + c.g.position.x) * 0.15;
    for (const r of this.runes) {
      r.m.rotation.y = t * (r.on ? 1.5 : 0.3);
      r.m.material.opacity = r.on ? 0.95 : 0.55 + Math.sin(t * 2) * 0.15;
      r.beam.material.opacity += ((r.on ? 0.22 : 0) - r.beam.material.opacity) * Math.min(1, dt * 4);
    }
    for (const b of this.braziers) if (b.flame.visible) b.flame.children[0].scale.set(1 + Math.sin(t * 13) * 0.08, 1 + Math.sin(t * 17) * 0.15, 1);
    if (this.bellSwing > 0) {
      this.bellSwing = Math.max(0, this.bellSwing - dt * 0.35);
      this.bell.rotation.x = Math.sin(t * 9) * this.bellSwing * 0.6;
    }
    void playerPos;
  }
}

let runeTex;
function runeTexture() {
  if (!runeTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.strokeStyle = '#fff';
    x.shadowColor = '#fff';
    x.shadowBlur = 10;
    x.lineWidth = 7;
    x.beginPath();
    x.arc(128, 128, 110, 0, Math.PI * 2);
    x.stroke();
    x.lineWidth = 4;
    x.beginPath();
    x.arc(128, 128, 88, 0, Math.PI * 2);
    x.stroke();
    // five-point star made of pumpkins' favourite shape
    x.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + i * ((Math.PI * 4) / 5);
      x.lineTo(128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82);
    }
    x.stroke();
    x.font = '700 22px serif';
    x.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      x.save();
      x.translate(128 + Math.cos(a) * 99, 128 + Math.sin(a) * 99);
      x.rotate(a + Math.PI / 2);
      x.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹ'[i], -7, 7);
      x.restore();
    }
    runeTex = new THREE.CanvasTexture(c);
  }
  return runeTex;
}

export { torus };
