// Screenshots at a real tablet size with touch (default 1472x760, an Android tablet in landscape Chrome):
// the HUD with toasts, and Madame Hex's dialog open.
//   BASE=http://127.0.0.1:8831/ node tools/tablet-shots.js [out-prefix] [WxH]
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:8831/';
const out = process.argv[2] || '.tmp/tablet';
const [W, H] = (process.argv[3] || '1472x760').split('x').map(Number);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--mute-audio'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => (localStorage.setItem('hh-helped', '1'), localStorage.setItem('hh-prophecy', '1')));
  await page.goto(`${BASE}?name=zzTablet&fresh=1`);
  await page.waitForFunction('window.__game && window.__game.me', { timeout: 30000 });
  await sleep(1500);
  await page.evaluate(() => {
    const g = window.__game;
    g.ui.toast('Quest complete: Pumpkin Harvest (+25 🍬)', 'good');
    g.ui.toast('Hay-ley\'s notebook: "The biggest pumpkins vanish every night... always rolling toward the Mayor\'s stall." (read all clues in 📖)', 'announce');
    g.ui.toast('✨ The Prophecy: 2/4', 'info');
  });
  await sleep(700);
  await page.screenshot({ path: `${out}-hud.png` });
  await page.evaluate(() => {
    const g = window.__game, n = g.npcs.get('hex');
    g.me.pos.set(n.pos.x + 2.2, 0, n.pos.z + 2.2);
    g.ctrl.snapCam = true;
  });
  await sleep(600);
  await page.evaluate(() => window.__game.openNpc('hex'));
  await sleep(3500);
  await page.screenshot({ path: `${out}-dialog.png` });
} finally {
  await browser.close();
}
console.log('saved', `${out}-hud.png`, `${out}-dialog.png`);
