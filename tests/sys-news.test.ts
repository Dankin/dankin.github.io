import test from 'node:test';
import assert from 'node:assert/strict';
import { activeTags, itemWeight, newNewsState, milestoneOf, pickNews, pushRecent, trackMilestone, type NewsItem } from '../src/core/sys/newsRules.ts';
import { mulberry32, shanghai } from '../src/core/sys/util.ts';
import { NEWS_ITEMS } from '../src/content/news.ts';
import { snap } from './sys-helpers.ts';

const items: NewsItem[] = [
  { id: 'g1', text: 'generic' },
  { id: 'n1', text: 'night only', when: ['night'] },
  { id: 'r1', text: 'rain+night', when: ['rain', 'night'] },
  { id: 'e3', text: 'era3', era: 3 },
  { id: 'x1', text: 'xmas', when: ['xmas'] },
];

test('activeTags reflect state', () => {
  const t = activeTags(snap({ night: true, weather: 'rain', combo: 30, idleSec: 40, sinceTierSec: 5, coins: 1, income: 10, hoardRatio: 0.8 }));
  for (const k of ['night', 'rain', 'combo', 'idle', 'new-tier', 'low-stock', 'high-stock']) assert.ok(t.has(k), k);
  assert.ok(!t.has('day'));
  const x = activeTags(snap({ wall: shanghai(Date.UTC(2026, 11, 21, 4)) }));
  assert.ok(x.has('xmas') && x.has('snow'));
});

test('pickNews honours when/era filters and recent cooldown', () => {
  const rnd = mulberry32(5);
  const day = snap({ night: false });
  for (let i = 0; i < 100; i++) assert.equal(pickNews(day, [], items, rnd)?.id, 'g1');
  const night = snap({ night: true, weather: 'rain' });
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) seen.add(pickNews(night, [], items, rnd)!.id);
  assert.deepEqual([...seen].sort(), ['g1', 'n1', 'r1']);
  assert.equal(pickNews(snap({ era: 3 }), [], items, rnd) !== null, true);
  // recent 排除;全被排除则放宽
  for (let i = 0; i < 50; i++) assert.notEqual(pickNews(night, ['g1', 'n1'], items, rnd)!.id, 'g1');
  assert.ok(pickNews(day, ['g1'], items, rnd));
  assert.equal(pickNews(day, [], [], rnd), null);
});

test('conditional items weigh more than generic', () => {
  const night = snap({ night: true });
  const tags = activeTags(night);
  assert.ok(itemWeight(items[1], night, tags) > itemWeight(items[0], night, tags));
  assert.equal(itemWeight(items[2], night, tags), 0);
});

test('milestone tracking and tag window', () => {
  const ns = newNewsState();
  assert.equal(milestoneOf(ns, 0), null);
  trackMilestone(ns, 0.005, 10);
  assert.equal(ns.mIdx, -1);
  trackMilestone(ns, 0.011, 100);
  trackMilestone(ns, 0.2, 500);
  const m = milestoneOf(ns, 530)!;
  assert.equal(m.m, 0.1);
  assert.equal(m.sinceSec, 30);
  assert.ok(activeTags(snap({ milestone: m })).has('milestone-10'));
  assert.ok(!activeTags(snap({ milestone: { m: 0.1, sinceSec: 90 } })).has('milestone-10'));
});

test('pushRecent dedups and caps', () => {
  let r: string[] = [];
  for (let i = 0; i < 100; i++) r = pushRecent(r, 'a' + (i % 70));
  assert.ok(r.length <= 60);
  assert.equal(r[r.length - 1], 'a29');
});

test('real writer news: every era/state yields something, no crash', () => {
  const rnd = mulberry32(9);
  for (let era = 0; era <= 5; era++) {
    for (const night of [false, true]) {
      const n = pickNews(snap({ era: era as 0, night }), [], NEWS_ITEMS, rnd);
      assert.ok(n, `era ${era}`);
    }
  }
});

test('route tier tags: tier-porter/trampoline/helicopter only right after a route upgrade', async () => {
  const { activeTags } = await import('../src/core/sys/newsRules.ts');
  const base = { sinceTierSec: 10 };
  assert.ok(activeTags(snap({ ...base, routeTier: 1 })).has('tier-porter'));
  assert.ok(activeTags(snap({ ...base, routeTier: 3, lastTierLine: 'route' })).has('tier-trampoline'));
  assert.ok(activeTags(snap({ ...base, routeTier: 6 })).has('tier-helicopter'));
  assert.ok(!activeTags(snap({ ...base, routeTier: 3, lastTierLine: 'source' })).has('tier-trampoline'));
  assert.ok(!activeTags(snap({ sinceTierSec: 120, routeTier: 3 })).has('tier-trampoline'));
  assert.ok(!activeTags(snap({ ...base, routeTier: 2 })).has('tier-porter'));
});
