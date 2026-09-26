// main.js — Havenbrook 3D town: procedural sky, cinematic post fx, fly-spectator controls
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { TOWN, BUILDINGS, APARTMENTS, HOUSE_BLOCKS, COTTAGE_ROWS, PLAZA,
         CATEGORY_COLORS, FILLER, ROADS } from './layout.js';
import { makeBuilding } from './buildings.js';
import { registerOccupancy, buildRoads, buildLots, buildTrees, buildCars,
         buildLights, buildWater, buildPark, buildPlaza, buildPeople,
         buildProps, occupyRect, isFree, buildAthleticPark, buildTraffic,
         buildCountryside, buildFences, buildClouds, buildBirds, buildMountains,
         tickWorld } from './details.js';
import { grassTexture, mat, plane, cyl, R, rr, pick, skyTexture, mergeStatic,
         groundOverlayTexture, uTime } from './lib.js';
import { M_GRASS, pbr } from './mats.js';

const params = new URLSearchParams(location.search);
const VIEW = params.get('view') || 'aerial';
const TIME = params.get('time') || 'day';
const LABELS = params.get('labels') === '1';
const NOFX = params.get('nofx') === '1';
const DEBUG = params.get('debug') === '1';
const CAM_BOUND = 1200;   // fly-cam stays inside the mountain ring

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true,
  powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
const MAX_RATIO = Math.min(devicePixelRatio, 2);
let pixelRatio = MAX_RATIO;
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = TIME === 'golden' ? 1.05 : 1.0;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();

/* ---------- sun + sky (procedural — no HDR fetch, no NaN bloom artifacts) ---------- */
const sunDir = new THREE.Vector3();
if (TIME === 'golden') sunDir.set(-1500, 210, 700);
else if (TIME === 'dusk') sunDir.set(-1200, 120, 500);
else sunDir.set(900, 750, 620);
sunDir.normalize();

const pmrem = new THREE.PMREMGenerator(renderer);
const skyTex = skyTexture({
  mode: TIME,
  sunAz: Math.atan2(sunDir.z, sunDir.x),
  sunEl: Math.asin(sunDir.y),
});
scene.background = skyTex;
scene.backgroundIntensity = TIME === 'golden' ? 1.0 : 0.95;
scene.environment = pmrem.fromEquirectangular(skyTex).texture;
scene.environmentIntensity = TIME === 'golden' ? .9 : .8;
scene.fog = new THREE.FogExp2(
  TIME === 'golden' ? 0xd8b490 : TIME === 'dusk' ? 0x4a4258 : 0xd4e2ec,
  TIME === 'dusk' ? 0.00032 : 0.00017);

/* ---------- sun + fill ---------- */
const sun = new THREE.DirectionalLight(TIME === 'golden' ? 0xffb268 : TIME === 'dusk' ? 0xff9a6a : 0xfff2dd,
  TIME === 'golden' ? 3.4 : TIME === 'dusk' ? 1.8 : 2.6);
sun.position.copy(sunDir).multiplyScalar(1800);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -700; sun.shadow.camera.right = 700;
sun.shadow.camera.top = 700; sun.shadow.camera.bottom = -700;
sun.shadow.camera.near = 200; sun.shadow.camera.far = 3600;
sun.shadow.bias = -0.00018; sun.shadow.normalBias = .35;
scene.add(sun); scene.add(sun.target);
// hemisphere fill lifts shadows gently toward sky color
scene.add(new THREE.HemisphereLight(
  TIME === 'golden' ? 0xd8b088 : 0xbdd6e8,
  TIME === 'golden' ? 0x7a6848 : 0x5d7050,
  TIME === 'dusk' ? .6 : TIME === 'golden' ? .72 : .55));

/* ---------- ground ---------- */
const groundM = pbr('grass_ground'); groundM.color = new THREE.Color('#9db27e');
scene.add(plane(20000, 20000, groundM, 0, 0, 0, -Math.PI / 2, 60));
// large-scale blotch overlay so the lawn never reads as flat tiling
const ovM = new THREE.MeshStandardMaterial({ map: groundOverlayTexture(), transparent: true,
  roughness: 1, depthWrite: false });
const ov = plane(3400, 3400, ovM, 0, .14, 0, -Math.PI / 2, 0);
ov.userData.noMerge = true;
scene.add(ov);

