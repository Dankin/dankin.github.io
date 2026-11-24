// 特效:苹果飞行轨迹(可传 sprite)、金苹果光晕、烟花粒子、树下进度礼物盒(封印/开盖)。
// 全部不使用 shadowBlur;确定性(同 seed/t 同画面)。除另注明外 (x,y)=底部中心。
import { drawApple } from './apple.ts';
import type { C } from './bake.ts';
import { cached } from './bake.ts';
import { F, INK, Ink, TAU, clamp, ease, lerp, sparkle } from './ink.ts';
import type { ThingFn, ThingOpt } from './types.ts';
import { rng } from '../style.ts';

/* ───────── 1. 苹果飞行 ───────── */
/** 苹果 sprite:以 (x,y) 为苹果中心、r 为半径画出。art-nature 的苹果可直接包成这个签名传入。 */
export type AppleSprite = (ctx: C, x: number, y: number, r: number) => void;
export const defaultSprite: AppleSprite = (ctx, x, y, r) => drawApple(ctx, x, y, r, { leaf: true });

export interface Fly {
  on: boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 进度 0..1 */
  t: number;
  /** 时长(秒) */
  dur: number;
  /** 抛物线弧高 */
  arc: number;
  /** 0 = 摇落进堆(短、无拖影),1 = 装车飞向码头(长弧、带 0.4 透明拖影) */
  kind: 0 | 1;
}
export const MAX_FLY = 14;

/** 单个飞行苹果(无状态):k=进度,按 orchard.ts 原逻辑 x/y=lerp、y-=sin(kπ)*arc;kind 1 画落后一步的 0.4 透明拖影 */
export function drawFlight(ctx: C, f: Pick<Fly, 'x0' | 'y0' | 'x1' | 'y1' | 'arc' | 'kind'>, k: number, o: { sprite?: AppleSprite; r?: number; noTrail?: boolean } = {}): void {
  const sp = o.sprite ?? defaultSprite;
  const r = o.r ?? 5;
  const at = (kk: number): [number, number] => [lerp(f.x0, f.x1, kk), lerp(f.y0, f.y1, kk) - Math.sin(kk * Math.PI) * f.arc];
  if (f.kind === 1 && !o.noTrail) {
    ctx.save();
    for (let i = 3; i >= 1; i--) {
      const kk = Math.max(0, k - 0.045 * i);
      const [tx, ty] = at(kk);
      ctx.globalAlpha *= 0.4;
      sp(ctx, tx, ty, r * (1 - 0.1 * i));
      ctx.globalAlpha /= 0.4;
      if (kk === 0) break;
    }
    ctx.restore();
  }
  const [x, y] = at(k);
  // 飞行中轻微旋转感:用 k 做小幅倾斜
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(k * 9) * 0.3);
  sp(ctx, 0, 0, r);
  ctx.restore();
}

/** 飞行苹果池(替代 orchard.ts 的 flys[]):spawn → update(dt, onLand) → draw */
export class Flights {
  readonly list: Fly[] = [];
  constructor(public max = MAX_FLY) {
    for (let i = 0; i < max; i++) this.list.push({ on: false, x0: 0, y0: 0, x1: 0, y1: 0, t: 0, dur: 1, arc: 10, kind: 0 });
  }
  spawn(x0: number, y0: number, x1: number, y1: number, dur: number, arc: number, kind: 0 | 1 = 0): boolean {
    for (const f of this.list) {
      if (f.on) continue;
      Object.assign(f, { on: true, x0, y0, x1, y1, t: 0, dur, arc, kind });
      return true;
    }
    return false;
  }
  update(dt: number, onLand?: (f: Fly) => void): void {
    for (const f of this.list) {
      if (!f.on) continue;
      f.t += dt / f.dur;
      if (f.t >= 1) {
        f.on = false;
        onLand?.(f);
      }
    }
  }
  draw(ctx: C, o: { sprite?: AppleSprite; r0?: number; r1?: number; reduceMotion?: boolean } = {}): void {
    for (const f of this.list) {
      if (!f.on) continue;
      drawFlight(ctx, f, f.t, { sprite: o.sprite, r: f.kind === 1 ? (o.r1 ?? 5) : (o.r0 ?? 4.6), noTrail: o.reduceMotion });
    }
  }
  get active(): number {
    let n = 0;
    for (const f of this.list) if (f.on) n++;
    return n;
  }
}

