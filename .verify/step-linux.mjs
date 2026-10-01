// step-linux.mjs — one-shot CDP command against devin-remote Chrome on :29229.
//   goto <url>            navigate, wait __ready<=420s, +2.5s settle
//   eval <js>             evaluate expression; prints JSON
//   shot <name>           screenshot -> .verify/shots-linux/<name>.png
//   clickxy x,y           page.mouse.click
//   probe                 __ready/calls/tris/fps/cam
//   setcam <px,py,pz,tx,ty,tz>
//   fly <px,py,pz,tx,ty,tz,dur>
//   wait <ms>
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const OUT = new URL('./shots-linux/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const [cmd, ...rest] = process.argv.slice(2);
const arg = rest.join(' ');

const browser = await chromium.connectOverCDP('http://127.0.0.1:29229');
try {
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes('127.0.0.1:8778'));
  if (!page) page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  if (cmd === 'goto') {
    const t0 = Date.now();
    await page.goto(arg, { waitUntil: 'commit', timeout: 60000 }).catch(e => console.log('GOTOERR', e.message));
    let ready = false;
    try { await page.waitForFunction('window.__ready === true', null, { timeout: 420000, polling: 2000 }); ready = true; }
    catch { ready = await page.evaluate('window.__ready === true').catch(() => false); }
    await page.waitForTimeout(2500);
    console.log('READY', ready, Math.round((Date.now() - t0) / 1000) + 's', 'loadErrors=' + errors.length, JSON.stringify(errors.slice(0, 8)));
  } else if (cmd === 'eval') {
    console.log('EVAL', JSON.stringify(await page.evaluate(arg)));
  } else if (cmd === 'shot') {
    await page.screenshot({ path: `${OUT}/${arg}.png`, timeout: 120000 });
    console.log('SHOT', arg);
  } else if (cmd === 'clickxy') {
    const [x, y] = arg.split(',').map(Number);
    await page.mouse.click(x, y);
    console.log('CLICKXY', x, y);
  } else if (cmd === 'probe') {
    console.log('PROBE', JSON.stringify(await page.evaluate(() => ({
      ready: window.__ready === true,
      calls: window.__renderer?.info?.render?.calls,
      tris: window.__renderer?.info?.render?.triangles,
      fps: window.__fx?.fps,
      cam: window.__cam ? [window.__cam.position.x, window.__cam.position.y, window.__cam.position.z].map(v => +v.toFixed(1)) : null,
      inner: [innerWidth, innerHeight],
    }))));
  } else if (cmd === 'setcam') {
    const a = arg.split(',').map(Number);
    await page.evaluate(v => window.__setCam(...v), a);
    await page.waitForTimeout(800);
    console.log('SETCAM', arg);
  } else if (cmd === 'fly') {
    const a = arg.split(',').map(Number);
    await page.evaluate(v => window.__flyTo(...v), a);
    await page.waitForFunction('window.__flyDone && window.__flyDone()', null, { timeout: 120000, polling: 800 }).catch(()=>{});
    console.log('FLEW', arg);
  } else if (cmd === 'wait') {
    await page.waitForTimeout(+arg);
    console.log('WAITED', arg);
  } else {
    console.log('unknown cmd', cmd);
  }
} finally {
  await browser.close();
}
