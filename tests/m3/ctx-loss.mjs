// BUG-030 复测：强制丢失 WebGL 上下文 → 应出现 DOM 浮层（重新加载），恢复后收起
import { loadPlaywright, CHROME } from '../lib/pw.mjs';
const URL = process.env.QA_URL || 'http://127.0.0.1:4174';
const { chromium } = await loadPlaywright();
const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(URL + '/?debug=1');
await p.waitForFunction(() => window.__qa && window.__qa.state().ready, null, { timeout: 60000 });
await p.mouse.click(640, 360); await p.waitForTimeout(1500);
const overlayText = () => p.evaluate(() => { const t = [...document.body.querySelectorAll('div')].filter((d) => /重新加载|渲染中断/.test(d.innerText || '') && d.getBoundingClientRect().height > 0 && getComputedStyle(d).display !== 'none'); return t.length ? t[t.length - 1].innerText.slice(0, 60) : null; });
const before = await overlayText();
await p.evaluate(() => { const c = document.querySelector('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); window.__ext = gl.getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
let reloads = 0; p.on('load', () => reloads++);
const tl = [];
for (let i = 0; i < 8; i++) { await p.waitForTimeout(700); tl.push({ t: ((i + 1) * 0.7).toFixed(1), ov: await overlayText().catch(() => 'ERR'), reloads }); }
const lost = tl.map((x) => x.ov).find(Boolean) ?? null;
await p.screenshot({ path: '/tmp/m3/shots/ctx-lost.png' });
let rest = 'n/a';
const hasExt = await p.evaluate(() => !!window.__ext).catch(() => false);
if (hasExt) { await p.evaluate(() => window.__ext.restoreContext()); await p.waitForTimeout(3000); rest = await overlayText(); await p.screenshot({ path: '/tmp/m3/shots/ctx-restored.png' }); }
console.log(JSON.stringify({ before, lost, tl, hasExt, restoredOverlay: rest, errs: errs.slice(0, 3) }));
await b.close();
