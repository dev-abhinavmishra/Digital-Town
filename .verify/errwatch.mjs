// errwatch.mjs — persistent console/pageerror watcher on :9223.
// Appends lines to .verify/shots2/errors.log; also tracks new targets.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const LOG = 'C:/Users/Administrator/repos/Digital-Town/.verify/shots2/errors.log';
fs.mkdirSync('C:/Users/Administrator/repos/Digital-Town/.verify/shots2', { recursive: true });
const log = s => { const line = `[${new Date().toISOString().slice(11, 19)}] ${s}\n`; fs.appendFileSync(LOG, line); console.log(line.trim()); };

const browser = await chromium.connectOverCDP('http://localhost:9223');
const seen = new Set();
function watchPage(p) {
  if (seen.has(p)) return; seen.add(p);
  p.on('console', m => { if (m.type() === 'error') log(`CONSOLE_ERR ${p.url()} :: ${m.text()}`); });
  p.on('pageerror', e => log(`PAGEERROR ${p.url()} :: ${e.message}`));
  log('watching ' + p.url());
}
for (const ctx of browser.contexts()) {
  for (const p of ctx.pages()) watchPage(p);
  ctx.on('page', watchPage);
}
console.log('ERRWATCH_UP');
