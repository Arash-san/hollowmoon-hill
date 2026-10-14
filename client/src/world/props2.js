// More detailed town props (v2 world): three house types, landmarks and lots of small set dressing.
// Same contract as props.js: { toon: [geos], glow: [geos], col: [{x,z,r}], lights?, smoke? } in local space,
// with +z the front. world.js places and merges them per area.
import { THREE, col, tf, sphere, cyl, cone, box, torus, capsule, warp, roundBox, hash3 } from '../engine/toon.js';
import { P } from './props.js';

const rnd = (seed) => {
  let s = Math.floor(Math.abs(seed) * 9301 + 49297) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
};
const darker = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
const lighter = (hex, f) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), f).getHexString();
const pick = (r, list) => list[Math.floor(r() * list.length)];

const WALLS = ['#7c5f8f', '#5f7a8f', '#8f6a5f', '#6f8a6a', '#8a7a5a', '#94707a', '#6a6f94'];
const ROOFS = ['#3a2550', '#4a2a2a', '#2a3a4a', '#5a2a3a', '#2f3a2a', '#4a3020'];
const TRIM = '#3a2738';
const GLASS = ['#ffc56b', '#ffb347', '#ffd98a', '#9ef0ff'];

// a gabled roof over w x d, ridge along x; returns geos
function gableRoof(o, w, d, h0, rise, color, r, { overhang = 0.35, shingles = true } = {}) {
  const half = d / 2 + overhang;
  const slope = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  for (const sz of [-1, 1]) {
    const g = tf(box(w + overhang * 2, 0.14, slope), { p: [0, h0 + rise / 2, (sz * half) / 2], r: [sz * ang, 0, 0] });
    o.toon.push(col(g, color, 0.06));
    if (shingles) {
      // rows of shingles: thin strips that stick out a little, alternating shade
      const rows = Math.max(3, Math.round(slope / 0.42));
      for (let i = 1; i < rows; i++) {
        const t = i / rows;
        const y = h0 + rise * (1 - t) + 0.08, z = sz * half * t;
        o.toon.push(col(tf(box(w + overhang * 2 + 0.02, 0.06, 0.12), { p: [0, y, z], r: [sz * ang, 0, 0] }), i % 2 ? darker(color, 0.8) : lighter(color, 0.08)));
      }
    }
  }
  // ridge beam with a little crooked finial
  o.toon.push(col(tf(cyl(0.1, 0.1, w + overhang * 2 + 0.1, 6), { p: [0, h0 + rise + 0.06, 0], r: [0, 0, Math.PI / 2] }), darker(color, 0.65)));
  o.toon.push(col(tf(cone(0.09, 0.45, 5), { p: [w / 2 + overhang - 0.05, h0 + rise + 0.3, 0], r: [0, 0, -0.25] }), TRIM));
  // gable ends (triangles) in the wall colour
  const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise)]);
  for (const sx of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false });
    o.toon.push(col(tf(g, { p: [sx * (w / 2) - (sx > 0 ? 0.12 : 0), h0, 0], r: [0, Math.PI / 2, 0] }), r));
  }
}

function windowUnit(o, x, y, z, rot, seed, { w = 0.7, h = 0.8, shutters = true, box: flowerBox = true } = {}) {
  const r = rnd(seed);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1));
  const push = (g, c, glow = false) => (glow ? o.glow : o.toon).push(col(g.applyMatrix4(m), c));
  push(tf(box(w + 0.16, h + 0.16, 0.08), { p: [0, 0, 0.02] }), TRIM);
  push(tf(box(w, h, 0.06), { p: [0, 0, 0.05] }), r() < 0.82 ? pick(r, GLASS) : '#4a3a60', true);
  push(tf(box(0.05, h, 0.05), { p: [0, 0, 0.1] }), TRIM);
  push(tf(box(w, 0.05, 0.05), { p: [0, 0, 0.1] }), TRIM);
  push(tf(box(w + 0.3, 0.07, 0.18), { p: [0, -h / 2 - 0.08, 0.1] }), '#5d4a3a');
  if (shutters) {
    const sc = pick(r, ['#2f5a4a', '#5a2f3a', '#2f3a5a', '#5a4a2f']);
    for (const sx of [-1, 1]) {
      push(tf(box(w * 0.42, h + 0.1, 0.04), { p: [sx * (w / 2 + w * 0.24), 0, 0.06], r: [0, sx * 0.25, 0] }), sc);
      push(tf(box(w * 0.3, 0.03, 0.03), { p: [sx * (w / 2 + w * 0.24), h * 0.2, 0.09], r: [0, sx * 0.25, 0] }), darker(sc, 0.6));
    }
  }
  if (flowerBox) {
    push(tf(box(w + 0.1, 0.16, 0.2), { p: [0, -h / 2 - 0.2, 0.16] }), '#6b4a33');
    for (let i = 0; i < 5; i++) push(tf(sphere(0.07, 6, 4), { p: [-w / 2 + 0.08 + i * (w - 0.16) / 4, -h / 2 - 0.08, 0.2] }), pick(r, ['#ff8fb8', '#ffd23f', '#b78bff', '#ff7a1a', '#9ef0ff']));
  }
}

