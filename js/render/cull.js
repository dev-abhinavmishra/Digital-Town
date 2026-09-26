// cull.js — sprint-03 near-camera transient occluder cull. Render-side only:
// finds B's animated bird InstancedMesh by geometry signature and zero-scales
// instances that dominate a still frame. B's tickWorld rewrites every instance
// matrix each frame, so this pass runs after it and needs no restore logic.
import * as THREE from 'three';

const MIN_DIST = 30;      // metres — contract-bound
const MAX_FRAC = .03;     // projected height fraction — contract-bound

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);

function isTransientOccluder(o) {
  // bird chevron InstancedMesh: 2 triangles (6 vertices), frustumCulled=false,
  // small flock count. Deliberately excludes clouds (Sprites, not instanced)
  // and static IMs (trees/cars/people/lamps all differ in vertex count or are
  // legitimately frustum-culled scene content).
  return !!o.isInstancedMesh && o.frustumCulled === false &&
    !!o.geometry && !!o.geometry.attributes.position &&
    o.geometry.attributes.position.count === 6 &&
    o.count > 0 && o.count <= 64;
}

// projected vertical fraction of the frame for an instance's bounding span
function screenFraction(o, i, camera, dist) {
  o.getMatrixAt(i, _m);
  _s.setFromMatrixColumn(_m, 0);
  const sx = _s.length();
  _s.setFromMatrixColumn(_m, 1);
  const sy = _s.length();
  _s.setFromMatrixColumn(_m, 2);
  const sz = _s.length();
  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
  const r = o.geometry.boundingSphere.radius * Math.max(sx, sy, sz);
  const h = r * 2;
  if (camera.isPerspectiveCamera) {
    if (dist <= 0) return 1;
    return h * camera.projectionMatrix.elements[5] / (2 * dist);
  }
  if (camera.isOrthographicCamera)
    return h * camera.projectionMatrix.elements[5] / 2;
  return 0;
}

export function createOccluderCull(scene) {
  const targets = [];
  scene.traverse((o) => { if (isTransientOccluder(o)) targets.push(o); });
  const state = { targets: targets.length, squashed: 0 };
  return {
    state,
    tick(camera) {
      let n = 0;
      for (const o of targets) {
        let dirty = false;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, _m);
          _p.setFromMatrixPosition(_m);
          const dist = _p.distanceTo(camera.position);
          const frac = screenFraction(o, i, camera, dist);
          if (dist < MIN_DIST || frac > MAX_FRAC) {
            _m.decompose(_p, _q, _s);
            _m.compose(_p, _q, _zero);
            o.setMatrixAt(i, _m);
            dirty = true; n++;
          }
        }
        if (dirty) o.instanceMatrix.needsUpdate = true;
      }
      state.squashed = n;
    },
  };
}

export const OCCLUDER_CULL = { minDist: MIN_DIST, maxFrac: MAX_FRAC };
