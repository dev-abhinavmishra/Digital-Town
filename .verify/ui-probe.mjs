// ui-probe.mjs — clicks through the presentation HUD and screenshots states.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:/devin/chrome/chrome-win64/chrome.exe';
const OUT = 'C:/Users/Administrator/repos/Digital-Town/.verify/shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://127.0.0.1:8778/?view=aerial&still=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 420000 });
await page.waitForTimeout(1500);

const st = {};
// 1. top row fits — all controls in a single line, no budget chip
st.topRow = await page.$eval('#uiTopRight', el => {
  const kids = [...el.querySelectorAll('.btn, #uiTier')];
  const tops = new Set(kids.map(k => Math.round(k.getBoundingClientRect().top)));
  return { singleRow: tops.size === 1, controls: kids.length,
           noBudget: !document.getElementById('uiBudget') };
});
await page.screenshot({ path: `${OUT}/ui-toprow.png` });
// 2. drawer + facility click → card + flight
await page.click('#uiBtnDir'); await page.waitForTimeout(400);
st.drawerOpen = await page.$eval('#uiDrawer', el => el.classList.contains('open'));
await page.click('#uiDrawer .fi[data-id="hospital"]');
await page.waitForTimeout(400);
st.cardShown = await page.$eval('#uiCard', el => el.classList.contains('show'));
await page.waitForTimeout(2400);
st.flew = await page.evaluate(() => window.__flyDone());
await page.screenshot({ path: `${OUT}/ui-card.png` });
// 3. tour start → caption + flight
await page.click('#uiBtnTour'); await page.waitForTimeout(500);
st.tourOn = await page.$eval('#uiTourBar', el => el.classList.contains('show'));
st.tourCaption = await page.$eval('#uiTourBar .cap b', el => el.textContent);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/ui-tour.png` });
// 4. next stop via button
await page.click('#uiTourNext'); await page.waitForTimeout(300);
st.tourStep2 = await page.$eval('#uiTourBar .cap b', el => el.textContent);
// 5. escape ends tour
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
st.tourEnded = !(await page.$eval('#uiTourBar', el => el.classList.contains('show')));
// 6. rubric overlay
await page.click('#uiBtnRubric'); await page.waitForTimeout(400);
st.rubricOpen = await page.$eval('#uiRubric', el => el.classList.contains('open'));
await page.screenshot({ path: `${OUT}/ui-rubric.png` });
await page.click('#uiRubricX');
st.rubricClosed = !(await page.$eval('#uiRubric', el => el.classList.contains('open')));
console.log(JSON.stringify({ st, errors: errors.slice(0, 8) }, null, 1));
await browser.close();
