// smoke.mjs — run town builders under node with DOM stubs to catch runtime errors
// without a browser. Not a render check: proves no exceptions in build code.
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

const THREE = await import('file:///C:/Users/pmsma/Downloads/HST%20Digital%20Town%20Project/town/node_modules/three/build/three.module.js');
const D = await import('file:///C:/Users/pmsma/Downloads/HST%20Digital%20Town%20Project/town/js/details.js');

const scene = new THREE.Scene();
const calls = ['buildRoads', 'buildLots', 'buildTrees', 'buildCars', 'buildTraffic',
               'buildPeople', 'buildPark', 'buildProps', 'buildBirds', 'buildClouds'];
for (const fn of calls) {
  if (!D[fn]) { console.log('skip', fn); continue; }
  try {
    const r = D[fn](scene);
    console.log('OK', fn, r === undefined ? '' : '(ret)');
  } catch (e) {
    console.log('FAIL', fn, e.message, e.stack?.split('\n')[1]?.trim());
  }
}
// tickWorld a few frames to exercise traffic/signal/ped code
try {
  for (let i = 0; i < 30; i++) D.tickWorld(i * 0.5, 0.1);
  console.log('OK tickWorld x30');
} catch (e) { console.log('FAIL tickWorld', e.message, e.stack?.split('\n')[1]?.trim()); }
console.log('CITY', JSON.stringify(globalThis.window.__city, null, 1));
