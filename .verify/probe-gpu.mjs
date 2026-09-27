import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/devin/chrome/chrome-win64/chrome.exe', headless: false,
  args: ['--use-angle=default', '--disable-gpu-sandbox'] });
const page = await browser.newPage();
await page.goto('about:blank');
const info = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
           vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'unknown' };
});
console.log(JSON.stringify(info));
await browser.close();
