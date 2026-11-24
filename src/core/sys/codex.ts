// 图鉴 / 成就 / 彩蛋状态机。只存"发现了什么、何时、进度计数器";文案在 src/content。
import { EGG_IDS } from './eggs.ts';
import type { Snapshot } from './types.ts';
import { APPLE_KINDS, type AppleKind } from './varieties.ts';

export { checkEggs, EGG_IDS, EGG_COUNT, EGG_KIND_UNLOCK, dayDiff } from './eggs.ts';
export type { EggHit } from './eggs.ts';
export type { EggEvent, Snapshot, TapTarget } from './types.ts';

export interface CodexState {
  /** 已发现品种:首次 playSec 与累计见到次数 */
  kinds: Partial<Record<AppleKind, { at: number; n: number }>>;
  /** 已触发彩蛋:首次 playSec 与触发次数 */
  eggs: Record<string, { at: number; n: number }>;
  /** 已解锁成就:id → 解锁 playSec */
  ach: Record<string, number>;
  /** 累计型计数器(烂果清理数等) */
  counters: Record<string, number>;
  /** 连点状态 */
  tapRun: Record<string, { n: number; last: number }>;
  /** 最近一次登录的 UTC+8 日期 'YYYY-MM-DD'("一天一苹果") */
  lastLoginDay: string;
  /** 浪费水位(木村奇迹:零浪费计时的起点) */
  wasteMark: { wasted: number; at: number };
}

export const newCodex = (): CodexState => ({
  kinds: {}, eggs: {}, ach: {}, counters: {}, tapRun: {}, lastLoginDay: '', wasteMark: { wasted: 0, at: 0 },
});

/** 读档:容错补全缺字段 */
export function normalizeCodex(raw: unknown): CodexState {
  const c = newCodex();
  if (!raw || typeof raw !== 'object') return c;
  const r = raw as Partial<CodexState>;
  if (r.kinds && typeof r.kinds === 'object') c.kinds = r.kinds;
  if (r.eggs && typeof r.eggs === 'object') c.eggs = r.eggs;
  if (r.ach && typeof r.ach === 'object') c.ach = r.ach;
  if (r.counters && typeof r.counters === 'object') c.counters = r.counters;
  if (typeof r.lastLoginDay === 'string') c.lastLoginDay = r.lastLoginDay;
  if (r.wasteMark && typeof r.wasteMark.at === 'number') c.wasteMark = r.wasteMark;
  return c; // tapRun 是瞬时状态,不读回
}

/** 记录品种;返回是否第一次见到 */
export function discoverKind(c: CodexState, kind: AppleKind, playSec: number): boolean {
  const rec = c.kinds[kind];
  if (rec) {
    rec.n++;
    return false;
  }
  c.kinds[kind] = { at: playSec, n: 1 };
  return true;
}

/** 手动记录彩蛋(例如点掉毒苹果这类不走 checkEggs 的路径);返回是否第一次 */
export function discoverEgg(c: CodexState, id: string, playSec: number): boolean {
  const rec = c.eggs[id];
  if (rec) {
    rec.n++;
    return false;
  }
  c.eggs[id] = { at: playSec, n: 1 };
  return true;
}

export interface AchievementDef {
  id: string;
  name: string;
  /** 解锁条件 */
  test: (s: Snapshot, c: CodexState) => boolean;
}

const kindsFound = (c: CodexState): number => APPLE_KINDS.filter((k) => c.kinds[k]).length;
const eggsFound = (c: CodexState): number => EGG_IDS.filter((id) => c.eggs[id]).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-shake', name: '第一摇', test: (s) => s.shakes >= 1 },
  { id: 'shakes-100', name: '摇了一百下', test: (s) => s.shakes >= 100 },
  { id: 'shakes-1000', name: '手腕发烫', test: (s) => s.shakes >= 1000 },
  { id: 'shakes-5000', name: '摇树宗师', test: (s) => s.shakes >= 5000 },
  { id: 'combo-30', name: '连摇 30', test: (s) => s.combo >= 30 },
  { id: 'tier-1', name: '升了第一档', test: (s) => Math.max(s.sourceTier, s.routeTier) >= 1 },
  { id: 'tier-3', name: '两线三档', test: (s) => s.era >= 3 },
  { id: 'tier-5', name: '两线满档', test: (s) => s.era >= 5 },
  { id: 'helpers-5', name: '五个帮手', test: (s) => s.helpers >= 5 },
  { id: 'p-1', name: '送出 1%', test: (s) => s.progress >= 0.01 },
  { id: 'p-10', name: '送出 10%', test: (s) => s.progress >= 0.1 },
  { id: 'p-50', name: '过半', test: (s) => s.progress >= 0.5 },
  { id: 'p-90', name: '送出 90%', test: (s) => s.progress >= 0.9 },
  { id: 'p-100', name: '82 亿', test: (s) => s.progress >= 1 },
  { id: 'order-1', name: '第一单', test: (s) => s.ordersDone >= 1 },
  { id: 'order-10', name: '十单老顾客', test: (s) => s.ordersDone >= 10 },
  { id: 'order-30', name: '三十单', test: (s) => s.ordersDone >= 30 },
  { id: 'pest-10', name: '除虫十只', test: (s) => s.pestsKilled >= 10 },
  { id: 'pest-50', name: '除虫五十只', test: (s) => s.pestsKilled >= 50 },
  { id: 'offer-1', name: '第一次献果', test: (s) => s.offerCount >= 1 },
  { id: 'gold-1', name: '见过金苹果', test: (_s, c) => !!c.kinds.golden },
  { id: 'kinds-5', name: '图鉴五种', test: (_s, c) => kindsFound(c) >= 5 },
  { id: 'kinds-all', name: '品种齐全', test: (_s, c) => kindsFound(c) >= APPLE_KINDS.length },
  { id: 'eggs-5', name: '彩蛋五个', test: (_s, c) => eggsFound(c) >= 5 },
  { id: 'eggs-15', name: '彩蛋十五个', test: (_s, c) => eggsFound(c) >= 15 },
  { id: 'eggs-all', name: '彩蛋全收集', test: (_s, c) => eggsFound(c) >= EGG_IDS.length },
];

/** 检查成就;返回本次新解锁的 id。每个事件后/每秒调一次都行(很便宜) */
export function checkAchievements(s: Snapshot, c: CodexState): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (c.ach[a.id] !== undefined) continue;
    if (a.test(s, c)) {
      c.ach[a.id] = s.playSec;
      out.push(a.id);
    }
  }
  return out;
}

export interface CodexProgress {
  kinds: { found: number; total: number };
  eggs: { found: number; total: number };
  ach: { found: number; total: number };
  /** 图鉴总进度 n/total(品种 + 彩蛋) */
  all: { found: number; total: number };
}

export function codexProgress(c: CodexState): CodexProgress {
  const k = kindsFound(c);
  const e = eggsFound(c);
  const a = ACHIEVEMENTS.filter((x) => c.ach[x.id] !== undefined).length;
  return {
    kinds: { found: k, total: APPLE_KINDS.length },
    eggs: { found: e, total: EGG_IDS.length },
    ach: { found: a, total: ACHIEVEMENTS.length },
    all: { found: k + e, total: APPLE_KINDS.length + EGG_IDS.length },
  };
}
