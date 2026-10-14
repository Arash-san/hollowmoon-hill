// Two players on a test server try the v3 features end to end: classes and powers, the Gloom Manor team room,
// the Pumpkin Bear, arena duels and the carving contest. Saves screenshots to .tmp/v3-*.png.
//   BASE=http://127.0.0.1:8831/ HH_ADMIN=<admin key> node tools/v3-test.js
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:8831/';
const KEY = process.env.HH_ADMIN || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) fails++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1400, height: 820 } });
const errors = [];
async function player(name) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('hh-helped', '1');
    localStorage.setItem('hh-prophecy', '1');
  });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(`${BASE}?name=${name}&fresh=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__game && window.__game.me && window.__game.state', { timeout: 30000 });
  await sleep(800);
  return page;
}
const tp = (page, x, z) => page.evaluate((x, z) => {
  const g = window.__game;
  g.me.pos.set(x, 0, z);
  g.ctrl.snapCam = true;
  g.sendMove(true);
}, x, z);
const g = (page, fn, ...a) => page.evaluate(fn, ...a);
const shot = async (page, name) => page.screenshot({ path: `.tmp/v3-${name}.png` });

const A = await player('zzAmy');
const B = await player('zzBen');

// ---------------- classes
await g(A, () => window.__game.net.send({ t: 'pickClass', cls: 'witch' }));
await g(B, () => window.__game.net.send({ t: 'pickClass', cls: 'zombie' }));
await sleep(800);
check((await g(A, () => window.__game.state.cls)) === 'witch', 'A is a Witch');
check((await g(B, () => window.__game.hp)) === 150, 'B is a Zombie with 150 health');
check(await g(A, () => !document.querySelector('#act-special').classList.contains('hidden')), 'power button shows');

// ---------------- arena duels (the Gourd King is asleep)
await tp(A, 0, -56);
await tp(B, 3, -56);
await sleep(1200);
await A.bringToFront();
await g(A, () => window.__game.spiders.map.clear());
const hpB0 = await g(B, () => window.__game.hp);
await g(A, () => (window.__game.lastThrow = 0, window.__game.attack()));
await sleep(1500);
const hpB1 = await g(B, () => window.__game.hp);
check(hpB1 < hpB0, `duel: B was hit (${hpB0} -> ${hpB1})`);
await shot(A, 'duel');

// ---------------- the class picker looks right
await g(A, () => document.querySelector('#modal .x')?.click());

// ---------------- Gloom Manor team room
await tp(A, 0, -71);
await tp(B, 1, -71);
await sleep(400);
await g(A, () => window.__game.net.send({ t: 'enterRoom' }));
await sleep(300);
await g(B, () => window.__game.net.send({ t: 'enterRoom' }));
await sleep(800);
const roomA = await g(A, () => window.__game.myRoom), roomB = await g(B, () => window.__game.myRoom);
check(roomA && roomA === roomB, `both in the same room (${roomA}, ${roomB})`);
await g(A, () => window.__game.net.send({ t: 'roomStart' }));
await sleep(800);
const hintsA = await g(A, () => window.__game.roomHints || []), hintsB = await g(B, () => window.__game.roomHints || []);
check(hintsA.length + hintsB.length === 4 && hintsA.length && hintsB.length, `the code is split between them (${hintsA.length} + ${hintsB.length})`);
await shot(A, 'room');
const code = [...hintsA, ...hintsB].sort((a, b) => a.i - b.i).map((h) => h.color);
// plate positions (shared/features.js): x = 420 - 7.5 + i*5, z = -2, order red, green, blue, gold
const PX = { red: 412.5, green: 417.5, blue: 422.5, gold: 427.5 };
for (const col of code) {
  await tp(A, PX[col], -2);
  await sleep(450);
  await tp(A, 420, 5);
  await sleep(450);
}
await sleep(1000);
const st = await g(A, () => ({ manor: !!window.__game.state.quests.manor?.done, moon: window.__game.state.items?.moon || 0 }));
check(st.manor && st.moon > 0, `Spirit Lock solved: quest done, Moon Potion ${st.moon}`);
await sleep(7500);
check((await g(A, () => window.__game.myRoom)) === 0, 'teleported back outside');

// ---------------- the Pumpkin Bear: Moon Potion + the Summoning
// runes around the circle (32,-34) at radius 5
const rune = (i) => {
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
  return [32 + Math.cos(a) * 5, -34 + Math.sin(a) * 5];
};
await tp(A, ...rune(0));
await tp(B, ...rune(1));
await sleep(4500);
const bear = await g(A, () => window.__game.bearState.state);
check(['intro', 'fight'].includes(bear), `the Pumpkin Bear woke up (${bear})`);
await sleep(4000);
await g(A, () => {
  const gm = window.__game;
  gm.ctrl.camYaw = 0.6;
  gm.ctrl.camDist = 14;
});
await sleep(800);
await shot(A, 'bear');
// the Zombie's groan clears the spiders around them first (spiders are always the nearest target)
const groan = async () => {
  await g(B, () => (window.__game.powerAt = 0));
  await g(B, () => document.querySelector('#act-special').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await sleep(500);
};
// background tabs get no animation frames (projectiles would never land): A must be the front tab
await A.bringToFront();
await tp(B, ...rune(0));
await groan();
for (let i = 0; i < 12; i++) {
  if (i % 4 === 0) await groan();
  await g(A, () => (window.__game.lastThrow = 0, window.__game.attack()));
  await sleep(420);
}
console.log('   debug', JSON.stringify(await g(A, async () => {
  const gm = window.__game;
  const sent = [];
  const orig = gm.net.send.bind(gm.net);
  gm.net.send = (m) => (m.t !== 'move' && m.t !== 'ping' && sent.push(m), orig(m));
  const t0 = gm.pickTarget(8, { players: true });
  gm.lastThrow = 0;
  gm.attack();
  await new Promise((r) => setTimeout(r, 1200));
  gm.net.send = orig;
  return { down: !!gm.downUntil, hp: gm.hp, bear: gm.bearState.state, active: gm.bearView.active(), me: [gm.me.pos.x.toFixed(1), gm.me.pos.z.toFixed(1)], target: t0 && { kind: t0.kind, b: t0.b, id: t0.id }, sent, spiders: gm.spiders.map.size };
})));
await sleep(600);
const bearHp = await g(A, () => [window.__game.bearState.hp, window.__game.bearState.maxHp]);
check(bearHp[0] < bearHp[1], `candy hurts the bear (${bearHp[0]}/${bearHp[1]})`);
// the Witch's fireball
const before = bearHp[0];
await groan();
// the bear may turn A into a pumpkin at any time: B revives A with a Revive Potion from the manor
let revived = false;
const reviveA = async () => {
  if (!(await g(A, () => !!window.__game.downUntil))) return;
  const [ax, az, aid] = await g(A, () => [window.__game.me.pos.x, window.__game.me.pos.z, window.__game.myId]);
  await tp(B, ax + 1, az);
  await sleep(400);
  await g(B, (id) => window.__game.net.send({ t: 'revive', id }), aid);
  await sleep(800);
  if (!revived) check(!(await g(A, () => !!window.__game.downUntil)), 'B revived A with a Revive Potion');
  revived = true;
};
let after = before;
for (let i = 0; i < 4 && after > before - 25; i++) {
  await groan();
  await reviveA();
  const tgt = await g(A, () => window.__game.pickTarget(14)?.kind);
  await g(A, () => (window.__game.powerAt = 0));
  await sleep(i ? 4500 : 0); // the server's 6 s cooldown
  await g(A, () => document.querySelector('#act-special').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await sleep(1500);
  after = await g(A, () => window.__game.bearState.hp);
  console.log(`   fireball try ${i + 1}: target ${tgt}, down ${await g(A, () => !!window.__game.downUntil)}, bear ${after}`);
}
check(after <= before - 25, `fireball does big damage (${before} -> ${after})`);

// ---------------- the team lantern
await B.bringToFront();
await g(B, () => document.querySelector('#act-lantern').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
await sleep(500);
check(await g(B, () => !document.querySelector('#team-flash').classList.contains('hidden')), 'lantern lights up the screen');
await shot(B, 'lantern');
await g(B, () => document.querySelector('#team-flash').click());

// ---------------- carving contest (officer event)
if (KEY) {
  await A.bringToFront();
  await g(A, (key) => fetch(`api/admin/event?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'carving' }) }), KEY);
  await sleep(1200);
  check(await g(A, () => !!window.__game.contest), 'contest started for players');
  await shot(A, 'contest');
  await g(A, () => window.__game.openContestCarve());
  await sleep(800);
  await shot(A, 'contest-carve');
  // a quick carving with the stamps, then submit
  await g(A, () => {
    for (const s of ['eyes', 'nose', 'smile']) document.querySelector(`.carve-tools [data-s="${s}"]`).click();
    document.querySelector('.carve-tools [data-done]').click();
  });
  await sleep(1200);
  console.log('   (contest results arrive when its timer ends)');
}

console.log(errors.length ? `page errors:\n${errors.slice(0, 8).join('\n')}` : 'no page errors');
console.log('FAILS', fails);
await browser.close();
