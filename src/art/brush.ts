/**
 * brush.ts — 《圣诞帽帽》程序化手绘工具库（art-world 维护；art-char 也使用）
 * ───────────────────────────────────────────────────────────────────────
 * 画风：类《王国保卫战》的卡通手绘。暖深棕抖动描边（粗细变化）、色块叠色 + 渐变阴影、
 *       水彩边缘积色、纸纹噪点、统一左上暖光（高光在左上、冷紫阴影在右下）、统一色板 PAL。
 *
 * 【最小用法】所有绘制代码仍用“旧源像素坐标”，mkTex 自动把画布放大 SS 倍（SS 见 scale.ts）：
 *
 *   import { mkTex, paint, pEllipse, pRect, ink, softShadow, PAL, shade } from './brush';
 *   export const box = mkTex(22, 18, (x, r) => {          // 位图实际 66×54，但这里仍按 22×18 画
 *     softShadow(x, 11, 16, 10, 2.5);                      // 脚下软阴影
 *     paint(x, pRect(2, 6, 18, 10), { fill: PAL.wood });   // 一个有渐变/积色/高光/描边的色块
 *     ink(x, [[2, 9], [20, 9]], { w: 0.8 });               // 抖动描边线（粗细变化）
 *   });
 *
 * 【核心 API】
 *  随机/噪声  rng(seed) → Rng(r(), range, int, pick, chance, gauss) · hash2(a,b,c?,d?)→[0,1) · vnoise/fbm(x,y,seed) · strHash(str)
 *  颜色      PAL(统一色板) · shade(hex,k)(k>0 暖亮，k<0 冷紫暗) · mix(a,b,t) · rgba(hex,a) · hexRgb
 *  路径      pRect/pEllipse/pPoly/pBlob(生成“手绘抖动”点列) · wobblyPath(pts,closed,{amp,step,seed,smooth})
 *            wobblyLine(x0,y0,x1,y1,opt) · wobblyPoly(pts,opt) · wobblyEllipse(cx,cy,rx,ry,opt)
 *  描边      strokePath(x,pts,{w,color,vary,taper,closed,double,alpha}) · ink(x,pts,opt)(开放折线笔触)
 *  填色      paint(x,pts,{fill,fill2,light,hi,edge,mottle,grain,stroke,w,hatch,wob,seed}) ← 最常用：
 *            渐变(亮→暗沿光向)+水彩斑驳+边缘积色+左上高光边+右下冷影边+颗粒+抖动描边，一次完成
 *            gradFill/fillPts/clipPts/speckles/hatch/blob(cx,cy,r,col)/dab(笔点)
 *  光影      softShadow(x,cx,cy,rx,ry,a) · glow(x,cx,cy,r,color,a) · lin/radial 渐变快捷
 *  纹理      mkTex(w,h,draw,{seed,paper}) · applyPaper(canvas,amount) · drawTex(x,tex,dx,dy) · newCanvas(w,h)
 *
 * 【约定】
 *  • 描边色一律 PAL.ink（暖深棕），禁止纯黑；线宽 0.6~1.4 源像素（SS=3 时 2~4 位图像素）。
 *  • 光源在左上：亮面/高光朝 LIGHT 方向，阴影朝右下；阴影色偏蓝紫（shade 负值自动偏紫）。
 *  • 同一形状用同一 seed（默认由首点坐标哈希）→ 填充与描边的抖动一致又略有错位，像手画。
 *  • 需要“相对重复”的东西（砖、瓦、窗）时给每个实例不同 seed，别复制同一抖动。
 *  • draw 回调签名 (x: Ctx, r: Rng, canvas)。画不下的细节宁可省略，别用 1px 噪点冒充。
 */
import { SS } from './scale';

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

