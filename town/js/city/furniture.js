// city/furniture.js — street furniture / set dressing for Havenbrook.
// Park benches, planters, hydrants, bus shelters, mailboxes, newspaper boxes,
// trash/recycling pairs, manhole discs, phone-booth kiosks.
// One InstancedMesh per family (~9 draw calls for the whole pass); all parts
// are vertex-coloured via colored() so families ride on the shared VCOL
// material and stay mergeStatic-friendly. Every placement goes through
// isFree() — sidewalk pieces exempt only their own road's streetscape band,
// junction pieces exempt the two crossing roads (same convention as lamps).
import * as THREE from 'three';
import { ROADS, PLAZA, PARK_ZONE } from '../layout.js';
import { colored, VCOL, instances, R, rr, pick, thin } from '../lib.js';
import { isFree, streetBand } from './occ.js';
import { intersections } from './streetscape.js';
import { CITY } from './stats.js';

const Y = .28;        // ground lift — matches details.js / streetscape.js
const WALK_Y = .43;   // raised sidewalk surface (Y + curb .16 - epsilon)
const PLAZA_Y = .26;  // precast plaza paving

const arterial = r => r.arterial || r.w >= 16;
/* sidewalk centreline offset from road centreline */
const walkC = r => r.w / 2 + (arterial(r) ? 1.9 : 3.0);
const road = name => ROADS.find(r => r.name === name);
/* rotation so a prop's local -z faces (tx,tz) — benches face their path/plaza */
const face = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
const ix = (a, b) => intersections().find(i =>
  (i.vn === a && i.hn === b) || (i.vn === b && i.hn === a));

/* ================= geometry (all vertex-coloured, built once) ================= */
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);

