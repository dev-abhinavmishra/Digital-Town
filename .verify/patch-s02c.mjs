import fs from 'fs';
const p = 'C:/Users/pmsma/Downloads/HST Digital Town Project/town/js/details.js';
let src = fs.readFileSync(p, 'utf8');

const rep = (oldStr, newStr) => {
  if (!src.includes(oldStr)) { console.error('ANCHOR MISSING:', JSON.stringify(oldStr.slice(0, 60))); process.exit(1); }
  src = src.replace(oldStr, newStr);
};

// 0) need FILLER for storefront signs
rep(`import { ROADS, LOTS, WATER, PARK_ZONE, BUILDINGS, APARTMENTS,
         HOUSE_BLOCKS } from './layout.js';`,
`import { ROADS, LOTS, WATER, PARK_ZONE, BUILDINGS, APARTMENTS,
         HOUSE_BLOCKS, FILLER } from './layout.js';`);

// 1) shelters: extend 2 -> 6 (on sidewalk bands of Commerce & University)
rep(`  // bus stop shelters (2)
  for (const [x, z, ry] of [[-140, -345, 0], [310, 305, Math.PI]]) {`,
`  // bus stop shelters on Commerce Blvd & University Ave
  for (const [x, z, ry] of [[-140, -345, 0], [310, 305, Math.PI],
      [-128.4, -260, 0], [-151.6, 60, Math.PI], [-300, 307.4, Math.PI], [100, 332.6, 0]]) {`);

