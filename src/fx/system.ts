import Phaser from 'phaser';
import { CHECKLIST, MoveDef } from '../core/data';
import { bus } from '../core/bus';
import { toScreen, lerp, pick, rand } from '../core/iso';
import type { Stimulus } from '../core/stimulus';
import { mkText } from '../ui/bubble';
import { NATIVE_SCALE as NS } from '../art/scale';
import type { FxContext, FxFn, FxHost, FxProp, PartOpts, Particle, Rig } from './types';

const FX = new Map<string, FxFn>();
const EVENTS = new Map<string, FxFn[]>();
const RIGS = new Map<string, Rig>();

/** 注册一个招式特效：moves.json 的 fx 字段 = id */
export function registerFx(id: string, fn: FxFn) { FX.set(id, fn); }
/** 注册一个事件特效：bus.emit(event) 时执行（可多个，按注册顺序） */
export function registerEventFx(event: string, fn: FxFn) { (EVENTS.get(event) ?? EVENTS.set(event, []).get(event)!).push(fn); }
/** 注册物件 rig：按 props.json 的 tex 匹配 */
export function registerRig(tex: string, rig: Rig) { RIGS.set(tex, rig); }
export const hasFx = (id: string) => FX.has(id);
export const fxIds = () => [...FX.keys()];

interface Bound { stim: Stimulus; sprs: Phaser.GameObjects.Image[]; offs: number[][]; t: number; lift: (t: number) => number; fade: number }

/** 特效系统：粒子 / 飞行物 / 跟随现象的挂件 / 物件 rig / 事件特效。由 GameScene 持有并每帧 update */
export class FxSystem {
  parts: Particle[] = [];
  bound: Bound[] = [];
  private props: FxProp[] = [];
  MAX_PARTS = 420;
  /** 每帧回调（持久效果如灯串闪烁）；返回 false 则移除 */
  tickers: ((dt: number, now: number) => boolean | void)[] = [];
  addTicker(fn: (dt: number, now: number) => boolean | void) { this.tickers.push(fn); }

  constructor(public host: FxHost) {}
  get scene() { return this.host.scene; }
  get now() { return this.host.now(); }

  // ———— 注册表入口 ————
  /** 播放招式特效 */
  play(id: string | undefined, prop: FxProp | undefined, stim: Stimulus | undefined, move?: MoveDef) {
    const stx = (move as any)?.setTex as string | undefined; if (stx && prop && this.scene.textures.exists(stx)) { prop.spr.setTexture(stx); (prop.data ??= {}).tex = stx; }   // E17
    if (!id) return;
    const fn = FX.get(id);
    if (!fn) { console.warn('[fx] 未注册的特效', id); return; }
    fn(this.ctx({ prop, stim, move }));
  }
  /** 创建物件时调用：挂 rig（风铃管/路灯光晕/树灯串…） */
  rigProp(p: FxProp) {
    this.props.push(p);
    RIGS.get(p.def.tex)?.setup?.(p, this);
  }
  /** 场景 create 里调用一次（在 bus.clear() 之后）：把注册的事件特效、清单事件接上 bus */
  wire() {
    for (const [ev, fns] of EVENTS) bus.on(ev, (...args: any[]) => { for (const fn of fns) fn(this.ctx({ event: ev, args })); });
    for (const c of CHECKLIST as any[]) {
      if (!c.on) continue;
      bus.on(c.on, () => { const d = c.delay ?? 0; if (d > 0) this.scene.time.delayedCall(d, () => this.host.completeCheck(c.id)); else this.host.completeCheck(c.id); });
    }
  }
  ctx(over: Partial<FxContext> = {}): FxContext {
    const p = over.prop;
    return {
      fx: this, host: this.host, scene: this.scene, W: this.host.W, ...over,
      top: p ? { x: p.sx, y: p.sy - p.top } : { x: 0, y: 0 },
      base: p ? { x: p.sx, y: p.sy } : { x: 0, y: 0 },
    };
  }

