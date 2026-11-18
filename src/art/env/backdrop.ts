/**
 * 远景天幕（480×270 源像素 × SS，scrollFactor 0 铺满）。
 * 三个时段：backdrop_morning 清晨 / backdrop 黄昏(默认) / backdrop_night 平安夜。键名由 index.ts 注册。
 * 外滩式中西合璧天际线 + 远处江面 + 手绘云 + 暖色太阳光晕（左上暖光）。
 */
import { mkTex, paint, pBlob, pPoly, strokePath, speckles, lin, radial, rng, shade, mix, rgba, PAL, hash2, type Ctx, type Pt } from '../brush';

interface Sky { top: string; mid: string; low: string; sun: string; sunA: number; cloud: string; cloudShade: string; far: string; near: string; river: string; stars: number; win: number }
const SKY: Record<'morning' | 'dusk' | 'night', Sky> = {
  morning: { top: '#a9c3de', mid: '#dfe3e6', low: '#f7ddc2', sun: '#fff1c4', sunA: 0.7, cloud: '#fbf3ec', cloudShade: '#cdd6e6', far: '#b6c3d4', near: '#9fb0c6', river: '#c8d6e2', stars: 0, win: 0.1 },
  dusk: { top: '#7f86b8', mid: '#e6a98f', low: '#f6cf8e', sun: '#ffd68a', sunA: 0.85, cloud: '#f9d2b0', cloudShade: '#b59cc2', far: '#9a8fb2', near: '#7f7498', river: '#d49a82', stars: 0.2, win: 0.7 },
  night: { top: '#141a38', mid: '#2a3262', low: '#5a4a7e', sun: '#c9d4ff', sunA: 0.4, cloud: '#4a5084', cloudShade: '#2a2e56', far: '#2a2e52', near: '#1d2042', river: '#2a3262', stars: 1, win: 1 },
};

function tower(x: Ctx, cx: number, base: number, kind: number, col: string, win: string, winA: number, seed: number) {
  const r = rng(seed);
  const line = rgba(shade(col, -0.35), 0.7);
  const pt = (pts: Pt[]) => paint(x, pts, { fill: col, fill2: shade(col, -0.18), w: 0.55, stroke: line, amp: 0.1, step: 3, mottle: 0.18, grain: 0.2, hi: 0.25, seed });
  if (kind === 0) { // 海关钟楼式：高塔 + 尖顶
    pt([[cx - 7, base], [cx - 7, base - 70], [cx - 5, base - 74], [cx - 5, base - 100], [cx, base - 118], [cx + 5, base - 100], [cx + 5, base - 74], [cx + 7, base - 70], [cx + 7, base]]);
    x.fillStyle = rgba(win, winA); x.fillRect(cx - 2.4, base - 90, 4.8, 6);
    x.strokeStyle = rgba(shade(col, 0.4), 0.6); x.lineWidth = 0.5; x.beginPath(); x.arc(cx, base - 86, 4, 0, 6.3); x.stroke();
  } else if (kind === 1) { // 古典石楼：柱廊+穹顶
    pt([[cx - 20, base], [cx - 20, base - 44], [cx - 12, base - 44], [cx - 12, base - 56], [cx - 5, base - 62], [cx, base - 72], [cx + 5, base - 62], [cx + 12, base - 56], [cx + 12, base - 44], [cx + 20, base - 44], [cx + 20, base]]);
    for (let i = 0; i < 6; i++) { x.fillStyle = rgba(win, winA * (0.5 + r() * 0.5)); x.fillRect(cx - 17 + i * 6, base - 36, 2.4, 5); x.fillRect(cx - 17 + i * 6, base - 24, 2.4, 5); }
  } else if (kind === 2) { // 装饰艺术阶梯楼
    pt([[cx - 14, base], [cx - 14, base - 40], [cx - 9, base - 40], [cx - 9, base - 56], [cx - 4, base - 56], [cx - 4, base - 76], [cx + 1, base - 84], [cx + 4, base - 76], [cx + 4, base - 56], [cx + 9, base - 56], [cx + 9, base - 40], [cx + 14, base - 40], [cx + 14, base]]);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) { x.fillStyle = rgba(win, winA * (r() > 0.4 ? 1 : 0.2)); x.fillRect(cx - 11 + i * 5, base - 34 + j * 7, 1.8, 3); }
  } else { // 低矮里弄屋顶 + 烟囱
    pt([[cx - 16, base], [cx - 16, base - 22], [cx - 8, base - 28], [cx + 8, base - 28], [cx + 16, base - 22], [cx + 16, base]]);
    pt([[cx + 4, base - 28], [cx + 4, base - 36], [cx + 8, base - 36], [cx + 8, base - 28]]);
    for (let i = 0; i < 4; i++) { x.fillStyle = rgba(win, winA * (r() > 0.3 ? 1 : 0.2)); x.fillRect(cx - 12 + i * 6.4, base - 16, 2.4, 4); }
  }
}

