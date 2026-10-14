// Cartoon faces drawn on a canvas that wraps the front of the head. Redrawn only when the expression changes.
import { THREE } from '../engine/toon.js';

export const FACE_W = 256;
export const FACE_H = 176;
// The patch of the head sphere the canvas covers (see builder.js).
export const FACE_PATCH = { phiLength: (110 / 180) * Math.PI, thetaStart: 0.38 * Math.PI, thetaLength: 0.42 * Math.PI };

const EYE_Y = 63, EYE_DX = 47, MOUTH_Y = 113;

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

export class Face {
  constructor(spec, { mode = 'player' } = {}) {
    this.spec = spec;
    this.mode = mode;
    this.canvas = document.createElement('canvas');
    this.canvas.width = FACE_W;
    this.canvas.height = FACE_H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.expr = null;
    this.set('neutral');
  }

  set(expr) {
    if (expr === this.expr) return;
    this.expr = expr;
    this.draw();
    this.texture.needsUpdate = true;
  }

  draw() {
    const x = this.ctx, s = this.spec, e = this.expr;
    x.clearRect(0, 0, FACE_W, FACE_H);
    x.lineCap = 'round';
    x.lineJoin = 'round';
    const ink = '#2a1622';
    if (s.faceStyle === 'skull') return this.drawSkull(x, e);
    if (s.faceStyle === 'scarecrow') return this.drawScarecrow(x, e);
    const hairCol = s.hair?.color || '#3b2416';

    // blush
    const blush = e === 'love' || e === 'happy' || e === 'laugh' ? 0.55 : 0.32;
    x.fillStyle = `rgba(255,110,140,${blush})`;
    for (const sx of [-1, 1]) {
      x.beginPath();
      x.ellipse(128 + sx * 66, EYE_Y + 26, 17, 9, 0, 0, Math.PI * 2);
      x.fill();
    }

    // facial hair sits under the mouth and eyes
    this.drawFacialHair(x, s.facialHair, hairCol);

    // face paint and masks sit under the eyes
    if (s.face === 'skull_paint') {
      x.fillStyle = 'rgba(245,242,235,.92)';
      x.beginPath();
      x.ellipse(128, EYE_Y + 10, 108, 70, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#1b1226';
      for (const sx of [-1, 1]) {
        x.beginPath();
        x.ellipse(128 + sx * EYE_DX, EYE_Y, 30, 27, 0, 0, Math.PI * 2);
        x.fill();
      }
      x.beginPath();
      x.moveTo(128, EYE_Y + 22);
      x.lineTo(120, EYE_Y + 36);
      x.lineTo(136, EYE_Y + 36);
      x.fill();
    }
    if (s.face === 'eye_mask') {
      x.fillStyle = s.faceColor || '#1b1226';
      x.beginPath();
      x.moveTo(128 - EYE_DX - 40, EYE_Y - 8);
      x.quadraticCurveTo(128, EYE_Y - 34, 128 + EYE_DX + 40, EYE_Y - 8);
      x.quadraticCurveTo(128 + EYE_DX + 30, EYE_Y + 28, 128 + 14, EYE_Y + 16);
      x.quadraticCurveTo(128, EYE_Y + 8, 128 - 14, EYE_Y + 16);
      x.quadraticCurveTo(128 - EYE_DX - 30, EYE_Y + 28, 128 - EYE_DX - 40, EYE_Y - 8);
      x.fill();
      x.fillStyle = s.skin || '#f0c8a0';
      for (const sx of [-1, 1]) {
        x.beginPath();
        x.ellipse(128 + sx * EYE_DX, EYE_Y, 21, 17, 0, 0, Math.PI * 2);
        x.fill();
      }
    }
    if (s.face === 'freckles') {
      x.fillStyle = 'rgba(150,80,50,.55)';
      for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) {
        x.beginPath();
        x.arc(128 + sx * (40 + (i % 3) * 13), EYE_Y + 22 + Math.floor(i / 3) * 9 + (i % 2) * 3, 2.6, 0, Math.PI * 2);
        x.fill();
      }
    }

    // brows
    x.strokeStyle = shade(hairCol, 0.85);
    x.lineWidth = 5;
    const browLift = e === 'surprised' ? -9 : e === 'angry' ? 4 : e === 'sad' ? -3 : 0;
    for (const sx of [-1, 1]) {
      x.beginPath();
      const tilt = e === 'angry' ? sx * -5 : e === 'sad' ? sx * 5 : 0;
      x.moveTo(128 + sx * (EYE_DX - 13), EYE_Y - 27 + browLift + tilt);
      x.quadraticCurveTo(128 + sx * EYE_DX, EYE_Y - 33 + browLift, 128 + sx * (EYE_DX + 14), EYE_Y - 27 + browLift - tilt);
      x.stroke();
    }

    // eyes
    const style = s.eyes?.style || 'round';
    for (const sx of [-1, 1]) this.drawEye(x, 128 + sx * EYE_DX, EYE_Y, sx, e, style, s.eyes?.color || '#2b1a12', ink);

    // mouth
    this.drawMouth(x, e, ink);
    if (s.face === 'eyepatch') {
      // over the left eye, with a strap across the forehead
      x.strokeStyle = '#1b1226';
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(8, EYE_Y - 40);
      x.lineTo(248, EYE_Y - 4);
      x.stroke();
      x.fillStyle = '#1b1226';
      x.beginPath();
      x.ellipse(128 - EYE_DX, EYE_Y, 27, 24, 0.2, 0, Math.PI * 2);
      x.fill();
    }
    if (s.face === 'whiskers') {
      x.strokeStyle = '#1b1226';
      x.lineWidth = 3.5;
      for (const sx of [-1, 1]) for (let i = -1; i <= 1; i++) {
        x.beginPath();
        x.moveTo(128 + sx * 30, MOUTH_Y - 16 + i * 7);
        x.lineTo(128 + sx * 78, MOUTH_Y - 20 + i * 13);
        x.stroke();
      }
      x.fillStyle = '#1b1226';
      x.beginPath();
      x.moveTo(121, MOUTH_Y - 22);
      x.lineTo(135, MOUTH_Y - 22);
      x.lineTo(128, MOUTH_Y - 13);
      x.fill();
    }
    if (s.faceStyle === 'vampire' || s.face === 'fangs') {
      x.fillStyle = '#ffffff';
      for (const sx of [-1, 1]) {
        x.beginPath();
        x.moveTo(128 + sx * 9, MOUTH_Y + 2);
        x.lineTo(128 + sx * 4, MOUTH_Y + 2);
        x.lineTo(128 + sx * 6.5, MOUTH_Y + 13);
        x.fill();
      }
    }
    if (s.faceStyle === 'witch') {
      x.fillStyle = '#6a9a3a';
      x.beginPath();
      x.arc(128 + 40, MOUTH_Y - 18, 5, 0, Math.PI * 2);
      x.fill();
    }
  }

