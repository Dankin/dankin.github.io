import { loadPlaywright, CHROME } from '../lib/pw.mjs';
const URL = process.env.QA_URL || 'http://127.0.0.1:4174';
const { chromium } = await loadPlaywright();
const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.goto(URL + '/?debug=1');
const ready = () => p.waitForFunction(() => window.__qa && window.__qa.state().ready, null, { timeout: 60000 });
await ready(); await p.mouse.click(640, 360); await p.waitForTimeout(1500);
const lose = () => p.evaluate(() => { const c = document.querySelector('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); window.__ext = gl.getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
const ov = () => p.evaluate(() => [...document.querySelectorAll('body *')].filter((d) => /重新加载/.test(d.textContent || '') && d.children.length < 4 && d.getBoundingClientRect().height > 0).map((d) => d.textContent.trim().slice(0, 50)).pop() ?? null);
await lose(); await p.waitForTimeout(3500); // 第1次：自动 reload
await ready(); await p.waitForTimeout(1500);
await lose(); await p.waitForTimeout(4000);
const o1 = await ov(); await p.screenshot({ path: '/tmp/m3/shots/ctx-lost2.png' });
await p.evaluate(() => window.__ext.restoreContext()); await p.waitForTimeout(3000);
const o2 = await ov(); await p.screenshot({ path: '/tmp/m3/shots/ctx-restored2.png' });
console.log(JSON.stringify({ overlayAfterSecondLoss: o1, overlayAfterRestore: o2 }));
await b.close();
