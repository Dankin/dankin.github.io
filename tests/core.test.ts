import assert from 'node:assert/strict';
import test from 'node:test';
import { GOAL, OFFLINE_CAP_MS, SAVE_BAK_KEY, SAVE_KEY, SAVE_VERSION } from '../src/core/constants.ts';
import { GATES, HELPER, SHAKE, GATE_SLOTS, MAX_CONVOYS, RED_EXP, ROUTE_TIERS, SOURCE_TIERS, TIER_START_UNITS, UNIT_MAX, EXPAND, describeEffect } from '../src/core/content.ts';
import { EVENT_GAP_S, EVENT_GAP_SHARE, EVENT_MAX_S, EVENT_REWARD_S, NEWTON_S, claimEvent, nextEventGap, pickEvent } from '../src/core/events.ts';
import {
  appleValue, baseProduce, buyHelper, buyUnit, canBuyHelper, canBuyUnit, canUpgradeTier, click, comboMult, era, helperCost, shake, fleetView, isWon, mods,
  buyExpand, canExpand, expandCost, nextBranches, nextHints, preview, progress, setGate, settle, stockFill, stockMax, throughput, tick, tierCost, unitCost,
  upgradeTier,
} from '../src/core/game.ts';
import { GIFT_DATE, giftOpen } from '../src/core/gift.ts';
import { AMBIENT_TEXT, DAILY_NEWS, ERA_SWITCH_TOAST, NEWTON_STAGES, SEALED, awayLine } from '../src/core/copy.ts';
import { exportSave, fnv, importSave, load, parse, save, serialize, storageWritable, type KV } from '../src/core/save.ts';
import { newState, type State } from '../src/core/state.ts';
import { DAY_S, SEASON_NAMES, worldAt } from '../src/core/world.ts';
import { equiv, fmt } from '../src/ui/format.ts';

const mem = (): KV & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};
const fresh = () => newState(1000);
/** 给足钱并直接升到指定档(绕过价格) */
function atTiers(src: number, rt: number): State {
  const s = fresh();
  for (const [line, n] of [['source', src], ['route', rt]] as const) {
    for (let i = 0; i < n; i++) {
      s.coins = 1e18;
      assert.ok(upgradeTier(s, line, 0));
    }
  }
  s.coins = 0;
  return s;
}

test('初始状态', () => {
  const s = fresh();
  assert.equal(s.version, SAVE_VERSION);
  assert.deepEqual(s.source.units, [1, 0, 0, 0, 0, 0]);
  assert.equal(s.vehicles.length, 1);
  assert.equal(s.vehicles[0].tier, 0);
  assert.equal(s.gates.length, GATE_SLOTS);
  assert.ok(s.gates.every((g) => g === null));
  assert.equal(throughput(s).produce, 1);
});

test('买单位:扣钱、涨价、不够钱不成', () => {
  const s = fresh();
  assert.equal(buyUnit(s, 'source'), false);
  assert.equal(canBuyUnit(s, 'source'), false);
  s.coins = 1e6;
  const c1 = unitCost(s, 'source');
  assert.equal(c1, SOURCE_TIERS[0].baseCost);
  assert.ok(buyUnit(s, 'source'));
  assert.equal(s.coins, 1e6 - c1);
  assert.equal(s.source.units[0], 2);
  const c2 = unitCost(s, 'source');
  assert.equal(c2, Math.floor(SOURCE_TIERS[0].baseCost * SOURCE_TIERS[0].growth));
  assert.ok(c2 > c1);
  assert.equal(buyUnit(s, 'source', 3), false, '没到的档不能买');
});

test('买车:每买一辆多一辆;单位数封顶 UNIT_MAX', () => {
  const s = fresh();
  s.coins = 1e30;
  for (let i = 0; i < UNIT_MAX + 5; i++) buyUnit(s, 'route');
  assert.equal(s.route.units[0], UNIT_MAX);
  const mine = s.vehicles.filter((v) => v.tier === 0);
  assert.equal(mine.length, UNIT_MAX);
  assert.ok(MAX_CONVOYS >= UNIT_MAX);
  assert.equal(mine.reduce((a, v) => a + v.w, 0), s.route.units[0]);
  assert.equal(fleetView(s)[0].count, s.route.units[0]);
});

