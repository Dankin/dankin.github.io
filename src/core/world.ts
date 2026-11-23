// 世界时钟:收获周期、昼夜、季节、天气。全部是"游戏时间(秒,从开局算)"的纯函数,
// 画面和数值共用同一份,调试加速时也一起加速。
export const world = { harvestOn: true };

/** 收获周期:100 秒一轮。前 75 秒「生长期」自动产出 ×0.75,后 25 秒「收获期」×1.75,平均恰好 ×1。 */
export const HARVEST_CYCLE_S = 100;
export const HARVEST_S = 25;
export const GROW_MULT = 0.75;
export const HARVEST_MULT = 1.75;

export interface HarvestInfo {
  harvesting: boolean;
  /** 本轮已走过的比例 0..1 */
  phase: number;
  /** 果子成熟度 0..1:生长期线性增长,收获期保持 1,收获结束后回落 */
  ripe: number;
  /** 当前阶段剩余秒数 */
  leftS: number;
}

export function harvestInfo(t: number): HarvestInfo {
  const x = ((t % HARVEST_CYCLE_S) + HARVEST_CYCLE_S) % HARVEST_CYCLE_S;
  const growS = HARVEST_CYCLE_S - HARVEST_S;
  if (x < growS) return { harvesting: false, phase: x / HARVEST_CYCLE_S, ripe: x / growS, leftS: growS - x };
  return { harvesting: true, phase: x / HARVEST_CYCLE_S, ripe: 1, leftS: HARVEST_CYCLE_S - x };
}

export function harvestMult(t: number): number {
  if (!world.harvestOn || !Number.isFinite(t)) return 1;
  return harvestInfo(t).harvesting ? HARVEST_MULT : GROW_MULT;
}

/** 一天 240 秒;一个季节 300 秒(春夏秋冬 = 0..3) */
export const DAY_S = 240;
export const SEASON_S = 300;
export const SEASON_NAMES = ['春', '夏', '秋', '冬'] as const;
export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow';

export interface WorldInfo {
  /** 一天中的位置 0..1(0 日出,0.25 正午,0.5 日落,0.75 午夜) */
  dayPhase: number;
  /** 光照 0(深夜)..1(白天) */
  daylight: number;
  isNight: boolean;
  /** 0 春 1 夏 2 秋 3 冬 */
  season: number;
  /** 当前季节已过比例 0..1 */
  seasonT: number;
  weather: Weather;
}

function hash01(n: number): number {
  let x = (n * 2654435761) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function worldAt(t: number, seasonOverride?: number): WorldInfo {
  const dayPhase = (((t / DAY_S) % 1) + 1) % 1;
  const h = Math.sin(dayPhase * Math.PI * 2);
  const daylight = Math.min(1, Math.max(0, 0.5 + h * 0.9));
  const seasonRaw = Math.floor(t / SEASON_S);
  const season = seasonOverride ?? (((seasonRaw % 4) + 4) % 4);
  const seasonT = (((t / SEASON_S) % 1) + 1) % 1;
  // 天气每 90 秒换一次(同一时刻永远同一个天气)
  const r = hash01(Math.floor(t / 90) + 17);
  let weather: Weather = 'clear';
  if (season === 3) weather = r < 0.35 ? 'snow' : r < 0.55 ? 'cloudy' : 'clear';
  else if (season === 0) weather = r < 0.3 ? 'rain' : r < 0.5 ? 'cloudy' : 'clear';
  else if (season === 1) weather = r < 0.2 ? 'rain' : r < 0.3 ? 'cloudy' : 'clear';
  else weather = r < 0.2 ? 'rain' : r < 0.45 ? 'cloudy' : 'clear';
  return { dayPhase, daylight, isNight: h < -0.15, season, seasonT, weather };
}

/** 下雨时自动产出 +10%(雨水滋润) */
export const RAIN_MULT = 1.1;
export function envMult(t: number): number {
  if (!world.harvestOn || !Number.isFinite(t)) return 1;
  return harvestMult(t) * (worldAt(t).weather === 'rain' ? RAIN_MULT : 1);
}
