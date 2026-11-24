// 性能实测:CDP CPU 降速 + rAF 帧耗时 + longtask + V8 采样 profiler(热点函数)。
// node scripts/qa/perf.mjs [land|port|desk] [cpu=4] [secs=10] [dpr=2]
// 想让热点函数名可读:QA_DIST=/tmp/qa-dist-dev(`npx vite build --minify false --outDir /tmp/qa-dist-dev`)。
import { writeFileSync } from 'node:fs';
import * as L from './lib.mjs';
const vname = process.argv[2] || 'land';
const CPU = +(process.argv[3] || 4);
const SECS = +(process.argv[4] || 10);
const DPR = +(process.argv[5] || 2);
const [W, H] = L.VIEWS[vname];
const R = L.makeReporter(`perf-${vname}-x${CPU}-dpr${DPR}`);
const { srv, base } = await L.serve();
const b = await L.launchBrowser({ base });
await b.view(W, H, { dpr: DPR, mobile: W < 600 || vname === 'land' });
const ERA_TIERS = [[0, 0], [1, 2], [2, 3], [3, 4], [4, 6], [4, 7]];
const result = {};
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))];

for (let e = 0; e < 6; e++) {
  await b.cpu(1);
  await b.open('?debug=1&speed=1', { wait: 1200 });
  await b.G(`(()=>{const [a,r]=${JSON.stringify(ERA_TIERS[e])};const s=g.state;s.source.tier=a;s.route.tier=r;for(let i=0;i<=a;i++)s.source.units[i]=4;for(let i=0;i<=r;i++)s.route.units[i]=4;s.coins=50;s.playSec=700;s.helpers=2;s.sys.pests.nextAt=s.playSec;s.sys.orders.nextAt=s.playSec;s.sys.rot.visual=5;s.sys.rot.acc=0})()`);
  await sleep(300);
  await b.G('(()=>g.panels().closeAll())()');
  await sleep(1500);
  await b.cpu(CPU);
  await sleep(1500); // 预热(降速后 JIT/纹理)
  await b.send('Profiler.enable'); await b.send('Profiler.setSamplingInterval', { interval: 400 });
  await b.send('Profiler.start');
  const m = await b.ev(`new Promise(res=>{const ft=[];const lt=[];let last=performance.now();const end=last+${SECS * 1000};
    try{new PerformanceObserver(l=>{for(const x of l.getEntries())lt.push([Math.round(x.startTime),Math.round(x.duration)])}).observe({entryTypes:['longtask']})}catch(e){}
    const r=document.getElementById('stage').getBoundingClientRect();
    const iv=setInterval(()=>{const x=r.left+r.width*(0.12+Math.random()*0.3),y=r.top+r.height*(0.3+Math.random()*0.4);document.getElementById('stage').dispatchEvent(new MouseEvent('click',{clientX:x,clientY:y,bubbles:true}))},180);
    const step=t=>{ft.push(t-last);last=t;if(t<end)requestAnimationFrame(step);else{clearInterval(iv);setTimeout(()=>res({ft,lt}),100)}};requestAnimationFrame(step)})`);
  const prof = (await b.send('Profiler.stop')).result.profile;
  await b.send('Profiler.disable');
  const ft = m.ft.slice(1); const lt = m.lt;
  const avg = ft.reduce((a, c) => a + c, 0) / ft.length;
  const row = { era: e, frames: ft.length, avgMs: +avg.toFixed(2), p50: +pct(ft, 50).toFixed(1), p95: +pct(ft, 95).toFixed(1), p99: +pct(ft, 99).toFixed(1), maxMs: +Math.max(...ft).toFixed(1), over33: ft.filter((x) => x > 33.4).length, over50: ft.filter((x) => x > 50).length, fps: +(1000 / avg).toFixed(1), longtasks: lt.length, longtaskMax: lt.length ? Math.max(...lt.map((x) => x[1])) : 0 };
  // 自耗时聚合
  const byId = new Map(prof.nodes.map((n) => [n.id, n]));
  const self = new Map(); const dts = prof.timeDeltas; let tot = 0;
  prof.samples.forEach((id, i) => { const n = byId.get(id); const cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`; const d = dts[i] / 1000; self.set(k, (self.get(k) || 0) + d); tot += d; });
  row.top = [...self.entries()].sort((a, c) => c[1] - a[1]).slice(0, 9).map(([k, v]) => `${k} ${(v / SECS / 10).toFixed(1)}%`);
  result[e] = row;
  R.check(`era${e} ×${CPU}: avg frame ≤ 16.7ms`, avg <= 16.7, `avg=${row.avgMs} p95=${row.p95} p99=${row.p99} max=${row.maxMs} fps=${row.fps} longtasks=${row.longtasks}(max ${row.longtaskMax}ms)`);
  R.info(`era${e} top self-time`, row.top.join(' | '));
  await b.shot(`perf_era${e}_${vname}`);
}
R.check('no console errors/exceptions', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 5)));
writeFileSync(`qa/perf-${vname}-x${CPU}-dpr${DPR}.json`, JSON.stringify(result, null, 1));
R.save(`qa/perf-${vname}-x${CPU}-dpr${DPR}-report.json`);
b.close(); srv.close(); process.exit(0);
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
