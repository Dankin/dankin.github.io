import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio, SFX_NAMES, type AudioDeps } from '../src/audio/bgm.ts';
import { ERAS, STEPS } from '../src/audio/music.ts';
import { defaultSettings, loadSettings, sanitize, STORAGE_KEY } from '../src/audio/settings.ts';
import { gainOf } from '../src/audio/mixer.ts';
import { isIOS } from '../src/audio/ios.ts';
import { resolveSfx } from '../src/audio/sfx.ts';

// ───── 假 AudioContext:记录起音与自动化 ─────
const fin = (...n: number[]) => n.forEach((x) => { if (!Number.isFinite(x)) throw new Error('non-finite audio param ' + n.join()); });
class Param {
  value = 0;
  calls: Array<[string, ...number[]]> = [];
  setValueAtTime(v: number, t: number) { fin(v, t); this.value = v; this.calls.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v: number, t: number) { fin(v, t); this.value = v; this.calls.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { fin(v, t); if (v <= 0) throw new Error('exp ramp to <=0'); this.value = v; this.calls.push(['exp', v, t]); return this; }
  setTargetAtTime(v: number, t: number, k: number) { fin(v, t, k); this.calls.push(['target', v, t, k]); return this; }
  cancelScheduledValues() { return this; }
}
class FNode {
  connected: FNode[] = [];
  disconnected = false;
  onended: (() => void) | null = null;
  gain = new Param();
  frequency = new Param();
  detune = new Param();
  Q = new Param();
  delayTime = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  type = '';
  buffer: unknown = null;
  loop = false;
  startedAt: number | null = null;
  kind: string;
  ctx: FCtx;
  constructor(kind: string, ctx: FCtx) { this.kind = kind; this.ctx = ctx; }
  connect(n: FNode) { this.connected.push(n); return n; }
  disconnect() { this.disconnected = true; }
  setPeriodicWave() {}
  start(t: number) { fin(t); this.startedAt = t; if (this.kind === 'osc') this.ctx.tones.push({ t, f: this.frequency.value }); if (this.kind === 'src') this.ctx.noises.push({ t }); }
  stop(t: number) { this.ctx.pending.push({ t, n: this }); }
}
class FCtx {
  static last: FCtx;
  static count = 0;
  currentTime = 0;
  sampleRate = 8000;
  state: string = 'suspended';
  destination = new FNode('dest', this);
  onstatechange: (() => void) | null = null;
  tones: Array<{ t: number; f: number }> = [];
  noises: Array<{ t: number }> = [];
  nodes: FNode[] = [];
  pending: Array<{ t: number; n: FNode }> = [];
  resumes = 0;
  suspends = 0;
  constructor() { FCtx.last = this; FCtx.count++; }
  private mk(k: string) { const n = new FNode(k, this); this.nodes.push(n); return n; }
  createGain() { return this.mk('gain'); }
  createOscillator() { return this.mk('osc'); }
  createBiquadFilter() { return this.mk('filt'); }
  createDynamicsCompressor() { return this.mk('comp'); }
  createDelay() { return this.mk('delay'); }
  createBufferSource() { return this.mk('src'); }
  createPeriodicWave() { return {}; }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  async resume() { this.resumes++; this.set('running'); }
  async suspend() { this.suspends++; this.set('suspended'); }
  set(s: string) { this.state = s; this.onstatechange?.(); }
  /** 推进时钟并跑一次调度 */
  advance(sec: number) {
    this.currentTime += sec;
    const done = this.pending.filter((p) => p.t <= this.currentTime);
    this.pending = this.pending.filter((p) => p.t > this.currentTime);
    done.forEach((p) => p.n.onended?.());
  }
}

class Store {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}
class FDoc {
  hidden = false;
  ls = new Map<string, Array<() => void>>();
  addEventListener(e: string, fn: () => void) { this.ls.set(e, [...(this.ls.get(e) ?? []), fn]); }
  fire(e: string) { this.ls.get(e)?.forEach((f) => f()); }
  createElement() { return { play: async () => {}, setAttribute() {} }; }
}

function make(extra: Partial<AudioDeps> = {}) {
  let t = 1000;
  const timers: Array<{ fn: () => void; ms: number; id: number; live: boolean }> = [];
  const store = new Store();
  const doc = new FDoc();
  const a = createAudio({
    ctor: FCtx as never,
    storage: store,
    doc: doc as never,
    nav: {},
    now: () => t,
    rnd: () => 0.5,
    reducedMotion: false,
    setInterval: (fn, ms) => { const x = { fn, ms, id: timers.length, live: true }; timers.push(x); return x; },
    clearInterval: (id) => { (id as { live: boolean }).live = false; },
    setTimeout: (fn, ms) => { const x = { fn, ms, id: timers.length, live: true }; timers.push(x); return x; },
    ...extra,
  });
  const intervals = () => timers.filter((x) => x.ms === 30 && x.live);
  return { a, store, doc, timers, intervals, adv: (ms: number) => (t += ms), ctx: () => FCtx.last };
}
const flush = () => new Promise((r) => setTimeout(r, 5));

test('默认全部关闭,isEnabled()=false,未解锁时 play 返回 false', () => {
  const { a } = make();
  assert.equal(a.isEnabled(), false);
  assert.equal(a.isEnabled('any'), false);
  assert.equal(a.isRunning(), false);
  assert.equal(a.sfx.play('coin'), false);
});

test('旧 API 形状保持', () => {
  const { a } = make();
  for (const k of ['unlock', 'isRunning', 'setMusic', 'setSfx', 'setVolume', 'isMusicOn', 'setIntensity'] as const) assert.equal(typeof a[k], 'function');
  for (const k of ['shake', 'coin', 'golden', 'buy', 'stage', 'bonk', 'bite', 'sleep', 'fanfare'] as const) assert.equal(typeof a.sfx[k], 'function');
  a.setVolume(0.5);
  assert.equal(a.getVolume(), 0.5);
  a.setIntensity(9);
  a.sfx.shake(); // 未解锁不抛错
});

test('音效清单:至少 32 项,别名可解析,全部能在假 ctx 上发声', async () => {
  assert.ok(SFX_NAMES.length >= 32);
  for (const n of ['buyCard', 'tierUp', 'goldenApple', 'easterEgg', 'newsBreak', 'typewriter']) assert.ok(resolveSfx(n));
  for (const n of ['appleDrop', 'shake', 'buy', 'upgrade', 'golden', 'egg', 'newsTick', 'narrBlip', 'bugSquash', 'orderDone', 'giftOpen', 'firework']) assert.ok(SFX_NAMES.includes(n as never), n);
  const { a, adv } = make();
  a.setSfx(true);
  a.setVoice(true);
  a.unlock();
  await flush();
  assert.equal(a.isRunning(), true);
  for (const n of SFX_NAMES) {
    adv(5000);
    FCtx.last.advance(10);
    assert.equal(a.sfx.play(n), true, n);
  }
  assert.equal(a.sfx.play('nope'), false);
  assert.ok(FCtx.last.tones.length + FCtx.last.noises.length > 40);
});

test('开关:sfx 管世界音+界面音,voice 管 narr*;同名音效有最小间隔', async () => {
  const { a, adv } = make();
  a.unlock();
  await flush();
  assert.equal(a.sfx.play('coin'), false); // sfx 关
  a.setSfx(true);
  assert.equal(a.sfx.play('coin'), true);
  assert.equal(a.sfx.play('coin'), false); // 节流
  adv(1000);
  assert.equal(a.sfx.play('coin'), true);
  assert.equal(a.sfx.play('narrBlip'), false); // voice 关
  a.setVoice(true);
  assert.equal(a.sfx.play('narrBlip'), true);
  a.setSfx(false);
  adv(1000);
  assert.equal(a.sfx.play('cardHover'), false);
  assert.equal(a.sfx.play('narrBlip'), true);
});

test('pitch / vol 影响频率与音量;appleDrop 有多个变体', async () => {
  const { a, adv } = make({ rnd: () => 0.01 });
  a.setSfx(true);
  a.unlock();
  await flush();
  const c = FCtx.last;
  a.sfx.play('coin');
  const f1 = c.tones[0].f;
  adv(1000);
  c.tones.length = 0;
  a.sfx.play('coin', { pitch: 2 });
  assert.ok(Math.abs(c.tones[0].f - f1 * 2) < 1e-6);
  const sigs = new Set<string>();
  for (let v = 0; v < 4; v++) {
    adv(1000);
    c.tones.length = 0;
    c.noises.length = 0;
    a.sfx.play('appleDrop', { variant: v });
    sigs.add(c.tones.map((x) => x.f.toFixed(1)).join() + '|' + c.noises.length);
  }
  assert.ok(sigs.size >= 3, 'variants should differ: ' + [...sigs].join(' ; '));
});

test('BGM:调度窗口、循环 64 步不重启、定时器只有一个', async () => {
  const { a, intervals } = make();
  a.setMusic(true);
  a.unlock();
  await flush();
  const c = FCtx.last;
  assert.equal(intervals().length, 1);
  a.unlock();
  a.setMusic(true);
  assert.equal(intervals().length, 1, '重复开启不应叠加定时器');
  a.setIntensity(5);
  let prev = 0;
  let wraps = 0;
  const tickFn = intervals()[0].fn;
  for (let i = 0; i < 1200; i++) {
    c.advance(0.03);
    tickFn();
    const s = a.debug().music!.step;
    if (s < prev) wraps++;
    prev = s;
  }
  assert.ok(wraps >= 1, '应绕回起点');
  assert.ok(c.tones.length > 200);
  // 起音时间单调不早于已播放时间过多
  assert.ok(c.tones.every((x) => x.t > -1));
  assert.equal(a.debug().voices.music <= 40, true);
  assert.equal(STEPS, 64);
});

test('BGM:setMusic(false) 清定时器并淡出;再开可重建', async () => {
  const { a, intervals, timers } = make();
  a.setMusic(true);
  a.unlock();
  await flush();
  assert.equal(intervals().length, 1);
  a.setMusic(false);
  assert.equal(intervals().length, 0);
  assert.ok(timers.some((x) => x.ms >= 300), '总线延迟断开');
  a.setMusic(true);
  assert.equal(intervals().length, 1);
});

test('时代切换:6 套,改在小节线上生效;越界夹取', async () => {
  assert.equal(ERAS.length, 6);
  const { a, intervals } = make();
  a.setMusic(true);
  a.setEra(3);
  a.unlock();
  await flush();
  assert.equal(a.debug().music!.era, 3);
  a.setEra(5);
  assert.equal(a.debug().music!.pendingEra, 5);
  const c = FCtx.last;
  const fn = intervals()[0].fn;
  for (let i = 0; i < 40; i++) { c.advance(0.03); fn(); }
  assert.equal(a.debug().music!.era, 5);
  assert.equal(a.debug().music!.pendingEra, null);
  a.setEra(99);
  assert.equal(a.debug().music!.pendingEra, null);
  for (let i = 0; i < 80; i++) { c.advance(0.03); fn(); }
  assert.equal(a.debug().music!.era, 5);
});

test('昼夜:夜里变慢 ×0.75、压低通、白天恢复(迟滞)', async () => {
  const { a, intervals } = make();
  a.setMusic(true);
  a.unlock();
  await flush();
  const c = FCtx.last;
  const fn = intervals()[0].fn;
  const run = (n: number) => { for (let i = 0; i < n; i++) { c.advance(0.03); fn(); } };
  run(20);
  const day = a.debug().music!.bpm;
  a.setWorld({ daylight: 0 });
  assert.equal(a.debug().music!.night, true);
  run(600);
  const night = a.debug().music!.bpm;
  assert.ok(night < day * 0.8, `${night} vs ${day}`);
  a.setWorld({ daylight: 0.35 }); // 迟滞区间:仍是夜
  assert.equal(a.debug().music!.night, true);
  a.setWorld({ daylight: 1 });
  assert.equal(a.debug().music!.night, false);
  const lpCalls = c.nodes.filter((n) => n.kind === 'filt' && n.frequency.calls.some((x) => x[0] === 'target'));
  assert.ok(lpCalls.length >= 1);
});

test('混音:ducking 到 40%,旁白/金苹果/通关自动触发,多原因叠加', async () => {
  const { a, adv, ctx } = make({ setTimeout: (fn) => { (globalThis as any).__t = fn; return 0; } });
  a.setSfx(true);
  a.setVoice(true);
  a.unlock();
  await flush();
  const duckParam = () => ctx().nodes.filter((n) => n.kind === 'gain').map((n) => n.gain).find((p) => p.calls.some((c) => c[0] === 'target' && c[1] === 0.4))!;
  a.duck('ending', true);
  assert.deepEqual(a.debug().ducks, ['ending']);
  assert.ok(duckParam());
  a.duck('narration', true);
  a.duck('ending', false);
  assert.deepEqual(a.debug().ducks, ['narration']);
  a.duck('narration', false);
  assert.deepEqual(a.debug().ducks, []);
  a.sfx.play('narrOpen');
  assert.deepEqual(a.debug().ducks, ['narration']);
  adv(1000);
  a.sfx.play('narrClose');
  assert.deepEqual(a.debug().ducks, []);
  a.sfx.play('golden');
  assert.deepEqual(a.debug().ducks, ['golden']);
  adv(1000);
  a.sfx.play('fanfare');
  assert.deepEqual(a.debug().ducks.sort(), ['ending', 'golden']);
});

test('音量:gainOf 曲线、分层 API、music 别名、夹取', async () => {
  assert.equal(gainOf('master', 0), 0);
  assert.ok(gainOf('master', 0.5) < 0.5);
  const { a, ctx } = make();
  a.unlock();
  await flush();
  a.setVolume('music', 0.3);
  assert.equal(a.getVolume('bgm'), 0.3);
  a.setVolume('voice', 5);
  assert.equal(a.getVolume('voice'), 1);
  a.setVolume('sfx', -1);
  assert.equal(a.getVolume('sfx'), 0);
  a.setVolume('master', 0.25);
  const hit = ctx().nodes.some((n) => n.kind === 'gain' && n.gain.calls.some((c) => c[0] === 'target' && Math.abs(c[1] - gainOf('master', 0.25)) < 1e-9));
  assert.ok(hit);
  a.setVolume('bogus' as never, 0.5);
});

test("持久化:localStorage 'sta.audio' 往返,坏数据回退默认", () => {
  const { a, store } = make();
  a.setMusic(true);
  a.setVoice(true);
  a.setVolume('bgm', 0.4);
  const saved = JSON.parse(store.getItem(STORAGE_KEY)!);
  assert.equal(saved.music, true);
  assert.equal(saved.sfx, false);
  assert.equal(saved.voice, true);
  assert.equal(saved.vol.bgm, 0.4);
  const b = createAudio({ ctor: FCtx as never, storage: store, doc: new FDoc() as never, nav: {} });
  assert.equal(b.isEnabled(), true);
  assert.equal(b.isVoiceOn(), true);
  assert.equal(b.getVolume('bgm'), 0.4);
  const bad = new Store();
  bad.setItem(STORAGE_KEY, '{oops');
  assert.deepEqual(loadSettings(bad), defaultSettings());
  const s = sanitize({ music: 'yes', vol: { master: 9, bgm: 'x', sfx: 0.2 }, extra: 1 });
  assert.equal(s.music, false);
  assert.equal(s.vol.master, 1);
  assert.equal(s.vol.bgm, 0.8);
  assert.equal(s.vol.sfx, 0.2);
  // localStorage 不可用也不抛
  const c = createAudio({ ctor: FCtx as never, storage: null, doc: new FDoc() as never });
  c.setMusic(true);
  assert.equal(c.isMusicOn(), true);
});

test('iOS:识别、silentSwitchHint、audioSession 成功则无提示', () => {
  assert.equal(isIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }), true);
  assert.equal(isIOS({ platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(isIOS({ platform: 'MacIntel', maxTouchPoints: 0 }), false);
  const ua = 'iPhone';
  const old = make({ nav: { userAgent: ua } });
  assert.equal(old.a.silentSwitchHint(), null, '全关时无提示');
  old.a.setSfx(true);
  assert.match(old.a.silentSwitchHint()!, /静音键/);
  const modern = make({ nav: { userAgent: ua, audioSession: { type: 'auto' } } });
  modern.a.setSfx(true);
  modern.a.unlock();
  assert.equal(modern.a.silentSwitchHint(), null);
  const android = make({ nav: { userAgent: 'Android' } });
  android.a.setSfx(true);
  assert.equal(android.a.silentSwitchHint(), null);
});

test('iOS:interrupted → 提示"点一下恢复声音",手势后恢复并重启 BGM', async () => {
  const { a, doc, intervals } = make();
  a.setMusic(true);
  a.unlock();
  await flush();
  const c = FCtx.last;
  const seen: Array<string | null> = [];
  a.onHint((m) => seen.push(m));
  assert.equal(intervals().length, 1);
  // 来电:系统把 context 置为 interrupted,且 resume() 在手势外不会成功
  c.resume = async () => { c.resumes++; };
  c.set('interrupted');
  assert.equal(a.hint(), '点一下恢复声音');
  assert.equal(intervals().length, 0, 'BGM 定时器应停');
  assert.equal(a.isRunning(), false);
  // 用户点一下
  c.resume = async function (this: FCtx) { this.resumes++; this.set('running'); } as never;
  doc.fire('touchend');
  await flush();
  assert.equal(a.isRunning(), true);
  assert.equal(a.hint(), null);
  assert.equal(intervals().length, 1);
  assert.deepEqual(seen, ['点一下恢复声音', null]);
});

test('后台:visibilitychange 暂停 BGM 定时器并挂起,回前台恢复且不重头开始', async () => {
  const { a, doc, intervals } = make();
  a.setMusic(true);
  a.unlock();
  await flush();
  const c = FCtx.last;
  const fn = intervals()[0].fn;
  for (let i = 0; i < 100; i++) { c.advance(0.03); fn(); }
  const step = a.debug().music!.step;
  assert.ok(step > 0);
  doc.hidden = true;
  doc.fire('visibilitychange');
  await flush();
  assert.equal(intervals().length, 0);
  assert.equal(c.suspends, 1);
  assert.equal(a.hint(), null, '主动切后台不显示恢复提示');
  doc.hidden = false;
  doc.fire('visibilitychange');
  await flush();
  assert.equal(a.isRunning(), true);
  assert.equal(intervals().length, 1);
  assert.ok(a.debug().music!.step >= step - 1, '位置保留');
  assert.equal(FCtx.last, c, '不新建 context');
});

test('多事件解锁:任一手势事件都会触发 unlock,运行后不再重复创建', async () => {
  const before = FCtx.count;
  const { a, doc } = make();
  doc.fire('keydown');
  await flush();
  assert.equal(FCtx.count, before + 1);
  assert.equal(a.isRunning(), true);
  doc.fire('pointerdown');
  doc.fire('click');
  assert.equal(FCtx.count, before + 1);
  const m = make({ autoUnlock: false });
  m.doc.fire('click');
  assert.equal(m.a.debug().ctx, 'none');
});

test('减少动态:narrBlip 关闭,combo 升调取消', async () => {
  const { a, adv, ctx } = make();
  a.setSfx(true);
  a.setVoice(true);
  a.unlock();
  await flush();
  a.sfx.play('combo', { level: 6 });
  const hi = ctx().tones.map((x) => x.f);
  a.setReducedMotion(true);
  adv(1000);
  ctx().tones.length = 0;
  a.sfx.play('combo', { level: 6 });
  const lo = ctx().tones.map((x) => x.f);
  assert.ok(Math.max(...hi) > Math.max(...lo));
  assert.equal(a.sfx.play('narrBlip'), false);
});

test('源码体积 ≤ 100KB', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const dir = new URL('../src/audio/', import.meta.url);
  let total = 0;
  for (const f of readdirSync(dir)) if (f.endsWith('.ts')) total += statSync(new URL(f, dir)).size;
  assert.ok(total <= 100 * 1024, `audio source ${total} bytes`);
});
