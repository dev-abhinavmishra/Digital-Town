// eval-r2b.mjs — reshoot pass: views that caught the splash under network flaps,
// plus settled perf reads. Retries each view until __ready, generous window.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXE = 'C:/Users/pmsma/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const OUT = 'C:/Users/pmsma/Downloads/HST Digital Town Project';
const BASE = 'http://localhost:8778';

const VIEWS = [
  ['blocker-golden', `${BASE}/?view=mainstreet&still=1&time=golden&cam=-150,4,-34,140,180,-60`, 0],
  ['blocker-dusk',   `${BASE}/?view=mainstreet&still=1&time=dusk&cam=-150,4,-34,140,180,-60`, 0],
  ['dusk-main',      `${BASE}/?view=mainstreet&still=1&time=dusk`, 4],
  ['aerial-day-perf',`${BASE}/?view=aerial&still=1`, 4],
];

const browser = await chromium.launch({
  executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox',
    '--proxy-server=direct://', '--proxy-bypass-list=*', '--host-resolver-rules=MAP localhost 127.0.0.1'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const report = [];
for (const [name, url, fpsSecs] of VIEWS) {
  let ready = false, errors = [], envFlaps = 0, attempts = 0;
  const onCon = m => { if (m.type() === 'error') {
    if (m.text().includes('ERR_NETWORK_CHANGED')) envFlaps++; else errors.push(m.text()); } };
  const onErr = e => errors.push('PAGEERROR: ' + e.message);
  page.on('console', onCon); page.on('pageerror', onErr);

  for (let a = 0; a < 3 && !ready; a++) {
    attempts++;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction('window.__ready === true', null, { timeout: 200000 });
      ready = true;
    } catch { /* retry */ }
  }
  await page.waitForTimeout(2500);   // post-ready settle: AO cache, textures

  const probe = await page.evaluate(() => {
    const i = window.__renderer?.info;
    return { calls: i?.render.calls, fx: window.__fx || null,
             ao: window.__fx?.aoState ?? null, ready: window.__ready === true };
  }).catch(e => ({ evalErr: e.message }));
  ready = probe.ready === true;

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
  report.push({ name, ready, attempts, calls: probe.calls, ao: probe.ao,
    atmo: probe.fx?.atmo ?? null, appErrors: errors.length, envFlaps,
    errors: errors.slice(0, 6), fps });
  page.off('console', onCon); page.off('pageerror', onErr);
}

fs.writeFileSync(`${OUT}/.verify/eval-r2b-report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
