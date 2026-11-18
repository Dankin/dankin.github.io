/**
 * 手绘道具/装饰。每个返回的 canvas = 旧源尺寸 × SS（显示用 setScale(旧倍数/SS)，即 ART_SCALE）。
 * 锚点约定同旧版：origin(0.5,1)，脚底在纹理底边中部。
 */
import { buildWall as facadeWall, WALL_TILES } from './facade';
import { SS } from '../scale';
import { mkTex, paint, pRect, pEllipse, pPoly, pBlob, strokePath, blob, dab, softShadow, glow, speckles, lin, radial, rng, shade, mix, rgba, hash2, PAL, type Ctx, type Pt } from '../brush';

type Draw = (x: Ctx, r: ReturnType<typeof rng>) => void;
const T: Record<string, HTMLCanvasElement> = {};
const def = (key: string, w: number, h: number, draw: Draw, seed?: number) => { T[key] = mkTex(w, h, (x, r) => draw(x, r), { seed: seed ?? (key.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973) }); };

/** 矩形上色 */
const box = (x: Ctx, x0: number, y0: number, w: number, h: number, fill: string, o: Parameters<typeof paint>[2] = {}) => paint(x, pRect(x0, y0, w, h, { amp: 0.18 }), { fill, w: 0.75, mottle: 0.25, grain: 0.25, ...o });
const ell = (x: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, o: Parameters<typeof paint>[2] = {}) => paint(x, pEllipse(cx, cy, rx, ry, { amp: 0.15 }), { fill, w: 0.75, mottle: 0.25, grain: 0.2, ...o });
const poly = (x: Ctx, pts: Pt[], fill: string, o: Parameters<typeof paint>[2] = {}) => paint(x, pts, { fill, w: 0.75, mottle: 0.25, grain: 0.25, amp: 0.2, step: 2.2, ...o });
const line = (x: Ctx, a: Pt, b: Pt, w = 0.9, color: string = PAL.ink, seed = 1) => strokePath(x, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], { w, color, seed, vary: 0.3 });
const snowCap = (x: Ctx, x0: number, x1: number, y: number, th = 1.8, seed = 1) => {
  const r = rng(seed), pts: Pt[] = [[x0, y + 0.8]];
  for (let xx = x0; xx <= x1; xx += 2.4) pts.push([xx, y - th * (0.5 + r() * 0.7)]);
  pts.push([x1, y + 0.8]);
  paint(x, pts, { fill: PAL.snow, fill2: PAL.snowShade, stroke: PAL.inkCool, w: 0.45, mottle: 0.1, grain: 0, edge: 0.15, hi: 0.5, amp: 0.3, step: 2, seed });
};
const bow = (x: Ctx, cx: number, cy: number, s = 1, col = '#d33a2c') => {
  poly(x, [[cx, cy], [cx - 4 * s, cy - 2.4 * s], [cx - 4.4 * s, cy + 1.8 * s]], col, { w: 0.55, mottle: 0.1, amp: 0.1 });
  poly(x, [[cx, cy], [cx + 4 * s, cy - 2.4 * s], [cx + 4.4 * s, cy + 1.8 * s]], col, { w: 0.55, mottle: 0.1, amp: 0.1 });
  poly(x, [[cx - 1.2 * s, cy + 1 * s], [cx - 2.6 * s, cy + 5 * s], [cx - 0.4 * s, cy + 4 * s]], shade(col, -0.2), { w: 0.45, mottle: 0, amp: 0.08 });
  poly(x, [[cx + 1.2 * s, cy + 1 * s], [cx + 2.6 * s, cy + 5 * s], [cx + 0.4 * s, cy + 4 * s]], shade(col, -0.2), { w: 0.45, mottle: 0, amp: 0.08 });
  blob(x, cx, cy, 1.15 * s, shade(col, -0.1), { w: 0.4 });
};
const pole = (x: Ctx, x0: number, y0: number, w: number, y1: number, col: string, o: Parameters<typeof paint>[2] = {}) => box(x, x0, y0, w, y1 - y0, col, { mottle: 0.15, ...o });

// ───────────────────────── 互动道具 ─────────────────────────
def('windchime', 24, 40, (x) => {
  box(x, 8.4, 5, 3, 33, '#7a5638'); box(x, 8.4, 4, 11, 2.4, '#7a5638'); // 立杆+横臂
  box(x, 5, 36.5, 9, 3, '#4e3828', { mottle: 0.1 }); // 底座
  line(x, [17, 6], [17, 10], 0.5, '#8a6a4a');
  blob(x, 17, 11, 1, '#d4a24a', { w: 0.3 });
  bow(x, 11.5, 12, 0.55);
  poly(x, [[10.5, 16], [8, 19], [10.5, 18.4], [13, 19]], PAL.green, { w: 0.4, mottle: 0, amp: 0.05 });
  dab(x, 9.6, 8, 0.8, '#f5d99a', 0.5);
});
def('chime_tubes', 14, 18, (x) => {
  box(x, 0.5, 0, 13, 2, '#c7a064', { w: 0.6 });
  [[2, 9, '#d3dce4'], [5.3, 13.5, '#e8c27a'], [8.6, 16.5, '#a8c0d4'], [11.6, 10.5, '#e8c27a']].forEach(([px, h, col], i) => {
    line(x, [px as number, 2], [px as number, 4], 0.4, '#7a6a56', i);
    box(x, (px as number) - 1.1, 4, 2.2, h as number, col as string, { w: 0.55, mottle: 0.1, grain: 0.1 });
    x.fillStyle = 'rgba(255,255,255,0.65)'; x.fillRect((px as number) - 0.8, 4.6, 0.5, (h as number) - 2);
  });
});
def('stall', 40, 44, (x, r) => {
  // 气球串
  const bc = ['#e0413f', '#f2c230', '#3a8fd9', '#5fbf6a', '#d96ea0', '#e0413f'], bp: [number, number][] = [[9, 7], [16, 4], [24, 7], [13, 11], [20, 12], [29, 10]];
  bp.forEach(([bx, by], i) => { line(x, [bx, by + 4], [20, 21], 0.35, '#8a8070', i); });
  bp.forEach(([bx, by], i) => { ell(x, bx, by, 3.2, 3.7, bc[i], { w: 0.6, mottle: 0.1, grain: 0.1 }); dab(x, bx - 1.1, by - 1.4, 0.8, '#fff', 0.7); });
  // 立柱
  pole(x, 5.5, 20, 2.2, 38, '#7a5638'); pole(x, 32.8, 20, 2.2, 38, '#7a5638');
  // 条纹遮阳篷
  for (let i = 0; i < 6; i++) {
    const a = 3.4 + i * 5.5, col = i % 2 ? '#f6ecd6' : '#d83a34';
    poly(x, [[a, 17.5], [a + 5.5, 17.5], [a + 5.5, 22.5], [a + 2.8, 24.2], [a, 22.5]], col, { w: 0.6, mottle: 0.1, grain: 0.1, amp: 0.08 });
  }
  snowCap(x, 3, 37, 17.6, 2.2, 5);
  // 木柜台
  box(x, 4.5, 28, 31, 11, '#a2703f'); for (let i = 1; i < 6; i++) line(x, [4.5 + i * 5.2, 28.5], [4.5 + i * 5.2, 38.5], 0.35, '#6e4526', i);
  box(x, 3.5, 26.8, 33, 2.4, '#c28a52', { w: 0.6 });
  // 轮子
  [10.5, 29.5].forEach((wx) => { ell(x, wx, 40.4, 3.1, 3.1, '#3a3036', { w: 0.7 }); blob(x, wx, 40.4, 0.9, '#a8a0a0', { w: 0.2 }); });
  // 价签
  box(x, 14.5, 30.4, 11, 5.4, '#f7f1e3', { w: 0.55, mottle: 0.1 }); line(x, [16.2, 32.4], [23, 32.4], 0.5, '#d33a2c'); line(x, [16.2, 34.2], [21, 34.2], 0.5, '#8a6a4a');
  void r;
});
def('speaker', 22, 32, (x) => {
  line(x, [16, 8], [16.5, 0.8], 0.55, '#8a8a92'); blob(x, 16.5, 0.9, 0.9, '#e0413f', { w: 0.3 });
  box(x, 3, 7, 16, 19, '#34343c', { fill2: '#1c1c22', mottle: 0.15, grain: 0.3, hi: 0.7 });
  ell(x, 11, 18, 5.6, 5.6, '#4a4a54', { fill2: '#222228', w: 0.7 }); ell(x, 11, 18, 3, 3, '#2a2a30', { w: 0.5 }); blob(x, 11, 18, 1, '#7a7a86', { w: 0.2 });
  ell(x, 11, 11, 2.2, 2.2, '#4a4a54', { w: 0.5 });
  [[16, 10, '#ff5a4a'], [14, 10, '#7cf08a']].forEach(([px, py, col]) => { dab(x, px as number, py as number, 0.9, col as string, 1); });
  bow(x, 5, 6.5, 0.8);
  box(x, 4, 26, 3, 3, '#55555e'); box(x, 15, 26, 3, 3, '#55555e'); ell(x, 5.5, 30, 2, 2, '#1a1a1e', { w: 0.5 }); ell(x, 16.5, 30, 2, 2, '#1a1a1e', { w: 0.5 });
});
def('lamp', 14, 48, (x) => {
  box(x, 5.8, 11, 2.3, 32, '#38443f', { fill2: '#1e2824', hi: 0.7 }); // 杆
  poly(x, [[3.8, 44], [10.2, 44], [11, 46.5], [3, 46.5]], '#2a342f', { w: 0.7 }); box(x, 4.6, 39, 4.8, 5, '#38443f', { w: 0.6 }); // 底座
  poly(x, [[2, 3.4], [12, 3.4], [10.5, 10.6], [3.5, 10.6]], '#fff0b6', { fill2: '#e8b35a', w: 0.8, mottle: 0.2, grain: 0.1, hi: 0.2, rim: 0.2 }); // 灯罩
  x.fillStyle = radial(x, 7, 7, 4.5, [[0, 'rgba(255,255,220,0.95)'], [1, 'rgba(255,225,140,0)']]); x.fillRect(2, 3, 10, 8);
  line(x, [7, 3.6], [7, 10.4], 0.4, '#38443f'); 
  poly(x, [[1.2, 3.6], [7, 0.6], [12.8, 3.6]], '#2a342f', { w: 0.7 }); blob(x, 7, 0.9, 0.9, '#2a342f', { w: 0.3 });
  box(x, 3.6, 10.4, 6.8, 1.8, '#2a342f', { w: 0.5 });
  bow(x, 7, 22, 0.9);
  snowCap(x, 2, 12, 3.2, 1.6, 3);
});
const snowman = (pose: number) => (x: Ctx) => {
  const arm = (a: Pt, b: Pt, c: Pt) => { strokePath(x, [a, b, c], { w: 1.1, color: '#5a3a24', seed: pose + 1, vary: 0.4 }); strokePath(x, [b, [b[0] + (c[0] - b[0]) * 0.5, b[1] - 1.6]], { w: 0.6, color: '#5a3a24', seed: 9 }); };
  const arms: Pt[][] = pose === 0 ? [[[6.5, 15.5], [3.8, 17.5], [1.5, 17.5]], [[15.5, 15.5], [18.2, 17.5], [20.4, 17.5]]] : pose === 1 ? [[[6.5, 15.5], [3.8, 17.5], [1.5, 17.5]], [[15.5, 15.5], [18.5, 12.5], [21, 8.8]]] : [[[6.5, 15.5], [3.6, 12], [1, 9]], [[15.5, 15.5], [18.5, 12], [21, 9]]];
  arms.forEach(([a, b, c]) => arm(a, b, c));
  paint(x, pBlob(10.6, 21.6, 6.6, 6, { lump: 0.04 }), { fill: '#f6f2f4', fill2: '#bfc6df', w: 0.85, mottle: 0.15, grain: 0.1, hi: 0.6 });
  paint(x, pBlob(10.8, 13.8, 5.1, 4.9, { lump: 0.04 }), { fill: '#f6f2f4', fill2: '#bfc6df', w: 0.8, mottle: 0.15, grain: 0.1, hi: 0.6 });
  paint(x, pBlob(10.8, 7.2, 4.1, 3.9, { lump: 0.04 }), { fill: '#faf6f6', fill2: '#c9d0e6', w: 0.8, mottle: 0.1, grain: 0.1, hi: 0.6 });
  // 帽子
  box(x, 6.4, 3.6, 8.8, 1.5, '#2e2a36', { w: 0.6 }); box(x, 7.8, 0.4, 5.8, 3.6, '#3a3644', { w: 0.65 }); box(x, 7.8, 2.6, 5.8, 1.1, '#c8372e', { w: 0.4, mottle: 0 });
  // 脸：煤球眼、胡萝卜鼻、炭笑
  blob(x, 9.2, 6.6, 0.55, '#2a2028', { w: 0.1, shine: false }); blob(x, 12.4, 6.6, 0.55, '#2a2028', { w: 0.1, shine: false });
  poly(x, [[10.4, 7.8], [14.2, 8.6], [10.6, 9.2]], '#f08a24', { w: 0.4, mottle: 0, amp: 0.05 });
  [[9, 9.2], [10.2, 9.7], [11.6, 9.7], [12.8, 9.2]].forEach(([px, py]) => dab(x, px, py, 0.32, '#2a2028', 0.9));
  [[10.8, 13], [10.8, 16.4], [10.8, 20.4]].forEach(([px, py]) => blob(x, px, py, 0.55, '#2a2028', { w: 0.1, shine: false }));
  // 围巾
  poly(x, [[6.8, 10.2], [14.8, 10.2], [15.2, 12.3], [6.6, 12.3]], '#d33a2c', { w: 0.65, mottle: 0.1 });
  poly(x, [[12.8, 11.8], [15, 11.8], [15.4, 17], [13.2, 16.6]], '#d33a2c', { w: 0.6, mottle: 0.1 });
  x.strokeStyle = 'rgba(255,230,200,0.75)'; x.lineWidth = 0.45; x.beginPath(); x.moveTo(7.2, 11.2); x.lineTo(14.5, 11.2); x.stroke();
};
def('snowman_0', 22, 28, snowman(0)); def('snowman_1', 22, 28, snowman(1)); def('snowman_2', 22, 28, snowman(2));

