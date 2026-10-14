// Prop factories. Each returns { toon: [geos], glow: [geos], col: [{x,z,r}] } in local space; world.js places,
// merges and outlines them. Colours are baked into vertices; glowing parts use the unlit glow material.
import { THREE, col, merge, tf, sphere, cyl, cone, box, torus, capsule, warp, carve, roundBox, hash3 } from '../engine/toon.js';

export const P = () => ({ toon: [], glow: [], col: [] });
const rnd = (seed) => {
  let s = Math.floor(seed * 9301 + 49297) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
};
const darker = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();

function tube(points, r, seg = 8, rad = 6) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, r, rad);
}
function ribbed(r, ribs = 8, depth = 0.07, squash = 0.8, w = 18, h = 12) {
  return warp(sphere(r, w, h), (x, y, z) => {
    const a = Math.atan2(x, z), k = 1 + Math.cos(a * ribs) * depth;
    return [x * k, y * squash, z * k];
  });
}

// ---------------------------------------------------------------- nature
export function deadTree(seed, h = 4) {
  const r = rnd(seed), o = P();
  const lean = (r() - 0.5) * 0.6;
  o.toon.push(col(tube([[0, 0, 0], [lean * 0.3, h * 0.4, 0.1], [lean, h * 0.75, -0.1], [lean * 1.2, h, 0]], 0.22, 10, 7), '#3a2a33', 0.15));
  o.toon.push(col(tf(cone(0.45, 0.6, 7), { p: [0, 0.2, 0] }), '#3a2a33'));
  for (let i = 0; i < 5; i++) {
    const y = h * (0.45 + r() * 0.45), a = r() * Math.PI * 2, len = 0.8 + r() * 1.2;
    const bx = Math.cos(a) * len, bz = Math.sin(a) * len;
    o.toon.push(col(tube([[lean * (y / h), y, 0], [bx * 0.5, y + 0.3, bz * 0.5], [bx, y + 0.5 + r() * 0.6, bz]], 0.07, 6, 5), '#3a2a33'));
  }
  o.col.push({ x: 0, z: 0, r: 0.45 });
  return o;
}

export function roundTree(seed, h = 3.4) {
  const r = rnd(seed), o = P();
  const leaf = ['#e0703a', '#c94f32', '#e8a33d', '#b8432c', '#d9622b'][Math.floor(r() * 5)];
  o.toon.push(col(tube([[0, 0, 0], [0.1, h * 0.5, 0], [0, h * 0.75, 0.05]], 0.18, 6, 7), '#4a3328', 0.1));
  for (let i = 0; i < 4; i++) {
    const s = 0.9 + r() * 0.6;
    o.toon.push(col(tf(sphere(s, 12, 9), { p: [(r() - 0.5) * 1.2, h * 0.75 + r() * 0.9, (r() - 0.5) * 1.2] }), (x, y) => (y < h * 0.6 + 0.4 ? darker(leaf, 0.7) : leaf), 0.12));
  }
  o.col.push({ x: 0, z: 0, r: 0.4 });
  return o;
}

export function pine(seed, h = 5) {
  const r = rnd(seed), o = P();
  const c = ['#1f3b3a', '#244540', '#1b3236'][Math.floor(r() * 3)];
  o.toon.push(col(cyl(0.18, 0.24, h * 0.3, 6), '#3b2a25'));
  for (let i = 0; i < 3; i++) o.toon.push(col(tf(cone(1.5 - i * 0.38, h * 0.38, 8), { p: [0, h * (0.3 + i * 0.2), 0], r: [0, r() * 3, 0] }), c, 0.12));
  o.col.push({ x: 0, z: 0, r: 0.45 });
  return o;
}

export function rock(seed, s = 1) {
  const r = rnd(seed), o = P();
  o.toon.push(col(tf(warp(new THREE.IcosahedronGeometry(0.6, 1), (x, y, z) => {
    const k = 0.8 + hash3(x * 3 + seed, y * 3, z * 3) * 0.4;
    return [x * k, y * k * 0.7, z * k];
  }), { s: [s, s, s], r: [0, r() * 6, 0], p: [0, 0.2 * s, 0] }), '#5d5670', 0.1));
  o.col.push({ x: 0, z: 0, r: 0.55 * s });
  return o;
}

export function mushroom(seed, s = 1) {
  const r = rnd(seed), o = P();
  const glowC = ['#5cf2e8', '#b78bff', '#8dff6a'][Math.floor(r() * 3)];
  for (let i = 0; i < 3; i++) {
    const x = (r() - 0.5) * 0.6 * s, z = (r() - 0.5) * 0.6 * s, h = (0.2 + r() * 0.25) * s;
    o.toon.push(col(tf(cyl(0.035 * s, 0.05 * s, h, 6), { p: [x, h / 2, z] }), '#e8e0d0'));
    o.glow.push(col(tf(carve(sphere(0.13 * s, 10, 6), (xx, yy) => yy > -0.02), { p: [x, h, z], s: [1, 0.7, 1] }), glowC));
  }
  return o;
}

