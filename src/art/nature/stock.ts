// 树脚下的苹果堆:level 0..1 越大越高越宽。锚点=堆底中心(接地点),世界单位 s=1。
import { Ctx, rng, ell, clamp, lerp } from './common';
import { appleSprite, drawAppleAt, AppleKind } from './apple';

export const STOCK_MAX = 46;
export interface StockOpts { seed?: number; /** 夜晚压暗/不用 */ kind?: AppleKind }
/** 当前 level 对应的苹果个数 */
export function stockCount(level: number) { return level <= 0.001 ? 0 : Math.max(1, Math.round(clamp(level, 0, 1) * STOCK_MAX)); }
/** 堆的包围:宽/高(s=1),供布局避让 */
export function stockSize(level: number) { const n = stockCount(level); if (!n) return { w: 0, h: 0 }; const cols = Math.min(9, 2 + Math.ceil(Math.sqrt(n) * 1.1)); return { w: cols * 17 + 10, h: Math.ceil(n / (cols * 0.6)) * 13 + 10 }; }

export function drawStockPile(ctx: Ctx, x: number, y: number, s = 1, level = 0.5, o: StockOpts = {}) {
  const n = stockCount(level); if (!n) return;
  const r = rng((o.seed ?? 1) * 7 + 3);
  const cols0 = Math.min(9, 2 + Math.ceil(Math.sqrt(n) * 1.1)), dx = 17, dy = 12.5, R = 9;
  // 行:底行 cols0 个,向上每行少 1(梯形堆),直到放满 n 个
  const rows: { x: number; y: number; k: number }[][] = []; let left = n, rowN = cols0;
  while (left > 0) {
    const c = Math.min(left, Math.max(1, rowN)), row: { x: number; y: number; k: number }[] = [], ri = rows.length;
    for (let i = 0; i < c; i++) row.push({ x: (i - (c - 1) / 2) * dx + (r() - 0.5) * 3, y: -R - ri * dy + (r() - 0.5) * 2, k: r() });
    rows.push(row); left -= c; rowN--;
  }
  const maxW = cols0 * dx + 20;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ell(ctx, 0, 1, maxW * 0.5, 6); ctx.fillStyle = 'rgba(27,20,16,0.28)'; ctx.fill();
  const spr = (k: AppleKind) => appleSprite(k, 'fresh', 32);
  // 先画高处(后面),再画低处(前面遮挡)
  for (let ri = rows.length - 1; ri >= 0; ri--) for (const p of rows[ri]) {
    const kind: AppleKind = o.kind ?? (p.k > 0.93 ? 'golden' : p.k > 0.8 ? 'green' : 'fuji');
    drawAppleAt(ctx, spr(kind), p.x, p.y, lerp(0.86, 0.96, p.k));
  }
  ctx.restore();
}