def('tree', 44, 64, (x, r) => {
  box(x, 19.6, 53, 4.8, 10.5, '#6e4a30', { fill2: '#4a2e1e', w: 0.7 });
  const tier = (cy: number, base: number, hw: number, c1: string, seed: number) => {
    const pts: Pt[] = [[22, cy]]; const n = 6;
    for (let i = 1; i <= n; i++) { const t = i / n; pts.push([22 + hw * t + (i % 2 ? 1.2 : -0.6), cy + (base - cy) * t * 0.92 + (i % 2) * 1.5]); }
    pts.push([22 + hw + 1, base]); pts.push([22, base - 2.2]); pts.push([22 - hw - 1, base]);
    for (let i = n; i >= 1; i--) { const t = i / n; pts.push([22 - hw * t - (i % 2 ? 1.2 : -0.6), cy + (base - cy) * t * 0.92 + (i % 2) * 1.5]); }
    paint(x, pts, { fill: c1, fill2: shade(c1, -0.4), w: 0.9, amp: 0.3, step: 2, mottle: 0.5, grain: 0.4, hi: 0.5, seed, hatch: { angle: 1.1, gap: 2.2, color: '#0c3a26', alpha: 0.22 } });
  };
  tier(31, 56, 20, '#2b6a4a', 3); tier(21, 44, 15.5, '#33784f', 4); tier(11, 31, 11.5, '#3a8656', 5);
  // 积雪
  [[22, 12.5, 4], [16, 25, 5], [29, 24.5, 4.5], [11, 40, 5], [32, 39, 5], [22, 33, 5]].forEach(([px, py, s], i) => { x.fillStyle = rgba('#f4eef0', 0.92); x.beginPath(); x.ellipse(px, py, s, s * 0.38, 0, 0, 6.3); x.fill(); x.strokeStyle = rgba(PAL.inkCool, 0.5); x.lineWidth = 0.3; x.stroke(); void i; });
  // 彩球
  [[20, 24, '#d33a2c'], [27, 34, '#e8b94a'], [14, 40, '#e8b94a'], [30, 46, '#d33a2c'], [11, 51, '#d33a2c'], [22, 45, '#e8b94a'], [33, 53, '#e8b94a'], [19, 30, '#3a8fd9'], [26, 20, '#3a8fd9'], [16, 49, '#3a8fd9']].forEach(([px, py, col]) => { blob(x, px as number, py as number, 1.55, col as string, { w: 0.45 }); });
  // 彩带
  strokePath(x, [[16, 19], [22, 24], [28, 27]], { w: 0.7, color: '#f2d27a', seed: 3 }); strokePath(x, [[10, 37], [20, 42], [32, 44]], { w: 0.7, color: '#f2d27a', seed: 4 });
  // 星
  const star: Pt[] = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 2.1 : 4.6; star.push([22 + Math.cos(a) * rr, 6.2 + Math.sin(a) * rr]); }
  paint(x, star, { fill: '#ffe27a', fill2: '#e8a838', w: 0.7, amp: 0.05, step: 5, mottle: 0.1, hi: 0.4 }); glow(x, 22, 6.2, 8, '#ffe9a0', 0.4);
  void r;
});
def('tree_lights', 44, 64, (x) => {
  const pts: [number, number, string][] = [[17, 26, '#ffe27a'], [27, 28, '#ff6a5a'], [13, 36, '#7ad2ff'], [31, 38, '#ffe27a'], [22, 40, '#ff6a5a'], [10, 47, '#ffe27a'], [20, 49, '#7ad2ff'], [34, 49, '#ff6a5a'], [26, 52, '#ffe27a'], [22, 20, '#ffffff'], [18, 31, '#ff6a5a'], [16, 17, '#7ad2ff'], [28, 16, '#ffe27a']];
  pts.forEach(([px, py, col]) => { x.fillStyle = radial(x, px, py, 5.5, [[0, rgba(col, 0.75)], [1, rgba(col, 0)]]); x.fillRect(px - 6, py - 6, 12, 12); });
  pts.forEach(([px, py, col]) => { x.fillStyle = col; x.beginPath(); x.arc(px, py, 1.1, 0, 6.3); x.fill(); x.fillStyle = '#fff'; x.fillRect(px - 0.5, py - 0.6, 0.6, 0.6); });
});
def('mailbox', 16, 28, (x) => {
  box(x, 3, 25.5, 3, 2.5, '#1f4d33', { w: 0.5 }); box(x, 10.5, 25.5, 3, 2.5, '#1f4d33', { w: 0.5 });
  poly(x, [[2, 26], [2, 10], [3, 5.8], [8, 3.8], [13, 5.8], [14, 10], [14, 26]], '#2f8352', { fill2: '#1b5434', w: 0.9, hi: 0.7, amp: 0.15, step: 2.4 });
  box(x, 4.2, 11.6, 7.6, 2, '#0f2a1c', { w: 0.4, mottle: 0, grain: 0 }); // 投信口
  box(x, 2, 18.8, 12, 2.4, '#f2c230', { w: 0.55, mottle: 0.1 });
  x.fillStyle = '#f7f1e3'; x.font = 'bold 2.6px "PingFang SC",sans-serif'; x.textAlign = 'center'; x.fillText('POST', 8, 23.8);
  bow(x, 8, 5.2, 0.85);
  snowCap(x, 3.5, 12.5, 4.6, 1.8, 2);
  box(x, 5, 13.6, 6, 0.9, '#cfd8d0', { w: 0.2, mottle: 0, grain: 0 });
});
def('cat', 20, 12, (x) => {
  poly(x, [[16, 10.8], [17.6, 9], [18.8, 7.4], [19.2, 5.6], [18.2, 6.6], [17, 8.4], [15.4, 9.6]], '#d6893a', { w: 0.65, mottle: 0.2 }); // 尾
  paint(x, pBlob(10, 7.8, 7.4, 3.6, { lump: 0.05 }), { fill: '#e0954a', fill2: '#a8601f', w: 0.85, mottle: 0.3, hi: 0.6 });
  [[6, 5.2, 6.5, 9.6], [9.5, 4.4, 9.8, 9.4], [13, 5, 13, 9.5]].forEach(([a, b, c, d], i) => line(x, [a, b], [c, d], 0.7, '#9a5a22', i));
  paint(x, pBlob(3.8, 5.8, 3.4, 3.2, { lump: 0.04 }), { fill: '#e8a04e', fill2: '#b06a28', w: 0.8, mottle: 0.2, hi: 0.6 });
  poly(x, [[1.2, 3.8], [1.6, 1.2], [3.4, 3]], '#e8a04e', { w: 0.55, mottle: 0, amp: 0.05 }); poly(x, [[4.4, 2.8], [6.2, 1.2], [6.6, 3.8]], '#e8a04e', { w: 0.55, mottle: 0, amp: 0.05 });
  line(x, [2.2, 6.2], [3.4, 6.4], 0.5, '#3a2418'); dab(x, 5.4, 6.3, 0.45, '#3a2418'); dab(x, 1.3, 7.4, 0.5, '#f0a79a');
  // 圣诞帽
  poly(x, [[2.6, 2.6], [4.4, 2.6], [5.4, 0.2], [3.4, 0.8]], '#d33a2c', { w: 0.5, mottle: 0, amp: 0.05 }); box(x, 2.3, 2.1, 3.5, 0.9, '#f7f1e3', { w: 0.35, mottle: 0 }); dab(x, 5.6, 0.3, 0.7, '#fff');
  box(x, 4, 10.3, 11, 1.2, '#3a2c24', { w: 0, mottle: 0, grain: 0, stroke: false }).length;
});
def('bench', 36, 18, (x) => {
  [[3, 4], [31.5, 4]].forEach(([bx, by]) => { pole(x, bx, by, 1.8, 17.6, '#3a3a44', { w: 0.6 }); });
  for (let i = 0; i < 2; i++) box(x, 2, 2.2 + i * 2.8, 32, 2, '#8d6240', { w: 0.65 });
  box(x, 0.8, 8.2, 34.4, 3.2, '#a9774a', { w: 0.8, hi: 0.8 });
  box(x, 2.2, 11.2, 2, 6.4, '#3a3a44', { w: 0.55 }); box(x, 31.8, 11.2, 2, 6.4, '#3a3a44', { w: 0.55 });
  [[6, 11.2], [14, 11.2], [24, 11.2]].forEach(([_, y], i) => { void y; line(x, [7 + i * 10, 9.2], [7 + i * 10, 11], 0.3, '#6e4526', i); });
  snowCap(x, 3, 33, 8.2, 2, 6); snowCap(x, 4, 14, 2.4, 1.2, 7);
});
def('planetree', 32, 64, (x, r) => {
  // 树干：斑驳的梧桐皮
  paint(x, [[11.4, 63], [12.6, 44], [12.8, 30], [13.4, 26], [18.6, 26], [19.2, 30], [19.6, 44], [21, 63]], { fill: '#9a8d7e', fill2: '#675c52', w: 0.95, amp: 0.3, step: 2, mottle: 0.5, hi: 0.6 });
  for (let k = 0; k < 14; k++) { const px = 12.8 + r() * 6, py = 28 + r() * 34; x.fillStyle = r() > 0.5 ? rgba('#c8bea6', 0.8) : rgba('#6e7a56', 0.55); x.beginPath(); x.ellipse(px, py, 0.9 + r() * 1.3, 1.2 + r() * 2, r() * 3, 0, 6.3); x.fill(); }
  poly(x, [[10.4, 63.4], [12.6, 61], [19.8, 61], [22, 63.4]], '#7a6e62', { w: 0.7, mottle: 0.3 });
  // 枝
  const br: [Pt, Pt, Pt, number][] = [[[15.2, 30], [10, 24], [5, 19], 1.7], [[16.8, 30], [22, 24], [28, 19], 1.7], [[15.8, 27], [13.6, 17], [15, 5], 1.5], [[16.4, 27], [20, 17], [24, 8], 1.3], [[8, 22], [6, 15], [3, 12], 1], [[23, 22], [26, 14], [29, 10], 1], [[13.6, 18], [9, 12], [8, 5], 0.9], [[19, 17], [17, 10], [20, 2], 0.9], [[10, 24], [10, 17], [12, 11], 0.8]];
  br.forEach(([a, b, c, w], i) => strokePath(x, [a, b, c], { w, color: '#5c5046', seed: i + 3, vary: 0.35, taper: 0.5 }));
  br.forEach(([a, b, c, w], i) => strokePath(x, [[a[0] - 0.3, a[1]], [b[0] - 0.3, b[1]], [c[0] - 0.3, c[1]]], { w: w * 0.35, color: '#a39688', seed: i + 33, alpha: 0.7 }));
  // 悬挂的球果与残叶
  [[6, 14], [4, 12], [26, 12], [28, 9], [5, 8], [15, 3.4], [10, 7], [22, 9], [27, 14], [3, 15.5], [13, 12], [19, 8]].forEach(([px, py], i) => {
    if (i % 2 === 0) { line(x, [px, py - 3], [px, py], 0.3, '#5c5046', i); blob(x, px, py + 0.8, 1.1, '#8a6a3a', { w: 0.35, shine: false }); }
    else { x.save(); x.translate(px, py); x.rotate(r() * 3); poly(x, [[-1.8, 0], [0, -2], [1.8, 0], [0, 1.4]], r() > 0.5 ? '#d9a441' : '#c27a32', { w: 0.35, mottle: 0, amp: 0.05, grain: 0 }); x.restore(); }
  });
  // 零星挂叶团（金黄/锈红），让树冠更饱满
  for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = 6 + r() * 11; const px = 16 + Math.cos(a) * d * 0.95, py = 14 + Math.sin(a) * d * 0.8; if (py > 26) continue; blob(x, px, py, 1.2 + r() * 1.4, r() > 0.5 ? '#d9a441' : '#b8683a', { w: 0.3, shine: false }); }
  snowCap(x, 3, 12, 18.8, 1.6, 4); snowCap(x, 21, 29, 18.6, 1.6, 5);
  [[8, 10], [12, 12], [24, 11], [28, 9]].forEach(([px, py]) => { x.fillStyle = rgba('#f6eeef', 0.9); x.beginPath(); x.ellipse(px, py, 1.5, 0.6, 0, 0, 6.3); x.fill(); });
});
const bikeBody = (x: Ctx) => {
  const wheel = (cx: number, cy: number) => { x.strokeStyle = '#2f2a30'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, 6.2, 0, 6.3); x.stroke(); x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 0.4; x.beginPath(); x.arc(cx, cy, 6.8, 3.4, 4.8); x.stroke(); for (let a = 0; a < 6; a++) { x.strokeStyle = 'rgba(80,70,70,0.7)'; x.lineWidth = 0.25; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a * 1.05) * 6, cy + Math.sin(a * 1.05) * 6); x.stroke(); } blob(x, cx, cy, 0.9, '#9a9aa0', { w: 0.3 }); };
  wheel(7, 13); wheel(25, 13);
  const fr = '#c8372e'; [[[7, 13], [14, 6]], [[14, 6], [22, 6]], [[22, 6], [25, 13]], [[14, 6], [17, 13]], [[17, 13], [7, 13]], [[17, 13], [22, 6]]].forEach(([a, b], i) => line(x, a as Pt, b as Pt, 1.1, fr, i));
  line(x, [22, 6], [22.6, 2.6], 0.8, '#2f2a30'); line(x, [20, 2.2], [26, 2.4], 1, '#2f2a30');
  paint(x, pEllipse(13, 3.8, 3.2, 1.2, { amp: 0.1 }), { fill: '#3a3036', w: 0.6 });
  box(x, 22, 3.6, 6.6, 4.6, '#a47a44', { w: 0.65 }); x.strokeStyle = rgba('#5a3a1e', 0.7); x.lineWidth = 0.3; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(22 + i * 1.6, 3.8); x.lineTo(22 + i * 1.6, 8); x.stroke(); }
  bow(x, 26, 3.4, 0.5); snowCap(x, 22.4, 28.2, 3.6, 1.2, 3); snowCap(x, 11, 16, 3.2, 1, 4);
};
def('bicycle', 32, 20, (x) => bikeBody(x));
def('crate', 22, 18, (x) => {
  [[5.4, 3.4], [10.4, 2.2], [15.6, 3.8], [8, 5.2], [13, 5]].forEach(([px, py], i) => { blob(x, px, py, 2.4, i % 2 ? '#f39a2a' : '#f08a24', { w: 0.55 }); dab(x, px - 0.7, py - 0.9, 0.6, '#fff', 0.55); poly(x, [[px - 0.3, py - 2.4], [px + 0.9, py - 3.2], [px + 1.4, py - 2.2]], '#4a8a48', { w: 0.3, mottle: 0, amp: 0.05, grain: 0 }); });
  box(x, 2, 7, 18, 10.4, '#b88650', { fill2: '#8a6038', w: 0.9, hi: 0.7 });
  [11.4, 15.2].forEach((yy, i) => line(x, [2.2, yy], [19.8, yy + 0.2], 0.45, '#7a5030', i)); box(x, 2, 7, 2, 10.4, '#8a6038', { w: 0.5, mottle: 0.1 }); box(x, 18, 7, 2, 10.4, '#8a6038', { w: 0.5, mottle: 0.1 });
  box(x, 7, 9, 8, 4, '#f4ead0', { w: 0.45, mottle: 0 }); line(x, [8, 11], [14, 11], 0.5, '#c8372e');
});
def('barrel', 16, 20, (x) => {
  paint(x, [[2, 5], [3.4, 2.6], [12.6, 2.6], [14, 5], [14.6, 11], [14, 17], [12.6, 18.4], [3.4, 18.4], [2, 17], [1.4, 11]], { fill: '#9a6a3e', fill2: '#5a3820', w: 0.95, amp: 0.15, step: 2.2, hi: 0.7, mottle: 0.4 });
  for (let i = 1; i < 5; i++) line(x, [2 + i * 2.4, 3], [2 + i * 2.4, 18], 0.3, '#5a3820', i);
  [5.2, 14.4].forEach((yy, i) => { box(x, 1.4, yy, 13.2, 1.5, '#3a3a44', { w: 0.45, mottle: 0.1 }); void i; });
  ell(x, 8, 2.8, 5.6, 1.6, '#b88a58', { w: 0.7 }); ell(x, 8, 2.8, 3.6, 0.9, '#6a4426', { w: 0.3 });
  snowCap(x, 3, 13, 2.2, 1.5, 3);
});
def('pine', 30, 48, (x) => {
  box(x, 13, 38, 4, 9.6, '#6e4a30', { w: 0.7 });
  const tier = (cy: number, base: number, hw: number, c1: string, seed: number) => {
    const pts: Pt[] = [[15, cy]]; const n = 5;
    for (let i = 1; i <= n; i++) { const t = i / n; pts.push([15 + hw * t + (i % 2 ? 0.8 : -0.5), cy + (base - cy) * t * 0.9]); }
    pts.push([15 + hw + 0.8, base]); pts.push([15, base - 1.6]); pts.push([15 - hw - 0.8, base]);
    for (let i = n; i >= 1; i--) { const t = i / n; pts.push([15 - hw * t - (i % 2 ? 0.8 : -0.5), cy + (base - cy) * t * 0.9]); }
    paint(x, pts, { fill: c1, fill2: shade(c1, -0.4), w: 0.85, amp: 0.25, step: 2, mottle: 0.4, grain: 0.35, hi: 0.5, seed, hatch: { angle: 1.1, gap: 2.2, color: '#0c3a26', alpha: 0.22 } });
  };
  tier(20, 40, 14, '#28634a', 1); tier(11, 29, 10.5, '#2f7050', 2); tier(2, 19, 7.5, '#367a58', 3);
  [[15, 4, 3], [9, 14, 4], [22, 15, 3.6], [6, 26, 5], [24, 27, 4.6], [15, 24, 4], [9, 36, 5], [22, 36, 5]].forEach(([px, py, s], i) => { x.fillStyle = rgba('#f4eef0', 0.93); x.beginPath(); x.ellipse(px, py, s, s * 0.4, 0, 0, 6.3); x.fill(); x.strokeStyle = rgba(PAL.inkCool, 0.45); x.lineWidth = 0.3; x.stroke(); void i; });
});
def('snowpile', 28, 14, (x) => {
  paint(x, [[1, 12.6], [3, 9.4], [6.4, 7.2], [10, 4.6], [14, 3.4], [18, 4.8], [21.6, 7], [25, 9.6], [27, 12.6], [14, 13.6]], { fill: '#f6eef0', fill2: '#bfc6de', w: 0.85, amp: 0.3, step: 2.2, mottle: 0.2, grain: 0.1, hi: 0.7, rim: 0.8 });
  [[8, 8.6, 3], [16, 7, 4], [21, 10, 3]].forEach(([px, py, s], i) => { x.fillStyle = rgba('#fff', 0.7); x.beginPath(); x.ellipse(px, py, s, s * 0.35, -0.2, 0, 6.3); x.fill(); void i; });
  speckles(x, [3, 4, 22, 8], 10, ['#ffffff', '#ffe6f0', '#d8def5'], [0.3, 0.7], 0.85, 5);
});
def('fence', 34, 22, (x) => {
  for (let i = 0; i < 6; i++) { const yy = 4 + (i % 2) * 0.8; paint(x, [[2 + i * 5.6, 21], [2 + i * 5.6, yy + 1.6], [3.7 + i * 5.6, yy - 1.2], [5.4 + i * 5.6, yy + 1.6], [5.4 + i * 5.6, 21]], { fill: '#b4854f', fill2: '#7a5530', w: 0.75, amp: 0.15, step: 2, hi: 0.7 }); snowCap(x, 1.6 + i * 5.6, 5.8 + i * 5.6, yy - 0.6, 1.4, i); }
  box(x, 0, 8.4, 34, 2, '#8a5e38', { w: 0.6 }); box(x, 0, 15.4, 34, 2, '#8a5e38', { w: 0.6 });
});
def('bollard', 10, 20, (x) => {
  paint(x, [[1.6, 17.6], [2, 5.4], [3, 3], [7, 3], [8, 5.4], [8.4, 17.6]], { fill: '#454c5e', fill2: '#262a38', w: 0.85, amp: 0.15, step: 2.4, hi: 0.7 });
  box(x, 1.4, 8.4, 7.2, 2.2, '#e5b94a', { w: 0.45, mottle: 0.1 }); box(x, 0.8, 17, 8.4, 2.2, '#2e3040', { w: 0.55 });
  ell(x, 5, 3, 3.1, 1.1, '#5a6278', { w: 0.45 }); snowCap(x, 2.4, 7.6, 2.4, 1.8, 3);
});
def('rowboat', 44, 22, (x) => {
  paint(x, [[1.6, 7], [8, 14.6], [22, 17.4], [36, 14.6], [42.4, 7], [36, 6], [22, 5.2], [8, 6]], { fill: '#9a4a38', fill2: '#5a2c24', w: 1, amp: 0.2, step: 2.6, hi: 0.7, mottle: 0.4 });
  paint(x, [[2.2, 7], [8, 9.4], [22, 10.4], [36, 9.4], [41.8, 7], [36, 6.4], [22, 5.6], [8, 6.4]], { fill: '#f1e6cc', fill2: '#cdbda0', w: 0.7, amp: 0.15, step: 2.6, mottle: 0.2 });
  line(x, [6, 12.6], [38, 12.6], 0.4, '#e8d9b0'); box(x, 12, 6.6, 3.4, 1.6, '#6e4426', { w: 0.45 }); box(x, 29, 6.6, 3.4, 1.6, '#6e4426', { w: 0.45 });
  strokePath(x, [[10, 3], [20, 10], [33, 14.8]], { w: 1.1, color: '#6e4a30', seed: 2, vary: 0.2 }); poly(x, [[32, 13.6], [37, 16], [35, 17.6], [31, 15.4]], '#8a6038', { w: 0.45, mottle: 0 });
  snowCap(x, 4, 40, 6, 1.8, 4);
});
// ───────── 气球/小型互动用 ─────────
['#e0413f', '#f2c230', '#3a8fd9', '#5fbf6a', '#d96ea0'].forEach((col, i) => def('balloon_' + i, 10, 18, (x) => {
  strokePath(x, [[5, 9.6], [4.4, 13], [5.6, 16], [5, 17.6]], { w: 0.4, color: '#8a8070', seed: i });
  paint(x, [[5, 0.4], [8.2, 1.6], [9, 4.8], [7.4, 8], [5, 9.6], [2.6, 8], [1, 4.8], [1.8, 1.6]], { fill: col, fill2: shade(col, -0.35), w: 0.75, amp: 0.1, step: 2.5, hi: 0.5, mottle: 0.15, grain: 0.1 });
  poly(x, [[4.2, 9.5], [5.8, 9.5], [5, 10.6]], shade(col, -0.2), { w: 0.4, mottle: 0, amp: 0.03 });
  dab(x, 3.3, 3, 1, '#fff', 0.7);
}));
def('heart', 9, 8, (x) => {
  paint(x, [[4.5, 7.4], [1.2, 4], [0.6, 2.2], [2, 0.6], [3.6, 0.9], [4.5, 2.2], [5.4, 0.9], [7, 0.6], [8.4, 2.2], [7.8, 4]], { fill: '#f2587a', fill2: '#c42a4e', w: 0.65, amp: 0.1, step: 2, mottle: 0.1, grain: 0.1, hi: 0.5 }); dab(x, 2.4, 2, 0.8, '#fff', 0.7);
});
def('sparkle', 7, 7, (x) => {
  glow(x, 3.5, 3.5, 3.4, '#fff3b0', 0.55);
  x.fillStyle = '#fff6c4'; x.beginPath(); x.moveTo(3.5, 0); x.quadraticCurveTo(3.8, 3.2, 7, 3.5); x.quadraticCurveTo(3.8, 3.8, 3.5, 7); x.quadraticCurveTo(3.2, 3.8, 0, 3.5); x.quadraticCurveTo(3.2, 3.2, 3.5, 0); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(3.5, 3.5, 0.9, 0, 6.3); x.fill();
});
def('envelope', 12, 9, (x) => {
  box(x, 0.6, 0.8, 10.8, 7.4, '#f8f1e2', { w: 0.7, mottle: 0.1, hi: 0.5 });
  strokePath(x, [[0.8, 1], [6, 5], [11.2, 1]], { w: 0.5, color: '#b8a888', seed: 2 }); strokePath(x, [[0.8, 8], [4.6, 4.4]], { w: 0.35, color: '#b8a888', seed: 3 }); strokePath(x, [[11.2, 8], [7.4, 4.4]], { w: 0.35, color: '#b8a888', seed: 4 });
  blob(x, 6, 4.8, 1.2, '#d33a2c', { w: 0.35 });
});
def('puff', 6, 6, (x) => { glow(x, 3, 3, 2.8, '#ffffff', 0.9); blob(x, 3, 3, 1.8, '#ffffff', { w: 0, stroke: false, shine: false }); });

