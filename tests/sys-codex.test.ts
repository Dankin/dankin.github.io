import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, EGG_COUNT, EGG_IDS, checkAchievements, checkEggs, codexProgress, discoverKind, newCodex, normalizeCodex } from '../src/core/sys/codex.ts';
import type { EggEvent, Snapshot } from '../src/core/sys/types.ts';
import { TAP_TARGETS } from '../src/core/sys/types.ts';
import { shanghai, mulberry32 } from '../src/core/sys/util.ts';
import { EGGS } from '../src/content/eggs.ts';

function snap(over: Partial<Snapshot> = {}): Snapshot {
  return {
    playSec: 100, delivered: 0, progress: 0, sourceTier: 0, routeTier: 0, era: 0, units: 2, shakes: 0, helpers: 0, combo: 0,
    coins: 0, income: 1, targetCost: 10, stockFill: 0, wasted: 0, idleSec: 0, sinceTierSec: 100, bottleneck: 'balanced',
    night: false, season: 0, weather: 'clear', wall: shanghai(Date.UTC(2026, 10, 24, 4)), eventOnScreen: null,
    ordersActive: 0, pestsActive: 0, offerOpen: false, goldSeen: false, hoardRatio: 0, eventsOnScreen: 0, sessionSec: 0, rotTotal: 0,
    milestone: null, sinceEventSec: 999, ordersDone: 0, pestsKilled: 0, offerCount: 0, ...over,
  };
}
const tap = (target: string, at = 0): EggEvent => ({ t: 'tap', target: target as never, at });
const rnd = mulberry32(1);

test('egg ids line up 1:1 with writer content', () => {
  assert.equal(EGG_COUNT, 44);
  assert.deepEqual([...EGG_IDS].sort(), EGGS.map((e) => e.id).sort());
});

test('every tap target used in eggs is a known hotspot', () => {
  assert.ok(TAP_TARGETS.length >= 20);
});

test('eve/paris/snow-white: gated by tier, fire once, unlock kinds', () => {
  const c = newCodex();
  assert.deepEqual(checkEggs(snap(), tap('treetop-fruit'), c, rnd), []);
  const h = checkEggs(snap({ sourceTier: 1 }), tap('treetop-fruit'), c, rnd);
  assert.deepEqual(h.map((x) => x.id), ['eve']);
  assert.ok(c.kinds.forbidden);
  assert.deepEqual(checkEggs(snap({ sourceTier: 1 }), tap('treetop-fruit'), c, rnd), []);
  assert.deepEqual(checkEggs(snap({ sourceTier: 2 }), tap('poison-stall'), c, rnd).map((x) => x.id), ['snow-white']);
  assert.ok(c.kinds.poison);
  assert.deepEqual(checkEggs(snap({ sourceTier: 2 }), tap('summit-gold'), c, rnd).map((x) => x.id), ['paris']);
});

test('newton: first claim + 5th claim', () => {
  const c = newCodex();
  const ev: EggEvent = { t: 'event', kind: 'newton', claimed: true };
  assert.equal(checkEggs(snap(), { t: 'event', kind: 'newton', claimed: false }, c, rnd).length, 0);
  assert.deepEqual(checkEggs(snap(), ev, c, rnd).map((x) => x.id), ['newton']);
  for (let i = 0; i < 3; i++) assert.equal(checkEggs(snap(), ev, c, rnd).length, 0);
  assert.deepEqual(checkEggs(snap(), ev, c, rnd).map((x) => x.id), ['newton-5']);
});

test('daily repeats each new UTC+8 day, streak-7 after 7 consecutive days', () => {
  const c = newCodex();
  const day = (d: number) => snap({ wall: shanghai(Date.UTC(2026, 10, d, 4)) });
  assert.deepEqual(checkEggs(day(1), { t: 'login' }, c, rnd).map((x) => x.id), ['daily']);
  assert.equal(checkEggs(day(1), { t: 'login' }, c, rnd).length, 0, 'same day: nothing');
  let last: string[] = [];
  for (let d = 2; d <= 7; d++) last = checkEggs(day(d), { t: 'login' }, c, rnd).map((x) => x.id);
  assert.deepEqual(last, ['daily', 'streak-7']);
  const again = checkEggs(day(9), { t: 'login' }, c, rnd);
  assert.equal(again[0].id, 'daily');
  assert.equal(again[0].first, false);
  assert.equal(c.eggs.daily.n, 8);
});

