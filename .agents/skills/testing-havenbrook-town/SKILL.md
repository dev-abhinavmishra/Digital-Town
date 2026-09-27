---
name: testing-havenbrook-town
description: How to run and verify the Havenbrook 3D town (town/server.cjs :8778) on this Windows box — Chrome SwiftShader flags, CDP driving pattern, page probes, and expected values.
---

# Testing the Havenbrook 3D town on this box

## Serve
`node town/server.cjs` serves `town/` on http://127.0.0.1:8778 (no bundler; importmap → town/node_modules/three). Verify it serves the working tree: `curl -s http://127.0.0.1:8778/js/ui.js | md5sum` vs `md5sum town/js/ui.js`.

## Chrome / WebGL on this box (critical)
- Chrome for Testing 137 lives at `C:/devin/chrome/chrome-win64/chrome.exe`. There is NO real GPU — WebGL only works via SwiftShader.
- Chrome 137 requires `--enable-unsafe-swiftshader` or WebGL context creation FAILS ("BindToCurrentSequence failed" → the page's 30s boot watchdog reloads forever and `window.__ready` never fires). Playwright's `chromium.launch` adds this flag automatically (it is already in `.verify/shots.mjs`/`ui-probe.mjs` via playwright); a hand-launched `chrome.exe` must pass it explicitly.
- Flags that work: `--enable-unsafe-swiftshader --use-angle=default --disable-gpu-sandbox`.
- First `window.__ready` takes ~2-4 min per fresh load under SwiftShader (observed 143-196s); use a 420s waitForFunction timeout.

## Driving the page
- `write_to_process` does NOT deliver line terminators that node's `readline` accepts on this ConPTY — a stdin-REPL playwright driver hangs. Instead: launch one persistent Chrome with `--remote-debugging-port=9223 --user-data-dir=<scratch>` and drive it with one-shot `chromium.connectOverCDP` scripts (`.verify/step.mjs` = per-command runner: goto/eval/shot/click/key/wait/probe/fly/setcam/mousedown/readywait; `.verify/errwatch.mjs` = persistent console-error/pageerror logger to a file, since listeners don't survive process exits).
- Viewport: resize the window so `innerWidth/innerHeight` is exactly 1280x720 (outer ≈ 1296x920) via PowerShell `MoveWindow` — CDP-attached pages can't use playwright viewport emulation.
- The environment's own Chrome window may cover the test window in recordings — minimize it (`ShowWindow hwnd 6`) or `SetWindowPos(testHwnd, HWND_TOPMOST,...)` before recording.

## Page probes (window.*)
`__ready` (bool), `__flyTo(px,py,pz,tx,ty,tz,durSec)`, `__flyDone()`, `__setCam(px,py,pz,tx,ty,tz)`, `__cam`, `__scene`, `__renderer.info.render.{calls,triangles}`, `__fx.{fps,callsAvg,atmo,...}`. URL params: `?view=aerial|mainstreet|park|downtown|campus|medical|senior|commercial|school|housing|map`, `?time=day|dusk|golden`, `&still=1` (no auto-orbit), `&labels=1`, `&cam=...`, `&nofx|noao|noatmo|nofog|freeze|debug|fps=1`.

## HUD (town/js/ui.js) — expected values
- `#uiBudget` chip reads exactly `$9.95M / $10.00M` (spent = 9,950,000); click toggles `.open` → breakdown rows.
- `#uiBtnDir` toggles `#uiDrawer.open` (3 groups: free×2, health×13, community×11); clicking `.fi[data-id]` shows `#uiCard.show` and calls `__flyTo` — verify `__cam.position` ≈ `flyToBuilding` formula: dist=max(w,d)*1.7+26, ang=atan2(b.x,b.z)+.6, px=b.x+sin(ang)*dist, pz=b.z+cos(ang)*dist, py=max(30,h*1.6+24).
- `#uiBtnTour` starts 8-stop tour in `#uiTourBar` (`.cap b` caption, `.step` "n / 8", auto-advance every 9s); `#uiTourNext` advances (its mousedown is stopPropagation'd so it must NOT end the tour); Esc or a canvas mousedown ends it and tweens the camera back to aerial (540,620,660).
- `#uiBtnRubric` opens `#uiRubric.open` (9 ✓ rows); `#uiRubricX` or backdrop click closes.

## Good camera spots for close-ups
- Street blades: pole at each of the first 8 `intersections()` (all on University Ave x=-140) → SW corner offset (−wv/2−1.4, +wh/2+1.4); e.g. Univ×Main pole ≈(−150.4,−30.6), cam (−138,4.5,−18)→(−150.4,3.1,−30.6).
- Parking meters: rows z=−62 / z=−18 (x −38..180) along Main St; look along the row, e.g. (−30,2.6,−52)→(40,1,−62).
- Pedestrian cluster (idlers): plaza (60,−205)±35, cam (35,5,−168)→(62,1.2,−205).
- Dusk headlight glows: any moving/parked car on Main St, e.g. (55,4,−24)→(95,1.2,−48).

## Devin secrets needed
None — fully local static app.
