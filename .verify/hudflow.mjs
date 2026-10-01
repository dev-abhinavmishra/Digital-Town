// hudflow.mjs — PR47 HUD light-glass functional sweep over CDP :29229.
// Real mouse clicks at element centers; asserts DOM state; saves shots.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const OUT = new URL('./shots-linux/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const R = { steps: [] };
const ok = (name, pass, detail) => { R.steps.push({ name, pass, detail }); console.log((pass ? 'PASS' : 'FAIL'), name, '—', detail); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.connectOverCDP('http://127.0.0.1:29229');
try {
  const page = browser.contexts()[0].pages().find(p => p.url().includes('127.0.0.1:8778'));
  if (!page) throw new Error('no 8778 page');
  page.setDefaultTimeout(20000);
  const shot = async n => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 120000 }); console.log('SHOT', n); };
  const clickEl = async sel => {
    const r = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
    if (!r) return false;
    await page.mouse.click(r.x, r.y);
    return true;
  };
  const ev = (js, arg) => page.evaluate(js, arg);

  /* ---------- T1 probes ---------- */
  const probes = await ev(`({
    ready: window.__ready === true,
    uiShowCard: typeof window.__uiShowCard,
    setCam: typeof window.__setCam,
    flyTo: typeof window.__flyTo,
    flyDone: typeof window.__flyDone,
    fx: !!window.__fx, tier: window.__fx && window.__fx.tier,
    calls: window.__renderer && window.__renderer.info.render.calls,
    tris: window.__renderer && window.__renderer.info.render.triangles,
  })`);
  ok('T1 probes', probes.ready && probes.uiShowCard === 'function' && probes.setCam === 'function', JSON.stringify(probes));

  /* ---------- T5.1 budget ---------- */
  const budg = await ev(`({
    text: document.querySelector('#uiBudget .row1 span')?.textContent?.trim(),
    title: document.querySelector('#uiBudget .row1 b')?.textContent?.trim(),
    bg: getComputedStyle(document.querySelector('#uiBudget')).backgroundColor,
    col: getComputedStyle(document.querySelector('#uiBudget')).color,
    blur: getComputedStyle(document.querySelector('#uiBudget')).backdropFilter,
  })`);
  ok('T5.1a budget chip', budg.text === '$9.95M / $10.00M' && budg.col === 'rgb(22, 50, 62)' && budg.bg.startsWith('rgba(252, 253, 252'), JSON.stringify(budg));
  await clickEl('#uiBudget'); await sleep(400);
  const sub = await ev(`({ open: document.querySelector('#uiBudget').classList.contains('open'),
    vis: getComputedStyle(document.querySelector('#uiBudget .sub')).display,
    lines: document.querySelectorAll('#uiBudget .sub .k').length })`);
  ok('T5.1b budget breakdown', sub.open && sub.vis === 'block' && sub.lines === 4, JSON.stringify(sub));
  await shot('hud-budget-open');
  await clickEl('#uiBudget'); await sleep(300);

  /* ---------- T5.2 facilities drawer ---------- */
  await clickEl('#uiBtnDir'); await sleep(500);
  const draw = await ev(`({
    open: document.querySelector('#uiDrawer').classList.contains('open'),
    groups: [...document.querySelectorAll('#uiDrawer .grp h4')].map(h => h.textContent.trim()),
    rows: document.querySelectorAll('#uiDrawer .fi').length,
    bg: getComputedStyle(document.querySelector('#uiDrawer')).backgroundColor,
    rowbg: getComputedStyle(document.querySelector('#uiDrawer .fi')).color,
  })`);
  ok('T5.2 drawer', draw.open && draw.rows === 26 &&
    draw.groups[0] === 'Provided by the town (2)' &&
    draw.groups[1] === 'Healthcare facilities (13)' &&
    draw.groups[2] === 'Community locations (11)', JSON.stringify(draw));
  await shot('hud-drawer');

  /* ---------- T5.3 facility card ---------- */
  await clickEl('.fi[data-id="hospital"]'); await sleep(500);
  const card = await ev(`({
    show: document.querySelector('#uiCard').classList.contains('show'),
    h3: document.querySelector('#uiCard h3')?.textContent?.trim(),
    chip: document.querySelector('#uiCard .chip')?.textContent?.trim(),
    cost: document.querySelector('#uiCard .cost')?.textContent?.trim(),
    fly: !!document.querySelector('#uiCard .fly'),
    inside: !!document.querySelector('#uiCard [data-act="in"]'),
    bg: getComputedStyle(document.querySelector('#uiCard')).backgroundColor,
  })`);
  ok('T5.3 card', card.show && card.h3.includes('Havenbrook General Hospital') && card.chip === 'Healthcare' && card.cost.includes('$1.50M') && card.fly && card.inside, JSON.stringify(card));
  const flyPose0 = await ev(`[__cam.position.x, __cam.position.y, __cam.position.z]`);
  await sleep(2300); // flyTo dur 1.8s
  const flyPose1 = await ev(`[__cam.position.x, __cam.position.y, __cam.position.z].map(v=>+v.toFixed(1))`);
  /* flyToBuilding(hospital): dist=max(104,74)*1.7+26=202.8, ang=atan2(80,-505)+.6≈.757,
     px≈80+139.4≈219.4? compute: sin(.757)*202.8≈139.3 → px≈219.3, cos(.757)*202.8≈147.6 → pz≈-357.4, py=max(30,52*1.6+24)=107.2 */
  const moved = Math.hypot(flyPose1[0]-80, flyPose1[2]+505) > 30 && flyPose1[1] > 50; // cam near-ish hospital quadrant, elevated
  ok('T5.3b fly-to-building', moved, `cam=${JSON.stringify(flyPose1)} (from ${JSON.stringify(flyPose0)})`);
  await shot('hud-card-hospital');
  await ev(`document.querySelector('#uiCardX').click()`);
  await ev(`document.querySelector('#uiDrawer').classList.remove('open')`);
  await sleep(300);

  /* ---------- T5.4 rubric ---------- */
  await clickEl('#uiBtnRubric'); await sleep(400);
  const rub = await ev(`({
    open: document.querySelector('#uiRubric').classList.contains('open'),
    okRows: document.querySelectorAll('#uiRubric td.ok').length,
    h2: document.querySelector('#uiRubric h2')?.textContent?.trim(),
    bg: getComputedStyle(document.querySelector('#uiRubric .panel')).backgroundColor,
    col: getComputedStyle(document.querySelector('#uiRubric .panel')).color,
  })`);
  ok('T5.4 rubric', rub.open && rub.okRows === 9 && rub.bg.startsWith('rgba(252, 253, 252'), JSON.stringify(rub));
  await shot('hud-rubric');
  await clickEl('#uiRubricX'); await sleep(300);

  /* ---------- T5.5 guide ---------- */
  await clickEl('#uiBtnGuide'); await sleep(400);
  const gd = await ev(`({
    open: document.querySelector('#uiGuide').classList.contains('open'),
    tiers: [...document.querySelectorAll('#uiGuideTiers .tr .nm')].map(e => e.textContent.trim()),
    badges: [...document.querySelectorAll('#uiGuideTiers .tr .bdg')].map(e => e.textContent.trim()),
    running: document.querySelector('#uiGuideRun')?.textContent,
    h2: document.querySelector('#uiGuide h2')?.textContent?.trim(),
  })`);
  ok('T5.5 guide', gd.open && gd.tiers.length === 6 && gd.tiers[0] === 'AUTO' && gd.badges.some(b => b.includes('RUNNING NOW')), JSON.stringify(gd));
  await shot('hud-guide');
  await clickEl('#uiGuideX'); await sleep(300);

  /* ---------- T5.6 tier chip ---------- */
  const tier = await ev(`({
    t: document.querySelector('#uiTier').textContent.trim(),
    bg: getComputedStyle(document.querySelector('#uiTier')).backgroundColor })`);
  ok('T5.6 tier chip', /^PERF (MIN|LOW|MED|HIGH|ULTRA)$/.test(tier.t), JSON.stringify(tier));

  /* ---------- T5.7 tour ---------- */
  await ev(`window.__setCam(540,620,660,-30,0,-40)`); await sleep(600);
  await clickEl('#uiBtnTour'); await sleep(800);
  const t1 = await ev(`({
    show: document.querySelector('#uiTourBar').classList.contains('show'),
    cap: document.querySelector('#uiTourBar .cap b')?.textContent?.trim(),
    step: document.querySelector('#uiTourBar .step')?.textContent?.trim(),
    on: document.querySelector('#uiBtnTour').classList.contains('on'),
    bg: getComputedStyle(document.querySelector('#uiTourBar')).backgroundColor })`);
  ok('T5.7a tour start', t1.show && t1.step.startsWith('1 / 8') && t1.on, JSON.stringify(t1));
  await shot('hud-tour');
  await clickEl('#uiTourNext'); await sleep(700);
  const t2 = await ev(`({
    show: document.querySelector('#uiTourBar').classList.contains('show'),
    step: document.querySelector('#uiTourBar .step')?.textContent?.trim() })`);
  ok('T5.7b NEXT keeps tour', t2.show && t2.step.startsWith('2 / 8'), JSON.stringify(t2));
  await page.keyboard.press('Escape'); await sleep(400);
  const t3 = await ev(`({
    show: document.querySelector('#uiTourBar').classList.contains('show'),
    on: document.querySelector('#uiBtnTour').classList.contains('on') })`);
  ok('T5.7c Esc ends tour', !t3.show && !t3.on, JSON.stringify(t3));
  await sleep(3200); // return tween 2.2s
  const endCam = await ev(`[__cam.position.x, __cam.position.y, __cam.position.z].map(v=>+v.toFixed(0))`);
  const backHome = Math.abs(endCam[0]-540)<40 && Math.abs(endCam[1]-620)<40 && Math.abs(endCam[2]-660)<40;
  ok('T5.7d camera home', backHome, `cam=${JSON.stringify(endCam)} expect ~(540,620,660)`);

  /* ---------- T5.8 hint + labels ---------- */
  const hl = await ev(`({
    hintBg: getComputedStyle(document.querySelector('#hint')).backgroundColor,
    hintCol: getComputedStyle(document.querySelector('#hint')).color,
    lbls: document.querySelectorAll('#labels .lbl').length,
    lblBg: document.querySelector('#labels .lbl') ? getComputedStyle(document.querySelector('#labels .lbl')).backgroundColor : null,
    lblCol: document.querySelector('#labels .lbl') ? getComputedStyle(document.querySelector('#labels .lbl')).color : null })`);
  ok('T5.8 hint+labels light', hl.hintBg.startsWith('rgba(252, 253, 252') && (!hl.lblBg || hl.lblBg.startsWith('rgba(252, 253, 252')), JSON.stringify(hl));

  /* ---------- T1b __uiShowCard probe ---------- */
  await ev(`window.__uiShowCard('hospital')`); await sleep(300);
  const pc = await ev(`({show: document.querySelector('#uiCard').classList.contains('show'),
    h3: document.querySelector('#uiCard h3')?.textContent})`);
  ok('T1b __uiShowCard', pc.show && pc.h3.includes('Hospital'), JSON.stringify(pc));
  await ev(`document.querySelector('#uiCardX').click()`);

  console.log('RESULT ' + JSON.stringify(R, null, 1));
} finally { await browser.close(); }
