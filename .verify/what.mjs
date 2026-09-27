// what.mjs — raycast the offending pixels and name what's covering the sky.
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
  const T = await import('./js/lib.js');        // for THREE? not exported — use scene globals
  const { Raycaster, Vector2 } = await import('./node_modules/three/build/three.module.js');
  const scene = window.__scene, cam = window.__cam;
  const rc = new Raycaster();
  const out = [];
  for (const [nx, ny] of [[-.6, .5], [0, .6], [.6, .5], [-.8, .8], [0, .85], [-.3, .2]]) {
    rc.setFromCamera(new Vector2(nx, ny), cam);
    const h = rc.intersectObjects(scene.children, true).slice(0, 3).map(i => ({
      d: +i.distance.toFixed(1),
      type: i.object.type, name: i.object.name || i.object.userData?.tag || '',
      mat: i.object.material?.name || i.object.material?.type || '',
      col: i.object.material?.color?.getHexString?.(),
      geo: i.object.geometry?.type,
      pos: i.object.position && [+i.object.position.x.toFixed(0), +i.object.position.y.toFixed(0), +i.object.position.z.toFixed(0)],
      parent: i.object.parent?.name || '',
      inst: i.instanceId,
    }));
    out.push({ nx, ny, hits: h });
  }
  return out;
});
console.log(JSON.stringify(hits, null, 1).slice(0, 6000));
await browser.close();
