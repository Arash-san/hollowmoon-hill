// NPC memory and actions end to end (typed talk, no microphone): a player tells Madame Hex about themselves, asks
// for directions (she should mark the quest on the map), reloads the game, and checks that she still remembers
// them and that another character has heard the gossip.
//   BASE=http://127.0.0.1:8831/ node tools/npc-memory-test.js
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:8831/';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1400, height: 850 }, args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--mute-audio'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true;
const check = (cond, what) => (console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`), cond || (ok = false));

async function open(fresh) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => ((ok = false), console.log('[page error]', e.message)));
  await page.evaluateOnNewDocument(() => (localStorage.setItem('hh-helped', '1'), localStorage.setItem('hh-prophecy', '1')));
  await page.goto(`${BASE}?name=zzMemo${fresh ? '&fresh=1' : ''}`);
  await page.waitForFunction('window.__game && window.__game.me', { timeout: 30000 });
  await page.evaluate(() => {
    const g = window.__game;
    const onNpc = g.onNpc.bind(g);
    g.onNpc = (m) => (!m.greet && (window.__replies ||= []).push(m), onNpc(m));
  });
  return page;
}

async function talk(page, npc, text) {
  await page.evaluate((id) => {
    const g = window.__game, n = g.npcs.get(id);
    g.me.pos.set(n.pos.x + 2, 0, n.pos.z + 2);
    if (g.ui.dialogNpc !== id) g.openNpc(id);
  }, npc);
  await sleep(1500);
  const before = await page.evaluate(() => (window.__replies || []).length);
  await page.evaluate((id, t) => window.__game.ui.handlers.talk(id, t), npc, text);
  await page.waitForFunction((n) => (window.__replies || []).length > n, { timeout: 30000 }, before);
  const r = await page.evaluate(() => window.__replies.at(-1));
  console.log(`  you: ${text}\n  ${npc}: ${r.say}${r.guide ? `   [marked on map: ${r.guide}]` : ''}`);
  await sleep(1200); // the server takes a talk every 0.9 s at most
  return r;
}

try {
  let page = await open(true);
  await talk(page, 'hex', 'Hi Madame Hex! I am a huge fan of dragons, and my favourite colour is emerald green.');
  const r2 = await talk(page, 'hex', 'Where can I find the lost wisps you need? How does that quest work?');
  check(r2.guide === 'wisps', 'Hex marks the wisp quest on the map');
  check(await page.evaluate(() => window.__game.tracked) === 'wisps', 'the map now tracks that quest');
  await page.close();

  page = await open(false); // same player, new page
  const r3 = await talk(page, 'hex', 'Do you remember me? What do I love, and what is my favourite colour?');
  check(/dragon/i.test(r3.say) && /green|emerald/i.test(r3.say), 'Hex remembers dragons and green after a reload');
  const r4 = await talk(page, 'count', 'Good evening Count! Has anyone in town told you anything about me?');
  check(/dragon|green|emerald|hex|witch/i.test(r4.say), 'the Count has heard the gossip from Madame Hex');
  const r5 = await talk(page, 'count', 'Tell me a joke!');
  const r6 = await talk(page, 'count', 'Tell me another joke!');
  check(r5.say !== r6.say, 'no repeated line');
  await page.screenshot({ path: '.tmp/npc-memory.png' });
} catch (e) {
  console.log('FAIL:', e.message);
  ok = false;
} finally {
  await browser.close();
}
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
