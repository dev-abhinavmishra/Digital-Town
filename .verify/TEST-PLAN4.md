# Test Plan — PR #45 shrink-perf (devin/1790731595-shrink-perf)

Branch: devin/1790731595-shrink-perf @ C:\Users\Administrator\repos\Digital-Town (HEAD 3fb5e8d)
Serve: node town/server.cjs → http://127.0.0.1:8778 (verified 200; serves working tree)
Driver: persistent Chrome 137 @ :9223 (--enable-unsafe-swiftshader --use-angle=swiftshader
--disable-gpu-sandbox), inner 1280×720, step.mjs one-shot CDP + errwatch logger.
All URLs use &still=1. Recording + annotations.

Ground truth from diff:
- WS=.62; `world` group under scene holds ALL town geo; world.scale=.62; interiors on scene unscaled.
- window.__ws===.62. P presets scaled (aerial → ~[334.8,384.4,409.2]→[-18.6,0,-24.8]).
- CULL on min/low/med; CULL_BASE={min:190,low:230,med:330}; culler tests userData.cb bounds-gap <r.
- TIER_CFG: ultra{ratio2.5,msaa4,ao1,detail1} high{1.5,2,1,.85} med{1.25,0,0,.7} low{1,0,0,.45} min{.6,0,0,.12}.
- Angle-tint: envMapIntensity≤.5 for non-glass roughness≥.8; canvasTex aniso default 16.
- HUD: #uiTopRight one flex row: #uiBtns{uiBtnDir,uiBtnTour,uiBtnRubric,uiBtnGuide}+#uiTier (5 controls).
  #uiBudget REMOVED. #uiGuide overlay z-60; tier rows TIERS[] w/ chunked-loading text.
- interior.js: saved.p/q captured BEFORE I.on=true (bug #43 fixed); click guard >1000ms;
  pick uses hit.point UNCHANGED — possible ws-coordinate bug (hit is world=layout*.62
  but pickBuildingAt expects layout coords).

## Load 1 — ?view=aerial&still=1 (default/auto tier)
- __ready; assert __ws===0.62 && scene.getObjectByName('world').scale.x===0.62.
- Shot s1-aerial: town visibly tighter vs earlier runs (mountains closer). No clipping.
- ?labels=1 reload OR label check via existing labels if on — verify label positions
  track scaled building tops (visual: labels sit on buildings not floating high).

## Load 2 — ?q=min&view=mainstreet&still=1
- __ready; uiTier 'MIN'; probe → expect ~360k tris / ~300 calls (PR claims 359,674/306).
- __renderer.getPixelRatio() ≤ .6. CULL: cells visible only if cb-gap² < (max(190,y*3))² —
  audit via traverse(userData.cb): for each chunk compute dx=max(cb.x0-px,px-cb.x1,0),
  dz similarly, assert visible===(dx²+dz²<r²).
- Shot s2-min-street: near field intact (cull radius tighter 190 vs old 300 — watch for
  mid-field holes at ~190-250m! cell bounds test should prevent dropouts under camera).
- MED spot: quick ?q=med&view=mainstreet: uiTier 'MED', pixelRatio ≤1.25, tris < high.

## Load 3 — ?q=high&view=mainstreet&still=1
- uiTier 'HIGH'; pixelRatio ≤1.5; probe tris/calls; shot s3-high-street.
- Angle-tint audit: traverse materials → for every non-glass roughness≥.8 standard mat,
  envMapIntensity must be ≤0.5 (±eps). Report max found + count.
- Angle-tint visual: fixed street pos, shot s4-graze (near-horizontal down road) vs
  s5-steep (same area from ~60° down): asphalt/roofs should NOT show sky-blue tint
  at grazing. (judged visually; audit is the hard check)

## Load 4 — ?q=ultra&view=mainstreet (skip if load >6min)
- uiTier 'ULTRA'; pixelRatio ≤2.5; tris/calls; shot s6-ultra if feasible.

## HUD (on any loaded page — use Load 1 page)
- #uiTopRight direct children count and ids → exactly [uiBtns, uiTier]; uiBtns children =
  uiBtnDir,uiBtnTour,uiBtnRubric,uiBtnGuide (4 buttons + tier chip = 5 controls, one row).
- #uiBudget === null. Shot s7-hud-row (top-right controls single line).
- Click #uiBtnGuide → #uiGuide.open; tier rows mention 'chunked map loading' on
  med/low/min rows + '4x MSAA'/'2.5x pixels' on ultra; running tier badge shows current.
  Shot s8-guide. Close.
- Click #uiBtnRubric → #uiRubric.open → text includes '$9.95M spent of $10.00M' +
  'health $6.25M, community $3.70M'. Shot s9-brief. Close.

## Interiors on scaled world (Load 2 min page or dedicated aerial)
- Deep link: goto ?interior=campuscare → __interior.on true, kind 'medical',
  bid 'campuscare'; panel '#…CampusCare Student Health Clinic'; room full-size
  (spec ~ward dims in meters, unscaled). Shot s10-interior.
- ESC → on false, camera ≈ saved aerial pose EXACTLY (scaled preset coords).
- RE-ENTRY pose regression check (was the #43 bug): enter again via byId('hospital') →
  ESC → camera must STILL return to the pose it had before this second enter (bug fixed
  only if second exit restores correctly).
- Click-enter (the suspected ws bug): setcam scaled hospital preset (240,90,-300)*.62 =
  (148.8,55.8,-186) → target (70,30,-500)*.62=(43.4,18.6,-310); project world-space
  facade point (80,26,-505)*.62=(49.6,16.1,-313.1) → clickxy → check __interior.b.id:
  EXPECTED-BROKEN CANDIDATE: pickBuildingAt receives world coords (~49.6,-313.1) but
  rects are layout coords → likely picks wrong building or null → FAIL if b.id!=='hospital'
  or on===false. Diagnose: eval pickBuildingAt(49.6,-313.1) directly → report what it returns.
- ALSO test a center-ish building click if hospital fails — buildings near (0,0) map
  nearly correctly; an edge building maps ~38% off → documents misalignment extent.

## FACILITIES fly-to (HUD section page)
- Open #uiBtnDir → click .fi[data-id="hospital"] → wait ~4s → __cam.position ≈
  scaled flyTo: dist=202.8,ang≈3.585 → layout(-6.96,107.2,-688.2) → scaled ≈ (-4.3,66.5,-426.7)
  ±30. Card shows too.

## Console errors
- errwatch log must be empty across all loads.

## Evidence
- shots2/s*.png; summary-shrink.json; per-tier {tris,calls,ratio} table; recording.
