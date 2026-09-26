import fs from 'fs';
const p = 'C:/Users/pmsma/Downloads/HST Digital Town Project/town/js/details.js';
const L = fs.readFileSync(p, 'utf8').split(/\r?\n/);
// inserted block spans from the sprint-02 comment to the __city.veg closing brace
const s = L.findIndex(l => l.includes('sprint-02: sidewalk furniture scatter'));
const e = L.findIndex(l => l.includes('window.__city.veg'));
if (s < 0 || e < 0) { console.error('block not found', s, e); process.exit(1); }
// include trailing closing '}' and blank line after the if-block
let end = e;
while (!L[end].trim().startsWith('}') || !L[end].includes('}')) end++;
end++; // consume '}' line of the if
const block = L.splice(s, end - s);
// also drop the now-orphaned leading blank line if doubled
while (L[s] !== undefined && L[s].trim() === '' && L[s - 1] !== undefined && L[s - 1].trim() === '') L.splice(s, 1);
// find propMesh INSIDE buildProps (after its declaration)
const bp = L.findIndex(l => l.includes('export function buildProps'));
let pm = -1;
for (let i = bp; i < L.length; i++) if (L[i].includes('const propMesh')) { pm = i; break; }
if (bp < 0 || pm < 0) { console.error('targets missing', bp, pm); process.exit(1); }
L.splice(pm, 0, ...block, '');
fs.writeFileSync(p, L.join('\n'));
console.log('moved block: from', s + 1, 'to before', pm + 1);
