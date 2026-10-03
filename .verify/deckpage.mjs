// deckpage.mjs — static deck (/deck/index.html) E2E: slides, nav, imagery.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const OUT = new URL('./shots-linux/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const R = { steps: [] };
const ok = (n, p, d) => { R.steps.push({ name: n, pass: p, detail: d }); console.log((p ? 'PASS' : 'FAIL'), n, '—', d); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.connectOverCDP('http://127.0.0.1:29229');
try {
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1600, height: 900 });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const resp = [];
  page.on('response', r => { if (r.status() >= 400) resp.push(r.status() + ' ' + r.url()); });
  await page.goto('http://127.0.0.1:8778/deck/index.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1600);
  const shot = async n => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 30000 }); console.log('SHOT', n); };

  const s0 = await page.evaluate(() => ({
    slides: document.querySelectorAll('.slide').length,
    bgs: document.querySelectorAll('.bg').length,
    cnt: document.querySelector('#cnt').textContent,
    cur: [...document.querySelectorAll('.slide')].findIndex(s => s.classList.contains('cur')),
    h1: document.querySelector('.slide.cur h1')?.textContent,
    tf: document.getElementById('track').style.transform }));
  ok('D0 initial', s0.slides === 9 && s0.bgs === 8 && s0.cnt === '01/09' && s0.cur === 0 && s0.h1 === 'HAVENBROOK' && s0.tf === 'translateX(0%)', JSON.stringify(s0));

  /* all bg images fetch 200 + decode (naturalWidth) */
  const imgs = await page.evaluate(async () => {
    const urls = [...document.querySelectorAll('.bg')].map(e => getComputedStyle(e).backgroundImage.replace(/url\("?|"\)/g, ''));
    return Promise.all(urls.map(u => new Promise(res => { const im = new Image(); im.onload = () => res([u.split('/').pop(), im.naturalWidth]); im.onerror = () => res([u.split('/').pop(), 0]); im.src = u; })));
  });
  ok('D1 all 8 shot images decode', imgs.every(([, w]) => w > 0), JSON.stringify(imgs));
  ok('D1b no 4xx/5xx + no errors', resp.length === 0 && errors.length === 0, JSON.stringify({ resp, errors: errors.slice(0, 4) }));
  await shot('deck-cover');

  /* arrow nav to stats slide */
  await page.keyboard.press('ArrowRight'); await sleep(1300);
  const s1 = await page.evaluate(() => ({ cnt: document.querySelector('#cnt').textContent,
    cur: [...document.querySelectorAll('.slide')].findIndex(s => s.classList.contains('cur')),
    stats: document.querySelectorAll('.slide.cur .st').length }));
  ok('D2 stats slide', s1.cnt === '02/09' && s1.cur === 1 && s1.stats === 4, JSON.stringify(s1));
  await shot('deck-stats');

  /* edge click + space */
  await page.evaluate(() => document.getElementById('er').click()); await sleep(1200);
  const c3 = await page.evaluate(() => document.querySelector('#cnt').textContent);
  await page.keyboard.press(' '); await sleep(1200);
  const c4 = await page.evaluate(() => document.querySelector('#cnt').textContent);
  ok('D3 edge+space nav', c3 === '03/09' && c4 === '04/09', `edge->${c3} space->${c4}`);

  /* End key -> close slide, then Left -> ledger (paper) */
  await page.keyboard.press('End'); await sleep(1300);
  const s8 = await page.evaluate(() => ({ cnt: document.querySelector('#cnt').textContent,
    cur: [...document.querySelectorAll('.slide')].findIndex(s => s.classList.contains('cur')),
    h1: document.querySelector('.slide.cur h1')?.textContent }));
  ok('D4 End->close', s8.cnt === '09/09' && s8.cur === 8 && s8.h1.includes('Over-delivered'), JSON.stringify(s8));
  await shot('deck-close');
  /* ArrowRight at end must clamp */
  await page.keyboard.press('ArrowRight'); await sleep(900);
  const c9 = await page.evaluate(() => document.querySelector('#cnt').textContent);
  ok('D5 end clamps', c9 === '09/09', 'cnt=' + c9);
  await page.keyboard.press('ArrowLeft'); await sleep(1300);
  const s7 = await page.evaluate(() => ({ cnt: document.querySelector('#cnt').textContent,
    cur: [...document.querySelectorAll('.slide')].findIndex(s => s.classList.contains('cur')),
    paper: document.querySelector('.slide.cur').classList.contains('paper'),
    darkchrome: document.body.classList.contains('darkchrome'),
    h1: document.querySelector('.slide.cur h1')?.textContent,
    bud: !!document.querySelector('.slide.cur .bud'),
    rows: document.querySelector('.slide.cur .bud .rows')?.textContent.replace(/\s+/g, ' '),
    side: document.querySelector('.slide.cur .side')?.textContent.replace(/\s+/g, ' ') }));
  ok('D6 ledger paper slide', s7.cnt === '08/09' && s7.cur === 7 && s7.paper && s7.darkchrome && s7.h1 === '$9.95M of $10.00M' && s7.bud && s7.rows.includes('Healthcare') && s7.rows.includes('$0.05M') && s7.side.includes('26'), JSON.stringify(s7));
  await shot('deck-ledger');
  /* wheel nav */
  await page.mouse.wheel(0, 120); await sleep(1200);
  const cw = await page.evaluate(() => document.querySelector('#cnt').textContent);
  ok('D7 wheel advances', cw === '09/09', 'cnt=' + cw);
  /* Home */
  await page.keyboard.press('Home'); await sleep(1200);
  const ch = await page.evaluate(() => document.querySelector('#cnt').textContent);
  ok('D8 Home', ch === '01/09', 'cnt=' + ch);

  console.log('RESULT ' + JSON.stringify(R.steps.map(s => [s.name, s.pass])));
  await page.close();
} finally { await browser.close(); }
