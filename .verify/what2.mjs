// what2.mjs — name the giant brown surface: hit points + bounding radii.
import { chromium } from 'playwright-core';
const EXE = 'C:/devin/chrome/chrome-win64/chrome.exe';
const BASE = 'http://127.0.0.1:8778';
const url = `${BASE}/?cam=-40,3,-150,-140,4,-215&still=1`;
const browser = await chromium.launch({
  executablePath: EXE, headless: false,
  args: ['--window-size=1600,960', '--use-angle=default', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 420000 });
await page.waitForTimeout(1500);
const hits = await page.evaluate(async () => {
  const { Raycaster, Vector2 } = await import('./node_modules/three/build/three.module.js');
  const scene = window.__scene, cam = window.__cam;
  const rc = new Raycaster();
  const out = [];
  for (const [nx, ny] of [[-.6, .5], [0, .7], [.3, .5], [-.5, .85], [-.2, .35]]) {
    rc.setFromCamera(new Vector2(nx, ny), cam);
    const h = rc.intersectObjects(scene.children, true).slice(0, 2).map(i => {
      const g = i.object.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      return {
        pt: [+i.point.x.toFixed(0), +i.point.y.toFixed(0), +i.point.z.toFixed(0)],
        d: +i.distance.toFixed(1),
        r: +g.boundingSphere.radius.toFixed(0),
        type: i.object.type,
        inst: i.instanceId,
        name: i.object.name || '', parent: i.object.parent?.name || '',
        mat: i.object.material?.type,
        map: !!i.object.material?.map,
        col: i.object.material?.color?.getHexString?.(),
        transparent: i.object.material?.transparent,
      };
    });
    out.push({ nx, ny, hits: h });
  }
  return out;
});
console.log(JSON.stringify(hits));
await browser.close();
