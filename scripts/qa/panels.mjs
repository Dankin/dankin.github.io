// 面板开关实测:旁白条/信箱/图鉴/订单/献果/设置/礼物/明信片。node scripts/qa/panels.mjs <land|port|desk>
import * as L from './lib.mjs';
const vname = process.argv[2] || 'land';
const [W, H] = L.VIEWS[vname];
const R = L.makeReporter('panels-' + vname);
const { srv, base } = await L.serve();
const b = await L.launchBrowser({ base });
await b.view(W, H);
await b.open('?debug=1', { wait: 1500 });
const ERA_TIERS = [[0, 0], [1, 2], [2, 4], [3, 5], [4, 7], [5, 8]];
await b.G(`(()=>{const [a,r]=${JSON.stringify(ERA_TIERS[2])};const s=g.state;s.source.tier=a;s.route.tier=r;for(let i=0;i<=a;i++)s.source.units[i]=3;for(let i=0;i<=r;i++)s.route.units[i]=3;s.coins=500;s.playSec=500;s.sys.orders.nextAt=s.playSec;for(const k of ['red','green','granny','fuji','golden'])s.sys.bag[k]=0})()`);
await L.sleep(1500);
await b.G('(()=>g.panels().closeAll())()');
const sheetInfo = () => b.J(`(()=>{const s=document.querySelector('.panel-sheet');if(!s)return null;const r=s.getBoundingClientRect();const over=[...s.querySelectorAll('*')].filter(e=>{const c=getComputedStyle(e);if(c.display==='none'||c.visibility==='hidden')return false;const q=e.getBoundingClientRect();if(!q.width||!q.height)return false;return q.right>innerWidth+1||q.left<-1||q.bottom>innerHeight+1&&!s.contains(e)}).length;const clipped=[...s.querySelectorAll('*')].filter(e=>e.children.length===0&&e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflow!=='visible'&&e.clientWidth>0&&getComputedStyle(e).textOverflow!=='ellipsis').map(e=>(e.className||e.tagName)+':'+e.textContent.slice(0,20)).slice(0,5);return {id:s.id,x:r.left|0,y:r.top|0,w:r.width|0,h:r.height|0,inView:r.left>=0&&r.top>=0&&r.right<=innerWidth+0.5&&r.bottom<=innerHeight+0.5,scrolls:s.scrollHeight>s.clientHeight+2,over,clipped,text:s.innerText.replace(/\\n+/g,' / ').slice(0,160)}})()`);
const veil = () => b.ev('!!document.querySelector(".panel-veil")');
const play = () => b.ev('__game.state.playSec');
async function exerciseSheet(name, opener, { extra } = {}) {
  await opener(); await L.sleep(700);
  const info = await sheetInfo();
  R.check(`${name}: opens a sheet`, !!info, JSON.stringify(info));
  if (!info) return;
  R.info(`${name} bbox`, JSON.stringify({ ...info, text: undefined }));
  R.check(`${name}: fully inside viewport`, info.inView, `${info.x},${info.y} ${info.w}x${info.h} vs ${W}x${H}`);
  if (info.over) R.info(`${name} overflowing descendants`, String(info.over));
  if (info.clipped.length) R.info(`${name} clipped text`, JSON.stringify(info.clipped));
  R.info(`${name} text`, info.text);
  await b.shot(`panel_${name}_${vname}`);
  if (extra) await extra();
  // 关闭方式 1: ✕
  const p0 = await play(); await L.sleep(500); const p1 = await play();
  R.info(`${name}: game time advances while open`, `${(p1 - p0).toFixed(2)}s/0.5s`);
  if (await b.J(`!!document.querySelector('.panel-sheet .panel-x')`)) await b.click('.panel-sheet .panel-x'); else await b.J(`[...document.querySelectorAll('.panel-sheet button')].find(e=>/关上|收好|关闭/.test(e.textContent))?.click()`); await L.sleep(500);
  R.check(`${name}: ✕ closes`, !(await sheetInfo()) && !(await veil()), '');
  // 关闭方式 2: Esc
  await opener(); await L.sleep(500); await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await L.sleep(500);
  R.check(`${name}: Esc closes`, !(await sheetInfo()), '');
  // 关闭方式 3: 点遮罩
  await opener(); await L.sleep(500);
  await b.mouse(4, H - 4, 1); await L.sleep(500);
  R.check(`${name}: veil click closes`, !(await sheetInfo()), '');
  R.check(`${name}: stage clickable after close (no stuck veil)`, !(await veil()), '');
}
const dockClick = (title) => async () => { const pt = await b.J(`(()=>{const e=[...document.querySelectorAll('.panel-dockbtn')].find(x=>x.title==='${title}');if(!e)return null;const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,r.width]})()`); if (!pt || !pt[2]) { R.info(`dock ${title}`, 'not visible'); return; } await b.mouse(pt[0], pt[1], 1); };
// 订单/信箱 需要内容
await b.G('(()=>{const s=g.state;s.sys.orders.nextAt=s.playSec})()'); await L.sleep(1500);
R.info('dock buttons', JSON.stringify(await b.J('[...document.querySelectorAll(".panel-dockbtn")].map(e=>[e.title,e.textContent,(r=>[r.left|0,r.top|0,r.width|0,r.height|0])(e.getBoundingClientRect())])')));
await exerciseSheet('codex', dockClick('图鉴'), { extra: async () => { const tabs = await b.J('[...document.querySelectorAll(".panel-tab")].map(e=>e.textContent)'); for (let i = 0; i < tabs.length; i++) { await b.J(`document.querySelectorAll(".panel-tab")[${i}].click()`); await L.sleep(250); await b.shot(`panel_codex_tab${i}_${vname}`); const inf = await sheetInfo(); R.check(`codex tab ${tabs[i]} in viewport`, inf?.inView, ''); } } });
await exerciseSheet('mailbox', dockClick('信箱'));
await exerciseSheet('orders', dockClick('订单'));
await b.G(`(()=>{const s=g.state;s.source.tier=3;s.route.tier=5;for(let i=0;i<=3;i++)s.source.units[i]=3;for(let i=0;i<=5;i++)s.route.units[i]=3})()`); await L.sleep(1500); await b.G('(()=>g.panels().closeAll())()');
await exerciseSheet('offer', dockClick('献果'));
await exerciseSheet('settings', async () => { await b.click('#btnSettings'); }, { extra: async () => {
  const ctrls = await b.J('[...document.querySelectorAll(".panel-sheet button,.panel-sheet input,.panel-sheet textarea,.panel-sheet select")].map(e=>(e.tagName+"."+e.className+"|"+(e.getAttribute("aria-label")||e.textContent||e.type||"")).slice(0,40))');
  R.info('settings controls', JSON.stringify(ctrls));
} });
await exerciseSheet('postcard', async () => { await b.G('(()=>g.panels().openPostcard("pc-1"))()'); });
await exerciseSheet('gift-sealed', async () => { await b.G(`(()=>g.panels().openGift({force:'sealed'}))()`); });
await exerciseSheet('gift-open', async () => { await b.G(`(()=>g.panels().openGift({force:'open'}))()`); });
// 旁白条
const narr = await b.J(`(()=>{const e=document.getElementById('panel-narr');const r=e.getBoundingClientRect();return {cls:e.className,x:r.left|0,y:r.top|0,w:r.width|0,h:r.height|0,text:e.innerText.slice(0,60)}})()`);
R.info('narration bar', JSON.stringify(narr));
await b.G(`(()=>g.panels().say('测试旁白:这是一条很长很长很长很长很长很长很长很长很长很长很长很长很长的旁白,用来检查溢出和裁切。'))()`); await L.sleep(2500);
await b.shot(`panel_narr_${vname}`);
const nr = await b.J(`(()=>{const e=document.getElementById('panel-narr');const r=e.getBoundingClientRect();return [r.left,r.right,r.top,r.bottom,innerWidth,e.scrollWidth>e.clientWidth+2]})()`);
R.check('narration long text stays in viewport', nr[0] >= -1 && nr[1] <= nr[4] + 1, JSON.stringify(nr));
R.check('no console errors/exceptions', b.errors().length === 0, JSON.stringify(b.errors().slice(0, 8)));
R.info('warnings', JSON.stringify(b.logs.filter((l) => !b.errors().includes(l)).slice(0, 8)));
R.save(`qa/panels-${vname}.json`);
b.close(); srv.close(); process.exit(0);
