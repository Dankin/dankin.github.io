// 运输(经典 6 档):篮子 / 小推车 / 卡车 / 货船 / 飞机 / 传送门。新增三档见 transport-extra.ts,统一入口见 transports.ts。
// 签名统一 (ctx, x, y, s, o):(x,y)=底部中心,s=缩放(1 = 约定宽度),默认朝右,o.dir=-1 朝左。
// 静态件走 bake 缓存,轮子/烟/浪/螺旋桨/苹果每帧现画(确定性,不闪)。
import { appleHeap, drawApple } from './apple.ts';
import { cached } from './bake.ts';
import type { Bounds } from './bake.ts';
import { F, INK, Ink, TAU, clamp, lerp, sparkle } from './ink.ts';
import type { C } from './ink.ts';
import type { ThingFn, ThingOpt } from './types.ts';

/** 摆放:平移 + 缩放 + 左右翻转(natRight=该档原稿是否朝右) */
export function place(ctx: C, x: number, y: number, s: number, o: ThingOpt, natRight: boolean, fn: (g: C) => void): void {
  ctx.save();
  ctx.translate(x, y);
  const f = (o.dir ?? 1) > 0 === natRight ? 1 : -1;
  ctx.scale(s * f, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  fn(ctx);
  ctx.restore();
}

export function wheel(g: C, seed: number, cx: number, cy: number, r: number, rot: number, lw = 1.9): void {
  const k = new Ink(g, seed, lw, 0.22);
  k.ell(cx, cy, r, r, { fill: F.gray2 });
  k.ell(cx, cy, r * 0.56, r * 0.56, { fill: F.white, lw: lw * 0.7 });
  for (let i = 0; i < 3; i++) {
    const a = rot + (i * TAU) / 3;
    k.line(cx + Math.cos(a) * r * 0.12, cy + Math.sin(a) * r * 0.12, cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, { lw: lw * 0.55, ext: 0, bow: 0 });
  }
  k.ell(cx, cy, r * 0.16, r * 0.16, { fill: F.gray3, lw: lw * 0.5, j: 0.05 });
}

/** 烟:向 (vx,vy) 漂散并变大变淡 */
export function puffs(g: C, x0: number, y0: number, vx: number, vy: number, t: number, n: number, str: number, size = 1): void {
  for (let i = 0; i < n; i++) {
    const u = (t * 0.75 + i / n) % 1;
    const px = x0 + vx * u + Math.sin(u * 7 + i * 2) * 1.2 * size;
    const py = y0 + vy * u;
    const r = (0.9 + u * 2.6) * size;
    g.save();
    g.globalAlpha *= clamp((1 - u) * str * 1.6, 0, 1);
    g.beginPath();
    g.arc(px, py, r, 0, TAU);
    g.fillStyle = F.white;
    g.fill();
    g.lineWidth = 1.2 * Math.max(0.7, size);
    g.strokeStyle = INK;
    g.stroke();
    g.restore();
  }
}

/** 装卸:n 个苹果从 (x0,y0) 沿弧飞向 (x0+dx, y0+dy) */
export function flyOut(g: C, x0: number, y0: number, dx: number, dy: number, u: number, n: number, r: number): void {
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < n; i++) {
    const ui = clamp((u - i * 0.07) / 0.62, 0, 1);
    if (ui <= 0 || ui >= 1) continue;
    const x = lerp(x0, x0 + dx, ui) + (i % 3 - 1) * 1.6 * ui;
    const y = lerp(y0, y0 + dy, ui) - Math.sin(ui * Math.PI) * (9 + (i % 3) * 3);
    drawApple(g, x, y, r, { leaf: i % 2 === 0 });
  }
}

/** 载量 → 苹果个数(0 = 空) */
export const loadN = (o: ThingOpt, max: number): number => {
  const l = clamp(o.load ?? 0, 0, 1) * (1 - clamp(o.unload ?? 0, 0, 1));
  return l <= 0.02 ? 0 : Math.max(1, Math.round(l * max));
};

