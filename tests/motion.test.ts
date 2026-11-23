import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShakeDetector } from '../src/input/motion.ts';

/** 以 ~60Hz 喂一段信号;返回所有非零结果 */
function run(det: ReturnType<typeof createShakeDetector>, samples: Array<[number, number, number]>, t0 = 0, dt = 16): number[] {
  const out: number[] = [];
  samples.forEach(([x, y, z], i) => {
    const r = det.feed(x, y, z, t0 + i * dt);
    if (r > 0) out.push(r);
  });
  return out;
}
const rest = (n: number, g = 9.8): Array<[number, number, number]> => Array.from({ length: n }, () => [0, 0, g]);
/** 沿 x 轴来回 n 个峰,峰值 amp,每个峰 2 个样本(~32ms)夹 3 个静止样本 */
const swing = (n: number, amp: number): Array<[number, number, number]> => {
  const o: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const s = i % 2 === 0 ? 1 : -1;
    o.push([s * amp, 0, 9.8], [s * amp, 0, 9.8], [0, 0, 9.8], [0, 0, 9.8]);
  }
  return o;
};

test('静止不触发', () => {
  const d = createShakeDetector();
  assert.equal(run(d, rest(300)).length, 0);
});

test('三次交替大幅摆动 → 触发一次,强度在 0.3..1', () => {
  const d = createShakeDetector();
  const r = run(d, [...rest(20), ...swing(3, 20), ...rest(20)]);
  assert.equal(r.length, 1);
  assert.ok(r[0] >= 0.3 && r[0] <= 1);
});

test('幅度低于阈值(走路级 8 m/s²)不触发', () => {
  const d = createShakeDetector();
  assert.equal(run(d, [...rest(20), ...swing(8, 8), ...rest(10)]).length, 0);
});

test('只有两次交替不够', () => {
  const d = createShakeDetector();
  assert.equal(run(d, [...rest(20), ...swing(2, 25), ...rest(20)]).length, 0);
});

test('同方向的持续高值不重复计峰', () => {
  const d = createShakeDetector();
  const same = Array.from({ length: 30 }, () => [25, 0, 9.8] as [number, number, number]);
  assert.equal(run(d, [...rest(20), ...same]).length, 0);
});

test('三次峰拉得太散(超过 600ms 窗口)不触发', () => {
  const d = createShakeDetector();
  const slow: Array<[number, number, number]> = [];
  for (let i = 0; i < 3; i++) slow.push(...rest(2).map(() => [(i % 2 ? -1 : 1) * 25, 0, 9.8] as [number, number, number]), ...rest(30)); // 每峰间隔 ~500ms
  assert.equal(run(d, [...rest(20), ...slow]).length, 0);
});

test('冷却 1.5s:紧接着再摇无效,过后又可触发', () => {
  const d = createShakeDetector();
  let t = 0;
  const a = run(d, [...rest(20), ...swing(3, 22)], t);
  t += (20 + 12) * 16;
  const b = run(d, [...rest(5), ...swing(3, 22)], t); // 冷却内
  t += 5000;
  const c = run(d, [...rest(20), ...swing(3, 22)], t);
  assert.equal(a.length, 1);
  assert.equal(b.length, 0);
  assert.equal(c.length, 1);
});

test('带重力的竖直晃动也能识别(重力被低通估计去掉)', () => {
  const d = createShakeDetector();
  const sw: Array<[number, number, number]> = [];
  for (let i = 0; i < 3; i++) {
    const s = i % 2 === 0 ? 1 : -1;
    sw.push([0, 0, 9.8 + s * 22], [0, 0, 9.8 + s * 22], [0, 0, 9.8], [0, 0, 9.8]);
  }
  assert.equal(run(d, [...rest(30), ...sw, ...rest(10)]).length, 1);
});
