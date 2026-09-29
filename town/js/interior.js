// interior.js — click a building to step inside: a low-fi furnished interior
// per archetype (ward, shop, cafe, lobby, home, ...) rendered on its own layer
// in a sealed room staged far beneath the town, plus an info HUD carrying the
// building's name, cost/budget share, purpose and size. Esc / EXIT returns.
import * as THREE from 'three';
import { BUILDINGS, APARTMENTS, FILLER, CATEGORY_COLORS } from './layout.js';
import { GeoBin } from './city/geo.js';
import { makeCanvas, canvasTex, signTexture, mulberry32, mat } from './lib.js';

const LYR = 2;                       // interior-only render layer
const STAGE = new THREE.Vector3(0, -180, 0);   // sealed void under the ground plane
const EYE = 1.62;

/* building type → interior archetype (a handful of id overrides where the
   generic type undersells the room, e.g. dental storefronts read as clinics) */
const BY_TYPE = { hospital: 'medical', clinic: 'medical', medoffice: 'medical',
  ems: 'medical', rehab: 'medical', hospice: 'medical', senior: 'medical',
  lab: 'medical', medhall: 'hall', campusb: 'hall', museum: 'museum',
  civicb: 'office', school: 'classroom', storefront: 'shop', bigbox: 'store',
  mall: 'mall', fastfood: 'cafe', church: 'chapel', gas: 'shop',
  tower: 'lobby', skyscraper: 'lobby', house: 'home', cottage: 'home',
  ranch: 'home', duplex: 'home', townhouse: 'home', apartment: 'home',
  zone: 'home', parkzone: null };
const BY_ID = { dental: 'medical', optical: 'medical', coffee: 'cafe',
  orchard: 'cafe', housing: 'home', preservecommons: 'home' };
const ARCH_NAME = { medical: 'Clinic floor', shop: 'Retail floor', store: 'Sales floor',
  cafe: 'Dining room', mall: 'Atrium', hall: 'Great hall', museum: 'Gallery',
  classroom: 'Classroom', office: 'Service counter', home: 'Living space',
  lobby: 'Lobby', chapel: 'Sanctuary' };

