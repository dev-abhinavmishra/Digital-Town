// audit.mjs — geometric overlap audit of the Havenbrook layout (no three.js needed)
// Imports the real layout module (requires "type":"module" in package.json) so the
// audit can never drift out of sync with what the scene actually builds.
import { ROADS, LOTS, WATER, BUILDINGS, APARTMENTS, HOUSE_BLOCKS, COTTAGE_ROWS, PLAZA, PARK_ZONE, FILLER, GREENS } from './js/layout.js';
import { yardLots } from './js/city/yardsData.js';

const rect = (x, z, w, d) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
const overlap = (a, b) => {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  return (ox > 0.05 && oz > 0.05) ? { ox: +ox.toFixed(1), oz: +oz.toFixed(1) } : null;
};

// road rects (no pad — we care about asphalt itself)
const roadRects = ROADS.map(r => r.axis === 'v'
  ? { name: `road:${r.name}`, ...rect(r.c, (r.a0 + r.a1) / 2, r.w, r.a1 - r.a0) }
  : { name: `road:${r.name}`, ...rect((r.a0 + r.a1) / 2, r.c, r.a1 - r.a0, r.w) });

// building rects
const bRects = BUILDINGS.filter(b => b.w).map(b => ({ name: `bldg:${b.id}`, ...rect(b.x, b.z, b.w, b.d) }));
bRects.push(...APARTMENTS.map(a => ({ name: `apt:${a.name}`, ...rect(a.x, a.z, a.w, a.d) })));
bRects.push(...FILLER.map((f, i) => ({ name: `filler:${i}(${f.type})`, ...rect(f.x, f.z, f.w, f.d) })));

const lotRects = LOTS.map((l, i) => ({ name: `lot:${i}(${l.name || ''})`, ...rect(l.x, l.z, l.w, l.d) }));
const watRects = WATER.map(w => ({ name: 'water', ...rect(w.x, w.z, w.r * 2 * w.sx, w.r * 2 * w.sz) }));
const plazaR = { name: 'plaza', ...rect(PLAZA.x, PLAZA.z, PLAZA.w, PLAZA.d) };

// occupancy model — mirrors city/occ.js registerOccupancy(): bldg/apt 6, filler 4,
// lots 1, water 4, greens 1, roads widen to cover the full streetscape band
// (gutter+curb+verge+sidewalk): lateral = w/2+1+streetPad, ends +1.
// 'h'-row houses only exist where isFree(x, z, 8) holds in main.js.
const streetPad = r => (r.arterial || r.w >= 16) ? 3.4 : 4.4;   // keep in sync with city/occ.js
const occupied = [
  ...ROADS.map(r => {
    const p = streetPad(r) + 1;
    return r.axis === 'v'
      ? { x0: r.c - r.w / 2 - p, x1: r.c + r.w / 2 + p, z0: r.a0 - 1, z1: r.a1 + 1 }
      : { x0: r.a0 - 1, x1: r.a1 + 1, z0: r.c - r.w / 2 - p, z1: r.c + r.w / 2 + p };
  }),
  ...bRects.map(b => {
    const p = b.name.startsWith('filler:') ? 4 : 6;
    return { x0: b.x0 - p, x1: b.x1 + p, z0: b.z0 - p, z1: b.z1 + p };
  }),
  ...lotRects.map(l => ({ x0: l.x0 - 1, x1: l.x1 + 1, z0: l.z0 - 1, z1: l.z1 + 1 })),
  ...watRects.map(w => ({ x0: w.x0 - 4, x1: w.x1 + 4, z0: w.z0 - 4, z1: w.z1 + 4 })),
  ...GREENS.map(g => ({ x0: g.x0 - 1, x1: g.x1 + 1, z0: g.z0 - 1, z1: g.z1 + 1 })),
];
const greenRects = GREENS.map(g => ({ name: `green:${g.id}(${g.use})`, ...g }));
const houseFree = (x, z) => !occupied.some(o =>
  x + 8 > o.x0 && x - 8 < o.x1 && z + 8 > o.z0 && z - 8 < o.z1);