/** 装货弹跳:o.pulse 0..1 一次性进度(0/≥1 无效)。dip=车身下沉,hop=苹果堆被颠起 */
export function bounce(o: ThingOpt): { dip: number; hop: number } {
  const p = o.pulse ?? 0;
  if (p <= 0 || p >= 1) return { dip: 0, hop: 0 };
  const e = 1 - p;
  return { dip: Math.sin(p * Math.PI * 2.4) * e * 1.9, hop: -Math.abs(Math.sin(p * Math.PI * 3)) * e * 3 };
}
/** 行驶中苹果堆随颠簸轻跳(与车身错相位) */
export const heapJig = (t: number, mv: number, f = 15, a = 0.8, ph = 1.3): number => -Math.max(0, Math.sin(t * f + ph)) * a * mv;

/** 苹果从 (x0,y0) 垂直掉落到 y0+dy(吊装/空投) */
export function dropOut(g: C, x0: number, y0: number, dy: number, u: number, n: number, r: number): void {
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < n; i++) {
    const ui = clamp((u - i * 0.06) / 0.6, 0, 1);
    if (ui <= 0 || ui >= 1) continue;
    drawApple(g, x0 + (i % 3 - 1) * 3.4 * ui, y0 + ui * ui * dy, r, { leaf: i % 2 === 0, alpha: 1 - Math.max(0, ui - 0.85) / 0.15 });
  }
}

/* ───────────────────────── 0 篮子 (18) ───────────────────────── */
export const drawBasket: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  const ph = t * 9;
  place(ctx, x, y, s, o, true, (g) => {
    const bob = Math.abs(Math.sin(ph)) * 0.9 * mv;
    // 小腿(提篮子赶路:行驶时迈步)
    const sw = Math.sin(ph) * 2.2 * mv;
    const k = new Ink(g, seed + 3, 1.9, 0.2);
    k.shadow(0, 0.3, 8, 1.6);
    k.limb(-2.4, -4.2 - bob, -2.4 + sw, -0.8, 1.2, F.cream, 1.7);
    k.limb(2.4, -4.2 - bob, 2.4 - sw, -0.8, 1.2, F.cream, 1.7);
    const bn = bounce(o);
    g.save();
    g.translate(0, -bob + bn.dip * 0.5);
    g.rotate(Math.sin(ph * 0.5) * 0.03 * mv);
    cached(g, `basket-back|${seed}`, [-9, -24, 9, 1], 0, 0, 1, (b) => {
      const kk = new Ink(b, seed, 1.9, 0.25);
      kk.stroke([[-6.3, -11], [-6, -18], [-3, -22.2], [3, -22.2], [6, -18], [6.3, -11]], { smooth: true, lw: 2 });
    });
    const n = loadN(o, 5);
    appleHeap(g, 0, -10.6 + bn.hop * 0.6 + heapJig(t, mv, 9, 0.6), n, 2.5, 13, seed);
    cached(g, `basket|${seed}`, [-9.5, -13, 9.5, -2], 0, 0, 1, (b) => {
      const kk = new Ink(b, seed + 1, 1.9, 0.3);
      kk.poly([[-8.6, -12], [8.6, -12], [6.2, -4.2], [-6.2, -4.2]], { fill: F.wood, shade: F.shade2, j: 0.3 });
      kk.rect(-9.2, -13.2, 18.4, 2.4, { fill: F.warm, lw: 1.7, r: 1 });
      for (let i = 0; i < 2; i++) kk.line(-7.4 + i * 1.5, -8.7 + i * 2.2, 7.4 - i * 1.5, -8.7 + i * 2.2, { lw: 0.9, ext: 0 });
      for (let i = -3; i <= 3; i++) kk.line(i * 2.1, -10.4, i * 1.7, -4.8, { lw: 0.8, ext: 0, bow: 0 });
    });
    g.restore();
  });
};

