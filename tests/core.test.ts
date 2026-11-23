import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buffMult, buy, buyProject, canBuyProject, click, clickPieces, cookReady, cost, goldRate, grabFairest,
  gravityGain, milestoneMult, nextStageAt, rate, settle, stageIndex, stageProgress, STAGES, tick,
  upgradeDef, useCook, COOK_CD_MS, COOK_MS, GOLD_MULT, breezeBoost, milestoneCount, MILESTONE_GLOBAL,
} from '../src/core/game.ts';
import { exportSave, importSave, load, save, serialize, type KV } from '../src/core/save.ts';
import { newState } from '../src/core/state.ts';
import { GOAL, OFFLINE_CAP_MS, SAVE_BAK_KEY, SAVE_KEY } from '../src/core/constants.ts';
import { fmt, equiv } from '../src/ui/format.ts';
import { newsIndex, NEWS } from '../src/core/news.ts';

const mem = (): KV & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};
const NO_GOLD = () => 1;
const ALL_GOLD = () => 0;

test('点击得到苹果,同时累计平安果', () => {
  const s = newState(0);
  const r = click(s, { rng: NO_GOLD });
  assert.equal(r.value, 1);
  assert.equal(s.apples, 1);
  assert.equal(s.delivered, 1);
  assert.equal(s.clicks, 1);
});

test('买升级扣苹果但不扣累计平安果', () => {
  const s = newState(0);
  s.apples = 100;
  s.delivered = 100;
  assert.equal(buy(s, 'shake'), true);
  assert.equal(s.apples, 90);
  assert.equal(s.delivered, 100);
  assert.equal(clickPieces(s), 2);
  s.apples = 0;
  assert.equal(buy(s, 'shake'), false);
});

test('价格公式 base×growth^n 向下取整', () => {
  const d = upgradeDef('shake');
  assert.equal(cost(d, 0), 10);
  assert.equal(cost(d, 1), Math.floor(10 * d.growth));
  assert.equal(cost(d, 10), Math.floor(10 * d.growth ** 10));
});

test('每 25 级产出翻倍', () => {
  assert.equal(milestoneMult(24), 1);
  assert.equal(milestoneMult(25), 2);
  assert.equal(milestoneMult(50), 4);
});

test('金苹果:价值 ×25,掉率随品种改良上升并封顶 20%', () => {
  const s = newState(0);
  assert.equal(click(s, { rng: ALL_GOLD }).value, GOLD_MULT);
  assert.equal(goldRate(s), 0.02);
  s.upgrades.breed = 5;
  assert.ok(Math.abs(goldRate(s) - 0.07) < 1e-9);
  s.upgrades.breed = 500;
  assert.equal(goldRate(s), 0.2);
});

test('自动产出按秒累计(含金苹果期望)', () => {
  const s = newState(0);
  s.upgrades.breeze = 10;
  const per = 10 * breezeBoost(s) * (1 + 0.02 * (GOLD_MULT - 1));
  assert.ok(Math.abs(rate(s) - per) < 1e-9);
  tick(s, 10);
  assert.ok(Math.abs(s.apples - per * 10) < 1e-6);
});

test('项目只能买一次;iPhone Duo 多掉 1 个并提高全局产出', () => {
  const s = newState(0);
  s.apples = 1e9;
  assert.equal(canBuyProject(s, 'duo'), true);
  assert.equal(buyProject(s, 'duo'), true);
  assert.equal(buyProject(s, 'duo'), false);
  assert.equal(clickPieces(s), 2);
  assert.equal(click(s, { rng: NO_GOLD }).value, 2 * 1.25);
});

test('库克发布会:×3 持续 30 秒,冷却 5 分钟;最美的苹果 ×2 可叠加', () => {
  const s = newState(0);
  s.projects.cook = true;
  assert.equal(cookReady(s, 1000), true);
  assert.equal(useCook(s, 1000), true);
  assert.equal(useCook(s, 2000), false);
  assert.equal(buffMult(s, 1000 + COOK_MS - 1), 3);
  assert.equal(buffMult(s, 1000 + COOK_MS + 1), 1);
  assert.equal(cookReady(s, 1000 + COOK_CD_MS - 1), false);
  assert.equal(cookReady(s, 1000 + COOK_CD_MS), true);
  useCook(s, 1000);
  grabFairest(s, 1000);
  assert.equal(buffMult(s, 1500), 6);
});