export function pumpkin(seed, s = 1, lit = false) {
  const r = rnd(seed), o = P();
  const c = ['#ff7a1a', '#f26b0f', '#ff9a3c', '#e8590c'][Math.floor(r() * 4)];
  o.toon.push(col(tf(ribbed(0.42 * s, 8, 0.07, 0.78), { p: [0, 0.32 * s, 0] }), c, 0.08));
  o.toon.push(col(tf(cyl(0.05 * s, 0.07 * s, 0.22 * s, 6), { p: [0.03, 0.66 * s, 0], r: [0.2, 0, -0.3] }), '#4f6b2a'));
  if (r() < 0.5) o.toon.push(col(tf(sphere(0.1 * s, 6, 4), { p: [0.14 * s, 0.62 * s, 0.05], s: [1.4, 0.2, 0.8] }), '#5d8a2c'));
  if (lit) {
    const z = 0.39 * s;
    for (const sx of [-1, 1]) o.glow.push(col(tf(cone(0.08 * s, 0.11 * s, 3), { p: [sx * 0.13 * s, 0.4 * s, z], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.4] }), '#ffd166'));
    o.glow.push(col(tf(carve(sphere(0.17 * s, 12, 6), (x, y) => y < 0), { p: [0, 0.27 * s, z - 0.02], s: [1.3, 0.75, 0.35] }), '#ffd166'));
  }
  o.col.push({ x: 0, z: 0, r: 0.4 * s });
  return o;
}

export function hayBale(seed) {
  const o = P();
  o.toon.push(col(tf(roundBox(1.3, 0.75, 0.8, 0.35, 4), { p: [0, 0.38, 0], r: [0, seed, 0] }), (x, y) => (Math.abs(y - 0.38) < 0.05 ? '#a77b2b' : '#e1b65a'), 0.15));
  o.col.push({ x: 0, z: 0, r: 0.75 });
  return o;
}

export function grassTuft(seed) {
  const r = rnd(seed), o = P();
  for (let i = 0; i < 5; i++) o.toon.push(col(tf(cone(0.05, 0.4 + r() * 0.3, 3), { p: [(r() - 0.5) * 0.4, 0.2, (r() - 0.5) * 0.4], r: [(r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5] }), '#3f6b4a'));
  return o;
}

// ---------------------------------------------------------------- town
export function lampPost(seed, colorGlow = '#ffb347') {
  const o = P();
  o.toon.push(col(cyl(0.07, 0.1, 2.6, 6), '#2b2236'));
  o.toon.push(col(tf(cyl(0.18, 0.22, 0.2, 8), { p: [0, 0.1, 0] }), '#2b2236'));
  o.toon.push(col(tf(tube([[0, 2.5, 0], [0.25, 2.75, 0], [0.5, 2.6, 0]], 0.04, 6, 5), {}), '#2b2236'));
  o.toon.push(col(tf(cone(0.22, 0.18, 6), { p: [0.5, 2.55, 0] }), '#2b2236'));
  o.glow.push(col(tf(cyl(0.12, 0.09, 0.26, 6), { p: [0.5, 2.33, 0] }), colorGlow));
  o.lights = [{ x: 0.5, y: 2.33, z: 0, c: colorGlow, s: 2.4 }];
  o.col.push({ x: 0, z: 0, r: 0.2 });
  void seed;
  return o;
}

export function fence(len = 3, color = '#3a2b40') {
  const o = P();
  const n = Math.max(2, Math.round(len / 0.7));
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i / n) * len;
    o.toon.push(col(tf(cyl(0.05, 0.05, 1.1, 5), { p: [x, 0.55, 0] }), color));
    o.toon.push(col(tf(cone(0.07, 0.16, 4), { p: [x, 1.17, 0] }), color));
  }
  for (const y of [0.35, 0.85]) o.toon.push(col(tf(box(len, 0.05, 0.05), { p: [0, y, 0] }), color));
  return o;
}

export function woodFence(len = 3) {
  const o = P();
  const n = Math.max(2, Math.round(len / 1.2));
  for (let i = 0; i <= n; i++) o.toon.push(col(tf(box(0.14, 0.9, 0.14), { p: [-len / 2 + (i / n) * len, 0.45, 0] }), '#6b4a33'));
  o.toon.push(col(tf(box(len, 0.12, 0.06), { p: [0, 0.65, 0], r: [0, 0, 0.03] }), '#80593d'));
  o.toon.push(col(tf(box(len, 0.12, 0.06), { p: [0, 0.32, 0], r: [0, 0, -0.03] }), '#80593d'));
  return o;
}

