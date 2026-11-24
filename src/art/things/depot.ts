// 圣诞老人收货站:雪地小屋 + 收货口(苹果→包裹)+ 小精灵传递 + 雪橇 + 礼物堆。
// drawSantaDepot(ctx,x,y,s,{level:0..1 礼物堆高度, receive:0..1 一次收货进度(包裹落入/精灵传递), takeoff:0..1 雪橇起飞, t, sleigh:boolean(默认 true)})
// (x,y)=底部中心,宽 ≈ 150(小屋居中,雪橇在右,礼物堆在左)。
import { F, INK, Ink, TAU, clamp, ease, lerp, sparkle } from './ink.ts';
import { drawApple } from './apple.ts';
import type { C } from './ink.ts';
import type { ThingFn } from './types.ts';

const RED = '#c4463a';
const GREEN = '#7ea06a';

function box(k: Ink, g: C, x: number, y: number, w: number, h: number, col: string, ribCol: string): void {
  k.rect(x - w / 2, y - h, w, h, { fill: col, lw: 1.3, j: 0.06 });
  g.save();
  g.fillStyle = ribCol;
  g.fillRect(x - w * 0.09, y - h + 0.5, w * 0.18, h - 1);
  g.fillRect(x - w / 2 + 0.6, y - h * 0.58, w - 1.2, h * 0.16);
  g.restore();
  k.dot(x, y - h - 0.7, 1.2, ribCol);
}

/** 小精灵:尖帽,抱/递包裹。pass 0..1 左右传递相位。*/
export function drawElf(g: C, seed: number, x: number, y: number, o: { t?: number; hold?: boolean; dir?: 1 | -1; arm?: number } = {}): void {
  const k = new Ink(g, seed, 1.7, 0.14);
  const t = o.t ?? 0;
  const d = o.dir ?? 1;
  g.save();
  g.translate(x, y);
  g.scale(d, 1);
  const bob = Math.abs(Math.sin(t * 6)) * 0.8;
  k.limb(-1.8, -5, -2, -0.6, 2, '#6f8f5e', 1.3);
  k.limb(1.8, -5, 2, -0.6, 2, '#6f8f5e', 1.3);
  g.translate(0, -bob);
  k.poly([[-4, -5], [4, -5], [3.4, -12], [-3.4, -12]], { fill: GREEN, shade: F.shade, smooth: true, lw: 1.5, j: 0.08 });
  k.line(-3.6, -8.4, 3.6, -8.4, { lw: 1.1, ext: 0, bow: 0 });
  const arm = o.arm ?? 0;
  k.limb(3, -10.4, 6.4 + arm * 2.4, -9.6 - arm * 1.6, 2, F.skin, 1.3);
  k.limb(-3, -10.4, -4.6, -8.4, 2, F.skin, 1.3);
  k.ell(0, -16, 4.6, 4.4, { fill: F.skin, shade: F.shade, lw: 1.6, j: 0.08 });
  k.dot(1.8, -16.2, 0.8);
  k.dot(-1.6, -16.2, 0.8);
  k.stroke([[0.2, -14], [1.4, -13.4], [2.6, -14.2]], { lw: 0.9, smooth: true });
  k.ell(-4.6, -16, 1, 1.6, { fill: F.skin, lw: 1, j: 0.03 }); // 尖耳
  k.poly([[-4.6, -18.6], [4.6, -18.6], [0.4, -29 + Math.sin(t * 4) * 0.4]], { fill: GREEN, lw: 1.6, j: 0.06 });
  k.dot(0.6, -29 + Math.sin(t * 4) * 0.4, 1.2, F.white);
  if (o.hold) {
    k.rect(3.6 + arm * 2.4, -15.4 - arm * 1.6, 6.4, 5.4, { fill: F.cream, lw: 1.4, r: 0.4, j: 0.06 });
    k.line(6.8 + arm * 2.4, -15.4 - arm * 1.6, 6.8 + arm * 2.4, -10, { lw: 1, ext: 0, bow: 0 });
  }
  g.restore();
}

