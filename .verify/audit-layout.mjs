// Spatial audit: building/lot/filler rects vs roads and vs each other.
import * as L from '../town/js/layout.js';

const rect = b => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 });
const ovl = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
                     Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
const MARGIN = 1; // m of shared boundary allowed before flagging

// road bands: v roads are x-bands, h roads z-bands
const roadBand = r => r.axis === 'v'
  ? { x0: r.c - r.w / 2, x1: r.c + r.w / 2, z0: r.a0, z1: r.a1 }
  : { x0: r.a0, x1: r.a1, z0: r.c - r.w / 2, z1: r.c + r.w / 2 };
const ROADB = L.ROADS.map(r => ({ ...roadBand(r), name: r.name }));

const items = [];
for (const b of L.BUILDINGS) if (b.w) items.push({ id: b.id || b.name, ...rect(b) });
for (const b of L.FILLER)   items.push({ id: `filler:${b.type}@${b.x},${b.z}`, ...rect(b) });
for (const b of L.LOTS)     items.push({ id: `lot@${b.x},${b.z}`, ...rect(b) });
items.push({ id: 'PLAZA', ...rect(L.PLAZA) });
for (const g of L.GREENS)   items.push({ id: `green:${g.name || g.use}`, x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z1 });
// extra build-time rects that aren't in layout data
items.push({ id: 'quadgrass', x0: -55, x1: 135, z0: -242, z1: -158 });
items.push({ id: 'cityhall', x0: -442, x1: -402, z0: -539, z1: -501 });

/* overlaps that are part of the design, reported as NOTE not FAIL:
   the ER apron lot sits at the dead end of Mercy Dr (the apron IS the road's
   end), and city hall anchors the plaza's east edge — both predate the audit. */
const KNOWN = [['lot@66,-458', 'Mercy Dr'], ['PLAZA', 'cityhall']];
const known = (a, b) => KNOWN.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

let bad = 0, noted = 0;
const flag = (a, b, area, kind) => {
  if (known(a, b)) { console.log(`NOTE  ${kind} ${a} x ${b} (${area.toFixed(0)}m^2) — intended`); noted++; return; }
  console.log(`${kind}  ${a} overlaps ${b} by ${area.toFixed(0)}m^2`); bad++;
};
for (const it of items)
  for (const rd of ROADB) {
    const a = ovl(it, rd);
    if (a > MARGIN) flag(it.id, rd.name, a, 'ROAD');
  }
for (let i = 0; i < items.length; i++)
  for (let j = i + 1; j < items.length; j++) {
    const a = ovl(items[i], items[j]);
    if (a > MARGIN) flag(items[i].id, items[j].id, a, 'PAIR');
  }
console.log(bad ? `FAIL ${bad} overlaps` : `OK ${items.length} rects, ${bad} overlaps (${noted} intended)`);
process.exitCode = bad ? 1 : 0;
