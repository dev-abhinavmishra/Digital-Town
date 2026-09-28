// city/hero.js — sprint-03 landmark & wayfinding placements (Generator B).
// Ground-placed hero structures: hospital gateway pylon, university quad
// monument, park bandshell pavilion, park-entry totems, wayfinding posts/boards.
// Building-attached hero content (helipad kit, mall portal, crowns, entrances)
// lives in buildings.js; both sides record leaves into CITY.hero so every
// claim verifies as {placed, parts, pos}.
// Called once at the tail of buildLights() in details.js — after ALL occupancy
// is registered, before tree/vehicle/people scatter, so our occupyRects keep
// later scatter off the structures.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CITYHALL_B64 } from '../../assets/cityhall.js';
import { WATERTOWER_B64 } from '../../assets/watertower.js';
import { CONSERVATORY_B64 } from '../../assets/conservatory.js';
import { box, cyl, plane, mat, signTexture, colored, VCOL, R, rr, pick, RUNENV } from '../lib.js';
import { pbr } from '../mats.js';
import { ROADS } from '../layout.js';
import { occupyRect, isFree } from './occ.js';
import { makeBuilding } from '../buildings.js';
import { heroLeaf, wayItem } from './stats.js';

const M = THREE.MeshStandardMaterial;
const Y = 0.28;   // surface lift — matches details.js

const PAVEH = pbr('precast_stone_paving'); PAVEH.color = new THREE.Color('#a39c90');
const STONE = () => mat('#8d949a');
const TRIM = () => mat('#e8e2d4');
const STEEL = () => mat('#7d868c');
const HRED = () => mat('#b03a2e');
const WOOD = () => mat('#7a5c3e');

const rd = n => ROADS.find(r => r.name === n);

function texPanel(text, w, h, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new M({ map: signTexture(text, opts), roughness: .7 }));
  return m;
}

/* ---------- A1a — hospital campus gateway pylon ----------
   Monument sign at the Mercy Dr terminus / Wellness Way approach, on the
   campus (north) side. Amendment 4: sited clear of BOTH the Mercy Dr road band
   AND the ER-apron rect — candidates shrink stepwise until isFree passes. */
function buildPylon(scene) {
  const cands = [[98, -380], [104, -382], [94, -386], [108, -378], [98, -388]];
  let site = null;
  for (const [x, z] of cands) if (isFree(x, z, 4.6)) { site = [x, z]; break; }
  if (!site) return 0;
  const [x, z] = site;
  const g = new THREE.Group();
  let n = 0;
  const add = m => { g.add(m); n++; };
  // plinth + twin piers + cap beam
  add(box(7.6, .8, 2.4, STONE(), 0, 0, 0));
  for (const px of [-3.15, 3.15]) add(box(1.15, 8.4, 1.7, STONE(), px, .8, 0));
  add(box(7.5, .5, 2.1, TRIM(), 0, 9.2, 0));
  // header panel + ER blade, both faces
  for (const s of [1, -1]) {
    const head = texPanel('HAVENBROOK GENERAL', 7.2, 2.5,
      { bg: '#b03a2e', font: 'bold 46px Arial' });
    head.position.set(0, 7.1, s * 1.0); head.rotation.y = s < 0 ? Math.PI : 0;
    add(head);
    const er = texPanel('EMERGENCY  \u2192', 6.6, 1.45,
      { bg: '#20313d', fg: '#ffd23e', font: 'bold 52px Arial' });
    er.position.set(0, 4.35, s * 1.0); er.rotation.y = s < 0 ? Math.PI : 0;
    add(er);
  }
  // low wing walls + uplight stubs
  for (const sx of [-1, 1]) {
    add(box(2.7, 1.15, 1.25, TRIM(), sx * 4.75, 0, 0));
    add(cyl(.12, .12, .9, STEEL(), sx * 2.2, 0, 1.9, 6));
  }
  g.position.set(x, Y, z);
  g.rotation.y = .22;          // angle the face slightly toward the SW junction
  scene.add(g);
  occupyRect(x, z, 8.6, 3.4, 1);
  heroLeaf('hospital', 'pylon', n, [x, z]);
}

