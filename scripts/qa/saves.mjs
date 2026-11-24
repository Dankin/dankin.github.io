// 存档与离线实测:导出导入 / v4→v5 迁移 / 损坏回退 .bak / 版本更高只读 / 离线 1h·1d·3d 结算。
// node scripts/qa/saves.mjs [land|port|desk]
import * as L from './lib.mjs';
const vname = process.argv[2] || 'land';
const [W, H] = L.VIEWS[vname];
const R = L.makeReporter('saves-' + vname);
const { srv, base } = await L.serve();
const b = await L.launchBrowser({ base });
await b.view(W, H);
const KEY = 'shake-the-apple.save';
const ERA_TIERS = [[0, 0], [1, 2], [2, 3], [3, 4], [4, 6], [4, 7]];
const sleep = L.sleep;
const jget = (k) => b.J(`localStorage.getItem(${JSON.stringify(k)})`);
const jset = (k, v) => b.ev(`localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
const keys = () => b.J('Object.keys(localStorage)');
const state = (expr) => b.J(`(()=>{const s=__game.state;return ${expr}})()`);
const poke = (e, coins = 500) => b.G(`(()=>{const [a,r]=${JSON.stringify(ERA_TIERS[e])};const s=g.state;s.source.tier=a;s.route.tier=r;for(let i=0;i<=a;i++)s.source.units[i]=3;for(let i=0;i<=r;i++)s.route.units[i]=3;s.coins=${coins};s.delivered=123456;s.shakes=777})()`);
/** 离开游戏页(到同源空白页,避免 pagehide 覆盖我改的存档),改 localStorage,再回来 */
async function leaveEditReturn(edit, wait = 1800) {
  await b.G('(()=>{window.dispatchEvent(new Event("pagehide"));return 1})()'); // 触发一次 persist,与真实关页一致
  await b.reloadTo('blank.txt', 300);
  await edit();
  await b.reloadTo('?debug=1', wait);
}
async function readSave(k = KEY) { const raw = await jget(k); if (!raw) return null; const o = JSON.parse(raw); return { raw, body: JSON.parse(o.body) }; }

// ─────────── 1. 导出 / 导入(设置面板真实点击) ───────────
await b.open('?debug=1', { wait: 1500 });
await poke(2, 4321);
await b.G('(()=>g.panels().closeAll())()');
await b.click('#btnSettings'); await sleep(500);
const clickBtnText = (re, scope = '.panel-sheet') => b.J(`(()=>{const e=[...document.querySelectorAll('${scope} button')].find(e=>/${re}/.test(e.textContent));if(e){e.click();return true}return false})()`);
R.check('settings: export button clicked', await clickBtnText('导出存档'), '');
await sleep(500);
const exported = await b.J(`document.querySelector('.panel-area').value`);
R.check('export: textarea filled with base64', /^[A-Za-z0-9+/=]{100,}$/.test(exported || ''), `len=${(exported || '').length}`);
const msg1 = await b.J(`document.querySelector('.panel-set-msg').textContent`);
R.info('export message', msg1);
await b.shot(`save_export_${vname}`);
// 篡改当前状态,再导入,应恢复
await b.G('(()=>{g.state.coins=1;g.state.shakes=5})()');
R.check('import: confirm row appears', await clickBtnText('导入存档') && (await sleep(200), await clickBtnText('确|覆盖|导入', '.panel-confirm')), '');
await sleep(600);
const after = await state('({c:s.coins,sh:s.shakes,st:s.source.tier,rt:s.route.tier})');
R.check('import: state restored (shakes=777, tiers kept)', after.sh === 777 && after.st === 2 && after.rt === 3 && after.c > 4000, JSON.stringify(after));
R.info('import message', await b.J(`document.querySelector('.panel-set-msg').textContent`));
// 无效导入
await b.J(`(()=>{const a=document.querySelector('.panel-area');a.value=${JSON.stringify(exported.slice(0, 60))};})()`);
await b.G('(()=>{g.state.shakes=4242})()');
await clickBtnText('导入存档'); await sleep(200); await clickBtnText('确|覆盖|导入', '.panel-confirm'); await sleep(400);
R.check('import truncated text → rejected, state untouched', (await state('s.shakes')) === 4242, await b.J(`document.querySelector('.panel-set-msg').textContent`));
await b.J(`(()=>{const a=document.querySelector('.panel-area');a.value='not base64 !!!'})()`);
await clickBtnText('导入存档'); await sleep(200); await clickBtnText('确|覆盖|导入', '.panel-confirm'); await sleep(400);
R.check('import garbage → rejected', (await state('s.shakes')) === 4242, await b.J(`document.querySelector('.panel-set-msg').textContent`));
// 带前后空白/换行的有效文本
await b.J(`(()=>{const a=document.querySelector('.panel-area');a.value='  \\n'+${JSON.stringify(exported)}+'\\n '})()`);
await clickBtnText('导入存档'); await sleep(200); await clickBtnText('确|覆盖|导入', '.panel-confirm'); await sleep(400);
R.check('import with surrounding whitespace OK', (await state('s.shakes')) === 777, '');
// 重新开始(两步确认)
await clickBtnText('重新开始|重头'); await sleep(200);
R.info('reset confirm row', await b.J(`document.querySelector('.panel-sheet .panel-confirm:last-of-type')?.textContent || [...document.querySelectorAll('.panel-confirm')].map(e=>e.textContent).join('|')`));
await b.G('(()=>g.panels().closeAll())()');

// ─────────── 2. v4 → v5 迁移 ───────────
await b.open('?debug=1', { wait: 1200 });
await poke(2, 4321); // st=2 rt=4(新索引)
await b.G('(()=>{const s=g.state;s.source.branch[1]=1;s.route.branch[2]=0;s.route.branch[4]=1})()');
await sleep(300);
await leaveEditReturn(async () => {
  const cur = await readSave(); // pagehide 已写
  const s = cur.body;
  const OLD_TO_NEW = [0, 2, 4, 5, 7, 8];
  const pick = (arr, fill) => OLD_TO_NEW.map((n) => arr[n] ?? fill);
  s.version = 4;
  delete s.sys;
  s.route = { ...s.route, tier: OLD_TO_NEW.indexOf(s.route.tier), units: pick(s.route.units, 0), ext: pick(s.route.ext, 0), branch: pick(s.route.branch, -1) };
  s.vehicles = (s.vehicles || []).map((v) => ({ ...v, tier: OLD_TO_NEW.indexOf(v.tier) }));
  R.info('v4 fixture', `route.tier(old)=${s.route.tier} units=${JSON.stringify(s.route.units)} coins=${s.coins}`);
  await jset(KEY, L.wrapSave(s));
  await b.ev(`localStorage.removeItem(${JSON.stringify(KEY + '.bak')})`);
}, 2200);
const mig = await state('({v:s.version,st:s.source.tier,rt:s.route.tier,ru:s.route.units.length,ru4:s.route.units[4],sys:!!s.sys&&typeof s.sys.codex,shakes:s.shakes,b1:s.source.branch[1],rb4:s.route.branch[4]})');
R.check('v4→v7: state loads as v7 (st2, 8 route slots, sys present; 路线细节见 mig6.mjs)', mig.v === 7 && mig.st === 2 && mig.ru === 8 && mig.sys === 'object', JSON.stringify(mig));
R.check('v4→v5: branches preserved', mig.b1 === 1, JSON.stringify(mig));
const ks = await keys();
R.check('v4→v5: .v4.bak written', ks.includes(KEY + '.v4.bak'), JSON.stringify(ks));
const saved = await readSave();
R.info('after-migration stored version', String(saved?.body?.version));
await b.shot(`save_migrated_${vname}`);

// ─────────── 3. 损坏存档回退 .bak ───────────
await b.open('?debug=1', { wait: 1200 });
await poke(1, 777);
await b.G('(()=>{g.state.shakes=31337})()');
await sleep(300);
await leaveEditReturn(async () => {
  // pagehide 已写主档;再制造 .bak = 有效旧档,主档 = 半截
  const raw = await jget(KEY);
  await jset(KEY + '.bak', raw);
  await jset(KEY, raw.slice(0, Math.floor(raw.length / 2)));
}, 2000);
const bak = await state('({sh:s.shakes,st:s.source.tier})');
R.check('corrupt main (truncated) → recovered from .bak', bak.sh >= 31337 && bak.st === 1, JSON.stringify(bak));
const toastT = await b.J(`document.getElementById('toast').textContent`);
R.info('toast after bak recovery', toastT);
await b.shot(`save_bak_${vname}`);
// 校验和被改(内容改了没改 sum)
await leaveEditReturn(async () => {
  const raw = JSON.parse(await jget(KEY));
  raw.body = raw.body.replace('"shakes":', '"shakes":9');
  await jset(KEY, JSON.stringify(raw));
}, 1800);
R.check('checksum mismatch → falls back (not 9xxx shakes)', (await state('s.shakes')) < 90000, String(await state('s.shakes')));
// 主档+bak 都坏 → 新档
await leaveEditReturn(async () => { await jset(KEY, '{broken'); await jset(KEY + '.bak', 'also broken'); }, 1500);
const fresh = await state('({c:s.coins,sh:s.shakes,st:s.source.tier})');
R.check('both corrupt → new game, no crash', fresh.sh < 50 && fresh.st === 0, JSON.stringify(fresh));
// 版本更高 → 只读
await leaveEditReturn(async () => { const cur = await readSave(); await jset(KEY, L.wrapSave({ ...cur.body, version: 99, futureField: { a: 1 } })); await b.ev(`localStorage.removeItem(${JSON.stringify(KEY + '.bak')})`); }, 1500);
const ro = await b.J(`({txt:document.getElementById('toast').textContent})`);
R.info('newer-version toast', ro.txt);
const keptRaw = await jget(KEY);
await sleep(1000);
R.check('newer save is not overwritten', (await jget(KEY)) === keptRaw, '');
R.check('newer save: game still runs (no throw)', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 4)));

// ─────────── 4. 离线 1h / 1d / 3d ───────────
const OBS = `window.__txt=[];new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){const t=(n.textContent||'').trim();if(t)window.__txt.push(Math.round(performance.now())+' '+(n.className||n.id||n.nodeName)+': '+t.slice(0,120))}}).observe(document,{childList:true,subtree:true})`;
const obsId = await b.preload(OBS);
const cases = [['1h', 3600e3], ['1d', 86400e3], ['3d', 3 * 86400e3]];
for (const [label, ms] of cases) {
  await b.open('?debug=1', { wait: 1200 });
  await poke(2, 500);
  await b.G('(()=>{g.state.sys.orders.list=[];g.state.sys.pests.list=[]})()');
  await sleep(500);
  let before;
  await leaveEditReturn(async () => {
    const cur = await readSave(); const s = cur.body;
    before = { coins: s.coins, delivered: s.delivered, last: s.lastSeen, play: s.playSec, pests: s.sys.pests.list.length, orders: s.sys.orders.list.length };
    s.lastSeen -= ms;
    await jset(KEY, L.wrapSave(s));
  }, 2500);
  const aft = await state('({coins:s.coins,delivered:s.delivered,play:s.playSec,pests:s.sys.pests.list.length,orders:s.sys.orders.list.length,rot:s.sys.rot.visual,lastSeenDelta:Date.now()-s.lastSeen})');
  const toasts = await b.J(`document.getElementById('toast').textContent`);
  const modal = await b.J('__game.panels().isModalOpen()');
  const veil = await b.J(`[...document.querySelectorAll('.panel-sheet')].map(e=>e.className+':'+e.textContent.slice(0,70))`);
  R.info(`offline ${label}`, JSON.stringify({ before, aft, toasts, modal, veil }));
  R.info(`offline ${label} texts`, JSON.stringify((await b.J('window.__txt||[]')).filter((t) => /toast|narr|bub|送达|离开|回来|away/.test(t)).slice(0, 14)));
  R.check(`offline ${label}: delivered grew`, aft.delivered > before.delivered, `Δ=${(aft.delivered - before.delivered).toFixed(0)}`);
  R.check(`offline ${label}: coins not NaN and finite`, Number.isFinite(aft.coins) && aft.coins >= 0, String(aft.coins));
  R.check(`offline ${label}: lastSeen refreshed`, aft.lastSeenDelta < 8000, String(aft.lastSeenDelta));
  R.check(`offline ${label}: pests/orders capped sanely (≤6/≤6)`, aft.pests <= 6 && aft.orders <= 6, `${aft.pests}/${aft.orders}`);
  await b.shot(`offline_${label}_${vname}`);
  // 欢迎回来的卡片/明信片出现后能关闭,游戏继续
  await b.G('(()=>g.panels().closeAll())()'); await sleep(300);
  R.check(`offline ${label}: closeAll leaves no veil`, !(await b.J(`!!document.querySelector('.panel-veil')`)), '');
}
R.check('no console errors/exceptions', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 8)));
R.info('warnings', JSON.stringify(b.logs.filter((l) => !b.errors().includes(l)).slice(0, 8)));
R.save(`qa/saves-${vname}.json`);
b.close(); srv.close(); process.exit(0);
