// city/ground.js — ground-cover / surface-breakup pass for the flat lawns:
// per-parcel mottle & mowing-stripe overlays, a dense instanced grass-blade
// layer, dirt desire paths, leaf litter, mulch/pebble beds at foundations &
// tree bases, wildflower specks, and parking-lot stain decals. Everything
// lands as translucent decal planes merged through GeoBin (one mesh per
// material) or alpha-tested instanced cards — a handful of materials/draw
// calls, well under the tri budget.
// Runs after every other builder so placement checks see full occupancy.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROADS, LOTS, BUILDINGS, APARTMENTS, GREENS, PARK_ZONE,
         GREEN_BELT, SE_GREEN, HOUSE_BLOCKS, PLAZA } from '../layout.js';
import { makeCanvas, canvasTex, instances, R, rr, pick, thin } from '../lib.js';
import { GeoBin } from './geo.js';
import { isFree, streetBand } from './occ.js';
import { intersections } from './streetscape.js';
import { CITY } from './stats.js';

const Y = 0.28;                 // match details.js surface lift
/* decal lift ladder — each layer clears the surface below it:
   road paint tops out at ~Y+.015, lot asphalt sits at Y-.015,
   greens lawns at Y-.005, park lawn at Y-.03, bare ground at 0 */
const Y_OVL_LAWN = Y - .003;    // parcel overlays over programmed lawns
const Y_OVL_PARK = Y - .024;    // park overlay over the big park lawn
const Y_OVL_RAW  = .05;         // district/block overlays over bare ground
const Y_STAIN    = Y - .002;    // lot stains: over asphalt, under stall paint
const Y_BED      = Y + .012;    // mulch bed decals
const Y_PATH     = Y + .016;    // dirt desire-path discs
const Y_LITTER   = Y + .022;    // leaf-litter cards
const Y_FLOWER   = Y + .026;    // wildflower specks

/* every flat decal is unlit + alpha-blended; polygonOffset pulls the fragment
   toward the camera so nothing z-fights at aerial range. Unlit materials stay
   day-bright at night, so ?time=night dims them to match dark ground. */
const _night = typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('time') === 'night';
const decalMat = opts => {
  // decal UVs scale past 1 to tile the canvas — repeat, don't clamp
  if (opts.map) opts.map.wrapS = opts.map.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshBasicMaterial({ transparent: true,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    polygonOffsetUnits: -2, ...(_night ? { color: '#30363e' } : {}), ...opts });
};

/* ---------------- decal canvases ---------------- */
/* mottle overlay: dry patches + clover blotches on transparent; stripe>0 adds
   alternating mowing bands. Blotches wrap-draw so tiled parcels never seam. */
