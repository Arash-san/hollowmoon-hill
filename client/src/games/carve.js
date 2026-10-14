// Jack of All Lanterns: draw on a pumpkin with finger or mouse; the cut-outs glow in the plaza gallery for everyone.
// Contest mode: a target design shows as a pale outline, a timer runs, and the score is how well the carving
// matches the design (intersection over union of the two masks).
import { stencilCanvas } from './stencils.js';

const SIZE = 512;

export function carveGame(ui, audio, onDone, { stencil = null, until = 0 } = {}) {
  const body = ui.modal(`<div class="mg">
    <h2>${stencil ? 'Carve the Design!' : 'Carve your Pumpkin'}</h2>
    <p class="status">${stencil ? 'Follow the pale design as closely as you can. <b class="left"></b>' : 'Draw a face! Everything you carve will glow in the plaza gallery.'}</p>
    <div class="carve-wrap">
      <canvas id="carve-canvas" width="${SIZE}" height="${SIZE}"></canvas>
      <div class="carve-tools">
        <button class="btn on" data-w="14">🔪 Knife</button>
        <button class="btn" data-w="34">🥄 Scoop</button>
        <button class="btn" data-s="eyes">👀 Eyes</button>
        <button class="btn" data-s="smile">😁 Grin</button>
        <button class="btn" data-s="nose">🔺 Nose</button>
        <button class="btn" data-u="1">↩️ Undo</button>
        <button class="btn" data-c="1">🧹 Clear</button>
        <button class="btn big orange" data-done="1">Place it! 🎃</button>
      </div>
    </div></div>`, { wide: true });
  const canvas = body.querySelector('#carve-canvas');
  const ctx = canvas.getContext('2d');
  // the carving layer is kept separately (white strokes) and composited over the pumpkin for display
  const cut = document.createElement('canvas');
  cut.width = cut.height = SIZE;
  const cx = cut.getContext('2d');
  cx.lineCap = 'round';
  cx.lineJoin = 'round';
  cx.strokeStyle = cx.fillStyle = '#fff';
  let width = 14, drawing = false, last = null;
  const target = stencil ? stencilCanvas(stencil) : null;
  // the target design as a pale overlay, drawn once
  let outline = null;
  if (target) {
    outline = document.createElement('canvas');
    outline.width = outline.height = SIZE;
    const ox = outline.getContext('2d');
    ox.drawImage(target, 0, 0);
    ox.globalCompositeOperation = 'source-in';
    ox.fillStyle = 'rgba(255,244,227,.3)';
    ox.fillRect(0, 0, SIZE, SIZE);
  }
  const history = [];

  function render() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    // pumpkin skin with ribs
    const g = ctx.createRadialGradient(SIZE * 0.42, SIZE * 0.38, 20, SIZE / 2, SIZE / 2, SIZE / 2);
    g.addColorStop(0, '#ffb062');
    g.addColorStop(1, '#e8590c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,50,0,.35)';
    ctx.lineWidth = 6;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(SIZE / 2, SIZE / 2, Math.abs(i) * 60 + 20, SIZE / 2 - 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // carved parts show the candle glow inside
    const glow = document.createElement('canvas');
    glow.width = glow.height = SIZE;
    const gx = glow.getContext('2d');
    gx.drawImage(cut, 0, 0);
    gx.globalCompositeOperation = 'source-in';
    const lg = gx.createRadialGradient(SIZE / 2, SIZE / 2, 10, SIZE / 2, SIZE / 2, SIZE / 2);
    lg.addColorStop(0, '#fff6b0');
    lg.addColorStop(1, '#ffb000');
    gx.fillStyle = lg;
    gx.fillRect(0, 0, SIZE, SIZE);
    if (outline) ctx.drawImage(outline, 0, 0);
    ctx.save();
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 18;
    ctx.drawImage(glow, 0, 0);
    ctx.restore();
  }

  // how well the carving matches the target: intersection over union of the two masks (0-100)
  const score = () => {
    if (!target) return 0;
    const n = 128, a = document.createElement('canvas'), b = document.createElement('canvas');
    a.width = a.height = b.width = b.height = n;
    a.getContext('2d').drawImage(cut, 0, 0, n, n);
    b.getContext('2d').drawImage(target, 0, 0, n, n);
    const da = a.getContext('2d').getImageData(0, 0, n, n).data, db = b.getContext('2d').getImageData(0, 0, n, n).data;
    let inter = 0, union = 0;
    for (let i = 3; i < da.length; i += 4) {
      const ca = da[i] > 80, cb = db[i] > 80;
      if (ca && cb) inter++;
      if (ca || cb) union++;
    }
    return union ? Math.round((inter / union) * 100) : 0;
  };
  let timer = 0;
  if (until) {
    timer = setInterval(() => {
      const left = Math.ceil((until - performance.now()) / 1000);
      const el = body.querySelector('.left');
      if (el) el.textContent = `${Math.max(0, left)} s left`;
      if (left <= 0) finish(true);
    }, 250);
  }

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };
  const inside = (p) => (p.x - SIZE / 2) ** 2 + (p.y - SIZE / 2) ** 2 < (SIZE / 2 - 30) ** 2;
  const snapshot = () => {
    history.push(cx.getImageData(0, 0, SIZE, SIZE));
    if (history.length > 30) history.shift();
  };

  canvas.onpointerdown = (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    snapshot();
    drawing = true;
    last = pos(e);
    if (inside(last)) {
      cx.beginPath();
      cx.arc(last.x, last.y, width / 2, 0, Math.PI * 2);
      cx.fill();
      render();
    }
  };
  canvas.onpointermove = (e) => {
    if (!drawing) return;
    const p = pos(e);
    if (inside(p) && inside(last)) {
      cx.lineWidth = width;
      cx.beginPath();
      cx.moveTo(last.x, last.y);
      cx.lineTo(p.x, p.y);
      cx.stroke();
      render();
    }
    last = p;
  };
  canvas.onpointerup = canvas.onpointercancel = () => {
    drawing = false;
    audio.play('click');
  };

  const stamps = {
    eyes() {
      for (const sx of [-1, 1]) {
        cx.beginPath();
        cx.moveTo(SIZE / 2 + sx * 50, 230);
        cx.lineTo(SIZE / 2 + sx * 140, 230);
        cx.lineTo(SIZE / 2 + sx * 95, 150);
        cx.fill();
      }
    },
    nose() {
      cx.beginPath();
      cx.moveTo(SIZE / 2 - 22, 285);
      cx.lineTo(SIZE / 2 + 22, 285);
      cx.lineTo(SIZE / 2, 250);
      cx.fill();
    },
    smile() {
      cx.beginPath();
      cx.moveTo(120, 320);
      for (let i = 0; i <= 8; i++) cx.lineTo(120 + i * 34, 320 + (i % 2 ? 26 : 0));
      cx.quadraticCurveTo(SIZE / 2, 470, 120, 320);
      cx.fill();
    },
  };

  body.querySelector('.carve-tools').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audio.play('click');
    if (b.dataset.w) {
      width = Number(b.dataset.w);
      body.querySelectorAll('[data-w]').forEach((x) => x.classList.toggle('on', x === b));
    }
    if (b.dataset.s) {
      snapshot();
      stamps[b.dataset.s]();
      render();
    }
    if (b.dataset.u && history.length) {
      cx.putImageData(history.pop(), 0, 0);
      render();
    }
    if (b.dataset.c) {
      snapshot();
      cx.clearRect(0, 0, SIZE, SIZE);
      render();
    }
    if (b.dataset.done) finish(false);
  };
  function finish(timeUp) {
    clearInterval(timer);
    // the player may have closed the carving already (or another window took its place)
    if (finish.done || !canvas.isConnected) return;
    {
      // only the cut-out mask is uploaded (small PNG); the world tints and lights it
      const small = document.createElement('canvas');
      small.width = small.height = 256;
      small.getContext('2d').drawImage(cut, 0, 0, 256, 256);
      const data = cut.getContext('2d').getImageData(0, 0, SIZE, SIZE).data;
      let carved = 0;
      for (let i = 3; i < data.length; i += 16) if (data[i] > 0) carved++;
      if (carved < 200 && !timeUp) {
        body.querySelector('.status').textContent = 'Carve a little more first! Try the stamps for a quick face.';
        audio.play('wrong');
        return;
      }
      finish.done = true;
      ui.closeModal();
      if (carved >= 50) onDone(small.toDataURL('image/png'), score());
    }
  }
  render();
}
