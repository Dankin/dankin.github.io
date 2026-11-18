/**
 * 手绘地面（契约 3.2）：按 10×10 瓦片切块，逐块生成。
 * 世界坐标单位 = 1/16 瓦片（“地面单位 gu”）。一个 gu 在屏幕上沿 tx 方向约 1 源像素，
 * 所以 brush 里“源像素”量级的参数在地面上通用，而且铺在地面平面里的东西自带等距透视（圆→扁椭圆）。
 *
 * 瓦片字母（config.json regions[].map）：
 *  p 石板广场  c 红砖  g 草地  r 柏油路  i 冰雪面  w 水面  d 木栈桥
 *  l 落叶人行道  s 石阶  f 花坛  m 人造雪  b 桥面石  k 泥土路        （未知字母按 p 处理）
 */
import { rng, hash2, fbm, vnoise, shade, mix, rgba, PAL, newCanvas, ctxOf, applyPaper, pBlob, pEllipse, paint, strokePath, speckles, type Pt, type Ctx } from '../brush';
import { SS } from '../scale';
import { MAP, WORLD_W, WORLD_H } from '../../core/data';
import { OX, OY } from '../../core/iso';

export const CHUNK = 10;
const U = 16; // 一个瓦片 = 16 gu
const M = 3; // 块外扩边（源像素），用于相邻块无缝衔接

export interface GroundChunk { key: string; cx: number; cy: number; x: number; y: number; w: number; h: number; snow: boolean; build: () => HTMLCanvasElement }

// ───────── 世界查询 ─────────
export function tileAt(i: number, j: number): string {
  const ci = Math.max(0, Math.min(WORLD_W - 1, i)), cj = Math.max(0, Math.min(WORLD_H - 1, j));
  const ch = MAP[cj]?.[ci] ?? 'p';
  return 'pcgriwdlsfmbk'.includes(ch) ? ch : 'p';
}
const tr = (i: number, j: number, salt = 0) => rng(Math.floor(hash2(i, j, salt, 77) * 1e6) + 1);
const isWater = (t: string) => t === 'w';
const isSnowy = (t: string) => t === 'i' || t === 'm';
const isGrass = (t: string) => t === 'g';

// ───────── 当前块的投影状态 ─────────
let AX = 0, AY = 0;
function setBase(x: Ctx) { x.setTransform(SS, SS / 2, -SS, SS / 2, AX * SS, AY * SS); }
/** 在平面点 (u,v) 处切到屏幕空间（原点在该点，单位=源像素），画竖直的东西（草叶、闪光）。 */
function screen(x: Ctx, u: number, v: number, fn: () => void) {
  x.save(); x.setTransform(SS, 0, 0, SS, ((u - v) + AX) * SS, ((u + v) * 0.5 + AY) * SS); fn(); x.restore();
}
function rectPath(x: Ctx, u: number, v: number, w: number, h: number) { x.beginPath(); x.rect(u, v, w, h); }
function polyQ(a: Pt, b: Pt, c: Pt, d: Pt): Pt[] { return [a, b, c, d]; }

// ───────── 基础色 ─────────
const BASE: Record<string, string> = {
  p: '#cdbea8', c: '#b3694f', g: '#7f9c5b', r: '#6f6b79', i: '#e4ecf5', w: '#5c8dad', d: '#a47a4d',
  l: '#c8b79e', s: '#cfc2ae', f: '#6e8650', m: '#eef2f8', b: '#b9b0a6', k: '#b8946a', o: '#c9c8c8', a: '#cdbfae',
};

// ───────── 各类型地面细节 ─────────
function fillTile(x: Ctx, i: number, j: number, col: string) {
  x.fillStyle = col; rectPath(x, i * U - 0.4, j * U - 0.4, U + 0.8, U + 0.8); x.fill();
}

