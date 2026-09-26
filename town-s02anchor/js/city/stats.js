// city/stats.js — CITY build counters, published as window.__city for the
// evaluator's probes (contract A-checks). Populated by streetscape/greens.
export const CITY = {
  roads: 0,
  curbRuns: 0, gutterRuns: 0, sidewalkRuns: 0, vergeRuns: 0,
  ramps: 0, tactilePads: 0, aprons: 0,
  markings: { dyellow: 0, dash: 0, edge: 0, stopbar: 0, crosswalkBars: 0,
              arrows: 0, twltlArrows: 0 },
  drains: 0, manholes: 0,
  parcels: [],
};
export function publishCity() {
  if (typeof window !== 'undefined') window.__city = CITY;
}
