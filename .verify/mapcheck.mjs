import { chromium } from 'playwright-core';
const b = await chromium.connectOverCDP('http://127.0.0.1:29229');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p => p.url().includes(':8778')) || await ctx.newPage();
await page.goto('http://127.0.0.1:8778/index.html?view=map&q=low&still=1', { waitUntil:'commit', timeout:60000 }).catch(()=>{});
await page.waitForFunction('window.__ready === true', null, { timeout: 540000 });
const r = await page.evaluate(async () => {
  const d = getComputedStyle(document.getElementById('uiBtnDeck')).display;
  __deck.start(); await new Promise(r=>setTimeout(r,300));
  return { mapOn: window.__mapOn, btn: d, deckOn: __deck.on, pass: d==='none' && !__deck.on };
});
console.log(JSON.stringify(r));
await page.close().catch(()=>{}); await b.close().catch(()=>{});
