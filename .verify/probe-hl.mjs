// probe.mjs — headful verification of Havenbrook: __ready, console errors,
// renderer stats, __city stats, FPS sample, screenshot.
// Usage: node probe.mjs <url> <outShot.png> [fpsSeconds]
import { chromium } from 'playwright-core';

const [url, shot = 'shot.png', fpsSecs = '0'] = process.argv.slice(2);
const EXE = 'C:/Users/pmsma/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';

const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox',
    '--proxy-server=direct://', '--proxy-bypass-list=*', '--host-resolver-rules=MAP localhost 127.0.0.1'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
try {
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
} catch {
  console.log(JSON.stringify({ ok: false, why: '__ready timeout', errors }));
  await page.screenshot({ path: shot });
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(1800);   // settle: textures/env load

const stats = await page.evaluate(() => {
  const i = window.__renderer?.info;
  return {
    calls: i?.render.calls, tris: i?.render.triangles,
    geoms: i?.memory.geometries, texs: i?.memory.textures,
    kids: window.__scene?.children?.length,
    city: window.__city || null,
    fx: window.__fx ? { envType: window.__fx.envType, envSrc: window.__fx.envSrc } : null,
    cam: !!window.__setCam,
  };
});

let fps = null;
if (+fpsSecs > 0) {
  fps = await page.evaluate(async (secs) => {
    const ts = [];
    await new Promise(res => {
      let last = performance.now();
      const step = (t) => { ts.push(t - last); last = t; requestAnimationFrame(step); };
      requestAnimationFrame(step);
      setTimeout(res, secs * 1000);
    });
    ts.shift();
    ts.sort((a, b) => a - b);
    const med = ts[Math.floor(ts.length / 2)];
    return { medianMs: +med.toFixed(1), fps: +(1000 / med).toFixed(1),
             p90ms: +ts[Math.floor(ts.length * .9)].toFixed(1), n: ts.length,
             pixelRatio: window.__renderer?.getPixelRatio?.() };
  }, +fpsSecs);
}
await page.screenshot({ path: shot });
console.log(JSON.stringify({ ok: true, stats, fps, errors }, null, 1));
await browser.close();