/* ───────────────────────── 1 小推车 (34) ───────────────────────── */
export const drawCart: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  const rot = t * 8 * mv;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const bump = Math.abs(Math.sin(t * 11)) * 0.7 * mv - bn.dip * 0.6;
    const k = new Ink(g, seed + 5, 2, 0.25);
    k.shadow(-1, 0.3, 17, 1.8);
    g.save();
    g.translate(0, -bump);
    g.rotate(-Math.sin(t * 5.5) * 0.015 * mv);
    cached(g, `cart-back|${seed}`, [-22, -22, 17, 1], 0, 0, 1, (b) => {
      const kk = new Ink(b, seed, 2, 0.25);
      // 后手把 + 撑脚
      kk.line(-9, -9, -19.5, -15, { lw: 2 });
      kk.line(-8, -6.5, -9.5, 0, { lw: 2 });
    });
    const n = loadN(o, 8);
    appleHeap(g, 2, -14.4 + bn.hop * 0.7 + heapJig(t, mv, 11, 0.9), n, 2.6, 17, seed);
    cached(g, `cart|${seed}`, [-23, -22, 18, 1], 0, 0, 1, (b) => {
      const kk = new Ink(b, seed + 1, 2, 0.3);
      kk.line(-19.6, -15.4, -21.4, -14.2, { lw: 2.6, ext: 0 }); // 握把
      kk.poly([[-11.5, -16], [14, -16], [11, -7.2], [-8, -7.2]], { fill: F.cream, shade: F.shade2, j: 0.3 });
      kk.line(-11.5, -16, 14, -16, { lw: 2.4 });
      for (let i = 0; i < 4; i++) kk.line(-7 + i * 5.6, -15.6, -5.6 + i * 4.8, -7.6, { lw: 0.9, ext: 0, bow: 0 });
      kk.line(-9.2, -11.6, 12.5, -11.6, { lw: 1 });
      kk.line(-11, -16, -14.5, -14.6, { lw: 2.1 });
    });
    wheel(g, seed + 9, 7, -5.6, 5.4, rot, 2);
    g.restore();
    flyOut(g, 4, -17, 22, 8, o.unload ?? 0, 6, 2.5);
  });
};

/* ───────────────────────── 2 卡车 (70,按 truck.webp) ───────────────────────── */
// 参考图坐标 → 世界单位:原稿朝左,place 对 dir=1 自动翻转
const TK = 70 / 1200;
const TX = (px: number): number => (px - 615) * TK;
const TY = (py: number): number => (py - 698) * TK;