// ───────── 原生分辨率辅助图 ─────────
def('shadow', 48, 16, (x) => { x.fillStyle = radial(x, 24, 8, 24, [[0, 'rgba(50,30,70,0.46)'], [0.6, 'rgba(50,30,70,0.28)'], [1, 'rgba(50,30,70,0)']]); x.save(); x.translate(24, 8); x.scale(1, 0.34); x.translate(-24, -8); x.fillRect(0, -20, 48, 56); x.restore(); });
def('glow', 128, 128, (x) => { x.fillStyle = radial(x, 64, 64, 64, [[0, 'rgba(255,240,190,1)'], [0.18, 'rgba(255,224,150,0.8)'], [0.4, 'rgba(255,205,120,0.38)'], [0.7, 'rgba(255,190,100,0.1)'], [1, 'rgba(255,180,90,0)']]); x.fillRect(0, 0, 128, 128); });
def('ring', 64, 64, (x) => {
  x.save(); x.translate(32, 32); x.scale(1, 0.5);
  x.strokeStyle = 'rgba(255,244,200,0.35)'; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 27, 0, 6.3); x.stroke();
  x.strokeStyle = 'rgba(255,248,215,0.95)'; x.lineWidth = 2.2; x.setLineDash([9, 3.5]); x.beginPath(); x.arc(0, 0, 27, 0.2, 6.5); x.stroke(); x.restore();
});
def('arrow', 24, 16, (x) => {
  paint(x, [[12, 15], [2.4, 3.6], [8, 3.6], [8, 0.8], [16, 0.8], [16, 3.6], [21.6, 3.6]], { fill: '#ffe9a0', fill2: '#f0a838', w: 0.9, amp: 0.1, step: 3, mottle: 0.1, grain: 0.1, hi: 0.5 });
});

