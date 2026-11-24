// 码头/站台 6 档背景件:摊位 / 小屋 / 仓库站台 / 码头 / 机场 / 传送站。(x,y)=底部中心,约宽 DOCK_W。
// o.pulse 收货脉冲(整体弹一下),o.crates 0..8 堆放箱数,o.t 动画(水波/风向袋/光点)。
import { drawApple } from './apple.ts';
import { cached } from './bake.ts';
import { F, INK, Ink, TAU, clamp, sparkle } from './ink.ts';
import type { C } from './ink.ts';
import type { ThingFn, ThingOpt } from './types.ts';

export const DOCK_W = [60, 72, 92, 98, 100, 84] as const;
export const DOCK_NAMES = ['摊位', '小屋', '仓库站台', '码头', '机场', '传送站'] as const;
const FONT = '"Kaiti SC","STKaiti","KaiTi","PingFang SC",sans-serif';

function stage(ctx: C, x: number, y: number, s: number, o: ThingOpt, fn: (g: C) => void): void {
  ctx.save();
  ctx.translate(x, y);
  const p = clamp(o.pulse ?? 0, 0, 1);
  const k = s * (1 + 0.07 * Math.sin(p * Math.PI));
  ctx.scale(k, k);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  fn(ctx);
  ctx.restore();
}

