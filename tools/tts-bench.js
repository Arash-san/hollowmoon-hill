// Load test for the Kokoro voice service: N NPC sentences requested at the same moment.
//   node tools/tts-bench.js 1 10 40
const TTS = process.env.TTS_URL || 'http://127.0.0.1:8834';
const levels = process.argv.slice(2).map(Number).filter(Boolean);
const text = 'Ah, a swift borrower! Here are your seventy candies, repay eighty in five minutes.';

async function one(i) {
  const t0 = performance.now();
  const r = await fetch(`${TTS}/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `${text} ${i}`, voice: 'bm_george', speed: 1 }) });
  await r.arrayBuffer();
  if (!r.ok) throw new Error(`tts ${r.status}`);
  return performance.now() - t0;
}

await one(0);
for (const n of levels) {
  const ms = (await Promise.all(Array.from({ length: n }, (_, i) => one(i)))).sort((a, b) => a - b);
  const q = (p) => (ms[Math.min(n - 1, Math.floor(p * n))] / 1000).toFixed(2);
  console.log(`${n} at once: median ${q(0.5)} s, p90 ${q(0.9)} s, slowest ${q(1)} s`);
}