/* ---------------- canvas bits ---------------- */
function texCanvas(fn, w = 256, h = 256, tile = null) {
  const [c, x] = makeCanvas(w, h); fn(x, w, h);
  const t = canvasTex(c); if (tile) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const woodFloor = () => texCanvas((x, w, h) => {
  x.fillStyle = '#9a7852'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < h; i += 32) {
    x.fillStyle = `rgb(${140 + (i * 7) % 30},${105 + (i * 5) % 22},${70 + (i * 3) % 16})`;
    x.fillRect(0, i, w, 30);
    x.fillStyle = 'rgba(60,40,20,.5)'; x.fillRect(0, i + 30, w, 2);
    x.fillRect((i * 67) % w, i, 3, 30);
  }
}, 256, 256, true);
const tileFloor = (c1 = '#cfd4d6', c2 = '#b8bec2') => texCanvas((x, w, h) => {
  x.fillStyle = c1; x.fillRect(0, 0, w, h);
  x.fillStyle = c2;
  for (let i = 0; i < w; i += 32) for (let j = 0; j < h; j += 32)
    if ((i + j) / 32 % 2) x.fillRect(i, j, 32, 32);
  x.strokeStyle = 'rgba(0,0,0,.18)';
  for (let i = 0; i <= w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
}, 256, 256, true);
const windowGlow = () => texCanvas((x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#cfe8ff'); g.addColorStop(.7, '#eef6ff'); g.addColorStop(1, '#d8c9a8');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.75)';
  x.fillRect(w / 2 - 3, 0, 6, h); x.fillRect(0, h / 2 - 3, w, 6);
});
const artTex = (bg, fg, txt) => signTexture(txt, { bg, fg, w: 256, h: 160 });

/* shared materials — interior set (kept out of mat()'s cache keyspace is fine,
   colors are unique to these rooms) */
const M = {
  wall: c => mat(c, { roughness: .95 }),
  trim: mat('#ece7dd', { roughness: .8 }),
  dark: mat('#4a4640', { roughness: .9 }),
  metal: mat('#9aa3aa', { roughness: .5, metalness: .5 }),
  glow: mat('#fff4d6', { emissive: '#ffe9b0', emissiveIntensity: 1.6, roughness: .6 }),
  screen: mat('#0d1418', { emissive: '#5fd0ff', emissiveIntensity: .8, roughness: .4 }),
  crt: mat('#b8e6f0', { transparent: true, opacity: .32, side: THREE.DoubleSide, roughness: .4 }),
};

/* ---------------- archetype furniture ----------------
   every builder gets (bin, rng, iw, id, ih) — room half-plan extents & height */
const T = {
  bed: (b, x, z, ry = 0) => {
    b.box(1.1, .55, 2.2, mat('#f2f4f6'), x, .32, z, ry);
    b.box(1.0, .12, 1.4, mat('#9fb6d8'), x, .88, z + .2, ry);
    b.box(.9, .45, .5, mat('#dfe6ea'), x, .55, z - .8, ry);
    b.box(.06, .9, .06, M.metal, x - .62, 0, z + 1); b.box(.06, .9, .06, M.metal, x - .62, 0, z - 1);
    b.box(.7, .04, 2.1, M.metal, x - .62, .9, z);
  },
  shelf: (b, x, z, len, ry = 0) => {
    b.box(len, 2.1, .55, mat('#8a7355'), x, 0, z, ry);
    for (let s = 0; s < 3; s++) b.box(len - .15, .34, .5,
      mat(['#c25b4e', '#4e7bc2', '#c2a94e', '#5a9954'][(x * 7 + z * 3 + s) & 3 | 0]),
      x, .45 + s * .62, z, ry);
  },
  table: (b, x, z, r = .6) => {
    b.plane(r * 2.4, r * 2.4, mat('#7a5233'), x, .72, z);
    const g = new THREE.CylinderGeometry(r, r, .05, 14); g.translate(x, .75, z);
    b.add(g, mat('#8a5f3c'), 0, 0, 0);
    b.box(.08, .72, .08, M.metal, x, 0, z);
  },
  chair: (b, x, z, ry = 0) => {
    b.box(.42, .06, .42, mat('#6d4526'), x, .42, z, ry);
    b.box(.42, .5, .06, mat('#6d4526'), x - Math.sin(ry) * .2, .42, z - Math.cos(ry) * .2, ry);
    for (const [dx, dz] of [[-.17, -.17], [.17, -.17], [-.17, .17], [.17, .17]])
      b.box(.05, .42, .05, M.dark, x + dx * Math.cos(ry) - dz * Math.sin(ry), 0,
        z + dx * Math.sin(ry) + dz * Math.cos(ry), ry);
  },
  desk: (b, x, z, ry = 0) => {
    b.box(1.5, .07, .75, mat('#a08361'), x, .72, z, ry);
    b.box(.08, .72, .7, mat('#8a6d4d'), x - .68 * Math.cos(ry), 0, z + .68 * Math.sin(ry), ry);
    b.box(.08, .72, .7, mat('#8a6d4d'), x + .68 * Math.cos(ry), 0, z - .68 * Math.sin(ry), ry);
    b.box(.5, .34, .05, M.screen, x, .8, z - .12, ry);          // monitor
  },
  sofa: (b, x, z, ry = 0, c = '#5a6e8c') => {
    b.box(2.0, .5, .85, mat(c), x, .18, z, ry);
    b.box(2.0, .55, .22, mat(c), x - Math.sin(ry) * .32, .4, z - Math.cos(ry) * .32, ry);
    for (const s of [-1, 1]) b.box(.24, .62, .85, mat(c),
      x + s * .95 * Math.cos(ry) + Math.sin(ry) * .0, .1, z - s * .95 * Math.sin(ry), ry);
  },
  counter: (b, x, z, len, ry = 0, c = '#9c8a72') => {
    b.box(len, .95, .7, mat(c), x, 0, z, ry);
    b.box(len + .12, .05, .82, mat('#5d4f3f'), x, .95, z, ry);
  },
  planter: (b, x, z) => {
    b.box(.55, .45, .55, mat('#7d5f45'), x, 0, z);
    const c = new THREE.ConeGeometry(.4, .9, 8); c.translate(x, .9, z);
    b.add(c, mat('#4d7a45'), 0, 0, 0);
  },
  pendant: (b, x, z, ih) => {
    b.box(.04, .8, .04, M.dark, x, ih - .8, z);
    const s = new THREE.CylinderGeometry(.02, .22, .22, 10); s.translate(x, ih - .85, z);
    b.add(s, M.glow, 0, 0, 0);
  },
  artFrame: (b, x, z, ry, w = 1.4, hgt = 1.0, tex = null, wallH = 3.2) => {
    const p = new THREE.PlaneGeometry(w, hgt); p.rotateY(ry);
    p.translate(x, wallH * .55, z);
    b.add(p, tex ? new THREE.MeshBasicMaterial({ map: tex }) : M.screen, 0, 0, 0);
  },
};

function furnish(kind, bin, rng, iw, id, ih) {
  const R1 = () => rng() * 2 - 1;
  switch (kind) {
    case 'medical': {
      T.counter(bin, -iw * .55, -id + 1.2, iw * .6, 0, '#cfd8dc');
      T.artFrame(bin, -iw * .3, -id + .06, 0, 2.2, 1.1, signTexture('RECEPTION', { bg: '#2e6d5d', w: 512, h: 128 }));
      const beds = Math.max(1, Math.floor(iw / 3.4));
      for (let i = 0; i < beds; i++) {
        const bx = -iw * .1 + i * 3.4, bz = id * .2;
        T.bed(bin, bx, bz);
        bin.box(.04, 2.0, 1.6, M.crt, bx + 1.45, .4, bz);      // privacy curtain
      }
      bin.box(iw * .8, 1.1, .4, mat('#7d93a3'), 0, 0, -id * .25);   // low cabinet row
      T.artFrame(bin, 0, id - .06, Math.PI, 1.0, 1.0, signTexture('+', { bg: '#b8352f', fg: '#fff', w: 128, h: 128 }));
      bin.box(.5, .5, .04, M.screen, iw * .45, 1.5, -id + .06, 0);  // vitals monitor
      break;
    }
    case 'shop': case 'store': {
      const aisles = Math.max(2, Math.min(5, Math.floor(id / 4.4)));
      for (let i = 0; i < aisles; i++) {
        const az = -id * .5 + i * (id * .9 / aisles);
        T.shelf(bin, 0, az, iw * 1.15, 0);
      }
      T.counter(bin, -iw * .2, -id + 1.3, iw * .9, 0, '#6f6250');   // checkout
      for (let i = 0; i < 3; i++) bin.box(.5, .3, .4, mat('#d8d3c8'), -iw * .2 + i * iw * .3, .98, -id + 1.3);
      T.artFrame(bin, 0, -id + .07, 0, 3.4, 1.0, signTexture(kind === 'store' ? 'WELCOME — SALES FLOOR' : 'OPEN', { bg: '#1f3a52', w: 640, h: 128 }));
      break;
    }
    case 'cafe': {
      T.counter(bin, 0, -id + 1.1, iw * 1.5, 0, '#5a4634');
      bin.box(.9, .5, .6, M.crt, iw * .3, 1.0, -id + 1.1);          // pastry case
      T.artFrame(bin, -iw * .3, -id + .07, 0, 3.0, 1.2, signTexture('MENU', { bg: '#232a20', fg: '#e8d8a8', w: 512, h: 200 }));
      const n = Math.max(2, Math.floor(iw * id / 14));
      for (let i = 0; i < n; i++) {
        const tx = R1() * iw * .7, tz = R1() * id * .55;
        T.table(bin, tx, tz, .5);
        T.chair(bin, tx - .75, tz, Math.PI / 2); T.chair(bin, tx + .75, tz, -Math.PI / 2);
      }
      break;
    }
    case 'mall': {
      for (const s of [-1, 1]) {
        T.planter(bin, s * iw * .6, -id * .4); T.planter(bin, s * iw * .6, id * .4);
        bin.box(1.8, .45, .5, mat('#8a6d4d'), s * iw * .6, 0, 0);   // benches
      }
      for (let i = 0; i < 3; i++) {                                  // kiosk row
        const kz = -id * .5 + i * id * .5;
        T.counter(bin, 0, kz, 2.2, Math.PI / 2, '#7d6650');
        bin.box(2.6, .12, 2.6, mat('#b8443c'), 0, 2.2, kz);          // kiosk canopy
      }
      break;
    }
    case 'hall': case 'museum': {
      const rows = Math.max(2, Math.floor(id / 3.4));
      for (let r = 0; r < rows; r++) for (let i = 0; i < Math.floor(iw / 1.6); i++)
        T.desk(bin, -iw * .7 + i * 1.6, -id * .5 + r * 3.2, 0);
      bin.box(1.6, .5, .8, mat('#6d5638'), 0, 0, id - 2.2);          // podium
      T.artFrame(bin, 0, id - .07, Math.PI, 4.0, 1.6,
        signTexture(kind === 'museum' ? 'HAVENBROOK — OUR STORY' : 'LECTURE HALL', { bg: '#2c3e50', w: 640, h: 160 }));
      if (kind === 'museum') for (let i = 0; i < 4; i++) {
        bin.box(.7, 1.15, .7, mat('#d9d4ca'), -iw * .8 + i * iw * .5, 0, id * .15);
        bin.box(.34, .34, .34, mat(['#c9a24e', '#7a9ab8', '#b8b0a4', '#8ab87a'][i]), -iw * .8 + i * iw * .5, 1.15, id * .15);
      }
      break;
    }
    case 'classroom': {
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
        T.desk(bin, -iw * .6 + i * iw * .4, -id * .35 + r * 2.2, 0);
        T.chair(bin, -iw * .6 + i * iw * .4, -id * .35 + r * 2.2 + .75, Math.PI);
      }
      bin.box(4.4, 1.8, .06, mat('#2b4a3a'), 0, 1.2, -id + .05);     // board
      T.desk(bin, 0, -id + 1.6, 0);
      break;
    }
    case 'office': {
      T.counter(bin, 0, -id * .15, iw * 1.5, 0, '#8a7a68');
      for (let i = 0; i < 4; i++) {                                  // queue posts + rope
        const qx = -iw * .4 + i * iw * .27;
        bin.box(.07, .95, .07, M.metal, qx, 0, id * .3);
        bin.box(.07, .95, .07, M.metal, qx, 0, id * .3 + 1.4);
        if (i < 3) bin.box(iw * .27, .03, .03, mat('#7a3030'), qx + iw * .27 / 2, .82, id * .3);
      }
      for (let i = 0; i < 3; i++) T.desk(bin, -iw * .4 + i * iw * .4, -id + 1.6, Math.PI);
      break;
    }
    case 'lobby': {
      T.counter(bin, 0, -id * .35, 3.4, 0, '#5d4a3a');
      for (const s of [-1, 1]) {
        bin.box(.6, ih, .6, mat('#b8b0a2'), s * iw * .55, 0, -id * .2);  // columns
        T.sofa(bin, s * iw * .5, id * .35, 0, '#7a5a48');
        T.planter(bin, s * iw * .75, id * .6);
      }
      for (let i = 0; i < 3; i++) bin.box(.9, 2.3, .12, M.metal, -1.0 + i, 0, id - .12); // lifts
      T.artFrame(bin, 0, -id + .07, 0, 2.6, .9, signTexture('DIRECTORY', { bg: '#233038', w: 512, h: 128 }));
      break;
    }
    case 'chapel': {
      const rows = Math.max(3, Math.floor(id / 2.6));
      for (let r = 0; r < rows; r++) for (const s of [-1, 1])
        bin.box(iw * .36, .95, .5, mat('#6d4a30'), s * iw * .33, 0, -id * .45 + r * 2.4);
      bin.box(.8, 1.4, .5, mat('#5a4030'), 0, 0, id - 1.4);           // altar rail
      bin.box(.14, 2.4, .14, mat('#c9a24e'), 0, 1.2, id - .8);
      bin.box(.9, .14, .14, mat('#c9a24e'), 0, 2.9, id - .8);         // cross
      bin.plane(1.4, 1.4, M.crt, 0, 2.0, -id + .05);                  // glass glow
      break;
    }
    default: {   /* home — living/kitchen/dining open plan */
      bin.plane(3.2, 2.2, mat('#8a4a44'), -iw * .3, .02, id * .1);    // rug
      T.sofa(bin, -iw * .3, id * .28, Math.PI);
      bin.box(1.3, .45, .5, mat('#4a3b2e'), -iw * .3, 0, -id * .18);  // coffee table
      bin.box(1.8, .9, .14, M.dark, -iw * .3, 0, -id + .5);
      bin.box(1.4, .9, .05, M.screen, -iw * .3, .9, -id + .58);       // TV
      T.counter(bin, iw * .45, -id * .3, id * .8, Math.PI / 2, '#c8c0b4'); // kitchen line
      T.table(bin, iw * .35, id * .45, .55);
      T.chair(bin, iw * .35 - .75, id * .45, Math.PI / 2); T.chair(bin, iw * .35 + .75, id * .45, -Math.PI / 2);
      bin.box(2.1, .65, 1.6, mat('#d8dee4'), iw * .62, 0, id * .8);   // bed in the corner
      bin.box(2.0, .18, 1.0, mat('#7a9ab8'), iw * .62, .65, id * .82);
    }
  }
}