function door(o, x, z, rot, seed, { w = 0.95, h = 1.6, porch = true } = {}) {
  const r = rnd(seed);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1));
  const push = (g, c, glow = false) => (glow ? o.glow : o.toon).push(col(g.applyMatrix4(m), c));
  const dc = pick(r, ['#4a3021', '#5a2a3a', '#2a3a5a', '#3a4a2a']);
  push(tf(box(w + 0.22, h + 0.14, 0.1), { p: [0, h / 2 + 0.2, 0.02] }), TRIM);
  // planked door with an arched top
  push(tf(box(w, h - w / 2, 0.08), { p: [0, (h - w / 2) / 2 + 0.2, 0.06] }), dc);
  push(tf(new THREE.CylinderGeometry(w / 2, w / 2, 0.08, 14, 1, false, -Math.PI / 2, Math.PI), { p: [0, h - w / 2 + 0.2, 0.06], r: [Math.PI / 2, 0, 0] }), dc);
  for (let i = -1; i <= 1; i++) push(tf(box(0.02, h - 0.2, 0.02), { p: [i * w * 0.3, h / 2 + 0.1, 0.11] }), darker(dc, 0.7));
  push(tf(torus(0.06, 0.015, 4, 10), { p: [0, h * 0.62, 0.13] }), '#e0b33a');
  push(tf(sphere(0.045, 6, 4), { p: [w * 0.33, h * 0.5, 0.13] }), '#e0b33a');
  // steps
  push(tf(box(w + 0.6, 0.12, 0.45), { p: [0, 0.06, 0.28] }), '#6d6884');
  push(tf(box(w + 0.3, 0.12, 0.3), { p: [0, 0.16, 0.18] }), '#7d7894');
  if (porch) {
    for (const sx of [-1, 1]) push(tf(cyl(0.06, 0.07, h + 0.5, 6), { p: [sx * (w / 2 + 0.45), (h + 0.5) / 2, 0.85] }), '#4a3021');
    push(tf(box(w + 1.3, 0.1, 1.1), { p: [0, h + 0.55, 0.45], r: [0.28, 0, 0] }), darker(pick(r, ROOFS), 0.9));
    // a lantern by the door
    push(tf(box(0.16, 0.24, 0.16), { p: [w / 2 + 0.3, h * 0.85, 0.2] }), '#2b2236');
    push(tf(box(0.1, 0.16, 0.1), { p: [w / 2 + 0.3, h * 0.85, 0.2] }), '#ffcf6a', true);
  }
}