test('升档:要钱、要选分支、送起步单位、记录时间、解锁道具', () => {
  const s = fresh();
  assert.equal(canUpgradeTier(s, 'source'), false);
  assert.equal(upgradeTier(s, 'source', 0), null, '没钱');
  s.coins = tierCost(s, 'source')! - 1;
  assert.equal(upgradeTier(s, 'source', 0), null);
  s.coins = 1e18;
  assert.equal(upgradeTier(s, 'source', 2 as 0), null, '分支只能是 0/1');
  const br = nextBranches(s, 'source')!;
  assert.equal(br.length, 2);
  s.playSec = 42;
  const before = s.coins;
  const r = upgradeTier(s, 'source', 1)!;
  assert.ok(r);
  assert.equal(r.tier, 1);
  assert.equal(s.source.tier, 1);
  assert.equal(s.source.branch[1], 1);
  assert.equal(s.source.units[1], TIER_START_UNITS);
  assert.equal(s.coins, before - SOURCE_TIERS[1].tierCost);
  assert.equal(s.tierTimes.source[0], 42);
  // 分支效果生效
  assert.deepEqual(mods(s).value, br[1].effect.value ?? 1);
  // 时代(产出档 + ROUTE_ERA[运输档])到 2 解锁第四个道具:挑扁担工(ROUTE_ERA 0)不算,小推车(1)才算
  assert.ok(!s.gatesUnlocked.includes('pack'));
  upgradeTier(s, 'route', 0)!;
  assert.equal(s.vehicles.filter((v) => v.tier === 1).length, TIER_START_UNITS, '升运输档送起步车辆');
  assert.ok(!s.gatesUnlocked.includes('pack'));
  const r2 = upgradeTier(s, 'route', 0)!;
  assert.ok(r2.newGates.includes('pack'));
  assert.ok(s.gatesUnlocked.includes('pack'));
});

test('升到最高档后不能再升', () => {
  const s = atTiers(5, 8);
  s.coins = 1e30;
  assert.equal(tierCost(s, 'source'), null);
  assert.equal(nextBranches(s, 'route'), null);
  assert.equal(upgradeTier(s, 'source', 0), null);
  assert.equal(era(s), 10);
  assert.equal(s.gatesUnlocked.length, GATES.length);
});

test('吞吐 = min(产出, 运力),瓶颈标签', () => {
  const s = fresh();
  s.source.units[0] = 20; // 产出 20,运力 5/5=1
  let t = throughput(s);
  assert.equal(t.produce, 20);
  assert.equal(t.carry, ROUTE_TIERS[0].cap / ROUTE_TIERS[0].trip);
  assert.equal(t.flow, t.carry);
  assert.equal(t.bottleneck, 'carry');
  s.route.units[0] = 100;
  t = throughput(s);
  assert.equal(t.flow, t.produce);
  assert.equal(t.bottleneck, 'produce');
  s.route.units[0] = 17;
  assert.equal(throughput(s).bottleneck, 'balanced');
  assert.equal(t.income, t.flow * t.value);
});

test('tick:送达速度≈吞吐,果钱 = 送达 × 价值', () => {
  const s = atTiers(1, 1);
  s.source.units[0] = 0;
  s.source.units[1] = 4;
  s.route.units[0] = 0;
  s.route.units[1] = 0;
  s.vehicles = [];
  for (let i = 0; i < 6; i++) s.vehicles.push({ tier: 1, w: 1, phase: 0, load: 0 });
  s.route.units[1] = 6;
  const th = throughput(s);
  tick(s, 60);
  const d0 = s.delivered;
  const c0 = s.coins;
  tick(s, 120 - 1e-9);
  const rate = (s.delivered - d0) / 120;
  assert.ok(Math.abs(rate / th.flow - 1) < 0.1, `rate ${rate} vs flow ${th.flow}`);
  assert.ok(Math.abs((s.coins - c0) / (s.delivered - d0) - th.value) < 1e-6);
});

test('堆场满了就浪费;堆场不超容量', () => {
  const s = fresh();
  s.source.units[0] = 50;
  tick(s, 100);
  assert.ok(s.wasted > 0);
  assert.ok(s.stock <= stockMax(s, mods(s)) + 1e-9);
  assert.ok(stockFill(s) <= 1);
  const small = fresh();
  tick(small, 3);
  assert.equal(small.wasted, 0);
});

