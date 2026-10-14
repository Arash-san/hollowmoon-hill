// Builds Hollowmoon Hill: ground, paths, every zone's props, the tree ring, ambient life (fireflies, smoke, bats,
// water, dance floor lights). Static props are merged per zone into a few toon + glow meshes with outlines.
import {
  THREE, toonMat, glowMat, col, merge, tf, outlineGeometry, outlineMat, glowSprite, glowTexture, GRADIENT, hash3, carve, sphere, cyl, torus, box, cone, clamp,
} from '../engine/toon.js';
import * as PR from './props.js';
import * as P2 from './props2.js';
import { terrainHeight, insideIsland, islandR, flatness, LANDMARKS } from '../../../shared/terrain.js';
import {
  ZONES, WORLD_RADIUS, CANDLES, CAULDRON, CARVE_TABLE, BOSS_BELL, BRAZIERS, RITUAL_RUNES, DANCE_FLOOR, BOARD, NPCS, SPAWN, PHOTO_BOOTH,
} from '../../../shared/world.js';

const rand = (s) => hash3(s * 1.37, s * 7.11, s * 3.3);

// Ground height: rolling hills, landmark hills, flat quest areas and the lake bowl (shared/terrain.js).
export function groundY(x, z) {
  if (x > 300) return 0; // the Gloom Manor team room, far off the island
  return terrainHeight(x, z);
}
const smooth = (t) => t * t * (3 - 2 * t);

export class World {
  constructor(scene, quality = 1) {
    this.scene = scene;
    this.quality = quality;
    this.colliders = [];
    this.updaters = [];
    this.chunks = new Map();
    this.paths = [];
    this.lights = [];
    this.carvingSlots = [];
    this.anchors = {};
    this.waters = [];
    // what the maps draw: houses, trees, lamps, landmarks
    this.features = { houses: [], trees: [], lamps: [], landmarks: [], walls: [] };
    this.build();
  }

  // ------------------------------------------------------------ placement helpers
  chunk(name) {
    if (!this.chunks.has(name)) this.chunks.set(name, { toon: [], glow: [], outline: true });
    return this.chunks.get(name);
  }

