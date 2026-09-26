import fs from 'fs';
const p = 'C:/Users/pmsma/Downloads/HST Digital Town Project/town/js/details.js';
let src = fs.readFileSync(p, 'utf8');

const rep = (oldStr, newStr) => {
  if (!src.includes(oldStr)) { console.error('ANCHOR MISSING:', JSON.stringify(oldStr.slice(0, 60))); process.exit(1); }
  src = src.replace(oldStr, newStr);
};

// 1) parked cars: keep the two h-axis arterials, add minor streets both axes
rep(`  // parallel parked along Main St & Commerce Blvd curbs
  for (const [c, a0, a1, w] of [[-40, -120, 300, 16], [320, -300, 700, 20]]) {
    for (let a = a0; a < a1; a += rr(9, 16)) for (const s of [-1, 1]) {
      if (R() < .45) parked.push({ x: a, z: c + s * (w / 2 - 1.9), ry: Math.PI / 2, color: pick(CAR_COLORS) });
    }
  }`,
`  // parallel parked curbs — {c: road centreline, axis, along-range, w}
  const CURB_PARK = [
    { c: -40, a0: -120, a1: 300, w: 16, axis: 'h' },   // Main St
    { c: 320, a0: -300, a1: 700, w: 20, axis: 'h' },   // Commerce Blvd
    { c: 140, a0: -780, a1: -160, w: 10, axis: 'h' },  // Elm St
    { c: 425, a0: -780, a1: -160, w: 11, axis: 'h' },  // Schoolhouse Rd
    { c: -180, a0: -700, a1: -160, w: 10, axis: 'h' }, // Midtown Ave
    { c: -640, a0: -700, a1: -160, w: 11, axis: 'h' }, // Campus Dr
    { c: 150, a0: -140, a1: 320, w: 10, axis: 'h' },   // Juniper Ave
    { c: -460, a0: 320, a1: 780, w: 10, axis: 'h' },   // Sunset Ridge Rd
    { c: -240, a0: 320, a1: 780, w: 10, axis: 'h' },   // Meadowlark Ln
    { c: -640, a0: -40, a1: 400, w: 10, axis: 'v' },   // Cedar Ave
    { c: -420, a0: -40, a1: 400, w: 10, axis: 'v' },   // Maple St
    { c: -440, a0: -360, a1: -50, w: 10, axis: 'v' },  // Scholar Ln
    { c: 560, a0: -700, a1: -360, w: 11, axis: 'v' },  // Silver Oak Dr
    { c: 80, a0: -30, a1: 320, w: 10, axis: 'v' },     // Grove St
  ];
  for (const { c, a0, a1, w, axis } of CURB_PARK) {
    for (let a = a0; a < a1; a += rr(9, 16)) for (const s of [-1, 1]) {
      if (R() < .45) {
        parked.push(axis === 'h'
          ? { x: a, z: c + s * (w / 2 - 1.9), ry: Math.PI / 2, color: pick(CAR_COLORS) }
          : { x: c + s * (w / 2 - 1.9), z: a, ry: 0, color: pick(CAR_COLORS) });
      }
    }
  }`);

// 2) pedestrians: more walkers + idler clusters on greens/commons/plaza
rep(`  const idlers = [
    ...Array.from({ length: 10 }, () => [60 + rr(-30, 30), -205 + rr(-25, 25)]),
    ...Array.from({ length: 12 }, () => [-480 + rr(-60, 60), -530 + rr(-40, 40)]),
    ...Array.from({ length: 6 }, () => [rr(380, 700), rr(345, 430)]),
  ];
  const edges = roadGraph();
  const walkers = [];
  for (let i = 0; i < 60; i++) {`,
`  const idlers = [
    ...Array.from({ length: 14 }, () => [60 + rr(-35, 35), -205 + rr(-28, 28)]),
    ...Array.from({ length: 14 }, () => [-480 + rr(-65, 65), -530 + rr(-45, 45)]),
    ...Array.from({ length: 10 }, () => [rr(380, 700), rr(345, 430)]),
    ...Array.from({ length: 10 }, () => [rr(-580, -420), rr(80, 280)]),
    ...Array.from({ length: 8 }, () => [rr(360, 700), rr(-470, -380)]),
    ...Array.from({ length: 10 }, () => [rr(-60, 300), rr(335, 425)]),
    ...Array.from({ length: 8 }, () => [rr(-160, 320), rr(60, 240)]),
  ];
  const edges = roadGraph();
  const walkers = [];
  for (let i = 0; i < 130; i++) {`);

// 3) export people counts
rep(`  people = { walkers, legLIM, legRIM, torsoIM, headIM, n0: idlers.length };`,
`  people = { walkers, legLIM, legRIM, torsoIM, headIM, n0: idlers.length };
  if (window.__city) window.__city.traffic = {
    ...(window.__city.traffic || {}), pedestrians: total, idlers: idlers.length,
  };`);

// 4) parked count export at end of buildCars (after buses)
rep(`  for (const bx of [-545, -530, -515, -500]) {
    const bm = new THREE.Mesh(busGeo, VCOL());
    bm.position.set(bx, 0, 452); bm.rotation.y = Math.PI / 2; bm.castShadow = true;
    scene.add(bm);
  }
}`,
`  for (const bx of [-545, -530, -515, -500]) {
    const bm = new THREE.Mesh(busGeo, VCOL());
    bm.position.set(bx, 0, 452); bm.rotation.y = Math.PI / 2; bm.castShadow = true;
    scene.add(bm);
  }
  if (window.__city) window.__city.traffic = {
    ...(window.__city.traffic || {}), parked: parked.length,
  };
}`);

fs.writeFileSync(p, src);
console.log('patch-s02b applied');