function sky(x: Ctx, S: Sky, seed: number, W: number, H: number) {
  const r = rng(seed);
  x.fillStyle = lin(x, 0, 0, 0, H, [[0, S.top], [0.45, S.mid], [0.78, S.low], [1, S.low]]); x.fillRect(0, 0, W, H);
  // 太阳/月亮光晕（左上暖光）
  const sx = 96, sy = S.stars > 0.9 ? 40 : 150;
  x.fillStyle = radial(x, sx, sy, 150, [[0, rgba(S.sun, S.sunA)], [0.3, rgba(S.sun, S.sunA * 0.35)], [1, rgba(S.sun, 0)]]); x.fillRect(0, 0, W, H);
  // 星
  if (S.stars) for (let i = 0; i < 90 * S.stars; i++) { const px = r() * W, py = r() * H * 0.55, a = 0.35 + r() * 0.6; x.fillStyle = rgba('#fff6d8', a); const s = r() > 0.9 ? 1.1 : 0.6; x.fillRect(px, py, s, s); if (s > 1) { x.fillRect(px - 1.2, py + 0.3, 3.4, 0.4); x.fillRect(px + 0.3, py - 1.2, 0.4, 3.4); } }
  // 水彩云：长条形叠层
  const cloud = (cx: number, cy: number, w: number, k: number) => {
    for (let i = 0; i < 5; i++) {
      const ox = (i - 2) * w * 0.2 + (r() - 0.5) * 8, oy = (r() - 0.5) * 3;
      paint(x, pBlob(cx + ox, cy + oy, w * (0.2 + r() * 0.12), w * (0.05 + r() * 0.03) * k, { lump: 0.1 }), { fill: S.cloud, fill2: S.cloudShade, light: [-0.4, -0.9], w: 0, stroke: false, mottle: 0.2, grain: 0.1, edge: 0.0, seed: seed + i + Math.floor(cx), hi: 0.3 });
    }
  };
  [[70, 40, 120, 1], [250, 26, 150, 0.9], [400, 52, 110, 1], [180, 74, 90, 0.7], [330, 92, 100, 0.8], [30, 100, 80, 0.7], [440, 110, 80, 0.6]].forEach(([cx, cy, w, k]) => cloud(cx, cy, w, k));
}

function skyline(x: Ctx, S: Sky, seed: number, W: number, H: number) {
  const r = rng(seed + 9);
  const hz = H * 0.62;
  // 江面
  x.fillStyle = lin(x, 0, hz - 6, 0, H, [[0, S.river], [1, mix(S.river, S.low, 0.4)]]); x.fillRect(0, hz + 14, W, H - hz);
  for (let i = 0; i < 60; i++) { const px = r() * W, py = hz + 18 + r() * (H - hz - 20); x.strokeStyle = rgba(S.sun, 0.18 + r() * 0.25); x.lineWidth = 0.4; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 6 + r() * 14, py); x.stroke(); }
  // 远景薄雾楼群
  let px = -10;
  while (px < W + 20) {
    const w = 10 + r() * 20, h = 18 + r() * 52;
    paint(x, pPoly([[px, hz + 14], [px, hz + 14 - h], [px + w, hz + 14 - h - r() * 5], [px + w, hz + 14]], { amp: 0.04 }), { fill: mix(S.far, S.low, 0.35), fill2: S.far, w: 0, stroke: false, mottle: 0.15, grain: 0.2, seed: seed + Math.floor(px) });
    px += w - 2;
  }
  // 近景外滩天际线
  const base = hz + 18;
  const kinds = [2, 3, 1, 3, 0, 2, 3, 1, 3, 2, 0, 3, 1, 2, 3];
  let cx = 16, i = 0;
  while (cx < W + 20) { const k = kinds[i % kinds.length]; const wd = k === 0 ? 14 : k === 1 ? 40 : k === 2 ? 30 : 34; tower(x, cx + wd / 2, base, k, hash2(i, seed, 1, 2) > 0.5 ? S.near : shade(S.near, 0.08), '#ffd27a', S.win, seed + i); cx += wd + 2 + hash2(i, seed, 3, 4) * 10; i++; }
  // 码头雾气
  x.fillStyle = lin(x, 0, base - 12, 0, base + 14, [[0, rgba(S.low, 0)], [0.6, rgba(S.low, 0.5)], [1, rgba(S.low, 0.1)]]); x.fillRect(0, base - 12, W, 26);
  // 远处小帆影 / 灯火
  strokePath(x, [[330, base + 26], [332, base + 22], [338, base + 26]], { w: 0.6, color: rgba(shade(S.near, -0.3), 0.7), seed: 3 });
  if (S.win > 0.5) speckles(x, [0, base + 18, W, 40], 40, ['#ffd68a', '#ffe9b8'], [0.4, 0.9], 0.55, seed + 5);
}

export function buildBackdrops(): Record<'backdrop_morning' | 'backdrop' | 'backdrop_night', HTMLCanvasElement> {
  const W = 480, H = 270;
  const mk = (k: 'morning' | 'dusk' | 'night', seed: number) => mkTex(W, H, (x) => { sky(x, SKY[k], seed, W, H); skyline(x, SKY[k], seed, W, H); }, { seed, paper: 0.55, grain: 0.5 });
  return { backdrop_morning: mk('morning', 11), backdrop: mk('dusk', 12), backdrop_night: mk('night', 13) };
}
export const BACKDROP_KEYS = ['backdrop', 'backdrop_morning', 'backdrop_night'] as const;
