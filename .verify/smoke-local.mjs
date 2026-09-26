// smoke-local.mjs — local-checkout variant of smoke.mjs: smoke.mjs pins
// absolute paths from the original authoring machine, so this harness resolves
// modules relative to this file. Same idea: run every town builder under node
// DOM stubs to catch runtime errors without a browser, plus the
// buildGroundDetail pass and a scene triangle count (budget check).
const ctxStub = () => new Proxy({ canvas: null }, {
  get(t, k) {
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'getImageData') return (a, b, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'putImageData' || k === 'drawImage') return () => {};
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    if (k === 'getContext') return () => ctxStub();
    if (typeof k === 'string') return () => {};
    return undefined;
  },
  set() { return true; },
});
const canvasStub = () => ({
  width: 0, height: 0, style: {},
  getContext: () => ctxStub(),
  toDataURL: () => '',
});
const elStub = () => ({
  addEventListener() {}, removeEventListener() {}, setAttribute() {},
  style: {}, set src(v) {}, get src() { return ''; },
});
globalThis.document = {
  createElement: tag => tag === 'canvas' ? canvasStub() : elStub(),
  createElementNS: () => elStub(),
  body: { appendChild() {} },
};
globalThis.window = { __city: {} };
globalThis.self = globalThis;
globalThis.location = { search: '' };

const TOWN = new URL('../town/', import.meta.url);
const THREE = await import(new URL('node_modules/three/build/three.module.js', TOWN));
const D = await import(new URL('js/details.js', TOWN));
const L = await import(new URL('js/layout.js', TOWN));
const B = await import(new URL('js/buildings.js', TOWN));
const { buildGroundDetail } = await import(new URL('js/city/ground.js', TOWN));
const { mergeStatic, R } = await import(new URL('js/lib.js', TOWN));

let fails = 0;
const triCount = (scene) => {
  let tris = 0;
  scene.traverse(o => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const g = o.geometry;
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += n * (o.isInstancedMesh ? o.count : 1);
  });
  return Math.round(tris);
};
const run = (name, fn) => {
  try { fn(); console.log('OK', name); }
  catch (e) { fails++; console.log('FAIL', name, e.message, e.stack?.split('\n')[1]?.trim()); }
};

const scene = new THREE.Scene();

// mirrors main.js build order so occupancy is complete before ground detail
run('registerOccupancy', () => D.registerOccupancy());
for (const fn of ['buildRoads', 'buildLots', 'buildWater', 'buildPark',
                  'buildAthleticPark'])
  run(fn, () => D[fn](scene));
run('buildPlaza', () => D.buildPlaza(scene, L.PLAZA));
run('buildProps', () => D.buildProps(scene));
run('buildings', () => {
  for (const b of L.BUILDINGS) if (b.w) scene.add(B.makeBuilding(b));
  for (const f of L.FILLER) {
    scene.add(B.makeBuilding({ name: '', ...f }));
    D.occupyRect(f.x, f.z, f.w, f.d, 4);
  }
  for (const a of L.APARTMENTS) scene.add(B.makeBuilding({ ...a, type: 'apartment' }));
});
run('houseBlocks', () => {
  for (const blk of L.HOUSE_BLOCKS) {
    const W = blk.x1 - blk.x0, Dd = blk.z1 - blk.z0;
    const typeFor = () => blk.duplex ? 'duplex' : (R() < .24 ? 'ranch' : 'house');
    const occupy = (t, x, z, sgn) => {
      if (t === 'duplex') D.occupyRect(x, z + sgn, 19, 15, 2);
      else if (t === 'ranch') D.occupyRect(x + sgn * 4, z + sgn * 3, 28, 20, 2);
      else D.occupyRect(x + sgn * 2, z + sgn * 3, 22, 20, 2);
    };
    if (blk.face === 'v') {
      for (let i = 0; i < blk.count; i++) {
        const z = blk.z0 + (i + .5) * Dd / blk.count;
        const spec = { type: typeFor(), x: blk.x1 - 12, z, rot: Math.PI / 2 };
        scene.add(B.makeBuilding(spec));
        if (spec.type === 'ranch') D.occupyRect(spec.x + 3.5, z - 4, 20, 28, 2);
        else D.occupyRect(spec.x + 3.5, z - 2.5, 20, 20, 2);
      }
    } else {
      const twoRows = Dd > 80, rows = twoRows ? 2 : 1;
      for (let rI = 0; rI < rows; rI++) {
        const n = Math.ceil(blk.count / rows);
        const z = twoRows ? (rI === 0 ? blk.z0 + 13 : blk.z1 - 13) : blk.z1 - 13;
        const rot = twoRows ? (rI === 0 ? Math.PI : 0) : 0;
        const sgn = rot ? -1 : 1;
        for (let i = 0; i < n; i++) {
          const x = blk.x0 + 14 + i * (W - 28) / Math.max(1, n - 1);
          if (!D.isFree(x, z, 8)) continue;
          const t = typeFor();
          scene.add(B.makeBuilding({ type: t, x, z, rot }));
          occupy(t, x, z, sgn);
        }
      }
    }
  }
  for (const row of L.COTTAGE_ROWS) {
    const W = row.x1 - row.x0, sgn = row.face === 'n' ? -1 : 1;
    for (let i = 0; i < row.count; i++) {
      const x = row.x0 + 12 + i * (W - 24) / Math.max(1, row.count - 1);
      scene.add(B.makeBuilding({ type: 'cottage', x, z: row.z,
        rot: row.face === 'n' ? Math.PI : 0 }));
      D.occupyRect(x + sgn * 2, row.z + sgn * 3, 22, 20, 2);
    }
  }
});
for (const fn of ['buildLights', 'buildTrees', 'buildCars', 'buildTraffic',
                  'buildPeople', 'buildFences', 'buildCountryside',
                  'buildMountains', 'buildClouds', 'buildBirds'])
  run(fn, () => D[fn](scene));

const t0 = triCount(scene);
let added = 0, total = 0;
run('buildGroundDetail', () => {
  buildGroundDetail(scene);
  total = triCount(scene);
  added = total - t0;
});
run('mergeStatic', () => mergeStatic(scene));
run('tickWorld x30', () => { for (let i = 0; i < 30; i++) D.tickWorld(i * 0.5, 0.1); });

const ground = globalThis.window.__city?.ground ?? null;
console.log('CITY.ground', JSON.stringify(ground));
console.log(`tris base=${t0} +ground=${added} total=${total}`);
if (!ground || !Object.values(ground).some(v => v > 0)) {
  fails++; console.log('FAIL CITY.ground empty');
}
if (added > 120000) { fails++; console.log('FAIL ground tris over 120k'); }
if (total > 1900000) { fails++; console.log('FAIL total tris over 1.9M'); }
console.log(fails ? `${fails} FAILS` : 'SMOKE GREEN');
process.exitCode = fails ? 1 : 0;
