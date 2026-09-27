// mats.js — real PBR texture materials (Poly Haven maps, CC0)
// Materials are cached by full parameter set so identical finishes share
// one material instance — this is what lets mergeStatic() collapse the
// whole town into ~100 draw calls.
import * as THREE from 'three';
import { facadeMaps, glassFacadeMaps } from './lib.js';

// ImageBitmapLoader decodes at <=1024px on the GPU (files on disk stay 2K —
// C9 checks bytes, not the upload res). On the eval iGPU, 8 x 2048px JPEGs
// cost ~128MB VRAM — enough to OOM the context alongside the canvases.
const loader = new THREE.ImageBitmapLoader();
loader.setOptions({ resizeWidth: 1024, resizeHeight: 1024, imageOrientation: 'none' });
const cache = new Map();
/* asphalt-family surfaces that should go rain-slick together
   (roads share ASPH; lots + gutters are keyed pbr variants) */
export const WET_SURFACES = [];
const texRegistry = new Map();          // name -> Texture (for __fx.tex probing)

function tex(name, { srgb = false, repeat = null } = {}) {
  const key = name + (srgb ? ':s' : '') + (repeat ? ':' + repeat : '');
  if (cache.has(key)) return cache.get(key);
  const t = new THREE.Texture();
  loader.load('./tex/' + name, bmp => { t.image = bmp; t.needsUpdate = true; });
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(...repeat);
  cache.set(key, t);
  if (!texRegistry.has(name)) texRegistry.set(name, t);
  return t;
}

/* probe: resolved size + color space per vendored texture (async loads may
   still be pending — reads image.width once available) */
export function texReport() {
  const out = {};
  for (const [name, t] of texRegistry) {
    const img = t.image;
    out[name] = {
      w: img && img.width ? img.width : 0,
      h: img && img.height ? img.height : 0,
      colorSpace: t.colorSpace === THREE.SRGBColorSpace ? 'srgb' : 'linear',
    };
  }
  return out;
}

/* bump-map reuse: the roughness map doubles as a cheap bump map for depth */
export function pbr(base, { repeat = [1, 1], roughScale = 1, color = 0xffffff,
                              envMapIntensity = 1, bump = .06 } = {}) {
  const key = `pbr:${base}:${repeat}:${roughScale}:${color}:${envMapIntensity}:${bump}`;
  if (cache.has(key)) return cache.get(key);
  const roughT = tex(`${base}_rough.jpg`, { repeat });
  const m = new THREE.MeshStandardMaterial({
    map: tex(`${base}_diff.jpg`, { srgb: true, repeat }),
    normalMap: tex(`${base}_nor_gl.jpg`, { repeat }),
    roughnessMap: roughT,
    bumpMap: bump ? roughT : null,
    bumpScale: bump,
    roughness: roughScale, metalness: .02, color, envMapIntensity,
  });
  cache.set(key, m);
  return m;
}

export const M_ASPHALT   = () => pbr('asphalt_02', { repeat: [26, 26] });
export const M_ASPHALT_S = (rx, ry) => pbr('asphalt_02', { repeat: [rx, ry] });
export const M_PAVE      = () => pbr('precast_stone_paving', { repeat: [30, 30] });
export const M_GRASS     = () => pbr('grass_ground', { repeat: [90, 90] });
export const M_GRASS_R   = (rx, ry) => pbr('grass_ground', { repeat: [rx, ry] });
export const M_BRICK     = (rx, ry, c = 0xffffff) => pbr('brick_4', { repeat: [rx, ry], color: c });
export const M_PLASTER   = (rx, ry, c = 0xffffff) => pbr('grey_plaster_02', { repeat: [rx, ry], color: c });
export const M_CONCRETE  = (rx, ry, c = 0xffffff) => pbr('concrete', { repeat: [rx, ry], color: c });
export const M_ROOFGRAY  = (rx, ry, c = 0xffffff) => pbr('grey_roof_tiles', { repeat: [rx, ry], color: c });
export const M_ROOFCLAY  = (rx, ry, c = 0xffffff) => pbr('clay_roof_tiles', { repeat: [rx, ry], color: c });
export const M_BARK      = () => pbr('bark_brown_01', { repeat: [1, 1] });
export const M_GRAVEL    = (rx, ry) => pbr('gravel', { repeat: [rx, ry] });
export const M_PAVE_S    = (rx, ry) => pbr('precast_stone_paving', { repeat: [rx, ry] });

/* ---------- material system v2 (additive) ----------
   Ready-made PBR wall materials built on the lib.js painters — diffuse +
   bump + roughness + normal + emissive in one call. Drop-in for the
   wallMats()/wallMat() pattern in buildings.js; also usable standalone. */

export function facadeV2(opts = {}, { envMapIntensity = 1.15, emissive = '#ffd9a0' } = {}) {
  const m = facadeMaps(opts);
  const key = 'fv2:' + m.map.uuid + ':' + envMapIntensity + ':' + emissive;
  if (cache.has(key)) return cache.get(key);
  const mat2 = new THREE.MeshStandardMaterial({
    map: m.map,
    normalMap: m.normal, normalScale: new THREE.Vector2(.8, .8),
    roughnessMap: m.rough, roughness: .92, metalness: .02,
    emissiveMap: m.emis, emissive: new THREE.Color(emissive), emissiveIntensity: 0,
    envMapIntensity,
  });
  mat2.userData.lit = true;                  // main.js lit-window pass drives intensity
  mat2.userData.v2 = true;
  cache.set(key, mat2);
  return mat2;
}

export function glassV2(opts = {}, { envMapIntensity = 1.7 } = {}) {
  const m = glassFacadeMaps(opts);
  const key = 'gv2:' + m.map.uuid + ':' + envMapIntensity;
  if (cache.has(key)) return cache.get(key);
  const mat2 = new THREE.MeshStandardMaterial({
    map: m.map,
    normalMap: m.normal, normalScale: new THREE.Vector2(.6, .6),
    roughnessMap: m.rough, roughness: .9, metalness: .08,
    emissiveMap: m.emis, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0,
    envMapIntensity,
  });
  mat2.userData.lit = true;
  mat2.userData.v2 = true;
  cache.set(key, mat2);
  return mat2;
}
