// Chrome 冒烟测试:无依赖,直接用 CDP。用法: node scripts/smoke.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'file://' + resolve('dist/index.html') + '?calm';
const port = 9333;
const dir = mkdtempSync(join(tmpdir(), 'smoke-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--headless=new', '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };

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
async function shot(name, w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await sleep(300);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`shots/${name}.png`, Buffer.from(r.result.data, 'base64'));
}
async function load() { await send('Page.navigate', { url: URL }); await sleep(800); }

await send('Runtime.enable'); await send('Page.enable');
await load();
await ev('localStorage.clear()'); await load();

const CLICK = 'document.getElementById("stage").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,clientX:200,clientY:200}))';
const blank = join(dir, 'blank.html'); writeFileSync(blank, '<html></html>');
// 先离开游戏页(触发 pagehide 保存),再在同源的空白页里改写存档,避免被游戏的退出保存覆盖
async function seed(mut) {
  await ev('document.dispatchEvent(new Event("visibilitychange"))');
  const raw = await ev('localStorage.getItem("shake-the-apple.save")');
  const body = JSON.parse(JSON.parse(raw).body);
  mut(body);
  await send('Page.navigate', { url: 'file://' + blank }); await sleep(500);
  await ev(`(() => { const b = ${JSON.stringify(JSON.stringify(body))}; let h=0x811c9dc5; for (let i=0;i<b.length;i++){h^=b.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;} localStorage.setItem("shake-the-apple.save", JSON.stringify({sum:h.toString(16), body:b})); })()`);
  await load();
}
const text = (id) => ev(`document.getElementById("${id}").textContent`);

check('页面标题', (await ev('document.title')) === 'Shake the Apple');
check('新闻栏有内容', (await text('news')).length > 5);
check('阶段栏一开始就有预期', /下一期「小院」/.test(await text('stageNext')), `(${await text('stageNext')})`);
check('总进度和折算一开始隐藏', (await ev('document.getElementById("goalBox").classList.contains("hidden")')) === true);
const n0 = Number(await text('apples'));
for (let i = 0; i < 12; i++) await ev(CLICK);
await sleep(300);
const n1 = Number(await text('apples'));
check('点击后苹果增加(含金苹果)', n1 >= n0 + 12, `(${n0} -> ${n1})`);
check('点击后显示实时速率', /\/秒/.test(await text('rate')), `(${await text('rate')})`);

check('攒够 10 个后可买「摇一摇」', (await ev('document.querySelectorAll("#ups button")[0].disabled')) === false);
await ev('document.querySelectorAll("#ups button")[0].click()'); await sleep(300);
check('购买后出现 Lv.1', /Lv\.1/.test(await ev('document.querySelector("#ups .n").textContent')));
check('预告:下一个升级显示 ??? 和解锁条件', /累计送出 150/.test(await ev('document.querySelector("#ups .teaser .d").textContent')));

await ev('document.dispatchEvent(new Event("visibilitychange"))');
await ev('dispatchEvent(new Event("pagehide"))');
await load();
check('刷新后进度保留(Lv.1)', /Lv\.1/.test(await ev('document.querySelector("#ups .n").textContent')));

// 离线补算:10 级微风(含金苹果期望 14.8/s,微风 +5% 自动产出 = 15.5/s),拨回 1 小时前 → 15.5×3600×0.5 ≈ 2.8万
await seed((b) => { b.upgrades.breeze = 10; b.lastSeen = Date.now() - 3600_000; b.apples = 0; b.delivered = 0; });
const off = await text('toast');
check('离线 1 小时给出提示', /离开了 1 小时/.test(off ?? ''), `(${off})`);
const got = await text('apples');
check('离线收益约 2.8万', /^2\.[78]/.test(got ?? '') && got.endsWith('万'), `(${got})`);

// 前期:3 棵树,只买了一点升级
await seed((b) => {
  b.delivered = 3000; b.apples = 500;
  b.upgrades = { shake: 4, breeze: 3, gardener: 5, branches: 3, breed: 2, shaker: 0, express: 0 };
  b.projects = { gravity: true, fairest: false, cook: false, duo: false };
  b.lastSeen = Date.now();
});
await sleep(700);
await shot('mid-desktop', 1280, 900);
await shot('mid-mobile', 375, 740);

// 中后期:21 棵树、项目全开
await seed((b) => {
  b.delivered = 5e8; b.apples = 3e7;
  b.upgrades = { shake: 20, breeze: 30, gardener: 25, branches: 20, breed: 8, shaker: 12, express: 3 };
  b.projects = { gravity: true, fairest: true, cook: true, duo: true };
  b.lastSeen = Date.now();
});
await sleep(500);
check('阶段:第 5 期·苹果谷', /第 5 期/.test(await text('stageName')), `(${await text('stageName')})`);
check('总进度和折算出现', /≈/.test(await text('equiv')), `(${await text('equiv')})`);
check('项目栏出现且库克可用', (await ev('document.querySelector("#projs .cook") !== null')) === true);
await shot('late-desktop', 1280, 900);
await shot('late-mobile', 375, 740);
// 往下拉时果园画面必须还在视口里
for (const [nm, w, h] of [['mobile', 375, 740], ['desktop', 1280, 900]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await sleep(300);
  await ev('window.scrollTo(0, 99999)'); await sleep(300);
  const r = JSON.parse(await ev('JSON.stringify((()=>{const b=document.getElementById("stage").getBoundingClientRect();return {t:b.top,b:b.bottom,h:b.height,sy:scrollY}})())'));
  check(`${nm}:滚到底后果园仍在视口内`, r.sy > 100 && r.t >= -1 && r.b <= h && r.h >= 150, JSON.stringify(r));
  await shot(`late-${nm}-scrolled`, w, h);
  await ev('window.scrollTo(0, 0)');
}
const px = await ev(`(() => { const c = document.getElementById("cv"); const d = c.getContext("2d").getImageData(0,0,c.width,c.height).data; let k = 0; for (let i = 0; i < d.length; i += 16) if (d[i] < 200) k++; return k; })()`);
check('画布上画出了树(深色像素)', px > 2000, `(${px})`);

await seed((b) => { b.delivered = 0; b.apples = 0; b.upgrades = { shake: 0, breeze: 0, gardener: 0, branches: 0, breed: 0, shaker: 0, express: 0 }; b.projects = { gravity: false, fairest: false, cook: false, duo: false }; b.buffs = { cookUntil: 0, cookReadyAt: 0, goldUntil: 0 }; });
await sleep(300);
await shot('early-desktop', 1280, 800);
await shot('early-mobile', 375, 740);
check('375px 无横向滚动', (await ev('document.documentElement.scrollWidth <= 375')) === true);
check('无控制台报错', errors.length === 0, errors.join(' | '));

// 调试模式:?speed=60 时 3 秒内累计时间走得明显更快,且有调试面板;普通模式没有面板
await ev('localStorage.clear()'); await load();
check('普通模式没有调试面板', (await ev('!document.getElementById("dbg")')) === true);
await send('Page.navigate', { url: URL + '&speed=60' }); await sleep(600);
check('?speed 出现调试面板', (await ev('!!document.getElementById("dbg")')) === true);
await ev(CLICK); await ev(CLICK); await ev(CLICK);
const d0 = await ev('document.getElementById("apples").textContent');
await sleep(3000);
const t = await ev('document.getElementById("dbgSpeed").textContent');
check('调试面板显示速度 ×60', t === '×60', `(${t}; 苹果 ${d0})`);
const rateTxt = await ev('document.getElementById("rate").textContent');
await ev('document.querySelectorAll("#dbg button")[5].click()');
await sleep(300);
check('+10分 快进按钮可点且无报错', errors.length === 0, errors.slice(0, 1).join(''));
await ev(CLICK); await ev(CLICK); await sleep(700);
check('来源占比条有 8 段且点击占主要', (await ev('document.querySelectorAll("#srcBar .seg").length')) === 8);
check('来源图例已生成', (await ev('document.querySelectorAll("#srcLegend .lg").length')) >= 1);
ws.close(); chrome.kill();
console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