/** 雪橇(含驯鹿头 + 礼物袋)。lift 0..1 抬头离地。(x,y)=雪橇底中心 */
function sleigh(g: C, seed: number, x: number, y: number, t: number, lift: number, bag: number): void {
  const k = new Ink(g, seed, 2, 0.18);
  g.save();
  g.translate(x, y);
  g.rotate(-0.18 * lift + Math.sin(t * 3) * 0.02 * lift);
  // 雪橇滑板
  k.stroke([[-26, -2], [-12, 0.4], [18, 0.4], [28, -1], [31, -6], [28, -9]], { lw: 2.4, smooth: true });
  k.poly([[-22, -3.4], [22, -3.4], [26, -14], [-26, -16]], { fill: '#d4b27a', shade: F.shade2, smooth: true, lw: 2.1, j: 0.2 });
  k.stroke([[-22, -8], [22, -8]], { lw: 0.9 });
  // 礼物袋
  const bh = 8 + bag * 16;
  k.poly([[-22, -15], [-26, -15 - bh * 0.5], [-14, -15 - bh], [4, -15 - bh * 0.85], [8, -15]], { fill: F.cream, shade: F.shade, smooth: true, lw: 2, j: 0.2 });
  k.stroke([[-10, -15 - bh * 0.95], [-6, -15 - bh - 1.8], [-1, -15 - bh * 0.88]], { lw: 1.6, smooth: true });
  for (let i = 0; i < 3; i++) k.rect(-14 + i * 7, -15 - bh * 0.5 - (i % 2) * 2, 5.4, 4.6, { fill: i % 2 ? F.white : '#e8d7a8', lw: 1.1, r: 0.3, j: 0.05 });
  // 圣诞老人(只露半身:红帽白胡子)
  k.ell(15, -22, 6, 5.8, { fill: F.skin, shade: F.shade, lw: 1.8, j: 0.1 });
  k.poly([[9, -24], [21, -24], [14, -25.4]], { fill: F.white, nostroke: true });
  k.ell(15, -18.6, 5.2, 3.6, { fill: F.white, lw: 1.5, j: 0.1 });
  k.dot(17.2, -22.6, 0.8);
  k.dot(13, -22.6, 0.8);
  k.poly([[8.6, -25], [21.4, -25], [17, -35], [13, -33.6]], { fill: RED, lw: 1.7, j: 0.06 });
  k.dot(17, -35.6, 1.6, F.white);
  k.line(8.6, -25, 21.4, -25, { lw: 2.2, ext: 0, bow: 0 });
  // 缰绳 + 驯鹿
  g.strokeStyle = INK;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(28, -10);
  g.quadraticCurveTo(34, -10 - lift * 4, 44, -12);
  g.stroke();
  const rx = 47, ry = -2 - lift * 8;
  const gal = Math.sin(t * 7) * lift * 3;
  for (const [lx, p] of [[-5, 0], [-1, Math.PI], [5, Math.PI], [9, 0]] as const) {
    const a = Math.sin(t * 7 + p) * (1 + lift * 2);
    k.limb(rx + lx, ry - 9, rx + lx + a, ry - 0.8 - (lift > 0.1 ? 3 : 0) - Math.max(0, -Math.cos(t * 7 + p)) * 2, 2.2, '#b08a5a', 1.5);
  }
  k.ell(rx + 1, ry - 11 + gal * 0.2, 9.4, 5, { fill: '#c7a06c', shade: F.shade2, lw: 1.9, j: 0.16 });
  k.poly([[rx + 6, ry - 13], [rx + 11, ry - 19], [rx + 14.4, ry - 17], [rx + 10, ry - 11]], { fill: '#c7a06c', lw: 1.7, j: 0.1 });
  k.ell(rx + 14, ry - 17.6, 3.8, 3.2, { fill: '#c7a06c', lw: 1.7, j: 0.08 });
  k.dot(rx + 15, ry - 18.4, 0.8);
  k.dot(rx + 17.6, ry - 17.4, 1.5, '#d9a521'); // 发光红鼻子→金
  k.stroke([[rx + 12, ry - 20], [rx + 10, ry - 25], [rx + 12, ry - 27], [rx + 14, ry - 25.4]], { lw: 1.4, smooth: true });
  k.stroke([[rx + 10, ry - 25], [rx + 7.4, ry - 26.4]], { lw: 1.2 });
  g.restore();
}

