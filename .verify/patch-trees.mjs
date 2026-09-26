import fs from 'fs';
const p = 'C:/Users/pmsma/Downloads/HST Digital Town Project/town/js/details.js';
const t = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const anchor = t.findIndex(l => l.includes('export function buildTrees'));
const helpers = [
`/* district palettes - corridors/districts read differently by canopy */`,
`const DISTRICT_TREES = [`,
`  { name: 'downtown',      x0: -170, x1: 340,  z0: -350, z1: -40,  mix: [['u', .55], ['d', .3], ['b', .15]] },`,
`  { name: 'campus',        x0: -800, x1: -330, z0: -720, z1: -400, mix: [['e', .5], ['o', .25], ['u', .25]] },`,
`  { name: 'senior',        x0: 340,  x1: 800,  z0: -700, z1: -200, mix: [['w', .35], ['d', .3], ['o', .2], ['s', .15]] },`,
`  { name: 'commercial',    x0: -140, x1: 345,  z0: 430,  z1: 710,  mix: [['u', .4], ['b', .3], ['d', .3]] },`,
`  { name: 'residential-w', x0: -800, x1: -160, z0: 40,   z1: 430,  mix: [['o', .4], ['m', .25], ['e', .25], ['w', .1]] },`,
`  { name: 'grove',         x0: -130, x1: 310,  z0: -30,  z1: 310,  mix: [['o', .35], ['e', .3], ['m', .2], ['d', .15]] },`,
`  { name: 'park',          x0: 340,  x1: 800,  z0: -60,  z1: 310,  mix: [['o', .4], ['s', .2], ['w', .2], ['e', .2]] },`,
`];`,
`const districtOf = (x, z) => DISTRICT_TREES.find(d => x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) || null;`,
`const pickFrom = mix => { let r = R(); if (Array.isArray(mix[0])) { for (const [k, w] of mix) { if ((r -= w) <= 0) return k; } return mix[0][0]; } for (let i = 1; i < mix.length; i += 2) { if ((r -= mix[i]) <= 0) return mix[i - 1]; } return mix[0]; };`,
`const speciesFor = (x, z, fallback) => { const d = districtOf(x, z); return d ? pickFrom(d.mix) : fallback; };`,
``,
];
t.splice(anchor, 0, ...helpers);
fs.writeFileSync(p, t.join('\n'));
console.log('inserted', helpers.length, 'lines before buildTrees at', anchor + 1);