export const drawTruck: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  const rot = -t * 10 * mv;
  place(ctx, x, y, s, o, false, (g) => {
    const bn = bounce(o);
    // 路面颠簸:两个频率叠加 + 车头前后点头
    const bob = (Math.sin(t * 17) * 0.3 + Math.max(0, Math.sin(t * 6.1)) * 0.5) * mv + bn.dip;
    const pitch = Math.sin(t * 6.1 + 0.8) * 0.006 * mv - bn.dip * 0.004;
    new Ink(g, seed, 2, 0.2).shadow(0, 0.4, 37, 2);
    g.save();
    g.translate(0, bob);
    g.rotate(pitch);
    // 货(在货厢后面,露出上沿)
    const n = loadN(o, 12);
    appleHeap(g, TX(830), TY(120) + bn.hop + heapJig(t, mv, 17, 1.1, 0.6), n, 3.1, 42, seed);
    cached(g, `truck|${seed}`, [-37, -36.5, 37, 1], 0, 0, 1, (b) => {
      const k = new Ink(b, seed, 2.1, 0.28);
      const lwI = 1.6;
      // 底盘
      k.rect(TX(432), TY(560), TX(1120) - TX(432), TY(616) - TY(560), { fill: F.gray, lw: lwI });
      // 货厢上段:三格
      k.rect(TX(452), TY(105), TX(1210) - TX(452), TY(455) - TY(105), { fill: F.white, lw: 2.2 });
      k.line(TX(692), TY(108), TX(692), TY(452), { lw: 1.8 });
      k.line(TX(985), TY(108), TX(985), TY(452), { lw: 1.8 });
      // 货厢下段(裙板)
      k.rect(TX(455), TY(455), TX(1212) - TX(455), TY(565) - TY(455), { fill: F.warm, shade: F.shade, lw: 2.1 });
      // 货厢暖灰影线(右侧一格底部)
      k.hatch(TX(990), TY(300), TX(1205) - TX(990), TY(452) - TY(300), 2.6, 0.7, 0.35);
      // 驾驶室 + 引擎盖
      k.poly(
        [[TX(190), TY(432)], [TX(214), TY(318)], [TX(232), TY(302)], [TX(410), TY(306)], [TX(424), TY(322)], [TX(426), TY(618)], [TX(104), TY(620)], [TX(22), TY(618)], [TX(16), TY(470)], [TX(40), TY(452)]],
        { fill: F.cream, shade: F.shade, lw: 2.2, j: 0.25 },
      );
      // 车窗
      k.poly([[TX(224), TY(336)], [TX(372), TY(332)], [TX(386), TY(424)], [TX(226), TY(432)]], { fill: '#e8f3f4', lw: 1.7, j: 0.15 });
      sparkle(b, TX(260), TY(362), 1.3, F.white, 0, false);
      k.line(TX(240), TY(404), TX(262), TY(380), { lw: 0.8, ext: 0, bow: 0 }); // 玻璃反光
      // 引擎盖线与门缝
      k.line(TX(190), TY(434), TX(190), TY(560), { lw: 1.4 });
      k.line(TX(300), TY(440), TX(300), TY(560), { lw: 1.2 });
      // 门把
      k.line(TX(318), TY(500), TX(350), TY(500), { lw: 1.4 });
      // 格栅 + 车灯
      for (let i = 0; i < 4; i++) k.line(TX(24), TY(490 + i * 30), TX(48), TY(490 + i * 30), { lw: 1.2, ext: 0.2 });
      k.poly([[TX(62), TY(480)], [TX(86), TY(486)], [TX(88), TY(520)], [TX(62), TY(528)]], { fill: F.warm, lw: 1.3, j: 0.1 });
      // 保险杠
      k.line(TX(18), TY(618), TX(108), TY(618), { lw: 2.4 });
      // 车架线
      k.line(TX(278), TY(615), TX(690), TY(615), { lw: 1.8 });
      k.line(TX(858), TY(606), TX(896), TY(606), { lw: 1.5 });
      // 烟囱(驾驶室后)
      k.rect(TX(396), TY(180), TX(418) - TX(396), TY(302) - TY(180), { fill: F.gray2, lw: 1.5 });
    });
    // 烟
    puffs(g, TX(407), TY(176), 9, -11, t, 4, 0.35 + 0.65 * mv, 0.9 + 0.3 * mv);
    // 轮(车身后画,盖住底盘)
    wheel(g, seed + 11, TX(190), TY(612), 5, rot);
    wheel(g, seed + 12, TX(770), TY(612), 5, rot);
    wheel(g, seed + 13, TX(960), TY(612), 5, rot);
    g.restore();
    // 卸货:向车尾(原稿右侧)抛出
    flyOut(g, TX(1100), TY(120), 16, 20, o.unload ?? 0, 8, 3.1);
  });
};

