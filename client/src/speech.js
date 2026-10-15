// NPC speech, sentence by sentence and in step with the voice. The server streams a reply as numbered lines
// (npcLine) and voice clips with the same numbers (npcVoice). Each line shows in the speech bubble exactly while its
// clip plays, then the next one follows; with the sound off (or no clip in time) a line stays up for its reading
// time instead. A newer reply (rid) or the player speaking cuts the current one off.
const WAIT_FOR_CLIP = 2500; // ms a ready line waits for its voice before it is shown silently
const HOLD_LAST = 3200; // ms the last line stays after it is spoken

export class Speech {
  constructor(game) {
    this.g = game;
    this.r = null; // { rid, npc, lines: [], clips: [], idx, total, busy, timer }
  }

  reply(m) {
    if (this.r && this.r.rid === m.rid) return this.r;
    if (this.r && m.rid < this.r.rid) return null; // a late message from an older reply
    this.stop();
    this.r = { rid: m.rid, npc: m.npc, lines: [], clips: [], idx: 0, total: null, busy: false, timer: 0, since: 0 };
    return this.r;
  }

  line(m) {
    const r = this.reply(m);
    if (!r) return;
    r.lines[m.i] = { text: m.text, voice: !!m.voice && this.g.audio.on };
    if (m.i === 0 && this.g.ui.dialogNpc === m.npc) this.g.me?.hideBubble(); // their answer makes room
    this.pump();
  }

  voice(m) {
    const r = this.reply(m);
    if (!r) return;
    if (!m.audio || !this.g.audio.on) {
      r.clips[m.i] = false;
    } else {
      const a = new window.Audio(`api/tts/${m.audio}.wav`);
      a.preservesPitch = false; // the playback rate also shifts the pitch: deeper Count, squeakier Bones
      a.playbackRate = m.rate || 1;
      a.preload = 'auto';
      r.clips[m.i] = a;
    }
    this.pump();
  }

  // the whole reply is in: m.n lines in total
  done(m) {
    const r = this.reply(m);
    if (!r) return;
    r.total = m.n;
    if (!m.n && m.say) {
      r.lines[0] = { text: m.say, voice: false };
      r.total = 1;
    }
    this.pump();
  }

  pump() {
    const r = this.r;
    if (!r || r.busy) return;
    const npc = this.g.npcs.get(r.npc);
    const L = r.lines[r.idx];
    if (!L) {
      if (r.total !== null && r.idx >= r.total) this.finish();
      return;
    }
    const clip = r.clips[r.idx];
    if (L.voice && clip === undefined) {
      // wait for this line's voice, but not forever
      r.since ||= performance.now();
      clearTimeout(r.timer);
      const left = WAIT_FOR_CLIP - (performance.now() - r.since);
      if (left > 0) {
        r.timer = setTimeout(() => this.pump(), left);
        return;
      }
    }
    clearTimeout(r.timer);
    r.since = 0;
    r.busy = true;
    npc?.say(L.text, 600, true); // held up until this line is over
    window.__speechLog?.push({ ev: 'show', rid: r.rid, i: r.idx, at: Date.now(), voiced: !!clip });
    const next = () => {
      if (this.r !== r) return;
      r.busy = false;
      if (npc) npc.talking = 0;
      r.idx++;
      this.pump();
    };
    if (clip) {
      this.g.voiceNow = clip;
      clip.onplaying = () => {
        if (npc) npc.talking = performance.now() + (clip.duration / (clip.playbackRate || 1)) * 1000;
      };
      clip.onended = clip.onerror = () => (window.__speechLog?.push({ ev: 'end', rid: r.rid, i: r.idx, at: Date.now() }), next());
      clip.play().catch(() => {
        r.timer = setTimeout(next, readMs(L.text));
      });
    } else {
      if (npc) npc.talking = performance.now() + Math.min(5000, 600 + L.text.length * 40);
      this.g.audio.play('babble', { pitch: this.g.npcPitch?.[r.npc], len: L.text.length });
      r.timer = setTimeout(next, readMs(L.text));
    }
  }

  finish() {
    const r = this.r;
    const npc = r && this.g.npcs.get(r.npc);
    if (npc?.bubble) npc.bubbleUntil = performance.now() + HOLD_LAST;
    this.r = null;
  }

  stop() {
    const r = this.r;
    if (!r) return;
    clearTimeout(r.timer);
    for (const c of r.clips) if (c) (c.onended = c.onerror = null), c.pause();
    const npc = this.g.npcs.get(r.npc);
    if (npc) {
      npc.talking = 0;
      npc.hideBubble();
    }
    this.r = null;
  }
}

const readMs = (text) => Math.max(1800, Math.min(7000, String(text).length * 62));