export const drawSantaDepot: ThingFn = (ctx, x, y, s, o = {}) => {
  const seed = o.seed ?? 1, t = o.t ?? 0;
  const level = clamp((o.level as number | undefined) ?? 0, 0, 1);
  const rc = clamp((o.receive as number | undefined) ?? 0, 0, 1);
  const to = clamp((o.takeoff as number | undefined) ?? 0, 0, 1);
  const showSleigh = o.sleigh !== false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const k = new Ink(ctx, seed + 2, 2.1, 0.2);
  // 雪地
  k.ell(0, 0, 82, 5, { fill: F.white, shade: F.shade, lw: 1.6, j: 0.28 });
  for (const [sx, sy] of [[-54, -2], [50, -3], [-20, -1], [74, -1]]) k.stroke([[sx - 4, sy], [sx, sy - 1.4], [sx + 4, sy]], { lw: 1, smooth: true });
  // 小屋:居中
  const hx = -2;
  k.rect(hx - 20, -34, 40, 34, { fill: '#e4cfa0', shade: F.shade2, lw: 2.2, r: 1, j: 0.22 });
  for (let i = 0; i < 4; i++) k.line(hx - 20, -7 - i * 7, hx + 20, -7 - i * 7, { lw: 0.8, ext: 0, bow: 0 });
  k.poly([[hx - 25, -33], [hx, -52], [hx + 25, -33]], { fill: F.white, shade: F.shade, lw: 2.3, j: 0.16 });
  k.poly([[hx - 25, -33], [hx, -52], [hx - 4, -53]], { nostroke: true, fill: '#e8e0d0' });
  k.rect(hx + 10, -52, 6, 11, { fill: '#cdb893', lw: 1.7, r: 0.5, j: 0.08 });
  // 烟
  for (let i = 0; i < 3; i++) {
    const u = (t * 0.5 + i / 3) % 1;
    ctx.save();
    ctx.globalAlpha *= (1 - u) * 0.9;
    k.ell(hx + 13 + Math.sin(u * 5 + i) * 3, -56 - u * 20, 2.2 + u * 3, 2 + u * 2.6, { fill: F.white, lw: 1.2, j: 0.1 });
    ctx.restore();
  }
  // 门 + 窗(亮)
  k.rect(hx - 5, -19, 10, 19, { fill: '#8a6a42', lw: 1.8, r: 3, j: 0.12 });
  k.dot(hx + 2.4, -9, 0.9, F.gold);
  k.rect(hx - 17, -28, 9, 9, { fill: '#f6e6a0', lw: 1.6, r: 1, j: 0.08 });
  k.line(hx - 12.5, -28, hx - 12.5, -19, { lw: 0.9, ext: 0, bow: 0 });
  k.line(hx - 17, -23.5, hx - 8, -23.5, { lw: 0.9, ext: 0, bow: 0 });
  // 招牌:星 + "收货"
  k.rect(hx + 8, -33, 10, 6, { fill: F.cream, lw: 1.4, r: 0.6, j: 0.06 });
  ctx.fillStyle = INK;
  ctx.font = 'bold 5.4px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('收货', hx + 13, -28.6);
  // 门口收货斗:苹果→包裹
  const chx = hx + 30;
  k.poly([[chx - 8, -14], [chx + 8, -14], [chx + 5, -3], [chx - 5, -3]], { fill: F.wood, shade: F.shade2, lw: 1.9, j: 0.12 });
  // 收货动画:苹果落入斗 → 包裹滑出 → 精灵接过
  if (rc > 0 && rc < 1) {
    const a = clamp(rc / 0.3, 0, 1);
    if (a < 1) drawApple(ctx, chx + 0 - (1 - a) * 6, -36 + a * 22, 3.4, {});
    const b = clamp((rc - 0.3) / 0.35, 0, 1);
    if (b > 0 && b < 1) {
      const bx = lerp(chx, chx + 22, ease(b)), by = -6 - Math.sin(b * Math.PI) * 6;
      box(k, ctx, bx, by, 7, 6, F.cream, RED);
    }
  }
  // 小精灵 A(门口):旁观/递
  const pass = rc > 0.5 ? clamp((rc - 0.5) / 0.5, 0, 1) : 0;
  drawElf(ctx, seed + 5, chx + 20, 0, { t, hold: rc > 0.6 && rc < 0.8, dir: -1, arm: Math.sin(pass * Math.PI) });
  // 小精灵 B(雪橇旁):接 → 搬上雪橇
  const sx = 68;
  const takeoffX = to * 140, takeoffY = -ease(to) * 90;
  drawElf(ctx, seed + 6, sx - 22, 0, { t: t + 0.3, hold: rc > 0.85 && to === 0, dir: 1, arm: 0.5 });
  // 礼物堆(左):高度随 level
  const nBox = Math.round(level * 10);
  const px = -60;
  const cols = [F.cream, F.white, '#e8d7a8', '#d9d1c0'];
  const ribs = [RED, '#6f8f5e', F.gold, RED];
  let idx = 0;
  const rows = [4, 3, 2, 1];
  let yy = 0;
  for (let r = 0; r < rows.length && idx < nBox; r++) {
    const w = 13 - r, h = 10.4 - r * 0.6;
    for (let i = 0; i < rows[r] && idx < nBox; i++, idx++) {
      const bx = px + (i - (rows[r] - 1) / 2) * (w + 0.4);
      box(k, ctx, bx, -yy, w, h, cols[idx % cols.length], ribs[idx % ribs.length]);
    }
    yy += h;
  }
  if (level >= 0.999) {
    sparkle(ctx, px, -yy - 10, 4, F.gold, t, true);
    sparkle(ctx, px - 14, -yy + 2, 2.4, F.white, t * 1.3, false);
  }
  // 雪橇
  if (showSleigh) {
    ctx.save();
    ctx.translate(takeoffX, takeoffY);
    if (to > 0) ctx.globalAlpha *= 1 - clamp((to - 0.8) / 0.2, 0, 1);
    sleigh(ctx, seed + 7, sx + 16, -0.5, t, ease(clamp(to * 3, 0, 1)), level);
    ctx.restore();
    // 起飞星尘
    if (to > 0 && to < 1) for (let i = 0; i < 6; i++) {
      const u = (to * 1.4 - i * 0.07);
      if (u <= 0 || u >= 1) continue;
      sparkle(ctx, takeoffX - u * 30 + 20 - i * 6, takeoffY + 10 + Math.sin(i * 2) * 6, 2.4 * (1 - u), i % 2 ? F.gold : F.white, t * 2 + i, false);
    }
  }
  ctx.restore();
  void TAU;
};