function mottleCanvas({ dry = .35, stripe = 0 } = {}) {
  const S = 256, [c, x] = makeCanvas(S, S);
  x.clearRect(0, 0, S, S);
  const n = 26 + Math.floor(R() * 10);
  for (let i = 0; i < n; i++) {
    const bx = R() * S, by = R() * S, br = 18 + R() * 52, isDry = R() < dry;
    const col = isDry ? '172,150,96' : (R() < .5 ? '86,110,58' : '70,96,50');
    const gr = x.createRadialGradient(bx, by, 0, bx, by, br);
    gr.addColorStop(0, `rgba(${col},${isDry ? .20 : .17})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = gr;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      x.beginPath(); x.arc(bx + ox, by + oy, br, 0, 7); x.fill();
    }
  }
  if (stripe) for (let sx = 0; sx < S; sx += stripe) {
    /* soft-gradient bands at varied contrast — hard-edged uniform stripes
       alias into corduroy moiré at aerial distance; tapering each edge and
       jittering the peak keeps the mow read up close and dissolves far away */
    const col = (sx / stripe) % 2 ? '255,255,255' : '28,38,18';
    const peak = .05 + R() * .05;
    const gr = x.createLinearGradient(sx, 0, sx + stripe, 0);
    gr.addColorStop(0, `rgba(${col},0)`);
    gr.addColorStop(.5, `rgba(${col},${peak.toFixed(3)})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = gr; x.fillRect(sx, 0, stripe, S);
  }
  return c;
}
/* leaf litter: small ochre/rust ellipses on transparent (alpha-tested) */
function litterCanvas() {
  const [c, x] = makeCanvas(128, 128);
  x.clearRect(0, 0, 128, 128);
  const cols = ['168,120,60', '140,88,44', '186,146,74', '120,72,40', '150,110,50'];
  for (let i = 0; i < 110; i++) {
    x.save(); x.translate(R() * 128, R() * 128); x.rotate(R() * 6.28);
    x.fillStyle = `rgba(${pick(cols)},${.55 + R() * .4})`;
    x.beginPath(); x.ellipse(0, 0, 1.5 + R() * 3.5, 1 + R() * 1.8, 0, 0, 7); x.fill();
    x.restore();
  }
  return c;
}
/* wildflower specks: sparse grass flecks + a few 5-petal dots per tile */
function speckCanvas() {
  const [c, x] = makeCanvas(64, 64);
  x.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `rgba(${R() < .5 ? '110,140,80' : '86,116,60'},.6)`;
    x.fillRect(R() * 64, R() * 64, 1.5, 2 + R() * 2);
  }
  const cols = ['240,238,220', '236,208,110', '214,140,160', '178,150,216', '230,120,90'];
  for (let i = 0; i < 9; i++) {
    const fx = 6 + R() * 52, fy = 6 + R() * 52, col = pick(cols);
    x.fillStyle = `rgba(${col},.95)`;
    for (let p = 0; p < 5; p++) {
      const a = p / 5 * 6.283;
      x.beginPath(); x.arc(fx + Math.cos(a) * 2.4, fy + Math.sin(a) * 2.4, 1.6, 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(255,230,140,.95)';
    x.beginPath(); x.arc(fx, fy, 1.2, 0, 7); x.fill();
  }
  return c;
}
/* oil/puddle stain: soft dark blot with satellite drips */
function stainCanvas() {
  const [c, x] = makeCanvas(128, 128);
  x.clearRect(0, 0, 128, 128);
  const gr = x.createRadialGradient(64, 64, 4, 64, 64, 60);
  gr.addColorStop(0, 'rgba(22,24,26,.5)'); gr.addColorStop(.7, 'rgba(22,24,26,.28)');
  gr.addColorStop(1, 'rgba(22,24,26,0)');
  x.fillStyle = gr; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill();
  for (let i = 0; i < 7; i++) {
    const a = R() * 6.28, d = 30 + R() * 26;
    x.fillStyle = 'rgba(22,24,26,.22)';
    x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 3 + R() * 7, 0, 7); x.fill();
  }
  return c;
}
/* grass tuft: ~14 tapered blades leaning different ways, darkest at the
   root; alpha-tested so card edges never halo */
function bladeCanvas() {
  const [c, x] = makeCanvas(64, 64);
  x.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 15; i++) {
    const bx = 4 + R() * 56, h = 24 + R() * 36, lean = rr(-11, 11),
          w = 1.7 + R() * 2.2;
    const gr = x.createLinearGradient(0, 64, 0, 64 - h);
    gr.addColorStop(0, 'rgba(48,74,32,.96)');
    gr.addColorStop(1, `rgba(${pick(['150,178,92', '118,150,74',
                                     '168,188,104', '104,132,62'])},.96)`);
    x.fillStyle = gr;
    x.beginPath();
    x.moveTo(bx - w * .5, 64);
    x.quadraticCurveTo(bx + lean * .3 - w * .3, 64 - h * .55, bx + lean, 64 - h);
    x.quadraticCurveTo(bx + lean * .3 + w * .3, 64 - h * .5, bx + w * .5, 64);
    x.fill();
  }
  return c;
}
/* trampled-dirt smudge — chained into desire-path ribbons */
function dirtCanvas() {
  const [c, x] = makeCanvas(64, 64);
  x.clearRect(0, 0, 64, 64);
  const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(140,116,78,.55)'); gr.addColorStop(.6, 'rgba(120,98,64,.4)');
  gr.addColorStop(1, 'rgba(120,98,64,0)');
  x.fillStyle = gr; x.beginPath(); x.arc(32, 32, 30, 0, 7); x.fill();
  for (let i = 0; i < 30; i++) {
    x.fillStyle = `rgba(90,72,46,${.1 + R() * .2})`;
    x.beginPath(); x.arc(20 + R() * 24, 20 + R() * 24, 1 + R() * 2.4, 0, 7); x.fill();
  }
  return c;
}