/* ---------- A2 — university quad landmark ----------
   Focal obelisk monument on a paved medallion at the quad center, 3 static
   flag poles, 4 radial paving paths to medhall / south lot / both halls. */
function buildQuad(scene) {
  const cx = -480, cz = -532;
  if (!isFree(cx, cz, 10)) return;
  const g = new THREE.Group();
  let n = 0;
  const add = m => { g.add(m); n++; };
  // paved medallion + 4 radial path reads (shared PAVEH → merges)
  const med = new THREE.Mesh(new THREE.CircleGeometry(9.6, 36), PAVEH);
  med.rotation.x = -Math.PI / 2; med.position.set(cx, Y + .07, cz); med.receiveShadow = true;
  add(med);
  const paths = [
    plane(3.6, 34, PAVEH, cx, Y + .06, -550),          // N → medhall steps
    plane(3.6, 30, PAVEH, cx, Y + .06, -502),          // S → quad lot
    plane(84, 3.6, PAVEH, -430, Y + .06, cz),          // E → clinical sciences
    plane(84, 3.6, PAVEH, -530, Y + .06, cz),          // W → anatomy hall
  ];
  paths.forEach(add);
  // 3-step base + obelisk + pyramid cap + brass plaque
  add(cyl(5.4, 5.9, .55, STONE(), cx, Y, cz, 24));
  add(cyl(4.3, 5.0, .5, STONE(), cx, Y + .55, cz, 24));
  add(cyl(3.2, 3.9, .5, STONE(), cx, Y + 1.05, cz, 24));
  add(box(1.75, 7.2, 1.75, mat('#cfc8b8'), cx, Y + 1.55, cz));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.15, 4), mat('#8a6a3a', { metalness: .5, roughness: .45 }));
  cap.position.set(cx, Y + 9.35, cz); cap.rotation.y = Math.PI / 4; cap.castShadow = true;
  add(cap);
  const plaque = texPanel('HAVENBROOK\nSCHOOL OF MEDICINE', 3.4, 1.15,
    { bg: '#4a3428', fg: '#e8d9a8', font: 'bold 40px Georgia', h: 128 });
  plaque.position.set(cx, Y + 1.15, cz + 4.35); plaque.rotation.x = -.18;
  add(plaque);
  // benches ringing the medallion (one merged colored mesh)
  const bp = [];
  for (const a of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {
    const bx = cx + Math.cos(a) * 12.4, bz = cz + Math.sin(a) * 12.4;
    bp.push({ geo: new THREE.BoxGeometry(2.6, .14, .65), color: '#7a5c3e', x: bx, y: Y + .62, z: bz, ry: -a });
    for (const lx of [-1, 1])
      bp.push({ geo: new THREE.BoxGeometry(.18, .5, .55), color: '#3a3f43',
        x: bx + lx * Math.cos(a), y: Y + .3, z: bz + lx * Math.sin(a), ry: -a });
  }
  const bm = new THREE.Mesh(colored(bp), VCOL());
  bm.castShadow = bm.receiveShadow = true;
  add(bm);
  // 3 flag poles — contract-declared STATIC flags (rigid cloth, no animator)
  const flagCols = ['#2e5b8a', '#8a2e2e', '#e8e2d4'];
  [[-493, -531], [-467, -531], [-480, -546]].forEach(([fx, fz], i) => {
    add(cyl(.07, .1, 9.6, STEEL(), fx, Y, fz, 8));
    const fl = box(1.9, 1.0, .07, mat(flagCols[i]), fx + 1.0, Y + 8.3, fz);
    fl.rotation.z = .1; add(fl);
    add(cyl(.14, .14, .3, mat('#d4ac0d', { metalness: .6, roughness: .4 }), fx, Y + 9.6, fz, 8));
  });
  scene.add(g);
  occupyRect(cx, cz, 21, 21, 1);
  heroLeaf('quad', null, n, [cx, cz]);
}

/* ---------- A5 — Willow Creek bandshell pavilion ----------
   Signature open-air bandshell east of the main pond: paved plaza, raised
   stage platform, half-shell backdrop, cantilevered canopy. Faces west toward
   the pond/lawn. Then the two park-entry totems. */
