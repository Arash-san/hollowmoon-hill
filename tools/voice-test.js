// Voice talk end to end: Chrome's fake microphone plays a WAV while the test holds the mic button in an NPC dialog.
//   node tools/voice-test.js [clip.wav] [npc]     (base http://127.0.0.1:8830/: localhost counts as secure, so the mic works)
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:8830/';
const clip = path.resolve(process.argv[2] || '.tmp/voice-test.wav');
const npc = process.argv[3] || 'count';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', defaultViewport: { width: 1400, height: 850 },
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${clip}`],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true;
try {
  // behind the officer portal: HH_COOKIE_FILE holds a portal session token, sent as the llmGame cookie
  if (process.env.HH_COOKIE_FILE) {
    const { readFileSync } = await import('node:fs');
    await browser.setCookie({ name: 'llmGame', value: readFileSync(process.env.HH_COOKIE_FILE, 'utf8').trim(), domain: new URL(BASE).hostname, path: '/halloween/', secure: true, httpOnly: true });
  }
  const page = await browser.newPage();
  page.on('pageerror', (e) => { console.log('[page error]', e.message); ok = false; });
  await page.evaluateOnNewDocument(() => localStorage.setItem('hh-helped', '1'));
  await page.goto(`${BASE}?name=zzVoice&fresh=1`);
  await page.waitForFunction('window.__game && window.__game.me', { timeout: 30000 });
  // stand next to the NPC (the dialog closes when you walk more than 9 m away)
  await page.evaluate((id) => {
    const g = window.__game, n = g.npcs.get(id);
    g.me.pos.set(n.pos.x + 2, 0, n.pos.z + 2);
    g.ctrl.snapCam = true;
  }, npc);
  await sleep(400);
  await page.evaluate((id) => window.__game.openNpc(id), npc);
  await page.waitForSelector('#dialog .mic', { visible: true, timeout: 5000 });
  const box = await (await page.$('#dialog .mic')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(8000);
  await page.mouse.up();
  const t0 = Date.now();
  await page.waitForFunction(() => document.querySelectorAll('#dialog .msg.me').length > 0, { timeout: 20000 });
  const said = await page.$eval('#dialog .msg.me', (e) => e.textContent);
  console.log(`heard in ${Date.now() - t0} ms: "${said}"`);
  await page.waitForFunction(() => document.querySelectorAll('#dialog .msg.npc:not(.typing)').length > 1, { timeout: 30000 });
  const reply = await page.$$eval('#dialog .msg.npc:not(.typing)', (l) => l.at(-1).textContent);
  console.log(`${npc} replied after ${Date.now() - t0} ms: "${reply}"`);
  await sleep(600);
  await page.screenshot({ path: '.tmp/voice-dialog.png' });
  if (!/borrow/i.test(said)) ok = false;
} catch (e) {
  console.log('FAIL:', e.message);
  ok = false;
} finally {
  await browser.close();
}
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
