// v6 截图工具(CDP,无依赖):node scripts/v6shot.mjs '<scenarios json>' [land|port]
// 场景:{name, q?, js?, wait?, click?:[x,y]};BASE 默认 dev server http://127.0.0.1:5199/,可设 BASE=file://.../dist/index.html
// 页面带 ?debug=1,可用 window.__game 改状态。输出 shots/v6/<name>_<land|port>.png
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:5199/';
const OUT = process.env.OUT || 'shots/v6';
const port = 9400 + Math.floor(Math.random() * 300);
const dir = mkdtempSync(join(tmpdir(), 'v6shot-'));
mkdirSync(OUT, { recursive: true });
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--headless=new', '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) errors.push('eval: ' + (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text)); return r.result?.result?.value; };
const blank = join(dir, 'blank.html'); writeFileSync(blank, '<html><body>blank</body></html>');
await send('Page.enable'); await send('Runtime.enable');
const scen = JSON.parse(process.argv[2] || '[]');
const only = process.argv[3];
for (const [vn, w, h] of [['land', 844, 390], ['port', 390, 844]]) {
  if (only && only !== vn) continue;
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await send('Emulation.setTouchEmulationEnabled', { enabled: w < 600 });
  for (const sc of scen) {
    await send('Page.navigate', { url: 'file://' + blank }); await sleep(100);
    await ev(`localStorage.clear()`);
    if (sc.pre) { await send('Page.navigate', { url: BASE + '?debug=1' }); await sleep(700); await ev(sc.pre); await sleep(300); }
    await send('Page.navigate', { url: BASE + '?debug=1' + (sc.q || '') });
    await sleep(sc.boot ?? 1200);
    if (sc.js) { const r = await ev(sc.js); if (r !== undefined) console.log(sc.name, vn, 'js→', JSON.stringify(r)); await sleep(sc.wait ?? 1200); }
    if (sc.click) {
      for (const [x, y] of sc.click) {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
        await sleep(sc.clickWait ?? 400);
      }
    }
    if (sc.js2) { const r = await ev(sc.js2); if (r !== undefined) console.log(sc.name, vn, 'js2→', JSON.stringify(r)); await sleep(sc.wait2 ?? 700); }
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${OUT}/${sc.name}_${vn}.png`, Buffer.from(r.result.data, 'base64'));
  }
}
console.log('errors', JSON.stringify(errors.slice(0, 6)));
try { chrome.kill(); } catch {}
process.exit(0);