/** 世界对齐的石板：行高 rh，板宽 sw±，随机缝。用于 p / l / b。 */
function flagstones(x: Ctx, i: number, j: number, base: string, o: { rh: number; sw: number; joint: string; var: number; seed: number }) {
  const u0 = i * U, v0 = j * U;
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  fillTile(x, i, j, o.joint);
  const r0 = Math.floor(v0 / o.rh), r1 = Math.ceil((v0 + U) / o.rh);
  for (let r = r0; r < r1; r++) {
    const off = hash2(r, o.seed, 5) * o.sw;
    const ya = r * o.rh, yb = ya + o.rh;
    // 沿 u 方向的石板边界 b_k = off + k*sw + jitter
    const k0 = Math.floor((u0 - off) / o.sw) - 1, k1 = Math.ceil((u0 + U - off) / o.sw) + 1;
    for (let k = k0; k < k1; k++) {
      const jit = (kk: number) => (hash2(kk, r, o.seed, 9) - 0.5) * o.sw * 0.35;
      const xa = off + k * o.sw + jit(k), xb = off + (k + 1) * o.sw + jit(k + 1);
      if (xb < u0 - 1 || xa > u0 + U + 1) continue;
      const id = hash2(k, r, o.seed, 3);
      const col = shade(base, (id - 0.5) * o.var + (hash2(k, r, o.seed, 4) > 0.8 ? -0.06 : 0));
      const g = 0.5; // 缝宽的一半
      const pts: Pt[] = [[xa + g, ya + g], [xb - g, ya + g + (hash2(k, r, 11) - 0.5) * 0.5], [xb - g, yb - g], [xa + g, yb - g + (hash2(k, r, 12) - 0.5) * 0.5]];
      // 圆角石板：chaikin 一次
      const rr: Pt[] = []; for (let q = 0; q < 4; q++) { const a = pts[q], b = pts[(q + 1) % 4]; rr.push([a[0] * 0.8 + b[0] * 0.2, a[1] * 0.8 + b[1] * 0.2], [a[0] * 0.2 + b[0] * 0.8, a[1] * 0.2 + b[1] * 0.8]); }
      x.fillStyle = col; x.beginPath(); rr.forEach((p, q) => (q ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); x.fill();
      // 上/左亮边、下/右暗边（光自左上=平面 -u,-v）
      x.lineWidth = 0.55;
      x.strokeStyle = rgba(shade(col, 0.45), 0.55); x.beginPath(); x.moveTo(xa + g + 0.3, yb - g - 0.4); x.lineTo(xa + g + 0.3, ya + g + 0.3); x.lineTo(xb - g - 0.5, ya + g + 0.3); x.stroke();
      x.strokeStyle = rgba(shade(col, -0.4), 0.45); x.beginPath(); x.moveTo(xb - g - 0.3, ya + g + 0.6); x.lineTo(xb - g - 0.3, yb - g - 0.3); x.lineTo(xa + g + 0.6, yb - g - 0.3); x.stroke();
      // 石面斑点/污渍
      if (id > 0.62) { const R = tr(k, r, o.seed); x.globalAlpha = 0.16; x.fillStyle = R() > 0.5 ? shade(col, 0.3) : shade(col, -0.3); x.beginPath(); x.ellipse(xa + R() * (xb - xa), ya + R() * o.rh, 1.2 + R() * 1.6, 0.8 + R(), R() * 3, 0, 6.3); x.fill(); x.globalAlpha = 1; }
      if (id < 0.07) { x.strokeStyle = rgba(PAL.ink, 0.28); x.lineWidth = 0.35; x.beginPath(); const cx0 = xa + (xb - xa) * 0.3, cy0 = ya + 1; x.moveTo(cx0, cy0); x.lineTo(cx0 + 1.2, cy0 + 1.4); x.lineTo(cx0 + 0.6, cy0 + 2.8); x.stroke(); }
    }
  }
  x.restore();
}

function brickPaving(x: Ctx, i: number, j: number) {
  const u0 = i * U, v0 = j * U, bw = 5, bh = 2.6;
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  fillTile(x, i, j, '#d4bb9a'); // 灰泥缝
  const r0 = Math.floor(v0 / bh), r1 = Math.ceil((v0 + U) / bh);
  for (let r = r0; r < r1; r++) {
    const off = (r % 2) * bw * 0.5 + hash2(r, 5) * 0.4; const ya = r * bh;
    const k0 = Math.floor((u0 - off) / bw) - 1, k1 = Math.ceil((u0 + U - off) / bw) + 1;
    for (let k = k0; k < k1; k++) {
      const xa = off + k * bw, id = hash2(k, r, 31);
      const col = shade(BASE.c, (id - 0.5) * 0.2 + (hash2(Math.floor(k / 3), Math.floor(r / 3), 8) - 0.5) * 0.1);
      x.fillStyle = col; x.fillRect(xa + 0.3, ya + 0.3, bw - 0.6, bh - 0.55);
      x.fillStyle = rgba(shade(col, 0.5), 0.35); x.fillRect(xa + 0.3, ya + 0.3, bw - 0.6, 0.45);
      x.fillStyle = rgba(shade(col, -0.45), 0.35); x.fillRect(xa + 0.3, ya + bh - 0.6, bw - 0.6, 0.3);
      if (id > 0.86) { x.fillStyle = rgba('#3a2418', 0.18); x.fillRect(xa + 0.8, ya + 0.8, 1.4, 0.9); }
    }
  }
  x.restore();
}

function grassTile(x: Ctx, i: number, j: number, snowCover = false) {
  const u0 = i * U, v0 = j * U, R = tr(i, j, 1);
  fillTile(x, i, j, shade(BASE.g, (fbm(u0 * 0.02, v0 * 0.02, 4) - 0.5) * 0.28 + (hash2(i, j, 2) - 0.5) * 0.05));
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  // 深浅色斑块
  for (let k = 0; k < 5; k++) {
    const cx = u0 + R() * U, cy = v0 + R() * U, rr = 2.5 + R() * 4;
    x.globalAlpha = 0.18 + R() * 0.12; x.fillStyle = R() > 0.45 ? '#648a47' : '#9cb86a';
    x.beginPath(); x.ellipse(cx, cy, rr, rr * (0.6 + R() * 0.4), R() * 3, 0, 6.3); x.fill();
  }
  x.globalAlpha = 1; x.restore();
  // 草叶（屏幕空间）
  for (let k = 0; k < 8; k++) {
    const pu = u0 + R() * U, pv = v0 + R() * U;
    const cols = ['#4f7a40', '#8db465', '#6b9a4b', '#aac879'];
    screen(x, pu, pv, () => {
      for (let b = -1; b <= 1; b++) {
        x.strokeStyle = cols[Math.floor(R() * cols.length)]; x.lineWidth = 0.55; x.beginPath();
        const h = 1.8 + R() * 2.4, lean = (b + (R() - 0.5)) * 1.1;
        x.moveTo(b * 0.8, 0); x.quadraticCurveTo(b * 0.8 + lean * 0.3, -h * 0.6, b * 0.8 + lean, -h); x.stroke();
      }
    });
  }
  // 零星小花
  if (R() < 0.11) { const pu = u0 + 3 + R() * 10, pv = v0 + 3 + R() * 10, c = R.pick(['#f5efe0', '#f2c453', '#e8788c', '#c7a5e8']); screen(x, pu, pv, () => { x.fillStyle = c; x.beginPath(); x.arc(0, -1, 0.7, 0, 6.3); x.fill(); x.fillStyle = '#e0a020'; x.fillRect(-0.15, -1.15, 0.3, 0.3); }); }
  void snowCover;
}

function asphalt(x: Ctx, i: number, j: number) {
  const u0 = i * U, v0 = j * U, R = tr(i, j, 3);
  fillTile(x, i, j, shade(BASE.r, (fbm(u0 * 0.03, v0 * 0.03, 8) - 0.5) * 0.2));
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  for (let k = 0; k < 4; k++) { x.globalAlpha = 0.14; x.fillStyle = R() > 0.5 ? '#8b86a0' : '#524e5e'; x.beginPath(); x.ellipse(u0 + R() * U, v0 + R() * U, 2 + R() * 5, 1.5 + R() * 3, R() * 3, 0, 6.3); x.fill(); }
  x.globalAlpha = 1;
  speckles(x, [u0, v0, U, U], 26, ['#9c97ab', '#4a4656', '#b0a79a'], [0.2, 0.5], 0.5, i * 131 + j * 7);
  if (R() < 0.35) { x.strokeStyle = rgba('#2c2833', 0.45); x.lineWidth = 0.4; x.beginPath(); let cx = u0 + R() * U, cy = v0 + R() * U; x.moveTo(cx, cy); for (let s = 0; s < 4; s++) { cx += (R() - 0.3) * 3; cy += (R() - 0.5) * 3; x.lineTo(cx, cy); } x.stroke(); }
  x.restore();
}

function iceTile(x: Ctx, i: number, j: number, powder = false) {
  const u0 = i * U, v0 = j * U, R = tr(i, j, 5);
  const base = powder ? BASE.m : BASE.i;
  fillTile(x, i, j, shade(base, (fbm(u0 * 0.03, v0 * 0.03, 12) - 0.5) * 0.1));
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  // 淡蓝紫阴影斑 + 粉调亮斑
  for (let k = 0; k < 5; k++) { x.globalAlpha = 0.16 + R() * 0.1; x.fillStyle = R() > 0.5 ? '#b9c0e0' : '#fbe9ea'; x.beginPath(); x.ellipse(u0 + R() * U, v0 + R() * U, 2 + R() * 5, 1.5 + R() * 3.5, R() * 3, 0, 6.3); x.fill(); }
  x.globalAlpha = 1;
  if (!powder) {
    // 冰面反光长条（沿 u 方向的斜亮纹）
    for (let k = 0; k < 2; k++) { const sx = u0 + R() * U, sy = v0 + R() * U; x.strokeStyle = rgba('#ffffff', 0.55); x.lineWidth = 0.5 + R() * 0.4; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + 3 + R() * 4, sy + (R() - 0.5) * 1.4); x.stroke(); }
    if (R() < 0.3) { x.strokeStyle = rgba('#8aa6c8', 0.5); x.lineWidth = 0.35; x.beginPath(); let cx = u0 + R() * U, cy = v0 + R() * U; x.moveTo(cx, cy); for (let s = 0; s < 3; s++) { cx += (R() - 0.2) * 3; cy += (R() - 0.5) * 3; x.lineTo(cx, cy); } x.stroke(); }
  } else {
    // 雪堆耙痕（沿 v 方向）
    for (let k = 0; k < 3; k++) { const uu = u0 + 2 + k * 5 + R() * 2; x.strokeStyle = rgba('#aab4d8', 0.35); x.lineWidth = 0.45; x.beginPath(); x.moveTo(uu, v0 + R() * 3); x.lineTo(uu + (R() - 0.5), v0 + U - R() * 3); x.stroke(); }
  }
  x.restore();
}

