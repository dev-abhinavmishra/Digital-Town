// freeze smoke: with ?freeze=1, tickWorld must not move any car matrices
const ctxStub = () => new Proxy({ canvas: null }, {
  get(t, k) {
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'getImageData') return (a, b, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    if (k === 'getContext') return () => ctxStub();
    if (typeof k === 'string') return () => {};
    return undefined;
  },
  set() { return true; },
});
globalThis.document = {
  createElement: tag => tag === 'canvas'
    ? { width: 0, height: 0, style: {}, getContext: () => ctxStub(), toDataURL: () => '' }
    : { addEventListener() {}, setAttribute() {}, style: {} },
  createElementNS: () => ({ addEventListener() {}, setAttribute() {}, style: {} }),
  body: { appendChild() {} },
};
globalThis.window = { __city: {} };
globalThis.self = globalThis;
globalThis.location = { search: '?freeze=1' };

const THREE = await import('file:///C:/Users/pmsma/Downloads/HST%20Digital%20Town%20Project/town/node_modules/three/build/three.module.js');
const D = await import('file:///C:/Users/pmsma/Downloads/HST%20Digital%20Town%20Project/town/js/details.js');
const scene = new THREE.Scene();
D.buildRoads(scene); D.buildCars(scene); D.buildTraffic(scene); D.buildPeople(scene);

// snapshot a moving object's matrix before/after ticks
const im = scene.children.find(o => o.isInstancedMesh);
const before = im ? im.instanceMatrix.array.slice(0, 16).join(',') : 'none';
for (let i = 0; i < 20; i++) D.tickWorld(10 + i, 0.1);
const after = im ? im.instanceMatrix.array.slice(0, 16).join(',') : 'none';
console.log(before === after ? 'FREEZE OK (identical matrices)' : 'FREEZE FAIL (matrices moved)');
