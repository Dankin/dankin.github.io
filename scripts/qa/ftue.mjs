// FTUE / 新档前 N 分钟:真点击摇树、买、升档。node scripts/qa/ftue.mjs <land|port|desk> [seconds=120] [speed=1]
import * as L from './lib.mjs';
const vname = process.argv[2] || 'land';
const secs = Number(process.argv[3] || 120);
const speed = Number(process.argv[4] || 1);
const [W, H] = L.VIEWS[vname];
const R = L.makeReporter('ftue-' + vname);
const { srv, base } = await L.serve();
const b = await L.launchBrowser({ base });
await b.view(W, H);
await b.preload(`(()=>{window.__seen=[];const t0=performance.now();const rec=(k,s)=>{s=(s||'').trim();if(!s)return;const l=window.__seen;if(window.__last&&window.__last[k]===s)return;(window.__last=window.__last||{})[k]=s;l.push({k,s,t:Math.round((performance.now()-t0)/1000)})};
addEventListener('DOMContentLoaded',()=>{const mo=new MutationObserver(()=>{rec('toast',document.getElementById('toast')?.textContent);rec('narr',document.querySelector('#panel-narr .panel-narr-txt')?.textContent);document.querySelectorAll('.glow,.pulse,.hl,[class*=ftue]').forEach(e=>rec('hl',(e.id||e.className)+''))});mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']})})})()`);
await b.open(speed > 1 ? `?debug=1&speed=${speed}` : '?debug=1', { wait: 1200 });
R.info('title/pages', await b.ev('document.title'));
const t0 = Date.now();
let firstBuy = null, firstTier = null, lastShot = 0;
const q = (e) => b.G(e);
while ((Date.now() - t0) / 1000 < secs) {
  await b.tapStage(0.14, 0.5, 2);
  const st = await b.J('(()=>{const s=__game.state;return {coins:s.coins,spent:s.spent,delivered:s.delivered,shakes:s.shakes,st:s.source.tier,rt:s.route.tier,play:s.playSec,su:s.source.units,ru:s.route.units}})()');
  const dis = await b.J('["btnSrcBuy","btnSrcUp","btnRtBuy","btnRtUp"].map(i=>{const e=document.getElementById(i);return [i,!!e&&!e.disabled&&!e.classList.contains("off")&&!e.hidden,e&&e.className]})');
  const can = (id) => { const c = dis.find((d) => d[0] === id); return !!c && c[1] && /\bcan\b/.test(c[2] || ''); };
  for (const id of ['btnSrcUp', 'btnRtUp']) if (can(id)) { await b.click('#' + id); await L.sleep(300); const bp = await b.ev('!document.getElementById("branchPick").hidden'); if (bp) { await b.click('#branch0'); R.info('branch picked at s', Math.round((Date.now() - t0) / 1000)); } }
  for (const id of ['btnSrcBuy', 'btnRtBuy']) if (can(id)) await b.click('#' + id);
  if (firstBuy == null && st.spent > 0) { firstBuy = Math.round((Date.now() - t0) / 1000); R.info('first purchase at s', firstBuy); await b.shot(`ftue_${vname}_firstbuy`); }
  if (firstTier == null && (st.st > 0 || st.rt > 0)) { firstTier = Math.round((Date.now() - t0) / 1000); R.info('first tier-up at s', firstTier, JSON.stringify(st)); await b.shot(`ftue_${vname}_tier1`); }
  if (Date.now() - lastShot > 40000) { lastShot = Date.now(); await b.shot(`ftue_${vname}_t${Math.round((Date.now() - t0) / 1000)}`); }
  await L.sleep(250);
}
const fin = await b.J('(()=>{const s=__game.state;return {coins:s.coins,spent:s.spent,delivered:s.delivered,shakes:s.shakes,st:s.source.tier,rt:s.route.tier,play:s.playSec}})()');
R.info('final', JSON.stringify(fin));
const seen = await b.J('window.__seen');
for (const e of seen) R.info(`[${e.t}s ${e.k}]`, e.s.slice(0, 80));
R.check('first purchase within 60s', firstBuy != null && firstBuy <= 60, String(firstBuy));
R.check('no console errors/exceptions', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 5)));
R.info('warnings', JSON.stringify(b.logs.filter((l) => !b.errors().includes(l)).slice(0, 5)));
R.save(`qa/ftue-${vname}.json`);
b.close(); srv.close();
process.exit(0);
