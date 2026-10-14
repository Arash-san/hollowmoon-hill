// End-to-end booth test: a game client joins, the booth uploads a photo for it, both screens are captured.
//   node tools/booth-test.js <photo.jpg>
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:8830/';
const photo = process.argv[2] || '.tmp/test-photo.jpg';
const keys = JSON.parse(fs.readFileSync('data/keys.json', 'utf8'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'], defaultViewport: { width: 1500, height: 860 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const game = await browser.newPage();
await game.evaluateOnNewDocument(() => localStorage.setItem('hh-helped', '1'));
const name = 'Booth' + Math.floor(Math.random() * 1000);
await game.goto(`${BASE}?name=${name}&fresh=1`);
await game.waitForFunction('window.__game && window.__game.me', { timeout: 30000 });
const code = await game.evaluate(() => window.__game.state.code);

const booth = await browser.newPage();
booth.on('pageerror', (e) => console.log('[booth error]', e.message));
await booth.goto(`${BASE}booth.html?key=${keys.booth}`);
await booth.waitForSelector('.p');
await booth.type('#search', code);
await booth.keyboard.press('Enter');
await sleep(500);
const input = await booth.$('#file');
await input.uploadFile(photo);
await sleep(400);
const t0 = Date.now();
await booth.click('#use');
await booth.waitForSelector('#result:not(.hidden)', { timeout: 120000 });
console.log('avatar designed in', Date.now() - t0, 'ms');
await sleep(2500);
await booth.screenshot({ path: '.tmp/booth-result.png' });
await game.bringToFront();
await sleep(1500);
await game.screenshot({ path: '.tmp/booth-game.png' });
console.log(await booth.$eval('#traits', (e) => e.textContent), '|', await booth.$eval('#rtitle', (e) => e.textContent));
await browser.close();
