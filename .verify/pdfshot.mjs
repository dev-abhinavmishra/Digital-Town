import { chromium } from 'playwright-core';
const b = await chromium.connectOverCDP('http://127.0.0.1:29229');
const page = b.contexts()[0].pages().find(p=>p.url().includes('8778')) || await b.contexts()[0].newPage();
await page.goto('http://127.0.0.1:8778/deck/index.html', {waitUntil:'load'});
await page.waitForTimeout(800);
await page.emulateMedia({ media: 'print' });
await page.screenshot({ path: 'shots-linux/deck-print-p1.png' });
console.log('ok');
await page.close().catch(()=>{}); await b.close().catch(()=>{});