// ═════════════════════════ 随机 / 噪声 ═════════════════════════
export interface Rng {
  (): number;
  range(a: number, b: number): number;
  int(a: number, b: number): number; // [a,b]
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
  gauss(): number; // ~N(0,1) 截断
}
export function rng(seed = 1): Rng {
  let s = (seed * 2654435761) >>> 0 || 1;
  const f = (() => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  f.range = (a, b) => a + f() * (b - a);
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  f.gauss = () => Math.max(-3, Math.min(3, (f() + f() + f() + f() - 2) * 1.7));
  return f;
}
export function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 100000 + 1;
}
/** 坐标哈希 → [0,1)。同样输入永远同样输出（地面逐瓦片变化用它）。 */
export function hash2(a: number, b = 0, c = 0, d = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647) + Math.imul(d | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return ((h >>> 0) % 100000) / 100000;
}
const sm = (t: number) => t * t * (3 - 2 * t);
/** 2D 值噪声 [0,1)，平滑。 */
export function vnoise(x: number, y = 0, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = sm(xf), v = sm(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y = 0, seed = 0, oct = 3): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f, seed + i * 17) * a; n += a; a *= 0.5; f *= 2; }
  return s / n;
}

// ═════════════════════════ 颜色 ═════════════════════════
export function hexRgb(h: string): [number, number, number] {
  if (h[0] !== '#') return [128, 128, 128];
  if (h.length === 4) return [parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16)];
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const h2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
export const rgbHex = (r: number, g: number, b: number) => `#${h2(r)}${h2(g)}${h2(b)}`;
export function mix(a: string, b: string, t: number): string {
  const A = hexRgb(a), B = hexRgb(b);
  return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
const WARM_LIGHT = '#fff1c9';
const COOL_SHADOW = '#3d2c63';
/** k∈[-1,1]：>0 朝暖光提亮，<0 变暗并偏蓝紫（暗部带一点蓝紫，雪地带粉调）。 */
export function shade(hex: string, k: number): string {
  if (k >= 0) return mix(hex, WARM_LIGHT, k);
  const [r, g, b] = hexRgb(hex); const m = 1 + k * 0.78;
  return mix(rgbHex(r * m, g * m, b * m), COOL_SHADOW, -k * 0.3);
}

/** 统一色板（暖色冬日黄昏，暗部偏蓝紫，雪带粉调）。 */
export const PAL = {
  ink: '#3a2418', inkSoft: '#5e3d2a', inkCool: '#3b2e4a',
  // 砖/墙/屋顶
  brick: '#a8553f', brickDark: '#7a3a32', brickLight: '#c97a5c', brickOld: '#8d4a3d',
  plaster: '#ecdcc0', plasterShade: '#cdb592', cream: '#f4e8d0', ochre: '#d9a65a', mustard: '#e0a93e',
  slate: '#575a73', slateDark: '#3e3f55', slateLight: '#7b7f9a', roofRed: '#b4503e', tile: '#8c5a48',
  // 木/石/金属
  wood: '#a06f45', woodDark: '#6e4628', woodLight: '#c99663', stone: '#bcae9b', stoneDark: '#8e8175', stoneLight: '#d8cbb8',
  iron: '#4a4a55', ironLight: '#6a6a78', brass: '#d4a444', asphalt: '#716c78', asphaltDark: '#59555f',
  // 植物
  green: '#3d7a52', greenDark: '#26523d', greenLight: '#6fa860', olive: '#7f8f58', oliveLight: '#9aa86a', moss: '#6d7f4c',
  leafGold: '#d9a441', leafRust: '#c27a38',
  // 雪/水/天
  snow: '#f6eeef', snowShade: '#cfd3e8', snowDeep: '#aeb4d6', snowHi: '#ffffff', ice: '#cfe6f2', iceDeep: '#9dc3da',
  water: '#5f8fae', waterDeep: '#456e92', waterLight: '#8cb8cc', sky: '#c4cfe2', skyWarm: '#f1d7b8',
  // 点缀
  red: '#d1403a', redDark: '#8f2a30', redLight: '#ef6a58', gold: '#f2c453', lamp: '#ffe29a', blue: '#4a86b8', teal: '#4f9a86',
  pink: '#e08aa0', purple: '#7a5a9a', orange: '#e8883a',
  // 光
  warmLight: '#ffd68a', warmWhite: '#fff4d6', shadowTint: COOL_SHADOW,
} as const;

/** 统一光向：来自左上（单位向量，指向“光去的方向”的反向，即朝亮面）。 */
export const LIGHT: Pt = [-0.55, -0.83];

// ═════════════════════════ 画布 / mkTex / 纸纹 ═════════════════════════
export function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c;
}
export function ctxOf(c: HTMLCanvasElement): Ctx {
  const x = c.getContext('2d')!; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.lineJoin = 'round'; x.lineCap = 'round'; return x;
}

