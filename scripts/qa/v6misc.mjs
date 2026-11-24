// v6 杂项:小鸟(点中/没点中)、牛顿/流星事件、彩蛋角色点击、三张阶段卡的几何(是否被视口裁掉)、设置/图鉴/订单/精确数字页截图。
// node scripts/qa/v6misc.mjs <land|port|desk>
import { mkdirSync, writeFileSync } from 'node:fs';
import * as L from './lib.mjs';
const vname = process.argv[2] || 'land';
const [W, H] = L.VIEWS[vname];
const R = L.makeReporter(`v6misc-${vname}`);
mkdirSync('qa/shots/v6', { recursive: true });
const { srv, base } = await L.serve();
const b = await L.launchBrowser({ base });
await b.view(W, H, { dpr: 2, mobile: vname !== 'desk' });
const sleep = L.sleep;
const shot = (n) => b.shot(`v6/m_${n}_${vname}`);
const S = (e) => b.J(`(()=>{const s=__game.state;return ${e}})()`);
const poke = (st, rt, hl = 4) => b.G(`(()=>{const s=g.state;s.source.tier=${st};s.route.tier=${rt};for(let i=0;i<=${st};i++)s.source.units[i]=Math.max(s.source.units[i],2);for(let i=0;i<=${rt};i++)s.route.units[i]=Math.max(s.route.units[i],2);s.helperLevel=${hl};s.coins=1e9;s.delivered=Math.max(s.delivered,5000);return 1})()`);
const toastTxt = () => b.J(`[...document.querySelectorAll('.toast,#toast,.panel-toast')].map(e=>e.textContent).join('|')`);

await b.open('?debug=1', { wait: 1500 });
await b.G('(()=>g.panels().closeAll())()');
await poke(3, 5);
await sleep(1500);
await b.G('(()=>g.panels().closeAll())()');

// ── 阶段卡几何 ──
for (const id of ['src-0', 'rt-0', 'station']) {
  await b.G(`(()=>{g.panels().showStageCard('${id}',true);return 1})()`);
  await sleep(900);
  const r = await b.J(`(()=>{const e=document.querySelector('#panel-stage .panel-stage-card, #panel-stage > *');const all=[...document.querySelectorAll('#panel-stage *')].map(x=>{const r=x.getBoundingClientRect();return {c:x.className,x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom}}).filter(o=>o.w>0&&o.h>0);return {iw:innerWidth,ih:innerHeight,over:all.filter(o=>o.r>innerWidth+1||o.b>innerHeight+1||o.x<-1||o.y<-1).slice(0,6),ok:!!document.querySelector('#panel-stage .panel-stage-ok'),n:all.length}})()`);
  R.check(`stage card ${id}: fully inside viewport`, r.over.length === 0 && r.ok, JSON.stringify(r));
  await shot(`card_${id}`);
  await b.ev(`document.querySelector('#panel-stage .panel-stage-ok')?.click()`);
  await sleep(600);
}

// ── 小鸟:点中 ──
async function birdTest(label, hit) {
  await b.G('(()=>g.panels().closeAll())()');
  await sleep(300);
  const before = await S('({c:s.coins,stock:s.stock,sh:s.shakes})');
  await b.ev(`window.__bres=null;(async()=>{
    const g=window.__game; const o=g.orchard; g.forceEvent('bird');
    const st=document.getElementById('stage'); const rc=st.getBoundingClientRect();
    let pos=null;
    for(let i=0;i<60&&!pos;i++){ await new Promise(r=>setTimeout(r,100));
      for(let y=0;y<rc.height&&!pos;y+=10)for(let x=0;x<rc.width&&!pos;x+=10){ if(o.art&&o.art.evHit(x,y)) pos=[x,y]; } }
    if(!pos){window.__bres={found:false};return}
    if(${hit}) st.dispatchEvent(new MouseEvent('click',{clientX:rc.left+pos[0],clientY:rc.top+pos[1],bubbles:true}));
    window.__bres={found:true,pos,active:o.eventActive()}; return;
  })().then(()=>{if(!window.__bres)window.__bres={found:false}})`);
  let res=null;for(let i=0;i<40&&!res;i++){await sleep(250);res=await b.J('window.__bres');}
  res=res||{found:false,timeout:true};
  await sleep(hit ? 900 : 6500);
  const after = await S('({c:s.coins,stock:s.stock,sh:s.shakes})');
  const ft = await b.J(`[...document.querySelectorAll('.float-text,.ftxt,#floats *')].map(e=>e.textContent).join('|')`);
  R.info(`bird ${label}`, JSON.stringify({ res, before, after, ft, toast: await toastTxt() }));
  R.check(`bird ${label}: bird found on stage`, res.found, JSON.stringify(res));
  if (hit) await shot('bird_hit');
  return { before, after, res };
}
const bh = await birdTest('hit', true);
R.check('bird hit: coins or stock increased', bh.after.c > bh.before.c || bh.after.stock > bh.before.stock, JSON.stringify(bh));
await sleep(1500);
const bm = await birdTest('miss', false);
R.info('bird miss: stock before/after', `${bm.before.stock} → ${bm.after.stock}`);

