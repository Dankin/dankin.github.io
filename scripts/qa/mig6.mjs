// v4/v5/v6 → v7 存档迁移实测。node scripts/qa/mig6.mjs [land|port|desk]
import * as L from './lib.mjs';
const vname = process.argv[2] || 'land';
const [W, H] = L.VIEWS[vname];
const R = L.makeReporter('mig6-' + vname);
const { srv, base } = await L.serve();
const b = await L.launchBrowser({ base });
await b.view(W, H, { dpr: 2, mobile: vname !== 'desk' });
const KEY = 'shake-the-apple.save';
const sleep = L.sleep;
const jget = (k) => b.J(`localStorage.getItem(${JSON.stringify(k)})`);
const jset = (k, v) => b.ev(`localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
const keys = () => b.J('Object.keys(localStorage)');
const state = (expr) => b.J(`(()=>{const s=__game.state;return ${expr}})()`);
async function leaveEditReturn(edit, wait = 2500) {
  await b.G('(()=>{window.dispatchEvent(new Event("pagehide"));return 1})()');
  await b.reloadTo('blank.txt', 300);
  await edit();
  await b.reloadTo('?debug=1', wait);
}
async function readSave() { const raw = await jget(KEY); if (!raw) return null; const o = JSON.parse(raw); return { raw, body: JSON.parse(o.body) }; }
const pad = (arr, n, fill) => Array.from({ length: n }, (_, i) => arr?.[i] ?? fill);

// 老版本字段形状
function toV6(s, srcTier, rtTier9, srcUnits, rtUnits9, srcBr, rtBr9) {
  const o = JSON.parse(JSON.stringify(s));
  o.version = 6;
  o.source = { ...o.source, tier: srcTier, units: pad(srcUnits, 6, 0), ext: pad([], 6, 0), branch: pad(srcBr, 6, -1) };
  o.route = { ...o.route, tier: rtTier9, units: pad(rtUnits9, 9, 0), ext: pad([], 9, 0), branch: pad(rtBr9, 9, -1) };
  o.vehicles = [{ tier: rtTier9, w: 1, phase: 0.3, load: 0 }];
  o.gates = [1, 0, 0]; o.gatesUnlocked = 3;
  return o;
}
const cases = [
  { name: 'v6 满档(果星→? src5/rt8)', make: (s) => toV6(s, 5, 8, [5, 4, 3, 3, 2, 1], [9, 8, 7, 6, 5, 4, 3, 2, 1], [-1, 0, 1, 0, 1, 1], [-1, -1, 0, 1, -1, 0, 1, 0, 1]), exp: { v: 7, st: 4, rt: 7, su: 5, ru: 8 } },
  { name: 'v6 蹦床档(src2/rt3 蹦床)', make: (s) => toV6(s, 2, 3, [5, 4, 3], [9, 8, 7, 6], [-1, 0, 1], [-1, -1, 0, 1]), exp: { v: 7, st: 2, rt: 2, su: 5, ru: 8 } },
  { name: 'v6 苹果之果星 (src4/rt6 直升机)', make: (s) => toV6(s, 4, 6, [5, 4, 3, 3, 2], [9, 8, 7, 6, 5, 4, 3], [-1, 0, 1, 0, 1], [-1, -1, 0, 1, -1, 0, 1]), exp: { v: 7, st: 3, rt: 5, su: 5, ru: 8 } },
  { name: 'v6 新档(src0/rt0)', make: (s) => toV6(s, 0, 0, [2], [3], [], []), exp: { v: 7, st: 0, rt: 0, su: 5, ru: 8 } },
  {
    name: 'v5 helpers=7 (src3/rt5)',
    make: (s) => { const o = toV6(s, 3, 5, [5, 4, 3, 3], [9, 8, 7, 6, 5, 4], [-1, 0, 1, 0], [-1, -1, 0, 1, -1, 0]); o.version = 5; delete o.helperLevel; delete o.helperAct; o.helpers = 7; return o; },
    exp: { v: 7, st: 3, rt: 4, su: 5, ru: 8 },
  },
  {
    name: 'v4 全链(旧 6 档 route, src2, rt4)',
    make: (s) => { const o = toV6(s, 2, 4, [5, 4, 3], [9, 0, 8, 0, 7, 6, 0, 5, 4], [-1, 0, 1], []); const m = [0, 2, 4, 5, 7, 8]; o.route = { ...o.route, tier: 2, units: m.map((n) => o.route.units[n]), ext: [0, 0, 0, 0, 0, 0], branch: m.map((n) => o.route.branch[n]) }; o.vehicles = [{ tier: 2, w: 1, phase: 0.2, load: 0 }]; o.version = 4; delete o.sys; delete o.helperLevel; o.helpers = 3; return o; },
    exp: { v: 7, st: 2, rt: 3, su: 5, ru: 8 },
  },
];

await b.open('?debug=1', { wait: 1500 });
await b.G('(()=>{g.state.coins=1234567;g.state.delivered=123456;g.state.shakes=555})()');
await sleep(300);
let idx = 0;
for (const c of cases) {
  idx++;
  await b.G('(()=>{window.dispatchEvent(new Event("pagehide"));return 1})()');
  await b.reloadTo('blank.txt', 300);
  const cur = JSON.parse(JSON.parse(await jget(KEY)).body);
  const fix = c.make(cur);
  await jset(KEY, L.wrapSave(fix));
  const ks0 = await keys();
  for (const k of ks0) if (k.includes('.bak')) await b.ev(`localStorage.removeItem(${JSON.stringify(k)})`);
  const errBefore = b.errors().length;
  await b.reloadTo('?debug=1', 3500);
  const out = await state('({v:s.version,st:s.source.tier,rt:s.route.tier,su:s.source.units.length,ru:s.route.units.length,sb:s.source.branch,rb:s.route.branch,coins:s.coins,hl:s.helperLevel,gates:s.gates,gu:s.gatesUnlocked,veh:s.vehicles.map(v=>v.tier),delivered:s.delivered,shakes:s.shakes,nan:(()=>{let bad=0;const w=(o)=>{if(typeof o==="number"){if(!Number.isFinite(o))bad++;return}if(o&&typeof o==="object")for(const k in o)w(o[k])};w(s);return bad>0})()})');
  const ks = await keys();
  const e = c.exp;
  R.check(`${c.name}: loads as v7, tiers mapped`, out.v === e.v && out.st === e.st && out.rt === e.rt && out.su === e.su && out.ru === e.ru, JSON.stringify(out));
  R.check(`${c.name}: slots (gates) removed`, out.gates === undefined && out.gu === undefined, '');
  R.check(`${c.name}: vehicles tier in range`, out.veh.every((t) => t >= 0 && t <= out.rt), JSON.stringify(out.veh));
  R.check(`${c.name}: no NaN`, !out.nan && Number.isFinite(out.coins), String(out.coins));
  R.check(`${c.name}: .bak written`, ks.some((k) => /\.v[3-6]\.bak$/.test(k)), JSON.stringify(ks.filter((k) => k.includes('bak'))));
  R.check(`${c.name}: no console errors`, b.errors().length === errBefore, JSON.stringify(b.errors().slice(errBefore, errBefore + 3)));
  R.info(`${c.name} detail`, `hl=${out.hl} coins=${Math.round(out.coins)} sb=${JSON.stringify(out.sb)} rb=${JSON.stringify(out.rb)} deliv=${out.delivered}`);
  await b.G('(()=>g.panels().closeAll())()'); await sleep(500);
  await b.shot(`mig6_${idx}_${vname}`);
  // 迁移后还能玩:买一个、摇一下
  await b.G('(()=>{g.state.coins=1e9;return 1})()'); await sleep(200);
  await b.click('#btnSrcBuy'); await sleep(200); await b.click('#btnRtBuy'); await sleep(200); await b.tapStage(0.2, 0.5, 3);
  await sleep(800);
  R.check(`${c.name}: playable after migrate (no errors)`, b.errors().length === errBefore, '');
}
R.check('no console errors total', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 6)));
R.save(`qa/mig6-${vname}.json`);
b.close(); srv.close(); process.exit(0);
