// 新阶段说明卡框(王国保卫战风):木框 + 铆钉 + 羊皮纸 + 顶部缎带标题 + 左侧缩略图槽 + "NEW" 星爆。
// drawStageCard 返回缩略图槽矩形 [x,y,w,h](世界/CSS 坐标),调用方在其中画树/运输/终点的小图。(x,y)=卡左上角。
// 不使用 shadowBlur;文本用 UI_FONT。opts.p = 弹入进度 0..1(>=1 或 undefined 为稳定态;约 0.35s 弹入,配合 ~1s 停顿)。
import { F, INK, Ink, clamp, sparkle } from './ink.ts';
import type { C } from './bake.ts';
import { UI_FONT } from './ui.ts';

export interface StageCardOpt {
  title: string;
  /** 副标题(小一号,如"第 3 档 · 巨树") */
  sub?: string;
  /** 说明文字,每项一行(自动不折行,调用方控制长度) */
  lines?: string[];
  seed?: number;
  t?: number;
  /** 弹入进度 0..1 */
  p?: number;
  /** 是否显示 NEW 星爆,默认 true */
  isNew?: boolean;
  /** 缩略图槽绘制回调:已 clip 到槽内,坐标原点=槽左上角 */
  thumb?: (g: C, w: number, h: number) => void;
}

const popScale = (p: number): number => {
  if (p >= 1) return 1;
  const u = clamp(p, 0, 1);
  return 1 + Math.sin(u * Math.PI * 1.5) * (1 - u) * 0.18 - (1 - u) * 0.55;
};

export function drawStageCard(ctx: C, x: number, y: number, w: number, h: number, o: StageCardOpt): [number, number, number, number] {
  const seed = o.seed ?? 7, t = o.t ?? 0;
  const sc = o.p === undefined ? 1 : popScale(o.p);
  ctx.save();
  if (o.p !== undefined) ctx.globalAlpha *= clamp(o.p * 3, 0, 1);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.sin(t * 1.3) * 0.006 + (o.p !== undefined && o.p < 1 ? (1 - o.p) * 0.08 : 0));
  ctx.scale(sc, sc);
  ctx.translate(-w / 2, -h / 2);
  const k = new Ink(ctx, seed, 2.2, 0.16);
  // 投影
  ctx.fillStyle = 'rgba(27,20,16,0.18)';
  ctx.fillRect(3, 4, w, h);
  // 木框
  k.rect(0, 0, w, h, { fill: '#c99a5e', shade: F.shade2, lw: 2.6, r: 5, j: 0.18 });
  for (let i = 0; i < 4; i++) k.line(6, 4 + i * (h / 4), w - 6, 4 + i * (h / 4) + 1, { lw: 0.5, ext: 0, bow: 0.3 });
  // 羊皮纸
  const m = 7;
  k.rect(m, m, w - 2 * m, h - 2 * m, { fill: '#f6ecd0', shade: F.shade, lw: 1.8, r: 3, j: 0.14 });
  // 铆钉
  for (const [cx, cy] of [[3.5, 3.5], [w - 3.5, 3.5], [3.5, h - 3.5], [w - 3.5, h - 3.5]] as const) {
    k.dot(cx, cy, 1.7, F.gray2);
    k.dot(cx - 0.4, cy - 0.4, 0.5, F.white);
  }
  // 缎带标题
  const bw = Math.min(w - 36, 20 + o.title.length * 15), bh = 18, bx = (w - bw) / 2, by = -9;
  k.poly([[bx - 9, by + 5], [bx + 2, by + 5], [bx + 2, by + bh + 5], [bx - 9, by + bh + 5], [bx - 5, by + bh / 2 + 5]], { fill: '#a9c07a', shade: F.shade2, lw: 1.6, j: 0.1 });
  k.poly([[bx + bw - 2, by + 5], [bx + bw + 9, by + 5], [bx + bw + 5, by + bh / 2 + 5], [bx + bw + 9, by + bh + 5], [bx + bw - 2, by + bh + 5]], { fill: '#a9c07a', shade: F.shade2, lw: 1.6, j: 0.1 });
  k.rect(bx, by, bw, bh, { fill: '#c7dc93', shade: F.shade, lw: 2, r: 2, j: 0.12 });
  ctx.fillStyle = INK;
  ctx.font = `bold 13px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.title, w / 2, by + bh / 2 + 1);
  // 缩略图槽(左)
  const tw = Math.min(h - 2 * m - 22, w * 0.38), th = tw, tx = m + 7, ty = m + 16;
  k.rect(tx - 3, ty - 3, tw + 6, th + 6, { fill: '#7d5a36', shade: F.shade2, lw: 2, r: 2, j: 0.12 });
  ctx.save();
  ctx.beginPath();
  ctx.rect(tx, ty, tw, th);
  ctx.clip();
  const gr = ctx.createLinearGradient(0, ty, 0, ty + th);
  gr.addColorStop(0, '#d9ecf2');
  gr.addColorStop(1, '#f1ead2');
  ctx.fillStyle = gr;
  ctx.fillRect(tx, ty, tw, th);
  if (o.thumb) {
    ctx.translate(tx, ty);
    o.thumb(ctx, tw, th);
  }
  ctx.restore();
  // 文字区
  const lx = tx + tw + 10;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let ly = ty + 10;
  if (o.sub) {
    ctx.fillStyle = '#7a5b3a';
    ctx.font = `11px ${UI_FONT}`;
    ctx.fillText(o.sub, lx, ly);
    ly += 3;
    k.line(lx, ly, w - m - 10, ly, { lw: 0.9, ext: 0, bow: 0.4 });
    ly += 12;
  }
  ctx.fillStyle = INK;
  ctx.font = `12px ${UI_FONT}`;
  for (const ln of o.lines ?? []) {
    ctx.fillText(ln, lx, ly);
    ly += 15;
  }
  // NEW 星爆
  if (o.isNew !== false) {
    ctx.save();
    ctx.translate(w - 8, h - 6);
    ctx.rotate(0.22 + Math.sin(t * 3) * 0.04);
    const sk = new Ink(ctx, seed + 5, 1.5, 0.1);
    const pts: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = i % 2 ? 11 : 15;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    sk.poly(pts, { fill: '#f6d04a', lw: 1.5, j: 0.06 });
    ctx.fillStyle = INK;
    ctx.font = `bold 9px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEW', 0, 0.5);
    ctx.restore();
  }
  if (o.p !== undefined && o.p < 1) sparkle(ctx, w - 6, -2, 3, F.gold, t * 4, false);
  ctx.restore();
  const cx0 = x, cy0 = y;
  // 返回槽矩形(未含弹入缩放,稳定态下准确)
  return [cx0 + tx, cy0 + ty, tw, th];
}
