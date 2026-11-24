// 摇树落果:各档落果形态参数 + 粒子生成/步进/绘制。坐标全部相对树根(锚点),y 向下为正,地面 y=0。
import { Ctx, PAL, rgba, clamp, TAU } from './common';
import { appleSprite, drawAppleAt, AppleKind } from './apple';
import type { TreeAnchors } from './tree';

export type DropKind = 'few' | 'cluster' | 'branch' | 'rain' | 'rainBig';
export interface DropPattern {
  tier: number; kind: DropKind; name: string;
  /** 本次掉落的苹果数 [min,max](不含树枝/叶) */ count: [number, number];
  /** 起落时间错开(秒):最后一个比第一个晚多少 */ stagger: number;
  /** 苹果缩放(巨树/星树更大) */ scale: number;
  /** 随落叶数 */ leaves: number;
  /** 整枝(带小树枝一起掉) */ twig: boolean;
  /** 星树:混入金苹果概率 */ golden: number;
  /** 水平散布速度 */ spread: number;
}
const PATTERNS: DropPattern[] = [
  { tier: 1, kind: 'few', name: '1–2 个', count: [1, 2], stagger: 0.18, scale: 1, leaves: 2, twig: false, golden: 0, spread: 22 },
  { tier: 2, kind: 'cluster', name: '一小串', count: [3, 5], stagger: 0.25, scale: 1, leaves: 4, twig: false, golden: 0, spread: 34 },
  { tier: 3, kind: 'branch', name: '整枝', count: [5, 8], stagger: 0.12, scale: 1.05, leaves: 8, twig: true, golden: 0, spread: 40 },
  { tier: 4, kind: 'rain', name: '苹果雨', count: [10, 14], stagger: 0.7, scale: 1.1, leaves: 12, twig: false, golden: 0, spread: 60 },
  { tier: 5, kind: 'rainBig', name: '大苹果雨', count: [16, 22], stagger: 1.0, scale: 1.3, leaves: 18, twig: false, golden: 0.12, spread: 80 },
];
export function dropPattern(tier: number): DropPattern { return PATTERNS[clamp(Math.round(tier), 1, 5) - 1]; }

export interface FallItem {
  /** 'apple' | 'twig'(带叶小枝) | 'leaf' */ type: 'apple' | 'twig' | 'leaf';
  x: number; y: number; vx: number; vy: number; rot: number; vr: number;
  /** 起落前等待(秒,≥0 时不动不画) */ delay: number; scale: number; kind: AppleKind;
  /** 落点 y(地面附近抖动,≤0) */ gy: number; landed: boolean; age: number;
  /** 落地后经过秒数(给 appleLandFx) */ landT: number;
}

/** 生成一次摇树的落果粒子。anchors 来自 treeAnchors(tier,variant);rnd 返回 0..1(可传种子随机)。 */
export function spawnShakeFall(tier: number, anchors: Pick<TreeAnchors, 'apples' | 'crown' | 'shakePivot'>, rnd: () => number = Math.random): FallItem[] {
  const P = dropPattern(tier), out: FallItem[] = [];
  const ap = anchors.apples.slice(), cr = anchors.crown;
  const n = Math.round(P.count[0] + rnd() * (P.count[1] - P.count[0]));
  const pickPos = (i: number) => {
    if (ap.length) return ap[Math.floor(rnd() * ap.length)];
    const a = rnd() * TAU, r = Math.sqrt(rnd()); return { x: cr.x + Math.cos(a) * r * cr.rx * 0.85, y: cr.y + Math.sin(a) * r * cr.ry * 0.8 + i * 0 };
  };
  let src: { x: number; y: number }[] = [];
  if (P.kind === 'few') for (let i = 0; i < n; i++) src.push(pickPos(i));
  else if (P.kind === 'cluster' || P.kind === 'branch') {
    // 以一个苹果为中心,取最近的 n 个(整枝:取同侧、同高度带)
    const c = pickPos(0), side = c.x >= cr.x ? 1 : -1;
    const pool = (P.kind === 'branch' ? ap.filter((p) => (p.x - cr.x) * side > -4) : ap).slice();
    pool.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
    src = pool.slice(0, n);
    while (src.length < n) { const a = rnd() * TAU; src.push({ x: c.x + Math.cos(a) * 16, y: c.y + Math.sin(a) * 10 }); }
    if (P.twig) out.push({ type: 'twig', x: c.x, y: c.y, vx: side * 14, vy: -30, rot: 0, vr: side * 1.6, delay: 0, scale: 1, kind: 'fuji', gy: -3, landed: false, age: 0, landT: 0 });
  } else {
    for (let i = 0; i < n; i++) src.push(pickPos(i));
  }
  src.forEach((p, i) => {
    const big = P.kind === 'rainBig' && rnd() < 0.3;
    const gold = rnd() < P.golden;
    out.push({
      type: 'apple', x: p.x, y: p.y, vx: (rnd() - 0.5) * P.spread, vy: -rnd() * 30, rot: (rnd() - 0.5) * 0.6, vr: (rnd() - 0.5) * 6,
      delay: P.kind === 'branch' ? rnd() * 0.08 : (i / Math.max(1, src.length - 1 || 1)) * P.stagger * (0.6 + rnd() * 0.8), scale: P.scale * (big ? 1.25 : 0.95 + rnd() * 0.15),
      kind: gold ? 'golden' : 'fuji', gy: -(rnd() * 8), landed: false, age: 0, landT: 0,
    });
  });
  for (let i = 0; i < P.leaves; i++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd());
    out.push({ type: 'leaf', x: cr.x + Math.cos(a) * r * cr.rx * 0.9, y: cr.y + Math.sin(a) * r * cr.ry * 0.8, vx: (rnd() - 0.5) * 50, vy: -rnd() * 20, rot: rnd() * TAU, vr: (rnd() - 0.5) * 5, delay: rnd() * 0.4, scale: 0.8 + rnd() * 0.5, kind: 'fuji', gy: -rnd() * 6, landed: false, age: 0, landT: 0 });
  }
  return out;
}