/* park bench — plank slats on a metal frame, front = local +z face-away-back */
function benchGeo() {
  const W = '#7a5a3a', F = '#3d4145';
  return colored([
    { geo: B(1.8, .05, .15), color: W, y: .45, z: -.16 },
    { geo: B(1.8, .05, .15), color: W, y: .45 },
    { geo: B(1.8, .05, .15), color: W, y: .45, z: .16 },
    { geo: B(1.8, .14, .04), color: W, y: .74, z: -.3 },
    { geo: B(1.8, .14, .04), color: W, y: .93, z: -.3 },
    { geo: B(.08, .45, .5), color: F, x: -.72, y: .22 },
    { geo: B(.08, .45, .5), color: F, x: .72, y: .22 },
    { geo: B(.08, .52, .05), color: F, x: -.72, y: .72, z: -.3 },
    { geo: B(.08, .52, .05), color: F, x: .72, y: .72, z: -.3 },
  ]);
}
/* concrete planter + soil + shrub puff */
function planterGeo() {
  return colored([
    { geo: B(1.3, .72, 1.3), color: '#98948c', y: .36 },
    { geo: B(1.1, .07, 1.1), color: '#4a3527', y: .7 },
    { geo: new THREE.IcosahedronGeometry(.62, 0), color: '#4e6b3e', y: 1.15 },
    { geo: new THREE.IcosahedronGeometry(.38, 0), color: '#5d7d46', x: .3, y: .95, z: .25 },
  ]);
}
/* fire hydrant */
function hydrantGeo() {
  return colored([
    { geo: C(.21, .25, .85, 8), color: '#c0392b', y: .42 },
    { geo: C(.27, .27, .1, 8), color: '#8e2f26', y: .82 },
    { geo: C(.1, .1, .3, 8), color: '#c0392b', y: .95 },
    { geo: new THREE.SphereGeometry(.12, 8, 6), color: '#e8b13a', y: 1.12 },
    { geo: C(.08, .08, .5, 6).rotateZ(Math.PI / 2), color: '#8e2f26', y: .62 },
  ]);
}
/* bus shelter — posts, roof, glass back/sides, bench; opening faces local +z */
function shelterGeo() {
  const F = '#3d4145', G = '#7fa6bd';
  return colored([
    { geo: B(.14, 2.6, .14), color: F, x: -2.1, y: 1.3, z: -.75 },
    { geo: B(.14, 2.6, .14), color: F, x: 2.1, y: 1.3, z: -.75 },
    { geo: B(.14, 2.6, .14), color: F, x: -2.1, y: 1.3, z: .55 },
    { geo: B(.14, 2.6, .14), color: F, x: 2.1, y: 1.3, z: .55 },
    { geo: B(4.8, .14, 1.9), color: F, y: 2.72 },
    { geo: B(4.4, 1.5, .06), color: G, y: 1.55, z: -.72 },
    { geo: B(.06, 1.5, 1.3), color: G, x: -2.08, y: 1.55, z: -.05 },
    { geo: B(.06, 1.5, 1.3), color: G, x: 2.08, y: 1.55, z: -.05 },
    { geo: B(3.4, .1, .5), color: '#6e5138', y: .55, z: -.4 },
    { geo: B(.12, .5, .5), color: F, x: -1.6, y: .3, z: -.4 },
    { geo: B(.12, .5, .5), color: F, x: 1.6, y: .3, z: -.4 },
    { geo: B(.9, .5, .04), color: '#1e6b46', y: 2.35, z: .78 },  // route placard
  ]);
}
/* USPS-style collection box */
function mailboxGeo() {
  const BL = '#2e5b8a';
  return colored([
    { geo: B(.5, .14, .42), color: '#2c3034', y: .07 },
    { geo: B(.64, .85, .52), color: BL, y: .57 },
    { geo: B(.6, .14, .48), color: BL, y: 1.05 },
    { geo: B(.36, .06, .03), color: '#1c2833', y: .92, z: .27 },   // mail slot
    { geo: B(.3, .18, .02), color: '#e8e6df', y: .68, z: .27 },    // logo plate
  ]);
}
/* newspaper box — body bakes white so the instance colour becomes the paint */
function newsboxGeo() {
  return colored([
    { geo: B(.5, .8, .42), color: '#f2f2f2', y: .52 },
    { geo: B(.42, .36, .03), color: '#28323a', y: .66, z: .22 },   // window
    { geo: B(.4, .1, .3), color: '#2c3034', y: .08 },
  ]);
}
/* litter bin — body white so instance colour picks trash-green / recycle-blue */
function binGeo() {
  return colored([
    { geo: C(.38, .32, .92, 10), color: '#f2f2f2', y: .46 },
    { geo: C(.42, .42, .08, 10), color: '#24292c', y: .95 },
  ]);
}
/* flush manhole disc */
function manholeGeo() {
  const g = new THREE.CircleGeometry(.55, 14); g.rotateX(-Math.PI / 2);
  return colored([{ geo: g, color: '#22262a' }]);
}
/* phone-booth kiosk — posts, sign band, pyramid cap, glass panels, open +z */
function kioskGeo() {
  const R_ = '#8e2f26', G = '#7fa6bd', F = '#3d4145';
  return colored([
    { geo: B(1.1, .12, 1.1), color: F, y: .06 },
    { geo: B(.08, 2.1, .08), color: F, x: -.5, y: 1.1, z: -.5 },
    { geo: B(.08, 2.1, .08), color: F, x: .5, y: 1.1, z: -.5 },
    { geo: B(.08, 2.1, .08), color: F, x: -.5, y: 1.1, z: .5 },
    { geo: B(.08, 2.1, .08), color: F, x: .5, y: 1.1, z: .5 },
    { geo: B(.92, 1.6, .04), color: G, y: 1.1, z: -.5 },
    { geo: B(.04, 1.6, .92), color: G, x: -.5, y: 1.1 },
    { geo: B(.04, 1.6, .92), color: G, x: .5, y: 1.1 },
    { geo: B(.92, .5, .04), color: G, y: .4, z: .5 },             // half door
    { geo: B(1.2, .3, 1.2), color: '#e8e6df', y: 2.05 },          // sign band
    { geo: B(1.3, .18, 1.3), color: R_, y: 2.3 },
    { geo: new THREE.ConeGeometry(.7, .5, 4), color: R_, y: 2.62, ry: Math.PI / 4 },
  ]);
}

