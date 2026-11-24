// 热点实测:害虫/订单/烂果/彩蛋热点,用真实鼠标点击。node scripts/qa/hotspots.mjs <land|port|desk>
import * as L from './lib.mjs';
const vname = process.argv[2] || 'land';
const [W, H] = L.VIEWS[vname];
const R = L.makeReporter('hotspots-' + vname);
const { srv, base } = await L.serve();
const b = await L.launchBrowser({ base });
await b.view(W, H);
await b.open('?debug=1', { wait: 1200 });
await b.G('(()=>g.panels().closeAll())()');
const ERA_TIERS = [[0, 0], [1, 2], [2, 4], [3, 5], [4, 7], [5, 8]];
const setEra = (e) => b.G(`(()=>{const [a,r]=${JSON.stringify(ERA_TIERS[e])};const s=g.state;s.source.tier=a;s.route.tier=r;for(let i=0;i<=a;i++)s.source.units[i]=Math.max(s.source.units[i]||0,3);for(let i=0;i<=r;i++)s.route.units[i]=Math.max(s.route.units[i]||0,3);s.coins=1e6;s.playSec=Math.max(s.playSec,400)})()`);
const scan = () => b.J(`(()=>{const r=document.getElementById('stage').getBoundingClientRect();const out={};for(let y=0;y<r.height;y+=5)for(let x=0;x<r.width;x+=5){const t=__game.orchard.tapTarget(x,y);if(t){(out[t]=out[t]||[]).push([x,y])}}return {r:{x:r.left,y:r.top,w:r.width,h:r.height},out}})()`);
const centroid = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
const clickAt = async (sc, key) => { const pts = sc.out[key]; const [cx, cy] = centroid(pts); await b.mouse(sc.r.x + cx, sc.r.y + cy, 1); };

