// 视觉巡检:各时代 × 三视口截图 → qa/shots/era<N>_<v>.png(+ 文字溢出/越界检测)
// node scripts/qa/shots.mjs
import { writeFileSync } from 'node:fs';
import * as L from './lib.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ERA_TIERS = [[0, 0], [1, 2], [2, 3], [3, 4], [4, 6], [4, 7]];
const { srv, base } = await L.serve();
const b = await L.launchBrowser({ base });
const out = {};
for (const [v, [W, H]] of Object.entries(L.VIEWS)) {
  await b.view(W, H, { dpr: 2, mobile: v !== 'desk' });
  for (let e = 0; e < 6; e++) {
    await b.open('?debug=1', { wait: 1200 });
    await b.G(`(()=>{const [a,r]=${JSON.stringify(ERA_TIERS[e])};const s=g.state;s.source.tier=a;s.route.tier=r;for(let i=0;i<=a;i++)s.source.units[i]=6;for(let i=0;i<=r;i++)s.route.units[i]=6;s.coins=5e3*Math.pow(8,${e});s.delivered=1e4*Math.pow(10,${e});s.playSec=700;s.sys.pests.nextAt=s.playSec;s.sys.orders.nextAt=s.playSec;s.sys.rot.visual=${e >= 2 ? 4 : 0}})()`);
    await sleep(400); await b.G('(()=>g.panels().closeAll())()'); await sleep(3500);
    await b.shot(`vis_era${e}_${v}`);
    // 溢出检测:可见元素 scrollWidth>clientWidth、超出视口
    out[`${v}-era${e}`] = await b.J(`(()=>{const W=innerWidth,H=innerHeight;const res=[];for(const el of document.querySelectorAll('body *')){const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||el.tagName==='CANVAS'||el.tagName==='SCRIPT'||el.tagName==='STYLE')continue;const r=el.getBoundingClientRect();if(r.width<1||r.height<1)continue;if(!el.textContent.trim()&&!/BUTTON/.test(el.tagName))continue;const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!own&&!/BUTTON/.test(el.tagName))continue;const clipped=el.scrollWidth>el.clientWidth+2&&cs.overflow!=='visible'&&el.clientWidth>0;const off=r.left<-1||r.top<-1||r.right>W+1||r.bottom>H+1;if(clipped||off)res.push((el.id||el.className||el.tagName)+' '+(clipped?'CLIP ':'')+(off?'OFF ':'')+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)+' "'+el.textContent.trim().slice(0,24)+'"')}return res.slice(0,12)})()`);
  }
}
console.log(JSON.stringify(out, null, 1));
console.log('errors', JSON.stringify(b.errors().slice(0, 4)));
writeFileSync('qa/visual-scan.json', JSON.stringify(out, null, 1));
b.close(); srv.close(); process.exit(0);
