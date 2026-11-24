// v6 运输 8 档 × 2 分支:分支 0 = 经典造型(transport.ts / transport-extra.ts),分支 1 = 本文件(共用底盘语义,换车身/司机,笑点不同)。
// 签名同 ThingFn;o.load/move/unload/pulse/t/dir/seed 语义同旧版,统一由 transports.ts 的 drawTransport(…, {v:1}) 调度。
import { appleHeap, drawApple } from './apple.ts';
import { F, INK, Ink, TAU, clamp, lerp, sparkle } from './ink.ts';
import type { C } from './ink.ts';
import { bounce, dropOut, flyOut, heapJig, loadN, place, puffs, wheel } from './transport.ts';
import type { ThingFn } from './types.ts';

const SKIN = F.skin;
const sw = (t: number, f: number, mv: number): number => Math.sin(t * f) * mv;

/** 小人头(大头 Q):草帽/头巾可选,便于各分支司机复用。(cx,cy)=头心 */
function kid(g: C, seed: number, cx: number, cy: number, r: number, o: { hat?: 'cap' | 'band' | 'straw' | 'goggle'; mouth?: 'smile' | 'o' | 'grit'; hair?: string } = {}): void {
  const k = new Ink(g, seed, 1.7, 0.12);
  k.ell(cx, cy, r, r * 0.95, { fill: SKIN, shade: F.shade, lw: 1.8, j: 0.1 });
  k.dot(cx + r * 0.32, cy - r * 0.05, r * 0.11);
  k.dot(cx - r * 0.38, cy - r * 0.05, r * 0.11);
  k.ell(cx + r * 0.62, cy + r * 0.3, r * 0.24, r * 0.15, { fill: '#f1c9ae', nostroke: true, j: 0 });
  const m = o.mouth ?? 'smile';
  if (m === 'smile') k.stroke([[cx + r * 0.0, cy + r * 0.42], [cx + r * 0.25, cy + r * 0.55], [cx + r * 0.5, cy + r * 0.4]], { lw: 1.1, smooth: true });
  else if (m === 'o') k.ell(cx + r * 0.28, cy + r * 0.5, r * 0.16, r * 0.2, { fill: F.gray3, lw: 0.9, j: 0.02 });
  else k.line(cx, cy + r * 0.5, cx + r * 0.5, cy + r * 0.5, { lw: 1.2, ext: 0, bow: 0 });
  const h = o.hat;
  if (h === 'cap') {
    k.poly([[cx - r, cy - r * 0.15], [cx - r * 0.8, cy - r * 0.85], [cx, cy - r * 1.05], [cx + r * 0.8, cy - r * 0.85], [cx + r, cy - r * 0.15]], { fill: F.gray2, smooth: true, lw: 1.6, j: 0.06 });
    k.poly([[cx + r * 0.7, cy - r * 0.3], [cx + r * 1.5, cy - r * 0.2], [cx + r * 0.9, cy - r * 0.05]], { fill: F.gray3, lw: 1.3, j: 0.04 });
  } else if (h === 'band') {
    k.poly([[cx - r * 0.98, cy - r * 0.45], [cx + r * 0.98, cy - r * 0.45], [cx + r * 0.95, cy - r * 0.18], [cx - r * 0.95, cy - r * 0.18]], { fill: F.white, lw: 1.4, j: 0.04 });
    k.poly([[cx - r * 0.95, cy - r * 0.3], [cx - r * 1.6, cy - r * 0.1], [cx - r * 1.4, cy - r * 0.55]], { fill: F.white, lw: 1.1, j: 0.04 });
  } else if (h === 'straw') {
    k.ell(cx, cy - r * 0.55, r * 1.55, r * 0.34, { fill: '#efdca0', shade: F.shade2, lw: 1.6, j: 0.08 });
    k.poly([[cx - r * 0.8, cy - r * 0.6], [cx - r * 0.7, cy - r * 1.25], [cx + r * 0.7, cy - r * 1.25], [cx + r * 0.8, cy - r * 0.6]], { fill: '#efdca0', smooth: true, lw: 1.6, j: 0.06 });
  } else if (h === 'goggle') {
    k.poly([[cx - r, cy - r * 0.1], [cx - r * 0.8, cy - r * 0.95], [cx, cy - r * 1.1], [cx + r * 0.8, cy - r * 0.95], [cx + r, cy - r * 0.1]], { fill: F.gray3, smooth: true, lw: 1.6, j: 0.06 });
    k.ell(cx + r * 0.32, cy - r * 0.08, r * 0.34, r * 0.3, { fill: '#e8f3f4', lw: 1.3, j: 0.03 });
    k.ell(cx - r * 0.38, cy - r * 0.08, r * 0.34, r * 0.3, { fill: '#e8f3f4', lw: 1.3, j: 0.03 });
  }
}

