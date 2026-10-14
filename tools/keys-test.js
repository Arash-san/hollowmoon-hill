// Login with the keyboard, then check that keys move the player (regression for "keys do nothing after login").
//   node tools/keys-test.js [base url]   (HH_COOKIE_FILE=<token file> for https://llmclub.inquirelab.ai/halloween/)
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://127.0.0.1:8830/';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1400, height: 850 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  // behind the officer portal: HH_COOKIE_FILE holds a portal session token, sent as the llmGame cookie
  if (process.env.HH_COOKIE_FILE) {
    const { readFileSync } = await import('node:fs');
    const u = new URL(BASE);
    await browser.setCookie({ name: 'llmGame', value: readFileSync(process.env.HH_COOKIE_FILE, 'utf8').trim(), domain: u.hostname, path: '/halloween/', secure: true, httpOnly: true });
  }
  await page.evaluateOnNewDocument(() => localStorage.setItem('hh-helped', '1'));
  await page.goto(`${BASE}?fresh=1`);
  await page.waitForSelector('#name-input', { visible: true, timeout: 30000 });
  await sleep(300);
  await page.type('#name-input', 'zzKeys');
  await page.keyboard.press('Enter');
  await page.waitForFunction('window.__game && window.__game.me', { timeout: 30000 });
  await sleep(1500);
  const chatOpen = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  console.log('focused after login:', chatOpen);
  const a = await page.evaluate(() => ({ x: window.__game.me.pos.x, z: window.__game.me.pos.z }));
  await page.keyboard.down('w');
  await sleep(1200);
  await page.keyboard.up('w');
  await sleep(200);
  const b = await page.evaluate(() => ({ x: window.__game.me.pos.x, z: window.__game.me.pos.z }));
  const moved = Math.hypot(b.x - a.x, b.z - a.z);
  console.log('moved with W:', moved.toFixed(2), 'm');
  if (moved < 1) ok = false;
  if (chatOpen === 'chat-input' || chatOpen === 'INPUT') ok = false;
} finally {
  await browser.close();
}
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
