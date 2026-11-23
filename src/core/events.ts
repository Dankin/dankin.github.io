// 随机事件:偶尔出现,点一下领奖励(不点没有惩罚)。
import { mods, throughput } from './game.ts';
import type { State } from './state.ts';

export type EventKind = 'bird' | 'newton' | 'meteor';
export const EVENT_NAMES: Record<EventKind, string> = { bird: '偷苹果的小鸟', newton: '路过的牛顿', meteor: '流星' };
/** 奖励说明(UI 提示用) */
export const EVENT_DESC: Record<EventKind, string> = {
  bird: '小鸟衔来一份苹果(约 15 秒的送达量)',
  newton: '牛顿被砸了一下,灵感爆发:10 秒内摇树掉的苹果和摇劲翻倍',
  meteor: '流星带来一整车苹果(约 25 秒的送达量)',
};
/** 事件间隔 [min,max] 秒 */
export const EVENT_GAP_S: [number, number] = [60, 120];
/** 事件存在多久(秒)没点就走 */
export const EVENT_STAY_S: Record<EventKind, number> = { bird: 9, newton: 10, meteor: 6 };
/** 奖励相当于多少秒的送达量 */
export const EVENT_REWARD_S: Record<EventKind, number> = { bird: 15, newton: 0, meteor: 25 };
/** 牛顿 buff 持续秒数 */
export const NEWTON_S = 10;

export function nextEventGap(rnd: () => number = Math.random): number {
  return EVENT_GAP_S[0] + rnd() * (EVENT_GAP_S[1] - EVENT_GAP_S[0]);
}

/** 流星只在夜里出现;白天是小鸟和牛顿 */
export function pickEvent(isNight: boolean, rnd: () => number = Math.random): EventKind {
  if (isNight) return rnd() < 0.6 ? 'meteor' : 'bird';
  return rnd() < 0.6 ? 'bird' : 'newton';
}

export interface EventClaim {
  kind: EventKind;
  /** 直接送达的苹果数(牛顿为 0) */
  apples: number;
  coins: number;
}

/** 领取事件奖励:改 s,返回结果。送达量按当前吞吐折算,至少 1 个。 */
export function claimEvent(s: State, kind: EventKind): EventClaim {
  if (kind === 'newton') {
    s.newtonUntil = s.playSec + NEWTON_S;
    return { kind, apples: 0, coins: 0 };
  }
  const th = throughput(s);
  const apples = Math.max(1, Math.floor(th.flow * EVENT_REWARD_S[kind]));
  const coins = apples * mods(s).value;
  s.delivered += apples;
  s.coins += coins;
  if (s.wonAt === null && s.delivered >= 8_200_000_000) s.wonAt = s.playSec;
  return { kind, apples, coins };
}
