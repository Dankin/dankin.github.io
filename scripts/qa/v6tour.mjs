// v6 全阶段巡检:产出线 5 档 × 2 分支、运输线 8 档 × 2 分支,每次升档截阶段卡 + 稳定场景图。
// node scripts/qa/v6tour.mjs <land|port|desk> <branch 0|1>
// 输出 qa/shots/v6/v6_{src|rt}{tier}b{branch}_{card|scene}_{v}.png、qa/v6tour-<v>-b<branch>.json
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from './lib.mjs';
const vname = process.argv[2] || 'land';
const BR = Number(process.argv[3] || 0);
const [W, H] = L.VIEWS[vname];
const R = L.makeReporter(`v6tour-${vname}-b${BR}`);
mkdirSync('qa/shots/v6', { recursive: true });
const { srv, base } = await L.serve();
const b = await L.launchBrowser({ base });
await b.view(W, H, { dpr: 2, mobile: vname !== 'desk' });
await b.preload(`window.__gaps=[];(function(){let last=performance.now();setInterval(()=>{const n=performance.now();if(n-last>1500)window.__gaps.push(Math.round(n-last));last=n},250)})()`);
await b.open('?debug=1', { wait: 1500 });
const sleep = L.sleep;
const shot = (n) => b.shot(`v6/v6_${n}_${vname}`);
const S = () => b.J('(()=>{const s=__game.state;return {st:s.source.tier,rt:s.route.tier,hl:s.helperLevel,coins:s.coins,stock:s.stock,veh:s.vehicles.length,vph:s.vehicles.map(v=>+v.phase.toFixed(2)),vld:s.vehicles.map(v=>Math.round(v.load))}})()');
const rich = () => b.G('(()=>{g.state.coins=1e12;return 1})()');
const closeCard = async () => { await b.ev(`document.querySelector('#panel-stage .panel-stage-ok')?.click()`); await sleep(500); };
const canUp = (id) => b.J(`(()=>{const e=document.getElementById('${id}');return !!e&&!e.hidden&&/\\bcan\\b/.test(e.className)})()`);
const log = [];

async function tierUp(line) {
  const buy = line === 'src' ? 'btnSrcBuy' : 'btnRtBuy', up = line === 'src' ? 'btnSrcUp' : 'btnRtUp';
  for (let i = 0; i < 40; i++) {
    await rich(); await sleep(120);
    if (await canUp(up)) break;
    await b.click('#' + buy);
  }
  await rich(); await sleep(150);
  if (!(await canUp(up))) return false;
  await b.click('#' + up); await sleep(250);
  if (await b.ev('!document.getElementById("branchPick").hidden')) { await b.click('#branch' + BR); await sleep(300); }
  return true;
}
async function lineTour(line, max) {
  for (let t = 1; t <= max; t++) {
    const before = await S();
    if (!(await tierUp(line))) { R.check(`${line} tier ${t} reachable`, false, JSON.stringify(before)); break; }
    const key = `${line}${t}b${BR}`;
    // 老徐:跟着树档提高等级,看他在树屋/吊篮/树顶的位置
    if (line === 'src') await b.G(`(()=>{g.state.helperLevel=Math.min(8,${t}*2);return 1})()`);
    await sleep(1800);
    const card = await b.ev(`!!document.querySelector('#panel-stage .panel-stage-ok')`);
    if (card) await shot(`${key}_card`);
    await closeCard();
    await sleep(4200);
    await shot(`${key}_scene`);
    const s = await S();
    log.push({ key, state: s, card });
    R.info(key, JSON.stringify(s) + (card ? ' card' : ' no-card'));
  }
}
// 起手:第一棵树/篮子卡
await sleep(2500);
await b.G('(()=>{g.state.stock=0;return 1})()');
if (await b.ev(`!!document.querySelector('#panel-stage .panel-stage-ok')`)) { await shot(`src0_card`); await closeCard(); }
await shot(`src0b${BR}_scene`);
await b.G('(()=>{g.state.helperLevel=0;return 1})()');
await lineTour('src', 4);
await b.G('(()=>{g.state.helperLevel=2;return 1})()');
await lineTour('rt', 7);
// 车队:把最高档运输车买到 5 辆并截图(间距/上限/×N)
for (let i = 0; i < 6; i++) { await rich(); await b.click('#btnRtBuy'); await sleep(200); }
await sleep(3000);
const sv = await S();
R.info('convoy', JSON.stringify(sv));
await shot(`convoy_b${BR}`);
for (let i = 0; i < 30; i++) { await rich(); await b.click('#btnRtBuy'); await sleep(60); }
await sleep(3000);
await shot(`convoy30_b${BR}`);
R.info('convoy30', JSON.stringify(await S()));
R.info('stalls >1.5s', JSON.stringify(await b.J('window.__gaps')));
R.check('no console errors/exceptions', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 6)));
R.info('warnings', JSON.stringify(b.logs.filter((l) => !b.errors().includes(l)).slice(0, 6)));
writeFileSync(`qa/v6tour-${vname}-b${BR}.json`, JSON.stringify(log, null, 1));
R.save(`qa/v6tour-${vname}-b${BR}-report.json`);
b.close(); srv.close(); process.exit(0);
