// All sound is synthesised with WebAudio: a spooky-cute music-box loop, NPC babble and effects. No files.
export class Audio {
  constructor() {
    this.ctx = null;
    this.on = localStorage.getItem('hh-sound') !== 'off';
    this.musicOn = true;
    this.step = 0;
    this.party = false;
    this.boss = false;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 0.7 : 0;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    // soft echo on the music
    const delay = this.ctx.createDelay();
    delay.delayTime.value = 0.36;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.28;
    delay.connect(fb).connect(delay);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.35;
    this.musicBus.connect(delay);
    delay.connect(wet).connect(this.master);
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  toggle() {
    this.on = !this.on;
    localStorage.setItem('hh-sound', this.on ? 'on' : 'off');
    if (this.master) this.master.gain.setTargetAtTime(this.on ? 0.7 : 0, this.ctx.currentTime, 0.05);
    return this.on;
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  // ---------------------------------------------------------------- music
  schedule() {
    const ctx = this.ctx;
    const bpm = this.party ? 128 : this.boss ? 140 : 96;
    const sixteenth = 60 / bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.2) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 128;
    }
  }

  playStep(s, t, len) {
    // D minor-ish: Dm  Bb  Gm  A  (8 steps of 16ths per chord, 4 bars of 2 chords)
    const prog = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52], [50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 48, 52]];
    const chord = prog[Math.floor(s / 16) % 8];
    const bar = s % 16;
    const melody = [0, null, 2, null, 1, null, 2, 0, null, 1, null, 2, 1, null, 0, null];
    if (this.boss) {
      if (bar % 4 === 0) this.tone(chord[0] - 12, t, len * 3, 'sawtooth', 0.12, 600);
      if (bar % 2 === 0) this.tone(chord[(bar / 2) % 3] + 12, t, len, 'square', 0.04, 2200);
      if (bar === 0 || bar === 8) this.drum(t, 0.25);
      if (bar === 4 || bar === 12) this.snare(t, 0.08);
      return;
    }
    if (this.party) {
      if (bar % 4 === 0) this.drum(t, 0.3);
      if (bar % 4 === 2) this.hat(t, 0.05);
      if (bar === 4 || bar === 12) this.snare(t, 0.1);
      if (bar % 2 === 0) this.tone(chord[0] - 12 + (bar % 4 ? 12 : 0), t, len * 1.5, 'square', 0.07, 900);
      const n = melody[bar];
      if (n !== null) this.tone(chord[n] + 24, t, len * 1.2, 'triangle', 0.08, 4000);
      return;
    }
    // calm: music box arpeggio + plucked bass + soft pad
    const n = melody[bar];
    if (n !== null) this.bell(chord[n] + 24, t, 0.06);
    if (bar === 0) this.tone(chord[0] - 12, t, len * 6, 'triangle', 0.09, 700);
    if (bar === 8) this.tone(chord[2] - 12, t, len * 6, 'triangle', 0.07, 700);
    if (bar === 0) for (const c of chord) this.pad(c + 12, t, len * 15, 0.018);
  }

  freq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  tone(m, t, dur, type, vol, cutoff = 3000, dest = this.musicBus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type;
    o.frequency.value = this.freq(m);
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  bell(m, t, vol) {
    this.tone(m, t, 0.9, 'sine', vol);
    this.tone(m + 12, t, 0.4, 'sine', vol * 0.35);
    this.tone(m + 19, t, 0.25, 'sine', vol * 0.15);
  }

  pad(m, t, dur, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = this.freq(m);
    o.detune.value = (Math.random() - 0.5) * 12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(t, dur, vol, cutoff, type = 'highpass', dest = this.musicBus) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = buf;
    f.type = type;
    f.frequency.value = cutoff;
    g.gain.value = vol;
    src.connect(f).connect(g).connect(dest);
    src.start(t);
  }

  drum(t, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.25);
  }
  snare(t, vol) {
    this.noise(t, 0.15, vol, 1500);
  }
  hat(t, vol) {
    this.noise(t, 0.04, vol, 7000);
  }

  // ---------------------------------------------------------------- effects
  play(name, opts = {}) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime + 0.01;
    const fx = this.master;
    const up = (notes, type = 'triangle', step = 0.07, vol = 0.18) => notes.forEach((n, i) => this.tone(n, t + i * step, 0.25, type, vol, 6000, fx));
    switch (name) {
      case 'candy': up([84, 91], 'sine', 0.05, 0.16); break;
      case 'pickup': up([76, 83, 88], 'triangle', 0.06); break;
      case 'wisp': up([88, 95, 100, 107], 'sine', 0.05, 0.12); break;
      case 'jump': {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(330, t);
        o.frequency.exponentialRampToValueAtTime(700, t + 0.12);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(fx);
        o.start(t);
        o.stop(t + 0.2);
        break;
      }
      case 'land': this.noise(t, 0.08, 0.08, 400, 'lowpass', fx); break;
      case 'quest': up([72, 76, 79, 84, 88], 'triangle', 0.09, 0.2); break;
      case 'ticket': up([79, 83, 86, 91, 95, 98], 'sine', 0.07, 0.18); break;
      case 'click': this.tone(80, t, 0.06, 'square', 0.05, 3000, fx); break;
      case 'pop': up([72, 79], 'square', 0.04, 0.06); break;
      case 'wrong': this.tone(45, t, 0.3, 'sawtooth', 0.12, 500, fx); break;
      case 'brew': up([60, 64, 67, 72, 76], 'sine', 0.05, 0.12); this.noise(t, 0.5, 0.06, 900, 'bandpass', fx); break;
      case 'bell': for (let i = 0; i < 3; i++) this.bell(55 - i * 0.01, t + i * 0.8, 0.3); break;
      case 'roar': {
        this.noise(t, 1.2, 0.3, 300, 'lowpass', fx);
        this.tone(36, t, 1.2, 'sawtooth', 0.2, 400, fx);
        break;
      }
      case 'slam': this.drum(t, 0.6); this.noise(t, 0.4, 0.25, 250, 'lowpass', fx); break;
      case 'hit': this.tone(60 + Math.random() * 6, t, 0.12, 'square', 0.07, 1800, fx); break;
      case 'throw': this.noise(t, 0.12, 0.06, 2500, 'bandpass', fx); break;
      case 'dizzy': up([84, 80, 76, 72], 'sine', 0.06, 0.12); break;
      case 'heart': up([79, 84, 88], 'sine', 0.08, 0.14); break;
      case 'boo': this.tone(55, t, 0.6, 'sawtooth', 0.08, 900, fx); up([67, 63], 'sine', 0.2, 0.1); break;
      case 'win': up([72, 76, 79, 84, 79, 84, 88, 91], 'square', 0.1, 0.1); break;
      case 'ritual': for (let i = 0; i < 6; i++) this.tone(50 + i * 5, t + i * 0.12, 1.5, 'sine', 0.08, 3000, fx); break;
      case 'babble': {
        // NPC "speech": a few random syllable blips at the NPC's pitch
        const base = opts.pitch || 70;
        const n = Math.min(14, 4 + Math.floor((opts.len || 20) / 10));
        for (let i = 0; i < n; i++) this.tone(base + Math.floor(Math.random() * 7) - 3, t + i * 0.07, 0.06, 'square', 0.035, 2200, fx);
        break;
      }
    }
  }
}
