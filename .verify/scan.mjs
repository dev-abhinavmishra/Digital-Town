// scan.mjs — scene composition + draw-call buckets
import { chromium } from 'playwright-core';
const [url] = process.argv.slice(2);
const EXE = 'C:/Users/pmsma/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.waitForTimeout(1500);
const out = await page.evaluate(() => {
  const byType = {}, byMat = new Map(), big = [];
  let n = 0;
  window.__scene.traverse(o => {
    if (!(o.isMesh || o.isInstancedMesh)) return;
    if (o.userData?.noCull === false) {}
    n++;
    const tris = (o.geometry?.index ? o.geometry.index.count : o.geometry?.attributes?.position?.count || 0) / 3;
    byType[o.type] = (byType[o.type] || 0) + 1;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const k = (m.map ? 'tex' : m.vertexColors ? 'vc' : m.color?.getHexString?.() || m.type);
      const b = byMat.get(k) || { n: 0, tris: 0 };
      b.n++; b.tris += Math.round(tris); byMat.set(k, b);
    }
    big.push({ t: o.type, tris: Math.round(tris * (o.count || 1)), nm: o.name || '', shadow: !!o.castShadow });
  });
  big.sort((a, b) => b.tris - a.tris);
  return { meshN: n, byType, kids: window.__scene.children.length,
    topMats: [...byMat.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 28),
    topTris: big.slice(0, 18), calls: window.__renderer.info.render.calls,
    shadowOn: big.filter(b => b.shadow).length };
});
console.log(JSON.stringify(out, null, 1));
console.log('ERRORS:', JSON.stringify(errors));
await browser.close();