function buildPavilion(scene) {
  const px = 700, pz = 170;
  if (isFree(px, pz, 9.6)) {
    const g = new THREE.Group();
    let n = 0;
    const add = m => { g.add(m); n++; };
    // plaza disc + stage platform
    const disc = new THREE.Mesh(new THREE.CircleGeometry(10.5, 40), PAVEH);
    disc.rotation.x = -Math.PI / 2; disc.position.set(0, Y + .05, 0); disc.receiveShadow = true;
    add(disc);
    // half-shell backdrop covering local +z (maps to world +x = east)
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(6.4, 6.4, 5.6, 28, 1, true, -Math.PI / 2, Math.PI),
      mat('#8a5a4a', { side: THREE.DoubleSide }));
    shell.position.set(0, Y + .6 + 2.8, 0); shell.castShadow = true;
    add(shell);
    const shellIn = new THREE.Mesh(
      new THREE.CylinderGeometry(5.9, 5.9, 5.2, 28, 1, true, -Math.PI / 2, Math.PI),
      mat('#c8b9a0', { side: THREE.DoubleSide }));
    shellIn.position.set(0, Y + .6 + 2.75, 0);
    add(shellIn);
    // stage platform under the shell + front/rear columns + canopy
    add(cyl(6.6, 6.9, .55, STONE(), 0, Y + .05, .8, 28));
    for (const [cx2, cz2] of [[-4.6, -6.2], [4.6, -6.2], [-5.6, 2.8], [5.6, 2.8]])
      add(cyl(.28, .32, 6.3, TRIM(), cx2, Y + .6, cz2, 10));
    const roof = box(12.6, .55, 13.6, mat('#4f4231'), 0, Y + 7.0, -1);
    roof.rotation.x = .07; add(roof);
    add(box(12.9, .3, 13.9, mat('#6d6152'), 0, Y + 7.55, -1));
    const band = texPanel('WILLOW CREEK PAVILION', 9.5, 1.15,
      { bg: '#4f4231', fg: '#e8d9a8', font: 'bold 44px Georgia' });
    band.position.set(0, Y + 6.6, -8.6); band.rotation.y = Math.PI;
    add(band);
    // stage steps + flanking planters on the open (-z → west) edge
    add(box(4.5, .32, 3.2, STONE(), 0, Y + .05, -8.2));
    add(box(4.5, .22, 2.4, STONE(), 0, Y + .37, -8.6));
    for (const pz2 of [-7.6, 7.6]) {
      add(cyl(1.15, 1.3, .9, mat('#6a5138'), -4.5, Y + .05, pz2, 12));
      add(cyl(.9, .7, 1.1, mat('#3f6b3a'), -4.5, Y + .95, pz2, 8));
    }
    g.position.set(px, 0, pz);
    g.rotation.y = Math.PI / 2;     // shell → east, stage opens west toward pond
    scene.add(g);
    occupyRect(px, pz, 22, 22, 1);
    heroLeaf('park', 'pavilion', n, [px, pz]);
  }

  // park-entry totems: Parkside Dr approach (west edge verge) + Commerce Blvd
  const totems = [];
  const totem = (tx, tz, ry) => {
    if (!isFree(tx, tz, 1.8)) return;
    const g = new THREE.Group();
    let n = 0;
    const add = m => { g.add(m); n++; };
    add(cyl(.42, .5, .5, STONE(), 0, Y, 0, 10));
    add(box(.7, 4.6, .34, mat('#4f6b52'), 0, Y + .5, 0));
    const t = texPanel('WILLOW\nCREEK\nPARK', 1.5, 2.5,
      { bg: '#4f6b52', fg: '#e8e2d4', font: 'bold 44px Georgia', h: 256 });
    t.position.set(0, Y + 2.6, .2); add(t);
    const t2 = t.clone(); t2.rotation.y = Math.PI; t2.position.z = -.2; add(t2);
    add(box(.9, .3, .5, TRIM(), 0, Y + 5.1, 0));
    g.position.set(tx, 0, tz); g.rotation.y = ry;
    scene.add(g);
    totems.push({ pos: [tx, tz], parts: n });
    wayItem('totem', [tx, tz]);
  };
  totem(344, 148, Math.PI / 2 + .15);    // Parkside Dr approach, faces west
  totem(560, 298, Math.PI);              // Commerce Blvd approach, faces south
  if (totems.length)
    heroLeaf('park', 'totems', totems.reduce((a, t) => a + t.parts, 0),
      totems.map(t => t.pos), totems.length);
}