// 2) big furniture + signs + hedges insert before propMesh merge
rep(`  const propMesh = new THREE.Mesh(colored(parts), VCOL());`,
`  /* ---- sprint-02: sidewalk furniture scatter ----
     cycle: bench | hydrant | bin | planter | bin | bench | newsbox | bollards
     all on the walk band, occupancy-checked, never on crossing/ramp landings */
  const allJ = intersections();
  const nearJxn = (x, z) => allJ.some(j =>
    Math.abs(x - j.x) < j.wv / 2 + 10 && Math.abs(z - j.z) < j.wh / 2 + 10);
  let nFurn = 0, nPlanters = 0, nHedges = 0;
  const SHRUB = new THREE.IcosahedronGeometry(.55, 0);
  const addFurn = (x, z, ry, kind) => {
    nFurn++;
    if (kind === 0 || kind === 5) {           // bench facing street
      const bx = new THREE.BoxGeometry(1.8, .09, .5).rotateY(ry);
      const bk = new THREE.BoxGeometry(1.8, .5, .09).rotateY(ry);
      const off = .28;
      parts.push({ geo: bx, color: '#7a5a3a', x, y: .55, z });
      parts.push({ geo: bk, color: '#7a5a3a', x: x + Math.sin(ry) * off, y: .95, z: z + Math.cos(ry) * off });
      parts.push({ geo: new THREE.BoxGeometry(.09, .5, .45).rotateY(ry), color: '#3d4145', x: x - .7 * Math.cos(ry), y: .3, z: z + .7 * Math.sin(ry) });
      parts.push({ geo: new THREE.BoxGeometry(.09, .5, .45).rotateY(ry), color: '#3d4145', x: x + .7 * Math.cos(ry), y: .3, z: z - .7 * Math.sin(ry) });
    } else if (kind === 1) {                  // hydrant
      parts.push({ geo: new THREE.CylinderGeometry(.2, .24, .85, 8), color: '#c0392b', x, y: .42, z });
      parts.push({ geo: new THREE.CylinderGeometry(.09, .09, .28, 8), color: '#c0392b', x, y: .96, z });
      parts.push({ geo: new THREE.SphereGeometry(.11, 8, 6), color: '#e8b13a', x, y: 1.12, z });
    } else if (kind === 2 || kind === 4) {    // litter bin
      parts.push({ geo: new THREE.CylinderGeometry(.38, .32, .95, 10), color: '#3d4a42', x, y: .47, z });
      parts.push({ geo: new THREE.CylinderGeometry(.4, .4, .07, 10), color: '#2c3531', x, y: .98, z });
    } else if (kind === 3) {                  // sidewalk planter + shrub
      nPlanters++;
      parts.push({ geo: new THREE.BoxGeometry(1.3, .75, 1.3), color: '#6e5138', x, y: .37, z });
      parts.push({ geo: new THREE.BoxGeometry(1.1, .08, 1.1), color: '#4a3527', x, y: .72, z });
      parts.push({ geo: SHRUB, color: '#4e6b3e', x, y: 1.15, z });
    } else if (kind === 6) {                  // newspaper box
      parts.push({ geo: new THREE.BoxGeometry(.55, 1.0, .5), color: '#8a2f2f', x, y: .55, z });
      parts.push({ geo: new THREE.BoxGeometry(.5, .12, .45), color: '#e8e6df', x, y: 1.12, z });
    } else {                                  // bollard trio at walk edge
      for (const d of [-1.2, 0, 1.2])
        parts.push({ geo: new THREE.CylinderGeometry(.09, .11, .95, 8), color: '#4a4f52',
          x: x + Math.cos(ry) * d, y: .48, z: z - Math.sin(ry) * d });
    }
  };
  for (const r of ROADS) {
    const step = r.arterial ? 30 : 38;
    const walkOff = r.w / 2 + (r.arterial ? 2.5 : 2.1);   // inside sidewalk, off curb face
    let k = 0;
    for (let a = r.a0 + 20; a < r.a1 - 20; a += step + rr(-4, 4)) {
      for (const s of [-1, 1]) {
        const x = r.axis === 'v' ? r.c + walkOff * s : a;
        const z = r.axis === 'v' ? a : r.c + walkOff * s;
        if (nearJxn(x, z) || !isFree(x, z, .9) || R() > .62) continue;
        const ry = r.axis === 'v' ? (s > 0 ? Math.PI / 2 : -Math.PI / 2) : (s > 0 ? 0 : Math.PI);
        addFurn(x, z, ry, k++ % 8);
      }
    }
  }

  /* ---- storefront blade signs + awning bands on signable FILLER ---- */
  const SIGN_TEXT = ['CAFE', 'SHOP', 'MARKET', 'BOOKS', 'BAKERY', 'CLINIC',
                     'DINER', 'PHARMACY', 'BARBER', 'DELI', 'FLORIST', 'MART'];
  let nSigns = 0;
  FILLER.filter(f => f.type === 'storefront' || f.type === 'medoffice' || f.type === 'gas')
    .slice(0, 14).forEach((f, fi) => {
      const rot = f.rot || 0;
      const fx = Math.sin(rot), fz = Math.cos(rot);            // facade normal
      const rx = Math.cos(rot), rz = -Math.sin(rot);           // along-facade right
      // awning band over the entrance
      parts.push({ geo: new THREE.BoxGeometry(f.w * .7, .35, 1.3).rotateY(rot),
        color: pick(['#33526b', '#7a3030', '#3e5a34', '#6e5138']),
        x: f.x + fx * (f.d / 2 + .65), y: 3.15, z: f.z + fz * (f.d / 2 + .65) });
      // blade sign at the front corner, plane parallel to street direction
      const sx = f.x + rx * (f.w / 2 - 1.2) + fx * (f.d / 2 + .7);
      const sz = f.z + rz * (f.w / 2 - 1.2) + fz * (f.d / 2 + .7);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, .95, .1),
        new M({ map: signTexture(SIGN_TEXT[fi % SIGN_TEXT.length], '#2f3d4a', '#e8e6df') }));
      sign.position.set(sx, 4.4, sz); sign.rotation.y = rot + Math.PI / 2;
      sign.castShadow = true; scene.add(sign);
      nSigns++;
    });

  /* ---- hedges along building frontages (downtown + civic) ---- */
  for (const b of BUILDINGS) {
    if (!b.w || b.type === 'zone' || b.type === 'parkzone') continue;
    if (b.x < -170 || b.x > 340 || b.z < -350 || b.z > -40) continue;   // downtown bounds
    const hl = Math.min(9, b.w * .22);
    for (const sx of [-1, 1]) {
      nHedges++;
      parts.push({ geo: new THREE.BoxGeometry(hl, .85, .8), color: '#3e5a34',
        x: b.x + sx * (b.w / 2 - hl / 2 - .5), y: .42, z: b.z + b.d / 2 + .9 });
    }
  }
  // hedge runs along townhouse rows too
  for (const f of FILLER) {
    if (f.type !== 'townhouse') continue;
    nHedges++;
    parts.push({ geo: new THREE.BoxGeometry(f.w * .55, .8, .7), color: '#46603a',
      x: f.x, y: .4, z: f.z + f.d / 2 + .8 });
  }

  if (window.__city) {
    window.__city.props = {
      furniture: nFurn, signals: ix.length, shelters: 6, signs: nSigns,
    };
    window.__city.veg = { hedges: nHedges, planters: nPlanters };
  }

  const propMesh = new THREE.Mesh(colored(parts), VCOL());`);

fs.writeFileSync(p, src);
console.log('patch-s02c applied');