let _paper: HTMLCanvasElement | null = null;
/** 256×256 可平铺纸纹：细颗粒 + 低频水洗斑 + 零星纤维，中灰为基准（用于 soft-light 叠加）。 */
export function paperTile(): HTMLCanvasElement {
  if (_paper) return _paper;
  const N = 256, c = newCanvas(N, N), x = ctxOf(c);
  const id = x.createImageData(N, N), d = id.data, R = rng(7);
  const P = 16; // 低频格
  const lat = (i: number, j: number) => hash2(((i % P) + P) % P, ((j % P) + P) % P, 99);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const fx = (i / N) * P, fy = (j / N) * P, ix = Math.floor(fx), iy = Math.floor(fy), u = sm(fx - ix), v = sm(fy - iy);
    const lo = lat(ix, iy) * (1 - u) * (1 - v) + lat(ix + 1, iy) * u * (1 - v) + lat(ix, iy + 1) * (1 - u) * v + lat(ix + 1, iy + 1) * u * v;
    const g = 128 + (R() - 0.5) * 56 + (lo - 0.5) * 46;
    const o = (j * N + i) * 4; d[o] = d[o + 1] = d[o + 2] = g; d[o + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  x.globalAlpha = 0.18;
  for (let k = 0; k < 90; k++) { // 纸纤维
    const px = R() * N, py = R() * N, a = R() * 6.28, l = 3 + R() * 7;
    x.strokeStyle = R() > 0.5 ? '#ffffff' : '#000000'; x.lineWidth = 0.6;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  x.globalAlpha = 1;
  return (_paper = c);
}
/**
 * 把纸纹叠到 canvas 已绘制的像素上（只影响不透明处，不污染透明边缘）。
 * amount 0~1（0.4~0.7 常用）；scale>1 颗粒更粗。
 */
export function applyPaper(c: HTMLCanvasElement, amount = 0.5, scale = 1): void {
  if (amount <= 0) return;
  const t = newCanvas(c.width, c.height), tx = t.getContext('2d')!;
  const pat = tx.createPattern(paperTile(), 'repeat')!;
  if (scale !== 1) pat.setTransform(new DOMMatrix().scale(scale));
  tx.fillStyle = pat; tx.fillRect(0, 0, t.width, t.height);
  tx.globalCompositeOperation = 'destination-in'; tx.drawImage(c, 0, 0);
  const x = c.getContext('2d')!;
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'soft-light'; x.globalAlpha = Math.min(1, amount); x.drawImage(t, 0, 0);
  x.restore();
}

export interface TexOpts { seed?: number; paper?: number | false; /** paper 颗粒倍率 */ grain?: number }
/**
 * 创建一张“旧源尺寸 w×h、实际位图 (w·SS)×(h·SS)”的手绘纹理。
 * draw 内继续用旧源像素坐标；r 是以 seed 初始化的随机器。
 */
export function mkTex(w: number, h: number, draw: (x: Ctx, r: Rng, c: HTMLCanvasElement) => void, o: TexOpts = {}): HTMLCanvasElement {
  const c = newCanvas(w * SS, h * SS), x = ctxOf(c);
  x.scale(SS, SS);
  draw(x, rng(o.seed ?? 1), c);
  if (o.paper !== false) applyPaper(c, o.paper ?? 0.45, o.grain ?? 1);
  return c;
}
/** 把另一张 SS 位图纹理按“源像素坐标”画进当前 ctx（ctx 已被 mkTex 缩放时）。 */
export function drawTex(x: Ctx, tex: HTMLCanvasElement, dx: number, dy: number, dw = tex.width / SS, dh = tex.height / SS): void {
  x.drawImage(tex, dx, dy, dw, dh);
}

// ═════════════════════════ 手绘路径 ═════════════════════════
export interface WobOpt { amp?: number; step?: number; seed?: number; freq?: number; smooth?: number }
function autoSeed(pts: Pt[]): number {
  const p = pts[0], q = pts[pts.length - 1];
  return Math.floor(hash2(Math.round(p[0] * 7), Math.round(p[1] * 7), pts.length, Math.round((q[0] + q[1]) * 5)) * 99991) + 1;
}
function chaikin(pts: Pt[], closed: boolean): Pt[] {
  const out: Pt[] = [], n = pts.length;
  const m = closed ? n : n - 1;
  if (!closed) out.push(pts[0]);
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
/** 细分 + 低频抖动（沿法线偏移）。同 seed 同结果。 */
export function wobblyPath(pts: Pt[], closed = true, o: WobOpt = {}): Pt[] {
  const amp = o.amp ?? 0.5, step = o.step ?? 2.6, freq = o.freq ?? 0.22, seed = o.seed ?? autoSeed(pts);
  const out: Pt[] = [], n = pts.length, m = closed ? n : n - 1;
  let s = 0;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1e-6, segs = Math.max(1, Math.round(len / step));
    const nx = -dy / len, ny = dx / len;
    for (let k = 0; k < segs; k++) {
      const t = k / segs;
      let off = (vnoise(s * freq, seed * 0.37, seed) * 2 - 1 + (hash2(Math.round(s * 10), seed) - 0.5) * 0.35) * amp;
      if (k === 0) off *= 0.5;
      out.push([a[0] + dx * t + nx * off, a[1] + dy * t + ny * off]);
      s += len / segs;
    }
  }
  if (!closed) { const l = pts[n - 1]; out.push([l[0] + (hash2(seed, 5) - 0.5) * amp * 0.5, l[1] + (hash2(seed, 6) - 0.5) * amp * 0.5]); }
  let r = out;
  for (let i = 0; i < (o.smooth ?? 0); i++) r = chaikin(r, closed);
  return r;
}
export const wobblyLine = (x0: number, y0: number, x1: number, y1: number, o: WobOpt = {}) => wobblyPath([[x0, y0], [x1, y1]], false, { step: 3, ...o });
export const wobblyPoly = (pts: Pt[], o: WobOpt = {}) => wobblyPath(pts, true, o);
export function wobblyEllipse(cx: number, cy: number, rx: number, ry: number, o: WobOpt & { rot?: number; from?: number; to?: number } = {}): Pt[] {
  const seed = o.seed ?? Math.floor(hash2(Math.round(cx * 5), Math.round(cy * 5), Math.round(rx * 3), Math.round(ry * 3)) * 99991) + 1;
  const amp = o.amp ?? 0.45, freq = o.freq ?? 0.55;
  const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const n = Math.max(14, Math.round(per / (o.step ?? 2.2)));
  const out: Pt[] = [], rot = o.rot ?? 0, cr = Math.cos(rot), sr = Math.sin(rot);
  const a0 = o.from ?? 0, a1 = o.to ?? Math.PI * 2, full = !o.from && !o.to, steps = full ? n : Math.max(3, Math.round(n * (a1 - a0) / (Math.PI * 2)));
  for (let i = 0; i < (full ? n : steps + 1); i++) {
    const a = a0 + (a1 - a0) * (i / (full ? n : steps));
    const k = 1 + ((vnoise(Math.cos(a) * freq * rx * 0.5 + 9, Math.sin(a) * freq * ry * 0.5 + 9, seed) - 0.5) * 2 * amp) / Math.max(rx, ry, 1) * 2.2;
    const ex = Math.cos(a) * rx * k, ey = Math.sin(a) * ry * k;
    out.push([cx + ex * cr - ey * sr, cy + ex * sr + ey * cr]);
  }
  return out;
}
/** 便捷“已抖动点列”生成器（直接传给 paint / strokePath）。 */
export const pRect = (x: number, y: number, w: number, h: number, o: WobOpt = {}): Pt[] => wobblyPath([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, o);
export const pEllipse = (cx: number, cy: number, rx: number, ry = rx, o: WobOpt & { rot?: number } = {}): Pt[] => wobblyEllipse(cx, cy, rx, ry, o);
export const pPoly = (pts: Pt[], o: WobOpt = {}): Pt[] => wobblyPath(pts, true, o);
/** 圆润的团块（树冠/灌木/雪堆）：用随机半径的多边形再 chaikin 平滑。 */
export function pBlob(cx: number, cy: number, rx: number, ry = rx, o: { seed?: number; lump?: number; n?: number } = {}): Pt[] {
  const seed = o.seed ?? Math.floor(hash2(Math.round(cx * 5), Math.round(cy * 5), Math.round(rx * 3), Math.round(ry * 3)) * 99991) + 1;
  const n = o.n ?? Math.max(8, Math.round((rx + ry) * 0.9)), lump = o.lump ?? 0.22, pts: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 1 - lump + hash2(i, seed, 3) * lump * 1.6; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  let r = pts; r = chaikin(r, true); r = chaikin(r, true); return r;
}

// ═════════════════════════ 描边 ═════════════════════════
export interface StrokeOpt { w?: number; color?: string; vary?: number; taper?: number; closed?: boolean; double?: boolean; alpha?: number; seed?: number; jitter?: number }
/**
 * 粗细变化的笔触描边：沿路径生成变宽带（宽度随弧长噪声起伏，开放线两端可收尖 taper 0~1）。
 * 默认线宽 1 源像素，颜色 PAL.ink。closed=true 时形成闭环。
 */
export function strokePath(x: Ctx, pts: Pt[], o: StrokeOpt = {}): void {
  if (pts.length < 2) return;
  const w = o.w ?? 1, vary = o.vary ?? 0.45, closed = o.closed ?? false, taper = o.taper ?? 0;
  const seed = o.seed ?? autoSeed(pts) + 11;
  const pass = (wm: number, dxy: number, seedOff: number, alpha: number) => {
    const n = pts.length; let L = 0; const cum = [0];
    for (let i = 1; i < n; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(L); }
    if (closed) L += Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]);
    const ww: number[] = [];
    for (let i = 0; i < n; i++) {
      let k = 1 + (vnoise(cum[i] * 0.13, seed * 0.1, seed + seedOff) - 0.5) * 2 * vary;
      if (!closed && taper > 0) { const t = L > 0 ? cum[i] / L : 0.5; k *= 1 - taper * (1 - Math.pow(Math.sin(Math.PI * t), 0.55)); }
      ww.push(Math.max(0.12, (w * wm * k) / 2));
    }
    x.save(); x.globalAlpha = (o.alpha ?? 1) * alpha; x.fillStyle = o.color ?? PAL.ink; x.beginPath();
    const J = o.jitter ?? 0, ox = dxy * (hash2(seed, seedOff, 1) - 0.5) * 2, oy = dxy * (hash2(seed, seedOff, 2) - 0.5) * 2;
    const segN = closed ? n : n - 1;
    for (let i = 0; i < segN; i++) {
      const j = (i + 1) % n; const a = pts[i], b = pts[j];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 1e-6) continue;
      const nx = -dy / len, ny = dx / len;
      const ax = a[0] + ox + (J ? (hash2(i, seed, 3) - 0.5) * J : 0), ay = a[1] + oy + (J ? (hash2(i, seed, 4) - 0.5) * J : 0);
      const bx = b[0] + ox + (J ? (hash2(j, seed, 3) - 0.5) * J : 0), by = b[1] + oy + (J ? (hash2(j, seed, 4) - 0.5) * J : 0);
      x.moveTo(ax + nx * ww[i], ay + ny * ww[i]); x.lineTo(bx + nx * ww[j], by + ny * ww[j]);
      x.lineTo(bx - nx * ww[j], by - ny * ww[j]); x.lineTo(ax - nx * ww[i], ay - ny * ww[i]); x.closePath();
    }
    for (let i = 0; i < n; i++) { x.moveTo(pts[i][0] + ox + ww[i], pts[i][1] + oy); x.arc(pts[i][0] + ox, pts[i][1] + oy, ww[i], 0, Math.PI * 2, true); }
    x.fill('nonzero'); x.restore();
  };
  pass(1, 0, 0, 1);
  if (o.double) pass(0.5, 0.35, 5, 0.55); // 第二遍：更细、略错位，像重复勾线
}
/** 开放折线/直线笔触（自动抖动）。pts 为端点或折线顶点。 */
export function ink(x: Ctx, pts: Pt[], o: StrokeOpt & WobOpt = {}): void {
  const wp = o.amp === 0 ? pts : wobblyPath(pts, false, { amp: o.amp ?? 0.35, step: o.step ?? 3, seed: o.seed, freq: o.freq, smooth: o.smooth });
  strokePath(x, wp, { taper: 0.5, ...o, closed: false });
}

