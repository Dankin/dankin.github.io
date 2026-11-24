import assert from 'node:assert/strict';
import test from 'node:test';
import { createBus, type Ev } from '../src/core/bus.ts';

test('bus:按类型订阅、取消订阅', () => {
  const b = createBus();
  const got: string[] = [];
  const off = b.on('shake', (e) => got.push(`s${e.combo}`));
  b.on('tier', (e) => got.push(`t${e.tier}`));
  b.emit({ t: 'shake', combo: 3, strength: 1 });
  b.emit({ t: 'tier', line: 'source', tier: 1, branch: 0 });
  off();
  b.emit({ t: 'shake', combo: 4, strength: 1 });
  assert.deepEqual(got, ['s3', 't1']);
});

test('bus:onAny 收到全部;订阅者抛错不影响别人', () => {
  const b = createBus();
  const seen: Ev['t'][] = [];
  b.on('win', () => {
    throw new Error('boom');
  });
  b.on('win', () => seen.push('win'));
  b.onAny((e) => seen.push(e.t));
  const orig = console.error;
  console.error = () => {};
  try {
    b.emit({ t: 'win' });
  } finally {
    console.error = orig;
  }
  assert.deepEqual(seen, ['win', 'win']);
});

test('bus:回调里取消订阅不影响本轮、clear 清空', () => {
  const b = createBus();
  let n = 0;
  const off = b.on('egg', () => {
    n++;
    off();
  });
  b.on('egg', () => n++);
  b.emit({ t: 'egg', id: 'eve' });
  b.emit({ t: 'egg', id: 'eve' });
  assert.equal(n, 3);
  b.clear();
  b.emit({ t: 'egg', id: 'eve' });
  assert.equal(n, 3);
});
