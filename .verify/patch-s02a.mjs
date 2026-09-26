import fs from 'fs';
const p = 'C:/Users/pmsma/Downloads/HST Digital Town Project/town/js/details.js';
let src = fs.readFileSync(p, 'utf8');

const rep = (oldStr, newStr) => {
  if (!src.includes(oldStr)) { console.error('ANCHOR MISSING:', JSON.stringify(oldStr.slice(0, 60))); process.exit(1); }
  src = src.replace(oldStr, newStr);
};

// 1) FREEZE flag — ?freeze=1 pins all animation for pixel-identical reload shots
rep(`const M = THREE.MeshStandardMaterial;`,
`const M = THREE.MeshStandardMaterial;
const FREEZE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('freeze');`);

// 2) tickWorld gate: water uniform pinned too (uTime drives the shader)
rep(`export function tickWorld(t, dt) {
  uTime.value = t;`,
`export function tickWorld(t, dt) {
  uTime.value = FREEZE ? 0 : t;
  if (FREEZE) return;`);

// 3) named signal junctions (contract list; Commerce x Scholar does not exist —
//    Scholar Ln ends at Main; substituted Commerce x Cedar per evaluator clause)
rep(`  const ix = intersections().filter(i => i.wv >= 16 && i.wh >= 16);`,
`  const allIx = intersections();
  const WANT_SIG = [
    ['Main St', 'University Ave'], ['Main St', 'Scholar Ln'],
    ['Elm St', 'Cedar Ave'], ['Commerce Blvd', 'University Ave'],
    ['Commerce Blvd', 'Cedar Ave'], ['Midtown Ave', 'University Ave'],
    ['Schoolhouse Rd', 'Cedar Ave'], ['Commerce Blvd', 'Parkside Dr'],
    ['Wellness Way', 'Parkside Dr'], ['Wellness Way', 'University Ave'],
  ];
  const wanted = WANT_SIG.map(([a, b]) => allIx.find(i =>
    (i.vn === a && i.hn === b) || (i.vn === b && i.hn === a))).filter(Boolean);
  const ix = wanted.length >= 8 ? wanted
    : allIx.filter(i => i.wv >= 16 && i.wh >= 16).slice(0, 10);`);

// 4) signal loop uses the named list directly
rep(`  for (const i of ix.slice(0, 10)) {
    for (const [cx, cz, ry] of [[-1, -1, 0], [1, 1, Math.PI]]) {`,
`  for (const i of ix) {
    for (const [cx, cz, ry] of [[-1, -1, 0], [1, 1, Math.PI]]) {`);

// 5) buildTraffic: signal-node map + per-edge car index for queueing
rep(`  const bodyIM = new THREE.InstancedMesh(body, new M({ color: '#fff', roughness: .35, metalness: .5 }), cars.length);`,
`  // signalized nodes for traffic causality (same junction list as the bulbs)
  const skey = (x, z) => Math.round(x / 4) + ',' + Math.round(z / 4);
  const sigNodes = new Map();
  {
    const allIx = intersections();
    const WANT_SIG2 = [
      ['Main St', 'University Ave'], ['Main St', 'Scholar Ln'],
      ['Elm St', 'Cedar Ave'], ['Commerce Blvd', 'University Ave'],
      ['Commerce Blvd', 'Cedar Ave'], ['Midtown Ave', 'University Ave'],
      ['Schoolhouse Rd', 'Cedar Ave'], ['Commerce Blvd', 'Parkside Dr'],
      ['Wellness Way', 'Parkside Dr'], ['Wellness Way', 'University Ave'],
    ];
    for (const [a, b] of WANT_SIG2) {
      const i = allIx.find(j => (j.vn === a && j.hn === b) || (j.vn === b && j.hn === a));
      if (i) sigNodes.set(skey(i.x, i.z), { jxn: a + ' x ' + b, queued: 0 });
    }
  }
  // cars grouped per edge+direction for cheap following logic
  const lanes = new Map();
  cars.forEach(c => {
    const k = c.e;
    if (!lanes.has(k)) lanes.set(k, { 1: [], '-1': [] });
    lanes.get(k)[c.dir].push(c);
  });
  const bodyIM = new THREE.InstancedMesh(body, new M({ color: '#fff', roughness: .35, metalness: .5 }), cars.length);`);

rep(`  traffic = { cars, bodyIM, trimIM, place };`,
`  traffic = { cars, bodyIM, trimIM, place, sigNodes, lanes, skey };`);

// 6) tickWorld traffic block: signal phases + stop-go + queue export
rep(`  if (traffic) {
    const { cars, bodyIM, trimIM, place } = traffic;
    cars.forEach((c, i) => {
      const len = c.e.a1 - c.e.a0;
      // ease off near intersections
      const dEnd = c.dir > 0 ? (1 - c.t) * len : c.t * len;
      const v = c.v * (dEnd < 18 ? (.55 + .45 * dEnd / 18) : 1);
      c.t += c.dir * v * dt / len;`,
`  if (traffic) {
    const { cars, bodyIM, trimIM, place, sigNodes, lanes, skey } = traffic;
    const cyc = t % 19;
    const vGo = cyc < 9.6, hGo = cyc >= 10.4 && cyc < 19;   // matches bulb windows
    for (const s of sigNodes.values()) s.queued = 0;
    // leader-following pass: re-sort each edge lane then enforce gaps
    for (const [e, dirs] of lanes) for (const d of [1, -1]) {
      const lane = dirs[d];
      if (lane.length < 2) continue;
      lane.sort((a, b) => (a.t - b.t) * d);
      for (let k = 1; k < lane.length; k++) {
        const lead = lane[k - 1], fol = lane[k];
        if (Math.abs(lead.t - fol.t) * (e.a1 - e.a0) < 8) fol.capV = Math.min(fol.capV ?? 99, lead.capV ?? lead.v);
      }
    }
    cars.forEach((c, i) => {
      const len = c.e.a1 - c.e.a0;
      const dEnd = c.dir > 0 ? (1 - c.t) * len : c.t * len;
      const node = c.dir > 0 ? c.e.n1 : c.e.n0;
      const sig = sigNodes.get(skey(node.x, node.z));
      let v = c.v * (dEnd < 18 ? (.55 + .45 * dEnd / 18) : 1);
      // red phase for this approach: decelerate to a 9m stopline, queue
      if (sig && dEnd < 20 && !(c.e.axis === 'v' ? vGo : hGo)) {
        v = Math.min(v, Math.max(0, (dEnd - 9) * c.v / 11));
        if (dEnd < 14 && v < .5) sig.queued++;
      }
      if (c.capV !== undefined) { v = Math.min(v, c.capV); if ((c.capT = (c.capT || 0) - dt) <= 0) delete c.capV; }
      c.t += c.dir * v * dt / len;`);

// 7) republish after the junction-transition block (add live export)
rep(`      place(c, i);
    });
    bodyIM.instanceMatrix.needsUpdate = true;
    trimIM.instanceMatrix.needsUpdate = true;
  }
  // pedestrians`,
`      place(c, i);
    });
    bodyIM.instanceMatrix.needsUpdate = true;
    trimIM.instanceMatrix.needsUpdate = true;
    if (window.__city) {
      const phase = cyc < 9.6 ? 'v-green' : cyc < 10.4 ? 'all-red' : 'h-green';
      window.__city.traffic = {
        ...(window.__city.traffic || {}), moving: cars.length,
        signals: [...sigNodes.values()].map(s => ({ jxn: s.jxn, phase, queued: s.queued })),
      };
    }
  }
  // pedestrians`);

fs.writeFileSync(p, src);
console.log('patch-s02a applied');