test('确定性:同样的输入同样的结果', () => {
  const run = () => {
    const s = atTiers(2, 2);
    s.source.units[2] = 3;
    for (let i = 0; i < 200; i++) { if (i % 7 === 0) click(s); tick(s, 0.25); }
    return JSON.stringify(s);
  };
  assert.equal(run(), run());
});

test('道具:换槽改变价值,互换,未解锁不能放,可清空', () => {
  const s = fresh();
  const v0 = throughput(s).value;
  assert.equal(v0, 1);
  assert.ok(setGate(s, 0, 'wash'));
  const v1 = throughput(s).value;
  const wash = GATES.find((g) => g.id === 'wash')!.effect.value!;
  assert.ok(Math.abs(v1 - wash) < 1e-9);
  assert.equal(setGate(s, 1, 'brand'), false, '没解锁');
  assert.equal(setGate(s, 5, 'wash'), false);
  assert.ok(setGate(s, 2, 'wash'));
  assert.deepEqual(s.gates, [null, null, 'wash'], '同一道具只占一个槽,从原槽拿走');
  assert.ok(setGate(s, 1, 'wax'));
  assert.ok(setGate(s, 1, 'wash'));
  assert.deepEqual(s.gates, [null, 'wash', 'wax'], '互换');
  assert.ok(setGate(s, 1, null));
  assert.equal(s.gates[1], null);
  assert.equal(describeEffect({ value: 1.25 }), '价值 ×1.25');
});

test('道具改变运力:打蜡 +价值 但更慢,加急更快', () => {
  const s = fresh();
  const c0 = throughput(s).carry;
  setGate(s, 0, 'wax');
  assert.ok(throughput(s).carry < c0);
  setGate(s, 0, 'rush');
  assert.ok(throughput(s).carry > c0);
});

test('红绳:放大相邻槽的道具,不相邻没用', () => {
  const s = fresh();
  s.gatesUnlocked.push('red');
  setGate(s, 0, 'wash');
  setGate(s, 1, 'red');
  const wash = GATES.find((g) => g.id === 'wash')!.effect.value!;
  const waxV = GATES.find((g) => g.id === 'wax')!.effect.value!;
  assert.ok(Math.abs(mods(s).value - Math.pow(wash, RED_EXP)) < 1e-9);
  setGate(s, 1, null);
  setGate(s, 2, 'red');
  assert.ok(Math.abs(mods(s).value - wash) < 1e-9, '槽 0 与槽 2 不相邻');
  setGate(s, 1, 'wax');
  setGate(s, 0, 'wash');
  // 槽 1 的 wax 被红绳(槽 2)放大,槽 0 的 wash 没有
  const expect = wash * Math.pow(waxV, RED_EXP);
  assert.ok(Math.abs(mods(s).value - expect) < 1e-9);
});

test('preview:不改状态,数字与真正执行一致', () => {
  const s = fresh();
  s.coins = 1e6;
  const snap = JSON.stringify(s);
  const p = preview(s, { kind: 'unit', line: 'route' });
  assert.equal(JSON.stringify(s), snap);
  assert.equal(p.cost, unitCost(s, 'route'));
  assert.ok(p.affordable);
  const before = throughput(s).flow;
  buyUnit(s, 'route');
  assert.ok(Math.abs(throughput(s).flow - before - p.flowDelta) < 1e-9);
  const g = preview(s, { kind: 'gate', slot: 0, id: 'wash' });
  assert.ok(g.valueDelta > 1.2);
  assert.equal(g.cost, 0);
  const t = preview(s, { kind: 'tier', line: 'source', branch: 0 });
  assert.equal(t.cost, tierCost(s, 'source'));
  assert.equal(preview(atTiers(5, 8), { kind: 'tier', line: 'source', branch: 0 }).ok, false);
});

test('nextHints:价格、等待秒数、建议', () => {
  const s = fresh();
  s.source.units[0] = 30;
  const h = nextHints(s);
  assert.equal(h.suggest, 'route');
  assert.equal(h.route.unit.cost, unitCost(s, 'route'));
  assert.ok(h.route.tier && h.route.tier.cost > 0);
  assert.ok(h.route.unit.waitSec > 0);
  s.coins = 1e9;
  assert.equal(nextHints(s).route.unit.waitSec, 0);
  assert.equal(nextHints(atTiers(5, 8)).source.tier, null);
});