  drawSkull(x, e) {
    x.fillStyle = '#21142b';
    const glow = this.spec.eyes?.color || '#7df9ff';
    for (const sx of [-1, 1]) {
      x.beginPath();
      x.ellipse(128 + sx * 44, EYE_Y + 2, 25, e === 'blink' ? 6 : 24, 0, 0, Math.PI * 2);
      x.fill();
      if (e !== 'blink') {
        x.fillStyle = glow;
        x.beginPath();
        x.arc(128 + sx * 44, EYE_Y + 4, e === 'happy' || e === 'laugh' ? 4 : 7, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = '#21142b';
      }
    }
    x.beginPath();
    x.moveTo(128, EYE_Y + 26);
    x.lineTo(119, EYE_Y + 42);
    x.lineTo(137, EYE_Y + 42);
    x.fill();
    // stitched grin
    const open = e === 'happy' || e === 'laugh' ? 8 : 2;
    x.strokeStyle = '#21142b';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(92, MOUTH_Y + 2);
    x.quadraticCurveTo(128, MOUTH_Y + 16 + open, 164, MOUTH_Y + 2);
    x.stroke();
    x.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7, px = 92 + t * 72, py = MOUTH_Y + 2 + Math.sin(t * Math.PI) * (14 + open);
      x.beginPath();
      x.moveTo(px, py - 6);
      x.lineTo(px, py + 6);
      x.stroke();
    }
  }