// ---------------------------------------------------------------- houses
// style: 'cottage' (gabled, porch), 'town' (two storeys with an overhanging upper floor), 'tower' (round stone house)
export function houseV2(seed, style = null) {
  const r = rnd(seed), o = P();
  style ||= pick(r, ['cottage', 'cottage', 'town', 'tower']);
  const wall = pick(r, WALLS), roof = pick(r, ROOFS);
  o.lights = [];
  if (style === 'tower') {
    const R = 1.9 + r() * 0.4, h = 4.6 + r() * 1.2;
    o.toon.push(col(tf(cyl(R + 0.15, R + 0.25, 0.6, 18), { p: [0, 0.3, 0] }), '#6d6884', 0.08));
    o.toon.push(col(warp(cyl(R, R * 1.03, h, 20, true), (x, y, z) => [x, y + h / 2 + 0.3, z]), (x, y) => {
      const n = hash3(Math.round(Math.atan2(x, 1) * 6 + Math.floor(y * 3) * 0.5), Math.floor(y * 3), 1);
      return n > 0.6 ? '#857e98' : n > 0.3 ? '#77708c' : '#6c6580';
    }, 0.06, true));
    o.toon.push(col(tf(cyl(R, R, 0.1, 20), { p: [0, h + 0.28, 0] }), '#5d5670'));
    const roofG = warp(cone(R + 0.55, 3.2 + r() * 1.2, 18), (x, y, z) => [x + (y + 1.8) ** 2 * 0.04, y, z]);
    o.toon.push(col(tf(roofG, { p: [0, h + 0.3 + 1.7, 0] }), roof, 0.08));
    o.toon.push(col(tf(cone(0.08, 0.6, 5), { p: [0.15, h + 3.9, 0], r: [0, 0, -0.3] }), TRIM));
    door(o, 0, R - 0.05, 0, seed + 3, { porch: false });
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.9;
      windowUnit(o, Math.sin(a) * (R + 0.02), 2.4 + (i % 2) * 1.4, Math.cos(a) * (R + 0.02), a, seed + 10 + i, { w: 0.5, h: 0.65, shutters: false, box: i === 1 });
    }
    o.col.push({ x: 0, z: 0, r: R + 0.3 });
    o.smoke = null;
    return o;
  }
  const town = style === 'town';
  const w = (town ? 3.4 : 4.2) + r() * 1.0, d = 3.4 + r() * 0.8, h = town ? 2.4 : 2.7 + r() * 0.4;
  const tilt = (r() - 0.5) * 0.05;
  // stone foundation
  o.toon.push(col(tf(roundBox(w + 0.25, 0.55, d + 0.25, 0.08, 2), { p: [0, 0.27, 0] }), '#6d6884', 0.1));
  // ground floor walls with vertical boards
  const walls = (y0, hh, ww, dd, c) => col(tf(new THREE.BoxGeometry(ww, hh, dd, Math.ceil(ww * 4), 2, Math.ceil(dd * 4)), { p: [0, y0 + hh / 2, 0], r: [0, 0, tilt] }), (x) => {
    const k = Math.floor((x + 10) * 3.2);
    return k % 3 === 0 ? darker(c, 0.88) : k % 3 === 1 ? c : lighter(c, 0.05);
  }, 0.04, true);
  o.toon.push(walls(0.5, h, w, d, wall));
  // corner posts and a beam (timber frame)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) o.toon.push(col(tf(box(0.18, h + 0.1, 0.18), { p: [sx * (w / 2 - 0.02), 0.5 + h / 2, sz * (d / 2 - 0.02)] }), TRIM));
  o.toon.push(col(tf(box(w + 0.1, 0.16, d + 0.1), { p: [0, 0.5 + h, 0] }), TRIM));
  let top = 0.5 + h;
  if (town) {
    // the upper floor sticks out over the street, with crossed timber beams
    const w2 = w + 0.5, d2 = d + 0.5, h2 = 2.2;
    o.toon.push(walls(top + 0.05, h2, w2, d2, lighter(wall, 0.15)));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) o.toon.push(col(tf(box(0.16, h2, 0.16), { p: [sx * (w2 / 2), top + 0.05 + h2 / 2, sz * (d2 / 2)] }), TRIM));
    for (const sx of [-1, 1]) o.toon.push(col(tf(box(0.1, h2 * 1.1, 0.06), { p: [sx * w2 * 0.27, top + h2 / 2, d2 / 2 + 0.03], r: [0, 0, sx * 0.55] }), TRIM));
    for (let i = 0; i < 2; i++) windowUnit(o, (i ? 1 : -1) * w2 * 0.27, top + h2 * 0.55, d2 / 2 + 0.02, 0, seed + 30 + i, { w: 0.6, h: 0.7 });
    windowUnit(o, w2 / 2 + 0.02, top + h2 * 0.55, 0, Math.PI / 2, seed + 34, { w: 0.6, h: 0.7, box: false });
    for (let i = 0; i < 4; i++) o.toon.push(col(tf(cone(0.09, 0.3, 4), { p: [-w2 / 2 + 0.3 + i * (w2 - 0.6) / 3, top - 0.08, d2 / 2 - 0.05], r: [Math.PI, 0, 0] }), TRIM));
    top += h2 + 0.05;
    gableRoof(o, w2, d2, top, 2.0 + r() * 0.6, roof, lighter(wall, 0.15));
  } else {
    gableRoof(o, w, d, top, 1.7 + r() * 0.8, roof, wall);
    // a dormer window in the roof
    if (r() < 0.6) {
      const dz = d / 4;
      o.toon.push(col(tf(box(0.9, 0.8, 0.8), { p: [0.3, top + 0.5, dz] }), wall));
      o.toon.push(col(tf(cone(0.75, 0.6, 4), { p: [0.3, top + 1.15, dz], r: [0, Math.PI / 4, 0], s: [0.85, 1, 0.85] }), roof));
      windowUnit(o, 0.3, top + 0.5, dz + 0.41, 0, seed + 40, { w: 0.45, h: 0.45, shutters: false, box: false });
    }
  }
  // round attic window glowing in the gable
  o.glow.push(col(tf(cyl(0.22, 0.22, 0.06, 14), { p: [w / 2 + (town ? 0.25 : 0) + 0.08, top + 0.55, 0], r: [0, 0, Math.PI / 2] }), pick(r, GLASS)));
  // chimney with a cap, smoking
  const cx = -w * 0.28, cz = -d * 0.15;
  o.toon.push(col(tf(box(0.55, 2.0, 0.55), { p: [cx, top + 0.8, cz] }), (x, y) => (Math.floor(y * 4) % 2 ? '#6b5a5a' : '#5a4a4a'), 0.04, true));
  o.toon.push(col(tf(box(0.7, 0.14, 0.7), { p: [cx, top + 1.85, cz] }), '#4a3a3a'));
  o.smoke = { x: cx, y: top + 2.1, z: cz };
  // ground floor: door with porch, windows with shutters and flower boxes
  door(o, town ? 0 : -w * 0.12, d / 2, 0, seed + 5, { porch: !town });
  const wx = town ? w * 0.32 : w * 0.3;
  windowUnit(o, wx, 0.5 + h * 0.55, d / 2 + 0.02, 0, seed + 20);
  if (!town) windowUnit(o, -w * 0.12 - 1.3, 0.5 + h * 0.55, d / 2 + 0.02, 0, seed + 21, { w: 0.55, h: 0.7 });
  windowUnit(o, w / 2 + 0.02, 0.5 + h * 0.55, d * 0.1, Math.PI / 2, seed + 22);
  windowUnit(o, -w / 2 - 0.02, 0.5 + h * 0.55, -d * 0.1, -Math.PI / 2, seed + 23, { box: false });
  // little garden: a pumpkin and a barrel or crates
  o.toon.push(col(tf(sphere(0.32, 10, 8), { p: [w * 0.38, 0.28, d / 2 + 0.75], s: [1.1, 0.8, 1.1] }), '#ff7a1a'));
  o.glow.push(col(tf(box(0.16, 0.06, 0.02), { p: [w * 0.38, 0.3, d / 2 + 1.07] }), '#ffd166'));
  if (r() < 0.5) o.toon.push(col(warp(cyl(0.3, 0.3, 0.75, 10), (x, y, z) => [x * (1 + 0.1 * Math.cos(y * 4)) - w / 2 - 0.45, y + 0.38, z * (1 + 0.1 * Math.cos(y * 4)) + d * 0.2]), '#7a5236', 0.1));
  else for (let i = 0; i < 2; i++) o.toon.push(col(tf(box(0.6, 0.6, 0.6), { p: [-w / 2 - 0.5, 0.3 + i * 0.6, -d * 0.2 + i * 0.08], r: [0, i * 0.4, 0] }), '#8a6440', 0.1));
  o.lights.push({ x: w * 0.38, y: 0.5, z: d / 2 + 0.8, c: '#ffa94a', s: 1.4 });
  o.col.push({ x: 0, z: 0, r: Math.max(w, d) * 0.62 });
  return o;
}