// ───────── 新增（art-assets.md 需求） ─────────
def('bus', 76, 44, (x) => {
  softShadow(x, 38, 41, 34, 3, 0.25);
  // 车身：上海公交（奶白+红橙腰线，圣诞装饰）
  paint(x, [[3, 38], [2, 14], [4, 8], [10, 5.4], [66, 5.4], [72, 8], [74.4, 14], [74, 38]], { fill: '#f1e6d0', fill2: '#cdb894', w: 1.1, amp: 0.2, step: 3, hi: 0.7, mottle: 0.3 });
  box(x, 2.6, 24, 71.8, 5, '#d8442f', { w: 0.6, mottle: 0.2 }); box(x, 2.6, 29.4, 71.8, 1.4, '#f2b53a', { w: 0.4, mottle: 0 });
  // 窗
  for (let i = 0; i < 5; i++) { const wx = 8 + i * 11.4; paint(x, pRect(wx, 10.4, 9.6, 10.2, { amp: 0.15 }), { fill: '#9cc0d8', fill2: '#4e6d8a', w: 0.75, mottle: 0.15, grain: 0.1, hi: 0.2 }); x.fillStyle = 'rgba(255,255,255,0.4)'; x.beginPath(); x.moveTo(wx + 1, wx * 0 + 20); x.lineTo(wx + 4.4, 11.4); x.lineTo(wx + 6, 11.4); x.lineTo(wx + 2.6, 20); x.fill(); if (i === 2) { x.fillStyle = 'rgba(255,236,170,0.55)'; x.fillRect(wx + 0.7, 11, 8.2, 9); } }
  // 车头窗 + 前门
  paint(x, pRect(65.4, 9.4, 7.6, 14, { amp: 0.15 }), { fill: '#8cb0cc', fill2: '#46627e', w: 0.8, mottle: 0.1 });
  box(x, 56.4, 10.4, 7.6, 17, '#d4c0a0', { w: 0.7 }); line(x, [60.2, 11], [60.2, 27], 0.45, PAL.ink);
  // 车头灯/车牌/路牌
  blob(x, 72.4, 31.6, 1.8, '#fff3b0', { w: 0.5 }); glow(x, 72.6, 31.6, 5, '#fff0a8', 0.5);
  box(x, 8, 2.4, 22, 4, '#2a2a32', { w: 0.6 }); x.fillStyle = '#ffb24a'; x.font = 'bold 3.2px "PingFang SC",sans-serif'; x.textAlign = 'left'; x.fillText('71路 滨江坡道', 9.6, 5.4);
  // 轮
  [[16, 38.6], [58, 38.6]].forEach(([wx, wy]) => { ell(x, wx, wy, 5, 5, '#2c2a30', { w: 0.9 }); blob(x, wx, wy, 2.2, '#b8b2aa', { w: 0.45 }); blob(x, wx, wy, 0.7, '#4a4650', { w: 0.2, shine: false }); });
  box(x, 2.6, 33.4, 71, 3.6, '#4a4650', { w: 0.6, mottle: 0.1 });
  // 无障碍斜板（收起，门旁黄黑标识）
  box(x, 40, 33, 12, 2.8, '#f2b53a', { w: 0.4, mottle: 0 }); for (let i = 0; i < 4; i++) { poly(x, [[40.6 + i * 3, 33.2], [42.4 + i * 3, 33.2], [41.4 + i * 3, 35.6], [39.6 + i * 3, 35.6]], '#3a3036', { w: 0, mottle: 0, amp: 0.02, stroke: false }); }
  // 圣诞装饰：车顶花环 + 灯串 + 雪
  strokePath(x, [[4, 7], [14, 10], [24, 7], [34, 10], [44, 7], [54, 10], [64, 7], [71, 9]], { w: 0.9, color: '#2f7a52', seed: 3 });
  [4, 14, 24, 34, 44, 54, 64].forEach((px, i) => { blob(x, px + 0.2, 8 + (i % 2) * 1.8, 0.8, ['#ffe27a', '#ff6a5a', '#7ad2ff'][i % 3], { w: 0 }); });
  snowCap(x, 5, 70, 5.6, 3.2, 8);
  bow(x, 70, 20, 0.9);
});
def('vending', 20, 32, (x) => {
  box(x, 2, 2, 16, 28, '#2f6aa8', { fill2: '#1c426e', w: 1, hi: 0.8, mottle: 0.2 });
  box(x, 3.6, 4, 9.6, 14.4, '#cfe6f0', { w: 0.7, mottle: 0.1, hi: 0.2 });
  [[5, 7, '#d83a34'], [8, 7, '#f2c230'], [11, 7, '#3d8f6f'], [5, 11.2, '#f08a24'], [8, 11.2, '#d83a34'], [11, 11.2, '#3a8fd9'], [5, 15.4, '#f2c230'], [8, 15.4, '#3d8f6f'], [11, 15.4, '#d83a34']].forEach(([px, py, col]) => box(x, px as number, py as number, 2, 2.6, col as string, { w: 0.35, mottle: 0, grain: 0 }));
  box(x, 14, 5, 3, 9, '#1c426e', { w: 0.5 }); [6.4, 9, 11.6].forEach((yy) => blob(x, 15.5, yy, 0.6, '#ffe27a', { w: 0.2, shine: false })); 
  box(x, 4, 21, 12, 5, '#161e2c', { w: 0.6 }); x.fillStyle = 'rgba(255,230,160,0.4)'; x.fillRect(5, 22, 10, 1);
  box(x, 4, 27, 12, 2, '#0f1620', { w: 0.4 }); bow(x, 10, 2.4, 0.8);
  snowCap(x, 2, 18, 1.8, 1.8, 2);
});
def('oven', 28, 30, (x) => {
  paint(x, [[2, 29], [2, 11], [5, 8.4], [23, 8.4], [26, 11], [26, 29]], { fill: '#a8483a', fill2: '#6e2c28', w: 1, amp: 0.2, step: 2.4, hi: 0.7, mottle: 0.4 });
  for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { const bx = 3 + c * 4 + (r % 2) * 2; if (bx + 3.6 < 26) line(x, [bx, 10 + r * 3.6], [bx + 3.4, 10.2 + r * 3.6], 0.25, '#e0c2a0', r + c); }
  paint(x, pEllipse(14, 19.6, 6.8, 5.6, { amp: 0.1 }), { fill: '#2a1c18', w: 0.9 }); paint(x, pEllipse(14, 20.4, 5.2, 4, { amp: 0.1 }), { fill: '#e0792a', fill2: '#ffd36a', w: 0, stroke: false, mottle: 0.3 });
  glow(x, 14, 20.4, 9, '#ffb24a', 0.45);
  box(x, 10.6, 3.2, 6.8, 6, '#6a5c58', { w: 0.8 }); [[13.4, 2.4], [14.6, 1]].forEach(([px, py]) => dab(x, px, py, 1.1, '#f1ecee', 0.6)); snowCap(x, 10, 18, 3, 1.6, 4);
  box(x, 4, 27.4, 20, 2, '#4a3028', { w: 0.5 });
});
def('sled', 30, 16, (x) => {
  strokePath(x, [[2, 13.4], [27, 13.4], [29, 11]], { w: 1.2, color: '#5a5660', seed: 2 }); strokePath(x, [[3, 10.6], [6, 13.4]], { w: 1, color: '#5a5660', seed: 3 });
  strokePath(x, [[2, 14.6], [27, 14.6], [29.4, 12]], { w: 0.5, color: '#bbb', seed: 4 });
  [7, 22].forEach((px) => pole(x, px, 8, 1.4, 13.4, '#5a5660', { w: 0.4 }));
  paint(x, [[2.4, 8.8], [28, 8.8], [26.6, 11], [4, 11]], { fill: '#c9443a', fill2: '#8a2a2a', w: 0.85, amp: 0.15, step: 2.6, hi: 0.6 });
  [8, 12, 16, 20].forEach((px, i) => line(x, [px, 8.8], [px, 10.8], 0.35, '#7a2020', i));
  for (let i = 0; i < 5; i++) { poly(x, [[5 + i * 4.6, 5.6], [7.2 + i * 4.6, 5.6], [7.6 + i * 4.6, 8.8], [4.8 + i * 4.6, 8.8]], '#8a5a34', { w: 0.45, mottle: 0.1, amp: 0.05 }); }
  [[26, 6], [27, 7.5]].forEach(([px, py], i) => blob(x, px, py + i, 1.1, '#f2c230', { w: 0.3 })); 
  snowCap(x, 4, 24, 5.4, 1.4, 5);
});
def('snowmachine', 30, 34, (x) => {
  box(x, 5, 22, 20, 9, '#d8d4cc', { fill2: '#a0a0a8', w: 0.9, hi: 0.7 }); box(x, 3, 30, 24, 2.4, '#4a4650', { w: 0.6 }); [[7, 33], [23, 33]].forEach(([wx, wy]) => ell(x, wx, wy, 2, 2, '#2c2a30', { w: 0.6 }));
  paint(x, [[7, 22], [9, 9], [21, 9], [23, 22]], { fill: '#e8a838', fill2: '#b87a22', w: 0.95, amp: 0.15, step: 2.6, hi: 0.7, mottle: 0.3 });
  paint(x, pEllipse(15, 11, 8, 3.2, { amp: 0.08 }), { fill: '#6a6a74', w: 0.8 }); paint(x, pEllipse(15, 11, 5.4, 2, { amp: 0.06 }), { fill: '#2a2a30', w: 0.5 });
  line(x, [15, 11], [25, 5], 3, '#7a7a86', 3); poly(x, [[24, 3.2], [29, 1.8], [29, 7.2], [24, 6.4]], '#8a8a96', { w: 0.6, mottle: 0.2 });
  [[26.6, 2.4], [28.4, 4], [27, 6], [25.4, 4.6]].forEach(([px, py], i) => { x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.arc(px, py + i * 0.2, 1 + (i % 2) * 0.4, 0, 6.3); x.fill(); });
  speckles(x, [22, 0, 8, 10], 14, ['#ffffff', '#e9f0ff'], [0.4, 1], 0.9, 11);
  [[9, 17, '#d83a34'], [9, 20, '#3d8f6f']].forEach(([px, py, col]) => blob(x, px as number, py as number, 0.9, col as string, { w: 0.3 }));
});
def('lamp_tall', 14, 64, (x) => {
  poly(x, [[3, 63], [4.4, 56], [9.6, 56], [11, 63]], '#2a342f', { w: 0.85 }); box(x, 5.8, 12, 2.6, 44.4, '#38443f', { fill2: '#1e2824', hi: 0.7 });
  box(x, 4.8, 36, 4.6, 1.6, '#2a342f', { w: 0.4 });
  poly(x, [[3, 3.4], [11, 3.4], [10, 12.4], [4, 12.4]], '#fff4c4', { fill2: '#f0b960', w: 0.85, mottle: 0.2, hi: 0.1, rim: 0.1 });
  x.fillStyle = radial(x, 7, 8, 5.6, [[0, 'rgba(255,255,230,1)'], [1, 'rgba(255,230,150,0)']]); x.fillRect(3, 3, 8, 9);
  poly(x, [[1.4, 3.6], [7, 0.4], [12.6, 3.6]], '#2a342f', { w: 0.7 }); box(x, 4, 12, 6, 1.8, '#2a342f', { w: 0.5 }); snowCap(x, 1.8, 12.4, 3.2, 1.6, 2);
  bow(x, 7, 26, 1);
  // 条纹（灯塔式）
  [18, 22, 26].forEach((yy) => { x.fillStyle = rgba('#d83a34', 0.0); void yy; });
});
def('crane', 44, 80, (x) => {
  // 码头吊机（门架）
  pole(x, 5, 24, 3, 78, '#a8442e', { w: 0.7 }); pole(x, 22, 24, 3, 78, '#a8442e', { w: 0.7 });
  [30, 44, 58, 70].forEach((yy, i) => { line(x, [6, yy], [23.5, yy + 10], 0.7, '#7a2e22', i); line(x, [23.5, yy], [6, yy + 10], 0.7, '#7a2e22', i + 4); });
  box(x, 2, 76, 26, 3.4, '#4a4650', { w: 0.7 });
  paint(x, [[2, 26], [2, 18], [5, 14], [40, 12], [43, 15], [43, 22], [32, 24]], { fill: '#e07a2e', fill2: '#a84a1c', w: 1, amp: 0.2, step: 3, hi: 0.7, mottle: 0.3 });
  box(x, 2, 18.4, 28, 8, '#d46a26', { w: 0.8 }); [[6, 20], [14, 20], [22, 20]].forEach(([px, py]) => box(x, px, py, 5, 4, '#9cc0d8', { w: 0.5, mottle: 0.1 }));
  box(x, 30, 10, 12, 4, '#4a4650', { w: 0.6 }); line(x, [10, 6], [40, 10], 0.9, PAL.iron, 3); line(x, [10, 6], [14, 18], 0.9, PAL.iron, 4);
  line(x, [38, 14], [38, 58], 0.5, '#5a5660', 5); poly(x, [[36, 58], [40, 58], [39, 63], [37, 63]], '#4a4650', { w: 0.6, mottle: 0 });
  paint(x, [[34, 40], [43, 40], [43, 50], [34, 50]], { fill: '#2f6aa8', fill2: '#1c426e', w: 0.8, hi: 0.5 }); line(x, [34, 45], [43, 45], 0.35, '#1c426e');
  snowCap(x, 3, 42, 13, 2.4, 6); blob(x, 4, 14, 1, '#ff5a4a', { w: 0.2, shine: false }); glow(x, 4, 14, 5, '#ff5a4a', 0.4);
});
def('ferry', 84, 46, (x) => {
  paint(x, [[2, 28], [6, 36], [16, 42], [70, 42], [80, 34], [83, 26], [76, 26], [6, 26]], { fill: '#2f4a68', fill2: '#18283c', w: 1.1, amp: 0.2, step: 3, hi: 0.6, mottle: 0.3 });
  box(x, 4, 25.6, 78, 3, '#e8e0d0', { w: 0.6 }); box(x, 7, 33, 70, 1.6, '#d83a34', { w: 0.4, mottle: 0 });
  paint(x, [[8, 25.6], [10, 12], [62, 12], [64, 25.6]], { fill: '#f4ead4', fill2: '#cdbd98', w: 1, amp: 0.15, step: 3, hi: 0.7, mottle: 0.3 });
  for (let i = 0; i < 7; i++) { paint(x, pRect(13 + i * 7, 16, 5, 6, { amp: 0.1 }), { fill: i === 3 ? '#ffe9a0' : '#9cc0d8', fill2: i === 3 ? '#f0b050' : '#4e6d8a', w: 0.6, mottle: 0.1 }); }
  paint(x, [[16, 12], [20, 5], [54, 5], [58, 12]], { fill: '#e8dcc0', fill2: '#bfae88', w: 0.9, amp: 0.15, step: 3, mottle: 0.2 });
  for (let i = 0; i < 4; i++) box(x, 24 + i * 7.6, 7, 5, 3.4, '#8cb0cc', { w: 0.5, mottle: 0.1 });
  paint(x, pRect(36, -0.4, 8, 6, { amp: 0.1 }), { fill: '#d83a34', fill2: '#8a2222', w: 0.8 }); box(x, 36, 1.6, 8, 1.8, '#f2c230', { w: 0.4, mottle: 0 }); 
  strokePath(x, [[3, 25.6], [20, 25.6], [40, 25.6], [60, 25.6], [78, 25.6]], { w: 0.5, color: '#6a5c58', seed: 3 });
  strokePath(x, [[8, 12], [8, 25.6]], { w: 0.5, color: '#6a5c58', seed: 4 }); strokePath(x, [[64, 12], [64, 25.6]], { w: 0.5, color: '#6a5c58', seed: 5 });
  strokePath(x, [[22, 5], [40, 1], [58, 5]], { w: 0.7, color: '#2f7a52', seed: 6 }); [24, 32, 40, 48, 56].forEach((px, i) => blob(x, px, 3.6 + Math.abs(40 - px) * 0.02, 0.8, ['#ffe27a', '#ff6a5a', '#7ad2ff'][i % 3], { w: 0 }));
  snowCap(x, 18, 56, 5, 2.4, 5); snowCap(x, 10, 62, 12.2, 2, 6);
  // 水线反光
  [[10, 38], [30, 40.6], [50, 41], [70, 38]].forEach(([px, py], i) => { x.strokeStyle = rgba('#fff', 0.35); x.lineWidth = 0.5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 8, py); x.stroke(); void i; });
});
def('kiosk', 26, 32, (x) => {
  box(x, 3, 12, 20, 18, '#d8c8a8', { fill2: '#a8946c', w: 0.9, hi: 0.7 });
  box(x, 5, 15, 16, 8, '#ffe0a0', { fill2: '#e0904c', w: 0.7, mottle: 0.1, hi: 0.2 }); box(x, 4, 23, 18, 1.8, '#8a5e38', { w: 0.5 });
  [0, 1, 2, 3].forEach((i) => { poly(x, [[2 + i * 5.5, 8], [7.5 + i * 5.5, 8], [7.5 + i * 5.5, 12.4], [2 + i * 5.5, 12.4]], i % 2 ? '#f6ecd6' : '#d83a34', { w: 0.55, mottle: 0.1, amp: 0.05 }); });
  snowCap(x, 1.6, 24.4, 7.8, 2.2, 3); box(x, 8, 25, 10, 5, '#8a6a48', { w: 0.5 });
});
def('trashcan', 12, 16, (x) => {
  paint(x, [[2, 14.6], [1.6, 5], [10.4, 5], [10, 14.6]], { fill: '#58645e', fill2: '#2e3834', w: 0.85, amp: 0.1, step: 2.4, hi: 0.7 });
  ell(x, 6, 4.4, 5, 1.6, '#6a766e', { w: 0.7 }); for (let i = 0; i < 4; i++) line(x, [3.4 + i * 1.8, 6.4], [3.4 + i * 1.8, 13.4], 0.3, '#2e3834', i); snowCap(x, 2, 10, 3.8, 1.6, 2);
});
def('signpost', 18, 34, (x) => {
  pole(x, 8, 4, 2.4, 33, '#6e4a30', { w: 0.6 });
  poly(x, [[1, 6], [13, 6], [16, 8.6], [13, 11], [1, 11]], '#d9a441', { fill2: '#a8742a', w: 0.75, mottle: 0.2, amp: 0.1 }); poly(x, [[17, 13.4], [5, 13.4], [2, 16], [5, 18.6], [17, 18.6]], '#c8372e', { fill2: '#8a2222', w: 0.75, mottle: 0.2, amp: 0.1 });
  line(x, [3, 8.6], [11, 8.6], 0.5, '#6a3a10'); line(x, [6, 16], [14, 16], 0.5, '#f7f1e3'); snowCap(x, 1.5, 13.5, 5.8, 1.4, 3);
});
def('lifebuoy', 14, 14, (x) => {
  ell(x, 7, 7, 6, 6, '#f6ecd6', { w: 0.85 }); [0, 1.57, 3.14, 4.71].forEach((a, i) => { x.save(); x.translate(7, 7); x.rotate(a); x.fillStyle = '#d83a34'; x.beginPath(); x.arc(0, 0, 5.9, -0.38, 0.38); x.arc(0, 0, 3.4, 0.38, -0.38, true); x.fill(); x.restore(); void i; });
  ell(x, 7, 7, 3, 3, '#00000000', { w: 0.7, fill: 'rgba(0,0,0,0)' }); x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(7, 7, 2.9, 0, 6.3); x.fill(); x.restore(); strokePath(x, [[4.2, 7], [7, 4.1], [9.8, 7], [7, 9.9], [4.2, 7]], { w: 0.5, color: PAL.ink, seed: 3, alpha: 0.7 });
});
def('lightstring', 40, 20, (x) => {
  strokePath(x, [[1, 3], [10, 8], [20, 10], [30, 8], [39, 3]], { w: 0.6, color: '#2a2230', seed: 2 });
  [[6, 6.4], [13, 9.2], [20, 10.4], [27, 9.2], [34, 6.4]].forEach(([px, py], i) => { const col = ['#ffe27a', '#ff6a5a', '#7ad2ff', '#ffe27a', '#ff6a5a'][i]; x.fillStyle = radial(x, px, py + 1.6, 4.4, [[0, rgba(col, 0.7)], [1, rgba(col, 0)]]); x.fillRect(px - 5, py - 3, 10, 10); blob(x, px, py + 1.4, 1.1, col, { w: 0.3 }); });
});
def('flowerbed', 30, 14, (x, r) => {
  paint(x, [[1, 12], [2, 6], [28, 6], [29, 12]], { fill: '#a89478', fill2: '#6e5e48', w: 0.85, amp: 0.15, step: 2.6, hi: 0.7 });
  paint(x, [[3, 7], [27, 7], [26, 4], [4, 4]], { fill: '#5a3e2e', fill2: '#3a281e', w: 0.5, amp: 0.1, grain: 0.5 });
  for (let i = 0; i < 9; i++) { const px = 5 + i * 2.6, py = 3.4 + r() * 1.6; line(x, [px, py + 2], [px + (r() - 0.5), py - 2], 0.4, '#3d6a3a', i); blob(x, px, py - 2.4, 1 + r() * 0.4, ['#f2c230', '#d96ea0', '#fff', '#e0413f'][i % 4], { w: 0.3 }); }
  snowCap(x, 3, 27, 6, 1.6, 3);
});
def('lantern_red', 10, 20, (x) => {
  line(x, [5, 0], [5, 4], 0.5, PAL.ink); paint(x, pEllipse(5, 9.4, 3.8, 4.6, { amp: 0.1 }), { fill: '#e3412f', fill2: '#9d2a2a', w: 0.8, mottle: 0.2, hi: 0.6 });
  box(x, 3, 4, 4, 1.2, '#e8b94a', { w: 0.3 }); box(x, 3, 13.4, 4, 1.2, '#e8b94a', { w: 0.3 }); line(x, [5, 14.6], [5, 19.4], 0.5, '#e8b94a'); glow(x, 5, 9.4, 7, '#ffb050', 0.4);
});

