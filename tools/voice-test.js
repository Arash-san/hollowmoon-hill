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
  await page.evaluateOnNewDocument(() => (localStorage.setItem('hh-helped', '1'), localStorage.setItem('hh-prophecy', '1')));
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
  await sleep(2500); // the greeting first
  // what I said and what they answered both appear as bubbles; record them
  await page.evaluate(() => {
    const g = window.__game;
    const talk = g.ui.handlers.talk;
    g.ui.handlers.talk = (n, text) => ((window.__said = text), talk(n, text));
    const onNpc = g.onNpc.bind(g);
    g.onNpc = (m) => ((window.__reply = m.say), onNpc(m));
    const qv = g.queueVoice.bind(g);
    g.queueVoice = (m) => ((window.__clips ||= []).push({ ...m, at: Date.now() }), qv(m));
  });
  await page.waitForSelector('#dialog .mic', { visible: true, timeout: 5000 });
  const box = await (await page.$('#dialog .mic')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(1000);
  console.log('while holding:', await page.evaluate((x, y) => `${window.__game.ui.voice.state} top=${(() => { const e = document.elementFromPoint(x, y); return e ? e.tagName + "#" + e.id + "." + e.getAttribute("class") + " < " + e.parentElement?.tagName + "." + e.parentElement?.getAttribute("class") : "none"; })()} box=${JSON.stringify(document.querySelector("#dialog .mic").getBoundingClientRect())}`, box.x + box.width / 2, box.y + box.height / 2));
  await sleep(7000);
  await page.mouse.up();
  const t0 = Date.now();
  await page.waitForFunction(() => window.__said, { timeout: 20000 }).catch(async (e) => {
    console.log('state:', await page.evaluate(() => JSON.stringify({ npc: window.__game.ui.dialogNpc, toasts: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent), mic: document.querySelector('#dialog .mic .lb')?.textContent })));
    throw e;
  });
  const said = await page.evaluate(() => window.__said);
  console.log(`heard in ${Date.now() - t0} ms: "${said}"`);
  await page.waitForFunction(() => window.__reply, { timeout: 30000 });
  const reply = await page.evaluate(() => window.__reply);
  const clip = await page.waitForFunction(() => window.__clips?.[0], { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => null);
  console.log(clip ? `first voice clip ${clip.audio} after ${clip.at - t0} ms` : 'no voice clip');
  if (!clip) ok = false;
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