function waterTile(x: Ctx, i: number, j: number) {
  const u0 = i * U, v0 = j * U;
  fillTile(x, i, j, shade(BASE.w, (fbm(u0 * 0.025, v0 * 0.025, 20) - 0.5) * 0.3));
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  // 深浅水纹（世界对齐的波浪线）
  for (let rv = Math.floor(v0 / 3.2); rv < Math.ceil((v0 + U) / 3.2) + 1; rv++) {
    const phase = hash2(rv, 91) * 6.3, amp = 0.5 + hash2(rv, 92) * 0.5, y0 = rv * 3.2;
    const seg0 = Math.floor(u0 / 8) - 1;
    for (let sgi = seg0; sgi < seg0 + 4; sgi++) {
      const h = hash2(sgi, rv, 93); if (h < 0.4) continue;
      const ua = sgi * 8 + h * 3, ub = ua + 3 + hash2(sgi, rv, 94) * 4;
      x.strokeStyle = h > 0.8 ? rgba('#ffe3b0', 0.4) : rgba('#a9d0e0', 0.42); x.lineWidth = 0.45 + h * 0.3; x.beginPath();
      for (let u = ua; u <= ub; u += 1) { const vv = y0 + Math.sin(u * 0.55 + phase) * amp; u === ua ? x.moveTo(u, vv) : x.lineTo(u, vv); }
      x.stroke();
    }
    if (hash2(rv, 95) > 0.5) { x.strokeStyle = rgba('#34506c', 0.2); x.lineWidth = 0.6; x.beginPath(); const ua = Math.floor(u0 / 10) * 10 + hash2(rv, 96) * 6; x.moveTo(ua, y0 + 1.2); x.lineTo(ua + 5, y0 + 1.4); x.stroke(); }
  }
  x.restore();
}

