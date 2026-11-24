import test from 'node:test';
import assert from 'node:assert/strict';
import { claimOrder, newSys, normalizeSys, offerSys, onEvent, onShakeRoll, snapshotOf, tapPestSys, tickSys, type SysInput } from '../src/core/sys/state.ts';
import { mulberry32 } from '../src/core/sys/util.ts';
import { bagTotal } from '../src/core/sys/varieties.ts';

const inp = (o: Partial<SysInput> = {}): SysInput => ({ playSec: 0, era: 0, sourceTier: 0, routeTier: 0, coins: 0, income: 5, targetCost: 100, coldStorage: false, progress: 0, ...o });

test('newSys / normalizeSys round-trip through JSON and tolerate junk', () => {
  const s = newSys();
  const rnd = mulberry32(1);
  for (let i = 0; i < 200; i++) onShakeRoll(s, { playSec: 10, era: 1 }, rnd);
  assert.ok(bagTotal(s.bag) > 0);
  const back = normalizeSys(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.bag, s.bag);
  assert.deepEqual(back.codex, s.codex);
  assert.deepEqual(normalizeSys(undefined), newSys());
  assert.deepEqual(normalizeSys({ bag: 3, orders: 'x', pests: null }), newSys());
});

test('tickSys is deterministic and bounded; coinsLoss never exceeds coins', () => {
  const run = () => {
    const s = newSys();
    const rnd = mulberry32(77);
    let loss = 0;
    for (let t = 0; t < 1800; t += 0.25) {
      const coins = 5000;
      const r = tickSys(s, 0.25, inp({ playSec: t, era: 2, coins, income: 20, targetCost: 100 }), rnd);
      assert.ok(r.coinsLoss >= 0 && r.coinsLoss <= coins);
      loss += r.coinsLoss;
    }
    return { loss, orders: s.orders.seq, rot: s.rot.total, bag: bagTotal(s.bag) };
  };
  const a = run();
  assert.deepEqual(a, run());
  assert.ok(a.loss > 0 && a.orders > 3 && a.bag > 0);
});

test('no loss without hoarding or pests when poor', () => {
  const s = newSys();
  const rnd = mulberry32(3);
  let loss = 0;
  for (let t = 0; t < 120; t += 0.25) loss += tickSys(s, 0.25, inp({ playSec: t, coins: 50, income: 5 }), rnd).coinsLoss;
  assert.equal(loss, 0);
});

test('offer closed until both lines tier 3; open applies 15% discount', () => {
  const s = newSys();
  assert.equal(offerSys(s, { sourceTier: 3, routeTier: 4 }, 1000, 1e6, 1), null);
  const r = offerSys(s, { sourceTier: 3, routeTier: 5 }, 1000, 1e6, 1)!;
  assert.ok(r && Math.abs(r.apples - 150) < 1e-6);
});

test('order claim + pest tap pay reward only on success', () => {
  const s = newSys();
  assert.equal(claimOrder(s, 999, 10).ok, false);
  assert.equal(tapPestSys(s, 999, 10).r, null);
});

test('snapshotOf fills derived fields; onEvent fires eggs and achievements', () => {
  const s = newSys();
  const raw = {
    playSec: 100, delivered: 0, progress: 0, sourceTier: 1, routeTier: 2, units: 3, shakes: 1, helperLevel: 0, combo: 0, coins: 5, income: 1,
    targetCost: 10, stockFill: 0, wasted: 0, idleSec: 0, sinceTierSec: 5, bottleneck: 'balanced' as const, eventOnScreen: null, eventsOnScreen: 0,
    sessionSec: 5, sinceEventSec: 999, nowMs: Date.UTC(2026, 10, 24, 4),
  };
  const snap = snapshotOf(s, raw);
  assert.equal(snap.era, 1);
  assert.equal(snap.wall.d, 24);
  assert.equal(snap.offerOpen, false);
  const out = onEvent(s, snap, { t: 'login' }, mulberry32(1));
  assert.ok(out.eggs.some((e) => e.id === 'daily'));
  assert.ok(out.ach.includes('first-shake'));
});
