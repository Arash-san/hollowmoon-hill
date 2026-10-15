// Keyboard + mouse on laptops; a floating joystick (left side), camera drag (right side) and pinch zoom on tablets.
// Every finger is tracked on its own: you can walk with the joystick, turn the camera and press buttons at once.
// A pinch needs two camera fingers; the joystick finger never counts toward it.
export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.walk = false;
    this.camDX = 0;
    this.camDY = 0;
    this.zoom = 0;
    this.handlers = {};
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.enabled = true;
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.camPointer = null;
    this.pinch = null;
    this.pointers = new Map();
    this.ui = ui;

    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    addEventListener('pointermove', (e) => this.onMove(e));
    addEventListener('pointerup', (e) => this.onUp(e));
    addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom += Math.sign(e.deltaY) * 1.2;
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.joyEl = document.createElement('div');
    this.joyEl.className = 'joystick';
    this.joyEl.innerHTML = '<div class="knob"></div>';
    document.body.appendChild(this.joyEl);
  }

  on(name, fn) {
    this.handlers[name] = fn;
  }
  fire(name, ...a) {
    this.handlers[name]?.(...a);
  }

  typing() {
    const el = document.activeElement;
    if (!el || !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return false;
    // a field inside a closed panel can still hold focus: release it so keys reach the game
    if (!el.getClientRects().length) {
      el.blur();
      return false;
    }
    return true;
  }

  onKey(e, down) {
    if (this.typing()) {
      if (down && e.key === 'Escape') document.activeElement.blur();
      return;
    }
    const k = e.key.toLowerCase();
    if (down) {
      if (!this.keys.has(k)) {
        if (k === ' ') this.fire('jump');
        if (k === 'e') this.fire('interact');
        if (k === 'f') this.fire('power');
        if (k === 'l') this.fire('lantern');
        if (k === 'q' || k === 'g') this.fire('emotes');
        if (k === 'enter' || k === 't') {
          e.preventDefault();
          this.fire('chat');
        }
        if (k === 'm') this.fire('map');
        if (k === 'j') this.fire('journal');
        if (k === 'v') this.fire('talkDown');
        if (k === 'tab') {
          e.preventDefault();
          this.fire('quests');
        }
        if (k === 'escape') this.fire('escape');
        if (k === 'r') this.fire('attack');
        if (/^[1-9]$/.test(k)) this.fire('emoteKey', Number(k) - 1);
      }
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      this.keys.add(k);
    } else {
      this.keys.delete(k);
      if (k === 'v') this.fire('talkUp');
    }
  }

  onDown(e) {
    if (!this.enabled) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), type: e.pointerType });
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && this.joy.id === null) {
      this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
      this.joyEl.style.left = e.clientX + 'px';
      this.joyEl.style.top = e.clientY + 'px';
      this.joyEl.classList.add('on');
      return;
    }
    const cams = this.camFingers();
    if (e.pointerType === 'touch' && cams.length === 2) {
      // second camera finger: pinch zoom (the joystick keeps working)
      this.pinch = Math.hypot(cams[0].x - cams[1].x, cams[0].y - cams[1].y);
      this.camPointer = null;
      return;
    }
    this.camPointer = e.pointerId;
  }

  // touches that are not steering the joystick
  camFingers() {
    return [...this.pointers.entries()].filter(([id, p]) => id !== this.joy.id && p.type === 'touch').map(([, p]) => p);
  }

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (e.pointerId === this.joy.id) {
      const max = 55;
      let jx = e.clientX - this.joy.ox, jy = e.clientY - this.joy.oy;
      const len = Math.hypot(jx, jy);
      if (len > max) {
        jx *= max / len;
        jy *= max / len;
      }
      this.joy.x = jx / max;
      this.joy.y = jy / max;
      this.joyEl.firstChild.style.transform = `translate(${jx}px, ${jy}px)`;
      return;
    }
    if (this.pinch !== null && e.pointerId !== this.joy.id) {
      const cams = this.camFingers();
      if (cams.length === 2) {
        const d = Math.hypot(cams[0].x - cams[1].x, cams[0].y - cams[1].y);
        this.zoom -= (d - this.pinch) * 0.04;
        this.pinch = d;
      }
      return;
    }
    if (e.pointerId === this.camPointer) {
      const sens = e.pointerType === 'touch' ? 0.0075 : 0.0055;
      this.camDX += dx * sens;
      this.camDY += dy * sens;
    }
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pinch !== null && this.camFingers().length < 2) {
      this.pinch = null;
      // the finger still down goes back to turning the camera
      const rest = [...this.pointers.keys()].find((id) => id !== this.joy.id);
      this.camPointer = rest ?? null;
    }
    if (e.pointerId === this.joy.id) {
      this.joy = { id: null, x: 0, y: 0 };
      this.joyEl.classList.remove('on');
      this.joyEl.firstChild.style.transform = '';
    }
    if (e.pointerId === this.camPointer) this.camPointer = null;
    // a short tap without much movement is a click on the world
    if (p && performance.now() - p.t < 350 && Math.hypot(p.x - p.sx, p.y - p.sy) < 12 && e.target === this.canvas) this.fire('tap', e.clientX, e.clientY);
  }

  update() {
    let x = 0, y = 0;
    if (!this.typing()) {
      const k = this.keys;
      if (k.has('w') || k.has('arrowup')) y -= 1;
      if (k.has('s') || k.has('arrowdown')) y += 1;
      if (k.has('a') || k.has('arrowleft')) x -= 1;
      if (k.has('d') || k.has('arrowright')) x += 1;
      this.walk = k.has('shift');
    }
    if (this.joy.id !== null) {
      x = this.joy.x;
      y = this.joy.y;
      this.walk = Math.hypot(x, y) < 0.55;
    }
    const len = Math.hypot(x, y);
    if (len > 1) (x /= len), (y /= len);
    this.move.x = x;
    this.move.y = y;
  }

  consumeCamera() {
    const r = { dx: this.camDX, dy: this.camDY, zoom: this.zoom };
    this.camDX = this.camDY = this.zoom = 0;
    return r;
  }
}
