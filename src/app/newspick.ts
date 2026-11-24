// 新闻挑选(纯逻辑,不碰 DOM,可测试)。
import type { NewsItem } from '../content/news.ts';

/** 同一条新闻的冷却(ms):30 分钟不重复 */
export const NEWS_COOLDOWN = 30 * 60 * 1000;

/**
 * 按时代、条件标签、权重、冷却挑一条。
 * - era:当前时代(0..5);条目 era 大于它的不出现
 * - tags:当前成立的条件标签;条目 when 里的标签必须全部成立
 * - seen:id → 上次展示的 now;冷却内的不再选(选中后由调用方写回)
 * - 权重:weight(缺省 1);当前时代 ×2;带条件的 ×1.5
 */
export function selectNews(items: readonly NewsItem[], era: number, tags: ReadonlySet<string>, now: number, seen: ReadonlyMap<string, number>, rnd: () => number = Math.random): NewsItem | null {
  const pool: { it: NewsItem; w: number }[] = [];
  for (const it of items) {
    if (it.era !== undefined && it.era > era) continue;
    if (it.when && !it.when.every((t) => tags.has(t))) continue;
    if (now - (seen.get(it.id) ?? -Infinity) < NEWS_COOLDOWN) continue;
    let w = it.weight ?? 1;
    if (it.era === era) w *= 2;
    if (it.when?.length) w *= 1.5;
    pool.push({ it, w });
  }
  if (!pool.length) return null;
  let r = rnd() * pool.reduce((a, b) => a + b.w, 0);
  for (const p of pool) if ((r -= p.w) <= 0) return p.it;
  return pool[pool.length - 1].it;
}
