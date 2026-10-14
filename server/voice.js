// Speech to text for NPC talk through Freesia Voice (voice.inquirelab.ai, the lab's own server on Devola).
// The game has its own Freesia account "halloween-game" (2026-10-14); its device token is in data/freesia.json.
// contribute=0: Freesia never keeps these recordings (sharing for training needs the speaker's own consent).
import fs from 'node:fs';
import path from 'node:path';
import { DATA } from './store.js';
import { NPCS } from '../shared/world.js';

let conf = null;
try {
  conf = JSON.parse(fs.readFileSync(path.join(DATA, 'freesia.json'), 'utf8'));
} catch {
  console.log('voice off: no data/freesia.json');
}

// Names the speech model would otherwise misspell.
const VOCAB = ['Hollowmoon Hill', 'Gourd King', ...Object.values(NPCS).map((n) => n.name)].join(', ');

export const voiceEnabled = () => !!conf?.token;

export async function transcribe(audio, mime) {
  const form = new FormData();
  const ext = /ogg/.test(mime) ? 'ogg' : /mp4|m4a|aac/.test(mime) ? 'm4a' : /wav/.test(mime) ? 'wav' : 'webm';
  form.append('file', new Blob([audio], { type: mime || 'audio/webm' }), `talk.${ext}`);
  form.append('language', 'en');
  form.append('prompt', VOCAB);
  form.append('contribute', '0');
  const t0 = Date.now();
  const r = await fetch(`${conf.url}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${conf.token}` },
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) {
    const msg = (await r.json().catch(() => ({}))).detail || r.status;
    throw new Error(`Freesia ${r.status}: ${msg}`);
  }
  const j = await r.json();
  return { text: String(j.text || '').trim(), ms: Date.now() - t0, seconds: j.duration };
}
