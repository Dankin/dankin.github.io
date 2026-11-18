// 一个浏览器会话：启动、错误收集、真实鼠标/触屏输入、等待、截图、性能采样
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadPlaywright, CHROME, BASE_URL } from './pw.mjs';

export const OUT_ROOT = new URL('../out/', import.meta.url).pathname;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 设备预设 */
export const DEVICES = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  'desktop-small': { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 },
  'desktop-hd': { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  // 手机横屏 844×390（iPhone 12~14 视口），触屏 + 2x
  phone: {
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  'phone-small': { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  'phone-portrait': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  tablet: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  // 低性能：桌面 960×540 + CPU 4x 降速
  lowend: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, cpuThrottle: 4 },
};

const HMR_STUB = `export function createHotContext(){return {data:{},accept(){},acceptExports(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){}}}
export function updateStyle(){} export function removeStyle(){} export function injectQuery(u){return u}
export class ErrorOverlay{}`;
const IGNORED_ERR = [/favicon/i];

export class Session {
  constructor(opts = {}) {
    this.opts = opts;
    this.device = opts.device ?? 'desktop';
    this.name = opts.name ?? this.device;
    this.outDir = opts.outDir ?? join(OUT_ROOT, 'adhoc');
    this.errors = []; this.warnings = []; this.dataWarnings = []; this.logs = []; this.shots = [];
    this.allowErr = [...IGNORED_ERR, ...(opts.allowErrors ?? [])];
    this.touchMode = !!DEVICES[this.device]?.hasTouch;
  }

  static async launch(opts = {}) { const s = new Session(opts); await s.init(); return s; }

  async init() {
    const { chromium } = await loadPlaywright();
    const dev = DEVICES[this.device] ?? DEVICES.desktop;
    this.browser = await chromium.launch({
      executablePath: CHROME, headless: this.opts.headless ?? true,
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', ...(this.opts.args ?? [])],
    });
    const { cpuThrottle, ...ctxOpts } = dev;
    this.ctx = await this.browser.newContext({ ...ctxOpts, ...(this.opts.context ?? {}) });
    this.page = await this.ctx.newPage();
    this.cdp = await this.ctx.newCDPSession(this.page);
    if (cpuThrottle || this.opts.cpuThrottle) await this.cdp.send('Emulation.setCPUThrottlingRate', { rate: this.opts.cpuThrottle ?? cpuThrottle });
    const p = this.page;
    p.on('console', (m) => {
      const txt = m.text(); const type = m.type();
      if (type === 'error') { if (!this.allowErr.some((r) => r.test(txt))) this.errors.push({ kind: 'console.error', text: txt, at: this.elapsed() }); }
      else if (type === 'warning') {
        if (txt.includes('[data]')) this.dataWarnings.push(txt); else this.warnings.push(txt);
      } else if (this.opts.verbose) this.logs.push(txt);
    });
    p.on('pageerror', (e) => this.errors.push({ kind: 'pageerror', text: e.message + (e.stack ? '\n' + e.stack.split('\n').slice(0, 4).join('\n') : ''), at: this.elapsed() }));
    p.on('requestfailed', (r) => { const u = r.url(); if ((r.failure()?.errorText ?? '').includes('ERR_ABORTED')) return; /* vite 依赖预构建/导航中止，非缺陷 */ if (!this.allowErr.some((x) => x.test(u))) this.errors.push({ kind: 'requestfailed', text: u + ' ' + (r.failure()?.errorText ?? ''), at: this.elapsed() }); });
    p.on('response', (r) => { if (r.status() >= 400 && !this.allowErr.some((x) => x.test(r.url()))) this.errors.push({ kind: 'http' + r.status(), text: r.url(), at: this.elapsed() }); });
    p.on('crash', () => this.errors.push({ kind: 'crash', text: 'page crashed', at: this.elapsed() }));
    // 冻结 Vite HMR：其他成员改源码会让 dev server 推送整页刷新，打断测试。默认用空壳替换 /@vite/client
    if (this.opts.hmr !== true) {
      await this.ctx.route('**/@vite/client', (route) => route.fulfill({ contentType: 'text/javascript', body: HMR_STUB }));
    }
    this.navCount = 0;
    p.on('framenavigated', (f) => { if (f === p.mainFrame()) { this.navCount++; if (this.navCount > 1 && !this.expectNav) this.warnings.push('页面发生了意外导航/刷新 #' + this.navCount + ' @' + this.elapsed()); } });
    this.t0 = Date.now();
    mkdirSync(this.outDir, { recursive: true });
    return this;
  }
  elapsed() { return Math.round((Date.now() - (this.t0 ?? Date.now())) / 100) / 10; }

  /** 打开游戏。fresh=true 清空存档（只在本会话首次导航清，刷新保留存档） */
  async goto({ fresh = true, query = '', waitScene = true, timeout = 30000 } = {}) {
    if (fresh) await this.page.addInitScript(() => { try { if (!sessionStorage.getItem('__qa_init')) { localStorage.clear(); sessionStorage.setItem('__qa_init', '1'); } } catch {} });
    const url = `${BASE_URL}/?debug=1${query ? '&' + query.replace(/^[?&]/, '') : ''}`;
    this.url = url;
    await this.page.goto(url, { waitUntil: 'load', timeout });
    if (waitScene) await this.waitSceneReady(timeout);
    return this;
  }
  async reload({ fresh = false } = {}) {
    this.expectNav = true;
    await this.page.reload({ waitUntil: 'load' });
    this.expectNav = false;
    await this.waitSceneReady();
  }

  async waitSceneReady(timeout = 30000) {
    await this.page.waitForFunction(() => { const g = window.__game; const s = g && g.scene && g.scene.getScene('game'); return !!(s && s.hud && s.hat && s.sys && s.sys.isActive()); }, null, { timeout, polling: 100 });
    await this.ensureApi();
  }
  /** 确保 window.__qa 存在（dev-core 未接入时，从 dev server 动态加载 testApi.ts） */
  async ensureApi() {
    const has = await this.page.evaluate(() => !!window.__qa);
    if (!has) {
      await this.page.evaluate(async () => { const m = await import('/src/debug/testApi.ts'); m.installTestApi(window.__game); });
    }
  }

  // ————— 调用 / 状态 —————
  /** 调用 window.__qa[fn](...args) */
  async qa(fn, ...args) { return this.page.evaluate(([f, a]) => { const r = window.__qa[f](...a); return r; }, [fn, args]); }
  async state() { return this.qa('state'); }
  async resources() { return this.qa('resources'); }

  /** 等待条件。pred 为 (state)=>bool 的函数或表达式字符串，轮询 window.__qa.state() */
  async waitState(pred, { timeout = 15000, msg = 'waitState', polling = 100 } = {}) {
    const src = typeof pred === 'function' ? pred.toString() : pred;
    try {
      await this.page.waitForFunction((s) => { const st = window.__qa.state(); return (0, eval)('(' + s + ')')(st); }, src, { timeout, polling });
    } catch (e) {
      const st = await this.state().catch(() => null);
      throw new Error(`${msg} 超时(${timeout}ms): ${src}\n当前状态: ${JSON.stringify(st && { now: st.now, hat: st.hat, panelOpen: st.panelOpen, locked: st.locked, warmth: st.warmth, region: st.region, stories: st.stories })}`);
    }
  }
  /** 等待页面内函数/表达式为真 */
  async waitFn(fn, arg, { timeout = 15000, polling = 100 } = {}) { return this.page.waitForFunction(fn, arg, { timeout, polling }); }

  waitStep(storyId, stepId, o = {}) { return this.waitState(`s=>s.stories[${JSON.stringify(storyId)}]?.done.includes(${JSON.stringify(stepId)})`, { msg: `故事 ${storyId} 步骤 ${stepId}`, ...o }); }
  waitStoryDone(storyId, o = {}) { return this.waitState(`s=>s.stories[${JSON.stringify(storyId)}]?.finished`, { msg: `故事 ${storyId} 完成`, timeout: 60000, ...o }); }
  waitNpcState(npc, st, o = {}) { const list = [].concat(st); return this.waitState(`s=>${JSON.stringify(list)}.includes(s.npcs[${JSON.stringify(npc)}]?.state)`, { msg: `NPC ${npc} → ${list}`, ...o }); }
  waitWarmth(min, o = {}) { return this.waitState(`s=>s.warmth>=${min}`, { msg: `暖度≥${min}`, ...o }); }
  waitIdle(o = {}) { return this.waitState('s=>!s.locked && !s.seqRunning', { msg: '等待演出结束', timeout: 60000, ...o }); }
  waitRegion(id, o = {}) { return this.waitState(`s=>s.region===${JSON.stringify(id)}`, { msg: `进入区域 ${id}`, ...o }); }
  waitPanel(open = true, o = {}) { return this.waitState(`s=>s.panelOpen===${open}`, { msg: `面板 ${open ? '打开' : '关闭'}`, ...o }); }

  // ————— 鼠标（桌面） —————
  async mouseClick(x, y, { delay = 40 } = {}) {
    if (this.touchMode && this.opts.touchAsMouse !== true) return this.tap(x, y);
    await this.page.mouse.move(x, y, { steps: 2 });
    await this.page.mouse.down(); await sleep(delay); await this.page.mouse.up();
  }
  async hover(x, y) { await this.page.mouse.move(x, y, { steps: 3 }); }

  /** 开始游戏：点标题屏按钮（真实点击）。mode: 'new'（新游戏/唯一按钮）| 'continue'（有存档时点“继续”）。*/
  async start({ timeout = 8000, mode = 'new' } = {}) {
    const vp = this.page.viewportSize();
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const st = await this.state();
      if (st.started) break;
      // 标题按钮：depth≥1001 且不是底部“导入存档”小按钮；有两个时左=继续、右=新游戏
      const btn = await this.page.evaluate((mode) => {
        const b = window.__qa.uiButtons().filter((x) => x.depth >= 1001 && x.gw > 120 && x.gy0 < 600).sort((p, q) => p.x - q.x);
        if (!b.length) return null;
        const pick = b.length >= 2 ? (mode === 'continue' ? b[0] : b[b.length - 1]) : b[0];
        return { x: pick.x, y: pick.y };
      }, mode);
      await this.mouseClick(btn?.x ?? vp.width / 2, btn?.y ?? vp.height / 2);
      await sleep(500);
    }
    await this.waitState('s=>s.started', { timeout: 3000, msg: '开始游戏' });
    await sleep(700);
  }

  /** 点物件（真实鼠标/触屏）。返回点击的页面坐标 */
  async clickProp(id, { offsetY = 0 } = {}) {
    let p = await this.qa('propPoint', id);
    if (!p) throw new Error('未知物件 ' + id);
    if (!p.onScreen) throw new Error(`物件 ${id} 不在屏幕内（帽子离得太远，先飞过去）`);
    // 被 UI（招式面板等）盖住时：先在物件身上找一个没被盖的点；找不到就点空地关掉面板
    let hits = await this.qa('uiHitAt', p.x, p.y + offsetY);
    if (hits.length) {
      this.coveredClicks = (this.coveredClicks ?? 0) + 1;
      let free = null;
      for (const k of [-0.45, 0.45, -0.3, 0.3, 0]) {
        for (const kx of [0, -0.4, 0.4]) {
          const x = p.x + kx * p.w, y = p.y + k * p.h;
          if (!(await this.qa('uiHitAt', x, y)).length) { free = { x, y }; break; }
        }
        if (free) break;
      }
      if (free) { await this.mouseClick(free.x, free.y); return { ...p, ...free, viaFreeSpot: true }; }
      await this.dismissPanel();
      p = await this.qa('propPoint', id);
    }
    await this.mouseClick(p.x, p.y + offsetY);
    return p;
  }
  /** 点一个没有 UI/物件的地面点来关闭招式面板（会让帽子飞过去） */
  async dismissPanel() {
    const vp = this.page.viewportSize();
    for (const [fx, fy] of [[0.12, 0.85], [0.85, 0.85], [0.5, 0.9], [0.5, 0.2]]) {
      const x = vp.width * fx, y = vp.height * fy;
      if ((await this.qa('uiHitAt', x, y)).length) continue;
      await this.mouseClick(x, y);
      await this.waitState('s=>!s.panelOpen', { timeout: 4000, msg: '关闭面板' }).catch(() => {});
      await this.waitState('s=>!s.hat.moving', { timeout: 8000 }).catch(() => {});
      return;
    }
  }
  async clickNpc(id) { const p = await this.qa('npcPoint', id); if (!p?.onScreen) throw new Error(`NPC ${id} 不在屏幕内`); await this.mouseClick(p.x, p.y); return p; }
  async clickTile(tx, ty) { const p = await this.qa('groundPoint', tx, ty); if (!p.onScreen) throw new Error(`瓦片 (${tx},${ty}) 不在屏幕内`); await this.mouseClick(p.x, p.y); return p; }
  /** 点地面飞过去，直到帽子到达（真实点击；目标不在屏幕内时先朝屏幕边缘分段点击） */
  async flyTo(tx, ty, { timeout = 30000 } = {}) {
    const t0 = Date.now();
    for (let hop = 0; hop < 30; hop++) {
      const st = await this.state();
      if (Math.hypot(st.hat.x - tx, st.hat.y - ty) < 0.6) return true;
      let p = await this.qa('groundPoint', tx, ty);
      if (!p.onScreen) {
        // 朝目标方向取屏幕内的一个点：在帽子与目标间插值
        let k = 0.9; let q = null;
        while (k > 0.05) { q = await this.qa('groundPoint', st.hat.x + (tx - st.hat.x) * k, st.hat.y + (ty - st.hat.y) * k); if (q.onScreen && this.insideMargin(q)) break; k -= 0.1; q = null; }
        p = q ?? p;
      }
      await this.mouseClick(p.x, p.y);
      await this.waitState((s) => !s.hat.moving, { timeout: 15000, msg: 'flyTo 到达' }).catch(() => {});
      if (Date.now() - t0 > timeout) break;
    }
    const st = await this.state();
    return Math.hypot(st.hat.x - tx, st.hat.y - ty) < 0.8;
  }
  insideMargin(p, m = 60) { const vp = this.page.viewportSize(); return p.x > m && p.y > m && p.x < vp.width - m && p.y < vp.height - m; }

  /** 点招式按钮。需面板已打开。先等按钮位置稳定（面板有弹出动画） */
  async clickMoveButton(moveId, { timeout = 5000 } = {}) {
    const t0 = Date.now(); let last = null;
    while (Date.now() - t0 < timeout) {
      const b = await this.qa('moveButton', moveId);
      if (b) {
        if (last && Math.abs(b.x - last.x) < 0.8 && Math.abs(b.y - last.y) < 0.8 && Math.abs(b.gw - last.gw) < 0.8) { await this.mouseClick(b.x, b.y); return b; }
        last = b;
      }
      await sleep(120);
    }
    throw new Error(`招式按钮 ${moveId} 未出现/未稳定`);
  }
  /** 附身物件：真实点击，等帽子飞到并弹出面板 */
  async possess(propId, { timeout = 25000 } = {}) {
    const st = await this.state();
    if (st.hat.attachedTo === propId && st.panelOpen) return;
    await this.clickProp(propId);
    await this.waitState(`s=>s.hat.attachedTo===${JSON.stringify(propId)} && s.panelOpen`, { timeout, msg: `附身 ${propId}` });
    await sleep(250);
  }
  /** 完整一次“点物件→点招式”。返回使用前后的状态 */
  async useMove(propId, moveId, o = {}) {
    await this.possess(propId, o);
    const before = await this.state();
    await this.clickMoveButton(moveId);
    await sleep(120);
    return before;
  }

  // ————— 触屏（CDP 真触摸事件） —————
  async touch(type, points) { await this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 8, radiusY: 8, force: 1 })) }); }
  async tap(x, y, { hold = 60 } = {}) { await this.touch('touchStart', [{ x, y }]); await sleep(hold); await this.touch('touchEnd', []); }
  async longPress(x, y, ms = 700) { await this.tap(x, y, { hold: ms }); }
  async drag(x0, y0, x1, y1, { steps = 12, stepMs = 16 } = {}) {
    await this.touch('touchStart', [{ x: x0, y: y0 }]);
    for (let i = 1; i <= steps; i++) { await sleep(stepMs); await this.touch('touchMove', [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }]); }
    await this.touch('touchEnd', []);
  }
  async pinch(cx, cy, r0, r1, { steps = 12, stepMs = 16 } = {}) {
    const pts = (r) => [{ x: cx - r, y: cy, id: 0 }, { x: cx + r, y: cy, id: 1 }];
    await this.touch('touchStart', pts(r0));
    for (let i = 1; i <= steps; i++) { await sleep(stepMs); await this.touch('touchMove', pts(r0 + ((r1 - r0) * i) / steps)); }
    await this.touch('touchEnd', []);
  }

  // ————— 窗口 / 焦点 —————
  async resize(w, h) { await this.page.setViewportSize({ width: w, height: h }); await sleep(400); }
  /** 模拟失焦/回到前台（visibilitychange + blur/focus） */
  async blurFocus(ms = 1500) {
    await this.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')); });
    await sleep(ms);
    await this.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
  }

  // ————— 截图 —————
  async shot(name, { clip, fullPage = false } = {}) {
    const file = join(this.outDir, `${this.name}-${name}.png`.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_'));
    await this.page.screenshot({ path: file, clip, fullPage });
    this.shots.push(file);
    return file;
  }

  // ————— 性能 —————
  frames(secs = 3) { return this.page.evaluate((s) => window.__qa.frameSample(s), secs); }

  async close() { try { await this.browser?.close(); } catch {} }
}
