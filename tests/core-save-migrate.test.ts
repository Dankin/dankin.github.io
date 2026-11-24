import assert from 'node:assert/strict';
import test from 'node:test';
import { SAVE_KEY, SAVE_VERSION } from '../src/core/constants.ts';
import { buyExpand, buyHelper, buyUnit, tick, upgradeTier } from '../src/core/game.ts';
import { fnv, load, migrationBackupKey, parse, save, serialize, type KV } from '../src/core/save.ts';
import { newState } from '../src/core/state.ts';

const mem = (): KV & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};
const wrap = (o: unknown): string => {
  const body = JSON.stringify(o);
  return JSON.stringify({ sum: fnv(body), body });
};
/** 造一份 v3 存档(没有 spent / pin) */
function v3(): Record<string, unknown> {
  const s: Record<string, unknown> = { ...newState(1000) };
  delete s.spent;
  delete s.pin;
  s.version = 3;
  s.coins = 4321;
  s.delivered = 9999;
  s.helpers = 2;
  return s;
}

test('SAVE_VERSION 是 4', () => assert.equal(SAVE_VERSION, 4));

test('迁移 v3→v4:数值原样,spent=0,pin=null', () => {
  const r = parse(wrap(v3()))!;
  assert.equal(r.newer, false);
  assert.equal(r.migratedFrom, 3);
  assert.equal(r.state.version, 4);
  assert.equal(r.state.spent, 0);
  assert.equal(r.state.pin, null);
  assert.equal(r.state.coins, 4321);
  assert.equal(r.state.delivered, 9999);
  assert.equal(r.state.helpers, 2);
});

test('load 旧档:迁移前先把原文存成 .v3.bak;再次加载不覆盖它', () => {
  const kv = mem();
  const raw = wrap(v3());
  kv.setItem(SAVE_KEY, raw);
  const r = load(kv, 5000);
  assert.equal(r.kind, 'ok');
  assert.equal(r.kind === 'ok' && r.state.version, 4);
  assert.equal(kv.getItem(migrationBackupKey(3)), raw, '原文原样备份');
  // 玩一会儿存档(已经是 v4),再来一次 load:不再迁移,也不碰备份
  if (r.kind === 'ok') save(kv, r.state, 6000);
  const r2 = load(kv, 7000);
  assert.equal(r2.kind, 'ok');
  assert.equal(kv.getItem(migrationBackupKey(3)), raw);
});

test('v4 存档往返:spent / pin 保留;新档不产生迁移备份', () => {
  const kv = mem();
  const s = newState(1);
  s.spent = 777;
  s.pin = 'rtUp';
  save(kv, s, 2);
  const r = load(kv, 3);
  assert.equal(r.kind === 'ok' && r.state.spent, 777);
  assert.equal(r.kind === 'ok' && r.state.pin, 'rtUp');
  assert.equal(kv.getItem(migrationBackupKey(3)), null);
  assert.equal(parse(serialize(s))!.migratedFrom, undefined);
});

test('v2 及更早仍丢弃为新档;坏 pin 被清掉', () => {
  const kv = mem();
  kv.setItem(SAVE_KEY, wrap({ version: 2, apples: 1e9 }));
  assert.equal(load(kv, 1).kind, 'new');
  const kv2 = mem();
  kv2.setItem(SAVE_KEY, wrap({ ...newState(1), pin: 'nope', spent: -5 }));
  const r = load(kv2, 1);
  assert.equal(r.kind === 'ok' && r.state.pin, null);
  assert.equal(r.kind === 'ok' && r.state.spent, 0);
});

test('账本:购买只把 coins 挪到 spent(coins+spent 守恒),已送出不减', () => {
  const s = newState(0);
  s.coins = 1e12;
  s.delivered = 500;
  const total = () => s.coins + s.spent;
  const t0 = total();
  assert.ok(buyUnit(s, 'source'));
  assert.ok(s.spent > 0);
  assert.equal(total(), t0);
  const sp = s.spent;
  assert.ok(buyUnit(s, 'route'));
  buyHelper(s);
  for (let i = 0; i < 6; i++) buyUnit(s, 'source');
  buyExpand(s, 'source');
  assert.ok(upgradeTier(s, 'source', 0));
  assert.ok(s.spent > sp);
  assert.equal(total(), t0, '花了多少就记多少');
  assert.equal(s.delivered, 500, '已送出不因购买减少');
});

test('账本:tick 赚到的钱不进 spent', () => {
  const s = newState(0);
  for (let i = 0; i < 20; i++) tick(s, 1);
  assert.equal(s.spent, 0);
});
