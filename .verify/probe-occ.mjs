// probe-occ.mjs — like probe-hl.mjs but navigates with waitUntil:'commit'
// (module main.js blocks DOMContentLoaded until the scene build finishes) and
// survives the boot-watchdog reload storm (ERR_NETWORK_CHANGED flaps).
import { chromium } from 'playwright-core';
const [url, shot = 'shot.png', fpsSecs = '0'] = process.argv.slice(2);
const EXE = 'C:/Users/pmsma/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const browser = await chromium.launch({
  executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox',
    '--proxy-server=direct://', '--proxy-bypass-list=*', '--host-resolver-rules=MAP localhost 127.0.0.1'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
let stats = null;
const deadline = Date.now() + 240000;
while (Date.now() < deadline) {
  try {
    await page.waitForFunction('window.__ready === true', null, { timeout: 20000, polling: 300 });
    await page.waitForTimeout(1200);
    stats = await page.evaluate(async (secs) => {
      let fps = null;
      if (secs > 0) {
        const ts = [];
        await new Promise(res => {
          let last = performance.now();
          const step = t => { ts.push(t - last); last = t; requestAnimationFrame(step); };
          requestAnimationFrame(step);
          setTimeout(res, secs * 1000);
        });
        ts.shift(); ts.sort((a, b) => a - b);
        const med = ts[Math.floor(ts.length / 2)];
        fps = { medianMs: +med.toFixed(1), fps: +(1000 / med).toFixed(1), n: ts.length };
      }
      return { fps,
      calls: window.__renderer?.info?.render.calls,
      tris: window.__renderer?.info?.render.triangles,
      city: window.__city || null,
      atmo: window.__fx?.atmo ? {
        lampPools: window.__fx.atmo.lampPools, lampHalos: window.__fx.atmo.lampHalos,
        clouds: window.__fx.atmo.clouds } : null,
      ready: window.__ready === true,
      };
    }, +fpsSecs);
    break;
  } catch { /* context destroyed by watchdog reload — keep waiting */ }
}
if (!stats) {
  console.log(JSON.stringify({ ok: false, why: '__ready never latched', errors: errors.slice(0, 10), nErr: errors.length }));
  await page.screenshot({ path: shot }).catch(() => {});
  await browser.close();
  process.exit(2);
}
if (shot) await page.screenshot({ path: shot }).catch(() => {});
console.log(JSON.stringify({ ok: true, stats, errors: errors.slice(0, 10), nErr: errors.length }, null, 1));
await browser.close();