/* ---------- B2 — wayfinding kit ----------
   Finger posts (pole + directional blades) at corner walks — same sidewalk-
   band exemption class as s02 furniture (skip only their adjacent roads).
   Map boards on open ground verify with full isFree. */
function buildWayfinding(scene) {
  const steel = STEEL();
  const finger = (x, z, ry, blades, skip) => {
    if (!isFree(x, z, 1.2, skip)) return;
    const g = new THREE.Group();
    g.add(cyl(.08, .1, 3.6, steel, 0, Y, 0, 8));
    g.add(cyl(.13, .13, .18, mat('#d4ac0d'), 0, Y + 3.6, 0, 8));
    blades.forEach(([txt, bh, byaw], i) => {
      const b = texPanel(txt, 2.6, .55, { bg: '#2f4a3a', font: 'bold 44px Arial', border: false });
      b.position.set(0, Y + 2.15 + i * .55, .1);
      b.rotation.y = byaw || 0;
      const b2 = b.clone(); b2.rotation.y = (byaw || 0) + Math.PI; b2.position.z = -.1;
      g.add(b, b2);
    });
    g.position.set(x, 0, z); g.rotation.y = ry;
    scene.add(g);
    wayItem('finger', [x, z]);
  };
  const board = (x, z, ry, title, lines) => {
    if (!isFree(x, z, 1.4)) return;
    const g = new THREE.Group();
    for (const px of [-1.5, 1.5]) g.add(cyl(.09, .11, 2.9, steel, px, Y, 0, 8));
    const panel = texPanel(title + '\n' + lines.join('\n'), 3.8, 2.3,
      { bg: '#20313d', fg: '#cfe0ea', font: 'bold 40px Arial', h: 192 });
    panel.position.set(0, Y + 1.9, .12); g.add(panel);
    const p2 = panel.clone(); p2.rotation.y = Math.PI; p2.position.z = -.12; g.add(p2);
    g.add(box(4.0, .3, .5, TRIM(), 0, Y + 3.15, 0));
    g.position.set(x, 0, z); g.rotation.y = ry;
    scene.add(g);
    wayItem('board', [x, z]);
  };

  finger(104, -350.5, .3, [['HOSPITAL  \u2191', 0, 0], ['ER ENTRANCE  \u2191', 0, 0], ['EMS STN  \u2190', 0, -.5]],
    [rd('Mercy Dr'), rd('Wellness Way')]);
  finger(-150, -625, 2.9, [['MED SCHOOL  \u2192', 0, 0], ['THE QUAD  \u2192', 0, 0], ['CLINIC  \u2190', 0, .6]],
    [rd('University Ave'), rd('Campus Dr')]);
  finger(-448, -171, .1, [['MIDTOWN  \u2192', 0, 0], ['SCHOLAR CT  \u2193', 0, Math.PI / 2], ['DOWNTOWN  \u2190', 0, 0]],
    [rd('Scholar Ln'), rd('Midtown Ave')]);
  finger(-121, -57, -.2, [['DOWNTOWN  \u2192', 0, Math.PI / 2], ['MAIN ST SHOPS  \u2193', 0, 0], ['CAMPUS  \u2190', 0, Math.PI / 2]],
    [rd('University Ave'), rd('Main St')]);
  finger(-157, 303, .2, [['COMMONS MALL  \u2192', 0, Math.PI / 2], ['WILLOW PARK  \u2192', 0, Math.PI / 2], ['SCHOOL  \u2190', 0, 0]],
    [rd('University Ave'), rd('Commerce Blvd')]);
  board(390, 428, .35, 'HAVENBROOK COMMONS', ['FOOD COURT  \u2192', 'NORTH ENTRY  \u2192', 'PARKING  \u2190']);
  board(52, -203, 0, 'CIVIC PLAZA', ['MUSEUM  \u2192', 'POST OFFICE  \u2190', 'HEALTH DEPT  \u2191']);
  finger(95, 302, -.15, [['GROVE ST  \u2193', 0, Math.PI / 2], ['SCHOOLHOUSE  \u2192', 0, Math.PI / 2], ['COMMERCE  \u2193', 0, 0]],
    [rd('Grove St'), rd('Commerce Blvd')]);
  finger(-157, -376, .2, [['UNIVERSITY  \u2193', 0, Math.PI / 2], ['MEDICAL DIST  \u2192', 0, Math.PI / 2], ['EMS  \u2190', 0, Math.PI / 2]],
    [rd('University Ave'), rd('Wellness Way')]);
}

