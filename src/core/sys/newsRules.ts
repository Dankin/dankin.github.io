// 新闻条件规则:根据游戏状态给新闻条目打分选一条。writer 提供条目(src/content/news.ts 的 NEWS_ITEMS)。
// when 标签 ALL 满足才可选;命中的条件越多权重越高;最近看过的 id 不重复。
import { MILESTONES, NEWS } from './constants.ts';
import { pickIndex, type Rnd } from './util.ts';
import type { Snapshot } from './types.ts';

/** 与 src/content/news.ts 的 NewsItem 同构(这里重复声明以免 core 依赖 content) */
export interface NewsItem {
  id: string;
  text: string;
  era?: 0 | 1 | 2 | 3 | 4 | 5;
  when?: string[];
  weight?: number;
}

/** 环境类标签(几乎时刻成立),加成减半 */
const AMBIENT = new Set(['day', 'night', 'spring', 'summer', 'autumn', 'winter', 'rain', 'snow']);

export interface NewsState {
  /** 已越过的最高里程碑下标(-1 = 无),以及越过时刻 */
  mIdx: number;
  mAt: number;
}
export const newNewsState = (): NewsState => ({ mIdx: -1, mAt: 0 });

/** 每秒调用:跟踪进度里程碑(1%/10%/…),用于 milestone-N 标签 */
export function trackMilestone(ns: NewsState, progress: number, playSec: number): void {
  let idx = -1;
  for (let i = 0; i < MILESTONES.length; i++) if (progress >= MILESTONES[i]) idx = i;
  if (idx > ns.mIdx) {
    ns.mIdx = idx;
    ns.mAt = playSec;
  }
}

/** milestone 标签窗口(秒) */
export const MILESTONE_WINDOW_S = 60;
const MILESTONE_TAG = (m: number) => `milestone-${Math.round(m * 100)}`;

/** 把 NewsState 折成 Snapshot.milestone 字段 */
export function milestoneOf(ns: NewsState, playSec: number): Snapshot['milestone'] {
  return ns.mIdx < 0 ? null : { m: MILESTONES[ns.mIdx], sinceSec: playSec - ns.mAt };
}

/** 当前状态成立的所有条件标签 */
export function activeTags(s: Snapshot): Set<string> {
  const t = new Set<string>();
  t.add(s.night ? 'night' : 'day');
  t.add(['spring', 'summer', 'autumn', 'winter'][s.season] ?? 'spring');
  if (s.weather === 'rain') t.add('rain');
  if (s.weather === 'snow' || s.wall.m === 12) t.add('snow');
  if (s.coins < s.income * NEWS.lowStockSec) t.add('low-stock');
  if (s.hoardRatio >= NEWS.highStock) t.add('high-stock');
  if (s.hoardRatio >= 1) t.add('rot');
  if (s.stockFill >= 0.95) t.add('wasted');
  if (s.sinceTierSec < NEWS.newTierS) t.add('new-tier');
  if (s.idleSec >= NEWS.idleS) t.add('idle');
  if (s.wall.m === 12 && s.wall.d >= 20) t.add('xmas');
  if (s.goldSeen) t.add('gold');
  if (s.combo >= NEWS.comboN) t.add('combo');
  if (s.ordersActive > 0) t.add('order');
  if (s.pestsActive > 0) t.add('pest');
  if (s.offerOpen) t.add('offer');
  if (s.sinceEventSec < 20) t.add('post-event');
  if (s.bottleneck === 'produce') t.add('bottleneck-produce');
  if (s.bottleneck === 'carry') t.add('bottleneck-carry');
  if (s.milestone && s.milestone.sinceSec < MILESTONE_WINDOW_S) t.add(MILESTONE_TAG(s.milestone.m));
  return t;
}

/** 条目的有效权重;不可选返回 0 */
export function itemWeight(it: NewsItem, s: Snapshot, tags: Set<string>): number {
  if (it.era !== undefined && it.era !== s.era) return 0;
  let w = it.weight ?? 1;
  if (it.when && it.when.length) {
    let bonus = 1;
    for (const tag of it.when) {
      if (!tags.has(tag)) return 0;
      bonus += tag.startsWith('milestone-') ? NEWS.milestoneBonus : AMBIENT.has(tag) ? NEWS.ambientBonus : NEWS.tagBonus;
    }
    w *= bonus;
  }
  return w;
}

/**
 * 选一条新闻。recent = 最近看过的 id(旧→新),只看最后 NEWS.recentN 个;
 * 若过滤后一条都不剩,则放宽冷却。items 为空返回 null。
 */
export function pickNews(s: Snapshot, recent: readonly string[], items: readonly NewsItem[], rnd: Rnd = Math.random): NewsItem | null {
  if (!items.length) return null;
  const tags = activeTags(s);
  const seen = new Set(recent.slice(-NEWS.recentN));
  const weights = items.map((it) => (seen.has(it.id) ? 0 : itemWeight(it, s, tags)));
  let i = pickIndex(weights, rnd);
  if (i < 0) i = pickIndex(items.map((it) => itemWeight(it, s, tags)), rnd);
  return i < 0 ? null : items[i];
}

/** 把选中的 id 压进最近列表(保留最近 recentN 个) */
export function pushRecent(recent: string[], id: string): string[] {
  const out = recent.filter((x) => x !== id);
  out.push(id);
  return out.length > NEWS.recentN ? out.slice(out.length - NEWS.recentN) : out;
}
