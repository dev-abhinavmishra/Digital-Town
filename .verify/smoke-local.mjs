// smoke-local.mjs — run town builders under node with DOM stubs (this box).
const TOWN = new URL('../town/', import.meta.url).href;
const ctxStub = () => new Proxy({ canvas: null }, {
  get(t, k) {
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'getImageData') return (a, b, w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) });
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'putImageData' || k === 'drawImage') return () => {};
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    if (k === 'createPattern') return () => ({});
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
  body: { appendChild() {}, append() {} },
};
globalThis.window = { __city: {} };
globalThis.self = globalThis;
globalThis.location = { search: '' };
globalThis.addEventListener = () => {};

const THREE = await import(TOWN + 'node_modules/three/build/three.module.js');
const L = await import(TOWN + 'js/layout.js');
const D = await import(TOWN + 'js/details.js');

const scene = new THREE.Scene();
const calls = ['registerOccupancy', 'buildRoads', 'buildLots', 'buildWater',
  'buildPark', 'buildAthleticPark', 'buildProps', 'buildTrees',
  'buildCars', 'buildTraffic', 'buildPeople', 'buildFences', 'buildCountryside',
  'buildMountains', 'buildClouds', 'buildBirds', 'buildLights'];
let tris = 0;
for (const fn of calls) {
  if (!D[fn]) { console.log('skip', fn); continue; }
  try {
    D[fn](scene);
    console.log('OK', fn);
  } catch (e) {
    console.log('FAIL', fn, e.message, e.stack?.split('\n')[1]?.trim());
  }
}
try { D.buildPlaza(scene, L.PLAZA); console.log('OK buildPlaza'); }
catch (e) { console.log('FAIL buildPlaza', e.message); }
for (const [mod, fn] of [['city/furniture.js', 'buildFurniture'],
                        ['city/ground.js', 'buildGroundDetail'],
                        ['city/backlots.js', 'buildBacklots']]) {
  try {
    const M2 = await import(TOWN + 'js/' + mod);
    M2[fn](scene);
    console.log('OK', fn);
  } catch (e) { console.log('FAIL', fn, e.message, e.stack?.split('\n')[1]?.trim()); }
}
// interior: footprint picking must resolve a building at each declared centre,
// and an enter/exit cycle must run headlessly (DOM stubs above)
try {
  const I = await import(TOWN + 'js/interior.js');
  const sized = L.BUILDINGS.filter(b => b.w);
  let hits = 0;
  for (const b of sized) if (I.pickBuildingAt(b.x, b.z)) hits++;
  console.log('OK pickBuildingAt', hits + '/' + sized.length);
  const cam = new THREE.PerspectiveCamera(70, 1.6, .1, 4000);
  const fly = { yaw: 0, pitch: 0, auto: true, speed: 10, keys: {}, vel: new THREE.Vector3() };
  const inst = I.installInterior({ scene, camera: cam, getOrtho: () => null,
    renderer: { domElement: { addEventListener() {} } }, fly,
    syncAnglesFromCam() {}, setActiveCam() {}, camTween: { on: false } });
  inst.byId(L.BUILDINGS.find(b => b.id).id);
  await new Promise(r => setTimeout(r, 260));
  const onAfterEnter = inst.on;
  inst.tick(0.016);
  inst.exit();
  await new Promise(r => setTimeout(r, 260));
  console.log('OK interior enter=' + onAfterEnter + ' exit on=' + inst.on);
} catch (e) { console.log('FAIL interior', e.message, e.stack?.split('\n')[1]?.trim()); }
scene.traverse(o => {
  if (o.geometry?.attributes?.position) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
});
try {
  for (let i = 0; i < 30; i++) D.tickWorld(i * 0.5, 0.1);
  console.log('OK tickWorld x30');
} catch (e) { console.log('FAIL tickWorld', e.message, e.stack?.split('\n')[1]?.trim()); }
console.log('tris approx', Math.round(tris / 1000) + 'k');
console.log('CITY', JSON.stringify(globalThis.window.__city?.trees ?? null));
