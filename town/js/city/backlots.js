// city/backlots.js — "back of house" set dressing: the clutter that makes
// commercial/civic lots feel lived-in. Dumpster bays + grease bins behind
// food/retail, pallet & crate stacks, AC condensers + utility boxes on side
// walls, chain-link utility pens, loading-dock doors + dock bumpers on big-box
// back walls, shopping-cart staging at store fronts, newsboxes + leaning
// bicycles at storefront edges, trash-can variants, roof-access bulkheads +
// duct runs on flat roofs, and work vans + ladders behind municipal buildings.
//
// Every anchor derives from layout.js data — BUILDINGS / FILLER / APARTMENTS
// footprints (+rot), LOTS rects — never a hardcoded cluster. Ground props sit
// inside a lot rect or within ~6m behind a host's back wall / beside a side
// wall; roof props sit on the deck at y = b.h. The occupancy model in
// city/occ.js vets every point (roads + their sidewalk band, lots, water,
// greens, neighbouring buildings all veto); our own placements self-register
// so props never stack. Static pieces funnel through GeoBin and repeat props
// go out as InstancedMesh sets — same batching pattern as details.js /
// streetscape.js.
//
// Wire-in: call AFTER registerOccupancy() and the building passes in main.js
// so `occupied` already carries every blocker.

import * as THREE from 'three';
import { BUILDINGS, FILLER, APARTMENTS, LOTS, HOUSE_BLOCKS,
         PLAZA, PARK_ZONE, GREEN_BELT, SE_GREEN } from '../layout.js';
import { colored, instances, mat, canvasTex, makeCanvas, VCOL,
         R, rr, pick, DETAIL } from '../lib.js';
import { GeoBin } from './geo.js';
import { occupied, occupyRect, streetBand } from './occ.js';

const M = THREE.MeshStandardMaterial;
const Y = 0.28;                    // surface lift — matches details.js/streetscape.js
const TAU = Math.PI * 2;

/* ---------------- placement helpers ---------------- */

/* building local frame: layout (w,d) are pre-rotation and the facade normal
   is (sin rot, cos rot) — the same convention details.js uses for awnings. */
const frame = b => {
  const r = b.rot || 0;
  return { r, fx: Math.sin(r), fz: Math.cos(r) };
};
/* local→world: lx along building width (+x local), lz along facade normal */
const pt = (b, f, lx, lz) =>
  [b.x + f.fz * lx + f.fx * lz, b.z - f.fx * lx + f.fz * lz];

const rect = (x, z, w, d) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
/* soft blockers the occupancy model doesn't carry: open green zones, the
   plaza slab, and house-block interiors (houses register once built, but the
   block edge keeps stray props off lawns that will become yards). */
const BLOCK_RECTS = [
  ...HOUSE_BLOCKS.map(b => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 })),
  { x0: PARK_ZONE.x0, x1: PARK_ZONE.x1, z0: PARK_ZONE.z0, z1: PARK_ZONE.z1 },
  { x0: GREEN_BELT.x0, x1: GREEN_BELT.x1, z0: GREEN_BELT.z0, z1: GREEN_BELT.z1 },
  { x0: SE_GREEN.x0, x1: SE_GREEN.x1, z0: SE_GREEN.z0, z1: SE_GREEN.z1 },
  rect(PLAZA.x, PLAZA.z, PLAZA.w, PLAZA.d),
];

const TAKEN = [];                  // props placed this pass — self-avoidance
/* sentinel occupyRect tags: a pen/dock pad is a hard boundary for EVERYONE
   (including the host's own later props — vans mustn't park inside the pen)
   — unlike building/lot pads it is never exempted as a host's own rect. */
const PEN_TAG = { pen: true }, DOCK_TAG = { dock: true };

/* freePt — isFree() plus: `host` may exempt its own pad rect (BUILDINGS tag
   themselves; FILLER pads register untagged, so the untagged rect containing
   the host's centre is treated as the host's own), an extra kind exemption,
   our own TAKEN list, and the soft blockers above. */
function freePt(x, z, r, host, skipKind = null, skipTaken = false) {
  for (const o of occupied) {
    if (host) {
      if (o.tag === host) continue;
      if (!o.tag && host.x > o.x0 && host.x < o.x1 && host.z > o.z0 && host.z < o.z1)
        continue;
    }
    if (skipKind && o.kind &&
        (Array.isArray(skipKind) ? skipKind.includes(o.kind) : o.kind === skipKind))
      continue;
    if (x + r > o.x0 && x - r < o.x1 && z + r > o.z0 && z - r < o.z1) return false;
  }
  if (!skipTaken)
    for (const t of TAKEN)
      if (x + r > t.x0 && x - r < t.x1 && z + r > t.z0 && z - r < t.z1) return false;
  for (const b of BLOCK_RECTS)
    if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) return false;
  return true;
}
const take = (x, z, r) =>
  TAKEN.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r });

