// 音频：手势前不报错 / 手势后 running / 静音 / 页面隐藏→suspend、恢复→resume。输出 out/05-audio.json
// 用法：QA_URL=http://127.0.0.1:5189 node 05-audio.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { Session, sleep } from '../lib/session.mjs';
import { uiTrue, startGame, STABLE_ARGS } from './lib.mjs';
const OUT = new URL('./out/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const s = await Session.launch({ device: 'desktop', name: 'audio', outDir: OUT + 'audio', args: [...STABLE_ARGS, '--autoplay-policy=document-user-activation-required'] });
await s.page.addInitScript(() => {
  const log = (window.__audioLog = []); const t0 = performance.now();
  const Orig = window.AudioContext || window.webkitAudioContext; if (!Orig) { log.push({ ev: 'no-AudioContext' }); return; }
  window.__ctxs = [];
  const Wrapped = function (...a) { const c = new Orig(...a); window.__ctxs.push(c); log.push({ ev: 'new', t: Math.round(performance.now() - t0), state: c.state, gesture: !!navigator.userActivation?.hasBeenActive });
    c.addEventListener('statechange', () => log.push({ ev: 'state', t: Math.round(performance.now() - t0), state: c.state })); return c; };
  Wrapped.prototype = Orig.prototype; window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
  const rs = Orig.prototype.resume; Orig.prototype.resume = function () { log.push({ ev: 'resume()', state: this.state, gesture: !!navigator.userActivation?.hasBeenActive }); return rs.apply(this, arguments); };
  const sp = Orig.prototype.suspend; Orig.prototype.suspend = function () { log.push({ ev: 'suspend()', state: this.state }); return sp.apply(this, arguments); };
});
const R = []; const ok = (name, pass, detail = '') => { R.push({ name, pass: !!pass, detail }); console.log(`  ${pass ? '✓' : '✗'} ${name} ${pass ? '' : JSON.stringify(detail)}`); };
const aud = () => s.page.evaluate(() => ({ log: window.__audioLog.slice(), states: window.__ctxs.map((c) => c.state), hasUA: navigator.userActivation?.hasBeenActive }));
await s.goto({ fresh: true, timeout: 600000 }); await sleep(1500);
let a = await aud();
ok('手势前：没有控制台 error/pageerror', s.errors.length === 0, s.errors);
ok('手势前：不创建 AudioContext 或创建后为 suspended（不 running）', a.states.every((x) => x !== 'running'), a);
const warnsBefore = s.warnings.filter((w) => /AudioContext/i.test(w));
ok('手势前：没有“AudioContext was not allowed to start”类 error（warning 可接受）', !s.errors.some((e) => /AudioContext/i.test(e.text)), { warnsBefore });
await startGame(s, 'new'); await sleep(1200);
a = await aud();
ok('手势后：AudioContext 已创建且 running', a.states.length >= 1 && a.states.includes('running'), a);
ok('手势后：没有新增 error', s.errors.length === 0, s.errors);
// 静音：找 ui:mute 按钮点击
const mute = async () => { const b = (await uiTrue(s)).find((x) => x.qa === 'ui:mute'); if (b) await s.mouseClick(b.x, b.y); else throw new Error('no mute btn'); await sleep(500); };
const settings = () => s.page.evaluate(() => localStorage.getItem('christmas-hat/settings'));
const set0 = await settings(); await mute(); const set1 = await settings(); await mute(); const set2 = await settings();
ok('静音按钮：点击后设置里 muted 切换并可再切回', set0 !== set1 && set1 !== set2, { set0, set1, set2 });
ok('静音期间/之后：0 error', s.errors.length === 0, s.errors);
// 页面隐藏 / 恢复
await s.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
await sleep(800); const hid = await aud();
const saveHidden = await s.page.evaluate(() => !!localStorage.getItem('christmas-hat/save'));
ok('页面隐藏：游戏自己的 AudioContext（最后创建的）被 suspend', hid.states[hid.states.length - 1] === 'suspended', hid);
ok('信息：页面共创建 AudioContext 数量（Phaser 内置 + src/core/audio.ts 各一个则为 2）', true, { count: hid.states.length, states: hid.states });
ok('页面隐藏：触发自动存档', saveHidden);
await s.page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
await sleep(1200); const vis = await aud();
ok('页面恢复可见：AudioContext 回到 running', vis.states.includes('running'), vis);
ok('隐藏/恢复过程 0 error', s.errors.length === 0, s.errors);
const out = { results: R, audioLog: vis.log, errors: s.errors, warnings: s.warnings.filter((w) => !/GL Driver/.test(w)).slice(0, 10) };
writeFileSync(OUT + '05-audio.json', JSON.stringify(out, null, 1)); await s.close();
console.log(R.every((r) => r.pass) ? 'PASS' : 'FAIL');
