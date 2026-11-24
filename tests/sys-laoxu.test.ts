import assert from 'node:assert/strict';
import test from 'node:test';
import { LAOXU } from '../src/core/sys/constants.ts';
import { laoxuAct, laoxuView, newLaoxu, normalizeLaoxu, stepLaoxu, takeCrit, tapLaoxu, type LaoxuCtx, type LaoxuState } from '../src/core/sys/laoxu.ts';
import { mulberry32 } from '../src/core/sys/util.ts';
import { laoxuCrit, newSys, tapLaoxuSys, tickSys } from '../src/core/sys/state.ts';
import { HELPER, helperOldTotal } from '../src/core/content.ts';
import { helperCost, helperRate } from '../src/core/game.ts';
import { newState } from '../src/core/state.ts';

const ctx = (over: Partial<LaoxuCtx> = {}): LaoxuCtx => ({ level: 6, idleSec: 0, night: false, visitor: false, ...over });
/** 推进 sec 秒(步长 0.25),返回事件 */
function run(st: LaoxuState, sec: number, rnd: () => number, c: LaoxuCtx) {
  const evs: string[] = [];
  let actSum = 0;
  const n = Math.round(sec / 0.25);
  for (let i = 0; i < n; i++) {
    const r = stepLaoxu(st, 0.25, rnd, c);
    actSum += r.act;
    for (const e of r.events) evs.push(e.t);
  }
  return { evs, avgAct: actSum / n };
}

test('lv<6 never slacks; lv6/7 slack on a cycle and come back fresh with a crit', () => {
  const st5 = newLaoxu();
  run(st5, 600, mulberry32(1), ctx({ level: 5 }));
  assert.equal(st5.slacks, 0);
  const st = newLaoxu();
  const rnd = mulberry32(2);
  const { evs, avgAct } = run(st, 600, rnd, ctx({ level: 6 }));
  assert.ok(st.slacks >= 4, `slacks ${st.slacks}`);
  assert.ok(evs.includes('crit-ready'));
  assert.ok(avgAct < 1 && avgAct > 0.8, `avgAct ${avgAct}`);
});

test('crit is x3 once and expires', () => {
  const st = newLaoxu();
  const rnd = mulberry32(3);
  for (let i = 0; i < 4000 && st.critT <= 0; i++) stepLaoxu(st, 0.25, rnd, ctx());
  assert.ok(st.critT > 0, 'got a crit window');
  assert.equal(laoxuView(st).crit, true);
  assert.equal(takeCrit(st), LAOXU.critMul);
  assert.equal(takeCrit(st), 1);
  assert.equal(laoxuView(st).crit, false);
  // 不用就过期
  const st2 = newLaoxu();
  for (let i = 0; i < 4000 && st2.critT <= 0; i++) stepLaoxu(st2, 0.25, rnd, ctx());
  run(st2, LAOXU.critWindowS + 5, rnd, ctx({ level: 5 }));
  assert.equal(takeCrit(st2), 1);
});

test('nap at night / long idle, watch on visitor; output factors', () => {
  const a = newLaoxu();
  run(a, 3, mulberry32(4), ctx({ night: true }));
  assert.equal(laoxuView(a).state, 'nap');
  assert.equal(laoxuAct(a), LAOXU.napMul);
  const b = newLaoxu();
  run(b, 3, mulberry32(4), ctx({ idleSec: LAOXU.napIdleS + 1 }));
  assert.equal(laoxuView(b).state, 'nap');
  const c = newLaoxu();
  run(c, 3, mulberry32(4), ctx({ visitor: true, night: true }));
  assert.equal(laoxuView(c).state, 'watch', 'watch beats nap');
  const d = newLaoxu();
  run(d, 2, mulberry32(4), ctx({ level: 3 }));
  assert.equal(laoxuView(d).state, 'work');
  assert.equal(laoxuAct(d), 1);
});

test('tap: slack → wake or soda; nap → wake; cooldown prevents farming', () => {
  const st = newLaoxu();
  const rnd = mulberry32(5);
  for (let i = 0; i < 4000 && st.mode !== 'slack'; i++) stepLaoxu(st, 0.25, rnd, ctx());
  assert.equal(st.mode, 'slack');
  const r = tapLaoxu(st, () => 0.99);
  assert.equal(r.r, 'wake');
  assert.equal(st.mode, 'work');
  // soda
  const s2 = newLaoxu();
  for (let i = 0; i < 4000 && s2.mode !== 'slack'; i++) stepLaoxu(s2, 0.25, rnd, ctx());
  const r2 = tapLaoxu(s2, () => 0);
  assert.equal(r2.r, 'soda');
  assert.ok(r2.rewardS > 0);
  const n = newLaoxu();
  run(n, 2, rnd, ctx({ night: true }));
  assert.equal(tapLaoxu(n, () => 0.5).r, 'wake');
  // 刚被叫醒:冷却内再点不再给奖励
  const r3 = tapLaoxu(n, () => 0);
  assert.notEqual(r3.r, 'soda');
});

test('normalizeLaoxu tolerates junk; big dt resets to work', () => {
  assert.deepEqual(normalizeLaoxu(null), newLaoxu());
  const st = normalizeLaoxu({ mode: 'bogus', critT: -5, slacks: 'x' });
  assert.equal(st.mode, 'work');
  assert.equal(st.critT, 0);
  const s = newLaoxu();
  s.mode = 'slack';
  stepLaoxu(s, 3600, mulberry32(1), ctx());
  assert.equal(s.mode, 'work');
});

test('sys wiring: tickSys gives helperAct, laoxuCrit/tapLaoxuSys work through SysState', () => {
  const sys = newSys();
  const rnd = mulberry32(6);
  let sawLow = false;
  for (let i = 0; i < 4000; i++) {
    const tk = tickSys(sys, 0.25, { playSec: i * 0.25, era: 4, sourceTier: 2, routeTier: 4, coins: 1000, income: 10, targetCost: 5000, coldStorage: false, progress: 0.1, helperLevel: 6, idleSec: 0 }, rnd);
    if (tk.helperAct === 0) sawLow = true;
  }
  assert.ok(sawLow, 'slack gives 0 output');
  assert.ok(laoxuCrit(sys) >= 1);
  assert.ok(tapLaoxuSys(sys, 10, rnd).reward >= 0);
});

test('helper economy: level costs sum to the old curve; rate follows equiv x helperAct', () => {
  const s = newState(1);
  s.source.tier = 1;
  let total = 0;
  for (let lv = 0; lv < HELPER.max; lv++) {
    s.helperLevel = lv;
    total += helperCost(s)!;
  }
  assert.equal(total, helperOldTotal(HELPER.equiv[HELPER.max]));
  s.helperLevel = HELPER.max;
  assert.equal(helperCost(s), null);
  const m = { auto: 1 };
  s.helperLevel = 4;
  assert.equal(helperRate(s, m), HELPER.equiv[4] * HELPER.rate);
  assert.equal(helperRate({ helperLevel: 4, helperAct: 0 }, m), 0);
  assert.equal(helperRate({ helperLevel: 0, helperAct: 1 }, m), 0);
});
