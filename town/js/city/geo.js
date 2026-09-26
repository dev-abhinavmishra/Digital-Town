// city/geo.js — geometry collector: merges static parts into one mesh per
// material. Moved verbatim from details.js so streetscape + greens share it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class GeoBin {
  constructor() { this.b = new Map(); }
  add(geo, material, x, y, z, { rx = 0, ry = 0, rz = 0 } = {}) {
    const g = geo.clone();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    let b = this.b.get(material);
    if (!b) { b = []; this.b.set(material, b); }
    b.push(g);
  }
  plane(w, d, material, x, y, z, ry = 0) {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2); if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    let b = this.b.get(material);
    if (!b) { b = []; this.b.set(material, b); }
    b.push(g);
  }
  // box with center at (x, yBase+h/2, z) — y given as the BASE
  box(w, h, d, material, x, yBase, z, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, yBase + h / 2, z);
    let b = this.b.get(material);
    if (!b) { b = []; this.b.set(material, b); }
    b.push(g);
  }
  build(scene, { shadows = false } = {}) {
    for (const [material, geos] of this.b) {
      const merged = mergeGeometries(geos.map(g => g.index ? g.toNonIndexed() : g), false);
      const mesh = new THREE.Mesh(merged, material);
      mesh.receiveShadow = true;
      if (shadows) mesh.castShadow = true;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      geos.forEach(g => g.dispose());
    }
    this.b.clear();
  }
}
