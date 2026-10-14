// Builds a cute chibi character from an avatar spec (shared/avatar.js). Every body part is a separate pivot so the
// procedural animator can pose it; the geometry of each part is merged with baked vertex colours (1-2 draw calls).
import {
  THREE, toonMesh, col, merge, tf, carve, warp, sphere, capsule, cyl, cone, box, torus, glowMat, hash3, blobShadow, glowSprite, GRADIENT,
} from '../engine/toon.js';
import { Face, FACE_PATCH } from './face.js';
import { cleanAvatar } from '../../../shared/avatar.js';

export const R = 0.42; // head radius
const HEAD_Y = 0.34; // head centre above the neck pivot
const C = (hex) => new THREE.Color(hex);
const darker = (hex, f = 0.75) => '#' + C(hex).multiplyScalar(f).getHexString();
const lighter = (hex, f = 0.25) => '#' + C(hex).lerp(C('#ffffff'), f).getHexString();

// ---------------------------------------------------------------- hair
function hairCap(front, back, scale = 1.07, seg = [28, 20]) {
  const r = R * scale;
  return carve(sphere(r, seg[0], seg[1]), (x, y, z) => {
    const t = Math.min(1, Math.max(0, (z / r + 1) / 2));
    const line = (back + (front - back) * t * t) * R;
    return y > line;
  });
}

function bumpy(geo, amount = 0.025, freq = 9) {
  return warp(geo, (x, y, z) => {
    const n = (hash3(Math.round(x * freq), Math.round(y * freq), Math.round(z * freq)) - 0.5) * amount;
    const len = Math.hypot(x, y, z) || 1;
    return [x + (x / len) * n, y + (y / len) * n, z + (z / len) * n];
  });
}

function fibonacciPoints(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return pts;
}

