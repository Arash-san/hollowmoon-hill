// NPC voices through the local Kokoro service (tts/server.py on 127.0.0.1:8834). Replies are split into sentences
// so the first one plays while the rest are still being made. Audio is kept in memory for a few minutes and served
// at /api/tts/<id>.wav to the player who asked; nothing is written to disk.
import crypto from 'node:crypto';

const TTS = process.env.TTS_URL || 'http://127.0.0.1:8834';
const KEEP_MS = 5 * 60 * 1000;
const clips = new Map(); // id -> { buf, at }

let up = false;
export const ttsEnabled = () => up;
async function check() {
  try {
    up = (await fetch(`${TTS}/health`, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    up = false;
  }
}
check();
setInterval(check, 30000);

// Split a reply into sentence-sized pieces (short ones are merged so the voice does not stutter).
export function sentences(text) {
  const parts = String(text).replace(/\*[^*]*\*/g, ' ').replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]*["')\]]*\s*/g) || [];
  const out = [];
  for (const p of parts.map((s) => s.trim()).filter(Boolean)) {
    if (out.length && (out[out.length - 1].length < 28 || p.length < 12)) out[out.length - 1] += ' ' + p;
    else out.push(p);
  }
  return out;
}

export async function speak(text, voice, speed = 1) {
  if (!up || !text) return null;
  const r = await fetch(`${TTS}/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voice, speed }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`tts ${r.status}`);
  const id = crypto.randomBytes(8).toString('hex');
  clips.set(id, { buf: Buffer.from(await r.arrayBuffer()), at: Date.now() });
  return id;
}

export function clip(id) {
  return clips.get(id)?.buf || null;
}

setInterval(() => {
  const t = Date.now();
  for (const [id, c] of clips) if (t - c.at > KEEP_MS) clips.delete(id);
}, 60000);
