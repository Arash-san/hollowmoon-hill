// Load test for the NPC model: N players talking at the same moment, NPC-sized prompts and the JSON reply format.
//   node tools/llm-bench.js 1 10 40        (reads data/llm.json; prints latency and tokens per second per level)
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../data/llm.json', import.meta.url)));
const levels = process.argv.slice(2).map(Number).filter(Boolean);
const system = `You are Count Snackula in "Hollowmoon Hill", a cute Halloween multiplayer game. Character: a dramatic vampire banker who lends candy at outrageous interest and adores compliments about his cape. ${'Stay in character, keep replies short and playful, never mention being an AI. '.repeat(12)}Reply as JSON: {"say": "...", "mood": 0}.`;
const lines = ['Could I borrow fifty candies?', 'Your cape is magnificent!', 'What are your terms?', 'Lower interest, please?', 'Tell me a secret about the Mayor.', 'Why do you love candy so much?'];

async function one(i) {
  const t0 = performance.now();
  const r = await fetch(`${cfg.url}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model, temperature: 0.8, max_tokens: 160,
      chat_template_kwargs: { enable_thinking: false },
      ...(process.env.NOSCHEMA ? {} : { response_format: { type: 'json_schema', json_schema: { name: 'reply', schema: { type: 'object', properties: { say: { type: 'string' }, mood: { type: 'integer' } }, required: ['say', 'mood'] } } } }),
      messages: [{ role: 'system', content: system }, { role: 'user', content: `${lines[i % lines.length]} (player ${i})` }],
    }),
  });
  const j = await r.json();
  const ms = performance.now() - t0;
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return { ms, out: j.usage.completion_tokens, inp: j.usage.prompt_tokens, say: j.choices[0].message.content };
}

await one(0); // warm
for (const n of levels) {
  const t0 = performance.now();
  const rs = await Promise.all(Array.from({ length: n }, (_, i) => one(i)));
  const wall = (performance.now() - t0) / 1000;
  const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
  const toks = rs.reduce((a, r) => a + r.out, 0);
  const pct = (p) => (ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] / 1000).toFixed(2);
  console.log(`${n} at once: median ${pct(0.5)} s, p90 ${pct(0.9)} s, slowest ${pct(1)} s | ${(toks / wall).toFixed(0)} tok/s total, ${(rs[0].out / (rs[0].ms / 1000)).toFixed(0)} tok/s per reply | prompt ${rs[0].inp} tok, reply ~${Math.round(toks / n)} tok`);
  if (n === levels[0]) console.log('  sample:', rs[0].say);
}