/* ---------- occupancy then build ---------- */
registerOccupancy();
buildRoads(scene);
buildLots(scene);
buildWater(scene);
buildPark(scene);
buildAthleticPark(scene);
buildPlaza(scene, PLAZA);
buildProps(scene);

for (const b of BUILDINGS) if (b.w) scene.add(makeBuilding(b));
for (const f of FILLER) { scene.add(makeBuilding({ name: '', ...f })); occupyRect(f.x, f.z, f.w, f.d, 4); }
for (const a of APARTMENTS) scene.add(makeBuilding({ ...a, type: 'apartment' }));

for (const blk of HOUSE_BLOCKS) {
  const W = blk.x1 - blk.x0, D = blk.z1 - blk.z0;
  const typeFor = () => blk.duplex ? 'duplex' : (R() < .24 ? 'ranch' : 'house');
  // occupancy mirrors the real footprint (body + garage wing + porch + driveway)
  // so scattered trees/bushes never land on a driveway or inside a garage
  const occupy = (t, x, z, sgn) => {
    if (t === 'duplex') occupyRect(x, z + sgn, 19, 15, 2);
    else if (t === 'ranch') occupyRect(x + sgn * 4, z + sgn * 3, 28, 20, 2);
    else occupyRect(x + sgn * 2, z + sgn * 3, 22, 20, 2);
  };
  if (blk.face === 'v') {
    for (let i = 0; i < blk.count; i++) {
      const z = blk.z0 + (i + .5) * D / blk.count;
      const spec = { type: typeFor(), x: blk.x1 - 12, z, rot: Math.PI / 2 };
      scene.add(makeBuilding(spec));
      // rot π/2: front & driveway face +x, garage wing extends -z
      if (spec.type === 'ranch') occupyRect(spec.x + 3.5, z - 4, 20, 28, 2);
      else occupyRect(spec.x + 3.5, z - 2.5, 20, 20, 2);
    }
  } else {
    const twoRows = D > 80, rows = twoRows ? 2 : 1;
    for (let rI = 0; rI < rows; rI++) {
      const n = Math.ceil(blk.count / rows);
      const z = twoRows ? (rI === 0 ? blk.z0 + 13 : blk.z1 - 13) : blk.z1 - 13;
      const rot = twoRows ? (rI === 0 ? Math.PI : 0) : 0;
      const sgn = rot ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const x = blk.x0 + 14 + i * (W - 28) / Math.max(1, n - 1);
        if (!isFree(x, z, 8)) continue;
        const t = typeFor();
        scene.add(makeBuilding({ type: t, x, z, rot }));
        occupy(t, x, z, sgn);
      }
    }
  }
}
for (const row of COTTAGE_ROWS) {
  const W = row.x1 - row.x0;
  const sgn = row.face === 'n' ? -1 : 1;
  for (let i = 0; i < row.count; i++) {
    const x = row.x0 + 12 + i * (W - 24) / Math.max(1, row.count - 1);
    scene.add(makeBuilding({ type: 'cottage', x, z: row.z, rot: row.face === 'n' ? Math.PI : 0 }));
    occupyRect(x + sgn * 2, row.z + sgn * 3, 22, 20, 2);
  }
}

const lampIM = buildLights(scene);
if (TIME === 'golden' || TIME === 'dusk')
  lampIM.material.emissive = new THREE.Color('#ffdf9e'), lampIM.material.emissiveIntensity = 1.4;
buildTrees(scene);
buildCars(scene);
buildTraffic(scene);
buildPeople(scene);
buildFences(scene);
buildCountryside(scene);
buildMountains(scene);
if (VIEW !== 'map') { buildClouds(scene); buildBirds(scene); }

/* campus quad — sized to sit clear of the med hall & the campus lot */
const quadM = pbr('grass_ground'); quadM.color = new THREE.Color('#93b377');
scene.add(plane(190, 92, quadM, -480, .31, -532, -Math.PI / 2, 10));
const qp = pbr('precast_stone_paving'); qp.color = new THREE.Color('#c4b49a');
for (const a of [.62, -.62]) {
  const g = new THREE.PlaneGeometry(6, 170); g.rotateX(-Math.PI / 2); g.rotateY(a);
  const p = new THREE.Mesh(g, qp); p.position.set(-480, .33, -532); p.receiveShadow = true;
  scene.add(p);
}
scene.add(plane(190, 6, qp, -480, .33, -532, -Math.PI / 2, 3));
scene.add(cyl(4, 4.4, .9, mat('#9aa0a3'), -480, .3, -532, 20));