/* road surface / walk lane via streetBand: frontage props may sit inside a
   road's occupancy pad (verge/apron margins are legit furniture spots) but
   never on asphalt or the sidewalk run itself. */
function roadMetrics(x, z) {
  let asphalt = false, walk = false;
  for (const o of occupied) {
    if (o.kind !== 'road' || !o.tag) continue;
    const r = o.tag;
    if (r.axis === 'v' ? (z < r.a0 - 1 || z > r.a1 + 1) : (x < r.a0 - 1 || x > r.a1 + 1))
      continue;
    const lat = Math.abs(r.axis === 'v' ? x - r.c : z - r.c);
    if (lat < r.w / 2 + .45) asphalt = true;
    const band = streetBand(r);
    if (lat > band - 4.5 && lat < band + .5) walk = true;
  }
  return { asphalt, walk };
}

/* spread n anchor points along the back wall, each occupancy-probed.
   Returns world {x,z,ry} plus the local lx for pen sizing. */
function backLine(b, f, n, off, r, margin = 2.5, skipKind = null) {
  const out = [];
  const span = Math.max(0, b.w / 2 - margin);
  for (let i = 0; i < n; i++) {
    const lx = n === 1 ? rr(-span * .4, span * .4)
                       : -span + (i + .5) / n * span * 2 + rr(-1.1, 1.1);
    const [x, z] = pt(b, f, lx, -(b.d / 2 + off));
    if (freePt(x, z, r, b, skipKind)) out.push({ x, z, ry: f.r, lx });
  }
  return out;
}
/* anchors along a side wall (side = ±1 local x); z0/z1 bound the front-back
   coverage so utility gear can be biased toward the rear half. */
function sideLine(b, f, side, n, r, { z0 = .15, z1 = .85 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const lz = -b.d / 2 + rr(z0, z1) * b.d;
    const [x, z] = pt(b, f, side * (b.w / 2 + .8), lz);
    if (freePt(x, z, r, b)) out.push({ x, z, ry: f.r });
  }
  return out;
}

/* ---------------- shared prop geometries ----------------
   authored once, instanced everywhere. Tinted bodies bake near-white and take
   per-instance colour; multi-part props bake vertex colours via colored(). */

const B = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const C = (rt, rb, h, x = 0, y = 0, z = 0, seg = 10) =>
  new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z);

/* dumpster: tinted shell + dark trim (lid, side pockets, caster wheels) */
const dumpBodyG = B(2.2, 1.02, 1.05, 0, .83, 0);
const dumpTrimG = colored([
  { geo: B(2.26, .12, 1.09, 0, 1.4, 0), color: '#31393a' },
  { geo: B(.16, .3, .68, 1.13, .92, 0), color: '#3a4344' },
  { geo: B(.16, .3, .68, -1.13, .92, 0), color: '#3a4344' },
  ...[.85, -.85].flatMap(x => [.4, -.4].map(z =>
    ({ geo: C(.15, .15, .14, x, .16, z, 8).rotateX(Math.PI / 2), color: '#1f2224' }))),
]);
const DUMP_TINTS = ['#4a5f4e', '#43565e', '#5b5b50', '#6e4a38', '#3f4a55'];

/* grease barrel — rust drum + darker lid, sits beside food dumpsters */
const greaseG = colored([
  { geo: C(.34, .34, .95, 0, .48, 0, 12), color: '#7a4a2a' },
  { geo: C(.36, .36, .08, 0, .98, 0, 12), color: '#4a3428' },
  { geo: C(.345, .345, .06, 0, .62, 0, 12), color: '#5d3a24' },
]);

/* pallet: 3 runners + 5 deck slats */
const palletG = colored([
  ...[-.5, 0, .5].map(z => ({ geo: B(1.2, .1, .12, 0, .05, z), color: '#8a6f4c' })),
  ...[-.44, -.22, 0, .22, .44].map(z => ({ geo: B(1.2, .04, .16, 0, .14, z), color: '#9a7d58' })),
]);

/* shipping crate — slat-edged box */
const crateG = colored([
  { geo: B(1.0, .9, 1.0, 0, .45, 0), color: '#c4a878' },
  { geo: B(1.04, .1, 1.04, 0, .85, 0), color: '#9a8462' },
  { geo: B(1.04, .1, 1.04, 0, .08, 0), color: '#9a8462' },
  ...[[.48, .48], [-.48, .48], [.48, -.48], [-.48, -.48]]
    .map(([x, z]) => ({ geo: B(.1, .9, .1, x, .45, z), color: '#9a8462' })),
]);
const CRATE_TINTS = ['#cbb089', '#b0925f', '#96754e', '#8a8462'];

