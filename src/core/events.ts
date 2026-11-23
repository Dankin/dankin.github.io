// 随机事件:偶尔出现,点一下领奖励(不点没有惩罚)。奖励 = 若干秒的"典型收入"。
import type { State } from './state.ts';
import { clickEV, rate } from './game.ts';

export type EventKind = 'bird' | 'courier' | 'star';
export const EVENT_NAMES: Record<EventKind, string> = { bird: '偷苹果的小鸟', courier: '快递小哥', star: '流星' };
/** 奖励相当于多少秒的收入 */
export const EVENT_REWARD_S: Record<EventKind, number> = { bird: 10, courier: 10, star: 20 };
export const EVENT_GAP_S: [number, number] = [60, 100];
/** 事件存在多久(秒)没点就走 */
export const EVENT_STAY_S: Record<EventKind, number> = { bird: 9, courier: 12, star: 6 };

export function nextEventGap(rnd: () => number = Math.random): number {
  return EVENT_GAP_S[0] + rnd() * (EVENT_GAP_S[1] - EVENT_GAP_S[0]);
}

/** 流星只在夜里出现;白天是小鸟和快递 */
export function pickEvent(isNight: boolean, rnd: () => number = Math.random): EventKind {
  if (isNight) return rnd() < 0.6 ? 'star' : 'bird';
  return rnd() < 0.55 ? 'bird' : 'courier';
}

export function eventReward(s: State, kind: EventKind, now = Infinity): number {
  const typical = rate(s, now) + 1.5 * clickEV(s, now);
  return Math.max(1, Math.floor(typical * EVENT_REWARD_S[kind]));
}