// Returns { geos: [...toon geos], top: hair top height above head centre, tail: geo for a swinging ponytail }
function buildHair(style, color) {
  const c = color, d = darker(color, 0.82);
  const out = { geos: [], top: R * 1.05, tail: null, tailPos: null };
  const add = (g, cc = c) => out.geos.push(col(g, cc, 0.08));
  const fringe = (n, y = 0.5, spread = 0.75, size = 0.15) => {
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * spread;
      add(tf(sphere(size, 10, 8), { p: [Math.sin(a) * R * 0.98, R * y, Math.cos(a) * R * 0.9], r: [0.5, a, -a * 0.6], s: [1.15, 0.62, 0.7] }));
    }
  };
  switch (style) {
    case 'bald':
      out.top = R;
      break;
    case 'buzz':
      add(bumpy(hairCap(0.5, -0.46, 1.045), 0.012, 14), d);
      fringe(5, 0.5, 1.1, 0.1);
      out.top = R * 1.05;
      break;
    case 'short':
      add(bumpy(hairCap(0.46, -0.48, 1.07)));
      fringe(4, 0.52, 1.1, 0.14);
      out.top = R * 1.1;
      break;
    case 'spiky': {
      add(bumpy(hairCap(0.46, -0.44, 1.06)));
      const spikes = [[0, 1, 0.2], [0.5, 0.85, 0.35], [-0.5, 0.85, 0.35], [0.25, 0.9, -0.4], [-0.25, 0.9, -0.4], [0.75, 0.55, -0.1], [-0.75, 0.55, -0.1], [0, 0.7, 0.75], [0, 0.6, -0.8]];
      for (const [x, y, z] of spikes) {
        const dir = new THREE.Vector3(x, y, z).normalize();
        const g = cone(0.11, 0.3, 6);
        g.translate(0, 0.15, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
        g.translate(dir.x * R * 0.92, dir.y * R * 0.92, dir.z * R * 0.92);
        add(g);
      }
      out.top = R * 1.45;
      break;
    }
    case 'wavy':
      add(bumpy(hairCap(0.4, -0.7, 1.08), 0.04, 7));
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) add(tf(sphere(0.13, 10, 8), { p: [sx * R * (0.95 - i * 0.02), R * (0.05 - i * 0.3), -R * 0.1 + i * 0.03], s: [0.75, 1, 1] }));
      add(tf(sphere(0.2, 12, 8), { p: [R * 0.3, R * 0.62, R * 0.62], r: [0.6, 0, -0.5], s: [1.3, 0.55, 0.7] }));
      out.top = R * 1.12;
      break;
    case 'slicked': {
      // combed straight back: a smooth cap with a lifted front and comb ridges
      add(bumpy(hairCap(0.62, -0.5, 1.06), 0.006, 16));
      add(tf(sphere(0.22, 14, 10), { p: [0, R * 0.78, R * 0.42], s: [1.6, 0.55, 0.9], r: [-0.4, 0, 0] }));
      for (let i = -2; i <= 2; i++) add(tf(capsule(0.025, R * 1.1, 4, 8), { p: [i * 0.07, R * 0.86, -R * 0.15], r: [Math.PI / 2 + 0.55, 0, 0] }), d);
      out.top = R * 1.12;
      break;
    }
    case 'long_wavy':
    case 'long_curly': {
      const curly = style === 'long_curly';
      if (curly) {
        const r = R * 1.04;
        for (const [x, y, z] of fibonacciPoints(80)) {
          const t = Math.min(1, Math.max(0, (z + 1) / 2));
          if (y < -0.5 + 0.95 * t * t) continue;
          add(tf(sphere(0.11, 8, 6), { p: [x * r, y * r, z * r] }));
        }
      } else add(bumpy(hairCap(0.42, -0.7, 1.08), 0.045, 6));
      // a big mass of hair down the back and over the shoulders
      for (let i = 0; i < 7; i++) {
        const a = -1.25 + i * (2.5 / 6);
        const k = curly ? 0.16 : 0.13;
        for (let j = 0; j < 4; j++) {
          const p = [Math.sin(a) * R * (0.98 + j * 0.05), -R * (0.15 + j * 0.42), -Math.cos(a) * R * (0.82 - j * 0.04) - (Math.abs(a) < 0.9 ? 0 : 0.05)];
          add(curly ? bumpy(tf(sphere(k, 10, 8), { p }), 0.03, 10) : tf(sphere(k, 10, 8), { p, s: [1.1, 1.3, 0.8] }));
        }
      }
      for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) add(tf(sphere(curly ? 0.14 : 0.11, 10, 8), { p: [sx * R * (0.95 + Math.sin(j * 1.7) * 0.05), -R * (0.1 + j * 0.42), R * 0.15] }));
      out.top = R * (curly ? 1.24 : 1.14);
      break;
    }
    case 'curly': {
      const r = R * 1.02;
      for (const [x, y, z] of fibonacciPoints(70)) {
        const t = Math.min(1, Math.max(0, (z + 1) / 2));
        if (y < -0.5 + 0.95 * t * t) continue;
        add(tf(sphere(0.105, 8, 6), { p: [x * r, y * r, z * r] }));
      }
      out.top = R * 1.22;
      break;
    }
    case 'afro': {
      const rb = R * 1.42;
      const g = carve(sphere(rb, 28, 20), (x, y, z) => !(z > rb * 0.12 && y < rb * 0.3) && y > -rb * 0.62);
      add(tf(bumpy(g, 0.06, 6), { p: [0, R * 0.36, -R * 0.42] }));
      out.top = R * 0.36 + rb;
      break;
    }
    case 'bob':
    case 'long': {
      const r = R * 1.09;
      const shell = carve(sphere(r, 28, 20), (x, y, z) => {
        const faceWin = z > 0 && Math.abs(x) < r * 0.62 && y < r * 0.36;
        return !faceWin && y > -r * (style === 'long' ? 0.98 : 0.86);
      });
      add(bumpy(shell, 0.02, 10));
      add(tf(box(R * 1.28, R * 0.3, R * 0.4), { p: [0, R * 0.5, R * 0.68], r: [0.35, 0, 0] }));
      if (style === 'long') {
        add(tf(capsule(0.27, 0.38, 6, 12), { p: [0, -R * 0.75, -R * 0.62], s: [1.15, 1, 0.5] }));
        for (const sx of [-1, 1]) add(tf(capsule(0.08, 0.32, 4, 8), { p: [sx * R * 0.86, -R * 0.82, R * 0.12], r: [0.15, 0, sx * 0.08] }));
      }
      out.top = R * 1.12;
      break;
    }
    case 'ponytail': {
      add(bumpy(hairCap(0.46, -0.5, 1.065)));
      fringe(3, 0.55, 0.9, 0.13);
      add(tf(torus(0.07, 0.03, 6, 12), { p: [0, R * 0.55, -R * 0.92], r: [0.9, 0, 0] }), '#ff4f8b');
      const tail = merge([
        col(tf(capsule(0.12, 0.34, 6, 10), { p: [0, -0.24, 0] }), c, 0.08),
        col(tf(sphere(0.1, 8, 6), { p: [0, -0.5, 0.02] }), c, 0.08),
      ]);
      out.tail = tail;
      out.tailPos = [0, R * 0.55, -R * 1.02];
      out.top = R * 1.1;
      break;
    }
    case 'bun':
      add(bumpy(hairCap(0.46, -0.46, 1.06)));
      fringe(3, 0.56, 0.8, 0.12);
      add(bumpy(tf(sphere(0.2, 14, 10), { p: [0, R * 1.08, -R * 0.25] }), 0.03, 10));
      add(tf(torus(0.12, 0.03, 6, 14), { p: [0, R * 0.95, -R * 0.2], r: [Math.PI / 2 - 0.3, 0, 0] }), '#ffd23f');
      out.top = R * 1.55;
      break;
    case 'braids':
      add(bumpy(hairCap(0.42, -0.58, 1.07)));
      fringe(3, 0.53, 0.7, 0.13);
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 5; i++) add(tf(sphere(0.085 - i * 0.004, 8, 6), { p: [sx * R * 0.86, -R * 0.2 - i * 0.12, R * 0.1 + i * 0.03], s: [1, 0.85, 1] }));
        add(tf(sphere(0.05, 8, 6), { p: [sx * R * 0.86, -R * 0.2 - 5 * 0.12, R * 0.26] }), '#ff4f8b');
      }
      out.top = R * 1.1;
      break;
    case 'mohawk':
      add(hairCap(0.5, -0.42, 1.018), darker(c, 0.6));
      for (let i = 0; i < 6; i++) {
        const a = -0.5 + i * 0.32;
        add(tf(sphere(0.13, 10, 8), { p: [0, Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02], r: [a, 0, 0], s: [0.38, 1.6, 0.95] }));
      }
      out.top = R * 1.45;
      break;
    case 'headscarf': {
      const r = R * 1.13;
      const shell = carve(sphere(r, 30, 22), (x, y, z) => !(z > r * 0.2 && y < r * 0.42 && y > -r * 0.8 && Math.abs(x) < r * 0.66));
      add(shell);
      // drape over neck and shoulders
      const pts = [new THREE.Vector2(0.24, -R * 0.55), new THREE.Vector2(0.3, -R * 0.95), new THREE.Vector2(0.4, -R * 1.25), new THREE.Vector2(0.46, -R * 1.45)];
      const lathe = new THREE.LatheGeometry(pts.slice().reverse(), 24);
      add(warp(lathe, (x, y, z) => [x, y + Math.sin(Math.atan2(x, z) * 6) * 0.015, z * 0.92]), darker(c, 0.92));
      add(tf(torus(r * 0.62, 0.035, 6, 24, Math.PI * 1.3), { p: [0, -R * 0.18, r * 0.2], r: [0.1, 0, -Math.PI * 0.15 - Math.PI * 0.5] }), lighter(c, 0.15));
      out.top = R * 1.13;
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- clothes and body
function torsoGeometry(top) {
  const t = top.type;
  const g = new THREE.CapsuleGeometry(0.25, 0.2, 10, 24, 8);
  g.translate(0, 0.24, 0);
  g.scale(1.1, 1, 0.86);
  const main = top.color, acc = top.accent;
  const pattern = top.pattern;
  return col(g, (x, y, z) => {
    if (t === 'jacket' && z > 0.1 && Math.abs(x) < 0.07) return acc;
    if (t === 'hoodie' && z > 0.12 && y > 0.06 && y < 0.2 && Math.abs(x) < 0.15) return darker(main, 0.85);
    if (pattern === 'stripes' && Math.floor(y * 18) % 2 === 0) return acc;
    if (pattern === 'zigzag' && Math.abs(y - 0.26 - Math.abs((((Math.atan2(x, z) * 4) % 2) + 2) % 2 - 1) * 0.07) < 0.03) return acc;
    if (pattern === 'bandage' && Math.abs(((y * 14 + x * 4) % 1 + 1) % 1 - 0.5) < 0.09) return acc;
    if (y < 0.05) return darker(main, 0.85);
    return main;
  }, 0.03, true);
}

// Shirt prints that need real shapes: skeleton ribs and a chest emblem star.
function prints(top) {
  const out = [];
  const front = (y) => 0.25 * 1.1 * 0.86 * Math.sqrt(Math.max(0.15, 1 - ((y - 0.24) / 0.38) ** 2)) + 0.012;
  if (top.pattern === 'bones') {
    out.push(col(tf(box(0.04, 0.3, 0.02), { p: [0, 0.27, front(0.27)] }), top.accent));
    for (let i = 0; i < 4; i++) {
      const y = 0.37 - i * 0.075;
      for (const sx of [-1, 1]) {
        // a rib: a short bar sloping down and out from the breastbone, hugging the chest
        out.push(col(tf(capsule(0.016, 0.1, 3, 6), { p: [sx * 0.08, y - 0.012, front(y) - 0.012], r: [0, sx * 0.35, sx * (Math.PI / 2 + 0.3)] }), top.accent));
      }
    }
    out.push(col(tf(sphere(0.06, 10, 6), { p: [0, 0.09, front(0.09) - 0.01], s: [1.6, 0.6, 0.4] }), top.accent));
  }
  if (top.pattern === 'star') {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.045 : 0.11;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    out.push(col(tf(new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false }), { p: [0, 0.28, front(0.28) - 0.004] }), top.accent));
  }
  return out;
}