// ── 害虫 ──
await setEra(1); await L.sleep(1500); await b.G('(()=>g.panels().closeAll())()');
await b.G('(()=>{const s=g.state;s.sys.pests.nextAt=s.playSec;s.sys.pests.list=[]})()');
await L.sleep(1500);
let sc = await scan();
const pestKey = Object.keys(sc.out).find((k) => k.startsWith('pest:'));
R.check('pest hotspot appears after wave', !!pestKey, Object.keys(sc.out).join(','));
if (pestKey) {
  await b.shot(`hot_pest_${vname}`);
  const before = await b.J('({k:__game.state.sys.pests.killed,n:__game.state.sys.pests.list.length,c:__game.state.coins})');
  // 反复点同一只虫(甲虫要点两下);被 HUD(信箱/订单气泡/dock)压住时等它爬出来再点,并记录遮挡
  let occluded = 0, clicks = 0; const occl = {};
  for (let i = 0; i < 40 && clicks < 4; i++) {
    sc = await scan(); const k = Object.keys(sc.out).find((x) => x.startsWith('pest:')); if (!k) break;
    const [cx, cy] = centroid(sc.out[k]);
    const top = await b.ev(`(()=>{const e=document.elementFromPoint(${sc.r.x + cx},${sc.r.y + cy});return e?e.id||e.className:''})()`);
    if (top !== 'stage') { occluded++; occl[top] = (occl[top] || 0) + 1; await L.sleep(250); continue; }
    await clickAt(sc, k); clicks++; await L.sleep(60);
  }
  R.info('pest occluded-by-HUD polls', occluded + ' ' + JSON.stringify(occl));
  const after = await b.J('({k:__game.state.sys.pests.killed,n:__game.state.sys.pests.list.length,c:__game.state.coins})');
  R.check('click pest kills', after.k > before.k, JSON.stringify({ before, after }));
}
// ── 订单 ──
await b.G(`(()=>{const s=g.state;for(const k of ['red','green','granny','golden','fuji','yellow','gala'])s.sys.bag[k]=40;s.sys.bag.red=60;s.sys.orders.nextAt=s.playSec;s.sys.orders.list=[]})()`);
await L.sleep(1800);
const ord = await b.J('__game.state.sys.orders.list.map(o=>({id:o.id,want:o.want,qty:o.qty,rush:o.rush}))');
R.check('order spawns', ord.length > 0, JSON.stringify(ord));
if (ord.length) {
  await b.shot(`hot_order_${vname}`);
  const bub = await b.J('[...document.querySelectorAll(".panel-bub")].map(e=>({id:e.dataset.id,cls:e.className,r:(r=>({x:r.left,y:r.top,w:r.width,h:r.height}))(e.getBoundingClientRect())}))');
  R.info('order bubbles', JSON.stringify(bub));
  const done0 = await b.J('__game.state.sys.orders.done');
  // 先走舞台点击
  sc = await scan();
  const ok = Object.keys(sc.out).find((k) => k.startsWith('order:'));
  if (ok) { await clickAt(sc, ok); await L.sleep(300); R.check('stage tap on order claims (bag full)', (await b.J('__game.state.sys.orders.done')) > done0); }
  else R.info('no order hotspot on stage (bubble only)');
  // 再走气泡 DOM 点击
  const left = await b.J('__game.state.sys.orders.list.length');
  if (left && bub.length) { const d1 = await b.J('__game.state.sys.orders.done'); const bb = await b.J('(()=>{const e=document.querySelector(".panel-bub");if(!e)return null;const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()'); if (bb) { await b.mouse(bb[0], bb[1], 1); await L.sleep(300); R.check('bubble click claims order', (await b.J('__game.state.sys.orders.done')) > d1); } }
}
// ── 烂果 ──
await b.G('(()=>{g.state.coins=50;g.state.sys.rot.visual=4})()');
await L.sleep(500);
sc = await scan();
R.check('rot hotspot present', !!sc.out.rot, Object.keys(sc.out).join(','));
if (sc.out.rot) { await b.shot(`hot_rot_${vname}`); const c0 = await b.J('__game.state.sys.rot.cleaned'); await clickAt(sc, 'rot'); await L.sleep(300); R.check('click rot cleans', (await b.J('__game.state.sys.rot.cleaned')) >= c0 + 4 && (await b.J('__game.state.sys.rot.visual')) === 0, 'visual=' + (await b.J('__game.state.sys.rot.visual'))); }
// ── 彩蛋热点:每个时代扫描并点击 ──
const seenAll = {};
for (let e = 0; e <= 5; e++) {
  await setEra(e); await b.G('(()=>g.panels().closeAll())()'); await L.sleep(1200);
  sc = await scan();
  const keys = Object.keys(sc.out).filter((k) => !/^(pest|order|rot)/.test(k));
  R.info(`era ${e} hotspots`, keys.map((k) => `${k}(${sc.out[k].length})`).join(' '));
  for (const k of keys) {
    const sig0 = await b.J('(()=>{const c=__game.state.sys.codex;return {eggs:Object.keys(c.eggs).length,toast:document.getElementById("toast").textContent,ev:0}})()');
    const ev0 = await b.J('JSON.stringify(Object.keys(__game.state.sys.codex.eggs))');
    for (let i = 0; i < 6; i++) { sc = await scan(); if (!sc.out[k]) break; await clickAt(sc, k); await L.sleep(120); }
    const ev1 = await b.J('JSON.stringify(Object.keys(__game.state.sys.codex.eggs))');
    const toast = await b.J('document.getElementById("toast").textContent');
    seenAll[k] = seenAll[k] || { era: e, newEggs: JSON.parse(ev1).filter((x) => !JSON.parse(ev0).includes(x)), toast };
  }
  await b.G('(()=>g.panels().closeAll())()');
}
for (const [k, v] of Object.entries(seenAll)) R.info(`hotspot ${k} (first seen era ${v.era})`, `eggs+${JSON.stringify(v.newEggs)} toast="${(v.toast || '').slice(0, 40)}"`);
R.check('some eggs triggered by hotspot taps', Object.values(seenAll).some((v) => v.newEggs.length), '');
R.check('no console errors/exceptions', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 8)));
R.info('warnings', JSON.stringify(b.logs.filter((l) => !b.errors().includes(l)).slice(0, 8)));
R.save(`qa/hotspots-${vname}.json`);
b.close(); srv.close(); process.exit(0);