const r2 = (k: number) => hash2(k, 3, 8, 1);

// ═════════════ docs/08 §1.3 地标道具（part 1）═════════════
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
const chalk = (x: Ctx, t: string, cx: number, cy: number, px: number, col = '#f7f1e3') => { x.save(); x.fillStyle = col; x.font = `bold ${px}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.globalAlpha = 0.92; x.fillText(t, cx, cy); x.restore(); };

def('fish_rack', 36, 30, (x, r) => {
  pole(x, 3, 6, 2.2, 29, '#7a5638'); pole(x, 30.8, 6, 2.2, 29, '#7a5638');
  box(x, 1.6, 5.4, 32.8, 2, '#8d6240', { w: 0.7 }); box(x, 2.4, 14, 31, 1.4, '#8d6240', { w: 0.5 });
  for (let i = 0; i < 6; i++) { const px = 6 + i * 4.6; line(x, [px, 7], [px, 10], 0.35, '#6e4526', i); poly(x, [[px - 1.2, 10], [px + 1.2, 10], [px + 1.5, 17.5 + (i % 3)], [px, 19 + (i % 3)], [px - 1.5, 17.5 + (i % 3)]], i % 2 ? '#aab7c4' : '#c3ccd4', { fill2: '#7c8a9a', w: 0.4, mottle: 0.2, amp: 0.05, hi: 0.5 }); dab(x, px, 12, 0.35, '#2a2a34', 0.7); }
  for (let i = 0; i < 4; i++) { const px = 8 + i * 6; line(x, [px, 14.6], [px, 17], 0.3, '#6e4526', i + 9); poly(x, [[px - 1, 17], [px + 1, 17], [px + 1.2, 22.4], [px, 23.6], [px - 1.2, 22.4]], '#d9c9a0', { fill2: '#a08c60', w: 0.35, mottle: 0.2, amp: 0.05 }); }
  box(x, 6, 27.2, 24, 2, '#c9b890', { w: 0.4, mottle: 0.1 }); snowCap(x, 2, 34, 5.4, 1.4, 3);
});
def('mailbox_alley', 16, 28, (x) => {
  box(x, 3.5, 25, 2.4, 3, '#2a3a2c', { w: 0.45 }); box(x, 10.2, 25, 2.4, 3, '#2a3a2c', { w: 0.45 });
  poly(x, [[2.4, 26], [2.4, 11], [3.6, 6.6], [8, 5], [12.4, 6.6], [13.6, 11], [13.6, 26]], '#4a7a58', { fill2: '#2c5238', w: 0.9, hi: 0.6, amp: 0.2, step: 2.2, mottle: 0.55 });
  for (let k = 0; k < 6; k++) dab(x, 3.6 + r2(k) * 9, 12 + r2(k + 5) * 12, 0.9, '#a05a30', 0.5); // 锈迹
  box(x, 4.4, 12.2, 7, 1.8, '#10261a', { w: 0.35, mottle: 0, grain: 0 });
  poly(x, [[6, 12.6], [10.4, 11.2], [11, 14], [6.4, 14.6]], '#f2e8d2', { w: 0.35, mottle: 0, amp: 0.05 });
  box(x, 3, 19, 10, 1.8, '#e8b93a', { w: 0.45, mottle: 0.1 }); chalk(x, '弄堂', 8, 19.9, 1.8, '#5a3a14');
  snowCap(x, 3.4, 12.6, 5.6, 1.6, 4);
});
def('radio', 18, 16, (x) => {
  box(x, 1, 13, 16, 2.6, '#6a4a32', { w: 0.55 });
  poly(x, [[2, 13], [2, 4.4], [3.2, 3.4], [14.8, 3.4], [16, 4.4], [16, 13]], '#a9683a', { fill2: '#6e3e22', w: 0.9, hi: 0.7, amp: 0.1, step: 2 });
  box(x, 3.2, 5.2, 7.4, 6.4, '#e0c58a', { fill2: '#a88a50', w: 0.6, mottle: 0.2 });
  for (let i = 0; i < 5; i++) line(x, [3.8, 6.2 + i * 1.2], [10, 6.2 + i * 1.2], 0.25, '#7a5a30', i);
  blob(x, 13, 6.6, 1.3, '#e8dfc8', { w: 0.4 }); blob(x, 13, 10.2, 1.1, '#e8dfc8', { w: 0.4 }); line(x, [13, 6.6], [13.6, 5.9], 0.3, '#3a2418');
  line(x, [14, 3.4], [17, -0], 0.35, '#7a7a84'); dab(x, 5.4, 4.6, 0.7, '#fff2c0', 0.6);
});
def('catbox', 22, 14, (x) => {
  poly(x, [[1, 13.2], [1, 4.4], [4, 3.2], [18, 3.2], [21, 4.4], [21, 13.2]], '#c89860', { fill2: '#96683a', w: 0.9, hi: 0.7, amp: 0.15 });
  poly(x, [[4.4, 13], [4.4, 6.4], [17.6, 6.4], [17.6, 13]], '#4a3228', { w: 0.7, mottle: 0.1, amp: 0.1 });
  poly(x, [[5.4, 13], [5.8, 10.4], [11, 9.6], [16.8, 10.4], [17.2, 13]], '#d85a4a', { fill2: '#a43a34', w: 0.5, mottle: 0.3 });
  poly(x, [[8, 9.6], [8.2, 7], [9.4, 8.2], [11, 7.6], [12.6, 8.2], [13.8, 7], [14, 9.6]], '#f2f0ea', { w: 0.45, mottle: 0.1, amp: 0.05 });
  blob(x, 9.4, 8.8, 0.3, '#2a2a34', { w: 0, shine: false }); blob(x, 12.6, 8.8, 0.3, '#2a2a34', { w: 0, shine: false });
  line(x, [3, 4.6], [19, 4.6], 0.3, '#7a4e28', 1); chalk(x, '麻薯', 11, 1.7, 2, '#7a4a20'); snowCap(x, 1.4, 20.6, 3.2, 1.4, 5);
});
def('bone_bucket', 14, 18, (x) => {
  [[4.5, 7], [9, 5.6], [6.8, 3.6]].forEach(([px, py], i) => { x.save(); x.translate(px, py); x.rotate(-0.5 + i * 0.5); line(x, [0, -2.4], [0, 3.2], 1, '#f2ead8', i); blob(x, -0.7, -2.8, 0.9, '#f2ead8', { w: 0.35, shine: false }); blob(x, 0.8, -2.8, 0.9, '#f2ead8', { w: 0.35, shine: false }); x.restore(); });
  poly(x, [[1.6, 7.4], [12.4, 7.4], [11.2, 17.4], [2.8, 17.4]], '#8ea0ae', { fill2: '#5a6c7a', w: 0.9, hi: 0.7, amp: 0.1, step: 2 });
  line(x, [1.6, 7.6], [12.4, 7.6], 1, '#6a7e8c'); line(x, [2.2, 11.6], [11.8, 11.6], 0.4, '#5a6c7a'); line(x, [2.6, 14.4], [11.4, 14.4], 0.4, '#5a6c7a');
  strokePath(x, [[2, 8], [7, 1.6], [12, 8]], { w: 0.4, color: '#4a5a66', seed: 2 }); snowCap(x, 1.8, 12.2, 7.2, 1.2, 6);
});
// 橱窗：0=暗 1=亮（旧围裙+面粉袋）
const windowApron = (lit: boolean) => (x: Ctx) => {
  box(x, 1, 1, 34, 26, '#5a3a2a', { w: 0.9, hi: 0.5 });
  paint(x, pRect(3, 3, 30, 22, { amp: 0.05 }), { fill: lit ? '#ffe3a0' : '#4a5668', fill2: lit ? '#f0a85a' : '#2a3040', w: 0.6, mottle: 0.2, hi: 0.3 });
  if (lit) glow(x, 18, 14, 22, '#ffc060', 0.5);
  poly(x, [[8, 6], [20, 6], [19, 9], [21.4, 20], [6.6, 20], [9, 9]], lit ? '#f2ead0' : '#a89e90', { fill2: lit ? '#d8c8a0' : '#6e6660', w: 0.6, mottle: 0.2, amp: 0.08 }); // 围裙
  box(x, 11, 12, 6, 4.4, lit ? '#e8d8b0' : '#8a8076', { w: 0.45, mottle: 0.1 }); line(x, [10, 6], [14, 3.4], 0.4, '#5a3a2a'); line(x, [18, 6], [14, 3.4], 0.4, '#5a3a2a');
  poly(x, [[22, 25], [22.4, 16], [24, 14.6], [30.4, 14.6], [32, 16], [32, 25]], lit ? '#f4efe0' : '#9a948c', { fill2: lit ? '#d4c8a8' : '#625e58', w: 0.65, mottle: 0.25, amp: 0.1 }); // 面粉袋
  chalk(x, '面粉', 27, 20.2, 2.8, lit ? '#a05a2a' : '#4a463e');
  line(x, [19, 3], [19, 25], 0.5, '#5a3a2a'); line(x, [3, 14], [33, 14], 0.4, '#5a3a2a'); box(x, 0.2, 26.4, 35.6, 2, '#6e4a34', { w: 0.6 });
};
def('window_apron_0', 36, 30, windowApron(false)); def('window_apron_1', 36, 30, windowApron(true));
// 卷帘门：0=关 1=开（半卷，露出暖光）
const shutter = (open: boolean) => (x: Ctx) => {
  box(x, 0.6, 1.2, 24.8, 3.2, '#6a6a74', { w: 0.8, hi: 0.6 });
  if (!open) { box(x, 1.6, 4.4, 22.8, 24.4, '#8e97a2', { fill2: '#5e6674', w: 0.9, hi: 0.5 }); for (let i = 0; i < 12; i++) line(x, [1.8, 6.2 + i * 2], [24.2, 6.2 + i * 2 + 0.1], 0.3, '#4a5260', i); box(x, 9, 24.4, 8, 1.6, '#3a3a44', { w: 0.4 }); snowCap(x, 0.6, 25.4, 1.4, 1.4, 2); }
  else { paint(x, pRect(1.6, 4.4, 22.8, 24.4, { amp: 0.05 }), { fill: '#ffe8b0', fill2: '#e8924a', w: 0.7, mottle: 0.2, hi: 0.2 }); glow(x, 13, 18, 16, '#ffbf5a', 0.5); box(x, 1.6, 4.4, 22.8, 6, '#8e97a2', { fill2: '#5e6674', w: 0.8 }); for (let i = 0; i < 3; i++) line(x, [1.8, 6 + i * 2], [24.2, 6 + i * 2], 0.3, '#4a5260', i); box(x, 6, 20, 14, 2.4, '#a8683a', { w: 0.5 }); blob(x, 10, 18.6, 1.6, '#e0a860', { w: 0.35 }); blob(x, 15, 18.8, 1.4, '#d8984a', { w: 0.35 }); }
  box(x, 0.6, 28.6, 24.8, 1.4, '#4a4a54', { w: 0.45 });
};
def('shutter_0', 26, 30, shutter(false)); def('shutter_1', 26, 30, shutter(true));
const sign = (t1: string, t2: string, col: string) => (x: Ctx) => {
  line(x, [3, 25], [6.4, 2.8], 1.1, '#6e4526', 1); line(x, [13, 25], [9.6, 2.8], 1.1, '#6e4526', 2);
  poly(x, [[2.4, 3.8], [13.6, 3.8], [14.6, 20.6], [1.4, 20.6]], '#2a3a34', { fill2: '#1a2622', w: 0.9, hi: 0.4, amp: 0.1, step: 2 });
  strokePath(x, [[2.4, 3.8], [13.6, 3.8], [14.6, 20.6], [1.4, 20.6]], { w: 0.9, color: '#8d6240', closed: true, seed: 4 });
  chalk(x, t1, 8, 8.4, 3.6, col); chalk(x, t2, 8, 13.2, 3.4, '#f7f1e3'); line(x, [3.8, 16.8], [12.4, 16.8], 0.3, '#e8d8a0', 3); dab(x, 11.6, 6.4, 0.6, '#ffd36a', 0.8);
};
def('sign_salty', 16, 26, sign('咸味', '俄式', '#ffd36a')); def('sign_cake', 16, 26, sign('圣诞', '蛋糕', '#ff9a8a'));
def('coffee_cart', 34, 36, (x) => {
  [[8, 33], [26, 33]].forEach(([cx, cy]) => { blob(x, cx, cy, 3.2, '#3a2c28', { w: 0.7, shine: false }); blob(x, cx, cy, 1.2, '#b8a890', { w: 0.35, shine: false }); });
  box(x, 3, 14, 28, 17, '#2f6b6a', { fill2: '#1d4646', w: 0.95, hi: 0.7 }); box(x, 3, 14, 28, 2.4, '#f2e8d0', { w: 0.5 }); box(x, 6, 18, 22, 7.6, '#ffe6b0', { fill2: '#e0a45a', w: 0.65, mottle: 0.1 });
  box(x, 3, 24.6, 28, 1.8, '#c8a878', { w: 0.5 });
  [[10, 22], [17, 22], [24, 22]].forEach(([cx, cy], i) => { poly(x, [[cx - 1.4, cy - 2.6], [cx + 1.4, cy - 2.6], [cx + 1, cy + 0.2], [cx - 1, cy + 0.2]], '#f6f0e4', { w: 0.35, mottle: 0, amp: 0.03 }); dab(x, cx, cy - 3.6, 0.9, '#f1ecee', 0.5); });
  for (let i = 0; i < 6; i++) poly(x, [[2 + i * 5, 5.4], [7 + i * 5, 5.4], [7.4 + i * 5, 12], [1.6 + i * 5, 12]], i % 2 ? '#f2e8d0' : '#c8453c', { w: 0.5, mottle: 0.1, amp: 0.05 });
  pole(x, 3, 5.4, 1.1, 14, '#6e4526'); pole(x, 29.8, 5.4, 1.1, 14, '#6e4526'); snowCap(x, 1.6, 32.4, 5.2, 2, 5); chalk(x, '咖啡', 17, 28.2, 3.2, '#f6e8c8');
});
// 炉灶点火态：在 oven 基础上叠火光/火星/烟
T['oven_lit'] = mkTex(28, 36, (x, r) => {
  x.drawImage(T['oven'], 0, 6, 28, 30);
  glow(x, 14, 26.4, 16, '#ff9a3a', 0.6); glow(x, 14, 26.4, 6, '#fff0a0', 0.5);
  for (let i = 0; i < 3; i++) poly(x, [[10.6 + i * 3.4, 29], [11.6 + i * 3.4, 22.6 - (i % 2) * 2], [12.8 + i * 3.4, 29]], i === 1 ? '#fff2a0' : '#ffb03a', { w: 0, stroke: false, mottle: 0, amp: 0.15, grain: 0 } as any);
  for (let i = 0; i < 6; i++) dab(x, 10 + r() * 8, 14 + r() * 10, 0.4 + r() * 0.3, '#ffd36a', 0.8);
  [[14, 5], [15.4, 2.6], [13.6, 0.6]].forEach(([px, py], i) => dab(x, px, py, 1.4 + i * 0.4, '#e8e4ea', 0.55 - i * 0.12));
}, { seed: 71 });
def('letter_a', 14, 11, (x) => {
  x.save(); x.translate(7, 5.5); x.rotate(-0.18);
  poly(x, [[-6, -4], [6, -4], [6, 4], [-6, 4]], '#f7efdc', { fill2: '#e0d2b0', w: 0.7, mottle: 0.15, amp: 0.05 });
  strokePath(x, [[-6, -4], [0, 0.6], [6, -4]], { w: 0.6, color: '#8a6a4a', seed: 3 }); strokePath(x, [[-6, 4], [-1.6, -0.2]], { w: 0.4, color: '#c9b890', seed: 4 }); strokePath(x, [[6, 4], [1.6, -0.2]], { w: 0.4, color: '#c9b890', seed: 5 });
  blob(x, 0, 0.7, 1.5, '#c8372e', { w: 0.45 }); box(x, 3.2, -3.4, 2.4, 2.6, '#e8b93a', { w: 0.35, mottle: 0 }); x.restore();
});
def('bus_sign', 14, 40, (x) => {
  box(x, 6, 12, 2, 27, '#6a6a74', { w: 0.6 }); box(x, 3.4, 37.4, 7.2, 2.2, '#4a4a54', { w: 0.5 });
  paint(x, pRect(1.4, 3, 11.2, 11, { amp: 0.08 }), { fill: '#2a6bb0', fill2: '#1a4278', w: 0.9, hi: 0.6, mottle: 0.2 });
  box(x, 2.6, 4.2, 8.8, 4, '#f6f0e4', { w: 0.4, mottle: 0 }); chalk(x, '37', 7, 6.4, 3.4, '#1a4278'); chalk(x, '路', 7, 11, 2.6, '#f6f0e4'); snowCap(x, 1, 13, 3, 1.4, 4);
});
def('bus_sign_p', 16, 44, (x) => {
  box(x, 6.6, 20, 2.8, 23, '#4a4a54', { w: 0.6 }); box(x, 4, 41.2, 8, 2.4, '#3a3a44', { w: 0.5 });
  glow(x, 8, 12, 14, '#ffe6a0', 0.5);
  box(x, 1.4, 1.6, 13.2, 20, '#4a4a54', { w: 0.9, hi: 0.5 }); paint(x, pRect(2.8, 3.2, 10.4, 16.6, { amp: 0.04 }), { fill: '#fff0c0', fill2: '#f0b860', w: 0.5, mottle: 0.15, hi: 0.2 });
  chalk(x, '公交', 8, 8, 3.2, '#a8461e'); chalk(x, '37', 8, 14, 4, '#d8453a'); snowCap(x, 1, 15, 1.6, 1.6, 6);
});
def('berm', 36, 14, (x) => {
  paint(x, [[0.5, 13], [1.6, 8.4], [5, 4.4], [9, 3], [12, 1.4], [17, 0.8], [22, 2], [27, 3.6], [32, 6], [35, 9.4], [35.6, 13]], { fill: PAL.snow, fill2: PAL.snowShade, w: 0.8, hi: 0.8, amp: 0.4, step: 2, mottle: 0.3, stroke: PAL.inkCool } as any);
  for (let i = 0; i < 9; i++) dab(x, 4 + i * 3.6, 5 + (i % 3) * 2, 0.9, '#fff', 0.7);
  for (let i = 0; i < 7; i++) dab(x, 3 + i * 5, 12.4, 1.4, '#b8bcd8', 0.3);
});
def('finish_arch', 60, 52, (x, r) => {
  pole(x, 3, 12, 3.4, 51, '#c8372e', { w: 0.9 }); pole(x, 53.6, 12, 3.4, 51, '#c8372e', { w: 0.9 });
  for (let i = 0; i < 6; i++) { box(x, 3, 14 + i * 6.2, 3.4, 3.1, '#f6f0e4', { w: 0.2, mottle: 0, grain: 0 }); box(x, 53.6, 14 + i * 6.2, 3.4, 3.1, '#f6f0e4', { w: 0.2, mottle: 0, grain: 0 }); }
  paint(x, [[1.6, 20], [3, 9], [15, 3.4], [30, 1.6], [45, 3.4], [57, 9], [58.4, 20]], { fill: '#f6f0e4', w: 0.9, hi: 0.5, amp: 0.15, mottle: 0.1, step: 2.6 } as any);
  strokePath(x, [[3.4, 17], [4.6, 9.8], [16, 5.2], [30, 3.6], [44, 5.2], [55.4, 9.8], [56.6, 17]], { w: 2.6, color: '#d8453a', seed: 5, vary: 0.2 });
  for (let i = 0; i < 12; i++) { const a = i / 11; const px = 8 + a * 44, py = 11 - Math.sin(a * Math.PI) * 5 + 4; if (Math.abs(px - 30) < 8) continue; box(x, px - 1.5, py, 3, 3, (Math.floor(i) % 2) ? '#2a2a34' : '#f6f0e4', { w: 0.25, mottle: 0, grain: 0 }); }
  chalk(x, '终 点', 30, 12.4, 5.4, '#c8372e');
  const cols = ['#e8453a', '#f2b73a', '#4aa0d8', '#7ac060', '#e87aa8'];
  for (let i = 0; i < 7; i++) { const px = 8 + i * 7.4, py = 22 + Math.sin(i * 0.9) * 2; line(x, [px, 14], [px, py], 0.3, '#7a6a56', i); blob(x, px, py + 3, 2.6, cols[i % 5], { w: 0.45 }); }
  snowCap(x, 2, 58, 2.6, 1.8, 7); void r;
});
def('bike_xl', 46, 30, (x) => { x.scale(1.44, 1.44); bikeBody(x); });
def('mirror', 20, 38, (x) => {
  line(x, [4, 37], [6.6, 33], 1.2, '#6e4526', 1); line(x, [16, 37], [13.4, 33], 1.2, '#6e4526', 2); box(x, 3, 35.6, 14, 1.8, '#5a3a22', { w: 0.45 });
  paint(x, pEllipse(10, 16, 8.2, 16.6, { amp: 0.05 }), { fill: '#a87a42', fill2: '#6e4a26', w: 1, hi: 0.8, mottle: 0.4 });
  paint(x, pEllipse(10, 16, 6.4, 14.8, { amp: 0.03 }), { fill: '#d4eaf4', fill2: '#8aaed0', w: 0.7, mottle: 0.15, hi: 0.2, grad: 1 } as any);
  x.save(); x.beginPath(); x.ellipse(10, 16, 6.2, 14.6, 0, 0, 6.3); x.clip();
  [[-4, 0.4], [1, 0.25], [6, 0.15]].forEach(([o, a]) => { x.fillStyle = `rgba(255,255,255,${a})`; x.beginPath(); x.moveTo(6 + o, 0); x.lineTo(9 + o, 0); x.lineTo(14 + o, 36); x.lineTo(11 + o, 36); x.fill(); });
  x.restore(); dab(x, 7.4, 6, 1, '#fff', 0.9); blob(x, 10, 1.4, 1, '#e8b93a', { w: 0.35 });
});
def('bread_cart', 32, 30, (x) => {
  [[8, 27], [24, 27]].forEach(([cx, cy]) => { blob(x, cx, cy, 3.1, '#5a3a22', { w: 0.7, shine: false }); blob(x, cx, cy, 1.1, '#c8a878', { w: 0.35, shine: false }); });
  box(x, 2, 12, 28, 12, '#a86a3a', { fill2: '#6e4022', w: 0.95, hi: 0.7 }); box(x, 2, 12, 28, 2, '#e8c88a', { w: 0.45 });
  for (let i = 0; i < 5; i++) ell(x, 6 + i * 5, 11, 2.6, 1.7, ['#d89a50', '#c8843a', '#e8b068'][i % 3], { w: 0.45, hi: 0.8 });
  for (let i = 0; i < 4; i++) line(x, [4 + i * 7, 15], [4 + i * 7, 23], 0.3, '#4a2c16', i);
  line(x, [3, 12], [1, 6], 0.9, '#6e4526'); line(x, [1, 6], [-0.4, 6], 0.9, '#6e4526');
  for (let i = 0; i < 4; i++) poly(x, [[4 + i * 6.6, 4], [10 + i * 6.6, 4], [10.4 + i * 6.6, 9], [3.6 + i * 6.6, 9]], i % 2 ? '#f6ecd6' : '#d83a34', { w: 0.45, mottle: 0.1, amp: 0.04 });
  chalk(x, '面包', 16, 19, 3.2, '#f6e8c8');
});
const frameSpot = (painted: boolean) => (x: Ctx) => {
  line(x, [4, 31], [7, 22], 1, '#6e4526', 1); line(x, [20, 31], [17, 22], 1, '#6e4526', 2); line(x, [12, 31], [12, 22], 0.9, '#6e4526', 3);
  box(x, 1.4, 1.4, 21.2, 22, '#8d6240', { fill2: '#5a3a22', w: 1, hi: 0.7 });
  if (!painted) { box(x, 4, 4, 16, 17, '#f2ecdc', { w: 0.5, mottle: 0.15, hi: 0.1 }); dab(x, 8, 8, 1.4, '#fff', 0.5); }
  else { paint(x, pRect(4, 4, 16, 17, { amp: 0.04 }), { fill: '#f2c880', fill2: '#d98a5a', w: 0.5, mottle: 0.25 }); poly(x, [[4, 21], [4, 15], [9, 13], [14, 15], [20, 12], [20, 21]], '#fff7f2', { fill2: '#cfd3e8', w: 0.35, mottle: 0.1, amp: 0.1 }); poly(x, [[10, 14], [12, 7], [14, 14]], '#2f8352', { w: 0.35, mottle: 0, amp: 0.05 }); poly(x, [[8.2, 11], [12, 5], [16, 11]], '#2f8352', { w: 0.35, mottle: 0, amp: 0.05 }); blob(x, 12, 4.4, 1, '#e8b93a', { w: 0.3 }); blob(x, 7, 8, 0.7, '#e8453a', { w: 0.2 }); dab(x, 16, 7, 0.6, '#fff7c0', 0.9); }
};
def('frame_spot_0', 24, 32, frameSpot(false)); def('frame_spot_1', 24, 32, frameSpot(true));



// ─── 独立建筑：由立面 wall_* 拼成的自由站立小楼；锚点 origin(0.5,1)=最靠近镜头的前角（瓦片顶点 (tx1,ty1)）───
// 画布左右对称：前角在水平中心；左面(ne 样式)长 lt 瓦片，右面(nw 样式)长 rt 瓦片。
function house(key: string, v: string, lt: number, rt: number, roof: [string, string], roofH: number, ft: number, chim = true) {
  const wl = facadeWall('ne', v), wr = facadeWall('nw', v), H = 110, half = Math.max(lt, rt) * 16, W = half * 2, M = roofH + 8;
  const dyL = M + Math.max(0, (rt - lt) * 8), dyR = dyL + (lt - rt) * 8, Cy = dyL + H + lt * 8, Ht = Cy - 10;
  T[key] = mkTex(W, Ht, (x, r) => {
    const L: Pt = [half - lt * 16, dyL + ft], F: Pt = [half, dyL + ft + lt * 8], Rr: Pt = [half + rt * 16, dyR + ft], B: Pt = [L[0] + rt * 16, L[1] - rt * 8];
    const C: Pt = [(L[0] + Rr[0]) / 2, (L[1] + Rr[1]) / 2 - roofH];
    const ex = 3; // 屋檐外挑
    const oL: Pt = [L[0] - ex, L[1] + 1], oF: Pt = [F[0], F[1] + ex * 0.8], oR: Pt = [Rr[0] + ex, Rr[1] + 1];
    // 后坡与烟囱（先画，被前坡遮挡）
    if (chim) { const cx0 = C[0] + 4, cy0 = C[1] - 2; box(x, cx0, cy0 - 12, 7, 15, '#a8483a', { w: 0.8, hi: 0.6 }); box(x, cx0 - 1, cy0 - 14, 9, 3, '#7a3a30', { w: 0.6 }); snowCap(x, cx0 - 1, cx0 + 8, cy0 - 14, 1.6, 3); }
    paint(x, [oL, oF, C], { fill: roof[0], fill2: shade(roof[0], -0.2), w: 0.95, hi: 0.7, amp: 0.2, step: 2.4, mottle: 0.4 } as any);
    paint(x, [oF, oR, C], { fill: shade(roof[1], -0.1), fill2: shade(roof[1], -0.35), w: 0.95, hi: 0.2, amp: 0.2, step: 2.4, mottle: 0.4 } as any);
    for (let k = 1; k < 6; k++) { const a = k / 6; line(x, [oL[0] + (C[0] - oL[0]) * a, oL[1] + (C[1] - oL[1]) * a], [oF[0] + (C[0] - oF[0]) * a, oF[1] + (C[1] - oF[1]) * a], 0.25, shade(roof[0], -0.35), k); line(x, [oF[0] + (C[0] - oF[0]) * a, oF[1] + (C[1] - oF[1]) * a], [oR[0] + (C[0] - oR[0]) * a, oR[1] + (C[1] - oR[1]) * a], 0.25, shade(roof[1], -0.4), k + 9); }
    // 立面
    const sw = (w: { canvas: HTMLCanvasElement }, sx: number, sw_: number, dx: number, dy: number) => x.drawImage(w.canvas, sx * SS, 0, sw_ * SS, w.canvas.height, dx, dy, sw_, w.canvas.height / SS);
    sw(wl, 0, lt * 16, half - lt * 16, dyL); sw(wr, 160 - rt * 16, rt * 16, half, dyR);
    // 屋顶前沿（压在立面上沿，盖住接缝）
    strokePath(x, [oL, oF, oR], { w: 1.8, color: shade(roof[0], -0.45), seed: 9, vary: 0.2 });
    // 前角墙线
    line(x, [half, F[1]], [half, Cy - 12], 0.9, PAL.ink, 1);
    void r; void B;
  }, { seed: 91 });
}
house('house_f', 'f', 6, 4, ['#9a3f35', '#b8564a'], 24, 8);
house('warehouse_i', 'i', 6, 4, ['#6a7a8a', '#8a98a6'], 14, 8, false);


// ═════════════ part 2（product E8）═════════════
const balloonCols = ['#e8453a', '#f2b73a', '#4aa0d8', '#7ac060', '#e87aa8', '#9a6ad8'];
const balloon = (x: Ctx, cx: number, cy: number, rr: number, col: string, i = 0) => { line(x, [cx, cy + rr * 1.1], [cx + (i % 2 ? 1 : -1) * 0.8, cy + rr * 1.1 + 5], 0.25, '#7a6a56', i); paint(x, pEllipse(cx, cy, rr, rr * 1.18, { amp: 0.06 }), { fill: col, fill2: shade(col, -0.3), w: 0.6, hi: 0.8, mottle: 0.1 }); dab(x, cx - rr * 0.35, cy - rr * 0.45, rr * 0.28, '#fff', 0.7); };
def('balloon_bundle', 20, 36, (x) => {
  const ps: [number, number, number][] = [[10, 8, 4.4], [4.6, 13, 4], [15.4, 13, 4], [8, 19, 3.8], [13, 20, 3.6]];
  ps.forEach(([cx, cy, rr], i) => line(x, [10, 34], [cx, cy + rr * 1.15], 0.25, '#7a6a56', i + 3));
  ps.forEach(([cx, cy, rr], i) => balloon(x, cx, cy, rr, balloonCols[i % 6], i)); bow(x, 10, 31.6, 0.6, '#d33a2c');
});
def('berm_low', 30, 8, (x) => {
  paint(x, [[0.5, 7.4], [1.6, 4.6], [6, 2.4], [12, 1.2], [18, 1.6], [24, 3], [28.6, 4.8], [29.6, 7.4]], { fill: PAL.snow, fill2: PAL.snowShade, w: 0.75, hi: 0.8, amp: 0.3, step: 2, mottle: 0.3, stroke: PAL.inkCool } as any);
  for (let i = 0; i < 6; i++) dab(x, 4 + i * 4.2, 3.4 + (i % 2), 0.8, '#fff', 0.7);
});
def('bus_ramp', 30, 10, (x) => {
  // 放下的无障碍斜板：黄黑警示边 + 防滑条 + 铰链
  poly(x, [[0.6, 8.6], [2.4, 2.4], [29.4, 1.6], [28.8, 8.6]], '#b9bcc4', { fill2: '#7c808c', w: 0.8, hi: 0.6, mottle: 0.2 });
  for (let i = 0; i < 9; i++) line(x, [4 + i * 2.9, 3.4], [3.4 + i * 2.9, 7.8], 0.45, '#5f636e', i);
  for (let i = 0; i < 10; i++) box(x, 1.6 + i * 2.8, 8.2, 1.6, 1.4, i % 2 ? '#2a2a34' : '#f2c230', { w: 0.2, mottle: 0, grain: 0 });
  line(x, [2.4, 2.4], [29.4, 1.6], 0.6, '#e8b93a'); box(x, 27.4, 0.8, 2.4, 8, '#6a6e7a', { w: 0.5 });
});
const balloonArch = (state: number) => (x: Ctx) => {
  x.save(); x.scale(40 / 60, 44 / 52); T['finish_arch'] && x.drawImage(T['finish_arch'], 0, 0, 60, 52); x.restore();
  void state;
};
// 终点拱门三态：普通 / 挂满气球 / 炸开（以 finish_arch 为底叠加；画布 40×44 的需求尺寸以 60×52 实现更精细，用 setScale 缩放即可）
const arch = (mode: 'balloons' | 'pop') => (x: Ctx, r: () => number) => {
  x.drawImage(T['finish_arch'], 0, 0, 60, 52);
  if (mode === 'balloons') {
    for (let i = 0; i < 15; i++) { const a = i / 14, bx = 6 + a * 48, by = 14 - Math.sin(a * Math.PI) * 9 + (i % 2) * 4; balloon(x, bx, by, 3.4 + (i % 3) * 0.5, balloonCols[i % 6], i); }
  } else {
    for (let i = 0; i < 40; i++) { x.save(); x.translate(r() * 60, r() * 48); x.rotate(r() * 6); x.fillStyle = balloonCols[i % 6]; x.fillRect(-1.1, -0.45, 2.2, 0.9); x.restore(); }
    for (let i = 0; i < 12; i++) { const bx = 8 + r() * 44, by = 4 + r() * 24; line(x, [bx, by], [bx + r() * 2 - 1, by + 6 + r() * 6], 0.25, '#7a6a56', i); }
    for (let i = 0; i < 8; i++) { const bx = 6 + r() * 48, by = 24 + r() * 22; x.save(); x.translate(bx, by); x.rotate(r() * 6); poly(x, [[-1.8, 0], [0, -1.2], [1.8, 0.4], [0.2, 1.4]], balloonCols[i % 6], { w: 0.3, mottle: 0, amp: 0.05, grain: 0 }); x.restore(); }
  }
};
T['finish_arch_balloons'] = mkTex(60, 52, (x, r) => arch('balloons')(x, r), { seed: 61 });
T['finish_arch_pop'] = mkTex(60, 52, (x, r) => arch('pop')(x, r), { seed: 62 });
def('card_bundle', 14, 10, (x) => {
  [[1, 4, '#d8453a', -0.1], [2.6, 2.6, '#f6f0e4', 0.06], [4.2, 3.4, '#4a9a5a', 0.12]].forEach(([px, py, c, rot], i) => { x.save(); x.translate(px as number + 3, py as number + 3); x.rotate(rot as number); box(x, 0, 0, 8, 5.4, c as string, { w: 0.5, mottle: 0.1 }); line(x, [1, 1.8], [7, 1.8], 0.3, i === 1 ? '#d8453a' : '#f6f0e4', i); x.restore(); });
  line(x, [1, 8.4], [13, 7.6], 0.6, '#c8372e'); line(x, [7, 3.4], [7.2, 9.4], 0.6, '#c8372e'); bow(x, 7, 6.4, 0.5, '#e8453a');
});
def('light_spool', 14, 14, (x, r) => {
  paint(x, pEllipse(7, 11.8, 6, 1.8, { amp: 0.08 }), { fill: '#8a5e38', w: 0.6 }); box(x, 5.4, 3, 3.2, 8.6, '#a9774a', { w: 0.5 });
  paint(x, pEllipse(7, 11.4, 6.2, 1.8, { amp: 0.08 }), { fill: '#a9774a', w: 0.6 }); paint(x, pEllipse(7, 2.8, 6.2, 1.8, { amp: 0.08 }), { fill: '#b98a58', w: 0.6 });
  for (let i = 0; i < 4; i++) { strokePath(x, [[2, 5 + i * 1.6], [7, 6.2 + i * 1.6], [12, 5 + i * 1.6]], { w: 0.5, color: '#3a5a3a', seed: i }); }
  for (let i = 0; i < 6; i++) blob(x, 2.4 + r() * 9.2, 5 + r() * 5.6, 0.7, balloonCols[i % 6], { w: 0.2, shine: false });
});
// 阁楼窗（贴在 wall_f/house_f 屋顶老虎窗位置的独立小窗）：关 / 开（窗扇推开，窗里是暖光）
const attic = (open: boolean) => (x: Ctx) => {
  paint(x, [[1.6, 19], [1.6, 8], [4, 3.6], [8, 1.8], [12, 3.6], [14.4, 8], [14.4, 19]], { fill: '#efe3c8', fill2: '#bfae8a', w: 0.9, hi: 0.6, amp: 0.15, step: 2.4 } as any);
  paint(x, [[3.6, 18], [3.6, 8.6], [5, 5.6], [8, 4.2], [11, 5.6], [12.4, 8.6], [12.4, 18]], { fill: open ? '#ffd88a' : '#7a96b0', fill2: open ? '#e8903a' : '#3a5068', w: 0.7, hi: 0.2, mottle: 0.15 } as any);
  if (open) { glow(x, 8, 12, 8, '#ffb24a', 0.45); poly(x, [[3.6, 8.2], [0.4, 6.8], [0.4, 17.4], [3.6, 18]], '#4a7a5a', { w: 0.6, hi: 0.5 }); poly(x, [[12.4, 8.2], [15.6, 6.8], [15.6, 17.4], [12.4, 18]], '#4a7a5a', { w: 0.6 }); box(x, 4, 10, 8, 8, '#ffe8b0', { w: 0.3, mottle: 0.1 }); }
  else { line(x, [8, 4.2], [8, 18], 0.5, '#efe3c8'); line(x, [3.6, 11.4], [12.4, 11.4], 0.5, '#efe3c8'); dab(x, 5.4, 7, 1.2, '#fff', 0.5); snowCap(x, 1.4, 14.6, 3.8, 1.2, 4); }
  box(x, 0.8, 19, 14.4, 1.6, '#a98e6a', { w: 0.5 });
};
def('attic_window', 16, 22, attic(false)); def('attic_window_open', 16, 22, attic(true));
void balloonArch;
// 别名：product 要求的键名
T['window_apron'] = T['window_apron_0']; T['window_apron_lit'] = T['window_apron_1'];
T['shutter'] = T['shutter_0']; T['frame_spot'] = T['frame_spot_0']; T['shutter_open'] = T['shutter_1']; T['frame_painted'] = T['frame_spot_1'];

export function buildPropTextures(): Record<string, HTMLCanvasElement> { return T; }
export const PROP_KEYS = Object.keys(T);
void hash2; void mix; void pPoly; void lin;
