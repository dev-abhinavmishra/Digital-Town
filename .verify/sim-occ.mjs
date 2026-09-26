// sim-occ.mjs — offline occupancy sim for the lamp/furniture/hedge band bug.
// Replicates the exact occupancy state each consumer sees at its buildProps/
// buildLights call site in main.js (registerOccupancy at :113, buildProps :119,
// FILLER/houses/cottages :122-170, buildLights :172).
// isFree() is called with the proposed 4th `skip` arg — ignored by the old
// occ.js (baseline run), honoured by the tagged-rect occ.js (post-fix run).
// Usage: node sim-occ.mjs [houseShape=house|ranch]
import { ROADS, LOTS, WATER, BUILDINGS, APARTMENTS, GREENS, FILLER,
         HOUSE_BLOCKS, COTTAGE_ROWS, PARK_ZONE } from '../town/js/layout.js';
import { occupied, occupyRect, isFree, registerOccupancy,
         streetBand, streetPad } from '../town/js/city/occ.js';

const HOUSE_SHAPE = process.argv[2] || 'house';

// intersections() reimplemented (streetscape.js pulls in three.js — not node-safe)
const vs = ROADS.filter(r => r.axis === 'v'), hs = ROADS.filter(r => r.axis === 'h');
const allJ = [];
for (const v of vs) for (const h of hs)
  if (h.a0 < v.c && v.c < h.a1 && v.a0 < h.c && h.c < v.a1)
    allJ.push({ x: v.c, z: h.c, wv: v.w, wh: h.w, vn: v.name, hn: h.name,
                arterial: v.arterial && h.arterial });
const nearJxn = (x, z) => allJ.some(j =>
  Math.abs(x - j.x) < j.wv / 2 + 10 && Math.abs(z - j.z) < j.wh / 2 + 10);

/* ============ occupancy state at buildProps() (main.js:119) ============ */
registerOccupancy();
// buildPark feature rects (details.js:732-738)
occupyRect(505, 95, 13, 13, 3);            // gazebo
occupyRect(540, 132, 20, 16, 2);           // dock
occupyRect(415, 60, 38, 28, 3);            // playground
occupyRect(430, 235, 72, 72, 3);           // ball field
const P = PARK_ZONE;
for (let t = 0; t <= 1; t += .04)
  occupyRect(P.x0 + 20 + t * (P.x1 - P.x0 - 40),
             (P.z0 + P.z1) / 2 + Math.sin(t * Math.PI * 2.4) * 70, 9, 9, 1);
// buildAthleticPark rects (details.js:801,844,852,861)
occupyRect(-30, 570, 92, 58, 2);
occupyRect(-30, 670, 92, 58, 2);
occupyRect(160, 580, 76, 76, 4);
occupyRect(262, 655, 84, 62, 4);
occupyRect(130, 505, 30, 24, 4);

/* ---- furniture scatter (details.js:1114-1127), geometric pass before R()>.62 ---- */
let furnPass = 0, furnTotal = 0, furnBlockedByRoadSelf = 0;
const perRoad = {};
for (const r of ROADS) {
  const step = r.arterial ? 30 : 38;
  const walkOff = r.w / 2 + (r.arterial ? 2.5 : 2.1);
  let roadPass = 0;
  for (let a = r.a0 + 20; a < r.a1 - 20; a += step) {   // rr(-4,4) jitter ≈ step on average
    for (const s of [-1, 1]) {
      const x = r.axis === 'v' ? r.c + walkOff * s : a;
      const z = r.axis === 'v' ? a : r.c + walkOff * s;
      furnTotal++;
      if (nearJxn(x, z)) continue;
      if (!isFree(x, z, .9, r)) continue;              // r = own-road tag skip (post-fix)
      furnPass++; roadPass++;
    }
  }
  perRoad[r.name] = roadPass;
}
// expected yield ≈ geometric pass × P(R()<=.62)
console.log(`FURNITURE: ${furnTotal} candidates -> ${furnPass} geometric pass, ` +
            `~${Math.round(furnPass * .62)} expected placed (contract >= 380)`);
console.log('  per-road pass:', JSON.stringify(perRoad));

/* ---- signal junctions (A2) ---- */
const WANT_SIG = [
  ['Main St', 'University Ave'], ['Main St', 'Scholar Ln'],
  ['Elm St', 'Cedar Ave'], ['Commerce Blvd', 'University Ave'],
  ['Commerce Blvd', 'Cedar Ave'], ['Midtown Ave', 'University Ave'],
  ['Schoolhouse Rd', 'Cedar Ave'], ['Commerce Blvd', 'Parkside Dr'],
  ['Wellness Way', 'Parkside Dr'], ['Wellness Way', 'University Ave'],
];
const wanted = WANT_SIG.map(([a, b]) => allJ.find(i =>
  (i.vn === a && i.hn === b) || (i.vn === b && i.hn === a)));