/* ================= placement ================= */
export function buildFurniture(scene) {
  const benches = [], planters = [], hydrants = [], shelters = [],
        mailboxes = [], newsboxes = [], bins = [], manholes = [], kiosks = [];
  const n = { bench: 0, planter: 0, hydrant: 0, shelter: 0, mailbox: 0,
              newsbox: 0, bin: 0, manhole: 0, kiosk: 0 };

  /* ---- benches: ring around the plaza + flanking the park path ---- */
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + .31;
    const x = PLAZA.x + Math.cos(a) * 52, z = PLAZA.z + Math.sin(a) * 24;
    if (!isFree(x, z, 1.8)) continue;
    benches.push({ x, z, y: PLAZA_Y, ry: face(x, z, PLAZA.x, PLAZA.z) });
    n.bench++;
  }
  const P = PARK_ZONE, midZ = (P.z0 + P.z1) / 2;
  for (let t = .08, s = 1; t < .95; t += .11, s = -s) {
    const x = P.x0 + 20 + t * (P.x1 - P.x0 - 40);
    const pz = midZ + Math.sin(t * Math.PI * 2.4) * 70;
    const z = pz + s * 8;                          // path pads are 9+1 wide
    if (!isFree(x, z, 1.8)) continue;
    benches.push({ x, z, ry: face(x, z, x, pz) });
    n.bench++;
  }

  /* ---- planters: Main St sidewalk, downtown stretch x -80..40 ----
     storefront side is off-limits (the continuous-sidewalk occ rect is
     untagged so it can't be exempted) — planters take the south walk */
  const main = road('Main St');
  for (let x = -80; x <= 40; x += 17 + rr(-2, 2)) {
    const z = main.c + walkC(main);
    if (!isFree(x, z, 1.4, main)) continue;
    planters.push({ x, z, y: WALK_Y, ry: rr(-.15, .15) });
    n.planter++;
  }
  for (const px of [PLAZA.x - 30, PLAZA.x + 30]) {   // plaza north edge pair
    const z = PLAZA.z - PLAZA.d / 2 + 3;
    if (!isFree(px, z, 1.4)) continue;
    planters.push({ x: px, z, y: PLAZA_Y });
    n.planter++;
  }

  /* ---- hydrants near junctions: arterial crossings always, minors ~45% ---- */
  for (const i of intersections()) {
    if (!i.arterial && R() > .45) continue;
    const sx = R() < .5 ? -1 : 1, sz = R() < .5 ? -1 : 1;
    const x = i.x + sx * (streetBand(i.v) + .9);     // just past the corner walk
    const z = i.z + sz * walkC(i.h);
    if (!isFree(x, z, .9, [i.v, i.h])) continue;
    hydrants.push({ x, z });
    n.hydrant++;
  }

  /* ---- bus shelters at mid-block stops on arterials (open side faces road) ---- */
  const stops = [
    { r: road('University Ave'), a: -110, s: 1 },
    { r: road('Commerce Blvd'), a: 200, s: -1 },
    { r: road('Wellness Way'), a: 140, s: 1 },
    { r: road('Parkside Dr'), a: 120, s: -1 },
  ];
  for (const st of stops) {
    if (shelters.length >= 3) break;
    const r = st.r;
    const x = r.axis === 'v' ? r.c + walkC(r) * st.s : st.a;
    const z = r.axis === 'v' ? st.a : r.c + walkC(r) * st.s;
    if (!isFree(x, z, 3, r)) continue;
    shelters.push({ x, z, y: WALK_Y,
      ry: r.axis === 'v' ? (st.s > 0 ? -Math.PI / 2 : Math.PI / 2)
                         : (st.s > 0 ? Math.PI : 0) });
    n.shelter++;
  }

  /* ---- mailboxes: post-office frontage on Wellness + downtown Main ---- */
  const well = road('Wellness Way');
  for (const [x, z, rd] of [
    [126, well.c + walkC(well), well],
    [152, well.c + walkC(well), well],
    [34, main.c + walkC(main), main],
    [196, main.c + walkC(main), main],
    [128, -172, null],
  ]) {
    if (mailboxes.length >= 4 || !isFree(x, z, 1.2, rd)) continue;
    mailboxes.push({ x, z, y: rd ? WALK_Y : PLAZA_Y });
    n.mailbox++;
  }

  /* ---- newspaper boxes: cluster of 3 at a downtown corner ---- */
  const nbc = pick(['#8a2f2f', '#2e5b8a', '#b8860b', '#3e5a34']);
  const nbCols = ['#8a2f2f', '#2e5b8a', nbc];
  for (const i of [ix('University Ave', 'Main St'), ix('Grove St', 'Main St'),
                   ix('Parkside Dr', 'Commerce Blvd')].filter(Boolean)) {
    const x0 = i.x + streetBand(i.v) + 1.2, z0 = i.z + walkC(i.h);
    if (!isFree(x0, z0, 2.2, [i.v, i.h])) continue;
    for (let k = 0; k < 3; k++) {
      newsboxes.push({ x: x0 + k * .95, z: z0, y: WALK_Y, color: nbCols[k] });
      n.newsbox++;
    }
    break;
  }

  /* ---- trash + recycling pairs every 2nd block along Main / Commerce ---- */
  const pair = (x, z, y) => {
    bins.push({ x: x - .6, z, y, color: '#3d4a42' });
    bins.push({ x: x + .6, z, y, color: '#2e5b8a' });
    n.bin += 2;
  };
  const blocksOn = h => {
    const xs = ROADS.filter(r => r.axis === 'v' && r.a0 < h.c && r.a1 > h.c)
      .map(r => r.c).sort((a, b) => a - b);
    return [h.a0, ...xs, h.a1];
  };
  for (const h of [main, road('Commerce Blvd')]) {
    const edges = blocksOn(h), z = h.c + walkC(h);
    for (let i = 0; i < edges.length - 1; i++) {
      if (i % 2) continue;
      const x = (edges[i] + edges[i + 1]) / 2;
      if (h.name !== 'Main St' && (x < -160 || x > 340)) continue; // downtown reach only
      if (!isFree(x, z, 1.8, h)) continue;
      pair(x, z, WALK_Y);
    }
  }
  { // plaza corner pair + pairs along the south edge facing the shops
    const z = PLAZA.z + PLAZA.d / 2 - 6;
    if (isFree(PLAZA.x + PLAZA.w / 2 - 6, z, 1.8)) pair(PLAZA.x + PLAZA.w / 2 - 6, z, PLAZA_Y);
    for (const x of [PLAZA.x - 60, PLAZA.x, PLAZA.x + 60])
      if (isFree(x, z, 1.8)) pair(x, z, PLAZA_Y);
  }

  /* ---- manhole discs mid-lane (round, staggered off the square covers) ---- */
  for (const r of ROADS) {
    const off = rr(-r.w / 6, r.w / 6);
    for (let a = r.a0 + 55; a < r.a1 - 25; a += 95) {
      const x = r.axis === 'v' ? r.c + off : a;
      const z = r.axis === 'v' ? a : r.c + off;
      if (!isFree(x, z, .8, r)) continue;
      manholes.push({ x, z, y: Y + .007 });
      n.manhole++;
    }
  }

  /* ---- phone-booth kiosks ---- */
  for (const [x, z, y, ry, skip] of [
    [PLAZA.x + PLAZA.w / 2 - 2, PLAZA.z + 29, PLAZA_Y, face(PLAZA.x + PLAZA.w / 2 - 2, PLAZA.z + 29, PLAZA.x, PLAZA.z), null],
    [240, main.c + walkC(main), WALK_Y, Math.PI, main],
    [PLAZA.x - PLAZA.w / 2 + 4, PLAZA.z - 20, PLAZA_Y, Math.PI / 2, null],
  ]) {
    if (kiosks.length >= 2 || !isFree(x, z, 1.6, skip)) continue;
    kiosks.push({ x, z, y, ry });
    n.kiosk++;
  }

  /* ---- emit: one InstancedMesh per family, VCOL material ---- */
  const put = (geo, list, shadow) =>
    list.length && scene.add(instances(geo, VCOL(), thin(list), { shadow }));
  put(benchGeo(), benches, true);
  put(planterGeo(), planters, false);
  put(hydrantGeo(), hydrants, false);
  put(shelterGeo(), shelters, true);
  put(mailboxGeo(), mailboxes, false);
  put(newsboxGeo(), newsboxes, false);
  put(binGeo(), bins, false);
  put(manholeGeo(), manholes, false);
  put(kioskGeo(), kiosks, true);

  /* report kept (instanced) counts — on MIN the placed lists are thinned,
     so raw n.* would overstate what the scene renders */
  const kept = l => thin(l).length;
  CITY.furniture = {
    bench: kept(benches), planter: kept(planters), hydrant: kept(hydrants),
    shelter: kept(shelters), mailbox: kept(mailboxes), newsbox: kept(newsboxes),
    bin: kept(bins), manhole: kept(manholes), kiosk: kept(kiosks),
  };
  CITY.furniture.total = Object.values(CITY.furniture).reduce((a, b) => a + b, 0);
  return CITY.furniture;
}
