// Tiny JSON persistence: players, carvings and settings survive a server restart.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// HH_DATA lets a test server run beside the live one with its own players and keys
export const DATA = path.resolve(process.env.HH_DATA || path.join(import.meta.dirname, '..', 'data'));
fs.mkdirSync(path.join(DATA, 'carvings'), { recursive: true });
fs.mkdirSync(path.join(DATA, 'photos'), { recursive: true });

const FILE = path.join(DATA, 'state.json');

export function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { players: {}, carvings: [], nextCarving: 1 };
  }
}

let timer = null;
export function saveSoon(state) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    saveNow(state);
  }, 3000);
}

export function saveNow(state) {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  // Windows: Defender sometimes holds the fresh file for a moment, so retry the rename
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(tmp, FILE);
      return;
    } catch (e) {
      if (i === 4) console.error('save failed', e.message);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 80);
    }
  }
}

// Officer keys for the photo booth and the treat table, created once.
export function keys() {
  const f = path.join(DATA, 'keys.json');
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    const k = { booth: crypto.randomBytes(9).toString('base64url'), admin: crypto.randomBytes(12).toString('base64url') };
    fs.writeFileSync(f, JSON.stringify(k, null, 2));
    return k;
  }
}
