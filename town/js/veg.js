// veg.js — vegetation v3: procedural tree archetypes that read as trees, not
// balloons. Every canopy is a merged set of noise-displaced ellipsoid clumps
// (irregular silhouette + baked under-shade vertex gradient) wrapped in a
// mottled leaf-cluster diffuse, plus a ring of alpha-tested leaf cards that
// break the outline the way real foliage does. Conifers get jittered,
// needle-textured cone tiers. Trunks are tapered and branched.
// All still instanced per-species: one InstancedMesh for trunks, one for
// canopies, one for card fringe — ~30 draws for the whole forest.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCanvas, canvasTex } from './lib.js';
import { pbr } from './mats.js';

const M = THREE.MeshStandardMaterial;

/* deterministic per-vertex hash — independent of the global R() stream so the
   tree geometry is stable no matter where in the build order it runs */
const hash = (i, seed) => {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/* ---------------- leaf textures ---------------- */
let _leafDiffuse = null, _leafCards = null, _needleDiffuse = null;

/* dense mottled leaf field — applied to the solid canopy clumps so surfaces
   read as leaf mass rather than smooth foam */
export function leafDiffuse() {
  if (_leafDiffuse) return _leafDiffuse;
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#8b9560'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const px = hash(i, 3) * 256, py = hash(i, 4) * 256;
    const l = .34 + hash(i, 5) * .5, r = 1.6 + hash(i, 6) * 3.4;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    const warm = hash(i, 7);
    const rr = Math.round(118 * l + warm * 26), gg = Math.round(128 * l + warm * 8),
          bb = Math.round(60 * l);
    g.addColorStop(0, `rgba(${rr},${gg},${bb},.85)`);
    g.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    x.fillStyle = g;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  _leafDiffuse = canvasTex(c, { srgb: true, repeat: [1, 1] });
  _leafDiffuse.wrapS = _leafDiffuse.wrapT = THREE.RepeatWrapping;
  return _leafDiffuse;
}

/* alpha-tested leaf-cluster sprite for the fringe cards — mostly transparent,
   leafy blobs at center so card edges dissolve into air */
export function leafCards() {
  if (_leafCards) return _leafCards;
  const [c, x] = makeCanvas(256, 256);
  x.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 340; i++) {
    // cluster biased to the middle so edges stay lacy
    const a = hash(i, 11) * 6.283, d = Math.pow(hash(i, 12), .55) * 100;
    const px = 128 + Math.cos(a) * d, py = 128 + Math.sin(a) * d * .92;
    const l = .45 + hash(i, 13) * .55, r = 4 + hash(i, 14) * 9;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    const v = Math.round(150 * l + 60);
    g.addColorStop(0, `rgba(${v},${v},${v * .8},.95)`);   // near-greyscale: instance color tints
    g.addColorStop(1, `rgba(${v},${v},${v * .8},0)`);
    x.fillStyle = g;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  _leafCards = canvasTex(c, { srgb: true });
  _leafCards.premultiplyAlpha = false;
  return _leafCards;
}

/* conifer needle stipple — darker value range than leafDiffuse */
export function needleDiffuse() {
  if (_needleDiffuse) return _needleDiffuse;
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#4e5d42'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const px = hash(i, 21) * 256, py = hash(i, 22) * 256;
    const l = .3 + hash(i, 23) * .55, r = .8 + hash(i, 24) * 2.0;
    const v = Math.round(96 * l + 30);
    x.fillStyle = `rgba(${v * .8},${v},${v * .72},.9)`;
    x.fillRect(px, py, 1.4 + hash(i, 25) * 2.4, 3.5 + hash(i, 26) * 5);
  }
  _needleDiffuse = canvasTex(c, { srgb: true });
  _needleDiffuse.wrapS = _needleDiffuse.wrapT = THREE.RepeatWrapping;
  return _needleDiffuse;
}

/* ---------------- geometry ---------------- */

/* one canopy clump: icosahedron displaced along its normal by hash noise +
   baked under-shade vertex gradient (darker underside/interior). Returns a
   geometry translated to (cx,cy,cz) with vertex colors in [0..1] that the
   instance color multiplies. */