// houses (footprints incl. garage wing + driveway, matching occupyRect in main.js)
for (const blk of HOUSE_BLOCKS) {
  const W = blk.x1 - blk.x0, D = blk.z1 - blk.z0;
  if (blk.face === 'v') {
    for (let i = 0; i < blk.count; i++) {
      const z = blk.z0 + (i + .5) * D / blk.count;
      bRects.push({ name: `house:v@${(blk.x1 - 12).toFixed(0)},${z.toFixed(0)}`,
        ...rect(blk.x1 - 12 + 3.5, z - 2.5, 20, 20) });
    }
  } else {
    const twoRows = D > 80, rows = twoRows ? 2 : 1;
    for (let rI = 0; rI < rows; rI++) {
      const n = Math.ceil(blk.count / rows);
      const z = twoRows ? (rI === 0 ? blk.z0 + 13 : blk.z1 - 13) : blk.z1 - 13;
      const sgn = rI === 0 && twoRows ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const x = blk.x0 + 14 + i * (W - 28) / Math.max(1, n - 1);
        if (!houseFree(x, z)) continue;
        bRects.push({ name: `house@${x.toFixed(0)},${z.toFixed(0)}`,
          ...rect(x + sgn * 2, z + sgn * 3, 22, 20) });
      }
    }
  }
}
for (const row of COTTAGE_ROWS) {
  const W = row.x1 - row.x0;
  const sgn = row.face === 'n' ? -1 : 1;
  for (let i = 0; i < row.count; i++) {
    const x = row.x0 + 12 + i * (W - 24) / Math.max(1, row.count - 1);
    bRects.push({ name: `cottage@${x.toFixed(0)},${row.z}`, ...rect(x + sgn * 2, row.z + sgn * 3, 22, 20) });
  }
}

// special features placed by details.js / main.js (approx footprints)
const features = [
  { name: 'feat:soccer1', ...rect(-30, 570, 84, 50) },
  { name: 'feat:soccer2', ...rect(-30, 670, 84, 50) },
  { name: 'feat:baseball', ...rect(160, 580, 76, 76) },
  { name: 'feat:retpond', ...rect(262, 655, 84, 62) },
  { name: 'feat:athplay', ...rect(130, 505, 30, 24) },
  { name: 'feat:quad', ...rect(-480, -530, 190, 84) },
  { name: 'feat:trackring', ...rect(-730, 590, 137, 98) },   // ring 36*1.9 x, 36*1.35 z
  { name: 'feat:schfield', ...rect(-730, 590, 90, 55) },
  { name: 'feat:schplay', ...rect(-560, 645, 40, 26) },
  { name: 'feat:ballfield', ...rect(430, 235, 68, 68) },
  { name: 'feat:parkplay', ...rect(415, 60, 34, 24) },
  { name: 'feat:gazebo', ...rect(505, 95, 11, 11) },
  { name: 'feat:dock', ...rect(540, 132, 20, 16) },
  { name: 'feat:swalk', ...rect(81, -52, 388, 8) },
  { name: 'feat:campusgate', ...rect(-480, -505, 26, 4) },
  { name: 'feat:preservecommons', ...rect(-530, 238, 74, 52) },
];

