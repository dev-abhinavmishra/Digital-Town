// eval-city.mjs — sprint-02 CITY-stream evaluator verification, single session.
// Views chosen per contract-city: perf gates (D1-D3), props/traffic/veg probes,
// signal phase proof (timed shots), freeze pixel-diff (D5), dusk lampIM check.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXE = 'C:/Users/pmsma/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const OUT = 'C:/Users/pmsma/Downloads/HST Digital Town Project';
const BASE = 'http://localhost:8778';

const VIEWS = [
  ['aerial-noao',   `${BASE}/?view=aerial&noao=1&still=1`, {fps:4}],
  ['street-noao',   `${BASE}/?view=mainstreet&noao=1&still=1`, {}],
  ['jxn-main-univ', `${BASE}/?view=mainstreet&still=1&cam=-80,10,-72,-140,1,-40`, {signal:true}],
  ['jxn-elm-cedar', `${BASE}/?view=mainstreet&still=1&cam=-602,12,182,-640,1,140`, {}],
  ['jxn-commerce-cedar', `${BASE}/?view=mainstreet&still=1&cam=-600,14,274,-640,1,320`, {}],
  ['commerce-closeup', `${BASE}/?view=mainstreet&still=1&cam=0,3.4,338,-140,3,328`, {}],
  ['campus-elms',   `${BASE}/?view=mainstreet&still=1&cam=-480,9,-430,-480,3,-560`, {}],
  ['dusk-main',     `${BASE}/?view=mainstreet&time=dusk&still=1`, {}],
];

const browser = await chromium.launch({
  executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox',
    '--proxy-server=direct://', '--proxy-bypass-list=*', '--host-resolver-rules=MAP localhost 127.0.0.1'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

async function boot(url, tries = 3) {
  for (let a = 1; a <= tries; a++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction('window.__ready === true', null, { timeout: 200000 });
      if (await page.evaluate(() => window.__ready === true)) return a;
    } catch { }
  }
  return -1;
}
const readCity = () => page.evaluate(() => ({
  calls: window.__renderer?.info?.render?.calls,
  city: window.__city || null,
  pools: window.__fx?.atmo?.lampPools ?? null,
  ready: window.__ready === true,
})).catch(() => null);
const fpsSample = (secs) => page.evaluate(async (s) => {
  const ts = [];
  await new Promise(res => {
    let last = performance.now();
    const step = (t) => { ts.push(t - last); last = t; requestAnimationFrame(step); };
    requestAnimationFrame(step); setTimeout(res, s * 1000);
  });
  ts.shift(); ts.sort((a, b) => a - b);
  const med = ts[Math.floor(ts.length / 2)];
  return { medianMs: +med.toFixed(1), fps: +(1000 / med).toFixed(1), n: ts.length };
}, secs).catch(() => null);

const report = [];
for (const [name, url, opt] of VIEWS) {
  const errors = []; let envFlaps = 0;
  const onCon = m => { if (m.type() === 'error') {
    if (m.text().includes('ERR_NETWORK_CHANGED')) envFlaps++; else errors.push(m.text()); } };
  const onErr = e => errors.push('PAGEERROR: ' + e.message);
  page.on('console', onCon); page.on('pageerror', onErr);

  const attempts = await boot(url);
  await page.waitForTimeout(2500);
  const p = await readCity();
  const fps = opt.fps && p?.ready ? await fpsSample(opt.fps) : null;

  const rec = { name, ready: !!p?.ready, attempts, calls: p?.calls,
    appErrors: errors.length, envFlaps, errors: errors.slice(0, 5), fps };
  if (name === 'aerial-noao') rec.city = p?.city ?? null;
  if (opt.signal && p?.ready) {
    const s0 = await page.evaluate(() => window.__city?.traffic?.signals ?? null);
    rec.signalsT0 = s0;
    await page.screenshot({ path: `${OUT}/eval-s02-city-${name}-t0.png` });
    await page.waitForTimeout(10000);
    const s1 = await page.evaluate(() => window.__city?.traffic?.signals ?? null);
    rec.signalsT1 = s1;
    await page.screenshot({ path: `${OUT}/eval-s02-city-${name}-t10.png` });
  } else {
    await page.screenshot({ path: `${OUT}/eval-s02-city-${name}.png` });
  }
  if (name === 'dusk-main') rec.lampPools = p?.pools;
  report.push(rec);
  page.off('console', onCon); page.off('pageerror', onErr);
}

// D5 freeze determinism — two loads, pixel-diff via data-URL canvases
const furl = `${BASE}/?view=mainstreet&still=1&noao=1&freeze=1`;
const fshots = [];
for (let i = 0; i < 2; i++) {
  const errors = [];
  const onErr2 = e => errors.push('PAGEERROR: ' + e.message);
  page.on('pageerror', onErr2);
  const a = await boot(furl, 3);
  await page.waitForTimeout(2500);
  const f = `${OUT}/eval-s02-city-freeze${i}.png`;
  await page.screenshot({ path: f });
  fshots.push(f);
  report.push({ name: `freeze-${i}`, ready: a > 0, attempts: a, errors: errors.slice(0, 5) });
  page.off('pageerror', onErr2);
}
// real pixel-diff: push both PNGs into the page as data URLs, canvas-compare
const b64 = fshots.map(f => fs.readFileSync(f).toString('base64'));
const diff = await page.evaluate(async ([a64, b64]) => {
  const load = s => new Promise((res, rej) => { const i = new Image();
    i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + s; });
  const [ia, ib] = await Promise.all([load(a64), load(b64)]);
  const c = document.createElement('canvas');
  c.width = ia.width; c.height = ia.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
  x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0);
  const db = x.getImageData(0, 0, c.width, c.height).data;
  let diffPx = 0;
  for (let i = 0; i < da.length; i += 4) {
    if (Math.abs(da[i] - db[i]) > 8 || Math.abs(da[i+1] - db[i+1]) > 8 ||
        Math.abs(da[i+2] - db[i+2]) > 8) diffPx++;
  }
  return { w: ia.width, h: ia.height, diffPx,
           pct: +(100 * diffPx / (ia.width * ia.height)).toFixed(3) };
}, b64).catch(e => ({ err: e.message }));
report.push({ name: 'freeze-diff', ...diff });

fs.writeFileSync(`${OUT}/.verify/eval-city-report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