/* shopping cart — wire basket + under-tray + handle + wheels */
const cartG = colored([
  { geo: B(.56, .34, .88, 0, .45, 0), color: '#aab4ba' },          // basket
  { geo: B(.62, .06, .95, 0, .64, 0), color: '#8a949a' },          // rim
  { geo: B(.58, .05, .8, 0, .27, 0), color: '#7d868c' },           // tray
  ...[[.28, .42], [-.28, .42], [.28, -.42], [-.28, -.42]]
    .map(([x, z]) => ({ geo: B(.04, .3, .04, x, .48, z), color: '#8a949a' })),
  { geo: B(.66, .05, .05, 0, .68, -.5), color: '#b03a2e' },        // handle
  ...[[.22, .4], [-.22, .4], [.22, -.4], [-.22, -.4]]
    .map(([x, z]) => ({ geo: C(.09, .09, .05, x, .09, z, 8).rotateX(Math.PI / 2), color: '#232628' })),
]);

/* AC condenser — light shell tinted per-instance, dark fan disc on top */
const condG = colored([
  { geo: B(1.0, .78, 1.0, 0, .39, 0), color: '#d8dcdf' },
  { geo: C(.36, .36, .07, 0, .82, 0, 14), color: '#5f676c' },
  { geo: B(1.02, .3, 1.02, 0, .2, 0), color: '#9aa0a4' },
]);
const COND_TINTS = ['#9aa0a4', '#8b9094', '#a8a8a0', '#7d858a'];

/* pad-mount utility transformer / junction cabinet */
const utilG = colored([
  { geo: B(1.5, 1.2, 1.05, 0, .6, 0), color: '#d2d8d2' },
  { geo: B(1.56, .12, 1.11, 0, 1.24, 0), color: '#6e7a6e' },
  { geo: B(.06, .7, .5, .76, .6, 0), color: '#4a544c' },
]);
const UTIL_TINTS = ['#5a6e5a', '#7a8084', '#6e5a3a', '#4e5a5e'];

/* trash cans — round lidded + square "wheelie" bin variants */
const canRG = colored([
  { geo: C(.32, .28, .85, 0, .42, 0, 10), color: '#e8e6e0' },
  { geo: C(.35, .35, .09, 0, .88, 0, 10), color: '#6e6a60' },
]);
const canSG = colored([
  { geo: B(.52, .92, .58, 0, .46, 0), color: '#e8e6e0' },
  { geo: B(.56, .12, .62, 0, .94, 0), color: '#7a766c' },
]);
const CAN_TINTS = ['#41504a', '#4a4f52', '#3e5a6e', '#5d5348', '#6e3a34'];

/* newspaper box — legs, tinted box, window face */
const newsG = colored([
  { geo: B(.08, .3, .08, .18, .15, 0), color: '#3a3f43' },
  { geo: B(.08, .3, .08, -.18, .15, 0), color: '#3a3f43' },
  { geo: B(.55, .8, .48, 0, .75, 0), color: '#f0f0f0' },
  { geo: B(.44, .5, .03, 0, .8, .25), color: '#d8e2e6' },
]);
const NEWS_TINTS = ['#8a2f2f', '#2e5b8a', '#b8860b', '#3a3f43', '#2471a3'];

/* bicycle — frame tubes + two wheels + saddle/bars; pre-tilted toward +z so
   an instance leans on the wall behind it (ry aligns +z to the wall normal) */
const bikeG = (() => {
  const g = colored([
    ...[.55, -.55].map(x => ({ geo: C(.33, .33, .05, x, .33, 0, 14).rotateX(Math.PI / 2), color: '#22262a' })),
    { geo: B(.8, .05, .05, 0, .72, 0), color: '#2c4a6e' },
    { geo: B(.05, .6, .05, -.42, .5, 0), color: '#2c4a6e' },
    { geo: B(.05, .62, .05, .48, .5, .1), color: '#2c4a6e', rx: -.4 },
    { geo: B(.26, .07, .14, -.45, .92, 0), color: '#1c1e20' },
    { geo: B(.5, .05, .05, .55, .98, 0), color: '#1c1e20' },
    { geo: B(.05, .5, .05, .55, .7, .05), color: '#2c4a6e' },
  ]);
  g.rotateX(.28);
  return g;
})();

/* work van — tinted shell + VCOL trim (glass band, bumper, wheels) */
const vanBodyG = colored([
  { geo: B(3.6, 1.7, 1.9, -.6, 1.15, 0), color: '#ffffff' },
  { geo: B(1.3, 1.1, 1.82, 1.75, .85, 0), color: '#ffffff' },
  { geo: B(.9, .5, 1.7, 2.2, .55, 0), color: '#ffffff' },
]);
const vanTrimG = colored([
  { geo: B(1.05, .6, 1.84, 1.78, 1.45, 0), color: '#1c2833' },
  { geo: B(.4, .3, 1.85, 2.6, .4, 0), color: '#3a3f43' },
  ...[[1.5, .95], [1.5, -.95], [-1.5, .95], [-1.5, -.95]]
    .map(([x, z]) => ({ geo: C(.38, .38, .3, x, .38, z, 10).rotateX(Math.PI / 2), color: '#16181a' })),
]);
const VAN_TINTS = ['#e8e6df', '#d8d5cc', '#3d6b8a', '#b8860b', '#5d6d7e'];