function woodPlanks(x: Ctx, i: number, j: number) {
  const u0 = i * U, v0 = j * U, pw = 4;
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  fillTile(x, i, j, '#4a3022');
  for (let p = Math.floor(v0 / pw); p < Math.ceil((v0 + U) / pw); p++) {
    const ya = p * pw, off = hash2(p, 41) * 30, len = 26 + hash2(p, 42) * 12;
    const k0 = Math.floor((u0 - off) / len) - 1;
    for (let k = k0; k < k0 + 4; k++) {
      const xa = off + k * len, xb = xa + len; if (xb < u0 || xa > u0 + U) continue;
      const id = hash2(k, p, 43);
      const col = shade(BASE.d, (id - 0.5) * 0.22);
      x.fillStyle = col; x.fillRect(xa + 0.25, ya + 0.35, len - 0.5, pw - 0.7);
      x.fillStyle = rgba(shade(col, 0.5), 0.4); x.fillRect(xa + 0.25, ya + 0.35, len - 0.5, 0.5);
      x.fillStyle = rgba(shade(col, -0.45), 0.35); x.fillRect(xa + 0.25, ya + pw - 0.8, len - 0.5, 0.45);
      // 木纹
      x.strokeStyle = rgba(shade(col, -0.4), 0.38); x.lineWidth = 0.28;
      for (let g = 0; g < 2; g++) { const gy = ya + 1.1 + g * 1.3 + hash2(k, p, g) * 0.4; x.beginPath(); x.moveTo(Math.max(xa + 1, u0 - 1), gy); x.bezierCurveTo(xa + len * 0.3, gy + 0.4, xa + len * 0.6, gy - 0.4, Math.min(xb - 1, u0 + U + 1), gy + 0.1); x.stroke(); }
      // 钉头
      x.fillStyle = rgba('#2d1c12', 0.7); [xa + 1, xb - 1].forEach((nx) => { if (nx > u0 - 1 && nx < u0 + U + 1) { x.beginPath(); x.arc(nx, ya + 1, 0.3, 0, 6.3); x.arc(nx, ya + pw - 1, 0.3, 0, 6.3); x.fill(); } });
    }
  }
  x.restore();
}

function leafLitter(x: Ctx, i: number, j: number, dens: number) {
  const u0 = i * U, v0 = j * U, R = tr(i, j, 8), n = Math.round(dens * (2 + fbm(u0 * 0.05, v0 * 0.05, 3) * 7));
  for (let k = 0; k < n; k++) {
    const pu = u0 + R() * U, pv = v0 + R() * U, col = R.pick([PAL.leafGold, PAL.leafRust, '#a6812e', '#8c5a2e', PAL.olive]), a = R() * 6.3, s = 0.9 + R() * 0.9;
    x.save(); x.translate(pu, pv); x.rotate(a); x.fillStyle = col; x.beginPath(); x.ellipse(0, 0, s * 1.5, s * 0.8, 0, 0, 6.3); x.fill();
    x.strokeStyle = rgba('#5a3a1c', 0.5); x.lineWidth = 0.22; x.beginPath(); x.moveTo(-s * 1.4, 0); x.lineTo(s * 1.4, 0); x.stroke(); x.restore();
  }
}

function stairs(x: Ctx, i: number, j: number) {
  const u0 = i * U, v0 = j * U, steps = 4, sw = U / steps;
  x.save(); rectPath(x, u0, v0, U, U); x.clip(); fillTile(x, i, j, '#a89a88');
  for (let s = 0; s < steps; s++) {
    const ua = u0 + s * sw, tone = 0.12 - s * 0.05;
    x.fillStyle = shade('#d4c7b2', tone); x.fillRect(ua + 0.2, v0, sw - 0.2, U);
    x.fillStyle = rgba(shade('#fff4d6', 0.5), 0.55); x.fillRect(ua + 0.2, v0, 0.9, U); // 踏面前缘亮
    const g = x.createLinearGradient(ua, 0, ua + sw, 0); g.addColorStop(0, rgba('#3b2c55', 0)); g.addColorStop(1, rgba('#3b2c55', 0.32));
    x.fillStyle = g; x.fillRect(ua + sw - 1.8, v0, 1.8, U); // 立面阴影
    x.strokeStyle = rgba(PAL.ink, 0.5); x.lineWidth = 0.45; x.beginPath(); x.moveTo(ua + sw, v0); x.lineTo(ua + sw, v0 + U); x.stroke();
  }
  x.restore();
}

