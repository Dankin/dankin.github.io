// 自然类美术公共件:离屏预渲染缓存 bake() + 颜色工具。仅依赖 ../style(只读)。
import { PAL, rng } from '../style';

export type Ctx = CanvasRenderingContext2D;
export { PAL, rng };

/** 预渲染 DPR(≤2) */
export function dpr(): number {
  const d = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  return Math.min(2, Math.max(1, d));
}

/** 预渲染结果:逻辑尺寸 w×h,锚点 (ax,ay) 在逻辑坐标;draw 把锚点对齐到 (x,y)。 */
export interface Baked {
  cv: HTMLCanvasElement;
  w: number; h: number; ax: number; ay: number; dpr: number; key: string;
  meta?: Record<string, number>;
  /** 把锚点放到 (x,y),缩放 s(1=逻辑尺寸) */
  draw(ctx: Ctx, x: number, y: number, s?: number, alpha?: number): void;
}

const cache = new Map<string, Baked>();
const MAX_CACHE = 400;

export interface BakeOpts { ax?: number; ay?: number; dpr?: number; meta?: Record<string, number> }

/**
 * bake(name,w,h,drawFn):按 name+dpr 缓存。drawFn 在逻辑坐标 (0..w,0..h) 绘制。
 * 默认锚点 = 底部中心。
 */
export function bake(name: string, w: number, h: number, drawFn: (ctx: Ctx, w: number, h: number) => void, o: BakeOpts = {}): Baked {
  const d = o.dpr ?? dpr();
  const key = `${name}@${d}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * d));
  cv.height = Math.max(1, Math.ceil(h * d));
  const c = cv.getContext('2d')!;
  c.scale(d, d);
  c.lineJoin = 'round'; c.lineCap = 'round';
  drawFn(c, w, h);
  const ax = o.ax ?? w / 2, ay = o.ay ?? h;
  const b: Baked = {
    cv, w, h, ax, ay, dpr: d, key, meta: o.meta,
    draw(ctx, x, y, s = 1, alpha = 1) {
      if (alpha <= 0) return;
      const pa = ctx.globalAlpha;
      if (alpha < 1) ctx.globalAlpha = pa * alpha;
      ctx.drawImage(cv, x - ax * s, y - ay * s, w * s, h * s);
      if (alpha < 1) ctx.globalAlpha = pa;
    },
  };
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(key, b);
  return b;
}
export function clearBakeCache(prefix = '') {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}
export function bakeStats() { let px = 0; cache.forEach((b) => (px += b.cv.width * b.cv.height)); return { count: cache.size, megaPixels: px / 1e6 }; }

// ---------- 颜色工具 ----------
export function hex2rgb(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgb2hex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function mix(a: string, b: string, t: number): string {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function shade(c: string, k: number): string { const [r, g, b] = hex2rgb(c); return rgb2hex(r * k, g * k, b * k); }
export function rgba(c: string, a: number): string { const [r, g, b] = hex2rgb(c); return `rgba(${r},${g},${b},${a})`; }
export function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
export function hsl2hex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgb2hex(f(0) * 255, f(8) * 255, f(4) * 255);
}
/** 色相偏移 + 饱和度乘 + 明度加 */
export function hueShift(c: string, deg: number, sat = 1, light = 0): string {
  const [r, g, b] = hex2rgb(c); const [h, s, l] = rgb2hsl(r, g, b);
  return hsl2hex(h + deg, s * sat, l + light);
}

// ---------- 绘制小件 ----------
/** 带内部明暗的"云团"路径(圆并集)。返回圆数组,调用方决定怎么描/填。 */
export interface Circle { x: number; y: number; r: number }
export function circlesPath(ctx: Ctx, cs: Circle[], dx = 0, dy = 0, k = 1) {
  ctx.beginPath();
  for (const c of cs) { ctx.moveTo(c.x * k + dx + c.r * k, c.y * k + dy); ctx.arc(c.x * k + dx, c.y * k + dy, c.r * k, 0, Math.PI * 2); }
}
/** 先描粗边再填色 → 只留圆并集的外轮廓线 */
export function outlinedBlob(ctx: Ctx, cs: Circle[], fill: string | CanvasGradient, lw: number, ink: string = PAL.ink) {
  circlesPath(ctx, cs);
  ctx.lineWidth = lw * 2; ctx.strokeStyle = ink; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill();
}
export function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
}
/** 四角星(闪光) */
export function star4(ctx: Ctx, x: number, y: number, r: number, fat = 0.28) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r * fat : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
/** 稳定哈希 → 0..1 序列种子 */
export function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
