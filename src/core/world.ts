// 世界时钟:昼夜、季节、天气。只是画面用的纯函数(游戏时间秒的函数),不影响数值。

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