  drawScarecrow(x, e) {
    x.fillStyle = '#2a1622';
    for (const sx of [-1, 1]) {
      x.beginPath();
      x.arc(128 + sx * 46, EYE_Y, e === 'blink' ? 3 : 13, 0, Math.PI * 2);
      x.fill();
      if (e !== 'blink') {
        x.fillStyle = '#5a4030';
        for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) x.fillRect(128 + sx * 46 + dx - 1.5, EYE_Y + dy - 1.5, 3, 3);
        x.fillStyle = '#2a1622';
      }
    }
    x.fillStyle = 'rgba(255,110,140,0.45)';
    for (const sx of [-1, 1]) {
      x.beginPath();
      x.ellipse(128 + sx * 66, EYE_Y + 26, 15, 8, 0, 0, Math.PI * 2);
      x.fill();
    }
    x.strokeStyle = '#2a1622';
    x.lineWidth = 4;
    x.beginPath();
    const open = e === 'happy' || e === 'laugh' ? 12 : 6;
    x.moveTo(96, MOUTH_Y - 4);
    x.quadraticCurveTo(128, MOUTH_Y + open + 8, 160, MOUTH_Y - 4);
    x.stroke();
    x.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6, px = 96 + t * 64, py = MOUTH_Y - 4 + Math.sin(t * Math.PI) * (open + 4);
      x.beginPath();
      x.moveTo(px - 3, py - 5);
      x.lineTo(px + 3, py + 5);
      x.stroke();
    }
  }

  drawEye(x, cx, cy, sx, e, style, iris, ink) {
    x.strokeStyle = ink;
    x.fillStyle = ink;
    x.lineWidth = 6;
    if (e === 'blink' || e === 'sleepy' || (style === 'sleepy' && e === 'neutral' && false)) {
      x.beginPath();
      x.moveTo(cx - 13, cy + 2);
      x.quadraticCurveTo(cx, cy + (e === 'sleepy' ? 6 : 8), cx + 13, cy + 2);
      x.stroke();
      return;
    }
    if (e === 'happy' || e === 'laugh' || (style === 'happy' && e === 'neutral')) {
      x.beginPath();
      x.moveTo(cx - 14, cy + 5);
      x.quadraticCurveTo(cx, cy - 14, cx + 14, cy + 5);
      x.stroke();
      return;
    }
    if (e === 'love') {
      x.fillStyle = '#ff3d7f';
      heart(x, cx, cy, 17);
      x.fillStyle = 'rgba(255,255,255,0.8)';
      x.beginPath();
      x.arc(cx - 5, cy - 6, 3.5, 0, Math.PI * 2);
      x.fill();
      return;
    }
    if (e === 'dizzy') {
      x.lineWidth = 4;
      x.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.2) {
        const r = 2 + a * 1.1;
        x.lineTo(cx + Math.cos(a * sx) * r, cy + Math.sin(a * sx) * r * 0.9);
      }
      x.stroke();
      return;
    }
    if (e === 'angry') {
      x.beginPath();
      x.ellipse(cx, cy + 3, 10, 9, 0, 0, Math.PI * 2);
      x.fill();
      return;
    }
    const big = e === 'surprised' ? 1.15 : 1;
    const rx = 12.5 * big, ry = 16 * big;
    const lid = style === 'sleepy' && e === 'neutral';
    // dark eye with coloured lower half and highlights
    x.beginPath();
    x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    x.fillStyle = ink;
    x.fill();
    x.save();
    x.beginPath();
    x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    x.clip();
    const g = x.createLinearGradient(0, cy - ry, 0, cy + ry);
    g.addColorStop(0.45, ink);
    g.addColorStop(1, shade(iris, 2.2));
    x.fillStyle = g;
    x.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    if (lid) {
      x.fillStyle = this.spec.skin || '#f0c8a0';
      x.fillRect(cx - rx - 2, cy - ry - 2, rx * 2 + 4, ry * 0.95);
    }
    x.restore();
    if (lid) {
      x.lineWidth = 4;
      x.strokeStyle = ink;
      x.beginPath();
      x.moveTo(cx - rx - 1, cy - ry * 0.05);
      x.lineTo(cx + rx + 1, cy - ry * 0.05);
      x.stroke();
    }
    x.fillStyle = '#fff';
    x.beginPath();
    x.ellipse(cx - 4 * sx * -1 - 3, cy - 6, 4.8, 5.6, 0, 0, Math.PI * 2);
    x.fill();
    x.beginPath();
    x.arc(cx + 4, cy + 6, 2.2, 0, Math.PI * 2);
    x.fill();
    if (style === 'sparkle') {
      x.fillStyle = '#fff';
      star(x, cx + 5, cy - 2, 4.5);
    }
  }

  drawMouth(x, e, ink) {
    x.strokeStyle = ink;
    x.lineWidth = 5;
    const y = MOUTH_Y;
    x.beginPath();
    switch (e) {
      case 'laugh':
      case 'happy': {
        x.moveTo(128 - 15, y - 4);
        x.quadraticCurveTo(128, y - 2, 128 + 15, y - 4);
        x.quadraticCurveTo(128, y + (e === 'laugh' ? 24 : 16), 128 - 15, y - 4);
        x.fillStyle = '#5a1d2e';
        x.fill();
        x.stroke();
        x.fillStyle = '#ff7f9c';
        x.beginPath();
        x.ellipse(128, y + (e === 'laugh' ? 11 : 7), 7, 4, 0, 0, Math.PI * 2);
        x.fill();
        return;
      }
      case 'surprised':
        x.ellipse(128, y + 4, 7, 9, 0, 0, Math.PI * 2);
        x.fillStyle = '#5a1d2e';
        x.fill();
        x.stroke();
        return;
      case 'sad':
      case 'angry':
        x.moveTo(128 - 10, y + 6);
        x.quadraticCurveTo(128, y - 3, 128 + 10, y + 6);
        x.stroke();
        return;
      case 'sleepy':
      case 'blinkSleep':
        x.ellipse(128, y + 2, 4, 3, 0, 0, Math.PI * 2);
        x.stroke();
        return;
      case 'love':
      case 'cat':
        x.moveTo(128 - 12, y);
        x.quadraticCurveTo(128 - 6, y + 7, 128, y);
        x.quadraticCurveTo(128 + 6, y + 7, 128 + 12, y);
        x.stroke();
        return;
      case 'dizzy':
        x.moveTo(128 - 12, y + 3);
        for (let i = 0; i <= 4; i++) x.lineTo(128 - 12 + i * 6, y + (i % 2 ? -2 : 4));
        x.stroke();
        return;
      default:
        x.moveTo(128 - 10, y);
        x.quadraticCurveTo(128, y + 8, 128 + 10, y);
        x.stroke();
    }
  }

  drawFacialHair(x, kind, hairCol) {
    if (!kind || kind === 'none') return;
    const c = new THREE.Color(hairCol);
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    if (kind === 'stubble' || kind === 'beard') {
      // soft jaw shadow + speckles
      x.save();
      x.beginPath();
      x.moveTo(40, MOUTH_Y - 34);
      x.quadraticCurveTo(52, FACE_H + 18, 128, FACE_H + 2);
      x.quadraticCurveTo(204, FACE_H + 18, 216, MOUTH_Y - 34);
      x.quadraticCurveTo(190, MOUTH_Y - 4, 128, MOUTH_Y - 16);
      x.quadraticCurveTo(66, MOUTH_Y - 4, 40, MOUTH_Y - 34);
      x.closePath();
      x.fillStyle = `rgba(${rgb},${kind === 'beard' ? 0.92 : 0.28})`;
      x.fill();
      if (kind === 'stubble') {
        x.clip();
        x.fillStyle = `rgba(${rgb},0.55)`;
        for (let i = 0; i < 260; i++) {
          const px = 40 + ((i * 97) % 176), py = MOUTH_Y - 30 + ((i * 53) % 70);
          x.fillRect(px, py, 1.6, 1.6);
        }
      }
      x.restore();
      if (kind === 'beard') {
        // keep the mouth readable
        x.fillStyle = '#c9867b';
        x.beginPath();
        x.ellipse(128, MOUTH_Y + 3, 17, 9, 0, 0, Math.PI * 2);
        x.fill();
      }
    }
    if (kind === 'mustache' || kind === 'beard') {
      x.fillStyle = `rgb(${rgb})`;
      x.beginPath();
      x.moveTo(128, MOUTH_Y - 9);
      x.bezierCurveTo(115, MOUTH_Y - 18, 96, MOUTH_Y - 10, 98, MOUTH_Y - 1);
      x.bezierCurveTo(110, MOUTH_Y - 6, 120, MOUTH_Y - 4, 128, MOUTH_Y - 6);
      x.bezierCurveTo(136, MOUTH_Y - 4, 146, MOUTH_Y - 6, 158, MOUTH_Y - 1);
      x.bezierCurveTo(160, MOUTH_Y - 10, 141, MOUTH_Y - 18, 128, MOUTH_Y - 9);
      x.fill();
    }
    if (kind === 'goatee') {
      x.fillStyle = `rgb(${rgb})`;
      x.beginPath();
      x.moveTo(116, MOUTH_Y + 12);
      x.quadraticCurveTo(128, MOUTH_Y + 40, 140, MOUTH_Y + 12);
      x.quadraticCurveTo(128, MOUTH_Y + 18, 116, MOUTH_Y + 12);
      x.fill();
    }
  }
}

function heart(x, cx, cy, s) {
  x.beginPath();
  x.moveTo(cx, cy + s * 0.75);
  x.bezierCurveTo(cx - s * 1.2, cy - s * 0.1, cx - s * 0.6, cy - s * 0.95, cx, cy - s * 0.35);
  x.bezierCurveTo(cx + s * 0.6, cy - s * 0.95, cx + s * 1.2, cy - s * 0.1, cx, cy + s * 0.75);
  x.fill();
}

function star(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.35 : r;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
  x.fill();
}
