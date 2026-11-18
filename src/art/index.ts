/**
 * 环境美术统一入口（art-world）。全部为手绘版：每张纹理 = 旧源尺寸 × SS，显示时 setScale(旧倍数 / SS)（即 ART_SCALE）。
 *
 * 推荐用法（Boot 分帧加载，首屏不卡）：
 *   const env = await buildEnvironment((k, c) => this.textures.addCanvas(k, c), (p, label) => bar.set(p));
 *   registry.set('groundChunks', env.chunks);        // {ground:[{key,x,y,w,h}], ground_snow:[...]}
 *   registry.set('windows', env.windows);            // {'ne_a': WallWin[], ...}
 *   纹理键: ground_<cx>_<cy> / ground_snow_<cx>_<cy> / wall_<ne|nw>_<a..l> / p_<道具> / backdrop(+_morning/_night)
 *
 * 同步版（兼容现有 Boot）：buildGroundChunks(snow, add) / buildWall / buildProps / buildBackdrop。
 */
import { buildGroundChunks as groundDescs, CHUNK } from './env/ground';
import { buildWall as wall, WALL_VARIANTS, WALL_TILES, WALL_NAMES, type WallTex, type WallWin } from './env/facade';
import { buildPropTextures, PROP_KEYS } from './env/props';
import { buildWeatherTextures, WEATHER_KEYS } from './env/weather';
import { buildBackdrops } from './env/backdrop';

export { PX, SS, ART_SCALE, NATIVE_SCALE } from './scale';
export { CHUNK, WALL_TILES, WALL_VARIANTS, WALL_NAMES, PROP_KEYS, WEATHER_KEYS };
export type { WallTex, WallWin };

export interface GroundChunkInfo { key: string; x: number; y: number; w: number; h: number }
export type AddTex = (key: string, canvas: HTMLCanvasElement) => void;

/** 契约 3.2：按 10×10 瓦片切块；x,y,w,h 为世界/屏幕像素显示矩形，图像 origin(0,0) setScale(ART_SCALE)。 */
export function buildGroundChunks(snow: boolean, add: AddTex): GroundChunkInfo[] {
  return groundDescs(snow).map((c) => { add(c.key, c.build()); return { key: c.key, x: c.x, y: c.y, w: c.w, h: c.h }; });
}
export function buildWall(side: 'ne' | 'nw', v: string): WallTex { return wall(side, v); }
/** 道具 + 天气/光效（p_ 前缀由调用方添加） */
export function buildProps(): Record<string, HTMLCanvasElement> { return { ...buildPropTextures(), ...buildWeatherTextures() }; }
export function buildBackdrop(): HTMLCanvasElement { return buildBackdrops().backdrop; }

export interface EnvResult { chunks: { ground: GroundChunkInfo[]; ground_snow: GroundChunkInfo[] }; windows: Record<string, WallWin[]>; ms: number }

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * 分帧加载全部环境纹理（每个任务之间让出主线程，可显示进度条）。
 * 顺序：背景 → 道具/光效 → 墙 → 地面（基础）→ 地面（积雪覆盖层）。
 * opts.snow=false 时可延后积雪层（返回的 ground_snow 为空，稍后调用 buildSnowChunks）。
 */
export async function buildEnvironment(add: AddTex, onProgress?: (p: number, label: string) => void, opts: { snow?: boolean } = {}): Promise<EnvResult> {
  const t0 = performance.now();
  const snow = opts.snow !== false;
  const gBase = groundDescs(false), gSnow = snow ? groundDescs(true) : [];
  const total = 3 + WALL_VARIANTS.length * 2 + gBase.length + gSnow.length + 1;
  let done = 0; const step = async (label: string) => { done++; onProgress?.(done / total, label); await tick(); };
  const out: EnvResult = { chunks: { ground: [], ground_snow: [] }, windows: {}, ms: 0 };

  const bds = buildBackdrops(); for (const [k, c] of Object.entries(bds)) { add(k, c); await step('backdrop'); }
  const props = buildProps();
  for (const [k, c] of Object.entries(props)) add('p_' + k, c);
  await step('props');
  for (const v of WALL_VARIANTS) for (const side of ['ne', 'nw'] as const) {
    const w = wall(side, v); add(`wall_${side}_${v}`, w.canvas); out.windows[`${side}_${v}`] = w.windows; await step('walls');
  }
  for (const g of gBase) { add(g.key, g.build()); out.chunks.ground.push({ key: g.key, x: g.x, y: g.y, w: g.w, h: g.h }); await step('ground'); }
  for (const g of gSnow) { add(g.key, g.build()); out.chunks.ground_snow.push({ key: g.key, x: g.x, y: g.y, w: g.w, h: g.h }); await step('snow'); }
  onProgress?.(1, 'done'); out.ms = performance.now() - t0;
  return out;
}

/** 延后构建积雪覆盖层（首屏之后再调用，分帧） */
export async function buildSnowChunks(add: AddTex, onProgress?: (p: number) => void): Promise<GroundChunkInfo[]> {
  const gs = groundDescs(true), res: GroundChunkInfo[] = [];
  for (let i = 0; i < gs.length; i++) { const g = gs[i]; add(g.key, g.build()); res.push({ key: g.key, x: g.x, y: g.y, w: g.w, h: g.h }); onProgress?.((i + 1) / gs.length); await tick(); }
  return res;
}