/* A6 — Havenbrook City Hall: Blender-authored glTF landmark anchoring the
   east end of the civic plaza, colonnade + pediment facing the fountain.
   Footprint occupies synchronously so scatter stays clear; the mesh streams
   in async and picks up the same env/lit gains via RUNENV (the one-shot
   material pass in main.js has already run by then). */
function buildCityHall(scene) {
  const CX = 118, CZ = -205;
  occupyRect(CX, CZ, 40, 38, 1);
  const add = g => {
    const hall = g.scene;
    hall.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.name === 'glass_lit') {
          m.emissive = new THREE.Color('#ffd9a0');
          m.emissiveIntensity = RUNENV.litI;
          m.userData.lit = true;
        }
        if (m.isMeshStandardMaterial) m.envMapIntensity *= RUNENV.envScale;
      }
    });
    hall.position.set(CX, Y - .02, CZ);   // base sits on the plaza paving
    hall.rotation.y = Math.PI / 2;        // model -Z front -> world -X (fountain)
    scene.add(hall);
    heroLeaf('civic', 'cityhall', 1, [CX, CZ]);
  };
  /* parse embedded bytes - a webglcontextrestored reload aborts in-flight
     fetches, so the GLB ships as a base64 module instead of a network load */
  const bin = Uint8Array.from(atob(CITYHALL_B64), c => c.charCodeAt(0));
  new GLTFLoader().parse(bin.buffer, '', add,
    err => console.error('cityhall.glb parse failed:', err));
}

/* A8 — park conservatory (palm house): glazed walls + gable roof +
   clerestory dome, Blender-authored. Sited on the park lawn. */
function buildConservatory(scene) {
  const cands = [[648, 236], [700, 262], [586, 272], [742, 196]];
  let site = null;
  for (const [x, z] of cands) if (isFree(x, z, 15)) { site = [x, z]; break; }
  if (!site) return;
  const [x, z] = site;
  occupyRect(x, z, 32, 22, 2);
  const bin = Uint8Array.from(atob(CONSERVATORY_B64), c => c.charCodeAt(0));
  new GLTFLoader().parse(bin.buffer, '', g => {
    const con = g.scene;
    con.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.name === 'glass_lit') {
          m.emissive = new THREE.Color('#ffd9a0');
          m.emissiveIntensity = RUNENV.litI;
          m.userData.lit = true;
        }
        if (m.isMeshStandardMaterial) m.envMapIntensity *= RUNENV.envScale;
      }
    });
    con.position.set(x, Y, z);
    con.rotation.y = -.5;                  // face the winding park path SW
    scene.add(con);
    heroLeaf('civic', 'conservatory', 1, [x, z]);
  }, err => console.error('conservatory.glb parse failed:', err));
}

/* A7 — water tower on the NE farmland edge: raked steel legs + X-braces,
   banded tank, cone cap. Sited by isFree candidates like the pylon. */
function buildWaterTower(scene) {
  const cands = [[620, -620], [560, -640], [640, -560], [500, -660], [660, -640]];
  let site = null;
  for (const [x, z] of cands) if (isFree(x, z, 9)) { site = [x, z]; break; }
  if (!site) return 0;
  const [x, z] = site;
  occupyRect(x, z, 14, 14, 1);
  const bin = Uint8Array.from(atob(WATERTOWER_B64), c => c.charCodeAt(0));
  new GLTFLoader().parse(bin.buffer, '', g => {
    const wt = g.scene;
    wt.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m.isMeshStandardMaterial) m.envMapIntensity *= RUNENV.envScale;
    });
    wt.position.set(x, Y, z);
    wt.rotation.y = .6;                    // face the diagonal, town-wards
    scene.add(wt);
    heroLeaf('landmark', 'watertower', 1, [x, z]);
  }, err => console.error('watertower.glb parse failed:', err));
}

