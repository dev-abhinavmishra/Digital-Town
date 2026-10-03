import { chromium } from 'playwright-core';
import fs from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.connectOverCDP('http://localhost:9223');
const pg = await b.contexts()[0].newPage();
await pg.setViewportSize({ width: 1600, height: 900 });
await pg.goto('http://127.0.0.1:8778/?view=aerial&time=golden&q=med&still=1', { waitUntil: 'commit', timeout: 30000 });
for (let i = 0; i < 600; i++) { if (await pg.evaluate('window.__ready === true').catch(() => false)) break; await sleep(1000); }
console.log('ready');
await pg.evaluate('window.__setPaused(true); window.__lockShadow = true;');
const cdp = await pg.context().newCDPSession(pg);
let latest = null, sc = 0;
cdp.on('Page.screencastFrame', ev => { latest = Buffer.from(ev.data, 'base64'); sc++; cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {}); });
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92 });
for (const [name, cam] of [
  ['g1-houses', [-300, 120, 300, -430, 0, 120]],
  ['g2-campus', [230, 110, -40, 40, 16, -250]],
]) {
  const c0 = sc;
  for (let i = 0; i < 40 && sc < c0 + 4; i++) {
    await pg.evaluate(`window.__setCam(...(${JSON.stringify(cam)}).map(v=>v*window.__ws)); window.__step(1, 1/24)`);
    await sleep(350);
  }
  fs.writeFileSync(`.verify/${name}.jpg`, latest);
  console.log('captured', name);
}
process.exit(0);
