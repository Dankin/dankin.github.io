import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLE_KINDS, VARIETIES, bagAdd, bagTotal, expectedValue, heal, pileMix, rollApple, type AppleCtx } from '../src/core/sys/varieties.ts';
import { mulberry32 } from '../src/core/sys/util.ts';
import { appleCtxAt, seasonAt, seasonValueMean } from '../src/core/sys/season.ts';

test('≥15 varieties incl. specials', () => {
  assert.ok(APPLE_KINDS.length >= 15);
  for (const k of ['fuji', 'goldenDel', 'granny', 'golden', 'delicious', 'pinkLady', 'redStreak', 'purple', 'silver', 'worm', 'caramel', 'giant', 'kent', 'poison', 'forbidden'])
    assert.ok(k in VARIETIES, k);
});

test('expected value is exactly normalised to 1 in every context', () => {
  for (let era = 0; era <= 5; era++)
    for (let season = 0; season < 4; season++)
      for (const night of [false, true]) {
        const ctx: AppleCtx = { era, season, night };
        assert.ok(Math.abs(expectedValue(ctx) - 1) < 1e-9, JSON.stringify(ctx));
      }
});

test('Monte Carlo mean of rollApple ≈ 1 (income neutral)', () => {
  for (const era of [0, 2, 5]) {
    const rnd = mulberry32(42 + era);
    const ctx = appleCtxAt(100, era);
    let sum = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) sum += rollApple(rnd, ctx).value;
    const mean = sum / N;
    assert.ok(Math.abs(mean - 1) < 0.04, `era ${era} mean ${mean}`);
  }
});

test('rollApple is deterministic for a seeded rnd', () => {
  const a = Array.from({ length: 50 }, ((r) => () => rollApple(r, { era: 3 }))(mulberry32(7)));
  const b = Array.from({ length: 50 }, ((r) => () => rollApple(r, { era: 3 }))(mulberry32(7)));
  assert.deepEqual(a, b);
});

test('era gates varieties; poison never stocks; forced kent', () => {
  const rnd = mulberry32(1);
  for (let i = 0; i < 3000; i++) {
    const a = rollApple(rnd, { era: 0 });
    assert.ok(VARIETIES[a.kind].minEra <= 0 || a.kind === 'worm', a.kind);
  }
  const k = rollApple(rnd, { era: 0, force: 'kent' });
  assert.equal(k.kind, 'kent');
  assert.equal(rollApple(rnd, { era: 0, force: 'poison' }).noStock, true);
  assert.equal(rollApple(rnd, { era: 0, force: 'poison' }).value, 0);
});

test('wormy apples are worth less and heal back up', () => {
  const rnd = mulberry32(3);
  let w = null;
  for (let i = 0; i < 5000 && !w; i++) {
    const a = rollApple(rnd, { era: 1 });
    if (a.state === 'wormy') w = a;
  }
  assert.ok(w, 'a wormy apple appears');
  const h = heal(w!, { era: 1 });
  assert.ok(h.gain > 0);
  assert.equal(h.apple.state === 'wormy', false);
  assert.equal(heal(h.apple, { era: 1 }).gain, 0);
});

test('bag caps per kind and skips noStock', () => {
  const bag = {};
  assert.equal(bagAdd(bag, { kind: 'poison', noStock: true }), false);
  for (let i = 0; i < 100; i++) bagAdd(bag, { kind: 'fuji', noStock: false });
  assert.ok(bagTotal(bag) <= 30);
});

test('pileMix shares sum to ~1', () => {
  const m = pileMix({ era: 3 });
  const s = m.reduce((a, x) => a + x.share, 0);
  assert.ok(s > 0.95 && s < 1.05, String(s));
});

test('season: four-season price mean = 1, links to worldAt', () => {
  assert.ok(Math.abs(seasonValueMean() - 1) < 1e-9);
  const s0 = seasonAt(10);
  assert.equal(s0.season, 0);
  assert.equal(seasonAt(300 * 1 + 10).season, 1);
  assert.equal(seasonAt(300 * 4 + 10).season, 0);
  assert.ok(seasonAt(300 * 1 + 10).pest > seasonAt(300 * 3 + 10).pest, 'summer bugs > winter bugs');
});

test('v6 traits: golden glow, granny fastFall, redStreak bounce, giant quake, worm rollAway, poison smoke', async () => {
  const { traitOf, fxOf, rollApple, TRAITS, TRAIT_FX } = await import('../src/core/sys/varieties.ts');
  assert.equal(traitOf('golden'), 'glow');
  assert.equal(traitOf('granny'), 'fastFall');
  assert.equal(traitOf('redStreak'), 'bounce');
  assert.equal(traitOf('giant'), 'quake');
  assert.equal(traitOf('worm', 'wormy'), 'rollAway');
  assert.equal(traitOf('fuji', 'wormy'), 'rollAway');
  assert.equal(traitOf('poison'), 'smoke');
  assert.equal(traitOf('fuji'), null);
  assert.ok(fxOf('granny').fallMul < 1 && fxOf('redStreak').bounces > 0 && fxOf('giant').quake > 0);
  assert.equal(fxOf('fuji').sfx, 'apple-land');
  assert.equal(Object.keys(TRAIT_FX).length, TRAITS.length);
  assert.equal(rollApple(() => 0.5, { era: 3, force: 'golden' }).trait, 'glow');
});