test('摇树:苹果直接掉进堆场,蓄摇劲,计数', () => {
  const s = fresh();
  const expect = throughput(s).shakeDrop;
  const r = shake(s);
  assert.equal(r.ok, true);
  assert.ok(Math.abs(r.dropped - expect) < 1e-9);
  assert.ok(r.dropped >= 1);
  assert.equal(s.shakes, 1);
  assert.ok(Math.abs(s.stock - r.dropped) < 1e-9);
  assert.ok(Math.abs(s.charge - SHAKE.perShake) < 1e-12);
  assert.equal(click, shake);
  // 产出越高,每下掉得越多
  const hi = atTiers(2, 2);
  hi.source.units[2] = 10;
  assert.ok(throughput(hi).shakeDrop > r.dropped);
});

test('摇树:每秒有效次数有上限,令牌随时间回复', () => {
  const s = fresh();
  let ok = 0;
  for (let i = 0; i < 50; i++) if (shake(s).ok) ok++;
  assert.equal(ok, SHAKE.burst);
  assert.equal(s.shakes, SHAKE.burst, '无效的不计数');
  tick(s, 1);
  ok = 0;
  for (let i = 0; i < 50; i++) if (shake(s).ok) ok++;
  assert.ok(ok >= SHAKE.burst && ok <= SHAKE.burst + 1);
  assert.ok(SHAKE.maxRate >= 5 && SHAKE.maxRate <= 10);
});

test('摇树:堆场满了溢出算浪费', () => {
  const s = fresh();
  s.stock = stockMax(s, mods(s)) - 0.5;
  const w0 = s.wasted;
  shake(s);
  assert.equal(s.stock, stockMax(s, mods(s)));
  assert.ok(s.wasted > w0);
});

test('摇劲:摇一下蓄一点,不摇就衰减,产出变高', () => {
  const s = fresh();
  s.charge = 1;
  tick(s, 5);
  assert.ok(Math.abs(s.charge - Math.exp(-SHAKE.decay * 5)) < 1e-9);
  s.charge = 0.5;
  const withF = throughput(s).produce;
  s.charge = 0;
  assert.ok(withF > throughput(s).produce);
  s.charge = 0.99;
  for (let i = 0; i < 5; i++) { s.shakeTok = 3; shake(s); }
  assert.equal(s.charge, 1);
});

test('手摇频率算进吞吐估算,过一会儿衰减', () => {
  const s = fresh();
  const t0 = throughput(s).produce;
  for (let i = 0; i < 3; i++) shake(s);
  assert.ok(s.shakeRate > 0);
  const th = throughput(s);
  assert.ok(th.manual > 0 && th.produce > t0);
  tick(s, 30);
  assert.ok(s.shakeRate < 1e-5);
});

test('连摇:0.6 秒内续上,价值加成,超时断掉', () => {
  const s = fresh();
  shake(s);
  assert.equal(s.combo, 1);
  tick(s, 0.3);
  shake(s);
  assert.equal(s.combo, 2);
  const v = appleValue(s, mods(s));
  assert.ok(Math.abs(v - mods(s).value * (1 + 2 * SHAKE.comboStep)) < 1e-12);
  assert.equal(comboMult({ combo: 1000 }), 1 + SHAKE.comboMax * SHAKE.comboStep);
  tick(s, SHAKE.comboWindow + 0.3);
  assert.equal(s.combo, 0);
  shake(s);
  assert.equal(s.combo, 1, '断了重新数');
});

test('牛顿 buff:掉落和摇劲翻倍,过期恢复', () => {
  const a = fresh();
  const b = fresh();
  b.newtonUntil = 10;
  const ra = shake(a);
  const rb = shake(b);
  assert.ok(Math.abs(rb.dropped - 2 * ra.dropped) < 1e-9);
  assert.ok(Math.abs(b.charge - 2 * a.charge) < 1e-12);
  const c = fresh();
  c.newtonUntil = 10;
  c.playSec = 11;
  shake(c);
  assert.ok(Math.abs(c.charge - a.charge) < 1e-12);
});

