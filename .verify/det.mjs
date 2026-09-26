// det.mjs — determinism probe: screenshot at the FIRST ready frame, twice.
import { chromium } from 'playwright-core';
const url = process.argv[2];
const EXE = 'C:/Users/pmsma/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox'] });
for (const tag of ['c', 'd']) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // latch the first ready frame, then freeze movement by halting rAF
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000, polling: 4 });
  await page.evaluate(() => { window.__pause = true; });
  await page.screenshot({ path: `shots/det-${tag}.png` });
  await page.close();
}
await browser.close();
console.log('done');