function flowerBed(x: Ctx, i: number, j: number) {
  const u0 = i * U, v0 = j * U, R = tr(i, j, 12);
  fillTile(x, i, j, '#6a4a34');
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  speckles(x, [u0, v0, U, U], 30, ['#4a3224', '#8a6a4c'], [0.25, 0.55], 0.6, i * 17 + j);
  for (let k = 0; k < 4; k++) paint(x, pBlob(u0 + 2 + R() * 12, v0 + 2 + R() * 12, 2.6 + R() * 1.6, 2 + R(), { seed: i * 31 + j * 7 + k }), { fill: R.pick(['#3d7a52', '#5a8f4a', '#2f6244']), stroke: PAL.greenDark, w: 0.35, mottle: 0.2, grain: 0, edge: 0.15, hi: 0.4, rim: 0.4 });
  for (let k = 0; k < 6; k++) { const pu = u0 + R() * U, pv = v0 + R() * U, c = R.pick([PAL.red, PAL.pink, '#f5efe0', PAL.gold, '#b891e8']); screen(x, pu, pv, () => { x.fillStyle = c; x.beginPath(); x.arc(0, -1.3, 0.85, 0, 6.3); x.fill(); x.fillStyle = rgba('#fff', 0.7); x.fillRect(-0.4, -1.8, 0.4, 0.4); }); }
  x.restore();
}

function dirtPath(x: Ctx, i: number, j: number) {
  const u0 = i * U, v0 = j * U, R = tr(i, j, 14);
  fillTile(x, i, j, shade(BASE.k, (fbm(u0 * 0.03, v0 * 0.03, 15) - 0.5) * 0.25));
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  for (let k = 0; k < 4; k++) { x.globalAlpha = 0.18; x.fillStyle = R() > 0.5 ? '#8a6c46' : '#d0b085'; x.beginPath(); x.ellipse(u0 + R() * U, v0 + R() * U, 2 + R() * 4, 1.5 + R() * 2.5, R() * 3, 0, 6.3); x.fill(); }
  x.globalAlpha = 1;
  for (let k = 0; k < 7; k++) { const pu = u0 + R() * U, pv = v0 + R() * U, s = 0.4 + R() * 0.7; x.fillStyle = R.pick(['#8a7a68', '#c4b49c', '#6e5f50']); x.beginPath(); x.ellipse(pu, pv, s * 1.2, s, R() * 3, 0, 6.3); x.fill(); }
  x.strokeStyle = rgba('#6b4f32', 0.3); x.lineWidth = 0.7; x.beginPath(); x.moveTo(u0, v0 + 5); x.lineTo(u0 + U, v0 + 5.5); x.moveTo(u0, v0 + 11); x.lineTo(u0 + U, v0 + 10.6); x.stroke();
  x.restore();
}

/** o 无障碍斜坡：浅灰水泥 + 横向防滑纹 + 两侧扶手槽线 */
function rampTile(x: Ctx, i: number, j: number) {
  const u0 = i * U, v0 = j * U, R = tr(i, j, 31);
  fillTile(x, i, j, BASE.o);
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  const g = x.createLinearGradient(u0, v0, u0 + U, v0 + U); g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(110,110,130,0.2)'); x.fillStyle = g; x.fillRect(u0, v0, U, U);
  for (let k = 0; k < 6; k++) { const v = v0 + 1.2 + k * 2.6; x.strokeStyle = rgba('#7b7a80', 0.55); x.lineWidth = 0.55; x.beginPath(); x.moveTo(u0 + 0.6, v + R.range(-0.15, 0.15)); x.lineTo(u0 + U - 0.6, v + R.range(-0.15, 0.15)); x.stroke(); x.strokeStyle = rgba('#ffffff', 0.5); x.lineWidth = 0.35; x.beginPath(); x.moveTo(u0 + 0.6, v + 0.7); x.lineTo(u0 + U - 0.6, v + 0.7); x.stroke(); }
  x.strokeStyle = rgba('#6b6a72', 0.7); x.lineWidth = 0.7; x.beginPath(); x.moveTo(u0 + 0.3, v0); x.lineTo(u0 + 0.3, v0 + U); x.moveTo(u0 + U - 0.3, v0); x.lineTo(u0 + U - 0.3, v0 + U); x.stroke();
  for (let k = 0; k < 6; k++) { x.fillStyle = rgba('#8a8890', 0.35); x.beginPath(); x.arc(u0 + R() * U, v0 + R() * U, 0.3 + R() * 0.4, 0, 6.3); x.fill(); }
  x.restore();
}
/** a 公交站台：暖灰混凝土 + 黄色盲道点砖（圆点阵）+ 边缘黄线 */
function platformTile(x: Ctx, i: number, j: number) {
  const u0 = i * U, v0 = j * U, R = tr(i, j, 41);
  flagstones(x, i, j, BASE.a, { rh: 16, sw: 16, joint: '#9a8c7c', var: 0.06, seed: 9 });
  x.save(); rectPath(x, u0, v0, U, U); x.clip();
  x.fillStyle = rgba('#e8b93a', 0.88); x.fillRect(u0 + 3, v0, 10, U);
  x.strokeStyle = rgba('#8a6a1a', 0.55); x.lineWidth = 0.5; x.strokeRect(u0 + 3, v0 - 1, 10, U + 2);
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const cu = u0 + 4.6 + a * 2.5, cv = v0 + 2 + b * 3.6; x.fillStyle = rgba('#fff0a8', 0.9); x.beginPath(); x.arc(cu - 0.1, cv - 0.1, 0.85, 0, 6.3); x.fill(); x.fillStyle = rgba('#a87a14', 0.55); x.beginPath(); x.arc(cu + 0.45, cv + 0.45, 0.7, 0, 6.3); x.fill(); x.fillStyle = rgba('#f4d054', 0.95); x.beginPath(); x.arc(cu, cv, 0.65, 0, 6.3); x.fill(); }
  for (let k = 0; k < 5; k++) { x.fillStyle = rgba('#6e6454', 0.3); x.beginPath(); x.arc(u0 + R() * U, v0 + R() * U, 0.3 + R() * 0.5, 0, 6.3); x.fill(); }
  x.restore();
}

