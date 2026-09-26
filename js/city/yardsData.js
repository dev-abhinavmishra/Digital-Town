// city/yardsData.js — pure-math yard-lot + commons-rect model, shared by the
// renderer (city/yards.js) and the audit (audit.mjs). Mirrors the house
// placement math in main.js exactly; consumes NO R() so both sides agree.
import { HOUSE_BLOCKS, COTTAGE_ROWS } from '../layout.js';

/* Returns [{x,z,w,d,kind}] — the fenced-backyard lots that sit behind each
   frontage house (into the block interior), plus 'commons' rects on the
   leftover interior bands between opposing backyard strips. */
export function yardLots() {
  const lots = [];
  for (const blk of HOUSE_BLOCKS) {
    const W = blk.x1 - blk.x0, D = blk.z1 - blk.z0;
    if (blk.face === 'v') {
      // houses at x = x1-12 facing +x; backyards extend toward x0 (west)
      const n = blk.count, D2 = blk.z1 - blk.z0;
      const yd = Math.min(14, (blk.x1 - 12) - 11 - blk.x0 - 2);
      if (yd >= 6) {
        for (let i = 0; i < n; i++) {
          const z = blk.z0 + (i + .5) * D2 / n;
          lots.push({ x: blk.x1 - 12 - 11 - yd / 2, z, w: yd, d: Math.min(D2 / n - 1.5, 18),
            kind: 'yard', face: 'w', hx: blk.x1 - 12, hz: z });
        }
        // interior commons: strip west of the yard band
        const cw = (blk.x1 - 12 - 11 - yd) - blk.x0 - 2;
        if (cw >= 10)
          lots.push({ x: blk.x0 + cw / 2 + 1, z: (blk.z0 + blk.z1) / 2, w: cw, d: D2 - 6,
            kind: 'commons' });
      }
      continue;
    }
    const twoRows = D > 80, rows = twoRows ? 2 : 1;
    for (let rI = 0; rI < rows; rI++) {
      const n = Math.ceil(blk.count / rows);
      const hz = twoRows ? (rI === 0 ? blk.z0 + 13 : blk.z1 - 13) : blk.z1 - 13;
      const sgn = twoRows ? (rI === 0 ? 1 : -1) : -1;   // backyard direction (into interior)
      const spacing = (W - 28) / Math.max(1, n - 1);
      // interior bound: two-row blocks meet the opposite row's rear band;
      // single-row blocks run to the block edge
      const zIn = twoRows ? (rI === 0 ? blk.z1 - 21 : blk.z0 + 21) : blk.z0 + 2;
      for (let i = 0; i < n; i++) {
        const x = blk.x0 + 14 + i * spacing;
        const rear = hz + sgn * 11;                       // just behind the house
        const avail = sgn > 0 ? zIn - rear : rear - zIn;
        const yd = Math.min(14, avail);
        if (yd < 5.5) continue;
        lots.push({ x, z: rear + sgn * yd / 2, w: Math.min(spacing - 2, 22), d: yd,
          kind: 'yard', face: sgn > 0 ? 'n' : 's', hx: x, hz });
      }
    }
    // one shared commons band between the yard strips (or behind the row)
    {
      const cz0 = twoRows ? blk.z0 + 38 : blk.z0 + 2,
            cz1 = blk.z1 - 38, cd = cz1 - cz0;
      if (cd >= 10)
        lots.push({ x: (blk.x0 + blk.x1) / 2, z: (cz0 + cz1) / 2, w: W - 4, d: cd,
          kind: 'commons' });
    }
  }
  // cottage backyards (senior district): shallow fenced garden plots
  for (const row of COTTAGE_ROWS) {
    const W = row.x1 - row.x0;
    const sgn = row.face === 'n' ? 1 : -1;              // backyard side
    const n = row.count;
    for (let i = 0; i < n; i++) {
      const x = row.x0 + 12 + i * (W - 24) / Math.max(1, n - 1);
      const rear = row.z + sgn * 11;
      lots.push({ x, z: rear + sgn * 4.5, w: Math.min((W - 24) / Math.max(1, n - 1) - 1.5, 20),
        d: 9, kind: 'yard', face: sgn > 0 ? 'n' : 's', hx: x, hz: row.z });
    }
  }
  return lots;
}
