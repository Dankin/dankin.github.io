import assert from 'node:assert/strict';
import test from 'node:test';
import { ROUTE_IDS, ROUTE_ERA, ROUTE_TIERS, SOURCE_TIERS, TIER_COUNTS } from '../src/core/content.ts';
import { migrateRouteTiers, ROUTE_OLD_TO_NEW } from '../src/core/sys/migrate.ts';

test('route tiers: 9 entries, ids/era map aligned with ROUTE_TIERS', () => {
  assert.equal(ROUTE_TIERS.length, 9);
  assert.equal(ROUTE_IDS.length, 9);
  assert.equal(ROUTE_ERA.length, 9);
  assert.deepEqual(TIER_COUNTS, { source: SOURCE_TIERS.length, route: 9 });
  for (let i = 1; i < 9; i++) {
    assert.ok(ROUTE_TIERS[i].cap > ROUTE_TIERS[i - 1].cap, 'cap increases');
    assert.ok(ROUTE_TIERS[i].tierCost > ROUTE_TIERS[i - 1].tierCost, 'tierCost increases');
    assert.ok(ROUTE_ERA[i] >= ROUTE_ERA[i - 1]);
  }
  assert.deepEqual(ROUTE_OLD_TO_NEW.map((n) => ROUTE_IDS[n]), ['basket', 'cart', 'truck', 'ship', 'plane', 'portal']);
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