test('老徐:价格涨、有解锁和上限、自动摇出苹果和摇劲', () => {
  const s = fresh();
  assert.equal(helperCost(s), null, '果园之前没有老徐');
  assert.equal(buyHelper(s), false);
  const t = atTiers(1, 0);
  const c0 = helperCost(t)!;
  assert.equal(c0, HELPER.baseCost);
  t.coins = c0 - 1;
  assert.equal(canBuyHelper(t), false);
  t.coins = 1e18;
  const before = throughput(t);
  const pv = preview(t, { kind: 'helper' });
  assert.equal(pv.cost, c0);
  assert.equal(buyHelper(t), true);
  assert.equal(t.helpers, 1);
  assert.ok(helperCost(t)! > c0);
  const after = throughput(t);
  assert.ok(after.auto > 0 && after.produce > before.produce);
  assert.ok(Math.abs(after.produce - pv.after.produce) < 1e-9);
  assert.ok(after.charge > 0, '老徐把摇劲稳住');
  // tick 里老徐真的在掉苹果
  const u = atTiers(1, 0);
  u.coins = 1e18;
  buyHelper(u);
  tick(u, 10);
  assert.ok(u.stock + u.wasted > 0);
  assert.ok(Math.abs((u.stock + u.wasted + u.delivered) / 10 - throughput(u).produce) / throughput(u).produce < 0.15);
  // 上限
  t.helpers = HELPER.max;
  assert.equal(helperCost(t), null);
  assert.equal(nextHints(t).helper, null);
  assert.ok(nextHints(atTiers(1, 0)).helper);
});

test('分支:铁砂掌、号子、摇树手套让摇一下掉得更多', () => {
  const s = atTiers(0, 0);
  s.source.units[0] = 20;
  const base = throughput(s).shakeDrop;
  s.gatesUnlocked.push('glove', 'chant');
  s.gates[0] = 'glove';
  assert.ok(throughput(s).shakeDrop > base);
  const iron = SOURCE_TIERS[1].branches!.findIndex((b) => (b.effect.shake ?? 1) > 1);
  assert.ok(iron >= 0);
  const a = atTiers(0, 0);
  a.coins = 1e18;
  upgradeTier(a, 'source', iron as 0 | 1);
  const b = atTiers(0, 0);
  b.coins = 1e18;
  upgradeTier(b, 'source', (1 - iron) as 0 | 1);
  assert.ok(mods(a).shake > mods(b).shake);
  assert.ok(comboMult({ combo: 10 }, { combo: 3 }) > comboMult({ combo: 10 }, { combo: 1 }));
});

test('自转摇柄:不摇也有摇劲保底', () => {
  const idx = SOURCE_TIERS[4].branches!.findIndex((b) => (b.effect.floor ?? 0) > 0);
  assert.ok(idx >= 0);
  const s2 = atTiers(3, 0);
  s2.coins = 1e18;
  upgradeTier(s2, 'source', idx as 0 | 1);
  s2.coins = 0;
  assert.ok(throughput(s2).charge >= SOURCE_TIERS[4].branches![idx].effect.floor!);
  tick(s2, 300);
  assert.ok(s2.charge < 1e-6);
  assert.ok(throughput(s2).charge > 0, '保底不衰减');
});

test('settle:离线按闭式结算,封顶 8 小时', () => {
  const s = atTiers(2, 2);
  s.source.units[2] = 5;
  s.route.units[2] = 5;
  s.vehicles = s.vehicles.filter((v) => v.tier !== 2);
  for (let i = 0; i < 5; i++) s.vehicles.push({ tier: 2, w: 1, phase: 0, load: 0 });
  const th = throughput(s);
  const r = settle(s, 3600 * 1000);
  assert.equal(r.capped, false);
  assert.equal(r.seconds, 3600);
  assert.ok(Math.abs(r.delivered / (th.flow * 3600) - 1) < 0.05);
  const s2 = atTiers(2, 2);
  const huge = settle(s2, 1000 * 3600 * 1000);
  assert.equal(huge.capped, true);
  assert.equal(huge.seconds, OFFLINE_CAP_MS / 1000);
  const s3 = atTiers(2, 2);
  settle(s3, OFFLINE_CAP_MS);
  assert.equal(s3.delivered, s2.delivered, '正好 8 小时与超出 8 小时结果一样');
  assert.deepEqual(settle(s3, 0), { delivered: 0, coins: 0, seconds: 0, capped: false });
  assert.deepEqual(settle(s3, -5), { delivered: 0, coins: 0, seconds: 0, capped: false });
});

