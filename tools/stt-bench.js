// Load test for speech to text (Freesia, the game account): N players' clips sent at the same moment.
//   node tools/stt-bench.js 1 10 40        (clip: .tmp/voice-test.wav, or STT_CLIP=<file>)
import { readFileSync } from 'node:fs';
import { transcribe } from '../server/voice.js';

const audio = readFileSync(process.env.STT_CLIP || '.tmp/voice-test.wav');
const levels = process.argv.slice(2).map(Number).filter(Boolean);
await transcribe(audio, 'audio/wav');
for (const n of levels) {
  const rs = await Promise.allSettled(Array.from({ length: n }, () => transcribe(audio, 'audio/wav')));
  const ok = rs.filter((r) => r.status === 'fulfilled').map((r) => r.value.ms).sort((a, b) => a - b);
  const bad = rs.filter((r) => r.status === 'rejected').map((r) => r.reason.message);
  const q = (p) => (ok[Math.min(ok.length - 1, Math.floor(p * ok.length))] / 1000).toFixed(2);
  console.log(`${n} at once: ${ok.length} ok, median ${q(0.5)} s, p90 ${q(0.9)} s, slowest ${q(1)} s${bad.length ? ` | ${bad.length} failed: ${bad[0]}` : ''}`);
}