test('xmas-eve only on Dec 24 login; xmas-sock needs Dec≥20', () => {
  const c = newCodex();
  const dec = (d: number) => snap({ wall: shanghai(Date.UTC(2026, 11, d, 4)) });
  assert.ok(!checkEggs(dec(23), { t: 'login' }, c, rnd).some((x) => x.id === 'xmas-eve'));
  assert.equal(checkEggs(dec(19), tap('stocking'), c, rnd).length, 0);
  assert.deepEqual(checkEggs(dec(21), tap('stocking'), c, rnd).map((x) => x.id), ['xmas-sock']);
  assert.ok(checkEggs(dec(24), { t: 'login' }, c, rnd).some((x) => x.id === 'xmas-eve'));
});

test('tap-run eggs: apple-of-eye (5 in 2s) resets on slow taps; title-7; phone-pun', () => {
  const c = newCodex();
  const s = snap({ helpers: 1, sourceTier: 1 });
  let ids: string[] = [];
  for (let i = 0; i < 4; i++) ids.push(...checkEggs(s, tap('xu', i * 1), c, rnd).map((x) => x.id)); // 1s apart: too slow? gap ≤ tapGapS
  const c2 = newCodex();
  for (let i = 0; i < 5; i++) ids = checkEggs(s, tap('xu', i * 0.3), c2, rnd).map((x) => x.id);
  assert.deepEqual(ids, ['apple-of-eye']);
  const c3 = newCodex();
  for (let i = 0; i < 6; i++) assert.equal(checkEggs(snap(), tap('title', i), c3, rnd).length, 0);
  assert.deepEqual(checkEggs(snap(), tap('title', 6), c3, rnd).map((x) => x.id), ['title-7']);
});

test('atalanta: two gold taps within window; single tap does not', () => {
  const c = newCodex();
  assert.equal(checkEggs(snap(), { t: 'gold', kind: 'tap', at: 10, since: 1 }, c, rnd).length, 0);
  assert.deepEqual(checkEggs(snap(), { t: 'gold', kind: 'tap', at: 11.5, since: 2 }, c, rnd).map((x) => x.id), ['atalanta']);
});

test('time/idle/away/shake rare eggs', () => {
  const c = newCodex();
  const rnd = () => 0.99; // 屏蔽 snake 的 1/300
  assert.deepEqual(checkEggs(snap(), { t: 'idle', sec: 60 }, c, rnd).map((x) => x.id), ['johnny']);
  assert.deepEqual(checkEggs(snap(), { t: 'away', ms: 9 * 3600e3 }, c, rnd).map((x) => x.id), ['laoxu-sleep']);
  const three = snap({ wall: shanghai(Date.UTC(2026, 10, 24, 19, 30)) }); // 03:30 UTC+8
  assert.ok(checkEggs(three, { t: 'time' }, c, rnd).some((x) => x.id === 'three-am'));
  assert.deepEqual(checkEggs(snap({ eventsOnScreen: 3 }), { t: 'time' }, c, rnd).map((x) => x.id), ['triple-event']);
  assert.deepEqual(checkEggs(snap({ combo: 100 }), { t: 'shake', combo: 100 }, c, rnd).map((x) => x.id), ['money-tree']);
  assert.deepEqual(checkEggs(snap({ shakes: 500 }), { t: 'shake', combo: 3 }, c, rnd).map((x) => x.id), ['shake-500']);
  assert.deepEqual(checkEggs(snap({ progress: 1 }), { t: 'win' }, c, rnd).map((x) => x.id), ['core-82']);
});