test('万有引力:约 3 秒的产出;开局无自动产出时按 3 次摇算', () => {
  const s = newState(0);
  assert.ok(gravityGain(s, 0) > 0);
  s.upgrades.breeze = 10;
  assert.ok(Math.abs(gravityGain(s, 0) - rate(s, 0) * 3) < 1e-9);
});

test('期:门槛递增、树数递增,进度条按对数刻度', () => {
  for (let i = 1; i < STAGES.length; i++) {
    assert.ok(STAGES[i].at > STAGES[i - 1].at);
    assert.ok(STAGES[i].trees > STAGES[i - 1].trees);
  }
  assert.equal(stageIndex(0), 0);
  assert.equal(stageIndex(STAGES[2].at), 2);
  assert.equal(nextStageAt(0), STAGES[1].at);
  assert.equal(nextStageAt(STAGES[STAGES.length - 1].at), GOAL);
  assert.equal(stageProgress(0), 0);
  assert.ok(stageProgress(Math.sqrt(STAGES[1].at)) > 0.4);
});

test('数字格式与折算', () => {
  assert.equal(fmt(999), '999');
  assert.equal(fmt(12345), '1.23万');
  assert.equal(fmt(8.2e9), '82亿');
  assert.equal(fmt(1e8), '1亿');
  assert.equal(equiv(3), '');
  assert.ok(equiv(1000).includes('箱'));
  assert.ok(equiv(GOAL).includes('地球'));
});

test('新闻按累计数量单调推进', () => {
  assert.equal(newsIndex(0), 0);
  let last = 0;
  for (const x of [1, 10, 100, 1e3, 1e5, 1e7, 1e9, GOAL]) {
    const i = newsIndex(x);
    assert.ok(i >= last);
    last = i;
  }
  assert.equal(last, NEWS.length - 1);
});

test('离线补算:50% 效率,8 小时封顶', () => {
  const s = newState(0);
  s.upgrades.breeze = 10;
  const per = rate(s);
  const r = settle(s, 3600_000);
  assert.ok(Math.abs(r.gain - per * 3600 * 0.5) < 1e-6);
  const s2 = newState(0);
  s2.upgrades.breeze = 10;
  const r2 = settle(s2, 20 * 3600_000);
  assert.equal(r2.capped, true);
  assert.ok(Math.abs(r2.gain - per * (OFFLINE_CAP_MS / 1000) * 0.5) < 1e-3);
});

test('离线补算:短暂离开全效率,沉睡 100%,时钟回拨不给收益', () => {
  const s = newState(100_000);
  s.upgrades.breeze = 10;
  const per = rate(s);
  assert.ok(Math.abs(settle(s, 130_000).gain - per * 30) < 1e-6);
  const s2 = newState(0);
  s2.upgrades.breeze = 10;
  s2.sleeping = true;
  assert.ok(Math.abs(settle(s2, 3600_000).gain - per * 3600) < 1e-6);
  assert.equal(s2.sleeping, false);
  const s3 = newState(1_000_000);
  s3.upgrades.breeze = 10;
  const r = settle(s3, 500_000);
  assert.equal(r.gain, 0);
  assert.equal(s3.lastSeen, 500_000);
});

test('存档往返,并保留一份备份', () => {
  const kv = mem();
  const s = newState(0);
  s.apples = 42;
  assert.equal(save(kv, s, 1000), true);
  s.apples = 43;
  save(kv, s, 2000);
  assert.ok(kv.m.get(SAVE_BAK_KEY));
  const r = load(kv, 3000);
  assert.equal(r.kind, 'ok');
  assert.equal(r.state.apples, 43);
  assert.equal(r.state.lastSeen, 2000);
});