// ---------------------------------------------------------------- landmarks
// The windmill body; its sails are a separate mesh so world.js can spin them (see `sails`).
export function windmill() {
  const o = P();
  o.toon.push(col(tf(cyl(1.2, 2.1, 6.5, 8), { p: [0, 3.25, 0] }), (x, y) => (Math.floor(y * 1.5) % 2 ? '#d9c9a8' : '#cdbb98'), 0.06, true));
  o.toon.push(col(tf(cone(1.7, 2.2, 8), { p: [0, 7.6, 0] }), '#5a2a3a', 0.08));
  o.toon.push(col(tf(box(1.1, 1.8, 0.1), { p: [0, 0.9, 2.0], r: [-0.17, 0, 0] }), '#4a3021'));
  for (let i = 0; i < 3; i++) o.glow.push(col(tf(box(0.4, 0.5, 0.06), { p: [0, 2.4 + i * 1.5, 1.95 - i * 0.27], r: [-0.17, 0, 0] }), '#ffc56b'));
  o.toon.push(col(tf(cyl(0.22, 0.22, 0.8, 8), { p: [0, 6.2, 1.5], r: [Math.PI / 2, 0, 0] }), '#3a2b40'));
  o.col.push({ x: 0, z: 0, r: 2.2 });
  o.lights = [{ x: 0, y: 2.4, z: 2.2, c: '#ffc56b', s: 2.4 }];
  return o;
}
export function sails() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    parts.push(col(tf(box(0.16, 4.2, 0.08), { p: [Math.sin(a) * 2.1, Math.cos(a) * 2.1, 0], r: [0, 0, -a] }), '#4a3021'));
    parts.push(col(tf(box(0.9, 3.4, 0.04), { p: [Math.sin(a) * 2.3 + Math.cos(a) * 0.5, Math.cos(a) * 2.3 - Math.sin(a) * 0.5, -0.04], r: [0, 0, -a] }), (x, y) => (Math.floor((x + y) * 3) % 2 ? '#e9dfc8' : '#d6c8ab'), 0, true));
  }
  parts.push(col(sphere(0.3, 8, 6), '#3a2b40'));
  return parts;
}