/* ladder — rails + rungs, pre-tilted toward +z to lean on the wall behind */
const ladderG = (() => {
  const g = colored([
    { geo: B(.06, 3.3, .05, -.26, 1.65, 0), color: '#9aa2a6' },
    { geo: B(.06, 3.3, .05, .26, 1.65, 0), color: '#9aa2a6' },
    ...[.4, .8, 1.2, 1.6, 2.0, 2.4, 2.8].map(y => ({ geo: B(.5, .05, .04, 0, y, 0), color: '#7d858a' })),
  ]);
  g.rotateX(.3);
  return g;
})();

/* ---------------- bespoke materials ---------------- */
const postM = mat('#8a9296', { metalness: .55, roughness: .5 });
const bumperM = mat('#24282b', { roughness: .9 });
const bollardM = mat('#4a4f52', { roughness: .7 });
const ductM = mat('#9aa2a6', { metalness: .5, roughness: .55 });
const bulkM = mat('#8a8f94', { roughness: .8 });
const concM = mat('#969389', { roughness: .95 });

let _chainM = null;
function chainMat() {                // chain-link: diagonal wire weave, alpha-tested
  if (_chainM) return _chainM;
  const [c, x] = makeCanvas(64, 64);
  x.clearRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(168,176,180,.95)'; x.lineWidth = 1.7;
  for (let i = -64; i < 128; i += 8) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke();
    x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke();
  }
  _chainM = new M({ map: canvasTex(c), transparent: true, alphaTest: .15,
    side: THREE.DoubleSide, metalness: .6, roughness: .5 });
  return _chainM;
}
let _rollupM = null;
function rollupMat() {               // roll-up door: horizontal slat shading
  if (_rollupM) return _rollupM;
  const [c, x] = makeCanvas(64, 64);
  x.fillStyle = '#79838a'; x.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, y, 64, 2);
    x.fillStyle = 'rgba(255,255,255,.13)'; x.fillRect(0, y + 3, 64, 1);
  }
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 58, 64, 6);        // bottom bar
  _rollupM = new M({ map: canvasTex(c), metalness: .45, roughness: .55 });
  return _rollupM;
}

