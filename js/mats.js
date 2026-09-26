// mats.js — real PBR texture materials (Poly Haven maps, CC0)
// Materials are cached by full parameter set so identical finishes share
// one material instance — this is what lets mergeStatic() collapse the
// whole town into ~100 draw calls.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();

function tex(name, { srgb = false, repeat = null } = {}) {
  const key = name + (srgb ? ':s' : '') + (repeat ? ':' + repeat : '');
  if (cache.has(key)) return cache.get(key);
  const t = loader.load('./tex/' + name);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(...repeat);
  cache.set(key, t);
  return t;
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