const G = 900;
/** 步进(原地修改)。返回本帧新落地的苹果(供计分/播放 appleLandFx)。 */
export function stepFall(a: FallItem[], dt: number): FallItem[] {
  const landed: FallItem[] = [];
  for (const p of a) {
    if (p.landed) { p.landT += dt; continue; }
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.age += dt;
    if (p.type === 'leaf') { p.vy = Math.min(p.vy + 120 * dt, 60); p.x += (p.vx + Math.sin(p.age * 4 + p.rot) * 30) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.y >= p.gy) { p.y = p.gy; p.landed = true; } continue; }
    p.vy += G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.y >= p.gy) { p.y = p.gy; p.landed = true; p.landT = 0; if (p.type === 'apple') landed.push(p); }
  }
  return landed;
}
export function fallDone(a: FallItem[]) { return a.every((p) => p.landed); }

/** 画粒子。(x0,y0)=树根落地点屏幕位置,s=树缩放。苹果 32px sprite;落地后画 appleLandFx 的形变由调用方另外叠加(此处只画基础)。 */
export function drawFall(ctx: Ctx, a: FallItem[], x0: number, y0: number, s = 1) {
  for (const p of a) {
    if (p.delay > 0) continue;
    const X = x0 + p.x * s, Y = y0 + p.y * s;
    ctx.save(); ctx.translate(X, Y); ctx.rotate(p.type === 'apple' && p.landed ? 0 : p.rot);
    if (p.type === 'apple') drawAppleAt(ctx, appleSprite(p.kind, 'fresh', 32), 0, -9 * s * p.scale, s * p.scale);
    else if (p.type === 'leaf') {
      ctx.scale(s * p.scale, s * p.scale); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(3, -5, 9, -4, 11, 0); ctx.bezierCurveTo(9, 4, 3, 5, 0, 0);
      ctx.fillStyle = PAL.leaf; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = PAL.ink; ctx.stroke();
    } else {
      ctx.scale(s, s); ctx.lineCap = 'round'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-26, 3); ctx.quadraticCurveTo(0, -5, 26, 2); ctx.stroke();
      ctx.strokeStyle = PAL.trunk; ctx.lineWidth = 3.6; ctx.stroke();
      for (const [lx, ly, la] of [[-14, -2, -2.2], [6, -3, -1], [20, 1, -0.2]] as const) { ctx.save(); ctx.translate(lx, ly); ctx.rotate(la); ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(3, -5, 10, -5, 13, 0); ctx.bezierCurveTo(10, 5, 3, 5, 0, 0); ctx.fillStyle = PAL.leaf; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.ink; ctx.stroke(); ctx.restore(); }
    }
    ctx.restore();
  }
  void rgba;
}
