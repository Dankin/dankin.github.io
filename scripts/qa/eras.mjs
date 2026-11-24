// 加速走完各时代并巡检截图。node scripts/qa/eras.mjs <land|port|desk> [speed=60]
import * as L from './lib.mjs';
const vname = process.argv[2] || 'land';
const speed = Number(process.argv[3] || 60);
const [W, H] = L.VIEWS[vname];
const R = L.makeReporter('eras-' + vname);
const { srv, base } = await L.serve();
const b = await L.launchBrowser({ base });
await b.view(W, H);
// 卡死检测:rAF 心跳
await b.preload(`window.__hb=0;(function f(){window.__hb++;requestAnimationFrame(f)})();window.__gaps=[];(function(){let last=performance.now();setInterval(()=>{const n=performance.now();if(n-last>1500)window.__gaps.push(Math.round(n-last));last=n},250)})()`);
await b.open(`?debug=1&speed=${speed}`, { wait: 1200 });
const st = () => b.J('(()=>{const s=__game.state;return {era:Math.min(s.source.tier,[0,0,1,1,2,3,3,4,5][s.route.tier]),st:s.source.tier,rt:s.route.tier,coins:s.coins,deliv:s.delivered,play:Math.round(s.playSec),goal:__game.GOAL,modal:!!document.querySelector(".panel-veil")}})()');
const t0 = Date.now();
const eraAt = {}; const shot = {};
let last = '';
while (Date.now() - t0 < 300000) {
  const s = await st();
  if (!(s.era in eraAt)) { eraAt[s.era] = { real: Math.round((Date.now() - t0) / 1000), play: s.play }; R.info(`era ${s.era} reached`, JSON.stringify({ ...eraAt[s.era], st: s.st, rt: s.rt })); }
  if (s.era in eraAt && !(s.era in shot) && Date.now() - t0 > eraAt[s.era].real * 1000 + 3500) {
    shot[s.era] = 1;
    const hb0 = await b.ev('window.__hb'); await L.sleep(500); const hb1 = await b.ev('window.__hb');
    R.check(`era ${s.era} rAF alive`, hb1 - hb0 > 3, `${hb1 - hb0} frames/0.5s`);
    await b.shot(`era${s.era}_${vname}_a`);
    const modal = await b.ev('!!document.querySelector(".panel-veil")');
    if (modal) { await b.shot(`era${s.era}_${vname}_modal`); await b.G('g.panels().closeAll()'); }
  }
  if (s.era >= 5 && 5 in shot) break;
  // bot
  await b.dbg('+10亿果钱');
  await b.dbg('+10亿果钱');
  const dis = await b.J('["btnSrcBuy","btnSrcUp","btnRtBuy","btnRtUp"].map(i=>{const e=document.getElementById(i);return [i,!!e&&!e.hidden&&!e.disabled&&/\\bcan\\b/.test(e.className)]})');
  for (const [id, ok] of dis) { if (!ok) continue; await b.click('#' + id); await L.sleep(120); if (await b.ev('!document.getElementById("branchPick").hidden')) { await b.click('#branch' + (Math.random() < 0.5 ? 0 : 1)); await L.sleep(100); } }
  if (s.modal) await b.G('g.panels().closeAll()');
  await b.tapStage(0.14, 0.5, 1);
  await L.sleep(500);
}
const fin = await st();
R.info('final', JSON.stringify(fin));
R.info('main-thread stalls >1.5s (ms)', JSON.stringify(await b.J('window.__gaps')));
R.check('reached era 5', fin.era >= 5, JSON.stringify(fin));
R.check('no console errors/exceptions', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 8)));
R.info('warnings', JSON.stringify(b.logs.filter((l) => !b.errors().includes(l)).slice(0, 8)));
R.save(`qa/eras-${vname}.json`);
b.close(); srv.close(); process.exit(0);
