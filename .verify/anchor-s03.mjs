// anchor-s03.mjs — sprint-03 start anchor, resilient edition.
// Writes each completed base to anchor-s03-results.json immediately;
// relaunches the browser if the window gets closed; skips bases already done.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXE = 'C:/Users/pmsma/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:8783';
const RES = 'C:/Users/pmsma/Downloads/HST Digital Town Project/.verify/anchor-s03-results.json';
const BASES = [
  ['aerial',          '?view=aerial&noao=1&still=1'],
  ['aerial-full',     '?view=aerial&still=1'],
  ['mainstreet',      '?view=mainstreet&noao=1&still=1'],
  ['mainstreet-full', '?view=mainstreet&still=1'],
];

let results = {};
try { results = JSON.parse(fs.readFileSync(RES, 'utf8')); } catch { }
const save = () => fs.writeFileSync(RES, JSON.stringify(results, null, 1));

let browser = null, page = null;
async function launch() {
  if (browser) try { await browser.close(); } catch { }
  browser = await chromium.launch({
    executablePath: EXE, headless: false,
    args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox',
      '--proxy-server=direct://', '--proxy-bypass-list=*', '--host-resolver-rules=MAP localhost 127.0.0.1'],
  });
  browser.on('disconnected', () => { browser = null; page = null; });
  page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
}

async function measure(name, qs) {
  for (let round = 0; round < 6; round++) {
    try {
      if (!page) await launch();
      await page.goto(`${BASE}/${qs}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction('window.__ready === true', null, { timeout: 200000 });
      if (!(await page.evaluate(() => window.__ready === true))) continue;
      await page.waitForTimeout(4000);
      const calls = await page.evaluate(() => window.__renderer?.info?.render?.calls ?? null);
      const fps = await page.evaluate(async () => {
        const ts = [];
        await new Promise(res => {
          let last = performance.now();
          const step = (t) => { ts.push(t - last); last = t; requestAnimationFrame(step); };
          requestAnimationFrame(step); setTimeout(res, 4000);
        });
        ts.shift(); ts.sort((a, b) => a - b);
        const med = ts[Math.floor(ts.length / 2)];
        return { medianMs: +med.toFixed(1), fps: +(1000 / med).toFixed(1), n: ts.length };
      });
      return { name, basis: qs, ready: true, round: round + 1, calls, fps };
    } catch (e) {
      console.log(`[${name}] round ${round + 1} failed: ${e.message.split('\n')[0]}`);
      if (!browser) continue;              // relaunch next round
      try { await page.evaluate(() => 1); } catch { page = null; }
    }
  }
  return { name, basis: qs, ready: false };
}

for (const [name, qs] of BASES) {
  if (results[name]?.ready) { console.log(`[${name}] cached — skipping`); continue; }
  console.log(`[${name}] measuring ${qs}`);
  results[name] = await measure(name, qs);
  save();
  console.log(`[${name}] done:`, JSON.stringify(results[name]));
}
console.log('ALL DONE\n' + JSON.stringify(results, null, 1));
if (browser) await browser.close();
process.exit(0);