/* collapse all static geometry into one mesh per material */
mergeStatic(scene);

/* lit windows: shared materials carry userData.lit — intensity follows time of day */
{
  const litI = TIME === 'dusk' ? 1.7 : TIME === 'golden' ? .95 : .12;
  const seen = new Set();
  scene.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats)
      if (m && m.userData && m.userData.lit && !seen.has(m)) {
        seen.add(m); m.emissiveIntensity = litI;
      }
  });
}

/* ---------- cameras + fly controls ---------- */
const asp = innerWidth / innerHeight;
const camera = new THREE.PerspectiveCamera(55, asp, 1, 12000);
const P = {
  aerial:     { p: [540, 620, 660],   t: [-30, 0, -40] },
  aerialW:    { p: [-660, 540, 620],  t: [30, 0, -60] },
  aerialfull: { p: [60, 1250, 640],   t: [0, 0, -20] },
  medical:    { p: [430, 210, -120],  t: [60, 25, -510] },
  campus:     { p: [-170, 180, -160], t: [-470, 20, -540] },
  downtown:   { p: [380, 150, 150],   t: [50, 10, -210] },
  park:       { p: [250, 200, 330],   t: [580, 8, 120] },
  senior:     { p: [740, 210, -60],   t: [560, 12, -520] },
  commercial: { p: [280, 300, 760],   t: [290, 8, 430] },
  school:     { p: [-720, 180, 320],  t: [-510, 10, 560] },
  housing:    { p: [-620, 210, 420],  t: [-440, 8, 120] },
  mainstreet: { p: [-150, 6.5, -34],  t: [140, 8, -60] },
  univclose:  { p: [-270, 70, -330],  t: [-480, 22, -540] },
  hospital:   { p: [240, 90, -300],   t: [70, 30, -500] },
  dusk:       { p: [820, 200, 260],   t: [-350, 60, 120] },
};
let orthoCam = null;
if (VIEW === 'map') {
  orthoCam = new THREE.OrthographicCamera(-890, 890, 800, -800, 1, 6000);
  orthoCam.position.set(0, 1500, 0); orthoCam.up.set(0, 0, -1);
  orthoCam.lookAt(0, 0, 0);
}
let activeCam = orthoCam || camera;
if (!orthoCam) {
  const v = P[VIEW] || P.aerial;
  camera.position.set(...v.p);
  camera.lookAt(...v.t);
}

/* fly/spectator controls — drag look + WASD */
const fly = {
  yaw: 0, pitch: -0.5, vel: new THREE.Vector3(), speed: 60,
  keys: {}, dragging: false, lx: 0, ly: 0,
  // skip auto-orbit for street-level views (it would sweep the camera through buildings)
  auto: !orthoCam && !params.get('still') && (P[VIEW] || P.aerial).p[1] > 60,
};
function syncAnglesFromCam() {
  const d = camera.getWorldDirection(new THREE.Vector3());
  fly.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
  fly.yaw = Math.atan2(-d.x, -d.z);
}
syncAnglesFromCam();
addEventListener('mousedown', e => { fly.dragging = true; fly.lx = e.clientX; fly.ly = e.clientY; fly.auto = false; });
addEventListener('mouseup', () => fly.dragging = false);
addEventListener('mousemove', e => {
  if (!fly.dragging) return;
  fly.yaw -= (e.clientX - fly.lx) * .0032;
  fly.pitch -= (e.clientY - fly.ly) * .0032;
  fly.pitch = Math.max(-1.45, Math.min(1.45, fly.pitch));
  fly.lx = e.clientX; fly.ly = e.clientY;
});
addEventListener('wheel', e => { fly.speed = Math.max(6, Math.min(400, fly.speed * (e.deltaY < 0 ? 1.15 : .87))); });
addEventListener('keydown', e => fly.keys[e.code] = true);
addEventListener('keyup', e => fly.keys[e.code] = false);
addEventListener('dblclick', () => fly.auto = !fly.auto);

