# PR #47 test plan — z-fight lift ranks, keyed pbr tints, light-glass HUD

App: http://127.0.0.1:8778 (node town/server.cjs, serves working tree — md5 verified).
Driver: .verify/step-linux.mjs over CDP :29229 (devin Chrome, SwiftShader WebGL2).
URL: http://127.0.0.1:8778/?view=aerial&time=day&still=1 — reload to guarantee new code.
__ready may take ~4min + watchdog reloads; wait up to 420s.
Evidence: .verify/shots-linux/*.png + screen recording of HUD interactions.

## T1 Boot + probes
- Reload page; wait window.__ready === true, count console/page errors.
  PASS: ready=true, 0 page errors. `__fx.fps`/`__renderer.info.render.calls` present.
- Probe sanity: `typeof __uiShowCard === 'function'`, `typeof __setCam === 'function'`,
  `typeof __flyTo === 'function'`, `__uiShowCard('hospital')` → `#uiCard.show` with h3
  containing 'Havenbrook General Hospital'; then close card.

## T2 Aerial surface ordering (z-fight fix)
- Screenshot at default aerial (540,620,660 → -30,0,-40).
- setCam to 4 more poses orbiting the centre at mixed elevations incl. a low
  graze; screenshot each:
    A (700,420,-420)→(-30,0,-40)  SE low graze
    B (-650,380,520)→(-30,0,-40)  SW
    C (-420,520,-620)→(-30,0,-40) NW
    D (60,140,60)→(60,0,-140)     near-vertical over hospital
- PASS per shot: lane stripes + junction pads + gutters + sidewalks all render
  in their stacked order (stripes/pads visible ON TOP of asphalt, not replaced
  by grass/terrain patches); no confetti-like pink/violet speckle on ground;
  different lawns visibly different greens.
- Numeric check at Univ×Main junction pad (~(-140,-40,0)): project world→screen
  in each pose, sample pixel — must stay asphalt-grey family (not grass-green)
  at every angle. A broken lift() would show it flicker to terrain colour.

## T3 Lawn tint variety (keyed pbr fix)
- From the default aerial screenshot, project+sample centre pixels of:
  park zone (576,1,120 → park lawn #a8c088), school field area (-510,1,540),
  campus quad (-480,1,-540), plus a park-path/gravel spot if resolvable.
- PASS: the three lawn samples have clearly distinct RGB (a broken shared
  material makes them identical). Also confirm mowing-stripe banding visible
  on at least one maintained lawn in an aerial/street shot (3 decal variants).

## T4 Street/grazing level ordering
- setCam (-138,4.5,-18)→(-150.4,3.1,-30.6) Univ×Main junction closeup — shot.
- setCam (-30,2.6,-52)→(40,1,-62) grazing along Main — shot.
- PASS: road ribbon, gutters, sidewalk, crosswalk stripes, junction pad in
  correct order; no z-fight shimmer patches.

## T5 HUD light-glass functional sweep (real clicks via page.mouse)
1. `#uiBudget` — visible top-right; `.row1 span` text === '$9.95M / $10.00M';
   computed bg is translucent-white (rgba(252,253,252,*)), text #16323e.
   Click → `.open` → `.sub` visible with 4 breakdown lines; click again closes.
2. `#uiBtnDir` (≡ FACILITIES) click → `#uiDrawer.open`; 3 `.grp h4` read
   'Provided by the town (2)', 'Healthcare facilities (13)',
   'Community locations (11)'; 26 `.fi` rows total, light themed. Shot.
3. Click `.fi[data-id="hospital"]` → `#uiCard.show`, h3 has 'Havenbrook General
   Hospital', chip 'Healthcare', cost '$1.50M', has '.fly' fly-there AND
   '[data-act="in"]' step-inside link. Camera starts tweening toward hospital
   (`__cam` moves / `__flyDone` after ~1.8s lands near flyToBuilding pose).
   Shot.
4. `#uiBtnRubric` (✓ PROJECT BRIEF) → `#uiRubric.open`; panel light glass,
   table has 9 `td.ok` rows with ✓. Close via `#uiRubricX`. Shot.
5. `#uiBtnGuide` (ⓘ GUIDE) → `#uiGuide.open`; 6 `.tr` tier rows
   (AUTO/ULTRA/HIGH/MED/LOW/MIN), running tier shows 'RUNNING NOW' bdg. Close.
   Shot.
6. `#uiTier` chip textContent matches /^PERF (MIN|LOW|MED|HIGH|ULTRA)$/ and
   light-glass styled.
7. `#uiBtnTour` → `#uiTourBar.show`, `.cap b` = medhall stop title,
   `.step` starts '1 / 8'; click `#uiTourNext` → step becomes '2 / 8' AND tour
   still active (its mousedown is stopPropagation'd — regression check);
   press Escape → tourBar hidden AND camera tweens back to ≈(540,620,660)
   target (-30,0,-40); verify __cam position after ~3s ≈ 540,620,660 ±40.
   Shot of tourbar before Esc.
8. `#hint` top-left + `.lbl` labels: computed style light (rgba(252,253,252)),
   ink text — shot already covers if labels visible at aerial.

## T6 End state
- Final screenshot: clean aerial, light HUD, no errors. Summarise any
  discrepancies (wrong counts, missing links, flicker seen, theme misses).
