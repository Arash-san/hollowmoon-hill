// Officer flow: signed in to the portal only -> Home shows the game card -> Play now opens the game (nginx gate).
//   HH_COOKIE_FILE=<portal session token file> node tools/portal-flow-test.js
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HOST = 'llmclub.inquirelab.ai';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1400, height: 900 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true;
try {
  await browser.setCookie({ name: 'llmOfficer', value: readFileSync(process.env.HH_COOKIE_FILE, 'utf8').trim(), domain: HOST, path: '/api/llm-club/portal', secure: true, httpOnly: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => { console.log('[page error]', e.message); ok = false; });
  await page.goto(`https://${HOST}/`, { waitUntil: 'networkidle2' });
  const href = await page.waitForSelector('a[href="/halloween/"]', { timeout: 20000 }).then((a) => a.evaluate((e) => e.href));
  const card = await page.$eval('a[href="/halloween/"]', (a) => a.closest('div[class*=banner]').getBoundingClientRect().toJSON());
  await page.screenshot({ path: '.tmp/portal-card.png', clip: { x: 0, y: 0, width: 1400, height: Math.min(900, card.bottom + 40) } });
  console.log('card link:', href);
  const game = await browser.newPage();
  game.on('pageerror', (e) => { console.log('[game error]', e.message); ok = false; });
  await game.evaluateOnNewDocument(() => localStorage.setItem('hh-helped', '1'));
  await game.goto(href + '?fresh=1');
  await game.waitForSelector('#name-input', { visible: true, timeout: 30000 });
  await game.type('#name-input', 'zzPortal');
  await game.keyboard.press('Enter');
  await game.waitForFunction('window.__game && window.__game.me', { timeout: 30000 });
  console.log('game opened at', game.url());
  await sleep(2500);
  await game.screenshot({ path: '.tmp/portal-game.png' });
} catch (e) {
  console.log('FAIL:', e.message);
  ok = false;
} finally {
  await browser.close();
}
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
