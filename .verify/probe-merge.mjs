import { chromium } from 'playwright-core';
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const b = await chromium.connectOverCDP('http://localhost:9223');
    const p = b.contexts()[0].pages().find(x => x.url().includes('8778'));
    if (!p) { console.log('no page'); await b.close(); await sleep(5000); continue; }
    let r;
    try {
      r = await p.evaluate(() => ({
        ready: !!window.__ready, ws: window.__ws,
        fx: window.__fx ? { tier: window.__fx.tier, msaa: window.__fx.msaa, ao: window.__fx.ao } : null,
        world: !!window.__scene?.getObjectByName?.('world'),
        prof: (window.__prof || []).map(x => x[0] + ':' + x[1]).join(' '),
        cam: window.__cam ? window.__cam.position.toArray().map(v => Math.round(v)) : null
      }));
    } catch (e) { console.log('ctx destroyed — reloading'); await b.close(); await sleep(15000); continue; }
    console.log('PROBE', JSON.stringify(r));
    if (r.ready) {
      const deep = await p.evaluate(() => {
        const errs = []; const w = window.__ws || 1;
        const S = window.__scene;
        // medhall should sit near world (40*ws, -270*ws) = (24.8, -167.4)
        let med = null;
        S.traverse(o => { if (!med && o.name && /medhall|med_hall/i.test(o.name)) med = o; });
        return {
          deckFns: typeof window.__deck === 'object' ? Object.keys(window.__deck) : null,
          flyTo: typeof window.__flyTo, enterI: typeof window.__enterInterior,
          labels: document.querySelectorAll('#labels .lbl').length,
          topRight: document.querySelectorAll('#uiTopRight .btn').length + 'btn+' + (document.getElementById('uiTier') ? 'tier' : 'none'),
          budgetEl: !!document.getElementById('uiBudget'),
          tris: window.__renderer?.info.render.triangles, calls: window.__renderer?.info.render.calls
        };
      }).catch(e => ({ evalErr: String(e).slice(0, 120) }));
      console.log('DEEP', JSON.stringify(deep));
      await b.close();
      process.exit(0);
    }
    await b.close();
    await sleep(20000);
  } catch (e) { console.log('connect fail', String(e).slice(0, 80)); await sleep(15000); }
}
console.log('TIMEOUT waiting for __ready');