function drawTileBase(x: Ctx, i: number, j: number, t: string) {
  switch (t) {
    case 'p': flagstones(x, i, j, BASE.p, { rh: 8, sw: 9, joint: '#8d7c6a', var: 0.1, seed: 1 }); break;
    case 'c': brickPaving(x, i, j); break;
    case 'g': grassTile(x, i, j); break;
    case 'r': asphalt(x, i, j); break;
    case 'i': iceTile(x, i, j); break;
    case 'm': iceTile(x, i, j, true); break;
    case 'w': waterTile(x, i, j); break;
    case 'd': woodPlanks(x, i, j); break;
    case 'l': flagstones(x, i, j, BASE.l, { rh: 8, sw: 9, joint: '#8d7c6a', var: 0.1, seed: 2 }); leafLitter(x, i, j, 1); break;
    case 's': stairs(x, i, j); break;
    case 'f': flowerBed(x, i, j); break;
    case 'b': flagstones(x, i, j, BASE.b, { rh: 8, sw: 16, joint: '#6c6359', var: 0.08, seed: 3 }); break;
    case 'k': dirtPath(x, i, j); break;
    case 'o': rampTile(x, i, j); break;
    case 'a': platformTile(x, i, j); break;
    default: flagstones(x, i, j, BASE.p, { rh: 8, sw: 9, joint: '#8d7c6a', var: 0.1, seed: 1 });
  }
}

// ───────── 边缘过渡 ─────────
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** 边上第 t 点（0..16）、向外偏移 d（负=向内）的平面坐标 */
function edgePt(i: number, j: number, dir: number, t: number, d: number): Pt {
  switch (dir) {
    case 0: return [(i + 1) * U + d, j * U + t];
    case 1: return [i * U - d, j * U + t];
    case 2: return [i * U + t, (j + 1) * U + d];
    default: return [i * U + t, j * U - d];
  }
}
function edgeStroke(x: Ctx, i: number, j: number, dir: number, d: number, col: string, w: number, seed: number, vary = 0.5) {
  const pts: Pt[] = []; for (let t = 0; t <= U; t += 2) pts.push(edgePt(i, j, dir, t, d + (hash2(t, seed, i + j) - 0.5) * 0.5));
  strokePath(x, pts, { w, color: col, vary, seed, taper: 0 });
}
function edgeBand(x: Ctx, i: number, j: number, dir: number, d0: number, d1: number, col: string | CanvasGradient, alpha = 1, jag = 0) {
  const a: Pt[] = [], b: Pt[] = [];
  for (let t = -0.4; t <= U + 0.4; t += 2) { a.push(edgePt(i, j, dir, t, d0 + (jag ? (hash2(t * 3, i, j) - 0.5) * jag : 0))); b.push(edgePt(i, j, dir, t, d1 + (jag ? (hash2(t * 3 + 1, i, j) - 0.5) * jag : 0))); }
  x.save(); x.globalAlpha = alpha; x.fillStyle = col; x.beginPath(); a.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); b.reverse().forEach((p) => x.lineTo(p[0], p[1])); x.closePath(); x.fill(); x.restore();
}