test('settle:短离开按普通 tick;大 dt 的 tick 走聚合', () => {
  const s = fresh();
  const r = settle(s, 2000);
  assert.equal(r.seconds, 2);
  assert.ok(Math.abs(s.playSec - 2) < 1e-9);
  const a = atTiers(1, 1);
  const b = atTiers(1, 1);
  tick(a, 1000);
  settle(b, 1000 * 1000);
  assert.equal(a.delivered, b.delivered);
  assert.ok(a.delivered > 0);
});

test('通关:累计送达 ≥ 82 亿时 wonAt 记下一次', () => {
  const s = atTiers(2, 2);
  assert.equal(isWon(s), false);
  s.delivered = GOAL - 1;
  assert.ok(progress(s) < 1);
  s.playSec = 100;
  tick(s, 60);
  assert.equal(isWon(s), true);
  assert.ok(s.wonAt !== null && s.wonAt > 100 && s.wonAt <= 160);
  const at = s.wonAt;
  tick(s, 30);
  assert.equal(s.wonAt, at);
  const t = atTiers(2, 2);
  t.delivered = GOAL - 10;
  settle(t, 3600 * 1000);
  assert.ok(t.wonAt !== null);
});

test('存档:往返、备份、损坏回落、新版只读、旧版重开', () => {
  const kv = mem();
  const s = atTiers(2, 1);
  s.coins = 12345;
  s.delivered = 777;
  s.gates[0] = 'wash';
  assert.ok(save(kv, s, 5000));
  assert.equal(s.lastSeen, 5000);
  const r = load(kv, 9000);
  assert.equal(r.kind, 'ok');
  if (r.kind === 'ok') {
    assert.equal(r.state.coins, 12345);
    assert.equal(r.state.delivered, 777);
    assert.equal(r.state.source.tier, 2);
    assert.deepEqual(r.state.gates, ['wash', null, null]);
    assert.equal(r.fromBackup, false);
  }
  // 第二次存:上一份进备份
  s.coins = 99;
  save(kv, s, 6000);
  assert.ok(kv.m.get(SAVE_BAK_KEY));
  // 主档损坏 → 用备份
  kv.m.set(SAVE_KEY, '{"sum":"x","body":"oops"}');
  const r2 = load(kv, 9000);
  assert.equal(r2.kind, 'ok');
  if (r2.kind === 'ok') {
    assert.equal(r2.fromBackup, true);
    assert.equal(r2.state.coins, 12345);
  }
  // 都坏 → 新档
  kv.m.set(SAVE_BAK_KEY, 'garbage');
  const r3 = load(kv, 9000);
  assert.equal(r3.kind, 'new');
  assert.equal(r3.state.coins, 0);
  assert.equal(load(mem(), 1).kind, 'new');
});

test('存档:校验和、新版只读、旧版(v1/v2)直接重开', () => {
  const s = fresh();
  assert.equal(fnv('abc'), fnv('abc'));
  assert.notEqual(fnv('abc'), fnv('abd'));
  const raw = JSON.parse(serialize(s));
  raw.body = raw.body.replace('"coins":0', '"coins":9');
  assert.equal(parse(JSON.stringify(raw)), null, '改一个数字校验和就对不上');
  const wrap = (st: object) => { const body = JSON.stringify(st); return JSON.stringify({ sum: fnv(body), body }); };
  const kv = mem();
  kv.setItem(SAVE_KEY, wrap({ ...s, version: SAVE_VERSION + 1, coins: 5 }));
  const n = load(kv, 1);
  assert.equal(n.kind, 'readonly');
  const kv2 = mem();
  kv2.setItem(SAVE_KEY, wrap({ version: 2, apples: 1e9, upgrades: { shake: 5 } }));
  assert.equal(load(kv2, 1).kind, 'new');
  const kv3 = mem();
  kv3.setItem(SAVE_KEY, wrap({ ...s, version: 1 }));
  assert.equal(load(kv3, 1).kind, 'new');
  // 缺字段会被补齐
  const kv4 = mem();
  const partial: any = { ...s };
  delete partial.vehicles;
  delete partial.gates;
  delete partial.settings;
  kv4.setItem(SAVE_KEY, wrap(partial));
  const l = load(kv4, 1);
  assert.equal(l.kind, 'ok');
  if (l.kind === 'ok') {
    assert.equal(l.state.vehicles.length, 1);
    assert.equal(l.state.gates.length, GATE_SLOTS);
    assert.equal(l.state.settings.sound, false);
  }
});