/* build (once per archetype) a sealed furnished room centred at STAGE */
function buildRoom(kind, w, d, h, wallHex, floorTex, accentTex) {
  const g = new THREE.Group();
  const bin = new GeoBin();
  const iw = w / 2, id = d / 2;
  const wallM = M.wall(wallHex);
  // floor / ceiling / 4 walls — solid boxes so nothing see-through
  bin.box(w, .12, d, new THREE.MeshStandardMaterial({ map: floorTex, roughness: .9 }), 0, -.12, 0);
  bin.box(w, .12, d, wallM, 0, h, 0);
  const t = .16;
  bin.box(w, h, t, wallM, 0, 0, -id + t / 2); bin.box(w, h, t, wallM, 0, 0, id - t / 2);
  bin.box(t, h, d, wallM, -iw + t / 2, 0, 0); bin.box(t, h, d, wallM, iw - t / 2, 0, 0);
  // skirting + crown line
  bin.box(w, .12, .05, M.trim, 0, 0, -id + .2); bin.box(w, .12, .05, M.trim, 0, 0, id - .2);
  bin.box(.05, .12, d, M.trim, -iw + .2, 0, 0); bin.box(.05, .12, d, M.trim, iw - .2, 0, 0);
  // glowing window planes on the long walls — reads as daylight, not a hole
  const winTex = windowGlow();
  const nWin = Math.max(2, Math.floor(w / 6));
  for (let i = 0; i < nWin; i++) {
    const wx = -iw * .7 + i * (iw * 1.4 / Math.max(1, nWin - 1));
    T.artFrame(bin, wx, -id + .18, 0, 1.7, 1.35, winTex, h);
    T.artFrame(bin, wx, id - .18, Math.PI, 1.7, 1.35, winTex, h);
  }
  if (accentTex) T.artFrame(bin, iw - .18, 0, -Math.PI / 2, 1.6, 1.0, accentTex, h);
  const rng = mulberry32(kind.length * 7919 + Math.round(w * 10));
  furnish(kind, bin, rng, iw, id, h);
  // ceiling pendants
  for (let i = 0; i < Math.max(1, Math.floor(w / 9)); i++)
    T.pendant(bin, -iw * .5 + i * 9, 0, h);
  bin.build(g);
  // interior lights live on the interior layer only
  const amb = new THREE.AmbientLight('#cfc8bd', .5);
  const p1 = new THREE.PointLight('#ffe6b8', 34, 0, 1.9); p1.position.set(0, h - 1.1, 0);
  const p2 = new THREE.PointLight('#fff2d8', 14, 0, 2.0); p2.position.set(0, h - 1.2, d * .3);
  g.add(amb, p1, p2);
  g.position.copy(STAGE);
  g.traverse(o => o.layers.set(LYR));
  return g;
}

