// presentflow.mjs — PRESENT mode E2E over CDP :29229 (PR: deck.js on wrapup-cleanup-deck)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const OUT = new URL('./shots-linux/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const R = { steps: [] };
const ok = (n, p, d) => { R.steps.push({ name: n, pass: p, detail: d }); console.log((p ? 'PASS' : 'FAIL'), n, '—', d); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.connectOverCDP('http://127.0.0.1:29229');
try {
  const page = browser.contexts()[0].pages().find(p => p.url().includes('127.0.0.1:8778/index'));
  if (!page) throw new Error('no 8778 index page');
  page.setDefaultTimeout(20000);
  const shot = async n => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 120000 }); console.log('SHOT', n); };
  const ev = (js, a) => page.evaluate(js, a);
  const clickEl = async sel => {
    const r = await ev(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
    if (!r) return false; await page.mouse.click(r.x, r.y); return true;
  };
  const cnt = () => ev(`document.querySelector('#uiDeck .cnt').textContent`);

  /* ---- probes + precondition ---- */
  const p0 = await ev(`({
    deck: typeof window.__deck, n: window.__deck && window.__deck.n,
    btn: !!document.querySelector('#uiBtnDeck'),
    btnTxt: document.querySelector('#uiBtnDeck')?.textContent?.trim(),
    on: window.__deck && window.__deck.on,
    chromeVis: getComputedStyle(document.querySelector('#hudUI')).display !== 'none',
    deckHidden: getComputedStyle(document.querySelector('#uiDeck')).display === 'none' })`);
  ok('P0 probes/precondition', p0.deck === 'object' && p0.n === 9 && p0.btn && p0.btnTxt.includes('PRESENT') && p0.on === false && p0.chromeVis && p0.deckHidden, JSON.stringify(p0));

  /* ---- start a TOUR, then PRESENT must end it ---- */
  await clickEl('#uiBtnTour'); await sleep(700);
  const tOn = await ev(`document.querySelector('#uiTourBar').classList.contains('show')`);
  await clickEl('#uiBtnDeck'); await sleep(1300);
  const s1 = await ev(`({
    deckOn: document.querySelector('#uiDeck').classList.contains('on'),
    dOn: window.__deck.on, i: window.__deck.i,
    tourOff: !document.querySelector('#uiTourBar').classList.contains('show') && !document.querySelector('#uiBtnTour').classList.contains('on'),
    hudHidden: document.getElementById('hudUI').style.display === 'none',
    hintHidden: document.getElementById('hint').style.display === 'none',
    labelsHidden: document.getElementById('labels').style.display === 'none',
    barH: getComputedStyle(document.querySelector('#uiDeck .bar.t')).height,
    cnt: document.querySelector('#uiDeck .cnt').textContent,
    capIn: document.querySelector('#uiDeck .cap').classList.contains('in'),
    h1: document.querySelector('#uiDeck .cap h1')?.textContent,
    btnOn: document.querySelector('#uiBtnDeck').classList.contains('on') })`);
  ok('P1 tour->present', tOn === true, 'tour was running: ' + tOn);
  ok('P2 deck start', s1.deckOn && s1.dOn && s1.i === 0 && s1.tourOff && s1.hudHidden && s1.hintHidden && s1.labelsHidden && s1.barH === '56px' && s1.cnt === '01/09' && s1.capIn && s1.h1 === 'HAVENBROOK' && s1.btnOn, JSON.stringify(s1));
  await shot('present-cover');

  /* ---- keyboard + edge navigation ---- */
  await page.keyboard.press('ArrowRight'); await sleep(900);
  const s2 = await ev(`({c: document.querySelector('#uiDeck .cnt').textContent, i: window.__deck.i,
    stats: document.querySelectorAll('#uiDeck .stats .st').length, h1: document.querySelector('#uiDeck .cap h1')?.textContent})`);
  ok('P3 ArrowRight->slide2 stats', s2.c === '02/09' && s2.i === 1 && s2.stats === 3, JSON.stringify(s2));
  await shot('present-stats');
  const vw = await ev(`innerWidth`), vh = await ev(`innerHeight`);
  await page.mouse.click(vw * 0.95, vh * 0.5); await sleep(900);
  const c3 = await cnt();
  await page.mouse.click(vw * 0.05, vh * 0.5); await sleep(900);
  const c2 = await cnt();
  ok('P4 edge nav', c3 === '03/09' && c2 === '02/09', `right->${c3} left->${c2}`);
  for (let k = 0; k < 5; k++) { await page.keyboard.press('ArrowRight'); await sleep(800); }
  const s7 = await ev(`({c: document.querySelector('#uiDeck .cnt').textContent, i: window.__deck.i,
    bud: !!document.querySelector('#uiDeck .bud'), h1: document.querySelector('#uiDeck .cap h1')?.textContent,
    rows: document.querySelector('#uiDeck .bud .rows')?.textContent })`);
  ok('P5 ledger slide', s7.c === '08/09' && s7.i === 7 && s7.bud && s7.h1.includes('$9.95M') && s7.h1.includes('$10.00M') && s7.rows.includes('Headroom') && s7.rows.includes('Healthcare'), JSON.stringify(s7));
  await shot('present-ledger');
  await page.keyboard.press('ArrowRight'); await sleep(900);
  const s8 = await ev(`({c: document.querySelector('#uiDeck .cnt').textContent, i: window.__deck.i, h1: document.querySelector('#uiDeck .cap h1')?.textContent})`);
  ok('P6 close slide', s8.c === '09/09' && s8.i === 8 && s8.h1.includes('Over-delivered'), JSON.stringify(s8));
  await shot('present-close');
  /* past last -> exit + chrome restored + camera home */
  await page.keyboard.press('ArrowRight'); await sleep(800);
  const ex = await ev(`({on: window.__deck.on, deckOn: document.querySelector('#uiDeck').classList.contains('on'),
    hudBack: getComputedStyle(document.querySelector('#hudUI')).display !== 'none' && document.getElementById('hudUI').style.display !== 'none',
    hintBack: document.getElementById('hint').style.display !== 'none',
    labelsBack: document.getElementById('labels').style.display !== 'none',
    btnOff: !document.querySelector('#uiBtnDeck').classList.contains('on') })`);
  ok('P7 past-last exits', !ex.on && !ex.deckOn && ex.hudBack && ex.hintBack && ex.labelsBack && ex.btnOff, JSON.stringify(ex));
  await sleep(3200);
  const cam = await ev(`[__cam.position.x, __cam.position.y, __cam.position.z].map(v=>+v.toFixed(0))`);
  ok('P8 camera home', Math.abs(cam[0] - 540) < 40 && Math.abs(cam[1] - 620) < 40 && Math.abs(cam[2] - 660) < 40, 'cam=' + JSON.stringify(cam));
  await shot('present-exit-restored');

  /* ---- space pause ---- */
  await clickEl('#uiBtnDeck'); await sleep(1200);
  await page.keyboard.press(' ');  // pause at slide 1
  const iAt = await ev(`window.__deck.i`);
  await sleep(10500);
  const iAfter = await ev(`window.__deck.i`);
  ok('P9 space pauses', iAfter === iAt, `i=${iAt}->${iAfter} over 10.5s (hold=9.5s)`);
  await shot('present-paused');
  /* Esc exits */
  await page.keyboard.press('Escape'); await sleep(700);
  const esc = await ev(`({on: window.__deck.on, hudBack: document.getElementById('hudUI').style.display !== 'none'})`);
  ok('P10 Esc exits', !esc.on && esc.hudBack, JSON.stringify(esc));

  /* ---- interior preemption ---- */
  await ev(`window.__uiShowCard('hospital')`); await sleep(300);
  const inRect = await ev(`(()=>{const e=document.querySelector('#uiCard [data-act="in"]');if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
  if (inRect) {
    await page.mouse.click(inRect.x, inRect.y); await sleep(2600);
    const wasIn = await ev(`window.__interior && window.__interior.on`);
    await ev(`window.__deck.start()`); await sleep(1200);
    const st = await ev(`({dOn: window.__deck.on, inOff: !(window.__interior && window.__interior.on)})`);
    ok('P11 interior->present', wasIn === true && st.dOn && st.inOff, JSON.stringify({ wasIn, ...st }));
    await ev(`window.__deck.exit()`); await sleep(800);
  } else ok('P11 interior->present', false, 'no step-inside link found');

  console.log('RESULT ' + JSON.stringify(R.steps.map(s => [s.name, s.pass])));
} finally { await browser.close(); }