/* ───────────────────────── 3 货船 (80) ───────────────────────── */
export const drawShip: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const bob = Math.sin(t * 1.7) * (1.0 + 0.5 * mv) + bn.dip * 0.7;
    const roll = Math.sin(t * 1.25) * (0.022 + 0.014 * mv) - mv * 0.012;
    g.save();
    g.translate(0, bob);
    g.rotate(roll);
    // 货舱里的苹果(舱口在船体前面,先画)
    const n = loadN(o, 14);
    appleHeap(g, 9, -20.5 + bn.hop * 0.6, n, 2.8, 36, seed);
    cached(g, `ship|${seed}`, [-48, -50, 48, 2], 0, 0, 1, (b) => {
      const k = new Ink(b, seed, 2.1, 0.3);
      // 烟囱 + 驾驶台 + 舱室(在船体后面)
      k.rect(-23, -47, 8, 11, { fill: F.warm, lw: 1.8 });
      k.rect(-23.4, -43, 9, 2.6, { fill: F.gray2, lw: 1.3 });
      k.rect(-33, -42, 17, 8, { fill: F.white, lw: 1.9 });
      k.rect(-31, -40, 4.4, 3.4, { fill: '#e8f3f4', lw: 1.2 });
      k.rect(-24.4, -40, 4.4, 3.4, { fill: '#e8f3f4', lw: 1.2 });
      k.rect(-38, -34, 28, 16, { fill: F.cream, shade: F.shade, lw: 2 });
      for (let i = 0; i < 4; i++) k.ell(-33 + i * 6, -28.4, 1.35, 1.35, { fill: '#e8f3f4', lw: 1.2, j: 0.05 });
      // 桅杆 + 旗
      k.line(31, -21, 31, -42, { lw: 1.7 });
      k.poly([[31, -42], [40, -39.4], [31, -37]], { fill: F.warm, lw: 1.3, j: 0.1 });
      // 货舱口沿(前沿压住苹果)
      // 船体
      k.poly([[-41, -19], [35, -19], [43, -23.5], [38, -9], [30, -2], [-32, -2], [-40, -10]], { fill: F.white, shade: F.shade2, lw: 2.4, j: 0.3 });
      k.line(-40, -12.4, 38.5, -12.4, { lw: 1.4 });
      k.rect(-41, -21, 76, 2.8, { fill: F.warm, lw: 1.7, j: 0.2 });
      // 舱口围板
      k.rect(-8, -23, 36, 4.4, { fill: F.gray, lw: 1.7, j: 0.2 });
      // 船体铆钉
      for (let i = 0; i < 6; i++) k.ell(-31 + i * 12.5, -8, 1.4, 1.4, { fill: F.cream, lw: 1.1, j: 0.05 });
    });
    g.restore();
    // 水面(盖住船底)
    const amp = 0.9;
    const wy = -4;
    g.beginPath();
    const wyAt = (xx: number): number => {
      const e = clamp((50 - Math.abs(xx)) / 14, 0, 1);
      return lerp(1.5, wy + Math.sin(xx * 0.22 + t * 3.2) * amp, e * e * (3 - 2 * e));
    };
    g.moveTo(-50, 1.5);
    for (let xx = -50; xx <= 50; xx += 2) g.lineTo(xx, wyAt(xx));
    g.lineTo(50, 1.5);
    g.closePath();
    g.fillStyle = F.water;
    g.fill();
    g.lineWidth = 1.7;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.beginPath();
    for (let xx = -50; xx <= 50; xx += 2) {
      const yy = wyAt(xx);
      xx === -50 ? g.moveTo(xx, yy) : g.lineTo(xx, yy);
    }
    g.stroke();
    // 前景浪:船身前一排卷边浪头,随行驶向船尾滚动
    {
      const sc = ((t * (4 + 10 * mv)) % 12 + 12) % 12;
      g.lineJoin = 'round';
      for (let i = -5; i <= 5; i++) {
        const cx = i * 12 - sc;
        if (Math.abs(cx) > 44) continue;
        const wy2 = -1.3 + Math.sin(cx * 0.22 + t * 3.2) * 0.5;
        g.beginPath();
        g.moveTo(cx - 4.2, wy2 + 1.2);
        g.quadraticCurveTo(cx - 3, wy2 - 2.6, cx + 0.8, wy2 - 2.6);
        g.quadraticCurveTo(cx + 3.6, wy2 - 2.4, cx + 4.4, wy2 + 1.2);
        g.closePath();
        g.fillStyle = F.white;
        g.fill();
        g.lineWidth = 1.3;
        g.strokeStyle = INK;
        g.stroke();
      }
    }
    // 水纹
    const kw = new Ink(g, seed + 21, 1.2, 0.2);
    for (let i = 0; i < 3; i++) {
      const cx = ((i * 31 + t * 6 * (0.3 + mv)) % 100) - 50;
      kw.line(cx - 4, -1.4 + (i % 2) * 0.5, cx + 3, -1.4 + (i % 2) * 0.5, { lw: 1, ext: 0, bow: 0 });
    }
    // 浪花:船头水花 + 船尾尾迹
    if (mv > 0.05) {
      for (let i = 0; i < 5; i++) {
        const u = (t * 1.6 + i / 5) % 1;
        g.save();
        g.globalAlpha *= (1 - u) * mv;
        g.beginPath();
        g.arc(40 + u * 7, -4 - Math.sin(u * Math.PI) * 6, 1 + (1 - u) * 1.3, 0, TAU);
        g.fillStyle = F.white;
        g.fill();
        g.lineWidth = 1;
        g.strokeStyle = INK;
        g.stroke();
        g.restore();
        const v = (t * 1.1 + i / 5) % 1;
        g.save();
        g.globalAlpha *= (1 - v) * mv;
        g.beginPath();
        g.ellipse(-40 - v * 14, -3.4, 2 + v * 3, 0.9 + v * 0.8, 0, 0, TAU);
        g.fillStyle = F.white;
        g.fill();
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      }
    }
    puffs(g, -19, -48 + bob, -7, -13, t, 4, 0.35 + 0.65 * mv, 1.05);
    flyOut(g, 14, -26, 30, 18, o.unload ?? 0, 8, 3);
  });
};