test('snake: 1/300 per shake (deterministic rnd)', () => {
  const c = newCodex();
  let n = 0;
  const r = mulberry32(2024);
  const s = snap();
  for (let i = 0; i < 3000 && !c.eggs.snake; i++) {
    n++;
    checkEggs(s, { t: 'shake', combo: 1 }, c, r);
  }
  assert.ok(c.eggs.snake, 'found within 3000 shakes');
  assert.ok(n > 5);
});

test('kimura: 10 minutes without waste (overflow/rot reset)', () => {
  const c = newCodex();
  const s = (t: number, wasted = 0) => snap({ playSec: t, sourceTier: 1, wasted });
  assert.equal(checkEggs(s(300), { t: 'time' }, c, rnd).length, 0);
  assert.equal(checkEggs(s(400, 5), { t: 'time' }, c, rnd).length, 0); // waste resets at 400
  assert.equal(checkEggs(s(900, 5), { t: 'time' }, c, rnd).length, 0);
  assert.deepEqual(checkEggs(s(1000, 5), { t: 'time' }, c, rnd).map((x) => x.id), ['kimura']);
});

test('pie via rot cleaned ×20, core ×7, caterpillar needs worm seen', () => {
  const c = newCodex();
  assert.equal(checkEggs(snap(), { t: 'rot', cleaned: 19 }, c, rnd).length, 0);
  assert.deepEqual(checkEggs(snap(), { t: 'rot', cleaned: 1 }, c, rnd).map((x) => x.id), ['pie']);
  for (let i = 0; i < 6; i++) assert.equal(checkEggs(snap(), tap('seed-core', i), c, rnd).length, 0);
  assert.deepEqual(checkEggs(snap(), tap('seed-core', 7), c, rnd).map((x) => x.id), ['core']);
  assert.equal(checkEggs(snap(), tap('leaf-under'), c, rnd).length, 0);
  discoverKind(c, 'worm', 5);
  assert.deepEqual(checkEggs(snap(), tap('leaf-under'), c, rnd).map((x) => x.id), ['caterpillar']);
});

test('achievements unlock once, codexProgress counts, normalizeCodex tolerates junk', () => {
  const c = newCodex();
  const first = checkAchievements(snap({ shakes: 1 }), c);
  assert.deepEqual(first, ['first-shake']);
  assert.deepEqual(checkAchievements(snap({ shakes: 1 }), c), []);
  assert.ok(ACHIEVEMENTS.length >= 20);
  discoverKind(c, 'fuji', 1);
  const p = codexProgress(c);
  assert.equal(p.kinds.found, 1);
  assert.equal(p.all.total, 15 + 44);
  assert.deepEqual(normalizeCodex(null), newCodex());
  assert.equal(normalizeCodex({ lastLoginDay: 5, kinds: 3 }).lastLoginDay, '');
  assert.equal(normalizeCodex(JSON.parse(JSON.stringify(c))).kinds.fuji?.n, 1);
});

test('route eggs: trampoline-leak (5 fast taps, owns trampoline) and pole-snap (10 taps total, owns porter)', () => {
  const c = newCodex();
  const run = (s: Snapshot, target: string, n: number, dt: number): string[] => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(...checkEggs(s, tap(target, i * dt), c, rnd).map((h) => h.id));
    return out;
  };
  assert.deepEqual(run(snap({ routeTier: 2 }), 'trampoline', 5, 0.5), [], '没有蹦床不触发');
  assert.deepEqual(run(snap({ routeTier: 3 }), 'trampoline', 5, 3), [], '点太慢不触发');
  assert.deepEqual(run(snap({ routeTier: 3 }), 'trampoline', 5, 0.5), ['trampoline-leak']);
  assert.deepEqual(run(snap({ routeTier: 0 }), 'porter', 10, 1), [], '没有挑担工不触发');
  const ids = run(snap({ routeTier: 1 }), 'porter', 10, 1);
  assert.deepEqual(ids, ['pole-snap']);
});
