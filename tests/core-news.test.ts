import assert from 'node:assert/strict';
import test from 'node:test';
import { NEWS_ITEMS, type NewsItem } from '../src/content/news.ts';
import { NEWS_COOLDOWN, selectNews } from '../src/app/newspick.ts';

const items: NewsItem[] = [
  { id: 'a', text: 'A', era: 0 },
  { id: 'b', text: 'B', era: 2 },
  { id: 'c', text: 'C', when: ['night'] },
  { id: 'd', text: 'D', when: ['night', 'snow'] },
];
const none = new Set<string>();
const first = () => 0;

test('新闻:时代过滤,高于当前时代的不出', () => {
  const ids = new Set<string>();
  for (let i = 0; i < 40; i++) ids.add(selectNews(items, 0, none, 0, new Map(), () => i / 40)!.id);
  assert.deepEqual([...ids], ['a']);
});

test('新闻:条件标签必须全部成立', () => {
  const night = new Set(['night']);
  const ids = new Set<string>();
  for (let i = 0; i < 60; i++) ids.add(selectNews(items, 3, night, 0, new Map(), () => i / 60)!.id);
  assert.ok(ids.has('c') && !ids.has('d'));
  const both = new Set(['night', 'snow']);
  const ids2 = new Set<string>();
  for (let i = 0; i < 80; i++) ids2.add(selectNews(items, 3, both, 0, new Map(), () => i / 80)!.id);
  assert.ok(ids2.has('d'));
});

test('新闻:冷却内不重复,冷却后可再出;没有可选返回 null', () => {
  const one = [{ id: 'x', text: 'X' }];
  const seen = new Map([['x', 1000]]);
  assert.equal(selectNews(one, 0, none, 1000 + NEWS_COOLDOWN - 1, seen, first), null);
  assert.equal(selectNews(one, 0, none, 1000 + NEWS_COOLDOWN, seen, first)!.id, 'x');
});

test('新闻:真实内容库的每个时代都有无条件的可选条目', () => {
  for (let e = 0; e <= 5; e++) {
    const it = selectNews(NEWS_ITEMS, e, none, 0, new Map(), first);
    assert.ok(it, `era ${e} 无条件新闻为空`);
  }
});
