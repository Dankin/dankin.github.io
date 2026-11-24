// 小工具:确定性随机、加权抽样、UTC+8 时钟。纯函数。
export type Rnd = () => number;

/** mulberry32:确定性随机(种子 → () => [0,1)) */
export function mulberry32(seed: number): Rnd {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 按权重抽一个下标;权重全 0 返回 -1 */
export function pickIndex(weights: readonly number[], rnd: Rnd): number {
  let sum = 0;
  for (const w of weights) sum += w > 0 ? w : 0;
  if (sum <= 0) return -1;
  let x = rnd() * sum;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    if (x < w) return i;
    x -= w;
  }
  return weights.length - 1;
}

export const range = (r: readonly [number, number], rnd: Rnd): number => r[0] + (r[1] - r[0]) * rnd();
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

export interface WallClock {
  y: number;
  /** 1..12 */
  m: number;
  d: number;
  hour: number;
  min: number;
  /** 'YYYY-MM-DD'(UTC+8) */
  day: string;
}

/** 毫秒时间戳 → UTC+8(Asia/Shanghai)时钟,不依赖设备时区 */
export function shanghai(ms: number): WallClock {
  const t = new Date(ms + 8 * 3600 * 1000);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth() + 1;
  const d = t.getUTCDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return { y, m, d, hour: t.getUTCHours(), min: t.getUTCMinutes(), day: `${y}-${p(m)}-${p(d)}` };
}