function sign(k: Ink, cx: number, cy: number, w = 15, h = 8): void {
  k.rect(cx - w / 2, cy - h / 2, w, h, { fill: F.white, lw: 1.7, r: 1.2 });
  const g = k.g;
  g.fillStyle = INK;
  g.font = `700 ${h * 0.78}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('送达', cx, cy + 0.3);
}

/** 木箱堆(带苹果),n 个,金字塔排列;(x,y)=底部中心 */
function crates(g: C, x: number, y: number, n: number, seed: number): void {
  const w = 7.6, h = 6;
  const rows = [4, 3, 2, 1];
  let left = Math.min(8, Math.round(n));
  let ri = 0;
  while (left > 0 && ri < rows.length) {
    const m = Math.min(rows[ri], left);
    for (let i = 0; i < m; i++) {
      const cx = x + (i - (m - 1) / 2) * (w + 0.4);
      const cy = y - ri * (h - 0.4);
      cached(g, `crate|${seed + ri * 7 + i}`, [-5, -7, 5, 1], cx, cy, 1, (b) => {
        const k = new Ink(b, seed + ri * 7 + i, 1.7, 0.2);
        k.rect(-w / 2, -h, w, h, { fill: F.wood, shade: F.shade2, lw: 1.7 });
        k.line(-w / 2, -h * 0.5, w / 2, -h * 0.5, { lw: 0.9, ext: 0 });
        k.line(-w / 2 + 0.6, -h + 0.6, w / 2 - 0.6, -0.6, { lw: 0.8, ext: 0, bow: 0 });
      });
      drawApple(g, cx - 1.6, cy - h - 0.6, 1.9, { leaf: false });
      drawApple(g, cx + 1.7, cy - h - 0.5, 1.9, { leaf: i % 2 === 0 });
    }
    left -= m;
    ri++;
  }
}

/* 0 摊位 */
export const drawStall: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1;
  stage(ctx, x, y, s, o, (g) => {
    new Ink(g, seed, 2, 0.2).shadow(0, 0.4, 28, 2);
    cached(g, `dock0|${seed}`, [-34, -40, 34, 2], 0, 0, 1, (b) => {
      const k = new Ink(b, seed, 2.2, 0.3);
      k.line(-22, -8, -22, -26, { lw: 2.4 });
      k.line(22, -8, 22, -26, { lw: 2.4 });
      // 柜台
      k.rect(-25, -11, 50, 11, { fill: F.wood, shade: F.shade2, lw: 2.2 });
      for (let i = 0; i < 5; i++) k.line(-20 + i * 10, -10, -20 + i * 10, -1.4, { lw: 1, ext: 0, bow: 0 });
      k.rect(-26, -13, 52, 3, { fill: F.warm, lw: 1.9 });
      // 遮阳篷:条纹
      for (let i = 0; i < 6; i++) {
        const x0 = -27 + i * 9, x1 = x0 + 9;
        k.poly([[x0 + 0.5, -37], [x1 + 0.5, -37], [x1 + 1.4, -27.5], [x0 - 0.4, -27.5]], { fill: i % 2 ? F.gray : F.white, lw: 1.7, j: 0.15 });
        k.ell((x0 + x1) / 2 + 0.5, -27.6, 4.5, 1.6, { fill: i % 2 ? F.gray : F.white, lw: 1.5, a0: 0, a1: Math.PI, nostroke: false });
      }
      k.line(-27, -37, 27, -37, { lw: 2.3 });
      sign(k, 0, -21.5);
    });
    // 柜面上的苹果
    for (let i = 0; i < 5; i++) drawApple(g, -16 + i * 8, -15.4, 2.6, { leaf: i % 2 === 0 });
    for (let i = 0; i < 4; i++) drawApple(g, -12 + i * 8, -19.6, 2.4, { leaf: i % 2 === 1 });
    crates(g, 34, 0, o.crates ?? 0, seed + 100);
  });
};

/* 1 小屋 */
export const drawShed: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1;
  stage(ctx, x, y, s, o, (g) => {
    new Ink(g, seed, 2, 0.2).shadow(0, 0.4, 32, 2);
    cached(g, `dock1|${seed}`, [-38, -46, 38, 2], 0, 0, 1, (b) => {
      const k = new Ink(b, seed, 2.2, 0.3);
      k.rect(-27, -23, 54, 23, { fill: F.cream, shade: F.shade, lw: 2.3 });
      // 木板缝
      for (let i = 1; i < 6; i++) k.line(-27 + i * 9, -22, -27 + i * 9, -1, { lw: 0.8, ext: 0, bow: 0 });
      // 屋顶
      k.poly([[-33, -22], [0, -42], [33, -22]], { fill: F.gray, shade: F.shade2, lw: 2.4, j: 0.3 });
      for (let i = 0; i < 4; i++) k.line(-24 + i * 8, -26 - (i < 3 ? i * 4.6 : (3 - i) * 4.6 + 0), -14 + i * 8, -22, { lw: 0.9, ext: 0, bow: 0 });
      // 门 + 窗
      k.rect(-20, -16, 14, 16, { fill: F.warm, lw: 1.9 });
      k.line(-13, -15.4, -13, -0.6, { lw: 1.1 });
      k.ell(-9.4, -8, 0.8, 0.8, { fill: F.white, lw: 1, j: 0.05 });
      k.rect(2, -18, 13, 10, { fill: '#e8f3f4', lw: 1.9 });
      k.line(8.5, -17.6, 8.5, -8.4, { lw: 1 });
      k.line(2.4, -13, 14.6, -13, { lw: 1 });
      sign(k, 0, -29.5, 16, 8.4);
    });
    crates(g, 33, 0, o.crates ?? 0, seed + 110);
  });
};

/* 2 仓库站台 */
export const drawDepot: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1;
  stage(ctx, x, y, s, o, (g) => {
    new Ink(g, seed, 2, 0.2).shadow(0, 0.4, 44, 2);
    cached(g, `dock2|${seed}`, [-48, -50, 48, 2], 0, 0, 1, (b) => {
      const k = new Ink(b, seed, 2.2, 0.3);
      // 站台
      k.rect(-46, -6, 92, 6, { fill: F.gray, shade: F.shade2, lw: 2.1 });
      for (let i = 0; i < 8; i++) k.line(-40 + i * 11, -5, -40 + i * 11, -0.8, { lw: 0.8, ext: 0, bow: 0 });
      // 仓库
      k.rect(-40, -30, 80, 24, { fill: F.cream, shade: F.shade, lw: 2.3 });
      // 锯齿屋顶
      k.poly([[-42, -30], [-42, -42], [-26, -30], [-26, -42], [-10, -30], [-10, -42], [6, -30], [6, -42], [22, -30], [22, -42], [42, -30]], { fill: F.gray, lw: 2.1, j: 0.25 });
      // 卷帘门
      k.rect(-28, -24, 24, 18, { fill: F.white, lw: 1.9 });
      for (let i = 0; i < 5; i++) k.line(-27, -22 + i * 3.4, -5, -22 + i * 3.4, { lw: 0.9, ext: 0, bow: 0 });
      k.rect(2, -24, 12, 18, { fill: F.warm, lw: 1.9 });
      k.rect(20, -26, 14, 8, { fill: '#e8f3f4', lw: 1.7 });
      sign(k, 27, -12.6, 16, 8.4);
    });
    crates(g, -2, -6, o.crates ?? 0, seed + 120);
  });
};

/* 3 码头 */
export const drawHarbor: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1;
  const t = o.t ?? 0;
  stage(ctx, x, y, s, o, (g) => {
    cached(g, `dock3|${seed}`, [-52, -56, 52, 2], 0, 0, 1, (b) => {
      const k = new Ink(b, seed, 2.2, 0.3);
      // 桩
      for (let i = 0; i < 5; i++) k.rect(-42 + i * 20, -9, 3.4, 9.4, { fill: F.woodDark, lw: 1.5, j: 0.15 });
      // 甲板
      k.rect(-48, -14, 96, 6, { fill: F.wood, shade: F.shade2, lw: 2.2 });
      for (let i = 0; i < 9; i++) k.line(-42 + i * 10.5, -13.4, -42 + i * 10.5, -8.6, { lw: 0.8, ext: 0, bow: 0 });
      // 系缆桩
      k.poly([[-6, -14], [-6, -19], [-8, -21], [-2, -21], [-4, -19], [-4, -14]], { fill: F.gray2, lw: 1.6, j: 0.1 });
      // 吊机
      k.rect(18, -43, 4.4, 29, { fill: F.cream, lw: 1.9 });
      k.poly([[22, -43], [38, -39], [38, -37], [22, -39.4]], { fill: F.cream, lw: 1.7, j: 0.1 });
      k.poly([[10, -43], [24, -43], [24, -41.4], [10, -41.4]], { fill: F.gray, lw: 1.5, j: 0.1 });
      k.line(36, -38, 36, -26, { lw: 1.1 });
      k.rect(33.4, -26, 5.2, 4.6, { fill: F.gray2, lw: 1.5 });
      // 货棚
      k.rect(-40, -29, 24, 15, { fill: F.cream, shade: F.shade, lw: 2 });
      k.poly([[-42, -29], [-28, -37], [-14, -29]], { fill: F.gray, lw: 2, j: 0.2 });
      sign(k, -28, -22, 14.4, 7.6);
    });
    crates(g, 4, -14, o.crates ?? 0, seed + 130);
    // 水
    const wy = -2;
    g.beginPath();
    g.moveTo(-52, 2);
    for (let xx = -52; xx <= 52; xx += 2) {
      const e = clamp((52 - Math.abs(xx)) / 12, 0, 1);
      g.lineTo(xx, wy * e + 2 * (1 - e) + Math.sin(xx * 0.2 + t * 3) * 0.8 * e);
    }
    g.lineTo(52, 2);
    g.closePath();
    g.fillStyle = F.water;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    g.stroke();
  });
};

/* 4 机场 */
export const drawAirfield: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1;
  const t = o.t ?? 0;
  stage(ctx, x, y, s, o, (g) => {
    new Ink(g, seed, 2, 0.2).shadow(0, 0.4, 46, 1.8);
    cached(g, `dock4|${seed}`, [-52, -62, 52, 2], 0, 0, 1, (b) => {
      const k = new Ink(b, seed, 2.2, 0.3);
      // 跑道
      k.rect(-50, -3, 100, 3.4, { fill: F.gray2, lw: 1.8 });
      for (let i = 0; i < 9; i++) k.line(-44 + i * 11, -1.4, -39 + i * 11, -1.4, { lw: 1, ext: 0, bow: 0 });
      // 机库(拱形)
      k.poly([[-48, -3], [-48, -17], [-40, -26], [-22, -26], [-14, -17], [-14, -3]], { fill: F.cream, shade: F.shade, lw: 2.2, smooth: false, j: 0.25 });
      k.rect(-40, -17, 18, 14, { fill: F.white, lw: 1.8 });
      k.line(-31, -17, -31, -3.4, { lw: 1 });
      // 塔台
      k.rect(2, -34, 7, 31, { fill: F.warm, shade: F.shade, lw: 2 });
      k.poly([[-2, -35], [-3, -45], [14, -45], [13, -35]], { fill: '#e8f3f4', lw: 1.9, j: 0.15 });
      k.poly([[-4, -45], [5.5, -52], [15, -45]], { fill: F.gray, lw: 1.9, j: 0.15 });
      k.line(5.5, -52, 5.5, -58, { lw: 1.4 });
      for (let i = 0; i < 3; i++) k.line(-1 + i * 5, -44.4, -1 + i * 5, -35.6, { lw: 0.9, ext: 0, bow: 0 });
      // 候机/收货棚 + 牌
      k.rect(20, -17, 28, 14, { fill: F.cream, shade: F.shade, lw: 2 });
      k.line(18, -17, 50, -17, { lw: 2.2 });
      sign(k, 34, -10, 15.6, 8);
      // 风向袋杆
      k.line(-8, -3, -8, -22, { lw: 1.7 });
    });
    // 风向袋(随风摆)
    const sw = Math.sin(t * 2.4) * 0.12;
    g.save();
    g.translate(-8, -22);
    for (let i = 0; i < 3; i++) {
      const a = sw * (i + 1);
      const k = new Ink(g, seed + 40 + i, 1.5, 0.1);
      k.poly([[i * 4.2 + 0, -1.8 + i * 0.5 + Math.sin(a + t * 3) * 0.8], [i * 4.2 + 4.4, -1.4 + i * 0.5 + Math.sin(a + t * 3 + 0.4) * 0.9], [i * 4.2 + 4.4, 1.4 + i * 0.5 + Math.sin(a + t * 3 + 0.4) * 0.9], [i * 4.2, 1.8 + i * 0.5 + Math.sin(a + t * 3) * 0.8]], { fill: i % 2 ? F.white : F.gray, lw: 1.3, j: 0.08 });
    }
    g.restore();
    crates(g, -2, -3, o.crates ?? 0, seed + 140);
  });
};

/* 5 传送站 */
export const drawGateStation: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1;
  const t = o.t ?? 0;
  stage(ctx, x, y, s, o, (g) => {
    new Ink(g, seed, 2, 0.2).shadow(0, 0.4, 40, 2);
    cached(g, `dock5|${seed}`, [-44, -60, 44, 2], 0, 0, 1, (b) => {
      const k = new Ink(b, seed, 2.2, 0.3);
      // 台阶
      k.rect(-42, -5, 84, 5, { fill: F.gray, shade: F.shade2, lw: 2.1 });
      k.rect(-32, -10, 64, 5.4, { fill: F.cream, shade: F.shade, lw: 2.1 });
      // 柱子
      for (const sx of [-26, 20]) {
        k.rect(sx, -36, 6.4, 26, { fill: F.cream, shade: F.shade, lw: 2 });
        k.rect(sx - 1.6, -38.2, 9.6, 3, { fill: F.gray, lw: 1.7 });
        k.rect(sx - 1.6, -12, 9.6, 2.6, { fill: F.gray, lw: 1.7 });
      }
      // 门楣
      k.rect(-30, -44, 60, 7, { fill: F.gray, shade: F.shade2, lw: 2.1 });
      sign(k, 0, -40.5, 15, 6.4);
      // 门内光幕(浅蓝)
      k.rect(-19.6, -36, 39, 26, { fill: F.water, lw: 1.5, j: 0.2 });
    });
    // 光幕波纹
    g.save();
    g.beginPath();
    g.rect(-19.6, -36, 39, 26);
    g.clip();
    for (let i = 0; i < 5; i++) {
      const u = (t * 0.5 + i / 5) % 1;
      g.beginPath();
      g.ellipse(0, -23, 4 + u * 20, 3 + u * 13, 0, 0, TAU);
      g.globalAlpha = 1 - u;
      g.lineWidth = 1.3;
      g.strokeStyle = INK;
      g.stroke();
    }
    g.restore();
    for (let i = 0; i < 4; i++) {
      const a = t * 1.3 + (i * TAU) / 4;
      sparkle(g, Math.cos(a) * 22, -50 + Math.sin(a) * 6, 1.6, F.white, a);
    }
    crates(g, 0, -10, o.crates ?? 0, seed + 150);
  });
};

export const DOCKS: ThingFn[] = [drawStall, drawShed, drawDepot, drawHarbor, drawAirfield, drawGateStation];

/** 按档 0..5 画终点码头/站台 */
export function drawDock(ctx: C, tier: number, x: number, y: number, s: number, o: ThingOpt = {}): void {
  DOCKS[clamp(Math.round(tier), 0, 5)](ctx, x, y, s, o);
}