export function grave(seed) {
  const r = rnd(seed), o = P();
  const k = Math.floor(r() * 3);
  const stone = ['#8a86a0', '#77738c', '#9a95ad'][k];
  const tilt = (r() - 0.5) * 0.25;
  if (k === 0) {
    o.toon.push(col(tf(roundBox(0.8, 1.1, 0.2, 0.3, 4), { p: [0, 0.5, 0], r: [tilt, 0, tilt * 0.5] }), stone, 0.1));
    o.toon.push(col(tf(box(0.4, 0.05, 0.03), { p: [0, 0.65, 0.11], r: [tilt, 0, 0] }), darker(stone, 0.6)));
  } else if (k === 1) {
    o.toon.push(col(tf(box(0.16, 1.2, 0.16), { p: [0, 0.6, 0], r: [tilt, 0, tilt] }), stone, 0.1));
    o.toon.push(col(tf(box(0.66, 0.16, 0.16), { p: [0, 0.85, 0], r: [tilt, 0, tilt] }), stone, 0.1));
  } else {
    o.toon.push(col(tf(cyl(0.38, 0.4, 0.95, 10, false), { p: [0, 0.47, 0], s: [1, 1, 0.45], r: [tilt, 0, 0] }), stone, 0.1));
    o.toon.push(col(tf(sphere(0.38, 10, 6), { p: [0, 0.95, 0], s: [1, 0.6, 0.45] }), stone, 0.1));
  }
  // dirt mound
  o.toon.push(col(tf(carve(sphere(0.6, 10, 6), (x, y) => y > 0), { p: [0, 0, 0.75], s: [0.7, 0.25, 1.1] }), '#3d3046', 0.15));
  o.col.push({ x: 0, z: 0, r: 0.45 });
  return o;
}

export function candleCluster(seed) {
  const r = rnd(seed), o = P();
  for (let i = 0; i < 3; i++) {
    const h = 0.15 + r() * 0.2, x = (r() - 0.5) * 0.3, z = (r() - 0.5) * 0.3;
    o.toon.push(col(tf(cyl(0.04, 0.045, h, 8), { p: [x, h / 2, z] }), '#f1e3c2'));
    o.glow.push(col(tf(sphere(0.035, 6, 4), { p: [x, h + 0.05, z], s: [0.8, 1.6, 0.8] }), '#ffb347'));
  }
  return o;
}

export function house(seed, opts = {}) {
  const r = rnd(seed), o = P();
  const wall = opts.wall || ['#7c5f8f', '#5f7a8f', '#8f6a5f', '#6f8a6a', '#8a7a5a'][Math.floor(r() * 5)];
  const roof = opts.roof || ['#3a2550', '#4a2a2a', '#2a3a4a', '#5a2a3a'][Math.floor(r() * 4)];
  const w = 3.6 + r() * 1.2, d = 3.2 + r() * 0.8, h = 2.6 + r() * 0.8;
  o.toon.push(col(tf(roundBox(w, h, d, 0.12, 3), { p: [0, h / 2, 0], r: [0, 0, (r() - 0.5) * 0.06] }), wall, 0.08));
  // crooked roof: 4-sided cone, slightly bent
  const rh = 2.2 + r() * 1.2;
  const roofG = warp(cone(Math.max(w, d) * 0.82, rh, 4), (x, y, z) => [x + (y + rh / 2) ** 2 * 0.06, y, z]);
  o.toon.push(col(tf(roofG, { p: [0, h + rh / 2 - 0.1, 0], r: [0, Math.PI / 4, 0], s: [w / Math.max(w, d), 1, d / Math.max(w, d)] }), roof, 0.1));
  o.toon.push(col(tf(box(0.55, 1.4, 0.55), { p: [w * 0.25, h + 0.9, -d * 0.15] }), '#5a4a5a'));
  o.toon.push(col(tf(box(0.95, 1.55, 0.1), { p: [0, 0.78, d / 2 + 0.02] }), '#4a3021'));
  o.toon.push(col(tf(sphere(0.06, 6, 4), { p: [0.3, 0.8, d / 2 + 0.1] }), '#ffd23f'));
  for (const sx of [-1, 1]) {
    o.toon.push(col(tf(box(0.8, 0.8, 0.08), { p: [sx * w * 0.3, h * 0.62, d / 2 + 0.01] }), '#2b1f30'));
    o.glow.push(col(tf(box(0.62, 0.62, 0.06), { p: [sx * w * 0.3, h * 0.62, d / 2 + 0.04] }), r() < 0.8 ? '#ffc56b' : '#9ef0ff'));
    o.toon.push(col(tf(box(0.06, 0.66, 0.05), { p: [sx * w * 0.3, h * 0.62, d / 2 + 0.08] }), '#2b1f30'));
    o.toon.push(col(tf(box(0.66, 0.06, 0.05), { p: [sx * w * 0.3, h * 0.62, d / 2 + 0.08] }), '#2b1f30'));
  }
  o.glow.push(col(tf(box(0.5, 0.5, 0.06), { p: [0, h + rh * 0.3, d * 0.28] }), '#ffc56b'));
  o.toon.push(col(tf(box(1.4, 0.15, 0.8), { p: [0, 0.07, d / 2 + 0.4] }), '#5d5670'));
  o.col.push({ x: 0, z: 0, r: Math.max(w, d) * 0.62 });
  o.smoke = { x: w * 0.25, y: h + 1.6, z: -d * 0.15 };
  return o;
}