/* ---------- labels ---------- */
const labelDivs = [];
if (LABELS) {
  const holder = document.getElementById('labels');
  const mk = (txt, x, y, z, cat, num, minor) => {
    const d = document.createElement('div');
    d.className = 'lbl' + (cat === 'free' ? ' free' : '') + (minor ? ' minor' : '');
    d.innerHTML = `<span class="dot" style="background:${CATEGORY_COLORS[cat] || '#555'}"></span>` +
      (num ? `<span class="num">${num}</span>` : '') + `<span>${txt}</span>`;
    holder.appendChild(d);
    labelDivs.push({ d, p: new THREE.Vector3(x, y, z) });
  };
  for (const b of BUILDINGS) {
    if (b.type === 'zone' || b.type === 'parkzone') { mk(b.name, b.x, 4, b.z, b.cat, b.num); continue; }
    if (b.nolabel) continue;
    mk(b.name, b.x, (b.h || 8) + 8, b.z, b.cat, b.num);
  }
  for (const a of APARTMENTS) mk(a.name, a.x, a.h + 6, a.z, 'res', 0, true);
  const dists = [
    ['UNIVERSITY DISTRICT', -480, -700], ['MEDICAL DISTRICT', 200, -555],
    ['SENIOR DISTRICT', 585, -620], ['DOWNTOWN', 62, -255],
    ['COMMERCIAL CORRIDOR', 160, 555], ['RESIDENTIAL WEST', -460, 40],
    ['SCHOOL DISTRICT', -510, 705],
  ];
  if (VIEW === 'map') {
    for (const [t, x, z] of dists) {
      const d = document.createElement('div');
      d.className = 'lbl dist'; d.textContent = t;
      document.getElementById('labels').appendChild(d);
      labelDivs.push({ d, p: new THREE.Vector3(x, 2, z), norelax: true });
    }
    for (const r of ROADS) {
      const d = document.createElement('div');
      d.className = 'lbl roadname' + (r.axis === 'v' ? ' vert' : '');
      d.textContent = r.name.toUpperCase();
      document.getElementById('labels').appendChild(d);
      const mx = r.axis === 'v' ? r.c : (r.a0 + r.a1) / 2;
      const mz = r.axis === 'v' ? (r.a0 + r.a1) / 2 : r.c;
      labelDivs.push({ d, p: new THREE.Vector3(mx, 2, mz), norelax: true });
    }
  }
  const lg = document.getElementById('legend');
  lg.style.display = 'block';
  const counts = { free: 0, health: 0, community: 0 };
  BUILDINGS.forEach(b => { if (b.num) counts[b.cat] = (counts[b.cat] || 0) + 1; });
  lg.innerHTML = `<h3>${TOWN.name} — LEGEND</h3>` +
    `<div class="cat"><span class="dot" style="background:${CATEGORY_COLORS.free}"></span>Provided free (${counts.free})</div>` +
    `<div class="cat"><span class="dot" style="background:${CATEGORY_COLORS.health}"></span>Healthcare facilities (${counts.health})</div>` +
    `<div class="cat"><span class="dot" style="background:${CATEGORY_COLORS.community}"></span>Community locations (${counts.community})</div>` +
    `<div class="cat"><span class="dot" style="background:${CATEGORY_COLORS.res}"></span>Residential &amp; districts</div>`;
  document.getElementById('titlecard').style.display = 'block';
  document.getElementById('compass').style.display = 'block';
}
const v3 = new THREE.Vector3();
function updateLabels() {
  const items = [];
  for (const it of labelDivs) {
    const { d, p } = it;
    v3.copy(p).project(activeCam);
    const behind = v3.z > 1;
    const x = (v3.x * .5 + .5) * innerWidth, y = (-v3.y * .5 + .5) * innerHeight;
    if (behind || x < -100 || x > innerWidth + 100 || y < -60 || y > innerHeight + 60) {
      d.style.display = 'none'; continue;
    }
    it.x = x; it.y = y; it.dy = 0;
    d.style.display = 'flex';
    items.push(it);
  }
  const solid = items.filter(i => !i.norelax);
  for (let pass = 0; pass < 14; pass++) {
    let moved = false;
    for (const a of solid) {
      const ra = a.d.getBoundingClientRect();
      for (const b of solid) {
        if (a === b) continue;
        const rb = b.d.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 0 && oy > 0) {
          const push = oy / 2 + 1;
          if (a.y + a.dy <= b.y + b.dy) a.dy -= push; else a.dy += push;
          moved = true;
        }
      }
    }
    for (const a of solid) {
      a.d.style.left = a.x + 'px';
      a.d.style.top = (a.y + a.dy) + 'px';
    }
    if (!moved) break;
  }
  for (const it of items) if (it.norelax) { it.d.style.left = it.x + 'px'; it.d.style.top = it.y + 'px'; }
}