export function watchtower() {
  const o = P();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) o.toon.push(col(tf(cyl(0.16, 0.22, 7, 6), { p: [sx * 1.3, 3.5, sz * 1.3], r: [sz * 0.06, 0, -sx * 0.06] }), '#5a4030'));
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    o.toon.push(col(tf(box(0.12, 0.12, 3.2), { p: [s * 1.25, 1.2 + i * 2, 0], r: [0.7 * (i % 2 ? 1 : -1), 0, 0] }), '#4a3021'));
    o.toon.push(col(tf(box(3.2, 0.12, 0.12), { p: [0, 1.2 + i * 2, s * 1.25], r: [0, 0, 0.7 * (i % 2 ? 1 : -1)] }), '#4a3021'));
  }
  o.toon.push(col(tf(box(3.6, 0.2, 3.6), { p: [0, 7, 0] }), '#6b4a33'));
  for (const sx of [-1, 1]) {
    o.toon.push(col(tf(box(3.6, 0.8, 0.12), { p: [0, 7.5, sx * 1.75] }), '#80593d'));
    o.toon.push(col(tf(box(0.12, 0.8, 3.6), { p: [sx * 1.75, 7.5, 0] }), '#80593d'));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) o.toon.push(col(tf(cyl(0.08, 0.08, 1.8, 5), { p: [sx * 1.7, 8.8, sz * 1.7] }), '#5a4030'));
  o.toon.push(col(tf(cone(2.8, 1.8, 4), { p: [0, 10.4, 0], r: [0, Math.PI / 4, 0] }), '#3a2550', 0.08));
  o.glow.push(col(tf(box(0.4, 0.5, 0.4), { p: [0, 8.2, 0] }), '#ffcf6a'));
  // ladder
  for (let i = 0; i < 12; i++) o.toon.push(col(tf(box(0.7, 0.06, 0.06), { p: [0, 0.4 + i * 0.55, 1.45] }), '#80593d'));
  for (const sx of [-1, 1]) o.toon.push(col(tf(box(0.06, 7, 0.06), { p: [sx * 0.35, 3.5, 1.45] }), '#6b4a33'));
  o.lights = [{ x: 0, y: 8.2, z: 0, c: '#ffcf6a', s: 4 }];
  o.col.push({ x: 0, z: 0, r: 2 });
  return o;
}

