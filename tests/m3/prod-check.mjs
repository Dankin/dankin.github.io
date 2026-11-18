// M3 生产构建验证（普通 dist，无 testApi）：QA_PROD_URL 默认 http://127.0.0.1:4173
// 只用真实鼠标/触屏 + localStorage 读存档，不依赖 window.__game/__qa。
import { loadPlaywright, CHROME } from '../lib/pw.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const URL = process.env.QA_PROD_URL || 'http://127.0.0.1:4173';
const OUT = process.env.QA_OUT || '/tmp/m3/shots';
mkdirSync(OUT, { recursive: true });
const { chromium } = await loadPlaywright();
const rows = []; const ok = (n, c, d) => { rows.push({ n, pass: !!c, d }); console.log(c ? '✓' : '✗', n, d ?? ''); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const hook = (p, tag) => { p.on('console', (m) => { if (m.type() === 'error') errs.push(`[${tag}] ${m.text()}`); }); p.on('pageerror', (e) => errs.push(`[${tag}] PE ${e.message}`)); };
const diff = async (p, a, b) => { const A = await p.screenshot({ path: `${OUT}/${a}.png` }); return A; };
const hashOf = (buf) => { let h = 0; for (let i = 0; i < buf.length; i += 97) h = (h * 31 + buf[i]) | 0; return h; };

// ① 桌面
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage(); hook(p, 'desk');
  // 慢 JS：延迟 3s 放行，检查首屏加载提示（BUG-032）
  await p.route('**/assets/*.js', async (r) => { await sleep(3000); try { await r.continue(); } catch {} });
  await p.goto(URL + '/?debug=1', { waitUntil: 'commit' });
  await sleep(1200);
  const bootVisible = await p.evaluate(() => { const e = document.getElementById('boot'); return e ? { text: e.innerText.slice(0, 40), vis: getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0 } : null; });
  await p.screenshot({ path: `${OUT}/prod-01-loading.png` });
  ok('BUG-032 JS 到达前首屏有加载提示 #boot', bootVisible?.vis, JSON.stringify(bootVisible));
  await p.unroute('**/assets/*.js');
  await p.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 30000 });
  await sleep(9000);
  const api = await p.evaluate(() => ({ g: typeof window.__game, q: typeof window.__qa, bootGone: !document.getElementById('boot') }));
  ok('BUG-033 ?debug=1 无效：无 window.__game / __qa', api.g === 'undefined' && api.q === 'undefined', JSON.stringify(api));
  ok('Boot 完成后 #boot 已移除', api.bootGone);
  await p.screenshot({ path: `${OUT}/prod-02-title.png` });
  const t0 = hashOf(await p.screenshot());
  await p.mouse.click(640, 360); await sleep(2500);
  const buf1 = await p.screenshot({ path: `${OUT}/prod-03-started.png` });
  ok('点击标题后画面变化（进入游戏）', hashOf(buf1) !== t0);
  // 附身 windchime → 招式
  await p.mouse.click(538, 205); await sleep(1200);
  await p.screenshot({ path: `${OUT}/prod-04-possess.png` });
  await p.mouse.click(638, 190); await sleep(2500);
  await p.screenshot({ path: `${OUT}/prod-05-move.png` });
  await sleep(14000);
  const save = await p.evaluate(() => { const r = localStorage.getItem('christmas-hat/save'); return r ? { bytes: r.length, v: JSON.parse(r).v } : null; });
  ok('自动存档已写入 localStorage', save && save.bytes > 100, JSON.stringify(save));
  const before = await p.evaluate(() => localStorage.getItem('christmas-hat/save'));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 30000 });
  await sleep(9000);
  await p.screenshot({ path: `${OUT}/prod-06-reload-title.png` });
  await p.mouse.click(640, 360); await sleep(3000);
  await p.screenshot({ path: `${OUT}/prod-07-reload-started.png` });
  const after = await p.evaluate(() => localStorage.getItem('christmas-hat/save'));
  ok('刷新后存档仍在（未被清空）', !!after && after.length > 100);
  await ctx.close();
}
// ② 竖屏遮罩 + 触屏
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage(); hook(p, 'portrait');
  await p.goto(URL + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 30000 });
  await sleep(9000);
  await p.screenshot({ path: `${OUT}/prod-08-portrait.png` });
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage(); hook(p, 'phone');
  await p.goto(URL + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 30000 });
  await sleep(9000);
  await p.screenshot({ path: `${OUT}/prod-09-phone-title.png` });
  await p.touchscreen.tap(422, 195); await sleep(2500);
  await p.screenshot({ path: `${OUT}/prod-10-phone-started.png` });
  const sz = await p.evaluate(() => ({ w: innerWidth, h: innerHeight, sx: scrollX, sy: scrollY, sw: document.documentElement.scrollWidth }));
  ok('手机横屏无滚动/溢出', sz.sx === 0 && sz.sy === 0 && sz.sw <= sz.w + 1, JSON.stringify(sz));
  await ctx.close();
}
ok('全程无 console error / pageerror', errs.length === 0, errs.slice(0, 5).join(' | '));
await browser.close();
writeFileSync('/tmp/m3/prod-check.json', JSON.stringify(rows, null, 1));
console.log(`${rows.filter((r) => r.pass).length}/${rows.length}`);
