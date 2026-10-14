// Drive the real client in headless Chrome and take screenshots of scenarios.
//   node tools/play.js <scenario> [out.png] [w] [h]
// Scenarios: npc, pumpkins, wisps, potion, carve, boss, map, tablet, dance, ritual
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:8830/';
const [, , scenario = 'npc', out = `.tmp/play-${scenario}.png`, W = '1600', H = '900'] = process.argv;
const mobile = scenario === 'tablet';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: mobile ? { width: 1180, height: 820, deviceScaleFactor: 1, hasTouch: true, isMobile: true } : { width: +W, height: +H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => (localStorage.setItem('hh-helped', '1'), localStorage.setItem('hh-prophecy', '1')));
const logs = [];
page.on('console', (m) => m.type() !== 'warning' && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack || e.message}`));
await page.goto(`${BASE}?name=${scenario}Bot&fresh=1`, { waitUntil: 'load' });
await page.waitForFunction('window.__game && window.__game.me', { timeout: 30000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(800);
await page.evaluate(() => document.querySelector('#modal .x')?.click());
const tp = (x, z, yaw = 0) => page.evaluate((x, z, yaw) => {
  const g = window.__game;
  g.me.pos.set(x, 0, z);
  g.ctrl.camYaw = yaw;
  g.ctrl.snapCam = true;
}, x, z, yaw);

switch (scenario) {
  case 'npc': {
    await tp(-3, -2, -0.6);
    await sleep(300);
    await page.evaluate(() => window.__game.openNpc('count'));
    await tp(-9, 30.5, Math.PI + 0.4);
    await page.evaluate(() => window.__game.openNpc('count'));
    await sleep(300);
    await sleep(2500); // let the greeting arrive first
    await page.evaluate(() => {
      const g = window.__game;
      const orig = g.onNpc.bind(g);
      g.onNpc = (m) => ((window.__reply = m.say), orig(m));
    });
    await page.evaluate(() => window.__game.ui.handlers.talk('count', 'Good evening, Count! Your cape is the finest in all of Hollowmoon. Might I borrow 80 candy? I will repay you with interest after I defeat the Gourd King.'));
    // the reply shows as a talk bubble over the Count's head (and is spoken by Kokoro)
    await page.waitForFunction(() => window.__reply, { timeout: 30000 }).catch(() => logs.push('no npc reply'));
    logs.push('reply: ' + (await page.evaluate(() => window.__reply)));
    logs.push('bubble: ' + (await page.evaluate(() => window.__game.npcs.get('count')?.pages?.join(' | '))));
    const offer = await page.evaluate(() => document.querySelector('#dialog .offer:not(.hidden) span')?.textContent || 'no offer');
    logs.push('offer: ' + offer);
    await sleep(600);
    break;
  }
  case 'pumpkins': {
    await tp(36, 14, 0.4);
    await sleep(600);
    const got = await page.evaluate(async () => {
      const g = window.__game;
      let n = 0;
      for (const [, e] of [...g.acts.pumpkins].slice(0, 6)) {
        g.me.pos.set(e.item.x + 0.8, 0, e.item.z + 0.8);
        await new Promise((r) => setTimeout(r, 250));
        g.interact();
        await new Promise((r) => setTimeout(r, 350));
        n++;
      }
      return n;
    });
    logs.push(`picked attempts ${got}`);
    await sleep(1500);
    break;
  }
  case 'wisps': {
    await tp(-50, -4, 1.2);
    await sleep(500);
    const n = await page.evaluate(async () => {
      const g = window.__game;
      const { wispPos } = await import('/assets/main.js').catch(() => ({}));
      void wispPos;
      let caught = 0;
      for (let k = 0; k < 4; k++) {
        const list = g.interactables().filter((i) => i.short === 'Catch');
        if (!list.length) break;
        const w = list[0];
        g.me.pos.set(w.x + 0.5, 0, w.z + 0.5);
        await new Promise((r) => setTimeout(r, 120));
        const near = g.nearest();
        if (near && near.short === 'Catch') {
          near.act();
          caught++;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      return caught;
    });
    logs.push(`wisps tried ${n}`);
    await sleep(1500);
    break;
  }
  case 'potion': {
    await tp(-38, 13.4, 2.8);
    await sleep(400);
    await page.evaluate(() => window.__game.interact());
    await sleep(1200);
    break;
  }
  case 'carve': {
    await tp(32.2, 16.8, 0);
    await sleep(400);
    await page.evaluate(() => window.__game.interact());
    await sleep(500);
    await page.evaluate(() => {
      for (const s of ['eyes', 'nose', 'smile']) document.querySelector(`[data-s="${s}"]`).click();
    });
    await sleep(800);
    await page.screenshot({ path: out.replace('.png', '-mg.png') });
    await page.evaluate(() => document.querySelector('[data-done]').click());
    await tp(0, 24, 0);
    await sleep(2500);
    break;
  }
  case 'boss': {
    await tp(BOSS(0), BOSS(1), 0.3);
    await sleep(300);
    await page.evaluate(() => window.__game.interact());
    await sleep(6500);
    await tp(4, -44, 0.2);
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => window.__game.attack());
      await sleep(400);
    }
    await sleep(500);
    break;
  }
  case 'map': {
    await page.evaluate(() => document.querySelector('#map-btn').click());
    await sleep(800);
    break;
  }
  case 'tablet': {
    await tp(-3, 6, 0.3);
    await sleep(1500);
    break;
  }
  case 'dance': {
    await tp(30, 40, 0);
    await sleep(300);
    await page.evaluate(() => window.__game.doEmote('dance'));
    await sleep(15000);
    break;
  }
  case 'ritual': {
    await tp(28.5, -37.5, 0.8);
    await sleep(12000);
    break;
  }
}
function BOSS(i) {
  return [9 + 2.5, -46 + 1.5][i];
}

await page.screenshot({ path: out });
const state = await page.evaluate(() => ({ candy: window.__game.state?.candy, quests: Object.entries(window.__game.state?.quests || {}).filter(([, q]) => q.done || q.n).map(([k, q]) => `${k}:${q.n}${q.done ? '✓' : ''}`).join(' '), boss: window.__game.bossState?.state, hp: window.__game.bossState?.hp, info: window.__game.stage.renderer.info.render }));
console.log(JSON.stringify({ out, ...state }));
for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();