test('主档损坏时回退到备份', () => {
  const kv = mem();
  const s = newState(0);
  s.apples = 7;
  save(kv, s, 1000);
  s.apples = 8;
  save(kv, s, 2000);
  kv.m.set(SAVE_KEY, kv.m.get(SAVE_KEY)!.slice(0, 20)); // 半截写入
  const r = load(kv, 3000);
  assert.equal(r.kind, 'ok');
  assert.equal(r.kind === 'ok' && r.fromBackup, true);
  assert.equal(r.state.apples, 7);
});

test('版本高于代码时只读,不覆盖', () => {
  const kv = mem();
  const s: any = newState(0);
  s.version = 999;
  kv.setItem(SAVE_KEY, serialize(s));
  assert.equal(load(kv, 0).kind, 'readonly');
});

test('没有存档时新开一局', () => {
  assert.equal(load(mem(), 5).kind, 'new');
});

test('存储写入失败时 save 返回 false 而不抛错', () => {
  const kv: KV = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(save(kv, newState(0), 1), false);
});

test('导出再导入得到同样的存档,坏数据返回 null', () => {
  const s = newState(0);
  s.apples = 123;
  s.delivered = 456;
  const back = importSave(exportSave(s));
  assert.equal(back?.apples, 123);
  assert.equal(back?.delivered, 456);
  assert.equal(importSave('not base64 !!'), null);
});

import { BITES, bite, canBite, globalMult, useWitch, witchReady, cookMult, WITCH_SKIP_S, PROJECTS } from '../src/core/game.ts';
import { ACHIEVEMENTS, checkAchievements } from '../src/core/achievements.ts';
import { tickerLines } from '../src/core/news.ts';

test('禁果:按顺序咬,每口全部产出 ×2,需要累计门槛和苹果', () => {
  const s = newState(0);
  s.apples = 1e12;
  assert.equal(canBite(s), false, '累计不够不能咬');
  s.delivered = BITES[0].unlockAt;
  const m0 = globalMult(s);
  assert.equal(bite(s), true);
  assert.equal(globalMult(s), m0 * 2);
  assert.equal(canBite(s), false, '第二口门槛未到');
  s.delivered = BITES[2].unlockAt;
  assert.equal(bite(s) && bite(s), true);
  assert.equal(s.bites, 3);
  assert.equal(bite(s), false, '只有三口');
});

test('女巫苹果:整局一次,得到 20 分钟自动产出并进入沉睡', () => {
  const s = newState(0);
  s.upgrades.breeze = 10;
  assert.equal(witchReady(s), false);
  s.projects.witch = true;
  const r = rate(s);
  const gain = useWitch(s);
  assert.ok(Math.abs(gain - r * WITCH_SKIP_S) < 1e-6);
  assert.equal(s.sleeping, true);
  assert.equal(useWitch(s), 0);
});

test('还有一件事:发布会倍数 3 → 5', () => {
  const s = newState(0);
  assert.equal(cookMult(s), 3);
  s.projects.onemore = true;
  assert.equal(cookMult(s), 5);
});

test('成就:解锁一次并记录时间,线索齐全', () => {
  const s = newState(0);
  assert.equal(checkAchievements(s, 5).length, 0);
  s.clicks = 100;
  const got = checkAchievements(s, 9).map((a) => a.id);
  assert.deepEqual(got, ['first', 'shake100']);
  assert.equal(s.achievements.first, 9);
  assert.equal(checkAchievements(s, 10).length, 0);
  for (const a of ACHIEVEMENTS) assert.ok(a.hint && a.desc && a.name);
});

test('项目:晚期项目的解锁门槛不晚于终点,价格低于终点', () => {
  for (const p of PROJECTS) {
    assert.ok(p.unlockAt < GOAL && p.cost < GOAL, p.id);
  }
  assert.ok(BITES.every((b) => b.cost < GOAL && b.unlockAt < GOAL));
});

test('跑马灯总有内容', () => {
  for (const d of [0, 100, 1e6, 5e9]) assert.ok(tickerLines(d).length >= 4);
});

