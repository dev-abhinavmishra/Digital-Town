# Test Plan — Click-to-enter building interiors (devin/1790469015-building-interiors, PR #43)

Same rig as before: persistent headed Chrome (C:/devin/chrome, --enable-unsafe-swiftshader
--use-angle=default --disable-gpu-sandbox, --remote-debugging-port=9223), window resized so
inner = 1280x720, one-shot CDP commands via .verify/step.mjs, persistent error watcher
.verify/errwatch.mjs → shots2/errors.log (must stay 0 errors). Record screen; test window must
be foreground (env Chrome minimized). Screenshots → .verify/shots2/.

Probes: __ready, __interior{.on,.kind,.b,.spec}, __enterInterior(id), __exitInterior(),
__cam (position+quaternion), __renderer.info.

## Load 1 — ?view=aerial&still=1&interior=hospital  (proves deep-link + medical archetype)
- goto → READY true ≤420s, errors empty.
- Assert `__interior.on===true`, `__interior.kind==='medical'`, `__interior.b.id==='hospital'`.
- Assert HUD DOM (z-index 72 divs): panel bottom-left contains "#3 Havenbrook General Hospital",
  chip "Healthcare", "Cost $1.50M — 15.0% of the $10.00M budget", desc text,
  "Interior: Clinic floor · footprint 104m × 74m × 52m tall · lower-fidelity set for presentation";
  hint "INTERIOR — drag to look · WASD to walk · ESC to exit" (top-center); "✕ EXIT BUILDING" (top-right).
- Shot `i1-ward` — sealed room w/ beds+curtains+reception; no town ghosting (only stage visible).
- Drag-look: mouse drag 400→800px → __cam quaternion changes (yaw moves); shot `i2-ward-look`.
- WASD clamp: hold W 1.5s → camera moved AND |pos - STAGE(0,-180,0)| clamped to
  ±(spec.w/2-.55, spec.d/2-.55), y === -178.38; hold W 3s more → still clamped (can't leave).
- ESC exit: `__interior.on===false`, panel/hint/exitBtn display:none, camera pos+quat ==
  saved aerial pose (compare saved eval snapshot); screenshot `i3-back-aerial` shows town again.

## Click-path (same page)
- __setCam to hospital preset (240,90,-300 → 70,30,-500); project (80,26,-505) to screen px;
  `mousedown`-style quick mouse.click there (short click, not drag).
- Assert __interior.on true, kind 'medical' (hospital). Shot `i4-click-enter`.
- Exit via EXIT BUILDING button click → on=false; camera restored to hospital preset pose.

## Drawer "step inside" link
- #uiBtnDir → drawer.open; click .fi[data-id="coffee"] → card shows + flies;
  assert card contains element [data-act="in"] with text matching /step inside/.
- Click that link → card hides, __interior.on true, kind 'cafe' (BY_ID coffee→cafe).
- Assert panel: "#25 The Daily Grind Coffeehouse", "Cost $0.10M — 1.0%", "Interior: Dining room".
- Shot `i5-cafe` (tables, counter, MENU board). Exit via ESC.

## Other archetypes via __enterInterior (same enter() path as all entry vectors)
- __enterInterior('medhall') → kind 'hall'; panel "Havenbrook University School of Medicine",
  "Provided free under the town plan", "Great hall"; shot `i6-hall` (desk rows). Exit.
- __enterInterior('mall') → kind 'mall'; panel "#17 Havenbrook Commons Mall",
  "Cost $1.00M — 10.0%", "Atrium"; shot `i7-mall` (atrium/kiosks). Exit.

## Edge cases (same page)
- Park zone: __setCam over Willow Creek Park, project (560,120), click →
  expect #uiCard.show===true AND __interior.on===false (info card, NOT interior). Close card.
- Empty ground: project countryside point (~-900,-750), click → __interior.on false, no card.
- Road mid-block: project (-140,-40) junction area, click → nothing (on false, no card).
- Optional: __enterInterior('preservecommons') → kind 'home' (zone+BY_ID override); shot `i8-home`. Exit.

## Final
- probe perf (calls/tris) inside an interior (should be tiny — town hidden).
- errors.log must be empty → stop recording → summary.json + report.