function clump(r, cx, cy, cz, seed, { squash = .78, noise = .24, shadeLo = .5 } = {}) {
  const g = new THREE.IcosahedronGeometry(r, 1);          // 80 faces — chunky enough to dither
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = hash(i * 7 + 3, seed) * .6 + hash(i * 13 + 5, seed + 9) * .4;
    const k = 1 + (n - .5) * 2 * noise;
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y * squash, v.z);
  }
  g.computeVertexNormals();
  // under-shade: bottoms and interior vertices darken (cheap ambient occlusion)
  const nrm = g.attributes.normal, cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const up = nrm.getY(i) * .5 + .5;                      // 0 bottom .. 1 top
    const side = Math.max(0, 1 - Math.abs(nrm.getY(i)) * 2.4);
    const l = Math.min(1, shadeLo + up * (1 - shadeLo)) * (1 - side * .18);
    const jitter = .9 + hash(i, seed + 31) * .2;
    const lv = Math.min(1, l * jitter);
    cols[i * 3] = lv; cols[i * 3 + 1] = lv; cols[i * 3 + 2] = lv;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  // squash UVs outward so the leaf map tiles coarsely over the clump
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.7, uv.getY(i) * 1.7);
  g.translate(cx, cy, cz);
  return g;
}

/* canopy = merged clumps. blobs: [{r,x,y,z,squash?,noise?}] */
export function canopyGeo(blobs, seed = 1) {
  const gs = blobs.map((b, i) =>
    clump(b.r, b.x, b.y, b.z, seed + i * 17, b));
  const m = mergeGeometries(gs.map(g => (g.index ? g.toNonIndexed() : g)), false);
  gs.forEach(g => g.dispose());
  return m;
}

/* fringe cards: quads orbiting the canopy edge, each rotated to a random
   facing — alpha-tested leaf texture dissolves the silhouette. Returns a
   geometry with UVs covering the whole card texture. */
export function fringeGeo(cx, cy, cz, rad, n, size, seed = 1, { tilt = .5, yJit = .5 } = {}) {
  const gs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(i, seed) * .9;
    const rr = rad * (.78 + hash(i, seed + 2) * .4);
    const g = new THREE.PlaneGeometry(size, size * (.8 + hash(i, seed + 4) * .5));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
          e = new THREE.Euler(
            (hash(i, seed + 5) - .5) * tilt,
            a + Math.PI / 2 + (hash(i, seed + 6) - .5) * 1.2,
            (hash(i, seed + 7) - .5) * tilt);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(
      cx + Math.cos(a) * rr,
      cy + (hash(i, seed + 8) - .5) * rad * yJit,
      cz + Math.sin(a) * rr), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    gs.push(g);
  }
  const m = mergeGeometries(gs.map(g => (g.index ? g.toNonIndexed() : g)), false);
  gs.forEach(g => g.dispose());
  return m;
}

/* tapered trunk + leaning branches, merged. h = trunk height. */
export function trunkGeo({ h = 4.6, r0 = .5, r1 = .26, branches = 3, branchLen = null,
                           lean = .03, barkSeed = 5 } = {}) {
  const gs = [new THREE.CylinderGeometry(r1, r0, h, 7)];
  gs[0].translate(0, h / 2, 0);
  const nB = branches;
  for (let i = 0; i < nB; i++) {
    const a = (i / nB) * Math.PI * 2 + hash(i, barkSeed) * 1.3;
    const bh = h * (.55 + hash(i, barkSeed + 1) * .3);
    const bl = branchLen || (1.4 + hash(i, barkSeed + 2) * 1.6);
    const b = new THREE.CylinderGeometry(r1 * .35, r1 * .62, bl, 5);
    b.translate(0, bl / 2, 0);
    b.rotateZ(.55 + hash(i, barkSeed + 3) * .4);
    b.rotateY(a);
    b.translate(Math.cos(a + .4) * .2, bh, Math.sin(a + .4) * .2);
    gs.push(b);
  }
  // slight trunk lean for organic feel
  const m = mergeGeometries(gs.map(g => (g.index ? g.toNonIndexed() : g)), false);
  gs.forEach(g => g.dispose());
  if (lean) {
    const p = m.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(i, p.getX(i) + y * y * lean * .06);
    }
    m.computeVertexNormals();
  }
  return m;
}

