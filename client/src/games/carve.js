// Jack of All Lanterns: draw on a pumpkin with finger or mouse; the cut-outs glow in the plaza gallery for everyone.
const SIZE = 512;

export function carveGame(ui, audio, onDone) {
  const body = ui.modal(`<div class="mg">
    <h2>Carve your Pumpkin</h2>
    <p class="status">Draw a face! Everything you carve will glow in the plaza gallery.</p>
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
    ctx.save();
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 18;
    ctx.drawImage(glow, 0, 0);
    ctx.restore();
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
    if (b.dataset.done) {
      // only the cut-out mask is uploaded (small PNG); the world tints and lights it
      const small = document.createElement('canvas');
      small.width = small.height = 256;
      small.getContext('2d').drawImage(cut, 0, 0, 256, 256);
      const data = cut.getContext('2d').getImageData(0, 0, SIZE, SIZE).data;
      let carved = 0;
      for (let i = 3; i < data.length; i += 16) if (data[i] > 0) carved++;
      if (carved < 200) {
        body.querySelector('.status').textContent = 'Carve a little more first! Try the stamps for a quick face.';
        audio.play('wrong');
        return;
      }
      ui.closeModal();
      onDone(small.toDataURL('image/png'));
    }
  };
  render();
}
