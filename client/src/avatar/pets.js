// Tiny companions that trail behind their owner: bat, ghost, pumpkin, black cat, spider, candle.
import { THREE, toonMesh, col, merge, tf, sphere, cone, cyl, capsule, warp, glowMat, glowSprite, carve, damp, dampAngle } from '../engine/toon.js';

function eyes(y, z, spread = 0.045, r = 0.022, color = '#21142b') {
  return [-1, 1].map((sx) => col(tf(sphere(r, 8, 6), { p: [sx * spread, y, z] }), color));
}

function build(kind) {
  const toon = [], glow = [], moving = {};
  switch (kind) {
    case 'bat': {
      toon.push(col(sphere(0.12, 12, 10), '#3b2452'));
      toon.push(...[-1, 1].map((sx) => col(tf(cone(0.04, 0.09, 4), { p: [sx * 0.06, 0.12, 0], r: [0, 0, -sx * 0.3] }), '#3b2452')));
      glow.push(...eyes(0.02, 0.105, 0.045, 0.022, '#ffd23f'));
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.22, 0.08);
      shape.quadraticCurveTo(0.2, 0, 0.24, -0.06);
      shape.quadraticCurveTo(0.15, -0.02, 0.12, -0.08);
      shape.quadraticCurveTo(0.06, -0.02, 0, -0.04);
      const w = new THREE.ShapeGeometry(shape);
      moving.wingR = col(w.clone(), '#52306e');
      moving.wingL = col(tf(w.clone(), { s: [-1, 1, 1] }), '#52306e');
      break;
    }
    case 'ghost': {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push(new THREE.Vector2(Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 0.14 + (t > 0.6 ? (t - 0.6) * 0.1 : 0), 0.16 - t * 0.32));
      }
      const g = warp(new THREE.LatheGeometry(pts.slice().reverse(), 20), (x, y, z) => [x, y + (y < -0.12 ? Math.sin(Math.atan2(x, z) * 6) * 0.025 : 0), z]);
      toon.push(col(g, '#f4f0ff'));
      toon.push(...eyes(0.04, 0.13, 0.045, 0.024));
      toon.push(col(tf(sphere(0.02, 8, 6), { p: [0, -0.01, 0.135], s: [1.3, 0.8, 0.6] }), '#21142b'));
      break;
    }
    case 'pumpkin': {
      const g = warp(sphere(0.15, 16, 12), (x, y, z) => {
        const a = Math.atan2(x, z);
        const k = 1 + Math.cos(a * 8) * 0.06;
        return [x * k, y * 0.82, z * k];
      });
      toon.push(col(g, '#ff7a1a'));
      toon.push(col(tf(cyl(0.02, 0.03, 0.08, 6), { p: [0, 0.15, 0], r: [0.3, 0, 0.2] }), '#4a7c2c'));
      glow.push(...[-1, 1].map((sx) => col(tf(cone(0.03, 0.05, 3), { p: [sx * 0.05, 0.03, 0.14], r: [Math.PI / 2, 0, 0] }), '#ffe066')));
      glow.push(col(tf(carve(sphere(0.06, 10, 6), (x, y) => y < 0), { p: [0, -0.02, 0.135], s: [1.4, 0.7, 0.3] }), '#ffe066'));
      break;
    }
    case 'black_cat': {
      toon.push(col(tf(capsule(0.08, 0.14, 6, 10), { p: [0, 0, -0.02], r: [Math.PI / 2, 0, 0] }), '#241a2e'));
      toon.push(col(tf(sphere(0.09, 12, 10), { p: [0, 0.07, 0.12] }), '#241a2e'));
      toon.push(...[-1, 1].map((sx) => col(tf(cone(0.035, 0.07, 3), { p: [sx * 0.05, 0.16, 0.12], r: [0, 0, -sx * 0.3] }), '#241a2e')));
      toon.push(...[-1, 1].flatMap((sx) => [0.08, -0.12].map((z) => col(tf(capsule(0.025, 0.06, 4, 6), { p: [sx * 0.05, -0.08, z] }), '#241a2e'))));
      glow.push(...eyes(0.08, 0.2, 0.035, 0.018, '#b6ff5c'));
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, -0.12), new THREE.Vector3(0, 0.08, -0.2), new THREE.Vector3(0, 0.2, -0.18)]);
      moving.tail = col(new THREE.TubeGeometry(curve, 10, 0.018, 5), '#241a2e');
      break;
    }
    case 'spider': {
      toon.push(col(sphere(0.1, 12, 10), '#2b1f3a'));
      toon.push(col(tf(sphere(0.07, 10, 8), { p: [0, 0, 0.11] }), '#2b1f3a'));
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(sx * 0.12, 0.06, 0), new THREE.Vector3(sx * 0.2, -0.08, 0)]);
        toon.push(col(tf(new THREE.TubeGeometry(curve, 6, 0.012, 4), { p: [0, 0, 0.06 - i * 0.04], r: [0, (i - 1.5) * 0.3 * sx, 0] }), '#2b1f3a'));
      }
      glow.push(...eyes(0.03, 0.17, 0.028, 0.016, '#ff4f8b'));
      break;
    }
    case 'candle': {
      toon.push(col(cyl(0.06, 0.065, 0.2, 12), '#f6e7c8'));
      toon.push(col(tf(sphere(0.05, 8, 6), { p: [0.04, 0.06, 0.04], s: [0.5, 1, 0.5] }), '#f6e7c8'));
      toon.push(col(tf(cyl(0.1, 0.08, 0.03, 12), { p: [0, -0.1, 0] }), '#b08d57'));
      toon.push(...eyes(0.0, 0.06, 0.025, 0.012));
      glow.push(col(tf(sphere(0.04, 8, 6), { p: [0, 0.15, 0], s: [0.8, 1.6, 0.8] }), '#ffb347'));
      break;
    }
  }
  return { toon, glow, moving };
}