/* ---------- post processing ---------- */
let composer = null;
if (!NOFX) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, activeCam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2),
    TIME === 'golden' ? .22 : .12, .5, 1.02);
  composer.addPass(bloom);
  // cinematic grade: vignette + grain + slight teal-shadow/warm-highlight + saturation
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 },
      uVig: { value: .28 }, uGrain: { value: .013 },
      uWarm: { value: TIME === 'golden' ? .07 : TIME === 'dusk' ? .09 : .025 },
      uSat: { value: TIME === 'golden' ? 1.12 : 1.07 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uVig,uGrain,uWarm,uSat;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        // gentle S-curve
        c.rgb = c.rgb*c.rgb*(3.0-2.0*c.rgb)*0.22 + c.rgb*0.78;
        // saturation lift
        float l0 = dot(c.rgb, vec3(.299,.587,.114));
        c.rgb = mix(vec3(l0), c.rgb, uSat);
        // warm highlights / cool shadows
        float l = dot(c.rgb, vec3(.299,.587,.114));
        c.rgb += uWarm * vec3(l - .5) * vec3(1.0,.7,.35);
        // vignette
        float d = distance(vUv, vec2(.5));
        c.rgb *= smoothstep(.92, .38, d) * uVig + (1.0 - uVig);
        // film grain
        c.rgb += (hash(vUv*vec2(1920.,1080.)+uTime) - .5) * uGrain;
        gl_FragColor = c;
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new SMAAPass(innerWidth * pixelRatio, innerHeight * pixelRatio));
  composer.addPass(new OutputPass());
  composer._grade = grade;
}

/* ---------- adaptive shadow box: follows the camera, snaps to texels ---------- */
const _focus = new THREE.Vector3(), _fwd = new THREE.Vector3();
let shHalf = 700;
function updateShadow() {
  if (orthoCam) return;
  camera.getWorldDirection(_fwd); _fwd.y = 0;
  const fl = _fwd.lengthSq() > .01 ? _fwd.normalize() : _fwd.set(0, 0, -1);
  // focus point on the ground ahead of the camera
  const ahead = Math.min(camera.position.y * 1.1, 500);
  _focus.copy(camera.position).addScaledVector(fl, ahead);
  _focus.y = 0;
  // box grows with altitude: crisp up close, still covers the town from above
  const want = THREE.MathUtils.clamp(camera.position.y * 1.05, 130, 900);
  shHalf += (want - shHalf) * .08;
  // snap focus to shadow texels to stop shimmer
  const texel = (shHalf * 2) / sun.shadow.mapSize.x;
  _focus.x = Math.round(_focus.x / texel) * texel;
  _focus.z = Math.round(_focus.z / texel) * texel;
  sun.position.copy(_focus).addScaledVector(sunDir, 1800);
  sun.target.position.copy(_focus);
  const sc = sun.shadow.camera;
  if (Math.abs(sc.right - shHalf) > 1) {
    sc.left = -shHalf; sc.right = shHalf; sc.top = shHalf; sc.bottom = -shHalf;
    sc.updateProjectionMatrix();
  }
}

/* ---------- debug HUD ---------- */
const hud = document.getElementById('hud');
let fpsEMA = 60, frames = 0, lastHud = 0;