/* ───────────────────────── 4 飞机 (84) ───────────────────────── */
export const drawPlane: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const bob = Math.sin(t * 2.2) * 0.8 * (0.4 + mv) + bn.dip * 0.7;
    const k0 = new Ink(g, seed + 2, 1.9, 0.2);
    k0.shadow(0, 0.3, 36 - 4 * mv, 1.6, 0.14 - 0.06 * mv);
    g.save();
    // 行驶:离地抬头爬升,机身颠簸
    g.translate(0, bob - 3.2 * mv - Math.max(0, Math.sin(t * 9)) * 0.35 * mv);
    g.rotate(-0.05 * mv + Math.sin(t * 1.4) * 0.008);
    // 机翼(远侧,在机身后面)
    cached(g, `plane-back|${seed}`, [-48, -46, 50, 2], 0, 0, 1, (b) => {
      const k = new Ink(b, seed, 2, 0.28);
      k.poly([[-8, -19], [8, -19], [-4, -33], [-14, -33]], { fill: F.gray, lw: 1.9 });
      // 尾翼
      k.poly([[-40, -25], [-44, -43], [-36, -43], [-26, -28]], { fill: F.warm, shade: F.shade, lw: 2, j: 0.2 });
      k.poly([[-40, -24], [-30, -24], [-27, -19], [-37, -20]], { fill: F.gray, lw: 1.7 });
    });
    // 机舱里的苹果(舱门洞内)
    cached(g, `plane|${seed}`, [-48, -46, 52, 4], 0, 0, 1, (b) => {
      const k = new Ink(b, seed + 1, 2.2, 0.28);
      // 起落架
      k.line(10, -11, 12, -4, { lw: 2.1 });
      k.line(-30, -17, -28, -4, { lw: 2 });
      // 机身
      k.poly([[44, -16], [40, -24], [26, -30], [-6, -31], [-28, -29], [-45, -28.5], [-43, -22], [-30, -15], [-8, -11.5], [24, -11], [39, -10]], {
        fill: F.white,
        shade: F.shade2,
        smooth: true,
        lw: 2.4,
        j: 0.25,
      });
      // 驾驶舱窗
      k.poly([[27, -27.5], [37, -23.5], [37, -20.5], [26, -20.5]], { fill: '#e8f3f4', lw: 1.5, j: 0.1 });
      sparkle(b, 30, -24, 1.2, F.white, 0, false);
      // 客窗
      for (let i = 0; i < 3; i++) k.ell(14 - i * 6.4, -23.4, 1.7, 1.9, { fill: '#e8f3f4', lw: 1.2, j: 0.05 });
      // 货舱口(深色框)
      k.rect(-28, -26, 16, 11, { fill: F.gray3, lw: 1.9, j: 0.15 });
      // 腰线
      k.line(-8, -18, 36, -17, { lw: 0.9, ext: 0 });
      // 机翼(近侧)
      k.poly([[12, -17], [0, -17], [-24, -5], [-9, -5]], { fill: F.cream, shade: F.shade2, lw: 2.1, j: 0.2 });
      k.poly([[18, -9.6], [26, -9.6], [26, -5.4], [18, -5.4]], { fill: F.gray, lw: 1.7, j: 0.1 });
    });
    // 货舱里的苹果(裁剪到洞口)
    const n = loadN(o, 8);
    if (n > 0) {
      g.save();
      g.beginPath();
      g.rect(-27, -25, 14, 9.4);
      g.clip();
      appleHeap(g, -20, -16.4 + bn.hop * 0.5, n, 2.6, 12, seed);
      g.restore();
      // 洞口前沿线
      new Ink(g, seed + 4, 1.9, 0.1).line(-28, -15.6, -12, -15.6, { lw: 1.9, ext: 0.2 });
    }
    // 轮子
    wheel(g, seed + 31, 12, -3.2, 3.2, -t * 10 * mv, 1.7);
    wheel(g, seed + 32, -28, -3.2, 2.7, -t * 10 * mv, 1.5);
    // 机头 + 螺旋桨
    const k2 = new Ink(g, seed + 8, 1.9, 0.1);
    k2.ell(45.2, -16, 2.2, 2.6, { fill: F.gray2, lw: 1.6 });
    const sp = t * 22 * Math.max(0.15, mv);
    const bl = Math.abs(Math.cos(sp)) * 10 + 1;
    // 旋转模糊盘
    g.save();
    g.globalAlpha *= 0.12 + 0.2 * mv;
    g.beginPath();
    g.ellipse(46.6, -16, 2.6, 11.2, 0, 0, TAU);
    g.fillStyle = F.gray3;
    g.fill();
    g.restore();
    g.save();
    g.globalAlpha *= 0.28 + 0.3 * mv;
    g.beginPath();
    g.ellipse(46.6, -16, 1.6, 10.5, 0, 0, TAU);
    g.fillStyle = F.gray2;
    g.fill();
    g.restore();
    g.beginPath();
    g.ellipse(46.6, -16, 1.5, bl, 0, 0, TAU);
    g.fillStyle = F.gray3;
    g.fill();
    g.lineWidth = 1.3;
    g.strokeStyle = INK;
    g.stroke();
    g.restore();
    // 速度线
    if (mv > 0.05) {
      for (let i = 0; i < 3; i++) {
        const u = (t * 2.2 + i / 3) % 1;
        const yy = -33 + i * 9 + bob;
        g.save();
        g.globalAlpha *= (1 - u) * mv;
        const kk = new Ink(g, seed + 40 + i, 1.3, 0.1);
        kk.line(-56 - u * 18, yy, -48 - u * 18, yy, { lw: 1.3, ext: 0 });
        g.restore();
      }
    }
    flyOut(g, -20, -18, -6, 26, o.unload ?? 0, 6, 2.6);
  });
};