export function stall(seed, a = '#7b4dff', b = '#ff7a1a') {
  const o = P();
  o.toon.push(col(tf(roundBox(3, 1.0, 1.2, 0.1, 2), { p: [0, 0.5, 0] }), '#6b4a33', 0.08));
  o.toon.push(col(tf(box(3.2, 0.1, 1.4), { p: [0, 1.02, 0] }), '#80593d'));
  for (const sx of [-1, 1]) o.toon.push(col(tf(cyl(0.06, 0.06, 2.7, 6), { p: [sx * 1.45, 1.35, -0.5] }), '#4a3021'));
  for (const sx of [-1, 1]) o.toon.push(col(tf(cyl(0.06, 0.06, 2.3, 6), { p: [sx * 1.45, 1.15, 0.55] }), '#4a3021'));
  const awning = box(3.4, 0.08, 1.9, 8, 1, 1);
  o.toon.push(col(tf(new THREE.BoxGeometry(3.4, 0.08, 1.9, 8, 1, 1), { p: [0, 2.55, 0.05], r: [0.32, 0, 0] }), (x) => (Math.floor((x + 1.7) / 0.425) % 2 ? a : b), 0, true));
  void awning;
  for (let i = 0; i < 8; i++) o.toon.push(col(tf(cone(0.21, 0.25, 3), { p: [-1.49 + i * 0.425, 2.16, 0.95], r: [Math.PI + 0.3, 0, 0] }), i % 2 ? b : a));
  o.col.push({ x: 0, z: 0, r: 1.5 });
  void seed;
  return o;
}

export function bench() {
  const o = P();
  o.toon.push(col(tf(box(1.8, 0.1, 0.5), { p: [0, 0.48, 0] }), '#80593d'));
  o.toon.push(col(tf(box(1.8, 0.45, 0.08), { p: [0, 0.8, -0.24], r: [-0.15, 0, 0] }), '#80593d'));
  for (const sx of [-1, 1]) o.toon.push(col(tf(box(0.08, 0.48, 0.45), { p: [sx * 0.75, 0.24, 0] }), '#2b2236'));
  o.col.push({ x: 0, z: 0, r: 0.6 });
  return o;
}

export function barrel(seed) {
  const o = P();
  o.toon.push(col(warp(cyl(0.38, 0.38, 0.95, 12), (x, y, z) => {
    const k = 1 + 0.12 * Math.cos((y / 0.95) * Math.PI);
    return [x * k, y + 0.47, z * k];
  }), (x, y) => (Math.abs(y - 0.2) < 0.04 || Math.abs(y - 0.75) < 0.04 ? '#4a4050' : '#7a5236'), 0.12, true));
  o.col.push({ x: 0, z: 0, r: 0.45 });
  void seed;
  return o;
}

export function crate() {
  const o = P();
  o.toon.push(col(tf(box(0.8, 0.8, 0.8), { p: [0, 0.4, 0] }), '#8a6440', 0.12));
  o.toon.push(col(tf(box(0.84, 0.1, 0.84), { p: [0, 0.75, 0] }), '#6b4a33'));
  o.col.push({ x: 0, z: 0, r: 0.5 });
  return o;
}

export function bunting(from, to, seed = 1) {
  // string of triangle flags between two points (world space)
  const o = P();
  const n = 9, sag = 0.7;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - Math.sin(t * Math.PI) * sag, from[2] + (to[2] - from[2]) * t]);
  }
  o.toon.push(col(tube(pts, 0.015, 16, 4), '#2b2236'));
  const colors = ['#ff7a1a', '#7b4dff', '#2ec4b6', '#ffd23f'];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[i + 1];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI / 2;
    o.toon.push(col(tf(cone(0.18, 0.36, 3), { p: [mid[0], mid[1] - 0.2, mid[2]], r: [Math.PI, yaw, 0], s: [1, 1, 0.12] }), colors[(i + seed) % 4]));
  }
  return o;
}

// ---------------------------------------------------------------- landmarks
export function fountain() {
  const o = P();
  o.toon.push(col(tf(cyl(4.2, 4.5, 0.7, 28), { p: [0, 0.35, 0] }), '#6d6884', 0.08));
  o.toon.push(col(tf(torus(4.2, 0.3, 8, 32), { p: [0, 0.72, 0], r: [Math.PI / 2, 0, 0] }), '#8a86a0', 0.06));
  o.toon.push(col(tf(cyl(1.0, 1.4, 1.6, 12), { p: [0, 1.2, 0] }), '#77738c', 0.08));
  // the giant jack-o'-lantern
  o.toon.push(col(tf(ribbed(1.9, 10, 0.08, 0.82, 26, 18), { p: [0, 3.4, 0] }), '#ff7a1a', 0.06));
  o.toon.push(col(tf(tube([[0, 4.8, 0], [0.1, 5.4, 0.1], [0.45, 5.7, 0.2]], 0.16, 8, 6), {}), '#4f6b2a'));
  o.toon.push(col(tf(sphere(0.5, 8, 6), { p: [-0.5, 5.0, 0.3], s: [1.6, 0.25, 0.9], r: [0, 0.4, 0.3] }), '#5d8a2c'));
  // faces on four sides
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const face = [];
    for (const sx of [-1, 1]) face.push(tf(cone(0.38, 0.5, 3), { p: [sx * 0.6, 3.85, 1.68], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.4] }));
    face.push(tf(cone(0.18, 0.3, 3), { p: [0, 3.45, 1.84], r: [Math.PI / 2, 0, 0], s: [1, 1, 0.4] }));
    const mouth = carve(sphere(0.95, 18, 8), (x, y) => y < 0 && !(Math.abs(x) < 0.12 && y > -0.35) && !(Math.abs(x - 0.45) < 0.1 && y > -0.3) && !(Math.abs(x + 0.45) < 0.1 && y > -0.3));
    face.push(tf(mouth, { p: [0, 3.1, 1.66], s: [1.2, 0.7, 0.3] }));
    for (const g of face) {
      g.rotateY(a);
      o.glow.push(col(g, '#ffd166'));
    }
  }
  o.col.push({ x: 0, z: 0, r: 4.6 });
  o.lights = [{ x: 0, y: 3.4, z: 0, c: '#ff9a3c', s: 9 }];
  return o;
}