/* ---------------- the pass ---------------- */
export function buildBacklots(scene) {
  const bin = new GeoBin();
  const stat = { dumpsters: 0, grease: 0, pens: 0, pallets: 0, crates: 0,
    condensers: 0, utils: 0, cans: 0, newsboxes: 0, bikes: 0, carts: 0,
    vans: 0, ladders: 0, docks: 0, roofs: 0 };
  const set = { dBody: [], dTrim: [], grease: [], pallet: [], crate: [],
    cart: [], cond: [], util: [], canR: [], canS: [], news: [], bike: [],
    vanB: [], vanT: [], ladder: [] };

  const addDumpster = (x, z, ry) => {
    const j = ry + rr(-.05, .05);
    set.dBody.push({ x, y: 0, z, ry: j, color: pick(DUMP_TINTS) });
    set.dTrim.push({ x, y: 0, z, ry: j });
    take(x, z, 1.5); stat.dumpsters++;
  };
  const addCans = (x, z, n, host) => {
    let ok = 0;
    for (let i = 0; i < n * 3 && ok < n; i++) {
      const cx = x + rr(-1.2, 1.2), cz = z + rr(-.7, .7);
      if (!freePt(cx, cz, .5, host)) continue;
      (R() < .5 ? set.canR : set.canS)
        .push({ x: cx, y: 0, z: cz, ry: rr(0, TAU), color: pick(CAN_TINTS) });
      ok++; stat.cans++;
    }
    if (ok) take(x, z, 1.4);
  };
  const addCondensers = (b, f, n) => {
    for (const s of (R() < .5 ? [-1, 1] : [1, -1])) {
      for (const a of sideLine(b, f, s, n, .9)) {
        set.cond.push({ x: a.x, y: 0, z: a.z, ry: a.ry + rr(-.08, .08), color: pick(COND_TINTS) });
        take(a.x, a.z, .8); stat.condensers++;
      }
      if (R() < .4) break;
    }
  };
  const addUtils = (b, f, n) => {
    for (const a of sideLine(b, f, pick([-1, 1]), n, 1.1, { z0: .05, z1: .45 })) {
      set.util.push({ x: a.x, y: 0, z: a.z, ry: a.ry, color: pick(UTIL_TINTS) });
      take(a.x, a.z, 1); stat.utils++;
    }
  };
  const addPallets = (b, f, n) => {
    for (const a of backLine(b, f, n, rr(1.6, 3.6), 1.0)) {
      const stacks = 1 + Math.floor(R() * 3);
      for (let s = 0; s < stacks; s++)
        set.pallet.push({ x: a.x + rr(-.12, .12), y: s * .19, z: a.z + rr(-.12, .12),
          ry: a.ry + rr(-.15, .15) });
      stat.pallets += stacks;
      if (R() < .65) {               // crate(s) riding the stack or beside it
        set.crate.push({ x: a.x + rr(-.3, .3), y: stacks * .19, z: a.z + rr(-.3, .3),
          ry: rr(0, TAU), s: rr(.8, 1.2), color: pick(CRATE_TINTS) });
        stat.crates++;
      }
      if (R() < .4) {
        set.crate.push({ x: a.x + rr(1.3, 1.9) * pick([-1, 1]), y: 0, z: a.z + rr(-.8, .8),
          ry: rr(0, TAU), s: rr(.8, 1.2), color: pick(CRATE_TINTS) });
        stat.crates++;
      }
      take(a.x, a.z, 1.4);
    }
  };

  /* chain-link pen around a placed dumpster row — posts + translucent mesh
     panels on three sides, a gated fourth (approach side stays half-open) */
  const penRow = (b, f, lxC, pw, lzC) => {
    const pd = 1.5;
    const P = (lx, lz) => pt(b, f, lx, lz);
    const cs = [P(lxC - pw, lzC - pd), P(lxC + pw, lzC - pd),
                P(lxC + pw, lzC + pd), P(lxC - pw, lzC + pd)];
    // skipTaken: the pen deliberately wraps the dumpster row it encloses
    if (!cs.every(([x, z]) => freePt(x, z, .6, b, null, true))) return;
    stat.pens++;
    const edge = (A, Bp, gate = false) => {
      const ex = Bp[0] - A[0], ez = Bp[1] - A[1], len = Math.hypot(ex, ez);
      const ux = ex / len, uz = ez / len;
      const n = Math.max(2, Math.round(len / 2.4) + 1);
      for (let i = 0; i < n; i++)
        bin.box(.09, 1.95, .09, postM, A[0] + ex * i / (n - 1), 0, A[1] + ez * i / (n - 1));
      // plane's x axis runs along the edge: rotateY(atan2(ux,uz)+π/2)
      const ry = Math.atan2(ux, uz) + Math.PI / 2;
      const gLen = gate ? len * .55 : len;
      const sh = gate ? .225 : 0;
      const g = new THREE.PlaneGeometry(gLen, 1.8);
      g.rotateY(ry);
      g.translate(A[0] + ex * (.5 + sh), 1.0, A[1] + ez * (.5 + sh));
      let bb = bin.b.get(chainMat());
      if (!bb) { bb = []; bin.b.set(chainMat(), bb); }
      bb.push(g);
    };
    edge(cs[0], cs[1], true);          // approach side — gate gap
    edge(cs[1], cs[2]);
    edge(cs[2], cs[3]);
    edge(cs[3], cs[0]);
    const xs = cs.map(c => c[0]), zs = cs.map(c => c[1]);
    occupyRect((Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...zs) + Math.max(...zs)) / 2,
      Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), .3, PEN_TAG, 'fence');
  };

  const addDumpBay = (b, f, n, penned) => {
    const anchors = backLine(b, f, n, 1.9, 1.5, 3.2);
    if (!anchors.length) return;
    let lx0 = 1e9, lx1 = -1e9;
    for (const a of anchors) {
      addDumpster(a.x, a.z, a.ry);
      lx0 = Math.min(lx0, a.lx); lx1 = Math.max(lx1, a.lx);
    }
    if (penned && anchors.length > 1)
      penRow(b, f, (lx0 + lx1) / 2, (lx1 - lx0) / 2 + 1.7, -(b.d / 2 + 1.9));
  };

  /* loading dock: roll-up door + bumpers + sloped approach pad + bollards */
  const addDock = (b, f, lx0) => {
    const lz = -(b.d / 2);
    const corners = [pt(b, f, lx0 - 3.4, lz - 4), pt(b, f, lx0 + 3.4, lz - 4),
                     pt(b, f, lx0 - 3.4, lz - .3), pt(b, f, lx0 + 3.4, lz - .3)];
    if (!corners.every(([x, z]) => freePt(x, z, .7, b))) return;
    const [dx, dz] = pt(b, f, lx0, lz - .14);
    bin.box(4.6, 4.4, .2, rollupMat(), dx, Y, dz, f.r);
    for (const s of [-1, 1]) {
      const [bx, bz] = pt(b, f, lx0 + s * 1.75, lz - .3);
      bin.box(.45, .85, .3, bumperM, bx, Y + .35, bz, f.r);
      const [ox, oz] = pt(b, f, lx0 + s * 3.1, lz - 2.7);
      if (freePt(ox, oz, .4, b)) bin.box(.32, 1.0, .32, bollardM, ox, Y, oz);
    }
    const padG = B(5.6, .16, 3.4); padG.rotateX(-.12);   // +z edge rises to meet the wall
    const [px, pz] = pt(b, f, lx0, lz - 1.95);
    bin.add(padG, concM, px, .03, pz, { ry: f.r });
    const xs = corners.map(c => c[0]), zs = corners.map(c => c[1]);
    occupyRect((Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...zs) + Math.max(...zs)) / 2,
      Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), .3, DOCK_TAG);
    take(px, pz, 3); stat.docks++;
  };

  /* shopping carts staged on the storefront walkway + a stray in the lot */
  const addCarts = (b, f, n) => {
    const span = Math.max(2, b.w / 2 - 4);
    let placed = 0;
    for (let i = 0; i < n * 2 && placed < n; i++) {
      const [x, z] = pt(b, f, rr(-span, span), b.d / 2 + rr(1.1, 2.2));
      const rm = roadMetrics(x, z);
      if (!freePt(x, z, .5, b) || rm.walk || rm.asphalt) continue;
      set.cart.push({ x, y: 0, z, ry: f.r + rr(-.4, .4), s: rr(.92, 1.08) });
      placed++;
    }
    stat.carts += placed;
    // stray cart near the front-side lot's +x corner (stall rows never reach it)
    const front = pt(b, f, 0, b.d / 2 + 8);
    const lot = LOTS.find(l => !l.plain &&
      front[0] > l.x - l.w / 2 - 20 && front[0] < l.x + l.w / 2 + 20 &&
      front[1] > l.z - l.d / 2 - 20 && front[1] < l.z + l.d / 2 + 20);
    if (lot) {
      const cx = lot.x + lot.w / 2 - .8, cz = lot.z + lot.d / 2 - .8;
      if (freePt(cx, cz, .5, lot)) {
        set.cart.push({ x: cx, y: Y, z: cz, ry: rr(0, TAU) });
        take(cx, cz, 1.2); stat.carts++;
      }
    }
  };

  const addBikes = (b, f, n) => {
    let placed = 0;
    for (let i = 0; i < n * 3 && placed < n; i++) {
      const s = pick([-1, 1]);
      const [x, z] = pt(b, f, s * (b.w / 2 + .42), b.d / 2 - rr(.8, 2.4));
      const rm = roadMetrics(x, z);
      if (!freePt(x, z, .6, b) || rm.walk || rm.asphalt) continue;
      // lean toward the side wall: bike +z must point back at the building
      set.bike.push({ x, y: 0, z, ry: f.r - s * Math.PI / 2 + rr(-.1, .1) });
      take(x, z, .8); placed++; stat.bikes++;
    }
  };
  const addNews = (b, f) => {
    const s = pick([-1, 1]);
    let ok = 0;
    const drop = (x, z, ry) => {
      const rm = roadMetrics(x, z);
      if (!freePt(x, z, .5, b) || rm.walk || rm.asphalt) return false;
      set.news.push({ x, y: 0, z, ry, color: pick(NEWS_TINTS) });
      ok++; return true;
    };
    const lx = s * (b.w / 2 - 1.2);
    for (let i = 0; i < 3; i++) {
      const [x, z] = pt(b, f, lx - s * i * .8, b.d / 2 + 1.3);
      drop(x, z, f.r + rr(-.12, .12));
    }
    /* sidewalk bands can veto the whole front strip (e.g. Main St's walk is
       registered wall-to-curb) — fall back to the side face, marching back
       from the front corner with the door facing the street side */
    if (!ok)
      for (let lz = b.d / 2 - 1.0; ok < 3 && lz > -b.d / 2 + .8; lz -= .85) {
        const [x, z] = pt(b, f, s * (b.w / 2 + .5), lz);
        drop(x, z, f.r + s * Math.PI / 2 + rr(-.08, .08));
      }
    if (ok) { const [x, z] = pt(b, f, lx, b.d / 2 + 1.3); take(x, z, 1.6); stat.newsboxes += ok; }
  };

  const addVan = (b, f) => {
    const s = pick([-1, 1]);
    const lx = s * rr(Math.min(2, b.w * .15), Math.max(2.5, b.w / 2 - 4.5));
    const [x, z] = pt(b, f, lx, -(b.d / 2 + rr(2.6, 3.6)));
    if (!freePt(x, z, 2.6, b)) return;
    const ry = f.r + Math.PI / 2 + rr(-.06, .06);
    set.vanB.push({ x, y: 0, z, ry, color: pick(VAN_TINTS) });
    set.vanT.push({ x, y: 0, z, ry });
    take(x, z, 3); stat.vans++;
  };

  /* extension ladder leaning on the back wall — municipal/maintenance cue;
     skipKind 'fence': a ladder stored inside a dumpster pen reads fine */
  const addLadder = (b, f) => {
    for (const a of backLine(b, f, 1, 1.0, .5, 4, 'fence')) {
      set.ladder.push({ x: a.x, y: 0, z: a.z, ry: f.r });
      take(a.x, a.z, .7); stat.ladders++;
      return;
    }
  };

  /* roof-access bulkhead + duct run on big flat decks — buildings.js seeds
     its own clutter centre-field, so ours hugs the back-left corner strip */
  const addRoofKit = (b, f) => {
    if (!(b.w > 40 && b.d > 26 && b.h && b.h < 26)) return;
    const [hx, hz] = pt(b, f, -(b.w / 2 - 4.6), -(b.d / 2 - 4.4));
    bin.box(3.4, 2.5, 2.8, bulkM, hx, b.h + .05, hz, f.r);
    // hatch door on the bulkhead's front face
    const [dx, dz] = pt(b, f, -(b.w / 2 - 4.6), -(b.d / 2 - 4.4) + 1.45);
    bin.box(1.0, 1.9, .15, bumperM, dx, b.h + .05, dz, f.r);
    const runs = 2 + Math.floor(R() * 2);
    for (let i = 0; i < runs; i++) {
      const lx = -(b.w / 2 - 7) + i * (b.w * .16 + 2);
      const [x, z] = pt(b, f, lx, -(b.d / 2 - 2.4));
      bin.box(b.w * .14, .55, .8, ductM, x, b.h + .05, z, f.r);
      if (R() < .6) {
        const [vx, vz] = pt(b, f, lx + b.w * .07, -(b.d / 2 - 2.4));
        bin.add(C(.16, .2, rr(1.0, 1.8), 0, .5, 0, 8), ductM, vx, b.h + .5, vz);
      }
    }
    stat.roofs++;
  };

  /* ------- per-host dressing ------- */
  const FOOD = new Set(['orchard', 'fiesta', 'coffee']);
  const hosts = [
    ...BUILDINGS.filter(b => b.w && b.type !== 'zone' && b.type !== 'parkzone'),
    ...FILLER,
    ...APARTMENTS,
  ];
  for (const b of hosts) {
    /* MIN: skip whole installations — each surviving backlot keeps its
       pen, stacked crates, occupancy and stats consistent (thinning the
       emit lists instead would leave empty pens / floating crates) */
    if (DETAIL.f < 1 && R() > DETAIL.f) continue;
    const f = frame(b);
    switch (b.type || 'apartment') {
      case 'bigbox':
        addDock(b, f, rr(-b.w / 4, b.w / 4));
        if (b.w > 90) addDock(b, f, -b.w / 2 + rr(8, 14));
        addDumpBay(b, f, 3, true);
        addPallets(b, f, 4);
        addCondensers(b, f, 2);
        addUtils(b, f, 1);
        addCarts(b, f, 7);
        if (R() < .4) addVan(b, f);
        addRoofKit(b, f);
        break;
      case 'mall':
        addDock(b, f, -b.w / 4); addDock(b, f, b.w / 4);
        addDumpBay(b, f, 4, true);
        addPallets(b, f, 5);
        addCondensers(b, f, 3);
        addUtils(b, f, 2);
        addCarts(b, f, 10);
        if (R() < .6) addVan(b, f);
        addRoofKit(b, f);
        break;
      case 'fastfood':
        addDumpBay(b, f, 2, true);
        for (const a of backLine(b, f, 1, 1.0, .5)) {
          set.grease.push({ x: a.x, y: 0, z: a.z, ry: rr(0, TAU) });
          stat.grease++;
        }
        addPallets(b, f, 2);
        addCondensers(b, f, 2); addUtils(b, f, 1);
        break;
      case 'storefront': case 'medoffice': case 'clinic':
        if (R() < .55) addDumpBay(b, f, 1 + (R() < .4 ? 1 : 0), false);
        else {
          const [x, z] = pt(b, f, rr(-b.w / 4, b.w / 4), -(b.d / 2 + 1.2));
          addCans(x, z, 2, b);
        }
        if (FOOD.has(b.id))
          for (const a of backLine(b, f, 1, 1.0, .5)) {
            set.grease.push({ x: a.x, y: 0, z: a.z, ry: rr(0, TAU) });
            stat.grease++;
          }
        addCondensers(b, f, 1 + (R() < .5 ? 1 : 0));
        if (R() < .5) addUtils(b, f, 1);
        if (R() < .55) addNews(b, f);
        if (R() < .6) addBikes(b, f, 2);
        break;
      case 'civicb': case 'ems':
        addDumpBay(b, f, 1, false);
        addCondensers(b, f, 2); addUtils(b, f, 1);
        if (R() < .8) addVan(b, f);
        if (R() < .4) addNews(b, f);
        if (R() < .5) addLadder(b, f);
        break;
      case 'hospital':
        addDumpBay(b, f, 3, true);
        addPallets(b, f, 2);
        addCondensers(b, f, 4); addUtils(b, f, 2);
        if (R() < .8) addVan(b, f);
        if (R() < .5) addLadder(b, f);
        break;
      case 'medhall': case 'campusb':
        addDumpBay(b, f, 1 + (R() < .5 ? 1 : 0), false);
        addCondensers(b, f, 2); addUtils(b, f, 1);
        addRoofKit(b, f);
        break;
      case 'school':
        addDumpBay(b, f, 2, true);
        addCondensers(b, f, 2); addUtils(b, f, 1);
        if (R() < .5) addVan(b, f);
        if (R() < .5) addLadder(b, f);
        addBikes(b, f, 3);
        addRoofKit(b, f);
        break;
      case 'museum':
        addCondensers(b, f, 2); addUtils(b, f, 1);
        if (R() < .5) addVan(b, f);
        if (R() < .5) addNews(b, f);
        break;
      case 'senior': case 'hospice':
        addCondensers(b, f, 3); addUtils(b, f, 2);
        if (R() < .5) addVan(b, f);
        break;
      case 'apartment':
        addDumpBay(b, f, 1 + (R() < .6 ? 1 : 0), false);
        {
          const [x, z] = pt(b, f, rr(-b.w / 4, b.w / 4), -(b.d / 2 + 1.2));
          addCans(x, z, 2, b);
        }
        addCondensers(b, f, 2);
        break;
      case 'townhouse':
        if (R() < .68) {
          const [x, z] = pt(b, f, rr(-b.w / 5, b.w / 5), -(b.d / 2 + 1.0));
          addCans(x, z, 1, b);
        }
        break;
      case 'tower': case 'skyscraper':
        if (R() < .5) addDumpBay(b, f, 2, false);
        addCondensers(b, f, 1); if (R() < .5) addUtils(b, f, 1);
        break;
      case 'gas':
        addDumpBay(b, f, 1, false); addUtils(b, f, 1);
        break;
      case 'church':
        {
          const [x, z] = pt(b, f, rr(-b.w / 4, b.w / 4), -(b.d / 2 + 1.2));
          addCans(x, z, 2, b);
        }
        addCondensers(b, f, 1);
        break;
    }
  }

  /* trash cans at the car-free +x corners of every non-plain lot
     (stall rows never reach the last ~3m of their run) */
  for (const l of LOTS) {
    if (l.plain || l.w < 40) continue;
    for (const zs of [-1, 1]) {
      if (DETAIL.f < 1 && R() > DETAIL.f) continue;
      const cx = l.x + l.w / 2 - .8, cz = l.z + zs * (l.d / 2 - .8);
      if (!freePt(cx, cz, .5, l)) continue;
      (R() < .5 ? set.canR : set.canS)
        .push({ x: cx, y: Y, z: cz, ry: rr(0, TAU), color: pick(CAN_TINTS) });
      take(cx, cz, 1.0); stat.cans++;
    }
  }

  /* ------- emit ------- */
  bin.build(scene, { shadows: true });
  const vcol = VCOL();
  const put = (geo, material, list, shadow = true) => {
    if (!list.length) return 0;
    scene.add(instances(geo, material, list, { shadow }));
    return Math.round((geo.index ? geo.index.count
      : geo.attributes.position.count) / 3) * list.length;
  };
  const bodyM = new M({ color: '#ffffff', roughness: .8, metalness: .15 });
  const vanM = new M({ color: '#ffffff', roughness: .55, metalness: .3 });
  let tris = 0;
  tris += put(dumpBodyG, bodyM, set.dBody);
  tris += put(dumpTrimG, vcol, set.dTrim);
  tris += put(greaseG, vcol, set.grease);
  tris += put(palletG, vcol, set.pallet);
  tris += put(crateG, vcol, set.crate);
  tris += put(cartG, vcol, set.cart);
  tris += put(condG, vcol, set.cond);
  tris += put(utilG, vcol, set.util);
  tris += put(canRG, vcol, set.canR);
  tris += put(canSG, vcol, set.canS);
  tris += put(newsG, vcol, set.news);
  tris += put(bikeG, vcol, set.bike);
  tris += put(vanBodyG, vanM, set.vanB);
  tris += put(vanTrimG, vcol, set.vanT);
  tris += put(ladderG, vcol, set.ladder);

  if (typeof window !== 'undefined' && window.__city)
    window.__city.backlots = { ...stat, tris };
  return stat;
}
