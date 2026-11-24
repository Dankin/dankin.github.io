// 鸟:真的会飞。drawBird(ctx,x,y,s,{state,t,p,dir,kind,seed})  (x,y)=脚/身体底部中心(飞行时指身体下沿)。
// state: 'perch' 站枝(偶尔歪头/啄) | 'fly' 巡航(翅膀扇动周期 + 身体上下起伏) | 'takeoff' 起飞(p 0..1 蹲→蹬→振翅) | 'land' 降落(p 0..1 滑翔→展翼刹车→落枝) | 'hit' 被点中(p 0..1 惊叫+炸毛+掉羽毛)
// kind: 'sparrow' 麻雀(默认) | 'magpie' 喜鹊(黑白长尾) | 'dove' 白鸽
// birdPath(u,x0,y0,x1,y1,arc) 给出弧线路径点 + 朝向角 + 切线,供外部沿路径飞行;drawFeathers(ctx,x,y,s,p) 落羽;drawBirdTrail 起降小尘。
import { F, INK, Ink, TAU, clamp, ease, lerp } from './ink.ts';
import type { C } from './ink.ts';
import type { ThingFn } from './types.ts';

export type BirdState = 'perch' | 'fly' | 'takeoff' | 'land' | 'hit';
export type BirdKind = 'sparrow' | 'magpie' | 'dove';
export const BIRD_STATES: BirdState[] = ['perch', 'fly', 'takeoff', 'land', 'hit'];
export const BIRD_KINDS: BirdKind[] = ['sparrow', 'magpie', 'dove'];

const COL: Record<BirdKind, { body: string; wing: string; belly: string; tail: string }> = {
  sparrow: { body: '#b69063', wing: '#8d6c46', belly: '#efe3c8', tail: '#8d6c46' },
  magpie: { body: '#34302c', wing: '#4a5560', belly: '#fbf8ee', tail: '#2a2622' },
  dove: { body: '#f6f2e8', wing: '#d8d3c6', belly: '#fffdf6', tail: '#d8d3c6' },
};

/** 弧线路径:u 0..1;arc>0 向上拱。返回位置与速度方向(用于朝向与俯仰)。*/
export function birdPath(u: number, x0: number, y0: number, x1: number, y1: number, arc = 24): { x: number; y: number; ang: number; vx: number } {
  u = clamp(u, 0, 1);
  const x = lerp(x0, x1, u);
  const y = lerp(y0, y1, u) - Math.sin(u * Math.PI) * arc;
  const du = 0.01;
  const u2 = Math.min(1, u + du), u1 = Math.max(0, u - du);
  const dx = lerp(x0, x1, u2) - lerp(x0, x1, u1);
  const dy = lerp(y0, y1, u2) - Math.sin(u2 * Math.PI) * arc - (lerp(y0, y1, u1) - Math.sin(u1 * Math.PI) * arc);
  return { x, y, ang: Math.atan2(dy, dx), vx: dx };
}

/** 落羽:p 0..1。(x,y)=掉落起点。*/
export function drawFeathers(ctx: C, x: number, y: number, s: number, p: number, seed = 1, n = 5): void {
  if (p <= 0 || p >= 1) return;
  const k = new Ink(ctx, seed, 1.1, 0.06);
  for (let i = 0; i < n; i++) {
    const ph = i * 1.7 + seed;
    const dx = Math.sin(ph) * 10 + Math.sin(p * 7 + ph) * 5;
    const dy = p * (22 + i * 4);
    const rot = Math.sin(p * 6 + ph) * 1.1 + ph;
    ctx.save();
    ctx.translate(x + dx * s, y + dy * s - (1 - p) * 3 * s);
    ctx.rotate(rot);
    ctx.globalAlpha *= 1 - Math.max(0, p - 0.7) / 0.3;
    ctx.scale(s, s);
    k.ell(0, 0, 3.4, 1.1, { fill: i % 2 ? F.cream : '#b69063', lw: 0.9, j: 0.04 });
    k.line(-3, 0, 3.4, 0, { lw: 0.7, ext: 0, bow: 0 });
    ctx.restore();
  }
}