/* ───────── 2. 金苹果光晕 ───────── */
/** 金苹果光晕:(x,y)=苹果【中心】,s=半径倍率(1=苹果半径 ~8)。放射楔 + 同心淡金圈 + 绕飞星点,无 shadowBlur。
 *  o.t 动画秒;o.pulse 0..1 触发时的外扩脉冲;o.alpha 总强度 */
export const drawGoldHalo: ThingFn = (ctx, x, y, s, o = {}) => {
  const t = o.t ?? 0;
  const R = 8 * s;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(x, y);
  // 同心淡金渐变
  const gr = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 2.6);
  gr.addColorStop(0, 'rgba(255,226,120,0.55)');
  gr.addColorStop(0.55, 'rgba(255,226,120,0.18)');
  gr.addColorStop(1, 'rgba(255,226,120,0)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(0, 0, R * 2.6, 0, TAU);
  ctx.fill();
  // 慢转放射楔
  const n = 10;
  const rot = t * 0.5;
  ctx.fillStyle = 'rgba(255,236,150,0.32)';
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const L = R * (2.3 + 0.35 * Math.sin(t * 2 + i * 1.7));
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.07) * R * 0.9, Math.sin(a - 0.07) * R * 0.9);
    ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
    ctx.lineTo(Math.cos(a + 0.07) * R * 0.9, Math.sin(a + 0.07) * R * 0.9);
    ctx.closePath();
    ctx.fill();
  }
  // 脉冲圈
  const p = o.pulse ?? 0;
  if (p > 0) {
    ctx.strokeStyle = `rgba(217,165,33,${(1 - p) * 0.8})`;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.arc(0, 0, R * (1.1 + p * 2), 0, TAU);
    ctx.stroke();
  }
  // 绕飞星点
  for (let i = 0; i < 3; i++) {
    const a = t * 1.4 + (i / 3) * TAU;
    const rr = R * (1.55 + 0.15 * Math.sin(t * 3 + i));
    sparkle(ctx, Math.cos(a) * rr, Math.sin(a) * rr * 0.8, (1.8 + 0.8 * Math.sin(t * 5 + i * 2)) * s, '#fff6c0', t + i, true);
  }
  ctx.restore();
};

/* ───────── 3. 烟花 ───────── */
export const FIREWORK_COLORS = ['#f2b705', '#fff1b8', '#ff6a5e', '#8fd05a', '#ffd86a', '#f6efdc'];
const GRAV = 70;