/* palette + footprint per archetype (w/d shrink to the room shell) */
function roomSpec(kind, b) {
  const w = Math.min(Math.max((b.w || 22) - 1.6, 9), 34);
  const d = Math.min(Math.max((b.d || 18) - 1.6, 8), 26);
  const tall = { mall: 5.2, hall: 4.6, lobby: 4.2, chapel: 5.0, store: 4.0 };
  const h = tall[kind] || 3.3;
  const wall = { medical: '#dfe8ec', shop: '#e6dfd2', store: '#e0dcd2', cafe: '#e8d8c4',
    mall: '#e4e0d8', hall: '#ddd8cc', museum: '#e2ddd4', classroom: '#e0ddd0',
    office: '#d8dce0', home: '#e6dccb', lobby: '#d9d4cc', chapel: '#e8e0cc' }[kind] || '#e0dcd0';
  const floor = { medical: tileFloor('#dfe4e6', '#c9cfd2'), store: tileFloor('#dcd8cf', '#c8c4ba'),
    mall: tileFloor('#e0d8cc', '#cfc6b8'), office: tileFloor('#d8dad4', '#c6c8c2'),
    lobby: tileFloor('#d0ccc4', '#bab6ac'), classroom: tileFloor('#d8d4c8', '#c6c2b6') }[kind] || woodFloor();
  return { w, d, h, wall, floor };
}