export function noticeBoard() {
  const o = P();
  for (const sx of [-1, 1]) o.toon.push(col(tf(cyl(0.08, 0.1, 2.4, 6), { p: [sx * 1.1, 1.2, 0] }), '#4a3021'));
  o.toon.push(col(tf(roundBox(2.6, 1.5, 0.15, 0.1, 2), { p: [0, 1.6, 0] }), '#80593d', 0.08));
  o.toon.push(col(tf(cone(1.7, 0.6, 4), { p: [0, 2.65, 0], r: [0, Math.PI / 4, 0], s: [1, 1, 0.3] }), '#3a2550'));
  const papers = ['#f6e7c8', '#ffd6e0', '#d6f0ff', '#f6e7c8', '#e0ffd6'];
  papers.forEach((c, i) => o.toon.push(col(tf(box(0.45, 0.55, 0.02), { p: [-0.85 + i * 0.42, 1.6 + (i % 2) * 0.12, 0.09], r: [0, 0, (i % 3 - 1) * 0.1] }), c)));
  o.col.push({ x: 0, z: 0, r: 1.2 });
  return o;
}

export function cauldron() {
  const o = P();
  o.toon.push(col(tf(carve(sphere(0.9, 18, 12), (x, y) => y < 0.45), { p: [0, 0.85, 0] }), '#2b2236', 0.08));
  o.toon.push(col(tf(torus(0.78, 0.1, 6, 20), { p: [0, 1.28, 0], r: [Math.PI / 2, 0, 0] }), '#3a2b40'));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    o.toon.push(col(tf(cyl(0.07, 0.05, 0.5, 5), { p: [Math.cos(a) * 0.55, 0.2, Math.sin(a) * 0.55] }), '#2b2236'));
  }
  o.glow.push(col(tf(cyl(0.74, 0.74, 0.05, 20), { p: [0, 1.22, 0] }), '#7dff5c'));
  for (let i = 0; i < 5; i++) o.toon.push(col(tf(box(0.15, 0.4, 0.15), { p: [Math.cos(i) * 0.4, 0.1, Math.sin(i) * 0.4], r: [0.3, i, 1.3] }), '#5a3a22'));
  o.glow.push(col(tf(sphere(0.25, 8, 6), { p: [0, 0.2, 0], s: [1.5, 0.5, 1.5] }), '#ff8a3c'));
  o.col.push({ x: 0, z: 0, r: 1.0 });
  o.lights = [{ x: 0, y: 1.4, z: 0, c: '#7dff5c', s: 4 }];
  return o;
}

export function cottage() {
  const o = P();
  // round stone base with a tall crooked thatched hat-roof
  o.toon.push(col(tf(cyl(3.0, 3.3, 3.2, 16), { p: [0, 1.6, 0] }), (x, y, z) => (hash3(Math.round(x * 2), Math.round(y * 3), Math.round(z * 2)) > 0.5 ? '#8a7f99' : '#7a6f8a'), 0, true));
  const roof = warp(cone(4.1, 5.5, 18), (x, y, z) => {
    const t = (y + 2.75) / 5.5;
    return [x - t * t * t * 1.6, y, z + Math.sin(t * 3) * 0.2];
  });
  o.toon.push(col(tf(roof, { p: [0, 3.2 + 2.75, 0] }), (x, y) => (Math.floor(y * 2.2) % 2 ? '#6b4f8a' : '#5a3f78'), 0.1, true));
  o.toon.push(col(tf(roundBox(1.2, 2.0, 0.3, 0.3, 3), { p: [0, 1.0, 3.05] }), '#3a2550'));
  o.glow.push(col(tf(sphere(0.38, 10, 8), { p: [-1.6, 2.1, 2.55], s: [1, 1, 0.3] }), '#b6ff8f'));
  o.glow.push(col(tf(sphere(0.38, 10, 8), { p: [1.6, 2.1, 2.55], s: [1, 1, 0.3] }), '#b6ff8f'));
  o.toon.push(col(tf(box(0.5, 1.5, 0.5), { p: [1.8, 5.2, -1.0], r: [0, 0, 0.15] }), '#5a4a5a'));
  o.col.push({ x: 0, z: 0, r: 3.4 });
  o.smoke = { x: 1.95, y: 6.1, z: -1.0, c: '#a8ff9c' };
  return o;
}

