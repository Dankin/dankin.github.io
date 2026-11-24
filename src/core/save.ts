import { SAVE_BAK_KEY, SAVE_KEY, SAVE_VERSION } from './constants.ts';
import { HELPER, helperOldTotal } from './content.ts';
import { newState, PIN_SLOTS, type State } from './state.ts';
import { migrateRouteTiers, migrateV6Redesign } from './sys/migrate.ts';
import { newSys, normalizeSys } from './sys/state.ts';

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

/**
 * migrations[v] 把 v 版存档升到 v+1 版(parse 会自动把 version 加一)。
 * v1/v2 是旧的数值模型,结构完全不同:不迁移,直接换成全新存档(见 parse 的 MIN_MIGRATABLE)。
 * 迁移前 load() 会把原始存档文本另存一份 `SAVE_KEY.v<旧版本>.bak`(见 migrationBackupKey)。
 */
export const migrations: Array<(s: any) => any> = [];
/** 低于这个版本的存档无法迁移 */
export const MIN_MIGRATABLE = 3;
/** v3 → v4:加 spent(累计花费;旧档不可考,从 0 记)与 pin(钉住目标)。coins/delivered 等数值原样保留。 */
migrations[3] = (s) => ({ ...s, spent: 0, pin: null });
/** v4 → v5:运输线 6 档 → 9 档(旧索引 0..5 映射到 0,2,4,5,7,8),见 sys/migrate.ts。同时加 State.sys(玩法系统状态)。 */
migrations[4] = (s) => ({ ...migrateRouteTiers(s), sys: newSys() });

/**
 * v5 → v6:老徐从"数量 0..12"改成"等级 0..8"。按"相当于几位老徐"折算:取 equiv ≤ 旧数量的最高级,
 * 多出来的那几位按旧价退回手上苹果(不丢进度)。旧字段 helpers 删除,新字段 helperLevel。
 */
migrations[5] = (s) => {
  const n = Math.max(0, Math.min(12, Math.floor(Number(s.helpers) || 0)));
  let lv = 0;
  for (let l = 1; l <= HELPER.max; l++) if (HELPER.equiv[l] <= n) lv = l;
  const refund = helperOldTotal(n) - helperOldTotal(HELPER.equiv[lv]);
  const { helpers: _drop, ...rest } = s;
  return { ...rest, helperLevel: lv, helperAct: 1, coins: (Number(s.coins) || 0) + Math.max(0, refund) };
};

/** v6 → v7(v6 重设计):产出线 6→5 档、运输线 9→8 档(蹦床删除)、删槽位。见 sys/migrate.ts。 */
migrations[6] = (s) => migrateV6Redesign(s);

/** 迁移前备份的 key:每个旧版本一份,不覆盖已有的 */
export const migrationBackupKey = (fromVersion: number): string => `${SAVE_KEY}.v${fromVersion}.bak`;

export type LoadResult =
  | { kind: 'ok'; state: State; fromBackup: boolean }
  | { kind: 'readonly'; state: State } // 存档版本高于代码版本
  | { kind: 'new'; state: State };

export function serialize(s: State): string {
  const body = JSON.stringify(s);
  return JSON.stringify({ sum: fnv(body), body });
}

export function parse(raw: string): { state: State; newer: boolean; migratedFrom?: number } | null {
  try {
    const { sum, body } = JSON.parse(raw);
    if (typeof body !== 'string' || sum !== fnv(body)) return null;
    let s = JSON.parse(body);
    if (typeof s.version !== 'number') return null;
    if (s.version > SAVE_VERSION) return { state: s as State, newer: true };
    // 旧版(<3)是另一套玩法,存档不兼容:丢弃,从头开始
    if (s.version < MIN_MIGRATABLE) return null;
    const from = s.version as number;
    while (s.version < SAVE_VERSION) {
      s = migrations[s.version](s);
      s.version += 1;
    }
    return from < SAVE_VERSION ? { state: s as State, newer: false, migratedFrom: from } : { state: s as State, newer: false };
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
    if (r.migratedFrom !== undefined) backupBeforeMigration(kv, raw, r.migratedFrom);
    return { kind: 'ok', state: fillDefaults(r.state, now), fromBackup: i === 1 };
  }
  return { kind: 'new', state: newState(now) };
}

/** 旧版存档迁移前,把原文另存一份(已有就不覆盖:最早的那份最值钱) */
function backupBeforeMigration(kv: KV, raw: string, from: number): void {
  try {
    const key = migrationBackupKey(from);
    if (!kv.getItem(key)) kv.setItem(key, raw);
  } catch {
    /* 存储不可写:迁移照常进行,只是没有备份 */
  }
}

/** 迁移后补齐可能缺失的字段;结构对不上(旧版存档)直接当新档 */
function fillDefaults(s: State, now: number): State {
  const d = newState(now);
  const line = (l: any, dl: State['source']): State['source'] => ({
    tier: Number.isInteger(l?.tier) ? l.tier : 0,
    units: dl.units.map((_, i) => (Number.isFinite(l?.units?.[i]) ? l.units[i] : dl.units[i])),
    ext: dl.ext.map((_, i) => Math.min(3, Math.max(0, Math.floor(Number.isFinite(l?.ext?.[i]) ? l.ext[i] : 0)))),
    branch: dl.branch.map((_, i) => (l?.branch?.[i] === 0 || l?.branch?.[i] === 1 ? l.branch[i] : -1)) as State['source']['branch'],
  });
  const legacy = s as any;
  const num = (v: unknown, dv: number) => (typeof v === 'number' && Number.isFinite(v) ? v : dv);
  const out: any = {
    ...d,
    ...s,
    spent: Math.max(0, num(legacy.spent, 0)),
    pin: PIN_SLOTS.includes(legacy.pin) ? legacy.pin : null,
    sys: normalizeSys(legacy.sys),
    shakes: num(legacy.shakes ?? legacy.clicks, 0),
    charge: Math.min(1, Math.max(0, num(legacy.charge ?? legacy.flywheel, 0))),
    shakeRate: 0,
    shakeTok: Math.min(3, Math.max(0, num(legacy.shakeTok, 3))),
    helperLevel: Math.min(HELPER.max, Math.max(0, Math.floor(num(legacy.helperLevel, 0)))),
    helperAct: Math.min(1, Math.max(0, num(legacy.helperAct, 1))),
    source: line(s.source, d.source),
    route: line(s.route, d.route),
    vehicles: Array.isArray(s.vehicles) && s.vehicles.length ? s.vehicles : d.vehicles,
    tierTimes: { source: s.tierTimes?.source ?? [], route: s.tierTimes?.route ?? [] },
    settings: { ...d.settings, ...s.settings },
  };
  delete out.clicks;
  delete out.flywheel;
  delete out.turns;
  delete out.flings;
  return out as State;
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
