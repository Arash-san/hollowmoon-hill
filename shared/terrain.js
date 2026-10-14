// The shape of the land, shared by the server (spawn spots, move checks) and the client (ground mesh, walking, map).
// The island has a wavy coastline instead of a circle, rolling hills between the places, three landmark hills,
// and flat ground wherever a quest happens so nothing gameplay-related ends up on a slope.
import { ZONES } from './world.js';

// Landmarks on their own hills (each has a building, a path and a name on the map).
export const LANDMARKS = {
  windmill: { name: 'Windmill Hill', x: 60, z: -26, h: 7.5, s: 13 },
  tower: { name: 'Old Watchtower', x: -54, z: -44, h: 9, s: 12 },
  chapel: { name: 'Crooked Chapel', x: 12, z: 60, h: 6, s: 14 },
};

const frac = (v) => v - Math.floor(v);
const hash = (x, z) => frac(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x, z) * 0.6 + vnoise(x * 2.1 + 5, z * 2.1 + 9) * 0.28 + vnoise(x * 4.3 + 11, z * 4.3 + 3) * 0.12;

// Distance from the centre to the coast in the direction `a` (radians, atan2(z, x)).
export function islandR(a) {
  return 79 + 7 * Math.sin(3 * a + 0.6) + 5 * Math.sin(5 * a + 2.1) + 2.5 * Math.sin(9 * a + 4.2);
}
export const ISLAND_MAX = 94;
export function insideIsland(x, z, pad = 0) {
  return Math.hypot(x, z) < islandR(Math.atan2(z, x)) - pad;
}

// How flat the ground must be here: 1 inside a quest area (and a little around it), 0 out in the hills.
export function flatness(x, z) {
  let w = 0;
  for (const k of Object.values(ZONES)) {
    const d = Math.hypot(x - k.x, z - k.z);
    w = Math.max(w, 1 - smooth(clamp((d - k.r - 1) / 7, 0, 1)));
  }
  return w;
}

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z), edge = islandR(Math.atan2(z, x));
  // rolling hills, kept low near the middle of town
  let h = (fbm(x / 26 + 3.1, z / 26 + 7.7) - 0.42) * 7.5 * smooth(clamp((r - 12) / 22, 0, 1));
  h = Math.max(-0.6, h);
  for (const l of Object.values(LANDMARKS)) {
    const d2 = (x - l.x) ** 2 + (z - l.z) ** 2;
    h += l.h * Math.exp(-d2 / (2 * l.s * l.s));
  }
  h *= 1 - flatness(x, z);
  // the lake bowl
  const L = ZONES.lake, dl = Math.hypot(x - L.x, z - L.z);
  if (dl < L.r + 2) h -= 1.2 * (1 - smooth(clamp((dl - L.r + 3) / 5, 0, 1)));
  // past the coast the land rises into wooded cliffs
  if (r > edge - 2) h += Math.pow(Math.max(0, r - edge + 2), 1.3) * 0.5 + (hash(Math.round(x / 6), Math.round(z / 6)) - 0.5) * Math.min(1, (r - edge + 2) / 8) * 2.5;
  return h;
}