/* ---------- A6 — Preserve Commons Apartments ----------
   Landmark mid-rise housing anchor in Residential West: twin 5-storey slabs
   around a paved resident courtyard with an entry sign reading THE PRESERVE.
   Makes the (free, required) housing development read as a real district
   landmark instead of anonymous houses. */
function buildPreserveCommons(scene) {
  // mid-block green inside the Residential West family block — the corridor
  // between its two house rows is the only footprint big enough (z 214-246)
  const cx = -530, cz = 230;
  if (!isFree(cx, cz, 30)) return;
  const g = new THREE.Group();
  const spec = (x) => ({ type: 'apartment', x, z: cz - 6, w: 26, d: 14, h: 16, rot: Math.PI });
  const a = makeBuilding(spec(cx - 22)), b = makeBuilding(spec(cx + 22));
  g.add(a); g.add(b);
  // paved courtyard between the slabs, opening south
  const court = new THREE.Mesh(new THREE.CircleGeometry(15, 28), PAVEH);
  court.rotation.x = -Math.PI / 2; court.position.set(cx, Y + .07, cz + 14);
  court.receiveShadow = true; g.add(court);
  // entry sign pylon — reads toward the neighborhood street
  const pyl = texPanel('THE PRESERVE\nAPARTMENT LIVING', 9, 2.6,
    { bg: '#3d5a44', fg: '#efe8d4', font: 'bold 54px Georgia', h: 160 });
  pyl.position.set(cx, Y + 4.2, cz + 28); g.add(pyl);
  g.add(box(9.6, .5, .8, TRIM(), cx, Y + 5.7, cz + 28));
  g.add(box(.9, 5.6, .9, STONE(), cx - 4.6, Y, cz + 28));
  g.add(box(.9, 5.6, .9, STONE(), cx + 4.6, Y, cz + 28));
  // courtyard benches + young trees (all static → merge)
  const parts = [];
  for (const a of [.6, 2.1, 4.2, 5.7]) {
    const bx = cx + Math.cos(a) * 10, bz = cz + 14 + Math.sin(a) * 10;
    parts.push({ geo: new THREE.BoxGeometry(2.4, .14, .6), color: '#7a5c3e', x: bx, y: Y + .62, z: bz, ry: -a });
    for (const lx of [-1, 1])
      parts.push({ geo: new THREE.BoxGeometry(.16, .5, .5), color: '#3a3f43',
        x: bx + lx * Math.cos(a), y: Y + .3, z: bz + lx * Math.sin(a), ry: -a });
  }
  for (const a of [1.2, 3.0, 5.0]) {
    const tx = cx + Math.cos(a) * 13.5, tz = cz + 14 + Math.sin(a) * 13.5;
    parts.push({ geo: new THREE.CylinderGeometry(.14, .2, 2.6, 6), color: '#6b4a32', x: tx, y: Y, z: tz });
    parts.push({ geo: new THREE.SphereGeometry(1.7, 8, 6), color: '#4d7a3f', x: tx, y: Y + 3.4, z: tz });
    parts.push({ geo: new THREE.SphereGeometry(1.15, 7, 5), color: '#5d8a48', x: tx + .9, y: Y + 2.9, z: tz + .5 });
  }
  const cm = new THREE.Mesh(colored(parts), VCOL());
  cm.castShadow = cm.receiveShadow = true; g.add(cm);
  scene.add(g);
  occupyRect(cx, cz + 8, 74, 52, 2);
  heroLeaf('preserve-commons', null, g.children.length, [cx, cz]);
}

export function buildHero(scene) {
  buildPylon(scene);
  buildCityHall(scene);
  buildWaterTower(scene);
  buildConservatory(scene);
  buildQuad(scene);
  buildPavilion(scene);
  buildWayfinding(scene);
  buildPreserveCommons(scene);
}
