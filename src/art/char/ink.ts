/**
 * art-char 手绘小工具（角色 / 帽子 / UI / 特效共用）。
 * 约定：所有函数的坐标单位 = “设计单位”（1 单位 = 旧 1 像素 × SS/3 … 即 SS=3 时 1 单位 = 1 位图像素）。
 * 画布创建时会 scale(SS/3)，所以改 SS 不需要改任何绘制代码。
 * 手绘感来源：低频抖动的顶点（wob）、双线描边（受光侧细、背光侧粗）、暖深棕 INK 而非纯黑、
 *             左上暖光高光 + 右下蓝紫阴影、纸纹颗粒（source-atop）。
 */
import { SS } from '../scale';

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

/** 暖深棕描边（与 brush.ts 的 INK 保持一致即可，brush 就绪后可替换） */
export const INK = '#4a2e24';
export const INK_SOFT = '#6b4535';

export function mkc(w: number, h: number): { c: HTMLCanvasElement; x: Ctx } {
  const k = SS / 3;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext('2d')!;
  x.scale(k, k);
  x.lineJoin = 'round'; x.lineCap = 'round';
  return { c, x };
}

// —— 随机 / 颜色 ——
export function rng(seed: number) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function hex2rgb(h: string): [number, number, number] {
  if (h[0] === '#') { const n = parseInt(h.length === 4 ? h.slice(1).replace(/./g, (m) => m + m) : h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = h.match(/[\d.]+/g)!.map(Number); return [m[0], m[1], m[2]];
}
export function mix(a: string, b: string, t: number) {
  const A = hex2rgb(a), B = hex2rgb(b);
  const r = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${r[0]},${r[1]},${r[2]})`;
}
export const WARM_LIGHT = '#fff1c8';
export const COOL_SHADE = '#4a3560';
export const light = (c: string, k = 0.25) => mix(c, WARM_LIGHT, k);
export const dark = (c: string, k = 0.25) => mix(c, COOL_SHADE, k);
export const rgba = (c: string, a: number) => { const [r, g, b] = hex2rgb(c); return `rgba(${r},${g},${b},${a})`; };

// —— 路径 ——
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 12, rot = 0): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, px = Math.cos(a) * rx, py = Math.sin(a) * ry;
    o.push([cx + px * Math.cos(rot) - py * Math.sin(rot), cy + px * Math.sin(rot) + py * Math.cos(rot)]);
  }
  return o;
}
export function wobble(p: Pt[], amp: number, seed: number): Pt[] {
  const r = rng(seed);
  return p.map(([x, y]) => [x + (r() - 0.5) * 2 * amp, y + (r() - 0.5) * 2 * amp] as Pt);
}
/** 闭合/开放 Catmull-Rom → 贝塞尔 */
export function smooth(x: Ctx, p: Pt[], closed = true, t = 0.5) {
  const n = p.length;
  if (n < 3) { x.moveTo(p[0][0], p[0][1]); for (let i = 1; i < n; i++) x.lineTo(p[i][0], p[i][1]); return; }
  const g = (i: number) => (closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  x.moveTo(p[0][0], p[0][1]);
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    x.bezierCurveTo(p1[0] + ((p2[0] - p0[0]) * t) / 3 * 2 * 0.5 * 1, p1[1] + ((p2[1] - p0[1]) * t) / 3 * 2 * 0.5, p2[0] - ((p3[0] - p1[0]) * t) / 3 * 2 * 0.5, p2[1] - ((p3[1] - p1[1]) * t) / 3 * 2 * 0.5, p2[0], p2[1]);
  }
  if (closed) x.closePath();
}
function bbox(p: Pt[]) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of p) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return { x0: a, y0: b, x1: c, y1: d }; }

export interface PaintOpts {
  ink?: string | false; lw?: number;     // 描边色 / 基础线宽
  shade?: number; hi?: number;            // 阴影、高光强度 0..1（默认 0.55 / 0.5）
  wob?: number; seed?: number;            // 顶点抖动
  hiAt?: [number, number];                // 高光位置 (0..1, 左上=0,0)
  closed?: boolean; t?: number;           // 平滑张力
  alpha?: number; flat?: boolean;         // flat：不做明暗
  stripes?: string;                       // 额外的叠色（水彩第二层）
}

/** 画一个手绘色块：底色 + 水彩叠色（明暗 / 高光小块）+ 双线描边 */
export function paint(x: Ctx, pts: Pt[], fill: string, o: PaintOpts = {}) {
  const wob = o.wob ?? 0.35, seed = o.seed ?? 7;
  const p = wob > 0 ? wobble(pts, wob, seed + pts.length * 13) : pts;
  const bb = bbox(p), w = bb.x1 - bb.x0, h = bb.y1 - bb.y0;
  x.save();
  if (o.alpha != null) x.globalAlpha = o.alpha;
  x.beginPath(); smooth(x, p, o.closed !== false, o.t ?? 0.5); x.fillStyle = fill; x.fill();
  if (!o.flat) {
    x.save(); x.clip();
    // 背光侧：蓝紫色阴影，沿右下
    const sh = o.shade ?? 0.55;
    const g = x.createLinearGradient(bb.x0 + w * 0.15, bb.y0, bb.x1, bb.y1);
    g.addColorStop(0, 'rgba(255,240,200,0.16)'); g.addColorStop(0.45, 'rgba(255,240,200,0)');
    g.addColorStop(0.62, rgba(COOL_SHADE, 0)); g.addColorStop(1, rgba(COOL_SHADE, 0.42 * sh));
    x.fillStyle = g; x.fillRect(bb.x0 - 2, bb.y0 - 2, w + 4, h + 4);
    // 色块叠色：底部一条更深的笔触
    x.fillStyle = rgba(dark(fill, 0.45), 0.2 * sh);
    x.beginPath(); x.ellipse(bb.x0 + w * 0.62, bb.y1 + h * 0.05, w * 0.62, h * 0.24, -0.1, 0, Math.PI * 2); x.fill();
    // 左上暖光高光小块
    const hi = o.hi ?? 0.5, at = o.hiAt ?? [0.28, 0.24];
    if (hi > 0 && w > 4 && h > 4) {
      x.fillStyle = `rgba(255,248,222,${0.5 * hi})`;
      x.beginPath(); x.ellipse(bb.x0 + w * at[0], bb.y0 + h * at[1], Math.max(1.1, w * 0.17), Math.max(0.8, h * 0.1), -0.55, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }
  if (o.ink !== false) {
    const lw = o.lw ?? 1.3, col = o.ink || INK;
    x.strokeStyle = col;
    // 背光侧偏移的粗描边在下，受光侧细线在上 —— 线条粗细有变化
    x.save(); x.translate(0.38, 0.45); x.lineWidth = lw * 1.05; x.globalAlpha *= 0.9; x.beginPath(); smooth(x, p, o.closed !== false, o.t ?? 0.5); x.stroke(); x.restore();
    x.lineWidth = lw * 0.8; x.beginPath(); smooth(x, wob > 0 ? wobble(pts, wob * 0.8, seed + 91) : pts, o.closed !== false, o.t ?? 0.5); x.stroke();
  }
  x.restore();
}

/** 椭圆色块 */
export function blob(x: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, o: PaintOpts & { n?: number; rot?: number } = {}) {
  paint(x, ellipsePts(cx, cy, rx, ry, o.n ?? 10, o.rot ?? 0), fill, o);
}

/** 粗圆头折线（四肢 / 管子 / 围巾带）：带描边与明暗条 */
export function limb(x: Ctx, pts: Pt[], w: number, fill: string, o: { ink?: string | false; lw?: number; seed?: number; flat?: boolean; wob?: number } = {}) {
  const wob = o.wob ?? 0.25;
  const p = wob > 0 ? wobble(pts, wob, o.seed ?? 3) : pts;
  const line = (width: number, col: string, dx = 0, dy = 0) => {
    x.save(); x.translate(dx, dy); x.strokeStyle = col; x.lineWidth = width; x.beginPath(); smooth(x, p, false, 0.5); x.stroke(); x.restore();
  };
  if (o.ink !== false) { line(w + (o.lw ?? 1.3) * 2.1, o.ink || INK, 0.25, 0.35); }
  line(w, fill);
  if (!o.flat) {
    line(w * 0.46, rgba(COOL_SHADE, 0.26), w * 0.26, w * 0.2);
    line(w * 0.22, 'rgba(255,248,222,0.42)', -w * 0.27, -w * 0.24);
  }
}

/** 一笔弯曲描线（眉毛 / 嘴 / 折痕） */
export function stroke(x: Ctx, pts: Pt[], col: string, w = 1, o: { open?: boolean; alpha?: number } = {}) {
  x.save(); x.strokeStyle = col; x.lineWidth = w; if (o.alpha != null) x.globalAlpha = o.alpha;
  x.beginPath(); smooth(x, pts, false, 0.5); x.stroke(); x.restore();
}
export function dot(x: Ctx, cx: number, cy: number, r: number, fill: string, ink?: string | false) {
  x.beginPath(); x.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2); x.fillStyle = fill; x.fill();
  if (ink) { x.strokeStyle = ink; x.lineWidth = Math.max(0.5, r * 0.28); x.stroke(); }
}

/** 纸纹颗粒：只落在已有像素上（source-atop），最后一步调用 */
export function grain(x: Ctx, w: number, h: number, seed = 1, amt = 0.1) {
  const r = rng(seed);
  x.save(); x.globalCompositeOperation = 'source-atop';
  const n = Math.floor(w * h * 0.07);
  for (let i = 0; i < n; i++) {
    const px = r() * w, py = r() * h, v = r();
    x.fillStyle = v < 0.5 ? `rgba(90,50,40,${amt * (0.4 + r() * 0.6)})` : `rgba(255,246,220,${amt * (0.5 + r() * 0.7)})`;
    x.fillRect(px, py, 0.9, 0.9);
  }
  // 低频水彩斑
  for (let i = 0; i < 5; i++) {
    x.fillStyle = `rgba(255,235,190,${amt * 0.35})`;
    x.beginPath(); x.ellipse(r() * w, r() * h, 2 + r() * 4, 1.5 + r() * 3, r() * 3, 0, Math.PI * 2); x.fill();
  }
  x.restore();
}
/** 外侧暖色“贴纸”底描边（给小图标用，让小尺寸也看得清） */
export function halo(c: HTMLCanvasElement, col = 'rgba(255,244,214,0.9)', r = 1.6) {
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  const x = o.getContext('2d')!;
  const k = SS / 3, rr = r * k;
  for (let a = 0; a < 16; a++) x.drawImage(c, Math.cos((a / 16) * Math.PI * 2) * rr, Math.sin((a / 16) * Math.PI * 2) * rr);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, o.width, o.height);
  x.globalCompositeOperation = 'source-over'; x.drawImage(c, 0, 0);
  return o;
}
export function paintOnto(c: HTMLCanvasElement, f: (x: Ctx) => void) {
  const x = c.getContext('2d')!; x.save(); x.scale(SS / 3, SS / 3); x.lineJoin = 'round'; x.lineCap = 'round'; f(x); x.restore();
}
