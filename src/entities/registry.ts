/**
 * 实体位置注册表：让数据里的 anchor / target 可以用字符串引用实体。
 * 约定 id：`npc:<id>`、`hat`、`prop:<id>`、`mech:<id>`、或 `pt:x,y`（固定点）。
 * 位置单位都是世界瓦片坐标。
 */
type PosFn = () => { x: number; y: number };
const REG = new Map<string, PosFn>();

export function registerEntity(id: string, fn: PosFn) { REG.set(id, fn); }
export function unregisterEntity(id: string) { REG.delete(id); }
export function clearEntities() { REG.clear(); }
export function entityPos(id: string): { x: number; y: number } | undefined {
  const f = REG.get(id); if (f) return f();
  if (id.startsWith('pt:')) { const [x, y] = id.slice(3).split(',').map(Number); if (Number.isFinite(x) && Number.isFinite(y)) return { x, y }; }
  return undefined;
}
export const hasEntity = (id: string) => REG.has(id) || id.startsWith('pt:');
export const entityIds = () => [...REG.keys()];

/**
 * 世界标志（flag）：故事 / NPC / 机关之间的轻量联动。
 * setFlag 会 bus.emit('flag:<name>', value)；读用 getFlag。存档需要时 dev-core 用 allFlags()/loadFlags()。
 */
import { bus } from '../core/bus';
const FLAGS = new Map<string, number>();
export function setFlag(name: string, v: number | boolean = 1) {
  const n = typeof v === 'boolean' ? (v ? 1 : 0) : v;
  if (FLAGS.get(name) === n) return;
  FLAGS.set(name, n); bus.emit('flag:' + name, n); bus.emit('flag', name, n);
}
export const getFlag = (name: string) => FLAGS.get(name) ?? 0;
export const hasFlag = (name: string) => (FLAGS.get(name) ?? 0) > 0;
export const addFlag = (name: string, d = 1) => setFlag(name, getFlag(name) + d);
export const allFlags = () => Object.fromEntries(FLAGS);
export function loadFlags(o: Record<string, number>) { FLAGS.clear(); for (const [k, v] of Object.entries(o)) FLAGS.set(k, v); }
export const clearFlags = () => FLAGS.clear();

// ───────────── 招式（moves.json）的标志联动 helper（E3/E8），由 Game.useMove 调用 ─────────────
export interface MoveFlagsX {
  set?: string | string[]; clear?: string | string[]; add?: { flag: string; n?: number };
  requires?: { flag?: string | string[]; notFlag?: string | string[] }; failSay?: string;
  /** E8：随机结局，按权重抽一个，合并 set/say/fx/event */
  pick?: { w?: number; every?: number; say?: string; fx?: string; set?: string | string[]; event?: string }[];
}
const arr = (v?: string | string[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
/** 招式是否满足 requires（不满足时 failSay 是提示 key） */
export function moveAllowed(m: MoveFlagsX): { ok: boolean; failSay?: string } {
  const r = m.requires; if (!r) return { ok: true };
  const ok = arr(r.flag).every((f) => hasFlag(f)) && arr(r.notFlag).every((f) => !hasFlag(f));
  return ok ? { ok } : { ok, failSay: m.failSay };
}
/** 触发后应用 set/clear/add；有 pick 则抽一个结局并返回（Game 负责展示 say/fx/event） */
const PICK_N = new WeakMap<object, number>();
export function applyMoveEffects(m: MoveFlagsX, rnd: () => number = Math.random) {
  arr(m.set).forEach((f) => setFlag(f)); arr(m.clear).forEach((f) => setFlag(f, 0));
  if (m.add) addFlag(m.add.flag, m.add.n ?? 1);
  if (!m.pick?.length) return undefined;
  // every:n —— 第 n、2n… 次使用必定选中（确定性，如“连按 3 次必出”）；计数按招式对象记
  const cnt = (PICK_N.get(m) ?? 0) + 1; PICK_N.set(m, cnt);
  const fixed = m.pick.find((p) => p.every && cnt % p.every === 0);
  if (fixed) { arr(fixed.set).forEach((f) => setFlag(f)); return fixed; }
  const tot = m.pick.reduce((a, p) => a + (p.w ?? 1), 0); let x = rnd() * tot;
  const o = m.pick.find((p) => (x -= p.w ?? 1) < 0) ?? m.pick[m.pick.length - 1];
  arr(o.set).forEach((f) => setFlag(f));
  return o;
}