/* ───── 0b 篮子 · 背篓狗 (w≈24) ───── */
export const drawDogBasket: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const ph = t * 12, bob = Math.abs(Math.sin(ph)) * 1.1 * mv + bn.dip * 0.4;
    const k = new Ink(g, seed + 2, 1.9, 0.16);
    k.shadow(0, 0.3, 12, 1.8);
    // 4 腿(对角步)
    for (const [lx, p] of [[-6.5, 0], [-3.2, Math.PI], [4.2, Math.PI], [7.2, 0]] as const) {
      const a = Math.sin(ph + p) * 3 * mv;
      k.limb(lx, -8 - bob, lx + a, -0.8 - Math.max(0, -Math.cos(ph + p)) * 1.6 * mv, 2.4, F.warm, 1.6);
      k.ell(lx + a + 0.8, -0.7, 2, 1.1, { fill: F.cream, lw: 1.1, j: 0.04 });
    }
    // 尾巴(摇)
    k.limb(-9.6, -11.4 - bob, -13.6, -15.6 + Math.sin(t * 14) * 1.8, 2.2, F.cream, 1.5);
    g.save();
    g.translate(0, -bob);
    k.ell(-0.6, -11, 10.6, 5.4, { fill: F.cream, shade: F.shade2, lw: 2, j: 0.2 });
    k.ell(-4.4, -8.4, 2.2, 1.4, { fill: '#d8c8a8', nostroke: true, j: 0 }); // 斑
    // 头
    k.ell(10.6, -16, 5.4, 5, { fill: F.cream, shade: F.shade, lw: 2, j: 0.14 });
    k.ell(14.6, -14.6, 3.2, 2.4, { fill: F.warm, lw: 1.5, j: 0.06 });
    k.dot(16.6, -15.6, 1.1);
    k.dot(11.4, -17.4, 0.95);
    k.poly([[7.6, -19.4], [8.6, -25.4 + Math.sin(ph) * 0.8 * mv], [11.4, -20.2]], { fill: '#d8c8a8', smooth: true, lw: 1.5, j: 0.05 });
    if (mv > 0.1 || (o.load ?? 0) > 0) k.stroke([[14.4, -13], [14.8, -11.2 + Math.sin(t * 9) * 0.5]], { lw: 1.1 }); // 吐舌
    // 背篓(绑带)
    const n = loadN(o, 6);
    k.line(-6, -15.2, 6, -15.2, { lw: 1.3, ext: 0, bow: 0 });
    appleHeap(g, -0.8, -15 + bn.hop * 0.5 + heapJig(t, mv, 12, 0.7), n, 2.4, 11, seed);
    k.poly([[-6.6, -22], [6.4, -22], [5.2, -14.4], [-5.4, -14.4]], { fill: F.wood, shade: F.shade2, lw: 1.9, j: 0.2 });
    for (let i = -2; i <= 2; i++) k.line(i * 2.4, -21.4, i * 2.1, -15, { lw: 0.8, ext: 0, bow: 0 });
    g.restore();
    if (o.unload) flyOut(g, 0, -26, 18, 6, o.unload, loadN({ ...o, unload: 0 }, 6), 2.4);
  });
};

