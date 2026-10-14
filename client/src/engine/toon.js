// Shared look: toon-shaded vertex-coloured materials, an inverted-hull outline, and geometry helpers that bake
// colours into vertices so whole characters and props merge into a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { THREE };

function gradientMap(steps) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
export const GRADIENT = gradientMap([90, 165, 225, 255]);

export const toonMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT });
export const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: true });
export const glowMatNoFog = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });

// Inverted hull outline: back faces pushed out along the normal, in a deep plum instead of black.
export const outlineMat = new THREE.ShaderMaterial({
  uniforms: { width: { value: 0.022 }, color: { value: new THREE.Color('#1c0f2b') }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
  vertexShader: /* glsl */ `
    uniform float width;
    varying float vFogDepth;
    void main() {
      vec3 transformed = position + normal * width;
      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
      #endif
      vFogDepth = -mvPosition.z;
      gl_Position = projectionMatrix * mvPosition;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform vec3 fogColor;
    uniform float fogDensity;
    varying float vFogDepth;
    void main() {
      float f = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      gl_FragColor = vec4(mix(color, fogColor, clamp(f, 0.0, 1.0)), 1.0);
    }`,
  side: THREE.BackSide,
});

export function syncOutlineFog(scene) {
  if (scene.fog) {
    outlineMat.uniforms.fogColor.value.copy(scene.fog.color);
    outlineMat.uniforms.fogDensity.value = scene.fog.density || 0;
  }
}

const _c = new THREE.Color();
// Bake one colour (or a function of position) into a geometry's vertex colours. Returns a non-indexed copy.
// perFace: colour each triangle by its centroid, for crisp stripes and panels instead of smeared gradients.
export function col(geo, color, jitter = 0, perFace = false) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    if (typeof color === 'function') {
      if (perFace) {
        const f = i - (i % 3);
        const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3, cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3, cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
        _c.set(color(cx, cy, cz, f));
      } else _c.set(color(pos.getX(i), pos.getY(i), pos.getZ(i), i));
    } else _c.set(color);
    if (jitter) {
      const j = 1 + (hash3(pos.getX(i), pos.getY(i), pos.getZ(i)) - 0.5) * jitter;
      _c.multiplyScalar(j);
    }
    arr.set([_c.r, _c.g, _c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

export function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// Position/rotate/scale a geometry in place (chainable helper).
export function tf(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...(Array.isArray(s) ? s : [s, s, s])));
  geo.applyMatrix4(m);
  return geo;
}

export function merge(list) {
  const parts = list.filter(Boolean).map((g) => {
    let x = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'color'].includes(k)) x.deleteAttribute(k);
    if (!x.attributes.color) x = col(x, '#ffffff');
    if (!x.attributes.normal) x.computeVertexNormals();
    return x;
  });
  if (!parts.length) return null;
  return mergeGeometries(parts, false);
}

// Smooth normals for the outline hull (split normals make cracks in the outline).
export function outlineGeometry(geo) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position);
  const merged = mergeVertices(g, 1e-3);
  merged.computeVertexNormals();
  return merged;
}

// A toon mesh with an optional outline child.
export function toonMesh(geo, { outline = true, material = toonMat, width } = {}) {
  const mesh = new THREE.Mesh(geo, material);
  if (outline) {
    const o = new THREE.Mesh(outlineGeometry(geo), width ? outlineWithWidth(width) : outlineMat);
    o.raycast = () => {};
    o.userData.outline = true;
    mesh.add(o);
  }
  return mesh;
}

const outlineCache = new Map();
export function outlineWithWidth(w) {
  if (!outlineCache.has(w)) {
    const m = outlineMat.clone();
    m.uniforms = THREE.UniformsUtils.clone(outlineMat.uniforms);
    m.uniforms.width.value = w;
    outlineCache.set(w, m);
  }
  return outlineCache.get(w);
}

// Remove triangles whose centroid fails `keep(x, y, z)`: carves face openings, hairlines, cut-outs.
export function carve(geo, keep) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const pos = g.attributes.position;
  const keepTris = [];
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    if (keep(x, y, z)) keepTris.push(i);
  }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    const arr = new Float32Array(keepTris.length * 3 * a.itemSize);
    keepTris.forEach((t, k) => {
      for (let v = 0; v < 3; v++) for (let c = 0; c < a.itemSize; c++) arr[(k * 3 + v) * a.itemSize + c] = a.array[(t + v) * a.itemSize + c];
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return out;
}

// Bend/displace vertices with a function (x,y,z) -> [x,y,z].
export function warp(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, x, y, z);
  }
  return smoothNormals(g);
}

// Smooth normals on a non-indexed geometry (shared positions get one averaged normal), keeping it non-indexed.
export function smoothNormals(g) {
  const only = new THREE.BufferGeometry();
  only.setAttribute('position', g.attributes.position);
  const m = mergeVertices(only, 1e-4);
  m.computeVertexNormals();
  const flat = m.toNonIndexed();
  g.setAttribute('normal', flat.attributes.normal);
  return g;
}

// Shorthand primitives
export const sphere = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
export const capsule = (r, len, cap = 6, rad = 12) => new THREE.CapsuleGeometry(r, len, cap, rad);
export const cyl = (rt, rb, h, seg = 14, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
export const cone = (r, h, seg = 14) => new THREE.ConeGeometry(r, h, seg);
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const torus = (r, t, rs = 8, ts = 20, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);

// Rounded box via a squashed sphere-ish superellipsoid (chunky, cute furniture and houses).
export function roundBox(w, h, d, round = 0.25, seg = 6) {
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // push box corners toward a sphere by `round`
    const s = v.clone().normalize().multiplyScalar(0.5 * Math.sqrt(3) * 0.62);
    v.lerp(s, round);
    pos.setXYZ(i, v.x * w, v.y * h, v.z * d);
  }
  g.computeVertexNormals();
  return g;
}

// Soft round "blob" shadow texture shared by characters and props.
let blobTex;
export function blobShadow(radius = 0.6, opacity = 0.45) {
  if (!blobTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(10,0,20,1)');
    g.addColorStop(0.6, 'rgba(10,0,20,0.55)');
    g.addColorStop(1, 'rgba(10,0,20,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

// Additive glow sprite (lanterns, wisps, candles, eyes of the boss).
let glowTex;
export function glowTexture() {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
  }
  return glowTex;
}
export function glowSprite(color, size = 1, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  s.scale.setScalar(size);
  return s;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function dampAngle(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}