export function manor() {
  const o = P();
  const wall = '#4a3f66', roof = '#2a1f3d';
  o.toon.push(col(tf(roundBox(18, 9, 7, 0.06, 3), { p: [0, 4.5, 0] }), wall, 0.08));
  for (const sx of [-1, 1]) {
    o.toon.push(col(tf(cyl(2.4, 2.6, 13, 12), { p: [sx * 9.5, 6.5, 1] }), wall, 0.08));
    o.toon.push(col(tf(warp(cone(3.1, 6, 12), (x, y, z) => [x + ((y + 3) / 6) ** 3 * sx * 0.8, y, z]), { p: [sx * 9.5, 16, 1] }), roof));
    for (let k = 0; k < 3; k++) o.glow.push(col(tf(roundBox(0.8, 1.3, 0.2, 0.4, 2), { p: [sx * 9.5, 4 + k * 3.2, 3.55] }), k === 1 ? '#9ef0ff' : '#ffc56b'));
  }
  o.toon.push(col(tf(cone(11, 5.5, 4), { p: [0, 11.6, 0], r: [0, Math.PI / 4, 0], s: [1, 1, 0.45] }), roof));
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    for (let k = 0; k < 2; k++) {
      o.toon.push(col(tf(box(1.4, 1.9, 0.2), { p: [i * 3.2, 3 + k * 3.6, 3.5] }), '#21162e'));
      o.glow.push(col(tf(box(1.15, 1.6, 0.2), { p: [i * 3.2, 3 + k * 3.6, 3.56] }), (i + k) % 3 ? '#ffc56b' : '#ff7a9c'));
    }
  }
  o.toon.push(col(tf(roundBox(3, 4.4, 0.4, 0.3, 3), { p: [0, 2.2, 3.6] }), '#2b1a1f'));
  o.glow.push(col(tf(sphere(0.9, 14, 10), { p: [0, 7.6, 3.5], s: [1, 1, 0.2] }), '#ffe08a'));
  o.toon.push(col(tf(box(5, 0.5, 2.2), { p: [0, 0.25, 4.6] }), '#5d5670'));
  o.col.push({ x: 0, z: 0, r: 0 }, ...[-8, -4, 0, 4, 8].map((x) => ({ x, z: 0.5, r: 3.8 })), { x: -9.5, z: 1, r: 2.8 }, { x: 9.5, z: 1, r: 2.8 });
  return o;
}

export function mausoleum() {
  const o = P();
  o.toon.push(col(tf(box(4, 3.2, 3.4), { p: [0, 1.6, 0] }), '#8a86a0', 0.08));
  o.toon.push(col(tf(cone(3.3, 1.6, 4), { p: [0, 4.0, 0], r: [0, Math.PI / 4, 0], s: [1, 1, 0.85] }), '#5d5670'));
  for (const sx of [-1, 1]) o.toon.push(col(tf(cyl(0.22, 0.25, 3.2, 8), { p: [sx * 1.4, 1.6, 1.85] }), '#a29dbb'));
  o.toon.push(col(tf(roundBox(1.4, 2.2, 0.1, 0.4, 2), { p: [0, 1.1, 1.72] }), '#2b2236'));
  o.glow.push(col(tf(torus(0.25, 0.04, 6, 14), { p: [0, 3.4, 1.72] }), '#b78bff'));
  o.col.push({ x: 0, z: 0, r: 2.6 });
  return o;
}

export function bellPost() {
  const o = P();
  for (const sx of [-1, 1]) o.toon.push(col(tf(cyl(0.12, 0.14, 3.4, 6), { p: [sx * 0.9, 1.7, 0] }), '#4a3021'));
  o.toon.push(col(tf(box(2.3, 0.22, 0.3), { p: [0, 3.3, 0] }), '#4a3021'));
  o.toon.push(col(tf(cone(1.5, 0.7, 4), { p: [0, 3.7, 0], r: [0, Math.PI / 4, 0], s: [1, 1, 0.5] }), '#2a1f3d'));
  o.col.push({ x: 0, z: 0, r: 1.0 });
  return o;
}

export function bell() {
  const pts = [[0, 0], [0.48, 0.02], [0.42, 0.12], [0.34, 0.4], [0.3, 0.62], [0.18, 0.72], [0, 0.74]].map(([x, y]) => new THREE.Vector2(x, y));
  return merge([col(new THREE.LatheGeometry(pts, 16), '#d4a52a', 0.06), col(tf(sphere(0.09, 8, 6), { p: [0, -0.05, 0] }), '#8a6a1a')]);
}

export function brazier() {
  const o = P();
  o.toon.push(col(tf(cyl(0.5, 0.25, 0.5, 10), { p: [0, 1.25, 0] }), '#3a2b40'));
  o.toon.push(col(tf(cyl(0.1, 0.16, 1.0, 6), { p: [0, 0.5, 0] }), '#3a2b40'));
  o.toon.push(col(tf(cyl(0.4, 0.45, 0.12, 8), { p: [0, 0.06, 0] }), '#3a2b40'));
  o.col.push({ x: 0, z: 0, r: 0.6 });
  return o;
}

