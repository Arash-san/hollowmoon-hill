// Non-player characters: built on the avatar rig with special heads and props, so they animate like players.
import { THREE, toonMesh, col, merge, tf, sphere, cyl, cone, torus, box, warp, carve, glowMat, glowSprite, capsule } from '../engine/toon.js';
import { Avatar, R } from './builder.js';

const HEAD_Y = 0.34;

function pumpkinFaceTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 176;
  const x = c.getContext('2d');
  x.fillStyle = '#ffd166';
  for (const sx of [-1, 1]) {
    x.beginPath();
    x.moveTo(128 + sx * 30, 78);
    x.lineTo(128 + sx * 66, 78);
    x.lineTo(128 + sx * 48, 42);
    x.fill();
  }
  x.beginPath();
  x.moveTo(120, 96);
  x.lineTo(136, 96);
  x.lineTo(128, 82);
  x.fill();
  x.beginPath();
  x.moveTo(70, 112);
  x.quadraticCurveTo(128, 168, 186, 112);
  x.quadraticCurveTo(128, 136, 70, 112);
  x.fill();
  x.fillStyle = '#ff7a1a';
  for (const tx of [104, 152]) x.fillRect(tx - 7, 116, 14, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function topHat(y, color = '#1b1324', band = '#ff7a1a') {
  return [
    col(tf(cyl(0.42, 0.42, 0.03, 22), { p: [0, y, 0] }), color),
    col(tf(cyl(0.25, 0.27, 0.48, 18), { p: [0, y + 0.25, 0] }), color),
    col(tf(cyl(0.272, 0.272, 0.08, 18), { p: [0, y + 0.06, 0] }), band),
  ];
}

const LOOKS = {
  mayor: {
    spec: { skin: '#f6c08a', hair: { style: 'bald', color: '#000' }, facialHair: 'none', eyes: { style: 'round', color: '#000' }, glasses: 'none', top: { type: 'jacket', color: '#2b2236', accent: '#f4f0ff', pattern: 'plain' }, bottom: '#2b2236', shoes: '#14101a', headwear: 'none', costume: 'none' },
    build(av) {
      av.headMesh.visible = false;
      av.faceMesh.visible = false;
      const g = warp(sphere(R * 1.25, 24, 16), (x, y, z) => {
        const a = Math.atan2(x, z), k = 1 + Math.cos(a * 10) * 0.06;
        return [x * k, y * 0.85, z * k];
      });
      const head = toonMesh(merge([col(tf(g, { p: [0, HEAD_Y + 0.05, 0] }), '#ff7a1a', 0.05), ...topHat(HEAD_Y + 0.46).map((h) => h), col(tf(cyl(0.035, 0.05, 0.1, 6), { p: [0.12, HEAD_Y + 0.48, 0.1] }), '#4f6b2a')]));
      av.head.add(head);
      const face = new THREE.Mesh(new THREE.SphereGeometry(R * 1.27, 24, 16, Math.PI / 2 - 0.95, 1.9, 0.38 * Math.PI, 0.42 * Math.PI), new THREE.MeshBasicMaterial({ map: pumpkinFaceTexture(), transparent: true, toneMapped: false }));
      face.position.y = HEAD_Y + 0.05;
      face.scale.y = 0.85;
      av.head.add(face);
      const s = glowSprite('#ffb347', 1.4, 0.35);
      s.position.set(0, HEAD_Y, 0.4);
      av.head.add(s);
      // sash
      av.torso.add(toonMesh(col(tf(torus(0.27, 0.035, 6, 20), { p: [0, 0.27, 0.01], r: [Math.PI / 2, 0.55, 0] }), '#ffd23f'), { width: 0.01 }));
    },
  },
  witch: {
    spec: { skin: '#9bd36a', hair: { style: 'long', color: '#4b2470' }, facialHair: 'none', eyes: { style: 'happy', color: '#2b1a12' }, glasses: 'none', top: { type: 'dress', color: '#4b2a6b', accent: '#ff7a1a', pattern: 'plain' }, bottom: '#2b2236', shoes: '#14101a', headwear: 'none', costume: 'witch_hat', faceStyle: 'witch' },
    build(av) {
      av.head.add(toonMesh(col(tf(warp(cone(0.07, 0.24, 8), (x, y, z) => [x, y, z + (y + 0.12) ** 2 * 0.8]), { p: [0, HEAD_Y - 0.08, R * 0.98], r: [Math.PI / 2 + 0.3, 0, 0] }), '#86c05a'), { width: 0.01 }));
    },
  },
  vampire: {
    spec: { skin: '#e8e2f4', hair: { style: 'short', color: '#14101a' }, facialHair: 'none', eyes: { style: 'sparkle', color: '#b5172e' }, glasses: 'none', top: { type: 'jacket', color: '#1b0f24', accent: '#f4f0ff', pattern: 'plain' }, bottom: '#1b0f24', shoes: '#14101a', headwear: 'none', costume: 'vampire_cape', faceStyle: 'vampire' },
    build(av) {
      av.torso.add(toonMesh(col(tf(cone(0.06, 0.1, 4), { p: [0, 0.4, 0.22], r: [Math.PI / 2, 0, Math.PI / 4] }), '#b5172e'), { width: 0.01 }));
      // monocle
      av.head.add(toonMesh(col(tf(torus(0.085, 0.012, 6, 16), { p: [0.155, HEAD_Y - 0.04, R * 0.97], r: [0, 0.35, 0] }), '#ffd23f'), { width: 0.006 }));
    },
  },
  skeleton: {
    spec: { skin: '#f3eee2', hair: { style: 'bald', color: '#000' }, facialHair: 'none', eyes: { style: 'round', color: '#7df9ff' }, glasses: 'none', top: { type: 'tshirt', color: '#2b2236', accent: '#f3eee2', pattern: 'stripes' }, bottom: '#2b2236', shoes: '#f3eee2', headwear: 'cap', costume: 'none', faceStyle: 'skull' },
    build(av) {
      av.torso.add(toonMesh(col(tf(box(0.4, 0.3, 0.02), { p: [0, 0.12, 0.23], r: [0.15, 0, 0] }), '#c9a56b'), { width: 0.01 }));
    },
  },
  dj: {
    spec: { skin: '#f3eee2', hair: { style: 'bald', color: '#000' }, facialHair: 'none', eyes: { style: 'round', color: '#ff7af2' }, glasses: 'sunglasses', top: { type: 'hoodie', color: '#ff4f8b', accent: '#2ec4b6', pattern: 'zigzag' }, bottom: '#2b2236', shoes: '#ffd23f', headwear: 'none', costume: 'none', faceStyle: 'skull' },
    build(av) {
      av.head.add(toonMesh(merge([
        col(tf(torus(R * 1.08, 0.035, 6, 24, Math.PI), { p: [0, HEAD_Y, 0] }), '#2b2236'),
        ...[-1, 1].map((sx) => col(tf(cyl(0.12, 0.12, 0.1, 14), { p: [sx * R * 1.06, HEAD_Y - 0.02, 0], r: [0, 0, Math.PI / 2] }), '#2ec4b6')),
      ]), { width: 0.01 }));
    },
  },
  scarecrow: {
    spec: { skin: '#d9b77a', hair: { style: 'wavy', color: '#e8c35a' }, facialHair: 'none', eyes: { style: 'round', color: '#000' }, glasses: 'none', top: { type: 'shirt', color: '#c0392b', accent: '#7a1f17', pattern: 'stripes' }, bottom: '#3d5a80', shoes: '#5a3a22', headwear: 'none', costume: 'none', faceStyle: 'scarecrow' },
    build(av) {
      av.head.add(toonMesh(merge([
        col(tf(cyl(0.62, 0.62, 0.04, 20), { p: [0, HEAD_Y + R * 0.9, 0], r: [0.1, 0, 0] }), '#e3bf62'),
        col(tf(cone(0.32, 0.36, 16), { p: [0, HEAD_Y + R * 0.9 + 0.17, 0], r: [0.1, 0, 0] }), '#e3bf62'),
        col(tf(torus(0.3, 0.03, 4, 16), { p: [0, HEAD_Y + R * 0.95, 0], r: [Math.PI / 2 + 0.1, 0, 0] }), '#c0392b'),
      ])));
      // straw tufts at the cuffs
      for (const arm of [av.armL, av.armR]) arm.add(toonMesh(col(tf(cone(0.1, 0.12, 6), { p: [0, -0.3, 0], r: [Math.PI, 0, 0] }), '#e8c35a'), { width: 0.008 }));
      av.armPose = 'scarecrow';
    },
  },
};

export function buildNpc(look) {
  if (look === 'ghost') return buildGhost();
  const L = LOOKS[look];
  const av = new Avatar(L.spec, { raw: true });
  L.build(av);
  return av;
}

// Professor Wisp: a floating sheet ghost in a graduation cap; animates with the same API as avatars.
function buildGhost() {
  const av = new Avatar({ skin: '#f4f0ff', hair: { style: 'bald', color: '#000' }, facialHair: 'none', eyes: { style: 'round', color: '#2b1a12' }, glasses: 'round', top: { type: 'tshirt', color: '#f4f0ff', accent: '#f4f0ff', pattern: 'plain' }, bottom: '#f4f0ff', shoes: '#f4f0ff', headwear: 'none', costume: 'none' }, { raw: true });
  av.legL.visible = av.legR.visible = false;
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    pts.push(new THREE.Vector2(0.2 + Math.sin(t * Math.PI * 0.55) * 0.42, 0.55 - t * 0.95));
  }
  const sheet = warp(new THREE.LatheGeometry(pts.reverse(), 24), (x, y, z) => [x, y + (y < -0.25 ? Math.sin(Math.atan2(x, z) * 7) * 0.05 : 0), z]);
  av.torso.add(toonMesh(col(sheet, '#f4f0ff')));
  av.head.add(toonMesh(merge([
    col(tf(box(0.62, 0.04, 0.62), { p: [0, HEAD_Y + R * 0.95, 0], r: [0.1, Math.PI / 4, 0] }), '#21142b'),
    col(tf(cyl(0.2, 0.22, 0.14, 12), { p: [0, HEAD_Y + R * 0.85, 0] }), '#21142b'),
    col(tf(capsule(0.012, 0.22, 2, 4), { p: [0.27, HEAD_Y + R * 0.8, 0.1] }), '#ffd23f'),
  ]), { width: 0.012 }));
  av.ghost = true;
  av.root.traverse((o) => {
    if (!o.isMesh || o.userData.outline || o === av.shadow) return;
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.opacity = 0.8;
  });
  const s = glowSprite('#c9c2ff', 2.4, 0.3);
  s.position.y = 0.9;
  av.root.add(s);
  return av;
}

export { carve, glowMat };
