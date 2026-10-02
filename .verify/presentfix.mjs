// presentfix.mjs — deterministic retest of the racy PRESENT checks.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const OUT = new URL('./shots-linux/', import.meta.url).pathname;
const R = { steps: [] };
const ok = (n, p, d) => { R.steps.push({ name: n, pass: p, detail: d }); console.log((p ? 'PASS' : 'FAIL'), n, '—', d); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.connectOverCDP('http://127.0.0.1:29229');
try {
  const page = browser.contexts()[0].pages().find(p => p.url().includes('127.0.0.1:8778/index'));
  page.setDefaultTimeout(20000);
  const shot = async n => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 120000 }); console.log('SHOT', n); };
  const ev = js => page.evaluate(js);

  /* F1: start + caption renders (generous wait for SwiftShader-blocked timers) */
  await ev(`document.querySelector('#uiBtnDeck').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  await sleep(4200);
  const f1 = await ev(`({on: window.__deck.on, i: window.__deck.i, capIn: document.querySelector('#uiDeck .cap').classList.contains('in'),
    h1: document.querySelector('#uiDeck .cap h1')?.textContent, cnt: document.querySelector('#uiDeck .cnt').textContent})`);
  ok('F1 cover caption lands', f1.on && f1.i === 0 && f1.capIn && f1.h1 === 'HAVENBROOK' && f1.cnt === '01/09', JSON.stringify(f1));

  /* F2: auto-advance works (no input -> i increments within ~12s) */
  const ok2 = await page.waitForFunction('window.__deck.i >= 1', null, { timeout: 16000, polling: 500 }).then(() => true).catch(() => false);
  const iA = await ev(`window.__deck.i`);
  ok('F2 auto-advance', ok2 && iA >= 1, `i=${iA} after wait`);

  /* F3: pause then deterministic edge/arrow nav */
  await page.keyboard.press(' '); await sleep(300);           // pause
  const vw = await ev(`innerWidth`), vh = await ev(`innerHeight`);
  const iB = await ev(`window.__deck.i`);
  await page.mouse.click(vw * 0.95, vh * 0.5); await sleep(700);
  const iR = await ev(`window.__deck.i`);
  await page.mouse.click(vw * 0.05, vh * 0.5); await sleep(700);
  const iL = await ev(`window.__deck.i`);
  ok('F3 edge nav exact', iR === iB + 1 && iL === iB, `start=${iB} right=${iR} left=${iL}`);

  /* F4: real close-slide shot + ArrowRight-at-end exits */
  while ((await ev(`window.__deck.i`)) < 8) { await page.keyboard.press('ArrowRight'); await sleep(700); }
  const s8 = await ev(`({i: window.__deck.i, cnt: document.querySelector('#uiDeck .cnt').textContent,
    h1: document.querySelector('#uiDeck .cap h1')?.textContent, deckOn: window.__deck.on})`);
  ok('F4a on close slide', s8.i === 8 && s8.cnt === '09/09' && s8.deckOn, JSON.stringify(s8));
  await sleep(1500);  // let caption fade in
  await shot('present-close2');
  await page.keyboard.press('ArrowRight'); await sleep(900);
  const f4 = await ev(`({on: window.__deck.on, hud: document.getElementById('hudUI').style.display !== 'none'})`);
  ok('F4b ArrowRight at end exits', !f4.on && f4.hud, JSON.stringify(f4));

  /* F5: interior preemption — enter via probe, then deck.start must exit it */
  await ev(`window.__enterInterior('hospital')`);
  const entered = await page.waitForFunction('window.__interior && window.__interior.on === true', null, { timeout: 12000, polling: 500 }).then(() => true).catch(() => false);
  await ev(`window.__deck.start()`); await sleep(1400);
  const f5 = await ev(`({dOn: window.__deck.on, inOff: !(window.__interior && window.__interior.on)})`);
  ok('F5 interior->present', entered && f5.dOn && f5.inOff, JSON.stringify({ entered, ...f5 }));
  await shot('present-over-interior');
  await ev(`window.__deck.exit()`); await sleep(600);
  const f6 = await ev(`({on: window.__deck.on, hud: document.getElementById('hudUI').style.display !== 'none', inOff: !(window.__interior && window.__interior.on)})`);
  ok('F6 exit after interior', !f6.on && f6.hud && f6.inOff, JSON.stringify(f6));

  console.log('RESULT ' + JSON.stringify(R.steps.map(s => [s.name, s.pass])));
} finally { await browser.close(); }