/* ───── 1b 挑扁担 · 驴驮篓 (w≈40) ───── */
export const drawDonkey: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const ph = t * 8, bob = Math.abs(Math.sin(ph)) * 1.0 * mv + bn.dip * 0.4;
    const k = new Ink(g, seed + 2, 2, 0.16);
    k.shadow(0, 0.3, 19, 2.2);
    for (const [lx, p] of [[-11, 0], [-6.4, Math.PI], [7.2, Math.PI], [11.4, 0]] as const) {
      const a = Math.sin(ph + p) * 3.6 * mv;
      k.limb(lx, -13 - bob, lx + a, -1.2 - Math.max(0, -Math.cos(ph + p)) * 2 * mv, 3.1, '#b9b2a4', 1.7);
      k.rect(lx + a - 1.6, -2.4, 3.2, 2.4, { fill: INK, lw: 0.8, r: 0.6 });
    }
    g.save();
    g.translate(0, -bob);
    k.limb(-14.4, -20, -19, -15.4 + Math.sin(t * 5) * 1.6, 2.2, '#b9b2a4', 1.5);
    k.ell(-17.6, -14.6 + Math.sin(t * 5) * 1.6, 1.8, 2.4, { fill: '#6e6759', lw: 1.2, j: 0.04 });
    k.ell(-1, -19, 15.4, 7.2, { fill: '#c9c2b4', shade: F.shade2, lw: 2.2, j: 0.22 });
    k.ell(1, -16, 9, 3.4, { fill: F.cream, nostroke: true, j: 0 });
    // 脖+头(低头走路)
    k.poly([[10, -22], [15.4, -29.4], [20.6, -27.6], [16.4, -19]], { fill: '#c9c2b4', shade: F.shade, smooth: true, lw: 2, j: 0.12 });
    k.ell(21.2, -25, 6.4, 4.4, { fill: '#c9c2b4', shade: F.shade, lw: 2, j: 0.14 });
    k.ell(24.4, -23.4, 3.2, 2.6, { fill: F.cream, lw: 1.5, j: 0.05 });
    k.dot(22.6, -27, 1.1);
    k.poly([[15.6, -29.6], [14.4, -38], [18.4, -33]], { fill: '#c9c2b4', lw: 1.6, j: 0.05 });
    k.poly([[18.4, -30], [18.6, -38.6 + Math.sin(ph * 1.3) * 0.8 * mv], [21.4, -31]], { fill: '#c9c2b4', lw: 1.6, j: 0.05 });
    // 鞍 + 两只篓(跨背)
    const n = loadN(o, 10);
    k.rect(-5, -26.6, 10, 3.6, { fill: F.cream, lw: 1.5, r: 1, j: 0.08 });
    appleHeap(g, -0.8, -27.6 + bn.hop * 0.5 + heapJig(t, mv, 8, 0.8), n, 2.6, 18, seed);
    for (const bx of [-8.6, 8.6]) {
      k.poly([[bx - 6, -29], [bx + 6, -29], [bx + 4.6, -14.8], [bx - 4.6, -14.8]], { fill: F.wood, shade: F.shade2, lw: 1.9, j: 0.2 });
      k.line(bx - 5.4, -26, bx + 5.4, -26, { lw: 0.9, ext: 0, bow: 0 });
      k.line(bx - 4.8, -20.6, bx + 4.8, -20.6, { lw: 0.9, ext: 0, bow: 0 });
    }
    g.restore();
    if (o.unload) flyOut(g, 0, -34, 24, 8, o.unload, loadN({ ...o, unload: 0 }, 10), 2.6);
  });
};