  place(o, x, z, rot = 0, s = 1, chunk = 'misc', y = null) {
    const yy = y ?? groundY(x, z);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, yy, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(s, s, s));
    const c = this.chunk(chunk);
    for (const g of o.toon) c.toon.push(g.clone().applyMatrix4(m));
    for (const g of o.glow) c.glow.push(g.clone().applyMatrix4(m));
    for (const k of o.col || []) {
      if (!k.r) continue;
      const v = new THREE.Vector3(k.x, 0, k.z).applyMatrix4(m);
      this.colliders.push({ x: v.x, z: v.z, r: k.r * s });
    }
    for (const l of o.lights || []) {
      const v = new THREE.Vector3(l.x, l.y, l.z).applyMatrix4(m);
      this.lights.push({ x: v.x, y: v.y, z: v.z, c: l.c, s: l.s * s });
    }
    if (o.smoke) {
      const v = new THREE.Vector3(o.smoke.x, o.smoke.y, o.smoke.z).applyMatrix4(m);
      this.smokes.push({ x: v.x, y: v.y, z: v.z, c: o.smoke.c });
    }
    return o;
  }

  nearPath(x, z, pad = 2.6) {
    for (const p of this.paths) {
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, az] = p[i], [bx, bz] = p[i + 1];
        const dx = bx - ax, dz = bz - az;
        const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
        if ((x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2 < pad * pad) return true;
      }
    }
    return false;
  }

  inZone(x, z, pad = 0) {
    for (const k of Object.values(ZONES)) if ((x - k.x) ** 2 + (z - k.z) ** 2 < (k.r + pad) ** 2) return true;
    return false;
  }

  freeSpot(x, z, r) {
    for (const c of this.colliders) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) return false;
    return true;
  }

  // ------------------------------------------------------------ build
  build() {
    this.smokes = [];
    this.buildSky();
    this.buildPaths();
    this.buildGround();
    this.buildPlaza();
    this.buildGraveyard();
    this.buildArena();
    this.buildCircle();
    this.buildPatch();
    this.buildCottage();
    this.buildWoods();
    this.buildMarket();
    this.buildDance();
    this.buildLake();
    this.buildLandmarks();
    this.buildVillage();
    this.buildDressing();
    this.buildScatter();
    this.buildPerimeter();
    this.flush();
    this.buildLightSprites();
    this.buildAmbient();
  }

  flush() {
    for (const [name, c] of this.chunks) {
      if (c.toon.length) {
        const g = merge(c.toon);
        const m = new THREE.Mesh(g, toonMat);
        m.name = 'chunk-' + name;
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        this.scene.add(m);
        if (c.outline && this.quality > 0) {
          const o = new THREE.Mesh(outlineGeometry(g), outlineMat);
          o.matrixAutoUpdate = false;
          o.updateMatrix();
          o.raycast = () => {};
          this.scene.add(o);
        }
      }
      if (c.glow.length) {
        const m = new THREE.Mesh(merge(c.glow), glowMat);
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        this.scene.add(m);
      }
    }
    this.chunks.clear();
  }

  // ------------------------------------------------------------ sky
  buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color('#090418') }, mid: { value: new THREE.Color('#2b1754') }, low: { value: new THREE.Color('#6b2f5f') } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP;
          void main(){ float h = vP.y; vec3 c = mix(low, mid, smoothstep(-0.05, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    );
    sky.renderOrder = -10;
    this.scene.add(sky);
    this.sky = sky;

    // stars
    const n = 900, pos = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rand(i + 1), v = rand(i + 1000);
      const th = u * Math.PI * 2, ph = Math.acos(1 - v * 0.9);
      pos.set([Math.sin(ph) * Math.cos(th) * 380, Math.cos(ph) * 380, Math.sin(ph) * Math.sin(th) * 380], i * 3);
      size[i] = 1 + rand(i + 2000) * 2.5;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('size', new THREE.BufferAttribute(size, 1));
    this.starMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: { t: { value: 0 } },
      vertexShader: 'attribute float size; uniform float t; varying float a; void main(){ a = 0.55 + 0.45*sin(t*2.0 + position.x*0.37 + position.z*0.11); gl_PointSize = size; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float a; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(1.0,0.95,0.85, a*smoothstep(0.5,0.1,d)); }',
    });
    this.scene.add(new THREE.Points(sg, this.starMat));

    // moon with craters and halo
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(110, 110, 10, 128, 128, 120);
    g.addColorStop(0, '#fffbe8');
    g.addColorStop(1, '#f4dca0');
    x.fillStyle = g;
    x.beginPath();
    x.arc(128, 128, 120, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = 'rgba(200,170,110,0.35)';
    for (const [cx, cy, r] of [[90, 100, 22], [160, 150, 30], [150, 80, 14], [95, 170, 16], [185, 105, 10]]) {
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fill();
    }
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, depthWrite: false }));
    moon.scale.setScalar(46);
    moon.position.set(-120, 150, -260);
    this.scene.add(moon);
    const halo = glowSprite('#ffe9b0', 170, 0.35);
    halo.material.fog = false;
    halo.position.copy(moon.position);
    this.scene.add(halo);

    // distant mountains silhouette ring
    const mg = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2, r = 220 + rand(i + 50) * 40, h = 30 + rand(i + 70) * 45;
      mg.push(col(tf(cone(40 + rand(i) * 30, h, 5), { p: [Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r], r: [0, rand(i + 9) * 3, 0] }), i % 2 ? '#1f1338' : '#26173f'));
    }
    const mountains = new THREE.Mesh(merge(mg), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    this.scene.add(mountains);
  }

  // ------------------------------------------------------------ paths and ground
  buildPaths() {
    // a path is a smooth curve through control points, sampled every ~2.4 m
    const curve = (pts, width = 2.8, kind = 'road') => {
      const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
      const n = Math.max(4, Math.round(c.getLength() / 2.4));
      const out = c.getSpacedPoints(n).map((v) => [v.x, v.z]);
      out.width = width;
      out.kind = kind;
      return out;
    };
    // 1. winding roads from the plaza to every place
    const targets = ['graveyard', 'arena', 'circle', 'patch', 'cottage', 'market', 'dance', 'lake'];
    for (const k of targets) {
      const z = ZONES[k];
      const len = Math.hypot(z.x, z.z), end = len - z.r * 0.4;
      const nx = -z.z / len, nz = z.x / len;
      const pts = [];
      for (let i = 0; i <= 5; i++) {
        const d = 12.5 + (end - 12.5) * (i / 5), tt = d / len;
        const wob = i === 0 || i === 5 ? 0 : (Math.sin(i * 1.7 + k.length) * 4.2 + Math.sin(i * 3.1 + k.length * 2) * 1.6);
        pts.push([z.x * tt + nx * wob, z.z * tt + nz * wob]);
      }
      this.paths.push(curve(pts));
    }
    // 2. a ring road that links neighbouring places, bowing outward through the hills
    const ring = ['graveyard', 'arena', 'circle', 'patch', 'dance', 'market', 'lake', 'cottage', 'woods'];
    for (let i = 0; i < ring.length; i++) {
      const a = ZONES[ring[i]], b = ZONES[ring[(i + 1) % ring.length]];
      if (ring[i] === 'woods' && ring[(i + 1) % ring.length] === 'graveyard') continue;
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
      const ax = a.x + (dx / L) * a.r * 0.9, az = a.z + (dz / L) * a.r * 0.9, bx = b.x - (dx / L) * b.r * 0.9, bz = b.z - (dz / L) * b.r * 0.9;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, ml = Math.hypot(mx, mz) || 1;
      const bow = 7 + (i % 3) * 3;
      const pts = [[ax, az], [mx * 0.75 + ax * 0.25 + (mx / ml) * bow * 0.6, mz * 0.75 + az * 0.25 + (mz / ml) * bow * 0.6], [mx + (mx / ml) * bow, mz + (mz / ml) * bow], [mx * 0.75 + bx * 0.25 + (mx / ml) * bow * 0.6, mz * 0.75 + bz * 0.25 + (mz / ml) * bow * 0.6], [bx, bz]];
      if (pts.every(([x, z]) => insideIsland(x, z, 6))) this.paths.push(curve(pts, 2.3, 'lane'));
    }
    // 3. the cottage track into the woods, and trails up to each landmark hill
    this.paths.push(curve([[ZONES.cottage.x - 6, ZONES.cottage.z - 2], [ZONES.cottage.x - 11, ZONES.cottage.z - 5], [ZONES.woods.x + 6, ZONES.woods.z + 2]], 2.3, 'lane'));
    const spur = (from, l) => {
      const dx = l.x - from.x, dz = l.z - from.z, L = Math.hypot(dx, dz);
      const sx = from.x + (dx / L) * from.r * 0.9, sz = from.z + (dz / L) * from.r * 0.9;
      const ex = l.x - (dx / L) * 4.5, ez = l.z - (dz / L) * 4.5;
      // a zigzag up the hill
      const px = -dz / L, pz = dx / L;
      this.paths.push(curve([[sx, sz], [sx + dx * 0.35 + px * 4, sz + dz * 0.35 + pz * 4], [sx + dx * 0.6 - px * 4, sz + dz * 0.6 - pz * 4], [ex, ez]], 2, 'trail'));
    };
    spur(ZONES.circle, LANDMARKS.windmill);
    spur(ZONES.graveyard, LANDMARKS.tower);
    spur(ZONES.market, LANDMARKS.chapel);

    // ribbons that follow the ground
    const geos = [];
    for (const p of this.paths) {
      const w = (p.width || 2.8) / 2, n = p.length;
      const pos = [], cols = [], idx = [];
      for (let i = 0; i < n; i++) {
        const [x, z] = p[i];
        const [x0, z0] = p[Math.max(0, i - 1)], [x1, z1] = p[Math.min(n - 1, i + 1)];
        const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1;
        const nx = -dz / L, nz = dx / L;
        for (const s of [-1, -0.5, 0, 0.5, 1]) {
          const px = x + nx * w * s, pz = z + nz * w * s;
          pos.push(px, groundY(px, pz) + 0.06 + (1 - Math.abs(s)) * 0.02, pz);
          const h = hash3(Math.round(px * 1.5), 0, Math.round(pz * 1.5));
          const c = new THREE.Color(p.kind === 'trail' ? (h > 0.5 ? '#6d5a48' : '#5f4e40') : h > 0.55 ? '#7d6b6a' : h > 0.25 ? '#706060' : '#665656');
          if (Math.abs(s) === 1) c.multiplyScalar(0.82);
          cols.push(c.r, c.g, c.b);
        }
        if (i < n - 1) for (let k = 0; k < 4; k++) {
          const a = i * 5 + k, b = a + 5;
          idx.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      geos.push(g);
    }
    const m = new THREE.Mesh(merge(geos), toonMat);
    m.renderOrder = 0;
    this.scene.add(m);
  }

  buildGround() {
    const size = 300, seg = this.quality > 0 ? 200 : 120;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundY(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    const L = ZONES.lake;
    const colG = col(g, (x, y, z) => {
      const n = hash3(Math.round(x / 3), 0, Math.round(z / 3)) * 0.6 + hash3(Math.round(x), 1, Math.round(z)) * 0.4;
      const c = new THREE.Color('#3a5a44').lerp(new THREE.Color('#2c4a3c'), n);
      // hills: lighter, mossier on the tops, a little heather purple here and there
      const h = groundY(x, z);
      if (h > 1.2) c.lerp(new THREE.Color(hash3(Math.round(x / 7), 2, Math.round(z / 7)) > 0.7 ? '#5a4a6a' : '#4f7050'), clamp((h - 1.2) / 6, 0, 0.65));
      if (h < -0.2) c.lerp(new THREE.Color('#2a4038'), 0.4);
      const r = Math.hypot(x, z), edge = islandR(Math.atan2(z, x));
      if (r > edge - 3) c.lerp(new THREE.Color('#283a33'), clamp((r - edge + 3) / 12, 0, 1));
      const dl = Math.hypot(x - L.x, z - L.z);
      if (dl < L.r + 2.5) c.lerp(new THREE.Color('#5a4f45'), clamp(1 - (dl - L.r) / 2.5, 0, 1) * 0.8);
      const dp = Math.hypot(x - ZONES.patch.x, z - ZONES.patch.z);
      if (dp < ZONES.patch.r) c.lerp(new THREE.Color(Math.abs(Math.floor((z - ZONES.patch.z) / 1.6)) % 2 ? '#6b4a33' : '#57392a'), clamp((ZONES.patch.r - dp) / 1.5, 0, 1));
      const dg = Math.hypot(x - ZONES.graveyard.x, z - ZONES.graveyard.z);
      if (dg < ZONES.graveyard.r) c.lerp(new THREE.Color('#2f3d3c'), 0.6);
      return c.getHex();
    }, 0.03, false);
    this.groundGeo = colG;
    const ground = new THREE.Mesh(colG, toonMat);
    ground.name = 'ground';
    this.scene.add(ground);
    this.ground = ground;
  }

  buildPlaza() {
    const P0 = ZONES.plaza;
    // cobbled disc in rings
    const disc = new THREE.CircleGeometry(P0.r, 48, 0, Math.PI * 2);
    disc.rotateX(-Math.PI / 2);
    const ringed = col(new THREE.RingGeometry(0.01, P0.r, 48, 10).rotateX(-Math.PI / 2), (x, y, z) => {
      const r = Math.hypot(x, z), a = Math.atan2(z, x);
      const ring = Math.floor(r / 1.5), tile = Math.floor((a + Math.PI) * (6 + ring * 2));
      const n = (ring + tile) % 3;
      return r > P0.r - 0.6 ? '#4f4858' : n === 0 ? '#7d7280' : n === 1 ? '#736874' : '#857a88';
    }, 0.04, true);
    void disc;
    void ringed;
    const plazaGeo = new THREE.CircleGeometry(P0.r, 64).rotateX(-Math.PI / 2);
    const plaza = new THREE.Mesh(plazaGeo, new THREE.MeshToonMaterial({ map: cobbleTexture(12), gradientMap: GRADIENT }));
    plaza.position.set(P0.x, 0.05, P0.z);
    this.scene.add(plaza);
    const rim = new THREE.Mesh(new THREE.RingGeometry(P0.r - 0.5, P0.r + 0.2, 64).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: '#4f4858', gradientMap: GRADIENT }));
    rim.position.set(P0.x, 0.06, P0.z);
    this.scene.add(rim);

    this.place(PR.fountain(), 0, 0, 0, 1, 'plaza');
    this.anchors.fountain = { x: 0, z: 0 };
    // water in the basin
    const water = new THREE.Mesh(new THREE.CircleGeometry(4.0, 32).rotateX(-Math.PI / 2), makeWater('#3a2a7a', '#8f7bff'));
    water.position.set(0, 0.74, 0);
    this.scene.add(water);
    this.waters.push(water);

    const lamps = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * 12.8, z = Math.sin(a) * 12.8;
      this.place(PR.lampPost(i), x, z, -a + Math.PI, 1, 'plaza');
      lamps.push([x, z, a]);
    }
    for (let i = 0; i < 8; i++) {
      const [x1, z1, a1] = lamps[i], [x2, z2, a2] = lamps[(i + 1) % 8];
      const f = (a, x, z) => [x + Math.cos(-a + Math.PI) * 0.5, 2.75, z - Math.sin(-a + Math.PI) * 0.5];
      void a2;
      this.place(PR.bunting(f(a1, x1, z1), f(a2, x2, z2), i), 0, 0, 0, 1, 'plaza', 0);
    }
    for (const a of [0.55, 2.0, 3.9, 5.35]) this.place(PR.bench(), Math.cos(a) * 9.6, Math.sin(a) * 9.6, -a - Math.PI / 2, 1, 'plaza');
    this.place(PR.noticeBoard(), BOARD.x, BOARD.z, Math.atan2(-BOARD.x, -BOARD.z), 1, 'plaza');
    // photo booth tent facing the fountain, with a sign you can read from across the plaza
    const B = PHOTO_BOOTH;
    this.place(PR.photoBooth(), B.x, B.z, Math.atan2(-B.x, -B.z), 1, 'plaza');
    const sign = labelSprite('📸 PHOTO BOOTH', '#ff4f8b');
    sign.position.set(B.x, 4.9, B.z);
    this.scene.add(sign);
    this.boothSign = sign;
    const M = NPCS.mayor;
    const back = Math.atan2(M.faceTo[0] - M.x, M.faceTo[1] - M.z);
    this.place(PR.stall(1, '#ff7a1a', '#7b4dff'), M.x - Math.sin(back) * 2.0, M.z - Math.cos(back) * 2.0, back, 1, 'plaza');
    for (let i = 0; i < 10; i++) {
      const a = i * 0.63 + 0.3, r = 14 + rand(i + 5) * 0.5;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!this.nearPath(x, z, 2.2)) this.place(PR.pumpkin(i, 0.7 + rand(i) * 0.4, true), x, z, rand(i + 3) * 6, 1, 'plaza');
    }
    // carving gallery: pedestals in a ring outside the plaza, skipping the paths
    for (let i = 0; this.carvingSlots.length < 36 && i < 120; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r = 19.5 + (i % 2) * 1.6;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.nearPath(x, z, 2.4)) continue;
      if (this.carvingSlots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 2.8 ** 2)) continue;
      const rot = Math.atan2(-x, -z);
      this.place(PR.pedestal(), x, z, rot, 1, 'plaza');
      this.carvingSlots.push({ x, z, rot, y: 0.87 });
    }
  }

  buildGraveyard() {
    const G = ZONES.graveyard;
    // fence ring with a gate toward the plaza
    const gate = Math.atan2(-G.z, -G.x);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      let d = Math.abs(((a - gate + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < 0.25) continue;
      const x = G.x + Math.cos(a) * (G.r + 1), z = G.z + Math.sin(a) * (G.r + 1);
      this.place(PR.fence(5.2), x, z, -a + Math.PI / 2, 1, 'grave');
      this.colliders.push({ x, z, r: 1.4 });
    }
    CANDLES.forEach((c, i) => {
      this.place(PR.grave(i * 3 + 1), c.x, c.z - 0.7, 0, 1, 'grave');
    });
    for (let i = 0; i < 10; i++) {
      const x = G.x + (rand(i + 40) - 0.5) * G.r * 1.6, z = G.z + (rand(i + 60) - 0.5) * G.r * 1.6;
      if (Math.hypot(x - G.x, z - G.z) > G.r - 1.5 || !this.freeSpot(x, z, 1.4) || this.nearPath(x, z, 2)) continue;
      this.place(PR.grave(i + 100), x, z, (rand(i) - 0.5) * 0.6, 1, 'grave');
    }
    this.place(PR.mausoleum(), G.x - 6, G.z - 9, 0.5, 1, 'grave');
    this.place(PR.deadTree(3, 5.5), G.x + 8, G.z - 8, 0, 1, 'grave');
    this.place(PR.deadTree(7, 4.5), G.x - 11, G.z + 3, 1, 1, 'grave');
    for (let i = 0; i < 6; i++) this.place(PR.candleCluster(i), G.x + (rand(i + 9) - 0.5) * 18, G.z + (rand(i + 19) - 0.5) * 18, 0, 1, 'grave');
  }

  buildArena() {
    const A = ZONES.arena;
    const floor = new THREE.CircleGeometry(A.r, 48).rotateX(-Math.PI / 2);
    const f = col(new THREE.RingGeometry(0.01, A.r, 48, 8).rotateX(-Math.PI / 2), (x, y, z) => {
      const r = Math.hypot(x, z), a = Math.atan2(z, x);
      if (r > A.r - 0.7) return '#4a4260';
      if (Math.abs(r - 6) < 0.25 || Math.abs(r - 10) < 0.25) return '#b78bff';
      const n = (Math.floor(r / 2) + Math.floor((a + Math.PI) * 5)) % 2;
      return n ? '#5d5670' : '#686281';
    }, 0.05, true);
    void floor;
    void f;
    const arenaFloor = new THREE.Mesh(new THREE.CircleGeometry(A.r, 64).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: cobbleTexture(7, ['#5d5670', '#686281', '#544d68', '#72698c']), gradientMap: GRADIENT }));
    arenaFloor.position.set(A.x, 0.05, A.z);
    this.scene.add(arenaFloor);
    for (const rr of [6, 10]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rr - 0.18, rr + 0.18, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#9a6bff' }));
      ring.position.set(A.x, 0.07, A.z);
      this.scene.add(ring);
    }
    for (const [i, b] of BRAZIERS.entries()) this.place(PR.brazier(), b.x, b.z, 0, 1, 'arena');
    this.place(PR.bellPost(), BOSS_BELL.x, BOSS_BELL.z, Math.atan2(A.x - BOSS_BELL.x, A.z - BOSS_BELL.z) + Math.PI / 2, 1, 'arena');
    this.place(PR.manor(), 0, -80, 0, 1, 'manor');
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const a = sx * (0.6 + i * 0.32) - Math.PI / 2;
        const x = A.x + Math.cos(a) * (A.r + 3), z = A.z + Math.sin(a) * (A.r + 3);
        this.place(PR.fence(4.5), x, z, -a + Math.PI / 2, 1, 'arena');
        this.colliders.push({ x, z, r: 1.3 });
      }
      this.place(PR.deadTree(20 + sx, 6), A.x + sx * 19, A.z - 2, 0, 1, 'arena');
      this.place(PR.lampPost(sx + 5, '#b78bff'), A.x + sx * 6, A.z + A.r + 1, sx > 0 ? Math.PI : 0, 1, 'arena');
    }
  }

  buildCircle() {
    const Cz = ZONES.circle;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Cz.x + Math.cos(a) * 8.5, z = Cz.z + Math.sin(a) * 8.5;
      if (this.nearPath(x, z, 1.8)) continue;
      this.place(PR.runeStone(i + 3, 2.2 + rand(i) * 1.2), x, z, -a + Math.PI / 2, 1, 'circle');
    }
    const altar = PR.P();
    altar.toon.push(col(tf(cyl(1.1, 1.3, 0.7, 8), { p: [0, 0.35, 0] }), '#6d6884', 0.08));
    altar.col.push({ x: 0, z: 0, r: 1.3 });
    this.place(altar, Cz.x, Cz.z, 0, 1, 'circle');
    this.anchors.altar = { x: Cz.x, z: Cz.z };
  }

  buildPatch() {
    const Pz = ZONES.patch;
    for (let i = 0; i < 26; i++) {
      const a = rand(i + 300) * Math.PI * 2, r = Math.sqrt(rand(i + 310)) * (Pz.r - 1);
      const x = Pz.x + Math.cos(a) * r, z = Pz.z + Math.sin(a) * r;
      if (!this.freeSpot(x, z, 0.8)) continue;
      this.place(PR.pumpkin(i + 7, 0.6 + rand(i) * 0.9), x, z, rand(i + 2) * 6, 1, 'patch');
    }
    // vines
    const vines = PR.P();
    for (let i = 0; i < 14; i++) {
      const x0 = (rand(i + 400) - 0.5) * Pz.r * 1.6, z0 = (rand(i + 410) - 0.5) * Pz.r * 1.6;
      vines.toon.push(col(PR.tube([[x0, 0.08, z0], [x0 + 1.2, 0.12, z0 + 0.8], [x0 + 2.2, 0.08, z0 - 0.3], [x0 + 3.4, 0.1, z0 + 0.4]], 0.05, 10, 4), '#4f7a2c'));
      for (let k = 0; k < 3; k++) vines.toon.push(col(tf(sphere(0.25, 6, 4), { p: [x0 + k * 1.1 + 0.4, 0.1, z0 + (k % 2 ? 0.5 : -0.2)], s: [1.2, 0.18, 0.9], r: [0, k, 0] }), '#5d8a2c'));
    }
    this.place(vines, Pz.x, Pz.z, 0, 1, 'patch', 0);
    for (const [dx, dz, r] of [[-12, -9, 0.4], [12, -8, 1.2], [13, 7, 2], [-3, 13, 0.8]]) this.place(PR.hayBale(r), Pz.x + dx, Pz.z + dz, r, 1, 'patch');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = Pz.x + Math.cos(a) * (Pz.r + 1.2), z = Pz.z + Math.sin(a) * (Pz.r + 1.2);
      if (this.nearPath(x, z, 3)) continue;
      this.place(PR.woodFence(8), x, z, -a + Math.PI / 2, 1, 'patch');
      this.colliders.push({ x, z, r: 1.2 }, { x: x + Math.sin(a) * 2.6, z: z - Math.cos(a) * 2.6, r: 1.2 }, { x: x - Math.sin(a) * 2.6, z: z + Math.cos(a) * 2.6, r: 1.2 });
    }
    this.place(PR.scarecrowPost(), NPCS.hayley.x, NPCS.hayley.z, 0, 1, 'patch');
    this.place(PR.carvingTable(), CARVE_TABLE.x, CARVE_TABLE.z, 0.3, 1, 'patch');
    this.place(PR.lampPost(31), CARVE_TABLE.x + 2.2, CARVE_TABLE.z - 1, 2.5, 1, 'patch');
  }

  buildCottage() {
    const Cz = ZONES.cottage;
    this.place(PR.cottage(), Cz.x - 6, Cz.z - 2, Math.PI / 2, 1, 'cottage');
    this.place(PR.cauldron(), CAULDRON.x, CAULDRON.z, 0, 1, 'cottage');
    for (let i = 0; i < 6; i++) this.place(PR.mushroom(i + 50, 1.2), Cz.x + (rand(i + 70) - 0.5) * 16, Cz.z + (rand(i + 80) - 0.5) * 16, 0, 1, 'cottage');
    this.place(PR.barrel(1), Cz.x - 2, Cz.z + 6, 0, 1, 'cottage');
    this.place(PR.crate(), Cz.x - 3.2, Cz.z + 6.5, 0.4, 1, 'cottage');
    this.place(PR.lampPost(12, '#a8ff9c'), CAULDRON.x + 3, CAULDRON.z + 1.5, 2.2, 1, 'cottage');
    this.anchors.cauldron = CAULDRON;
  }

  buildWoods() {
    const W = ZONES.woods;
    let placed = 0;
    for (let i = 0; i < 160 && placed < 34; i++) {
      const a = rand(i + 500) * Math.PI * 2, r = Math.sqrt(rand(i + 510)) * (W.r + 6);
      const x = W.x + Math.cos(a) * r, z = W.z + Math.sin(a) * r;
      if (!insideIsland(x, z, 2) || !this.freeSpot(x, z, 2.6) || this.nearPath(x, z, 2.5) || this.inZone(x, z, 1) && Math.hypot(x - W.x, z - W.z) > W.r) continue;
      const k = i % 3;
      this.place(k === 0 ? PR.deadTree(i, 4 + rand(i) * 3) : k === 1 ? PR.pine(i, 5 + rand(i) * 3) : PR.roundTree(i, 3 + rand(i) * 1.5), x, z, rand(i + 1) * 6, 1, 'woods');
      this.features.trees.push({ x, z, r: 2, k: k === 1 ? 'pine' : k === 0 ? 'dead' : 'round' });
      placed++;
    }
    for (let i = 0; i < 16; i++) {
      const x = W.x + (rand(i + 600) - 0.5) * W.r * 2, z = W.z + (rand(i + 610) - 0.5) * W.r * 2;
      if (insideIsland(x, z, 2)) this.place(PR.mushroom(i + 90, 1 + rand(i) * 0.8), x, z, 0, 1, 'woods');
    }
  }

  buildMarket() {
    const Mz = ZONES.market;
    const C = NPCS.count, B = NPCS.bones;
    const cy = Math.atan2(C.faceTo[0] - C.x, C.faceTo[1] - C.z), by = Math.atan2(B.faceTo[0] - B.x, B.faceTo[1] - B.z);
    this.place(PR.bankBooth(), C.x - Math.sin(cy) * 1.2, C.z - Math.cos(cy) * 1.2, cy, 1, 'market');
    this.place(PR.stall(2, '#2ec4b6', '#f4f0ff'), B.x - Math.sin(by) * 2.0, B.z - Math.cos(by) * 2.0, by, 1, 'market');
    this.place(PR.stall(3, '#ff4f8b', '#ffd23f'), Mz.x + 1, Mz.z + 9, Math.PI, 1, 'market');
    for (let i = 0; i < 6; i++) this.place(i % 2 ? PR.barrel(i) : PR.crate(), Mz.x + (i - 2.5) * 2.4 + (i % 2) * 0.5, Mz.z + 11.5 + (i % 2), i, 1, 'market');
    for (const sx of [-1, 1]) {
      this.place(PR.lampPost(sx + 40), Mz.x + sx * 6, Mz.z - 3, sx > 0 ? Math.PI : 0, 1, 'market');
      this.place(PR.lampPost(sx + 44), Mz.x + sx * 6, Mz.z + 6, sx > 0 ? Math.PI : 0, 1, 'market');
    }
    this.place(PR.bunting([Mz.x - 5.5, 2.75, Mz.z - 3], [Mz.x + 5.5, 2.75, Mz.z - 3], 1), 0, 0, 0, 1, 'market', 0);
    this.place(PR.bunting([Mz.x - 5.5, 2.75, Mz.z + 6], [Mz.x + 5.5, 2.75, Mz.z + 6], 2), 0, 0, 0, 1, 'market', 0);
  }

  buildDance() {
    const D = DANCE_FLOOR;
    // light-up tiles, animated in the shader
    const tiles = new THREE.PlaneGeometry(D.r * 2, D.r * 2, 1, 1).rotateX(-Math.PI / 2);
    this.danceMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, party: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float t; uniform float party; varying vec2 vP;
        vec3 pal(float k){ return 0.5 + 0.5*cos(6.2831*(k + vec3(0.0,0.33,0.67))); }
        void main(){ vec2 c = floor(vP / 1.5); vec2 f = fract(vP / 1.5);
          float r = length(vP); if (r > ${D.r.toFixed(1)}) discard;
          float k = fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453);
          float on = step(0.5, fract(k + t * (0.6 + party * 1.4)));
          vec3 col = mix(vec3(0.12,0.08,0.2), pal(k + t * 0.1) * (0.6 + party * 0.6), on * (0.55 + party * 0.45));
          float edge = step(0.06, f.x) * step(0.06, f.y);
          gl_FragColor = vec4(col * edge + vec3(0.05,0.03,0.08) * (1.0 - edge), 1.0); }`,
    });
    const floor = new THREE.Mesh(tiles, this.danceMat);
    floor.position.set(D.x, 0.06, D.z);
    this.scene.add(floor);
    const dj = NPCS.dj;
    this.place(PR.djBooth(), dj.x, dj.z - 1.2, 0, 1, 'dance');
    // disco skull ball
    const ball = new THREE.Group();
    const skull = new THREE.Mesh(merge([col(sphere(0.7, 12, 10), (x, y, z) => (hash3(Math.round(x * 6), Math.round(y * 6), Math.round(z * 6)) > 0.5 ? '#e9e4ff' : '#9a8fc9'), 0, true)]), toonMat);
    ball.add(skull);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(sphere(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#21142b' }));
      eye.position.set(sx * 0.25, 0.1, 0.6);
      ball.add(eye);
    }
    ball.position.set(D.x, 5.2, D.z);
    this.scene.add(ball);
    this.discoBall = ball;
    const pole = PR.P();
    pole.toon.push(col(tf(cyl(0.05, 0.05, 1.5, 4), { p: [0, 5.9, 0] }), '#2b2236'));
    this.place(pole, D.x, D.z, 0, 1, 'dance', 0);
    // sweeping light beams
    this.beams = [];
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: ['#ff4f8b', '#2ec4b6', '#ffd23f', '#7b4dff'][i], transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.geometry.translate(0, -3, 0);
      const holder = new THREE.Group();
      holder.position.set(D.x + (i % 2 ? 4 : -4), 6, D.z + (i < 2 ? -3 : 3));
      holder.add(beam);
      this.scene.add(holder);
      this.beams.push(holder);
    }
    for (const sx of [-1, 1]) this.place(PR.lampPost(sx + 60, '#ff7af2'), D.x + sx * 7.5, D.z - 4, sx > 0 ? Math.PI : 0, 1, 'dance');
  }

  buildLake() {
    const L = ZONES.lake;
    const water = new THREE.Mesh(new THREE.CircleGeometry(L.r + 1.5, 48).rotateX(-Math.PI / 2), makeWater('#15204a', '#5f7bff'));
    water.position.set(L.x, -0.35, L.z);
    this.scene.add(water);
    this.waters.push(water);
    this.colliders.push({ x: L.x, z: L.z, r: L.r - 0.5 });
    this.place(PR.dock(), L.x + L.r - 1.5, L.z - 2, Math.PI / 2 + 0.3, 1, 'lake', -0.4);
    this.boats = [];
    for (let i = 0; i < 7; i++) {
      const b = PR.lanternBoat(i);
      const m = new THREE.Group();
      m.add(new THREE.Mesh(merge(b.toon), toonMat), new THREE.Mesh(merge(b.glow), glowMat));
      const s = glowSprite(['#ffb347', '#ff7a9c', '#9ef0ff'][i % 3], 1.6, 0.6);
      s.position.y = 0.5;
      m.add(s);
      this.scene.add(m);
      this.boats.push({ m, a: (i / 7) * Math.PI * 2, r: 3 + (i % 3) * 3, sp: 0.05 + rand(i) * 0.05 });
    }
    for (let i = 0; i < 18; i++) {
      const a = rand(i + 700) * Math.PI * 2;
      const x = L.x + Math.cos(a) * (L.r + 1.5), z = L.z + Math.sin(a) * (L.r + 1.5);
      if (this.nearPath(x, z, 2)) continue;
      this.place(PR.grassTuft(i), x, z, a, 1.4, 'lake');
    }
    for (let i = 0; i < 8; i++) {
      const pad = PR.P();
      pad.toon.push(col(carve(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2), (x, y, z) => !(x > 0 && Math.abs(z) < x * 0.3)), '#3f7a4a'));
      const a = rand(i + 800) * Math.PI * 2, r = 2 + rand(i + 810) * (L.r - 3);
      this.place(pad, L.x + Math.cos(a) * r, L.z + Math.sin(a) * r, a, 1, 'lake', -0.33);
    }
  }

  buildScatter() {
    let n = 0;
    for (let i = 0; i < 1400 && n < 130; i++) {
      const a = rand(i + 900) * Math.PI * 2, r = 16 + Math.sqrt(rand(i + 910)) * 80;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!insideIsland(x, z, 4) || this.inZone(x, z, 3) || this.nearPath(x, z, 3) || !this.freeSpot(x, z, 2.4)) continue;
      const k = rand(i + 920);
      const tall = k < 0.62;
      const o = k < 0.3 ? PR.roundTree(i, 3 + rand(i) * 1.6) : k < 0.47 ? PR.deadTree(i, 3.5 + rand(i) * 2) : k < 0.62 ? PR.pine(i, 4.5 + rand(i) * 2) : k < 0.72 ? PR.rock(i, 0.8 + rand(i)) : k < 0.8 ? P2.bush(i, 0.8 + rand(i) * 0.6) : k < 0.86 ? PR.pumpkin(i, 0.6 + rand(i) * 0.6, rand(i + 1) > 0.5) : k < 0.92 ? P2.log(i) : PR.mushroom(i, 1);
      this.place(o, x, z, rand(i + 1) * 6, 1, n % 3 === 0 ? 'scatterA' : n % 3 === 1 ? 'scatterB' : 'scatterC');
      if (tall) this.features.trees.push({ x, z, r: 2, k: k < 0.3 ? 'round' : k < 0.47 ? 'dead' : 'pine' });
      n++;
    }
    for (let i = 0; i < 160; i++) {
      const a = rand(i + 1200) * Math.PI * 2, r = 16 + Math.sqrt(rand(i + 1210)) * 80;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!insideIsland(x, z, 2) || this.nearPath(x, z, 1.8) || this.inZone(x, z, 0)) continue;
      this.place(i % 4 ? PR.grassTuft(i) : P2.flowers(i), x, z, a, 1, 'tufts');
    }
    this.chunk('tufts').outline = false;
  }

  buildPerimeter() {
    // a thick wood along the wavy coast
    for (let i = 0; i < 300; i++) {
      const a = (i / 300) * Math.PI * 2 + rand(i) * 0.02;
      const r = islandR(a) + 1 + rand(i + 1500) * 24;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const k = rand(i + 1600);
      const o = k < 0.5 ? PR.pine(i, 6 + rand(i) * 4) : k < 0.8 ? PR.deadTree(i, 5 + rand(i) * 3) : PR.roundTree(i, 4 + rand(i) * 2);
      this.place(o, x, z, rand(i + 2) * 6, 1.1 + rand(i + 3) * 0.5, 'ring' + (i % 4));
      if (r < islandR(a) + 8) this.features.trees.push({ x, z, r: 2.5, k: 'pine' });
    }
    for (let i = 0; i < 4; i++) this.chunk('ring' + i).outline = this.quality > 1;
  }

  // ------------------------------------------------------------ landmarks on their hills
  buildLandmarks() {
    const W = LANDMARKS.windmill;
    this.place(P2.windmill(), W.x, W.z, Math.atan2(-W.x, -W.z), 1, 'landmarks');
    const sails = new THREE.Mesh(merge(P2.sails()), toonMat);
    const face = Math.atan2(-W.x, -W.z);
    sails.position.set(W.x + Math.sin(face) * 1.95, groundY(W.x, W.z) + 6.2, W.z + Math.cos(face) * 1.95);
    sails.rotation.y = face;
    this.scene.add(sails);
    this.sails = sails;
    const T = LANDMARKS.tower;
    this.place(P2.watchtower(), T.x, T.z, Math.atan2(-T.x, -T.z), 1, 'landmarks');
    const C = LANDMARKS.chapel;
    this.place(P2.chapel(), C.x, C.z, Math.atan2(-C.x, -C.z), 1, 'landmarks');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4, x = C.x + Math.cos(a) * 8, z = C.z + Math.sin(a) * 8;
      if (!this.nearPath(x, z, 2) && this.freeSpot(x, z, 0.8)) this.place(PR.grave(i + 300), x, z, Math.atan2(C.x - x, C.z - z), 1, 'landmarks');
    }
    for (const l of Object.values(LANDMARKS)) this.features.landmarks.push({ x: l.x, z: l.z, name: l.name, icon: l === W ? 'windmill' : l === T ? 'tower' : 'chapel' });
    this.features.landmarks.push({ x: 0, z: -80, name: 'Gloom Manor', icon: 'manor' });
  }

  // ------------------------------------------------------------ the village: detailed houses along the roads
  buildVillage() {
    let made = 0;
    const styles = ['cottage', 'town', 'cottage', 'tower', 'town', 'cottage'];
    for (const [pi, p] of this.paths.entries()) {
      if (p.kind === 'trail') continue;
      for (let i = 2; i < p.length - 2; i += 3) for (const [side, off] of [[1, 7.5], [-1, 7.5], [1, 11], [-1, 11]]) {
        const [x0, z0] = p[i - 1], [x1, z1] = p[i + 1];
        const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1;
        const x = p[i][0] + (-dz / L) * off * side, z = p[i][1] + (dx / L) * off * side;
        const st = (this.villageStats ||= { tried: 0, coast: 0, zone: 0, path: 0, taken: 0, steep: 0 });
        st.tried++;
        if (!insideIsland(x, z, 8)) { st.coast++; continue; }
        if (this.inZone(x, z, 3)) { st.zone++; continue; }
        if (this.nearPath(x, z, 5)) { st.path++; continue; }
        if (!this.freeSpot(x, z, 4)) { st.taken++; continue; }
        if (Math.abs(groundY(x + 2, z) - groundY(x - 2, z)) > 1.6 || Math.abs(groundY(x, z + 2) - groundY(x, z - 2)) > 1.6) { st.steep++; continue; }
        const rot = Math.atan2(p[i][0] - x, p[i][1] - z);
        const style = styles[(made + pi) % styles.length];
        const h = P2.houseV2(pi * 100 + i + 1, style);
        this.place(h, x, z, rot, 1, made % 2 ? 'housesA' : 'housesB');
        this.features.houses.push({ x, z, rot, s: style === 'tower' ? 2 : 2.4, style });
        // a picket fence and a bush or two in front
        const fx = x + Math.sin(rot) * 4.6, fz = z + Math.cos(rot) * 4.6;
        if (made % 3 !== 2) {
          for (const s of [-1, 1]) this.place(P2.picketFence(1.8), fx + Math.cos(rot) * s * 1.9, fz - Math.sin(rot) * s * 1.9, rot, 1, 'housesA');
        }
        this.place(P2.bush(made + 40, 0.9), x + Math.cos(rot) * 3.4, z - Math.sin(rot) * 3.4, 0, 1, 'housesB');
        if (made % 4 === 1) this.place(P2.pumpkinPile(made), x - Math.cos(rot) * 3.2 + Math.sin(rot) * 3, z + Math.sin(rot) * 3.2 + Math.cos(rot) * 3, 0, 1, 'housesB');
        made++;
        if (made >= 40) return;
      }
    }
  }

  // ------------------------------------------------------------ lamps, signposts and small things along the roads
  buildDressing() {
    // lamps every ~15 m on the roads, lanterns on poles along the lanes and trails
    let k = 0;
    for (const p of this.paths) {
      const step = p.kind === 'road' ? 6 : 7;
      for (let i = 2; i < p.length - 1; i += step) {
        const [x0, z0] = p[i - 1], [x1, z1] = p[i + 1];
        const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1;
        const side = k % 2 ? 1 : -1;
        const x = p[i][0] + (-dz / L) * (p.width / 2 + 0.9) * side, z = p[i][1] + (dx / L) * (p.width / 2 + 0.9) * side;
        if (this.inZone(x, z, 0) || !this.freeSpot(x, z, 0.6)) continue;
        const face = Math.atan2(p[i][0] - x, p[i][1] - z) - Math.PI / 2;
        this.place(p.kind === 'road' ? PR.lampPost(k) : P2.lanternPole(k), x, z, face, 1, 'lamps');
        this.features.lamps.push({ x, z });
        k++;
      }
    }
    // signposts where the roads leave the plaza
    for (const [i, p] of this.paths.slice(0, 8).entries()) {
      const [x, z] = p[1];
      const a = Math.atan2(p[3][1] - z, p[3][0] - x);
      this.place(P2.signpostV2([0.4, -0.5], i), x + Math.cos(a + 1.4) * 2.2, z + Math.sin(a + 1.4) * 2.2, -a, 1, 'lamps');
    }
    // wells, carts, walls, logs and fairy rings in the open country
    const spots = [[18, 12, 'well'], [-16, -12, 'well'], [24, 30, 'cart'], [52, 18, 'cart'], [-22, 30, 'cart'], [-46, 32, 'ring'], [44, -44, 'ring'], [-60, 18, 'ring'], [20, -42, 'wall'], [-44, -22, 'wall'], [40, 54, 'wall'], [-14, 52, 'wall']];
    for (const [x, z, kind] of spots) {
      if (this.inZone(x, z, 2) || this.nearPath(x, z, 2.5) || !this.freeSpot(x, z, 1.5) || !insideIsland(x, z, 6)) continue;
      const o = kind === 'well' ? P2.well() : kind === 'cart' ? P2.cart(x + z) : kind === 'ring' ? P2.mushroomRing(x) : P2.stoneWall(7, x);
      this.place(o, x, z, rand(x * 3 + z) * 6, 1, 'dressing');
      if (kind === 'wall') this.features.walls.push({ x, z });
    }
    for (let i = 0; i < 40; i++) {
      const a = rand(i + 3000) * Math.PI * 2, r = 18 + rand(i + 3010) * 60;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!insideIsland(x, z, 5) || this.inZone(x, z, 2) || this.nearPath(x, z, 2.2) || !this.freeSpot(x, z, 1)) continue;
      this.place(i % 3 ? P2.bush(i + 500, 0.7 + rand(i) * 0.6) : P2.flowers(i + 500), x, z, 0, 1, 'dressing');
    }
  }

  buildLightSprites() {
    for (const l of this.lights) {
      const s = glowSprite(l.c, l.s, 0.55);
      s.position.set(l.x, l.y, l.z);
      this.scene.add(s);
      this.updaters.push((t) => s.material.opacity = 0.45 + Math.sin(t * 7 + l.x) * 0.04 + Math.sin(t * 13 + l.z) * 0.03);
      // warm light pool on the ground
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMaterial(l.c));
      m.scale.setScalar(l.s * 2.4);
      m.position.set(l.x, groundY(l.x, l.z) + 0.08, l.z);
      this.scene.add(m);
    }
  }

  buildAmbient() {
    // fireflies
    const n = this.quality > 0 ? 260 : 120;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = rand(i + 2000) * Math.PI * 2, r = 6 + Math.sqrt(rand(i + 2010)) * (WORLD_RADIUS - 6);
      pos.set([Math.cos(a) * r, 0.6 + rand(i + 2020) * 2.5, Math.sin(a) * r], i * 3);
      seed[i] = rand(i + 2030) * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.fireflyMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 }, scale: { value: 300 } },
      vertexShader: `attribute float seed; uniform float t; uniform float scale; varying float a;
        void main(){ vec3 p = position + vec3(sin(t*0.5+seed)*1.2, sin(t*0.9+seed*1.3)*0.5, cos(t*0.4+seed*0.7)*1.2);
          vec4 mv = modelViewMatrix * vec4(p,1.0); a = 0.4 + 0.6*max(0.0, sin(t*2.0 + seed*3.0));
          gl_PointSize = scale * 0.14 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'varying float a; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(1.0,0.9,0.45, a*smoothstep(0.5,0.0,d)); }',
    });
    this.scene.add(new THREE.Points(g, this.fireflyMat));

    // chimney smoke puffs
    this.smokeParts = [];
    for (const s of this.smokes) {
      for (let k = 0; k < 5; k++) {
        const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), color: s.c || '#b9a6d9', transparent: true, opacity: 0.4, depthWrite: false }));
        this.scene.add(p);
        this.smokeParts.push({ p, s, off: k / 5 });
      }
    }

    // bats circling the manor and the graveyard
    this.bats = [];
    const batGeo = merge([col(sphere(0.18, 6, 4), '#1a1026'), col(tf(new THREE.PlaneGeometry(0.8, 0.3), { p: [0.4, 0, 0] }), '#1a1026'), col(tf(new THREE.PlaneGeometry(0.8, 0.3), { p: [-0.4, 0, 0] }), '#1a1026')]);
    const batMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(batGeo, batMat);
      this.scene.add(m);
      const center = i < 8 ? { x: 0, z: -70, y: 18 } : { x: ZONES.graveyard.x, z: ZONES.graveyard.z, y: 9 };
      this.bats.push({ m, c: center, r: 6 + rand(i) * 10, sp: 0.4 + rand(i + 5) * 0.5, ph: rand(i + 9) * 6 });
    }
  }

  update(t, dt, camera, partying = 0) {
    if (this.sails) this.sails.rotation.z = t * 0.35;
    this.starMat.uniforms.t.value = t;
    this.fireflyMat.uniforms.t.value = t;
    if (this.danceMat) {
      this.danceMat.uniforms.t.value = t;
      this.danceMat.uniforms.party.value += (partying - this.danceMat.uniforms.party.value) * Math.min(1, dt * 2);
    }
    for (const w of this.waters) w.material.uniforms.t.value = t;
    for (const u of this.updaters) u(t, dt);
    if (this.discoBall) this.discoBall.rotation.y = t * (0.6 + partying * 2);
    if (this.beams) this.beams.forEach((b, i) => b.rotation.set(Math.sin(t * (0.7 + i * 0.2)) * 0.6, 0, Math.cos(t * (0.5 + i * 0.25)) * 0.6));
    for (const b of this.boats || []) {
      b.a += b.sp * dt;
      const L = ZONES.lake;
      b.m.position.set(L.x + Math.cos(b.a) * b.r, -0.3 + Math.sin(t * 1.5 + b.r) * 0.05, L.z + Math.sin(b.a) * b.r);
      b.m.rotation.y = -b.a;
    }
    for (const s of this.smokeParts || []) {
      const k = (t * 0.25 + s.off) % 1;
      s.p.position.set(s.s.x + Math.sin(t + s.off * 6) * 0.3 + k * 0.8, s.s.y + k * 3.5, s.s.z);
      s.p.scale.setScalar(0.6 + k * 1.8);
      s.p.material.opacity = 0.45 * (1 - k);
    }
    for (const b of this.bats || []) {
      const a = t * b.sp + b.ph;
      b.m.position.set(b.c.x + Math.cos(a) * b.r, b.c.y + Math.sin(a * 2.3) * 2, b.c.z + Math.sin(a) * b.r);
      b.m.rotation.y = -a;
      b.m.scale.set(1, 1, 1);
      b.m.rotation.z = Math.sin(t * 20 + b.ph) * 0.5;
    }
    void camera;
  }
}