function drawEdges(x: Ctx, i: number, j: number, t: string) {
  const R = tr(i, j, 21);
  for (let dir = 0; dir < 4; dir++) {
    const n = tileAt(i + DIRS[dir][0], j + DIRS[dir][1]);
    if (n === t) continue;
    const edgeId = i * 977 + j * 131 + dir * 7;
    // 1. 草地向邻居溢出草丛
    if (isGrass(t) && !isWater(n) && n !== 'f') {
      const N = 6;
      for (let k = 0; k < N; k++) {
        const tt = (k + 0.5) * (U / N) + (R() - 0.5) * 1.6, p = edgePt(i, j, dir, tt, 0.4 + R() * 1.2);
        const rr = 1.5 + R() * 1.9;
        paint(x, pBlob(p[0], p[1], rr * 1.15, rr * 0.9, { seed: edgeId + k }), { fill: R.pick(['#7f9c5b', '#6d8f4c', '#93ae63']), stroke: false, mottle: 0.1, grain: 0, edge: 0.15, hi: 0.5, rim: 0.4 });
        screen(x, p[0], p[1], () => { for (let b = -1; b <= 1; b++) { x.strokeStyle = R.pick(['#4f7a40', '#8db465']); x.lineWidth = 0.5; x.beginPath(); x.moveTo(b * 0.9, 0.3); x.lineTo(b * 0.9 + (R() - 0.5) * 1.6, -1.8 - R() * 1.6); x.stroke(); } });
      }
    }
    // 2. 雪地向邻居溢出雪堆
    if (isSnowy(t) && !isWater(n) && !isSnowy(n)) {
      const N = 5;
      for (let k = 0; k < N; k++) {
        const tt = (k + 0.5) * (U / N) + (R() - 0.5) * 2, p = edgePt(i, j, dir, tt, 0.2 + R() * 1.4), rr = 1.7 + R() * 1.8;
        paint(x, pBlob(p[0], p[1], rr * 1.2, rr, { seed: edgeId + k + 50 }), { fill: PAL.snow, fill2: PAL.snowShade, stroke: false, mottle: 0.1, grain: 0, edge: 0.1, hi: 0.5, rim: 0.7 });
      }
    }
    // 3. 陆地靠水：湿痕 + 驳岸线（水侧加暗影/泡沫）
    if (isWater(n) && !isWater(t)) {
      edgeBand(x, i, j, dir, -3.2, 0, rgba('#3d4a62', 0.28), 1, 1.2);
      edgeBand(x, i, j, dir, -1.2, 0, rgba('#2d3550', 0.25), 1, 0.6);
      if (t === 'd') { edgeStroke(x, i, j, dir, -0.2, PAL.woodDark, 0.9, edgeId); }
      else if (isGrass(t) || isSnowy(t)) { /* 草/雪已溢出，补一条湿线 */ edgeStroke(x, i, j, dir, 0, rgba('#2c3a55', 0.6), 0.5, edgeId, 0.7); }
      else { edgeBand(x, i, j, dir, -1.5, 0, '#8d8174', 0.9, 0.5); edgeStroke(x, i, j, dir, 0, PAL.ink, 0.85, edgeId); edgeStroke(x, i, j, dir, -1.5, rgba('#fff4d6', 0.5), 0.45, edgeId + 2, 0.3); }
    }
    if (isWater(t) && !isWater(n)) {
      edgeBand(x, i, j, dir, 0, -3.5, rgba('#20324c', 0.3), 1, 1);
      // 泡沫
      for (let k = 0; k < 5; k++) { const p = edgePt(i, j, dir, (k + R()) * 3.2, -0.8 - R() * 1.2); x.fillStyle = rgba('#f5fbff', 0.55); x.beginPath(); x.ellipse(p[0], p[1], 1.1 + R() * 1.4, 0.4 + R() * 0.3, 0, 0, 6.3); x.fill(); }
    }
    // 4. 柏油路 vs 路肩：路缘石
    if (t === 'r' && !isWater(n) && n !== 'r') {
      edgeBand(x, i, j, dir, -1.9, 0, '#c7baa6', 1, 0.3); edgeBand(x, i, j, dir, -1.9, -1.3, rgba('#fff4d6', 0.6), 1, 0.2);
      edgeStroke(x, i, j, dir, -1.9, rgba(PAL.ink, 0.65), 0.55, edgeId);
    }
    // 5. 木栈桥靠陆地：边梁
    if (t === 'd' && !isWater(n)) { edgeBand(x, i, j, dir, -1.4, 0, '#5e3d26', 1, 0.2); edgeStroke(x, i, j, dir, -1.4, rgba(PAL.ink, 0.6), 0.5, edgeId); }
    // 6. 台阶侧边
    if (t === 's' && n !== 's') edgeStroke(x, i, j, dir, 0, rgba(PAL.ink, 0.5), 0.6, edgeId);
    // 7. 花坛边石
    if (t === 'f' && n !== 'f') { edgeBand(x, i, j, dir, -1.6, 0.3, '#b9ad9c', 1, 0.2); edgeStroke(x, i, j, dir, -1.6, rgba(PAL.ink, 0.55), 0.5, edgeId); edgeStroke(x, i, j, dir, 0.3, rgba(PAL.ink, 0.7), 0.7, edgeId + 1); }
    // 8. 石/砖 vs 泥土路：泥土边缘 irregular
    if (t === 'k' && (n === 'p' || n === 'c' || n === 'l')) {
      for (let k = 0; k < 4; k++) { const p = edgePt(i, j, dir, (k + 0.5) * 4, 0.3 + R()), rr = 1.2 + R() * 1.4; x.fillStyle = rgba(BASE.k, 0.85); x.beginPath(); x.ellipse(p[0], p[1], rr * 1.2, rr, R() * 3, 0, 6.3); x.fill(); }
    }
  }
}

// ───────── 水洗斑 ─────────
function washes(x: Ctx, u0: number, v0: number, size: number) {
  const CELL = 96;
  const ca = Math.floor((u0 - 40) / CELL), cb = Math.ceil((u0 + size + 40) / CELL), da = Math.floor((v0 - 40) / CELL), db = Math.ceil((v0 + size + 40) / CELL);
  for (let a = ca; a <= cb; a++) for (let b = da; b <= db; b++) {
    for (let k = 0; k < 3; k++) {
      const h = (s: number) => hash2(a, b, k, s);
      const cx = a * CELL + h(1) * CELL, cy = b * CELL + h(2) * CELL, r = 24 + h(3) * 44;
      const warm = h(4) > 0.45, col = warm ? '#ffdca0' : h(5) > 0.5 ? '#6f6aa6' : '#7d9a6c', al = warm ? 0.11 : 0.08;
      x.save(); x.translate(cx, cy); x.scale(1, 0.8 + h(6) * 0.4);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, rgba(col, al)); g.addColorStop(1, rgba(col, 0));
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, 6.3); x.fill(); x.restore();
    }
  }
}

