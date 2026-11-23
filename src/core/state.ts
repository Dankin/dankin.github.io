import { SAVE_VERSION } from './constants.ts';

export const UPGRADE_IDS = ['shake', 'breeze', 'gardener', 'tractor', 'branches', 'breed', 'shaker', 'drone', 'express', 'cloud'] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];
export type UpgradeLevels = Record<UpgradeId, number>;

export const PROJECT_IDS = ['gravity', 'fairest', 'cook', 'duo', 'garage', 'doctor', 'witch', 'onemore'] as const;
export type ProjectId = (typeof PROJECT_IDS)[number];

export interface State {
  version: number;
  /** 本轮持有的苹果,用来买升级 */
  apples: number;
  /** 累计送出的平安果,永不重置,是进度条 */
  delivered: number;
  clicks: number;
  upgrades: UpgradeLevels;
  /** 已购买的项目(一次性) */
  projects: Record<ProjectId, boolean>;
  /** 计时型加成,毫秒时间戳 */
  buffs: { cookUntil: number; cookReadyAt: number; goldUntil: number };
  /** 禁果已咬几口(0-3),每口全部产出 ×2 */
  bites: number;
  /** 女巫苹果是否已用过(整局一次) */
  witchUsed: boolean;
  /** 已解锁的成就 id -> 解锁时间戳 */
  achievements: Record<string, number>;
  /** 沉睡状态:离线按 100% 效率结算(女巫苹果,M2 使用) */
  sleeping: boolean;
  lastSeen: number;
  startedAt: number;
  settings: { sound: boolean; reducedMotion: boolean };
}

export function emptyLevels(): UpgradeLevels {
  return Object.fromEntries(UPGRADE_IDS.map((id) => [id, 0])) as UpgradeLevels;
}

export function emptyProjects(): Record<ProjectId, boolean> {
  return Object.fromEntries(PROJECT_IDS.map((id) => [id, false])) as Record<ProjectId, boolean>;
}

export function newState(now: number): State {
  return {
    version: SAVE_VERSION,
    apples: 0,
    delivered: 0,
    clicks: 0,
    upgrades: emptyLevels(),
    projects: emptyProjects(),
    buffs: { cookUntil: 0, cookReadyAt: 0, goldUntil: 0 },
    bites: 0,
    witchUsed: false,
    achievements: {},
    sleeping: false,
    lastSeen: now,
    startedAt: now,
    settings: { sound: false, reducedMotion: false },
  };
}
