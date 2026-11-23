// 随机事件:偶尔出现,点一下领奖励(不点没有惩罚)。
import { mods, throughput, tierCost } from './game.ts';
import type { State } from './state.ts';

export type EventKind = 'bird' | 'newton' | 'meteor';
export const EVENT_NAMES: Record<EventKind, string> = { bird: '偷苹果的小鸟', newton: '路过的牛顿', meteor: '流星' };
/** 奖励说明(UI 提示用) */
export const EVENT_DESC: Record<EventKind, string> = {
  bird: '小鸟衔来一份苹果(约 10 秒的送达量,离下个目标近时更多)',
  newton: '牛顿被砸了一下,灵感爆发:10 秒内摇树掉的苹果和摇劲翻倍',
  meteor: '流星路过,顺便卸下一整车苹果(约 15 秒的送达量,离下个目标近时更多)',
};
/** 事件间隔 [min,max] 秒 */
export const EVENT_GAP_S: [number, number] = [45, 90];
/** 事件存在多久(秒)没点就走 */
export const EVENT_STAY_S: Record<EventKind, number> = { bird: 9, newton: 10, meteor: 6 };
/** 奖励至少相当于多少秒的送达量;另外保底"离下一次升档还差的钱"的 EVENT_GAP_SHARE,但不超过 EVENT_MAX_S 秒的量 */
export const EVENT_REWARD_S: Record<EventKind, number> = { bird: 10, newton: 0, meteor: 15 };
/** 离下一次升档还差的钱,奖励至少补这么大一份 */
export const EVENT_GAP_SHARE = 0.2;
/** 补差额时奖励最多相当于多少秒的送达量(免得事件决定进度) */
export const EVENT_MAX_S = 60;
/** 牛顿 buff 持续秒数 */
export const NEWTON_S = 10;

export function nextEventGap(rnd: () => number = Math.random): number {
  return EVENT_GAP_S[0] + rnd() * (EVENT_GAP_S[1] - EVENT_GAP_S[0]);
}

/** 流星只在夜里出现;白天是小鸟和牛顿。last = 上一次的事件,不连续出现同一种。 */
export function pickEvent(isNight: boolean, rnd: () => number = Math.random, last?: EventKind | null): EventKind {
  const pool: EventKind[] = isNight ? ['meteor', 'bird'] : ['bird', 'newton'];
  const first: EventKind = rnd() < 0.6 ? pool[0] : pool[1];
  if (last && first === last) return first === pool[0] ? pool[1] : pool[0];
  return first;
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
  const value = mods(s).value;
  let apples = Math.max(1, Math.floor(th.flow * EVENT_REWARD_S[kind]));
  // 最近一次升档还差多少钱(两条线里较便宜的那个)
  const goals = [tierCost(s, 'source'), tierCost(s, 'route')].filter((x): x is number => x !== null);
  if (goals.length) {
    const gap = Math.max(0, Math.min(...goals) - s.coins);
    const share = Math.floor((gap * EVENT_GAP_SHARE) / Math.max(1e-9, value));
    apples = Math.max(apples, Math.min(share, Math.floor(th.flow * EVENT_MAX_S)));
  }
  const coins = apples * value;
  s.delivered += apples;
  s.coins += coins;
  if (s.wonAt === null && s.delivered >= 8_200_000_000) s.wonAt = s.playSec;
  return { kind, apples, coins };
}
