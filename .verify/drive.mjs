// drive.mjs — stdin-driven Playwright REPL for Havenbrook verification.
// One headed Chrome window, viewport 1280x720. Console 'error' + pageerror are
// collected into a per-load buffer printed by `errors` (cleared on `goto`/`cls`).
// Commands (one per line):
//   goto <url>            navigate, wait __ready<=420s, +2.5s settle; prints READY <bool> <sec>s
//   eval <js>             evaluate expression in page; prints JSON result
//   shot <name>           screenshot -> .verify/shots2/<name>.png
//   click <sel>           page.click
//   key <key>             keyboard.press (e.g. Escape)
//   wait <ms>             sleep
//   probe                 __ready + renderer.info.render.{calls,triangles} + __fx.fps + cam pos
//   errors                print collected console errors / pageerrors
//   cls                   clear error buffer
//   fly <px,py,pz,tx,ty,tz,dur>  __flyTo + wait __flyDone
//   setcam <px,py,pz,tx,ty,tz>   __setCam + 500ms settle
// Each completed command prints:  DONE <original line>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import readline from 'node:readline';

const EXE = 'C:/devin/chrome/chrome-win64/chrome.exe';
const OUT = 'C:/Users/Administrator/repos/Digital-Town/.verify/shots2';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE, headless: false,
  args: ['--window-size=1400,880', '--use-angle=default', '--disable-gpu-sandbox',
         '--window-position=40,20'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let errors = [];
page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.log('CONSOLE_ERR:', m.text()); } });
page.on('pageerror', e => { errors.push('PAGEERROR: ' + e.message); console.log('PAGEERROR:', e.message); });
console.log('BROWSER_UP');

const rl = readline.createInterface({ input: process.stdin });
const q = [];
let busy = false;
rl.on('line', l => { q.push(l); pump(); });
async function pump() {
  if (busy) return;
  const line = q.shift();
  if (line === undefined) return;
  busy = true;
  try { await run(line); } catch (e) { console.log('FAIL', line, '::', e.message.split('\n')[0]); }
  console.log('DONE', line);
  busy = false;
  setImmediate(pump);
}
async function run(line) {
  const sp = line.indexOf(' ');
  const cmd = sp < 0 ? line : line.slice(0, sp);
  const arg = sp < 0 ? '' : line.slice(sp + 1);
  if (cmd === 'goto') {
    errors = [];
    const t0 = Date.now();
    await page.goto(arg, { waitUntil: 'domcontentloaded', timeout: 90000 });
    let ready = false;
    try { await page.waitForFunction('window.__ready === true', null, { timeout: 420000 }); ready = true; }
    catch { ready = await page.evaluate('window.__ready === true').catch(() => false); }
    await page.waitForTimeout(2500);
    console.log('READY', ready, Math.round((Date.now() - t0) / 1000) + 's', 'errors=' + errors.length);
  } else if (cmd === 'eval') {
    console.log('EVAL', JSON.stringify(await page.evaluate(arg)));
  } else if (cmd === 'shot') {
    await page.screenshot({ path: `${OUT}/${arg}.png` });
    console.log('SHOT', arg);
  } else if (cmd === 'click') {
    await page.click(arg, { timeout: 15000 });
    console.log('CLICKED', arg);
  } else if (cmd === 'key') {
    await page.keyboard.press(arg);
    console.log('KEY', arg);
  } else if (cmd === 'wait') {
    await page.waitForTimeout(+arg);
  } else if (cmd === 'probe') {
    console.log('PROBE', JSON.stringify(await page.evaluate(() => ({
      ready: window.__ready === true,
      calls: window.__renderer?.info?.render?.calls,
      tris: window.__renderer?.info?.render?.triangles,
      fps: window.__fx?.fps,
      cam: window.__cam ? [window.__cam.position.x, window.__cam.position.y, window.__cam.position.z].map(v => +v.toFixed(1)) : null,
      url: location.href,
    }))));
  } else if (cmd === 'errors') {
    console.log('ERRORS', JSON.stringify(errors));
  } else if (cmd === 'cls') {
    errors = [];
  } else if (cmd === 'fly') {
    const a = arg.split(',').map(Number);
    await page.evaluate(v => window.__flyTo(...v), a);
    await page.waitForFunction('window.__flyDone() === true', null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(300);
    console.log('FLEW', JSON.stringify(await page.evaluate(() => [window.__cam.position.x, window.__cam.position.y, window.__cam.position.z].map(v => +v.toFixed(1)))));
  } else if (cmd === 'setcam') {
    const a = arg.split(',').map(Number);
    await page.evaluate(v => window.__setCam(...v), a);
    await page.waitForTimeout(600);
    console.log('CAMSET');
  }
}