// ═════════════════════════ 填色 ═════════════════════════
export function tracePts(x: Ctx, pts: Pt[]): void {
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.closePath();
}
export function clipPts(x: Ctx, pts: Pt[]): void { tracePts(x, pts); x.clip(); }
export function bbox(pts: Pt[]) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
export function lin(x: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => g.addColorStop(t, c)); return g;
}
export function radial(x: Ctx, cx: number, cy: number, r: number, stops: [number, string][], fx = cx, fy = cy): CanvasGradient {
  const g = x.createRadialGradient(fx, fy, 0, cx, cy, r); stops.forEach(([t, c]) => g.addColorStop(t, c)); return g;
}
export function fillPts(x: Ctx, pts: Pt[], style: string | CanvasGradient | CanvasPattern, alpha = 1): void {
  x.save(); x.globalAlpha = alpha; x.fillStyle = style; tracePts(x, pts); x.fill(); x.restore();
}
/** 沿 angle(弧度，0=向右) 方向由 c0 渐变到 c1 填满路径。 */
export function gradFill(x: Ctx, pts: Pt[], c0: string, c1: string, angle = Math.PI / 2): void {
  const b = bbox(pts), dx = Math.cos(angle), dy = Math.sin(angle), e = (Math.abs(dx) * b.w + Math.abs(dy) * b.h) / 2;
  fillPts(x, pts, lin(x, b.cx - dx * e, b.cy - dy * e, b.cx + dx * e, b.cy + dy * e, [[0, c0], [1, c1]]));
}
/** 在当前 clip/画布内撒随机颗粒/笔点（笔触肌理）。bb=[x,y,w,h] */
export function speckles(x: Ctx, bb: [number, number, number, number], n: number, colors: string[], size: [number, number] = [0.5, 1.4], alpha = 0.4, seed = 1): void {
  const R = rng(seed); x.save();
  for (let i = 0; i < n; i++) {
    x.globalAlpha = alpha * (0.5 + R() * 0.7); x.fillStyle = R.pick(colors);
    const s = R.range(size[0], size[1]), px = bb[0] + R() * bb[2], py = bb[1] + R() * bb[3];
    x.beginPath(); x.ellipse(px, py, s, s * R.range(0.5, 1), R() * 3, 0, Math.PI * 2); x.fill();
  }
  x.restore();
}
/** 手绘排线（阴影笔触）。在已 clip 的区域里画。angle 弧度；gap 线间距。 */
export function hatch(x: Ctx, bb: [number, number, number, number], o: { angle?: number; gap?: number; color?: string; alpha?: number; w?: number; seed?: number } = {}): void {
  const a = o.angle ?? -0.9, gap = o.gap ?? 2.4, R = rng(o.seed ?? 3), cx = bb[0] + bb[2] / 2, cy = bb[1] + bb[3] / 2, rad = Math.hypot(bb[2], bb[3]) / 2;
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  x.save(); x.strokeStyle = o.color ?? PAL.shadowTint; x.globalAlpha = o.alpha ?? 0.16; x.lineWidth = o.w ?? 0.5;
  for (let t = -rad; t < rad; t += gap * R.range(0.8, 1.25)) {
    const l0 = rad * R.range(0.5, 1), px = cx + nx * t, py = cy + ny * t;
    x.beginPath(); x.moveTo(px - dx * l0, py - dy * l0); x.lineTo(px + dx * l0, py + dy * l0); x.stroke();
  }
  x.restore();
}