/* ───── 2b 小推车 · 三轮小孩 (w≈36) ───── */
export const drawTrike: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  const rot = t * 9 * mv;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const bob = Math.abs(Math.sin(t * 9)) * 0.6 * mv + bn.dip * 0.5;
    const k = new Ink(g, seed + 2, 1.9, 0.18);
    k.shadow(0, 0.3, 19, 2);
    // 货斗(后)
    g.save();
    g.translate(0, -bob);
    const n = loadN(o, 8);
    appleHeap(g, -9.4, -13.4 + bn.hop + heapJig(t, mv, 11, 0.8), n, 2.5, 15, seed);
    k.poly([[-18, -15.6], [0, -15.6], [-2.4, -6.4], [-15.6, -6.4]], { fill: F.wood, shade: F.shade2, lw: 2, j: 0.2 });
    k.line(-16.4, -11, -1.6, -11, { lw: 0.9, ext: 0, bow: 0 });
    // 车架
    k.line(-1, -8, 9.6, -8.4, { lw: 2.2, ext: 0, bow: 0 });
    k.line(9.6, -8.4, 12, -17, { lw: 2.2, ext: 0, bow: 0 });
    k.line(9.6, -17.4, 15.6, -18, { lw: 2.2, ext: 0.4, bow: 0 }); // 车把
    // 座 + 骑手
    k.rect(2.4, -11.4, 6, 2, { fill: F.gray3, lw: 1.3, r: 0.8, j: 0.04 });
    const pd = Math.sin(rot);
    k.limb(5, -11.6, 9.6 + pd * 2.4, -4.4 - Math.max(0, pd) * 1.4, 2.8, F.gray2, 1.5);
    k.ell(9.8 + pd * 2.4, -3.4 - Math.max(0, pd) * 1.4, 2.4, 1.2, { fill: '#8a5f35', lw: 1.1, j: 0.04 });
    k.poly([[2.6, -12.2], [7.4, -12.4], [8.4, -19], [3.2, -19.6]], { fill: '#c7cfc8', shade: F.shade, smooth: true, lw: 1.7, j: 0.1 });
    k.limb(6.4, -18, 13, -18.2, 2.6, '#c7cfc8', 1.4);
    kid(g, seed + 3, 6.2, -24.4, 5, { hat: 'cap', mouth: mv > 0.1 ? 'o' : 'smile' });
    g.restore();
    wheel(g, seed + 11, -12, -4.6, 4.6, rot, 1.7);
    wheel(g, seed + 12, 12.4, -4.6, 4.6, rot, 1.7);
    k.dot(0, -4.6, 0.9, F.gray3);
    if (o.unload) flyOut(g, -9, -18, -18, 6, o.unload, loadN({ ...o, unload: 0 }, 8), 2.5);
  });
};

/* ───── 3b 卡车 · 大板车壮汉 (w≈70) ───── */
export const drawStrongman: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  const rot = t * 4 * mv;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const ph = t * 6.5;
    const bob = Math.abs(Math.sin(ph)) * 1.3 * mv + bn.dip * 0.5;
    const k = new Ink(g, seed + 2, 2.1, 0.2);
    k.shadow(0, 0.4, 36, 2.4);
    // 板车
    g.save();
    g.translate(0, bn.dip * 0.6);
    const n = loadN(o, 14);
    appleHeap(g, 8, -21 + bn.hop + heapJig(t, mv, 6.5, 1.1), n, 3.2, 40, seed);
    // 车板 + 围栏
    k.rect(-27, -22, 56, 4.6, { fill: F.wood, shade: F.shade2, lw: 2.2, r: 1, j: 0.2 });
    for (let i = 0; i < 6; i++) k.line(-22 + i * 9.6, -21.6, -22 + i * 9.6, -18.4, { lw: 0.8, ext: 0, bow: 0 });
    for (const px of [-26, 28]) k.limb(px, -22.4, px, -32.4, 2.6, F.woodDark, 1.5);
    k.line(-26, -29, 28, -29, { lw: 1.6, ext: 0, bow: 0.2 });
    // 车辕
    k.limb(26, -20.6, 37, -13, 2.4, F.woodDark, 1.6);
    g.restore();
    wheel(g, seed + 11, -14, -7, 7, rot, 2);
    wheel(g, seed + 12, 18, -7, 7, rot, 2);
    k.ell(-14, -7, 1.4, 1.4, { fill: F.woodDark, lw: 0.9, j: 0.03 });
    // 壮汉(走在前,拉辕):面向右 → 绳从肩到车辕 -> 他在车左侧,反向拉?(车朝右,人在车右前)
    // 人放在车右前方,倒着向前拉:简化为在右侧向前走,拉绳连到车头
    const hx = 52;
    g.save();
    g.translate(hx, 0);
    for (const [lx, p] of [[-2.4, 0], [3.4, Math.PI]] as const) {
      const a = Math.sin(ph + p) * 4.2 * mv;
      k.limb(lx, -11 - bob, lx + a, -1.4 - Math.max(0, -Math.cos(ph + p)) * 2 * mv, 5.2, '#8d8a7c', 1.8);
      k.ell(lx + a + 1.4, -1, 3.8, 1.9, { fill: '#8a5f35', lw: 1.4, j: 0.05 });
    }
    g.save();
    g.translate(0, -bob);
    g.rotate(0.14 * (mv > 0 ? 1 : 0.3));
    // 肌肉躯干(倒三角)+ 背心
    k.poly([[-8.4, -29], [9.2, -29], [5.4, -10.4], [-4.4, -10.4]], { fill: SKIN, shade: F.shade, smooth: true, lw: 2.2, j: 0.18 });
    k.poly([[-6.6, -28], [-1.4, -28], [-1.4, -12], [-4, -12]], { fill: F.white, lw: 1.6, j: 0.06 });
    k.poly([[2.6, -28], [7.8, -28], [4.6, -12], [2.6, -12]], { fill: F.white, lw: 1.6, j: 0.06 });
    // 手臂鼓起(拉绳:向后)
    k.limb(-6.6, -26.4, -14.4, -20, 6.4, SKIN, 1.9);
    k.ell(-11, -24, 3.6, 3.2, { fill: SKIN, shade: F.shade, lw: 1.7, j: 0.08 });
    k.ell(-15.6, -19.4, 2.8, 2.8, { fill: SKIN, lw: 1.6, j: 0.06 });
    kid(g, seed + 3, 2.6, -37.6, 7, { hat: 'band', mouth: 'grit' });
    // 眉毛压低
    k.line(0.4, -39.4, 5, -38.4, { lw: 1.6, ext: 0, bow: 0 });
    k.line(-5.8, -38.6, -2, -39.6, { lw: 1.6, ext: 0, bow: 0 });
    g.restore();
    g.restore();
    // 拉绳:人手 → 车辕尖
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(hx - 15.6, -19.4 - bob);
    g.quadraticCurveTo(hx - 24, -12 + 2 * (1 - mv), 37, -13);
    g.stroke();
    if (mv > 0.2) puffs(g, hx - 6, -4, -10, -3, t, 3, 0.5, 0.7); // 脚下尘
    if (o.unload) flyOut(g, 8, -36, -24, 10, o.unload, loadN({ ...o, unload: 0 }, 14), 3.2);
  });
};

