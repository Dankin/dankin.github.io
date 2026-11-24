// QA 公共库(无依赖):静态服务 + Chrome(CDP) 封装。用法见同目录各脚本。
// 环境变量:QA_DIST(默认 /tmp/qa-dist,由 `npx vite build --outDir /tmp/qa-dist` 生成,避免和别人的 dist 构建互相覆盖)、CHROME。
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';

export const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const DIST = resolve(process.env.QA_DIST || '/tmp/qa-dist');
export const SHOTS = resolve('qa/shots');
if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const VIEWS = { land: [844, 390], port: [390, 844], desk: [1280, 800] };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

export function serve(dist = DIST) {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    if (p === '/blank.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('blank'); }
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    try { const b = readFileSync(join(dist, p)); res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(b); }
    catch { res.writeHead(404); res.end('nf'); }
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, base: `http://127.0.0.1:${srv.address().port}/` })));
}

let portSeq = 9400 + Math.floor(Math.random() * 400);
export async function launchBrowser({ base, headless = true } = {}) {
  const port = portSeq++;
  const dir = mkdtempSync(join(tmpdir(), 'qa-'));
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, headless ? '--headless=new' : '', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required', 'about:blank'].filter(Boolean), { stdio: 'ignore' });
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); wsUrl = l.find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) throw new Error('chrome not reachable');
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  const logs = []; // {type:'error'|'warn'|'exception'|'log-error'|'crash', text, t}
  const events = new Map();
  const t0 = Date.now();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
    const p = d.params;
    if (d.method === 'Runtime.exceptionThrown') logs.push({ type: 'exception', text: p.exceptionDetails.exception?.description ?? p.exceptionDetails.text, t: Date.now() - t0 });
    else if (d.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning')) logs.push({ type: p.type === 'error' ? 'error' : 'warn', text: p.args.map((a) => a.value ?? a.description ?? '').join(' '), t: Date.now() - t0 });
    else if (d.method === 'Log.entryAdded' && (p.entry.level === 'error' || p.entry.level === 'warning')) logs.push({ type: 'log-' + p.entry.level, text: `${p.entry.text} ${p.entry.url ?? ''}`, t: Date.now() - t0 });
    else if (d.method === 'Inspector.targetCrashed') logs.push({ type: 'crash', text: 'renderer crashed', t: Date.now() - t0 });
    events.get(d.method)?.(p);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; const to = setTimeout(() => { pending.delete(i); rej(new Error('CDP timeout ' + method)); }, 60000); pending.set(i, (x) => { clearTimeout(to); res(x); }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text }; return r.result?.result?.value; };
  const J = async (expr) => { const v = await ev(`JSON.stringify(${expr})`); return typeof v === 'string' ? JSON.parse(v) : v; };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable'); await send('Inspector.enable').catch(() => {});
  const b = {
    send, ev, J, logs, on: (n, f) => events.set(n, f), base,
    errors: () => logs.filter((l) => l.type !== 'warn' && l.type !== 'log-warning'),
    async view(w, h, { dpr = 1, mobile = w < 600 } = {}) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
      await sleep(100);
    },
    async cpu(rate) { await send('Emulation.setCPUThrottlingRate', { rate }); },
    async tz(id) { await send('Emulation.setTimezoneOverride', { timezoneId: id }); },
    async preload(src) { return (await send('Page.addScriptToEvaluateOnNewDocument', { source: src })).result.identifier; },
    async unpreload(identifier) { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier }); },
    /** 打开游戏。fresh=true 先在 about:blank 同源外清掉存档(同源 localStorage 需要先到该 origin 的空白页) */
    async open(query = '', { fresh = true, wait = 900 } = {}) {
      if (fresh) { await send('Page.navigate', { url: base + 'blank.txt' }); await sleep(200); await ev('localStorage.clear()'); }
      await send('Page.navigate', { url: base + query });
      await sleep(wait);
    },
    async reloadTo(query, wait = 900) { await send('Page.navigate', { url: base + query }); await sleep(wait); },
    async blank() { await send('Page.navigate', { url: base + 'blank.txt' }); await sleep(250); },
    async shot(name, { full = false } = {}) {
      await sleep(250);
      const r = await send('Page.captureScreenshot', { format: 'png' });
      const f = join(SHOTS, name + '.png'); writeFileSync(f, Buffer.from(r.result.data, 'base64')); return f;
    },
    G: (expr) => ev(`(()=>{const g=window.__game;return ${expr}})()`),
    text: (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent`),
    click: (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'NOEL';e.click();return 'ok'})()`),
    async mouse(x, y, n = 1) { for (let i = 0; i < n; i++) { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); await sleep(40); } },
    stageRect: () => J('(()=>{const b=document.getElementById("stage").getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height}})()'),
    async tapStage(fx = 0.14, fy = 0.5, n = 1) { const r = await b.stageRect(); await b.mouse(r.x + r.w * fx, r.y + r.h * fy, n); },
    dbg: (label) => ev(`(()=>{const e=[...document.querySelectorAll('#debug button')].find(b=>b.textContent==='${label}');if(!e)return 'NOBTN';e.click();return 'ok'})()`),
    close() { try { ws.close(); } catch {} chrome.kill(); },
  };
  return b;
}

export function makeReporter(title) {
  const rows = []; let failed = 0;
  return {
    rows,
    check(name, ok, extra = '') { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); rows.push({ k: 'check', name, ok, extra }); if (!ok) failed++; },
    info(name, extra = '') { console.log(`INFO ${name} ${extra}`); rows.push({ k: 'info', name, extra }); },
    get failed() { return failed; },
    save(file) { writeFileSync(file, JSON.stringify({ title, at: new Date().toISOString(), rows }, null, 1)); },
  };
}

/** 改存档 body 并重算校验和(游戏用 FNV-1a)。fn(body) 就地修改,返回 wrapper 文本 */
export const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
export const wrapSave = (body) => { const s = JSON.stringify(body); return JSON.stringify({ sum: fnv(s), body: s }); };
