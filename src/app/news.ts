// 新闻内容源:把 src/content/news.ts 的 NEWS_ITEMS(带 era / when 条件 / weight)接到滚动条上。
// 条件标签(when)的判定在这里算,依据 app 层状态与事件总线;systems 以后有更准的信号(天气、金苹果)再替换 tagsNow()。
import { bus } from '../core/bus.ts';
import { era, stockFill } from '../core/game.ts';
import { NEWS_ITEMS, type NewsItem } from '../content/news.ts';
import { getGoal } from './bar.ts';
import { selectNews } from './newspick.ts';
import type { NewsCtx, NewsSource } from './ticker.ts';
import { setNewsSource } from './ticker.ts';

// ───── 事件 → 标签的依据 ─────
let lastTierAt = -1e9;
let lastShakeAt = performance.now();
let comboAt = -1e9;
let goldSeen = false;
export function trackNewsSignals(): void {
  bus.on('tier', () => (lastTierAt = performance.now()));
  bus.on('shake', (e) => {
    lastShakeAt = performance.now();
    if (e.combo >= 20) comboAt = lastShakeAt;
  });
  bus.on('gold', () => (goldSeen = true));
}

/** 当前成立的条件标签(见 content/news.ts 的 NEWS_TAGS) */
export function tagsNow(c: NewsCtx, d = new Date()): Set<string> {
  const tags = new Set<string>();
  const h = d.getHours();
  tags.add(h >= 19 || h < 6 ? 'night' : 'day');
  if (d.getMonth() === 11) tags.add('snow');
  if (d.getMonth() === 11 && d.getDate() >= 20) tags.add('xmas');
  const goal = getGoal();
  if (goal && c.state.coins < goal.cost * 0.5) tags.add('low-stock');
  if (stockFill(c.state) >= 0.7) tags.add('high-stock');
  if (c.now - lastTierAt < 60_000) tags.add('new-tier');
  if (c.now - lastShakeAt > 30_000) tags.add('idle');
  if (c.now - comboAt < 15_000) tags.add('combo');
  if (goldSeen) tags.add('gold');
  return tags;
}

const seen = new Map<string, number>();

/** 从 items 里按时代、条件、权重、冷却挑一条(纯逻辑见 newspick.ts) */
export function pickNews(items: readonly NewsItem[], c: NewsCtx, rnd: () => number = Math.random): NewsItem | null {
  return selectNews(items, Math.min(5, era(c.state)), tagsNow(c), c.now, seen, rnd);
}

/** 把内容库接上滚动条 */
export function installContentNews(items: readonly NewsItem[] = NEWS_ITEMS): void {
  const src: NewsSource = (c) => {
    const it = pickNews(items, c);
    if (!it) return null;
    seen.set(it.id, c.now);
    return it.text;
  };
  setNewsSource(src);
}