/* ───── 4b 货船 · 小黄鸭船 (w≈80) ───── */
export const drawDuckBoat: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const bob = Math.sin(t * 2.6) * (1 + mv * 1.4) + bn.dip;
    const roll = Math.sin(t * 2 + 1) * (0.025 + mv * 0.02);
    const k = new Ink(g, seed + 2, 2.2, 0.22);
    // 水(背景)
    g.save();
    g.translate(0, 0);
    k.ell(0, -1, 42, 3.2, { fill: F.water, lw: 1.4, j: 0.2 });
    g.restore();
    g.save();
    g.translate(0, -2 + bob * 0.8);
    g.rotate(roll);
    // 鸭身(船体):大椭圆,尾巴翘起
    const n = loadN(o, 14);
    appleHeap(g, -6, -18 + bn.hop + heapJig(t, mv, 7, 1), n, 3.1, 36, seed);
    k.poly([[-40, -20], [-34, -9.6], [-16, -3.2], [14, -3.2], [30, -9], [34, -22], [26, -24], [8, -17], [-20, -16.6], [-34, -22]], { fill: '#f8ecb4', shade: F.shade2, smooth: true, lw: 2.4, j: 0.28 });
    k.poly([[-40, -20], [-44, -27.6], [-36, -23]], { fill: '#f8ecb4', lw: 1.9, j: 0.1 }); // 翘尾
    // 翅
    k.poly([[-26, -15.4], [-8, -14], [-14, -8], [-28, -9.4]], { fill: '#f3dd8a', shade: F.shade, smooth: true, lw: 1.7, j: 0.1 });
    k.stroke([[-24, -13], [-14, -12.4]], { lw: 0.9, smooth: true });
    // 脖子 + 头
    k.poly([[22, -19], [30, -21], [34, -36], [26, -37]], { fill: '#f8ecb4', shade: F.shade, smooth: true, lw: 2.2, j: 0.16 });
    k.ell(33, -39, 8.2, 7.4, { fill: '#f8ecb4', shade: F.shade, lw: 2.3, j: 0.18 });
    k.poly([[38, -40], [49, -38.6], [47, -34.4], [38, -35.6]], { fill: '#f1b04c', lw: 1.8, j: 0.1 });
    k.dot(36.4, -42, 1.4);
    k.dot(35.6, -42.6, 0.5, F.white);
    k.ell(30, -37, 2, 1.2, { fill: '#f2c9b0', nostroke: true, j: 0 });
    k.stroke([[30.4, -45], [29, -48.6], [31.4, -47.6]], { lw: 1.3, smooth: true }); // 呆毛
    // 尾部货仓挡板
    k.line(-34, -17.6, -16, -16.6, { lw: 1.5, ext: 0, bow: 0 });
    g.restore();
    // 前景浪
    for (let i = 0; i < 4; i++) {
      const u = (t * (0.5 + mv * 0.9) + i * 0.27) % 1;
      const wx = lerp(-36, 40, i / 3) + Math.sin(u * 6) * 2;
      const wy = -3.4 + Math.sin(u * TAU) * 0.8;
      k.stroke([[wx - 6, wy], [wx - 2, wy - 2.2], [wx + 2.4, wy - 0.4], [wx + 6, wy - 2]], { lw: 1.5, smooth: true });
    }
    if (mv > 0.2) for (let i = 0; i < 3; i++) {
      const u = (t * 1.3 + i / 3) % 1;
      g.save();
      g.globalAlpha *= (1 - u) * 0.9;
      g.beginPath();
      g.arc(-44 - u * 8, -4 - u * 5, 1.2 + u * 1.2, 0, TAU);
      g.fillStyle = F.white;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = INK;
      g.stroke();
      g.restore();
    }
    if (o.unload) dropOut(g, -6, -30, 8, o.unload, loadN({ ...o, unload: 0 }, 14), 3);
  });
};

