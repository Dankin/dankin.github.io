// 首屏加载时间线 + 内存 + 10 分钟（游戏内时间）快进泄漏检测。
// 用法：QA_URL=http://127.0.0.1:5189 [SOAK_MIN=10] node 03-perf-mem.mjs [desktop|iphone ...]
// 输出 out/03-perf-<设备>.json。注意：宿主机负载高时绝对耗时不可靠，report 里同时记录 loadavg。
import os from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Session, DEVICES, sleep } from '../lib/session.mjs';
import { STABLE_ARGS } from './lib.mjs';
DEVICES.iphone = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };
const OUT = new URL('./out/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const dev = process.argv[2] || 'desktop';
const SOAK_MIN = Number(process.env.SOAK_MIN || 10);
const s = await Session.launch({ device: dev, name: 'perf-' + dev, outDir: OUT + 'perf-' + dev, args: process.env.GPU_DEFAULT ? [] : STABLE_ARGS });
const cdp = await s.page.context().newCDPSession(s.page);
await cdp.send('Performance.enable');
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const gc = async () => { try { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage'); } catch { /* */ } };
// 时间线记录：boot 条出现/进度/切到 game 场景
await s.page.addInitScript(() => {
  const T = (window.__tl = { t0: performance.now(), samples: [], bootAt: null, gameAt: null, barSeen: [] });
  const tick = () => {
    const g = window.__game; const now = performance.now();
    if (g && g.scene) {
      const act = g.scene.getScenes(true).map((x) => x.scene.key);
      if (act.includes('boot') && T.bootAt == null) T.bootAt = now;
      if (act.includes('game') && T.gameAt == null) T.gameAt = now;
      const b = g.scene.getScene('boot');
      const bar = b && b.children && b.children.list.find((c) => c.type === 'Rectangle' && c.height === 8 && c.originX === 0);
      if (bar && T.gameAt == null && (!T.barSeen.length || T.barSeen[T.barSeen.length - 1][1] !== Math.round(bar.width))) T.barSeen.push([Math.round(now), Math.round(bar.width)]);
      const txt = b && b.children && b.children.list.find((c) => c.type === 'Text');
      if (txt && !T.bootText) T.bootText = txt.text;
    }
    if (T.gameAt == null || now - T.gameAt < 1000) setTimeout(tick, 16);
  };
  tick();
});
const load0 = os.loadavg();
const tNav = Date.now();
await s.goto({ fresh: true, timeout: 600000 });
const wall = Date.now() - tNav;
const nav = await s.page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const p = Object.fromEntries(performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)])); const rs = performance.getEntriesByType('resource').map((r) => ({ name: r.name.split('/').slice(-2).join('/'), transfer: r.transferSize, enc: r.encodedBodySize, dec: r.decodedBodySize, dur: Math.round(r.duration) })); return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), ttfb: Math.round(n.responseStart), paint: p, resources: rs, tl: window.__tl }; });
const tl = nav.tl;
const m1 = await metrics();
const res1 = await s.qa('resources');
const timeline = { wallMs: wall, bootStartMs: Math.round(tl.bootAt), gameStartMs: Math.round(tl.gameAt), textureGenAndSceneInitMs: Math.round(tl.gameAt - tl.bootAt), bootText: tl.bootText, barSamples: tl.barSeen.length, barMonotonic: tl.barSeen.every((x, i, a) => !i || x[1] >= a[i - 1][1]), barMax: Math.max(0, ...tl.barSeen.map((x) => x[1])), bar: tl.barSeen.slice(0, 40) };
console.log('timeline', JSON.stringify(timeline), 'FCP', nav.paint, 'load', nav.load, 'dcl', nav.dcl);
console.log('first-screen resources', JSON.stringify(res1), 'heapUsed MB', (m1.JSHeapUsedSize / 1048576).toFixed(1), 'nodes', m1.Nodes);
await s.start(); await sleep(500);
await gc(); const base = await metrics(); const baseRes = await s.qa('resources');
const samples = [{ gameMin: 0, heapMB: +(base.JSHeapUsedSize / 1048576).toFixed(1), ...pick(baseRes) }];
function pick(r) { return { textures: r.textures, textureMB: r.textureMB, displayObjects: r.displayObjects, tweens: r.tweens, particles: r.particles, timers: r.timers }; }
// 快进：每个游戏分钟 = 12×5s advance，期间穿插使用招式/附身物件，制造对象创建/销毁
const propIds = Object.entries(await s.qa('data').then((d) => d.props)).filter(([, d]) => d.moves?.length).map(([id, d]) => [id, d.moves[0]]);
const wallSoak0 = Date.now();
for (let min = 1; min <= SOAK_MIN; min++) {
  for (let i = 0; i < 12; i++) {
    await s.page.evaluate(([p, mv, ph]) => { const q = window.__qa; q.clearCooldowns(); try { q.useMove(p, mv); } catch { /* */ } q.advance(5); }, [...propIds[(min * 12 + i) % propIds.length], null]);
    if (i % 4 === 3) await sleep(30); // 让出主线程给 rAF/渲染
  }
  await gc(); const m = await metrics(); const r = await s.qa('resources');
  samples.push({ gameMin: min, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), domNodes: m.Nodes, listeners: m.JSEventListeners, ...pick(r), wallS: Math.round((Date.now() - wallSoak0) / 1000) });
  console.log(JSON.stringify(samples[samples.length - 1]));
}
// 线性回归（跳过前 2 分钟预热）
const pts = samples.filter((x) => x.gameMin >= 2); const n = pts.length;
const mx = pts.reduce((a, x) => a + x.gameMin, 0) / n, my = pts.reduce((a, x) => a + x.heapMB, 0) / n;
const slope = n > 1 ? pts.reduce((a, x) => a + (x.gameMin - mx) * (x.heapMB - my), 0) / pts.reduce((a, x) => a + (x.gameMin - mx) ** 2, 0) : 0;
const st = await s.state(); const frames = await s.frames(3);
const result = { device: dev, url: process.env.QA_URL, at: new Date().toISOString(), loadavg: { before: load0, after: os.loadavg() }, timeline, paint: nav.paint, dcl: nav.dcl, load: nav.load, resources: nav.resources, firstScreen: { ...res1, heapMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1), domNodes: m1.Nodes }, soak: { minutes: SOAK_MIN, samples, heapSlopeMBperMin: +slope.toFixed(2), gameNow: st.now }, framesAfter: frames, errors: s.errors, warnings: s.warnings.filter((w) => !/GL Driver|willReadFrequently/.test(w)) };
writeFileSync(OUT + `03-perf-${dev}.json`, JSON.stringify(result, null, 1));
console.log('slope MB/min', slope.toFixed(2), 'errors', s.errors.length, 'game now', st.now);
await s.close(); process.exit(s.errors.length ? 1 : 0);
