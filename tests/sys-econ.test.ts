import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/core/sys/util.ts';
import { ORDER, PEST, OFFER, DECAY } from '../src/core/sys/constants.ts';
import { dismissOrder, fulfillOrder, newOrders, orderReward, tickOrders, canFulfill } from '../src/core/sys/orders.ts';
import { newPests, tapPest, tickPests, killReward } from '../src/core/sys/pests.ts';
import { cleanRot, decayLimit, decayStep, newRot } from '../src/core/sys/decay.ts';
import { doOffer, newOffer, offerApples, offerOpen } from '../src/core/sys/offer.ts';

test('orders: none before unlockSec, first order right after, no penalty on expiry', () => {
  const os = newOrders();
  const rnd = mulberry32(5);
  assert.equal(tickOrders(os, ORDER.unlockSec - 1, 1, rnd).length, 0);
  const ev = tickOrders(os, ORDER.unlockSec, 1, rnd);
  assert.equal(ev[0].t, 'new');
  assert.equal(os.list.length, 1);
  const o = os.list[0];
  const gone = tickOrders(os, o.expiresAt + 0.1, 1, rnd);
  assert.ok(gone.some((e) => e.t === 'expire'));
  assert.equal(os.expired >= 1, true);
  assert.equal(os.rewardTotal, 0);
});

test('orders: active cap per era, fulfil consumes bag and pays ≥ floor', () => {
  const os = newOrders();
  const rnd = mulberry32(9);
  let t = ORDER.unlockSec;
  for (let i = 0; i < 40; i++) {
    tickOrders(os, t, 0, rnd);
    t += 5;
    assert.ok(os.list.length <= ORDER.maxActive[0]);
    if (os.list.length && os.list[0].expiresAt - t < 10) os.list.splice(0, 1);
  }
  const os2 = newOrders();
  tickOrders(os2, ORDER.unlockSec, 2, rnd);
  const o = os2.list[0];
  const bag = o.want === 'any' ? { fuji: 40 } : { [o.want]: o.qty + 1 };
  assert.ok(canFulfill(bag, o));
  const r = fulfillOrder(os2, bag, o.id, 10);
  assert.ok(r.ok && r.reward >= ORDER.floorCoins);
  assert.equal(os2.list.length, 0);
  assert.equal(fulfillOrder(os2, bag, o.id, 10).ok, false);
  assert.equal(orderReward(o, 0), ORDER.floorCoins);
});

test('orders: not enough fruit → fail without consuming; dismiss is free', () => {
  const os = newOrders();
  tickOrders(os, ORDER.unlockSec, 1, mulberry32(2));
  const o = os.list[0];
  const bag = { fuji: 0 };
  const r = fulfillOrder(os, bag, o.id, 5);
  assert.equal(r.ok, false);
  assert.equal(os.list.length, 1);
  assert.equal(dismissOrder(os, o.id), true);
  assert.equal(os.list.length, 0);
});

test('orders reward share stays ≤3% of income over a long run', () => {
  // 订单平均每 ~105s 出一张,2.5~5 秒收入 → 约 2.4%..4.8%/0.25rush 混合,上限靠 floor 无关;
  const avgRewardSec = (1 - ORDER.rushP) * ORDER.rewardSec + ORDER.rushP * ORDER.rushRewardSec;
  const avgGap = (ORDER.gapS[0] + ORDER.gapS[1]) / 2;
  assert.ok(avgRewardSec / avgGap <= 0.03, String(avgRewardSec / avgGap));
});

test('pests: first wave at unlock, bite is bounded and never fatal', () => {
  const ps = newPests();
  const rnd = mulberry32(11);
  let stock = 1000;
  let t = PEST.unlockSec - 1;
  assert.equal(tickPests(ps, 0.25, { playSec: t, era: 5, rate: 1, stock }, rnd).length, 0);
  const evs = [];
  for (let i = 0; i < 400; i++) {
    t += 0.25;
    const ev = tickPests(ps, 0.25, { playSec: t, era: 5, rate: 1, stock }, rnd);
    for (const e of ev) {
      evs.push(e);
      if (e.t === 'bite') stock -= e.lost;
    }
  }
  assert.ok(evs.some((e) => e.t === 'wave'));
  assert.ok(stock > 0 && stock >= 1000 * 0.9, `stock=${stock}`);
  assert.ok(ps.waveLost <= 1000 * PEST.waveCapFrac + 1e-9);
});

test('pests: tap kills; empty stock loses nothing; offline dt clears swarm', () => {
  const ps = newPests();
  const rnd = mulberry32(13);
  tickPests(ps, 0.25, { playSec: PEST.unlockSec, era: 0, rate: 1, stock: 0 }, rnd);
  assert.ok(ps.list.length >= 1);
  const id = ps.list[0].id;
  let r = tapPest(ps, id);
  while (r === 'hit') r = tapPest(ps, id);
  assert.equal(r, 'kill');
  assert.equal(ps.killed, 1);
  assert.equal(tapPest(ps, 99999), null);
  for (let i = 0; i < 100; i++) tickPests(ps, 0.25, { playSec: PEST.unlockSec + i * 0.25, era: 0, rate: 1, stock: 0 }, rnd);
  assert.equal(ps.lost, 0);
  tickPests(ps, 600, { playSec: 9999, era: 0, rate: 1, stock: 100 }, rnd);
  assert.equal(ps.list.length, 0);
  assert.ok(killReward(100) > 0);
});

test('decay: below limit nothing rots; above limit excess decays at rate; cold storage immune', () => {
  const lim = decayLimit(100, 1); // max(150, 300)
  assert.equal(lim, 300);
  const rot = newRot();
  assert.equal(decayStep(rot, 250, lim, 1).rotted, 0);
  const r = decayStep(rot, 1300, lim, 4);
  const expectKeep = 1000 * Math.exp(-DECAY.rate * 4);
  assert.ok(Math.abs(r.coins - (300 + expectKeep)) < 1e-6);
  assert.ok(r.rotted > 0 && rot.total === r.rotted);
  assert.equal(decayStep(newRot(), 1300, lim, 4, true).rotted, 0);
  assert.equal(decayStep(newRot(), 1300, lim, 600).rotted, 0, 'offline dt skips');
});

test('decay: rot apples spawn, capped, and are cleanable', () => {
  const rot = newRot();
  let coins = 1e6;
  for (let i = 0; i < 2000; i++) coins = decayStep(rot, coins, 1000, 1).coins;
  assert.ok(rot.visual > 0 && rot.visual <= DECAY.rotMax);
  const n = cleanRot(rot);
  assert.ok(n > 0 && rot.visual === 0 && rot.cleaned === n);
});

test('offer: opens at both tiers ≥3; 15% discount', () => {
  assert.equal(offerOpen(3, 2), false);
  assert.equal(offerOpen(3, 3), true);
  assert.equal(offerOpen(5, 5), true);
  assert.ok(Math.abs(offerApples(1000, 2) - 75) < 1e-9);
  assert.equal(OFFER.discount, 0.15);
  const os = newOffer();
  const r = doOffer(os, 500, 1000, 2);
  assert.equal(r.spent, 500);
  assert.ok(Math.abs(r.apples - 37.5) < 1e-9);
  assert.equal(os.count, 1);
  const r2 = doOffer(os, 5000, 1000, 2);
  assert.equal(r2.spent, 1000, 'cannot offer more than held');
});
