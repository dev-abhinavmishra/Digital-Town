# Test Plan — Havenbrook AAA detail pass (devin/1790452029-aaa-detail-pass)

Branch: devin/1790452029-aaa-detail-pass @ C:\Users\Administrator\repos\Digital-Town
Serve: node town/server.cjs → http://127.0.0.1:8778 (already running, verified ui.js md5 matches working tree)
Driver: playwright-core (.verify/node_modules) launching headed Chrome (C:/devin/chrome/chrome-win64/chrome.exe),
viewport 1280x720, via a stdin-driven REPL script (.verify/drive.mjs) — one browser for the whole run,
console 'error' + pageerror listeners armed before every navigation.
Screen recording of the headed window + annotate_recording at each stage.
SwiftShader: each __ready wait can take 2-4 min; per-load timeout 420s.

Every navigation: assert `window.__ready === true`, then `errors` list must be EMPTY (console errors/pageerrors),
then `probe` = __renderer.info.render.{calls,triangles} + __fx.fps (record values).
Screenshots go to C:\Users\Administrator\repos\Digital-Town\.verify\shots2\.

## Stage 1 — aerial boot + mountains/haze (view=aerial&still=1)
- __ready true ≤420s; 0 console errors.
- Shot `a1-aerial`: town + mountain ring; expect 3 ridges incl. near wooded foothill ridge,
  snow only near tops (higher snowlines), sky/horizon not whited-out (reduced day haze).
- Adversarial: if foothill ridge missing → only 2 far ridges visible; if haze unfixed → washed-out horizon.

## Stage 2 — HUD (same page)
1. Budget chip: read `#uiBudget .row1 span` text → MUST equal `$9.95M / $10.00M` (exact).
   Click `#uiBudget` → class `open` present; shot `a2-budget-open` shows breakdown
   ("Healthcare (13 facilities): $6.25M", "Community (11 locations): $3.70M", "Remaining headroom: $0.05M").
   Broken test: wrong total or no `.open` → fail.
2. FACILITIES: click `#uiBtnDir` → `#uiDrawer.open`; shot `a3-drawer` shows 3 groups.
   Click `.fi[data-id="hospital"]` → `#uiCard.show`; card h3 contains "Havenbrook General Hospital",
   `.cost` = "Cost $1.50M". Assert `__flyDone()` is false right after click OR becomes true ≤4s;
   then assert `__cam.position` ≈ (112, 107, -706) ±60 (computed from flyToBuilding for hospital
   x=80,z=-505,h=52 → dist≈202.8, ang≈atan2(80,-505)+.6). Shot `a4-card-flight`.
   Broken test: card shows but camera never moves → fail.
3. TOUR: click `#uiBtnTour` → `#uiTourBar.show`; caption b = "Anchored free: the University School of
   Medicine"; step text "1 / 8"; button has `.on`. Wait ≤4s for flight; shot `a5-tour-stop1`.
   Click `#uiTourNext` → caption b = "Havenbrook General Hospital ($1.5M)"; step "2 / 8"
   (proves NEXT does NOT end tour — window mousedown handler is bypassed by stopPropagation).
   Press Escape → `#uiTourBar` loses `.show`; after ~3s `__flyDone()` true (return-to-aerial tween).
   Restart tour (click `#uiBtnTour`), wait 1s, then mousedown on canvas center → `#uiTourBar`
   loses `.show` (mousedown-ends-tour path). Re-showing not needed; leave ended.
4. PROJECT BRIEF: click `#uiBtnRubric` → `#uiRubric.open`; shot `a6-rubric` shows
   "Havenbrook — Project Brief" + ≥8 requirement rows with ✓. Click `#uiRubricX` → `.open` gone.

## Stage 3 — ?view=mainstreet&still=1 (streetscape details)
- __ready, 0 errors, probe. Shot `b1-mainstreet` (street level: card-foliage trees, moving/parked
  vehicles, articulated pedestrians, meters, blades).
- `__setCam` close-ups (each +shot):
  a. blades: cam (-170,5,-8)→(-150.4,2.9,-30.6) — University Ave × Main St pole, lettered green blades `b2-blades`.
  b. meters: cam (-60,4,-80)→(0,1,-62) — meter row along Main St sidewalk `b3-meters`.
  c. vehicles: cam (60,5,-15)→(30,1.5,-40) — curb lane, wheels/plates/exhausts `b4-vehicles`.
  d. pedestrians: cam (-100,4,-70)→(-40,1.5,-45) — sidewalk walkers, arms/legs `b5-people`.
  e. asphalt wear: cam (20,10,-90)→(20,0,-40) — wheel tracks/oil stains/scuffs on Main St `b6-wear`.
  (If a close-up misses the target — people/vehicles move — adjust camera once and reshoot.)

## Stage 4 — ?view=park&still=1
- __ready, 0 errors, probe. Shot `c1-park`: ponds, card-crown trees, park content.

## Stage 5 — ?view=downtown&still=1
- __ready, 0 errors, probe. Shot `d1-downtown`: skyline, blades at junction if in frame, meters.

## Stage 6 — ?view=mainstreet&time=dusk&still=1
- __ready, 0 errors, probe. Shot `e1-dusk`: headlight/taillight glow quads on vehicles,
  lit windows (emissive 1.7), lamp pools/halos. Adversarial: no glows → cars look same as day.
- Optional close-up `__setCam` near a lit car `e2-dusk-glow` if wide shot is ambiguous.

## Evidence collected
- Per-view: screenshot PNG + {calls, tris, fps} + console-error list (must be []).
- HUD: DOM assertions (exact strings) + screenshots + camera-position check for flyTo.
- Final: stop recording; write summary JSON to .verify/shots2/summary.json.
