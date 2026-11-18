// 弱网/离线：Slow 3G 下首屏有无白屏/加载提示；加载中断网；游戏中途断网仍可玩；离线冷启动。输出 out/04-network.json
// 用法：QA_URL=http://127.0.0.1:5189 node 04-network.mjs [slow3g|fast3g|dropmid|offline-cold|offline-play ...]
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const URL_ = process.env.QA_URL || 'http://127.0.0.1:5189';
const OUT = new URL('./out/', import.meta.url).pathname; mkdirSync(OUT + 'net', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const which = process.argv.slice(2).length ? process.argv.slice(2) : ['slow3g', 'dropmid', 'offline-cold', 'offline-play'];
const PROFILES = { slow3g: { latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 }, fast3g: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 } };
const results = {};
async function newPage(viewport = { width: 844, height: 390 }) {
  const br = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--disable-accelerated-2d-canvas', '--enable-unsafe-swiftshader'] });
  const ctx = await br.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const ev = { errors: [], failed: [], logs: [] };
  page.on('console', (m) => { if (m.type() === 'error') ev.errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => ev.errors.push('PAGEERR ' + e.message.slice(0, 200)));
  page.on('requestfailed', (r) => ev.failed.push(r.url().split('/').slice(-2).join('/') + ' ' + r.failure()?.errorText));
  const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable');
  return { br, ctx, page, cdp, ev };
}
const snap = (page) => page.evaluate(() => { const g = window.__game; const cs = getComputedStyle(document.body); const cv = document.querySelector('canvas'); return { bg: cs.backgroundColor, text: document.body.innerText.trim().slice(0, 60), canvas: !!cv, scenes: g && g.scene ? g.scene.getScenes(true).map((s) => s.scene.key).join(',') : 'no-game', tex: g ? g.textures.getTextureKeys().length : 0, rs: document.readyState }; }).catch((e) => ({ err: String(e.message).slice(0, 60) }));
const gameReady = (page) => page.evaluate(() => { const g = window.__game; const s = g && g.scene && g.scene.getScene('game'); return !!(s && s.hud && s.sys && s.sys.isActive()); }).catch(() => false);

async function throttled(name) {
  const { br, page, cdp, ev } = await newPage();
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...PROFILES[name] });
  const t0 = Date.now(); const tl = [];
  await page.goto(URL_ + '/', { waitUntil: 'commit', timeout: 120000 });
  let ready = null;
  for (let i = 0; i < 400; i++) {
    await sleep(1000); const t = (Date.now() - t0) / 1000; const sn = await snap(page); tl.push({ t, ...sn });
    if ([1, 3, 6, 10, 20].includes(Math.round(t)) || (sn.scenes && sn.scenes.includes('boot') && !tl.some((x) => x.shotBoot))) { if (sn.scenes?.includes('boot')) tl[tl.length - 1].shotBoot = 1; await page.screenshot({ path: OUT + `net/${name}-t${Math.round(t)}.png` }).catch(() => {}); }
    if (await gameReady(page)) { ready = t; break; }
  }
  await page.screenshot({ path: OUT + `net/${name}-final.png` }).catch(() => {});
  const nav = await page.evaluate(() => ({ resources: performance.getEntriesByType('resource').map((r) => ({ n: r.name.split('/').pop(), dur: Math.round(r.duration), enc: r.encodedBodySize })), fcp: (performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint') || {}).startTime })).catch(() => null);
  const firstBoot = tl.find((x) => x.scenes && x.scenes.includes('boot'));
  const firstCanvas = tl.find((x) => x.canvas);
  const blankSecs = firstBoot ? firstBoot.t : null;
  results[name] = { loadavg: os.loadavg()[0].toFixed(1), readyAtS: ready, firstBootVisibleS: blankSecs, firstCanvasS: firstCanvas?.t ?? null, bodyTextBeforeJS: tl[0]?.text, bodyBgBeforeJS: tl[0]?.bg, fcpMs: nav?.fcp, js: nav?.resources?.find((r) => /index-.*\.js/.test(r.n)), errors: ev.errors, failed: ev.failed, timeline: tl.filter((_, i) => i < 30 || i % 10 === 0) };
  await br.close();
}
async function dropMid() { // JS 下载一半断网：看是否白屏/有提示/有 error
  const { br, page, cdp, ev } = await newPage();
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...PROFILES.slow3g });
  await page.goto(URL_ + '/', { waitUntil: 'commit', timeout: 60000 }); await sleep(4000);
  await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }); await sleep(8000);
  const sn = await snap(page); await page.screenshot({ path: OUT + 'net/dropmid.png' });
  results.dropmid = { snap: sn, errors: ev.errors, failed: ev.failed, hasNoscript: await page.evaluate(() => !!document.querySelector('noscript')), note: '4s 后断网；观察是否永久空白且无任何提示' };
  await br.close();
}
async function offlineCold() { // 完全离线打开
  const { br, page, cdp, ev } = await newPage(); await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  let err = null; try { await page.goto(URL_ + '/', { timeout: 15000 }); } catch (e) { err = String(e.message).split('\n')[0]; }
  const sw = await page.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then((r) => r.length) : 'n/a').catch(() => 'n/a');
  await page.screenshot({ path: OUT + 'net/offline-cold.png' }).catch(() => {});
  results['offline-cold'] = { gotoError: err, serviceWorkers: sw, note: '无 Service Worker：离线冷启动 = 浏览器错误页（预期；可选做 PWA 缓存）' }; await br.close();
}
async function offlinePlay() { // 先正常加载，然后断网，继续游玩+存档
  const { br, page, cdp, ev } = await newPage({ width: 1280, height: 720 });
  await page.goto(URL_ + '/?debug=1', { timeout: 600000 });
  await page.waitForFunction(() => { const g = window.__game; const s = g && g.scene && g.scene.getScene('game'); return !!(s && s.hud && s.sys && s.sys.isActive() && window.__qa); }, null, { timeout: 600000, polling: 200 });
  await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await page.mouse.click(640, 300); await sleep(1500);
  const st = await page.evaluate(() => window.__qa.state());
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); await sleep(600);
  const saved = await page.evaluate(() => !!localStorage.getItem('christmas-hat/save'));
  results['offline-play'] = { started: st.started, saved, errors: ev.errors, failed: ev.failed, note: '加载完成后断网：玩法/存档不依赖网络（0 请求）' }; await br.close();
}
for (const w of which) { console.log('== ' + w); try { if (PROFILES[w]) await throttled(w); else if (w === 'dropmid') await dropMid(); else if (w === 'offline-cold') await offlineCold(); else if (w === 'offline-play') await offlinePlay(); } catch (e) { results[w] = { error: String(e.stack || e).slice(0, 500) }; } console.log(JSON.stringify(results[w], (k, v) => (k === 'timeline' ? undefined : v)).slice(0, 700)); writeFileSync(OUT + '04-network.json', JSON.stringify(results, null, 1)); }
