// Carving contest designs. Each one fills the parts to cut out (white) on a 512x512 canvas context.
const C = 256;
const tri = (x, a, b, c) => {
  x.beginPath();
  x.moveTo(...a);
  x.lineTo(...b);
  x.lineTo(...c);
  x.closePath();
  x.fill();
};

export const STENCIL_DRAW = {
  classic(x) {
    tri(x, [C - 140, 230], [C - 50, 230], [C - 95, 150]);
    tri(x, [C + 50, 230], [C + 140, 230], [C + 95, 150]);
    tri(x, [C - 22, 285], [C + 22, 285], [C, 250]);
    x.beginPath();
    x.moveTo(120, 320);
    for (let i = 0; i <= 8; i++) x.lineTo(120 + i * 34, 320 + (i % 2 ? 26 : 0));
    x.quadraticCurveTo(C, 470, 120, 320);
    x.fill();
  },
  cat(x) {
    for (const s of [-1, 1]) {
      x.beginPath();
      x.ellipse(C + s * 80, 220, 42, 30, s * 0.3, 0, Math.PI * 2);
      x.fill();
    }
    tri(x, [C - 20, 280], [C + 20, 280], [C, 302]);
    x.lineWidth = 12;
    x.strokeStyle = '#fff';
    x.lineCap = 'round';
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) {
      x.beginPath();
      x.moveTo(C + s * 40, 312 + k * 16);
      x.lineTo(C + s * 150, 300 + k * 30);
      x.stroke();
    }
    x.beginPath();
    x.arc(C - 25, 330, 25, 0, Math.PI);
    x.arc(C + 25, 330, 25, 0, Math.PI);
    x.stroke();
  },
  ghost(x) {
    x.beginPath();
    x.moveTo(C - 110, 400);
    x.lineTo(C - 110, 230);
    x.arc(C, 230, 110, Math.PI, 0);
    x.lineTo(C + 110, 400);
    for (let i = 0; i < 4; i++) x.lineTo(C + 110 - (i + 0.5) * 55, i % 2 ? 400 : 370), x.lineTo(C + 110 - (i + 1) * 55, 400);
    x.closePath();
    x.fill();
    x.globalCompositeOperation = 'destination-out';
    for (const s of [-1, 1]) {
      x.beginPath();
      x.ellipse(C + s * 40, 240, 18, 26, 0, 0, Math.PI * 2);
      x.fill();
    }
    x.beginPath();
    x.ellipse(C, 320, 22, 28, 0, 0, Math.PI * 2);
    x.fill();
    x.globalCompositeOperation = 'source-over';
  },
  bat(x) {
    x.beginPath();
    x.moveTo(C, 230);
    x.bezierCurveTo(C - 40, 190, C - 110, 190, C - 190, 210);
    x.bezierCurveTo(C - 160, 240, C - 160, 270, C - 170, 300);
    x.bezierCurveTo(C - 130, 280, C - 100, 290, C - 90, 320);
    x.bezierCurveTo(C - 60, 290, C - 30, 290, C, 320);
    x.bezierCurveTo(C + 30, 290, C + 60, 290, C + 90, 320);
    x.bezierCurveTo(C + 100, 290, C + 130, 280, C + 170, 300);
    x.bezierCurveTo(C + 160, 270, C + 160, 240, C + 190, 210);
    x.bezierCurveTo(C + 110, 190, C + 40, 190, C, 230);
    x.fill();
    tri(x, [C - 30, 220], [C - 10, 215], [C - 30, 180]);
    tri(x, [C + 30, 220], [C + 10, 215], [C + 30, 180]);
  },
  stars(x) {
    const star = (cx, cy, r) => {
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
        i ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      x.closePath();
      x.fill();
    };
    star(C - 90, 210, 60);
    star(C + 90, 210, 60);
    x.beginPath();
    x.ellipse(C, 360, 120, 50, 0, 0, Math.PI);
    x.fill();
  },
  grin(x) {
    for (const s of [-1, 1]) {
      x.beginPath();
      x.arc(C + s * 85, 210, 46, 0, Math.PI * 2);
      x.fill();
    }
    x.beginPath();
    x.moveTo(90, 300);
    x.quadraticCurveTo(C, 360, 422, 300);
    x.quadraticCurveTo(C, 470, 90, 300);
    x.fill();
    x.globalCompositeOperation = 'destination-out';
    for (let i = 1; i < 6; i++) x.fillRect(90 + i * 55, 320, 14, 60);
    x.globalCompositeOperation = 'source-over';
  },
};

export function stencilCanvas(name, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.scale(size / 512, size / 512);
  x.fillStyle = '#fff';
  (STENCIL_DRAW[name] || STENCIL_DRAW.classic)(x);
  return c;
}
