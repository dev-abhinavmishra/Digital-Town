// shots-linux.mjs — Linux variant of shots.mjs for Havenbrook.
// Usage: node shots-linux.mjs [name=url ...]   (defaults to a standard view set)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';

const EXE = process.env.CHROME_EXE || `${os.homedir()}/.local/bin/google-chrome`;
const OUT = process.env.SHOTS_OUT || `${os.homedir()}/repos/Digital-Town/.verify/shots`;
const BASE = 'http://127.0.0.1:8778';
fs.mkdirSync(OUT, { recursive: true });

const DEFAULT = [
  ['aerial', `${BASE}/?view=aerial&still=1`],
  ['mainstreet', `${BASE}/?view=mainstreet&still=1`],
  ['medical', `${BASE}/?view=medical&still=1`],
  ['campus', `${BASE}/?view=campus&still=1`],
  ['park', `${BASE}/?view=park&still=1`],
  ['downtown', `${BASE}/?view=downtown&still=1`],
  ['dusk-main', `${BASE}/?view=mainstreet&time=dusk&still=1`],
];

const specs = process.argv.slice(2).length
  ? process.argv.slice(2).map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; })
  : DEFAULT;

const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const [name, url] of specs) {
  const errors = [];
  const onCon = m => { if (m.type() === 'error') errors.push(m.text()); };
  const onErr = e => errors.push('PAGEERROR: ' + e.message);
  page.on('console', onCon); page.on('pageerror', onErr);
  const t0 = Date.now();
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: 120000 });
    await page.waitForFunction('window.__ready === true', null, { timeout: 900000 });
    await page.waitForTimeout(3000);
  } catch (e) { errors.push('BOOT: ' + e.message); }
  const probe = await page.evaluate(() => ({
    calls: window.__renderer?.info?.render?.calls,
    tris: window.__renderer?.info?.render?.triangles,
    ready: window.__ready === true,
    fps: window.__fx?.fps,
  })).catch(() => null);
  try {
    await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 });
  } catch (e) { errors.push('SHOT: ' + e.message); }
  console.log(JSON.stringify({ name, secs: ((Date.now() - t0) / 1000) | 0, probe, errors: errors.slice(0, 6) }));
  page.off('console', onCon); page.off('pageerror', onErr);
}
await browser.close();