test('存档:导出/导入、坏文本、存储不可写', () => {
  const s = atTiers(1, 1);
  s.coins = 321;
  const text = exportSave(s);
  const back = importSave(text)!;
  assert.equal(back.coins, 321);
  assert.equal(back.source.tier, 1);
  assert.equal(importSave('not base64 !!'), null);
  assert.equal(importSave(btoa('hello')), null);
  assert.equal(importSave(exportSave({ ...s, version: SAVE_VERSION + 1 } as State)), null, '新版导出文件不收');
  assert.equal(importSave('  ' + text + '\n')!.coins, 321, '首尾空白无所谓');
  assert.equal(storageWritable(mem()), true);
  assert.equal(storageWritable({ getItem: () => null, setItem: () => { throw new Error('quota'); } }), false);
  assert.equal(save({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, s, 1), false);
});

test('事件:间隔、昼夜选择、奖励', () => {
  assert.equal(nextEventGap(() => 0), EVENT_GAP_S[0]);
  assert.equal(nextEventGap(() => 1), EVENT_GAP_S[1]);
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) seen.add(pickEvent(true, () => i / 100));
  assert.deepEqual([...seen].sort(), ['bird', 'meteor']);
  const day = new Set<string>();
  for (let i = 0; i < 100; i++) day.add(pickEvent(false, () => i / 100));
  assert.deepEqual([...day].sort(), ['bird', 'newton']);
  const s = atTiers(1, 1);
  s.source.units[1] = 5;
  s.route.units[1] = 5;
  const flow = throughput(s).flow;
  s.coins = tierCost(s, 'source')!; // 离目标没有差额:只发基础奖励
  s.coins = Math.max(s.coins, tierCost(s, 'route')!);
  const c = claimEvent(s, 'bird');
  assert.equal(c.apples, Math.floor(flow * EVENT_REWARD_S.bird));
  assert.equal(s.delivered, c.apples);
  assert.ok(s.coins > 0);
  const m = claimEvent(s, 'meteor');
  assert.ok(m.apples > c.apples);
  s.playSec = 50;
  const n = claimEvent(s, 'newton');
  assert.equal(n.apples, 0);
  assert.equal(s.newtonUntil, 50 + NEWTON_S);
  assert.ok(claimEvent(fresh(), 'bird').apples >= 1);
});

test('事件:离升档远时补差额(20%),封顶 EVENT_MAX_S 秒送达量', () => {
  const s = atTiers(1, 1);
  s.source.units[1] = 5;
  s.route.units[1] = 5;
  const flow = throughput(s).flow;
  s.coins = 0;
  const gap = Math.min(tierCost(s, 'source')!, tierCost(s, 'route')!);
  const c = claimEvent(s, 'bird');
  const expect = Math.max(Math.floor(flow * EVENT_REWARD_S.bird), Math.min(Math.floor((gap * EVENT_GAP_SHARE) / mods(s).value), Math.floor(flow * EVENT_MAX_S)));
  assert.equal(c.apples, expect);
  assert.ok(c.apples <= Math.floor(flow * EVENT_MAX_S));
  assert.ok(EVENT_GAP_S[0] === 45 && EVENT_GAP_S[1] === 90);
});

test('升档点短标题 pair:每个升档点一条,无数字', () => {
  for (const tiers of [SOURCE_TIERS, ROUTE_TIERS]) {
    assert.equal(tiers[0].pair, '');
    for (const t of tiers.slice(1)) {
      assert.equal(t.pair, `${t.branches![0].name} 或 ${t.branches![1].name}`);
      assert.doesNotMatch(t.pair, /[0-9×%]/);
    }
  }
});

test('事件:不连续同一种;牛顿三段;文案条数', () => {
  for (const last of ['bird', 'newton', 'meteor'] as const) {
    for (const night of [true, false]) {
      for (let i = 0; i < 50; i++) assert.notEqual(pickEvent(night, () => i / 50, last), last);
    }
  }
  assert.equal(pickEvent(true, () => 0, null), pickEvent(true, () => 0));
  assert.equal(NEWTON_STAGES.length, 3);
  assert.deepEqual(NEWTON_STAGES.map((x) => x.at), [...NEWTON_STAGES.map((x) => x.at)].sort((a, b) => a - b));
  assert.ok(NEWTON_STAGES[NEWTON_STAGES.length - 1].at < NEWTON_S);
  assert.ok(AMBIENT_TEXT.length >= 8);
  assert.ok(DAILY_NEWS.length >= 8);
  assert.equal(ERA_SWITCH_TOAST.length, 6);
  const lines = new Set([awayLine(1), awayLine(30), awayLine(600), awayLine(2000), awayLine(5000)]);
  assert.ok(lines.size >= 4, '离线问候至少分 4 档');
});