/* ---------------- builder ---------------- */
export function buildGroundDetail(scene) {
  const G = CITY.ground ||= { overlays: 0, paths: 0, litter: 0,
                              mulch: 0, flowers: 0, stains: 0, grass: 0 };
  const bin = new GeoBin();

  /* ---- 1. per-parcel mottle / mowing-stripe overlays ----
     alpha planes lying just over each lawn — dry patches, clover zones, mow
     stripes on the maintained turf. They sit *under* every built surface, so
     spanning a whole parcel or district can never paint over hardscape. */
  const ovlLawn = decalMat({ map: canvasTex(mottleCanvas({ dry: .3, stripe: 32 })) });
  const ovlMeadow = decalMat({ map: canvasTex(mottleCanvas({ dry: .62 })) });
  const ovlHumus = decalMat({ map: canvasTex(mottleCanvas({ dry: .15 })) });
  const decal = (w, d, tile, m, x, y, z, ry = 0) => {
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv;              // world-scale UVs like plane(tile)
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
    g.rotateX(-Math.PI / 2);
    bin.add(g, m, x, y, z, { ry });
    G.overlays++;
  };
  // parcel rects minus every overlapping lot — overlays must never paint
  // over asphalt (they sit above it in render order)
  const minusLots = (x0, z0, x1, z1) => {
    let rects = [[x0, z0, x1, z1]];
    for (const l of LOTS) {
      const lx0 = l.x - l.w / 2, lz0 = l.z - l.d / 2,
            lx1 = l.x + l.w / 2, lz1 = l.z + l.d / 2;
      const out = [];
      for (const [a0, b0, a1, b1] of rects) {
        const ix0 = Math.max(a0, lx0), iz0 = Math.max(b0, lz0),
              ix1 = Math.min(a1, lx1), iz1 = Math.min(b1, lz1);
        if (ix0 >= ix1 || iz0 >= iz1) { out.push([a0, b0, a1, b1]); continue; }
        if (a0 < ix0) out.push([a0, b0, ix0, b1]);
        if (ix1 < a1) out.push([ix1, b0, a1, b1]);
        if (b0 < iz0) out.push([ix0, b0, ix1, iz0]);
        if (b1 > iz1) out.push([ix0, iz1, ix1, b1]);
      }
      rects = out;
    }
    return rects;
  };
  const decalRegion = (x0, z0, x1, z1, tile, m, y, ry = 0) =>
    minusLots(x0, z0, x1, z1).forEach(([a0, b0, a1, b1]) =>
      decal(a1 - a0, b1 - b0, tile, m, (a0 + a1) / 2, y, (b0 + b1) / 2, ry));
  for (const g of GREENS)
    decalRegion(g.x0, g.z0, g.x1, g.z1, rr(20, 30),
      g.use === 'meadow' ? ovlMeadow : g.use === 'grove' || g.use === 'orchard' ? ovlHumus : ovlLawn,
      Y_OVL_LAWN, rr(0, 6.28));
  decalRegion(PARK_ZONE.x0, PARK_ZONE.z0, PARK_ZONE.x1, PARK_ZONE.z1, 34, ovlLawn, Y_OVL_PARK);
  decalRegion(SE_GREEN.x0, SE_GREEN.z0, SE_GREEN.x1, SE_GREEN.z1, 46, ovlMeadow, Y_OVL_RAW, .3);
  decalRegion(GREEN_BELT.x0, GREEN_BELT.z0, GREEN_BELT.x1, GREEN_BELT.z1, 40, ovlHumus, Y_OVL_RAW, 1.1);
  // broad mottle under the big district lawns — buildings, roads, lawns and
  // walks all occlude it, so a huge sheet costs nothing and kills flatness
  decalRegion(-150, -345, 230, -65, 44, ovlMeadow, Y_OVL_RAW, .7);    // med campus lawns
  decalRegion(-660, -655, -300, -390, 44, ovlHumus, Y_OVL_RAW, .5);     // old-town ground (downtown moved NW)
  decalRegion(340, -700, 800, -350, 44, ovlHumus, Y_OVL_RAW, 2.0);     // senior district
  decalRegion(-130, -30, 310, 310, 40, ovlLawn, Y_OVL_RAW, 1.4);       // grove district
  decalRegion(-660, 370, -100, 750, 44, ovlLawn, Y_OVL_RAW, .2);       // school side
  // mowing stripes on residential block lawns
  for (const b of HOUSE_BLOCKS)
    decalRegion(b.x0, b.z0, b.x1, b.z1, 26, ovlLawn, Y_OVL_RAW, pick([0, Math.PI / 2]));

  /* ---- 2. dirt desire paths ----
     chained squashed dirt smudges; discs self-align to the line's heading.
     isFree keeps them off structures; where a gravel path or feature vetoes a
     disc the trail reads as joining it. */
  const dirtM = decalMat({ map: canvasTex(dirtCanvas()) });
  const pathGeo = new THREE.CircleGeometry(1.15, 9);
  pathGeo.scale(1.45, 1, 1); pathGeo.rotateX(-Math.PI / 2);
  const pathLine = (x0, z0, x1, z1, { wander = 7, skip = null, gap = 2.3 } = {}) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const n = Math.max(2, Math.ceil(len / gap)), ux = dx / len, uz = dz / len,
          phase = rr(0, 6.28), ry = Math.atan2(-dz, dx);
    for (let i = 0; i <= n; i++) {
      const t = i / n,
            sway = Math.sin(t * Math.PI * 2.2 + phase) * wander * Math.sin(t * Math.PI),
            x = x0 + dx * t - uz * sway + rr(-.5, .5),
            z = z0 + dz * t + ux * sway + rr(-.5, .5);
      if (!isFree(x, z, 1.1, skip)) continue;
      bin.add(pathGeo, dirtM, x, Y_PATH, z, { ry: ry + rr(-.4, .4) });
      G.paths++;
    }
  };
  // Willow Creek park — worn lines between entries, pond, pavilion, playground
  pathLine(360, 108, 700, 172);
  pathLine(566, 296, 560, 176);
  pathLine(366, 268, 424, 78);
  pathLine(738, 300, 706, 196, { wander: 5 });
  // sidewalk corner cut-throughs — a diagonal worn line where the two walk
  // ends meet a corner lawn. Endpoints sit inside the road occupancy band, so
  // exempt just these two roads; buildings/lots still veto the whole corner.
  for (const i of intersections()) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (R() > .45) continue;
      const x0 = i.x + sx * (i.wv / 2 + 6.2), z0 = i.z + sz * (i.wh / 2 + 1.8),
            x1 = i.x + sx * (i.wv / 2 + 1.8), z1 = i.z + sz * (i.wh / 2 + 6.2),
            skip = [i.v, i.h];
      if (!isFree((x0 + x1) / 2, (z0 + z1) / 2,
                  Math.hypot(x0 - x1, z0 - z1) / 2 + 1, skip)) continue;
      pathLine(x0, z0, x1, z1, { wander: 1.6, skip, gap: 2.0 });
    }
  }

  /* ---- 3. leaf-litter cards under the big canopy ---- */
  const litM = new THREE.MeshBasicMaterial({ map: canvasTex(litterCanvas()),
    alphaTest: .38, polygonOffset: true, polygonOffsetFactor: -3,
    polygonOffsetUnits: -3 });
  const litGeo = new THREE.PlaneGeometry(1.9, 1.9);
  litGeo.rotateX(-Math.PI / 2); litGeo.translate(0, Y_LITTER, 0);
  const litter = [];
  const scatterLit = (x0, x1, z0, z1, n, r, skip = null) => {
    for (let i = 0; i < n; i++) {
      const x = rr(x0, x1), z = rr(z0, z1);
      if (!isFree(x, z, r, skip)) continue;
      litter.push({ x, z, ry: rr(0, 6.28), s: rr(.7, 1.6),
        color: pick(['#ffffff', '#f0e6d0', '#e2d4b8']) });
    }
  };
  scatterLit(PARK_ZONE.x0 + 6, PARK_ZONE.x1 - 6, PARK_ZONE.z0 + 6, PARK_ZONE.z1 - 6, 460, 1.4);
  scatterLit(-799, -702, -718, 698, 300, 1.6);                 // green-belt woods
  for (const g of GREENS)
    if (g.use === 'grove' || g.use === 'orchard')
      scatterLit(g.x0 + 2, g.x1 - 2, g.z0 + 2, g.z1 - 2, 60, 1.2, 'green');
  for (const b of HOUSE_BLOCKS)
    scatterLit(b.x0 + 4, b.x1 - 4, b.z0 + 4, b.z1 - 4,
      Math.floor((b.x1 - b.x0) * (b.z1 - b.z0) / 1400), 1.3);
  // street-tree drip lines — same treeline band buildTrees plants on
  for (const r of ROADS) {
    const tl = streetBand(r) + 1.4;
    for (let a = r.a0 + 10; a < r.a1 - 10; a += rr(18, 30)) for (const s of [-1, 1]) {
      const x = r.axis === 'v' ? r.c + tl * s : a,
            z = r.axis === 'v' ? a : r.c + tl * s;
      if (isFree(x, z, 1) && R() < .55)
        litter.push({ x, z, ry: rr(0, 6.28), s: rr(.6, 1.2),
          color: pick(['#ffffff', '#f0e6d0']) });
    }
  }
  const litIM = instances(litGeo, litM, thin(litter), { shadow: false });
  litIM.frustumCulled = false;
  scene.add(litIM);
  G.litter = litter.length;

  /* ---- 4. mulch/pebble beds ----
     low dark bed decals + instanced squashed hemispheres. Foundation beds run
     the back + flank sides (fronts already carry hedge boxes); tree-base beds
     reuse a share of the canopy litter spots. */
  const bedM = decalMat({ color: '#3f3222', opacity: .55 });
  const pebGeo = new THREE.SphereGeometry(.42, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  pebGeo.scale(1, .42, 1); pebGeo.translate(0, Y + .02, 0);
  const pebM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .95 });
  const pebbles = [];
  const pebCols = ['#8a7a66', '#6e5a44', '#9a8a72', '#7a6a52'];
  const pebbleRing = (x, z, rad, n) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rr(-.25, .25);
      pebbles.push({ x: x + Math.cos(a) * rad + rr(-.4, .4),
        z: z + Math.sin(a) * rad + rr(-.4, .4),
        s: rr(.55, 1.3), ry: rr(0, 6.28), color: pick(pebCols) });
    }
  };
  // building-base beds on the three non-front sides; the strip lands inside
  // the building's own pad, so exempt only that rect
  for (const b of [...BUILDINGS, ...APARTMENTS]) {
    if (!b.w || b.type === 'zone' || b.type === 'parkzone') continue;
    for (const [nx, nz, len] of [[0, -1, b.w], [-1, 0, b.d], [1, 0, b.d]]) {
      const bx = b.x + nx * (b.w / 2 + 1.35), bz = b.z + nz * (b.d / 2 + 1.35),
            bw = nx ? 1.9 : len + 1.6, bd = nz ? 1.9 : len + 1.6;
      if (!isFree(bx, bz, Math.max(bw, bd) / 2, b)) continue;
      bin.plane(bw, bd, bedM, bx, Y_BED, bz);
      G.mulch++;
      const n = Math.floor(len / 2.6);
      for (let i = 0; i < n; i++) {
        const t = (i + .5) / n - .5;
        pebbles.push({ x: bx + nx * rr(-.6, .6) + (nx ? 0 : t * len),
                       z: bz + nz * rr(-.6, .6) + (nz ? 0 : t * len),
                       s: rr(.6, 1.3), ry: rr(0, 6.28), color: pick(pebCols) });
      }
    }
  }
  // tree-base mulch discs under part of the canopy litter
  let tb = 0;
  for (const l of litter) {
    const inPark = l.x > PARK_ZONE.x0 && l.x < PARK_ZONE.x1 &&
                   l.z > PARK_ZONE.z0 && l.z < PARK_ZONE.z1;
    if (!(inPark || l.x < -700) || tb++ % 6 !== 0) continue;
    if (!isFree(l.x, l.z, 2.6)) continue;
    const bg = new THREE.CircleGeometry(2.3, 12);
    bg.rotateX(-Math.PI / 2);
    bin.add(bg, bedM, l.x, Y_BED, l.z);
    G.mulch++;
    pebbleRing(l.x, l.z, 2.1, 7);
  }
  const pebIM = instances(pebGeo, pebM, thin(pebbles), { shadow: false });
  pebIM.frustumCulled = false;
  scene.add(pebIM);

  /* ---- 5. wildflower specks in meadows & open parcels ---- */
  const flM = new THREE.MeshBasicMaterial({ map: canvasTex(speckCanvas()),
    alphaTest: .4, polygonOffset: true, polygonOffsetFactor: -4,
    polygonOffsetUnits: -4 });
  const flGeo = new THREE.PlaneGeometry(.85, .85);
  flGeo.rotateX(-Math.PI / 2); flGeo.translate(0, Y_FLOWER, 0);
  const flowers = [];
  const sow = (x0, x1, z0, z1, n, skip = null) => {
    for (let i = 0; i < n; i++) {
      const x = rr(x0, x1), z = rr(z0, z1);
      if (!isFree(x, z, .8, skip)) continue;
      flowers.push({ x, z, ry: rr(0, 6.28), s: rr(.6, 1.4) });
    }
  };
  for (const g of GREENS) if (g.use === 'meadow')
    sow(g.x0 + 2, g.x1 - 2, g.z0 + 2, g.z1 - 2,
      Math.floor((g.x1 - g.x0) * (g.z1 - g.z0) / 120), 'green');
  sow(PARK_ZONE.x0 + 8, PARK_ZONE.x1 - 8, PARK_ZONE.z0 + 8, PARK_ZONE.z1 - 8, 170);
  sow(SE_GREEN.x0 + 4, SE_GREEN.x1 - 4, SE_GREEN.z0 + 4, SE_GREEN.z1 - 4, 140);
  sow(-800, -744, -700, 690, 90);
  const flIM = instances(flGeo, flM, thin(flowers), { shadow: false });
  flIM.frustumCulled = false;
  scene.add(flIM);
  G.flowers = flowers.length;

  /* ---- 6. parking-lot stains: oil blots + boundary tire-wear ---- */
  const stM = decalMat({ map: canvasTex(stainCanvas()) });
  const stGeos = [1.6, 2.6, 3.8].map(r => {
    const g = new THREE.CircleGeometry(r, 12);
    g.scale(1 + R() * .8, 1, 1); g.rotateX(-Math.PI / 2); return g;
  });
  for (const l of LOTS) {
    if (l.plain) continue;
    const n = Math.min(9, Math.floor(l.w * l.d / 850));
    for (let i = 0; i < n; i++) {
      const x = rr(l.x - l.w / 2 + 7, l.x + l.w / 2 - 7),
            z = rr(l.z - l.d / 2 + 6, l.z + l.d / 2 - 6);
      if (!isFree(x, z, 3, 'lot')) continue;
      bin.add(pick(stGeos), stM, x, Y_STAIN, z, { ry: rr(0, 6.28) });
      G.stains++;
    }
    // worn double-tracks just inside the edge that meets the road band —
    // the edge whose off-lot probe is already occupied is the entry side
    for (const [ex, ez, dx, dz] of [
        [l.x - l.w / 2 - 3, l.z, 1, 0], [l.x + l.w / 2 + 3, l.z, -1, 0],
        [l.x, l.z - l.d / 2 - 3, 0, 1], [l.x, l.z + l.d / 2 + 3, 0, -1]]) {
      if (isFree(ex, ez, 2.5)) continue;               // open lawn — no traffic
      for (let k = 0; k < 2; k++) {
        const sx = ex + dx * 3 + (dz ? (k - .5) * l.w * .5 : 0),
              sz = ez + dz * 3 + (dx ? (k - .5) * l.d * .5 : 0);
        if (!isFree(sx, sz, 2, 'lot')) continue;
        const g = new THREE.CircleGeometry(2.4, 10);
        g.scale(dx ? 3.4 : 1, dz ? 3.4 : 1, 1);
        g.rotateX(-Math.PI / 2);
        bin.add(g, stM, sx, Y_STAIN + .001, sz);
        G.stains++;
      }
    }
  }

  /* ---- 7. instanced grass-blade layer ----
     three crossed alpha-tested cards per tuft (6 tris); per-instance hue /
     lightness jitter via instanceColor, random yaw + lean + non-uniform
     scale. Density is spent where the camera presets look: Main St verges
     (mainstreet view), the plaza fringe (downtown view), Willow Creek park.
     The minor-road verge strip sits inside the road's own occupancy pad, so
     those probes exempt just that road; everything else still vetoes. */
  const bladeM = new THREE.MeshBasicMaterial({ map: canvasTex(bladeCanvas()),
    alphaTest: .5, side: THREE.DoubleSide });
  const card = new THREE.PlaneGeometry(1.3, .62); card.translate(0, .31, 0);
  const bladeGeo = mergeGeometries([card, card.clone().rotateY(Math.PI / 3),
    card.clone().rotateY(Math.PI * 2 / 3)], false);
  const tufts = [];
  const tuftCols = ['#ffffff', '#e6f0c6', '#cfe0a2', '#b6cf8c', '#d8e6b0',
                    '#9fbd7a'];
  const tuft = (x, y, z) => tufts.push({ x, y, z,
    ry: rr(0, 6.28), rx: rr(-.1, .1), rz: rr(-.13, .13),
    sx: rr(.8, 1.55), sy: rr(.7, 1.8), sz: rr(.8, 1.55),
    color: pick(tuftCols) });
  const sowGrass = (x0, x1, z0, z1, n, y, r = .6, skip = null) => {
    for (let i = 0; i < n; i++) {
      const x = rr(x0, x1), z = rr(z0, z1);
      if (isFree(x, z, r, skip)) tuft(x, y, z);
    }
  };
  // road edges — arterials have no verge (walk runs to the curb), so the
  // tufts go on the tree lawn past the sidewalk; minors get the real verge
  // strip plus the frontage lawn beyond the walk
  for (const r of ROADS) {
    const hw = r.w / 2, main = r.name === 'Main St';
    const passes = main ? 2 : 1;
    for (let pass = 0; pass < passes; pass++)
      for (let a = r.a0 + 4 + pass * 1.1; a < r.a1 - 4; a += rr(1.6, 2.6))
        for (const s of [-1, 1]) {
          // inner verge strip (minor roads only) — inside the pad → skip=r
          if (!r.arterial && r.w < 16 && R() < .5) {
            const off = hw + rr(.5, 1.6);
            const x = r.axis === 'v' ? r.c + off * s : a,
                  z = r.axis === 'v' ? a : r.c + off * s;
            if (isFree(x, z, .55, [r])) tuft(x, Y + .014, z);
          }
          // tree-lawn band outside the sidewalk
          const p = main ? .78 : r.arterial || r.w >= 16 ? .6 : .42;
          if (R() < p) {
            const off = hw + rr(3.7, 6.6);
            const x = r.axis === 'v' ? r.c + off * s : a,
                  z = r.axis === 'v' ? a : r.c + off * s;
            if (isFree(x, z, .7)) tuft(x, .02, z);
          }
        }
  }
  // plaza fringe — planted ring just outside the paved slab
  for (const [x0, z0, x1, z1] of [
      [PLAZA.x - PLAZA.w / 2 - 4.5, PLAZA.z - PLAZA.d / 2 - 4.5,
       PLAZA.x + PLAZA.w / 2 + 4.5, PLAZA.z - PLAZA.d / 2 - 1.5],
      [PLAZA.x - PLAZA.w / 2 - 4.5, PLAZA.z + PLAZA.d / 2 + 1.5,
       PLAZA.x + PLAZA.w / 2 + 4.5, PLAZA.z + PLAZA.d / 2 + 4.5]])
    sowGrass(x0, x1, z0, z1, Math.floor((x1 - x0) * (z1 - z0) / 6), .02, .7);
  // big lawn bodies — Willow Creek park (park view), green parcels,
  // residential block interiors, green belts
  sowGrass(PARK_ZONE.x0 + 4, PARK_ZONE.x1 - 4, PARK_ZONE.z0 + 4,
           PARK_ZONE.z1 - 4, Math.floor(
    (PARK_ZONE.x1 - PARK_ZONE.x0) * (PARK_ZONE.z1 - PARK_ZONE.z0) / 14),
    .247);
  for (const g of GREENS)
    sowGrass(g.x0 + 2, g.x1 - 2, g.z0 + 2, g.z1 - 2,
      Math.floor((g.x1 - g.x0) * (g.z1 - g.z0) / 8), Y - .005, .6, 'green');
  for (const b of HOUSE_BLOCKS)
    sowGrass(b.x0 + 3, b.x1 - 3, b.z0 + 3, b.z1 - 3,
      Math.floor((b.x1 - b.x0) * (b.z1 - b.z0) / 26), .02, .7);
  sowGrass(SE_GREEN.x0 + 4, SE_GREEN.x1 - 4, SE_GREEN.z0 + 4, SE_GREEN.z1 - 4,
           Math.floor((SE_GREEN.x1 - SE_GREEN.x0) *
                      (SE_GREEN.z1 - SE_GREEN.z0) / 34), .02);
  sowGrass(GREEN_BELT.x0 + 4, GREEN_BELT.x1 - 4, GREEN_BELT.z0 + 4,
           GREEN_BELT.z1 - 4, Math.floor(
    (GREEN_BELT.x1 - GREEN_BELT.x0) * (GREEN_BELT.z1 - GREEN_BELT.z0) / 46),
    .02);
  // district lawns the aerial views land on — med campus + old town + senior side
  sowGrass(-150, 230, -345, -65, 3600, .02);   // med campus lawn body
  sowGrass(-660, -300, -650, -390, 1400, .02); // old-town verge grass
  sowGrass(340, 800, -700, -350, 4600, .02);     // senior district lawn
  const grassIM = instances(bladeGeo, bladeM, thin(tufts), { shadow: false });
  grassIM.frustumCulled = false;
  scene.add(grassIM);
  G.grass = tufts.length;

  bin.build(scene);
}