/* ───── 5b 直升机 · 竹蜻蜓小孩 (w≈50) ───── */
export const drawBamboo: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const fly = (o.fly ?? 1) as number;
    const hov = 22 * fly + Math.sin(t * 2.4) * 1.6 + bn.dip * 0.5;
    const k = new Ink(g, seed + 2, 1.9, 0.18);
    // 地面影
    g.save();
    g.globalAlpha *= 0.5 - fly * 0.18;
    k.shadow(0, 0.3, 14 - fly * 4, 2.2, 0.2);
    g.restore();
    g.save();
    g.translate(0, -hov);
    g.rotate(0.05 * mv * Math.sin(t * 1.7) + 0.06 * mv);
    // 腿悬着晃
    const dg = Math.sin(t * 3) * 1.2;
    k.limb(-2.4, -16, -2.4 + dg * 0.5, -8.2, 3, F.gray2, 1.5);
    k.limb(2.4, -16, 2.4 - dg * 0.5, -8.2, 3, F.gray2, 1.5);
    k.ell(-2.8 + dg * 0.5, -7.6, 2.6, 1.5, { fill: '#8a5f35', lw: 1.2, j: 0.05 });
    k.ell(2.6 - dg * 0.5, -7.6, 2.6, 1.5, { fill: '#8a5f35', lw: 1.2, j: 0.05 });
    // 身体 + 举着的手拉竹蜻蜓杆
    k.poly([[-4.6, -16], [4.6, -16], [5.4, -28], [-5.4, -28]], { fill: '#c7cfc8', shade: F.shade, smooth: true, lw: 1.9, j: 0.14 });
    k.limb(-4.4, -26, -2.4, -35.4, 2.8, '#c7cfc8', 1.4);
    k.limb(4.4, -26, 2.4, -35.4, 2.8, '#c7cfc8', 1.4);
    k.ell(0, -36.4, 3.4, 2.6, { fill: SKIN, lw: 1.3, j: 0.05 });
    // 篮子挂在脚下(提在手/腰),装苹果
    const n = loadN(o, 6);
    k.line(-6.4, -22, -10.4, -9.4, { lw: 1.3, ext: 0, bow: 0 });
    k.line(6.4, -22, 10.4, -9.4, { lw: 1.3, ext: 0, bow: 0 });
    appleHeap(g, 0, -4.4 + bn.hop * 0.5 + heapJig(t, mv, 8, 0.6), n, 2.3, 12, seed);
    k.poly([[-8.4, -8.6], [8.4, -8.6], [6.2, -0.6], [-6.2, -0.6]], { fill: F.wood, shade: F.shade2, lw: 1.9, j: 0.2 });
    k.rect(-9.2, -9.6, 18.4, 2, { fill: F.warm, lw: 1.5, r: 0.8, j: 0.05 });
    // 头(在身体上,头顶接竹蜻蜓杆)
    kid(g, seed + 3, 0.4, -34.4, 6.2, { hat: 'goggle', mouth: 'o' });
    // 竹蜻蜓:杆 + 旋转桨(椭圆糊)
    k.limb(0, -40, 0, -50, 1.5, '#cdb877', 1.3);
    const ph = t * 30 * Math.max(fly, 0.3);
    const wob = Math.sin(ph) * 15;
    g.save();
    g.translate(0, -51);
    g.globalAlpha *= 0.34;
    g.beginPath();
    g.ellipse(0, 0, 21, 2.8, 0, 0, TAU);
    g.fillStyle = F.gray3;
    g.fill();
    g.globalAlpha *= 2.2;
    g.lineCap = 'round';
    g.lineWidth = 3.6;
    g.strokeStyle = INK;
    g.beginPath();
    g.moveTo(-wob, 0);
    g.lineTo(wob, 0);
    g.stroke();
    g.lineWidth = 2.1;
    g.strokeStyle = '#d6bd7e';
    g.stroke();
    g.restore();
    k.dot(0, -51, 1.4, INK);
    g.restore();
    if (o.unload) dropOut(g, 0, -hov - 6, hov + 4, o.unload, loadN({ ...o, unload: 0 }, 6), 2.3);
  });
};

