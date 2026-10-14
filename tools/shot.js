// Open a page in headless Chrome and save a screenshot. Used to look at the game without a display.
// node tools/shot.js <url|file> <out.png> [width] [height] [waitMs] [extraJsToRun]
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [, , target, out = '.tmp/shot.png', w = '1280', h = '720', wait = '1500', js = ''] = process.argv;

let url = target;
if (!/^https?:|^file:/.test(target)) {
  const [file, query] = target.split('?');
  url = pathToFileURL(path.resolve(file)).href + (query ? `?${query}` : '');
}
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: +w, height: +h, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack || e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()}`));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 30000 }).catch(() => logs.push('[shot] __ready never became true'));
if (js) await page.evaluate(js);
await new Promise((r) => setTimeout(r, +wait));
const info = await page.evaluate(() => ({ gpu: window.__gpu, webgl2: window.__webgl2 }));
await page.screenshot({ path: out });
console.log(JSON.stringify({ out, ms: Date.now() - t0, ...info }));
for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