/** 单个烟花(无状态,闭式弹道):(x,y)=爆心,s=半径倍率,o.p=进度 0..1(必填;用 Fireworks 池自动推进),o.seed 随机形状 */
export const drawFirework: ThingFn = (ctx, x, y, s, o = {}) => {
  const p = clamp(o.p ?? 0, 0, 1);
  if (p <= 0 || p >= 1) return;
  const r = rng(o.seed ?? 1);
  const n = 22;
  const life = 1.1;
  const tau = p * life; // 秒
  const col = FIREWORK_COLORS[Math.floor(r() * FIREWORK_COLORS.length)];
  const col2 = FIREWORK_COLORS[Math.floor(r() * FIREWORK_COLORS.length)];
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  // 起爆闪光
  if (p < 0.12) {
    ctx.globalAlpha *= 1 - p / 0.12;
    sparkle(ctx, x, y, 12 * s * (0.5 + p * 6), '#fffdf2', 0, true);
    ctx.globalAlpha /= Math.max(0.001, 1 - p / 0.12);
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.3;
    const v = (34 + r() * 26) * s;
    const c = i % 3 === 0 ? col2 : col;
    const pos = (tt: number): [number, number] => {
      const d = (1 - Math.exp(-tt * 3.2)) / 3.2;
      return [x + Math.cos(a) * v * d, y + Math.sin(a) * v * d + 0.5 * GRAV * s * tt * tt * 0.6];
    };
    const alpha = clamp((1 - p) * 1.6, 0, 1);
    // 尾迹 3 点
    for (let j = 3; j >= 0; j--) {
      const tt = Math.max(0, tau - j * 0.035);
      const [px, py] = pos(tt);
      ctx.globalAlpha = alpha * (1 - j * 0.24);
      ctx.fillStyle = j === 0 ? c : c;
      ctx.beginPath();
      ctx.arc(px, py, (j === 0 ? 1.9 : 1.4 - j * 0.22) * s * (1 - p * 0.4), 0, TAU);
      ctx.fill();
    }
    if (i % 4 === 0) {
      const [px, py] = pos(tau);
      ctx.globalAlpha = alpha;
      sparkle(ctx, px, py, 2.6 * s * (1 - p * 0.5), c, tau * 4 + i, false);
    }
  }
  ctx.restore();
};

/** 烟花池:burst 发射、update 推进、draw 绘制。max 同时烟花数 */
export class Fireworks {
  private list: { x: number; y: number; s: number; seed: number; p: number }[] = [];
  private n = 0;
  constructor(public max = 8) {}
  burst(x: number, y: number, s = 1, seed?: number): void {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ x, y, s, seed: seed ?? ++this.n * 7 + 3, p: 0 });
  }
  update(dt: number): void {
    for (const f of this.list) f.p += dt / 1.1;
    this.list = this.list.filter((f) => f.p < 1);
  }
  draw(ctx: C): void {
    for (const f of this.list) drawFirework(ctx, f.x, f.y, f.s, { p: f.p, seed: f.seed });
  }
  get active(): number {
    return this.list.length;
  }
}

/* ───────── 4. 树下进度礼物盒 ───────── */
/** 礼物盒:宽 ~34。o.open 0..1(0=封印态,1=开盖态,中间=盖子弹开动画);o.progress 0..1(封印态时封蜡外的金色进度环);
 *  o.t 动画秒(封印态轻微抖动、开盖态光芒/星星);o.pulse 0..1 吸引注意的跳动 */
