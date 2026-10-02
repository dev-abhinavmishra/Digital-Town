// sample.mjs — project world points -> sample screenshot pixels.
// usage: node sample.mjs <shotname>   (screenshots saved/read in shots-linux/)
//    or: node sample.mjs multi        (T2: pad sample across 5 poses)
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const OUT = new URL('./shots-linux/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] || 'multi';

const browser = await chromium.connectOverCDP('http://127.0.0.1:29229');
try {
  const page = browser.contexts()[0].pages().find(p => p.url().includes('127.0.0.1:8778'));
  page.setDefaultTimeout(20000);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // project world points to CSS px in current cam
  const project = pts => page.evaluate(async (pts) => {
    const THREE = await import('./vendor/three/build/three.module.js');
    return pts.map(([x, y, z]) => {
      const v = new THREE.Vector3(x, y, z).project(window.__cam);
      return [(v.x * .5 + .5) * innerWidth, (-v.y * .5 + .5) * innerHeight, v.z];
    });
  }, pts);

  // decode PNG via data URL in an offscreen canvas, sample mean rgb in r-px boxes
  const samplePng = async (pngPath, cssPts, r = 6) => {
    const b64 = fs.readFileSync(pngPath).toString('base64');
    return page.evaluate(async ({ b64, cssPts, r }) => {
      const dpr = devicePixelRatio || 1;
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      return cssPts.map(([px, py]) => {
        const X = Math.round(px * dpr), Y = Math.round(py * dpr), R = Math.round(r * dpr);
        const d = x.getImageData(Math.max(0, X - R), Math.max(0, Y - R), 2 * R, 2 * R).data;
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; }
        return [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
      });
    }, { b64, cssPts, r });
  };

  if (mode === 'multi') {
    /* ---- T2: junction pad colour stability across orbit poses ---- */
    const poses = [
      ['home',   null],
      ['se',     [700, 420, -420, -30, 0, -40]],
      ['sw',     [-650, 380, 520, -30, 0, -40]],
      ['nw',     [-420, 520, -620, -30, 0, -40]],
      ['top',    [60, 140, 60, 60, 0, -140]],
    ];
    const jxn = [[-140, 0.5, -40]];           // Univ x Main pad centre
    const padRef = [];                         // rgb per pose
    for (const [nm, p] of poses) {
      if (p) { await page.evaluate(v => window.__setCam(...v), p); await sleep(1200); }
      const css = await project(jxn);
      const f = `${OUT}/T2-${nm}.png`;
      await page.screenshot({ path: f, timeout: 120000 });
      const rgb = await samplePng(f, css);
      padRef.push({ pose: nm, css: css[0].map(v => Math.round(v)), rgb: rgb[0] });
      console.log('PAD', nm, JSON.stringify(css[0].map(v => Math.round(v))), 'rgb=', rgb[0]);
    }
    console.log('PADALL', JSON.stringify(padRef));
  } else {
    /* ---- T3: lawn tints at default aerial ---- */
    await page.evaluate(() => window.__setCam(540, 620, 660, -30, 0, -40));
    await sleep(1500);
    const css = await project([
      [450, 0.5, 50], [600, 0.5, 150], [700, 0.5, 220],     // park lawn pts
      [-510, 0.5, 540], [-560, 0.5, 500], [-470, 0.5, 610], // school field pts
      [-480, 0.5, -540], [-430, 0.5, -560], [-520, 0.5, -505], // campus quad pts
      [570, 0.5, 680],                                       // SE_GREEN meadow
    ]);
    const f = `${OUT}/T3-aerial-tints.png`;
    await page.screenshot({ path: f, timeout: 120000 });
    const rgb = await samplePng(f, css, 8);
    const mean = a => a.reduce((s, v) => [s[0] + v[0] / a.length, s[1] + v[1] / a.length, s[2] + v[2] / a.length], [0, 0, 0]).map(Math.round);
    const park = mean(rgb.slice(0, 3)), school = mean(rgb.slice(3, 6)), quad = mean(rgb.slice(6, 9)), meadow = rgb[9];
    const d = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    console.log('TINT park=', park, 'school=', school, 'quad=', quad, 'meadow=', meadow);
    console.log('TINT pairwiseΔ park-school=', d(park, school), 'park-quad=', d(park, quad), 'school-quad=', d(school, quad));
    console.log('TINT raw', JSON.stringify(rgb), 'css', JSON.stringify(css.map(c => c.map(Math.round))));
  }
} finally { await browser.close(); }