test('微风:每级 +1/秒,并让所有自动产出 +0.32%', () => {
  const s = newState(0);
  s.upgrades.breeze = 20;
  s.upgrades.gardener = 10;
  assert.ok(Math.abs(breezeBoost(s) - (1 + 20 * tuning.breeze)) < 1e-9);
  const noBreeze = { ...s, upgrades: { ...s.upgrades, breeze: 0 } };
  assert.ok(rate(s) > rate(noBreeze) + 20);
});

test('升级里程碑:每个升级每满 25 级,全部产出 ×MILESTONE_GLOBAL', () => {
  const s = newState(0);
  assert.equal(milestoneCount(s), 0);
  s.upgrades.shake = 24;
  const g0 = globalMult(s);
  s.upgrades.shake = 25;
  s.upgrades.gardener = 50;
  assert.equal(milestoneCount(s), 3);
  assert.ok(Math.abs(globalMult(s) / g0 - Math.pow(MILESTONE_GLOBAL, 3)) < 1e-9);
});

test('新升级:拖拉机/无人机/苹果云存在且存档补齐字段', () => {
  const s = newState(0);
  for (const id of ['tractor', 'drone', 'cloud'] as const) assert.equal(s.upgrades[id], 0);
});

import { harvestInfo, harvestMult, worldAt, envMult, HARVEST_CYCLE_S, world } from '../src/core/world.ts';
import { eventReward, pickEvent, nextEventGap, EVENT_GAP_S } from '../src/core/events.ts';
import { sourcePerSec, SOURCE_IDS, clickBonus, rate as rate2, clickEV as clickEV2, tuning } from '../src/core/game.ts';

test('收获周期:平均倍率 1,收获期 25 秒', () => {
  let sum = 0;
  for (let t = 0; t < HARVEST_CYCLE_S; t += 0.5) sum += harvestMult(t) * 0.5;
  assert.ok(Math.abs(sum / HARVEST_CYCLE_S - 1) < 1e-9);
  assert.equal(harvestInfo(80).harvesting, true);
  assert.equal(harvestInfo(10).harvesting, false);
  assert.equal(harvestMult(Infinity), 1);
  world.harvestOn = false;
  assert.equal(envMult(80), 1);
  world.harvestOn = true;
});

test('昼夜与季节:一天 240 秒,季节 300 秒,同一时刻天气固定', () => {
  assert.equal(worldAt(60).isNight, false);
  assert.equal(worldAt(180).isNight, true);
  assert.equal(worldAt(0).season, 0);
  assert.equal(worldAt(301).season, 1);
  assert.equal(worldAt(1250).season, 0);
  assert.equal(worldAt(100).weather, worldAt(100).weather);
  assert.equal(worldAt(0, 3).season, 3);
});

test('随机事件:流星只在夜里,奖励至少 1', () => {
  for (let i = 0; i < 50; i++) assert.notEqual(pickEvent(false), 'star');
  const g = nextEventGap(() => 0);
  assert.equal(g, EVENT_GAP_S[0]);
  const s = newState(0);
  assert.ok(eventReward(s, 'bird') >= 1);
});

test('来源:各来源之和 = 点击收入 + 自动产出', () => {
  const s = newState(0);
  s.upgrades.gardener = 10; s.upgrades.breeze = 20; s.upgrades.tractor = 5; s.upgrades.shake = 8;
  s.delivered = 1e6;
  const p = sourcePerSec(s, 2, Infinity);
  const sum = SOURCE_IDS.reduce((a, id) => a + p[id], 0);
  assert.ok(Math.abs(sum - (rate2(s) + 2 * clickEV2(s))) / sum < 1e-9);
  assert.ok(p.breeze > 0 && p.click > 0 && p.drone === 0);
});

test('摇树:每次点击额外获得自动产出的一部分', () => {
  const s = newState(0);
  s.upgrades.gardener = 10; s.upgrades.shake = 10;
  const b = clickBonus(s);
  assert.ok(Math.abs(b - 10 * tuning.clickAuto * rate2(s)) < 1e-9);
});
