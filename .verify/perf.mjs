// perf.mjs — measure __fx (fps/calls/tris) aerial vs inside interiors, and
// screenshot the archetypes that have no deep-link id (church = FILLER record).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXE = 'C:/devin/chrome/chrome-win64/chrome.exe';
const OUT = 'C:/Users/Administrator/repos/Digital-Town/.verify/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://127.0.0.1:8778/?view=aerial&still=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 420000 });
const fx = () => page.evaluate(() => ({
  fps: window.__fx.fps, calls: window.__renderer.info.render.calls,
  tris: window.__renderer.info.render.triangles, ao: window.__fx.ao,
}));
const report = {};

await page.waitForTimeout(8000);
report.aerial = await fx();

// church lives in FILLER (no id) — enter via the exposed record path
await page.evaluate(() => window.__interior.enter(
  { type: 'church', x: -730, z: -18, w: 24, d: 18, h: 9, name: 'Havenbrook Chapel', cost: 600000 }));
await page.waitForTimeout(3500);
report.chapel = await fx();
await page.screenshot({ path: `${OUT}/i4-chapel.png` });

for (const [name, id] of [['home', 'preservecommons'], ['hall', 'medhall'], ['store', 'market']]) {
  await page.evaluate(() => window.__interior.exit());
  await page.waitForTimeout(1500);
  const ok = await page.evaluate(i => { window.__enterInterior(i); return !!window.__interior.spec; }, id);
  await page.waitForTimeout(3000);
  report['in-' + name] = { ok, ...(await fx()) };
  await page.screenshot({ path: `${OUT}/i4-${name}.png` });
}

await page.evaluate(() => window.__interior.exit());
await page.waitForTimeout(6000);
report.aerialAfter = await fx();

console.log(JSON.stringify({ report, errors: errors.slice(0, 8) }, null, 1));
await browser.close();