function dots(top) {
  if (top.pattern !== 'dots') return [];
  const out = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, y = 0.1 + ((i * 0.137) % 1) * 0.32;
    const r = 0.25 * 1.1 * Math.sqrt(Math.max(0.2, 1 - ((y - 0.24) / 0.36) ** 2)) + 0.002;
    const x = Math.sin(a) * r, z = Math.cos(a) * r * 0.78;
    out.push(col(tf(sphere(0.032, 8, 6), { p: [x, y, z], s: [1, 1, 0.35], r: [0, a, 0] }), top.accent));
  }
  return out;
}

function clothesExtras(top, skin) {
  const g = [];
  const main = top.color, acc = top.accent;
  switch (top.type) {
    case 'hoodie':
      g.push(col(tf(torus(0.2, 0.08, 8, 16, Math.PI * 1.2), { p: [0, 0.44, -0.07], r: [Math.PI / 2 - 0.3, 0, Math.PI * 1.4] }), darker(main, 0.9)));
      for (const sx of [-1, 1]) g.push(col(tf(cyl(0.012, 0.012, 0.16, 5), { p: [sx * 0.06, 0.33, 0.24] }), '#f2f2f2'));
      break;
    case 'jacket':
      for (const sx of [-1, 1]) g.push(col(tf(box(0.08, 0.26, 0.04), { p: [sx * 0.1, 0.33, 0.21], r: [0.12, 0, sx * -0.35] }), darker(main, 0.8)));
      break;
    case 'sweater':
      g.push(col(tf(torus(0.15, 0.04, 6, 18), { p: [0, 0.45, 0], r: [Math.PI / 2, 0, 0] }), acc));
      break;
    case 'shirt':
      for (const sx of [-1, 1]) g.push(col(tf(cone(0.07, 0.11, 3), { p: [sx * 0.07, 0.43, 0.17], r: [Math.PI * 0.62, 0, sx * 0.7] }), lighter(main, 0.35)));
      for (let i = 0; i < 3; i++) g.push(col(tf(sphere(0.018, 6, 4), { p: [0, 0.34 - i * 0.09, 0.23 - i * 0.004] }), acc));
      break;
    case 'dress': {
      const skirt = cyl(0.27, 0.42, 0.34, 18, true);
      g.push(col(tf(skirt, { p: [0, -0.08, 0] }), (x, y) => (y < -0.2 ? acc : main)));
      g.push(col(tf(torus(0.27, 0.025, 6, 20), { p: [0, 0.09, 0], r: [Math.PI / 2, 0, 0] }), acc));
      break;
    }
    case 'tshirt':
      g.push(col(tf(torus(0.13, 0.025, 6, 16), { p: [0, 0.45, 0.02], r: [Math.PI / 2 + 0.15, 0, 0] }), darker(main, 0.85)));
      break;
  }
  void skin;
  return g;
}