  // ———— 每帧 ————
  update(dt: number, glow: number) {
    this.updateBound(dt);
    this.updateParts(dt);
    for (let i = this.tickers.length - 1; i >= 0; i--) if (this.tickers[i](dt, this.now) === false) this.tickers.splice(i, 1);
    for (const p of this.props) RIGS.get(p.def.tex)?.tick?.(p, dt, this, glow);
  }
  private updateParts(dt: number) {
    const L = this.parts;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { p.o.destroy(); L[i] = L[L.length - 1]; L.pop(); continue; }
      const k = 1 - p.life / p.max;
      p.vy += p.g * dt;
      p.o.x += p.vx * dt; p.o.y += p.vy * dt;
      p.o.setScale(lerp(p.s0, p.s1, k) * p.m); p.o.setAlpha(p.a0 * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4));
      if (p.spin) p.o.rotation += p.spin * dt;
    }
  }
  private updateBound(dt: number) {
    const T = this.now;
    for (let i = this.bound.length - 1; i >= 0; i--) {
      const b = this.bound[i];
      b.t += dt;
      const alive = this.host.stim.active.includes(b.stim);
      const sc = toScreen(b.stim.x, b.stim.y);
      const lift = b.lift(b.t);
      b.sprs.forEach((o, j) => {
        const f = b.offs[j] ?? [0, 0];
        o.setPosition(sc.x + f[0] + Math.sin(T * 2 + j) * 3, sc.y - lift + f[1] + Math.sin(T * 3 + j * 2) * 2);
        o.setDepth(sc.y + 100);
        if (!alive) o.setAlpha(Math.max(0, o.alpha - dt * b.fade));
      });
      if (!alive && b.sprs[0].alpha <= 0) { b.sprs.forEach((o) => o.destroy()); this.bound.splice(i, 1); }
    }
  }

  // ———— helpers（fx 函数里用） ————
  add<T extends Phaser.GameObjects.GameObject>(o: T): T { this.host.W.add(o); return o; }
  particle(o: any, vx: number, vy: number, life: number, o2: PartOpts = {}) {
    if (this.parts.length >= this.MAX_PARTS) { o.destroy(); return; }
    this.parts.push({ o, vx, vy, m: o2.text ? 1 : NS, g: o2.g ?? 0, life, max: life, s0: o2.s0 ?? 1, s1: o2.s1 ?? 1, a0: o2.a0 ?? 1, spin: o2.spin ?? 0 });
  }
  sparkle(x: number, y: number) {
    const o = this.add(this.scene.add.image(x, y, 'p_sparkle').setScale(NS).setBlendMode(Phaser.BlendModes.ADD).setDepth(5000));
    this.particle(o, rand(-14, 14), rand(-30, -8), rand(0.4, 0.8), { s0: 2, s1: 0.5 });
  }
  sparkleBurst(x: number, y: number, n = 10, color = 0xffe08a) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(30, 90);
      const o = this.add(this.scene.add.image(x, y, 'p_sparkle').setScale(NS).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(5000));
      this.particle(o, Math.cos(a) * v, Math.sin(a) * v - 20, rand(0.5, 1), { g: 60, s0: 2.4, s1: 0.4 });
    }
  }
  /** 彩带：多色小方片下落（终点/庆祝） */
  confetti(x: number, y: number, n = 30) {
    const cols = [0xff6b6b, 0xffd27a, 0x7be0a0, 0x7ab8ff, 0xff9ab0];
    for (let i = 0; i < n; i++) {
      const o = this.add(this.scene.add.image(x, y, 'p_sparkle').setScale(NS * 0.8).setTint(cols[i % cols.length]).setDepth(5000));
      this.particle(o, rand(-90, 90), rand(-150, -60), rand(1.1, 1.8), { g: 170, s0: 1.4, s1: 1, spin: rand(-6, 6) });
    }
  }
  /** 雪雾：白色柔光向上扩散（造雪机/雪堆） */
  snowPuff(x: number, y: number, n = 14) {
    for (let i = 0; i < n; i++) {
      const o = this.add(this.scene.add.image(x + rand(-10, 10), y, 'p_glow').setScale(NS * 0.8).setAlpha(0.7).setDepth(5000));
      this.particle(o, rand(-26, 26), rand(-46, -14), rand(0.9, 1.6), { s0: 1.2, s1: 2.8, a0: 0.7 });
    }
  }
  ring(x: number, y: number, color = 0xffffff, to = 2.4) {
    const o = this.add(this.scene.add.image(x, y, 'p_ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(4990).setScale(0.3 * NS, 0.15 * NS));
    this.scene.tweens.add({ targets: o, scaleX: to * NS, scaleY: to * 0.5 * NS, alpha: 0, duration: 520, ease: 'Cubic.Out', onComplete: () => o.destroy() });
  }
  notes(x: number, y: number, n = 3) {
    for (let i = 0; i < n; i++) {
      const o = mkText(this.scene, x + rand(-8, 8), y, pick(['♪', '♫', '♬']), 22, pick(['#ffd35c', '#ff8aa8', '#8ad1ff', '#a8e88a']), { stroke: '#2b2230', strokeThickness: 3 }).setOrigin(0.5).setDepth(5100);
      this.add(o); this.particle(o, rand(-22, 22), rand(-50, -30), rand(1.1, 1.7), { s0: 0.6, s1: 1.1, spin: rand(-1, 1), text: true });
    }
  }
  hearts(x: number, y: number, n = 3) {
    for (let i = 0; i < n; i++) {
      const o = this.add(this.scene.add.image(x + rand(-10, 10), y, 'p_heart').setScale(NS).setDepth(5100));
      this.particle(o, rand(-12, 12), rand(-40, -24), rand(1.2, 1.8), { s0: 1.4, s1: 2.6 });
    }
  }
  /** 飘字（拟声词、数字、标语） */
  floatText(x: number, y: number, text: string, size = 24, color = '#ffef9c', stroke = '#7a2a1e', life = 0.9) {
    const o = this.add(mkText(this.scene, x, y, text, size, color, { stroke, strokeThickness: 5 }).setOrigin(0.5).setDepth(5200));
    this.particle(o, 0, -30, life, { s0: 0.6, s1: 1.3, text: true });
    return o;
  }
  /** 挂件（气球串等）：位置跟随某个现象，现象结束后淡出销毁 */
  bindToStim(stim: Stimulus, texKeys: string[], offs: number[][], scale: number, lift: (t: number) => number = (t) => 30 + t * 8, fade = 1.4) {
    const sprs = texKeys.map((k) => this.add(this.scene.add.image(0, 0, k).setScale(scale).setDepth(5200)));
    this.bound.push({ stim, sprs, offs, t: 0, lift, fade });
  }
  clear() { this.parts.forEach((p) => p.o.destroy()); this.parts = []; this.bound.forEach((b) => b.sprs.forEach((o) => o.destroy())); this.bound = []; this.props = []; this.tickers = []; }

  /** 调试快照（供 qa testApi） */
  debug() { return { particles: this.parts.length, bound: this.bound.length, rigs: this.props.length, fx: fxIds() }; }
}