// ───────── 积雪覆盖 ─────────
const SNOW_COVER: Record<string, number> = { p: 0.55, c: 0.5, g: 0.85, r: 0.38, i: 1, w: 0, d: 0.42, l: 0.6, s: 0.45, f: 0.8, m: 1, b: 0.45, k: 0.7, o: 0.4, a: 0.45 };
function snowTile(x: Ctx, i: number, j: number, t: string) {
  const cov = SNOW_COVER[t] ?? 0.5; if (cov <= 0) return;
  const u0 = i * U, v0 = j * U, R = tr(i, j, 33);
  const cells = 4, cs = U / cells;
  x.save(); rectPath(x, u0 - 1, v0 - 1, U + 2, U + 2); x.clip();
  for (let a = -1; a <= cells; a++) for (let b = -1; b <= cells; b++) {
    const wu = u0 + a * cs, wv = v0 + b * cs, f = fbm(wu * 0.05, wv * 0.05, 40) * 0.7 + hash2(Math.floor(wu / cs), Math.floor(wv / cs), 41) * 0.5;
    if (f > 0.35 + (1 - cov) * 0.75) continue;
    const r = cs * (0.62 + R() * 0.5);
    // 阴影底（偏蓝紫）+ 亮面
    x.fillStyle = rgba('#8f90c0', 0.5); x.beginPath(); x.ellipse(wu + cs / 2 + 0.7, wv + cs / 2 + 0.9, r * 1.05, r * 0.9, R() * 3, 0, 6.3); x.fill();
    paint(x, pBlob(wu + cs / 2 + (R() - 0.5), wv + cs / 2 + (R() - 0.5), r, r * 0.9, { seed: i * 53 + j * 29 + a * 7 + b, lump: 0.28 }), { fill: R() > 0.2 ? PAL.snow : '#fdf6f4', fill2: PAL.snowShade, stroke: false, mottle: 0, grain: 0, edge: 0, hi: 0.7, rim: 0.4 });
  }
  // 积雪闪光
  for (let k = 0; k < 2; k++) if (R() > 0.45) { const pu = u0 + R() * U, pv = v0 + R() * U; screen(x, pu, pv, () => { x.fillStyle = rgba('#ffffff', 0.9); x.fillRect(-0.4, -0.4, 0.8, 0.8); x.fillStyle = rgba('#fff', 0.6); x.fillRect(-1.1, -0.15, 2.2, 0.3); x.fillRect(-0.15, -1.1, 0.3, 2.2); }); }
  x.restore();
}

// ───────── 块渲染 ─────────
export const CHUNKS_X = Math.ceil(WORLD_W / CHUNK), CHUNKS_Y = Math.ceil(WORLD_H / CHUNK);
/** 块 (cx,cy) 的世界像素位置（含外扩边）和位图尺寸 */
export function chunkRect(cx: number, cy: number) {
  const tx0 = cx * CHUNK, ty0 = cy * CHUNK;
  const x0 = OX + (tx0 - ty0 - CHUNK) * 32 - M * 2, y0 = OY + (tx0 + ty0) * 16 - M * 2;
  return { x: x0, y: y0, w: CHUNK * 64 + M * 4, h: CHUNK * 32 + M * 4 };
}

/** 渲染一块地面。snow=true 时只产出“积雪覆盖层”（透明背景），叠在 snow=false 之上。 */
export function renderChunk(cx: number, cy: number, snow: boolean): HTMLCanvasElement {
  const tx0 = cx * CHUNK, ty0 = cy * CHUNK, r = chunkRect(cx, cy);
  const c = newCanvas((r.w / 2) * SS, (r.h / 2) * SS), x = ctxOf(c);
  AX = CHUNK * U + M - (tx0 * U - ty0 * U); AY = M - (tx0 * U + ty0 * U) * 0.5;
  setBase(x);
  // 裁剪到本块外扩的菱形
  const e = M, u0 = tx0 * U, v0 = ty0 * U, S = CHUNK * U;
  x.beginPath(); x.rect(u0 - e, v0 - e, S + e * 2, S + e * 2); x.clip();
  const types: string[][] = [];
  for (let j = -1; j <= CHUNK; j++) { const row: string[] = []; for (let i = -1; i <= CHUNK; i++) row.push(tileAt(tx0 + i, ty0 + j)); types.push(row); }
  const T = (i: number, j: number) => types[j + 1][i + 1];
  if (!snow) {
    x.fillStyle = '#a79883'; x.fillRect(u0 - e, v0 - e, S + e * 2, S + e * 2);
    for (let j = -1; j <= CHUNK; j++) for (let i = -1; i <= CHUNK; i++) drawTileBase(x, tx0 + i, ty0 + j, T(i, j));
    washes(x, u0, v0, S);
    for (let j = -1; j <= CHUNK; j++) for (let i = -1; i <= CHUNK; i++) drawEdges(x, tx0 + i, ty0 + j, T(i, j));
    // 世界尽头的“出血”暗角：世界边缘外侧淡淡压暗，避免地图边界突兀（由 Game 的相机边界决定，保持轻微）
  } else {
    for (let j = -1; j <= CHUNK; j++) for (let i = -1; i <= CHUNK; i++) snowTile(x, tx0 + i, ty0 + j, T(i, j));
    // 雪层里水边与岸线保持清爽：在水瓦片上不积雪（SNOW_COVER.w=0）
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  applyPaper(c, snow ? 0.25 : 0.55);
  return c;
}

/** 契约 3.2：返回所有块的描述（key 为 ground_<cx>_<cy> / ground_snow_<cx>_<cy>），build() 惰性生成位图。 */
export function buildGroundChunks(snow: boolean): GroundChunk[] {
  const out: GroundChunk[] = [];
  for (let cy = 0; cy < CHUNKS_Y; cy++) for (let cx = 0; cx < CHUNKS_X; cx++) {
    const r = chunkRect(cx, cy);
    out.push({ key: `${snow ? 'ground_snow' : 'ground'}_${cx}_${cy}`, cx, cy, ...r, snow, build: () => renderChunk(cx, cy, snow) });
  }
  return out;
}
void mix; void vnoise; void pEllipse; void polyQ;
