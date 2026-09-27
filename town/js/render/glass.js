// glass.js — sprint-03 glass/reflections v2. Render-side only: upgrades the
// cached facade materials produced by B's wallMat() without editing B files.
// Identification is texture-driven: only materials built from glassFacadeMaps
// carry map.userData.v2.glass, so brick/wood/siding facades are untouched.
import * as THREE from 'three';

const GLASS_T = {
  day:    { roughness: .12, envMapIntensity: 1.35, tint: '#f4f8fb', metalness: .06 },
  golden: { roughness: .12, envMapIntensity: 1.6,  tint: '#fff0dc', metalness: .06 },
  dusk:   { roughness: .16, envMapIntensity: .85,  tint: '#8d95a6', metalness: .05 },
  night:  { roughness: .20, envMapIntensity: .45,  tint: '#4e5c70', metalness: .05 },
};

function eachMaterial(object, fn) {
  const mats = object.material;
  if (Array.isArray(mats)) mats.forEach(fn);
  else if (mats) fn(mats);
}

export function upgradeGlassMaterials(scene, time = 'day') {
  const p = GLASS_T[time] || GLASS_T.day;
  const seen = new Set();
  let materials = 0;
  scene.traverse((o) => {
    eachMaterial(o, (m) => {
      if (!m || seen.has(m) || !m.map || !m.map.userData || !m.map.userData.v2 || !m.map.userData.v2.glass)
        return;
      seen.add(m);
      materials++;
      m.color.set(p.tint);
      m.metalness = p.metalness;
      m.envMapIntensity = p.envMapIntensity;
      // roughnessMap stays authoritative per-pane (near-mirror vision glass,
      // matte spandrel); report nominal pane roughness for probes.
      m.roughnessMap && (m.roughness = 1);
      !m.roughnessMap && (m.roughness = p.roughness);
      m.userData.glassV2 = true;
      m.needsUpdate = true;
    });
  });
  return {
    enabled: true, materials, time,
    roughness: p.roughness, envMapIntensity: p.envMapIntensity, tint: p.tint,
  };
}

export function glassProbe(info, enabled, time) {
  if (info) return info;
  const p = GLASS_T[time] || GLASS_T.day;
  return { enabled, materials: 0, time,
    roughness: p.roughness, envMapIntensity: enabled ? p.envMapIntensity : 1, tint: enabled ? p.tint : 'stock' };
}
