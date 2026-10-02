// revfix.mjs — verify Devin Review fixes on PR48 (interior race, caption race, map-mode, print)
import { chromium } from 'playwright-core';
const CDP = 'http://127.0.0.1:29229';
const out = {};
const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes(':8778')) || await ctx.newPage();

async function load(url) {
  await page.goto(url, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
  await page.waitForFunction('window.__ready === true', null, { timeout: 540000 });
}

// --- 1. interior race: start PRESENT from inside a building; no mid-flight snap ---
await load('http://127.0.0.1:8778/index.html?q=low&still=1');
await page.evaluate(() => window.__enterInterior('hospital'));
await page.waitForTimeout(1400);
const trace = await page.evaluate(async () => {
  const pts = [];
  window.__deck.start();
  const t0 = performance.now();
  while (performance.now() - t0 < 3200) {
    pts.push([Math.round(performance.now() - t0), ...window.__cam.position.toArray().map(v => Math.round(v))]);
    await new Promise(r => setTimeout(r, 120));
  }
  return pts;
});
// with the fix: at +190ms the saved outdoor pose restores (one snap), then the flight
// starts at +260 from that pose — so after 400ms motion must be monotonic toward the
// slide-0 target (620,520,690) with no second large jump.
const TGT = [620, 520, 690];
let jumps = 0, prev = null;
for (const [t, x, y, z] of trace) {
  if (t > 400 && prev) {
    const d = Math.hypot(x - prev[0], y - prev[1], z - prev[2]);
    if (d > 120) jumps++;
  }
  prev = [x, y, z];
}
const lastD = Math.hypot(...trace.at(-1).slice(1).map((v, k) => v - TGT[k]));
out.interior = { on: await page.evaluate('__deck.on'), lateJumps: jumps, lastDist: lastD,
  pass: lastD < 500 && jumps <= 1 };
await page.evaluate(() => __deck.exit());

// --- 2. caption race: exit inside the 360ms reveal, restart, no stale caption ---
out.caption = await page.evaluate(async () => {
  __deck.start();
  await new Promise(r => setTimeout(r, 900));
  __deck.next();                                    // slide 1 caption pending
  __deck.exit();                                    // inside its 360ms window
  await new Promise(r => setTimeout(r, 600));
  const afterExit = document.querySelector('#uiDeck .cap').innerHTML;
  __deck.start();
  await new Promise(r => setTimeout(r, 800));
  const h1 = document.querySelector('#uiDeck .cap h1')?.textContent || '';
  __deck.exit();
  return { afterExit, h1, pass: afterExit === '' && h1 === 'HAVENBROOK' };
});

// --- 3. map mode: button hidden, start() is a no-op ---
await load('http://127.0.0.1:8778/index.html?view=map&q=low&still=1');
out.map = await page.evaluate(async () => {
  const btn = document.getElementById('uiBtnDeck');
  __deck.start();
  await new Promise(r => setTimeout(r, 300));
  return { mapOn: window.__mapOn, btnDisplay: getComputedStyle(btn).display,
    deckOn: __deck.on, pass: window.__mapOn === true && getComputedStyle(btn).display === 'none' && __deck.on === false };
});

// --- 4. print: /deck/ exports exactly 9 pages ---
await page.goto('http://127.0.0.1:8778/deck/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1200);
const pdf = await page.pdf({ printBackground: true });
await (await import('fs')).promises.writeFile('/tmp/deck.pdf', pdf);
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
out.print = { pages, pass: pages === 9 };

console.log(JSON.stringify(out, null, 1));
await page.close().catch(() => {});
await browser.close().catch(() => {});