export interface PaintOpt extends WobOpt {
  /** 主色；省略则不填 */ fill?: string;
  /** 暗面色，默认 shade(fill,-0.3) */ fill2?: string;
  /** 光向（朝亮面），默认 LIGHT */ light?: Pt;
  /** 渐变强度 0~1，默认 1；0=纯色 */ grad?: number;
  /** 高光边（左上亮边）强度 0~1，默认 0.55 */ hi?: number;
  /** 暗边（右下冷影边）强度 0~1，默认 0.5 */ rim?: number;
  /** 水彩边缘积色 0~1，默认 0.3 */ edge?: number;
  /** 斑驳（水彩洗色）0~1，默认 0.5 */ mottle?: number;
  /** 细颗粒 0~1，默认 0.35 */ grain?: number;
  /** 描边色；false=不描边，默认 PAL.ink */ stroke?: string | false;
  /** 描边宽（源像素），默认 0.9 */ w?: number;
  vary?: number; double?: boolean; strokeAlpha?: number;
  /** 排线阴影 */ hatch?: { angle?: number; gap?: number; color?: string; alpha?: number };
  /** 额外在 clip 内执行的细节绘制（纹理笔触：砖缝、木纹等） */ detail?: (x: Ctx, bb: ReturnType<typeof bbox>) => void;
}
/**
 * 手绘上色：对封闭路径一次完成 渐变(亮→暗沿光向) + 水彩斑驳 + 边缘积色 + 左上高光边 + 右下冷影边 + 颗粒 + 抖动描边。
 * pts 通常来自 pRect/pEllipse/pPoly/pBlob；也可直接传普通点列（会自动加抖动，wob 默认 0.4）。
 * 返回实际使用的点列（可再用来描别的线）。
 */