export class Pet {
  constructor(kind, { outline = true } = {}) {
    this.kind = kind;
    this.root = new THREE.Group();
    const inner = (this.inner = new THREE.Group());
    this.root.add(inner);
    const b = build(kind);
    if (b.toon.length) inner.add(toonMesh(merge(b.toon), { outline, width: 0.012 }));
    if (b.glow.length) inner.add(new THREE.Mesh(merge(b.glow), glowMat));
    this.moving = {};
    for (const [k, g] of Object.entries(b.moving)) {
      const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      inner.add(m);
      this.moving[k] = m;
    }
    if (kind === 'candle' || kind === 'pumpkin') {
      const s = glowSprite(kind === 'candle' ? '#ffb347' : '#ff9a3c', kind === 'candle' ? 0.6 : 0.7, 0.55);
      s.position.y = kind === 'candle' ? 0.16 : 0;
      inner.add(s);
    }
    this.t = Math.random() * 10;
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.placed = false;
  }

  // Follow a spot behind-beside the owner.
  update(dt, owner, ownerYaw, moving) {
    this.t += dt;
    const t = this.t;
    const flying = this.kind !== 'black_cat' && this.kind !== 'pumpkin';
    const back = 0.9, side = 0.6 * this.side;
    const tx = owner.x - Math.sin(ownerYaw) * back + Math.cos(ownerYaw) * side;
    const tz = owner.z - Math.cos(ownerYaw) * back - Math.sin(ownerYaw) * side;
    const ty = owner.y + (flying ? 1.35 + Math.sin(t * 2.2) * 0.12 : 0.15);
    const r = this.root;
    if (!this.placed) {
      r.position.set(tx, ty, tz);
      this.placed = true;
    }
    const k = 5;
    r.position.x = damp(r.position.x, tx, k, dt);
    r.position.z = damp(r.position.z, tz, k, dt);
    r.position.y = damp(r.position.y, ty, 8, dt);
    const dx = tx - r.position.x, dz = tz - r.position.z;
    const goingFast = dx * dx + dz * dz > 0.04;
    const yaw = goingFast ? Math.atan2(dx, dz) : ownerYaw;
    r.rotation.y = dampAngle(r.rotation.y, yaw, 6, dt);
    const i = this.inner;
    switch (this.kind) {
      case 'bat': {
        const f = Math.sin(t * 18) * 0.7;
        this.moving.wingL.rotation.y = f;
        this.moving.wingR.rotation.y = -f;
        i.position.y = Math.sin(t * 9) * 0.03;
        break;
      }
      case 'ghost':
        i.rotation.z = Math.sin(t * 2) * 0.12;
        i.position.y = Math.sin(t * 2.6) * 0.05;
        break;
      case 'pumpkin':
      case 'black_cat': {
        const hop = moving || goingFast ? Math.abs(Math.sin(t * 9)) * 0.18 : 0;
        i.position.y = hop + (this.kind === 'black_cat' ? 0.07 : 0.1);
        if (this.moving.tail) this.moving.tail.rotation.y = Math.sin(t * 3) * 0.5;
        break;
      }
      case 'spider':
        i.position.y = Math.sin(t * 1.5) * 0.15;
        i.rotation.y = Math.sin(t * 0.8) * 0.6;
        break;
      case 'candle':
        i.rotation.z = Math.sin(t * 3) * 0.08;
        break;
    }
  }

  dispose() {
    this.root.traverse((o) => o.isMesh && o.geometry.dispose());
  }
}