export const drawGiftBox: ThingFn = (ctx, x, y, s, o = {}) => {
  const open = clamp((o.open as number | undefined) ?? 0, 0, 1);
  const prog = clamp((o.progress as number | undefined) ?? 0, 0, 1);
  const t = o.t ?? 0;
  const pulse = o.pulse ?? 0;
  const hop = pulse > 0 ? -Math.abs(Math.sin(pulse * Math.PI * 2)) * 3 * (1 - pulse) : 0;
  const wob = open < 1 && prog >= 1 ? Math.sin(t * 9) * 0.04 : 0;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(x, y + hop * s);
  ctx.scale(s, s);
  ctx.rotate(wob);
  // 地面影
  ctx.fillStyle = 'rgba(40,30,20,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 0.6, 19, 3.2, 0, 0, TAU);
  ctx.fill();
  // 开盖光芒(放在盒后)
  if (open > 0.3) {
    const a = clamp((open - 0.3) / 0.7, 0, 1);
    ctx.save();
    ctx.translate(0, -20);
    ctx.fillStyle = `rgba(255,236,150,${0.38 * a})`;
    for (let i = 0; i < 7; i++) {
      const ang = -Math.PI / 2 + (i - 3) * 0.3 + Math.sin(t * 1.2) * 0.04;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang - 0.09) * 36 * a, Math.sin(ang - 0.09) * 36 * a);
      ctx.lineTo(Math.cos(ang + 0.09) * 36 * a, Math.sin(ang + 0.09) * 36 * a);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // 盒身(baked)
  cached(ctx, 'gift|body', [-20, -22, 20, 1], 0, 0, 1, (g) => {
    const k = new Ink(g, 5, 2, 0.28);
    k.poly([[-15, -18], [15, -18], [14, 0], [-14, 0]], { fill: '#efe2bb', shade: F.shade, lw: 2.1, j: 0.25 });
    // 缎带竖条
    k.poly([[-3.4, -18], [3.4, -18], [3.2, 0], [-3.2, 0]], { fill: '#e6b43a', lw: 1.5, j: 0.1 });
    // 木板线
    k.line(-14, -8, -4, -8, { lw: 0.8, ext: 0, bow: 0 });
    k.line(4, -8, 14, -8, { lw: 0.8, ext: 0, bow: 0 });
  });
  // 盖子 + 蝴蝶结:开盖时上抬、倾斜、飘开
  const lift = ease(open);
  ctx.save();
  ctx.translate(lift * 15, -18 - lift * 9);
  ctx.rotate(lift * 0.7);
  cached(ctx, 'gift|lid', [-20, -10, 20, 3], 0, 0, 1, (g) => {
    const k = new Ink(g, 6, 2, 0.28);
    k.poly([[-17, -8], [17, -8], [17, 0], [-17, 0]], { fill: '#f6eccb', shade: F.shade, lw: 2.1, j: 0.2 });
    k.poly([[-3.6, -8], [3.6, -8], [3.6, 0], [-3.6, 0]], { fill: '#e6b43a', lw: 1.4, j: 0.08 });
    // 蝴蝶结
    k.poly([[0, -8], [-8, -14], [-9, -8], [-1, -7.4]], { fill: '#f0c658', lw: 1.5, j: 0.1, smooth: true });
    k.poly([[0, -8], [8, -14], [9, -8], [1, -7.4]], { fill: '#f0c658', lw: 1.5, j: 0.1, smooth: true });
    k.ell(0, -8.4, 2.2, 2, { fill: '#e6b43a', lw: 1.3, j: 0.05 });
  });
  ctx.restore();
  // 封印(开盖前):红蜡 + 进度环
  if (open < 0.4) {
    ctx.save();
    ctx.globalAlpha *= 1 - open / 0.4;
    ctx.translate(0, -9);
    // 封条
    cached(ctx, 'gift|seal', [-8, -8, 8, 8], 0, 0, 1, (g) => {
      const k = new Ink(g, 8, 1.8, 0.25);
      k.ell(0, 0, 6.2, 6, { fill: '#c9443d', shade: 'rgba(80,10,10,0.22)', lw: 1.8, j: 0.25 });
      k.stroke([[-2.4, 0.4], [-0.6, 2], [2.6, -1.8]], { lw: 1.1, smooth: true });
    });
    // 进度环(金)
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(27,20,16,0.45)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, TAU);
    ctx.stroke();
    if (prog > 0) {
      ctx.strokeStyle = '#f2b705';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 9, -Math.PI / 2, -Math.PI / 2 + prog * TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  // 开盖后:苹果与星星冒出
  if (open > 0.5) {
    const a = clamp((open - 0.5) / 0.5, 0, 1);
    const bob = Math.sin(t * 3) * 1.2;
    drawApple(ctx, -5 * a, -20 - 8 * ease(a) + bob, 6.5, { leaf: true });
    drawApple(ctx, 6 * a, -19 - 5 * ease(a) - bob * 0.6, 5.4, { gold: true });
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.9 + i / 3) % 1;
      sparkle(ctx, (i - 1) * 11, -26 - ph * 18 * a, (3.2 - ph * 2.2) * a, '#fff1a0', t * 2 + i, true);
    }
  }
  ctx.restore();
  void INK;
};

export type { ThingOpt };
