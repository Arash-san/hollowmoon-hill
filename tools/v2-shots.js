// Screenshots of the v2 features on a test server. BASE=http://127.0.0.1:8831/ node tools/v2-shots.js [what...]
// what: hud, checklist, map, booth, avatars (default: all)
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:8831/';
const want = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ['hud', 'checklist', 'map', 'booth']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => localStorage.setItem('hh-helped', '1'));
const logs = [];
page.on('console', (m) => m.type() === 'error' && logs.push(`[console] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack || e.message}`));
await page.goto(`${BASE}?name=zzShots&fresh=1`, { waitUntil: 'load' });
await page.waitForFunction('window.__game && window.__game.me', { timeout: 30000 });
await sleep(1500);
await page.evaluate(() => document.querySelector('#modal .x')?.click());
const tp = (x, z, yaw = 0) => page.evaluate((x, z, yaw) => {
  const g = window.__game;
  g.me.pos.set(x, 0, z);
  g.ctrl.camYaw = yaw;
  g.ctrl.snapCam = true;
}, x, z, yaw);
const shot = async (name) => {
  await page.screenshot({ path: `.tmp/v2-${name}.png` });
  console.log('saved', `.tmp/v2-${name}.png`);
};

if (want.has('hud')) {
  // standing at spawn looking toward the booth: the tent, its sign and the mini-map
  await tp(-2, 14, -0.9);
  await sleep(1500);
  await shot('hud');
}
if (want.has('checklist')) {
  await page.evaluate(() => window.__game.questsModal());
  await sleep(500);
  await shot('checklist');
  await page.evaluate(() => document.querySelector('#modal .x')?.click());
}
if (want.has('map')) {
  // tap the Candle Vigil card in the HUD panel: it should track it and open the map on it
  await page.evaluate(() => document.querySelector('#quest-panel .qcard[data-q="candles"]')?.click());
  await sleep(900);
  await shot('map');
  await page.evaluate(() => document.querySelector('#modal .x')?.click());
  await sleep(400);
  await shot('tracked');
}
if (want.has('booth')) {
  await tp(-6.5, 3.6, -0.9);
  await sleep(700);
  const label = await page.evaluate(() => window.__game.nearest()?.label);
  console.log('nearest:', label);
  await page.evaluate(() => window.__game.interact());
  await sleep(2500);
  await shot('booth');
}
const KEY = process.env.HH_ADMIN || '';
const gm = (p, body) => page.evaluate(async (p, body, key) => (await fetch(`api/admin/${p}?key=${encodeURIComponent(key)}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})).json(), p, body, KEY);

if (want.has('journal')) {
  await page.evaluate(() => window.__game.ui.journal(window.__game.state));
  await sleep(500);
  await shot('journal');
  await page.evaluate(() => document.querySelector('#modal .x')?.click());
}
if (want.has('spiders')) {
  // stand in the graveyard and let a spider come
  await tp(-30, -30, 0.6);
  const hp0 = await page.evaluate(() => window.__game.hp);
  let bitten = false;
  for (let i = 0; i < 30 && !bitten; i++) {
    await sleep(500);
    bitten = await page.evaluate((h) => window.__game.hp < h, hp0);
  }
  console.log('spiders seen:', await page.evaluate(() => window.__game.spiders.map.size), 'bitten:', bitten, 'hp:', await page.evaluate(() => window.__game.hp));
  await shot('spiders');
  // squash the nearest one
  const before = await page.evaluate(() => window.__game.spiders.map.size);
  await page.evaluate(() => window.__game.attack());
  await sleep(1500);
  console.log('spiders after a throw:', before, '->', await page.evaluate(() => window.__game.spiders.map.size));
}
if (want.has('down')) {
  // take five boss hits (the server allows one every 0.6 s) and turn into a pumpkin
  await tp(-2, 8, 0);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.__game.net.send({ t: 'hurt', src: 'boss' }));
    await sleep(700);
  }
  await sleep(600);
  console.log('down:', await page.evaluate(() => !!window.__game.downUntil), 'hp:', await page.evaluate(() => window.__game.hp));
  await shot('down');
}
if (want.has('finale')) {
  console.log('start finale:', JSON.stringify(await gm('event', { kind: 'finale' })));
  await tp(0, 13, 0);
  await sleep(6500);
  await shot('finale');
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.__game.attack());
    await sleep(420);
  }
  await sleep(800);
  console.log('finale state:', JSON.stringify(await page.evaluate(() => ({ s: window.__game.finaleState.state, hp: window.__game.finaleState.hp, max: window.__game.finaleState.maxHp }))));
  await shot('finale-fight');
}
if (want.has('gm')) {
  await page.goto(`${BASE}gm.html?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load' });
  await sleep(1500);
  await shot('gm');
}
console.log(logs.slice(0, 15).join('\n'));
await browser.close();