function armGeometry(top, skin, side) {
  const long = ['hoodie', 'jacket', 'sweater', 'shirt'].includes(top.type);
  const sleeve = top.color;
  const g = new THREE.CapsuleGeometry(0.078, 0.2, 6, 12, 6);
  g.translate(0, -0.16, 0);
  // stripes and bandage wraps continue down long sleeves
  const band = (y) => (top.pattern === 'stripes' && Math.floor(-y * 18) % 2) || (top.pattern === 'bandage' && Math.floor(-y * 16) % 2);
  const arm = col(g, (x, y) => (long || y > -0.11 ? (long && band(y) ? top.accent : sleeve) : skin), 0.03, true);
  const parts = [arm, col(tf(sphere(0.088, 10, 8), { p: [0, -0.34, 0.01] }), skin)];
  if (long) parts.push(col(tf(torus(0.07, 0.02, 6, 12), { p: [0, -0.29, 0], r: [Math.PI / 2, 0, 0] }), top.type === 'sweater' ? top.accent : darker(sleeve, 0.85)));
  void side;
  return merge(parts);
}

function legGeometry(bottom, shoes, dress) {
  const g = capsule(0.095, 0.24, 6, 10);
  g.translate(0, -0.22, 0);
  return merge([
    col(g, dress ? lighter(bottom, 0.1) : bottom, 0.04),
    col(tf(sphere(0.12, 12, 8), { p: [0, -0.4, 0.045], s: [1, 0.66, 1.3] }), shoes),
    col(tf(cyl(0.125, 0.125, 0.03, 14), { p: [0, -0.445, 0.05], s: [1, 1, 1.25] }), darker(shoes, 0.6)),
  ]);
}

// ---------------------------------------------------------------- head accessories
function glassesGeos(kind) {
  if (kind === 'none') return [];
  const out = [];
  const ey = HEAD_Y - 0.1 * R, ex = 0.37 * R, ez = Math.sqrt(R * R - ex * ex - (0.1 * R) ** 2) + 0.035;
  const frame = kind === 'sunglasses' ? '#20142b' : '#5b3a6e';
  for (const sx of [-1, 1]) {
    const ring = kind === 'square' ? tf(torus(0.098, 0.011, 4, 4), { r: [0, 0, Math.PI / 4], s: [1.15, 0.88, 1] }) : torus(0.094, 0.009, 6, 20);
    out.push(col(tf(ring, { p: [sx * ex, ey, ez], r: [0, sx * 0.32, 0] }), frame));
    if (kind === 'sunglasses') out.push(col(tf(cyl(0.088, 0.088, 0.01, 16), { p: [sx * ex, ey, ez - 0.005], r: [Math.PI / 2, 0, sx * 0.32] }), '#1a0f24'));
    out.push(col(tf(cyl(0.01, 0.01, 0.3, 4), { p: [sx * R * 0.9, ey + 0.01, ez - 0.17], r: [Math.PI / 2, 0, 0] }), frame));
  }
  out.push(col(tf(cyl(0.012, 0.012, 0.08, 4), { p: [0, ey + 0.02, ez + 0.01], r: [0, 0, Math.PI / 2] }), frame));
  return out;
}

function headwearGeos(kind, accent, top) {
  const out = [];
  const y = HEAD_Y;
  if (kind === 'cap') {
    out.push(col(tf(carve(sphere(R * 1.1, 24, 16), (x, yy) => yy > R * 0.12), { p: [0, y, 0] }), accent));
    out.push(col(tf(cyl(0.3, 0.3, 0.03, 20), { p: [0, y + R * 0.2, R * 0.62], s: [1, 1, 0.95] }), darker(accent, 0.8)));
    out.push(col(tf(sphere(0.04, 8, 6), { p: [0, y + R * 1.1, 0] }), darker(accent, 0.8)));
    return { geos: out, top: y + R * 1.12 };
  }
  if (kind === 'beanie') {
    out.push(col(bumpy(tf(carve(sphere(R * 1.12, 24, 16), (x, yy) => yy > R * 0.05), { p: [0, y, 0] }), 0.01, 20), accent));
    out.push(col(tf(torus(R * 1.07, 0.06, 8, 26), { p: [0, y + R * 0.12, 0], r: [Math.PI / 2, 0, 0] }), darker(accent, 0.8)));
    out.push(col(bumpy(tf(sphere(0.12, 12, 8), { p: [0, y + R * 1.22, 0] }), 0.03, 12), lighter(accent, 0.4)));
    return { geos: out, top: y + R * 1.3 };
  }
  void top;
  return { geos: out, top: null };
}