/* ---------------- footprint picking ---------------- */
const LOCAL = (b, px, pz) => {
  const rot = b.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
  const dx = px - b.x, dz = pz - b.z;
  return [dx * c - dz * s, dx * s + dz * c];
};
const inRect = (b, px, pz, pad = 0) => {
  const [lx, lz] = LOCAL(b, px, pz);
  return Math.abs(lx) <= (b.w || 0) / 2 + pad && Math.abs(lz) <= (b.d || 0) / 2 + pad;
};
// zones carry no w/d — give the two named zones a generous implicit rect
const ZONE_RECT = { housing: { w: 460, d: 290 }, preservecommons: { w: 120, d: 90 }, park: null };

export function pickBuildingAt(px, pz) {
  let best = null, bestArea = 1e12;
  const tryB = (b, cat, name) => {
    const w = b.w || (ZONE_RECT[b.id] && ZONE_RECT[b.id].w) || 0;
    const d = b.d || (ZONE_RECT[b.id] && ZONE_RECT[b.id].d) || 0;
    if (!w) return;
    const bb = { ...b, w, d };
    if (inRect(bb, px, pz, 1.5) && w * d < bestArea) { best = { ...bb, cat: cat || b.cat, name: name || b.name }; bestArea = w * d; }
  };
  for (const b of BUILDINGS) tryB(b);
  for (const f of FILLER) tryB({ ...f, cat: 'civic', name: f.sign || ({ tower: 'Downtown office', skyscraper: 'Downtown tower' }[f.type] || 'Town building') });
  for (const a of APARTMENTS) tryB({ ...a, type: 'apartment', cat: 'res' });
  if (best) return best;
  // unregistered filler/house: nearest centre within ~16m of the hit point
  let near = null, nd = 16;
  for (const f of [...FILLER, ...APARTMENTS]) {
    const dist = Math.hypot(f.x - px, f.z - pz);
    if (dist < nd) { nd = dist; near = f; }
  }
  return near ? { ...near, cat: 'res', name: near.name || 'Residential building' } : null;
}

