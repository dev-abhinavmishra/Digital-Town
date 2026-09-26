// fingerprint.mjs — determinism check: hash built scene CONTENT across loads.
// Hashes geometry samples + baked instance transforms + material signatures —
// but NOT matrixWorld of animated groups or per-session uuids (those move on
// the wall clock / session rng and are outside the seeded build).
import { chromium } from 'playwright-core';
const url = process.argv[2];
const EXE = 'C:/Users/pmsma/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox'] });
const hashes = [];
for (const tag of ['c', 'd']) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  const fp = await page.evaluate(async () => {
    window.__parts = [];
    const parts = window.__parts;
    window.__scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      const p = o.geometry?.attributes?.position;
      const n = p ? Math.min(p.count, 96) : 0;
      const samp = [];
      for (let i = 0; i < n; i++)
        samp.push(p.getX(i).toFixed(3), p.getY(i).toFixed(3), p.getZ(i).toFixed(3));
      // baked instance transforms are part of the deterministic build
      let inst = '';
      if (o.isInstancedMesh && o.instanceMatrix) {
        const a = o.instanceMatrix.array, m = Math.min(a.length, 128);
        const s = []; for (let i = 0; i < m; i++) s.push(a[i].toFixed(3));
        inst = s.join(',');
      }
      const mats = (Array.isArray(o.material) ? o.material : [o.material])
        .map(m => (m.color?.getHexString?.() || '') + (m.map ? 'T' + (m.map.image?.width || '?') : '') + (m.vertexColors ? 'vc' : ''));
      parts.push([o.type, p?.count || 0, o.count || '', samp.join(','), inst, mats.join('|')].join(';'));
    });
    const enc = new TextEncoder().encode(parts.join('\n'));
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  });
  const raw = await page.evaluate('window.__parts.join("\\n")');
  await import('fs').then(fs => fs.writeFileSync(`parts-${tag}.txt`, raw));
  hashes.push(fp);
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ a: hashes[0], b: hashes[1], identical: hashes[0] === hashes[1] }));
