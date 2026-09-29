/* probe-heap.mjs — boot the town and measure JS heap + merged-geometry
   vertex/index memory in the live scene. */
import { chromium } from 'playwright-core';
import os from 'os';

const url = process.argv[2] || 'http://127.0.0.1:8778/?still=1&q=high';
const EXE = process.env.CHROME_EXE || `${os.homedir()}/.local/bin/google-chrome`;
const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
await page.goto(url, { waitUntil: 'commit', timeout: 120000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 900000 });

const r = await page.evaluate(() => {
  let verts = 0, idx = 0, meshes = 0, indexed = 0, geos = 0;
  const attrs = {};
  window.__scene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry; if (!g || !g.attributes.position) return;
    meshes++;
    const v = g.attributes.position.count;
    verts += v; geos++;
    if (g.index) { idx += g.index.count; indexed++; }
    for (const name in g.attributes) attrs[name] = (attrs[name] || 0) + g.attributes[name].array.byteLength;
  });
  const mem = performance.memory ? {
    heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1),
    totalMB: +(performance.memory.totalJSHeapSize / 1048576).toFixed(1),
    limitMB: +(performance.memory.jsHeapSizeLimit / 1048576).toFixed(0),
  } : null;
  // GPU-side estimate: verts*attrs + index bytes
  let geoBytes = 0;
  for (const k in attrs) geoBytes += attrs[k];
  window.__scene.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.index) geoBytes += o.geometry.index.array.byteLength;
  });
  return { tier: window.__fx && window.__fx.tier, mem, meshes, geos, verts, indexed, idxTris: Math.round(idx / 3),
    attrMB: +(geoBytes / 1048576).toFixed(1), calls: window.__renderer.info.render.calls,
    tris: window.__renderer.info.render.triangles };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
