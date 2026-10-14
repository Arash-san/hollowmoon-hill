// The map's artwork, drawn once from the real terrain and world: hill shading and contour lines, the wavy coast,
// water, fields, paths, every house, tree and lamp. The full map and the mini-map both draw from this image and add
// the live layers (players, quests, events) on top.
import { ZONES, PHOTO_BOOTH } from '../../shared/world.js';
import { terrainHeight, islandR } from '../../shared/terrain.js';

export const ART = 1024; // pixels
export const SPAN = 200; // world metres across (-100 .. 100)
export const toArt = (w) => ((w + SPAN / 2) / SPAN) * ART;

let cache = null;

export function mapArt(world) {
  if (cache) return cache;
  const c = document.createElement('canvas');
  c.width = c.height = ART;
  const x = c.getContext('2d');

  // ---- relief raster at half resolution, then scaled up smoothly
  const R = 384, img = new ImageData(R, R), d = img.data;
  const h = new Float32Array(R * R);
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) h[j * R + i] = terrainHeight((i / R) * SPAN - SPAN / 2, (j / R) * SPAN - SPAN / 2);
  const zoneTint = (wx, wz) => {
    for (const [k, z] of Object.entries(ZONES)) {
      const dd = Math.hypot(wx - z.x, wz - z.z);
      if (dd > z.r) continue;
      if (k === 'lake') return [38, 62, 150, 1];
      if (k === 'patch') return Math.floor((wz - z.z) / 1.6) % 2 ? [112, 78, 52, 0.85] : [92, 62, 42, 0.85];
      if (k === 'plaza') return [128, 116, 136, 0.9];
      if (k === 'graveyard') return [58, 74, 72, 0.7];
      if (k === 'arena') return [104, 92, 132, 0.85];
      if (k === 'dance') return [88, 48, 120, 0.8];
      if (k === 'market') return [126, 104, 92, 0.6];
      if (k === 'circle') return [92, 64, 150, 0.55];
      return [74, 96, 70, 0.35];
    }
    return null;
  };
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    const k = j * R + i, wx = (i / R) * SPAN - SPAN / 2, wz = (j / R) * SPAN - SPAN / 2;
    const hh = h[k];
    const dx = (h[k + 1] ?? hh) - (h[k - 1] ?? hh), dz = (h[k + R] ?? hh) - (h[k - R] ?? hh);
    const shade = Math.max(-1, Math.min(1, (-dx - dz) * 0.9)); // light from the north-west
    const r = Math.hypot(wx, wz), edge = islandR(Math.atan2(wz, wx));
    let col;
    if (r > edge + 1) {
      // the dark wood beyond the coast
      col = [26, 44, 36];
    } else {
      const t = Math.max(0, Math.min(1, hh / 9));
      col = [62 + t * 30, 92 + t * 22, 70 + t * 20];
      const z = zoneTint(wx, wz);
      if (z) col = col.map((v, n) => v * (1 - z[3]) + z[n] * z[3]);
      // contour lines every 1.5 m on the hills
      if (hh > 0.6 && Math.abs(((hh / 1.5) % 1) - 0.5) > 0.44) col = col.map((v) => v * 0.78);
    }
    col = col.map((v) => v * (1 + shade * 0.22));
    d.set([col[0], col[1], col[2], 255], k * 4);
  }
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = R;
  tmp.getContext('2d').putImageData(img, 0, 0);
  x.imageSmoothingQuality = 'high';
  x.drawImage(tmp, 0, 0, ART, ART);

  const P = (wx, wz) => [toArt(wx), toArt(wz)];
  const S = ART / SPAN;
  // ---- coast line
  x.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.02) {
    const rr = islandR(a);
    const [px, py] = P(Math.cos(a) * rr, Math.sin(a) * rr);
    a ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.lineWidth = 3;
  x.strokeStyle = 'rgba(255,230,190,.35)';
  x.stroke();
  // ---- lake ripples
  const L = ZONES.lake;
  x.strokeStyle = 'rgba(160,190,255,.35)';
  x.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    x.beginPath();
    x.arc(...P(L.x, L.z), (L.r - 2 - i * 2.6) * S, 0.3 + i, 2.2 + i);
    x.stroke();
  }
  // ---- paths: dark edge, then the light road
  for (const pass of [0, 1]) {
    for (const p of world.paths) {
      x.beginPath();
      p.forEach(([px, pz], i) => (i ? x.lineTo(...P(px, pz)) : x.moveTo(...P(px, pz))));
      x.lineCap = x.lineJoin = 'round';
      x.lineWidth = (p.width || 2.8) * S + (pass ? 0 : 4);
      x.strokeStyle = pass ? (p.kind === 'trail' ? '#9c8468' : '#b8a48e') : 'rgba(28,15,43,.55)';
      if (p.kind === 'trail' && pass) x.setLineDash([8, 6]);
      x.stroke();
      x.setLineDash([]);
    }
  }
  // ---- trees: dark round crowns with a lit edge
  for (const t of world.features.trees) {
    const [px, py] = P(t.x, t.z), rr = (t.r || 2) * S * 0.9;
    x.fillStyle = t.k === 'dead' ? '#4a3a40' : t.k === 'pine' ? '#1f4a34' : '#2c5a3a';
    x.beginPath();
    x.arc(px, py, rr, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = 'rgba(160,220,150,.18)';
    x.beginPath();
    x.arc(px - rr * 0.3, py - rr * 0.3, rr * 0.5, 0, Math.PI * 2);
    x.fill();
  }
  // ---- houses: little rooftops seen from above
  for (const hs of world.features.houses) {
    x.save();
    x.translate(...P(hs.x, hs.z));
    x.rotate(-hs.rot);
    const w = (hs.style === 'tower' ? 4 : 5) * S, dd = 4 * S;
    x.fillStyle = 'rgba(0,0,0,.35)';
    x.fillRect(-w / 2 + 2, -dd / 2 + 2, w, dd);
    if (hs.style === 'tower') {
      x.fillStyle = '#5a3a6a';
      x.beginPath();
      x.arc(0, 0, w / 2, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 2;
      x.stroke();
    } else {
      x.fillStyle = '#6a3442';
      x.fillRect(-w / 2, -dd / 2, w, dd / 2);
      x.fillStyle = '#4a2632';
      x.fillRect(-w / 2, 0, w, dd / 2);
      x.strokeStyle = '#1c0f2b';
      x.lineWidth = 2;
      x.strokeRect(-w / 2, -dd / 2, w, dd);
    }
    // a lit window glow on the door side
    x.fillStyle = '#ffcf6a';
    x.fillRect(-2, dd / 2 - 2, 4, 3);
    x.restore();
  }
  // ---- lamps: warm dots
  for (const l of world.features.lamps) {
    const [px, py] = P(l.x, l.z);
    const g = x.createRadialGradient(px, py, 0, px, py, 9);
    g.addColorStop(0, 'rgba(255,207,106,.9)');
    g.addColorStop(1, 'rgba(255,207,106,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, 9, 0, Math.PI * 2);
    x.fill();
  }
  // ---- the photo booth tent
  const [bx, by] = P(PHOTO_BOOTH.x, PHOTO_BOOTH.z);
  x.fillStyle = '#ff4f8b';
  x.beginPath();
  x.arc(bx, by, 7, 0, Math.PI * 2);
  x.fill();
  // ---- soft vignette so the edges feel like old paper at night
  const v = x.createRadialGradient(ART / 2, ART / 2, ART * 0.3, ART / 2, ART / 2, ART * 0.72);
  v.addColorStop(0, 'rgba(10,4,24,0)');
  v.addColorStop(1, 'rgba(10,4,24,.55)');
  x.fillStyle = v;
  x.fillRect(0, 0, ART, ART);
  cache = c;
  return c;
}