/* ───── 6b 飞机 · 大纸飞机 (w≈84) ───── */
export const drawPaperPlane: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const fly = (o.fly ?? 1) as number;
    const hov = 18 * fly + Math.sin(t * 2.1) * 2.2 * (0.5 + fly) + bn.dip * 0.5;
    const roll = Math.sin(t * 1.6) * 0.04 + 0.05 * mv;
    const k = new Ink(g, seed + 2, 2.1, 0.2);
    g.save();
    g.globalAlpha *= 0.5 - fly * 0.25;
    k.shadow(0, 0.3, 30 - fly * 8, 3, 0.2);
    g.restore();
    g.save();
    g.translate(0, -hov - 10);
    g.rotate(roll);
    // 机身侧面:折纸三角 + 折痕
    k.poly([[-42, -6], [44, -1], [-8, 14], [-30, 6]], { fill: F.warm, shade: F.shade2, lw: 2.2, j: 0.25 });
    k.poly([[-42, -6], [44, -1], [-4, -4]], { fill: F.white, lw: 2.2, j: 0.2 });
    k.line(-4, -4, -8, 14, { lw: 1.2, ext: 0, bow: 0 });
    k.line(-30, 6, -4, -4, { lw: 1.1, ext: 0, bow: 0 });
    k.poly([[-42, -6], [-30, -22], [-24, -4]], { fill: F.cream, shade: F.shade, lw: 2, j: 0.14 }); // 尾翼折角
    // 货:露在折缝里
    const n = loadN(o, 12);
    appleHeap(g, -2, -3.4 + bn.hop * 0.5 + heapJig(t, mv, 7, 0.8), n, 2.9, 32, seed);
    k.poly([[-14, -1.6], [30, 0.6], [-8, 8]], { fill: F.cream, lw: 1.7, j: 0.1 }); // 前盖
    // 飞行员:大头 + 护目镜 + 围巾飘
    kid(g, seed + 3, 14, -10.4, 6.6, { hat: 'goggle', mouth: 'smile' });
    const sc = Math.sin(t * 9) * 2 * mv;
    k.poly([[8, -4], [-2, -6 + sc], [-14, -4 + sc * 1.4], [-4, -1.4], [8, -1]], { fill: F.white, lw: 1.6, j: 0.1 });
    // 机翼下掠的纸屑/风线
    for (let i = 0; i < 3; i++) {
      const u = (t * 1.1 + i / 3) % 1;
      g.save();
      g.globalAlpha *= (1 - u) * mv;
      k.line(-44 - u * 14, -2 - i * 4 + 2, -52 - u * 14 - 6, -2 - i * 4 + 2, { lw: 1.4, ext: 0, bow: 0 });
      g.restore();
    }
    g.restore();
    if (o.unload) dropOut(g, -2, -hov - 14, hov + 12, o.unload, loadN({ ...o, unload: 0 }, 12), 2.9);
  });
};