export function paint(x: Ctx, ptsIn: Pt[], o: PaintOpt = {}): Pt[] {
  const pts = o.amp === undefined && ptsIn.length <= 8 ? wobblyPath(ptsIn, true, { amp: 0.4, step: 2.6, seed: o.seed, smooth: o.smooth }) : ptsIn;
  const seed = o.seed ?? autoSeed(pts);
  const b = bbox(pts), R = rng(seed);
  const light = o.light ?? LIGHT, grad = o.grad ?? 1;
  if (o.fill) {
    const f1 = o.fill, f0 = shade(f1, 0.2), f2 = o.fill2 ?? shade(f1, -0.3);
    x.save(); clipPts(x, pts);
    // 渐变：沿光向，亮→基→暗
    const ext = (Math.abs(light[0]) * b.w + Math.abs(light[1]) * b.h) / 2 + 0.01;
    if (grad > 0) x.fillStyle = lin(x, b.cx + light[0] * ext, b.cy + light[1] * ext, b.cx - light[0] * ext, b.cy - light[1] * ext, [[0, mix(f1, f0, grad)], [0.42, f1], [1, mix(f1, f2, grad)]]);
    else x.fillStyle = f1;
    x.fillRect(b.x0 - 1, b.y0 - 1, b.w + 2, b.h + 2);
    // 水彩斑驳
    const mt = o.mottle ?? 0.5;
    if (mt > 0) {
      const n = Math.max(3, Math.min(46, Math.round((b.w * b.h) / 38 * mt)));
      for (let i = 0; i < n; i++) {
        const r = R.range(1.4, Math.max(2.4, Math.min(b.w, b.h) * 0.33));
        x.globalAlpha = R.range(0.05, 0.14) * (0.6 + mt); x.fillStyle = R() > 0.5 ? shade(f1, 0.18) : shade(f1, -0.18);
        x.beginPath(); x.ellipse(b.x0 + R() * b.w, b.y0 + R() * b.h, r, r * R.range(0.5, 1), R() * 3, 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 1;
    }
    o.detail?.(x, b);
    if (o.hatch) hatch(x, [b.x0, b.y0, b.w, b.h], { seed: seed + 3, ...o.hatch });
    // 水彩边缘积色
    const ed = o.edge ?? 0.3;
    if (ed > 0) { x.globalAlpha = ed * 0.55; x.strokeStyle = shade(f1, -0.4); x.lineWidth = Math.min(2.6, Math.max(1, Math.min(b.w, b.h) * 0.2)); tracePts(x, pts); x.stroke(); x.globalAlpha = 1; }
    // 左上高光边 / 右下冷影边：整条轮廓平移后只在 clip 内可见一侧
    const hi = o.hi ?? 0.55, rim = o.rim ?? 0.5, off = Math.min(1.5, Math.max(0.7, Math.min(b.w, b.h) * 0.14));
    const sw = Math.min(1.5, Math.max(0.7, Math.min(b.w, b.h) * 0.12));
    if (hi > 0) { x.save(); x.translate(-light[0] * off, -light[1] * off); x.globalAlpha = hi; x.strokeStyle = shade(f1, 0.55); x.lineWidth = sw; tracePts(x, pts); x.stroke(); x.restore(); }
    if (rim > 0) { x.save(); x.translate(light[0] * off, light[1] * off); x.globalAlpha = rim; x.strokeStyle = shade(f1, -0.45); x.lineWidth = sw * 1.2; tracePts(x, pts); x.stroke(); x.restore(); }
    // 细颗粒
    const gr = o.grain ?? 0.35;
    if (gr > 0) speckles(x, [b.x0, b.y0, b.w, b.h], Math.round(b.w * b.h * 0.07 * gr), [shade(f1, -0.22), shade(f1, 0.3)], [0.25, 0.6], 0.35, seed + 9);
    x.restore();
  }
  if (o.stroke !== false) strokePath(x, pts, { closed: true, w: o.w ?? 0.9, color: o.stroke ?? PAL.ink, vary: o.vary ?? 0.5, double: o.double, alpha: o.strokeAlpha, seed: seed + 21, jitter: 0.12 });
  return pts;
}
/** 一个小色团（圆形笔点：果实、灯泡、铆钉）。带高光点。 */
export function blob(x: Ctx, cx: number, cy: number, r: number, color: string, o: PaintOpt & { shine?: boolean } = {}): void {
  paint(x, pEllipse(cx, cy, r, r * (o.shine === undefined ? 1 : 1), { amp: Math.min(0.3, r * 0.15) }), { mottle: 0.2, grain: 0, edge: 0.2, w: Math.max(0.5, Math.min(0.9, r * 0.5)), ...o, fill: color });
  if (o.shine !== false && r >= 1.6) dab(x, cx - r * 0.35, cy - r * 0.4, r * 0.28, shade(color, 0.75), 0.9);
}
/** 单点软笔触 */
export function dab(x: Ctx, cx: number, cy: number, r: number, color: string, alpha = 1): void {
  x.save(); x.globalAlpha = alpha; x.fillStyle = color; x.beginPath(); x.ellipse(cx, cy, r, r * 0.8, -0.5, 0, Math.PI * 2); x.fill(); x.restore();
}

// ═════════════════════════ 光影 ═════════════════════════
/** 脚下软阴影（暖紫色，椭圆径向渐变）。 */
export function softShadow(x: Ctx, cx: number, cy: number, rx: number, ry: number, a = 0.35, color: string = '#2a1840'): void {
  x.save(); x.translate(cx, cy); x.scale(1, ry / rx);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.55, rgba(color, a * 0.6)); g.addColorStop(1, rgba(color, 0));
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, rx, 0, Math.PI * 2); x.fill(); x.restore();
}
/** 圆形光晕（加色/普通均可，调用者自行设置 globalCompositeOperation）。 */
export function glow(x: Ctx, cx: number, cy: number, r: number, color: string = PAL.warmLight, a = 0.8): void {
  x.save(); const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.35, rgba(color, a * 0.45)); g.addColorStop(1, rgba(color, 0));
  x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore();
}