// Hand-drawn cobblestones on a canvas, tiled across round floors.
// A billboard text sign (always faces the camera), e.g. the photo booth label.
export function labelSprite(text, bg = '#7b4dff', w = 512, h = 128) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.font = '700 64px Fredoka, "Segoe UI Emoji", sans-serif';
  const tw = Math.min(w - 20, x.measureText(text).width + 60);
  x.fillStyle = '#1c0f2b';
  x.beginPath();
  x.roundRect((w - tw) / 2 - 4, 8, tw + 8, h - 16, 34);
  x.fill();
  x.fillStyle = bg;
  x.beginPath();
  x.roundRect((w - tw) / 2 + 2, 14, tw - 4, h - 28, 28);
  x.fill();
  x.fillStyle = '#fff4e3';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + 3, w - 60);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(4.4, 1.1, 1);
  return s;
}

export function cobbleTexture(repeat = 8, palette = ['#7d7280', '#736874', '#857a88', '#6c6270']) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#3e3646';
  x.fillRect(0, 0, S, S);
  const rows = 8;
  const h = S / rows;
  for (let r = 0; r < rows; r++) {
    let px = (r % 2) * -h * 0.5;
    let i = 0;
    while (px < S) {
      const w = h * (0.8 + hash3(r, i, 3) * 0.6);
      const col0 = palette[Math.floor(hash3(r, i, 7) * palette.length)];
      const x0 = px + 3, y0 = r * h + 3, ww = Math.max(8, w - 6), hh = h - 6;
      for (const dx of [0, S, -S]) {
        x.fillStyle = col0;
        x.beginPath();
        x.roundRect(x0 + dx, y0, ww, hh, 14);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,0.07)';
        x.beginPath();
        x.roundRect(x0 + dx + 4, y0 + 3, Math.max(4, ww - 8), hh * 0.4, 12);
        x.fill();
      }
      px += w;
      i++;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const pools = new Map();
function poolMaterial(c) {
  if (!pools.has(c)) pools.set(c, new THREE.MeshBasicMaterial({ map: glowTexture(), color: c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  return pools.get(c);
}

let _smoke;
function smokeTex() {
  if (!_smoke) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    _smoke = new THREE.CanvasTexture(c);
  }
  return _smoke;
}

export function makeWater(deep, shine) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, deep: { value: new THREE.Color(deep) }, shine: { value: new THREE.Color(shine) } }]),
    vertexShader: `varying vec3 vW; #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`.replace('#include <fog_pars_vertex>', '\n#include <fog_pars_vertex>\n'),
    fragmentShader: `uniform float t; uniform vec3 deep; uniform vec3 shine; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        float w = sin(vW.x*1.3 + t*1.2) * sin(vW.z*1.1 - t*0.9) + sin((vW.x+vW.z)*0.7 + t*0.6)*0.5;
        float k = smoothstep(0.75, 1.2, w);
        vec3 c = mix(deep, shine, k*0.55);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
}

export { SPAWN };