/* ───── 7b 传送门 · 魔术帽 (w≈44) ───── */
export const drawMagicHat: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0, mv = o.move ?? 0;
  place(ctx, x, y, s, o, true, (g) => {
    const bn = bounce(o);
    const k = new Ink(g, seed + 2, 2.1, 0.2);
    k.shadow(0, 0.4, 20, 2);
    // 地面魔法圈
    g.save();
    g.globalAlpha *= 0.85;
    g.lineWidth = 1.4;
    g.strokeStyle = INK;
    g.setLineDash([3, 3]);
    g.lineDashOffset = -t * 6;
    g.beginPath();
    g.ellipse(0, -1.2, 22, 4, 0, 0, TAU);
    g.stroke();
    g.restore();
    const hop = Math.abs(Math.sin(t * 3)) * 1.6 * mv + bn.dip;
    g.save();
    g.translate(0, -hop);
    g.rotate(Math.sin(t * 1.8) * 0.04);
    // 帽身(礼帽)
    k.poly([[-12, -3.4], [12, -3.4], [11, -38], [-11, -38]], { fill: '#6e6759', shade: F.shade2, smooth: true, lw: 2.3, j: 0.2 });
    // 帽檐
    k.ell(0, -3.6, 21, 4.4, { fill: '#6e6759', shade: F.shade2, lw: 2.2, j: 0.2 });
    k.poly([[-11.4, -9], [11.4, -9], [11.6, -15], [-11.6, -15]], { fill: F.white, lw: 1.8, j: 0.08 });
    sparkle(g, 0, -12, 2.1, F.gold, t * 2, true);
    // 帽口(顶):椭圆黑洞
    k.ell(0, -38, 11, 3.2, { fill: INK, lw: 1.9, j: 0.1 });
    // 高光
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1.2;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-7.6, -33);
    g.lineTo(-7.2, -18);
    g.stroke();
    const n = loadN(o, 10);
    // 苹果从帽口冒出(满载:一堆在口)
    for (let i = 0; i < Math.min(4, n); i++) {
      const u = (t * 0.9 + i * 0.25) % 1;
      const ax = Math.sin(i * 2.4) * 4.4 + (u - 0.5) * 3;
      const ay = -40 - Math.sin(u * Math.PI) * (6 + n * 0.5) * mv - (i % 2) * 1.6 + bn.hop;
      drawApple(g, ax, ay + (mv ? 0 : 2), 3.1, { leaf: i % 2 === 0 });
    }
    // 兔耳(彩蛋):载量 >0 时探出
    if (n > 0) {
      const wig = Math.sin(t * 4) * 0.12;
      g.save();
      g.translate(7, -37);
      g.rotate(0.35 + wig);
      k.ell(0, -6, 1.8, 5.6, { fill: F.white, lw: 1.5, j: 0.05 });
      k.ell(0, -6, 0.7, 3.8, { fill: '#f2c9b0', nostroke: true, j: 0 });
      g.restore();
    }
    g.restore();
    for (let i = 0; i < 3; i++) {
      const a = t * 1.4 + (i * TAU) / 3;
      sparkle(g, Math.cos(a) * 20, -22 + Math.sin(a * 1.3) * 14, 1.6 + Math.sin(a * 2) * 0.6 + 0.6, i % 2 ? F.gold : F.white, a, false);
    }
    if (o.unload) flyOut(g, 0, -44, 26, 40, o.unload, loadN({ ...o, unload: 0 }, 10), 3);
  });
};

void clamp;
