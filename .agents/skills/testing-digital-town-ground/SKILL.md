---
name: testing-digital-town-ground
description: How to E2E-test Digital-Town city-builder passes that are intentionally NOT wired into main.js — inject into the live scene, instrument GeoBin to verify decal placement, and diff screenshots without image deps.
---

# Testing un-wired city builder passes (e.g. city/ground.js)

Some `town/js/city/*.js` builders (e.g. `buildGroundDetail`) are deliberately not called by `main.js` per task spec — they must be injected into the live scene and verified via `window.__city.<key>` counters + screenshots.

## Serve + load
- `node town/server.cjs` (may already run) → http://127.0.0.1:8778, static + `no-store`, serves whatever branch is checked out — no restart needed after `git checkout`.
- Light-load URL params: `?freeze=1&still=1&nofx=1&noatmo=1&noglassfx=1&nocull=1&cam=px,py,pz,tx,ty,tz`.
- Playwright: `chromium.launch({ executablePath: 'C:/devin/chrome/chrome-win64/chrome.exe', headless|false, args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu-sandbox'] })`. `playwright-core` resolves from repo-root `node_modules`.
- `window.__ready` takes several minutes under SwiftShader — poll with `waitForFunction` timeout ~480s and a heartbeat `page.evaluate` (evals fail while the main thread is blocked during scene build — expected).

## Injection + counters
```js
const m = await import('./js/city/ground.js');  // relative to page URL
m.buildGroundDetail(window.__scene);
window.__city.ground   // {overlays, paths, litter, mulch, flowers, stains}
```
- Check `window.__city.<key>` BEFORE injecting — should be zeros; non-zero means main.js secretly wires it (spec violation).
- RNG (`lib.js R()/rr()/pick()`) is seeded: identical counts across runs = determinism check.

## Verifying decal placement without eyeballing every shot
Patch `GeoBin.prototype.add` BEFORE injecting to record every merged decal's (x,z):
```js
const { GeoBin } = await import('./js/city/geo.js');
const orig = GeoBin.prototype.add;
GeoBin.prototype.add = function (geo, m, x, y, z, o) {
  if (geo.attributes.position.count === 11) discs.push([x, z]); // CircleGeometry(1.15,9) → 11 verts (center+rim), NOT 10
  return orig.call(this, geo, m, x, y, z, o);
};
```
Vertex-count fingerprint of ground.js geoms: path discs = 11 (Circle r=1.15 seg=9), tire-track stains = 12 (seg=10), oil stains/mulch discs = 14 (seg=12), overlay/bed planes = 4 (PlaneGeometry). Instanced layers (litter, pebbles, flowers, grass) bypass GeoBin — count via `CITY.ground` keys.

## Auditing instanced-layer placement numerically
For InstancedMesh layers (grass ~45k instances), don't eyeball coverage — decode `im.instanceMatrix.array` (world pos at indices i*16+12/13/14) in-page and check every instance against layout rects imported from `./js/layout.js` (ROADS asphalt: perp dist < r.w/2 within a0..a1; BUILDINGS/LOTS/PLAZA: |x-x0|<w/2 && |z-z0|<d/2). Find the mesh via `scene.traverse(o => o.isInstancedMesh && o.count === window.__city.ground.grass)`. See `.verify/run-ground-test.mjs` `grassAudit` block.

## Altitude caveat for grass-blade layers
~1-unit tufts are sub-pixel at aerial cams (y≥950): before/after aerials can be pixel-identical even with 45k tufts placed. Verify grass at street-level cams (height ~5-8, e.g. mainstreet `-150,6.5,-34,140,8,-60` or a low verge shot) where blade clusters are unmistakable. The scene is NOT frame-deterministic across runs (traffic/peds/water animate per frame) — cross-run diffs have ~75% noise floor; only same-run before/after pairs are meaningful.

## PNG pixel-diff without npm deps
`npm` is broken on this image (use `node "$(dirname "$(command -v node)")/node_modules/npm/bin/npm-cli.js"` if needed). To diff two PNGs, feed base64 to a headless page and decode via `<img>`+canvas `getImageData` — see `.verify/diff-pngs.mjs`. Same-frame shots differ ~0.9% under SwiftShader AA; a real ground pass changes ~86% of an aerial frame.

## Working scripts (`.verify/`, untracked)
- `run-ground-test.mjs` — headed full pass: ready → pre-checks → inject → 4 cams → flicker probe → error summary. MILESTONE lines for annotation timing.
- `run-ground-corner.mjs` — GeoBin instrumentation + corner-cut locator + targeted shots.
- `diff-pngs.mjs` — dep-free pixel diff.
- `shots-ground.mjs` (lead-authored) — headless before/after at 4 cams.

Note: file:// PNGs viewed in a Chrome tab taint the canvas — decode via data: URLs inside evaluate, not file:// images.