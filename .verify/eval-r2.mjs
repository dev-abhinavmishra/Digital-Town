// eval-r2.mjs — sprint-02 round-02 evaluator verification, single browser session.
// Walks each view: __ready wait, settle, __fx probe, screenshot, fps sample.
// Usage: node eval-r2.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXE = 'C:/Users/pmsma/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const OUT = 'C:/Users/pmsma/Downloads/HST Digital Town Project';
const BASE = 'http://localhost:8778';

const VIEWS = [
  // exact round-01 blocker cam — must show zero axis-aligned sprite edges
  ['blocker-day',   `${BASE}/?view=mainstreet&still=1&cam=-150,4,-34,140,180,-60`, 0],
  // day aerial — haze tune-down + perf (full pipe)
  ['aerial-day',    `${BASE}/?view=aerial&still=1`, 4],
  // adversarial: generator did not advertise golden at the blocker cam
  ['blocker-golden',`${BASE}/?view=mainstreet&still=1&time=golden&cam=-150,4,-34,140,180,-60`, 0],
  // adversarial: dusk at low elev — dark sprites vs sky, pools/halos in frame
  ['blocker-dusk',  `${BASE}/?view=mainstreet&still=1&time=dusk&cam=-150,4,-34,140,180,-60`, 0],
  // dusk mainstreet regression + perf
  ['dusk-main',     `${BASE}/?view=mainstreet&still=1&time=dusk`, 4],
  // kill paths
  ['aerial-noatmo', `${BASE}/?view=aerial&still=1&noatmo=1`, 0],
  ['aerial-nofog',  `${BASE}/?view=aerial&still=1&nofog=1`, 0],
  // adversarial second district at street level
  ['downtown-day',  `${BASE}/?view=downtown&still=1`, 0],
];

const browser = await chromium.launch({
  executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox',
    '--proxy-server=direct://', '--proxy-bypass-list=*', '--host-resolver-rules=MAP localhost 127.0.0.1'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const report = [];
for (const [name, url, fpsSecs] of VIEWS) {
  const errors = [], envFlaps = [];
  const onCon = m => { if (m.type() === 'error') {
    (m.text().includes('ERR_NETWORK_CHANGED') ? envFlaps : errors).push(m.text()); } };
  const onErr = e => errors.push('PAGEERROR: ' + e.message);
  page.on('console', onCon); page.on('pageerror', onErr);

  let ready = true;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  } catch { ready = false; }
  await page.waitForTimeout(1800);

  const probe = await page.evaluate(() => {
    const i = window.__renderer?.info;
    return {
      calls: i?.render.calls, tris: i?.render.triangles,
      fx: window.__fx || null,
      ao: window.__fx?.aoState ?? null,
      time: new URLSearchParams(location.search).get('time') || 'day',
    };
  }).catch(e => ({ evalErr: e.message }));

  let fps = null;
  if (fpsSecs > 0 && ready) {
    fps = await page.evaluate(async (secs) => {
      const ts = [];
      await new Promise(res => {
        let last = performance.now();
        const step = (t) => { ts.push(t - last); last = t; requestAnimationFrame(step); };
        requestAnimationFrame(step);
        setTimeout(res, secs * 1000);
      });
      ts.shift(); ts.sort((a, b) => a - b);
      const med = ts[Math.floor(ts.length / 2)];
      return { medianMs: +med.toFixed(1), fps: +(1000 / med).toFixed(1),
               p90ms: +ts[Math.floor(ts.length * .9)].toFixed(1), n: ts.length };
    }, fpsSecs).catch(() => null);
  }

  const shot = `${OUT}/eval-s02-r2-${name}.png`;
  await page.screenshot({ path: shot });
  report.push({ name, ready, calls: probe.calls, ao: probe.ao,
    atmo: probe.fx?.atmo ?? null, grade: probe.fx?.grade ?? null,
    appErrors: errors.length, envFlaps: envFlaps.length, errors: errors.slice(0, 6), fps });
  page.off('console', onCon); page.off('pageerror', onErr);
}

fs.writeFileSync(`${OUT}/.verify/eval-r2-report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
