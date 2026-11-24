// 离屏缓存工具:把静态手绘件烤成位图,按"屏幕像素/世界单位"分档(q),动画部件另画。
export type C = CanvasRenderingContext2D;
type Cv = HTMLCanvasElement | OffscreenCanvas;

export interface Baked {
  c: Cv;
  /** 世界单位尺寸 */
  w: number;
  h: number;
  /** 原点在位图中的世界单位偏移(位图左上 = 原点 - (ox,oy)) */
  ox: number;
  oy: number;
  q: number;
}
/** 局部包围盒:相对 (x,y)=底部中心的世界单位,y 向下为正 */
export type Bounds = [x0: number, y0: number, x1: number, y1: number];

const cache = new Map<string, Baked>();
const MAX_ENTRIES = 400;

function mkCanvas(w: number, h: number): Cv {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

/** 当前 ctx 下 1 世界单位 = 多少设备像素(×s),分档以便缓存复用 */
export function qOf(ctx: C, s = 1): number {
  const m = ctx.getTransform();
  const px = Math.hypot(m.a, m.b) * Math.abs(s);
  const steps = [1, 1.5, 2, 3, 4, 6];
  for (const v of steps) if (px <= v * 1.05) return v;
  return 6;
}

export function bake(key: string, b: Bounds, q: number, draw: (g: C) => void): Baked {
  const k = `${key}@${q}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const w = b[2] - b[0], h = b[3] - b[1];
  const c = mkCanvas(Math.max(1, Math.ceil(w * q)), Math.max(1, Math.ceil(h * q)));
  const g = c.getContext('2d') as C;
  g.scale(q, q);
  g.translate(-b[0], -b[1]);
  draw(g);
  const out: Baked = { c, w, h, ox: -b[0], oy: -b[1], q };
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(k, out);
  return out;
}

export function blit(ctx: C, b: Baked, x: number, y: number, s = 1): void {
  ctx.drawImage(b.c as CanvasImageSource, x - b.ox * s, y - b.oy * s, b.w * s, b.h * s);
}

/** 一步到位:按 ctx 分辨率烤并贴。draw 在局部坐标(原点=底部中心)里画。 */
export function cached(ctx: C, key: string, b: Bounds, x: number, y: number, s: number, draw: (g: C) => void): void {
  blit(ctx, bake(key, b, qOf(ctx, s), draw), x, y, s);
}

export function clearBake(): void {
  cache.clear();
}
export function bakeCount(): number {
  return cache.size;
}
