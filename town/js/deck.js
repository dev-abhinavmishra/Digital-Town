// deck.js — PRESENT mode: a cinematic slideshow played inside the live scene.
// Each slide is a slow camera flight with an editorial caption block; the town
// itself is the imagery. Keyboard: ←/→ step, space pause, Esc exit.
// DOM-only except window.__flyTo / __endTour / __enterInterior.
import { BUILDINGS, TOWN, CATEGORY_COLORS } from './layout.js';

const BUDGET = 10_000_000;
const money = n => '$' + (n / 1e6).toFixed(2) + 'M';

/* editorial, not corporate-template: one ink scrim + hairline rules,
   palatino-class display serif + system sans, letterboxed frame, and every
   caption element reveals with a staggered rise. No cards on cards. */
const css = `
#uiDeck { position:fixed; inset:0; z-index:70; display:none; pointer-events:none;
  font-family:"Segoe UI", system-ui, -apple-system, sans-serif;
  --ink:#eef4f6; --sub:#a7bcc6; --dim:#7e97a2; --rule:rgba(238,244,246,.28); }
#uiDeck.on { display:block; }
#uiDeck .bar { position:absolute; left:0; right:0; height:0; background:#050b0f;
  transition:height .9s cubic-bezier(.7,0,.3,1); }
#uiDeck .bar.t { top:0 } #uiDeck .bar.b { bottom:0 }
#uiDeck.on .bar { height:56px; }
#uiDeck .scrim { position:absolute; inset:0;
  background:linear-gradient(12deg, rgba(5,16,22,.82) 0%, rgba(5,16,22,.38) 34%,
    rgba(5,16,22,0) 62%),
  radial-gradient(120% 90% at 50% 0%, rgba(5,16,22,0) 60%, rgba(5,16,22,.24) 100%); }
#uiDeck .cap { position:absolute; left:64px; bottom:88px; max-width:620px; color:var(--ink); }
#uiDeck .cap > * { opacity:0; transform:translateY(14px); }
#uiDeck .cap.in > * { opacity:1; transform:none; transition:opacity .7s ease, transform .7s cubic-bezier(.2,.7,.3,1); }
#uiDeck .cap.out > * { opacity:0; transform:translateY(-10px); transition:all .32s ease; }
#uiDeck .cap > *:nth-child(1) { transition-delay:.15s } #uiDeck .cap > *:nth-child(2) { transition-delay:.28s }
#uiDeck .cap > *:nth-child(3) { transition-delay:.42s } #uiDeck .cap > *:nth-child(4) { transition-delay:.55s }
#uiDeck .kick { font-size:11px; letter-spacing:3.2px; font-weight:600; color:var(--sub);
  text-transform:uppercase; margin-bottom:14px; display:flex; align-items:center; gap:12px; }
#uiDeck .kick::after { content:''; height:1px; width:44px; background:var(--rule); }
#uiDeck h1 { margin:0 0 14px; font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  font-size:46px; line-height:1.06; font-weight:500; letter-spacing:.2px; text-wrap:balance; }
#uiDeck h1.big { font-size:74px; letter-spacing:.5px; }
#uiDeck h1 em { font-style:italic; font-weight:400; }
#uiDeck .body { font-size:14.5px; line-height:1.65; color:var(--sub); max-width:470px; }
#uiDeck .stats { display:flex; gap:26px; margin-top:20px; }
#uiDeck .cap .team { margin-top:16px; font-size:10.5px; letter-spacing:2.4px;
  color:var(--dim); text-transform:uppercase; }
#uiDeck .st b { display:block; font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  font-size:26px; font-weight:500; color:var(--ink); }
#uiDeck .st span { font-size:10px; letter-spacing:1.8px; text-transform:uppercase; color:var(--dim); }
#uiDeck .bud { margin-top:18px; width:min(430px,60vw); }
#uiDeck .bud .track { height:4px; display:flex; border-radius:2px; overflow:hidden;
  background:rgba(238,244,246,.14); }
#uiDeck .bud .track i { height:100%; }
#uiDeck .bud .rows { margin-top:12px; font-size:12.5px; color:var(--sub); line-height:2; }
#uiDeck .bud .rows b { color:var(--ink); font-weight:600; }
#uiDeck .dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:8px; vertical-align:1px; }
#uiDeck .meta { position:absolute; right:64px; bottom:88px; text-align:right; color:var(--dim); }
#uiDeck .meta > * { opacity:0; transition:opacity .6s .5s; }
#uiDeck.on .meta > * { opacity:1; }
#uiDeck .cnt { font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  font-size:20px; color:var(--ink); letter-spacing:1px; }
#uiDeck .cnt i { font-style:normal; color:var(--dim); font-size:14px; margin:0 4px; }
#uiDeck .keys { font-size:10px; letter-spacing:1.6px; margin-top:8px; text-transform:uppercase; }
#uiDeck .prog { position:absolute; left:64px; right:64px; bottom:64px; height:1px;
  background:rgba(238,244,246,.16); opacity:0; transition:opacity .6s .5s; }
#uiDeck.on .prog { opacity:1; }
#uiDeck .prog i { display:block; height:100%; width:0; background:rgba(238,244,246,.75);
  transition:width .5s ease; }
#uiDeck .brand { position:absolute; left:64px; top:14px; font-size:10px; letter-spacing:2.6px;
  color:var(--dim); text-transform:uppercase; opacity:0; transition:opacity .6s .5s; }
#uiDeck.on .brand { opacity:1; }
#uiDeck .x { position:absolute; right:64px; top:14px; font-size:10px; letter-spacing:2px;
  color:var(--dim); text-transform:uppercase; opacity:0; transition:opacity .6s .5s; }
#uiDeck.on .x { opacity:1; }
#uiDeck .edge { position:absolute; top:0; bottom:0; width:22%; pointer-events:auto; }
#uiDeck .edge.l { left:0 } #uiDeck .edge.r { right:0 }
/* video background: a pre-rendered orbit of the town replaces live camera
   flights so PRESENT mode costs a video decode instead of the whole scene */
#uiDeck .bgvid { position:absolute; inset:0; width:100%; height:100%;
  object-fit:cover; background:#050b0f; }
/* film-cut transition: the video dips through black on every slide change */
#uiDeck .dip { position:absolute; inset:0; background:#050b0f; opacity:0;
  pointer-events:none; }
`;