/* conifer tier stack — cones with vertex jitter + baked under-shade */
export function coniferGeo({ h = 9, r = 2.1, tiers = 3, seed = 9 } = {}) {
  const gs = [];
  for (let t = 0; t < tiers; t++) {
    const f = t / tiers;
    const rr = r * (1 - f * .62), hh = h * (1 / tiers) * 1.35;
    const g = new THREE.ConeGeometry(rr, hh, 8);
    g.translate(0, h * (t + .8) / tiers, 0);
    const pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (v.y > .01) {
        const n = hash(i + t * 97, seed);
        v.x += (n - .5) * rr * .22;
        v.z += (hash(i + t * 97, seed + 4) - .5) * rr * .22;
        v.y += (hash(i + t * 97, seed + 8) - .5) * hh * .16;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    // dark under-tier gradient baked as vertex color
    const nrm = g.attributes.normal, cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const lv = .55 + (nrm.getY(i) * .5 + .5) * .45;
      cols[i * 3] = lv; cols[i * 3 + 1] = lv; cols[i * 3 + 2] = lv;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    gs.push(g);
  }
  const m = mergeGeometries(gs.map(g => (g.index ? g.toNonIndexed() : g)), false);
  gs.forEach(g => g.dispose());
  return m;
}

/* ---------------- species archetypes ----------------
   Each entry: { trunk: geoSpec, canopy: {blobs, seed} | conifer: spec,
                 cards: {cx,cy,cz,rad,n,size} or null } */
export const ARCHETYPES = {
  o: {   // oak — broad dome of 6 clumps
    trunk: { h: 4.4, r0: .55, r1: .3, branches: 4 },
    canopy: { seed: 11, blobs: [
      { r: 2.5, x: 0, y: 5.6, z: 0, squash: .72 },
      { r: 2.0, x: 1.9, y: 4.9, z: .5, squash: .75 },
      { r: 2.0, x: -1.8, y: 5.0, z: -.4, squash: .78 },
      { r: 1.8, x: .3, y: 4.7, z: 1.9, squash: .75 },
      { r: 1.8, x: -.6, y: 4.8, z: -1.8, squash: .78 },
      { r: 1.9, x: 0, y: 6.9, z: 0, squash: .7 },
    ] },
    cards: { cx: 0, cy: 5.4, cz: 0, rad: 2.9, n: 26, size: 2.6, yJit: .8 },
  },
  m: {   // maple — tight round crown
    trunk: { h: 4.2, r0: .42, r1: .22, branches: 3 },
    canopy: { seed: 23, blobs: [
      { r: 2.3, x: 0, y: 5.4, z: 0, squash: .9 },
      { r: 1.6, x: 1.5, y: 5.0, z: .6, squash: .85 },
      { r: 1.6, x: -1.4, y: 5.1, z: -.5, squash: .88 },
      { r: 1.5, x: 0, y: 6.6, z: -.4, squash: .85 },
    ] },
    cards: { cx: 0, cy: 5.4, cz: 0, rad: 2.5, n: 22, size: 2.2, yJit: .9 },
  },
  b: {   // birch — slim pale trunk, airy small crown
    trunk: { h: 6.4, r0: .24, r1: .13, branches: 4, branchLen: 1.6, lean: .05 },
    canopy: { seed: 31, blobs: [
      { r: 1.5, x: 0, y: 7.0, z: 0, squash: .8, shadeLo: .6 },
      { r: 1.1, x: .9, y: 6.3, z: .4, squash: .8, shadeLo: .6 },
      { r: 1.1, x: -.8, y: 6.5, z: -.4, squash: .82, shadeLo: .6 },
      { r: .95, x: .2, y: 7.8, z: .3, squash: .8, shadeLo: .6 },
    ] },
    cards: { cx: 0, cy: 6.9, cz: 0, rad: 1.7, n: 18, size: 1.6, yJit: 1.1 },
  },
  c: {   // spruce — tall dark tiers
    trunk: { h: 3.4, r0: .4, r1: .22, branches: 0 },
    conifer: { h: 9.4, r: 2.2, tiers: 3, seed: 41 },
    cards: null,
  },
  p: {   // pine — softer layered tiers
    trunk: { h: 3.6, r0: .42, r1: .24, branches: 0 },
    conifer: { h: 8.6, r: 2.0, tiers: 3, seed: 43 },
    cards: null,
  },
  s: {   // sakura — blossom puff cloud
    trunk: { h: 3.6, r0: .4, r1: .2, branches: 4, branchLen: 1.8 },
    canopy: { seed: 53, blobs: [
      { r: 2.2, x: 0, y: 4.6, z: 0, squash: .68, shadeLo: .55 },
      { r: 1.6, x: 1.6, y: 4.2, z: .5, squash: .7, shadeLo: .55 },
      { r: 1.6, x: -1.5, y: 4.3, z: -.5, squash: .7, shadeLo: .55 },
      { r: 1.4, x: .2, y: 5.5, z: 0, squash: .68, shadeLo: .55 },
    ] },
    cards: { cx: 0, cy: 4.5, cz: 0, rad: 2.4, n: 24, size: 2.0, yJit: .75 },
  },
  e: {   // elm — vase silhouette
    trunk: { h: 5.6, r0: .34, r1: .16, branches: 5, branchLen: 2.4, lean: .02 },
    canopy: { seed: 61, blobs: [
      { r: 1.5, x: 1.7, y: 6.0, z: 0, squash: .72 },
      { r: 1.5, x: -1.7, y: 6.0, z: 0, squash: .72 },
      { r: 1.5, x: 0, y: 6.0, z: 1.7, squash: .72 },
      { r: 1.5, x: 0, y: 6.0, z: -1.7, squash: .72 },
      { r: 1.7, x: 0, y: 7.4, z: 0, squash: .75 },
    ] },
    cards: { cx: 0, cy: 6.6, cz: 0, rad: 2.4, n: 20, size: 2.0, yJit: .8 },
  },
  u: {   // columnar poplar — tight vertical stack
    trunk: { h: 4.2, r0: .26, r1: .14, branches: 3, branchLen: 1.0 },
    canopy: { seed: 71, blobs: [
      { r: 1.35, x: 0, y: 4.3, z: 0, squash: 1.15, noise: .2 },
      { r: 1.55, x: 0, y: 5.8, z: 0, squash: 1.25, noise: .2 },
      { r: 1.2, x: 0, y: 7.5, z: 0, squash: 1.2, noise: .2 },
      { r: .95, x: 0, y: 8.7, z: 0, squash: 1.05, noise: .2 },
    ] },
    cards: { cx: 0, cy: 6.0, cz: 0, rad: 1.5, n: 18, size: 1.7, yJit: 1.4 },
  },
  w: {   // willow — wide flat dome + drooping skirt of low cards
    trunk: { h: 3.9, r0: .6, r1: .34, branches: 4, branchLen: 2.0, lean: .06 },
    canopy: { seed: 83, blobs: [
      { r: 2.7, x: 0, y: 5.0, z: 0, squash: .5, shadeLo: .55 },
      { r: 1.7, x: 2.0, y: 4.4, z: .4, squash: .55, shadeLo: .5 },
      { r: 1.7, x: -2.0, y: 4.4, z: -.4, squash: .55, shadeLo: .5 },
      { r: 1.6, x: .4, y: 4.4, z: 1.9, squash: .55, shadeLo: .5 },
      { r: 1.6, x: -.4, y: 4.4, z: -1.9, squash: .55, shadeLo: .5 },
    ] },
    cards: { cx: 0, cy: 3.4, cz: 0, rad: 3.1, n: 26, size: 2.4, yJit: .5, tilt: .9 },
  },
  d: {   // dogwood — low ornamental
    trunk: { h: 2.6, r0: .3, r1: .17, branches: 3, branchLen: 1.4 },
    canopy: { seed: 91, blobs: [
      { r: 1.4, x: 0, y: 3.2, z: 0, squash: .75, shadeLo: .55 },
      { r: 1.0, x: .9, y: 3.8, z: .3, squash: .72, shadeLo: .55 },
      { r: 1.0, x: -.8, y: 3.7, z: -.4, squash: .72, shadeLo: .55 },
    ] },
    cards: { cx: 0, cy: 3.4, cz: 0, rad: 1.6, n: 14, size: 1.5, yJit: .7 },
  },
};

/* build the shared geometries + materials once */
let _kit = null;
export function vegKit() {
  if (_kit) return _kit;
  const leafM = new M({ map: leafDiffuse(), vertexColors: true,
    roughness: .92, metalness: 0 });
  const cardM = new M({ map: leafCards(), transparent: false, alphaTest: .38,
    side: THREE.DoubleSide, roughness: .9, metalness: 0,
    color: '#9fae72' });                     // neutral leaf tint; instance color multiplies
  const needleM = new M({ map: needleDiffuse(), vertexColors: true,
    roughness: .95, metalness: 0 });
  const trunkM = pbr('bark_brown_01'); trunkM.color = new THREE.Color('#8a7a68');
  const barkPaleM = pbr('bark_brown_01'); barkPaleM.color = new THREE.Color('#d9d3c9');

  const kit = {};
  for (const k of Object.keys(ARCHETYPES)) {
    const a = ARCHETYPES[k];
    kit[k] = {
      trunk: trunkGeo(a.trunk),
      canopy: a.canopy ? canopyGeo(a.canopy.blobs, a.canopy.seed) : null,
      conifer: a.conifer ? coniferGeo(a.conifer) : null,
      cards: a.cards ? fringeGeo(a.cards.cx, a.cards.cy, a.cards.cz,
        a.cards.rad, a.cards.n, a.cards.size, a.canopy ? a.canopy.seed + 7 : 1,
        a.cards) : null,
    };
  }
  _kit = { kit, leafM, cardM, needleM, trunkM, barkPaleM };
  return _kit;
}

/* shrub clump for hedges/foundation bushes — small displaced blob */
export function bushGeo() {
  return canopyGeo([
    { r: 1.0, x: 0, y: .8, z: 0, squash: .72, noise: .3 },
    { r: .7, x: .55, y: .65, z: .3, squash: .7, noise: .3 },
    { r: .7, x: -.5, y: .7, z: -.3, squash: .7, noise: .3 },
  ], 101);
}
