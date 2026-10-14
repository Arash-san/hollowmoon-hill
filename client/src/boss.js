// The Gourd King on the client: model and moods, attack telegraphs (shockwave rings, seed volleys, minions),
// candy-corn projectiles from players, and local hit checks (the server only runs health and timing).
import { THREE, toonMesh, col, merge, tf, sphere, cyl, cone, torus, warp, glowSprite, glowMat } from './engine/toon.js';
import { BOSSES } from '../../shared/world.js';
import { emojiTexture } from './engine/fx.js';

function faceTexture(mood) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#ffe066';
  if (mood === 'sleep') {
    x.lineWidth = 16;
    x.strokeStyle = '#ffe066';
    x.lineCap = 'round';
    for (const sx of [-1, 1]) {
      x.beginPath();
      x.arc(256 + sx * 95, 100, 40, 0.15 * Math.PI, 0.85 * Math.PI);
      x.stroke();
    }
    x.beginPath();
    x.arc(256, 190, 30, 0, Math.PI * 2);
    x.stroke();
  } else {
    const dizzy = mood === 'dizzy';
    for (const sx of [-1, 1]) {
      x.beginPath();
      if (dizzy) {
        x.lineWidth = 12;
        x.strokeStyle = '#ffe066';
        for (let a = 0; a < Math.PI * 6; a += 0.2) x.lineTo(256 + sx * 95 + Math.cos(a) * a * 3, 100 + Math.sin(a) * a * 3);
        x.stroke();
      } else {
        // angry slanted triangle eyes
        x.moveTo(256 + sx * 40, 80 + 20);
        x.lineTo(256 + sx * 150, 50);
        x.lineTo(256 + sx * 110, 140);
        x.closePath();
        x.fill();
      }
    }
    // jagged grin
    x.beginPath();
    x.moveTo(110, 170);
    const teeth = 7;
    for (let i = 0; i <= teeth; i++) {
      const px = 110 + (i / teeth) * 292;
      x.lineTo(px, 170 + (i % 2 ? 22 : 0));
    }
    x.lineTo(402, 172);
    x.quadraticCurveTo(256, 300, 110, 172);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class BossView {
  // id: 'king' (the Gourd King in the courtyard) or 'mayor' (the finale, rising from the plaza fountain)
  constructor(scene, fx, audio, id = 'king') {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.id = id;
    this.A = BOSSES[id].center;
    const A = this.A;
    this.mayor = id === 'mayor';
    this.state = { state: 'idle', hp: 1, maxHp: 1 };
    this.root = new THREE.Group();
    this.root.position.set(A.x, this.mayor ? 0.7 : 0, A.z);
    if (this.mayor) {
      this.root.scale.setScalar(1.35);
      this.root.visible = false;
    }
    scene.add(this.root);
    this.body = new THREE.Group();
    this.root.add(this.body);
    const R = 2.6;
    const g = warp(sphere(R, 36, 24), (x, y, z) => {
      const a = Math.atan2(x, z), k = 1 + Math.cos(a * 12) * 0.05;
      return [x * k, y * 0.82, z * k];
    });
    this.body.add(toonMesh(merge([
      col(tf(g, { p: [0, R * 0.82, 0] }), this.mayor ? '#e8590c' : '#ff6a12', 0.06),
      col(tf(cyl(0.3, 0.45, 1.0, 8), { p: [0, R * 1.75, 0], r: [0.2, 0, 0.1] }), '#4f6b2a'),
      ...(this.mayor ? [
        // the mayor's tall top hat with a purple band, and a gold monocle
        col(tf(cyl(1.75, 1.75, 0.16, 28), { p: [0, R * 1.58, 0] }), '#1b1226'),
        col(tf(cyl(1.05, 1.15, 2.1, 24), { p: [0, R * 1.58 + 1.1, 0] }), '#1b1226'),
        col(tf(cyl(1.17, 1.17, 0.36, 24, true), { p: [0, R * 1.58 + 0.35, 0] }), '#7b4dff'),
        col(tf(torus(0.42, 0.06, 8, 24), { p: [0.95, R * 1.02, R * 0.88], r: [0, 0.35, 0] }), '#ffd23f'),
        col(tf(cyl(0.02, 0.02, 1.4, 4), { p: [1.3, R * 0.55, R * 0.8], r: [0, 0, 0.25] }), '#ffd23f'),
      ] : [
        // crown
        col(tf(cyl(1.15, 1.25, 0.5, 16, true), { p: [0, R * 1.62, 0] }), '#ffd23f'),
        ...Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return col(tf(cone(0.24, 0.6, 4), { p: [Math.sin(a) * 1.15, R * 1.62 + 0.5, Math.cos(a) * 1.15] }), '#ffd23f');
        }),
      ]),
    ]), { width: 0.05 }));
    this.gems = new THREE.Mesh(merge(Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + 0.45;
      return col(tf(sphere(0.12, 8, 6), { p: [Math.sin(a) * 1.22, R * 1.62, Math.cos(a) * 1.22] }), ['#ff4f8b', '#2ec4b6', '#7b4dff'][i % 3]);
    })), glowMat);
    this.gems.visible = !this.mayor;
    this.body.add(this.gems);
    this.faces = { angry: faceTexture('angry'), sleep: faceTexture('sleep'), dizzy: faceTexture('dizzy') };
    this.face = new THREE.Mesh(new THREE.SphereGeometry(R * 1.01, 32, 16, Math.PI / 2 - 0.95, 1.9, 0.3 * Math.PI, 0.5 * Math.PI), new THREE.MeshBasicMaterial({ map: this.faces.sleep, transparent: true, toneMapped: false }));
    this.face.position.y = R * 0.82;
    this.face.scale.y = 0.82;
    this.body.add(this.face);
    this.glow = glowSprite('#ff8a2a', 9, 0.4);
    this.glow.position.set(0, R, 1.5);
    this.body.add(this.glow);
    // vine arms
    this.arms = [-1, 1].map((sx) => {
      const pivot = new THREE.Group();
      pivot.position.set(sx * R * 0.95, R * 0.8, 0);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(sx * 0.9, 0.6, 0.3), new THREE.Vector3(sx * 1.6, 0.2, 0.8), new THREE.Vector3(sx * 2.0, -0.6, 1.2)]);
      pivot.add(toonMesh(merge([col(new THREE.TubeGeometry(curve, 16, 0.2, 8), '#4f7a2c'), col(tf(sphere(0.45, 10, 8), { p: [sx * 2.0, -0.7, 1.2], s: [1, 0.8, 1] }), '#5d8a2c')]), { width: 0.03 }));
      this.body.add(pivot);
      return pivot;
    });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(R * 1.55, 32, 20), new THREE.MeshBasicMaterial({ color: '#7fb2ff', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.shield.position.y = R * 0.85;
    this.shield.visible = false;
    this.root.add(this.shield);
    this.zzz = 0;
    this.rings = [];
    this.seeds = [];
    this.minions = new Map();
    this.shots = [];
    this.flash = 0;
    this.hitCooldown = 0;
    this.minionGeo = merge([
      col(tf(warp(sphere(0.5, 14, 10), (x, y, z) => {
        const a = Math.atan2(x, z), k = 1 + Math.cos(a * 8) * 0.07;
        return [x * k, y * 0.8, z * k];
      }), { p: [0, 0.45, 0] }), '#ff8a2a', 0.06),
      col(tf(cyl(0.05, 0.07, 0.2, 5), { p: [0, 0.92, 0] }), '#4f6b2a'),
      ...[-1, 1].map((sx) => col(tf(cone(0.09, 0.12, 3), { p: [sx * 0.17, 0.55, 0.42], r: [Math.PI / 2, 0, 0] }), '#3a1400')),
    ]);
  }

  setState(s) {
    const prev = this.state.state;
    this.state = s;
    this.shield.visible = s.state === 'shield';
    const mood = s.state === 'idle' || s.state === 'defeated' ? 'sleep' : s.state === 'stunned' ? 'dizzy' : 'angry';
    this.face.material.map = this.faces[mood];
    // the mayor only exists as a giant while the finale runs
    if (this.mayor) this.root.visible = ['intro', 'fight', 'stunned', 'shield'].includes(s.state) || (s.state === 'defeated' && performance.now() - (this.defeatedAt || 0) < 4000);
    if (s.state === 'defeated' && prev !== 'defeated') this.defeatedAt = performance.now();
    if (prev !== s.state) {
      if (s.state === 'intro') {
        this.audio.play('roar');
        this.fx.confetti(this.root.position.clone().setY(3), 30, 5);
      }
      if (s.state === 'defeated') {
        this.fx.confetti(this.root.position.clone().setY(4), 120, 8);
        this.fx.sparkle(this.root.position.clone().setY(3), '#ffd23f', 40, 3);
        for (const [, m] of this.minions) this.scene.remove(m.g);
        this.minions.clear();
      }
      if (s.state === 'idle') {
        for (const [, m] of this.minions) this.scene.remove(m.g);
        this.minions.clear();
      }
    }
  }

  active() {
    return ['fight', 'shield', 'stunned'].includes(this.state.state);
  }

  onHit(by, dmg) {
    this.flash = 0.15;
    this.audio.play('hit');
    this.fx.text(`-${dmg}`, this.root.position.clone().setY(4.5 + Math.random()), dmg > 10 ? '#ffd23f' : '#ff8fb8', 0.6);
  }

  attack(m, serverNow) {
    if (m.kind === 'slam') {
      this.slamAt = m.at;
      for (let i = 0; i < (m.rings || 1); i++) this.rings.push({ at: m.at + i * 0.9, speed: m.speed, mesh: null, hitChecked: false });
    } else if (m.kind === 'seeds') {
      for (const s of m.spots) {
        const marker = new THREE.Mesh(new THREE.RingGeometry(m.r * 0.85, m.r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3d3d', transparent: true, opacity: 0.8, depthWrite: false }));
        marker.position.set(s.x, 0.08, s.z);
        const fill = new THREE.Mesh(new THREE.CircleGeometry(m.r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3d3d', transparent: true, opacity: 0.25, depthWrite: false }));
        fill.position.set(s.x, 0.07, s.z);
        fill.scale.setScalar(0.01);
        const seed = new THREE.Mesh(sphere(0.35, 10, 8), new THREE.MeshToonMaterial({ color: '#ffe8a8' }));
        this.scene.add(marker, fill, seed);
        this.seeds.push({ s, r: m.r, at: m.at, start: serverNow, marker, fill, seed });
      }
    } else if (m.kind === 'minions') {
      for (const mi of m.list) this.addMinion(mi);
    } else if (m.kind === 'minionDie') {
      const mi = this.minions.get(m.id);
      if (mi) {
        this.fx.sparkle(mi.g.position.clone().setY(0.6), '#ff8a2a', 12, 1.2);
        this.fx.emoji('🍬', mi.g.position.clone().setY(1), 1);
        this.scene.remove(mi.g);
        this.minions.delete(m.id);
      }
    }
  }

  addMinion(mi) {
    if (this.minions.has(mi.id)) return;
    const g = new THREE.Group();
    g.add(toonMesh(this.minionGeo, { width: 0.02 }));
    g.position.set(mi.x, 0, mi.z);
    this.scene.add(g);
    this.minions.set(mi.id, { ...mi, g, hp: mi.hp });
    this.fx.sparkle(g.position.clone().setY(0.5), '#4f7a2c', 8);
  }

  // A thrown candy corn: flies to the target, then reports the hit.
  throwAt(from, target, onArrive, icon = '🍬') {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(icon), transparent: true, depthWrite: false }));
    m.scale.setScalar(icon === '🔥' ? 0.9 : 0.6);
    m.position.copy(from);
    this.scene.add(m);
    this.shots.push({ m, from: from.clone(), target, t: 0, dur: Math.max(0.25, from.distanceTo(target.pos()) / 22), onArrive });
  }

  nearestTarget(p) {
    let best = null, bd = Infinity;
    for (const [id, mi] of this.minions) {
      const d = mi.g.position.distanceTo(p);
      if (d < 7 && d < bd) (bd = d), (best = { kind: 'minion', id, pos: () => mi.g.position.clone().setY(0.6) });
    }
    if (best) return best;
    const A = this.A;
    const d = Math.hypot(p.x - A.x, p.z - A.z);
    if (d < A.r + 8) return { kind: 'boss', b: this.id, id: 0, pos: () => this.root.position.clone().setY(this.mayor ? 4 : 2.4) };
    return null;
  }

  // Returns true when the local player got hit this frame.
  update(t, dt, serverNow, player, players) {
    const st = this.state.state;
    const A = this.A;
    if (this.mayor && this.state.state === 'defeated' && this.root.visible && performance.now() - (this.defeatedAt || 0) > 4000) this.root.visible = false;
    const R = 2.6;
    // body pose
    let y = 0, sq = 1;
    if (st === 'idle' || st === 'defeated') {
      y = -1.3 + Math.sin(t * 0.8) * 0.05;
      sq = 1 + Math.sin(t * 0.8) * 0.02;
      this.zzz += dt;
      if (this.zzz > 1.4) {
        this.zzz = 0;
        this.fx.emoji('💤', this.root.position.clone().setY(3), 1, { size: 0.8 });
      }
    } else if (st === 'intro') {
      y = Math.min(0, -1.3 + (t % 100) * 0) + Math.sin(t * 20) * 0.08;
      this.introT = (this.introT || 0) + dt;
      y = -1.3 + Math.min(1.3, this.introT * 0.6);
    } else {
      this.introT = 0;
      y = Math.abs(Math.sin(t * 3)) * 0.25;
      sq = 1 - Math.abs(Math.sin(t * 3)) * 0.04;
      if (this.slamAt && serverNow > this.slamAt - 0.9 && serverNow < this.slamAt) y = Math.sin(((this.slamAt - serverNow) / 0.9) * Math.PI) * 3;
    }
    if (st === 'stunned') this.body.rotation.z = Math.sin(t * 6) * 0.15;
    else this.body.rotation.z *= 0.9;
    this.body.position.y = y;
    this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    // face the nearest player
    if (player && st !== 'idle' && st !== 'defeated') {
      const want = Math.atan2(player.pos.x - A.x, player.pos.z - A.z);
      let d = want - this.root.rotation.y;
      d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.root.rotation.y += d * Math.min(1, dt * 3);
    }
    this.arms.forEach((a, i) => (a.rotation.x = Math.sin(t * 2.4 + i * 2) * 0.35 + (this.active() ? -0.2 : 0.4)));
    this.flash = Math.max(0, this.flash - dt);
    this.glow.material.opacity = (st === 'idle' ? 0.15 : 0.4) + this.flash * 3;
    this.shield.material.opacity = 0.2 + Math.sin(t * 4) * 0.06;

    let hit = false;
    const me = player?.pos;
    const meGrounded = player && !player.air;
    // shockwave rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      const age = serverNow - r.at;
      if (age < 0) continue;
      if (!r.mesh) {
        r.mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.18, 8, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        r.mesh.position.set(A.x, 0.25, A.z);
        this.scene.add(r.mesh);
        this.audio.play('slam');
        this.fx.ring(new THREE.Vector3(A.x, 0.3, A.z), '#ffb347', 6, 0.5);
      }
      const radius = 2.5 + age * r.speed;
      r.mesh.scale.set(radius, 1, radius);
      r.mesh.material.opacity = Math.max(0, 0.9 - age * 0.25);
      if (me && !r.hitChecked) {
        const d = Math.hypot(me.x - A.x, me.z - A.z);
        if (Math.abs(d - radius) < 0.55 && me.y < 0.55 && meGrounded) {
          hit = true;
          r.hitChecked = true;
        }
        if (radius > d + 1) r.hitChecked = true;
      }
      if (radius > A.r + 6) {
        this.scene.remove(r.mesh);
        this.rings.splice(i, 1);
      }
    }
    // seed volleys
    for (let i = this.seeds.length - 1; i >= 0; i--) {
      const s = this.seeds[i];
      const k = Math.min(1, (serverNow - s.start) / Math.max(0.2, s.at - s.start));
      s.fill.scale.setScalar(Math.max(0.01, k));
      // the seed arcs from the king's mouth to the target
      const from = new THREE.Vector3(A.x, 3, A.z);
      s.seed.position.set(from.x + (s.s.x - from.x) * k, from.y + Math.sin(k * Math.PI) * 6 * (1 - k * 0.3) - k * 2.8, from.z + (s.s.z - from.z) * k);
      s.seed.visible = k > 0.05;
      if (serverNow >= s.at) {
        if (me && Math.hypot(me.x - s.s.x, me.z - s.s.z) < s.r) hit = true;
        this.fx.sparkle(new THREE.Vector3(s.s.x, 0.3, s.s.z), '#ffe8a8', 8, 1.5);
        this.scene.remove(s.marker, s.fill, s.seed);
        this.seeds.splice(i, 1);
      }
    }
    // minions chase the nearest player (each client simulates its own copy)
    for (const [, m] of this.minions) {
      let target = null, bd = Infinity;
      for (const p of players) {
        const d = Math.hypot(p.pos.x - m.g.position.x, p.pos.z - m.g.position.z);
        if (d < bd) (bd = d), (target = p.pos);
      }
      if (target && bd > 0.3) {
        const sp = 2.6 * dt;
        m.g.position.x += ((target.x - m.g.position.x) / bd) * sp;
        m.g.position.z += ((target.z - m.g.position.z) / bd) * sp;
        m.g.rotation.y = Math.atan2(target.x - m.g.position.x, target.z - m.g.position.z);
      }
      m.g.position.y = Math.abs(Math.sin(t * 9 + m.id)) * 0.25;
      if (me && Math.hypot(me.x - m.g.position.x, me.z - m.g.position.z) < 0.9 && me.y < 0.8) hit = true;
    }
    // projectiles
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.t += dt / s.dur;
      const to = s.target.pos();
      const k = Math.min(1, s.t);
      s.m.position.lerpVectors(s.from, to, k);
      s.m.position.y += Math.sin(k * Math.PI) * 1.5;
      s.m.material.rotation += dt * 12;
      if (k >= 1) {
        this.scene.remove(s.m);
        this.shots.splice(i, 1);
        this.fx.sparkle(to, '#ff8fb8', 6, 0.8);
        s.onArrive?.();
      }
    }
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    if (hit && this.hitCooldown <= 0) {
      this.hitCooldown = 2.6;
      return true;
    }
    return false;
  }
}

export { torus };
