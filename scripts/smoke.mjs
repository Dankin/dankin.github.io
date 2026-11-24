// Chrome 冒烟测试(v4):无依赖,直接用 CDP。用法: npm run build && node scripts/smoke.mjs
// 读 dist/index.html(file://),在 844×390 横屏 / 390×844 竖屏 / 1280×800 桌面 下检查布局与主要玩法,截图到 shots/v4m_*.png。
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'file://' + resolve('dist/index.html');
const port = 9333;
const dir = mkdtempSync(join(tmpdir(), 'smoke-'));
if (!existsSync('shots')) mkdirSync('shots');
if (!existsSync('dist/index.html')) { console.error('先 npm run build'); process.exit(2); }
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--headless=new', '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };
const info = (name, extra) => console.log(`INFO ${name} ${extra}`);

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('chrome not reachable');
}

const ws = new WebSocket(await connect());
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? 'exception');
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const J = async (expr) => JSON.parse(await ev(`JSON.stringify(${expr})`));
const blank = join(dir, 'blank.html'); writeFileSync(blank, '<html><body>blank</body></html>');

async function view(w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await send('Emulation.setTouchEmulationEnabled', { enabled: w < 600 });
  await sleep(150);
}
/** 打开游戏页。fresh=true 先清存档(在空白页里清,避免游戏 pagehide 又写回去)。 */
async function open(query = '', fresh = true) {
  await send('Page.navigate', { url: 'file://' + blank }); await sleep(250);
  if (fresh) await ev('localStorage.clear()');
  await send('Page.navigate', { url: BASE + query }); await sleep(900);
}
async function shot(name) {
  await sleep(250);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`shots/v4m_${name}.png`, Buffer.from(r.result.data, 'base64'));
}
const text = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent`);
const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const G = (expr) => ev(`(()=>{const g=window.__game;return ${expr}})()`);
/** 在果园里点一下(鼠标事件 → pointer 事件),避开关卡槽 */
async function tapStage(n = 1) {
  const r = await J('(()=>{const b=document.getElementById("stage").getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height}})()');
  const x = r.x + r.w * 0.14, y = r.y + r.h * 0.5;
  for (let i = 0; i < n; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(60);
  }
}
const num = async (expr) => Number(await G(expr));
const openSettings = async () => { await click('#btnSettings'); await sleep(250); await click('#btnMoreSettings'); }; // ⚙ → 新面板 → 更多 → 旧抽屉
const dbgBtn = (label) => ev(`[...document.querySelectorAll('#debug button')].find(b=>b.textContent==='${label}').click()`);

await send('Runtime.enable'); await send('Page.enable');

// ───────── 1. 三个视口:布局 ─────────
const VIEWS = [['land', 844, 390], ['port', 390, 844], ['desk', 1280, 800]];
for (const [nm, w, h] of VIEWS) {
  await view(w, h);
  await open('?debug=1');
  await sleep(500);
  const lay = await J(`(()=>{const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return {t:b.top,b:b.bottom,l:b.left,r:b.right,w:b.width,h:b.height}};
    const btns=['#btnSrcBuy','#btnSrcUp','#btnRtBuy','#btnRtUp','#btnSettings'].map(s=>({s,...r(s)}));
    return {sw:document.documentElement.scrollWidth,iw:innerWidth,sh:document.documentElement.scrollHeight,ih:innerHeight,bar:r('#bar'),stage:r('#stage'),btns}})()`);
  check(`${nm} ${w}×${h} 无横向滚动`, lay.sw <= lay.iw, `(${lay.sw}/${lay.iw})`);
  check(`${nm} 底栏完整在视口内`, lay.bar.t >= 0 && lay.bar.b <= lay.ih + 1 && lay.bar.l >= -1 && lay.bar.r <= lay.iw + 1, `(bar ${Math.round(lay.bar.t)}..${Math.round(lay.bar.b)} / ih ${lay.ih})`);
  check(`${nm} 果园画布有面积`, lay.stage.h >= 120 && lay.stage.w >= 200, `(${Math.round(lay.stage.w)}×${Math.round(lay.stage.h)})`);
  const small = lay.btns.filter((b) => b.h < 44 || b.w < 44).map((b) => `${b.s}:${Math.round(b.w)}×${Math.round(b.h)}`);
  info(`${nm} 触控目标<44px`, small.length ? small.join(' ') : '无');
  const clip = await J(`[...document.querySelectorAll('#bar .nm,#bar .pr,#bar .pv')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className+':'+e.textContent)`);
  info(`${nm} 底栏文字被截断`, clip.length ? clip.join(' | ') : '无');
  const px = await ev(`(()=>{const c=document.getElementById('stage');const x=c.getContext('2d');if(!x)return -1;const d=x.getImageData(0,0,c.width,c.height).data;let k=0;for(let i=0;i<d.length;i+=16)if(d[i+3]>0&&d[i]<150)k++;return k})()`);
  check(`${nm} 画布非空(有深色线条像素)`, px > 300 || px === -1, `(${px})`);
  if (nm === 'land') await shot('land_light'); else if (nm === 'port') await shot('port_light'); else await shot('desk_light');
  if (nm === 'land') {
    await click('#btnSettings'); await sleep(300);
    check('⚙ 打开新设置面板(含导出/导入/重置)', (await ev('!!document.getElementById("panel-settings")')) === true && /导出/.test(await ev('document.getElementById("panel-settings").innerText')));
    await click('#btnMoreSettings'); await sleep(200);
    check('「更多」进入旧设置抽屉', (await ev('document.getElementById("settings").hidden')) === false);
    await click('#btnTheme'); await click('#btnTheme'); // 自动 → 浅 → 深
    check('主题切到深色', (await ev('document.documentElement.classList.contains("dark")')) === true, `(${await text('#btnTheme')})`);
    await click('#btnCloseSettings'); await sleep(400);
    await shot('land_dark');
  }
  check(`${nm} 无控制台报错`, errors.length === 0, errors.slice(0, 2).join(' | '));
}

// ───────── 2. 玩法(横屏) ─────────
await view(844, 390);
await open('?speed=60');
check('?speed 出现调试面板', (await ev('!!document.getElementById("dbgSpeed")')) === true && (await text('#dbgSpeed')) === '×60', `(${await text('#dbgSpeed')})`);
const d0 = await num('g.state.delivered'); const clicks0 = await num('g.state.shakes');
{ // 按下即摇:只 press 不 release 也算一下
  const r0 = await J('(()=>{const b=document.getElementById("stage").getBoundingClientRect();return {x:b.left+b.width*0.14,y:b.top+b.height*0.5}})()');
  const k0 = await num('g.state.shakes');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r0.x, y: r0.y, button: 'left', clickCount: 1 });
  await sleep(80);
  const k1 = await num('g.state.shakes');
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r0.x, y: r0.y, button: 'left', clickCount: 1 });
  check('按下(pointerdown)即摇,不等抬起', k1 === k0 + 1, `(${k0} → ${k1})`);
}
await tapStage(15);
check('点果园 = 摇树(clicks 增加)', (await num('g.state.shakes')) >= clicks0 + 10, `(${clicks0} → ${await num('g.state.shakes')})`);
await sleep(5000);
const d1 = await num('g.state.delivered');
check('×60 几秒后已送出增加', d1 > d0 + 1, `(${d0} → ${d1.toFixed(1)}; 顶栏 ${await text('#apples')})`);
check('顶栏只有已送出(果钱/每秒已移进设置)', (await text('#apples')).length > 0 && (await ev('!document.getElementById("rate")')) === true);
await openSettings(); await sleep(300);
const exact = await ev('document.getElementById("exactApples").innerText');
check('设置里有精确数字(已送出/果钱/每秒/摇了)', /已送出/.test(exact) && /果钱/.test(exact) && /每秒/.test(exact) && /摇了/.test(exact), JSON.stringify(exact));
check('设置里有静音提示与存档/主屏幕提示', /静音拨片/.test(await text('#soundNote')) && /主屏幕/.test(await text('#installNote')));
await click('#btnCloseSettings'); await sleep(300);

// 买单位
await dbgBtn('+10亿果钱'); await sleep(400);
const u0 = await num('g.state.source.units[0]'); const rv0 = await num('g.state.route.units[0]');
await click('#btnSrcBuy'); await click('#btnRtBuy'); await sleep(300);
check('买 +1 生产单位', (await num('g.state.source.units[0]')) === u0 + 1, `(${u0}→${await num('g.state.source.units[0]')})`);
check('买 +1 运输单位', (await num('g.state.route.units[0]')) === rv0 + 1, `(${rv0}→${await num('g.state.route.units[0]')})`);
check('按钮显示价格与预览', /\S/.test(await text('#btnSrcBuy .pr')) && /\S/.test(await text('#btnSrcBuy .nm')), `(${await text('#btnSrcBuy .nm')} / ${await text('#btnSrcBuy .pr')} / ${await text('#btnSrcBuy .pv')})`);

// 升档 → 分支选择
await click('#btnSrcUp'); await sleep(300);
check('升档打开分支选择', (await ev('!document.getElementById("branchPick").hidden')) === true);
info('分支卡', `${await text('#branch0')} || ${await text('#branch1')}`);
await click('#branch0'); await sleep(400);
check('选分支后升档生效', (await num('g.state.source.tier')) === 1 && (await ev('document.getElementById("branchPick").hidden')) === true, `(tier ${await num('g.state.source.tier')}, branch ${await G('JSON.stringify(g.state.source.branch)')})`);
await click('#btnRtUp'); await sleep(300); await click('#branch1'); await sleep(400);
check('运输线也能升档', (await num('g.state.route.tier')) === 1, `(tier ${await num('g.state.route.tier')})`);

// 存档/刷新
const snap = await G('JSON.stringify([g.state.source.units,g.state.route.units,g.state.source.tier,g.state.route.tier])');
await ev('dispatchEvent(new Event("pagehide"))');
await send('Page.navigate', { url: BASE + '?speed=60' }); await sleep(900);
const snap2 = await G('JSON.stringify([g.state.source.units,g.state.route.units,g.state.source.tier,g.state.route.tier])');
check('刷新后进度保留', snap === snap2, snap === snap2 ? '' : `\n  ${snap}\n  ${snap2}`);

// 中期截图:加钱 +1小时
await dbgBtn('+10亿果钱'); await dbgBtn('+1小时'); await sleep(900);
await shot('land_mid');
check('中期画面无报错', errors.length === 0, errors.slice(0, 2).join(' | '));
await view(390, 844); await sleep(500); await shot('port_mid'); await view(844, 390);

// 键盘 Space
await open('?debug=1');
const c1 = await num('g.state.shakes');
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ' });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space' });
await sleep(150);
check('空格 = 摇一下', (await num('g.state.shakes')) === c1 + 1, `(${c1} → ${await num('g.state.shakes')})`);

// ───────── 2a. 扩建 / 单位满档 / 小字 ─────────
await view(844, 390); await open('?debug=1');
await G('(g.state.source.units[0]=4, g.state.coins=1e6, 0)'); await sleep(700);
check('单位够数后买卡变"加固"并可点', /加固/.test(await text('#btnSrcBuy .nm')), `(${await text('#btnSrcBuy .nm')} / ${await text('#btnSrcBuy .pr')})`);
const ext0 = await num('g.state.source.ext[0]');
await click('#btnSrcBuy'); await sleep(400);
check('点它买到一次扩建', (await num('g.state.source.ext[0]')) === ext0 + 1 && !/加固/.test(await text('#btnSrcBuy .nm')), `(ext ${ext0}→${await num('g.state.source.ext[0]')}, ${await text('#btnSrcBuy .nm')})`);
await G('(g.state.source.units[0]=12, g.state.source.ext[0]=3, 0)'); await sleep(700);
check('单位满档且扩建买完:显示已满且不可点', /已满/.test(await text('#btnSrcBuy .nm')) && (await ev('document.getElementById("btnSrcBuy").disabled')) === true, `(${await text('#btnSrcBuy .nm')})`);
{
  const pv = await text('#btnRtBuy .pv');
  check('小字不再有"暂时用不上/约N分钟/送达"', !/暂时用不上|约\d|送达/.test(pv + (await text('#btnSrcUp .pv')) + (await text('#btnRtUp .pv'))), `(${pv})`);
}
await shot('land_expand');

// ───────── 2b. 摇一摇 / 清单 / 久别提示 ─────────
check('有 manifest 与 apple-touch-icon 链接', (await ev('!!document.querySelector("link[rel=manifest]")&&!!document.querySelector("link[rel=apple-touch-icon]")')) === true);
await view(1280, 800); await open('?debug=1');
check('桌面(无触控/传感器):摇一摇开关隐藏', (await ev('document.getElementById("btnMotion").hidden')) === true);
await view(390, 844); await open('?debug=1');
check('手机:摇一摇开关出现,默认关', (await ev('!document.getElementById("btnMotion").hidden')) === true && /关/.test(await text('#btnMotion')), `(${await text('#btnMotion')})`);
await openSettings(); await sleep(200); await click('#btnMotion'); await sleep(300);
check('点开后显示"开"并写入 localStorage', /开/.test(await text('#btnMotion')) && (await ev('localStorage.getItem("shake-the-apple.motion")')) === '1', `(${await text('#btnMotion')})`);
await click('#btnCloseSettings'); await sleep(300);
{
  const m0 = await num('g.state.shakes');
  // 真机约 60Hz:先静止几个样本,再 ±22 m/s² 交替(每半周期 4 个样本,共 6 个半周期)
  await ev(`(async()=>{const f=(x)=>dispatchEvent(Object.assign(new Event('devicemotion'),{acceleration:{x,y:0,z:0},accelerationIncludingGravity:{x,y:0,z:9.8},interval:16}));
    for(let i=0;i<3;i++){f(0);await new Promise(r=>setTimeout(r,16))}
    for(let h=0;h<6;h++)for(let i=0;i<4;i++){f(h%2?-22:22);await new Promise(r=>setTimeout(r,16))}})()`);
  await sleep(500);
  const m1 = await num('g.state.shakes');
  check('手机摇一摇 = 摇树(约 3 下)', m1 - m0 >= 2 && m1 - m0 <= 6, `(${m0} → ${m1})`);
  check('摇动无报错', errors.length === 0, errors.slice(0, 2).join(' | '));
}
// 久别 ≥3 天:回来 toast 一次
await view(844, 390); await open('?debug=1');
await ev('dispatchEvent(new Event("pagehide"))');
{ // 在空白页里改存档的 lastSeen(在游戏页里改会被 pagehide 覆盖)
  const raw = await ev('localStorage.getItem("shake-the-apple.save")');
  const w = JSON.parse(raw); const b = JSON.parse(w.body); b.lastSeen = Date.now() - 4 * 86400000;
  w.body = JSON.stringify(b);
  let h = 0x811c9dc5; for (let i = 0; i < w.body.length; i++) { h ^= w.body.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  w.sum = h.toString(16);
  await send('Page.navigate', { url: 'file://' + blank }); await sleep(250);
  await ev(`localStorage.setItem("shake-the-apple.save", ${JSON.stringify(JSON.stringify(w))})`);
  await send('Page.navigate', { url: BASE + '?debug=1' }); await sleep(900);
}
let seen3 = '';
for (let i = 0; i < 12 && !/主屏幕/.test(seen3); i++) { await sleep(700); seen3 = await ev('document.getElementById("toast").textContent'); }
check('隔 ≥3 天回来提示导出/主屏幕(排在欢迎回来之后)', /主屏幕/.test(seen3), `(${seen3})`);

// ───────── 3. ×3600 推进 ─────────
await open('?speed=3600');
await dbgBtn('+10亿果钱');
const t0 = await num('g.state.playSec');
await sleep(3000);
const t1 = await num('g.state.playSec');
check('×3600 游戏时间快速推进', t1 - t0 > 3 * 3600 * 0.5, `(+${Math.round(t1 - t0)}s 游戏时间)`);
check('×3600 无报错', errors.length === 0, errors.slice(0, 2).join(' | '));

// ───────── 3b. 果城档(第 3 档)与深色截图 ─────────
await view(844, 390); await open('?debug=1');
await G('(g.state.source.tier=3, g.state.route.tier=3, g.state.source.units[3]=6, g.state.route.units[3]=6, g.state.delivered=3e8, g.state.coins=1e12, 0)'); await sleep(1500);
await shot('land_city');
check('果城档无报错', errors.length === 0, errors.join(' | '));

// ───────── 4. 结局与 SEALED ─────────
for (const [date, sealed] of [['2026-12-23', true], ['2026-12-24', false]]) {
  await open(`?debug=1&date=${date}`);
  await G('(g.state.delivered = g.GOAL + 1, 0)');
  await sleep(1500);
  const has = await ev('!!document.getElementById("ending")');
  check(`${date} 达成目标后出现结局`, has === true);
  await click('#btnGift'); await sleep(400);
  check(`${date} 结局「礼物盒」按钮打开礼物页`, (await ev('!!document.querySelector("#panel-gift, .panel-gift-sheet")')) === true);
  await ev('document.querySelector(".panel-x")?.click()');
  const seal = await ev('!!document.getElementById("sealed")');
  check(`${date} ${sealed ? '显示 SEALED' : '不显示 SEALED'}`, seal === sealed, `(sealed=${seal})`);
  if (date === '2026-12-23') {
    await sleep(1300);
    const lay = await J(`(()=>{const r=e=>{const b=document.querySelector(e).getBoundingClientRect();return {t:b.top,b:b.bottom,l:b.left,r:b.right}};return {keep:r('#endKeep'),rs:r('#endRestart'),sealed:r('#sealed'),right:r('#ending .r'),ih:innerHeight,iw:innerWidth}})()`);
    check('结局(844×390):按钮离底边 ≥12px、不被裁', lay.keep.b <= lay.ih - 12 && lay.rs.b <= lay.ih - 12, `(keep.b ${Math.round(lay.keep.b)} / ih ${lay.ih})`);
    check('结局:SEALED 盒子在文字列里、不单占一栏', lay.sealed.l >= lay.right.l - 1 && lay.sealed.r <= lay.right.r + 1, `(sealed ${Math.round(lay.sealed.l)}-${Math.round(lay.sealed.r)} / r ${Math.round(lay.right.l)}-${Math.round(lay.right.r)})`);
  }
  if (date === '2026-12-23') { await shot('land_ending'); await view(390, 844); await sleep(300); await shot('port_ending'); await view(844, 390); }
  if (has) { await click('#endKeep'); await sleep(400); check(`${date} 关闭结局后继续游戏`, (await ev('!document.getElementById("ending")')) === true); }
}
check('全程无控制台报错', errors.length === 0, errors.join(' | '));

ws.close(); chrome.kill();
console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
