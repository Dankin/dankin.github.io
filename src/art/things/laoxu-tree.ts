// 老徐在新树档上的站位:drawLaoXuAt(ctx, spot, x, y, s, o)  (x,y)=脚下站点(与 art-nature 的 treeAnchors 对齐)
// spot: 'ground' 地面(原样) | 'treehouse' 巨树树屋平台(带栏杆,探身看/挥手) | 'basket' 云树吊篮里(篮沿遮腿,随缆绳摆动) | 'top' 星树树顶彩灯下(提着灯串,灯泡一闪一闪)
// 老徐在大树上不缩成点:调用方 s 请≥0.55(整身≈36 世界单位),脸/墨镜/草帽仍可辨。
// treeAnchors 接口(由 art-nature 导出):treeAnchors(tier:0..4, s?) → {treehouse?:{x,y}, basket?:{x,y}, top?:{x,y}} 相对树根底部中心。
import { drawLaoXu, type LaoXuState } from './laoxu.ts';
import { F, INK, Ink, TAU, clamp, sparkle } from './ink.ts';
import type { ThingFn } from './types.ts';

export type LaoXuSpot = 'ground' | 'treehouse' | 'basket' | 'top';
export const LAOXU_SPOTS: LaoXuSpot[] = ['ground', 'treehouse', 'basket', 'top'];
export const LAOXU_SPOT_NAMES: Record<LaoXuSpot, string> = { ground: '地面', treehouse: '树屋', basket: '吊篮旁', top: '树顶彩灯下' };
export interface TreeAnchors { treehouse?: { x: number; y: number }; basket?: { x: number; y: number }; top?: { x: number; y: number } }

const BULB = ['#f2c14e', '#fffdf6', '#9bd1c9', '#f2c14e'];

export const drawLaoXuAt = (ctx: CanvasRenderingContext2D, spot: LaoXuSpot, x: number, y: number, s: number, o: Parameters<ThingFn>[4] = {}): void => {
  const t = o.t ?? 0, seed = o.seed ?? 1, state = ((o.state as LaoXuState | undefined) ?? (spot === 'ground' ? 'idle' : 'watch'));
  const lo = { ...o, state, tree: false, t, seed };
  if (spot === 'ground') { drawLaoXu(ctx, x, y, s, { ...o, state }); return; }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const k = new Ink(ctx, seed + 40, 1.9, 0.14);
  if (spot === 'treehouse') {
    // 平台木板 + 后栏杆;老徐站在板上;前栏杆遮住小腿
    k.rect(-34, -2, 68, 5, { fill: F.wood, shade: F.shade2, lw: 2, r: 1, j: 0.12 });
    for (let i = -3; i <= 3; i++) k.line(i * 9, -1.4, i * 9, 2.4, { lw: 0.8, ext: 0, bow: 0 });
    k.limb(-34, 2, -26, 12, 3, F.woodDark, 1.5);
    k.limb(34, 2, 26, 12, 3, F.woodDark, 1.5);
    k.line(-32, -22, 32, -22, { lw: 1.6, ext: 0, bow: 0.1 });
    for (const px of [-32, -16, 0, 16, 32]) k.line(px, -22, px, -2, { lw: 1.3, ext: 0, bow: 0 });
    drawLaoXu(ctx, 0, -2, 0.78, lo as never);
    k.line(-32, -12, 32, -12, { lw: 1.6, ext: 0, bow: 0.1 });
    k.line(-32, -6, 32, -6, { lw: 1.2, ext: 0, bow: 0 });
    for (const px of [-28, -10, 14, 30]) k.line(px, -12, px, -2, { lw: 1.3, ext: 0, bow: 0 });
    // 屋檐灯笼
    const sw = Math.sin(t * 2) * 1.5;
    k.line(26, -52, 26, -44, { lw: 1, ext: 0, bow: 0 });
    k.ell(26 + sw, -40, 3.4, 4, { fill: '#f2c14e', lw: 1.3, j: 0.04 });
  } else if (spot === 'basket') {
    const sway = Math.sin(t * 1.3) * 0.045;
    ctx.save();
    ctx.rotate(sway);
    // 缆绳(上方)+ 篮底
    k.line(-18, -46, 0, -76, { lw: 1.2, ext: 0, bow: 0 });
    k.line(18, -46, 0, -76, { lw: 1.2, ext: 0, bow: 0 });
    k.ell(0, -2, 22, 4, { fill: F.warm, lw: 1.5, j: 0.08 });
    drawLaoXu(ctx, 0, -5, 0.78, lo as never);
    // 前篮沿:编织纹
    k.poly([[-23, -14], [23, -14], [19, -1], [-19, -1]], { fill: F.wood, shade: F.shade2, smooth: false, lw: 2, j: 0.14 });
    for (let i = -3; i <= 3; i++) k.line(i * 6.4, -13.4, i * 5.6, -1.6, { lw: 0.8, ext: 0, bow: 0 });
    
    k.rect(-25, -17, 50, 4, { fill: F.cream, lw: 1.7, r: 1.6, j: 0.08 });
    ctx.restore();
  } else {
    // 树顶:星星彩灯串在上方左右下垂;老徐站在最顶枝,手提一串灯
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-40, -56);
    ctx.quadraticCurveTo(0, -36, 40, -56);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const u = i / 6;
      const bx = -40 + u * 80, by = -56 + Math.sin(u * Math.PI) * 14 + 2;
      const on = (Math.sin(t * 3 + i * 1.3) + 1) / 2;
      k.ell(bx, by + 3, 2.2, 2.8, { fill: BULB[i % 4], lw: 1.1, j: 0.03 });
      ctx.save();
      ctx.globalAlpha *= 0.18 + on * 0.3;
      ctx.fillStyle = BULB[i % 4];
      ctx.beginPath(); ctx.arc(bx, by + 3, 5 + on * 2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    k.ell(0, 1, 20, 3.6, { fill: F.leaf, shade: F.shade2, lw: 1.8, j: 0.1 });
    for (const px of [-12, 0, 12]) k.stroke([[px - 2, 0], [px, 2], [px + 2, 0]], { lw: 0.9 });
    drawLaoXu(ctx, 0, -3, 0.78, lo as never);
    sparkle(ctx, -30 + Math.sin(t) * 3, -40, 3, F.gold, t * 2, true);
    sparkle(ctx, 32, -34 + Math.cos(t * 1.4) * 3, 2.4, '#fffdf6', t * 3, true);
  }
  void clamp;
  ctx.restore();
};