export function runeStone(seed, h = 2.6) {
  const r = rnd(seed), o = P();
  o.toon.push(col(tf(roundBox(0.9, h, 0.6, 0.3, 3), { p: [0, h / 2 - 0.1, 0], r: [(r() - 0.5) * 0.15, r() * 3, (r() - 0.5) * 0.15] }), '#6d6884', 0.12));
  o.glow.push(col(tf(torus(0.18, 0.03, 4, 12), { p: [0, h * 0.62, 0.31] }), '#b78bff'));
  o.col.push({ x: 0, z: 0, r: 0.6 });
  return o;
}

export function carvingTable() {
  const o = P();
  o.toon.push(col(tf(box(2.6, 0.14, 1.3), { p: [0, 0.95, 0] }), '#80593d', 0.08));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) o.toon.push(col(tf(box(0.12, 0.9, 0.12), { p: [sx * 1.1, 0.45, sz * 0.5] }), '#4a3021'));
  o.toon.push(...pumpkin(5, 0.7).toon.map((g) => tf(g, { p: [-0.6, 1.02, 0] })));
  o.toon.push(col(tf(box(0.5, 0.03, 0.08), { p: [0.6, 1.04, 0.2], r: [0, 0.5, 0] }), '#c9c9d9'));
  o.toon.push(col(tf(box(0.12, 0.05, 0.1), { p: [0.35, 1.05, 0.06], r: [0, 0.5, 0] }), '#4a3021'));
  o.toon.push(col(tf(sphere(0.3, 10, 6), { p: [0.7, 1.04, -0.25], s: [1, 0.3, 1] }), '#f6c38b'));
  o.col.push({ x: 0, z: 0, r: 1.3 });
  return o;
}

export function pedestal() {
  const o = P();
  o.toon.push(col(tf(cyl(0.45, 0.55, 0.8, 8), { p: [0, 0.4, 0] }), '#6d6884', 0.08));
  o.toon.push(col(tf(cyl(0.55, 0.55, 0.1, 8), { p: [0, 0.82, 0] }), '#8a86a0'));
  o.col.push({ x: 0, z: 0, r: 0.6 });
  return o;
}

export function djBooth() {
  const o = P();
  o.toon.push(col(tf(roundBox(3.2, 1.2, 1.2, 0.15, 2), { p: [0, 0.6, 0] }), '#2b2236', 0.06));
  o.glow.push(col(tf(box(3.0, 0.12, 0.05), { p: [0, 0.9, 0.62] }), '#ff4f8b'));
  o.glow.push(col(tf(box(3.0, 0.12, 0.05), { p: [0, 0.4, 0.62] }), '#2ec4b6'));
  for (const sx of [-1, 1]) {
    o.toon.push(col(tf(cyl(0.35, 0.35, 0.06, 16), { p: [sx * 0.8, 1.23, 0] }), '#111'));
    o.toon.push(col(tf(roundBox(1.1, 2.4, 1.0, 0.15, 2), { p: [sx * 2.6, 1.2, 0] }), '#3a2b40', 0.06));
    for (const y of [0.7, 1.7]) o.toon.push(col(tf(cyl(0.35, 0.35, 0.08, 14), { p: [sx * 2.6, y, 0.52], r: [Math.PI / 2, 0, 0] }), '#14101a'));
  }
  o.col.push({ x: 0, z: 0, r: 1.8 }, { x: -2.6, z: 0, r: 0.8 }, { x: 2.6, z: 0, r: 0.8 });
  return o;
}

export function dock() {
  const o = P();
  o.toon.push(col(tf(box(2, 0.15, 7), { p: [0, 0.35, 0] }), (x, y, z) => (Math.floor((z + 3.5) * 2) % 2 ? '#80593d' : '#6b4a33'), 0, true));
  for (const z of [-3, -1, 1, 3]) for (const sx of [-1, 1]) o.toon.push(col(tf(cyl(0.1, 0.1, 1.4, 6), { p: [sx * 0.95, 0, z] }), '#4a3021'));
  return o;
}

export function bankBooth() {
  const o = P();
  // Count Snackula's candy bank: a gothic booth with a coffin counter and a candy hoard
  o.toon.push(col(tf(roundBox(3.6, 3.4, 2, 0.1, 2), { p: [0, 1.7, -1.1] }), '#3b1f3f', 0.06));
  o.toon.push(col(tf(cone(2.6, 2.2, 4), { p: [0, 4.4, -1.1], r: [0, Math.PI / 4, 0], s: [1, 1, 0.6] }), '#1b0f24'));
  o.toon.push(col(tf(warp(box(2.8, 1.0, 0.9), (x, y, z) => [x * (1 - Math.abs(x) * 0.08), y, z]), { p: [0, 0.5, 0.6] }), '#5a2a3a', 0.06));
  o.glow.push(col(tf(roundBox(1.4, 1.3, 0.1, 0.5, 2), { p: [0, 2.4, -0.08] }), '#ff4f6b'));
  for (let i = 0; i < 18; i++) {
    const a = i * 2.3, rr = (i % 5) * 0.12;
    o.toon.push(col(tf(sphere(0.12, 6, 4), { p: [Math.cos(a) * rr - 1.0, 1.1 + (4 - (i % 5)) * 0.08, 0.6 + Math.sin(a) * rr * 0.5], s: [1.3, 0.8, 0.8] }), ['#ff4f8b', '#ffd23f', '#2ec4b6', '#7b4dff', '#ff7a1a'][i % 5]));
  }
  o.col.push({ x: 0, z: -0.6, r: 1.9 });
  return o;
}

