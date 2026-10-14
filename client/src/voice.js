// Talk to NPCs out loud: hold the mic button (or tap once to start and again to send). The server turns the clip
// into text with Freesia, and the text goes to the NPC like a typed message.
// Browsers only allow the microphone on https (or localhost), so the button stays hidden on plain http.
const HOLD_MS = 350; // a press shorter than this is a tap: keep listening until the next tap
const MAX_MS = 15000;

export const voiceSupported = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

export class VoiceTalk {
  // btn: the mic button. getToken(): the player's game token. onText(text): send to the NPC. toast(msg): show a hint.
  constructor(btn, { getToken, onText, toast, onState }) {
    this.btn = btn;
    this.getToken = getToken;
    this.onText = onText;
    this.toast = toast;
    this.onState = onState || (() => {});
    this.stream = null;
    this.rec = null;
    this.state = 'idle'; // idle | listening | sending
    btn.hidden = !voiceSupported();
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.state === 'listening') return this.stop();
      if (this.state === 'idle') {
        this.pressAt = performance.now();
        this.holding = true;
        try {
          btn.setPointerCapture(e.pointerId);
        } catch { /* ignore */ }
        this.start();
      }
    });
    // the release can land outside the button (a finger slides, the button pulses), so listen on the whole window
    const release = () => {
      if (!this.holding) return;
      this.holding = false;
      if (this.state === 'listening' && performance.now() - this.pressAt > HOLD_MS) this.stop();
    };
    addEventListener('pointerup', release, true);
    addEventListener('pointercancel', release, true);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Hold-to-talk from the keyboard (V): keydown starts, keyup sends.
  keyDown() {
    if (this.btn.hidden || this.btn.classList.contains('hidden') || this.state !== 'idle' || this.keyHeld) return;
    this.keyHeld = true;
    this.start();
  }
  keyUp() {
    if (!this.keyHeld) return;
    this.keyHeld = false;
    if (this.state === 'listening') this.stop();
  }

  set(state) {
    this.state = state;
    this.btn.dataset.state = state;
    this.btn.title = state === 'listening' ? 'Listening… release (or tap) to send' : state === 'sending' ? 'Understanding…' : 'Hold to talk';
    this.onState(state);
  }

  async start() {
    this.set('listening');
    try {
      this.stream ||= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch {
      this.set('idle');
      this.toast('🎙️ Allow the microphone to talk out loud (or just type).');
      return;
    }
    if (this.state !== 'listening') return; // let go before the permission prompt closed
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const chunks = [];
    const rec = (this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined));
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => this.send(new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }), performance.now() - this.startedAt);
    this.startedAt = performance.now();
    rec.start();
    this.limit = setTimeout(() => this.stop(), MAX_MS);
  }

  stop() {
    clearTimeout(this.limit);
    if (this.rec?.state === 'recording') {
      this.set('sending');
      this.rec.stop();
    } else if (this.state === 'listening') this.set('idle');
  }

  async send(blob, ms) {
    this.rec = null;
    if (ms < 400 || blob.size < 1000) {
      this.set('idle');
      this.toast('🎙️ Hold the mic while you talk.');
      return;
    }
    try {
      const r = await fetch('api/voice', { method: 'POST', headers: { 'content-type': blob.type, 'x-hh-token': this.getToken() }, body: blob });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not hear that.');
      if (!j.text) this.toast("🎙️ I didn't catch that. Try again a bit louder?");
      else this.onText(j.text);
    } catch (e) {
      this.toast(`🎙️ ${e.message}`);
    } finally {
      this.set('idle');
    }
  }

  // Close the mic when the dialog closes, so the browser's recording light goes off.
  release() {
    clearTimeout(this.limit);
    if (this.rec?.state === 'recording') {
      this.rec.onstop = null;
      this.rec.stop();
    }
    this.rec = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.state === 'listening') this.set('idle');
  }
}
