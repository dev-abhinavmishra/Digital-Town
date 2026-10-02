## Summary

Wrap-up PR — repo cleanup, dead-dependency removal, and two presentation surfaces for the final slide deck. Sits on top of PR #47's commits; its diff shrinks to the cleanup + deck work once #47 merges.

**In-app PRESENT mode** (`town/js/deck.js`, ~230 lines): a `◉ PRESENT` button in the HUD (`#uiBtnDeck`) starts a cinematic 9-slide deck over the live 3D scene — letterbox bars, staggered serif captions, `__flyTo` camera flights per slide, ~9.5s auto-advance, arrow/edge-click/space-pause/Esc navigation, and a past-last-slide auto-exit that restores the HUD and flies home. It cleanly preempts the tour and interior mode. Exposes `window.__deck` probes for testing.

**Static deck** (`town/deck/index.html` + `town/deck/shots/*.jpg`): the same 9-slide story as a standalone page deployed with the site at `/deck/` — deep-ink editorial design (Palatino display, small-caps kickers, hairline rules, caption blocks instead of cards), 8 hero JPGs recaptured at `q=high` with the flicker fixes in (golden cover aerial, plan, campus, hospital, preserve, park, senior, dusk). Slide 8 is a paper ledger with the $9.95M/$10.00M budget bar. Keyboard, edge, wheel, and print (each slide page-breaks for PDF export). Replaces the two `.pptx` decks, now deleted.

**Cleanup** — 777 → ~127 tracked files: removed ~110 loose root screenshots, stale `town-*` worktrees/snapshots, root `tex/`, committed Chrome profile, one-off `.verify` scripts/artifacts, both `.pptx` decks, `assets/` (superseded by `town/deck/shots/`), and generator-state dumps. `town/package.json` dependencies dropped (`pptxgenjs`, `three` — dead: the app loads `vendor/three` via importmap) and the lockfile regenerated; `audit.mjs` stays clean and the app loads with zero missing imports.

## Test plan

E2E-verified on med tier via real CDP clicks/keys (annotated run + screenshots in the comment below): 12/12 PRESENT assertions, 10/10 static-deck assertions, 14/14 HUD regression, `node town/audit.mjs` clean.
