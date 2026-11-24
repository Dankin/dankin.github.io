// 季节:春花 夏虫 秋收 冬慢。与 world.ts 的昼夜/季节/天气共用同一个时钟(playSec)。
// 四季价格乘数平均 = 1.00(常量里保证),所以长期收入不变,只有节奏起伏。
import { NIGHT_FX, SEASON_FX, WEATHER_FX } from './constants.ts';
import { worldAt, type Weather } from '../world.ts';
import type { AppleCtx } from './varieties.ts';

export interface SeasonNow {
  /** 0 春 1 夏 2 秋 3 冬 */
  season: number;
  seasonName: string;
  weather: Weather;
  night: boolean;
  /** 价格乘数(季节):eng-app 乘进 appleValue;四季平均 1 */
  value: number;
  /** 虫子出现频率倍数(季节 × 昼夜 × 天气);gap 要除以它 */
  pest: number;
  /** 苹果状态抽样倍率(闪光/熟透/虫蛀) */
  stateMul: { shiny: number; ripe: number; wormy: number };
}

export function seasonAt(playSec: number, seasonOverride?: number): SeasonNow {
  const w = worldAt(playSec, seasonOverride);
  const fx = SEASON_FX[w.season];
  return {
    season: w.season,
    seasonName: fx.name,
    weather: w.weather,
    night: w.isNight,
    value: fx.value,
    pest: fx.pest * (w.isNight ? NIGHT_FX.pest : 1) * WEATHER_FX[w.weather],
    stateMul: { shiny: fx.shiny, ripe: fx.ripe, wormy: fx.wormy },
  };
}

/** 构造 rollApple 的情境(夜晚的闪光加成在 stateProbs 里处理) */
export function appleCtxAt(playSec: number, era: number, extra: Partial<AppleCtx> = {}): AppleCtx {
  const s = seasonAt(playSec);
  return { era, season: s.season, night: s.night, stateMul: s.stateMul, ...extra };
}

/** 一整个四季循环的价格平均(自检用,应 = 1) */
export function seasonValueMean(): number {
  return SEASON_FX.reduce((a, f) => a + f.value, 0) / SEASON_FX.length;
}
