/* perf.js — adaptive quality tiers. Full fidelity on capable GPUs
   (tier HIGH is today's pipeline, untouched); weaker devices start one
   notch down, and a device that keeps losing its WebGL context is pinned
   to LOW on the next boot instead of crash-looping forever.

   ?q=high|med|low forces a tier (eval + manual override). */

const CRASH_KEY = 'dt_ctxlost';
const WINDOW_MS = 15 * 60 * 1000;   // strikes older than this age out and retry
const MAX_STRIKES = 8;

/* strikes = timestamps of context losses. Keeping history (not a bare count)
   means losses late in a session still accumulate — a device that crashes at
   second 55 of every boot reaches the LOW threshold instead of seeing one
   fresh strike per boot. There is no "stable boot" reset: a long clean run
   simply lets old strikes age out of the window. */
function strikes() {
  try {
    const v = JSON.parse(localStorage.getItem(CRASH_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

export function crashes() {
  const now = Date.now();
  const s = strikes().filter(t => now - t < WINDOW_MS);
  if (s.length !== strikes().length)
    try { localStorage.setItem(CRASH_KEY, JSON.stringify(s)); } catch {}
  return s.length;
}
export function noteContextLost() {
  const s = strikes(); s.push(Date.now());
  try { localStorage.setItem(CRASH_KEY, JSON.stringify(s.slice(-MAX_STRIKES))); } catch {}
}

function gpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return '';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
                     : gl.getParameter(gl.RENDERER);
    const lc = gl.getExtension('WEBGL_lose_context');
    if (lc) lc.loseContext();
    return String(name || '');
  } catch { return ''; }
}

export function pickTier(params) {
  const q = (params.get('q') || params.get('quality') || '').toLowerCase();
  if (q === 'high' || q === 'med' || q === 'medium' || q === 'low')
    return q === 'medium' ? 'med' : q;

  const n = crashes();
  if (n >= 2) return 'low';
  if (n >= 1) return 'med';

  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  const weak = /swiftshader|llvmpipe|softpipe|software|basic render|mali-[g4]?[0-9]{1,2}\b|powervr|adreno [1-4][0-9]{2}|intel.*(hd|uhd|gma)/i
    .test(gpuName());
  if (mem <= 4 && weak) return 'low';
  if (mem <= 4 || cores <= 4 || weak) return 'med';
  return 'high';
}

/* per-tier budget. HIGH reproduces the previous pipeline verbatim. */
export const TIER_CFG = {
  high: { maxRatio: 2,   msaa: 4, ao: true,  bloom: true, smaa: true,  shadow: 4096 },
  med:  { maxRatio: 1.5, msaa: 2, ao: false, bloom: true, smaa: true,  shadow: 2048 },
  low:  { maxRatio: 1,   msaa: 0, ao: false, bloom: false, smaa: true,  shadow: 1024 },
};
