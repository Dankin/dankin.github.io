import assert from 'node:assert/strict';
import test from 'node:test';
import { ROUTE_IDS, ROUTE_ERA, ROUTE_TIERS, SOURCE_TIERS, TIER_COUNTS } from '../src/core/content.ts';
import { migrateRouteTiers, migrateV6Redesign, ROUTE_OLD_TO_NEW, ROUTE_V6_TO_V7, SOURCE_V6_TO_V7 } from '../src/core/sys/migrate.ts';

test('route tiers: 8 entries, ids/era map aligned with ROUTE_TIERS', () => {
  assert.equal(ROUTE_TIERS.length, 8);
  assert.equal(ROUTE_IDS.length, 8);
  assert.equal(ROUTE_ERA.length, 8);
  assert.equal(SOURCE_TIERS.length, 5);
  assert.deepEqual(TIER_COUNTS, { source: 5, route: 8 });
  for (let i = 1; i < 8; i++) {
    assert.ok(ROUTE_TIERS[i].cap > ROUTE_TIERS[i - 1].cap, 'cap increases');
    assert.ok(ROUTE_TIERS[i].tierCost > ROUTE_TIERS[i - 1].tierCost, 'tierCost increases');
    assert.ok(ROUTE_ERA[i] >= ROUTE_ERA[i - 1]);
  }
  assert.deepEqual(ROUTE_IDS, ['basket', 'porter', 'cart', 'truck', 'ship', 'helicopter', 'plane', 'portal']);
});

test('migrateRouteTiers maps old 6-tier route to 9 tiers', () => {
  const old = {
    route: { tier: 3, units: [5, 4, 3, 2, 0, 0], branch: [-1, 0, 1, 0, -1, -1], ext: [0, 1, 0, 2, 0, 0] },
    vehicles: [{ tier: 0, w: 1 }, { tier: 3, w: 2 }],
    tierTimes: { source: [], route: [10, 20, 30] },
  };
  const s = migrateRouteTiers(old);
  assert.equal(s.route.tier, 5);
  assert.deepEqual(s.route.units, [5, 0, 4, 0, 3, 2, 0, 0, 0]);
  assert.deepEqual(s.route.branch, [-1, -1, 0, -1, 1, 0, -1, -1, -1]);
  assert.deepEqual(s.route.ext, [0, 0, 1, 0, 0, 2, 0, 0, 0]);
  assert.deepEqual(s.vehicles.map((v: { tier: number }) => v.tier), [0, 5]);
  assert.equal(s.tierTimes.route[1], 10); // cart(2) 升档时间存在 [tier-1]
  assert.equal(s.tierTimes.route[3], 20);
  assert.equal(s.tierTimes.route[4], 30);
  // 幂等:已是 9 档的不再动
  assert.equal(migrateRouteTiers(s), s);
});

test('migrateV6Redesign: 6→5 source tiers, 9→8 route tiers (蹦床并入小推车), gates dropped', () => {
  const old: any = {
    gates: ['wash', null, null], gatesUnlocked: ['wash', 'wax'],
    source: { tier: 4, units: [3, 4, 5, 6, 7, 0], branch: [-1, 0, 1, 0, 1, -1], ext: [0, 0, 1, 0, 2, 0] },
    route: { tier: 3, units: [3, 3, 3, 9, 0, 0, 0, 0, 0], branch: [-1, -1, 0, 1, -1, -1, -1, -1, -1], ext: [0, 0, 0, 1, 0, 0, 0, 0, 0] },
    vehicles: [{ tier: 0, w: 1 }, { tier: 3, w: 9 }, { tier: 4, w: 1 }],
    tierTimes: { source: [10, 20, 30, 40, 50], route: [11, 22, 33, 44, 55, 66, 77, 88] },
  };
  const s = migrateV6Redesign(old);
  assert.ok(!('gates' in s) && !('gatesUnlocked' in s));
  assert.equal(s.source.tier, 3, '果星并入云树');
  assert.equal(s.source.units.length, 5);
  assert.deepEqual(s.source.units, [3, 4, 5, 7, 0], '合并档取当前所在旧档(果星)的数据');
  assert.equal(s.source.branch[3], 1);
  assert.equal(s.source.ext[3], 2);
  assert.equal(s.route.tier, 2, '蹦床 → 小推车');
  assert.equal(s.route.units.length, 8);
  assert.deepEqual(s.route.units.slice(0, 4), [3, 3, 9, 0]);
  assert.deepEqual(s.vehicles.map((v: { tier: number }) => v.tier), [0, 2, 3]);
  assert.deepEqual(s.tierTimes.source, [10, 20, 30, 50], '升到 1/2/3 档的时刻,并入的旧档不重复记');
  assert.deepEqual(s.tierTimes.route.slice(0, 2), [11, 22]);
  assert.deepEqual(SOURCE_V6_TO_V7.length, 6);
  assert.deepEqual(ROUTE_V6_TO_V7.length, 9);
});
