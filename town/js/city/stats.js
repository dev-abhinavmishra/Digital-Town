// city/stats.js — CITY build counters, published as window.__city for the
// evaluator's probes (contract A-checks). Populated by streetscape/greens.
export const CITY = {
  roads: 0,
  curbRuns: 0, gutterRuns: 0, sidewalkRuns: 0, vergeRuns: 0,
  ramps: 0, tactilePads: 0, aprons: 0,
  markings: { dyellow: 0, dash: 0, edge: 0, stopbar: 0, crosswalkBars: 0,
              arrows: 0, twltlArrows: 0 },
  drains: 0, manholes: 0, wear: 0,
  parcels: [],
  // sprint-03 landmark registry — every leaf carries {placed, parts, pos}.
  // pos = [x,z] for singletons, [[x,z],...] for multi-site keys.
  hero: {},
  wayfinding: 0,
  wayfindingItems: [],
  furniture: 0,   // city/furniture.js fills this with a per-type breakdown
  // ground-detail pass (city/ground.js): counts of placed cover per layer
  ground: { overlays: 0, paths: 0, litter: 0, mulch: 0, flowers: 0, stains: 0,
            grass: 0 },
};
export function publishCity() {
  if (typeof window !== 'undefined') window.__city = CITY;
}
/* leaf marker: heroLeaf('pylon', parts, [x,z]) or heroLeaf('hospital','pylon',parts,[x,z])
   for sub-keys. Multi-site keys pass pos:[[x,z],...] and placed = site count. */
export function heroLeaf(key, sub, parts, pos, placed = true) {
  const h = (CITY.hero[key] ||= {});
  const leaf = { placed, parts, pos };
  if (sub === null) Object.assign(h, leaf); else h[sub] = leaf;
  return leaf;
}
export function wayItem(kind, pos) {
  CITY.wayfindingItems.push({ kind, pos });
  CITY.wayfinding = CITY.wayfindingItems.length;
}
export function heroCrown(profile, parts, pos) {
  const c = (CITY.hero.crowns ||= { placed: 0, parts: 0, profiles: [], pos: [] });
  c.placed++; c.parts += parts;
  if (!c.profiles.includes(profile)) c.profiles.push(profile);
  c.pos.push(pos);
}