console.log(`SIGNALS: ${wanted.filter(Boolean).length}/10 wanted junctions found` +
  (wanted.some(w => !w) ? '  MISSING: ' + WANT_SIG.filter((_, i) => !wanted[i]).map(p => p.join('x')).join(', ') : ''));

/* ---- hedges on BUILDINGS frontages (details.js:1154-1163) ---- */
let hedgeBldg = 0;
for (const b of BUILDINGS) {
  if (!b.w || b.type === 'zone' || b.type === 'parkzone') continue;
  const hz = b.z + b.d / 2 + .9;
  if (isFree(b.x, hz, 1.5, [b, 'road'])) hedgeBldg++;   // skip own bldg + road band (post-fix)
}
const nTH = FILLER.filter(f => f.type === 'townhouse').length;
console.log(`HEDGES: ${hedgeBldg} building frontages x2 + ${nTH} townhouse rows = ` +
            `${hedgeBldg * 2 + nTH} total (contract >= 60)`);

/* ============ occupancy state at buildLights() (main.js:172) ============ */
// FILLER + houses + cottages register between buildProps and buildLights
for (const f of FILLER) occupyRect(f.x, f.z, f.w, f.d, 4);
for (const blk of HOUSE_BLOCKS) {
  const W = blk.x1 - blk.x0, D = blk.z1 - blk.z0;
  const t = blk.duplex ? 'duplex' : HOUSE_SHAPE;
  if (blk.face === 'v') {
    for (let i = 0; i < blk.count; i++) {
      const z = blk.z0 + (i + .5) * D / blk.count;
      const x = blk.x1 - 12;
      if (t === 'ranch') occupyRect(x + 3.5, z - 4, 20, 28, 2);
      else occupyRect(x + 3.5, z - 2.5, 20, 20, 2);
    }
  } else {
    const twoRows = D > 80, rows = twoRows ? 2 : 1;
    for (let rI = 0; rI < rows; rI++) {
      const n = Math.ceil(blk.count / rows);
      const z = twoRows ? (rI === 0 ? blk.z0 + 13 : blk.z1 - 13) : blk.z1 - 13;
      const sgn = rI === 0 && twoRows ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const x = blk.x0 + 14 + i * (W - 28) / Math.max(1, n - 1);
        if (!isFree(x, z, 8)) continue;
        if (t === 'duplex') occupyRect(x, z + sgn, 19, 15, 2);
        else if (t === 'ranch') occupyRect(x + sgn * 4, z + sgn * 3, 28, 20, 2);
        else occupyRect(x + sgn * 2, z + sgn * 3, 22, 20, 2);
      }
    }
  }
}
for (const row of COTTAGE_ROWS) {
  const W = row.x1 - row.x0;
  const sgn = row.face === 'n' ? -1 : 1;
  for (let i = 0; i < row.count; i++) {
    const x = row.x0 + 12 + i * (W - 24) / Math.max(1, row.count - 1);
    occupyRect(x + sgn * 2, row.z + sgn * 3, 22, 20, 2);
  }
}
// late buildProps rects (details.js:1202,1210,1230)
occupyRect(-560, 645, 44, 30, 3);
occupyRect(-730, 590, 142, 102, 3);
occupyRect(81, -52, 388, 8, 1);

/* ---- lamps (details.js:558-570) ---- */
let lamps = 0, lampTotal = 0;
const lampPerRoad = {};
for (const r of ROADS.filter(r => r.arterial || r.w >= 11)) {
  let n = 0;
  for (let a = r.a0 + 16; a < r.a1 - 16; a += 42) {
    const s = (Math.floor(a / 42) % 2) ? 1 : -1;
    const off = (r.w / 2 + 1.6) * s;
    const x = r.axis === 'v' ? r.c + off : a;
    const z = r.axis === 'v' ? a : r.c + off;
    lampTotal++;
    if (!isFree(x, z, 1, r)) continue;                  // r = own-road tag skip (post-fix)
    lamps++; n++;
  }
  lampPerRoad[r.name] = n;
}
console.log(`LAMPS: ${lampTotal} candidates -> ${lamps} placed (was 0 — lampIM empty)`);
console.log('  per-road:', JSON.stringify(lampPerRoad));
console.log(`occupied rects total: ${occupied.length}`);