console.log('=== ROADS vs BUILDINGS ===');
for (const r of roadRects) for (const b of bRects) {
  const o = overlap(r, b); if (o) console.log(`${r.name}  x  ${b.name}   ov ${o.ox} x ${o.oz}`);
}
console.log('\n=== ROADS vs LOTS ===');
for (const r of roadRects) for (const l of lotRects) {
  const o = overlap(r, l); if (o) console.log(`${r.name}  x  ${l.name}   ov ${o.ox} x ${o.oz}`);
}
console.log('\n=== ROADS vs FEATURES/WATER/PLAZA ===');
for (const r of roadRects) for (const f of [...features, ...watRects, plazaR]) {
  const o = overlap(r, f); if (o) console.log(`${r.name}  x  ${f.name}   ov ${o.ox} x ${o.oz}`);
}
console.log('\n=== BUILDINGS vs BUILDINGS ===');
for (let i = 0; i < bRects.length; i++) for (let j = i + 1; j < bRects.length; j++) {
  const o = overlap(bRects[i], bRects[j]); if (o) console.log(`${bRects[i].name}  x  ${bRects[j].name}   ov ${o.ox} x ${o.oz}`);
}
console.log('\n=== BUILDINGS vs LOTS ===');
for (const b of bRects) for (const l of lotRects) {
  const o = overlap(b, l); if (o) console.log(`${b.name}  x  ${l.name}   ov ${o.ox} x ${o.oz}`);
}
console.log('\n=== FEATURES vs BUILDINGS/LOTS/PLAZA ===');
for (const f of features) for (const b of [...bRects, ...lotRects, plazaR]) {
  const o = overlap(f, b); if (o) console.log(`${f.name}  x  ${b.name}   ov ${o.ox} x ${o.oz}`);
}
console.log('\n=== WATER vs BUILDINGS ===');
for (const w of watRects) for (const b of bRects) {
  const o = overlap(w, b); if (o) console.log(`${w.name}  x  ${b.name}   ov ${o.ox} x ${o.oz}`);
}
// green parcels are checked against the full streetscape band (asphalt+pad),
// buildings, lots, water, features, and each other
console.log('\n=== GREENS vs STREETSCAPE BAND ===');
const bandRects = ROADS.map(r => {
  const p = r.w / 2 + 1 + streetPad(r);
  return { name: `band:${r.name}`, ...rect(r.axis === 'v' ? r.c : (r.a0 + r.a1) / 2,
    r.axis === 'v' ? (r.a0 + r.a1) / 2 : r.c,
    r.axis === 'v' ? p * 2 : r.a1 - r.a0, r.axis === 'v' ? r.a1 - r.a0 : p * 2) };
});
for (const g of greenRects) for (const b of bandRects) {
  const o = overlap(g, b); if (o) console.log(`${g.name}  x  ${b.name}   ov ${o.ox} x ${o.oz}`);
}
console.log('\n=== GREENS vs BUILDINGS/LOTS/WATER/FEATURES/PLAZA ===');
for (const g of greenRects) for (const b of [...bRects, ...lotRects, ...watRects, ...features, plazaR]) {
  const o = overlap(g, b); if (o) console.log(`${g.name}  x  ${b.name}   ov ${o.ox} x ${o.oz}`);
}
console.log('\n=== GREENS vs GREENS ===');
for (let i = 0; i < greenRects.length; i++) for (let j = i + 1; j < greenRects.length; j++) {
  const o = overlap(greenRects[i], greenRects[j]); if (o) console.log(`${greenRects[i].name}  x  ${greenRects[j].name}   ov ${o.ox} x ${o.oz}`);
}
// fenced yards + interior commons (round-2 infill): rect model shared with
// the renderer via js/city/yardsData.js. The renderer only builds a lot when
// its centre is on free interior ground (isFree r=4 at buildYards time) —
// model the same skip here, then verify kept rects are clear of everything.
const yardOcc = [
  ...occupied,
  ...bRects.map(b => ({ x0: b.x0 - .5, x1: b.x1 + .5, z0: b.z0 - .5, z1: b.z1 + .5 })),
  ...features.map(f => ({ ...f })),
  { ...plazaR },
];
const ptFree = (x, z, r) => !yardOcc.some(o =>
  x + r > o.x0 && x - r < o.x1 && z + r > o.z0 && z - r < o.z1);
const yardFree = y => ptFree(y.x, y.z, 1.2) &&
  ptFree(y.x - y.w / 2 + 1, y.z - y.d / 2 + 1, 1) && ptFree(y.x + y.w / 2 - 1, y.z - y.d / 2 + 1, 1) &&
  ptFree(y.x - y.w / 2 + 1, y.z + y.d / 2 - 1, 1) && ptFree(y.x + y.w / 2 - 1, y.z + y.d / 2 - 1, 1);
const allYards = yardLots().map((y, i) => ({ name: `yard:${i}(${y.kind})`,
  x: y.x, z: y.z, w: y.w, d: y.d, ...rect(y.x, y.z, y.w, y.d), kind: y.kind }));
const keptYards = allYards.filter(yardFree), skippedYards = allYards.length - keptYards.length;
console.log('\n=== YARDS vs BUILDINGS/LOTS/WATER/FEATURES/PLAZA/GREENS (kept lots) ===');
for (const y of keptYards) for (const b of [...bRects, ...lotRects, ...watRects, ...features, plazaR, ...greenRects]) {
  const o = overlap(y, b); if (o) console.log(`${y.name}  x  ${b.name}   ov ${o.ox} x ${o.oz}`);
}
console.log('\n=== YARDS vs STREETSCAPE BAND (kept lots) ===');
for (const y of keptYards) for (const b of bandRects) {
  const o = overlap(y, b); if (o) console.log(`${y.name}  x  ${b.name}   ov ${o.ox} x ${o.oz}`);
}
console.log('\n=== YARDS vs YARDS (kept lots) ===');
for (let i = 0; i < keptYards.length; i++) for (let j = i + 1; j < keptYards.length; j++) {
  const o = overlap(keptYards[i], keptYards[j]); if (o) console.log(`${keptYards[i].name}  x  ${keptYards[j].name}   ov ${o.ox} x ${o.oz}`);
}
console.log(`\nyard lots: ${allYards.length} modelled, ${keptYards.length} kept, ${skippedYards} skipped by occupancy (${keptYards.filter(y=>y.kind==='commons').length} commons)`);
console.log('\ndone');