export function chapel() {
  const o = P();
  o.toon.push(col(tf(roundBox(4.4, 0.5, 6.4, 0.08, 2), { p: [0, 0.25, 0] }), '#6d6884', 0.1));
  o.toon.push(col(tf(box(4, 3.4, 6), { p: [0, 2.2, 0] }), (x, y) => (Math.floor(y * 2.5 + Math.floor(x * 1.2) * 0.5) % 2 ? '#8d86a0' : '#7f7894'), 0.05, true));
  const half = 2.3, rise = 2.4, slope = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  for (const sx of [-1, 1]) o.toon.push(col(tf(box(0.14, slope, 6.6), { p: [(sx * half) / 2, 3.9 + rise / 2, 0], r: [0, 0, -sx * (Math.PI / 2 - ang)] }), '#3a2550', 0.06));
  const tri = new THREE.Shape([new THREE.Vector2(-2, 0), new THREE.Vector2(2, 0), new THREE.Vector2(0, rise)]);
  for (const sz of [-1, 1]) o.toon.push(col(tf(new THREE.ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: false }), { p: [0, 3.9, sz * 3 - (sz > 0 ? 0.1 : 0)] }), '#8d86a0'));
  // bell tower with a pointed spire and a cross
  o.toon.push(col(tf(box(1.6, 3.2, 1.6), { p: [0, 5.6, 2.4] }), '#857e98'));
  o.glow.push(col(tf(box(0.7, 1.0, 1.7), { p: [0, 6.4, 2.4] }), '#ffcf6a'));
  o.toon.push(col(tf(cone(1.25, 3.4, 4), { p: [0, 8.9, 2.4], r: [0, Math.PI / 4, 0] }), '#3a2550', 0.06));
  o.toon.push(col(tf(box(0.1, 0.8, 0.1), { p: [0, 10.9, 2.4] }), '#e0b33a'));
  o.toon.push(col(tf(box(0.5, 0.1, 0.1), { p: [0, 11.0, 2.4] }), '#e0b33a'));
  // arched door and stained glass windows
  door(o, 0, 3.02, 0, 77, { w: 1.2, h: 2.1, porch: false });
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
    o.glow.push(col(tf(box(0.08, 1.2, 0.6), { p: [sx * 2.02, 2.4, -1.4 + i * 2] }), ['#ff7a9c', '#9ef0ff', '#ffd23f', '#b78bff'][i + (sx > 0 ? 2 : 0)]));
    o.toon.push(col(tf(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10, 1, false, -Math.PI / 2, Math.PI), { p: [sx * 2.03, 3.0, -1.4 + i * 2], r: [0, 0, Math.PI / 2], s: [1, 1, 1] }), TRIM));
  }
  o.lights = [{ x: 0, y: 6.4, z: 2.4, c: '#ffcf6a', s: 3 }, { x: 0, y: 2, z: 3.3, c: '#ffb347', s: 2 }];
  o.col.push({ x: 0, z: 0, r: 2.6 }, { x: 0, z: 2.4, r: 1.3 });
  return o;
}

// ---------------------------------------------------------------- set dressing
export function bush(seed, s = 1) {
  const r = rnd(seed), o = P();
  const c = pick(r, ['#2f5a3c', '#36603f', '#294f37', '#3d6b45']);
  for (let i = 0; i < 4; i++) o.toon.push(col(tf(sphere(0.45 + r() * 0.25, 8, 6), { p: [(r() - 0.5) * 0.9 * s, 0.35 * s, (r() - 0.5) * 0.9 * s], s: [s, s * 0.8, s] }), i % 2 ? c : darker(c, 0.85), 0.1));
  if (r() < 0.35) for (let i = 0; i < 4; i++) o.toon.push(col(tf(sphere(0.06, 5, 4), { p: [(r() - 0.5) * s, 0.7 * s, (r() - 0.5) * s] }), '#ff4f6b'));
  o.col.push({ x: 0, z: 0, r: 0.6 * s });
  return o;
}

export function flowers(seed) {
  const r = rnd(seed), o = P();
  for (let i = 0; i < 9; i++) {
    const x = (r() - 0.5) * 1.6, z = (r() - 0.5) * 1.6, h = 0.25 + r() * 0.25;
    o.toon.push(col(tf(cyl(0.012, 0.012, h, 3), { p: [x, h / 2, z] }), '#4f7a2c'));
    o.toon.push(col(tf(sphere(0.07, 6, 4), { p: [x, h, z], s: [1, 0.6, 1] }), pick(r, ['#ff8fb8', '#ffd23f', '#b78bff', '#ff7a1a', '#ffffff', '#9ef0ff'])));
  }
  return o;
}