/* ---------- loop ---------- */
const clock = new THREE.Clock();
window.__ready = false;
const fwd = new THREE.Vector3(), right = new THREE.Vector3();
let lastRatioCheck = 0;
renderer.info.autoReset = false;
function tick() {
  requestAnimationFrame(tick);
  renderer.info.reset();
  const dt = Math.min(clock.getDelta(), .05);
  const t = clock.elapsedTime;
  if (!orthoCam) {
    if (fly.auto) {
      const v = P[VIEW] || P.aerial;
      const a = t * .05;
      camera.position.x = v.p[0] * Math.cos(a) - v.p[2] * Math.sin(a);
      camera.position.z = v.p[0] * Math.sin(a) + v.p[2] * Math.cos(a);
      camera.position.y = v.p[1];
      camera.lookAt(...v.t);
      syncAnglesFromCam();
    } else {
      const sp = fly.speed * (fly.keys.ShiftLeft || fly.keys.ShiftRight ? 3 : 1);
      fwd.set(-Math.sin(fly.yaw) * Math.cos(fly.pitch), Math.sin(fly.pitch), -Math.cos(fly.yaw) * Math.cos(fly.pitch));
      right.set(-Math.sin(fly.yaw - Math.PI / 2), 0, -Math.cos(fly.yaw - Math.PI / 2));
      const mv = new THREE.Vector3();
      if (fly.keys.KeyW || fly.keys.ArrowUp) mv.add(fwd);
      if (fly.keys.KeyS || fly.keys.ArrowDown) mv.sub(fwd);
      if (fly.keys.KeyA || fly.keys.ArrowLeft) mv.sub(right);
      if (fly.keys.KeyD || fly.keys.ArrowRight) mv.add(right);
      if (fly.keys.KeyE || fly.keys.Space) mv.y += 1;
      if (fly.keys.KeyQ || fly.keys.KeyC) mv.y -= 1;
      if (mv.lengthSq() > 0) mv.normalize().multiplyScalar(sp);
      fly.vel.lerp(mv, .12);
      camera.position.addScaledVector(fly.vel, dt);
      camera.position.y = Math.max(2.2, camera.position.y);
      // hard world boundary: stay inside the mountain ring (inner base ~1290)
      const hr = Math.hypot(camera.position.x, camera.position.z);
      if (hr > CAM_BOUND) {
        const k = CAM_BOUND / hr;
        camera.position.x *= k; camera.position.z *= k;
        fly.vel.multiplyScalar(.25);          // bleed off outward momentum
      }
      camera.position.y = Math.min(camera.position.y, 1400);
      camera.quaternion.setFromEuler(new THREE.Euler(fly.pitch, fly.yaw, 0, 'YXZ'));
    }
  }
  updateShadow();
  tickWorld(t, dt);
  if (composer) {
    if (composer.passes[0] && composer.passes[0].camera !== activeCam) {
      composer.passes[0].camera = activeCam;
      if (composer.passes[1] && composer.passes[1].camera) composer.passes[1].camera = activeCam;
    }
    if (composer._grade) composer._grade.uniforms.uTime.value = t;
    composer.render();
  } else {
    renderer.render(scene, activeCam);
  }
  updateLabels();
  // fps + dynamic resolution
  fpsEMA = fpsEMA * .95 + (1 / Math.max(dt, .001)) * .05;
  if (DEBUG && hud && t - lastHud > .25) {
    lastHud = t;
    const i = renderer.info.render;
    hud.style.display = 'block';
    hud.textContent = `${fpsEMA.toFixed(0)} fps · ${i.calls} calls · ` +
      `${(i.triangles / 1e6).toFixed(2)}M tris · ratio ${pixelRatio} · ` +
      `${renderer.info.memory.geometries} geo / ${renderer.info.memory.textures} tex`;
  }
  if (t - lastRatioCheck > 2.5) {
    lastRatioCheck = t;
    if (fpsEMA < 42 && pixelRatio > .55) {
      pixelRatio = Math.max(.55, pixelRatio - .2);
      renderer.setPixelRatio(pixelRatio); composer && composer.setSize(innerWidth, innerHeight);
    } else if (fpsEMA > 57 && pixelRatio < MAX_RATIO) {
      pixelRatio = Math.min(MAX_RATIO, pixelRatio + .25);
      renderer.setPixelRatio(pixelRatio); composer && composer.setSize(innerWidth, innerHeight);
    }
  }
  if (++frames === 40) {
    window.__ready = true;
    const lo = document.getElementById('loading');
    if (lo) { lo.style.opacity = '0'; setTimeout(() => lo.remove(), 700); }
  }
}
tick();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer && composer.setSize(innerWidth, innerHeight);
  if (camera.isPerspectiveCamera) { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
});
window.__cam = camera; window.__scene = scene; window.__renderer = renderer;