// ── 牛顿 / 流星 ──
for (const k of ['newton', 'meteor']) {
  await b.G('(()=>g.panels().closeAll())()');
  await sleep(2500);
  await b.G(`(()=>{g.forceEvent('${k}');return 1})()`);
  await sleep(1200);
  await shot(`ev_${k}`);
  R.info(`event ${k} active`, String(await b.G('(()=>g.orchard.eventActive())()')));
  await sleep(5000);
}

// ── 彩蛋角色点击(g.tap) ──
const ids = ['newton', 'treetop-fruit', 'poison-stall', 'summit-gold', 'xu-head-apple', 'xu-throat', 'garage', 'moon', 'orange', 'elf', 'sleigh-bell', 'reindeer-nose', 'gift-top'];
await poke(4, 7, 8);
await sleep(1000);
const eggRows = [];
for (const id of ids) {
  const e0 = await S('JSON.stringify(s.sys?.codex?.eggs||{})');
  const c0 = await S('s.coins');
  const out = await b.G(`(()=>{try{g.tap('${id}');return 'ok'}catch(e){return 'ERR '+e.message}})()`);
  await sleep(500);
  const e1 = await S('JSON.stringify(s.sys?.codex?.eggs||{})');
  const ft = await b.J(`[...document.querySelectorAll('.float-text,.ftxt,#floats *,.panel-toast,.toast')].map(e=>e.textContent).join('|').slice(0,80)`);
  eggRows.push({ id, out, newEgg: e0 !== e1, dCoins: (await S('s.coins')) - c0, ft });
  if (['elf', 'gift-top', 'moon'].includes(id)) await shot(`egg_${id}`);
}
R.info('egg taps', JSON.stringify(eggRows));
R.check('g.tap never throws', eggRows.every((r) => r.out === 'ok'), JSON.stringify(eggRows.filter((r) => r.out !== 'ok')));

// ── 设置 / 图鉴 / 订单 / 精确数字 ──
await b.G('(()=>g.panels().closeAll())()');
await sleep(300);
await b.click('#btnSettings'); await sleep(600); await shot('settings');
const more = await b.J(`(()=>{const e=[...document.querySelectorAll('.panel-sheet button')].find(e=>/更多|精确/.test(e.textContent));if(e){e.click();return e.textContent}return null})()`);
await sleep(600);
R.info('settings more click', String(more));
await shot('settings_more');
const exact = await b.J(`(()=>{const e=[...document.querySelectorAll('#settings button, #settings label, #settings input')].map(e=>e.textContent||e.id||e.type).join('|');return e.slice(0,300)})()`);
R.info('legacy settings contents', exact);
await b.G('(()=>g.panels().closeAll())()'); await b.ev(`document.getElementById('settings')?.classList.remove('open')`);
for (const [n, f] of [['codex', 'openCodex'], ['orders', 'openOrders'], ['offer', 'openOffer']]) {
  await b.G('(()=>g.panels().closeAll())()'); await sleep(300);
  await b.G(`(()=>{g.panels().${f}();return 1})()`); await sleep(700);
  const r = await b.J(`(()=>{const e=document.querySelector('.panel-sheet');if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,r:r.right,b:r.bottom,iw:innerWidth,ih:innerHeight}})()`);
  R.check(`${n} sheet inside viewport`, !!r && r.x >= -1 && r.y >= -1 && r.r <= r.iw + 1 && r.b <= r.ih + 1, JSON.stringify(r));
  await shot(n);
}
await b.G('(()=>g.panels().closeAll())()');
// 已移除的功能不应还在 DOM 里
const gone = await b.J(`({mail:!!document.querySelector('.panel-mail-sheet,#btnMail,[data-dock=mail]'),dockTxt:[...document.querySelectorAll('.panel-dockbtn')].map(e=>e.textContent.trim()+(e.getBoundingClientRect().width?'':'(hidden)'))})`);
R.info('dock buttons / mailbox leftovers', JSON.stringify(gone));
R.check('no console errors/exceptions', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 6)));
R.save(`qa/v6misc-${vname}.json`);
b.close(); srv.close(); process.exit(0);
