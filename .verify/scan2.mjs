import { chromium } from 'playwright-core';
const [url] = process.argv.slice(2);
const EXE = 'C:/Users/pmsma/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.waitForTimeout(1500);
const out = await page.evaluate(() => {
  const byMat = new Map();
  let groups = 0, multiMatMeshes = 0;
  window.__scene.traverse(o => {
    if (!(o.isMesh || o.isInstancedMesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (Array.isArray(o.material)) multiMatMeshes++;
    for (const m of mats) {
      groups++;
      const k = m.uuid;
      const b = byMat.get(k) || { n: 0, inst: 0, map: m.map?.name || m.map?.sourceURL?.split('/').pop() || (m.map?.image?.width ? 'canvas' + m.map.image.width : '-'),
        col: m.color?.getHexString?.(), vc: !!m.vertexColors, emis: !!m.emissiveMap };
      b.n++; if (o.isInstancedMesh) b.inst += o.count; byMat.set(k, b);
    }
  });
  const list = [...byMat.entries()].map(([k, v]) => ({ ...v })).sort((a, b) => b.n - a.n);
  const total = list.reduce((s, v) => s + v.n, 0);
  return { total, multiMatMeshes, buckets: list.length,
    top: list.slice(0, 40), rest: list.slice(40).reduce((s, v) => s + v.n, 0) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