export const drawBird: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0;
  const state = ((o.state as BirdState | undefined) ?? 'perch');
  const kind = ((o.kind as BirdKind | undefined) ?? 'sparrow');
  const p = clamp((o.p as number | undefined) ?? (state === 'perch' || state === 'fly' ? 0 : (t * 0.6) % 1), 0, 1);
  const c = COL[kind];
  const d = o.dir ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * d, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const k = new Ink(ctx, seed + 3, 1.8, 0.1);
  const tailLen = kind === 'magpie' ? 15 : 7.5;

  // 姿态参数
  let wing = 0.1; // 翼上扬角(0=收,1=上举,-1=下拍)
  let bob = 0, pitch = 0, legs = 1, headTilt = 0, squash = 0, spread = 0, beak = 0, ruffle = 0;
  const fp = t * 9;
  if (state === 'perch') {
    bob = Math.abs(Math.sin(t * 1.6 + seed)) < 0.12 ? 1.2 : 0; // 啄一下
    headTilt = Math.sin(t * 0.9 + seed) * 0.25;
    wing = 0.05;
    squash = Math.sin(t * 2.3) * 0.02;
  } else if (state === 'fly') {
    legs = 0;
    wing = Math.sin(fp);
    bob = -9 + Math.sin(fp * 2 - 1.2) * 1.4; // 拍翼一周期身体起伏两次(下拍上顶)
    pitch = -0.08 + Math.sin(fp) * 0.05;
    spread = 1;
  } else if (state === 'takeoff') {
    const q = ease(p);
    legs = p < 0.5 ? 1 : 0;
    squash = p < 0.25 ? p * 0.5 : 0;
    wing = p < 0.2 ? 0.2 + p * 2 : Math.sin(fp * (1 + p));
    bob = -Math.sin(p * Math.PI * 0.5) * 9 - (p < 0.2 ? -1 : 0);
    pitch = -0.35 * (1 - q) - 0.1;
    spread = clamp(p * 3, 0, 1);
  } else if (state === 'land') {
    const q = ease(p);
    legs = p > 0.55 ? 1 : 0;
    wing = p < 0.7 ? Math.sin(fp * (1.3 - p * 0.7)) * (1 - p * 0.35) + 0.5 : 0.9 - (p - 0.7) * 3.2; // 前掠刹车:翼上举
    bob = -9 * (1 - q) + (p > 0.9 ? Math.sin((p - 0.9) * 31) * 0.6 : 0);
    pitch = 0.32 * Math.sin(p * Math.PI) * (p < 0.7 ? 1 : 0.4);
    spread = 1 - clamp((p - 0.75) / 0.25, 0, 1);
  } else {
    // hit:惊跳 → 炸毛 → 抖
    const jump = Math.sin(clamp(p / 0.35, 0, 1) * Math.PI);
    bob = -jump * 7;
    squash = -jump * 0.12;
    ruffle = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
    beak = p < 0.7 ? 1 : 0;
    wing = 0.8 + Math.sin(p * 40) * 0.2;
    headTilt = Math.sin(p * 28) * 0.18;
    spread = 0.7;
    legs = 1;
  }

  // 腿
  if (legs) {
    const lx0 = -1.6, lx1 = 2.2;
    k.line(lx0, -3.6 + bob * 0.2, lx0, 0, { lw: 1.2, ext: 0, bow: 0 });
    k.line(lx1, -3.6 + bob * 0.2, lx1, 0, { lw: 1.2, ext: 0, bow: 0 });
    k.line(lx0 - 1.4, 0, lx0 + 1.4, 0, { lw: 1.1, ext: 0, bow: 0 });
    k.line(lx1 - 1.4, 0, lx1 + 1.4, 0, { lw: 1.1, ext: 0, bow: 0 });
  }
  ctx.save();
  ctx.translate(0, bob - 6);
  ctx.rotate(pitch);
  ctx.scale(1 + squash, 1 - squash);
  // 尾巴
  const tw = state === 'fly' || state === 'takeoff' || state === 'land' ? Math.sin(fp - 0.8) * 0.12 : 0;
  ctx.save();
  ctx.translate(-6, -0.4);
  ctx.rotate(0.28 + tw + (state === 'perch' ? Math.sin(t * 2 + seed) * 0.05 : 0));
  k.poly([[0, -1.8], [-tailLen, -1.2], [-tailLen - 1.4, 0.8], [-tailLen + 0.4, 2.2], [0, 1.8]], { fill: c.tail, lw: 1.5, j: 0.04 });
  ctx.restore();
  // 身体(后翅在身后一层)
  const wspan = 12 + spread * 3;
  const wAng = wing * 1.05;
  const drawWing = (back: boolean): void => {
    ctx.save();
    ctx.translate(-1, back ? -2.4 : -1.6);
    ctx.rotate(-wAng - (back ? 0.12 : 0));
    const sk = back ? 0.72 : 1;
    ctx.scale(sk, sk * (wing < 0 ? 0.88 : 1));
    // 翼:长椭圆 + 羽尖
    k.poly([[0, 0.6], [-1.6, -2.8], [-wspan * 0.5, -2.2 - spread], [-wspan, -0.6], [-wspan + 1.4, 1.2], [-wspan * 0.4, 2.4], [0, 2.2]], { fill: back ? c.wing : c.body, shade: F.shade, smooth: true, lw: 1.6, j: 0.06 });
    if (!back) {
      k.line(-wspan * 0.2, 0.2, -wspan * 0.9, 0.4, { lw: 0.8, ext: 0, bow: 0 });
      if (kind === 'magpie') k.poly([[-wspan * 0.3, 1.6], [-wspan * 0.9, 0.9], [-wspan * 0.5, 2.2]], { fill: '#58b2b8', nostroke: true });
    }
    ctx.restore();
  };
  if (spread > 0.01 || state === 'hit') drawWing(true);
  k.ell(0, 0, 7.6 + ruffle * 0.8, 5.4 + ruffle * 0.8, { fill: c.body, shade: F.shade, lw: 1.9, j: 0.08 });
  k.ell(0.8, 1.6, 4.6, 3, { fill: c.belly, nostroke: true, j: 0 });
  if (spread <= 0.01 && state !== 'hit') {
    // 收拢的翼贴身
    k.poly([[-5, -1.4], [3, -2.2], [1.6, 2], [-6, 2]], { fill: c.wing, smooth: true, lw: 1.3, j: 0.05 });
  } else drawWing(false);
  // 炸毛:头顶/背上几根毛
  if (ruffle > 0) for (let i = 0; i < 4; i++) k.line(-3 + i * 2.4, -5.4, -4 + i * 3, -8.4 - Math.sin(p * 30 + i) * 0.8, { lw: 1.1, ext: 0, bow: 0 });
  // 头
  ctx.save();
  ctx.translate(6.2, -3.4);
  ctx.rotate(headTilt);
  k.ell(0, 0, 4.4, 4.2, { fill: c.body, shade: F.shade, lw: 1.8, j: 0.06 });
  if (kind === 'sparrow') k.ell(0.6, 1.4, 3, 1.8, { fill: c.belly, nostroke: true, j: 0 });
  const bo = beak ? 2.2 : 0.6;
  k.poly([[3.6, -1 - bo * 0.4], [8.6, 0.1], [3.6, 0.6 + bo * 0.6]], { fill: '#f1b04c', lw: 1.3, j: 0.03 });
  if (beak) k.poly([[3.6, 0.8], [7, 2.2], [3.8, 2.6]], { fill: '#f1b04c', lw: 1.1, j: 0.03 });
  // 眼:被点中变 ><(惊)
  if (state === 'hit') {
    k.line(0.8, -2.1, 2.8, -1.2, { lw: 1.2, ext: 0, bow: 0 });
    k.line(0.8, -0.2, 2.8, -1.2, { lw: 1.2, ext: 0, bow: 0 });
  } else {
    k.dot(1.8, -1.2, 1);
    k.dot(2.1, -1.5, 0.35, F.white);
  }
  ctx.restore();
  ctx.restore();
  // 起降尘/惊叫
  if (state === 'takeoff' || state === 'land') {
    const near = state === 'takeoff' ? 1 - p : p;
    if (near > 0.55) for (let i = 0; i < 3; i++) {
      const u = (near - 0.55) / 0.45;
      ctx.save();
      ctx.globalAlpha *= (1 - Math.abs(u - 0.5) * 1.6) * 0.8;
      k.ell(-8 - i * 4 - u * 4, -1 - i * 0.4, 1.4, 0.8, { fill: F.white, lw: 0.9, j: 0.04 });
      ctx.restore();
    }
  }
  if (state === 'hit' && p < 0.6) {
    ctx.fillStyle = INK;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 10, -22 - Math.sin(p * 20) * 0.8);
    for (let i = 0; i < 3; i++) k.line(11 + i * 2, -14 + i * 2, 15 + i * 2, -16 + i * 3, { lw: 1, ext: 0, bow: 0 });
  }
  ctx.restore();
  if (state === 'hit') drawFeathers(ctx, x, y - 8 * s, s * d, p, seed);
  void TAU;
};

/** 完整一圈巡游:u 0..1 → 起飞(0..0.12)→弧线飞(0.12..0.88)→降落(0.88..1);返回应传给 drawBird 的 {state,p,x,y,dir}。*/
export function birdFlight(u: number, x0: number, y0: number, x1: number, y1: number, arc = 26): { state: BirdState; p: number; x: number; y: number; dir: 1 | -1; pitch: number } {
  u = clamp(u, 0, 1);
  const dir: 1 | -1 = x1 >= x0 ? 1 : -1;
  if (u < 0.12) return { state: 'takeoff', p: u / 0.12, x: x0, y: y0, dir, pitch: 0 };
  if (u > 0.88) return { state: 'land', p: (u - 0.88) / 0.12, x: x1, y: y1, dir, pitch: 0 };
  const v = (u - 0.12) / 0.76;
  const q = birdPath(v, x0, y0, x1, y1, arc);
  return { state: 'fly', p: v, x: q.x, y: q.y, dir, pitch: q.ang };
}
