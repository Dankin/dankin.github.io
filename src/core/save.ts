import { SAVE_BAK_KEY, SAVE_KEY, SAVE_VERSION } from './constants.ts';
import { newState, type State } from './state.ts';

/** 只用到这三个方法,便于测试时传入内存实现 */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** FNV-1a 32 位,仅用于发现半截写入和误改 */
export function fnv(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** migrations[v] 把 v 版存档升到 v+1 版 */
/** v1/v2 是旧的数值模型,结构完全不同:直接换成全新存档(见 parse)。 */
export const migrations: Array<(s: any) => any> = [];

export type LoadResult =
  | { kind: 'ok'; state: State; fromBackup: boolean }
  | { kind: 'readonly'; state: State } // 存档版本高于代码版本
  | { kind: 'new'; state: State };

export function serialize(s: State): string {
  const body = JSON.stringify(s);
  return JSON.stringify({ sum: fnv(body), body });
}

export function parse(raw: string): { state: State; newer: boolean } | null {
  try {
    const { sum, body } = JSON.parse(raw);
    if (typeof body !== 'string' || sum !== fnv(body)) return null;
    let s = JSON.parse(body);
    if (typeof s.version !== 'number') return null;
    if (s.version > SAVE_VERSION) return { state: s as State, newer: true };
    // 旧版(<3)是另一套玩法,存档不兼容:丢弃,从头开始
    if (s.version < SAVE_VERSION) return null;
    while (s.version < SAVE_VERSION) {
      s = migrations[s.version](s);
      s.version += 1;
    }
    return { state: s as State, newer: false };
  } catch {
    return null;
  }
}

export function save(kv: KV, s: State, now: number): boolean {
  s.lastSeen = now;
  try {
    const old = kv.getItem(SAVE_KEY);
    if (old) kv.setItem(SAVE_BAK_KEY, old);
    kv.setItem(SAVE_KEY, serialize(s));
    return true;
  } catch {
    return false; // 配额超限或隐私模式
  }
}

export function load(kv: KV, now: number): LoadResult {
  for (const [i, key] of [SAVE_KEY, SAVE_BAK_KEY].entries()) {
    let raw: string | null = null;
    try {
      raw = kv.getItem(key);
    } catch {
      /* 存储不可读 */
    }
    if (!raw) continue;
    const r = parse(raw);
    if (!r) continue;
    if (r.newer) return { kind: 'readonly', state: r.state };
    return { kind: 'ok', state: fillDefaults(r.state, now), fromBackup: i === 1 };
  }
  return { kind: 'new', state: newState(now) };
}

/** 迁移后补齐可能缺失的字段;结构对不上(旧版存档)直接当新档 */
function fillDefaults(s: State, now: number): State {
  const d = newState(now);
  const line = (l: any, dl: State['source']): State['source'] => ({
    tier: Number.isInteger(l?.tier) ? l.tier : 0,
    units: dl.units.map((_, i) => (Number.isFinite(l?.units?.[i]) ? l.units[i] : dl.units[i])),
    branch: dl.branch.map((_, i) => (l?.branch?.[i] === 0 || l?.branch?.[i] === 1 ? l.branch[i] : -1)) as State['source']['branch'],
  });
  return {
    ...d,
    ...s,
    source: line(s.source, d.source),
    route: line(s.route, d.route),
    gates: d.gates.map((_, i) => s.gates?.[i] ?? null),
    gatesUnlocked: Array.isArray(s.gatesUnlocked) ? s.gatesUnlocked : d.gatesUnlocked,
    vehicles: Array.isArray(s.vehicles) && s.vehicles.length ? s.vehicles : d.vehicles,
    tierTimes: { source: s.tierTimes?.source ?? [], route: s.tierTimes?.route ?? [] },
    settings: { ...d.settings, ...s.settings },
  };
}

export function exportSave(s: State): string {
  return btoa(unescape(encodeURIComponent(serialize(s))));
}

export function importSave(text: string): State | null {
  try {
    const raw = decodeURIComponent(escape(atob(text.trim())));
    const r = parse(raw);
    return r && !r.newer ? r.state : null;
  } catch {
    return null;
  }
}

/** 启动时探测存储是否可写(隐私模式、配额) */
export function storageWritable(kv: KV): boolean {
  try {
    kv.setItem('__probe', '1');
    return true;
  } catch {
    return false;
  }
}