// Costume pieces: returns toon geos, glow geos and animated parts {name: {geo, pos}}
function costume(kind, hairTop, spec) {
  const toon = [], glow = [], parts = {};
  const y0 = HEAD_Y + hairTop; // top of hair
  switch (kind) {
    case 'witch_hat':
    case 'wizard_hat': {
      const witch = kind === 'witch_hat';
      const base = y0 - 0.1;
      const hat = witch ? '#2b1740' : '#3346c9';
      toon.push(col(tf(cyl(witch ? 0.62 : 0.48, witch ? 0.62 : 0.48, 0.035, 26), { p: [0, base, 0] }), hat));
      const c = warp(cone(0.33, witch ? 0.62 : 0.78, 18), (x, y, z) => {
        const t = (y + (witch ? 0.31 : 0.39)) / (witch ? 0.62 : 0.78);
        return [x, y, z - t * t * t * 0.32];
      });
      toon.push(col(tf(c, { p: [0, base + (witch ? 0.31 : 0.39), 0] }), hat));
      if (witch) {
        toon.push(col(tf(cyl(0.335, 0.34, 0.08, 20), { p: [0, base + 0.06, 0] }), '#ff7a1a'));
        toon.push(col(tf(box(0.1, 0.09, 0.03), { p: [0, base + 0.06, 0.34] }), '#ffd23f'));
      } else {
        for (let i = 0; i < 6; i++) {
          const a = i * 1.1, h = 0.1 + (i % 3) * 0.16;
          const rr = 0.33 * (1 - h / 0.78) + 0.01;
          glow.push(col(tf(new THREE.OctahedronGeometry(0.045), { p: [Math.sin(a) * rr, base + h, Math.cos(a) * rr - (h / 0.78) ** 3 * 0.32] }), '#ffe066'));
        }
      }
      break;
    }
    case 'cat_ears':
    case 'bunny_ears': {
      const cat = kind === 'cat_ears';
      const earC = cat ? '#2a1d33' : '#f4f0ff';
      for (const sx of [-1, 1]) {
        const a = sx * (cat ? 0.5 : 0.25);
        const px = sx * R * (cat ? 0.62 : 0.4), py = HEAD_Y + Math.max(R * 0.75, hairTop * 0.86);
        if (cat) {
          toon.push(col(tf(cone(0.15, 0.24, 3), { p: [px, py + 0.08, 0], r: [0, 0, -a], s: [1, 1, 0.55] }), earC));
          toon.push(col(tf(cone(0.08, 0.15, 3), { p: [px * 1.02, py + 0.06, 0.04], r: [0, 0, -a], s: [1, 1, 0.4] }), '#ff9ebb'));
        } else {
          const bend = sx > 0 ? 0.5 : 0;
          toon.push(col(tf(capsule(0.08, 0.36, 6, 10), { p: [px, py + 0.24, 0], r: [bend * 0.2, 0, -a - bend], s: [1, 1, 0.55] }), earC));
          toon.push(col(tf(capsule(0.04, 0.28, 4, 8), { p: [px, py + 0.24, 0.035], r: [bend * 0.2, 0, -a - bend], s: [1, 1, 0.4] }), '#ffb3c8'));
        }
      }
      break;
    }
    case 'devil_horns': {
      for (const sx of [-1, 1]) {
        const h = warp(cone(0.075, 0.24, 10), (x, y, z) => [x + (y + 0.12) ** 2 * sx * 0.9, y, z]);
        toon.push(col(tf(h, { p: [sx * R * 0.42, HEAD_Y + Math.max(R * 0.82, hairTop * 0.9), R * 0.1], r: [0.2, 0, -sx * 0.25] }), '#e63946'));
      }
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.05, -0.2), new THREE.Vector3(0, 0.12, -0.38), new THREE.Vector3(0, 0.3, -0.42)]);
      parts.tail = { geo: merge([col(new THREE.TubeGeometry(curve, 16, 0.025, 6), '#e63946'), col(tf(cone(0.08, 0.13, 4), { p: [0, 0.34, -0.42], s: [1, 1, 0.3] }), '#e63946')]), pos: [0, 0.12, -0.18], parent: 'hips' };
      break;
    }
    case 'bat_wings': {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.55, 0.28);
      shape.quadraticCurveTo(0.5, 0.05, 0.56, -0.12);
      shape.quadraticCurveTo(0.42, -0.05, 0.36, -0.2);
      shape.quadraticCurveTo(0.26, -0.08, 0.16, -0.18);
      shape.quadraticCurveTo(0.1, -0.05, 0, -0.08);
      const wing = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
      parts.wingR = { geo: col(wing.clone(), '#3b1f4f'), pos: [0.08, 0.36, -0.2], parent: 'torso' };
      parts.wingL = { geo: col(tf(wing.clone(), { s: [-1, 1, 1] }), '#3b1f4f'), pos: [-0.08, 0.36, -0.2], parent: 'torso' };
      break;
    }
    case 'vampire_cape': {
      const outer = cyl(0.3, 0.52, 0.92, 22, true);
      const g = carve(outer, (x, y, z) => z < 0.08);
      const inner = tf(g.clone(), { s: [0.97, 1, 0.97] });
      // inner red lining faces the other way
      const idx = inner.attributes.position;
      for (let i = 0; i < idx.count; i += 3) {
        for (const k of ['position', 'normal']) {
          const a = inner.attributes[k];
          const tmp = [a.getX(i), a.getY(i), a.getZ(i)];
          a.setXYZ(i, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2));
          a.setXYZ(i + 2, ...tmp);
        }
      }
      inner.attributes.normal.array.forEach((v, i, arr) => (arr[i] = -v));
      const collar = carve(cone(0.34, 0.3, 18, true), (x, y, z) => z < 0.05);
      parts.cape = {
        geo: merge([col(tf(g, { p: [0, -0.46, 0] }), '#1b0f24'), col(tf(inner, { p: [0, -0.46, 0] }), '#b5172e'), col(tf(collar, { p: [0, 0.12, -0.02], r: [Math.PI, 0, 0] }), '#b5172e')]),
        pos: [0, 0.46, -0.04], parent: 'torso',
      };
      break;
    }
    case 'pumpkin_crown': {
      const base = y0 - 0.06;
      const ring = cyl(0.2, 0.22, 0.12, 16, true);
      toon.push(col(tf(ring, { p: [0, base, 0] }), '#ffb703'));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        toon.push(col(tf(cone(0.05, 0.13, 4), { p: [Math.sin(a) * 0.2, base + 0.11, Math.cos(a) * 0.2] }), '#ffb703'));
      }
      const pumpkin = warp(sphere(0.085, 12, 8), (x, y, z) => {
        const a = Math.atan2(x, z);
        const k = 1 + Math.cos(a * 6) * 0.08;
        return [x * k, y * 0.85, z * k];
      });
      toon.push(col(tf(pumpkin, { p: [0, base + 0.02, 0.24] }), '#ff7a1a'));
      toon.push(col(tf(cyl(0.012, 0.016, 0.05, 5), { p: [0, base + 0.1, 0.24] }), '#4a7c2c'));
      break;
    }
    case 'ghost_veil': {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push(new THREE.Vector2(0.12 + Math.sin(t * Math.PI * 0.5) * 0.36, 0.25 - t * 0.95));
      }
      const veil = carve(new THREE.LatheGeometry(pts.slice().reverse(), 26), (x, y, z) => z < 0.1 || y > 0.1);
      const wavy = warp(veil, (x, y, z) => [x, y + (y < -0.55 ? Math.sin(Math.atan2(x, z) * 7) * 0.04 : 0), z]);
      parts.veil = { geo: col(wavy, '#efe9ff'), pos: [0, HEAD_Y + R * 0.6, -0.1], parent: 'head', soft: true };
      break;
    }
    case 'skull_mask': {
      // worn pushed to the side of the head (on the crown it hid the hair and read as a bald white head)
      const place = new THREE.Matrix4().compose(
        new THREE.Vector3(R * 0.78, HEAD_Y + R * 0.38, R * 0.12),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 1.25, 0.35)),
        new THREE.Vector3(0.62, 0.62, 0.62),
      );
      const parts = [
        col(tf(carve(sphere(R * 0.82, 20, 14), (x, y, z) => z > 0), { s: [1, 1.08, 0.45] }), '#f3eee2'),
        ...[-1, 1].map((sx) => col(tf(sphere(0.085, 10, 8), { p: [sx * 0.14, 0.06, R * 0.36], s: [1, 1.2, 0.5] }), '#21142b')),
        col(tf(cone(0.04, 0.06, 3), { p: [0, -0.06, R * 0.37], r: [Math.PI, 0, 0] }), '#21142b'),
        col(tf(box(0.2, 0.025, 0.02), { p: [0, -0.18, R * 0.34] }), '#21142b'),
      ];
      for (const g of parts) toon.push(g.applyMatrix4(place));
      break;
    }
    case 'antennae': {
      for (const sx of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(sx * 0.05, 0.15, 0), new THREE.Vector3(sx * 0.12, 0.3, 0.04)]);
        parts['ant' + (sx > 0 ? 'R' : 'L')] = {
          geo: merge([col(new THREE.TubeGeometry(curve, 10, 0.015, 5), '#3a2340')]),
          glow: col(tf(sphere(0.055, 10, 8), { p: [sx * 0.12, 0.32, 0.04] }), '#8dff6a'),
          pos: [sx * R * 0.35, HEAD_Y + Math.max(R * 0.85, hairTop * 0.92), 0], parent: 'head',
        };
      }
      break;
    }
    case 'pirate_hat': {
      // black tricorn with a gold trim and a white skull
      const c = spec.costumeColor || '#1b1226';
      const base = y0 - 0.2;
      const brim = warp(cyl(0.6, 0.6, 0.05, 3), (x, y, z) => [x, y + Math.hypot(x, z) * 0.32, z]);
      toon.push(col(tf(brim, { p: [0, base + 0.05, 0], r: [0, Math.PI, 0] }), c));
      toon.push(col(tf(torus(0.5, 0.025, 4, 3), { p: [0, base + 0.14, 0], r: [Math.PI / 2, 0, Math.PI / 6] }), '#e0b33a'));
      toon.push(col(tf(sphere(0.36, 16, 10), { p: [0, base + 0.12, 0], s: [1, 0.55, 1] }), c));
      toon.push(col(tf(sphere(0.06, 8, 6), { p: [0, base + 0.22, 0.43] }), '#f3eee2'));
      for (const sx of [-1, 1]) toon.push(col(tf(box(0.1, 0.02, 0.02), { p: [0, base + 0.15, 0.44], r: [0, 0, sx * 0.7] }), '#f3eee2'));
      break;
    }
    case 'top_hat': {
      const c = spec.costumeColor || '#1b1226';
      const base = y0 - 0.12;
      toon.push(col(tf(cyl(0.52, 0.52, 0.04, 24), { p: [0, base, 0] }), c));
      toon.push(col(tf(cyl(0.3, 0.32, 0.62, 22), { p: [0, base + 0.33, 0] }), c));
      toon.push(col(tf(cyl(0.325, 0.325, 0.1, 22, true), { p: [0, base + 0.1, 0] }), '#b5172e'));
      break;
    }
    case 'crown': {
      const c = spec.costumeColor || '#ffd23f';
      const base = y0 - 0.08;
      toon.push(col(tf(cyl(0.27, 0.29, 0.14, 18, true), { p: [0, base, 0] }), c));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        toon.push(col(tf(cone(0.07, 0.18, 4), { p: [Math.sin(a) * 0.27, base + 0.15, Math.cos(a) * 0.27] }), c));
        glow.push(col(tf(sphere(0.035, 8, 6), { p: [Math.sin(a + 0.5) * 0.29, base, Math.cos(a + 0.5) * 0.29] }), ['#ff4f8b', '#2ec4b6', '#7b4dff'][i % 3]));
      }
      break;
    }
    case 'cowboy_hat': {
      const c = spec.costumeColor || '#8a5a33';
      const base = y0 - 0.08;
      toon.push(col(tf(warp(cyl(0.66, 0.66, 0.04, 26), (x, y, z) => [x, y + (x * x) * 0.5, z]), { p: [0, base, 0] }), c));
      toon.push(col(tf(warp(sphere(0.32, 18, 12), (x, y, z) => [x, y < 0 ? y * 0.2 : y - Math.max(0, 0.06 - Math.abs(x)) * 1.2, z * 0.85]), { p: [0, base + 0.08, 0] }), c));
      toon.push(col(tf(cyl(0.33, 0.33, 0.06, 20, true), { p: [0, base + 0.08, 0], s: [1, 1, 0.86] }), darker(c, 0.6)));
      break;
    }
    case 'bow': {
      const c = spec.costumeColor || '#ff4f8b';
      const p = [R * 0.45, HEAD_Y + Math.max(R * 0.82, hairTop * 0.92), R * 0.15];
      for (const sx of [-1, 1]) toon.push(col(tf(cone(0.12, 0.2, 10), { p: [p[0] + sx * 0.1, p[1], p[2]], r: [0, 0, sx * Math.PI / 2], s: [1, 1, 0.5] }), c));
      toon.push(col(tf(sphere(0.055, 8, 6), { p }), darker(c, 0.75)));
      break;
    }
    case 'flower_crown': {
      const base = y0 - 0.1;
      const cols = spec.costumeColor ? [spec.costumeColor, lighter(spec.costumeColor, 0.4), '#ffd23f'] : ['#ff8fb8', '#ffd23f', '#b78bff'];
      toon.push(col(tf(torus(0.33, 0.025, 6, 24), { p: [0, base, 0], r: [Math.PI / 2, 0, 0] }), '#4f7a2c'));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        toon.push(col(tf(sphere(0.065, 8, 6), { p: [Math.sin(a) * 0.33, base + 0.02, Math.cos(a) * 0.33], s: [1, 0.7, 1] }), cols[i % 3]));
      }
      break;
    }
    case 'halo': {
      parts.halo = { glow: col(tf(torus(0.24, 0.03, 8, 30), { r: [Math.PI / 2, 0, 0] }), '#ffe680'), pos: [0, y0 + 0.2, 0], parent: 'head', sprite: '#ffe680' };
      break;
    }
  }
  // the back slot: capes and wings from real costumes (it can go with any head piece)
  const back = spec.back || 'none';
  if (back === 'cape' && kind !== 'vampire_cape') {
    const outer = cyl(0.3, 0.55, 0.95, 22, true);
    const g = carve(outer, (x, y, z) => z < 0.08);
    const inner = tf(g.clone(), { s: [0.97, 1, 0.97] });
    inner.attributes.normal.array.forEach((v, i, arr) => (arr[i] = -v));
    const idx = inner.attributes.position;
    for (let i = 0; i < idx.count; i += 3) {
      for (const k of ['position', 'normal']) {
        const a = inner.attributes[k];
        const tmp = [a.getX(i), a.getY(i), a.getZ(i)];
        a.setXYZ(i, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2));
        a.setXYZ(i + 2, ...tmp);
      }
    }
    parts.cape = { geo: merge([col(tf(g, { p: [0, -0.47, 0] }), spec.backColor || '#b5172e'), col(tf(inner, { p: [0, -0.47, 0] }), spec.backLining || darker(spec.backColor || '#b5172e', 0.6))]), pos: [0, 0.46, -0.04], parent: 'torso' };
  }
  if (back === 'bat_wings' && kind !== 'bat_wings') {
    const s = batWingShape();
    const wing = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
    const c = spec.backColor && spec.backColor !== '#1b0f24' ? spec.backColor : '#3b1f4f';
    parts.wingR = { geo: col(wing.clone(), c), pos: [0.08, 0.36, -0.2], parent: 'torso' };
    parts.wingL = { geo: col(tf(wing.clone(), { s: [-1, 1, 1] }), c), pos: [-0.08, 0.36, -0.2], parent: 'torso' };
  }
  if (back === 'fairy_wings' || back === 'angel_wings') {
    const angel = back === 'angel_wings';
    const c = angel ? '#fbf7ff' : spec.backColor && spec.backColor !== '#1b0f24' ? lighter(spec.backColor, 0.3) : '#b8f3ff';
    const wingParts = angel
      ? Array.from({ length: 5 }, (_, i) => col(tf(capsule(0.06, 0.34 - i * 0.04, 4, 8), { p: [0.16 + i * 0.07, 0.1 - i * 0.06, 0], r: [0, 0, -1.1 + i * 0.18], s: [1, 1, 0.4] }), c))
      : [col(tf(sphere(0.26, 14, 10), { p: [0.26, 0.12, 0], s: [1, 1.3, 0.08], r: [0, 0, -0.5] }), c), col(tf(sphere(0.17, 12, 8), { p: [0.2, -0.16, 0], s: [1, 1.2, 0.08], r: [0, 0, 0.6] }), lighter(c, 0.2))];
    const wing = merge(wingParts);
    parts.wingR = { geo: wing.clone(), pos: [0.06, 0.4, -0.22], parent: 'torso', soft: !angel };
    parts.wingL = { geo: tf(wing.clone(), { s: [-1, 1, 1] }), pos: [-0.06, 0.4, -0.22], parent: 'torso', soft: !angel };
  }
  return { toon, glow, parts };
}

function batWingShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.55, 0.28);
  shape.quadraticCurveTo(0.5, 0.05, 0.56, -0.12);
  shape.quadraticCurveTo(0.42, -0.05, 0.36, -0.2);
  shape.quadraticCurveTo(0.26, -0.08, 0.16, -0.18);
  shape.quadraticCurveTo(0.1, -0.05, 0, -0.08);
  return shape;
}

// ---------------------------------------------------------------- the character
export class Avatar {
  constructor(specIn, { outline = true, shadow = true, raw = false } = {}) {
    // raw specs (NPCs) skip cleaning so they can use colours and styles players cannot pick
    const spec = raw ? specIn : cleanAvatar(specIn, 'avatar');
    this.spec = spec;
    this.root = new THREE.Group();
    this.root.name = 'avatar';
    this.meshes = [];
    this.parts = {};

    const skin = spec.skin;
    const body = (this.body = new THREE.Group());
    this.root.add(body);
    const hips = (this.hips = new THREE.Group());
    hips.position.y = 0.46;
    body.add(hips);
    const torso = (this.torso = new THREE.Group());
    torso.position.y = 0.46;
    body.add(torso);

    const mk = (geo, parent, opts = {}) => {
      if (!geo) return null;
      const m = toonMesh(geo, { outline, ...opts });
      parent.add(m);
      this.meshes.push(m);
      return m;
    };
    const mkGlow = (geo, parent) => {
      const m = new THREE.Mesh(geo, glowMat);
      parent.add(m);
      this.meshes.push(m);
      return m;
    };

    // legs
    const dress = spec.top.type === 'dress';
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.11, 0, 0);
      hips.add(leg);
      mk(legGeometry(spec.bottom, spec.shoes, dress), leg);
      this[sx < 0 ? 'legL' : 'legR'] = leg;
    }

    // torso + clothes
    mk(merge([torsoGeometry(spec.top), ...dots(spec.top), ...prints(spec.top), ...clothesExtras(spec.top, skin), col(tf(cyl(0.1, 0.12, 0.08, 10), { p: [0, 0.47, 0] }), skin)]), torso);

    // arms
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.29, 0.4, 0);
      arm.rotation.z = sx * 0.12;
      torso.add(arm);
      mk(armGeometry(spec.top, skin, sx), arm);
      this[sx < 0 ? 'armL' : 'armR'] = arm;
    }

    // head
    const head = (this.head = new THREE.Group());
    head.position.y = 0.46;
    torso.add(head);
    // hair the same brightness as the skin reads as bald from a distance, so push it darker
    const lum = (hex) => { const c = C(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
    let hairColor = spec.hair.color;
    if (Math.abs(lum(hairColor) - lum(skin)) < 0.14) hairColor = darker(hairColor, lum(skin) > 0.35 ? 0.55 : 1.6);
    const hair = buildHair(spec.hair.style, hairColor);
    const hw = headwearGeos(spec.headwear, spec.top.accent, hair.top);
    const hairTop = hw.top != null ? Math.max(hair.top, hw.top - HEAD_Y) : hair.top;
    const cos = costume(spec.costume, hairTop, spec);
    const headGeos = [
      col(tf(sphere(R, 32, 24), { p: [0, HEAD_Y, 0] }), skin),
      col(tf(sphere(0.085, 10, 8), { p: [R * 0.97, HEAD_Y - 0.04, -0.02], s: [0.6, 1, 0.9] }), skin),
      col(tf(sphere(0.085, 10, 8), { p: [-R * 0.97, HEAD_Y - 0.04, -0.02], s: [0.6, 1, 0.9] }), skin),
      col(tf(sphere(0.04, 8, 6), { p: [0, HEAD_Y - 0.2 * R, R * 0.98] }), darker(skin, 0.93)),
      ...hair.geos.map((g) => tf(g, { p: [0, HEAD_Y, 0] })),
      ...glassesGeos(spec.glasses),
      ...hw.geos,
      ...cos.toon,
    ];
    this.headMesh = mk(merge(headGeos), head);
    if (cos.glow.length) mkGlow(merge(cos.glow), head);

    // face decal
    this.face = new Face(spec);
    const faceGeo = new THREE.SphereGeometry(R * 1.006, 32, 20, Math.PI / 2 - FACE_PATCH.phiLength / 2, FACE_PATCH.phiLength, FACE_PATCH.thetaStart, FACE_PATCH.thetaLength);
    this.faceMat = new THREE.MeshToonMaterial({ map: this.face.texture, transparent: true, alphaTest: 0.05, depthWrite: false, gradientMap: GRADIENT });
    this.faceMat.userData.face = true;
    const face = new THREE.Mesh(faceGeo, this.faceMat);
    face.position.y = HEAD_Y;
    face.renderOrder = 2;
    head.add(face);
    this.faceMesh = face;

    // swinging ponytail
    if (hair.tail) {
      const tail = new THREE.Group();
      tail.position.set(...hair.tailPos);
      tail.rotation.x = 0.35;
      head.add(tail);
      mk(hair.tail, tail);
      this.parts.ponytail = tail;
    }

    // animated costume parts
    for (const [name, p] of Object.entries(cos.parts)) {
      const g = new THREE.Group();
      g.position.set(...p.pos);
      ({ hips, torso, head })[p.parent].add(g);
      if (p.geo) mk(p.geo, g, { outline: outline && !p.soft });
      if (p.glow) mkGlow(p.glow, g);
      if (p.sprite) {
        const s = glowSprite(p.sprite, 0.9, 0.5);
        g.add(s);
      }
      this.parts[name] = g;
    }
    if (this.parts.wingL) this.parts.wingL.rotation.y = 0.5;
    if (this.parts.wingR) this.parts.wingR.rotation.y = -0.5;

    if (shadow) {
      this.shadow = blobShadow(0.55);
      this.root.add(this.shadow);
    }
    this.height = HEAD_Y + 0.92 + hairTop + (cos.parts.halo ? 0.3 : 0) + ({ witch_hat: 0.6, wizard_hat: 0.6, top_hat: 0.6, pirate_hat: 0.25, cowboy_hat: 0.25, crown: 0.2 }[spec.costume] || 0);
  }

  setOutline(on) {
    this.root.traverse((o) => {
      if (o.userData.outline) o.visible = on;
    });
  }

  // Ghost potion: everything see-through (swaps to shared transparent materials).
  setGhost(on) {
    this.root.traverse((o) => {
      if (!o.isMesh || o.userData.outline || o === this.shadow) return;
      if (on && !o.userData.solidMat) {
        o.userData.solidMat = o.material;
        o.material = ghostVariant(o.material);
      } else if (!on && o.userData.solidMat) {
        o.material = o.userData.solidMat;
        delete o.userData.solidMat;
      }
    });
    this.setOutline(!on);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
    this.face.texture.dispose();
    this.faceMat.dispose();
  }
}

const ghostCache = new Map();
function ghostVariant(mat) {
  if (mat.userData.face) {
    const m = mat.clone();
    m.opacity = 0.5;
    return m;
  }
  if (!ghostCache.has(mat)) {
    const m = mat.clone();
    m.transparent = true;
    m.opacity = 0.42;
    m.depthWrite = false;
    ghostCache.set(mat, m);
  }
  return ghostCache.get(mat);
}