export function installDeck() {
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'uiDeck';
  root.innerHTML = `<div class="bar t"></div><div class="bar b"></div>
    <video class="bgvid" src="deck/town-orbit.mp4" muted loop playsinline preload="auto"></video><div class="scrim"></div><div class="dip"></div>
    <div class="brand">${TOWN.name} — a community planned around care</div>
    <div class="x">ESC to exit</div>
    <div class="cap"></div>
    <div class="meta"><div class="cnt"></div><div class="keys">&#8592; &#8594; navigate &middot; space pause</div></div>
    <div class="prog"><i></i></div>
    <div class="edge l"></div><div class="edge r"></div>`;
  document.body.appendChild(root);

  const cap = root.querySelector('.cap'), cnt = root.querySelector('.cnt'),
        prog = root.querySelector('.prog i'), dip = root.querySelector('.dip');

  const numd = BUILDINGS.filter(b => b.num);
  const spent = numd.reduce((s, b) => s + (b.cost || 0), 0);
  const byCat = {};
  numd.forEach(b => byCat[b.cat] = (byCat[b.cat] || 0) + (b.cost || 0));
  const nH = numd.filter(b => b.cat === 'health').length;
  const nC = numd.filter(b => b.cat === 'community').length;

  const stat = (v, l) => `<div class="st"><b>${v}</b><span>${l}</span></div>`;
  const find = id => BUILDINGS.find(b => b.id === id);

  /* cam: [px,py,pz → tx,ty,tz], dur = seconds of flight (the glide IS the shot).
     Coords are authored in layout space — scale to world space via __ws. */
  const W = () => window.__ws || 1;
  const SLIDES = [
    { cam: [620, 520, 690, -60, 0, -70], dur: 12, cover: true,
      kick: 'HST project · a digital town', title: '<em>HAVENBROOK</em>',
      body: 'A community planned around care — a full town designed, budgeted and built to a $10,000,000 brief.',
      team: 'Abhinav Mishra · Dinesh Yara · Davi Ogland' },
    { cam: [60, 780, 560, -20, 0, -60], dur: 11,
      kick: 'The brief', title: 'One town, ten rules',
      body: 'A medical university anchors the plan, housing surrounds it, and at least seven healthcare and three community facilities had to fit inside $10M.',
      stats: [money(spent), 'spent of $10M', `${nH}`, 'healthcare sites', `${nC}`, 'community sites'] },
    { cam: [-270, 150, 430, -500, 8, 190], dur: 10,
      kick: 'Population & demographics', title: 'Built for its mix',
      body: 'Population model — 50% college students, 30% families, 20% adults 65+. The plan mirrors it: student flats beside the campus, family homes near the K-12, senior cottages in the quiet east.',
      stats: ['50%', 'college students', '30%', 'families', '20%', 'adults 65+'] },
    { cam: [230, 110, -40, 40, 16, -250], dur: 10,
      kick: 'The anchor — provided free', title: 'University School of Medicine',
      body: 'The town is planned around a real campus at its heart: a medical school, library, anatomy and clinical halls around a central quadrangle.' },
    { cam: [300, 110, -620, 20, 26, -440], dur: 10,
      kick: '#3–15 · Wellness Way', title: 'Care within reach',
      body: 'Every tier of the population needs care: students get low-cost urgent visits at Thacher Student Health, families get pediatrics at Brookfield Family Physicians, seniors get home visits from Innisfree — 13 facilities on the Wellness Way spine, minutes from every district.' },
    { cam: [-270, 150, 430, -500, 8, 190], dur: 10,
      kick: '#2 · Residential West — provided free', title: 'The Preserve',
      body: 'The donated housing development: cottage rows, duplexes and townhouses around Preserve Commons — homes wrapped around the campus they serve.' },
    { cam: [330, 130, 330, 575, 6, 130], dur: 10,
      kick: '#22 · Willow Creek Park', title: 'The third places',
      body: 'Pond, trails, playgrounds and the bandshell — the social heart — with downtown Main Street and the Commons mall walking-distance south.' },
    { cam: [640, 100, -330, 520, 12, -550], dur: 10,
      kick: '#14–15 · the quiet east', title: 'Ageing in place',
      body: 'Halcyon House senior living and Stillpoint hospice sit in the leafy east — a full care loop from independent living to end-of-life.' },
    { cam: [60, 780, 560, -20, 0, -60], dur: 11,
      kick: 'Layout & placement', title: 'Why things sit where they sit',
      body: 'Streets first, then zoning: the medical campus anchors the town centre, hospital + EMS share the Wellness Way spine a block apart, seniors rest in the quiet east, shopping runs along Commerce Blvd, and the K-12 sits inside family neighbourhoods. Every address is within two blocks of a through-street for emergency access.' },
    { cam: [300, 110, -620, 20, 26, -440], dur: 10,
      kick: 'Decision-making', title: 'The trade-offs',
      body: 'Two donated anchors (university + housing) freed ~$4.5M, which bought coverage over scale — 13 neighbourhood facilities instead of one mega-campus. We chose the mall over a second park, senior care in the quiet east over downtown frontage, and kept $50k unspent rather than force a 27th building.' },
    { cam: [60, 780, 560, -20, 0, -60], dur: 9, dark: true,
      kick: 'The ledger', title: `${money(spent)} of ${money(BUDGET)}`,
      body: '', budget: true },
    { cam: [620, 540, 720, -60, 0, -60], dur: 12, cover: true,
      kick: 'HAVENBROOK', title: 'Under budget.<br><em>Over-delivered.</em>',
      body: 'Every requirement of the brief, met — with headroom left for the parks and streets that make it feel like a town.' },
    { cam: [620, 520, 690, -60, 0, -70], dur: 10, dark: true,
      kick: 'References', title: 'Sources & tools',
      body: 'Our Town Healthcare System — project brief & budget sheet (class handout) · U.S. Census QuickFacts — college-town demographic mix · American Planning Association — complete-communities siting guidance · Town rendered in Three.js — presented as a navigable digital world.' },
  ];

  const HOLD_MS = 9500;
  let on = false, i = -1, timer = 0, capTimer = 0, paused = false, vidOK = false;

  function caption(s, idx) {
    const bits = [];
    if (s.stats) {
      bits.push(`<div class="stats">${stat(s.stats[0], s.stats[1])}${stat(s.stats[2], s.stats[3])}${stat(s.stats[4], s.stats[5])}</div>`);
    } else if (s.budget) {
      const segs = [['health', 'Healthcare', byCat.health || 0], ['community', 'Community', byCat.community || 0]];
      bits.push(`<div class="bud"><div class="track">` +
        segs.map(([c, , v]) => `<i style="width:${v / BUDGET * 100}%;background:${CATEGORY_COLORS[c]}"></i>`).join('') +
        `<i style="width:${(BUDGET - spent) / BUDGET * 100}%;background:rgba(238,244,246,.22)"></i></div>` +
        `<div class="rows">` +
        segs.map(([c, l, v]) => `<span class="dot" style="background:${CATEGORY_COLORS[c]}"></span><b>${l}</b> ${money(v)} &nbsp;·&nbsp; `).join('') +
        `<span class="dot" style="background:rgba(238,244,246,.4)"></span><b>Free sites</b> campus + housing &nbsp;·&nbsp; ` +
        `<b>Headroom</b> ${money(BUDGET - spent)}</div></div>`);
    } else {
      bits.push(`<div class="body">${s.body}</div>`);
    }
    return `<div class="kick">${s.kick}</div><h1${s.cover ? ' class="big"' : ''}>${s.title}</h1>` + bits.join('') +
      (s.team ? `<div class="team">${s.team}</div>` : '');
  }

  function show(idx) {
    i = idx;
    const s = SLIDES[i];
    // film-cut: background dips through black between slides (skipped on open)
    if (idx > 0 && dip.animate) dip.animate(
      [{ opacity: 0 }, { opacity: .62, offset: .42 }, { opacity: 0 }],
      { duration: 900, easing: 'ease-in-out' });
    if (!vidOK) {   // fallback: live camera flight when the video can't play
      const w = W();
      window.__flyTo(...s.cam.map(v => v * w), Math.max(1.8, s.dur * .72));
    }
    cap.classList.remove('in'); cap.classList.add('out');
    clearTimeout(capTimer);
    capTimer = setTimeout(() => {
      cap.innerHTML = caption(s, i);
      cap.classList.remove('out'); cap.classList.add('in');
    }, 360);
    cnt.innerHTML = `${String(i + 1).padStart(2, '0')}<i>/</i>${String(SLIDES.length).padStart(2, '0')}`;
    prog.style.width = `${(i + 1) / SLIDES.length * 100}%`;
    clearTimeout(timer);
    if (!paused) timer = setTimeout(() => i >= SLIDES.length - 1 ? exit() : show(i + 1), HOLD_MS);
  }

  const HUD_CHROME = ['hudUI', 'hint', 'compass', 'labels', 'legend', 'titlecard', 'hud'];
  const hudStash = {};
  async function start() {
    if (on || window.__mapOn) return;   // ortho map view can't fly the slide shots
    on = true; paused = false;
    window.__endTour && window.__endTour();
    const wasIn = window.__interior?.on;
    if (wasIn) window.__exitInterior?.();   // interior HUD sits above the deck layer
    document.getElementById('uiCard')?.classList.remove('show');
    document.getElementById('uiDrawer')?.classList.remove('open');
    HUD_CHROME.forEach(id => { const el = document.getElementById(id);
      if (el) { hudStash[id] = el.style.display; el.style.display = 'none'; } });
    root.classList.add('on');
    // video background: the orbit loop plays over a paused 3D renderer —
    // PRESENT then costs a video decode, not the whole town per frame.
    // If the file can't play (missing/unsupported) the live flights stay.
    const vid = root.querySelector('.bgvid');
    vid.muted = true;
    // whenever play() actually resolves (now or later), flip to video mode —
    // a 2.5s bound keeps a stalled fetch from freezing the opening slide
    const played = vid.play().then(() => {
      vidOK = true;
      window.__setPaused && window.__setPaused(true);
    }).catch(() => {});
    await Promise.race([played, new Promise(r => setTimeout(r, 2500))]);
    // interior exit restores the saved outdoor pose at +190ms — let it land
    // before the opening flight, or the snap stomps the tween mid-flight
    wasIn ? setTimeout(() => on && show(0), 260) : show(0);
  }
  function exit() {
    if (!on) return;
    on = false; i = -1; paused = false;
    clearTimeout(timer); clearTimeout(capTimer);
    cap.classList.remove('in', 'out'); cap.innerHTML = '';
    root.classList.remove('on');
    HUD_CHROME.forEach(id => { const el = document.getElementById(id);
      if (el) el.style.display = hudStash[id] ?? ''; });
    document.getElementById('uiBtnDeck')?.classList.remove('on');
    root.querySelector('.bgvid')?.pause();
    vidOK = false;
    window.__setPaused && window.__setPaused(false);   // live scene resumes
    const w = W();
    window.__flyTo(540 * w, 620 * w, 660 * w, -30 * w, 0, -40 * w, 2.2);   // home aerial
  }

  const step = d => { if (on) { const n = i + d;
    n < 0 ? show(0) : n >= SLIDES.length ? exit() : show(n); } };
  root.querySelector('.edge.l').addEventListener('click', () => step(-1));
  root.querySelector('.edge.r').addEventListener('click', () => step(1));
  addEventListener('keydown', e => {
    if (!on) return;
    if (e.key === 'Escape') exit();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
    else if (e.key === ' ') { e.preventDefault();
      paused = !paused; clearTimeout(timer);
      if (!paused) timer = setTimeout(() => i >= SLIDES.length - 1 ? exit() : show(i + 1), HOLD_MS); }
  });

  window.__deck = { start, exit, next: () => step(1), prev: () => step(-1),
    get on() { return on; }, get i() { return i; }, get n() { return SLIDES.length; } };
  return { start, exit, get on() { return on; } };
}
