// city/occ.js — ground occupancy model for scattering + audit mirror.
// details.js re-exports everything below; audit.mjs mirrors the math in node
// (no three.js) — keep the pad formula in sync with audit.mjs streetPad().
import { ROADS, LOTS, WATER, BUILDINGS, APARTMENTS, GREENS } from '../layout.js';

export const occupied = [];

/* tag = the layout object that registered the rect (road/building/lot...);
   kind = broad class ('road'|'bldg'|'lot'|'water'|'green'). Both default null
   on ad-hoc feature rects — untagged rects can never be skipped below. */
export function occupyRect(x, z, w, d, pad = 4, tag = null, kind = null) {
  occupied.push({ x0: x - w / 2 - pad, x1: x + w / 2 + pad, z0: z - d / 2 - pad,
                  z1: z + d / 2 + pad, tag, kind });
}

/* skip exempts matching rects from this one check — a single tag/kind value
   or an array mixing both. Intentional-band placements need it: lamp poles
   and sidewalk furniture sit inside their own road's streetscape band and
   frontage hedges inside their own building pad, so an unqualified isFree
   self-rejects every spot. Everything else keeps full-band protection. */
export function isFree(x, z, r = 3, skip = null) {
  for (const o of occupied) {
    if (skip !== null &&
        (Array.isArray(skip) ? skip.includes(o.tag) || skip.includes(o.kind)
                             : o.tag === skip || o.kind === skip)) continue;
    if (x + r > o.x0 && x - r < o.x1 && z + r > o.z0 && z - r < o.z1) return false;
  }
  return true;
}

/* Road occupancy pad: half-width beyond the road ribbon that scatter must keep
   clear. Now covers the full streetscape band (gutter + curb + verge + raised
   sidewalk) so trees/bushes/props can never spawn on hardscape:
     arterial/wide : curb .53 + walk 3.05  -> edge w/2+3.58, pad w/2+1+3.4 = +5.4
     minor         : curb .53 + verge 1.3 + walk 2.7 -> edge w/2+4.6, pad +6.4
   Street trees sit outside this band at w/2+6.6 (minor) / w/2+5.4 (arterial). */
export function streetPad(r) {
  return (r.arterial || r.w >= 16) ? 3.4 : 4.4;
}
export function streetBand(r) {           // outer edge of hardscape, from centerline
  return r.w / 2 + 1 + streetPad(r);
}

export function registerOccupancy() {
  for (const b of BUILDINGS) if (b.w) occupyRect(b.x, b.z, b.w, b.d, 6, b, 'bldg');
  for (const a of APARTMENTS) occupyRect(a.x, a.z, a.w, a.d, 6, a, 'bldg');
  for (const l of LOTS) occupyRect(l.x, l.z, l.w, l.d, 1, l, 'lot');
  for (const wd of WATER) occupyRect(wd.x, wd.z, wd.r * 2 * wd.sx, wd.r * 2 * wd.sz, 4, wd, 'water');
  // programmed green parcels: interior is curated by buildGreens — keep the
  // generic scatter off beds/paths/ponds
  for (const g of GREENS)
    occupyRect((g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2, g.x1 - g.x0, g.z1 - g.z0, 1, g, 'green');
  for (const rd of ROADS) {
    const pad = streetPad(rd);
    if (rd.axis === 'v') occupyRect(rd.c, (rd.a0 + rd.a1) / 2, rd.w + 2, rd.a1 - rd.a0, pad, rd, 'road');
    else occupyRect((rd.a0 + rd.a1) / 2, rd.c, rd.a1 - rd.a0, rd.w + 2, pad, rd, 'road');
  }
}