export function lanternBoat(seed) {
  const o = P();
  o.toon.push(col(tf(roundBox(1.0, 0.3, 0.6, 0.4, 3), { p: [0, 0.1, 0] }), '#80593d'));
  o.glow.push(col(tf(roundBox(0.3, 0.38, 0.3, 0.3, 2), { p: [0, 0.45, 0] }), ['#ffb347', '#ff7a9c', '#9ef0ff'][seed % 3]));
  return o;
}

export function scarecrowPost() {
  const o = P();
  o.toon.push(col(tf(cyl(0.08, 0.1, 2.2, 6), { p: [0, 1.1, -0.15] }), '#5a3a22'));
  return o;
}

export function signpost(labels) {
  const o = P();
  o.toon.push(col(tf(cyl(0.08, 0.1, 2.4, 6), { p: [0, 1.2, 0] }), '#4a3021'));
  labels.forEach((l, i) => o.toon.push(col(tf(box(1.3, 0.3, 0.08), { p: [0.4 * Math.cos(l.a), 2.0 - i * 0.38, 0.4 * Math.sin(-l.a)], r: [0, l.a, 0] }), '#80593d')));
  o.col.push({ x: 0, z: 0, r: 0.25 });
  return o;
}

// The photo booth: a striped tent with a curtain, a big old camera on a tripod and a glowing flash bulb on top.
export function photoBooth() {
  const o = P();
  // tent body (open at the front) and a peaked roof
  o.toon.push(col(tf(new THREE.CylinderGeometry(1.5, 1.6, 2.5, 8, 1, true, Math.PI * 0.2, Math.PI * 1.6), { p: [0, 1.25, -0.6] }), (x) => (Math.floor((Math.atan2(x, 1) + 3) * 3) % 2 ? '#7b4dff' : '#ff7a1a'), 0, true));
  o.toon.push(col(tf(cone(1.85, 1.3, 8), { p: [0, 3.15, -0.6] }), '#5a2fd0'));
  o.toon.push(col(tf(sphere(0.18, 10, 8), { p: [0, 3.85, -0.6] }), '#ffd23f'));
  // curtain halves tied back
  for (const sx of [-1, 1]) o.toon.push(col(tf(box(0.55, 2.2, 0.08), { p: [sx * 0.72, 1.2, 0.72], r: [0, sx * 0.25, sx * 0.04] }), '#b5172e'));
  // stool inside
  o.toon.push(col(tf(cyl(0.3, 0.3, 0.12, 12), { p: [0, 0.62, -0.7] }), '#80593d'));
  o.toon.push(col(tf(cyl(0.06, 0.06, 0.6, 6), { p: [0, 0.3, -0.7] }), '#4a3021'));
  // camera on a tripod in front of the tent, looking in
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    o.toon.push(col(tf(cyl(0.035, 0.035, 1.5, 5), { p: [Math.sin(a) * 0.22, 0.7, 2.1 + Math.cos(a) * 0.22], r: [Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18] }), '#3a2b40'));
  }
  o.toon.push(col(tf(roundBox(0.7, 0.5, 0.45, 0.06, 2), { p: [0, 1.6, 2.1] }), '#2b2236'));
  o.toon.push(col(tf(cyl(0.16, 0.2, 0.3, 14), { p: [0, 1.6, 1.78], r: [Math.PI / 2, 0, 0] }), '#4a4050'));
  o.glow.push(col(tf(cyl(0.12, 0.12, 0.02, 14), { p: [0, 1.6, 1.62], r: [Math.PI / 2, 0, 0] }), '#9ef0ff'));
  o.glow.push(col(tf(sphere(0.16, 10, 8), { p: [0.25, 2.0, 2.1] }), '#fff4c2'));
  // sign board above the opening
  o.toon.push(col(tf(roundBox(2.2, 0.55, 0.1, 0.1, 2), { p: [0, 2.75, 0.85] }), '#ff4f8b'));
  o.glow.push(col(tf(roundBox(1.9, 0.32, 0.04, 0.1, 2), { p: [0, 2.75, 0.92] }), '#fff4e3'));
  o.lights = [{ x: 0.25, y: 2.0, z: 2.1, c: '#fff4c2', s: 1.6 }, { x: 0, y: 3.85, z: -0.6, c: '#ffd23f', s: 1.2 }];
  o.col.push({ x: 0, z: -0.6, r: 1.6 }, { x: 0, z: 2.1, r: 0.35 });
  return o;
}

export { ribbed, tube };
