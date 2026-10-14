// Spiders: the server moves them and decides who gets bitten; the client draws them, wiggles their legs and eases
// them toward the latest position from the 10 Hz tick.
import { THREE, toonMesh, col, merge, tf, sphere, cyl, glowMat } from './engine/toon.js';
import { groundY } from './world/world.js';

function spiderGeo() {
  const parts = [
    col(tf(sphere(0.32, 14, 10), { p: [0, 0.38, -0.18], s: [1, 0.85, 1.2] }), '#2a1d33', 0.1),
    col(tf(sphere(0.2, 12, 8), { p: [0, 0.34, 0.22] }), '#3b2a48', 0.1),
    col(tf(sphere(0.12, 8, 6), { p: [0, 0.5, -0.24], s: [1.4, 0.4, 1.6] }), '#7b4dff'),
  ];
  return merge(parts);
}
function legGeo() {
  // one leg: up and out, then down to the ground (pivot at the body)
  return merge([
    col(tf(cyl(0.035, 0.035, 0.42, 5), { p: [0.2, 0.08, 0], r: [0, 0, -1.0] }), '#1c1226'),
    col(tf(cyl(0.03, 0.02, 0.46, 5), { p: [0.46, -0.1, 0], r: [0, 0, 0.45] }), '#1c1226'),
  ]);
}
const BODY = spiderGeo();
const LEG = legGeo();
const EYES = merge([-1, 1].flatMap((sx) => [col(tf(sphere(0.045, 6, 4), { p: [sx * 0.07, 0.4, 0.4] }), '#ff3d3d'), col(tf(sphere(0.03, 6, 4), { p: [sx * 0.13, 0.44, 0.36] }), '#ff3d3d')]));

export class Spiders {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.map = new Map(); // id -> { g, legs, tx, tz, try }
  }

  make(id, x, z) {
    const g = new THREE.Group();
    g.add(toonMesh(BODY, { width: 0.025 }));
    g.add(new THREE.Mesh(EYES, glowMat));
    const legs = [];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(sx * 0.18, 0.36, 0.12 - i * 0.14);
        pivot.rotation.y = sx > 0 ? -0.5 + i * 0.35 : Math.PI + 0.5 - i * 0.35;
        pivot.add(toonMesh(LEG, { width: 0.02 }));
        g.add(pivot);
        legs.push(pivot);
      }
    }
    g.position.set(x, groundY(x, z), z);
    g.scale.setScalar(1.25);
    this.scene.add(g);
    const s = { g, legs, tx: x, tz: z, try: 0, seed: id * 1.7 };
    this.map.set(id, s);
    return s;
  }

  // list: [[id, x, z, ry], ...] from the server tick
  sync(list) {
    if (!list) return;
    const seen = new Set();
    for (const [id, x, z, ry] of list) {
      seen.add(id);
      const s = this.map.get(id) || this.make(id, x, z);
      s.tx = x;
      s.tz = z;
      s.try = ry;
    }
    for (const [id, s] of this.map) if (!seen.has(id)) this.remove(id, false);
  }

  remove(id, poof = true) {
    const s = this.map.get(id);
    if (!s) return;
    if (poof) {
      this.fx.sparkle(s.g.position.clone().setY(0.5), '#b78bff', 14, 1.2);
      this.fx.emoji('🍬', s.g.position.clone().setY(1), 1);
    }
    this.scene.remove(s.g);
    this.map.delete(id);
  }

  nearest(p, max = 8) {
    let best = null, bd = max;
    for (const [id, s] of this.map) {
      const d = Math.hypot(s.g.position.x - p.x, s.g.position.z - p.z);
      if (d < bd) (bd = d), (best = { kind: 'spider', id, pos: () => s.g.position.clone().setY(0.5) });
    }
    return best;
  }

  update(t, dt) {
    for (const [, s] of this.map) {
      const g = s.g;
      const dx = s.tx - g.position.x, dz = s.tz - g.position.z;
      const moving = Math.hypot(dx, dz) > 0.05;
      g.position.x += dx * Math.min(1, dt * 9);
      g.position.z += dz * Math.min(1, dt * 9);
      g.position.y = groundY(g.position.x, g.position.z);
      let d = s.try - g.rotation.y;
      d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      g.rotation.y += d * Math.min(1, dt * 10);
      s.legs.forEach((l, i) => (l.rotation.z = moving ? Math.sin(t * 22 + i * 1.3 + s.seed) * 0.35 : Math.sin(t * 2 + i) * 0.05));
    }
  }
}
