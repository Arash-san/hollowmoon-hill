// Fake players for testing multiplayer: node tools/bots.js <count> <mode> [seconds]
// Modes: wander (plaza, emotes, chat), ritual (stand on the runes), dance (dance floor), boss (fight the king)
import WebSocket from 'ws';
import crypto from 'node:crypto';
import { RITUAL_RUNES, DANCE_FLOOR, ZONES, BOSS_BELL } from '../shared/world.js';

const URL = process.env.WS || 'ws://127.0.0.1:8830/ws';
const [, , countArg = '3', mode = 'wander', secsArg = '60'] = process.argv;
const NAMES = ['Mina', 'Theo', 'Priya', 'Jamal', 'Yuki', 'Leo', 'Sofia', 'Omar', 'Ava', 'Ravi', 'Zoe', 'Kai'];
const LINES = ['Happy Halloween!', 'this is so cute', 'where is the boss?', 'anyone wanna dance?', 'I got a ticket!', 'BOO 👻', 'the vampire gave me a loan lol'];

function bot(i) {
  const ws = new WebSocket(URL);
  const token = crypto.randomBytes(16).toString('hex');
  let x = (Math.random() - 0.5) * 14, z = 4 + Math.random() * 6, yaw = 0, t = 0, e = '';
  let target = null;
  if (mode === 'ritual') target = RITUAL_RUNES[i % RITUAL_RUNES.length];
  if (mode === 'dance') target = { x: DANCE_FLOOR.x + (Math.random() - 0.5) * 6, z: DANCE_FLOOR.z + (Math.random() - 0.5) * 6 };
  if (mode === 'boss') target = { x: ZONES.arena.x + (Math.random() - 0.5) * 12, z: ZONES.arena.z + 7 + Math.random() * 3 };
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token, name: `${NAMES[i % NAMES.length]}Bot` })));
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'welcome' && mode === 'boss' && i === 0) {
      setTimeout(() => {
        x = BOSS_BELL.x + 1;
        z = BOSS_BELL.z + 1;
        ws.send(JSON.stringify({ t: 'move', x, y: 0, z, ry: 0, a: 'idle', e: '' }));
        setTimeout(() => ws.send(JSON.stringify({ t: 'bell' })), 300);
      }, 1500);
    }
  });
  const timer = setInterval(() => {
    t += 0.1;
    if (target) {
      const dx = target.x - x, dz = target.z - z, d = Math.hypot(dx, dz);
      if (d > 0.3) {
        x += (dx / d) * Math.min(d, 0.7);
        z += (dz / d) * Math.min(d, 0.7);
        yaw = Math.atan2(dx, dz);
      } else if (mode === 'dance') e = 'dance';
    } else {
      yaw += (Math.random() - 0.5) * 0.4;
      x += Math.sin(yaw) * 0.35;
      z += Math.cos(yaw) * 0.35;
      if (Math.hypot(x, z) > 14) yaw = Math.atan2(-x, -z);
      if (Math.random() < 0.01) ws.send(JSON.stringify({ t: 'emote', e: ['wave', 'dance', 'laugh', 'cheer', 'flip', 'spin'][Math.floor(Math.random() * 6)] }));
      if (Math.random() < 0.004) ws.send(JSON.stringify({ t: 'chat', text: LINES[Math.floor(Math.random() * LINES.length)] }));
    }
    if (mode === 'boss' && Math.random() < 0.5) ws.send(JSON.stringify({ t: 'hit', kind: 'boss', id: 0 }));
    if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'move', x: +x.toFixed(2), y: 0, z: +z.toFixed(2), ry: +yaw.toFixed(2), a: target && Math.hypot(target.x - x, target.z - z) < 0.3 ? 'idle' : 'run', e }));
  }, 100);
  return () => {
    clearInterval(timer);
    ws.close();
  };
}

const stops = Array.from({ length: Number(countArg) }, (_, i) => bot(i));
console.log(`${stops.length} bots in mode ${mode} for ${secsArg}s`);
setTimeout(() => {
  stops.forEach((s) => s());
  process.exit(0);
}, Number(secsArg) * 1000);