export function log(seed) {
  const r = rnd(seed), o = P();
  const L = 2 + r() * 1.5;
  o.toon.push(col(tf(cyl(0.3, 0.34, L, 10), { p: [0, 0.3, 0], r: [0, 0, Math.PI / 2] }), '#5a4030', 0.1));
  for (const sx of [-1, 1]) o.toon.push(col(tf(cyl(0.27, 0.27, 0.02, 10), { p: [sx * L / 2, 0.3, 0], r: [0, 0, Math.PI / 2] }), '#b08a5a'));
  o.toon.push(col(tf(sphere(0.12, 6, 4), { p: [0.3, 0.6, 0.05] }), '#e04a5a'));
  o.toon.push(col(tf(cyl(0.03, 0.03, 0.12, 4), { p: [0.3, 0.52, 0.05] }), '#f1e3c2'));
  o.col.push({ x: 0, z: 0, r: L * 0.35 });
  return o;
}

export function well() {
  const o = P();
  o.toon.push(col(warp(cyl(0.9, 0.95, 0.9, 14, true), (x, y, z) => [x, y + 0.45, z]), (x, y) => (Math.floor(y * 5 + Math.floor(Math.atan2(x, 0.1) * 3) * 0.5) % 2 ? '#857e98' : '#77708c'), 0.05, true));
  o.toon.push(col(tf(cyl(0.88, 0.88, 0.05, 14), { p: [0, 0.6, 0] }), '#15204a'));
  for (const sx of [-1, 1]) o.toon.push(col(tf(box(0.14, 1.6, 0.14), { p: [sx * 0.8, 1.6, 0] }), '#4a3021'));
  o.toon.push(col(tf(cone(1.3, 0.9, 4), { p: [0, 2.7, 0], r: [0, Math.PI / 4, 0], s: [1, 1, 0.75] }), '#5a2a3a', 0.08));
  o.toon.push(col(tf(cyl(0.06, 0.06, 1.7, 6), { p: [0, 2.1, 0], r: [0, 0, Math.PI / 2] }), '#3a2b40'));
  o.toon.push(col(tf(cyl(0.18, 0.15, 0.3, 8), { p: [0, 1.4, 0] }), '#7a5236'));
  o.col.push({ x: 0, z: 0, r: 1 });
  return o;
}

export function cart(seed) {
  const r = rnd(seed), o = P();
  o.toon.push(col(tf(box(2, 0.5, 1.2), { p: [0, 0.8, 0] }), '#7a5236', 0.08));
  for (const sx of [-1, 1]) {
    o.toon.push(col(tf(torus(0.45, 0.07, 6, 14), { p: [sx * 0.55, 0.45, 0.65], r: [0, 0, 0] }), '#4a3021'));
    o.toon.push(col(tf(torus(0.45, 0.07, 6, 14), { p: [sx * 0.55, 0.45, -0.65] }), '#4a3021'));
  }
  o.toon.push(col(tf(box(0.08, 0.08, 1.6), { p: [1.4, 0.7, 0], r: [0, 0, 0.3] }), '#4a3021'));
  for (let i = 0; i < 5; i++) o.toon.push(col(tf(sphere(0.25, 8, 6), { p: [(r() - 0.5) * 1.4, 1.15, (r() - 0.5) * 0.7], s: [1, 0.8, 1] }), '#ff7a1a'));
  o.col.push({ x: 0, z: 0, r: 1.2 });
  return o;
}

export function pumpkinPile(seed) {
  const r = rnd(seed), o = P();
  for (let i = 0; i < 6; i++) {
    const s = 0.22 + r() * 0.2, x = (r() - 0.5) * 1.2, z = (r() - 0.5) * 1.2;
    o.toon.push(col(warp(sphere(s, 10, 8), (px, py, pz) => {
      const k = 1 + Math.cos(Math.atan2(px, pz) * 8) * 0.07;
      return [px * k + x, py * 0.8 + s * 0.8 + (i > 3 ? s : 0), pz * k + z];
    }), pick(r, ['#ff7a1a', '#f26b0f', '#ff9a3c', '#e8d6a8']), 0.08));
  }
  o.col.push({ x: 0, z: 0, r: 0.7 });
  return o;
}

