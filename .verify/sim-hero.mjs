// sim-hero.mjs — dry-run hero/wayfinding site eligibility against the occ model.
// Mirrors js/city/occ.js + registerOccupancy + FILLER/house occupancy so we can
// verify isFree passes before booting the browser.
import { ROADS, LOTS, WATER, BUILDINGS, APARTMENTS, GREENS, FILLER, HOUSE_BLOCKS, COTTAGE_ROWS } from '../town/js/layout.js';

const occupied = [];
const occupyRect = (x, z, w, d, pad = 4, tag = null, kind = null) =>
  occupied.push({ x0: x - w / 2 - pad, x1: x + w / 2 + pad, z0: z - d / 2 - pad, z1: z + d / 2 + pad, tag, kind });
const streetPad = r => (r.arterial || r.w >= 16) ? 3.4 : 4.4;
function isFree(x, z, r = 3, skip = null) {
  for (const o of occupied) {
    if (skip !== null &&
        (Array.isArray(skip) ? skip.includes(o.tag) || skip.includes(o.kind)
                             : o.tag === skip || o.kind === skip)) continue;
    if (x + r > o.x0 && x - r < o.x1 && z + r > o.z0 && z - r < o.z1) return false;
  }
  return true;
}
for (const b of BUILDINGS) if (b.w) occupyRect(b.x, b.z, b.w, b.d, 6, b, 'bldg');
for (const a of APARTMENTS) occupyRect(a.x, a.z, a.w, a.d, 6, a, 'bldg');
for (const l of LOTS) occupyRect(l.x, l.z, l.w, l.d, 1, l, 'lot');
for (const wd of WATER) occupyRect(wd.x, wd.z, wd.r * 2 * wd.sx, wd.r * 2 * wd.sz, 4, wd, 'water');
for (const g of GREENS) occupyRect((g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2, g.x1 - g.x0, g.z1 - g.z0, 1, g, 'green');
for (const rd of ROADS) {
  const pad = streetPad(rd);
  if (rd.axis === 'v') occupyRect(rd.c, (rd.a0 + rd.a1) / 2, rd.w + 2, rd.a1 - rd.a0, pad, rd, 'road');
  else occupyRect((rd.a0 + rd.a1) / 2, rd.c, rd.a1 - rd.a0, rd.w + 2, pad, rd, 'road');
}
// post-buildProps occupancy (main.js order): FILLER rects, houses, cottages
for (const f of FILLER) occupyRect(f.x, f.z, f.w, f.d, 4, f, 'bldg');
for (const blk of HOUSE_BLOCKS) {
  // approximate house scatter rects as a coarse block cover — houses register
  // per-house rects; the block interior is effectively saturated
  for (let i = 0; i < blk.count; i++) {
    const fx = blk.x0 + (blk.x1 - blk.x0) * (i + .5) / blk.count;
    occupyRect(fx, (blk.z0 + blk.z1) / 2, 24, blk.z1 - blk.z0 + 4, 0, blk, 'bldg');
  }
}
for (const row of COTTAGE_ROWS)
  for (let i = 0; i < row.count; i++)
    occupyRect(row.x0 + (row.x1 - row.x0) * (i + .5) / row.count, row.z, 22, 20, 2, row, 'bldg');

const rd = n => ROADS.find(r => r.name === n);
const checks = [
  ['pylon c1', 98, -380, 4.6, null], ['pylon c2', 104, -382, 4.6, null],
  ['pylon c3', 94, -386, 4.6, null], ['pylon c4', 108, -378, 4.6, null], ['pylon c5', 98, -388, 4.6, null],
  ['quad monument', -480, -532, 10, null],
  ['flag N', -493, -531, 1.4, null], ['flag S', -467, -531, 1.4, null], ['flag W', -480, -546, 1.4, null],
  ['pavilion', 700, 170, 9.6, null],
  ['totem parkside', 344, 148, 1.8, null], ['totem commerce', 560, 298, 1.8, null],
  ['way mercy', 104, -350.5, 1.2, [rd('Mercy Dr'), rd('Wellness Way')]],
  ['way univ-campus', -150, -625, 1.2, [rd('University Ave'), rd('Campus Dr')]],
  ['way scholar-mid', -448, -171, 1.2, [rd('Scholar Ln'), rd('Midtown Ave')]],
  ['way univ-main', -121, -57, 1.2, [rd('University Ave'), rd('Main St')]],
  ['way univ-commerce', -157, 303, 1.2, [rd('University Ave'), rd('Commerce Blvd')]],
  ['board mall', 390, 428, 1.4, null],
  ['board plaza', 52, -203, 1.4, null],
  ['way grove-commerce', 95, 302, 1.2, [rd('Grove St'), rd('Commerce Blvd')]],
  ['way univ-wellness', -157, -376, 1.2, [rd('University Ave'), rd('Wellness Way')]],
];
let fail = 0;
for (const [name, x, z, r, skip] of checks)
  console.log((isFree(x, z, r, skip) ? 'PASS' : (fail++, 'FAIL')) + '  ' + name.padEnd(20), x, z);
console.log(fail ? `\n${fail} site(s) blocked` : '\nall sites free');
