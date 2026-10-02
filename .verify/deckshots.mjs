// deckshots.mjs — capture hero shots for town/deck. One Chrome page, one
// quality/time per run:  node deckshots.mjs <time> <q>
// Output: town/deck/shots/<name>.jpg  (1600x900 jpg q88)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [time = 'day', q = 'high'] = process.argv.slice(2);
const OUT = new URL('../town/deck/shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = {
  day: [
    ['02-plan',     [60, 780, 560, -20, 0, -60]],
    ['03-campus',   [-290, 120, -700, -480, 16, -565]],
    ['04-wellness', [300, 110, -620, 20, 26, -440]],
    ['05-preserve', [-270, 150, 430, -500, 8, 190]],
    ['07-senior',   [640, 100, -330, 520, 12, -550]],
  ],
  golden: [
    ['01-cover', [620, 520, 690, -60, 0, -70]],
    ['06-park',  [330, 130, 330, 575, 6, 130]],
  ],
  dusk: [
    ['08-close', [620, 540, 720, -60, 0, -60]],
  ],
};

const browser = await chromium.connectOverCDP('http://127.0.0.1:29229');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('127.0.0.1:8778')) || await ctx.newPage();
await page.setViewportSize({ width: 1600, height: 900 });
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const t0 = Date.now();
/* the app's own 30s boot watchdog (sessionStorage hbBoot) can re-navigate the
   page mid-goto at heavy tiers — an interrupted goto is fine, __ready still
   flips on whichever reload wins; just don't die on it */
await page.goto(`http://127.0.0.1:8778/index.html?q=${q}&time=${time}&still=1`,
  { waitUntil: 'commit', timeout: 60000 }).catch(e => console.log('GOTOERR', e.message.slice(0, 80)));
try {
  await page.waitForFunction('window.__ready === true', null, { timeout: 540000, polling: 3000 });
} catch {}
const ready = await page.evaluate('window.__ready === true');
console.log('READY', ready, Math.round((Date.now() - t0) / 1000) + 's', 'errors=' + errors.length);
if (!ready) { console.log(JSON.stringify(errors.slice(0, 5))); process.exit(1); }
await page.evaluate(() => { for (const id of ['hudUI','hint','compass','labels','legend','titlecard','hud']) {
  const el = document.getElementById(id); if (el) el.style.display = 'none'; } });

for (const [name, cam] of SHOTS[time]) {
  await page.evaluate(v => window.__setCam(...v), cam);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 88, timeout: 120000 });
  console.log('SHOT', name, errors.length ? JSON.stringify(errors.slice(-2)) : '');
}
await page.close();
process.exit(0);