/* ───────────────────────── 5 传送门 (44) ───────────────────────── */
export const drawPortal: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  place(ctx, x, y, s, o, true, (g) => {
    const cy = -29, rx = 17.5, ry = 26;
    new Ink(g, seed, 2, 0.2).shadow(0, 0.4, 20, 2);
    // 门洞背景 + 漩涡
    g.save();
    g.beginPath();
    g.ellipse(0, cy, rx - 2, ry - 2.4, 0, 0, TAU);
    g.clip();
    const gr = g.createRadialGradient(0, cy, 2, 0, cy, ry);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.55, '#d9ecef');
    gr.addColorStop(1, '#a9cbd3');
    g.fillStyle = gr;
    g.fillRect(-rx, cy - ry, rx * 2, ry * 2);
    const spin = t * (1.2 + 3 * mv);
    g.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) {
      g.beginPath();
      for (let i = 0; i <= 28; i++) {
        const u = i / 28;
        const a = spin + arm * (TAU / 3) + u * 7;
        const rr = u * (ry - 3);
        const px = Math.cos(a) * rr * (rx / ry), py = cy + Math.sin(a) * rr;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.lineWidth = 1.7;
      g.strokeStyle = INK;
      g.stroke();
    }
    // 苹果被吸进漩涡
    const n = loadN(o, 5);
    for (let i = 0; i < n; i++) {
      const u = (t * 0.5 * (0.4 + mv) + i / Math.max(1, n)) % 1;
      const a = spin * 1.2 + i * 2.2 + u * 5;
      const rr = (1 - u) * (ry - 6);
      drawApple(g, Math.cos(a) * rr * (rx / ry), cy + Math.sin(a) * rr, 1.5 + (1 - u) * 1.4, { leaf: false, alpha: 0.4 + 0.6 * (1 - u) });
    }
    g.restore();
    // 石环
    cached(g, `portal|${seed}`, [-23, -60, 23, 2], 0, 0, 1, (b) => {
      const k = new Ink(b, seed + 1, 2.6, 0.35);
      k.rect(-21, -4, 13, 4.6, { fill: F.gray, lw: 2 });
      k.rect(8, -4, 13, 4.6, { fill: F.gray, lw: 2 });
      // 外环 = 大椭圆 - 门洞
      b.save();
      b.beginPath();
      b.ellipse(0, cy, rx + 4.4, ry + 4.4, 0, 0, TAU);
      b.ellipse(0, cy, rx - 2, ry - 2.4, 0, 0, TAU);
      b.fillStyle = F.gray;
      b.fill('evenodd');
      b.restore();
      k.ell(0, cy, rx + 4.4, ry + 4.4, { lw: 2.6, j: 0.35 });
      k.ell(0, cy, rx - 2, ry - 2.4, { lw: 2, j: 0.25 });
      // 石块缝
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + 0.3;
        k.line(Math.cos(a) * (rx - 1.5), cy + Math.sin(a) * (ry - 2), Math.cos(a) * (rx + 4), cy + Math.sin(a) * (ry + 4), { lw: 1.2, ext: 0, bow: 0 });
      }
    });
    // 符文光点(轮流亮)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.3 + (TAU / 20);
      const lit = 0.5 + 0.5 * Math.sin(t * 3 - i * 0.7 * (1 + mv));
      const px = Math.cos(a) * (rx + 1.2), py = cy + Math.sin(a) * (ry + 1.2);
      new Ink(g, seed + i, 1, 0).dot(px, py, 0.9 + lit * 0.8, lit > 0.5 ? '#ffffff' : F.gray3);
    }
    // 收货脉冲:门环外扩一圈白光
    const pp = o.pulse ?? 0;
    if (pp > 0 && pp < 1) {
      g.save();
      g.globalAlpha *= (1 - pp) * 0.9;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3.4 * (1 - pp) + 0.6;
      g.beginPath();
      g.ellipse(0, cy, (rx + 5) * (1 + pp * 0.32), (ry + 5) * (1 + pp * 0.22), 0, 0, TAU);
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(0, cy, (rx + 7) * (1 + pp * 0.32), (ry + 7) * (1 + pp * 0.22), 0, 0, TAU);
      g.stroke();
      g.restore();
    }
    // 闪光
    for (let i = 0; i < 3; i++) {
      const a = t * (1.1 + mv) + i * 2.1;
      sparkle(g, Math.cos(a) * (rx + 6), cy + Math.sin(a) * (ry + 4), 1.6 + Math.sin(t * 4 + i) * 0.5, F.white, a);
    }
    flyOut(g, 0, cy, 24, 26, o.unload ?? 0, 6, 2.6);
  });
};
