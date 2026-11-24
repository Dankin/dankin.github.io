// 共享风格:色板 + 手绘抖线工具。两位美术只读;改动请找 lead。
export const PAL = {
  ink: '#1b1410',        // 描边(深褐黑)
  paper: '#f6efdc',      // 米白底
  paperDark: '#e8dcc0',
  grass: '#7bb83d', grassDark: '#4f8a2a', grassLight: '#a6d85a',
  leaf: '#5aa02c', leafDark: '#3a7a1f', leafLight: '#9bd04a',
  trunk: '#8a5a34', trunkDark: '#5e3a1f', trunkLight: '#b07a48',
  apple: '#d8232a', appleDark: '#9c1218', appleLight: '#ff6a5e', gold: '#f2b705',
  sky: '#bfe3f2', skyDeep: '#7fb8dc', night: '#1d2a4a', dusk: '#e9a46a',
  stone: '#b9b2a2', wood: '#c58d55', warm: '#f4c95d',
} as const;

// 确定性伪随机,保证同一 seed 每帧线条一致(不闪)
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
}

// 手绘抖线:沿折线描边,每点加 ±jitter 偏移,线宽有轻微变化。
export function wobblePath(ctx: CanvasRenderingContext2D, pts: [number, number][], seed = 1, jitter = 1.2, close = false) {
  const r = rng(seed);
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = x + (r() - 0.5) * 2 * jitter, py = y + (r() - 0.5) * 2 * jitter;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  if (close) ctx.closePath();
}

export function inkStroke(ctx: CanvasRenderingContext2D, w = 3) {
  ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = PAL.ink; ctx.stroke();
}
