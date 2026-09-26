// env.js — image-based lighting for the town
// Loads the vendored Poly Haven HDRI for the current time-of-day and PMREMs it
// into scene.environment. The visible sky stays the procedural skyTexture()
// (sun disc always matches the directional light); the HDRI only feeds PBR
// reflections + ambient IBL. Falls back to PMREM of the procedural sky on any
// load/decode failure — no runtime network dependency.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const HDR_BY_TIME = {
  day:    { src: './tex/sky_day_2k.hdr',  intensity: 0.85 },
  golden: { src: './tex/sky_gold_2k.hdr', intensity: 0.95 },
  dusk:   { src: './tex/sky_gold_2k.hdr', intensity: 0.42 },
};

/* resolves to { envType:'hdr'|'fallback', envSrc, envIntensity, texture } */
export function loadEnvironment(renderer, { mode = 'day', skyTex } = {}) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const spec = HDR_BY_TIME[mode] || HDR_BY_TIME.day;
  const fallback = () => {
    const t = pmrem.fromEquirectangular(skyTex).texture;
    return { envType: 'fallback', envSrc: 'procedural-sky', envIntensity: mode === 'golden' ? .9 : .8, texture: t };
  };
  return new Promise(resolve => {
    new RGBELoader().load(spec.src, hdr => {
      try {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const tex = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        resolve({ envType: 'hdr', envSrc: spec.src.split('/').pop(),
                  envIntensity: spec.intensity, texture: tex });
      } catch (e) { resolve(fallback()); }
    }, undefined, () => resolve(fallback()));
  });
}
