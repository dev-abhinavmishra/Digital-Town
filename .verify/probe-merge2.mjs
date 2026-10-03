import { chromium } from 'playwright-core';
const b = await chromium.connectOverCDP('http://localhost:9223');
const p = b.contexts()[0].pages().find(x => x.url().includes('8778'));
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
p.on('pageerror', e => errs.push('PAGEERROR:' + e.message.slice(0, 120)));
const r = await p.evaluate(() => {
  const w = window.__ws || 1, out = { errsAtEval: (window.__errs || []).length };
  // find medhall building mesh: pickBuildingAt covers layout coords; use raycast-free check
  const lay = (window.__layout || null);
  // scene traverse for a mesh whose world bbox centre lands near (40,-270) layout
  let found = null;
  window.__scene.traverse(o => {
    if (found || !o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const c = o.geometry.boundingBox.getCenter(new (o.position.constructor)());
    const wp = o.localToWorld ? o.localToWorld(c.clone()) : c;
    const lx = wp.x / w, lz = wp.z / w;
    if (Math.abs(lx - 40) < 12 && Math.abs(lz + 270) < 12) found = { n: o.name || o.type, lx: +lx.toFixed(1), lz: +lz.toFixed(1) };
  });
  out.medhallNearCenter = found;
  return out;
});
console.log('MERGE', JSON.stringify(r));
// deck smoke: start, step, exit
const d = await p.evaluate(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  window.__deck.start(); await s(700);
  const st1 = { on: window.__deck.on, i: window.__deck.i };
  window.__deck.next(); await s(300);
  const st2 = { i: window.__deck.i };
  window.__deck.exit(); await s(300);
  return { st1, st2, off: !window.__deck.on };
});
console.log('DECK', JSON.stringify(d));
await new Promise(r => setTimeout(r, 800));
console.log('ERRORS', JSON.stringify(errs.slice(0, 8)));
await b.close();