export function stoneWall(len = 4, seed = 1) {
  const r = rnd(seed), o = P();
  const n = Math.round(len / 0.55);
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
    o.toon.push(col(tf(roundBox(0.55, 0.32, 0.45, 0.1, 2), { p: [-len / 2 + (i + (j ? 0.5 : 0)) * (len / n), 0.18 + j * 0.3, (r() - 0.5) * 0.06], r: [0, (r() - 0.5) * 0.2, 0] }), pick(r, ['#857e98', '#77708c', '#6c6580']), 0.08));
  }
  return o;
}

export function picketFence(len = 3) {
  const o = P();
  const n = Math.max(3, Math.round(len / 0.32));
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i / n) * len;
    o.toon.push(col(tf(box(0.1, 0.7, 0.04), { p: [x, 0.35, 0] }), '#e8e0d0'));
    o.toon.push(col(tf(cone(0.07, 0.12, 4), { p: [x, 0.76, 0], r: [0, Math.PI / 4, 0] }), '#e8e0d0'));
  }
  for (const y of [0.22, 0.52]) o.toon.push(col(tf(box(len, 0.06, 0.05), { p: [0, y, -0.04] }), '#d8d0c0'));
  return o;
}

// a crooked signpost with name boards pointing down the paths
export function signpostV2(arrows, seed = 1) {
  const r = rnd(seed), o = P();
  o.toon.push(col(tf(cyl(0.09, 0.11, 2.8, 6), { p: [0, 1.4, 0], r: [(r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.06] }), '#4a3021'));
  arrows.forEach((a, i) => {
    const y = 2.4 - i * 0.42;
    const board = new THREE.Shape([new THREE.Vector2(0, -0.14), new THREE.Vector2(1.15, -0.14), new THREE.Vector2(1.35, 0), new THREE.Vector2(1.15, 0.14), new THREE.Vector2(0, 0.14)]);
    o.toon.push(col(tf(new THREE.ExtrudeGeometry(board, { depth: 0.06, bevelEnabled: false }), { p: [0, y, 0], r: [0, -a, (r() - 0.5) * 0.12] }), pick(r, ['#80593d', '#8a6440', '#6b4a33'])));
  });
  o.toon.push(col(tf(sphere(0.12, 6, 4), { p: [0, 2.85, 0] }), '#ff7a1a'));
  o.col.push({ x: 0, z: 0, r: 0.25 });
  return o;
}

export function fencedGrave(seed) {
  const o = P();
  o.toon.push(col(tf(roundBox(0.7, 1, 0.18, 0.3, 4), { p: [0, 0.5, 0], r: [(rnd(seed)() - 0.5) * 0.2, 0, 0] }), '#8a86a0', 0.1));
  return o;
}

export function lanternPole(seed) {
  const r = rnd(seed), o = P();
  o.toon.push(col(tf(cyl(0.05, 0.07, 2.2, 5), { p: [0, 1.1, 0], r: [(r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.1] }), '#4a3021'));
  o.toon.push(col(tf(cyl(0.03, 0.03, 0.5, 4), { p: [0.2, 2.15, 0], r: [0, 0, Math.PI / 2] }), '#4a3021'));
  const c = pick(r, ['#ffb347', '#ff7a9c', '#b6ff8a', '#9ef0ff']);
  o.glow.push(col(tf(sphere(0.16, 8, 6), { p: [0.42, 1.95, 0], s: [1, 1.15, 1] }), c));
  o.toon.push(col(tf(cone(0.14, 0.12, 6), { p: [0.42, 2.14, 0] }), '#2b2236'));
  o.lights = [{ x: 0.42, y: 1.95, z: 0, c, s: 1.8 }];
  o.col.push({ x: 0, z: 0, r: 0.15 });
  return o;
}

export function mushroomRing(seed) {
  const r = rnd(seed), o = P();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, R = 1.3 + r() * 0.2, s = 0.5 + r() * 0.5;
    o.toon.push(col(tf(cyl(0.05 * s, 0.07 * s, 0.3 * s, 6), { p: [Math.cos(a) * R, 0.15 * s, Math.sin(a) * R] }), '#f1e3c2'));
    o.glow.push(col(tf(sphere(0.16 * s, 8, 6), { p: [Math.cos(a) * R, 0.3 * s, Math.sin(a) * R], s: [1, 0.55, 1] }), pick(r, ['#b6ff8a', '#9ef0ff', '#ff9ef0'])));
  }
  return o;
}