/* ---------------- install ---------------- */
export function installInterior({ scene, camera, getOrtho, renderer, fly, syncAnglesFromCam, setActiveCam, camTween }) {
  if (typeof document === 'undefined') return null;
  const dom = renderer.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const rooms = new Map();          // archetype → {group, w, d, h}
  const stage = new THREE.Group();  // one parent: only this stays visible inside
  scene.add(stage);
  const I = {
    on: false, b: null, kind: null, spec: null,
    saved: { p: new THREE.Vector3(), q: new THREE.Quaternion(), ortho: false, vis: new Map() },
  };

  /* ---------- HUD ---------- */
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#05080a;opacity:0;pointer-events:none;transition:opacity .34s;z-index:70';
  const panel = document.createElement('div');
  panel.style.cssText = `position:fixed;left:18px;bottom:18px;z-index:72;max-width:min(460px,92vw);
    background:rgba(12,17,21,.92);border:1px solid rgba(255,255,255,.16);border-radius:14px;
    padding:14px 18px;color:#e8ecef;font-family:"Segoe UI",system-ui,sans-serif;
    backdrop-filter:blur(10px);box-shadow:0 8px 30px rgba(0,0,0,.5);display:none`;
  const hint = document.createElement('div');
  hint.style.cssText = `position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:72;
    background:rgba(12,17,21,.85);border:1px solid rgba(255,255,255,.15);border-radius:9px;
    color:#cdd7dd;font:600 11.5px "Segoe UI",sans-serif;letter-spacing:.5px;padding:7px 14px;display:none`;
  hint.innerHTML = 'INTERIOR — drag to look · WASD to walk · ESC to exit';
  const exitBtn = document.createElement('div');
  exitBtn.style.cssText = `position:fixed;top:14px;right:14px;z-index:72;cursor:pointer;
    background:rgba(120,30,30,.85);border:1px solid rgba(255,255,255,.2);border-radius:9px;
    color:#fff;font:700 11.5px "Segoe UI",sans-serif;letter-spacing:.5px;padding:8px 14px;display:none`;
  exitBtn.textContent = '✕ EXIT BUILDING';
  exitBtn.addEventListener('click', () => exit());
  document.body.append(fade, panel, hint, exitBtn);

  const CAT_NAME = { free: 'Provided free', health: 'Healthcare', community: 'Community',
    civic: 'Civic', res: 'Residential' };
  const money = n => '$' + (n / 1e6).toFixed(2) + 'M';

  function enter(b) {
    if (I.on || !b) return;
    const kind = BY_ID[b.id] ?? BY_TYPE[b.type] ?? (b.type === 'parkzone' ? null : 'shop');
    if (kind === null) { window.__uiShowCard && window.__uiShowCard(b.id); return; }
    window.__endTour && window.__endTour();
    if (camTween) camTween.on = false;
    I.on = true; I.b = b; I.kind = kind;
    fade.style.opacity = '1';
    setTimeout(() => {
      I.saved.p.copy(camera.position); I.saved.q.copy(camera.quaternion);
      I.saved.ortho = !!getOrtho();
      let spec = rooms.get(kind);
      if (!spec) {
        spec = roomSpec(kind, b);
        spec.group = buildRoom(kind, spec.w, spec.d, spec.h, spec.wall, spec.floor,
          b.id ? artTex('#20313d', '#ffd97a', b.name || 'HAVENBROOK') : null);
        stage.add(spec.group);
        rooms.set(kind, spec);
      }
      // hide the whole town — sprites ignore depth and would ghost through the
      // sealed room anyway; culling every sibling also makes interiors cheap
      I.saved.vis.clear();
      for (const c of scene.children) { I.saved.vis.set(c, c.visible); c.visible = c === stage; }
      I.spec = spec;
      camera.layers.enable(LYR);
      setActiveCam(camera);
      // spawn in a corner so the furnished middle of the room is in frame
      const cx = -spec.w * .3, cz = spec.d * .32;
      camera.position.set(STAGE.x + cx, STAGE.y + EYE, STAGE.z + cz);
      fly.auto = false; fly.yaw = Math.atan2(cx, cz); fly.pitch = 0;
      camera.quaternion.setFromEuler(new THREE.Euler(0, fly.yaw, 0, 'YXZ'));
      syncAnglesFromCam();
      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px">
          <h3 style="margin:0;font-size:16px">${b.num ? `<span style="color:${CATEGORY_COLORS[b.cat]}">#${b.num}</span> ` : ''}${b.name}</h3>
        </div>
        <span style="display:inline-block;font-size:10px;letter-spacing:.6px;padding:2px 8px;border-radius:20px;color:#fff;margin:5px 0;background:${CATEGORY_COLORS[b.cat] || '#555'}">${CAT_NAME[b.cat] || b.cat}</span>
        <div style="font-size:12px;color:#ffd97a;font-weight:600">${b.cost ? `Cost ${money(b.cost)} — ${(b.cost / 1e5).toFixed(1)}% of the $10.00M budget` : (b.id || b.desc) ? 'Provided free under the town plan' : 'Not a build-budget line item'}</div>
        ${b.desc ? `<p style="margin:7px 0 0;font-size:12.5px;line-height:1.55;color:#c6d1d8">${b.desc}</p>` : ''}
        <p style="margin:8px 0 0;font-size:11px;color:#8fa1ab">Interior: ${ARCH_NAME[kind] || kind}
          ${b.w ? ` · footprint ${Math.round(b.w)}m × ${Math.round(b.d)}m${b.h ? ` × ${b.h}m tall` : ''}` : ''}
          · lower-fidelity set for presentation</p>`;
      panel.style.display = 'block'; hint.style.display = 'block'; exitBtn.style.display = 'block';
      fade.style.opacity = '0';
    }, 190);
  }
  function exit() {
    if (!I.on) return;
    fade.style.opacity = '1';
    setTimeout(() => {
      camera.position.copy(I.saved.p); camera.quaternion.copy(I.saved.q);
      camera.layers.disable(LYR);
      for (const c of scene.children) if (I.saved.vis.has(c)) c.visible = I.saved.vis.get(c);
      if (I.saved.ortho && getOrtho()) setActiveCam(getOrtho());
      syncAnglesFromCam();
      panel.style.display = 'none'; hint.style.display = 'none'; exitBtn.style.display = 'none';
      I.on = false; I.b = null; fly.auto = false;
      fade.style.opacity = '0';
    }, 190);
  }

  /* click = short press without drag; picks against the real rendered scene so
     walls, merged facades and props all yield a correct hit point */
  let dx = 0, dy = 0, t0 = 0;
  dom.addEventListener('pointerdown', e => { dx = e.clientX; dy = e.clientY; t0 = performance.now(); });
  dom.addEventListener('pointerup', e => {
    if (I.on) return;
    if (Math.hypot(e.clientX - dx, e.clientY - dy) > 6 || performance.now() - t0 > 450) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, getOrtho() || camera);
    ray.far = 4000;
    const hit = ray.intersectObjects(scene.children, true)[0];
    if (!hit) return;
    const b = pickBuildingAt(hit.point.x, hit.point.z);
    if (b) enter(b);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') exit(); });

  /* walk loop — clamped to the room's inner walls */
  I.tick = dt => {
    if (!I.on || !I.spec) return;
    const sp = (fly.keys.ShiftLeft || fly.keys.ShiftRight ? 7 : 3.4) * dt;
    const f = new THREE.Vector3(-Math.sin(fly.yaw), 0, -Math.cos(fly.yaw));
    const r = new THREE.Vector3(-Math.sin(fly.yaw - Math.PI / 2), 0, -Math.cos(fly.yaw - Math.PI / 2));
    const mv = new THREE.Vector3();
    if (fly.keys.KeyW || fly.keys.ArrowUp) mv.add(f);
    if (fly.keys.KeyS || fly.keys.ArrowDown) mv.sub(f);
    if (fly.keys.KeyA || fly.keys.ArrowLeft) mv.sub(r);
    if (fly.keys.KeyD || fly.keys.ArrowRight) mv.add(r);
    if (mv.lengthSq()) camera.position.addScaledVector(mv.normalize(), sp);
    const ix = I.spec.w / 2 - .55, iz = I.spec.d / 2 - .55;
    camera.position.x = Math.max(STAGE.x - ix, Math.min(STAGE.x + ix, camera.position.x));
    camera.position.z = Math.max(STAGE.z - iz, Math.min(STAGE.z + iz, camera.position.z));
    camera.position.y = STAGE.y + EYE;
    camera.quaternion.setFromEuler(new THREE.Euler(fly.pitch, fly.yaw, 0, 'YXZ'));
  };
  I.enter = enter; I.exit = exit;
  I.byId = id => { if (id) enter([...BUILDINGS, ...APARTMENTS, ...FILLER].find(b => b.id === id || b.name === id)); };
  window.__enterInterior = I.byId;
  window.__exitInterior = exit;
  window.__interior = I;
  return I;
}