test('世界与礼物日期', () => {
  assert.equal(DAY_S, 240);
  assert.equal(SEASON_NAMES.length, 4);
  const w = worldAt(0);
  assert.ok(w.daylight >= 0 && w.daylight <= 1);
  assert.deepEqual(worldAt(123), worldAt(123));
  // 北京时间 2026-12-24 00:00 = UTC 2026-12-23 16:00,与本机时区无关
  assert.equal(GIFT_DATE, Date.parse('2026-12-24T00:00:00+08:00'));
  assert.equal(giftOpen(Date.parse('2026-12-23T23:59:59+08:00')), false);
  assert.equal(giftOpen(Date.parse('2026-12-24T00:00:00+08:00')), true);
  assert.equal(giftOpen(Date.UTC(2026, 11, 23, 15, 59, 59)), false);
  assert.equal(giftOpen(Date.UTC(2026, 11, 23, 16, 0, 0)), true);
  assert.equal(SEALED.length, 2);
});

test('格式化:中文万/亿', () => {
  assert.equal(fmt(0), '0');
  assert.equal(fmt(999), '999');
  assert.equal(fmt(12345), '1.23万');
  assert.equal(fmt(1e8), '1亿');
  assert.equal(fmt(8.2e9), '82亿');
  assert.equal(fmt(3.5e12), '3.5万亿');
  assert.equal(fmt(Infinity), '∞');
  assert.match(equiv(8.2e9), /每个人/);
});

test('扩建:够数量才能买,一次性,该档翻倍×1.5,价格随下一档升档价', () => {
  const s = atTiers(1, 1);
  assert.equal(canExpand(s, 'source'), false, '单位不够');
  s.source.units[1] = EXPAND.units[0];
  s.coins = 0;
  assert.equal(canExpand(s, 'source'), false, '没钱');
  const cost = expandCost(s, 'source')!;
  assert.ok(cost > 0);
  s.coins = cost;
  const before = throughput(s).produce;
  assert.ok(buyExpand(s, 'source'));
  assert.equal(s.source.ext[1], 1);
  assert.ok(throughput(s).produce > before * 1.2);
  assert.equal(canExpand(s, 'source'), false, '第二次要更多单位');
  s.source.units[1] = EXPAND.units[1];
  assert.ok(expandCost(s, 'source')! > cost);
});

test('单位有上限 UNIT_MAX;nextHints 标 full', () => {
  const s = atTiers(1, 1);
  s.coins = 1e18;
  s.source.units[1] = UNIT_MAX;
  assert.equal(canBuyUnit(s, 'source'), false);
  assert.equal(nextHints(s).source.unit.full, true);
  assert.equal(nextHints(s).route.unit.full, false);
});

test('堆场满了摇树:溢出当场路边摊卖掉一点钱', () => {
  const s = fresh();
  s.stock = stockMax(s, mods(s));
  s.shakeTok = 3;
  const c0 = s.coins;
  const w0 = s.wasted;
  const r = shake(s);
  assert.ok(r.ok);
  assert.ok(s.wasted > w0);
  assert.ok(s.coins > c0);
});

test('preview.plain:一句人话,没用处时是空串,不带数字', () => {
  const s = atTiers(1, 1);
  s.coins = 1e18;
  const p = preview(s, { kind: 'tier', line: 'route', branch: 0 });
  assert.equal(typeof p.plain, 'string');
  assert.ok(!/\d/.test(p.plain));
  s.source.units[1] = UNIT_MAX;
  assert.equal(preview(s, { kind: 'unit', line: 'source' }).plain, '');
});

test('存档:ext 往返并规整', () => {
  const s = atTiers(1, 1);
  s.source.ext[1] = 2;
  const back = parse(serialize(s));
  assert.ok(back);
  assert.deepEqual(back!.state.source.ext, s.source.ext);
});
